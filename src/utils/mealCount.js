function computeDailyCount(log = {}, countingRule = 'bothEqualsOne') {
  const { breakfast, dinner } = log || {};
  if (typeof log.overrideCount === 'number' && !Number.isNaN(log.overrideCount)) {
    return Number(log.overrideCount);
  }
  switch (countingRule) {
    case 'perMeal':
      return (breakfast ? 1 : 0) + (dinner ? 1 : 0);
    case 'perMealHalf':
      return (breakfast ? 0.5 : 0) + (dinner ? 0.5 : 0);
    case 'anyMealIsOne':
      return breakfast || dinner ? 1 : 0;
    case 'bothEqualsOne':
    default:
      return breakfast && dinner ? 1 : 0;
  }
}

module.exports = { computeDailyCount };
