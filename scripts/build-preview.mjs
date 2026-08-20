import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCmsDatabase } from '../src/cms/database.mjs';
import { renderCmsPage } from '../src/cms/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedRoute = process.argv[2] || '/';
const requestedOutput = process.argv[3] || 'PREVIEW_STATIC.html';
const publicDir = path.join(root, 'public');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vionex-preview-'));
let db;

try {
  db = openCmsDatabase(tempDir);
  let entity = db.getPageByRoute(requestedRoute, { publishedOnly: true });
  if (!entity) {
    const match = requestedRoute.match(/^\/(services|cases|blog)\/([^/]+)$/);
    const kindMap = { services: 'service', cases: 'case', blog: 'article' };
    if (match) entity = db.getContentBySlug(kindMap[match[1]], match[2], { publishedOnly: true });
  }
  if (!entity) throw new Error(`Preview route not found: ${requestedRoute}`);
  const settings = db.getSettings('site', { published: true });
  const publicConfig = {
    mode: 'demo',
    baseUrl: 'https://vionex.ru',
    siteName: 'VIONEX LEADS',
    shortName: 'VIONEX',
    tagline: 'Управляемая B2B-лидогенерация под ключ',
    phone: '',
    email: '',
    telegramUrl: '',
    calendarUrl: '',
    responseTime: 'Свяжемся в рабочее время после проверки задачи',
    companyLegalName: '',
    companyTaxId: '',
    companyRegistrationId: '',
    companyAddress: '',
    privacyEmail: '',
    retentionDays: 365,
  };
  const context = { route: requestedRoute, getPublishedContent: (kind, limit) => db.listPublishedContent(kind, limit) };
  let html = renderCmsPage({ entity, document: entity.published, settings, publicConfig, nonce: 'static-preview', context });

  let css = '';
  for (const relative of ['assets/css/styles.css', 'assets/css/hero-premium.css', 'assets/css/cms-public.css']) {
    css += `\n/* ${relative} */\n${await fs.readFile(path.join(publicDir, relative), 'utf8')}\n`;
  }
  const appJs = await fs.readFile(path.join(publicDir, 'assets/js/app.js'), 'utf8');
  const heroJs = await fs.readFile(path.join(publicDir, 'assets/js/hero-globe.js'), 'utf8');

  const mime = {
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  };
  const assetRefs = new Set([
    ...html.matchAll(/\/assets\/[A-Za-z0-9_./-]+/g),
    ...css.matchAll(/\/assets\/[A-Za-z0-9_./-]+/g),
  ].map((match) => match[0]).filter((value) => !value.endsWith('.css') && !value.endsWith('.js')));

  for (const ref of assetRefs) {
    const filePath = path.join(publicDir, ref.replace(/^\/assets\//, 'assets/'));
    try {
      const buffer = await fs.readFile(filePath);
      const type = mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const dataUri = `data:${type};base64,${buffer.toString('base64')}`;
      html = html.replaceAll(ref, dataUri);
      css = css.replaceAll(ref, dataUri);
    } catch {
      // Dynamic media from /uploads is intentionally not part of the portable preview.
    }
  }

  const routeMap = new Map([
    ['/', '#top'], ['/services', '#capabilities'], ['/services/lead-generation', '#capabilities'], ['/services/auto-dealers', '#top'],
    ['/cases', '#cases'], ['/blog', '#faq'], ['/privacy', '#contact'], ['/sitemap.xml', '#top'],
  ]);
  html = html.replace(/href="(\/[^"#?]*)(#[^"]*)?"/g, (match, pathname, hash = '') => {
    if (pathname.startsWith('/assets/') || pathname.startsWith('/uploads/')) return match;
    if (hash && pathname === '/') return `href="${hash}"`;
    return `href="${routeMap.get(pathname) || '#top'}"`;
  });

  html = html
    .replace(`<body data-site-mode="demo" data-page="${requestedRoute}">`, `<body data-site-mode="demo" data-page="${requestedRoute}" data-preview="true">`)
    .replace(/\s*<link rel="stylesheet" href="\/assets\/css\/styles\.css">/, '')
    .replace(/\s*<link rel="stylesheet" href="\/assets\/css\/hero-premium\.css">/, '')
    .replace(/\s*<link rel="stylesheet" href="\/assets\/css\/cms-public\.css">/, '')
    .replace(/\s*<script src="\/assets\/js\/app\.js" type="module" defer><\/script>/, '')
    .replace(/\s*<script src="\/assets\/js\/hero-globe\.js" type="module" defer><\/script>/, '')
    .replace('</head>', `<style>${css}</style></head>`)
    .replace('</body>', () => `<script>(function(){\n${appJs}\n})();<\/script><script>(function(){\n${heroJs}\n})();<\/script></body>`);

  const output = path.join(root, requestedOutput);
  await fs.writeFile(output, html, 'utf8');
  console.log(`Static CMS preview created: ${output}`);
} finally {
  try { db?.close(); } catch {}
  await fs.rm(tempDir, { recursive: true, force: true });
}
