import { randomBytes } from "crypto";

// Generate a URL-safe, sortable ID (similar to CUID2 but no dependency needed)
export function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("base64url");
  return `${timestamp}${random}`;
}
