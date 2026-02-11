"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/tracker", label: "Tracker" },
  { href: "/tracker/transactions", label: "Transactions" },
  { href: "/tracker/budget", label: "Budget" },
  { href: "/tracker/settings", label: "Settings" },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label }) => {
          const isActive =
            href === "/tracker"
              ? pathname === "/tracker"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
