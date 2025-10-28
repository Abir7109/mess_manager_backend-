function computeDailyCount({ breakfast, dinner }, countingRule = 'bothEqualsOne') {
  switch (countingRule) {
    case 'perMeal':
      return (breakfast ? 1 : 0) + (dinner ? 1 : 0);
    case 'anyMealIsOne':
      return breakfast || dinner ? 1 : 0;
    case 'bothEqualsOne':
    default:
      return breakfast && dinner ? 1 : 0;
  }
}

module.exports = { computeDailyCount };
