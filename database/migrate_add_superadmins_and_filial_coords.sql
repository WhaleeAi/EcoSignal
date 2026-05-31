BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE filials
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

UPDATE filials
SET
    latitude = CASE email
        WHEN 'office@rpn.local' THEN 55.7636::double precision
        WHEN 'north@rpn.local' THEN 55.7889::double precision
        WHEN 'office@minprirody.local' THEN 55.7636::double precision
        WHEN 'expert@minprirody.local' THEN 55.7529::double precision
        WHEN 'office@rosleshoz.local' THEN 55.7356::double precision
        WHEN 'monitor@rosleshoz.local' THEN 55.6784::double precision
        WHEN 'office@dpp.local' THEN 55.7527::double precision
        WHEN 'south@dpp.local' THEN 55.7053::double precision
        ELSE COALESCE(latitude, 55.751244::double precision)
    END,
    longitude = CASE email
        WHEN 'office@rpn.local' THEN 37.5803::double precision
        WHEN 'north@rpn.local' THEN 37.5834::double precision
        WHEN 'office@minprirody.local' THEN 37.5803::double precision
        WHEN 'expert@minprirody.local' THEN 37.5890::double precision
        WHEN 'office@rosleshoz.local' THEN 37.6265::double precision
        WHEN 'monitor@rosleshoz.local' THEN 37.6245::double precision
        WHEN 'office@dpp.local' THEN 37.5966::double precision
        WHEN 'south@dpp.local' THEN 37.6551::double precision
        ELSE COALESCE(longitude, 37.618423::double precision)
    END
WHERE latitude IS NULL
   OR longitude IS NULL
   OR email IN (
        'office@rpn.local',
        'north@rpn.local',
        'office@minprirody.local',
        'expert@minprirody.local',
        'office@rosleshoz.local',
        'monitor@rosleshoz.local',
        'office@dpp.local',
        'south@dpp.local'
   );

ALTER TABLE filials
    ALTER COLUMN latitude SET NOT NULL,
    ALTER COLUMN longitude SET NOT NULL;

CREATE TABLE IF NOT EXISTS system_admins (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(32) NOT NULL DEFAULT 'superadmin' CHECK (role IN ('superadmin', 'global_admin', 'ai_admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

INSERT INTO system_admins (
    login,
    email,
    password_hash,
    full_name,
    role,
    is_active
)
VALUES (
    'superadmin@ecosignal.local',
    'superadmin@ecosignal.local',
    crypt('SuperAdmin#2026!', gen_salt('bf', 10)),
    'Superadmin',
    'superadmin',
    TRUE
)
ON CONFLICT (login) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = TRUE;

COMMIT;
