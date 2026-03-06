export type Role = "EMPLOYEE" | "APPROVER" | "ESTATE_PRIMARY" | "ESTATE_SECONDARY";

export type ApprovalStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type EstateStatus =
  | "PENDING_ESTATE_REVIEW"
  | "ROOM_ALLOCATED"
  | "SERVICES_APPROVED"
  | "ESTATE_REJECTED";

export type ServiceKey = "Room" | "Breakfast" | "Lunch" | "Dinner";

export interface SessionUser {
  id: number;
  ecode: string;
  name: string;
  department: string;
  unit: string | null;
  role: Role;
}

export interface BookingRecord {
  id: number;
  guest_name: string;
  guest_phone: string;
  guest_address: string;
  purpose: "Official" | "Personal";
  justification: string;
  arrival_date: string;
  arrival_time: string;
  departure_date: string;
  departure_time: string;
  stay_days: number;
  male_count: number;
  female_count: number;
  children_count: number;
  total_guests: number;
  services_required: string;
  rooms_required: number;
  booking_cost_center: string;
  created_by: number;
  approval_status: ApprovalStatus;
  estate_status: EstateStatus;
  cancellation_remarks: string | null;
  created_at: string;
}
