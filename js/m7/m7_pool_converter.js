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
      "symbol": symbol,
      "名稱": s.名稱,

      "現價": s.現價,

      "目前EPS": s.目前EPS,
      "明年EPS": s.明年EPS,
      "PEG": peg,

      "品質等級": s.品質等級,
      "品質分數": qScore,

      "PEG分數": pScore,

      "波動等級": s.波動等級,
      "波動分數": vScore,

      "新股票池總分": total,
      "新股票池結果": poolResult(total),

      "可接受Strike階梯": buildStrikeLadder(s.品質等級, peg),
      "10年線KI參考區間": buildKIRange(),

      "是否納入新股票池": total >= 3,

      "備註": "",
      "最後更新日期": new Date().toISOString().slice(0,10)
    };
  }

  return output;
}

export { convertPool };
