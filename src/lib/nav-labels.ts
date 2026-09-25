import type { NavSection } from "@/components/Sidebar";

export const SCREEN_LABELS: Record<NavSection, { title: string; sub: string }> =
  {
    wallet: { title: "Wallet", sub: "Manage your connected wallet" },
    account: { title: "Account", sub: "Balances and account details" },
    transactions: { title: "Transactions", sub: "Send payments on Stellar" },
    soroban: { title: "Soroban", sub: "Invoke smart contracts" },
    network: { title: "Network", sub: "Switch between networks" },
    nfts: { title: "NFT Gallery", sub: "Browse and manage your NFT collection" },
    recovery: { title: "Account Recovery", sub: "Recover your wallet access" },
    charts: { title: "Analytics & Charts", sub: "Market and balance analytics" },
    farming: { title: "Yield Farming", sub: "Manage liquidity and rewards" },
    budget: { title: "Budgeting", sub: "Track spending and budget limits" },
  };
