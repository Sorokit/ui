import * as ToastPrimitive from "@radix-ui/react-toast";
import { useEffect, useRef } from "react";

import type { Toast as ToastType } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 9v4m0 4h.01M10.29 3.86l-8.1 14c-.6 1.04.15 2.14 1.21 2.14h16.2c1.06 0 1.81-1.1 1.21-2.14l-8.1-14c-.6-1.04-1.82-1.04-2.42 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4m0-4h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconMap = {
  success: { icon: CheckIcon, bg: "bg-success-dim", fg: "text-green" },
  error: { icon: XIcon, bg: "bg-error-dim", fg: "text-red" },
  warning: { icon: AlertIcon, bg: "bg-orange-500/15", fg: "text-orange" },
  info: { icon: InfoIcon, bg: "bg-blue-500/15", fg: "text-blue-500" },
} as const;

interface ToastItemProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

/**
 * Move focus to the neighbouring toast before `current` is removed, so a
 * keyboard user can keep pressing Escape to work through the stack instead
 * of having focus fall back to <body>.
 */
function focusAdjacentToast(current: HTMLElement) {
  const next =
    (current.nextElementSibling as HTMLElement | null) ??
    (current.previousElementSibling as HTMLElement | null);
  if (next?.hasAttribute("data-toast-id")) next.focus();
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { icon: Icon, bg, fg } = iconMap[toast.type];

  return (
    <ToastPrimitive.Root
      type={toast.duration === 0 ? "foreground" : "background"}
      // Radix runs its own close timer (5s by default) regardless of ours, so
      // a sticky `duration: 0` toast must be told explicitly never to expire.
      duration={toast.duration === 0 ? Infinity : toast.duration}
      onOpenChange={(open) => { if (!open) onDismiss(toast.id); }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        // Escape from anywhere inside this toast (the toast itself, its
        // action or its close button) dismisses this toast — not whichever
        // toast happens to be the top-most layer. preventDefault stops Radix
        // from running its own close handler on top of ours.
        e.preventDefault();
        e.stopPropagation();
        focusAdjacentToast(e.currentTarget);
        onDismiss(toast.id);
      }}
      data-toast-id={toast.id}
      // Radix's Root defaults to role="status"/aria-live="off" and announces
      // through its own offscreen region. Notifications here are transient and
      // action-bearing, so expose the toast itself as an assertive live region.
      role="alert"
      aria-live="assertive"
      className={cn(
        // shrink-0 keeps a full stack from squashing (and clipping) each
        // toast when the viewport hits its max height — it scrolls instead.
        "relative flex shrink-0 items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        "animate-toast-in",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", bg)}>
        <Icon className={cn("h-4 w-4", fg)} />
      </div>
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-[13px] font-semibold text-ink break-words">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.message && (
          <ToastPrimitive.Description className="mt-0.5 text-[12px] text-ink-3 leading-relaxed break-words">
            {toast.message}
          </ToastPrimitive.Description>
        )}
        {toast.action && (
          <ToastPrimitive.Action
            altText={toast.action.label}
            onClick={toast.action.onClick}
            className="mt-2 text-[11px] font-semibold text-ink hover:text-ink-2 underline-offset-2 underline transition-colors"
          >
            {toast.action.label}
          </ToastPrimitive.Action>
        )}
      </div>
      <ToastPrimitive.Close
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
        aria-label={`Dismiss ${toast.type} notification`}
      >
        <XIcon className="h-3.5 w-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const viewportRef = useRef<HTMLOListElement>(null);

  // When the stack overflows, keep the newest toast (last, nearest the
  // corner) in view rather than leaving it scrolled off the bottom.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
      {/*
        Toasts are laid out in normal flow in a single column with a fixed gap,
        so each one reserves its own height and they can never overlap. The
        viewport is capped to the screen height and scrolls when a burst of
        notifications would otherwise run off-screen and be clipped. Newest
        toasts sit closest to the corner.
      */}
      <ToastPrimitive.Viewport
        ref={viewportRef}
        data-testid="toast-viewport"
        className={cn(
          "fixed bottom-4 right-4 z-[9999] m-0 flex list-none flex-col gap-2 p-0 outline-none",
          "w-[calc(100vw-2rem)] max-w-[420px] max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain",
        )}
      />
    </ToastPrimitive.Provider>
  );
}
