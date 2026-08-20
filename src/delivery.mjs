import { dataFile, readJsonFile, writeJsonFileAtomic } from './storage.mjs';

let outboxChain = Promise.resolve();

function withOutboxLock(task) {
  const next = outboxChain.catch(() => undefined).then(task);
  outboxChain = next;
  return next;
}

function retryDelayMs(attempt) {
  const minutes = Math.min(360, 2 ** Math.min(8, Math.max(0, attempt)));
  return minutes * 60_000;
}

async function postJson(url, payload, { headers = {}, timeoutMs = 7000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vionex-leads-site/1.1.0',
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`Remote service returned ${response.status}${body ? `: ${body}` : ''}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function sendWebhook(lead, runtimeConfig) {
  if (!runtimeConfig.webhook.url) return;
  await postJson(runtimeConfig.webhook.url, {
    event: 'website.lead.created',
    version: '1.0',
    lead,
  }, {
    timeoutMs: runtimeConfig.webhook.timeoutMs,
    headers: {
      authorization: `Bearer ${runtimeConfig.webhook.token}`,
      'x-lead-id': lead.id,
      'idempotency-key': lead.id,
    },
  });
}

function telegramText(lead) {
  const goalNames = {
    warm_leads: 'Тёплые лиды в CRM',
    qualified_calls: 'Квалифицированные диалоги',
    lpr_contacts: 'Контакты ЛПР + сигналы',
    audit: 'Аудит воронки',
  };
  return [
    'Новая заявка с сайта',
    `ID: ${lead.id}`,
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    lead.company ? `Компания: ${lead.company}` : '',
    lead.role ? `Роль: ${lead.role}` : '',
    `Цель: ${goalNames[lead.goal] || lead.goal}`,
    lead.monthlyTarget ? `Объём: ${lead.monthlyTarget}` : '',
    lead.comment ? `Комментарий: ${lead.comment}` : '',
  ].filter(Boolean).join('\n');
}

async function sendTelegram(lead, runtimeConfig) {
  const { botToken, chatId } = runtimeConfig.telegram;
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  await postJson(url, {
    chat_id: chatId,
    text: telegramText(lead),
    disable_web_page_preview: true,
  }, { timeoutMs: runtimeConfig.webhook.timeoutMs });
}

async function queueWebhook(lead, runtimeConfig, error) {
  const filePath = dataFile(runtimeConfig.dataDir, 'outbox.json');
  await withOutboxLock(async () => {
    const items = await readJsonFile(filePath, []);
    if (items.some((item) => item.lead?.id === lead.id)) return;
    items.push({
      type: 'webhook',
      lead,
      attempt: 0,
      queuedAt: new Date().toISOString(),
      nextAttemptAt: new Date(Date.now() + retryDelayMs(0)).toISOString(),
      lastError: String(error?.message || error || 'Delivery failed').slice(0, 300),
    });
    await writeJsonFileAtomic(filePath, items.slice(-5000));
  });
}

export async function deliverLead(lead, runtimeConfig, logger) {
  if (runtimeConfig.webhook.url) {
    try {
      await sendWebhook(lead, runtimeConfig);
      logger.info({ leadId: lead.id }, 'Lead delivered to webhook');
    } catch (error) {
      await queueWebhook(lead, runtimeConfig, error);
      logger.warn({ leadId: lead.id, error: error.message }, 'Webhook unavailable; lead queued for retry');
    }
  }

  if (runtimeConfig.telegram.botToken && runtimeConfig.telegram.chatId) {
    try {
      await sendTelegram(lead, runtimeConfig);
      logger.info({ leadId: lead.id }, 'Telegram notification sent');
    } catch (error) {
      logger.warn({ leadId: lead.id, error: error.message }, 'Telegram notification failed');
    }
  }
}

async function flushOutbox(runtimeConfig, logger) {
  if (!runtimeConfig.webhook.url) return;
  const filePath = dataFile(runtimeConfig.dataDir, 'outbox.json');
  await withOutboxLock(async () => {
    const items = await readJsonFile(filePath, []);
    if (!Array.isArray(items) || !items.length) return;

    const now = Date.now();
    const remaining = [];
    for (const item of items) {
      if (item.type !== 'webhook' || !item.lead?.id) continue;
      const nextAt = Date.parse(item.nextAttemptAt || 0);
      if (Number.isFinite(nextAt) && nextAt > now) {
        remaining.push(item);
        continue;
      }
      try {
        await sendWebhook(item.lead, runtimeConfig);
        logger.info({ leadId: item.lead.id, attempt: item.attempt + 1 }, 'Queued lead delivered');
      } catch (error) {
        const attempt = Number(item.attempt || 0) + 1;
        remaining.push({
          ...item,
          attempt,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(attempt)).toISOString(),
          lastError: String(error.message || error).slice(0, 300),
        });
      }
    }
    await writeJsonFileAtomic(filePath, remaining);
  });
}

export function startOutboxWorker(runtimeConfig, logger) {
  let stopped = false;
  const run = () => {
    if (stopped) return;
    void flushOutbox(runtimeConfig, logger).catch((error) => {
      logger.error({ error: error.message }, 'Outbox worker failed');
    });
  };
  const initial = setTimeout(run, 2500);
  initial.unref?.();
  const interval = setInterval(run, runtimeConfig.outboxIntervalMs);
  interval.unref?.();
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
