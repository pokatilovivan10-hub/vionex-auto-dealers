import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { config as baseConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';
import { readJsonLines } from '../src/storage.mjs';
import { clearSessionCookie, hashPassword, sessionCookie } from '../src/cms/auth.mjs';
import { CmsDatabase } from '../src/cms/database.mjs';

let server;
let baseUrl;
let dataDir;
let closeCms;
let cmsDb;

const logger = { debug() {}, info() {}, warn() {}, error() {} };

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-leads-v3-test-'));
  const testConfig = {
    ...baseConfig,
    mode: 'test',
    isProduction: false,
    port: 0,
    host: '127.0.0.1',
    dataDir,
    minFormFillMs: 0,
    public: {
      ...baseConfig.public,
      mode: 'test',
      baseUrl: 'http://127.0.0.1',
      siteName: 'VIONEX TEST',
      companyLegalName: 'ООО Тест',
      companyTaxId: '0000000000',
      companyAddress: 'Тестовый адрес',
      privacyEmail: 'privacy@example.test',
    },
    webhook: { url: '', token: '', timeoutMs: 1000 },
    telegram: { botToken: '', chatId: '' },
  };
  const created = await createApp({ config: testConfig, logger });
  closeCms = created.closeCms;
  cmsDb = created.cmsDb;
  created.cmsDb.createUser({ username: 'admin', passwordHash: await hashPassword('VeryStrongTestPassword123!'), role: 'owner' });
  server = created.app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (closeCms) closeCms();
  if (dataDir) await fs.rm(dataDir, { recursive: true, force: true });
});

test('admin session cookie is Secure for HTTPS public URL', () => {
  const httpsConfig = { ...baseConfig, isProduction: false, public: { ...baseConfig.public, baseUrl: 'https://vionex.ru' }, cms: { ...baseConfig.cms, sessionHours: 8 } };
  assert.match(sessionCookie('token', httpsConfig), /; Secure(?:;|$)/);
  assert.match(clearSessionCookie(httpsConfig), /; Secure(?:;|$)/);

  const httpConfig = { ...httpsConfig, public: { ...httpsConfig.public, baseUrl: 'http://localhost:8080' } };
  assert.doesNotMatch(sessionCookie('token', httpConfig), /; Secure(?:;|$)/);
});

test('health endpoint returns version 3.11.0', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.version, '3.11.0');
});

test('CMS-rendered public pages and dynamic content routes work', async () => {
  const pages = [
    ['/', /Покупайте тёплых лидов/],
    ['/services', /Полный цикл B2B-лидогенерации/],
    ['/services/lead-generation', /Лидогенерация под ключ/],
    ['/cases', /Проекты и сценарии B2B-лидогенерации/],
    ['/cases/auto-new-cars', /Дилерский центр новых автомобилей/],
    ['/cases/auto-used-cars', /Дилерский центр новых автомобилей и авто с пробегом/],
    ['/cases/equipment-leasing', /Лизинг техники и оборудования/],
    ['/cases/modular-buildings', /Производитель модульных зданий/],
    ['/cases/industrial-equipment', /Поставщик промышленного оборудования/],
    ['/cases/cloud-infrastructure', /IT-интегратор и облачная инфраструктура/],
    ['/cases/logistics-company', /Логистическая компания/],
    ['/cases/fintech-platform', /Финтех-платформа для корпоративных клиентов/],
    ['/blog', /Практика B2B-лидогенерации/],
    ['/blog/kak-vystroit-b2b-lidogeneraciyu', /Как выстроить B2B-лидогенерацию/],
    ['/privacy', /Политика обработки персональных данных/],
  ];
  for (const [route, pattern] of pages) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();
    assert.equal(response.status, 200, route);
    assert.match(html, pattern, route);
    assert.match(html, /data-theme-toggle/, route);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${route}: должен быть один H1`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${route}: повторяющиеся id`);
    assert.match(response.headers.get('content-security-policy') || '', /script-src 'self' 'nonce-/);
    if (route === '/') {
      assert.match(html, /data-globe-animation="true"/);
      assert.match(html, /data-premium-globe/);
      assert.equal((html.match(/class="hero-flow-step"/g) || []).length, 4, 'маршрут лида должен содержать 4 ровных этапа');
      assert.doesNotMatch(html, /hero-flow-arrow/, 'лишние grid-элементы стрелок не должны ломать маршрут');
      assert.match(html, /class="section capabilities-showcase"/);
      assert.match(html, />Наши возможности<\/h2>/);
      assert.match(html, /Полный цикл лидогенерации с использованием AI-агентов и экспертизы/);
      assert.match(html, />Квалификация лидов<\/h3>/);
      assert.match(html, />Аналитика и оптимизация<\/h3>/);
      assert.equal((html.match(/class="capability-card"/g) || []).length, 6, 'блок возможностей должен содержать 6 карточек');
      assert.equal((html.match(/data-capability-icon=/g) || []).length, 6, 'каждая карточка должна иметь тип премиальной иконки');
      assert.match(html, /\/assets\/img\/capabilities\/target\.svg/);
      assert.match(html, /\/assets\/img\/capabilities\/crm\.svg/);
      assert.match(html, /\/assets\/img\/capabilities\/chart\.svg/);
      assert.match(html, /data-case-carousel/);
      assert.match(html, /data-case-autoplay-toggle/);
      assert.equal((html.match(/data-case-slide/g) || []).length, 8, 'слайдер должен сразу содержать 8 опубликованных кейсов');
      assert.equal((html.match(/<article class="case-showcase-card/g) || []).length, 8, 'каждый кейс должен иметь премиальную 3D-карточку');
      assert.match(html, />Реализованные проекты<\/h2>/);
      assert.match(html, /data-case-visual="auto-new"/);
      assert.match(html, /data-case-visual="auto-used"/);
      assert.match(html, /data-case-visual="leasing"/);
      assert.equal((html.match(/class="case-showcase-hud"/g) || []).length, 8, 'каждая карточка должна иметь динамический HUD-слой');
      assert.match(html, /class="container cases-showcase-shell"/, 'кейсы должны быть интегрированы в фон без внешней панели');
      assert.doesNotMatch(html, /class="container cases-showcase-panel"/, 'у блока кейсов не должно быть внешней рамки');
      assert.match(html, /class="section work-models-section"/);
      assert.equal((html.match(/class="work-plan-card/g) || []).length, 3, 'должны отображаться три формата работы');
      assert.match(html, />Что входит в каждый формат<\/h3>/);
      assert.equal((html.match(/work-comparison-row/g) || []).length, 11, 'таблица сравнения должна содержать заголовок и 10 параметров');
      assert.match(html, /class="integration-showcase section-card/);
      assert.equal((html.match(/class="integration-logo-tile"/g) || []).length, 8, 'интеграционный блок должен содержать 8 логотипов');
      assert.match(html, /\/assets\/img\/crm-logos\/amocrm\.svg/);
      assert.match(html, /Если вашей CRM нет в списке — подключаем через API/);
      assert.equal((html.match(/class="integration-benefit"/g) || []).length, 3, 'под логотипами должны быть 3 пояснения');
      assert.match(html, /class="agents-showcase section-card/);
      assert.equal((html.match(/class="agent-showcase-item"/g) || []).length, 5, 'должно быть 5 AI-агентов');
      assert.match(html, /class="faq-showcase section-card/);
      assert.equal((html.match(/class="faq-item"/g) || []).length, 6, 'FAQ должен содержать 6 компактных вопросов');
      assert.match(html, /class="contact-cta-panel/);
      assert.equal((html.match(/class="messenger-button"/g) || []).length, 3, 'CTA должен содержать 3 кнопки связи');
    }
    assert.doesNotMatch(html, /\{\{SITE_NAME\}\}/, route);
  }
});



test('automotive dealer landing follows the niche specification and is CMS-driven', async () => {
  const response = await fetch(`${baseUrl}/services/auto-dealers`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Приводим целевых тёплых лидов/);
  assert.match(html, /class="auto-hero-advantages"/);
  assert.equal((html.match(/class="auto-hero-advantages"/g) || []).length, 1);
  assert.doesNotMatch(html, />Смотреть кейсы <span aria-hidden="true">→<\/span><\/a>/);
  assert.match(html, /data-auto-hero-animation="true"/);
  assert.doesNotMatch(html, /auto-proof-section/);
  assert.match(html, /auto-case-video-section/);
  assert.match(html, /dealer-case-grid/);
  assert.doesNotMatch(html, /AI ускоряет обработку\. Качество контролируют люди/);
  assert.match(html, /Вопросы перед запуском/);
  assert.match(html, /FAQPage/);
  assert.match(html, /Лидогенерация для автодилеров и дилерских центров/);
  const databaseItem = cmsDb.getContentBySlug('service', 'auto-dealers', { publishedOnly: true });
  assert.ok(databaseItem);
  assert.equal(databaseItem.published.blocks[0].type, 'hero-auto-dealers');
  assert.equal(databaseItem.published.blocks.filter((block) => block.enabled !== false).length, 7);
  assert.equal(databaseItem.published.blocks.find((block) => block.type === 'hero-auto-dealers').data.primaryLabel, 'Получить план лидогенерации');
  assert.equal(databaseItem.published.blocks.find((block) => block.type === 'agents').data.items.length, 3);
  assert.equal(databaseItem.published.blocks.find((block) => block.type === 'pricing').data.features.length, 4);
  assert.equal(databaseItem.published.blocks.find((block) => block.type === 'faq').data.items.length, 4);
  assert.match(html, /Получите план лидогенерации для вашего дилерского центра/);
  assert.match(html, /Компания \/ дилерский центр/);
  for (const slug of ['auto-commercial-vehicles', 'auto-motorcycles', 'auto-service']) {
    assert.ok(cmsDb.getContentBySlug('case', slug, { publishedOnly: true }), slug);
  }
});

test('v3.0 homepage defaults migrate to the approved hero route and capabilities showcase without overwriting custom text', async () => {
  const migrationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-leads-v31-migration-'));
  let database;
  try {
    database = new CmsDatabase(migrationDir);
    const page = database.getPageByRoute('/');
    const legacy = structuredClone(page.published);
    const capabilities = legacy.blocks.find((block) => block.type === 'capabilities');
    capabilities.variant = 'default';
    capabilities.data = {
      ...capabilities.data,
      kicker: 'Наши возможности',
      title: 'Создаём систему, которая',
      accent: 'двигает бизнес вперёд',
      intro: 'Полный цикл лидогенерации: стратегия, данные, коммуникации, квалификация, CRM и улучшение результата.',
      items: [
        { number: '01', title: 'Стратегия и ICP', text: 'Изучаем продукт, рынок и воронку. Определяем профиль клиента и точки роста.', icon: 'target', href: '/services/lead-generation' },
        { number: '02', title: 'Поиск ЛПР', text: 'Собираем, обогащаем и проверяем контакты лиц, принимающих решения.', icon: 'search', href: '/services/lead-generation' },
        { number: '03', title: 'Контакт-центр', text: 'Создаём персонализированные касания и развиваем диалог.', icon: 'chat', href: '/services/lead-generation' },
        { number: '04', title: 'Квалификация', text: 'Уточняем задачу, роль, сроки и следующий шаг.', icon: 'funnel', href: '/services/lead-generation' },
        { number: '05', title: 'CRM-интеграция', text: 'Пользовательский текст — его нельзя перезаписывать.', icon: 'crm', href: '/services/lead-generation#crm' },
        { number: '06', title: 'Аналитика', text: 'Сопоставляем данные CRM с качеством диалогов и улучшаем процесс.', icon: 'chart', href: '/services/lead-generation' },
      ],
    };
    database.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ? WHERE route = ?')
      .run(JSON.stringify(legacy), JSON.stringify(legacy), '/');
    database.db.prepare('UPDATE cms_meta SET value = ? WHERE key = ?').run('1', 'schema_version');
    database.close();
    database = null;

    database = new CmsDatabase(migrationDir);
    const migrated = database.getPageByRoute('/');
    const migratedBlock = migrated.published.blocks.find((block) => block.type === 'capabilities');
    assert.equal(migratedBlock.variant, 'homepage-showcase');
    assert.equal(migratedBlock.data.title, 'Наши возможности');
    assert.equal(migratedBlock.data.accent, '');
    assert.equal(migratedBlock.data.intro, 'Полный цикл лидогенерации с использованием AI-агентов и экспертизы.');
    assert.equal(migratedBlock.data.items[3].title, 'Квалификация лидов');
    assert.equal(migratedBlock.data.items[5].title, 'Аналитика и оптимизация');
    assert.equal(migratedBlock.data.items[4].text, 'Пользовательский текст — его нельзя перезаписывать.');
    assert.equal(database.schemaVersion(), 16);
  } finally {
    if (database) database.close();
    await fs.rm(migrationDir, { recursive: true, force: true });
  }
});

test('legacy installation migrates to open 3D carousel, premium formats and automotive/leasing scenarios', async () => {
  const migrationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-leads-v33-migration-'));
  let database;
  try {
    database = new CmsDatabase(migrationDir);
    database.db.prepare("DELETE FROM cms_content_items WHERE kind = 'case' AND slug <> ?").run('modular-buildings');
    const page = database.getPageByRoute('/');
    const legacy = structuredClone(page.published);
    const slider = legacy.blocks.find((block) => block.type === 'cases-slider');
    slider.variant = 'default';
    slider.data = {
      ...slider.data,
      kicker: 'Реализованные проекты',
      title: 'Проекты, которые приносят',
      accent: 'бизнесу результат',
      intro: 'Показываем логику проекта, использованные механики и подтверждённые результаты.',
      limit: 3,
    };
    delete slider.data.autoplay;
    delete slider.data.autoplayDelay;
    const pricing = legacy.blocks.find((block) => block.type === 'pricing');
    pricing.variant = 'default';
    pricing.data = {
      ...pricing.data,
      kicker: 'Форматы работы',
      title: 'Выберите модель под задачу и зрелость отдела продаж',
      intro: 'Финальный состав и стоимость фиксируются после диагностики продукта, рынка и воронки.',
      periodMonthly: 'Ежемесячно',
      periodQuarterly: 'Ежеквартально',
      plans: [
        { name: 'Старт', monthly: 'от 120 000 ₽', quarterly: 'по расчёту', caption: 'Пилот и проверка гипотезы', popular: false, button: 'Обсудить старт' },
        { name: 'Рост', monthly: 'от 220 000 ₽', quarterly: 'по расчёту', caption: 'Системный поток квалифицированных диалогов', popular: true, button: 'Обсудить рост' },
        { name: 'Масштаб', monthly: 'от 350 000 ₽', quarterly: 'по расчёту', caption: 'Несколько сегментов и глубокая CRM-автоматизация', popular: false, button: 'Обсудить масштаб' },
      ],
      features: [
        { label: 'Исследование рынка и ICP', start: '✓', growth: '✓', scale: '✓' },
        { label: 'Сбор и обогащение базы ЛПР', start: '✓', growth: '✓', scale: '✓' },
        { label: 'Персонализированные касания', start: 'Базово', growth: 'Расширенно', scale: 'Несколько сегментов' },
        { label: 'Квалификация и передача в CRM', start: '✓', growth: '✓', scale: '✓' },
        { label: 'Аналитика и оптимизация', start: 'Отчёт', growth: 'Регулярно', scale: 'Расширенно' },
      ],
    };
    database.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ? WHERE route = ?')
      .run(JSON.stringify(legacy), JSON.stringify(legacy), '/');
    database.db.prepare('UPDATE cms_meta SET value = ? WHERE key = ?').run('3', 'schema_version');
    database.close();
    database = null;

    database = new CmsDatabase(migrationDir);
    const migrated = database.getPageByRoute('/');
    const migratedSlider = migrated.published.blocks.find((block) => block.type === 'cases-slider');
    assert.equal(migratedSlider.variant, 'integrated-carousel-v35');
    assert.equal(migratedSlider.data.kicker, 'Кейсы');
    assert.equal(migratedSlider.data.title, 'Реализованные проекты');
    assert.equal(migratedSlider.data.accent, '');
    assert.equal(migratedSlider.data.autoplay, true);
    assert.equal(migratedSlider.data.autoplayDelay, 6500);
    assert.equal(migratedSlider.data.limit, 8);
    const migratedPricing = migrated.published.blocks.find((block) => block.type === 'pricing');
    assert.equal(migratedPricing.variant, 'formats-v35');
    assert.equal(migratedPricing.data.title, 'Три модели под разные задачи и темп роста');
    assert.equal(migratedPricing.data.periodQuarterly, 'Ежеквартально −10%');
    assert.equal(migratedPricing.data.plans.length, 3);
    assert.equal(migratedPricing.data.plans[0].monthly, 'от 120 000 ₽ / мес');
    assert.equal(migratedPricing.data.plans[1].quarterly, 'от 594 000 ₽ / квартал');
    assert.equal(migratedPricing.data.features.length, 10);
    assert.equal(database.listPublishedContent('case', 30).length, 11);
    for (const slug of ['auto-new-cars', 'auto-used-cars', 'auto-commercial-vehicles', 'auto-motorcycles', 'auto-service', 'equipment-leasing', 'modular-buildings', 'industrial-equipment', 'cloud-infrastructure', 'logistics-company', 'fintech-platform']) {
      assert.ok(cmsDb.getContentBySlug('case', slug, { publishedOnly: true }), slug);
    }
    assert.equal(database.getContentBySlug('case', 'auto-new-cars', { publishedOnly: true }).cover, '/assets/img/cases3d/dealer-new.webp');
    assert.equal(database.getContentBySlug('case', 'auto-used-cars', { publishedOnly: true }).cover, '/assets/img/cases3d/dealer-new-used.webp');
    assert.equal(database.getContentBySlug('case', 'equipment-leasing', { publishedOnly: true }).cover, '/assets/img/cases3d/equipment-leasing.webp');
    assert.equal(database.schemaVersion(), 16);
  } finally {
    if (database) database.close();
    await fs.rm(migrationDir, { recursive: true, force: true });
  }
});

test('v3.5 migration preserves customized pricing content while applying the new visual variants', async () => {
  const migrationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-leads-v35-custom-migration-'));
  let database;
  try {
    database = new CmsDatabase(migrationDir);
    const page = database.getPageByRoute('/');
    const custom = structuredClone(page.published);
    const slider = custom.blocks.find((block) => block.type === 'cases-slider');
    const pricing = custom.blocks.find((block) => block.type === 'pricing');
    slider.variant = 'premium-3d-carousel';
    pricing.variant = 'default';
    pricing.data.title = 'Пользовательский заголовок тарифов';
    pricing.data.plans[0].caption = 'Пользовательское описание — его нельзя перезаписывать.';
    database.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ? WHERE route = ?')
      .run(JSON.stringify(custom), JSON.stringify(custom), '/');
    database.db.prepare('UPDATE cms_meta SET value = ? WHERE key = ?').run('5', 'schema_version');
    database.close();
    database = null;

    database = new CmsDatabase(migrationDir);
    const migrated = database.getPageByRoute('/').published;
    const migratedSlider = migrated.blocks.find((block) => block.type === 'cases-slider');
    const migratedPricing = migrated.blocks.find((block) => block.type === 'pricing');
    assert.equal(migratedSlider.variant, 'integrated-carousel-v35');
    assert.equal(migratedPricing.variant, 'formats-v35');
    assert.equal(migratedPricing.data.title, 'Пользовательский заголовок тарифов');
    assert.equal(migratedPricing.data.plans[0].caption, 'Пользовательское описание — его нельзя перезаписывать.');
    assert.equal(database.schemaVersion(), 16);
  } finally {
    if (database) database.close();
    await fs.rm(migrationDir, { recursive: true, force: true });
  }
});

test('v3.10 reference hero migration replaces default artwork, adds layout controls and preserves custom media', async () => {
  const migrationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-leads-v392-hero-migration-'));
  let database;
  try {
    database = new CmsDatabase(migrationDir);
    const item = database.getContentBySlug('service', 'auto-dealers', { publishedOnly: true });
    const draft = structuredClone(item.draft);
    const published = structuredClone(item.published);
    for (const document of [draft, published]) {
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      hero.data.image = '/assets/img/auto-dealers-hero-v391.webp';
    }
    database.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ? WHERE kind = ? AND slug = ?')
      .run(JSON.stringify(draft), JSON.stringify(published), 'service', 'auto-dealers');
    database.db.prepare('UPDATE cms_meta SET value = ? WHERE key = ?').run('12', 'schema_version');
    database.close();
    database = null;

    database = new CmsDatabase(migrationDir);
    let migrated = database.getContentBySlug('service', 'auto-dealers', { publishedOnly: true });
    const migratedHero = migrated.published.blocks.find((block) => block.type === 'hero-auto-dealers').data;
    assert.equal(migratedHero.image, '/assets/img/hero-auto/car-blue-v310.webp');
    assert.equal(migratedHero.carScale, 108);
    assert.equal(migratedHero.sceneHeight, 560);
    assert.equal(migratedHero.badges[0].title, '+200%');
    assert.equal(migratedHero.badges[0].x, 27);
    assert.equal(migratedHero.badges[0].visualType, 'chart');
    assert.equal(migratedHero.badges.length, 3);
    assert.equal(database.schemaVersion(), 16);

    const customDraft = structuredClone(migrated.draft);
    const customPublished = structuredClone(migrated.published);
    for (const document of [customDraft, customPublished]) {
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      hero.data.image = '/uploads/custom-dealer-hero.webp';
    }
    database.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ? WHERE kind = ? AND slug = ?')
      .run(JSON.stringify(customDraft), JSON.stringify(customPublished), 'service', 'auto-dealers');
    database.db.prepare('UPDATE cms_meta SET value = ? WHERE key = ?').run('12', 'schema_version');
    database.close();
    database = null;

    database = new CmsDatabase(migrationDir);
    migrated = database.getContentBySlug('service', 'auto-dealers', { publishedOnly: true });
    assert.equal(migrated.published.blocks.find((block) => block.type === 'hero-auto-dealers').data.image, '/uploads/custom-dealer-hero.webp');
  } finally {
    if (database) database.close();
    await fs.rm(migrationDir, { recursive: true, force: true });
  }
});

test('canonical route redirects remove html files and trailing slashes', async () => {
  const htmlRedirect = await fetch(`${baseUrl}/services.html`, { redirect: 'manual' });
  assert.equal(htmlRedirect.status, 301);
  assert.equal(htmlRedirect.headers.get('location'), '/services');

  const slashRedirect = await fetch(`${baseUrl}/cases/`, { redirect: 'manual' });
  assert.equal(slashRedirect.status, 301);
  assert.equal(slashRedirect.headers.get('location'), '/cases');
});

test('CSS, JS, admin assets and SVG assets are served with correct MIME types', async () => {
  const css = await fetch(`${baseUrl}/assets/css/styles.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);

  const cmsCss = await fetch(`${baseUrl}/assets/css/cms-public.css`);
  assert.equal(cmsCss.status, 200);
  assert.match(await cmsCss.text(), /cms-collection-grid/);

  const adminJs = await fetch(`${baseUrl}/assets/admin/admin.js`);
  assert.equal(adminJs.status, 200);
  assert.match(adminJs.headers.get('content-type'), /text\/javascript/);

  const heroJs = await fetch(`${baseUrl}/assets/js/hero-globe.js`);
  assert.equal(heroJs.status, 200);
  assert.match(await heroJs.text(), /data-premium-globe/);

  const svg = await fetch(`${baseUrl}/assets/img/graphics/processor.svg`);
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);

  for (const icon of ['target', 'search', 'chat', 'funnel', 'crm', 'chart']) {
    const capabilitySvg = await fetch(`${baseUrl}/assets/img/capabilities/${icon}.svg`);
    assert.equal(capabilitySvg.status, 200, icon);
    assert.match(capabilitySvg.headers.get('content-type'), /image\/svg\+xml/, icon);
    assert.match(await capabilitySvg.text(), /<svg/);
  }

  for (const image of ['dealer-new', 'dealer-new-used', 'equipment-leasing', 'industrial-equipment', 'cloud-infrastructure', 'fintech', 'logistics', 'modular-buildings']) {
    const caseImage = await fetch(`${baseUrl}/assets/img/cases3d/${image}.webp`);
    assert.equal(caseImage.status, 200, image);
    assert.match(caseImage.headers.get('content-type'), /image\/webp/, image);
    assert.ok((await caseImage.arrayBuffer()).byteLength > 20_000, `${image}: изображение должно быть полноценным WebP`);
  }
});

test('sitemap is generated from published CMS pages and materials', async () => {
  const response = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(response.status, 200);
  const xml = await response.text();
  for (const route of ['/services', '/services/lead-generation', '/services/auto-dealers', '/cases', '/cases/auto-new-cars', '/cases/auto-used-cars', '/cases/equipment-leasing', '/cases/modular-buildings', '/cases/industrial-equipment', '/cases/cloud-infrastructure', '/cases/logistics-company', '/cases/fintech-platform', '/blog', '/blog/kak-vystroit-b2b-lidogeneraciyu']) {
    assert.match(xml, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(xml, /\/admin/);
});

test('404 page returns correct status', async () => {
  const response = await fetch(`${baseUrl}/missing-page`);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Этот маршрут не ведёт к клиенту/);
});

test('valid lead is stored locally with page metadata', async () => {
  const response = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Иван', phone: '+7 (999) 111-22-33', email: 'ivan@example.ru', company: 'Тест', role: 'РОП',
      goal: 'warm_leads', monthlyTarget: '', comment: 'Тестовая заявка', consent: true, website: '', startedAt: Date.now() - 5000,
      meta: { page: '/services/lead-generation', viewport: 'desktop', variant: 'dark', sessionId: 'test-session', utm: {} },
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.leadId, /^VL-/);
  const records = await readJsonLines(path.join(dataDir, 'leads.ndjson'));
  assert.equal(records.length, 1);
  assert.equal(records[0].meta.page, '/services/lead-generation');
  assert.equal(records[0].consent.accepted, true);
});

test('invalid lead receives validation errors', async () => {
  const response = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A', phone: '123', goal: 'unknown', consent: false, website: '', startedAt: Date.now() - 5000 }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.ok(body.errors.name);
  assert.ok(body.errors.phone);
  assert.ok(body.errors.consent);
});

test('first-party event is accepted without storing IP', async () => {
  const response = await fetch(`${baseUrl}/api/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', sessionId: 'test-session', properties: { viewport: 'desktop', path: '/' } }),
  });
  assert.equal(response.status, 204);
  const events = await readJsonLines(path.join(dataDir, 'events.ndjson'));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'page_view');
  assert.equal('ip' in events[0], false);
});

test('admin authentication, page builder draft, preview, publish and media library work', async () => {
  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /VIONEX CMS/);
  assert.match(adminPage.headers.get('cache-control') || '', /no-store/);

  const login = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'VeryStrongTestPassword123!' }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  const setCookie = login.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  assert.ok(cookie.includes('vionex_admin='));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.ok(loginBody.csrfToken);
  const authHeaders = { cookie, 'x-csrf-token': loginBody.csrfToken, 'content-type': 'application/json' };

  const blocks = await fetch(`${baseUrl}/admin/api/block-types`, { headers: { cookie } });
  assert.equal(blocks.status, 200);
  assert.ok((await blocks.json()).blockTypes.some((block) => block.type === 'hero-premium'));

  const created = await fetch(`${baseUrl}/admin/api/pages`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ title: 'Тест CMS', route: '/cms-test', seoTitle: 'Тест CMS', seoDescription: 'Описание', draft: { schemaVersion: 1, blocks: [{ id: 'testblock1', type: 'rich-text', enabled: true, variant: 'default', data: { kicker: 'Тест', title: 'Черновик CMS', text: 'Содержимое', align: 'left', narrow: true } }] } }),
  });
  assert.equal(created.status, 201);
  const page = (await created.json()).page;

  const preview = await fetch(`${baseUrl}/admin/preview/page/${page.id}`, { headers: { cookie } });
  assert.equal(preview.status, 200);
  const previewHtml = await preview.text();
  assert.match(previewHtml, /Предпросмотр черновика/);
  assert.match(previewHtml, /name="robots" content="noindex,nofollow"/);
  assert.match(preview.headers.get('x-robots-tag') || '', /noindex/i);

  const publish = await fetch(`${baseUrl}/admin/api/pages/${page.id}/publish`, { method: 'POST', headers: authHeaders, body: '{}' });
  assert.equal(publish.status, 200);
  const publicPage = await fetch(`${baseUrl}/cms-test`);
  assert.equal(publicPage.status, 200);
  assert.match(await publicPage.text(), /Черновик CMS/);

  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z5qQAAAAASUVORK5CYII=';
  const upload = await fetch(`${baseUrl}/admin/api/media`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ originalName: 'pixel.png', mimeType: 'image/png', base64: pngBase64, title: 'Pixel', altText: 'Pixel' }) });
  assert.equal(upload.status, 201);
  const media = (await upload.json()).media;
  const image = await fetch(`${baseUrl}${media.url}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') || '', /image\/png/);

  const removeMedia = await fetch(`${baseUrl}/admin/api/media/${media.id}`, { method: 'DELETE', headers: authHeaders });
  assert.equal(removeMedia.status, 200);

  const createContent = await fetch(`${baseUrl}/admin/api/content`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      kind: 'service', slug: 'cms-service-test', title: 'Тестовая услуга', excerpt: 'Проверка динамического материала', tags: ['B2B'],
      draft: { schemaVersion: 1, blocks: [{ id: 'contentblock1', type: 'rich-text', enabled: true, variant: 'default', data: { kicker: 'Услуга', title: 'Тестовая услуга из CMS', text: 'Опубликованный материал', align: 'left', narrow: true } }] },
    }),
  });
  assert.equal(createContent.status, 201);
  const content = (await createContent.json()).item;
  const publishContent = await fetch(`${baseUrl}/admin/api/content/${content.id}/publish`, { method: 'POST', headers: authHeaders, body: '{}' });
  assert.equal(publishContent.status, 200);
  const publicContent = await fetch(`${baseUrl}/services/cms-service-test`);
  assert.equal(publicContent.status, 200);
  assert.match(await publicContent.text(), /Тестовая услуга из CMS/);

  const settingsResponse = await fetch(`${baseUrl}/admin/api/settings`, { headers: { cookie } });
  assert.equal(settingsResponse.status, 200);
  const settings = (await settingsResponse.json()).draft;
  settings.brandAccent = 'CMS TEST';
  settings.contact ||= {};
  settings.contact.phone = '+7 495 000-00-00';
  settings.contact.email = 'cms@example.test';
  settings.legal ||= {};
  settings.legal.companyLegalName = 'ООО CMS Тест';
  settings.legal.companyTaxId = '1234567890';
  const saveSettings = await fetch(`${baseUrl}/admin/api/settings`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify(settings) });
  assert.equal(saveSettings.status, 200);
  const publishSettings = await fetch(`${baseUrl}/admin/api/settings/publish`, { method: 'POST', headers: authHeaders, body: '{}' });
  assert.equal(publishSettings.status, 200);
  const homeAfterSettings = await fetch(`${baseUrl}/`);
  const homeAfterSettingsHtml = await homeAfterSettings.text();
  assert.match(homeAfterSettingsHtml, /CMS TEST/);
  assert.match(homeAfterSettingsHtml, /\+7 495 000-00-00/);
  const publicConfig = await fetch(`${baseUrl}/api/public-config`);
  const publicConfigBody = await publicConfig.json();
  assert.equal(publicConfigBody.phone, '+7 495 000-00-00');
  assert.equal(publicConfigBody.email, 'cms@example.test');
  assert.match(publicConfigBody.legalSummary, /ООО CMS Тест/);

  const backup = await fetch(`${baseUrl}/admin/api/backup`, { method: 'POST', headers: authHeaders, body: '{}' });
  assert.equal(backup.status, 200);
  const backupBody = await backup.json();
  assert.match(backupBody.file, /^cms-.*-manual\.sqlite$/);
  await fs.access(path.join(dataDir, 'backups', backupBody.file));

  const missingCsrf = await fetch(`${baseUrl}/admin/api/pages`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(missingCsrf.status, 403);
  const svgUpload = await fetch(`${baseUrl}/admin/api/media`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ originalName: 'unsafe.svg', mimeType: 'image/svg+xml', base64: 'PHN2Zz48L3N2Zz4=' }) });
  assert.equal(svgUpload.status, 415);

  const removeContent = await fetch(`${baseUrl}/admin/api/content/${content.id}`, { method: 'DELETE', headers: authHeaders });
  assert.equal(removeContent.status, 200);
  const removePage = await fetch(`${baseUrl}/admin/api/pages/${page.id}`, { method: 'DELETE', headers: authHeaders });
  assert.equal(removePage.status, 200);
});
