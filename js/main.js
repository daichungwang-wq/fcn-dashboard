import { renderModule2Health } from "./modules/module2_health.js";
import { renderModule3Decision } from "./modules/module3_decision.js";

function init() {
  const m2 = document.getElementById("module2-health");
  const m3 = document.getElementById("module3-decision");

  if (m2) {
    m2.innerHTML = renderModule2Health();
  }

  if (m3) {
    m3.innerHTML = renderModule3Decision();
  }
}

init();
