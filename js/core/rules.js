export function applyIronRules(position, scores) {
  const reasons = [];

  if (scores.gapScore === -999) {
    reasons.push("Gap過大");
  }

  return {
    blocked: reasons.length > 0,
    reasons
  };
}
