# Module 3: Automated Job Application System -- Deep Research

**Date:** 2026-03-29
**Status:** Research Complete
**Module:** 03 -- Auto Apply
**System:** Selvi Job App (n8n-based)

---

## Table of Contents

1. [Auto-Apply Tool Landscape](#1-auto-apply-tool-landscape)
2. [Legal and Ethical Considerations (UK)](#2-legal-and-ethical-considerations-uk)
3. [Platform-by-Platform Application Methods](#3-platform-by-platform-application-methods)
4. [Cover Letter and Supporting Statement Automation](#4-cover-letter-and-supporting-statement-automation)
5. [Application Tracking and Deduplication](#5-application-tracking-and-deduplication)
6. [Technical Implementation on n8n](#6-technical-implementation-on-n8n)
7. [Risk Management and Quality Gates](#7-risk-management-and-quality-gates)
8. [Recommended Architecture for Module 3](#8-recommended-architecture-for-module-3)

---

## 1. Auto-Apply Tool Landscape

### 1.1 How Existing Tools Work

The auto-apply market has exploded since 2024. Every tool follows the same basic pattern: ingest a candidate profile, scan job boards, match against criteria, generate tailored materials, and submit applications. The differences are in execution quality and honesty about limitations.

**LazyApply** -- Chrome extension that auto-fills application forms on LinkedIn, Indeed, and ZipRecruiter. Uses a "Job GPT" engine to mimic human input. Also generates cover letters and can send referral emails. Trustpilot rating: 1.9/5. Users report the bot fills forms with wrong information, applies for irrelevant seniority levels (internships when targeting mid-level), and achieves roughly 0.5% interview rate (20 interviews from 5,000 applications). LinkedIn and Indeed detect the bot activity, risking account suspension.

**Sonara** -- Runs continuously in the background. Every morning it scans job boards, rewrites your resume to mirror each job description's keywords, and submits applications. Sends a daily digest of what was applied to. The pitch is "apply until you're hired." User reviews report poor job matching, high failure rates, applications to expired roles that are never credited back, and AI-generated application answers that are obviously wrong or copy-pasted from the resume.

**JobHire.AI** -- Claims to apply to hundreds of jobs daily with AI-customized resumes and unique cover letters per role. Includes automatic tracking. Reports 87% of users land at least one interview within 30 days. More polished than LazyApply but same fundamental approach.

**AutoApply.Jobs** -- Distinguishes itself by using human operators (not bots) to submit applications, with AI supporting in job matching and answering application questions. This hybrid model avoids bot detection but costs more and moves slower.

**Massive** -- Focuses on "hyper-relevant" matching rather than volume. Curates roles at specific companies rather than carpet-bombing job boards. Different philosophy from the spray-and-pray tools.

**LoopCV** -- Monitors job boards based on criteria (titles, locations, keywords, seniority, work type). When a matching listing is found that supports automated application, the platform submits using stored profile information. Allows review-before-apply mode.

**Simplify Copilot** -- Browser extension that auto-fills application forms on 100+ job boards and ATS portals including Workday, Greenhouse, iCIMS, Taleo, Avature, Lever, and SmartRecruiters. Form-filling only, not end-to-end submission.

### 1.2 What Works and What Fails

The data from user reviews is unambiguous: **high-volume auto-apply with no quality gates produces terrible results.** The 0.5% interview rate from LazyApply is not a technology problem -- it is a strategy problem. Sending 5,000 generic applications trains hiring managers to ignore you, burns your reputation with recruiters who see the same name on dozens of irrelevant roles, and risks platform bans.

What works better:
- **Targeted matching** before any application is sent (Massive's approach)
- **Human review** of AI-generated materials before submission (AutoApply.Jobs' approach)
- **Review-before-apply** mode that generates materials but waits for confirmation (LoopCV's approach)

For Selvi's profile -- 90% callback rate on roles she actually applies to -- the bottleneck is discovery and application speed, not volume. The system should optimize for quality-at-speed, not spray-and-pray.

### 1.3 Key Lesson for Module 3

None of these tools handle the dual corporate/academic split that Selvi's profile requires. Corporate L&D roles want a cover letter and CV. Academic roles want a supporting statement, CV, and sometimes a teaching philosophy. No off-the-shelf tool handles both. We need a custom system.

---

## 2. Legal and Ethical Considerations (UK)

### 2.1 GDPR and the Data (Use and Access) Act 2025

The UK GDPR restricts solely automated decision-making that has a significant effect on individuals. This primarily affects employers using AI to screen candidates, not candidates using AI to apply. However, the candidate's use of automation touches GDPR in several ways:

- **Data the candidate submits** is their own personal data. They have the right to submit it however they choose.
- **Employer privacy notices** may state how application data is processed. Automated submission does not change the data being submitted.
- **No UK law prohibits** a candidate from using automation to submit their own job applications.

The Data (Use and Access) Act 2025 (Royal Assent 19 June 2025) relaxes restrictions on automated decision-making by employers but does not restrict candidate-side automation.

**Bottom line:** There is no UK legal prohibition on automating your own job applications. The restrictions are contractual (platform ToS) and practical (quality, reputation).

### 2.2 Equality Act 2010

The Equality Act prohibits discrimination by employers on protected characteristics. This is relevant because:
- AI-generated cover letters must not inadvertently disclose protected characteristics (age, nationality, disability) beyond what the candidate chooses to share
- The system should not filter out roles based on protected characteristics of the employer

### 2.3 Platform Terms of Service

This is where the real legal risk lives. Platform ToS violations are not criminal matters, but they can result in account suspension or permanent bans, which would be operationally devastating.

| Platform | Automated Applications | Scraping | Bot Detection | Risk Level |
|----------|----------------------|----------|---------------|------------|
| LinkedIn | Explicitly prohibited | Explicitly prohibited | ML-based, detects within hours | **HIGH** |
| Indeed | Explicitly prohibited | Explicitly prohibited | CAPTCHA + rate limiting | **HIGH** |
| Reed.co.uk | No public API for applications | ToS prohibits scraping | Moderate | **MEDIUM** |
| TotalJobs | No application API | ToS prohibits scraping | Moderate | **MEDIUM** |
| CV-Library | Job Search API exists but "not for bulk download" | Limited | Low | **MEDIUM** |
| jobs.ac.uk | Each university has own portal | N/A | Low | **LOW** (per-portal) |
| Guardian Jobs | No application API | ToS prohibits scraping | Low | **LOW** |
| Employer portals | Varies (Workday: anti-bot; others: minimal) | N/A | Varies | **VARIES** |

### 2.4 LinkedIn Specific Risks

LinkedIn's position is unambiguous. They prohibit "third-party software or browser extensions that scrape, modify the appearance of, or automate activity on LinkedIn's website." Their ML detection system analyzes:
- Behavior patterns and timing
- Content relevance
- Device and location consistency
- Browser fingerprints
- DOM manipulation patterns

Penalty escalation:
- **Tier 1:** Features disabled 1-24 hours
- **Tier 2:** Account locked 3-14 days, ID verification required
- **Tier 3:** Permanent ban, <15% recovery rate on appeal

Apollo.io and Seamless.ai were officially banned by LinkedIn in 2025.

**Recommendation for Module 3:** Do NOT automate LinkedIn Easy Apply. The risk-reward ratio is terrible. Instead, surface LinkedIn jobs in Module 1 (discovery) and generate application materials, but require manual submission. LinkedIn is where Selvi's professional reputation lives -- an account ban would cause far more damage than the time saved by automation.

### 2.5 Indeed Specific Risks

Indeed prohibits "robots, spiders, or other automated means to access the Services for any purpose." They impose daily application limits and use CAPTCHA + third-party bot validation. Similar to LinkedIn, the risk of account suspension is real and the account is needed for job discovery.

**Recommendation:** Same as LinkedIn. Generate materials, surface the job, but require manual "click to apply" on Indeed.

### 2.6 Ethical Considerations

Beyond legality:
- **Recruiter fatigue:** Mass auto-applications contribute to the problem of recruiters drowning in irrelevant CVs. Selvi's 90% callback rate exists because she applies thoughtfully. Automated spam would erode that.
- **Reputation risk:** In the UK L&D community (which is small), being known as someone who auto-applies to everything would damage professional reputation.
- **Fairness to other candidates:** Automated applications give an unfair speed advantage. This is ethically grey but practically real.

**The ethical approach:** Automate the preparation (CV tailoring, cover letter drafting), automate email-based applications where the method is already email, but maintain human oversight for platform-based applications.

---

## 3. Platform-by-Platform Application Methods

### 3.1 Application Method Taxonomy

Job applications in the UK fall into five distinct categories, each requiring different automation approaches:

| Method | Description | Automation Feasibility | Platforms |
|--------|-------------|----------------------|-----------|
| **Email** | Send CV + cover letter to an email address | **HIGH** -- straightforward via Resend API | Agency roles, some SME direct hires, some academic roles |
| **One-Click Apply** | Pre-filled from platform profile | **RISKY** -- ToS violations | LinkedIn Easy Apply, Indeed Apply |
| **Web Form** | Fill fields, upload documents, submit | **MEDIUM** -- requires browser automation | Employer career pages, university portals |
| **ATS Portal** | Register, create profile, fill multi-step form | **LOW-MEDIUM** -- complex, anti-bot measures | Workday, Taleo, SuccessFactors, iCIMS, Greenhouse |
| **Agency Submission** | Upload CV to recruitment agency database | **MEDIUM** -- one-time per agency | Hays, Michael Page, Robert Walters, Reed, etc. |

### 3.2 Email-Based Applications

**How it works:** Many roles, particularly those from recruitment agencies and smaller employers, accept applications via email. The job listing provides an email address. The candidate sends a cover letter in the email body (or as attachment) with CV attached as PDF.

**Automation approach:**
- n8n HTTP Request to Resend API
- Attach tailored CV (PDF binary from Module 2)
- Attach or include cover letter
- From a professional email address (not a generic automation address)
- BCC to tracking address for confirmation

**Volume considerations:**
- Resend free tier: 100 emails/day, 3,000/month
- Resend Pro: $20/month for 50,000 emails/month
- Must avoid spam folder: use proper DKIM/SPF/DMARC, personalize each email, avoid spam trigger words

**This is the safest and highest-feasibility automation target.**

### 3.3 Reed.co.uk

Reed has a developer API (reed.co.uk/developers) that supports job search. However, the API is primarily for recruiter use (posting jobs, searching candidate CVs). There is no public API endpoint for submitting applications. Applications go through their web platform. Reed also serves as a recruitment agency and accepts direct CV uploads.

**Automation approach:** Use Reed API for job discovery (Module 1). For application, either:
- Apply manually through the web interface (preferred)
- Submit CV to Reed's agency arm as a one-time setup, then they match and submit on your behalf

### 3.4 TotalJobs

No public application API. Applications submitted through their web portal. They accept CV uploads to their database, and recruiters search the database. No official way to automate application submission without browser automation (which risks detection).

**Automation approach:** Upload CV to their database (one-time). For specific applications, surface the job and generate materials, but apply manually.

### 3.5 CV-Library

Has a Job Search API but it is explicitly "designed to be used on front end websites from within client-side javascript and is not designed to be used for the bulk download of job listings." No application submission API.

**Automation approach:** Same as TotalJobs -- upload CV to database, manual application for specific roles.

### 3.6 jobs.ac.uk (Academic)

jobs.ac.uk is a listing aggregator. It does not process applications itself. Each listing links to the hiring university's own career portal. This means:
- Every university has a different application system
- Most require registration, login, and multi-step form completion
- Common portals: Stonefish, CoreHR, iTrent, custom university builds
- Some older/smaller institutions accept email applications
- Application typically requires: CV, supporting statement, names of referees, equal opportunities monitoring form

**Automation approach:** This is the hardest category to automate. Each university portal is different. Realistic options:
1. **Generate all materials** (supporting statement, CV, referee details) and present as a ready-to-paste package
2. **Use AI browser automation** (Skyvern, browser-use) for the most common portal types -- but this is fragile
3. **Accept that academic applications require manual submission** and focus automation on preparation speed

### 3.7 UK University Career Portals -- Typical Flow

Based on Oxford, Surrey, Nottingham, Open University, and other Russell Group universities:

1. Click "Apply Now" on jobs.ac.uk listing -> redirects to university portal
2. Register for an account (email, password, basic details)
3. Log in to applicant portal
4. Fill multi-page form: personal details, employment history, education, supporting statement, referee details
5. Upload documents: CV (PDF), supporting statement (PDF/DOCX), certificates
6. Complete equal opportunities monitoring (optional but expected)
7. Review and submit

**Key insight:** The registration and form-filling is heavily duplicated. The same education history, employment history, and referee details are entered on every university portal. This is the tedium that automation should target -- not bypassing the portal, but pre-generating all the content so the candidate can paste and upload quickly.

### 3.8 Workday, Taleo, SuccessFactors (Corporate ATS)

Large UK corporates (FTSE 250, multinationals) use enterprise ATS platforms:

- **Workday:** Used by many large UK employers. Has anti-bot filters with ~22% rejection rate for automated tools. DIY automation achieves only ~50% form accuracy. Anti-bot detection is sophisticated.
- **Taleo (Oracle):** Legacy system, still widely used. Less aggressive bot detection than Workday but forms are complex and inconsistent across implementations.
- **SuccessFactors (SAP):** Used by some UK corporates. API exists but is employer-facing, not candidate-facing.
- **Greenhouse, Lever:** Used by tech companies and startups. More modern, sometimes have direct API application endpoints.

**Automation approach:** Do not attempt to automate Workday/Taleo submissions. The failure rate is too high and errors damage the application. Instead:
- Generate tailored CV and cover letter
- Pre-fill a local template with all standard information
- Surface the direct application URL
- Candidate completes the final submission manually (5-10 minutes with pre-generated content vs 30-45 minutes from scratch)

### 3.9 Recruitment Agency Applications

UK recruitment agencies (Hays, Michael Page, Robert Walters, Morgan McKinley, Randstad, Reed) follow a standard pattern:

1. Candidate uploads CV to agency database (one-time)
2. Agency consultant reviews and contacts candidate about matching roles
3. For specific roles: consultant sends candidate details to employer with candidate's permission
4. Some agencies accept speculative email applications

**Automation approach:**
- One-time CV upload to top 10 relevant agencies (manual, done once)
- For agency-advertised roles where application is via email: automate the email submission
- For agency roles requiring portal submission: surface the job and generate materials, manual submission

### 3.10 Application Method Summary by Target Platform

| Platform | Primary Method | Can Automate? | Recommended Approach |
|----------|---------------|---------------|---------------------|
| LinkedIn | Easy Apply / External Link | NO (ToS risk) | Generate materials, manual apply |
| Indeed | Indeed Apply / External Link | NO (ToS risk) | Generate materials, manual apply |
| Reed.co.uk | Web portal | NO (practical) | Upload CV to database, manual apply per role |
| TotalJobs | Web portal | NO (practical) | Upload CV to database, manual apply per role |
| CV-Library | Web portal | NO (practical) | Upload CV to database, manual apply per role |
| jobs.ac.uk universities | Each university's portal | NO (too variable) | Generate all docs, manual submit |
| Guardian Jobs | External links | Varies | Depends on employer method |
| Agency roles (email) | Email with CV | **YES** | Automated email via Resend |
| Agency roles (portal) | Agency portal | NO (practical) | Generate materials, manual apply |
| Direct employer (email) | Email with CV | **YES** | Automated email via Resend |
| Direct employer (Workday) | Workday portal | NO (anti-bot) | Generate materials, manual apply |
| Direct employer (other ATS) | ATS portal | NO (practical) | Generate materials, manual apply |
| CIPD/TrainingZone jobs | External links | Varies | Depends on employer method |

---

## 4. Cover Letter and Supporting Statement Automation

### 4.1 UK Cover Letter Conventions

UK corporate cover letters follow specific conventions that differ from US practice:

**Length and Format:**
- One A4 page, 250-400 words maximum
- 3-4 focused paragraphs
- British English spelling ("organisation" not "organization", "programme" not "program")
- Standard fonts: Arial, Calibri, or Times New Roman, 10-12pt
- PDF format for digital submission
- Conventional margins

**Salutation:**
- If hiring manager name is known: "Dear Mr Smith" or "Dear Ms Jones" -> close with "Yours sincerely"
- If name unknown: "Dear Hiring Manager" or "Dear Sir/Madam" -> close with "Yours faithfully"
- Getting sincerely/faithfully wrong immediately marks the candidate as unfamiliar with UK conventions

**Structure:**
1. **Opening paragraph:** Why you are writing, which role, where you saw it
2. **Middle paragraph(s):** 3-4 key qualifications mapped to role requirements, with evidence
3. **Closing paragraph:** Enthusiasm for the role, availability, call to action

**UK-Specific Elements:**
- Reference UK qualifications (CIPD, PhD from UK university if applicable)
- Use "CV" not "resume"
- Mention right to work in UK if relevant (Selvi has this)
- Reference salary expectations only if the listing requests it

### 4.2 Academic Supporting Statements

Academic applications in the UK rarely use cover letters. They use **supporting statements**, which are fundamentally different documents:

**Key Differences from Cover Letters:**
- Longer: typically 1-3 pages (500-1500 words), sometimes with a specified word limit
- Structured around the person specification criteria
- Each criterion from the job description must be addressed with specific evidence
- Written in a more formal, evidence-based tone
- Often uploaded as a separate document (PDF or DOCX)

**Required Content:**
- How the candidate meets each essential criterion
- How the candidate meets desirable criteria (where applicable)
- Teaching experience and philosophy (for lecturer roles)
- Research interests and publications (for research-active roles)
- Knowledge of the specific institution and its programmes
- Evidence of impact and achievement, not just responsibility

**For Selvi's profile specifically (Lecturer/Senior Lecturer in HRM/HRD/L&D):**
- Teaching experience: corporate training translates but must be framed as pedagogy
- Research: PhD is the credential; publications, conference papers, and research interests matter
- Industry links: 18 years corporate HR/L&D experience is a selling point for applied programmes
- Professional body membership: CIPD fellowship/membership is relevant
- Knowledge of HE: understanding of TEF, NSS, REF if applicable

### 4.3 AI Generation Approach

**The Hallucination Problem:**

AI cover letter generators routinely fabricate details. ChatGPT and similar models will invent skills, exaggerate achievements, and create plausible-sounding but entirely false claims. For a candidate with a 90% callback rate, a single fabricated claim caught at interview would be catastrophic.

**Anti-Hallucination Architecture:**

The system must enforce a strict constraint: **every claim in a cover letter or supporting statement must be traceable to the candidate's actual CV or a pre-approved fact sheet.** The approach:

1. **Source document:** Maintain a master "candidate fact sheet" containing all verifiable claims -- employment dates, job titles, achievements, qualifications, publications, teaching experience, skills, professional memberships. Module 2 (CV tailoring) already creates tailored CVs from this data.

2. **Constrained generation prompt:** The LLM receives the job description, the candidate fact sheet, and the tailored CV. The prompt explicitly states: "You may ONLY reference facts present in the candidate fact sheet or tailored CV. Do not invent, embellish, or infer any claims. If the candidate's experience does not match a requirement, acknowledge the gap or omit it -- never fabricate a match."

3. **Post-generation verification:** A second LLM pass (or rule-based check) compares every factual claim in the generated letter against the source document. Any unverifiable claim is flagged.

4. **Human review for A-tier jobs:** For the highest-priority roles (A+/A scored in Module 1), the generated letter goes to the candidate for review before submission. For B-tier email-only roles, auto-submit with the verified letter.

**Personalization Without Hallucination:**

Genuine personalization comes from the job description, not invented candidate facts:
- Reference specific requirements from the job listing
- Mention the company/university by name
- Reference the specific role title and team (if mentioned)
- Connect candidate's real experience to stated requirements
- Reference industry trends or challenges the employer faces (drawn from job description or employer research, not invented)

### 4.4 Cover Letter Template Architecture

For n8n implementation, use a templated approach with variable injection:

**Corporate L&D Cover Letter Template:**
```
Dear [Hiring Manager Name / "Hiring Manager"],

I am writing to apply for the [Job Title] position at [Company Name],
as advertised on [Source]. With [X] years of experience in Learning &
Development across [sectors from fact sheet], I am confident in my ability
to contribute to [specific from job description].

[Paragraph mapping 2-3 key requirements to verified experience]

[Paragraph on unique value: PhD research applied to practice, MBA
strategic perspective, cross-cultural experience -- all from fact sheet]

I would welcome the opportunity to discuss how my experience aligns with
your needs. I am available [availability from fact sheet] and can be
reached at [contact details].

Yours [sincerely/faithfully],
[Name]
```

**Academic Supporting Statement Template:**
```
Supporting Statement for [Job Title] at [University Name]

[Opening: why this role, why this institution -- reference specific
programmes or research groups mentioned in the listing]

Meeting the Essential Criteria:

[For each essential criterion in the person specification]:
[Criterion text] -- [Evidence from fact sheet mapping to this criterion]

Meeting the Desirable Criteria:

[For each desirable criterion]:
[Criterion text] -- [Evidence or honest acknowledgment of development area]

Teaching and Learning:
[Teaching philosophy and experience drawn from fact sheet]

Research and Scholarship:
[Research interests, publications, PhD topic -- from fact sheet]

Wider Contribution:
[Professional service, industry links, external engagement -- from fact sheet]
```

---

## 5. Application Tracking and Deduplication

### 5.1 Confirming Application Submission

Different methods provide different confirmation signals:

| Method | Confirmation Signal | How to Capture |
|--------|-------------------|----------------|
| Email application | Email sent successfully (Resend webhook) | Resend delivery event -> n8n webhook -> DB update |
| Email application | Read receipt (unreliable) | Resend open tracking |
| Web portal | Confirmation email from employer | Parse inbox for confirmation emails |
| Web portal | Confirmation page/number | Manual entry after submission |
| LinkedIn Easy Apply | In-app confirmation | Manual entry |
| Indeed Apply | In-app confirmation | Manual entry |

For automated email applications, Resend provides webhooks for:
- `email.sent` -- email accepted by Resend
- `email.delivered` -- email delivered to recipient server
- `email.opened` -- recipient opened the email (tracking pixel)
- `email.bounced` -- email bounced
- `email.complained` -- marked as spam

These can trigger n8n webhooks to update the application status in the database.

### 5.2 Tracking Database Schema

Extend the Module 1 jobs table with application tracking:

```sql
-- Application tracking table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) NOT NULL,

    -- Application details
    application_method TEXT NOT NULL,  -- 'email', 'portal', 'linkedin', 'indeed', 'agency'
    application_status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'materials_generated', 'awaiting_approval',
    -- 'submitted', 'confirmed', 'acknowledged', 'rejected',
    -- 'interview_invited', 'withdrawn'

    -- Materials
    cv_version_id UUID,  -- Reference to Module 2 tailored CV
    cover_letter_text TEXT,
    supporting_statement_text TEXT,

    -- Submission details
    submitted_at TIMESTAMPTZ,
    submitted_via TEXT,  -- 'resend', 'manual', 'browser_automation'
    confirmation_reference TEXT,
    confirmation_email_received BOOLEAN DEFAULT FALSE,

    -- Follow-up tracking
    follow_up_due_date DATE,
    follow_up_sent_at TIMESTAMPTZ,

    -- Response tracking
    response_received_at TIMESTAMPTZ,
    response_type TEXT,  -- 'rejection', 'interview_invite', 'further_info_requested'
    response_notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate applications
    UNIQUE(job_id)
);

-- Index for common queries
CREATE INDEX idx_applications_status ON applications(application_status);
CREATE INDEX idx_applications_follow_up ON applications(follow_up_due_date)
    WHERE application_status = 'submitted';
```

### 5.3 Avoiding Duplicate Applications

Multiple layers of deduplication:

1. **Job-level deduplication** (Module 1): The same role from different sources is already deduplicated. One job record, one application record.

2. **Application-level constraint:** The `UNIQUE(job_id)` constraint prevents applying to the same job twice at the database level.

3. **Pre-submission check:** Before generating materials or submitting, the workflow checks: "Has this job_id already been applied to?" If yes, skip.

4. **Employer-level deduplication:** Track applications per employer. If the candidate applied to Company X for Role A last week, flag (but don't block) an application to Company X for Role B this week. The candidate may want to apply to multiple roles at the same employer, but should be aware of it.

5. **Agency deduplication:** If the same role appears through multiple agencies, apply through only one. Track which agency was used. Applying through multiple agencies for the same role is a common faux pas in UK recruitment.

### 5.4 Follow-Up Timing (UK Conventions)

Based on UK recruitment norms:

| Scenario | Wait Before Follow-Up | Follow-Up Method |
|----------|----------------------|-----------------|
| Application submitted, no closing date mentioned | 10-14 working days | Polite email |
| Application submitted before closing date | 5-7 working days after closing date | Polite email |
| Large employer / public sector | 14-21 working days | Polite email |
| University academic role | 14-28 working days (longer cycles) | Email to HR contact |
| Via recruitment agency | 5-7 working days (agency follows up) | Email to agency consultant |
| After interview, awaiting decision | 3-5 working days | Email to interviewer |
| No response after follow-up | Move on, mark as "no response" | No further follow-up |

**Implementation:** When an application is submitted, calculate `follow_up_due_date` based on the job category. An n8n cron workflow checks daily for applications where `follow_up_due_date <= today AND follow_up_sent_at IS NULL`. For email-based applications, it can auto-send a templated follow-up. For portal applications, it sends a reminder to the candidate.

### 5.5 Follow-Up Email Template

```
Subject: Following up -- [Job Title] application ([Reference if available])

Dear [Hiring Manager / Recruitment Team],

I submitted my application for the [Job Title] role [on DATE / via PLATFORM]
and wanted to confirm it was received and express my continued interest in
the position.

I believe my [X years] of experience in [relevant area] aligns well with
the requirements, and I would welcome the opportunity to discuss how I
could contribute to [Company/University].

Please do let me know if you require any further information.

Kind regards,
[Name]
[Contact details]
```

---

## 6. Technical Implementation on n8n

### 6.1 Architecture Overview

Module 3 sits between Module 2 (CV Tailoring) and the candidate's inbox/approval interface. The workflow is:

```
Module 1 (Discovery) -> Module 2 (CV Tailoring) -> Module 3 (Auto Apply)
     |                       |                          |
  Job scored &          CV + materials              Application
  categorized           generated                   submitted or
  (A+/A/B/C/D)                                    queued for
                                                    approval
```

### 6.2 Core Workflow: Application Router

The central workflow decides how to handle each application based on:
- **Job tier** (from Module 1 scoring): A+, A, B, C
- **Application method** available: email, portal, one-click, ATS
- **Automation feasibility:** Can this be automated safely?

```
Job Ready for Application
        |
   [Check Application Method]
        |
   +---------+-----------+-----------+
   |         |           |           |
 Email    Portal    One-Click     ATS
   |         |           |           |
[Check    [Generate   [Generate   [Generate
 Tier]    materials,  materials,  materials,
   |      notify      notify      notify
   |      candidate]  candidate]  candidate]
   |
+------+------+
|      |      |
A+/A   B      C/D
|      |      |
[Queue [Auto   [Auto
for    send    send,
human  with    lower
review] delay]  priority]
```

### 6.3 Email Application Workflow (Detailed)

This is the primary automation target. Workflow nodes:

1. **Trigger:** Webhook from Module 2 ("materials ready for job_id X")
2. **Postgres:** Fetch job details, tailored CV, cover letter
3. **IF Node:** Check job tier
   - A+/A -> Go to approval flow
   - B/C -> Go to auto-send flow
4. **Code Node:** Compose email (subject, body, attachments)
5. **HTTP Request (Resend API):** Send email with:
   - From: selvi@[professional-domain].co.uk
   - To: application email from job listing
   - Subject: "Application: [Job Title] - [Candidate Name]"
   - Body: Cover letter text (formatted HTML)
   - Attachments: Tailored CV (PDF binary)
   - BCC: tracking@[domain] for records
6. **Postgres:** Update application record (status: submitted, submitted_at: now)
7. **Webhook listener:** Resend delivery events update confirmation status

### 6.4 Human Approval Workflow (A-Tier Jobs)

For high-priority roles, the candidate must review before submission:

1. **Trigger:** Job scored A+ or A, materials generated
2. **Send Email (or Telegram):** Notification to candidate with:
   - Job title and link
   - Generated cover letter (for review)
   - Tailored CV summary
   - "Approve" and "Reject" buttons (n8n webhook URLs)
3. **Wait Node:** Pause workflow until candidate responds (timeout: 48 hours)
4. **IF Node:**
   - Approved -> proceed to submission
   - Rejected -> mark as "declined", log reason
   - Timeout -> auto-escalate reminder, then mark as "expired" after 72 hours total
5. **Submit:** Via appropriate method (email or manual notification)

**n8n Implementation Notes:**
- The Wait node holds workflow state until the approval webhook is hit
- Approval buttons are simple webhook URLs with approve/reject parameters
- Timeout handling uses Wait node's built-in timeout with IF branching
- All decisions logged to Postgres for audit

### 6.5 Browser Automation (Limited Scope)

For cases where browser automation is appropriate (low-risk portals, not LinkedIn/Indeed):

**Option 1: Playwright Community Node**
- n8n community node `n8n-nodes-playwright` provides browser automation
- Custom Script operation allows full Playwright API access
- Can navigate pages, fill forms, upload files, click buttons
- Runs in sandboxed environment

**Option 2: Skyvern (AI Browser Agent)**
- Uses LLM + computer vision to understand web forms
- Does not require hardcoded selectors -- adapts to different layouts
- 85.85% accuracy on WebVoyager benchmark
- Handles CAPTCHAs via built-in solving
- Can fill 30-field forms in ~90 seconds
- Self-hosted option available
- Explicitly lists job applications as a top use case

**Option 3: Browserless**
- n8n has native Browserless integration
- Cloud-hosted headless browser service
- Good for screenshots and simple automation
- Less sophisticated than Skyvern for complex forms

**Recommendation:** If browser automation is pursued, Skyvern is the strongest option because it adapts to different form layouts without hardcoded selectors. However, browser automation should be the last resort, not the primary approach. Use it only for:
- Employer career pages that accept only portal applications
- Portals without anti-bot measures
- After thorough testing on each specific portal

### 6.6 Rate Limiting and Anti-Detection

If any browser automation is used:

**Rate Limiting:**
- Maximum 3-5 applications per day via any automated method
- Random delays between actions (2-8 seconds between field fills)
- Random delays between applications (30-120 minutes)
- Never apply to more than 2 roles at the same employer in one day

**Anti-Detection:**
- Rotate user agents
- Use residential proxy IPs (not datacenter)
- Randomize mouse movements and typing speed (Playwright can simulate)
- Maintain persistent browser profiles (cookies, localStorage)
- Do not run during unusual hours (stick to 8am-8pm UK time)

**CAPTCHA Handling:**
- For forms with CAPTCHAs, Skyvern has built-in handling
- Alternatively, services like 2Captcha or NoCaptchaAI solve CAPTCHAs via API
- Cost: ~$1-3 per 1,000 CAPTCHAs solved
- If CAPTCHA frequency increases, it means detection -- back off immediately

### 6.7 Email Sending Configuration (Resend)

**Setup:**
- Domain: verify a professional domain via Resend (e.g., selvi-name.co.uk)
- DKIM, SPF, DMARC records configured for deliverability
- Sender name: "Selvi [Surname]" -- must look like a real person

**Templates:**
- Corporate cover letter template (HTML formatted)
- Academic supporting statement template (plain text or simple HTML)
- Follow-up email template
- Withdrawal email template

**Monitoring:**
- Track delivery rate, open rate, bounce rate via Resend dashboard
- If bounce rate exceeds 5%, investigate and clean recipient list
- If spam complaint rate exceeds 0.1%, stop and review content

---

## 7. Risk Management and Quality Gates

### 7.1 Wrong CV to Wrong Job

This is the single most damaging failure mode. Sending an L&D-tailored CV to an academic lecturer role (or vice versa) would waste the application and potentially damage reputation.

**Mitigation:**
1. **Job type classification** (Module 1): Every job is classified as "corporate" or "academic" with specific sub-categories
2. **CV type matching** (Module 2): Corporate jobs get corporate CV format; academic jobs get academic CV format
3. **Cover letter type matching** (Module 3): Corporate jobs get cover letters; academic jobs get supporting statements
4. **Pre-submission validation:** Before any submission, a validation step checks:
   - Job type matches CV type
   - Cover letter/supporting statement addresses correct role title
   - Company/university name in letter matches job listing
   - Salary expectation (if mentioned) matches job listing
5. **Quarantine on mismatch:** If any validation fails, the application is quarantined for human review, never auto-submitted

### 7.2 Tiered Quality Gates

| Tier | Criteria | Quality Gate | Automation Level |
|------|----------|-------------|-----------------|
| **A+ / A** | Score >= 85, strong match | Human review required | Materials generated, candidate approves before submission |
| **B** | Score 70-84, good match | Auto-validation only | Auto-submit for email; generate-and-notify for portal |
| **C** | Score 55-69, possible match | Auto-validation only | Auto-submit for email; lower priority notification for portal |
| **D** | Score < 55 | Do not apply | Skip -- these were filtered in Module 1 |

### 7.3 Human-in-the-Loop Approval Flow

For A-tier jobs, the approval notification includes:

**What the candidate sees:**
- Job title, company, salary, location
- Match score and key match reasons (from Module 1)
- Generated cover letter / supporting statement (full text)
- Link to tailored CV
- Link to original job listing
- Two buttons: "Approve & Submit" / "Review & Edit First"
- "Decline" option with dropdown (not interested, already applied, wrong fit)

**What happens on approval:**
- "Approve & Submit" -> immediate submission via appropriate method
- "Review & Edit First" -> candidate edits in email/document, then triggers submission manually or via a "submit now" webhook
- "Decline" -> job marked as declined, reason logged, no application

**Timeout behavior:**
- 24 hours: reminder notification
- 48 hours: second reminder with "This job may fill soon"
- 72 hours: auto-expire, mark as "approval_expired"

### 7.4 Withdrawal Process

If an application is sent in error, the system must support withdrawal:

**Automated withdrawal email:**
```
Subject: Application Withdrawal -- [Job Title], [Reference]

Dear [Hiring Manager / Recruitment Team],

I am writing to withdraw my application for the [Job Title] position
at [Company/University], [reference number if available].

Thank you for your time and consideration. I wish you every success
in finding the right candidate for this role.

Kind regards,
[Name]
```

**Implementation:**
- Candidate clicks "Withdraw" on any submitted application in the tracking dashboard
- System checks application method:
  - If email-based: auto-send withdrawal email
  - If portal-based: notify candidate to withdraw via portal (provide link)
- Update application status to "withdrawn"
- Log reason for future pattern analysis

### 7.5 Error Recovery

| Error Scenario | Detection | Recovery |
|---------------|-----------|---------|
| Email bounced | Resend bounce webhook | Flag job listing email as invalid, notify candidate |
| Wrong CV attached | Pre-submission validation | Quarantine, never reaches submission |
| Cover letter references wrong company | Post-generation name check | Regenerate with correct details |
| Application form partially filled (browser automation) | Skyvern/Playwright error handler | Abandon submission, notify candidate, mark as "failed" |
| Duplicate application detected | DB unique constraint | Skip silently, log |
| Rate limit hit on platform | HTTP 429 response | Back off, retry after delay, alert if persistent |
| Account suspended on platform | Login failure detection | Immediate alert to candidate, pause all automation for that platform |

---

## 8. Recommended Architecture for Module 3

### 8.1 Three-Track System

Given the research findings, Module 3 should operate on three parallel tracks:

**Track 1: Automated Email Applications (Full Automation)**
- For jobs where the application method is "send CV to email address"
- System generates cover letter, attaches tailored CV, sends via Resend
- A-tier: human approval before send
- B/C-tier: auto-send with validation
- Estimated volume: 20-30% of all applications

**Track 2: Preparation-Only (Human Submits)**
- For jobs on LinkedIn, Indeed, Reed, TotalJobs, CV-Library, university portals, Workday, Taleo
- System generates all materials (cover letter, supporting statement, tailored CV)
- Packages everything into a "ready to apply" bundle
- Sends notification: "Apply to [Job Title] at [Company] -- materials ready, click here to start"
- Includes direct link to application page
- Candidate copies/pastes and submits manually
- Estimated volume: 60-70% of all applications

**Track 3: Assisted Portal Applications (Optional, Phase 2)**
- For employer career pages where browser automation is feasible and low-risk
- Uses Skyvern or Playwright to pre-fill forms
- Candidate reviews pre-filled form and clicks submit manually
- Only for portals that have been tested and verified safe
- Estimated volume: 5-10% of all applications, only after Track 1 and 2 are stable

### 8.2 Implementation Priority

**Phase 1 (Week 1-2): Foundation**
- Application tracking database schema
- Cover letter generation pipeline (corporate template)
- Supporting statement generation pipeline (academic template)
- Anti-hallucination validation
- Deduplication checks

**Phase 2 (Week 3-4): Email Automation**
- Resend integration for email-based applications
- A-tier approval workflow with Wait node
- B/C-tier auto-send workflow
- Delivery confirmation via Resend webhooks
- Follow-up scheduling

**Phase 3 (Week 5-6): Preparation Pipeline**
- "Ready to apply" notification system
- Material packaging (CV + cover letter + application URL)
- Candidate dashboard or email digest of pending applications
- Status tracking for manual submissions

**Phase 4 (Week 7-8): Follow-Up Automation**
- Automated follow-up emails at appropriate intervals
- Response tracking (parse inbox for replies)
- Withdrawal workflow
- Application analytics (submission rate, response rate, by platform)

**Phase 5 (Optional, later): Browser Automation**
- Skyvern integration for low-risk portals
- Test on 3-5 employer career pages
- Build library of verified portal configurations
- Only expand if success rate > 90%

### 8.3 Daily Application Volume Targets

Based on the candidate's profile and market:

| Category | Daily Target | Weekly Target | Method |
|----------|-------------|---------------|--------|
| A+ tier (perfect match) | 0-1 | 1-3 | Human-reviewed, manual or auto-email |
| A tier (strong match) | 1-2 | 5-10 | Human-reviewed for portal, auto for email |
| B tier (good match) | 2-4 | 10-20 | Auto-email where possible, prep-only for portal |
| C tier (possible match) | 0-2 | 5-10 | Auto-email only, skip portal applications |

Total: 3-9 applications per day, 21-43 per week. This is a targeted, quality-focused approach -- the opposite of LazyApply's 5,000-application carpet bombing.

### 8.4 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Orchestration | n8n (self-hosted) | Workflow automation |
| Database | PostgreSQL (existing) | Application tracking |
| LLM (generation) | Claude Sonnet | Cover letter/supporting statement generation |
| LLM (validation) | Claude Haiku | Anti-hallucination checks |
| Email sending | Resend API | Automated email applications |
| Email receiving | Gmail API or IMAP | Confirmation and response parsing |
| Notifications | Telegram or Email | Candidate alerts and approvals |
| Browser automation | Skyvern (optional, Phase 5) | Portal form filling |
| File generation | n8n Code node | PDF generation for documents |
| Monitoring | n8n execution logs + Postgres | Error tracking and analytics |

### 8.5 Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Resend Pro (email sending) | ~$20/month (50k emails, will use <500) |
| Claude API (cover letter generation, ~200 calls/month) | ~$15-25/month |
| Skyvern (if used, self-hosted) | $0 (self-hosted) or ~$50/month (cloud) |
| CAPTCHA solving (if needed) | ~$5/month |
| **Total incremental** | **~$40-50/month** |

---

## Sources

### Auto-Apply Tools
- [AI Job Application Tools Compared: JobHire.ai vs LazyApply vs AIApply](https://career-upside.com/ai-job-application-tools-compared-jobhire-ai-vs-lazyapply-vs-aiapply/)
- [AI-Powered Job-Hunting Automation in 2025](https://gracker.ai/blog/ai-job-apply-bots-2025)
- [Sonara: AI Job Search Tool & AI Auto Apply](https://www.sonara.ai/)
- [Massive | Hyper-relevant roles](https://usemassive.com/)
- [AutoApply.Jobs](https://www.autoapply.jobs/home)
- [LazyApply Review 2026: Does It Actually Work?](https://www.wobo.ai/blog/lazyapply-review/)
- [LazyApply Trustpilot Reviews](https://www.trustpilot.com/review/lazyapply.com)
- [Sonara AI Reviews](https://www.tealhq.com/post/sonara-review)

### Legal and Compliance
- [ICO: UK GDPR and Automated Decision-Making](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/automated-decision-making-and-profiling/what-does-the-uk-gdpr-say-about-automated-decision-making-and-profiling/)
- [Data (Use and Access) Act 2025 Analysis](https://www.debevoisedatablog.com/2025/11/19/the-uks-new-automated-decision-making-rules-and-how-they-compare-to-the-eu-gdpr/)
- [ICO: Employment Practices - Recruitment and Selection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/)
- [AI and Employment Law in England 2025](https://lawyermag.co.uk/ai-and-employment-law-in-england/)

### LinkedIn and Indeed Policies
- [LinkedIn: Automated Activity Policy](https://www.linkedin.com/help/linkedin/answer/a1340567)
- [LinkedIn: Prohibited Software and Extensions](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions?lang=en)
- [LinkedIn Automation Ban Risk 2026](https://growleads.io/blog/linkedin-automation-ban-risk-2026-safe-use/)
- [LinkedIn Automation Safety Guide 2026](https://www.dux-soup.com/blog/linkedin-automation-safety-guide-how-to-avoid-account-restrictions-in-2026)
- [Indeed Terms of Service](https://www.indeed.com/legal)
- [Indeed Apply Partner Terms](https://docs.indeed.com/legal-terms/indeed-apply)

### UK Job Boards
- [Reed.co.uk Developer API](https://www.reed.co.uk/developers/Jobseeker)
- [CV-Library Job Search API](https://www.cv-library.co.uk/developers/job-search-api)
- [jobs.ac.uk](https://www.jobs.ac.uk/)
- [How to Apply for an Academic Job](https://career-advice.jobs.ac.uk/resources/how-to-apply-for-an-academic-job/)

### Cover Letters and Supporting Statements
- [UK Cover Letter Format](https://www.livecareer.co.uk/cover-letter/cover-letter-format)
- [How to Write a Cover Letter for UK Market 2025](https://www.robertwalters.co.uk/insights/career-advice/e-guide/how-to-write-a-cover-letter.html)
- [Cover Letter Length 2026](https://www.cvmaker.uk/blog/cover-letter/cover-letter-length)
- [Supporting Statement vs Cover Letter](https://thejobstudio.co.uk/application-advice/what-is-the-difference-between-a-supporting-statement-and-a-cover-letter/)
- [Oxford University: CV and Supporting Statement](https://www.jobs.ox.ac.uk/cv-and-supporting-statement)

### Technical Implementation
- [n8n-playwright Community Node](https://github.com/toema/n8n-playwright)
- [n8n-nodes-puppeteer](https://github.com/drudge/n8n-nodes-puppeteer)
- [n8n Browserless Integration](https://n8n.io/integrations/browserless/)
- [n8n Human-in-the-Loop Automation](https://blog.n8n.io/human-in-the-loop-automation/)
- [n8n Send Email with Attachments](https://agentforeverything.com/send-email-with-attachments-in-n8n/)
- [Resend n8n Community Node](https://communitynodes.com/n8n-nodes-resend/)
- [Skyvern AI Browser Automation](https://www.skyvern.com/)
- [Skyvern: Automate Form Filling](https://www.skyvern.com/blog/automate-form-filling-with-skyvern-ai-browser-automation/)

### ATS and Portal Automation
- [Workday Application Automator](https://github.com/ubangura/Workday-Application-Automator)
- [Why Cheap AI Apply Tools Fail on Workday](https://scale.jobs/blog/cheap-ai-apply-tools-fail-workday-applications)
- [Simplify Copilot](https://simplify.jobs/copilot)

### Follow-Up and Withdrawal
- [UK Follow-Up Timing Conventions](https://uk.indeed.com/career-advice/finding-a-job/how-long-does-it-take-to-hear-back-from-a-job-application)
- [How to Withdraw a Job Application UK](https://uk.indeed.com/career-advice/finding-a-job/how-to-withdraw-application)

### Job Application Workflows
- [n8n: AI-Powered Automated Job Search & Application](https://n8n.io/workflows/6391-ai-powered-automated-job-search-and-application/)
- [n8n: Automated Job Applications & Status Tracking](https://n8n.io/workflows/5906-automated-job-applications-and-status-tracking-with-linkedin-indeed-and-google-sheets/)
- [n8n: Job Applying Agent](https://n8n.io/workflows/7889-job-applying-agent/)
- [How I Built an Automated Job Outreach System Using n8n](https://medium.com/@gabrielchege/how-i-built-an-automated-job-outreach-system-using-n8n-firecrawl-and-gpt-27348efa60c7)
