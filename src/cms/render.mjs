function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function safeHref(value, fallback = '#') {
  const href = String(value || '').trim();
  if (!href) return fallback;
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return escapeHtml(href);
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return escapeHtml(url.toString());
  } catch {}
  return fallback;
}

function safeMedia(value) {
  const source = String(value || '').trim();
  if (source.startsWith('/assets/') || source.startsWith('/uploads/')) return escapeHtml(source);
  try {
    const url = new URL(source);
    if (url.protocol === 'https:') return escapeHtml(url.toString());
  } catch {}
  return '';
}

function renderText(value) {
  const lines = String(value || '').split(/\r?\n/);
  const output = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    output.push(`<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith('• ') || line.startsWith('- ')) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    output.push(`<p>${escapeHtml(line)}</p>`);
  }
  flushList();
  return output.join('');
}

function iconSvg(name) {
  const icons = {
    check: '<path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    crm: '<rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="15" r="2" fill="currentColor"/>',
    growth: '<path d="M4 17 9 12l3 3 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 2.8 8.1 7 10 4.2-1.9 7-5.5 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.7"/><path d="m9 12 2 2 4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    ai: '<path d="M8 3v3m8-3v3M8 18v3m8-3v3M3 8h3m12 0h3M3 16h3m12 0h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="6" y="6" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 12h5M12 9.5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    data: '<path d="M5 7.5C5 6.12 8.13 5 12 5s7 1.12 7 2.5S15.87 10 12 10 5 8.88 5 7.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M5 7.5v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-4M5 11.5v4C5 16.88 8.13 18 12 18s7-1.12 7-2.5v-4" stroke="currentColor" stroke-width="1.6"/>',
    market: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8S14.2 17.7 12 20c-2.2-2.3-3.2-5-3.2-8S9.8 6.3 12 4Z" stroke="currentColor" stroke-width="1.3"/>',
    person: '<circle cx="11" cy="9" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 19c.6-3.4 2.4-5.2 5.5-5.2s4.9 1.8 5.5 5.2M17 7.5h3m-1.5-1.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    chat: '<path d="M5 6h14v9H9l-4 3V6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    target: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="m14 10 5-5M16 5h3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="1.7"/><path d="m15 15 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    funnel: '<path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    chart: '<path d="M5 19V9m5 10V5m5 14v-7m4 7V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    send: '<path d="m4 5 16 7-16 7 3-7-3-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 12h13" stroke="currentColor" stroke-width="1.6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.target}</svg>`;
}

function crmLogoPath(name) {
  const key = String(name || '').toLowerCase().replace(/[^a-zа-я0-9]+/g, '');
  const map = {
    amocrm: '/assets/img/crm-logos/amocrm.svg',
    битрикс24: '/assets/img/crm-logos/bitrix24.svg',
    bitrix24: '/assets/img/crm-logos/bitrix24.svg',
    retailcrm: '/assets/img/crm-logos/retailcrm.svg',
    hubspot: '/assets/img/crm-logos/hubspot.svg',
    pipedrive: '/assets/img/crm-logos/pipedrive.svg',
    salesforce: '/assets/img/crm-logos/salesforce.svg',
    zohocrm: '/assets/img/crm-logos/zoho.svg',
    apiwebhooks: '/assets/img/crm-logos/api.svg',
    api: '/assets/img/crm-logos/api.svg',
  };
  return map[key] || '';
}

function messengerSvg(name) {
  const icons = {
    telegram: '<path d="M20.4 4.2 17.7 19c-.2 1-1 1.3-1.8.8l-4.1-3-2 1.9c-.2.2-.4.4-.8.4l.3-4.2 7.6-6.9c.3-.3-.1-.5-.5-.2L7 13.7l-4-1.3c-.9-.3-.9-.9.2-1.3l15.7-6.1c.7-.3 1.4.2 1.1 1.2Z" fill="currentColor"/>',
    whatsapp: '<path d="M12 3a8.5 8.5 0 0 0-7.4 12.7L3.4 20l4.4-1.2A8.5 8.5 0 1 0 12 3Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 8.3c.2-.4.5-.4.8-.4h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.8l-.6.7c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.8-1c.2-.3.5-.3.8-.2l1.8.9c.3.1.4.3.4.6 0 .5-.2 1.4-.8 2-.6.6-1.6.9-2.6.6-1.1-.3-3.3-1.2-5.2-3.1-1.5-1.5-2.5-3.4-2.8-4.5-.3-1 .1-2 .6-2.5.3-.3.7-.5 1-.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.email}</svg>`;
}

function renderHeader(settings, siteName) {
  const nav = Array.isArray(settings?.navigation) ? settings.navigation : [];
  const headerButton = settings?.headerButton || { label: 'Обсудить проект', goal: 'audit' };
  return `<header class="site-header" data-header>
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="${escapeHtml(siteName)} — главная">
        <img src="/assets/img/logo.svg" width="36" height="36" alt="">
        <span class="brand-name">${escapeHtml(settings?.brandName || 'VIONEX')} <b>${escapeHtml(settings?.brandAccent || 'LEADS')}</b></span>
      </a>
      <nav class="desktop-nav" aria-label="Основная навигация">${nav.map((item) => `<a href="${safeHref(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</nav>
      <div class="header-actions">
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Переключить цветовую тему" aria-pressed="false"><span>☀</span><span>☾</span></button>
        <button class="button button-small button-primary header-cta" type="button" data-open-form data-goal="${escapeHtml(headerButton.goal || 'audit')}" data-cta="header">${escapeHtml(headerButton.label || 'Обсудить проект')} <span aria-hidden="true">↗</span></button>
      </div>
      <button class="menu-toggle" type="button" aria-label="Открыть меню" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </div>
    <nav class="mobile-nav" data-mobile-nav aria-label="Мобильная навигация">
      ${nav.map((item) => `<a href="${safeHref(item.href)}">${escapeHtml(item.label)}</a>`).join('')}
      <button class="button button-primary button-full" type="button" data-open-form data-goal="${escapeHtml(headerButton.goal || 'audit')}" data-cta="mobile_menu">${escapeHtml(headerButton.label || 'Обсудить проект')}</button>
    </nav>
  </header>`;
}

function renderFooter(settings, publicConfig) {
  const columns = Array.isArray(settings?.footerColumns) ? settings.footerColumns : [];
  return `<footer class="site-footer" id="footer-contact"><div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><a class="brand" href="/"><img src="/assets/img/logo.svg" width="36" height="36" alt=""><span class="brand-name">${escapeHtml(settings?.brandName || 'VIONEX')} <b>${escapeHtml(settings?.brandAccent || 'LEADS')}</b></span></a><p>${escapeHtml(settings?.footerDescription || '')}</p></div>
      ${columns.map((column) => `<div class="footer-column"><strong>${escapeHtml(column.title)}</strong>${(column.links || []).map((link) => `<a href="${safeHref(link.href)}">${escapeHtml(link.label)}</a>`).join('')}</div>`).join('')}
      <div class="footer-contact"><strong>Связаться</strong><p><a data-public-phone href="${publicConfig.phone ? `tel:${escapeHtml(publicConfig.phone.replace(/[^+\d]/g, ''))}` : '#'}">${escapeHtml(publicConfig.phone || 'Телефон будет указан после настройки')}</a></p><p><a data-public-email href="${publicConfig.email ? `mailto:${escapeHtml(publicConfig.email)}` : '#'}">${escapeHtml(publicConfig.email || 'Email будет указан после настройки')}</a></p><p data-legal-summary>${escapeHtml([publicConfig.companyLegalName, publicConfig.companyTaxId].filter(Boolean).join(' · '))}</p></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(publicConfig.siteName)}. Информация на сайте не является публичной офертой.</span><div class="footer-bottom-links"><a href="/privacy">Политика обработки данных</a><a href="/sitemap.xml">Карта сайта</a></div></div>
  </div></footer>`;
}

function renderModal(publicConfig, context = {}) {
  const isAutoDealers = context.route === '/services/auto-dealers';
  const modalTitle = isAutoDealers ? 'Обсудить лидогенерацию для дилерского центра' : 'Обсудить задачу';
  const modalLead = isAutoDealers ? 'Расскажите о дилерском центре, направлениях продаж и текущей CRM. Подготовим безопасный план пилотного запуска.' : 'Опишите продукт и цель. Мы оценим задачу и предложим безопасный следующий шаг.';
  const companyLabel = isAutoDealers ? 'Компания / дилерский центр' : 'Компания';
  const companyPlaceholder = isAutoDealers ? 'Название дилерского центра или сети' : 'Название компании';
  const commentLabel = isAutoDealers ? 'Что нужно улучшить' : 'Что нужно получить';
  const commentPlaceholder = isAutoDealers ? 'Новые авто, пробег, трейд-ин, сервис, география, CRM и текущий поток заявок' : 'Продукт, география, средний чек, текущий способ получения клиентов';
  const demoClass = publicConfig.mode === 'production' ? 'is-hidden' : '';
  return `<div class="modal" data-lead-modal role="dialog" aria-modal="true" aria-labelledby="lead-modal-title" aria-hidden="true">
    <div class="modal-backdrop" data-close-form></div>
    <div class="modal-dialog" tabindex="-1">
      <button class="modal-close" type="button" data-close-form aria-label="Закрыть форму">×</button>
      <h2 id="lead-modal-title">${escapeHtml(modalTitle)}</h2>
      <p>${escapeHtml(modalLead)}</p>
      <div class="demo-warning ${demoClass}">Демо-режим: заявка сохраняется локально на сервере. Настройте webhook или Telegram в файле <code>.env</code>.</div>
      <form class="lead-form" data-lead-form novalidate>
        <input type="hidden" name="goal" value="audit"><input type="hidden" name="startedAt" value="">
        <div class="honeypot" aria-hidden="true"><label>Сайт<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-field"><label for="lead-name">Имя *</label><input id="lead-name" name="name" autocomplete="name" required placeholder="Как к вам обращаться"><span class="field-error" data-error="name"></span></div>
        <div class="form-field"><label for="lead-phone">Телефон *</label><input id="lead-phone" name="phone" type="tel" autocomplete="tel" required placeholder="+7 999 000-00-00"><span class="field-error" data-error="phone"></span></div>
        <div class="form-field"><label for="lead-company">${escapeHtml(companyLabel)}</label><input id="lead-company" name="company" autocomplete="organization" placeholder="${escapeHtml(companyPlaceholder)}"></div>
        <div class="form-field"><label for="lead-email">Рабочий email</label><input id="lead-email" name="email" type="email" autocomplete="email" placeholder="name@company.ru"><span class="field-error" data-error="email"></span></div>
        <div class="form-field full"><label for="lead-role">Ваша роль</label><select id="lead-role" name="role"><option value="">Выберите</option><option>Собственник</option><option>Генеральный директор</option><option>Коммерческий директор</option><option>Руководитель продаж</option><option>Маркетолог</option><option>Другое</option></select></div>
        <div class="form-field full"><label for="lead-comment">${escapeHtml(commentLabel)}</label><textarea id="lead-comment" name="comment" placeholder="${escapeHtml(commentPlaceholder)}"></textarea></div>
        <label class="consent"><input type="checkbox" name="consent" required><span>Согласен на обработку персональных данных по <a class="text-link" href="/privacy" target="_blank" rel="noopener">политике конфиденциальности</a>.</span></label><span class="field-error" data-error="consent"></span>
        <div class="form-actions"><button class="button button-primary" type="submit">Отправить заявку <span aria-hidden="true">↗</span></button><span class="form-status" data-form-status aria-live="polite"></span></div>
      </form>
    </div>
  </div><div class="mobile-cta" data-mobile-cta><button class="button button-primary" type="button" data-open-form data-goal="audit" data-cta="mobile_sticky">Обсудить проект</button></div>`;
}

function renderHero(block, context = {}) {
  const d = block.data;
  const headingTag = context.headingTag === 'h1' ? 'h1' : 'h2';
  const assurances = (d.assurances || []).map((item) => `<li><span class="assurance-icon">${iconSvg(item.icon)}</span><span>${escapeHtml(item.text)}</span></li>`).join('');
  const callouts = (d.callouts || []).map((item) => `<div class="globe-label globe-label--${escapeHtml(item.position)}"><span class="globe-label-icon">${iconSvg(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.text)}</span></div>`).join('');
  const flow = (d.flow || []).map((item) => `<div class="hero-flow-step"><span class="hero-flow-icon">${iconSvg(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></span></div>`).join('');
  return `<section class="hero-premium" id="top" data-cms-block="${escapeHtml(block.id)}" data-globe-animation="${d.animation === false ? 'false' : 'true'}">
    <div class="hero-aurora" aria-hidden="true"></div><div class="hero-inner"><div class="hero-main">
      <div class="hero-copy-premium reveal"><span class="eyebrow">${escapeHtml(d.eyebrow)}</span><${headingTag}><span class="hero-title-line">${escapeHtml(d.titleLine1)}</span><em class="hero-title-line">${escapeHtml(d.titleLine2)}</em></${headingTag}><p class="hero-lead">${escapeHtml(d.lead)}</p>
        <div class="hero-actions"><button class="button button-primary" type="button" data-open-form data-goal="${escapeHtml(d.primaryGoal || 'warm_leads')}" data-cta="hero_primary">${escapeHtml(d.primaryLabel || 'Получить лиды')} <span aria-hidden="true">↗</span></button><a class="button button-ghost" href="${safeHref(d.secondaryHref, '/cases')}">${escapeHtml(d.secondaryLabel || 'Смотреть кейсы')} <span aria-hidden="true">→</span></a></div>
        <ul class="hero-assurances" aria-label="Преимущества подхода">${assurances}</ul>
      </div>
      <div class="hero-visual-premium reveal" data-hero-visual aria-label="Динамическая модель поиска, квалификации и передачи лидов"><div class="globe-fallback" aria-hidden="true"></div><canvas class="premium-globe-canvas" data-premium-globe aria-hidden="true"></canvas>${callouts}<div class="globe-live-badge"><i aria-hidden="true"></i> ${escapeHtml(d.liveBadge || '')}</div></div>
    </div><div class="hero-flow-premium reveal" aria-label="Путь клиента от рынка до CRM">${flow}</div></div>
  </section>`;
}

function renderAutoDealersHero(block, context = {}) {
  const d = block.data;
  const headingTag = context.headingTag === 'h1' ? 'h1' : 'h2';
  const image = safeMedia(d.image);
  const n = (value, fallback, min, max) => { const numeric = Number(value); return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback)); };
  const carX = n(d.carX, 2, -25, 25);
  const carY = n(d.carY, 4, -25, 25);
  const carScale = n(d.carScale, 104, 70, 145);
  const sceneHeight = n(d.sceneHeight, 520, 380, 680);
  const advantageItems = (d.badges || []).slice(0, 3);
  const advantages = advantageItems.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></li>`).join('');
  const badges = (d.badges || []).slice(3, 6).map((item, index) => {
    const x = n(item.x, index % 2 === 0 ? 16 : 82, 0, 100);
    const y = n(item.y, index < 2 ? 18 : 78, 0, 100);
    const width = n(item.width, 176, 120, 320);
    const iconSize = n(item.iconSize, 36, 24, 72);
    const accent = ['violet', 'blue', 'green'].includes(item.accent) ? item.accent : 'violet';
    const visualType = item.visualType === 'chart' ? 'chart' : 'standard';
    const graphic = safeMedia(item.graphic);
    const visual = graphic
      ? `<img class="auto-hero-badge-media" src="${graphic}" alt="" loading="eager">`
      : iconSvg(item.icon || 'growth');
    const sparkline = visualType === 'chart'
      ? `<svg class="auto-hero-sparkline" viewBox="0 0 88 30" fill="none" aria-hidden="true"><path d="M2 26L16 24L28 22L40 24L52 18L63 19L74 11L86 4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 29H86" stroke="currentColor" stroke-opacity=".16"/><path d="M2 26L16 24L28 22L40 24L52 18L63 19L74 11L86 4V30H2Z" fill="currentColor" fill-opacity=".08"/></svg>`
      : '';
    return `<div class="auto-hero-badge auto-hero-badge--${index + 1} auto-hero-badge--${accent} auto-hero-badge--${visualType}" style="--badge-x:${x};--badge-y:${y};--badge-width:${width}px;--badge-icon:${iconSize}px"><span>${visual}</span><div class="auto-hero-badge-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small>${sparkline}</div></div>`;
  }).join('');
  return `<section class="auto-hero auto-hero-v393 auto-hero-v310" id="top" data-cms-block="${escapeHtml(block.id)}" data-auto-hero-animation="${d.animation === false ? 'false' : 'true'}">
    <div class="auto-hero-ambient" aria-hidden="true"></div><div class="container auto-hero-inner"><div class="auto-hero-grid">
      <div class="auto-hero-copy reveal"><span class="eyebrow">${escapeHtml(d.kicker)}</span><${headingTag}><span>${escapeHtml(d.titleLine1)}</span><em>${escapeHtml(d.titleLine2)}</em></${headingTag}><p>${escapeHtml(d.lead)}</p>${advantages ? `<ul class="auto-hero-advantages" aria-label="Ключевые результаты">${advantages}</ul>` : ''}<div class="hero-actions"><button class="button button-primary" type="button" data-open-form data-goal="${escapeHtml(d.primaryGoal || 'warm_leads')}" data-cta="auto_hero_primary">${escapeHtml(d.primaryLabel || 'Получить план')} <span aria-hidden="true">↗</span></button>${d.secondaryLabel ? `<a class="button button-ghost" href="${safeHref(d.secondaryHref || '/cases')}">${escapeHtml(d.secondaryLabel)} <span aria-hidden="true">→</span></a>` : ''}</div></div>
      <div class="auto-hero-visual reveal" aria-label="Автомобильный спрос, аналитика и передача заявок в CRM"><div class="auto-hero-scene" data-auto-hero-scene data-data-scene="${d.dataScene === false ? 'false' : 'true'}" style="--car-x:${carX};--car-y:${carY};--car-scale:${carScale};--scene-height:${sceneHeight}px"><canvas class="auto-hero-data-canvas" data-auto-hero-canvas aria-hidden="true"></canvas><span class="auto-hero-city" aria-hidden="true"></span><span class="auto-hero-orbit auto-hero-orbit--a" aria-hidden="true"></span><span class="auto-hero-orbit auto-hero-orbit--b" aria-hidden="true"></span><span class="auto-hero-orbit auto-hero-orbit--c" aria-hidden="true"></span><span class="auto-hero-floor" aria-hidden="true"></span>${image ? `<img class="auto-hero-car" data-auto-hero-car src="${image}" alt="${escapeHtml(d.imageAlt || '')}" width="1134" height="600" fetchpriority="high">` : ''}<span class="auto-hero-headlight auto-hero-headlight--left" aria-hidden="true"></span><span class="auto-hero-headlight auto-hero-headlight--right" aria-hidden="true"></span>${badges}</div></div>
    </div></div>
  </section>`;
}

function renderAutoProof(block) {
  const d = block.data;
  const icons = ['person', 'clock', 'growth', 'data'];
  return `<section class="section section-compact auto-proof-section auto-proof-v39" id="auto-proof" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="auto-metrics auto-metrics-v39 reveal">${(d.metrics || []).slice(0, 4).map((item, index) => `<article class="auto-metric"><span class="auto-metric-icon">${iconSvg(item.icon || icons[index] || 'growth')}</span><div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div></article>`).join('')}</div>${d.note ? `<p class="auto-proof-note">${escapeHtml(d.note)}</p>` : ''}</div></section>`;
}

function videoEmbedUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
    if (url.hostname.endsWith('youtube.com')) {
      const id = url.searchParams.get('v');
      if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
      if (url.pathname.startsWith('/embed/')) return `https://www.youtube-nocookie.com${url.pathname}`;
    }
    if (url.hostname === 'vimeo.com') return `https://player.vimeo.com/video/${encodeURIComponent(url.pathname.slice(1))}`;
    if (url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/')) return `https://player.vimeo.com${url.pathname}`;
  } catch {}
  return '';
}

function renderAutoCaseVideo(block) {
  const d = block.data;
  const loopItems = (d.loopItems || []).slice(0, 6);
  const cases = (d.cases || []).slice(0, 3);
  return `<section class="section auto-case-video-section auto-overview-v39" id="auto-key-case" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="auto-overview-grid">
    <article class="dealer-loop-card section-card reveal"><div class="dealer-overview-heading"><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.segment)}</p></div><div class="dealer-loop" aria-label="Единый контур заявки"><span class="dealer-loop-ring" aria-hidden="true"></span><div class="dealer-loop-center"><span>${iconSvg('ai')}</span><strong>AI-контур</strong><small>заявки</small></div>${loopItems.map((item, index) => `<div class="dealer-loop-node dealer-loop-node--${index + 1}"><span>${iconSvg(item.icon || 'target')}</span><small>${escapeHtml(item.title)}</small></div>`).join('')}</div><button class="button button-ghost dealer-loop-button" type="button" data-open-form data-goal="warm_leads">Как это работает <span aria-hidden="true">→</span></button></article>
    <article class="dealer-cases-card section-card reveal"><div class="dealer-cases-heading"><div><span class="section-kicker">Кейсы</span><h2>${escapeHtml(d.casesTitle || 'Проекты и сценарии для дилерских центров')}</h2></div><a class="text-link" href="${safeHref(d.buttonHref || '/cases')}">Все кейсы →</a></div><div class="dealer-case-grid">${cases.map((item, index) => { const image = safeMedia(item.image); return `<a class="dealer-case-card ${index === 1 ? 'is-active' : ''}" href="${safeHref(item.href || '/cases')}">${image ? `<img src="${image}" alt="${escapeHtml(item.imageAlt || item.title)}" loading="lazy" width="640" height="420">` : ''}<span class="dealer-case-shade" aria-hidden="true"></span><div class="dealer-case-copy"><small>${escapeHtml(item.kicker || 'Кейс')}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><strong>${escapeHtml(item.metric)}</strong></div></a>`; }).join('')}</div><div class="dealer-case-dots" aria-hidden="true"><i></i><i class="is-active"></i><i></i></div></article>
  </div></div></section>`;
}

function renderHumanControl(block) {
  const d = block.data;
  return `<section class="section human-control-section" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="section-heading reveal"><div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div><div class="human-control-grid reveal">${(d.items || []).map((item) => `<article><span>${iconSvg(item.icon || 'shield')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('')}</div></div></section>`;
}

function renderCapabilities(block, context = {}) {
  const d = block.data;
  const isHomepageShowcase = block.variant === 'homepage-showcase' || context.route === '/';
  const premiumIcons = new Set(['target', 'search', 'chat', 'funnel', 'crm', 'chart']);
  const cards = (d.items || []).map((item) => {
    const iconName = String(item.icon || 'target');
    const iconMarkup = isHomepageShowcase && premiumIcons.has(iconName)
      ? `<img src="/assets/img/capabilities/${escapeHtml(iconName)}.svg" alt="" width="120" height="96" loading="eager">`
      : iconSvg(iconName);
    return `<a class="capability-card" data-capability-icon="${escapeHtml(iconName)}" href="${safeHref(item.href, '#')}" aria-label="${escapeHtml(item.title)}"><span class="number">${escapeHtml(item.number)}</span><span class="card-arrow" aria-hidden="true">↗</span><span class="capability-icon">${iconMarkup}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></a>`;
  }).join('');

  if (isHomepageShowcase) {
    const legacyHeading = d.title === 'Создаём систему, которая' && d.accent === 'двигает бизнес вперёд';
    const heading = legacyHeading ? (d.kicker || 'Наши возможности') : [d.title, d.accent].filter(Boolean).join(' ');
    return `<section class="section capabilities-showcase" id="capabilities" data-cms-block="${escapeHtml(block.id)}"><div class="container section-card cms-capabilities-panel"><div class="capabilities-showcase-heading reveal"><h2>${escapeHtml(heading || 'Наши возможности')}</h2><p>${escapeHtml(d.intro)}</p></div><div class="capability-grid reveal">${cards}</div></div></section>`;
  }

  return `<section class="section" id="capabilities" data-cms-block="${escapeHtml(block.id)}"><div class="container section-card cms-capabilities-panel"><div class="section-heading reveal"><div>${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<h2>${escapeHtml(d.title)}${d.accent ? ` <span>${escapeHtml(d.accent)}</span>` : ''}</h2></div><p>${escapeHtml(d.intro)}</p></div><div class="capability-grid reveal">${cards}</div></div></section>`;
}

function itemRoute(item) {
  const prefix = item.kind === 'service' ? '/services/' : item.kind === 'case' ? '/cases/' : '/blog/';
  return `${prefix}${item.slug}`;
}

function renderCollectionCard(item, variant = 'grid') {
  const image = safeMedia(item.cover);
  const route = itemRoute(item);
  const tag = item.kind === 'service' ? 'Услуга' : item.kind === 'case' ? 'Кейс' : 'Статья';
  return `<article class="cms-collection-card ${variant === 'slider' ? 'project-card' : ''}" data-kind="${escapeHtml(item.kind)}" data-case-tags="${escapeHtml((item.tags || []).join('|'))}">
    <a href="${route}" class="cms-card-link" aria-label="${escapeHtml(item.title)}"></a>
    <div class="cms-card-image">${image ? `<img src="${image}" alt="${escapeHtml(item.title)}" loading="lazy">` : '<div class="cms-card-placeholder"></div>'}</div>
    <div class="cms-card-content"><div class="project-tags"><span class="tag">${tag}</span>${(item.tags || []).slice(0, 2).map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p><span class="project-link">Подробнее <span aria-hidden="true">→</span></span></div>
  </article>`;
}

function caseShowcaseMetrics(item) {
  const document = item?.published || item?.draft || {};
  const statsBlock = Array.isArray(document.blocks)
    ? document.blocks.find((block) => block?.enabled !== false && block?.type === 'stats')
    : null;
  const metrics = Array.isArray(statsBlock?.data?.items)
    ? statsBlock.data.items
      .filter((metric) => metric && (metric.value || metric.label))
      .slice(0, 3)
      .map((metric) => ({ value: String(metric.value || '—'), label: String(metric.label || '') }))
    : [];
  if (metrics.length >= 3) return metrics;
  const fallbacks = [
    { value: 'ICP', label: 'сегментация аудитории' },
    { value: 'CRM', label: 'единый контур передачи' },
    { value: 'QA', label: 'контроль качества' },
  ];
  return [...metrics, ...fallbacks.slice(metrics.length)].slice(0, 3);
}

const defaultCaseShowcaseVisuals = {
  'auto-new-cars': { src: '/assets/img/cases3d/dealer-new.webp', tone: 'violet', visual: 'auto-new' },
  'auto-used-cars': { src: '/assets/img/cases3d/dealer-new-used.webp', tone: 'electric', visual: 'auto-used' },
  'auto-commercial-vehicles': { src: '/assets/img/cases3d/logistics.webp', tone: 'cyan', visual: 'auto-commercial' },
  'auto-motorcycles': { src: '/assets/img/cases3d/dealer-new.webp', tone: 'magenta', visual: 'auto-moto' },
  'auto-service': { src: '/assets/img/cases3d/industrial-equipment.webp', tone: 'violet', visual: 'auto-service' },
  'equipment-leasing': { src: '/assets/img/cases3d/equipment-leasing.webp', tone: 'emerald', visual: 'leasing' },
  'industrial-equipment': { src: '/assets/img/cases3d/industrial-equipment.webp', tone: 'electric', visual: 'industrial' },
  'fintech-platform': { src: '/assets/img/cases3d/fintech.webp', tone: 'emerald', visual: 'fintech' },
  'cloud-infrastructure': { src: '/assets/img/cases3d/cloud-infrastructure.webp', tone: 'magenta', visual: 'cloud' },
  'logistics-company': { src: '/assets/img/cases3d/logistics.webp', tone: 'cyan', visual: 'logistics' },
  'modular-buildings': { src: '/assets/img/cases3d/modular-buildings.webp', tone: 'violet', visual: 'building' },
};

function caseBusinessLabel(tags) {
  const normalized = (tags || []).map((tag) => String(tag || '').trim()).filter(Boolean);
  const market = normalized.find((tag) => /^B2[BC]$/i.test(tag)) || 'B2B';
  const sector = normalized.find((tag) => !/сценар/i.test(tag) && !/^B2[BC]$/i.test(tag)) || 'Лидогенерация';
  return `${market.toUpperCase()} · ${sector}`;
}

function metricHudLabel(metric, fallback) {
  const label = String(metric?.label || fallback || '').trim();
  if (!label) return fallback;
  return label.split(/[,:—–-]/)[0].trim().slice(0, 24) || fallback;
}

function renderCaseShowcaseCard(item, index, startIndex = 0) {
  const route = itemRoute(item);
  const builtInVisual = defaultCaseShowcaseVisuals[item.slug] || null;
  // Built-in examples start with art-directed 3D scenes. A cover selected later in the
  // media library overrides the bundled visual, so every case remains editable in CMS.
  const defaultImage = builtInVisual?.src || '';
  const selectedImage = item.cover && item.cover !== defaultImage ? item.cover : (defaultImage || item.cover);
  const image = safeMedia(selectedImage);
  const metrics = caseShowcaseMetrics(item);
  const tones = ['violet', 'electric', 'emerald', 'cyan', 'magenta', 'amber'];
  const tone = builtInVisual?.tone || tones[index % tones.length];
  const visual = builtInVisual?.visual || 'custom';
  const tags = (item.tags || []).filter(Boolean);
  const scenarioLabel = tags.some((tag) => /сценар/i.test(String(tag))) ? 'Типовой сценарий' : 'Проект VIONEX';
  const businessLabel = caseBusinessLabel(tags);
  const loading = Math.abs(index - startIndex) <= 1 ? 'eager' : 'lazy';
  const fetchPriority = index === startIndex ? ' fetchpriority="high"' : '';
  const hudMetrics = metrics.slice(0, 2);
  return `<article class="case-showcase-card ${index === startIndex ? 'is-active' : ''}" data-case-slide data-case-index="${index}" data-case-tone="${tone}" data-case-visual="${escapeHtml(visual)}" aria-label="${escapeHtml(item.title)}">
    <a class="case-showcase-card-link" href="${route}" aria-label="Открыть кейс: ${escapeHtml(item.title)}"></a>
    <span class="case-showcase-depth case-showcase-depth--one" aria-hidden="true"></span><span class="case-showcase-depth case-showcase-depth--two" aria-hidden="true"></span>
    <div class="case-showcase-ambient" aria-hidden="true"></div>
    <div class="case-showcase-media" aria-hidden="true">
      ${image ? `<img src="${image}" alt="" loading="${loading}"${fetchPriority}>` : '<div class="cms-card-placeholder"></div>'}
      <span class="case-showcase-media-glow"></span><span class="case-showcase-orbit case-showcase-orbit--one"></span><span class="case-showcase-orbit case-showcase-orbit--two"></span>
      <span class="case-showcase-grid"></span><span class="case-showcase-scan"></span><span class="case-showcase-sheen"></span>
      <div class="case-showcase-hud">
        ${hudMetrics.map((metric, hudIndex) => `<span class="case-showcase-hud-stat"><small>${escapeHtml(metricHudLabel(metric, hudIndex === 0 ? 'Контур' : 'Качество'))}</small><strong>${escapeHtml(metric.value)}</strong></span>`).join('')}
        <span class="case-showcase-hud-chart"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </div>
    </div>
    <div class="case-showcase-topline"><div class="case-showcase-tags"><span>${escapeHtml(businessLabel)}</span></div><span class="case-showcase-number">${String(index + 1).padStart(2, '0')}</span></div>
    <div class="case-showcase-copy"><span class="case-showcase-kicker">${escapeHtml(scenarioLabel)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p>
      <div class="case-showcase-metrics">${metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong><small>${escapeHtml(metric.label)}</small></span>`).join('')}</div>
      <span class="case-showcase-cta">Смотреть кейс <i aria-hidden="true">↗</i></span>
    </div>
  </article>`;
}

function renderCollectionList(block, context) {
  const d = block.data;
  const items = context.getPublishedContent(d.kind, d.limit || 12);
  const filters = d.showFilters ? `<div class="case-filter reveal" data-case-filter><button type="button" class="is-active" data-filter="all">Все</button>${[...new Set(items.flatMap((item) => item.tags || []))].slice(0, 8).map((tag) => `<button type="button" data-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>` : '';
  return `<section class="section" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="section-heading reveal"><div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div>${filters}<div class="cms-collection-grid reveal">${items.length ? items.map((item) => renderCollectionCard(item)).join('') : '<div class="cms-empty">Пока нет опубликованных материалов.</div>'}</div></div></section>`;
}

function renderCasesSlider(block, context) {
  const d = block.data;
  let items = context.getPublishedContent('case', Math.max(24, d.limit || 6));
  const filterTag = String(d.filterTag || '').trim().toLowerCase();
  if (filterTag) items = items.filter((item) => (item.tags || []).some((tag) => String(tag || '').trim().toLowerCase().includes(filterTag)));
  items = items.slice(0, d.limit || 6);
  const autoplay = d.autoplay !== false;
  const autoplayDelay = Math.max(3500, Math.min(15000, Number(d.autoplayDelay) || 6500));
  const preferredStart = items.findIndex((item) => item.slug === 'auto-used-cars');
  const startIndex = preferredStart >= 0 ? preferredStart : 0;
  const heading = [d.title, d.accent].filter(Boolean).join(' ');
  if (!items.length) return `<section class="section cases-showcase-section" id="${context.route === '/services/auto-dealers' ? 'auto-cases' : 'cases'}" data-cms-block="${escapeHtml(block.id)}"><div class="container cases-showcase-shell"><div class="cms-empty">Пока нет опубликованных кейсов.</div></div></section>`;
  return `<section class="section cases-showcase-section" id="${context.route === '/services/auto-dealers' ? 'auto-cases' : 'cases'}" data-cms-block="${escapeHtml(block.id)}"><div class="container cases-showcase-shell">
    <div class="cases-showcase-heading reveal"><div>${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<h2>${escapeHtml(heading || 'Реализованные проекты')}</h2></div><div class="cases-showcase-heading-aside">${d.intro ? `<p>${escapeHtml(d.intro)}</p>` : ''}<a class="cases-showcase-all" href="${safeHref(d.allHref || '/cases')}">${escapeHtml(d.allLabel || 'Смотреть все проекты')} <span aria-hidden="true">↗</span></a></div></div>
    <div class="cases-carousel reveal" data-case-carousel data-autoplay="${autoplay ? 'true' : 'false'}" data-autoplay-delay="${autoplayDelay}" data-start-index="${startIndex}" role="region" aria-roledescription="carousel" aria-label="Реализованные проекты">
      <div class="cases-carousel-stage" data-case-stage>${items.map((item, index) => renderCaseShowcaseCard(item, index, startIndex)).join('')}</div>
      <button class="cases-carousel-arrow cases-carousel-prev" type="button" data-case-prev aria-label="Предыдущий кейс"><span aria-hidden="true">←</span></button>
      <button class="cases-carousel-arrow cases-carousel-next" type="button" data-case-next aria-label="Следующий кейс"><span aria-hidden="true">→</span></button>
      <div class="cases-carousel-footer"><div class="cases-carousel-dots" data-case-dots aria-label="Выбор кейса"></div><div class="cases-carousel-meta"><span class="cases-carousel-status" data-case-status aria-live="polite">${startIndex + 1} / ${items.length}</span><button class="cases-autoplay-toggle" type="button" data-case-autoplay-toggle aria-pressed="${autoplay ? 'true' : 'false'}" aria-label="Остановить автоматическое переключение"><span aria-hidden="true">${autoplay ? 'Ⅱ' : '▶'}</span></button></div></div>
    </div>
  </div></section>`;
}

function pricingFeatureValue(feature, index) {
  const keys = ['start', 'growth', 'scale'];
  const key = keys[index] || keys[keys.length - 1];
  return String(feature?.[key] || '—');
}

function pricingFeatureTone(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['✓', 'включено', 'да'].includes(normalized)) return 'is-included';
  if (['—', '-', 'нет'].includes(normalized)) return 'is-empty';
  return 'is-detail';
}

function renderPricing(block) {
  const d = block.data;
  const plans = (d.plans || []).slice(0, 3);
  const features = d.features || [];
  const planKeys = ['start', 'growth', 'scale'];
  const valueForPlan = (feature, index) => String(feature?.[planKeys[index]] || '—').trim() || '—';
  const valueClass = (value) => value === '✓' ? 'is-included' : value === '—' ? 'is-empty' : 'is-detail';
  const quickFeatures = features.slice(0, 4);

  return `<section class="section work-models-section" id="pricing" data-cms-block="${escapeHtml(block.id)}">
    <div class="container work-models-panel">
      <div class="work-models-heading reveal">
        <div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2></div>
        <div class="work-models-heading-aside"><p>${escapeHtml(d.intro)}</p><div class="billing-toggle work-models-toggle" data-billing-toggle><button type="button" class="is-active" data-period="monthly">${escapeHtml(d.periodMonthly)}</button><button type="button" data-period="quarterly">${escapeHtml(d.periodQuarterly)}</button></div></div>
      </div>
      <div class="work-models-grid reveal">
        ${plans.map((plan, index) => `<article class="work-plan-card ${plan.popular ? 'is-popular' : ''}" data-pricing-plan="${index + 1}">
          ${plan.popular ? '<span class="work-plan-badge">Оптимальный</span>' : ''}
          <div class="work-plan-top"><span class="work-plan-index">0${index + 1}</span><span class="work-plan-name">${escapeHtml(plan.name)}</span></div>
          <p class="work-plan-caption">${escapeHtml(plan.caption)}</p>
          <div class="work-plan-price" data-plan-price data-monthly="${escapeHtml(plan.monthly)}" data-quarterly="${escapeHtml(plan.quarterly)}">${escapeHtml(plan.monthly)}</div>
          <small class="work-plan-period" data-plan-period-label data-monthly="Оплата ежемесячно" data-quarterly="Оплата за квартал">Оплата ежемесячно</small>
          <button class="button ${plan.popular ? 'button-primary' : 'button-ghost'} button-full" type="button" data-open-form data-plan="${escapeHtml(plan.name)}" data-goal="pricing_${index + 1}">${escapeHtml(plan.button || 'Выбрать формат')}</button>
          <div class="work-plan-divider" aria-hidden="true"></div><span class="work-plan-included-title">В формате</span>
          <ul class="work-plan-inclusions">${quickFeatures.map((feature) => { const value = valueForPlan(feature, index); return `<li><span class="work-plan-check ${value === '✓' ? 'is-included' : ''}">${value === '✓' ? '✓' : '•'}</span><div><strong>${escapeHtml(feature.label)}</strong><small>${escapeHtml(value === '✓' ? 'Включено' : value)}</small></div></li>`; }).join('')}</ul>
        </article>`).join('')}
      </div>
      <div class="work-comparison reveal">
        <div class="work-comparison-title"><div><span class="section-kicker">Сравнение</span><h3>Что входит в каждый формат</h3></div><p>Объём, каналы и глубина автоматизации уточняются после диагностики продукта и текущей воронки.</p></div>
        <div class="work-comparison-table" role="table" aria-label="Сравнение форматов работы">
          <div class="work-comparison-row" data-comparison-head role="row"><span role="columnheader">Возможность</span>${plans.map((plan) => `<strong role="columnheader" class="${plan.popular ? 'is-popular' : ''}">${escapeHtml(plan.name)}${plan.popular ? '<span>оптимальный</span>' : ''}</strong>`).join('')}</div>
          ${features.map((feature) => `<div class="work-comparison-row" role="row"><span role="rowheader">${escapeHtml(feature.label)}</span>${plans.map((_, index) => { const value = valueForPlan(feature, index); return `<b role="cell" class="${valueClass(value)}">${value === '✓' ? '✓' : escapeHtml(value)}</b>`; }).join('')}</div>`).join('')}
        </div>
        <p class="work-models-note">Ориентировочная стоимость не является публичной офертой. Финальный состав, объём и цена фиксируются после диагностики ниши, данных, CRM и ресурсов отдела продаж.</p>
      </div>
    </div>
  </section>`;
}

function renderIntegrations(block) {
  const d = block.data;
  if (block.variant === 'compact-v36') {
    const benefits = (d.benefits || []).slice(0, 6);
    return `<section class="section home-trust-section integration-showcase-section" id="crm" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="integration-showcase section-card reveal">
      <div class="integration-showcase-main">
        <div class="integration-showcase-copy"><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.text)}</p></div>
        <div class="integration-logo-grid">${(d.items || []).map((item) => { const logo = safeMedia(item.logo) || crmLogoPath(item.name); return `<div class="integration-logo-tile" title="${escapeHtml(item.name)}">${logo ? `<img src="${logo}" alt="${escapeHtml(item.name)}" loading="lazy">` : `<strong>${escapeHtml(item.name)}</strong>`}</div>`; }).join('')}</div>
      </div>
      <div class="integration-showcase-footer">
        <div class="integration-benefits">${benefits.map((item) => `<div class="integration-benefit"><span>${iconSvg(item.icon || 'check')}</span><strong>${escapeHtml(item.text)}</strong></div>`).join('')}</div>
        <div class="integration-action"><p>${escapeHtml(d.note)}</p><button class="button button-ghost" type="button" data-open-form data-goal="crm_integration">${escapeHtml(d.buttonLabel)} <span aria-hidden="true">→</span></button></div>
      </div>
    </div></div></section>`;
  }
  return `<section class="section" id="crm" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="integration-card section-card reveal"><div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2><p class="muted">${escapeHtml(d.text)}</p><button class="text-link link-button" type="button" data-open-form data-goal="crm_integration">${escapeHtml(d.buttonLabel)} →</button></div><div class="integration-list">${(d.items || []).map((item) => `<div class="integration-logo">${escapeHtml(item.name)}</div>`).join('')}<p class="integration-note">${escapeHtml(d.note)}</p></div></div></div></section>`;
}

function renderAgents(block) {
  const d = block.data;
  if (block.variant === 'compact-v36') {
    return `<section class="section home-trust-section agents-showcase-section" id="agents" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="agents-showcase section-card reveal">
      <div class="agents-showcase-heading"><div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div>
      <div class="agents-showcase-rail">${(d.items || []).slice(0, 5).map((item) => `<article class="agent-showcase-item"><span class="agent-showcase-icon">${iconSvg(item.icon)}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div>
    </div></div></section>`;
  }
  return `<section class="section" id="agents" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="section-heading reveal"><div><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div><div class="agent-rail reveal">${(d.items || []).map((item) => `<div class="agent-item"><span class="agent-icon">${iconSvg(item.icon)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div>`).join('')}</div></div></section>`;
}

function renderFaq(block) {
  const d = block.data;
  if (block.variant === 'compact-v36') {
    return `<section class="section home-trust-section faq-showcase-section" id="faq" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="faq-showcase section-card reveal"><div class="faq-showcase-heading">${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<h2>${escapeHtml(d.title)}</h2>${d.intro ? `<p>${escapeHtml(d.intro)}</p>` : ''}</div><div class="faq-showcase-grid">${(d.items || []).slice(0, 6).map((item) => `<article class="faq-item"><button class="faq-question" type="button" aria-expanded="false"><span>${escapeHtml(item.question)}</span><span aria-hidden="true">+</span></button><div class="faq-answer"><div>${escapeHtml(item.answer)}</div></div></article>`).join('')}</div></div></div></section>`;
  }
  return `<section class="section" id="faq" data-cms-block="${escapeHtml(block.id)}"><div class="container faq-layout"><div class="reveal"><span class="section-kicker">${escapeHtml(d.kicker)}</span><h2>${escapeHtml(d.title)}</h2><p class="muted">${escapeHtml(d.intro)}</p></div><div class="faq-list reveal">${(d.items || []).map((item) => `<article class="faq-item"><button class="faq-question" type="button" aria-expanded="false"><span>${escapeHtml(item.question)}</span><span aria-hidden="true">+</span></button><div class="faq-answer"><div>${escapeHtml(item.answer)}</div></div></article>`).join('')}</div></div></section>`;
}

function renderCta(block, context = {}) {
  const d = block.data;
  const contactAnchor = context.contactAssigned ? '' : (context.contactAssigned = true, ' id="contact"');
  if (block.variant === 'contact-v36') {
    const contact = context.settings?.contact || {};
    const phoneDigits = String(context.publicConfig?.phone || '').replace(/[^+\d]/g, '');
    const email = String(context.publicConfig?.email || '').trim();
    const messengers = (d.messengers || []).slice(0, 5).map((item) => {
      let href = String(item.href || '').trim();
      if (!href && item.icon === 'telegram') href = String(contact.telegramUrl || '').trim();
      if (!href && item.icon === 'whatsapp' && phoneDigits) href = `https://wa.me/${phoneDigits.replace(/\D/g, '')}`;
      if (!href && item.icon === 'email' && email) href = `mailto:${email}`;
      return { ...item, href };
    });
    if (context.route === '/services/auto-dealers') {
      return `<section class="section section-compact contact-cta-section dealer-contact-v39"${contactAnchor} data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="contact-cta-panel reveal"><div class="dealer-cta-car" aria-hidden="true"><img src="/assets/img/cases3d/dealer-new.webp" alt="" width="640" height="420"></div><div class="contact-cta-copy"><span class="section-kicker">Следующий шаг</span><h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.text)}</p></div><div class="contact-cta-actions"><button class="button button-primary" type="button" data-open-form data-goal="${escapeHtml(d.goal || 'audit')}" data-cta="final">${escapeHtml(d.buttonLabel || 'Получить план')} <span aria-hidden="true">↗</span></button><small>${escapeHtml(d.responseText || '')}</small><div class="messenger-buttons" aria-label="Связаться в мессенджерах">${messengers.map((item) => item.href ? `<a class="messenger-button" href="${safeHref(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.label)}">${messengerSvg(item.icon)}</a>` : `<button class="messenger-button" type="button" data-open-form data-goal="${escapeHtml(d.goal || 'audit')}" aria-label="${escapeHtml(item.label)}">${messengerSvg(item.icon)}</button>`).join('')}</div></div></div></div></section>`;
    }
    return `<section class="section section-compact contact-cta-section"${contactAnchor} data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="contact-cta-panel reveal">
      <div class="contact-cta-copy"><span class="section-kicker">Следующий шаг</span><h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.text)}</p></div>
      <div class="contact-cta-visual" aria-hidden="true"><div class="contact-card contact-card-a"><span></span><i></i><i></i></div><div class="contact-card contact-card-b"><span></span><i></i><i></i></div><div class="contact-card contact-card-c"><b>Новый лид</b><span></span><i></i></div><div class="contact-orbit"></div></div>
      <div class="contact-cta-actions"><button class="button button-primary" type="button" data-open-form data-goal="${escapeHtml(d.goal || 'audit')}" data-cta="final">${escapeHtml(d.buttonLabel || 'Оставить заявку')} <span aria-hidden="true">↗</span></button><small>${escapeHtml(d.responseText || '')}</small><div class="messenger-buttons" aria-label="Связаться в мессенджерах">${messengers.map((item) => item.href ? `<a class="messenger-button" href="${safeHref(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.label)}">${messengerSvg(item.icon)}</a>` : `<button class="messenger-button" type="button" data-open-form data-goal="${escapeHtml(d.goal || 'audit')}" aria-label="${escapeHtml(item.label)}">${messengerSvg(item.icon)}</button>`).join('')}</div></div>
    </div></div></section>`;
  }
  return `<section class="section section-compact"${contactAnchor} data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="cta-panel reveal"><div><h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.text)}</p></div><button class="button" type="button" data-open-form data-goal="${escapeHtml(d.goal || 'audit')}" data-cta="final">${escapeHtml(d.buttonLabel || 'Обсудить проект')} <span aria-hidden="true">↗</span></button></div></div></section>`;
}

function renderRichText(block, context = {}) {
  const d = block.data;
  const headingTag = context.headingTag === 'h1' ? 'h1' : 'h2';
  return `<section class="section cms-rich-text cms-align-${escapeHtml(d.align)} ${d.narrow ? 'is-narrow' : ''}" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="cms-copy reveal">${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<${headingTag} class="section-title">${escapeHtml(d.title)}</${headingTag}><div class="cms-prose">${renderText(d.text)}</div></div></div></section>`;
}

function renderTextImage(block, context = {}) {
  const d = block.data;
  const image = safeMedia(d.image);
  const headingTag = context.headingTag === 'h1' ? 'h1' : 'h2';
  return `<section class="section cms-text-image" data-cms-block="${escapeHtml(block.id)}"><div class="container cms-text-image-grid ${d.imageSide === 'left' ? 'image-left' : ''}"><div class="cms-text-image-copy reveal">${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<${headingTag} class="section-title">${escapeHtml(d.title)}</${headingTag}><div class="cms-prose">${renderText(d.text)}</div>${d.buttonLabel ? `<a class="button button-primary" href="${safeHref(d.buttonHref, '#contact')}">${escapeHtml(d.buttonLabel)} <span aria-hidden="true">↗</span></a>` : ''}</div><div class="cms-text-image-media reveal">${image ? `<img src="${image}" alt="${escapeHtml(d.imageAlt || d.title)}">` : '<div class="cms-card-placeholder"></div>'}</div></div></section>`;
}

function renderStats(block) {
  const d = block.data;
  return `<section class="section section-compact"${contactAnchor} data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="section-heading reveal"><div>${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div><div class="cms-stats-grid reveal">${(d.items || []).map((item) => `<div class="cms-stat"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join('')}</div></div></section>`;
}

function renderGallery(block) {
  const d = block.data;
  return `<section class="section" data-cms-block="${escapeHtml(block.id)}"><div class="container"><div class="section-heading reveal"><div>${d.kicker ? `<span class="section-kicker">${escapeHtml(d.kicker)}</span>` : ''}<h2>${escapeHtml(d.title)}</h2></div><p>${escapeHtml(d.intro)}</p></div><div class="cms-gallery reveal">${(d.items || []).map((item) => { const image = safeMedia(item.image); return image ? `<figure><img src="${image}" alt="${escapeHtml(item.alt || item.caption || '')}" loading="lazy"><figcaption>${escapeHtml(item.caption || '')}</figcaption></figure>` : ''; }).join('')}</div></div></section>`;
}

function renderSpacer(block) {
  const size = ['small', 'medium', 'large'].includes(block.data.size) ? block.data.size : 'medium';
  return `<div class="cms-spacer cms-spacer-${size}" aria-hidden="true" data-cms-block="${escapeHtml(block.id)}"></div>`;
}

const BLOCK_RENDERERS = {
  'hero-premium': renderHero,
  'hero-auto-dealers': renderAutoDealersHero,
  'auto-proof': renderAutoProof,
  'auto-case-video': renderAutoCaseVideo,
  'human-control': renderHumanControl,
  capabilities: renderCapabilities,
  'collection-list': renderCollectionList,
  'cases-slider': renderCasesSlider,
  pricing: renderPricing,
  integrations: renderIntegrations,
  agents: renderAgents,
  faq: renderFaq,
  cta: renderCta,
  'rich-text': renderRichText,
  'text-image': renderTextImage,
  stats: renderStats,
  gallery: renderGallery,
  spacer: renderSpacer,
};

export function renderDocument(document, context) {
  let hasH1 = false;
  return (document?.blocks || []).filter((block) => block.enabled !== false).map((block) => {
    const renderer = BLOCK_RENDERERS[block.type];
    if (!renderer) return '';

    const canProvidePageHeading = ['hero-premium', 'hero-auto-dealers', 'rich-text', 'text-image'].includes(block.type);
    const headingTag = canProvidePageHeading && !hasH1 ? 'h1' : 'h2';

    try {
      const html = renderer(block, { ...context, headingTag });
      if (headingTag === 'h1' && html) hasH1 = true;
      return html;
    } catch (error) {
      return context.preview ? `<section class="section"><div class="container cms-render-error">Ошибка блока ${escapeHtml(block.type)}: ${escapeHtml(error.message)}</div></section>` : '';
    }
  }).join('\n');
}

function structuredData({ baseUrl, title, description, canonical, pageType, publicConfig, document }) {
  const graph = [
    { '@type': 'Organization', '@id': `${baseUrl}/#organization`, name: publicConfig.siteName, url: `${baseUrl}/`, logo: `${baseUrl}/assets/img/og-cover.png` },
    { '@type': 'WebSite', '@id': `${baseUrl}/#website`, url: `${baseUrl}/`, name: publicConfig.siteName, inLanguage: 'ru-RU' },
    { '@type': pageType === 'post' ? 'BlogPosting' : pageType === 'service' ? 'Service' : 'WebPage', url: canonical, name: title, description, inLanguage: 'ru-RU', isPartOf: { '@id': `${baseUrl}/#website` } },
  ];
  const faq = document?.blocks?.find((block) => block?.enabled !== false && block?.type === 'faq');
  const faqItems = Array.isArray(faq?.data?.items) ? faq.data.items.filter((item) => item?.question && item?.answer).slice(0, 20) : [];
  if (faqItems.length) graph.push({ '@type': 'FAQPage', '@id': `${canonical}#faq`, mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) });
  return safeJson({ '@context': 'https://schema.org', '@graph': graph });
}

export function renderCmsPage({ entity, document, settings, publicConfig, nonce, context, preview = false }) {
  const route = entity.route || itemRoute(entity);
  const title = entity.seoTitle || entity.title || publicConfig.siteName;
  const description = entity.seoDescription || entity.excerpt || publicConfig.tagline;
  const canonical = `${publicConfig.baseUrl}${route}`;
  const defaultTheme = settings?.defaultTheme === 'light' ? 'light' : 'dark';
  const body = renderDocument(document, { ...context, preview, route, settings, publicConfig });
  const visibleBlocks = (document?.blocks || []).filter((block) => block.enabled !== false);
  const hasPageHeading = visibleBlocks.some((block) => ['hero-premium', 'hero-auto-dealers', 'rich-text', 'text-image'].includes(block.type));
  const headingFallback = hasPageHeading ? '' : `<h1 class="visually-hidden">${escapeHtml(entity.title || publicConfig.siteName)}</h1>`;
  return `<!doctype html><html lang="ru" data-theme="${defaultTheme}" class="no-js"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#070810"><meta name="color-scheme" content="dark light">
    <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${preview ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}"><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/css/styles.css"><link rel="stylesheet" href="/assets/css/hero-premium.css"><link rel="stylesheet" href="/assets/css/cms-public.css">
    <meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="${escapeHtml(publicConfig.siteName)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(entity.cover ? `${publicConfig.baseUrl}${entity.cover}` : `${publicConfig.baseUrl}/assets/img/og-cover.png`)}"><meta name="twitter:card" content="summary_large_image">
    <script nonce="${escapeHtml(nonce)}" type="application/ld+json">${structuredData({ baseUrl: publicConfig.baseUrl, title, description, canonical, pageType: entity.kind || entity.pageType, publicConfig, document })}</script>
    <script nonce="${escapeHtml(nonce)}">(function(){document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');try{var t=localStorage.getItem('vionex-theme');if(!t)t='${defaultTheme}';document.documentElement.dataset.theme=t;}catch(e){}})();</script>
    <script src="/assets/js/app.js" type="module" defer></script><script src="/assets/js/hero-globe.js" type="module" defer></script>
  </head><body data-site-mode="${escapeHtml(publicConfig.mode)}" data-page="${escapeHtml(route)}">
    <a class="skip-link" href="#main">Перейти к содержанию</a><div class="scroll-progress" aria-hidden="true"><span></span></div>${preview ? '<div class="cms-preview-bar">Предпросмотр черновика. На сайте изменения ещё не опубликованы.</div>' : ''}
    ${renderHeader(settings, publicConfig.siteName)}<main id="main">${headingFallback}${body}</main>${renderFooter(settings, publicConfig)}${renderModal(publicConfig, { ...context, route })}
  </body></html>`;
}

export { escapeHtml, safeHref, safeMedia };
