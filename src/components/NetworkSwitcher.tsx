import {
  Add01Icon,
  Alert01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import React, { useEffect, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo, NetworkName } from "@/lib/client";
import { cn } from "@/lib/utils";

export interface NetworkPreset {
  name: NetworkName;
  label: string;
  dot: string;
  description: string;
  defaultRpcUrl: string;
  defaultPassphrase: string;
  defaultHorizonUrl: string;
}

export const STANDARD_NETWORKS: NetworkPreset[] = [
  {
    name: "mainnet",
    label: "Mainnet",
    dot: "bg-green",
    description: "Public Global Stellar Network",
    defaultRpcUrl: "https://soroban.stellar.org",
    defaultPassphrase: "Public Global Stellar Network ; September 2015",
    defaultHorizonUrl: "https://horizon.stellar.org",
  },
  {
    name: "testnet",
    label: "Testnet",
    dot: "bg-orange",
    description: "Test SDF Network",
    defaultRpcUrl: "https://soroban-testnet.stellar.org",
    defaultPassphrase: "Test SDF Network ; September 2015",
    defaultHorizonUrl: "https://horizon-testnet.stellar.org",
  },
  {
    name: "futurenet",
    label: "Futurenet",
    dot: "bg-purple",
    description: "Test SDF Future Network",
    defaultRpcUrl: "https://rpc-futurenet.stellar.org",
    defaultPassphrase: "Test SDF Future Network ; October 2022",
    defaultHorizonUrl: "https://horizon-futurenet.stellar.org",
  },
  {
    name: "localnet",
    label: "Localnet",
    dot: "bg-ink-3",
    description: "Local Development Node",
    defaultRpcUrl: "http://localhost:8000/soroban/rpc",
    defaultPassphrase: "Standalone Network ; February 2017",
    defaultHorizonUrl: "http://localhost:8000",
  },
];

/**
 * Keyboard shortcut that toggles the network picker from anywhere in the
 * application. The shortcut is wired to a `keydown` listener in
 * `NetworkSwitcher` and is also advertised via the trigger button's
 * `aria-keyshortcuts` attribute for assistive technologies.
 *
 * The currently selected network is persisted to
 * `localStorage["sorokit_network"]` by `SorokitProvider.switchNetwork` and
 * restored on next mount, so the user\u2019s choice survives a page reload.
 */
export const NETWORK_SWITCHER_SHORTCUT = "Alt+N";

/**
 * Validates that a URL string is formatted properly and uses http:// or https:// protocol.
 */
export function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const url = new URL(urlString.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function NetworkSwitcher() {
  const {
    network,
    initialNetwork,
    switchNetwork,
    customNetworks = [],
    addCustomNetwork,
    resetTransactionWatchers,
  } = useSorokit();

  const [isSwitching, setIsSwitching] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Alt+N toggles the picker from anywhere in the app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.key is layout-dependent under Alt on some platforms, so accept the
      // physical key too.
      const isN = e.key?.toLowerCase() === "n" || e.code === "KeyN";
      if (!e.altKey || e.ctrlKey || e.metaKey || !isN) return;
      e.preventDefault();
      setIsOpen((prev) => !prev);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Form state for custom network modal
  const [customName, setCustomName] = useState("");
  const [customRpcUrl, setCustomRpcUrl] = useState("");
  const [customHorizonUrl, setCustomHorizonUrl] = useState("");
  const [customPassphrase, setCustomPassphrase] = useState("");
  const [formError, setFormError] = useState("");

  // Escape key closes the custom network dialog
  useEffect(() => {
    if (!isCustomDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsCustomDialogOpen(false);
        setFormError("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCustomDialogOpen]);

  const activePreset = STANDARD_NETWORKS.find(
    (n) => n.name === network?.name,
  );
  const isCustomActive = network?.name === "custom" || (!activePreset && !!network);

  const currentInfo = {
    name: network?.name ?? "testnet",
    label: activePreset?.label ?? network?.name ?? "Testnet",
    dot: activePreset?.dot ?? (isCustomActive ? "bg-brand" : "bg-orange"),
    rpcUrl: network?.rpcUrl ?? activePreset?.defaultRpcUrl ?? "https://soroban-testnet.stellar.org",
    status: network?.status ?? "online",
  };

  // The selected network drifting from the one the client was initialised with
  // means the client's underlying config may not match what is shown.
  const isMismatched =
    !!network && !!initialNetwork && network.name !== initialNetwork.name;
  const mismatchMessage = isMismatched
    ? `Selected ${currentInfo.label}, but the client was initialised with ${initialNetwork.name}. The underlying client config may not match.`
    : "";

  const handleSelectNetwork = async (target: NetworkName | NetworkInfo) => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      resetTransactionWatchers?.();
      await switchNetwork(target);
      const targetLabel =
        typeof target === "string"
          ? (STANDARD_NETWORKS.find((n) => n.name === target)?.label ?? target)
          : target.name;
      setAnnouncement(`Switched to ${targetLabel}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddCustomNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setFormError("Network name is required");
      return;
    }
    if (!customRpcUrl.trim()) {
      setFormError("RPC URL is required");
      return;
    }
    if (!isValidHttpUrl(customRpcUrl)) {
      setFormError("RPC URL must be a valid HTTP or HTTPS URL");
      return;
    }
    if (customHorizonUrl.trim() && !isValidHttpUrl(customHorizonUrl)) {
      setFormError("Horizon URL must be a valid HTTP or HTTPS URL");
      return;
    }

    setFormError("");
    const newConfig: NetworkInfo = {
      name: customName.trim(),
      rpcUrl: customRpcUrl.trim(),
      horizonUrl: customHorizonUrl.trim() || "http://localhost:8000",
      passphrase: customPassphrase.trim() || "Standalone Network ; February 2017",
      status: "online",
    };

    setIsSwitching(true);
    try {
      resetTransactionWatchers?.();
      if (addCustomNetwork) {
        await addCustomNetwork(newConfig);
      } else {
        await switchNetwork(newConfig);
      }
      setAnnouncement(`Switched to custom network ${newConfig.name}`);
      setIsCustomDialogOpen(false);
      // Reset form
      setCustomName("");
      setCustomRpcUrl("");
      setCustomHorizonUrl("");
      setCustomPassphrase("");
      setFormError("");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add custom network",
      );
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={isSwitching}
                aria-keyshortcuts={NETWORK_SWITCHER_SHORTCUT}
                aria-label={`Current network: ${currentInfo.label}. Click to switch network. Shortcut ${NETWORK_SWITCHER_SHORTCUT}.${
                  isMismatched ? ` Warning: ${mismatchMessage}` : ""
                }`}
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3.5 rounded-lg bg-surface-2 border transition-colors cursor-pointer text-[12px] text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed group",
                  isMismatched
                    ? "border-orange hover:border-orange"
                    : "border-line hover:border-line-2",
                )}
              >
                <span className="relative flex items-center justify-center shrink-0">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      currentInfo.dot,
                    )}
                  >
                    <span className="sr-only">{currentInfo.label} status</span>
                  </span>
                  <span
                    className={cn(
                      "absolute w-3 h-3 rounded-full animate-ping opacity-25",
                      currentInfo.dot,
                    )}
                  />
                </span>

                <span className="hidden sm:inline font-medium text-ink" aria-hidden="true">
                  {currentInfo.label}
                </span>

                {isMismatched && (
                  <span
                    data-testid="network-mismatch-badge"
                    aria-hidden="true"
                    title={mismatchMessage}
                    className="inline-flex items-center gap-1 rounded-full bg-[rgba(249,115,22,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-orange"
                  >
                    <HugeiconsIcon
                      icon={Alert01Icon}
                      size={10}
                      color="currentColor"
                      strokeWidth={2}
                    />
                    <span className="hidden sm:inline">Mismatch</span>
                  </span>
                )}

                {isSwitching ? (
                  <span className="ml-0.5 h-3 w-3 animate-spin rounded-full border-2 border-ink-2 border-t-transparent" />
                ) : (
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={10}
                    color="currentColor"
                    strokeWidth={2}
                    className="opacity-40 ml-0.5 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </button>
            </DropdownMenu.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="bottom"
              align="center"
              sideOffset={6}
              className="z-50 max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-[11px] shadow-lg"
            >
              <p className="font-semibold text-ink">{currentInfo.label} ({currentInfo.status})</p>
              <p className="font-mono text-[10px] text-ink-3 break-all mt-0.5">
                RPC: {currentInfo.rpcUrl}
              </p>
              {isMismatched && (
                <p className="text-[10px] text-orange mt-1">{mismatchMessage}</p>
              )}
              <p className="text-[10px] text-ink-4 mt-1">
                Press {NETWORK_SWITCHER_SHORTCUT} to switch networks
              </p>
              <Tooltip.Arrow className="fill-surface border-line" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            avoidCollisions={true}
            collisionPadding={12}
            className="z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-line mb-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                <span>Select Network</span>
                <span className="text-green flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
                  {currentInfo.status}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 truncate mt-0.5 font-mono">
                {currentInfo.rpcUrl}
              </p>
            </div>

            {isMismatched && (
              <div
                role="alert"
                className="mx-1.5 mb-1 flex items-start gap-2 rounded-lg border border-orange bg-[rgba(249,115,22,0.08)] px-2.5 py-2 text-[11px] text-orange"
              >
                <HugeiconsIcon
                  icon={Alert01Icon}
                  size={12}
                  color="currentColor"
                  strokeWidth={2}
                  className="mt-0.5 shrink-0"
                />
                <span>{mismatchMessage}</span>
              </div>
            )}

            {/* Standard networks */}
            <DropdownMenu.Group>
              <DropdownMenu.Label className="px-3 py-1 text-[10px] font-semibold text-ink-4 uppercase tracking-[0.08em]">
                Standard Networks
              </DropdownMenu.Label>
              {STANDARD_NETWORKS.map((net) => {
                const isActive = network?.name === net.name;
                const rpcUrl =
                  isActive && network?.rpcUrl
                    ? network.rpcUrl
                    : net.defaultRpcUrl;

                return (
                  <Tooltip.Root key={net.name}>
                    <Tooltip.Trigger asChild>
                      <DropdownMenu.Item
                        disabled={isSwitching}
                        onSelect={() => handleSelectNetwork(net.name)}
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer outline-none transition-colors",
                          "focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand",
                          isActive
                            ? "bg-surface-2 text-ink font-medium"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink focus:text-ink",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              net.dot,
                            )}
                          >
                            <span className="sr-only">{net.label}</span>
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{net.label}</span>
                            <span className="text-[10px] text-ink-4 font-mono truncate">
                              {rpcUrl}
                            </span>
                          </div>
                        </div>

                        {isActive && (
                          <HugeiconsIcon
                            icon={Tick01Icon}
                            size={12}
                            color="currentColor"
                            strokeWidth={2}
                            className="shrink-0 text-brand"
                          />
                        )}
                      </DropdownMenu.Item>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="left"
                        align="center"
                        sideOffset={8}
                        className="z-50 max-w-xs rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-md"
                      >
                        <p className="font-medium text-ink">{net.description}</p>
                        <p className="font-mono text-[10px] text-ink-3 break-all mt-0.5">
                          RPC: {rpcUrl}
                        </p>
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </DropdownMenu.Group>

            {/* Custom networks list */}
            {customNetworks.length > 0 && (
              <DropdownMenu.Group className="mt-1 border-t border-line pt-1">
                <DropdownMenu.Label className="px-3 py-1 text-[10px] font-semibold text-ink-4 uppercase tracking-[0.08em]">
                  Custom Networks
                </DropdownMenu.Label>
                {customNetworks.map((net) => {
                  const isActive = network?.name === net.name || network?.rpcUrl === net.rpcUrl;
                  return (
                    <Tooltip.Root key={net.name + net.rpcUrl}>
                      <Tooltip.Trigger asChild>
                        <DropdownMenu.Item
                          disabled={isSwitching}
                          onSelect={() => handleSelectNetwork(net)}
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer outline-none transition-colors",
                            "focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand",
                            isActive
                              ? "bg-surface-2 text-ink font-medium"
                              : "text-ink-2 hover:bg-surface-2 hover:text-ink focus:text-ink",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0 bg-brand" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{net.name}</span>
                              <span className="text-[10px] text-ink-4 font-mono truncate">
                                {net.rpcUrl}
                              </span>
                            </div>
                          </div>

                          {isActive && (
                            <HugeiconsIcon
                              icon={Tick01Icon}
                              size={12}
                              color="currentColor"
                              strokeWidth={2}
                              className="shrink-0 text-brand"
                            />
                          )}
                        </DropdownMenu.Item>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="left"
                          align="center"
                          sideOffset={8}
                          className="z-50 max-w-xs rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-md"
                        >
                          <p className="font-medium text-ink">Custom Network: {net.name}</p>
                          <p className="font-mono text-[10px] text-ink-3 break-all mt-0.5">
                            RPC: {net.rpcUrl}
                          </p>
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  );
                })}
              </DropdownMenu.Group>
            )}

            {/* Add Custom Network Trigger */}
            <DropdownMenu.Separator className="h-px bg-line my-1" />
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setIsCustomDialogOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-brand hover:bg-surface-2 cursor-pointer outline-none transition-colors font-medium focus:bg-surface-2"
            >
              <HugeiconsIcon
                icon={Add01Icon}
                size={14}
                color="currentColor"
                strokeWidth={2}
              />
              <span>Add Custom Network...</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>

        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </DropdownMenu.Root>

      {/* Custom Network Dialog Modal */}
      <Dialog.Root
        open={isCustomDialogOpen}
        onOpenChange={(open) => {
          setIsCustomDialogOpen(open);
          if (!open) {
            setFormError("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in" />
          <Dialog.Content
            onEscapeKeyDown={() => {
              setIsCustomDialogOpen(false);
              setFormError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsCustomDialogOpen(false);
                setFormError("");
              }
            }}
            className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-2xl focus:outline-none"
          >
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <div>
                <Dialog.Title className="text-[16px] font-semibold text-ink">
                  Add Custom Network
                </Dialog.Title>
                <Dialog.Description className="text-[12px] text-ink-3 mt-0.5">
                  Configure custom Soroban RPC endpoint & passphrase.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close custom network dialog"
                  className="rounded-lg p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={16}
                    color="currentColor"
                    strokeWidth={2}
                  />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleAddCustomNetwork} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-error-dim border border-error text-[12px] text-red">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="custom-network-name"
                  className="block text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5"
                >
                  Network Name *
                </label>
                <input
                  id="custom-network-name"
                  type="text"
                  required
                  placeholder="e.g. Local Node"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-2 border border-line text-[13px] text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-ink-4"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-rpc-url"
                  className="block text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5"
                >
                  RPC Endpoint URL *
                </label>
                <input
                  id="custom-rpc-url"
                  type="url"
                  required
                  placeholder="e.g. http://localhost:8000/soroban/rpc"
                  value={customRpcUrl}
                  onChange={(e) => setCustomRpcUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-2 border border-line text-[13px] text-ink font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-ink-4"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-horizon-url"
                  className="block text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5"
                >
                  Horizon URL (Optional)
                </label>
                <input
                  id="custom-horizon-url"
                  type="url"
                  placeholder="e.g. http://localhost:8000"
                  value={customHorizonUrl}
                  onChange={(e) => setCustomHorizonUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-2 border border-line text-[13px] text-ink font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-ink-4"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-passphrase"
                  className="block text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5"
                >
                  Network Passphrase (Optional)
                </label>
                <input
                  id="custom-passphrase"
                  type="text"
                  placeholder="e.g. Standalone Network ; February 2017"
                  value={customPassphrase}
                  onChange={(e) => setCustomPassphrase(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-2 border border-line text-[13px] text-ink font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-ink-4"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 h-9 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isSwitching}
                  className="px-4 h-9 rounded-lg bg-brand text-[13px] font-medium text-white hover:bg-brand/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Add & Switch Network
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Tooltip.Provider>
  );
}
