/**
 * PHQ-9 questionnaire: official item wording, scoring, and result messages.
 *
 * The PHQ-9 was developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues,
 * with an educational grant from Pfizer Inc. Its published notice: "No permission required to reproduce,
 * translate, display or distribute." Wording below must not be altered.
 *
 * Scoring mirrors babyblues-ai-backend/src/screening.js. The backend recomputes everything from the saved
 * answers, so this file only decides what to show right after someone finishes.
 *
 * This is a screening aid, not a diagnosis. Sleep, tiredness and appetite questions (items 3-5) are also
 * affected by caring for a newborn.
 */

export const PHQ9_PROMPT = 'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

export const PHQ9_ITEMS: readonly string[] = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead or of hurting yourself in some way',
];

export const PHQ9_OPTIONS: readonly string[] = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

export const PHQ9_DIFFICULTY_PROMPT =
  'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?';

export const PHQ9_DIFFICULTY_OPTIONS: readonly string[] = [
  'Not difficult at all',
  'Somewhat difficult',
  'Very difficult',
  'Extremely difficult',
];

export const PHQ9_ATTRIBUTION =
  'The PHQ-9 was developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission is required to reproduce, translate, display or distribute it.';

export const PHQ9_SAFETY_ITEM_INDEX = 8;
const SOMATIC_ITEM_INDEXES = [2, 3, 4];

export type Phq9Band = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';

export type Phq9Result = {
  total: number;
  band: Phq9Band;
  concern: boolean; // total >= 10
  strong: boolean; // total >= 15
  safetyFlag: boolean; // item 9 answered anything other than "Not at all"
  somaticHeavy: boolean;
};

export function phq9Band(total: number): Phq9Band {
  if (total <= 4) return 'minimal';
  if (total <= 9) return 'mild';
  if (total <= 14) return 'moderate';
  if (total <= 19) return 'moderately_severe';
  return 'severe';
}

/** Returns null unless all nine answers are whole numbers from 0 to 3. */
export function scorePhq9(answers: ReadonlyArray<number | null>): Phq9Result | null {
  if (answers.length !== 9) return null;
  const valid: number[] = [];
  for (const answer of answers) {
    if (answer === null || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
    valid.push(answer);
  }
  const total = valid.reduce((sum, value) => sum + value, 0);
  const somaticPoints = SOMATIC_ITEM_INDEXES.reduce((sum, index) => sum + valid[index], 0);
  return {
    total,
    band: phq9Band(total),
    concern: total >= 10,
    strong: total >= 15,
    safetyFlag: valid[PHQ9_SAFETY_ITEM_INDEX] > 0,
    somaticHeavy: total >= 10 && somaticPoints * 2 >= total,
  };
}

export type Phq9ResultCopy = { headline: string; body: string; showCrisis: boolean };

/** Calm, direct wording. Never names a condition. A positive self-harm answer always wins. */
export function phq9ResultCopy(result: Phq9Result): Phq9ResultCopy {
  if (result.safetyFlag) {
    return {
      headline: 'Thank you for answering honestly',
      body:
        'Your answers mention thoughts of being better off dead or of hurting yourself. You deserve support right now, and you do not have to wait. Please call one of the numbers below or tell someone you trust today. If you or your baby may be in immediate danger, call emergency services. BabyBlues is not monitored by anyone in real time, so it cannot respond to an emergency.',
      showCrisis: true,
    };
  }
  if (result.strong) {
    return {
      headline: 'Your answers suggest things have been very hard',
      body:
        'It would be worth speaking with a healthcare professional or someone you trust soon. This questionnaire is not a diagnosis, and you do not have to work it out alone.',
      showCrisis: true,
    };
  }
  if (result.concern) {
    return {
      headline: 'Your answers suggest things may be hard right now',
      body: result.somaticHeavy
        ? 'Some of these points come from sleep, tiredness and appetite, which a newborn affects for almost everyone. It is still worth mentioning to a healthcare professional or someone you trust. This is not a diagnosis.'
        : 'Consider talking to a healthcare professional or someone you trust. This is not a diagnosis.',
      showCrisis: true,
    };
  }
  if (result.band === 'mild') {
    return {
      headline: 'Some difficult days',
      body: 'Looking after a newborn is demanding. If things start to feel heavier, or last longer, it is okay to talk to someone. You can answer again in a few weeks.',
      showCrisis: false,
    };
  }
  return {
    headline: 'Few difficulties reported',
    body: 'Thank you for taking a moment for yourself. This does not rule out a hard day, and you can reach out whenever you like.',
    showCrisis: false,
  };
}
