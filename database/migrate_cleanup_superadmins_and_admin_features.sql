BEGIN;

DROP TABLE IF EXISTS superadmins CASCADE;

CREATE TABLE IF NOT EXISTS system_audit_logs (
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

CREATE TABLE IF NOT EXISTS ai_settings (
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

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_entity
    ON system_audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor
    ON system_audit_logs (actor_source, actor_id, created_at DESC);

COMMIT;
