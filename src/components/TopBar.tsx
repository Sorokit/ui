import { Cancel01Icon,Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import type { NavSection } from "@/components/Sidebar";
import { Tooltip } from "@/components/ui/Tooltip";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useOptionalToast } from "@/context/ToastContext";
import { useSorokit } from "@/context/useSorokit";
import { SCREEN_LABELS } from "@/lib/nav-labels";

const LABELS = SCREEN_LABELS;

export function TopBar({
  active,
  onMenuToggle,
  sidebarOpen,
}: {
  active: NavSection;
  onMenuToggle: () => void;
  sidebarOpen?: boolean;
}) {
  const { error, clearError } = useSorokit();
  const toastContext = useOptionalToast();
  const toasts = toastContext?.toasts ?? [];
  const unreadCount = toastContext?.unreadCount ?? 0;
  const { title, sub } = LABELS[active];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const storedTheme = localStorage.getItem("sorokit-theme");
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sorokit-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const openNotifications = () => {
    toastContext?.markAllRead();
    setNotificationsOpen(true);
  };

  // Move focus to the heading when the active section changes so screen
  // readers announce the new context. Focus is used instead of an aria-live
  // region to avoid announcing the change twice. Skipped on first render so
  // mounting the dashboard doesn't steal focus.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <div className="shrink-0">
      {error && (
        <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-error-dim-muted border-b border-error-dim shrink-0">
          <p
            role="alert"
            className="text-[12px] text-red break-words min-w-0 flex-1"
          >
            {error}
          </p>
          <button
            onClick={clearError}
            aria-label="Dismiss error"
            className="text-red opacity-50 hover:opacity-100 shrink-0 transition-opacity"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={12}
              color="currentColor"
              strokeWidth={2}
            />
          </button>
        </div>
      )}
      <header className="flex items-center justify-between px-4 sm:px-6 h-auto min-h-[60px] border-b border-line bg-surface shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface-2 transition-colors text-ink-2"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            title={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
          >
            <HugeiconsIcon
              icon={Menu01Icon}
              size={18}
              color="currentColor"
              strokeWidth={1.5}
            />
          </button>
          <div className="min-w-0">
            <Tooltip content={title}>
              <div
                tabIndex={0}
                title={title}
                className="max-w-[55vw] truncate outline-none focus-visible:ring-1 focus-visible:ring-brand sm:max-w-[420px]"
              >
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="truncate text-[15px] font-semibold text-ink leading-none"
                >
                  {title}
                </h1>
              </div>
            </Tooltip>
            <p className="text-[11px] text-ink-3 mt-0.5 hidden sm:block">
              {sub}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <NetworkSwitcher />
          <WalletConnectButton />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Dialog.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                onClick={openNotifications}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
                title="Notifications"
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[9px] font-semibold leading-none text-white"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
              <Dialog.Content className="fixed right-4 top-[68px] z-50 w-[min(360px,calc(100vw-2rem))] rounded-md border border-line bg-surface p-4 text-ink shadow-xl">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                  <Dialog.Title className="text-sm font-semibold">Notifications</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      className="flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </Dialog.Close>
                </div>
                {toasts.length ? (
                  <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                    {toasts.map((toast) => (
                      <li key={toast.id} className="py-3 first:pt-3 last:pb-0">
                        <p className="text-[13px] font-medium">{toast.title}</p>
                        {toast.message && (
                          <p className="mt-1 break-words text-xs text-ink-3">{toast.message}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-ink-3">No notifications</p>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
    </div>
  );
}
