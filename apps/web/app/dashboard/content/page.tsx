import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export default function ContentPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Content"
        description="Audit, optimize, and track performance of your content pages."
      />
      <div className="flex justify-center pt-4">
        <Card className="w-full max-w-lg border">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
              <FileText className="h-7 w-7" />
            </div>
            <Badge variant="info" className="mb-3">Coming Soon</Badge>
            <h2 className="text-base font-semibold">Content Module</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Content scoring, optimization suggestions, and performance tracking are on the roadmap.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
