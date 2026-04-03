-- Тестовые данные для карты (можно запускать повторно)

-- Совместимость со старой схемой БД
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    UNIQUE (category_id, name)
);

ALTER TABLE appeals
    ADD COLUMN IF NOT EXISTS subcategory_id INT,
    ADD COLUMN IF NOT EXISTS assigned_admin_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'appeals_subcategory_id_fkey'
    ) THEN
        ALTER TABLE appeals
            ADD CONSTRAINT appeals_subcategory_id_fkey
            FOREIGN KEY (subcategory_id) REFERENCES subcategories(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'appeals_assigned_admin_id_fkey'
    ) THEN
        ALTER TABLE appeals
            ADD CONSTRAINT appeals_assigned_admin_id_fkey
            FOREIGN KEY (assigned_admin_id) REFERENCES users(id);
    END IF;
END $$;

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