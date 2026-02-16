"use client";

import { useState, useMemo, useEffect } from "react";
import { codes, code as getCurrency } from "currency-codes";
import { getRate } from "@/lib/exchange";
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
import { Textarea } from "@/components/ui/textarea";
import { BudgetCombobox } from "./budget-combobox";
import { createClient } from "@/lib/supabase/client";
import { useGroup } from "@/contexts/group-context";
import type { Group } from "@/types/database";

// Currency symbols for common currencies (ISO doesn't include symbols)
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  KRW: "₩",
  BRL: "R$",
  RUB: "₽",
  TRY: "₺",
  THB: "฿",
  PLN: "zł",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CHF: "Fr",
  AED: "د.إ",
  SAR: "﷼",
  ILS: "₪",
  PHP: "₱",
  MYR: "RM",
  IDR: "Rp",
  VND: "₫",
  NGN: "₦",
  ZAR: "R",
  EGP: "£",
  PKR: "₨",
  BDT: "৳",
  MAD: "د.م.",
};

// Most common currencies to show at the top
const PRIORITY_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "INR", "MXN",
  "BRL", "KRW", "AED", "SAR", "MAD", "SGD", "HKD", "NZD", "SEK", "NOK",
];

// Non-currency codes to exclude (precious metals, testing codes, supranational, etc.)
const EXCLUDED_CODES = new Set([
  "XAU", // Gold
  "XAG", // Silver
  "XPT", // Platinum
  "XPD", // Palladium
  "XBA", // Bond Markets Unit European Composite Unit
  "XBB", // Bond Markets Unit European Monetary Unit
  "XBC", // Bond Markets Unit European Unit of Account 9
  "XBD", // Bond Markets Unit European Unit of Account 17
  "XDR", // IMF Special Drawing Rights
  "XSU", // Sucre
  "XUA", // ADB Unit of Account
  "XTS", // Testing
  "XXX", // No currency
]);

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  defaultGroupId?: string;
}


function getSymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}

export function AddTransactionModal({
  open,
  onOpenChange,
  selectedDate,
  defaultGroupId,
}: AddTransactionModalProps) {
  const { activeGroup } = useGroup();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(activeGroup?.currency || "USD");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState<string>(defaultGroupId || "");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [budgetCurrency, setBudgetCurrency] = useState<string | null>(null);
  const [convertedPreview, setConvertedPreview] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  const needsConversion = budgetCurrency !== null && currency !== budgetCurrency;

  // Clear preview when currency, amount, or budget changes
  useEffect(() => {
    setConvertedPreview(null);
    setConversionRate(null);
  }, [currency, budgetCurrency, amount]);

  // Manual fetch triggered by button click
  const handleConvert = async () => {
    const numAmount = parseFloat(amount);
    if (!needsConversion || !budgetCurrency || isNaN(numAmount) || numAmount <= 0) return;
    setLoadingRate(true);
    try {
      const rate = await getRate(currency, budgetCurrency);
      setConversionRate(rate);
      setConvertedPreview(Math.round(numAmount * rate * 100) / 100);
    } catch {
      setConversionRate(null);
      setConvertedPreview(null);
    } finally {
      setLoadingRate(false);
    }
  };

  // Fetch user's groups on mount
  useEffect(() => {
    if (!open) return;
    async function fetchGroups() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (memberships && memberships.length > 0) {
        const ids = memberships.map((m) => m.group_id);
        const { data: groupsData } = await supabase
          .from("groups")
          .select("*")
          .in("id", ids);
        const list = groupsData || [];
        setGroups(list);
        // Default to first group if no defaultGroupId
        if (!defaultGroupId && list.length > 0) {
          setGroupId(list[0].id);
        }
      }
    }
    fetchGroups();
  }, [open, defaultGroupId]);

  // All currencies sorted: priority first, then alphabetically (excluding non-currencies)
  const allCurrencies = useMemo(() => {
    const all = codes().filter((c) => !EXCLUDED_CODES.has(c));
    const priority = PRIORITY_CURRENCIES.filter((c) => all.includes(c));
    const rest = all.filter((c) => !PRIORITY_CURRENCIES.includes(c)).sort();
    return [...priority, ...rest];
  }, []);

  const currencySymbol = getSymbol(currency);

  const resetForm = () => {
    setType("expense");
    setAmount("");
    setCurrency(activeGroup?.currency || "USD");
    setMerchant("");
    setCategory("");
    setBudgetCurrency(null);
    setNotes("");
    setReceiptFile(null);
    setGroupId(defaultGroupId || "");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        throw new Error("Not authenticated");
      }

      const userId = userData.user.id;
      let receiptUrl: string | null = null;

      // Upload receipt if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, receiptFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("receipts")
            .getPublicUrl(fileName);
          receiptUrl = urlData.publicUrl;
        }
      }

      // Convert amount if transaction currency differs from budget currency
      let convertedAmount: number | null = null;
      let convertedCurrency: string | null = null;

      if (budgetCurrency && currency !== budgetCurrency) {
        try {
          const rate = conversionRate ?? (await getRate(currency, budgetCurrency));
          convertedAmount = Math.round(parseFloat(amount) * rate * 100) / 100;
          convertedCurrency = budgetCurrency;
        } catch {
          // If conversion fails, save without converted amount
        }
      }

      // Insert transaction
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: userId,
        type,
        date: selectedDate.toISOString().split("T")[0],
        amount: parseFloat(amount),
        currency,
        merchant: merchant.trim(),
        category: category.trim() || null,
        notes: notes.trim() || null,
        receipt_url: receiptUrl,
        group_id: groupId,
        converted_amount: convertedAmount,
        converted_currency: convertedCurrency,
      });

      if (insertError) {
        throw insertError;
      }

      handleClose();
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>{formattedDate}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setType("expense")}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setType("income")}
              >
                Income
              </Button>
            </div>

            {/* Amount and Currency */}
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
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
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12"
                    required
                  />
                </div>
              </div>
              {needsConversion && budgetCurrency && (
                <div className="flex items-center gap-2">
                  {convertedPreview !== null ? (
                    <p className="text-xs text-muted-foreground">
                      ≈ {convertedPreview.toFixed(2)} {budgetCurrency}
                      <span className="ml-1 opacity-60">
                        (1 {currency} = {conversionRate?.toFixed(4)} {budgetCurrency})
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Budget is in {budgetCurrency} — will be converted
                      </p>
                      <button
                        type="button"
                        onClick={handleConvert}
                        disabled={loadingRate || !amount}
                        className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                      >
                        {loadingRate ? "Converting..." : "Convert"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Merchant */}
            <div className="grid gap-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                placeholder={type === "expense" ? "e.g. Starbucks" : "e.g. Employer"}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                required
              />
            </div>

            {/* Budget */}
            <div className="grid gap-2">
              <Label>Budget</Label>
              <BudgetCombobox
                value={category}
                onChange={setCategory}
                onCurrencyChange={setBudgetCurrency}
                groupId={groupId || undefined}
              />
            </div>

            {/* Group assignment */}
            {groups.length > 0 && (
              <div className="grid gap-2">
                <Label>Assign to</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Receipt upload */}
            <div className="grid gap-2">
              <Label htmlFor="receipt">Receipt (optional)</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {receiptFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {receiptFile.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
