-- Module 4: Application Tracker & Pipeline Manager - Schema Migration
-- Date: 2026-03-29
-- Applied to: selvi_jobs database

BEGIN;

-- Ensure uuid-ossp is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure update_updated_at_column function exists (from Module 1)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. applications table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE RESTRICT,
    company_name VARCHAR(500) NOT NULL,
    job_title VARCHAR(500) NOT NULL,
    company_url TEXT,
    company_domain VARCHAR(200),
    reference_number VARCHAR(200),
    pipeline_track VARCHAR(20) NOT NULL CHECK (pipeline_track IN ('corporate', 'academic')),
    current_state VARCHAR(30) NOT NULL DEFAULT 'discovered'
        CHECK (current_state IN (
            'discovered', 'shortlisted', 'cv_tailored',
            'applied', 'acknowledged', 'academic_longlisted', 'academic_shortlisted',
            'screening', 'interviewing',
            'assessment', 'offer_received', 'negotiating', 'pre_employment',
            'accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired'
        )),
    highest_state_reached VARCHAR(30),
    previous_state VARCHAR(30),
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome VARCHAR(20) CHECK (outcome IN (
        'accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired'
    )),
    discovered_at TIMESTAMPTZ,
    shortlisted_at TIMESTAMPTZ,
    cv_tailored_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    academic_longlisted_at TIMESTAMPTZ,
    academic_shortlisted_at TIMESTAMPTZ,
    screening_at TIMESTAMPTZ,
    first_interview_at TIMESTAMPTZ,
    offer_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    application_method VARCHAR(30) CHECK (application_method IN (
        'auto_apply', 'manual_portal', 'manual_email', 'manual_linkedin',
        'recruitment_agency', 'direct_referral', 'speculative'
    )),
    application_url TEXT,
    portal_confirmation_id VARCHAR(200),
    cv_version_id UUID,
    cover_letter_id UUID,
    cv_filename VARCHAR(500),
    cover_letter_filename VARCHAR(500),
    additional_documents JSONB DEFAULT '[]'::jsonb,
    salary_offered_min INTEGER,
    salary_offered_max INTEGER,
    salary_negotiated INTEGER,
    salary_notes TEXT,
    follow_up_count INTEGER DEFAULT 0,
    last_follow_up_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    follow_up_snoozed_until TIMESTAMPTZ,
    ghosting_detected_at TIMESTAMPTZ,
    interview_count INTEGER DEFAULT 0,
    last_interview_at TIMESTAMPTZ,
    interview_notes TEXT,
    has_referral BOOLEAN DEFAULT false,
    referral_name VARCHAR(200),
    referral_relationship VARCHAR(200),
    discovery_source VARCHAR(50),
    candidate_notes TEXT,
    rejection_reason VARCHAR(50),
    rejection_detail TEXT,
    is_active BOOLEAN GENERATED ALWAYS AS (
        current_state NOT IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    application_attempt INTEGER NOT NULL DEFAULT 1,
    previous_application_id UUID REFERENCES applications(id),
    recruitment_agency VARCHAR(200),
    recruiter_name VARCHAR(200),
    recruiter_email VARCHAR(500),
    compensation JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_active_job_application UNIQUE (job_id, application_attempt)
);

CREATE INDEX IF NOT EXISTS idx_applications_state ON applications(current_state) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_applications_track ON applications(pipeline_track) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_applications_applied ON applications(applied_at DESC) WHERE applied_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_domain);
CREATE INDEX IF NOT EXISTS idx_applications_company_name ON applications(company_name);
CREATE INDEX IF NOT EXISTS idx_applications_follow_up ON applications(next_follow_up_at) WHERE is_active = true AND next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_ghosting ON applications(state_changed_at) WHERE is_active = true AND current_state IN ('applied', 'acknowledged', 'screening', 'interviewing');
CREATE INDEX IF NOT EXISTS idx_applications_cv_version ON applications(cv_version_id);
CREATE INDEX IF NOT EXISTS idx_applications_outcome ON applications(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_active_company ON applications(company_name) WHERE is_active = true;

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. application_events table
CREATE TABLE IF NOT EXISTS application_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_source VARCHAR(50) NOT NULL CHECK (event_source IN (
        'module_1', 'module_2', 'module_3', 'module_5',
        'wf4_status', 'wf4_ghost', 'wf4_notify', 'wf4_metrics',
        'manual_email', 'manual_input', 'system'
    )),
    event_data JSONB DEFAULT '{}'::jsonb,
    from_state VARCHAR(30),
    to_state VARCHAR(30),
    is_valid_transition BOOLEAN DEFAULT true,
    email_id VARCHAR(500),
    email_from VARCHAR(500),
    email_subject VARCHAR(500),
    email_received_at TIMESTAMPTZ,
    match_confidence INTEGER,
    notes TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_application ON application_events(application_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON application_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_occurred ON application_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_source ON application_events(event_source);

-- 3. application_documents table
CREATE TABLE IF NOT EXISTS application_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN (
        'cv', 'cover_letter', 'academic_cv', 'research_statement',
        'teaching_philosophy', 'reference_letter', 'portfolio', 'other'
    )),
    document_version VARCHAR(50),
    filename VARCHAR(500) NOT NULL,
    file_path TEXT,
    file_size_bytes INTEGER,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    tailoring_score INTEGER,
    tailoring_notes TEXT,
    base_template VARCHAR(100),
    sent_at TIMESTAMPTZ,
    response_received BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_docs_application ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_type ON application_documents(document_type);

-- 4. application_interviews table
CREATE TABLE IF NOT EXISTS application_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    interview_type VARCHAR(30) NOT NULL CHECK (interview_type IN (
        'phone_screen', 'video_call', 'in_person', 'panel',
        'teaching_presentation', 'case_study', 'assessment_centre',
        'psychometric_test', 'technical_exercise', 'informal_chat'
    )),
    interview_format VARCHAR(50),
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    location TEXT,
    platform VARCHAR(50),
    interviewers JSONB DEFAULT '[]'::jsonb,
    preparation_notes TEXT,
    documents_to_bring JSONB DEFAULT '[]'::jsonb,
    presentation_topic TEXT,
    presentation_duration_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
    outcome VARCHAR(20) CHECK (outcome IN ('passed', 'failed', 'pending', 'unknown')),
    feedback TEXT,
    candidate_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_interviews_application ON application_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_app_interviews_scheduled ON application_interviews(scheduled_at) WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS update_app_interviews_updated_at ON application_interviews;
CREATE TRIGGER update_app_interviews_updated_at BEFORE UPDATE ON application_interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. application_pre_employment table
CREATE TABLE IF NOT EXISTS application_pre_employment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    dbs_required BOOLEAN DEFAULT false,
    dbs_type VARCHAR(30) CHECK (dbs_type IN ('basic', 'standard', 'enhanced', 'enhanced_with_barring')),
    dbs_submitted_at TIMESTAMPTZ,
    dbs_completed_at TIMESTAMPTZ,
    dbs_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (dbs_status IN ('not_required', 'pending', 'submitted', 'processing', 'cleared')),
    rtw_required BOOLEAN DEFAULT true,
    rtw_verified BOOLEAN DEFAULT false,
    rtw_document_type VARCHAR(50),
    rtw_verified_at TIMESTAMPTZ,
    references_required INTEGER DEFAULT 2,
    references_received INTEGER DEFAULT 0,
    references_details JSONB DEFAULT '[]'::jsonb,
    quals_verification_required BOOLEAN DEFAULT false,
    quals_verification_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (quals_verification_status IN ('not_required', 'pending', 'submitted', 'verified', 'issues_found')),
    quals_details JSONB DEFAULT '{}'::jsonb,
    occ_health_required BOOLEAN DEFAULT false,
    occ_health_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (occ_health_status IN ('not_required', 'pending', 'submitted', 'cleared', 'issues_found')),
    hesa_required BOOLEAN DEFAULT false,
    hesa_submitted BOOLEAN DEFAULT false,
    hesa_data JSONB DEFAULT '{}'::jsonb,
    all_checks_complete BOOLEAN DEFAULT false,
    expected_start_date DATE,
    actual_start_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_pre_emp_application ON application_pre_employment(application_id);

DROP TRIGGER IF EXISTS update_app_pre_emp_updated_at ON application_pre_employment;
CREATE TRIGGER update_app_pre_emp_updated_at BEFORE UPDATE ON application_pre_employment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. pipeline_metrics table
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}'::jsonb,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) DEFAULT 'snapshot'
        CHECK (period_type IN ('snapshot', 'daily', 'weekly', 'monthly')),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_name ON pipeline_metrics(metric_name, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_period ON pipeline_metrics(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_dimensions ON pipeline_metrics USING gin(dimensions);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_metrics_upsert ON pipeline_metrics(metric_name, period_start, period_type, dimensions);

-- 7. follow_up_log table
CREATE TABLE IF NOT EXISTS follow_up_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN (
        'initial_follow_up', 'second_follow_up', 'ghosting_warning',
        'deadline_approaching', 'status_check', 'interview_prep', 'custom'
    )),
    suggested_action TEXT,
    follow_up_template TEXT,
    sent_at TIMESTAMPTZ,
    sent_via VARCHAR(20) DEFAULT 'email',
    notification_id UUID,
    candidate_action VARCHAR(30) CHECK (candidate_action IN (
        'followed_up', 'snoozed', 'dismissed', 'marked_ghosted', 'no_action'
    )),
    candidate_action_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_application ON follow_up_log(application_id, created_at DESC);

-- 8. application_notes table
CREATE TABLE IF NOT EXISTS application_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    note_type VARCHAR(30) DEFAULT 'general' CHECK (note_type IN (
        'general', 'interview_prep', 'interview_feedback', 'research',
        'follow_up', 'salary', 'contact', 'red_flag', 'positive_signal'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notes_application ON application_notes(application_id, created_at DESC);

-- 9. notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),
    notification_type VARCHAR(50) NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    subject VARCHAR(500),
    body_html TEXT,
    body_text TEXT,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON notification_queue(sent, priority, created_at) WHERE sent = false;

-- 10. notification_log table
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'email',
    recipient VARCHAR(500) NOT NULL,
    subject VARCHAR(500),
    jobs_count INTEGER,
    notification_queue_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
    resend_message_id VARCHAR(200),
    error_detail TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_type ON notification_log(notification_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_application ON notification_log(application_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_recent ON notification_log(sent_at DESC);

-- 11. sender_company_mappings table
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

CREATE INDEX IF NOT EXISTS idx_sender_mappings_domain ON sender_company_mappings(sender_domain);

-- 12. Add Module 4 columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_state VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_jobs_application_id ON jobs(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_application_state ON jobs(application_state) WHERE application_state IS NOT NULL;

-- Trigger: sync application state back to jobs table
CREATE OR REPLACE FUNCTION sync_application_state_to_jobs()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_sync_app_state_to_jobs ON applications;
CREATE TRIGGER trigger_sync_app_state_to_jobs
AFTER INSERT OR UPDATE OF current_state ON applications
FOR EACH ROW EXECUTE FUNCTION sync_application_state_to_jobs();

-- State transition function
CREATE OR REPLACE FUNCTION transition_application_state(
    p_app_id UUID,
    p_new_state VARCHAR(30),
    p_event_type VARCHAR(50),
    p_event_source VARCHAR(50),
    p_event_data JSONB DEFAULT '{}'::jsonb,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_state VARCHAR(30);
    v_previous_state VARCHAR(30);
    v_track VARCHAR(20);
BEGIN
    SELECT current_state, previous_state, pipeline_track
    INTO v_current_state, v_previous_state, v_track
    FROM applications WHERE id = p_app_id FOR UPDATE;

    IF NOT FOUND THEN RETURN false; END IF;

    -- Update application
    UPDATE applications SET
        previous_state = current_state,
        current_state = p_new_state,
        state_changed_at = NOW(),
        highest_state_reached = CASE
            WHEN highest_state_reached IS NULL THEN p_new_state
            ELSE highest_state_reached
        END,
        outcome = CASE
            WHEN p_new_state IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
            THEN p_new_state ELSE outcome
        END,
        resolved_at = CASE
            WHEN p_new_state IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
            THEN NOW() ELSE resolved_at
        END,
        ghosting_detected_at = CASE
            WHEN p_new_state = 'ghosted' THEN NOW() ELSE ghosting_detected_at
        END,
        acknowledged_at = CASE WHEN p_new_state = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
        screening_at = CASE WHEN p_new_state = 'screening' THEN NOW() ELSE screening_at END,
        first_interview_at = CASE WHEN p_new_state = 'interviewing' AND first_interview_at IS NULL THEN NOW() ELSE first_interview_at END,
        offer_at = CASE WHEN p_new_state = 'offer_received' THEN NOW() ELSE offer_at END,
        academic_longlisted_at = CASE WHEN p_new_state = 'academic_longlisted' THEN NOW() ELSE academic_longlisted_at END,
        academic_shortlisted_at = CASE WHEN p_new_state = 'academic_shortlisted' THEN NOW() ELSE academic_shortlisted_at END
    WHERE id = p_app_id;

    -- Insert event
    INSERT INTO application_events (
        application_id, event_type, event_source, event_data,
        from_state, to_state, notes
    ) VALUES (
        p_app_id, p_event_type, p_event_source, p_event_data,
        v_current_state, p_new_state, p_notes
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMIT;
