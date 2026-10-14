import { createHash } from "node:crypto";

export function sha256Content(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
