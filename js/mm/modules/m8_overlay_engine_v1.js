// ============================================================================

    if(confidence >= 80) return STATES.LEARNING;
    if(confidence >= 60) return STATES.ACTIVE;
    if(confidence >= 40) return STATES.WATCH;

    return STATES.NONE;
  }

  function calcAdaptiveBeta(stats, previousBeta = 1){
    const gap = toNum(stats.avg_gap_pct,0);

    let targetBeta = 1;

    if(gap >= 20){
      targetBeta = 1.15;
    } else if(gap >= 15){
      targetBeta = 1.08;
    } else if(gap <= -15){
      targetBeta = 0.92;
    }

    const learningRate = 0.25;

    const beta = previousBeta + ((targetBeta - previousBeta) * learningRate);

    return round2(beta);
  }

  function applyDecay(beta, decayFactor = 0.95){
    return round2(beta * decayFactor);
  }

  function evaluateOverlayTrigger(historyRows){
    const gaps = historyRows
      .map(r => Number(r.pricing_gap_vs_old_pct))
      .filter(Number.isFinite);

    const sampleCount = gaps.length;
    const persistenceDays = new Set(
      historyRows.map(r => r.date).filter(Boolean)
    ).size;

    const directionConsistency = calcDirectionConsistency(gaps);
    const residualStd = std(gaps);
    const avgGapPct = avg(gaps);

    const stats = {
      sample_count: sampleCount,
      persistence_days: persistenceDays,
      direction_consistency: round2(directionConsistency),
      residual_std: round2(residualStd),
      avg_gap_pct: round2(avgGapPct)
    };

    const confidence = calcOverlayConfidence(stats);
    const state = determineOverlayState(stats);
    const beta = calcAdaptiveBeta(stats, 1);

    return {
      ...stats,
      overlay_confidence: confidence,
      overlay_state: state,
      overlay_beta: beta,
      should_trigger_overlay: confidence >= 60
    };
  }

  global.M8OverlayEngineV1 = {
    VERSION,
    STATES,
    evaluateOverlayTrigger,
    calcAdaptiveBeta,
    applyDecay,
    calcOverlayConfidence,
    determineOverlayState
  };

})(window);
