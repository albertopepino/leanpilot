import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

let toastCounter = 0;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 5000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const toast: Toast = { id, type, message, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  success: (message) => {
    const { addToast } = useToast.getState();
    addToast("success", message);
  },

  error: (message) => {
    const { addToast } = useToast.getState();
    addToast("error", message);
  },

  warning: (message) => {
    const { addToast } = useToast.getState();
    addToast("warning", message);
  },

  info: (message) => {
    const { addToast } = useToast.getState();
    addToast("info", message);
  },
}));
