export function getPoolItem(pool, symbol) {
  return pool.find(item => item.symbol === symbol) || null;
}

export function getCategoryScore(category) {
  if (category === "defensive") return 3;
  if (category === "core") return 1;
  if (category === "high_vol") return -3;
  if (category === "cyclical") return -2;
  return 0;
}
