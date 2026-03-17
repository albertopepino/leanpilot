import { create } from "zustand";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

/**
 * Top 20 currencies, EUR first for European market focus.
 */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "PLN", symbol: "z\u0142", name: "Polish Zloty" },
  { code: "CZK", symbol: "K\u010D", name: "Czech Koruna" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "BGN", symbol: "\u043B\u0432", name: "Bulgarian Lev" },
  { code: "RSD", symbol: "din.", name: "Serbian Dinar" },
  { code: "TRY", symbol: "\u20BA", name: "Turkish Lira" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen" },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan" },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
];

const STORAGE_KEY = "leanpilot_currency";

interface CurrencyStore {
  currency: CurrencyInfo;
  setCurrency: (code: string) => void;
  initCurrency: () => void;
  /** Format a number with the current currency symbol */
  formatAmount: (amount: number) => string;
}

function findCurrency(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

export const useCurrency = create<CurrencyStore>((set, get) => ({
  currency: CURRENCIES[0], // EUR default

  initCurrency: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      set({ currency: findCurrency(saved) });
    }
  },

  setCurrency: (code: string) => {
    const info = findCurrency(code);
    localStorage.setItem(STORAGE_KEY, code);
    set({ currency: info });
  },

  formatAmount: (amount: number) => {
    const { currency } = get();
    return `${currency.symbol}${amount.toLocaleString()}`;
  },
}));
