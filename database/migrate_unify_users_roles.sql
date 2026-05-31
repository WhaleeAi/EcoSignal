ROLLBACK;
DO $$
BEGIN
    RAISE EXCEPTION 'migrate_unify_users_roles.sql is superseded. Use migrate_add_system_admins_normalized.sql instead.';
END $$;

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS login VARCHAR(255),
    ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS filial_id BIGINT REFERENCES filials(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS isбт_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

UPDATE users
SET login = email
WHERE login IS NULL OR trim(login) = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_login_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_login_key UNIQUE (login);
    END IF;
END $$;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check,
    ADD CONSTRAINT users_role_check CHECK (
        role IN ('citizen', 'agency', 'org_admin', 'admin', 'global_admin', 'ai_admin')
    );

CREATE TEMP TABLE IF NOT EXISTS migrated_org_admin_users (
    old_org_admin_id BIGINT PRIMARY KEY,
    new_user_id INT NOT NULL
) ON COMMIT DROP;

INSERT INTO users (
    email,
    login,
    password_hash,
    first_name,
    last_name,
    about,
    role,
    organization_id,
    filial_id,
    is_active,
    created_at,
    last_login_at
)
SELECT
    CASE
        WHEN position('@' in oa.login) > 1 THEN oa.login
        ELSE oa.login || '@ecosignal.local'
    END,
    oa.login,
    oa.password_hash,
    NULL,
    NULL,
    oa.about,
    'org_admin',
    oa.organization_id,
    oa.filial_id,
    oa.is_active,
    oa.created_at,
    oa.last_login_at
FROM org_admins oa
WHERE to_regclass('org_admins') IS NOT NULL
ON CONFLICT (login) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    role = 'org_admin',
    organization_id = EXCLUDED.organization_id,
    filial_id = EXCLUDED.filial_id,
    is_active = EXCLUDED.is_active,
    last_login_at = EXCLUDED.last_login_at;

INSERT INTO migrated_org_admin_users (old_org_admin_id, new_user_id)
SELECT oa.id, u.id
FROM org_admins oa
INNER JOIN users u ON u.login = oa.login
WHERE to_regclass('org_admins') IS NOT NULL
ON CONFLICT (old_org_admin_id) DO UPDATE
SET new_user_id = EXCLUDED.new_user_id;

DO $$
BEGIN
    IF to_regclass('superadmins') IS NOT NULL THEN
        INSERT INTO users (
            email,
            login,
            password_hash,
            first_name,
            last_name,
            role,
            is_active,
            created_at,
            last_login_at
        )
        SELECT
            CASE
                WHEN position('@' in s.login) > 1 THEN s.login
                ELSE s.login || '@ecosignal.local'
            END,
            s.login,
            s.password_hash,
            COALESCE(NULLIF(s.full_name, ''), s.login),
            NULL,
            'admin',
            s.is_active,
            s.created_at,
            s.last_login_at
        FROM superadmins s
        ON CONFLICT (login) DO UPDATE
        SET
            password_hash = EXCLUDED.password_hash,
            first_name = EXCLUDED.first_name,
            role = 'admin',
            is_active = EXCLUDED.is_active,
            last_login_at = EXCLUDED.last_login_at;
    END IF;
END $$;

INSERT INTO users (email, login, password_hash, first_name, last_name, role, is_active)
VALUES
    ('admin@ecosignal.local', 'admin@ecosignal.local', crypt('Admin#2026!', gen_salt('bf', 10)), 'Admin', NULL, 'admin', TRUE),
    ('global_admin@ecosignal.local', 'global_admin@ecosignal.local', crypt('GlobalAdmin#2026!', gen_salt('bf', 10)), 'Global Admin', NULL, 'global_admin', TRUE),
    ('ai_admin@ecosignal.local', 'ai_admin@ecosignal.local', crypt('AiAdmin#2026!', gen_salt('bf', 10)), 'AI Admin', NULL, 'ai_admin', TRUE)
ON CONFLICT (login) DO UPDATE
SET
    role = EXCLUDED.role,
    is_active = TRUE;

ALTER TABLE appeal_assignments
    DROP CONSTRAINT IF EXISTS appeal_assignments_responsible_org_admin_id_fkey;

UPDATE appeal_assignments aa
SET responsible_org_admin_id = map.new_user_id
FROM migrated_org_admin_users map
WHERE aa.responsible_org_admin_id = map.old_org_admin_id;

ALTER TABLE appeal_assignments
    ALTER COLUMN responsible_org_admin_id TYPE INT USING responsible_org_admin_id::int;

ALTER TABLE appeal_assignments
    ADD CONSTRAINT appeal_assignments_responsible_org_admin_id_fkey
    FOREIGN KEY (responsible_org_admin_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE appeal_chats
    DROP CONSTRAINT IF EXISTS appeal_chats_sender_org_admin_id_fkey;

UPDATE appeal_chats ac
SET sender_org_admin_id = map.new_user_id
FROM migrated_org_admin_users map
WHERE ac.sender_org_admin_id = map.old_org_admin_id;

ALTER TABLE appeal_chats
    ALTER COLUMN sender_org_admin_id TYPE INT USING sender_org_admin_id::int;

ALTER TABLE appeal_chats
    ADD CONSTRAINT appeal_chats_sender_org_admin_id_fkey
    FOREIGN KEY (sender_org_admin_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
