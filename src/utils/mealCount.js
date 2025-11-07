function clampQuarter(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return Math.max(0, Math.min(2, Math.floor(v)))
}

function computeDailyCount(log = {}, countingRule = 'bothEqualsOne') {
  const { breakfast, dinner } = log || {};
  const bq = clampQuarter(log?.breakfastQuarters)
  const dq = clampQuarter(log?.dinnerQuarters)
  if (typeof log.overrideCount === 'number' && !Number.isNaN(log.overrideCount)) {
    return Number(log.overrideCount);
  }
  switch (countingRule) {
    case 'perMeal':
      // quarters take precedence if present (2 quarters == 1 per meal)
      if (bq !== null || dq !== null) return (bq || 0)/2 + (dq || 0)/2
      return (breakfast ? 1 : 0) + (dinner ? 1 : 0);
    case 'perMealHalf':
      // Each quarter = 0.25; fall back to legacy booleans (0.5 each)
      if (bq !== null || dq !== null) return 0.25 * ((bq || 0) + (dq || 0))
      return (breakfast ? 0.5 : 0) + (dinner ? 0.5 : 0);
    case 'anyMealIsOne':
      return (bq > 0 || dq > 0) || (breakfast || dinner) ? 1 : 0;
    case 'bothEqualsOne':
    default:
      if (bq !== null || dq !== null) return (bq >= 1 && dq >= 1) ? 1 : 0
      return breakfast && dinner ? 1 : 0;
  }
}

module.exports = { computeDailyCount };
