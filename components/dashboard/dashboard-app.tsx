"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingForm } from "@/components/dashboard/booking-form";
import { BookingManage } from "@/components/dashboard/booking-manage";
import { ApproverPanel } from "@/components/dashboard/approver-panel";
import { EstatePrimaryPanel } from "@/components/dashboard/estate-primary-panel";
import { EstateSecondaryPanel } from "@/components/dashboard/estate-secondary-panel";
import { ReportsPanel } from "@/components/dashboard/reports-panel";
import { roleLabel } from "@/components/dashboard/shared";
import type { SessionUser } from "@/lib/types";

interface DashboardAppProps {
  user: SessionUser;
}

export function DashboardApp({ user }: DashboardAppProps) {
  const router = useRouter();
  const [tab, setTab] = useState(() => {
    if (user.role === "EMPLOYEE") return "booking";
    if (user.role === "APPROVER") return "approval";
    if (user.role === "ESTATE_PRIMARY") return "estate-primary";
    return "estate-secondary";
  });
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        console.error("Logout failed", response.status);
      }
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const isEmployee = user.role === "EMPLOYEE";
  const isApprover = user.role === "APPROVER";
  const isPrimary = user.role === "ESTATE_PRIMARY";
  const isSecondary = user.role === "ESTATE_SECONDARY";
  const canViewReports = isApprover || isPrimary || isSecondary;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-sky-200/70 bg-gradient-to-r from-sky-50 via-white to-emerald-50">
        <CardContent className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              <Bell className="h-3.5 w-3.5" />
              Guest House Management System
            </p>
            <h1 className="text-xl font-semibold md:text-2xl">{roleLabel(user.role)}</h1>
            <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UserCircle2 className="h-4 w-4" /> {user.name}
              </span>
              <span>Ecode: {user.ecode}</span>
              <span>Unit: {user.unit || "-"}</span>
              <span>Department: {user.department}</span>
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? "Logging out..." : "Logout"}
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap gap-2 bg-transparent p-0">
          {isEmployee ? <TabsTrigger value="booking">Booking</TabsTrigger> : null}
          {isEmployee ? <TabsTrigger value="manage">Cancellation / Modify</TabsTrigger> : null}
          {isApprover ? <TabsTrigger value="approval">Approval</TabsTrigger> : null}
          {isPrimary ? <TabsTrigger value="estate-primary">Estate Primary</TabsTrigger> : null}
          {isSecondary ? <TabsTrigger value="estate-secondary">Estate Secondary</TabsTrigger> : null}
          {canViewReports ? <TabsTrigger value="reports">Reports</TabsTrigger> : null}
        </TabsList>

        {isEmployee ? (
          <TabsContent value="booking">
            <BookingForm />
          </TabsContent>
        ) : null}

        {isEmployee ? (
          <TabsContent value="manage">
            <BookingManage />
          </TabsContent>
        ) : null}

        {isApprover ? (
          <TabsContent value="approval">
            <ApproverPanel />
          </TabsContent>
        ) : null}

        {isPrimary ? (
          <TabsContent value="estate-primary">
            <EstatePrimaryPanel />
          </TabsContent>
        ) : null}

        {isSecondary ? (
          <TabsContent value="estate-secondary">
            <EstateSecondaryPanel />
          </TabsContent>
        ) : null}

        {canViewReports ? (
          <TabsContent value="reports">
            <ReportsPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
