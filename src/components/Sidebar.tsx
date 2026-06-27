import {
  ArrowDataTransferHorizontalIcon,
  CodeIcon,
  Globe02Icon,
  User02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useEffect,useRef } from "react";

import { AccountCardCompact } from "@/components/AccountCard";
import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

export type NavSection =
  | "wallet"
  | "account"
  | "transactions"
  | "soroban"
  | "network";

const NAV: { id: NavSection; label: string; icon: IconSvgElement }[] = [
  { id: "wallet", label: "Wallet", icon: Wallet01Icon },
  { id: "account", label: "Account", icon: User02Icon },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowDataTransferHorizontalIcon,
  },
  { id: "soroban", label: "Soroban", icon: CodeIcon },
  { id: "network", label: "Network", icon: Globe02Icon },
];

interface SidebarProps {
  active: NavSection;
  onNavigate: (s: NavSection) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ active, onNavigate, open, onClose }: SidebarProps) {
  const { isConnected } = useSorokit();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function handleNav(id: NavSection) {
    onNavigate(id);
    onClose();
  }

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile || !open) return;

    // Keep track of the active element that triggered the open
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus first nav item when open transitions to true on mobile
    const firstNavItem = sidebarRef.current?.querySelector("button");
    if (firstNavItem) {
      (firstNavItem as HTMLElement).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (e.key === "Tab") {
        if (!sidebarRef.current) return;
        const focusableElements = sidebarRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Return focus when sidebar closes
      if (triggerRef.current) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    };
  }, [open, onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 z-30 h-full w-[260px] flex flex-col",
          "bg-surface border-r border-line",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0 lg:z-auto",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[60px] border-b border-line shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6C2 3.79 3.79 2 6 2C8.21 2 10 3.79 10 6C10 8.21 8.21 10 6 10"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M6 10C4.9 10 4 9.1 4 8C4 6.9 4.9 6 6 6"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="6" cy="6" r="1" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-ink leading-none">
              sorokit
            </p>
            <p className="text-[11px] text-ink-4 mt-0.5">Stellar Dashboard</p>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3 px-3">
          <p className="px-2 mb-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Navigation
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                aria-current={active === item.id ? "page" : undefined}
                className={cn(
                  "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer overflow-hidden",
                  "text-[13px] focus-visible:outline-none mb-0.5",
                  active === item.id
                    ? "bg-surface-3 text-ink font-medium border border-line-2"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-2 border border-transparent",
                )}
              >
                {/* Active indicator bar */}
                {active === item.id && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand rounded-r-full" />
                )}
                <HugeiconsIcon
                  icon={item.icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={active === item.id ? 2 : 1.5}
                  className={cn(
                    "shrink-0",
                    active === item.id ? "text-brand" : "",
                  )}
                />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Bottom wallet */}
        {isConnected && (
          <div className="px-3 py-3 border-t border-line shrink-0">
            <AccountCardCompact />
          </div>
        )}
      </aside>
    </>
  );
}
