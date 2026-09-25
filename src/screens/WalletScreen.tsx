import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";

import { AddressDisplay } from "@/components/AddressDisplay";
import { QRCode } from "@/components/QRCode";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoCell } from "@/components/ui/InfoCell";
import { useSorokit } from "@/context/useSorokit";

/**
 * Full-screen QR code for scanning. Built on Radix Dialog so it traps focus,
 * closes on Escape or an overlay click, and is labelled for screen readers --
 * on a narrow screen the inline QR code can be clipped or too small to scan.
 */
function QRModal({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 flex flex-col items-center gap-4 focus:outline-none">
          <Dialog.Title className="text-[15px] font-semibold text-ink">
            Receive Funds
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Full-size QR code for your wallet address. Scan it to send funds to
            this account.
          </Dialog.Description>
          <QRCode value={address} size={240} ariaLabel="Full-size QR code" />
          <p className="text-[11px] text-ink-3 break-all text-center font-mono">
            {address}
          </p>
          <Dialog.Close asChild>
            <Button variant="secondary" size="sm">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function WalletScreen() {
  const { address, isConnected, disconnectWallet, network, account } = useSorokit();
  const [isConfirming, setIsConfirming] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleDisconnect = () => {
    if (isConfirming) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsConfirming(false);
      disconnectWallet();
    } else {
      setIsConfirming(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setIsConfirming(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const id = window.setTimeout(() => setToastVisible(false), 3000);
    return () => window.clearTimeout(id);
  }, [toastVisible]);

  // createdAt is inferred rather than authoritative, so an unparseable value is
  // dropped instead of rendering "NaN".
  const createdAtDate = account?.createdAt
    ? new Date(account.createdAt)
    : null;
  const activeSinceYear =
    createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? createdAtDate.getFullYear().toString()
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-brand-dim border-2 border-[rgba(86,69,212,0.25)] flex items-center justify-center text-[13px] font-bold text-brand shrink-0">
              {address ? address.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ink">
                  {isConnected ? "Connected" : "Not connected"}
                </span>
                <Badge variant={isConnected ? "success" : "default"} dot>
                  {isConnected ? "Active" : "Inactive"}
                </Badge>
              </div>
              {address && (
                <AddressDisplay address={address} />
              )}
            </div>
          </div>
          {isConnected && (
            <Button
              variant={isConfirming ? "destructive" : "secondary"}
              size="sm"
              onClick={handleDisconnect}
            >
              {isConfirming ? "Disconnect?" : "Disconnect"}
            </Button>
          )}
        </div>

        {/* Network info cells */}
        {network && (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <InfoCell label="Network" value={network.name} copyable />
            <InfoCell label="RPC Endpoint" value={network.rpcUrl} mono copyable />
          </div>
        )}
        {account?.homeDomain && (
          <div className="border-t border-line">
            <InfoCell label="Home Domain" value={account.homeDomain} />
          </div>
        )}
        {activeSinceYear && (
          <div className="border-t border-line">
            <InfoCell label="Active Since" value={activeSinceYear} />
          </div>
        )}
      </div>

      {isConnected && address && (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-5 border-b border-line">
            <h3 className="text-[14px] font-semibold text-ink">Receive Funds</h3>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Scan the QR code or copy the address to receive payments
            </p>
          </div>
          <div className="px-6 py-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              <QRCode
                value={address}
                size={140}
                className="shrink-0"
                ariaLabel={`QR code to receive funds at address ${address}`}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQrModalOpen(true)}
              >
                Show QR
              </Button>
            </div>
            <div className="flex-1 min-w-0 w-full flex flex-col justify-center gap-1 sm:h-[164px]">
              <AddressDisplay
                address={address}
                showFull
                label="Address"
                onCopy={() => setToastVisible(true)}
              />
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-surface border border-line rounded-md px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <p className="text-[13px] font-semibold text-ink">Address Copied</p>
          <p className="text-[12px] text-ink-3">
            The address has been copied to your clipboard.
          </p>
        </div>
      )}

      <QRModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        address={address || ""}
      />
    </div>
  );
}
