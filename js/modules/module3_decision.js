function getPreferenceRank(pref) {
  if (pref === "very_high") return 5;
  if (pref === "high") return 4;
  if (pref === "medium") return 3;
  if (pref === "low") return 2;
  if (pref === "avoid") return 1;
  return 0;
}

function getRiskRank(risk) {
  if (risk === "low_vol") return 1;
  if (risk === "mid_vol") return 2;
  if (risk === "high_vol") return 3;
  return 9;
}

function isRecommended(stock) {
  const pref = stock.fcn_preference || "";
  const allow = stock.allow_fcn;

  if (allow === false) return false;
  return pref === "very_high" || pref === "high";
}

function isAvoid(stock) {
  const pref = stock.fcn_preference || "";
  const allow = stock.allow_fcn;

  if (allow === false) return true;
  return pref === "low" || pref === "avoid";
}

function sortRecommended(a, b) {
  const prefDiff = getPreferenceRank(b.fcn_preference) - getPreferenceRank(a.fcn_preference);
  if (prefDiff !== 0) return prefDiff;

  const riskDiff = getRiskRank(a.risk_level) - getRiskRank(b.risk_level);
  if (riskDiff !== 0) return riskDiff;

  const scoreA = a.risk_score ?? 999;
  const scoreB = b.risk_score ?? 999;
  return scoreA - scoreB;
}

function sortAvoid(a, b) {
  const prefDiff = getPreferenceRank(a.fcn_preference) - getPreferenceRank(b.fcn_preference);
  if (prefDiff !== 0) return prefDiff;

  const scoreA = a.risk_score ?? 0;
  const scoreB = b.risk_score ?? 0;
  return scoreB - scoreA;
}

function renderStockList(title, stocks, color) {
  return `
    <div style="margin-bottom:16px; padding:12px; border:1px solid #ddd; border-radius:10px;">
      <strong style="color:${color}">${title}</strong><br><br>
      ${
        stocks.length > 0
          ? stocks.map(stock => `
              <div style="margin-bottom:8px;">
                ${stock.symbol}
                ｜${stock.category || "未分類"}
                ｜風險：${stock.risk_level || "未定義"}
                ｜偏好：${stock.fcn_preference || "未定義"}
                ${stock.risk_score != null ? `｜risk_score：${stock.risk_score}` : ""}
              </div>
            `).join("")
          : `<span>目前無資料</span>`
      }
    </div>
  `;
}

export function renderModule3Decision(pool) {
  if (!pool || pool.length === 0) {
    return `<p>目前沒有 Pool 資料</p>`;
  }

  const recommended = pool.filter(isRecommended).sort(sortRecommended);
  const avoid = pool.filter(isAvoid).sort(sortAvoid);

  const total = pool.length;
  const recommendedCount = recommended.length;
  const avoidCount = avoid.length;

  return `
    <div style="margin-bottom:16px; padding:12px; border:1px solid #ccc; border-radius:10px;">
      <strong>Module3-A 今日股票池總覽</strong><br>
      Pool 總數：${total}｜
      推薦可做：${recommendedCount}｜
      今日避免：${avoidCount}
    </div>

    ${renderStockList("今日推薦可做股票", recommended, "#2e7d32")}
    ${renderStockList("今日避免股票", avoid, "#c62828")}

    <div style="padding:12px; border:1px solid #ddd; border-radius:10px;">
      <strong>下一階段預留</strong><br>
      - Module3-B：7 種情境推薦組合<br>
      - Module3-C：外部 input 組合評判
    </div>
  `;
}
