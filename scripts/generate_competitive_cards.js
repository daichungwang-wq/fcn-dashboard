// ==========================================
// M1 Competition Engine V5
// 白名單完整版 + 非白名單留白版
// 輸出格式直接對口 m1_new_stock.html
// ==========================================

// ---------- 工具 ----------
function safe(v, d = "") {
  return v === undefined || v === null ? d : v;
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

// ---------- 白名單研究資料 ----------
// 只有這些股票，才輸出完整內容
const RESEARCH_WHITELIST = {
  NVDA: {
    company_name: "NVIDIA",
    business_summary: "NVIDIA 主要提供 GPU、AI 加速器與資料中心運算平台，是 AI 基礎建設核心供應商。",
    company_positioning: "位於 AI 運算與資料中心產業鏈核心位置，依靠 GPU、CUDA 生態系與整體平台能力建立領先優勢。",
    why_in_m1: "因為 AI 結構性成長最明確、獲利能力極強，且在你系統裡屬高品質核心觀察標的。",
    initial_pool30_view: "這是一檔長期趨勢極強的核心股，但重點不是能不能買，而是不能買太貴。",
    competitive_position: "AI GPU 與加速器市場龍頭，具平台與生態系優勢。",
    direct_competitors: ["AMD", "Intel", "Broadcom"],
    indirect_competitors: ["custom AI chip vendors", "cloud self-designed chips"],
    moat_summary: "CUDA 生態系、軟硬整合能力、開發者黏著度與客戶轉換成本形成強大護城河。",
    why_it_wins: [
      "AI 訓練與推論需求強勁",
      "GPU + 軟體平台整合能力強",
      "高毛利與高獲利能力支撐長期競爭力"
    ],
    why_it_can_lose: [
      "估值過高時容易先反映過頭",
      "雲端客戶自研晶片可能分流需求",
      "AI 資本支出若放緩，股價波動會很大"
    ],
    industry_structure: "AI 加速器市場呈高度集中結構，龍頭具技術與生態先發優勢。",
    competition_trend_1y_3y: "短期 AI 熱潮支撐需求，中期看競爭者追趕與雲端客戶自研晶片滲透。",
    human_summary: "這是一檔 AI 主線最純的核心股，體質極強，但估值通常也最貴。",
    action_hint: "可長期追蹤，回檔再看，不建議情緒高點追價。",
    fcn_view: "屬高品質核心股，可納入 FCN，但不建議用太高 strike 去接貴股票。",
    final_verdict: "屬於可長期追蹤與配置的核心股，重點在估值與進場時機。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐⭐⭐",
      industry_trend: "⭐⭐⭐⭐⭐",
      competition_strength: "⭐⭐⭐⭐⭐",
      valuation_status: "⚠️偏高",
      m1_tag: "core"
    },
    m1_scores: {
      capex: 9.8,
      trend: 9.9,
      competition: 9.5,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "高資本效率，具長期競爭優勢",
      trend_comment: "AI 主線最強，屬結構性成長",
      competition_comment: "平台與生態系優勢明顯，具強護城河",
      valuation_comment: "市場預期已高，需留意回檔風險"
    }
  },

  TSM: {
    company_name: "TSMC",
    business_summary: "台積電是全球最大晶圓代工公司，提供先進製程與封裝技術，是 AI 與高效能運算晶片的核心製造夥伴。",
    company_positioning: "位於半導體供應鏈製造核心位置，屬高技術與高資本門檻產業，對 AI、HPC 與先進晶片供應至關重要。",
    why_in_m1: "因為先進製程領先、技術與資本門檻極高，且在你系統中屬核心半導體觀察名單。",
    initial_pool30_view: "這是一檔核心半導體龍頭股，重點在產業循環與估值，不是基本面有沒有價值。",
    competitive_position: "全球晶圓代工龍頭，先進製程具明顯領先優勢。",
    direct_competitors: ["Samsung", "Intel Foundry"],
    indirect_competitors: ["GlobalFoundries", "UMC", "SMIC"],
    moat_summary: "先進製程技術、客戶驗證、良率與資本門檻共同形成極強護城河。",
    why_it_wins: [
      "先進製程與封裝技術領先",
      "客戶驗證門檻高",
      "AI 與 HPC 晶片需求長期支撐"
    ],
    why_it_can_lose: [
      "半導體景氣循環仍會影響評價",
      "地緣政治風險存在",
      "資本支出放緩時市場容易先下修"
    ],
    industry_structure: "晶圓代工屬全球寡占結構，技術、客戶驗證與資本門檻極高。",
    competition_trend_1y_3y: "短期受 AI 晶片需求支撐，中期看先進製程領先能否持續拉開差距。",
    humanSummary_typo_fix: "",
    human_summary: "這是一檔供應鏈無可替代性很高的核心股，但市場也很容易把景氣循環放大。",
    action_hint: "可長期持有，回檔再看，重點是循環位置與估值。",
    fcn_view: "屬高品質核心股，可納入 FCN，但不建議高 strike 接股。",
    final_verdict: "屬於可長期追蹤與配置的核心股，重點在景氣循環與進場時機。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐⭐⭐",
      industry_trend: "⭐⭐⭐⭐⭐",
      competition_strength: "⭐⭐⭐⭐⭐",
      valuation_status: "⚠️偏高",
      m1_tag: "core"
    },
    m1_scores: {
      capex: 9.5,
      trend: 9.2,
      competition: 9.0,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "高資本效率，具長期競爭優勢",
      trend_comment: "先進製程與 AI 需求支撐產業動能",
      competition_comment: "全球代工龍頭，技術門檻極高",
      valuation_comment: "估值需搭配景氣循環判斷"
    }
  },

  ORCL: {
    company_name: "Oracle",
    business_summary: "Oracle 主要提供資料庫、雲端基礎設施與企業軟體服務，是企業 IT 與資料中心的重要供應商。",
    company_positioning: "位於企業數位化、資料庫與雲端基礎設施核心位置，近年積極切入 AI 雲端平台。",
    why_in_m1: "因為企業級客戶基礎深厚，AI 基建與雲端轉型可能帶來估值重評，屬成長型觀察股。",
    initial_pool30_view: "這是一檔有轉型題材的企業軟體股，重點在成長是否真的能延續，不是單看故事。",
    competitive_position: "企業資料庫與關鍵系統供應商，近年積極強化雲端與 AI 基礎設施定位。",
    direct_competitors: ["Microsoft", "Amazon", "Google", "Salesforce"],
    indirect_competitors: ["IBM", "SAP", "Snowflake"],
    moat_summary: "資料庫、企業系統與高切換成本形成穩定護城河。",
    why_it_wins: [
      "企業級客戶基礎深厚",
      "資料庫與關鍵系統切換成本高",
      "AI 基建與雲端需求可能帶來估值重評"
    ],
    why_it_can_lose: [
      "雲端市場競爭激烈",
      "成長預期若落空，估值容易回檔",
      "大型客戶資本支出節奏會影響成長動能"
    ],
    industry_structure: "企業軟體與雲端平台屬高度競爭市場，但贏家通常具平台與客戶黏著度優勢。",
    competition_trend_1y_3y: "短期看 AI / 雲端建設題材，中期看平台整合與企業客戶留存。",
    human_summary: "這是一檔有 AI 題材加分的企業軟體股，但不能把故事當成確定的長期優勢。",
    action_hint: "適合觀察與分段布局，不建議情緒高點追價。",
    fcn_view: "可納入 FCN 觀察，但因波動與評價擴張要保守看。",
    final_verdict: "屬於值得持續追蹤的成長型觀察股，關鍵在轉型與估值是否匹配。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐⭐",
      industry_trend: "⭐⭐⭐⭐⭐",
      competition_strength: "⭐⭐⭐",
      valuation_status: "⚠️偏高",
      m1_tag: "growth"
    },
    m1_scores: {
      capex: 8.5,
      trend: 8.8,
      competition: 7.5,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "資本效率不錯，具企業軟體長期優勢",
      trend_comment: "雲端與 AI 題材帶來成長動能",
      competition_comment: "具護城河，但仍有競爭壓力",
      valuation_comment: "市場預期已高，需留意回檔風險"
    }
  },

  ETN: {
    company_name: "Eaton",
    business_summary: "Eaton 是全球電力管理公司，主要提供配電設備、電源管理、工業電氣元件與資料中心相關電力基礎建設方案。",
    company_positioning: "位於電力管理 / 工業電氣 / 基礎建設供應鏈核心位置，受惠於電氣化、AI 資料中心與能源轉型趨勢。",
    why_in_m1: "因為電力基建與 AI 資料中心需求明確，且商業模式穩定，屬高品質核心觀察股。",
    initial_pool30_view: "這是一檔高品質工業股，重點不是題材，而是需求能否持續帶動獲利成長。",
    competitive_position: "電力管理與工業電氣設備領域的重要龍頭之一。",
    direct_competitors: ["Schneider Electric", "Siemens", "ABB", "Rockwell Automation"],
    indirect_competitors: ["GE Vernova", "Honeywell", "Vertiv", "Emerson Electric"],
    moat_summary: "產品整合能力、全球客戶基礎與長期專案訂單形成穩定護城河。",
    why_it_wins: [
      "受惠 AI 資料中心與電力基建需求",
      "電氣化與能源轉型趨勢明確",
      "專案導向與客戶黏著度高"
    ],
    why_it_can_lose: [
      "工業景氣循環仍可能影響評價",
      "若基建需求不如預期，成長會放緩",
      "估值已反映部分長期利多"
    ],
    industry_structure: "寡占 + 高技術門檻 + 專案導向產業，龍頭通常同時具規模與交期優勢。",
    competition_trend_1y_3y: "短期受 AI 電力基建帶動需求強，中期競爭會加劇，但龍頭集中度通常更高。",
    human_summary: "這是一檔長期趨勢不錯的高品質工業股，但市場高估時也會有修正壓力。",
    action_hint: "可長期追蹤與持有，回檔布局優於追價。",
    fcn_view: "屬高品質核心股，可納入 FCN，但不建議高 strike 去接股。",
    final_verdict: "屬於可長期追蹤與配置的核心股，重點在估值與進場時機。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐⭐⭐",
      industry_trend: "⭐⭐⭐⭐⭐",
      competition_strength: "⭐⭐⭐⭐",
      valuation_status: "⚠️偏高",
      m1_tag: "core"
    },
    m1_scores: {
      capex: 9.0,
      trend: 9.1,
      competition: 8.1,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "高資本效率，具長期競爭優勢",
      trend_comment: "AI 電力基建與電氣化趨勢支撐成長",
      competition_comment: "具全球客戶與產品整合優勢",
      valuation_comment: "已不便宜，較適合回檔布局"
    }
  },

  PLD: {
    company_name: "Prologis",
    business_summary: "Prologis 是全球大型物流地產 REIT，核心資產為倉儲、物流中心與供應鏈基礎設施。",
    company_positioning: "位於物流地產與供應鏈基礎設施產業核心，受惠於電商、物流效率與全球供應鏈調整。",
    why_in_m1: "因為現金流穩定、資產品質高，屬防禦型 / 穩健型觀察標的。",
    initial_pool30_view: "這是一檔偏穩健配置股，重點是資產品質、利率與估值。",
    competitive_position: "全球物流地產 REIT 龍頭之一。",
    direct_competitors: ["Equinix", "Digital Realty", "Public Storage"],
    indirect_competitors: ["Americold", "regional industrial REITs"],
    moat_summary: "資產規模、地段品質與租戶網路形成長期競爭優勢。",
    why_it_wins: [
      "核心資產稀缺",
      "現金流穩定",
      "物流與供應鏈基礎設施需求長期存在"
    ],
    why_it_can_lose: [
      "利率變動影響 REIT 評價",
      "景氣放緩會影響租戶需求",
      "估值高時上行空間受限"
    ],
    industry_structure: "資產型產業，利率、出租率與資本成本是核心因素。",
    competition_trend_1y_3y: "短期受利率波動影響，中期仍看資產品質與租金成長。",
    human_summary: "這是一檔偏穩健型的防禦股，適合看現金流與資產品質，不是追求最快成長。",
    action_hint: "適合穩定配置，回檔再看，不建議追高。",
    fcn_view: "適合當 FCN 防守型底倉。",
    final_verdict: "屬於穩健配置股，適合作為組合中的防守與現金流穩定來源。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐⭐",
      industry_trend: "⭐⭐⭐",
      competition_strength: "⭐⭐⭐⭐",
      valuation_status: "合理",
      m1_tag: "defensive"
    },
    m1_scores: {
      capex: 8.0,
      trend: 7.2,
      competition: 8.2,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "資產與現金流品質穩定",
      trend_comment: "屬穩定型成長，不是高速爆發",
      competition_comment: "資產規模與地段具優勢",
      valuation_comment: "估值需搭配利率環境判斷"
    }
  },

  COIN: {
    company_name: "Coinbase",
    business_summary: "Coinbase 是美國主要加密資產交易平台，收入與加密市場交易活躍度高度相關。",
    company_positioning: "位於加密資產交易與託管基礎設施核心，但高度受市場情緒、監管與交易量波動影響。",
    why_in_m1: "因為波動大、題材性強，且與加密市場高度連動，屬特殊情境觀察股。",
    initial_pool30_view: "這是一檔高波動題材股，不適合用傳統核心股角度看，要重視時機與風險。",
    competitive_position: "美國合規交易平台的重要參與者，但不是穩定型龍頭資產。",
    direct_competitors: ["Robinhood", "Kraken", "Binance"],
    indirect_competitors: ["PayPal", "Block", "traditional brokers entering crypto"],
    moat_summary: "合規優勢、品牌與託管能力具一定價值，但難形成傳統意義上的穩定護城河。",
    why_it_wins: [
      "加密市場活躍時彈性大",
      "美國監管框架下具合規優勢",
      "交易、託管與平台服務具延伸性"
    ],
    why_it_can_lose: [
      "高度依賴市場交易活躍度",
      "監管變化風險大",
      "波動極大，不適合保守配置"
    ],
    industry_structure: "產業競爭激烈，監管、流動性與品牌信任是關鍵因素。",
    competition_trend_1y_3y: "短期高度受幣市情緒影響，中期看監管與平台差異化能力。",
    human_summary: "這是一檔高波動、高題材性的股票，不是體質股邏輯，而是時機與風控邏輯。",
    action_hint: "控制部位，以時機和風險管理為主。",
    fcn_view: "可用來拉高 FCN 利率，但波動很大，權重要嚴格控制。",
    final_verdict: "屬於高成長高波動股，適合做成長 / 題材配置，但不能失去風險控管。",
    m1_positioning: {
      capex_to_profit: "⭐⭐⭐",
      industry_trend: "⭐⭐⭐⭐",
      competition_strength: "⭐⭐⭐",
      valuation_status: "⚠️波動大",
      m1_tag: "speculative"
    },
    m1_scores: {
      capex: 6.8,
      trend: 8.0,
      competition: 6.5,
      valuation_detail: "FPE -- / Anchor -- / PEG --",
      capex_comment: "資本效率一般，業績波動大",
      trend_comment: "題材熱時動能很強，但不穩定",
      competition_comment: "有平台優勢，但非穩定型護城河",
      valuation_comment: "高波動，不適合用靜態估值判斷"
    }
  }
};

// ---------- 非白名單：留白骨架 ----------
function buildBlankCard(stock) {
  return {
    symbol: safe(stock.symbol),
    company_name: safe(stock.name),

    basic_info: {
      business_summary: "待研究",
      company_positioning: "待研究",
      why_in_m1: `待研究（目前 M1 score = ${n(stock.m1_score, 0).toFixed(2)}）`,
      initial_pool30_view: "待研究"
    },

    competition: {
      competitive_position: "待研究",
      direct_competitors: [],
      indirect_competitors: [],
      moat_summary: "待研究",
      why_it_wins: [],
      why_it_can_lose: [],
      industry_structure: "待研究",
      competition_trend_1y_3y: "待研究"
    },

    m1_positioning: {
      capex_to_profit: "",
      industry_trend: "",
      competition_strength: "",
      valuation_status: "",
      m1_tag: safe(stock.category, "UNKNOWN")
    },

    m1_scores: {
      capex: null,
      trend: null,
      competition: null,
      valuation_detail: "",
      capex_comment: "",
      trend_comment: "",
      competition_comment: "",
      valuation_comment: ""
    },

    investment_view: {
      human_summary: "待研究",
      action_hint: "待研究",
      fcn_view: "待研究",
      final_verdict: "待研究"
    },

    template: {
      company_name: safe(stock.name),
      business_summary: "待研究",
      company_positioning: "待研究",
      why_in_m1: `待研究（目前 M1 score = ${n(stock.m1_score, 0).toFixed(2)}）`,
      competitive_position: "待研究",
      direct_competitors: [],
      indirect_competitors: [],
      moat_summary: "待研究",
      why_it_wins: [],
      why_it_can_lose: [],
      industry_structure: "待研究",
      competition_trend_1y_3y: "待研究",
      human_summary: "待研究",
      m1_positioning: {
        capex_to_profit: "",
        industry_trend: "",
        competition_strength: "",
        valuation_status: "",
        m1_tag: safe(stock.category, "UNKNOWN")
      },
      action_hint: "待研究",
      fcn_view: "待研究",
      final_verdict: "待研究",
      updated_at: new Date().toISOString().slice(0, 10)
    },

    research_status: {
      basic_info_done: false,
      competition_done: false,
      technical_done: false,
      fcn_view_done: false,
      final_verdict_done: false
    },

    coverage_score: 0,
    updated_at: new Date().toISOString().slice(0, 10)
  };
}

// ---------- 白名單卡片 ----------
function buildWhitelistCard(stock, truth) {
  return {
    symbol: safe(stock.symbol),
    company_name: truth.company_name || safe(stock.name),

    basic_info: {
      business_summary: truth.business_summary,
      company_positioning: truth.company_positioning,
      why_in_m1: truth.why_in_m1,
      initial_pool30_view: truth.initial_pool30_view
    },

    competition: {
      competitive_position: truth.competitive_position,
      direct_competitors: truth.direct_competitors,
      indirect_competitors: truth.indirect_competitors,
      moat_summary: truth.moat_summary,
      why_it_wins: truth.why_it_wins,
      why_it_can_lose: truth.why_it_can_lose,
      industry_structure: truth.industry_structure,
      competition_trend_1y_3y: truth.competition_trend_1y_3y
    },

    m1_positioning: truth.m1_positioning,
    m1_scores: truth.m1_scores,

    investment_view: {
      human_summary: truth.human_summary,
      action_hint: truth.action_hint,
      fcn_view: truth.fcn_view,
      final_verdict: truth.final_verdict
    },

    template: {
      company_name: truth.company_name || safe(stock.name),
      business_summary: truth.business_summary,
      company_positioning: truth.company_positioning,
      why_in_m1: truth.why_in_m1,
      competitive_position: truth.competitive_position,
      direct_competitors: truth.direct_competitors,
      indirect_competitors: truth.indirect_competitors,
      moat_summary: truth.moat_summary,
      why_it_wins: truth.why_it_wins,
      why_it_can_lose: truth.why_it_can_lose,
      industry_structure: truth.industry_structure,
      competition_trend_1y_3y: truth.competition_trend_1y_3y,
      human_summary: truth.human_summary,
      m1_positioning: truth.m1_positioning,
      action_hint: truth.action_hint,
      fcn_view: truth.fcn_view,
      final_verdict: truth.final_verdict,
      updated_at: new Date().toISOString().slice(0, 10)
    },

    research_status: {
      basic_info_done: true,
      competition_done: true,
      technical_done: false,
      fcn_view_done: false,
      final_verdict_done: true
    },

    coverage_score: 60,
    updated_at: new Date().toISOString().slice(0, 10)
  };
}

// ---------- 主卡 ----------
function buildCompetitionCard(stock) {
  const symbol = safe(stock.symbol).toUpperCase();
  const truth = RESEARCH_WHITELIST[symbol];

  if (truth) {
    return buildWhitelistCard(stock, truth);
  }

  return buildBlankCard(stock);
}

// ---------- 批次 ----------
function enrichPoolWithCompetition(pool) {
  return pool.map(stock => buildCompetitionCard(stock));
}

// ---------- export ----------
window.M1CompetitionEngine = {
  buildCompetitionCard,
  enrichPoolWithCompetition
};
