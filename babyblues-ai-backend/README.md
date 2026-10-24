# BabyBlues AI Analysis Backend

Node.js + Express backend for a consent-gated behavioural feature pipeline and Gemini explanation layer.

## What it does

1. Validates the caller's Supabase access token.
2. Checks `wellbeing_analysis_preferences.ai_sharing_enabled` for the authenticated user. This is separate from consent to local descriptive summaries.
3. Reads only that user's `wellbeing_checkins` and `care_logs`, using their JWT so Supabase RLS still applies.
4. Extracts transparent comparisons between the current and previous time windows.
5. Sends aggregate features (not names, emails, raw event histories, or free-text notes) to Gemini for a constrained explanation.
6. Returns structured signals plus a non-diagnostic reflection.

Care-log and app-use frequency are explicitly context-only. They must not be used to infer a parent's mental state, caregiving quality, or postpartum depression. The output is not a clinical screening tool, risk score, diagnosis, or validated prediction.

## Requirements

- Node.js 20+
- A Supabase project with the existing `wellbeing_checkins`, `care_logs`, and `wellbeing_analysis_preferences` tables. Run `BabyBlues_ai_sharing_consent.sql` in Supabase to add the separate `ai_sharing_enabled` opt-in (default false).
- A Gemini API key from Google AI Studio.

## Run locally

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (defaults to `gemini-3-flash-preview`; use a model currently enabled for your Google AI Studio key)

Then run the feature-extraction tests and start the server:

```bash
npm test
npm run dev
```

Health check: `http://localhost:3000/health`

## Endpoint

`POST /api/analysis/wellbeing`

Headers:
```http
Authorization: Bearer <Supabase access_token>
Content-Type: application/json
```

Body:
```json
{ "windowDays": 28 }
```

`windowDays` must be between 7 and 60. The backend compares the current window with the immediately preceding window of equal length.

## Database migration

Run `BabyBlues_ai_sharing_consent.sql` in the Supabase SQL Editor before using the AI endpoint. It adds a separate explicit opt-in with a default of `false`; it does not opt anyone in automatically.

## Connect the Expo app

Set `EXPO_PUBLIC_API_BASE_URL` in the mobile project's environment. For a local physical phone, do not use `localhost`; use the computer's LAN IP, e.g. `http://192.168.1.20:3000`. Android emulator commonly uses `http://10.0.2.2:3000`. For a deployed backend, use its HTTPS URL.

Restart Expo after changing environment variables:

```bash
npx expo start --clear
```

The `BabyBlues_App_ai.tsx` replacement includes the API call and result UI. Replace `mobile/App.tsx` with it after reviewing/testing.

## Deployment

Deploy this folder as a Node web service (for example, Render). Set the same environment variables in the hosting dashboard. Do not commit `.env`. Do not put `GEMINI_API_KEY` or any Supabase service-role key in the Expo app. This backend intentionally uses the anon key and forwards the authenticated user's JWT for database access.

## Important limitations

- Features are exploratory descriptive signals with simple thresholds, not a trained predictive model.
- Gemini explains aggregates; it is not the source of a clinical risk classification.
- The model response is constrained and sanitized, but LLM outputs can still be wrong.
- This is a hackathon prototype. Do not use it for diagnosis, triage, or unsupervised clinical decisions.
- The fallback explanation is deterministic if Gemini is unavailable; `meta.provider` identifies the provider/fallback.

## Synthetic demo data simulator

This repository includes a reproducible synthetic-data generator and an optional Supabase seeder for a **dedicated demo account**. The data is fictional and intended only for software demos/tests; it is not clinical evidence and must not be represented as real patient data.

### Available scenarios

- `steady` — consistent care logging and broadly stable self-reported measures.
- `declining_wellbeing` — recent self-reported measures trend less favourably (not a diagnosis).
- `recovery` — recent self-reported measures trend more favourably.
- `irregular_care_activity` — care-log frequency drops while check-ins remain broadly stable; care logs stay context-only.
- `sparse_data` — intentionally too few check-ins for a comparison.
- `conflicting_signals` — care-log activity declines while self-reported measures improve.
- `missing_fields` — optional wellbeing fields are missing in some recent check-ins.

The default 56-day history supports the backend's default 28-day current-vs-previous comparison and gives the dashboard recent activity. The generator uses a seed so the same scenario can be recreated exactly.

### Generate an offline JSON fixture (no Supabase credentials needed)

```bash
npm run demo:generate -- --scenario steady --days 56 --seed 42
npm run demo:generate -- --scenario declining_wellbeing --days 56 --seed 42
```

Output defaults to `demo-fixtures/<scenario>.json`. Override it with `--out path/to/file.json`. Generate all scenarios by running the command once per scenario. Fixture IDs are placeholders and are not database IDs.

### Seed a dedicated Supabase demo account

**Do not point this at a real user's account.** The seeder replaces that account's `care_logs`, `wellbeing_checkins`, and `babies` records. It does not modify auth users, profile rows, or AI-sharing consent preferences. Use a separate Supabase Auth account created specifically for demos.

Add these variables to your local backend `.env` (never to the mobile app or web frontend):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
DEMO_USER_ID=UUID_OF_DEDICATED_DEMO_AUTH_USER
DEMO_SEED_ALLOW_DELETIONS=true
```

The seeder requires the explicit deletion opt-in and validates that `DEMO_USER_ID` exists in Supabase Auth. Keep the service-role key server-side and never commit `.env`. The deletion confirmation is a safety guard, not a substitute for using a dedicated demo account.

```bash
npm run demo:seed -- --scenario steady --days 56 --seed 42
npm run demo:seed -- --scenario conflicting_signals --days 56 --seed 42
```

Run the second command only when you intentionally want to replace the first scenario. The script deletes rows for the configured demo user before inserting the selected scenario, making scenario switching repeatable rather than duplicative. It leaves `wellbeing_analysis_preferences` unchanged; AI analysis remains unavailable until the demo user explicitly enables AI-sharing consent in the app.

### Test the generator and feature pipeline

```bash
npm test
```

Tests check deterministic generation, field ranges, comparison-window sufficiency, sparse-data abstention, and that care-log activity remains context-only. These are software behavior tests, not clinical validation. AI-generated text should be evaluated separately using structural/safety assertions and reviewed sample outputs rather than exact-string matching.

### Safety and schema notes

- The seeder uses the known application fields for `babies`, `care_logs`, and `wellbeing_checkins`; it will stop and print a Supabase error if your deployed schema differs.
- The seeder is intentionally not exposed as an HTTP endpoint.
- It does not enable AI consent on behalf of a user.
- It uses a Supabase service-role key only in a local/server-side script; never put this key in the client app.
- Do not mix synthetic records with real accounts or use these scenarios to claim clinical sensitivity, specificity, or predictive accuracy.
