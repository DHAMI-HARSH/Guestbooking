-- Add food_reservations column to bookings table (PostgreSQL version)

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS food_reservations TEXT NULL;