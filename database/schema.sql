-- Guest House Management System schema for PostgreSQL

DROP TABLE IF EXISTS roomallocation CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ecode VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    unit VARCHAR(120),
    department VARCHAR(120) NOT NULL,

    role VARCHAR(30) NOT NULL CHECK (
        role IN ('EMPLOYEE', 'APPROVER', 'ESTATE_PRIMARY', 'ADMIN')
    ),

    password_hash VARCHAR(255) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by_admin_id INT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_createdbyadmin
        FOREIGN KEY (created_by_admin_id)
        REFERENCES users(id)
);

CREATE TABLE bookings (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    guest_name VARCHAR(120) NOT NULL,
    guest_email VARCHAR(120) NOT NULL,
    guest_phone VARCHAR(30) NOT NULL,
    guest_address VARCHAR(255) NOT NULL,
    guest_pincode VARCHAR(10) NOT NULL,
    guest_city VARCHAR(120) NOT NULL,
    guest_state VARCHAR(120) NOT NULL,

    room_configuration VARCHAR(50) NULL CHECK (
        room_configuration IN ('Double Bed', 'Triple Bed', 'Twin Sharing')
        OR room_configuration IS NULL
    ),

    meal_plan VARCHAR(20) NOT NULL DEFAULT 'General' CHECK (
        meal_plan IN ('General', 'Special')
    ),

    extra_bed BOOLEAN NOT NULL DEFAULT FALSE,

    guests TEXT NULL,
    food_reservations TEXT NULL,

    estimated_cost NUMERIC(10, 2) NULL,

    purpose VARCHAR(20) NOT NULL CHECK (
        purpose IN ('Official', 'Personal')
    ),

    justification TEXT NOT NULL,
    special_requests TEXT NULL,
    room_selection TEXT NULL,

    arrival_date DATE NOT NULL,
    arrival_time VARCHAR(8) NOT NULL,

    departure_date DATE NOT NULL,
    departure_time VARCHAR(8) NOT NULL,

    stay_days INT NOT NULL CHECK (stay_days > 0),

    male_count INT NOT NULL DEFAULT 0 CHECK (male_count >= 0),
    female_count INT NOT NULL DEFAULT 0 CHECK (female_count >= 0),
    children_count INT NOT NULL DEFAULT 0 CHECK (children_count >= 0),
    total_guests INT NOT NULL DEFAULT 0 CHECK (total_guests >= 0),

    services_required TEXT NOT NULL,

    rooms_required INT NOT NULL DEFAULT 0 CHECK (rooms_required >= 0),

    booking_cost_center VARCHAR(50) NOT NULL,

    created_by INT NOT NULL,
    created_by_admin_id INT NULL,

    approval_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK (
            approval_status IN (
                'PENDING_APPROVAL',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    estate_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ESTATE_REVIEW'
        CHECK (
            estate_status IN (
                'PENDING_ESTATE_REVIEW',
                'ROOM_ALLOCATED',
                'SERVICES_APPROVED',
                'ESTATE_REJECTED'
            )
        ),

    cancellation_remarks TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookings_users
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    CONSTRAINT fk_bookings_createdbyadmin
        FOREIGN KEY (created_by_admin_id)
        REFERENCES users(id)
);

CREATE TABLE approvals (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    booking_id INT NOT NULL,
    approver_id INT NOT NULL,

    decision VARCHAR(20) NOT NULL CHECK (
        decision IN ('Approved', 'Rejected')
    ),

    remarks TEXT NULL,

    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_approvals_bookings
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id),

    CONSTRAINT fk_approvals_users
        FOREIGN KEY (approver_id)
        REFERENCES users(id)
);

CREATE TABLE roomallocation (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    booking_id INT NOT NULL,

    room_number VARCHAR(20) NOT NULL,

    allocation_status VARCHAR(20) NOT NULL CHECK (
        allocation_status IN ('ALLOCATED', 'RELEASED')
    ),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_roomallocation_bookings
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
);

-- Indexes

CREATE INDEX ix_bookings_arrivaldate
    ON bookings(arrival_date);

CREATE INDEX ix_bookings_status
    ON bookings(approval_status, estate_status);

CREATE INDEX ix_approvals_bookingid
    ON approvals(booking_id);

CREATE INDEX ix_roomallocation_bookingid
    ON roomallocation(booking_id);

CREATE INDEX ix_users_createdbyadminid
    ON users(created_by_admin_id);

CREATE TABLE IF NOT EXISTS login_security (
    subject_key VARCHAR(320) PRIMARY KEY,
    ip_address VARCHAR(128) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    warning_count INT NOT NULL DEFAULT 0,
    banned_until TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_login_security_banned_until
    ON login_security(banned_until);
