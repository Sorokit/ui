import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 5000, 0 = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  success: (
    title: string,
    options?: Omit<Partial<Toast>, "id" | "title" | "type">,
  ) => string;
  error: (
    title: string,
    options?: Omit<Partial<Toast>, "id" | "title" | "type">,
  ) => string;
  warning: (
    title: string,
    options?: Omit<Partial<Toast>, "id" | "title" | "type">,
  ) => string;
  info: (
    title: string,
    options?: Omit<Partial<Toast>, "id" | "title" | "type">,
  ) => string;
  /** Dismiss every active toast and cancel their auto-dismiss timers. */
  dismissAll: () => void;
  /** @deprecated Alias of `dismissAll`, kept for backwards compatibility. */
  clearAll: () => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

let toastCounter = 0;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (input: Omit<Toast, "id">): string => {
      toastCounter += 1;
      const id = `toast_${toastCounter}_${Date.now()}`;
      const toast: Toast = { ...input, id };

      setToasts((prev) => [...prev, toast]);

      if (toast.duration !== 0) {
        const ms = toast.duration ?? DEFAULT_DURATION;
        const timer = setTimeout(() => removeToast(id), ms);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast],
  );

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const success = useCallback(
    (title: string, options?: Omit<Partial<Toast>, "id" | "title" | "type">) =>
      addToast({ type: "success", title, ...options }),
    [addToast],
  );

  const error = useCallback(
    (title: string, options?: Omit<Partial<Toast>, "id" | "title" | "type">) =>
      addToast({ type: "error", title, ...options }),
    [addToast],
  );

  const warning = useCallback(
    (title: string, options?: Omit<Partial<Toast>, "id" | "title" | "type">) =>
      addToast({ type: "warning", title, ...options }),
    [addToast],
  );

  const info = useCallback(
    (title: string, options?: Omit<Partial<Toast>, "id" | "title" | "type">) =>
      addToast({ type: "info", title, ...options }),
    [addToast],
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
        dismissAll,
        clearAll: dismissAll,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
