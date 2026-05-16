/* eslint-disable */
// One-time seed for the `locations` table.
// Fetches Google Ads locations from DataForSEO, filters to country_iso_code === 'IN',
// and inserts country + states + cities. Safe to re-run (ON CONFLICT DO NOTHING).
//
//   node packages/db/seeds/seed-locations.js
//
// Requires DATABASE_URL, DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD in the repo root .env.

const path = require("path");
const { config } = require("dotenv");
config({ path: path.resolve(__dirname, "../../../.env") });

const { Pool } = require("pg");

const DATAFORSEO_URL =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/locations";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required");
  }

  console.log("[seed-locations] Fetching locations from DataForSEO…");
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const res = await fetch(DATAFORSEO_URL, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO request failed (${res.status}): ${text}`);
  }
  const payload = await res.json();

  const items =
    (payload &&
      payload.tasks &&
      payload.tasks[0] &&
      payload.tasks[0].result) ||
    [];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      "DataForSEO returned no results — check API credentials and response shape."
    );
  }
  console.log(`[seed-locations] Got ${items.length} total locations from API.`);

  const indiaItems = items.filter((row) => row.country_iso_code === "IN");
  console.log(`[seed-locations] Filtered to ${indiaItems.length} India rows.`);

  const pool = new Pool({ connectionString });
  let inserted = 0;
  const counts = { Country: 0, State: 0, City: 0, Other: 0 };

  try {
    for (const row of indiaItems) {
      const locationCode = row.location_code;
      const locationName = row.location_name;
      const locationType = row.location_type;
      const countryIsoCode = row.country_iso_code;
      const parentCode =
        row.location_code_parent === undefined ? null : row.location_code_parent;

      if (counts[locationType] !== undefined) counts[locationType]++;
      else counts.Other++;

      const result = await pool.query(
        `INSERT INTO locations
         (location_code, location_name, location_type, country_iso_code, parent_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (location_code) DO NOTHING`,
        [locationCode, locationName, locationType, countryIsoCode, parentCode]
      );
      inserted += result.rowCount;
    }
  } finally {
    await pool.end();
  }

  console.log(`[seed-locations] Done. Inserted ${inserted} new rows.`);
  console.log(
    `[seed-locations] Source counts — Country: ${counts.Country}, State: ${counts.State}, City: ${counts.City}, Other: ${counts.Other}`
  );
}

main().catch((err) => {
  console.error("[seed-locations] FAILED:", err);
  process.exit(1);
});
