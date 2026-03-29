# Module 4: Application Tracker System -- Deep Research

**Date:** 2026-03-29
**Module:** 04 -- Application Tracking
**System:** Selvi Job App (n8n + Postgres)
**Target roles:** UK Corporate L&D (Manager to Head level, GBP 70-80k) and University Lecturer/Senior Lecturer

---

## Table of Contents

1. [Application Lifecycle Stages](#1-application-lifecycle-stages)
2. [Existing Tracker Tools -- Competitive Analysis](#2-existing-tracker-tools--competitive-analysis)
3. [Automated Status Detection](#3-automated-status-detection)
4. [Dashboard and Reporting](#4-dashboard-and-reporting)
5. [Database Schema Design](#5-database-schema-design)
6. [Notifications and Reminders](#6-notifications-and-reminders)
7. [Integration Points with Other Modules](#7-integration-points-with-other-modules)

---

## 1. Application Lifecycle Stages

### 1.1 Universal Application Pipeline

The following stages represent the full lifecycle from discovery through final outcome:

```
DISCOVERED -> SHORTLISTED -> APPLIED -> ACKNOWLEDGED -> SCREENING -> INTERVIEW_1 -> INTERVIEW_2 -> ASSESSMENT -> OFFER -> NEGOTIATION -> ACCEPTED | DECLINED | REJECTED | WITHDRAWN | GHOSTED
```

**Stage definitions:**

| Stage | Description | Typical trigger |
|-------|-------------|-----------------|
| `discovered` | Job found by Module 1 (Job Discovery) | Automated: n8n workflow |
| `shortlisted` | Candidate marks job as worth applying to | Manual or rule-based (A/A+ tier auto-shortlist) |
| `applied` | Application submitted | Module 3 confirmation or manual entry |
| `acknowledged` | Employer confirms receipt | Email parsing: "thank you for your application" |
| `screening` | Phone screen or initial recruiter call | Email/calendar invite detection |
| `interview_1` | First formal interview (panel or 1:1) | Calendar invite or email parsing |
| `interview_2` | Second interview or follow-up | Calendar invite or email parsing |
| `assessment` | Task, presentation, psychometric test, or teaching demo | Email with instructions or portal notification |
| `offer` | Formal or verbal offer received | Email parsing or manual entry |
| `negotiation` | Counter-offer or terms discussion in progress | Manual entry |
| `accepted` | Offer accepted -- terminal state | Manual entry |
| `declined` | Candidate declined offer -- terminal state | Manual entry |
| `rejected` | Employer rejected candidate -- terminal state | Email parsing: "unfortunately", "other candidates" |
| `withdrawn` | Candidate withdrew application -- terminal state | Manual entry |
| `ghosted` | No response after defined threshold -- terminal state | Automated: time-based rule |

### 1.2 UK-Specific Stages

Two stages are specific to UK hiring and appear after an offer is made but before the start date:

**Right to Work Check:**
- Mandatory for all UK employment. Employers must verify legal authorization to work before employment begins.
- Three-step process: obtain documentation, check documentation, verify information.
- For non-UK/Irish nationals, this involves checking visa status, BRP cards, or share codes via the Home Office online service.
- Typically completed within 1-3 business days once documents are provided.
- For Selvi's case: as a professional with UK work authorization, this is a standard process but must be tracked because it can delay start dates if documents are not ready.

**DBS Check (Disclosure and Barring Service):**
- Required for university lecturer roles and any position involving work with children or vulnerable adults.
- Three levels: Basic (shows unspent convictions), Standard (spent and unspent convictions), Enhanced (includes police intelligence).
- University lecturers typically need Enhanced DBS if teaching involves contact with under-18s (increasingly common with widening participation).
- Processing time: 2-8 weeks depending on level and whether information is held by multiple police forces.
- The 5 stages of DBS processing: application submission, identity verification, PNC database check, police force verification, certificate issuance.
- A conditional offer can be made subject to satisfactory DBS -- the check happens post-offer, pre-start.

**Recommended additional UK stages for the tracker:**

| Stage | When it applies | Duration |
|-------|----------------|----------|
| `right_to_work` | All UK roles, post-offer | 1-3 days |
| `dbs_check` | University and education roles, post-offer | 2-8 weeks |
| `references` | Most UK roles, post-offer | 1-3 weeks |
| `occupational_health` | University and NHS roles, post-offer | 1-2 weeks |

These are modeled as sub-stages of the post-offer process rather than top-level pipeline stages.

### 1.3 Academic Hiring Timeline (University Lecturer)

UK academic hiring works differently from corporate recruitment:

**No fixed hiring season.** Unlike the US system with its structured fall hiring season, UK universities advertise positions year-round. Posts appear when funding is approved or departures occur.

**Primary advertising channel:** jobs.ac.uk is the dominant platform. Nearly all UK university positions appear there.

**Career hierarchy:** Lecturer -> Senior Lecturer -> Reader -> Professor (except Oxbridge which has its own structure).

**Typical timeline:**
- Posting to closing date: 2-4 weeks (sometimes longer for senior posts)
- Shortlisting: 1-3 weeks after closing
- Interview invitation: usually 10-14 days notice before interview date
- Interview format: single-day event, typically 30-minute panel interview + 45-minute presentation + Q&A. No multi-stage phone screen/campus visit process like the US.
- Decision: often communicated same day or within a few days of interview
- Contract/offer: 1-4 weeks after decision
- DBS/references/occupational health: 2-8 weeks
- **Total time from application to start: 2-6 months**

**Key difference from corporate:** The interview is typically one event (not a multi-stage funnel), but the post-offer bureaucracy is longer. The pipeline has fewer stages but more calendar time.

**Practical impact on tracker design:**
- Need a `closing_date` field -- academic posts have firm deadlines
- Long gaps between stages are normal; ghosting thresholds must be longer (4-6 weeks vs 2 weeks for corporate)
- Assessment stage often means "teaching demonstration" or "presentation to panel"

### 1.4 Corporate L&D Hiring Timeline

**UK average time to hire (2026 recruiter survey data):**

| Category | Average time |
|----------|-------------|
| UK overall average | 4.9 weeks |
| Education & Training sector | 5.2 weeks |
| Business & Finance function | 6.0 weeks |
| Middle Management level | 5.1 weeks |
| Senior Leadership level | 6.5 weeks |

For L&D Manager/Head of L&D roles, expect 5-8 weeks from application to offer. These sit at the longer end because of:
- Seniority level (middle management to senior)
- Multiple interview rounds (often 2-3 for manager+ roles)
- Assessment tasks (designing a training program, presenting a learning strategy)
- Stakeholder sign-off requirements (HR, business unit leads)

**Typical L&D corporate pipeline:**
1. Application submitted
2. Recruiter/HR phone screen (15-30 min)
3. First interview: hiring manager + HR (45-60 min)
4. Assessment: design a learning intervention, present a case study, or psychometric test
5. Second interview: senior stakeholder or panel
6. Offer

### 1.5 Handling Ghosting

Ghosting is how most UK job applications end. The numbers are bad:

**UK ghosting statistics (2025-2026):**
- 92% of candidates have been ghosted at some point during hiring
- Candidates do not hear back from 55% of applications they submit
- 53% of job seekers report being ghosted by a potential employer
- 56% of UK hiring managers are not opposed to ghosting unsuccessful candidates
- 75% of applications receive zero response from employers

**Where ghosting happens:**
- After submitting application: 28% (most common)
- After one interview: 20%
- After initial phone screen: 16%

**Response time expectations:**
- 88% of candidates expect to hear back within 1-2 weeks of applying
- Professional standard benchmark: response within 30 calendar days
- Median waiting period before first contact has increased to 68.5 days in 2025

**Response rates by platform:**
- Indeed: 20-25% response rate
- LinkedIn: 3-13% response rate
- Company career sites: 2-5% response rate

**Design implications for the tracker:**

1. **Auto-ghost detection rules:**
   - Corporate roles: mark as `ghosted` after 30 days with no status change post-application
   - Academic roles: mark as `ghosted` after 45 days (longer timelines are normal)
   - Post-interview: mark as `ghosted` after 21 days with no response
   - Post-phone-screen: mark as `ghosted` after 14 days

2. **Follow-up prompts before ghost classification:**
   - Day 7-10 post-application: "Consider sending a follow-up email"
   - Day 14 post-application: "No response -- send follow-up if not already done"
   - Day 21 post-application: "Still no response -- likely ghosted, but may still hear back"
   - Day 30/45: auto-classify as ghosted

3. **Ghost status is soft-terminal:** Applications can be un-ghosted if a delayed response arrives. Status changes from `ghosted` back to any active stage must be allowed.

---

## 2. Existing Tracker Tools -- Competitive Analysis

### 2.1 Huntr

**Pricing:** Free (100 jobs) / Pro at $40/month (unlimited)

**Core features:**
- Kanban board visualization of application pipeline
- Chrome extension (4.9 stars, 1,100+ reviews) clips jobs from any site into tracker
- Auto-fill application forms from saved profile data
- Contact and interview tracker (who, when, what was discussed)
- Geographic map of applied jobs (useful for hybrid/in-person roles)
- KPI dashboard with activity metrics, status breakdown
- AI resume tailoring and cover letter generation (Pro)
- Resume scoring against job descriptions (ATS-aware)

**What works well:**
- Single-click job save from any job board via Chrome extension
- Visual pipeline makes it easy to see overall status
- Contact tracking prevents follow-up gaps
- Dashboard provides actionable analytics

**Limitations:**
- No email parsing for automatic status updates
- Manual status updates only
- $40/month for full features is expensive for individual job seekers
- No integration with automation tools (no API)
- No academic-specific features

### 2.2 Teal

**Pricing:** Free tier / Teal+ paid tier

**Core features:**
- Chrome extension works with 50+ job boards
- Bookmark jobs and auto-populate tracker
- Status tracking: Bookmarked -> Applied -> Interviewing -> Negotiating -> Accepted/Archived
- Excitement rating for each role
- Keyword analysis from job descriptions
- Resume gap analysis and scoring
- Follow-up reminders and notes
- CRM-style contact management

**What works well:**
- Clean UX, low friction to start tracking
- Keyword extraction helps with resume tailoring
- Excitement rating adds a subjective filter beyond raw scoring
- Free tier is genuinely useful

**Limitations:**
- Same as Huntr: no automated status detection
- No email integration
- Limited customization of pipeline stages
- No API for external integration

### 2.3 Notion Templates

**Common template features:**
- Customizable database columns: company, title, status, dates, contacts, salary, notes
- Multiple views: Kanban board, calendar, table, gallery
- Filtering and sorting by any column
- Relation databases linking applications to contacts, companies, documents
- Homepage dashboards showing upcoming interviews, pending follow-ups
- Some templates include AI-powered cover letter generation via Notion AI

**What works well:**
- Fully customizable to any workflow
- Multiple linked databases (applications, contacts, documents, companies)
- Calendar view for interview scheduling
- Can be extended with Notion API for automation

**Limitations:**
- Manual data entry for everything
- No job board integration without additional tools
- Requires setup effort -- not turnkey
- Performance degrades with hundreds of entries

### 2.4 Google Sheets Templates

**Common columns across popular templates:**
- Company name, job title, URL
- Date applied, deadline, days remaining
- Status (Applied, Interviewing, Offered, Rejected)
- Salary (listed vs expected)
- Location, work type (remote/hybrid/onsite)
- Contact name and email
- Last communication date
- Notes, follow-up dates
- Resume version used
- Source/platform

**What works well:**
- Zero cost, instant setup
- Shareable and collaborative
- Can be automated with Google Apps Script
- Easy to add charts and conditional formatting

**Limitations:**
- Manual everything
- No pipeline visualization without add-ons
- Scales poorly past 100+ applications
- No mobile-friendly experience

### 2.5 Key Data Points That Matter Most

Looking across all these tools, the same data points keep showing up. These are the ones that actually matter:

**Must-have fields:**
1. Company name
2. Job title
3. Application status (with timestamps for each transition)
4. Date applied
5. Job URL
6. Salary (listed range)
7. Location + work arrangement
8. Contact person (recruiter/hiring manager name and email)
9. Source platform (where you found it / where you applied)
10. Notes (free-text for interview feedback, conversation notes)

**High-value fields:**
11. Resume/CV version used
12. Cover letter used
13. Follow-up dates (next action required)
14. Interview dates and times
15. Excitement/fit rating (subjective score)
16. Days since last status change (calculated)
17. Closing date / deadline
18. Contract type (permanent, fixed-term, contract)

**Analytics fields:**
19. Time in each stage (calculated from status history)
20. Response time (days from application to first response)
21. Total interactions count

### 2.6 What Selvi's Tracker Must Do Better

The gap across all existing tools: **none of them automate status detection from email.** Every one requires manual status updates. That is the main opportunity for Module 4.

None of them integrate with a job discovery pipeline either (they all start at "save a job"), and none link to CV/cover letter generation. The Selvi system can close the loop from discovery through application through outcome tracking -- something no standalone tracker does.

---

## 3. Automated Status Detection

### 3.1 Email Parsing for Status Updates

This is the single most useful thing the tracker can automate. The approach uses Module 5 (Email Management) as the data source and AI classification to detect status changes.

**Architecture:**
```
Gmail -> n8n Gmail Trigger -> Email Classifier (AI) -> Status Update -> Postgres
```

**Classification categories (7 types, following CareerSync's proven model):**

| Category | Description |
|----------|-------------|
| `acknowledgment` | Application receipt confirmation |
| `rejection` | Application or interview rejection |
| `interview_invite` | Invitation to interview or phone screen |
| `assessment_invite` | Request to complete task, test, or presentation |
| `offer` | Job offer communication |
| `follow_up_request` | Employer asking for additional information |
| `general_update` | Status update that does not fit other categories |

### 3.2 Email Pattern Recognition

**Acknowledgment patterns:**
- "Thank you for your application"
- "We have received your application"
- "Application received"
- "Thank you for applying"
- "Your application for [role] has been submitted"
- "We will review your application and be in touch"
- Subject lines containing: "Application Confirmation", "Application Received"

**Rejection patterns:**
- "Unfortunately" + ("not" OR "unable" OR "won't be")
- "After careful consideration"
- "We have decided to move forward with other candidates"
- "Not been shortlisted"
- "Not selected for interview"
- "We regret to inform you"
- "The position has been filled"
- "We will not be progressing your application"
- "Pursue other candidates"
- Subject lines containing: "Update on your application", "Application Update"

**Interview invitation patterns:**
- "We would like to invite you to"
- "We'd like to invite you for an interview"
- "Would you be available for"
- "Please book a time" / "schedule a call"
- "Next steps in the process"
- "We'd love to learn more about you"
- Calendar invite attachments (.ics files)

**Offer patterns:**
- "We are pleased to offer you"
- "We would like to extend an offer"
- "Offer of employment"
- "Terms and conditions of employment"
- Subject lines containing: "Offer", "Employment Offer"

**Assessment patterns:**
- "Please prepare a presentation"
- "Complete the following assessment"
- "We'd like you to prepare"
- "Teaching demonstration"
- "Case study" or "task"
- "Psychometric test" or "aptitude test"

### 3.3 Implementation Approach

**Two-tier classification (matching the Module 1 scoring pattern):**

1. **Rule-based pre-filter:** Regex patterns on subject line and first 500 characters of email body. Fast, cheap, handles 60-70% of cases with high confidence.

2. **AI classification for ambiguous cases:** Send to Claude Haiku with a classification prompt. The prompt includes the email subject, sender, body (truncated to 2000 chars), and asks for: category, confidence score, extracted company name, extracted job title.

**Matching emails to applications:**
- Extract company name from email sender domain and body
- Extract job title from subject line and body
- Match against `applications` table using fuzzy matching on company + title
- If no match found, create a new application record (the email may be for a direct application not tracked in the system)

**CareerSync reference implementation:**
- Uses custom-trained SetFit classifier and T5-small model deployed on Hugging Face
- Claims 95%+ accuracy across 7 categories
- Handles noise filtering (newsletters, promotional emails, LinkedIn notifications)
- Zero data storage approach (stateless) -- we would persist to Postgres instead

**For our n8n implementation, the simpler approach is better:**
- Use regex rules for high-confidence cases
- Use Claude Haiku API call for everything else
- Store classification results with confidence scores
- Flag low-confidence classifications for manual review

### 3.4 Calendar Invite Detection

**Approach:**
- Gmail trigger watches for emails with `.ics` attachments or Google Calendar invite notifications
- Parse the `.ics` file to extract: event title, date/time, location (physical or video link), organizer
- Match to application by company name / organizer domain
- Auto-create interview record with date, time, format, location
- Set interview preparation reminders

**n8n implementation:**
- Gmail Trigger node with attachment filter
- Code node to parse `.ics` content (standard iCalendar format)
- Postgres node to update application status and create interview record

### 3.5 Portal Status Checking -- Feasibility Assessment

**Short answer: not feasible to automate reliably.**

Reasons:
- Each employer portal (Workday, Taleo, SuccessFactors, custom ATS) has different UI and authentication
- No standardized API for applicant status
- Portal scraping breaks constantly as UIs change
- Authentication requires storing employer portal credentials (security risk)
- Many portals use CAPTCHAs and bot detection
- The ROI is poor: most status changes also generate emails

**Recommendation:** Do not attempt portal automation. Rely on email parsing and manual updates. If a portal is the only communication channel, the candidate updates status manually.

---

## 4. Dashboard and Reporting

### 4.1 Key Metrics

**Pipeline metrics:**
- Applications submitted (total, this week, this month)
- Applications by stage (current count in each pipeline stage)
- Applications by tier (A+/A/B/C/D breakdown)
- Response rate: (acknowledged + any response) / total applied
- Interview rate: interviews scheduled / total applied
- Offer rate: offers received / total applied
- Ghosting rate: ghosted / total applied

**Timing metrics:**
- Average time in each stage
- Average time from application to first response
- Average time from application to interview
- Average time from interview to decision
- Longest-waiting active applications

**Activity metrics:**
- Applications per week (trend over time)
- Follow-ups sent this week
- Interviews scheduled this week
- Status changes this week

**Quality metrics:**
- Response rate by source platform (Indeed vs LinkedIn vs direct vs jobs.ac.uk)
- Response rate by job type (corporate vs academic)
- Response rate by tier (do A+ tier applications get more responses?)
- Interview conversion by assessment type

### 4.2 Benchmarks for Comparison

These benchmarks give context to Selvi's numbers:

| Metric | Market benchmark | Notes |
|--------|-----------------|-------|
| Response rate (any response) | 25-45% | 75% of applications get zero response |
| Interview rate | 5-15% | Varies heavily by role fit |
| Offer rate | 1-5% of applications | Higher for targeted applications |
| Time to first response | 1-2 weeks (expected), 68.5 days (median actual) | Gap between expectation and reality is enormous |
| UK average time to hire | 4.9 weeks overall, 5.2 weeks education, 6.5 weeks senior | From application to offer |
| Application completion rate | 8% (92% abandon) | Not relevant for Selvi as she completes applications |

**Selvi-specific baseline (from PRD: 90% callback rate):**
Selvi's existing callback rate of 90% is far above market average. The tracker should verify whether this holds across different channels and role types. If the bottleneck really is volume rather than conversion, the tracker data will show it.

### 4.3 Funnel Visualization

**Pipeline funnel chart:**
```
Discovered:    ████████████████████████████████████  150
Shortlisted:   ██████████████████████████           80
Applied:       ████████████████████                 50
Acknowledged:  ██████████████                       35
Screening:     ██████████                           20
Interview 1:   ████████                             15
Interview 2:   ██████                               10
Assessment:    ████                                  6
Offer:         ██                                    3
Accepted:      █                                     1
```

This should be rendered as an actual funnel/bar chart in the dashboard. Tools:
- n8n can generate this data as JSON
- A simple HTML dashboard served from the n8n instance
- Or push data to a Google Sheet with built-in charting
- Or use Metabase/Grafana connected to Postgres (more complex but more powerful)

**Recommended approach for MVP:** Weekly email report with text-based funnel + key metrics. Dashboard can come later.

### 4.4 Report Types

**Daily digest (email):**
- New status changes today
- Applications requiring follow-up
- Upcoming interviews (next 7 days)
- New jobs shortlisted for review

**Weekly summary (email):**
- Pipeline funnel with counts
- Applications submitted this week
- Response rate trends
- Stage progression (what moved forward, what stalled)
- Ghosting alerts
- Key metrics vs benchmarks

**Monthly review (email or dashboard):**
- Full funnel with conversion rates
- Channel effectiveness (which sources produce interviews?)
- Time-in-stage analysis
- Trend lines for key metrics
- Recommendations (e.g., "LinkedIn applications have a 5% response rate vs 30% on jobs.ac.uk -- shift effort")

---

## 5. Database Schema Design

### 5.1 Core Tables

The schema extends the existing `selvi_jobs` database. The `jobs` table from Module 1 is the anchor. Module 4 adds application tracking on top.

```sql
-- ============================================================
-- APPLICATION TRACKING TABLES (Module 4)
-- ============================================================

-- Applications: one per job the candidate applies to
-- Links to jobs table from Module 1
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- Core fields (some duplicated from jobs for cases where
    -- the application was made outside the discovery system)
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    job_url TEXT,

    -- Application details
    status TEXT NOT NULL DEFAULT 'applied',
    -- Valid statuses: discovered, shortlisted, applied, acknowledged,
    -- screening, interview_1, interview_2, assessment, offer,
    -- negotiation, accepted, declined, rejected, withdrawn, ghosted

    applied_at TIMESTAMPTZ,
    closing_date DATE,

    -- Source and method
    source_platform TEXT, -- linkedin, indeed, jobs_ac_uk, company_site, reed, etc.
    application_method TEXT, -- online_form, email, easy_apply, recruitment_agency
    recruiter_agency TEXT, -- if applied through agency

    -- Job details
    job_type TEXT, -- corporate, academic
    contract_type TEXT, -- permanent, fixed-term, contract
    work_arrangement TEXT, -- onsite, hybrid, remote
    location TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_raw TEXT,

    -- Documents used
    cv_version_id UUID, -- FK to cv_versions table (Module 2)
    cover_letter_id UUID, -- FK to cover_letters table (Module 2)
    cv_filename TEXT, -- fallback if Module 2 not yet built
    cover_letter_filename TEXT,

    -- Subjective assessment
    excitement_rating INTEGER CHECK (excitement_rating BETWEEN 1 AND 5),
    fit_notes TEXT, -- why this role is a good/bad fit

    -- Contact
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    contact_role TEXT, -- recruiter, hiring_manager, hr

    -- Scoring (from Module 1)
    tier TEXT, -- A+, A, B, C, D
    composite_score NUMERIC(5,2),

    -- UK-specific post-offer tracking
    right_to_work_status TEXT, -- pending, submitted, cleared
    dbs_check_status TEXT, -- not_required, pending, submitted, cleared
    references_status TEXT, -- not_required, pending, submitted, cleared
    occupational_health_status TEXT, -- not_required, pending, submitted, cleared

    -- Outcome
    outcome_reason TEXT, -- why rejected/declined/withdrawn
    offer_salary INTEGER,
    offer_details JSONB, -- benefits, start date, other terms

    -- Metadata
    notes TEXT,
    tags TEXT[], -- arbitrary tags for filtering
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_applied_at ON applications(applied_at);
CREATE INDEX idx_applications_company ON applications(company);
CREATE INDEX idx_applications_job_type ON applications(job_type);
CREATE INDEX idx_applications_is_archived ON applications(is_archived) WHERE is_archived = false;


-- Application status history: audit trail of every status change
CREATE TABLE application_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- How the change was detected
    change_source TEXT NOT NULL, -- manual, email_parse, calendar_detect, auto_ghost, module_3
    change_confidence NUMERIC(3,2), -- 0-1 for automated detections

    -- Supporting evidence
    source_email_id TEXT, -- Gmail message ID that triggered this change
    source_email_subject TEXT,
    source_email_snippet TEXT, -- first 500 chars

    notes TEXT
);

CREATE INDEX idx_app_status_history_app_id ON application_status_history(application_id);
CREATE INDEX idx_app_status_history_changed_at ON application_status_history(changed_at);


-- Interviews: detailed tracking of each interview event
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    interview_type TEXT NOT NULL, -- phone_screen, video, in_person, panel, presentation, teaching_demo
    interview_round INTEGER DEFAULT 1, -- 1st, 2nd, 3rd...

    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER,

    -- Location
    location TEXT, -- physical address or "remote"
    meeting_url TEXT, -- Zoom/Teams/Google Meet link
    meeting_platform TEXT, -- zoom, teams, google_meet, in_person

    -- Participants
    interviewers JSONB DEFAULT '[]', -- [{name, role, email}]

    -- Preparation
    prep_notes TEXT, -- what to prepare
    dress_code TEXT,
    documents_required TEXT[], -- portfolio, ID, certificates

    -- Outcome (filled after interview)
    outcome TEXT, -- passed, failed, pending, cancelled
    feedback TEXT, -- interviewer feedback if received
    self_assessment TEXT, -- candidate's own notes on how it went

    -- Calendar
    calendar_event_id TEXT, -- Google Calendar event ID
    ics_data TEXT, -- raw .ics content

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interviews_application_id ON interviews(application_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);


-- Follow-up reminders
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    reminder_type TEXT NOT NULL, -- follow_up_email, interview_prep, document_submit, general
    due_date TIMESTAMPTZ NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,

    -- Auto-generated vs manual
    auto_generated BOOLEAN DEFAULT false,
    generation_rule TEXT, -- e.g., "no_response_7_days", "interview_prep_48h"

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_due_date ON follow_ups(due_date) WHERE is_completed = false AND is_dismissed = false;
CREATE INDEX idx_follow_ups_application_id ON follow_ups(application_id);


-- Application documents: which CV/cover letter was sent where
CREATE TABLE application_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    document_type TEXT NOT NULL, -- cv, cover_letter, portfolio, transcript, reference_letter, other
    filename TEXT NOT NULL,
    file_path TEXT, -- path in storage (local or S3)
    file_hash TEXT, -- SHA-256 for dedup

    -- Module 2 linkage
    cv_version_id UUID, -- FK to Module 2 cv_versions if available
    cover_letter_id UUID, -- FK to Module 2 cover_letters if available

    -- Metadata
    tailored_for_job BOOLEAN DEFAULT false, -- was this customized for this specific role?
    notes TEXT,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_documents_application_id ON application_documents(application_id);
CREATE INDEX idx_app_documents_type ON application_documents(document_type);


-- Email classifications: log of all parsed job-related emails
CREATE TABLE email_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    gmail_message_id TEXT NOT NULL UNIQUE,
    gmail_thread_id TEXT,

    -- Email metadata
    from_address TEXT,
    from_name TEXT,
    subject TEXT,
    received_at TIMESTAMPTZ,
    snippet TEXT, -- first 500 chars

    -- Classification result
    category TEXT NOT NULL, -- acknowledgment, rejection, interview_invite, assessment_invite, offer, follow_up_request, general_update, not_job_related
    confidence NUMERIC(3,2) NOT NULL, -- 0-1
    classification_method TEXT NOT NULL, -- regex, ai_haiku, manual

    -- Extracted entities
    extracted_company TEXT,
    extracted_job_title TEXT,
    extracted_date TIMESTAMPTZ, -- interview date, deadline, etc.

    -- Matching
    matched_application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    match_confidence NUMERIC(3,2),
    requires_review BOOLEAN DEFAULT false, -- flagged for manual check

    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_class_gmail_id ON email_classifications(gmail_message_id);
CREATE INDEX idx_email_class_category ON email_classifications(category);
CREATE INDEX idx_email_class_matched_app ON email_classifications(matched_application_id);
CREATE INDEX idx_email_class_requires_review ON email_classifications(requires_review) WHERE requires_review = true;


-- Pipeline metrics: daily snapshot for trend reporting
CREATE TABLE pipeline_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL UNIQUE,

    -- Counts by status
    total_discovered INTEGER DEFAULT 0,
    total_shortlisted INTEGER DEFAULT 0,
    total_applied INTEGER DEFAULT 0,
    total_acknowledged INTEGER DEFAULT 0,
    total_screening INTEGER DEFAULT 0,
    total_interviewing INTEGER DEFAULT 0,
    total_assessment INTEGER DEFAULT 0,
    total_offer INTEGER DEFAULT 0,
    total_accepted INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    total_ghosted INTEGER DEFAULT 0,
    total_withdrawn INTEGER DEFAULT 0,

    -- Rates (calculated)
    response_rate NUMERIC(5,2),
    interview_rate NUMERIC(5,2),

    -- Activity
    applications_this_week INTEGER DEFAULT 0,

    -- Full breakdown as JSONB for flexible querying
    breakdown JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_snapshots_date ON pipeline_snapshots(snapshot_date);


-- Trigger: auto-update updated_at on applications
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### 5.2 Schema Design Rationale

**Why duplicate company/title on applications instead of just using job_id?**
Not all applications originate from Module 1. Selvi may apply to jobs she found manually, through networking, or through recruiters. These applications need tracking even if the job is not in the `jobs` table. The `job_id` is optional -- it links to Module 1 when available.

**Why a separate status history table?**
The status history provides an audit trail that enables:
- Time-in-stage calculations
- Source attribution (which status changes came from email parsing vs manual)
- Confidence tracking for automated detections
- Rollback capability (undo an incorrect automated classification)

**Why pipeline_snapshots?**
Computing pipeline metrics from live data on every query is expensive and produces inconsistent results if data changes mid-calculation. Daily snapshots provide stable trend data for reporting.

**Why email_classifications as a separate table?**
Email processing runs on its own schedule, separate from application tracking. Keeping classifications in their own table allows:
- Reprocessing emails with improved classifiers
- Auditing classification accuracy
- Handling emails that do not match any application
- Debugging matching failures

---

## 6. Notifications and Reminders

### 6.1 Follow-Up Reminders

**Auto-generated reminders (rules engine):**

| Rule | Trigger | Reminder text |
|------|---------|---------------|
| `no_response_7d` | 7 days after application, still in `applied` status | "No response from [Company] for [Role] -- consider sending a follow-up email" |
| `no_response_14d` | 14 days after application, still in `applied` | "Still no response from [Company] -- send follow-up if not done" |
| `no_response_21d` | 21 days after application | "3 weeks with no response from [Company] -- likely ghosted but may still hear back" |
| `post_interview_7d` | 7 days after interview, no status change | "No update from [Company] since interview on [date] -- consider following up" |
| `post_screen_5d` | 5 days after phone screen, no status change | "No update from [Company] since phone screen -- follow up?" |
| `closing_date_3d` | 3 days before job closing date, status still `shortlisted` | "Closing date for [Role] at [Company] is in 3 days -- apply now" |
| `closing_date_today` | Closing date is today, status still `shortlisted` | "Today is the last day to apply for [Role] at [Company]" |

**Follow-up timing best practices (from research):**
- Best days to send follow-ups: Tuesday through Thursday
- Wait 5-7 business days after application before first follow-up
- Limit to one follow-up per application (do not spam)
- 80% of hiring managers say follow-ups reflect positively on candidates
- Only 20% of applicants actually follow up (competitive advantage)

### 6.2 Interview Preparation Reminders

| Timing | Reminder |
|--------|----------|
| 48 hours before | "Interview at [Company] in 2 days. Review: job description, your CV, company recent news" |
| 24 hours before | "Interview tomorrow at [time]. Confirm: location/link, outfit, documents needed" |
| 2 hours before | "Interview in 2 hours. Final check: meeting link works, quiet space, water, notes ready" |

### 6.3 Status Change Notifications

Every automated status change triggers a notification:
- Email notification for high-importance changes (interview invite, offer, rejection)
- Digest-style for low-importance changes (acknowledgments can batch into daily digest)
- Include the source evidence (email snippet that triggered the change)
- Include confidence score for AI-detected changes
- "Mark as incorrect" link for false positives

### 6.4 Weekly Pipeline Summary Email

Sent every Monday morning:

```
Subject: Selvi Job Search -- Week of [date] Pipeline Summary

PIPELINE STATUS
===============
Active applications:  23
New this week:         5
Moved forward:         3
Rejected:              2
Ghosted (new):         1

STAGE BREAKDOWN
===============
Applied (awaiting response):  12
Phone Screen scheduled:        2
Interview scheduled:           3
Assessment in progress:        1
Offer stage:                   0
Post-offer checks:             0

UPCOMING
========
- Interview: [Company] on [date] at [time]
- Follow-up due: [Company] (applied 10 days ago)
- Closing soon: [Role] at [Company] closes [date]

METRICS
=======
Response rate (last 30 days): 35%
Interview rate: 15%
Average time to first response: 8 days

REQUIRING ATTENTION
===================
- [Company]: No response after interview 12 days ago
- [Company]: Assessment deadline tomorrow
```

### 6.5 n8n Implementation for Notifications

**Workflow structure:**
1. **Reminder Generator (runs daily at 7am):**
   - Query applications table for reminder rule matches
   - Generate follow_ups records
   - Send email with day's reminders

2. **Status Change Notifier (event-driven):**
   - Triggered by status change in application
   - Determines notification priority
   - Sends immediate email for high-priority, queues for digest otherwise

3. **Weekly Summary (runs Monday 8am):**
   - Aggregate pipeline metrics
   - Generate snapshot record
   - Format and send summary email

4. **Interview Prep (runs every 6 hours):**
   - Check for interviews in next 48 hours
   - Send preparation reminders if not already sent

---

## 7. Integration Points with Other Modules

### 7.1 Module 1: Job Discovery -> Application Tracker

**Data flow:** When a job is discovered and scored, it enters the tracker as a potential application.

| Integration point | Direction | Mechanism |
|-------------------|-----------|-----------|
| Job data import | Module 1 -> Module 4 | `applications.job_id` references `jobs.id` |
| Auto-shortlist A/A+ jobs | Module 1 -> Module 4 | n8n workflow creates application record with status `shortlisted` when a job scores A+ or A |
| Tier and score | Module 1 -> Module 4 | `applications.tier` and `applications.composite_score` copied from jobs table |
| Status sync | Module 4 -> Module 1 | When application status changes to `applied`, update `jobs.status` to `applied` |
| Duplicate awareness | Module 1 -> Module 4 | Do not create application records for jobs flagged as duplicates |

**Implementation:**
- After Module 1 scoring workflow completes, add a branch that checks tier
- A+/A tier jobs: auto-create application record in `shortlisted` status
- B tier jobs: create with `discovered` status (candidate reviews and decides)
- C/D tier jobs: do not create application records

### 7.2 Module 2: CV Tailoring -> Application Tracker

**Data flow:** Track which CV and cover letter version was used for each application.

| Integration point | Direction | Mechanism |
|-------------------|-----------|-----------|
| CV version linking | Module 2 -> Module 4 | `applications.cv_version_id` and `application_documents` table |
| Cover letter linking | Module 2 -> Module 4 | `applications.cover_letter_id` and `application_documents` table |
| Tailoring trigger | Module 4 -> Module 2 | When status changes to `shortlisted`, trigger CV tailoring workflow |
| Effectiveness tracking | Module 4 -> Module 2 | Track which CV versions lead to interviews (response rate by CV version) |

**Implementation:**
- Module 2 stores generated CVs and cover letters with version IDs
- When applying, link the document IDs to the application record
- Over time, report on which CV versions correlate with higher response rates

### 7.3 Module 3: Auto-Apply -> Application Tracker

**Data flow:** When Module 3 submits an application, it creates/updates the tracker record.

| Integration point | Direction | Mechanism |
|-------------------|-----------|-----------|
| Application confirmation | Module 3 -> Module 4 | Create or update application record with status `applied`, set `applied_at` |
| Method tracking | Module 3 -> Module 4 | Set `application_method` (easy_apply, online_form, email) |
| Document tracking | Module 3 -> Module 4 | Record which CV/cover letter was submitted |
| Failure handling | Module 3 -> Module 4 | If auto-apply fails, flag for manual application |

**Implementation:**
- Module 3 workflow has a final step that writes to `applications` table
- Sets status to `applied`, records method, documents, and timestamp
- Creates initial `application_status_history` record

### 7.4 Module 5: Email Management -> Application Tracker

**Data flow:** Email classification feeds status updates into the tracker.

| Integration point | Direction | Mechanism |
|-------------------|-----------|-----------|
| Email classification | Module 5 -> Module 4 | Write to `email_classifications` table |
| Status detection | Module 5 -> Module 4 | Match classified email to application, update status |
| Evidence linking | Module 5 -> Module 4 | Store Gmail message ID in `application_status_history.source_email_id` |
| Unmatched emails | Module 5 -> Module 4 | Flag emails that match job patterns but no known application |

**Implementation:**
- Module 5 runs the email parsing pipeline
- For each job-related email, writes to `email_classifications`
- Matching engine finds the corresponding application
- If match found with high confidence: auto-update status
- If match found with low confidence: flag for review
- If no match: create unmatched record for manual review

### 7.5 Module 6: Interview Scheduling -> Application Tracker

**Data flow:** Interview details flow between scheduling and tracking.

| Integration point | Direction | Mechanism |
|-------------------|-----------|-----------|
| Interview creation | Module 6 -> Module 4 | Create `interviews` record with schedule details |
| Calendar sync | Module 6 -> Module 4 | Store `calendar_event_id` for cross-reference |
| Status update | Module 6 -> Module 4 | Auto-update application status to `interview_1/2` |
| Prep reminders | Module 4 -> Module 6 | Trigger prep workflow based on interview date |
| Outcome recording | Module 4 -> Module 6 | After interview, record outcome and feedback |

**Implementation:**
- Module 6 detects calendar invites for interviews
- Creates/updates `interviews` record
- Updates `applications.status` to appropriate interview stage
- Module 4 generates prep reminders based on interview schedule

### 7.6 Integration Architecture Summary

```
Module 1 (Discovery)     Module 2 (CV Tailoring)     Module 3 (Auto-Apply)
    |                           |                           |
    | job_id, tier,            | cv_version_id,            | applied_at,
    | score, auto-             | cover_letter_id,          | method,
    | shortlist                | effectiveness             | documents
    |                           |                           |
    v                           v                           v
+------------------------------------------------------------------+
|                                                                  |
|               MODULE 4: APPLICATION TRACKER                      |
|                                                                  |
|  applications table + status_history + interviews + follow_ups   |
|                                                                  |
+------------------------------------------------------------------+
    ^                           ^
    |                           |
    | email classification,    | interview detection,
    | status detection,        | calendar sync,
    | evidence linking         | prep triggers
    |                           |
Module 5 (Email Mgmt)     Module 6 (Interview Scheduling)
```

---

## Appendix A: n8n Workflow Architecture for Module 4

### Workflow 1: Email Status Detector
- **Trigger:** Gmail Trigger (every 5 minutes, label: INBOX)
- **Step 1:** Filter for potential job-related emails (sender domain matching, subject keywords)
- **Step 2:** Regex classification attempt
- **Step 3:** If regex confident: classify and proceed. If not: send to Claude Haiku
- **Step 4:** Write to `email_classifications` table
- **Step 5:** Match to application (fuzzy company + title match)
- **Step 6:** If matched with high confidence: update application status, write history record
- **Step 7:** If low confidence or no match: flag for review
- **Step 8:** Send notification if status change is high-priority

### Workflow 2: Daily Reminder Generator
- **Trigger:** Cron (daily at 7:00 AM)
- **Step 1:** Query applications for reminder rules (no response 7d, 14d, etc.)
- **Step 2:** Query interviews for prep reminders (48h, 24h, 2h)
- **Step 3:** Query shortlisted applications approaching closing dates
- **Step 4:** Generate follow_up records (skip if already exists for this rule+application)
- **Step 5:** Format and send daily reminder email

### Workflow 3: Weekly Pipeline Summary
- **Trigger:** Cron (Monday at 8:00 AM)
- **Step 1:** Aggregate pipeline counts by status
- **Step 2:** Calculate rates and trends vs previous week
- **Step 3:** Write `pipeline_snapshots` record
- **Step 4:** Format summary email
- **Step 5:** Send via Gmail

### Workflow 4: Auto-Ghost Detector
- **Trigger:** Cron (daily at 9:00 PM)
- **Step 1:** Query applications where status has not changed and time exceeds threshold
- **Step 2:** Apply rules: 30 days for corporate, 45 days for academic, 21 days post-interview, 14 days post-screen
- **Step 3:** Update status to `ghosted` with change_source = `auto_ghost`
- **Step 4:** Create status history record
- **Step 5:** Include in next daily reminder digest

### Workflow 5: Application Status Updater (Manual + API)
- **Trigger:** Webhook (for manual status updates from a simple web form or API call)
- **Step 1:** Validate status transition (prevent invalid transitions)
- **Step 2:** Update application status
- **Step 3:** Write status history record
- **Step 4:** Generate any triggered follow-ups
- **Step 5:** Return updated application data

### Workflow 6: Pipeline Snapshot Generator
- **Trigger:** Cron (daily at 11:59 PM)
- **Step 1:** Count applications by status
- **Step 2:** Calculate response rate, interview rate
- **Step 3:** Write to `pipeline_snapshots` table
- **Step 4:** Used by weekly summary and dashboard

---

## Appendix B: Valid Status Transitions

Not all status transitions are valid. The system should enforce these rules:

```
discovered    -> shortlisted, withdrawn
shortlisted   -> applied, withdrawn
applied       -> acknowledged, screening, interview_1, assessment, rejected, ghosted, withdrawn
acknowledged  -> screening, interview_1, assessment, rejected, ghosted, withdrawn
screening     -> interview_1, rejected, ghosted, withdrawn
interview_1   -> interview_2, assessment, offer, rejected, ghosted, withdrawn
interview_2   -> assessment, offer, rejected, ghosted, withdrawn
assessment    -> interview_1, interview_2, offer, rejected, ghosted, withdrawn
offer         -> negotiation, accepted, declined
negotiation   -> accepted, declined
ghosted       -> acknowledged, screening, interview_1, assessment, offer, rejected (un-ghost on late response)
```

Terminal states: `accepted`, `declined`, `rejected`, `withdrawn`
Soft-terminal state: `ghosted` (can be reactivated)

---

## Appendix C: Data Privacy Considerations

- **GDPR compliance:** All data is about the candidate (Selvi) herself, not third parties. Employer contact information (recruiter names, emails) is legitimately collected during the application process.
- **Email storage:** Store only email metadata and snippets (first 500 chars), not full email bodies. Gmail message IDs allow retrieving full content when needed.
- **Document storage:** CVs and cover letters are the candidate's own documents. Store locally or in the existing Dokploy infrastructure.
- **Retention:** Archive applications older than 12 months. Delete email classification records after 6 months (keep status history permanently).
- **No scraping of employer portals:** This avoids terms of service violations and reduces legal risk.
