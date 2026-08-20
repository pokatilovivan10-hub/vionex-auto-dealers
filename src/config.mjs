import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separator = trimmed.indexOf('=');
  if (separator < 1) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value.replaceAll('\\n', '\n')];
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(projectRoot, '.env'));

function text(name, fallback = '') {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

function integer(name, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number.parseInt(text(name, String(fallback)), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return 'http://localhost:8080';
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

function normalizeOptionalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).toString();
  } catch {
    return raw;
  }
}

const mode = text('SITE_MODE', 'demo').toLowerCase();
const baseUrl = normalizeBaseUrl(text('PUBLIC_BASE_URL', text('SITE_ADDRESS', 'http://localhost:8080')));
const dataDirValue = text('DATA_DIR', './data');
const dataDir = path.isAbsolute(dataDirValue) ? dataDirValue : path.resolve(projectRoot, dataDirValue);

export const config = Object.freeze({
  mode,
  isProduction: mode === 'production',
  port: integer('PORT', 8080, { min: 1, max: 65535 }),
  host: text('HOST', '127.0.0.1'),
  trustProxy: integer('TRUST_PROXY', 1, { min: 0, max: 10 }),
  logLevel: text('LOG_LEVEL', 'info').toLowerCase(),
  dataDir,
  formRateLimit: integer('FORM_RATE_LIMIT_PER_15_MIN', 8, { min: 1, max: 1000 }),
  eventRateLimit: integer('EVENT_RATE_LIMIT_PER_MIN', 120, { min: 1, max: 10000 }),
  minFormFillMs: integer('MIN_FORM_FILL_MS', 1200, { min: 0, max: 300000 }),
  public: Object.freeze({
    mode,
    baseUrl,
    siteName: text('PUBLIC_SITE_NAME', 'VIONEX LEADS'),
    shortName: text('PUBLIC_SITE_SHORT_NAME', 'VIONEX'),
    tagline: text('PUBLIC_TAGLINE', 'Управляемая B2B-лидогенерация под ключ'),
    phone: text('PUBLIC_PHONE'),
    email: text('PUBLIC_EMAIL'),
    telegramUrl: normalizeOptionalUrl(text('PUBLIC_TELEGRAM_URL')),
    calendarUrl: normalizeOptionalUrl(text('PUBLIC_CALENDAR_URL')),
    responseTime: text('PUBLIC_RESPONSE_TIME', 'Свяжемся в рабочее время после проверки задачи'),
    companyLegalName: text('COMPANY_LEGAL_NAME'),
    companyTaxId: text('COMPANY_TAX_ID'),
    companyRegistrationId: text('COMPANY_REGISTRATION_ID'),
    companyAddress: text('COMPANY_ADDRESS'),
    privacyEmail: text('PRIVACY_EMAIL'),
    retentionDays: integer('DATA_RETENTION_DAYS', 365, { min: 1, max: 3650 }),
  }),
  webhook: Object.freeze({
    url: normalizeOptionalUrl(text('LEAD_WEBHOOK_URL')),
    token: text('LEAD_WEBHOOK_TOKEN'),
    timeoutMs: integer('LEAD_WEBHOOK_TIMEOUT_MS', 7000, { min: 1000, max: 60000 }),
  }),
  telegram: Object.freeze({
    botToken: text('TELEGRAM_BOT_TOKEN'),
    chatId: text('TELEGRAM_CHAT_ID'),
  }),
  outboxIntervalMs: integer('OUTBOX_INTERVAL_MS', 30000, { min: 5000, max: 3600000 }),
  retentionIntervalMs: integer('RETENTION_INTERVAL_MS', 86400000, { min: 60000, max: 604800000 }),
  cms: Object.freeze({
    databasePath: text('CMS_DATABASE_PATH'),
    sessionHours: integer('CMS_SESSION_HOURS', 8, { min: 1, max: 168 }),
    maxUploadBytes: integer('CMS_MAX_UPLOAD_MB', 8, { min: 1, max: 50 }) * 1024 * 1024,
    loginAttemptsPer15Min: integer('CMS_LOGIN_ATTEMPTS_PER_15_MIN', 10, { min: 3, max: 100 }),
  }),
});

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

export function validateProductionConfig(runtimeConfig = config) {
  if (!runtimeConfig.isProduction) return [];

  const errors = [];
  const p = runtimeConfig.public;
  if (!isHttpsUrl(p.baseUrl)) errors.push('PUBLIC_BASE_URL должен начинаться с https:// в production-режиме.');
  if (!p.siteName) errors.push('PUBLIC_SITE_NAME не заполнен.');
  if (!p.companyLegalName) errors.push('COMPANY_LEGAL_NAME не заполнен.');
  if (!p.companyTaxId) errors.push('COMPANY_TAX_ID не заполнен.');
  if (!p.companyAddress) errors.push('COMPANY_ADDRESS не заполнен.');
  if (!isEmail(p.privacyEmail)) errors.push('PRIVACY_EMAIL не заполнен или указан некорректно.');
  if (!p.phone && !p.email && !p.telegramUrl) errors.push('Укажите хотя бы один публичный контакт: PUBLIC_PHONE, PUBLIC_EMAIL или PUBLIC_TELEGRAM_URL.');
  if (p.email && !isEmail(p.email)) errors.push('PUBLIC_EMAIL указан некорректно.');
  if (runtimeConfig.webhook.url && !isHttpsUrl(runtimeConfig.webhook.url)) errors.push('LEAD_WEBHOOK_URL должен использовать HTTPS в production-режиме.');
  if (runtimeConfig.webhook.url && !runtimeConfig.webhook.token) errors.push('Для LEAD_WEBHOOK_URL заполните LEAD_WEBHOOK_TOKEN.');
  return errors;
}

export { projectRoot };
