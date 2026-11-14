import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const folders: string[] = [];
const run = (files: string[] = []) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/validate-cases.ts", ...files],
    { encoding: "utf8" },
  );

afterEach(() => {
  folders
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }));
});

describe("case validation command", () => {
  it("validates both shipped playable cases and prints their shortest paths", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("tutorial.json");
    expect(result.stdout).toContain("main.json");
    expect(result.stdout.match(/Minimum: \d+ searches/g)).toHaveLength(2);
    expect(result.stdout.match(/Path: /g)).toHaveLength(2);
  });
  it("fails the process for invalid JSON and gives the file path", () => {
    const folder = mkdtempSync(join(tmpdir(), "case-desk-validation-"));
    folders.push(folder);
    const file = join(folder, "broken.json");
    writeFileSync(file, "{broken");
    const result = run([file]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(file);
  });
  it("fails the process for malformed case schema", () => {
    const folder = mkdtempSync(join(tmpdir(), "case-desk-validation-"));
    folders.push(folder);
    const file = join(folder, "invalid.json");
    writeFileSync(file, JSON.stringify({ title: "An invalid case" }));
    const result = run([file]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("claim");
  });
});
