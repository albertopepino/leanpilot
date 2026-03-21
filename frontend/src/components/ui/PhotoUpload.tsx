"use client";
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { getErrorMessage } from "@/lib/formatters";

const ALLOWED = ["image/png", "image/jpeg"];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface PhotoUploadProps {
  /** Current photo URL (for display) — if set, shows as preview */
  currentUrl?: string | null;
  /** Called with the selected File when user picks/drops a photo */
  onUpload: (file: File) => Promise<void>;
  /** Called when user clicks remove (only shown if currentUrl is set) */
  onRemove?: () => void;
  /** Max file size in bytes (default 10 MB) */
  maxSize?: number;
  /** Label text shown in the drop zone */
  label?: string;
  /** Compact mode for inline use in forms */
  compact?: boolean;
}

export default function PhotoUpload({
  currentUrl,
  onUpload,
  onRemove,
  maxSize = DEFAULT_MAX_BYTES,
  label,
  compact = false,
}: PhotoUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayUrl = localPreview || currentUrl;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED.includes(file.type)) {
        setError(t("common.photoErrorType") || "Only PNG and JPEG files are allowed.");
        return;
      }
      if (file.size > maxSize) {
        const mb = Math.round(maxSize / (1024 * 1024));
        setError(t("common.photoErrorSize") || `File too large. Maximum ${mb} MB.`);
        return;
      }

      setLocalPreview(URL.createObjectURL(file));
      setUploading(true);
      try {
        await onUpload(file);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Upload failed"));
        setLocalPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [onUpload, maxSize, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalPreview(null);
      setError(null);
      onRemove?.();
    },
    [onRemove]
  );

  const sizeClasses = compact
    ? "p-3 rounded-lg"
    : "p-4 rounded-xl";

  const imgClasses = compact
    ? "h-16 max-w-[120px]"
    : "h-24 max-w-[200px]";

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        aria-label={label || "Upload photo"}
        aria-busy={uploading}
        className={`relative cursor-pointer border-2 border-dashed text-center transition-all ${sizeClasses} ${
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
            : "border-th-border hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={onFileChange}
        />

        {displayUrl ? (
          <div className="relative inline-block">
            <img
              src={displayUrl}
              alt="Photo"
              className={`mx-auto object-contain rounded-lg ${imgClasses}`}
            />
            {onRemove && !uploading && (
              <button
                onClick={handleRemove}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                aria-label="Remove photo"
              >
                x
              </button>
            )}
          </div>
        ) : (
          <div className={compact ? "space-y-1" : "space-y-2"}>
            <div className={compact ? "text-xl opacity-40" : "text-3xl opacity-40"}>
              {uploading ? "\u23F3" : "\uD83D\uDCF7"}
            </div>
            <p className="text-sm font-medium text-th-text-2">
              {uploading
                ? (t("common.uploading") || "Uploading...")
                : (label || t("common.uploadPhoto") || "Upload photo")}
            </p>
            {!compact && (
              <p className="text-xs text-th-text-3">
                PNG, JPG &middot; max {Math.round(maxSize / (1024 * 1024))} MB
              </p>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
