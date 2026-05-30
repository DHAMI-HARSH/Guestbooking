"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationBar, type PaginationMeta } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/types";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "APPROVER", label: "Approver" },
  { value: "ESTATE_PRIMARY", label: "Estate Manager" },
  { value: "ADMIN", label: "Admin" },
];

interface NewUserState {
  ecode: string;
  name: string;
  department: string;
  unit: string;
  role: Role;
  password: string;
  is_active: boolean;
}

interface ManagedUser {
  id: number;
  ecode: string;
  name: string;
  department: string;
  unit: string | null;
  role: Role;
  is_active: boolean;
  created_by_admin_id?: number | null;
  created_at: string;
}

const initialState: NewUserState = {
  ecode: "",
  name: "",
  department: "",
  unit: "",
  role: "EMPLOYEE",
  password: "",
  is_active: true,
};

export function AdminUsersPanel() {
  const [form, setForm] = useState<NewUserState>(initialState);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const loadUsers = useCallback(async (nextPage = 1, nextSearch = "") => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
      });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load accounts");

      setUsers(data.users ?? []);
      setPagination((data.pagination ?? null) as PaginationMeta | null);
      setPage((data.pagination?.page as number | undefined) ?? nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      setUsers([]);
      setPagination(null);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers(page, search);
  }, [loadUsers, page, search]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        ecode: form.ecode.trim(),
        name: form.name.trim(),
        department: form.department.trim(),
        unit: form.unit.trim() || null,
        role: form.role,
        password: form.password,
        is_active: form.is_active,
      };

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      setMessage(`Account created for ${data.user?.ecode ?? payload.ecode}.`);
      setForm((prev) => ({
        ...initialState,
        role: prev.role,
      }));
      await loadUsers(1, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    if (resetPassword !== resetConfirm) {
      setError("Passwords do not match");
      return;
    }

    setResetLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password");

      setMessage(`Password reset for ${resetTarget.ecode}.`);
      setResetTarget(null);
      setResetPassword("");
      setResetConfirm("");
      await loadUsers(page, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  }

  function openResetModal(user: ManagedUser) {
    setResetTarget(user);
    setResetPassword("");
    setResetConfirm("");
  }

  function closeResetModal() {
    setResetTarget(null);
    setResetPassword("");
    setResetConfirm("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Create and Manage Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ecode</Label>
            <Input value={form.ecode} onChange={(e) => setForm((prev) => ({ ...prev, ecode: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input
              value={form.department}
              onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(value: Role) => setForm((prev) => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temporary Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_active: Boolean(value) }))}
            />
            <span className="text-sm">Active account</span>
          </div>

          {message ? <p className="text-sm font-medium text-emerald-600 md:col-span-2">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-600 md:col-span-2">{error}</p> : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>

        <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Accounts You Created</h3>
              <p className="text-xs text-muted-foreground">Reset passwords for accounts created from this admin profile.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-full max-w-xs"
                placeholder="Search by ecode, name, department..."
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
              <Button variant="outline" onClick={() => loadUsers(page, search)} disabled={listLoading}>
                {listLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ecode</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      {listLoading ? "Loading accounts..." : "No accounts found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.ecode}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>{user.unit || "-"}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openResetModal(user)}>
                          Reset Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationBar pagination={pagination} onPageChange={setPage} loading={listLoading} />
        </div>
      </CardContent>

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Reset Password</h3>
                <p className="text-sm text-muted-foreground">
                  {resetTarget.ecode} - {resetTarget.name}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeResetModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeResetModal} disabled={resetLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? "Saving..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
