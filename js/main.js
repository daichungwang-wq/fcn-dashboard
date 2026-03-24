// ====== fallback mock（保證有畫面） ======
const mockStocks = [
  { symbol: "NVDA", name: "NVIDIA", score: 10 },
  { symbol: "TSM", name: "TSMC", score: 9 },
  { symbol: "AAPL", name: "Apple", score: 8 },
  { symbol: "MSFT", name: "Microsoft", score: 9 }
];
const appState = {
  stocks: [],
  expandedAll: false
};

const mockStocks = [
  { symbol: "NVDA", name: "NVIDIA", score: 10 },
  { symbol: "TSM", name: "TSMC", score: 9 },
  { symbol: "AAPL", name: "Apple", score: 8 },
  { symbol: "MSFT", name: "Microsoft", score: 9 },
  { symbol: "AMZN", name: "Amazon", score: 7 },
  { symbol: "GOOGL", name: "Google", score: 8 },
  { symbol: "META", name: "Meta", score: 7 }
];

document.addEventListener("DOMContentLoaded", () => {
  appState.stocks = mockStocks;
  renderStocks();
});

function renderStocks() {
  const container = document.getElementById("stock-list");
  if (!container) return;

  container.innerHTML = "";

  appState.stocks.forEach(stock => {
    const card = document.createElement("div");
    card.className = "stock-card";

    card.innerHTML = `
      <div style="font-size:18px;font-weight:600">
        ${stock.symbol} | ${stock.name}
      </div>

      <div style="margin-top:6px">
        Score：${stock.score}
      </div>

      <button onclick="toggleDetail(this)">
        展開細節
      </button>

      <div class="extra">
        <div>FCN 評估：待接入</div>
        <div>Worst-of：--</div>
        <div>距離 KI：--</div>
      </div>
    `;

    container.appendChild(card);
  });
}

window.toggleDetail = function(btn) {
  const card = btn.closest(".stock-card");
  const extra = card.querySelector(".extra");

  const isHidden =
    extra.style.display === "none" ||
    extra.style.display === "";

  extra.style.display = isHidden ? "block" : "none";
  btn.innerText = isHidden ? "收合細節" : "展開細節";
};

window.expandAll = function() {
  document.querySelectorAll(".stock-card").forEach(card => {
    const extra = card.querySelector(".extra");
    const btn = card.querySelector("button");

    if (extra) extra.style.display = "block";
    if (btn) btn.innerText = "收合細節";
  });
};

window.collapseAll = function() {
  document.querySelectorAll(".stock-card").forEach(card => {
    const extra = card.querySelector(".extra");
    const btn = card.querySelector("button");

    if (extra) extra.style.display = "none";
    if (btn) btn.innerText = "展開細節";
  });
};
