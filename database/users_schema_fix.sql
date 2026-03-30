-- Users table schema validation/repair script (SQL Server)
-- Target schema:
-- id INT PRIMARY KEY
-- ecode VARCHAR(20) UNIQUE NOT NULL
-- name NVARCHAR(120)
-- department NVARCHAR(120)
-- unit NVARCHAR(120)
-- role VARCHAR(30)
-- password_hash VARCHAR(255)
-- is_active BIT
-- created_at DATETIME DEFAULT GETDATE()

SET NOCOUNT ON;

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ecode VARCHAR(20) NOT NULL UNIQUE,
    name NVARCHAR(120) NOT NULL,
    department NVARCHAR(120) NOT NULL,
    unit NVARCHAR(120) NULL,
    role VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT GETDATE()
  );
  RETURN;
END;

IF COL_LENGTH('dbo.Users', 'ecode') IS NULL
  ALTER TABLE dbo.Users ADD ecode VARCHAR(20) NULL;

IF COL_LENGTH('dbo.Users', 'name') IS NULL
  ALTER TABLE dbo.Users ADD name NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.Users', 'department') IS NULL
  ALTER TABLE dbo.Users ADD department NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.Users', 'unit') IS NULL
  ALTER TABLE dbo.Users ADD unit NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.Users', 'role') IS NULL
  ALTER TABLE dbo.Users ADD role VARCHAR(30) NULL;

IF COL_LENGTH('dbo.Users', 'password_hash') IS NULL
  ALTER TABLE dbo.Users ADD password_hash VARCHAR(255) NULL;

IF COL_LENGTH('dbo.Users', 'is_active') IS NULL
  ALTER TABLE dbo.Users ADD is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT 1;

IF COL_LENGTH('dbo.Users', 'created_at') IS NULL
  ALTER TABLE dbo.Users ADD created_at DATETIME NOT NULL CONSTRAINT DF_Users_created_at DEFAULT GETDATE();

ALTER TABLE dbo.Users ALTER COLUMN ecode VARCHAR(20) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN name NVARCHAR(120) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN department NVARCHAR(120) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN unit NVARCHAR(120) NULL;
ALTER TABLE dbo.Users ALTER COLUMN role VARCHAR(30) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN password_hash VARCHAR(255) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN is_active BIT NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN created_at DATETIME NOT NULL;

IF NOT EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Users')
    AND [type] = 'PK'
)
BEGIN
  ALTER TABLE dbo.Users ADD CONSTRAINT PK_Users PRIMARY KEY (id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.Users')
    AND is_unique = 1
    AND name = 'UQ_Users_ecode'
)
BEGIN
  ALTER TABLE dbo.Users ADD CONSTRAINT UQ_Users_ecode UNIQUE (ecode);
END;

DECLARE @createdAtDefault sysname;
SELECT @createdAtDefault = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Users')
  AND c.name = 'created_at';

IF @createdAtDefault IS NOT NULL
  EXEC('ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(@createdAtDefault));

ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_created_at DEFAULT GETDATE() FOR created_at;
