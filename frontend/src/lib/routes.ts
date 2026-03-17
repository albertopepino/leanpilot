/**
 * Maps legacy view IDs (used in old state-based routing) to App Router paths.
 * Used to bridge components that still call onNavigate(viewId).
 */
const VIEW_TO_ROUTE: Record<string, string> = {
  home: "/home",
  "master-calendar": "/home/calendar",
  "lean-scorecard": "/home/scorecard",
  assessment: "/getting-started/assessment",
  copilot: "/getting-started/copilot",
  resources: "/getting-started/resources",
  "production-orders": "/define/production-orders",
  products: "/define/products",
  production: "/define/production",
  andon: "/define/andon",
  dashboard: "/measure/oee",
  "consolidated-oee": "/measure/consolidated",
  hourly: "/measure/hourly",
  pareto: "/measure/pareto",
  "defect-catalog": "/measure/defects",
  "qc-checks": "/measure/qc",
  "five-why": "/analyze/five-why",
  ishikawa: "/analyze/ishikawa",
  vsm: "/analyze/vsm",
  gemba: "/analyze/gemba",
  safety: "/analyze/safety",
  a3: "/analyze/a3",
  "mind-map": "/analyze/mind-map",
  waste: "/analyze/waste",
  kaizen: "/improve/kaizen",
  smed: "/improve/smed",
  capa: "/improve/capa",
  tpm: "/improve/tpm",
  cilt: "/improve/cilt",
  "six-s": "/control/six-s",
  "qc-policies": "/control/qc-policies",
  ncr: "/control/ncr",
  settings: "/system/settings",
  admin: "/system/admin",
  sqcdp: "/home/sqcdp",
  "shift-handover": "/define/handover",
  lsw: "/control/lsw",
  "audit-scheduler": "/control/audit-scheduler",
  "horizontal-deploy": "/improve/horizontal-deploy",
};

/** Convert a legacy view ID to an App Router path */
export function viewToRoute(viewId: string): string {
  return VIEW_TO_ROUTE[viewId] || `/home`;
}
