// One-shot script that dumps the India location hierarchy from the local
// `locations` table into docs/india-seo-locations.md. Not part of the build.
//
//   npx tsx packages/db/seeds/generate-india-locations-md.ts

import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";

config({ path: resolve(__dirname, "../../../.env") });

import pg from "pg";

const states: Array<[string, number]> = [
  ["Andhra Pradesh", 20453],
  ["Arunachal Pradesh", 21289],
  ["Assam", 20454],
  ["Bihar", 20455],
  ["Chhattisgarh", 21334],
  ["Goa", 21268],
  ["Gujarat", 20457],
  ["Haryana", 20458],
  ["Himachal Pradesh", 21335],
  ["Jharkhand", 21336],
  ["Karnataka", 20460],
  ["Kerala", 20461],
  ["Madhya Pradesh", 20464],
  ["Maharashtra", 20462],
  ["Manipur", 21337],
  ["Meghalaya", 20463],
  ["Mizoram", 21338],
  ["Nagaland", 21339],
  ["Odisha", 20465],
  ["Punjab", 20466],
  ["Rajasthan", 20468],
  ["Sikkim", 21340],
  ["Tamil Nadu", 20469],
  ["Telangana", 9061642],
  ["Tripura", 20470],
  ["Uttar Pradesh", 20471],
  ["Uttarakhand", 21341],
  ["West Bengal", 20472],
];

// Jammu & Kashmir and Ladakh are reclassified to Union Territory here to match
// India's post-2019 administrative status. The legacy 'Daman and Diu' stub (0
// cities) is folded into the merged 'Dadra and Nagar Haveli and Daman and Diu'.
const uts: Array<[string, number]> = [
  ["Andaman and Nicobar Islands", 20452],
  ["Chandigarh", 21342],
  ["Dadra and Nagar Haveli and Daman and Diu", 21343],
  ["Delhi", 20456],
  ["Jammu and Kashmir", 20459],
  ["Ladakh", 9104077],
  ["Lakshadweep", 21345],
  ["Puducherry", 20467],
];

const CITIES_SQL = `
  WITH RECURSIVE descendants AS (
    SELECT location_code, location_name, location_type, parent_code
    FROM locations WHERE location_code = $1
    UNION ALL
    SELECT l.location_code, l.location_name, l.location_type, l.parent_code
    FROM locations l
    JOIN descendants d ON l.parent_code = d.location_code
  )
  SELECT location_name FROM descendants
  WHERE location_type = 'City'
  ORDER BY location_name
`;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

  async function getCities(rootCode: number): Promise<string[]> {
    const r = await pool.query(CITIES_SQL, [rootCode]);
    return r.rows.map((x: { location_name: string }) => x.location_name);
  }

  type Section = {
    name: string;
    type: "State" | "Union Territory";
    code: number;
    cities: string[];
  };
  const sections: Section[] = [];
  let totalCities = 0;

  for (const [name, code] of states) {
    const cities = await getCities(code);
    totalCities += cities.length;
    sections.push({ name, type: "State", code, cities });
  }
  for (const [name, code] of uts) {
    const cities = await getCities(code);
    totalCities += cities.length;
    sections.push({ name, type: "Union Territory", code, cities });
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push("# India — SEO Targeting Locations (DataForSEO / Google Ads)");
  lines.push("");
  lines.push(
    `Cascading Country → State/UT → City reference for keyword research targeting in India. Sourced from the live DataForSEO Google Ads Locations API (\`/v3/keywords_data/google_ads/locations\`) seeded into the local \`locations\` table on ${today}. Use the full comma-delimited \`location_name\` strings below when calling DataForSEO endpoints directly.`
  );
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push("| States | 28 |");
  lines.push("| Union Territories | 8 |");
  lines.push(`| Cities (sum across all states + UTs) | ${totalCities.toLocaleString()} |`);
  lines.push(
    `| Grand total (28 + 8 + ${totalCities.toLocaleString()}) | ${(28 + 8 + totalCities).toLocaleString()} |`
  );
  lines.push("");
  lines.push(
    "> City counts are the **recursive** total under each state/UT — DataForSEO sometimes parents cities under intermediate District/Department/Division rows rather than directly under the state."
  );
  lines.push("");

  function renderSection(s: Section) {
    lines.push(`### ${s.name}`);
    lines.push(`**Type:** ${s.type}  `);
    lines.push(`**DataForSEO location_code:** ${s.code}  `);
    lines.push(`**Cities count:** ${s.cities.length}`);
    lines.push("");
    if (s.cities.length === 0) {
      lines.push(`_No \`location_type = City\` children in the DataForSEO dataset for this ${s.type.toLowerCase()}._`);
    } else {
      lines.push("| City Name |");
      lines.push("|-----------|");
      for (const c of s.cities) lines.push(`| ${c} |`);
    }
    lines.push("");
  }

  lines.push("## States");
  lines.push("");
  for (const s of sections.filter((x) => x.type === "State")) renderSection(s);

  lines.push("## Union Territories");
  lines.push("");
  for (const s of sections.filter((x) => x.type === "Union Territory")) renderSection(s);

  lines.push("## Verification Notes");
  lines.push("");
  lines.push(
    "Every city listed above is taken verbatim from DataForSEO's Google Ads Locations API response and is therefore an accepted Google Ads targeting location — no individual city names are flagged. The notes below cover administrative-classification edge cases where the DataForSEO dataset lags official Indian government reorganization."
  );
  lines.push("");
  lines.push(
    "1. **Jammu and Kashmir — reclassified to UT in this doc.** DataForSEO still tags `Jammu and Kashmir,India` (`location_code` 20459) with `location_type = State`. India officially reorganized it into a **Union Territory** on 31 October 2019. We list it under UTs here for accuracy, but the API still returns `State` if you call it directly."
  );
  lines.push(
    "2. **Ladakh — reclassified to UT; DataForSEO uses `location_type = Territory`.** `Ladakh,India` (`location_code` 9104077) is returned with `location_type = Territory`, not `Union Territory` or `State`. It was carved out of J&K on 31 October 2019 and is officially a Union Territory."
  );
  lines.push(
    "3. **Chandigarh — mis-parented in DataForSEO.** `Chandigarh,Ropar Division,India` (`location_code` 21342, `location_type = Union Territory`) has `parent_code = 9186248` (a `Department` row \"Ropar Division\") instead of being a direct child of India (`2356`). The current `/api/locations/states?country_code=2356` endpoint will **not** return Chandigarh because it joins on `parent_code = 2356`. Treat as a known gap; either special-case the code in app code or relax the parent filter."
  );
  lines.push(
    "4. **Daman and Diu — legacy duplicate, folded into the merged UT.** DataForSEO retains `Daman and Diu,India` (`location_code` 21344, 0 child cities) alongside the merged `Dadra and Nagar Haveli and Daman and Diu,India` (`location_code` 21343, populated). The two former UTs were merged on 26 January 2020. We omit the legacy stub from this doc — if you target the legacy code you will reach an empty city set."
  );
  lines.push(
    "5. **Telangana uses an out-of-range location_code (9061642).** Most Indian states use codes in the 20xxx / 21xxx range. Telangana was created on 2 June 2014, after Google Ads's original IN codes were assigned, and was added later with a different code range. This is expected behavior, not a data issue."
  );
  lines.push(
    "6. **Recursive city counts > direct children.** DataForSEO frequently parents cities under intermediate `District`, `Department`, `Division`, or `Region` rows rather than directly under the State/UT. The counts above walk the location-hierarchy graph recursively, which is what an SEO targeting tool should also do. The current `/api/locations/cities?state_code=...` endpoint only returns **direct** city children — switch it to a recursive query if you want the city set listed here to match what the API returns."
  );
  lines.push(
    "7. **Excluded location_types.** Only rows with `location_type = City` are listed. The seed dataset also contains 16,887 `Postal Code`, 311 `Neighborhood`, 94 `Department`, 31 `Region`, 16 `District`, 10 `Airport`, and a handful of `Municipality` / `City Region` / `Territory` rows under India — none are listed here because they are not typically usable as Google Ads city-level targeting."
  );
  lines.push("");

  const out = lines.join("\n");
  const dest = resolve(__dirname, "../../../india-seo-locations.md");
  writeFileSync(dest, out, "utf8");
  console.log(`wrote ${out.length} chars (${totalCities} city rows) to ${dest}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
