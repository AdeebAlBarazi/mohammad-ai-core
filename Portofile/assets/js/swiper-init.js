// ===============================
// Swiper Integration for Projects & Certificates
// ===============================

let projectsSwiper = null;
let certificatesSwiper = null;

// Initialize Projects Swiper
function initProjectsSwiper() {
  const container = document.querySelector('.projects-carousel-container');
  const wrapper = document.querySelector('#projects-grid');
  
  if (!container || !wrapper) {
    console.log('⏳ Projects container not ready');
    return null;
  }

  const cards = wrapper.querySelectorAll('.project-card');
  if (cards.length === 0) {
    console.log('⏳ No project cards found yet');
    return null;
  }

  // Destroy existing instance if any
  if (projectsSwiper && projectsSwiper.destroy) {
    projectsSwiper.destroy(true, true);
  }

  console.log(`🎯 Initializing Projects Swiper with ${cards.length} cards`);

  // Ensure all cards have swiper-slide class
  cards.forEach(card => {
    if (!card.classList.contains('swiper-slide')) {
      card.classList.add('swiper-slide');
    }
  });

  // Initialize Swiper using selector string
  try {
    projectsSwiper = new Swiper('.projects-carousel-container', {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      coverflowEffect: {
        rotate: 35,
        stretch: 0,
        depth: 200,
        modifier: 1,
        slideShadows: false,
      },
      loop: cards.length > 1,
      autoplay: cards.length > 1 ? {
        delay: 4000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      } : false,
      speed: 1000,
      keyboard: {
        enabled: true,
      },
      mousewheel: {
        enabled: true,
        forceToAxis: true,
      },
    });

    console.log('✅ Projects Swiper initialized successfully');
    return projectsSwiper;
  } catch (error) {
    console.error('❌ Projects Swiper initialization failed:', error);
    return null;
  }
}

// Initialize Certificates Swiper
function initCertificatesSwiper() {
  const container = document.querySelector('.certificates-slider');
  const wrapper = document.querySelector('.certificates-track');
  
  if (!container || !wrapper) {
    console.log('⏳ Certificates container not ready');
    return null;
  }

  const cards = wrapper.querySelectorAll('.certificate-card');
  if (cards.length === 0) {
    console.log('⏳ No certificate cards found yet');
    return null;
  }

  // Destroy existing instance if any
  if (certificatesSwiper && certificatesSwiper.destroy) {
    certificatesSwiper.destroy(true, true);
  }

  console.log(`🎯 Initializing Certificates Swiper with ${cards.length} cards`);

  // Ensure all cards have swiper-slide class
  cards.forEach(card => {
    if (!card.classList.contains('swiper-slide')) {
      card.classList.add('swiper-slide');
    }
  });

  // Initialize Swiper
  try {
    certificatesSwiper = new Swiper(container, {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      coverflowEffect: {
        rotate: 30,
        stretch: 0,
        depth: 150,
        modifier: 1,
        slideShadows: false,
      },
      loop: cards.length > 1,
      autoplay: cards.length > 1 ? {
        delay: 3000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      } : false,
      speed: 800,
      keyboard: {
        enabled: true,
      },
      mousewheel: {
        enabled: true,
        forceToAxis: true,
      },
    });

    console.log('✅ Certificates Swiper initialized successfully');
    return certificatesSwiper;
  } catch (error) {
    console.error('❌ Certificates Swiper initialization failed:', error);
    return null;
  }
}

// Retry mechanism for Projects
function retryProjectsSwiper(attempts = 0, maxAttempts = 10) {
  if (attempts >= maxAttempts) {
    console.log('⏹️ Projects Swiper initialization stopped after max attempts');
    return;
  }

  const result = initProjectsSwiper();
  if (!result) {
    setTimeout(() => retryProjectsSwiper(attempts + 1, maxAttempts), 300);
  }
}

// Retry mechanism for Certificates
function retryCertificatesSwiper(attempts = 0, maxAttempts = 10) {
  if (attempts >= maxAttempts) {
    console.log('⏹️ Certificates Swiper initialization stopped after max attempts');
    return;
  }

  const result = initCertificatesSwiper();
  if (!result) {
    setTimeout(() => retryCertificatesSwiper(attempts + 1, maxAttempts), 300);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, starting Swiper initialization...');
    retryProjectsSwiper();
    retryCertificatesSwiper();
  });
} else {
  console.log('📄 DOM already loaded, starting Swiper initialization...');
  retryProjectsSwiper();
  retryCertificatesSwiper();
}

// Expose functions globally
window.initProjectsSwiper = initProjectsSwiper;
window.initCertificatesSwiper = initCertificatesSwiper;
window.projectsSwiper = projectsSwiper;
window.certificatesSwiper = certificatesSwiper;

