/**
 * Maps view IDs (used in sidebar navigation and legacy onNavigate calls)
 * to App Router paths.
 */
const VIEW_TO_ROUTE: Record<string, string> = {
  // ── Operations ──
  home: "/operations/home",
  dashboard: "/operations/home",
  safety: "/operations/safety",
  shopfloor: "/operations/shopfloor",
  sqcdp: "/operations/sqcdp",
  production: "/operations/production",
  andon: "/operations/andon",
  oee: "/operations/oee",

  // ── Quality ──
  quality: "/quality",
  "qc-dashboard": "/quality",

  // ── Planning ──
  orders: "/planning/orders",
  "production-orders": "/planning/orders",
  products: "/planning/products",

  // ── Improvement ──
  kaizen: "/improvement/kaizen",
  "root-cause": "/improvement/root-cause",
  "five-why": "/improvement/root-cause",
  ishikawa: "/improvement/root-cause",
  a3: "/improvement/a3",
  gemba: "/improvement/gemba",
  "lean-tools": "/improvement/lean-tools",
  vsm: "/improvement/lean-tools",
  waste: "/improvement/lean-tools",
  tpm: "/improvement/tpm",
  "six-s": "/improvement/six-s",

  // ── System ──
  admin: "/system/admin",
  settings: "/system/settings",

  // ── Operations (additional) ──
  handover: "/operations/handover",
  "shift-handover": "/operations/handover",

  // ── Quality (additional) ──
  "poka-yoke": "/quality/poka-yoke",
  spc: "/quality/spc",

  // ── Planning (additional) ──
  kanban: "/planning/kanban",

  // ── Improvement (additional) ──
  smed: "/improvement/smed",

  // Legacy aliases (redirect to closest new path)
  hourly: "/operations/production",
  "production-input": "/operations/production",
  ncr: "/quality",
  capa: "/quality",
  defects: "/quality",
  lsw: "/improvement/kaizen",
  "audit-scheduler": "/system/settings",
  assessment: "/system/settings",
  copilot: "/system/settings",
  resources: "/system/settings",
  "lean-scorecard": "/operations/home",
  "master-calendar": "/system/settings",
  "consolidated-oee": "/operations/oee",
  pareto: "/improvement/pareto",
  "defect-catalog": "/quality",
  "qc-checks": "/quality",
  "mind-map": "/improvement/root-cause",
  cilt: "/improvement/tpm",
  "qc-policies": "/quality",
  "horizontal-deploy": "/improvement/kaizen",
  "setup-wizard": "/system/settings",
};

/** Convert a view ID to an App Router path */
export function viewToRoute(viewId: string): string {
  return VIEW_TO_ROUTE[viewId] || `/operations/home`;
}
