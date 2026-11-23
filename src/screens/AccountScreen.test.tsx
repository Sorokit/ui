import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { AccountScreen } from "./AccountScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/components/AccountCard", () => ({
  AccountCard: () => <div>Account Card</div>,
}));

vi.mock("@/components/BalanceList", () => ({
  BalanceList: () => <div>Balance List</div>,
}));

vi.mock("@/components/ClaimableBalanceCard", () => ({
  ClaimableBalanceCard: () => <div>Claimable Balances</div>,
}));

type Ctx = ReturnType<typeof useSorokit>;

function mockContext(overrides: Partial<Ctx> = {}) {
  vi.mocked(useSorokit).mockReturnValue({
    isConnected: false,
    isLoadingAccount: false,
    refreshAccount: vi.fn(),
    ...overrides,
  } as Ctx);
}

const mockCreateObjectURL = vi.fn(() => "blob:account-export");
const mockRevokeObjectURL = vi.fn();

URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

describe("AccountScreen", () => {
  it("matches snapshot when disconnected", () => {
    const { container } = render(<AccountScreen />);
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot when connected", () => {
    mockContext({
      isConnected: true,
      address: "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA",
      network: {
        name: "testnet",
        passphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
      account: { sequence: "12345" } as ReturnType<typeof useSorokit>["account"],
      balances: [{ asset: "XLM", balance: "100" }],
    });
    const { container } = render(<AccountScreen />);
    expect(container).toMatchSnapshot();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext();
  });

  it("renders the screen heading as a level 2 heading", () => {
    render(<AccountScreen />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Account",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Balances and account details"),
    ).toBeInTheDocument();
  });

  describe("refresh control (#81)", () => {
    it("does not render the refresh button when disconnected", () => {
      mockContext({ isConnected: false });

      render(<AccountScreen />);

      expect(
        screen.queryByRole("button", {
          name: /refresh account data/i,
        }),
      ).not.toBeInTheDocument();
    });

    it("renders the refresh button when connected", () => {
      mockContext({ isConnected: true });

      render(<AccountScreen />);

      expect(
        screen.getByRole("button", {
          name: /refresh account data/i,
        }),
      ).toBeInTheDocument();
    });

    it("disables the refresh button while isLoadingAccount is true", () => {
      mockContext({
        isConnected: true,
        isLoadingAccount: true,
      });

      render(<AccountScreen />);

      const button = screen.getByRole("button", {
        name: /refresh account data/i,
      });

      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("keeps the refresh button enabled when not loading", () => {
      mockContext({
        isConnected: true,
        isLoadingAccount: false,
      });

      render(<AccountScreen />);

      expect(
        screen.getByRole("button", {
          name: /refresh account data/i,
        }),
      ).toBeEnabled();
    });

    it("calls refreshAccount when the refresh button is clicked", async () => {
      const refreshAccount = vi.fn().mockResolvedValue(undefined);

      mockContext({
        isConnected: true,
        refreshAccount,
      });

      render(<AccountScreen />);

      fireEvent.click(
        screen.getByRole("button", {
          name: /refresh account data/i,
        }),
      );

      expect(refreshAccount).toHaveBeenCalledTimes(1);

      await waitFor(() =>
        expect(screen.getByText(/last updated/i)).toBeInTheDocument(),
      );
    });
  });

  describe("last updated timestamp (#81)", () => {
    it("does not show a last-updated timestamp before any refresh", () => {
      mockContext({ isConnected: true });

      render(<AccountScreen />);

      expect(
        screen.queryByText(/last updated/i),
      ).not.toBeInTheDocument();
    });

    it("shows the last-updated timestamp after refreshAccount resolves", async () => {
      const refreshAccount = vi.fn().mockResolvedValue(undefined);

      mockContext({
        isConnected: true,
        refreshAccount,
      });

      render(<AccountScreen />);

      expect(
        screen.queryByText(/last updated/i),
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: /refresh account data/i,
        }),
      );

      await waitFor(() =>
        expect(screen.getByText(/last updated/i)).toBeInTheDocument(),
      );
    });
  });

  describe("connected actions (#343)", () => {
    const ADDRESS =
      "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    it("renders the action button group only when connected", () => {
      mockContext({
        isConnected: false,
        address: null,
        account: null,
        balances: [],
        network: null,
      });

      render(<AccountScreen />);

      expect(
        screen.queryByRole("button", {
          name: "Refresh account data",
        }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByTestId("account-export-button"),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByTestId("account-explorer-link"),
      ).not.toBeInTheDocument();
    });

    it("downloads the export JSON with a sorokit-account-{8chars}.json filename", () => {
      mockContext({
        isConnected: true,
        address: ADDRESS,
        account: {
          sequence: "1",
          address: ADDRESS,
        },
        balances: [],
        network: {
          name: "testnet",
          rpcUrl: "x",
          horizonUrl: "x",
          passphrase: "x",
        },
      });

      let downloadName: string | null = null;

      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadName = this.download;
        });

      render(<AccountScreen />);

      fireEvent.click(
        screen.getByTestId("account-export-button"),
      );

      expect(downloadName).toBe(
        `sorokit-account-${ADDRESS.slice(0, 8)}.json`,
      );

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:account-export",
      );

      clickSpy.mockRestore();
    });

    it("renders the Stellar Expert link with the testnet-segment URL when connected on testnet", () => {
      mockContext({
        isConnected: true,
        address: ADDRESS,
        account: {
          sequence: "1",
          address: ADDRESS,
        },
        balances: [],
        network: {
          name: "testnet",
          rpcUrl: "x",
          horizonUrl: "x",
          passphrase: "x",
        },
      });

      render(<AccountScreen />);

      const link = screen.getByTestId("account-explorer-link");

      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/account/${ADDRESS}`,
      );

      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");

      expect(link).toHaveAttribute(
        "aria-label",
        `View ${ADDRESS} on Stellar Expert`,
      );
    });

    it("renders the Stellar Expert link with the public-segment URL when on mainnet", () => {
      mockContext({
        isConnected: true,
        address: ADDRESS,
        account: {
          sequence: "1",
          address: ADDRESS,
        },
        balances: [],
        network: {
          name: "mainnet",
          rpcUrl: "x",
          horizonUrl: "x",
          passphrase: "x",
        },
      });

      render(<AccountScreen />);

      expect(
        screen.getByTestId("account-explorer-link"),
      ).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/public/account/${ADDRESS}`,
      );
    });

    it("does not render the Stellar Expert link on networks Stellar Expert does not index (futurenet, localnet)", () => {
      for (const name of ["futurenet", "localnet"]) {
        mockContext({
          isConnected: true,
          address: ADDRESS,
          account: {
            sequence: "1",
            address: ADDRESS,
          },
          balances: [],
          network: {
            name,
            rpcUrl: "x",
            horizonUrl: "x",
            passphrase: "x",
          },
        });

        const { unmount } = render(<AccountScreen />);

        expect(
          screen.queryByTestId("account-explorer-link"),
        ).not.toBeInTheDocument();

        unmount();
      }
    });
  });
});