import fs from 'node:fs/promises';
import path from 'node:path';

const fileQueues = new Map();

function enqueue(filePath, task) {
  const previous = fileQueues.get(filePath) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  fileQueues.set(filePath, next);
  return next.finally(() => {
    if (fileQueues.get(filePath) === next) fileQueues.delete(filePath);
  });
}

export function dataFile(dataDir, name) {
  const safeName = path.basename(String(name || ''));
  if (!safeName || safeName === '.' || safeName === '..') throw new Error('Invalid data filename.');
  return path.join(dataDir, safeName);
}

export async function ensureDataDir(dataDir) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o750 });
}

export async function appendJsonLine(filePath, value) {
  const line = `${JSON.stringify(value)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o750 });
  return enqueue(filePath, () => fs.appendFile(filePath, line, { encoding: 'utf8', mode: 0o640 }));
}

export async function readJsonLines(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function rewriteJsonLines(filePath, values) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o750 });
  const body = values.length ? `${values.map((value) => JSON.stringify(value)).join('\n')}\n` : '';
  return enqueue(filePath, async () => {
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, body, { encoding: 'utf8', mode: 0o640 });
    await fs.rename(temporary, filePath);
  });
}

export async function readJsonFile(filePath, fallback = []) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o750 });
  return enqueue(filePath, async () => {
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
    await fs.rename(temporary, filePath);
  });
}
