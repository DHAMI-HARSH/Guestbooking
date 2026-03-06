import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { DashboardApp } from "@/components/dashboard/dashboard-app";

export default async function EstateSecondaryDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.role !== "ESTATE_SECONDARY") redirect("/dashboard");
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4 sm:p-6">
      <DashboardApp user={session} />
    </main>
  );
}
