import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { downloadAuditLog, useAuditLog } from "@/lib/audit-log";
import { requestOnboardingReplay } from "@/lib/onboarding";
import {
  type DisplayCurrency,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  setPreferences,
  SUPPORTED_CURRENCIES,
  usePreferences,
} from "@/lib/preferences";

export function SettingsScreen() {
  const { fontScale, reduceMotion, currency } = usePreferences();
  const auditLog = useAuditLog();
  // Newest first, so the latest activity is what you see without scrolling.
  const recentFirst = [...auditLog].reverse();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Accessibility</CardTitle>
          <CardDescription>
            Adjust the interface size and motion. Changes apply right away and
            are remembered on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label
              htmlFor="font-scale"
              className="flex items-center justify-between text-[13px] font-medium text-ink"
            >
              <span>Font size</span>
              <span data-testid="font-scale-value" className="text-ink-2">
                {fontScale}%
              </span>
            </label>
            <input
              id="font-scale"
              type="range"
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={FONT_SCALE_STEP}
              value={fontScale}
              onChange={(e) =>
                setPreferences({ fontScale: Number(e.target.value) })
              }
              className="mt-2 w-full accent-brand"
            />
          </div>
          <label
            htmlFor="reduce-motion"
            className="flex items-center gap-2.5 text-[13px] font-medium text-ink"
          >
            <input
              id="reduce-motion"
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) =>
                setPreferences({ reduceMotion: e.target.checked })
              }
              className="h-4 w-4 accent-brand"
            />
            Reduce motion
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Display currency</CardTitle>
          <CardDescription>
            The fiat currency used for balance values. Remembered on this
            device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="display-currency"
            className="block text-[13px] font-medium text-ink"
          >
            Currency
          </label>
          <select
            id="display-currency"
            value={currency}
            onChange={(e) =>
              setPreferences({ currency: e.target.value as DisplayCurrency })
            }
            className="mt-2 h-9 rounded-lg border border-line-2 bg-surface-2 px-3 text-[13px] text-ink"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Wallet connections, disconnections and sent payments recorded on
            this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentFirst.length === 0 ? (
            <p className="text-[13px] text-ink-3">No activity recorded yet.</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-[12px]">
                <caption className="sr-only">
                  Audit log, {recentFirst.length}{" "}
                  {recentFirst.length === 1 ? "entry" : "entries"}, newest first
                </caption>
                <thead className="bg-surface-2 text-ink-2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentFirst.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-ink-2">
                        <time dateTime={entry.timestamp}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </time>
                      </td>
                      <td className="px-3 py-2 text-ink">{entry.action}</td>
                      <td className="px-3 py-2 break-all text-ink-2">
                        {entry.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button
            variant="secondary"
            disabled={auditLog.length === 0}
            onClick={() => downloadAuditLog(auditLog)}
          >
            Export audit log
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>
            Walk through the key features of the dashboard again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={requestOnboardingReplay}>
            Replay tutorial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
