import { MonthlyCalendar } from "@/components/tracker/monthly-calendar";

export default function TrackerPage() {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tracker</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage your transactions by date
        </p>
      </div>
      <div className="flex-1">
        <MonthlyCalendar />
      </div>
    </div>
  );
}
