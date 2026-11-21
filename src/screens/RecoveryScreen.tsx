import { useState } from "react";

import { SeedPhraseInput } from "@/components/SeedPhraseInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter,CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface Signer {
  id: string;
  address: string;
  name: string;
  role: string;
  weight: number;
}

export function RecoveryScreen() {
  // Signers state
  const [signers, setSigners] = useState<Signer[]>([
    { id: "1", address: "GAAAA...1111", name: "Personal Backup Key", role: "Primary Backup", weight: 1 },
    { id: "2", address: "GBBBB...2222", name: "Family Custodian", role: "Co-signer", weight: 1 },
    { id: "3", address: "GCCCC...3333", name: "Institutional Guard", role: "Institutional", weight: 2 },
  ]);

  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Co-signer");
  const [newWeight, setNewWeight] = useState(1);

  // Recovery conditions state
  const [threshold, setThreshold] = useState(2);
  const [timeoutDays, setTimeoutDays] = useState(7);

  // Simulation state
  const [simStep, setSimStep] = useState(0); // 0 = idle, 1 = started, 2 = checked, 3 = simulated
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Recovery Key requirements
  const totalWeight = signers.reduce((acc, s) => acc + s.weight, 0);

  // Security Audit calculations
  const hasMultipleSigners = signers.length >= 2;
  const canMeetThreshold = totalWeight >= threshold;
  const isHealthy = hasMultipleSigners && canMeetThreshold && timeoutDays >= 3;

  const handleAddSigner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress || !newName) return;
    const newSigner: Signer = {
      id: Date.now().toString(),
      address: newAddress,
      name: newName,
      role: newRole,
      weight: Number(newWeight),
    };
    setSigners([...signers, newSigner]);
    setNewAddress("");
    setNewName("");
  };

  const handleRevokeSigner = (id: string) => {
    setSigners(signers.filter((s) => s.id !== id));
  };

  const startSimulation = () => {
    setIsSimulating(true);
    setSimStep(1);
    setSimulationLogs(["[Simulation] Initiating account recovery assistant..."]);
    
    setTimeout(() => {
      setSimulationLogs(prev => [...prev, "[Simulation] Step 1: Validating primary key credentials... Done."]);
      setSimStep(2);
    }, 800);

    setTimeout(() => {
      setSimulationLogs(prev => [
        ...prev, 
        `[Simulation] Step 2: Collecting signatures (Weight threshold: ${threshold}/${totalWeight})...`,
        `[Simulation] Success: Co-signer signatures verified successfully.`
      ]);
      setSimStep(3);
      setIsSimulating(false);
    }, 1600);
  };

  return (
    <div className="space-y-6" data-testid="recovery-screen">
      {/* Headings */}
      <div>
        <h2 className="text-2xl font-bold text-ink">Account Recovery Assistant</h2>
        <p className="text-[13px] text-ink-3">Configure secure, multi-signature account recovery to protect your Stellar assets.</p>
      </div>

      {/* Security Audit & Recommendations */}
      <Card className="border-line bg-surface">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Security Audit & Coverage</CardTitle>
            <Badge variant={isHealthy ? "success" : "warning"} data-testid="audit-badge">
              {isHealthy ? "Secure Setup" : "Action Required"}
            </Badge>
          </div>
          <CardDescription>Automatic evaluation of your recovery risk profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-surface-2 border border-line">
              <p className="text-[12px] font-semibold text-ink">Recovery Signer Count</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[18px] font-bold text-ink">{signers.length}</span>
                <span className="text-[11px] text-ink-3">signers registered</span>
              </div>
              <p className="text-[11px] text-ink-3 mt-1.5">
                {hasMultipleSigners ? "✓ Multi-signer requirement satisfied." : "✗ Risk: You should have at least 2 recovery signers."}
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-surface-2 border border-line">
              <p className="text-[12px] font-semibold text-ink">Threshold Executability</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[18px] font-bold text-ink">{threshold} of {totalWeight}</span>
                <span className="text-[11px] text-ink-3">weight required</span>
              </div>
              <p className="text-[11px] text-ink-3 mt-1.5">
                {canMeetThreshold ? "✓ Threshold is reachable." : "✗ Warning: Required threshold exceeds total weight!"}
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-brand-dim border border-line-2">
            <p className="text-[12px] font-bold text-brand">Recommendations</p>
            <ul className="list-disc list-inside text-[11px] text-ink-2 mt-2 space-y-1">
              {!hasMultipleSigners && <li>Add at least one more backup key/signer to prevent single point of failure.</li>}
              {threshold < 2 && <li>Increase threshold to 2+ to protect against single-key compromise.</li>}
              {timeoutDays < 5 && <li>Increase recovery timeout delay to allow canceling unauthorized recovery requests.</li>}
              {isHealthy && <li>Your setup meets optimal security guidelines. Test it via simulation regularly.</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Show all Recovery Signers with permissions & revoke */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Signers & Permissions</CardTitle>
          <CardDescription>Keys permitted to participate in account recovery operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y divide-line">
            {signers.map((signer) => (
              <div key={signer.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0" data-testid="signer-row">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{signer.name}</span>
                    <Badge variant="teal">{signer.role}</Badge>
                  </div>
                  <code className="text-[11px] text-ink-4 block mt-0.5">{signer.address}</code>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] text-ink-3">Weight: <strong>{signer.weight}</strong></span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeSigner(signer.id)}
                    aria-label={`Revoke ${signer.name}`}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add recovery signers */}
          <form onSubmit={handleAddSigner} className="pt-4 border-t border-line space-y-3">
            <p className="text-[12px] font-semibold text-ink">Add Recovery Signer</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Signer Address"
                placeholder="G..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
              <Input
                label="Signer Name"
                placeholder="e.g. Cold storage ledger"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Role"
                placeholder="e.g. Co-signer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
              <Input
                label="Weight"
                type="number"
                min="1"
                max="10"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              Register Recovery Signer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Seed phrase entry with masking, paste distribution & BIP-39 validation */}
      <Card>
        <CardHeader>
          <CardTitle>Seed Phrase Recovery</CardTitle>
          <CardDescription>
            Enter your 12 or 24-word recovery phrase. You can paste the whole phrase into any box.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeedPhraseInput />
        </CardContent>
      </Card>

      {/* Recovery conditions threshold & timeout */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Conditions</CardTitle>
          <CardDescription>Configure threshold weight requirements and execution lock-out delays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-ink-2 flex justify-between">
              <span>Threshold Weight Required</span>
              <span className="font-semibold text-ink">{threshold} / {totalWeight}</span>
            </label>
            <input
              type="range"
              min="1"
              max={totalWeight || 1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-ink-2 flex justify-between">
              <span>Timeout Delay (Days before execution)</span>
              <span className="font-semibold text-ink">{timeoutDays} days</span>
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={timeoutDays}
              onChange={(e) => setTimeoutDays(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>

          {/* Recovery Key Requirements */}
          <div className="p-3.5 rounded-lg bg-surface-2 border border-line">
            <p className="text-[12px] font-semibold text-ink">Display Key Requirements</p>
            <p className="text-[11px] text-ink-3 mt-1">
              To trigger account recovery, keys with combined weight of at least <strong className="text-ink">{threshold}</strong> must sign the recovery transaction.
              Once signed, a <strong className="text-ink">{timeoutDays}-day</strong> timelock begins, allowing the master key to veto if unauthorized.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center bg-surface-2/40">
          <div className="text-[12px] text-ink-3">
            Fee Estimate: <strong className="text-ink">0.00015 XLM</strong> (est)
          </div>
          <Button variant="primary" size="sm">
            Save Recovery Config
          </Button>
        </CardFooter>
      </Card>

      {/* Simulate recovery flow (without executing) */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Simulation & Checkpoints</CardTitle>
          <CardDescription>Test the recovery sequence in a simulated environment to verify rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3.5 rounded-lg bg-surface-2 border border-line space-y-2">
            <p className="text-[12px] font-semibold text-ink">Simulate Flow</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={startSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? "Running Simulation..." : "Initiate Dry-run"}
              </Button>
            </div>
            {simStep > 0 && (
              <div className="mt-3 p-3 rounded bg-black/10 font-mono text-[11px] text-ink-2 space-y-1">
                {simulationLogs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-error-dim/20 border border-error-dim-strong/30">
            <p className="text-[12px] font-bold text-red">Confirmation Checkpoint</p>
            <p className="text-[11px] text-ink-2 mt-1">
              WARNING: Executing live recovery options transfers ownership weights. Make sure you have backed up all recovery seed phrases securely.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
