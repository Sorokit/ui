import { useSorokit } from "@/context/useSorokit";
import { Button } from "@/components/ui/Button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import heroImg from "@/assets/hero.png";

export function ConnectScreen() {
  const { connectWallet, isConnecting, error, clearError } = useSorokit();

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center ">
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
          className="w-full rounded-xl object-cover"
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
            <p className="text-[11px] text-ink-4 text-center">
              Powered by sorokit-core · Stellar network
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
