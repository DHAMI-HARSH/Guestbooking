import { Badge } from "@/components/ui/badge";
import type { ApprovalStatus, EstateStatus, Role } from "@/lib/types";

export function roleLabel(role: Role) {
  if (role === "EMPLOYEE") return "Employee / Booking Creator";
  if (role === "APPROVER") return "Approving Authority";
  if (role === "ADMIN") return "Administrator";
  return "Estate Manager (Primary)";
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  if (status === "APPROVED") return <Badge variant="success">APPROVED</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">REJECTED</Badge>;
  if (status === "CANCELLED") return <Badge variant="secondary">CANCELLED</Badge>;
  return <Badge>PENDING_APPROVAL</Badge>;
}

export function EstateBadge({ status }: { status: EstateStatus }) {
  if (status === "ROOM_ALLOCATED") return <Badge variant="success">ROOM_ALLOCATED</Badge>;
  if (status === "SERVICES_APPROVED") return <Badge variant="success">SERVICES_APPROVED</Badge>;
  if (status === "ESTATE_REJECTED") return <Badge variant="destructive">ESTATE_REJECTED</Badge>;
  return <Badge variant="secondary">PENDING_ESTATE_REVIEW</Badge>;
}
