/**
 * Deterministic synthetic data for BabyBlues demos and software tests.
 * This is fictional software-test data, not clinical data or a validated risk model.
 */

export const SCENARIOS = Object.freeze({
  steady: {
    title: 'Steady routine',
    description: 'Fairly consistent care logging and self-reported wellbeing.',
    displayName: 'Demo Baby — Steady',
    checkinInterval: 2,
    care: { previous: [3, 6], current: [3, 6] },
    wellbeing: {
      previous: { mood: 4, stress: 2, energy: 4, sleep_hours: 6.8, appetite: 4 },
      current: { mood: 4, stress: 2, energy: 4, sleep_hours: 6.7, appetite: 4 }
    }
  },
  declining_wellbeing: {
    title: 'Changing self-reported wellbeing',
    description: 'Self-reported measures trend less favourably in the recent window. This is not a diagnosis.',
    displayName: 'Demo Baby — Changing Pattern',
    checkinInterval: 2,
    care: { previous: [3, 6], current: [2, 5] },
    wellbeing: {
      previous: { mood: 4.1, stress: 2.0, energy: 4.0, sleep_hours: 6.9, appetite: 4.0 },
      current: { mood: 2.6, stress: 4.0, energy: 2.5, sleep_hours: 4.8, appetite: 2.8 }
    }
  },
  recovery: {
    title: 'Improving self-reported wellbeing',
    description: 'Recent self-reported measures trend more favourably than the previous window.',
    displayName: 'Demo Baby — Recovery Pattern',
    checkinInterval: 2,
    care: { previous: [2, 5], current: [3, 6] },
    wellbeing: {
      previous: { mood: 2.7, stress: 4.0, energy: 2.6, sleep_hours: 4.6, appetite: 2.7 },
      current: { mood: 4.0, stress: 2.4, energy: 3.9, sleep_hours: 6.6, appetite: 4.0 }
    }
  },
  irregular_care_activity: {
    title: 'Irregular care logging, stable check-ins',
    description: 'Care-log activity changes while self-reported wellbeing remains broadly stable. Care-log counts are context only.',
    displayName: 'Demo Baby — Irregular Logs',
    checkinInterval: 2,
    care: { previous: [4, 7], current: [0, 2] },
    wellbeing: {
      previous: { mood: 4.0, stress: 2.5, energy: 3.8, sleep_hours: 6.2, appetite: 3.8 },
      current: { mood: 4.0, stress: 2.4, energy: 3.9, sleep_hours: 6.3, appetite: 3.8 }
    }
  },
  sparse_data: {
    title: 'Insufficient history',
    description: 'Too few check-ins to compare both time windows meaningfully.',
    displayName: 'Demo Baby — Sparse History',
    checkinInterval: null,
    care: { previous: [0, 2], current: [0, 2] },
    wellbeing: {
      previous: { mood: 3, stress: 3, energy: 3, sleep_hours: 5.5, appetite: 3 },
      current: { mood: 3, stress: 3, energy: 3, sleep_hours: 5.5, appetite: 3 }
    }
  },
  conflicting_signals: {
    title: 'Different signals tell different stories',
    description: 'Care-log frequency declines while self-reported wellbeing improves; the app must not equate logging frequency with mental state.',
    displayName: 'Demo Baby — Mixed Signals',
    checkinInterval: 2,
    care: { previous: [4, 7], current: [1, 3] },
    wellbeing: {
      previous: { mood: 2.8, stress: 4.0, energy: 2.8, sleep_hours: 4.8, appetite: 2.8 },
      current: { mood: 3.8, stress: 2.8, energy: 3.8, sleep_hours: 6.2, appetite: 3.8 }
    }
  },
  missing_fields: {
    title: 'Partial check-in fields',
    description: 'Some optional self-reported fields are missing while other values remain available.',
    displayName: 'Demo Baby — Partial Data',
    checkinInterval: 2,
    care: { previous: [2, 5], current: [2, 5] },
    wellbeing: {
      previous: { mood: 3.7, stress: 2.8, energy: 3.5, sleep_hours: 6.1, appetite: 3.5 },
      current: { mood: 3.5, stress: 3.0, energy: 3.3, sleep_hours: null, appetite: null }
    }
  }
  ,
  combined_signals: {
    title: 'Self-report and usage both shifted',
    description: 'Check-ins trend less favourably AND logging becomes sparser, more overnight, with longer gaps. Highest support level; still not a diagnosis.',
    displayName: 'Demo Baby \u2014 Combined Signals',
    checkinInterval: 2,
    care: { previous: [3, 6], current: [1, 3] },
    usage: { previous: { nightShare: 0.12, zeroDayProb: 0.03 }, current: { nightShare: 0.38, zeroDayProb: 0.3 } },
    wellbeing: {
      previous: { mood: 4.1, stress: 2.0, energy: 4.0, sleep_hours: 6.9, appetite: 4.0 },
      current: { mood: 2.4, stress: 4.2, energy: 2.3, sleep_hours: 4.6, appetite: 2.6 }
    }
  },
  usage_shift_no_checkins: {
    title: 'Logging changed and check-ins stopped',
    description: 'Logging becomes sparser and more overnight, and no recent check-ins exist. Usage alone may only prompt a gentle, optional check-in.',
    displayName: 'Demo Baby \u2014 Quiet Period',
    checkinInterval: 2,
    checkinOnly: 'previous',
    care: { previous: [3, 6], current: [1, 3] },
    usage: { previous: { nightShare: 0.12, zeroDayProb: 0.03 }, current: { nightShare: 0.38, zeroDayProb: 0.3 } },
    wellbeing: {
      previous: { mood: 4.0, stress: 2.3, energy: 3.9, sleep_hours: 6.7, appetite: 4.0 },
      current: { mood: 4.0, stress: 2.3, energy: 3.9, sleep_hours: 6.7, appetite: 4.0 }
    }
  }
});

function makeRng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const jitter = (rng, amount) => (rng() * 2 - 1) * amount;
const round1 = (value) => value == null ? null : Math.round(value * 10) / 10;
const iso = (date) => date.toISOString();

function careCountForDay(rng, bounds, scenario, dayOffset, days) {
  let [min, max] = bounds;
  if (scenario === 'declining_wellbeing' && dayOffset < 28) max = Math.max(min, max - 1);
  if (scenario === 'irregular_care_activity' && dayOffset < 28 && rng() < 0.2) return 0;
  if (scenario === 'sparse_data') return rng() < 0.72 ? 0 : 1;
  return Math.floor(min + rng() * (max - min + 1));
}

function checkinBaseForDay(config, dayOffset, scenario) {
  const window = dayOffset < 28 ? 'current' : 'previous';
  const base = config.wellbeing[window];
  if (scenario === 'declining_wellbeing' && window === 'current') {
    const progress = (27 - dayOffset) / 27;
    return { ...base, mood: 3.2 - progress * 1.0, stress: 3.3 + progress * 1.0, energy: 3.2 - progress * 0.8, sleep_hours: 5.8 - progress * 1.2, appetite: 3.3 - progress * 0.7 };
  }
  if (scenario === 'recovery' && window === 'current') {
    const progress = (27 - dayOffset) / 27;
    return { ...base, mood: 3.2 + progress * 0.9, stress: 3.5 - progress * 0.9, energy: 3.1 + progress * 0.8, sleep_hours: 5.4 + progress * 1.0, appetite: 3.2 + progress * 0.7 };
  }
  return base;
}

function createCheckin(config, scenario, dayOffset, rng, timestamp) {
  const base = checkinBaseForDay(config, dayOffset, scenario);
  const missing = scenario === 'missing_fields' && dayOffset < 28;
  return {
    mood: clamp(Math.round(base.mood + jitter(rng, 0.35)), 1, 5),
    stress: clamp(Math.round(base.stress + jitter(rng, 0.35)), 1, 5),
    energy: clamp(Math.round(base.energy + jitter(rng, 0.35)), 1, 5),
    sleep_hours: missing && rng() < 0.65 ? null : round1(clamp(base.sleep_hours + jitter(rng, 0.9), 0, 14)),
    appetite: missing && rng() < 0.65 ? null : clamp(Math.round(base.appetite + jitter(rng, 0.35)), 1, 5),
    created_at: iso(timestamp)
  };
}

function createCareLog(rng, babyId, parentId, timestamp, index) {
  const eventTypes = ['feeding', 'feeding', 'sleep', 'diaper'];
  const event_type = eventTypes[Math.floor(rng() * eventTypes.length)];
  const durationHours = round1(0.5 + rng() * 2.5);
  const loggedAt = new Date(timestamp);
  const row = {
    parent_id: parentId,
    baby_id: babyId,
    event_type,
    logged_at: iso(loggedAt),
    details: { note: `Synthetic demo record ${index}` },
    feeding_type: null,
    amount_ml: null,
    sleep_started_at: null,
    sleep_ended_at: null,
    diaper_type: null
  };
  if (event_type === 'feeding') {
    row.feeding_type = ['breastfeeding', 'expressed_milk', 'formula'][Math.floor(rng() * 3)];
    row.amount_ml = row.feeding_type === 'breastfeeding' ? null : Math.round(40 + rng() * 100);
  } else if (event_type === 'sleep') {
    row.sleep_ended_at = iso(loggedAt);
    row.sleep_started_at = iso(new Date(loggedAt.getTime() - durationHours * 3600000));
  } else {
    row.diaper_type = ['wet', 'dirty', 'both'][Math.floor(rng() * 3)];
  }
  return row;
}

/** Generate a single scenario for one dedicated demo account. */
export function generateScenario(name = 'steady', options = {}) {
  const config = SCENARIOS[name];
  if (!config) throw new Error(`Unknown scenario "${name}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  const days = Number(options.days ?? 56);
  if (!Number.isInteger(days) || days < 7 || days > 90) throw new Error('days must be an integer between 7 and 90');
  const now = options.now instanceof Date ? new Date(options.now) : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  const seed = Number(options.seed ?? 42);
  // Hours are chosen in the parent's LOCAL time (default India, UTC+5:30) and stored as UTC, like the real app.
  const utcOffsetMinutes = Number(options.utcOffsetMinutes ?? 330);
  const rng = makeRng(seed);
  const parentId = options.parentId ?? 'SYNTHETIC_PARENT_ID';
  const babyId = options.babyId ?? 'SYNTHETIC_BABY_ID';
  const baby = {
    parent_id: parentId,
    display_name: config.displayName,
    date_of_birth: new Date(now.getTime() - 70 * 86400000).toISOString().slice(0, 10)
  };
  const careLogs = [];
  const checkins = [];
  let index = 1;

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(now);
    dayStart.setUTCDate(dayStart.getUTCDate() - dayOffset);
    dayStart.setUTCHours(0, 0, 0, 0);
    const [min, max] = dayOffset < 28 ? config.care.current : config.care.previous;
    const usageCfg = config.usage ? (dayOffset < 28 ? config.usage.current : config.usage.previous) : null;
    let count = careCountForDay(rng, [min, max], name, dayOffset, days);
    if (usageCfg && rng() < usageCfg.zeroDayProb) count = 0;
    for (let j = 0; j < count; j++) {
      // Local hour: overnight (0-5) with the scenario's night share, otherwise 6-23.
      const overnight = usageCfg ? rng() < usageCfg.nightShare : false;
      const localHourOfDay = usageCfg
        ? (overnight ? rng() * 5 : 6 + rng() * 17)
        : 1 + rng() * 22;
      const timestamp = new Date(dayStart.getTime() - utcOffsetMinutes * 60000 + Math.floor(localHourOfDay * 3600000) + Math.floor(rng() * 600000));
      if (timestamp > now) continue;
      careLogs.push(createCareLog(rng, babyId, parentId, timestamp, index++));
    }

    let shouldCheckin = false;
    if (name === 'sparse_data') {
      shouldCheckin = dayOffset === 5 || dayOffset === 36;
    } else {
      const interval = config.checkinInterval ?? 2;
      shouldCheckin = dayOffset % interval === 0;
    }
    if (config.checkinOnly === 'previous' && dayOffset < 28) shouldCheckin = false;
    if (shouldCheckin && dayStart <= now) {
      const checkinTime = new Date(dayStart.getTime() + (18 + Math.floor(rng() * 4)) * 3600000);
      if (checkinTime <= now) checkins.push(createCheckin(config, name, dayOffset, rng, checkinTime));
    }
  }

  careLogs.sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  checkins.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return {
    metadata: {
      generated: true,
      scenario: name,
      title: config.title,
      description: config.description,
      seed,
      generatedAt: iso(now),
      historyDays: days,
      parentId,
      babyId,
      counts: { babies: 1, careLogs: careLogs.length, wellbeingCheckins: checkins.length },
      disclaimer: 'Entirely synthetic software-test data. Not real people, clinical evidence, or a validated prediction.'
    },
    baby,
    careLogs,
    checkins
  };
}
