import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RoomAllocationPanel } from "@/components/dashboard/room-allocation-panel";

export default async function RoomAllocationPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.role !== "ESTATE_PRIMARY" && session.role !== "ADMIN") redirect("/dashboard");

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Room Allocation</h1>
          <p className="text-sm text-muted-foreground">Estate Manager workspace for room assignment.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      <RoomAllocationPanel />
    </main>
  );
}
