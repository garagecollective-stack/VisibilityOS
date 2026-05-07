import { config } from "dotenv";
import { resolve } from "path";
import type { Config } from "drizzle-kit";

config({ path: resolve(process.cwd(), "../../.env") });

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://user:pass@localhost:5432/garage_seo",
  },
  verbose: true,
  strict: true,
} satisfies Config;
