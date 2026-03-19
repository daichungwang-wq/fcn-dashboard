function getCouponScore(couponPa) {
  if (couponPa < 10) return -999;
  if (couponPa < 12) return -4;
  if (couponPa < 15) return -2;
  if (couponPa < 16) return 0;
  if (couponPa < 18) return 3;
  if (couponPa < 20) return 5;
  if (couponPa < 24) return 8;
  return 10;
}

function getTenorScore(months) {
  if (months > 12) return -999;
  if (months <= 3) return 5;
  if (months <= 5) return 2;
  if (months === 6) return 0;
  if (months <= 9) return -2;
  return -5;
}

function getKiScore(ki) {
  if (ki > 75) return -999;
  if (ki <= 55) return 8;
  if (ki <= 60) return 4;
  if (ki <= 65) return 0;
  if (ki <= 70) return -4;
  return -8;
}

function getStrikeScore(strike) {
  if (strike > 75) return -999;
  if (strike <= 55) return 8;
  if (strike <= 60) return 4;
  if (strike <= 65) return 0;
  if (strike <= 70) return -4;
  return -8;
}

export function totalDecisionScore(position) {
  const couponScore = getCouponScore(position.coupon_pa || 0);
  const tenorScore = getTenorScore(position.tenor_months || 0);
  const kiScore = getKiScore(position.ki || 0);
  const strikeScore = getStrikeScore(position.strike || 0);

  if (
    couponScore === -999 ||
    tenorScore === -999 ||
    kiScore === -999 ||
    strikeScore === -999
  ) {
    return {
      couponScore,
      tenorScore,
      kiScore,
      strikeScore,
      totalScore: -999,
      decision: "不做"
    };
  }

  const totalScore = couponScore + tenorScore + kiScore + strikeScore;

  let decision = "觀察";
  if (totalScore >= 10) decision = "可做";
  if (totalScore < 4) decision = "不做";

  return {
    couponScore,
    tenorScore,
    kiScore,
    strikeScore,
    totalScore,
    decision
  };
}
