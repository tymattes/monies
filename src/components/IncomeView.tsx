"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type {
  IncomeMemberView,
  IncomeMonth,
  IncomeSourceView,
} from "@/lib/income";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

const isError = (message: string) =>
  message !== "" && message !== "Saved" && message !== "Saving…";

function Status({ message }: { message: string }) {
  return (
    <span
      aria-live="polite"
      className={`text-xs ${isError(message) ? "text-danger" : "text-muted"}`}
    >
      {message}
    </span>
  );
}

function FixedAmount({
  month,
  source,
  currency,
  editable,
}: {
  month: string;
  source: IncomeSourceView;
  currency: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(
    toInputString(source.amountCents, currency),
  );
  const [status, setStatus] = useState("");

  if (!editable || !source.canEdit) {
    return (
      <span className="tabular-nums">
        {formatMoney(source.amountCents, currency)}
      </span>
    );
  }

  async function commit() {
    const minor = parseMoney(draft, currency);
    if (minor === null) return setStatus("Enter an amount like 4000.00");
    if (minor === source.amountCents) {
      setDraft(toInputString(minor, currency));
      return setStatus("");
    }
    setStatus("Saving…");
    const { ok, error } = await api(
      `/api/income/${month}/sources/${source.id}`,
      "PUT",
      { amountCents: minor },
    );
    if (!ok) return setStatus(error ?? "Could not save");
    setStatus("Saved");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Status message={status} />
      <label htmlFor={`amount-${source.id}`} className="sr-only">
        Monthly amount for {source.name}
      </label>
      <input
        id={`amount-${source.id}`}
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus("");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`${inputCls} w-32! text-right tabular-nums`}
      />
    </div>
  );
}

function Deposits({
  source,
  currency,
  today,
  month,
}: {
  source: IncomeSourceView;
  currency: string;
  today: string;
  month: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(
    today.startsWith(month) ? today : `${month}-01`,
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount, currency);
    if (minor === null || minor === 0) {
      return setStatus("Enter an amount like 250.00");
    }
    setBusy(true);
    setStatus("");
    const { ok, error } = await api(
      `/api/income/sources/${source.id}/deposits`,
      "POST",
      { receivedOn: date, amountCents: minor, note },
    );
    setBusy(false);
    if (!ok) return setStatus(error ?? "Could not save");
    setAmount("");
    setNote("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this deposit?")) return;
    const { ok, error } = await api(`/api/income/deposits/${id}`, "DELETE");
    if (!ok) return setStatus(error ?? "Could not delete");
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-3">
      {source.deposits.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {source.deposits.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0 truncate">
                <span className="tabular-nums">{d.receivedOn}</span>
                {d.note && <span className="text-muted"> · {d.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums">
                  {formatMoney(d.amountCents, currency)}
                </span>
                {source.canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className={secondaryButtonCls}
                  >
                    Delete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {source.canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor={`date-${source.id}`} className="block text-xs text-muted">
              Date received
            </label>
            <input
              id={`date-${source.id}`}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} w-auto!`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`dep-amount-${source.id}`} className="block text-xs text-muted">
              Amount
            </label>
            <input
              id={`dep-amount-${source.id}`}
              inputMode="decimal"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} w-28! text-right tabular-nums`}
            />
          </div>
          <div className="min-w-32 flex-1 space-y-1">
            <label htmlFor={`note-${source.id}`} className="block text-xs text-muted">
              Note (optional)
            </label>
            <input
              id={`note-${source.id}`}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy} className={buttonCls}>
            Add deposit
          </button>
          <Status message={status} />
        </form>
      )}
    </div>
  );
}

function SourceRow({
  month,
  source,
  currency,
  editable,
  today,
}: {
  month: string;
  source: IncomeSourceView;
  currency: string;
  editable: boolean;
  today: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function archive() {
    if (
      !window.confirm(
        `Archive ${source.name}? It will be hidden from this month onward; past months keep it.`,
      )
    ) {
      return;
    }
    const { ok, error } = await api(`/api/income/sources/${source.id}`, "PATCH", {
      archived: true,
    });
    if (!ok) return setError(error ?? "Could not archive");
    router.refresh();
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{source.name}</p>
          <p className="text-xs text-muted">
            {source.kind === "fixed" ? "Fixed monthly" : "Variable"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {source.kind === "fixed" ? (
            <FixedAmount
              key={`${source.id}:${source.amountCents}`}
              month={month}
              source={source}
              currency={currency}
              editable={editable}
            />
          ) : (
            <span className="tabular-nums">
              {formatMoney(source.amountCents, currency)}
            </span>
          )}
          {source.canEdit && (
            <button type="button" onClick={archive} className={secondaryButtonCls}>
              Archive
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      {source.kind === "variable" && (
        <Deposits
          key={`${source.id}:${source.deposits.length}`}
          source={source}
          currency={currency}
          today={today}
          month={month}
        />
      )}
    </li>
  );
}

function AddSourceForm({
  member,
  currency,
}: {
  member: IncomeMemberView;
  currency: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"fixed" | "variable">("fixed");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let amountCents: number | undefined;
    if (kind === "fixed" && amount.trim() !== "") {
      const minor = parseMoney(amount, currency);
      if (minor === null) {
        setBusy(false);
        return setError("Enter an amount like 4000.00, or leave it blank");
      }
      amountCents = minor;
    }
    const { ok, error } = await api("/api/income/sources", "POST", {
      name,
      kind,
      memberId: member.memberId,
      amountCents,
    });
    setBusy(false);
    if (!ok) return setError(error ?? "Could not add");
    setName("");
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={add} className="flex flex-wrap items-center gap-2 px-4 py-3">
      <label htmlFor={`new-source-${member.memberId}`} className="sr-only">
        New income source for {member.name}
      </label>
      <input
        id={`new-source-${member.memberId}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={60}
        placeholder="New source, e.g. Salary"
        className={`${inputCls} w-auto! min-w-48 flex-1`}
      />
      <label htmlFor={`kind-${member.memberId}`} className="sr-only">
        Kind of income
      </label>
      <select
        id={`kind-${member.memberId}`}
        value={kind}
        onChange={(e) => setKind(e.target.value as "fixed" | "variable")}
        className={`${inputCls} w-auto!`}
      >
        <option value="fixed">Fixed monthly</option>
        <option value="variable">Variable</option>
      </select>
      {kind === "fixed" && (
        <>
          <label htmlFor={`new-amount-${member.memberId}`} className="sr-only">
            Starting monthly amount (optional)
          </label>
          <input
            id={`new-amount-${member.memberId}`}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputCls} w-28! text-right tabular-nums`}
          />
        </>
      )}
      <button type="submit" disabled={busy} className={buttonCls}>
        Add
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

export default function IncomeView({
  month,
  monthName,
  today,
  income,
}: {
  month: string;
  monthName: string;
  today: string;
  income: IncomeMonth;
}) {
  const { currency, editable } = income;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-sm text-muted">
        <p>Enter take-home (net) income, after taxes.</p>
        <p>
          {editable
            ? `Fixed amounts apply from ${monthName} onward; earlier months are not affected.`
            : "Fixed amounts for past months are read-only so history stays accurate. Deposits can still be added or corrected."}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 font-semibold">
        <span>Household income in {monthName}</span>
        <span className="tabular-nums">
          {formatMoney(income.totalCents, currency)}
        </span>
      </div>

      {income.members.map((m) => (
        <section key={m.memberId ?? "former"} aria-label={m.name}>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">
              {m.name}
              {m.isSelf && (
                <span className="ml-2 text-xs font-normal text-muted">(you)</span>
              )}
            </h2>
            <span className="tabular-nums text-sm text-muted">
              {formatMoney(m.totalCents, currency)}
            </span>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            {m.sources.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted">No income sources yet.</p>
            )}
            <ul className="divide-y divide-border">
              {m.sources.map((s) => (
                <SourceRow
                  key={s.id}
                  month={month}
                  source={s}
                  currency={currency}
                  editable={editable}
                  today={today}
                />
              ))}
            </ul>
            {m.canAdd && <AddSourceForm member={m} currency={currency} />}
          </div>
        </section>
      ))}
    </div>
  );
}
