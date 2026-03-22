import type { ToolInfo } from "@/components/ui/ToolInfoCard";

/**
 * Registry of tool descriptions, usage hints, and connection maps.
 * Used by ToolInfoCard to show contextual help on each tool page.
 * All strings use i18n keys with English fallbacks.
 */

export const TOOL_INFO: Record<string, ToolInfo> = {
  oee: {
    id: "oee",
    titleKey: "common.titleDashboard",
    titleFallback: "OEE Dashboard",
    descriptionKey: "toolInfo.oeeDesc",
    descriptionFallback:
      "OEE (Overall Equipment Effectiveness) measures how well your equipment is performing. It combines Availability, Performance, and Quality into one percentage. World-class is 85%+.",
    whenToUseKey: "toolInfo.oeeWhen",
    whenToUseFallback: "Use this to spot where you're losing production time and output.",
    connectsFrom: [
      { labelKey: "common.navProductionTracking", fallback: "Production Tracking", href: "/operations/production" },
    ],
    connectsTo: [
      { labelKey: "common.navPareto", fallback: "Pareto Analysis", href: "/improvement/pareto" },
    ],
  },

  pareto: {
    id: "pareto",
    titleKey: "common.titlePareto",
    titleFallback: "Pareto Analysis",
    descriptionKey: "toolInfo.paretoDesc",
    descriptionFallback:
      "Ranks your problems from biggest to smallest. The 80/20 rule: 20% of causes create 80% of problems. Attack the tall bars first.",
    whenToUseKey: "toolInfo.paretoWhen",
    whenToUseFallback: "Use this after OEE shows losses — find which specific issues matter most.",
    connectsFrom: [
      { labelKey: "common.navOEE", fallback: "OEE Dashboard", href: "/operations/oee" },
    ],
    connectsTo: [
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  "root-cause": {
    id: "root-cause",
    titleKey: "common.titleFiveWhy",
    titleFallback: "Root Cause Analysis",
    descriptionKey: "toolInfo.rcaDesc",
    descriptionFallback:
      "Two methods to dig deeper: 5-Why (ask 'why' repeatedly until you find the root cause) and Ishikawa/Fishbone (map all possible causes by category). Don't guess — investigate.",
    whenToUseKey: "toolInfo.rcaWhen",
    whenToUseFallback: "Use this when you know WHAT the problem is but not WHY it's happening.",
    connectsFrom: [
      { labelKey: "common.navPareto", fallback: "Pareto Analysis", href: "/improvement/pareto" },
      { labelKey: "common.navNCR", fallback: "NCR", href: "/quality" },
      { labelKey: "common.navSafety", fallback: "Safety", href: "/operations/safety" },
    ],
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  kaizen: {
    id: "kaizen",
    titleKey: "common.titleKaizen",
    titleFallback: "Kaizen Board",
    descriptionKey: "toolInfo.kaizenDesc",
    descriptionFallback:
      "Every improvement starts here: idea \u2192 planned \u2192 in progress \u2192 completed \u2192 verified \u2192 standardized. Track savings and follow through to make sure improvements stick.",
    whenToUseKey: "toolInfo.kaizenWhen",
    whenToUseFallback: "Use this to track every improvement action from idea to completion.",
    connectsFrom: [
      { labelKey: "common.navPareto", fallback: "Pareto Analysis", href: "/improvement/pareto" },
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
      { labelKey: "common.navSafety", fallback: "Safety", href: "/operations/safety" },
    ],
  },

  safety: {
    id: "safety",
    titleKey: "common.titleSafety",
    titleFallback: "Safety Tracker",
    descriptionKey: "toolInfo.safetyDesc",
    descriptionFallback:
      "Log safety incidents, view the Safety Cross calendar, and track days without incidents. Safety is always priority #1 in lean manufacturing.",
    whenToUseKey: "toolInfo.safetyWhen",
    whenToUseFallback: "Use this to report any safety event and track your factory's safety performance.",
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
    ],
  },

  sqcdp: {
    id: "sqcdp",
    titleKey: "common.titleSQCDP",
    titleFallback: "SQCDP Board",
    descriptionKey: "toolInfo.sqcdpDesc",
    descriptionFallback:
      "The 5 pillars of your shift: Safety, Quality, Cost, Delivery, People. Green/yellow/red at a glance. Use this in your daily tier meeting to review performance.",
    whenToUseKey: "toolInfo.sqcdpWhen",
    whenToUseFallback: "Use this every day at your team meeting to discuss what needs attention.",
    connectsTo: [
      { labelKey: "common.navAndon", fallback: "Andon Board", href: "/operations/andon" },
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  andon: {
    id: "andon",
    titleKey: "common.titleAndon",
    titleFallback: "Andon Board",
    descriptionKey: "toolInfo.andonDesc",
    descriptionFallback:
      "Real-time status of every production line. Red = stopped, yellow = warning, green = running. Like a traffic light for your factory. Put this on a big screen on the shop floor.",
    whenToUseKey: "toolInfo.andonWhen",
    whenToUseFallback: "Use this to see at a glance which lines need help right now.",
    connectsFrom: [
      { labelKey: "common.navShopFloor", fallback: "Shop Floor", href: "/operations/shopfloor" },
    ],
    connectsTo: [
      { labelKey: "common.navSafety", fallback: "Safety", href: "/operations/safety" },
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
    ],
  },

  spc: {
    id: "spc",
    titleKey: "common.titleSPC",
    titleFallback: "SPC Charts",
    descriptionKey: "toolInfo.spcDesc",
    descriptionFallback:
      "Statistical Process Control tracks measurements over time. It tells you if variation is normal or if something changed. Red flags mean investigate immediately.",
    whenToUseKey: "toolInfo.spcWhen",
    whenToUseFallback: "Use this to monitor critical quality measurements and catch drift before it causes defects.",
    connectsTo: [
      { labelKey: "common.navNCR", fallback: "NCR", href: "/quality" },
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
    ],
  },

  quality: {
    id: "quality",
    titleKey: "common.titleNCR",
    titleFallback: "Quality",
    descriptionKey: "toolInfo.qualityDesc",
    descriptionFallback:
      "The quality hub: NCR (Non-Conformance Reports) for documenting defects, CAPA (Corrective/Preventive Actions) for fixing and preventing them, and QC Checks for inspections.",
    whenToUseKey: "toolInfo.qualityWhen",
    whenToUseFallback: "Use this when a defect is found — document it, investigate it, fix it, prevent it.",
    connectsTo: [
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  gemba: {
    id: "gemba",
    titleKey: "common.titleGemba",
    titleFallback: "Gemba Walk",
    descriptionKey: "toolInfo.gembaDesc",
    descriptionFallback:
      "A structured walk through the factory. Observe, ask, listen \u2014 don't fix on the spot. Record observations, take photos, assign follow-ups. 'Go to gemba' is the #1 lean principle.",
    whenToUseKey: "toolInfo.gembaWhen",
    whenToUseFallback: "Use this for regular factory floor walks to see the real situation with your own eyes.",
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
      { labelKey: "common.navSafety", fallback: "Safety", href: "/operations/safety" },
    ],
  },

  "six-s": {
    id: "six-s",
    titleKey: "common.titleSixS",
    titleFallback: "5S/6S Audit",
    descriptionKey: "toolInfo.sixSDesc",
    descriptionFallback:
      "Walk through your area and score: Sort, Set in order, Shine, Standardize, Sustain (+Safety). Regular audits build discipline and make problems visible.",
    whenToUseKey: "toolInfo.sixSWhen",
    whenToUseFallback: "Use this weekly or monthly to audit workplace organization in each area.",
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
    ],
  },

  tpm: {
    id: "tpm",
    titleKey: "common.titleTpm",
    titleFallback: "TPM Dashboard",
    descriptionKey: "toolInfo.tpmDesc",
    descriptionFallback:
      "Total Productive Maintenance \u2014 planned maintenance schedules, autonomous maintenance checklists (CILT), and machine health tracking. Fix before it breaks.",
    whenToUseKey: "toolInfo.tpmWhen",
    whenToUseFallback: "Use this to schedule preventive maintenance and track machine reliability.",
    connectsTo: [
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
      { labelKey: "common.navOEE", fallback: "OEE Dashboard", href: "/operations/oee" },
    ],
  },

  smed: {
    id: "smed",
    titleKey: "common.titleSmed",
    titleFallback: "SMED Tracker",
    descriptionKey: "toolInfo.smedDesc",
    descriptionFallback:
      "Single-Minute Exchange of Die \u2014 systematically reduce the time to switch from Product A to Product B. Separate internal vs external tasks, then streamline.",
    whenToUseKey: "toolInfo.smedWhen",
    whenToUseFallback: "Use this when changeover times are eating into your production availability.",
    connectsFrom: [
      { labelKey: "common.navOEE", fallback: "OEE Dashboard", href: "/operations/oee" },
    ],
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  a3: {
    id: "a3",
    titleKey: "common.titleA3",
    titleFallback: "A3 Report",
    descriptionKey: "toolInfo.a3Desc",
    descriptionFallback:
      "Structured problem-solving on one page: background, current state, goal, root cause, actions, follow-up. Forces clear thinking. Use for bigger, cross-team problems.",
    whenToUseKey: "toolInfo.a3When",
    whenToUseFallback: "Use this for complex problems that need cross-functional collaboration and management review.",
    connectsFrom: [
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
    ],
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
    ],
  },

  fmea: {
    id: "fmea",
    titleKey: "common.titleFMEA",
    titleFallback: "FMEA",
    descriptionKey: "toolInfo.fmeaDesc",
    descriptionFallback:
      "Failure Mode & Effects Analysis \u2014 score every potential failure by Severity \u00d7 Occurrence \u00d7 Detection. Focus on the highest Risk Priority Numbers first. Proactive, not reactive.",
    whenToUseKey: "toolInfo.fmeaWhen",
    whenToUseFallback: "Use this proactively to identify and prevent problems before they happen.",
    connectsTo: [
      { labelKey: "common.navKaizen", fallback: "Kaizen Board", href: "/improvement/kaizen" },
      { labelKey: "common.navPokaYoke", fallback: "Poka-Yoke", href: "/quality/poka-yoke" },
    ],
  },

  "poka-yoke": {
    id: "poka-yoke",
    titleKey: "common.titlePokaYoke",
    titleFallback: "Poka-Yoke",
    descriptionKey: "toolInfo.pokaYokeDesc",
    descriptionFallback:
      "Registry of error-proofing devices and methods. A poka-yoke makes it impossible to do something wrong \u2014 like a USB plug that only fits one way.",
    whenToUseKey: "toolInfo.pokaYokeWhen",
    whenToUseFallback: "Use this to document and track mistake-proofing solutions across your factory.",
    connectsFrom: [
      { labelKey: "common.navRootCause", fallback: "Root Cause Analysis", href: "/improvement/root-cause" },
      { labelKey: "common.navFMEA", fallback: "FMEA", href: "/quality/fmea" },
    ],
  },

  production: {
    id: "production",
    titleKey: "common.titleProduction",
    titleFallback: "Production Tracking",
    descriptionKey: "toolInfo.productionDesc",
    descriptionFallback:
      "Enter hourly production counts, downtime minutes, and cycle times. This data feeds directly into your OEE calculations. Accurate input = accurate insights.",
    whenToUseKey: "toolInfo.productionWhen",
    whenToUseFallback: "Use this every hour or every shift to record what was actually produced.",
    connectsFrom: [
      { labelKey: "common.navProductionOrders", fallback: "Production Orders", href: "/planning/orders" },
    ],
    connectsTo: [
      { labelKey: "common.navOEE", fallback: "OEE Dashboard", href: "/operations/oee" },
    ],
  },

  handover: {
    id: "handover",
    titleKey: "common.titleHandover",
    titleFallback: "Shift Handover",
    descriptionKey: "toolInfo.handoverDesc",
    descriptionFallback:
      "Write what happened on your shift \u2014 problems, pending work, safety notes. The next shift reads this first. Good handovers prevent repeated mistakes.",
    whenToUseKey: "toolInfo.handoverWhen",
    whenToUseFallback: "Use this at the end of every shift before you leave.",
  },

  productionOrders: {
    id: "productionOrders",
    titleKey: "common.navProductionOrders",
    titleFallback: "Production Orders",
    descriptionKey: "toolInfo.ordersDesc",
    descriptionFallback:
      "Plan what to produce, how much, and when. Orders flow into Production Tracking where operators record actual output. Auto-completes when target is reached.",
    whenToUseKey: "toolInfo.ordersWhen",
    whenToUseFallback: "Create orders before each production run. Release them when materials and lines are ready.",
    connectsFrom: [
      { labelKey: "common.navProducts", fallback: "Products & BOM", href: "/planning/products" },
    ],
    connectsTo: [
      { labelKey: "common.navProductionTracking", fallback: "Production Tracking", href: "/operations/production" },
      { labelKey: "common.navQualityDashboard", fallback: "Quality", href: "/quality" },
    ],
  },

  products: {
    id: "products",
    titleKey: "common.navProducts",
    titleFallback: "Products & BOM",
    descriptionKey: "toolInfo.productsDesc",
    descriptionFallback:
      "Define your product catalog with SKUs, cycle times, and Bills of Materials. BOM data auto-populates ideal cycle times in Production Tracking and OEE calculations.",
    whenToUseKey: "toolInfo.productsWhen",
    whenToUseFallback: "Set up products before creating production orders. Update cycle times when processes change.",
    connectsTo: [
      { labelKey: "common.navProductionOrders", fallback: "Production Orders", href: "/planning/orders" },
      { labelKey: "common.navProductionTracking", fallback: "Production Tracking", href: "/operations/production" },
    ],
  },
};
