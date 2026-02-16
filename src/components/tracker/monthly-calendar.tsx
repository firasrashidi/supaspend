"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddTransactionModal } from "./add-transaction-modal";
import { EditTransactionModal } from "./edit-transaction-modal";
import { createClient } from "@/lib/supabase/client";
import { useGroup } from "@/contexts/group-context";
import type { Transaction } from "@/types/database";

async function downloadPDF(
  groupId: string,
  month: number,
  year: number
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const params = new URLSearchParams({
    group_id: groupId,
    month: String(month),
    year: String(year),
  });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/monthly-report?${params}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let msg = "Export failed";
    try {
      msg = JSON.parse(text).error || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `supaspend-report-${month}-${year}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ViewType = "month" | "week" | "day";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    weekDates.push(new Date(date.getFullYear(), date.getMonth(), diff + i));
  }
  return weekDates;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function MonthlyCalendar() {
  const today = new Date();
  const { activeGroup } = useGroup();
  const [view, setView] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(today);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exporting, setExporting] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get date range for fetching
  const getDateRange = useCallback(() => {
    if (view === "month") {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { start, end };
    } else if (view === "week") {
      const weekDates = getWeekDates(currentDate);
      return { start: weekDates[0], end: weekDates[6] };
    } else {
      return { start: currentDate, end: currentDate };
    }
  }, [view, currentMonth, currentYear, currentDate]);

  // Fetch transactions for active group
  const fetchTransactions = useCallback(async () => {
    const supabase = createClient();
    const { start, end } = getDateRange();
    
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    let query = supabase
      .from("transactions")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true });

    if (activeGroup) {
      query = query.eq("group_id", activeGroup.id);
    }

    const { data } = await query;
    setTransactions(data || []);
  }, [getDateRange, activeGroup]);

  // Fetch on mount and when view/date/group changes
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Realtime: re-fetch when transactions table changes
  useEffect(() => {
    if (!activeGroup) return;

    const supabase = createClient();
    const channel = supabase
      .channel("tracker-realtime")
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
          const affectsGroup =
            row?.group_id === activeGroup.id ||
            old?.group_id === activeGroup.id;
          if (affectsGroup) {
            fetchTransactions();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGroup, fetchTransactions]);

  // Refetch after modal closes (new transaction added)
  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      fetchTransactions();
    }
  };

  const openAddModal = (date: Date) => {
    setModalDate(date);
    setModalOpen(true);
  };

  // Get transactions for a specific date
  const getTransactionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return transactions.filter((t) => t.date === dateStr);
  };

  // Format currency amount
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Navigation
  const navigate = (direction: -1 | 1) => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentMonth + direction);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() + direction * 7);
    } else {
      newDate.setDate(currentDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  // Build month grid
  const buildMonthGrid = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }
    return days;
  };

  // Get week dates
  const weekDates = getWeekDates(currentDate);

  // Header title
  const getHeaderTitle = () => {
    if (view === "month") {
      return `${MONTHS[currentMonth]} ${currentYear}`;
    } else if (view === "week") {
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            →
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <h2 className="text-lg font-semibold">{getHeaderTitle()}</h2>

        <div className="flex items-center gap-2">
          {/* Export PDF */}
          {activeGroup && (
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={async () => {
                if (!activeGroup) return;
                setExporting(true);
                try {
                  await downloadPDF(
                    activeGroup.id,
                    currentMonth + 1,
                    currentYear
                  );
                } catch (err) {
                  console.error("PDF export failed:", err);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
          )}

          {/* View toggles */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {(["month", "week", "day"] as ViewType[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "ghost"}
                size="sm"
                onClick={() => setView(v)}
                className="capitalize"
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Month View */}
      {view === "month" && (
        <>
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7">
            {buildMonthGrid().map((date, index) => (
              <div
                key={index}
                onClick={() => date && handleDayClick(date)}
                className={cn(
                  "group relative flex min-h-[80px] flex-col border-b border-r border-border p-2 text-left transition-colors",
                  "hover:bg-muted/50 focus:outline-none",
                  date === null && "cursor-default bg-muted/20",
                  date !== null && "cursor-pointer",
                  date && isSameDay(date, today) && "bg-primary/10",
                  date && selectedDate && isSameDay(date, selectedDate) && "ring-2 ring-primary ring-inset"
                )}
              >
                {date && (() => {
                  const dayTransactions = getTransactionsForDate(date);
                  return (
                    <>
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-sm",
                            isSameDay(date, today) && "bg-primary text-primary-foreground font-medium"
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(date);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity hover:bg-primary/90 group-hover:opacity-100"
                          aria-label="Add transaction"
                        >
                          +
                        </button>
                      </div>
                      <div className="mt-1 flex-1 space-y-0.5 overflow-hidden">
                        {dayTransactions.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              "truncate rounded px-1 text-xs",
                              t.type === "expense"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            )}
                          >
                            {t.merchant} · {formatAmount(t.amount, t.currency)}
                          </div>
                        ))}
                        {dayTransactions.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayTransactions.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Week View */}
      {view === "week" && (
        <>
          <div className="grid grid-cols-7 border-b border-border">
            {weekDates.map((date, i) => (
              <div key={i} className="py-2 text-center">
                <div className="text-xs font-medium text-muted-foreground">
                  {DAYS[i]}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm",
                    isSameDay(date, today) && "bg-primary text-primary-foreground font-medium"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7">
            {weekDates.map((date, i) => {
              const dayTransactions = getTransactionsForDate(date);
              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "group relative flex cursor-pointer flex-col border-r border-border p-2 text-left transition-colors",
                    "hover:bg-muted/50",
                    isSameDay(date, today) && "bg-primary/5",
                    selectedDate && isSameDay(date, selectedDate) && "ring-2 ring-primary ring-inset"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddModal(date);
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity hover:bg-primary/90 group-hover:opacity-100"
                    aria-label="Add transaction"
                  >
                    +
                  </button>
                  <div className="flex-1 space-y-1 overflow-auto">
                    {dayTransactions.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "rounded px-2 py-1 text-xs",
                          t.type === "expense"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        )}
                      >
                        <div className="font-medium">{formatAmount(t.amount, t.currency)}</div>
                        <div className="truncate text-[10px] opacity-75">{t.merchant}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Day View */}
      {view === "day" && (() => {
        const dayTransactions = getTransactionsForDate(currentDate);
        return (
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold",
                    isSameDay(currentDate, today) && "bg-primary text-primary-foreground"
                  )}
                >
                  {currentDate.getDate()}
                </div>
                <div>
                  <p className="font-medium">{DAYS_FULL[currentDate.getDay()]}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              <Button onClick={() => openAddModal(currentDate)} size="sm">
                + Add Transaction
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {dayTransactions.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border p-8">
                  <p className="text-sm text-muted-foreground">
                    No transactions for this day. Click "+ Add Transaction" to add one.
                  </p>
                </div>
              ) : (
                dayTransactions.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setEditTx(t);
                      setEditOpen(true);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                          t.type === "expense"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        )}
                      >
                        {t.type === "expense" ? "−" : "+"}
                      </div>
                      <div>
                        <p className="font-medium">{t.merchant}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.category || "No budget"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-semibold",
                          t.type === "expense" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                        )}
                      >
                        {formatAmount(t.amount, t.currency)}
                      </p>
                      {t.notes && (
                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {t.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* Selected date info */}
      {selectedDate && view !== "day" && (() => {
        const selectedTransactions = getTransactionsForDate(selectedDate);
        const totalExpense = selectedTransactions
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);
        const totalIncome = selectedTransactions
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);
        
        return (
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
              {selectedTransactions.length > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {selectedTransactions.length} transaction{selectedTransactions.length !== 1 ? "s" : ""}
                  </span>
                  {totalIncome > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      +${totalIncome.toFixed(2)}
                    </span>
                  )}
                  {totalExpense > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      -${totalExpense.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        selectedDate={modalDate}
        defaultGroupId={activeGroup?.id}
      />

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
