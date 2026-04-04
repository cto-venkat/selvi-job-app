#!/usr/bin/env python3
"""Multi-tenant database migration for JobPilot."""

import urllib.request
import json
import time
import sys

WEBHOOK_URL = "https://n8n.deploy.apiloom.io/webhook/run-sql-migration"

def run_sql(sql, label=""):
    """Execute SQL via webhook and return result."""
    data = json.dumps({"sql": sql}).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body) if body else {}
            status = "OK"
    except Exception as e:
        result = str(e)
        status = "ERROR"

    print(f"  [{status}] {label}")
    if status == "ERROR":
        print(f"    -> {result}")
    return status


def main():
    results = {"ok": 0, "error": 0}

    def execute(sql, label):
        s = run_sql(sql, label)
        if s == "OK":
            results["ok"] += 1
        else:
            results["error"] += 1
        time.sleep(0.3)

    # =========================================
    # STEP 1: Create tenants table
    # =========================================
    print("\n=== STEP 1: Create tenants table ===")
    execute(
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
        "Enable uuid-ossp extension"
    )
    execute(
        """CREATE TABLE IF NOT EXISTS tenants (
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
        )""",
        "Create tenants table"
    )

    # Seed Selvi
    print("\n=== STEP 1b: Seed Selvi tenant ===")
    execute(
        """INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
        VALUES (
            'Selvi Kumar',
            'selvi',
            'chellamma.uk@gmail.com',
            'chellamma.uk@gmail.com',
            '{"full_name": "Selvi Kumar", "phone": "+44 xxxx", "city": "Maidenhead", "county": "Berkshire", "postcode": "SL6", "country": "United Kingdom", "right_to_work": "Yes - Settled Status", "expected_salary": "GBP 70,000 - 80,000", "current_title": "L&D Consultant", "highest_education": "PhD"}',
            '{"keywords": ["learning development", "L&D manager", "organisational development", "talent development"], "location": "Maidenhead, Berkshire", "salary_min": 70000, "salary_max": 80000, "sources": ["adzuna", "reed", "rss", "linkedin"], "job_types": ["corporate_ld", "academic"]}',
            '{"from_name": "Selvi Kumar", "from_email": "jobs@apiloom.io", "reply_to": "chellamma.uk@gmail.com"}',
            true
        ) ON CONFLICT (slug) DO NOTHING""",
        "Seed Selvi tenant"
    )

    # =========================================
    # STEP 2: Create users table
    # =========================================
    print("\n=== STEP 2: Create users table ===")
    execute(
        """CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            clerk_user_id VARCHAR(200) UNIQUE,
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            email VARCHAR(500) NOT NULL,
            display_name VARCHAR(200),
            role VARCHAR(20) DEFAULT 'owner',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""",
        "Create users table"
    )

    # =========================================
    # STEP 3: Create tenant_config table
    # =========================================
    print("\n=== STEP 3: Create tenant_config table ===")
    execute(
        """CREATE TABLE IF NOT EXISTS tenant_config (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            config_key VARCHAR(200) NOT NULL,
            config_value JSONB NOT NULL,
            description TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, config_key)
        )""",
        "Create tenant_config table"
    )

    # =========================================
    # STEP 4: Add tenant_id to ALL data tables
    # =========================================
    print("\n=== STEP 4: Add tenant_id column to data tables ===")

    tables = [
        "jobs",
        "applications",
        "application_events",
        "application_documents",
        "application_interviews",
        "application_pre_employment",
        "application_notes",
        "application_status_history",
        "application_metrics",
        "follow_up_log",
        "notification_queue",
        "notification_log",
        "sender_company_mappings",
        "emails",
        "email_classifications",
        "email_extracted_data",
        "email_threads",
        "email_drafts",
        "email_notifications",
        "email_processing_log",
        "recruiter_contacts",
        "recruiter_role_proposals",
        "interviews",
        "interview_debriefs",
        "prep_briefs",
        "company_research",
        "travel_plans",
        "interview_communications",
        "interview_questions_log",
        "salary_research",
        "content_calendar",
        "content_engagement",
        "linkedin_profile",
        "linkedin_recommendations",
        "profile_completeness_history",
        "recruiter_views",
        "linkedin_messages",
        "linkedin_connection_requests",
        "linkedin_metrics",
        "profile_cv_alignment",
        "search_appearances",
        "linkedin_email_log",
        "pipeline_metrics",
        "cv_packages",
        "jd_analyses",
        "known_contacts",
        "email_suppressions",
        "document_library",
        "hashtag_library",
        "candidate_voice_profile",
        "prompt_templates",
    ]

    for table in tables:
        execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)",
            f"Add tenant_id to {table}"
        )

    # Backfill all tables
    print("\n=== STEP 4b: Backfill tenant_id with Selvi's ID ===")
    for table in tables:
        execute(
            f"UPDATE {table} SET tenant_id = (SELECT id FROM tenants WHERE slug = 'selvi') WHERE tenant_id IS NULL",
            f"Backfill {table}"
        )

    # =========================================
    # STEP 5: Seed Venkat as second tenant
    # =========================================
    print("\n=== STEP 5: Seed Venkat tenant ===")
    execute(
        """INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
        VALUES (
            'Venkat Ramachandran',
            'venkat',
            'venkat.fts@gmail.com',
            'venkat.fts@gmail.com',
            '{"full_name": "Venkat Ramachandran", "city": "London", "country": "United Kingdom"}',
            '{"keywords": ["software engineer", "tech lead", "platform engineering"], "location": "London, UK", "salary_min": 90000, "salary_max": 130000, "sources": ["adzuna", "reed", "linkedin"]}',
            '{"from_name": "Venkat Ramachandran", "from_email": "jobs@apiloom.io", "reply_to": "venkat.fts@gmail.com"}',
            true
        ) ON CONFLICT (slug) DO NOTHING""",
        "Seed Venkat tenant"
    )

    # =========================================
    # STEP 6: Create composite indexes
    # =========================================
    print("\n=== STEP 6: Create indexes ===")
    indexes = [
        ("idx_jobs_tenant", "jobs(tenant_id)"),
        ("idx_applications_tenant", "applications(tenant_id)"),
        ("idx_emails_tenant", "emails(tenant_id)"),
        ("idx_interviews_tenant", "interviews(tenant_id)"),
        ("idx_pipeline_metrics_tenant", "pipeline_metrics(tenant_id)"),
        ("idx_content_calendar_tenant", "content_calendar(tenant_id)"),
        ("idx_notification_queue_tenant", "notification_queue(tenant_id)"),
    ]
    for idx_name, idx_def in indexes:
        execute(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}",
            f"Create index {idx_name}"
        )

    # =========================================
    # Verification
    # =========================================
    print("\n=== VERIFICATION ===")
    execute("SELECT slug, name, email, is_active FROM tenants ORDER BY created_at", "List tenants")
    execute("SELECT count(*) AS job_count FROM jobs WHERE tenant_id IS NOT NULL", "Jobs with tenant_id")
    execute("SELECT count(*) AS job_count FROM jobs WHERE tenant_id IS NULL", "Jobs without tenant_id")

    print(f"\n{'='*50}")
    print(f"Migration complete: {results['ok']} OK, {results['error']} errors")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
