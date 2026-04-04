-- ============================================
-- MODULE 7: LINKEDIN INTELLIGENCE
-- Database Schema Setup
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: linkedin_profile
-- LinkedIn profile data (manually entered or synced from master CV)
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_section TEXT NOT NULL,
    section_data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    completeness_score NUMERIC(5,2),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_profile_section ON linkedin_profile(profile_section);
CREATE INDEX IF NOT EXISTS idx_linkedin_profile_updated ON linkedin_profile(last_updated DESC);

-- ============================================
-- Table: linkedin_recommendations
-- LinkedIn profile optimization recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_type TEXT NOT NULL,
    content JSONB NOT NULL,
    rationale TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    implemented_at TIMESTAMPTZ,
    rejected_reason TEXT,
    generated_by TEXT NOT NULL DEFAULT 'wf7-2',
    model_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_recs_type ON linkedin_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_linkedin_recs_status ON linkedin_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_recs_created ON linkedin_recommendations(created_at DESC);

-- ============================================
-- Table: profile_completeness_history
-- Profile completeness scores (historical tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS profile_completeness_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_score NUMERIC(5,2) NOT NULL,
    section_scores JSONB NOT NULL,
    missing_elements JSONB DEFAULT '[]',
    improvement_suggestions JSONB DEFAULT '[]',
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completeness_scored_at ON profile_completeness_history(scored_at DESC);

-- ============================================
-- Table: recruiter_views
-- Recruiter profile views
-- ============================================
CREATE TABLE IF NOT EXISTS recruiter_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_name TEXT NOT NULL,
    viewer_title TEXT,
    viewer_company TEXT,
    viewer_industry TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    view_count INTEGER NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMPTZ NOT NULL,
    last_viewed_at TIMESTAMPTZ NOT NULL,
    category TEXT,
    company_research_id UUID,
    cross_reference_jobs JSONB DEFAULT '[]',
    priority TEXT NOT NULL DEFAULT 'low',
    action_recommended TEXT,
    action_taken BOOLEAN DEFAULT false,
    action_taken_at TIMESTAMPTZ,
    source_email_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_views_company ON recruiter_views(viewer_company);
CREATE INDEX IF NOT EXISTS idx_recruiter_views_category ON recruiter_views(category);
CREATE INDEX IF NOT EXISTS idx_recruiter_views_priority ON recruiter_views(priority);
CREATE INDEX IF NOT EXISTS idx_recruiter_views_last_viewed ON recruiter_views(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_views_name_company ON recruiter_views(viewer_name, viewer_company);

-- ============================================
-- Table: company_research
-- Company research (triggered by profile views or other signals)
-- ============================================
CREATE TABLE IF NOT EXISTS company_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    company_name_normalized TEXT NOT NULL,
    industry TEXT,
    company_size TEXT,
    uk_presence TEXT,
    ld_relevance_score NUMERIC(3,2),
    ld_team_indicators JSONB DEFAULT '[]',
    active_ld_listings INTEGER DEFAULT 0,
    historical_ld_listings INTEGER DEFAULT 0,
    research_summary TEXT,
    recommended_action TEXT,
    connection_request_template TEXT,
    researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_used TEXT DEFAULT 'claude-haiku',
    raw_research JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_research_name ON company_research(company_name_normalized);
CREATE INDEX IF NOT EXISTS idx_company_research_relevance ON company_research(ld_relevance_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_research_name_unique ON company_research(company_name_normalized);

-- ============================================
-- Table: linkedin_messages
-- LinkedIn InMail/message tracking
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_name TEXT NOT NULL,
    sender_title TEXT,
    sender_company TEXT,
    message_preview TEXT,
    category TEXT NOT NULL,
    requires_response BOOLEAN NOT NULL DEFAULT true,
    response_templates JSONB DEFAULT '[]',
    response_sent BOOLEAN DEFAULT false,
    response_sent_at TIMESTAMPTZ,
    company_research_id UUID,
    cross_reference_jobs JSONB DEFAULT '[]',
    source_email_id TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_messages_category ON linkedin_messages(category);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_received ON linkedin_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_response ON linkedin_messages(requires_response, response_sent);

-- ============================================
-- Table: linkedin_connection_requests
-- LinkedIn connection requests tracking
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_connection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_name TEXT NOT NULL,
    requester_title TEXT,
    requester_company TEXT,
    mutual_connections INTEGER DEFAULT 0,
    connection_note TEXT,
    category TEXT NOT NULL,
    action_recommended TEXT,
    acceptance_note_template TEXT,
    action_taken TEXT,
    action_taken_at TIMESTAMPTZ,
    source_email_id TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_category ON linkedin_connection_requests(category);
CREATE INDEX IF NOT EXISTS idx_connection_requests_received ON linkedin_connection_requests(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_requests_action ON linkedin_connection_requests(action_taken);

-- ============================================
-- Table: content_calendar
-- Content calendar for LinkedIn posts
-- ============================================
CREATE TABLE IF NOT EXISTS content_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_title TEXT NOT NULL,
    content_pillar TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    topic_angle TEXT,
    draft_text TEXT,
    final_text TEXT,
    hashtags JSONB DEFAULT '[]',
    suggested_post_day TEXT,
    suggested_post_time TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    rejection_reason TEXT,
    published_at TIMESTAMPTZ,
    engagement_data JSONB DEFAULT '{}',
    engagement_score NUMERIC(5,2),
    quality_scores JSONB DEFAULT '{}',
    prompt_version INTEGER,
    edit_distance NUMERIC(5,2),
    linkedin_post_url TEXT,
    content_format TEXT NOT NULL DEFAULT 'text_post',
    week_number INTEGER,
    year INTEGER,
    generated_by TEXT DEFAULT 'wf7-3',
    model_used TEXT DEFAULT 'claude-haiku',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_pillar ON content_calendar(content_pillar);
CREATE INDEX IF NOT EXISTS idx_content_calendar_week ON content_calendar(year, week_number);
CREATE INDEX IF NOT EXISTS idx_content_calendar_published ON content_calendar(published_at DESC);

-- ============================================
-- Table: content_engagement
-- Content engagement tracking (from notification emails)
-- ============================================
CREATE TABLE IF NOT EXISTS content_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_calendar_id UUID REFERENCES content_calendar(id),
    engagement_type TEXT NOT NULL,
    engager_name TEXT,
    engager_title TEXT,
    engager_company TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    post_snippet TEXT,
    source_email_id TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_engagement_calendar ON content_engagement(content_calendar_id);
CREATE INDEX IF NOT EXISTS idx_content_engagement_type ON content_engagement(engagement_type);
CREATE INDEX IF NOT EXISTS idx_content_engagement_received ON content_engagement(received_at DESC);

-- ============================================
-- Table: linkedin_metrics
-- LinkedIn metrics (manual input + email-derived)
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_period TEXT,
    metric_date DATE NOT NULL,
    source TEXT NOT NULL DEFAULT 'email',
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_metrics_type_date ON linkedin_metrics(metric_type, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_metrics_date ON linkedin_metrics(metric_date DESC);

-- ============================================
-- Table: profile_cv_alignment
-- Profile-CV alignment check results
-- ============================================
CREATE TABLE IF NOT EXISTS profile_cv_alignment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cv_identifier TEXT NOT NULL,
    cv_target_role TEXT,
    check_type TEXT NOT NULL DEFAULT 'automatic',
    discrepancies JSONB NOT NULL DEFAULT '[]',
    critical_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    info_count INTEGER NOT NULL DEFAULT 0,
    overall_status TEXT NOT NULL,
    ai_analysis TEXT,
    resolution_recommendations JSONB DEFAULT '[]',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alignment_status ON profile_cv_alignment(overall_status);
CREATE INDEX IF NOT EXISTS idx_alignment_checked ON profile_cv_alignment(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_alignment_cv ON profile_cv_alignment(cv_identifier);

-- ============================================
-- Table: search_appearances
-- Search appearance tracking
-- ============================================
CREATE TABLE IF NOT EXISTS search_appearances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_count INTEGER NOT NULL,
    period TEXT NOT NULL DEFAULT 'weekly',
    search_terms JSONB DEFAULT '[]',
    searcher_companies JSONB DEFAULT '[]',
    searcher_titles JSONB DEFAULT '[]',
    source_email_id TEXT,
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_appearances_reported ON search_appearances(reported_at DESC);

-- ============================================
-- Table: hashtag_library
-- Hashtag library for content strategy
-- ============================================
CREATE TABLE IF NOT EXISTS hashtag_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hashtag TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    estimated_reach TEXT,
    usage_count INTEGER DEFAULT 0,
    avg_engagement_when_used NUMERIC(5,2),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hashtag_library_category ON hashtag_library(category);
CREATE INDEX IF NOT EXISTS idx_hashtag_library_active ON hashtag_library(is_active);

-- ============================================
-- Table: linkedin_email_log
-- LinkedIn email processing log
-- ============================================
CREATE TABLE IF NOT EXISTS linkedin_email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_uid TEXT NOT NULL,
    message_id TEXT,
    from_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL,
    parse_status TEXT NOT NULL,
    entities_extracted INTEGER DEFAULT 0,
    error_message TEXT,
    raw_html TEXT,
    processing_time_ms INTEGER,
    fallback_used BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    prompt_version INTEGER,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_type ON linkedin_email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON linkedin_email_log(parse_status);
CREATE INDEX IF NOT EXISTS idx_email_log_processed ON linkedin_email_log(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_uid ON linkedin_email_log(email_uid);

-- ============================================
-- Table: prompt_templates
-- Prompt template versioning
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    model_target TEXT NOT NULL,
    notes TEXT,
    quality_scores JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(prompt_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates(prompt_name, version DESC);

-- ============================================
-- Table: candidate_voice_profile
-- Candidate voice profile (learned editing patterns)
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_voice_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preferred_phrases JSONB DEFAULT '[]',
    avoided_phrases JSONB DEFAULT '[]',
    structural_preferences TEXT,
    tone_notes TEXT,
    example_pairs JSONB DEFAULT '[]',
    analysis_summary TEXT,
    drafts_analyzed INTEGER DEFAULT 0,
    avg_edit_distance NUMERIC(5,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SEED DATA: Hashtag Library
-- ============================================
INSERT INTO hashtag_library (hashtag, category, estimated_reach) VALUES
('#LearningAndDevelopment', 'primary_ld', 'very_high'),
('#LandD', 'primary_ld', 'high'),
('#TalentDevelopment', 'primary_ld', 'high'),
('#LeadershipDevelopment', 'leadership', 'very_high'),
('#OrganisationalDevelopment', 'primary_ld', 'medium'),
('#CIPD', 'uk_specific', 'high'),
('#HRD', 'primary_ld', 'medium'),
('#PeopleDevelopment', 'hr_people', 'medium'),
('#TalentManagement', 'hr_people', 'high'),
('#EmployeeEngagement', 'hr_people', 'very_high'),
('#Leadership', 'leadership', 'very_high'),
('#HR', 'hr_people', 'very_high'),
('#FutureOfWork', 'broad_professional', 'very_high'),
('#WorkplaceLearning', 'niche_ld', 'medium'),
('#CoachingCulture', 'niche_ld', 'medium'),
('#ChangeManagement', 'broad_professional', 'high'),
('#Upskilling', 'niche_ld', 'high'),
('#Reskilling', 'niche_ld', 'high'),
('#DigitalLearning', 'ai_tech', 'medium'),
('#AIinHR', 'ai_tech', 'medium'),
('#AIinLearning', 'ai_tech', 'low'),
('#BlendedLearning', 'niche_ld', 'medium'),
('#PerformanceManagement', 'hr_people', 'high'),
('#SuccessionPlanning', 'hr_people', 'medium'),
('#DiversityAndInclusion', 'broad_professional', 'very_high'),
('#EDI', 'uk_specific', 'medium'),
('#UKJobs', 'uk_specific', 'high'),
('#HigherEducation', 'academic', 'high'),
('#HRM', 'academic', 'medium'),
('#PhDLife', 'academic', 'medium'),
('#AcademicTwitter', 'academic', 'medium'),
('#UFHRD', 'academic', 'low'),
('#LearningDesign', 'niche_ld', 'medium'),
('#InstructionalDesign', 'niche_ld', 'medium'),
('#TrainingAndDevelopment', 'primary_ld', 'high'),
('#ProfessionalDevelopment', 'broad_professional', 'very_high'),
('#ContinuousDevelopment', 'niche_ld', 'medium'),
('#ApprenticeshipLevy', 'uk_specific', 'low'),
('#SkillsGap', 'niche_ld', 'medium'),
('#LearningCulture', 'niche_ld', 'medium')
ON CONFLICT (hashtag) DO NOTHING;
