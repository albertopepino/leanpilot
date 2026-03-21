"use client";
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { getErrorMessage } from "@/lib/formatters";

const DEFAULT_ACCEPT =
  ".pdf,.docx,.xlsx,.doc,.xls,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
const DEFAULT_MAX_MB = 25;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadProps {
  /** Called with the selected File when user picks/drops a document */
  onUpload: (file: File) => Promise<void>;
  /** Max file size in MB (default 25) */
  maxSizeMB?: number;
  /** File accept string override */
  accept?: string;
  /** Label text above the drop zone */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Show current file name if a document already exists */
  currentFileName?: string;
}

export default function DocumentUpload({
  onUpload,
  maxSizeMB = DEFAULT_MAX_MB,
  accept = DEFAULT_ACCEPT,
  label,
  disabled = false,
  currentFileName,
}: DocumentUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedSize, setUploadedSize] = useState<number | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;
  const displayFileName = uploadedName || currentFileName;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate size
      if (file.size > maxBytes) {
        setError(
          (t("common.fileTooLarge") || "File too large. Maximum {max} MB.").replace(
            "{max}",
            String(maxSizeMB)
          )
        );
        return;
      }

      setUploadedName(file.name);
      setUploadedSize(file.size);
      setUploading(true);
      try {
        await onUpload(file);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Upload failed"));
        setUploadedName(null);
        setUploadedSize(null);
      } finally {
        setUploading(false);
      }
    },
    [onUpload, maxBytes, maxSizeMB, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setUploadedName(null);
      setUploadedSize(null);
      setError(null);
    },
    []
  );

  // Derive display extension list from accept
  const extList = accept
    .split(",")
    .filter((s) => s.startsWith("."))
    .map((s) => s.replace(".", "").toUpperCase())
    .join(", ");

  return (
    <div>
      {label && (
        <p className="mb-1 text-sm font-medium text-th-text-1">{label}</p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        role="button"
        aria-label={label || "Upload document"}
        aria-busy={uploading}
        className={`relative cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed border-th-border"
            : dragOver
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
              : "border-th-border hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileChange}
        />

        {uploading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-medium text-th-text-2">
              {t("common.uploadingFile") || "Uploading..."}
            </p>
            {uploadedName && (
              <p className="text-xs text-th-text-3">{uploadedName}</p>
            )}
          </div>
        ) : displayFileName ? (
          <div className="space-y-2">
            <div className="text-3xl opacity-60">&#x2705;</div>
            <p className="text-sm font-medium text-th-text-1 break-all">
              {displayFileName}
            </p>
            {uploadedSize != null && (
              <p className="text-xs text-th-text-3">{formatFileSize(uploadedSize)}</p>
            )}
            <p className="text-xs text-green-600 dark:text-green-400">
              {t("common.fileUploaded") || "File uploaded"}
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="mt-1 text-xs px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              {t("common.remove") || "Remove"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl opacity-40">&#x1F4C4;</div>
            <p className="text-sm font-medium text-th-text-2">
              {t("common.dragDropFile") || "Drag & drop file here"}
            </p>
            <p className="text-xs text-th-text-3">
              {t("common.orClickBrowse") || "or click to browse"}
            </p>
            <p className="text-xs text-th-text-3">
              {extList || "PDF, DOCX, XLSX"} (max {maxSizeMB} MB)
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
