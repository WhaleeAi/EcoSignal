CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
