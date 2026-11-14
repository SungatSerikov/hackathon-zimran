import type { SearchKind } from "../types";

/** All matching, including discovered clues, uses these same normalization rules. */
export function normalize(value: string, kind?: SearchKind): string {
  const lowered = value.toLowerCase();
  if (kind === "phone") return lowered.replace(/\D/g, "");
  if (kind === "order") return lowered.replace(/[^\p{L}\p{N}]/gu, "");
  return lowered
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .replace(/\s+/gu, " ");
}
