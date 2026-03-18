document.addEventListener("DOMContentLoaded", () => {
  fetch("positions.json")
    .then(response => response.json())
    .then(data => {
      const count = data.length;
      const first = data[0];

      const firstId = first?.id || "無資料";
      const stocks = first?.stocks?.join(" / ") || "無資料";
      const worstOf = first?.worst_of || "無資料";

      document.getElementById("healthBox").innerHTML =
        "持倉筆數：" + count + "<br>" +
        "第一筆編號：" + firstId + "<br>" +
        "股票組合：" + stocks + "<br>" +
        "Worst-of：" + worstOf;
    })
    .catch(error => {
      document.getElementById("healthBox").textContent = "讀取失敗";
      console.error(error);
    });
});
