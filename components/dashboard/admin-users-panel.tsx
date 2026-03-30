"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Create User Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ecode</Label>
            <Input
              value={form.ecode}
              onChange={(e) => setForm((prev) => ({ ...prev, ecode: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
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
            <Input
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(value: Role) => setForm((prev) => ({ ...prev, role: value }))}
            >
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
      </CardContent>
    </Card>
  );
}
