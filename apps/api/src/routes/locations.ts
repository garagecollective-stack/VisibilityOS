import "../types.js";
import { Hono } from "hono";
import { getDb } from "../lib/db/index.js";
import { locations } from "@garage-seo/db";
import { and, eq, inArray, asc } from "drizzle-orm";

const router = new Hono();

// DataForSEO names locations as "City,State,Country" — the dropdown only wants
// the leaf segment (e.g. "Delhi,India" -> "Delhi", "New Delhi,Delhi,India" -> "New Delhi").
function cleanName(name: string): string {
  const idx = name.indexOf(",");
  return idx === -1 ? name : name.slice(0, idx);
}

router.get("/countries", async (c) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        location_code: locations.locationCode,
        location_name: locations.locationName,
      })
      .from(locations)
      .where(eq(locations.locationType, "Country"))
      .orderBy(asc(locations.locationName));

    return c.json(
      rows.map((r) => ({ location_code: r.location_code, location_name: cleanName(r.location_name) }))
    );
  } catch (err) {
    console.error("[locations] /countries failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "DB error" }, 500);
  }
});

router.get("/states", async (c) => {
  try {
    const raw = c.req.query("country_code");
    if (!raw) return c.json({ error: "country_code is required" }, 400);
    const countryCode = parseInt(raw, 10);
    if (!Number.isFinite(countryCode)) {
      return c.json({ error: "country_code must be a number" }, 400);
    }

    const db = getDb();
    // Include Union Territory rows alongside State rows so dropdown matches user expectations
    // (e.g. Delhi is a UT in the underlying data but UI-wise belongs in the "state" list).
    const rows = await db
      .select({
        location_code: locations.locationCode,
        location_name: locations.locationName,
      })
      .from(locations)
      .where(
        and(
          eq(locations.parentCode, countryCode),
          inArray(locations.locationType, ["State", "Union Territory"])
        )
      )
      .orderBy(asc(locations.locationName));

    return c.json(
      rows.map((r) => ({ location_code: r.location_code, location_name: cleanName(r.location_name) }))
    );
  } catch (err) {
    console.error("[locations] /states failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "DB error" }, 500);
  }
});

router.get("/cities", async (c) => {
  try {
    const raw = c.req.query("state_code");
    if (!raw) return c.json({ error: "state_code is required" }, 400);
    const stateCode = parseInt(raw, 10);
    if (!Number.isFinite(stateCode)) {
      return c.json({ error: "state_code must be a number" }, 400);
    }

    const db = getDb();
    const rows = await db
      .select({
        location_code: locations.locationCode,
        location_name: locations.locationName,
      })
      .from(locations)
      .where(
        and(eq(locations.parentCode, stateCode), eq(locations.locationType, "City"))
      )
      .orderBy(asc(locations.locationName));

    return c.json(
      rows.map((r) => ({ location_code: r.location_code, location_name: cleanName(r.location_name) }))
    );
  } catch (err) {
    console.error("[locations] /cities failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "DB error" }, 500);
  }
});

export default router;
