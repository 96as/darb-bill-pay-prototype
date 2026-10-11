import { describe, expect, it } from "vitest";
import { hasArabic, scriptOf, stripInvisible, toLatinDigits } from "./text";

describe("text helpers", () => {
  it("converts Arabic-Indic and Persian digits and separators", () => {
    expect(toLatinDigits("٤٥٬٠٠٠٫٠٠")).toBe("45,000.00");
    expect(toLatinDigits("۱۲۳")).toBe("123");
    expect(toLatinDigits("INV-2026")).toBe("INV-2026");
  });

  it("strips bidi and zero-width marks", () => {
    expect(stripInvisible("‏SA67​ 1000‬")).toBe("SA67 1000");
  });

  it("detects the dominant script", () => {
    expect(hasArabic("Cool Breeze | شركة")).toBe(true);
    expect(hasArabic("Cool Breeze 123")).toBe(false);
    expect(scriptOf("شركة النسيم البارد")).toBe("arabic");
    expect(scriptOf("Cool Breeze HVAC")).toBe("latin");
    expect(scriptOf("مكيف LG")).toBe("arabic");
    expect(scriptOf("123 - 456")).toBe("none");
  });
});
