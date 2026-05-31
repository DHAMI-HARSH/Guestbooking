-- Track which admin created each user account (PostgreSQL version)

-- Add column if it does not exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_by_admin_id INT NULL;

-- Add foreign key constraint if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_createdbyadmin'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_createdbyadmin
        FOREIGN KEY (created_by_admin_id)
        REFERENCES users(id);
    END IF;
END $$;

-- Create index if it does not exist
CREATE INDEX IF NOT EXISTS ix_users_createdbyadminid
ON users(created_by_admin_id);