"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface BudgetComboboxProps {
  value: string;
  onChange: (value: string) => void;
  groupId?: string;
}

export function BudgetCombobox({
  value,
  onChange,
  groupId,
}: BudgetComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [budgets, setBudgets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch budgets for the group
  useEffect(() => {
    const fetchBudgets = async () => {
      if (!groupId) {
        setBudgets([]);
        return;
      }

      setLoading(true);
      const supabase = createClient();

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data } = await supabase
        .from("group_budgets")
        .select("category")
        .eq("group_id", groupId)
        .eq("month", month)
        .eq("year", year)
        .order("category");

      const unique = [...new Set((data || []).map((d) => d.category))];
      setBudgets(unique);
      setLoading(false);
    };

    fetchBudgets();
  }, [groupId]);

  const filtered = search.trim()
    ? budgets.filter((b) =>
        b.toLowerCase().includes(search.trim().toLowerCase())
      )
    : budgets;

  const handleSelect = (selectedName: string) => {
    onChange(selectedName === value ? "" : selectedName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select budget..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search budgets..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <CommandEmpty>
                {budgets.length === 0 ? (
                  <div className="space-y-2">
                    <p>No budgets set for this group.</p>
                    <Link
                      href="/tracker/budget"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Add a budget &rarr;
                    </Link>
                  </div>
                ) : (
                  "No matching budgets."
                )}
              </CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Budgets">
                {filtered.map((b) => (
                  <CommandItem
                    key={b}
                    value={b}
                    onSelect={() => handleSelect(b)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === b ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {b}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
