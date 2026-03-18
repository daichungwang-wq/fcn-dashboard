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
        if (stocks.length === 3) {
          worstList = [sorted[0]];
        } else if (stocks.length === 4 || stocks.length === 5) {
          worstList = [sorted[0], sorted[1]];
        } else {
          worstList = [sorted[0]];
        }

        let penalty = 0;
        if (
          worstList.length === 2 &&
          worstList[0] &&
          worstList[1] &&
          worstList[0].score === worstList[1].score
        ) {
          penalty = -2;
        }

        let rateScore = 0;
        if (rate < 10) rateScore = -999;
        else if (rate < 12) rateScore = -4;
        else if (rate < 15) rateScore = -2;
        else if (rate < 16) rateScore = 0;
        else if (rate < 18) rateScore = 3;
        else if (rate < 20) rateScore = 5;
        else if (rate < 24) rateScore = 8;
        else rateScore = 10;

        let durationScore = 0;
        if (duration <= 3) durationScore = 5;
        else if (duration <= 6) durationScore = 2;
        else if (duration <= 9) durationScore = -2;
        else if (duration <= 12) durationScore = -5;
        else durationScore = -999;

        const total = rateScore + durationScore + penalty;

        return {
          id: fcn.id,
          total: total
        };
      });

      results.sort((a, b) => b.total - a.total);

      let html = "";
      results.forEach(r => {
        html += "👉 " + r.id + "：" + r.total + "<br>";
      });

      if (results.length > 0) {
        html += "<br>🏆 最佳選擇：" + results[0].id;
      }

      document.getElementById("healthBox").innerHTML = html;
    })
    .catch(error => {
      document.getElementById("healthBox").textContent = "讀取失敗";
      console.error(error);
    });
});
