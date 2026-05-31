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
