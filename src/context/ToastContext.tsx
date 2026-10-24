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
  unreadCount: number;
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  markAllRead: () => void;
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
  /**
   * Pause a toast's auto-dismiss countdown (e.g. while the pointer hovers it
   * or it holds keyboard focus). Pauses are reference-counted so overlapping
   * hover/focus sources don't resume the timer early.
   */
  pauseToast: (id: string) => void;
  /** Resume a paused toast's countdown from where it left off. */
  resumeToast: (id: string) => void;
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

/**
 * Per-toast countdown state. `remaining` is only meaningful while a toast is
 * paused: it holds the milliseconds left when the countdown was frozen.
 * `pauseCount` is reference-counted because a toast can be paused by more
 * than one source at once (pointer hover *and* keyboard focus), and it must
 * only resume once every source has released it.
 */
interface ToastTimer {
  timeout: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
  pauseCount: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const timersRef = useRef<Map<string, ToastTimer>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    setUnreadIds((prev) => prev.filter((unreadId) => unreadId !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      if (timer.timeout !== null) clearTimeout(timer.timeout);
      timersRef.current.delete(id);
    }
  }, []);

  const pauseToast = useCallback((id: string) => {
    const entry = timersRef.current.get(id);
    if (!entry) return;
    entry.pauseCount += 1;
    if (entry.pauseCount > 1 || entry.timeout === null) return;
    // Freeze the countdown: remember what's left, then cancel the timer.
    clearTimeout(entry.timeout);
    entry.timeout = null;
    const elapsed = Date.now() - entry.startedAt;
    entry.remaining = Math.max(0, entry.remaining - elapsed);
  }, []);

  const resumeToast = useCallback(
    (id: string) => {
      const entry = timersRef.current.get(id);
      if (!entry || entry.pauseCount === 0) return;
      entry.pauseCount -= 1;
      if (entry.pauseCount > 0) return;
      if (entry.remaining <= 0) {
        removeToast(id);
        return;
      }
      entry.startedAt = Date.now();
      entry.timeout = setTimeout(() => removeToast(id), entry.remaining);
    },
    [removeToast],
  );

  const addToast = useCallback(
    (input: Omit<Toast, "id">): string => {
      toastCounter += 1;
      const id = `toast_${toastCounter}_${Date.now()}`;
      const toast: Toast = { ...input, id };

      setToasts((prev) => [...prev, toast]);
      setUnreadIds((prev) => [...prev, id]);

      if (toast.duration !== 0) {
        const ms = toast.duration ?? DEFAULT_DURATION;
        const timeout = setTimeout(() => removeToast(id), ms);
        timersRef.current.set(id, {
          timeout,
          remaining: ms,
          startedAt: Date.now(),
          pauseCount: 0,
        });
      }

      return id;
    },
    [removeToast],
  );

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => {
      if (timer.timeout !== null) clearTimeout(timer.timeout);
    });
    timersRef.current.clear();
    setToasts([]);
    setUnreadIds([]);
  }, []);

  const markAllRead = useCallback(() => setUnreadIds([]), []);

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
      timers.forEach((timer) => {
        if (timer.timeout !== null) clearTimeout(timer.timeout);
      });
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        unreadCount: unreadIds.length,
        addToast,
        removeToast,
        markAllRead,
        success,
        error,
        warning,
        info,
        dismissAll,
        clearAll: dismissAll,
        pauseToast,
        resumeToast,
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

export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}
