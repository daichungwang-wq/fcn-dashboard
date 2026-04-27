(function () {

const PATHS = {
  dashboard: "../data/mm/engine_progress_dashboard.json",
  scores: "../data/m7_sandbox/m7_v2_scores.json",
  audit: "../data/m7_sandbox/m7_formula_input_audit.json",
  runtime: "../data/runtime_staging/market_runtime_long_horizon.json",
  config: "../configs/mm/m7_v2_parameter_config.json"
};

window.MM_STATE = {
  dashboard:{},
  scores:{},
  audit:{},
  runtime:{},
  config:{}
};

function setError(msg){
  const el = document.getElementById("dashboard-error");
  if(!el) return;
  el.style.display="block";
  el.innerHTML=msg;
}

function clearError(){
  const el=document.getElementById("dashboard-error");
  if(!el) return;
  el.style.display="none";
}

async function fetchJson(path){
  const res = await fetch(path,{cache:"no-store"});
  if(!res.ok) throw new Error(path);
  return await res.json();
}

async function loadAllData(){
  const [
    dashboard,
    scores,
    audit,
    runtime,
    config
  ] = await Promise.all([
    fetchJson(PATHS.dashboard),
    fetchJson(PATHS.scores),
    fetchJson(PATHS.audit),
    fetchJson(PATHS.runtime),
    fetchJson(PATHS.config)
  ]);

  window.MM_STATE.dashboard = dashboard || {};
  window.MM_STATE.scores = scores || {};
  window.MM_STATE.audit = audit || {};
  window.MM_STATE.runtime = runtime || {};
  window.MM_STATE.config = config || {};
}

function refreshAllModules(){

  if(window.MMParameterBrain){
    window.MMParameterBrain.render();
  }

  if(window.MMStockExplainability){
    window.MMStockExplainability.render("NVDA");
  }

  if(window.MMRankingImpact){
    window.MMRankingImpact.render();
  }

  if(window.MMStockTable){
    window.MMStockTable.render();
  }

  if(window.MMBlueprint){
    window.MMBlueprint.render();
  }

  if(window.MMOpsMemory){
    window.MMOpsMemory.render();
  }

  if(window.MMM1Adapter){
    window.MMM1Adapter.render();
  }

  if(window.MMM3Adapter){
    window.MMM3Adapter.render();
  }

  if(window.MMM6Adapter){
    window.MMM6Adapter.render();
  }

  if(window.MMM8Adapter){
    window.MMM8Adapter.render();
  }

  bindGlobalButtons();
}

function bindGlobalButtons(){

  const expandBtn=document.getElementById("expand-all-btn");
  const collapseBtn=document.getElementById("collapse-all-btn");

  if(expandBtn){
    expandBtn.onclick=()=>{
      document.querySelectorAll("details").forEach(x=>x.open=true);
    };
  }

  if(collapseBtn){
    collapseBtn.onclick=()=>{
      document.querySelectorAll("details").forEach(x=>x.open=false);
    };
  }
}

async function init(){

  try{
    clearError();

    await loadAllData();

    const gen = document.getElementById("generatedAt");
    if(gen){
      gen.innerHTML =
        `資料時間：${MM_STATE.dashboard.generated_at || "--"} ｜ 版本：${MM_STATE.dashboard.version || "--"}`;
    }

    refreshAllModules();

  }catch(err){
    console.error(err);
    setError("MM Dashboard Load Failed: "+err.message);
  }
}

window.MMRefreshAll = refreshAllModules;

init();

})();

