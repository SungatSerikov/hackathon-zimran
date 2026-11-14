import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("normalizes capitalization, punctuation, and whitespace", () => {
    expect(normalize("  ARBOR,   Repairs!  ")).toBe("arbor repairs");
    expect(normalize("O’Neill's")).toBe("oneills");
  });
  it("uses only digits for phone numbers", () => {
    expect(normalize("(555) 010-4471", "phone")).toBe("5550104471");
    expect(normalize("+1 (555) 010-4471", "phone")).toBe("15550104471");
  });
  it("ignores spaces and punctuation in order identifiers", () => {
    expect(normalize(" #AB - 901 ", "order")).toBe("ab901");
    expect(normalize("СЧ-901", "order")).toBe("сч901");
  });
});
