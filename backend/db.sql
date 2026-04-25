CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    about TEXT,
    score INT DEFAULT 0,
    role VARCHAR(30) NOT NULL DEFAULT 'citizen'
        CHECK (role IN ('citizen', 'agency', 'admin', 'superadmin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_registration_requests (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by INT REFERENCES users(id) ON DELETE SET NULL
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
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_admin_id INT REFERENCES users(id)
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
    hotline_phone VARCHAR(50),
    email VARCHAR(255),
    region VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE org_admins (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT REFERENCES filials(id) ON DELETE SET NULL,
    login VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('superadmin', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE org_adm_refs (
    id BIGSERIAL PRIMARY KEY,
    actor_admin_id BIGINT NOT NULL REFERENCES org_admins(id) ON DELETE RESTRICT,
    target_admin_id BIGINT NOT NULL REFERENCES org_admins(id) ON DELETE RESTRICT,
    action_type VARCHAR(32) NOT NULL CHECK (action_type IN ('appointed', 'revoked', 'role_changed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    comment TEXT
);

CREATE TABLE appeal_assignments (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT NOT NULL REFERENCES filials(id) ON DELETE CASCADE,
    responsible_org_admin_id BIGINT REFERENCES org_admins(id) ON DELETE SET NULL,
    assigned_by INT NOT NULL REFERENCES users(id),
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
        (sender_user_id IS NULL AND sender_org_admin_id IS NOT NULL)
    )
);

-- ----------------------------------------
-- Тестовые данные для карты (можно запускать повторно)
-- ----------------------------------------

INSERT INTO users (email, password_hash, first_name, last_name, score, role)
VALUES
    ('seed.citizen@ecosignal.local', '$2y$10$abcdefghijklmnopqrstuv1234567890ABCDEFGHijk', 'Тест', 'Пользователь', 120, 'citizen')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, first_name, last_name, score, role)
VALUES
    ('seed.admin@ecosignal.local', '$2y$10$ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210abcdEFGH', 'Тест', 'Админ', 0, 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name)
VALUES
    ('Экология'),
    ('Дороги'),
    ('Благоустройство')
ON CONFLICT (name) DO NOTHING;

INSERT INTO subcategories (category_id, name)
SELECT c.id, v.sub_name
FROM categories c
JOIN (
    VALUES
        ('Экология', 'Мусор'),
        ('Экология', 'Загрязнение воды'),
        ('Дороги', 'Яма на дороге'),
        ('Дороги', 'Стертая разметка'),
        ('Благоустройство', 'Неисправное освещение'),
        ('Благоустройство', 'Поврежденная скамейка')
) AS v(category_name, sub_name)
    ON v.category_name = c.name
ON CONFLICT (category_id, name) DO NOTHING;

WITH reporter AS (
    SELECT id
    FROM users
    WHERE role IN ('citizen', 'agency')
    ORDER BY id
    LIMIT 1
),
admin_user AS (
    SELECT id
    FROM users
    WHERE role = 'admin'
    ORDER BY id
    LIMIT 1
),
seed_data AS (
    SELECT *
    FROM (
        VALUES
            ('Переполненные контейнеры во дворе, мусор разлетается по территории', 'Экология', 'Мусор', 'pending', 2, 55.7608::double precision, 37.6180::double precision, interval '2 hours'),
            ('На проезжей части глубокая яма, машины вынуждены резко перестраиваться', 'Дороги', 'Яма на дороге', 'confirmed', 4, 55.7435::double precision, 37.6048::double precision, interval '5 hours'),
            ('Фонарь во дворе не работает уже несколько дней', 'Благоустройство', 'Неисправное освещение', 'in_progress', 3, 55.7519::double precision, 37.5864::double precision, interval '1 day'),
            ('После дождя в ручье заметна мутная вода и неприятный запах', 'Экология', 'Загрязнение воды', 'pending', 5, 55.7712::double precision, 37.6421::double precision, interval '2 days'),
            ('Разметка на перекрестке почти стерлась, водителям не видно полосы', 'Дороги', 'Стертая разметка', 'resolved', 1, 55.7351::double precision, 37.6244::double precision, interval '3 days')
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
    created_at,
    assigned_admin_id
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
    NOW() - sd.created_shift,
    admin_user.id
FROM seed_data sd
JOIN categories c ON c.name = sd.category_name
LEFT JOIN subcategories s ON s.category_id = c.id AND s.name = sd.subcategory_name
CROSS JOIN reporter
LEFT JOIN admin_user ON TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM appeals a
    WHERE a.description = sd.description
      AND a.latitude = sd.latitude
      AND a.longitude = sd.longitude
);

BEGIN;

-- Для crypt()/gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Организации
INSERT INTO organizations (name, org_type)
VALUES
    ('Росприроднадзор', 'federal'),
    ('Минприроды РФ', 'federal'),
    ('Рослесхоз', 'federal'),
    ('Департамент природопользования', 'regional')
ON CONFLICT (name) DO UPDATE
SET org_type = EXCLUDED.org_type;

-- 2) Филиалы (пока только Москва; адреса реальные)
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
    hotline_phone,
    email,
    region,
    is_active
)
SELECT
    o.id,
    f.name,
    f.address,
    f.hotline_phone,
    f.email,
    'Москва',
    TRUE
FROM orgs o
JOIN (
    VALUES
        ('Росприроднадзор', 'Центральная приемная', 'Москва, ул. Большая Грузинская, д. 4/6', '+7 (495) 000-10-01', 'office@rpn.local'),
        ('Росприроднадзор', 'Северный отдел',      'Москва, ул. Правды, д. 24, стр. 2',        '+7 (495) 000-10-02', 'north@rpn.local'),

        ('Минприроды РФ',    'Центральная приемная', 'Москва, ул. Большая Грузинская, д. 4/6', '+7 (495) 000-20-01', 'office@minprirody.local'),
        ('Минприроды РФ',    'Экспертный отдел',     'Москва, ул. Новый Арбат, д. 19',          '+7 (495) 000-20-02', 'expert@minprirody.local'),

        ('Рослесхоз',        'Центральный аппарат',  'Москва, ул. Пятницкая, д. 59/19',         '+7 (495) 000-30-01', 'office@rosleshoz.local'),
        ('Рослесхоз',        'Отдел мониторинга',    'Москва, Варшавское шоссе, д. 39А',        '+7 (495) 000-30-02', 'monitor@rosleshoz.local'),

        ('Департамент природопользования', 'Центральная приемная', 'Москва, ул. Новый Арбат, д. 11, корп. 1', '+7 (495) 000-40-01', 'office@dpp.local'),
        ('Департамент природопользования', 'Южный сектор',         'Москва, ул. Автозаводская, д. 23, корп. 7', '+7 (495) 000-40-02', 'south@dpp.local')
) AS f(org_name, name, address, hotline_phone, email)
    ON f.org_name = o.name
ON CONFLICT (organization_id, name) DO UPDATE
SET
    address = EXCLUDED.address,
    hotline_phone = EXCLUDED.hotline_phone,
    email = EXCLUDED.email,
    region = EXCLUDED.region,
    is_active = EXCLUDED.is_active;

-- 3) Суперадмины (по одному на организацию)
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
    NULL,
    s.login,
    crypt(s.password_plain, gen_salt('bf', 10)),
    'superadmin',
    TRUE
FROM orgs o
JOIN (
    VALUES
        ('Росприроднадзор',              'superadmin_rpn',        'Rpn#2026!'),
        ('Минприроды РФ',                'superadmin_minprirody', 'MinPriroda#2026!'),
        ('Рослесхоз',                    'superadmin_rosleshoz',  'RosLes#2026!'),
        ('Департамент природопользования','superadmin_dpp',       'Dpp#2026!')
) AS s(org_name, login, password_plain)
    ON s.org_name = o.name
ON CONFLICT (login) DO UPDATE
SET
    organization_id = EXCLUDED.organization_id,
    filial_id = EXCLUDED.filial_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = TRUE;

COMMIT;
