// ==========================================
// 振宇 FCN 系統 main.js V7.6（動態FCN引擎）
// ==========================================

const appState = {
  stocks: [],
  expandedAll: false
};

// ===== 股票資料（之後會換成 pool）=====
const mockStocks = [
  { symbol: "NVDA", name: "NVIDIA", risk: "高" },
  { symbol: "TSM", name: "TSMC", risk: "中" },
  { symbol: "AAPL", name: "Apple", risk: "低" },
  { symbol: "MSFT", name: "Microsoft", risk: "低" },
  { symbol: "AMZN", name: "Amazon", risk: "中" },
  { symbol: "GOOGL", name: "Google", risk: "中" },
  { symbol: "META", name: "Meta", risk: "高" }
];

// ===== 初始化 =====
document.addEventListener("DOMContentLoaded", () => {
  appState.stocks = mockStocks;
  renderStocks();
});

// ===== FCN 生成器 =====
function generateFCN(stock) {
  let level;

  if (stock.risk === "低") level = "保守";
  else if (stock.risk === "中") level = "正常";
  else level = "積極";

  if (level === "保守") {
    return {
      rate: "12~15%",
      ki: "50~55%",
      strike: "60~65%",
      tenor: "6~9月"
    };
  }

  if (level === "正常") {
    return {
      rate: "15~18%",
      ki: "55%",
      strike: "65~70%",
      tenor: "6~9月"
    };
  }

  return {
    rate: "18~24%",
    ki: "55~60%",
    strike: "70%",
    tenor: "9~12月"
  };
}

// ===== 渲染 =====
function renderStocks() {
  const container = document.getElementById("stock-list");
  if (!container) return;

  container.innerHTML = "";

  appState.stocks.forEach((stock, index) => {
    const fcn = generateFCN(stock);

    const card = document.createElement("div");
    card.className = "stock-card";

    card.innerHTML = `
      <div style="font-weight:bold;font-size:18px;">
        ${stock.symbol} | ${stock.name}
      </div>

      <button onclick="toggleDetail(${index})">展開FCN</button>

      <div id="detail-${index}" style="display:none;margin-top:10px;">
        🔹 利率：${fcn.rate}<br>
        🔹 KI：${fcn.ki}<br>
        🔹 Strike：${fcn.strike}<br>
        🔹 天期：${fcn.tenor}
      </div>
    `;

    container.appendChild(card);
  });
}

// ===== 展開控制 =====
function toggleDetail(index) {
  const el = document.getElementById(`detail-${index}`);
  if (!el) return;

  el.style.display = el.style.display === "none" ? "block" : "none";
}

function expandAll() {
  appState.stocks.forEach((_, i) => {
    const el = document.getElementById(`detail-${i}`);
    if (el) el.style.display = "block";
  });
}

function collapseAll() {
  appState.stocks.forEach((_, i) => {
    const el = document.getElementById(`detail-${i}`);
    if (el) el.style.display = "none";
  });
}
