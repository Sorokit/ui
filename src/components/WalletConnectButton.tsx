import { useSorokit } from "@/context/useSorokit";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

export function WalletConnectButton({
  onOpenModal,
}: {
  onOpenModal?: () => void;
}) {
  const { isConnected, isConnecting, address, connectWallet, error, clearError } = useSorokit();

  if (isConnected && address) {
    return (
      <button
        onClick={onOpenModal}
        className="inline-flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3.5 rounded-lg bg-surface-2 border border-line hover:border-line-2 transition-colors cursor-pointer"
        aria-label={`Wallet connected: ${address}. Click to manage.`}
      >
        <span className="w-2 h-2 rounded-full bg-green shrink-0" />
        <span data-address className="hidden sm:inline">{truncateAddress(address)}</span>
      </button>
    );
  }

  return (
    <div className="relative flex flex-col items-end">
      <Button
        size="md"
        loading={isConnecting}
        onClick={connectWallet}
        className="px-2.5 sm:px-4"
        aria-label={isConnecting ? "Connecting…" : "Connect Wallet"}
      >
        <span className="hidden sm:inline">{isConnecting ? "Connecting…" : "Connect Wallet"}</span>
        <span className="sm:hidden">{isConnecting ? "…" : "Connect"}</span>
      </Button>
      {!isConnected && error && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 flex items-center gap-2 px-3 py-1.5 bg-surface border border-error-dim rounded-lg shadow-lg text-red text-[11px] whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-200">
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
    </div>
  );
}
