CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    about TEXT,
    score INT DEFAULT 0,
    role VARCHAR(30) NOT NULL DEFAULT 'citizen'
        CHECK (role IN ('citizen', 'agency')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    UNIQUE (category_id, name)
);

CREATE TABLE appeals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES categories(id),
    subcategory_id INT REFERENCES subcategories(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'in_progress', 'resolved', 'rejected')),
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    priority INT DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    data BYTEA NOT NULL,
    content_type VARCHAR(50),
    filename TEXT,
    size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    org_type VARCHAR(32) NOT NULL CHECK (org_type IN ('federal', 'regional', 'municipal')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE filials (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    hotline_phone VARCHAR(50),
    email VARCHAR(255),
    region VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE system_admins (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(32) NOT NULL CHECK (role IN ('superadmin', 'global_admin', 'ai_admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE org_admins (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT REFERENCES filials(id) ON DELETE SET NULL,
    login VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
    about TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE appeal_assignments (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT NOT NULL REFERENCES filials(id) ON DELETE CASCADE,
    responsible_org_admin_id BIGINT REFERENCES org_admins(id) ON DELETE SET NULL,
    assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned'
        CHECK (status IN ('assigned', 'resolved', 'rejected'))
);

CREATE TABLE appeal_chats (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    sender_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    sender_org_admin_id BIGINT REFERENCES org_admins(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    CHECK (
        (sender_user_id IS NOT NULL AND sender_org_admin_id IS NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NOT NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NULL)
    )
);

INSERT INTO users (email, password_hash, first_name, last_name, score, role)
VALUES
    ('seed.citizen@ecosignal.local', '$2y$10$abcdefghijklmnopqrstuv1234567890ABCDEFGHijk', 'Тест', 'Пользователь', 120, 'citizen')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name)
VALUES
    ('Экология'),
    ('Лесные ресурсы'),
    ('Отходы')
ON CONFLICT (name) DO NOTHING;

INSERT INTO subcategories (category_id, name)
SELECT c.id, v.subcategory_name
FROM categories c
JOIN (
    VALUES
        ('Экология', 'Загрязнение воды'),
        ('Экология', 'Загрязнение воздуха'),
        ('Экология', 'Загрязнение почвы'),
        ('Лесные ресурсы', 'Незаконная вырубка'),
        ('Лесные ресурсы', 'Пожарная опасность'),
        ('Отходы', 'Свалка мусора'),
        ('Отходы', 'Опасные отходы')
) AS v(category_name, subcategory_name)
    ON v.category_name = c.name
ON CONFLICT (category_id, name) DO NOTHING;

INSERT INTO organizations (name, org_type)
VALUES
    ('Росприроднадзор', 'federal'),
    ('Минприроды РФ', 'federal'),
    ('Рослесхоз', 'federal'),
    ('Департамент природопользования', 'regional')
ON CONFLICT (name) DO UPDATE
SET org_type = EXCLUDED.org_type;

WITH orgs AS (
    SELECT id, name
    FROM organizations
    WHERE name IN (
        'Росприроднадзор',
        'Минприроды РФ',
        'Рослесхоз',
        'Департамент природопользования'
    )
)
INSERT INTO filials (
    organization_id,
    name,
    address,
    latitude,
    longitude,
    hotline_phone,
    email,
    region,
    is_active
)
SELECT
    o.id,
    f.name,
    f.address,
    CASE f.email
        WHEN 'office@rpn.local' THEN 55.7636::double precision
        WHEN 'north@rpn.local' THEN 55.7889::double precision
        WHEN 'office@minprirody.local' THEN 55.7636::double precision
        WHEN 'expert@minprirody.local' THEN 55.7529::double precision
        WHEN 'office@rosleshoz.local' THEN 55.7356::double precision
        WHEN 'monitor@rosleshoz.local' THEN 55.6784::double precision
        WHEN 'office@dpp.local' THEN 55.7527::double precision
        WHEN 'south@dpp.local' THEN 55.7053::double precision
        ELSE 55.751244::double precision
    END,
    CASE f.email
        WHEN 'office@rpn.local' THEN 37.5803::double precision
        WHEN 'north@rpn.local' THEN 37.5834::double precision
        WHEN 'office@minprirody.local' THEN 37.5803::double precision
        WHEN 'expert@minprirody.local' THEN 37.5890::double precision
        WHEN 'office@rosleshoz.local' THEN 37.6265::double precision
        WHEN 'monitor@rosleshoz.local' THEN 37.6245::double precision
        WHEN 'office@dpp.local' THEN 37.5966::double precision
        WHEN 'south@dpp.local' THEN 37.6551::double precision
        ELSE 37.618423::double precision
    END,
    f.hotline_phone,
    f.email,
    'Москва',
    TRUE
FROM orgs o
JOIN (
    VALUES
        ('Росприроднадзор', 'Центральная приемная', 'Москва, ул. Большая Грузинская, д. 4/6', '+7 (495) 000-10-01', 'office@rpn.local'),
        ('Росприроднадзор', 'Северный отдел', 'Москва, ул. Правды, д. 24, стр. 2', '+7 (495) 000-10-02', 'north@rpn.local'),
        ('Минприроды РФ', 'Центральная приемная', 'Москва, ул. Большая Грузинская, д. 4/6', '+7 (495) 000-20-01', 'office@minprirody.local'),
        ('Минприроды РФ', 'Экспертный отдел', 'Москва, ул. Новый Арбат, д. 19', '+7 (495) 000-20-02', 'expert@minprirody.local'),
        ('Рослесхоз', 'Центральный аппарат', 'Москва, ул. Пятницкая, д. 59/19', '+7 (495) 000-30-01', 'office@rosleshoz.local'),
        ('Рослесхоз', 'Отдел мониторинга', 'Москва, Варшавское шоссе, д. 39А', '+7 (495) 000-30-02', 'monitor@rosleshoz.local'),
        ('Департамент природопользования', 'Центральная приемная', 'Москва, ул. Новый Арбат, д. 11, корп. 1', '+7 (495) 000-40-01', 'office@dpp.local'),
        ('Департамент природопользования', 'Южный сектор', 'Москва, ул. Автозаводская, д. 23, корп. 7', '+7 (495) 000-40-02', 'south@dpp.local')
) AS f(org_name, name, address, hotline_phone, email)
    ON f.org_name = o.name
ON CONFLICT (organization_id, name) DO UPDATE
SET
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    hotline_phone = EXCLUDED.hotline_phone,
    email = EXCLUDED.email,
    region = EXCLUDED.region,
    is_active = EXCLUDED.is_active;

INSERT INTO system_admins (
    login,
    email,
    password_hash,
    full_name,
    role,
    is_active
)
VALUES
    ('superadmin@ecosignal.local', 'superadmin@ecosignal.local', crypt('SuperAdmin#2026!', gen_salt('bf', 10)), 'Superadmin', 'superadmin', TRUE),
    ('global_admin@ecosignal.local', 'global_admin@ecosignal.local', crypt('GlobalAdmin#2026!', gen_salt('bf', 10)), 'Global Admin', 'global_admin', TRUE),
    ('ai_admin@ecosignal.local', 'ai_admin@ecosignal.local', crypt('AiAdmin#2026!', gen_salt('bf', 10)), 'AI Admin', 'ai_admin', TRUE)
ON CONFLICT (login) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = TRUE;

INSERT INTO org_admins (
    organization_id,
    filial_id,
    login,
    password_hash,
    role,
    is_active
)
SELECT
    o.id,
    f.id,
    'agent_org_' || o.id::text || '_filial_' || f.id::text,
    crypt('Agent#2026!', gen_salt('bf', 10)),
    'admin',
    TRUE
FROM organizations o
INNER JOIN filials f ON f.organization_id = o.id
ON CONFLICT (login) DO UPDATE
SET
    organization_id = EXCLUDED.organization_id,
    filial_id = EXCLUDED.filial_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = TRUE;

WITH reporter AS (
    SELECT id
    FROM users
    WHERE role IN ('citizen', 'agency')
    ORDER BY id
    LIMIT 1
),
seed_data AS (
    SELECT *
    FROM (
        VALUES
            ('Переполненные контейнеры во дворе, мусор разлетается по территории', 'Отходы', 'Свалка мусора', 'confirmed', 2, 55.7608::double precision, 37.6180::double precision, interval '2 hours'),
            ('После дождя в ручье заметна мутная вода и неприятный запах', 'Экология', 'Загрязнение воды', 'confirmed', 5, 55.7712::double precision, 37.6421::double precision, interval '2 days'),
            ('На окраине лесопарка обнаружены следы незаконной вырубки', 'Лесные ресурсы', 'Незаконная вырубка', 'in_progress', 4, 55.7519::double precision, 37.5864::double precision, interval '1 day')
    ) AS t(description, category_name, subcategory_name, status, priority, latitude, longitude, created_shift)
)
INSERT INTO appeals (
    user_id,
    category_id,
    subcategory_id,
    status,
    description,
    latitude,
    longitude,
    priority,
    created_at
)
SELECT
    reporter.id,
    c.id,
    s.id,
    sd.status,
    sd.description,
    sd.latitude,
    sd.longitude,
    sd.priority,
    NOW() - sd.created_shift
FROM seed_data sd
JOIN categories c ON c.name = sd.category_name
LEFT JOIN subcategories s ON s.category_id = c.id AND s.name = sd.subcategory_name
CROSS JOIN reporter
WHERE NOT EXISTS (
    SELECT 1
    FROM appeals a
    WHERE a.description = sd.description
      AND a.latitude = sd.latitude
      AND a.longitude = sd.longitude
);

WITH latest_appeals AS (
    SELECT
        a.id AS appeal_id,
        a.status,
        a.latitude,
        a.longitude,
        s.name AS subcategory_name,
        CASE
            WHEN s.name IN ('Незаконная вырубка', 'Пожарная опасность') THEN 'Рослесхоз'
            WHEN s.name IN ('Свалка мусора', 'Опасные отходы') THEN 'Департамент природопользования'
            ELSE 'Росприроднадзор'
        END AS organization_name
    FROM appeals a
    INNER JOIN subcategories s ON s.id = a.subcategory_id
    WHERE a.status <> 'rejected'
),
assignment_targets AS (
    SELECT DISTINCT ON (la.appeal_id)
        la.appeal_id,
        o.id AS organization_id,
        f.id AS filial_id,
        oa.id AS responsible_org_admin_id,
        la.status
    FROM latest_appeals la
    INNER JOIN organizations o ON o.name = la.organization_name
    INNER JOIN filials f ON f.organization_id = o.id AND f.is_active = TRUE
    INNER JOIN org_admins oa ON oa.filial_id = f.id AND oa.role = 'admin' AND oa.is_active = TRUE
    ORDER BY
        la.appeal_id,
        (
            6371 * acos(
                LEAST(
                    1,
                    GREATEST(
                        -1,
                        cos(radians(la.latitude)) * cos(radians(f.latitude)) *
                        cos(radians(f.longitude) - radians(la.longitude)) +
                        sin(radians(la.latitude)) * sin(radians(f.latitude))
                    )
                )
            )
        ) ASC,
        f.id ASC,
        oa.id ASC
)
INSERT INTO appeal_assignments (
    appeal_id,
    organization_id,
    filial_id,
    responsible_org_admin_id,
    assigned_by,
    status
)
SELECT
    at.appeal_id,
    at.organization_id,
    at.filial_id,
    at.responsible_org_admin_id,
    NULL,
    CASE
        WHEN at.status = 'resolved' THEN 'resolved'
        WHEN at.status = 'rejected' THEN 'rejected'
        ELSE 'assigned'
    END
FROM assignment_targets at
WHERE NOT EXISTS (
    SELECT 1
    FROM appeal_assignments aa
    WHERE aa.appeal_id = at.appeal_id
);

CREATE TABLE system_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_source VARCHAR(32) NOT NULL CHECK (actor_source IN ('users', 'org_admins', 'system_admins', 'system')),
    actor_id BIGINT,
    actor_role VARCHAR(32),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_settings (
    key VARCHAR(120) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by_system_admin_id BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO ai_settings (key, value, description)
VALUES
    ('confidence_threshold', '0.7000'::jsonb, 'Minimum confidence for automatic AI decisions'),
    ('auto_assign_enabled', 'true'::jsonb, 'Whether AI can automatically assign confirmed appeals'),
    ('pending_alert_hours', '24'::jsonb, 'Hours before pending appeal is considered stuck')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE ai_moderation_runs (
    id BIGSERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    triggered_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_system_admin_id BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('queued', 'processing', 'confirmed', 'rejected', 'failed', 'overridden')),
    model VARCHAR(120),
    confidence NUMERIC(5, 4),
    decision_reason TEXT,
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP
);
