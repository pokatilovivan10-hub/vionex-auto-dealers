import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ALLOWED = Object.freeze({
  'image/png': { extension: '.png', matches: (buffer) => buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { extension: '.jpg', matches: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/webp': { extension: '.webp', matches: (buffer) => buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' },
});

function safeOriginalName(value) {
  const base = path.basename(String(value || 'image')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'image').slice(0, 240);
}

export function decodeMediaPayload(payload, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const mimeType = String(payload?.mimeType || '').toLowerCase();
  const rule = ALLOWED[mimeType];
  if (!rule) {
    const error = new Error('Поддерживаются только PNG, JPEG и WebP. SVG из админки запрещён из соображений безопасности.');
    error.statusCode = 415;
    throw error;
  }
  const encoded = String(payload?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!encoded) {
    const error = new Error('Файл не передан.');
    error.statusCode = 422;
    throw error;
  }
  let buffer;
  try { buffer = Buffer.from(encoded, 'base64'); } catch {
    const error = new Error('Некорректное содержимое файла.');
    error.statusCode = 422;
    throw error;
  }
  if (!buffer.length || buffer.length > maxBytes) {
    const error = new Error(`Размер изображения должен быть не более ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
    error.statusCode = 413;
    throw error;
  }
  if (!rule.matches(buffer)) {
    const error = new Error('Формат файла не соответствует его MIME-типу.');
    error.statusCode = 422;
    throw error;
  }
  return {
    buffer,
    mimeType,
    extension: rule.extension,
    originalName: safeOriginalName(payload.originalName),
    title: String(payload.title || '').trim().slice(0, 300),
    altText: String(payload.altText || '').trim().slice(0, 500),
  };
}

export async function storeMedia(dataDir, decoded) {
  const storedName = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(12).toString('hex')}${decoded.extension}`;
  const directory = path.join(dataDir, 'uploads');
  await fs.mkdir(directory, { recursive: true, mode: 0o750 });
  const destination = path.join(directory, storedName);
  const temporary = `${destination}.tmp-${process.pid}`;
  await fs.writeFile(temporary, decoded.buffer, { mode: 0o640, flag: 'wx' });
  await fs.rename(temporary, destination);
  return { storedName, destination };
}

export async function removeStoredMedia(dataDir, storedName) {
  const directory = path.resolve(dataDir, 'uploads');
  const fullPath = path.resolve(directory, String(storedName));
  if (!fullPath.startsWith(`${directory}${path.sep}`)) throw new Error('Недопустимый путь файла.');
  try { await fs.unlink(fullPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function allowedMediaMime(mimeType) {
  return Boolean(ALLOWED[mimeType]);
}
