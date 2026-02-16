"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { codes, code as getCurrency } from "currency-codes";
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
import { CreateGroupModal } from "@/components/tracker/create-group-modal";
import { JoinGroupModal } from "@/components/tracker/join-group-modal";
import type { Profile } from "@/types/database";

const PRIORITY_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "INR", "MXN",
  "BRL", "KRW", "AED", "SAR", "MAD", "SGD", "HKD", "NZD", "SEK", "NOK",
];

const EXCLUDED_CODES = new Set([
  "XAU", "XAG", "XPT", "XPD", "XBA", "XBB", "XBC", "XBD",
  "XDR", "XSU", "XUA", "XTS", "XXX",
]);

type MemberWithProfile = {
  user_id: string;
  role: string;
  joined_at: string;
  profile: Profile | null;
};

export default function SettingsPage() {
  const { groups, activeGroup, setActiveGroup, refreshGroups } = useGroup();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const allCurrencies = useMemo(() => {
    const all = codes().filter((c) => !EXCLUDED_CODES.has(c));
    const priority = PRIORITY_CURRENCIES.filter((c) => all.includes(c));
    const rest = all.filter((c) => !PRIORITY_CURRENCIES.includes(c)).sort();
    return [...priority, ...rest];
  }, []);

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!activeGroup || newCurrency === activeGroup.currency) return;
    setSavingCurrency(true);
    const supabase = createClient();
    await supabase
      .from("groups")
      .update({ currency: newCurrency })
      .eq("id", activeGroup.id);
    await refreshGroups();
    setSavingCurrency(false);
  };

  const fetchMembers = useCallback(async () => {
    if (!activeGroup) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data: membersData } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", activeGroup.id)
      .order("joined_at", { ascending: true });

    if (!membersData || membersData.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all members
    const userIds = membersData.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p])
    );

    const enriched: MemberWithProfile[] = membersData.map((m) => ({
      ...m,
      profile: profileMap[m.user_id] || null,
    }));

    setMembers(enriched);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const copyCode = () => {
    if (activeGroup) {
      navigator.clipboard.writeText(activeGroup.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleGroupCreated = () => {
    refreshGroups();
  };

  const handleGroupJoined = () => {
    refreshGroups();
  };

  const getMemberName = (m: MemberWithProfile) => {
    if (m.profile?.first_name) {
      return m.profile.last_name
        ? `${m.profile.first_name} ${m.profile.last_name}`
        : m.profile.first_name;
    }
    return "Member";
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your groups and members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            Join group
          </Button>
          <Button onClick={() => setCreateOpen(true)}>+ Create group</Button>
        </div>
      </div>

      {/* All groups list */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Your Groups
        </h2>
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No groups yet. Create one or join with an invite code.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  g.id === activeGroup?.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active group details */}
      {activeGroup && (
        <>
          {/* Currency setting (all groups) */}
          <div className="mb-8 rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Currency</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Default currency for transactions and budgets in{" "}
              <span className="font-medium text-foreground">
                {activeGroup.name}
              </span>
              .
            </p>
            <Select
              value={activeGroup.currency}
              onValueChange={handleCurrencyChange}
              disabled={savingCurrency}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {allCurrencies.map((c) => {
                  const info = getCurrency(c);
                  return (
                    <SelectItem key={c} value={c}>
                      {c} {info ? `— ${info.currency}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {activeGroup.is_personal ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                This is your personal group. Only you can see and manage
                transactions and budgets here.
              </p>
            </div>
          ) : (
            <>
              {/* Invite code */}
              <div className="mb-8 rounded-lg border border-border bg-card p-5">
                <h2 className="mb-3 font-semibold">Invite Code</h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  Share this code to invite people to{" "}
                  <span className="font-medium text-foreground">
                    {activeGroup.name}
                  </span>
                  .
                </p>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted px-4 py-2.5 font-mono text-lg font-bold tracking-[0.3em]">
                    {activeGroup.invite_code}
                  </div>
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    {copiedCode ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Members */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">
                    Members ({members.length})
                  </h2>
                </div>
                {loading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading members...
                  </p>
                ) : (
                  <div className="space-y-3">
                    {members.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {getMemberName(m).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {getMemberName(m)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined{" "}
                              {new Date(m.joined_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            m.role === "owner"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onGroupCreated={handleGroupCreated}
      />
      <JoinGroupModal
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onGroupJoined={handleGroupJoined}
      />
    </div>
  );
}
