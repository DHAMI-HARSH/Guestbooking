export type Role = "EMPLOYEE" | "APPROVER" | "ESTATE_PRIMARY" | "ADMIN";

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
  guest_email: string;
  guest_phone: string;
  guest_address: string;
  guest_pincode: string;
  guest_city: string;
  guest_state: string;
  room_configuration: string | null;
  meal_plan: "General" | "Special";
  guests: string | null;
  estimated_cost: number | null;
  extra_bed: boolean;
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
  special_requests: string | null;
  created_by: number;
  approval_status: ApprovalStatus;
  estate_status: EstateStatus;
  cancellation_remarks: string | null;
  created_at: string;
}

export type RoomAllocationStatus = "ALLOCATED" | "RELEASED";

export interface RoomAllocationRecord {
  id: number;
  booking_id: number;
  room_number: string;
  allocation_status: RoomAllocationStatus;
  created_at: string;
}
