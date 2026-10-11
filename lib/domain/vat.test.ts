import { describe, expect, it } from "vitest";
import { isValidCr, isValidSaudiVat, normalizeDigits } from "./vat";

describe("Saudi VAT number", () => {
  it.each(["310458812300003", "311902476500003", "310387452600003", "310 3874 5260 0003", "٣١٠٣٨٧٤٥٢٦٠٠٠٠٣"])(
    "accepts %s",
    (v) => {
      expect(isValidSaudiVat(v)).toBe(true);
    },
  );

  it.each([
    ["14 digits", "31038745260003"],
    ["16 digits", "3103874526000033"],
    ["does not start with 3", "210387452600003"],
    ["does not end with 3", "310387452600002"],
    ["letters", "31038745260000A"],
    ["empty", ""],
  ])("refuses %s", (_label, v) => {
    expect(isValidSaudiVat(v)).toBe(false);
  });
});

describe("CR number", () => {
  it("accepts 10 digits", () => {
    expect(isValidCr("1010765432")).toBe(true);
    expect(isValidCr("1010 932 185")).toBe(true);
  });

  it("refuses other lengths and letters", () => {
    expect(isValidCr("101076543")).toBe(false);
    expect(isValidCr("10107654321")).toBe(false);
    expect(isValidCr("10107654X2")).toBe(false);
  });

  it("normalizes digits", () => {
    expect(normalizeDigits(" ١٠١٠-٧٦٥٤٣٢ ")).toBe("1010765432");
  });
});
