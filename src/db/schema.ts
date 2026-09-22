import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Better Auth core tables (model names must stay user/session/account/verification) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// --- Households (spec 003) ---

// One household per instance: `singleton` is unique and constrained to true,
// so a second row is rejected by the database itself.
export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // ISO 4217 code; one currency per household.
    currency: text("currency").notNull().default("USD"),
    singleton: boolean("singleton").notNull().default(true).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("households_singleton_check", sql`${t.singleton} = true`)],
);

export const householdMembers = pgTable(
  "household_members",
  {
    // A user belongs to at most one household.
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("household_members_household_id_idx").on(t.householdId)],
);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  // SHA-256 of the token; the token itself is shown once and never stored.
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// --- Categories and budgets (spec 004) ---

// Months are stored as `date` values on the first of the month (YYYY-MM-01).
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    // First month the category appears in.
    startMonth: date("start_month", { mode: "string" }).notNull(),
    // First month the category no longer appears in (null = still active).
    // Categories are never hard-deleted so history keeps resolving them.
    archivedFrom: date("archived_from", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_active_name_idx")
      .on(t.householdId, sql`lower(${t.name})`)
      .where(sql`${t.archivedFrom} is null`),
    index("categories_household_id_idx").on(t.householdId),
  ],
);

// Time-versioned: the amount for a month is the row with the latest
// effective_month on or before it. Rows are never rewritten for past months.
export const budgetAllocations = pgTable(
  "budget_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    effectiveMonth: date("effective_month", { mode: "string" }).notNull(),
    // Minor units of the household currency (cents for USD).
    amountCents: integer("amount_cents").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("budget_allocations_category_month_idx").on(
      t.categoryId,
      t.effectiveMonth,
    ),
    check("budget_allocations_amount_check", sql`${t.amountCents} >= 0`),
  ],
);

// --- Savings and Debt payoff goals (spec 014) ---
//
// A goal is unobservable money: a transfer that happens outside this app
// (a bank, a brokerage, a creditor), unlike an Expense category whose actual
// spend can eventually be verified via transactions. So a goal gets a
// monthly target amount (time-versioned, same rule as budget_allocations)
// and a monthly checkmark instead of anything the app claims to verify.
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    position: integer("position").notNull(),
    startMonth: date("start_month", { mode: "string" }).notNull(),
    archivedFrom: date("archived_from", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("goals_active_name_idx")
      .on(t.householdId, sql`lower(${t.name})`)
      .where(sql`${t.archivedFrom} is null`),
    index("goals_household_id_idx").on(t.householdId),
    check("goals_type_check", sql`${t.type} in ('saving', 'debt payoff')`),
  ],
);

// Time-versioned exactly like budget_allocations: the amount for a month is
// the row with the latest effective_month on or before it.
export const goalAmounts = pgTable(
  "goal_amounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    effectiveMonth: date("effective_month", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("goal_amounts_goal_month_idx").on(
      t.goalId,
      t.effectiveMonth,
    ),
    check("goal_amounts_amount_check", sql`${t.amountCents} >= 0`),
  ],
);

// A row's presence means the goal was checked off for that month; toggling
// is insert/delete, so there is no boolean column. Unlike goal_amounts,
// there is no read-only-past rule — a checkmark records a fact, often
// confirmed after the month closes, not a plan being rewritten.
export const goalCheckins = pgTable(
  "goal_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    month: date("month", { mode: "string" }).notNull(),
    checkedBy: text("checked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("goal_checkins_goal_month_idx").on(t.goalId, t.month)],
);

// --- Income (spec 006) ---

// A member's income source. member_id is set null when the member is removed
// so history survives (shown as "Former member").
export const incomeSources = pgTable(
  "income_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => user.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["fixed", "variable"] }).notNull(),
    // Same visibility rule as categories: start_month <= M < archived_from.
    startMonth: date("start_month", { mode: "string" }).notNull(),
    archivedFrom: date("archived_from", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("income_sources_active_name_idx")
      .on(t.memberId, sql`lower(${t.name})`)
      .where(sql`${t.archivedFrom} is null`),
    index("income_sources_household_id_idx").on(t.householdId),
  ],
);

// Fixed sources only: time-versioned monthly amount, like budget_allocations.
export const incomeAmounts = pgTable(
  "income_amounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => incomeSources.id, { onDelete: "cascade" }),
    effectiveMonth: date("effective_month", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("income_amounts_source_month_idx").on(
      t.sourceId,
      t.effectiveMonth,
    ),
    check("income_amounts_amount_check", sql`${t.amountCents} >= 0`),
  ],
);

// Variable sources only: actual deposits, counted in the month of received_on.
export const incomeDeposits = pgTable(
  "income_deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => incomeSources.id, { onDelete: "cascade" }),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("income_deposits_source_received_idx").on(t.sourceId, t.receivedOn),
    check("income_deposits_amount_check", sql`${t.amountCents} > 0`),
  ],
);

// --- Bills (spec 007) ---

// A recurring household cost (rent, a subscription, insurance). Its amount,
// billing period and category live in bill_versions so history stays accurate.
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    paidWith: text("paid_with"),
    note: text("note"),
    // The member who added it; null after that member is removed ("Former member").
    addedBy: text("added_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Same visibility rule as categories: start_month <= M < archived_from.
    startMonth: date("start_month", { mode: "string" }).notNull(),
    archivedFrom: date("archived_from", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bills_household_id_idx").on(t.householdId)],
);

// Time-versioned like budget_allocations: a month uses the latest version on or
// before it. amount_cents is the charge per billing period; the monthly
// equivalent (amount / interval, rounded half up) is computed, not stored.
export const billVersions = pgTable(
  "bill_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    effectiveMonth: date("effective_month", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    intervalMonths: smallint("interval_months").notNull().default(1),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bill_versions_bill_month_idx").on(t.billId, t.effectiveMonth),
    index("bill_versions_category_id_idx").on(t.categoryId),
    check("bill_versions_amount_check", sql`${t.amountCents} >= 0`),
    check(
      "bill_versions_interval_check",
      sql`${t.intervalMonths} in (1, 3, 6, 12)`,
    ),
  ],
);
