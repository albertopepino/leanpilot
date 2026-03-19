"use client";

import { useState, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { adminApi, manufacturingApi } from "@/lib/api";
import {
  Download, Upload, FileSpreadsheet, Users, Factory, Package,
  Layers, Wrench, CheckCircle, XCircle, AlertTriangle, Loader2,
  FileDown, Trash2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type TemplateType = "production_lines" | "shifts" | "products" | "bom" | "users" | "work_centers";

interface TemplateConfig {
  type: TemplateType;
  label: string;
  description: string;
  icon: React.ReactNode;
  columns: string[];
  examples: string[][];
  notes: string[];
  importFn: (row: Record<string, string>) => Promise<void>;
  exportFn?: () => Promise<Record<string, string>[]>;
}

type ValidationStatus = "pending" | "valid" | "error";

interface ParsedRow {
  data: Record<string, string>;
  status: ValidationStatus;
  errors: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: string[];
}

// ── CSV Helpers ────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(current.trim());
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        current = "";
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

function toCSV(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

function downloadCSV(filename: string, content: string) {
  // BOM for Excel compatibility
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Template Definitions ───────────────────────────────────────────────────

const TEMPLATES: TemplateConfig[] = [
  {
    type: "production_lines",
    label: "Production Lines",
    description: "Import production lines with OEE targets and cycle times",
    icon: <Factory className="w-6 h-6" />,
    columns: ["name", "product_type", "target_oee", "target_cycle_time_seconds", "is_active"],
    examples: [
      ["Assembly Line A", "Electronics", "85", "45", "true"],
      ["Packaging Line 1", "Consumer Goods", "90", "30", "true"],
    ],
    notes: [
      "name: Required. Unique name for the line.",
      "product_type: Optional. Type of product manufactured.",
      "target_oee: Optional. Target OEE percentage (0-100). Default: 85.",
      "target_cycle_time_seconds: Optional. Ideal cycle time in seconds.",
      "is_active: Optional. true or false. Default: true.",
    ],
    importFn: async (row) => {
      await adminApi.createProductionLine({
        name: row.name,
        product_type: row.product_type || null,
        target_oee: row.target_oee ? parseFloat(row.target_oee) / 100 : undefined,
        target_cycle_time_seconds: row.target_cycle_time_seconds
          ? parseFloat(row.target_cycle_time_seconds)
          : null,
        is_active: row.is_active !== "false",
      });
    },
    exportFn: async () => {
      const res = await adminApi.listProductionLines();
      const lines = res.data?.lines ?? res.data ?? [];
      return lines.map((l: Record<string, unknown>) => ({
        name: (l.name as string) ?? "",
        product_type: (l.product_type as string) ?? "",
        target_oee: l.target_oee != null ? String(Math.round((l.target_oee as number) * 100)) : "",
        target_cycle_time_seconds: l.target_cycle_time_seconds != null ? String(l.target_cycle_time_seconds) : "",
        is_active: l.is_active != null ? String(l.is_active) : "true",
      }));
    },
  },
  {
    type: "shifts",
    label: "Shifts",
    description: "Import shift definitions linked to production lines",
    icon: <Layers className="w-6 h-6" />,
    columns: ["production_line_name", "shift_name", "start_hour", "end_hour", "planned_minutes"],
    examples: [
      ["Assembly Line A", "Morning", "6", "14", "450"],
      ["Assembly Line A", "Afternoon", "14", "22", "450"],
    ],
    notes: [
      "production_line_name: Required. Must match an existing production line name.",
      "shift_name: Required. Name of the shift (e.g., Morning, Night).",
      "start_hour: Required. Start hour (0-23).",
      "end_hour: Required. End hour (0-23).",
      "planned_minutes: Optional. Planned productive minutes. Default: calculated from hours.",
    ],
    importFn: async (row) => {
      // Look up line by name first
      const linesRes = await adminApi.listProductionLines();
      const lines = linesRes.data?.lines ?? linesRes.data ?? [];
      const line = lines.find((l: Record<string, unknown>) => l.name === row.production_line_name);
      if (!line) throw new Error(`Production line "${row.production_line_name}" not found`);

      await adminApi.createShift({
        name: row.shift_name,
        start_hour: parseInt(row.start_hour),
        end_hour: parseInt(row.end_hour),
        planned_minutes: row.planned_minutes ? parseInt(row.planned_minutes) : undefined,
        production_line_id: line.id,
      });
    },
  },
  {
    type: "products",
    label: "Products",
    description: "Import product catalog with codes and units",
    icon: <Package className="w-6 h-6" />,
    columns: ["code", "name", "description", "unit_of_measure", "cycle_time_seconds", "is_active"],
    examples: [
      ["PRD-001", "Widget Alpha", "Standard widget, blue variant", "pcs", "12.5", "true"],
      ["PRD-002", "Gasket Ring M12", "M12 rubber gasket", "pcs", "8", "true"],
    ],
    notes: [
      "code: Required. Unique product code.",
      "name: Required. Product display name.",
      "description: Optional. Text description.",
      "unit_of_measure: Optional. e.g., pcs, kg, m. Default: pcs.",
      "cycle_time_seconds: Optional. Standard cycle time per unit in seconds.",
      "is_active: Optional. true or false. Default: true.",
    ],
    importFn: async (row) => {
      await manufacturingApi.createProduct({
        code: row.code,
        name: row.name,
        description: row.description || null,
        unit_of_measure: row.unit_of_measure || "pcs",
        is_active: row.is_active !== "false",
      });
    },
    exportFn: async () => {
      const res = await manufacturingApi.listProducts(false);
      const products = res.data?.products ?? res.data ?? [];
      return products.map((p: Record<string, unknown>) => ({
        code: (p.code as string) ?? "",
        name: (p.name as string) ?? "",
        description: (p.description as string) ?? "",
        unit_of_measure: (p.unit_of_measure as string) ?? "",
        cycle_time_seconds: "",
        is_active: p.is_active != null ? String(p.is_active) : "true",
      }));
    },
  },
  {
    type: "bom",
    label: "BOM (Bill of Materials)",
    description: "Import component lists for product routings",
    icon: <FileSpreadsheet className="w-6 h-6" />,
    columns: ["product_code", "component_name", "quantity", "unit_of_measure", "operation_sequence"],
    examples: [
      ["PRD-001", "Steel Plate 2mm", "1.5", "kg", "10"],
      ["PRD-001", "Rivet M4x8", "12", "pcs", "20"],
    ],
    notes: [
      "product_code: Required. Must match an existing product code.",
      "component_name: Required. Name of the raw material or sub-component.",
      "quantity: Required. Quantity per unit of finished product.",
      "unit_of_measure: Optional. e.g., pcs, kg, m. Default: pcs.",
      "operation_sequence: Optional. Numeric sequence for routing order.",
    ],
    importFn: async (_row) => {
      // BOM import requires product lookup + complex creation — simplified here
      throw new Error("BOM import requires the full backend BOM import endpoint. Use the API directly.");
    },
  },
  {
    type: "users",
    label: "Users",
    description: "Bulk-create user accounts with roles",
    icon: <Users className="w-6 h-6" />,
    columns: ["email", "full_name", "role", "language"],
    examples: [
      ["mario.rossi@factory.com", "Mario Rossi", "operator", "it"],
      ["anna.kowalska@factory.com", "Anna Kowalska", "line_supervisor", "pl"],
    ],
    notes: [
      "email: Required. Valid email address. Must be unique.",
      "full_name: Required. User's display name.",
      "role: Optional. One of: admin, plant_manager, line_supervisor, operator, viewer. Default: operator.",
      "language: Optional. Two-letter code (en, it, de, fr, es, pl, sr). Default: en.",
    ],
    importFn: async (row) => {
      await adminApi.createUser({
        email: row.email,
        full_name: row.full_name,
        role: row.role || "operator",
        language: row.language || "en",
      });
    },
    exportFn: async () => {
      const res = await adminApi.listUsers();
      const users = res.data?.users ?? res.data ?? [];
      return users.map((u: Record<string, unknown>) => ({
        email: (u.email as string) ?? "",
        full_name: (u.full_name as string) ?? "",
        role: (u.role as string) ?? "",
        language: (u.language as string) ?? "en",
      }));
    },
  },
  {
    type: "work_centers",
    label: "Work Centers",
    description: "Import work centers / machines for production lines",
    icon: <Wrench className="w-6 h-6" />,
    columns: ["name", "code", "description", "capacity_per_hour"],
    examples: [
      ["CNC Lathe 01", "WC-CNC-01", "Haas TL-1 CNC Turning Center", "60"],
      ["Welding Station 3", "WC-WLD-03", "MIG welding station, robotic", "120"],
    ],
    notes: [
      "name: Required. Work center display name.",
      "code: Optional. Short code for identification.",
      "description: Optional. Details about the work center.",
      "capacity_per_hour: Optional. Units that can be produced per hour.",
    ],
    importFn: async (row) => {
      // Work centers need a production_line_id — use first active line as default
      const linesRes = await adminApi.listProductionLines();
      const lines = linesRes.data?.lines ?? linesRes.data ?? [];
      const activeLine = lines.find((l: Record<string, unknown>) => l.is_active !== false);
      if (!activeLine) throw new Error("No active production line found. Create a line first.");

      await manufacturingApi.createWorkCenter({
        production_line_id: activeLine.id,
        name: row.name,
        description: row.description || null,
        capacity_units_per_hour: row.capacity_per_hour ? parseFloat(row.capacity_per_hour) : null,
      });
    },
  },
];

// ── Validation ─────────────────────────────────────────────────────────────

function validateRow(tmpl: TemplateConfig, row: Record<string, string>): string[] {
  const errors: string[] = [];

  switch (tmpl.type) {
    case "production_lines":
      if (!row.name) errors.push("name is required");
      if (row.target_oee && (isNaN(Number(row.target_oee)) || Number(row.target_oee) < 0 || Number(row.target_oee) > 100))
        errors.push("target_oee must be 0-100");
      if (row.target_cycle_time_seconds && isNaN(Number(row.target_cycle_time_seconds)))
        errors.push("target_cycle_time_seconds must be a number");
      break;

    case "shifts":
      if (!row.production_line_name) errors.push("production_line_name is required");
      if (!row.shift_name) errors.push("shift_name is required");
      if (!row.start_hour || isNaN(Number(row.start_hour)) || Number(row.start_hour) < 0 || Number(row.start_hour) > 23)
        errors.push("start_hour must be 0-23");
      if (!row.end_hour || isNaN(Number(row.end_hour)) || Number(row.end_hour) < 0 || Number(row.end_hour) > 23)
        errors.push("end_hour must be 0-23");
      break;

    case "products":
      if (!row.code) errors.push("code is required");
      if (!row.name) errors.push("name is required");
      break;

    case "bom":
      if (!row.product_code) errors.push("product_code is required");
      if (!row.component_name) errors.push("component_name is required");
      if (!row.quantity || isNaN(Number(row.quantity))) errors.push("quantity is required and must be a number");
      break;

    case "users":
      if (!row.email) errors.push("email is required");
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("email is not valid");
      if (!row.full_name) errors.push("full_name is required");
      if (row.role && !["admin", "plant_manager", "line_supervisor", "operator", "viewer"].includes(row.role))
        errors.push("role must be admin/plant_manager/line_supervisor/operator/viewer");
      break;

    case "work_centers":
      if (!row.name) errors.push("name is required");
      if (row.capacity_per_hour && isNaN(Number(row.capacity_per_hour)))
        errors.push("capacity_per_hour must be a number");
      break;
  }

  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DataImport() {
  const { t } = useI18n();
  // Upload state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validated, setValidated] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTemplate = TEMPLATES.find((t) => t.type === selectedTemplate) ?? null;

  // ── Template download ──
  const handleDownloadTemplate = useCallback((tmpl: TemplateConfig) => {
    const lines: string[] = [];
    // Header
    lines.push(tmpl.columns.join(","));
    // Example rows
    for (const ex of tmpl.examples) {
      lines.push(ex.map((v) => (v.includes(",") ? `"${v}"` : v)).join(","));
    }
    // Notes row
    lines.push("");
    lines.push("# NOTES (delete this section before importing):");
    for (const note of tmpl.notes) {
      lines.push(`# ${note}`);
    }
    downloadCSV(`leanpilot_template_${tmpl.type}.csv`, lines.join("\n"));
  }, []);

  // ── File handling ──
  const handleFile = useCallback(
    (file: File) => {
      if (!activeTemplate) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setParsedRows([]);
          return;
        }

        const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
        const dataRows: ParsedRow[] = [];

        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i];
          // Skip note/comment rows
          if (cells[0]?.startsWith("#") || cells[0]?.startsWith("NOTES")) continue;
          // Skip empty rows
          if (cells.every((c) => !c)) continue;

          const data: Record<string, string> = {};
          headers.forEach((h, idx) => {
            data[h] = cells[idx] ?? "";
          });
          dataRows.push({ data, status: "pending", errors: [] });
        }

        setParsedRows(dataRows);
        setValidated(false);
        setImportResult(null);
      };
      reader.readAsText(file);
    },
    [activeTemplate]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Validation ──
  const handleValidate = useCallback(() => {
    if (!activeTemplate) return;
    const updated = parsedRows.map((row) => {
      const errors = validateRow(activeTemplate, row.data);
      return { ...row, status: (errors.length === 0 ? "valid" : "error") as ValidationStatus, errors };
    });
    setParsedRows(updated);
    setValidated(true);
  }, [activeTemplate, parsedRows]);

  // ── Import ──
  const handleImport = useCallback(async () => {
    if (!activeTemplate) return;
    const validRows = parsedRows.filter((r) => r.status === "valid");
    if (validRows.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0, details: [] };

    for (let i = 0; i < validRows.length; i++) {
      try {
        await activeTemplate.importFn(validRows[i].data);
        result.imported++;
      } catch (err: unknown) {
        result.errors++;
        const apiErr = err as { response?: { data?: { detail?: string } }; message?: string };
        const msg = apiErr?.response?.data?.detail ?? apiErr?.message ?? "Unknown error";
        result.details.push(`Row ${i + 1}: ${msg}`);
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    result.skipped = parsedRows.length - validRows.length;
    setImportResult(result);
    setImporting(false);
  }, [activeTemplate, parsedRows]);

  // ── Export ──
  const handleExport = useCallback(async (tmpl: TemplateConfig) => {
    if (!tmpl.exportFn) return;
    setExportingType(tmpl.type);
    try {
      const data = await tmpl.exportFn();
      const csv = toCSV(tmpl.columns, data);
      downloadCSV(`leanpilot_export_${tmpl.type}.csv`, csv);
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExportingType(null);
  }, []);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setSelectedTemplate(null);
    setParsedRows([]);
    setValidated(false);
    setImportResult(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const allValid = validated && parsedRows.length > 0 && parsedRows.every((r) => r.status === "valid");
  const previewRows = parsedRows.slice(0, 5);
  const previewColumns = activeTemplate?.columns ?? [];

  return (
    <div className="space-y-8">
      {/* ─── Section: Download Templates ─── */}
      <div>
        <h3 className="text-lg font-bold text-th-text flex items-center gap-2">
          <Download className="w-5 h-5 text-brand-600" />
          {t("admin.downloadTemplates") || "Download Templates"}
        </h3>
        <p className="text-sm text-th-text-3 mt-1">
          {t("admin.downloadTemplatesDesc") || "Download CSV templates pre-filled with headers and sample data. Fill in your data, then upload below."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.type}
              className="rounded-xl border border-th-border bg-th-bg-2 p-5 flex flex-col gap-3 hover:border-brand-400 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600">
                  {tmpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-th-text">{tmpl.label}</h4>
                  <p className="text-xs text-th-text-3 mt-0.5">{tmpl.description}</p>
                  <p className="text-xs text-th-text-3 mt-1">
                    {tmpl.columns.length} columns: <span className="font-mono text-th-text-2">{tmpl.columns.join(", ")}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownloadTemplate(tmpl)}
                className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t("manufacturing.downloadTemplate") || "Download Template"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section: Upload & Import ─── */}
      <div>
        <h3 className="text-lg font-bold text-th-text flex items-center gap-2">
          <Upload className="w-5 h-5 text-brand-600" />
          {t("admin.uploadImport") || "Upload & Import"}
        </h3>
        <p className="text-sm text-th-text-3 mt-1">
          {t("admin.uploadImportDesc") || "Select a data type, upload your CSV, validate, and import."}
        </p>

        {/* Template selector */}
        <div className="flex flex-wrap gap-2 mt-4">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.type}
              onClick={() => {
                setSelectedTemplate(tmpl.type);
                setParsedRows([]);
                setValidated(false);
                setImportResult(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedTemplate === tmpl.type
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg hover:text-th-text"
              }`}
            >
              {tmpl.icon}
              {tmpl.label}
            </button>
          ))}
        </div>

        {/* Upload area */}
        {activeTemplate && (
          <div className="mt-4 space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/10"
                  : "border-th-border hover:border-brand-400 hover:bg-th-bg-2"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-th-text-3 mb-2" />
              <p className="text-sm text-th-text-2 font-medium">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-xs text-th-text-3 mt-1">Accepts .csv files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-th-text">
                    Preview ({parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} found)
                  </h4>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-th-text-3 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-th-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-th-bg-2">
                        {validated && <th className="px-3 py-2 text-left font-medium text-th-text-2 w-8" />}
                        <th className="px-3 py-2 text-left font-medium text-th-text-2 w-8">#</th>
                        {previewColumns.map((col) => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-th-text-2 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-th-border ${
                            i % 2 === 0 ? "bg-th-bg" : "bg-th-bg-2/50"
                          } ${row.status === "error" ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                        >
                          {validated && (
                            <td className="px-3 py-2">
                              {row.status === "valid" ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : row.status === "error" ? (
                                <span title={row.errors.join("; ")}>
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </span>
                              ) : null}
                            </td>
                          )}
                          <td className="px-3 py-2 text-th-text-3">{i + 1}</td>
                          {previewColumns.map((col) => (
                            <td key={col} className="px-3 py-2 text-th-text font-mono whitespace-nowrap max-w-[200px] truncate">
                              {row.data[col] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedRows.length > 5 && (
                  <p className="text-xs text-th-text-3 italic">
                    Showing first 5 of {parsedRows.length} rows.
                  </p>
                )}

                {/* Validation errors summary */}
                {validated && parsedRows.some((r) => r.status === "error") && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Validation Errors
                    </div>
                    <ul className="mt-2 space-y-1">
                      {parsedRows
                        .map((r, i) => (r.status === "error" ? { idx: i, errors: r.errors } : null))
                        .filter(Boolean)
                        .slice(0, 10)
                        .map((item) => (
                          <li key={item!.idx} className="text-xs text-red-600 dark:text-red-400">
                            Row {item!.idx + 1}: {item!.errors.join("; ")}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {!validated && (
                    <button
                      onClick={handleValidate}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Validate
                    </button>
                  )}

                  {validated && (
                    <button
                      onClick={handleImport}
                      disabled={!allValid || importing}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        allValid && !importing
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("manufacturing.importing") || "Importing..."}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Import {parsedRows.filter((r) => r.status === "valid").length} rows
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {importing && (
                  <div className="w-full bg-th-bg-2 rounded-full h-2.5">
                    <div
                      className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                    <p className="text-xs text-th-text-3 mt-1">{importProgress}% complete</p>
                  </div>
                )}

                {/* Results */}
                {importResult && (
                  <div className="rounded-lg border border-th-border bg-th-bg-2 p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-th-text">{t("admin.importResults") || "Import Results"}</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-4 h-4" /> {importResult.imported} imported
                      </span>
                      <span className="flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="w-4 h-4" /> {importResult.skipped} skipped
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="w-4 h-4" /> {importResult.errors} errors
                      </span>
                    </div>
                    {importResult.details.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {importResult.details.map((d, i) => (
                          <li key={i} className="text-xs text-red-600 dark:text-red-400">{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Section: Export Current Data ─── */}
      <div>
        <h3 className="text-lg font-bold text-th-text flex items-center gap-2">
          <FileDown className="w-5 h-5 text-brand-600" />
          Export Current Data
        </h3>
        <p className="text-sm text-th-text-3 mt-1">
          Download your current data as CSV files for backup or transfer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {TEMPLATES.filter((t) => t.exportFn).map((tmpl) => (
            <button
              key={tmpl.type}
              onClick={() => handleExport(tmpl)}
              disabled={exportingType === tmpl.type}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-th-border bg-th-bg-2 hover:border-brand-400 hover:bg-th-bg transition-all text-left"
            >
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                {exportingType === tmpl.type ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileDown className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-th-text">Export {tmpl.label}</p>
                <p className="text-xs text-th-text-3">CSV download</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
