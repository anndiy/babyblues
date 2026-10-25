/**
 * Crisis and support resources shown whenever a support level is returned.
 * Verified 24 Oct 2026: Tele-MANAS 14416 is described as a free, 24x7 tele-mental-health service
 * (JIPMER: https://jipmer.edu.in/Tele-MANAS). 112 is India's national emergency number.
 * Re-verify before any real deployment. Add other regions here as needed.
 */
export const CRISIS_RESOURCES = Object.freeze({
  IN: Object.freeze({
    region: 'India',
    emergency: { label: 'Emergency services', number: '112', note: 'If you or your baby may be in immediate danger.' },
    support: [
      { label: 'Tele-MANAS (free, 24x7 mental health support)', number: '14416' }
    ]
  }),
  DEFAULT: Object.freeze({
    region: 'Your area',
    emergency: { label: 'Local emergency number', number: null, note: 'If you or your baby may be in immediate danger, contact your local emergency services.' },
    support: [
      { label: 'Your doctor, midwife, or local mental health helpline', number: null }
    ]
  })
});

export function getCrisisResources(region) {
  return CRISIS_RESOURCES[String(region || '').toUpperCase()] ?? CRISIS_RESOURCES.DEFAULT;
}
