-- Guest House Management System schema for Microsoft SQL Server

IF OBJECT_ID('RoomAllocation', 'U') IS NOT NULL DROP TABLE RoomAllocation;
IF OBJECT_ID('Approvals', 'U') IS NOT NULL DROP TABLE Approvals;
IF OBJECT_ID('Bookings', 'U') IS NOT NULL DROP TABLE Bookings;
IF OBJECT_ID('Users', 'U') IS NOT NULL DROP TABLE Users;
GO

CREATE TABLE Users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  ecode VARCHAR(20) NOT NULL UNIQUE,
  name NVARCHAR(120) NOT NULL,
  unit NVARCHAR(120) NULL,
  department NVARCHAR(120) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('EMPLOYEE', 'APPROVER', 'ESTATE_PRIMARY', 'ADMIN')),
  password_hash VARCHAR(255) NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE Bookings (
  id INT IDENTITY(1,1) PRIMARY KEY,
  guest_name NVARCHAR(120) NOT NULL,
  guest_email NVARCHAR(120) NOT NULL,
  guest_phone VARCHAR(30) NOT NULL,
  guest_address NVARCHAR(255) NOT NULL,
  guest_pincode VARCHAR(10) NOT NULL,
  guest_city NVARCHAR(120) NOT NULL,
  guest_state NVARCHAR(120) NOT NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('Official', 'Personal')),
  justification NVARCHAR(MAX) NOT NULL,
  special_requests NVARCHAR(MAX) NULL,
  arrival_date DATE NOT NULL,
  arrival_time VARCHAR(8) NOT NULL,
  departure_date DATE NOT NULL,
  departure_time VARCHAR(8) NOT NULL,
  stay_days INT NOT NULL CHECK (stay_days > 0),
  male_count INT NOT NULL DEFAULT 0 CHECK (male_count >= 0),
  female_count INT NOT NULL DEFAULT 0 CHECK (female_count >= 0),
  children_count INT NOT NULL DEFAULT 0 CHECK (children_count >= 0),
  total_guests INT NOT NULL DEFAULT 0 CHECK (total_guests >= 0),
  services_required NVARCHAR(MAX) NOT NULL,
  rooms_required INT NOT NULL DEFAULT 0 CHECK (rooms_required >= 0),
  booking_cost_center VARCHAR(50) NOT NULL,
  created_by INT NOT NULL,
  approval_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED')),
  estate_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ESTATE_REVIEW' CHECK (estate_status IN ('PENDING_ESTATE_REVIEW', 'ROOM_ALLOCATED', 'SERVICES_APPROVED', 'ESTATE_REJECTED')),
  cancellation_remarks NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Bookings_Users FOREIGN KEY (created_by) REFERENCES Users(id)
);
GO

CREATE TABLE Approvals (
  id INT IDENTITY(1,1) PRIMARY KEY,
  booking_id INT NOT NULL,
  approver_id INT NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('Approved', 'Rejected')),
  remarks NVARCHAR(MAX) NULL,
  [date] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Approvals_Bookings FOREIGN KEY (booking_id) REFERENCES Bookings(id),
  CONSTRAINT FK_Approvals_Users FOREIGN KEY (approver_id) REFERENCES Users(id)
);
GO

CREATE TABLE RoomAllocation (
  id INT IDENTITY(1,1) PRIMARY KEY,
  booking_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  allocation_status VARCHAR(20) NOT NULL CHECK (allocation_status IN ('ALLOCATED', 'RELEASED')),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_RoomAllocation_Bookings FOREIGN KEY (booking_id) REFERENCES Bookings(id)
);
GO

CREATE INDEX IX_Bookings_ArrivalDate ON Bookings(arrival_date);
CREATE INDEX IX_Bookings_Status ON Bookings(approval_status, estate_status);
CREATE INDEX IX_Approvals_BookingId ON Approvals(booking_id);
CREATE INDEX IX_RoomAllocation_BookingId ON RoomAllocation(booking_id);
GO
