"use client";
import { useState } from "react";
import { useI18n } from "@/stores/useI18n";

interface Props {
  onPrint: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  className?: string;
}

export default function ExportToolbar({ onPrint, onExportExcel, onExportCSV, className = "" }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={`export-toolbar no-print relative flex items-center gap-1 ${className}`}>
      {/* Print button */}
      <button
        onClick={onPrint}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-th-bg-2 border border-th-border text-th-text-2 hover:text-th-text hover:bg-th-bg-3 transition"
        title={t("common.print") || "Print"}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
        </svg>
        {t("common.print") || "Print"}
      </button>

      {/* Export dropdown */}
      {(onExportExcel || onExportCSV) && (
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-th-bg-2 border border-th-border text-th-text-2 hover:text-th-text hover:bg-th-bg-3 transition"
            title={t("common.export") || "Export"}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t("common.export") || "Export"}
            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-th-bg-2 border border-th-border rounded-lg shadow-lg py-1 min-w-[140px]">
                {onExportExcel && (
                  <button
                    onClick={() => { onExportExcel(); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-th-bg-3 text-th-text flex items-center gap-2 transition"
                  >
                    <span className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">XL</span>
                    Excel (.xlsx)
                  </button>
                )}
                {onExportCSV && (
                  <button
                    onClick={() => { onExportCSV(); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-th-bg-3 text-th-text flex items-center gap-2 transition"
                  >
                    <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">CSV</span>
                    CSV (.csv)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
