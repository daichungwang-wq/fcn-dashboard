import { getPoolItem } from "../core/pool.js?v=4";

function getHealthStatus(position, pool) {
  const worst = getPoolItem(pool, position.worst_of);

  if (!worst) {
    return {
      label: "待確認",
      riskHint: "找不到 worst_of 對應資料",
      category: "unknown"
    };
  }

  if (worst.category === "high_vol") {
    return {
      label: "危險",
      riskHint: "最差標的是高波動股，需特別注意接股風險",
      category: worst.category
    };
  }

  if (worst.category === "core") {
    return {
      label: "觀察",
      riskHint: "最差標的是核心股，可持續追蹤但仍需留意",
      category: worst.category
    };
  }

  if (worst.category === "defensive") {
    return {
      label: "健康",
      riskHint: "最差標的是防守股，整體風險相對可控",
      category: worst.category
    };
  }

  if (worst.category === "cyclical") {
    return {
      label: "觀察",
      riskHint: "最差標的是景氣循環股，需留意總經變化",
      category: worst.category
    };
  }

  return {
    label: "觀察",
    riskHint: "暫無明確分類，建議持續觀察",
    category: worst.category || "unknown"
  };
}

export function renderModule2Health(positions, pool) {
  if (!positions || positions.length === 0) {
    return `<p>目前沒有持倉</p>`;
  }

  const summary = {
    healthy: 0,
    watch: 0,
    danger: 0
  };

  const cards = positions.map(position => {
    const health = getHealthStatus(position, pool);

    if (health.label === "健康") summary.healthy += 1;
    if (health.label === "觀察") summary.watch += 1;
    if (health.label === "危險") summary.danger += 1;

    return `
      <div style="margin-bottom:18px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <strong>${position.id}</strong><br>
        <span>標的：${(position.symbols || []).join(", ")}</span><br>
        <span>Worst-of：${position.worst_of}</span><br>
        <span>Worst 類別：${health.category}</span><br>
        <span>健康狀態：${health.label}</span><br>
        <span>風險提示：${health.riskHint}</span>
      </div>
    `;
  }).join("");

  return `
    <div style="margin-bottom:16px; padding:12px; border:1px solid #ccc; border-radius:8px;">
      <strong>持倉總覽</strong><br>
      健康：${summary.healthy}｜
      觀察：${summary.watch}｜
      危險：${summary.danger}
    </div>
    ${cards}
  `;
}
