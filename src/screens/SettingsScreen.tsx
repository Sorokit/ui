import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { requestOnboardingReplay } from "@/lib/onboarding";

export function SettingsScreen() {
  return (
    <div className="flex flex-col gap-5">
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
