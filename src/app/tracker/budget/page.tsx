"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useGroup } from "@/contexts/group-context";
import { AddBudgetModal } from "@/components/tracker/add-budget-modal";
import type { GroupBudget } from "@/types/database";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type BudgetWithSpent = GroupBudget & { spent: number; effective_limit: number };

export default function BudgetPage() {
  const now = new Date();
  const { activeGroup } = useGroup();
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const fetchData = useCallback(async () => {
    if (!activeGroup) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Fetch budgets for the active group
    const { data: budgetsData } = await supabase
      .from("group_budgets")
      .select("*")
      .eq("group_id", activeGroup.id)
      .eq("month", viewMonth)
      .eq("year", viewYear);

    // Fetch group transactions for the month to calculate spent
    const startDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`;
    const endDay = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("group_id", activeGroup.id)
      .gte("date", startDate)
      .lte("date", endDate);

    const txList = txData || [];

    const enriched: BudgetWithSpent[] = (budgetsData || []).map((b) => {
      const matching = txList.filter(
        (t) => t.category?.toLowerCase() === b.category.toLowerCase()
      );
      const expenses = matching
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      const income = matching
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...b, spent: expenses, effective_limit: b.amount_limit + income };
    });

    setBudgets(enriched);
    setLoading(false);
  }, [viewMonth, viewYear, activeGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const totalBudget = budgets.reduce((s, b) => s + b.effective_limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
          <p className="mt-1 text-muted-foreground">
            {activeGroup
              ? `Monthly budgets for ${activeGroup.name}`
              : "Select a group to manage budgets"}
          </p>
        </div>
        {activeGroup && (
          <Button onClick={() => setBudgetModalOpen(true)} size="sm">
            + Add Budget
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <div className="mb-6 flex items-center gap-2">
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

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading budgets...</p>
        </div>
      ) : !activeGroup ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📊</p>
            <h2 className="mt-4 text-lg font-semibold">No group selected</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join or create a group to start setting budgets.
            </p>
          </div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">📋</p>
            <h2 className="mt-4 text-lg font-semibold">No budgets set</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No budgets for {MONTHS[viewMonth - 1]} {viewYear}.
            </p>
            <Button
              onClick={() => setBudgetModalOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              + Add Budget
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Total Budget</span>
              <span className="text-muted-foreground">
                {formatAmount(totalSpent, "USD")} of{" "}
                {formatAmount(totalBudget, "USD")}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  totalBudget > 0 && totalSpent / totalBudget > 0.9
                    ? "bg-red-500"
                    : totalBudget > 0 && totalSpent / totalBudget > 0.7
                      ? "bg-yellow-500"
                      : "bg-primary"
                )}
                style={{
                  width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-right text-sm text-muted-foreground">
              {formatAmount(Math.max(0, totalBudget - totalSpent), "USD")}{" "}
              remaining
            </p>
          </div>

          {/* Budget cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => {
              const pct =
                b.effective_limit > 0 ? (b.spent / b.effective_limit) * 100 : 0;
              const remaining = Math.max(0, b.effective_limit - b.spent);
              return (
                <div
                  key={b.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium">{b.category}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        pct > 90
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : pct > 70
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct > 90
                          ? "bg-red-500"
                          : pct > 70
                            ? "bg-yellow-500"
                            : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatAmount(b.spent, b.currency)} spent
                    </span>
                    <span className="font-medium">
                      {formatAmount(remaining, b.currency)} left
                    </span>
                  </div>
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    of {formatAmount(b.effective_limit, b.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Budget Modal */}
      {activeGroup && (
        <AddBudgetModal
          open={budgetModalOpen}
          onOpenChange={setBudgetModalOpen}
          groupId={activeGroup.id}
          onBudgetCreated={fetchData}
          defaultMonth={viewMonth}
          defaultYear={viewYear}
        />
      )}
    </div>
  );
}
