import { Cancel01Icon, Logout04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";
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
    error,
    clearError,
    disconnectWallet,
    isDisconnecting,
    network,
  } = useSorokit();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (isConnected) {
      const timerId = window.setTimeout(() => setConnectModalOpen(false), 0);
      return () => window.clearTimeout(timerId);
    }
  }, [isConnected]);

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
          </button>
        </DropdownMenu.Trigger>

        {!onOpenModal && (
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-[180px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {/* Wallet info header */}
              <div className="px-3 py-2 border-b border-line mb-1">
                <p className="text-[12px] font-medium text-ink truncate font-mono">
                  {truncateAddress(address)}
                </p>
                {network && (
                  <p className="text-[10px] text-ink-4 mt-0.5 capitalize">
                    {network.name}
                  </p>
                )}
              </div>

              {/* Disconnect action */}
              <DropdownMenu.Item
                onSelect={() => {
                  void disconnectWallet();
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
        <div className="absolute top-[calc(100%+8row2)] right-0 z-50 flex items-center gap-2 px-3 py-1.5 bg-surface border border-error-dim rounded-lg shadow-lg text-red text-[11px] whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-200">
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