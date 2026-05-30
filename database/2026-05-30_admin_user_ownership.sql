-- Track which admin created each user account

IF COL_LENGTH('Users', 'created_by_admin_id') IS NULL
BEGIN
  ALTER TABLE Users
  ADD created_by_admin_id INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Users_CreatedByAdmin'
)
BEGIN
  ALTER TABLE Users
  ADD CONSTRAINT FK_Users_CreatedByAdmin
  FOREIGN KEY (created_by_admin_id) REFERENCES Users(id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Users_CreatedByAdminId'
    AND object_id = OBJECT_ID('Users')
)
BEGIN
  CREATE INDEX IX_Users_CreatedByAdminId ON Users(created_by_admin_id);
END
GO
