-- Seed users and sample workflow data
-- Default password for all users: password
-- bcrypt hash used: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

INSERT INTO Users (ecode, name, unit, department, role, password_hash)
VALUES
  ('EMP001', 'Anita Sharma', 'Academic Affairs', 'Computer Science', 'EMPLOYEE', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('APP001', 'Ravi Menon', 'Dean Office', 'Administration', 'APPROVER', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('EST001', 'Priya Sinha', 'Estate Cell', 'Estate Management', 'ESTATE_PRIMARY', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('ADM001', 'Admin User', 'Admin Office', 'Administration', 'ADMIN', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

INSERT INTO Bookings (
  guest_name, guest_email, guest_phone, guest_address, guest_pincode, guest_city, guest_state,
  purpose, justification, special_requests, arrival_date, arrival_time, departure_date, departure_time,
  stay_days, male_count, female_count, children_count, total_guests, services_required, rooms_required,
  booking_cost_center, created_by, approval_status, estate_status
)
VALUES
  (
    'Dr. Mahesh Rao', 'mahesh.rao@example.com', '9876543210', 'IIT Guest Faculty Quarters', '600036', 'Chennai', 'Tamil Nadu',
    'Official', 'Visiting faculty lecture series', 'Late check-in requested.',
    CAST(GETDATE() + 2 AS DATE), '14:00', CAST(GETDATE() + 4 AS DATE), '10:00', 2, 1, 1, 0, 2,
    '["Room","Breakfast","Lunch","Dinner"]', 1, 'CS-TRAVEL-2026', 1, 'PENDING_APPROVAL', 'PENDING_ESTATE_REVIEW'
  ),
  (
    'Suman Pal', 'suman.pal@example.com', '9123456780', 'Kolkata', '700001', 'Kolkata', 'West Bengal',
    'Personal', 'Family transit stay', NULL,
    CAST(GETDATE() + 5 AS DATE), '16:00', CAST(GETDATE() + 6 AS DATE), '09:00', 1, 1, 0, 1, 2,
    '["Room","Breakfast"]', 1, 'SELF', 1, 'APPROVED', 'ROOM_ALLOCATED'
  );

INSERT INTO Approvals (booking_id, approver_id, decision, remarks)
VALUES
  (2, 2, 'Approved', 'Meets policy criteria.');

INSERT INTO RoomAllocation (booking_id, room_number, allocation_status)
VALUES
  (2, 'A-102', 'ALLOCATED');
