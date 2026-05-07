import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your SEO performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Overall Health", value: "—", sub: "Unified SEO score" },
          { label: "Tracked Keywords", value: "—", sub: "Active keywords" },
          { label: "Avg. Position", value: "—", sub: "All keywords" },
          { label: "Visibility Score", value: "—", sub: "Organic visibility" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Rank Movements (7d)</h2>
          <p className="text-sm text-muted-foreground">Connect a project to see rank data.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Recent Alerts</h2>
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        </div>
      </div>
    </div>
  );
}
