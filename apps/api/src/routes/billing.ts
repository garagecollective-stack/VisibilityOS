import "../types.js";
import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHmac } from "crypto";
import { getDb } from "../lib/db/index.js";
import { billing, organizations } from "@garage-seo/db";
import { eq } from "drizzle-orm";
import { createId } from "@garage-seo/db";

const router = new Hono();

// ─── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: "Starter",
    price_inr: 0,
    price_usd: 0,
    projects: -1,
    keywords: -1,
    features: ["keyword_research", "rank_tracking", "basic_audit"],
  },
  pro: {
    name: "Pro",
    price_inr: 2999,
    price_usd: 36,
    projects: -1,
    keywords: -1,
    features: ["keyword_research", "rank_tracking", "full_audit", "gsc_integration", "ga4_integration", "competitor_basic"],
  },
  agency: {
    name: "Agency",
    price_inr: 7999,
    price_usd: 96,
    projects: -1,
    keywords: -1,
    features: ["all_features", "white_label", "client_dashboards", "pdf_reports", "geo_tracker", "backlinks"],
  },
  enterprise: {
    name: "Enterprise",
    price_inr: null,
    price_usd: null,
    projects: -1,
    keywords: -1,
    features: ["all_features", "custom_integrations", "dedicated_support", "sla"],
  },
} as const;

function getRazorpay() {
  const Razorpay = require("razorpay") as typeof import("razorpay");
  return new Razorpay({
    key_id: process.env["RAZORPAY_KEY_ID"]!,
    key_secret: process.env["RAZORPAY_KEY_SECRET"]!,
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/plans", (c) => c.json({ plans: PLANS }));

router.get("/subscription", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const [sub] = await db.select().from(billing).where(eq(billing.orgId, orgId)).limit(1);
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });

  return c.json({
    subscription: sub ?? null,
    plan: org?.plan ?? "starter",
    limits: PLANS[org?.plan as keyof typeof PLANS] ?? PLANS.starter,
  });
});

// Create Razorpay order for plan upgrade
router.post(
  "/create-order",
  zValidator("json", z.object({ plan: z.enum(["pro", "agency"]) })),
  async (c) => {
    const { plan } = c.req.valid("json");
    const orgId = c.get("orgId");
    const db = getDb();

    const planData = PLANS[plan];
    if (!planData.price_inr) return c.json({ error: "Plan has no price" }, 400);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: planData.price_inr * 100, // paise
      currency: "INR",
      receipt: `${orgId.slice(0, 8)}_${plan}_${Date.now()}`,
      notes: { orgId, plan },
    });

    return c.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env["RAZORPAY_KEY_ID"]!,
    });
  }
);

// Verify payment after Razorpay checkout completes (client-side callback)
router.post(
  "/verify-payment",
  zValidator(
    "json",
    z.object({
      razorpay_payment_id: z.string(),
      razorpay_order_id: z.string(),
      razorpay_signature: z.string(),
      plan: z.enum(["pro", "agency"]),
    })
  ),
  async (c) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } =
      c.req.valid("json");
    const orgId = c.get("orgId");

    // Verify HMAC signature
    const secret = process.env["RAZORPAY_KEY_SECRET"]!;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = createHmac("sha256", secret).update(body).digest("hex");

    if (expectedSig !== razorpay_signature) {
      return c.json({ error: "Invalid payment signature" }, 400);
    }

    const db = getDb();

    // Activate plan
    await activatePlan(db, orgId, plan, razorpay_payment_id);

    return c.json({ success: true, plan });
  }
);

// Razorpay webhook (server-to-server, more reliable than client callback)
router.post("/webhook/razorpay", razorpayWebhookHandler);

export async function razorpayWebhookHandler(c: Context) {
  const signature = c.req.header("x-razorpay-signature");
  const secret = process.env["RAZORPAY_KEY_SECRET"]!;
  const body = await c.req.text();

  const expectedSig = createHmac("sha256", secret).update(body).digest("hex");
  if (signature !== expectedSig) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(body) as {
    event: string;
    payload: {
      payment?: {
        entity: {
          id: string;
          order_id: string;
          notes?: { orgId?: string; plan?: string };
          status: string;
        };
      };
      subscription?: {
        entity: {
          id: string;
          notes?: { orgId?: string; plan?: string };
          status: string;
        };
      };
    };
  };

  const db = getDb();

  if (event.event === "payment.captured") {
    const payment = event.payload.payment?.entity;
    if (!payment) return c.json({ received: true });

    const orgId = payment.notes?.orgId;
    const plan = payment.notes?.plan as "pro" | "agency" | undefined;

    if (orgId && plan && (plan === "pro" || plan === "agency")) {
      await activatePlan(db, orgId, plan, payment.id);
    }
  }

  if (event.event === "payment.failed") {
    const payment = event.payload.payment?.entity;
    const orgId = payment?.notes?.orgId;
    if (orgId) {
      await db
        .update(billing)
        .set({ status: "past_due" })
        .where(eq(billing.orgId, orgId));
    }
  }

  return c.json({ received: true });
}

async function activatePlan(
  db: ReturnType<typeof getDb>,
  orgId: string,
  plan: "pro" | "agency",
  paymentId: string
) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Upsert billing record
  const existing = await db
    .select()
    .from(billing)
    .where(eq(billing.orgId, orgId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(billing)
      .set({
        plan,
        status: "active",
        razorpaySubscriptionId: paymentId,
        currentPeriodEnd: periodEnd,
      })
      .where(eq(billing.orgId, orgId));
  } else {
    await db.insert(billing).values({
      id: createId(),
      orgId,
      plan,
      status: "active",
      razorpaySubscriptionId: paymentId,
      currentPeriodEnd: periodEnd,
    });
  }

  // Update organization plan
  await db
    .update(organizations)
    .set({ plan, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}

export default router;
