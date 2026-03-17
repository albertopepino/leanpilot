/**
 * LeanPilot API Types — mirrors backend Pydantic schemas.
 * Includes frontend-specific field aliases where components use different names.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  factory_id: number | null;
  language: string;
  privacy_policy_accepted_at?: string | null;
  terms_accepted_at?: string | null;
  ai_consent: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role?: string;
  language?: string;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminUserCreate {
  email: string;
  full_name: string;
  role?: string;
  language?: string;
  password?: string;
}

export interface AdminUserUpdate {
  role?: string;
  is_active?: boolean;
  language?: string;
  full_name?: string;
}

export interface ProductionLineCreate {
  name: string;
  description?: string;
  product_type?: string | null;
  target_oee?: number;
  target_cycle_time_seconds?: number | null;
  is_active?: boolean;
}

export interface ProductionLineUpdate {
  name?: string;
  description?: string;
  product_type?: string | null;
  target_oee?: number;
  target_cycle_time_seconds?: number | null;
  is_active?: boolean;
}

export interface ShiftCreate {
  name: string;
  start_hour: number;
  end_hour: number;
  planned_minutes?: number;
  production_line_id?: number;
}

export interface ShiftUpdate {
  name?: string;
  start_hour?: number;
  end_hour?: number;
  planned_minutes?: number;
  is_active?: boolean;
}

// ─── Production ──────────────────────────────────────────────────────────────

export interface ProductionRecordCreate {
  production_line_id: number;
  shift_id?: number | null;
  date: string;
  planned_production_time_min: number;
  actual_run_time_min: number;
  total_pieces: number;
  good_pieces: number;
  ideal_cycle_time_sec: number;
  notes?: string | null;
}

export interface DowntimeEventCreate {
  production_line_id: number;
  production_record_id?: number | null;
  record_id?: number | null;
  date?: string | null;
  start_time?: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  duration_min?: number | null;
  type?: string | null;
  category?: string;
  reason: string;
  machine?: string | null;
  notes?: string | null;
}

export interface ScrapRecordCreate {
  production_line_id: number;
  production_record_id?: number | null;
  record_id?: number | null;
  date?: string;
  quantity: number;
  defect_type: string;
  defect_description?: string | null;
  cost_estimate?: number | null;
  root_cause?: string | null;
  notes?: string | null;
}

// ─── OEE ─────────────────────────────────────────────────────────────────────

export interface OEECalculateParams {
  line_id: number;
  date?: string;
  days?: number;
}

// ─── Lean Tools ──────────────────────────────────────────────────────────────

export interface AssessmentCreate {
  production_line_id?: number | null;
  scores?: Record<string, number>;
  notes?: string | null;
  answers?: Record<string, number>;
  categoryScores?: Array<{ id: string; titleKey: string; score: number; level: number | string }>;
  overallScore?: number;
  overallLevel?: number | string;
  completedAt?: string;
}

export interface FiveWhyStepCreate {
  step_number: number;
  why_question: string;
  answer: string;
}

export interface FiveWhyCreate {
  production_line_id?: number | null;
  title: string;
  problem_statement?: string;
  problem?: string;
  steps?: FiveWhyStepCreate[];
  answers?: string[];
  rootCause?: string;
  verification?: (string | boolean)[];
  countermeasure?: string | null;
  countermeasures?: Array<string | { action: string; owner: string; dueDate: string; status: string }>;
  responsible?: string | null;
  due_date?: string | null;
}

export interface IshikawaCauseCreate {
  category: string;
  cause: string;
  sub_cause?: string | null;
  is_root_cause?: boolean;
}

export interface IshikawaCreate {
  production_line_id?: number | null;
  title: string;
  effect: string;
  causes?: IshikawaCauseCreate[];
  categories?: Record<string, unknown>;
  notes?: string;
  conclusion?: string | null;
}

export interface KaizenCreate {
  production_line_id?: number | null;
  title: string;
  description?: string;
  area?: string | null;
  category?: string | null;
  priority?: string;
  expected_impact?: string | null;
  expected_savings_eur?: number | null;
  target_date?: string | null;
  assigned_to_id?: number | null;
  owner?: string | null;
}

export interface SMEDStepCreate {
  step_order?: number;
  order?: number;
  description: string;
  duration_seconds?: number;
  phase?: string;
  can_be_externalized?: boolean;
  improvement_notes?: string | null;
}

export interface SMEDCreate {
  production_line_id?: number;
  changeover_name?: string;
  name?: string;
  line_id?: number;
  baseline_time_min?: number;
  baseline_seconds?: number;
  current_time_min?: number | null;
  target_time_min?: number | null;
  target_seconds?: number;
  steps?: SMEDStepCreate[];
}

// ─── Advanced Lean ───────────────────────────────────────────────────────────

export interface SixSAuditItemCreate {
  category: string;
  question?: string;
  question_key?: string;
  score: number;
  finding?: string | null;
  corrective_action?: string | null;
  responsible?: string | null;
  due_date?: string | null;
}

export interface SixSAuditCreate {
  production_line_id?: number | null;
  area_name?: string;
  area?: string;
  date?: string;
  overall_score?: number;
  grade?: string;
  scores?: Record<string, number>;
  notes?: string | null;
  items?: SixSAuditItemCreate[];
  details?: SixSAuditItemCreate[];
}

export interface VSMStepCreate {
  step_order?: number;
  process_name?: string;
  cycle_time_sec?: number | null;
  changeover_time_min?: number | null;
  uptime_pct?: number | null;
  batch_size?: number | null;
  operators?: number | null;
  wip_before?: number | null;
  wait_time_hours?: number | null;
  is_bottleneck?: boolean;
  is_kaizen_burst?: boolean;
  notes?: string | null;
}

export interface VSMCreate {
  title: string;
  product_family: string;
  map_type?: string;
  takt_time_sec?: number | null;
  customer_demand_per_day?: number | null;
  notes?: string | null;
  steps?: VSMStepCreate[];
  future_steps?: VSMStepCreate[];
}

export interface A3ReportCreate {
  title: string;
  background?: string | null;
  current_condition?: string | null;
  goal_statement?: string | null;
  root_cause_analysis?: string | null;
  countermeasures?: string | null;
  implementation_plan?: string | null;
  follow_up?: string | null;
  results?: string | null;
  target_date?: string | null;
  five_why_id?: number | null;
  ishikawa_id?: number | null;
  owner?: string | null;
  date?: string | null;
  status?: string | null;
}

export interface GembaActionCreate {
  id?: string;
  what?: string;
  who?: string;
  when?: string;
  status?: string;
}

export interface GembaObservationCreate {
  id?: string;
  observation_type?: string;
  description: string;
  category?: string | null;
  severity?: string | null;
  location?: string | null;
  photoPlaceholder?: string | null;
  action_required?: boolean;
  assigned_to?: string | null;
  due_date?: string | null;
  priority?: string;
  actions?: GembaActionCreate[];
}

export interface GembaWalkCreate {
  area: string;
  date?: string | null;
  duration_min?: number | null;
  theme?: string | null;
  summary?: string | null;
  observations?: GembaObservationCreate[];
}

export interface TPMEquipmentCreate {
  production_line_id?: number | null;
  name: string;
  equipment_code?: string | null;
  type?: string | null;
  location?: string | null;
  criticality?: string;
  status?: string;
  oee?: number;
  mtbf_hours?: number | null;
  mttr_hours?: number | null;
  maintenance_interval_days?: number;
  last_maintenance?: string;
  next_pm?: string;
}

export interface TPMMaintenanceCreate {
  equipment_id: number;
  maintenance_type?: string;
  type?: string;
  date?: string;
  pillar?: string | null;
  description: string;
  duration_min?: number | null;
  duration_hours?: number | null;
  technician?: string | null;
  parts_replaced?: string[] | string;
  cost_eur?: number | null;
  findings?: string | null;
  next_action?: string | null;
}

export interface CILTItemCreate {
  item_order?: number;
  category: string;
  description?: string;
  task_description?: string;
  method?: string | null;
  standard_value?: string | null;
  acceptance_criteria?: string | null;
  tool_required?: string | null;
  time_seconds?: number | null;
  time_estimate_minutes?: number | null;
}

export interface CILTStandardCreate {
  equipment_id?: number | null;
  production_line_id?: number | null;
  name: string;
  area?: string | null;
  equipment_area?: string | null;
  frequency?: string;
  estimated_time_min?: number | null;
  items?: CILTItemCreate[];
}

export interface CILTCheckCreate {
  item_id: number | string;
  status: string;
  measured_value?: string | null;
  anomaly_description?: string | null;
  notes?: string | null;
  timestamp?: string | null;
}

export interface CILTExecutionCreate {
  standard_id: number | string;
  shift?: string | null;
  duration_min?: number | null;
  notes?: string | null;
  executed_at?: string | null;
  checks?: CILTCheckCreate[];
}

export interface AndonEventCreate {
  production_line_id: number;
  status: string;
  reason?: string | null;
  description?: string | null;
}

export interface HourlyProductionCreate {
  production_line_id?: number;
  lineId?: number;
  date: string;
  hour: number | string;
  shift?: string | null;
  target_pieces?: number;
  target?: number;
  actual_pieces?: number;
  actual?: number | null;
  scrap_pieces?: number;
  downtime_min?: number;
  notes?: string | null;
  reasonCode?: string | null;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface CopilotChatRequest {
  conversation_id?: number | null;
  message: string;
  production_line_id?: number | null;
  system_prompt?: string | null;
  context?: Record<string, unknown> | null;
}

export interface AIRootCauseRequest {
  production_line_id: number;
  problem_description: string;
  include_data?: boolean;
}

// ─── Manufacturing ───────────────────────────────────────────────────────────

export interface ProductCreate {
  code: string;
  name: string;
  description?: string | null;
  unit_of_measure?: string;
  product_family?: string | null;
  labor_minutes_per_unit?: number | null;
  is_active?: boolean;
}

export interface ProductUpdate {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  unit_of_measure?: string | null;
  product_family?: string | null;
  labor_minutes_per_unit?: number | null;
  is_active?: boolean | null;
}

export interface WorkCenterCreate {
  production_line_id: number;
  name: string;
  description?: string | null;
  machine_type?: string | null;
  capacity_units_per_hour?: number | null;
  is_active?: boolean;
}

export interface WorkCenterUpdate {
  name?: string | null;
  description?: string | null;
  machine_type?: string | null;
  capacity_units_per_hour?: number | null;
  is_active?: boolean | null;
}

export interface BOMComponentCreate {
  sequence?: number;
  material_code?: string | null;
  material_name: string;
  quantity_per_unit: number;
  unit_of_measure?: string | null;
  is_critical?: boolean;
  notes?: string | null;
}

export interface BOMOperationCreate {
  sequence?: number;
  work_center_id?: number | null;
  operation_name: string;
  cycle_time_seconds: number;
  cycle_time_basis?: string; // "per_piece" or "per_100"
  labor_minutes?: number | null;
  notes?: string | null;
}

export interface BOMCreate {
  product_id: number;
  production_line_id: number;
  version?: string;
  ideal_cycle_time_sec: number;
  batch_size?: number | null;
  notes?: string | null;
  components?: BOMComponentCreate[];
  operations?: BOMOperationCreate[];
}

export interface ProductionOrderLineCreate {
  production_line_id: number;
  bom_id?: number | null;
  planned_quantity: number;
  notes?: string | null;
}

export interface ProductionOrderCreate {
  production_line_id: number;
  product_id: number;
  bom_id?: number | null;
  order_number?: string | null;
  planned_quantity: number;
  planned_start?: string | null;
  planned_end?: string | null;
  customer_ref?: string | null;
  notes?: string | null;
  order_lines?: ProductionOrderLineCreate[];
}

export interface ProductionOrderUpdate {
  planned_quantity?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  customer_ref?: string | null;
  notes?: string | null;
  bom_id?: number | null;
}

// ─── QC ──────────────────────────────────────────────────────────────────────

export interface DefectCatalogCreate {
  product_id?: number | null;
  production_line_id?: number | null;
  code: string;
  name: string;
  severity?: string;
  category?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface DefectCatalogUpdate {
  code?: string | null;
  name?: string | null;
  severity?: string | null;
  category?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface QCTemplateItemCreate {
  item_order: number;
  category?: string | null;
  check_type?: string;
  description: string;
  specification?: string | null;
  lower_limit?: number | null;
  upper_limit?: number | null;
  unit?: string | null;
  is_critical?: boolean;
  is_mandatory?: boolean;
}

export interface QCTemplateCreate {
  product_id?: number | null;
  production_line_id?: number | null;
  work_center_id?: number | null;
  name: string;
  template_type: string;
  version?: string;
  estimated_time_min?: number | null;
  description?: string | null;
  pass_threshold_pct?: number;
  critical_items_must_pass?: boolean;
  items?: QCTemplateItemCreate[];
}

export interface QCRecordCreate {
  template_id: number;
  production_order_id?: number | null;
  production_line_id: number;
  production_record_id?: number | null;
  check_type: string;
  sample_size?: number | null;
  sample_number?: number | null;
  notes?: string | null;
}

export interface QCCheckResultCreate {
  template_item_id: number;
  result: string;
  measured_value?: number | null;
  text_value?: string | null;
  notes?: string | null;
  defect_catalog_id?: number | null;
}

export interface NCRCreate {
  production_line_id?: number | null;
  production_order_id?: number | null;
  qc_record_id?: number | null;
  product_id?: number | null;
  defect_catalog_id?: number | null;
  title: string;
  description: string;
  severity: string;
  quantity_affected?: number | null;
}

export interface NCRUpdate {
  status?: string | null;
  assigned_to_id?: number | null;
  disposition?: string | null;
  disposition_notes?: string | null;
  root_cause?: string | null;
}

export interface CAPACreate {
  ncr_id?: number | null;
  production_line_id?: number | null;
  capa_type: string;
  title: string;
  description: string;
  root_cause?: string | null;
  priority?: string;
  owner_id?: number | null;
  due_date?: string | null;
}

export interface CAPAUpdate {
  status?: string | null;
  owner_id?: number | null;
  root_cause?: string | null;
  priority?: string | null;
  due_date?: string | null;
  effectiveness_result?: string | null;
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export type CalendarEventSource = "capa" | "kaizen" | "tpm_maintenance" | "tpm_equipment" | "six_s" | "gemba" | "production_order_start" | "production_order_end" | "cilt";

export interface CalendarEvent {
  id: number;
  source: CalendarEventSource;
  title: string;
  date: string;
  end_date: string | null;
  status: string | null;
  priority: string | null;
  production_line_id: number | null;
  production_line_name: string | null;
  source_id: number;
  view_key: string;
}

// ─── Groups / Policies ─────────────────────────────────────────────────────

export interface GroupPolicyItem {
  tab_id: string;
  permission: "full" | "modify" | "view" | "hidden";
}

export interface GroupResponse {
  id: number;
  factory_id: number;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  policies: GroupPolicyItem[];
  member_ids: number[];
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupCreate {
  name: string;
  description?: string;
  color?: string;
}

export interface GroupUpdate {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}
