import { describe, it, expect, beforeEach } from "vitest";
import { useTheme } from "@/stores/useTheme";
import { useCurrency, CURRENCIES } from "@/stores/useCurrency";

describe("useTheme store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useTheme.setState({ theme: "light" });
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("has light as default theme", () => {
    const { theme } = useTheme.getState();
    expect(theme).toBe("light");
  });

  it("setTheme changes the theme to dark", () => {
    useTheme.getState().setTheme("dark");
    const { theme } = useTheme.getState();
    expect(theme).toBe("dark");
  });

  it("setTheme changes the theme to light", () => {
    useTheme.getState().setTheme("dark");
    useTheme.getState().setTheme("light");
    const { theme } = useTheme.getState();
    expect(theme).toBe("light");
  });

  it("setTheme persists to localStorage", () => {
    useTheme.getState().setTheme("dark");
    expect(localStorage.getItem("leanpilot_theme")).toBe("dark");
  });

  it("setTheme adds dark class to document element", () => {
    useTheme.getState().setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme removes dark class when set to light", () => {
    useTheme.getState().setTheme("dark");
    useTheme.getState().setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggleTheme switches from light to dark", () => {
    useTheme.getState().toggleTheme();
    expect(useTheme.getState().theme).toBe("dark");
  });

  it("toggleTheme switches from dark to light", () => {
    useTheme.getState().setTheme("dark");
    useTheme.getState().toggleTheme();
    expect(useTheme.getState().theme).toBe("light");
  });

  it("initTheme reads from localStorage", () => {
    localStorage.setItem("leanpilot_theme", "dark");
    useTheme.getState().initTheme();
    expect(useTheme.getState().theme).toBe("dark");
  });

  it("initTheme defaults to light if nothing saved", () => {
    useTheme.getState().initTheme();
    expect(useTheme.getState().theme).toBe("light");
  });
});

describe("useCurrency store", () => {
  beforeEach(() => {
    useCurrency.setState({ currency: CURRENCIES[0] });
    localStorage.clear();
  });

  it("has EUR as default currency", () => {
    const { currency } = useCurrency.getState();
    expect(currency.code).toBe("EUR");
    expect(currency.symbol).toBe("\u20AC");
  });

  it("setCurrency changes to USD", () => {
    useCurrency.getState().setCurrency("USD");
    const { currency } = useCurrency.getState();
    expect(currency.code).toBe("USD");
    expect(currency.symbol).toBe("$");
    expect(currency.name).toBe("US Dollar");
  });

  it("setCurrency persists to localStorage", () => {
    useCurrency.getState().setCurrency("GBP");
    expect(localStorage.getItem("leanpilot_currency")).toBe("GBP");
  });

  it("setCurrency falls back to EUR for unknown code", () => {
    useCurrency.getState().setCurrency("INVALID");
    const { currency } = useCurrency.getState();
    expect(currency.code).toBe("EUR");
  });

  it("formatAmount formats with current currency symbol", () => {
    const result = useCurrency.getState().formatAmount(1000);
    expect(result).toContain("\u20AC");
    expect(result).toContain("1");
  });

  it("formatAmount uses updated currency after setCurrency", () => {
    useCurrency.getState().setCurrency("USD");
    const result = useCurrency.getState().formatAmount(500);
    expect(result).toContain("$");
    expect(result).toContain("500");
  });

  it("initCurrency reads from localStorage", () => {
    localStorage.setItem("leanpilot_currency", "CHF");
    useCurrency.getState().initCurrency();
    expect(useCurrency.getState().currency.code).toBe("CHF");
  });

  it("initCurrency keeps EUR if nothing saved", () => {
    useCurrency.getState().initCurrency();
    expect(useCurrency.getState().currency.code).toBe("EUR");
  });

  it("CURRENCIES contains at least 20 entries", () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(20);
  });

  it("all CURRENCIES have required fields", () => {
    for (const c of CURRENCIES) {
      expect(c).toHaveProperty("code");
      expect(c).toHaveProperty("symbol");
      expect(c).toHaveProperty("name");
      expect(typeof c.code).toBe("string");
      expect(typeof c.symbol).toBe("string");
      expect(typeof c.name).toBe("string");
    }
  });
});
