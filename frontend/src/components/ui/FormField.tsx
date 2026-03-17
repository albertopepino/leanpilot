"use client";
import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
}

export default function FormField({ label, htmlFor, required, error, helpText, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-th-text-2 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-xs text-th-text-3" id={`${htmlFor}-help`}>
          {helpText}
        </p>
      )}
    </div>
  );
}
