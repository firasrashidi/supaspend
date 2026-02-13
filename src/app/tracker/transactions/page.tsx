"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useGroup } from "@/contexts/group-context";
import { EditTransactionModal } from "@/components/tracker/edit-transaction-modal";
import type { Transaction } from "@/types/database";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FilterType = "all" | "expense" | "income";

export default function TransactionsPage() {
  const now = new Date();
  const { activeGroup } = useGroup();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const startDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`;
    const endDay = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    let query = supabase
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (activeGroup) {
      query = query.eq("group_id", activeGroup.id);
    }

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  }, [viewMonth, viewYear, typeFilter, activeGroup]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = viewMonth + direction;
    let newYear = viewYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Group transactions by date
  const groupedByDate = transactions.reduce<Record<string, Transaction[]>>(
    (acc, tx) => {
      if (!acc[tx.date]) acc[tx.date] = [];
      acc[tx.date].push(tx);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Summary
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="mt-1 text-muted-foreground">
          View and categorize your spending
        </p>
      </div>

      {/* Month nav + type filter */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
            &larr;
          </Button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold">
            {MONTHS[viewMonth - 1]} {viewYear}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
            &rarr;
          </Button>
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as FilterType)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
            {formatAmount(totalIncome, "USD")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">
            {formatAmount(totalExpenses, "USD")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Net</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold",
              totalIncome - totalExpenses >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {formatAmount(totalIncome - totalExpenses, "USD")}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading transactions...
          </p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📭</p>
            <h2 className="mt-4 text-lg font-semibold">No transactions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No {typeFilter !== "all" ? typeFilter + "s" : "transactions"} for{" "}
              {MONTHS[viewMonth - 1]} {viewYear}.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-auto">
          {sortedDates.map((date) => {
            const dayTx = groupedByDate[date];
            const dayTotal = dayTx.reduce(
              (s, t) => s + (t.type === "expense" ? -t.amount : t.amount),
              0
            );
            return (
              <div key={date}>
                {/* Date header */}
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      dayTotal >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {dayTotal >= 0 ? "+" : ""}
                    {formatAmount(Math.abs(dayTotal), "USD")}
                  </span>
                </div>

                {/* Day transactions */}
                <div className="space-y-1">
                  {dayTx.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setEditTx(t);
                        setEditOpen(true);
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                            t.type === "expense"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          )}
                        >
                          {t.type === "expense" ? "−" : "+"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.merchant}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{t.category || "No budget"}</span>
                            {t.group_id && (
                              <>
                                <span>&middot;</span>
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                                  Group
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            t.type === "expense"
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          )}
                        >
                          {formatAmount(t.amount, t.currency)}
                        </span>
                        {t.notes && (
                          <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                            {t.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={editTx}
        onSaved={fetchTransactions}
        onDeleted={fetchTransactions}
      />
    </div>
  );
}
