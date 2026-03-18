document.addEventListener("DOMContentLoaded", () => {

  fetch("positions.json")
    .then(res => res.json())
    .then(data => {

      const results = data.map(fcn => {

        const stocks = fcn.stocks;
        const rate = fcn.rate;
        const duration = fcn.duration;

        const sorted = [...stocks].sort((a, b) => a.score - b.score);

        let worstList = stocks.length >= 4 ? [sorted[0], sorted[1]] : [sorted[0]];

        let penalty = 0;
        if (worstList.length === 2 && worstList[0].score === worstList[1].score) {
          penalty = -2;
        }

        let rateScore =
          rate < 10 ? -999 :
          rate < 12 ? -4 :
          rate < 15 ? -2 :
          rate < 16 ? 0 :
          rate < 18 ? 3 :
          rate < 20 ? 5 :
          rate < 24 ? 8 : 10;

        let durationScore =
          duration <= 3 ? 5 :
          duration <= 6 ? 2 :
          duration == 6 ? 0 :
          duration <= 9 ? -2 :
          duration <= 12 ? -5 : -999;

        const total = rateScore + durationScore + penalty;

        return {
          id: fcn.id,
          total
        };

      });

      // 🔥 排序（最重要）
      results.sort((a, b) => b.total - a.total);

      // 顯示
      let html = "";

      results.forEach(r => {
        html += `👉 ${r.id}：${r.total}<br>`;
      });

      html += `<br>🏆 最佳選擇：${results[0].id}`;

      document.getElementById("healthBox").innerHTML = html;

    });

});
