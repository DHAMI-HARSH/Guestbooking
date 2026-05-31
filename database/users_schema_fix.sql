-- Users table schema validation/repair script (PostgreSQL version)

DO $$
BEGIN
    -- Create table if it does not exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
    ) THEN

        CREATE TABLE users (
            id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            ecode VARCHAR(20) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            department VARCHAR(120) NOT NULL,
            unit VARCHAR(120) NULL,
            role VARCHAR(30) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        RETURN;
    END IF;

    -- Add missing columns

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'ecode'
    ) THEN
        ALTER TABLE users
        ADD COLUMN ecode VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'name'
    ) THEN
        ALTER TABLE users
        ADD COLUMN name VARCHAR(120);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'department'
    ) THEN
        ALTER TABLE users
        ADD COLUMN department VARCHAR(120);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'unit'
    ) THEN
        ALTER TABLE users
        ADD COLUMN unit VARCHAR(120);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'role'
    ) THEN
        ALTER TABLE users
        ADD COLUMN role VARCHAR(30);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users
        ADD COLUMN password_hash VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users
        ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;

END $$;

-- Ensure column definitions

ALTER TABLE users
    ALTER COLUMN ecode TYPE VARCHAR(20),
    ALTER COLUMN ecode SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN name TYPE VARCHAR(120),
    ALTER COLUMN name SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN department TYPE VARCHAR(120),
    ALTER COLUMN department SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN unit TYPE VARCHAR(120),
    ALTER COLUMN unit DROP NOT NULL;

ALTER TABLE users
    ALTER COLUMN role TYPE VARCHAR(30),
    ALTER COLUMN role SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN password_hash TYPE VARCHAR(255),
    ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN is_active TYPE BOOLEAN
    USING (
        CASE
            WHEN is_active IN ('1', 'true', 'TRUE', 't') THEN TRUE
            ELSE FALSE
        END
    );

ALTER TABLE users
    ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at::timestamp;

ALTER TABLE users
    ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- Add primary key only if no primary key exists

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'p'
    ) THEN

        ALTER TABLE users
        ADD CONSTRAINT pk_users PRIMARY KEY (id);

    END IF;
END $$;

-- Add unique constraint on ecode if missing

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'uq_users_ecode'
    ) THEN

        ALTER TABLE users
        ADD CONSTRAINT uq_users_ecode UNIQUE (ecode);

    END IF;
END $$;

-- Ensure index exists

CREATE INDEX IF NOT EXISTS ix_users_ecode
ON users(ecode);