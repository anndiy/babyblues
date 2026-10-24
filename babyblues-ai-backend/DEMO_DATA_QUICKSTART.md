# BabyBlues synthetic demo data — quick start

## What is included

- A deterministic generator (`src/synthetic-data.js`)
- Seven ready-made JSON fixtures in `demo-fixtures/`
- A JSON fixture export command
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

Scenarios: `steady`, `declining_wellbeing`, `recovery`, `irregular_care_activity`, `sparse_data`, `conflicting_signals`, `missing_fields`.

## 3. Seed Supabase (only a dedicated demo account)

1. Create a separate Supabase Auth account specifically for demonstrations.
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and that account's `DEMO_USER_ID` to the backend's local `.env`.
3. Set `DEMO_SEED_ALLOW_DELETIONS=true` only after verifying the ID belongs to the dedicated demo account.
4. Run:

```bash
npm run demo:seed -- --scenario steady --days 56 --seed 42
```

Switch the active scenario by rerunning with a different scenario name. The script replaces that demo user's care logs, wellbeing check-ins, and baby profiles. It does not change AI-sharing consent. Do not run it against your personal account or any account containing real records.

The seeder uses the service-role key, so run it only locally/server-side. Never put that key in the mobile app, dashboard, or a public repository.
