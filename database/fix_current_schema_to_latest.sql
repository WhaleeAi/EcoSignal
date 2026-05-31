ROLLBACK;
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS org_adm_refs CASCADE;
DROP TABLE IF EXISTS admin_registration_requests CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    about TEXT,
    score INT DEFAULT 0,
    role VARCHAR(30) NOT NULL DEFAULT 'citizen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS about TEXT,
    ADD COLUMN IF NOT EXISTS score INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'citizen',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE users
SET role = 'citizen'
WHERE role IS NULL;

UPDATE users
SET email = 'user_' || id::text || '@ecosignal.local'
WHERE email IS NULL OR trim(email) = '';

UPDATE users
SET password_hash = crypt('123456', gen_salt('bf', 10))
WHERE password_hash IS NULL OR trim(password_hash) = '';

ALTER TABLE users
    ALTER COLUMN email SET NOT NULL,
    ALTER COLUMN password_hash SET NOT NULL,
    ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_email_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS name VARCHAR(100);

ALTER TABLE categories
    ALTER COLUMN name TYPE VARCHAR(255);

UPDATE categories
SET name = 'Категория ' || id::text
WHERE name IS NULL OR trim(name) = '';

ALTER TABLE categories
    ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'categories'::regclass
          AND conname = 'categories_name_key'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
    END IF;
END $$;

INSERT INTO categories (id, name)
VALUES
    (1, 'РћС‚С…РѕРґС‹ Рё СЃРІР°Р»РєРё'),
    (2, 'Р—Р°РіСЂСЏР·РЅРµРЅРёРµ РІРѕРґРѕС‘РјРѕРІ'),
    (3, 'РџСЂРѕР±Р»РµРјС‹ РІ Р»РµСЃСѓ Рё Р·РµР»С‘РЅС‹С… Р·РѕРЅР°С…'),
    (4, 'Р—Р°РіСЂСЏР·РЅРµРЅРёРµ РІРѕР·РґСѓС…Р° Рё РґС‹Рј'),
    (5, 'Р—Р°РіСЂСЏР·РЅРµРЅРёРµ РїРѕС‡РІС‹ Рё СЂР°Р·Р»РёРІС‹'),
    (6, 'Р–РёРІРѕС‚РЅС‹Рµ Рё Р±РёРѕСЂРµСЃСѓСЂСЃС‹'),
    (7, 'РќР°СЂСѓС€РµРЅРёСЏ РЅР° РћРћРџРў'),
    (8, 'РџСЂРѕС‡РёРµ СЌРєРѕР»РѕРіРёС‡РµСЃРєРёРµ РЅР°СЂСѓС€РµРЅРёСЏ')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    UNIQUE (category_id, name)
);

ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS category_id INT,
    ADD COLUMN IF NOT EXISTS name VARCHAR(150);

ALTER TABLE subcategories
    ALTER COLUMN name TYPE VARCHAR(255);

UPDATE subcategories
SET category_id = 1
WHERE category_id IS NULL;

UPDATE subcategories
SET name = 'Подкатегория ' || id::text
WHERE name IS NULL OR trim(name) = '';

ALTER TABLE subcategories
    ALTER COLUMN category_id SET NOT NULL,
    ALTER COLUMN name SET NOT NULL;

ALTER TABLE subcategories
    DROP CONSTRAINT IF EXISTS subcategories_category_id_fkey,
    ADD CONSTRAINT subcategories_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'subcategories'::regclass
          AND conname = 'subcategories_category_id_name_key'
    ) THEN
        ALTER TABLE subcategories ADD CONSTRAINT subcategories_category_id_name_key UNIQUE (category_id, name);
    END IF;
END $$;

INSERT INTO subcategories (id, category_id, name)
VALUES
    (1, 1, 'РќРµСЃР°РЅРєС†РёРѕРЅРёСЂРѕРІР°РЅРЅР°СЏ СЃРІР°Р»РєР°'),
    (2, 1, 'РњСѓСЃРѕСЂ РІ Р»РµСЃСѓ'),
    (3, 1, 'РњСѓСЃРѕСЂ Сѓ РІРѕРґРѕС‘РјР°'),
    (4, 1, 'РЎР¶РёРіР°РЅРёРµ РѕС‚С…РѕРґРѕРІ'),
    (5, 1, 'РћРїР°СЃРЅС‹Рµ РѕС‚С…РѕРґС‹'),
    (6, 2, 'РЎР±СЂРѕСЃ РІ РІРѕРґРѕС‘Рј'),
    (7, 2, 'РњСѓСЃРѕСЂ РІ СЂРµРєРµ РёР»Рё РѕР·РµСЂРµ'),
    (8, 2, 'РњР°СЃР»СЏРЅРѕРµ РїСЏС‚РЅРѕ РЅР° РІРѕРґРµ'),
    (9, 2, 'Р—Р°СЃРѕСЂРµРЅРёРµ СЂСѓСЃР»Р°'),
    (10, 2, 'Р“РёР±РµР»СЊ СЂС‹Р±С‹'),
    (11, 3, 'РќРµР·Р°РєРѕРЅРЅР°СЏ РІС‹СЂСѓР±РєР°'),
    (12, 3, 'РџРѕРІСЂРµР¶РґРµРЅРёРµ РґРµСЂРµРІСЊРµРІ'),
    (13, 3, 'РњСѓСЃРѕСЂ РІ РїР°СЂРєРµ РёР»Рё Р»РµСЃСѓ'),
    (14, 3, 'РЎР»РµРґС‹ РїРѕР¶Р°СЂР°'),
    (15, 3, 'РџРѕРІСЂРµР¶РґРµРЅРёРµ СЂР°СЃС‚РёС‚РµР»СЊРЅРѕСЃС‚Рё'),
    (16, 4, 'РЎРёР»СЊРЅС‹Р№ РґС‹Рј'),
    (17, 4, 'Р’С‹Р±СЂРѕСЃС‹ РІ РІРѕР·РґСѓС…'),
    (18, 4, 'РќРµРїСЂРёСЏС‚РЅС‹Р№ Р·Р°РїР°С…'),
    (19, 4, 'РЎР¶РёРіР°РЅРёРµ С‚СЂР°РІС‹'),
    (20, 4, 'РџС‹Р»РµРІРѕРµ Р·Р°РіСЂСЏР·РЅРµРЅРёРµ'),
    (21, 5, 'Р Р°Р·Р»РёРІ РЅРµС„С‚РµРїСЂРѕРґСѓРєС‚РѕРІ'),
    (22, 5, 'РҐРёРјРёС‡РµСЃРєРѕРµ Р·Р°РіСЂСЏР·РЅРµРЅРёРµ'),
    (23, 5, 'Р—Р°С…Р»Р°РјР»РµРЅРёРµ С‚РµСЂСЂРёС‚РѕСЂРёРё'),
    (24, 5, 'Р—Р°РіСЂСЏР·РЅРµРЅРёРµ СЃС‚СЂРѕР№РѕС‚С…РѕРґР°РјРё'),
    (25, 5, 'РџРѕРІСЂРµР¶РґРµРЅРёРµ Р·РµРјРµР»СЊ'),
    (26, 6, 'Р“РёР±РµР»СЊ Р¶РёРІРѕС‚РЅС‹С…'),
    (27, 6, 'Р“РёР±РµР»СЊ СЂС‹Р±С‹'),
    (28, 6, 'Р Р°Р·СЂСѓС€РµРЅРёРµ РјРµСЃС‚ РѕР±РёС‚Р°РЅРёСЏ'),
    (29, 6, 'РќРµР·Р°РєРѕРЅРЅС‹Р№ РѕС‚Р»РѕРІ'),
    (30, 6, 'РЈРіСЂРѕР·Р° СЂРµРґРєРёРј РІРёРґР°Рј'),
    (31, 7, 'РњСѓСЃРѕСЂ РЅР° РѕС…СЂР°РЅСЏРµРјРѕР№ С‚РµСЂСЂРёС‚РѕСЂРёРё'),
    (32, 7, 'РќР°СЂСѓС€РµРЅРёРµ СЂРµР¶РёРјР° РћРћРџРў'),
    (33, 7, 'РќРµР·Р°РєРѕРЅРЅС‹Р№ РїСЂРѕРµР·Рґ'),
    (34, 7, 'РџРѕРІСЂРµР¶РґРµРЅРёРµ РїСЂРёСЂРѕРґРЅРѕРіРѕ РѕР±СЉРµРєС‚Р°'),
    (35, 7, 'РќРµР·Р°РєРѕРЅРЅС‹Рµ СЂР°Р±РѕС‚С‹ РЅР° РћРћРџРў'),
    (36, 8, 'РќРµР·Р°РєРѕРЅРЅС‹Рµ СЂР°Р±РѕС‚С‹ Сѓ РїСЂРёСЂРѕРґРЅРѕРіРѕ РѕР±СЉРµРєС‚Р°'),
    (37, 8, 'Р­РєРѕР»РѕРіРёС‡РµСЃРєРё РѕРїР°СЃРЅРѕРµ СЃС‚СЂРѕРёС‚РµР»СЊСЃС‚РІРѕ'),
    (38, 8, 'РЁСѓРјРѕРІРѕРµ РІРѕР·РґРµР№СЃС‚РІРёРµ'),
    (39, 8, 'РРЅРѕРµ РЅР°СЂСѓС€РµРЅРёРµ')
ON CONFLICT (id) DO UPDATE
SET category_id = EXCLUDED.category_id,
    name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS appeals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id),
    subcategory_id INT REFERENCES subcategories(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE appeals
    ADD COLUMN IF NOT EXISTS user_id INT,
    ADD COLUMN IF NOT EXISTS category_id INT,
    ADD COLUMN IF NOT EXISTS subcategory_id INT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE appeals
SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE user_id IS NULL;

UPDATE appeals
SET category_id = 1
WHERE category_id IS NULL;

UPDATE appeals
SET status = 'pending'
WHERE status IS NULL OR trim(status) = '';

UPDATE appeals
SET description = 'Описание отсутствует'
WHERE description IS NULL OR trim(description) = '';

UPDATE appeals
SET latitude = 55.751244
WHERE latitude IS NULL;

UPDATE appeals
SET longitude = 37.618423
WHERE longitude IS NULL;

ALTER TABLE appeals
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN latitude SET NOT NULL,
    ALTER COLUMN longitude SET NOT NULL;

ALTER TABLE appeals
    DROP CONSTRAINT IF EXISTS appeals_user_id_fkey,
    ADD CONSTRAINT appeals_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS appeals_category_id_fkey,
    ADD CONSTRAINT appeals_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES categories(id),
    DROP CONSTRAINT IF EXISTS appeals_subcategory_id_fkey,
    ADD CONSTRAINT appeals_subcategory_id_fkey
        FOREIGN KEY (subcategory_id) REFERENCES subcategories(id);

CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    data BYTEA NOT NULL DEFAULT decode('', 'hex'),
    content_type VARCHAR(50),
    filename TEXT,
    size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE images
    ADD COLUMN IF NOT EXISTS data BYTEA,
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS filename TEXT,
    ADD COLUMN IF NOT EXISTS size INT,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE images
SET data = decode('', 'hex')
WHERE data IS NULL;

ALTER TABLE images
    ALTER COLUMN data SET NOT NULL,
    DROP CONSTRAINT IF EXISTS images_appeal_id_fkey,
    ADD CONSTRAINT images_appeal_id_fkey
        FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notifications (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    org_type VARCHAR(32) NOT NULL DEFAULT 'federal',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS org_type VARCHAR(32) NOT NULL DEFAULT 'federal',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_org_type_check,
    ADD CONSTRAINT organizations_org_type_check
        CHECK (org_type IN ('federal', 'regional', 'municipal'));

CREATE TABLE IF NOT EXISTS filials (
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

ALTER TABLE filials
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS hotline_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS region VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

INSERT INTO organizations (name, org_type)
VALUES
    ('Р РѕСЃРїСЂРёСЂРѕРґРЅР°РґР·РѕСЂ', 'federal'),
    ('РњРёРЅРїСЂРёСЂРѕРґС‹ Р Р¤', 'federal'),
    ('Р РѕСЃР»РµСЃС…РѕР·', 'federal'),
    ('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ РїСЂРёСЂРѕРґРѕРїРѕР»СЊР·РѕРІР°РЅРёСЏ', 'regional')
ON CONFLICT (name) DO UPDATE
SET org_type = EXCLUDED.org_type;

WITH orgs AS (
    SELECT id, name
    FROM organizations
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
    f.latitude,
    f.longitude,
    f.hotline_phone,
    f.email,
    f.region,
    TRUE
FROM orgs o
JOIN (
    VALUES
        ('Р РѕСЃРїСЂРёСЂРѕРґРЅР°РґР·РѕСЂ', 'Р¦РµРЅС‚СЂР°Р»СЊРЅР°СЏ РїСЂРёРµРјРЅР°СЏ', 'РњРѕСЃРєРІР°, СѓР». Р‘РѕР»СЊС€Р°СЏ Р“СЂСѓР·РёРЅСЃРєР°СЏ, Рґ. 4/6', 55.7636::double precision, 37.5803::double precision, '+7 (495) 000-10-01', 'office@rpn.local', 'РњРѕСЃРєРІР°'),
        ('Р РѕСЃРїСЂРёСЂРѕРґРЅР°РґР·РѕСЂ', 'РЎРµРІРµСЂРЅС‹Р№ РѕС‚РґРµР»', 'РњРѕСЃРєРІР°, СѓР». РџСЂР°РІРґС‹, Рґ. 24, СЃС‚СЂ. 2', 55.7889::double precision, 37.5834::double precision, '+7 (495) 000-10-02', 'north@rpn.local', 'РњРѕСЃРєРІР°'),
        ('РњРёРЅРїСЂРёСЂРѕРґС‹ Р Р¤', 'Р¦РµРЅС‚СЂР°Р»СЊРЅР°СЏ РїСЂРёРµРјРЅР°СЏ', 'РњРѕСЃРєРІР°, СѓР». Р‘РѕР»СЊС€Р°СЏ Р“СЂСѓР·РёРЅСЃРєР°СЏ, Рґ. 4/6', 55.7636::double precision, 37.5803::double precision, '+7 (495) 000-20-01', 'office@minprirody.local', 'РњРѕСЃРєРІР°'),
        ('РњРёРЅРїСЂРёСЂРѕРґС‹ Р Р¤', 'Р­РєСЃРїРµСЂС‚РЅС‹Р№ РѕС‚РґРµР»', 'РњРѕСЃРєРІР°, СѓР». РќРѕРІС‹Р№ РђСЂР±Р°С‚, Рґ. 19', 55.7529::double precision, 37.5890::double precision, '+7 (495) 000-20-02', 'expert@minprirody.local', 'РњРѕСЃРєРІР°'),
        ('Р РѕСЃР»РµСЃС…РѕР·', 'Р¦РµРЅС‚СЂР°Р»СЊРЅС‹Р№ Р°РїРїР°СЂР°С‚', 'РњРѕСЃРєРІР°, СѓР». РџСЏС‚РЅРёС†РєР°СЏ, Рґ. 59/19', 55.7356::double precision, 37.6265::double precision, '+7 (495) 000-30-01', 'office@rosleshoz.local', 'РњРѕСЃРєРІР°'),
        ('Р РѕСЃР»РµСЃС…РѕР·', 'РћС‚РґРµР» РјРѕРЅРёС‚РѕСЂРёРЅРіР°', 'РњРѕСЃРєРІР°, Р’Р°СЂС€Р°РІСЃРєРѕРµ С€РѕСЃСЃРµ, Рґ. 39Рђ', 55.6784::double precision, 37.6245::double precision, '+7 (495) 000-30-02', 'monitor@rosleshoz.local', 'РњРѕСЃРєРІР°'),
        ('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ РїСЂРёСЂРѕРґРѕРїРѕР»СЊР·РѕРІР°РЅРёСЏ', 'Р¦РµРЅС‚СЂР°Р»СЊРЅР°СЏ РїСЂРёРµРјРЅР°СЏ', 'РњРѕСЃРєРІР°, СѓР». РќРѕРІС‹Р№ РђСЂР±Р°С‚, Рґ. 11, РєРѕСЂРї. 1', 55.7527::double precision, 37.5966::double precision, '+7 (495) 000-40-01', 'office@dpp.local', 'РњРѕСЃРєРІР°'),
        ('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ РїСЂРёСЂРѕРґРѕРїРѕР»СЊР·РѕРІР°РЅРёСЏ', 'Р®Р¶РЅС‹Р№ СЃРµРєС‚РѕСЂ', 'РњРѕСЃРєРІР°, СѓР». РђРІС‚РѕР·Р°РІРѕРґСЃРєР°СЏ, Рґ. 23, РєРѕСЂРї. 7', 55.7053::double precision, 37.6551::double precision, '+7 (495) 000-40-02', 'south@dpp.local', 'РњРѕСЃРєРІР°')
) AS f(org_name, name, address, latitude, longitude, hotline_phone, email, region)
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
    role VARCHAR(32) NOT NULL DEFAULT 'superadmin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

ALTER TABLE system_admins
    DROP CONSTRAINT IF EXISTS system_admins_role_check,
    ADD CONSTRAINT system_admins_role_check CHECK (role IN ('superadmin', 'global_admin', 'ai_admin'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name = 'email'
    ) THEN
        INSERT INTO system_admins (
            login,
            email,
            password_hash,
            full_name,
            role,
            is_active
        )
        SELECT
            email,
            email,
            password_hash,
            trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')),
            'superadmin',
            TRUE
        FROM users
        WHERE role = 'superadmin'
          AND email IS NOT NULL
        ON CONFLICT (login) DO UPDATE
        SET
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = 'superadmin',
            is_active = TRUE;
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

CREATE TABLE IF NOT EXISTS org_admins (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT REFERENCES filials(id) ON DELETE SET NULL,
    login VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'admin',
    about TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

ALTER TABLE org_admins
    ADD COLUMN IF NOT EXISTS about TEXT,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE org_admins
    ALTER COLUMN role SET DEFAULT 'admin',
    DROP CONSTRAINT IF EXISTS org_admins_role_check,
    ADD CONSTRAINT org_admins_role_check CHECK (role = 'admin');

DELETE FROM org_admins
WHERE role <> 'admin';

INSERT INTO org_admins (
    organization_id,
    filial_id,
    login,
    password_hash,
    role,
    about,
    is_active
)
SELECT
    o.id,
    f.id,
    'agent_org_' || o.id::text || '_filial_' || f.id::text || '@ecosignal.local',
    crypt('123456', gen_salt('bf', 10)),
    'admin',
    'Автоматически созданный менеджер филиала',
    TRUE
FROM organizations o
INNER JOIN filials f ON f.organization_id = o.id
WHERE f.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM org_admins oa
      WHERE oa.organization_id = o.id
        AND oa.filial_id = f.id
        AND oa.role = 'admin'
        AND oa.is_active = TRUE
  )
ON CONFLICT (login) DO UPDATE
SET
    organization_id = EXCLUDED.organization_id,
    filial_id = EXCLUDED.filial_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    about = EXCLUDED.about,
    is_active = TRUE;

CREATE TABLE IF NOT EXISTS appeal_assignments (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filial_id BIGINT NOT NULL REFERENCES filials(id) ON DELETE CASCADE,
    responsible_org_admin_id BIGINT REFERENCES org_admins(id) ON DELETE SET NULL,
    assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned'
);

ALTER TABLE appeal_assignments
    ADD COLUMN IF NOT EXISTS organization_id BIGINT,
    ADD COLUMN IF NOT EXISTS filial_id BIGINT,
    ADD COLUMN IF NOT EXISTS responsible_org_admin_id BIGINT,
    ADD COLUMN IF NOT EXISTS assigned_by INT,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'assigned';

UPDATE appeal_assignments aa
SET organization_id = oa.organization_id
FROM org_admins oa
WHERE aa.organization_id IS NULL
  AND aa.responsible_org_admin_id = oa.id;

UPDATE appeal_assignments aa
SET filial_id = oa.filial_id
FROM org_admins oa
WHERE aa.filial_id IS NULL
  AND aa.responsible_org_admin_id = oa.id
  AND oa.filial_id IS NOT NULL;

UPDATE appeal_assignments aa
SET organization_id = f.organization_id
FROM filials f
WHERE aa.organization_id IS NULL
  AND aa.filial_id = f.id;

UPDATE appeal_assignments
SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1)
WHERE organization_id IS NULL;

UPDATE appeal_assignments
SET filial_id = (
    SELECT id
    FROM filials
    WHERE filials.organization_id = appeal_assignments.organization_id
    ORDER BY id
    LIMIT 1
)
WHERE filial_id IS NULL;

ALTER TABLE appeal_assignments
    ALTER COLUMN organization_id SET NOT NULL,
    ALTER COLUMN filial_id SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE appeal_assignments
    DROP CONSTRAINT IF EXISTS appeal_assignments_organization_id_fkey,
    ADD CONSTRAINT appeal_assignments_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS appeal_assignments_filial_id_fkey,
    ADD CONSTRAINT appeal_assignments_filial_id_fkey
        FOREIGN KEY (filial_id) REFERENCES filials(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS appeal_assignments_responsible_org_admin_id_fkey,
    ADD CONSTRAINT appeal_assignments_responsible_org_admin_id_fkey
        FOREIGN KEY (responsible_org_admin_id) REFERENCES org_admins(id) ON DELETE SET NULL;

ALTER TABLE appeal_assignments
    DROP CONSTRAINT IF EXISTS appeal_assignments_status_check,
    ADD CONSTRAINT appeal_assignments_status_check
        CHECK (status IN ('assigned', 'resolved', 'rejected'));

CREATE TABLE IF NOT EXISTS appeal_chats (
    id SERIAL PRIMARY KEY,
    appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    sender_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    sender_org_admin_id BIGINT REFERENCES org_admins(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

ALTER TABLE appeal_chats
    ADD COLUMN IF NOT EXISTS sender_user_id INT,
    ADD COLUMN IF NOT EXISTS sender_org_admin_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE appeal_chats
    DROP CONSTRAINT IF EXISTS appeal_chats_sender_user_id_fkey,
    ADD CONSTRAINT appeal_chats_sender_user_id_fkey
        FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS appeal_chats_sender_org_admin_id_fkey,
    ADD CONSTRAINT appeal_chats_sender_org_admin_id_fkey
        FOREIGN KEY (sender_org_admin_id) REFERENCES org_admins(id) ON DELETE CASCADE;

ALTER TABLE appeal_assignments
    ALTER COLUMN assigned_by DROP NOT NULL;

ALTER TABLE appeal_assignments
    DROP CONSTRAINT IF EXISTS appeal_assignments_assigned_by_fkey,
    ADD CONSTRAINT appeal_assignments_assigned_by_fkey
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE appeals
    DROP CONSTRAINT IF EXISTS appeals_assigned_admin_id_fkey,
    DROP COLUMN IF EXISTS assigned_admin_id;

UPDATE appeal_assignments
SET assigned_by = NULL
WHERE assigned_by IN (
    SELECT id
    FROM users
    WHERE role IN ('admin', 'superadmin', 'new_role')
);

DELETE FROM users
WHERE role IN ('admin', 'superadmin', 'new_role');

UPDATE users
SET role = 'citizen'
WHERE role IS NULL
   OR trim(role) = ''
   OR role NOT IN ('citizen', 'agency');

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check,
    ADD CONSTRAINT users_role_check CHECK (role IN ('citizen', 'agency'));

ALTER TABLE appeal_chats
    DROP CONSTRAINT IF EXISTS appeal_chats_check,
    ADD CONSTRAINT appeal_chats_check CHECK (
        (sender_user_id IS NOT NULL AND sender_org_admin_id IS NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NOT NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NULL)
    );

ALTER TABLE appeals
    DROP CONSTRAINT IF EXISTS appeals_status_check,
    ADD CONSTRAINT appeals_status_check
        CHECK (status IN ('pending', 'confirmed', 'in_progress', 'resolved', 'rejected'));

ALTER TABLE appeals
    DROP CONSTRAINT IF EXISTS appeals_priority_check,
    ADD CONSTRAINT appeals_priority_check CHECK (priority BETWEEN 0 AND 5);

SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), true);
SELECT setval('subcategories_id_seq', COALESCE((SELECT MAX(id) FROM subcategories), 1), true);

COMMIT;
