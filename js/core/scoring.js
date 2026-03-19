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
  if (months <= 6) return 2;
  if (months === 6) return 0;
  if (months <= 9) return -2;
  if (months <= 12) return -5;
  return 0;
}

export function totalDecisionScore(position) {
  const couponScore = getCouponScore(position.coupon_pa || 0);
  const tenorScore = getTenorScore(position.tenor_months || 0);

  if (couponScore === -999 || tenorScore === -999) {
    return {
      couponScore,
      tenorScore,
      totalScore: -999,
      decision: "不做"
    };
  }

  const totalScore = couponScore + tenorScore;

  let decision = "觀察";
  if (totalScore >= 10) decision = "可做";
  if (totalScore < 4) decision = "不做";

  return {
    couponScore,
    tenorScore,
    totalScore,
    decision
  };
}
