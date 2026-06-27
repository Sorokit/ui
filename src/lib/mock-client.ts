import { deterministicMock } from './deterministic-mock';

import type {
  AccountData,
  Balance,
  ClaimableBalance,
  ContractEvent,
  NetworkInfo,
  SorokitClient,
  Transaction,
} from "./client";

// Valid Stellar testnet address
export const MOCK_ADDRESS = 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHP';

// Generate deterministic mock data (consistent across test runs)
export const MOCK_HISTORY = deterministicMock.generateMockHistory(5);
export const MOCK_EVENTS = deterministicMock.generateMockEvents(3);

export const NETWORKS = {
  testnet: {
    passphrase: 'Test SDF Network ; September 2015',
    rpc_url: 'https://soroban-testnet.stellar.org',
  },
  public: {
    passphrase: 'Public Global Stellar Network ; September 2015',
    rpc_url: 'https://soroban.stellar.org',
  },
};

/**
 * Create mock client with proper error handling
 * @param networkName - Network identifier
 * @returns Mock contract instance with error handling
 */
export function createMockClient(networkName?: string) {
  // Validate network name
  if (networkName && !(networkName in NETWORKS)) {
    const validNetworks = Object.keys(NETWORKS).join(', ');
    return {
      data: null,
      error: `Unknown network: ${networkName}. Valid networks: ${validNetworks}`,
    };
  }

  const network = networkName 
    ? NETWORKS[networkName as keyof typeof NETWORKS] 
    : NETWORKS.testnet;

  return {
    data: {
      network,
      address: MOCK_ADDRESS,
      history: MOCK_HISTORY,
      events: MOCK_EVENTS,
    },
    error: null,
  };
}
