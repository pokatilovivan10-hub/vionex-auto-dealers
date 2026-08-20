import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as defaultConfig, validateProductionConfig } from './config.mjs';
import { deliverLead, startOutboxWorker } from './delivery.mjs';
import { startRetentionWorker } from './retention.mjs';
import { appendJsonLine, dataFile, ensureDataDir } from './storage.mjs';
import { validateEvent, validateLead } from './validation.mjs';
import { createAdminHandler } from './cms/admin-routes.mjs';
import { openCmsDatabase } from './cms/database.mjs';
import { renderCmsPage } from './cms/render.mjs';

const APP_VERSION = '3.10.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const HTML_REDIRECTS = Object.freeze({
  '/index.html': '/',
  '/services.html': '/services',
  '/service-lead-generation.html': '/services/lead-generation',
  '/cases.html': '/cases',
  '/case-modular-buildings.html': '/cases/modular-buildings',
  '/blog.html': '/blog',
  '/blog-b2b-lead-generation.html': '/blog/kak-vystroit-b2b-lidogeneraciyu',
  '/privacy.html': '/privacy',
});

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeJsonForHtml(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function displayOrPlaceholder(value, placeholder = 'Не указано — заполните .env') {
  return value || placeholder;
}

function currentDateRu() {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(new Date());
}

function buildFallbackStructuredData(publicConfig, pageKey = 'notFound') {
  const definition = {
    notFound: { type: 'WebPage', name: 'Страница не найдена', path: '/404', description: 'Страница не найдена.' },
  }[pageKey] || { type: 'WebPage', name: publicConfig.siteName, path: '/', description: publicConfig.tagline };
  const url = `${publicConfig.baseUrl}${definition.path}`;
  return safeJsonForHtml({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${publicConfig.baseUrl}/#organization`,
        name: publicConfig.siteName,
        url: `${publicConfig.baseUrl}/`,
        logo: `${publicConfig.baseUrl}/assets/img/og-cover.png`,
      },
      {
        '@type': definition.type,
        '@id': `${url}#page`,
        url,
        name: definition.name,
        description: definition.description,
        inLanguage: 'ru-RU',
      },
    ],
  });
}

async function loadFallbackTemplate() {
  return fs.readFile(path.join(publicDir, '404.html'), 'utf8');
}

function renderFallbackTemplate(template, publicConfig, nonce) {
  const values = {
    SITE_NAME: publicConfig.siteName,
    SHORT_NAME: publicConfig.shortName,
    TAGLINE: publicConfig.tagline,
    BASE_URL: publicConfig.baseUrl,
    RESPONSE_TIME: publicConfig.responseTime,
    SITE_MODE: publicConfig.mode,
    NONCE: nonce,
    STRUCTURED_DATA: buildFallbackStructuredData(publicConfig),
    CURRENT_DATE: currentDateRu(),
    COMPANY_LEGAL_NAME: displayOrPlaceholder(publicConfig.companyLegalName),
    COMPANY_TAX_ID: displayOrPlaceholder(publicConfig.companyTaxId),
    COMPANY_REGISTRATION_ID: displayOrPlaceholder(publicConfig.companyRegistrationId),
    COMPANY_ADDRESS: displayOrPlaceholder(publicConfig.companyAddress),
    PRIVACY_EMAIL: displayOrPlaceholder(publicConfig.privacyEmail, 'privacy@example.ru'),
    RETENTION_DAYS: publicConfig.retentionDays,
    DEMO_WARNING_CLASS: publicConfig.mode === 'production' ? 'is-hidden' : '',
  };
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in values)) return match;
    if (key === 'STRUCTURED_DATA') return String(values[key]);
    return escapeHtml(values[key]);
  });
}

function makeLeadId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VL-${date}-${suffix}`;
}

function cspHeader(nonce, isProduction) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ];
  if (isProduction) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function createLogger(runtimeConfig) {
  const weights = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
  const threshold = weights[runtimeConfig.logLevel] ?? weights.info;
  const write = (level, details, message) => {
    if ((weights[level] ?? 20) < threshold) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      service: 'vionex-leads-site',
      version: APP_VERSION,
      message: typeof message === 'string' ? message : String(details || ''),
      ...(details && typeof details === 'object' && !Array.isArray(details) ? details : {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
  return {
    debug: (details, message) => write('debug', details, message),
    info: (details, message) => write('info', details, message),
    warn: (details, message) => write('warn', details, message),
    error: (details, message) => write('error', details, message),
  };
}

function setSecurityHeaders(res, nonce, runtimeConfig) {
  res.setHeader('Content-Security-Policy', cspHeader(nonce, runtimeConfig.isProduction));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Origin-Agent-Cluster', '?1');
  if (runtimeConfig.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function send(res, requestMethod, statusCode, body, contentType, headers = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (requestMethod === 'HEAD') return res.end();
  return res.end(buffer);
}

function sendJson(res, requestMethod, statusCode, value, headers = {}) {
  return send(res, requestMethod, statusCode, JSON.stringify(value), 'application/json; charset=utf-8', headers);
}

function createRateLimiter(windowMs, limit) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  };
}

function rateLimitKey(req, runtimeConfig, scope) {
  let address = req.socket.remoteAddress || 'unknown';
  if (runtimeConfig.trustProxy > 0) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) address = forwarded;
  }
  const hash = crypto.createHash('sha256').update(address).digest('hex').slice(0, 24);
  return `${scope}:${hash}`;
}

function applyRateLimit(req, res, runtimeConfig, limiter, scope) {
  const result = limiter(rateLimitKey(req, runtimeConfig, scope));
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(result.resetSeconds));
  if (result.allowed) return true;
  res.setHeader('Retry-After', String(result.resetSeconds));
  sendJson(res, req.method, 429, { ok: false, message: 'Слишком много попыток. Повторите позже.' });
  return false;
}

async function readJsonBody(req, maxBytes = 32 * 1024) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    const error = new Error('Content-Type must be application/json.');
    error.statusCode = 415;
    throw error;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
  } catch {
    const error = new Error('Invalid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function isAllowedOrigin(req, runtimeConfig) {
  const origin = String(req.headers.origin || '');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(runtimeConfig.public.baseUrl).origin;
  } catch {
    return false;
  }
}

async function serveFileFromRoot(req, res, pathname, routePrefix, rootDir, cacheControl) {
  const relative = pathname.slice(routePrefix.length);
  const root = path.resolve(rootDir);
  const fullPath = path.resolve(root, relative);
  if (!fullPath.startsWith(`${root}${path.sep}`)) return false;
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return false;
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', cacheControl);
      res.end();
      return true;
    }
    const body = await fs.readFile(fullPath);
    const contentType = MIME_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
    send(res, req.method, 200, body, contentType, { 'Cache-Control': cacheControl, ETag: etag });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return false;
    throw error;
  }
}

function publishedSettings(cmsDb) {
  return cmsDb.getSettings('site', { published: true }) || cmsDb.getSettings('site', { published: false }) || {};
}

function effectivePublicConfig(runtimeConfig, settings = {}) {
  const contact = settings?.contact || {};
  const legal = settings?.legal || {};
  const pick = (cmsValue, fallback) => String(cmsValue || '').trim() || fallback;
  return {
    ...runtimeConfig.public,
    siteName: [settings.brandName, settings.brandAccent].filter(Boolean).join(' ').trim() || runtimeConfig.public.siteName,
    tagline: pick(settings.tagline, runtimeConfig.public.tagline),
    phone: pick(contact.phone, runtimeConfig.public.phone),
    email: pick(contact.email, runtimeConfig.public.email),
    telegramUrl: pick(contact.telegramUrl, runtimeConfig.public.telegramUrl),
    calendarUrl: pick(contact.calendarUrl, runtimeConfig.public.calendarUrl),
    responseTime: pick(contact.responseTime, runtimeConfig.public.responseTime),
    companyLegalName: pick(legal.companyLegalName, runtimeConfig.public.companyLegalName),
    companyTaxId: pick(legal.companyTaxId, runtimeConfig.public.companyTaxId),
    companyRegistrationId: pick(legal.companyRegistrationId, runtimeConfig.public.companyRegistrationId),
    companyAddress: pick(legal.companyAddress, runtimeConfig.public.companyAddress),
    privacyEmail: pick(legal.privacyEmail, runtimeConfig.public.privacyEmail),
  };
}

function contentRoute(pathname) {
  const match = pathname.match(/^\/(services|cases|blog)\/([a-z0-9-]+)$/);
  if (!match) return null;
  const kind = { services: 'service', cases: 'case', blog: 'post' }[match[1]];
  return { kind, slug: match[2] };
}

function publicRenderContext(cmsDb) {
  return {
    getPublishedContent(kind, limit = 50) {
      return cmsDb.listPublishedContent(kind, limit);
    },
  };
}

function publicConfigResponse(runtimeConfig, settings = {}) {
  const publicConfig = effectivePublicConfig(runtimeConfig, settings);
  return {
    ok: true,
    siteName: publicConfig.siteName,
    shortName: runtimeConfig.public.shortName,
    phone: publicConfig.phone,
    email: publicConfig.email,
    telegramUrl: publicConfig.telegramUrl,
    calendarUrl: publicConfig.calendarUrl,
    responseTime: publicConfig.responseTime,
    legalSummary: [publicConfig.companyLegalName, publicConfig.companyTaxId].filter(Boolean).join(' · '),
    mode: runtimeConfig.mode,
  };
}

function sitemapEntries(cmsDb) {
  const entries = new Map();
  for (const page of cmsDb.listPages()) {
    if (!page.published) continue;
    entries.set(page.route, {
      route: page.route,
      changefreq: page.route === '/' ? 'weekly' : (page.route === '/blog' ? 'weekly' : 'monthly'),
      priority: page.route === '/' ? '1.0' : (page.route === '/privacy' ? '0.2' : '0.8'),
      lastmod: page.publishedAt || page.updatedAt,
    });
  }
  for (const [kind, prefix] of [['service', '/services/'], ['case', '/cases/'], ['post', '/blog/']]) {
    for (const item of cmsDb.listPublishedContent(kind, 1000)) {
      entries.set(`${prefix}${item.slug}`, {
        route: `${prefix}${item.slug}`,
        changefreq: kind === 'post' ? 'monthly' : 'monthly',
        priority: kind === 'service' ? '0.9' : '0.7',
        lastmod: item.publishedAt || item.updatedAt,
      });
    }
  }
  return [...entries.values()].sort((a, b) => a.route.localeCompare(b.route));
}

export async function createApp(options = {}) {
  const runtimeConfig = options.config || defaultConfig;
  const logger = options.logger || createLogger(runtimeConfig);
  const notFoundTemplate = await loadFallbackTemplate();
  await ensureDataDir(runtimeConfig.dataDir);
  await fs.mkdir(path.join(runtimeConfig.dataDir, 'uploads'), { recursive: true, mode: 0o750 });
  await fs.mkdir(path.join(runtimeConfig.dataDir, 'backups'), { recursive: true, mode: 0o750 });

  const cmsDb = openCmsDatabase(runtimeConfig.dataDir, runtimeConfig.cms?.databasePath);
  const adminHandler = await createAdminHandler({ db: cmsDb, runtimeConfig, logger });
  const formLimiter = createRateLimiter(15 * 60 * 1000, runtimeConfig.formRateLimit);
  const eventLimiter = createRateLimiter(60 * 1000, runtimeConfig.eventRateLimit);

  let cmsClosed = false;
  const closeCms = () => {
    if (cmsClosed) return;
    cmsClosed = true;
    try { cmsDb.close(); } catch {}
  };

  const handler = async (req, res) => {
    const started = performance.now();
    const nonce = crypto.randomBytes(16).toString('base64');
    setSecurityHeaders(res, nonce, runtimeConfig);
    res.setHeader('X-Request-Id', crypto.randomUUID());
    res.once('finish', () => {
      logger.info({
        method: req.method,
        path: String(req.url || '').split('?')[0],
        statusCode: res.statusCode,
        durationMs: Math.round((performance.now() - started) * 10) / 10,
      }, 'HTTP request');
    });

    let url;
    try {
      url = new URL(req.url || '/', runtimeConfig.public.baseUrl);
    } catch {
      return sendJson(res, req.method, 400, { ok: false, message: 'Некорректный адрес запроса.' });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJson(res, req.method, 400, { ok: false, message: 'Некорректный адрес запроса.' });
    }
    const isRead = req.method === 'GET' || req.method === 'HEAD';

    if (isRead && pathname === '/health') {
      return sendJson(res, req.method, 200, {
        ok: true,
        service: 'vionex-leads-site',
        version: APP_VERSION,
        mode: runtimeConfig.mode,
        cms: true,
      }, { 'Cache-Control': 'no-store' });
    }

    if (isRead && pathname.startsWith('/assets/')) {
      if (await serveFileFromRoot(req, res, pathname, '/assets/', path.join(publicDir, 'assets'), 'public, max-age=3600')) return undefined;
    }

    if (isRead && pathname.startsWith('/uploads/')) {
      if (await serveFileFromRoot(req, res, pathname, '/uploads/', path.join(runtimeConfig.dataDir, 'uploads'), 'public, max-age=86400')) return undefined;
    }

    if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (await adminHandler(req, res, url, nonce)) return undefined;
    }

    if (isRead && pathname === '/api/public-config') {
      return sendJson(res, req.method, 200, publicConfigResponse(runtimeConfig, publishedSettings(cmsDb)), { 'Cache-Control': 'public, max-age=300' });
    }

    if (req.method === 'POST' && pathname === '/api/leads') {
      if (!isAllowedOrigin(req, runtimeConfig)) return sendJson(res, req.method, 403, { ok: false, message: 'Недопустимый источник запроса.' });
      if (!applyRateLimit(req, res, runtimeConfig, formLimiter, 'lead')) return undefined;
      const body = await readJsonBody(req);
      const validation = validateLead(body, { minFillMs: runtimeConfig.minFormFillMs });
      if (!validation.ok) {
        logger.info({ fields: Object.keys(validation.errors) }, 'Lead form validation failed');
        return sendJson(res, req.method, 422, { ok: false, message: 'Проверьте заполнение формы.', errors: validation.errors });
      }

      const input = validation.value;
      const record = {
        id: makeLeadId(),
        createdAt: new Date().toISOString(),
        name: input.name,
        phone: input.phone,
        email: input.email,
        company: input.company,
        role: input.role,
        goal: input.goal,
        monthlyTarget: input.monthlyTarget,
        comment: input.comment,
        consent: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          policyUrl: `${runtimeConfig.public.baseUrl}/privacy`,
        },
        meta: input.meta,
      };

      await appendJsonLine(dataFile(runtimeConfig.dataDir, 'leads.ndjson'), record);
      logger.info({ leadId: record.id, goal: record.goal }, 'Lead stored locally');
      void deliverLead(record, runtimeConfig, logger).catch((error) => {
        logger.error({ leadId: record.id, error: error.message }, 'Unexpected delivery error');
      });
      return sendJson(res, req.method, 201, { ok: true, leadId: record.id, message: 'Заявка принята.' });
    }

    if (req.method === 'POST' && pathname === '/api/events') {
      if (!isAllowedOrigin(req, runtimeConfig)) return send(res, req.method, 204, '', 'text/plain; charset=utf-8');
      if (!applyRateLimit(req, res, runtimeConfig, eventLimiter, 'event')) return undefined;
      const body = await readJsonBody(req);
      const validation = validateEvent(body);
      if (!validation.ok) return send(res, req.method, 204, '', 'text/plain; charset=utf-8');
      await appendJsonLine(dataFile(runtimeConfig.dataDir, 'events.ndjson'), {
        at: new Date().toISOString(),
        ...validation.value,
      });
      return send(res, req.method, 204, '', 'text/plain; charset=utf-8');
    }

    if (pathname.startsWith('/api/')) {
      res.setHeader('Allow', pathname === '/api/public-config' ? 'GET, HEAD' : 'POST');
      return sendJson(res, req.method, 405, { ok: false, message: 'Метод не поддерживается.' });
    }

    if (isRead && pathname === '/robots.txt') {
      return send(res, req.method, 200, [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin',
        `Sitemap: ${runtimeConfig.public.baseUrl}/sitemap.xml`,
        '',
      ].join('\n'), 'text/plain; charset=utf-8', { 'Cache-Control': 'public, max-age=3600' });
    }

    if (isRead && pathname === '/sitemap.xml') {
      const base = escapeXml(runtimeConfig.public.baseUrl.replace(/\/$/, ''));
      const urls = sitemapEntries(cmsDb).map((entry) => {
        const lastmod = entry.lastmod ? `<lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>` : '';
        return `  <url><loc>${base}${escapeXml(entry.route)}</loc>${lastmod}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      return send(res, req.method, 200, xml, 'application/xml; charset=utf-8', { 'Cache-Control': 'public, max-age=3600' });
    }

    if (isRead && HTML_REDIRECTS[pathname]) {
      res.statusCode = 301;
      res.setHeader('Location', HTML_REDIRECTS[pathname]);
      res.setHeader('Content-Length', '0');
      return res.end();
    }

    if (isRead && pathname.length > 1 && pathname.endsWith('/')) {
      res.statusCode = 301;
      res.setHeader('Location', pathname.replace(/\/+$/, '') + url.search);
      res.setHeader('Content-Length', '0');
      return res.end();
    }

    if (isRead) {
      const settings = publishedSettings(cmsDb);
      const publicConfig = effectivePublicConfig(runtimeConfig, settings);
      const context = publicRenderContext(cmsDb);
      const page = cmsDb.getPageByRoute(pathname, { publishedOnly: true });
      if (page?.published) {
        return send(res, req.method, 200, renderCmsPage({
          entity: page,
          document: page.published,
          settings,
          publicConfig,
          nonce,
          context,
        }), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
      }

      const route = contentRoute(pathname);
      if (route) {
        const item = cmsDb.getContentBySlug(route.kind, route.slug, { publishedOnly: true });
        if (item?.published) {
          return send(res, req.method, 200, renderCmsPage({
            entity: item,
            document: item.published,
            settings,
            publicConfig,
            nonce,
            context,
          }), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
        }
      }
    }

    return send(res, req.method, 404, renderFallbackTemplate(notFoundTemplate, runtimeConfig.public, nonce), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
  };

  const app = (req, res) => {
    handler(req, res).catch((error) => {
      logger.error({ error: error.message, statusCode: error.statusCode || 500 }, 'Unhandled request error');
      if (res.headersSent) return res.destroy();
      const statusCode = Number(error.statusCode) || 500;
      const message = statusCode >= 500 ? 'Внутренняя ошибка сервера.' : error.message;
      return sendJson(res, req.method, statusCode, { ok: false, message });
    });
  };

  app.createServer = () => {
    const server = http.createServer(app);
    server.headersTimeout = 10_000;
    server.requestTimeout = 30_000;
    server.keepAliveTimeout = 5_000;
    server.maxRequestsPerSocket = 100;
    server.once('close', closeCms);
    return server;
  };
  app.listen = (...args) => app.createServer().listen(...args);

  return { app, logger, runtimeConfig, cmsDb, db: cmsDb, closeCms };
}

async function main() {
  const errors = validateProductionConfig(defaultConfig);
  if (errors.length) {
    console.error(`Production configuration is incomplete:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }

  const { app, logger, runtimeConfig } = await createApp();
  const stopOutbox = startOutboxWorker(runtimeConfig, logger);
  const stopRetention = startRetentionWorker(runtimeConfig, logger);
  const server = app.listen(runtimeConfig.port, runtimeConfig.host, () => {
    logger.info({ port: runtimeConfig.port, mode: runtimeConfig.mode, baseUrl: runtimeConfig.public.baseUrl, cms: true }, 'VIONEX LEADS website started');
  });

  const shutdown = (signal) => {
    logger.info({ signal }, 'Graceful shutdown started');
    stopOutbox();
    stopRetention();
    server.close((error) => {
      if (error) {
        logger.error({ error: error.message }, 'Shutdown failed');
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
