BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check,
    ADD CONSTRAINT users_role_check CHECK (role IN ('citizen', 'agency'));

ALTER TABLE org_admins
    ALTER COLUMN role SET DEFAULT 'admin',
    DROP CONSTRAINT IF EXISTS org_admins_role_check,
    ADD CONSTRAINT org_admins_role_check CHECK (role = 'admin');

CREATE TABLE IF NOT EXISTS system_admins (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(32) NOT NULL
        CHECK (role IN ('superadmin', 'global_admin', 'ai_admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

COMMENT ON TABLE system_admins IS
    'System-level accounts: superadmin manages org admins, global_admin sees all data, ai_admin monitors AI.';
COMMENT ON TABLE org_admins IS
    'Separate oversight-organization accounts bound to organization and filial.';
COMMENT ON TABLE users IS
    'Public application users only. Organization-specific and system-admin attributes are stored separately.';

DO $$
BEGIN
    IF to_regclass('superadmins') IS NOT NULL THEN
        INSERT INTO system_admins (
            login,
            email,
            password_hash,
            full_name,
            role,
            is_active,
            created_at,
            last_login_at
        )
        SELECT
            s.login,
            CASE
                WHEN position('@' in s.login) > 1 THEN s.login
                ELSE NULL
            END,
            s.password_hash,
            s.full_name,
            CASE
                WHEN s.role IN ('superadmin', 'global_admin', 'ai_admin') THEN s.role
                ELSE 'superadmin'
            END,
            s.is_active,
            s.created_at,
            s.last_login_at
        FROM superadmins s
        ON CONFLICT (login) DO UPDATE
        SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            is_active = EXCLUDED.is_active,
            last_login_at = EXCLUDED.last_login_at;
    END IF;
END $$;

INSERT INTO system_admins (
    login,
    email,
    password_hash,
    full_name,
    role,
    is_active
)
VALUES
    (
        'superadmin@ecosignal.local',
        'superadmin@ecosignal.local',
        crypt('SuperAdmin#2026!', gen_salt('bf', 10)),
        'Superadmin',
        'superadmin',
        TRUE
    ),
    (
        'global_admin@ecosignal.local',
        'global_admin@ecosignal.local',
        crypt('GlobalAdmin#2026!', gen_salt('bf', 10)),
        'Global Admin',
        'global_admin',
        TRUE
    ),
    (
        'ai_admin@ecosignal.local',
        'ai_admin@ecosignal.local',
        crypt('AiAdmin#2026!', gen_salt('bf', 10)),
        'AI Admin',
        'ai_admin',
        TRUE
    )
ON CONFLICT (login) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = TRUE;

CREATE TABLE IF NOT EXISTS ai_moderation_runs (
    id BIGSERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    triggered_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_system_admin_id BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL
        CHECK (status IN ('queued', 'processing', 'confirmed', 'rejected', 'failed', 'overridden')),
    model VARCHAR(120),
    confidence NUMERIC(5, 4),
    decision_reason TEXT,
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_admins_role_active
    ON system_admins (role, is_active);

CREATE INDEX IF NOT EXISTS idx_ai_moderation_runs_appeal
    ON ai_moderation_runs (appeal_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_moderation_runs_status
    ON ai_moderation_runs (status, started_at DESC);

COMMIT;
