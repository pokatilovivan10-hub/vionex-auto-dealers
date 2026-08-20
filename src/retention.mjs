import { dataFile, readJsonLines, rewriteJsonLines } from './storage.mjs';

function recordTimestamp(record) {
  const value = record?.createdAt || record?.at || record?.queuedAt;
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

async function pruneFile(filePath, cutoff) {
  const records = await readJsonLines(filePath);
  if (!records.length) return { before: 0, after: 0 };
  const retained = records.filter((record) => recordTimestamp(record) >= cutoff);
  if (retained.length !== records.length) await rewriteJsonLines(filePath, retained);
  return { before: records.length, after: retained.length };
}

async function runRetention(runtimeConfig, logger) {
  const cutoff = Date.now() - runtimeConfig.public.retentionDays * 24 * 60 * 60 * 1000;
  for (const name of ['leads.ndjson', 'events.ndjson']) {
    const result = await pruneFile(dataFile(runtimeConfig.dataDir, name), cutoff);
    if (result.before !== result.after) {
      logger.info({ file: name, removed: result.before - result.after }, 'Expired records removed');
    }
  }
}

export function startRetentionWorker(runtimeConfig, logger) {
  let stopped = false;
  const run = () => {
    if (stopped) return;
    void runRetention(runtimeConfig, logger).catch((error) => {
      logger.error({ error: error.message }, 'Retention worker failed');
    });
  };
  const initial = setTimeout(run, 10_000);
  initial.unref?.();
  const interval = setInterval(run, runtimeConfig.retentionIntervalMs);
  interval.unref?.();
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
