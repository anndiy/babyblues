const clean = (value, max) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function fallback(features) {
  const relevant = features.signals.filter((s) => ['mood', 'stress', 'energy', 'sleep_hours'].includes(s.key));
  const worsening = relevant.filter((s) => s.direction === 'worsening');
  const summary = !features.comparisonEligible
    ? 'There is not enough recent check-in data across both periods for a meaningful comparison. You can use BabyBlues at your own pace.'
    : worsening.length
      ? `Some self-reported measures changed in a direction that may be worth noticing: ${worsening.map((s) => s.title.toLowerCase()).join(', ')}. These changes do not establish a cause or a diagnosis.`
      : 'The available self-reported measures do not show a clear worsening pattern across the two comparison windows. This does not prove that everything is fine; the data only reflects what was recorded.';
  return {
    summary,
    context: 'Care-log and check-in frequency are app-use context only. They are not evidence of mental health, parenting ability, or caregiving quality.',
    nextSteps: [
      'Consider what, if anything, has felt different for you recently.',
      'If low mood, anxiety, stress, or sleep difficulties persist or concern you, consider speaking with a healthcare professional or someone you trust.'
    ],
    disclaimer: 'Experimental AI-assisted reflection only. Not a screening tool, diagnosis, or validated prediction.'
  };
}

export async function interpretFeatures(features) {
  if (!process.env.GEMINI_API_KEY) return { ...fallback(features), provider: 'fallback_no_api_key' };
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const prompt = `You are the explanation layer for BabyBlues, a postpartum-parent self-care prototype.
Explain only the aggregate data below in calm, nonjudgmental language.
Rules:
- Do not diagnose, screen for, or predict postpartum depression or any condition.
- Do not output a risk score, probability, severity label, or clinical classification.
- Never infer a parent's mental state, attachment, caregiving quality, or safety from baby-care log frequency or app engagement. Those are context only.
- Do not invent causes, symptoms, facts, or trends.
- If fewer than 3 check-ins exist in either comparison window, say there is insufficient data for a meaningful comparison.
- Distinguish observations from interpretation. Offer low-risk reflective next steps.
- If difficulties persist or concern the user, suggest talking with a qualified healthcare professional or trusted support person.
- Return JSON only: summary (<=500 chars), context (<=500 chars), nextSteps (1-3 strings <=180 chars each), disclaimer (<=250 chars).
Aggregate features:
${JSON.stringify(features)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(20000)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `Gemini request failed (${response.status})`);
    const raw = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!raw) throw new Error('Gemini returned an empty response.');
    const parsed = JSON.parse(raw);
    const result = {
      summary: clean(parsed.summary, 500),
      context: clean(parsed.context, 500),
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3).map((x) => clean(x, 180)).filter(Boolean) : [],
      disclaimer: clean(parsed.disclaimer, 250) || 'This is not a diagnosis or validated prediction.'
    };
    if (!result.summary) throw new Error('Gemini response did not include a summary.');
    if (!result.nextSteps.length) result.nextSteps = fallback(features).nextSteps;
    return { ...result, provider: model };
  } catch (error) {
    return { ...fallback(features), provider: 'fallback_ai_unavailable', providerError: clean(error?.message, 200) };
  }
}
