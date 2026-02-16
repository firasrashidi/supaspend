"use client";

import { useState, useMemo } from "react";
import { codes, code as getCurrency } from "currency-codes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const PRIORITY_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "INR", "MXN",
  "BRL", "KRW", "AED", "SAR", "MAD", "SGD", "HKD", "NZD", "SEK", "NOK",
];

const EXCLUDED_CODES = new Set([
  "XAU", "XAG", "XPT", "XPD", "XBA", "XBB", "XBC", "XBD",
  "XDR", "XSU", "XUA", "XTS", "XXX",
]);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface AddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onBudgetCreated: () => void;
  defaultMonth?: number;
  defaultYear?: number;
}

export function AddBudgetModal({
  open,
  onOpenChange,
  groupId,
  onBudgetCreated,
  defaultMonth,
  defaultYear,
}: AddBudgetModalProps) {
  const now = new Date();
  const [category, setCategory] = useState("");
  const [amountLimit, setAmountLimit] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [month, setMonth] = useState(
    String(defaultMonth ?? now.getMonth() + 1)
  );
  const [year, setYear] = useState(
    String(defaultYear ?? now.getFullYear())
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCurrencies = useMemo(() => {
    const all = codes().filter((c) => !EXCLUDED_CODES.has(c));
    const priority = PRIORITY_CURRENCIES.filter((c) => all.includes(c));
    const rest = all.filter((c) => !PRIORITY_CURRENCIES.includes(c)).sort();
    return [...priority, ...rest];
  }, []);

  // Generate year options: current year -1 to +2
  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 4 }, (_, i) => current - 1 + i);
  }, []);

  const resetForm = () => {
    setCategory("");
    setAmountLimit("");
    setCurrency("USD");
    setMonth(String(defaultMonth ?? now.getMonth() + 1));
    setYear(String(defaultYear ?? now.getFullYear()));
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !amountLimit) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: insertError } = await supabase
        .from("group_budgets")
        .upsert(
          {
            group_id: groupId,
            category: category.trim(),
            amount_limit: parseFloat(amountLimit),
            currency,
            month: parseInt(month),
            year: parseInt(year),
          },
          { onConflict: "group_id,category,month,year" }
        );

      if (insertError) throw insertError;

      onBudgetCreated();
      handleClose();
    } catch (err) {
      console.error("Failed to create budget:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create budget"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add Budget</DialogTitle>
          <DialogDescription>
            Define a monthly spending limit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Budget name */}
            <div className="grid gap-2">
              <Label>Budget name</Label>
              <Input
                placeholder="e.g. Dining, Rent, Transport"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>

            {/* Amount limit and currency */}
            <div className="grid gap-2">
              <Label htmlFor="budget-amount">Budget limit</Label>
              <div className="flex gap-2">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allCurrencies.map((c) => {
                      const info = getCurrency(c);
                      return (
                        <SelectItem key={c} value={c}>
                          {c} {info ? `- ${info.currency}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amountLimit}
                  onChange={(e) => setAmountLimit(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !category.trim() || !amountLimit}
            >
              {loading ? "Saving..." : "Set Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
