import { createHash } from "node:crypto";

// bcrypt only processes the first 72 bytes; prehashing avoids silent password truncation.
export function passwordDigest(password: string) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}
