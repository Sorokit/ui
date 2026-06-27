import { SorokitClient, NetworkInfo, NetworkName, Balance, AccountData, Transaction, ClaimableBalance, ContractEvent } from './client';
import { deterministicMock } from './deterministic-mock';

// Valid Stellar testnet address (56 characters)
export const MOCK_ADDRESS = 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHP2';

// Generate deterministic mock data (consistent across test runs)
export const MOCK_HISTORY = deterministicMock.generateMockHistory(5);
export const MOCK_EVENTS = deterministicMock.generateMockEvents(3);

export const NETWORKS = {
  testnet: {
    name: 'testnet' as NetworkName,
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    rpc_url: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  public: {
    name: 'public' as NetworkName,
    passphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://soroban.stellar.org',
    rpc_url: 'https://soroban.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
  },
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_BALANCES: Balance[] = [
  { asset: "XLM", balance: "1042.5000000", assetType: "native" },
  {
    asset: "USDC:GBBD47R2HS7ND75YJMY7HO37SLT6C5QIS2S5SQ6O6ZC472J3OEXNBQQ7",
    balance: "420.0000000",
    assetType: "credit_alphanum4",
    assetCode: "USDC",
    assetIssuer: "GBBD47R2HS7ND75YJMY7HO37SLT6C5QIS2S5SQ6O6ZC472J3OEXNBQQ7",
  },
];

const MOCK_ACCOUNT: AccountData = {
  address: MOCK_ADDRESS,
  sequence: "1234567890",
  subentryCount: 2,
};

const MOCK_CLAIMABLE: ClaimableBalance[] = [
  {
    id: "00000000ae3f29b8c...",
    asset: "USDC",
    amount: "100.0000000",
    sponsor: "GDMT...",
    claimants: [{ destination: MOCK_ADDRESS, predicate: {} }],
  },
];

/**
 * Create mock client with proper error handling and full SorokitClient interface
 * @param networkName - Network identifier
 * @returns Mock contract instance with error handling
 */
export function createMockClient(networkName?: string): SorokitClient & { data: any; error: string | null } {
  // Validate network name
  if (networkName && !(networkName in NETWORKS)) {
    const validNetworks = Object.keys(NETWORKS).join(', ');
    return {
      data: null,
      error: `Unknown network: ${networkName}. Valid networks: ${validNetworks}`,
    } as any;
  }

  let currentNetwork = networkName 
    ? NETWORKS[networkName as keyof typeof NETWORKS] 
    : NETWORKS.testnet;

  let connectedAddress: string | null = MOCK_ADDRESS;

  const client = {
    wallet: {
      connect: async () => {
        await delay(50);
        connectedAddress = MOCK_ADDRESS;
        return {
          data: { address: MOCK_ADDRESS },
          error: null,
          status: "success" as const,
        };
      },
      disconnect: async () => {
        await delay(50);
        connectedAddress = null;
      },
      getAddress: async () => ({ data: connectedAddress, error: null }),
    },

    account: {
      getAccount: async () => {
        await delay(50);
        return { data: MOCK_ACCOUNT, error: null, status: "success" };
      },
      getBalances: async () => {
        await delay(50);
        return { data: MOCK_BALANCES, error: null };
      },
      getClaimableBalances: async () => {
        await delay(50);
        return { data: MOCK_CLAIMABLE, error: null };
      },
      claimBalance: async () => {
        await delay(50);
        return {
          data: { hash: "0x" + deterministicMock.generateHex(64), ledger: 48291036, successful: true },
          error: null,
        };
      },
    },

    transaction: {
      submit: async () => {
        await delay(50);
        return {
          data: { hash: "0x" + deterministicMock.generateHex(64), ledger: 48291034, successful: true },
          error: null,
          status: "success",
        };
      },
      getStatus: async () => {
        await delay(50);
        return { data: "success" as const, error: null };
      },
      getHistory: async (_address: string, page = 1, limit = 10) => {
        await delay(50);
        const start = (page - 1) * limit;
        return {
          data: MOCK_HISTORY.slice(start, start + limit) as any[],
          error: null,
          total: MOCK_HISTORY.length,
        };
      },
      estimateFee: async () => {
        await delay(50);
        return { data: { baseFee: "100", recommended: "200" }, error: null };
      },
    },

    soroban: {
      invokeContract: async (params: any) => {
        await delay(50);
        return {
          data: {
            result: `Invoked ${params.method} on ${params.contractId.slice(0, 12)}...`,
            ledger: 48291035,
            returnValue: "AAAABQAAAAAAAAAAAAAAAAAAAAo=",
          },
          error: null,
          status: "success",
        };
      },
      getEvents: async () => {
        await delay(50);
        return { data: MOCK_EVENTS as any[], error: null };
      },
    },

    network: {
      getNetwork: async () => {
        await delay(50);
        return { data: currentNetwork as any, error: null };
      },
      switchNetwork: async (name: NetworkName) => {
        await delay(50);
        if (!NETWORKS[name as keyof typeof NETWORKS]) {
          return { data: null, error: `Invalid network: ${name}` };
        }
        currentNetwork = NETWORKS[name as keyof typeof NETWORKS];
        return { data: currentNetwork as any, error: null };
      },
    },

    // Compatibility fields for tests expecting direct data/error properties
    data: {
      network: currentNetwork,
      address: MOCK_ADDRESS,
      history: MOCK_HISTORY,
      events: MOCK_EVENTS,
    },
    error: null as string | null,
  };

  return client;
}
