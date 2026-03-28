export function applyMacroToStock({
  macroEvents = [],
  stock,
  sensitivityMap = {},
  macroImpactTable = {}
}) {
  const sensitivities = sensitivityMap[stock.symbol] || {};
  let total = 0;

  for (const event of macroEvents) {
    const rule = macroImpactTable[event.subtype];
    if (!rule) continue;

    const baseScore = rule.score;

    // 找對應敏感度
    const sensitivity = sensitivities[event.subtype] || 1;

    total += baseScore * sensitivity;
  }

  return total;
}
