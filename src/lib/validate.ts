import { MAX_AMOUNT } from "./budgets";
import { HttpError } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Path ids that are not UUIDs can never match a row, so answer 404 up front.
export function uuidParam(value: string, what: string): string {
  if (!UUID.test(value)) throw new HttpError(404, `${what} not found`);
  return value;
}

// Integer minor units, e.g. amountCents. `min` is 0 for plans, 1 for deposits.
export function parseAmount(value: unknown, min = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > MAX_AMOUNT
  ) {
    throw new HttpError(
      400,
      `amountCents must be an integer between ${min} and ${MAX_AMOUNT}`,
    );
  }
  return value;
}

export function parseNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 200) {
    throw new HttpError(400, "note must be text of at most 200 characters");
  }
  return value.trim();
}

// Optional short text label. undefined = not provided; null or "" = clear it.
export function parseLabel(
  value: unknown,
  what: string,
  max: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new HttpError(400, `${what} must be text of at most ${max} characters`);
  }
  return value.trim();
}
