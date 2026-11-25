import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  ONBOARDING_REPLAY_EVENT,
} from "@/lib/onboarding";

export const ONBOARDING_STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome to Sorokit",
    body: "Sorokit is a dashboard for Stellar and Soroban. This short tour shows the key areas. You can skip it at any time.",
  },
  {
    title: "Move around with the sidebar",
    body: "Use the sidebar to switch between Wallet, Account, Transactions, Soroban, Network and the other screens.",
  },
  {
    title: "Send a transaction",
    body: "Open Transactions to send a payment. You review the fee and confirm before anything is submitted.",
  },
  {
    title: "Check your network",
    body: "The Network screen switches between mainnet, testnet, futurenet and localnet. Check the active network before you send.",
  },
  {
    title: "Find it again in Settings",
    body: "Settings is in the sidebar. You can replay this tutorial from there whenever you like.",
  },
];

/**
 * First-visit walkthrough. It opens once, can be skipped or closed at any
 * step, and reopens from the first step when `requestOnboardingReplay()` is
 * called (the Settings screen's "Replay tutorial" button).
 */
export function OnboardingTutorial() {
  const [open, setOpen] = useState(() => !hasSeenOnboarding());
  const [step, setStep] = useState(0);

  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_REPLAY_EVENT, replay);
    return () => window.removeEventListener(ONBOARDING_REPLAY_EVENT, replay);
  }, []);

  function finish() {
    markOnboardingSeen();
    setOpen(false);
  }

  const isFirst = step === 0;
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const current = ONBOARDING_STEPS[step];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && finish()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl focus:outline-none"
          aria-describedby="onboarding-body"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-3" data-testid="onboarding-progress">
              Step {step + 1} of {ONBOARDING_STEPS.length}
            </p>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-ink-4 hover:text-ink-2 transition-colors"
                aria-label="Close tutorial"
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
          <Dialog.Title className="mt-2 text-[15px] font-semibold text-ink">
            {current.title}
          </Dialog.Title>
          <p id="onboarding-body" className="mt-2 text-[13px] text-ink-2">
            {current.body}
          </p>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip tutorial
            </Button>
            <div className="flex gap-2">
              {!isFirst && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={isLast ? finish : () => setStep((s) => s + 1)}
              >
                {isLast ? "Done" : "Next"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
