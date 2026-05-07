import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { organizations, users, billing } from "@garage-seo/db";
import { eq } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import * as schema from "@garage-seo/db";

function getDb() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });
  return drizzle(pool, { schema });
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env["CLERK_WEBHOOK_SECRET"];
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: WebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case "organization.created": {
      const { id, name, slug } = event.data;
      const orgSlug = slug ?? id;

      await db
        .insert(organizations)
        .values({
          id: createId(),
          name,
          slug: orgSlug,
          plan: "starter",
        })
        .onConflictDoNothing();

      // Create starter billing record
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, orgSlug))
        .limit(1);

      if (org) {
        await db
          .insert(billing)
          .values({
            id: createId(),
            orgId: org.id,
            plan: "starter",
            status: "active",
          })
          .onConflictDoNothing();
      }
      break;
    }

    case "organization.updated": {
      const { id, name, slug } = event.data;
      await db
        .update(organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(organizations.slug, (slug ?? id) as string));
      break;
    }

    case "organization.deleted": {
      const { id } = event.data;
      if (id) await db.delete(organizations).where(eq(organizations.slug, id));
      break;
    }

    case "organizationMembership.created": {
      const { organization, public_user_data, role } = event.data;
      const clerkUserId = public_user_data.user_id;
      const email = public_user_data.identifier;

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, (organization.slug ?? organization.id) as string))
        .limit(1);

      if (org) {
        const mappedRole =
          role === "org:admin" ? "admin" : role === "org:editor" ? "editor" : "viewer";

        await db
          .insert(users)
          .values({
            id: createId(),
            orgId: org.id,
            clerkUserId,
            email: email ?? "",
            role: mappedRole,
          })
          .onConflictDoUpdate({
            target: users.clerkUserId,
            set: { orgId: org.id, role: mappedRole, updatedAt: new Date() },
          });
      }
      break;
    }

    case "organizationMembership.updated": {
      const { role, public_user_data } = event.data;
      const clerkUserId = public_user_data.user_id;
      const mappedRole =
        role === "org:admin" ? "admin" : role === "org:editor" ? "editor" : "viewer";

      await db
        .update(users)
        .set({ role: mappedRole, updatedAt: new Date() })
        .where(eq(users.clerkUserId, clerkUserId));
      break;
    }

    case "organizationMembership.deleted": {
      const { public_user_data } = event.data;
      await db
        .delete(users)
        .where(eq(users.clerkUserId, public_user_data.user_id));
      break;
    }

    case "user.deleted": {
      const { id } = event.data;
      if (id) await db.delete(users).where(eq(users.clerkUserId, id));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
