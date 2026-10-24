import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { InvokeParams, SorokitClient } from "@/lib/client";

import { GovernanceDashboard, type GovernanceProposal, isVotingClosed } from "./GovernanceDashboard";

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
  revokeError?: string | null;
  voteThrows?: string;
}) {
  let currentDelegate = overrides?.delegate ?? null;
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
          data: currentDelegate,
          error: null,
          status: "success" as const,
        };
      case "revoke_delegation":
        if (!overrides?.revokeError) currentDelegate = null;
        return {
          data: overrides?.revokeError ? null : { hash: "tx_revoke" },
          error: overrides?.revokeError ?? null,
          status: overrides?.revokeError ? ("error" as const) : ("success" as const),
        };
      case "vote":
        if (overrides?.voteThrows) throw new Error(overrides.voteThrows);
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

// Issue #866: Implement GovernanceDashboard — proposal list, vote casting, and delegation UI
describe("GovernanceDashboard (#866)", () => {
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
  // ─── Closed / executed proposals ───────────────────────────────────────────
  describe("closed proposals", () => {
    const withStatus = (id: string, status: string): GovernanceProposal => ({
      id,
      title: `Proposal ${status}`,
      description: `A ${status} proposal.`,
      status,
      votesFor: 10,
      votesAgainst: 5,
      votesAbstain: 1,
    });

    it.each(["closed", "executed"])("disables every vote button for a %s proposal", async (status) => {
      const { client, invokeContract } = makeClient({ proposals: [withStatus("9", status)] });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      const card = (await screen.findByText(`Proposal ${status}`)).closest('[role="listitem"]') as HTMLElement;
      expect(within(card).getByText(status)).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Vote Yes" })).toBeDisabled();
      expect(within(card).getByRole("button", { name: "Vote No" })).toBeDisabled();
      expect(within(card).getByRole("button", { name: "Vote Abstain" })).toBeDisabled();
      expect(within(card).getByTestId("voting-closed-note")).toHaveTextContent("Voting closed");

      fireEvent.click(within(card).getByRole("button", { name: "Vote Yes" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(invokeContract).not.toHaveBeenCalledWith(expect.objectContaining({ method: "vote" }));
    });

    it("keeps voting enabled on an active proposal listed next to a closed one", async () => {
      const { client } = makeClient({
        proposals: [PROPOSALS[0], withStatus("9", "closed")],
      });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await screen.findByText("Proposal closed");
      const [active, closed] = screen.getAllByRole("listitem");
      expect(within(active).getByRole("button", { name: "Vote Yes" })).toBeEnabled();
      expect(within(active).queryByTestId("voting-closed-note")).not.toBeInTheDocument();
      expect(within(closed).getByRole("button", { name: "Vote Yes" })).toBeDisabled();
    });
  });

  // ─── Vote failure feedback ─────────────────────────────────────────────────
  describe("vote failures", () => {
    async function openConfirm(client: SorokitClient) {
      mockSorokit(client);
      render(<GovernanceDashboard />);
      await screen.findByText("Increase validator rewards");
      fireEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Vote Yes" }));
      return screen.findByRole("dialog");
    }

    it("shows an error banner, no success notice, and allows retrying", async () => {
      const { client, invokeContract } = makeClient({ voteError: "tx_failed" });
      const dialog = await openConfirm(client);

      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));

      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /confirm vote/i })).toBeEnabled();

      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));
      await waitFor(() =>
        expect(invokeContract.mock.calls.filter(([p]) => p.method === "vote")).toHaveLength(2),
      );
    });

    it("shows an error banner when the contract invocation throws", async () => {
      const { client } = makeClient({ voteThrows: "network down" });
      const dialog = await openConfirm(client);

      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));

      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /confirm vote/i })).toBeEnabled();
    });

    it("clears the error when the dialog is cancelled and reopened", async () => {
      const { client } = makeClient({ voteError: "tx_failed" });
      const dialog = await openConfirm(client);

      fireEvent.click(within(dialog).getByRole("button", { name: /confirm vote/i }));
      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());

      fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      fireEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Vote No" }));
      const reopened = await screen.findByRole("dialog");
      expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // ─── Delegation revocation ─────────────────────────────────────────────────
  describe("delegation revocation", () => {
    it("hides the revoke button when there is no delegate", async () => {
      const { client } = makeClient({ delegate: null });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await screen.findByTestId("current-delegate");
      expect(screen.queryByRole("button", { name: /revoke delegation/i })).not.toBeInTheDocument();
    });

    it("revokes the current delegate and returns to self-voting", async () => {
      const user = userEvent.setup();
      const { client, invokeContract } = makeClient({ delegate: VALID_ADDRESS });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toHaveAttribute("title", VALID_ADDRESS),
      );
      await user.click(screen.getByRole("button", { name: /revoke delegation/i }));

      await waitFor(() =>
        expect(invokeContract).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "revoke_delegation",
            sourceAccount: VALID_ADDRESS,
          }),
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/delegation revoked/i),
      );
      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toHaveTextContent(/none/i),
      );
      expect(screen.queryByRole("button", { name: /revoke delegation/i })).not.toBeInTheDocument();
    });

    it("shows an error and keeps the delegate when revocation fails", async () => {
      const user = userEvent.setup();
      const { client } = makeClient({ delegate: VALID_ADDRESS, revokeError: "tx_failed" });
      mockSorokit(client);

      render(<GovernanceDashboard />);

      await waitFor(() =>
        expect(screen.getByTestId("current-delegate")).toHaveAttribute("title", VALID_ADDRESS),
      );
      await user.click(screen.getByRole("button", { name: /revoke delegation/i }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.getByTestId("current-delegate")).toHaveAttribute("title", VALID_ADDRESS);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  // ─── Disconnect reset ─────────────────────────────────────────────────────
  describe("disconnect reset", () => {
    it("clears stale proposals and the delegate when the wallet disconnects", async () => {
      const { client } = makeClient({
        proposals: PROPOSALS,
        delegate: VALID_ADDRESS,
      });
      mockSorokit(client);

      const { rerender } = render(<GovernanceDashboard />);

      expect(await screen.findByText(PROPOSALS[0].title)).toBeInTheDocument();
      expect(screen.getByTestId("current-delegate")).toHaveAttribute(
        "title",
        VALID_ADDRESS,
      );

      mockSorokit(client, { isConnected: false });
      rerender(<GovernanceDashboard />);

      expect(screen.queryByText(PROPOSALS[0].title)).not.toBeInTheDocument();
      expect(
        screen.getByText(/connect your wallet to view proposals/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId("current-delegate")).toHaveTextContent(
        /none/i,
      );
    });
  });

  // ─── isVotingClosed helper ────────────────────────────────────────────────
  describe("isVotingClosed", () => {
    it("returns true only for terminal statuses", () => {
      expect(isVotingClosed("active")).toBe(false);
      expect(isVotingClosed("pending")).toBe(false);
      expect(isVotingClosed("closed")).toBe(true);
      expect(isVotingClosed("executed")).toBe(true);
      expect(isVotingClosed("passed")).toBe(true);
      expect(isVotingClosed("rejected")).toBe(true);
    });
  });
});
