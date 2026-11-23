import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const STEPS = [
  {
    title: "Confirm your funds are safe",
    body: "Your assets live on the Stellar ledger, not in the wallet extension. A broken extension does not move or remove them. Look up your public key in a block explorer to confirm your balances.",
  },
  {
    title: "Restore with your recovery phrase",
    body: "Reinstall the extension or use another Stellar wallet, then import your recovery phrase or secret key. If that works, you are done. Only enter them in the wallet app itself.",
  },
  {
    title: "Check your account signers",
    body: "If you no longer have the key, open your account in a block explorer and note its signers, weights, and thresholds. Recovery is possible only if the remaining signers can reach the high threshold.",
  },
  {
    title: "Build a recovery transaction",
    body: "A co-signer builds a Set Options transaction that adds a new key you control as a signer. Set a time limit long enough to collect every signature, then copy the transaction XDR.",
  },
  {
    title: "Review and sign the XDR",
    body: "Each signer pastes the XDR into Stellar Lab, reviews the decoded operations, and signs with their own wallet. Pass the signed XDR to the next signer. XDR is safe to share, but a secret key never is.",
  },
  {
    title: "Submit and verify",
    body: "When the combined signature weight meets the threshold, submit the transaction before it expires. Confirm that the new signer appears on the account.",
  },
  {
    title: "Remove the lost key",
    body: "Using the new key and co-signers, submit another Set Options transaction that sets the lost key's weight to 0. Then back up the new recovery phrase offline.",
  },
];

const RESOURCES = [
  {
    label: "Signatures and multisig",
    href: "https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig",
  },
  {
    label: "Set Options operation",
    href: "https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#set-options",
  },
  { label: "Stellar Lab (build and sign XDR)", href: "https://lab.stellar.org/" },
  { label: "StellarExpert block explorer", href: "https://stellar.expert/" },
  { label: "Freighter wallet documentation", href: "https://docs.freighter.app/" },
];

export function RecoveryGuide() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card data-testid="recovery-guide">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Wallet extension not working?</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide guide" : "Open guide"}
          </Button>
        </div>
        <CardDescription>
          Step-by-step help for MultiSig account access and XDR signing.
        </CardDescription>
      </CardHeader>
      <div id={panelId} hidden={!open}>
        {open && (
          <CardContent className="space-y-4">
            <p role="note" className="rounded-lg border border-error-dim-strong/30 bg-error-dim/20 p-3 text-[12px] text-ink-2">
              Nobody can restore an account without its key or enough authorized
              signers. Never share your recovery phrase or secret key, including
              with anyone offering support.
            </p>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-dim text-[11px] font-semibold text-brand"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink">{step.title}</h3>
                    <p className="mt-0.5 text-[12px] text-ink-3">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-line pt-3">
              <h3 className="text-[12px] font-semibold text-ink">External resources</h3>
              <ul className="mt-2 space-y-1">
                {RESOURCES.map((resource) => (
                  <li key={resource.href}>
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-brand hover:underline"
                    >
                      {resource.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </div>
    </Card>
  );
}
