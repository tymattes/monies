import { MAX_AMOUNT } from "./budgets";
import { GOAL_TYPES, type GoalType } from "./goalTypes";
import { ROLES, type Role } from "./household";
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

// Like `parseAmount`, but undefined (the field was left out entirely) passes
// through as undefined instead of erroring — for a field that's optional on
// create, not a required patch value.
export function parseOptionalAmount(value: unknown, min = 0): number | undefined {
  if (value === undefined) return undefined;
  return parseAmount(value, min);
}

// Optional in requests (undefined = leave it unchanged on a patch; a goal's
// type is required on create, so POST callers check for undefined
// themselves); when present must be one of the known goal types.
export function parseGoalType(value: unknown): GoalType | undefined {
  if (value === undefined) return undefined;
  if (!GOAL_TYPES.includes(value as GoalType)) {
    throw new HttpError(400, `type must be one of: ${GOAL_TYPES.join(", ")}`);
  }
  return value as GoalType;
}

// Required, unlike parseGoalType — this endpoint's whole body is { role }.
export function parseRole(value: unknown): Role {
  if (!ROLES.includes(value as Role)) {
    throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
  }
  return value as Role;
}

export function parseNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 200) {
    throw new HttpError(400, "note must be text of at most 200 characters");
  }
  return value.trim();
}

// Optional household-member id: undefined = not provided (leave unchanged on
// a patch); null or "" = no payer. Only checks the shape — membership in the
// household is a DB check the caller makes separately.
export function parseMemberId(value: unknown, what: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new HttpError(400, `${what} must be a household member`);
  }
  return value;
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
