"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Group } from "@/types/database";

interface GroupContextValue {
  groups: Group[];
  activeGroup: Group | null;
  setActiveGroup: (group: Group) => void;
  refreshGroups: () => Promise<void>;
  loading: boolean;
}

const GroupContext = createContext<GroupContextValue>({
  groups: [],
  activeGroup: null,
  setActiveGroup: () => {},
  refreshGroups: async () => {},
  loading: true,
});

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setActiveGroupState(null);
      setLoading(false);
      return;
    }

    const ids = memberships.map((m) => m.group_id);
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .in("id", ids);

    const list = groupsData || [];
    setGroups(list);

    // Restore last active group from localStorage, or pick first
    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem("supaspend_active_group")
        : null;
    const saved = list.find((g) => g.id === savedId);
    setActiveGroupState(saved || list[0] || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setActiveGroup = (group: Group) => {
    setActiveGroupState(group);
    localStorage.setItem("supaspend_active_group", group.id);
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroup,
        setActiveGroup,
        refreshGroups: fetchGroups,
        loading,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  return useContext(GroupContext);
}
