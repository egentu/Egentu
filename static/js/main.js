// Three.js Neural Network Hero Animation
(function() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 22);

  // Particles
  const N = 180;
  const pos = new Float32Array(N * 3);
  const nodeData = [];
  for (let i = 0; i < N; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 4 + Math.random() * 7;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    nodeData.push({ ox: x, oy: y, oz: z, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5 });
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0xa855f7, size: 0.18, transparent: true, opacity: 0.85, sizeAttenuation: true });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Connections
  const THRESH = 5.5;
  const linePositions = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = nodeData[i].ox - nodeData[j].ox;
      const dy = nodeData[i].oy - nodeData[j].oy;
      const dz = nodeData[i].oz - nodeData[j].oz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < THRESH) {
        linePositions.push(nodeData[i].ox, nodeData[i].oy, nodeData[i].oz);
        linePositions.push(nodeData[j].ox, nodeData[j].oy, nodeData[j].oz);
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.15 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  // Central sphere
  const sphereGeo = new THREE.SphereGeometry(1.8, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.08, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);

  // Rings
  const ringGeo = new THREE.TorusGeometry(3.5, 0.03, 8, 80);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 3;
  scene.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5, 0.02, 8, 80), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.25 }));
  ring2.rotation.x = -Math.PI / 5;
  ring2.rotation.y = Math.PI / 4;
  scene.add(ring2);

  // Mouse interaction
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  let time = 0;
  function animate() {
    requestAnimationFrame(animate);
    time += 0.008;

    sphere.rotation.y += 0.004;
    sphere.rotation.x += 0.002;
    ring1.rotation.z += 0.006;
    ring2.rotation.z -= 0.004;

    particles.rotation.y = time * 0.12 + mouseX * 0.15;
    particles.rotation.x = mouseY * 0.1;
    lines.rotation.y = time * 0.12 + mouseX * 0.15;
    lines.rotation.x = mouseY * 0.1;

    const positions = particleGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      const nd = nodeData[i];
      const wave = Math.sin(time * nd.speed + nd.phase) * 0.3;
      positions.array[i * 3] = nd.ox * (1 + wave * 0.05);
      positions.array[i * 3 + 1] = nd.oy * (1 + wave * 0.05);
      positions.array[i * 3 + 2] = nd.oz * (1 + wave * 0.05);
    }
    positions.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();
})();

// Scroll Reveal Animation
const revealElements = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
revealElements.forEach(el => observer.observe(el));

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) {
    nav.style.borderBottomColor = window.scrollY > 50 ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.15)';
  }
});

// Hamburger Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// Smooth Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      if (navLinks) navLinks.classList.remove('open');
    }
  });
});

// Contact Form Submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = this.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    const formData = {
      name: document.getElementById('contactName').value,
      email: document.getElementById('contactEmail').value,
      company: document.getElementById('contactCompany').value,
      service: document.getElementById('contactService').value,
      message: document.getElementById('contactMessage').value
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const successMsg = document.getElementById('successMsg');
        successMsg.style.display = 'block';
        this.reset();
        setTimeout(() => successMsg.style.display = 'none', 5000);
      } else {
        alert('Error: ' + (result.error || 'Failed to send message.'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Network error. Please try again.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ---------- Service Card Modal (center, larger text, contact button) ----------
const serviceCards = document.querySelectorAll('.service-card');
const modal = document.getElementById('serviceModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalTag = document.getElementById('modalTag');
const closeModalBtn = modal?.querySelector('.close-modal');
const modalContactBtn = document.getElementById('modalContactBtn');

function openServiceModal(card) {
  // Extract data from clicked service card
  const icon = card.querySelector('.svc-icon')?.innerHTML || '⚙️';
  const title = card.querySelector('h3')?.innerText || 'Service';
  const desc = card.querySelector('p')?.innerText || '';
  const tag = card.querySelector('.svc-tag')?.innerText || 'AI Solution';

  modalIcon.innerHTML = icon;
  modalTitle.innerText = title;
  modalDesc.innerText = desc;
  modalTag.innerText = tag;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // prevent scroll behind modal
}

function closeServiceModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Attach click event to every service card
if (serviceCards.length && modal) {
  serviceCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // Prevent if clicking inside a button or link inside card (optional)
      if (e.target.closest('a, button')) return;
      openServiceModal(card);
    });
  });

  closeModalBtn?.addEventListener('click', closeServiceModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeServiceModal();
  });

  // Redirect to contact section when modal button is clicked
  if (modalContactBtn) {
    modalContactBtn.addEventListener('click', () => {
      closeServiceModal();
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}