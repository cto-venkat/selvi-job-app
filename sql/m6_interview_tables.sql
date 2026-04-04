-- ============================================
-- MODULE 6: INTERVIEW SCHEDULING & PREPARATION
-- Database Schema Setup
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: interviews
-- Primary record for each interview event
-- ============================================
CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID,
    job_id UUID REFERENCES jobs(id),
    company_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    interview_track TEXT NOT NULL CHECK (interview_track IN ('corporate', 'academic')),
    interview_format TEXT NOT NULL CHECK (interview_format IN (
        'phone_screen', 'phone_interview', 'video_interview',
        'in_person', 'panel_interview', 'presentation',
        'teaching_demo', 'assessment_centre', 'academic_selection_day',
        'group_exercise', 'psychometric', 'other'
    )),
    interview_stage TEXT CHECK (interview_stage IN (
        'phone_screen', 'first_round', 'second_round',
        'final_round', 'assessment_centre', 'other'
    )),
    interview_date DATE,
    interview_start_time TIME,
    interview_end_time TIME,
    interview_timezone TEXT DEFAULT 'Europe/London',
    interview_duration_minutes INTEGER DEFAULT 60,
    is_all_day BOOLEAN DEFAULT false,
    location_type TEXT CHECK (location_type IN ('remote', 'in_person', 'hybrid')),
    physical_address TEXT,
    building_details TEXT,
    postcode TEXT,
    video_platform TEXT,
    video_link TEXT,
    video_password TEXT,
    video_phone_dial_in TEXT,
    scheduling_link TEXT,
    scheduling_platform TEXT,
    scheduling_deadline TIMESTAMPTZ,
    interviewer_names TEXT[],
    interviewer_titles TEXT[],
    interviewer_emails TEXT[],
    panel_size INTEGER,
    recruiter_name TEXT,
    recruiter_company TEXT,
    recruiter_email TEXT,
    recruiter_phone TEXT,
    dress_code TEXT,
    what_to_prepare TEXT,
    what_to_bring TEXT,
    additional_instructions TEXT,
    status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN (
        'detected', 'parsed', 'pending_confirmation', 'needs_scheduling', 'calendared',
        'conflict', 'prep_ready', 'confirmed', 'completed',
        'debriefed', 'outcome_known', 'cancelled_by_employer',
        'cancelled_by_candidate', 'rescheduled', 'no_show'
    )),
    prep_failed BOOLEAN DEFAULT false,
    prep_failed_at TIMESTAMPTZ,
    prep_failed_reason TEXT,
    calendar_event_id TEXT,
    prep_block_event_id TEXT,
    travel_event_id TEXT,
    source_email_id TEXT,
    detection_confidence NUMERIC(3,2),
    detection_method TEXT CHECK (detection_method IN ('auto', 'manual')),
    outcome TEXT CHECK (outcome IN (
        'pending', 'progressed', 'offered', 'offer_accepted',
        'offer_declined', 'offer_negotiating', 'rejected',
        'withdrawn', 'no_response'
    )) DEFAULT 'pending',
    outcome_date TIMESTAMPTZ,
    outcome_notes TEXT,
    rejection_reason TEXT,
    offer_salary_amount NUMERIC(10,2),
    offer_salary_currency TEXT DEFAULT 'GBP',
    offer_details JSONB,
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    parsed_at TIMESTAMPTZ,
    calendared_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_company ON interviews(company_name);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(interview_date);
CREATE INDEX IF NOT EXISTS idx_interviews_outcome ON interviews(outcome);
CREATE INDEX IF NOT EXISTS idx_interviews_track ON interviews(interview_track);
CREATE INDEX IF NOT EXISTS idx_interviews_calendar_event ON interviews(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interviews_source_email ON interviews(source_email_id) WHERE source_email_id IS NOT NULL;


-- ============================================
-- Table: interview_debriefs
-- ============================================
CREATE TABLE IF NOT EXISTS interview_debriefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    questions_asked TEXT,
    performance_notes TEXT,
    company_impression TEXT,
    red_flags TEXT,
    salary_discussed TEXT,
    next_steps_mentioned TEXT,
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    would_accept_offer BOOLEAN,
    raw_debrief_text TEXT,
    source TEXT CHECK (source IN ('email_reply', 'manual', 'structured_form')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debriefs_interview_id ON interview_debriefs(interview_id);


-- ============================================
-- Table: prep_briefs
-- ============================================
CREATE TABLE IF NOT EXISTS prep_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    company_overview TEXT,
    role_analysis TEXT,
    candidate_fit TEXT,
    likely_questions JSONB,
    questions_to_ask JSONB,
    salary_intelligence TEXT,
    logistics_and_format TEXT,
    final_checklist TEXT,
    full_brief_text TEXT NOT NULL,
    brief_format TEXT DEFAULT 'markdown',
    specificity_score NUMERIC(3,2),
    coverage_score NUMERIC(3,2),
    overall_quality_score NUMERIC(3,2),
    generation_attempts INTEGER DEFAULT 1,
    model_used TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    generation_cost_usd NUMERIC(8,6),
    generation_duration_seconds INTEGER,
    delivered_at TIMESTAMPTZ,
    delivery_method TEXT DEFAULT 'email',
    delivery_lead_time_hours NUMERIC(6,2),
    candidate_rating INTEGER CHECK (candidate_rating BETWEEN 1 AND 5),
    candidate_feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prep_briefs_interview_id ON prep_briefs(interview_id);


-- ============================================
-- Table: company_research
-- ============================================
CREATE TABLE IF NOT EXISTS company_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    company_name_normalised TEXT NOT NULL,
    company_website TEXT,
    company_domain TEXT,
    research_data JSONB NOT NULL,
    research_sources TEXT[],
    research_completeness TEXT CHECK (research_completeness IN ('full', 'partial', 'minimal')),
    researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    news_refreshed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    firecrawl_calls_used INTEGER DEFAULT 0,
    api_cost_usd NUMERIC(8,6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_research_name ON company_research(company_name_normalised);
CREATE INDEX IF NOT EXISTS idx_company_research_domain ON company_research(company_domain);
CREATE INDEX IF NOT EXISTS idx_company_research_expires ON company_research(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_research_unique ON company_research(company_name_normalised);


-- ============================================
-- Table: travel_plans
-- ============================================
CREATE TABLE IF NOT EXISTS travel_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    origin TEXT NOT NULL DEFAULT 'Maidenhead Railway Station, SL6 1PZ',
    destination TEXT NOT NULL,
    destination_postcode TEXT,
    travel_options JSONB NOT NULL,
    recommended_mode TEXT,
    recommended_departure_time TIME,
    estimated_duration_minutes INTEGER,
    estimated_cost_gbp NUMERIC(8,2),
    travel_event_id TEXT,
    is_peak_travel BOOLEAN,
    peak_cost_gbp NUMERIC(8,2),
    off_peak_cost_gbp NUMERIC(8,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_plans_interview_id ON travel_plans(interview_id);


-- ============================================
-- Table: interview_communications
-- ============================================
CREATE TABLE IF NOT EXISTS interview_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    communication_type TEXT NOT NULL CHECK (communication_type IN (
        'thank_you_draft', 'follow_up_draft', 'acknowledgement_draft',
        'rescheduling_draft', 'withdrawal_draft', 'thank_you_sent',
        'follow_up_sent', 'debrief_reminder'
    )),
    subject TEXT,
    body TEXT NOT NULL,
    recipient_name TEXT,
    recipient_email TEXT,
    draft_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    is_sent BOOLEAN DEFAULT false,
    model_used TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_comms_interview_id ON interview_communications(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_comms_type ON interview_communications(communication_type);


-- ============================================
-- Table: interview_questions_log
-- ============================================
CREATE TABLE IF NOT EXISTS interview_questions_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_category TEXT CHECK (question_category IN (
        'competency', 'situational', 'motivation', 'technical',
        'behavioural', 'cultural_fit', 'salary', 'right_to_work',
        'availability', 'other'
    )),
    response_quality INTEGER CHECK (response_quality BETWEEN 1 AND 5),
    response_notes TEXT,
    was_predicted BOOLEAN,
    star_example_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_log_interview_id ON interview_questions_log(interview_id);
CREATE INDEX IF NOT EXISTS idx_questions_log_category ON interview_questions_log(question_category);


-- ============================================
-- Table: salary_research
-- ============================================
CREATE TABLE IF NOT EXISTS salary_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_title TEXT NOT NULL,
    role_title_normalised TEXT NOT NULL,
    location TEXT,
    industry TEXT,
    company_size TEXT,
    sector TEXT CHECK (sector IN ('corporate', 'academic', 'public_sector', 'charity')),
    salary_min NUMERIC(10,2),
    salary_max NUMERIC(10,2),
    salary_median NUMERIC(10,2),
    salary_currency TEXT DEFAULT 'GBP',
    academic_grade TEXT,
    spine_point_min INTEGER,
    spine_point_max INTEGER,
    typical_bonus_percentage NUMERIC(5,2),
    typical_pension_percentage NUMERIC(5,2),
    typical_holidays_days INTEGER,
    benefits_notes TEXT,
    data_sources TEXT[],
    source_data JSONB,
    researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_research_role ON salary_research(role_title_normalised);
CREATE INDEX IF NOT EXISTS idx_salary_research_sector ON salary_research(sector);
CREATE INDEX IF NOT EXISTS idx_salary_research_expires ON salary_research(expires_at);


-- ============================================
-- Table: interview_config
-- ============================================
CREATE TABLE IF NOT EXISTS interview_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO interview_config (config_key, config_value, description) VALUES
('candidate_location', '"Maidenhead Railway Station, SL6 1PZ"', 'Default origin for travel calculations'),
('candidate_postcode', '"SL6 1PZ"', 'Candidate postcode'),
('candidate_email', '"chellamma.uk@gmail.com"', 'Candidate email address'),
('prep_block_duration_minutes', '120', 'Default preparation block duration'),
('interview_buffer_minutes', '90', 'Minimum gap between same-day interviews'),
('travel_arrival_buffer_minutes', '15', 'Minutes to arrive before interview'),
('thank_you_delay_minutes', '90', 'Minutes after interview to generate thank-you'),
('debrief_reminder_delay_minutes', '60', 'Minutes after interview to send debrief reminder'),
('follow_up_days', '10', 'Business days before sending follow-up email'),
('calendar_colour_corporate', '"9"', 'Google Calendar colour ID for corporate interviews'),
('calendar_colour_academic', '"10"', 'Google Calendar colour ID for academic interviews'),
('calendar_colour_prep', '"5"', 'Google Calendar colour ID for prep blocks'),
('calendar_colour_travel', '"6"', 'Google Calendar colour ID for travel blocks'),
('max_firecrawl_calls_per_company', '5', 'Maximum Firecrawl API calls per company research'),
('research_cache_days', '30', 'Days before company research expires'),
('salary_cache_days', '90', 'Days before salary research expires'),
('daily_briefing_time', '"07:30"', 'Time for daily interview briefing email'),
('notification_email_from', '"jobs@apiloom.io"', 'From address for Module 6 emails')
ON CONFLICT (config_key) DO NOTHING;


-- ============================================
-- Trigger: auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_m6_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_interviews_updated_at') THEN
        CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_debriefs_updated_at') THEN
        CREATE TRIGGER update_debriefs_updated_at BEFORE UPDATE ON interview_debriefs FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_prep_briefs_updated_at') THEN
        CREATE TRIGGER update_prep_briefs_updated_at BEFORE UPDATE ON prep_briefs FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_company_research_updated_at') THEN
        CREATE TRIGGER update_company_research_updated_at BEFORE UPDATE ON company_research FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_travel_plans_updated_at') THEN
        CREATE TRIGGER update_travel_plans_updated_at BEFORE UPDATE ON travel_plans FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_interview_comms_updated_at') THEN
        CREATE TRIGGER update_interview_comms_updated_at BEFORE UPDATE ON interview_communications FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_salary_research_updated_at') THEN
        CREATE TRIGGER update_salary_research_updated_at BEFORE UPDATE ON salary_research FOR EACH ROW EXECUTE FUNCTION update_m6_updated_at_column();
    END IF;
END $$;


-- ============================================
-- Views for common queries
-- ============================================

CREATE OR REPLACE VIEW v_upcoming_interviews AS
SELECT
    i.id,
    i.company_name,
    i.role_title,
    i.interview_track,
    i.interview_format,
    i.interview_stage,
    i.interview_date,
    i.interview_start_time,
    i.interview_end_time,
    i.status,
    i.location_type,
    i.physical_address,
    i.video_platform,
    i.video_link,
    i.interviewer_names,
    pb.id AS prep_brief_id,
    pb.overall_quality_score AS prep_quality,
    pb.delivered_at AS prep_delivered,
    tp.recommended_departure_time,
    tp.recommended_mode AS travel_mode,
    tp.estimated_duration_minutes AS travel_minutes
FROM interviews i
LEFT JOIN prep_briefs pb ON pb.interview_id = i.id
LEFT JOIN travel_plans tp ON tp.interview_id = i.id
WHERE i.interview_date >= CURRENT_DATE
  AND i.status NOT IN ('cancelled_by_employer', 'cancelled_by_candidate', 'no_show')
ORDER BY i.interview_date, i.interview_start_time;


CREATE OR REPLACE VIEW v_interview_pipeline AS
SELECT
    i.interview_track,
    i.status,
    i.outcome,
    COUNT(*) AS count,
    AVG(EXTRACT(EPOCH FROM (i.completed_at - i.detected_at)) / 3600) AS avg_hours_detect_to_complete,
    AVG(EXTRACT(EPOCH FROM (i.outcome_date - i.completed_at)) / 86400) AS avg_days_to_outcome
FROM interviews i
WHERE i.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY i.interview_track, i.status, i.outcome
ORDER BY i.interview_track, i.status;


CREATE OR REPLACE VIEW v_company_interview_history AS
SELECT
    i.company_name,
    COUNT(*) AS total_interviews,
    COUNT(*) FILTER (WHERE i.outcome = 'progressed') AS progressed,
    COUNT(*) FILTER (WHERE i.outcome = 'offered') AS offers,
    COUNT(*) FILTER (WHERE i.outcome = 'rejected') AS rejections,
    MAX(i.interview_date) AS last_interview_date,
    ARRAY_AGG(DISTINCT i.role_title) AS roles_interviewed_for,
    cr.research_completeness,
    cr.researched_at AS last_research_date
FROM interviews i
LEFT JOIN company_research cr ON cr.company_name_normalised = LOWER(REGEXP_REPLACE(i.company_name, '\s+(Ltd|PLC|LLP|Limited|Inc)\.?$', '', 'i'))
GROUP BY i.company_name, cr.research_completeness, cr.researched_at
ORDER BY MAX(i.interview_date) DESC;


CREATE OR REPLACE VIEW v_question_patterns AS
SELECT
    ql.question_category,
    ql.question_text,
    COUNT(*) AS times_asked,
    AVG(ql.response_quality) AS avg_response_quality,
    ARRAY_AGG(DISTINCT i.company_name) AS asked_by_companies,
    ARRAY_AGG(DISTINCT i.interview_track) AS asked_in_tracks,
    BOOL_OR(ql.was_predicted) AS ever_predicted
FROM interview_questions_log ql
JOIN interviews i ON i.id = ql.interview_id
GROUP BY ql.question_category, ql.question_text
ORDER BY COUNT(*) DESC;
