import { Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configure workspace preferences and notification settings.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Settings className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">Settings coming soon</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Workspace configuration, notifications, and team settings will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
