import type { ScoreInput } from "../types";

export function calculateScore(input: ScoreInput): number {
  const values = [
    input.elapsedSeconds,
    input.wrongAttempts,
    input.searches,
    input.minimumSearches,
    input.hints === undefined ? 0 : input.hints,
  ];
  if (values.some((value) => !Number.isFinite(value))) return 0;
  const [seconds, wrong, searches, minimum, hints] = values.map((value) =>
    Math.max(0, Math.floor(value)),
  );
  return Math.max(
    0,
    1000 - seconds - 150 * wrong - 5 * Math.max(0, searches - minimum) - 50 * hints,
  );
}
