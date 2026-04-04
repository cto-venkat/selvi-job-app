-- ============================================================
-- MODULE 3: AUTOMATED JOB APPLICATION SYSTEM
-- Database Schema Extension
-- Generated from PRD Section 14
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- APPLICATION STATUS HISTORY: audit trail of every status change
-- ============================================================
CREATE TABLE IF NOT EXISTS application_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'system', -- system, candidate, webhook
    reason TEXT,
    -- Audit fields for webhook/candidate actions
    source_ip INET,              -- IP address of the actor (for webhook actions)
    user_agent TEXT,              -- User-Agent header (for webhook actions)
    token_hash TEXT,              -- SHA-256 hash of the token used (not the token itself)
    -- Structured audit fields (extracted from metadata JSONB for queryability)
    action_type TEXT,              -- 'approve', 'reject', 'send', 'bounce', 'pause', 'resume', 'edit', 'withdraw'
    email_message_id TEXT,         -- Resend message ID (for email actions)
    resend_event_type TEXT,        -- Resend webhook event type (delivered, bounced, etc.)
    metadata JSONB DEFAULT '{}',   -- Additional unstructured context (keep minimal)
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_status_history_app_id ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_app_status_history_changed_at ON application_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_app_status_history_action_type ON application_status_history(action_type)
    WHERE action_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_status_history_source_ip ON application_status_history(source_ip)
    WHERE source_ip IS NOT NULL;


-- ============================================================
-- APPLICATION CONFIG: system-wide settings
-- ============================================================
CREATE TABLE IF NOT EXISTS application_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration (skip duplicates via ON CONFLICT)
INSERT INTO application_config (config_key, config_value, description) VALUES
('rate_limits', '{
    "max_emails_per_hour": 3,
    "max_emails_per_day": 15,
    "max_emails_per_week": 40,
    "max_per_domain_per_day": 2,
    "max_portal_tasks_per_day": 5,
    "max_pending_manual_tasks": 10,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00",
    "send_on_sundays": false,
    "min_delay_between_sends_seconds": 120,
    "max_delay_between_sends_seconds": 480
}', 'Rate limiting configuration for application submissions'),

('auto_apply_rules', '{
    "auto_send_email_b_tier": true,
    "require_approval_a_tier": true,
    "require_approval_a_plus_tier": true,
    "auto_send_agency_b_tier": true,
    "auto_send_speculative": false,
    "system_paused": false
}', 'Rules for automatic vs approval-required applications'),

('email_config', '{
    "from_name": "Selvi Kumar",
    "from_email": "selvi@applications.selvikumar.co.uk",
    "reply_to": "selvi.kumar@personal.email",
    "signature": "Best regards,\nSelvi Kumar\nPhD, MBA\n+44 xxxx xxxxxx",
    "max_email_words": 250,
    "banned_phrases": [
        "I am writing to express my interest",
        "I am excited to apply",
        "passionate about",
        "leverage my skills",
        "synergy",
        "thought leadership",
        "I believe I would be a great fit",
        "dear hiring manager",
        "to whom it may concern"
    ]
}', 'Email composition configuration'),

('approval_config', '{
    "first_reminder_hours": 12,
    "second_reminder_hours": 24,
    "auto_expire_hours": 48,
    "token_validity_hours": 72
}', 'A-tier approval flow configuration'),

('portal_patterns', '{
    "patterns": []
}', 'URL patterns for portal type detection -- see Section 6.3 for full dictionary'),

('candidate_profile', '{
    "full_name": "Selvi Kumar",
    "email": "selvi.kumar@personal.email",
    "phone": "+44 xxxx xxxxxx",
    "address_line1": "...",
    "address_line2": "...",
    "city": "Maidenhead",
    "county": "Berkshire",
    "postcode": "SL6 xxx",
    "country": "United Kingdom",
    "right_to_work": "Yes - Settled Status",
    "notice_period": "1 month",
    "current_salary": "Negotiable",
    "expected_salary": "GBP 70,000 - 80,000",
    "years_experience": 18,
    "highest_education": "PhD in Human Resource Development",
    "current_title": "Learning & Development Consultant",
    "languages": ["English (native)", "Tamil (native)", "Hindi (fluent)"]
}', 'Candidate personal details for form pre-filling'),

('referees', '[
    {
        "name": "...",
        "title": "...",
        "organisation": "...",
        "email": "...",
        "phone": "...",
        "relationship": "Former Line Manager"
    },
    {
        "name": "...",
        "title": "...",
        "organisation": "...",
        "email": "...",
        "phone": "...",
        "relationship": "Academic Supervisor"
    }
]', 'Referee details for application forms')
ON CONFLICT (config_key) DO NOTHING;


-- ============================================================
-- KNOWN CONTACTS: recruiter and agency relationship tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS known_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT NOT NULL,
    name TEXT,
    organisation TEXT,
    contact_type TEXT NOT NULL, -- recruiter, agency_consultant, hiring_manager, referral
    agency_specialism TEXT, -- e.g., 'L&D specialist', 'generalist', 'academic'
    relationship_notes TEXT, -- e.g., "Worked together on 3 roles in 2025"
    preferred_tone TEXT DEFAULT 'professional', -- professional, casual, formal
    previous_interactions INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMPTZ,
    hold_for_approval BOOLEAN DEFAULT true, -- always hold emails to known contacts for review
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_known_contacts_email ON known_contacts(email_address);


-- ============================================================
-- EMAIL SUPPRESSIONS: domains and addresses that should not receive emails
-- ============================================================
CREATE TABLE IF NOT EXISTS email_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT,
    domain TEXT,
    reason TEXT NOT NULL, -- hard_bounce, complaint, manual, unsubscribe
    source_application_id UUID REFERENCES applications(id),
    suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email_address)
    WHERE email_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_suppressions_domain ON email_suppressions(domain)
    WHERE domain IS NOT NULL;


-- ============================================================
-- DOCUMENT LIBRARY: reusable supplementary documents
-- ============================================================
CREATE TABLE IF NOT EXISTS document_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type TEXT NOT NULL,
    -- Types: teaching_philosophy, research_statement, diversity_statement,
    --   publications_list, portfolio, references_document, master_cv,
    --   master_cover_letter
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_format TEXT NOT NULL, -- pdf, docx, txt
    file_size_bytes INTEGER,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    target_role_type TEXT, -- academic, corporate, both
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_library_type ON document_library(document_type);
CREATE INDEX IF NOT EXISTS idx_document_library_current ON document_library(is_current)
    WHERE is_current = true;


-- ============================================================
-- APPLICATION METRICS: pre-computed daily metrics for dashboards
-- ============================================================
CREATE TABLE IF NOT EXISTS application_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    total_applications INTEGER DEFAULT 0,
    email_auto_count INTEGER DEFAULT 0,
    email_approved_count INTEGER DEFAULT 0,
    portal_manual_count INTEGER DEFAULT 0,
    linkedin_count INTEGER DEFAULT 0,
    other_count INTEGER DEFAULT 0,
    a_tier_count INTEGER DEFAULT 0,
    b_tier_count INTEGER DEFAULT 0,
    approvals_requested INTEGER DEFAULT 0,
    approvals_granted INTEGER DEFAULT 0,
    approvals_rejected INTEGER DEFAULT 0,
    approvals_expired INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    interviews_received INTEGER DEFAULT 0,
    rejections_received INTEGER DEFAULT 0,
    duplicates_blocked INTEGER DEFAULT 0,
    rate_limit_hits INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_application_metrics_date ON application_metrics(metric_date);


-- ============================================================
-- ALTER TABLE: add application-related columns to existing jobs table
-- ============================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_method TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_email TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_url_resolved TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_method_confidence NUMERIC(3,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_method_detected_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ready_to_apply BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ready_to_apply_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cv_tailored BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cv_file_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cl_file_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_id UUID;

CREATE INDEX IF NOT EXISTS idx_jobs_ready_to_apply ON jobs(ready_to_apply, tier)
    WHERE ready_to_apply = true AND status = 'scored';


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Company name normalization (used by dedup trigger)
CREATE OR REPLACE FUNCTION normalize_company(raw_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              trim(raw_name),
              '\s*(ltd|limited|plc|inc|incorporated|llc|llp|group|holdings|uk|international|corp|corporation)\.*\s*$',
              '', 'gi'
            ),
            '\s*(recruitment|consulting|staffing|solutions|services|partners|associates)\s*$',
            '', 'gi'
          ),
          '[^a-z0-9\s]', '', 'g'
        ),
        '\s+', ' ', 'g'
      ),
      '^\s+|\s+$', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-log status changes to history table
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO application_status_history
            (application_id, from_status, to_status, changed_by,
             source_ip, user_agent, token_hash)
        VALUES
            (NEW.id, OLD.status, NEW.status,
             COALESCE(NEW.metadata->>'changed_by', 'system'),
             (NEW.metadata->>'source_ip')::INET,
             NEW.metadata->>'user_agent',
             NEW.metadata->>'token_hash');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Compute dedup hash and normalized company on insert
CREATE OR REPLACE FUNCTION compute_application_dedup()
RETURNS TRIGGER AS $$
BEGIN
    NEW.company_normalized = normalize_company(
        (SELECT company FROM jobs WHERE id = NEW.job_id)
    );
    NEW.dedup_hash = md5(
        NEW.company_normalized || '|' ||
        lower((SELECT title FROM jobs WHERE id = NEW.job_id)) || '|' ||
        lower(COALESCE((SELECT location FROM jobs WHERE id = NEW.job_id), ''))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TRIGGERS
-- ============================================================

-- Drop existing triggers first to allow re-running this script
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS log_application_status ON applications;
CREATE TRIGGER log_application_status
    AFTER UPDATE OF status ON applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_status_change();

DROP TRIGGER IF EXISTS compute_application_dedup_trigger ON applications;
CREATE TRIGGER compute_application_dedup_trigger
    BEFORE INSERT ON applications
    FOR EACH ROW
    EXECUTE FUNCTION compute_application_dedup();

-- updated_at triggers for other tables
DROP TRIGGER IF EXISTS update_known_contacts_updated_at ON known_contacts;
CREATE TRIGGER update_known_contacts_updated_at
    BEFORE UPDATE ON known_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_library_updated_at ON document_library;
CREATE TRIGGER update_document_library_updated_at
    BEFORE UPDATE ON document_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_config_updated_at ON application_config;
CREATE TRIGGER update_application_config_updated_at
    BEFORE UPDATE ON application_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
