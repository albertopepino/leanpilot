'use client';
import { useState, useCallback } from 'react';

type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
};

type ValidationRules<T> = Partial<Record<keyof T, ValidationRule>>;
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export function useFormValidation<T extends Record<string, unknown>>(rules: ValidationRules<T>) {
  const [errors, setErrors] = useState<ValidationErrors<T>>({});

  const validate = useCallback((data: T): boolean => {
    const newErrors: ValidationErrors<T> = {};
    let isValid = true;

    for (const [field, rule] of Object.entries(rules) as [keyof T, ValidationRule][]) {
      const value = data[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        newErrors[field] = 'This field is required';
        isValid = false;
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        newErrors[field] = `Minimum ${rule.minLength} characters`;
        isValid = false;
      }

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        newErrors[field] = `Maximum ${rule.maxLength} characters`;
        isValid = false;
      }

      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        newErrors[field] = `Minimum value is ${rule.min}`;
        isValid = false;
      }

      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        newErrors[field] = `Maximum value is ${rule.max}`;
        isValid = false;
      }

      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        newErrors[field] = 'Invalid format';
        isValid = false;
      }

      if (rule.custom) {
        const error = rule.custom(value);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [rules]);

  const clearErrors = useCallback(() => setErrors({}), []);
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validate, clearErrors, clearFieldError };
}
