import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// Mock axios before importing the API module
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

// Import after mock
import api, {
  productionApi,
  oeeApi,
  leanApi,
  advancedLeanApi,
  aiApi,
  authApi,
  adminApi,
  manufacturingApi,
  qcApi,
  featuresApi,
} from "@/lib/api";

describe("API Client", () => {
  // Get the mocked axios instance
  const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0]?.value;

  describe("axios instance creation", () => {
    it("creates an axios instance with correct baseURL", () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "/api/v1",
        headers: { "Content-Type": "application/json" },
      });
    });

    it("registers request and response interceptors", () => {
      expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe("request interceptor adds auth token", () => {
    it("adds Authorization header when token exists in localStorage", () => {
      const requestInterceptor =
        mockInstance.interceptors.request.use.mock.calls[0][0];

      localStorage.setItem("leanpilot_token", "test-token-123");
      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBe("Bearer test-token-123");
      localStorage.removeItem("leanpilot_token");
    });

    it("does not add Authorization header when no token exists", () => {
      const requestInterceptor =
        mockInstance.interceptors.request.use.mock.calls[0][0];

      localStorage.removeItem("leanpilot_token");
      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe("productionApi", () => {
    it("has all expected methods", () => {
      expect(typeof productionApi.createRecord).toBe("function");
      expect(typeof productionApi.listRecords).toBe("function");
      expect(typeof productionApi.createDowntime).toBe("function");
      expect(typeof productionApi.createScrap).toBe("function");
    });

    it("calls correct URLs", () => {
      productionApi.createRecord({
        production_line_id: 1,
        date: "2026-01-01",
        planned_production_time_min: 480,
        actual_run_time_min: 420,
        total_pieces: 100,
        good_pieces: 95,
        ideal_cycle_time_sec: 30,
      });
      expect(mockInstance.post).toHaveBeenCalledWith(
        "/production/records",
        expect.any(Object)
      );

      productionApi.listRecords(1);
      expect(mockInstance.get).toHaveBeenCalledWith("/production/records", {
        params: { line_id: 1 },
      });
    });
  });

  describe("oeeApi", () => {
    it("has all expected methods", () => {
      expect(typeof oeeApi.getSummary).toBe("function");
      expect(typeof oeeApi.getTrend).toBe("function");
      expect(typeof oeeApi.calculate).toBe("function");
    });

    it("passes correct params for getSummary", () => {
      oeeApi.getSummary(1, 7);
      expect(mockInstance.get).toHaveBeenCalledWith("/oee/summary/1", {
        params: { days: 7 },
      });
    });
  });

  describe("leanApi", () => {
    it("has all expected methods", () => {
      expect(typeof leanApi.saveAssessment).toBe("function");
      expect(typeof leanApi.getAssessment).toBe("function");
      expect(typeof leanApi.getLatestAssessment).toBe("function");
      expect(typeof leanApi.createFiveWhy).toBe("function");
      expect(typeof leanApi.listFiveWhy).toBe("function");
      expect(typeof leanApi.getFiveWhy).toBe("function");
      expect(typeof leanApi.deleteFiveWhy).toBe("function");
      expect(typeof leanApi.createIshikawa).toBe("function");
      expect(typeof leanApi.listIshikawa).toBe("function");
      expect(typeof leanApi.createKaizen).toBe("function");
      expect(typeof leanApi.getKaizenBoard).toBe("function");
      expect(typeof leanApi.updateKaizenStatus).toBe("function");
      expect(typeof leanApi.getKaizenSavings).toBe("function");
      expect(typeof leanApi.createSmed).toBe("function");
      expect(typeof leanApi.getSmedPotential).toBe("function");
    });
  });

  describe("advancedLeanApi", () => {
    it("has all expected methods", () => {
      expect(typeof advancedLeanApi.createSixSAudit).toBe("function");
      expect(typeof advancedLeanApi.listSixSAudits).toBe("function");
      expect(typeof advancedLeanApi.getSixSTrend).toBe("function");
      expect(typeof advancedLeanApi.createVSM).toBe("function");
      expect(typeof advancedLeanApi.listVSM).toBe("function");
      expect(typeof advancedLeanApi.createA3).toBe("function");
      expect(typeof advancedLeanApi.listA3).toBe("function");
      expect(typeof advancedLeanApi.updateA3Status).toBe("function");
      expect(typeof advancedLeanApi.createGembaWalk).toBe("function");
      expect(typeof advancedLeanApi.listGembaWalks).toBe("function");
      expect(typeof advancedLeanApi.createEquipment).toBe("function");
      expect(typeof advancedLeanApi.listEquipment).toBe("function");
      expect(typeof advancedLeanApi.logMaintenance).toBe("function");
      expect(typeof advancedLeanApi.createCILTStandard).toBe("function");
      expect(typeof advancedLeanApi.listCILTStandards).toBe("function");
      expect(typeof advancedLeanApi.executeCILT).toBe("function");
      expect(typeof advancedLeanApi.getCILTCompliance).toBe("function");
      expect(typeof advancedLeanApi.createAndonEvent).toBe("function");
      expect(typeof advancedLeanApi.resolveAndon).toBe("function");
      expect(typeof advancedLeanApi.getAndonStatus).toBe("function");
      expect(typeof advancedLeanApi.logHourly).toBe("function");
      expect(typeof advancedLeanApi.getHourlyView).toBe("function");
    });
  });

  describe("aiApi", () => {
    it("has all expected methods", () => {
      expect(typeof aiApi.chat).toBe("function");
      expect(typeof aiApi.rootCause).toBe("function");
      expect(typeof aiApi.autoKaizen).toBe("function");
    });
  });

  describe("authApi", () => {
    it("has all expected methods", () => {
      expect(typeof authApi.login).toBe("function");
      expect(typeof authApi.register).toBe("function");
      expect(typeof authApi.refresh).toBe("function");
      expect(typeof authApi.me).toBe("function");
      expect(typeof authApi.updateProfile).toBe("function");
      expect(typeof authApi.changePassword).toBe("function");
      expect(typeof authApi.updateConsent).toBe("function");
    });

    it("login sends form-encoded data", () => {
      authApi.login("user@test.com", "pass123");
      expect(mockInstance.post).toHaveBeenCalledWith(
        "/auth/login",
        expect.any(URLSearchParams),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
    });
  });

  describe("adminApi", () => {
    it("has all expected methods", () => {
      expect(typeof adminApi.listUsers).toBe("function");
      expect(typeof adminApi.createUser).toBe("function");
      expect(typeof adminApi.updateUser).toBe("function");
      expect(typeof adminApi.resetPassword).toBe("function");
      expect(typeof adminApi.getAuditLogs).toBe("function");
      expect(typeof adminApi.getPermissions).toBe("function");
      expect(typeof adminApi.getMyPermissions).toBe("function");
      expect(typeof adminApi.getFactory).toBe("function");
      expect(typeof adminApi.exportData).toBe("function");
      expect(typeof adminApi.listProductionLines).toBe("function");
      expect(typeof adminApi.createProductionLine).toBe("function");
      expect(typeof adminApi.updateProductionLine).toBe("function");
      expect(typeof adminApi.deleteProductionLine).toBe("function");
      expect(typeof adminApi.createShift).toBe("function");
      expect(typeof adminApi.updateShift).toBe("function");
      expect(typeof adminApi.deleteShift).toBe("function");
      expect(typeof adminApi.uploadLogo).toBe("function");
      expect(typeof adminApi.deleteLogo).toBe("function");
    });
  });

  describe("manufacturingApi", () => {
    it("has all expected methods", () => {
      expect(typeof manufacturingApi.createProduct).toBe("function");
      expect(typeof manufacturingApi.listProducts).toBe("function");
      expect(typeof manufacturingApi.getProduct).toBe("function");
      expect(typeof manufacturingApi.updateProduct).toBe("function");
      expect(typeof manufacturingApi.createWorkCenter).toBe("function");
      expect(typeof manufacturingApi.listWorkCenters).toBe("function");
      expect(typeof manufacturingApi.updateWorkCenter).toBe("function");
      expect(typeof manufacturingApi.createBOM).toBe("function");
      expect(typeof manufacturingApi.listBOMs).toBe("function");
      expect(typeof manufacturingApi.getBOM).toBe("function");
      expect(typeof manufacturingApi.approveBOM).toBe("function");
      expect(typeof manufacturingApi.createOrder).toBe("function");
      expect(typeof manufacturingApi.listOrders).toBe("function");
      expect(typeof manufacturingApi.getOrder).toBe("function");
      expect(typeof manufacturingApi.updateOrder).toBe("function");
      expect(typeof manufacturingApi.releaseOrder).toBe("function");
      expect(typeof manufacturingApi.startOrder).toBe("function");
      expect(typeof manufacturingApi.closeOrder).toBe("function");
      expect(typeof manufacturingApi.holdOrder).toBe("function");
      expect(typeof manufacturingApi.releaseHold).toBe("function");
      expect(typeof manufacturingApi.getOrderSummary).toBe("function");
    });
  });

  describe("qcApi", () => {
    it("has all expected methods", () => {
      expect(typeof qcApi.createDefect).toBe("function");
      expect(typeof qcApi.listDefects).toBe("function");
      expect(typeof qcApi.updateDefect).toBe("function");
      expect(typeof qcApi.deleteDefect).toBe("function");
      expect(typeof qcApi.createTemplate).toBe("function");
      expect(typeof qcApi.listTemplates).toBe("function");
      expect(typeof qcApi.getTemplate).toBe("function");
      expect(typeof qcApi.cloneTemplate).toBe("function");
      expect(typeof qcApi.startCheck).toBe("function");
      expect(typeof qcApi.listRecords).toBe("function");
      expect(typeof qcApi.getRecord).toBe("function");
      expect(typeof qcApi.submitResults).toBe("function");
      expect(typeof qcApi.completeCheck).toBe("function");
      expect(typeof qcApi.voidRecord).toBe("function");
      expect(typeof qcApi.createNCR).toBe("function");
      expect(typeof qcApi.listNCRs).toBe("function");
      expect(typeof qcApi.getNCR).toBe("function");
      expect(typeof qcApi.updateNCR).toBe("function");
      expect(typeof qcApi.linkFiveWhy).toBe("function");
      expect(typeof qcApi.createCAPA).toBe("function");
      expect(typeof qcApi.listCAPAs).toBe("function");
      expect(typeof qcApi.getCAPA).toBe("function");
      expect(typeof qcApi.updateCAPA).toBe("function");
      expect(typeof qcApi.verifyCAPA).toBe("function");
      expect(typeof qcApi.linkKaizen).toBe("function");
      expect(typeof qcApi.listPolicies).toBe("function");
      expect(typeof qcApi.uploadPolicy).toBe("function");
      expect(typeof qcApi.downloadPolicy).toBe("function");
      expect(typeof qcApi.deletePolicy).toBe("function");
    });
  });

  describe("featuresApi", () => {
    it("has get method", () => {
      expect(typeof featuresApi.get).toBe("function");
    });
  });
});
