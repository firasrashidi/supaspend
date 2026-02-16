const API_BASE = "https://open.er-api.com/v6/latest";

/**
 * Fetch the latest exchange rate from one currency to another.
 * Uses ExchangeRate-API (open access, no key required, 165+ currencies).
 * Returns 1 when the currencies are the same (no API call).
 */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const res = await fetch(`${API_BASE}/${encodeURIComponent(from)}`);

  if (!res.ok) {
    throw new Error(`Exchange rate API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.result !== "success") {
    throw new Error(`Exchange rate API error: ${data["error-type"] || "unknown"}`);
  }

  const rate = data.rates?.[to];

  if (typeof rate !== "number") {
    throw new Error(`No rate found for ${from} -> ${to}`);
  }

  return rate;
}

/**
 * Convert an amount from one currency to another using the latest rate.
 * Returns the original amount when currencies match.
 */
export async function convert(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}
