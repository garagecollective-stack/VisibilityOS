import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Generate and schedule automated SEO reports for clients and stakeholders.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Reports coming soon</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            White-label PDF reports, scheduled delivery, and client-ready dashboards are on the roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
