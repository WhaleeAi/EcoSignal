BEGIN;

DROP TABLE IF EXISTS org_adm_refs CASCADE;
DROP TABLE IF EXISTS admin_registration_requests CASCADE;

ALTER TABLE appeal_assignments
    ALTER COLUMN assigned_by DROP NOT NULL;

ALTER TABLE appeal_assignments
    DROP CONSTRAINT IF EXISTS appeal_assignments_assigned_by_fkey,
    ADD CONSTRAINT appeal_assignments_assigned_by_fkey
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE appeal_assignments
SET assigned_by = NULL
WHERE assigned_by IN (
    SELECT id
    FROM users
    WHERE role IN ('admin', 'superadmin')
);

ALTER TABLE appeals
    DROP CONSTRAINT IF EXISTS appeals_assigned_admin_id_fkey,
    DROP COLUMN IF EXISTS assigned_admin_id;

DELETE FROM users
WHERE role IN ('admin', 'superadmin');

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check,
    ADD CONSTRAINT users_role_check CHECK (role IN ('citizen', 'agency'));

DELETE FROM org_admins
WHERE role = 'superadmin';

ALTER TABLE org_admins
    ALTER COLUMN role SET DEFAULT 'admin',
    DROP CONSTRAINT IF EXISTS org_admins_role_check,
    ADD CONSTRAINT org_admins_role_check CHECK (role = 'admin');

ALTER TABLE appeal_chats
    DROP CONSTRAINT IF EXISTS appeal_chats_check,
    ADD CONSTRAINT appeal_chats_check CHECK (
        (sender_user_id IS NOT NULL AND sender_org_admin_id IS NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NOT NULL) OR
        (sender_user_id IS NULL AND sender_org_admin_id IS NULL)
    );

UPDATE appeals
SET status = 'rejected',
    priority = 0
WHERE status = 'pending';

COMMIT;
