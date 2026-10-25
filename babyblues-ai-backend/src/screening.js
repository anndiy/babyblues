/**
 * Screening-questionnaire scoring. Instrument-agnostic: only scoring rules live here, never item text.
 *
 * PHQ-9  - free to reproduce and distribute (Pfizer notice: "No permission required to reproduce, translate,
 *          display or distribute"). Item text lives in the mobile app.
 * EPDS   - copyright Royal College of Psychiatrists; written permission is required to distribute it.
 *          Scoring rules are implemented and tested here so it can be switched on once permission is granted,
 *          but NO EPDS item text is included anywhere in this project.
 *
 * Answers are stored as the position of the chosen option, top = 0 ... bottom = 3, in printed order.
 * Scoring is recomputed from these answers on the server; stored totals are never trusted.
 *
 * Sources checked 25 Oct 2026: EPDS scoring/cut-offs (Black Dog Institute copy: items 1,2,4 scored top=0..bottom=3,
 * items 3,5-10 reverse; 0-9 / 10-12 / 13+; any non-zero item 10 needs same-day evaluation);
 * PHQ-9 bands 0-4 / 5-9 / 10-14 / 15-19 / 20-27 and perinatal caveat about somatic items 3-5.
 * This is a screening aid, never a diagnosis.
 */

export const FRESH_DAYS = 21; // PHQ-9 asks about "the last 2 weeks"; EPDS about "the past 7 days".

export const INSTRUMENTS = Object.freeze({
  phq9: Object.freeze({
    id: 'phq9', name: 'PHQ-9', itemCount: 9, maxScore: 27, safetyItemIndex: 8,
    concernAt: 10, strongAt: 15, somaticItemIndexes: [2, 3, 4],
    itemTextIncluded: true
  }),
  epds: Object.freeze({
    id: 'epds', name: 'EPDS', itemCount: 10, maxScore: 30, safetyItemIndex: 9,
    concernAt: 13, strongAt: null, somaticItemIndexes: [],
    itemTextIncluded: false // pending permission from the Royal College of Psychiatrists
  })
});

const EPDS_FORWARD_ITEMS = new Set([0, 1, 3]); // questions 1, 2 and 4: top option = 0 points

function validAnswers(instrument, answers) {
  return Array.isArray(answers) && answers.length === instrument.itemCount &&
    answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 3);
}

function itemScoresFor(instrument, answers) {
  if (instrument.id === 'phq9') return answers.slice();
  return answers.map((a, i) => (EPDS_FORWARD_ITEMS.has(i) ? a : 3 - a));
}

export function phq9Band(total) {
  if (total <= 4) return 'minimal';
  if (total <= 9) return 'mild';
  if (total <= 14) return 'moderate';
  if (total <= 19) return 'moderately_severe';
  return 'severe';
}

export function epdsBand(total) {
  if (total <= 9) return 'low';
  if (total <= 12) return 'watch';
  return 'likely';
}

/** Returns { valid:false } for anything malformed; never throws on bad input. */
export function scoreScreening(input) {
  const { instrument: id, answers } = input ?? {};
  const instrument = Object.hasOwn(INSTRUMENTS, id) ? INSTRUMENTS[id] : undefined;
  if (!instrument || !validAnswers(instrument, answers)) return { valid: false };
  const itemScores = itemScoresFor(instrument, answers);
  const total = itemScores.reduce((a, b) => a + b, 0);
  const safetyFlag = itemScores[instrument.safetyItemIndex] > 0;
  const somaticPoints = instrument.somaticItemIndexes.reduce((sum, i) => sum + itemScores[i], 0);
  return {
    valid: true,
    instrument: instrument.id,
    name: instrument.name,
    total,
    max: instrument.maxScore,
    band: instrument.id === 'phq9' ? phq9Band(total) : epdsBand(total),
    concern: total >= instrument.concernAt,
    strong: instrument.strongAt != null && total >= instrument.strongAt,
    safetyFlag,
    somaticPoints,
    // Sleep, tiredness and appetite questions are affected by caring for a newborn (PHQ-9 only).
    somaticHeavy: total >= instrument.concernAt && instrument.somaticItemIndexes.length > 0 && somaticPoints * 2 >= total
  };
}

/**
 * Summarise the most recent valid response. `rows` need { instrument, answers, created_at }.
 * Old responses are still reported but marked not fresh so they do not drive the current level;
 * an old safety flag is surfaced as `recentSafetyFlag` only within FRESH_DAYS.
 */
export function summarizeLatestScreening(rows, now = new Date()) {
  const candidates = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ row, t: new Date(row?.created_at).getTime(), score: scoreScreening(row ?? {}) }))
    .filter((c) => c.score.valid && Number.isFinite(c.t) && c.t <= now.getTime() + 60000)
    .sort((a, b) => b.t - a.t);
  if (!candidates.length) return null;
  const { row, t, score } = candidates[0];
  const ageDays = Math.max(0, Math.floor((now.getTime() - t) / 86400000));
  const fresh = ageDays <= FRESH_DAYS;
  return {
    instrument: score.instrument, name: score.name, total: score.total, max: score.max, band: score.band,
    completedAt: new Date(t).toISOString(), ageDays, fresh,
    concern: fresh && score.concern, strong: fresh && score.strong,
    safetyFlag: fresh && score.safetyFlag,
    somaticHeavy: fresh && score.somaticHeavy
  };
}
