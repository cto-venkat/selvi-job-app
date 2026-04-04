-- ============================================
-- MODULE 4: APPLICATION TRACKER & PIPELINE MANAGER
-- Database Schema Setup
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================
-- Table: applications
-- Central tracking table. One row per job application.
-- ============================================
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Link to Module 1 job data (nullable for speculative applications with no job listing)
    job_id UUID REFERENCES jobs(id) ON DELETE RESTRICT,

    -- Core application data
    company_name VARCHAR(500) NOT NULL,           -- Denormalized from jobs for query performance
    job_title VARCHAR(500) NOT NULL,              -- Denormalized from jobs
    company_url TEXT,                             -- Company website
    company_domain VARCHAR(200),                  -- Extracted domain for email matching
    reference_number VARCHAR(200),                -- Employer's reference number for this role

    -- Pipeline classification
    pipeline_track VARCHAR(20) NOT NULL CHECK (pipeline_track IN ('corporate', 'academic')),

    -- State machine
    current_state VARCHAR(30) NOT NULL DEFAULT 'discovered'
        CHECK (current_state IN (
            'discovered', 'shortlisted', 'cv_tailored',
            'applied', 'acknowledged', 'academic_longlisted', 'academic_shortlisted',
            'screening', 'interviewing',
            'assessment', 'offer_received', 'negotiating', 'pre_employment',
            'accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired'
        )),
    -- Highest state ever reached (for funnel analysis -- not reset on rejection/ghosting)
    highest_state_reached VARCHAR(30),
    previous_state VARCHAR(30),
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome VARCHAR(20) CHECK (outcome IN (
        'accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired', NULL
    )),

    -- Stage timestamps (populated as application progresses)
    discovered_at TIMESTAMPTZ,
    shortlisted_at TIMESTAMPTZ,
    cv_tailored_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    academic_longlisted_at TIMESTAMPTZ,              -- Academic track only
    academic_shortlisted_at TIMESTAMPTZ,             -- Academic track only
    screening_at TIMESTAMPTZ,
    first_interview_at TIMESTAMPTZ,
    offer_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,                      -- When terminal state was reached

    -- Application details
    application_method VARCHAR(30) CHECK (application_method IN (
        'auto_apply', 'manual_portal', 'manual_email', 'manual_linkedin',
        'recruitment_agency', 'direct_referral', 'speculative'
    )),
    application_url TEXT,                          -- Where the application was submitted
    portal_confirmation_id VARCHAR(200),           -- Confirmation ID from application portal

    -- Document tracking (links to Module 2)
    cv_version_id UUID,                           -- References Module 2 CV versions table
    cover_letter_id UUID,                         -- References Module 2 cover letter table
    cv_filename VARCHAR(500),                     -- Filename of CV sent
    cover_letter_filename VARCHAR(500),            -- Filename of cover letter sent
    additional_documents JSONB DEFAULT '[]'::jsonb, -- Other docs (academic CV, research statement, etc.)

    -- Salary context
    salary_offered_min INTEGER,                   -- If salary range is stated
    salary_offered_max INTEGER,
    salary_negotiated INTEGER,                    -- Final negotiated salary
    salary_notes TEXT,                            -- Benefits, pension, etc.

    -- Follow-up tracking
    follow_up_count INTEGER DEFAULT 0,
    last_follow_up_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,                -- Calculated or manually set
    follow_up_snoozed_until TIMESTAMPTZ,          -- If candidate snoozed reminders
    ghosting_detected_at TIMESTAMPTZ,

    -- Interview tracking (summary)
    interview_count INTEGER DEFAULT 0,
    last_interview_at TIMESTAMPTZ,
    interview_notes TEXT,

    -- Referral tracking
    has_referral BOOLEAN DEFAULT false,
    referral_name VARCHAR(200),
    referral_relationship VARCHAR(200),

    -- Source tracking (which discovery source led to this application)
    discovery_source VARCHAR(50),                  -- Source that found this job (from Module 1)

    -- Notes
    candidate_notes TEXT,                          -- Free-form notes by candidate
    rejection_reason VARCHAR(50),                  -- Classified rejection reason code
    rejection_detail TEXT,                          -- Full rejection text

    -- Metadata
    is_active BOOLEAN GENERATED ALWAYS AS (
        current_state NOT IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
    ) STORED,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Re-application support
    application_attempt INTEGER NOT NULL DEFAULT 1,   -- 1 = first application, 2+ = re-application
    previous_application_id UUID REFERENCES applications(id),  -- Links to prior attempt if re-applying

    -- Recruitment agency support (v2)
    recruitment_agency VARCHAR(200),                   -- Agency name (e.g., Hays, Michael Page)
    recruiter_name VARCHAR(200),                       -- Individual recruiter handling this role
    recruiter_email VARCHAR(500),                      -- Recruiter's email for matching

    -- Structured compensation (v2)
    compensation JSONB DEFAULT '{}'::jsonb,            -- {base_salary, bonus_pct, pension_employer_pct,
                                                       --  pension_scheme, car_allowance, other_benefits,
                                                       --  pay_grade, spine_point, allowances,
                                                       --  notice_period_weeks, probation_months,
                                                       --  total_compensation_estimate}

    -- Constraints
    -- Partial unique: only one active application per job at a time
    CONSTRAINT unique_active_job_application UNIQUE (job_id, application_attempt)
);

-- Indexes for applications
CREATE INDEX IF NOT EXISTS idx_applications_state ON applications(current_state) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_applications_track ON applications(pipeline_track) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_applications_applied ON applications(applied_at DESC) WHERE applied_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_domain);
CREATE INDEX IF NOT EXISTS idx_applications_company_name ON applications(company_name);
CREATE INDEX IF NOT EXISTS idx_applications_follow_up ON applications(next_follow_up_at)
    WHERE is_active = true AND next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_ghosting ON applications(state_changed_at)
    WHERE is_active = true AND current_state IN ('applied', 'acknowledged', 'screening', 'interviewing');
CREATE INDEX IF NOT EXISTS idx_applications_cv_version ON applications(cv_version_id);
CREATE INDEX IF NOT EXISTS idx_applications_outcome ON applications(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_active_company ON applications(company_name)
    WHERE is_active = true;

-- Updated_at trigger (reuse from Module 1)
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: application_events
-- Every state transition, email received, note added, document attached,
-- and follow-up sent is recorded as an event. Complete audit trail.
-- ============================================
CREATE TABLE IF NOT EXISTS application_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(50) NOT NULL,               -- See Section 6.5 for valid types
    event_source VARCHAR(50) NOT NULL CHECK (event_source IN (
        'module_1', 'module_2', 'module_3', 'module_5',
        'wf4_status', 'wf4_ghost', 'wf4_notify', 'wf4_metrics',
        'manual_email', 'manual_input', 'system'
    )),
    event_data JSONB DEFAULT '{}'::jsonb,           -- Structured data specific to event type

    -- State transition (if applicable)
    from_state VARCHAR(30),
    to_state VARCHAR(30),
    is_valid_transition BOOLEAN DEFAULT true,

    -- Email context (if triggered by email)
    email_id VARCHAR(500),                          -- Email message ID
    email_from VARCHAR(500),
    email_subject VARCHAR(500),
    email_received_at TIMESTAMPTZ,
    match_confidence INTEGER,                       -- 0-100, how confident we are this email matches this application

    -- Notes
    notes TEXT,

    -- Audit
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for application_events
CREATE INDEX IF NOT EXISTS idx_app_events_application ON application_events(application_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON application_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_occurred ON application_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_source ON application_events(event_source);
CREATE INDEX IF NOT EXISTS idx_app_events_email ON application_events(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_events_invalid ON application_events(is_valid_transition) WHERE is_valid_transition = false;

-- ============================================
-- Table: application_documents
-- Links applications to specific CV and cover letter versions (Module 2).
-- ============================================
CREATE TABLE IF NOT EXISTS application_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Document details
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN (
        'cv', 'cover_letter', 'academic_cv', 'research_statement',
        'teaching_philosophy', 'reference_letter', 'portfolio', 'other'
    )),
    document_version VARCHAR(50),                   -- Version identifier from Module 2
    filename VARCHAR(500) NOT NULL,
    file_path TEXT,                                  -- Storage path on server
    file_size_bytes INTEGER,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',

    -- Tailoring metadata
    tailoring_score INTEGER,                        -- How tailored this version is (0-100)
    tailoring_notes TEXT,                            -- What was tailored
    base_template VARCHAR(100),                     -- Which base template was used

    -- Performance tracking
    sent_at TIMESTAMPTZ,                            -- When this document was submitted
    response_received BOOLEAN DEFAULT false,         -- Did this application get a response

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for application_documents
CREATE INDEX IF NOT EXISTS idx_app_docs_application ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_type ON application_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_app_docs_version ON application_documents(document_version);

-- ============================================
-- Table: application_interviews
-- Detailed tracking of each interview round.
-- ============================================
CREATE TABLE IF NOT EXISTS application_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Interview details
    round_number INTEGER NOT NULL DEFAULT 1,
    interview_type VARCHAR(30) NOT NULL CHECK (interview_type IN (
        'phone_screen', 'video_call', 'in_person', 'panel',
        'teaching_presentation', 'case_study', 'assessment_centre',
        'psychometric_test', 'technical_exercise', 'informal_chat'
    )),
    interview_format VARCHAR(50),                   -- competency_based, case_study, presentation, etc.

    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    location TEXT,                                   -- Physical address or video link
    platform VARCHAR(50),                            -- Teams, Zoom, Google Meet, etc.

    -- People
    interviewers JSONB DEFAULT '[]'::jsonb,          -- Array of {name, title, email}

    -- Preparation
    preparation_notes TEXT,                          -- What to prepare
    documents_to_bring JSONB DEFAULT '[]'::jsonb,
    presentation_topic TEXT,                         -- For teaching presentations / case studies
    presentation_duration_minutes INTEGER,

    -- Outcome
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
    outcome VARCHAR(20) CHECK (outcome IN ('passed', 'failed', 'pending', 'unknown')),
    feedback TEXT,                                   -- Feedback received (if any)
    candidate_notes TEXT,                            -- Candidate's own notes/impressions

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for application_interviews
CREATE INDEX IF NOT EXISTS idx_app_interviews_application ON application_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_app_interviews_scheduled ON application_interviews(scheduled_at)
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_app_interviews_upcoming ON application_interviews(scheduled_at)
    WHERE scheduled_at > NOW() AND status = 'scheduled';

CREATE TRIGGER update_app_interviews_updated_at BEFORE UPDATE ON application_interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: application_pre_employment
-- Tracks pre-employment check progress for accepted offers.
-- ============================================
CREATE TABLE IF NOT EXISTS application_pre_employment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- DBS Check (Special Category Data -- UK GDPR Article 10)
    -- Only minimum status stored here. Do NOT store detail of any issues found.
    -- DBS data must be deleted within 30 days of pre-employment completion or job search end.
    -- Lawful basis: candidate's own explicit consent as data subject.
    dbs_required BOOLEAN DEFAULT false,
    dbs_type VARCHAR(30) CHECK (dbs_type IN (
        'basic', 'standard', 'enhanced', 'enhanced_with_barring'
    )),
    dbs_submitted_at TIMESTAMPTZ,
    dbs_completed_at TIMESTAMPTZ,
    dbs_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (dbs_status IN ('not_required', 'pending', 'submitted', 'processing', 'cleared')),

    -- Right to Work
    rtw_required BOOLEAN DEFAULT true,
    rtw_verified BOOLEAN DEFAULT false,
    rtw_document_type VARCHAR(50),                  -- e.g., 'british_passport', 'brp', 'share_code'
    rtw_verified_at TIMESTAMPTZ,

    -- References (data minimized -- store name and status only, not email/org)
    references_required INTEGER DEFAULT 2,
    references_received INTEGER DEFAULT 0,
    references_details JSONB DEFAULT '[]'::jsonb,   -- Array of {name, status} only.

    -- Qualification Verification
    quals_verification_required BOOLEAN DEFAULT false,
    quals_verification_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (quals_verification_status IN ('not_required', 'pending', 'submitted', 'verified', 'issues_found')),
    quals_details JSONB DEFAULT '{}'::jsonb,

    -- Occupational Health
    occ_health_required BOOLEAN DEFAULT false,
    occ_health_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (occ_health_status IN ('not_required', 'pending', 'submitted', 'cleared', 'issues_found')),

    -- HESA (academic only)
    hesa_required BOOLEAN DEFAULT false,
    hesa_submitted BOOLEAN DEFAULT false,
    hesa_data JSONB DEFAULT '{}'::jsonb,

    -- Overall status
    all_checks_complete BOOLEAN DEFAULT false,
    expected_start_date DATE,
    actual_start_date DATE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for application_pre_employment
CREATE INDEX IF NOT EXISTS idx_app_pre_emp_application ON application_pre_employment(application_id);
CREATE INDEX IF NOT EXISTS idx_app_pre_emp_incomplete ON application_pre_employment(all_checks_complete)
    WHERE all_checks_complete = false;

CREATE TRIGGER update_app_pre_emp_updated_at BEFORE UPDATE ON application_pre_employment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: pipeline_metrics
-- Stores calculated pipeline metrics for trending and reporting.
-- ============================================
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Metric identification
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}'::jsonb,           -- e.g., {"track": "corporate", "source": "reed"}

    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) DEFAULT 'snapshot'
        CHECK (period_type IN ('snapshot', 'daily', 'weekly', 'monthly')),

    -- Audit
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for pipeline_metrics
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_name ON pipeline_metrics(metric_name, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_period ON pipeline_metrics(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_dimensions ON pipeline_metrics USING gin(dimensions);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_metrics_upsert
    ON pipeline_metrics(metric_name, period_start, period_type, dimensions);

-- ============================================
-- Table: follow_up_log
-- Tracks follow-up reminders sent and candidate actions taken.
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Reminder details
    reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN (
        'initial_follow_up', 'second_follow_up', 'ghosting_warning',
        'deadline_approaching', 'status_check', 'interview_prep',
        'custom'
    )),
    suggested_action TEXT,                          -- What the system suggests
    follow_up_template TEXT,                        -- Suggested email text

    -- Delivery
    sent_at TIMESTAMPTZ,
    sent_via VARCHAR(20) DEFAULT 'email',
    notification_id UUID,                           -- Reference to notification_log

    -- Candidate response
    candidate_action VARCHAR(30) CHECK (candidate_action IN (
        'followed_up', 'snoozed', 'dismissed', 'marked_ghosted', 'no_action', NULL
    )),
    candidate_action_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for follow_up_log
CREATE INDEX IF NOT EXISTS idx_follow_up_application ON follow_up_log(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_pending ON follow_up_log(candidate_action)
    WHERE candidate_action IS NULL;

-- ============================================
-- Table: application_notes
-- Free-form notes attached to applications by the candidate.
-- ============================================
CREATE TABLE IF NOT EXISTS application_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Note content
    note_text TEXT NOT NULL,
    note_type VARCHAR(30) DEFAULT 'general' CHECK (note_type IN (
        'general', 'interview_prep', 'interview_feedback', 'research',
        'follow_up', 'salary', 'contact', 'red_flag', 'positive_signal'
    )),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for application_notes
CREATE INDEX IF NOT EXISTS idx_app_notes_application ON application_notes(application_id, created_at DESC);

-- ============================================
-- Table: notification_queue
-- Queues outbound notifications for delivery by WF4-NOTIFY.
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),

    -- Notification details
    notification_type VARCHAR(50) NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    subject VARCHAR(500),
    body_html TEXT,
    body_text TEXT,

    -- Delivery
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification_queue
CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON notification_queue(sent, priority, created_at)
    WHERE sent = false;

-- ============================================
-- Table: notification_log
-- Records all sent notifications for audit, throttling, and delivery tracking.
-- ============================================
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),

    -- Notification details
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'email',
    recipient VARCHAR(500) NOT NULL,
    subject VARCHAR(500),

    -- Context
    jobs_count INTEGER,
    notification_queue_id UUID REFERENCES notification_queue(id),

    -- Delivery status
    status VARCHAR(20) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
    resend_message_id VARCHAR(200),
    error_detail TEXT,

    -- Audit
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification_log
CREATE INDEX IF NOT EXISTS idx_notif_log_type ON notification_log(notification_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_application ON notification_log(application_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_recent ON notification_log(sent_at DESC);

-- ============================================
-- Table: sender_company_mappings
-- Stores confirmed email sender-to-company mappings to improve
-- email matching accuracy over time (learning loop).
-- ============================================
CREATE TABLE IF NOT EXISTS sender_company_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_domain VARCHAR(500) NOT NULL,
    sender_email VARCHAR(500),
    company_name VARCHAR(500) NOT NULL,
    company_domain VARCHAR(200),
    mapping_type VARCHAR(30) NOT NULL DEFAULT 'manual'
        CHECK (mapping_type IN ('manual', 'confirmed', 'ats_platform', 'recruitment_agency')),
    confidence INTEGER DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_sender_company UNIQUE (sender_email, company_name)
);

-- Indexes for sender_company_mappings
CREATE INDEX IF NOT EXISTS idx_sender_mappings_domain ON sender_company_mappings(sender_domain);
CREATE INDEX IF NOT EXISTS idx_sender_mappings_email ON sender_company_mappings(sender_email);

-- ============================================
-- Table: pipeline_track_config (Appendix A.2)
-- Configurable thresholds per pipeline track.
-- ============================================
CREATE TABLE IF NOT EXISTS pipeline_track_config (
    track VARCHAR(20) PRIMARY KEY,

    -- Follow-up thresholds (days)
    follow_up_applied INTEGER NOT NULL,
    follow_up_acknowledged INTEGER NOT NULL,
    follow_up_screening INTEGER NOT NULL,
    follow_up_interviewing INTEGER NOT NULL,

    -- Ghosting thresholds (days)
    ghost_applied INTEGER NOT NULL,
    ghost_acknowledged INTEGER NOT NULL,
    ghost_screening INTEGER NOT NULL,
    ghost_interviewing INTEGER NOT NULL,

    -- Max follow-ups per stage
    max_follow_ups INTEGER NOT NULL DEFAULT 2,

    -- Expected total pipeline duration (days)
    expected_pipeline_min_days INTEGER NOT NULL,
    expected_pipeline_max_days INTEGER NOT NULL,

    -- Audit
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data for pipeline_track_config
INSERT INTO pipeline_track_config VALUES
    ('corporate', 7, 10, 7, 7, 14, 21, 14, 14, 2, 21, 56),
    ('academic', 21, 28, 14, 21, 56, 56, 28, 42, 1, 90, 180)
ON CONFLICT (track) DO NOTHING;

-- ============================================
-- ALTER TABLE: jobs (Module 1) -- add Module 4 integration columns
-- ============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_state VARCHAR(30);

-- Indexes on jobs for Module 4 lookups
CREATE INDEX IF NOT EXISTS idx_jobs_application_id ON jobs(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_application_state ON jobs(application_state) WHERE application_state IS NOT NULL;

-- ============================================
-- Function: sync_application_state_to_jobs()
-- Trigger function to sync application state back to the jobs table.
-- ============================================
CREATE OR REPLACE FUNCTION sync_application_state_to_jobs()
RETURNS TRIGGER AS $$
BEGIN
    -- Guard: speculative applications have no job_id, skip sync
    IF NEW.job_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE jobs
    SET application_state = NEW.current_state,
        application_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.job_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: sync application state to jobs on insert/update
DROP TRIGGER IF EXISTS trigger_sync_app_state_to_jobs ON applications;
CREATE TRIGGER trigger_sync_app_state_to_jobs
AFTER INSERT OR UPDATE OF current_state ON applications
FOR EACH ROW EXECUTE FUNCTION sync_application_state_to_jobs();

COMMIT;
