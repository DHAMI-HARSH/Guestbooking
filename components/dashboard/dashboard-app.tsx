"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingForm } from "@/components/dashboard/booking-form";
import { BookingManage } from "@/components/dashboard/booking-manage";
import { MyBookings } from "@/components/dashboard/my-bookings";
import { ApproverPanel } from "@/components/dashboard/approver-panel";
import { EstatePrimaryPanel } from "@/components/dashboard/estate-primary-panel";
import { RoomAllocationPanel } from "@/components/dashboard/room-allocation-panel";
import { ReportsPanel } from "@/components/dashboard/reports-panel";
import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { roleLabel } from "@/components/dashboard/shared";
import type { SessionUser } from "@/lib/types";

interface DashboardAppProps {
  user: SessionUser;
}

export function DashboardApp({ user }: DashboardAppProps) {
  const router = useRouter();
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);
  const [tab, setTab] = useState(() => {
    if (user.role === "ADMIN") return "admin";
    if (user.role === "EMPLOYEE") return "booking";
    if (user.role === "APPROVER") return "approval";
    return "estate-primary";
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

  const isAdmin = user.role === "ADMIN";
  const isEmployee = user.role === "EMPLOYEE";
  const isApprover = user.role === "APPROVER";
  const isPrimary = user.role === "ESTATE_PRIMARY";
  const canViewReports = isApprover || isPrimary || isAdmin;
  const canSelfBook = isEmployee || isApprover || isPrimary || isAdmin;
  const showEmployeeTabs = isEmployee || isAdmin;
  const showApproverTabs = isApprover || isAdmin;
  const showEstateTabs = isPrimary || isAdmin;
  const handleBookingCreated = () => {
    setBookingRefreshKey((prev) => prev + 1);
    router.refresh();
  };

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
          {showEmployeeTabs ? <TabsTrigger value="booking">Booking</TabsTrigger> : null}
          {showEmployeeTabs ? <TabsTrigger value="my-bookings">My Bookings</TabsTrigger> : null}
          {showEmployeeTabs ? <TabsTrigger value="manage">Cancellation / Modify</TabsTrigger> : null}
          {showApproverTabs ? <TabsTrigger value="approval">Approval</TabsTrigger> : null}
          {showEstateTabs ? <TabsTrigger value="estate-primary">Estate Primary</TabsTrigger> : null}
          {showEstateTabs ? <TabsTrigger value="room-allocation">Room Allocation</TabsTrigger> : null}
          {!showEmployeeTabs && canSelfBook ? <TabsTrigger value="self-booking">Self Booking</TabsTrigger> : null}
          {canViewReports ? <TabsTrigger value="reports">Reports</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="admin">Admin</TabsTrigger> : null}
        </TabsList>

        {showEmployeeTabs ? (
          <TabsContent value="booking">
            <BookingForm onCreated={handleBookingCreated} />
          </TabsContent>
        ) : null}

        {showEmployeeTabs ? (
          <TabsContent value="my-bookings">
            <MyBookings refreshKey={bookingRefreshKey} />
          </TabsContent>
        ) : null}

        {showEmployeeTabs ? (
          <TabsContent value="manage">
            <BookingManage refreshKey={bookingRefreshKey} onChanged={handleBookingCreated} />
          </TabsContent>
        ) : null}

        {showApproverTabs ? (
          <TabsContent value="approval">
            <ApproverPanel />
          </TabsContent>
        ) : null}

        {showEstateTabs ? (
          <TabsContent value="estate-primary">
            <EstatePrimaryPanel />
          </TabsContent>
        ) : null}

        {showEstateTabs ? (
          <TabsContent value="room-allocation">
            <RoomAllocationPanel />
          </TabsContent>
        ) : null}

        {!showEmployeeTabs && canSelfBook ? (
          <TabsContent value="self-booking">
            <BookingForm onCreated={handleBookingCreated} />
          </TabsContent>
        ) : null}

        {canViewReports ? (
          <TabsContent value="reports">
            <ReportsPanel />
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="admin">
            <AdminUsersPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
