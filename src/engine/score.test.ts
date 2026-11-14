import { describe, expect, it } from "vitest";
import { calculateScore } from "./score";

describe("calculateScore", () => {
  it("subtracts elapsed time, wrong answers, and only searches beyond the minimum", () => {
    expect(
      calculateScore({
        elapsedSeconds: 90,
        wrongAttempts: 1,
        searches: 6,
        minimumSearches: 3,
      }),
    ).toBe(745);
    expect(
      calculateScore({
        elapsedSeconds: 90,
        wrongAttempts: 0,
        searches: 1,
        minimumSearches: 3,
      }),
    ).toBe(910);
  });
  it("keeps the score within 0–1000 and discards fractional elapsed seconds", () => {
    expect(
      calculateScore({
        elapsedSeconds: 5000,
        wrongAttempts: 3,
        searches: 10,
        minimumSearches: 2,
      }),
    ).toBe(0);
    expect(
      calculateScore({
        elapsedSeconds: -5,
        wrongAttempts: -2,
        searches: -1,
        minimumSearches: -2,
      }),
    ).toBe(1000);
    expect(
      calculateScore({
        elapsedSeconds: 4.9,
        wrongAttempts: 0,
        searches: 0,
        minimumSearches: 0,
      }),
    ).toBe(996);
  });
  it("never returns NaN or infinite scores for corrupted inputs", () => {
    expect(
      calculateScore({
        elapsedSeconds: Infinity,
        wrongAttempts: 0,
        searches: 0,
        minimumSearches: 0,
      }),
    ).toBe(0);
    expect(
      calculateScore({
        elapsedSeconds: NaN,
        wrongAttempts: 0,
        searches: 0,
        minimumSearches: 0,
      }),
    ).toBe(0);
  });
});
