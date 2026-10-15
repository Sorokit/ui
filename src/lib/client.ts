/**
 * sorokit-core client singleton
 *
 * All UI components must use this module to access blockchain functionality.
 * No direct blockchain logic lives in the UI -- everything goes through sorokit-core.
 */

/** Parameters accepted by the transaction submission endpoint. */
export interface TransactionParams {
  source: string;
  destination: string;
  amount: string;
  asset: string;
  /** Issuer account for a non-native asset. Omitted (or undefined) for XLM. */
  assetIssuer?: string;
  memoType: "none" | "text" | "id";
  memo?: string;
}

/** Result status shared by async client methods that return a request state. */
export type RequestStatus = "idle" | "loading" | "success" | "error";

/** A Soroban XDR value produced by @stellar/stellar-sdk. */
export type SorobanScVal = object;

/** Values representable in JSON responses from the Soroban API. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type GasPriceData = {
  baseFee: string;
  gasPrice: string;
  ledgerCloseTime: number;
  baseReserve: string;
};

export type OperationGasBreakdown = {
  operationType: string;
  gasUnits: number;
  feeStroops: string;
  feeXlm: string;
};

export type FeeScenario = {
  label: "low" | "average" | "high";
  gasPrice: string;
  totalFeeStroops: string;
  totalFeeXlm: string;
  savings: string;
};

/** Soroban resources a simulated transaction consumed (from simulateTransaction). */
export type SorobanResourceUsage = {
  cpuInstructions?: number;
  memoryBytes?: number;
  readBytes?: number;
  writeBytes?: number;
};

export type GasEstimate = {
  totalGasUnits: number;
  breakdown: OperationGasBreakdown[];
  scenarios: FeeScenario[];
  customMultiplier: number;
  /** Simulated resource usage; absent for classic (non-Soroban) operations. */
  resources?: SorobanResourceUsage;
};

export type SorokitClient = {
  wallet: {
    connect: () => Promise<{
      data: { address: string } | null;
      error: string | null;
      status: RequestStatus;
    }>;
    disconnect: () => Promise<void>;
    getAddress: () => Promise<{ data: string | null; error: string | null }>;
  };
  account: {
    getAccount: (
      address: string,
    ) => Promise<{
      data: AccountData | null;
      error: string | null;
      status: RequestStatus;
    }>;
    getBalances: (
      address: string,
    ) => Promise<{ data: Balance[] | null; error: string | null }>;
    getClaimableBalances: (
      address: string,
    ) => Promise<{ data: ClaimableBalance[] | null; error: string | null }>;
    claimBalance: (
      balanceId: string,
    ) => Promise<{ data: TxResult | null; error: string | null }>;
  };
  transaction: {
    submit: (
      tx: TransactionParams,
    ) => Promise<{
      data: TxResult | null;
      error: string | null;
      status: RequestStatus;
    }>;
    getStatus: (
      txHash: string,
    ) => Promise<{ data: TxStatus | null; error: string | null }>;
    getHistory: (
      address: string,
      page?: number,
      limit?: number,
    ) => Promise<{
      data: Transaction[] | null;
      error: string | null;
      total: number;
    }>;
    estimateFee: () => Promise<{
      data: { baseFee: string; recommended: string } | null;
      error: string | null;
    }>;
    estimateDetailedFee: (params: {
      operations: string[];
      feeMultiplier?: number;
    }) => Promise<{
      data: GasEstimate | null;
      error: string | null;
    }>;
    getFeeScenarios: (params: {
      operations: string[];
      baseGasUnits: number;
    }) => Promise<{
      data: FeeScenario[] | null;
      error: string | null;
    }>;
  };
  soroban: {
    invokeContract: (
      params: InvokeParams,
    ) => Promise<{ data: unknown; error: string | null; status: RequestStatus }>;
    simulateContract: (
      params: InvokeParams,
    ) => Promise<{ data: unknown; error: string | null; status: RequestStatus }>;
    getEvents: (
      contractId: string,
      limit?: number,
      fromLedger?: number,
    ) => Promise<{ data: ContractEvent[] | null; error: string | null }>;
  };
  network: {
    getNetwork: () => Promise<{
      data: NetworkInfo | null;
      error: string | null;
    }>;
    switchNetwork: (
      network: NetworkName | NetworkInfo,
    ) => Promise<{ data: NetworkInfo | null; error: string | null }>;
    getGasPrice: () => Promise<{
      data: GasPriceData | null;
      error: string | null;
    }>;
  };
  nft: {
    getNfts: (
      address: string,
    ) => Promise<{ data: Nft[] | null; error: string | null }>;
    sendNft: (params: {
      tokenId: string;
      contractId: string;
      recipient: string;
      sourceAccount: string;
    }) => Promise<{ data: TxResult | null; error: string | null }>;
    listNftForSale: (params: {
      tokenId: string;
      contractId: string;
      price: string;
      sourceAccount: string;
    }) => Promise<{ data: TxResult | null; error: string | null }>;
  };
  operation: {
    getOperations: (
      txHash: string,
    ) => Promise<{
      data: Operation[] | null;
      error: string | null;
    }>;
    getTimeline: (
      params: TimelineParams,
    ) => Promise<{
      data: TimelineGroup[] | null;
      error: string | null;
      total: number;
    }>;
  };
  allowance: {
    getAllowances: (
      address: string,
    ) => Promise<{
      data: AllowanceEntry[] | null;
      error: string | null;
    }>;
    approveAllowance: (params: {
      sourceAccount: string;
      asset: string;
      spender: string;
      amount: string;
    }) => Promise<{
      data: TxResult | null;
      error: string | null;
      status: RequestStatus;
    }>;
    revokeAllowance: (params: {
      sourceAccount: string;
      asset: string;
      spender: string;
    }) => Promise<{
      data: TxResult | null;
      error: string | null;
      status: RequestStatus;
    }>;
    estimateAllowanceFee: (params: {
      asset: string;
      spender: string;
      amount: string;
      mode: "increase" | "decrease" | "revoke";
    }) => Promise<{
      data: { baseFee: string; recommended: string } | null;
      error: string | null;
    }>;
  };
  batch: {
    submitBatch: (params: {
      entries: BatchEntry[];
      sourceAccount: string;
      asset?: string;
      maxRetries?: number;
    }) => Promise<{
      data: BatchResult | null;
      error: string | null;
      batchId: string;
    }>;
    getBatchStatus: (batchId: string) => Promise<{
      data: BatchProgress | null;
      error: string | null;
    }>;
    cancelBatch: (batchId: string) => Promise<{
      data: boolean;
      error: string | null;
    }>;
    retryEntry: (params: {
      batchId: string;
      entryIndex: number;
    }) => Promise<{
      data: BatchEntryResult | null;
      error: string | null;
    }>;
  };
};

export type AccountData = {
  address: string;
  sequence: string;
  subentryCount: number;
  thresholds?: { low: number; med: number; high: number; master: number };
  homeDomain?: string;
  createdAt?: string;
};

export type Balance = {
  asset: string;
  balance: string;
  assetType:
    | "native"
    | "credit_alphanum4"
    | "credit_alphanum12"
    | "liquidity_pool_shares";
  assetCode?: string;
  assetIssuer?: string;
};

export type TxResult = {
  hash: string;
  ledger: number;
  successful: boolean;
};

export type TxStatus = "pending" | "success" | "failed" | "not_found";

export type Transaction = {
  hash: string;
  ledger: number;
  createdAt: string;
  successful: boolean;
  operationCount: number;
  feePaid: string;
  memo?: string;
  operationType?: string;
  type?: string;
  contractId?: string;
};

export type ClaimableBalance = {
  id: string;
  asset: string;
  amount: string;
  sponsor: string;
  claimants: { destination: string; predicate: unknown }[];
};

export type ContractEvent = {
  id: string;
  contractId: string;
  type: string;
  ledger: number;
  createdAt: string;
  topics: string[];
  value: JsonValue;
};

export type InvokeParams = {
  contractId: string;
  method: string;
  /**
   * Soroban arguments may be XDR ScVal values from @stellar/stellar-sdk.
   * unknown[] is also supported for adapters that serialize arguments later.
   */
  args?: SorobanScVal[] | unknown[];
  sourceAccount?: string;
};

export type NetworkName = "mainnet" | "testnet" | "futurenet" | "localnet" | "custom" | (string & {});

export type NetworkInfo = {
  name: NetworkName;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  ledger?: number;
  status?: "online" | "degraded" | "offline" | string;
};

// ─── Allowance Types ───────────────────────────────────────────────────

export type AllowanceEntry = {
  asset: string;
  spender: string;
  spenderName?: string;
  amount: string;
  expirationDate?: string;
  /** Soroban ledger sequence at which the allowance expires (issue #650). */
  expirationLedger?: number;
  tokenCode?: string;
  tokenIssuer?: string;
};

export type AllowanceChangeParams = {
  asset: string;
  spender: string;
  amount: string;
  mode: "increase" | "decrease" | "revoke";
};

// ─── Batch Payment Types ──────────────────────────────────────────

export type BatchEntry = {
  address: string;
  amount: string;
  asset?: string;
  memo?: string;
};

export type BatchEntryResult = {
  address: string;
  amount: string;
  status: "queued" | "signing" | "submitted" | "confirmed" | "failed";
  txHash?: string;
  error?: string;
  retryCount: number;
};

export type BatchResult = {
  batchId: string;
  totalEntries: number;
  successful: number;
  failed: number;
  entries: BatchEntryResult[];
};

export type BatchProgress = {
  batchId: string;
  completed: number;
  total: number;
  failed?: number;
  percentage: number;
  etaSeconds?: number;
  currentStatus?: BatchEntryResult["status"];
  status?: "idle" | "processing" | "paused" | "completed" | "error" | "cancelled" | string;
};

// ─── NFT Types ────────────────────────────────────────────────────────────────

export type NftAttribute = {
  traitType: string;
  value: string;
  /** Rarity as a percentage (0–100). Optional — may not be available for all NFTs. */
  rarityPct?: number;
};

export type NftMetadata = {
  name: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  attributes: NftAttribute[];
};

export type Nft = {
  /** Unique token identifier (contract + token_id combo) */
  id: string;
  tokenId: string;
  contractId: string;
  collectionName: string;
  collectionId: string;
  metadata: NftMetadata;
  owner: string;
  /** Floor price in XLM */
  floorPrice?: string;
  /** User's estimated valuation in XLM */
  userValuation?: string;
  /** Rarity rank within the collection (lower is rarer) */
  rarityRank?: number;
  /** Total supply of the collection */
  collectionSize?: number;
  mintedAt?: string;
};

export type NftCollection = {
  id: string;
  name: string;
  contractId: string;
  description?: string;
  image?: string;
  floorPrice?: string;
  totalSupply?: number;
  nfts: Nft[];
};

// ─── Activity Timeline Types ──────────────────────────────────────────

export type Operation = {
  id: string;
  txHash: string;
  type: string;
  source: string;
  destination: string;
  amount: string;
  asset: string;
  memo?: string;
  fee: string;
  success: boolean;
  createdAt: string;
};

export type GroupedTransaction = {
  hash: string;
  date: string;
  time: string;
  type: string;
  totalAmount: string;
  status: "success" | "failed";
  operationCount: number;
  operations: Operation[];
};

export type TimelineGroup = {
  date: string;
  transactions: GroupedTransaction[];
};

export type TimelineFilter = {
  operationType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
};

export type TimelineParams = {
  address: string;
  page?: number;
  limit?: number;
  filters?: TimelineFilter;
};

let _client: SorokitClient | null = null;

export function initClient(client: SorokitClient): void {
  _client = client;
}

export function hasClient(): boolean {
  return _client !== null;
}

export function getClient(): SorokitClient {
  if (!_client)
    throw new Error(
      "[sorokit-ui] Client not initialized. Call initClient(createSorokitClient()) first.",
    );
  return _client;
}

export const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);
export const DEFAULT_RPC_MAX_RETRIES = 3;
export const DEFAULT_RPC_BASE_DELAY_MS = 300;

const HORIZON_OP_CODE_MESSAGES: Record<string, string> = {
  op_underfunded: "Insufficient balance to fund this operation (op_underfunded).",
  op_bad_auth: "Invalid signature or missing signer weight for this operation (op_bad_auth).",
  op_no_destination: "Destination account does not exist on the network (op_no_destination).",
  op_no_trust: "Account is missing a trustline for the specified asset (op_no_trust).",
  op_line_full: "Destination trustline limit would be exceeded (op_line_full).",
  tx_bad_seq: "Transaction sequence number does not match the account (tx_bad_seq).",
  tx_bad_auth: "Transaction authentication failed (tx_bad_auth).",
  tx_insufficient_fee: "Transaction fee is below the network minimum (tx_insufficient_fee).",
  tx_insufficient_balance: "Account balance cannot cover the fee and reserve (tx_insufficient_balance).",
};

export interface HorizonErrorPayload {
  status?: number;
  title?: string;
  detail?: string;
  extras?: {
    result_codes?: {
      transaction?: string;
      operations?: string[];
    };
  };
}

export interface DecodedHorizonError {
  message: string;
  transactionCode: string | null;
  operationCodes: string[];
}

/**
 * Decode a Horizon error response, extracting both top-level `detail` and
 * `extras.result_codes` (`transaction` and `operations` codes) into an
 * actionable message.
 */
export function decodeHorizonError(error: unknown): DecodedHorizonError {
  if (error && typeof error === "object") {
    const payload = error as HorizonErrorPayload;
    const txCode = payload.extras?.result_codes?.transaction ?? null;
    const opCodes = Array.isArray(payload.extras?.result_codes?.operations)
      ? payload.extras!.result_codes!.operations!
      : [];

    const descriptions: string[] = [];
    if (txCode) {
      descriptions.push(HORIZON_OP_CODE_MESSAGES[txCode] ?? `Transaction error: ${txCode}`);
    }
    for (const op of opCodes) {
      if (op && op !== "op_success") {
        descriptions.push(HORIZON_OP_CODE_MESSAGES[op] ?? `Operation error: ${op}`);
      }
    }

    const baseDetail = payload.detail || payload.title || "Horizon request failed";
    const message =
      descriptions.length > 0
        ? `${baseDetail} — ${descriptions.join(" ")}`
        : baseDetail;

    return {
      message,
      transactionCode: txCode,
      operationCodes: opCodes,
    };
  }

  const fallback = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return {
    message: fallback,
    transactionCode: null,
    operationCodes: [],
  };
}

export interface RpcRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  jitterRatio?: number;
  randomFn?: () => number;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => Promise<void> | void;
}

function isTransientRpcError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const status = (error as { status?: number; statusCode?: number }).status ??
      (error as { statusCode?: number }).statusCode;
    if (typeof status === "number" && RETRYABLE_HTTP_STATUSES.has(status)) {
      return true;
    }
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(429|502|503|504|rate limit|service unavailable|bad gateway|gateway timeout|network dropout|econnreset|etimedout)\b/i.test(
    msg,
  );
}

/**
 * Execute an async RPC operation with automatic retries, exponential backoff,
 * and jitter for transient HTTP 429, 502, 503, and 504 errors.
 */
export async function withRpcRetry<T>(
  operation: () => Promise<T>,
  options: RpcRetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_RPC_MAX_RETRIES,
    baseDelayMs = DEFAULT_RPC_BASE_DELAY_MS,
    jitterRatio = 0.2,
    randomFn = Math.random,
    onRetry,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= maxRetries || !isTransientRpcError(err)) {
        throw err;
      }
      attempt += 1;
      const expDelay = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.round(expDelay * jitterRatio * randomFn());
      const delayMs = expDelay + jitter;
      if (onRetry) {
        await onRetry(attempt, delayMs, err);
      } else {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}

/**
 * Soroban RPC wrapper that applies exponential-backoff retries on transient
 * HTTP 429/502/503/504 failures and decodes Horizon operation error codes.
 */
export class SorobanClient {
  constructor(
    private readonly transport: {
      request: <T>(method: string, params?: unknown) => Promise<T>;
    },
    private readonly retryOptions: RpcRetryOptions = {},
  ) {}

  async call<T>(method: string, params?: unknown): Promise<T> {
    try {
      return await withRpcRetry(
        () => this.transport.request<T>(method, params),
        this.retryOptions,
      );
    } catch (err) {
      const decoded = decodeHorizonError(err);
      throw new Error(decoded.message);
    }
  }
}
