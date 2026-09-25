import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";

import heroImg from "@/assets/hero.png";
import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";

const SUPPORTED_WALLETS = [
  { name: "Freighter", initial: "F", color: "#7B61FF" },
  { name: "xBull", initial: "X", color: "#F3A93B" },
  { name: "Lobstr", initial: "L", color: "#2F80ED" },
  { name: "Albedo", initial: "A", color: "#00B894" },
];

export function ConnectScreen() {
  const { connectWallet, isConnecting, error, clearError } = useSorokit();
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isConnecting) {
      connectButtonRef.current?.focus();
    }
  }, [isConnecting]);

  useEffect(() => {
    document.title = "Connect — Sorokit";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 19C10.34 19 9 17.66 9 16C9 14.34 10.34 13 12 13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="1.5" fill="white" />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-ink tracking-tight">
              sorokit
            </h1>
            <p className="text-[13px] text-ink-3 mt-1">
              Stellar control dashboard
            </p>
          </div>
        </div>

        {/* Hero image */}
        <img
          src={heroImg}
          alt="sorokit wallet dashboard preview"
          className="w-full rounded-xl object-cover [@media(max-height:640px)]:hidden"
        />

        {/* Card */}
        <div className="w-full rounded-2xl border border-line bg-surface overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.2)]">
          <div className="px-8 pt-8 pb-6 border-b border-line">
            <h2 className="text-[18px] font-semibold text-ink tracking-tight">
              Connect Wallet
            </h2>

            <p className="text-[13px] text-ink-3 mt-2 leading-relaxed">
              Connect your Stellar wallet to access the dashboard and manage
              your assets.
            </p>
          </div>

          <div className="px-5 py-5 flex flex-col gap-4">
            {error && (
              <div className="flex items-start justify-between gap-3 rounded-lg bg-error-dim-muted border border-error-dim px-4 py-3">
                <p className="text-[13px] text-red">{error}</p>

                <button
                  onClick={clearError}
                  aria-label="Dismiss error"
                  className="text-red opacity-50 hover:opacity-100 shrink-0 mt-0.5 transition-opacity"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                  />
                </button>
              </div>
            )}

            <Button
              ref={connectButtonRef}
              size="lg"
              loading={isConnecting}
              onClick={connectWallet}
              className="w-full justify-center"
            >
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </Button>

            {isConnecting && (
              <p className="text-[12px] text-ink-3 text-center">
                Connecting to your wallet…
              </p>
            )}

            {/* Wallet options */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 text-center">
                Supported wallets
              </p>

              <div className="grid grid-cols-4 gap-2">
                {SUPPORTED_WALLETS.map((wallet) => (
                  <button
                    key={wallet.name}
                    type="button"
                    onClick={connectWallet}
                    disabled={isConnecting}
                    aria-label={`Connect with ${wallet.name}`}
                    title={wallet.name}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-line px-2 py-2.5 hover:border-line-2 hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: wallet.color }}
                      aria-hidden="true"
                    >
                      {wallet.initial}
                    </span>

                    <span className="text-[10px] text-ink-3 truncate w-full text-center">
                      {wallet.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <details className="group rounded-lg border border-line px-4 py-3 open:bg-surface-2">
              <summary className="text-[12px] font-medium text-ink-2 cursor-pointer select-none list-none flex items-center justify-between">
                New to Stellar?
                <span className="text-ink-4 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>

              <ul className="mt-3 flex flex-col gap-2 text-[12px] text-ink-3 leading-relaxed list-disc pl-4">
                <li>
                  A Stellar wallet stores the keys that control your account and
                  lets you approve transactions.
                </li>
                <li>
                  It never leaves your device—sorokit only asks it to sign
                  transactions; it can't move funds on its own.
                </li>
                <li>
                  Don't have one yet? Install Freighter, xBull, Lobstr, or
                  Albedo, then come back and hit Connect Wallet.
                </li>
              </ul>
            </details>

            <p className="text-[11px] text-ink-4 text-center">
              Powered by sorokit-core · Stellar network
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}