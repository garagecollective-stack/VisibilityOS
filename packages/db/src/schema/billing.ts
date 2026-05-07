import {
  pgTable,
  text,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { createId } from "../utils.js";

export const billingStatusEnum = pgEnum("billing_status", [
  "active",
  "past_due",
  "cancelled",
  "trialing",
]);

export const billing = pgTable("billing", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("starter"),
  status: billingStatusEnum("status").notNull().default("active"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const billingRelations = relations(billing, ({ one }) => ({
  organization: one(organizations, {
    fields: [billing.orgId],
    references: [organizations.id],
  }),
}));
