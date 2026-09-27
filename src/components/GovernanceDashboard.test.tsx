import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { InvokeParams, SorokitClient } from "@/lib/client";

import { GovernanceDashboard, type GovernanceProposal } from "./GovernanceDashboard";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

// A valid Stellar address (passes the StrKey CRC16 checksum in
// validateStellarAddress) so the delegation input accepts it.
const VALID_ADDRESS =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const PROPOSALS: GovernanceProposal[] = [
  {
    id: "1",
    title: "Increase validator rewards",
    description: "Raise the annual staking yield from 4% to 5%.",
    status: "active",
    votesFor: 120,
    votesAgainst: 30,
    votesAbstain: 10,
  },
  {
    id: "2",
    title: "Fund the developer grants program",
    description: "Allocate 1M XLM to ecosystem grants.",
    status: "pending",
    votesFor: 40,
    votesAgainst: 45,
    votesAbstain: 5,
  },
];

/**
 * Build a mock client whose `invokeContract` resolves based on the method
 * being called, so proposal fetching, delegate fetching, voting, and
 * delegation can all be exercised through one seam.
 */
function makeClient(overrides?: {
  proposals?: unknown;
  delegate?: unknown;
  voteError?: string | null;
  delegateError?: string | null;
}) {
  const invokeContract = vi.fn(async (params: InvokeParams) => {
    switch (params.method) {
      case "get_proposals":
        return {
          data: overrides?.proposals ?? PROPOSALS,
          error: null,
          status: "success" as const,
        };
      case "get_delegate":
        return {
          data: overrides?.delegate ?? null,
          error: null,
          status: "success" as const,
        };
      case "vote":
        return {
          data: overrides?.voteError ? null : { hash: "tx_vote" },
          error: overrides?.voteError ?? null,
          status: overrides?.voteError ? ("error" as const) : ("success" as const),
        };
      case "delegate":
        return {
          data: overrides?.delegateError ? null : { hash: "tx_delegate" },
          error: overrides?.delegateError ?? null,
          status: overrides?.delegateError ? ("error" as const) : ("success" as const),
        };
      default:
        return { data: null, error: null, status: "success" as const };
    }
  });

  const client = {
    soroban: { invokeContract },
  } as unknown as SorokitClient;

  return { client, invokeContract };
}

function mockSorokit(client: SorokitClient, opts?: { isConnected?: boolean }) {
  vi.mocked(useSorokit).mockReturnValue({
    client,
    address: VALID_ADDRESS,
    isConnected: opts?.isConnected ?? true,
  } as unknown as ReturnType<typeof useSorokit>);
}

describe("GovernanceDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── ProposalList ────────────────────────────────────────────────────────
  describe("proposal list", () => {
    it("fetches and renders proposals with title, description, votes, and status", async () => {
      const { client, invokeContract } = makeClient();
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(
          screen.getByText("Increase validator rewards"),
        ).toBeInTheDocument(),
      );

      // Fetched via the governance contract.
      expect(invokeContract).toHaveBeenCalledWith(
        expect.objectContaining({ method: "get_proposals" }),
      );

      // Title + description.
      expect(
        screen.getByText("Raise the annual staking yield from 4% to 5%."),
      ).toBeInTheDocument();
      // Vote counts.
      expect(screen.getByText("For 120")).toBeInTheDocument();
      expect(screen.getByText("Against 30")).toBeInTheDocument();
      expect(screen.getByText("Abstain 10")).toBeInTheDocument();
      // Status badge.
      expect(screen.getByText("active")).toBeInTheDocument();

      // Two proposals → two list items.
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("shows an empty state when there are no proposals", async () => {
      const { client } = makeClient({ proposals: [] });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByText(/no active proposals/i)).toBeInTheDocument(),
      );
    });

    it("surfaces a fetch error without throwing", async () => {
      const invokeContract = vi.fn(async (params: InvokeParams) =>
        params.method === "get_proposals"
          ? { data: null, error: "account not found", status: "error" as const }
          : { data: null, error: null, status: "success" as const },
      );
      mockSorokit({ soroban: { invokeContract } } as unknown as SorokitClient);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(/could not be found/i),
      );
    });

    it("prompts to connect a wallet when disconnected", () => {
      const { client } = makeClient();
      mockSorokit(client, { isConnected: false });

      render(<GovernanceDashboard />);

      expect(
        screen.getByText(/connect your wallet to view proposals/i),
      ).toBeInTheDocument();
    });
  });

  // ─── VoteDialog ──────────────────────────────────────────────────────────
  describe("vote casting", () => {
    it("opens a confirmation dialog and invokes the vote contract call", async () => {
      const { client, invokeContract } = makeClient();
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(
          screen.getByText("Increase validator rewards"),
        ).toBeInTheDocument(),
      );

      const firstProposal = screen.getAllByRole("listitem")[0];
      fireEvent.click(within(firstProposal).getByRole("button", { name: "Vote Yes" }));

      // Confirmation dialog appears.
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/confirm your vote/i)).toBeInTheDocument();
      expect(within(dialog).getByText("Yes")).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));

      await waitFor(() =>
        expect(invokeContract).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "vote",
            args: ["1", "yes"],
            sourceAccount: VALID_ADDRESS,
          }),
        ),
      );

      // Success notice + dialog closed.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/vote recorded/i),
      );
    });

    it("keeps the dialog open and shows an error when the vote fails", async () => {
      const { client } = makeClient({ voteError: "simulation failed" });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(
          screen.getByText("Increase validator rewards"),
        ).toBeInTheDocument(),
      );

      const firstProposal = screen.getAllByRole("listitem")[0];
      fireEvent.click(within(firstProposal).getByRole("button", { name: "Vote No" }));

      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));

      await waitFor(() =>
        expect(within(dialog).getByRole("alert")).toHaveTextContent(
          /could not be simulated/i,
        ),
      );
      // Dialog is still open after the failure.
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // ─── DelegationPanel ───────────────────────────────────────────────────────
  describe("delegation panel", () => {
    it("shows the current delegate returned by the contract", async () => {
      const { client } = makeClient({ delegate: VALID_ADDRESS });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toHaveAttribute(
          "title",
          VALID_ADDRESS,
        ),
      );
    });

    it("shows 'None' when there is no delegate", async () => {
      const { client } = makeClient({ delegate: null });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toHaveTextContent(
          /none/i,
        ),
      );
    });

    it("delegates voting power to a valid address", async () => {
      const user = userEvent.setup();
      const { client, invokeContract } = makeClient({ delegate: null });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toBeInTheDocument(),
      );

      await user.type(screen.getByLabelText("Delegate address"), VALID_ADDRESS);
      await user.click(screen.getByRole("button", { name: /delegate votes/i }));

      await waitFor(() =>
        expect(invokeContract).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "delegate",
            args: [VALID_ADDRESS],
            sourceAccount: VALID_ADDRESS,
          }),
        ),
      );
    });

    it("rejects an invalid delegate address before calling the contract", async () => {
      const user = userEvent.setup();
      const { client, invokeContract } = makeClient({ delegate: null });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toBeInTheDocument(),
      );

      await user.type(screen.getByLabelText("Delegate address"), "not-an-address");

      // Validation message shown and the delegate call is never made.
      expect(
        screen.getByText(/enter a valid stellar address/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delegate votes/i })).toBeDisabled();
      expect(invokeContract).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "delegate" }),
      );
    });
  });
});
