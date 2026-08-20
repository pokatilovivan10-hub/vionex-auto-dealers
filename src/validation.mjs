const GOALS = new Set(['warm_leads', 'qualified_calls', 'lpr_contacts', 'audit']);
const VIEWPORTS = new Set(['mobile', 'tablet', 'desktop', '']);

function text(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function sanitizeProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(value).slice(0, 30)) {
    const safeKey = text(key, 60).replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!safeKey) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) output[safeKey] = raw;
    else if (typeof raw === 'boolean') output[safeKey] = raw;
    else output[safeKey] = text(raw, 240);
  }
  return output;
}

function sanitizeUtm(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const key of ['source', 'medium', 'campaign', 'content', 'term']) {
    const cleaned = text(value[key], 160);
    if (cleaned) output[key] = cleaned;
  }
  return output;
}

function sanitizeMeta(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const viewport = text(input.viewport, 20);
  return {
    page: text(input.page, 300),
    referrerHost: text(input.referrerHost, 180),
    viewport: VIEWPORTS.has(viewport) ? viewport : '',
    variant: text(input.variant, 80),
    sessionId: text(input.sessionId, 120),
    utm: sanitizeUtm(input.utm),
  };
}

export function validateLead(body, { minFillMs = 1200 } = {}) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};

  const honeypot = text(input.website, 200);
  const startedAt = Number(input.startedAt);
  const elapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : Number.POSITIVE_INFINITY;
  if (honeypot) errors.form = 'Заявка отклонена.';
  if (elapsed < minFillMs || elapsed < 0) errors.form = 'Форма отправлена слишком быстро. Повторите попытку.';

  const name = text(input.name, 80);
  const phone = text(input.phone, 40);
  const email = text(input.email, 160).toLowerCase();
  const company = text(input.company, 140);
  const role = text(input.role, 100);
  const comment = text(input.comment, 1500);
  const monthlyTarget = text(input.monthlyTarget, 100);
  const goal = text(input.goal, 40);
  const digits = phone.replace(/\D/g, '');

  if (name.length < 2) errors.name = 'Укажите имя — минимум 2 символа.';
  if (digits.length < 10 || digits.length > 15) errors.phone = 'Укажите корректный номер телефона.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Укажите корректный email.';
  if (!GOALS.has(goal)) errors.goal = 'Выберите формат результата.';
  if (input.consent !== true) errors.consent = 'Для отправки нужно согласие на обработку данных.';

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      phone,
      email,
      company,
      role,
      comment,
      monthlyTarget,
      goal,
      meta: sanitizeMeta(input.meta),
    },
  };
}

export function validateEvent(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const event = text(input.event, 80);
  const sessionId = text(input.sessionId, 120);
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(event)) return { ok: false };
  if (!sessionId) return { ok: false };
  return {
    ok: true,
    value: {
      event,
      sessionId,
      properties: sanitizeProperties(input.properties),
    },
  };
}
