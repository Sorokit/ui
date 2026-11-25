import type { Balance, Operation, SorokitClient } from "@/lib/client";

const HISTORY_PAGE_SIZE = 200;

/** Normalises an asset identifier so balances and operations share one key. */
export function assetKey(asset: string): string {
  if (!asset || asset.toLowerCase() === "native") return "XLM";
  return asset.split(":")[0];
}

export function balanceAssetKey(balance: Balance): string {
  if (balance.assetType === "native") return "XLM";
  return assetKey(balance.assetCode ?? balance.asset);
}

/** How an operation moved value relative to `address`; null when it did not. */
export function operationDirection(
  op: Operation,
  address: string,
): "in" | "out" | null {
  const amount = Number(op.amount);
  if (!op.success || !Number.isFinite(amount) || amount <= 0) return null;
  if (op.source === op.destination) return null;
  if (op.destination === address) return "in";
  if (op.source === address) return "out";
  return null;
}

/**
 * Loads every successful operation for an account, oldest first. Any failed
 * request rejects: a partial history would silently produce wrong balances
 * and cost basis.
 */
export async function fetchAccountOperations(
  client: SorokitClient,
  address: string,
): Promise<Operation[]> {
  const hashes: string[] = [];
  let page = 1;
  while (true) {
    const { data, error, total } = await client.transaction.getHistory(
      address,
      page,
      HISTORY_PAGE_SIZE,
    );
    if (error) throw new Error(error);
    const batch = data ?? [];
    hashes.push(...batch.filter((tx) => tx.successful).map((tx) => tx.hash));
    const seen = (page - 1) * HISTORY_PAGE_SIZE + batch.length;
    if (batch.length < HISTORY_PAGE_SIZE || seen >= total) break;
    page += 1;
  }

  const operations: Operation[] = [];
  for (const hash of new Set(hashes)) {
    const { data, error } = await client.operation.getOperations(hash);
    if (error) throw new Error(error);
    operations.push(...(data ?? []));
  }
  return operations.sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}
