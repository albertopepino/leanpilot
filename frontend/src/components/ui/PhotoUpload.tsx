"use client";
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { getErrorMessage } from "@/lib/formatters";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface PhotoUploadProps {
  /** Current photo URL (for display) — if set, shows as preview */
  currentUrl?: string | null;
  /** Called with the selected File when user picks/drops a photo */
  onUpload: (file: File) => Promise<void>;
  /** Called when user clicks remove (only shown if currentUrl is set) */
  onRemove?: () => void;
  /** Called when user clicks delete (alias for onRemove for new API) */
  onDelete?: () => Promise<void>;
  /** Max file size in MB (default 10) */
  maxSizeMB?: number;
  /** @deprecated Use maxSizeMB instead. Max file size in bytes */
  maxSize?: number;
  /** File accept string override */
  accept?: string;
  /** Show camera capture button (default true) */
  allowCamera?: boolean;
  /** Allow document types pdf/docx in addition to images (default false) */
  allowDocuments?: boolean;
  /** Label text shown in the drop zone */
  label?: string;
  /** Compact mode for inline use in forms */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Called when displayed image fails to load (e.g. expired presigned URL) */
  onUrlExpired?: () => void;
}

export default function PhotoUpload({
  currentUrl,
  onUpload,
  onRemove,
  onDelete,
  maxSizeMB,
  maxSize,
  accept,
  allowCamera = true,
  allowDocuments = false,
  label,
  compact = false,
  disabled = false,
  onUrlExpired,
}: PhotoUploadProps) {
  const { t } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Backward compat: maxSize (bytes) takes precedence if maxSizeMB not set
  const maxBytes = maxSizeMB
    ? maxSizeMB * 1024 * 1024
    : maxSize ?? 10 * 1024 * 1024;
  const maxMB = Math.round(maxBytes / (1024 * 1024));

  const displayUrl = localPreview || currentUrl;

  // Build allowed types list
  const allowedTypes = [...IMAGE_TYPES, ...(allowDocuments ? DOC_TYPES : [])];

  // Build accept string for file inputs
  const fileAccept =
    accept ||
    (allowDocuments
      ? "image/*,application/pdf,.doc,.docx"
      : "image/*");

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check type
      if (accept) {
        // When custom accept is set, trust the browser's filtering
      } else if (!allowedTypes.some((t) => file.type.startsWith(t.replace("/*", "/")) || file.type === t)) {
        // Fallback: also accept by extension for edge cases
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const validExts = ["png", "jpg", "jpeg", "gif", "webp", ...(allowDocuments ? ["pdf", "doc", "docx"] : [])];
        if (!validExts.includes(ext)) {
          return t("common.invalidFileType") || "Invalid file type.";
        }
      }
      // Check size
      if (file.size > maxBytes) {
        return (t("common.fileTooLarge") || "File too large. Maximum {max} MB.").replace(
          "{max}",
          String(maxMB)
        );
      }
      return null;
    },
    [accept, allowedTypes, allowDocuments, maxBytes, maxMB, t]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Show local preview for images
      if (file.type.startsWith("image/")) {
        setLocalPreview(URL.createObjectURL(file));
      }
      setImgError(false);
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
    [onUpload, validateFile]
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
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalPreview(null);
      setError(null);
      setImgError(false);
      if (onDelete) {
        await onDelete();
      } else {
        onRemove?.();
      }
    },
    [onRemove, onDelete]
  );

  const handleImgError = useCallback(() => {
    setImgError(true);
    onUrlExpired?.();
  }, [onUrlExpired]);

  const sizeClasses = compact ? "p-3 rounded-lg" : "p-4 rounded-xl";
  const hasPhoto = displayUrl && !imgError;
  const canRemove = !!(onRemove || onDelete);

  // ─── Photo exists: show preview with overlay actions ───
  if (hasPhoto) {
    const imgClasses = compact ? "h-16 max-w-[120px]" : "h-24 max-w-[200px]";
    return (
      <div>
        <div
          className={`relative border-2 border-dashed text-center ${sizeClasses} border-th-border`}
        >
          <div className="relative inline-block">
            <img
              src={displayUrl!}
              alt="Photo"
              className={`mx-auto object-contain rounded-lg ${imgClasses}`}
              onError={handleImgError}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60 dark:bg-black/40">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Overlay action buttons */}
          {!uploading && !disabled && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-xs px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
              >
                {t("common.replacePhoto") || "Replace"}
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  {t("common.deletePhoto") || "Delete"}
                </button>
              )}
            </div>
          )}

          {/* Hidden inputs for replace */}
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            className="hidden"
            onChange={onFileChange}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // ─── Image URL expired: show placeholder ───
  if (displayUrl && imgError) {
    return (
      <div>
        <div
          className={`relative border-2 border-dashed text-center ${sizeClasses} border-th-border`}
        >
          <div className={`flex flex-col items-center justify-center ${compact ? "space-y-1" : "space-y-2"}`}>
            <div className={compact ? "text-xl opacity-40" : "text-3xl opacity-40"}>
              &#x1F5BC;
            </div>
            <p className="text-sm text-th-text-3">
              {t("common.photoUnavailable") || "Photo unavailable"}
            </p>
          </div>
          {!disabled && (
            <div className="mt-2 flex items-center justify-center gap-2">
              {allowCamera && (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-xs px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                >
                  {t("common.takePhoto") || "Take Photo"}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
              >
                {t("common.chooseFile") || "Choose File"}
              </button>
            </div>
          )}
          {allowCamera && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            className="hidden"
            onChange={onFileChange}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // ─── No photo: show two side-by-side buttons + drag zone ───
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed text-center transition-all ${sizeClasses} ${
          disabled
            ? "opacity-50 cursor-not-allowed border-th-border"
            : dragOver
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
              : "border-th-border hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5"
        }`}
      >
        {uploading ? (
          <div className={compact ? "space-y-1" : "space-y-2"}>
            <div className="flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-medium text-th-text-2">
              {t("common.uploading") || "Uploading..."}
            </p>
          </div>
        ) : (
          <div className={compact ? "space-y-2" : "space-y-3"}>
            {/* Two side-by-side buttons */}
            <div className="flex items-stretch justify-center gap-3">
              {allowCamera && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => cameraInputRef.current?.click()}
                  className={`flex-1 max-w-[160px] flex flex-col items-center justify-center gap-1 rounded-lg border border-th-border
                    hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer
                    ${compact ? "p-2" : "p-3"} ${disabled ? "pointer-events-none" : ""}`}
                >
                  <span className={compact ? "text-lg" : "text-2xl"}>&#x1F4F7;</span>
                  <span className="text-xs font-medium text-th-text-2">
                    {t("common.takePhoto") || "Take Photo"}
                  </span>
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 max-w-[160px] flex flex-col items-center justify-center gap-1 rounded-lg border border-th-border
                  hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer
                  ${compact ? "p-2" : "p-3"} ${disabled ? "pointer-events-none" : ""}`}
              >
                <span className={compact ? "text-lg" : "text-2xl"}>&#x1F4C1;</span>
                <span className="text-xs font-medium text-th-text-2">
                  {t("common.chooseFile") || "Choose File"}
                </span>
              </button>
            </div>

            {/* Label / hint */}
            {label && (
              <p className="text-sm font-medium text-th-text-2">{label}</p>
            )}
            {!compact && (
              <p className="text-xs text-th-text-3">
                {allowDocuments ? "PNG, JPG, PDF, DOCX" : "PNG, JPG"} &middot; max {maxMB} MB
              </p>
            )}
          </div>
        )}

        {/* Hidden file inputs */}
        {allowCamera && (
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={fileAccept}
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
