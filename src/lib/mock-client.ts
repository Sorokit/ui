import type {
  AccountData,
  AllowanceEntry,
  Balance,
  GasEstimate,
  GasPriceData,
  GroupedTransaction,
  InvokeParams,
  NetworkInfo,
  NetworkName,
  Operation,
  SorokitClient,
  TimelineGroup,
  TimelineParams,
  TxStatus,
} from "./client";
import { deterministicMock } from "./deterministic-mock";

// Valid Stellar testnet address (56 chars: G + 55 uppercase alphanumeric)
export const MOCK_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

// Generate deterministic mock data (consistent across test runs)
export const MOCK_HISTORY = deterministicMock.generateMockHistory(25);
export const MOCK_EVENTS = deterministicMock.generateMockEvents(3);

export const NETWORKS = {
  testnet: {
    passphrase: "Test SDF Network ; September 2015",
    rpc_url: "https://soroban-testnet.stellar.org",
  },
  public: {
    passphrase: "Public Global Stellar Network ; September 2015",
    rpc_url: "https://soroban.stellar.org",
  },
};

const MOCK_NETWORK_INFO: Record<string, NetworkInfo> = {
  testnet: {
    name: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    status: "online",
  },
  public: {
    name: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    status: "online",
  },
  mainnet: {
    name: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    status: "online",
  },
  futurenet: {
    name: "futurenet",
    passphrase: "Test SDF Future Network ; October 2022",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    status: "online",
  },
  localnet: {
    name: "localnet",
    passphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
    status: "online",
  },
};

const MOCK_ACCOUNT: AccountData = {
  address: MOCK_ADDRESS,
  sequence: "123456789",
  subentryCount: 0,
};

const MOCK_BALANCES: Balance[] = [
  { asset: "XLM", balance: "10000.0000000", assetType: "native" },
];

// ─── Mock Operations ──────────────────────────────────────────

function makeOperation(overrides: Partial<Operation>): Operation {
  const now = "2026-07-26T10:00:00Z";
  return {
    id: deterministicMock.generateHex(16),
    txHash: overrides.txHash ?? deterministicMock.generateTransactionHash(),
    type: overrides.type ?? "payment",
    source: overrides.source ?? MOCK_ADDRESS,
    destination:
      overrides.destination ??
      "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    amount: overrides.amount ?? "10.0000",
    asset: overrides.asset ?? "XLM",
    memo: overrides.memo,
    fee: overrides.fee ?? "100",
    success: overrides.success ?? true,
    createdAt: overrides.createdAt ?? now,
  };
}

function makeGroupedTransaction(
  overrides: Partial<GroupedTransaction>,
): GroupedTransaction {
  const hash = overrides.hash ?? deterministicMock.generateTransactionHash();
  return {
    hash,
    date: overrides.date ?? "2026-07-26",
    time: overrides.time ?? "10:30:45",
    type: overrides.type ?? "Payment",
    totalAmount: overrides.totalAmount ?? "10.0000 XLM",
    status: overrides.status ?? "success",
    operationCount: overrides.operationCount ?? 1,
    operations: overrides.operations ?? [
      makeOperation({ txHash: hash, type: "payment", amount: "10.0000" }),
    ],
  };
}

export const MOCK_TIMELINE_GROUPS: TimelineGroup[] = [
  {
    date: "2026-07-26",
    transactions: [
      makeGroupedTransaction({
        type: "Payment",
        totalAmount: "50.0000 XLM",
        operationCount: 1,
        operations: [
          makeOperation({ type: "payment", amount: "50.0000", asset: "XLM" }),
        ],
      }),
      makeGroupedTransaction({
        type: "Payment",
        totalAmount: "100.0000 USDC",
        operationCount: 2,
        operations: [
          makeOperation({ type: "payment", amount: "50.0000", asset: "USDC" }),
          makeOperation({ type: "payment", amount: "50.0000", asset: "USDC" }),
        ],
      }),
    ],
  },
  {
    date: "2026-07-25",
    transactions: [
      makeGroupedTransaction({
        type: "Trade",
        totalAmount: "200.0000 XLM",
        operationCount: 1,
        operations: [
          makeOperation({
            type: "trade",
            amount: "200.0000",
            asset: "XLM",
            success: true,
          }),
        ],
      }),
      makeGroupedTransaction({
        type: "Change Trust",
        totalAmount: "0.0000 USD",
        status: "success",
        operationCount: 1,
        operations: [
          makeOperation({
            type: "change_trust",
            amount: "0.0000",
            asset: "USD",
            success: true,
          }),
        ],
      }),
    ],
  },
  {
    date: "2026-07-24",
    transactions: [
      makeGroupedTransaction({
        type: "Payment",
        totalAmount: "5.0000 XLM",
        status: "failed",
        operationCount: 1,
        operations: [
          makeOperation({
            type: "payment",
            amount: "5.0000",
            asset: "XLM",
            success: false,
          }),
        ],
      }),
    ],
  },
];

// ─── Allowances ────────────────────────────────────────────────
const MOCK_ALLOWANCES: AllowanceEntry[] = [
  {
    asset: "USDC",
    spender: "CAIBNITKJZ2P2H3XJ2VW2YOX4X3JQBQ3F6VXZ4X3J2Q3X4X3J2Q3X4",
    spenderName: "DeFi Protocol",
    amount: "500.00",
    expirationDate: "2026-12-31T23:59:59Z",
    tokenCode: "USDC",
    tokenIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KZVN",
  },
  {
    asset: "USDC",
    spender: "CBBFQT3LBZ2RB6Q3XJY5V6XJY5V6XJY5V6XJY5V6XJY5V6XJY5V6",
    spenderName: "Lending Pool",
    amount: "1000.00",
    expirationDate: "",
    tokenCode: "USDC",
    tokenIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KZVN",
  },
  {
    asset: "XLM",
    spender: "CBBFQT3LBZ2RB6Q3XJY5V6XJY5V6XJY5V6XJY5V6XJY5V6XJY5V6",
    spenderName: "Staking Contract",
    amount: "200.00",
    expirationDate: "2025-06-30T00:00:00Z",
    tokenCode: undefined,
    tokenIssuer: undefined,
  },
];

/**
 * Mock Strategy:
 * 
 * Provides a canonical, standalone implementation of SorokitClient for development,
 * demo mode (in main.tsx), and component/screen unit testing.
 * 
 * Design:
 * - Single source of truth for mock blockchain data across the entire repository.
 * - Instance-scoped state: Each invocation of createMockClient() creates an independent
 *   instance with its own network and connection state, preventing test cross-contamination.
 * - Proper pagination support: getHistory slices deterministic transaction records by
 *   page and limit, providing distinct pages and accurate total count for TransactionHistory.
 */
export function createMockClient(): SorokitClient;
export function createMockClient(
  networkName: string,
): SorokitClient | { data: null; error: string };
export function createMockClient(
  networkName?: string,
): SorokitClient | { data: null; error: string } {
  let activeNetwork =
    networkName && networkName in NETWORKS ? networkName : "testnet";
  const connectedAddress = MOCK_ADDRESS;

  if (networkName && !(networkName in NETWORKS)) {
    const validNetworks = Object.keys(NETWORKS).join(", ");
    return {
      data: null,
      error: `Unknown network: ${networkName}. Valid networks: ${validNetworks}`,
    };
  }

  return {
    wallet: {
      connect: async () => ({
        data: { address: connectedAddress },
        error: null,
        status: "success" as const,
      }),
      disconnect: async () => {},
      getAddress: async () => ({ data: connectedAddress, error: null }),
    },
    account: {
      getAccount: async () => ({
        data: MOCK_ACCOUNT,
        error: null,
        status: "success" as const,
      }),
      getBalances: async () => ({ data: MOCK_BALANCES, error: null }),
      getClaimableBalances: async () => ({ data: [], error: null }),
      claimBalance: async () => ({ data: null, error: null }),
    },
    transaction: {
      submit: async () => ({
        data: {
          hash: deterministicMock.generateTransactionHash(),
          ledger: 12345,
          successful: true,
        },
        error: null,
        status: "success" as const,
      }),
      getStatus: async () => ({ data: "success" as TxStatus, error: null }),
      getHistory: async (
        _address: string,
        page: number = 1,
        limit?: number,
      ) => {
        const safePage = Math.max(1, page || 1);
        const pageSize =
          limit !== undefined && limit > 0 ? limit : MOCK_HISTORY.length;
        const total = MOCK_HISTORY.length;
        const start = (safePage - 1) * pageSize;
        const end = start + pageSize;
        const history = MOCK_HISTORY.slice(start, end);
        return { data: history, error: null, total };
      },
      estimateFee: async () => ({
        data: { baseFee: "100", recommended: "1000" },
        error: null,
      }),
      estimateDetailedFee: async (params: {
        operations: string[];
        feeMultiplier?: number;
      }) => {
        const multiplier = params.feeMultiplier ?? 1;
        const breakdown = params.operations.map((op) => {
          const gasUnits =
            op === "payment"
              ? 100
              : op === "manage_data"
                ? 200
                : op === "change_trust"
                  ? 300
                  : 150;
          const baseFee = 100;
          const feeStroops = String(
            Math.round(gasUnits * baseFee * multiplier),
          );
          const feeXlm = (parseFloat(feeStroops) / 10_000_000).toFixed(7);
          return {
            operationType: op,
            gasUnits,
            feeStroops,
            feeXlm,
          };
        });
        const totalGasUnits = breakdown.reduce((sum, b) => sum + b.gasUnits, 0);
        const scenarios: GasEstimate["scenarios"] = [
          {
            label: "low",
            gasPrice: String(Math.round(100 * multiplier * 0.5)),
            totalFeeStroops: String(
              Math.round(totalGasUnits * 100 * multiplier * 0.5),
            ),
            totalFeeXlm: (
              Math.round(totalGasUnits * 100 * multiplier * 0.5) / 10_000_000
            ).toFixed(7),
            savings: "50%",
          },
          {
            label: "average",
            gasPrice: String(Math.round(100 * multiplier)),
            totalFeeStroops: String(
              Math.round(totalGasUnits * 100 * multiplier),
            ),
            totalFeeXlm: (
              Math.round(totalGasUnits * 100 * multiplier) / 10_000_000
            ).toFixed(7),
            savings: "0%",
          },
          {
            label: "high",
            gasPrice: String(Math.round(100 * multiplier * 2)),
            totalFeeStroops: String(
              Math.round(totalGasUnits * 100 * multiplier * 2),
            ),
            totalFeeXlm: (
              Math.round(totalGasUnits * 100 * multiplier * 2) / 10_000_000
            ).toFixed(7),
            savings: "-100%",
          },
        ];
        return {
          data: {
            totalGasUnits,
            breakdown,
            scenarios,
            customMultiplier: multiplier,
          } as GasEstimate,
          error: null,
        };
      },
      getFeeScenarios: async (_params: {
        operations: string[];
        baseGasUnits: number;
      }) => {
        const scenarios = [
          {
            label: "low" as const,
            gasPrice: "50",
            totalFeeStroops: "5000",
            totalFeeXlm: "0.0005000",
            savings: "50%",
          },
          {
            label: "average" as const,
            gasPrice: "100",
            totalFeeStroops: "10000",
            totalFeeXlm: "0.0010000",
            savings: "0%",
          },
          {
            label: "high" as const,
            gasPrice: "200",
            totalFeeStroops: "20000",
            totalFeeXlm: "0.0020000",
            savings: "-100%",
          },
        ];
        return { data: scenarios, error: null };
      },
    },
    soroban: {
      invokeContract: async (_params: InvokeParams) => ({
        data: {
          success: true,
          result: { status: "ok", output: "mock-invoke-output" },
          txHash: deterministicMock.generateTransactionHash(),
        },
        error: null,
        status: "success" as const,
      }),
      simulateContract: async (_params: InvokeParams) => ({
        data: { simulated: true, result: "simulated-output" },
        error: null,
        status: "success" as const,
      }),
      getEvents: async (
        _contractId: string,
        _limit?: number,
        fromLedger?: number,
      ) => ({
        data:
          fromLedger !== undefined
            ? MOCK_EVENTS.filter((e) => e.ledger >= fromLedger)
            : MOCK_EVENTS,
        error: null,
      }),
    },
    network: {
      getNetwork: async () => ({
        data: MOCK_NETWORK_INFO[activeNetwork],
        error: null,
      }),
      switchNetwork: async (param: NetworkName | NetworkInfo) => {
        if (typeof param === "object" && param !== null) {
          activeNetwork = param.name;
          return { data: { status: "online", ...param }, error: null };
        }
        const info = MOCK_NETWORK_INFO[param];
        if (info) {
          activeNetwork = param;
          return { data: info, error: null };
        }
        return { data: null, error: `Invalid network: ${param}` };
      },
      getGasPrice: async () => ({
        data: {
          baseFee: "100",
          gasPrice: "100",
          ledgerCloseTime: 5,
          baseReserve: "0.5",
        } as GasPriceData,
        error: null,
      }),
    },
    nft: {
      getNfts: async (_address: string) => ({ data: [], error: null }),
      sendNft: async () => ({
        data: {
          hash: deterministicMock.generateTransactionHash(),
          ledger: 12345,
          successful: true,
        },
        error: null,
      }),
      listNftForSale: async () => ({
        data: {
          hash: deterministicMock.generateTransactionHash(),
          ledger: 12345,
          successful: true,
        },
        error: null,
      }),
    },
    operation: {
      getOperations: async (txHash: string) => {
        const ops = MOCK_TIMELINE_GROUPS.flatMap((g) =>
          g.transactions.flatMap((tx) =>
            tx.operations.filter((op) => op.txHash === txHash),
          ),
        );
        return { data: ops.length > 0 ? ops : null, error: null };
      },
      getTimeline: async (params: TimelineParams) => {
        const { page = 1, limit = 10, filters } = params;
        let filtered = [...MOCK_TIMELINE_GROUPS];
        if (filters?.operationType && filters.operationType !== "all") {
          filtered = filtered
            .map((g) => ({
              ...g,
              transactions: g.transactions.filter((tx) =>
                tx.operations.some((op) =>
                  op.type.toLowerCase().includes(filters.operationType!),
                ),
              ),
            }))
            .filter((g) => g.transactions.length > 0);
        }
        if (filters?.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          filtered = filtered
            .map((g) => ({
              ...g,
              transactions: g.transactions.filter(
                (tx) =>
                  tx.hash.toLowerCase().includes(q) ||
                  tx.operations.some(
                    (op) =>
                      op.source.toLowerCase().includes(q) ||
                      op.destination.toLowerCase().includes(q),
                  ),
              ),
            }))
            .filter((g) => g.transactions.length > 0);
        }
        if (filters?.dateFrom) {
          filtered = filtered.filter((g) => g.date >= filters.dateFrom!);
        }
        if (filters?.dateTo) {
          filtered = filtered.filter((g) => g.date <= filters.dateTo!);
        }
        const total = filtered.reduce(
          (sum, g) => sum + g.transactions.length,
          0,
        );
        const start = (page - 1) * limit;
        const end = start + limit;
        const paged = filtered.slice(start, end);
        return { data: paged.length > 0 ? paged : null, error: null, total };
      },
    },
    allowance: {
      getAllowances: async (_address: string) => ({
        data: MOCK_ALLOWANCES,
        error: null,
      }),
      approveAllowance: async (_params: {
        sourceAccount: string;
        asset: string;
        spender: string;
        amount: string;
      }) => ({
        data: {
          hash: deterministicMock.generateTransactionHash(),
          ledger: 12345,
          successful: true,
        },
        error: null,
        status: "success" as const,
      }),
      revokeAllowance: async (_params: {
        sourceAccount: string;
        asset: string;
        spender: string;
      }) => ({
        data: {
          hash: deterministicMock.generateTransactionHash(),
          ledger: 12345,
          successful: true,
        },
        error: null,
        status: "success" as const,
      }),
      estimateAllowanceFee: async (_params: {
        asset: string;
        spender: string;
        amount: string;
        mode: "increase" | "decrease" | "revoke";
      }) => ({
        data: { baseFee: "100", recommended: "1000" },
        error: null,
      }),
    },
    batch: {
      submitBatch: async () => ({
        data: null,
        error: null,
        batchId: "batch-mock-123",
      }),
      getBatchStatus: async () => ({
        data: null,
        error: null,
      }),
      cancelBatch: async () => ({
        data: true,
        error: null,
      }),
      retryEntry: async () => ({
        data: null,
        error: null,
      }),
    },
  } as SorokitClient;
}
