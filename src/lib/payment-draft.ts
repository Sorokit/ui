import type { Transaction } from "@/lib/client";
import { validateStellarAddress } from "@/lib/utils";

export type PaymentDraft = { destination: string; amount: string; asset: string };

/** Only repeat payments that are known to be outgoing, single-operation transfers. */
export function paymentDraft(tx: Transaction, address: string | null | undefined): PaymentDraft | null {
  if (!tx.successful || !address || tx.source !== address || tx.operationCount !== 1 ||
      !tx.destination || !validateStellarAddress(tx.destination) ||
      !tx.amount || !/^\d+(\.\d{1,7})?$/.test(tx.amount) || Number(tx.amount) <= 0 ||
      tx.asset !== "XLM") return null;

  return { destination: tx.destination, amount: tx.amount, asset: tx.asset };
}