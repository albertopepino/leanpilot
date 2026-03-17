"use client";
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { adminApi } from "@/lib/api";

const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  onUploadSuccess: () => void;
}

export default function LogoUpload({ onUploadSuccess }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPreview(null);

      if (!ALLOWED.includes(file.type)) {
        setError(t("settings.logoErrorType"));
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(t("settings.logoErrorSize"));
        return;
      }

      // Show local preview
      setPreview(URL.createObjectURL(file));
      setUploading(true);

      try {
        await adminApi.uploadLogo(file);
        onUploadSuccess();
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploadSuccess, t]
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
    },
    [handleFile]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        aria-label="Upload company logo"
        aria-busy={uploading}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
            : "border-th-border hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-white/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={onFileChange}
        />

        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="mx-auto h-16 max-w-[200px] object-contain rounded-lg"
          />
        ) : (
          <div className="space-y-2">
            <div className="text-3xl opacity-40">
              {uploading ? "\u23F3" : "\u{1F3AD}"}
            </div>
            <p className="text-sm font-medium text-th-text-2">
              {uploading ? t("settings.logoUploading") : t("settings.uploadLogo")}
            </p>
            <p className="text-xs text-th-text-3">
              PNG, JPG, SVG &middot; max 2 MB
            </p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
