import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const SESSION_COOKIE = 'vionex_admin';
function sessionTtlMs(runtimeConfig) {
  const hours = Math.max(1, Math.min(168, Number(runtimeConfig?.cms?.sessionHours) || 8));
  return hours * 60 * 60 * 1000;
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function parseCookies(req) {
  const result = {};
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

export function requestAddress(req, runtimeConfig) {
  let address = req.socket.remoteAddress || 'unknown';
  if (runtimeConfig.trustProxy > 0) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) address = forwarded;
  }
  return address;
}

export function requestIpHash(req, runtimeConfig) {
  return crypto.createHash('sha256').update(requestAddress(req, runtimeConfig)).digest('hex').slice(0, 32);
}

export async function hashPassword(password) {
  const value = String(password || '');
  if (value.length < 12) throw new Error('Пароль должен содержать минимум 12 символов.');
  if (value.length > 256) throw new Error('Пароль слишком длинный.');
  const salt = crypto.randomBytes(24);
  const N = 32768;
  const r = 8;
  const p = 1;
  const key = await scryptAsync(value.normalize('NFKC'), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${base64url(salt)}$${base64url(key)}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, saltEncoded, keyEncoded] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt') return false;
    const salt = Buffer.from(saltEncoded, 'base64url');
    const expected = Buffer.from(keyEncoded, 'base64url');
    const actual = await scryptAsync(String(password || '').normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSession(db, req, runtimeConfig, user) {
  const token = base64url(crypto.randomBytes(32));
  const csrfToken = base64url(crypto.randomBytes(24));
  const ttlMs = sessionTtlMs(runtimeConfig);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.createSession({
    tokenHash: hashToken(token),
    userId: user.id,
    csrfToken,
    ipHash: requestIpHash(req, runtimeConfig),
    userAgent: String(req.headers['user-agent'] || ''),
    expiresAt,
  });
  return { token, csrfToken, expiresAt };
}

export function sessionCookie(token, runtimeConfig) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(sessionTtlMs(runtimeConfig) / 1000)}`, 
  ];
  const secureCookie = runtimeConfig.isProduction || String(runtimeConfig.public?.baseUrl || '').startsWith('https://');
  if (secureCookie) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(runtimeConfig) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  const secureCookie = runtimeConfig.isProduction || String(runtimeConfig.public?.baseUrl || '').startsWith('https://');
  if (secureCookie) parts.push('Secure');
  return parts.join('; ');
}

export function getSession(db, req, runtimeConfig) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = db.getSession(hashToken(token));
  if (!session) return null;
  const currentIpHash = requestIpHash(req, runtimeConfig);
  if (session.ip_hash !== currentIpHash) return null;
  if (Date.now() - Date.parse(session.last_seen_at) > 5 * 60 * 1000) db.touchSession(session.session_id);
  return { ...session, rawToken: token };
}

export function destroySession(db, req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) db.deleteSession(hashToken(token));
}

export function requireCsrf(req, session) {
  const supplied = String(req.headers['x-csrf-token'] || '');
  if (!supplied || supplied.length !== session.csrf_token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrf_token));
}

export function publicUser(session) {
  return session ? { id: session.user_id, username: session.username, role: session.role } : null;
}
