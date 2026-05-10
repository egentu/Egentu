// ---------- REAL REVIEW SYSTEM (no mock, no demo) ----------
let allReviews = [];
let visibleCount = 6;
let currentRating = 0;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function renderReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;
  const reviewsToShow = allReviews.slice(0, visibleCount);
  if (reviewsToShow.length === 0) {
    container.innerHTML = '<p style="text-align:center; width:100%; color:var(--muted);">No reviews yet. Be the first to write one!</p>';
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = 'none';
    return;
  }
  container.innerHTML = reviewsToShow.map(rev => `
    <div class="review-floating-card">
      <div class="review-header">
        <img src="${rev.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.author_name)}&background=7c3aed&color=fff&rounded=true&size=48`}" class="review-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(rev.author_name)}&background=7c3aed&color=fff&rounded=true&size=48'">
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
  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error();
    allReviews = await res.json();
    allReviews.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    visibleCount = 6;
    renderReviews();
  } catch (err) {
    console.error('Failed to load reviews');
    document.getElementById('reviews-container').innerHTML = '<p style="text-align:center; color:#f87171;">⚠️ Could not load reviews. Try again later.</p>';
  }
}

async function checkLoginStatus() {
  const loginStatusDiv = document.getElementById('review-login-status');
  const formDiv = document.getElementById('review-form-fields');
  try {
    const res = await fetch('/api/user', { redirect: 'manual' }); // prevent automatic redirect
    if (res.status === 200) {
      const user = await res.json();
      loginStatusDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&rounded=true&size=36`}" width="36" style="border-radius: 50%;">
          <span>Welcome, <strong>${escapeHtml(user.name)}</strong>!</span>
          <a href="/logout" class="btn-secondary" style="padding: 0.3rem 1rem; font-size: 0.8rem;">Logout</a>
        </div>
      `;
      formDiv.style.display = 'block';
    } else {
      // Not logged in – show real Google login button
      loginStatusDiv.innerHTML = `
        <button id="google-login-action" class="btn-primary" style="background: linear-gradient(135deg, #4285f4, #34a853);">
          🔐 Sign in with Google to Write a Review
        </button>
      `;
      formDiv.style.display = 'none';
      const loginBtn = document.getElementById('google-login-action');
      if (loginBtn) loginBtn.onclick = () => window.location.href = '/login/google';
    }
  } catch (err) {
    loginStatusDiv.innerHTML = `<div style="color:#f87171;">⚠️ Could not connect to server. Make sure backend is running.</div>`;
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
        if (parseInt(s.getAttribute('data-value')) <= val) s.classList.add('active');
        else s.classList.remove('active');
      });
    });
  });
}

async function submitReview() {
  const reviewText = document.getElementById('review-text-input').value.trim();
  if (currentRating === 0) {
    document.getElementById('review-feedback').innerHTML = '<span style="color:#f87171;">⭐ Select a rating</span>';
    return;
  }
  if (reviewText.length < 5) {
    document.getElementById('review-feedback').innerHTML = '<span style="color:#f87171;">Write at least 5 characters</span>';
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
      document.getElementById('review-feedback').innerHTML = '<span style="color:#4ade80;">✅ Review posted!</span>';
      document.getElementById('review-text-input').value = '';
      currentRating = 0;
      document.querySelectorAll('#star-rating-widget span').forEach(s => s.classList.remove('active'));
      await fetchReviews();
    } else {
      const err = await res.json();
      document.getElementById('review-feedback').innerHTML = `<span style="color:#f87171;">❌ ${err.error || 'Error'}</span>`;
    }
  } catch (err) {
    document.getElementById('review-feedback').innerHTML = '<span style="color:#f87171;">Network error</span>';
  } finally {
    submitBtn.textContent = origText;
    submitBtn.disabled = false;
    setTimeout(() => document.getElementById('review-feedback').innerHTML = '', 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchReviews();
  checkLoginStatus();
  initStarRating();
  document.getElementById('submit-review-btn')?.addEventListener('click', submitReview);
  document.getElementById('load-more-btn')?.addEventListener('click', loadMoreReviews);
});