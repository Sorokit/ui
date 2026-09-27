import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3;

type Signer = {
  id: string;
  address: string;
  weight: number;
  signed: boolean;
};

interface BuilderState {
  signers: Signer[];
  threshold: number;
  xdr: string;
  status: string;
  notes: string;
}

const STORAGE_KEY = "sorokit-multisig-builder-state";
const memoryStorage = new Map<string, string>();

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" && typeof storage.removeItem === "function") {
      return storage;
    }
  } catch {
    // Ignore storage access failures in non-browser or restricted environments.
  }

  // Issue #654: return an in-memory shim instead of redefining
  // `window.localStorage`, which mutated the global and contaminated JSDOM
  // test suites and other components.
  return {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
  };
}

let signerSequence = 0;

/** Issue #654: generate collision-free signer ids so removing a middle signer
 *  and adding a new one cannot produce duplicate React keys. */
function uniqueSignerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `signer-${crypto.randomUUID()}`;
  }
  signerSequence += 1;
  return `signer-${Date.now()}-${signerSequence}`;
}

function createSigner(id: string = uniqueSignerId()): Signer {
  return { id, address: "", weight: 1, signed: false };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function validateThreshold(signers: Signer[], threshold: number) {
  const totalWeight = signers.reduce((sum, signer) => sum + signer.weight, 0);
  const valid = signers.length > 0 && threshold > 0 && threshold <= totalWeight;
  return { totalWeight, valid };
}

export function MultiSigTransactionBuilder() {
  const [step, setStep] = useState<Step>(0);
  const [signers, setSigners] = useState<Signer[]>([createSigner()]);
  const [threshold, setThreshold] = useState(1);
  const [xdr, setXdr] = useState("<tx:xdr:placeholder>");
  const [status, setStatus] = useState("Draft");
  const [notes, setNotes] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loadedMessage, setLoadedMessage] = useState<string | null>(null);

  const { totalWeight, valid } = useMemo(() => validateThreshold(signers, threshold), [signers, threshold]);

  useEffect(() => {
    if (step === 0) return;
    const timer = window.setTimeout(() => setSavedMessage(null), 1800);
    return () => window.clearTimeout(timer);
  }, [savedMessage, step]);

  function updateSigner(index: number, updates: Partial<Signer>) {
    setSigners((current) => current.map((signer, signerIndex) => signerIndex === index ? { ...signer, ...updates } : signer));
  }

  function addSigner() {
    setSigners((current) => [...current, createSigner()]);
  }

  function removeSigner(index: number) {
    setSigners((current) => current.filter((_, signerIndex) => signerIndex !== index));
  }

  function toggleSignerSigned(index: number) {
    setSigners((current) => current.map((signer, signerIndex) => signerIndex === index ? { ...signer, signed: !signer.signed } : signer));
  }

  function saveJson() {
    const storage = getStorage();
    if (!storage) {
      setSavedMessage("Storage is unavailable in this environment");
      return;
    }

    const payload: BuilderState = { signers, threshold, xdr, status, notes };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSavedMessage("Saved transaction JSON");
  }

  function loadSaved() {
    const storage = getStorage();
    if (!storage) {
      setLoadedMessage("Storage is unavailable in this environment");
      return;
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoadedMessage("No saved transaction found");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as BuilderState;
      setSigners(parsed.signers ?? [createSigner()]);
      setThreshold(parsed.threshold ?? 1);
      setXdr(parsed.xdr ?? "<tx:xdr:placeholder>");
      setStatus(parsed.status ?? "Draft");
      setNotes(parsed.notes ?? "");
      setStep(1);
      setLoadedMessage("Loaded saved transaction");
    } catch {
      setLoadedMessage("Unable to load saved transaction");
    }
  }

  function nextStep() {
    if (step < 3) setStep((current) => (current + 1) as Step);
  }

  function prevStep() {
    if (step > 0) setStep((current) => (current - 1) as Step);
  }

  const stepTitle = ["Signer configuration", "Build transaction", "Collect signatures", "Final confirmation"][step];

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Multi-signature transaction builder</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Create and manage multi-sig transactions step by step.</p>
        </div>
        <Badge variant="teal">Multi-sig</Badge>
      </div>

      <div className="px-6 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
          <div>
            <p className="text-[12px] font-semibold text-ink">{stepTitle}</p>
            <p className="text-[11px] text-ink-3">{step === 0 ? "Define signers and threshold" : step === 1 ? "Prepare the transaction payload" : step === 2 ? "Track collected signatures" : "Confirm and submit"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={saveJson}>Save JSON</Button>
            <Button variant="secondary" size="sm" onClick={loadSaved}>Load saved</Button>
          </div>
        </div>

        {savedMessage ? <p className="mb-3 text-[12px] text-success">{savedMessage}</p> : null}
        {loadedMessage ? <p className="mb-3 text-[12px] text-brand">{loadedMessage}</p> : null}

        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-ink">Signer configuration</h4>
                <Button variant="secondary" size="sm" onClick={addSigner}>Add signer</Button>
              </div>
              <div className="flex flex-col gap-3">
                {signers.map((signer, index) => (
                  <div key={signer.id} className="rounded-lg border border-line bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-ink">Signer {index + 1}</p>
                      {signers.length > 1 ? (
                        <Button variant="ghost" size="sm" onClick={() => removeSigner(index)}>Remove</Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input label={`Signer ${index + 1} address`} placeholder="G..." value={signer.address} onChange={(event) => updateSigner(index, { address: event.target.value })} />
                      <Input label={`Signer ${index + 1} weight`} type="number" min="1" value={signer.weight} onChange={(event) => updateSigner(index, { weight: Number(event.target.value) || 1 })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <label className="text-[12px] font-medium text-ink-2" htmlFor="multisig-threshold">Threshold</label>
              <Input id="multisig-threshold" label="Threshold" placeholder="M-of-N" type="number" min="1" value={threshold} onChange={(event) => setThreshold(Number(event.target.value) || 1)} />
              <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-[12px] text-ink-2">
                <p>Total weight: {totalWeight}</p>
                <p className={cn("mt-1", valid ? "text-success" : "text-red")}>{valid ? "Threshold is valid" : "Threshold exceeds available weight"}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <h4 className="text-[13px] font-semibold text-ink">Build transaction</h4>
              <p className="mt-1 text-[12px] text-ink-3">Compose an XDR payload for the selected signers and threshold.</p>
              <textarea id="multisig-xdr" rows={8} value={xdr} onChange={(event) => setXdr(event.target.value)} className="mt-3 w-full rounded-lg border border-line bg-surface px-4 py-3 text-[13px] font-mono text-ink" />
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <label className="text-[12px] font-medium text-ink-2" htmlFor="multisig-status">Status</label>
              <Input id="multisig-status" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
              <label className="mt-3 block text-[12px] font-medium text-ink-2" htmlFor="multisig-notes">Notes</label>
              <textarea id="multisig-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink" />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            {signers.map((signer, index) => (
              <div key={signer.id} className="rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{signer.address || `Signer ${index + 1}`}</p>
                    <p className="text-[12px] text-ink-3">Weight {signer.weight}</p>
                  </div>
                  <Button variant={signer.signed ? "primary" : "secondary"} size="sm" onClick={() => toggleSignerSigned(index)}>
                    {signer.signed ? "Signed" : "Pending"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <h4 className="text-[13px] font-semibold text-ink">Final confirmation</h4>
              <p className="mt-1 text-[12px] text-ink-3">Review the configured signers, threshold, XDR, and signature state before submission.</p>
              <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-[12px] text-ink-2">
                <p>Threshold: {threshold} of {signers.length}</p>
                <p>Total weight: {totalWeight}</p>
                <p>Status: {status}</p>
                <p>Signed: {signers.filter((signer) => signer.signed).length}/{signers.length}</p>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <p className="text-[12px] font-semibold text-ink">Transaction notes</p>
              <p className="mt-1 text-[12px] text-ink-3">{notes || "No notes provided."}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <p className="text-[12px] font-semibold text-ink">Prepared XDR</p>
              <pre className="mt-2 whitespace-pre-wrap break-all text-[12px] font-mono text-ink-2">{xdr}</pre>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-line px-6 py-4">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={prevStep} disabled={step === 0}>Previous</Button>
          <Button
            size="sm"
            onClick={nextStep}
            disabled={step === 3 || (step === 0 && !valid)}
          >
            Next
          </Button>
        </div>
        <p className="text-[12px] text-ink-3">Last updated {formatTimestamp(new Date().toISOString())}</p>
      </div>
    </div>
  );
}
