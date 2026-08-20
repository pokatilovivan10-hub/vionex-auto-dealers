import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config.mjs';
import { dataFile, readJsonLines } from '../src/storage.mjs';

function csvCell(value) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

const leads = await readJsonLines(dataFile(config.dataDir, 'leads.ndjson'));
const columns = ['id', 'createdAt', 'name', 'phone', 'email', 'company', 'role', 'goal', 'monthlyTarget', 'comment', 'meta'];
const rows = [columns.map(csvCell).join(',')];
for (const lead of leads) rows.push(columns.map((column) => csvCell(lead[column])).join(','));

const exportDir = path.resolve(config.dataDir, '..', 'exports');
await fs.mkdir(exportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(exportDir, `leads-${stamp}.csv`);
await fs.writeFile(output, `\uFEFF${rows.join('\r\n')}\r\n`, 'utf8');
console.log(`Exported ${leads.length} leads to ${output}`);
