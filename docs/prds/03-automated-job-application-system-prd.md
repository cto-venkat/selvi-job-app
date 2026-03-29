# Module 3: Automated Job Application System -- Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-29
**Author:** Selvi Job App Engineering
**Status:** Draft
**System:** Selvi Job App
**Module:** 03 -- Auto-Apply

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Application Method Detection & Routing](#6-application-method-detection--routing)
7. [Email-Based Application Engine](#7-email-based-application-engine)
8. [Web Portal Application Assistant](#8-web-portal-application-assistant)
9. [LinkedIn Application Integration](#9-linkedin-application-integration)
10. [Quality Gates & Human-in-the-Loop](#10-quality-gates--human-in-the-loop)
11. [Application Tracking & Confirmation](#11-application-tracking--confirmation)
12. [Rate Limiting & Anti-Detection](#12-rate-limiting--anti-detection)
13. [Legal & Ethical Compliance](#13-legal--ethical-compliance)
14. [Database Schema](#14-database-schema)
15. [n8n Workflow Specifications](#15-n8n-workflow-specifications)
16. [Integration with Modules 1 & 2](#16-integration-with-modules-1--2)
17. [Error Handling & Monitoring](#17-error-handling--monitoring)
18. [Privacy & Data Protection](#18-privacy--data-protection)
19. [Rollout Plan](#19-rollout-plan)

---

## 1. Executive Summary

The Automated Job Application System is the third and final module of the Selvi Job App pipeline. It receives tailored CV and cover letter packages from Module 2 (CV Tailoring) and submits job applications through the appropriate channel for each role -- email, web portal, LinkedIn, or manual queue.

The candidate achieves a 90% callback rate on roles she applies to. The constraint has never been application quality -- it is application volume. Every hour spent navigating Workday portals, composing emails, and filling out redundant web forms is an hour not spent on interview preparation or networking. This module exists to reclaim that time.

The system operates on a two-tier model:

**Tier 1 -- Fully Automated:** Email-based applications and simple API-based submissions. The system composes a professional application email using Claude, attaches the tailored CV and cover letter from Module 2, sends it via Resend, and logs the submission. For B-tier jobs with email-based application methods, this happens without human intervention. For A-tier jobs, the system prepares everything but holds for a single-click human approval before sending.

**Tier 2 -- Assisted Manual:** Complex web portals (Workday, Taleo, Stonefish, Jobtrain, SuccessFactors), LinkedIn Easy Apply, and any channel that requires browser-based interaction. The system cannot and should not automate these -- doing so violates platform terms of service and creates brittle, maintenance-heavy scrapers. Instead, the system prepares all required materials, pre-fills data where possible, generates clipboard-ready text blocks, and provides a structured task with exact instructions and links. What was a 20-minute manual task becomes a 3-5 minute copy-paste exercise.

The architecture is built entirely on n8n workflows with Postgres for state management, Resend for email delivery, and Claude for generating application-specific content (email bodies, form-field text, cover letter adjustments). It runs on the existing Hetzner CAX31 infrastructure alongside Modules 1 and 2.

The system processes 5-15 A-tier and 15-30 B-tier jobs per week from Module 1's scoring pipeline. At steady state, it should submit 20-40 applications per week with less than 15 minutes of daily human involvement -- down from 2-3 hours of manual application work.

---

## 2. Problem Statement

### 2.1 The Application Bottleneck

Module 1 solves job discovery. Module 2 solves CV tailoring. But neither solves the final step: getting the application submitted. The candidate currently discovers 80-150 jobs per week, of which 20-45 are worth applying to (A-tier and B-tier). Each application requires:

1. Identifying the correct application method (email, portal, Easy Apply, recruiter contact)
2. Navigating to the application page or composing an email
3. Filling out form fields (name, email, phone, address, right to work status, education, work history -- often redundant information already on the CV)
4. Uploading the correct tailored CV and cover letter
5. Writing an application email or cover letter preamble specific to the method
6. Reviewing and submitting
7. Tracking the submission

For email-based applications, steps 2-6 take 5-10 minutes. For web portals, they take 15-30 minutes. For complex enterprise portals like Workday or Taleo, the process can take 30-45 minutes per application due to multi-page forms, account creation requirements, and arbitrary form validation.

At 25-35 applications per week, this represents 8-15 hours of repetitive, low-value work. The candidate is doing the same task -- entering the same personal details, uploading the same types of documents, writing variations of the same introduction -- dozens of times per week.

### 2.2 The Speed-to-Apply Problem

In competitive job markets, early applicants have an advantage. A role posted Monday morning that receives an application by Monday afternoon is more likely to be read than one arriving Wednesday. Research from Glassdoor and Indeed indicates that candidates who apply within the first 48 hours are 2-3x more likely to receive a response than those who apply after 7 days.

Module 1 discovers jobs within hours of posting. Module 2 can generate tailored materials within minutes. But if the actual submission waits for the candidate to find 20 minutes between meetings to navigate a web portal, the speed advantage evaporates. For email-based applications, the system can close this gap to near-zero.

### 2.3 The Consistency Problem

Manual applications introduce inconsistency. A rushed application at 10 PM after a long day will have a different quality than one carefully composed on a Saturday morning. Email subject lines vary. Cover letter openings drift. Key selling points get forgotten. The system must enforce a consistent quality floor across every submission while still adapting each application to the specific role.

### 2.4 The Tracking Problem

Without a system, application tracking is manual. Spreadsheets fall out of date. Emails get buried. The candidate loses track of which roles she has applied to, which are pending, and which need follow-up. This module creates a single source of truth for every application's status, method, and outcome.

### 2.5 The Method Diversity Problem

UK job applications arrive through at least seven distinct channels:

| Channel | Prevalence | Automation Feasibility |
|---------|-----------|----------------------|
| Direct email to recruiter/hiring manager | 25-30% | High -- fully automatable |
| Agency email (responding to advertised role) | 15-20% | High -- fully automatable |
| LinkedIn Easy Apply | 15-20% | Low -- API restricted |
| Company career portal (simple form) | 10-15% | Medium -- varies by portal |
| Enterprise ATS portal (Workday, Taleo, etc.) | 10-15% | Very Low -- complex, ToS issues |
| University-specific portals (Stonefish, Jobtrain) | 5-10% | Very Low -- bespoke systems |
| Indeed Apply / TotalJobs Apply | 5-10% | Low -- API restricted |

No single automation strategy covers all channels. The system must detect the method, route to the appropriate engine, and handle each channel's specific requirements.

### 2.6 What This Module Does Not Do

This module does not:

- **Replace human judgment for high-value applications.** A-tier roles require human review before submission. The system prepares; the human decides.
- **Hack or circumvent platform security.** No browser automation against platforms that prohibit it. No fake user agents. No CAPTCHA solving.
- **Guarantee delivery.** Emails can bounce. Portals can reject. The system tracks failures and retries where appropriate, but some applications will fail and require manual intervention.
- **Handle interview scheduling or follow-up.** That is a future module.
- **Apply to jobs the candidate has not been scored on.** Every application originates from Module 1's scoring pipeline.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Reduce manual application time | From 8-15 hours/week to < 2 hours/week | Self-reported time tracking |
| Maintain or improve callback rate | >= 85% callback rate on applications submitted | Track responses per application method |
| Application volume | 20-40 applications submitted per week | Database count of status = 'submitted' |
| Time-to-apply for email applications | < 30 minutes from Module 2 output to submission | Timestamp delta: cv_generated_at to application_submitted_at |
| Time-to-apply for portal applications | < 4 hours from Module 2 output to manual task completion | Timestamp delta: cv_generated_at to application_submitted_at |
| Zero duplicate applications | 0 duplicate submissions to same role | Dedup check before every submission |

### 3.2 Secondary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Email deliverability | > 95% delivery rate (not bounced) | Resend delivery webhooks |
| Application method detection accuracy | > 90% correct routing on first attempt | Manual audit, weekly |
| Human approval turnaround for A-tier | < 2 hours median from notification to approval | Timestamp delta |
| System reliability | < 2% failed submissions due to system errors | Error rate monitoring |
| Manual task preparation quality | < 5 minutes median to complete a prepared manual task | Self-reported timing |

### 3.3 Success Metrics (Weekly Dashboard)

- **Total applications submitted** (automated + manual assisted)
- **Applications by method** (email / portal-assisted / LinkedIn / other)
- **Applications by tier** (A-tier / B-tier)
- **Automation rate** (percentage of applications fully automated vs. manual assisted)
- **Email delivery rate** (delivered / bounced / deferred)
- **Mean time-to-apply** by method
- **Human approval queue depth** (pending approvals at any point)
- **Failed applications** (count and reason breakdown)
- **Duplicate prevention hits** (applications blocked by dedup)
- **Callback rate by method** (responses received / applications sent, by channel)

### 3.4 Anti-Goals

These are explicitly not goals:

- **Maximizing raw application volume.** Quality matters more than quantity. A 90% callback rate on 25 applications beats a 20% callback rate on 100 applications.
- **100% automation.** Some applications are better done manually. The system optimizes for the right balance, not total automation.
- **Replacing recruiter relationships.** Email applications to known recruiters should feel personal, not automated. The system generates drafts that the candidate can personalize.

---

## 4. User Stories

### 4.1 Core Application Stories

**US-301: Automated Email Application**
As Selvi, I want the system to automatically send a professional application email with my tailored CV and cover letter attached when a B-tier job has an email-based application method, so that I can apply to more roles without spending time on repetitive email composition.

**Acceptance Criteria:**
- Email is composed using Claude with role-specific context
- Tailored CV (PDF) and cover letter (PDF) from Module 2 are attached
- Email subject line follows a professional format appropriate to the context (direct application vs. agency response)
- Application is logged in the tracking database with full metadata
- Email is sent via Resend with proper sender identity
- Delivery status is tracked via Resend webhooks

**US-302: A-Tier Application Approval**
As Selvi, I want the system to prepare a complete application package for A-tier jobs and send me a notification with a one-click approval button, so that I can review high-value applications before they go out while spending minimal time on the review.

**Acceptance Criteria:**
- System prepares full application package (email draft, CV, cover letter)
- Notification email includes: job title, company, tier score, application method, email preview, and an approve/reject link
- Approve link triggers immediate submission
- Reject link with optional feedback reason
- If not approved within 24 hours, send a reminder
- If not approved within 48 hours, auto-expire with notification

**US-303: Portal Application Preparation**
As Selvi, I want the system to prepare all materials and instructions for web portal applications, so that I can complete portal-based applications in under 5 minutes instead of 20-30 minutes.

**Acceptance Criteria:**
- System identifies the specific portal type (Workday, Taleo, Stonefish, generic)
- Generates a structured task card with: portal URL, login credentials reminder (if applicable), step-by-step instructions, all form field values pre-formatted, CV and cover letter files ready for upload
- Clipboard-ready text blocks for common fields (personal statement, work history summary, etc.)
- Task card delivered via email with all attachments
- Status tracked as "pending_manual" until candidate marks complete

**US-304: Application Status Tracking**
As Selvi, I want a single view of all my application statuses, so that I know what has been submitted, what is pending, and what needs follow-up.

**Acceptance Criteria:**
- Every application has a status: queued, pending_approval, approved, submitted, pending_manual, completed, failed, expired, withdrawn
- Daily summary includes application pipeline status
- Ability to mark applications as "response_received" or "rejected" for callback rate tracking

**US-305: Duplicate Prevention**
As Selvi, I want the system to prevent me from applying to the same role twice, even if the role appears from multiple sources or is reposted, so that I avoid the embarrassment and wasted effort of duplicate applications.

**Acceptance Criteria:**
- Before any submission, system checks for existing applications to the same company + similar role title within the last 90 days
- Uses fuzzy matching (company name normalization + title similarity > 0.8) to catch near-duplicates
- Blocks the duplicate and logs the reason
- Allows manual override if the candidate confirms it is a different role

### 4.2 Email Application Stories

**US-306: Direct Application Email**
As Selvi, I want direct application emails to be professional, warm, and specific to the role, not templated-feeling, so that they achieve the same callback rate as my manually written emails.

**Acceptance Criteria:**
- Email references specific aspects of the role from the job description
- Mentions 2-3 directly relevant qualifications from the candidate profile
- Tone is professional but personable -- not robotic, not overly casual
- UK English spelling and conventions throughout
- No AI-detectable patterns (no "I am writing to express my keen interest" or similar)
- Includes proper closing with full candidate contact details

**US-307: Agency Response Email**
As Selvi, I want emails to recruitment agencies to follow agency conventions (slightly different from direct employer emails), so that the response feels natural to agency recruiters.

**Acceptance Criteria:**
- Subject line references the job title and any reference number from the posting
- Email acknowledges the agency relationship ("I saw your posting for...")
- Briefer than direct applications -- agencies prefer concise responses
- Mentions availability for a call/screening
- Attaches CV in the format the agency prefers (usually DOCX for agencies, PDF for employers)

**US-308: Speculative Application Email**
As Selvi, I want the system to support speculative applications to companies where no specific vacancy is listed but the company is a strong match, so that I can access the hidden job market.

**Acceptance Criteria:**
- System can receive a manually triggered speculative application request with: company name, target department/role, reason for interest
- Generates a tailored speculative email using the master CV and a custom cover letter
- Different tone from vacancy-response emails -- focuses on what the candidate can bring, not on a specific job spec
- Tracks separately in the database with type = 'speculative'

### 4.3 Portal Application Stories

**US-309: Workday Portal Preparation**
As Selvi, I want Workday-specific application preparation that accounts for Workday's multi-page form structure, so that I can complete Workday applications quickly.

**Acceptance Criteria:**
- System knows Workday's standard form structure: Personal Info -> Work History -> Education -> Skills -> Documents -> Review
- Pre-formats all field values in Workday-compatible format
- Generates work history entries in reverse chronological order with dates formatted as MM/YYYY
- Reminds about Workday-specific requirements (e.g., "Workday may auto-parse your CV -- review parsed data before proceeding")
- Provides the correct CV format for Workday (DOCX preferred for auto-parsing, PDF as fallback)

**US-310: University Portal Preparation**
As Selvi, I want university-specific application preparation that accounts for academic hiring requirements, so that I can complete university applications efficiently.

**Acceptance Criteria:**
- System detects university-specific portals (Stonefish, Jobtrain, CoreHR, individual university systems)
- Includes academic-specific fields: teaching philosophy, research statement summary, publications list, referee details
- Formats education section with full qualification names (not abbreviations)
- Reminds about common university requirements: equality monitoring form, right to work declaration, referee contact details
- Generates clipboard text for "supporting statement" fields common in UK HE applications

**US-311: Generic Web Form Preparation**
As Selvi, I want preparation materials for generic web forms that I encounter on smaller company career pages, so that I can fill out any form quickly.

**Acceptance Criteria:**
- System provides a "universal form data" package with all common fields pre-filled
- Personal details, work history, education, skills, references -- all formatted for copy-paste
- Supporting statement / cover letter adapted to the specific role
- File attachments ready in both PDF and DOCX formats

### 4.4 System Management Stories

**US-312: Application Rate Configuration**
As Selvi, I want to control the rate at which automated applications are sent, so that I can avoid triggering spam filters or appearing to mass-apply.

**Acceptance Criteria:**
- Configurable maximum applications per hour (default: 3)
- Configurable maximum applications per day (default: 15)
- Configurable quiet hours (default: no sends between 10 PM and 7 AM)
- Rate limits apply only to automated email submissions, not manual tasks

**US-313: Application Pause**
As Selvi, I want to pause all automated applications with a single action from any device, so that I can stop the system instantly if I receive an offer, go on holiday, or need to recalibrate.

**Acceptance Criteria:**
- **Multiple pause mechanisms (any one works):**
  - Reply "PAUSE" to any system email (daily digest, approval notification, task card)
  - Click a prominent [PAUSE ALL] link included in every daily digest and every approval email
  - Telegram bot command: `/pause` (if Telegram integration active)
  - Database flag toggle (technical fallback)
- Pausing is instant: no queued applications are sent after the pause signal is received
- Queued applications are preserved, not discarded
- Manual task preparation continues (so queue does not grow stale)
- **On resume:** applications queued more than 7 days are auto-expired (jobs may be filled); remaining queued applications are presented for review before sending, not blindly fired off
- **Offer scenario:** when the candidate logs `response_type = 'offer'` for any application, the system auto-suggests pausing with a notification: "You received an offer from {company}. Pause all automated applications?"
- Resume sends reviewed applications with rate limiting applied

**US-314: Weekly Application Report**
As Selvi, I want a weekly summary of all application activity, so that I can track my pipeline and identify issues.

**Acceptance Criteria:**
- Sent every Sunday evening or Monday morning
- Includes: applications submitted this week (by method), pending approvals, pending manual tasks, failed submissions, callback rate (if response data entered), top employers applied to
- Compares to previous week

**US-315: Application Withdrawal**
As Selvi, I want to mark applications as withdrawn if I decide not to proceed with a role, so that my tracking data remains accurate and the system does not send follow-ups for withdrawn applications.

**Acceptance Criteria:**
- Withdrawal status prevents any future automated action for that application
- Logs withdrawal reason (optional)
- Updates weekly report metrics

### 4.5 Edge Case Stories

**US-316: Application Method Change**
As Selvi, I want the system to handle cases where the detected application method is wrong (e.g., email address no longer valid, portal URL changed), so that failed applications are recovered.

**Acceptance Criteria:**
- If an email bounces, the application is re-queued with status "method_failed"
- Notification sent to candidate with alternative application methods if available
- Manual override to change method and re-submit

**US-317: Multi-Stage Application**
As Selvi, I want the system to handle roles that require multiple application steps (e.g., submit CV via portal, then email supplementary materials), so that I do not miss required steps.

**Acceptance Criteria:**
- System can track multi-step applications with a checklist of required actions
- Each step has its own status
- Notifications remind about incomplete steps

**US-318: Application with Supplementary Documents**
As Selvi, I want the system to handle applications that require documents beyond CV and cover letter (e.g., teaching philosophy statement, research proposal, diversity statement), so that I am prepared for academic and public sector applications.

**Acceptance Criteria:**
- System detects supplementary document requirements from job description analysis (Module 1 metadata)
- Alerts candidate if supplementary documents are needed
- Stores reusable supplementary documents in a document library
- Attaches appropriate supplementary documents when available

**US-319: Referral-Based Application**
As Selvi, I want the system to handle applications where I have a referral or internal contact, so that I can leverage my network while still using the automated preparation features.

**Acceptance Criteria:**
- Application can be flagged as "referral" with referee name and relationship
- Email template adjusts to mention the referral naturally
- System suggests mentioning referral in portal cover letters
- Tracks referral applications separately for callback rate comparison

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
+-----------------------------------------------------------------------+
|                          Selvi (Candidate)                            |
|                                                                       |
|  +------------------+   +-------------------+   +------------------+  |
|  | Morning Digest   |   | A-Tier Approval   |   | Manual Task      |  |
|  | (application     |   | Notification      |   | Cards            |  |
|  | status summary)  |   | (approve/reject)  |   | (portal prep)    |  |
|  +--------+---------+   +--------+----------+   +--------+---------+  |
+-----------|----------------------|------------------------|------------+
            |                      |                        |
            v                      v                        v
+-----------------------------------------------------------------------+
|                    Module 3: Auto-Apply Engine                         |
|                                                                       |
|  +------------------+   +-------------------+   +------------------+  |
|  | WF-AP1:          |   | WF-AP2:           |   | WF-AP3:          |  |
|  | Application      |   | Email Application |   | Portal           |  |
|  | Router           |   | Engine            |   | Preparation      |  |
|  | (method detect   |   | (compose, send,   |   | Engine           |  |
|  |  + routing)      |   |  track via Resend)|   | (task card gen)  |  |
|  +--------+---------+   +--------+----------+   +--------+---------+  |
|           |                      |                        |           |
|  +--------v---------+   +-------v-----------+   +--------v---------+ |
|  | WF-AP4:          |   | WF-AP5:           |   | WF-AP6:          | |
|  | Quality Gate     |   | Approval          |   | Application      | |
|  | & Dedup Check    |   | Handler           |   | Status Tracker   | |
|  |                  |   | (webhook-based)   |   | & Reporter       | |
|  +--------+---------+   +-------------------+   +------------------+ |
|           |                                                           |
+-----------|-----------------------------------------------------------+
            |
            v
+-----------------------------------------------------------------------+
|                         Shared Infrastructure                         |
|                                                                       |
|  +------------------+   +-------------------+   +------------------+  |
|  | PostgreSQL       |   | Resend API        |   | Claude API       |  |
|  | (selvi_jobs DB)  |   | (email delivery   |   | (email body      |  |
|  |                  |   |  + webhooks)       |   |  generation)     |  |
|  +------------------+   +-------------------+   +------------------+  |
|                                                                       |
|  +------------------+   +-------------------+                         |
|  | Module 1:        |   | Module 2:         |                         |
|  | Job Discovery    |   | CV Tailoring      |                         |
|  | (job data,       |   | (tailored CV +    |                         |
|  |  scores, tiers)  |   |  cover letter)    |                         |
|  +------------------+   +-------------------+                         |
+-----------------------------------------------------------------------+
```

### 5.2 Workflow Architecture

Module 3 consists of 6 core workflows, 2 sub-workflows, and 1 utility workflow, all communicating through the shared Postgres database.

| Workflow | Trigger | Schedule / Event | Purpose |
|----------|---------|-----------------|---------|
| WF-AP1: Application Router | Cron | Every 15 minutes, 7AM-10PM | Pick up ready-to-apply jobs, detect method, route to engine |
| WF-AP2: Email Application Engine | Called by WF-AP1 | Event-driven | Compose and send email applications |
| WF-AP3: Portal Preparation Engine | Called by WF-AP1 | Event-driven | Generate manual task cards for portal applications |
| WF-AP4: Quality Gate | Sub-workflow | Called before every submission | Dedup check, rate limit check, quality validation |
| WF-AP5: Approval Handler | Webhook | On candidate action (approve/reject) | Process A-tier approval decisions |
| WF-AP6: Status Tracker & Reporter | Cron | Daily at 7:00 AM + Weekly Sunday 8 PM | Update statuses, send summaries |
| SW-AP1: Email Composer | Sub-workflow | Called by WF-AP2 | Claude-powered email body generation |
| SW-AP2: Resend Delivery Tracker | Webhook | Resend webhook events | Track email delivery/bounce/open status |
| WF-AP0: Global Error Handler | n8n Error Trigger | On any Module 3 workflow failure | Log errors, alert, attempt recovery |

**Schedule Staggering with Modules 1 and 2:**

Module 1 workflows run on the hour and half-hour. Module 3's Application Router runs at :15 and :45, ensuring it picks up freshly scored and tailored jobs without colliding with Module 1's scoring pipeline.

```
:00  Module 1 -- RSS Poller, Dedup & Cleanup
:15  Module 3 -- Application Router (picks up newly tailored jobs)
:30  Module 1 -- AI Scoring Pipeline, Email Alert Parser
:45  Module 3 -- Application Router (second pass)
```

### 5.3 Data Flow

```
Module 1                    Module 2                    Module 3
(Discovery)                 (Tailoring)                 (Application)

Job discovered  ------>     Job scored A/B  ------>     Ready-to-apply
+ scored                    CV tailored                 detected
+ stored in DB              CL generated                |
                            Stored in DB                v
                                                    Method detected
                                                        |
                                    +-------------------+-------------------+
                                    |                                       |
                                    v                                       v
                            Email-based                             Portal-based
                                    |                                       |
                                    v                                       v
                            Quality Gate                            Quality Gate
                            (dedup + rate)                          (dedup only)
                                    |                                       |
                            +-------+-------+                               v
                            |               |                       Task card
                            v               v                       generated
                        A-tier          B-tier                          |
                        (hold for       (auto-send)                     v
                        approval)           |                       Notification
                            |               v                       sent to
                            v           Email sent                  candidate
                        Approval            |                           |
                        notification        v                           v
                        sent            Delivery                    Candidate
                            |           tracked                     completes
                            v               |                       manually
                        Candidate           v                           |
                        approves        Status:                         v
                            |           submitted                   Status:
                            v               |                       completed
                        Email sent          v                           |
                            |           Track                           v
                            v           response                    Track
                        Status:                                     response
                        submitted
```

### 5.4 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Workflow Engine | n8n (self-hosted) | n8n.deploy.apiloom.io |
| Database | PostgreSQL 16 | Shared selvi_jobs DB with Modules 1 & 2 |
| Email Delivery | Resend API | Via n8n-nodes-resend community node |
| AI Generation | Claude 3.5 Haiku (email bodies), Sonnet (A-tier emails) | Tiered: Haiku for B-tier, Sonnet for A-tier |
| File Storage | Filesystem (volume mount) | /data/applications/ for prepared packages |
| Approval Webhooks | n8n Webhook node | HTTPS endpoints for approve/reject actions |
| Delivery Tracking | Resend Webhooks | Track delivered/bounced/opened events |
| Hosting | Dokploy on Hetzner CAX31 | Shared with Modules 1 & 2 |
| Monitoring | n8n execution logs + Telegram alerts | Via WF-AP0 error handler |
| Secrets Management | n8n encrypted credentials + env injection | See Section 5.7 |

### 5.5 Infrastructure Requirements

Module 3 adds minimal infrastructure on top of the existing stack:

**New Dependencies:**
- Resend API account (free tier: 100 emails/day, 3000/month -- sufficient for 20-40 applications/week)
- Resend webhook endpoint (n8n webhook node)
- Custom sending domain verified in Resend (for professional sender identity)

**Existing Infrastructure (no changes):**
- n8n (already running)
- PostgreSQL (schema extension only)
- Gotenberg (already deployed for Module 2 PDF generation)
- Claude API credentials (already configured)

**Volume Mount Addition:**
```yaml
volumes:
  - ./data/applications:/data/applications
```

This stores prepared application packages (task cards, pre-formatted form data, attachment bundles) that persist between workflow executions.

### 5.6 State Machine

Every application follows a state machine:

```
                                    +--------+
                                    | queued |
                                    +---+----+
                                        |
                                        v
                                +-------+--------+
                                | method_detected |
                                +-------+--------+
                                        |
                        +---------------+---------------+
                        |                               |
                        v                               v
                +-------+--------+              +-------+-----------+
                | email_ready    |              | portal_task_ready |
                +-------+--------+              +-------+-----------+
                        |                               |
                +-------+-------+                       v
                |               |               +-------+-----------+
                v               v               | pending_manual    |
        +-------+------+ +-----+--------+      +-------+-----------+
        |pending_approval| | auto_approved|             |
        +-------+------+ +-----+--------+              v
                |               |               +-------+-----------+
        +-------+-------+      |               | completed         |
        |               |      |               +-------------------+
        v               v      |
  +-----+----+  +------+---+  |
  | approved |  | rejected |  |
  +-----+----+  +----------+  |
        |                      |
        v                      v
  +-----+----+         +------+---+
  | submitted |        | submitted |
  +-----+----+         +----------+
        |
        v
  +-----+----+
  | delivered |  <-- Resend webhook confirms delivery
  +-----+----+
        |
        v
  +-----+----+
  | opened   |  <-- Resend webhook (if pixel tracking enabled)
  +-----+----+
        |
        v
  +-----+-----------+
  | response_received|  <-- Manual entry by candidate
  +------------------+

  Error states (can occur from any active state):
  +--------+     +---------------+     +---------+
  | failed |     | method_failed |     | expired |
  +--------+     +---------------+     +---------+
```

**State Transitions:**

| From | To | Trigger | Conditions |
|------|----|---------|------------|
| queued | method_detected | WF-AP1 detects application method | Method successfully identified |
| method_detected | email_ready | WF-AP1 routes to email engine | Method = email |
| method_detected | portal_task_ready | WF-AP1 routes to portal engine | Method = portal |
| email_ready | pending_approval | WF-AP4 quality gate | Tier = A or A+ |
| email_ready | auto_approved | WF-AP4 quality gate | Tier = B AND method = email |
| pending_approval | approved | WF-AP5 webhook | Candidate clicks approve |
| pending_approval | rejected | WF-AP5 webhook | Candidate clicks reject |
| pending_approval | expired | WF-AP6 timer | No action within 48 hours |
| approved | submitted | WF-AP2 sends email | Email accepted by Resend API |
| auto_approved | submitted | WF-AP2 sends email | Email accepted by Resend API |
| portal_task_ready | pending_manual | WF-AP3 sends task card | Task card delivered to candidate |
| pending_manual | completed | Candidate action | Candidate marks task as done |
| submitted | delivered | SW-AP2 webhook | Resend confirms delivery |
| delivered | opened | SW-AP2 webhook | Resend reports open event |
| any active | response_received | Candidate action | Manual status update |
| any active | failed | Error | System error during processing |
| submitted | method_failed | SW-AP2 webhook | Resend reports bounce |
| any active | withdrawn | Candidate action | Manual withdrawal |

### 5.7 Credential Management

All API keys and secrets must follow these management practices:

**N8N_ENCRYPTION_KEY:**
- Generated using `openssl rand -hex 32` (256-bit random)
- Stored separately from the docker-compose.yml file
- Injected via environment variable from a `.env` file with `chmod 600` permissions
- Never committed to version control

**APPROVAL_SECRET:**
- Generated using `openssl rand -hex 32`
- Rotated every 90 days; rotation invalidates all outstanding approval tokens
- On rotation: expire all `pending_approval` applications and re-generate approval notifications

**API Keys (RESEND_API_KEY, ANTHROPIC_API_KEY):**
- Stored in n8n's encrypted credential store (encrypted with N8N_ENCRYPTION_KEY)
- n8n credential store encrypted at rest in the Postgres database
- Rotation procedure: update in n8n credentials UI, test with a canary workflow, then confirm

**Server Security:**
- Hetzner server disk encryption enabled (LUKS)
- SSH access restricted to key-based authentication only (no password auth)
- SSH access limited to the system operator; access logged
- Postgres restricted to localhost connections only (no remote access)
- n8n instance behind Dokploy reverse proxy with HTTPS; n8n authentication enabled

**Secret Rotation Schedule:**

| Secret | Rotation Frequency | Invalidation Impact |
|--------|-------------------|---------------------|
| N8N_ENCRYPTION_KEY | Annually or on suspected compromise | Requires re-encrypting all n8n credentials |
| APPROVAL_SECRET | Every 90 days | Expires outstanding approval tokens |
| RESEND_API_KEY | On suspected compromise | Halts email sending until updated |
| ANTHROPIC_API_KEY | On suspected compromise | Halts email composition until updated |
| RESEND_WEBHOOK_SECRET | On suspected compromise | Webhook events rejected until updated |

---

## 6. Application Method Detection & Routing

### 6.1 Method Detection Strategy

Application method detection happens in WF-AP1 and uses a multi-signal approach. The primary data source is the job record from Module 1, which already contains the application URL, job description text, and source metadata.

**Detection Hierarchy (highest confidence first):**

1. **Explicit email address in job posting** -- If the job description or application URL contains a `mailto:` link or a plain email address with context like "send your CV to" or "apply by emailing," this is an email application. Confidence: 95%.

2. **Source-specific patterns** -- Jobs from certain sources have predictable application methods:
   - Reed API: Always provides an application URL pointing to Reed's portal or employer's direct portal
   - Adzuna API: Provides redirect URL -- follows to employer portal or agency page
   - jobs.ac.uk RSS: Always links to university portal or jobs.ac.uk application form
   - Agency job postings: Often contain recruiter email addresses
   - CIPD/TrainingZone: Mix of emails and portal links

3. **URL pattern matching** -- The application URL itself reveals the method:
   - `workday.com`, `myworkdayjobs.com` -> Workday portal
   - `taleo.net`, `oracle.com/cloud/talent` -> Taleo portal
   - `successfactors.com`, `sap.com/recruit` -> SuccessFactors portal
   - `stonefish.co.uk` -> University Stonefish portal
   - `jobtrain.co.uk` -> University Jobtrain portal
   - `linkedin.com/jobs` with Easy Apply flag -> LinkedIn Easy Apply
   - `indeed.com/apply`, `indeed.co.uk/apply` -> Indeed Apply
   - Generic career page URLs -> Generic portal

4. **Job description text analysis** -- Claude Haiku scans the description for application instructions:
   - "Please send your CV and cover letter to [email]"
   - "Apply via the button above"
   - "Apply through our careers portal at [URL]"
   - "To apply, visit [URL]"
   - "Please submit your application through [system name]"

5. **Fallback: Manual classification** -- If none of the above methods produce a confident result, the job is flagged for manual method assignment by the candidate.

### 6.2 Method Detection Implementation

```
WF-AP1: Application Router
|
+-- Step 1: Query Postgres for jobs with status = 'ready_to_apply'
|   (set by Module 2 when tailored materials are complete)
|
+-- Step 2: For each job, extract application_url and description
|
+-- Step 3: URL Pattern Matcher (Code node)
|   |
|   +-- Check against known portal URL patterns (regex dictionary)
|   +-- Extract email addresses from description (regex: standard email pattern)
|   +-- Check for mailto: links
|   +-- Classify source-specific defaults
|   |
|   +-- Output: { method: 'email'|'portal_workday'|'portal_taleo'|
|   |             'portal_stonefish'|'portal_jobtrain'|'portal_generic'|
|   |             'linkedin_easy_apply'|'indeed_apply'|'unknown',
|   |             confidence: 0.0-1.0,
|   |             email_address: string|null,
|   |             portal_url: string|null }
|
+-- Step 4: IF confidence < 0.7 AND method != 'email'
|   |
|   +-- Send to Claude Haiku for text analysis
|   +-- Prompt: "Analyze this job posting and determine the application
|   |           method. Return JSON with method and confidence."
|   +-- Merge AI result with URL pattern result (take higher confidence)
|
+-- Step 5: Update job record with detected method
|
+-- Step 6: Route to appropriate engine
    |
    +-- method = 'email' -> WF-AP2 (Email Application Engine)
    +-- method starts with 'portal_' -> WF-AP3 (Portal Preparation Engine)
    +-- method = 'linkedin_easy_apply' -> WF-AP3 (treat as manual portal task)
    +-- method = 'indeed_apply' -> WF-AP3 (treat as manual portal task)
    +-- method = 'unknown' -> Flag for manual classification
```

### 6.3 URL Pattern Dictionary

The system maintains a dictionary of URL patterns for portal detection. This dictionary is stored in the `application_config` table and can be updated without workflow changes.

```json
{
  "portal_patterns": [
    {
      "pattern": "workday\\.com|myworkdayjobs\\.com|wd[0-9]+\\.myworkday",
      "method": "portal_workday",
      "confidence": 0.95,
      "notes": "Workday enterprise ATS"
    },
    {
      "pattern": "taleo\\.net|oracle\\.com.*talent|oraclecloud\\.com.*recruit",
      "method": "portal_taleo",
      "confidence": 0.95,
      "notes": "Oracle Taleo ATS"
    },
    {
      "pattern": "successfactors\\.com|sap\\.com.*recruit",
      "method": "portal_successfactors",
      "confidence": 0.95,
      "notes": "SAP SuccessFactors ATS"
    },
    {
      "pattern": "stonefish\\.co\\.uk|stonefish\\.software",
      "method": "portal_stonefish",
      "confidence": 0.95,
      "notes": "University-specific ATS (UK HE sector)"
    },
    {
      "pattern": "jobtrain\\.co\\.uk",
      "method": "portal_jobtrain",
      "confidence": 0.95,
      "notes": "University/public sector ATS"
    },
    {
      "pattern": "oleeo\\.com",
      "method": "portal_oleeo",
      "confidence": 0.95,
      "notes": "UK public sector ATS"
    },
    {
      "pattern": "tribepad\\.com",
      "method": "portal_tribepad",
      "confidence": 0.95,
      "notes": "UK ATS (BBC, Tesco, NHS trusts)"
    },
    {
      "pattern": "eploy\\.co\\.uk|eploy\\.net",
      "method": "portal_eploy",
      "confidence": 0.95,
      "notes": "UK mid-market ATS"
    },
    {
      "pattern": "icims\\.com",
      "method": "portal_icims",
      "confidence": 0.95,
      "notes": "iCIMS Talent Cloud"
    },
    {
      "pattern": "greenhouse\\.io",
      "method": "portal_greenhouse",
      "confidence": 0.95,
      "notes": "Greenhouse ATS"
    },
    {
      "pattern": "lever\\.co",
      "method": "portal_lever",
      "confidence": 0.95,
      "notes": "Lever ATS"
    },
    {
      "pattern": "smartrecruiters\\.com",
      "method": "portal_smartrecruiters",
      "confidence": 0.95,
      "notes": "SmartRecruiters ATS"
    },
    {
      "pattern": "workable\\.com",
      "method": "portal_workable",
      "confidence": 0.95,
      "notes": "Workable ATS"
    },
    {
      "pattern": "linkedin\\.com/jobs.*applyOnCompany|linkedin\\.com.*easy-apply",
      "method": "linkedin_easy_apply",
      "confidence": 0.90,
      "notes": "LinkedIn Easy Apply"
    },
    {
      "pattern": "indeed\\.co\\.uk/apply|indeed\\.com/apply|indeed\\.co\\.uk.*vjk=",
      "method": "indeed_apply",
      "confidence": 0.90,
      "notes": "Indeed Apply"
    },
    {
      "pattern": "reed\\.co\\.uk/jobs/.*apply",
      "method": "portal_reed",
      "confidence": 0.85,
      "notes": "Reed.co.uk application portal"
    },
    {
      "pattern": "totaljobs\\.com/apply",
      "method": "portal_totaljobs",
      "confidence": 0.85,
      "notes": "TotalJobs application portal"
    },
    {
      "pattern": "civilservicejobs\\.service\\.gov\\.uk",
      "method": "portal_civil_service",
      "confidence": 0.95,
      "notes": "Civil Service Jobs portal"
    },
    {
      "pattern": "jobs\\.nhs\\.uk",
      "method": "portal_nhs",
      "confidence": 0.95,
      "notes": "NHS Jobs portal"
    },
    {
      "pattern": "jobs\\.ac\\.uk",
      "method": "portal_jobs_ac_uk",
      "confidence": 0.90,
      "notes": "jobs.ac.uk academic portal"
    }
  ],
  "email_patterns": [
    {
      "pattern": "(?:send|email|submit|forward).*(?:cv|resume|application).*(?:to|at)\\s+([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+)",
      "method": "email",
      "confidence": 0.90,
      "capture_group": 1
    },
    {
      "pattern": "([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+)",
      "method": "email_candidate",
      "confidence": 0.60,
      "capture_group": 1,
      "notes": "Raw email found -- needs context validation"
    }
  ]
}
```

### 6.4 Email Address Extraction and Validation

When an email address is detected in a job posting, the system must validate it is an application email, not a general inquiry address or a false positive.

**Validation Steps:**

1. **Context check:** Is the email mentioned near application instructions? ("send your CV to," "apply by emailing," "applications to") -> High confidence.

2. **Domain check:** Does the email domain match the employer's domain? If yes, high confidence. If it is a generic email service (gmail.com, outlook.com, yahoo.com), flag for review -- legitimate for small businesses and recruiters, but also used in scam postings.

3. **Role-specific check:** Does the email appear to be a recruitment-specific address? (e.g., careers@, recruitment@, hr@, hiring@, talent@, people@, jobs@) -> High confidence.

4. **Exclusion check:** Is the email clearly not for applications? (e.g., info@, support@, sales@, press@, marketing@) -> Low confidence, flag for review.

5. **Agency check:** Does the email belong to a known recruitment agency domain? (e.g., @hays.com, @michaelpage.com, @reed.co.uk, @oakleafpartnership.com) -> High confidence, set application type to "agency_response."

**Implementation as a Code node:**

```javascript
function validateApplicationEmail(email, contextText, companyName) {
  const result = {
    email: email,
    isValid: false,
    confidence: 0,
    type: 'unknown', // direct, agency, speculative
    warnings: []
  };

  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1];

  // Check exclusion patterns
  const excludePatterns = /^(info|support|sales|press|marketing|admin|webmaster|noreply|no-reply)@/;
  if (excludePatterns.test(emailLower)) {
    result.warnings.push('Email appears to be a general contact address, not recruitment');
    result.confidence = 0.2;
    return result;
  }

  // Check recruitment-specific patterns
  const recruitPatterns = /^(careers|recruitment|hr|hiring|talent|people|jobs|vacancies|applications|apply|recruit)@/;
  if (recruitPatterns.test(emailLower)) {
    result.isValid = true;
    result.confidence = 0.95;
    result.type = 'direct';
    return result;
  }

  // Check known agency domains
  const agencyDomains = [
    'hays.com', 'michaelpage.com', 'reed.co.uk', 'oakleafpartnership.com',
    'frazerjones.com', 'macmillandavies.co.uk', 'allenlane.co.uk',
    'roberthalf.co.uk', 'adecco.co.uk', 'manpower.co.uk', 'randstad.co.uk',
    'pagepersonnel.co.uk', 'spring.com', 'korn-ferry.com'
  ];
  if (agencyDomains.some(d => domain.endsWith(d))) {
    result.isValid = true;
    result.confidence = 0.95;
    result.type = 'agency';
    return result;
  }

  // Check context for application instructions
  const contextLower = (contextText || '').toLowerCase();
  const applicationContext = /(?:send|email|submit|forward|post|mail).*(?:cv|resume|application|covering letter)/;
  if (applicationContext.test(contextLower)) {
    result.isValid = true;
    result.confidence = 0.85;
    result.type = 'direct';
    return result;
  }

  // Generic email found but without strong context
  result.isValid = true;
  result.confidence = 0.5;
  result.type = 'unknown';
  result.warnings.push('Email found without clear application context -- needs manual verification');
  return result;
}
```

### 6.5 Method Detection for Academic Roles

Academic roles require special handling because their application methods are distinct from corporate roles:

**jobs.ac.uk Listings:**
- Most jobs.ac.uk listings link to the individual university's recruitment portal
- The application method is almost always a portal, not email
- The portal type varies by university (Stonefish, Jobtrain, CoreHR, bespoke)
- Some listings include a "Further Particulars" document that must be read before applying

**Direct University Postings:**
- Always portal-based
- May require creating an account on the university's HR system
- Often require a "supporting statement" (similar to a cover letter but longer and more structured)
- May require separate uploads for: CV, supporting statement, equality monitoring form, list of publications, teaching philosophy

**Detection Logic for Academic Roles:**

```
IF job.job_type = 'academic' THEN
  IF application_url MATCHES any university portal pattern THEN
    method = matched portal type
  ELSE IF application_url MATCHES jobs.ac.uk THEN
    method = 'portal_jobs_ac_uk'
    -- Follow redirect to determine actual university portal
  ELSE
    method = 'portal_generic'
  END IF

  -- Academic roles always get supplementary document check
  SET requires_supporting_statement = true
  SET requires_referee_details = true

  -- Check for additional requirements in description
  IF description CONTAINS 'teaching philosophy' THEN
    SET requires_teaching_philosophy = true
  END IF
  IF description CONTAINS 'research statement' OR 'research plan' THEN
    SET requires_research_statement = true
  END IF
  IF description CONTAINS 'publication' THEN
    SET requires_publications_list = true
  END IF
END IF
```

### 6.6 Routing Decision Matrix

| Method | Tier | Routing | Automation Level |
|--------|------|---------|-----------------|
| email + A-tier | A/A+ | WF-AP2 via WF-AP5 (approval required) | Prepared + hold for approval |
| email + B-tier | B | WF-AP2 direct (auto-send) | Fully automated |
| email + agency | A/B | WF-AP2 (adjust template for agency) | Fully automated (B) or approval (A) |
| portal_workday | A/B | WF-AP3 (Workday-specific task card) | Manual with preparation |
| portal_taleo | A/B | WF-AP3 (Taleo-specific task card) | Manual with preparation |
| portal_stonefish | A/B | WF-AP3 (University-specific task card) | Manual with preparation |
| portal_jobtrain | A/B | WF-AP3 (University-specific task card) | Manual with preparation |
| portal_greenhouse | A/B | WF-AP3 (generic portal task card) | Manual with preparation |
| portal_generic | A/B | WF-AP3 (generic portal task card) | Manual with preparation |
| linkedin_easy_apply | A/B | WF-AP3 (LinkedIn-specific task card) | Manual with preparation |
| indeed_apply | A/B | WF-AP3 (Indeed-specific task card) | Manual with preparation |
| portal_civil_service | A/B | WF-AP3 (Civil Service-specific task card) | Manual with preparation |
| portal_nhs | A/B | WF-AP3 (NHS-specific task card) | Manual with preparation |
| unknown | A/B | Flag for manual classification | Needs human input |

---

## 7. Email-Based Application Engine

### 7.1 Overview

The Email Application Engine (WF-AP2) handles the fully automated pathway. It receives a job record with method = 'email', composes a professional application email using Claude, attaches the tailored CV and cover letter from Module 2, and sends it via Resend.

This is the highest-value workflow in Module 3. Email-based applications represent 25-30% of corporate roles and a higher percentage of agency-advertised roles. Every email application the system handles saves 5-10 minutes of manual work and enables faster time-to-apply.

### 7.2 Email Composition

The email body is generated by Claude (Haiku for B-tier, Sonnet for A-tier) using a structured prompt that ensures consistency, professionalism, and role-specificity.

**Email Composition Prompt Template:**

```
You are writing an application email for a job candidate. The email must sound natural
and human -- not templated, not robotic, not AI-generated. It should read like a
professional who is genuinely interested in this specific role wrote it in a few minutes
over coffee.

CANDIDATE PROFILE:
- Name: {candidate_name}
- Current title: {candidate_current_title}
- Key qualifications: {key_qualifications}
- Years of experience: {years_experience}
- Location: {candidate_location}
- Contact: {candidate_email}, {candidate_phone}

JOB DETAILS:
- Title: {job_title}
- Company: {company_name}
- Location: {job_location}
- Key requirements: {key_requirements_from_jd}
- Application context: {application_context}

APPLICATION TYPE: {direct_application|agency_response|speculative}

COVER LETTER SUMMARY (reference these points but don't repeat verbatim):
{cover_letter_key_points}

RULES:
1. Keep the email under 200 words. Hiring managers and recruiters skim.
2. Open with a direct statement about the role. Do not start with "I am writing to
   express my interest" or any variation of that phrase.
3. Mention 2-3 specific qualifications that match the role's top requirements.
4. Use UK English throughout (organisation, programme, colour, etc.).
5. Do not use the word "passion" or "passionate." Do not use "thrilled," "excited,"
   or "delighted." Use neutral language.
6. Do not use "leverage," "synergy," "thought leadership," or corporate jargon.
7. Do not mention AI or automation. The email must pass as hand-written.
8. Close with availability for a call or interview. Include phone number.
9. Attach references: "Please find my CV and cover letter attached."
10. If APPLICATION TYPE is 'agency_response':
    - Acknowledge the job posting and any reference number
    - Keep it shorter (under 150 words)
    - Mention availability for a screening call
    - If KNOWN_CONTACT is provided: reference the existing relationship
      naturally (e.g., "Good to see another role from you" or
      "We last spoke about the {previous_role} role"). Use the contact's
      preferred tone. Do NOT write as if this is a first-time introduction.
    - If AGENCY_SPECIALISM is provided: adjust content depth and terminology
      for the agency's specialism (specialist agencies expect domain language;
      generalist agencies need more context)
11. If APPLICATION TYPE is 'speculative':
    - Focus on what the candidate brings, not on a specific vacancy
    - Mention why this company specifically (research required)
    - Longer format acceptable (up to 250 words)

OUTPUT FORMAT:
Return a JSON object with:
{
  "subject_line": "...",
  "email_body": "...",
  "format_notes": "any special formatting instructions"
}
```

### 7.3 Email Subject Lines

Subject lines follow category-specific formats:

**Direct Application:**
```
Application: {Job Title} - {Candidate Name}
```
Example: `Application: Learning & Development Manager - Selvi Kumar`

**Agency Response:**
```
Re: {Job Title} ({Reference Number if available}) - {Candidate Name}
```
Example: `Re: Head of L&D (Ref: HY-45892) - Selvi Kumar`

**Speculative Application:**
```
{Candidate Title} | Interest in {Department/Area} Opportunities
```
Example: `Senior L&D Professional | Interest in People Development Opportunities`

**Variation:** Claude may suggest alternative subject lines based on the specific role context. The system uses Claude's suggestion if it follows the general pattern but adds role-specific relevance. The system rejects subject lines that:
- Exceed 80 characters
- Use ALL CAPS
- Include emoji
- Start with "URGENT" or "CONFIDENTIAL"
- Are generic ("Job Application" without a title)

### 7.4 Email Structure

All application emails follow this structure:

```
Subject: [subject line]
From: Selvi Kumar <selvi@{verified-domain}>
To: {application_email}
Reply-To: {candidate_personal_email}
Content-Type: multipart/mixed

[Email body - plain text, UK English]

[Attachments:
  1. Selvi_Kumar_CV_{job_slug}.pdf
  2. Selvi_Kumar_Cover_Letter_{job_slug}.pdf
]
```

**Sender Identity:**

The "From" address must be a verified domain in Resend to avoid deliverability issues. The setup is:

1. Register a custom domain for job applications (e.g., applications.selvikumar.co.uk or apply.selvikumar.co.uk)
2. Verify domain in Resend (DNS records: SPF, DKIM, DMARC)
3. Set Reply-To as the candidate's personal email (so replies go to the right inbox)

**Alternative (simpler):** Use the candidate's personal email domain if it is already verified in Resend. If using a gmail.com or similar free email, send via n8n's SMTP node through the candidate's actual email provider instead of Resend.

### 7.5 Attachment Handling

**File Formats:**

| Recipient Type | CV Format | Cover Letter Format |
|---------------|-----------|-------------------|
| Direct employer | PDF | PDF |
| Recruitment agency | DOCX (agencies often reformat CVs) | PDF |
| Speculative | PDF | PDF |

The decision is made in the Email Composer sub-workflow based on the application type. Module 2 generates both PDF and DOCX versions of the CV.

**File Naming Convention:**

```
{FirstName}_{LastName}_CV_{CompanySlug}.pdf
{FirstName}_{LastName}_Cover_Letter_{CompanySlug}.pdf
```

Examples:
```
Selvi_Kumar_CV_Deloitte.pdf
Selvi_Kumar_Cover_Letter_Deloitte.pdf
Selvi_Kumar_CV_Hays_Recruitment.docx
```

**File Size:**
- CV PDF: typically 80-150 KB (single-column, text-based)
- CV DOCX: typically 50-100 KB
- Cover letter PDF: typically 40-80 KB
- Total attachment size: under 500 KB (well within email limits)

### 7.6 Email Delivery via Resend

**Resend API Integration:**

The n8n-nodes-resend community node handles email sending. Configuration:

```
Node: Resend (Send Email)
- API Key: {RESEND_API_KEY} (stored in n8n credentials)
- From: Selvi Kumar <selvi@{verified-domain}>
- To: {application_email}
- Reply-To: {candidate_personal_email}
- Subject: {generated_subject_line}
- Text: {generated_email_body}
- Attachments: [CV binary, Cover Letter binary]
- Headers:
    Idempotency-Key: {application_id}  # Prevents duplicate sends on retry/restart
```

**Resend Free Tier Limits:**
- 100 emails per day
- 3,000 emails per month
- 1 custom domain
- These limits are more than sufficient for 20-40 applications per week

**Error Handling:**
- API rate limit (429): Retry after delay specified in `Retry-After` header
- Invalid recipient (400): Log failure, flag for manual method re-detection
- Authentication error (401/403): Alert immediately, halt all sends
- Server error (500/502/503): Retry up to 3 times with exponential backoff

### 7.7 Delivery Tracking via Resend Webhooks

Resend provides webhook events for email lifecycle tracking. The system uses these to update application status automatically.

**Webhook Events Used:**

| Event | Status Update | Action |
|-------|--------------|--------|
| `email.sent` | submitted | Confirmation logged |
| `email.delivered` | delivered | Status updated, delivery confirmed |
| `email.bounced` | method_failed | Alert candidate, attempt alternative method |
| `email.complained` | failed | Halt all sends to this domain, alert candidate |
| `email.delivery_delayed` | submitted (no change) | Log delay, monitor |
| `email.opened` | opened | Log open event (informational only) |
| `email.clicked` | N/A | Not used (no links in application emails) |

**Webhook Endpoint:**

```
POST https://n8n.deploy.apiloom.io/webhook/resend-delivery-events
```

The SW-AP2 sub-workflow receives these events and updates the `applications` table.

**Webhook Security:**

Resend signs webhook payloads with an HMAC signature. The webhook handler validates the signature before processing:

```javascript
const crypto = require('crypto');
const signature = $headers['svix-signature'];
const timestamp = $headers['svix-timestamp'];
const body = JSON.stringify($body);

const signedContent = `${svixId}.${timestamp}.${body}`;
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(signedContent)
  .digest('base64');

if (signature !== `v1,${expectedSignature}`) {
  throw new Error('Invalid webhook signature');
}
```

### 7.8 Email Application Workflow (WF-AP2) Detailed Flow

```
WF-AP2: Email Application Engine

Trigger: Called by WF-AP1 with job_id and application_id
|
+-- Step 1: Load job data from Postgres
|   - Job title, company, description, key requirements
|   - Application email address
|   - Tier (A/B)
|   - Application type (direct/agency/speculative)
|
+-- Step 2: Load tailored materials from Module 2
|   - Tailored CV (PDF binary + DOCX binary)
|   - Cover letter (PDF binary)
|   - Cover letter key points (JSON)
|   - Candidate profile summary
|
+-- Step 3: Call Quality Gate (WF-AP4)
|   - Duplicate check
|   - Rate limit check
|   - IF blocked -> update status, exit
|
+-- Step 4: Determine attachment format
|   - IF application_type = 'agency' -> CV as DOCX
|   - ELSE -> CV as PDF
|   - Cover letter always PDF
|
+-- Step 5: Generate email body (SW-AP1: Email Composer)
|   - IF tier = A/A+ -> Claude Sonnet
|   - IF tier = B -> Claude Haiku
|   - Apply email composition prompt
|   - Parse JSON response -> subject_line, email_body
|   - Validate: word count < 250, no banned phrases, UK English check
|
+-- Step 6: Route by tier
|   |
|   +-- IF tier = A/A+:
|   |   +-- Save draft to database
|   |   +-- Send approval notification (WF-AP5 trigger)
|   |   +-- Set status = 'pending_approval'
|   |   +-- EXIT (wait for human action)
|   |
|   +-- IF tier = B:
|       +-- Set status = 'auto_approved'
|       +-- Continue to Step 7
|
+-- Step 7: Send email via Resend
|   - From: Selvi Kumar <selvi@{domain}>
|   - To: {application_email}
|   - Reply-To: {candidate_email}
|   - Subject: {subject_line}
|   - Text: {email_body}
|   - Attachments: [CV, Cover Letter]
|
+-- Step 8: Log submission
|   - Update application status = 'submitted'
|   - Store Resend message_id
|   - Log timestamp, method, attachments
|
+-- Step 9: Error handling
    - IF Resend API error -> retry with backoff
    - IF persistent failure -> status = 'failed', alert candidate
```

---

## 8. Web Portal Application Assistant

### 8.1 Design Philosophy

The system does not attempt to automate web portal submissions through browser automation, scraping, or API exploitation. This is a deliberate decision based on four factors:

1. **Terms of Service:** Major ATS platforms (Workday, Taleo, iCIMS, Greenhouse) explicitly prohibit automated submissions in their terms of service. Violating these terms risks account bans, application rejection, and potential legal liability.

2. **Brittleness:** Web portal automation is fragile. DOM structures change frequently, CAPTCHAs block automated access, and each portal has unique form layouts. Maintaining scrapers for 15+ portal types would consume more engineering time than the manual application time it saves.

3. **Quality risk:** Automated form filling often produces errors -- fields truncated, dates misformatted, selections mismatched. A single form-filling error on a high-value application is worse than the time saved on 10 successful automated fills.

4. **Ethics:** Automated portal submissions circumvent the application process that employers have chosen. This is qualitatively different from sending an email application, which is the expected method for email-based roles.

Instead, the system prepares everything the candidate needs to complete portal applications quickly. It transforms a 20-30 minute task into a 3-5 minute copy-paste exercise.

### 8.2 Task Card Structure

For every portal-based application, the system generates a "task card" -- a structured document containing everything needed to complete the application. Task cards are delivered via email and also stored in the database for reference.

**Task Card Template:**

```
========================================
APPLICATION TASK CARD
========================================

JOB: {job_title}
COMPANY: {company_name}
TIER: {tier} (Score: {composite_score})
PORTAL: {portal_type}
URL: {application_url}

ESTIMATED TIME: {estimated_minutes} minutes
GENERATED: {timestamp}
EXPIRES: {job_expires_at or 'Unknown'}

========================================
ATTACHMENTS (download from email)
========================================

1. CV (PDF): {cv_filename}
2. CV (DOCX): {cv_docx_filename} -- use this if portal prefers DOCX
3. Cover Letter (PDF): {cl_filename}
{if requires_supporting_statement}
4. Supporting Statement: See Section below
{/if}

========================================
PERSONAL DETAILS (copy-paste ready)
========================================

Full Name: {candidate_full_name}
Email: {candidate_email}
Phone: {candidate_phone}
Address Line 1: {candidate_address_line1}
Address Line 2: {candidate_address_line2}
City: {candidate_city}
County: {candidate_county}
Postcode: {candidate_postcode}
Country: United Kingdom

Date of Birth: [Leave blank unless required -- UK law does not require this]
National Insurance: [Enter manually if required]
Right to Work: Yes -- British Citizen / Settled Status / Indefinite Leave to Remain
Notice Period: {candidate_notice_period}
Current Salary: {candidate_current_salary}
Expected Salary: {candidate_expected_salary}

========================================
WORK HISTORY (most recent first)
========================================

{for each experience in candidate_experiences}
Company: {experience.company}
Job Title: {experience.title}
Start Date: {experience.start_date_formatted} (format: {portal_date_format})
End Date: {experience.end_date_formatted or 'Present'}
Location: {experience.location}
Description:
{experience.description_for_forms}

---
{/for}

========================================
EDUCATION
========================================

{for each education in candidate_education}
Institution: {education.institution}
Qualification: {education.qualification}
Subject/Field: {education.subject}
Start Date: {education.start_date_formatted}
End Date: {education.end_date_formatted}
Grade/Classification: {education.grade}

---
{/for}

========================================
SKILLS (for skills/competency fields)
========================================

{candidate_skills_comma_separated}

========================================
COVER LETTER / SUPPORTING STATEMENT
========================================

{cover_letter_text}

{if requires_supporting_statement}
========================================
SUPPORTING STATEMENT (for academic roles)
========================================

{supporting_statement_text}
{/if}

========================================
PORTAL-SPECIFIC NOTES
========================================

{portal_specific_instructions}

========================================
REFEREES
========================================

Referee 1:
  Name: {referee1_name}
  Title: {referee1_title}
  Organisation: {referee1_organisation}
  Email: {referee1_email}
  Phone: {referee1_phone}
  Relationship: {referee1_relationship}

Referee 2:
  Name: {referee2_name}
  Title: {referee2_title}
  Organisation: {referee2_organisation}
  Email: {referee2_email}
  Phone: {referee2_phone}
  Relationship: {referee2_relationship}

========================================
EQUAL OPPORTUNITIES MONITORING
========================================

Note: You may be asked equality monitoring questions during
the application process. These are optional, protected by law,
and should not affect your application.

{if employer_is_disability_confident}
NOTE: This employer is a Disability Confident employer.
Declaring a disability may guarantee you an interview
under the Disability Confident scheme if you meet the
essential criteria for the role. Consider this when
completing the monitoring form.
{/if}

Do NOT pre-fill these responses. Complete them directly
on the portal at the time of application.

========================================
```

### 8.3 Portal-Specific Instructions

Each portal type gets tailored instructions based on its known form structure and quirks.

**Workday:**
```
WORKDAY PORTAL NOTES:
- Workday will auto-parse your CV after upload. REVIEW the parsed data carefully.
- Parsed dates often display incorrectly -- manually correct any date errors.
- Upload the DOCX version of your CV (Workday parses DOCX better than PDF).
- After uploading CV, Workday may auto-populate work history. Edit as needed.
- The "Additional Information" field is a good place for your cover letter text.
- Workday accounts persist -- if you have applied to this company before,
  log in with your existing credentials.
- Save progress frequently -- Workday sessions can time out.
```

**Taleo:**
```
TALEO PORTAL NOTES:
- Taleo (Oracle) portals are often slow. Be patient with page loads.
- Upload CV in DOCX format. Taleo's PDF parsing is unreliable.
- Create a Taleo profile if prompted -- some employers share Taleo instances.
- Work history fields: use the exact format below for dates (MM/DD/YYYY is the
  Taleo default even for UK employers):
  {dates_reformatted_as_mm_dd_yyyy}
- "Requisition Number" field: enter {requisition_number if available}.
- Cover letter may need to be pasted into a text area rather than uploaded.
```

**Stonefish (University):**
```
STONEFISH PORTAL NOTES:
- This is a UK university recruitment system.
- You will likely need to create an account with an email and password.
- The application form is typically:
  1. Personal Details
  2. Education and Qualifications
  3. Employment History
  4. Supporting Statement (IMPORTANT: paste your cover letter here)
  5. Equal Opportunities Monitoring (optional)
  6. Document Upload
  7. Referee Details (usually 2 required)
  8. Review and Submit
- The "Supporting Statement" is critical for university applications.
  Use the text provided in the SUPPORTING STATEMENT section above.
- Upload your CV as PDF.
- Referees: universities typically contact referees BEFORE interview.
  Ensure your referees are prepared.
```

**Civil Service Jobs:**
```
CIVIL SERVICE PORTAL NOTES:
- Civil Service applications use a competency/behaviour framework.
- You may be asked to provide examples against specific behaviours
  (e.g., "Leadership", "Communicating and Influencing", "Working Together").
- The "Personal Statement" or "Statement of Suitability" is weighted heavily.
  Align it with the Civil Service Success Profiles framework.
- Word limits are strict and enforced by the form.
- Salary expectations: Civil Service roles have fixed pay bands.
  Do not attempt to negotiate in the application.
- Right to Work: answer "Yes" -- you will need to provide documentation
  if called for interview.
- Security clearance: Most L&D roles require BPSS (Baseline Personnel
  Security Standard) at minimum. Declare any issues honestly.
```

**NHS Jobs:**
```
NHS JOBS PORTAL NOTES:
- NHS Jobs requires an NHS Jobs account.
- Applications follow the Agenda for Change (AfC) structure.
- "Supporting Information" is the key section. Align with the person spec.
- You may be asked to evidence each essential and desirable criterion
  from the person specification.
- NHS roles have fixed pay bands (Agenda for Change). Salary negotiation
  is limited to placement within the band.
- Disclosure and Barring Service (DBS): L&D roles typically require basic DBS.
  Confirm if enhanced DBS is needed.
- Professional registration: not typically required for L&D/OD roles.
```

**LinkedIn Easy Apply:**
```
LINKEDIN EASY APPLY NOTES:
- Open LinkedIn and navigate to this job posting.
- Click "Easy Apply" button.
- LinkedIn will pre-fill many fields from your profile.
- Upload the PDF version of your CV.
- If there is a cover letter field, paste the cover letter text below.
- Some Easy Apply forms have additional screening questions.
  Answer based on the data provided above.
- After submitting, the application is tracked on LinkedIn's "My Jobs" page.
- Estimated time: 2-3 minutes.

COVER LETTER TEXT (if needed):
{cover_letter_text}
```

**Generic Portal:**
```
GENERIC PORTAL NOTES:
- This appears to be a custom or less common application portal.
- Use the form data above to fill in standard fields.
- Upload your CV in PDF format unless the portal specifically requests DOCX.
- If there is a free-text field for cover letter or additional information,
  paste the cover letter text provided above.
- Screenshot your submission confirmation for records.
```

### 8.4 Date Format Handling

Different portals expect different date formats. The task card pre-formats all dates in the format required by the specific portal type.

| Portal Type | Expected Date Format | Example |
|-------------|---------------------|---------|
| Workday | MM/YYYY or MM/DD/YYYY | 03/2020 or 03/01/2020 |
| Taleo | MM/DD/YYYY | 03/01/2020 |
| Stonefish | DD/MM/YYYY | 01/03/2020 |
| Jobtrain | DD/MM/YYYY | 01/03/2020 |
| NHS Jobs | DD/MM/YYYY | 01/03/2020 |
| Civil Service | DD/MM/YYYY or MM/YYYY | 01/03/2020 or 03/2020 |
| Generic UK | DD/MM/YYYY | 01/03/2020 |
| LinkedIn | MM/YYYY | 03/2020 |

The date formatting is handled in a Code node that accepts the portal type and reformats all date fields accordingly.

### 8.5 Supporting Statement Generation

For academic and public sector roles, a "supporting statement" is often required in addition to or instead of a traditional cover letter. Supporting statements are longer (typically 500-1500 words) and must address each criterion in the person specification.

**Generation Process:**

1. Module 1 extracts the person specification criteria during scoring (stored as structured data in `jobs.metadata`)
2. Module 2 generates the tailored cover letter with person-spec alignment
3. Module 3's Portal Preparation Engine extends the cover letter into a full supporting statement using Claude

**Supporting Statement Prompt:**

```
You are writing a supporting statement for a UK university/public sector job
application. This is not a cover letter -- it is a structured document that
addresses each criterion in the person specification.

PERSON SPECIFICATION CRITERIA:
{criteria_list}

CANDIDATE PROFILE:
{candidate_profile}

COVER LETTER KEY POINTS:
{cover_letter_points}

RULES:
1. Address EACH essential criterion with a specific example.
2. Address desirable criteria where the candidate has relevant experience.
3. Use the STAR format (Situation, Task, Action, Result) for examples.
4. Keep to {word_limit} words total.
5. Use UK English throughout.
6. Be specific -- use numbers, dates, and outcomes where available.
7. Do not invent experience the candidate does not have.
8. Structure with clear headings matching the person spec criteria.

OUTPUT: Plain text supporting statement ready for copy-paste into a form field.
```

### 8.6 Portal Preparation Workflow (WF-AP3) Detailed Flow

```
WF-AP3: Portal Preparation Engine

Trigger: Called by WF-AP1 with job_id, application_id, portal_type
|
+-- Step 1: Load job data from Postgres
|   - Full job record including description, metadata
|   - Detected portal type and URL
|   - Person specification criteria (if extracted by Module 1)
|
+-- Step 2: Load tailored materials from Module 2
|   - CV (PDF + DOCX binaries)
|   - Cover letter (PDF binary + text)
|   - Candidate profile data
|
+-- Step 3: Call Quality Gate (WF-AP4)
|   - Duplicate check only (no rate limiting for manual tasks)
|   - IF blocked -> update status, exit
|
+-- Step 4: Load candidate form data
|   - Personal details, work history, education, skills, referees
|   - From candidate_profile table
|
+-- Step 5: Format data for portal type
|   - Date formatting per portal type
|   - Work history ordering (reverse chronological)
|   - Character limit compliance (truncate descriptions if needed)
|
+-- Step 6: Generate portal-specific content (if needed)
|   |
|   +-- IF portal requires supporting statement AND academic role:
|   |   +-- Call Claude Sonnet to generate supporting statement
|   |   +-- Validate word count against limit
|   |
|   +-- IF portal has specific field requirements:
|       +-- Generate field-specific text (e.g., "Reason for applying" field)
|
+-- Step 7: Assemble task card
|   - Merge template with formatted data
|   - Include portal-specific instructions
|   - Attach CV (PDF + DOCX), cover letter, supporting statement (if applicable)
|
+-- Step 8: Deliver task card
|   - Send via email to candidate with all attachments
|   - Store task card in database
|   - Update application status = 'pending_manual'
|
+-- Step 9: Log preparation
    - Store generated content, portal type, estimated completion time
    - Start manual completion timer
```

---

## 9. LinkedIn Application Integration

### 9.1 LinkedIn Constraints

LinkedIn does not offer a public API for job applications. The LinkedIn Marketing Developer Platform and LinkedIn Talent Solutions APIs are restricted to enterprise customers (staffing agencies, HRIS platforms) and explicitly prohibit individual applicant automation.

**What is not possible:**
- Programmatic Easy Apply submissions
- Automated InMail or connection requests
- Scraping job listings via API (without LinkedIn's approval)
- Automated profile updates to match target roles

**What is possible:**
- Preparing all materials for a fast manual Easy Apply
- Generating clipboard-ready text for LinkedIn message fields
- Tracking LinkedIn applications in the system database
- Monitoring for job posting updates (via Module 1's existing email alert parsing from LinkedIn)

### 9.2 LinkedIn Application Preparation

For LinkedIn Easy Apply roles, the system generates a LinkedIn-specific task card:

```
========================================
LINKEDIN EASY APPLY TASK
========================================

JOB: {job_title}
COMPANY: {company_name}
LINKEDIN URL: {linkedin_job_url}

STEPS:
1. Click the link above to open the LinkedIn job posting
2. Click "Easy Apply"
3. LinkedIn will pre-fill from your profile
4. Upload CV: {cv_filename} (attached to this email)
5. If cover letter field appears, paste the text below
6. Answer any screening questions using the data below
7. Review and submit
8. Reply to this email with "done" to mark as completed

ESTIMATED TIME: 2-3 minutes

CV FILE: Attached (PDF)

COVER LETTER TEXT (copy-paste if asked):
---
{cover_letter_text_adapted_for_linkedin}
---

COMMON SCREENING QUESTIONS:
- Years of experience in L&D: {years_experience}
- Highest education level: {highest_education}
- Are you willing to relocate: No (but willing to commute -- see location)
- Right to work in UK: Yes
- Expected salary: {expected_salary_range}
- Notice period: {notice_period}
- Languages: English (fluent), {other_languages}

========================================
```

### 9.3 LinkedIn Premium Features

If the candidate has LinkedIn Premium, additional strategies become available:

- **InMail to hiring managers:** The system can prepare a personalized InMail message for the hiring manager (identified from the job posting or company page). This is delivered as part of the task card.
- **Who viewed your profile:** Cross-reference profile viewers with companies where applications were submitted. Informational only, surfaced in the weekly report.

### 9.4 LinkedIn Application Tracking

LinkedIn applications are tracked with source = 'linkedin' in the applications table. Since Easy Apply submissions happen outside the system, the candidate confirms completion by:

1. Replying "done" to the task card email (parsed by WF-AP6)
2. Manually updating status in a future dashboard (post-MVP)

The system does not assume completion until explicitly confirmed.

---

## 10. Quality Gates & Human-in-the-Loop

### 10.1 Quality Gate Architecture

The Quality Gate (WF-AP4) is a sub-workflow called before every submission attempt. It enforces three checks: duplicate prevention, rate limiting, and content quality validation.

```
WF-AP4: Quality Gate

Input: application_id, job_id, method, tier
|
+-- Check 1: Duplicate Prevention
|   |
|   +-- Query: SELECT * FROM applications
|   |   WHERE company_normalized = {company_normalized}
|   |   AND similarity(job_title, {job_title}) > 0.8
|   |   AND status NOT IN ('failed', 'withdrawn', 'expired')
|   |   AND created_at > NOW() - INTERVAL '90 days'
|   |
|   +-- IF results found:
|   |   +-- BLOCK application
|   |   +-- Set status = 'blocked_duplicate'
|   |   +-- Log: "Potential duplicate of application {existing_id}"
|   |   +-- Notify candidate with details of existing application
|   |   +-- EXIT
|   |
|   +-- Additional fuzzy check:
|       +-- Normalize company name (remove Ltd, Limited, PLC, Inc, etc.)
|       +-- Strip common suffixes from job title (Senior, Junior, Lead, etc.)
|       +-- Check with broader similarity threshold (> 0.6) on normalized values
|       +-- IF match: flag as "possible_duplicate" but allow with warning
|
+-- Check 2: Rate Limiting (email applications only)
|   |
|   +-- Query: SELECT COUNT(*) FROM applications
|   |   WHERE method = 'email'
|   |   AND status IN ('submitted', 'delivered', 'opened')
|   |   AND submitted_at > NOW() - INTERVAL '1 hour'
|   |
|   +-- IF count >= max_per_hour (default 3):
|   |   +-- DELAY: re-queue for next available slot
|   |   +-- Set status = 'rate_limited'
|   |   +-- EXIT (will be picked up next cycle)
|   |
|   +-- Query: SELECT COUNT(*) FROM applications
|   |   WHERE method = 'email'
|   |   AND status IN ('submitted', 'delivered', 'opened')
|   |   AND submitted_at > NOW() - INTERVAL '24 hours'
|   |
|   +-- IF count >= max_per_day (default 15):
|   |   +-- DELAY: re-queue for next day
|   |   +-- Set status = 'rate_limited'
|   |   +-- EXIT
|   |
|   +-- Quiet hours check:
|       +-- IF current_time NOT BETWEEN 07:00 AND 22:00 UK time:
|       +-- DELAY: re-queue for 07:00 next day
|       +-- EXIT
|
+-- Check 3: Content Quality Validation
|   |
|   +-- IF method = 'email':
|   |   +-- Validate email body length (50-300 words)
|   |   +-- Check for banned phrases (see Section 7.2 rules)
|   |   +-- Verify attachments are present (CV + cover letter)
|   |   +-- Check subject line length (< 80 chars)
|   |   +-- Verify UK English (spot check: organisation not organization,
|   |   |   programme not program, colour not color)
|   |   +-- IF any validation fails:
|   |       +-- Apply regex-based post-processing to fix banned phrases
|   |       +-- IF structural issues remain: REGENERATE with corrective prompt
|   |       +-- Re-validate (max 2 regeneration attempts)
|   |       +-- IF still fails: flag for manual review
|   |
|   +-- Validate application_email is not blacklisted
|   +-- Validate application_email domain has MX records (DNS check)
|
+-- Check 4: Scam Posting Protection
|   |
|   +-- IF application_email domain is a free email provider
|   |   (gmail.com, outlook.com, yahoo.com, hotmail.com, etc.):
|   |   +-- HOLD for manual approval regardless of tier
|   |   +-- Flag: "Application address uses free email provider --
|   |         verify legitimacy before sending"
|   |
|   +-- IF this is the first application to this recipient domain
|   |   (no prior applications to any @{domain} address):
|   |   +-- IF tier = B: HOLD for approval (first-contact review)
|   |   +-- Log: "First application to domain {domain}"
|   |
|   +-- Check Module 1 scam-risk signals (if available in job metadata):
|   |   +-- IF metadata contains scam_risk_score > 0.5: BLOCK
|   |   +-- IF metadata contains scam_indicators: FLAG for review
|   |
|   +-- Maintain a "known employer" whitelist that grows over time:
|       +-- Domains that have previously resulted in delivered emails
|           with no bounce/complaint are added to the whitelist
|       +-- Whitelisted domains bypass first-contact review
|
+-- Check 5: Module 2 Output Quality Validation
|   |
|   +-- Before using CV/cover letter from Module 2:
|   |   +-- Verify cv_packages.qa_pass == true
|   |   +-- Verify cv_packages.qa_score >= 80
|   |   +-- Verify cv_packages.hallucination_score >= 95
|   |   +-- Verify PDF files exist and are non-zero size
|   |   +-- Verify cv_packages.status == 'ready' or 'approved'
|   |
|   +-- IF qa_pass is false OR qa_score < 80:
|   |   +-- BLOCK application
|   |   +-- Set status = 'blocked_quality'
|   |   +-- Log: "Module 2 package {package_id} did not meet quality threshold"
|   |   +-- Notify candidate: "Application blocked -- CV package quality below threshold. Review and regenerate."
|   |
|   +-- IF PDF files missing or zero size:
|       +-- Trigger WF9 (Module 2 document renderer) to regenerate documents
|       +-- If regeneration fails: BLOCK and notify
|
+-- Check 6: Factual Accuracy Verification
|   |
|   +-- Extract factual claims from the generated email body:
|   |   - Years of experience mentioned
|   |   - Team size numbers
|   |   - Employer names referenced
|   |   - Qualification claims (PhD, MBA, CIPD Level 7, etc.)
|   |   - Specific achievements with numbers (e.g., "reduced by 35%")
|   |
|   +-- Cross-reference each claim against the candidate master profile JSON
|   |   (loaded from application_config WHERE config_key = 'candidate_profile')
|   |
|   +-- For each claim:
|   |   +-- IF claim matches profile data: PASS
|   |   +-- IF claim contradicts profile data: FAIL (hard block)
|   |   +-- IF claim cannot be verified (not in profile): FLAG as unverified
|   |
|   +-- Scoring:
|   |   +-- 0 contradictions AND 0 unverified claims: auto-approved
|   |   +-- 0 contradictions AND 1+ unverified: WARNING in approval preview
|   |   +-- 1+ contradictions: BLOCK auto-send regardless of tier
|   |       Hold for manual review even if B-tier
|   |
|   +-- For A-tier approval previews: include a "Claims vs. Profile"
|       comparison section showing each factual claim and its source
|
+-- All checks passed:
    +-- Set status = 'approved' or 'auto_approved'
    +-- CONTINUE to submission engine
```

### 10.2 Duplicate Detection Algorithm

Duplicate detection operates at two levels:

**Level 1: Exact Match**
```sql
SELECT id, job_title, company, status, submitted_at
FROM applications
WHERE company_normalized = normalize_company({company})
  AND dedup_hash = generate_dedup_hash({title}, {company}, {location})
  AND status NOT IN ('failed', 'withdrawn', 'expired')
  AND created_at > NOW() - INTERVAL '90 days';
```

**Level 2: Fuzzy Match**
```sql
SELECT id, job_title, company, status, submitted_at,
       similarity(job_title, {title}) AS title_sim,
       similarity(company_normalized, normalize_company({company})) AS company_sim
FROM applications
WHERE similarity(company_normalized, normalize_company({company})) > 0.6
  AND similarity(job_title, {title}) > 0.6
  AND status NOT IN ('failed', 'withdrawn', 'expired')
  AND created_at > NOW() - INTERVAL '90 days'
ORDER BY (title_sim + company_sim) DESC
LIMIT 5;
```

**Company Name Normalization Function:**

```sql
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
```

This normalizes "Deloitte LLP" and "Deloitte UK" and "Deloitte" to the same value. It also strips common suffixes from recruitment agencies so "Hays Recruitment" and "Hays Recruitment Solutions Ltd" match.

### 10.3 Human Approval Flow for A-Tier Jobs

A-tier jobs require human approval before submission. The flow is:

1. **WF-AP2 prepares the application** -- email body generated, attachments ready, quality gate passed.

2. **Approval notification sent** -- an email to the candidate containing:
   - Job title, company, and tier score
   - Full email preview (subject line + body)
   - List of attachments
   - Key reasons for the tier score (from Module 1)
   - Two action links (GET requests load confirmation pages, not side effects):
     - `[APPROVE & SEND]` -> `https://n8n.deploy.apiloom.io/webhook/application-action?action=approve&id={application_id}&token={secure_token}`
     - `[REJECT]` -> `https://n8n.deploy.apiloom.io/webhook/application-action?action=reject&id={application_id}&token={secure_token}`
   - Optional: `[EDIT BEFORE SENDING]` -> includes a link to a simple form where the candidate can modify the email body before approving
   - **All links load a confirmation page first (GET), then require a deliberate click to execute (POST).** This prevents email security scanners (Microsoft Safe Links, Google URL scanning) from accidentally triggering approvals by following links.

3. **WF-AP5 processes the action (two-step: GET confirmation page, then POST action):**
   - GET request renders a confirmation page with job details and action button
   - POST request validates the secure token (HMAC-signed, time-limited to 72 hours)
   - **Single-use token enforcement (atomic):** Token consumption uses an atomic database operation to prevent race conditions:
     ```sql
     UPDATE applications
     SET approval_token_consumed = true, approval_consumed_at = NOW()
     WHERE id = $1
       AND approval_token_consumed = false
     RETURNING id;
     ```
     If RETURNING yields no rows, the token was already consumed -- reject the request with "This action has already been processed." This prevents double-click, concurrent requests, and replay attacks without relying on application-level locking.
   - **Audit logging:** every action records IP address, user-agent, and timestamp in `application_status_history`
   - If approved: triggers WF-AP2 to send the email immediately
   - If rejected: updates status, logs reason (if provided), archives the application
   - If edit requested: presents an n8n Form Trigger page pre-filled with the draft email; content changes are validated against the candidate profile before send

4. **Reminder system:**
   - If no action within 12 hours: send first reminder
   - If no action within 24 hours: send second reminder with urgency note
   - If no action within 48 hours: auto-expire the application with notification

**Secure Token Generation:**

```javascript
const crypto = require('crypto');

function generateApprovalToken(applicationId, expiresIn = 72 * 60 * 60) {
  const payload = {
    id: applicationId,
    exp: Math.floor(Date.now() / 1000) + expiresIn
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.APPROVAL_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

function validateApprovalToken(token) {
  const [payloadB64, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', process.env.APPROVAL_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (signature !== expectedSig) throw new Error('Invalid token');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return payload;
}
```

### 10.4 Approval Notification Email Template

```
Subject: [APPROVE] Application Ready: {job_title} at {company_name}

Hi Selvi,

Your application for {job_title} at {company_name} is ready to send.

TIER: {tier} (Score: {composite_score}/100)
METHOD: Email to {application_email}
REASON FOR A-TIER: {top_scoring_reasons}

--- EMAIL PREVIEW ---

Subject: {email_subject_line}

{email_body}

--- END PREVIEW ---

ATTACHMENTS:
- {cv_filename}
- {cl_filename}

ACTIONS:
[APPROVE & SEND] {approve_url}
[REJECT] {reject_url}
[EDIT BEFORE SENDING] {edit_url}

This approval link expires in 48 hours. If no action is taken,
the application will be archived.

---
Selvi Job App | Module 3: Auto-Apply
```

### 10.5 Quality Tiers and Automation Rules

| Tier | Email Application | Portal Application | Approval Required |
|------|-------------------|-------------------|-------------------|
| A+ (score >= 90) | Prepared, held for approval | Task card generated immediately | Yes -- manual review essential |
| A (score 75-89) | Prepared, held for approval | Task card generated immediately | Yes |
| B (score 55-74) | Auto-sent if email method | Task card generated, batched daily | No |
| C (score 35-54) | Not auto-applied | Not prepared | N/A -- candidate reviews in digest |
| D (score < 35) | Excluded from pipeline | Excluded from pipeline | N/A |

**Rationale for B-tier auto-send:** The candidate achieves a 90% callback rate manually. B-tier roles are legitimate matches that may not be perfect but are worth applying to. The system's email quality (Claude-generated, tailored materials from Module 2) is comparable to or better than a rushed manual email. Auto-sending B-tier email applications maximizes coverage without quality risk.

**B-tier quality sampling:** To ensure auto-sent B-tier emails maintain quality over time, 1 in 5 B-tier auto-sends (20%) are flagged for post-send review. The selection is deterministic (based on `application_id % 5 == 0`) to ensure consistent sampling. Sampled applications are:
- Included in the daily digest with a "QUALITY SAMPLE -- please rate" badge
- The candidate rates them 1-5 and optionally adds notes
- If the rolling average of sampled B-tier ratings drops below 3.5/5 over any 2-week window, auto-send is paused and an alert is sent: "B-tier email quality has degraded -- review prompt and resume auto-send when satisfied"
- Sampling data is stored in the `application_metrics` table and included in weekly reports

**Rationale for A-tier approval:** A-tier roles are high-value opportunities where a single application could determine the candidate's next career move. The extra 2 minutes of human review is a worthwhile investment. The candidate may want to add a personal touch, mention a referral, or adjust emphasis.

---

## 11. Application Tracking & Confirmation

### 11.1 Tracking Data Model

Every application creates a record in the `applications` table (see Section 14 for full schema). The core tracking fields are:

| Field | Purpose |
|-------|---------|
| `id` | Unique application identifier |
| `job_id` | Link to Module 1 job record |
| `status` | Current state (see state machine in Section 5.6) |
| `method` | Application method (email, portal_workday, linkedin_easy_apply, etc.) |
| `tier` | Job tier at time of application |
| `application_email` | Recipient email (for email-based applications) |
| `email_subject` | Sent email subject line |
| `email_body` | Sent email body text |
| `resend_message_id` | Resend API message ID for delivery tracking |
| `cv_file_path` | Path to the CV file used |
| `cl_file_path` | Path to the cover letter used |
| `submitted_at` | Timestamp of actual submission |
| `delivered_at` | Timestamp of email delivery confirmation |
| `opened_at` | Timestamp of email open (if tracking enabled) |
| `response_received_at` | Timestamp when candidate received a response |
| `response_type` | Type of response (interview_invite, rejection, acknowledgement, no_response) |
| `created_at` | Record creation timestamp |
| `updated_at` | Last modification timestamp |

### 11.2 Confirmation Tracking

**Email Applications:**

Confirmation comes from Resend webhooks (see Section 7.7):
- `email.delivered` -> application confirmed delivered
- `email.bounced` -> application failed, needs re-routing
- `email.opened` -> recipient opened the email (informational)

**Portal Applications:**

Confirmation is manual. When the candidate completes a portal application, they can confirm via:
1. Reply to the task card email with "done" or "completed"
2. Click a "Mark as Complete" link in the task card email
3. Future: update in a web dashboard

The email parsing approach uses a simple webhook:

```
https://n8n.deploy.apiloom.io/webhook/application-complete?id={application_id}&token={secure_token}
```

### 11.3 Response Tracking

The system tracks employer responses to measure callback rate by application method. Response types:

| Response Type | Description | How Recorded |
|--------------|-------------|--------------|
| `interview_invite` | Invitation to interview or screening call | Manual entry by candidate |
| `rejection` | Formal rejection email | Manual entry or email parsing (future) |
| `acknowledgement` | Automated "we received your application" reply | Email parsing (future) |
| `no_response` | No response after 14 days | Auto-set by WF-AP6 timer |
| `offer` | Job offer received | Manual entry |
| `withdrawn` | Candidate withdrew application | Manual entry |

**Callback Rate Calculation:**

```sql
SELECT
  method,
  COUNT(*) AS total_applications,
  COUNT(*) FILTER (WHERE response_type = 'interview_invite') AS interviews,
  COUNT(*) FILTER (WHERE response_type = 'rejection') AS rejections,
  COUNT(*) FILTER (WHERE response_type = 'no_response') AS no_response,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE response_type = 'interview_invite') /
    NULLIF(COUNT(*) FILTER (WHERE response_type IS NOT NULL), 0),
    1
  ) AS callback_rate_pct
FROM applications
WHERE status IN ('submitted', 'completed', 'delivered', 'opened')
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY method
ORDER BY callback_rate_pct DESC;
```

### 11.4 Daily Application Status Summary

WF-AP6 sends a daily status email at 7:00 AM alongside Module 1's job discovery digest:

```
Subject: Application Pipeline Status - {date}

YESTERDAY'S ACTIVITY:
- Applications submitted (auto): {auto_count}
- Applications submitted (manual): {manual_count}
- Pending your approval: {pending_approval_count}
- Pending manual completion: {pending_manual_count}
- Failed/bounced: {failed_count}

PENDING ACTIONS:
{for each pending_approval}
- [APPROVE] {job_title} at {company} (A-tier, expires in {hours}h)
  {approve_url}
{/for}

{for each pending_manual}
- [COMPLETE] {job_title} at {company} ({portal_type}, task card sent {date})
{/for}

THIS WEEK SO FAR:
- Total applications: {week_total}
- By email (auto): {week_email_auto}
- By email (manual approve): {week_email_approved}
- By portal (manual): {week_portal}
- Callback rate (last 90 days): {callback_rate}%

UPCOMING APPLICATIONS (next 24 hours):
{for each upcoming_application}
- {job_title} at {company} ({method}, {tier})
  Scheduled: {scheduled_send_at or 'next available slot'}
  To hold/cancel: reply with "HOLD {application_id_short}"
  To block this company: reply with "BLOCK {company}"
{/for}

PIPELINE:
- Queued for application: {queued_count}
- Ready for method detection: {ready_count}
- Rate-limited (will send today): {rate_limited_count}

[PAUSE ALL APPLICATIONS] {pause_url}
```

**Per-Application Control:**

The daily digest supports the following reply commands (parsed by WF-AP6):

| Reply Command | Action |
|---------------|--------|
| `PAUSE` | Pause all automated applications immediately |
| `RESUME` | Resume automated applications (with stale queue review) |
| `HOLD {id}` | Hold a specific application from being sent |
| `CANCEL {id}` | Cancel a specific queued application |
| `BLOCK {company}` | Prevent all applications to a specific company |
| `EXPORT` | Trigger a full data export (see Section 18.3) |

Reply commands are processed by a webhook that parses the subject line for the command keyword and application ID.

### 11.5 Weekly Application Report

Sent every Sunday at 8:00 PM:

```
Subject: Weekly Application Report - Week of {start_date}

APPLICATIONS THIS WEEK: {total_count}

BY METHOD:
- Email (automated): {email_auto_count}
- Email (approved): {email_approved_count}
- Portal (manual): {portal_count}
- LinkedIn Easy Apply: {linkedin_count}
- Other: {other_count}

BY TIER:
- A-tier: {a_tier_count} (approved: {a_approved}, rejected: {a_rejected}, expired: {a_expired})
- B-tier: {b_tier_count}

RESPONSE TRACKING (applications from last 90 days):
- Interview invitations received: {interview_count}
- Rejections received: {rejection_count}
- Awaiting response: {awaiting_count}
- No response (>14 days): {no_response_count}
- Callback rate: {callback_rate}%

TOP COMPANIES APPLIED TO:
{for each top_company}
- {company}: {count} applications ({methods})
{/for}

AUTOMATION EFFICIENCY:
- Fully automated: {auto_pct}%
- Assisted manual: {assisted_pct}%
- Estimated time saved: {time_saved_hours} hours

ISSUES:
{for each issue}
- {issue_description}
{/for}

COMPARED TO LAST WEEK:
- Applications: {delta_total} ({delta_pct}%)
- Callback rate: {delta_callback} percentage points
```

---

## 12. Rate Limiting & Anti-Detection

### 12.1 Rate Limiting Strategy

The system implements rate limiting at three levels to prevent being flagged as spam, triggering email provider blocks, or appearing to mass-apply.

**Level 1: Email Sending Rate**

| Limit | Default Value | Configurable |
|-------|--------------|-------------|
| Max emails per hour | 3 | Yes (application_config table) |
| Max emails per day | 15 | Yes |
| Max emails per week | 40 | Yes |
| Quiet hours (no sends) | 22:00-07:00 UK time | Yes |
| Weekend sends | Disabled on Sundays | Yes |
| UK bank holidays | No auto-sends | No (hardcoded from gov.uk calendar) |
| Christmas/New Year blackout | 23 Dec - 2 Jan: hold all sends | Yes |
| August reduced volume | Max 8 emails/day in August | Yes |

**Level 2: Per-Domain Rate**

To avoid triggering domain-specific spam filters, no more than 2 emails to the same recipient domain within a 24-hour period. This prevents scenarios where 5 different roles at the same large employer (e.g., NHS, Deloitte, Accenture) all get emails on the same day.

```sql
-- Per-domain rate check
SELECT COUNT(*) FROM applications
WHERE method = 'email'
  AND split_part(application_email, '@', 2) = {target_domain}
  AND submitted_at > NOW() - INTERVAL '24 hours'
  AND status IN ('submitted', 'delivered', 'opened');
-- Must be < 2
```

**Level 3: Velocity Control**

Emails are not sent in rapid succession. A random delay of 2-8 minutes is inserted between consecutive email sends to simulate natural human behavior.

```javascript
// Random delay between sends
const minDelayMs = 2 * 60 * 1000;  // 2 minutes
const maxDelayMs = 8 * 60 * 1000;  // 8 minutes
const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs)) + minDelayMs;
await new Promise(resolve => setTimeout(resolve, delay));
```

### 12.2 Send Time Optimization

Applications sent during business hours (9 AM - 5 PM UK time, Monday-Friday) are more likely to be read promptly. The system schedules sends to optimize for this:

**Priority Scheduling:**

| Job Tier | Send Window | Rationale |
|----------|------------|-----------|
| A+ | Immediately (within approval flow hours) | Speed matters for top matches |
| A | 8:00-10:00 AM or 2:00-4:00 PM | Top-of-inbox timing |
| B | 9:00 AM - 5:00 PM, Mon-Fri | Standard business hours |
| Agency responses | 9:00 AM - 6:00 PM, Mon-Fri | Agencies check email later |

**Implementation:**

The send scheduler assigns each queued email a `scheduled_send_at` timestamp based on these rules. WF-AP1 picks up emails only when `scheduled_send_at <= NOW()`.

```sql
UPDATE applications
SET scheduled_send_at = CASE
  WHEN tier IN ('A+', 'A') AND EXTRACT(DOW FROM NOW()) BETWEEN 1 AND 5
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') BETWEEN 8 AND 16
    THEN NOW() + (random() * INTERVAL '30 minutes')
  WHEN tier = 'B'
    THEN next_business_hour(NOW(), 9, 17)
  ELSE
    next_business_hour(NOW(), 9, 17)
END
WHERE id = {application_id}
  AND scheduled_send_at IS NULL;
```

### 12.3 Email Reputation Management

**Sender Reputation Protection:**

1. **Domain warming:** When first deploying Resend with a new domain, start with 5 emails/day and increase by 5/day over 2 weeks. This warms the domain's sending reputation with email providers.

2. **SPF/DKIM/DMARC:** All three must be configured correctly for the sending domain. Resend handles DKIM signing; SPF and DMARC records must be added to DNS.

3. **Bounce handling:** Emails that hard bounce (invalid address) must not be retried. The email address is added to a suppression list.

4. **Complaint handling:** If any email is marked as spam (Resend `email.complained` event), immediately halt all sends and alert the candidate. This is a critical event that could damage the sending domain's reputation.

5. **Unsubscribe header:** While not strictly required for job applications, including a `List-Unsubscribe` header improves deliverability with Gmail and Outlook. The unsubscribe link can point to a webhook that marks the candidate as having withdrawn from that application.

**Domain suppression list:**

```sql
CREATE TABLE email_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT NOT NULL,
    domain TEXT NOT NULL,
    reason TEXT NOT NULL, -- hard_bounce, complaint, manual
    suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(email_address)
);
```

Before sending any email, check:
```sql
SELECT EXISTS(
  SELECT 1 FROM email_suppressions
  WHERE email_address = {target_email}
     OR domain = split_part({target_email}, '@', 2)
);
```

### 12.4 Manual Task Rate Limiting

Portal task cards are not rate-limited in the same way as emails (since the candidate controls the pace of manual submissions). However, the system limits task card generation to prevent overwhelming the candidate:

| Limit | Default Value |
|-------|--------------|
| Max portal task cards per day | 5 |
| Max total pending manual tasks | 10 |
| Task card expiry | 7 days after generation |

When the pending manual task queue reaches 10, new portal-based applications are held in "queued" status until existing tasks are completed or expired.

---

## 13. Legal & Ethical Compliance

### 13.1 UK Employment Law Considerations

**Equality Act 2010:**

The system must not discriminate on any protected characteristic. This is relevant in several ways:

1. **Application content:** Generated emails and supporting statements must not reference the candidate's age, gender, ethnicity, disability status, religion, or sexual orientation unless directly relevant to a genuine occupational requirement (rare for L&D/academic roles).

2. **Equal opportunities monitoring:** The system can pre-fill equal opportunities forms with the candidate's chosen responses but must make clear these are optional. The task card includes a reminder that these questions should not affect the application.

3. **Right to work:** The system includes "Right to work: Yes" in task card data. This is a factual declaration, not discriminatory. The candidate must ensure this is accurate.

**Data Protection Act 2018 / UK GDPR:**

1. **Lawful basis for processing:** The candidate is the data controller for her own personal data. She has consented to the system processing her data for the purpose of job applications. No third-party consent is needed for sending her own CV.

2. **Data minimization:** The system should include only information necessary for the application. Personal details beyond what is on the CV (e.g., date of birth, NI number) should only be stored if needed for specific portal forms and should be entered at point of use, not pre-stored unnecessarily.

3. **Retention:** Application records should be retained for the duration of the job search plus a reasonable period (12 months) for tracking outcomes and improving the system. After this period, personal data should be anonymized or deleted.

4. **Third-party data:** Referee contact details are shared with employers as part of the application process. The candidate must have the referees' consent to share their details. The system should remind the candidate of this obligation.

5. **Right to erasure:** The candidate can request deletion of all application data at any time. The system must support a data export (SAR) and deletion function.

**Employment Agencies Act 1973 and Conduct Regulations 2003:**

When the system sends emails to recruitment agencies, these communications fall under the regulation of employment agency interactions. Key requirements:
- The candidate must not be charged for the agency's services (agencies are paid by employers)
- The agency must have the candidate's consent to represent them to employers (Regulation 15)
- The agency must provide written terms before submitting the candidate to an employer (Regulation 14)
- Communications with agencies should be clear that the candidate is applying voluntarily

**Agency-specific safeguards in Module 3:**
- An `authorized_agencies` list is maintained in the `known_contacts` table, tracking which agencies the candidate has formal agreements with
- **First-contact agencies** (not in known_contacts): applications are held for approval regardless of tier, to prevent unintended contractual relationships
- All agency emails include a legally specific disclaimer: "In accordance with the Conduct of Employment Agencies and Employment Businesses Regulations 2003 (Regulation 15), please do not submit my details to any employer without obtaining my explicit prior written consent for each specific role. I require written confirmation of the employer name, role title, and terms before any submission is made on my behalf."
- The system tracks agency-employer representation to prevent double submissions: if two agencies are handling the same role, the system flags the conflict
- The candidate can mark an agency as "authorized" after establishing terms, enabling auto-send for that agency's B-tier roles
- **Authorization requires explicit confirmation:** When marking an agency as authorized, the system prompts: "Confirming auto-send to {agency_name}. This agency may submit your CV to employers on your behalf. Have you agreed to their terms of engagement? [Yes/No]"
- **Agency auto-send is opt-in per agency, not global:** Even with B-tier auto-send enabled, agencies not in the authorized list are always held for approval
- **Quarterly review reminder:** Every 90 days, the system prompts the candidate to review the authorized agencies list and remove any agencies they no longer wish to auto-send to

### 13.2 Platform Terms of Service Compliance

**The Core Principle:** The system automates the candidate's own actions (composing and sending her own emails with her own CV). It does not automate interactions with third-party platforms that prohibit automation.

| Platform | Automation Permitted | Our Approach |
|----------|---------------------|-------------|
| Email (any provider) | Yes -- email is an open protocol | Fully automated sending via Resend |
| Resend API | Yes -- explicit purpose of the service | Email delivery |
| LinkedIn | No -- ToS prohibits automated actions | Manual task cards only, no API calls |
| Indeed Apply | No -- ToS prohibits automated submissions | Manual task cards only |
| Workday | No -- ToS prohibits automated form filling | Manual task cards only |
| Taleo | No -- ToS prohibits automated access | Manual task cards only |
| Any ATS portal | Varies, assume No | Manual task cards only |
| jobs.ac.uk | No automated applications | Manual task cards only |
| NHS Jobs | No automated applications | Manual task cards only |
| Civil Service Jobs | No automated applications | Manual task cards only |
| Reed.co.uk | No automated applications via their portal | Manual task cards only |

**Email-specific compliance:**

Sending application emails via Resend is legally and ethically equivalent to the candidate sending them from her own email client. The emails are:
- Sent with the candidate's identity
- One-to-one communications (not bulk marketing)
- Solicited (the employer or agency has published an email address for applications)
- Contain legitimate content (a job application)

This does not fall under anti-spam legislation (PECR, CAN-SPAM) because:
- These are not marketing emails
- They are not sent to consumers
- They are person-to-person communications to publicly listed application addresses
- There is a clear business relationship basis (responding to a job advertisement)

### 13.3 Ethical Guidelines

**Truthfulness:**
- The system must never generate false claims about the candidate's experience, qualifications, or skills
- AI-generated email bodies must only reference achievements and qualifications present in the candidate's master profile
- Prompts include explicit instructions against hallucination

**Transparency:**
- Application emails do not need to disclose that they were AI-generated (this is not required by law and would be counterproductive)
- However, the candidate should be aware that AI generates the email text and should be comfortable with the content
- A-tier approval flow provides this review opportunity

**Respectful volume:**
- Rate limiting prevents the system from flooding any single employer or agency
- The system respects working hours for email delivery
- No more than 2 applications to the same organization within 30 days (unless for genuinely different roles)

**Withdrawal:**
- The system provides a mechanism to withdraw applications
- If the candidate accepts an offer, all pending applications should be withdrawn (or at least paused)

### 13.4 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Email flagged as spam | Low | Medium | Proper SPF/DKIM/DMARC, domain warming, rate limiting |
| Application rejected for being "automated" | Very Low | Medium | Human-quality email composition, no detectable patterns |
| Platform account banned (LinkedIn, Indeed) | Very Low | High | No portal automation -- manual only |
| Duplicate application sent | Low | Low | Dedup checks at multiple levels |
| AI hallucinates candidate experience | Low | High | Strict prompts, master profile anchoring, A-tier review |
| Sending domain blacklisted | Very Low | Critical | Reputation management, complaint monitoring, immediate halt on complaint |
| Referee contacted without preparation | Medium | Medium | Reminder in task cards, separate notification when academic apps submitted |
| GDPR breach (data leakage) | Very Low | High | All data on self-hosted infra, no third-party data sharing beyond applications |
| Legal challenge from employer/agency | Very Low | Medium | Email applications are legally equivalent to manual sends |

---

## 14. Database Schema

### 14.1 Schema Overview

Module 3 adds the following tables to the existing `selvi_jobs` database:

```sql
-- ============================================================
-- MODULE 3: AUTOMATED JOB APPLICATION SYSTEM
-- Database Schema Extension
-- ============================================================

-- Applications table: core tracking for every application
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'queued',
    -- Valid statuses: queued, method_detected, email_ready, portal_task_ready,
    --   pending_approval, auto_approved, approved, rejected, submitted,
    --   delivered, opened, pending_manual, completed, response_received,
    --   failed, method_failed, expired, withdrawn, blocked_duplicate,
    --   rate_limited

    -- Method detection
    method TEXT,
    -- Valid methods: email, portal_workday, portal_taleo, portal_stonefish,
    --   portal_jobtrain, portal_oleeo, portal_tribepad, portal_eploy,
    --   portal_icims, portal_greenhouse, portal_lever, portal_smartrecruiters,
    --   portal_workable, portal_generic, portal_civil_service, portal_nhs,
    --   portal_jobs_ac_uk, portal_reed, portal_totaljobs,
    --   linkedin_easy_apply, indeed_apply, unknown
    method_confidence NUMERIC(3,2), -- 0.00-1.00
    method_detected_at TIMESTAMPTZ,

    -- Application type
    application_type TEXT DEFAULT 'direct',
    -- Valid types: direct, agency_response, speculative, referral
    tier TEXT, -- A+, A, B (copied from job at time of application)
    composite_score NUMERIC(5,2), -- copied from job at time of application

    -- Email application fields
    application_email TEXT,
    email_subject TEXT,
    email_body TEXT,
    email_body_html TEXT, -- if HTML email is used
    resend_message_id TEXT,

    -- File references
    cv_file_path TEXT,
    cv_format TEXT, -- pdf, docx
    cl_file_path TEXT,
    cl_format TEXT, -- pdf
    supporting_statement_path TEXT,
    additional_documents JSONB DEFAULT '[]',
    -- Format: [{"type": "teaching_philosophy", "path": "/data/...", "format": "pdf"}]

    -- Portal task card fields
    task_card_content TEXT, -- full task card text
    portal_type TEXT,
    portal_url TEXT,
    portal_specific_data JSONB DEFAULT '{}',
    -- Format: {"date_format": "DD/MM/YYYY", "requires_account": true, ...}
    estimated_manual_minutes INTEGER,

    -- Scheduling
    scheduled_send_at TIMESTAMPTZ,

    -- Approval tracking
    approval_token TEXT,
    approval_token_expires_at TIMESTAMPTZ,
    approval_requested_at TIMESTAMPTZ,
    approval_token_consumed_at TIMESTAMPTZ, -- single-use enforcement: set on first use
    approval_reminder_count INTEGER DEFAULT 0,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Submission tracking
    submitted_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,

    -- Response tracking
    response_received_at TIMESTAMPTZ,
    response_type TEXT,
    -- Valid types: interview_invite, rejection, acknowledgement,
    --   no_response, offer, withdrawn
    response_notes TEXT,

    -- Referral tracking
    referral_name TEXT,
    referral_relationship TEXT,
    referral_mentioned_in_application BOOLEAN DEFAULT false,

    -- Duplicate tracking
    dedup_hash TEXT,
    company_normalized TEXT,
    blocked_by_application_id UUID REFERENCES applications(id),

    -- Error tracking
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for applications
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_method ON applications(method);
CREATE INDEX idx_applications_tier ON applications(tier);
CREATE INDEX idx_applications_submitted_at ON applications(submitted_at);
CREATE INDEX idx_applications_created_at ON applications(created_at);
CREATE INDEX idx_applications_dedup_hash ON applications(dedup_hash);
CREATE INDEX idx_applications_company_normalized ON applications(company_normalized);
CREATE INDEX idx_applications_scheduled_send ON applications(scheduled_send_at)
    WHERE status IN ('auto_approved', 'approved');
CREATE INDEX idx_applications_pending_approval ON applications(id)
    WHERE status = 'pending_approval';
CREATE INDEX idx_applications_pending_manual ON applications(id)
    WHERE status = 'pending_manual';
CREATE INDEX idx_applications_resend_id ON applications(resend_message_id);
CREATE INDEX idx_applications_company_title ON applications
    USING gin(company_normalized gin_trgm_ops);


-- Application status history: audit trail of every status change
CREATE TABLE application_status_history (
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

CREATE INDEX idx_app_status_history_app_id ON application_status_history(application_id);
CREATE INDEX idx_app_status_history_changed_at ON application_status_history(changed_at);
CREATE INDEX idx_app_status_history_action_type ON application_status_history(action_type)
    WHERE action_type IS NOT NULL;
CREATE INDEX idx_app_status_history_source_ip ON application_status_history(source_ip)
    WHERE source_ip IS NOT NULL;


-- Application configuration: system-wide settings
CREATE TABLE application_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
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
]', 'Referee details for application forms');


-- Known contacts: recruiter and agency relationship tracking
CREATE TABLE known_contacts (
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

CREATE UNIQUE INDEX idx_known_contacts_email ON known_contacts(email_address);

-- Email suppressions: domains and addresses that should not receive emails
CREATE TABLE email_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT,
    domain TEXT,
    reason TEXT NOT NULL, -- hard_bounce, complaint, manual, unsubscribe
    source_application_id UUID REFERENCES applications(id),
    suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_email_suppressions_email ON email_suppressions(email_address)
    WHERE email_address IS NOT NULL;
CREATE INDEX idx_email_suppressions_domain ON email_suppressions(domain)
    WHERE domain IS NOT NULL;


-- Document library: reusable supplementary documents
CREATE TABLE document_library (
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

CREATE INDEX idx_document_library_type ON document_library(document_type);
CREATE INDEX idx_document_library_current ON document_library(is_current)
    WHERE is_current = true;


-- Application metrics: pre-computed daily metrics for dashboards
CREATE TABLE application_metrics (
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

CREATE INDEX idx_application_metrics_date ON application_metrics(metric_date);
```

### 14.2 Updated jobs Table Extension

Module 3 adds the following columns to the existing `jobs` table created by Module 1:

```sql
-- Add application-related columns to existing jobs table
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

-- Index for Module 3's primary query
CREATE INDEX idx_jobs_ready_to_apply ON jobs(ready_to_apply, tier)
    WHERE ready_to_apply = true AND status = 'scored';
```

### 14.3 Trigger Functions

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-log status changes to history table
-- Note: webhook-initiated changes should set metadata fields
-- (source_ip, user_agent, token_hash) via the workflow code
-- before updating the status, then pass them through the trigger.
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

CREATE TRIGGER log_application_status
    AFTER UPDATE OF status ON applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_status_change();

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

CREATE TRIGGER compute_application_dedup_trigger
    BEFORE INSERT ON applications
    FOR EACH ROW
    EXECUTE FUNCTION compute_application_dedup();
```

### 14.4 Database Views

```sql
-- Active applications view (excludes terminal states)
CREATE VIEW v_active_applications AS
SELECT a.*, j.title AS job_title, j.company, j.location AS job_location,
       j.salary_min, j.salary_max, j.url AS job_url, j.description AS job_description
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE a.status NOT IN ('failed', 'expired', 'withdrawn', 'rejected', 'blocked_duplicate', 'deleted');

-- Pending actions view (things the candidate needs to do)
CREATE VIEW v_pending_actions AS
SELECT a.id, a.status, a.method, a.tier, a.created_at,
       j.title AS job_title, j.company, j.url AS job_url,
       a.approval_token_expires_at,
       a.task_card_content IS NOT NULL AS has_task_card,
       CASE
           WHEN a.status = 'pending_approval' THEN 'Review and approve application email'
           WHEN a.status = 'pending_manual' THEN 'Complete portal application'
           WHEN a.status = 'unknown' THEN 'Identify application method'
           ELSE 'Unknown action required'
       END AS action_description
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE a.status IN ('pending_approval', 'pending_manual', 'unknown')
  AND a.status != 'deleted'
ORDER BY
    CASE a.tier
        WHEN 'A+' THEN 1
        WHEN 'A' THEN 2
        WHEN 'B' THEN 3
        ELSE 4
    END,
    a.created_at ASC;

-- Callback rate by method
CREATE VIEW v_callback_rate AS
SELECT
    method,
    COUNT(*) AS total_applications,
    COUNT(*) FILTER (WHERE response_type = 'interview_invite') AS interviews,
    COUNT(*) FILTER (WHERE response_type = 'rejection') AS rejections,
    COUNT(*) FILTER (WHERE response_type = 'no_response') AS no_responses,
    COUNT(*) FILTER (WHERE response_type = 'offer') AS offers,
    COUNT(*) FILTER (WHERE response_type IS NOT NULL) AS responses_recorded,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE response_type = 'interview_invite') /
        NULLIF(COUNT(*) FILTER (WHERE response_type IS NOT NULL), 0),
        1
    ) AS callback_rate_pct
FROM applications
WHERE status IN ('submitted', 'completed', 'delivered', 'opened', 'response_received')
  AND status != 'deleted'
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY method;

-- Weekly metrics view
CREATE VIEW v_weekly_metrics AS
SELECT
    date_trunc('week', metric_date)::date AS week_start,
    SUM(total_applications) AS total_applications,
    SUM(email_auto_count) AS email_auto,
    SUM(email_approved_count) AS email_approved,
    SUM(portal_manual_count) AS portal_manual,
    SUM(linkedin_count) AS linkedin,
    SUM(interviews_received) AS interviews,
    SUM(rejections_received) AS rejections,
    SUM(duplicates_blocked) AS duplicates_blocked,
    SUM(errors_count) AS errors
FROM application_metrics
GROUP BY date_trunc('week', metric_date)
ORDER BY week_start DESC;
```

---

## 15. n8n Workflow Specifications

### 15.1 WF-AP1: Application Router

**Purpose:** Pick up jobs ready for application, detect application method, route to appropriate engine.

**Trigger:** Cron -- every 15 minutes during active hours (7:00 AM - 10:00 PM UK time)

**Node-by-Node Specification:**

```
Node 1: Schedule Trigger
  Type: n8n-nodes-base.scheduleTrigger
  Settings:
    Rule: CRON
    Expression: */15 7-22 * * *
    Timezone: Europe/London

Node 2: Check System Paused
  Type: n8n-nodes-base.postgres
  Operation: Execute Query
  Query: SELECT (config_value->>'system_paused')::boolean AS paused
         FROM application_config WHERE config_key = 'auto_apply_rules'
  On Error: Continue (assume not paused)

  --> IF paused = true: Stop workflow (No Operation node)

Node 3: Fetch Ready Jobs
  Type: n8n-nodes-base.postgres
  Operation: Execute Query
  Query: |
    SELECT j.id AS job_id, j.title, j.company, j.location, j.url,
           j.description, j.tier, j.composite_score, j.job_type,
           j.application_method, j.application_email,
           j.cv_file_path, j.cl_file_path,
           j.metadata, j.closing_date
    FROM jobs j
    WHERE j.ready_to_apply = true
      AND j.tier IN ('A+', 'A', 'B')
      AND (j.closing_date IS NULL OR j.closing_date >= CURRENT_DATE)
      AND j.id NOT IN (
          SELECT job_id FROM applications
          WHERE status NOT IN ('failed', 'expired', 'withdrawn')
      )
    ORDER BY
      -- Urgent closing dates first (within 48 hours)
      CASE WHEN j.closing_date IS NOT NULL AND j.closing_date <= CURRENT_DATE + 2
           THEN 0 ELSE 1 END,
      CASE j.tier WHEN 'A+' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 END,
      j.composite_score DESC
    LIMIT 10

  --> IF no results: Stop workflow

Node 4: Split In Batches
  Type: n8n-nodes-base.splitInBatches
  Batch Size: 1
  Options:
    Reset: false
  -- Note on serial processing: n8n's splitInBatches processes items sequentially.
  -- At typical volumes (5-10 jobs per run), this takes 2-5 minutes per run,
  -- which is acceptable given the 15-minute interval. If volumes increase beyond
  -- 20 jobs per run, consider splitting into parallel sub-workflow executions:
  -- WF-AP1 inserts all application records, then triggers WF-AP2/WF-AP3 as
  -- independent sub-workflow executions (one per application) rather than
  -- processing in a serial loop. This requires rate-limiting at the sub-workflow
  -- level rather than the loop level.

Node 5: Method Detection (Code Node)
  Type: n8n-nodes-base.code
  Language: JavaScript
  Code: [Application method detection logic from Section 6.2]
  Input: job record from Node 4
  Output: { method, confidence, email_address, portal_url, portal_type }

Node 6: AI Method Analysis (conditional)
  Type: n8n-nodes-base.httpRequest (Claude API)
  Condition: Execute only if Node 5 confidence < 0.7 AND method != 'email'
  URL: https://api.anthropic.com/v1/messages
  Method: POST
  Body: [Method detection prompt with job description]

  --> Merge with Node 5 output (take higher confidence)

Node 7: Create Application Record
  Type: n8n-nodes-base.postgres
  Operation: Insert
  Table: applications
  Columns: job_id, status ('method_detected'), method, method_confidence,
           method_detected_at, tier, composite_score, application_type,
           application_email, portal_url, portal_type

Node 8: Route by Method (Switch Node)
  Type: n8n-nodes-base.switch
  Rules:
    - method = 'email' -> Output 1 (Email Engine)
    - method starts with 'portal_' -> Output 2 (Portal Engine)
    - method = 'linkedin_easy_apply' -> Output 2 (Portal Engine)
    - method = 'indeed_apply' -> Output 2 (Portal Engine)
    - method = 'unknown' -> Output 3 (Flag for manual)

Output 1 -> Execute Workflow: WF-AP2 (Email Application Engine)
Output 2 -> Execute Workflow: WF-AP3 (Portal Preparation Engine)
Output 3 -> Update status to 'unknown', send notification to candidate
```

### 15.2 WF-AP2: Email Application Engine

**Purpose:** Compose and send email applications with tailored CV and cover letter.

**Trigger:** Called by WF-AP1 (Execute Workflow node) with application_id

**Node-by-Node Specification:**

```
Node 1: Workflow Trigger (Execute Workflow Trigger)
  Input: application_id

Node 2: Load Application Data
  Type: n8n-nodes-base.postgres
  Query: SELECT a.*, j.title, j.company, j.description, j.metadata
         FROM applications a JOIN jobs j ON a.job_id = j.id
         WHERE a.id = {application_id}

Node 3: Load Tailored Materials
  Type: n8n-nodes-base.readWriteFile
  Operation: Read From Disk
  File Path 1: {cv_file_path}
  File Path 2: {cl_file_path}

Node 4: Load Cover Letter Key Points
  Type: n8n-nodes-base.postgres
  Query: SELECT key_points FROM cv_tailoring WHERE job_id = {job_id}

Node 5: Quality Gate (Execute Sub-Workflow)
  Sub-workflow: WF-AP4
  Input: application_id, job_id, method, tier

  --> IF blocked: Update status, EXIT

Node 6: Determine Attachment Format
  Type: n8n-nodes-base.code
  Logic: agency -> DOCX, else -> PDF

Node 7: Email Composer (Execute Sub-Workflow)
  Sub-workflow: SW-AP1
  Input: job_data, candidate_profile, application_type, tier
  Output: { subject_line, email_body }

Node 8: Validate Email Content
  Type: n8n-nodes-base.code
  Logic:
    - Check word count (50-300)
    - Check banned phrases
    - Check subject line length
    - UK English spot check

  --> IF validation fails: Re-call Node 7 with corrective instructions (max 2 retries)

Node 9: Route by Tier (IF Node)
  Condition: tier IN ('A+', 'A')

  True -> Node 10 (Approval Flow)
  False -> Node 11 (Auto-Send)

Node 10: Approval Flow
  a. Save draft to applications table (email_subject, email_body)
  b. Generate approval token
  c. Compose approval notification email
  d. Send approval notification via Resend
  e. Update status = 'pending_approval'
  f. EXIT

Node 11: Auto-Send
  a. Update status = 'auto_approved'
  b. Apply send scheduling (check scheduled_send_at)
  c. IF scheduled_send_at > NOW(): Queue and EXIT
  d. Random delay (2-8 minutes) if other emails sent recently

Node 12: Send Application Email
  Type: n8n-nodes-resend (community node)
  From: {from_name} <{from_email}>
  To: {application_email}
  Reply-To: {reply_to}
  Subject: {subject_line}
  Text: {email_body}
  Attachments: [CV binary, Cover Letter binary]

  --> Capture resend_message_id from response

Node 13: Log Submission
  Type: n8n-nodes-base.postgres
  Update applications:
    status = 'submitted',
    resend_message_id = {message_id},
    submitted_at = NOW()

Node 14: Error Handler
  Type: n8n-nodes-base.errorTrigger
  On Error:
    - Log error to applications table
    - Increment error_count
    - IF error_count < 3: Set status = 'queued' for retry
    - IF error_count >= 3: Set status = 'failed', alert candidate
```

### 15.3 WF-AP3: Portal Preparation Engine

**Purpose:** Generate task cards for manual portal applications.

**Trigger:** Called by WF-AP1 with application_id and portal_type

```
Node 1: Workflow Trigger
  Input: application_id, portal_type

Node 2: Load Application + Job Data
  Type: n8n-nodes-base.postgres

Node 3: Load Tailored Materials + Candidate Profile
  Type: n8n-nodes-base.postgres + n8n-nodes-base.readWriteFile

Node 4: Quality Gate (WF-AP4 -- dedup only)

Node 5: Load Portal-Specific Config
  Type: n8n-nodes-base.postgres
  Query: config from application_config WHERE config_key = 'portal_patterns'

Node 6: Format Data for Portal
  Type: n8n-nodes-base.code
  Logic:
    - Date formatting per portal type
    - Work history ordering
    - Character limit compliance
    - Referee detail formatting

Node 7: Check for Supplementary Document Requirements
  Type: n8n-nodes-base.code
  Logic:
    - IF academic role AND portal requires supporting statement
      -> Call Claude Sonnet to generate (Node 8)
    - Check for teaching philosophy, research statement, etc.
    - Query document_library for available supplementary docs

Node 8: Generate Supporting Statement (conditional)
  Type: n8n-nodes-base.httpRequest (Claude API)
  Model: Claude 3.5 Sonnet (academic content needs higher quality)

Node 9: Assemble Task Card
  Type: n8n-nodes-base.code (or n8n-nodes-text-templater)
  Template: Task card template from Section 8.2
  Variables: All formatted data + portal-specific instructions

Node 10: Send Task Card Email
  Type: n8n-nodes-resend
  To: {candidate_email}
  Subject: [ACTION] Apply: {job_title} at {company} ({portal_type})
  Text: {task_card_content}
  Attachments: [CV PDF, CV DOCX, Cover Letter PDF, Supporting Statement if applicable]

Node 11: Update Application Record
  Type: n8n-nodes-base.postgres
  Update:
    status = 'pending_manual',
    task_card_content = {task_card},
    portal_type = {portal_type},
    estimated_manual_minutes = {estimate}
```

### 15.4 WF-AP4: Quality Gate (Sub-Workflow)

**Purpose:** Validate application before submission -- dedup, rate limit, content quality.

**Trigger:** Called as sub-workflow by WF-AP2 and WF-AP3

```
Node 1: Sub-Workflow Trigger
  Input: application_id, job_id, method, tier

Node 2: Duplicate Check (Level 1: Exact)
  Type: n8n-nodes-base.postgres
  Query: [Exact match query from Section 10.2]

  --> IF found: Return { blocked: true, reason: 'duplicate', existing_id }

Node 3: Duplicate Check (Level 2: Fuzzy)
  Type: n8n-nodes-base.postgres
  Query: [Fuzzy match query from Section 10.2]

  --> IF found with high similarity: Return { blocked: true, reason: 'possible_duplicate' }
  --> IF found with medium similarity: Return { warning: 'possible_duplicate' }

Node 4: Rate Limit Check (email only)
  Condition: method = 'email'
  Type: n8n-nodes-base.postgres
  Queries: [Hourly, daily, weekly rate checks from Section 10.1]

  --> IF over limit: Return { blocked: true, reason: 'rate_limited' }

Node 5: Quiet Hours Check
  Type: n8n-nodes-base.code
  Logic: Check if current UK time is within quiet hours

  --> IF quiet hours: Return { blocked: true, reason: 'quiet_hours' }

Node 6: Suppression List Check
  Type: n8n-nodes-base.postgres
  Query: Check email_suppressions for target email/domain

  --> IF suppressed: Return { blocked: true, reason: 'suppressed' }

Node 7: Return Result
  Output: { blocked: boolean, reason: string, warnings: string[] }
```

### 15.5 WF-AP5: Approval Handler

**Purpose:** Process A-tier application approvals and rejections via webhook.

**Trigger:** n8n Webhook -- HTTPS GET (landing page) + POST (actions)

The approval flow uses a two-step process to prevent email security scanners from triggering side effects. GET requests render a confirmation page; POST requests perform the action. All tokens are single-use and invalidated after first use.

```
Webhook URL: https://n8n.deploy.apiloom.io/webhook/application-action

Node 1: Webhook Trigger (GET -- landing page)
  Method: GET
  Path: /application-action
  Query Parameters: action (approve|reject|edit), id, token

Node 1b: Validate Token (initial)
  Type: n8n-nodes-base.code
  Logic: [Token validation from Section 10.3]
  Note: Returns generic 400 for ALL failure types (invalid, expired,
        not found) to prevent enumeration attacks

  --> IF invalid/expired/consumed: Return 400 with generic error page
  --> IF valid: Continue to Node 2

Node 2: Load Application
  Type: n8n-nodes-base.postgres
  Query: SELECT * FROM applications WHERE id = {id} AND status = 'pending_approval'

  --> IF not found or wrong status: Return 400 (generic error)

Node 3: Render Confirmation Page (GET response)
  Type: n8n-nodes-base.respondToWebhook
  Returns: HTML confirmation page showing:
    - Job title, company, email preview
    - "Confirm & Send" button (POST form with hidden token + action fields)
    - "Reject" button (POST form)
    - JavaScript-based protection: page requires deliberate click
    - No side effects from GET request
  Note: Email scanner prefetch/Safe Links will load this page but
        will not submit the POST form, preventing accidental approvals

Node 4: Webhook Trigger (POST -- execute action)
  Method: POST
  Path: /application-action-confirm
  Body Parameters: action, id, token

Node 4b: Validate Token + Single-Use Check
  Type: n8n-nodes-base.code
  Logic:
    - Validate HMAC signature and expiry
    - Check token has not been consumed (query approval_token_consumed_at)
    - Log IP address and user-agent for audit trail
    - Mark token as consumed: UPDATE applications
      SET approval_token_consumed_at = NOW() WHERE id = {id}
  --> IF invalid/consumed: Return 400 with generic error

Node 5: Route by Action (Switch)

  action = 'approve':
    a. Update status = 'approved', approved_at = NOW()
    b. Log approval context (IP, user-agent, timestamp) in status history
    c. Trigger WF-AP2 to send email (Execute Workflow)
    d. Return success page: "Application approved and sent!"

  action = 'reject':
    a. Update status = 'rejected', rejected_at = NOW()
    b. Log rejection_reason if provided
    c. Return confirmation page: "Application archived."

  action = 'edit':
    a. Return n8n Form (using n8n Form Trigger) with pre-filled email
       subject and body
    b. Form requires re-validating the token before submission
    c. On form submit:
       - Validate content changes against candidate profile (fact-check)
       - Update email_subject and email_body
       - Trigger approval flow again (or direct send)
       - Return success page

Node 6: Error Handler
  On any error: Return generic error page with no internal details
  (no stack traces, no workflow names, no n8n version info)
```

### 15.6 WF-AP6: Status Tracker & Reporter

**Purpose:** Update application statuses, send daily summaries and weekly reports.

**Triggers:**
- Cron: Daily at 7:00 AM UK time (daily summary)
- Cron: Weekly Sunday at 8:00 PM UK time (weekly report)
- Cron: Every 4 hours (status maintenance)

```
---- Daily Summary Branch ----

Node D1: Compute Daily Metrics
  Type: n8n-nodes-base.postgres
  Queries:
    - Count applications by status and method for yesterday
    - Count pending approvals
    - Count pending manual tasks
    - Count rate-limited/queued applications
    - Get callback rate

Node D2: Compose Daily Summary Email
  Type: n8n-nodes-base.code
  Template: [Daily summary template from Section 11.4]

Node D3: Send Daily Summary
  Type: n8n-nodes-resend
  To: {candidate_email}
  Subject: Application Status - {date}

Node D4: Store Daily Metrics
  Type: n8n-nodes-base.postgres
  Insert into application_metrics

---- Weekly Report Branch ----

Node W1: Compute Weekly Metrics
  Type: n8n-nodes-base.postgres
  Queries: [Aggregations for the week]

Node W2: Compare to Previous Week
  Type: n8n-nodes-base.postgres

Node W3: Compose Weekly Report
  Type: n8n-nodes-base.code
  Template: [Weekly report template from Section 11.5]

Node W4: Send Weekly Report
  Type: n8n-nodes-resend

---- Maintenance Branch (every 4 hours) ----

Node M1: Expire Stale Approvals
  Type: n8n-nodes-base.postgres
  Query: UPDATE applications SET status = 'expired'
         WHERE status = 'pending_approval'
         AND approval_token_expires_at < NOW()

Node M2: Send Approval Reminders
  Type: n8n-nodes-base.postgres + n8n-nodes-resend
  Query: SELECT applications needing reminders (12h, 24h)
  Action: Send reminder emails, increment approval_reminder_count

Node M3: Expire Stale Manual Tasks
  Type: n8n-nodes-base.postgres
  Query: UPDATE applications SET status = 'expired'
         WHERE status = 'pending_manual'
         AND created_at < NOW() - INTERVAL '7 days'

Node M4: Mark No-Response Applications
  Type: n8n-nodes-base.postgres
  Query: UPDATE applications SET response_type = 'no_response'
         WHERE status IN ('submitted', 'delivered', 'opened', 'completed')
         AND response_type IS NULL
         AND submitted_at < NOW() - INTERVAL '14 days'
```

### 15.7 SW-AP1: Email Composer (Sub-Workflow)

**Purpose:** Generate application email body and subject line using Claude.

```
Node 1: Sub-Workflow Trigger
  Input: job_data, candidate_profile, cover_letter_key_points,
         application_type, tier

Node 2: Load Email Config
  Type: n8n-nodes-base.postgres
  Query: SELECT config_value FROM application_config
         WHERE config_key = 'email_config'

Node 3: Select AI Model
  Type: n8n-nodes-base.code
  Logic:
    - IF tier IN ('A+', 'A') -> model = 'claude-3-5-sonnet-20241022'
    - IF tier = 'B' -> model = 'claude-3-5-haiku-20241022'

Node 4: Compose Prompt
  Type: n8n-nodes-base.code
  Template: [Email composition prompt from Section 7.2]
  Variables: Merged from job_data, candidate_profile, cover_letter_key_points

Node 5: Call Claude API
  Type: n8n-nodes-base.httpRequest
  URL: https://api.anthropic.com/v1/messages
  Method: POST
  Headers:
    x-api-key: {ANTHROPIC_API_KEY}
    anthropic-version: 2023-06-01
    content-type: application/json
  Body:
    model: {selected_model}
    max_tokens: 1024
    messages: [{ role: "user", content: {composed_prompt} }]

Node 6: Parse Response
  Type: n8n-nodes-base.code
  Logic:
    - Extract JSON from Claude response
    - Parse subject_line and email_body
    - IF parsing fails: retry with explicit "Return valid JSON" instruction

Node 7: Post-Processing
  Type: n8n-nodes-base.code
  Logic:
    - Append email signature from config
    - Verify word count
    - Check for banned phrases
    - UK English validation (basic regex checks)

Node 8: Return Result
  Output: { subject_line, email_body, model_used, tokens_used }
```

### 15.8 SW-AP2: Resend Delivery Tracker (Webhook)

**Purpose:** Receive and process Resend webhook events for delivery tracking.

```
Node 1: Webhook Trigger
  URL: https://n8n.deploy.apiloom.io/webhook/resend-delivery-events
  Method: POST
  Authentication: Webhook signature validation (Svix)

Node 2: Validate Webhook Signature
  Type: n8n-nodes-base.code
  Logic: [Signature validation from Section 7.7]

  --> IF invalid: Return 401, EXIT

Node 3: Extract Event Data
  Type: n8n-nodes-base.code
  Output: { event_type, message_id, timestamp, error_info }

Node 4: Lookup Application
  Type: n8n-nodes-base.postgres
  Query: SELECT id, status FROM applications
         WHERE resend_message_id = {message_id}

  --> IF not found: Log and EXIT

Node 5: Route by Event Type (Switch)

  'email.delivered':
    Update: status = 'delivered', delivered_at = {timestamp}

  'email.bounced':
    a. Update: status = 'method_failed', error_message = {error_info}
    b. Add email to suppression list (if hard bounce)
    c. Notify candidate: "Email to {address} bounced. Please apply manually."
    d. Consider re-routing to portal method

  'email.complained':
    a. Update: status = 'failed', error_message = 'Marked as spam'
    b. Add domain to suppression list
    c. CRITICAL ALERT: Notify candidate and pause all sends to this domain
    d. Log for reputation monitoring

  'email.opened':
    Update: opened_at = {timestamp} (do not change status)

  'email.delivery_delayed':
    Log delay, no status change

Node 6: Log Event
  Type: n8n-nodes-base.postgres
  Insert into application_status_history
```

### 15.9 WF-AP0: Global Error Handler

**Purpose:** Catch and handle errors from any Module 3 workflow.

```
Node 1: Error Trigger
  Type: n8n-nodes-base.errorTrigger
  Scope: All Module 3 workflows

Node 2: Extract Error Details
  Type: n8n-nodes-base.code
  Output: { workflow_name, node_name, error_message, execution_id, timestamp }

Node 3: Log to Database
  Type: n8n-nodes-base.postgres
  Insert into system_errors table (shared with Modules 1 & 2)

Node 4: Classify Severity
  Type: n8n-nodes-base.code
  Logic:
    - Authentication errors (401/403 from APIs) -> CRITICAL
    - Resend complaint events -> CRITICAL
    - Rate limit exceeded -> WARNING
    - Individual application failure -> INFO
    - Database connection error -> CRITICAL

Node 5: Route by Severity
  CRITICAL -> Send Telegram alert + email to candidate
  WARNING -> Email to candidate (batched, not immediate)
  INFO -> Log only

Node 6: Attempt Recovery (conditional)
  Type: n8n-nodes-base.code
  Logic:
    - IF database connection error: wait 30s, retry once
    - IF API rate limit: reschedule for next cycle
    - IF individual send failure: mark application for retry
```

### 15.10 Workflow Summary Table

| Workflow | Nodes (est.) | Trigger | Frequency | Avg Duration | Dependencies |
|----------|-------------|---------|-----------|-------------|-------------|
| WF-AP1 | 12 | Cron | Every 15 min (active hours) | 30-60 seconds | Module 1 (jobs table), Module 2 (tailored materials) |
| WF-AP2 | 14 | Execute Workflow | Per email application | 15-30 seconds | WF-AP4, SW-AP1, Resend API, Claude API |
| WF-AP3 | 11 | Execute Workflow | Per portal application | 10-20 seconds | WF-AP4, Claude API (for supporting statements) |
| WF-AP4 | 7 | Sub-workflow | Per application | 2-5 seconds | Postgres only |
| WF-AP5 | 5 | Webhook | On candidate action | 5-10 seconds | WF-AP2 (for approved sends) |
| WF-AP6 | 12 | Cron | Daily + Weekly + 4-hourly | 10-30 seconds | Resend (for sending reports) |
| SW-AP1 | 8 | Sub-workflow | Per email composition | 5-15 seconds | Claude API |
| SW-AP2 | 6 | Webhook | Per Resend event | 2-5 seconds | Postgres only |
| WF-AP0 | 6 | Error trigger | On error | 5-10 seconds | Telegram/email |

---

## 16. Integration with Modules 1 & 2

### 16.1 Integration with Module 1 (Job Discovery)

Module 3 depends on Module 1 for job data. The integration point is the `jobs` table in the shared `selvi_jobs` database.

**Data Flow: Module 1 -> Module 3**

| Field | Source | Used By Module 3 For |
|-------|--------|---------------------|
| `jobs.id` | Module 1 | Primary key reference in applications table |
| `jobs.title` | Module 1 | Email subject lines, task card headers |
| `jobs.company` | Module 1 | Duplicate detection, email composition |
| `jobs.location` | Module 1 | Task card data |
| `jobs.description` | Module 1 | Application method detection, email composition |
| `jobs.url` | Module 1 | Application URL, portal detection |
| `jobs.tier` | Module 1 (WF5) | Routing decisions (A-tier vs B-tier) |
| `jobs.composite_score` | Module 1 (WF5) | Approval notifications, priority ordering |
| `jobs.job_type` | Module 1 | Academic vs corporate routing |
| `jobs.metadata` | Module 1 | Person spec criteria, recruiter info, application instructions |
| `jobs.salary_min/max` | Module 1 | Task card data, email composition |
| `jobs.contract_type` | Module 1 | Email composition context |
| `jobs.work_type` | Module 1 | Task card data |

**Contract: Module 1 Must Provide**

For Module 3 to function, Module 1 must reliably provide:
1. Accurate `url` field (the actual application link, not just the listing page)
2. Complete `description` field (used for method detection and email composition)
3. Accurate `tier` and `composite_score` (drives routing decisions)
4. `job_type` classification (academic vs corporate)
5. Extraction of application email addresses where visible in the listing (stored in `metadata` or new `application_email` column)

**Enhancement Request for Module 1:**

Module 1's scoring pipeline (WF5) should be enhanced to extract application method indicators during scoring. When Claude analyzes the job description for scoring, it should also extract:

```json
{
  "application_method_hints": {
    "email_addresses_found": ["careers@example.com"],
    "apply_instructions": "Send your CV and cover letter to careers@example.com",
    "portal_mentioned": false,
    "portal_name": null,
    "reference_number": "REF-2024-123",
    "closing_date": "2026-04-15",
    "additional_documents_required": ["supporting statement", "references"]
  }
}
```

This enrichment during scoring eliminates the need for a separate AI call in Module 3's method detection step, saving Claude API costs and reducing latency.

### 16.2 Integration with Module 2 (CV Tailoring)

Module 3 depends on Module 2 for tailored application materials. Module 2 produces a tailored CV and cover letter for each job that the candidate should apply to.

**Data Flow: Module 2 -> Module 3**

| Output from Module 2 | Storage | Used By Module 3 For |
|----------------------|---------|---------------------|
| Tailored CV (PDF) | Filesystem: `/data/generated-cvs/{job_id}_cv.pdf` | Email attachment, task card attachment |
| Tailored CV (DOCX) | Filesystem: `/data/generated-cvs/{job_id}_cv.docx` | Email attachment (agencies), portal upload |
| Cover Letter (PDF) | Filesystem: `/data/generated-cvs/{job_id}_cl.pdf` | Email attachment, task card attachment |
| Cover Letter (text) | Postgres: `cv_tailoring.cover_letter_text` | Portal form paste, email composition context |
| Cover Letter Key Points | Postgres: `cv_tailoring.key_points` (JSON) | Email body generation prompt |
| Tailoring metadata | Postgres: `cv_tailoring.metadata` | Keywords used, sections emphasized |

**Contract: Module 2 Must Provide**

For Module 3 to function, Module 2 must:
1. Generate both PDF and DOCX versions of the tailored CV
2. Generate a PDF cover letter AND store the plain text version
3. Extract key selling points from the cover letter as structured JSON
4. Set `jobs.ready_to_apply = true` and `jobs.ready_to_apply_at = NOW()` when materials are ready
5. Store file paths in `jobs.cv_file_path` and `jobs.cl_file_path`
6. Complete tailoring within 30 minutes of the job being scored (to maintain time-to-apply targets)

**Readiness Signal:**

The integration uses a database flag approach:

```sql
-- Module 2 sets this when tailoring is complete:
UPDATE jobs
SET ready_to_apply = true,
    ready_to_apply_at = NOW(),
    cv_file_path = '/data/generated-cvs/{job_id}_cv.pdf',
    cl_file_path = '/data/generated-cvs/{job_id}_cl.pdf',
    cv_tailored = true
WHERE id = {job_id};
```

Module 3's WF-AP1 queries for `ready_to_apply = true` every 15 minutes.

**Error Scenario: Module 2 Fails**

If Module 2 fails to produce tailored materials for a job:
1. The `ready_to_apply` flag remains `false`
2. Module 3 never picks up the job for application
3. Module 2's error handler should log the failure
4. The daily digest from Module 1 should flag "X jobs scored but not tailored" for visibility
5. The candidate can manually trigger Module 2 re-processing for failed jobs

### 16.3 Integration Diagram

```
MODULE 1: JOB DISCOVERY                MODULE 2: CV TAILORING
|                                       |
| jobs table (shared)                   | cv_tailoring table
| - id                                 | - job_id (FK to jobs)
| - title, company, location           | - cover_letter_text
| - description, url                   | - key_points (JSON)
| - tier, composite_score              | - metadata
| - job_type                           |
| - metadata                           | Filesystem:
| - ready_to_apply (flag)              | - /data/generated-cvs/{job_id}_cv.pdf
| - cv_file_path                       | - /data/generated-cvs/{job_id}_cv.docx
| - cl_file_path                       | - /data/generated-cvs/{job_id}_cl.pdf
|                                       |
+---+-----------------------------------+---+
    |                                       |
    v                                       v
    +---------------------------------------+
    |     MODULE 3: APPLICATION ENGINE      |
    |                                       |
    | Reads from:                           |
    | - jobs table (job data + readiness)   |
    | - cv_tailoring (cover letter text)    |
    | - filesystem (CV + CL files)          |
    |                                       |
    | Writes to:                            |
    | - applications table                  |
    | - application_status_history          |
    | - application_metrics                 |
    | - email_suppressions                  |
    +---------------------------------------+
```

### 16.4 Cross-Module Scheduling

All three modules must be scheduled to avoid resource contention on the CAX31 server:

```
TIME    MODULE 1              MODULE 2              MODULE 3
:00     RSS Poller, Dedup     -                     -
:05     -                     CV Tailoring Queue    -
:15     -                     -                     Application Router
:30     AI Scoring, Email     -                     -
:35     -                     CV Tailoring Queue    -
:45     -                     -                     Application Router

Daily:
07:00   -                     -                     Daily Status Summary
07:30   Morning Digest        -                     -
20:00   -                     -                     Weekly Report (Sundays)
```

Module 2's CV Tailoring Queue runs at :05 and :35 to process newly scored jobs. Module 3's Application Router at :15 and :45 picks up jobs where tailoring just completed. This creates a 10-minute gap between Module 2 completion and Module 3 pickup, which is acceptable.

---

## 17. Error Handling & Monitoring

### 17.1 Error Categories

| Category | Examples | Severity | Response |
|----------|---------|----------|----------|
| **API Authentication** | Claude API key expired, Resend API key invalid | Critical | Halt all processing, alert immediately |
| **API Rate Limit** | Claude rate limit, Resend rate limit | Warning | Back off and retry, log for configuration tuning |
| **Email Delivery** | Hard bounce, soft bounce, complaint | Medium-High | Suppress address, re-route application, alert if complaint |
| **Database** | Connection timeout, query failure | Critical | Retry once, halt if persistent, alert |
| **Data Quality** | Missing CV file, invalid email format, empty description | Medium | Skip application, log, include in daily report |
| **Method Detection** | Unable to determine application method | Low | Flag for manual classification |
| **Content Generation** | Claude returns invalid JSON, banned phrase detected | Medium | Regenerate (max 2 retries), flag if persistent |
| **Webhook** | Invalid signature, duplicate event, unknown event type | Low | Log and discard |
| **Workflow** | Node execution error, timeout | Medium | Retry workflow, alert if 3+ consecutive failures |

### 17.2 Error Recovery Strategies

**Retry Logic:**

| Scenario | Max Retries | Backoff | Recovery |
|----------|------------|---------|----------|
| Resend API call fails | 3 | Exponential (5s, 15s, 45s) | If all retries fail, mark as failed |
| Claude API call fails | 2 | Linear (10s, 20s) | If fails, use fallback model or skip |
| Postgres query fails | 2 | Linear (5s, 10s) | If fails, halt workflow |
| Webhook signature invalid | 0 | N/A | Reject immediately |
| Email bounce | 1 | N/A | Suppress address, try alternative method |

**Circuit Breaker (Postgres-backed):**

If 5 consecutive API calls to the same service fail within 15 minutes, halt all calls to that service for 30 minutes. Circuit breaker state is stored in Postgres so it persists across n8n restarts and is shared across all workflows.

```sql
-- Circuit breaker state table (shared across all workflows)
CREATE TABLE circuit_breaker_state (
    service_name TEXT PRIMARY KEY, -- 'resend', 'claude', 'postgres'
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    open_until TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO circuit_breaker_state (service_name) VALUES
    ('resend'), ('claude');
```

```javascript
// Circuit breaker check (run before any external API call)
// All workflows use the same shared state via Postgres

async function checkCircuitBreaker(serviceName) {
  const result = await $getWorkflowStaticData(); // not used for state
  // Query Postgres for circuit breaker state
  const cb = await queryPostgres(
    `SELECT * FROM circuit_breaker_state WHERE service_name = $1`,
    [serviceName]
  );

  if (cb.open_until && new Date(cb.open_until) > new Date()) {
    throw new Error(`Circuit breaker open for ${serviceName} until ${cb.open_until}`);
  }
  return true;
}

async function recordFailure(serviceName) {
  await queryPostgres(`
    UPDATE circuit_breaker_state
    SET failure_count = failure_count + 1,
        last_failure_at = NOW(),
        open_until = CASE
          WHEN failure_count >= 4
            AND last_failure_at > NOW() - INTERVAL '15 minutes'
          THEN NOW() + INTERVAL '30 minutes'
          ELSE open_until
        END,
        updated_at = NOW()
    WHERE service_name = $1
  `, [serviceName]);
}

async function recordSuccess(serviceName) {
  await queryPostgres(`
    UPDATE circuit_breaker_state
    SET failure_count = 0, last_success_at = NOW(),
        open_until = NULL, updated_at = NOW()
    WHERE service_name = $1
  `, [serviceName]);
}
```

**Startup Recovery:** WF-AP0's startup check (see Section 17.6) resets circuit breakers that have been open for more than 2 hours, as the underlying service has likely recovered.

### 17.3 Monitoring Dashboard Data

The system exposes metrics through the `application_metrics` table and database views. A future dashboard (Grafana or custom) can query these. For MVP, the daily and weekly email reports serve as the monitoring interface.

**Key Metrics to Monitor:**

| Metric | Query | Alert Threshold |
|--------|-------|-----------------|
| Application success rate | submitted / (submitted + failed) | < 90% |
| Email delivery rate | delivered / submitted | < 95% |
| Email bounce rate | bounced / submitted | > 5% |
| Approval queue depth | COUNT WHERE status = 'pending_approval' | > 5 (candidate may be away) |
| Manual task queue depth | COUNT WHERE status = 'pending_manual' | > 10 (candidate overwhelmed) |
| Method detection accuracy | Manual audit weekly | < 90% |
| Average time-to-apply (email) | AVG(submitted_at - ready_to_apply_at) | > 2 hours |
| Claude API errors (hourly) | COUNT errors from Claude calls | > 3 in 1 hour |
| Resend API errors (hourly) | COUNT errors from Resend calls | > 2 in 1 hour |

### 17.4 Alerting Rules

| Alert | Channel | Condition |
|-------|---------|-----------|
| API authentication failure | Telegram + Email | Any 401/403 from Claude or Resend |
| Email complaint (spam report) | Telegram + Email | Any `email.complained` webhook event |
| Circuit breaker tripped | Telegram | Any service circuit breaker opens |
| Sending domain blacklisted | Telegram + Email | Resend reports domain reputation issue |
| No applications sent in 24h | Email (daily report) | zero submissions on a weekday |
| Approval queue stale | Email | Any approval pending > 24 hours |
| 5+ consecutive workflow failures | Telegram | Error count threshold |

### 17.5 Log Retention

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Application records | Indefinite (anonymize after 12 months) | Postgres |
| Status history | Indefinite | Postgres |
| Email content (body, subject) | 6 months | Postgres |
| Workflow execution logs | 30 days | n8n built-in (increase from default 7 days via `EXECUTIONS_DATA_MAX_AGE=720`) |
| Error logs | 90 days | Postgres (increased from 30 days to support breach investigation timelines) |
| Daily metrics | Indefinite | Postgres |
| Resend webhook events | 30 days | Postgres (via status history) |

### 17.6 Health Check & Self-Healing

**Docker Health Check:**

The n8n container must include a health check that verifies the instance is running and responsive:

```yaml
# docker-compose.yml (Module 3 addition)
services:
  n8n:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5678/healthz"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
```

**External Uptime Monitor:**

An external service (Healthchecks.io, free tier) monitors a heartbeat workflow:

```
WF-HEARTBEAT: System Heartbeat
  Trigger: Cron, every 5 minutes
  Node 1: Ping Healthchecks.io endpoint
    Type: n8n-nodes-base.httpRequest
    URL: https://hc-ping.com/{healthcheck_uuid}
    Method: GET

  Node 2: Basic self-test
    Type: n8n-nodes-base.postgres
    Query: SELECT 1 FROM applications LIMIT 1
    --> IF fails: log error, do NOT ping Healthchecks.io (triggers alert)
```

If the heartbeat stops, Healthchecks.io sends an alert email and optional Telegram notification after 10 minutes of silence.

**Daily Digest System Health Section:**

The daily digest (Section 11.4) includes a "System Health" section:

```
SYSTEM HEALTH:
- n8n uptime: {uptime_hours}h since last restart
- Last Application Router run: {last_wf_ap1_at} ({minutes_ago} min ago)
- Circuit breakers: {open_count} open, {closed_count} closed
- Pending queue: {queue_depth} applications
- Resend API: {resend_status} (last call: {last_resend_at})
- Claude API: {claude_status} (last call: {last_claude_at})
```

**Startup Recovery (WF-AP0 Enhancement):**

On n8n container start (detected by WF-AP0 or a dedicated startup workflow):

1. Reset circuit breakers that have been open > 2 hours
2. Check for orphaned applications (status stuck in processing states)
3. **Duplicate-safe re-queuing:** For applications stuck in 'sending' status:
   - Query Resend API for the application's idempotency key to check if the email was actually delivered
   - If delivered: update status to 'submitted' (the webhook event was missed during downtime)
   - If not delivered: re-queue for sending (Resend idempotency key prevents duplicate delivery)
   - If Resend API is unreachable: mark as 'needs_review' rather than re-sending blindly
4. Log the restart event with timestamp and reason (if available)
5. Send a startup notification if downtime exceeded 15 minutes

---

## 18. Privacy & Data Protection

### 18.1 Data Classification

| Data Type | Classification | Storage | Access |
|-----------|---------------|---------|--------|
| Candidate personal details (name, email, phone, address) | Personal Data (UK GDPR) | Postgres (application_config) | System only |
| Candidate CV content | Personal Data | Filesystem + Postgres | System only |
| Referee details | Third-Party Personal Data | Postgres (application_config) | System + shared with employers via applications |
| Email bodies (sent applications) | Personal Data + Business Communication | Postgres | System only |
| Job descriptions | Non-personal | Postgres (jobs table) | System only |
| Application status/metadata | Non-personal | Postgres | System only |

### 18.2 Data Protection Measures

**At Rest:**
- All data stored on the Hetzner CAX31 server (EU-based, GDPR-compliant hosting)
- Postgres database with authentication required
- File system permissions restrict access to n8n process user
- No data stored in third-party cloud services (except email transit via Resend)

**In Transit:**
- All API calls use HTTPS/TLS
- Resend API calls encrypted in transit
- Claude API calls encrypted in transit
- n8n webhooks served over HTTPS (via Dokploy reverse proxy)

**Data Minimization:**
- Only data necessary for applications is stored
- Email bodies are retained for 6 months, then deleted
- Sensitive fields (NI number, date of birth) are entered by the candidate at point of use, not pre-stored
- Equal opportunities monitoring responses are stored only if the candidate chooses to pre-fill them

### 18.3 Data Subject Rights (DSAR)

Since the candidate is both the data controller and data subject:

| Right | Implementation |
|-------|---------------|
| **Right to Access (SAR)** | Export all application records and personal data as JSON/CSV |
| **Right to Erasure** | Delete all application records, CV files, email content, and personal configuration |
| **Right to Rectification** | Update candidate_profile in application_config |
| **Right to Portability** | Export in machine-readable format (JSON) |

**Data Export Function:**

```sql
-- Export all candidate data
SELECT json_build_object(
    'candidate_profile', (SELECT config_value FROM application_config WHERE config_key = 'candidate_profile'),
    'referees', (SELECT config_value FROM application_config WHERE config_key = 'referees'),
    'applications', (SELECT json_agg(a.*) FROM applications a),
    'status_history', (SELECT json_agg(h.*) FROM application_status_history h),
    'suppressions', (SELECT json_agg(s.*) FROM email_suppressions s),
    'documents', (SELECT json_agg(d.*) FROM document_library d)
) AS full_export;
```

**Data Deletion Function:**

Deletion uses a two-phase approach: soft-delete first, then permanent purge after 30 days.

```sql
-- Phase 1: Soft-delete (mark records, retain for 30 days)
-- All operations wrapped in a single transaction
BEGIN;

-- Mark applications as soft-deleted
UPDATE applications
SET status = 'deleted',
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{deleted_at}',
                         to_jsonb(NOW()::text))
WHERE status != 'deleted';

-- Mark for purge after 30 days
INSERT INTO application_config (config_key, config_value, description)
VALUES ('deletion_scheduled', jsonb_build_object(
    'soft_deleted_at', NOW(),
    'purge_after', NOW() + INTERVAL '30 days',
    'initiated_by', 'candidate'
), 'Scheduled data deletion')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

COMMIT;

-- Phase 2: Permanent purge (run after 30-day retention, via scheduled workflow)
BEGIN;

DELETE FROM application_status_history
WHERE application_id IN (SELECT id FROM applications WHERE status = 'deleted');

DELETE FROM application_metrics;
DELETE FROM email_suppressions;
DELETE FROM known_contacts;
DELETE FROM applications WHERE status = 'deleted';
DELETE FROM document_library;
DELETE FROM circuit_breaker_state;
DELETE FROM application_config
WHERE config_key IN ('candidate_profile', 'referees', 'email_config', 'deletion_scheduled');

COMMIT;

-- Filesystem cleanup script: scripts/purge_application_files.sh
-- This script is called after Phase 2 SQL purge completes.
```

**Filesystem cleanup script (`scripts/purge_application_files.sh`):**

```bash
#!/bin/bash
# Purge application files for soft-deleted records
# Called after Phase 2 SQL purge or via monthly cron
set -euo pipefail

ALLOWED_DIRS=("/data/applications" "/data/generated-cvs")
LOG_FILE="/var/log/selvi-file-purge.log"
DRY_RUN="${1:-false}"  # Pass "true" for dry run

log() { echo "$(date -Iseconds) $1" >> "$LOG_FILE"; }

# Get list of deleted application IDs from database
DELETED_IDS=$(docker exec selvi-postgres psql -U selvi_user -d selvi_jobs -t -A \
  -c "SELECT id FROM applications WHERE status = 'deleted'")

for APP_ID in $DELETED_IDS; do
  for BASE_DIR in "${ALLOWED_DIRS[@]}"; do
    TARGET_DIR="${BASE_DIR}/${APP_ID}"
    # Path validation: resolve symlinks and verify within allowed directory
    REAL_PATH=$(realpath -m "$TARGET_DIR" 2>/dev/null || echo "INVALID")
    if [[ "$REAL_PATH" != "$BASE_DIR"* ]]; then
      log "SECURITY: Path traversal attempt blocked: $TARGET_DIR -> $REAL_PATH"
      continue
    fi
    if [ -d "$TARGET_DIR" ]; then
      if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would delete $TARGET_DIR"
      else
        rm -rf "$TARGET_DIR"
        log "DELETED: $TARGET_DIR"
      fi
    fi
  done
done

log "Purge complete. Processed ${#DELETED_IDS[@]} application IDs."
```

**Note:** Resend retains sent email records according to their own retention policy. Full deletion requires contacting Resend separately to request deletion of email delivery data. Document this in the candidate's deletion confirmation.

### 18.4 Third-Party Data Sharing

| Third Party | Data Shared | Purpose | Legal Basis |
|------------|-------------|---------|-------------|
| Resend (email service) | Full email message: headers, body text (containing candidate name, qualifications, phone), subject line, all attachments (CV and cover letter PDFs/DOCX), From/To/Reply-To addresses | Email delivery | Contract (data processor) |
| Anthropic (Claude API) | Candidate name, current title, key qualifications, years of experience, location, email address, phone number, job descriptions | Email composition, supporting statement generation | Contract (data processor) |
| Employers/Agencies (email recipients) | CV, cover letter, application email | Job application | Legitimate interest (applying for jobs) |

**Resend Data Processing:**
- Resend is a data processor that processes the **full email message** including body text, subject line, and all attachments (CVs, cover letters). Attachments are part of the MIME message transmitted through Resend's infrastructure for delivery.
- Resend's data processing agreement (DPA) must be reviewed and executed before deployment.
- Resend's privacy policy governs retention of email content, delivery metadata, and tracking data.
- A Transfer Impact Assessment (TIA) is required as Resend is a US-based company (see Section 18.7).

**Claude API Data:**
- Anthropic's commercial API terms state prompts and responses are not retained for model training.
- However, candidate PII is sent to Claude in every email composition prompt: name, email, phone number, title, qualifications, and employer history. These constitute personal data under UK GDPR even if they are not "special category" data.
- **PII minimisation implementation:** The email composition prompt uses a placeholder `CANDIDATE_NAME` instead of the real name, and omits email, phone, and address. Post-processing replaces `CANDIDATE_NAME` with the real name and injects contact details into the email signature block. This reduces the PII sent to Claude to: current job title, qualifications, years of experience, and sanitised experience summaries. The PII stripping is performed in SW-AP1 (Email Composer sub-workflow) node 2 before the Claude API call, and re-injection happens in node 5 after the response.
- A Transfer Impact Assessment (TIA) is required as Anthropic is a US-based company (see Section 18.8).

### 18.5 Controller-Processor Relationships and DPAs

The candidate (Selvi) is the data controller. The following data processors must have executed Data Processing Agreements (DPAs) before the system goes live:

| Processor | Data Processed | DPA Status | DPA Location |
|-----------|---------------|------------|-------------|
| Resend (US) | Full email MIME messages including body, subject, attachments (CVs, cover letters), headers | Required before launch | Must be signed via Resend's self-service DPA at https://resend.com/legal/dpa |
| Anthropic (US) | Candidate name, title, qualifications, experience, email composition prompts | Required before launch | Must be signed via Anthropic's commercial DPA process |
| Hetzner (DE) | All system data at rest (database, files, logs) | Required before launch | Available via Hetzner's DPA portal |

**DPA requirements for each processor:**
- Scope of processing and data categories
- Sub-processor disclosure and approval mechanism
- Data breach notification obligations (72 hours)
- Data deletion on contract termination
- Audit rights
- International transfer mechanisms (SCCs for US-based processors)

**Pre-launch checklist:**
1. Download, review, and execute DPA with Resend
2. Download, review, and execute DPA with Anthropic
3. Verify Hetzner DPA covers the processing scope
4. Store executed DPAs in `/docs/compliance/dpas/`
5. Set calendar reminder for annual DPA review

### 18.6 Data Protection Impact Assessment (DPIA)

A DPIA is required under UK GDPR Article 35 because the system involves automated processing of personal data that produces legal or similarly significant effects (automated job applications on the candidate's behalf).

**DPIA Summary:**

| Element | Assessment |
|---------|-----------|
| **Processing purpose** | Automated composition and submission of job applications using AI-generated content based on candidate's personal profile |
| **Data subjects** | Primary: candidate (Selvi). Secondary: referees (names, titles, contact details shared with employers) |
| **Legal basis** | Legitimate interest (candidate's own interest in efficient job applications) |
| **Necessity and proportionality** | Proportionate: candidate manually reviews A-tier applications; B-tier auto-send covers only pre-approved categories. Candidate can pause/cancel at any time. |
| **Risks identified** | 1. AI hallucination in application content (mitigated: factual verification in QA). 2. Unintended application to fraudulent postings (mitigated: scam detection checks). 3. Duplicate applications causing reputation damage (mitigated: dedup algorithm). 4. PII exposure to Claude API (mitigated: PII minimisation). 5. Referee data shared without adequate notice (mitigated: consent tracking). |
| **Risk level** | Medium -- single data subject who is also the controller, reducing most consent and rights risks |
| **Safeguards** | Quality gates, human approval for A-tier, scam detection, rate limiting, pause/cancel controls, factual verification, audit logging |
| **DPO consultation** | Not applicable (single-user system, no DPO required) |
| **Review schedule** | Every 6 months or when significant changes to processing are made |

**DPIA document location:** `/docs/compliance/dpia-module-3.md` (to be created during Phase 1 of rollout)

### 18.7 Article 22 -- Automated Decision-Making Analysis

UK GDPR Article 22 restricts solely automated decision-making that produces legal or similarly significant effects. Module 3's B-tier auto-send constitutes automated decision-making about which job applications to submit on the candidate's behalf.

**Analysis:**

| Question | Answer |
|----------|--------|
| Is the decision solely automated? | B-tier: Yes (auto-send with no human review). A-tier: No (human approval required). |
| Does it produce legal or similarly significant effects? | Arguable: submitting a job application affects employment prospects, which UK case law has recognised as "significant". However, the data subject is also the controller. |
| Does Article 22(2) exception apply? | Yes -- Article 22(2)(c): the decision is based on the data subject's explicit consent. The candidate has configured the system to auto-send B-tier applications. |
| Are safeguards in place per Article 22(3)? | Yes: (1) candidate can pause/cancel auto-send at any time via multi-channel PAUSE; (2) candidate can review all auto-sent applications via daily digest; (3) candidate can contest any auto-send by withdrawing the application; (4) B-tier quality sampling provides ongoing oversight. |

**Required actions:**
1. Add explicit consent capture at system setup: "I consent to automated sending of B-tier job applications on my behalf. I understand I can pause or cancel auto-send at any time."
2. Store consent timestamp and method in `application_config`
3. Provide mechanism to withdraw consent (pausing auto-send revokes consent)
4. Document right to obtain human review of any auto-send decision

### 18.8 Transfer Impact Assessment (TIA)

Both Resend and Anthropic are US-based companies. Transferring personal data from the UK to the US requires a Transfer Impact Assessment under UK GDPR.

**TIA for Resend (email delivery):**

| Factor | Assessment |
|--------|-----------|
| Data transferred | Full email content including candidate name, qualifications, phone, CV/cover letter attachments |
| Transfer mechanism | Standard Contractual Clauses (SCCs) via Resend DPA |
| US legal framework | EU-US Data Privacy Framework (if Resend is certified) or SCCs |
| Risk of government access | Low -- application emails are routine job applications, not high-value intelligence targets. Volume is <15 emails/day. |
| Supplementary measures | TLS encryption in transit, Resend SOC 2 compliance, data retention limited to delivery tracking |
| Conclusion | Transfer is permissible under SCCs with supplementary encryption measures |

**TIA for Anthropic (AI processing):**

| Factor | Assessment |
|--------|-----------|
| Data transferred | Candidate name, title, qualifications, experience summaries (PII-minimised where possible) |
| Transfer mechanism | Standard Contractual Clauses (SCCs) via Anthropic DPA |
| US legal framework | EU-US Data Privacy Framework (if Anthropic is certified) or SCCs |
| Risk of government access | Low -- API data is transient (30-day retention for trust/safety), not bulk surveillance target |
| Supplementary measures | API data not used for training, 30-day retention limit, PII minimisation in prompts |
| Conclusion | Transfer is permissible under SCCs with PII minimisation as supplementary measure |

**TIA document location:** `/docs/compliance/tia-module-3.md` (to be created during Phase 1 of rollout)

### 18.9 Incident Response Plan

In the event of a data breach or security incident:

**Incident categories:**

| Category | Example | Severity |
|----------|---------|----------|
| Credential compromise | API key leaked, webhook token exposed | Critical |
| Unauthorized access | Server SSH breach, database access | Critical |
| Data leakage | Application emails sent to wrong recipients, CV attached to wrong job | High |
| Service compromise | Resend account hijacked, sending domain spoofed | High |
| System malfunction | Duplicate sends, applications sent outside parameters | Medium |

**Response procedure:**

| Step | Action | Timeframe |
|------|--------|-----------|
| 1 | **Contain:** Execute emergency PAUSE (all channels). Revoke compromised credentials (Resend API key, Claude API key, webhook tokens). | Immediate (within 1 hour) |
| 2 | **Assess:** Determine scope -- which applications were affected, what data was exposed, which third parties were impacted. Query application_status_history for timeline. | Within 4 hours |
| 3 | **Preserve evidence:** Export relevant logs before rotation. Capture application_status_history, cv_generation_log, and n8n execution logs. | Within 4 hours |
| 4 | **Notify affected parties:** If referee data was exposed, notify referees. If applications were sent to fraudulent recipients, attempt withdrawal. | Within 48 hours |
| 5 | **Report to ICO:** If personal data of third parties (referees, employers) was compromised and poses risk to their rights/freedoms, report within 72 hours. | Within 72 hours |
| 6 | **Remediate:** Rotate all credentials, patch vulnerability, review and update security controls. | Within 24 hours of containment |
| 7 | **Post-incident review:** Document root cause, timeline, impact, and preventive measures. Update risk register. | Within 7 days |

**Emergency PAUSE implementation:** The multi-channel PAUSE mechanism (webhook, email reply, Telegram) already exists. In a breach scenario, the candidate triggers PAUSE immediately, which halts all auto-sends. Additionally, the system should support a "hard halt" via environment variable (`EMERGENCY_HALT=true`) that prevents any email sending even if PAUSE state is corrupted.

**ICO contact:** Helpline 0303 123 1113. Online: https://ico.org.uk/make-a-complaint/

### 18.10 Granular Consent Management

The system requires explicit, granular consent for each processing activity. Consent records are stored in `application_config` with timestamps and can be individually revoked.

| Consent Item | Required Before | Revocation Effect |
|-------------|----------------|-------------------|
| B-tier auto-send | First B-tier auto-send | All B-tier applications held for approval |
| PII transfer to Claude API | System activation | Email composition disabled; manual-only mode |
| PII transfer to Resend | System activation | Email sending disabled; portal task cards only |
| Referee data sharing | First academic application | Referee section omitted from academic CVs |
| Email tracking (open/click) | System activation | Resend tracking pixels disabled |

**Consent capture implementation:**

At first system setup, the candidate is presented with a consent form (served via n8n webhook) listing each processing activity with toggles. Consent records are stored as:

```sql
INSERT INTO application_config (config_key, config_value)
VALUES ('consent_records', '{
  "b_tier_auto_send": {"consented": true, "timestamp": "2026-03-29T10:00:00Z", "method": "web_form"},
  "pii_transfer_claude": {"consented": true, "timestamp": "2026-03-29T10:00:00Z", "method": "web_form"},
  "pii_transfer_resend": {"consented": true, "timestamp": "2026-03-29T10:00:00Z", "method": "web_form"},
  "referee_data_sharing": {"consented": true, "timestamp": "2026-03-29T10:00:00Z", "method": "web_form"},
  "email_tracking": {"consented": true, "timestamp": "2026-03-29T10:00:00Z", "method": "web_form"}
}'::jsonb);
```

Each workflow checks the relevant consent before processing. Revoking consent takes effect immediately.

### 18.11 Referee Consent

The system includes referee contact details in application task cards. Before first use:

1. The candidate must confirm that each referee has consented to being named as a reference
2. The system reminds the candidate before each academic application (where referees are contacted pre-interview) to notify their referees
3. Referee details can be updated or removed at any time via the application_config table

---

## 19. Rollout Plan

### 19.1 Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Module 1: Job Discovery System | Complete | Job data, scoring, tier classification |
| Module 2: CV Tailoring System | In Progress | Tailored CVs and cover letters |
| Resend API Account | Not Started | Email delivery |
| Custom domain for Resend | Not Started | Professional sender identity |
| Postgres schema extension | Not Started | Application tracking |
| n8n community nodes (n8n-nodes-resend) | Not Started | Email sending |

### 19.2 Implementation Phases

**Phase 1: Foundation (Week 1-2)**

Goals: Database schema, basic infrastructure, email sending capability.

Tasks:
- [ ] Create database schema (Section 14.1) -- applications table, config table, history table
- [ ] Insert default configuration values
- [ ] Set up Resend account and verify custom domain
- [ ] Install n8n-nodes-resend community node
- [ ] Create volume mount for application data
- [ ] Implement WF-AP0 (Global Error Handler)
- [ ] Create helper functions (normalize_company, dedup hash)
- [ ] Test Resend email delivery with manual trigger

Verification:
- Can send a test email with PDF attachment via n8n + Resend
- Database schema created and accessible
- Error handler captures and alerts on failures

**Phase 2: Method Detection & Routing (Week 2-3)**

Goals: Detect application methods and route correctly.

Tasks:
- [ ] Implement WF-AP1 (Application Router) -- core routing logic
- [ ] Build URL pattern matching dictionary (Section 6.3)
- [ ] Implement email address extraction and validation (Section 6.4)
- [ ] Add Claude-based method detection for low-confidence cases
- [ ] Create application records in database
- [ ] Test with 50+ real job URLs from Module 1 data
- [ ] Tune confidence thresholds based on test results

Verification:
- Method detection accuracy > 85% on test set
- Correct routing for email, major portal types, and LinkedIn
- Application records created correctly in database

**Phase 3: Email Application Engine (Week 3-4)**

Goals: Fully automated email application submission for B-tier jobs.

Tasks:
- [ ] Implement SW-AP1 (Email Composer) with Claude integration
- [ ] Build WF-AP2 (Email Application Engine) -- full pipeline
- [ ] Implement WF-AP4 (Quality Gate) -- dedup, rate limiting, validation
- [ ] Configure email templates and banned phrase list
- [ ] Set up Resend webhooks and implement SW-AP2 (Delivery Tracker)
- [ ] Test email composition quality with 20+ real job descriptions
- [ ] Send 10 test applications (to a test inbox, not real employers)
- [ ] Tune email composition prompts based on quality review

Verification:
- Email composition passes quality review (no AI-detectable patterns, UK English, appropriate length)
- Emails delivered to test inbox with correct attachments
- Resend webhooks correctly update application status
- Duplicate detection catches obvious duplicates
- Rate limiting prevents over-sending

**Phase 4: A-Tier Approval Flow (Week 4-5)**

Goals: Human-in-the-loop for high-value applications.

Tasks:
- [ ] Implement WF-AP5 (Approval Handler) -- webhook endpoint
- [ ] Build approval notification email template
- [ ] Implement secure token generation and validation
- [ ] Build approval reminder system
- [ ] Build auto-expiry for unactioned approvals
- [ ] Test full approval flow end-to-end
- [ ] Add "edit before sending" capability (optional, post-MVP)

Verification:
- Approval notification delivered with correct preview
- Approve link triggers immediate email send
- Reject link archives the application
- Reminders sent at correct intervals
- Token expiry works correctly

**Phase 5: Portal Preparation Engine (Week 5-6)**

Goals: Task card generation for manual portal applications.

Tasks:
- [ ] Implement WF-AP3 (Portal Preparation Engine)
- [ ] Build task card templates for each major portal type
- [ ] Implement date format conversion per portal
- [ ] Build candidate profile data formatting
- [ ] Implement supporting statement generation for academic roles
- [ ] Test task card quality with real portal applications
- [ ] Tune portal-specific instructions based on actual portal experiences

Verification:
- Task cards contain all data needed for portal completion
- Date formats correct for each portal type
- Supporting statements generated for academic roles
- Task cards delivered via email with all attachments
- Candidate can complete a portal application in < 5 minutes using only the task card

**Phase 6: Reporting & Monitoring (Week 6-7)**

Goals: Daily and weekly reporting, metrics tracking.

Tasks:
- [ ] Implement WF-AP6 (Status Tracker & Reporter)
- [ ] Build daily summary email template
- [ ] Build weekly report email template
- [ ] Create application_metrics computation
- [ ] Create database views (Section 14.4)
- [ ] Set up monitoring alerts (Section 17.4)
- [ ] Implement response tracking (manual status updates)

Verification:
- Daily summary accurate and delivered at 7:00 AM
- Weekly report accurate and delivered Sunday 8:00 PM
- Metrics computation produces correct aggregations
- Alerts fire for test error conditions

**Phase 7: Live Launch & Tuning (Week 7-8)**

Goals: Full system operational with real applications.

Tasks:
- [ ] Deploy all workflows to production n8n
- [ ] Domain warming: send 5 emails/day, increase by 5/day for 2 weeks
- [ ] Start with B-tier email applications only (auto-send)
- [ ] Monitor first 20 applications closely for quality
- [ ] Enable A-tier approval flow after B-tier confidence established
- [ ] Enable portal task card generation
- [ ] Full system operational by end of week 8

Verification:
- First 20 B-tier applications sent successfully
- Email delivery rate > 95%
- No spam complaints
- Candidate confirms email quality acceptable
- A-tier approval flow works in production
- Portal task cards usable for real applications

### 19.3 Risk Mitigation During Rollout

| Risk | Mitigation |
|------|-----------|
| Email quality insufficient | Phase 3 includes extensive quality testing before any real sends |
| Sending domain blacklisted | Domain warming in Phase 7, start slow |
| Resend free tier limit reached | Monitor usage, upgrade to paid ($20/month) if needed |
| Method detection errors | Phase 2 tests with 50+ real URLs before going live |
| Claude API costs higher than expected | Monitor token usage, tune prompts for efficiency |
| Module 2 not ready | Module 3 Phases 1-4 can proceed independently; Phase 5+ needs Module 2 |

### 19.4 Post-Launch Improvements (Future)

These are explicitly out of scope for v1.0 but noted for future consideration:

1. **Web dashboard** for application tracking (replace email-based status updates)
2. **Email thread tracking** -- parse employer reply emails to auto-detect interview invites and rejections
3. **Follow-up automation** -- send polite follow-up emails for applications with no response after 10-14 days
4. **Calendar integration** -- when an interview invite is detected, propose calendar slots
5. **Application analytics** -- ML-based analysis of which email compositions and application methods produce highest callback rates
6. **Speculative application campaigns** -- systematic outreach to target companies identified through Module 1's market intelligence
7. **Recruiter relationship management** -- track recruiter contacts, conversation history, and preferences
8. **Multi-candidate support** -- generalize the system for multiple job seekers (if productizing)
9. **Mobile notifications** -- push notifications for A-tier approvals (faster approval turnaround)
10. **Template A/B testing** -- test different email composition styles for callback rate optimization

### 19.5 Resource Estimates

| Resource | Monthly Cost (GBP) | Notes |
|----------|-------------------|-------|
| Resend (free tier) | 0 | 100 emails/day, 3000/month |
| Resend (if upgraded) | 15 | 50,000 emails/month |
| Claude API (Haiku) | 5-10 | ~200 email compositions/month at Haiku pricing |
| Claude API (Sonnet) | 10-20 | ~50 A-tier compositions + supporting statements |
| Infrastructure | 0 | Shared with Modules 1 & 2 on existing CAX31 |
| Custom domain | 0-5 | If using existing domain, free; new domain ~5/year |
| **Total estimated** | **15-35** | Well within budget constraints |

### 19.6 Success Criteria for Launch

Module 3 is considered successfully launched when:

1. At least 10 B-tier email applications have been auto-sent with > 95% delivery rate
2. At least 3 A-tier applications have gone through the full approval flow
3. At least 5 portal task cards have been used for manual applications with candidate confirming < 5 minute completion time
4. Duplicate detection has caught at least 1 real duplicate (or has been tested with synthetic duplicates)
5. Daily and weekly reports are being generated and delivered accurately
6. No spam complaints received
7. Callback rate on automated applications is >= 80% (compared to 90% manual baseline)
8. Candidate confirms time savings of at least 5 hours/week

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| A-tier | Job with composite score >= 75. Strong match requiring human approval for email applications. |
| ATS | Applicant Tracking System -- software used by employers to manage job applications (Workday, Taleo, etc.) |
| B-tier | Job with composite score 55-74. Good match eligible for automated email submission. |
| Callback rate | Percentage of applications that result in an interview invitation. |
| Cover letter key points | Structured JSON from Module 2 summarizing the top 3-5 selling points of the tailored cover letter. |
| Dedup hash | MD5 hash of normalized company + title + location used for duplicate detection. |
| Domain warming | Gradually increasing email volume on a new sending domain to build sender reputation. |
| Easy Apply | LinkedIn's one-click application feature that pre-fills candidate data from their profile. |
| Module 1 | Job Discovery System -- discovers, scores, and deduplicates job listings. |
| Module 2 | CV Tailoring System -- generates tailored CVs and cover letters per job. |
| Module 3 | Automated Job Application System (this module). |
| Person specification | UK term for the detailed requirements document that accompanies academic and public sector job postings. |
| Portal | Web-based application form hosted by an employer or ATS platform. |
| Resend | Email sending API service used for application email delivery. |
| Stonefish | UK-specific ATS used primarily by universities. |
| Supporting statement | Extended document (500-1500 words) required by UK academic and public sector employers, addressing each criterion in the person specification. |
| Task card | Structured document generated by Module 3 containing all data and instructions needed for a manual portal application. |
| Tier | Quality classification of a job based on Module 1's AI scoring (A+, A, B, C, D). |

---

## Appendix B: Email Composition Examples

### B.1 Direct Application Email (Corporate L&D)

```
Subject: Application: Head of Learning & Development - Selvi Kumar

Dear Helen,

I saw the Head of L&D role at Barclays and wanted to apply. My background
in designing enterprise learning programmes for financial services organisations
aligns closely with what you have described.

Over the past 18 years, I have built and led L&D functions across multiple
sectors, most recently designing leadership development programmes for a
FTSE 250 firm that reduced time-to-competency by 35%. My PhD research
focused on organisational learning transfer -- the gap between training
delivery and workplace behaviour change -- which directly addresses the
"measurable impact" emphasis in your posting.

I hold CIPD Level 7, have managed teams of up to 15, and have worked with
budgets exceeding GBP 2M annually. I am based in Maidenhead and available
for a call at your convenience.

Please find my CV and cover letter attached.

Best regards,
Selvi Kumar
PhD, MBA
+44 xxxx xxxxxx
```

### B.2 Agency Response Email

```
Subject: Re: Learning & Development Manager (Ref: HY-89234) - Selvi Kumar

Hi Sarah,

Thank you for posting the L&D Manager role in Reading. I have 18 years in
L&D across corporate, consulting, and academic settings, and the role
matches what I am looking for.

My CV is attached. I am available for a screening call this week --
mornings work best.

Best regards,
Selvi Kumar
+44 xxxx xxxxxx
```

### B.3 Academic Application Email

```
Subject: Application: Senior Lecturer in Human Resource Management - Selvi Kumar

Dear Professor Osman,

I am applying for the Senior Lecturer in HRM position at the University
of Reading Business School.

My research in organisational learning transfer, combined with 18 years
of industry experience in L&D leadership, positions me to bridge theory
and practice in HRM teaching. I have taught postgraduate modules in HRD,
organisational behaviour, and research methods, and my PhD examined
learning transfer mechanisms in corporate environments.

I have published in peer-reviewed journals including Human Resource
Development Quarterly and Journal of Workplace Learning, and have
presented at UFHRD and AHRD conferences.

Please find my CV and cover letter attached. I would welcome the
opportunity to discuss how my profile fits the department's needs.

Best regards,
Selvi Kumar
PhD, MBA, CIPD Level 7
+44 xxxx xxxxxx
```

---

## Appendix C: Configuration Reference

### C.1 Environment Variables

```bash
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
RESEND_FROM_DOMAIN=applications.selvikumar.co.uk

# Claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Approval system
APPROVAL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 32+ char random string

# Module 3 specific
APPLICATION_DATA_DIR=/data/applications
APPLICATION_TIMEZONE=Europe/London
```

### C.2 n8n Credentials Required

| Credential | Type | Used By |
|-----------|------|---------|
| Resend API | API Key (Header Auth) | WF-AP2, WF-AP3, WF-AP6 |
| Anthropic Claude | API Key (Header Auth) | SW-AP1 |
| Postgres (selvi_jobs) | Postgres credentials | All workflows |
| Telegram Bot | API Token | WF-AP0 (alerts) |

### C.3 Community Nodes Required

| Node | Package | Version | Purpose |
|------|---------|---------|---------|
| Resend | n8n-nodes-resend | latest | Email sending and tracking |

Note: All other functionality uses n8n built-in nodes (Postgres, HTTP Request, Code, Webhook, Schedule Trigger, Switch, IF, Set, Execute Workflow, Split In Batches, etc.).

---

## Appendix D: Testing Strategy

### D.1 Unit Testing (Per Workflow)

| Workflow | Test Cases |
|----------|-----------|
| WF-AP1 (Router) | 1. Email method detected from URL, 2. Portal method detected from URL pattern, 3. Unknown method flagged, 4. Academic role routing, 5. Empty result set handled |
| WF-AP2 (Email Engine) | 1. B-tier auto-send, 2. A-tier held for approval, 3. Rate limit blocks send, 4. Duplicate detected, 5. Attachment format selection (PDF vs DOCX) |
| WF-AP3 (Portal Engine) | 1. Workday task card generation, 2. University task card with supporting statement, 3. LinkedIn task card, 4. Date formatting per portal |
| WF-AP4 (Quality Gate) | 1. Exact duplicate blocked, 2. Fuzzy duplicate flagged, 3. Rate limit enforced, 4. Quiet hours enforced, 5. Suppressed email blocked |
| WF-AP5 (Approval) | 1. Valid approve, 2. Valid reject, 3. Expired token, 4. Invalid token, 5. Already processed |
| SW-AP1 (Composer) | 1. Direct email composition, 2. Agency response, 3. Academic email, 4. Banned phrase rejection, 5. UK English validation |
| SW-AP2 (Delivery) | 1. Delivered event, 2. Bounced event, 3. Complaint event, 4. Invalid signature rejected |

### D.2 Integration Testing

| Test | Description | Expected Outcome |
|------|-------------|-----------------|
| End-to-end B-tier email | Create a B-tier job with email method, tailored CV, trigger router | Email composed, quality gate passed, sent via Resend, delivery tracked |
| End-to-end A-tier email | Create an A-tier job with email method | Application prepared, approval notification sent, approve triggers send |
| End-to-end portal | Create a job with Workday URL | Task card generated with correct formatting, email sent to candidate |
| Duplicate prevention | Submit two applications to same company/role | Second blocked with appropriate message |
| Rate limiting | Queue 5 applications rapidly | First 3 sent, rest queued for next hour |
| Bounce recovery | Simulate a bounced email webhook | Application marked as method_failed, candidate notified |

### D.3 Test Data

A test fixture of 20+ jobs should be maintained with:
- 5 email-based applications (3 direct, 2 agency)
- 3 Workday portal URLs
- 2 University portal URLs (Stonefish, Jobtrain)
- 2 LinkedIn Easy Apply URLs
- 2 NHS Jobs URLs
- 2 Civil Service Jobs URLs
- 2 generic portal URLs
- 2 unknown/ambiguous methods

Each test job should have a corresponding tailored CV and cover letter (from Module 2 or manually created test fixtures).

---

---

## 20. 50-Round Critical Roleplay Evaluation (v1)

**Evaluation Date:** 2026-03-29
**Evaluator Model:** Claude Opus 4.6
**Method:** 5 expert personas x 10 rounds each. Scoring: 1 (critical failure) to 10 (no concern). Scores 3-5 represent normal findings for a v1.0 PRD.

---

### 20.1 Persona 1: The Candidate (Selvi)

*Context: PhD + MBA, 18 years HR/L&D experience, UK-based. 90% manual callback rate. Concerned about reputation, control, quality, and career impact.*

---

**Round 1 -- "Will automated B-tier emails damage my professional reputation?"**

The PRD auto-sends B-tier email applications without human review. The rationale (Section 10.5) is that "B-tier roles are legitimate matches" and "the system's email quality is comparable to or better than a rushed manual email." This is a dangerous assumption. A single poorly-worded email to a recruiter at a firm I later want to approach for an A-tier role could poison the relationship permanently. The L&D and HR world in the UK is small -- especially at senior levels. Recruiters talk. A formulaic-sounding email sent to a Hays consultant who then sees my name on an A-tier application to one of their clients creates cognitive dissonance about my candidacy.

The email examples in Appendix B are competent but not distinctive. They lack the kind of specific, relationship-aware phrasing that makes a recruiter pick up the phone. The banned phrases list (Section 7.2) prevents the worst AI patterns, but "not obviously AI" is a low bar. At my seniority level, emails need to sound like someone who has been in the industry for two decades, not like a well-trained chatbot.

The PRD offers no mechanism for me to review a sample of B-tier emails periodically to calibrate quality. Once auto-send is enabled, I lose visibility into what is being sent in my name.

**Score: 4/10**

**Recommendations:**
1. Add a "shadow mode" for the first 2-4 weeks where all emails (B-tier included) are held for review
2. Implement weekly B-tier email quality sampling -- send me 3-5 random B-tier drafts for review each week
3. Add a "confidence threshold" where B-tier emails below a certain composition quality score get held for approval

---

**Round 2 -- "What happens if I get an offer and the system keeps sending applications?"**

Section 4.4 (US-313) describes a pause toggle. But the acceptance criteria say "Single toggle (database flag or n8n workflow disable) pauses all automated submissions." That is vague. If I receive an offer at 3 PM on a Tuesday, I need to pause instantly from my phone, not log into n8n or write a SQL query. The PRD does not specify a mobile-friendly or quick-access pause mechanism. There is no integration with the approval notification emails -- I cannot reply "PAUSE" to any system email to halt everything.

More critically, there is no automated detection. The system tracks response_type = 'offer' but only through manual entry. Between receiving an offer and remembering to pause the system, the system might send 2-3 more automated applications. Those applications go out under my name and cannot be unsent. Worse, if I accept the offer but forget to pause, I am now applying to jobs I have no intention of taking -- wasting recruiters' time and damaging my professional reputation.

The "resume" function also needs attention. When I resume, it "sends all queued applications with rate limiting applied." But jobs that were queued 2 weeks ago during a holiday may have expired or been filled. Resuming should prompt me to review the queue, not blindly fire off stale applications.

**Score: 3/10**

**Recommendations:**
1. Add a "reply PAUSE to any system email" mechanism
2. Add a prominent PAUSE link in every daily digest and approval email
3. On resume, age-check queued applications and discard those older than 7 days
4. When response_type = 'offer' is manually logged, auto-suggest pausing the system

---

**Round 3 -- "Can I trust the duplicate detection to protect me from embarrassment?"**

The dedup system (Section 10.2) uses fuzzy matching with `similarity() > 0.8` on job titles and `> 0.6` on company names. This is reasonable but misses important edge cases. Consider: I apply to "Learning & Development Manager" at NHS England via email. Two weeks later, the same role appears on NHS Jobs portal with the title "L&D Manager." The `similarity()` function on these strings might be 0.7 -- below the 0.8 threshold. Or consider "Head of People Development" vs "Head of L&D" at the same company -- completely different titles for what could be the same role.

The 90-day window is sensible, but the PRD does not address company subsidiaries or divisions. "Barclays" and "Barclays Investment Bank" and "Barclays Execution Services" normalize to different strings after the normalization function strips "Investment Bank" but not "Execution Services." Am I applying to three different entities or the same employer?

The dedup hash uses `md5(company_normalized || title || location)`. Location differences ("London" vs "City of London" vs "London, EC2") would produce different hashes, missing exact-title duplicates at the same company in the same city described differently.

**Score: 4/10**

**Recommendations:**
1. Add title synonym awareness (L&D = Learning & Development = Learning and Development)
2. Use Claude for semantic dedup on borderline cases (similarity 0.5-0.8)
3. Normalize locations to canonical forms before hashing
4. Add manual "these are the same company" grouping capability

---

**Round 4 -- "What if the system sends an email with incorrect information about my experience?"**

Section 13.3 states "AI-generated email bodies must only reference achievements and qualifications present in the candidate's master profile" and "prompts include explicit instructions against hallucination." But the PRD provides no verification mechanism. The prompt says "do not invent experience the candidate does not have" but Claude hallucination is probabilistic, not eliminable by instruction.

The quality gate (Section 10.1) validates word count, banned phrases, subject line length, and UK English. It does not validate factual accuracy against the candidate profile. There is no step that cross-references claims in the email body against the master CV data. If Claude writes "I managed a team of 20" when my profile says 15, or attributes me to an employer I never worked for, the content validation catches nothing.

For B-tier auto-sends, this means a factually incorrect email goes out without any review. For A-tier, I might catch it in the preview, but I am being asked to review an email in a notification context (on my phone, between meetings), not in a careful editing context. The preview format in Section 10.4 does not include a side-by-side comparison with my actual profile.

**Score: 3/10**

**Recommendations:**
1. Add a fact-checking step: extract claims from the generated email, cross-reference against the master profile JSON
2. Highlight any claim in the email body that cannot be traced to the master profile
3. For A-tier previews, include a "claims vs. profile" comparison section
4. Set a hard rule: if fact-check fails, do not auto-send regardless of tier

---

**Round 5 -- "How do I know the system is not applying to scam postings?"**

Module 1 scores jobs, but the PRD does not describe how scam/fraud postings are filtered before reaching Module 3. Section 6.4 mentions validating email addresses and checking for generic email services (gmail, outlook), noting these are "legitimate for small businesses and recruiters, but also used in scam postings." The system flags these for review but does not block them.

If a scam job posting passes Module 1's scoring (plausible title, reasonable description, correct sector), Module 3 will compose and send an application email containing my full name, phone number, email address, and professional history to a potentially malicious recipient. The email signature in the config includes my phone number. The CV attachment contains my address, employment history, and education details.

For auto-sent B-tier applications, there is no human review before my personal data goes to an unverified recipient. The email validation checks the domain has MX records (Section 10.1), but scam operations typically use real email infrastructure.

**Score: 3/10**

**Recommendations:**
1. Add a scam-risk score from Module 1 as a blocking criterion in the quality gate
2. Never auto-send to gmail/outlook/yahoo application addresses -- always hold for approval
3. For first-time sends to any domain, flag for approval regardless of tier
4. Add a "known employer" whitelist that grows over time as legitimate applications succeed

---

**Round 6 -- "Will recruiters notice the emails come from a different domain?"**

Section 7.4 specifies sending from "selvi@applications.selvikumar.co.uk" with Reply-To set to the personal email. Experienced recruiters will notice the domain mismatch. When they reply, it goes to my personal email, but the From address is a subdomain they have never seen. This is a known pattern of automated email systems and CRM tools. At my seniority level, this could raise eyebrows.

The "alternative (simpler)" approach in Section 7.4 suggests using the candidate's personal email via SMTP, but this is mentioned as an aside, not developed. Using my actual email provider (e.g., Gmail SMTP) would solve the authenticity problem but would mean application emails appear in my Sent folder and use my email provider's rate limits.

Agency recruiters in particular are pattern-aware. They process hundreds of candidate emails daily and will notice that applications from "selvi@applications.selvikumar.co.uk" have a different header structure from normal client emails. Some agencies' internal systems flag emails from unfamiliar subdomains.

**Score: 4/10**

**Recommendations:**
1. Prioritize the SMTP-through-personal-email approach as the primary path, not an alternative
2. If using Resend, use the candidate's actual domain (selvikumar.co.uk), not a subdomain
3. Test deliverability and recruiter perception with 5-10 real recruiter contacts before scaling
4. Add X-Mailer and other headers to match common email clients

---

**Round 7 -- "What visibility do I have into the queue and what is coming?"**

The daily summary (Section 11.4) shows yesterday's activity and pending actions. The weekly report (Section 11.5) provides aggregates. But there is no forward-looking view. I cannot see: what applications are queued for today, what emails will be sent in the next few hours, which companies I am about to apply to.

If I have a networking call with someone at Company X this afternoon and I want to mention I am applying there -- or specifically hold off on a system-generated application so I can leverage the relationship -- I have no way to know if the system is about to send an email to Company X. The 15-minute cron cycle means the system could fire an application between the time I check my morning digest and the time I finish my call.

There is no "upcoming queue" view, no way to block a specific pending application before it is processed, and no real-time status beyond the daily email. The pause toggle is system-wide overkill for blocking one specific application.

**Score: 3/10**

**Recommendations:**
1. Add an "upcoming applications" section to the daily digest showing what will be processed today
2. Add per-application hold capability (reply to daily digest with job ID to hold/cancel)
3. Consider a lightweight Telegram bot for real-time queue visibility and per-application control
4. Add a "block company" quick action that prevents applications to a specific company

---

**Round 8 -- "How personalized are agency emails really?"**

Section 4.2 (US-307) requires agency response emails to be "briefer than direct applications" and "mention availability for a call." The example in Appendix B.2 is functional but generic. In the UK L&D recruitment market, I work with perhaps 5-8 agencies regularly. Each agency recruiter has a preferred communication style. Some prefer formal, some casual. Some want salary expectations upfront, others consider it premature.

The system treats all agencies identically except for subject line format. There is no agency-specific context: no memory of previous interactions, no recruiter name personalization (the example uses "Hi Sarah" but the system would need to extract the recruiter's name from the posting), no adjustment for agency specialism (an L&D-specialist agency vs. a generalist like Hays).

For a candidate at my level, agency relationships are currency. A generic-feeling response to a specialist recruiter I have worked with before ("Hi Sarah, Thank you for posting the L&D Manager role") reads as if I do not remember our previous conversation. It actively damages the relationship.

**Score: 3/10**

**Recommendations:**
1. Add a "known contacts" table linking email addresses to recruiter names and relationship notes
2. For known recruiters, include relationship context in the Claude prompt ("You have previously worked with this recruiter on 3 roles")
3. For specialist agencies, adjust tone and content depth based on agency type
4. Always hold agency emails to known recruiters for approval, regardless of tier

---

**Round 9 -- "What happens with the 48-hour auto-expiry on A-tier applications?"**

Section 10.3 states that if I do not act on an A-tier approval within 48 hours, it auto-expires. The PRD acknowledges these are "high-value opportunities where a single application could determine the candidate's next career move." Yet the system will silently expire them if I am away for a weekend, sick for two days, or simply overwhelmed with work.

The reminder cadence (12h, 24h, then expire at 48h) is aggressive for applications to roles I have already been deemed highly qualified for. The 48-hour expiry effectively creates an artificial deadline on top of any real application deadline. If I am travelling, at a conference, or dealing with a personal emergency, I lose high-value opportunities not because they closed, but because the system decided I took too long.

There is no "snooze" or "extend" option. There is no distinction between "I have not seen this" and "I saw it and am still thinking." The system cannot tell the difference between me being busy and me deliberately ignoring the notification.

**Score: 4/10**

**Recommendations:**
1. Extend default expiry to 96 hours (4 days) for A+ tier, 72 hours for A tier
2. Add a "snooze" link that extends the expiry by 48 hours
3. Make expiry configurable per-candidate in application_config
4. Before expiring, check if the actual job closing date has passed -- if not, extend automatically

---

**Round 10 -- "Am I locked in? What if I want to stop using the system?"**

Section 18.3 covers data subject rights, including deletion. But the system holds data across multiple locations: Postgres tables, filesystem (CVs, cover letters, task cards), Resend's systems (sent email records), and Claude's API logs (though Anthropic says they do not retain commercial API data). The deletion script in Section 18.3 is SQL-only and includes a commented-out `rm -rf` for filesystem cleanup.

If I stop using the system, my professional email has already been sent from a custom domain I might not maintain. Replies from employers to the Reply-To address work, but any future correspondence referencing the original From address will bounce if I let the domain lapse. There is no plan for domain lifecycle management.

The system also creates dependencies: if I build my application tracking around this system and then stop, I lose my application history unless I export first. The export function exists but produces a raw JSON blob, not something useful for continuing to track applications manually.

**Score: 5/10**

**Recommendations:**
1. Add structured export (CSV with clear column headers) alongside JSON
2. Document domain lifecycle: what happens when the sending domain expires
3. Add a "wind-down" mode that stops new applications but maintains tracking for existing ones
4. Resend data retention: document what Resend keeps and how long

---

#### Persona 1 Summary: The Candidate (Selvi)

| Round | Concern | Score |
|-------|---------|-------|
| 1 | B-tier auto-send reputation risk | 4 |
| 2 | No quick pause mechanism / offer scenario | 3 |
| 3 | Duplicate detection edge cases | 4 |
| 4 | AI hallucination / factual accuracy | 3 |
| 5 | Scam posting protection | 3 |
| 6 | Sending domain authenticity | 4 |
| 7 | Queue visibility and per-application control | 3 |
| 8 | Agency email personalization depth | 3 |
| 9 | A-tier approval expiry too aggressive | 4 |
| 10 | Exit strategy and data portability | 5 |
| **Average** | | **3.6** |

**Top 3 Issues:**
1. No factual accuracy verification against candidate profile before auto-send (Round 4)
2. No queue visibility or per-application control short of system-wide pause (Rounds 2, 7)
3. Agency emails lack relationship awareness, treating all agencies as strangers (Round 8)

---

### 20.2 Persona 2: Technical Architect / n8n Expert

*Context: Deep expertise in n8n workflow design, email infrastructure, ARM64 deployment, PostgreSQL, and distributed system reliability on constrained hardware.*

---

**Round 11 -- "The circuit breaker implementation will not survive n8n restarts"**

The circuit breaker in Section 17.2 uses `getWorkflowStaticData('global')`. n8n's static data persists across executions of the same workflow but is workflow-scoped. The circuit breaker state for the Resend API stored in WF-AP2's static data is not visible to WF-AP3 or WF-AP6, which also call Resend. If Resend is down, WF-AP2 trips its breaker but WF-AP3 keeps sending task card emails until it independently trips its own breaker.

Worse, `getWorkflowStaticData` behavior during n8n restarts is not guaranteed. On the self-hosted instance running via Dokploy, a container restart clears in-memory state. The static data persistence depends on n8n's execution database, and the timing of persistence writes is not deterministic. A crash during a failure cascade could lose the circuit breaker state entirely, causing the system to retry against a failing service immediately after restart.

The PRD specifies no external circuit breaker (e.g., a database flag or Redis-backed state). For a system running on a single CAX31 ARM64 node with no redundancy, reliability mechanisms that depend on in-process state are fragile.

**Score: 3/10**

**Recommendations:**
1. Move circuit breaker state to Postgres (a `circuit_breaker_state` table with service name, failure count, open_until timestamp)
2. All workflows check the shared circuit breaker before calling external APIs
3. Add a startup check in WF-AP0 that resets circuit breaker state after a known downtime
4. Consider n8n's built-in retry mechanisms instead of custom circuit breakers

---

**Round 12 -- "The 15-minute cron with LIMIT 10 creates job starvation under load"**

WF-AP1 runs every 15 minutes and fetches `LIMIT 10` ready-to-apply jobs ordered by tier and score. If the pipeline produces more than 10 ready jobs per 15-minute window (plausible during a Monday morning burst when Module 1 discovers weekend postings and Module 2 processes them overnight), lower-priority jobs get repeatedly pushed back. A B-tier job scored 56 will never be processed if there are always 10+ higher-scoring jobs ahead of it.

The query does not include any fairness mechanism -- no "oldest first" tiebreaker within the same tier, no aging boost. Jobs that arrive during a busy period could sit in `ready_to_apply = true` indefinitely, with the system never reaching them because fresh, higher-scoring jobs keep arriving.

Combined with the rate limit of 3 emails/hour and 15/day, a Monday morning burst of 30 B-tier email applications would take 2+ days to clear. But during those 2 days, new jobs arrive. The queue grows faster than it drains.

**Score: 4/10**

**Recommendations:**
1. Add `created_at ASC` as a tiebreaker within the same tier to prevent starvation
2. Increase batch size for portal-type applications (they do not consume rate limit)
3. Add a "queue age" metric to the daily report so the candidate sees backlog growth
4. Consider processing email and portal applications in separate batches since portal prep has no rate limit

---

**Round 13 -- "ARM64 compatibility of the n8n-nodes-resend community node is unverified"**

The PRD specifies the Hetzner CAX31, which is ARM64 (Ampere Altra). n8n runs fine on ARM64, and native nodes work. But community nodes like `n8n-nodes-resend` are npm packages that may include native dependencies compiled for x86_64. The PRD lists this as a required dependency but does not mention ARM64 compatibility testing.

If `n8n-nodes-resend` uses a native module that has no ARM64 build, the entire email sending capability fails at deploy time. The fallback (Section 7.4, "alternative: use SMTP node") is mentioned as an aside but not designed or tested. The SMTP node is a built-in n8n node and works on any architecture, but it has different configuration requirements, no built-in webhook support for delivery tracking, and different rate limiting behavior.

The PRD also does not account for Gotenberg (used by Module 2 for PDF generation) on ARM64 -- though that is Module 2's problem, if Gotenberg fails, Module 3 has no CVs to attach.

**Score: 5/10**

**Recommendations:**
1. Test n8n-nodes-resend on ARM64 before committing to the architecture
2. Design the Resend integration using n8n's built-in HTTP Request node as the primary path (Resend has a simple REST API), with the community node as a convenience wrapper
3. Document the SMTP fallback as a fully-specified alternative, not an aside
4. Add ARM64 compatibility to the Phase 1 verification criteria

---

**Round 14 -- "The webhook security model has a replay attack vulnerability"**

The approval webhook (Section 10.3) uses HMAC-signed tokens with an expiry, which is good. But the token is embedded in a URL sent via email: `https://n8n.deploy.apiloom.io/webhook/approve-application?id={id}&token={token}`. This URL appears in the candidate's email client, is logged in browser history, and could be cached by email security scanners (Microsoft Safe Links, Google URL scanning).

Email security scanners follow links in emails to check for malware. If a corporate email scanner follows the approval URL, it triggers the approval webhook and sends the application. This is a known problem with action-links-in-emails, and it is particularly dangerous here because the approval link has a side effect (sending a job application).

The PRD uses HTTP GET for the approval webhook (Section 15.5: "Method: GET"). GET requests should be idempotent -- they should not trigger state changes. Using GET for approval means any prefetch, cache warm, or security scanner visit triggers the application send.

Additionally, there is no protection against replay. Once a token is used to approve, the PRD does not invalidate it. A second click (or scanner re-visit) could attempt to re-send.

**Score: 2/10**

**Recommendations:**
1. Change the approval webhook from GET to POST -- the email links should load a confirmation page (GET) with a "Confirm Send" button that POSTs
2. Add single-use token enforcement: mark the token as consumed after first use
3. Add a "link prefetch protection" page that requires a deliberate click (JavaScript-based confirmation or CAPTCHA)
4. Consider using n8n's Form Trigger instead of a raw webhook for approval actions

---

**Round 15 -- "No database connection pooling or concurrency control"**

The PRD specifies 9 workflows, several running on overlapping cron schedules (:15 and :45 for WF-AP1, every 4 hours for WF-AP6 maintenance, plus event-driven webhooks). Each workflow execution opens Postgres connections. n8n's built-in Postgres node uses the credential-level connection settings, which may or may not pool connections depending on the n8n version and configuration.

On the CAX31 (8 vCPU, 16 GB RAM), running n8n alongside Postgres, Gotenberg, and potentially Dokploy's reverse proxy, resource contention is real. If WF-AP1 processes 10 jobs in a batch, each calling WF-AP4 (sub-workflow with 4-5 Postgres queries) and then WF-AP2 or WF-AP3 (with their own Postgres queries), a single 15-minute cycle could generate 50+ concurrent database connections.

The database schema uses triggers (Section 14.3) that fire on every status update, adding overhead to what could already be a bottleneck. The `compute_application_dedup` trigger does a `SELECT FROM jobs` inside the trigger function, meaning an INSERT into `applications` triggers a synchronous read from `jobs` within the transaction.

There is no mention of Postgres `max_connections` configuration, connection pooling (PgBouncer), or query timeouts.

**Score: 4/10**

**Recommendations:**
1. Add PgBouncer or use n8n's connection pooling configuration to limit concurrent connections
2. Set Postgres `max_connections` explicitly for the shared workload
3. Optimize the dedup trigger to avoid the cross-table SELECT (pre-compute normalized company and title before INSERT)
4. Add query timeout configuration (statement_timeout) to prevent long-running queries from blocking the pool

---

**Round 16 -- "The email composition retry loop could burn Claude API credits"**

Section 15.2, Node 8 says: "IF validation fails: Re-call Node 7 with corrective instructions (max 2 retries)." Node 7 calls SW-AP1, which calls Claude API. So a single application could invoke Claude 3 times (initial + 2 retries). With 15 applications/day, worst case is 45 Claude API calls just for email composition.

But the retry trigger is content validation -- banned phrases, word count, UK English. These are systematic prompt issues, not random failures. If the prompt produces a banned phrase once, the "corrective instruction" approach (which is not specified in detail) is unlikely to fix the root cause. The retry is likely to fail again, consuming tokens and adding latency.

More concerning: the PRD does not specify what the "corrective instructions" contain. Adding "do not use the phrase X" to a retry prompt is a known fragile pattern with LLMs -- the model may avoid that specific phrase but introduce another banned phrase. The retry loop could oscillate between different banned phrases indefinitely (within the 2-retry limit).

For supporting statement generation (Section 8.5), there is no retry mechanism at all. A Claude failure produces no supporting statement, and the task card goes out without one.

**Score: 5/10**

**Recommendations:**
1. Fix banned phrases in post-processing (regex replace) rather than regenerating the entire email
2. If regeneration is needed, specify the corrective prompt precisely in the PRD
3. Add a cost cap: track Claude API spend daily and halt if it exceeds a threshold
4. Add the retry mechanism to supporting statement generation as well

---

**Round 17 -- "Resend webhook endpoint is publicly discoverable"**

The webhook URL `https://n8n.deploy.apiloom.io/webhook/resend-delivery-events` is a static, predictable endpoint. The HMAC signature validation (Section 7.7) protects against forged payloads, but the endpoint itself is discoverable. An attacker who knows the URL pattern could:

1. Send flood requests to the webhook, consuming n8n execution resources
2. Attempt timing attacks against the HMAC validation to infer the secret
3. Probe for other webhook paths at the same n8n instance

The n8n instance URL `n8n.deploy.apiloom.io` is embedded in the PRD and presumably in the actual deployment. If Module 1 or Module 2 PRDs are similarly documented, the full webhook surface area is known.

There is no mention of rate limiting on webhook endpoints, no IP allowlisting for Resend's webhook source IPs, and no Web Application Firewall (WAF) or Cloudflare protection in front of the n8n instance.

**Score: 4/10**

**Recommendations:**
1. Add IP allowlisting for Resend's webhook source IPs (Resend publishes these)
2. Add rate limiting on webhook endpoints at the reverse proxy level (Dokploy/Traefik)
3. Use a random path suffix for webhook URLs instead of predictable names
4. Consider putting n8n behind Cloudflare for DDoS protection

---

**Round 18 -- "The `similarity()` function requires pg_trgm and has performance implications"**

The duplicate detection (Section 10.2) uses PostgreSQL's `similarity()` function, which requires the `pg_trgm` extension. The PRD does not include `CREATE EXTENSION IF NOT EXISTS pg_trgm;` in the schema setup. The GIN trigram index on `company_normalized` (Section 14.1) also requires this extension.

The fuzzy matching query (Level 2) computes `similarity()` against every non-terminal application in the last 90 days. With 25-35 applications/week, the table grows to ~400+ rows in 90 days. The `similarity()` function is computationally expensive -- it computes trigram overlap for every row that passes the `WHERE` filter. Without the GIN index being properly used (the query uses `similarity()` in WHERE, which does not use the GIN index -- `%` or `<->` operators are needed for index usage), this becomes a sequential scan with trigram computation on every row.

At current scale (hundreds of rows), this is fast enough. But the PRD mentions future "multi-candidate support" and if the table grows to thousands of rows, the fuzzy dedup query becomes a bottleneck on the Quality Gate, which runs on every application.

**Score: 6/10**

**Recommendations:**
1. Add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` to the schema setup
2. Use the `%` operator (similarity threshold) in the WHERE clause to enable GIN index usage
3. Document the expected table size and query performance at scale
4. Consider pre-computing normalized titles and using a materialized view for dedup candidates

---

**Round 19 -- "No idempotency protection on the Application Router"**

WF-AP1 runs every 15 minutes and queries for `ready_to_apply = true` jobs. It creates an application record in Node 7. But if the workflow execution fails between Node 7 (create record) and Node 8 (route to engine), the next run of WF-AP1 will not pick up the same job because the query excludes jobs with existing application records (`j.id NOT IN (SELECT job_id FROM applications WHERE status NOT IN ('failed', 'expired', 'withdrawn'))`).

However, if the workflow fails before Node 7, or if Node 7 fails, the same job will be picked up again in the next 15-minute cycle. This is by design and is fine. The real problem is if two WF-AP1 executions overlap. n8n cron triggers can fire a new execution while the previous one is still running (especially if the previous execution is slow due to Claude API calls in Node 6). Both executions query the same ready jobs, and both attempt to create application records. Without a unique constraint on `(job_id)` in the applications table (the constraint is only on `id`, which is a UUID), both succeed, creating duplicate application records.

The PRD relies on the Quality Gate's dedup check to catch this, but the dedup checks company+title similarity, not job_id equality. Two application records for the same job_id with the same company and title would be caught, but the gap between creation and quality gate check is a window for inconsistency.

**Score: 4/10**

**Recommendations:**
1. Add a unique constraint or partial unique index on `applications(job_id)` for non-terminal statuses
2. Use `SELECT ... FOR UPDATE SKIP LOCKED` in WF-AP1's query to prevent concurrent processing of the same job
3. Add n8n workflow settings to prevent concurrent executions of WF-AP1 (mode: "queue")
4. Add a `processing_locked_at` column to the jobs table to implement pessimistic locking

---

**Round 20 -- "No health check or self-healing for the n8n instance"**

The PRD assumes n8n is running and available. There is no liveness probe, readiness probe, or health check endpoint for the Module 3 workflows. If the n8n instance crashes, restarts, or becomes unresponsive:

- Cron-triggered workflows (WF-AP1, WF-AP6) simply do not fire. No alert is generated because the alert mechanism (WF-AP0) is itself an n8n workflow that is also down.
- Webhook-triggered workflows (WF-AP5, SW-AP2) receive incoming requests that time out or return errors. Resend will retry webhook deliveries for a period (typically 24 hours), but approval clicks from the candidate are lost with no retry.
- Queued applications pile up in the database with no processing.

The PRD mentions "Dokploy on Hetzner CAX31" but does not specify Docker health checks, restart policies, or external monitoring (e.g., UptimeRobot, Healthchecks.io). For a system sending professional communications in the candidate's name, undetected downtime is a significant risk.

**Score: 3/10**

**Recommendations:**
1. Add a Docker health check for the n8n container (curl to n8n's API health endpoint)
2. Set Docker restart policy to `unless-stopped` or `always`
3. Add an external uptime monitor (e.g., Healthchecks.io pinging a "heartbeat" workflow that runs every 5 minutes)
4. The daily digest should include a "system health" section confirming all workflows executed as scheduled

---

#### Persona 2 Summary: Technical Architect / n8n Expert

| Round | Concern | Score |
|-------|---------|-------|
| 11 | Circuit breaker state does not survive restarts | 3 |
| 12 | Job starvation under load with LIMIT 10 | 4 |
| 13 | ARM64 compatibility of community nodes | 5 |
| 14 | Webhook approval via GET; replay/scanner vulnerability | 2 |
| 15 | No connection pooling or concurrency control | 4 |
| 16 | Claude API retry loop burns credits inefficiently | 5 |
| 17 | Webhook endpoints publicly discoverable | 4 |
| 18 | pg_trgm extension missing; similarity() performance | 6 |
| 19 | No idempotency on Application Router | 4 |
| 20 | No health check or self-healing | 3 |
| **Average** | | **4.0** |

**Top 3 Issues:**
1. Approval webhook uses GET with side effects -- email scanners can trigger application sends (Round 14)
2. Circuit breaker state is in-process and does not survive restarts; no shared state across workflows (Round 11)
3. No external health monitoring; system can silently fail with no alerts (Round 20)

---

### 20.3 Persona 3: UK Employment Law / Recruitment Expert

*Context: Specialist in UK employment law, recruitment industry practices, platform compliance, and ethical job-seeking. Familiar with Equality Act 2010, GDPR, and recruitment agency regulations.*

---

**Round 21 -- "Automated emails may constitute misleading representation"**

Section 13.3 states: "Application emails do not need to disclose that they were AI-generated (this is not required by law and would be counterproductive)." This is legally correct as of 2026 -- there is no UK law requiring disclosure of AI-generated job application content. However, the ethical and practical risks are understated.

If a recruiter or employer discovers (through pattern analysis, metadata inspection, or simply asking) that the application email was AI-generated, the trust damage is severe. The candidate is implicitly representing the email as her own writing. While not legally fraud, it could be considered misleading representation under common law principles if it creates a material misimpression about the candidate's capabilities (e.g., writing ability).

For academic roles specifically, written communication is often assessed as part of the application. A supporting statement generated by Claude (Section 8.5) that is significantly more polished than the candidate's natural writing style could create problems at interview when the candidate's spoken communication does not match the written quality. Academic panels notice this discrepancy.

The PRD's "pass as hand-written" requirement (Rule 7 in Section 7.2) explicitly optimizes for deception.

**Score: 4/10**

**Recommendations:**
1. Acknowledge the ethical tension more explicitly in the PRD
2. For academic supporting statements, add a calibration step where the candidate reviews and rewrites in her own voice
3. Consider a disclosure policy: "This application was prepared with AI assistance" (normalized in many industries now)
4. For A-tier roles, make it clearer that the candidate should personalize beyond just clicking "approve"

---

**Round 22 -- "Per-domain rate limiting may not prevent perception of mass application"**

Section 12.1 limits emails to 2 per domain per 24 hours. But large employers often use multiple domains (nhs.net, england.nhs.uk, jobs.nhs.uk, specific-trust.nhs.uk). Recruitment agencies may use personal email addresses alongside the agency domain. A candidate could send 5 applications to NHS-related entities in one day without triggering the per-domain limit.

In the UK L&D market at senior level, hiring managers at different organizations know each other. If three London-based NHS trusts receive identically-structured application emails from the same candidate on the same day, the word spreads. The rate limiting protects against technical spam detection but not against social detection of mass application behavior.

The UK recruitment market is relationship-driven at senior levels. Perceived mass application signals desperation or lack of discernment -- both toxic to a senior candidate's positioning. The PRD's 20-40 applications/week target (Section 1) is aggressive for a candidate at this level. Most senior HR/L&D professionals send 5-10 highly targeted applications per week.

**Score: 4/10**

**Recommendations:**
1. Add organization-level (not just domain-level) rate limiting using company normalization
2. Reduce the default weekly target to 15-25 for senior-level roles
3. Add an "industry sector" rate limit (e.g., max 3 NHS applications per week)
4. Surface the per-organization send history in approval notifications so the candidate can see overlap

---

**Round 23 -- "The system does not handle Right to Work nuances correctly"**

Section 8.2 includes "Right to Work: Yes -- British Citizen / Settled Status / Indefinite Leave to Remain" as a pre-filled field. But the candidate profile in Section 14.1 lists "right_to_work": "Yes - Settled Status". The task card presents multiple options (British Citizen / Settled Status / ILR) as if they are interchangeable. They are not.

Settled Status (EU Settlement Scheme) and British Citizenship carry different rights and implications. Employers cannot legally discriminate, but the distinction matters for documentation at the Right to Work check stage. Pre-filling with ambiguous or incorrect status information could cause problems.

More critically, the system pre-fills this sensitive immigration status information in every task card email. These emails are sent in plaintext (Section 7.4 specifies "Text: {generated_email_body}" -- plain text, not encrypted). Immigration status is sensitive personal data under UK GDPR. Sending it in unencrypted emails to the candidate's personal inbox (which may be shared or on a public Wi-Fi) is a data handling concern.

**Score: 5/10**

**Recommendations:**
1. Use only the candidate's actual right to work status, not a list of alternatives
2. Mark right to work status as a "fill at point of use" field, not pre-populated in emails
3. Consider omitting sensitive fields from emailed task cards and providing them only via a secure link
4. Ensure right to work declarations match the specific portal's expected format/options

---

**Round 24 -- "Equality monitoring data should never be pre-filled or stored"**

Section 8.2 includes an "Equal Opportunities Monitoring" section in the task card with pre-filled responses: gender, ethnicity, disability status, age range, religion, sexual orientation. Even with "Prefer not to say" defaults, pre-populating these fields in a system that generates application materials creates several problems.

First, storing protected characteristic data alongside application data means the system holds sensitive personal data that it does not need. The PRD's data classification (Section 18.1) does not separately classify this data, though it is a special category under UK GDPR Article 9.

Second, pre-filling these responses implies a recommendation. A candidate who sees "Disability: Prefer not to say" pre-filled might not realize she could benefit from declaring a disability under the Disability Confident scheme, which some employers use to guarantee interviews to disabled applicants.

Third, if this data is ever exposed in a breach, the association of protected characteristics with application records creates a discrimination evidence trail -- even if the monitoring data was never submitted.

**Score: 3/10**

**Recommendations:**
1. Do not store equality monitoring data in the system at all
2. Replace the pre-filled section with a reminder: "You may be asked equality monitoring questions. These are optional and protected by law."
3. For Disability Confident employers, add a specific prompt: "This employer is Disability Confident -- declaring a disability may guarantee an interview"
4. Never include protected characteristic data in emailed task cards

---

**Round 25 -- "Agency emails may create unintended contractual obligations"**

Section 13.1 mentions the Employment Agencies Act 1973 and Conduct Regulations 2003. But the treatment is superficial. When the system sends an email to a recruitment agency, it is initiating a business relationship. Under the Conduct Regulations:

- The agency must provide written terms to the candidate before submitting them to an employer (Regulation 14)
- The candidate must give specific consent for the agency to submit their CV to a named employer (Regulation 15)
- The agency must not charge the candidate (Regulation 26)

The system sends CV and cover letter to agency email addresses without knowing whether the candidate has existing terms with that agency. If the agency treats the automated email as a new registration, it may submit the candidate to employers without further consent. Multiple agencies could submit the candidate to the same employer, creating a "double submission" scenario that often results in the candidate being rejected by both.

The PRD has no mechanism to track which agencies the candidate has formal agreements with, which employers each agency has been authorized to represent the candidate to, or whether sending a CV constitutes implicit consent to representation.

**Score: 3/10**

**Recommendations:**
1. Add an "authorized agencies" list with explicit flags for which agencies can represent the candidate
2. For unknown agencies (first contact), hold the application for approval regardless of tier
3. Add a disclaimer in agency emails: "Please do not submit my details to any employer without my explicit prior consent"
4. Track agency-employer representation to prevent double submissions across agencies

---

**Round 26 -- "The system creates legal risk for speculative applications"**

Section 4.2 (US-308) describes speculative applications -- emailing companies where no vacancy is listed. While legal, speculative applications carry specific risks when automated. The PECR (Privacy and Electronic Communications Regulations 2003) exemption for job applications is narrower for speculative approaches than for responding to advertised vacancies.

An advertised vacancy creates a clear basis for contact: the employer has published an invitation to apply. A speculative email is unsolicited. If the recipient domain has a general "no unsolicited email" policy, or if the specific recipient did not publish their email as an application address, the email could be considered unsolicited commercial communication.

The PRD marks speculative applications as `auto_send_speculative: false` by default (Section 14.1), which is correct. But the system still supports them, and the prompt (Section 7.2, Rule 11) generates speculative emails. The PRD does not require verification that the target company is actually open to speculative approaches -- for example, many companies explicitly state "no speculative applications" on their careers page.

**Score: 5/10**

**Recommendations:**
1. Add a pre-send check for speculative applications: verify the company does not prohibit unsolicited CVs
2. Require manual recipient email entry for speculative applications (do not auto-detect)
3. Include an opt-out link in speculative emails ("If you do not wish to receive further approaches from me...")
4. Limit speculative applications to 3 per week to minimize exposure

---

**Round 27 -- "The salary fields in task cards could disadvantage the candidate"**

Section 8.2 includes "Current Salary: {candidate_current_salary}" and "Expected Salary: {candidate_expected_salary}" in the task card. The candidate profile (Section 14.1) shows "current_salary": "Negotiable" and "expected_salary": "GBP 70,000 - 80,000".

Pre-filling salary expectations in application forms is a strategic decision, not a data entry task. Salary negotiation depends on role seniority, employer budget, market conditions, and the specific position. A fixed "GBP 70,000 - 80,000" copied into every form anchors the candidate's position regardless of context. A role paying GBP 95,000 will not offer above the candidate's stated expectation. A role paying GBP 65,000 may filter the candidate out as too expensive.

The PRD treats salary as static form data. It should be dynamic, contextual, and often omitted. Many career advisors recommend leaving salary fields blank or writing "Negotiable" on initial applications. The system should not pre-fill a specific number without context.

**Score: 4/10**

**Recommendations:**
1. Default salary fields to "Negotiable" or blank, not to a specific range
2. Add salary context from the job posting (salary_min/max from Module 1) to help the candidate decide
3. For portal task cards, flag salary fields with "REVIEW: consider adjusting based on this role's advertised range of {salary_range}"
4. Never include salary expectations in email applications unless specifically requested by the job posting

---

**Round 28 -- "Referee consent and notification is insufficiently robust"**

Section 18.5 addresses referee consent with three points: confirm consent before first use, remind before academic applications, allow updates. This is a minimum. Under UK GDPR, the candidate sharing referee personal data (name, title, email, phone, organization) with third parties (employers) requires the referee's informed consent.

The system stores referee details in `application_config` and includes them in every portal task card. This means referee details are emailed in plaintext to the candidate repeatedly. If the candidate's email is compromised, the referees' personal data is exposed. There is no mechanism to confirm ongoing consent -- a referee who agreed six months ago may no longer be willing.

For academic applications where referees are contacted pre-interview, the system sends a reminder but does not verify the referee is still available. An outdated referee email address in a university application form could mean the application fails silently when the university cannot reach the referee.

**Score: 4/10**

**Recommendations:**
1. Add referee consent dates and allow per-referee opt-out
2. Prompt the candidate to re-confirm referee availability quarterly
3. For academic applications, auto-send a courtesy notification to referees when the application is submitted
4. Do not include referee phone numbers in emailed task cards -- provide only via secure link

---

**Round 29 -- "No consideration of the Equality Act duty regarding AI-generated content"**

The Equality Act 2010 creates duties around non-discrimination. The PRD addresses this (Section 13.1) by stating the system "must not reference the candidate's age, gender, ethnicity" unless relevant. But the analysis is incomplete.

The AI-generated email body uses the candidate's full name and title. In the UK context, "Selvi Kumar" signals ethnic background. "PhD" and "18 years of experience" signals approximate age. These are inherent to the candidate's identity and cannot be removed. The risk is not that the system adds discriminatory content, but that the system's composition choices might inadvertently emphasize or de-emphasize characteristics in ways that interact with employer bias.

For example, if Claude generates emails that prominently mention the PhD for academic applications but downplay it for corporate roles, this could be a reasonable adaptation. But if the emphasis varies by company type in ways that correlate with protected characteristics of typical hiring managers (e.g., less formal tone for younger companies, more formal for traditional firms), the system is making decisions that interact with discrimination patterns.

This is a subtle point, and no practical system can fully address it. But the PRD should acknowledge it.

**Score: 6/10**

**Recommendations:**
1. Acknowledge the AI bias risk explicitly in the legal section
2. Periodically audit generated emails for systematic differences in tone or emphasis by company type
3. Ensure the Claude prompts do not reference the candidate's personal characteristics beyond professional qualifications
4. Document that the candidate is responsible for reviewing AI-generated content for any discriminatory implications

---

**Round 30 -- "The system may violate LinkedIn's Terms of Service even with manual task cards"**

Section 13.2 states LinkedIn Easy Apply is handled with "manual task cards only, no API calls." But the system still scrapes LinkedIn job data in Module 1 (via email alert parsing and possibly direct URL access). When Module 3 generates a LinkedIn task card, it includes the LinkedIn job URL, job details extracted from the LinkedIn posting, and company information.

LinkedIn's User Agreement (Section 8) prohibits "scraping, data mining, or using automated means to access, collect, or index any data on our services." If Module 1 parses LinkedIn email alerts to extract job data that Module 3 then uses, the combined system's use of LinkedIn data goes beyond what a manual user would do.

The task card itself is fine -- it is just instructions for the candidate. But the pipeline that produces it (automated extraction of LinkedIn job data -> automated scoring -> automated CV tailoring -> automated task card generation) is an automated processing system built on LinkedIn data, which LinkedIn could argue violates their terms even if the final submit step is manual.

**Score: 5/10**

**Recommendations:**
1. Legal review of whether the Module 1-2-3 pipeline's use of LinkedIn email alert data constitutes prohibited automated processing
2. Consider sourcing LinkedIn job data only from jobs.ac.uk or other aggregators that have licensed it
3. Document the argument that email alerts are delivered to the user and her processing of them is her right
4. Limit LinkedIn-sourced data usage to the minimum necessary for the task card

---

#### Persona 3 Summary: UK Employment Law / Recruitment Expert

| Round | Concern | Score |
|-------|---------|-------|
| 21 | AI-generated content as misleading representation | 4 |
| 22 | Per-domain rate limiting misses social detection | 4 |
| 23 | Right to work status handling inaccuracies | 5 |
| 24 | Equality monitoring data should not be stored or pre-filled | 3 |
| 25 | Agency emails create unintended contractual obligations | 3 |
| 26 | Speculative application legal risk | 5 |
| 27 | Pre-filled salary disadvantages the candidate | 4 |
| 28 | Referee consent insufficiently robust | 4 |
| 29 | AI bias and Equality Act implications | 6 |
| 30 | LinkedIn ToS compliance of the full pipeline | 5 |
| **Average** | | **4.3** |

**Top 3 Issues:**
1. Equality monitoring special category data stored and emailed in plaintext (Round 24)
2. Agency emails may create contractual obligations and double-submission risk (Round 25)
3. No tracking of which agencies can represent the candidate to which employers (Round 25)

---

### 20.4 Persona 4: Security & Anti-Fraud Specialist

*Context: Specialist in email security, anti-abuse systems, credential management, and attack surface analysis for automated communication systems.*

---

**Round 31 -- "The approval token scheme is vulnerable to email forwarding attacks"**

The approval token (Section 10.3) is a base64url-encoded JSON payload with an HMAC signature. The token is emailed to the candidate in a clickable URL. If the candidate forwards this email to anyone (advisor, partner, friend) for a second opinion, the recipient gains the ability to approve or reject the application.

The token validates the payload and expiry but does not bind to the recipient. There is no session, no IP check, no device binding. Anyone with the URL can trigger the action. In an email breach scenario (compromised inbox), an attacker could approve all pending applications, injecting content or manipulating the candidate's job search.

The "edit before sending" flow (Section 10.3, step 3) is particularly dangerous: it presents a form pre-filled with the email draft. An attacker could edit the email content before approving, sending a modified application under the candidate's name. The PRD does not mention any content-change validation after editing.

**Score: 3/10**

**Recommendations:**
1. Add a confirmation step: clicking the approval link should require entering a PIN sent to a separate channel (SMS or Telegram)
2. Bind tokens to a session cookie set during the first visit
3. Log the IP address and user-agent of every approval action
4. For the "edit" flow, require re-authentication before allowing content changes

---

**Round 32 -- "Sensitive credentials stored in n8n with no encryption at rest"**

Section C.1 lists environment variables including `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `APPROVAL_SECRET`, and `RESEND_WEBHOOK_SECRET`. These are stored as n8n credentials, which n8n encrypts with its `N8N_ENCRYPTION_KEY`. If that key is weak, default, or stored alongside the encrypted credentials (common in Docker deployments), the protection is nominal.

The PRD does not specify:
- How `N8N_ENCRYPTION_KEY` is generated or managed
- Whether the Postgres database (which stores n8n's credential data) is encrypted at rest
- Whether the Hetzner server's disk is encrypted
- Who has SSH access to the CAX31 server
- Whether there is a secrets management solution (Vault, SOPS, etc.)

The `APPROVAL_SECRET` is particularly sensitive -- it is used to generate approval tokens. If compromised, an attacker can forge approval tokens for any application_id, triggering application sends at will.

**Score: 3/10**

**Recommendations:**
1. Document n8n encryption key management: generation, storage, rotation
2. Enable disk encryption on the Hetzner server
3. Use a secrets manager or at minimum ensure N8N_ENCRYPTION_KEY is injected from a separate secure source, not stored in docker-compose.yml
4. Rotate the APPROVAL_SECRET periodically and invalidate outstanding tokens on rotation

---

**Round 33 -- "The Resend sending domain could be hijacked if DNS is compromised"**

The system sends emails from `selvi@applications.selvikumar.co.uk` (Section 7.4). The domain verification in Resend relies on DNS records (SPF, DKIM, DMARC). If the candidate's DNS provider is compromised (or if the domain registrar account uses weak credentials), an attacker could:

1. Modify the SPF record to authorize additional sending sources
2. Modify the DKIM records to use attacker-controlled keys
3. Send emails from the verified domain that appear to come from the candidate

This is not unique to this system -- it is a general email security risk. But the PRD does not address DNS security as part of the threat model. The custom domain `applications.selvikumar.co.uk` is a subdomain, meaning the parent domain `selvikumar.co.uk` must also be secured. If the parent domain expires or is transferred, the subdomain becomes controllable by whoever registers or acquires the parent.

**Score: 5/10**

**Recommendations:**
1. Use DNSSEC on the sending domain
2. Enable registrar lock on the domain
3. Use 2FA on the domain registrar and DNS provider accounts
4. Add DMARC with `p=reject` and monitoring to detect unauthorized sends

---

**Round 34 -- "Candidate personal data is sent to Claude API in every email composition"**

Section 7.2 shows the email composition prompt includes: candidate name, current title, key qualifications, years of experience, location, email, and phone number. This data is sent to Anthropic's API for every email composition -- approximately 200+ times per month.

The PRD states (Section 18.4) "Anthropic's API does not retain prompts or responses for training (commercial API)" and "no sensitive PII (NI number, DOB, address) is sent to Claude." But name, email, phone, and employer history are PII under UK GDPR. The claim that these are "not sensitive" is incorrect in the GDPR sense -- they are personal data, even if not "special category" data.

Every API call transmits this data over the internet to Anthropic's US-based servers. While in transit encryption (TLS) protects against interception, the data is processed in the US, outside the UK's GDPR jurisdiction. Anthropic's commercial API terms may provide adequate safeguards, but the PRD does not reference the UK-US data adequacy framework or Anthropic's specific data processing agreement.

**Score: 4/10**

**Recommendations:**
1. Minimize PII sent to Claude: use a candidate ID or pseudonym in prompts, inject real name/contact details in post-processing
2. Review Anthropic's data processing terms for UK GDPR compliance (international data transfer safeguards)
3. Correct the PRD's claim that "no PII beyond name/title" is sent -- email and phone are PII
4. Consider whether the candidate profile summary can be sent once and cached, rather than with every prompt

---

**Round 35 -- "No input sanitization on webhook parameters"**

The approval handler (Section 15.5) receives query parameters: `action`, `id`, and `token`. The `id` is a UUID used in a Postgres query: `SELECT * FROM applications WHERE id = {id}`. If this parameter is not properly sanitized, it is a SQL injection vector.

n8n's built-in Postgres node uses parameterized queries by default, which mitigates SQL injection. However, the PRD also uses Code nodes with custom queries (Section 10.2, fuzzy matching queries). If any Code node constructs queries by string concatenation (which is common in n8n Code nodes due to the need for dynamic queries), SQL injection is possible.

The PRD does not specify input validation for webhook parameters. The `action` parameter is used in a Switch node (Node 4 in Section 15.5), and an unexpected value would fall through without handling. The `id` parameter should be validated as a UUID format before database query. The `token` parameter, if malformed, could cause the HMAC validation to throw an unhandled exception.

**Score: 4/10**

**Recommendations:**
1. Add explicit input validation: `id` must match UUID format regex, `action` must be in allowed set, `token` must match expected format
2. Ensure all Code node SQL queries use parameterized queries, not string concatenation
3. Add try-catch around token validation to handle malformed tokens gracefully
4. Return generic error messages to prevent information disclosure (do not expose "invalid token" vs "expired token" distinction to attackers)

---

**Round 36 -- "Email open tracking via Resend creates a deanonymization risk"**

Section 7.7 includes `email.opened` webhook events, and Section 5.6 shows an `opened` state in the state machine. Resend tracks opens using tracking pixels -- invisible images embedded in the email body. This means the application emails contain a tracking pixel that phones home to Resend's servers when the recipient opens the email.

For a job application email, this is ethically questionable and potentially detectable. Some email clients (particularly corporate ones) block tracking pixels. Some show a warning ("This email contains remote content"). A tech-savvy recruiter who notices a tracking pixel in a job application email will view the candidate negatively -- it signals surveillance behavior from an applicant, which is inappropriate in a power-asymmetric relationship.

The PRD states "informational only" for open tracking, but does not make it optional. Resend may insert tracking pixels by default on all emails sent through their platform. If the system cannot disable open tracking, every application email becomes a potential red flag.

**Score: 4/10**

**Recommendations:**
1. Disable open tracking in Resend settings for application emails
2. Send emails as plain text only (no HTML), which eliminates tracking pixel capability
3. If open tracking is desired, make it opt-in and document the risks
4. Remove the `opened` state from the state machine if tracking is disabled

---

**Round 37 -- "The system exposes internal architecture through error responses"**

Section 15.5 specifies returning "403 response" for invalid tokens, "410 response" for expired tokens, and "404" for not-found applications. These HTTP status codes leak information about internal state:

- 403 on an invalid token confirms the endpoint exists and processes tokens
- 410 on expired tokens confirms the application existed but the window passed
- 404 on invalid application IDs confirms the system uses application IDs in that format

An attacker probing the approval endpoint with random UUIDs could enumerate which application IDs exist (404) vs which have expired (410) vs which have wrong tokens (403). Combined with the predictable webhook URLs (Section 17, Round 17), this creates an enumeration surface.

The error handler (Node 5: "Return user-friendly error page") is not specified in detail. If error pages include stack traces, workflow names, or n8n version information, the information disclosure is worse.

**Score: 5/10**

**Recommendations:**
1. Return the same status code (e.g., 400 or 403) for all failure types to prevent enumeration
2. Use generic error pages with no internal information
3. Add rate limiting on the approval endpoint (max 10 requests per IP per hour)
4. Log failed validation attempts for monitoring suspicious probing patterns

---

**Round 38 -- "File path traversal risk in attachment handling"**

Section 15.2, Node 3 reads files from disk using paths stored in the database: `{cv_file_path}` and `{cl_file_path}`. These paths are set by Module 2 and stored in the `jobs` table. If a data integrity issue or injection attack modifies these paths to something like `../../../etc/passwd` or `/data/applications/../../../etc/shadow`, the Read File node would attempt to read and attach arbitrary files.

n8n's Read/Write File node operates with the permissions of the n8n process user. If the process runs as root (common in Docker containers without explicit user configuration), any file on the system is readable. The PRD does not specify that n8n runs as a non-root user, and Dokploy's default Docker configurations may not enforce this.

The risk is that a compromised Module 2 or a database injection could cause Module 3 to exfiltrate sensitive files by attaching them to application emails.

**Score: 4/10**

**Recommendations:**
1. Validate all file paths against an allowed directory prefix (e.g., must start with `/data/generated-cvs/`)
2. Run n8n as a non-root user in the Docker container
3. Use read-only volume mounts for the CV directory in Module 3's context
4. Add file existence and size validation before attempting to attach

---

**Round 39 -- "No audit trail for who triggered what and when"**

The `application_status_history` table (Section 14.1) logs status changes with `changed_by TEXT NOT NULL DEFAULT 'system'`. The valid values are "system, candidate, webhook" -- but there is no authentication model to verify the "candidate" identity. The approval webhook accepts a token but does not identify who used it.

If the candidate shares the approval email or the email is compromised, any actor can trigger approve/reject/edit actions. The audit trail records "candidate" for all webhook-triggered actions, making it impossible to distinguish between the actual candidate and an unauthorized user.

The system also has no access control model. There is no login, no session, no user concept. All system access is through email links with tokens. The database is accessible to anyone who can reach the Postgres port. The n8n interface is accessible to anyone who knows the URL.

**Score: 3/10**

**Recommendations:**
1. Add IP address and user-agent logging for all webhook actions
2. Record the full authentication context (token hash, source IP, timestamp) in the status history
3. Add n8n access control (authentication on the n8n instance)
4. Restrict Postgres to localhost-only connections or use SSH tunneling

---

**Round 40 -- "The deletion script is dangerous and incomplete"**

Section 18.3 provides a deletion function with cascading DELETEs and a commented-out `rm -rf /data/applications/*`. This is a security and reliability concern on multiple levels:

The SQL deletes have no transaction wrapping. If the deletion fails partway through (e.g., after deleting `application_status_history` but before deleting `applications`), the database is left in an inconsistent state with orphaned records.

The `rm -rf` command, even commented out, targets a data directory. If someone uncomments it with incorrect path expansion, it could delete more than intended. The path `/data/applications/*` is relative to the container's filesystem -- if the volume mount is misconfigured, this could affect host data.

There is no "soft delete" option. The deletion is immediate and irreversible. For a system handling career-critical data, accidental deletion (e.g., a mis-click, a script run against the wrong database) with no recovery path is high-risk.

The deletion does not address Resend's records. Emails sent through Resend remain in their system according to their retention policy. The "full deletion" is not actually full.

**Score: 3/10**

**Recommendations:**
1. Wrap all deletion in a transaction
2. Add a soft-delete mechanism (mark as deleted, purge after 30 days)
3. Remove the `rm -rf` from the PRD entirely -- provide a separate, audited filesystem cleanup script
4. Document that Resend retains sent email records and that full deletion requires contacting Resend

---

#### Persona 4 Summary: Security & Anti-Fraud Specialist

| Round | Concern | Score |
|-------|---------|-------|
| 31 | Approval token vulnerable to email forwarding | 3 |
| 32 | Credentials stored with weak encryption at rest | 3 |
| 33 | DNS compromise could hijack sending domain | 5 |
| 34 | PII sent to Claude API on every call | 4 |
| 35 | No input sanitization on webhook parameters | 4 |
| 36 | Email open tracking creates deanonymization/detection risk | 4 |
| 37 | Error responses leak internal state | 5 |
| 38 | File path traversal in attachment handling | 4 |
| 39 | No audit trail or access control model | 3 |
| 40 | Deletion script is dangerous and incomplete | 3 |
| **Average** | | **3.8** |

**Top 3 Issues:**
1. Approval tokens have no recipient binding; forwarded emails grant full control (Round 31)
2. No credential management strategy; APPROVAL_SECRET compromise enables token forgery (Round 32)
3. No access control or identity verification on any system action (Round 39)

---

### 20.5 Persona 5: Privacy & Compliance Officer

*Context: UK GDPR specialist, data protection impact assessment expert, automated decision-making compliance, cross-border data transfer compliance.*

---

**Round 41 -- "No Data Protection Impact Assessment (DPIA) has been conducted"**

Under Article 35 of UK GDPR, a DPIA is required when processing is "likely to result in a high risk to the rights and freedoms of natural persons." This includes systematic, automated processing of personal data, and processing that involves new technologies. This system checks both boxes.

The system automatically processes the candidate's personal data (name, contact details, employment history, qualifications) to generate and send communications to third parties (employers, agencies) without case-by-case human oversight for B-tier applications. This is systematic automated processing that directly affects the candidate's employment prospects -- a high-impact area.

The PRD's privacy section (Section 18) covers data classification, protection measures, and data subject rights, but does not mention a DPIA. Even for a single-user system, if the data controller (the candidate) is also using a data processor (the system, operated by the developer), a DPIA is good practice and may be legally required depending on interpretation.

The absence of a DPIA means there is no formal risk assessment of the automated processing, no documented assessment of necessity and proportionality, and no documented mitigation measures evaluated against identified risks.

**Score: 3/10**

**Recommendations:**
1. Conduct a DPIA before deployment, even a lightweight one
2. Document the lawful basis for each category of processing
3. Assess the necessity and proportionality of B-tier auto-sending vs. the privacy risk
4. Include the DPIA as an appendix to the PRD or as a companion document

---

**Round 42 -- "Automated decision-making under Article 22 may apply to B-tier auto-send"**

UK GDPR Article 22 gives data subjects the right not to be subject to decisions based solely on automated processing that produce legal or similarly significant effects. The candidate has consented to the system, so Article 22(2)(c) (explicit consent) may apply as an exception. But the analysis is not straightforward.

The decision to auto-send a B-tier application is fully automated: Module 1 scores the job, Module 2 tailors the CV, Module 3 detects the method, generates the email, and sends it -- all without human intervention. This automated decision directly affects the candidate's employment prospects. If the system sends a poor-quality email, sends to a scam, or sends at an inappropriate time, the candidate suffers consequences.

The PRD does not acknowledge Article 22 at all. Even though the candidate is both data controller and data subject (an unusual configuration), the automated nature of the processing and its employment-related impact merit analysis. The fact that the candidate configured the system does not automatically mean every individual decision is "consented to" -- consent to a system is not consent to every output.

**Score: 3/10**

**Recommendations:**
1. Add an Article 22 analysis to the legal section
2. Document the explicit consent basis and what it covers
3. Ensure the candidate can challenge or reverse any automated decision (withdraw an auto-sent application is not possible for email)
4. Consider whether B-tier auto-send requires periodic re-confirmation of consent

---

**Round 43 -- "Cross-border data transfer to the US for Claude API processing"**

The system sends personal data (candidate name, title, qualifications, employer history, email, phone) to Anthropic's Claude API. Anthropic is a US-based company. Under UK GDPR Chapter V, transferring personal data outside the UK requires adequate safeguards.

The UK has not issued an adequacy decision for the US at a blanket level (the UK Extension to the EU-US Data Privacy Framework covers certified US companies). The PRD does not document whether Anthropic is certified under this framework, whether Standard Contractual Clauses (SCCs) are in place, or what transfer mechanism is relied upon.

The PRD claims (Section 18.4) "Anthropic's API does not retain prompts or responses for training (commercial API)" -- but retention for training is not the only concern. Processing in the US subjects the data to US law, including potential government access under FISA Section 702. For employment-related personal data, this is a risk that should be documented and assessed.

Similarly, Resend (email delivery) processes email addresses and routes email content through their infrastructure. Resend is also a US-based company. The same transfer analysis applies.

**Score: 3/10**

**Recommendations:**
1. Document the lawful basis for international data transfers to Anthropic and Resend
2. Check whether Anthropic and Resend are certified under the UK-US Data Privacy Framework
3. If not, implement Standard Contractual Clauses or assess supplementary measures
4. Conduct a Transfer Impact Assessment (TIA) for both services

---

**Round 44 -- "Resend processes email content, not just metadata"**

Section 18.4 states: "No candidate PII beyond email addresses passes through Resend's systems (CV content is in attachments, not processed by Resend)." This is incorrect. Resend processes the full email message, including:

- The email body (which contains the candidate's name, qualifications, experience claims, and phone number)
- The email subject line (which contains the candidate's name and job title)
- The attachment binary data (CVs and cover letters pass through Resend's servers for delivery)
- The From, To, and Reply-To headers (which contain multiple email addresses)

Resend is not a transparent relay -- it is an email delivery service that processes, stores (temporarily), and tracks all email content. Their privacy policy governs their retention and use of this data. The PRD's claim that "CV content is in attachments, not processed by Resend" is technically and practically wrong. Email attachments are part of the MIME message that Resend processes for delivery.

This mischaracterization affects the data protection analysis. If the PRD understates what data Resend processes, the privacy risk assessment is based on incorrect assumptions.

**Score: 2/10**

**Recommendations:**
1. Correct the PRD to accurately describe what data Resend processes (full email content including attachments)
2. Review Resend's data processing agreement (DPA) and privacy policy
3. Assess whether Resend's data handling meets UK GDPR processor requirements
4. Consider whether a Data Processing Agreement with Resend is needed (likely yes)

---

**Round 45 -- "Referee data is third-party personal data with insufficient safeguards"**

The system stores referee details: name, title, organization, email, phone, and relationship. These are personal data of third parties (the referees), not the candidate. Under UK GDPR, the candidate (as data controller) must have a lawful basis for processing referee data and must inform the referees of the processing.

Section 18.5 says "the candidate must confirm that each referee has consented." But consent to being named as a reference is not the same as consent to having your data stored in an automated system, emailed in plaintext to the candidate repeatedly, and included in applications to unknown employers. The referees are not informed about the system's nature, its data storage practices, or their rights.

The referee data is stored in the `application_config` table alongside system configuration. There is no separate access control, no retention limit, and no mechanism for referees to exercise their UK GDPR rights (access, rectification, erasure). If a referee requests deletion of their data, the candidate must manually update the config table.

**Score: 3/10**

**Recommendations:**
1. Create a separate `referees` table with consent tracking (date, scope, renewal)
2. Provide referees with a privacy notice explaining how their data is processed
3. Add referee data retention limits (re-confirm every 6 months)
4. Allow referees to exercise data rights independently of the candidate

---

**Round 46 -- "Email content retention of 6 months lacks justification"**

Section 17.5 specifies "Email content (body, subject): 6 months" retention. Section 13.1 states "Application records should be retained for the duration of the job search plus a reasonable period (12 months)." These retention periods are stated without justification.

Under UK GDPR's data minimization principle (Article 5(1)(c)), personal data must be "adequate, relevant and limited to what is necessary." Retention periods must be justified by the purpose. The email body contains the candidate's professional claims, the employer's role details, and the candidate's contact information. Retaining this for 6 months after sending serves what purpose?

The stated purpose is "tracking outcomes and improving the system." But outcome tracking needs only status data (submitted, delivered, interview invite, rejection), not the full email content. System improvement (e.g., analyzing which email styles get better responses) could justify sample retention, not universal retention.

The mismatch between "12 months for records" and "6 months for email content" also creates an inconsistency where the application record exists but the content that was sent has been deleted, making it impossible to verify what was actually communicated.

**Score: 4/10**

**Recommendations:**
1. Justify each retention period against a specific, documented purpose
2. Align retention periods: if you need the email content for dispute resolution, keep it as long as the record
3. Add automated retention enforcement (scheduled deletion of expired content)
4. Document the retention schedule in the DPIA (see Round 41)

---

**Round 47 -- "The data export function does not meet portability requirements"**

Section 18.3 provides a SQL query for data export that produces a JSON blob. Under Article 20 of UK GDPR, the data subject has the right to receive their personal data "in a structured, commonly used and machine-readable format." The export function produces valid JSON, which technically meets this requirement.

However, the export includes system-internal data (dedup hashes, workflow metadata, circuit breaker states via metadata JSONB fields) alongside personal data. A proper data portability export should contain only the data the candidate provided or that was generated about her, not internal system state.

The export also does not include the actual files (CVs, cover letters, supporting statements) -- it includes file paths. A data portability export that says `"cv_file_path": "/data/generated-cvs/abc123_cv.pdf"` without including the file itself is incomplete.

There is no mechanism to trigger the export without direct database access. No API endpoint, no email command, no workflow. The candidate (or the system operator) must run SQL directly, which is not accessible to a non-technical candidate.

**Score: 4/10**

**Recommendations:**
1. Build an export workflow that produces a complete package (JSON + all referenced files in a ZIP)
2. Add a trigger mechanism (email command: reply "EXPORT" to any system email)
3. Filter the export to include only personal data, not system internals
4. Include Resend-side data in the export documentation (note that the candidate must also request data from Resend separately)

---

**Round 48 -- "No consent management for the various processing activities"**

The PRD treats consent as a binary: the candidate uses the system, therefore she consents to all processing. But UK GDPR consent must be specific, informed, and freely given (Article 7). The system performs multiple distinct processing activities:

1. Storing personal data for form pre-filling
2. Sending personal data to Claude API for email generation
3. Sending personal data to Resend for email delivery
4. Sending personal data to employers/agencies (the applications themselves)
5. Tracking email delivery status (including open tracking)
6. Sharing referee data with third parties
7. Processing special category data (equality monitoring)

Each of these activities has different privacy implications and should have separate, specific consent. The candidate should be able to consent to some activities but not others (e.g., consent to email sending but opt out of open tracking; consent to auto-send for B-tier but not agency emails).

There is no consent record, no consent withdrawal mechanism, and no granular control over processing activities.

**Score: 3/10**

**Recommendations:**
1. Create a consent register documenting each processing activity and its legal basis
2. Allow granular consent/withdrawal for specific processing activities
3. Store consent records with timestamps in a `consent_log` table
4. Make consent withdrawal effective (e.g., withdrawing Claude API consent disables email composition but allows manual-only operation)

---

**Round 49 -- "No data breach notification procedure"**

The PRD does not describe what happens in the event of a data breach. Under UK GDPR Articles 33 and 34, a personal data breach must be reported to the ICO within 72 hours if it is likely to result in a risk to rights and freedoms. High-risk breaches must also be communicated to the data subject.

For this system, a data breach could mean:
- Unauthorized access to the Postgres database (exposing all application records, personal data, referee data)
- Compromise of the n8n instance (exposing API credentials, enabling unauthorized email sends)
- Compromise of the sending domain (enabling impersonation)
- Exposure of the application_config data (containing the candidate's full personal details, address, salary, referee information)

The error handling section (Section 17) covers operational errors but not security breaches. There is no incident response plan, no breach notification procedure, no forensic readiness (logging sufficient to investigate a breach), and no process for assessing breach severity.

**Score: 2/10**

**Recommendations:**
1. Add a data breach response procedure to the PRD
2. Define breach severity levels and corresponding notification requirements
3. Ensure logging is sufficient for forensic investigation (retain access logs, authentication logs)
4. Pre-draft ICO notification templates for likely breach scenarios
5. Add intrusion detection or at minimum access logging on the Postgres and n8n instances

---

**Round 50 -- "The system operates as both data controller and data processor without clarity"**

The PRD states (Section 13.1) "The candidate is the data controller for her own personal data." This is technically correct for the candidate's own data. But the system's architecture introduces ambiguity:

- The candidate is the data controller for her personal data and her referees' data
- The system developer/operator is a data processor (processing data on the candidate's behalf)
- Resend is a sub-processor (processing data on behalf of the processor)
- Anthropic is a sub-processor (processing data on behalf of the processor)

The PRD does not establish a data processing agreement between the candidate (controller) and the system operator (processor). If the developer maintains the system, has SSH access to the server, can read the database, and manages the n8n instance, they are a data processor under UK GDPR. This requires:

- A written Data Processing Agreement (Article 28)
- Instructions from the controller (candidate) on how data is to be processed
- Obligations on the processor regarding security, sub-processors, and breach notification
- Audit rights for the controller

None of this is addressed. The legal fiction that the candidate operates the system herself (when in practice the developer builds, maintains, and has full access to it) does not hold under GDPR scrutiny.

**Score: 2/10**

**Recommendations:**
1. Clarify the controller-processor relationship between the candidate and the system operator
2. Draft a Data Processing Agreement if a developer maintains the system
3. Document sub-processor relationships (Resend, Anthropic) with appropriate agreements
4. If the system is truly self-operated by the candidate, document this explicitly and ensure the candidate has exclusive access

---

#### Persona 5 Summary: Privacy & Compliance Officer

| Round | Concern | Score |
|-------|---------|-------|
| 41 | No DPIA conducted | 3 |
| 42 | Article 22 automated decision-making not addressed | 3 |
| 43 | Cross-border data transfer not assessed | 3 |
| 44 | Resend data processing scope mischaracterized | 2 |
| 45 | Referee third-party data insufficient safeguards | 3 |
| 46 | Email content retention lacks justification | 4 |
| 47 | Data export function incomplete and inaccessible | 4 |
| 48 | No granular consent management | 3 |
| 49 | No data breach notification procedure | 2 |
| 50 | Controller-processor relationship undefined | 2 |
| **Average** | | **2.9** |

**Top 3 Issues:**
1. Resend's data processing scope is incorrectly characterized, undermining the privacy analysis (Round 44)
2. No data breach notification procedure exists (Round 49)
3. Controller-processor relationships undefined; no Data Processing Agreements (Round 50)

---

### 20.6 Overall Evaluation Summary

#### Persona Averages

| Persona | Average Score | Verdict |
|---------|--------------|---------|
| 1. The Candidate (Selvi) | 3.6 | Significant concerns about control, visibility, and quality assurance |
| 2. Technical Architect | 4.0 | Solid architecture with notable reliability and security gaps |
| 3. UK Employment Law Expert | 4.3 | Adequate legal awareness but shallow treatment of key areas |
| 4. Security Specialist | 3.8 | Multiple attack surface concerns; no security-by-design |
| 5. Privacy & Compliance Officer | 2.9 | Serious GDPR compliance gaps requiring remediation before launch |
| **Overall Average** | **3.7** | **Below threshold for production deployment without remediation** |

#### Score Distribution

| Score Range | Count | Percentage |
|-------------|-------|------------|
| 1-2 (Critical) | 5 | 10% |
| 3-4 (Significant) | 36 | 72% |
| 5-6 (Moderate) | 9 | 18% |
| 7-10 (Acceptable) | 0 | 0% |

---

### 20.7 Top 10 Must Fix (Before Launch)

| # | Round | Issue | Persona | Score |
|---|-------|-------|---------|-------|
| 1 | 14 | Approval webhook uses GET; email scanners trigger sends | Technical | 2 |
| 2 | 44 | Resend data processing scope mischaracterized in privacy analysis | Privacy | 2 |
| 3 | 49 | No data breach notification procedure | Privacy | 2 |
| 4 | 50 | Controller-processor relationships undefined; no DPAs | Privacy | 2 |
| 5 | 4 | No factual accuracy verification of AI-generated email content | Candidate | 3 |
| 6 | 24 | Equality monitoring special-category data stored and emailed | Legal | 3 |
| 7 | 31 | Approval tokens not recipient-bound; forwarded emails grant control | Security | 3 |
| 8 | 32 | No credential management strategy for API keys and secrets | Security | 3 |
| 9 | 39 | No audit trail, no access control model | Security | 3 |
| 10 | 41 | No Data Protection Impact Assessment conducted | Privacy | 3 |

### 20.8 Top 10 Should Fix (Before Steady State)

| # | Round | Issue | Persona | Score |
|---|-------|-------|---------|-------|
| 1 | 2 | No quick-pause mechanism; offer scenario unhandled | Candidate | 3 |
| 2 | 5 | No scam posting protection for auto-sent applications | Candidate | 3 |
| 3 | 7 | No queue visibility or per-application control | Candidate | 3 |
| 4 | 8 | Agency emails lack relationship awareness | Candidate | 3 |
| 5 | 11 | Circuit breaker state in-process, not shared or persistent | Technical | 3 |
| 6 | 20 | No health check or self-healing for n8n instance | Technical | 3 |
| 7 | 25 | Agency emails create unintended contractual obligations | Legal | 3 |
| 8 | 40 | Deletion script is dangerous and incomplete | Security | 3 |
| 9 | 42 | Article 22 automated decision-making not analyzed | Privacy | 3 |
| 10 | 43 | Cross-border data transfer (US) not assessed | Privacy | 3 |

### 20.9 Top 5 Nice-to-Have (Post-Launch Improvements)

| # | Round | Issue | Persona | Score |
|---|-------|-------|---------|-------|
| 1 | 18 | pg_trgm extension not in schema; similarity() performance at scale | Technical | 6 |
| 2 | 29 | AI bias and Equality Act implications acknowledged but unaudited | Legal | 6 |
| 3 | 10 | Exit strategy and structured data portability | Candidate | 5 |
| 4 | 13 | ARM64 compatibility testing for community nodes | Technical | 5 |
| 5 | 33 | DNS security and DNSSEC for sending domain | Security | 5 |

---

*End of 50-Round Critical Roleplay Evaluation*

*Overall assessment: The PRD demonstrates strong architectural thinking and comprehensive coverage of the application workflow. The email automation design, portal task card system, and module integration are well-conceived. However, the privacy and compliance sections are the weakest area, with several findings that represent genuine regulatory risk. The security model lacks defense-in-depth, and the candidate control mechanisms are insufficient for a system acting autonomously in someone's professional name. Remediation of the Top 10 Must Fix items is recommended before any production deployment.*

---

## 21. 50-Round Critical Roleplay Evaluation (v2)

**Evaluation Date:** 2026-03-29
**Evaluator Model:** Claude Opus 4.6
**Method:** 5 expert personas x 10 rounds each. v2 re-evaluation after fixes from v1 (scored 3.7/10). Focus on REMAINING issues, fix quality, deeper analysis, and edge cases not previously explored.
**v1 Score:** 3.7/10 overall
**Fixes Applied:** Approval webhooks (GET->POST two-step), credential management (Section 5.7), GDPR corrections (Resend data scope, TIA references), breach procedures (soft-delete), equality monitoring (no pre-fill), agency safeguards (authorized_agencies, first-contact hold), scam protection (Check 4), factual accuracy verification (Check 5), candidate controls (multi-channel PAUSE, per-application HOLD/CANCEL, upcoming queue), circuit breaker (Postgres-backed), health checks (Docker + Healthchecks.io), audit trail (IP, user-agent, token_hash), known contacts table, deletion (soft-delete + transactions).

---

### 21.1 Persona 1: The Candidate (Selvi)

*Context: PhD + MBA, 18 years HR/L&D experience, UK-based. 90% manual callback rate. Evaluating whether v2 fixes address control, quality, and reputation concerns.*

---

**Round 1 -- "The factual accuracy check (Check 5) is only as good as the candidate profile JSON"**

v2 adds a factual accuracy verification step (Section 10.1, Check 5) that cross-references claims in generated emails against the candidate master profile JSON. This is a genuine improvement. But the fix quality depends on how comprehensive and current that profile JSON is. The candidate_profile in application_config (Section 14.1) stores a flat JSON: name, email, phone, years_experience (18), highest_education, current_title. It does not contain a structured employment history, specific achievement numbers, team sizes, or budget figures.

When Check 5 tries to verify "I managed a team of 15" or "reduced time-to-competency by 35%", it has no structured data to check against. The profile JSON has "years_experience: 18" but not a list of achievements with quantified results. The check would mark these as "unverified" (not contradicted, not confirmed). The scoring rules say "0 contradictions AND 1+ unverified: WARNING in approval preview" -- so unverified claims generate warnings but do not block B-tier auto-send.

This means the factual accuracy check catches outright contradictions (claiming 25 years when the profile says 18) but cannot catch the more common hallucination pattern: plausible but fabricated specifics. Claude might write "led training programmes across 12 countries" when the real number is 6. The profile JSON has no country count to contradict it.

**Score: 5/10** (up from 3 -- meaningful improvement but incomplete)

**Recommendations:**
1. Extend the candidate_profile JSON to include structured achievements with quantified data points (team sizes, budget figures, country counts, programme participation numbers)
2. For B-tier auto-send, treat "2+ unverified quantified claims" as a blocking condition, not just a warning
3. Add a "verified claims library" -- a curated list of statements that have been reviewed and approved by the candidate, which Claude can draw from

---

**Round 2 -- "The multi-channel PAUSE is better but the PAUSE-via-email-reply parsing is fragile"**

v2 adds multiple pause mechanisms (Section 4.4 US-313): reply PAUSE to any system email, click PAUSE link, Telegram /pause, database flag. The reply PAUSE to any system email is parsed by WF-AP6 (Section 11.4). But the PRD does not specify how this parsing works. Email replies have quoted text, signatures, forwarding headers, and mail client formatting. "PAUSE" buried in a reply chain is not trivially parsable.

Consider: the candidate forwards the daily digest to a friend with "Can you believe this system? I should probably PAUSE it soon." The word PAUSE in the forwarded message body could trigger an unintended pause if the parsing is naive keyword matching on the reply body. Or the candidate replies "Don't PAUSE" -- naive parsing sees PAUSE and triggers it.

The per-application commands (HOLD {id}, CANCEL {id}, BLOCK {company}) have the same parsing fragility. "I thought about cancelling but decided not to CANCEL 7f3a" would be misinterpreted.

The PAUSE link in every email is the most reliable mechanism, but the PRD does not specify whether it requires confirmation (the approval webhook does GET-then-POST, but does PAUSE?).

**Score: 6/10** (up from 3 -- core problem solved, implementation detail needs work)

**Recommendations:**
1. Specify the email reply parsing logic precisely: require the command to appear on the first line of the reply body, not in quoted text
2. Use a prefix convention: "CMD: PAUSE" or "ACTION: HOLD 7f3a" to avoid false positives
3. The PAUSE link should use the same GET-confirmation-then-POST-action pattern as approvals
4. Add a confirmation email after any pause/hold/cancel action: "Your system has been paused. Reply RESUME to restart."

---

**Round 3 -- "The upcoming applications section creates a new time-pressure problem"**

v2 adds an "Upcoming Applications" section to the daily digest (Section 11.4) showing what will be processed in the next 24 hours, with HOLD and BLOCK commands. This directly addresses the v1 concern about queue visibility. But it introduces a new issue: the candidate now receives a daily email listing 5-10 applications that will fire unless she intervenes. This creates daily decision fatigue and a feeling of obligation to review every item.

The morning digest arrives at 7:00 AM. The candidate reads it, sees "Application to PwC (B-tier, email) scheduled for 10:15 AM." She now has 3 hours to decide whether to hold it. If she is in meetings from 8-12, the application fires without review. The upcoming queue creates visibility but not meaningful control, because the window between seeing and acting is narrow.

The digest also lists "To block this company: reply with BLOCK {company}." But blocking a company is a permanent action presented as a casual reply command. There is no unblock mechanism described. If the candidate blocks "NHS" thinking of one specific trust, she might block all NHS-domain applications.

**Score: 6/10** (new concern introduced by the fix, but the fix itself is valuable)

**Recommendations:**
1. Allow configurable lead time: "show upcoming applications 48 hours ahead" so the candidate has a full day to review
2. Add an UNBLOCK command alongside BLOCK
3. BLOCK should require the full company name, not just a keyword, and should confirm: "Blocking all applications to {company}. Reply CONFIRM to proceed."
4. Consider a "review required" flag that the candidate can set per-company, converting all applications to that company to approval-required regardless of tier

---

**Round 4 -- "The known_contacts table improves agency handling but the matching logic is underspecified"**

v2 adds a known_contacts table (Section 14.1) linking email addresses to recruiter names, relationship notes, preferred tone, and agency specialism. Section 7.2 Rule 10 now has conditional prompting for known contacts and agency specialism. Section 13.1 adds authorized_agencies and first-contact hold. This is a substantive improvement.

But the matching logic is email-address-only. If Sarah at Hays emails from sarah.jones@hays.com about one role and another Hays recruiter emails from mike.smith@hays.com about a different role, only the sarah.jones entry matches. The system would treat Mike's role as a first-contact (because mike.smith@hays.com is not in known_contacts), even though the candidate has an established relationship with Hays as an agency.

The authorized_agencies list is described in Section 13.1 but has no corresponding database table or config structure. The known_contacts table has a contact_type field but no "authorized_agency" boolean. The PRD says "The candidate can mark an agency as authorized after establishing terms" but does not specify where this flag lives or how it interacts with the known_contacts table.

**Score: 6/10** (up from 3 -- right structure, needs implementation detail)

**Recommendations:**
1. Add domain-level matching: if any email at @hays.com is in known_contacts with contact_type = 'agency_consultant', treat all @hays.com emails as known agency
2. Add an "authorized" boolean to known_contacts or create a separate authorized_agencies table with domain-level matching
3. Specify how the candidate adds entries to known_contacts (manual SQL? email command? config file?)
4. When a first-contact hold fires, include in the notification: "We found {N} existing contacts at {agency_domain}. Is this the same agency?"

---

**Round 5 -- "B-tier auto-send to agencies still risks unintended representation even with first-contact hold"**

v2 adds first-contact hold for unknown agencies and a disclaimer in agency emails ("Please do not submit my details to any employer without my explicit prior consent"). But once an agency is authorized, B-tier auto-send resumes for that agency. The problem is that authorization to an agency is not the same as authorization for every role that agency handles.

Under Regulation 15 of the Conduct of Employment Agencies Regulations 2003, the agency must get the candidate's consent before submitting them to a specific employer. If the system auto-sends to Hays for a B-tier L&D Manager role at Company X, Hays may interpret this as consent to represent the candidate to Company X. But the candidate might already be in conversation with Company X directly, or might not want Hays to represent her to that specific employer.

The disclaimer helps but is not legally binding on the agency's internal processes. Once Hays has the CV, their internal system may flag the candidate for that role and submit her regardless of the disclaimer, especially if their consultant is under pressure to fill the vacancy.

The double-submission tracking mentioned in Section 13.1 ("the system tracks agency-employer representation to prevent double submissions") has no implementation detail. There is no data structure to record which agency is handling which employer relationship.

**Score: 5/10** (genuine remaining risk even after fix)

**Recommendations:**
1. Add an agency_employer_representation table tracking {agency, employer, role, date} tuples
2. Before auto-sending to any agency, check if the candidate has a direct application or another agency submission to the same employer
3. Consider never auto-sending agency applications regardless of tier -- the contractual implications make human review worthwhile
4. Add a "do not represent me to these employers" list per agency in the known_contacts metadata

---

**Round 6 -- "The scam protection (Check 4) relies on first-contact hold, but this creates friction at scale"**

v2 adds Check 4 (Section 10.1): free email providers held for approval, first-contact domains held for B-tier, scam_risk_score checked, known employer whitelist that grows over time. This is a good layered approach.

But the first-contact hold means that during the first weeks of operation, nearly every B-tier email application is held for approval (because no domains are whitelisted yet). The known employer whitelist "grows over time as domains that have previously resulted in delivered emails with no bounce/complaint are added." This means the candidate must manually approve 20-30 B-tier applications before the whitelist builds enough coverage to enable true auto-send.

During this ramp period, the system behaves like a "all applications need approval" system, defeating the purpose of B-tier auto-send. The daily approval queue could have 5-10 items, each requiring the candidate to verify the employer domain is legitimate. This is the same review burden the system was designed to eliminate.

After 4-6 weeks, the whitelist should cover most common employer and agency domains, and the friction drops. But the PRD does not acknowledge this cold-start problem or provide a mechanism to seed the whitelist (e.g., importing known employers from Module 1's historical data).

**Score: 6/10** (correct design, cold-start UX problem)

**Recommendations:**
1. Seed the known employer whitelist from Module 1's existing job data: any domain that has appeared in 3+ legitimate job postings is pre-whitelisted
2. Allow bulk domain approval: "approve all pending applications from .ac.uk, .nhs.uk, .gov.uk domains"
3. During the first 2 weeks, batch first-contact approvals into the daily digest rather than individual notifications
4. Add a "trust this domain for all future applications" checkbox in the approval flow

---

**Round 7 -- "The email signature exposes the candidate's phone number to every automated recipient"**

The email_config in Section 14.1 includes a signature with "+44 xxxx xxxxxx". This phone number is sent in every auto-sent B-tier application email. For legitimate applications, this is standard practice. But combined with the scam risk (even with Check 4), every email that reaches an illegitimate recipient exposes the candidate's phone number.

More practically, the phone number in the signature means the candidate could receive unsolicited calls from recruiters and employers at any time. With 20-40 applications per week, the candidate's phone becomes a high-volume inbound channel. There is no mechanism to use a different phone number for automated applications (e.g., a Google Voice or VoIP number) vs. the personal number used for A-tier high-value communications.

The email composition prompt (Section 7.2, Rule 8) says "Close with availability for a call or interview. Include phone number." This means Claude also puts the phone number in the email body, in addition to the signature. The phone number appears twice in every application email.

**Score: 5/10** (not a v2 regression, but an unaddressed v1 concern)

**Recommendations:**
1. Allow separate phone numbers for automated vs. manual applications in the candidate_profile
2. Remove the phone number from the Claude prompt instruction -- let the signature handle it
3. Consider using a forwarding number for B-tier applications that can be disabled if spam calls increase
4. Add a note in the prompt: "Do NOT include the phone number in the email body; it is in the signature"

---

**Round 8 -- "The 'edit before sending' flow for A-tier applications lacks content validation boundaries"**

Section 10.3 describes the edit flow: the candidate can modify the email body via an n8n Form Trigger before approving. v2 adds "content changes are validated against the candidate profile before send." But the validation boundaries are unclear. Can the candidate add a claim not in the profile? Can she change the tone entirely? Can she paste in a completely different email?

If the factual accuracy check (Check 5) runs on the edited content, it would flag new claims as "unverified." But the candidate is the one adding them -- she presumably knows her own experience. Blocking a candidate's own edits because they are "unverified against the profile" is counterproductive.

The edit flow also has a security concern raised in v1 (Round 31): if the approval email is forwarded, anyone with the link can edit the email content. v2 adds single-use tokens, which helps -- but the edit form itself is a separate flow that "requires re-validating the token before submission." If the token is single-use and was consumed by loading the confirmation page (GET), can it be reused for the edit form submission (POST)?

The interaction between single-use token consumption and the edit flow is ambiguous. Does loading the GET confirmation page consume the token? Or does only the POST action consume it? If GET consumes it, the edit flow cannot work (the token is already consumed before the edit form loads).

**Score: 5/10** (fix introduced new ambiguity)

**Recommendations:**
1. Clarify token consumption: the GET request should NOT consume the token; only the POST action (approve, reject, or edit-submit) consumes it
2. For edited content, skip the factual accuracy check against the profile (the candidate is the authority) but keep the banned phrases and word count checks
3. Add a diff view showing what the candidate changed, stored in the audit trail
4. Rate-limit edit form submissions to prevent abuse if the token is leaked

---

**Round 9 -- "The shadow mode / quality sampling for B-tier emails is still absent"**

v1 Round 1 recommended a "shadow mode" for the first 2-4 weeks and weekly B-tier email quality sampling. v2 does not add either mechanism. The quality gate now has factual accuracy checking, which is a separate improvement, but the candidate still has no way to see what B-tier emails look like after the system is operational.

The Phase 7 rollout (Section 19.2) includes "Start with B-tier email applications only" and "Monitor first 20 applications closely for quality." This is a one-time launch activity, not an ongoing quality assurance process. After the first 20 are reviewed and deemed acceptable, the system runs indefinitely without the candidate seeing B-tier output.

Email composition quality can drift over time as Claude model versions change, as the prompt interacts with different job descriptions, or as the candidate's profile evolves. A prompt that works well for corporate L&D roles might produce awkward emails for academic positions. Without periodic sampling, the candidate has no feedback loop on the quality of what is being sent in her name.

**Score: 4/10** (not addressed in v2)

**Recommendations:**
1. Add a weekly quality sample: randomly select 3 B-tier emails from the past week and include them in the weekly report for review
2. Add a "quality score" tracked over time: banned phrase near-misses, word count distribution, readability score
3. Allow the candidate to rate sampled emails (thumbs up/down) to build a feedback dataset
4. Add a configurable "shadow mode" that can be re-enabled at any time (all B-tier emails held for review for N days)

---

**Round 10 -- "The system has no graceful degradation when Module 2 produces poor quality output"**

The factual accuracy check validates email content against the candidate profile, but it does not validate the quality of Module 2's output (the tailored CV and cover letter). If Module 2 produces a poorly tailored CV -- wrong emphasis, inappropriate formatting, or a cover letter that mismatches the role -- Module 3 dutifully attaches it and sends it.

For A-tier applications, the candidate sees the email preview but does not see the attached CV content in the approval notification (Section 10.4). The approval email shows the email body, subject line, and attachment filenames, but not the CV or cover letter content. The candidate approves the email without reviewing what is actually attached.

For B-tier auto-send, neither the email nor the attachments are reviewed. A systematic error in Module 2 (e.g., a template issue that puts the wrong name on cover letters, or a formatting bug that corrupts PDF rendering) could affect dozens of applications before being noticed.

**Score: 4/10** (cross-module quality gap not addressed)

**Recommendations:**
1. Add a Module 2 output validation step: verify PDF renders correctly (page count > 0, file size within expected range), verify cover letter text references the correct company and role
2. For A-tier approval notifications, include the first paragraph of the cover letter text in the preview
3. Add a periodic Module 2 output audit: compare a sample of tailored CVs against the master CV to detect systematic issues
4. If Module 2 error rate exceeds a threshold (e.g., 3 failures in a day), pause Module 3 and alert

---

#### Persona 1 Summary (v2): The Candidate (Selvi)

| Round | Concern | Score | v1 Score | Delta |
|-------|---------|-------|----------|-------|
| 1 | Factual accuracy check limited by thin profile JSON | 5 | 3 | +2 |
| 2 | PAUSE-via-email-reply parsing fragility | 6 | 3 | +3 |
| 3 | Upcoming queue creates new time-pressure / BLOCK is irreversible | 6 | 3 | +3 |
| 4 | Known contacts matching is email-only, not domain-level | 6 | 3 | +3 |
| 5 | Agency auto-send still risks unintended representation | 5 | 3 | +2 |
| 6 | First-contact hold creates cold-start friction | 6 | 3 | +3 |
| 7 | Phone number exposed to every automated recipient | 5 | N/A | new |
| 8 | Edit flow token consumption ambiguity | 5 | N/A | new |
| 9 | No ongoing B-tier email quality sampling | 4 | 4 | 0 |
| 10 | No validation of Module 2 output quality | 4 | N/A | new |
| **Average** | | **5.2** | **3.6** | **+1.6** |

**Top 3 Remaining Issues:**
1. No ongoing quality sampling of B-tier emails after initial launch period (Round 9)
2. No validation of Module 2 attachment quality before sending (Round 10)
3. Agency auto-send risks remain even with authorized_agencies framework (Round 5)

---

### 21.2 Persona 2: Technical Architect / n8n Expert

*Context: Evaluating whether v2 fixes for circuit breaker, health checks, webhook security, and concurrency are sufficient. Looking for new issues.*

---

**Round 11 -- "The Postgres-backed circuit breaker adds database dependency to the failure path"**

v2 moves circuit breaker state to Postgres (Section 17.2), which fixes the n8n restart and cross-workflow visibility problems from v1. But it introduces a new issue: the circuit breaker now depends on Postgres being available. If Postgres is the failing service, the circuit breaker check itself fails.

The circuit breaker code queries Postgres before every external API call. If Postgres is down or slow, the circuit breaker check either fails (throwing an error that cascades into the workflow) or times out (adding latency to every API call). The code does not show any fallback behavior for "cannot reach circuit breaker state."

The circuit breaker table also has a race condition: if two workflow executions fail simultaneously and both call `recordFailure()`, they both read the same `failure_count`, both increment, and both write. With Postgres's default READ COMMITTED isolation, the final count could be N+1 instead of N+2. This means the circuit breaker may trip one failure later than intended. At 5 failures to trip, this is a minor issue. But it reveals that the Postgres-backed approach was not designed for concurrent access.

**Score: 6/10** (up from 3 -- core problem solved, edge case remains)

**Recommendations:**
1. Add a fallback in the circuit breaker check: if the Postgres query fails, assume the circuit is closed (fail-open) and proceed with the API call
2. Use `UPDATE ... SET failure_count = failure_count + 1` (atomic increment) instead of read-then-write
3. Add a statement_timeout on circuit breaker queries (500ms) so they do not block the workflow if Postgres is slow
4. Consider an in-memory cache (n8n static data) as a fast path with Postgres as the persistence layer, rather than querying Postgres on every call

---

**Round 12 -- "The two-step approval webhook introduces a TOCTOU vulnerability"**

v2 changes the approval flow to GET (confirmation page) then POST (execute action). The GET request validates the token and loads application data. The POST request re-validates the token, checks single-use, and executes. But between the GET and POST, the application state could change.

Scenario: the candidate loads the confirmation page (GET) at 11:00 AM. The page shows "Application to Deloitte -- Head of L&D." She goes to lunch. At 12:00 PM, the maintenance cron (WF-AP6) runs and expires the application because the token_expires_at was set to 11:30 AM. At 12:30 PM, the candidate returns and clicks "Confirm & Send" (POST).

The POST re-validates the token -- but the token was already expired at 11:30 AM. The token check catches this. But what if the application status changed for a different reason? What if someone sent a CANCEL command via the daily digest? The POST checks `status = 'pending_approval'` (Node 2 in Section 15.5), which would catch a cancelled application. But the confirmation page the candidate is looking at shows stale data. She sees "Approve this application" but the application no longer exists in that state.

The confirmation page should include the current state and a freshness token, or the POST should return a clear message: "This application was cancelled/expired since you loaded this page."

**Score: 6/10** (good fix, minor TOCTOU gap)

**Recommendations:**
1. Include a state timestamp in the confirmation page form as a hidden field
2. On POST, verify the state has not changed since the page was loaded (compare timestamps)
3. If state changed, show the candidate what happened and offer alternatives
4. Add a client-side auto-refresh on the confirmation page (every 5 minutes) to keep data fresh

---

**Round 13 -- "The SplitInBatches node with batch size 1 serializes all processing unnecessarily"**

Section 15.1 (WF-AP1) uses SplitInBatches with batch size 1 to process up to 10 ready jobs sequentially. Each job goes through method detection (Code node), optional AI analysis (Claude API call), record creation (Postgres INSERT), and routing (Execute Workflow to WF-AP2 or WF-AP3).

For portal applications (WF-AP3), the processing is fast (10-20 seconds, no rate limiting). But the serial processing means a portal application at position 8 in the batch waits for positions 1-7 to complete, even though portal processing has no dependency on the previous items and no rate limiting concern.

The serial processing also means that if position 3 fails (e.g., Claude API timeout during method detection), the behavior depends on n8n's error handling configuration. With "Continue On Fail" disabled (the default), positions 4-10 are never processed. With it enabled, the error might pollute downstream data.

For a 10-item batch with 3 email applications (each taking 5-15 seconds for Claude composition) and 7 portal applications (each taking 10-20 seconds), total serial processing time is 2-4 minutes. This is fine for a 15-minute cron cycle, but during backlog processing (Monday morning burst), the serial approach means the system processes 40 jobs per hour maximum. With 30+ in the queue and new arrivals, the backlog grows.

**Score: 5/10** (not addressed in v2, moderate impact)

**Recommendations:**
1. Split processing into two parallel branches: email applications (serial, rate-limited) and portal applications (parallel batch)
2. Use n8n's Execute Workflow node with "Wait for Sub-Workflow" = false for portal preparations (fire-and-forget since they have no rate limit)
3. Increase the LIMIT from 10 to 20 for portal-type applications since they do not consume sending rate limits
4. Add execution time tracking per batch to identify bottlenecks

---

**Round 14 -- "The email composer retry logic should use post-processing, not regeneration"**

v1 Round 16 recommended fixing banned phrases via regex post-processing instead of regenerating the entire email. The PRD (Section 10.1, Check 3) now includes "Apply regex-based post-processing to fix banned phrases" as the first step, then "IF structural issues remain: REGENERATE with corrective prompt." This is the correct approach.

However, the implementation detail is still thin. What does "regex-based post-processing" look like for banned phrases? Some are easy ("I am writing to express my interest" -> delete the sentence). Others are contextual ("passionate about" -> what replaces it? The replacement depends on the sentence context). A regex that replaces "passionate about learning and development" with nothing leaves a grammatically broken sentence.

The UK English validation ("spot check: organisation not organization, programme not program") is done as a regex check but the fix is regeneration. A simple find-and-replace (organization -> organisation) would be faster, cheaper, and more reliable than asking Claude to regenerate. But the PRD does not specify this obvious post-processing step.

The max 2 regeneration attempts means a worst case of 3 Claude API calls per email. With Sonnet for A-tier (~$0.015 per call) and Haiku for B-tier (~$0.001 per call), the cost is manageable. But each regeneration adds 5-15 seconds of latency to the pipeline.

**Score: 6/10** (up from 5 -- correct approach, needs more specificity)

**Recommendations:**
1. Specify the regex post-processing rules precisely: for each banned phrase, define the replacement strategy (delete sentence, replace word, restructure)
2. Add US->UK English find-and-replace as a post-processing step before validation, not as a regeneration trigger
3. Track regeneration frequency as a metric: if > 10% of emails need regeneration, the base prompt needs tuning
4. Add the post-processing as a separate Code node (not embedded in the validation check) for maintainability

---

**Round 15 -- "The Resend webhook signature validation has a timing vulnerability"**

Section 7.7 shows the webhook signature validation code. The comparison uses `===` (strict equality) on the computed vs received signature. This is a string comparison that returns on the first non-matching character, making it vulnerable to timing attacks. An attacker who can measure response times with sufficient precision can determine the correct signature one character at a time.

Practically, this attack requires sending thousands of requests with microsecond timing measurements, which is difficult over the internet. The n8n workflow execution overhead (~100ms variance) provides natural timing noise. So the real-world exploitability is low.

But the fix is trivial: use `crypto.timingSafeEqual()` instead of `===`. This is standard practice for HMAC validation and has no performance cost. The PRD should use it as a matter of good engineering hygiene.

The approval token validation (Section 10.3) has the same pattern: `if (signature !== expectedSig)` uses `!==` instead of `timingSafeEqual`.

**Score: 6/10** (low practical risk, trivial fix)

**Recommendations:**
1. Replace all signature comparisons with `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
2. This applies to both the Resend webhook validation and the approval token validation
3. Add this as a code review checklist item for any future HMAC validation

---

**Round 16 -- "The startup recovery procedure could cause duplicate sends after a crash"**

v2 adds startup recovery in Section 17.6: "Re-queue any applications that were mid-processing when the container stopped." If n8n crashes after the Resend API accepted an email (Step 7 in WF-AP2) but before the database status was updated to 'submitted' (Step 8), the application record is still in 'auto_approved' or 'approved' status.

On restart, the recovery procedure sees this application in a processing state and re-queues it. WF-AP1 picks it up, WF-AP2 runs again, and sends the email a second time. The quality gate's dedup check (Check 1) queries for existing applications with the same company and title -- but this IS the same application record, not a new one. The dedup check looks for OTHER application records, not the current one.

The result: the employer or agency receives the same application email twice. This is embarrassing and damages the candidate's professional image. The duplicate was caused by a system crash, not by the candidate applying twice.

The Resend message_id (stored after sending) would be null for the un-updated record, so there is no way to check with Resend whether the email was already sent. The only protection would be checking the Resend API for recent sends to the same recipient, which is not part of the recovery procedure.

**Score: 4/10** (new issue introduced by the startup recovery fix)

**Recommendations:**
1. Add a `last_send_attempt_at` timestamp updated BEFORE calling the Resend API (optimistic lock)
2. On recovery, if `last_send_attempt_at` is within the last hour and status is still 'auto_approved', check Resend's API for recent sends to that recipient before re-sending
3. Add an idempotency key to the Resend API call (Resend supports this via the `idempotency_key` parameter) -- use the application_id as the key
4. Recovery should set suspicious mid-processing applications to 'needs_review' rather than blindly re-queuing

---

**Round 17 -- "The WF-AP1 query has a performance problem with the NOT IN subquery"**

Section 15.1, Node 3 uses:
```sql
AND j.id NOT IN (
    SELECT job_id FROM applications
    WHERE status NOT IN ('failed', 'expired', 'withdrawn')
)
```

This is a correlated NOT IN subquery that scans the applications table for every row in the jobs table. As the applications table grows (400+ records in 90 days, thousands over a year), this becomes increasingly expensive. Worse, if any `job_id` in the applications table is NULL (possible if the schema allows it, though the NOT NULL constraint prevents this), the NOT IN returns no rows at all -- a subtle PostgreSQL behavior that has burned many developers.

The query also does not benefit from the indexes. `idx_applications_job_id` helps the subquery, but the NOT IN anti-join pattern is less efficient than a LEFT JOIN / IS NULL pattern or NOT EXISTS. PostgreSQL's query planner may or may not optimize this well depending on table statistics.

The query runs every 15 minutes. At current scale it is fast (<100ms). At year-end scale (2000+ applications, 5000+ jobs), it could become noticeable, especially when competing with other queries during the same 15-minute cycle.

**Score: 6/10** (works now, degrades at scale)

**Recommendations:**
1. Rewrite as NOT EXISTS: `AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.status NOT IN ('failed', 'expired', 'withdrawn'))`
2. Or use a LEFT JOIN anti-pattern: `LEFT JOIN applications a ON a.job_id = j.id AND a.status NOT IN (...) WHERE a.id IS NULL`
3. Add a composite index: `CREATE INDEX idx_applications_job_status ON applications(job_id, status)`
4. Consider adding a `has_active_application` boolean column to the jobs table, maintained by trigger, to avoid the join entirely

---

**Round 18 -- "The trigger-based audit logging passes audit data through the metadata JSONB column, which is error-prone"**

v2 adds audit fields to application_status_history (source_ip, user_agent, token_hash) and the trigger function reads these from `NEW.metadata`. The workflow code must set `metadata->>'source_ip'`, `metadata->>'user_agent'`, and `metadata->>'token_hash'` before updating the status. The trigger then extracts and copies them.

This pattern is fragile. The metadata JSONB column is used for general-purpose metadata throughout the application. If a workflow sets `metadata = '{"some_other_key": "value"}'` without including the audit fields, the trigger writes NULLs for source_ip, user_agent, and token_hash. There is no validation that the audit fields are present when the status change comes from a webhook action.

The trigger also casts `(NEW.metadata->>'source_ip')::INET`. If the workflow stores an invalid IP string in metadata (e.g., "unknown" or an IPv6 address with a format the INET type does not expect), the trigger throws an exception, which rolls back the entire status update. A malformed IP address in the metadata field would prevent the application from changing state.

Additionally, the `changed_by` field defaults to 'system' and is overridden by `COALESCE(NEW.metadata->>'changed_by', 'system')`. This means the workflow must remember to set metadata->>'changed_by' = 'candidate' for webhook-initiated changes. If it forgets, the audit trail incorrectly attributes the action to 'system'.

**Score: 5/10** (right idea, fragile implementation)

**Recommendations:**
1. Use separate columns for audit data instead of the metadata JSONB: add `_audit_source_ip`, `_audit_user_agent`, `_audit_changed_by` as actual columns on the applications table (can be nullable, only populated for webhook actions)
2. Or use a SET LOCAL variable approach: `SET LOCAL app.audit_source_ip = '1.2.3.4'` and read it in the trigger with `current_setting('app.audit_source_ip', true)`
3. Add a try-catch around the INET cast in the trigger to handle invalid IP formats gracefully
4. Add a CHECK constraint or validation function for the metadata JSONB structure

---

**Round 19 -- "No database migration strategy for schema changes"**

The PRD defines the database schema in Section 14.1 as CREATE TABLE statements. Section 14.2 uses ALTER TABLE to add columns to the existing jobs table. But there is no migration framework. When the schema needs to change (add a column, modify a constraint, update a trigger function), how is the change applied?

For a single-server deployment with one database, manual SQL is viable initially. But the PRD is v2 with schema changes already applied (new columns like approval_token_consumed_at, audit fields in application_status_history). The transition from v1 schema to v2 schema is not documented. If someone deployed v1 and now needs v2, they would need to diff the schemas and apply ALTER statements manually.

n8n workflows also embed SQL queries that reference specific columns. If a column is renamed or a table restructured, every workflow that references it must be updated. The PRD does not track which workflows depend on which schema elements.

**Score: 5/10** (normal for a PRD at this stage, but notable gap)

**Recommendations:**
1. Adopt a migration tool (dbmate, golang-migrate, or simple numbered SQL files) for schema changes
2. Document the v1-to-v2 migration as a set of ALTER statements
3. Create a schema dependency map: which workflows reference which tables and columns
4. Version the schema alongside the PRD version

---

**Round 20 -- "The n8n Form Trigger for the edit flow is underspecified and may not support the required UX"**

Section 15.5 says the edit flow uses "n8n Form Trigger" for the candidate to modify email content before sending. n8n's Form Trigger creates a basic web form. The PRD expects it to:
- Pre-fill with the draft email subject and body
- Validate content changes against the candidate profile
- Show a diff of what changed
- Re-validate the token

n8n's built-in Form Trigger supports text inputs, dropdowns, and basic validation. It does not natively support:
- Pre-filling from dynamic data (the form fields are static in the workflow definition)
- Complex validation logic (fact-checking against a database)
- Diff display
- Multi-step forms (edit, then confirm, then send)

The PRD assumes capabilities that may exceed what n8n's Form Trigger provides without custom development. The "Respond to Webhook" node can return custom HTML, but then the entire form UX must be hand-coded in HTML/JavaScript within a Code node. This is doable but represents significant implementation effort not captured in the rollout plan.

**Score: 5/10** (implementation feasibility concern)

**Recommendations:**
1. Prototype the edit form using n8n's actual Form Trigger to verify capabilities before committing to this design
2. If Form Trigger is insufficient, use a custom HTML page served by the Respond to Webhook node
3. Consider a simpler alternative: the candidate replies to the approval email with edits, and the system parses the reply
4. Add the edit flow to Phase 4 scope (not "optional, post-MVP") since it is referenced in the main approval flow

---

#### Persona 2 Summary (v2): Technical Architect / n8n Expert

| Round | Concern | Score | v1 Score | Delta |
|-------|---------|-------|----------|-------|
| 11 | Postgres-backed circuit breaker fails if Postgres is down | 6 | 3 | +3 |
| 12 | TOCTOU between GET confirmation and POST action | 6 | 2 | +4 |
| 13 | SplitInBatches serializes portal processing unnecessarily | 5 | 4 | +1 |
| 14 | Email composer post-processing rules underspecified | 6 | 5 | +1 |
| 15 | Webhook HMAC comparison vulnerable to timing attack | 6 | 4 | +2 |
| 16 | Startup recovery can cause duplicate email sends | 4 | 3 | +1 |
| 17 | NOT IN subquery degrades at scale | 6 | N/A | new |
| 18 | Audit logging via metadata JSONB is fragile | 5 | 3 | +2 |
| 19 | No database migration strategy | 5 | N/A | new |
| 20 | n8n Form Trigger may not support required edit UX | 5 | N/A | new |
| **Average** | | **5.4** | **4.0** | **+1.4** |

**Top 3 Remaining Issues:**
1. Startup recovery can cause duplicate email sends after a crash (Round 16)
2. Serial batch processing creates bottleneck during backlog periods (Round 13)
3. Audit logging pattern using metadata JSONB is fragile and error-prone (Round 18)

---

### 21.3 Persona 3: UK Employment Law / Recruitment Expert

*Context: Evaluating whether v2 fixes for agency safeguards, equality monitoring, and contractual risks are sufficient. Looking for remaining legal gaps.*

---

**Round 21 -- "The agency disclaimer is helpful but legally insufficient for Regulation 15 compliance"**

v2 adds a disclaimer to all agency emails: "Please do not submit my details to any employer without my explicit prior consent for each specific role." This addresses the v1 concern about unintended representation. But the disclaimer is a unilateral statement by the candidate, not a contractual agreement. Under the Conduct of Employment Agencies Regulations 2003, Regulation 15(a) requires the agency to obtain the candidate's consent before introducing them to a hirer. The obligation is on the agency, not on the candidate.

The disclaimer tells the agency what the candidate wants but does not create a legal obligation. Many agencies' standard terms of business (which they issue when registering a candidate) include blanket consent to submit CVs. By sending a CV to the agency, the candidate may be implicitly accepting those terms, which override the email disclaimer.

More practically, if the agency's consultant is under pressure to fill a vacancy and the candidate's CV is a good match, the consultant may submit first and ask questions later. The disclaimer is a speed bump, not a barrier. The candidate has no visibility into when or whether the agency submits her CV.

The "authorized_agencies" concept helps by distinguishing agencies the candidate has formal relationships with from first-contact agencies. But even for authorized agencies, the per-employer consent requirement remains.

**Score: 5/10** (up from 3 -- meaningful improvement, fundamental limitation acknowledged)

**Recommendations:**
1. Add a guidance note in the agency email section: "The candidate should establish formal terms with each agency independently of this system"
2. Track agency interactions: when the candidate confirms an agency has submitted her to an employer, record it in the agency_employer_representation data
3. Consider adding "Representation tracking" as a future module requirement
4. Include in the weekly report: "You have sent CVs to {N} agencies this week. Ensure you have terms in place with each."

---

**Round 22 -- "The equality monitoring section is improved but the Disability Confident guidance is risky"**

v2 removes pre-filled equality monitoring data and replaces it with a reminder: "Do NOT pre-fill these responses. Complete them directly on the portal at the time of application." This is correct. But v2 also adds: "NOTE: This employer is a Disability Confident employer. Declaring a disability may guarantee you an interview under the Disability Confident scheme if you meet the essential criteria."

This guidance is factually correct but procedurally risky. The system is making a recommendation about disclosing a protected characteristic. If the system gets the Disability Confident status wrong (e.g., the employer's certification lapsed, or Module 1 misidentified the status), the candidate may disclose a disability to an employer that does not offer the guaranteed interview scheme. The disclosure cannot be undone.

The system also has no way to know whether the candidate has a disability. Including the Disability Confident note implies the candidate should consider disclosing, which is a sensitive personal decision that should not be influenced by an automated system. If the candidate does not have a disability, the note is irrelevant and potentially confusing.

**Score: 6/10** (up from 3 -- major improvement, minor residual concern)

**Recommendations:**
1. Rephrase the Disability Confident note as purely informational: "This employer is listed as Disability Confident. For information about this scheme, see [GOV.UK link]."
2. Do not recommend or suggest any action regarding disability disclosure
3. Verify Disability Confident status from an authoritative source (GOV.UK employer list) rather than Module 1 metadata
4. Make the Disability Confident note configurable -- the candidate should be able to suppress it if not relevant

---

**Round 23 -- "The system's handling of closing dates creates a risk of applying to expired roles"**

The PRD mentions closing dates in passing (Section 6.5: "closing_date" in Module 1 metadata) but does not use them systematically. The task card (Section 8.2) shows "EXPIRES: {job_expires_at or 'Unknown'}" but the system does not check whether a job has expired before sending an application.

If Module 1 discovers a job on Monday with a Friday closing date, Module 2 tailors on Tuesday, and Module 3's queue processes it on Saturday due to rate limiting, the application is sent after the closing date. For email applications, the email arrives at the employer after the role has closed. For portal applications, the task card instructs the candidate to apply but the portal may have closed.

Applying to expired roles wastes the candidate's effort (for portal applications) and sends a negative signal to employers (for email applications). An email arriving after the closing date looks like the candidate is disorganized or did not read the posting carefully.

The auto-expiry for manual tasks (Section 15.6, Node M3: expire after 7 days) partially addresses this, but 7 days is too long if the job closes in 3 days.

**Score: 5/10** (unaddressed systematic issue)

**Recommendations:**
1. Add closing_date as a first-class field in the quality gate: if closing_date < NOW(), block the application
2. For task cards, compare closing_date with the task card generation date and warn if < 48 hours remaining
3. Prioritize applications with imminent closing dates in the queue ordering (process closing-soon roles first)
4. If closing_date is unknown, default to 14 days from posting date (standard UK job advertising period)

---

**Round 24 -- "The salary handling in task cards is improved but the email composition prompt still includes salary context"**

v1 Round 27 flagged pre-filled salary as problematic. v2 does not appear to have changed the salary handling in task cards or the candidate_profile configuration. The expected_salary field still shows "GBP 70,000 - 80,000" and is included in the task card personal details section.

However, the email composition prompt (Section 7.2) does not explicitly include salary information -- it references "key_qualifications" and "application_context" but not salary. This is good; salary should not appear in application emails. But the candidate_profile JSON (Section 14.1) includes expected_salary, and if this JSON is passed as part of the candidate profile to Claude, the model might incorporate it into the email.

For task cards, the LinkedIn screening questions section (Section 9.2) includes "Expected salary: {expected_salary_range}." This is appropriate for LinkedIn Easy Apply where salary expectation is often a required screening question. But for other portals, the salary field should be marked as "review and adjust per role" rather than pre-filled with a static number.

**Score: 5/10** (partially addressed by prompt structure, needs explicit handling)

**Recommendations:**
1. Exclude expected_salary from the candidate profile data sent to Claude for email composition
2. In task cards, flag the salary field: "REVIEW: The advertised salary for this role is {job_salary_range}. Adjust your expectation accordingly."
3. If the job's advertised salary is significantly different from the candidate's default (>20% above or below), highlight this in the task card
4. For portal task cards, default salary fields to "Negotiable" unless the portal specifically requires a number

---

**Round 25 -- "The system sends emails during school holiday periods without adjustment"**

The rate limiting (Section 12.1) respects quiet hours (10 PM - 7 AM) and disables Sunday sends. But there is no awareness of UK school holidays, bank holidays, or seasonal patterns. L&D and HR departments in the UK typically have reduced staffing during:
- Christmas/New Year (approximately Dec 20 - Jan 3)
- Easter week
- August (summer holidays)
- Bank holiday weekends (May, August)

Applications sent during these periods are more likely to be lost in inboxes, less likely to receive timely responses, and contribute to the "no_response" rate without reflecting poorly on the application quality. The system's callback rate metrics would be artificially depressed by holiday-period applications.

More strategically, some employers freeze hiring during budget cycles (March/April for UK fiscal year). Applications sent during a hiring freeze are wasted effort.

**Score: 5/10** (not addressed, moderate impact on effectiveness metrics)

**Recommendations:**
1. Add UK bank holidays to the quiet days configuration (no auto-send on bank holidays or the day before)
2. Add a "holiday mode" that reduces volume to 50% during known school holiday periods
3. Track callback rate by week and flag weeks with anomalously low response rates
4. Allow the candidate to mark "reduced sending" periods in the configuration

---

**Round 26 -- "The DOCX format for agencies assumes agencies still prefer DOCX, which is changing"**

Section 7.5 specifies DOCX for agency CVs because "agencies often reformat CVs." This was standard practice 5 years ago, but the UK recruitment industry is evolving. Many agencies now use ATS systems (Bullhorn, Vincere, Access) that can parse both PDF and DOCX. Some agencies, particularly specialist agencies, now prefer branded PDF CVs because they embed the agency's formatting automatically during processing.

More importantly, sending a DOCX file (which is editable) introduces a risk the PRD does not address: the agency can modify the CV content. Agencies have been known to embellish candidate CVs to make them more attractive to clients. If an agency adds experience the candidate does not have, the candidate is unknowingly represented with false qualifications. This is particularly risky with automated sending because the candidate does not know which version of her CV was submitted to the end client.

PDF format prevents editing (without specialized tools) and preserves formatting. The trade-off between "parseable by agency ATS" and "protected from modification" should be the candidate's choice, not a system default.

**Score: 5/10** (unchanged from v1, practice concern)

**Recommendations:**
1. Make the agency CV format configurable per agency in the known_contacts table (some prefer DOCX, some prefer PDF)
2. Default to PDF for all agencies to prevent content modification
3. For agencies that specifically request DOCX, note in the weekly report: "DOCX CVs sent to {N} agencies -- be aware these can be modified"
4. Consider adding PDF password protection (Gotenberg supports this) for agency submissions

---

**Round 27 -- "The notice period field is static but notice periods change"**

The candidate_profile includes "notice_period": "1 month". This is pre-filled in every task card and referenced in LinkedIn screening questions. But notice periods change -- if the candidate has given notice, her notice period might be "2 weeks" or "immediate." If she has not started a new role yet, it might be "available immediately." If she has a garden leave clause, it could be "3 months."

The system has no mechanism to prompt the candidate to update the notice period when circumstances change. Unlike salary (which varies per role), notice period is a factual field that changes infrequently but significantly. A stale notice period in applications could:
- Disqualify the candidate if the employer needs someone to start sooner ("1 month" when she is actually available immediately)
- Set false expectations if the employer plans around a 1-month start date but the candidate actually has a 3-month contractual notice

**Score: 5/10** (minor but practical issue)

**Recommendations:**
1. Add a quarterly prompt in the weekly report: "Is your notice period still {notice_period}? Reply UPDATE NOTICE {new_period} to change."
2. When the candidate logs response_type = 'offer' for any application, prompt her to update the notice period
3. Add notice_period to the list of fields that should be reviewed before sending to each employer, not pre-filled blindly
4. Support multiple notice period values: "contractual" (for new employers) and "actual" (for current state)

---

**Round 28 -- "The system does not handle GDPR Subject Access Requests from employers or agencies"**

The PRD addresses the candidate's own data rights (Section 18.3) but does not consider SARs from employers or agencies. When the system sends an application email, the employer receives personal data (CV, cover letter, email body). Under UK GDPR, the candidate has shared her data with the employer, and the employer becomes a data controller for that data.

But consider the reverse: what if an employer or agency contacts the candidate with a SAR? "We are conducting a data audit. Please confirm what personal data you hold about our organization and employees." The system stores: employer company name, job titles, job descriptions (which may contain internal information), application email addresses (which are personal data of the recruiter), and interaction history.

If the application_email is a named individual (sarah.jones@company.com rather than careers@company.com), the system holds personal data about Sarah Jones (her email address, associated with her employer and role). Sarah has UK GDPR rights over this data.

The system has no mechanism to respond to third-party SARs, no data inventory that identifies third-party personal data held, and no retention policy specific to recruiter email addresses.

**Score: 5/10** (genuine gap, low likelihood of being exercised)

**Recommendations:**
1. Add a data inventory documenting all categories of third-party personal data held (recruiter emails, referee details, employer contacts)
2. Add a mechanism to search for and export data about a specific third party (e.g., all data referencing sarah.jones@company.com)
3. Define a retention policy for recruiter email addresses: anonymize after the application is terminal
4. Document the SAR response procedure in the privacy section

---

**Round 29 -- "The system's automated emails may trigger PECR consent requirements if the employer treats them as direct marketing"**

Section 13.2 argues that application emails are not marketing emails and therefore do not fall under PECR (Privacy and Electronic Communications Regulations). This argument is correct for responding to advertised vacancies. But the boundary is blurry for:

1. **Agency emails for roles not explicitly advertised to the candidate:** If the system discovers a role via RSS/API and sends an email to an agency, the agency did not solicit the candidate's application. The agency posted the role publicly, but the candidate's email is unsolicited in the sense that the agency did not invite this specific candidate to apply. This is different from a candidate manually finding and responding to a job ad.

2. **Follow-up applications to the same agency:** If the system sends multiple applications to the same agency over weeks, the pattern resembles a newsletter more than individual responses. An agency that receives the fifth application from the same candidate in a month might view subsequent emails as unsolicited.

3. **Speculative applications:** These are explicitly unsolicited. The PRD marks them as manual-only (auto_send_speculative: false), which is correct. But the system still generates the email content, which could be argued as "directing" unsolicited communication.

The risk is that an agency or employer reports the sending domain for spam, damaging the domain reputation (addressed in Section 12.3) but also potentially creating a PECR enforcement action.

**Score: 5/10** (correctly handled for most cases, edge cases remain)

**Recommendations:**
1. Add a per-agency send frequency limit: no more than 3 applications to the same agency per month unless the candidate has explicitly authorized higher volume
2. For repeated agency sends, vary the from-address or email signature slightly to avoid pattern detection by agency spam filters
3. Document the PECR analysis for each application type (response to ad, speculative, agency) separately
4. Add a "relationship warming" sequence for new agency contacts: first email is always held for approval

---

**Round 30 -- "Academic role applications have no awareness of REF (Research Excellence Framework) cycles"**

For academic roles, the UK's Research Excellence Framework (REF) significantly impacts hiring patterns. REF assessment periods create hiring surges and freezes. Institutions hire strategically to strengthen their REF submission, and the qualities they prioritize (publications, research grants, impact case studies) vary by REF timing.

The system's supporting statement generation (Section 8.5) uses a generic prompt that addresses person specification criteria. But for academic roles during REF-sensitive periods, the supporting statement should emphasize research output, impact, and funding potential. The system has no awareness of academic hiring cycles.

Similarly, universities in the UK have specific application customs:
- Teaching-focused roles vs research-focused roles require different emphasis
- The "Further Particulars" document (mentioned in Section 6.5) often contains essential context not in the job description
- Academic applications often require a research plan or teaching portfolio not covered by the standard document library

These are niche concerns, but for a candidate with a PhD targeting both academic and corporate roles, they matter. The system treats academic applications as portal-task-card-plus-supporting-statement, without deeper integration with academic hiring practices.

**Score: 5/10** (unchanged, niche but relevant to this candidate's profile)

**Recommendations:**
1. Add academic role metadata to Module 1: teaching-focused vs research-focused, REF unit of assessment, institution Russell Group status
2. Adjust supporting statement prompts based on role type: emphasize publications for research roles, teaching innovation for teaching roles
3. Add a "Further Particulars URL" field that the candidate can review before the application is marked complete
4. Consider a separate document library section for academic-specific documents (research plan template, teaching philosophy template)

---

#### Persona 3 Summary (v2): UK Employment Law / Recruitment Expert

| Round | Concern | Score | v1 Score | Delta |
|-------|---------|-------|----------|-------|
| 21 | Agency disclaimer legally insufficient for Reg 15 compliance | 5 | 3 | +2 |
| 22 | Disability Confident guidance makes disclosure recommendation | 6 | 3 | +3 |
| 23 | No closing date enforcement; applications to expired roles | 5 | N/A | new |
| 24 | Salary handling partially addressed but still static | 5 | 4 | +1 |
| 25 | No holiday/bank holiday awareness in scheduling | 5 | N/A | new |
| 26 | DOCX for agencies enables CV modification by agency | 5 | N/A | new |
| 27 | Notice period field is static, goes stale | 5 | N/A | new |
| 28 | No mechanism for third-party SARs (employer/agency data rights) | 5 | N/A | new |
| 29 | Repeated agency emails approach PECR boundary | 5 | 5 | 0 |
| 30 | Academic applications lack REF cycle and role-type awareness | 5 | N/A | new |
| **Average** | | **5.1** | **4.3** | **+0.8** |

**Top 3 Remaining Issues:**
1. No closing date enforcement -- system can apply to expired roles (Round 23)
2. Agency disclaimer is helpful but does not create legal protection (Round 21)
3. DOCX format for agencies enables CV content modification (Round 26)

---

### 21.4 Persona 4: Security & Anti-Fraud Specialist

*Context: Evaluating whether v2 fixes for credential management, audit trails, webhook security, and deletion are sufficient. Looking for remaining attack surfaces.*

---

**Round 31 -- "The credential management section (5.7) is thorough but the rotation procedures have operational gaps"**

v2 adds Section 5.7 with detailed credential management: N8N_ENCRYPTION_KEY generation, APPROVAL_SECRET rotation every 90 days, server security (LUKS, SSH keys, Postgres localhost-only). This is a substantial improvement from v1's absent credential management.

However, the rotation procedures have operational gaps. The APPROVAL_SECRET rotation schedule says "On rotation: expire all pending_approval applications and re-generate approval notifications." This means every 90 days, any A-tier application waiting for approval is forcibly expired and re-generated. If the candidate has 3 pending approvals when rotation happens, she gets 3 new approval emails with new tokens and the old ones stop working. This is disruptive.

The N8N_ENCRYPTION_KEY rotation is listed as "Annually or on suspected compromise" with impact "Requires re-encrypting all n8n credentials." n8n does not have a built-in key rotation mechanism. Re-encrypting credentials requires exporting all credentials, changing the key, and re-importing. During this process, all workflows that use encrypted credentials (all of them) are non-functional. The PRD does not describe this procedure.

The table lists "On suspected compromise" for RESEND_API_KEY and ANTHROPIC_API_KEY but does not specify how compromise would be detected. There are no alerts for unauthorized API usage, no API key usage monitoring, and no mechanism to detect if the keys are being used from unexpected IP addresses.

**Score: 6/10** (up from 3 -- good framework, operational detail needs work)

**Recommendations:**
1. For APPROVAL_SECRET rotation: instead of expiring all pending approvals, implement a dual-key validation period (accept tokens signed with either old or new key for 24 hours during rotation)
2. Document the N8N_ENCRYPTION_KEY rotation procedure step by step, including downtime estimate
3. Set up API usage monitoring: Anthropic and Resend both provide usage dashboards; add alerts for unexpected spikes
4. Consider using n8n's credential delegation feature (if available) to separate key management from workflow operation

---

**Round 32 -- "The single-use token enforcement has a race condition"**

v2 adds single-use token enforcement: "tokens are marked as consumed after first POST action; replay attempts are rejected." The implementation updates `approval_token_consumed_at` in the applications table. But the check-then-update is not atomic.

Scenario: two POST requests arrive simultaneously (possible if the candidate double-clicks the confirm button, or if the email link is opened in two browser tabs). Both requests:
1. Validate the token (both pass -- token_consumed_at is NULL)
2. Check token not consumed (both pass -- the UPDATE has not committed yet)
3. Execute the action (both trigger email send)
4. Mark token as consumed (both UPDATE, second one is a no-op)

The result: the application email is sent twice. This is the same duplicate-send problem as Round 16 (startup recovery) but triggered by concurrent user actions rather than system crashes.

PostgreSQL's default READ COMMITTED isolation does not prevent this. The SELECT in step 2 does not lock the row. By the time step 4 runs, both transactions have passed the check.

**Score: 5/10** (correct concept, race condition in implementation)

**Recommendations:**
1. Use SELECT FOR UPDATE in step 2: `SELECT ... WHERE id = {id} AND approval_token_consumed_at IS NULL FOR UPDATE` -- this locks the row, so the second request blocks until the first completes
2. Wrap steps 2-4 in a single transaction with SERIALIZABLE isolation
3. Add a unique constraint or advisory lock on the approval action to prevent concurrent execution
4. Add client-side double-click prevention on the confirm button (disable button after first click)

---

**Round 33 -- "The audit trail records token_hash but does not track which action was taken per hash"**

v2 adds token_hash to application_status_history, which is good for forensic analysis. But the hash is a SHA-256 of the full token. If the same token is used for the GET (confirmation page) and the POST (action), the hash is the same for both entries. The audit trail shows two entries with the same token_hash but different timestamps, and the to_status field distinguishes them (one might be 'pending_approval' -> 'pending_approval' for the GET, and 'pending_approval' -> 'approved' for the POST).

Wait -- the GET request should not create a status history entry because it does not change the status. Only the POST changes the status. So the audit trail only records the action, not the confirmation page load. This means if someone loads the confirmation page but does not click confirm, there is no record of their visit. An attacker who probes the endpoint with valid tokens (obtained from forwarded emails) leaves no trace in the audit trail as long as they only load the GET page.

The source_ip is recorded on POST, but not on GET. The GET request is the one that reveals whether the application exists and is pending. An attacker can enumerate application states via GET requests with no audit trail.

**Score: 5/10** (partial audit coverage)

**Recommendations:**
1. Log GET requests to the confirmation page in a separate access_log table (not in status history, since status does not change)
2. Record source_ip, user_agent, token_hash, and timestamp for every GET request to the approval endpoint
3. Add rate limiting on the GET endpoint: max 5 requests per token per hour
4. Alert on unusual patterns: same token accessed from multiple IPs, or multiple tokens accessed from the same IP

---

**Round 34 -- "The soft-delete mechanism does not prevent the system from processing deleted data during the 30-day retention"**

v2 adds soft-delete (Section 18.3): applications are set to status = 'deleted' and purged after 30 days. But the system's queries filter by status for active processing. The question is whether 'deleted' is handled correctly in all queries.

The WF-AP1 query (Section 15.1, Node 3) filters `WHERE status NOT IN ('failed', 'expired', 'withdrawn')`. The 'deleted' status is not in this exclusion list. If a soft-deleted application somehow has `ready_to_apply = true` on its job record, it would be picked up by WF-AP1.

The v_active_applications view (Section 14.4) filters `WHERE a.status NOT IN ('failed', 'expired', 'withdrawn', 'rejected', 'blocked_duplicate')`. 'deleted' is not in this list either. Soft-deleted applications would appear in the active applications view.

The callback rate query (Section 11.3) filters `WHERE status IN ('submitted', 'completed', 'delivered', 'opened', 'response_received')` -- 'deleted' is excluded by this inclusive list, so callback rates are unaffected. But any query that uses an exclusive (NOT IN) filter rather than an inclusive (IN) filter could incorrectly include deleted records.

**Score: 5/10** (good mechanism, incomplete integration)

**Recommendations:**
1. Add 'deleted' to every NOT IN exclusion list in the codebase
2. Better: add a `deleted_at TIMESTAMPTZ` column and filter on `deleted_at IS NULL` instead of using a status value
3. Create a Postgres policy or view that automatically excludes deleted records (row-level security or a base view that all queries use)
4. Add a test case: soft-delete an application, verify it does not appear in any system query

---

**Round 35 -- "The filesystem cleanup for deletion is deferred to an external script with no specification"**

v2 replaces the `rm -rf` with: "Filesystem cleanup is handled by a separate audited script (not embedded in SQL) that validates paths before deletion. See: scripts/purge_application_files.sh. This script ONLY deletes files under /data/applications/ and /data/generated-cvs/, with path validation to prevent traversal."

This is a significant improvement in approach. But the script does not exist -- it is referenced but not specified. The PRD says "see: scripts/purge_application_files.sh" but provides no specification for this script. The path validation logic ("validates paths before deletion") is not described. What constitutes valid validation?

A naive implementation might check `if [[ "$path" == /data/applications/* ]]`, which is vulnerable to path traversal: `/data/applications/../../etc/passwd` passes the prefix check. Proper validation requires canonicalizing the path (resolving symlinks and `..` components) before comparison.

The script also needs to handle the case where files referenced in the database no longer exist on disk (e.g., manual cleanup, disk failure). And it needs to handle files that exist on disk but are not referenced in the database (orphaned files from failed workflows).

**Score: 5/10** (up from 3 -- right direction, no implementation)

**Recommendations:**
1. Specify the purge script in the PRD or as a companion document
2. Path validation: use `realpath` to canonicalize paths, then verify the canonical path starts with the allowed prefix
3. Run the script as a non-root user that has write access only to `/data/applications/` and `/data/generated-cvs/`
4. Add a dry-run mode that reports what would be deleted without deleting

---

**Round 36 -- "The n8n webhook path randomization is not implemented despite being recommended"**

v1 Round 17 recommended using random path suffixes for webhook URLs. v2 does not implement this. The webhook URLs remain predictable:
- `https://n8n.deploy.apiloom.io/webhook/application-action`
- `https://n8n.deploy.apiloom.io/webhook/application-action-confirm`
- `https://n8n.deploy.apiloom.io/webhook/resend-delivery-events`
- `https://n8n.deploy.apiloom.io/webhook/application-complete`

These URLs are documented in the PRD, which is stored in a Git repository. If the repository is ever public (or if the PRD is shared with any reviewer), the full webhook surface is known. An attacker could:
- Flood the approval endpoint with requests (DoS on n8n execution resources)
- Send crafted Resend-style webhook payloads to the delivery events endpoint (requires knowing the webhook secret to pass validation, but the endpoint itself accepts requests)
- Probe the /application-complete endpoint with random application IDs

The Resend webhook has HMAC validation. The approval webhook has token validation. The application-complete webhook has token validation. So crafted payloads would be rejected. But the request processing (receiving, parsing, validating) still consumes n8n execution time and counts against the execution quota.

**Score: 5/10** (unchanged -- correct assessment, moderate risk)

**Recommendations:**
1. Add a random suffix to webhook paths: `/webhook/resend-delivery-events-{random_hex}`
2. Add IP allowlisting for the Resend webhook (Resend publishes their sending IPs)
3. Add rate limiting at the Traefik/Dokploy level: max 60 requests/minute per IP per webhook path
4. Do not document webhook URLs in the PRD -- store them in the deployment configuration only

---

**Round 37 -- "The Claude API PII minimization recommendation from v1 is partially implemented"**

v2 adds a note in Section 18.4: "The system should minimise PII sent to Claude where possible: use a candidate reference ID in prompts and inject real name/contact details in post-processing." But the email composition prompt (Section 7.2) still includes:
- "Name: {candidate_name}"
- "Contact: {candidate_email}, {candidate_phone}"
- "Location: {candidate_location}"

The recommendation is stated as a should, not implemented as a change to the prompt. The prompt template has not been modified to use a reference ID or pseudonym. The PII continues to be sent to Anthropic's US-based servers on every API call.

The note about requiring a Transfer Impact Assessment (TIA) for Anthropic (Section 18.4) is a good addition but is a reference, not a completed assessment. The TIA itself is not included in the PRD.

**Score: 5/10** (up from 4 -- acknowledged, not implemented)

**Recommendations:**
1. Implement the PII minimization: replace name with "the candidate" in the prompt, inject the real name in post-processing
2. Remove email and phone from the Claude prompt entirely -- they serve no purpose in email composition (the signature handles contact details)
3. Replace location with region ("Southeast England" instead of "Maidenhead, Berkshire")
4. Complete the TIA for Anthropic and include a summary in the PRD

---

**Round 38 -- "The email suppression list can be poisoned by a sophisticated attacker"**

Section 12.3 describes the email suppression list: hard bounces add the email to the list, complaints add the domain. The suppression check runs before every send. A sophisticated attacker who knows the system exists could:

1. Register a domain that looks like a legitimate employer (e.g., deIoitte.com with a capital I instead of lowercase L)
2. Post a fake job listing that Module 1 discovers and scores as B-tier
3. The system auto-sends an application to the attacker's domain
4. The attacker's mail server returns a complaint event (or the attacker manually reports spam)
5. The system adds the attacker's domain to the suppression list
6. Since suppression checks domain-level, all future applications to any address at that domain are blocked

Alternatively, if the attacker controls a domain that is similar to but not the same as a real employer's domain, the domain suppression is irrelevant. But if the attacker can trigger a complaint event that is associated with the real employer's domain (by manipulating email headers or Resend's webhook), the real employer's domain gets suppressed.

This is a low-probability attack, but the domain-level suppression on a single complaint is aggressive. One false positive could block an important employer permanently.

**Score: 5/10** (edge case, low probability, high impact if exploited)

**Recommendations:**
1. For complaint-based domain suppression, require manual confirmation before adding the domain to the suppression list
2. Add an alert for any complaint event with the option to review and unsuppress
3. Do not auto-suppress entire domains on a single complaint -- require 2+ complaints from different addresses at the same domain
4. Add a "protected domains" whitelist that cannot be auto-suppressed (major employers, authorized agencies)

---

**Round 39 -- "The Resend DPA requirement is noted but there is no verification that Resend's DPA meets UK GDPR standards"**

v2 adds: "Resend's data processing agreement (DPA) must be reviewed and executed before deployment." This is correct but passive. The PRD notes the requirement without specifying:
- What the DPA must contain (Article 28 requirements: processor obligations, sub-processor controls, breach notification, audit rights)
- Whether Resend's standard DPA has been reviewed
- Whether Resend's DPA covers UK GDPR specifically (not just EU GDPR or US privacy frameworks)
- Whether Resend uses sub-processors (CDN providers, cloud infrastructure) and whether those sub-processors are disclosed

Resend is a relatively young company. Their DPA may not have been tested against UK GDPR requirements. Their infrastructure runs on AWS (US regions), which introduces additional data transfer considerations.

The TIA reference is good but insufficient: "A Transfer Impact Assessment (TIA) is required as Resend is a US-based company (see Section 18.7)." Section 18.7 does not exist in the document.

**Score: 5/10** (up from 2 -- correct identification of need, dangling reference)

**Recommendations:**
1. Complete the Resend DPA review before deployment -- create a checklist of Article 28 requirements and verify each
2. Fix the dangling reference to Section 18.7 (TIA section does not exist)
3. Document Resend's sub-processors and data flow (where does the email content transit? which AWS regions?)
4. Consider a UK-based email delivery alternative (e.g., Mailgun UK, Postmark) to simplify the data transfer analysis

---

**Round 40 -- "The server security measures do not include intrusion detection or log monitoring"**

v2 adds server security measures in Section 5.7: LUKS disk encryption, SSH key-based auth, Postgres localhost-only, n8n behind HTTPS. These are necessary but insufficient for detecting active threats.

There is no:
- SSH login monitoring or alerting (who logged in, from where, when)
- Fail2ban or similar brute-force protection
- File integrity monitoring (detecting unauthorized changes to configuration or workflow files)
- Network traffic monitoring (detecting unexpected outbound connections)
- Log aggregation (system logs, n8n logs, Postgres logs in one place)
- Alerting on failed authentication attempts (SSH, n8n, Postgres)

For a single-server deployment handling personal data, the threat model includes:
- Server compromise via SSH (key theft, zero-day)
- n8n vulnerability (n8n has had CVEs; self-hosted instances are responsible for patching)
- Postgres authentication bypass (if configuration changes)
- Docker container escape (access to host filesystem)

Without monitoring, a compromise could persist undetected for weeks. The attacker could access all application data, forge approval tokens, send emails impersonating the candidate, or exfiltrate CV content.

**Score: 5/10** (up from 3 -- preventive measures added, detective measures absent)

**Recommendations:**
1. Install Fail2ban for SSH and n8n login protection
2. Enable Postgres log_connections and log_disconnections
3. Set up a lightweight log aggregation (even just shipping to a file-based analysis tool)
4. Add n8n version monitoring: alert when security patches are released
5. Schedule monthly security reviews: check for n8n CVEs, Docker image updates, Postgres patches

---

#### Persona 4 Summary (v2): Security & Anti-Fraud Specialist

| Round | Concern | Score | v1 Score | Delta |
|-------|---------|-------|----------|-------|
| 31 | Credential rotation has operational gaps | 6 | 3 | +3 |
| 32 | Single-use token has race condition | 5 | 3 | +2 |
| 33 | Audit trail does not cover GET probing | 5 | 3 | +2 |
| 34 | Soft-delete not excluded from all queries | 5 | N/A | new |
| 35 | Filesystem cleanup script referenced but not specified | 5 | 3 | +2 |
| 36 | Webhook paths remain predictable | 5 | 4 | +1 |
| 37 | PII minimization for Claude API noted but not implemented | 5 | 4 | +1 |
| 38 | Email suppression list can be poisoned | 5 | N/A | new |
| 39 | Resend DPA requirement noted with dangling section reference | 5 | N/A | new |
| 40 | No intrusion detection or log monitoring | 5 | 3 | +2 |
| **Average** | | **5.1** | **3.8** | **+1.3** |

**Top 3 Remaining Issues:**
1. Single-use token race condition allows double-send on concurrent requests (Round 32)
2. Soft-delete status not integrated into all system queries (Round 34)
3. PII minimization for Claude API acknowledged but not implemented (Round 37)

---

### 21.5 Persona 5: Privacy & Compliance Officer

*Context: Evaluating whether v2 fixes for GDPR, data transfers, breach procedures, and consent are sufficient. Looking for remaining compliance gaps.*

---

**Round 41 -- "The DPIA requirement is still not fulfilled -- only acknowledged"**

v1 Round 41 scored 3/10 for the absence of a DPIA. v2 does not add a DPIA or even a simplified privacy impact assessment. The data classification table (Section 18.1) is more detailed, and the third-party data sharing section (18.4) is more accurate, but these are informational sections, not a formal risk assessment.

A DPIA under Article 35 requires:
1. A systematic description of the processing operations and purposes
2. An assessment of the necessity and proportionality of the processing
3. An assessment of the risks to the rights and freedoms of data subjects
4. The measures envisaged to address the risks

The PRD contains elements of items 1 and 4 scattered across Sections 13 and 18, but they are not assembled into a formal DPIA structure. No necessity/proportionality assessment exists. No risk-to-rights analysis exists.

For a system that auto-sends professional communications containing personal data to third parties on behalf of the data subject, a DPIA is likely required (not just best practice) under the ICO's screening criteria. The ICO's published list of processing activities that require a DPIA includes "systematic monitoring" and "large scale processing" -- while this system is single-user, the automated nature and employment impact may trigger the requirement.

**Score: 4/10** (up from 3 -- better data classification, DPIA still absent)

**Recommendations:**
1. Create a standalone DPIA document using the ICO's template
2. The DPIA should cover at minimum: B-tier auto-send processing, Claude API data transfer, Resend data processing, referee data sharing
3. Include the DPIA reference in the PRD's privacy section
4. Schedule annual DPIA reviews

---

**Round 42 -- "Article 22 analysis is still absent despite being flagged as a must-fix"**

v1 Round 42 scored 3/10 and was listed in the "Top 10 Should Fix" list. v2 does not address this. The system still performs fully automated decision-making (B-tier auto-send) with employment-related impact. No Article 22 analysis exists in the document.

The argument that "the candidate consented to the system" is available but needs to be explicitly made and documented. Article 22(2)(c) allows automated decision-making with explicit consent, but requires:
- The consent to be "explicit" (Article 9(2)(a) standard) -- specific, informed, freely given, unambiguous
- "Suitable measures to safeguard the data subject's rights and freedoms and legitimate interests" to be implemented

The safeguard measures would include: the ability to obtain human intervention (A-tier approval flow provides this only for A-tier), the ability to express a point of view (the edit flow, which is underspecified), and the ability to contest the decision (withdraw an application, which cannot un-send an email).

The irrevocability of auto-sent emails is the key gap. Once a B-tier email is sent, the candidate cannot undo it. If the automated system made a poor decision (wrong role, scam posting, bad email content), the candidate has no remedy. Under Article 22, this irrevocability should be documented as a residual risk with the mitigation being the quality gate checks.

**Score: 4/10** (unchanged -- still absent)

**Recommendations:**
1. Add an Article 22 analysis section to the legal/privacy area
2. Document the explicit consent requirements and how they are obtained
3. Identify and document the safeguard measures (quality gates, pause mechanism, approval flow)
4. Acknowledge the irrevocability limitation of auto-sent emails as a residual risk with documented mitigations

---

**Round 43 -- "The Transfer Impact Assessment references (Section 18.7) point to a non-existent section"**

v2 adds TIA requirements in Section 18.4: "A Transfer Impact Assessment (TIA) is required as Resend is a US-based company (see Section 18.7)" and "A Transfer Impact Assessment (TIA) is required as Anthropic is a US-based company (see Section 18.7)." But Section 18.7 does not exist. The privacy section ends at 18.5.

This is a documentation error, but it is a meaningful one. The TIA is the mechanism by which the system demonstrates that cross-border transfers provide adequate protection. Without it, the transfers to Anthropic and Resend are on uncertain legal footing. The dangling reference suggests the TIA was planned but not written.

A TIA for both services would need to assess:
- Whether each company is certified under the UK Extension to the EU-US Data Privacy Framework
- What supplementary measures are in place (encryption in transit, contractual protections, data minimization)
- Whether US government access (FISA 702) is a realistic risk for this type of data
- Whether the data could be hosted in EU/UK regions instead

**Score: 4/10** (up from 3 -- TIA need identified, dangling reference, not completed)

**Recommendations:**
1. Add Section 18.6 (renumbered from the missing 18.7): Transfer Impact Assessments
2. For Anthropic: assess DPF certification status, API data processing terms, prompt data retention policy
3. For Resend: assess DPF certification status, email data retention, sub-processor infrastructure regions
4. Document the conclusion: are the transfers lawful, and under which mechanism?

---

**Round 44 -- "The Resend data processing scope correction is accurate but incomplete"**

v2 corrects the characterization of Resend's data processing. Section 18.4 now states: "Resend is a data processor that processes the full email message including body text, subject line, and all attachments (CVs, cover letters). Attachments are part of the MIME message transmitted through Resend's infrastructure for delivery."

This is a significant improvement from v1's incorrect claim. But the analysis stops at description and does not assess the implications:

1. **Resend's retention:** How long does Resend retain the full MIME message (including CV attachments)? Their privacy policy may say "30 days" or "indefinitely." The PRD does not cite a specific retention period.

2. **Resend's sub-processors:** Does Resend use CDN services, cloud storage, or analytics providers that also process the email content? Each sub-processor is an additional entity that handles the candidate's CV.

3. **Resend's access controls:** Who at Resend can read the email content? Support engineers? Compliance team? This is relevant because the email attachments contain the candidate's full professional history.

4. **Resend's breach notification:** If Resend suffers a data breach, what is their notification timeline? The PRD's breach procedure (which is still absent as a formal section) would need to account for downstream processor breaches.

**Score: 5/10** (up from 2 -- accurate description, shallow analysis)

**Recommendations:**
1. Investigate and document Resend's specific data retention policies for email content and attachments
2. Request Resend's sub-processor list and assess each
3. Include Resend's breach notification commitments in the system's breach response plan
4. Consider sending minimal email content (shorter emails, smaller attachments) to reduce the data footprint at Resend

---

**Round 45 -- "The breach notification procedure exists only as a soft-delete mechanism, not as an incident response plan"**

v1 Round 49 scored 2/10 for having no breach notification procedure. v2 adds soft-delete (Section 18.3) and references to breach procedures in the audit trail improvements, but does not add a formal incident response section.

The soft-delete mechanism is a data lifecycle feature, not a breach response. A breach response plan requires:
1. **Detection:** How is a breach discovered? (No monitoring section addresses this)
2. **Containment:** What immediate actions are taken? (Pause all sends? Revoke API keys? Lock SSH access?)
3. **Assessment:** How is the scope and severity determined?
4. **Notification:** ICO notification within 72 hours if required. Candidate notification if high risk.
5. **Recovery:** How is the system restored to a secure state?
6. **Post-incident:** What changes prevent recurrence?

None of these steps are documented. The error handling section (Section 17) covers operational errors, not security incidents. The alerting rules (Section 17.4) include authentication failures and spam complaints but not: unauthorized database access, unexpected API key usage, unknown SSH logins, or webhook probing patterns.

**Score: 4/10** (up from 2 -- audit trail helps forensics, no response plan)

**Recommendations:**
1. Add a Section 18.6: Incident Response Plan with the six steps above
2. Define breach severity levels: Level 1 (database read access compromised), Level 2 (credential theft), Level 3 (unauthorized email sends)
3. Pre-draft ICO notification for the most likely breach scenarios
4. Include a "break glass" procedure: emergency steps any operator can take within 15 minutes of detecting a breach

---

**Round 46 -- "The consent model is still binary; no granular consent management exists"**

v1 Round 48 scored 3/10 for no granular consent management. v2 does not add a consent register or granular consent controls. The system still operates on the assumption that using the system equals consenting to all processing.

The v2 improvements (scam protection, factual accuracy checks, PII minimization note) add safeguards that could be framed as "consent conditions" -- the candidate consents to auto-send subject to these protections. But this framing is not documented.

For a single-user system built by a developer for a specific candidate, the consent question is somewhat artificial -- the candidate is directing the developer to build this system, which is a clear expression of intent. But if the system is ever shared, productized, or maintained by someone other than the candidate, the consent model becomes critical.

The practical gap is that the candidate cannot selectively disable processing activities. She cannot say "auto-send email applications but do not use Claude API" (use manual email composition only). She cannot say "send to direct employers but not to agencies." She cannot say "track delivery status but do not track opens." Each of these is a separate processing activity with different privacy implications.

**Score: 4/10** (unchanged -- no implementation)

**Recommendations:**
1. Add a consent register in application_config with per-activity consent flags
2. Minimum consent categories: email_auto_send, claude_api_processing, resend_email_tracking, agency_applications, open_tracking
3. Make each flag functional: if claude_api_processing = false, fall back to template-based email composition
4. Log consent changes with timestamps

---

**Round 47 -- "The data export still requires direct database access"**

v1 Round 47 scored 4/10 for the export function being SQL-only. v2 adds an "EXPORT" email reply command (Section 11.4 lists it as a valid reply command to the daily digest). This is a significant improvement -- the candidate can trigger an export by replying to any daily digest with "EXPORT."

However, the implementation is not specified. How does the system assemble the export? The SQL query in Section 18.3 produces JSON but does not include files. Does the EXPORT command trigger a workflow that runs the SQL, collects the referenced files, creates a ZIP, and emails it to the candidate? The workflow is not specified in Section 15.

The export also includes all system data, not just personal data. Dedup hashes, circuit breaker states, and workflow metadata are included in the JSON. A proper data portability export under Article 20 should contain only the data the candidate provided or that was generated about her.

Additionally, the export is emailed to the candidate. If the export contains all application data (including email bodies, CV content, and referee details), sending it via email creates a new data exposure risk. A large attachment containing all personal data, emailed in plaintext, is itself a privacy concern.

**Score: 5/10** (up from 4 -- trigger mechanism added, implementation unspecified)

**Recommendations:**
1. Specify the export workflow as WF-AP7 or as a sub-workflow of WF-AP6
2. Filter the export to personal data only: candidate profile, application records (job, company, status, dates), sent email content, files
3. Deliver the export via a secure download link (time-limited, single-use) rather than email attachment
4. Add export to the integration test suite

---

**Round 48 -- "The controller-processor relationship is still undefined"**

v1 Round 50 scored 2/10 for undefined controller-processor relationships. v2 does not add a Data Processing Agreement framework or clarify the relationship between the candidate (controller) and the system operator (processor).

The PRD continues to state "The candidate is the data controller for her own personal data" without addressing who maintains the server, who has SSH access, who manages the n8n instance, and what obligations they have. Section 5.7 says "SSH access limited to the system operator; access logged" -- acknowledging that a system operator exists with privileged access. This operator is a data processor under UK GDPR.

If the developer (the person writing this PRD) maintains the system, they have:
- Read access to all personal data (database, files)
- Write access (can modify application content, send emails)
- Admin access (can change configurations, revoke tokens)
- Access to API keys (can use the Resend and Claude APIs independently)

This access profile requires a formal Data Processing Agreement under Article 28, documenting: processing instructions, confidentiality obligations, security measures, sub-processor management, breach notification, audit rights, and data return/deletion on termination.

**Score: 3/10** (unchanged -- fundamental gap)

**Recommendations:**
1. Draft a DPA between the candidate and the system operator/developer
2. Define the operator's access rights explicitly: what can they access, under what circumstances, with what logging
3. Consider restricting operator access: read-only database access, no access to API keys, access only via audited channels
4. If the system is truly self-operated, document exclusive access controls and remove the "system operator" role

---

**Round 49 -- "The log retention schedule does not align with breach investigation requirements"**

Section 17.5 specifies log retention: workflow execution logs for 7 days, error logs for 30 days, application records indefinitely (anonymized after 12 months), email content for 6 months.

If a breach is discovered 8 days after it occurred, the workflow execution logs have already been deleted. These logs would show which workflows ran, with what inputs, and what outputs -- critical for understanding what data was accessed or exfiltrated.

If a breach is discovered 31 days after it occurred, the error logs are gone. Errors that might indicate unauthorized access (failed authentication, unusual queries, API errors from unexpected calls) would be invisible.

The 72-hour ICO notification requirement (Article 33) assumes the breach is detected promptly. But detection depends on monitoring (which is minimal per Section 17.4) and log availability (which is short). A sophisticated attacker who maintains persistent access for 30+ days would leave traces only in the application records themselves (anomalous status changes, unexpected email sends), not in the operational logs that would reveal HOW the access was obtained.

**Score: 4/10** (new concern, intersects with v1 Round 49 breach gap)

**Recommendations:**
1. Extend workflow execution log retention to 90 days (n8n configuration: EXECUTIONS_DATA_MAX_AGE)
2. Extend error log retention to 90 days
3. Add access logging for all database connections and API calls, retained for 90 days
4. Consider shipping logs to a separate, append-only storage to prevent an attacker from deleting their traces

---

**Round 50 -- "The system has no privacy-by-design documentation despite claiming UK GDPR compliance"**

UK GDPR Article 25 requires "data protection by design and by default." The PRD implements several privacy-by-design elements:
- Data minimization for equality monitoring (no pre-fill)
- PII minimization for Claude API (noted but not implemented)
- Encryption in transit (HTTPS, TLS)
- Encryption at rest (LUKS)
- Retention limits (6 months for email content)
- Soft-delete for right to erasure

But these are scattered across multiple sections and are not documented as a coherent privacy-by-design strategy. There is no section that says: "Here is our Article 25 compliance. Here are the design decisions we made to protect privacy. Here is where we chose the more privacy-protective option when alternatives existed."

The absence of this documentation is not a technical failure but a compliance documentation failure. If the ICO ever reviews this system (low probability for a single-user system, but not zero), they would look for evidence that privacy was considered in the design process, not just bolted on afterward. The v1 evaluation findings and v2 fixes demonstrate that privacy concerns were raised and addressed -- but reactively, not proactively.

The system also has no default privacy settings. All features are enabled by default: open tracking, PII in Claude prompts, auto-send for B-tier. Under "by default" principles, the most privacy-protective configuration should be the default, with the user choosing to relax protections. The current defaults prioritize automation over privacy.

**Score: 4/10** (improved implementation, missing documentation)

**Recommendations:**
1. Add a Section 18.6: Privacy by Design Compliance documenting design decisions and their privacy rationale
2. Set privacy-protective defaults: open tracking off, B-tier auto-send off (candidate enables after review), PII minimization on
3. Create a privacy configuration checklist that the candidate reviews during initial setup
4. Frame the v1 evaluation and v2 fixes as part of the privacy-by-design process documentation

---

#### Persona 5 Summary (v2): Privacy & Compliance Officer

| Round | Concern | Score | v1 Score | Delta |
|-------|---------|-------|----------|-------|
| 41 | DPIA still absent despite being flagged | 4 | 3 | +1 |
| 42 | Article 22 analysis still absent | 4 | 3 | +1 |
| 43 | TIA references point to non-existent section | 4 | 3 | +1 |
| 44 | Resend data scope corrected but analysis shallow | 5 | 2 | +3 |
| 45 | Breach procedure absent; soft-delete is not incident response | 4 | 2 | +2 |
| 46 | No granular consent management | 4 | 3 | +1 |
| 47 | Data export trigger added but implementation unspecified | 5 | 4 | +1 |
| 48 | Controller-processor relationship still undefined | 3 | 2 | +1 |
| 49 | Log retention too short for breach investigation | 4 | N/A | new |
| 50 | No privacy-by-design documentation | 4 | N/A | new |
| **Average** | | **4.1** | **2.9** | **+1.2** |

**Top 3 Remaining Issues:**
1. Controller-processor relationship still undefined; no DPA exists (Round 48)
2. DPIA and Article 22 analysis still absent despite being flagged in v1 (Rounds 41, 42)
3. TIA section referenced but does not exist in the document (Round 43)

---

### 21.6 Overall v2 Evaluation Summary

#### Persona Averages (v2 vs v1)

| Persona | v2 Score | v1 Score | Delta | Verdict |
|---------|----------|----------|-------|---------|
| 1. The Candidate (Selvi) | 5.2 | 3.6 | +1.6 | Control significantly improved; quality assurance gaps remain |
| 2. Technical Architect | 5.4 | 4.0 | +1.4 | Core reliability fixed; edge cases and implementation detail need work |
| 3. UK Employment Law Expert | 5.1 | 4.3 | +0.8 | Agency and equality fixes landed; operational legal gaps remain |
| 4. Security Specialist | 5.1 | 3.8 | +1.3 | Credential and audit improvements good; race conditions and monitoring gaps |
| 5. Privacy & Compliance Officer | 4.1 | 2.9 | +1.2 | Data characterization fixed; formal compliance documents still missing |
| **Overall Average** | **4.98** | **3.7** | **+1.3** | **Approaching deployment readiness; formal compliance work required** |

#### Score Distribution (v2)

| Score Range | Count | Percentage | v1 Count | v1 Percentage |
|-------------|-------|------------|----------|---------------|
| 1-2 (Critical) | 0 | 0% | 5 | 10% |
| 3-4 (Significant) | 14 | 28% | 36 | 72% |
| 5-6 (Moderate) | 36 | 72% | 9 | 18% |
| 7-10 (Acceptable) | 0 | 0% | 0 | 0% |

#### Key Improvements in v2

1. **Approval webhooks** (v1: 2/10, v2: 6/10): GET-then-POST two-step flow eliminates email scanner accidental triggers. Single-use tokens prevent replay.
2. **Candidate controls** (v1: 3/10, v2: 6/10): Multi-channel PAUSE, per-application HOLD/CANCEL, upcoming queue visibility.
3. **Credential management** (v1: 3/10, v2: 6/10): Documented key generation, rotation schedule, server hardening.
4. **Resend data scope** (v1: 2/10, v2: 5/10): Correctly characterized as full MIME processing including attachments.
5. **Scam protection** (v1: 3/10, v2: 6/10): First-contact hold, free email provider check, known employer whitelist.

#### Remaining Critical Gaps (Must Address Before Launch)

| # | Round | Issue | Persona | Score |
|---|-------|-------|---------|-------|
| 1 | 48 | Controller-processor relationship undefined; no DPA | Privacy | 3 |
| 2 | 41 | DPIA still absent | Privacy | 4 |
| 3 | 42 | Article 22 automated decision-making not analyzed | Privacy | 4 |
| 4 | 43 | TIA section referenced but does not exist | Privacy | 4 |
| 5 | 9 | No ongoing B-tier email quality sampling | Candidate | 4 |
| 6 | 16 | Startup recovery can cause duplicate sends | Technical | 4 |
| 7 | 10 | No validation of Module 2 output quality | Candidate | 4 |
| 8 | 45 | No incident response plan (soft-delete is not breach response) | Privacy | 4 |
| 9 | 23 | No closing date enforcement | Legal | 5 |
| 10 | 32 | Single-use token race condition | Security | 5 |

#### Remaining Should-Fix Items (Before Steady State)

| # | Round | Issue | Persona | Score |
|---|-------|-------|---------|-------|
| 1 | 37 | PII minimization for Claude API noted but not implemented | Security | 5 |
| 2 | 34 | Soft-delete not excluded from all queries | Security | 5 |
| 3 | 18 | Audit logging via metadata JSONB is fragile | Technical | 5 |
| 4 | 13 | Serial batch processing creates bottleneck | Technical | 5 |
| 5 | 5 | Agency auto-send risks unintended representation | Candidate | 5 |
| 6 | 21 | Agency disclaimer legally insufficient | Legal | 5 |
| 7 | 25 | No bank holiday or seasonal awareness | Legal | 5 |
| 8 | 35 | Filesystem cleanup script not specified | Security | 5 |
| 9 | 46 | No granular consent management | Privacy | 4 |
| 10 | 49 | Log retention too short for breach investigation | Privacy | 4 |

---

*End of 50-Round Critical Roleplay Evaluation (v2)*

*Overall assessment: v2 represents a meaningful improvement across all five evaluation dimensions. The most critical v1 findings -- approval webhook GET side-effects, missing credential management, mischaracterized Resend data scope, and absent candidate controls -- are addressed with well-designed solutions. The remaining gaps cluster in two areas: (1) formal compliance documentation (DPIA, Article 22 analysis, TIA, DPA) which exists as requirements in the text but not as completed documents, and (2) edge-case reliability (startup recovery duplicates, token race conditions, serial processing bottlenecks) which require implementation-level detail. The system has moved from "not deployable" (3.7/10) to "deployable with conditions" (5.0/10). The conditions are: complete the four formal compliance documents, implement Resend idempotency keys to prevent duplicate sends, and add ongoing B-tier quality sampling. These are achievable within 1-2 weeks of focused work.*

---

*End of Document*

**Document Statistics:**
- Sections: 21 + 4 Appendices
- Tables: 70+
- Code blocks: 30+
- SQL schemas: 7 tables, 4 views, 3 triggers
- n8n workflows specified: 9
- Estimated implementation: 7-8 weeks
- Evaluation rounds: 100 (50 v1 + 50 v2, 5 personas x 10 rounds each)

---

## Fixes Applied Log (v2 -> v3)

### Must Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | Controller-processor relationship undefined; no DPA | Added Section 18.5 with DPA requirements for Resend, Anthropic, and Hetzner. Includes DPA checklist, required terms, and pre-launch actions. |
| 2 | DPIA still absent | Added Section 18.6 with full DPIA summary: processing purpose, data subjects, risks, safeguards, and review schedule. |
| 3 | Article 22 automated decision-making not analyzed | Added Section 18.7 with Article 22 analysis for B-tier auto-send. Documents exception basis (explicit consent), required safeguards, and consent capture implementation. |
| 4 | TIA section referenced but does not exist | Added Section 18.8 with Transfer Impact Assessments for Resend and Anthropic. Covers transfer mechanism, risk assessment, and supplementary measures. |
| 5 | No ongoing B-tier email quality sampling | Added B-tier quality sampling mechanism to Section 10.5: 1-in-5 sampling, candidate rating, rolling quality threshold with auto-pause on degradation. |
| 6 | Startup recovery can cause duplicate sends | Added Resend idempotency key (application_id) to email delivery configuration. Updated startup recovery procedure to check Resend API for delivery status before re-queuing. |
| 7 | No validation of Module 2 output quality | Added Check 5 (Module 2 Output Quality Validation) to quality gate architecture. Validates QA pass, score thresholds, hallucination score, and file existence before proceeding. |
| 8 | No incident response plan | Added Section 18.9 with incident response plan: incident categories, 7-step response procedure, emergency PAUSE, hard halt mechanism, and ICO contact. |
| 9 | No closing date enforcement | Updated WF-AP1 Node 3 query to filter out jobs past closing date and prioritise urgent deadlines (within 48 hours). |
| 10 | Single-use token race condition | Replaced application-level token consumption with atomic database UPDATE...RETURNING pattern that prevents race conditions from concurrent requests. |

### Should Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | PII minimization noted but not implemented | Documented PII stripping implementation in Section 18.4: SW-AP1 uses CANDIDATE_NAME placeholder, strips email/phone/address before Claude API call, re-injects post-processing. |
| 2 | Soft-delete not excluded from all queries | Added `AND status != 'deleted'` to v_active_applications, v_pending_actions, and v_callback_rate views. |
| 3 | Audit logging via metadata JSONB is fragile | Added structured columns to application_status_history: action_type, email_message_id, resend_event_type. Added index on action_type. |
| 4 | Serial batch processing creates bottleneck | Added scalability note to WF-AP1 Node 4 documenting the current acceptable volume and the parallel sub-workflow approach for higher volumes. |
| 5 | Agency auto-send risks unintended representation | Added explicit authorization confirmation prompt, per-agency opt-in requirement, and quarterly review reminder to agency safeguards. |
| 6 | Agency disclaimer legally insufficient | Updated disclaimer to reference Conduct of Employment Agencies Regulations 2003 (Regulation 15) with specific legal requirements. |
| 7 | No bank holiday or seasonal awareness | Added UK bank holidays, Christmas/New Year blackout, and August reduced volume to rate limiting table. |
| 8 | Filesystem cleanup script not specified | Added full `scripts/purge_application_files.sh` implementation with path validation, dry-run mode, logging, and security guards against path traversal. |
| 9 | No granular consent management | Added Section 18.10 with granular consent management: per-activity consent items, consent capture implementation, SQL storage schema, and immediate revocation support. |
| 10 | Log retention too short for breach investigation | Increased workflow execution log retention from 7 to 30 days and error log retention from 30 to 90 days to support breach investigation timelines. |

---

## 22. 50-Round Critical Roleplay Evaluation (v3 - FINAL)

**Evaluation Date:** 2026-03-29
**Evaluator Model:** Claude Opus 4.6
**Method:** 5 expert personas x 10 rounds each. FINAL evaluation of v3 PRD after two prior rounds (v1=3.7/10, v2=5.0/10). Focus on remaining weaknesses, fix quality, integration gaps, and deployment readiness.
**v1 Score:** 3.7/10 | **v2 Score:** 5.0/10
**v3 Fixes Applied:** DPA requirements (Section 18.5), DPIA (Section 18.6), Article 22 analysis (Section 18.7), Transfer Impact Assessments (Section 18.8), B-tier quality sampling (Section 10.5), Resend idempotency keys (Section 7.6), Module 2 output validation (Check 5 in QA gate), incident response plan (Section 18.9), closing date enforcement (WF-AP1), atomic token consumption (Section 10.3), PII minimization implementation (Section 18.4 SW-AP1), soft-delete query exclusions, structured audit columns, serial processing scalability note, agency authorization confirmation, legal disclaimer update, bank holiday scheduling, filesystem cleanup script, granular consent management (Section 18.10), extended log retention.

---

### 22.1 Persona 1: The Candidate (Selvi)

*Context: PhD + MBA, 18 years HR/L&D experience, UK-based. 90% manual callback rate. Evaluating final deployment readiness from the user's perspective -- does this system protect my career while saving my time?*

---

**Round 1 -- "The B-tier quality sampling at 20% is the right mechanism but the feedback loop is incomplete"**

v3 adds a B-tier quality sampling mechanism (Section 10.5): 1 in 5 B-tier auto-sends are flagged for post-send review in the daily digest. The candidate rates them 1-5. If the rolling average drops below 3.5/5 over 2 weeks, auto-send pauses. This directly addresses the v1 and v2 concern about invisible auto-send quality drift.

The mechanism is sound but has a subtle gap: the sampling happens post-send. The email has already been delivered. If the candidate rates a sample as 1/5 ("would not have sent this"), the damage is done. The quality sampling is a lagging indicator, not a preventive control. It catches systemic drift over weeks but cannot prevent an individual bad email.

The rolling average threshold (3.5/5 over 2 weeks) is sensible but needs calibration data. At 20% sampling of 15-20 B-tier emails per week, the candidate reviews 3-4 emails per week. A 2-week rolling window is 6-8 samples. One bad sample (1/5) among 7 otherwise perfect (5/5) scores gives an average of 4.4 -- well above the threshold. Auto-send would need sustained poor quality (3+ bad samples per 2-week window) to trigger the pause. This is the right trade-off for avoiding false positives but means individual quality failures go undetected.

The deterministic sampling (application_id % 5 == 0) is transparent and reproducible but predictable. If the Claude prompt or model version changes mid-week, the sampled emails might not be representative of the changed output. Random sampling within a guaranteed minimum (at least 3 per week) would be more robust.

**Score: 7/10** (up from 4 -- meaningful quality assurance mechanism with minor gaps)

**Recommendations:**
1. Consider sampling the first 3 emails after any prompt change or Claude model version update (not just the deterministic 20%)
2. Add a "flag this email" option in the daily digest for non-sampled applications if the candidate notices issues via other channels (e.g., an employer mentions an oddity)
3. Track quality scores by application type (direct vs agency vs academic) to catch type-specific degradation

---

**Round 2 -- "Module 2 output validation (Check 5) closes a real cross-module gap"**

v3 adds Module 2 output quality validation as Check 5 in the quality gate: verify cv_packages.qa_pass == true, qa_score >= 80, hallucination_score >= 95, PDF file existence, and file non-zero size. This is a direct response to v2 Round 10 and closes the most dangerous cross-module gap -- the system no longer blindly attaches whatever Module 2 produces.

The validation is well-specified. The qa_score and hallucination_score thresholds (80 and 95 respectively) are referenced from Module 2's own quality schema, which means Module 3 can trust Module 2's self-assessment. If Module 2 fails QA, Module 3 blocks the application and notifies the candidate.

The file existence check prevents the empty-attachment scenario. The zero-size check catches corrupted PDFs. The regeneration trigger (calling WF9 if files are missing) provides automated recovery.

One gap remains: the validation checks Module 2's metadata but does not verify the content matches the target job. If Module 2 has a routing bug and attaches Company A's tailored CV to Company B's application, Check 5 would pass (the QA metrics are for the package itself, not for the job-package pairing). This is a low-probability bug but high-impact -- sending Deloitte's tailored CV to PwC would be catastrophic.

**Score: 7/10** (new check, well-designed, minor edge case)

**Recommendations:**
1. Add a content-job alignment check: verify the company name in the cover letter text matches the application's target company
2. This can be a simple string-match: does cv_tailoring.cover_letter_text contain the company name from jobs.company?

---

**Round 3 -- "The closing date enforcement in WF-AP1 is correctly prioritized"**

v3 updates WF-AP1 Node 3 to filter out jobs past closing date and prioritize urgent deadlines (within 48 hours). The query now includes:

```sql
AND (j.closing_date IS NULL OR j.closing_date >= CURRENT_DATE)
ORDER BY
  CASE WHEN j.closing_date IS NOT NULL AND j.closing_date <= CURRENT_DATE + 2
       THEN 0 ELSE 1 END,
  ...
```

This is a clean solution. Jobs with imminent deadlines get processed first. Expired jobs are excluded. Jobs without closing dates (common for agency roles and many corporate postings) are not penalized. The ordering ensures A-tier roles with tight deadlines do not sit behind lower-priority items in the queue.

The one remaining concern is that Module 1's closing date extraction may be inconsistent. Some job postings state "closing date: 15 April 2026" clearly. Others say "applications accepted on a rolling basis" or "until the position is filled." If Module 1 stores NULL for these ambiguous cases, the system correctly treats them as open. But if Module 1 misparses a date or stores an incorrect value, the application could be prematurely excluded or incorrectly prioritized.

This is a Module 1 quality issue, not a Module 3 design flaw. Module 3 correctly uses the data it is given.

**Score: 7/10** (well-implemented, dependent on Module 1 data quality)

**Recommendations:**
1. Add a validation: if closing_date is in the past at the time the job is first scored by Module 1, flag it as potentially incorrect
2. Log when applications are excluded due to closing date expiry for visibility in the daily digest

---

**Round 4 -- "The granular consent management (Section 18.10) provides genuine control but the UX is unspecified"**

v3 adds Section 18.10 with granular consent management: per-activity consent for B-tier auto-send, PII transfer to Claude, PII transfer to Resend, referee data sharing, and email tracking. Each consent item has a revocation effect (e.g., revoking Claude API consent disables email composition). Consent records are stored with timestamps in application_config.

The consent framework is comprehensive and correctly maps processing activities to controls. The revocation effects are practical -- they degrade the system gracefully rather than shutting it down entirely.

The gap is the user interface. The system captures consent "via n8n webhook" at first setup, presenting a consent form. But there is no mechanism to review or modify consent after initial setup. The candidate cannot see her current consent state, cannot toggle individual consents, and cannot access a "consent dashboard." Modifying consent requires direct SQL manipulation of application_config or a not-yet-specified mechanism.

For a single-user system, the developer can modify the config. But the spirit of consent management is self-service control. If the candidate decides to revoke email tracking consent, she should be able to do it without involving the developer.

**Score: 7/10** (correct framework, needs operational UX)

**Recommendations:**
1. Add a consent review link to the weekly report: "Review your privacy settings: {consent_review_url}"
2. The consent review page (served via n8n webhook) should show current consent states with toggle switches
3. Consent changes should be logged in the same audit trail as other status changes

---

**Round 5 -- "The incident response plan (Section 18.9) provides a credible breach procedure"**

v3 adds Section 18.9 with a full incident response plan: incident categories (credential compromise, unauthorized access, data leakage, service compromise, system malfunction), severity levels, and a 7-step response procedure (contain, assess, preserve evidence, notify affected parties, report to ICO, remediate, post-incident review). Emergency PAUSE is referenced. Hard halt via environment variable is documented.

This directly addresses the v1/v2 gap where the system had no breach response. The procedure is practical: timeframes are specified (contain within 1 hour, assess within 4 hours, ICO notification within 72 hours), evidence preservation is prioritized, and the cascading notification logic is sound.

The hard halt mechanism (EMERGENCY_HALT=true) is a valuable addition. Even if the PAUSE mechanism is compromised (e.g., the attacker has database access), the environment variable halt prevents email sends at the application level.

The remaining gap is detection. The plan assumes the breach is discovered, but does not specify how. Section 17.4 alerting rules cover operational failures (API auth errors, spam complaints, circuit breaker trips) but not security events (unauthorized SSH, unusual API usage patterns, unexpected webhook activity). The plan is reactive, not proactive.

**Score: 7/10** (credible response procedure, detection still weak)

**Recommendations:**
1. Add security-specific alerting rules to Section 17.4: failed SSH attempts, n8n login from unusual IPs, API calls outside scheduled workflow times
2. Consider adding a daily security digest separate from the application digest: "No unusual activity detected" or "Alert: 3 failed SSH attempts from IP X.X.X.X"

---

**Round 6 -- "The atomic token consumption pattern eliminates the double-send race condition"**

v3 replaces the application-level token consumption with an atomic database UPDATE...RETURNING:

```sql
UPDATE applications
SET approval_token_consumed = true, approval_consumed_at = NOW()
WHERE id = $1
  AND approval_token_consumed = false
RETURNING id;
```

If RETURNING yields no rows, the token was already consumed. This eliminates the race condition identified in v2 Round 32 where concurrent POST requests could both pass the consumption check. The atomic UPDATE ensures exactly one request succeeds.

This is the correct fix. The RETURNING pattern is idiomatic PostgreSQL for atomic check-and-update. No transaction isolation tricks are needed. The simplicity is its strength.

The only remaining consideration is error handling: if the database is slow and the UPDATE takes >5 seconds, the candidate might click the button again. The second click hits the same atomic check and is correctly rejected, but the user experience of waiting then seeing "already processed" is suboptimal. A client-side button disable after the first click (mentioned in v2 recommendations) would complement this server-side fix.

**Score: 8/10** (correct, atomic, simple)

**Recommendations:**
1. Add JavaScript button-disable on the confirmation page after first click as a UX improvement
2. The "already processed" error page should show the outcome: "This application was already approved and sent at {timestamp}"

---

**Round 7 -- "The PII minimization for Claude API is now specified with a concrete implementation"**

v3 documents the PII minimization implementation in Section 18.4: SW-AP1 uses CANDIDATE_NAME placeholder instead of the real name, strips email/phone/address before the Claude API call, and re-injects them in post-processing. The email composition prompt no longer sends the candidate's contact details to Anthropic.

This is a meaningful improvement. The data sent to Claude is now: current job title, qualifications, years of experience, and sanitized experience summaries. The candidate's name, email, phone number, and address are injected only after Claude returns the generated text. The PII footprint per API call is substantially reduced.

The implementation location (SW-AP1 node 2 for stripping, node 5 for re-injection) is specific enough for a developer to implement. The approach is sound -- Claude does not need the candidate's phone number to write a good email. The quality of generated text should be unaffected.

One edge case: if Claude generates text like "I can be reached at [contact information]" or "Please call me on CANDIDATE_NAME's phone," the post-processing replacement would produce odd results. The prompt rules already address this (Rule 8: "Include phone number" becomes a post-processing instruction, Rule 9: "Attach references" is template text), but the interaction between placeholder usage and Claude's natural tendency to reference contact details should be tested.

**Score: 7/10** (well-specified, needs testing)

**Recommendations:**
1. Update the Claude prompt to explicitly say: "Do not include any contact details in the email body. Contact details will be added in the signature block automatically."
2. Add a post-processing validation: reject any Claude output that contains the placeholder string CANDIDATE_NAME in an unexpected context

---

**Round 8 -- "The DPA framework (Section 18.5) establishes the right structure but is a requirements list, not executed agreements"**

v3 adds Section 18.5 with DPA requirements for Resend, Anthropic, and Hetzner. Each processor is identified with data processed, DPA status, and DPA location. The pre-launch checklist includes: download/review/execute DPAs, verify Hetzner coverage, store in /docs/compliance/, and set annual review reminders.

This transforms the v1/v2 gap from "undefined" to "defined with a clear implementation path." The structure is correct -- controller-processor relationships are identified, DPA requirements are listed, and a verification checklist exists.

The gap is that these are still requirements, not completed actions. "Must be signed via Resend's self-service DPA" and "Must be signed via Anthropic's commercial DPA process" are tasks on a checklist. Until the DPAs are actually reviewed, signed, and stored, the legal framework is aspirational.

This is acceptable for a PRD -- the PRD defines requirements, the rollout executes them. The Phase 1 tasks should include DPA execution as a blocking prerequisite.

**Score: 7/10** (correct framework, execution pending)

**Recommendations:**
1. Add DPA execution as a Phase 1 blocking task (not just a verification item)
2. Create a template compliance tracker: {Processor, DPA Status, Signed Date, Review Date, Location}

---

**Round 9 -- "The DPIA (Section 18.6) and Article 22 analysis (Section 18.7) are present but lightweight"**

v3 adds Section 18.6 (DPIA summary) and Section 18.7 (Article 22 analysis). The DPIA covers processing purpose, data subjects, legal basis, necessity/proportionality, identified risks, safeguards, and review schedule. The Article 22 analysis documents the explicit consent basis, applicable exceptions, and required safeguards.

These sections satisfy the structural requirements. The DPIA identifies five specific risks (AI hallucination, fraudulent postings, duplicates, PII exposure to Claude, referee data) and maps them to mitigations (QA gate checks, scam detection, dedup algorithm, PII minimization, consent tracking). The Article 22 analysis correctly identifies Article 22(2)(c) as the exception basis and documents four safeguard measures (multi-channel PAUSE, daily digest review, application withdrawal, B-tier quality sampling).

The analysis is correct but surface-level. A rigorous DPIA would include likelihood and impact ratings for each risk, residual risk scores after mitigation, and acceptance criteria. The Article 22 consent capture implementation (stored in application_config with timestamp and method) is practical.

The DPIA points to a document location (/docs/compliance/dpia-module-3.md) to be created during Phase 1. This signals that the PRD summary is a placeholder for a fuller document, which is reasonable.

**Score: 7/10** (structural requirements met, depth appropriate for a PRD)

**Recommendations:**
1. In the full DPIA document, add likelihood/impact scoring (e.g., 5x5 risk matrix)
2. Add a specific consent capture screen description to the Article 22 section

---

**Round 10 -- "The TIA (Section 18.8) for Resend and Anthropic addresses the transfer question but relies on assumptions"**

v3 adds Section 18.8 with Transfer Impact Assessments for both Resend and Anthropic. Each TIA covers: data transferred, transfer mechanism (SCCs), US legal framework, risk of government access, supplementary measures, and conclusion.

The assessments are reasonable. Both conclude that transfers are permissible under SCCs with supplementary measures (TLS encryption, SOC 2 compliance for Resend; API data not used for training, 30-day retention for Anthropic). The risk of government access is rated as "Low" for both, which is defensible for routine job application data.

The assumption that both companies are or will be certified under the EU-US Data Privacy Framework (DPF) is stated conditionally ("if Resend is certified" / "if Anthropic is certified"). The actual certification status is not verified. If neither is certified, the transfer relies solely on SCCs, which requires the supplementary measures to be documented and implemented -- not just mentioned.

The Resend TIA correctly identifies that full email content (including CV attachments) is transferred. The Anthropic TIA correctly identifies the PII minimization as a supplementary measure. Both point to a full document location (/docs/compliance/tia-module-3.md).

**Score: 7/10** (reasonable assessment, certification status needs verification)

**Recommendations:**
1. Verify DPF certification status for both companies before deployment
2. If either is not certified, document the SCCs and supplementary measures explicitly
3. Add a note: "Reassess if either company changes its data processing terms or infrastructure location"

---

#### Persona 1 Summary (v3): The Candidate (Selvi)

| Round | Concern | Score | v2 Score | Delta |
|-------|---------|-------|----------|-------|
| 1 | B-tier quality sampling mechanism and calibration | 7 | 4 | +3 |
| 2 | Module 2 output validation closes cross-module gap | 7 | 4 | +3 |
| 3 | Closing date enforcement correctly implemented | 7 | N/A | new |
| 4 | Granular consent management needs operational UX | 7 | 4 | +3 |
| 5 | Incident response plan is credible | 7 | 4 | +3 |
| 6 | Atomic token consumption eliminates race condition | 8 | 5 | +3 |
| 7 | PII minimization concretely implemented | 7 | 5 | +2 |
| 8 | DPA framework correct, execution pending | 7 | 3 | +4 |
| 9 | DPIA and Article 22 analysis structurally adequate | 7 | 4 | +3 |
| 10 | TIA assessments reasonable, need verification | 7 | 4 | +3 |
| **Average** | | **7.1** | **5.2** | **+1.9** |

**Top 3 Remaining Issues:**
1. B-tier quality sampling is post-send only; cannot prevent individual bad emails (Round 1)
2. Module 2 content-job alignment not verified -- wrong CV could attach to wrong job (Round 2)
3. Consent management has no self-service UX for reviewing or modifying consent (Round 4)

---

### 22.2 Persona 2: Technical Architect / n8n Expert

*Context: Evaluating v3 fix quality for startup recovery, batch processing, audit logging, and new technical concerns at deployment scale.*

---

**Round 11 -- "Resend idempotency keys eliminate the startup recovery duplicate-send problem"**

v3 adds Resend idempotency keys using the application_id (Section 7.6). The Resend API call now includes `Idempotency-Key: {application_id}`. This means if the same application is submitted to Resend twice (due to crash recovery, retry, or any other mechanism), Resend returns the cached response from the first call and does not send a duplicate email.

This is the correct fix. Resend's idempotency implementation is well-documented: keys are valid for 24 hours, and duplicate requests within that window return the original response. Since the application_id is unique per application, each application can only result in one email regardless of how many times the send is attempted.

The startup recovery procedure is updated to check Resend's API for delivery status before re-queuing. Combined with the idempotency key, this provides defense-in-depth: even if the check fails or the API is unreachable, the idempotency key prevents duplicate delivery.

The 24-hour idempotency window is sufficient -- if the system is down for more than 24 hours, the applications would be expired by the maintenance cron anyway. And applications stuck in a processing state for >24 hours should be reviewed manually, not blindly re-sent.

**Score: 8/10** (correct fix with defense-in-depth)

**Recommendations:**
1. Document the 24-hour idempotency window limitation in the startup recovery section
2. For applications stuck >24 hours, set status to 'needs_review' rather than re-queuing

---

**Round 12 -- "The structured audit columns reduce fragility but the trigger still uses metadata JSONB for some fields"**

v3 adds structured columns to application_status_history: action_type, email_message_id, and resend_event_type. These are queryable columns that do not depend on JSONB extraction. The index on action_type enables efficient filtering by action type.

However, the trigger function (Section 14.3) still reads source_ip, user_agent, and token_hash from NEW.metadata:

```sql
(NEW.metadata->>'source_ip')::INET,
NEW.metadata->>'user_agent',
NEW.metadata->>'token_hash'
```

The INET cast issue from v2 Round 18 is still present. A malformed IP string in metadata would throw an exception and roll back the status update. The structured columns fix partially addresses the fragility (action_type, email_message_id, resend_event_type are direct columns), but the most critical audit fields (source_ip, user_agent) still rely on the JSONB path.

This is a half-fix. The new structured columns are good for reporting and querying, but the JSONB-dependent fields remain fragile for the audit trail of security-relevant events (who clicked the approval link, from where).

**Score: 6/10** (partial fix -- new columns good, JSONB dependency remains for critical fields)

**Recommendations:**
1. Add a safe cast wrapper: `CASE WHEN NEW.metadata->>'source_ip' ~ '^\d+\.\d+\.\d+\.\d+$' THEN (NEW.metadata->>'source_ip')::INET ELSE NULL END`
2. Better: migrate source_ip, user_agent, and token_hash to direct columns on applications (audit_source_ip, audit_user_agent, audit_token_hash) and stop using metadata JSONB for audit data

---

**Round 13 -- "The scalability note for serial batch processing is informative but not an implementation"**

v3 adds a scalability note to WF-AP1 Node 4 (SplitInBatches) explaining that at typical volumes (5-10 jobs per run), serial processing takes 2-5 minutes and is acceptable within the 15-minute interval. For higher volumes, it describes the parallel sub-workflow approach.

This is honest documentation of a known limitation rather than a fix. The note correctly describes the trade-off: serial processing is simpler and rate-limiting is easier to enforce, while parallel processing handles higher volumes but requires rate-limiting at the sub-workflow level. The threshold for concern (20+ jobs per run) is specified.

For the expected steady-state volume (5-15 A-tier + 15-30 B-tier per week, of which only email-method applications need serial processing), the serial approach is adequate. Portal preparations (which are the majority) do not need rate limiting and could be parallelized, but the simplicity of the serial approach outweighs the throughput concern at current scale.

The honest acknowledgment of the limitation and the migration path is better than premature optimization. The implementation is correct for launch.

**Score: 7/10** (appropriate for current scale, migration path documented)

**Recommendations:**
1. Add a queue depth metric to the daily digest: if pending queue exceeds 20 jobs, flag it as "backlog building"
2. Track average processing time per WF-AP1 run to detect when the threshold is approaching

---

**Round 14 -- "The bank holiday and seasonal scheduling is well-integrated"**

v3 adds UK bank holidays, Christmas/New Year blackout (23 Dec - 2 Jan), and August reduced volume (max 8 emails/day) to the rate limiting configuration (Section 12.1). The bank holiday list is sourced from gov.uk. The Christmas blackout halts all auto-sends. August reduced volume reflects the UK holiday pattern.

This is a practical, well-calibrated set of rules. The holiday-aware scheduling prevents the system from sending applications that will sit unread in empty offices. The August reduced volume (rather than a complete halt) is the right balance -- some employers hire through August, but response rates are lower.

The implementation as configuration values in the rate_limits JSON (Section 14.1) means these can be adjusted without workflow changes. The Sunday send disable is combined with the bank holiday list to provide full weekend + holiday coverage.

The one missing element is variable school holidays (different dates in England, Scotland, Wales, and Northern Ireland). Since the candidate is England-based (Maidenhead, Berkshire), the England school holiday calendar is relevant. But this is a refinement, not a gap.

**Score: 7/10** (well-implemented, minor refinement possible)

**Recommendations:**
1. Consider adding a "reduced volume" flag that the candidate can toggle for any given week (e.g., attending a conference, taking a personal day)

---

**Round 15 -- "The filesystem cleanup script is production-ready with appropriate safety guards"**

v3 adds the full `scripts/purge_application_files.sh` implementation (Section 18.3) with: allowed directory list, path validation via `realpath`, dry-run mode, logging, and symlink resolution to prevent path traversal.

The script is well-structured:
- Uses `set -euo pipefail` for strict error handling
- Validates paths against an allowed directory whitelist
- Resolves symlinks via `realpath -m` to prevent traversal attacks
- Supports dry-run mode for safe testing
- Logs all actions to a dedicated log file
- Gets deleted application IDs from the database directly

The security guard against path traversal (`if [[ "$REAL_PATH" != "$BASE_DIR"* ]]`) correctly blocks attempts to escape the allowed directories. The use of `realpath` to canonicalize paths before comparison prevents both `..` traversal and symlink attacks.

The script runs after the Phase 2 SQL purge, which means it only targets records already marked as deleted in the database. Files for active applications cannot be accidentally deleted.

**Score: 8/10** (production-ready, security-conscious)

**Recommendations:**
1. Add a `--max-delete N` flag to prevent runaway deletion (default: 100 application directories per run)
2. Run the script as a dedicated non-root user with write access only to the allowed directories

---

**Round 16 -- "The extended log retention (30 days execution, 90 days errors) is adequate for breach investigation"**

v3 extends workflow execution log retention from 7 to 30 days (via EXECUTIONS_DATA_MAX_AGE=720) and error log retention from 30 to 90 days. This addresses the v2 concern that 7-day execution logs would be gone before most breaches are discovered.

30 days for execution logs provides a reasonable window for forensic investigation. Most breaches are discovered within 30 days (the 2025 IBM Cost of a Data Breach Report puts median detection time at 194 days for large organizations, but single-server systems with active monitoring detect faster). For a system with daily digest monitoring, anomalies should be noticed within 1-2 weeks.

90 days for error logs aligns with the applications table retention and provides overlap with the ICO's investigation timelines.

The trade-off is storage: n8n execution logs include full workflow input/output data. At 50-100 executions per day, 30 days of logs could consume significant disk space on the CAX31 (100 GB SSD). The storage impact should be monitored.

**Score: 7/10** (appropriate retention, storage impact to monitor)

**Recommendations:**
1. Monitor execution log disk usage weekly; add an alert if log storage exceeds 20 GB
2. Consider compressing execution logs older than 7 days (n8n may not support this natively; may need a cron job)

---

**Round 17 -- "The agency authorization confirmation workflow is well-designed but the quarterly review could be ignored"**

v3 adds explicit authorization confirmation for agencies: "Confirming auto-send to {agency_name}. This agency may submit your CV to employers on your behalf. Have you agreed to their terms of engagement? [Yes/No]." Per-agency opt-in (not global). Quarterly review reminder.

The confirmation prompt is the right granularity -- it forces the candidate to acknowledge the contractual implications of auto-sending to each agency. The per-agency approach prevents a blanket authorization that the candidate might later regret.

The quarterly review reminder prompts the candidate to review the authorized agencies list. But the reminder is part of the weekly report (or a quarterly special email), and the candidate can simply ignore it. There is no enforcement mechanism -- if the candidate does not act on the quarterly review, the authorized list remains unchanged indefinitely.

For a system designed for a specific candidate who understands the implications, this is acceptable. The quarterly reminder is a nudge, not a gate. But if the system runs for 2+ years, agency relationships may stale without the candidate actively maintaining the list.

**Score: 7/10** (well-designed, enforcement limitation acknowledged)

**Recommendations:**
1. Consider auto-revoking agency authorization after 6 months of no applications to that agency (with notification)
2. Include the authorized agency count and last-send date per agency in the quarterly review email

---

**Round 18 -- "The legal disclaimer update references specific legislation but may be too long for the email context"**

v3 updates the agency email disclaimer to reference the Conduct of Employment Agencies and Employment Businesses Regulations 2003 (Regulation 15) with specific legal requirements. The disclaimer now reads: "In accordance with the Conduct of Employment Agencies and Employment Businesses Regulations 2003 (Regulation 15), please do not submit my details to any employer without obtaining my explicit prior written consent for each specific role."

The legal specificity is an improvement -- it demonstrates the candidate is aware of the regulatory framework and sets clear expectations. However, the disclaimer is approximately 45 words long and is appended to what should be a concise agency response email (target: <150 words per Section 7.2 Rule 10). The disclaimer alone is 30% of the email's target word count.

In practice, agency recruiters skim candidate emails. A 45-word legal disclaimer at the bottom of a job application response is likely to be ignored or perceived as adversarial. Most candidates do not include legal disclaimers in their application emails. The presence of this disclaimer signals either legal sophistication (positive for senior candidates) or automation (negative).

The balance between legal protection and natural-sounding email is delicate. The disclaimer protects the candidate but slightly undermines the goal of emails that "pass as hand-written" (Section 7.2 Rule 7).

**Score: 7/10** (legally correct, practical trade-off)

**Recommendations:**
1. Offer a short-form alternative for known/authorized agencies: "As usual, please confirm before representing me to any employer."
2. Reserve the full legal disclaimer for first-contact agency emails only

---

**Round 19 -- "The soft-delete query exclusion is applied to views but may not cover all ad-hoc queries in workflows"**

v3 adds `AND status != 'deleted'` to the three views (v_active_applications, v_pending_actions, v_callback_rate). This prevents deleted records from appearing in dashboard-facing queries.

However, the workflow SQL (inline queries in n8n Code nodes and Postgres nodes) may not consistently use these views. WF-AP1's query (Section 15.1, Node 3) uses a direct query against the jobs table with a subquery against applications. The subquery's WHERE clause filters `status NOT IN ('failed', 'expired', 'withdrawn')` -- it does not include 'deleted'. A soft-deleted application record would not be in this exclusion list, meaning WF-AP1 would skip the job (because a non-excluded application exists), preventing re-application to that job even after deletion.

This is actually the desired behavior -- if the candidate soft-deleted an application, she probably does not want to re-apply to the same job. But the semantics are ambiguous: does "deleted" mean "I want to forget this application" or "I want to pretend it never happened and allow re-application"?

The soft-delete status should be treated as a terminal state (like 'failed' or 'withdrawn') in all queries. Adding it to the NOT IN list in WF-AP1 would allow re-application after deletion, which may or may not be desired.

**Score: 7/10** (views fixed, workflow queries need review, ambiguity in semantics)

**Recommendations:**
1. Add 'deleted' to the NOT IN exclusion list in WF-AP1's subquery so that deleted applications do not block re-application
2. Document the semantic meaning of soft-delete: "deleted applications are treated as if they never happened; the candidate can re-apply to the same job"

---

**Round 20 -- "The overall workflow architecture is coherent, well-scheduled, and within the CAX31's capacity"**

Looking at the complete system from an architecture perspective, the v3 PRD describes 9 workflows, 7 database tables, 4 views, 3 triggers, and supporting infrastructure. The schedule staggering (Module 1 at :00/:30, Module 2 at :05/:35, Module 3 at :15/:45) prevents resource contention. The daily/weekly reporting cycle is well-defined.

The workflow interaction model (WF-AP1 as router, WF-AP2/AP3 as engines, WF-AP4 as shared quality gate, WF-AP5 as webhook handler, WF-AP6 as maintenance/reporting) is clean. Sub-workflows are used appropriately (SW-AP1 for email composition, SW-AP2 for delivery tracking). The error handler (WF-AP0) provides global error coverage.

The database schema is normalized appropriately for the scale. The applications table carries all tracking state. The status history table provides audit trail. The config table centralizes settings. The known_contacts table supports agency relationship management. The email_suppressions table protects deliverability.

The system is deployable. The remaining concerns are all refinements (audit field implementation, query optimization, consent UX) rather than architectural issues. The architecture supports the stated goals and operates within the resource constraints of the CAX31.

**Score: 8/10** (architecturally sound, deployment-ready)

**Recommendations:**
1. Create an architecture diagram for the deployment guide that shows all 9 workflows, their triggers, and data flows
2. Add a resource estimation section: expected CPU, memory, and disk usage at steady state

---

#### Persona 2 Summary (v3): Technical Architect / n8n Expert

| Round | Concern | Score | v2 Score | Delta |
|-------|---------|-------|----------|-------|
| 11 | Resend idempotency keys fix duplicate-send problem | 8 | 4 | +4 |
| 12 | Structured audit columns partial fix; JSONB still used for IP/UA | 6 | 5 | +1 |
| 13 | Serial processing documented with migration path | 7 | 5 | +2 |
| 14 | Bank holiday and seasonal scheduling well-integrated | 7 | 5 | +2 |
| 15 | Filesystem cleanup script production-ready | 8 | 5 | +3 |
| 16 | Extended log retention adequate for investigation | 7 | 4 | +3 |
| 17 | Agency authorization confirmation well-designed | 7 | 5 | +2 |
| 18 | Legal disclaimer legally correct, practical trade-off | 7 | 5 | +2 |
| 19 | Soft-delete views fixed, workflow queries need review | 7 | 5 | +2 |
| 20 | Overall architecture coherent and deployment-ready | 8 | 5 | +3 |
| **Average** | | **7.2** | **5.4** | **+1.8** |

**Top 3 Remaining Issues:**
1. Audit fields for source_ip and user_agent still depend on JSONB metadata with unsafe INET cast (Round 12)
2. Soft-delete semantics ambiguous -- does deletion allow re-application? (Round 19)
3. Serial batch processing acceptable at current scale but needs queue depth monitoring (Round 13)

---

### 22.3 Persona 3: UK Employment Law / Recruitment Expert

*Context: Evaluating whether v3 fixes for agency compliance, scheduling, and legal framework are sufficient for deployment in the UK L&D job market.*

---

**Round 21 -- "The Regulation 15 disclaimer is legally specific and sets the right tone for candidate protection"**

v3 updates the agency disclaimer with a direct reference to Regulation 15 of the Conduct of Employment Agencies Regulations 2003. The full disclaimer requires the agency to obtain "explicit prior written consent for each specific role" before submitting the candidate to an employer.

This is a strong improvement. The reference to specific legislation signals legal awareness and creates a documented audit trail. If an agency submits the candidate without consent, the candidate has a clear basis for complaint to the Employment Agency Standards Inspectorate.

The practical limitation (agencies may ignore the disclaimer) remains, but the system has done what it can. The authorized_agencies framework provides additional protection by limiting auto-send to agencies with established relationships. The first-contact hold ensures unknown agencies always get human review.

The combination of legal disclaimer + first-contact hold + authorized-only auto-send + quarterly review is a defensible compliance posture. It will not prevent all unauthorized submissions by agencies, but it demonstrates due diligence by the candidate.

**Score: 7/10** (appropriate compliance posture for the regulatory context)

**Recommendations:**
1. Add a guidance note in the weekly report when the candidate applies to a new agency: "You have sent your CV to a new agency ({name}). Consider establishing formal terms before authorizing auto-send."

---

**Round 22 -- "The Christmas/New Year blackout and August reduced volume reflect UK market reality"**

v3 adds a Christmas/New Year blackout (23 Dec - 2 Jan: hold all sends) and August reduced volume (max 8 emails/day) to the rate limiting configuration. UK bank holidays are sourced from gov.uk.

These settings accurately reflect the UK hiring market. Most corporate and academic HR departments operate at reduced capacity during these periods. The Christmas blackout prevents applications from arriving in empty inboxes. The August reduction (rather than a full halt) balances the reality that some hiring continues through summer with the lower likelihood of prompt responses.

The bank holiday list from gov.uk is the authoritative source and covers England/Wales holidays (appropriate for a Berkshire-based candidate). Scotland and Northern Ireland have different bank holidays, but this is irrelevant for the candidate's primary market.

The only gap is Easter: the bank holiday list covers Good Friday and Easter Monday, but the week between (the Easter school holiday) is a low-activity period similar to the Christmas week. The system does not reduce volume during Easter week, though many HR professionals take the full week off.

**Score: 7/10** (accurate market awareness, minor Easter gap)

**Recommendations:**
1. Consider adding an Easter week reduced volume (similar to August) as a configurable option

---

**Round 23 -- "The closing date enforcement aligns with professional application standards"**

v3's closing date enforcement (filtering expired jobs, prioritizing imminent deadlines) is the correct approach for the UK job market. UK employers generally enforce closing dates more strictly than US employers. Jobs.ac.uk listings have hard close dates. Civil Service jobs close at midnight on the stated date. NHS Jobs enforces closing dates at the portal level (the form becomes unavailable).

The priority ordering (imminent deadlines first) ensures that the system focuses its limited sending capacity on time-sensitive applications. A job closing in 48 hours takes precedence over an open-ended agency listing.

The NULL handling (treat unknown closing dates as open) is correct for the UK market where many agency and corporate listings do not state closing dates. The implicit assumption that these roles remain open until filled is standard practice.

**Score: 7/10** (correct for the UK market context)

---

**Round 24 -- "The agency DOCX format remains a concern but the risk is documented"**

The DOCX-for-agencies convention remains in v3 (Section 7.5). The v2 concern about agencies modifying CV content is valid but is an industry practice issue, not a system design flaw. The system sends what agencies expect to receive. Withholding DOCX would reduce the candidate's competitiveness with agencies that rely on ATS parsing.

The known_contacts table could support per-agency format preferences (some agencies prefer PDF, some DOCX), but this refinement is not critical for launch. The default DOCX-for-agencies is the pragmatic choice.

**Score: 7/10** (pragmatic default, refinement possible)

---

**Round 25 -- "The referee consent tracking in Section 18.11 is a genuine compliance addition"**

v3 adds Section 18.11 with referee consent requirements: candidate must confirm referee consent before first use, the system reminds before academic applications where referees are contacted pre-interview, and referee details can be updated or removed at any time.

This addresses the v1/v2 gap where referee data was stored and shared without a documented consent framework. The requirement to confirm consent before first use and the pre-academic-application reminder create a practical compliance workflow.

The remaining limitation is that the system has no mechanism to contact referees directly for consent confirmation -- it relies on the candidate doing this offline. For UK GDPR purposes, the candidate (as controller) is responsible for obtaining referee consent, and the system (as processor) is responsible for facilitating this. The system facilitates by reminding; the candidate executes.

**Score: 7/10** (practical compliance framework)

---

**Round 26 -- "The system correctly avoids automating any ATS portal interaction"**

The v3 PRD maintains its strict policy of no browser automation against any ATS platform (Section 8.1). Workday, Taleo, LinkedIn, Indeed, NHS Jobs, Civil Service Jobs -- all are handled via manual task cards. This is the correct ethical and legal position.

The task card system has matured across three PRD versions. The portal-specific instructions (Workday, Taleo, Stonefish, Civil Service, NHS Jobs, LinkedIn) are detailed and practical. Date format handling per portal is specified. The supporting statement generation for academic roles covers the unique requirements of UK higher education applications.

The estimated completion time for task cards (3-5 minutes for simple portals, 5-10 minutes for complex portals) is realistic based on the task card structure. The pre-formatted data, clipboard-ready text blocks, and step-by-step instructions reduce the cognitive load of portal applications.

**Score: 8/10** (correct design philosophy, well-executed)

---

**Round 27 -- "The speculative application handling is appropriately conservative"**

The system supports speculative applications but defaults to manual-only (auto_send_speculative: false). The email composition prompt includes a speculative variant (Section 7.2, Rule 11) with different emphasis and longer format. The PRD does not automate speculative outreach -- it prepares materials and holds for approval.

This is the right approach. Speculative applications carry higher legal and reputational risk than responses to advertised roles. The candidate controls when and to whom speculative applications are sent. The system's role is preparation, not initiation.

**Score: 7/10** (appropriately conservative)

---

**Round 28 -- "The candidate's right-to-work field is now handled as a single factual value"**

v2 flagged that the task card presented multiple right-to-work options (British Citizen / Settled Status / ILR) as interchangeable. The candidate_profile in v3 stores "right_to_work": "Yes - Settled Status" as a single factual value. The task card should now display only this value, not a menu of alternatives.

The right-to-work handling is factually correct. "Settled Status" is a specific immigration category under the EU Settlement Scheme. The task card presents it as a pre-filled value that the candidate can override at the point of application if needed.

**Score: 7/10** (correctly handled as factual data)

---

**Round 29 -- "The overall legal and compliance framework is deployment-ready for a single-user system"**

Taking a holistic view of the legal and compliance posture: the v3 PRD addresses the Equality Act (Section 13.1 with equality monitoring handled correctly), UK GDPR (Sections 18.1-18.11 with DPIA, Article 22, TIA, DPA, consent management, incident response), Employment Agencies Regulations (Section 13.1 with authorized agencies and legal disclaimer), platform ToS compliance (Section 13.2 with no portal automation), and PECR (Section 13.2 with speculative application controls).

For a single-user system operated by the data subject herself, this is a thorough compliance framework. The main gaps are all execution items (sign DPAs, complete full DPIA, verify DPF certification) rather than design gaps.

**Score: 7/10** (compliance framework complete, execution pending)

---

**Round 30 -- "The ethical tension between quality and disclosure is honestly acknowledged"**

The PRD's handling of the AI-generated content question (Section 13.3) is pragmatic: no legal requirement to disclose, but the candidate should be comfortable with the content. The v3 system's quality mechanisms (banned phrases, factual accuracy checks, B-tier sampling, A-tier approval) create multiple layers of quality assurance.

The system does not claim to replace human judgment -- it claims to produce output "comparable to or better than a rushed manual email" (Section 10.5). This is a defensible position. The quality sampling mechanism provides ongoing calibration data. The A-tier approval flow ensures high-value applications get human review.

The ethical question of whether AI-generated application emails constitute "misrepresentation" is a societal question, not a system design question. The PRD acknowledges the tension without resolving it, which is the honest approach.

**Score: 7/10** (honest treatment of an inherently unresolvable tension)

---

#### Persona 3 Summary (v3): UK Employment Law / Recruitment Expert

| Round | Concern | Score | v2 Score | Delta |
|-------|---------|-------|----------|-------|
| 21 | Agency disclaimer legally specific and appropriate | 7 | 5 | +2 |
| 22 | Holiday scheduling reflects UK market reality | 7 | 5 | +2 |
| 23 | Closing date enforcement aligns with UK practice | 7 | 5 | +2 |
| 24 | Agency DOCX format pragmatic, refinement possible | 7 | 5 | +2 |
| 25 | Referee consent tracking is a compliance addition | 7 | N/A | new |
| 26 | No ATS automation is correct and well-executed | 8 | N/A | new |
| 27 | Speculative application handling appropriately conservative | 7 | 5 | +2 |
| 28 | Right-to-work handled as factual value | 7 | 5 | +2 |
| 29 | Overall legal framework deployment-ready | 7 | 5 | +2 |
| 30 | Ethical AI content disclosure honestly handled | 7 | N/A | new |
| **Average** | | **7.1** | **5.1** | **+2.0** |

**Top 3 Remaining Issues:**
1. Agency DOCX format enables CV modification -- per-agency format preference would be better (Round 24)
2. Easter week reduced volume not included in holiday scheduling (Round 22)
3. Compliance execution items (DPA signing, DPIA completion) are pending Phase 1 tasks (Round 29)

---

### 22.4 Persona 4: Security & Anti-Fraud Specialist

*Context: Evaluating v3 security posture holistically -- has the system reached a defensible security position for deployment?*

---

**Round 31 -- "The atomic token consumption is the correct cryptographic primitive for this use case"**

v3's atomic UPDATE...RETURNING for token consumption (Section 10.3) is the right approach. It eliminates the TOCTOU race condition at the database level. PostgreSQL guarantees that the UPDATE is atomic -- only one concurrent request can set approval_token_consumed to true and receive a RETURNING row.

The token generation itself (HMAC-SHA256 with base64url encoding) is standard and secure. The 72-hour expiry limits the attack window. The single-use enforcement prevents replay. The two-step flow (GET confirmation page, POST action) prevents email scanner accidental triggers.

The combined security model (HMAC signature + expiry + single-use + two-step) provides adequate protection for the threat model. The main remaining attack vector is token interception (someone reading the candidate's email), which is mitigated by email security (TLS) and the token expiry.

**Score: 8/10** (correct security primitives, well-implemented)

---

**Round 32 -- "The credential management framework (Section 5.7) is comprehensive for a single-server deployment"**

v3's credential management covers: N8N_ENCRYPTION_KEY generation (openssl rand -hex 32), APPROVAL_SECRET rotation (90 days with outstanding token handling), API key storage (n8n encrypted credential store), server security (LUKS, SSH key-only, Postgres localhost-only), and a rotation schedule.

This is a defensible security posture for a single-server deployment. The weakest link is the n8n encrypted credential store, which depends on the N8N_ENCRYPTION_KEY. The key is stored in a .env file with chmod 600 permissions, injected via environment variable. This is standard Docker credential management -- not ideal, but appropriate for the scale.

The APPROVAL_SECRET rotation every 90 days with automatic expiry of outstanding tokens and re-generation of approval notifications is well-designed. The operational disruption is manageable (the candidate receives new approval emails for pending applications).

**Score: 7/10** (appropriate for the deployment scale and threat model)

---

**Round 33 -- "The PII minimization implementation reduces the data exposure surface for Claude API"**

v3's PII minimization (Section 18.4, SW-AP1 implementation) reduces the data sent to Anthropic from {name, email, phone, address, title, qualifications, experience} to {title, qualifications, experience} with CANDIDATE_NAME as a placeholder. The candidate's contact details are never sent to Claude.

This is a meaningful reduction. The remaining data (title, qualifications, experience) is necessary for generating relevant email content and cannot be further minimized without degrading quality. The post-processing re-injection of name and contact details is a straightforward string replacement.

The privacy benefit is that even if Anthropic's API logs are compromised, the attacker would see professional profile information (title, qualifications) but not personally identifiable information (name, email, phone, address). The profile data alone is not sufficient to identify the candidate.

**Score: 7/10** (effective PII reduction, well-implemented)

---

**Round 34 -- "The email suppression list design is appropriate with documented limitation"**

The email suppression list (Section 12.3) blocks sends to hard-bounced addresses and domains flagged by complaints. The design is standard for email sending systems.

The v2 concern about suppression list poisoning (an attacker triggering a complaint to block a legitimate domain) is a real but low-probability attack. The system's mitigation is that complaints trigger an alert to the candidate and pause sends to the domain. The candidate can review and unsuppress if the complaint was illegitimate.

For a single-user system sending 20-40 applications per week, the suppression list will remain small (likely <50 entries per year). Manual review of suppressions is practical at this scale.

**Score: 7/10** (appropriate for scale, manual review is practical)

---

**Round 35 -- "The webhook signature validation should use timing-safe comparison"**

This v2 concern (Round 15) remains in v3. The HMAC signature comparisons in both webhook handlers (Resend delivery tracking and approval token validation) use `===` / `!==` instead of `crypto.timingSafeEqual()`. The fix is trivial (one-line change per comparison) and is standard security practice.

The practical risk is low (timing attacks over the internet are difficult due to network jitter), but the fix is so simple that leaving it unimplemented is an unnecessary exposure.

**Score: 6/10** (trivial fix not applied -- the only reason this is not 7+)

**Recommendations:**
1. Replace `signature !== expectedSig` with `!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))` in both webhook handlers

---

**Round 36 -- "The webhook paths are still predictable but the signature validation provides adequate protection"**

v2 recommended randomizing webhook paths. v3 does not implement this. The paths remain:
- `/webhook/application-action`
- `/webhook/application-action-confirm`
- `/webhook/resend-delivery-events`
- `/webhook/application-complete`

At this point in the evaluation, the risk should be assessed realistically. The webhooks are protected by: HMAC signature validation (Resend), token validation (approval), and signature validation (completion). An attacker who knows the paths but not the secrets cannot trigger any action. They can send requests that are immediately rejected, consuming n8n execution resources.

The resource consumption attack is the real risk. Each rejected request still triggers an n8n workflow execution. At the n8n free/self-hosted tier, execution limits are not a concern, but CPU/memory on the CAX31 is finite. Rate limiting at the Traefik level (Dokploy's reverse proxy) would mitigate this.

For a system that is not a high-value target (a single person's job application engine), the attack incentive is low. The signature-validated webhooks provide adequate security.

**Score: 7/10** (signature validation is the real protection; path randomization is defense-in-depth)

---

**Round 37 -- "The incident response plan provides clear containment procedures"**

v3's incident response plan (Section 18.9) covers: incident categories, severity levels, 7-step response (contain, assess, preserve, notify, report, remediate, review), emergency PAUSE, hard halt via environment variable, and ICO contact information.

The plan is actionable. The timeframes (contain within 1 hour, assess within 4 hours, ICO within 72 hours) are reasonable. The distinction between credential compromise (Critical) and system malfunction (Medium) reflects the actual risk hierarchy. The evidence preservation step (export logs before credential rotation) is important and often forgotten.

The hard halt mechanism (EMERGENCY_HALT=true environment variable) provides a last-resort stop that bypasses all application logic. Even if the database is compromised, setting this variable prevents email sends.

**Score: 7/10** (actionable and appropriate for the deployment context)

---

**Round 38 -- "The overall attack surface is manageable and documented"**

Looking at the complete attack surface:
- **Webhook endpoints:** 4 endpoints, all signature-validated
- **Email sending:** via Resend API with idempotency keys
- **Database:** Postgres, localhost-only, authenticated
- **Server:** SSH key-only, LUKS encrypted
- **API keys:** n8n encrypted store, rotation schedule
- **Approval tokens:** HMAC-signed, time-limited, single-use, atomic consumption

The attack surface is small and well-defined. The most likely attack vector is email account compromise (access to the candidate's email reveals approval tokens and system emails). The mitigation is token expiry (72 hours) and single-use enforcement.

The second most likely vector is server compromise (SSH key theft). The mitigation is SSH key-only authentication and LUKS disk encryption. The incident response plan provides containment procedures.

For a single-user job application system, this is an appropriate security posture. Enterprise-grade controls (WAF, SIEM, EDR) are not justified for the threat model.

**Score: 7/10** (appropriate security posture for the deployment context)

---

**Round 39 -- "The data deletion procedure with soft-delete provides a safety net"**

v3's two-phase deletion (soft-delete, then permanent purge after 30 days) with transaction wrapping and the separate filesystem cleanup script provides a complete and safe deletion procedure.

The 30-day retention window allows recovery from accidental deletion. The transaction wrapping ensures database consistency. The filesystem cleanup script has path validation and dry-run mode.

The Resend retention note ("Full deletion requires contacting Resend separately") is honest and appropriate -- the system cannot control third-party data retention.

**Score: 7/10** (complete deletion procedure with appropriate safety nets)

---

**Round 40 -- "The security posture is deployment-ready with two minor items to address"**

The v3 security posture has evolved from "multiple critical gaps" (v1: 3.8/10) through "improvements with race conditions" (v2: 5.1/10) to a defensible deployment position. The remaining security items are:

1. **Timing-safe comparison** (trivial fix, Round 35)
2. **JSONB metadata fragility for audit fields** (Round 12, functional but inelegant)

Neither is a deployment blocker. Both are low-risk improvements that should be addressed during implementation.

**Score: 7/10** (deployment-ready security posture)

---

#### Persona 4 Summary (v3): Security & Anti-Fraud Specialist

| Round | Concern | Score | v2 Score | Delta |
|-------|---------|-------|----------|-------|
| 31 | Atomic token consumption correctly implemented | 8 | 5 | +3 |
| 32 | Credential management comprehensive for single-server | 7 | 6 | +1 |
| 33 | PII minimization reduces Claude API exposure | 7 | 5 | +2 |
| 34 | Email suppression list appropriate for scale | 7 | 5 | +2 |
| 35 | Timing-safe comparison still not implemented | 6 | 6 | 0 |
| 36 | Webhook paths predictable but adequately protected | 7 | 5 | +2 |
| 37 | Incident response plan actionable | 7 | 4 | +3 |
| 38 | Overall attack surface manageable | 7 | N/A | new |
| 39 | Data deletion procedure safe and complete | 7 | 5 | +2 |
| 40 | Security posture deployment-ready | 7 | 5 | +2 |
| **Average** | | **7.0** | **5.1** | **+1.9** |

**Top 3 Remaining Issues:**
1. Timing-safe comparison not implemented for HMAC validation (Round 35) -- trivial fix
2. Audit fields for source_ip/user_agent still depend on JSONB metadata (Round 12, cross-reference)
3. Webhook rate limiting at reverse proxy level not yet configured (Round 36)

---

### 22.5 Persona 5: Privacy & Compliance Officer

*Context: Final assessment of GDPR compliance posture after v3 additions of DPIA, Article 22 analysis, TIA, DPA framework, consent management, and incident response. Is this deployable under UK GDPR?*

---

**Round 41 -- "The DPIA (Section 18.6) meets the structural requirements of Article 35"**

v3's DPIA summary covers the required elements: processing purpose, data subjects, legal basis, necessity and proportionality assessment, risk identification with mitigations, risk level assessment (Medium), safeguards, and review schedule (every 6 months).

The five identified risks (AI hallucination, fraudulent postings, duplicates, PII exposure to Claude, referee data sharing) are mapped to specific mitigations (QA gate, scam detection, dedup, PII minimization, consent tracking). This is a genuine risk assessment, not a checkbox exercise.

The risk level assessment (Medium -- single data subject who is also the controller) is reasonable. Most GDPR risks are reduced when the data subject and controller are the same person, because the consent and rights dimensions collapse.

The DPIA document location (/docs/compliance/dpia-module-3.md) signals that a fuller document will be created during Phase 1. The PRD summary is sufficient for design review; the full document is needed for compliance records.

**Score: 7/10** (structural requirements met, full document pending Phase 1)

---

**Round 42 -- "The Article 22 analysis (Section 18.7) correctly identifies the exception and safeguards"**

v3's Article 22 analysis addresses B-tier auto-send as solely automated decision-making with employment-related impact. It correctly identifies Article 22(2)(c) (explicit consent) as the exception basis. The four safeguard measures (multi-channel PAUSE, daily digest review, application withdrawal, B-tier quality sampling) are documented.

The consent capture implementation is specified: a setup-time consent form with the text "I consent to automated sending of B-tier job applications on my behalf. I understand I can pause or cancel auto-send at any time." The consent timestamp and method are stored in application_config.

The analysis acknowledges that pausing auto-send revokes consent, which is correct. The right to obtain human review is documented (A-tier approval flow, plus the ability to switch any tier to require approval).

The one gap is the irrevocability point: the analysis does not explicitly address the fact that auto-sent emails cannot be un-sent. Under Article 22(3), the data subject should be able to "contest the decision." Contesting an auto-sent email means withdrawing the application -- but the email has already been received. The system can mark the application as withdrawn, but it cannot unsend the email.

This is an inherent limitation of email-based communication, not a system design flaw. The DPIA should document it as a residual risk with the mitigation being the quality gate checks that minimize the probability of a bad auto-send.

**Score: 7/10** (correct analysis, irrevocability acknowledged as residual risk)

---

**Round 43 -- "The TIA (Section 18.8) addresses both Resend and Anthropic with reasonable assessments"**

v3's Transfer Impact Assessments cover both US-based processors with the required analysis: data transferred, transfer mechanism (SCCs), US legal framework (DPF if certified, or SCCs), government access risk, supplementary measures, and conclusions.

The assessments are reasonable and proportionate. The risk of US government access to routine job application data is assessed as Low, which is defensible. The supplementary measures (TLS encryption, SOC 2 for Resend, API data not used for training for Anthropic, PII minimization) are practical.

The conditional language ("if Resend is certified" under DPF) is appropriate -- the PRD cannot assert certification status without verification. The pre-launch checklist should include DPF certification checks.

The TIA document location (/docs/compliance/tia-module-3.md) follows the same pattern as the DPIA -- summary in the PRD, full document in Phase 1.

**Score: 7/10** (reasonable assessments, verification pending Phase 1)

---

**Round 44 -- "The DPA framework (Section 18.5) establishes clear controller-processor relationships"**

v3's DPA section identifies three processors (Resend, Anthropic, Hetzner), specifies the data each processes, lists DPA requirements (scope, sub-processors, breach notification, deletion, audit rights), and provides a pre-launch checklist.

This is the most significant compliance addition in v3. The v1/v2 evaluations consistently identified the undefined controller-processor relationship as a critical gap. v3 closes it by identifying the processors, specifying DPA requirements, and creating an execution checklist.

The DPA requirements list (scope of processing, data categories, sub-processor disclosure, 72-hour breach notification, deletion on termination, audit rights) covers the Article 28 essentials. The checklist is actionable.

The system operator (developer) as a processor is not explicitly addressed in the DPA section, though Section 5.7 acknowledges their existence ("SSH access limited to the system operator"). If the developer is a separate person from the candidate, a DPA between them is still needed. But if the candidate operates the system herself (with the developer only creating it, not maintaining it), no DPA is needed.

**Score: 7/10** (correct framework, developer-as-processor ambiguity remains)

**Recommendations:**
1. Add a clarifying note: "If the system is maintained by a developer other than the candidate, a DPA between the candidate (controller) and developer (processor) is required under Article 28"

---

**Round 45 -- "The granular consent management (Section 18.10) provides meaningful privacy controls"**

v3's consent management with per-activity consent items (B-tier auto-send, Claude API, Resend, referee sharing, email tracking) and revocation effects provides genuine data subject control. Each consent item has a clear processing activity and a defined consequence for revocation.

The consent storage schema (JSON in application_config with per-item consent flag, timestamp, and method) is practical. The immediate revocation effect ensures that consent withdrawal takes effect without delay.

The system-setup consent form (served via n8n webhook) captures initial consent. The daily/weekly reports should include a link to review consent settings.

This is a well-designed consent framework that transforms the system from "all-or-nothing" to "granular control." The candidate can use the system for portal preparation (no email sending, no Claude API, no tracking) if she revokes the email-related consents.

**Score: 7/10** (meaningful privacy controls, self-service review needed)

---

**Round 46 -- "The referee consent tracking (Section 18.11) addresses third-party data rights"**

v3 adds Section 18.11 requiring candidate confirmation of referee consent before first use, pre-academic-application reminders, and the ability to update or remove referee details.

For a single-user system, this is an appropriate level of referee data protection. The candidate is responsible for obtaining referee consent (standard practice in job applications). The system facilitates by reminding.

The remaining gap is that referee details are stored in application_config alongside system configuration, without separate access controls or retention limits. A dedicated referees table with consent dates would be cleaner, but the current approach is functional.

**Score: 7/10** (practical referee data handling)

---

**Round 47 -- "The Resend data processing scope is now accurately characterized"**

v3 correctly describes Resend as processing the full email message including body text, subject line, and all attachments. The TIA covers the transfer implications. The DPA requirements include Resend. The data classification table correctly identifies email content as Personal Data + Business Communication.

The transformation from v1 (incorrect: "CV content is in attachments, not processed by Resend") to v3 (correct: full MIME message processing) is one of the most important corrections across all three evaluation rounds. The privacy analysis is now built on accurate assumptions.

**Score: 8/10** (accurate characterization, correctly integrated into compliance framework)

---

**Round 48 -- "The log retention alignment supports both operational and compliance needs"**

v3's retention schedule (30 days execution logs, 90 days error logs, 6 months email content, 12 months application records, indefinite metrics) is now aligned with both operational needs and compliance requirements.

The 90-day error log retention supports breach investigation timelines. The 30-day execution log retention provides operational forensics. The 6-month email content retention provides dispute resolution evidence. The 12-month application record retention covers the typical UK job search cycle.

The n8n configuration change (EXECUTIONS_DATA_MAX_AGE=720) is specified, making the retention enforceable at the platform level.

**Score: 7/10** (aligned retention schedule with enforcement mechanism)

---

**Round 49 -- "The privacy-by-design documentation is implicit but not explicit"**

The v3 PRD implements many privacy-by-design principles: PII minimization for Claude API, granular consent, no equality monitoring pre-fill, data retention limits, soft-delete, encryption at rest and in transit. But these are scattered across 18+ sections without a unified privacy-by-design narrative.

Article 25 compliance is demonstrated by the design decisions themselves, not by a dedicated documentation section. For a PRD intended for developers (not regulators), this is acceptable. The DPIA summary references the safeguards. The compliance documents planned for Phase 1 can assemble the privacy-by-design narrative from the PRD content.

**Score: 7/10** (implicit compliance, explicit documentation can follow in Phase 1)

---

**Round 50 -- "The overall UK GDPR compliance posture is deployment-ready with execution conditions"**

The v3 PRD addresses all major UK GDPR requirements:

| Requirement | Status |
|-------------|--------|
| Lawful basis (Article 6) | Legitimate interest + explicit consent for auto-send |
| Special categories (Article 9) | No pre-fill of equality monitoring data |
| Data subject rights (Articles 15-22) | Export, deletion, rectification, portability mechanisms |
| Automated decision-making (Article 22) | Analysis with consent exception and safeguards |
| Controller-processor (Article 28) | DPA framework with pre-launch checklist |
| International transfers (Chapter V) | TIA for Resend and Anthropic |
| Security (Article 32) | Encryption, access controls, credential management |
| DPIA (Article 35) | Summary in PRD, full document planned for Phase 1 |
| Breach notification (Articles 33-34) | Incident response plan with ICO timelines |
| Privacy by design (Article 25) | Multiple design decisions, implicit documentation |
| Consent (Article 7) | Granular consent management with revocation |

The compliance posture has evolved from "serious gaps" (v1: 2.9/10) through "acknowledged but unfulfilled" (v2: 4.1/10) to "framework complete, execution pending" (v3). The execution conditions are: sign DPAs, complete full DPIA document, verify DPF certification, and capture initial consent.

These are Phase 1 tasks, not design gaps. The PRD provides the blueprint; the rollout executes it.

**Score: 7/10** (compliance framework complete, deployment-ready with Phase 1 execution)

---

#### Persona 5 Summary (v3): Privacy & Compliance Officer

| Round | Concern | Score | v2 Score | Delta |
|-------|---------|-------|----------|-------|
| 41 | DPIA meets Article 35 structural requirements | 7 | 4 | +3 |
| 42 | Article 22 analysis correctly identifies exception and safeguards | 7 | 4 | +3 |
| 43 | TIA addresses both US-based processors reasonably | 7 | 4 | +3 |
| 44 | DPA framework establishes clear controller-processor relationships | 7 | 3 | +4 |
| 45 | Granular consent management provides meaningful controls | 7 | 4 | +3 |
| 46 | Referee consent tracking addresses third-party data | 7 | N/A | new |
| 47 | Resend data processing scope accurately characterized | 8 | 5 | +3 |
| 48 | Log retention aligned with compliance needs | 7 | 4 | +3 |
| 49 | Privacy-by-design implicit but not explicit | 7 | 4 | +3 |
| 50 | Overall GDPR compliance deployment-ready | 7 | 4 | +3 |
| **Average** | | **7.1** | **4.1** | **+3.0** |

**Top 3 Remaining Issues:**
1. Developer-as-processor ambiguity -- if maintained by someone other than the candidate, a DPA is needed (Round 44)
2. Privacy-by-design documentation is implicit; could be assembled into explicit Article 25 narrative (Round 49)
3. Full DPIA and TIA documents are planned for Phase 1 but not yet written (Rounds 41, 43)

---

### 22.6 Overall v3 Evaluation Summary

#### Persona Averages (v3 vs v2 vs v1)

| Persona | v3 Score | v2 Score | v1 Score | v2->v3 Delta | v1->v3 Delta |
|---------|----------|----------|----------|-------------|-------------|
| 1. The Candidate (Selvi) | 7.1 | 5.2 | 3.6 | +1.9 | +3.5 |
| 2. Technical Architect | 7.2 | 5.4 | 4.0 | +1.8 | +3.2 |
| 3. UK Employment Law Expert | 7.1 | 5.1 | 4.3 | +2.0 | +2.8 |
| 4. Security Specialist | 7.0 | 5.1 | 3.8 | +1.9 | +3.2 |
| 5. Privacy & Compliance Officer | 7.1 | 4.1 | 2.9 | +3.0 | +4.2 |
| **Overall Average** | **7.1** | **5.0** | **3.7** | **+2.1** | **+3.4** |

#### Score Distribution (v3 vs v2 vs v1)

| Score Range | v3 Count | v3 % | v2 Count | v2 % | v1 Count | v1 % |
|-------------|----------|------|----------|------|----------|------|
| 1-2 (Critical) | 0 | 0% | 0 | 0% | 5 | 10% |
| 3-4 (Significant) | 0 | 0% | 14 | 28% | 36 | 72% |
| 5-6 (Moderate) | 2 | 4% | 36 | 72% | 9 | 18% |
| 7-8 (Good) | 48 | 96% | 0 | 0% | 0 | 0% |
| 9-10 (Excellent) | 0 | 0% | 0 | 0% | 0 | 0% |

#### Key Improvements in v3

1. **GDPR compliance framework** (v2: 4.1/10, v3: 7.1/10): DPIA, Article 22 analysis, TIA, DPA framework, consent management, and incident response transform the privacy posture from "gaps requiring remediation" to "framework complete, execution pending."
2. **Quality assurance** (v2: 4/10, v3: 7/10): B-tier quality sampling with rolling average threshold and auto-pause provides ongoing quality monitoring. Module 2 output validation prevents cross-module quality failures.
3. **Duplicate send prevention** (v2: 4/10, v3: 8/10): Resend idempotency keys + atomic token consumption provide defense-in-depth against the two duplicate-send scenarios (crash recovery and concurrent approval clicks).
4. **Operational maturity** (v2: 5/10, v3: 7+/10): Bank holiday scheduling, closing date enforcement, filesystem cleanup script, extended log retention, and agency authorization confirmation demonstrate production-readiness.

#### Remaining Items (Ranked by Priority)

**Must Complete Before Launch (Phase 1 execution items -- framework exists, execution needed):**

| # | Item | Type | Section |
|---|------|------|---------|
| 1 | Sign DPAs with Resend, Anthropic, Hetzner | Compliance execution | 18.5 |
| 2 | Verify DPF certification for Resend and Anthropic | Compliance verification | 18.8 |
| 3 | Create full DPIA document | Compliance documentation | 18.6 |
| 4 | Create full TIA document | Compliance documentation | 18.8 |
| 5 | Capture initial consent via setup form | Compliance implementation | 18.10 |

**Should Fix During Implementation (code-level improvements):**

| # | Item | Type | Effort |
|---|------|------|--------|
| 1 | Replace HMAC `===` with `crypto.timingSafeEqual()` | Security | 15 minutes |
| 2 | Safe-cast INET in audit trigger (or migrate to direct columns) | Reliability | 1 hour |
| 3 | Add `deleted` to NOT IN exclusion in WF-AP1 subquery | Data integrity | 15 minutes |
| 4 | Add content-job alignment check (company name in cover letter) | Quality | 30 minutes |
| 5 | Add consent review link to weekly report | UX | 1 hour |

**Nice-to-Have (post-launch refinements):**

| # | Item | Persona | Score |
|---|------|---------|-------|
| 1 | Per-agency CV format preference (DOCX vs PDF) | Legal | 7 |
| 2 | Easter week reduced volume | Legal | 7 |
| 3 | Queue depth monitoring metric in daily digest | Technical | 7 |
| 4 | Developer-as-processor DPA clarification | Privacy | 7 |
| 5 | Privacy-by-design narrative document | Privacy | 7 |

---

### 22.7 Deployment Readiness Assessment

| Dimension | v1 | v2 | v3 | Deployment Ready? |
|-----------|----|----|----|--------------------|
| **Architecture** | Solid base, reliability gaps | Core reliability fixed | Coherent, well-scheduled, within capacity | Yes |
| **Security** | Multiple critical gaps | Improvements with race conditions | Defensible posture, minor items remaining | Yes |
| **Privacy/GDPR** | Serious compliance gaps | Acknowledged but unfulfilled | Framework complete, execution pending | Yes (with Phase 1 conditions) |
| **Legal/Employment** | Shallow treatment | Agency and equality fixes | Comprehensive UK-specific framework | Yes |
| **Candidate Experience** | Insufficient control and visibility | Improved controls, quality gaps | Quality sampling, consent management, incident response | Yes |
| **Integration (Mod 1-2-3)** | Correct interfaces | Cross-module quality gap | Module 2 output validation, closing date enforcement | Yes |

**Overall: The PRD is deployment-ready.** The remaining items are execution tasks (signing DPAs, completing compliance documents) and code-level refinements (timing-safe comparison, INET cast safety), not design gaps. The system can proceed to Phase 1 implementation.

---

*End of 50-Round Critical Roleplay Evaluation (v3 - FINAL)*

*Overall assessment: The v3 PRD has achieved a defensible deployment posture across all five evaluation dimensions. The progression from v1 (3.7/10) through v2 (5.0/10) to v3 (7.1/10) reflects three rounds of substantive improvements: v1->v2 fixed critical security and control gaps; v2->v3 completed the compliance framework and added quality assurance mechanisms. The system is ready for implementation with the understanding that Phase 1 includes compliance execution (DPA signing, DPIA/TIA completion, consent capture) as blocking prerequisites before any emails are sent. The five minor code-level items (timing-safe comparison, INET cast, deleted status exclusion, content-job alignment, consent review UX) should be addressed during implementation as standard engineering practice.*

*This concludes the 150-round evaluation series across three PRD versions.*
