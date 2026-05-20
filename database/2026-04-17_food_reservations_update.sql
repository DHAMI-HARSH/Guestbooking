IF COL_LENGTH('Bookings', 'food_reservations') IS NULL
BEGIN
  ALTER TABLE Bookings
  ADD food_reservations NVARCHAR(MAX) NULL;
END;
GO
