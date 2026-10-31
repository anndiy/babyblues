const clean = (value, max) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const SELF_REPORT_KEYS = ['mood', 'stress', 'energy', 'sleep_hours'];
const PLAIN_NAME = { mood: 'your mood', stress: 'your stress', energy: 'your energy', sleep_hours: 'your sleep' };

const list = (items) => items.length <= 1 ? (items[0] || '')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * Turn the numbers into a small, human "situation" so the reply can be written for THIS parent
 * rather than for every record. Care-log counts are deliberately not part of this: they are context
 * only and never evidence of how a parent is feeling.
 */
export function describeSituation(features, { supportLevel, usage } = {}) {
  const signals = (features?.signals ?? []).filter((s) => SELF_REPORT_KEYS.includes(s.key));
  const by = (direction) => signals.filter((s) => s.direction === direction).map((s) => s.key);
  const worsening = by('worsening');
  const improving = by('improving');
  const stable = by('stable');
  const snapshot = features?.currentSnapshot ?? {};
  const level = supportLevel?.level ?? null;

  let pattern;
  if (features?.dataStatus === 'insufficient_recent_data') pattern = 'too_few_checkins';
  else if (features?.dataStatus === 'recent_snapshot_only') pattern = 'recent_snapshot_only';
  else if (worsening.length >= 2) pattern = 'harder_stretch';
  else if (worsening.length === 1) pattern = 'one_area_dipped';
  else if (improving.length >= 1) pattern = 'brighter_stretch';
  else pattern = 'steady';

  const lowMood = Number.isFinite(snapshot.mood) && snapshot.mood <= 2.5;
  const highStress = Number.isFinite(snapshot.stress) && snapshot.stress >= 4;
  const poorSleep = Number.isFinite(snapshot.sleep_hours) && snapshot.sleep_hours < 5;

  return {
    pattern,
    worsening, improving, stable,
    snapshot,
    tiredAndLow: lowMood || highStress || poorSleep,
    lowMood, highStress, poorSleep,
    supportLevel: level,
    // Only used so the reply can be a soft invitation when there are no check-ins; never as a sign of concern.
    loggingChanged: usage?.status === 'notable_change'
  };
}

/** Warm, fixed wording used if the AI is unavailable, and always when a safety answer was flagged. */
function fallback(features, situation = describeSituation(features)) {
  const { pattern, worsening, improving, lowMood, highStress, poorSleep } = situation;
  const names = (keys) => list(keys.map((k) => PLAIN_NAME[k]));
  const reachOut = 'If the heavy days keep coming, a doctor, midwife or someone you trust would genuinely want to hear about it. You would not be a burden.';
  let summary;
  let context;
  let nextSteps;

  switch (pattern) {
    case 'harder_stretch':
      summary = `The last few weeks look like they have been harder on you, especially ${names(worsening)}. That is a lot to carry while looking after a little one, and it makes sense to want to pause and notice it.`;
      context = 'These check-ins cannot tell us why things feel heavier. You know your own days best, and nothing here says you are doing anything wrong.';
      nextSteps = [
        'Choose one small thing that would make tomorrow a little easier, and ask someone to help with it.',
        reachOut
      ];
      break;
    case 'one_area_dipped':
      summary = `Most things look fairly steady, but ${names(worsening)} has felt a bit harder lately. It is worth being kind to yourself about that.`;
      context = 'One area dipping is common with a new baby and does not mean something is wrong. It just might be worth a little extra care right now.';
      nextSteps = [
        highStress ? 'If you can, take ten minutes that are only for you today, even just a warm drink in quiet.'
          : poorSleep ? 'Ask someone you trust to take one stretch of baby time so you can rest, even a short one.'
            : 'Notice what has been different this past week, and share it with someone close to you.',
        'Keep checking in when you can; it helps you see how you are doing over time.'
      ];
      break;
    case 'brighter_stretch':
      summary = `Things look a little brighter lately, with ${names(improving)} moving in a better direction. You have been working hard, and it is good to see some of it feel lighter.`;
      context = 'Good stretches and tough stretches can both come and go, and either is normal. This is simply a nice moment to notice.';
      nextSteps = [
        'Think about what has helped recently, and give yourself credit for it.',
        'Keep the small routines or support that seem to be working.'
      ];
      break;
    case 'recent_snapshot_only':
      summary = lowMood || highStress
        ? 'Your recent check-ins suggest things have felt quite heavy lately. Thank you for keeping track, because that takes effort when your days are full.'
        : 'Thank you for checking in recently. It is a small act of looking after yourself, even on busy days.';
      context = 'There is not enough earlier history yet to compare, so this is just a snapshot of how things have felt recently.';
      nextSteps = lowMood || highStress
        ? ['If today feels hard, tell one person you trust how you are really doing.', reachOut]
        : ['Keep checking in when you can, and a clearer picture will build over time.'];
      break;
    case 'too_few_checkins':
      summary = 'There are not many check-ins yet, so it is too early for me to say much about how you have been. That is completely fine, and you can go at your own pace.';
      context = 'Missing check-ins do not mean anything is wrong. A new baby leaves little spare time.';
      nextSteps = [
        'When you have a quiet minute, a quick check-in helps us understand how you are doing.',
        'However you are feeling, you are welcome to talk to someone you trust about it.'
      ];
      break;
    default:
      summary = 'Your recent check-ins look fairly steady, with no big swings from your earlier weeks. That is something to appreciate in the middle of such a demanding time.';
      context = 'Steady does not mean easy, and this only reflects what you have chosen to record. How you feel matters more than any pattern.';
      nextSteps = [
        'Keep doing whatever is helping you get through the days.',
        'If something starts to feel off, you can always reach out to someone you trust.'
      ];
  }

  return {
    summary,
    context,
    nextSteps,
    disclaimer: 'A gentle reflection, not a diagnosis or a screening result. It cannot replace talking to a healthcare professional.'
  };
}

/** A person who flagged thoughts of self-harm gets a human, fixed message. No AI text sits between them and help. */
function safetyMessage() {
  return {
    summary: 'Thank you for being honest about how hard things have been. What you are feeling matters, and you do not have to carry it by yourself.',
    context: 'Please reach out to one of the support numbers shown with this reflection, or tell someone you trust today. If you or your baby may be in immediate danger, call emergency services right away.',
    nextSteps: [
      'Contact a helpline or a healthcare professional today, and tell them what you told us.',
      'Let a person close to you know you are struggling, and ask them to stay with you.'
    ],
    disclaimer: 'BabyBlues is not monitored in real time and cannot respond to an emergency.'
  };
}

// Output we never want shown, even if the model produces it.
const UNSAFE_OUTPUT = /(you (have|are suffering from|are experiencing|probably have|likely have) (postpartum|ppd|depress|anxiety)|diagnos(is|ed) (of|with)|\brisk (score|level)\b|bad (mother|mom|parent)|neglect)/i;

function buildPrompt(features, situation) {
  return `You are the voice of BabyBlues, a warm companion for new parents. Someone has just asked for a reflection on how they have been doing. Write it the way a kind, perceptive friend or a good midwife would speak to them: directly to "you", gentle, real, never clinical.

What you know about this parent right now:
${JSON.stringify(situation)}

The detailed measures behind it (averages are 1-5 unless stated, higher is better except stress):
${JSON.stringify(features.signals.filter((s) => SELF_REPORT_KEYS.includes(s.key)))}

How to write it:
- Make it specific to this person. Mention the particular areas that moved (for example sleep or stress) in plain words, and name what is going well if anything is. Two parents with different data must get clearly different replies.
- Use the pattern to set the tone. harder_stretch: tender and steady, no cheerfulness, acknowledge how much they are carrying. one_area_dipped: light and kind, focus on that one area. brighter_stretch: warm and glad, without overdoing it. steady: calm appreciation. recent_snapshot_only: acknowledge they checked in and describe the snapshot without comparing. too_few_checkins: no analysis, a welcoming and low-pressure invitation.
- Lead with the person, not the numbers. Quote at most one number, and only if it helps. Never list statistics.
- Acknowledge the effort of looking after a baby and of checking in at all, in a fresh way each time. Avoid stock phrases like "it seems", "the data shows", "it is important to", "remember to".
- Next steps: one to three small, doable, caring things that fit their situation (for example, asking for one stretch of rest if sleep is low, a short break if stress is high, telling someone close if mood is low). Offer them as gentle options, never as orders.
- If supportLevel is talk_to_someone or talk_to_someone_priority, or tiredAndLow is true, include a warm, non-alarming nudge to talk to a doctor, midwife or someone they trust, framed as something that would help them rather than a warning. Never suggest it is a sign that something is wrong with them.
- If loggingChanged is true and the parent has few or no check-ins, you may add a soft invitation to check in. Never treat baby-care logging as a sign of how they feel or how well they parent.

Hard rules:
- Do not diagnose, name any condition, screen for, or predict postpartum depression or anything else. No risk scores, severity labels or probabilities.
- Do not invent causes, events, symptoms or trends. Do not guess why things changed. You may say you cannot tell why.
- Never imply blame or judgement of their parenting.
- Do not use exclamation marks, emojis or toxic positivity. Do not tell them everything is fine; you can only reflect what they recorded.

Return JSON only with these fields: summary (<=600 chars, 2-4 sentences), context (<=400 chars, 1-2 gentle sentences about what this does and does not tell us), nextSteps (1-3 strings, each <=200 chars), disclaimer (<=250 chars, short and kind, stating this is not a diagnosis).`;
}

/**
 * @param {object} features  output of extractFeatures
 * @param {{supportLevel?: object, usage?: object}} [extra]  rule-based results, used only to shape tone
 */
export async function interpretFeatures(features, extra = {}) {
  const situation = describeSituation(features, extra);
  if (extra?.supportLevel?.safetyAlert) return { ...safetyMessage(), provider: 'fixed_safety_message' };
  if (!process.env.GEMINI_API_KEY) return { ...fallback(features, situation), provider: 'fallback_no_api_key' };

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(features, situation) }] }],
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(20000)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `Gemini request failed (${response.status})`);
    const raw = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!raw) throw new Error('Gemini returned an empty response.');
    const parsed = JSON.parse(raw);
    const safeFallback = fallback(features, situation);
    const result = {
      summary: clean(parsed.summary, 600),
      context: clean(parsed.context, 400) || safeFallback.context,
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3).map((x) => clean(x, 200)).filter(Boolean) : [],
      disclaimer: clean(parsed.disclaimer, 250) || safeFallback.disclaimer
    };
    if (!result.summary) throw new Error('Gemini response did not include a summary.');
    if (!result.nextSteps.length) result.nextSteps = safeFallback.nextSteps;
    const everything = [result.summary, result.context, result.disclaimer, ...result.nextSteps].join(' ');
    if (UNSAFE_OUTPUT.test(everything)) throw new Error('Model output failed the safety wording check.');
    return { ...result, provider: model };
  } catch (error) {
    return { ...fallback(features, situation), provider: 'fallback_ai_unavailable', providerError: clean(error?.message, 200) };
  }
}