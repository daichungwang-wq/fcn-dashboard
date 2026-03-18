document.addEventListener("DOMContentLoaded", () => {
  fetch("positions.json")
    .then(response => response.json())
    .then(data => {
      const count = data.length;
      const firstId = data[0]?.id || "無資料";

      document.getElementById("healthBox").innerHTML =
        "持倉筆數：" + count + "<br>" +
        "第一筆編號：" + firstId;
    })
    .catch(error => {
      document.getElementById("healthBox").textContent = "讀取失敗";
      console.error(error);
    });
});
