import { config } from '../src/config.mjs';
import { dataFile, readJsonLines } from '../src/storage.mjs';

const [leads, events] = await Promise.all([
  readJsonLines(dataFile(config.dataDir, 'leads.ndjson')),
  readJsonLines(dataFile(config.dataDir, 'events.ndjson')),
]);

const eventCounts = new Map();
for (const item of events) eventCounts.set(item.event, (eventCounts.get(item.event) || 0) + 1);
const goals = new Map();
for (const lead of leads) goals.set(lead.goal, (goals.get(lead.goal) || 0) + 1);

console.log('\nVIONEX LEADS — local funnel report');
console.log(`Leads: ${leads.length}`);
console.log(`Events: ${events.length}`);
console.log('\nEvents by type:');
for (const [name, count] of [...eventCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${name}: ${count}`);
console.log('\nLeads by goal:');
for (const [name, count] of [...goals.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${name}: ${count}`);
