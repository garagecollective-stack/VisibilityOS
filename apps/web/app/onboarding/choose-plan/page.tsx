"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Plan {
  id: string;
  name: string;
  price_inr: number | null;
  price_usd: number | null;
  projects: number;
  keywords: number;
  features: string[];
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price_inr: 0,
    price_usd: 0,
    projects: 1,
    keywords: 50,
    features: ["1 project", "50 keywords", "Keyword research", "Rank tracking", "Basic site audit"],
  },
  {
    id: "pro",
    name: "Pro",
    price_inr: 2999,
    price_usd: 36,
    projects: 5,
    keywords: 500,
    badge: "Popular",
    features: [
      "5 projects",
      "500 keywords",
      "Full site audit",
      "Backlink analysis",
      "Competitor tracking",
      "GSC + GA4 integration",
      "Email alerts",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price_inr: 7999,
    price_usd: 96,
    projects: 30,
    keywords: 3000,
    features: [
      "30 projects",
      "3,000 keywords",
      "Everything in Pro",
      "White-label reports",
      "GEO / AI visibility tracker",
      "PDF report generation",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_inr: null,
    price_usd: null,
    projects: Infinity,
    keywords: Infinity,
    features: [
      "Unlimited projects",
      "Unlimited keywords",
      "Everything in Agency",
      "Dedicated account manager",
      "Custom integrations",
      "SLA & uptime guarantee",
      "Custom onboarding & training",
    ],
  },
];

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
}

export default function ChoosePlanPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSelectPlan(planId: string) {
    if (planId === "starter") {
      router.push("/dashboard");
      return;
    }

    if (planId === "enterprise") {
      window.open("mailto:sales@garageseo.ai?subject=Enterprise%20Plan%20Inquiry", "_blank");
      return;
    }

    setLoading(planId);
    setError("");

    try {
      const token = await getToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

      // Create Razorpay order
      const res = await fetch(`${apiBase}/api/billing/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create order");
      }

      const { orderId, amount, currency, keyId } = await res.json() as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      // Load Razorpay script if not already loaded
      await loadRazorpayScript();

      const plan = PLANS.find((p) => p.id === planId)!;

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "Garage Collective SEO",
        description: `${plan.name} Plan — Monthly`,
        order_id: orderId,
        handler: async (response) => {
          // Verify payment on backend
          const verifyRes = await fetch(`${apiBase}/api/billing/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            }),
          });

          if (verifyRes.ok) {
            router.push("/dashboard?welcome=1");
          } else {
            setError("Payment verification failed. Please contact support.");
            setLoading(null);
          }
        },
        prefill: { name: organization?.name },
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => setLoading(null),
        },
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
        <span className="text-muted-foreground line-through">Create your workspace</span>
        <span>›</span>
        <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
        <span className="text-muted-foreground line-through">Add your first project</span>
        <span>›</span>
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
        <span className="font-medium text-foreground">Choose a plan</span>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Choose your plan</h1>
        <p className="text-muted-foreground">
          Start free, upgrade anytime. <span className="text-green-600 font-medium">88% cheaper</span> than Semrush & Ahrefs.
        </p>
      </div>

      <div className="grid gap-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={plan.badge ? "border-primary ring-1 ring-primary" : ""}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.badge && (
                  <Badge variant="default">{plan.badge}</Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                {plan.price_inr === 0 ? (
                  <span className="text-3xl font-bold">Free</span>
                ) : plan.price_inr === null ? (
                  <span className="text-3xl font-bold">Custom</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">₹{plan.price_inr?.toLocaleString("en-IN")}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                    <span className="text-muted-foreground text-xs ml-1">(${plan.price_usd} USD)</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.id === "pro" ? "default" : "outline"}
                disabled={loading !== null && loading !== plan.id}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {loading === plan.id
                  ? "Opening checkout…"
                  : plan.price_inr === 0
                  ? "Start for free →"
                  : plan.price_inr === null
                  ? "Contact Sales →"
                  : `Get ${plan.name} →`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Secure payment via Razorpay. Cancel anytime. No lock-in.
      </p>
    </div>
  );
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(script);
  });
}
