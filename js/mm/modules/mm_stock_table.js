window.MMStockTable=(function(){

function render(){

  const tbody=document.getElementById("stocks-display-tbody");
  if(!tbody) return;

  const rows=MM_STATE.scores.rows || [];

  tbody.innerHTML=rows.map(r=>`
    <tr>
      <td>+</td>
      <td>${r.rank_now || "--"}</td>
      <td>${r.rank_new || "--"}</td>
      <td>${r.symbol}</td>
      <td>${r.price_now || "--"}</td>
      <td>${r.ret_1d || "--"}%</td>
      <td>${r.m1_score || "--"}</td>
      <td>${r.m1_score || "--"}</td>
      <td>${r.m7_v2_score || "--"}</td>
      <td>${r.m7_v2_score || "--"}</td>
      <td>${r.category || "--"}</td>
      <td>${r.category_sub || "--"}</td>
      <td>${r.today_fcn_pool_status || "--"}</td>
    </tr>
  `).join("");
}

return {render};

})();
