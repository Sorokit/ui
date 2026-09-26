import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { type NetworkInfo, type TxResult } from "@/lib/client";
import {
  cn,
  truncateAddress,
  truncateToUtf8ByteLength,
  utf8ByteLength,
  validateStellarAddress,
} from "@/lib/utils";

import {
  TransactionConfirmModal,
  type TransactionPreviewData,
} from "./TransactionConfirmModal";
import { TransactionStatusTracker } from "./TransactionStatusTracker";

type State = "idle" | "loading" | "success" | "error";

/** Stellar's MEMO_TEXT limit is 28 bytes (UTF-8 encoded), not 28 characters. */
const MEMO_TEXT_MAX_BYTES = 28;

const STROOPS_PER_XLM = 10_000_000;

export type MemoType = "none" | "text" | "id";

export const MEMO_TYPES: { value: MemoType; label: string }[] = [
  { value: "none", label: "No memo" },
  { value: "text", label: "Text memo" },
  { value: "id", label: "Memo ID" },
];

export interface TransactionPanelProps {
  defaultDestination?: string;
  defaultAmount?: string;
  defaultMemo?: string;
  previewMode?: boolean;
  onSuccess?: (result: TxResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function TransactionPanel({
  defaultDestination = "",
  defaultAmount = "",
  defaultMemo = "",
  previewMode = true,
  onSuccess,
  onError,
  className,
}: TransactionPanelProps = {}) {
  const {
    address,
    client,
    account,
    network,
    isLoadingAccount,
    isConnected,
    balances = [],
  } = useSorokit();
  const [dest, setDest] = useState(defaultDestination);
  const [destDirty, setDestDirty] = useState(false);
  const [amount, setAmount] = useState(defaultAmount);
  const [amountDirty, setAmountDirty] = useState(false);
  const [asset, setAsset] = useState("XLM");
  const [memoType, setMemoType] = useState<MemoType>("text");
  const [memo, setMemo] = useState(defaultMemo);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<TxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransactionPreviewData | null>(null);
  const [isBuildingPreview, setIsBuildingPreview] = useState(false);
  const [estimatedFeeXlm, setEstimatedFeeXlm] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const formId = useId();

  // Fetch the current network fee estimate once a wallet is connected so the
  // balance check below can warn the user before they submit, rather than
  // only after Horizon rejects an underfunded transaction.
  useEffect(() => {
    if (!client || !isConnected) return;
    let active = true;
    client.transaction
      .estimateFee()
      .then(({ data }) => {
        if (!active || !data) return;
        const stroops = parseFloat(data.recommended ?? data.baseFee);
        if (Number.isFinite(stroops)) {
          setEstimatedFeeXlm(stroops / STROOPS_PER_XLM);
        }
      })
      .catch(() => {
        // Fee estimation is a soft enhancement to the balance warning; if it
        // fails, fall back to treating the fee as negligible rather than
        // blocking the form.
      });
    return () => {
      active = false;
    };
  }, [client, isConnected]);

  const assetOptions = balances ?? [];

  // Derive the effective asset: keep the user's selection while it is valid,
  // otherwise fall back to the first available balance once balances load.
  const selectedAsset =
    assetOptions.length === 0 || assetOptions.some((b) => b.asset === asset)
      ? asset
      : assetOptions[0].asset;

  const isDestValid = validateStellarAddress(dest);
  const isSelfPayment = dest.trim() === address;
  const parsedAmount = parseFloat(amount);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount >= 0.0000001;
  const isMemoIdValid =
    memoType !== "id" || (memo.trim() !== "" && /^\d+$/.test(memo.trim()));

  // Get XLM balance from balances array
  const xlmBalance = balances.find((b) => b.asset === "XLM")?.balance || "0";
  const xlmBalanceNumber = parseFloat(xlmBalance);
  const selectedAssetBalance = assetOptions.find((b) => b.asset === selectedAsset);

  // The network fee is always paid in XLM regardless of which asset is being
  // sent, so a payment in XLM must leave room for both the amount and the
  // fee, while a payment in another asset only needs the fee reserved out of
  // the separate XLM balance.
  const isSendingXlm = selectedAsset === "XLM";
  const spendableXlm = xlmBalanceNumber - estimatedFeeXlm;
  const hasSufficientBalance =
    !isNaN(parsedAmount) &&
    (isSendingXlm
      ? parsedAmount <= spendableXlm
      : parsedAmount <= (selectedAssetBalance ? parseFloat(selectedAssetBalance.balance) : 0));
  const exceedsSpendableBalance =
    isSendingXlm && !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount > spendableXlm;

  const canSubmit =
    isConnected &&
    isDestValid &&
    amount.trim() !== "" &&
    isAmountValid &&
    hasSufficientBalance;

  /** The actual submission — only ever called from the confirm modal. */
  async function submitTransaction() {
    if (state === "loading") return;
    if (!address || !client) {
      setError("Wallet not connected");
      setState("error");
      return;
    }

    // Cancel previous requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState("loading");
    setError(null);
    setResult(null);
    try {
      const { data, error: err } = await client.transaction.submit({
        source: address,
        destination: dest.trim(),
        amount: amount.trim(),
        asset: selectedAsset,
        assetIssuer: selectedAssetBalance?.assetIssuer,
        memoType,
        memo:
          memoType !== "none" && memo.trim() !== "" ? memo.trim() : undefined,
      });
      if (signal.aborted) return;
      if (err) {
        setError(err);
        setState("error");
        onError?.(err);
        return;
      }
      setResult(data);
      setState("success");
      onSuccess?.(data!);
      setDest("");
      setAmount("");
      setMemo("");
      setDestDirty(false);
      setAmountDirty(false);
    } catch (e) {
      if (!signal.aborted) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        setState("error");
        onError?.(msg);
      }
    } finally {
      setPreview(null);
    }
  }

  /** Builds a preview of the transaction and opens the confirmation modal. */
  async function buildPreview() {
    const sourceAddress = address;
    if (!sourceAddress) return;
    setIsBuildingPreview(true);
    try {
      const { data: feeData } = client ? await client.transaction.estimateFee() : { data: null };
      const memoSuffix =
        memoType !== "none" && memo.trim() !== "" ? ` — memo: "${memo.trim()}"` : "";
      setPreview({
        transactionType: "Payment",
        operations: [
          {
            type: "Payment",
            description: `Send ${amount.trim()} ${selectedAsset} to ${truncateAddress(dest.trim(), 8, 6)}${memoSuffix}`,
          },
        ],
        fee: {
          baseFeeStroops: feeData?.baseFee ?? "100",
          totalStroops: feeData?.recommended ?? feeData?.baseFee ?? "100",
        },
        sourceAccount: sourceAddress,
        sequenceNumber: account?.sequence,
      });
    } finally {
      setIsBuildingPreview(false);
    }
  }

  /** Form submit handler — fires on Send button click and Enter key press. */
  function handleFormSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (state === "loading" || !address || !canSubmit) return;
    if (previewMode) {
      void buildPreview();
    } else {
      void submitTransaction();
    }
  }

  const explorerUrl = result ? explorerTxUrl(network, result.hash) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      <div className="px-5 py-4 border-b border-line">
        <h3 className="text-[14px] font-semibold text-ink">Send Payment</h3>
        <p className="text-[12px] text-ink-3 mt-0.5">
          Submit a payment on the Stellar network
        </p>
      </div>

      <div className="px-6 py-6">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-[13px] text-ink-3">
              Connect your wallet to send transactions
            </p>
          </div>
        ) : state === "success" && result ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-success-dim flex items-center justify-center shrink-0">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={18}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-green"
                />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  Transaction submitted
                </p>
                <p className="text-[12px] text-ink-3">
                  Ledger #{result.ledger}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 border border-line px-5 py-4 flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                Transaction Hash
              </p>
              {explorerUrl ? (
                <a
                  data-txhash
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View transaction ${result.hash} on Stellar Expert (opens in a new tab)`}
                  className="break-all leading-relaxed text-brand hover:underline inline-flex items-start gap-1.5"
                >
                  <span aria-hidden="true">{result.hash}</span>
                  <ExternalLinkIcon className="mt-[3px] shrink-0 opacity-70" />
                </a>
              ) : (
                <span data-testid="submitted-tx-hash" data-txhash className="break-all leading-relaxed">
                  {result.hash}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="success" dot>
                  Successful
                </Badge>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View on Stellar Expert: transaction ${result.hash} (opens in a new tab)`}
                    className="text-[11px] text-brand hover:underline"
                  >
                    View on Stellar Expert
                  </a>
                )}
              </div>
            </div>
            <TransactionStatusTracker hash={result.hash} className="mt-2" />
          </div>
        ) : state === "error" ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-error-dim flex items-center justify-center shrink-0 mt-0.5">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={18}
                color="currentColor"
                strokeWidth={1.5}
                className="text-red"
              />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink">
                Transaction failed
              </p>
              <p className="text-[13px] text-red mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <form
            id={formId}
            onSubmit={handleFormSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                handleFormSubmit(e);
              }
            }}
            className="flex flex-col gap-5"
          >
            <Input
              label="Destination Address"
              placeholder="G..."
              value={dest}
              onChange={(e) => {
                setDest(e.target.value);
                setDestDirty(true);
              }}
              error={
                destDirty
                  ? !isDestValid
                    ? !dest.trim().startsWith("G")
                      ? "Stellar address must start with 'G'"
                      : "Stellar address must be 56 characters"
                    : isSelfPayment
                      ? "Destination is the same as your wallet address"
                      : undefined
                  : undefined
              }
              disabled={state === "loading"}
            />
            <Select
              label="Asset"
              value={selectedAsset}
              onChange={(e) => setAsset(e.target.value)}
              disabled={state === "loading" || isLoadingAccount || assetOptions.length === 0}
            >
              {isLoadingAccount || assetOptions.length === 0 ? (
                <option value="">Loading assets…</option>
              ) : (
                assetOptions.map((b) => (
                  <option key={b.asset} value={b.asset}>
                    {b.asset} — {b.balance}
                  </option>
                ))
              )}
            </Select>
            <Input
              label={`Amount (${selectedAsset})`}
              type="number"
              placeholder="0.00"
              min="0.0000001"
              max={xlmBalanceNumber || undefined}
              step="0.0000001"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountDirty(true);
              }}
              hint={
                selectedAssetBalance
                  ? `Balance: ${selectedAssetBalance.balance} ${selectedAsset}`
                  : undefined
              }
              error={
                amountDirty
                  ? amount.trim() === ""
                    ? "Amount is required"
                    : isNaN(parsedAmount) || parsedAmount <= 0
                      ? "Amount must be greater than 0"
                      : parsedAmount < 0.0000001
                        ? "Minimum amount is 0.0000001 XLM"
                        : !hasSufficientBalance
                          ? isSendingXlm && estimatedFeeXlm > 0
                            ? "Insufficient balance (amount + network fee exceeds available balance)"
                            : "Insufficient balance"
                          : undefined
                  : undefined
              }
              disabled={state === "loading"}
            />
            {amountDirty && exceedsSpendableBalance && (
              <Badge variant="error" dot live data-testid="balance-warning-badge">
                Exceeds spendable balance (amount + est. fee of {estimatedFeeXlm.toFixed(7)}{" "}
                XLM)
              </Badge>
            )}
            <Select
              label="Memo type"
              value={memoType}
              onChange={(e) => setMemoType(e.target.value as MemoType)}
              disabled={state === "loading"}
            >
              {MEMO_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            {memoType !== "none" && (
              <div className="flex flex-col gap-1.5">
                <Input
                  label={memoType === "id" ? "Memo ID" : "Memo (optional)"}
                  placeholder={memoType === "id" ? "1234567890" : "Text memo"}
                  inputMode={memoType === "id" ? "numeric" : undefined}
                  value={memo}
                  onChange={(e) => {
                    const next = e.target.value;
                    // MEMO_TEXT is a 28-byte (UTF-8) limit, not 28 characters —
                    // truncate on every keystroke so the value can never exceed
                    // what Horizon will accept, rather than only warning about it.
                    setMemo(
                      memoType === "text"
                        ? truncateToUtf8ByteLength(next, MEMO_TEXT_MAX_BYTES)
                        : next,
                    );
                  }}
                  error={
                    memoType === "id" && memo.trim() !== "" && !isMemoIdValid
                      ? "Memo ID must be an unsigned integer"
                      : undefined
                  }
                  disabled={state === "loading"}
                />
                {memoType === "text" && (
                  <span
                    className={`text-[10px] text-right ${utf8ByteLength(memo) >= MEMO_TEXT_MAX_BYTES ? "text-red" : "text-ink-3"}`}
                  >
                    {utf8ByteLength(memo)}/{MEMO_TEXT_MAX_BYTES} bytes
                  </span>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      <div className="px-5 py-4 border-t border-line flex items-center gap-3">
        {state === "success" || state === "error" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setState("idle");
              setResult(null);
              setError(null);
              setDestDirty(false);
              setAmountDirty(false);
            }}
          >
            New Transaction
          </Button>
        ) : (
          <Button
            type="submit"
            form={formId}
            size="md"
            loading={state === "loading" || isBuildingPreview}
            disabled={!canSubmit}
          >
            {state === "loading"
              ? "Submitting…"
              : isBuildingPreview
                ? "Preparing…"
                : `Send ${selectedAsset}`}
          </Button>
        )}
      </div>

      <TransactionConfirmModal
        open={preview !== null}
        transaction={preview}
        isSigning={state === "loading"}
        onCancel={() => setPreview(null)}
        onConfirm={() => void submitTransaction()}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

function Select({ label, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId =
    id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[12px] font-medium text-ink-2"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "h-9 w-full rounded-lg border border-line bg-surface-2 px-3.5",
          "text-[13px] text-ink outline-none transition-colors",
          "focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

function explorerTxUrl(network: NetworkInfo | null, hash: string): string | null {
  if (!network) return null;
  const isTestnet =
    network.name === "testnet" ||
    (network.passphrase?.toLowerCase().includes("testnet") ?? false);
  const prefix = isTestnet
    ? "https://testnet.stellar.expert/explorer/public/tx/"
    : "https://stellar.expert/explorer/public/tx/";
  return `${prefix}${hash}`;
}
