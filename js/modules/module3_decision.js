export function renderModule3Decision(config) {
  const data = config?.module3A || {};
  const recommended = data.recommended_symbols || [];
  const avoid = data.avoid_symbols || [];

  return `
    <div style="margin-bottom:16px; padding:12px; border:1px solid #ddd; border-radius:10px;">
      <strong>今日推薦可做股票</strong><br>
      ${recommended.length > 0 ? recommended.join(", ") : "目前無資料"}
    </div>

    <div style="margin-bottom:16px; padding:12px; border:1px solid #ddd; border-radius:10px;">
      <strong>今日避免股票</strong><br>
      ${avoid.length > 0 ? avoid.join(", ") : "目前無資料"}
    </div>

    <div style="padding:12px; border:1px solid #ddd; border-radius:10px;">
      <strong>下一階段預留</strong><br>
      - 7 種情境推薦組合<br>
      - 外部 input 組合評判
    </div>
  `;
}
