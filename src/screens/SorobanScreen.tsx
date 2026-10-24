import { useCallback, useState } from "react";

import { ContractEventFeed } from "@/components/ContractEventFeed";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SorobanPanel } from "@/components/SorobanPanel";
import { useSorokit } from "@/context/useSorokit";
import { SCREEN_LABELS } from "@/lib/nav-labels";

const CONTRACT_HISTORY_KEY = "sorokit-soroban-contract-history";
const DEFAULT_MAX_HISTORY = 20;
// A Soroban contract ID is a C-prefixed strkey (56 chars, base32-ish payload).
const CONTRACT_ID_PATTERN = /^C[A-Z0-9]{55}$/;

function isValidContractId(id: string): boolean {
  return CONTRACT_ID_PATTERN.test(id.trim());
}

function readRecentContract(): string {
  try {
    const raw = localStorage.getItem(CONTRACT_HISTORY_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const first = Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed[0] : "";
    return isValidContractId(first) ? first : "";
  } catch {
    return "";
  }
}

function readAllRecent(): string[] {
  try {
    const raw = localStorage.getItem(CONTRACT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  try {
    localStorage.setItem(CONTRACT_HISTORY_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (e.g. private browsing) — history is best-effort
  }
}

function stellarExpertUrl(networkName: string | undefined, contractId: string): string | null {
  const segment =
    networkName === "mainnet" ? "public" : networkName === "testnet" ? "testnet" : null;
  if (!segment) return null;
  return `https://stellar.expert/explorer/${segment}/contract/${contractId}`;
}

export function SorobanScreen() {
  const { network } = useSorokit();
  const [contractId, setContractId] = useState(() => readRecentContract());
  const [savedContracts, setSavedContracts] = useState<string[]>(() => readAllRecent());
  const { title, sub } = SCREEN_LABELS.soroban;

  const validContractId = isValidContractId(contractId);
  const expertUrl = validContractId ? stellarExpertUrl(network?.name, contractId.trim()) : null;

  function handleSelectContract(id: string) {
    setContractId(id);
  }

  const handleSaveContract = useCallback((idToSave?: string) => {
    const targetId = (typeof idToSave === "string" ? idToSave : contractId).trim();
    if (!isValidContractId(targetId)) return;
    setSavedContracts((prev) => {
      const next = [targetId, ...prev.filter((entry) => entry !== targetId)].slice(
        0,
        DEFAULT_MAX_HISTORY,
      );
      writeRecent(next);
      return next;
    });
  }, [contractId]);

  function handleRemoveContract(id: string) {
    setSavedContracts((prev) => {
      const next = prev.filter((entry) => entry !== id);
      writeRecent(next);
      return next;
    });
  }

  function handleClearContracts() {
    writeRecent([]);
    setSavedContracts([]);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink leading-none">
            {title}
          </h2>
          <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {validContractId && !savedContracts.includes(contractId.trim()) && (
            <button
              type="button"
              onClick={() => handleSaveContract(contractId)}
              className="text-[11px] font-medium text-brand hover:underline"
            >
              Save contract
            </button>
          )}
          {expertUrl && (
            <a
              href={expertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-brand hover:underline"
            >
              Stellar Expert ↗
            </a>
          )}
        </div>
      </div>
      {savedContracts.length > 0 && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Saved Contracts
            </p>
            <button
              type="button"
              onClick={handleClearContracts}
              className="text-[10px] text-ink-4 underline-offset-2 hover:text-ink-2 hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {savedContracts.map((id) => (
              <span
                key={id}
                className={`inline-flex items-center gap-1 text-[11px] font-mono border rounded transition-colors ${
                  id === contractId
                    ? "border-brand bg-brand-dim text-brand"
                    : "border-line bg-surface-2 text-ink-2 hover:border-line-2"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectContract(id)}
                  title={id}
                  className="pl-2 py-1"
                >
                  {id.slice(0, 6)}…{id.slice(-4)}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveContract(id)}
                  aria-label={`Remove ${id.slice(0, 6)}…${id.slice(-4)} from saved contracts`}
                  title={`Remove ${id}`}
                  className="pr-2 pl-0 text-[11px] leading-none text-ink-4 hover:text-red"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <ErrorBoundary isolate>
        <SorobanPanel
          contractId={contractId}
          onContractIdChange={setContractId}
          onContractSave={handleSaveContract}
        />
      </ErrorBoundary>
      {contractId.trim() !== "" && (
        <ErrorBoundary isolate>
          <ContractEventFeed contractId={contractId} />
        </ErrorBoundary>
      )}
    </div>
  );
}
