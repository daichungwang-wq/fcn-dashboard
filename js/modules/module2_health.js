import { getPoolItem } from "../core/pool.js";

export function renderModule2Health(positions, pool) {
  if (!positions || positions.length === 0) {
    return `<p>目前沒有持倉</p>`;
  }

  return positions.map(p => {
    const worst = getPoolItem(pool, p.worst_of);

    let status = "觀察";

    if (worst) {
      if (worst.category === "defensive") status = "健康";
      if (worst.category === "core") status = "觀察";
      if (worst.category === "high_vol") status = "危險";
    }

    return `
      <div style="margin-bottom:12px;">
        <strong>${p.id}</strong>｜
        Worst: ${p.worst_of}｜
        狀態：${status}
      </div>
    `;
  }).join("");
}
