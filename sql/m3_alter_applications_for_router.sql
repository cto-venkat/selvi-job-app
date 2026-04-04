-- ============================================================
-- MODULE 3: ALTER applications table to add auto-apply columns
-- Run after Module 4 schema (which creates the base applications table)
-- Applied 2026-04-02 via n8n webhook workflow
-- ============================================================

-- Module 3 status tracking (separate from Module 4's current_state)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS method_confidence NUMERIC(3,2);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS method_detected_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS composite_score NUMERIC(5,2);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_type TEXT DEFAULT 'direct';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_email TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS email_body TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resend_message_id TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portal_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portal_type TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS task_card_content TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS estimated_manual_minutes INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_token TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_token_expires_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS dedup_hash TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS company_normalized TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

-- Jobs table columns needed by Module 3
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ready_to_apply BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cv_file_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cl_file_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_email TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closing_date DATE;

-- Seed auto_apply_rules config if not present
INSERT INTO application_config (config_key, config_value, description) VALUES
('auto_apply_rules', '{
    "auto_send_email_b_tier": true,
    "require_approval_a_tier": true,
    "require_approval_a_plus_tier": true,
    "system_paused": false
}'::jsonb, 'Auto-apply rules')
ON CONFLICT (config_key) DO NOTHING;
