
const clean = (value, max) =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : '';

function getDataStatus(features) {
  // Backwards-compatible with features generated before dataStatus was added.
  if (features.dataStatus) return features.dataStatus;

  if ((features.currentPeriod?.checkinCount ?? 0) < 3) {
    return 'insufficient_recent_data';
  }

  if ((features.previousPeriod?.checkinCount ?? 0) < 3) {
    return 'recent_snapshot_only';
  }

  return features.comparisonEligible
    ? 'comparison_available'
    : 'insufficient_recent_data';
}

function snapshotSummary(features) {
  const snapshot = features.currentSnapshot ?? {};
  const available = [
    ['mood', 'mood'],
    ['stress', 'stress'],
    ['energy', 'energy'],
  ]
    .filter(([key]) => Number.isFinite(snapshot[key]))
    .map(([key, label]) => `${label}: ${snapshot[key]}/5`);

  if (Number.isFinite(snapshot.sleep_hours)) {
    available.push(`reported sleep: ${snapshot.sleep_hours} hours`);
  }

  if (!available.length) {
    return `You've recorded ${features.currentPeriod?.checkinCount ?? 0} recent check-ins. More complete data may help build a useful personal snapshot. This is not a trend assessment.`;
  }

  return `Your recent check-ins provide a snapshot, not a trend. Recorded averages: ${available.join('; ')}. These values describe only the information entered and do not establish a cause or diagnosis.`;
}

function fallback(features) {
  const status = getDataStatus(features);

  const relevant = (features.signals ?? []).filter((signal) =>
    ['mood', 'stress', 'energy', 'sleep_hours'].includes(signal.key)
  );

  const worsening = relevant.filter(
    (signal) => signal.direction === 'worsening'
  );

  let summary;

  if (status === 'insufficient_recent_data') {
    summary =
      'There are not yet enough recent check-ins to describe a reliable snapshot. You can keep checking in at your own pace; missing entries do not indicate how you are doing.';
  } else if (status === 'recent_snapshot_only') {
    summary = snapshotSummary(features);
  } else if (worsening.length) {
    summary =
      `Some self-reported measures changed in a direction that may be worth noticing: ${worsening
        .map((signal) => signal.title.toLowerCase())
        .join(', ')}. These observations do not establish a cause or a diagnosis.`;
  } else {
    summary =
      'The available self-reported measures do not show a clear worsening pattern across the two comparison windows. This does not prove that everything is fine; the data only reflects what was recorded.';
  }

  return {
    summary,
    context:
      status === 'recent_snapshot_only'
        ? 'There is enough recent information for a limited snapshot, but not enough earlier information for a meaningful comparison. Care-log and app-use counts are context only.'
        : 'Care-log and check-in frequency are app-use context only. They are not evidence of mental health, parenting ability, or caregiving quality.',
    nextSteps: [
      'Consider whether anything has felt different for you recently, if you feel comfortable reflecting on it.',
      'Continue checking in only when useful to you; there is no need to maintain a perfect record.',
      'If difficulties persist or concern you, consider talking with a qualified healthcare professional or someone you trust.',
    ],
    disclaimer:
      'Experimental AI-assisted reflection only. Not a screening tool, diagnosis, or validated prediction.',
  };
}

export async function interpretFeatures(features) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      ...fallback(features),
      provider: 'fallback_no_api_key',
    };
  }

  const model =
    process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const status = getDataStatus(features);

  const prompt = `You are the explanation layer for BabyBlues, a postpartum-parent self-care prototype.

Explain only the aggregate data provided below in calm, nonjudgmental language.

DATA STATUS: ${status}

Rules:
- Never diagnose, screen for, or predict postpartum depression or any other condition.
- Never output a risk score, probability, severity label, or clinical classification.
- Never infer mental state, attachment, caregiving quality, or safety from baby-care log frequency or app engagement. These are context only.
- Do not invent causes, symptoms, facts, or trends.
- Distinguish observations from interpretation.
- Missing data is not evidence that someone is doing well or poorly.
- Offer low-risk, optional reflective next steps.
- If difficulties persist or concern the user, suggest speaking with a qualified healthcare professional or trusted support person.

Data-status rules:
- If status is "insufficient_recent_data", explain that there is not enough recent data for a reliable snapshot. Do not draw conclusions from individual values.
- If status is "recent_snapshot_only", describe available currentSnapshot averages neutrally as a limited snapshot. Explicitly say there is not enough historical data to establish a trend. Do not call anything improving, worsening, or stable.
- If status is "comparison_available", you may describe changes supported by the comparison signals. Do not infer causes or claim that a lack of worsening proves wellbeing.
- Do not contradict DATA STATUS even if other fields appear inconsistent.

Return JSON only with these fields:
- summary: string, at most 500 characters
- context: string, at most 500 characters
- nextSteps: array of 1 to 3 strings, each at most 180 characters
- disclaimer: string, at most 250 characters

Aggregate features:
${JSON.stringify(features)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body?.error?.message ||
          `Gemini request failed (${response.status})`
      );
    }

    const raw = body?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!raw) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = JSON.parse(raw);

    const result = {
      summary: clean(parsed.summary, 500),
      context: clean(parsed.context, 500),
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps
            .slice(0, 3)
            .map((item) => clean(item, 180))
            .filter(Boolean)
        : [],
      disclaimer:
        clean(parsed.disclaimer, 250) ||
        'This is not a diagnosis or validated prediction.',
    };

    if (!result.summary) {
      throw new Error(
        'Gemini response did not include a summary.'
      );
    }

    if (!result.nextSteps.length) {
      result.nextSteps = fallback(features).nextSteps;
    }

    return { ...result, provider: model };
  } catch (error) {
    return {
      ...fallback(features),
      provider: 'fallback_ai_unavailable',
      providerError: clean(error?.message, 200),
    };
  }
}
