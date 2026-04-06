// ==========================================
// M7 Pool Converter
// 將 fundamental_data → new_stock_pool
// ==========================================

// ===== 模擬輸入資料（之後改成讀 JSON） =====
const fundamentalData = {
  NVDA: {
    名稱: "NVIDIA",
    產業: "半導體",
    類型: "AI核心",

    現價: 180,
    目前EPS: 6.8,
    明年EPS: 8.29,

    品質等級: "高",
    波動等級: "高"
  },
  TSM: {
    名稱: "TSMC",
    產業: "半導體",

    現價: 340,
    目前EPS: 12,
    明年EPS: 15,

    品質等級: "中",
    波動等級: "中"
  },
  CCL: {
    名稱: "Carnival",

    現價: 24.7,
    目前EPS: 1.2,
    明年EPS: 1.5,

    品質等級: "低",
    波動等級: "高"
  }
};

// ==========================================
// 工具函數
// ==========================================

// PEG 計算
function calcPEG(price, eps_now, eps_next) {
  if (!eps_now || !eps_next) return null;

  const pe = price / eps_next;
  const growth = (eps_next / eps_now - 1) * 100;

  if (growth <= 0) return null;

  return pe / growth;
}

// Quality 分數
function qualityScore(level) {
  if (level === "高") return 5;
  if (level === "中") return 2;
  return -5;
}

// PEG 分數
function pegScore(peg) {
  if (peg === null) return 0;

  if (peg < 0.8) return 4;
  if (peg <= 1.0) return 2;
  if (peg <= 1.3) return 0;
  if (peg <= 1.6) return -2;
  return -4;
}

// 波動分數
function volScore(level) {
  if (level === "低") return 2;
  if (level === "中") return 0;
  return -3;
}

// Pool 判斷
function poolResult(score) {
  if (score >= 6) return "Core";
  if (score >= 3) return "Conditional";
  return "Reject";
}

// Strike ladder（簡化版）
function buildStrikeLadder(quality, peg) {
  if (quality === "高") return [65, 70, 75];
  if (quality === "中") return [60, 65, 70];
  return [55, 60, 65];
}

// KI 參考（簡化）
function buildKIRange(price, eps_next) {
  // 未來可改成 10Y MA
  return [50, 55, 60];
}

// ==========================================
// 主轉換
// ==========================================

function convertPool(data) {
  let output = {};

  for (let symbol in data) {
    let s = data[symbol];

    const peg = calcPEG(s.現價, s.目前EPS, s.明年EPS);

    const qScore = qualityScore(s.品質等級);
    const pScore = pegScore(peg);
    const vScore = volScore(s.波動等級);

    const total = qScore + pScore + vScore;

    output[symbol] = {
      symbol: symbol,
      名稱: s.名稱,

      現價: s.現價,

      目前EPS: s.目前EPS,
      明年EPS: s.明年EPS,
      PEG: peg,

      品質等級: s.品質等級,
      品質分數: qScore,

      PEG分數: pScore,

      波動等級: s.波動等級,
      波動分數: vScore,

      新股票池總分: total,
      新股票池結果: poolResult(total),

      可接受Strike階梯: buildStrikeLadder(s.品質等級, peg),
      10年線KI參考區間: buildKIRange(),

      是否納入新股票池: total >= 3,

      備註: "",
      最後更新日期: new Date().toISOString().slice(0,10)
    };
  }

  return output;
}

// ==========================================
// RUN
// ==========================================

const result = convertPool(fundamentalData);

console.log("M7 New Stock Pool:");
console.log(result);
