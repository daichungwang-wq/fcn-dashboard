import { getPoolItem } from "../core/pool.js?v=4";

function getHealthStatus(position, pool) {
  const worst = getPoolItem(pool, position.worst_of);

  if (!worst) {
    return {
      label: "待確認",
      riskHint: "找不到 worst_of 對應資料"
    };
  }

  if (worst.category === "high_vol") {
    return {
      label: "危險",
      riskHint: "最差標的是高波動股，需特別注意接股風險"
    };
  }

  if (worst.category === "core") {
    return {
      label: "觀察",
      riskHint: "最差標的是核心股，可持續追蹤但仍需留意"
    };
  }

  if (worst.category === "defensive") {
    return {
      label: "健康",
      riskHint: "最差標的是防守股，整體風險相對可控"
    };
  }

  if (worst.category === "cyclical") {
    return {
      label: "觀察",
      riskHint: "最差標的是景氣循環股，需留意總經變化"
    };
  }

  return {
    label: "觀察",
    riskHint: "暫無明確分類，建議持續觀察"
  };
}

export function renderModule2Health(positions, pool) {
  if (!positions || positions.length === 0) {
    return `<p>目前沒有持倉</p>`;
  }

  return positions.map(position => {
    const health = getHealthStatus(position, pool);

    return `
      <div style="margin-bottom:16px;">
        <strong>${position.id}</strong>｜
        標的：${(position.symbols || []).join(", ")}｜
        Worst: ${position.worst_of}｜
        狀態：${health.label}<br>
        <span>風險提示：${health.riskHint}</span>
      </div>
    `;
  }).join("");
}
