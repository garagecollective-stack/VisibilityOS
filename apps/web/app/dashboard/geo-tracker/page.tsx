import { Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GeoTrackerPage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GEO Tracker</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Track your AI and generative search visibility across countries and regions.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Globe className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-base font-semibold">GEO Tracker coming soon</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Monitor how your brand appears in AI-generated search results across different geographies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
