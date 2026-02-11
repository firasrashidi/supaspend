"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CreateGroupModal } from "@/components/tracker/create-group-modal";
import { JoinGroupModal } from "@/components/tracker/join-group-modal";
import type { Group, GroupMember } from "@/types/database";

type GroupWithRole = Group & { role: string; member_count: number };

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get groups the user is a member of
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, role")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);
    const roleMap = Object.fromEntries(
      memberships.map((m) => [m.group_id, m.role])
    );

    // Get group details
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds);

    // Get member counts
    const { data: allMembers } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const countMap: Record<string, number> = {};
    allMembers?.forEach((m) => {
      countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
    });

    const enriched: GroupWithRole[] = (groupsData || []).map((g) => ({
      ...g,
      role: roleMap[g.id] || "member",
      member_count: countMap[g.id] || 1,
    }));

    setGroups(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
          <p className="mt-1 text-muted-foreground">
            Create or join groups to track expenses together
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            Join group
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            + Create group
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">👥</p>
            <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a group to start tracking together, or join one with an
              invite code.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setJoinOpen(true)}>
                Join group
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                + Create group
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/tracker/groups/${group.id}`}
              className="block rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{group.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {group.member_count} member
                    {group.member_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    group.role === "owner"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {group.role}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Code:</span>
                <span className="font-mono text-sm font-medium tracking-widest">
                  {group.invite_code}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    copyCode(group.invite_code, group.id);
                  }}
                  className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copiedId === group.id ? "Copied!" : "Copy"}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onGroupCreated={fetchGroups}
      />
      <JoinGroupModal
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onGroupJoined={fetchGroups}
      />
    </div>
  );
}
