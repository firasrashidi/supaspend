"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AddBudgetModal } from "@/components/tracker/add-budget-modal";
import { AddTransactionModal } from "@/components/tracker/add-transaction-modal";
import { EditTransactionModal } from "@/components/tracker/edit-transaction-modal";
import type { Group, GroupBudget, Transaction } from "@/types/database";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type BudgetWithSpent = GroupBudget & { spent: number; effective_limit: number };

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const now = new Date();

  const [group, setGroup] = useState<Group | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Current month/year for filtering
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch group details
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();

    if (groupError || !groupData) {
      router.push("/tracker/groups");
      return;
    }

    setGroup(groupData);
    setIsOwner(groupData.created_by === user.id);

    // Fetch member count
    const { data: members } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", id);

    setMemberCount(members?.length || 0);

    // Fetch budgets for this month/year
    const { data: budgetsData } = await supabase
      .from("group_budgets")
      .select("*")
      .eq("group_id", id)
      .eq("month", viewMonth)
      .eq("year", viewYear);

    // Fetch group transactions for this month/year
    const startDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`;
    const endDay = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("group_id", id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    const txList = txData || [];
    setTransactions(txList);

    // Calculate spent per budget category (income tops up the budget limit)
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
  }, [id, viewMonth, viewYear, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;

    const supabase = createClient();
    const channel = supabase
      .channel("group-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          const old = payload.old as Record<string, unknown> | undefined;
          if (row?.group_id === id || old?.group_id === id) {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchData]);

  const copyCode = () => {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading group...</p>
      </div>
    );
  }

  if (!group) return null;

  const totalBudget = budgets.reduce((sum, b) => sum + b.effective_limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return (
    <div className="flex h-full flex-col p-6">
      {/* Group header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => router.push("/tracker/groups")}
            className="hover:text-foreground"
          >
            Groups
          </button>
          <span>/</span>
          <span className="text-foreground">{group.name}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Code:</span>
              <span className="font-mono text-sm font-medium tracking-widest">
                {group.invite_code}
              </span>
              <button
                onClick={copyCode}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {copiedCode ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Month navigation */}
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setTxModalOpen(true)} variant="outline" size="sm">
            + Add Transaction
          </Button>
          <Button onClick={() => setBudgetModalOpen(true)} size="sm">
            + Add Budget
          </Button>
        </div>
      </div>

      {/* Budget summary bar */}
      {budgets.length > 0 && (
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
                totalSpent / totalBudget > 0.9
                  ? "bg-red-500"
                  : totalSpent / totalBudget > 0.7
                    ? "bg-yellow-500"
                    : "bg-primary"
              )}
              style={{
                width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-right text-sm text-muted-foreground">
            {formatAmount(Math.max(0, totalBudget - totalSpent), "USD")}{" "}
            remaining
          </p>
        </div>
      )}

      {/* Budget cards grid */}
      {budgets.length > 0 ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  of {formatAmount(b.amount_limit, b.currency)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-8 flex items-center justify-center rounded-lg border border-dashed border-border p-8">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              No budgets set for {MONTHS[viewMonth - 1]} {viewYear}.
            </p>
            <Button
              onClick={() => setBudgetModalOpen(true)}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              + Add Budget
            </Button>
          </div>
        </div>
      )}

      {/* Recent group transactions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Group Transactions</h2>
        {transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No group transactions for {MONTHS[viewMonth - 1]} {viewYear}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
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
                    <p className="text-xs text-muted-foreground">
                      {t.category || "No budget"} &middot;{" "}
                      {new Date(t.date + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </p>
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      <AddBudgetModal
        open={budgetModalOpen}
        onOpenChange={setBudgetModalOpen}
        groupId={id}
        onBudgetCreated={fetchData}
        defaultMonth={viewMonth}
        defaultYear={viewYear}
      />

      {/* Add Transaction Modal (defaults to this group) */}
      <AddTransactionModal
        open={txModalOpen}
        onOpenChange={(open) => {
          setTxModalOpen(open);
          if (!open) fetchData();
        }}
        selectedDate={new Date()}
        defaultGroupId={id}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={editTx}
        onSaved={fetchData}
        onDeleted={fetchData}
      />
    </div>
  );
}
