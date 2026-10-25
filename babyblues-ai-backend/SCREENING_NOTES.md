# Screening questionnaires in BabyBlues

Checked 25 October 2026. Re-verify before any real deployment.

## What is in the app

| Instrument | Status | Why |
|---|---|---|
| **PHQ-9** (9 items) | Live in the mobile app | Published with the notice "No permission required to reproduce, translate, display or distribute." Wording must not be altered. |
| **EPDS** (10 items) | Scoring and safety logic built and tested; **no item text included** | Copyright Royal College of Psychiatrists. Written permission is required to copy and distribute it to others, including online. The CamCOPS project was refused permission to embed it. This repository is public, so adding the items without permission would publish them. |

Scoring rules and cut-offs are facts and are implemented in `src/screening.js`. Item text is not.

## Why not just use the EPDS?

It is the postpartum standard and, by design, it does not ask about sleep, appetite or tiredness. The PHQ-9 does, and those
questions are affected by looking after a newborn (reported to inflate scores in postpartum samples). So:

- A PHQ-9 total of 10 or more is treated as a reason to suggest talking to someone, never downgraded.
- If most of the points come from questions 3 to 5, the app says so in plain words, without dismissing the score.
- The PHQ-9 is not a postpartum-specific tool. Do not present it as one.

## Safety rules (enforced by tests)

1. A positive self-harm answer (PHQ-9 question 9, EPDS question 10) always gives the top support level and a safety alert,
   regardless of check-ins, logging pattern, or total score.
2. In the mobile app the result and the call buttons show on screen immediately, even if saving fails or the backend is down.
3. The app says plainly that BabyBlues is not monitored by anyone in real time and cannot respond to an emergency.
4. Questionnaire results older than 21 days do not drive the current level.
5. The backend recomputes scores from the saved answers. Stored totals are never trusted, and raw answers are never returned by the API.

## To switch the EPDS on (after written permission)

1. Obtain written permission from the Royal College of Psychiatrists and note any conditions (attribution, no changes, fees, translations).
2. Add the licensed item text to the mobile app in a new `lib/epds.ts`, mirroring `lib/phq9.ts`. Store answers as the position of the chosen option, top = 0, in printed order.
3. Set `itemTextIncluded: true` for `epds` in `src/screening.js` and add a scoring-parity test between the app and the backend.
4. Items 1, 2 and 4 are scored top = 0 to bottom = 3; items 3 and 5 to 10 are reversed. Maximum 30. Any non-zero score on question 10 needs same-day follow-up.

## Limits to state honestly

- Synthetic data shows the rules behave as designed. It says nothing about how well they identify real people who need support.
- A screening score is not a diagnosis, and neither is anything else this app shows.
- Cut-offs used here come from general-population and perinatal guidance; local validation (for example Indian-language versions) has not been checked in this project.
- Crisis numbers: Tele-MANAS 14416 (free, 24x7) and emergency 112 for India. Re-verify before real use.
