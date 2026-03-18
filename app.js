document.addEventListener("DOMContentLoaded", () => {
  fetch("positions.json")
    .then(response => response.json())
    .then(data => {

      const results = data.map(fcn => {
        const stocks = fcn.stocks || [];
        const rate = fcn.rate || 0;
        const duration = fcn.duration || 0;

        const sorted = [...stocks].sort((a, b) => a.score - b.score);

        let worstList = [];
        if (stocks.length === 3) worstList = [sorted[0]];
        else if (stocks.length >= 4) worstList = [sorted[0], sorted[1]];
        else worstList = [sorted[0]];

        const worstSymbols = worstList.map(s => s.symbol).join(" / ");

        // 懲罰
        let penalty = 0;
        if (worstList.length === 2 && worstList[0].score === worstList[1].score) {
          penalty = -2;
        }

        // 利率
        let rateScore =
          rate < 10 ? -999 :
          rate < 12 ? -4 :
          rate < 15 ? -2 :
          rate < 16 ? 0 :
          rate < 18 ? 3 :
          rate < 20 ? 5 :
          rate < 24 ? 8 : 10;

        // 天期
        let durationScore =
          duration <= 3 ? 5 :
          duration <= 6 ? 2 :
          duration <= 9 ? -2 :
          duration <= 12 ? -5 : -999;

        const total = rateScore + durationScore + penalty;

        // 顏色判斷
        let level = "";
        if (total >= 6) level = "🟢";
        else if (total >= 3) level = "🟡";
        else level = "🔴";

        return {
          id: fcn.id,
          total,
          rate,
          duration,
          worst: worstSymbols,
          level
        };
      });

      // 排序
      results.sort((a, b) => b.total - a.total);

      let html = "";

      results.forEach(r => {
        html += `
        <div style="margin-bottom:10px">
        ${r.level} ${r.id}（${r.total}分）<br>
        → 利率：${r.rate}%<br>
        → 天期：${r.duration}月<br>
        → Worst-of：${r.worst}
        </div>
        `;
      });

      // 👉 自動建議（核心）
      if (results.length > 0) {
        const best = results[0];

        let advice = "";
        if (best.total >= 6) {
          advice = "👉 建議：可進場（條件佳）";
        } else if (best.total >= 3) {
          advice = "👉 建議：觀察（普通）";
        } else {
          advice = "👉 建議：不做（風險高）";
        }

        html += `
        <hr>
        🏆 最佳選擇：${best.id}<br>
        ${advice}
        `;
      }

      document.getElementById("healthBox").innerHTML = html;
    })
    .catch(error => {
      document.getElementById("healthBox").textContent = "讀取失敗";
      console.error(error);
    });
});
