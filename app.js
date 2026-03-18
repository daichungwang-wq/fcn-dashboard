document.addEventListener("DOMContentLoaded", () => {

  fetch("positions.json")
    .then(response => response.json())
    .then(data => {

      const first = data[0];

      const stocks = first.stocks;
      const rate = first.rate;
      const duration = first.duration;

      const stockNames = stocks.map(s => s.symbol).join(" / ");

      // ========= Worst-of =========
      const sorted = [...stocks].sort((a, b) => a.score - b.score);

      let worstList = [];

      if (stocks.length === 3) {
        worstList = [sorted[0]];
      } else if (stocks.length === 4) {
        worstList = [sorted[0], sorted[1]];
      } else if (stocks.length === 5) {
        worstList = [sorted[0], sorted[1]];
      }

      const worstSymbols = worstList.map(s => s.symbol).join(" / ");

      // ========= 同級扣分 =========
      let penalty = 0;
      if (worstList.length === 2) {
        if (worstList[0].score === worstList[1].score) {
          penalty = -2;
        }
      }

      // ========= 利率評分 =========
      let rateScore = 0;

      if (rate < 10) rateScore = -999;
      else if (rate < 12) rateScore = -4;
      else if (rate < 15) rateScore = -2;
      else if (rate < 16) rateScore = 0;
      else if (rate < 18) rateScore = 3;
      else if (rate < 20) rateScore = 5;
      else if (rate < 24) rateScore = 8;
      else rateScore = 10;

      // ========= 天期評分 =========
      let durationScore = 0;

      if (duration <= 3) durationScore = 5;
      else if (duration <= 6) durationScore = 2;
      else if (duration == 6) durationScore = 0;
      else if (duration <= 9) durationScore = -2;
      else if (duration <= 12) durationScore = -5;
      else durationScore = -999;

      // ========= 總分 =========
      const totalScore = rateScore + durationScore + penalty;

      // ========= 顯示 =========
      document.getElementById("healthBox").innerHTML =
        "股票組合：" + stockNames + "<br>" +
        "Worst-of：" + worstSymbols + "<br>" +
        "利率：" + rate + "%（" + rateScore + "）<br>" +
        "天期：" + duration + "月（" + durationScore + "）<br>" +
        "懲罰：" + penalty + "<br>" +
        "👉 總分：" + totalScore;

    })
    .catch(error => {
      document.getElementById("healthBox").textContent = "讀取失敗";
      console.error(error);
    });

});
