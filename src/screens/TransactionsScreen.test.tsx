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
    transaction: {
      estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
      submit: vi.fn().mockReturnValue(new Promise(() => {})),
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
    expect(screen.getByText("Send Payment")).toBeInTheDocument();
  });

  it("renders FeeEstimator above TransactionPanel in the DOM", () => {
    const { container } = render(<TransactionsScreen />);

    const feeHeading = screen.getByText("Network Fee");
    const txHeading = screen.getByText("Send Payment");

    const allHeadings = Array.from(container.querySelectorAll("h3"));
    const feeIndex = allHeadings.indexOf(feeHeading as HTMLHeadingElement);
    const txIndex = allHeadings.indexOf(txHeading as HTMLHeadingElement);

    expect(feeIndex).toBeLessThan(txIndex);
  });

  it("renders FeeEstimator and TransactionPanel in the same screen", () => {
    render(<TransactionsScreen />);
    expect(screen.getByText("Network Fee")).toBeInTheDocument();
    expect(screen.getByText("Send Payment")).toBeInTheDocument();
  });
});
