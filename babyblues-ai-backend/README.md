# BabyBlues AI Analysis Backend

A Node.js + Express backend for descriptive behavioural feature extraction and optional Gemini-based explanations.

## What it does

1. Validates the signed-in user's Supabase access token.
2. Checks `wellbeing_analysis_preferences.ai_sharing_enabled` (a separate explicit opt-in, default false).
3. Reads the authenticated user's own `wellbeing_checkins` and `care_logs`, forwarding their JWT so Supabase RLS applies.
4. Compares self-reported wellbeing measures across two equal time windows.
5. Sends only aggregate features to Gemini, not names, email addresses, raw care-log histories, or free-text notes.
6. Returns transparent observations plus a non-diagnostic explanation and low-risk next steps.

Baby-care logging frequency and check-in frequency are context only. They must not be used to infer mental state, caregiving quality, or postpartum depression. This is not a clinical screening tool, validated prediction model, or diagnostic system.

## Requirements

- Node.js 20+
- Existing Supabase tables: `wellbeing_checkins` and `care_logs`
- Run `BabyBlues_AI_Consent_Migration.sql` in the Supabase SQL Editor. This migration creates the missing preference table and owner-only RLS policies.

## Run locally

```bash
npm install
cp .env.example .env
```

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GEMINI_API_KEY` in `.env`. The Gemini model defaults to `gemini-3-flash-preview`; use a model available to your Google AI Studio key if necessary.

```bash
npm test
npm run dev
```

Health check: `http://localhost:3000/health`

## Endpoint

`POST /api/analysis/wellbeing`

Header: `Authorization: Bearer <Supabase access token>`

Body: `{"windowDays":28}`. Allowed window size is 7–60 days.

## Connect Expo

Set `EXPO_PUBLIC_API_BASE_URL` in the mobile project's environment. Use your computer's LAN IP for a physical phone, `http://10.0.2.2:3000` for Android emulator, or `http://localhost:3000` for web on the same computer. Restart Expo after changing it.

## Secrets and deployment

Never put `GEMINI_API_KEY` in the Expo app or any `EXPO_PUBLIC_` variable. Do not use a Supabase service-role key in this backend. Deploy as a Node service (e.g. Render) and set environment variables in the host's environment dashboard. Use HTTPS in deployment.

## Prototype limitations

The feature extraction is deterministic and exploratory, not a trained clinical model. Gemini can make mistakes even with constrained prompts. Do not use this output for diagnosis, triage, or unsupervised clinical decisions.
