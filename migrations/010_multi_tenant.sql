-- Multi-tenant migration for JobPilot
-- Date: 2026-04-04

-- Step 1: Create tenants table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(500) NOT NULL UNIQUE,
    notification_email VARCHAR(500),
    gmail_credential_id VARCHAR(200),
    candidate_profile JSONB DEFAULT '{}',
    search_config JSONB DEFAULT '{}',
    email_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Selvi as first tenant
INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
VALUES (
    'Selvi Kumar',
    'selvi',
    'chellamma.uk@gmail.com',
    'chellamma.uk@gmail.com',
    '{"full_name": "Selvi Kumar", "phone": "+44 xxxx", "city": "Maidenhead", "county": "Berkshire", "postcode": "SL6", "country": "United Kingdom", "right_to_work": "Yes - Settled Status", "expected_salary": "GBP 70,000 - 80,000", "current_title": "L&D Consultant", "highest_education": "PhD"}',
    '{"keywords": ["learning development", "L&D manager", "organisational development", "talent development"], "location": "Maidenhead, Berkshire", "salary_min": 70000, "salary_max": 80000, "sources": ["adzuna", "reed", "rss", "linkedin"], "job_types": ["corporate_ld", "academic"]}',
    '{"from_name": "Selvi Kumar", "from_email": "jobs@apiloom.io", "reply_to": "chellamma.uk@gmail.com"}',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Step 2: Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(200) UNIQUE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(500) NOT NULL,
    display_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create tenant_config table
CREATE TABLE IF NOT EXISTS tenant_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    config_key VARCHAR(200) NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, config_key)
);

-- Step 4: Add tenant_id to all data tables
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_interviews ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_pre_employment ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_notes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_status_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE application_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE follow_up_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sender_company_mappings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_classifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_extracted_data ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE recruiter_role_proposals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE interview_debriefs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE prep_briefs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE company_research ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE travel_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE interview_communications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE interview_questions_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE salary_research ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE content_engagement ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_profile ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_recommendations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profile_completeness_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE recruiter_views ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_connection_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profile_cv_alignment ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE search_appearances ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE linkedin_email_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE cv_packages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE known_contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE email_suppressions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE document_library ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE hashtag_library ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE candidate_voice_profile ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Step 4b: Backfill tenant_id with Selvi's ID
UPDATE jobs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE applications SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_events SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_documents SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_interviews SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_pre_employment SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_notes SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_status_history SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE application_metrics SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE follow_up_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE notification_queue SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE notification_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE sender_company_mappings SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE emails SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_classifications SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_extracted_data SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_threads SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_drafts SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_notifications SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_processing_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE recruiter_contacts SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE recruiter_role_proposals SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE interviews SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE interview_debriefs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE prep_briefs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE company_research SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE travel_plans SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE interview_communications SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE interview_questions_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE salary_research SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE content_calendar SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE content_engagement SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_profile SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_recommendations SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE profile_completeness_history SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE recruiter_views SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_messages SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_connection_requests SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_metrics SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE profile_cv_alignment SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE search_appearances SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE linkedin_email_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE pipeline_metrics SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE cv_packages SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE jd_analyses SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE known_contacts SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE email_suppressions SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE document_library SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE hashtag_library SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE candidate_voice_profile SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;
UPDATE prompt_templates SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL;

-- Step 5: Seed Venkat as second tenant
INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
VALUES (
    'Venkat Ramachandran',
    'venkat',
    'venkat.fts@gmail.com',
    'venkat.fts@gmail.com',
    '{"full_name": "Venkat Ramachandran", "city": "London", "country": "United Kingdom"}',
    '{"keywords": ["software engineer", "tech lead", "platform engineering"], "location": "London, UK", "salary_min": 90000, "salary_max": 130000, "sources": ["adzuna", "reed", "linkedin"]}',
    '{"from_name": "Venkat Ramachandran", "from_email": "jobs@apiloom.io", "reply_to": "venkat.fts@gmail.com"}',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Step 6: Composite indexes
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_tenant ON emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_tenant ON interviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_tenant ON pipeline_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_tenant ON content_calendar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant ON notification_queue(tenant_id);
