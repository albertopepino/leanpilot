"use client";
import { useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyBranding } from "@/stores/useCompanyBranding";

/* ------------------------------------------------------------------ */
/*  XLSX helper — dynamic import so bundle stays small until needed    */
/* ------------------------------------------------------------------ */

async function loadXLSX() {
  const XLSX = await import("xlsx");
  return XLSX;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  /** Optional formatter — receives raw cell value, returns display string */
  format?: (v: any) => string;
}

export interface PrintOptions {
  /** Title shown in the print header */
  title: string;
  /** CSS selector for the element to print. Defaults to "[data-print-area]" */
  selector?: string;
  /** Additional metadata lines under the title */
  subtitle?: string;
  /** Page orientation: "landscape" (default) or "portrait" */
  orientation?: "landscape" | "portrait";
}

export interface ExcelOptions {
  /** File name without extension (alias: title) */
  filename?: string;
  /** Alias for filename — used by simple callers */
  title?: string;
  /** Sheet name */
  sheetName?: string;
  /** Column definitions — accepts ExportColumn[] or simple string[] headers */
  columns: ExportColumn[] | string[];
  /** Data rows — accepts Record<string, any>[] or simple string[][] */
  rows: Record<string, any>[] | string[][];
  /** Optional extra header rows (e.g. summary info) prepended above the table */
  headerRows?: string[][];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useExport() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { logoUrl } = useCompanyBranding();

  /* ---------- Print ---------- */
  const printView = useCallback(
    (optsOrTitle: PrintOptions | string) => {
      const opts: PrintOptions = typeof optsOrTitle === "string" ? { title: optsOrTitle } : optsOrTitle;
      const now = new Date();
      const dateStr = now.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Build header HTML
      const headerHtml = `
        <div class="print-header">
          <div>
            ${logoUrl
              ? `<img src="${logoUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;" />`
              : `<div class="print-header-logo">LeanPilot</div>`
            }
            <div style="font-size:14pt;font-weight:600;margin-top:4px;">${opts.title}</div>
            ${opts.subtitle ? `<div style="font-size:9pt;color:#6b7280;margin-top:2px;">${opts.subtitle}</div>` : ""}
          </div>
          <div class="print-header-meta">
            <div><strong>${t("common.date") || "Date"}:</strong> ${dateStr}</div>
            <div><strong>${t("common.operator") || "Operator"}:</strong> ${user?.full_name || user?.email || "—"}</div>
            ${user?.factory_id ? `<div><strong>${t("common.factory") || "Factory"}:</strong> #${user.factory_id}</div>` : ""}
          </div>
        </div>
      `;

      const footerHtml = `
        <div class="print-footer">
          LeanPilot — ${opts.title} — ${dateStr} — ${t("common.page") || "Page"} <span class="pageNumber"></span>
        </div>
      `;

      // Inject header before print area
      const area = document.querySelector(opts.selector || "[data-print-area]");
      if (!area) {
        console.warn("useExport: print area not found");
        window.print();
        return;
      }

      // Set orientation via dynamic style
      const orientStyle = document.createElement("style");
      orientStyle.id = "print-orient";
      orientStyle.textContent = `@page { size: A4 ${opts.orientation || "landscape"}; }`;
      document.head.appendChild(orientStyle);

      // Insert header & footer
      const header = document.createElement("div");
      header.innerHTML = headerHtml;
      header.className = "print-header-wrapper";
      header.style.display = "none";
      area.parentElement?.insertBefore(header, area);

      const footer = document.createElement("div");
      footer.innerHTML = footerHtml;
      footer.className = "print-footer-wrapper";
      footer.style.display = "none";
      area.parentElement?.appendChild(footer);

      // Print
      window.print();

      // Cleanup
      header.remove();
      footer.remove();
      orientStyle.remove();
    },
    [t, locale, user, logoUrl]
  );

  /* ---------- Export to Excel ---------- */
  const exportToExcel = useCallback(
    async (opts: ExcelOptions) => {
      const XLSX = await loadXLSX();

      const fname = opts.filename || opts.title || "export";

      const now = new Date();
      const dateStr = now.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Normalize columns: accept string[] or ExportColumn[]
      const isSimpleCols = opts.columns.length > 0 && typeof opts.columns[0] === "string";
      const normalizedCols: ExportColumn[] = isSimpleCols
        ? (opts.columns as string[]).map((h, i) => ({ key: `col${i}`, header: h }))
        : (opts.columns as ExportColumn[]);

      // Normalize rows: accept string[][] or Record<string, any>[]
      const isSimpleRows = opts.rows.length > 0 && Array.isArray(opts.rows[0]);
      const normalizedRows: Record<string, any>[] = isSimpleRows
        ? (opts.rows as string[][]).map((row) => {
            const obj: Record<string, any> = {};
            normalizedCols.forEach((col, i) => { obj[col.key] = row[i] ?? ""; });
            return obj;
          })
        : (opts.rows as Record<string, any>[]);

      // Build worksheet data
      const wsData: any[][] = [];

      // Metadata header rows
      wsData.push(["LeanPilot — " + fname]);
      wsData.push([`${t("common.date") || "Date"}: ${dateStr}`, "", `${t("common.operator") || "Operator"}: ${user?.full_name || user?.email || "—"}`]);
      wsData.push([]); // blank row

      // Extra header rows (summary info)
      if (opts.headerRows) {
        for (const row of opts.headerRows) {
          wsData.push(row);
        }
        wsData.push([]);
      }

      // Column headers
      wsData.push(normalizedCols.map((c) => c.header));

      // Data rows
      for (const row of normalizedRows) {
        wsData.push(
          normalizedCols.map((col) => {
            const val = row[col.key];
            return col.format ? col.format(val) : (val ?? "");
          })
        );
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws["!cols"] = normalizedCols.map((c) => ({ wch: c.width || 18 }));

      XLSX.utils.book_append_sheet(wb, ws, opts.sheetName || "Data");
      XLSX.writeFile(wb, `${fname}.xlsx`);
    },
    [t, locale, user]
  );

  /* ---------- Export to CSV (lightweight fallback) ---------- */
  const exportToCSV = useCallback(
    (opts: Omit<ExcelOptions, "headerRows" | "sheetName">) => {
      const fname = opts.filename || opts.title || "export";

      // Normalize columns
      const isSimpleCols = opts.columns.length > 0 && typeof opts.columns[0] === "string";
      const normalizedCols: ExportColumn[] = isSimpleCols
        ? (opts.columns as string[]).map((h, i) => ({ key: `col${i}`, header: h }))
        : (opts.columns as ExportColumn[]);

      // Normalize rows
      const isSimpleRows = opts.rows.length > 0 && Array.isArray(opts.rows[0]);
      const normalizedRows: Record<string, any>[] = isSimpleRows
        ? (opts.rows as string[][]).map((row) => {
            const obj: Record<string, any> = {};
            normalizedCols.forEach((col, i) => { obj[col.key] = row[i] ?? ""; });
            return obj;
          })
        : (opts.rows as Record<string, any>[]);

      const headers = normalizedCols.map((c) => `"${c.header}"`).join(",");
      const rows = normalizedRows.map((row) =>
        normalizedCols
          .map((col) => {
            const val = col.format ? col.format(row[col.key]) : (row[col.key] ?? "");
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fname}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return { printView, exportToExcel, exportToCSV };
}
