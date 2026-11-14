import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCase } from "../src/engine/validate";

// Premium JSON cards are catalog placeholders, never playable case inputs.
const defaults = ["tutorial.json", "main.json"].map((name) =>
  fileURLToPath(new URL(`../src/cases/${name}`, import.meta.url)),
);
const paths = process.argv.slice(2).length
  ? process.argv.slice(2).map((path) => resolve(path))
  : defaults;
let failed = false;

for (const path of paths) {
  try {
    const input: unknown = JSON.parse(readFileSync(path, "utf8"));
    const report = validateCase(input);
    if (!report.valid) {
      failed = true;
      console.error(`FAIL ${path}`);
      for (const error of report.errors) console.error(`  ${error}`);
    } else {
      console.log(`PASS ${path}`);
      console.log(
        `  Reachable: ${report.reachableDocumentIds.length} documents. Minimum: ${report.minimumSearches} searches.`,
      );
      console.log(
        `  Path: ${report.solutionPath.join(" → ") || "(already in the initial folder)"}`,
      );
    }
    for (const warning of report.warnings)
      console.warn(`  Warning: ${warning}`);
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failed) process.exitCode = 1;
