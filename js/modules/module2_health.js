import { getPoolItem } from "../core/pool.js?v=7";

function calcDistanceToKiPct(stock) {
  if (!stock || stock.price == null || stock.ki_price == null || stock.price === 0) {
    return null;
  }
  return ((stock.price - stock.ki_price) / stock.price) * 100;
}

function getWorstStock(stocks) {
  if (!stocks || stocks.length === 0) return null;

  let worst = null;

  for (const stock of stocks) {
    const distancePct = calcDistanceToKiPct(stock);
    if (distancePct == null) continue;

    const item = {
      ...stock,
      distance_to_ki_pct: distancePct
    };

    if (!worst || item.distance_to_ki_pct < worst.distance_to_ki_pct) {
      worst = item;
    }
  }

  return worst;
}

function getHealthStatus(distancePct, category) {
  if (distancePct == null) {
    return {
      label: "待確認",
      color: "#9e9e9e",
      rank: 99,
      riskHint: "缺少價格資料，暫時無法判斷"
    };
  }

  if (distancePct <= 5) {
    return {
      label: "危險",
      color: "#e53935",
      rank: 1,
      riskHint: "已非常接近下限價，需優先處理"
    };
  }

  if (distancePct <= 10) {
    return {
      label: "持續觀察",
      color: "#fb8c00",
      rank: 2,
      riskHint: "距離下限價不遠，需密切追蹤"
    };
  }

  if (distancePct <= 20) {
    return {
      label: "觀察",
      color: "#fbc02d",
      rank: 3,
      riskHint: "仍需注意後續波動"
    };
  }

  if (category === "high_vol") {
    return {
      label: "觀察",
      color: "#fbc02d",
      rank: 3,
      riskHint: "雖仍有緩衝，但最差標的是高波動股，需持續留意"
    };
  }

  return {
    label: "健康",
    color: "#43a047",
    rank: 4,
    riskHint: "距離下限價仍有安全空間"
  };
}

export function renderModule2Health(positions, pool) {
  if (!positions || positions.length === 0) {
    return `<p>目前沒有持倉</p>`;
  }

  const enriched = positions.map(position => {
    const worstStock = getWorstStock(position.stocks || []);
    const poolItem = worstStock ? getPoolItem(pool, worstStock.symbol) : null;
    const category = poolItem ? poolItem.category : "unknown";
    const health = getHealthStatus(
      worstStock ? worstStock.distance_to_ki_pct : null,
      category
    );

    return {
      ...position,
      worst_stock: worstStock,
      worst_category: category,
      health
    };
  });

  // 先把有問題的放前面：危險 → 持續觀察 → 觀察 → 健康
  enriched.sort((a, b) => {
    if (a.health.rank !== b.health.rank) {
      return a.health.rank - b.health.rank;
    }
    const aDist = a.worst_stock?.distance_to_ki_pct ?? 999;
    const bDist = b.worst_stock?.distance_to_ki_pct ?? 999;
    return aDist - bDist;
  });

  let healthy = 0;
  let watch = 0;
  let danger = 0;

  for (const item of enriched) {
    if (item.health.label === "健康") healthy += 1;
    if (item.health.label === "觀察" || item.health.label === "持續觀察") watch += 1;
    if (item.health.label === "危險") danger += 1;
  }

  const total = enriched.length;
  const topRisk = enriched.find(x => x.health.label === "危險" || x.health.label === "持續觀察") || enriched[0];

  const warning = topRisk && topRisk.worst_stock
    ? `
      <div style="
        background:#ffebee;
        border:1px solid #e53935;
        border-radius:10px;
        padding:12px;
        margin-bottom:16px;
      ">
        <strong>⚠️ 最需處理：</strong> ${topRisk.id}<br>
        Worst-of：${topRisk.worst_stock.symbol}<br>
        距下限價：${topRisk.worst_stock.distance_to_ki_pct.toFixed(1)}%<br>
        狀態：<span style="color:${topRisk.health.color}; font-weight:bold">${topRisk.health.label}</span>
      </div>
    `
    : "";

  const summary = `
    <div style="
      border:1px solid #ccc;
      border-radius:10px;
      padding:12px;
      margin-bottom:16px;
    ">
      <strong>持倉健康總覽</strong><br>
      健康：${healthy}（${Math.round((healthy / total) * 100)}%）｜
      觀察：${watch}（${Math.round((watch / total) * 100)}%）｜
      危險：${danger}（${Math.round((danger / total) * 100)}%）
    </div>
  `;

  const cards = enriched.map(position => {
    const worst = position.worst_stock;
    const symbols = (position.stocks || []).map(s => s.symbol).join(", ");

    return `
      <div style="
        border:1px solid #ddd;
        border-radius:10px;
        padding:12px;
        margin-bottom:12px;
      ">
        <strong>${position.id}</strong><br>
        標的：${symbols}<br>
        Worst-of：${worst ? worst.symbol : "未判定"}<br>
        Worst 類別：${position.worst_category}<br>
        距下限價：${worst ? worst.distance_to_ki_pct.toFixed(1) + "%" : "未提供"}<br>
        狀態：<span style="color:${position.health.color}; font-weight:bold">${position.health.label}</span><br>
        風險提示：${position.health.riskHint}
      </div>
    `;
  }).join("");

  return `
    ${warning}
    ${summary}
    ${cards}
  `;
}
