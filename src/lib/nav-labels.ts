import type { NavSection } from "@/components/Sidebar";

/** Brand suffix appended to every screen name to build a browser tab title. */
const TITLE_SUFFIX = "Sorokit";

/**
 * Builds the browser tab title for a screen, e.g. `pageTitle("Wallet")`
 * produces `"Wallet - Sorokit"` (#551).
 */
export function pageTitle(screen: string): string {
  return `${screen} - ${TITLE_SUFFIX}`;
}

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

/**
 * `document.title` for each dashboard screen (#551). Derived from
 * `SCREEN_LABELS` so the tab always matches the `<h1>` the TopBar renders for
 * the active section, and so a new screen only has to be named once.
 */
export const PAGE_TITLES: Record<NavSection, string> = {
  wallet: pageTitle(SCREEN_LABELS.wallet.title),
  account: pageTitle(SCREEN_LABELS.account.title),
  transactions: pageTitle(SCREEN_LABELS.transactions.title),
  soroban: pageTitle(SCREEN_LABELS.soroban.title),
  network: pageTitle(SCREEN_LABELS.network.title),
  recovery: pageTitle(SCREEN_LABELS.recovery.title),
  charts: pageTitle(SCREEN_LABELS.charts.title),
  farming: pageTitle(SCREEN_LABELS.farming.title),
  budget: pageTitle(SCREEN_LABELS.budget.title),
  nfts: pageTitle(SCREEN_LABELS.nfts.title),
};

/**
 * Title shown while the wallet is disconnected and `ConnectScreen` is mounted,
 * i.e. the title the app resets to after disconnecting (#551).
 */
export const DISCONNECTED_TITLE = pageTitle("Connect");
