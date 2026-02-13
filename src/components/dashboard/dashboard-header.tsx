"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useGroup } from "@/contexts/group-context";
import { createClient } from "@/lib/supabase/client";
import { CreateGroupModal } from "@/components/tracker/create-group-modal";

export function DashboardHeader() {
  const { groups, activeGroup, setActiveGroup, refreshGroups } = useGroup();
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitial, setUserInitial] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Fetch user name
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const first = profile?.first_name || "";
      const last = profile?.last_name || "";
      const name = first
        ? last
          ? `${first} ${last}`
          : first
        : user.email?.split("@")[0] || "User";

      setUserName(name);
      setUserInitial((first || name).charAt(0).toUpperCase());
    }
    load();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    if (groupDropdownOpen || userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [groupDropdownOpen, userDropdownOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: logo + group switcher */}
      <div className="flex items-center gap-3 text-sm">
        <Link href="/tracker" className="text-2xl" aria-label="Tracker">
          💳
        </Link>
        {activeGroup && (
          <>
            <span className="text-muted-foreground">/</span>
            <div className="relative" ref={groupRef}>
              <button
                onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                className="flex items-center gap-1 font-medium transition-colors hover:text-primary"
              >
                {activeGroup.name}
                <svg
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    groupDropdownOpen && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {groupDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setActiveGroup(g);
                        setGroupDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        g.id === activeGroup.id &&
                          "bg-accent font-medium text-accent-foreground"
                      )}
                    >
                      {g.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => {
                      setGroupDropdownOpen(false);
                      setCreateGroupOpen(true);
                    }}
                    className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="mr-2 text-primary">+</span> Add group
                  </button>
                  <Link
                    href="/tracker/settings"
                    onClick={() => setGroupDropdownOpen(false)}
                    className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Manage groups
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: user menu */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {userInitial}
          </div>
          <span className="hidden font-medium sm:inline">{userName}</span>
          <svg
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              userDropdownOpen && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {userDropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
            </div>
            <div className="my-1 border-t border-border" />
            <Link
              href="/tracker/account"
              onClick={() => setUserDropdownOpen(false)}
              className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              Account settings
            </Link>
            <div className="my-1 border-t border-border" />
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-accent dark:text-red-400"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
      {/* Create Group Modal */}
      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onGroupCreated={refreshGroups}
      />
    </header>
  );
}
