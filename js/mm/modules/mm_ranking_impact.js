window.MMRankingImpact=(function(){

function render(){

  const box=document.getElementById("ranking-impact");
  if(!box) return;

  const rows=MM_STATE.scores.rows || [];

  const top=rows
    .sort((a,b)=>b.m7_v2_score-a.m7_v2_score)
    .slice(0,20);

  box.innerHTML=`
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>M7 Score</th>
        </tr>
      </thead>
      <tbody>
        ${top.map(x=>`
          <tr>
            <td>${x.symbol}</td>
            <td>${x.m7_v2_score}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

return {render};

})();
