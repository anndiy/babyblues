import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SCENARIOS, generateScenario } from '../src/synthetic-data.js';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const scenario = value('scenario', 'steady');
const days = Number(value('days', '56'));
const seed = Number(value('seed', '42'));

if (!SCENARIOS[scenario]) {
  console.error(`Unknown scenario: ${scenario}`);
  console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEMO_USER_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.DEMO_SEED_ALLOW_DELETIONS !== 'true') {
  console.error('Safety stop: set DEMO_SEED_ALLOW_DELETIONS=true only after confirming DEMO_USER_ID is a dedicated demo account.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ALLOW_DELETIONS !== 'true') {
  console.error('Refusing to seed production without explicit confirmation.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const parentId = process.env.DEMO_USER_ID;
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(parentId);
if (authError || !authUser?.user) {
  console.error(`Could not verify DEMO_USER_ID in Supabase Auth: ${authError?.message || 'user not found'}`);
  process.exit(1);
}

const fixture = generateScenario(scenario, { days, seed, parentId, babyId: undefined });
console.log(`About to replace synthetic demo records for Auth user ${parentId}.`);
console.log(`Scenario: ${fixture.metadata.title}; ${days} days; ${fixture.metadata.counts.careLogs} care logs; ${fixture.metadata.counts.wellbeingCheckins} check-ins.`);

// Destructive operations are scoped exclusively to the explicitly configured demo user.
// Delete children before babies. Do not touch profile/auth records or consent preferences.
for (const table of ['care_logs', 'wellbeing_checkins', 'babies']) {
  const { error } = await supabase.from(table).delete().eq('parent_id', parentId);
  if (error) throw new Error(`Could not clear ${table} for demo user: ${error.message}`);
}

const { data: baby, error: babyError } = await supabase.from('babies').insert({
  parent_id: parentId,
  display_name: fixture.baby.display_name,
  date_of_birth: fixture.baby.date_of_birth
}).select('id').single();
if (babyError || !baby?.id) throw new Error(`Could not create demo baby: ${babyError?.message || 'missing id'}`);

const careRows = fixture.careLogs.map((row) => ({ ...row, parent_id: parentId, baby_id: baby.id }));
for (let i = 0; i < careRows.length; i += 100) {
  const { error } = await supabase.from('care_logs').insert(careRows.slice(i, i + 100));
  if (error) throw new Error(`Could not insert care logs (batch ${Math.floor(i / 100) + 1}): ${error.message}`);
}
const checkinRows = fixture.checkins.map((row) => ({ ...row, parent_id: parentId }));
for (let i = 0; i < checkinRows.length; i += 100) {
  const { error } = await supabase.from('wellbeing_checkins').insert(checkinRows.slice(i, i + 100));
  if (error) throw new Error(`Could not insert wellbeing check-ins (batch ${Math.floor(i / 100) + 1}): ${error.message}`);
}

console.log('Demo data seeded successfully.');
console.log(`Baby profile: ${baby.id} (${fixture.baby.display_name})`);
console.log(`Care logs inserted: ${careRows.length}`);
console.log(`Wellbeing check-ins inserted: ${checkinRows.length}`);
console.log('AI-sharing consent was not changed. Enable it explicitly in the demo account if you want to test the AI endpoint.');
console.log('To switch scenarios, rerun this script with another --scenario value.');
