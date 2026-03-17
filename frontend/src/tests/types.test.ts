import { describe, it, expectTypeOf } from "vitest";
import type {
  TokenResponse,
  UserResponse,
  RegisterData,
  AdminUserCreate,
  AdminUserUpdate,
  ProductionLineCreate,
  ProductionLineUpdate,
  ShiftCreate,
  ShiftUpdate,
  ProductionRecordCreate,
  DowntimeEventCreate,
  ScrapRecordCreate,
  OEECalculateParams,
  AssessmentCreate,
  FiveWhyCreate,
  FiveWhyStepCreate,
  IshikawaCreate,
  IshikawaCauseCreate,
  KaizenCreate,
  SMEDCreate,
  SMEDStepCreate,
  SixSAuditCreate,
  SixSAuditItemCreate,
  VSMCreate,
  VSMStepCreate,
  A3ReportCreate,
  GembaWalkCreate,
  GembaObservationCreate,
  TPMEquipmentCreate,
  TPMMaintenanceCreate,
  CILTStandardCreate,
  CILTItemCreate,
  CILTExecutionCreate,
  CILTCheckCreate,
  AndonEventCreate,
  HourlyProductionCreate,
  CopilotChatRequest,
  AIRootCauseRequest,
  ProductCreate,
  ProductUpdate,
  WorkCenterCreate,
  WorkCenterUpdate,
  BOMCreate,
  BOMComponentCreate,
  ProductionOrderCreate,
  ProductionOrderUpdate,
  DefectCatalogCreate,
  DefectCatalogUpdate,
  QCTemplateCreate,
  QCTemplateItemCreate,
  QCRecordCreate,
  QCCheckResultCreate,
  NCRCreate,
  NCRUpdate,
  CAPACreate,
  CAPAUpdate,
} from "@/lib/types";

describe("Type safety checks (compile-time)", () => {
  describe("Auth types", () => {
    it("TokenResponse has correct shape", () => {
      expectTypeOf<TokenResponse>().toHaveProperty("access_token");
      expectTypeOf<TokenResponse>().toHaveProperty("token_type");
      expectTypeOf<TokenResponse["access_token"]>().toBeString();
    });

    it("UserResponse has correct shape", () => {
      expectTypeOf<UserResponse>().toHaveProperty("id");
      expectTypeOf<UserResponse>().toHaveProperty("email");
      expectTypeOf<UserResponse>().toHaveProperty("full_name");
      expectTypeOf<UserResponse>().toHaveProperty("role");
      expectTypeOf<UserResponse>().toHaveProperty("is_active");
      expectTypeOf<UserResponse["id"]>().toBeNumber();
      expectTypeOf<UserResponse["email"]>().toBeString();
      expectTypeOf<UserResponse["is_active"]>().toBeBoolean();
    });

    it("RegisterData has correct shape", () => {
      expectTypeOf<RegisterData>().toHaveProperty("email");
      expectTypeOf<RegisterData>().toHaveProperty("password");
      expectTypeOf<RegisterData>().toHaveProperty("full_name");
      expectTypeOf<RegisterData["email"]>().toBeString();
    });
  });

  describe("Production types", () => {
    it("ProductionRecordCreate has required fields", () => {
      expectTypeOf<ProductionRecordCreate>().toHaveProperty("production_line_id");
      expectTypeOf<ProductionRecordCreate>().toHaveProperty("date");
      expectTypeOf<ProductionRecordCreate>().toHaveProperty("total_pieces");
      expectTypeOf<ProductionRecordCreate>().toHaveProperty("good_pieces");
      expectTypeOf<ProductionRecordCreate["production_line_id"]>().toBeNumber();
      expectTypeOf<ProductionRecordCreate["date"]>().toBeString();
    });

    it("DowntimeEventCreate has required fields", () => {
      expectTypeOf<DowntimeEventCreate>().toHaveProperty("production_line_id");
      expectTypeOf<DowntimeEventCreate>().toHaveProperty("start_time");
      expectTypeOf<DowntimeEventCreate>().toHaveProperty("category");
      expectTypeOf<DowntimeEventCreate>().toHaveProperty("reason");
    });

    it("ScrapRecordCreate has required fields", () => {
      expectTypeOf<ScrapRecordCreate>().toHaveProperty("production_line_id");
      expectTypeOf<ScrapRecordCreate>().toHaveProperty("date");
      expectTypeOf<ScrapRecordCreate>().toHaveProperty("quantity");
      expectTypeOf<ScrapRecordCreate>().toHaveProperty("defect_type");
    });
  });

  describe("OEE types", () => {
    it("OEECalculateParams has correct shape", () => {
      expectTypeOf<OEECalculateParams>().toHaveProperty("line_id");
      expectTypeOf<OEECalculateParams["line_id"]>().toBeNumber();
    });
  });

  describe("Lean tool types", () => {
    it("FiveWhyCreate has correct shape", () => {
      expectTypeOf<FiveWhyCreate>().toHaveProperty("title");
      expectTypeOf<FiveWhyCreate>().toHaveProperty("problem_statement");
      expectTypeOf<FiveWhyCreate["title"]>().toBeString();
    });

    it("IshikawaCreate has correct shape", () => {
      expectTypeOf<IshikawaCreate>().toHaveProperty("title");
      expectTypeOf<IshikawaCreate>().toHaveProperty("effect");
    });

    it("KaizenCreate has correct shape", () => {
      expectTypeOf<KaizenCreate>().toHaveProperty("title");
      expectTypeOf<KaizenCreate>().toHaveProperty("description");
    });

    it("SMEDCreate has correct shape", () => {
      expectTypeOf<SMEDCreate>().toHaveProperty("production_line_id");
      expectTypeOf<SMEDCreate>().toHaveProperty("changeover_name");
      expectTypeOf<SMEDCreate>().toHaveProperty("baseline_time_min");
    });
  });

  describe("Advanced lean types", () => {
    it("SixSAuditCreate has correct shape", () => {
      expectTypeOf<SixSAuditCreate>().toHaveProperty("area_name");
    });

    it("VSMCreate has correct shape", () => {
      expectTypeOf<VSMCreate>().toHaveProperty("title");
      expectTypeOf<VSMCreate>().toHaveProperty("product_family");
    });

    it("A3ReportCreate has correct shape", () => {
      expectTypeOf<A3ReportCreate>().toHaveProperty("title");
    });

    it("GembaWalkCreate has correct shape", () => {
      expectTypeOf<GembaWalkCreate>().toHaveProperty("area");
    });

    it("TPMEquipmentCreate has correct shape", () => {
      expectTypeOf<TPMEquipmentCreate>().toHaveProperty("name");
    });

    it("CILTStandardCreate has correct shape", () => {
      expectTypeOf<CILTStandardCreate>().toHaveProperty("name");
    });

    it("AndonEventCreate has correct shape", () => {
      expectTypeOf<AndonEventCreate>().toHaveProperty("production_line_id");
      expectTypeOf<AndonEventCreate>().toHaveProperty("status");
    });

    it("HourlyProductionCreate has correct shape", () => {
      expectTypeOf<HourlyProductionCreate>().toHaveProperty("production_line_id");
      expectTypeOf<HourlyProductionCreate>().toHaveProperty("hour");
      expectTypeOf<HourlyProductionCreate>().toHaveProperty("target_pieces");
      expectTypeOf<HourlyProductionCreate>().toHaveProperty("actual_pieces");
    });
  });

  describe("AI types", () => {
    it("CopilotChatRequest has correct shape", () => {
      expectTypeOf<CopilotChatRequest>().toHaveProperty("message");
      expectTypeOf<CopilotChatRequest["message"]>().toBeString();
    });

    it("AIRootCauseRequest has correct shape", () => {
      expectTypeOf<AIRootCauseRequest>().toHaveProperty("production_line_id");
      expectTypeOf<AIRootCauseRequest>().toHaveProperty("problem_description");
    });
  });

  describe("Manufacturing types", () => {
    it("ProductCreate has correct shape", () => {
      expectTypeOf<ProductCreate>().toHaveProperty("code");
      expectTypeOf<ProductCreate>().toHaveProperty("name");
    });

    it("BOMCreate has correct shape", () => {
      expectTypeOf<BOMCreate>().toHaveProperty("product_id");
      expectTypeOf<BOMCreate>().toHaveProperty("production_line_id");
      expectTypeOf<BOMCreate>().toHaveProperty("ideal_cycle_time_sec");
    });

    it("ProductionOrderCreate has correct shape", () => {
      expectTypeOf<ProductionOrderCreate>().toHaveProperty("production_line_id");
      expectTypeOf<ProductionOrderCreate>().toHaveProperty("product_id");
      expectTypeOf<ProductionOrderCreate>().toHaveProperty("planned_quantity");
    });
  });

  describe("QC types", () => {
    it("DefectCatalogCreate has correct shape", () => {
      expectTypeOf<DefectCatalogCreate>().toHaveProperty("code");
      expectTypeOf<DefectCatalogCreate>().toHaveProperty("name");
    });

    it("QCTemplateCreate has correct shape", () => {
      expectTypeOf<QCTemplateCreate>().toHaveProperty("name");
      expectTypeOf<QCTemplateCreate>().toHaveProperty("template_type");
    });

    it("NCRCreate has correct shape", () => {
      expectTypeOf<NCRCreate>().toHaveProperty("title");
      expectTypeOf<NCRCreate>().toHaveProperty("description");
      expectTypeOf<NCRCreate>().toHaveProperty("severity");
    });

    it("CAPACreate has correct shape", () => {
      expectTypeOf<CAPACreate>().toHaveProperty("capa_type");
      expectTypeOf<CAPACreate>().toHaveProperty("title");
      expectTypeOf<CAPACreate>().toHaveProperty("description");
    });
  });
});
