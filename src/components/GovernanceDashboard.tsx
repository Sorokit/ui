/**
 * GovernanceDashboard — a full on-chain governance surface for Soroban dApps.
 *
 * Three panels:
 *  1. ProposalList   — proposals fetched from the governance contract, each
 *                      showing title, description, live vote counts, and status.
 *  2. VoteDialog     — a confirmation dialog for casting a Yes / No / Abstain
 *                      vote; the vote is submitted through the contract.
 *  3. DelegationPanel — shows the account's current voting delegate and lets
 *                      the user delegate their voting power to another account.
 *
 * Like the rest of sorokit-ui this component owns no blockchain logic. Reads
 * and writes go through `client.soroban.invokeContract` on the shared
 * `sorokit-core` client, and every failure surfaces as inline state rather
 * than a thrown exception.
 */

import {
  AlertCircleIcon,
  Cancel01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { cn, friendlyError, truncateAddress, validateStellarAddress } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | "active"
  | "passed"
  | "rejected"
  | "pending"
  | "executed"
  | (string & {});

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  /** Optional ISO-8601 timestamp for when voting closes. */
  endsAt?: string;
}

export type VoteChoice = "yes" | "no" | "abstain";

export interface GovernanceDashboardProps {
  /**
   * Governance contract ID that exposes `get_proposals`, `get_delegate`,
   * `vote`, and `delegate` methods. Defaults to a placeholder so the panel is
   * usable in demos before a real contract is wired up.
   */
  contractId?: string;
  className?: string;
}

const DEFAULT_GOVERNANCE_CONTRACT =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGOVR";

const VOTE_LABELS: Record<VoteChoice, string> = {
  yes: "Yes",
  no: "No",
  abstain: "Abstain",
};

// ─── Normalisers ──────────────────────────────────────────────────────────────
//
// invokeContract returns `unknown`, so proposal/delegate payloads are coerced
// defensively — a malformed field falls back to a safe default rather than
// throwing and taking the whole dashboard down.

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeProposals(data: unknown): GovernanceProposal[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    return {
      id: toStringField(p.id, String(i)),
      title: toStringField(p.title, "Untitled proposal"),
      description: toStringField(p.description),
      status: toStringField(p.status, "pending") as ProposalStatus,
      votesFor: toNumber(p.votesFor),
      votesAgainst: toNumber(p.votesAgainst),
      votesAbstain: toNumber(p.votesAbstain),
      endsAt: typeof p.endsAt === "string" ? p.endsAt : undefined,
    };
  });
}

function normalizeDelegate(data: unknown): string | null {
  if (typeof data === "string") return data.trim() === "" ? null : data;
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).delegate;
    if (typeof d === "string") return d.trim() === "" ? null : d;
  }
  return null;
}

function statusVariant(
  status: ProposalStatus,
): "success" | "error" | "primary" | "warning" | "default" {
  switch (status) {
    case "passed":
    case "executed":
      return "success";
    case "rejected":
      return "error";
    case "active":
      return "primary";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ proposal }: { proposal: GovernanceProposal }) {
  const total =
    proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Votes: ${proposal.votesFor} for, ${proposal.votesAgainst} against, ${proposal.votesAbstain} abstain`}
      >
        <div className="h-full bg-green" style={{ width: `${pct(proposal.votesFor)}%` }} />
        <div className="h-full bg-red" style={{ width: `${pct(proposal.votesAgainst)}%` }} />
        <div className="h-full bg-ink-3" style={{ width: `${pct(proposal.votesAbstain)}%` }} />
      </div>
      <div className="flex items-center gap-4 text-[11px] tabular-nums">
        <span className="text-green">For {proposal.votesFor}</span>
        <span className="text-red">Against {proposal.votesAgainst}</span>
        <span className="text-ink-3">Abstain {proposal.votesAbstain}</span>
      </div>
    </div>
  );
}

// ─── Proposal card ──────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: GovernanceProposal;
  disabled: boolean;
  onVote: (proposal: GovernanceProposal, choice: VoteChoice) => void;
}

function ProposalCard({ proposal, disabled, onVote }: ProposalCardProps) {
  return (
    <div
      role="listitem"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-ink">{proposal.title}</h4>
          {proposal.description && (
            <p className="mt-0.5 text-[12px] text-ink-3">{proposal.description}</p>
          )}
        </div>
        <Badge variant={statusVariant(proposal.status)} className="shrink-0 capitalize">
          {proposal.status}
        </Badge>
      </div>

      <VoteBar proposal={proposal} />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onVote(proposal, "yes")}
        >
          Vote Yes
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onVote(proposal, "no")}
        >
          Vote No
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onVote(proposal, "abstain")}
        >
          Vote Abstain
        </Button>
      </div>
    </div>
  );
}

// ─── Vote confirmation dialog ─────────────────────────────────────────────────

interface VoteDialogProps {
  proposal: GovernanceProposal | null;
  choice: VoteChoice | null;
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function VoteDialog({
  proposal,
  choice,
  submitting,
  error,
  onConfirm,
  onCancel,
}: VoteDialogProps) {
  const open = proposal !== null && choice !== null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface shadow-2xl focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="vote-confirm-desc"
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-1">
            <Dialog.Title className="text-[14px] font-semibold text-ink">
              Confirm your vote
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-ink-4 transition-colors hover:text-ink-2"
                aria-label="Close"
                disabled={submitting}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
            </Dialog.Close>
          </div>

          {proposal && choice && (
            <div className="px-6 pb-2">
              <p id="vote-confirm-desc" className="text-[12px] text-ink-3">
                You are voting{" "}
                <span className="font-semibold text-ink">{VOTE_LABELS[choice]}</span>{" "}
                on:
              </p>
              <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] font-medium text-ink">
                {proposal.title}
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mx-6 mt-2 rounded-lg border border-error-dim-strong bg-error-dim px-3 py-2 text-[12px] text-red"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-line px-6 py-4">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              loading={submitting}
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? "Submitting…" : "Confirm vote"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Delegation panel ─────────────────────────────────────────────────────────

interface DelegationPanelProps {
  currentDelegate: string | null;
  disabled: boolean;
  submitting: boolean;
  error: string | null;
  onDelegate: (target: string) => void;
}

function DelegationPanel({
  currentDelegate,
  disabled,
  submitting,
  error,
  onDelegate,
}: DelegationPanelProps) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const invalid = trimmed !== "" && !validateStellarAddress(trimmed);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voting Delegation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-ink-3">Current delegate</span>
          {currentDelegate ? (
            <span
              className="font-mono text-ink"
              title={currentDelegate}
              data-testid="current-delegate"
            >
              {truncateAddress(currentDelegate, 6, 6)}
            </span>
          ) : (
            <span className="text-ink-3" data-testid="current-delegate">
              None — voting for yourself
            </span>
          )}
        </div>

        <Input
          label="Delegate to"
          placeholder="G… account address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={invalid ? "Enter a valid Stellar address." : undefined}
          disabled={disabled || submitting}
          aria-label="Delegate address"
        />

        {error && (
          <p role="alert" className="text-[11px] text-red">
            {error}
          </p>
        )}

        <Button
          size="sm"
          className="self-start"
          loading={submitting}
          disabled={disabled || submitting || trimmed === "" || invalid}
          onClick={() => onDelegate(trimmed)}
        >
          {submitting ? "Delegating…" : "Delegate votes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function GovernanceDashboard({
  contractId = DEFAULT_GOVERNANCE_CONTRACT,
  className,
}: GovernanceDashboardProps = {}) {
  const { client, address, isConnected } = useSorokit();

  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Vote dialog state.
  const [pendingProposal, setPendingProposal] =
    useState<GovernanceProposal | null>(null);
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Delegation state.
  const [delegate, setDelegate] = useState<string | null>(null);
  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  // Fetch proposals and the current delegate whenever the client, contract,
  // connection, or a manual reload changes.
  useEffect(() => {
    if (!isConnected || !client) {
      // Reset when the wallet disconnects so stale proposals/delegate don't
      // linger. Mirrors SorokitProvider's account-reset effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProposals([]);
      setDelegate(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      const [proposalRes, delegateRes] = await Promise.all([
        client.soroban.invokeContract({
          contractId,
          method: "get_proposals",
        }),
        client.soroban.invokeContract({
          contractId,
          method: "get_delegate",
          args: address ? [address] : [],
        }),
      ]);

      if (!active) return;

      if (proposalRes.error) {
        setLoadError(friendlyError(proposalRes.error));
        setProposals([]);
      } else {
        setProposals(normalizeProposals(proposalRes.data));
      }

      if (!delegateRes.error) {
        setDelegate(normalizeDelegate(delegateRes.data));
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [client, contractId, address, isConnected, reloadKey]);

  const openVote = useCallback(
    (proposal: GovernanceProposal, choice: VoteChoice) => {
      setNotice(null);
      setVoteError(null);
      setPendingProposal(proposal);
      setPendingChoice(choice);
    },
    [],
  );

  const closeVote = useCallback(() => {
    setPendingProposal(null);
    setPendingChoice(null);
    setVoteError(null);
  }, []);

  const confirmVote = useCallback(async () => {
    if (!pendingProposal || !pendingChoice || !client) return;
    setVoting(true);
    setVoteError(null);

    const { error } = await client.soroban.invokeContract({
      contractId,
      method: "vote",
      args: [pendingProposal.id, pendingChoice],
      sourceAccount: address ?? undefined,
    });

    setVoting(false);

    if (error) {
      setVoteError(friendlyError(error));
      return;
    }

    setNotice(
      `Vote recorded: ${VOTE_LABELS[pendingChoice]} on "${pendingProposal.title}".`,
    );
    setPendingProposal(null);
    setPendingChoice(null);
    setReloadKey((k) => k + 1);
  }, [pendingProposal, pendingChoice, client, contractId, address]);

  const submitDelegation = useCallback(
    async (target: string) => {
      if (!target || !client) return;
      setDelegating(true);
      setDelegateError(null);

      const { error } = await client.soroban.invokeContract({
        contractId,
        method: "delegate",
        args: [target],
        sourceAccount: address ?? undefined,
      });

      setDelegating(false);

      if (error) {
        setDelegateError(friendlyError(error));
        return;
      }

      setDelegate(target);
      setNotice(`Voting power delegated to ${truncateAddress(target, 6, 6)}.`);
      setReloadKey((k) => k + 1);
    },
    [client, contractId, address],
  );

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div>
        <h2 className="text-[18px] font-semibold text-ink">Governance</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Review proposals, cast your vote, and manage voting delegation.
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-success-dim-strong bg-success-dim px-3 py-2 text-[12px] text-green"
        >
          {notice}
        </p>
      )}

      {!isConnected && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-3">
          Connect your wallet to view proposals and vote.
        </p>
      )}

      {/* Proposals */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Proposals</CardTitle>
          {loading && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <HugeiconsIcon
                icon={Loading03Icon}
                size={13}
                color="currentColor"
                strokeWidth={1.5}
                className="animate-spin"
              />
              Loading…
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="flex items-center gap-2 text-[12px] text-red" role="alert">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
              {loadError}
            </div>
          ) : proposals.length === 0 && !loading ? (
            <p className="py-6 text-center text-[13px] text-ink-3">
              {isConnected
                ? "No active proposals right now."
                : "Proposals appear once you connect."}
            </p>
          ) : (
            <div role="list" aria-label="Governance proposals" className="flex flex-col gap-3">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  disabled={!isConnected || voting}
                  onVote={openVote}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delegation */}
      <DelegationPanel
        currentDelegate={delegate}
        disabled={!isConnected}
        submitting={delegating}
        error={delegateError}
        onDelegate={submitDelegation}
      />

      {/* Vote confirmation */}
      <VoteDialog
        proposal={pendingProposal}
        choice={pendingChoice}
        submitting={voting}
        error={voteError}
        onConfirm={() => void confirmVote()}
        onCancel={closeVote}
      />
    </div>
  );
}

export default GovernanceDashboard;
