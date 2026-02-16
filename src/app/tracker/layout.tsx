import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { GroupProvider } from "@/contexts/group-context";
import { ChatBubble } from "@/components/tracker/chat-bubble";

export default async function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/tracker");
  }

  return (
    <GroupProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <DashboardHeader />
        <div className="flex flex-1">
          <SidebarNav />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <ChatBubble />
    </GroupProvider>
  );
}
