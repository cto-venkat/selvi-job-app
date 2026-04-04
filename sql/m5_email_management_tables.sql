-- Module 5: Email Management & Intelligence System
-- Generated from PRD Section 13 Database Schema
-- Date: 2026-03-29

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Utility function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13.1 Table: emails
-- ============================================================================

CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Gmail identifiers
    gmail_message_id VARCHAR(100) NOT NULL UNIQUE,
    gmail_thread_id VARCHAR(100) NOT NULL,

    -- Email metadata
    subject VARCHAR(1000),
    from_email VARCHAR(500) NOT NULL,
    from_name VARCHAR(500),
    to_email VARCHAR(500) NOT NULL DEFAULT 'chellamma.uk@gmail.com',
    reply_to VARCHAR(500),
    date TIMESTAMPTZ NOT NULL,
    snippet VARCHAR(500),

    -- Email body (temporary storage -- purged after processing)
    body_plain TEXT,
    body_html TEXT,
    body_stripped TEXT,              -- HTML-stripped version for classification

    -- Attachment info
    has_attachments BOOLEAN DEFAULT false,
    attachment_types JSONB DEFAULT '[]'::jsonb,
    has_ics_attachment BOOLEAN DEFAULT false,
    ics_data JSONB,                 -- Parsed ICS content

    -- Threading
    is_reply BOOLEAN DEFAULT false,
    in_reply_to VARCHAR(500),       -- Message-ID of parent email
    references_header TEXT,         -- Full References header

    -- Gmail metadata
    gmail_labels JSONB DEFAULT '[]'::jsonb,  -- Labels at time of ingestion
    gmail_internal_date TIMESTAMPTZ,

    -- Processing status
    status VARCHAR(30) DEFAULT 'ingested'
        CHECK (status IN ('ingested', 'classified', 'extracted', 'labeled', 'draft_created', 'completed', 'skipped', 'error')),
    is_job_related BOOLEAN,         -- null until classified
    needs_review BOOLEAN DEFAULT false,

    -- Sender classification (fast-path)
    sender_pattern_match VARCHAR(50),  -- If sender was identified by pattern
    sender_pattern_confidence NUMERIC(4,3),

    -- Language detection
    detected_language VARCHAR(10),
    language_confidence NUMERIC(4,3),

    -- Notification tracking
    urgent_notification_sent BOOLEAN DEFAULT false,
    urgent_notification_sent_at TIMESTAMPTZ,

    -- GDPR: body content purge tracking
    body_purged BOOLEAN DEFAULT false,
    body_purged_at TIMESTAMPTZ,

    -- Audit
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classified_at TIMESTAMPTZ,
    extracted_at TIMESTAMPTZ,
    labeled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_thread_id ON emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_ingested ON emails(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_unclassified ON emails(status) WHERE status = 'ingested';
CREATE INDEX IF NOT EXISTS idx_emails_unextracted ON emails(status) WHERE status = 'classified';
CREATE INDEX IF NOT EXISTS idx_emails_unlabeled ON emails(status) WHERE status = 'extracted';
CREATE INDEX IF NOT EXISTS idx_emails_needs_review ON emails(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_emails_is_job_related ON emails(is_job_related);
CREATE INDEX IF NOT EXISTS idx_emails_urgent_unsent ON emails(urgent_notification_sent) WHERE urgent_notification_sent = false;

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13.2 Table: email_classifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- Classification result
    classification VARCHAR(50) NOT NULL
        CHECK (classification IN (
            'acknowledgment', 'rejection', 'interview_invite',
            'recruiter_outreach', 'job_alert', 'offer',
            'follow_up_request', 'marketing', 'not_job_related'
        )),
    sub_category VARCHAR(50),
    confidence NUMERIC(4,3) NOT NULL,
    rationale TEXT,

    -- Sender analysis
    is_urgent BOOLEAN DEFAULT false,
    is_automated BOOLEAN DEFAULT false,
    sender_type VARCHAR(30)
        CHECK (sender_type IN ('employer', 'recruiter', 'job_board', 'ats', 'personal_contact', 'unknown')),

    -- Classification method
    classification_method VARCHAR(30) NOT NULL
        CHECK (classification_method IN (
            'sender_pattern', 'subject_heuristic', 'claude_haiku',
            'claude_sonnet', 'manual_override'
        )),
    model_version VARCHAR(100),   -- e.g., 'claude-3.5-haiku-20260301'
    prompt_version VARCHAR(20),   -- Version of the classification prompt used

    -- Escalation tracking
    was_escalated BOOLEAN DEFAULT false,
    haiku_classification VARCHAR(50),     -- Original Haiku classification (if escalated)
    haiku_confidence NUMERIC(4,3),        -- Original Haiku confidence (if escalated)

    -- Manual review
    manually_reviewed BOOLEAN DEFAULT false,
    manual_classification VARCHAR(50),     -- Corrected classification (if reviewed)
    reviewed_at TIMESTAMPTZ,

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classification_duration_ms INTEGER,

    CONSTRAINT unique_email_classification UNIQUE (email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_classifications_email_id ON email_classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_email_classifications_classification ON email_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_email_classifications_classified_at ON email_classifications(classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_classifications_confidence ON email_classifications(confidence) WHERE confidence < 0.8;
CREATE INDEX IF NOT EXISTS idx_email_classifications_needs_review ON email_classifications(manually_reviewed) WHERE manually_reviewed = false AND confidence < 0.6;

-- ============================================================================
-- 13.3 Table: email_extracted_data
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_extracted_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    classification VARCHAR(50) NOT NULL,

    -- Common fields (applicable across categories)
    company_name VARCHAR(500),
    role_title VARCHAR(500),
    contact_person VARCHAR(500),
    contact_email VARCHAR(500),
    contact_phone VARCHAR(50),
    next_steps TEXT,
    response_deadline TIMESTAMPTZ,

    -- Interview-specific fields
    interview_date DATE,
    interview_time TIME,
    interview_timezone VARCHAR(30),
    interview_duration VARCHAR(50),
    interview_format VARCHAR(30)
        CHECK (interview_format IN ('phone', 'video', 'in_person', 'assessment', 'panel', 'informal', NULL)),
    interview_platform VARCHAR(100),
    interview_location TEXT,
    interview_link TEXT,
    interviewer_name VARCHAR(500),
    interviewer_title VARCHAR(500),
    interviewer_email VARCHAR(500),
    panel_members JSONB DEFAULT '[]'::jsonb,
    preparation_instructions TEXT,
    what_to_bring TEXT,
    dress_code VARCHAR(100),
    parking_instructions TEXT,
    alternative_times JSONB DEFAULT '[]'::jsonb,

    -- Rejection-specific fields
    rejection_reason TEXT,
    rejection_stage VARCHAR(30)
        CHECK (rejection_stage IN ('application', 'shortlisting', 'interview', 'final_round', NULL)),
    feedback_offered BOOLEAN DEFAULT false,
    feedback_contact VARCHAR(500),
    future_roles_suggested BOOLEAN DEFAULT false,
    keep_on_file BOOLEAN DEFAULT false,

    -- Acknowledgment-specific fields
    reference_number VARCHAR(100),
    review_timeline TEXT,
    expected_response_date DATE,
    application_portal_link TEXT,

    -- Recruiter-specific fields
    recruiter_name VARCHAR(500),
    recruiter_email VARCHAR(500),
    recruiter_phone VARCHAR(50),
    agency_name VARCHAR(500),
    proposed_role_title VARCHAR(500),
    proposed_company VARCHAR(500),
    proposed_salary_raw VARCHAR(200),
    proposed_salary_min INTEGER,
    proposed_salary_max INTEGER,
    proposed_location VARCHAR(500),
    proposed_working_pattern VARCHAR(30),
    proposed_contract_type VARCHAR(30),
    role_description_summary TEXT,
    recruiter_linkedin VARCHAR(500),
    is_exclusive_role BOOLEAN DEFAULT false,

    -- Offer-specific fields
    salary_offered INTEGER,
    salary_details TEXT,
    start_date DATE,
    offer_conditions JSONB DEFAULT '[]'::jsonb,
    benefits_mentioned JSONB DEFAULT '[]'::jsonb,
    probation_period VARCHAR(100),
    notice_period VARCHAR(100),
    reporting_to VARCHAR(500),
    offer_letter_attached BOOLEAN DEFAULT false,

    -- Follow-up-specific fields
    action_required TEXT,
    action_deadline TIMESTAMPTZ,
    documents_requested JSONB DEFAULT '[]'::jsonb,
    portal_link TEXT,

    -- Job alert-specific fields
    source_platform VARCHAR(50),
    jobs_listed JSONB DEFAULT '[]'::jsonb,
    total_jobs_count INTEGER,
    alert_frequency VARCHAR(30),

    -- Extraction quality
    extraction_confidence NUMERIC(4,3),
    fields_not_found JSONB DEFAULT '[]'::jsonb,
    extraction_notes TEXT,

    -- Module integration tracking
    module4_updated BOOLEAN DEFAULT false,
    module4_application_id UUID,
    module4_status_set VARCHAR(50),
    module6_notified BOOLEAN DEFAULT false,
    module1_jobs_created INTEGER DEFAULT 0,

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extraction_duration_ms INTEGER,

    CONSTRAINT unique_email_extraction UNIQUE (email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_extracted_data_email_id ON email_extracted_data(email_id);
CREATE INDEX IF NOT EXISTS idx_email_extracted_data_classification ON email_extracted_data(classification);
CREATE INDEX IF NOT EXISTS idx_email_extracted_data_company ON email_extracted_data(company_name);
CREATE INDEX IF NOT EXISTS idx_email_extracted_data_interview_date ON email_extracted_data(interview_date) WHERE interview_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_extracted_data_module4 ON email_extracted_data(module4_updated) WHERE module4_updated = false AND classification IN ('acknowledgment', 'rejection', 'interview_invite', 'offer');

-- ============================================================================
-- 13.5 Table: recruiter_contacts (MUST be created BEFORE email_threads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recruiter_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Recruiter identity
    recruiter_name VARCHAR(500) NOT NULL,
    recruiter_email VARCHAR(500) NOT NULL,
    recruiter_phone VARCHAR(50),
    agency_name VARCHAR(500),
    linkedin_url VARCHAR(500),

    -- Contact history
    first_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_contacts INTEGER DEFAULT 1,
    total_roles_proposed INTEGER DEFAULT 0,

    -- Quality metrics
    quality_score INTEGER DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
    average_role_relevance NUMERIC(5,2),
    exclusive_role_count INTEGER DEFAULT 0,
    personalization_score NUMERIC(4,3) DEFAULT 0.5,  -- How personalized their outreach is

    -- Response tracking
    our_response_count INTEGER DEFAULT 0,
    their_follow_up_count INTEGER DEFAULT 0,
    responded_to_our_reply BOOLEAN DEFAULT false,
    ghosted_after_our_reply BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'blacklisted', 'dormant', 'high_value')),
    blacklisted_reason TEXT,

    -- Duplicate detection
    canonical_recruiter_id UUID REFERENCES recruiter_contacts(id),  -- Points to primary record if duplicate

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_contacts_email ON recruiter_contacts(recruiter_email);
CREATE INDEX IF NOT EXISTS idx_recruiter_contacts_agency ON recruiter_contacts(agency_name);
CREATE INDEX IF NOT EXISTS idx_recruiter_contacts_status ON recruiter_contacts(status);
CREATE INDEX IF NOT EXISTS idx_recruiter_contacts_quality ON recruiter_contacts(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_contacts_last_contact ON recruiter_contacts(last_contact_at DESC);

CREATE TRIGGER update_recruiter_contacts_updated_at BEFORE UPDATE ON recruiter_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13.4 Table: email_threads (after recruiter_contacts due to FK)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gmail_thread_id VARCHAR(100) NOT NULL UNIQUE,

    -- Thread metadata
    subject VARCHAR(1000),
    participant_emails JSONB DEFAULT '[]'::jsonb,
    message_count INTEGER DEFAULT 1,

    -- Latest activity
    last_received_at TIMESTAMPTZ,        -- Last email received from others
    last_sent_at TIMESTAMPTZ,            -- Last email sent by candidate
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Thread classification (based on most significant email in thread)
    primary_classification VARCHAR(50),
    company_name VARCHAR(500),
    role_title VARCHAR(500),

    -- Relationship tracking
    recruiter_contact_id UUID REFERENCES recruiter_contacts(id),
    application_id UUID,                  -- Module 4 application ID

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'dormant', 'closed', 'resolved')),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread ON email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_activity ON email_threads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_recruiter ON email_threads(recruiter_contact_id) WHERE recruiter_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_threads_dormant ON email_threads(status) WHERE status = 'dormant';

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13.6 Table: recruiter_role_proposals
-- ============================================================================

CREATE TABLE IF NOT EXISTS recruiter_role_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_contact_id UUID NOT NULL REFERENCES recruiter_contacts(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id),

    -- Role details
    role_title VARCHAR(500),
    company_name VARCHAR(500),
    salary_raw VARCHAR(200),
    salary_min INTEGER,
    salary_max INTEGER,
    location VARCHAR(500),
    working_pattern VARCHAR(30),
    contract_type VARCHAR(30),
    role_description TEXT,

    -- Relevance assessment
    relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
    relevance_tier CHAR(1) CHECK (relevance_tier IN ('A', 'B', 'C', 'D')),
    relevance_rationale TEXT,
    is_exclusive BOOLEAN DEFAULT false,

    -- Outcome tracking
    candidate_interested BOOLEAN,
    candidate_applied BOOLEAN DEFAULT false,
    outcome VARCHAR(30) CHECK (outcome IN ('pending', 'applied', 'interviewed', 'offered', 'rejected', 'withdrawn', 'expired')),

    -- Audit
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_roles_recruiter ON recruiter_role_proposals(recruiter_contact_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_roles_relevance ON recruiter_role_proposals(relevance_tier);
CREATE INDEX IF NOT EXISTS idx_recruiter_roles_proposed ON recruiter_role_proposals(proposed_at DESC);

-- ============================================================================
-- 13.7 Table: email_notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID REFERENCES emails(id),

    -- Notification details
    notification_type VARCHAR(30) NOT NULL
        CHECK (notification_type IN (
            'interview_alert', 'offer_alert', 'follow_up_alert',
            'delivery_failure_alert', 'recruiter_alert',
            'daily_summary', 'system_error'
        )),
    channel VARCHAR(20) NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'webhook')),
    recipient VARCHAR(500) NOT NULL DEFAULT 'chellamma.uk@gmail.com',

    -- Content
    subject VARCHAR(500),
    body TEXT,

    -- Delivery
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    resend_message_id VARCHAR(200),  -- Resend API message ID
    error_message TEXT,
    sent_at TIMESTAMPTZ,

    -- Throttling
    throttled BOOLEAN DEFAULT false,
    throttle_reason VARCHAR(200),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_email ON email_notifications(email_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent ON email_notifications(sent_at DESC);

-- ============================================================================
-- 13.8 Table: email_sender_patterns (with seed data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sender_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Pattern definition
    pattern VARCHAR(500) NOT NULL,        -- Email address or *@domain pattern
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'exact'
        CHECK (pattern_type IN ('exact', 'domain', 'regex')),

    -- Classification
    classification VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0,

    -- Metadata
    source_name VARCHAR(100),             -- Human-readable source name (e.g., "LinkedIn Job Alerts")
    notes TEXT,

    -- Status
    enabled BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sender_patterns_pattern ON email_sender_patterns(pattern) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_sender_patterns_classification ON email_sender_patterns(classification);

-- Seed data: known job-related senders
INSERT INTO email_sender_patterns (pattern, pattern_type, classification, sub_category, source_name) VALUES
    -- LinkedIn
    ('noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Alerts'),
    ('jobs-noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Job Alerts'),
    ('jobalerts-noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Job Alerts'),
    ('invitations@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn InMail'),
    ('notifications-noreply@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn Notifications'),
    ('messaging-digest-noreply@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn Messages'),

    -- Indeed
    ('noreply@indeed.com', 'exact', 'job_alert', 'indeed', 'Indeed Alerts'),
    ('alert@indeed.co.uk', 'exact', 'job_alert', 'indeed', 'Indeed UK Alerts'),
    ('noreply@indeedemail.com', 'exact', 'job_alert', 'indeed', 'Indeed Email Alerts'),

    -- TotalJobs
    ('jobalert@totaljobs.com', 'exact', 'job_alert', 'totaljobs', 'TotalJobs Alerts'),
    ('noreply@totaljobs.com', 'exact', 'job_alert', 'totaljobs', 'TotalJobs'),

    -- Reed
    ('alerts@reed.co.uk', 'exact', 'job_alert', 'reed', 'Reed Alerts'),
    ('noreply@reed.co.uk', 'exact', 'job_alert', 'reed', 'Reed'),

    -- CV-Library
    ('alerts@cv-library.co.uk', 'exact', 'job_alert', 'cv_library', 'CV-Library Alerts'),

    -- Guardian
    ('jobs@theguardian.com', 'exact', 'job_alert', 'guardian', 'Guardian Jobs'),

    -- jobs.ac.uk
    ('alerts@jobs.ac.uk', 'exact', 'job_alert', 'jobs_ac_uk', 'jobs.ac.uk Alerts'),
    ('noreply@jobs.ac.uk', 'exact', 'job_alert', 'jobs_ac_uk', 'jobs.ac.uk'),

    -- ATS platforms (these need content-based classification, so we mark as 'ats_communication')
    ('*@myworkdayjobs.com', 'domain', 'ats_communication', NULL, 'Workday'),
    ('*@myworkday.com', 'domain', 'ats_communication', NULL, 'Workday'),
    ('*@greenhouse.io', 'domain', 'ats_communication', NULL, 'Greenhouse'),
    ('*@lever.co', 'domain', 'ats_communication', NULL, 'Lever'),
    ('*@icims.com', 'domain', 'ats_communication', NULL, 'iCIMS'),
    ('*@taleo.net', 'domain', 'ats_communication', NULL, 'Taleo'),
    ('*@smartrecruiters.com', 'domain', 'ats_communication', NULL, 'SmartRecruiters'),
    ('*@breezy.hr', 'domain', 'ats_communication', NULL, 'Breezy HR'),
    ('*@applytojob.com', 'domain', 'ats_communication', NULL, 'ApplyToJob'),
    ('*@hirebridge.com', 'domain', 'ats_communication', NULL, 'Hirebridge'),

    -- Bounce/delivery failure
    ('MAILER-DAEMON@*', 'domain', 'delivery_failure', NULL, 'Mail Delivery System'),
    ('postmaster@*', 'domain', 'delivery_failure', NULL, 'Postmaster'),

    -- Marketing (generic job board marketing)
    ('marketing@linkedin.com', 'exact', 'marketing', 'newsletter', 'LinkedIn Marketing'),
    ('marketing@indeed.com', 'exact', 'marketing', 'newsletter', 'Indeed Marketing'),
    ('promotions@totaljobs.com', 'exact', 'marketing', 'promotion', 'TotalJobs Promotions'),
    ('newsletter@reed.co.uk', 'exact', 'marketing', 'newsletter', 'Reed Newsletter'),

    -- System self-exclusion (CRITICAL: prevents recursive processing of own notifications)
    ('selvi-system@apiloom.io', 'exact', 'system_notification', NULL, 'Selvi System Notifications -- SKIP');

-- ============================================================================
-- 13.9 Table: email_processing_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID REFERENCES emails(id),

    -- Processing details
    workflow_name VARCHAR(100) NOT NULL,
    step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    duration_ms INTEGER,
    error_message TEXT,

    -- Context
    details JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_processing_log_email ON email_processing_log(email_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_workflow ON email_processing_log(workflow_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_status ON email_processing_log(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_email_processing_log_recent ON email_processing_log(created_at DESC);

-- ============================================================================
-- 13.10 Table: email_drafts
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- Gmail draft
    gmail_draft_id VARCHAR(100),
    gmail_thread_id VARCHAR(100),

    -- Draft content
    draft_subject VARCHAR(500),
    draft_body TEXT NOT NULL,
    draft_type VARCHAR(30) NOT NULL
        CHECK (draft_type IN (
            'interview_confirmation', 'acknowledgment_reply',
            'recruiter_response_interested', 'recruiter_response_decline',
            'follow_up_response', 'custom'
        )),

    -- Quality
    draft_word_count INTEGER,
    validation_passed BOOLEAN DEFAULT true,
    validation_issues JSONB DEFAULT '[]'::jsonb,

    -- Status
    status VARCHAR(20) DEFAULT 'created'
        CHECK (status IN ('created', 'in_gmail', 'sent_by_candidate', 'discarded', 'failed')),

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_email ON email_drafts(email_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON email_drafts(draft_type);

-- ============================================================================
-- 13.11 Table: email_classification_calibration
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_classification_calibration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Test case
    email_subject VARCHAR(500) NOT NULL,
    email_from VARCHAR(500),
    email_body TEXT NOT NULL,
    email_headers JSONB DEFAULT '{}'::jsonb,

    -- Expected results
    expected_classification VARCHAR(50) NOT NULL,
    expected_sub_category VARCHAR(50),
    expected_is_urgent BOOLEAN,

    -- Actual results (from last calibration run)
    last_actual_classification VARCHAR(50),
    last_actual_confidence NUMERIC(4,3),
    last_actual_sub_category VARCHAR(50),
    match BOOLEAN,                        -- Did actual match expected?
    drift_detected BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_tested_at TIMESTAMPTZ
);

-- ============================================================================
-- 13.12 GDPR Data Purge Function
-- ============================================================================

-- Purge email body content after processing (GDPR compliance)
-- Retains metadata and extracted structured data, removes raw email text
CREATE OR REPLACE FUNCTION purge_email_bodies(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    -- Also purge body-derived text stored in email_extracted_data
    UPDATE email_extracted_data
    SET
        role_description_summary = NULL,
        preparation_instructions = NULL,
        rejection_feedback = NULL
    WHERE email_id IN (
        SELECT id FROM emails
        WHERE status IN ('completed', 'classified', 'extracted', 'labeled', 'drafted', 'notified', 'skipped')
          AND body_purged = false
          AND created_at < NOW() - (retention_days || ' days')::INTERVAL
    );

    UPDATE emails
    SET
        body_plain = NULL,
        body_html = NULL,
        body_stripped = NULL,
        body_purged = true,
        body_purged_at = NOW()
    WHERE
        status IN ('completed', 'classified', 'extracted', 'labeled', 'drafted', 'notified', 'skipped')
        -- NOTE: The purge covers ALL terminal processing states, not just 'completed'.
        -- v2 had a gap: emails reached 'classified' or 'extracted' but never 'completed',
        -- so the purge never fired. Now all post-classification states are eligible.
        AND body_purged = false
        AND created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule via n8n or pg_cron:
-- SELECT purge_email_bodies(7); -- Run daily, purge bodies older than 7 days

-- ============================================================================
-- 13.13 System config entries for Module 5
-- ============================================================================

INSERT INTO system_config (key, value, description) VALUES
    ('email_polling_enabled', 'true', 'Enable/disable email polling'),
    ('email_classification_enabled', 'true', 'Enable/disable AI classification'),
    ('email_drafting_enabled', 'true', 'Enable/disable auto-draft creation'),
    ('email_notifications_enabled', 'true', 'Enable/disable urgent notifications'),
    ('email_body_retention_days', '7', 'Number of days to retain email body text before GDPR purge'),
    ('email_classification_model', '"claude-3.5-haiku"', 'Default model for email classification'),
    ('email_escalation_model', '"claude-3.5-sonnet"', 'Model for classification escalation'),
    ('email_haiku_confidence_threshold', '0.80', 'Confidence threshold below which Haiku escalates to Sonnet'),
    ('email_notification_quiet_start', '"22:00"', 'Start of quiet hours for non-critical notifications'),
    ('email_notification_quiet_end', '"07:00"', 'End of quiet hours'),
    ('email_draft_for_ack_tier', '"A"', 'Minimum tier for acknowledgment reply drafts (A, B, C, or off)'),
    ('email_last_history_id', '"0"', 'Gmail History API ID of last successful poll (0 triggers initial reconciliation)'),
    ('email_last_sent_poll_timestamp', '"2026-03-29T00:00:00Z"', 'Timestamp of last successful Sent folder poll'),
    ('email_daily_summary_time', '"08:00"', 'Time to send daily email summary (UK time)'),
    ('candidate_email', '"chellamma.uk@gmail.com"', 'Candidate Gmail address'),
    ('candidate_name', '"Selvi Chellamma"', 'Candidate display name')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version, name) VALUES (5, '005_email_management_intelligence')
ON CONFLICT DO NOTHING;

COMMIT;
