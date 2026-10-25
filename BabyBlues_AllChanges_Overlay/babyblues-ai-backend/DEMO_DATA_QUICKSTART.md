# BabyBlues synthetic demo data — quick start

## What is included

- A deterministic generator (`src/synthetic-data.js`)
- A JSON fixture export command (`npm run demo:generate`, writes to `demo-fixtures/`)
- A guarded Supabase seeder for a dedicated demo Auth user
- Tests for repeatability, comparison windows, sparse-data handling, and context-only care-log signals

## 1. Run tests

```bash
npm install
npm test
```

## 2. Generate a fixture without connecting to Supabase

```bash
npm run demo:generate -- --scenario steady --days 56 --seed 42
```

Scenarios: `steady`, `declining_wellbeing`, `recovery`, `irregular_care_activity`, `sparse_data`, `conflicting_signals`, `missing_fields`, `combined_signals`, `usage_shift_no_checkins`, `safety_item_positive`.

What each one should show in the new Support level panel:

| Scenario | Expected support level |
|---|---|
| steady, recovery, missing_fields | Nothing stands out right now |
| irregular_care_activity, conflicting_signals | Nothing stands out (logging changed, check-ins look fine, so it is context only) |
| sparse_data | Still getting to know your pattern |
| usage_shift_no_checkins | A quick check-in could help |
| declining_wellbeing | It might help to talk to someone |
| combined_signals | Please consider reaching out soon |
| safety_item_positive | Please consider reaching out soon, with the safety message and the contacts highlighted (everything else in this scenario looks steady, on purpose) |

## 3. Seed Supabase (only a dedicated demo account)

1. Create a separate Supabase Auth account specifically for demonstrations.
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, that account's `DEMO_USER_ID`, and its email as `DEMO_USER_EMAIL` to the backend's local `.env`.
3. Set `DEMO_SEED_ALLOW_DELETIONS=true` only after verifying the ID belongs to the dedicated demo account.
4. Check first (changes nothing): `npm run demo:seed -- --dry-run`
5. Run:

```bash
npm run demo:seed -- --scenario steady --days 56 --seed 42
```

Switch the active scenario by rerunning with a different scenario name. The script replaces that demo user's care logs, wellbeing check-ins, and baby profiles. It does not change AI-sharing consent. Do not run it against your personal account or any account containing real records.

The seeder uses the service-role key, so run it only locally/server-side. Never put that key in the mobile app, dashboard, or a public repository.


## 4. Support level panel (dashboard + mobile)

The backend now has `POST /api/support-level` (rule-based, no AI, no AI-consent needed).

1. Start the backend: `npm start` in `babyblues-ai-backend`.
2. Dashboard: add this line to `dashboard/.env` (or `.env.local`): `VITE_API_BASE_URL=http://localhost:3000`
3. Mobile: make sure `EXPO_PUBLIC_API_BASE_URL` points at the backend (on a real phone use your computer's network address, not `localhost`).
4. Sign in as the demo user, reseed with any scenario above, and refresh.

The crisis contacts (Tele-MANAS 14416, emergency 112) are built into both apps and show even when the backend is not running.


## 5. Questionnaire (PHQ-9) setup

New table required: open `BabyBlues_Screening_Migration.sql` (in this folder), paste it into the Supabase SQL editor, and run it once.
Until it is run, everything else still works; the seeder prints a warning and skips the questionnaire results, and the app shows
"could not be saved" after someone answers (the result is still shown on screen).

After the migration, reseed any scenario. The mobile app's Reflections tab now has "A short questionnaire (optional)".
See `SCREENING_NOTES.md` for what was verified, the licensing position on the EPDS, and known limits.
