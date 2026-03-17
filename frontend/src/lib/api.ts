import axios from "axios";
import type {
  ProductionRecordCreate, DowntimeEventCreate, ScrapRecordCreate,
  OEECalculateParams, AssessmentCreate,
  FiveWhyCreate, IshikawaCreate, KaizenCreate, SMEDCreate,
  SixSAuditCreate, VSMCreate, A3ReportCreate, GembaWalkCreate,
  TPMEquipmentCreate, TPMMaintenanceCreate,
  CILTStandardCreate, CILTExecutionCreate,
  AndonEventCreate, HourlyProductionCreate,
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
} from "./types";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("leanpilot_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    // Skip redirect for auth endpoints — let the caller handle 401
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/");
    if (err.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem("leanpilot_refresh");
      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            refreshSubscribers.push((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
          const newToken = res.data.access_token;
          localStorage.setItem("leanpilot_token", newToken);
          if (res.data.refresh_token) {
            localStorage.setItem("leanpilot_refresh", res.data.refresh_token);
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          onTokenRefreshed(newToken);
          isRefreshing = false;
          return api(originalRequest);
        } catch {
          isRefreshing = false;
          localStorage.removeItem("leanpilot_token");
          localStorage.removeItem("leanpilot_refresh");
        }
      }
      localStorage.removeItem("leanpilot_token");
      localStorage.removeItem("leanpilot_refresh");
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
  // SMED
  createSmed: (data: SMEDCreate) => api.post("/lean/smed", data),
  getSmedPotential: (id: number) => api.get(`/lean/smed/${id}/potential`),
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
  // CILT
  createCILTStandard: (data: CILTStandardCreate) => api.post("/lean-advanced/cilt/standards", data),
  listCILTStandards: () => api.get("/lean-advanced/cilt/standards"),
  executeCILT: (data: CILTExecutionCreate) => api.post("/lean-advanced/cilt/execute", data),
  getCILTCompliance: () => api.get("/lean-advanced/cilt/compliance"),
  // Andon
  createAndonEvent: (data: AndonEventCreate) => api.post("/lean-advanced/andon", data),
  resolveAndon: (id: number, notes?: string) => api.post(`/lean-advanced/andon/${id}/resolve`, notes ? { resolution_notes: notes } : undefined),
  getAndonStatus: () => api.get("/lean-advanced/andon/status"),
  // Hourly Production
  logHourly: (data: HourlyProductionCreate) => api.post("/lean-advanced/hourly", data),
  getHourlyView: (lineId: number, date: string) =>
    api.get(`/lean-advanced/hourly/${lineId}`, { params: { date } }),
  // Mind Map
  createMindMap: (data: { title: string; description: string; nodes: any[]; connectors: any[] }) =>
    api.post("/lean-advanced/mindmap", data),
  listMindMaps: () => api.get("/lean-advanced/mindmap"),
  getMindMap: (id: number) => api.get(`/lean-advanced/mindmap/${id}`),
  updateMindMap: (id: number, data: { title?: string; description?: string; nodes?: any[]; connectors?: any[] }) =>
    api.patch(`/lean-advanced/mindmap/${id}`, data),
  deleteMindMap: (id: number) => api.delete(`/lean-advanced/mindmap/${id}`),
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
  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),
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
  validateTotp: (code: string) => api.post("/auth/totp/validate", { code }),
};

export const adminApi = {
  listUsers: () => api.get("/admin/users"),
  createUser: (data: AdminUserCreate) => api.post("/admin/users", data),
  updateUser: (id: number, data: AdminUserUpdate) => api.patch(`/admin/users/${id}`, data),
  resetPassword: (id: number) => api.post(`/admin/users/${id}/reset-password`),
  getAuditLogs: (params?: { action?: string; limit?: number; offset?: number }) =>
    api.get("/admin/audit-logs", { params }),
  getPermissions: () => api.get("/admin/permissions"),
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
};

// Groups / Policies APIs
export const groupsApi = {
  list: () => api.get("/admin/groups"),
  create: (data: GroupCreate) => api.post("/admin/groups", data),
  update: (id: number, data: GroupUpdate) => api.patch(`/admin/groups/${id}`, data),
  remove: (id: number) => api.delete(`/admin/groups/${id}`),
  setPolicies: (id: number, policies: GroupPolicyItem[]) =>
    api.put(`/admin/groups/${id}/policies`, policies),
  addMembers: (id: number, userIds: number[]) =>
    api.post(`/admin/groups/${id}/members`, { user_ids: userIds }),
  removeMembers: (id: number, userIds: number[]) =>
    api.delete(`/admin/groups/${id}/members`, { data: { user_ids: userIds } }),
};

export const calendarApi = {
  getEvents: (params: { date_from: string; date_to: string; sources?: string[]; line_id?: number }) =>
    api.get("/calendar/events", { params }).then(r => r.data?.events ?? []),
};

export const featuresApi = {
  get: () => api.get("/features"),
};

export default api;
