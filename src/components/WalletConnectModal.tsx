/**
 * WalletConnectModal
 *
 * A complete wallet connection flow: adapter selection, connection progress,
 * success confirmation, and error handling with recovery suggestions.
 *
 * This is a presentation-only component — selecting a wallet in the grid
 * does not target that specific extension (sorokit-ui has no blockchain
 * logic; see package.json's description). It always drives the same
 * `connectWallet()` call from `useSorokit`, and uses the selection purely to
 * personalize the connecting/success/error copy ("Connecting to Freighter…").
 * A real multi-adapter implementation lives in the sorokit-core client the
 * host app provides.
 *
 * @component
 * @example
 * ```tsx
 * import { WalletConnectModal } from 'sorokit-ui';
 *
 * function App() {
 *   const [open, setOpen] = useState(false);
 *   return (
 *     <>
 *       <button onClick={() => setOpen(true)}>Connect</button>
 *       <WalletConnectModal open={open} onClose={() => setOpen(false)} />
 *     </>
 *   );
 * }
 * ```
 */
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import { useSorokit } from "@/context/useSorokit";
import { truncateAddress } from "@/lib/utils";

export interface WalletOption {
  id: string;
  name: string;
  initial: string;
  color: string;
  installUrl?: string;
  deepLink?: string;
}

export const DEFAULT_WALLET_OPTIONS: WalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    initial: "F",
    color: "#7B61FF",
    installUrl: "https://www.freighter.app/",
    deepLink: "https://www.freighter.app/",
  },
  {
    id: "xbull",
    name: "xBull",
    initial: "X",
    color: "#F3A93B",
    installUrl: "https://xbull.app/",
    deepLink: "https://xbull.app/",
  },
  {
    id: "lobstr",
    name: "Lobstr",
    initial: "L",
    color: "#2F80ED",
    installUrl: "https://lobstr.co/",
    deepLink: "https://lobstr.co/dl/",
  },
  {
    id: "albedo",
    name: "Albedo",
    initial: "A",
    color: "#00B894",
    installUrl: "https://albedo.link/",
    deepLink: "https://albedo.link/",
  },
];

type Step = "select" | "connecting" | "success" | "error";

export interface WalletConnectModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close (backdrop click, Escape, close button, or after success) */
  onClose: () => void;
  /** Wallet options shown in the selection grid. Defaults to Freighter/xBull/Lobstr/Albedo. */
  walletOptions?: WalletOption[];
}

/** Check whether a wallet browser extension is installed. */
export function isWalletExtensionInstalled(walletId: string): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as Record<string, unknown>;
  const id = walletId.toLowerCase();
  if (id === "freighter") return Boolean(win.freighter || win.isFreighter);
  if (id === "xbull") return Boolean(win.xbull || win.xBull);
  if (id === "albedo") return Boolean(win.albedo);
  if (id === "lobstr") return Boolean(win.lobstr);
  return Boolean(win[id] || win[walletId]);
}

/** Check whether user is browsing on a mobile device. */
export function isMobileEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/** Best-effort classification of a connection error for recovery messaging. */
function isNotInstalledError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("not installed") ||
    normalized.includes("no stellar wallet")
  );
}

export function WalletConnectModal({
  open,
  onClose,
  walletOptions = DEFAULT_WALLET_OPTIONS,
}: WalletConnectModalProps) {
  const { connectWallet, isConnecting, address, error, clearError } =
    useSorokit();
  const [step, setStep] = useState<Step>("select");
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(
    null,
  );

  const isMobile = isMobileEnvironment();

  // Advance out of "connecting" once useSorokit settles. Deferred via
  // setTimeout(0), same pattern SorokitProvider uses for its own effects —
  // avoids setting state synchronously within the effect body itself.
  useEffect(() => {
    if (!open || step !== "connecting" || isConnecting) return;
    const timerId = window.setTimeout(() => {
      if (error) {
        setStep("error");
      } else if (address) {
        setStep("success");
      }
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [open, step, isConnecting, error, address]);

  // Reset local flow state and notify the caller.
  function handleClose() {
    setStep("select");
    setSelectedWallet(null);
    onClose();
  }

  function handleSelectWallet(wallet: WalletOption) {
    setSelectedWallet(wallet);
    if (isMobile && wallet.deepLink) {
      if (typeof window !== "undefined") {
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = wallet.deepLink;
      }
    }
    setStep("connecting");
    void connectWallet();
  }

  function handleRetry() {
    clearError();
    setStep("select");
  }

  const handleExternalLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    // Maintain focus within modal dialog when launching external install links
    const dialogElement = e.currentTarget.closest('[role="dialog"]') as HTMLElement | null;
    if (dialogElement) {
      setTimeout(() => {
        dialogElement.focus();
      }, 0);
    }
  };

  const notInstalled = error ? isNotInstalledError(error) : false;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl p-6 focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="wallet-connect-desc"
        >
          <div className="flex items-center justify-between mb-1">
            <Dialog.Title className="text-[14px] font-semibold text-ink">
              {step === "select" && "Connect a wallet"}
              {step === "connecting" && "Connecting…"}
              {step === "success" && "Connected"}
              {step === "error" && "Connection failed"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-ink-4 hover:text-ink-2 transition-colors"
                aria-label="Close"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
            </Dialog.Close>
          </div>
          <p id="wallet-connect-desc" className="text-[12px] text-ink-3 mb-4">
            {step === "select" &&
              "Choose a Stellar wallet to connect to this app."}
            {step === "connecting" &&
              `Approve the connection request in ${selectedWallet?.name ?? "your wallet"}.`}
            {step === "success" &&
              "Your wallet is connected and ready to use."}
            {step === "error" && "We couldn't complete the connection."}
          </p>
          <Separator spacing="sm" />

          {step === "select" && (
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Available wallets"
            >
              {walletOptions.map((wallet) => {
                const installed = isWalletExtensionInstalled(wallet.id);
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleSelectWallet(wallet)}
                    className="relative flex flex-col items-center gap-2 rounded-lg border border-line px-3 py-4 hover:border-line-2 hover:bg-surface-2 transition-colors"
                  >
                    {installed && (
                      <span
                        data-testid="installed-badge"
                        className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-success-dim text-green"
                      >
                        Installed
                      </span>
                    )}
                    {isMobile && wallet.deepLink && (
                      <span
                        data-testid="mobile-deep-link-option"
                        className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-dim text-brand"
                      >
                        Deep Link
                      </span>
                    )}
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                      style={{ backgroundColor: wallet.color }}
                      aria-hidden="true"
                    >
                      {wallet.initial}
                    </span>
                    <span className="text-[12px] text-ink-2 font-medium">
                      {wallet.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === "connecting" && (
            <div
              role="status"
              className="flex flex-col items-center gap-3 py-6"
            >
              <span
                aria-hidden="true"
                className="w-8 h-8 border-2 border-line-2 border-t-brand rounded-full animate-spin"
              />
              <p className="text-[12px] text-ink-3">
                Waiting for {selectedWallet?.name ?? "wallet"} approval…
              </p>
            </div>
          )}

          {step === "success" && (
            <div
              role="status"
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-success-dim flex items-center justify-center">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={20}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-green"
                />
              </div>
              {address && (
                <p className="text-[13px] font-mono text-ink">
                  {truncateAddress(address, 8, 6)}
                </p>
              )}
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-error-dim flex items-center justify-center shrink-0">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={18}
                    color="currentColor"
                    strokeWidth={1.5}
                    className="text-red"
                  />
                </div>
                <div>
                  <p role="alert" className="text-[13px] text-red">
                    {error}
                  </p>
                  <p className="text-[12px] text-ink-3 mt-2 leading-relaxed">
                    {notInstalled ? (
                      <>
                        Install the {selectedWallet?.name ?? "wallet"} browser extension{" "}
                        {selectedWallet?.installUrl && (
                          <a
                            href={selectedWallet.installUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleExternalLinkClick}
                            className="text-brand underline font-medium hover:text-brand-hover"
                            data-testid="install-wallet-link"
                          >
                            Install {selectedWallet.name}
                          </a>
                        )}
                        , then try again.
                      </>
                    ) : (
                      "Check that your wallet is unlocked and try again."
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Button size="md" className="flex-1" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
