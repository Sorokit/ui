import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { getClient, type TxResult } from "@/lib/client";

type State = "idle" | "loading" | "success" | "error";

export function TransactionPanel() {
  const { address, isConnected } = useSorokit();
  const [dest, setDest] = useState("");
  const [destDirty, setDestDirty] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountDirty, setAmountDirty] = useState(false);
  const [memo, setMemo] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<TxResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDestValid = /^G[A-Z2-7]{55}$/.test(dest.trim());
  const isSelfPayment = dest.trim() === address;
  const parsedAmount = parseFloat(amount);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount >= 0.0000001;

  const canSubmit =
    isConnected &&
    isDestValid &&
    amount.trim() !== "" &&
    isAmountValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) {
      setError("Wallet not connected");
      setState("error");
      return;
    }
    if (!canSubmit) return;
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const { data, error: err } = await getClient().transaction.submit({
        source: address,
        destination: dest.trim(),
        amount: amount.trim(),
        memo: memo.trim() || undefined,
        asset: "XLM",
      });
      if (err) {
        setError(err);
        setState("error");
        return;
      }
      setResult(data);
      setState("success");
      setDest("");
      setAmount("");
      setMemo("");
      setDestDirty(false);
      setAmountDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }

  const handleSendClick = () => {
    submit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
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
              <span data-txhash className="break-all leading-relaxed">
                {result.hash}
              </span>
              <Badge variant="success" dot>
                Successful
              </Badge>
            </div>
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
          <form onSubmit={submit} className="flex flex-col gap-5">
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
                    ? "Invalid Stellar address"
                    : isSelfPayment
                      ? "Destination is the same as your wallet address"
                      : undefined
                  : undefined
              }
              disabled={state === "loading"}
            />
            <Input
              label="Amount (XLM)"
              type="number"
              placeholder="0.00"
              min="0.0000001"
              step="0.0000001"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountDirty(true);
              }}
              error={
                amountDirty
                  ? amount.trim() === ""
                    ? "Amount is required"
                    : isNaN(parsedAmount) || parsedAmount <= 0
                      ? "Amount must be greater than 0"
                      : parsedAmount < 0.0000001
                        ? "Minimum amount is 0.0000001 XLM"
                        : undefined
                  : undefined
              }
              disabled={state === "loading"}
            />
            <Input
              label="Memo (optional)"
              placeholder="Text memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={state === "loading"}
            />
          </form>
        )}
      </div>

      <div className="px-6 py-4 border-t border-line flex items-center gap-3">
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
            size="md"
            loading={state === "loading"}
            disabled={!canSubmit}
            onClick={handleSendClick}
          >
            {state === "loading" ? "Submitting…" : "Send Payment"}
          </Button>
        )}
      </div>
    </div>
  );
}
