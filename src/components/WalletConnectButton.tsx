import { Cancel01Icon, Logout04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { truncateAddress } from "@/lib/utils";

import { WalletConnectModal } from "./WalletConnectModal";

export interface WalletConnectButtonProps {
  /** Called when clicking the button while already connected (e.g. to open an account sidebar). */
  onOpenModal?: () => void;
}

export function WalletConnectButton({ onOpenModal }: WalletConnectButtonProps = {}) {
  const {
    isConnected,
    isConnecting,
    address,
    walletName,
    isHardware,
    error,
    clearError,
    disconnectWallet,
    isDisconnecting,
    network,
  } = useSorokit();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const menuRef = useOutsideClick<HTMLDivElement>(() => {
    setDropdownOpen(false);
  }, dropdownOpen);

  useEffect(() => {
    if (isConnected) {
      const timerId = window.setTimeout(() => setConnectModalOpen(false), 0);
      return () => window.clearTimeout(timerId);
    }
  }, [isConnected]);

  const isHardwareWallet =
    Boolean(isHardware) ||
    Boolean(
      walletName &&
        (walletName.toLowerCase().includes("ledger") ||
          walletName.toLowerCase().includes("hardware") ||
          walletName.toLowerCase().includes("webusb")),
    );

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } finally {
      if (typeof window !== "undefined") {
        const keysToRemove = [
          "sorokit_wallet_session",
          "sorokit_connected_wallet",
          "sorokit_wallet_name",
          "walletconnect",
          "wc@2:client:0.3//session",
          "wc@2:core:0.3//pairing",
        ];
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("walletconnect") ||
              key.startsWith("wc@") ||
              key.startsWith("sorokit_"))
          ) {
            localStorage.removeItem(key);
          }
        }
      }
    }
  };

  if (isConnected && address) {
    const handleClick = () => {
      if (onOpenModal) {
        onOpenModal();
      } else {
        setDropdownOpen((prev) => !prev);
      }
    };

    return (
      <DropdownMenu.Root open={onOpenModal ? false : dropdownOpen} onOpenChange={onOpenModal ? undefined : setDropdownOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3.5 rounded-lg bg-surface-2 border border-line hover:border-line-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`Wallet connected: ${address}. Click to manage.`}
            aria-haspopup="menu"
            aria-expanded={onOpenModal ? undefined : dropdownOpen}
          >
            <span className="w-2 h-2 rounded-full bg-green shrink-0" />
            <span data-address className="hidden sm:inline">
              {truncateAddress(address)}
            </span>
            {isHardwareWallet && (
              <span
                data-testid="hardware-badge"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30"
              >
                {walletName && walletName.toLowerCase().includes("ledger")
                  ? "Ledger"
                  : "Hardware"}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>

        {!onOpenModal && (
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              ref={menuRef}
              align="end"
              sideOffset={6}
              onPointerDownOutside={() => setDropdownOpen(false)}
              className="z-50 min-w-[180px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {/* Wallet info header */}
              <div className="px-3 py-2 border-b border-line mb-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-ink truncate font-mono">
                    {truncateAddress(address)}
                  </p>
                  {isHardwareWallet && (
                    <span
                      data-testid="hardware-badge-dropdown"
                      className="text-[9px] font-medium px-1 py-0.2 rounded bg-purple-500/15 text-purple-400"
                    >
                      {walletName && walletName.toLowerCase().includes("ledger")
                        ? "Ledger"
                        : "Hardware"}
                    </span>
                  )}
                </div>
                {network && (
                  <p className="text-[10px] text-ink-4 mt-0.5 capitalize">
                    {network.name}
                  </p>
                )}
              </div>

              {/* Disconnect action */}
              <DropdownMenu.Item
                onSelect={() => {
                  void handleDisconnect();
                }}
                disabled={isDisconnecting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-red hover:bg-error-dim-muted transition-colors cursor-pointer outline-none focus:bg-error-dim-muted disabled:opacity-50"
              >
                <HugeiconsIcon
                  icon={Logout04Icon}
                  size={14}
                  color="currentColor"
                  strokeWidth={2}
                />
                {isDisconnecting ? "Disconnecting…" : "Disconnect"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </DropdownMenu.Root>
    );
  }

  return (
    <div className="relative flex flex-col items-end">
      <Button
        size="md"
        loading={isConnecting}
        onClick={() => setConnectModalOpen(true)}
        className="px-2.5 sm:px-4"
        aria-label={isConnecting ? "Connecting…" : "Connect Wallet"}
      >
        <span className="hidden sm:inline">
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </span>
        <span className="sm:hidden">{isConnecting ? "…" : "Connect"}</span>
      </Button>
      {!isConnected && error && !connectModalOpen && (
        <div
          role="alert"
          data-testid="connection-error-alert"
          className="absolute top-[calc(100%+8px)] right-0 z-50 flex items-center gap-2 px-3 py-1.5 bg-surface border border-error-dim rounded-lg shadow-lg text-red text-[11px] whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Clear error"
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
      <WalletConnectModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
    </div>
  );
}