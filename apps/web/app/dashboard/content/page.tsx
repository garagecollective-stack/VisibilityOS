import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ContentPage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Audit, optimize, and track performance of your content pages.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Content module coming soon</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Content scoring, optimization suggestions, and performance tracking are on the roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
