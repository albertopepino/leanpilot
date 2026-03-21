import axios from "axios";
import { useSite } from "@/stores/useSite";
import type {
  ProductionRecordCreate, DowntimeEventCreate, ScrapRecordCreate,
  OEECalculateParams, AssessmentCreate,
  FiveWhyCreate, IshikawaCreate, KaizenCreate, SMEDCreate,
  SixSAuditCreate, VSMCreate, A3ReportCreate, GembaWalkCreate,
  TPMEquipmentCreate, TPMMaintenanceCreate,
  CILTStandardCreate, CILTExecutionCreate,
  AndonEventCreate, HourlyProductionCreate,
  WasteEventCreate, WasteEventUpdate,
  CopilotChatRequest, AIRootCauseRequest,
  RegisterData, AdminUserCreate, AdminUserUpdate,
  ProductionLineCreate, ProductionLineUpdate,
  ShiftCreate, ShiftUpdate,
  ProductCreate, ProductUpdate,
  WorkCenterCreate, WorkCenterUpdate, BOMCreate,
  ProductionOrderCreate, ProductionOrderUpdate,
  DefectCatalogCreate, DefectCatalogUpdate,
  QCTemplateCreate, QCRecordCreate, QCCheckResultCreate,
  NCRCreate, NCRUpdate, CAPACreate, CAPAUpdate,
  GroupCreate, GroupUpdate, GroupPolicyItem,
  SQCDPEntryCreate, SQCDPMeetingCreate,
  ShiftHandoverCreate, ShiftHandoverUpdate,
  LSWCreate, LSWUpdate, LSWCompletionCreate,
  AuditScheduleCreate, AuditScheduleUpdate,
  SafetyIncidentCreate, SafetyIncidentUpdate,
  PortalClientCreate,
} from "./types";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,  // Send httpOnly cookies with every request
});

// Backwards-compatible: also send Authorization header if a legacy token exists
// Also inject X-Site-Id from the site store when a specific site is active
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("leanpilot_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Inject active site id header from Zustand store
  try {
    const { activeSiteId, isCorpView } = useSite.getState();
    if (activeSiteId !== null && !isCorpView) {
      config.headers["X-Site-Id"] = String(activeSiteId);
    }
  } catch {
    // Store not available during SSR — ignore
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: (() => void)[] = [];

function onTokenRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    // Skip redirect for auth endpoints — let the caller handle 401
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/");
    if (err.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // Try cookie-based refresh first (no body needed — cookie sent automatically)
      const hasRefreshCookie = document.cookie.includes("logged_in=");
      const hasLegacyRefresh = !!localStorage.getItem("leanpilot_refresh");

      if (hasRefreshCookie || hasLegacyRefresh) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            refreshSubscribers.push(() => {
              resolve(api(originalRequest));
            });
          });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          // Send refresh request — cookie is sent automatically via withCredentials.
          // Also send legacy body token if present (backwards-compatible).
          const legacyRefresh = localStorage.getItem("leanpilot_refresh");
          const refreshPayload = legacyRefresh ? { refresh_token: legacyRefresh } : {};
          const res = await api.post("/auth/refresh", refreshPayload);

          // If the server still returns tokens in the body, update legacy storage
          if (res.data.access_token) {
            localStorage.setItem("leanpilot_token", res.data.access_token);
          }
          if (res.data.refresh_token) {
            localStorage.setItem("leanpilot_refresh", res.data.refresh_token);
          }

          onTokenRefreshed();
          isRefreshing = false;
          return api(originalRequest);
        } catch {
          isRefreshing = false;
          localStorage.removeItem("leanpilot_token");
          localStorage.removeItem("leanpilot_refresh");
          // Redirect to login on refresh failure
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      }
      // No refresh cookie/token — clear and redirect to login
      localStorage.removeItem("leanpilot_token");
      localStorage.removeItem("leanpilot_refresh");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Core APIs
export const productionApi = {
  createRecord: (data: ProductionRecordCreate) => api.post("/production/records", data),
  listRecords: (lineId?: number) =>
    api.get("/production/records", { params: { line_id: lineId } }),
  createDowntime: (data: DowntimeEventCreate) => api.post("/production/downtime", data),
  createScrap: (data: ScrapRecordCreate) => api.post("/production/scrap", data),
};

export const oeeApi = {
  getSummary: (lineId: number, days = 30) =>
    api.get(`/oee/summary/${lineId}`, { params: { days } }),
  getTrend: (lineId: number, days = 30) =>
    api.get(`/oee/trend/${lineId}`, { params: { days } }),
  calculate: (params: OEECalculateParams) => api.post("/oee/calculate", null, { params }),
  getConsolidatedSummary: (params: { days?: number; start_date?: string; end_date?: string }) =>
    api.get("/oee/consolidated/summary", { params }),
  getConsolidatedTrend: (params: { days?: number; start_date?: string; end_date?: string }) =>
    api.get("/oee/consolidated/trend", { params }),
  getLossWaterfall: (lineId: number, days = 30) =>
    api.get(`/oee/loss-waterfall/${lineId}`, { params: { days } }),
  getAlerts: (lineId: number, thresholdPct = 10) =>
    api.get(`/oee/alerts/${lineId}`, { params: { threshold_pct: thresholdPct } }),
  getLosses: (lineId: number, startDate?: string, endDate?: string) =>
    api.get(`/oee/losses/${lineId}`, { params: { start_date: startDate, end_date: endDate } }),
  triggerNCR: (data: { production_line_id: number; oee_value: number; threshold?: number; consecutive_days?: number }) =>
    api.post("/oee/trigger-ncr", data),
};

export const leanApi = {
  // Assessment
  saveAssessment: (data: AssessmentCreate) => api.post("/lean/assessment", data),
  getAssessment: () => api.get("/lean/assessment"),
  getLatestAssessment: () => api.get("/lean/assessment/latest"),
  // 5 WHY
  createFiveWhy: (data: FiveWhyCreate) => api.post("/lean/five-why", data),
  listFiveWhy: () => api.get("/lean/five-why"),
  getFiveWhy: (id: number) => api.get(`/lean/five-why/${id}`),
  deleteFiveWhy: (id: number) => api.delete(`/lean/five-why/${id}`),
  // Ishikawa
  createIshikawa: (data: IshikawaCreate) => api.post("/lean/ishikawa", data),
  listIshikawa: () => api.get("/lean/ishikawa"),
  getIshikawa: (id: number) => api.get(`/lean/ishikawa/${id}`),
  deleteIshikawa: (id: number) => api.delete(`/lean/ishikawa/${id}`),
  // Kaizen
  createKaizen: (data: KaizenCreate) => api.post("/lean/kaizen", data),
  getKaizenBoard: () => api.get("/lean/kaizen/board"),
  updateKaizenStatus: (id: number, status: string, savings?: number) =>
    api.patch(`/lean/kaizen/${id}/status`, null, {
      params: { new_status: status, actual_savings: savings },
    }),
  getKaizenSavings: () => api.get("/lean/kaizen/savings"),
  syncParetoPriorities: () => api.post("/lean/kaizen/sync-pareto-priorities"),
  getAutoScore: () => api.get("/lean/assessment/auto-score"),
  // SMED
  createSmed: (data: SMEDCreate) => api.post("/lean/smed", data),
  getSmedPotential: (id: number) => api.get(`/lean/smed/${id}/potential`),
  // Kaizen Photos
  uploadKaizenPhoto: (id: number, type: "before" | "after", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/lean/kaizen/${id}/photo/${type}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getKaizenPhotoUrl: (id: number, type: "before" | "after") =>
    `${api.defaults.baseURL}/lean/kaizen/${id}/photo/${type}`,
};

// Advanced Lean APIs
export const advancedLeanApi = {
  // 6S Audit
  createSixSAudit: (data: SixSAuditCreate) => api.post("/lean-advanced/six-s", data),
  listSixSAudits: () => api.get("/lean-advanced/six-s"),
  getSixSTrend: (area?: string) =>
    api.get("/lean-advanced/six-s/trend", { params: { area } }),
  // VSM
  createVSM: (data: VSMCreate) => api.post("/lean-advanced/vsm", data),
  listVSM: () => api.get("/lean-advanced/vsm"),
  getVSMLiveData: (vsmId: number) => api.get(`/lean-advanced/vsm/${vsmId}/live-data`),
  // A3 Report
  createA3: (data: A3ReportCreate) => api.post("/lean-advanced/a3", data),
  listA3: () => api.get("/lean-advanced/a3"),
  updateA3Status: (id: number, status: string, results?: string) =>
    api.patch(`/lean-advanced/a3/${id}/status`, null, { params: { status, results } }),
  // Gemba Walk
  createGembaWalk: (data: GembaWalkCreate) => api.post("/lean-advanced/gemba", data),
  listGembaWalks: () => api.get("/lean-advanced/gemba"),
  // TPM
  createEquipment: (data: TPMEquipmentCreate) => api.post("/lean-advanced/tpm/equipment", data),
  listEquipment: () => api.get("/lean-advanced/tpm/equipment"),
  logMaintenance: (data: TPMMaintenanceCreate) => api.post("/lean-advanced/tpm/maintenance", data),
  getOverdueEquipment: () => api.get("/lean-advanced/tpm/overdue"),
  getEquipmentMetrics: (equipmentId: number) => api.get(`/lean-advanced/tpm/equipment/${equipmentId}/metrics`),
  // CILT
  createCILTStandard: (data: CILTStandardCreate) => api.post("/lean-advanced/cilt/standards", data),
  listCILTStandards: () => api.get("/lean-advanced/cilt/standards"),
  executeCILT: (data: CILTExecutionCreate) => api.post("/lean-advanced/cilt/execute", data),
  getCILTCompliance: () => api.get("/lean-advanced/cilt/compliance"),
  // Andon
  createAndonEvent: (data: AndonEventCreate) => api.post("/lean-advanced/andon", data),
  resolveAndon: (id: number, notes?: string) => api.post(`/lean-advanced/andon/${id}/resolve`, { resolution_notes: notes ?? null }),
  getAndonStatus: () => api.get("/lean-advanced/andon/status"),
  detectAndonPatterns: () => api.post("/lean-advanced/andon/detect-patterns"),
  // Hourly Production
  logHourly: (data: HourlyProductionCreate) => api.post("/lean-advanced/hourly", data),
  getHourlyView: (lineId: number, date: string) =>
    api.get(`/lean-advanced/hourly/${lineId}`, { params: { date } }),
  // Mind Map
  createMindMap: (data: { title: string; description: string; nodes: Record<string, unknown>[]; connectors: Record<string, unknown>[] }) =>
    api.post("/lean-advanced/mindmap", data),
  listMindMaps: () => api.get("/lean-advanced/mindmap"),
  getMindMap: (id: number) => api.get(`/lean-advanced/mindmap/${id}`),
  updateMindMap: (id: number, data: { title?: string; description?: string; nodes?: Record<string, unknown>[]; connectors?: Record<string, unknown>[] }) =>
    api.patch(`/lean-advanced/mindmap/${id}`, data),
  deleteMindMap: (id: number) => api.delete(`/lean-advanced/mindmap/${id}`),
  // Gemba Observation Photo
  uploadGembaPhoto: (observationId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/lean-advanced/gemba/observations/${observationId}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getGembaPhotoUrl: (observationId: number) =>
    `${api.defaults.baseURL}/lean-advanced/gemba/observations/${observationId}/photo`,
  linkGembaKaizen: (observationId: number, kaizenId: number) =>
    api.post(`/lean-advanced/gemba/observations/${observationId}/link-kaizen/${kaizenId}`),
  // 6S Audit Item Photo
  uploadSixSPhoto: (auditId: number, itemId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/lean-advanced/6s/audits/${auditId}/items/${itemId}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getSixSPhotoUrl: (auditId: number, itemId: number) =>
    `${api.defaults.baseURL}/lean-advanced/6s/audits/${auditId}/items/${itemId}/photo`,
};

// AI APIs - fully enabled
export const aiApi = {
  chat: (data: CopilotChatRequest) => api.post("/ai/copilot/chat", data),
  rootCause: (data: AIRootCauseRequest) => api.post("/ai/root-cause", data),
  autoKaizen: () => api.post("/ai/auto-kaizen"),
};

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  register: (data: RegisterData) => api.post("/auth/register", data),
  refresh: (refreshToken?: string) =>
    api.post("/auth/refresh", refreshToken ? { refresh_token: refreshToken } : {}),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  updateProfile: (data: { full_name?: string; language?: string }) =>
    api.patch("/auth/me", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/auth/change-password", data),
  updateConsent: (data: { ai_consent?: boolean; marketing_consent?: boolean }) =>
    api.patch("/auth/consent", data),
  acceptConsent: (data: {
    privacy_policy_accepted: boolean;
    terms_accepted: boolean;
    ai_consent?: boolean;
    marketing_consent?: boolean;
  }) => api.post("/auth/accept-consent", data),
  // 2FA / TOTP
  setupTotp: () => api.post("/auth/totp/setup"),
  verifyTotp: (code: string) => api.post("/auth/totp/verify", { code }),
  disableTotp: (password: string, code: string) =>
    api.post("/auth/totp/disable", { password, code }),
  validateTotp: (temp_token: string, code: string) => api.post("/auth/totp/validate", { temp_token, code }),
};

export const adminApi = {
  listUsers: () => api.get("/admin/users"),
  createUser: (data: AdminUserCreate) => api.post("/admin/users", data),
  updateUser: (id: number, data: AdminUserUpdate) => api.patch(`/admin/users/${id}`, data),
  resetPassword: (id: number) => api.post(`/admin/users/${id}/reset-password`),
  getAuditLogs: (params?: { action?: string; limit?: number; offset?: number }) =>
    api.get("/admin/audit-logs", { params }),
  getPermissions: () => api.get("/admin/permissions"),
  updatePermissions: (data: Record<string, Record<string, string>>) => api.put("/admin/permissions", { permissions: data }),
  getMyPermissions: () => api.get("/admin/my-permissions"),
  getFactory: () => api.get("/admin/factory"),
  exportData: () =>
    api.get("/admin/export-data", { responseType: "blob" }),
  // Production Lines
  listProductionLines: () => api.get("/admin/production-lines"),
  createProductionLine: (data: ProductionLineCreate) => api.post("/admin/production-lines", data),
  updateProductionLine: (id: number, data: ProductionLineUpdate) => api.patch(`/admin/production-lines/${id}`, data),
  deleteProductionLine: (id: number) => api.delete(`/admin/production-lines/${id}`),
  // Shifts
  createShift: (data: ShiftCreate) => api.post("/admin/shifts", data),
  updateShift: (id: number, data: ShiftUpdate) => api.patch(`/admin/shifts/${id}`, data),
  deleteShift: (id: number) => api.delete(`/admin/shifts/${id}`),
  // Company branding
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/admin/company-logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteLogo: () => api.delete("/admin/company-logo"),
  // Company settings (audit label, email reports, etc.)
  getCompanySettings: () => api.get("/company/settings"),
  updateCompanySettings: (data: Record<string, unknown>) => api.put("/admin/company-settings", data),
  // ERP integrations
  listERPIntegrations: () => api.get("/erp/integrations"),
  createERPIntegration: (data: Record<string, unknown>) => api.post("/erp/integrations", data),
  updateERPIntegration: (id: number, data: Record<string, unknown>) => api.put(`/erp/integrations/${id}`, data),
  deleteERPIntegration: (id: number) => api.delete(`/erp/integrations/${id}`),
  testERPConnection: (id: number) => api.post(`/erp/integrations/${id}/test`),
  triggerERPSync: (id: number) => api.post(`/erp/integrations/${id}/sync`),
};

// Manufacturing APIs
export const manufacturingApi = {
  // Products
  createProduct: (data: ProductCreate) => api.post("/manufacturing/products", data),
  listProducts: (activeOnly = true) =>
    api.get("/manufacturing/products", { params: { active_only: activeOnly } }),
  getProduct: (id: number) => api.get(`/manufacturing/products/${id}`),
  updateProduct: (id: number, data: ProductUpdate) => api.patch(`/manufacturing/products/${id}`, data),
  downloadProductTemplate: () =>
    api.get("/manufacturing/products/template/download", { responseType: "blob" }),
  importProducts: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/manufacturing/products/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Work Centers
  createWorkCenter: (data: WorkCenterCreate) => api.post("/manufacturing/work-centers", data),
  listWorkCenters: (lineId?: number) =>
    api.get("/manufacturing/work-centers", { params: { line_id: lineId } }),
  updateWorkCenter: (id: number, data: WorkCenterUpdate) => api.patch(`/manufacturing/work-centers/${id}`, data),
  // BOM
  createBOM: (data: BOMCreate) => api.post("/manufacturing/bom", data),
  listBOMs: (productId?: number, lineId?: number) =>
    api.get("/manufacturing/bom", { params: { product_id: productId, line_id: lineId } }),
  getBOM: (id: number) => api.get(`/manufacturing/bom/${id}`),
  getBOMsForLine: (lineId: number) => api.get(`/manufacturing/bom/for-line/${lineId}`),
  approveBOM: (id: number) => api.patch(`/manufacturing/bom/${id}/approve`),
  downloadBOMTemplate: () => api.get("/manufacturing/bom/template/download", { responseType: "blob" }),
  importBOM: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/manufacturing/bom/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Production Orders
  createOrder: (data: ProductionOrderCreate) => api.post("/manufacturing/orders", data),
  listOrders: (params?: { status?: string; line_id?: number; product_id?: number }) =>
    api.get("/manufacturing/orders", { params }),
  getOrder: (id: number) => api.get(`/manufacturing/orders/${id}`),
  updateOrder: (id: number, data: ProductionOrderUpdate) => api.patch(`/manufacturing/orders/${id}`, data),
  releaseOrder: (id: number) => api.post(`/manufacturing/orders/${id}/release`),
  startOrder: (id: number) => api.post(`/manufacturing/orders/${id}/start`),
  closeOrder: (id: number) => api.post(`/manufacturing/orders/${id}/close`),
  holdOrder: (id: number, reason?: string) =>
    api.post(`/manufacturing/orders/${id}/hold`, null, { params: { reason } }),
  releaseHold: (id: number) => api.post(`/manufacturing/orders/${id}/release-hold`),
  getOrderSummary: (id: number) => api.get(`/manufacturing/orders/${id}/summary`),
};

// Quality Control APIs
export const qcApi = {
  // Defect Catalog
  createDefect: (data: DefectCatalogCreate) => api.post("/qc/defects", data),
  listDefects: (params?: { product_id?: number; line_id?: number; active_only?: boolean }) =>
    api.get("/qc/defects", { params }),
  updateDefect: (id: number, data: DefectCatalogUpdate) => api.patch(`/qc/defects/${id}`, data),
  deleteDefect: (id: number) => api.delete(`/qc/defects/${id}`),
  // QC Templates
  createTemplate: (data: QCTemplateCreate) => api.post("/qc/templates", data),
  listTemplates: (params?: { template_type?: string; product_id?: number; line_id?: number }) =>
    api.get("/qc/templates", { params }),
  getTemplate: (id: number) => api.get(`/qc/templates/${id}`),
  cloneTemplate: (id: number) => api.post(`/qc/templates/${id}/clone`),
  // QC Records
  startCheck: (data: QCRecordCreate) => api.post("/qc/records", data),
  listRecords: (params?: { check_type?: string; order_id?: number; line_id?: number }) =>
    api.get("/qc/records", { params }),
  getRecord: (id: number) => api.get(`/qc/records/${id}`),
  submitResults: (id: number, results: QCCheckResultCreate[]) => api.post(`/qc/records/${id}/results`, results),
  completeCheck: (id: number) => api.post(`/qc/records/${id}/complete`),
  voidRecord: (id: number) => api.post(`/qc/records/${id}/void`),
  // NCR
  createNCR: (data: NCRCreate) => api.post("/qc/ncr", data),
  listNCRs: (params?: { status?: string; severity?: string }) =>
    api.get("/qc/ncr", { params }),
  getNCR: (id: number) => api.get(`/qc/ncr/${id}`),
  updateNCR: (id: number, data: NCRUpdate) => api.patch(`/qc/ncr/${id}`, data),
  linkFiveWhy: (ncrId: number, analysisId: number) =>
    api.post(`/qc/ncr/${ncrId}/link-five-why/${analysisId}`),
  // CAPA
  createCAPA: (data: CAPACreate) => api.post("/qc/capa", data),
  listCAPAs: (params?: { status?: string }) => api.get("/qc/capa", { params }),
  getCAPA: (id: number) => api.get(`/qc/capa/${id}`),
  updateCAPA: (id: number, data: CAPAUpdate) => api.patch(`/qc/capa/${id}`, data),
  verifyCAPA: (id: number, effectiveness?: string) =>
    api.post(`/qc/capa/${id}/verify`, null, { params: { effectiveness } }),
  linkKaizen: (capaId: number, kaizenId: number) =>
    api.post(`/qc/capa/${capaId}/link-kaizen/${kaizenId}`),
  // QC Policy Documents
  listPolicies: (category?: string) =>
    api.get("/qc/policies", { params: category ? { category } : {} }),
  uploadPolicy: (file: File, title: string, description: string, category: string, version: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", category);
    formData.append("version", version);
    return api.post("/qc/policies", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadPolicy: (id: number) =>
    api.get(`/qc/policies/${id}/download`, { responseType: "blob" }),
  deletePolicy: (id: number) => api.delete(`/qc/policies/${id}`),
  // NCR Photo
  uploadNCRPhoto: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/qc/ncr/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getNCRPhotoUrl: (id: number) =>
    `${api.defaults.baseURL}/qc/ncr/${id}/photo`,
  // CAPA Photo
  uploadCAPAPhoto: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/qc/capa/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getCAPAPhotoUrl: (id: number) =>
    `${api.defaults.baseURL}/qc/capa/${id}/photo`,
};

// Groups / Policies APIs
export const groupsApi = {
  list: () => api.get("/admin/groups"),
  create: (data: GroupCreate) => api.post("/admin/groups", data),
  update: (id: number, data: GroupUpdate) => api.patch(`/admin/groups/${id}`, data),
  remove: (id: number) => api.delete(`/admin/groups/${id}`),
  setPolicies: (id: number, policies: GroupPolicyItem[]) =>
    api.put(`/admin/groups/${id}/policies`, { policies }),
  addMembers: (id: number, userIds: number[]) =>
    api.post(`/admin/groups/${id}/members`, { user_ids: userIds }),
  removeMembers: (id: number, userIds: number[]) =>
    api.delete(`/admin/groups/${id}/members`, { data: { user_ids: userIds } }),
};

// Waste Tracker APIs
export const wasteApi = {
  create: (data: WasteEventCreate) => api.post("/waste/", data),
  list: (params?: {
    line_id?: number;
    waste_type?: string;
    severity?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => api.get("/waste/", { params }),
  getSummary: (params?: { date_from?: string; date_to?: string; line_id?: number }) =>
    api.get("/waste/summary", { params }),
  update: (id: number, data: WasteEventUpdate) => api.put(`/waste/${id}`, data),
  remove: (id: number) => api.delete(`/waste/${id}`),
};

export const calendarApi = {
  getEvents: (params: { date_from: string; date_to: string; sources?: string[]; line_id?: number }) =>
    api.get("/calendar/events", { params }).then(r => r.data?.events ?? []),
};

// SQCDP Board APIs
export const sqcdpApi = {
  createEntry: (data: SQCDPEntryCreate) => api.post("/sqcdp/entries", data),
  listEntries: (params?: { target_date?: string; line_id?: number; tier_level?: number }) =>
    api.get("/sqcdp/entries", { params }),
  getBoard: (params?: { target_date?: string; line_id?: number; tier_level?: number }) =>
    api.get("/sqcdp/board", { params }),
  updateEntry: (id: number, data: Partial<SQCDPEntryCreate>) => api.patch(`/sqcdp/entries/${id}`, data),
  deleteEntry: (id: number) => api.delete(`/sqcdp/entries/${id}`),
  createMeeting: (data: SQCDPMeetingCreate) => api.post("/sqcdp/meetings", data),
  listMeetings: (params?: { tier_level?: number; limit?: number }) =>
    api.get("/sqcdp/meetings", { params }),
};

// Shift Handover APIs
export const handoverApi = {
  create: (data: ShiftHandoverCreate) => api.post("/shift-handover/", data),
  autoGenerate: (lineId: number, date?: string) =>
    api.post("/shift-handover/auto-generate", null, { params: { line_id: lineId, target_date: date } }),
  list: (params?: { line_id?: number; target_date?: string; limit?: number }) =>
    api.get("/shift-handover/", { params }),
  update: (id: number, data: ShiftHandoverUpdate) => api.patch(`/shift-handover/${id}`, data),
  acknowledge: (id: number) => api.post(`/shift-handover/${id}/acknowledge`),
};

// Notification APIs
export const notificationApi = {
  list: (params?: { unread_only?: boolean; limit?: number; skip?: number }) =>
    api.get("/notifications/", { params }),
  getCount: () => api.get("/notifications/count"),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
  remove: (id: number) => api.delete(`/notifications/${id}`),
};

// Leader Standard Work APIs
export const lswApi = {
  create: (data: LSWCreate) => api.post("/lsw/", data),
  list: (params?: { role?: string; active_only?: boolean }) => api.get("/lsw/", { params }),
  update: (id: number, data: LSWUpdate) => api.patch(`/lsw/${id}`, data),
  remove: (id: number) => api.delete(`/lsw/${id}`),
  logCompletion: (data: LSWCompletionCreate) => api.post("/lsw/completions", data),
  listCompletions: (params?: { lsw_id?: number; target_date?: string; limit?: number }) =>
    api.get("/lsw/completions", { params }),
};

// Audit Schedule APIs
export const auditScheduleApi = {
  create: (data: AuditScheduleCreate) => api.post("/audit-schedules/", data),
  list: (params?: { audit_type?: string; active_only?: boolean; overdue_only?: boolean }) =>
    api.get("/audit-schedules/", { params }),
  update: (id: number, data: AuditScheduleUpdate) => api.patch(`/audit-schedules/${id}`, data),
  markComplete: (id: number) => api.post(`/audit-schedules/${id}/complete`),
  remove: (id: number) => api.delete(`/audit-schedules/${id}`),
};

// Reports APIs
export const reportsApi = {
  oeeMonthly: (params: { month: number; year: number; line_id?: number }) =>
    api.get("/reports/oee-monthly", { params }),
  qcSummary: (params: { start_date: string; end_date: string }) =>
    api.get("/reports/qc-summary", { params }),
  kaizenSavings: (params: { start_date: string; end_date: string }) =>
    api.get("/reports/kaizen-savings", { params }),
  sqcdpSummary: (params: { month: number; year: number }) =>
    api.get("/reports/sqcdp-summary", { params }),
};

// Horizontal Deployment APIs
export const horizontalDeployApi = {
  create: (data: { source_type: string; source_id: number; description: string; target_lines: number[] }) =>
    api.post("/horizontal-deploy", data),
  list: (params?: { status?: string; source_type?: string }) =>
    api.get("/horizontal-deploy", { params }),
  complete: (id: number, data: { line_id: number; notes?: string }) =>
    api.patch(`/horizontal-deploy/${id}/complete`, data),
};

// Safety Incident APIs
export const safetyApi = {
  listIncidents: (params?: {
    incident_type?: string;
    severity?: string;
    status?: string;
    line_id?: number;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }) => api.get("/safety/incidents", { params }),
  createIncident: (data: SafetyIncidentCreate) => api.post("/safety/incidents", data),
  updateIncident: (id: number, data: SafetyIncidentUpdate) => api.patch(`/safety/incidents/${id}`, data),
  deleteIncident: (id: number) => api.delete(`/safety/incidents/${id}`),
  getStats: (params?: { line_id?: number }) => api.get("/safety/stats", { params }),
  // Safety Documents (server-side storage)
  listDocuments: (params?: { category?: string }) => api.get("/safety/documents", { params }),
  uploadDocument: (file: File, title: string, description: string, category: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", category);
    return api.post("/safety/documents", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadDocument: (id: number) =>
    api.get(`/safety/documents/${id}/download`, { responseType: "blob" }),
  deleteDocument: (id: number) => api.delete(`/safety/documents/${id}`),
  // Incident Photo
  uploadIncidentPhoto: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/safety/incidents/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getIncidentPhotoUrl: (id: number) =>
    `${api.defaults.baseURL}/safety/incidents/${id}/photo`,
};

// Organization / Multi-Site APIs
export const organizationApi = {
  getMyOrg: () => api.get("/organizations/me"),
  getSites: (orgId: number) => api.get(`/organizations/${orgId}/sites`),
  getDashboard: (orgId: number) => api.get(`/organizations/${orgId}/dashboard`),
  getUserRoles: (userId: number) => api.get(`/users/${userId}/roles`),
  assignRole: (userId: number, data: { organization_id: number; site_id?: number | null; role: string; scope_line_ids?: number[] | null }) =>
    api.post(`/users/${userId}/roles`, data),
  removeRole: (userId: number, roleId: number) => api.delete(`/users/${userId}/roles/${roleId}`),
};

// SPC Cross-Tool APIs
export const spcApi = {
  triggerNCR: (data: {
    production_line_id: number;
    rule_violated: string;
    sample_number?: number;
    measured_value?: number;
    ucl?: number;
    lcl?: number;
    chart_type?: string;
  }) => api.post("/spc/trigger-ncr", data),
};

export const featuresApi = {
  get: () => api.get("/features"),
};

// FMEA APIs
export const fmeaApi = {
  create: (data: any) => api.post("/fmea/", data),
  list: (params?: { skip?: number; limit?: number }) => api.get("/fmea/", { params }),
  get: (id: number) => api.get(`/fmea/${id}`),
  update: (id: number, data: any) => api.patch(`/fmea/${id}`, data),
  delete: (id: number) => api.delete(`/fmea/${id}`),
  addItem: (id: number, data: any) => api.post(`/fmea/${id}/items`, data),
  updateItem: (id: number, itemId: number, data: any) => api.patch(`/fmea/${id}/items/${itemId}`, data),
  deleteItem: (id: number, itemId: number) => api.delete(`/fmea/${id}/items/${itemId}`),
};

export const portalApi = {
  listClients: () => api.get("/portal/clients"),
  getClient: (orgId: number) => api.get(`/portal/clients/${orgId}`),
  createClient: (data: PortalClientCreate) => api.post("/portal/clients", data),
  toggleStatus: (orgId: number, isActive: boolean) => api.patch(`/portal/clients/${orgId}/status`, { is_active: isActive }),
  getHealth: (orgId: number) => api.get(`/portal/clients/${orgId}/health`),
  gdprExport: (orgId: number) => api.get(`/portal/clients/${orgId}/gdpr-export`),
  gdprErase: (orgId: number) => api.delete(`/portal/clients/${orgId}/gdpr-erase`),
};

export default api;
