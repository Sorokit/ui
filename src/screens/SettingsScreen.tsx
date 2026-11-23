import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { requestOnboardingReplay } from "@/lib/onboarding";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  setPreferences,
  usePreferences,
} from "@/lib/preferences";

export function SettingsScreen() {
  const { fontScale, reduceMotion } = usePreferences();

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
