SELECT
    'system_admins' AS table_name,
    COUNT(*) AS rows_count
FROM system_admins;

SELECT
    id,
    login,
    email,
    full_name,
    role,
    is_active,
    created_at,
    last_login_at
FROM system_admins
ORDER BY id;

SELECT
    'users role check' AS check_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
WHERE c.conrelid = 'users'::regclass
  AND c.conname = 'users_role_check';

SELECT
    'org_admins role check' AS check_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
WHERE c.conrelid = 'org_admins'::regclass
  AND c.conname = 'org_admins_role_check';

SELECT
    'ai_moderation_runs' AS table_name,
    COUNT(*) AS rows_count
FROM ai_moderation_runs;
