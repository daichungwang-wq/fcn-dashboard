// ==========================================
// M7 Stock Profile
// ==========================================

export const STOCK_PROFILE = {
  NVDA: { sector: "AI_SEMI", subsector: "GPU", category: "core", valuation_model: "PEG", allow_fcn: true },
  TSM:  { sector: "AI_SEMI", subsector: "FOUNDRY", category: "core", valuation_model: "PEG", allow_fcn: true },
  AVGO: { sector: "AI_SEMI", subsector: "ASIC", category: "core", valuation_model: "PEG", allow_fcn: true },
  AMAT: { sector: "AI_SEMI", subsector: "EQUIPMENT", category: "growth", valuation_model: "PEG", allow_fcn: true },
  MU:   { sector: "AI_SEMI", subsector: "MEMORY", category: "core", valuation_model: "PEG", allow_fcn: true },
  AMD:  { sector: "AI_SEMI", subsector: "CPU_GPU", category: "growth", valuation_model: "PEG", allow_fcn: true },
  MRVL: { sector: "AI_SEMI", subsector: "NETWORKING", category: "growth", valuation_model: "PEG", allow_fcn: true },
  CRDO: { sector: "AI_SEMI", subsector: "CONNECTIVITY", category: "speculative", valuation_model: "PEG", allow_fcn: false },
  ALAB: { sector: "AI_SEMI", subsector: "CONNECTIVITY", category: "speculative", valuation_model: "PEG", allow_fcn: false },

  MSFT: { sector: "AI_APPLICATION", subsector: "CLOUD_PLATFORM", category: "core", valuation_model: "NON_PEG", allow_fcn: true },
  GOOG: { sector: "AI_APPLICATION", subsector: "AI_CLOUD", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },
  AMZN: { sector: "AI_APPLICATION", subsector: "CLOUD_COMMERCE", category: "core", valuation_model: "NON_PEG", allow_fcn: true },
  ORCL: { sector: "AI_APPLICATION", subsector: "ENTERPRISE_SOFTWARE", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },
  PLTR: { sector: "AI_APPLICATION", subsector: "AI_SOFTWARE", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },
  ARM:  { sector: "AI_APPLICATION", subsector: "AI_IP", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },
  TSLA: { sector: "AI_APPLICATION", subsector: "AI_AUTO", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },

  META: { sector: "PLATFORM", subsector: "SOCIAL_AD", category: "growth", valuation_model: "NON_PEG", allow_fcn: true },
  AAPL: { sector: "PLATFORM", subsector: "ECOSYSTEM", category: "core", valuation_model: "NON_PEG", allow_fcn: true },

  COST: { sector: "CONSUMER", subsector: "RETAIL", category: "defensive", valuation_model: "PE", allow_fcn: true },
  TGT:  { sector: "CONSUMER", subsector: "RETAIL", category: "defensive", valuation_model: "PE", allow_fcn: true },
  EL:   { sector: "CONSUMER", subsector: "BEAUTY", category: "income", valuation_model: "PE", allow_fcn: true },

  COIN: { sector: "FINANCIAL", subsector: "CRYPTO_FINANCE", category: "speculative", valuation_model: "NON_PEG", allow_fcn: false },
  SOFI: { sector: "FINANCIAL", subsector: "FINTECH", category: "speculative", valuation_model: "NON_PEG", allow_fcn: false },

  UNH:  { sector: "HEALTHCARE", subsector: "INSURANCE", category: "defensive", valuation_model: "PE", allow_fcn: true },

  CCL: { sector: "TRAVEL", subsector: "CRUISE", category: "income", valuation_model: "PE", allow_fcn: true },
  AAL: { sector: "TRAVEL", subsector: "AIRLINE", category: "income", valuation_model: "PE", allow_fcn: true },
  LVS: { sector: "TRAVEL", subsector: "CASINO_TRAVEL", category: "defensive", valuation_model: "PE", allow_fcn: true },

  SMH: { sector: "ETF", subsector: "SEMI_ETF", category: "defensive", valuation_model: "ETF", allow_fcn: true },
  QQQ: { sector: "ETF", subsector: "TECH_ETF", category: "defensive", valuation_model: "ETF", allow_fcn: true },
  LQD: { sector: "ETF", subsector: "BOND_ETF", category: "income", valuation_model: "ETF", allow_fcn: true },

  INTC: { sector: "AI_SEMI", subsector: "CPU_FOUNDRY", category: "defensive", valuation_model: "PEG", allow_fcn: true },
  NKE:  { sector: "CONSUMER", subsector: "APPAREL", category: "speculative", valuation_model: "PE", allow_fcn: false },
  REGN: { sector: "HEALTHCARE", subsector: "BIOTECH", category: "income", valuation_model: "PE", allow_fcn: true }
};
