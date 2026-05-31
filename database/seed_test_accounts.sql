CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, password_hash, first_name, last_name, score, role)
VALUES
    ('ivan.petrov@ecosignal.local', crypt('123456', gen_salt('bf', 10)), 'Иван', 'Петров', 25, 'citizen'),
    ('anna.smirnova@ecosignal.local', crypt('123456', gen_salt('bf', 10)), 'Анна', 'Смирнова', 40, 'citizen'),
    ('sergey.ivanov@ecosignal.local', crypt('123456', gen_salt('bf', 10)), 'Сергей', 'Иванов', 15, 'citizen'),
    ('agency.moscow@ecosignal.local', crypt('123456', gen_salt('bf', 10)), 'Городской', 'Оператор', 0, 'agency'),
    ('agency.region@ecosignal.local', crypt('123456', gen_salt('bf', 10)), 'Региональный', 'Оператор', 0, 'agency')
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    score = EXCLUDED.score,
    role = EXCLUDED.role;

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
INSERT INTO filials (organization_id, name, address, hotline_phone, email, region, is_active)
SELECT
    o.id,
    f.name,
    f.address,
    f.hotline_phone,
    f.email,
    f.region,
    TRUE
FROM (
    VALUES
        ('Росприроднадзор', 'Центральный аппарат', 'Москва, ул. Большая Грузинская, 4/6', '+7 (499) 254-50-72', 'rpn.manager@ecosignal.local', 'Москва'),
        ('Минприроды РФ', 'Приемная обращений', 'Москва, ул. Большая Грузинская, 4/6', '+7 (495) 254-48-00', 'mpr.manager@ecosignal.local', 'Москва'),
        ('Рослесхоз', 'Федеральная диспетчерская служба', 'Москва, ул. Пятницкая, 59/19', '+7 (800) 100-94-00', 'forest.manager@ecosignal.local', 'Москва'),
        ('Департамент природопользования', 'Московский экологический контроль', 'Москва, ул. Новый Арбат, 11', '+7 (495) 777-77-77', 'eco-control.manager@ecosignal.local', 'Москва')
) AS f(org_name, name, address, hotline_phone, email, region)
INNER JOIN orgs o ON o.name = f.org_name
ON CONFLICT (organization_id, name) DO UPDATE
SET
    address = EXCLUDED.address,
    hotline_phone = EXCLUDED.hotline_phone,
    email = EXCLUDED.email,
    region = EXCLUDED.region,
    is_active = EXCLUDED.is_active;

WITH manager_accounts AS (
    SELECT *
    FROM (
        VALUES
            ('rpn.manager@ecosignal.local', 'Росприроднадзор', 'Центральный аппарат', 'Менеджер Росприроднадзора'),
            ('mpr.manager@ecosignal.local', 'Минприроды РФ', 'Приемная обращений', 'Менеджер Минприроды РФ'),
            ('forest.manager@ecosignal.local', 'Рослесхоз', 'Федеральная диспетчерская служба', 'Менеджер Рослесхоза'),
            ('eco-control.manager@ecosignal.local', 'Департамент природопользования', 'Московский экологический контроль', 'Менеджер департамента природопользования')
    ) AS a(login, organization_name, filial_name, about)
)
INSERT INTO org_admins (organization_id, filial_id, login, password_hash, role, about, is_active)
SELECT
    o.id,
    f.id,
    a.login,
    crypt('123456', gen_salt('bf', 10)),
    'admin',
    a.about,
    TRUE
FROM manager_accounts a
INNER JOIN organizations o ON o.name = a.organization_name
INNER JOIN filials f ON f.organization_id = o.id AND f.name = a.filial_name
ON CONFLICT (login) DO UPDATE
SET
    organization_id = EXCLUDED.organization_id,
    filial_id = EXCLUDED.filial_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    about = EXCLUDED.about,
    is_active = TRUE;
