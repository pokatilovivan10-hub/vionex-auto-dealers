const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = window.location.protocol === 'file:' || document.body?.dataset.preview === 'true';

const state = {
  sessionId: getSessionId(),
  utm: readUtm(),
  lastFocused: null,
};

function createSessionId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `vl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId() {
  try {
    const existing = sessionStorage.getItem('vionex_session_id');
    if (existing) return existing;
    const id = createSessionId();
    sessionStorage.setItem('vionex_session_id', id);
    return id;
  } catch {
    return createSessionId();
  }
}

function readUtm() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  for (const key of ['source', 'medium', 'campaign', 'content', 'term']) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value.slice(0, 160);
  }
  try {
    if (Object.keys(utm).length) sessionStorage.setItem('vionex_utm', JSON.stringify(utm));
    return Object.keys(utm).length ? utm : JSON.parse(sessionStorage.getItem('vionex_utm') || '{}');
  } catch {
    return utm;
  }
}

function viewportCategory() {
  if (window.innerWidth < 720) return 'mobile';
  if (window.innerWidth < 1080) return 'tablet';
  return 'desktop';
}

async function track(event, properties = {}) {
  if (staticPreview) return;
  const payload = {
    event,
    sessionId: state.sessionId,
    properties: {
      path: window.location.pathname,
      viewport: viewportCategory(),
      theme: document.documentElement.dataset.theme || 'dark',
      utmSource: state.utm.source || '',
      utmCampaign: state.utm.campaign || '',
      ...properties,
    },
  };
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon && document.visibilityState === 'hidden') {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      return;
    }
    await fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
  } catch {
    // Analytics must not block the interface.
  }
}

function initTheme() {
  const button = $('[data-theme-toggle]');
  if (!button) return;
  const apply = (theme, announce = false) => {
    document.documentElement.dataset.theme = theme;
    button.setAttribute('aria-pressed', String(theme === 'light'));
    button.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    const meta = $('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#070810' : '#f8f9ff');
    try { localStorage.setItem('vionex-theme', theme); } catch {}
    window.dispatchEvent(new CustomEvent('vionex-theme-change', { detail: { theme } }));
    if (announce) track('theme_change', { selected: theme });
  };
  apply(document.documentElement.dataset.theme || 'dark');
  button.addEventListener('click', () => apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
}

function initHeader() {
  const header = $('[data-header]');
  const menuButton = $('[data-menu-toggle]');
  const mobileNav = $('[data-mobile-nav]');
  const progress = $('.scroll-progress span');
  const mobileCta = $('[data-mobile-cta]');

  const update = () => {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 12);
    if (progress) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.width = `${Math.min(100, (y / max) * 100)}%`;
    }
    mobileCta?.classList.toggle('is-visible', y > 640);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  menuButton?.addEventListener('click', () => {
    const open = !header.classList.contains('is-menu-open');
    header.classList.toggle('is-menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  });
  $$('a, button', mobileNav || document).forEach((element) => {
    element.addEventListener('click', () => {
      header?.classList.remove('is-menu-open');
      menuButton?.setAttribute('aria-expanded', 'false');
    });
  });
}

function initReveal() {
  const elements = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -45px' });
  elements.forEach((element) => observer.observe(element));
}

function initSectionTracking() {
  if (!('IntersectionObserver' in window)) return;
  const seen = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || seen.has(entry.target)) return;
      seen.add(entry.target);
      track('section_view', { section: entry.target.id || entry.target.className.split(' ')[0] || 'section' });
    });
  }, { threshold: 0.45 });
  $$('main > section').forEach((section) => observer.observe(section));
}

function initGlobe() {
  const canvas = $('[data-globe-canvas]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const points = [];
  const latitudes = 14;
  const longitudes = 28;
  for (let lat = 1; lat < latitudes; lat += 1) {
    const phi = Math.PI * (lat / latitudes - 0.5);
    for (let lon = 0; lon < longitudes; lon += 1) {
      const theta = Math.PI * 2 * lon / longitudes;
      points.push({ x: Math.cos(phi) * Math.cos(theta), y: Math.sin(phi), z: Math.cos(phi) * Math.sin(theta), lat, lon });
    }
  }
  const connections = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (p.lon < longitudes - 1) connections.push([i, i + 1]);
    else connections.push([i, i - (longitudes - 1)]);
    if (p.lat < latitudes - 1) connections.push([i, i + longitudes]);
  }

  let width = 0;
  let height = 0;
  let dpr = 1;
  let angle = 0;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function themeColors() {
    const light = document.documentElement.dataset.theme === 'light';
    return light
      ? { line: 'rgba(78,84,225,.22)', dot: 'rgba(91,84,238,.65)', front: 'rgba(40,117,226,.75)', glow: 'rgba(110,83,255,.2)', sphere: 'rgba(103,91,245,.08)' }
      : { line: 'rgba(143,132,255,.21)', dot: 'rgba(155,143,255,.72)', front: 'rgba(100,231,238,.82)', glow: 'rgba(96,75,255,.27)', sphere: 'rgba(83,72,190,.12)' };
  }

  function project(point, rotation) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const x = point.x * cos - point.z * sin;
    const z = point.x * sin + point.z * cos;
    const tilt = 0.25 + pointerY * 0.05;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const y = point.y * cosT - z * sinT;
    const z2 = point.y * sinT + z * cosT;
    const radius = Math.min(width, height) * 0.39;
    const scale = 1 + z2 * 0.08;
    return { x: width / 2 + (x + pointerX * 0.025) * radius * scale, y: height / 2 + y * radius * scale, z: z2 };
  }

  function draw() {
    const c = themeColors();
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.41;
    const glow = ctx.createRadialGradient(centerX, centerY, radius * .25, centerX, centerY, radius * 1.25);
    glow.addColorStop(0, c.glow);
    glow.addColorStop(.55, c.sphere);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    const projected = points.map((point) => project(point, angle));
    ctx.lineWidth = 1;
    for (const [a, b] of connections) {
      const p1 = projected[a];
      const p2 = projected[b];
      if (p1.z < -.2 && p2.z < -.2) continue;
      const alpha = .18 + Math.max(0, (p1.z + p2.z) / 2) * .16;
      ctx.strokeStyle = c.line.replace(/\.22\)|\.21\)/, `${alpha})`);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    projected
      .map((point, index) => ({ ...point, index }))
      .sort((a, b) => a.z - b.z)
      .forEach((point) => {
        if (point.z < -.32) return;
        const size = 1.1 + Math.max(0, point.z) * 1.7;
        ctx.fillStyle = point.z > .35 ? c.front : c.dot;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

    ctx.strokeStyle = c.front;
    ctx.globalAlpha = .42;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 1.08, radius * .32, -.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (!reduceMotion) angle += 0.0018;
    frame = requestAnimationFrame(draw);
  }

  const onPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    pointerY = (event.clientY - rect.top - rect.height / 2) / rect.height;
  };
  canvas.addEventListener('pointermove', onPointer, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('vionex-theme-change', draw, { passive: true });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) draw();
  });
  resize();
  draw();
}

function initCaseCarousels() {
  $$('[data-case-carousel]').forEach((carousel) => {
    const stage = $('[data-case-stage]', carousel);
    const slides = $$('[data-case-slide]', carousel);
    const prev = $('[data-case-prev]', carousel);
    const next = $('[data-case-next]', carousel);
    const dotsRoot = $('[data-case-dots]', carousel);
    const status = $('[data-case-status]', carousel);
    const autoplayToggle = $('[data-case-autoplay-toggle]', carousel);
    if (!stage || slides.length < 2) return;

    const count = slides.length;
    const delay = Math.max(3500, Math.min(15000, Number(carousel.dataset.autoplayDelay) || 6500));
    let index = Math.max(0, Math.min(count - 1, Number(carousel.dataset.startIndex) || 0));
    let autoplay = carousel.dataset.autoplay === 'true' && !reduceMotion;
    let pointerStartX = null;
    let pointerStartY = null;
    let suppressClick = false;
    let isHovered = false;
    let hasFocus = false;
    let isVisible = true;
    let timer = 0;

    carousel.style.setProperty('--case-autoplay-delay', `${delay}ms`);

    const dots = slides.map((slide, slideIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cases-carousel-dot';
      dot.setAttribute('aria-label', `Показать кейс ${slideIndex + 1}: ${slide.getAttribute('aria-label') || ''}`);
      dot.addEventListener('click', () => setIndex(slideIndex, { source: 'dot', user: true }));
      dotsRoot?.append(dot);
      return dot;
    });

    function circularDelta(slideIndex) {
      let delta = slideIndex - index;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      return delta;
    }

    function updateAutoplayControl() {
      if (!autoplayToggle) return;
      autoplayToggle.hidden = reduceMotion;
      autoplayToggle.setAttribute('aria-pressed', String(autoplay));
      autoplayToggle.setAttribute('aria-label', autoplay ? 'Остановить автоматическое переключение' : 'Запустить автоматическое переключение');
      const icon = $('span', autoplayToggle);
      if (icon) icon.textContent = autoplay ? 'Ⅱ' : '▶';
      carousel.classList.toggle('is-autoplaying', autoplay && !isHovered && !hasFocus && isVisible && !document.hidden);
    }

    function shouldRunAutoplay() {
      return autoplay && !isHovered && !hasFocus && isVisible && !document.hidden;
    }

    function clearAutoplay() {
      window.clearTimeout(timer);
      timer = 0;
      carousel.classList.remove('is-progressing');
    }

    function scheduleAutoplay() {
      clearAutoplay();
      updateAutoplayControl();
      if (!shouldRunAutoplay()) return;
      // Restart the progress animation without forcing layout on every frame.
      requestAnimationFrame(() => {
        carousel.classList.add('is-progressing');
      });
      timer = window.setTimeout(() => setIndex(index + 1, { source: 'auto' }), delay);
    }

    function updateLayout() {
      const stageWidth = stage.clientWidth || carousel.clientWidth || window.innerWidth;
      const cardWidth = slides[0].getBoundingClientRect().width || Math.min(720, stageWidth * .58);
      const mobile = stageWidth <= 720;
      const tablet = stageWidth > 720 && stageWidth <= 1040;
      const step = cardWidth * (mobile ? .92 : .94);

      slides.forEach((slide, slideIndex) => {
        const delta = circularDelta(slideIndex);
        const distance = Math.abs(delta);
        const active = distance === 0;
        const adjacent = distance === 1;
        const visible = distance <= 2;
        const scale = active ? 1 : adjacent ? (mobile ? .86 : .88) : .66;
        const opacity = active ? 1 : adjacent ? .92 : visible ? .10 : 0;
        const x = delta * step;
        const y = active ? 0 : adjacent ? 18 : 34;
        const rotate = active ? 0 : Math.max(-5, Math.min(5, delta * -2.4));

        slide.style.setProperty('--case-x', `${x}px`);
        slide.style.setProperty('--case-y', `${y}px`);
        slide.style.setProperty('--case-scale', String(scale));
        slide.style.setProperty('--case-rotate', `${rotate}deg`);
        slide.style.setProperty('--case-opacity', String(opacity));
        slide.style.setProperty('--case-z', String(20 - distance));
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('is-adjacent', adjacent);
        slide.classList.toggle('is-far', visible && !active && !adjacent);
        slide.classList.toggle('is-outside', !visible);
        slide.setAttribute('aria-hidden', String(!active));

        const link = $('.case-showcase-card-link', slide);
        if (link) link.tabIndex = active ? 0 : -1;
      });

      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      if (status) status.textContent = `${index + 1} / ${count}`;
    }

    function setIndex(nextIndex, { source = 'control', user = false } = {}) {
      resetCaseMotion();
      index = ((Number(nextIndex) % count) + count) % count;
      updateLayout();
      scheduleAutoplay();
      if (source !== 'auto') track('case_slider_change', { index, source });
      else track('case_slider_auto', { index });
      if (user) carousel.dataset.userInteracted = 'true';
    }

    slides.forEach((slide, slideIndex) => {
      slide.addEventListener('click', (event) => {
        if (suppressClick) {
          event.preventDefault();
          return;
        }
        if (slideIndex === index) return;
        event.preventDefault();
        setIndex(slideIndex, { source: 'card', user: true });
      });
    });

    prev?.addEventListener('click', () => setIndex(index - 1, { source: 'arrow_prev', user: true }));
    next?.addEventListener('click', () => setIndex(index + 1, { source: 'arrow_next', user: true }));

    autoplayToggle?.addEventListener('click', () => {
      autoplay = !autoplay;
      updateAutoplayControl();
      scheduleAutoplay();
      track('case_slider_autoplay', { enabled: autoplay });
    });

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex(index - 1, { source: 'keyboard', user: true });
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex(index + 1, { source: 'keyboard', user: true });
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setIndex(0, { source: 'keyboard_home', user: true });
      }
      if (event.key === 'End') {
        event.preventDefault();
        setIndex(count - 1, { source: 'keyboard_end', user: true });
      }
    });
    carousel.tabIndex = 0;

    carousel.addEventListener('mouseenter', () => { isHovered = true; clearAutoplay(); updateAutoplayControl(); });
    carousel.addEventListener('mouseleave', () => { isHovered = false; resetCaseMotion(); scheduleAutoplay(); });
    carousel.addEventListener('focusin', () => { hasFocus = true; clearAutoplay(); updateAutoplayControl(); });
    carousel.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        hasFocus = carousel.contains(document.activeElement);
        scheduleAutoplay();
      });
    });

    stage.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      suppressClick = false;
      stage.classList.add('is-dragging');
    }, { passive: true });

    stage.addEventListener('pointerup', (event) => {
      if (pointerStartX === null || pointerStartY === null) return;
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      pointerStartX = null;
      pointerStartY = null;
      stage.classList.remove('is-dragging');
      if (Math.abs(dx) < 44 || Math.abs(dx) <= Math.abs(dy)) return;
      suppressClick = true;
      setIndex(index + (dx < 0 ? 1 : -1), { source: 'swipe', user: true });
      window.setTimeout(() => { suppressClick = false; }, 80);
    }, { passive: true });

    stage.addEventListener('pointercancel', () => {
      pointerStartX = null;
      pointerStartY = null;
      stage.classList.remove('is-dragging');
    }, { passive: true });

    function resetCaseMotion() {
      slides.forEach((slide) => {
        slide.style.setProperty('--case-media-x', '0px');
        slide.style.setProperty('--case-media-y', '0px');
        slide.style.setProperty('--case-tilt-x', '0deg');
        slide.style.setProperty('--case-tilt-y', '0deg');
      });
    }

    // case-showcase-pointer: restrained parallax makes the active 3D scene feel alive
    // without competing with the case title or causing motion on touch devices.
    stage.addEventListener('pointermove', (event) => {
      if (reduceMotion || event.pointerType === 'touch' || window.innerWidth <= 720 || stage.classList.contains('is-dragging')) return;
      const activeSlide = slides[index];
      if (!activeSlide) return;
      const rect = activeSlide.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        resetCaseMotion();
        return;
      }
      const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      activeSlide.style.setProperty('--case-media-x', `${(nx * -9).toFixed(2)}px`);
      activeSlide.style.setProperty('--case-media-y', `${(ny * -6).toFixed(2)}px`);
      activeSlide.style.setProperty('--case-tilt-x', `${(ny * -1.05).toFixed(2)}deg`);
      activeSlide.style.setProperty('--case-tilt-y', `${(nx * 1.25).toFixed(2)}deg`);
    }, { passive: true });
    stage.addEventListener('pointerleave', resetCaseMotion, { passive: true });

    document.addEventListener('visibilitychange', scheduleAutoplay);
    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver((entries) => {
        isVisible = Boolean(entries[0]?.isIntersecting && entries[0]?.intersectionRatio > .12);
        if (!isVisible) resetCaseMotion();
        scheduleAutoplay();
      }, { threshold: [0, .12, .55] });
      visibilityObserver.observe(carousel);
    }
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(stage);
    } else {
      window.addEventListener('resize', updateLayout, { passive: true });
    }

    updateLayout();
    updateAutoplayControl();
    scheduleAutoplay();
  });
}

function initSliders() {
  $$('[data-slider]').forEach((slider) => {
    const viewport = $('.slider-viewport', slider);
    const trackEl = $('.slider-track', slider);
    const slides = $$('.project-card', slider);
    const prev = $('[data-slider-prev]', slider);
    const next = $('[data-slider-next]', slider);
    const dotsRoot = $('[data-slider-dots]', slider);
    if (!viewport || !trackEl || slides.length < 2) return;

    let index = 0;
    let visible = 3;
    const dots = slides.map((_, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Показать проект ${i + 1}`);
      button.addEventListener('click', () => { index = i; update(true); });
      dotsRoot?.append(button);
      return button;
    });

    function calculateVisible() {
      visible = window.innerWidth <= 720 ? 1 : window.innerWidth <= 1180 ? 2 : 3;
    }
    function update(trackEvent = false) {
      calculateVisible();
      const max = Math.max(0, slides.length - visible);
      index = Math.max(0, Math.min(index, max));
      const gap = 18;
      const slideWidth = (viewport.clientWidth - gap * (visible - 1)) / visible;
      trackEl.style.transform = `translateX(-${index * (slideWidth + gap)}px)`;
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
      prev?.toggleAttribute('disabled', index === 0);
      next?.toggleAttribute('disabled', index === max);
      if (trackEvent) track('slider_change', { index });
    }
    prev?.addEventListener('click', () => { index -= 1; update(true); });
    next?.addEventListener('click', () => { index += 1; update(true); });
    window.addEventListener('resize', update, { passive: true });
    update();
  });
}

function initBillingToggle() {
  const root = $('[data-billing-toggle]');
  if (!root) return;
  const section = root.closest('.work-models-section, .pricing-section');
  $$('button', root).forEach((button) => {
    button.addEventListener('click', () => {
      const period = button.dataset.period;
      if (!period) return;
      $$('button', root).forEach((node) => node.classList.toggle('is-active', node === button));
      section?.setAttribute('data-billing-period', period);
      $$('[data-plan-price]').forEach((node) => {
        const nextValue = node.dataset[period];
        if (!nextValue || node.textContent === nextValue) return;
        node.textContent = nextValue;
        if (!reduceMotion && typeof node.animate === 'function') {
          node.animate([
            { opacity: .25, transform: 'translateY(5px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      });
      $$('[data-plan-period-label]').forEach((node) => {
        node.textContent = node.dataset[period] || node.textContent;
      });
      track('pricing_period_change', { period });
    });
  });
}

function initFaq() {
  $$('.faq-item').forEach((item) => {
    const button = $('.faq-question', item);
    const answer = $('.faq-answer', item);
    button?.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      if (answer) answer.style.maxHeight = open ? `${answer.scrollHeight}px` : '0px';
      if (open) track('faq_open', { question: button.textContent.trim().slice(0, 120) });
    });
  });
}

function initCaseFilter() {
  const root = $('[data-case-filter]');
  if (!root) return;
  const cards = $$('[data-case-tags]');
  $$('button[data-filter]', root).forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter || 'all';
      $$('button[data-filter]', root).forEach((node) => node.classList.toggle('is-active', node === button));
      cards.forEach((card) => {
        const tags = String(card.dataset.caseTags || '').split('|').filter(Boolean);
        card.hidden = filter !== 'all' && !tags.includes(filter);
      });
      track('case_filter', { filter });
    });
  });
}

function focusableElements(root) {
  return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((element) => !element.hidden && element.offsetParent !== null);
}

function initModal() {
  const modal = $('[data-lead-modal]');
  const dialog = $('.modal-dialog', modal || document);
  const closeButtons = $$('[data-close-form]', modal || document);
  if (!modal || !dialog) return;

  function open(trigger) {
    state.lastFocused = document.activeElement;
    const form = $('[data-lead-form]', modal);
    const goal = trigger?.dataset.goal || 'audit';
    const plan = trigger?.dataset.plan || '';
    if (form) {
      form.elements.goal.value = goal;
      form.elements.startedAt.value = String(Date.now());
      if (plan && form.elements.comment && !form.elements.comment.value) form.elements.comment.value = `Интересует формат: ${plan}. `;
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-modal-open');
    requestAnimationFrame(() => $('input[name="name"]', modal)?.focus());
    track('form_open', { goal, cta: trigger?.dataset.cta || '', plan });
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-modal-open');
    state.lastFocused?.focus?.();
  }
  $$('[data-open-form]').forEach((button) => button.addEventListener('click', () => open(button)));
  closeButtons.forEach((button) => button.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (!modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const elements = focusableElements(dialog);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

function normalizeFormData(form) {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    email: String(data.get('email') || '').trim(),
    company: String(data.get('company') || '').trim(),
    role: String(data.get('role') || '').trim(),
    goal: String(data.get('goal') || 'audit'),
    monthlyTarget: '',
    comment: String(data.get('comment') || '').trim(),
    consent: data.get('consent') === 'on',
    website: String(data.get('website') || ''),
    startedAt: Number(data.get('startedAt')) || Date.now() - 5000,
    meta: {
      page: window.location.pathname,
      referrerHost: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return ''; } })() : '',
      viewport: viewportCategory(),
      variant: document.documentElement.dataset.theme || 'dark',
      sessionId: state.sessionId,
      utm: state.utm,
    },
  };
}

function clearErrors(form) {
  $$('[data-error]', form).forEach((node) => { node.textContent = ''; });
  $$('[aria-invalid="true"]', form).forEach((node) => node.removeAttribute('aria-invalid'));
}

function showErrors(form, errors = {}) {
  for (const [field, message] of Object.entries(errors)) {
    const error = $(`[data-error="${CSS.escape(field)}"]`, form);
    if (error) error.textContent = message;
    form.elements[field]?.setAttribute?.('aria-invalid', 'true');
  }
}

function initForms() {
  $$('[data-lead-form]').forEach((form) => {
    form.elements.startedAt.value = String(Date.now());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      const status = $('[data-form-status]', form);
      const submit = $('button[type="submit"]', form);
      const payload = normalizeFormData(form);
      status.textContent = 'Отправляем…';
      status.className = 'form-status';
      submit.disabled = true;
      try {
        if (staticPreview) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          status.textContent = 'Демо: форма работает через серверный запуск.';
          status.classList.add('is-success');
          return;
        }
        const response = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          showErrors(form, result.errors || {});
          throw new Error(result.message || 'Не удалось отправить заявку.');
        }
        status.textContent = `Заявка принята. Номер: ${result.leadId}`;
        status.classList.add('is-success');
        form.reset();
        form.elements.startedAt.value = String(Date.now());
        track('lead_success', { goal: payload.goal });
      } catch (error) {
        status.textContent = error.message || 'Ошибка отправки. Повторите попытку.';
        status.classList.add('is-error');
        track('lead_error', { goal: payload.goal });
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function initPublicConfig() {
  if (staticPreview) return;
  try {
    const response = await fetch('/api/public-config');
    if (!response.ok) return;
    const config = await response.json();
    $$('[data-public-phone]').forEach((node) => {
      if (!config.phone) return;
      node.textContent = config.phone;
      node.href = `tel:${config.phone.replace(/[^+\d]/g, '')}`;
    });
    $$('[data-public-email]').forEach((node) => {
      if (!config.email) return;
      node.textContent = config.email;
      node.href = `mailto:${config.email}`;
    });
    $$('[data-legal-summary]').forEach((node) => { node.textContent = config.legalSummary || ''; });
  } catch {
    // Public contact details remain placeholders until the server answers.
  }
}

function initAutoDealerHero() {
  const scene = $('[data-auto-hero-scene]');
  if (!scene) return;
  const section = scene.closest('[data-auto-hero-animation]');
  const car = $('[data-auto-hero-car]', scene);
  const badges = $$('.auto-hero-badge', scene);
  const canvas = $('[data-auto-hero-canvas]', scene);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionEnabled = section?.dataset.autoHeroAnimation !== 'false' && !reduced;
  let pointerFrame = 0;

  const applyParallax = (x, y) => {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      scene.style.setProperty('--hero-parallax-x', `${(x * 11).toFixed(1)}px`);
      scene.style.setProperty('--hero-parallax-y', `${(y * 8).toFixed(1)}px`);
      badges.forEach((badge, index) => {
        const depth = 4 + ((index % 3) * 2.5);
        badge.style.setProperty('--badge-parallax-x', `${(-x * depth).toFixed(1)}px`);
        badge.style.setProperty('--badge-parallax-y', `${(-y * depth * .72).toFixed(1)}px`);
      });
    });
  };

  if (motionEnabled) {
    scene.addEventListener('pointermove', (event) => {
      const rect = scene.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) - .5;
      const y = ((event.clientY - rect.top) / rect.height) - .5;
      applyParallax(x, y);
    });
    scene.addEventListener('pointerleave', () => applyParallax(0, 0));
  }

  if (!canvas || scene.dataset.dataScene === 'false') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const nodes = [];
  const pulses = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let visible = true;
  let last = performance.now();
  let seed = 393;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const resetNodes = () => {
    nodes.length = 0;
    const count = width < 560 ? 14 : 22;
    for (let i = 0; i < count; i += 1) {
      nodes.push({
        x: .12 + rand() * .82,
        y: .12 + rand() * .76,
        r: 1.2 + rand() * 1.8,
        phase: rand() * Math.PI * 2,
        speed: .000035 + rand() * .00005,
      });
    }
    pulses.length = 0;
    for (let i = 0; i < 5; i += 1) {
      pulses.push({ a: Math.floor(rand() * count), b: Math.floor(rand() * count), t: rand(), speed: .00007 + rand() * .00008 });
    }
  };

  const resize = () => {
    const rect = scene.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetNodes();
  };

  const point = (node, now) => ({
    x: node.x * width + Math.sin(now * node.speed + node.phase) * 6,
    y: node.y * height + Math.cos(now * node.speed * .8 + node.phase) * 4,
  });

  const draw = (now) => {
    ctx.clearRect(0, 0, width, height);
    const points = nodes.map((node) => point(node, now));
    const light = document.documentElement.dataset.theme === 'light';
    const lineRgb = light ? '92,101,211' : '87,128,255';
    const violetRgb = light ? '141,85,225' : '149,86,255';

    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > width * .22) continue;
        const alpha = Math.max(0, (1 - (dist / (width * .22))) * (light ? .11 : .16));
        ctx.strokeStyle = `rgba(${lineRgb},${alpha})`;
        ctx.lineWidth = .75;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
    nodes.forEach((node, index) => {
      const p = points[index];
      const glow = .55 + Math.sin(now * .0015 + node.phase) * .22;
      ctx.fillStyle = `rgba(${index % 3 === 0 ? violetRgb : lineRgb},${light ? .35 : glow})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      if (!light && index % 4 === 0) {
        ctx.strokeStyle = `rgba(${lineRgb},.12)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, node.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const delta = Math.min(40, now - last);
    pulses.forEach((pulse) => {
      if (motionEnabled) pulse.t = (pulse.t + pulse.speed * delta) % 1;
      const a = points[pulse.a % points.length];
      const b = points[pulse.b % points.length];
      if (!a || !b) return;
      const x = a.x + (b.x - a.x) * pulse.t;
      const y = a.y + (b.y - a.y) * pulse.t;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
      gradient.addColorStop(0, light ? 'rgba(118,74,235,.72)' : 'rgba(120,185,255,.92)');
      gradient.addColorStop(1, 'rgba(97,78,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    last = now;
  };

  const loop = (now) => {
    if (!visible) return;
    draw(now);
    if (motionEnabled) raf = requestAnimationFrame(loop);
  };

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    cancelAnimationFrame(raf);
    if (visible) {
      last = performance.now();
      if (motionEnabled) raf = requestAnimationFrame(loop);
      else draw(performance.now());
    }
  }, { rootMargin: '160px 0px' });

  resize();
  observer.observe(scene);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(scene);
  else window.addEventListener('resize', resize, { passive: true });
  if (!motionEnabled) draw(performance.now());
}

function initVideoFacades() {
  $$('[data-video-facade]').forEach((facade) => {
    const button = $('.auto-video-play', facade);
    const url = facade.dataset.videoUrl || '';
    if (!button || !url) return;
    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `${url}${url.includes('?') ? '&' : '?'}autoplay=1&rel=0`;
      iframe.title = 'Видеокейс VIONEX LEADS';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      facade.append(iframe);
      button.remove();
      track('video_view', { page: window.location.pathname, source: url.slice(0, 160) });
    }, { once: true });
  });
}

function initLinkTracking() {
  $$('[data-cta], .project-card, .capability-card, .service-card').forEach((element) => {
    element.addEventListener('click', () => {
      track('cta_click', { cta: element.dataset.cta || element.textContent.trim().slice(0, 80), href: element.getAttribute('href') || '' });
    });
  });
}

function init() {
  initTheme();
  initHeader();
  initReveal();
  initSectionTracking();
  initGlobe();
  initAutoDealerHero();
  initVideoFacades();
  initCaseCarousels();
  initSliders();
  initBillingToggle();
  initFaq();
  initCaseFilter();
  initModal();
  initForms();
  initPublicConfig();
  initLinkTracking();
  track('page_view', { title: document.title.slice(0, 120) });
}

init();
