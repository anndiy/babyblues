import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, generateScenario } from '../src/synthetic-data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const scenario = value('scenario', 'steady');
const days = Number(value('days', '56'));
const seed = Number(value('seed', '42'));
const out = resolve(value('out', `demo-fixtures/${scenario}.json`));

if (!SCENARIOS[scenario]) {
  console.error(`Unknown scenario: ${scenario}`);
  console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}
const fixture = generateScenario(scenario, { days, seed });
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(`Generated ${scenario}: ${fixture.metadata.counts.careLogs} care logs, ${fixture.metadata.counts.wellbeingCheckins} check-ins`);
console.log(`Fixture: ${out}`);
