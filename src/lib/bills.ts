import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bills, billVersions, categories, householdMembers } from "@/db/schema";
import type { HouseholdContext } from "./household";
import { HttpError } from "./http";
import { currentMonth, monthStart } from "./months";

// How often a bill is charged, in months. The monthly equivalent of a yearly
// bill is spread evenly over the year instead of landing in the renewal month.
export const BILLING_INTERVALS = [1, 3, 6, 12] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function isInterval(value: unknown): value is BillingInterval {
  return BILLING_INTERVALS.includes(value as BillingInterval);
}

// Charge divided by the number of months, rounded half up to a minor unit.
// The SQL rollups use the same formula (see MONTHLY_SQL).
export function monthlyEquivalent(amountCents: number, intervalMonths: number) {
  return Math.floor(
    (amountCents + Math.floor(intervalMonths / 2)) / intervalMonths,
  );
}

const MONTHLY_SQL = sql`((v.amount_cents::bigint + v.interval_months / 2) / v.interval_months)::int`;

export type BillItem = {
  id: string;
  name: string;
  amountCents: number;
  intervalMonths: BillingInterval;
  monthlyCents: number;
  categoryId: string;
  categoryName: string;
  paidById: string | null;
  paidBy: string | null;
  note: string | null;
  addedById: string | null;
  addedBy: string;
};

type BillRow = {
  id: string;
  name: string;
  paid_by: string | null;
  paid_by_name: string | null;
  note: string | null;
  added_by: string | null;
  added_by_name: string | null;
  amount_cents: number;
  interval_months: BillingInterval;
  monthly_cents: number;
  category_id: string;
  category_name: string;
};

// Bills active in `month` with their effective version (latest on or before
// the month). A bill is active when start_month <= M < archived_from.
async function activeBills(
  householdId: string,
  month: string,
): Promise<BillItem[]> {
  const start = monthStart(month);
  const rows = await getDb().execute<BillRow>(sql`
    select b.id, b.name, b.paid_by, b.note, b.added_by,
           p.name as paid_by_name,
           u.name as added_by_name,
           v.amount_cents, v.interval_months, v.category_id,
           c.name as category_name,
           ${MONTHLY_SQL} as monthly_cents
    from bills b
    join lateral (
      select * from bill_versions x
      where x.bill_id = b.id and x.effective_month <= ${start}::date
      order by x.effective_month desc limit 1
    ) v on true
    join categories c on c.id = v.category_id
    left join "user" u on u.id = b.added_by
    left join "user" p on p.id = b.paid_by
    where b.household_id = ${householdId}
      and b.start_month <= ${start}::date
      and (b.archived_from is null or ${start}::date < b.archived_from)
    order by c.position, lower(b.name)
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amountCents: r.amount_cents,
    intervalMonths: r.interval_months,
    monthlyCents: r.monthly_cents,
    categoryId: r.category_id,
    categoryName: r.category_name,
    // A null paid_by is ambiguous (never chosen vs. payer removed), so both
    // just render as no payer — unlike added_by, there's no "Former member".
    paidById: r.paid_by,
    paidBy: r.paid_by_name,
    note: r.note,
    addedById: r.added_by,
    addedBy: r.added_by_name ?? "Former member",
  }));
}

export type BillsMonth = {
  month: string;
  currency: string;
  editable: boolean;
  bills: BillItem[];
  categories: { categoryId: string; name: string; totalCents: number }[];
  totalCents: number;
};

export async function getBillsMonth(
  ctx: HouseholdContext,
  month: string,
): Promise<BillsMonth> {
  const items = await activeBills(ctx.household.id, month);
  const groups = new Map<string, { categoryId: string; name: string; totalCents: number }>();
  for (const b of items) {
    const g = groups.get(b.categoryId) ?? {
      categoryId: b.categoryId,
      name: b.categoryName,
      totalCents: 0,
    };
    g.totalCents += b.monthlyCents;
    groups.set(b.categoryId, g);
  }

  return {
    month,
    currency: ctx.household.currency,
    editable: month >= currentMonth(),
    bills: items,
    categories: [...groups.values()],
    totalCents: items.reduce((sum, b) => sum + b.monthlyCents, 0),
  };
}

// Committed monthly cost per category for a month, for the Budget page.
export async function billsRollup(householdId: string, month: string) {
  const items = await activeBills(householdId, month);
  const byCategory = new Map<string, number>();
  for (const b of items) {
    byCategory.set(b.categoryId, (byCategory.get(b.categoryId) ?? 0) + b.monthlyCents);
  }
  return {
    byCategory,
    totalCents: items.reduce((sum, b) => sum + b.monthlyCents, 0),
  };
}

// A category is offered for a month only if it is active in that month.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertCategoryActive(
  ctx: HouseholdContext,
  categoryId: string,
  month: string,
) {
  if (!UUID.test(categoryId)) throw new HttpError(400, "Choose an active category");
  const [category] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.householdId, ctx.household.id),
        lte(categories.startMonth, monthStart(month)),
        sql`(${categories.archivedFrom} is null or ${monthStart(month)} < ${categories.archivedFrom})`,
      ),
    );
  if (!category) throw new HttpError(400, "Choose an active category");
}

// A non-member or malformed id is a 400, not a silent foreign-key error.
async function assertMember(ctx: HouseholdContext, userId: string) {
  if (!UUID.test(userId)) throw new HttpError(400, "paidBy must be a household member");
  const [row] = await getDb()
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, userId),
        eq(householdMembers.householdId, ctx.household.id),
      ),
    );
  if (!row) throw new HttpError(400, "paidBy must be a household member");
}

export async function createBill(
  ctx: HouseholdContext,
  input: {
    name: string;
    amountCents: number;
    intervalMonths: BillingInterval;
    categoryId: string;
    paidBy: string | null;
    note: string | null;
  },
) {
  const month = currentMonth();
  await assertCategoryActive(ctx, input.categoryId, month);
  if (input.paidBy !== null) await assertMember(ctx, input.paidBy);
  const bill = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(bills)
      .values({
        householdId: ctx.household.id,
        name: input.name,
        paidBy: input.paidBy,
        note: input.note,
        addedBy: ctx.user.id,
        startMonth: monthStart(month),
      })
      .returning({ id: bills.id });
    await tx.insert(billVersions).values({
      billId: row.id,
      effectiveMonth: monthStart(month),
      amountCents: input.amountCents,
      intervalMonths: input.intervalMonths,
      categoryId: input.categoryId,
      createdBy: ctx.user.id,
    });
    return row;
  });
  return {
    id: bill.id,
    amountCents: input.amountCents,
    intervalMonths: input.intervalMonths,
    monthlyCents: monthlyEquivalent(input.amountCents, input.intervalMonths),
    categoryId: input.categoryId,
  };
}

async function loadBill(ctx: HouseholdContext, id: string) {
  const [bill] = await getDb()
    .select()
    .from(bills)
    .where(and(eq(bills.id, id), eq(bills.householdId, ctx.household.id)));
  if (!bill) throw new HttpError(404, "Bill not found");
  return bill;
}

// Labels are not versioned. Ending a bill (archived: true) stops it counting
// from this month onward; restoring clears that.
export async function updateBill(
  ctx: HouseholdContext,
  id: string,
  patch: {
    name?: string;
    paidBy?: string | null;
    note?: string | null;
    archived?: boolean;
  },
) {
  const bill = await loadBill(ctx, id);
  const set: Partial<typeof bills.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.paidBy !== undefined) {
    if (patch.paidBy !== null) await assertMember(ctx, patch.paidBy);
    set.paidBy = patch.paidBy;
  }
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.archived === true && bill.archivedFrom === null) {
    set.archivedFrom = monthStart(currentMonth());
  }
  if (patch.archived === false) set.archivedFrom = null;
  if (Object.keys(set).length === 0) return;
  await getDb().update(bills).set(set).where(eq(bills.id, id));
}

// New amount, billing period and/or category from `month` onward (current or
// future months only).
export async function setBillVersion(
  ctx: HouseholdContext,
  month: string,
  id: string,
  input: {
    amountCents: number;
    intervalMonths: BillingInterval;
    categoryId: string;
  },
) {
  if (month < currentMonth()) {
    throw new HttpError(400, "Past months are read-only");
  }
  const bill = await loadBill(ctx, id);
  const start = monthStart(month);
  if (
    bill.startMonth > start ||
    (bill.archivedFrom !== null && start >= bill.archivedFrom)
  ) {
    throw new HttpError(404, "Bill not found for this month");
  }
  await assertCategoryActive(ctx, input.categoryId, month);
  await getDb()
    .insert(billVersions)
    .values({
      billId: id,
      effectiveMonth: start,
      amountCents: input.amountCents,
      intervalMonths: input.intervalMonths,
      categoryId: input.categoryId,
      createdBy: ctx.user.id,
    })
    .onConflictDoUpdate({
      target: [billVersions.billId, billVersions.effectiveMonth],
      set: {
        amountCents: input.amountCents,
        intervalMonths: input.intervalMonths,
        categoryId: input.categoryId,
        createdBy: ctx.user.id,
      },
    });
}

// Bills that still count against a category now or will in the future: their
// current version uses it, or a scheduled future version moves them into it.
// Archiving such a category is blocked until they are moved or ended.
export async function countBillsBlockingCategory(
  householdId: string,
  categoryId: string,
): Promise<number> {
  const now = monthStart(currentMonth());
  const rows = await getDb().execute<{ n: number }>(sql`
    select count(distinct b.id)::int as n
    from bills b
    join bill_versions v on v.bill_id = b.id
    where b.household_id = ${householdId}
      and v.category_id = ${categoryId}
      and (b.archived_from is null or b.archived_from > ${now}::date)
      and (
        v.effective_month > ${now}::date
        or v.effective_month = (
          select max(v2.effective_month) from bill_versions v2
          where v2.bill_id = b.id and v2.effective_month <= ${now}::date
        )
      )
  `);
  return rows[0]?.n ?? 0;
}
