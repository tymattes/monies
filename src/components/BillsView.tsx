"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api } from "@/lib/client";
import type { BillItem, BillsMonth } from "@/lib/bills";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { buttonCls, inputCls, labelCls, secondaryButtonCls } from "./ui";

type CategoryOption = { id: string; name: string };

const INTERVALS = [
  { value: 1, label: "Month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "Year" },
] as const;

const intervalName = (n: number) =>
  n === 1 ? "month" : n === 12 ? "year" : `${n} months`;

// Mirrors monthlyEquivalent in src/lib/bills.ts (kept inline so the client
// bundle does not import the server module): charge / months, rounded half up.
const monthlyOf = (amount: number, interval: number) =>
  Math.floor((amount + Math.floor(interval / 2)) / interval);

function amountText(b: Pick<BillItem, "amountCents" | "intervalMonths" | "monthlyCents">, currency: string) {
  return b.intervalMonths === 1
    ? `${formatMoney(b.amountCents, currency)} / month`
    : `${formatMoney(b.amountCents, currency)} / ${intervalName(b.intervalMonths)}`;
}

function CategorySelect({
  id,
  value,
  onChange,
  categories,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  categories: CategoryOption[];
}) {
  return (
    <select
      id={id}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} w-auto min-w-40`}
    >
      <option value="">Choose a category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function IntervalSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${inputCls} w-auto`}
    >
      {INTERVALS.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

// "= 10.00 / month" preview for non-monthly bills.
function Preview({ amount, interval, currency }: { amount: string; interval: number; currency: string }) {
  const minor = parseMoney(amount, currency);
  if (interval === 1 || minor === null) return null;
  return (
    <p className="text-xs text-muted">
      = {formatMoney(monthlyOf(minor, interval), currency)} / month, counted every
      month.
    </p>
  );
}

function AddBillForm({
  currency,
  categories,
  paidWithOptions,
  startMonthName,
}: {
  currency: string;
  categories: CategoryOption[];
  paidWithOptions: string[];
  startMonthName: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState(1);
  // Starts empty on purpose: the user always chooses the category.
  const [categoryId, setCategoryId] = useState("");
  const [paidWith, setPaidWith] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount, currency);
    if (minor === null) return setError("Enter an amount like 15.99");
    if (categoryId === "") return setError("Choose a category");
    setBusy(true);
    setError("");
    const { ok, error } = await api("/api/bills", "POST", {
      name,
      amountCents: minor,
      intervalMonths: interval,
      categoryId,
      paidWith,
      note,
    });
    setBusy(false);
    if (!ok) return setError(error ?? "Could not add");
    setName("");
    setAmount("");
    setInterval(1);
    setCategoryId("");
    setPaidWith("");
    setNote("");
    router.refresh();
  }

  return (
    <form
      onSubmit={add}
      aria-label="Add a bill"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h2 className="font-semibold tracking-tight">Add a bill</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1 space-y-1">
          <label htmlFor={`${uid}-name`} className={labelCls}>Name</label>
          <input
            id={`${uid}-name`}
            required
            maxLength={100}
            placeholder="e.g. Netflix"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-amount`} className={labelCls}>Amount</label>
          <input
            id={`${uid}-amount`}
            required
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputCls} w-28 text-right tabular-nums`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-interval`} className={labelCls}>Every</label>
          <IntervalSelect id={`${uid}-interval`} value={interval} onChange={setInterval} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-category`} className={labelCls}>Category</label>
          <CategorySelect
            id={`${uid}-category`}
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
          />
        </div>
      </div>
      <Preview amount={amount} interval={interval} currency={currency} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 space-y-1">
          <label htmlFor={`${uid}-paid`} className="block text-xs text-muted">
            Paid with (optional)
          </label>
          <input
            id={`${uid}-paid`}
            list={`${uid}-paid-options`}
            maxLength={60}
            value={paidWith}
            onChange={(e) => setPaidWith(e.target.value)}
            className={inputCls}
          />
          <datalist id={`${uid}-paid-options`}>
            {paidWithOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor={`${uid}-note`} className="block text-xs text-muted">
            Note (optional)
          </label>
          <input
            id={`${uid}-note`}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
        </div>
        <button type="submit" disabled={busy} className={buttonCls}>
          Add bill
        </button>
      </div>
      <p className="text-xs text-muted">
        Starts in {startMonthName} and counts against its category every month
        after.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function BillRow({
  bill,
  month,
  monthName,
  currency,
  editable,
  categories,
  paidWithOptions,
}: {
  bill: BillItem;
  month: string;
  monthName: string;
  currency: string;
  editable: boolean;
  categories: CategoryOption[];
  paidWithOptions: string[];
}) {
  const router = useRouter();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bill.name);
  const [amount, setAmount] = useState(toInputString(bill.amountCents, currency));
  const [interval, setInterval] = useState<number>(bill.intervalMonths);
  const [categoryId, setCategoryId] = useState(bill.categoryId);
  const [paidWith, setPaidWith] = useState(bill.paidWith ?? "");
  const [note, setNote] = useState(bill.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The bill's current category may have been archived; keep it selectable.
  const options = categories.some((c) => c.id === bill.categoryId)
    ? categories
    : [...categories, { id: bill.categoryId, name: bill.categoryName }];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount, currency);
    if (minor === null) return setError("Enter an amount like 15.99");
    setBusy(true);
    setError("");

    const labelsChanged =
      name.trim() !== bill.name ||
      paidWith.trim() !== (bill.paidWith ?? "") ||
      note.trim() !== (bill.note ?? "");
    if (labelsChanged) {
      const r = await api(`/api/bills/items/${bill.id}`, "PATCH", { name, paidWith, note });
      if (!r.ok) {
        setBusy(false);
        return setError(r.error ?? "Could not save");
      }
    }
    const versionChanged =
      minor !== bill.amountCents ||
      interval !== bill.intervalMonths ||
      categoryId !== bill.categoryId;
    if (versionChanged) {
      const r = await api(`/api/bills/${month}/items/${bill.id}`, "PUT", {
        amountCents: minor,
        intervalMonths: interval,
        categoryId,
      });
      if (!r.ok) {
        setBusy(false);
        return setError(r.error ?? "Could not save");
      }
    }
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  async function end() {
    if (
      !window.confirm(
        `End ${bill.name}? It stops counting from this month onward; past months keep it.`,
      )
    ) {
      return;
    }
    const { ok, error } = await api(`/api/bills/items/${bill.id}`, "PATCH", { archived: true });
    if (!ok) return setError(error ?? "Could not end");
    router.refresh();
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={save} aria-label={`Edit ${bill.name}`} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1 space-y-1">
              <label htmlFor={`${uid}-name`} className="block text-xs text-muted">Name</label>
              <input
                id={`${uid}-name`}
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-amount`} className="block text-xs text-muted">Amount</label>
              <input
                id={`${uid}-amount`}
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} w-28 text-right tabular-nums`}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-interval`} className="block text-xs text-muted">Every</label>
              <IntervalSelect id={`${uid}-interval`} value={interval} onChange={setInterval} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-category`} className="block text-xs text-muted">Category</label>
              <CategorySelect
                id={`${uid}-category`}
                value={categoryId}
                onChange={setCategoryId}
                categories={options}
              />
            </div>
          </div>
          <Preview amount={amount} interval={interval} currency={currency} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 space-y-1">
              <label htmlFor={`${uid}-paid`} className="block text-xs text-muted">Paid with</label>
              <input
                id={`${uid}-paid`}
                list={`${uid}-paid-options`}
                maxLength={60}
                value={paidWith}
                onChange={(e) => setPaidWith(e.target.value)}
                className={inputCls}
              />
              <datalist id={`${uid}-paid-options`}>
                {paidWithOptions.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <label htmlFor={`${uid}-note`} className="block text-xs text-muted">Note</label>
              <input
                id={`${uid}-note`}
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={busy} className={buttonCls}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={secondaryButtonCls}>
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted">
            Amount, period and category changes apply from {monthName} onward;
            earlier months are not affected.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{bill.name}</p>
          <p className="text-xs text-muted">
            Added by {bill.addedBy}
            {bill.paidWith && ` · Paid with ${bill.paidWith}`}
            {bill.note && ` · ${bill.note}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="tabular-nums">{amountText(bill, currency)}</p>
            {bill.intervalMonths !== 1 && (
              <p className="text-xs text-muted tabular-nums">
                about {formatMoney(bill.monthlyCents, currency)} / month
              </p>
            )}
          </div>
          {editable && (
            <>
              <button type="button" onClick={() => setEditing(true)} className={secondaryButtonCls}>
                Edit
              </button>
              <button type="button" onClick={end} className={secondaryButtonCls}>
                End
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export default function BillsView({
  month,
  monthName,
  startMonthName,
  data,
  categories,
}: {
  month: string;
  monthName: string;
  startMonthName: string;
  data: BillsMonth;
  categories: CategoryOption[];
}) {
  const { currency, editable } = data;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-sm text-muted">
        <p>
          Recurring costs like rent, subscriptions and insurance. Each counts
          against its category every month, with nothing to log. Yearly, 6-month
          and 3-month bills are spread evenly across the months.
        </p>
        <p>
          {editable
            ? `Changes apply from ${monthName} onward; earlier months are not affected.`
            : "Past months are read-only so history stays accurate."}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 font-semibold">
        <span>Bills in {monthName}</span>
        <span className="tabular-nums">{formatMoney(data.totalCents, currency)} / month</span>
      </div>

      {editable && (
        <AddBillForm
          currency={currency}
          categories={categories}
          paidWithOptions={data.paidWithOptions}
          startMonthName={startMonthName}
        />
      )}

      {data.bills.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted">
          No bills in {monthName}.
          {editable ? " Add your first one above." : ""}
        </p>
      ) : (
        data.categories.map((group) => (
          <section key={group.categoryId} aria-label={group.name}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">{group.name}</h2>
              <span className="text-sm text-muted tabular-nums">
                {formatMoney(group.totalCents, currency)} / month
              </span>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.bills
                .filter((b) => b.categoryId === group.categoryId)
                .map((b) => (
                  <BillRow
                    key={b.id}
                    bill={b}
                    month={month}
                    monthName={monthName}
                    currency={currency}
                    editable={editable}
                    categories={categories}
                    paidWithOptions={data.paidWithOptions}
                  />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
