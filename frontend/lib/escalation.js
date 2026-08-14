export const ESCALATION_THRESHOLDS = { ward: 100, city: 1000, state: 10000, national: 50000 };
export const NEXT_LEVEL = { ward: 'city', city: 'state', state: 'national', national: null };
export const LEVEL_LABEL = { ward: 'Locality', city: 'City', state: 'State', national: 'Country' };

// Given an issue's current level + vote count, work out how far it is from
// tipping into the next tier. Returns null once it's already at the top.
export function nextEscalationInfo(escalationLevel, voteCount) {
  const nextLevel = NEXT_LEVEL[escalationLevel];
  if (!nextLevel) return null;

  const nextThreshold = ESCALATION_THRESHOLDS[nextLevel];
  const currentThreshold = ESCALATION_THRESHOLDS[escalationLevel] || 0;
  const needed = Math.max(0, nextThreshold - voteCount);
  const span = nextThreshold - currentThreshold;
  const progressed = Math.max(0, voteCount - currentThreshold);
  const pct = Math.min(100, Math.round((progressed / span) * 100));

  return { nextLevel, nextThreshold, needed, pct };
}
