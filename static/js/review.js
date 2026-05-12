// ---------- REAL REVIEW SYSTEM with Error Handling ----------
let allReviews = [];
let visibleCount = 6;
let currentRating = 0;
let isLoading = false;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showLoading(container) {
  if (container && container.innerHTML.trim() === '') {
    container.innerHTML = '<div class="loading-spinner" style="text-align:center; color:var(--muted); padding:2rem;">Loading reviews...</div>';
  }
}

function showError(container, message) {
  if (container) {
    container.innerHTML = `<div class="error-message" style="text-align:center; color:#f87171; padding:2rem;">⚠️ ${message}</div>`;
  }
}

function renderReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  const reviewsToShow = allReviews.slice(0, visibleCount);

  if (reviewsToShow.length === 0) {
    container.innerHTML = '<p style="text-align:center; width:100%; color:var(--muted); padding:2rem;">No reviews yet. Be the first to write one!</p>';
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = 'none';
    return;
  }

  container.innerHTML = reviewsToShow.map(rev => `
    <div class="review-floating-card">
      <div class="review-header">
        <img src="${rev.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.author_name)}&background=7c3aed&color=fff&rounded=true&size=48`}" 
             class="review-avatar" 
             alt="${escapeHtml(rev.author_name)}"
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(rev.author_name)}&background=7c3aed&color=fff&rounded=true&size=48'">
        <div>
          <div class="review-author">${escapeHtml(rev.author_name)}</div>
          <div class="review-date">${rev.created_at}</div>
        </div>
        <div class="review-rating">${'★'.repeat(rev.rating)}${'☆'.repeat(5-rev.rating)}</div>
      </div>
      <div class="review-text">“${escapeHtml(rev.review_text)}”</div>
    </div>
  `).join('');

  const loadBtn = document.getElementById('load-more-btn');
  if (allReviews.length > visibleCount) {
    loadBtn.style.display = 'inline-block';
    loadBtn.textContent = `+ Load More (${allReviews.length - visibleCount} remaining)`;
  } else {
    loadBtn.style.display = 'none';
  }
}

function loadMoreReviews() {
  visibleCount = allReviews.length;
  renderReviews();
}

async function fetchReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  showLoading(container);

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allReviews = await res.json();
    allReviews.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    visibleCount = 6;
    renderReviews();
  } catch (err) {
    console.error('Failed to load reviews:', err);
    showError(container, 'Could not load reviews. Please refresh the page.');
  }
}

async function checkLoginStatus() {
  const loginStatusDiv = document.getElementById('review-login-status');
  const formDiv = document.getElementById('review-form-fields');

  if (!loginStatusDiv || !formDiv) return;

  try {
    const res = await fetch('/api/user', {
      redirect: 'manual',
      credentials: 'same-origin'
    });

    if (res.status === 200) {
      const user = await res.json();
      loginStatusDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&rounded=true&size=36`}" 
               width="36" 
               style="border-radius: 50%;" 
               alt="${escapeHtml(user.name)}">
          <span>Welcome, <strong>${escapeHtml(user.name)}</strong>!</span>
          <a href="/logout" class="btn-secondary" style="padding: 0.3rem 1rem; font-size: 0.8rem; text-decoration: none;">Logout</a>
        </div>
      `;
      formDiv.style.display = 'block';
    } else {
      loginStatusDiv.innerHTML = `
        <button id="google-login-action" class="btn-primary" style="background: linear-gradient(135deg, #4285f4, #34a853);">
          🔐 Sign in with Google to Write a Review
        </button>
      `;
      formDiv.style.display = 'none';
      const loginBtn = document.getElementById('google-login-action');
      if (loginBtn) {
        loginBtn.onclick = () => window.location.href = '/login/google';
      }
    }
  } catch (err) {
    console.error('Login check error:', err);
    loginStatusDiv.innerHTML = `<div style="color:#f87171;">⚠️ Could not verify login status. Please refresh.</div>`;
    formDiv.style.display = 'none';
  }
}

function initStarRating() {
  const stars = document.querySelectorAll('#star-rating-widget span');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.getAttribute('data-value'));
      currentRating = val;
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-value')) <= val) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
  });
}

async function submitReview() {
  const reviewText = document.getElementById('review-text-input').value.trim();
  const feedbackDiv = document.getElementById('review-feedback');

  if (currentRating === 0) {
    feedbackDiv.innerHTML = '<span style="color:#f87171;">⭐ Please select a rating</span>';
    setTimeout(() => feedbackDiv.innerHTML = '', 3000);
    return;
  }

  if (reviewText.length < 5) {
    feedbackDiv.innerHTML = '<span style="color:#f87171;">Please write at least 5 characters</span>';
    setTimeout(() => feedbackDiv.innerHTML = '', 3000);
    return;
  }

  if (reviewText.length > 1000) {
    feedbackDiv.innerHTML = '<span style="color:#f87171;">Review must be less than 1000 characters</span>';
    setTimeout(() => feedbackDiv.innerHTML = '', 3000);
    return;
  }

  const submitBtn = document.getElementById('submit-review-btn');
  const origText = submitBtn.textContent;
  submitBtn.textContent = 'Posting...';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: currentRating, review_text: reviewText })
    });

    if (res.ok) {
      feedbackDiv.innerHTML = '<span style="color:#4ade80;">✅ Review posted successfully!</span>';
      document.getElementById('review-text-input').value = '';
      currentRating = 0;
      document.querySelectorAll('#star-rating-widget span').forEach(s => s.classList.remove('active'));
      await fetchReviews();
      setTimeout(() => feedbackDiv.innerHTML = '', 3000);
    } else {
      const err = await res.json();
      feedbackDiv.innerHTML = `<span style="color:#f87171;">❌ ${err.error || 'Error submitting review'}</span>`;
      setTimeout(() => feedbackDiv.innerHTML = '', 4000);
    }
  } catch (err) {
    console.error('Review submission error:', err);
    feedbackDiv.innerHTML = '<span style="color:#f87171;">❌ Network error. Please try again.</span>';
    setTimeout(() => feedbackDiv.innerHTML = '', 4000);
  } finally {
    submitBtn.textContent = origText;
    submitBtn.disabled = false;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  fetchReviews();
  checkLoginStatus();
  initStarRating();

  const submitBtn = document.getElementById('submit-review-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitReview);
  }

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreReviews);
  }
});