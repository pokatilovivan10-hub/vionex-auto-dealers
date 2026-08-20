import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBlockDefinitions } from './block-definitions.mjs';
import { clearSessionCookie, createSession, destroySession, getSession, publicUser, requestIpHash, requireCsrf, sessionCookie, verifyPassword } from './auth.mjs';
import { decodeMediaPayload, removeStoredMedia, storeMedia } from './media.mjs';
import { renderCmsPage } from './render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const adminHtmlPath = path.join(projectRoot, 'public', 'admin', 'index.html');

function send(res, method, statusCode, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  if (method === 'HEAD') return res.end();
  return res.end(buffer);
}

function json(res, method, statusCode, value, headers = {}) {
  return send(res, method, statusCode, JSON.stringify(value), 'application/json; charset=utf-8', headers);
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
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
      const error = new Error('Тело запроса слишком большое.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {
    const error = new Error('Некорректный JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function sameOrigin(req, runtimeConfig) {
  const origin = String(req.headers.origin || '');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(runtimeConfig.public.baseUrl).origin; } catch { return false; }
}

function cleanSettings(input) {
  const site = input && typeof input === 'object' ? input : {};
  const cleanText = (value, max = 500) => String(value ?? '').replaceAll('\u0000', '').trim().slice(0, max);
  const cleanHref = (value) => cleanText(value, 500);
  const navigation = Array.isArray(site.navigation) ? site.navigation.slice(0, 12).map((item) => ({ label: cleanText(item.label, 80), href: cleanHref(item.href) })).filter((item) => item.label) : [];
  const footerColumns = Array.isArray(site.footerColumns) ? site.footerColumns.slice(0, 5).map((column) => ({
    title: cleanText(column.title, 80),
    links: Array.isArray(column.links) ? column.links.slice(0, 10).map((link) => ({ label: cleanText(link.label, 100), href: cleanHref(link.href) })).filter((link) => link.label) : [],
  })) : [];
  return {
    brandName: cleanText(site.brandName || 'VIONEX', 80),
    brandAccent: cleanText(site.brandAccent || 'LEADS', 80),
    defaultTheme: site.defaultTheme === 'light' ? 'light' : 'dark',
    tagline: cleanText(site.tagline, 300),
    contact: {
      phone: cleanText(site.contact?.phone, 80),
      email: cleanText(site.contact?.email, 200),
      telegramUrl: cleanHref(site.contact?.telegramUrl),
      calendarUrl: cleanHref(site.contact?.calendarUrl),
      responseTime: cleanText(site.contact?.responseTime, 300),
    },
    legal: {
      companyLegalName: cleanText(site.legal?.companyLegalName, 300),
      companyTaxId: cleanText(site.legal?.companyTaxId, 100),
      companyRegistrationId: cleanText(site.legal?.companyRegistrationId, 100),
      companyAddress: cleanText(site.legal?.companyAddress, 500),
      privacyEmail: cleanText(site.legal?.privacyEmail, 200),
    },
    navigation,
    headerButton: { label: cleanText(site.headerButton?.label || 'Обсудить проект', 100), goal: cleanText(site.headerButton?.goal || 'audit', 80) },
    footerDescription: cleanText(site.footerDescription, 1000),
    footerColumns,
  };
}

function routeParts(pathname) {
  return pathname.split('/').filter(Boolean);
}

function createLoginLimiter(maxAttempts = 10) {
  const attempts = new Map();
  return (key) => {
    const now = Date.now();
    const current = attempts.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 15 * 60 * 1000 } : current;
    bucket.count += 1;
    attempts.set(key, bucket);
    return { allowed: bucket.count <= maxAttempts, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  };
}

async function readRecentLeads(dataDir, limit = 100) {
  try {
    const text = await fs.readFile(path.join(dataDir, 'leads.ndjson'), 'utf8');
    return text.trim().split(/\r?\n/).filter(Boolean).slice(-limit).reverse().map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function createAdminHandler({ db, runtimeConfig, logger }) {
  let adminHtml = await fs.readFile(adminHtmlPath, 'utf8');
  const loginLimit = createLoginLimiter(runtimeConfig.cms?.loginAttemptsPer15Min || 10);

  return async function handleAdmin(req, res, url, nonce) {
    const pathname = decodeURIComponent(url.pathname);
    if (!(pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/'))) return false;

    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/admin' || pathname === '/admin/')) {
      return send(res, req.method, 200, adminHtml.replaceAll('{{NONCE}}', nonce), 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' }), true;
    }

    const parts = routeParts(pathname);
    if (parts[1] === 'preview') {
      const session = getSession(db, req, runtimeConfig);
      if (!session) return send(res, req.method, 401, 'Требуется вход в админку.'), true;
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, req.method, 405, { ok: false, message: 'Метод не поддерживается.' }), true;
      const entityType = parts[2];
      const id = Number(parts[3]);
      const settings = db.getSettings('site', { published: false }) || db.getSettings('site', { published: true }) || {};
      const context = { getPublishedContent: (kind, limit) => db.listPublishedContent(kind, limit) };
      if (entityType === 'page') {
        const page = db.getPageById(id);
        if (!page) return send(res, req.method, 404, 'Страница не найдена.'), true;
        return send(res, req.method, 200, renderCmsPage({ entity: page, document: page.draft, settings, publicConfig: runtimeConfig.public, nonce, context, preview: true }), 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' }), true;
      }
      if (entityType === 'content') {
        const item = db.getContentById(id);
        if (!item) return send(res, req.method, 404, 'Материал не найден.'), true;
        return send(res, req.method, 200, renderCmsPage({ entity: item, document: item.draft, settings, publicConfig: runtimeConfig.public, nonce, context, preview: true }), 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' }), true;
      }
      return send(res, req.method, 404, 'Предпросмотр не найден.'), true;
    }

    if (!pathname.startsWith('/admin/api/')) return send(res, req.method, 404, 'Not found'), true;
    res.setHeader('Cache-Control', 'no-store');

    if (pathname === '/admin/api/session' && (req.method === 'GET' || req.method === 'HEAD')) {
      db.pruneSessions();
      const session = getSession(db, req, runtimeConfig);
      return json(res, req.method, 200, { ok: true, authenticated: Boolean(session), setupRequired: !db.hasUsers(), user: publicUser(session), csrfToken: session?.csrf_token || '' }), true;
    }

    if (pathname === '/admin/api/login' && req.method === 'POST') {
      if (!sameOrigin(req, runtimeConfig)) return json(res, req.method, 403, { ok: false, message: 'Недопустимый источник запроса.' }), true;
      const key = requestIpHash(req, runtimeConfig);
      const attempt = loginLimit(key);
      if (!attempt.allowed) return json(res, req.method, 429, { ok: false, message: 'Слишком много попыток входа. Повторите позже.' }, { 'Retry-After': String(attempt.retryAfter) }), true;
      if (!db.hasUsers()) return json(res, req.method, 409, { ok: false, setupRequired: true, message: 'Администратор ещё не создан. Выполните npm run admin:create на сервере.' }), true;
      const body = await readJsonBody(req, 32 * 1024);
      const user = db.getUserByUsername(body.username);
      const valid = user?.is_active && await verifyPassword(body.password, user.password_hash);
      if (!valid) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        logger.warn({ username: String(body.username || '').slice(0, 80) }, 'CMS login failed');
        return json(res, req.method, 401, { ok: false, message: 'Неверный логин или пароль.' }), true;
      }
      const created = createSession(db, req, runtimeConfig, user);
      db.touchUserLogin(user.id);
      db.audit(user.id, 'login', 'auth', String(user.id), {});
      res.setHeader('Set-Cookie', sessionCookie(created.token, runtimeConfig));
      return json(res, req.method, 200, { ok: true, user: { id: user.id, username: user.username, role: user.role }, csrfToken: created.csrfToken }), true;
    }

    const session = getSession(db, req, runtimeConfig);
    if (!session) return json(res, req.method, 401, { ok: false, message: 'Сессия истекла. Войдите снова.' }), true;

    if (pathname === '/admin/api/logout' && req.method === 'POST') {
      if (!requireCsrf(req, session)) return json(res, req.method, 403, { ok: false, message: 'CSRF-проверка не пройдена.' }), true;
      destroySession(db, req);
      res.setHeader('Set-Cookie', clearSessionCookie(runtimeConfig));
      return json(res, req.method, 200, { ok: true }), true;
    }

    const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
    if (mutating && !sameOrigin(req, runtimeConfig)) return json(res, req.method, 403, { ok: false, message: 'Недопустимый источник запроса.' }), true;
    if (mutating && !requireCsrf(req, session)) return json(res, req.method, 403, { ok: false, message: 'CSRF-проверка не пройдена. Обновите страницу.' }), true;

    if (pathname === '/admin/api/dashboard' && req.method === 'GET') {
      return json(res, req.method, 200, { ok: true, dashboard: db.dashboard(), recentAudit: db.listAudit(15) }), true;
    }
    if (pathname === '/admin/api/block-types' && req.method === 'GET') {
      return json(res, req.method, 200, { ok: true, blockTypes: getBlockDefinitions() }), true;
    }

    if (pathname === '/admin/api/pages' && req.method === 'GET') return json(res, req.method, 200, { ok: true, pages: db.listPages() }), true;
    if (pathname === '/admin/api/pages' && req.method === 'POST') {
      const body = await readJsonBody(req);
      return json(res, req.method, 201, { ok: true, page: db.createPage(body, session.user_id) }), true;
    }
    if (parts[1] === 'api' && parts[2] === 'pages' && parts[3]) {
      const id = Number(parts[3]);
      if (parts.length === 4 && req.method === 'GET') {
        const page = db.getPageById(id);
        return page ? json(res, req.method, 200, { ok: true, page, revisions: db.listRevisions('page', String(id)) }) : json(res, req.method, 404, { ok: false, message: 'Страница не найдена.' }), true;
      }
      if (parts.length === 4 && req.method === 'PATCH') {
        const body = await readJsonBody(req, 2 * 1024 * 1024);
        return json(res, req.method, 200, { ok: true, page: db.savePageDraft(id, body, session.user_id) }), true;
      }
      if (parts.length === 4 && req.method === 'DELETE') return json(res, req.method, 200, { ok: db.deletePage(id, session.user_id) }), true;
      if (parts[4] === 'publish' && req.method === 'POST') {
        db.backup(`before-page-${id}-publish`);
        return json(res, req.method, 200, { ok: true, page: db.publishPage(id, session.user_id) }), true;
      }
      if (parts[4] === 'unpublish' && req.method === 'POST') return json(res, req.method, 200, { ok: true, page: db.unpublishPage(id, session.user_id) }), true;
    }

    if (pathname === '/admin/api/content' && req.method === 'GET') {
      const kind = url.searchParams.get('kind') || '';
      return json(res, req.method, 200, { ok: true, items: db.listContent(kind) }), true;
    }
    if (pathname === '/admin/api/content' && req.method === 'POST') {
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      return json(res, req.method, 201, { ok: true, item: db.createContent(body, session.user_id) }), true;
    }
    if (parts[1] === 'api' && parts[2] === 'content' && parts[3]) {
      const id = Number(parts[3]);
      if (parts.length === 4 && req.method === 'GET') {
        const item = db.getContentById(id);
        return item ? json(res, req.method, 200, { ok: true, item, revisions: db.listRevisions('content', String(id)) }) : json(res, req.method, 404, { ok: false, message: 'Материал не найден.' }), true;
      }
      if (parts.length === 4 && req.method === 'PATCH') {
        const body = await readJsonBody(req, 2 * 1024 * 1024);
        return json(res, req.method, 200, { ok: true, item: db.saveContentDraft(id, body, session.user_id) }), true;
      }
      if (parts.length === 4 && req.method === 'DELETE') return json(res, req.method, 200, { ok: db.deleteContent(id, session.user_id) }), true;
      if (parts[4] === 'publish' && req.method === 'POST') {
        db.backup(`before-content-${id}-publish`);
        return json(res, req.method, 200, { ok: true, item: db.publishContent(id, session.user_id) }), true;
      }
      if (parts[4] === 'unpublish' && req.method === 'POST') return json(res, req.method, 200, { ok: true, item: db.unpublishContent(id, session.user_id) }), true;
    }

    if (parts[1] === 'api' && parts[2] === 'revisions' && parts[3] && parts[4] === 'restore' && req.method === 'POST') {
      db.backup(`before-revision-${parts[3]}-restore`);
      return json(res, req.method, 200, { ok: true, entity: db.restoreRevision(Number(parts[3]), session.user_id) }), true;
    }

    if (pathname === '/admin/api/media' && req.method === 'GET') {
      const items = db.listMedia().map((item) => ({ ...item, usage: db.mediaUsage(item.url) }));
      return json(res, req.method, 200, { ok: true, media: items }), true;
    }
    if (pathname === '/admin/api/media' && req.method === 'POST') {
      const maxUploadBytes = runtimeConfig.cms?.maxUploadBytes || 8 * 1024 * 1024;
      const body = await readJsonBody(req, Math.ceil(maxUploadBytes * 1.5) + 128 * 1024);
      const decoded = decodeMediaPayload(body, { maxBytes: maxUploadBytes });
      const stored = await storeMedia(runtimeConfig.dataDir, decoded);
      try {
        const media = db.createMedia({ originalName: decoded.originalName, storedName: stored.storedName, mimeType: decoded.mimeType, sizeBytes: decoded.buffer.length, title: decoded.title, altText: decoded.altText }, session.user_id);
        return json(res, req.method, 201, { ok: true, media }), true;
      } catch (error) {
        await removeStoredMedia(runtimeConfig.dataDir, stored.storedName);
        throw error;
      }
    }
    if (parts[1] === 'api' && parts[2] === 'media' && parts[3]) {
      const id = Number(parts[3]);
      if (req.method === 'PATCH') {
        const body = await readJsonBody(req, 64 * 1024);
        return json(res, req.method, 200, { ok: true, media: db.updateMedia(id, body, session.user_id) }), true;
      }
      if (req.method === 'DELETE') {
        const media = db.deleteMedia(id, session.user_id, { force: url.searchParams.get('force') === '1' });
        if (media) await removeStoredMedia(runtimeConfig.dataDir, media.storedName);
        return json(res, req.method, 200, { ok: true }), true;
      }
    }

    if (pathname === '/admin/api/settings' && req.method === 'GET') {
      return json(res, req.method, 200, { ok: true, draft: db.getSettings('site', { published: false }), published: db.getSettings('site', { published: true }), revisions: db.listRevisions('settings', 'site') }), true;
    }
    if (pathname === '/admin/api/settings' && req.method === 'PATCH') {
      const body = await readJsonBody(req, 512 * 1024);
      return json(res, req.method, 200, { ok: true, settings: db.saveSettingsDraft('site', cleanSettings(body), session.user_id) }), true;
    }
    if (pathname === '/admin/api/settings/publish' && req.method === 'POST') {
      db.backup('before-settings-publish');
      return json(res, req.method, 200, { ok: true, settings: db.publishSettings('site', session.user_id) }), true;
    }

    if (pathname === '/admin/api/leads' && req.method === 'GET') return json(res, req.method, 200, { ok: true, leads: await readRecentLeads(runtimeConfig.dataDir, 200) }), true;
    if (pathname === '/admin/api/audit' && req.method === 'GET') return json(res, req.method, 200, { ok: true, audit: db.listAudit(200) }), true;
    if (pathname === '/admin/api/backup' && req.method === 'POST') {
      const destination = db.backup('manual');
      db.audit(session.user_id, 'backup', 'system', '', { file: path.basename(destination) });
      return json(res, req.method, 200, { ok: true, file: path.basename(destination) }), true;
    }

    return json(res, req.method, 404, { ok: false, message: 'API-метод не найден.' }), true;
  };
}
