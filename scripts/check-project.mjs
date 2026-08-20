import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getBlockDefinitions } from '../src/cms/block-definitions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const requiredFiles = [
  '.env.example', '.gitignore', 'Caddyfile', 'Dockerfile', 'README.md', 'VERSION',
  'docker-compose.yml', 'package.json',
  'docs/CMS_ADMIN_GUIDE.md', 'docs/DEPLOY_V3.6.0.md', 'docs/DEPLOY_V3.6.1.md', 'docs/DEPLOY_V3.7.0.md', 'docs/DEPLOY_V3.8.0.md', 'docs/DEPLOY_V3.8.1.md', 'docs/RELEASE_NOTES_V3.8.1.md', 'docs/DEPLOY_V3.9.0.md', 'docs/RELEASE_NOTES_V3.9.0.md', 'docs/TEST_REPORT_V3.9.0.md', 'docs/DEPLOY_V3.9.1.md', 'docs/RELEASE_NOTES_V3.9.1.md', 'docs/TEST_REPORT_V3.9.1.md', 'docs/BROWSER_AUDIT_V3.9.1.json', 'docs/ARCHITECTURE_CMS.md',
  'docs/SECURITY_CMS.md', 'docs/TEST_REPORT_V3.6.0.md', 'docs/TEST_REPORT_V3.6.1.md', 'docs/TEST_REPORT_V3.7.0.md', 'docs/TEST_REPORT_V3.8.0.md', 'docs/AUTO_DEALERS_LANDING_V3.7.0.md', 'docs/AUTO_DEALERS_AUDIT_V3.8.0.md', 'docs/DESIGN_TRUST_STACK_V3.6.0.md', 'docs/DESIGN_FIX_V3.6.1.md', 'docs/BROWSER_AUDIT_V3.6.0.json', 'docs/BROWSER_AUDIT_V3.6.1.json', 'docs/BROWSER_AUDIT_V3.7.0.json', 'docs/BROWSER_AUDIT_V3.8.0.json',
  'docs/visual/HOME_TRUST_STACK_V3.6.0_DARK_1440.png', 'docs/visual/HOME_TRUST_STACK_V3.6.0_LIGHT_1440.png', 'docs/visual/HOME_TRUST_STACK_V3.6.0_MOBILE_390.png',
  'docs/visual/HOME_AI_CTA_FIX_V3.6.1_DARK_1440.png', 'docs/visual/HOME_AI_CTA_FIX_V3.6.1_LIGHT_1440.png', 'docs/visual/HOME_AI_CTA_FIX_V3.6.1_MOBILE_390.png',
  'docs/visual/AUTO_DEALERS_V3.7.0_TOP_DARK_1440.png', 'docs/visual/AUTO_DEALERS_V3.7.0_PROOF_CASES_1440.png', 'docs/visual/AUTO_DEALERS_V3.7.0_BOTTOM_DARK_1440.png',
  'docs/visual/AUTO_DEALERS_V3.7.0_LIGHT_1440.png', 'docs/visual/AUTO_DEALERS_V3.7.0_MOBILE_390.png',
  'docs/visual/AUTO_DEALERS_V3.8.0_TOP_DARK_1440.png', 'docs/visual/AUTO_DEALERS_V3.8.0_TOP_LIGHT_1440.png', 'docs/visual/AUTO_DEALERS_V3.8.0_MOBILE_390.png',
  'docs/visual/AUTO_DEALERS_HERO_V3.9.1_DARK_1440.png', 'docs/visual/AUTO_DEALERS_HERO_V3.9.1_LIGHT_1440.png', 'docs/visual/AUTO_DEALERS_HERO_V3.9.1_MOBILE_390.png',
  'public/404.html', 'public/admin/index.html',
  'public/assets/admin/admin.css', 'public/assets/admin/admin.js',
  'public/assets/css/styles.css', 'public/assets/css/hero-premium.css', 'public/assets/css/cms-public.css',
  'public/assets/js/app.js', 'public/assets/js/hero-globe.js',
  'public/assets/img/logo.svg', 'public/assets/img/favicon.svg', 'public/assets/img/og-cover.png',
  'public/assets/img/capabilities/target.svg', 'public/assets/img/capabilities/search.svg', 'public/assets/img/capabilities/chat.svg',
  'public/assets/img/capabilities/funnel.svg', 'public/assets/img/capabilities/crm.svg', 'public/assets/img/capabilities/chart.svg',
  'public/assets/img/cases3d/dealer-new.webp', 'public/assets/img/cases3d/dealer-new-used.webp',
  'public/assets/img/auto-dealers-hero-v391.webp', 'public/assets/img/auto-dealers-hero-v391-light.webp',
  'public/assets/img/auto-dealers-hero-v392.webp', 'public/assets/img/auto-dealers-hero-v392-light.webp',
  'public/assets/img/cases3d/equipment-leasing.webp', 'public/assets/img/cases3d/industrial-equipment.webp',
  'public/assets/img/cases3d/cloud-infrastructure.webp', 'public/assets/img/cases3d/fintech.webp',
  'public/assets/img/cases3d/logistics.webp', 'public/assets/img/cases3d/modular-buildings.webp',
  'public/assets/img/crm-logos/amocrm.svg', 'public/assets/img/crm-logos/bitrix24.svg',
  'public/assets/img/crm-logos/retailcrm.svg', 'public/assets/img/crm-logos/hubspot.svg',
  'public/assets/img/crm-logos/pipedrive.svg', 'public/assets/img/crm-logos/salesforce.svg',
  'public/assets/img/crm-logos/zoho.svg', 'public/assets/img/crm-logos/api.svg',
  'src/config.mjs', 'src/storage.mjs', 'src/validation.mjs', 'src/delivery.mjs', 'src/retention.mjs', 'src/server.mjs',
  'src/cms/admin-routes.mjs', 'src/cms/auth.mjs', 'src/cms/block-definitions.mjs',
  'src/cms/database.mjs', 'src/cms/media.mjs', 'src/cms/render.mjs', 'src/cms/seed.mjs',
  'scripts/create-admin.mjs', 'scripts/change-admin-password.mjs', 'scripts/backup-cms.mjs', 'scripts/build-preview.mjs',
  'scripts/START_LOCAL_WINDOWS.ps1', 'scripts/TEST_WINDOWS.ps1',
  'scripts/CREATE_ADMIN_WINDOWS.ps1', 'scripts/CHANGE_ADMIN_PASSWORD_WINDOWS.ps1', 'scripts/BACKUP_CMS_WINDOWS.ps1',
  'CREATE_ADMIN_WINDOWS.cmd', 'CHANGE_ADMIN_PASSWORD_WINDOWS.cmd', 'BACKUP_CMS_WINDOWS.cmd',
  'test/server.test.mjs',
];

const requiredDirectories = ['data', 'data/uploads', 'data/backups'];

const forbiddenFiles = [
  'src/cms/db.mjs', 'src/cms/defaults.mjs', 'src/cms/renderer.mjs', 'src/cms/security.mjs',
  'src/cms/validation.mjs', 'scripts/reset-admin-password.mjs',
  'public/assets/css/cms-blocks.css', 'src/server.mjs.before-cms-consolidation',
];

async function exists(relative) {
  try { return await fs.stat(path.join(root, relative)); } catch { return null; }
}

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

for (const relative of requiredFiles) {
  const stat = await exists(relative);
  if (!stat) errors.push(`${relative}: файл отсутствует`);
  else if (!stat.isFile()) errors.push(`${relative}: должен быть файлом`);
}
for (const relative of requiredDirectories) {
  const stat = await exists(relative);
  if (!stat) errors.push(`${relative}: директория отсутствует`);
  else if (!stat.isDirectory()) errors.push(`${relative}: должен быть директорией`);
}
for (const relative of forbiddenFiles) {
  if (await exists(relative)) errors.push(`${relative}: найден устаревший или дублирующий файл`);
}

const packageJson = JSON.parse(await read('package.json'));
if (packageJson.version !== '3.11.0') errors.push(`package.json: ожидалась версия 3.11.0, получено ${packageJson.version}`);
if (packageJson.engines?.node !== '>=22.13.0') errors.push('package.json: Node.js должен быть указан как >=22.13.0.');
for (const script of ['start', 'test', 'check', 'admin:create', 'admin:password', 'cms:backup']) {
  if (!packageJson.scripts?.[script]) errors.push(`package.json: отсутствует script ${script}`);
}
if ((await read('VERSION')).trim() !== '3.11.0') errors.push('VERSION: ожидается 3.11.0.');
if (!(await read('Dockerfile')).startsWith('FROM node:24-alpine')) errors.push('Dockerfile: ожидается Node.js 24 Alpine.');

const requiredBlockTypes = [
  'hero-premium', 'hero-auto-dealers', 'auto-proof', 'auto-case-video', 'human-control', 'capabilities', 'collection-list', 'cases-slider', 'pricing', 'integrations',
  'agents', 'faq', 'cta', 'rich-text', 'text-image', 'stats', 'gallery', 'spacer',
];
const definitions = getBlockDefinitions();
const blockTypes = new Set(definitions.map((item) => item.type));
for (const type of requiredBlockTypes) if (!blockTypes.has(type)) errors.push(`Конструктор: отсутствует блок ${type}.`);
if (definitions.length !== blockTypes.size) errors.push('Конструктор: найдены дубли типов блоков.');
for (const definition of definitions) {
  if (!definition.label || !definition.category || !Array.isArray(definition.fields)) errors.push(`Конструктор: неполное описание блока ${definition.type}.`);
}

const server = await read('src/server.mjs');
const config = await read('src/config.mjs');
const database = await read('src/cms/database.mjs');
const auth = await read('src/cms/auth.mjs');
const adminRoutes = await read('src/cms/admin-routes.mjs');
const renderer = await read('src/cms/render.mjs');
const media = await read('src/cms/media.mjs');
const adminJs = await read('public/assets/admin/admin.js');
const adminHtml = await read('public/admin/index.html');
const heroJs = await read('public/assets/js/hero-globe.js');
const heroCss = await read('public/assets/css/hero-premium.css');
const publicCss = await read('public/assets/css/cms-public.css');
const mainJs = await read('public/assets/js/app.js');
const previewBuilder = await read('scripts/build-preview.mjs');

for (const marker of [
  "openCmsDatabase(runtimeConfig.dataDir, runtimeConfig.cms?.databasePath)",
  "renderCmsPage", "createAdminHandler", "'/assets/'", "'/uploads/'", "'/admin'",
  "'/api/leads'", "'/api/events'", "'/sitemap.xml'",
]) if (!server.includes(marker)) errors.push(`server.mjs: отсутствует ${marker}`);
if (!config.includes('CMS_SESSION_HOURS') || !config.includes('CMS_MAX_UPLOAD_MB') || !config.includes('CMS_LOGIN_ATTEMPTS_PER_15_MIN')) errors.push('config.mjs: отсутствуют настройки CMS.');

for (const marker of ['DatabaseSync', 'PRAGMA journal_mode = WAL', 'STRICT;', 'cms_pages', 'cms_content_items', 'cms_revisions', 'cms_media', 'cms_audit_log', 'seedIfEmpty()', 'backup(label']) {
  if (!database.includes(marker)) errors.push(`database.mjs: отсутствует ${marker}`);
}
for (const marker of ['crypto.scrypt', 'timingSafeEqual', 'HttpOnly', 'SameSite=Strict', "parts.push('Secure')", 'requireCsrf', 'sessionTtlMs']) {
  if (!auth.includes(marker)) errors.push(`auth.mjs: отсутствует ${marker}`);
}
for (const marker of ['/admin/api/login', '/admin/api/pages', '/admin/api/content', '/admin/api/media', '/admin/api/settings', "parts[2] === 'revisions'", '/admin/api/backup', 'requestIpHash']) {
  if (!adminRoutes.includes(marker)) errors.push(`admin-routes.mjs: отсутствует ${marker}`);
}
for (const marker of ["'image/png'", "'image/jpeg'", "'image/webp'", 'SVG из админки запрещён', 'rule.matches(buffer)', 'maxBytes']) {
  if (!media.includes(marker)) errors.push(`media.mjs: отсутствует ${marker}`);
}

for (const marker of ['data-globe-animation', 'renderCollectionList', 'renderCasesSlider', 'renderPricing', 'cases-showcase-shell', 'work-models-grid', 'work-comparison-table', 'renderIntegrations', 'renderFaq', '/assets/css/cms-public.css']) {
  if (!renderer.includes(marker)) errors.push(`render.mjs: отсутствует ${marker}`);
}
if (renderer.includes("'CaseStudy'")) errors.push('render.mjs: используется неподтверждённый тип schema.org CaseStudy; для кейса должен применяться WebPage.');
for (const marker of ['animationEnabled', 'prefers-reduced-motion', 'IntersectionObserver', 'ResizeObserver', 'data-premium-globe']) {
  if (!heroJs.includes(marker)) errors.push(`hero-globe.js: отсутствует ${marker}`);
}
if (renderer.includes('hero-flow-arrow')) errors.push('render.mjs: маршрут лида не должен содержать отдельные DOM-элементы стрелок.');
if (!heroCss.includes('.globe-label--crm { left: 6%; bottom: 15%;')) errors.push('hero-premium.css: подпись «Готовый лид в CRM» должна быть поднята до bottom: 15%.');
if (!heroCss.includes('ambient light can still reveal its rectangular') || !heroCss.includes('-webkit-mask-image: linear-gradient(90deg')) errors.push('hero-premium.css: отсутствует плавное смешивание Canvas-планеты со светлым фоном.');
if (!heroJs.includes('ambientRadius = radius * (colors.light ? 1.34 : 1.75)') || !heroJs.includes('edgeFeatherX')) errors.push('hero-globe.js: отсутствует ограничение светлого ambient-glow и затухание частиц по краям.');
if (!heroCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr));')) errors.push('hero-premium.css: маршрут лида должен иметь четыре равные колонки на desktop.');
if (!publicCss.includes('approved reference composition, v3.2.0') || !publicCss.includes('grid-template-columns: repeat(6, minmax(0, 1fr));')) errors.push('cms-public.css: отсутствует утверждённая шестиколоночная витрина возможностей v3.2.0.');
if (!renderer.includes('/assets/img/capabilities/') || !renderer.includes('data-capability-icon')) errors.push('render.mjs: отсутствуют премиальные SVG-иконки блока возможностей.');
if (!database.includes("run('design_version', '3.9.0')")) errors.push('database.mjs: отсутствует отметка design_version 3.9.0.');
if (!database.includes("run('design_version', '3.9.3')")) errors.push('database.mjs: отсутствует отметка design_version 3.9.3.');
if (!database.includes("run('design_version', '3.10.0')")) errors.push('database.mjs: отсутствует отметка design_version 3.10.0.');
if (!database.includes("run('design_version', '3.11.0')")) errors.push('database.mjs: отсутствует отметка design_version 3.11.0.');
if (!database.includes('migratePremiumCasesCarousel()') || !database.includes('migrateCaseShowcaseV34()') || !database.includes('migrateIntegratedCasesAndPricingV35()') || !database.includes('migrateCompactTrustStackV36()') || !database.includes('migrateAutoDealersLandingV37()') || !database.includes('migrateAutoDealersAuditV38()') || !database.includes('migrateAutoDealersHeroRefineV381()') || !database.includes('migrateAutoDealersDesignV390()') || !database.includes('migrateAutoDealersHeroConformanceV391()') || !database.includes('migrateAutoDealersHeroSeamlessV392()') || !database.includes('migrateAutoDealersLayeredHeroV393()') || !database.includes('migrateAutoDealersReferenceHeroV310()') || !database.includes('migrateAutoDealersClarityV311()') || !database.includes('requiredSlugs')) errors.push('database.mjs: отсутствует безопасная миграция дизайн-блоков до v3.11.0.');
if (!renderer.includes('data-case-carousel') || !renderer.includes('case-showcase-card')) errors.push('render.mjs: отсутствует премиальная разметка динамического слайдера кейсов.');
if (!publicCss.includes('v3.5.0 — frameless project carousel + premium work models') || !publicCss.includes('.cases-showcase-shell') || !publicCss.includes('.work-models-grid') || !publicCss.includes('.work-comparison-table')) errors.push('cms-public.css: отсутствуют открытая витрина кейсов и премиальные форматы работы v3.5.0.');
if (!mainJs.includes('initCaseCarousels()') || !mainJs.includes('case_slider_change') || !mainJs.includes('data-case-autoplay-toggle') || !mainJs.includes('--case-media-x') || !mainJs.includes('--case-tilt-x') || !mainJs.includes('case-showcase-pointer') || !mainJs.includes('data-plan-period-label')) errors.push('app.js: отсутствует интерактивная логика кейсов или переключателя форматов v3.5.0.');
for (const marker of ['integration-showcase', 'integration-logo-tile', 'agents-showcase', 'faq-showcase', 'contact-cta-panel', 'messenger-button']) {
  if (!renderer.includes(marker) && !publicCss.includes(marker)) errors.push(`v3.6.0: отсутствует ${marker}`);
}
if (!publicCss.includes('V3.6.0 — compact trust stack') || !publicCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr));')) errors.push('cms-public.css: отсутствует компактная композиция CRM / AI / FAQ v3.6.0.');
if (!publicCss.includes('V3.6.1 — approved AI icon scale and final CTA visual balance') || !publicCss.includes('grid-template-columns: 56px minmax(0, 1fr);') || !publicCss.includes('font-size: clamp(1.65rem, 2.05vw, 2.15rem);') || !publicCss.includes('width: 248px;')) errors.push('cms-public.css: отсутствуют утверждённые пропорции AI-иконок и финального CTA v3.6.1.');
const seed = await read('src/cms/seed.mjs');

for (const marker of ['renderAutoDealersHero', 'renderAutoProof', 'renderAutoCaseVideo', 'renderHumanControl', 'auto-hero', 'auto-proof-section', 'auto-case-video-section', 'human-control-section']) {
  if (!renderer.includes(marker) && !publicCss.includes(marker)) errors.push(`v3.8.0: отсутствует ${marker}`);
}
if (!seed.includes("slug: 'auto-dealers'") || !seed.includes("block('hero-auto-dealers')") || !seed.includes("block('auto-proof'") || !seed.includes("block('auto-case-video'") || !seed.includes("variant: 'overview-v39'")) errors.push('seed.mjs: отсутствует компактная нишевая страница автодилеров v3.9.0.');
for (const slug of ['auto-commercial-vehicles', 'auto-motorcycles', 'auto-service']) {
  if (!seed.includes(`slug: '${slug}'`)) errors.push(`seed.mjs: отсутствует автокейс ${slug}.`);
}
if (!mainJs.includes('data-auto-hero') || !mainJs.includes('data-auto-hero-canvas') || !mainJs.includes('--badge-parallax-x') || !mainJs.includes('data-video-facade') || !mainJs.includes('video_view')) errors.push('app.js: отсутствуют layered-parallax автогероя или ленивый видеоплеер.');
if (!publicCss.includes('V3.8.0 — full UX/UI and conversion pass') || !publicCss.includes('.auto-proof-note')) errors.push('cms-public.css: отсутствует UX/UI-проход автодилерского лендинга v3.8.0.');
if (!renderer.includes('Компания / дилерский центр') || !renderer.includes('dealer-case-grid')) errors.push('render.mjs: отсутствуют нишевая форма или витрина кейсов v3.9.0.');

if (!publicCss.includes('V3.8.1 — compact automotive hero, frameless visual and metric callouts') || !publicCss.includes('border: none;') || !publicCss.includes('overflow: visible;')) errors.push('cms-public.css: отсутствует безрамочная композиция автогероя v3.8.1.');
if (!seed.includes("slug: 'auto-dealers'") || !(await read('src/cms/block-definitions.mjs')).includes("titleLine1: 'Приводим целевых тёплых лидов'") || !(await read('src/cms/block-definitions.mjs')).includes("{ title: '+50%', text: 'лидов за 14 дней'")) errors.push('v3.11.0: отсутствуют ясный оффер или ключевые преимущества автодилеров.');

if (!publicCss.includes('V3.9.0 — auto dealer landing redesign') || !publicCss.includes('.auto-overview-v39') || !publicCss.includes('.dealer-case-grid') || !publicCss.includes('.dealer-contact-v39')) errors.push('cms-public.css: отсутствует цельная композиция автодилерского лендинга v3.9.0.');
if (!publicCss.includes('V3.9.3 — auto-dealer hero as layered scene, no framed banner') || !publicCss.includes('.auto-hero-data-canvas') || !publicCss.includes('.auto-hero-car')) errors.push('cms-public.css: отсутствует многослойная безрамочная композиция первого экрана v3.9.3.');
if (!publicCss.includes('V3.10.0 - auto dealer hero reference conformance') || !publicCss.includes('.auto-hero-v310') || !publicCss.includes('.auto-hero-sparkline')) errors.push('cms-public.css: отсутствует эталонная композиция первого экрана v3.10.0.');
if (!publicCss.includes('V3.11.0 - clearer automotive offer and calmer reading rhythm') || !publicCss.includes('.auto-hero-advantages') || !publicCss.includes('.work-comparison { display: none; }')) errors.push('cms-public.css: отсутствует упрощённая композиция автодилерской страницы v3.11.0.');
if (!renderer.includes('auto-hero-v393') || !renderer.includes('auto-metrics-v39') || !renderer.includes('dealer-loop-card')) errors.push('render.mjs: отсутствует новая разметка автодилерской страницы v3.9.0.');

if (!server.includes("frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com")) errors.push('server.mjs: CSP не разрешает безопасные фасад-видео YouTube/Vimeo.');
for (const slug of ['auto-new-cars', 'auto-used-cars', 'equipment-leasing', 'modular-buildings', 'industrial-equipment', 'cloud-infrastructure', 'logistics-company', 'fintech-platform']) {
  if (!seed.includes(`slug: '${slug}'`)) errors.push(`seed.mjs: отсутствует демонстрационный кейс ${slug}.`);
}
if (!previewBuilder.includes(".replace('</body>', () =>") || !previewBuilder.includes('(function(){')) errors.push('build-preview.mjs: браузерные скрипты автономного предпросмотра должны быть изолированы в IIFE.');

for (const marker of ['.hero-premium', '.hero-visual-premium', '.premium-globe-canvas', 'html[data-theme="light"]']) {
  if (!heroCss.includes(marker) && !publicCss.includes(marker)) errors.push(`Стили: отсутствует ${marker}`);
}
for (const marker of ['initTheme()', "fetch('/api/leads'", 'initCaseCarousels()', 'initSliders()', 'initFaq()', 'initReveal()']) {
  if (!mainJs.includes(marker)) errors.push(`app.js: отсутствует ${marker}`);
}

for (const marker of ['data-view="pages"', 'data-view="content"', 'data-view="media"', 'data-view="settings"', 'data-page-builder', 'data-content-builder']) {
  if (!adminHtml.includes(marker)) errors.push(`admin/index.html: отсутствует ${marker}`);
}
for (const marker of ['dragstart', 'data-block-copy', 'data-repeater-copy', 'data-nav-up', 'data-footer-column-up', 'data-footer-link-up', 'chooseMedia()', '/admin/api/settings/publish']) {
  if (!adminJs.includes(marker)) errors.push(`admin.js: отсутствует ${marker}`);
}

const syntaxFiles = [
  'src/server.mjs', 'src/config.mjs', 'src/cms/admin-routes.mjs', 'src/cms/auth.mjs',
  'src/cms/block-definitions.mjs', 'src/cms/database.mjs', 'src/cms/media.mjs',
  'src/cms/render.mjs', 'src/cms/seed.mjs', 'public/assets/admin/admin.js',
  'public/assets/js/app.js', 'public/assets/js/hero-globe.js',
  'scripts/create-admin.mjs', 'scripts/backup-cms.mjs', 'scripts/check-project.mjs',
];
for (const relative of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`${relative}: синтаксическая ошибка: ${(result.stderr || result.stdout).trim()}`);
}

const cssAssets = `${await read('public/assets/css/styles.css')}\n${heroCss}\n${publicCss}`;
for (const match of cssAssets.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)) {
  const relative = `public${match[1]}`;
  if (!(await exists(relative))) errors.push(`CSS: не найден ресурс ${match[1]}`);
}

const textExtensions = new Set(['.mjs', '.js', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.example', '.ps1', '.cmd', '.conf']);
const secretPatterns = [
  /(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9._-]{16,}/i,
  /^(?:TELEGRAM_BOT_TOKEN|LEAD_WEBHOOK_TOKEN)[ \t]*=[ \t]*[^ \t\r\n#]{12,}/im,
  /bot\d{8,}:[A-Za-z0-9_-]{20,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
async function walk(directory) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'data', 'logs'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(full));
    else results.push(full);
  }
  return results;
}
for (const file of await walk(root)) {
  const ext = path.extname(file).toLowerCase();
  if (!textExtensions.has(ext) && !file.endsWith('.env.example') && !file.endsWith('Caddyfile') && !file.endsWith('Dockerfile')) continue;
  const contents = await fs.readFile(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(contents)) errors.push(`${path.relative(root, file)}: обнаружена строка, похожая на секрет.`);
  }
}

if (!adminJs.includes("['image/png', 'image/jpeg', 'image/webp']")) warnings.push('В админке не найден клиентский список допустимых форматов; серверная проверка всё равно включена.');
if (!renderer.includes('noindex,nofollow')) errors.push('Предпросмотр черновика должен закрываться от индексации.');

if (errors.length) {
  console.error(`Project check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Project check passed: CMS core, ${definitions.length} block types, admin builder, security controls, local assets and secret scan are OK.`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
