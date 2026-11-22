import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import {
  applyPayload,
  buildPayload,
  decryptKeystore,
  downloadKeystore,
  encryptKeystore,
  KeystoreError,
  type KeystorePayload,
  MIN_PASSWORD_LENGTH,
  parseKeystoreFile,
} from "@/lib/keystore";

type Status = { kind: "success" | "error"; message: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.kind === "error" ? "alert" : "status"}
      className={`text-[12px] ${status.kind === "error" ? "text-red" : "text-green"}`}
    >
      {status.message}
    </p>
  );
}

/**
 * Password-protected account backup (#1160): export an encrypted keystore file
 * and restore from one. Everything happens locally in the browser.
 */
export function KeystoreBackup() {
  const { address, network, walletName, customNetworks } = useSorokit();

  // Export
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<Status>(null);

  // Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<Status>(null);
  const [restored, setRestored] = useState<KeystorePayload | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const passwordError =
    password && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : undefined;
  const confirmError =
    confirm && confirm !== password ? "Passwords do not match." : undefined;
  const canExport =
    !!address &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm &&
    !exporting;

  const handleExport = async () => {
    if (!address) return;
    setExporting(true);
    setExportStatus(null);
    try {
      const payload = buildPayload({
        address,
        // Custom networks carry their endpoints, so keep the whole object;
        // built-ins restore from their name alone.
        network:
          network && customNetworks?.some((n) => n.name === network.name)
            ? network
            : (network?.name ?? null),
        walletName,
        customNetworks,
        secretKey,
      });
      const file = await encryptKeystore(payload, password);
      downloadKeystore(file, address);
      setExportStatus({
        kind: "success",
        message: "Encrypted keystore downloaded. Store it somewhere safe and remember your password.",
      });
      setPassword("");
      setConfirm("");
      setSecretKey("");
    } catch (e) {
      setExportStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportStatus(null);
    setRestored(null);
    setShowSecret(false);
    try {
      const file = parseKeystoreFile(await importFile.text());
      const payload = await decryptKeystore(file, importPassword);
      applyPayload(payload);
      setRestored(payload);
      setImportStatus({
        kind: "success",
        message: "Backup restored. Reload the app to apply the restored settings.",
      });
      setImportPassword("");
    } catch (e) {
      setImportStatus({
        kind: "error",
        message:
          e instanceof KeystoreError || e instanceof Error
            ? e.message
            : "Import failed.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border-line bg-surface" data-testid="keystore-backup">
      <CardHeader>
        <CardTitle>Backup &amp; Restore</CardTitle>
        <CardDescription>
          Export your account data to an encrypted file, so you can recover it
          if your wallet extension breaks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          role="note"
          data-testid="keystore-warning"
          className="rounded-lg border border-warning-dim bg-warning-dim px-3.5 py-3 text-[12px] text-ink-2 space-y-1"
        >
          <p className="font-semibold text-warning">Keep this file private</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Anyone with the file and its password can read what is inside.</li>
            <li>
              If you forget the password the backup cannot be recovered — there
              is no reset.
            </li>
            <li>
              Never share your password or store it next to the file. Only
              include a secret key if you understand the risk.
            </li>
          </ul>
        </div>

        {/* Export */}
        <section className="space-y-3" aria-label="Export keystore">
          <h3 className="text-[13px] font-semibold text-ink">Export keystore</h3>
          <Input
            type="password"
            label="Backup password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />
          <Input
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirmError}
          />
          <Input
            type="password"
            label="Secret key (optional)"
            autoComplete="off"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            hint="Leave empty to back up account settings only. Your wallet extension keeps your signing keys."
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExport}
              disabled={!canExport}
              loading={exporting}
              data-testid="keystore-export-button"
            >
              Export encrypted keystore
            </Button>
            {!address && (
              <span className="text-[12px] text-ink-3">Connect a wallet to export.</span>
            )}
          </div>
          <StatusLine status={exportStatus} />
        </section>

        <div className="border-t border-line" />

        {/* Import */}
        <section className="space-y-3" aria-label="Import keystore">
          <h3 className="text-[13px] font-semibold text-ink">Restore from backup</h3>
          <div className="flex flex-col gap-1">
            <label htmlFor="keystore-file" className="text-[12px] text-ink-2">
              Keystore file
            </label>
            <input
              id="keystore-file"
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setImportStatus(null);
                setRestored(null);
              }}
              className="text-[12px] text-ink-2"
              data-testid="keystore-file-input"
            />
          </div>
          <Input
            type="password"
            label="Backup password"
            autoComplete="current-password"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={handleImport}
            disabled={!importFile || !importPassword || importing}
            loading={importing}
            data-testid="keystore-import-button"
          >
            Restore backup
          </Button>
          <StatusLine status={importStatus} />

          {restored && (
            <div
              className="rounded-lg border border-line bg-surface-2 p-3.5 space-y-2 text-[12px]"
              data-testid="keystore-restored"
            >
              <p className="text-ink-3">Restored account</p>
              <p className="font-mono text-ink break-all">{restored.address}</p>
              {restored.secretKey && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    className="text-brand hover:underline"
                  >
                    {showSecret ? "Hide secret key" : "Reveal secret key"}
                  </button>
                  {showSecret && (
                    <p className="font-mono text-ink break-all">{restored.secretKey}</p>
                  )}
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
