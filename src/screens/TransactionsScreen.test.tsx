import { render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionsScreen } from "./TransactionsScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

function mockClient() {
  vi.mocked(getClient).mockReturnValue({
    network: {
      getNetwork: vi.fn(),
      switchNetwork: vi.fn(),
      getGasPrice: vi.fn().mockReturnValue(new Promise(() => {})),
    },
    transaction: {
      estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
      estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})),
      getFeeScenarios: vi.fn(),
      submit: vi.fn().mockReturnValue(new Promise(() => {})),
      getStatus: vi.fn(),
      getHistory: vi.fn(),
    },
    wallet: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getAddress: vi.fn(),
    },
    account: {
      getAccount: vi.fn(),
      getBalances: vi.fn(),
      getClaimableBalances: vi.fn(),
      claimBalance: vi.fn(),
    },
    soroban: {
      invokeContract: vi.fn(),
      getEvents: vi.fn(),
    },
    nft: {
      getNfts: vi.fn(),
      sendNft: vi.fn(),
      listNftForSale: vi.fn(),
    },
  } as unknown as SorokitClient);
}

describe("TransactionsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
    } as unknown as ReturnType<typeof useSorokit>);
    mockClient();
  });

  it("renders the screen heading", () => {
    render(<TransactionsScreen />);
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("renders FeeEstimator with its section title", () => {
    render(<TransactionsScreen />);
    expect(screen.getByText("Network Fee")).toBeInTheDocument();
  });

  it("renders TransactionPanel with its section title", () => {
    render(<TransactionsScreen />);
    expect(screen.getAllByText(/Send (Payment|XLM)/i)[0]).toBeInTheDocument();
  });

  it("renders FeeEstimator above TransactionPanel in the DOM", () => {
    const { container } = render(<TransactionsScreen />);

    const allHeadings = Array.from(container.querySelectorAll("h3"));
    const feeHeading = screen.getByText("Network Fee");
    const txHeading = screen.getAllByText(/Send (Payment|XLM)/i).find(
      (el) => el.tagName === "H3",
    );

    const feeIndex = allHeadings.indexOf(feeHeading as HTMLHeadingElement);
    const txIndex = txHeading ? allHeadings.indexOf(txHeading as HTMLHeadingElement) : -1;

    expect(feeIndex).toBeLessThan(txIndex);
  });

  it("renders ActivityTimeline with its section title", () => {
    render(<TransactionsScreen />);
    expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
  });

  it("renders ActivityTimeline below TransactionPanel in the DOM", () => {
    const { container } = render(<TransactionsScreen />);

    const allHeadings = Array.from(container.querySelectorAll("h3"));
    const feeHeading = screen.getByText("Network Fee");
    const panelHeading = screen.getAllByText(/Send (Payment|XLM)/i).find(
      (el) => el.tagName === "H3",
    );
    const timelineHeading = screen.getByText("Activity Timeline");

    const feeIndex = allHeadings.indexOf(feeHeading as HTMLHeadingElement);
    const panelIndex = panelHeading ? allHeadings.indexOf(panelHeading as HTMLHeadingElement) : -1;
    const timelineIndex = allHeadings.indexOf(timelineHeading as HTMLHeadingElement);

    expect(feeIndex).toBeLessThan(panelIndex);
    expect(panelIndex).toBeLessThan(timelineIndex);
  });
});
