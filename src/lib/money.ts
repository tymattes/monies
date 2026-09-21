// Amounts are integers in the currency's minor unit (cents for USD, whole yen
// for JPY). The API field is named `amountCents` regardless of currency.

const digitsCache = new Map<string, number>();

export function isValidCurrency(code: unknown): code is string {
  return (
    typeof code === "string" &&
    /^[A-Z]{3}$/.test(code) &&
    Intl.supportedValuesOf("currency").includes(code)
  );
}

export function minorDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    minor / 10 ** minorDigits(currency),
  );
}

// "500.00" style string for an editable input.
export function toInputString(minor: number, currency: string): string {
  const d = minorDigits(currency);
  return (minor / 10 ** d).toFixed(d);
}

// Parses user input ("1,250.5", "$40") into minor units, or null if invalid.
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = input.trim().replace(/^\p{Sc}\s*/u, "").replace(/[,\s]/g, "");
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const d = minorDigits(currency);
  const fraction = match[2] ?? "";
  if (fraction.length > d) return null;
  const minor = Number(match[1] + fraction.padEnd(d, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}
