import {
  pgTable,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "../utils.js";

export const planEnum = pgEnum("plan", ["starter", "pro", "agency", "enterprise"]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: planEnum("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(usersTable),
  projects: many(projectsTable),
  billing: many(billingTable),
}));

// Forward-reference via lazy imports to avoid circular dep issues at type level
// These are resolved at runtime by Drizzle's relations system
import { users as usersTable } from "./users.js";
import { projects as projectsTable } from "./projects.js";
import { billing as billingTable } from "./billing.js";
