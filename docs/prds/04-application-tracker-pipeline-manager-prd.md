# Module 4: Application Tracker & Pipeline Manager -- Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-29
**Author:** Selvi Job App Engineering
**Status:** Draft (v2 -- evaluation fixes applied)
**System:** Selvi Job App
**Module:** 04 -- Application Tracker & Pipeline Manager

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Application Lifecycle State Machine](#6-application-lifecycle-state-machine)
7. [Status Detection & Auto-Updates](#7-status-detection--auto-updates)
8. [Pipeline Metrics & Analytics](#8-pipeline-metrics--analytics)
9. [Notification & Reminder Engine](#9-notification--reminder-engine)
10. [Weekly Summary Reports](#10-weekly-summary-reports)
11. [Corporate vs Academic Pipeline Differences](#11-corporate-vs-academic-pipeline-differences)
12. [Database Schema](#12-database-schema)
13. [n8n Workflow Specifications](#13-n8n-workflow-specifications)
14. [Integration with Modules 1, 2, 3, 5](#14-integration-with-modules-1-2-3-5)
15. [Error Handling & Monitoring](#15-error-handling--monitoring)
16. [Privacy & Compliance](#16-privacy--compliance)
17. [Rollout Plan](#17-rollout-plan)
18. [50-Round Critical Roleplay Evaluation (v1)](#18-50-round-critical-roleplay-evaluation-v1)
19. [Fixes Applied Log](#19-fixes-applied-log)

---

## 1. Executive Summary

The Application Tracker & Pipeline Manager is the fourth module of the Selvi Job App, an automated job application pipeline built on n8n (self-hosted) with Postgres on a Hetzner CAX31 ARM server. Its purpose is to track every job application through its complete lifecycle -- from the moment a job is discovered and shortlisted, through CV tailoring and submission, through employer responses, interviews, offers, and final outcomes -- and to provide the candidate with an accurate, current view of her entire application pipeline without requiring manual record-keeping.

The system serves a specific candidate: a PhD + MBA professional with 18 years of HR/L&D experience, pursuing two parallel tracks in the UK market -- corporate Learning & Development roles (Manager to Head level, GBP 70-80k) and university Lecturer/Senior Lecturer positions near Maidenhead, Berkshire. These two tracks have fundamentally different hiring processes, timelines, and stage definitions. Corporate hiring typically runs 2-6 weeks from application to offer. Academic hiring routinely takes 3-6 months and involves stages (teaching presentations, REF audits, Senate approvals) that do not exist in the corporate world. A tracking system that treats these as identical pipelines will produce misleading metrics and poorly timed reminders.

Module 4 sits at the centre of the Selvi Job App architecture. It receives input from every other module:

- **Module 1 (Job Discovery):** When a job is discovered and scored, Module 4 creates the initial tracking record. The `jobs` table in Module 1 already stores discovery data; Module 4 extends this with application lifecycle tracking.
- **Module 2 (CV Tailoring):** When a tailored CV and cover letter are generated for a specific job, Module 4 records which document versions were used, linking the application to the exact CV and cover letter PDFs.
- **Module 3 (Auto-Apply):** When an application is submitted (automatically or manually), Module 4 records the submission event, method, and timestamp.
- **Module 5 (Email Intelligence):** When employer emails arrive (acknowledgements, rejections, interview invitations, offers), Module 5 parses them and feeds status updates to Module 4, which advances the application through its state machine.

Without Module 4, the candidate faces a problem that grows worse as the pipeline scales. Module 1 might discover 100+ relevant jobs per week. Modules 2 and 3 might process 20-30 applications per week. At that volume, manually tracking which applications are pending, which need follow-up, which have interviews scheduled, and which have gone silent becomes its own part-time job. Module 4 eliminates that overhead by making the pipeline self-tracking.

The system is deployed on existing infrastructure at deploy.apiloom.io (Hetzner CAX31, 8 vCPU ARM, 16GB RAM) running Dokploy, with n8n self-hosted at n8n.deploy.apiloom.io. Postgres serves as the data store. Email notifications are sent via Resend. Total incremental cost for Module 4 is negligible -- it is primarily database writes, scheduled n8n workflows, and email sends.

---

## 2. Problem Statement

### 2.1 The Tracking Burden at Scale

A job search at scale produces a tracking problem that compounds daily. Each application creates a new line item that must be monitored over weeks or months. The candidate must remember:

- Which jobs she has applied to (vs. merely bookmarked or considered)
- Which version of her CV she sent to each employer
- Whether the cover letter was tailored for corporate L&D or academic teaching
- Whether she received an acknowledgement email
- How long it has been since she applied with no response
- Whether a rejection was received and she missed the email
- Whether an interview invitation is buried in her inbox
- Which applications are genuinely active vs. effectively dead
- What the next action is for each active application

At 5 active applications, this is manageable with a spreadsheet. At 25, it becomes error-prone. At 50+, it is unsustainable without automation.

### 2.2 The Cognitive Cost of Manual Tracking

Manual tracking is not just time-consuming; it creates persistent background anxiety. Every application in an ambiguous state ("Did I hear back from them? When did I apply? Should I follow up?") occupies mental space. This cognitive load is particularly harmful during a job search because the candidate's most valuable mental energy should go toward interview preparation, networking, and strategy -- not bookkeeping.

Research on job search stress consistently identifies uncertainty as the primary stressor. A system that reduces ambiguity ("You have 12 active applications, 3 need follow-up, 2 have interviews scheduled") directly reduces stress.

### 2.3 The Timing Problem

Different applications move at different speeds. A corporate L&D role at a tech company might respond within 48 hours. A university lecturer position might take 4-6 weeks before the first acknowledgement. Without tracking, the candidate either follows up too early (appearing desperate), follows up too late (after the role is filled), or never follows up at all (leaving opportunities on the table).

The timing problem is compounded by the dual-track nature of this search. The candidate is applying to both corporate and academic roles simultaneously. A corporate application that has been silent for 3 weeks is almost certainly dead. An academic application that has been silent for 3 weeks may simply be going through committee review. The tracker must understand these different timelines and calibrate its reminders accordingly.

### 2.4 The Dropped Ball Problem

In a high-volume job search, the most common failure mode is not active rejection -- it is passive neglect. The candidate applies, hears nothing, and eventually forgets about the application. Three weeks later, an invitation to interview arrives and she has no context on the role. Or worse, the follow-up window closes and a role that might have responded to a well-timed nudge is lost forever.

This is particularly relevant for academic hiring, where the candidate might apply in March, hear nothing through April and May, and receive an interview invitation in June for a September start. Without a tracker that maintains context over that timescale, the application effectively disappears from awareness.

### 2.5 The Ghosting Problem

Employer ghosting -- submitting an application and receiving no response whatsoever -- is endemic in the UK job market. Estimates suggest 50-75% of job applications receive no response at all. The candidate's historical 90% callback rate is exceptional, but even she will encounter ghosting, particularly at scale.

The tracker must distinguish between:
- Applications that are genuinely pending (within normal response time)
- Applications that are likely ghosted (past normal response time with no signal)
- Applications that are confirmed dead (rejection received)

And for ghosted applications, the system should suggest concrete actions: send a follow-up email, check LinkedIn for hiring status changes, or formally close the application and move on.

### 2.6 The Reporting Problem

Without aggregated metrics, the candidate cannot answer basic strategic questions:
- What is my response rate? Is it improving or declining?
- Which job boards produce applications that get responses?
- Am I applying to enough roles? Too many?
- How long does my typical hiring process take?
- What stage do I most commonly get rejected at?
- Are corporate or academic applications performing better?

These questions matter because the answers drive strategy. If the response rate from Reed is 30% but from CIPD is 5%, that shapes where to focus effort. If most rejections happen at the phone screen stage, that suggests interview preparation is more valuable than CV optimization. Module 4 generates the data that makes these strategic decisions possible.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Track 100% of applications | Every application submitted (auto or manual) has a tracking record | Audit: compare applications table against email confirmations |
| Detect status changes within 4 hours | When an employer responds, the tracker updates within 4 hours | Compare email timestamp to status change timestamp |
| Send accurate follow-up reminders | Reminders match the correct timeline for corporate vs. academic | Manual review of reminder accuracy weekly |
| Generate weekly pipeline report | Every Sunday evening, a report covering all active applications | Report delivery confirmation |
| Reduce manual tracking time | From ~30 min/day to zero | Self-reported by candidate |

### 3.2 Secondary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Identify ghosted applications | Detect ghosting within 7 days of expected response window | Ghosting detection accuracy reviewed monthly |
| Track CV/cover letter versions | 100% of applications linked to specific document versions | Audit: applications with null document references |
| Distinguish corporate vs. academic timelines | Zero false follow-up reminders from wrong timeline assumptions | Candidate feedback on reminder appropriateness |
| Maintain pipeline metrics accuracy | All metrics calculable from tracked data, no manual input needed | Metrics completeness audit monthly |

### 3.3 Success Metrics (Weekly Dashboard)

- **Total active applications** -- applications in any non-terminal state
- **Applications submitted this week** -- new applications sent
- **Response rate (trailing 30 days)** -- (acknowledged + screening + interviewing + assessment + offer + rejected) / applied (see Metrics Glossary, Section 8.9)
- **Interview conversion rate** -- interviews / (acknowledged + rejected + interview)
- **Average time-to-first-response** -- median days from application to first employer response
- **Ghosting rate** -- applications past expected response window with no signal
- **Pipeline by stage** -- count of applications at each lifecycle stage
- **Pipeline by track** -- corporate vs. academic breakdown
- **Follow-ups sent** -- number of follow-up reminders triggered
- **Offers received (cumulative)** -- total offers received since system start
- **Funnel conversion** -- applied -> acknowledged -> phone screen -> interview -> offer

### 3.4 Anti-Goals

These are explicitly out of scope for Module 4:

- **Interview scheduling:** Module 4 tracks that an interview was scheduled but does not manage calendar integration. Interview scheduling is a manual step (or a future module).
- **Salary negotiation advice:** Module 4 tracks that a negotiation stage was entered but does not provide negotiation strategy.
- **Application form filling:** This is Module 3's responsibility. Module 4 only records the outcome.
- **Email sending for follow-ups:** Module 4 generates follow-up reminders to the candidate. It does not automatically send follow-up emails to employers (too risky for an automated system).

---

## 4. User Stories

### 4.1 Core Tracking Stories

**US-401: Application Record Creation**
As Selvi, I want every job I apply to -- whether by Module 3's auto-apply, manual portal submission, or emailed CV -- to be recorded in the tracker with the date, method, CV version, and cover letter version, so I never lose track of an application.

**US-402: Pipeline Dashboard**
As Selvi, I want to see at any time how many active applications I have and what stage each is at (applied, acknowledged, phone screen, interview, offer), broken down by corporate and academic tracks, so I know the state of my search.

**US-403: Status Auto-Update**
As Selvi, I want the tracker to automatically detect when an employer responds (acknowledgement, rejection, interview invitation, offer) by parsing my email, and update the application status accordingly, so I do not have to manually update records.

**US-404: Manual Status Override**
As Selvi, I want to be able to manually update an application's status when auto-detection misses something (e.g., a phone call instead of an email), so the tracker remains accurate even when automation fails.

**US-405: Application History**
As Selvi, I want to see the full history of each application -- every status change, every email received, every document sent -- so I have complete context before an interview or follow-up call.

### 4.2 Follow-Up & Ghosting Stories

**US-406: Follow-Up Reminders**
As Selvi, I want to receive a reminder when an application has been pending for longer than the expected response window (2 weeks for corporate, 4-6 weeks for academic), with a suggested action (follow up, wait, or close), so no opportunity slips through the cracks.

**US-407: Ghosting Detection**
As Selvi, I want the system to detect when I have been ghosted -- no response of any kind past the expected window -- and suggest a specific follow-up action (draft follow-up email, check LinkedIn, close application), so I can decide how to proceed.

**US-408: Follow-Up Scheduling**
As Selvi, I want to set a specific follow-up date for an application (e.g., "Remind me to follow up on 15 April"), overriding the automatic reminder schedule, so I can handle special cases.

**US-409: Snooze Reminders**
As Selvi, I want to snooze a follow-up reminder for a specified period (3 days, 1 week, 2 weeks), so I am not nagged about applications where I have decided to wait.

### 4.3 Reporting Stories

**US-410: Weekly Summary Email**
As Selvi, I want to receive a weekly email (Sunday evening) summarizing my application pipeline: new applications, status changes, upcoming deadlines, ghosted applications, and key metrics (response rate, interview rate, funnel), so I can plan my week.

**US-411: Pipeline Metrics**
As Selvi, I want to see my application funnel (applied -> acknowledged -> screened -> interviewed -> offered) with conversion percentages and average time between stages, so I can identify bottlenecks in my process.

**US-412: Source Effectiveness**
As Selvi, I want to know which job boards and sources produce applications that actually get responses, so I can focus my efforts on the most productive channels.

**US-413: Monthly Trend Report**
As Selvi, I want to see how my application metrics trend over time (improving or declining response rate, changing volume, shifting sources), so I can evaluate whether my strategy is working.

### 4.4 Document Tracking Stories

**US-414: CV Version Tracking**
As Selvi, I want to know exactly which version of my CV was sent with each application, including any job-specific tailoring that was applied, so I can reference it before interviews and learn which versions perform best.

**US-415: Cover Letter Tracking**
As Selvi, I want to know which cover letter was sent with each application, and whether it was a corporate or academic version, so I have full context for each application.

**US-416: Document Performance Analysis**
As Selvi, I want to see which CV and cover letter versions produce the highest response rates, so Module 2 can be tuned to generate more effective documents.

### 4.5 Corporate Pipeline Stories

**US-417: Corporate Pipeline Tracking**
As Selvi, I want corporate applications tracked through the standard UK corporate hiring pipeline: Applied -> Acknowledged -> Phone Screen -> First Interview -> Second Interview -> Assessment Centre -> Offer -> Negotiation -> Accepted/Declined, so the tracker reflects how corporate hiring actually works.

**US-418: Corporate Timeline Expectations**
As Selvi, I want the system to know that corporate hiring in the UK typically takes 2-6 weeks from application to offer, and to calibrate reminders and ghosting detection against this timeline.

**US-419: Corporate-Specific Stages**
As Selvi, I want the tracker to handle corporate-specific stages like competency-based interviews, panel interviews, psychometric assessments, and case study presentations, labelling them appropriately in the pipeline view.

### 4.6 Academic Pipeline Stories

**US-420: Academic Pipeline Tracking**
As Selvi, I want academic applications tracked through the standard UK university hiring pipeline: Applied -> Acknowledged -> Longlisted -> Shortlisted -> Teaching Presentation -> Academic Interview -> Panel/Senate Approval -> Offer -> Contract Negotiation -> Pre-Employment Checks (DBS, Right to Work, References) -> Accepted/Declined, so the tracker reflects how academic hiring actually works.

**US-421: Academic Timeline Expectations**
As Selvi, I want the system to know that UK academic hiring typically takes 3-6 months from posting to start date, with 2-8 weeks between application and first contact being normal, and to calibrate reminders accordingly so I am not prematurely flagged as ghosted.

**US-422: Academic-Specific Stages**
As Selvi, I want the tracker to handle academic-specific stages like teaching presentations (30-minute mock lectures), REF track assessments, Academic Board approvals, probation period negotiations, and HESA data requirements.

**US-423: Academic Calendar Awareness**
As Selvi, I want the system to understand UK academic hiring cycles (main recruitment: January-April for September starts; secondary cycle: May-July for January starts; out-of-cycle hires: possible but rare), so timeline expectations and reminders account for seasonal patterns.

### 4.7 UK-Specific Stories

**US-424: DBS Check Tracking**
As Selvi, I want to track DBS (Disclosure and Barring Service) check requirements and progress for roles that require them (primarily academic and some corporate roles involving vulnerable adults/children), including the standard 2-4 week processing time.

**US-425: Right to Work Tracking**
As Selvi, I want to track Right to Work verification stages, noting that the candidate has unrestricted UK work rights (does not need sponsorship), so this stage can be marked as pre-cleared.

**US-426: Reference Request Tracking**
As Selvi, I want to track when employers request references, which referees they contacted, and whether references have been submitted, because late references are a common bottleneck in UK hiring.

**US-427: Salary Benchmarking Context**
As Selvi, I want each application to carry context about the salary range offered (or predicted), the salary the candidate would accept, and any notes about total compensation (pension, benefits, flexi-time), so negotiation decisions are informed by data.

### 4.8 Edge Case Stories

**US-428: Withdrawn Applications**
As Selvi, I want to be able to mark an application as "Withdrawn" (I decided not to proceed) as distinct from "Rejected" (they decided), so my metrics accurately reflect what happened.

**US-429: Multiple Roles at Same Employer**
As Selvi, I want the system to flag when I have multiple active applications at the same employer, because employers notice and it can affect perception. The tracker should warn me before I apply to a second role at the same company while one is active.

**US-430: Reposted Roles**
As Selvi, I want the tracker to detect when a role I was rejected from (or that I previously applied to) is reposted, and alert me with the option to re-apply, because re-postings sometimes indicate changed requirements or different hiring managers.

**US-431: Internal Referral Tracking**
As Selvi, I want to note when an application includes an internal referral or recommendation, because referred applications should be tracked with different timeline expectations (often faster).

**US-432: Application Deadline Tracking**
As Selvi, I want applications with known deadlines to show a countdown, and to receive a reminder 48 hours before a deadline for roles I have shortlisted but not yet applied to, so I do not miss closing dates.

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
                                    +------------------+
                                    |   Selvi (User)   |
                                    +--------+---------+
                                             |
                              +--------------+--------------+
                              |              |              |
                     +--------v--------+ +---v----+ +------v---------+
                     | Weekly Summary  | | Follow | | Pipeline Query |
                     | (Sunday 7PM)   | | Up     | | (on demand)    |
                     +---------+------+ | Alerts | +------+---------+
                               |        +---+----+        |
                               |            |              |
                     +---------v------------v--------------v--------+
                     |              Notification Engine              |
                     |         (n8n Workflow WF4-NOTIFY)             |
                     +-------------------+--------------------------+
                                         |
                     +-------------------v--------------------------+
                     |              Postgres Database               |
                     |  applications | application_events |         |
                     |  application_documents | pipeline_metrics    |
                     +--+-------+-------+-------+-------+-----------+
                        ^       ^       ^       ^       ^
                        |       |       |       |       |
             +----------+--+ +--+------++ +-----+--+ +-+----------+
             | Status      | | Reminder | | Metric | | Pipeline   |
             | Detection   | | Engine   | | Calc   | | Reporter   |
             | WF4-STATUS  | | WF4-REM  | | WF4-MET| | WF4-RPT   |
             +------+------+ +----------+ +--------+ +------------+
                    ^
                    |
        +-----------+-----------+
        |           |           |
   +----+----+ +----+----+ +---+-----+
   | Module 5| | Module 3| | Module 2|
   | Email   | | Auto    | | CV      |
   | Intel   | | Apply   | | Tailor  |
   +---------+ +---------+ +---------+
```

### 5.2 Module 4 Workflow Architecture

Module 4 consists of 6 n8n workflows that operate independently, communicating through the shared Postgres database.

| Workflow | Trigger | Schedule | Purpose |
|----------|---------|----------|---------|
| WF4-INIT: Application Initializer | Webhook / Sub-workflow | Called by WF3 (Auto-Apply) or manual | Create a new application tracking record when a job moves from "shortlisted" to "applied" |
| WF4-STATUS: Status Update Processor | Cron + Webhook | Every 30 minutes + webhook from Module 5 | Process status updates from email parsing, detect stage transitions |
| WF4-GHOST: Ghosting & Follow-Up Engine | Cron | Every 6 hours (8AM, 2PM, 8PM) | Evaluate active applications for ghosting signals, generate follow-up reminders |
| WF4-METRICS: Pipeline Metrics Calculator | Cron | Daily at 6AM | Calculate all pipeline metrics, update analytics tables |
| WF4-REPORT: Weekly Summary Reporter | Cron | Sunday 7PM UK time | Generate and send the weekly pipeline summary email |
| WF4-NOTIFY: Notification Dispatcher | Event-driven + Cron | On status change + daily at 8AM | Send follow-up reminders, deadline alerts, and status change notifications |

**Schedule Staggering:**

```
06:00  WF4-METRICS runs (daily metrics calculation)
08:00  WF4-GHOST runs (morning follow-up check)
08:15  WF4-NOTIFY runs (send any pending notifications from overnight)
*/30   WF4-STATUS runs (continuous status update processing)
14:00  WF4-GHOST runs (afternoon follow-up check)
19:00  WF4-REPORT runs (Sunday only -- weekly report)
20:00  WF4-GHOST runs (evening follow-up check)
```

### 5.3 Data Flow

```
Job Discovered (M1) -> Scored -> Shortlisted -> CV Tailored (M2) -> Applied (M3)
                                                                        |
                                                                        v
Application Record Created (WF4-INIT)
        |
        v
Email Received (M5) -> Parsed -> Status Update -> WF4-STATUS
        |                                              |
        v                                              v
  [acknowledgement]                        Application Stage Advanced
  [rejection]                                      |
  [interview invite]                               v
  [offer]                               WF4-NOTIFY: Alert Candidate
  [assessment request]                             |
                                                   v
                              WF4-GHOST: Check for Ghosting (scheduled)
                                                   |
                                                   v
                              WF4-METRICS: Calculate Pipeline Metrics (daily)
                                                   |
                                                   v
                              WF4-REPORT: Weekly Summary (Sunday)
```

### 5.4 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Workflow Engine | n8n (self-hosted) | At n8n.deploy.apiloom.io |
| Database | PostgreSQL 16 | Shared with Module 1 (selvi_jobs DB) |
| Email Notifications | Resend API | For all outbound notifications |
| AI/LLM | Claude 3.5 Haiku | For email classification (Module 5 dependency) and follow-up suggestion generation |
| Hosting | Dokploy on Hetzner CAX31 | 8 vCPU ARM, 16GB RAM (shared) |
| Template Engine | n8n Code nodes (JavaScript) | For email HTML rendering |

### 5.5 Integration Points

```
+------------------+     +------------------+     +------------------+
|   Module 1       |     |   Module 2       |     |   Module 3       |
|   Job Discovery  |     |   CV Tailoring   |     |   Auto-Apply     |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         | job_id, tier,          | cv_version_id,         | application_method,
         | job_type, score        | cover_letter_id,       | submitted_at,
         |                        | tailoring_notes        | portal_confirmation_id
         |                        |                        |
         +----------+    +--------+    +-------------------+
                    |    |             |
                    v    v             v
           +--------+----+------------+---------+
           |       Module 4                     |
           |   Application Tracker              |
           |   & Pipeline Manager               |
           +--------+-----------+---------------+
                    |           |
                    v           v
           +--------+---+ +----+---------+
           |  Module 5  | | Candidate    |
           |  Email     | | (via email)  |
           |  Intel     | |              |
           +------------+ +--------------+
```

---

## 6. Application Lifecycle State Machine

### 6.1 Overview

Every application follows a deterministic state machine. States are divided into three categories:

1. **Pre-Application States:** The job exists in the system but no application has been submitted.
2. **Active States:** An application has been submitted and is being processed by the employer.
3. **Terminal States:** The application has reached a final outcome.

Transitions between states are triggered by events -- either automated (email parsing, time-based rules) or manual (candidate input).

### 6.2 Universal States

These states apply to all applications regardless of track (corporate or academic).

> **v2 Note:** The pre-application state `shortlisted` (meaning "candidate has shortlisted this job as worth applying to") is distinct from the academic hiring states `academic_longlisted` and `academic_shortlisted` (meaning "the university has longlisted/shortlisted the candidate"). In v1, the word "shortlisted" was overloaded with two different meanings. v2 resolves this: the pre-application state remains `shortlisted` (candidate-side action), while academic employer-side states use the `academic_` prefix. See Section 6.8 for academic-specific states.

```
                                PRE-APPLICATION
                          +-----------------------+
                          |                       |
                +-------->+ DISCOVERED            |
                |         |  (from Module 1)      |
                |         +----------+------------+
                |                    |
                |                    | score >= threshold
                |                    v
                |         +----------+------------+
                |         | SHORTLISTED           |
                |         |  (worth applying to)  |
                |         +----------+------------+
                |                    |
                |                    | CV tailored (Module 2)
                |                    v
                |         +----------+------------+
                |         | CV_TAILORED           |
                |         |  (documents ready)    |
                |         +----------+------------+
                |                    |
                |                    | application submitted (Module 3 or manual)
                |                    v
                |              ACTIVE PIPELINE
                |         +-----------------------+
                |         |                       |
                |         | APPLIED               +-----+
                |         |  (submitted, awaiting |     |
                |         |   any response)       |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | employer ack      |
                |                    v                   |
                |         +----------+------------+     |
                |         | ACKNOWLEDGED          |     |
                |         |  (employer confirmed  |     |
                |         |   receipt)            |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | (varies by track) |
                |                    v                   |
                |         +----------+------------+     |
                |         | SCREENING             |     |
                |         |  (phone/video screen) |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | passed screen     |
                |                    v                   |
                |         +----------+------------+     |
                |         | INTERVIEWING          |     |
                |         |  (one or more rounds) |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | passed interviews |
                |                    v                   |
                |         +----------+------------+     |
                |         | ASSESSMENT            |     |
                |         |  (if applicable)      |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | assessment done   |
                |                    v                   |
                |         +----------+------------+     |
                |         | OFFER_RECEIVED        |     |
                |         |  (offer extended)     |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    | negotiation       |
                |                    v                   |
                |         +----------+------------+     |
                |         | NEGOTIATING           |     |
                |         |  (terms under review) |     |
                |         +----------+------------+     |
                |                    |                   |
                |                    v                   |
                |              TERMINAL STATES          |
                |         +-----------------------+     |
                |         |                       |     |
                |         | ACCEPTED              |     |
                |         | DECLINED              |     |
                |         | REJECTED       <------+-----+
                |         | WITHDRAWN                   |
                |         | GHOSTED                     |
                |         | EXPIRED                     |
                |         +-----------------------+     |
                |                                       |
                +---- (reposted detection) <------------+
```

### 6.3 State Definitions

| State | Code | Description | Entry Trigger | Expected Duration |
|-------|------|-------------|---------------|-------------------|
| DISCOVERED | `discovered` | Job found by Module 1, not yet evaluated for application | Module 1 inserts job | Until scored |
| SHORTLISTED | `shortlisted` | Job scored A/B tier, worth applying to | Score threshold met (A or B tier) | Until CV tailored or candidate decides not to apply |
| CV_TAILORED | `cv_tailored` | Tailored CV and cover letter generated | Module 2 completes tailoring | Until application submitted |
| APPLIED | `applied` | Application submitted to employer | Module 3 auto-apply or manual submission recorded | Corporate: 1-7 days. Academic: 1-21 days. |
| ACKNOWLEDGED | `acknowledged` | Employer confirmed receipt of application | Auto-reply email detected, or portal confirmation | Corporate: 1-14 days to next stage. Academic: 7-42 days. |
| ACADEMIC_LONGLISTED | `academic_longlisted` | University has longlisted candidate (academic track only) | Longlisting notification detected | Academic: 1-2 weeks to shortlisting |
| ACADEMIC_SHORTLISTED | `academic_shortlisted` | University has shortlisted candidate for interview (academic track only) | Shortlisting notification detected | Academic: 1-3 weeks to teaching presentation |
| SCREENING | `screening` | Phone or video screening stage | Phone screen invitation detected | 3-7 days |
| INTERVIEWING | `interviewing` | Formal interview process (may be multi-round) | Interview invitation detected | Corporate: 1-3 weeks. Academic: 2-6 weeks. |
| ASSESSMENT | `assessment` | Assessment centre, case study, presentation, or test | Assessment invitation detected | 1-2 weeks |
| OFFER_RECEIVED | `offer_received` | Formal or verbal offer extended | Offer email or call detected | 1-7 days (decision window) |
| NEGOTIATING | `negotiating` | Salary or terms under negotiation | Candidate enters negotiation | 3-14 days |
| PRE_EMPLOYMENT | `pre_employment` | Pre-employment checks in progress (DBS, references, right to work) | Offer accepted, checks initiated | 2-8 weeks |
| ACCEPTED | `accepted` | Candidate accepted the offer | Candidate confirms acceptance | Terminal |
| DECLINED | `declined` | Candidate declined the offer | Candidate confirms decline | Terminal |
| REJECTED | `rejected` | Employer rejected the application at any stage | Rejection email detected | Terminal |
| WITHDRAWN | `withdrawn` | Candidate withdrew the application | Candidate manual action | Terminal |
| GHOSTED | `ghosted` | No response past expected window, no follow-up response | Automatic detection by WF4-GHOST | Terminal (can be reopened if employer responds later) |
| EXPIRED | `expired` | Application deadline passed without submission, or role was filled/removed | Deadline passed or role delisted | Terminal |

### 6.4 Valid State Transitions

The state machine enforces valid transitions. Any attempt to move an application to an invalid state is logged as an error and rejected.

```sql
-- Valid transitions map
-- Format: from_state -> [valid_to_states]

discovered            -> [shortlisted, expired, withdrawn]
shortlisted           -> [cv_tailored, applied, expired, withdrawn]
cv_tailored           -> [applied, expired, withdrawn]
applied               -> [acknowledged, academic_longlisted, screening, interviewing, rejected, ghosted, withdrawn, expired]
acknowledged          -> [academic_longlisted, academic_shortlisted, screening, interviewing, assessment, rejected, ghosted, withdrawn]
academic_longlisted   -> [academic_shortlisted, interviewing, rejected, ghosted, withdrawn]  -- academic track only
academic_shortlisted  -> [interviewing, assessment, rejected, ghosted, withdrawn]            -- academic track only
screening             -> [interviewing, assessment, rejected, ghosted, withdrawn]
interviewing          -> [interviewing, assessment, offer_received, rejected, ghosted, withdrawn]
assessment            -> [interviewing, offer_received, rejected, ghosted, withdrawn]
offer_received        -> [negotiating, pre_employment, accepted, declined, withdrawn]
negotiating           -> [pre_employment, accepted, declined, withdrawn]
pre_employment        -> [accepted, withdrawn]
accepted              -> []  -- truly terminal
declined              -> []  -- truly terminal
rejected              -> [applied]  -- can reapply if role reposted
withdrawn             -> [applied]  -- can reapply if changed mind
ghosted               -> [acknowledged, academic_longlisted, screening, interviewing, rejected, applied]  -- can be reopened
expired               -> [shortlisted, applied]  -- if role reposted
```

### 6.5 State Transition Events

Each state transition is triggered by a specific event type. Events are recorded in the `application_events` table.

| Event Type | Description | Source | Triggers Transition |
|------------|-------------|--------|---------------------|
| `job_discovered` | Job found by Module 1 | WF1-WF4 (Module 1) | -> discovered |
| `job_shortlisted` | Job scored A/B tier | WF5 (Module 1 scoring) | discovered -> shortlisted |
| `cv_generated` | Tailored CV created | Module 2 | shortlisted -> cv_tailored |
| `application_submitted` | Application sent to employer | Module 3 or manual | cv_tailored/shortlisted -> applied |
| `application_acknowledged` | Employer confirmed receipt | Module 5 email parsing | applied -> acknowledged |
| `phone_screen_invited` | Phone/video screen scheduled | Module 5 email parsing | applied/acknowledged -> screening |
| `interview_invited` | Interview scheduled | Module 5 email parsing | screening/acknowledged -> interviewing |
| `assessment_invited` | Assessment/test scheduled | Module 5 email parsing | interviewing/screening -> assessment |
| `offer_extended` | Offer received (verbal or written) | Module 5 email parsing or manual | interviewing/assessment -> offer_received |
| `negotiation_started` | Candidate enters negotiation | Manual | offer_received -> negotiating |
| `pre_employment_started` | Pre-employment checks initiated | Module 5 email parsing or manual | offer_received/negotiating -> pre_employment |
| `offer_accepted` | Candidate accepted the offer | Manual | offer_received/negotiating/pre_employment -> accepted |
| `offer_declined` | Candidate declined the offer | Manual | offer_received/negotiating -> declined |
| `application_rejected` | Employer rejected at any stage | Module 5 email parsing | any active state -> rejected |
| `application_withdrawn` | Candidate withdrew | Manual | any non-terminal state -> withdrawn |
| `ghosting_detected` | No response past expected window | WF4-GHOST automatic | applied/acknowledged/screening -> ghosted |
| `application_expired` | Deadline passed or role delisted | WF4-GHOST automatic | any pre-application or applied state -> expired |
| `follow_up_sent` | Candidate sent follow-up to employer | Manual recording | no transition (logged as event) |
| `note_added` | Candidate added a note | Manual | no transition (logged as event) |
| `reminder_sent` | System sent follow-up reminder | WF4-NOTIFY | no transition (logged as event) |
| `document_attached` | CV or cover letter linked to application | Module 2 or manual | no transition (logged as event) |
| `interview_completed` | Interview took place | Manual | no transition (logged as event, may sub-stage within interviewing) |
| `deadline_approaching` | Application deadline is within 48 hours | WF4-GHOST | no transition (notification trigger) |

### 6.6 State Machine Implementation

The state machine is implemented as a Postgres function that validates transitions and logs events atomically.

```sql
CREATE OR REPLACE FUNCTION transition_application_state(
    p_application_id UUID,
    p_new_state VARCHAR(30),
    p_event_type VARCHAR(50),
    p_event_source VARCHAR(50),
    p_event_data JSONB DEFAULT '{}'::jsonb,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_state VARCHAR(30);
    v_valid_transitions JSONB;
    v_valid BOOLEAN;
BEGIN
    -- Get current state with row lock
    SELECT current_state INTO v_current_state
    FROM applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF v_current_state IS NULL THEN
        RAISE EXCEPTION 'Application % not found', p_application_id;
    END IF;

    -- Define valid transitions
    v_valid_transitions := '{
        "discovered": ["shortlisted", "expired", "withdrawn"],
        "shortlisted": ["cv_tailored", "applied", "expired", "withdrawn"],
        "cv_tailored": ["applied", "expired", "withdrawn"],
        "applied": ["acknowledged", "academic_longlisted", "screening", "interviewing", "rejected", "ghosted", "withdrawn", "expired"],
        "acknowledged": ["academic_longlisted", "academic_shortlisted", "screening", "interviewing", "assessment", "rejected", "ghosted", "withdrawn"],
        "academic_longlisted": ["academic_shortlisted", "interviewing", "rejected", "ghosted", "withdrawn"],
        "academic_shortlisted": ["interviewing", "assessment", "rejected", "ghosted", "withdrawn"],
        "screening": ["interviewing", "assessment", "rejected", "ghosted", "withdrawn"],
        "interviewing": ["interviewing", "assessment", "offer_received", "rejected", "ghosted", "withdrawn"],
        "assessment": ["interviewing", "offer_received", "rejected", "ghosted", "withdrawn"],
        "offer_received": ["negotiating", "pre_employment", "accepted", "declined", "withdrawn"],
        "negotiating": ["pre_employment", "accepted", "declined", "withdrawn"],
        "pre_employment": ["accepted", "withdrawn"],
        "ghosted": ["acknowledged", "academic_longlisted", "screening", "interviewing", "rejected", "applied"],
        "rejected": ["applied"],
        "withdrawn": ["applied"],
        "expired": ["shortlisted", "applied"]
    }'::jsonb;

    -- Check if transition is valid
    v_valid := v_valid_transitions->v_current_state ? p_new_state;

    IF NOT v_valid THEN
        -- Log invalid transition attempt
        INSERT INTO application_events (
            application_id, event_type, event_source, event_data,
            from_state, to_state, notes, is_valid_transition
        ) VALUES (
            p_application_id, p_event_type, p_event_source, p_event_data,
            v_current_state, p_new_state, p_notes, false
        );
        RETURN false;
    END IF;

    -- State ordinal definition (higher = further in pipeline)
    -- Used to determine highest_state_reached
    DECLARE v_state_ordinals JSONB := '{
        "discovered": 0, "shortlisted": 1, "cv_tailored": 2,
        "applied": 3, "acknowledged": 4,
        "academic_longlisted": 5, "academic_shortlisted": 6,
        "screening": 5, "interviewing": 6, "assessment": 7,
        "pre_employment": 8, "offer_received": 9,
        "negotiating": 10, "accepted": 11,
        "ghosted": -1, "rejected": -1, "withdrawn": -1,
        "expired": -1, "declined": -1
    }'::jsonb;
    DECLARE v_new_ordinal INTEGER;
    DECLARE v_current_hsr_ordinal INTEGER;
    DECLARE v_current_hsr VARCHAR(30);

    -- Perform transition
    UPDATE applications
    SET current_state = p_new_state,
        previous_state = v_current_state,
        state_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Update highest_state_reached if new state is a forward progression
    v_new_ordinal := COALESCE((v_state_ordinals->>p_new_state)::integer, -1);
    SELECT highest_state_reached INTO v_current_hsr FROM applications WHERE id = p_application_id;
    v_current_hsr_ordinal := COALESCE((v_state_ordinals->>COALESCE(v_current_hsr, 'discovered'))::integer, 0);

    IF v_new_ordinal > v_current_hsr_ordinal THEN
        UPDATE applications
        SET highest_state_reached = p_new_state
        WHERE id = p_application_id;
    END IF;

    -- Log event
    INSERT INTO application_events (
        application_id, event_type, event_source, event_data,
        from_state, to_state, notes, is_valid_transition
    ) VALUES (
        p_application_id, p_event_type, p_event_source, p_event_data,
        v_current_state, p_new_state, p_notes, true
    );

    -- Update stage-specific timestamps
    CASE p_new_state
        WHEN 'applied' THEN
            UPDATE applications SET applied_at = NOW() WHERE id = p_application_id;
        WHEN 'acknowledged' THEN
            UPDATE applications SET acknowledged_at = NOW() WHERE id = p_application_id;
        WHEN 'screening' THEN
            UPDATE applications SET screening_at = NOW() WHERE id = p_application_id;
        WHEN 'interviewing' THEN
            UPDATE applications SET first_interview_at = COALESCE(first_interview_at, NOW()) WHERE id = p_application_id;
        WHEN 'offer_received' THEN
            UPDATE applications SET offer_at = NOW() WHERE id = p_application_id;
        WHEN 'accepted' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'accepted' WHERE id = p_application_id;
        WHEN 'declined' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'declined' WHERE id = p_application_id;
        WHEN 'rejected' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'rejected' WHERE id = p_application_id;
        WHEN 'withdrawn' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'withdrawn' WHERE id = p_application_id;
        WHEN 'academic_longlisted' THEN
            UPDATE applications SET state_changed_at = NOW() WHERE id = p_application_id;
        WHEN 'academic_shortlisted' THEN
            UPDATE applications SET screening_at = COALESCE(screening_at, NOW()) WHERE id = p_application_id;
        WHEN 'pre_employment' THEN
            UPDATE applications SET state_changed_at = NOW() WHERE id = p_application_id;
        WHEN 'assessment' THEN
            UPDATE applications SET state_changed_at = NOW() WHERE id = p_application_id;
        WHEN 'ghosted' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'ghosted' WHERE id = p_application_id;
        WHEN 'expired' THEN
            UPDATE applications SET resolved_at = NOW(), outcome = 'expired' WHERE id = p_application_id;
        ELSE
            -- No additional timestamp update needed
            NULL;
    END CASE;

    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### 6.7 State Machine Diagram -- Corporate Track

```
    APPLIED
       |
       | 1-3 days (auto-reply)
       v
  ACKNOWLEDGED
       |
       | 3-10 days
       v
   SCREENING ---------> REJECTED
   (phone/video)            ^
       |                    |
       | 3-7 days           |
       v                    |
  INTERVIEWING (Round 1) ---+
       |                    |
       | 5-10 days          |
       v                    |
  INTERVIEWING (Round 2) ---+
       |                    |
       | (optional)         |
       v                    |
   ASSESSMENT  -------------+
   (centre/case study)
       |
       | 3-7 days
       v
  OFFER_RECEIVED
       |
       +--- NEGOTIATING ---> ACCEPTED
       |                         |
       +--- DECLINED             v
                            PRE_EMPLOYMENT
                            (references, DBS)
                                 |
                                 v
                             ACCEPTED
                            (start date set)
```

**Corporate Timeline Summary:**
| Stage | Typical Duration | Ghost Threshold |
|-------|-----------------|-----------------|
| Applied -> Acknowledged | 1-3 business days | 7 business days |
| Acknowledged -> Screening | 3-10 business days | 14 business days |
| Screening -> Interview 1 | 3-7 business days | 14 business days |
| Interview 1 -> Interview 2 | 5-10 business days | 14 business days |
| Final Interview -> Offer | 3-7 business days | 14 business days |
| Offer -> Decision | 2-5 business days | candidate-driven |
| Total pipeline | 3-8 weeks | -- |

### 6.8 State Machine Diagram -- Academic Track

```
    APPLIED
       |
       | 1-7 days (auto-acknowledgement)
       v
  ACKNOWLEDGED
       |
       | 2-6 weeks (application review by committee)
       v
  LONGLISTED (academic-specific)
       |
       | 1-2 weeks (committee shortlisting)
       v
  SHORTLISTED (academic-specific)
       |
       | 1-3 weeks (scheduling)
       v
  TEACHING PRESENTATION -------> REJECTED
  (30-min mock lecture)               ^
       |                              |
       | same day or next day         |
       v                              |
  ACADEMIC INTERVIEW  ---------------+
  (panel: 3-6 members,               |
   45-60 min)                         |
       |                              |
       | 1-4 weeks (committee         |
       |  decision + Senate/Board)    |
       v                              |
  PANEL_APPROVAL                      |
  (Senate/Academic Board) -----------+
       |
       | 1-2 weeks
       v
  OFFER_RECEIVED
       |
       v
  CONTRACT NEGOTIATION
  (salary, probation, workload)
       |
       v
  PRE_EMPLOYMENT
  (DBS, Right to Work,
   references, qualifications)
       |
       | 2-8 weeks
       v
  ACCEPTED
  (start date: typically Sept or Jan)
```

**Academic Timeline Summary:**
| Stage | Typical Duration | Ghost Threshold |
|-------|-----------------|-----------------|
| Applied -> Acknowledged | 1-7 business days | 14 business days |
| Acknowledged -> Longlisted | 2-6 weeks | 8 weeks |
| Longlisted -> Shortlisted | 1-2 weeks | 4 weeks |
| Shortlisted -> Teaching Presentation | 1-3 weeks | 5 weeks |
| Teaching Presentation -> Interview | Same day to 1 day | 7 days |
| Interview -> Panel Approval | 1-4 weeks | 6 weeks |
| Panel Approval -> Offer | 1-2 weeks | 4 weeks |
| Offer -> Decision | 1-2 weeks | candidate-driven |
| Pre-employment checks | 2-8 weeks | 10 weeks |
| Total pipeline | 3-6 months | -- |

### 6.9 Sub-States for Interview Rounds

The INTERVIEWING state supports sub-states to track multiple interview rounds.

```sql
-- Interview round tracking
-- Stored in application_events with event_type = 'interview_scheduled' or 'interview_completed'
-- event_data contains:
{
    "round": 1,                          -- interview round number
    "type": "phone_screen",              -- phone_screen, video, in_person, panel, teaching_presentation
    "format": "competency_based",        -- competency_based, case_study, technical, panel, presentation
    "scheduled_at": "2026-04-15T14:00:00Z",
    "duration_minutes": 45,
    "location": "Teams/Zoom link or address",
    "interviewers": ["Jane Smith, HR Director", "Tom Jones, L&D Lead"],
    "preparation_notes": "Review competency framework, prepare STAR examples",
    "outcome": "passed",                 -- passed, failed, pending, cancelled
    "feedback": "Strong on strategy, asked to prepare a case study for round 2"
}
```

### 6.10 Sub-States for Pre-Employment Checks

Pre-employment checks have their own sub-tracking, particularly important for academic roles.

```sql
-- Pre-employment check tracking
-- Stored in application_pre_employment table
{
    "dbs_check": {
        "required": true,
        "type": "enhanced",              -- basic, standard, enhanced, enhanced_with_barring
        "submitted_at": null,
        "completed_at": null,
        "status": "pending"              -- pending, submitted, processing, cleared, issues_found
    },
    "right_to_work": {
        "required": true,
        "verified": true,                -- candidate has UK work rights
        "document_type": "british_passport",
        "verified_at": "2026-04-20T10:00:00Z"
    },
    "references": {
        "required": 2,
        "referees": [
            {
                "name": "Prof. Jane Smith",
                "organization": "University of Reading",
                "relationship": "PhD Supervisor",
                "email": "j.smith@reading.ac.uk",
                "status": "submitted",       -- requested, submitted, received, verified
                "requested_at": "2026-04-18T00:00:00Z",
                "received_at": null
            },
            {
                "name": "David Jones",
                "organization": "Acme Corp",
                "relationship": "Former Line Manager",
                "email": "d.jones@acme.com",
                "status": "requested",
                "requested_at": "2026-04-18T00:00:00Z",
                "received_at": null
            }
        ]
    },
    "qualification_verification": {
        "required": true,                 -- especially for academic roles
        "qualifications": ["PhD", "MBA"],
        "status": "submitted",            -- pending, submitted, verified
        "hesa_data_submitted": false       -- for academic roles
    },
    "occupational_health": {
        "required": false,                -- some universities require this
        "status": "not_required"
    },
    "it_access": {
        "status": "pending",              -- university IT account setup
        "email_created": false
    }
}
```

---

## 7. Status Detection & Auto-Updates

### 7.1 Overview

Module 4 receives status updates from two sources:

1. **Module 5 (Email Intelligence):** Parses incoming emails from employers and classifies them as acknowledgements, rejections, interview invitations, offers, etc. This is the primary source of automated status updates.
2. **Manual Input:** The candidate records events that happen outside email (phone calls, LinkedIn messages, in-person interactions) by responding to a daily check-in prompt or sending a structured email to a dedicated address.

### 7.2 Email Classification Categories

Module 5 classifies employer emails into the following categories, which Module 4 maps to state transitions:

| Email Category | Module 4 Transition | Confidence Requirement |
|---------------|---------------------|----------------------|
| `application_received` | applied -> acknowledged | Medium (60%+) |
| `application_rejected` | any active -> rejected | High (80%+) |
| `phone_screen_invitation` | applied/acknowledged -> screening | High (80%+) |
| `interview_invitation` | any pre-interview -> interviewing | High (80%+) |
| `assessment_invitation` | interviewing/screening -> assessment | High (80%+) |
| `offer_email` | interviewing/assessment -> offer_received | Very High (90%+) |
| `reference_request` | offer_received/negotiating -> pre_employment | Medium (60%+) |
| `dbs_check_initiated` | pre_employment -> pre_employment (sub-state) | Medium (60%+) |
| `generic_update` | no transition (logged as event) | Low (any) |
| `unclassified` | no transition (flagged for manual review) | -- |

### 7.3 Email Matching to Applications

When Module 5 identifies an employer email, Module 4 must match it to the correct application. This is non-trivial because:

- Employers may email from different addresses than the one on the job posting
- The email subject may not contain the job title
- Multiple applications at the same company create ambiguity

**Matching Algorithm (v2 -- with learning loop and agency support):**

```
0. Pre-check: Look up sender_company_mappings table for confirmed sender -> company mapping
   - If found: use the mapped company and skip to step 3 with +40 confidence bonus
   - This is the learning loop: every manual correction adds an entry to sender_company_mappings

1. Extract sender domain from email

1a. Check if sender domain is a known ATS platform:
    - workday.com, myworkdayjobs.com -> extract company from email body
    - icims.com -> extract company from email body
    - greenhouse.io -> extract company from email body
    - taleo.net -> extract company from email body
    - successfactors.com -> extract company from email body
    If ATS detected: extract company context from email body, not sender domain

1b. Check if sender domain is a known recruitment agency:
    - hays.com, michaelpage.com, robertwalters.com, morganmckinley.com, etc.
    If agency detected: match against applications WHERE recruitment_agency IS NOT NULL
    Match on recruiter_email or (agency_name + job_title in email body)

2. Match against company domains in active applications
   - Direct match: sender domain == company website domain
   - Partial match: sender domain contains company name
3. If multiple applications at same company:
   a. Check email body for job title or reference number
   b. Check email body for application date references
   c. If still ambiguous, match to most recent application at that company
4. If no company match:
   a. Check for recruitment agency names in sender or body
   b. Check for job board notification patterns (Indeed, Reed, etc.)
   c. If no match, flag for manual review
5. Confidence score:
   - Confirmed sender mapping (from learning loop) = 95%
   - Exact domain + job title match = 95%
   - Exact domain + no job title = 75%
   - ATS platform + company extracted from body = 70%
   - Partial domain match = 60%
   - Agency match (recruiter email) = 80%
   - Agency match (agency name only) = 55%
   - No match = flag for review

6. After manual assignment by candidate:
   INSERT INTO sender_company_mappings (sender_domain, sender_email, company_name, ...)
   This ensures the same sender is correctly matched in future.
```

**Implementation (n8n Code node):**

```javascript
function matchEmailToApplication(email, activeApplications) {
    const senderDomain = extractDomain(email.from);
    const senderName = extractName(email.from);
    const subject = email.subject.toLowerCase();
    const body = (email.textBody || email.htmlBody || '').toLowerCase();

    let bestMatch = null;
    let bestConfidence = 0;

    for (const app of activeApplications) {
        let confidence = 0;

        // Domain matching
        const companyDomain = extractDomainFromUrl(app.company_url);
        if (senderDomain === companyDomain) {
            confidence += 50;
        } else if (senderDomain.includes(app.company_name_normalized)) {
            confidence += 30;
        } else if (body.includes(app.company_name_normalized)) {
            confidence += 15;
        }

        // Job title matching
        if (subject.includes(app.job_title_normalized) || body.includes(app.job_title_normalized)) {
            confidence += 30;
        }

        // Reference number matching
        if (app.reference_number && (subject.includes(app.reference_number) || body.includes(app.reference_number))) {
            confidence += 40;
        }

        // Recency bonus (more recent applications are more likely targets)
        const daysSinceApplied = (Date.now() - new Date(app.applied_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceApplied < 7) confidence += 10;
        else if (daysSinceApplied < 30) confidence += 5;

        if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = app;
        }
    }

    return {
        application: bestMatch,
        confidence: Math.min(bestConfidence, 100),
        requires_review: bestConfidence < 50
    };
}
```

### 7.4 Status Update Processing Pipeline

```
Module 5 Email Event
       |
       v
WF4-STATUS receives event via webhook/database trigger
       |
       v
Match email to application (Section 7.3)
       |
       +--- Confidence >= 80%: Auto-apply transition
       |       |
       |       v
       |   Validate transition (state machine check)
       |       |
       |       +--- Valid: Apply transition, log event, notify candidate
       |       |
       |       +--- Invalid: Log warning, notify candidate for review
       |
       +--- Confidence 50-79%: Apply with "needs_confirmation" flag
       |       |
       |       v
       |   Apply transition tentatively
       |   Send notification: "We think [Company] acknowledged your application.
       |                       Is this correct? Reply Y/N"
       |
       +--- Confidence < 50%: Flag for manual review
               |
               v
           Log unmatched email
           Send notification: "Received email from [sender] that may be related
                               to your job search. Please review."
```

### 7.5 Manual Status Update Methods

For events that happen outside email (phone calls, LinkedIn messages, in-person meetings), the candidate can update application status through:

**Method 1: Structured Email**
Send an email to a dedicated address (e.g., tracker@selvi-app.apiloom.io) with a structured format:

```
Subject: UPDATE [Company Name] [Job Title]
Body:
Status: interview_scheduled
Date: 2026-04-15 14:00
Notes: First round, competency-based, 45 min, Teams
Interviewers: Jane Smith (HR Director), Tom Jones (L&D Lead)
```

Module 5 parses this structured email and feeds it to WF4-STATUS as a manual update event.

**Method 2: Daily Check-In Email**
WF4-NOTIFY sends a daily check-in email (when there are active applications) with a simple format:

```
Subject: Daily Application Check-In -- 29 March 2026

You have 15 active applications. Any updates today?

Reply with updates in this format:
- [Company Name]: [new status] -- [notes]

Example:
- Acme Corp: phone screen scheduled for April 2 at 10am
- University of Reading: rejected -- email received, too many applicants
- BigCo Ltd: no change

If no updates, ignore this email.
```

**Method 3: Reply to Notification**
When the system sends a notification about a specific application, the candidate can reply with a status update. The reply is parsed by Module 5 and routed to the correct application.

**Method 4: On-Demand Pipeline Query (v2)**

The candidate can query the pipeline at any time by emailing the tracker address with a QUERY command. This resolves the v1 gap where the only way to check pipeline status was to wait for the weekly report.

```
Subject: QUERY [company name or keyword]

Examples:
  Subject: QUERY BigBank
  Subject: QUERY all active
  Subject: QUERY interviews this week
  Subject: QUERY academic pipeline
  Subject: QUERY status
```

WF4-NOTIFY processes query emails and responds within 5 minutes with:
- **Single company query:** Full application history for that company (state, timeline, documents sent, events)
- **"all active" query:** Summary table of all active applications (company, role, state, days in state)
- **"interviews" query:** All upcoming interviews with preparation details
- **"status" query:** Pipeline snapshot identical to the weekly report's Section 3 (pipeline by stage and track)
- **Track query ("academic"/"corporate"):** Filtered view of one track only

This is implemented as a lightweight n8n sub-workflow triggered by Module 5 when it detects a QUERY-format email from the candidate's address. Response is sent via Resend as an immediate reply.

**QUERY response format (email body):**

```
Subject: Re: QUERY all active

Your Pipeline -- 29 March 2026
==============================

ACTIVE APPLICATIONS (12):

 # | Company          | Role                  | State        | Days | Track
---|------------------|-----------------------|--------------|------|----------
 1 | BigBank PLC      | Head of L&D           | Interviewing |    3 | Corporate
 2 | University of X  | Senior Lecturer       | Longlisted   |   14 | Academic
 3 | Acme Learning    | L&D Manager           | Applied      |    5 | Corporate
...

SUMMARY:
- Applied: 5 | Acknowledged: 2 | Interviewing: 3 | Longlisted: 2
- Follow-ups due: 1 (Acme Learning -- 2 days overdue)
- Interviews this week: 1 (BigBank PLC, Thu 2 Apr, 10:00)

---
Reply QUERY [keyword] for filtered view. Reply QUERY help for all commands.
```

For single-company queries, the response includes the full event timeline:

```
Subject: Re: QUERY BigBank

BigBank PLC -- Head of L&D (Ref: BNK-2026-123)
================================================
State: Interviewing (since 26 Mar 2026, 3 days)
Track: Corporate | Tier: A | Score: 87

Timeline:
  22 Mar -- Applied (auto-send, email to hr@bigbank.com)
  23 Mar -- Acknowledged (auto-reply detected)
  26 Mar -- Interviewing (interview invitation from Sarah Jones)

Documents Sent: CV v2.1 (Corporate), Cover Letter v1

Upcoming: Interview scheduled Thu 2 Apr, 10:00
  Format: Video call (Microsoft Teams)
  Panel: Sarah Jones (Head of HR), Mark Chen (CHRO)
  Prep: Competency-based, prepare examples for leadership development at scale
```

### 7.6 Handling Ambiguous Status Signals

Not all employer communications map cleanly to state transitions. Common ambiguities:

| Signal | Ambiguity | Resolution |
|--------|-----------|------------|
| "We'll be in touch" | Could be acknowledgement or soft rejection | Classify as `acknowledged` with low confidence |
| "We received many applications" | Standard acknowledgement or preamble to rejection | Check for explicit rejection language; if absent, classify as `acknowledged` |
| "Your application is being reviewed" | Genuine update or auto-reply loop | Log as event, do not change state if already `acknowledged` |
| "We'd like to discuss the role" | Phone screen or informal chat | Classify as `screening` |
| "Congratulations" | Offer or invitation to interview | Parse full email; "congratulations on being shortlisted" != offer |
| "Unfortunately" | Rejection | Almost always rejection; classify as `rejected` |
| "We regret to inform" | Rejection | Classify as `rejected` |
| "Your application has been unsuccessful" | Rejection | Classify as `rejected` |
| "We would like to invite you" | Interview or assessment | Parse for date, time, format details |

### 7.7 Rejection Reason Classification

When a rejection is detected, Module 5 extracts the reason (if stated) for analytics. Common categories:

| Rejection Reason | Code | Description |
|-----------------|------|-------------|
| Position filled | `position_filled` | Role filled by another candidate |
| Overqualified | `overqualified` | Candidate has more experience than required |
| Underqualified | `underqualified` | Candidate lacks specific requirements |
| Experience mismatch | `experience_mismatch` | Right level but wrong domain |
| Internal candidate | `internal_candidate` | Role filled by internal hire |
| Role cancelled | `role_cancelled` | Employer withdrew the position |
| Too many applicants | `volume` | High volume; shortlisting was competitive |
| CIPD requirement | `cipd_required` | Chartered CIPD membership specifically required |
| UK experience | `uk_experience` | Insufficient UK-specific experience |
| No reason given | `no_reason` | Standard rejection with no explanation |
| Other | `other` | Stated reason does not fit standard categories |

### 7.8 Interview Detail Extraction

When an interview invitation is detected, Module 5 extracts structured details:

```javascript
const interviewDetails = {
    // Scheduling
    date: '2026-04-15',
    time: '14:00',
    timezone: 'Europe/London',
    duration_minutes: 45,

    // Format
    type: 'video',                    // phone, video, in_person, panel
    platform: 'Microsoft Teams',      // Teams, Zoom, Google Meet, in_person
    link: 'https://teams.microsoft.com/...',
    location: null,                   // physical address if in_person

    // Interview details
    format: 'competency_based',       // competency_based, case_study, technical, presentation, panel
    round: 1,
    interviewers: ['Jane Smith, HR Director'],

    // Preparation
    preparation_required: 'Prepare examples of L&D strategy implementation',
    documents_to_bring: ['ID', 'qualification certificates'],

    // Academic-specific
    teaching_presentation_topic: null,  // for academic roles
    presentation_duration: null,
    audience: null,                     // students, faculty panel, mixed
};
```

---

## 8. Pipeline Metrics & Analytics

### 8.1 Overview

Module 4 calculates comprehensive pipeline metrics daily (WF4-METRICS, 6AM) and stores them in the `pipeline_metrics` table for trending and reporting. Metrics are segmented by pipeline track (corporate vs. academic), time period, and source.

### 8.2 Core Funnel Metrics

The primary funnel tracks conversion at each stage:

```
APPLIED (100%)
    |
    v
ACKNOWLEDGED (target: 70%)
    |
    v
SCREENING (target: 30%)
    |
    v
INTERVIEWING (target: 20%)
    |
    v
ASSESSMENT (target: 10%)
    |
    v
OFFER (target: 5%)
    |
    v
ACCEPTED (target: 3%)
```

**Metric Definitions:**

| Metric | Formula | Segmentation |
|--------|---------|--------------|
| Application Rate | Applications submitted per week | By track, source |
| Acknowledgement Rate | Acknowledged / Applied | By track, source, company_size |
| Screening Rate | Screened / Applied | By track, source |
| Interview Rate | Interviewed / Applied | By track, source |
| Offer Rate | Offers / Applied | By track, source |
| Acceptance Rate | Accepted / Offers | By track |
| Ghosting Rate | Ghosted / Applied | By track, source |
| Rejection Rate | Rejected / Applied | By track, stage_rejected_at |
| Response Rate | Applications that reached any post-applied state (excluding ghosted, expired) / Applications that reached applied or beyond. See Metrics Glossary (Section 8.9). | By track, source |
| Stage Velocity | Median days between consecutive stages | By track, stage pair |
| Pipeline Duration | Median days from Applied to terminal state | By track, outcome |
| Active Pipeline Depth | Count of applications in non-terminal states | By track, current_state |

### 8.3 Time-Based Metrics

| Metric | Formula | Period |
|--------|---------|--------|
| Applications per week | COUNT(applied_at) WHERE applied_at in period | Rolling 7 days |
| Response time (median) | MEDIAN(acknowledged_at - applied_at) | Rolling 30 days |
| Time in current state (per app) | NOW() - state_changed_at | Current |
| Cycle time (applied to resolution) | resolved_at - applied_at | Rolling 30 days |
| Ghosting detection time | ghosted_at - applied_at | Rolling 30 days |

### 8.4 Source Effectiveness Metrics

Track which discovery sources produce the best application outcomes:

| Metric | Formula | Purpose |
|--------|---------|---------|
| Source Response Rate | Responses per source / Applications per source | Which sources lead to employer responses |
| Source Interview Rate | Interviews per source / Applications per source | Which sources lead to interviews |
| Source Offer Rate | Offers per source / Applications per source | Which sources lead to offers |
| Source Ghosting Rate | Ghosted per source / Applications per source | Which sources have highest ghosting |
| Source Cost per Application | Source cost / Applications from source | Cost effectiveness |

### 8.5 Document Performance Metrics

Track which CV and cover letter versions produce the best outcomes:

| Metric | Formula | Purpose |
|--------|---------|---------|
| CV Version Response Rate | Responses with CV version X / Applications with CV version X | Which CV version performs best |
| Cover Letter Type Response Rate | Responses by CL type / Applications by CL type | Corporate vs. academic cover letter effectiveness |
| Tailoring Score vs. Outcome | Correlation between tailoring score and response | Does higher tailoring effort produce better results |

### 8.6 Weekly Metrics Calculation Query

```sql
-- Weekly metrics calculation (run by WF4-METRICS)

-- 1. Application volume
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'applications_submitted',
    COUNT(*),
    jsonb_build_object('track', pipeline_track),
    date_trunc('week', NOW()) - INTERVAL '1 week',
    date_trunc('week', NOW())
FROM applications
WHERE applied_at >= date_trunc('week', NOW()) - INTERVAL '1 week'
  AND applied_at < date_trunc('week', NOW())
GROUP BY pipeline_track;

-- 2. Response rate (trailing 30 days for corporate, 90 days for academic)
-- Definition: applications that reached any post-applied employer-response state / applications submitted
-- Numerator includes: acknowledged, screening, interviewing, assessment, offer_received, negotiating, pre_employment, accepted, declined, rejected
-- Numerator excludes: ghosted, expired (no employer response)
-- Denominator: all applications that reached 'applied' or beyond
-- See Metrics Glossary (Section 8.9) for canonical definition
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'response_rate',
    CASE WHEN COUNT(*) FILTER (WHERE applied_at IS NOT NULL) = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (
             WHERE highest_state_reached NOT IN ('applied', 'ghosted', 'expired')
               AND applied_at IS NOT NULL
         ) / COUNT(*) FILTER (WHERE applied_at IS NOT NULL), 1)
    END,
    jsonb_build_object('track', pipeline_track),
    NOW() - CASE WHEN pipeline_track = 'academic' THEN INTERVAL '90 days' ELSE INTERVAL '30 days' END,
    NOW()
FROM applications
WHERE applied_at >= NOW() - CASE WHEN pipeline_track = 'academic' THEN INTERVAL '90 days' ELSE INTERVAL '30 days' END
GROUP BY pipeline_track;

-- 3. Ghosting rate
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'ghosting_rate_30d',
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (
             WHERE current_state = 'ghosted' OR outcome = 'ghosted'
         ) / COUNT(*), 1)
    END,
    jsonb_build_object('track', pipeline_track),
    NOW() - INTERVAL '30 days',
    NOW()
FROM applications
WHERE applied_at >= NOW() - INTERVAL '30 days'
GROUP BY pipeline_track;

-- 4. Stage velocity (median days between stages)
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'median_response_time_days',
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - applied_at)) / 86400
    ),
    jsonb_build_object('track', pipeline_track),
    NOW() - INTERVAL '30 days',
    NOW()
FROM applications
WHERE acknowledged_at IS NOT NULL
  AND applied_at >= NOW() - INTERVAL '30 days'
GROUP BY pipeline_track;

-- 5. Pipeline depth by state
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'pipeline_depth',
    COUNT(*),
    jsonb_build_object('track', pipeline_track, 'state', current_state),
    NOW(),
    NOW()
FROM applications
WHERE current_state NOT IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
GROUP BY pipeline_track, current_state;

-- 6. Interview conversion rate
-- Definition: applications that EVER reached 'interviewing' or beyond / applications that received any employer response
-- Uses highest_state_reached (not current_state) to count applications rejected after interview
-- Excludes ghosted and expired from denominator (these are not responses)
-- See Metrics Glossary (Section 8.9) for canonical definition
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'interview_conversion_rate',
    CASE WHEN COUNT(*) FILTER (
             WHERE highest_state_reached NOT IN ('applied', 'ghosted', 'expired')
         ) = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (
             WHERE highest_state_reached IN (
                 'interviewing', 'assessment', 'offer_received',
                 'negotiating', 'pre_employment', 'accepted', 'declined'
             )
         ) / COUNT(*) FILTER (
             WHERE highest_state_reached NOT IN ('applied', 'ghosted', 'expired')
         ), 1)
    END,
    jsonb_build_object('track', pipeline_track),
    NOW() - CASE WHEN pipeline_track = 'academic' THEN INTERVAL '90 days' ELSE INTERVAL '30 days' END,
    NOW()
FROM applications
WHERE applied_at >= NOW() - CASE WHEN pipeline_track = 'academic' THEN INTERVAL '90 days' ELSE INTERVAL '30 days' END
GROUP BY pipeline_track;

-- 7. Source effectiveness
INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end)
SELECT
    'source_response_rate_30d',
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (
             WHERE highest_state_reached NOT IN ('applied', 'ghosted', 'expired')
         ) / COUNT(*), 1)
    END,
    -- NOTE: Uses highest_state_reached (not current_state) to correctly count
    -- applications that progressed past 'applied' but were later rejected/withdrawn
    jsonb_build_object('source', discovery_source),
    NOW() - INTERVAL '30 days',
    NOW()
FROM applications a
JOIN jobs j ON a.job_id = j.id
JOIN job_sources js ON j.id = js.job_id
WHERE a.applied_at >= NOW() - INTERVAL '30 days'
GROUP BY discovery_source;
```

### 8.7 Metric Retention Policy

| Metric Type | Retention | Aggregation |
|-------------|-----------|-------------|
| Daily snapshots | 90 days | Raw |
| Weekly summaries | 1 year | Aggregated from daily |
| Monthly summaries | 3 years | Aggregated from weekly |
| Lifetime totals | Forever | Running totals |

### 8.8 Benchmark Targets

Based on UK job market data for the candidate's profile:

| Metric | Target | Good | Needs Improvement |
|--------|--------|------|-------------------|
| Response Rate (Corporate) | > 40% | 25-40% | < 25% |
| Response Rate (Academic) | > 30% | 15-30% | < 15% |
| Interview Rate (Corporate) | > 15% | 8-15% | < 8% |
| Interview Rate (Academic) | > 10% | 5-10% | < 5% |
| Offer Rate | > 5% | 2-5% | < 2% |
| Ghosting Rate (Corporate) | < 40% | 40-60% | > 60% |
| Ghosting Rate (Academic) | < 50% | 50-70% | > 70% |
| Median Response Time (Corporate) | < 5 days | 5-10 days | > 10 days |
| Median Response Time (Academic) | < 21 days | 21-42 days | > 42 days |
| Applications per Week | 8-15 | 5-8 or 15-20 | < 5 or > 25 |

### 8.9 Metrics Glossary

Canonical definitions for all metrics. Every metric is defined once here and referenced by name elsewhere. Each definition maps to its exact SQL implementation.

| Metric Name | Definition | SQL Expression | Notes |
|-------------|-----------|---------------|-------|
| Response Rate | Applications that received any employer response / Applications submitted | `COUNT(applied_at IS NOT NULL AND highest_state_reached NOT IN ('applied','ghosted','expired')) / COUNT(applied_at IS NOT NULL)` | Use 30-day window for corporate, 90-day for academic. Excludes pre-application states from both numerator and denominator. |
| Interview Conversion Rate | Applications that ever reached 'interviewing' or beyond / Applications that received any employer response | `COUNT(highest_state_reached IN ('interviewing','assessment','offer_received','negotiating','pre_employment','accepted','declined')) / COUNT(highest_state_reached NOT IN ('applied','ghosted','expired'))` | Uses highest_state_reached (not current_state) to capture applications rejected after interview. Excludes ghosted/expired from denominator. |
| Ghosting Rate | Applications classified as ghosted / Applications submitted | `COUNT(outcome = 'ghosted') / COUNT(applied_at IS NOT NULL)` | |
| Stage Velocity | Median days between consecutive stages | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (next_stage_at - prev_stage_at))/86400)` | |
| Median Response Time | Median days from applied to first employer response (responding employers only) | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - applied_at))/86400) WHERE acknowledged_at IS NOT NULL` | Label as "responding employers only" to avoid survivorship bias. Show alongside probability-of-response metric. |
| Funnel Conversion | Applications that ever reached a stage or beyond / total applications | Uses `highest_state_reached` column, not `current_state` | Reports "reached this stage or beyond" to handle stage-skipping correctly. |

### 8.10 Minimum Sample Size Policy

Do not display document performance or source effectiveness metrics until a minimum sample size is reached:

| Metric Category | Minimum n per segment | Display before threshold |
|----------------|----------------------|--------------------------|
| CV version response rate | n >= 10 applications per version | "Insufficient data (N/10 applications)" |
| Source response rate | n >= 8 applications per source | "Insufficient data (N/8 applications)" |
| Track-specific rates | n >= 5 applications per track | Show with warning |

For metrics below threshold, show the raw counts but not the percentage. After 30 days of data, switch from external benchmarks (Section 8.8) to personalized trailing averages.

---

## 9. Notification & Reminder Engine

### 9.1 Overview

The notification engine (WF4-NOTIFY) sends emails to the candidate at defined intervals and in response to specific events. All notifications are sent via Resend API. The engine respects quiet hours (no notifications between 10PM and 7AM UK time) and batches low-priority notifications to avoid inbox flooding.

### 9.1b Pause / Vacation Mode

The candidate can pause all Module 4 notifications and automated follow-ups during holidays or breaks.

**Activation:**
- Set `m4_pipeline_paused = true` in `application_config` via webhook or direct database update
- Optional: set `m4_pause_until` date for automatic resume
- WF4-GHOST, WF4-NOTIFY, and WF4-REPORT all check the pause flag before processing

**Behaviour when paused:**
- No follow-up reminders are sent
- No ghosting detections are triggered
- Status updates from Module 5 are still processed (so the pipeline state stays current)
- The weekly report is still generated but includes a "PAUSED since {date}" banner
- Ghosting timers are frozen: `days_in_state` calculation subtracts the pause duration

**Resume:**
- Set `m4_pipeline_paused = false` or wait for `m4_pause_until` to pass
- On resume, the system recalculates all follow-up dates based on adjusted timers
- A "Welcome back" summary email is sent with any status changes that occurred during the pause

**Implementation in WF4-GHOST:**
```
[Postgres: Check Pause Flag]
    SELECT (config_value->>'m4_pipeline_paused')::boolean AS paused,
           (config_value->>'m4_pause_until')::timestamptz AS pause_until
    FROM application_config WHERE config_key = 'system_settings'
    |
    IF paused AND (pause_until IS NULL OR pause_until > NOW()):
        STOP workflow
```

### 9.2 Notification Types

| Type | Priority | Trigger | Delivery |
|------|----------|---------|----------|
| Status Change Alert (positive) | High | Interview invitation, shortlisting, offer | Immediate (within quiet hours) |
| Status Change Alert (rejection) | Low | Rejection received | Batched: rejections are grouped into a daily "Pipeline Update" at 8AM, not sent individually. The batch email leads with any positive updates, then lists rejections matter-of-factly: "[Company] -- [Role]: Not progressing. [N] other applications active." This reduces the psychological impact of receiving individual rejection notifications throughout the day. |
| Interview Scheduled | Critical | Interview invitation detected | Immediate (override quiet hours) |
| Offer Received | Critical | Offer detected | Immediate (override quiet hours) |
| Follow-Up Reminder | Medium | Ghost threshold reached | Batched daily at 8AM |
| Deadline Approaching | Medium | Application deadline within 48 hours | Batched daily at 8AM |
| Daily Check-In | Low | Active applications exist | Daily at 8AM (weekdays only) |
| Weekly Summary | Low | Weekly schedule | Sunday 7PM |
| Monthly Trend Report | Low | Monthly schedule | 1st of month, 8AM |
| Duplicate Application Warning | Medium | Same employer application detected | Immediate |

### 9.3 Notification Throttling

To prevent notification fatigue:

| Rule | Detail |
|------|--------|
| Max notifications per hour | 5 (excluding critical) |
| Max notifications per day | 20 (excluding critical) |
| Batch window for medium priority | 8AM daily |
| Quiet hours | 10PM - 7AM UK time (critical notifications exempt) |
| Cool-down per application | No more than 1 notification per application per 24 hours (except status changes) |
| Snooze support | Candidate can snooze reminders for 3d/1w/2w per application |

### 9.4 Follow-Up Reminder Logic

The follow-up engine (WF4-GHOST) runs every 6 hours and evaluates all active applications against timeline thresholds.

**Corporate Follow-Up Rules:**

```
IF current_state = 'applied' AND days_since(applied_at) > 7 AND no follow_up_sent:
    -> Send reminder: "No response from [Company] after 7 business days. Consider a polite follow-up email."
    -> Suggested action: Draft follow-up email

IF current_state = 'applied' AND days_since(applied_at) > 14 AND follow_up_already_sent:
    -> Send reminder: "Still no response from [Company] after 14 days (follow-up sent on [date]). Likely ghosted."
    -> Suggested action: Mark as ghosted, move on

IF current_state = 'acknowledged' AND days_since(acknowledged_at) > 14:
    -> Send reminder: "[Company] acknowledged your application 14+ days ago but no next step. Consider a check-in."
    -> Suggested action: Send brief check-in email

IF current_state = 'screening' AND days_since(screening_at) > 7:
    -> Send reminder: "Phone screen with [Company] was [N] days ago. No interview invitation yet."
    -> Suggested action: Send thank-you/follow-up if not already sent

IF current_state = 'interviewing' AND days_since(last_interview_at) > 10:
    -> Send reminder: "Last interview with [Company] was [N] days ago. Follow up?"
    -> Suggested action: Send brief follow-up expressing continued interest
```

**Academic Follow-Up Rules:**

```
IF current_state = 'applied' AND days_since(applied_at) > 21 AND no follow_up_sent:
    -> Send reminder: "No response from [University] after 3 weeks. This is normal for academic hiring."
    -> Suggested action: Wait (do NOT follow up yet -- academic timelines are longer)

IF current_state = 'applied' AND days_since(applied_at) > 42 AND no follow_up_sent:
    -> Send reminder: "No response from [University] after 6 weeks. Consider a polite enquiry to HR."
    -> Suggested action: Draft brief enquiry email to HR

IF current_state = 'applied' AND days_since(applied_at) > 56:
    -> Send reminder: "[University] application has been pending 8+ weeks. Likely position filled or process stalled."
    -> Suggested action: Mark as ghosted, send one final enquiry

IF current_state = 'shortlisted' AND days_since(shortlisted_at) > 28:
    -> Send reminder: "Shortlisted by [University] 4+ weeks ago but no interview scheduled."
    -> Suggested action: Enquire with hiring manager

IF current_state = 'interviewing' AND days_since(last_interview_at) > 21:
    -> Send reminder: "Academic interview with [University] was 3+ weeks ago. Committee review may still be in progress."
    -> Suggested action: Wait another 1-2 weeks before following up (Senate/Board approvals take time)
```

### 9.5 Follow-Up Email Templates

WF4-NOTIFY generates suggested follow-up text for the candidate (not sent automatically -- the candidate chooses whether and how to follow up).

**Corporate Follow-Up Template (7-day no response):**

```
Subject suggestion: Re: [Job Title] Application -- [Your Name]

Suggested text:
Dear [Hiring Manager/Recruiting Team],

I wanted to follow up on my application for the [Job Title] role submitted
on [date]. I remain very interested in this opportunity and would welcome
the chance to discuss how my experience in [relevant area] could contribute
to [Company]'s [team/objectives].

Please let me know if you need any additional information.

Best regards,
[Name]
```

**Academic Follow-Up Template (6-week no response):**

```
Subject suggestion: Enquiry regarding [Job Title] application (Ref: [reference number])

Suggested text:
Dear [HR Team/Recruiting Manager],

I am writing to enquire about the status of my application for the
[Job Title] position (reference: [ref number]) submitted on [date].
I understand that academic recruitment processes involve careful
committee review and I appreciate the time this takes.

I remain very enthusiastic about the opportunity to contribute to
[University]'s [Department/School] and would be grateful for any
update on the timeline for this appointment.

Kind regards,
[Name]
```

### 9.6 Ghosting Detection Algorithm

```python
def detect_ghosting(application):
    track = application.pipeline_track
    state = application.current_state
    days_in_state = (now() - application.state_changed_at).days
    follow_ups_sent = count_follow_ups(application.id)

    # Define thresholds per track and state
    thresholds = {
        'corporate': {
            'applied': {'warn': 7, 'ghost': 14, 'max_followups': 2},
            'acknowledged': {'warn': 10, 'ghost': 21, 'max_followups': 1},
            'screening': {'warn': 7, 'ghost': 14, 'max_followups': 1},
            'interviewing': {'warn': 7, 'ghost': 14, 'max_followups': 1},
        },
        'academic': {
            'applied': {'warn': 21, 'ghost': 84, 'max_followups': 1},  # 84 days (not 56) -- academic hiring cycles are 8-12 weeks
            'acknowledged': {'warn': 28, 'ghost': 84, 'max_followups': 1},
            'academic_longlisted': {'warn': 28, 'ghost': 56, 'max_followups': 1},  # Longlisted but no shortlist decision yet
            'academic_shortlisted': {'warn': 21, 'ghost': 42, 'max_followups': 1},  # Shortlisted but no interview scheduled
            'screening': {'warn': 14, 'ghost': 28, 'max_followups': 1},
            'interviewing': {'warn': 21, 'ghost': 42, 'max_followups': 1},
        }
    }

    t = thresholds.get(track, thresholds['corporate']).get(state)
    if not t:
        return None

    if days_in_state >= t['ghost'] and follow_ups_sent >= t['max_followups']:
        return 'ghosted'  # Auto-transition to ghosted
    elif days_in_state >= t['warn']:
        return 'follow_up_due'  # Send follow-up reminder
    else:
        return None  # Still within expected window
```

### 9.7 Notification Email Templates

**Status Change Notification:**

```html
Subject: Application Update: [Company] -- [Job Title]

<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Application Status Update</h2>

    <div style="background: #f7f7f7; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>[Company Name]</strong></p>
        <p style="margin: 4px 0; color: #666;">[Job Title]</p>
        <p style="margin: 8px 0;">
            Status: <span style="color: #888; text-decoration: line-through;">[Previous State]</span>
            &rarr; <span style="color: #2563eb; font-weight: bold;">[New State]</span>
        </p>
    </div>

    <p>[Event description -- e.g., "Employer acknowledged receipt of your application."]</p>

    <p style="color: #666; font-size: 14px;">
        Applied: [date] | Days in pipeline: [N] | Track: [Corporate/Academic]
    </p>

    <!-- Next expected action -->
    <div style="background: #eff6ff; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px;">
            <strong>What to expect next:</strong> [e.g., "Phone screen invitation typically follows within 5-10 business days."]
        </p>
    </div>
</div>
```

**Weekly Summary Email:**

```html
Subject: Weekly Application Pipeline -- [Date Range]

<div style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">
    <h2>Weekly Pipeline Summary</h2>
    <p style="color: #666;">[Start Date] -- [End Date]</p>

    <!-- Key metrics -->
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
            <td style="text-align: center; padding: 12px; background: #f0fdf4; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: bold; color: #16a34a;">[N]</div>
                <div style="font-size: 12px; color: #666;">Active Applications</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="text-align: center; padding: 12px; background: #eff6ff; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: bold; color: #2563eb;">[N]</div>
                <div style="font-size: 12px; color: #666;">New This Week</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="text-align: center; padding: 12px; background: #fef3c7; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: bold; color: #d97706;">[N]</div>
                <div style="font-size: 12px; color: #666;">Need Follow-Up</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="text-align: center; padding: 12px; background: #fef2f2; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: bold; color: #dc2626;">[N]%</div>
                <div style="font-size: 12px; color: #666;">Response Rate</div>
            </td>
        </tr>
    </table>

    <!-- Pipeline breakdown -->
    <h3>Pipeline by Stage</h3>
    <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f7f7f7;">
            <th style="text-align: left; padding: 8px;">Stage</th>
            <th style="text-align: center; padding: 8px;">Corporate</th>
            <th style="text-align: center; padding: 8px;">Academic</th>
            <th style="text-align: center; padding: 8px;">Total</th>
        </tr>
        <!-- Rows for each stage -->
        <tr>
            <td style="padding: 8px;">Applied (awaiting response)</td>
            <td style="text-align: center;">[N]</td>
            <td style="text-align: center;">[N]</td>
            <td style="text-align: center; font-weight: bold;">[N]</td>
        </tr>
        <!-- ... more rows ... -->
    </table>

    <!-- This week's wins -->
    <h3>This Week's Wins</h3>
    <ul>
        <!-- Positive status changes: interview invitations, shortlistings, offers -->
        <li>Interview invitation from <strong>[Company]</strong> for [Job Title] ([date])</li>
        <li>Shortlisted at <strong>[Company]</strong> for [Job Title] ([date])</li>
        <!-- If no wins this week: -->
        <li style="color: #666;">No new positive responses this week -- but [N] applications are still in progress. Results take time.</li>
    </ul>

    <!-- Status changes this week -->
    <h3>Status Changes This Week</h3>
    <ul>
        <li><strong>[Company]</strong> -- [Job Title]: [old state] &rarr; [new state] ([date])</li>
        <!-- ... more items ... -->
    </ul>

    <!-- Applications needing follow-up -->
    <h3>Follow-Up Required</h3>
    <ul>
        <li><strong>[Company]</strong> -- [Job Title]: Applied [N] days ago, no response. [Suggested action]</li>
        <!-- ... more items ... -->
    </ul>

    <!-- Upcoming deadlines -->
    <h3>Upcoming Deadlines</h3>
    <ul>
        <li><strong>[Company]</strong> -- [Job Title]: Deadline [date] ([N] days remaining)</li>
        <!-- ... more items ... -->
    </ul>

    <!-- Conversion funnel -->
    <h3>Conversion Funnel (Last 30 Days)</h3>
    <div style="font-family: monospace; font-size: 13px; line-height: 1.6;">
        Applied:      [===========================] [N] (100%)<br>
        Acknowledged:  [===================]        [N] ([X]%)<br>
        Screening:     [===========]                [N] ([X]%)<br>
        Interviewing:  [=======]                    [N] ([X]%)<br>
        Offer:         [==]                         [N] ([X]%)<br>
    </div>

    <!-- Top sources -->
    <h3>Top Sources (by response rate)</h3>
    <ol>
        <li>[Source]: [X]% response rate ([N] applications)</li>
        <!-- ... more items ... -->
    </ol>

    <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;">
    <p style="color: #999; font-size: 12px;">
        Generated by Selvi Job App Module 4 | Pipeline Tracker v1.0
    </p>
</div>
```

---

## 10. Weekly Summary Reports

### 10.1 Report Structure

The weekly summary report (WF4-REPORT, Sunday 7PM UK time) is a comprehensive email that provides the candidate with a complete view of her application pipeline. It is structured in sections from most actionable to least actionable.

### 10.2 Section 1: Action Items

The most important section. Lists items requiring the candidate's attention this week.

| Action Item Type | Priority | Description |
|-----------------|----------|-------------|
| Upcoming Interviews | Critical | Interviews scheduled for the coming week, with date/time/format/preparation notes |
| Offer Decisions Pending | Critical | Offers awaiting response, with deadline if known |
| Deadlines This Week | High | Applications with closing dates in the next 7 days |
| Follow-Ups Due | Medium | Applications past follow-up threshold |
| Status Confirmations Needed | Low | Tentative status updates that need candidate confirmation |

### 10.3 Section 2: This Week's Activity

| Metric | Detail |
|--------|--------|
| Applications submitted | Count + list of companies |
| Status changes | List of all transitions (company, from -> to, date) |
| Interviews completed | List with any feedback noted |
| Rejections received | Count + list of companies + reasons if stated |
| New jobs shortlisted | Count of A/B-tier jobs awaiting application |

### 10.4 Section 3: Pipeline Snapshot

| Category | Data Points |
|----------|-------------|
| Active applications | Total, by track (corporate/academic), by stage |
| Applications awaiting response | Count, average wait time |
| Ghosted this week | New ghosting detections |
| Pipeline age distribution | < 1 week, 1-2 weeks, 2-4 weeks, 1-2 months, 2+ months |

### 10.5 Section 4: Metrics & Trends

| Metric | This Week | Last Week | 4-Week Average | Trend |
|--------|-----------|-----------|----------------|-------|
| Applications submitted | N | N | N | up/down/flat |
| Response rate | N% | N% | N% | up/down/flat |
| Interview rate | N% | N% | N% | up/down/flat |
| Ghosting rate | N% | N% | N% | up/down/flat |
| Median response time | N days | N days | N days | up/down/flat |

### 10.6 Section 5: Source Performance

| Source | Apps Submitted | Responses | Response Rate | Interviews |
|--------|---------------|-----------|---------------|------------|
| Reed | N | N | N% | N |
| Indeed | N | N | N% | N |
| LinkedIn | N | N | N% | N |
| jobs.ac.uk | N | N | N% | N |
| CIPD | N | N | N% | N |
| Direct | N | N | N% | N |

### 10.7 Section 6: Document Performance

| CV Version | Applications | Responses | Response Rate | Best Performing |
|------------|-------------|-----------|---------------|-----------------|
| Corporate v1.0 | N | N | N% | |
| Corporate v1.1 (tailored) | N | N | N% | Y |
| Academic CV | N | N | N% | |

### 10.8 Section 7: Strategic Observations

WF4-REPORT uses Claude Haiku to generate 2-3 brief strategic observations based on the week's data. Examples:

- "Your response rate from academic applications (32%) is higher than corporate (18%) this month. Consider increasing academic application volume."
- "You've received 3 rejections at the phone screen stage this month. It may be worth reviewing your phone interview preparation."
- "Applications submitted via direct company career pages have a 45% response rate vs. 22% for job board applications. Prioritize direct applications where possible."
- "Your pipeline has 8 applications in the 'applied' state older than 2 weeks. Consider batch follow-ups this week."

**LLM Prompt for Strategic Observations:**

```
You are analysing a job search pipeline for a PhD + MBA professional with
18 years of HR/L&D experience, seeking UK corporate L&D Manager-to-Head
roles (GBP 70-80k) and university Lecturer/Senior Lecturer positions
near Maidenhead, Berkshire.

Given this week's pipeline data:
{{metrics_json}}

Generate 2-3 brief, actionable observations (1-2 sentences each).
Focus on patterns that suggest a change in strategy.
Do not state obvious facts. Do not be encouraging or motivational.
Be direct and specific. Use numbers.
```

### 10.9 Report Generation Query

```sql
-- Weekly report data assembly (run by WF4-REPORT)

-- Action items: upcoming interviews
SELECT a.id, a.company_name, a.job_title, ae.event_data
FROM applications a
JOIN application_events ae ON a.id = ae.application_id
WHERE ae.event_type = 'interview_scheduled'
  AND (ae.event_data->>'date')::date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  AND a.current_state IN ('screening', 'interviewing', 'assessment')
ORDER BY (ae.event_data->>'date')::timestamptz ASC;

-- Action items: deadlines this week
SELECT a.id, a.company_name, a.job_title, j.expires_at
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE j.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  AND a.current_state IN ('discovered', 'shortlisted', 'cv_tailored')
ORDER BY j.expires_at ASC;

-- This week's activity
SELECT a.id, a.company_name, a.job_title, a.pipeline_track,
       ae.event_type, ae.from_state, ae.to_state, ae.occurred_at
FROM application_events ae
JOIN applications a ON ae.application_id = a.id
WHERE ae.occurred_at >= NOW() - INTERVAL '7 days'
  AND ae.is_valid_transition = true
ORDER BY ae.occurred_at DESC;

-- Pipeline snapshot
SELECT current_state, pipeline_track, COUNT(*)
FROM applications
WHERE current_state NOT IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
GROUP BY current_state, pipeline_track
ORDER BY
    CASE current_state
        WHEN 'offer_received' THEN 1
        WHEN 'negotiating' THEN 2
        WHEN 'pre_employment' THEN 3
        WHEN 'assessment' THEN 4
        WHEN 'interviewing' THEN 5
        WHEN 'screening' THEN 6
        WHEN 'acknowledged' THEN 7
        WHEN 'applied' THEN 8
        WHEN 'cv_tailored' THEN 9
        WHEN 'shortlisted' THEN 10
        WHEN 'discovered' THEN 11
    END;

-- Metrics comparison: this week vs last week
SELECT
    'this_week' as period,
    COUNT(*) as total_applied,
    COUNT(*) FILTER (WHERE current_state NOT IN ('applied', 'ghosted')) as responses,
    COUNT(*) FILTER (WHERE current_state IN ('interviewing', 'assessment', 'offer_received', 'negotiating', 'pre_employment', 'accepted')) as interviews,
    COUNT(*) FILTER (WHERE outcome = 'ghosted') as ghosted
FROM applications
WHERE applied_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT
    'last_week',
    COUNT(*),
    COUNT(*) FILTER (WHERE current_state NOT IN ('applied', 'ghosted')),
    COUNT(*) FILTER (WHERE current_state IN ('interviewing', 'assessment', 'offer_received', 'negotiating', 'pre_employment', 'accepted')),
    COUNT(*) FILTER (WHERE outcome = 'ghosted')
FROM applications
WHERE applied_at >= NOW() - INTERVAL '14 days'
  AND applied_at < NOW() - INTERVAL '7 days';
```

---

## 11. Corporate vs Academic Pipeline Differences

### 11.1 Overview

The candidate's dual-track job search requires the system to maintain two distinct pipeline models. While the underlying state machine is shared, the interpretation of states, the expected timelines, the follow-up rules, and the stage definitions differ substantially between corporate and academic tracks.

This section specifies every difference and how the system handles it.

### 11.2 Track Classification

Each application is classified as `corporate` or `academic` based on the job's `job_type` field from Module 1 scoring. This classification is set at application creation and does not change.

| Signal | Classification | Confidence |
|--------|---------------|------------|
| Company is a university | Academic | High |
| Job title contains "Lecturer", "Professor", "Teaching Fellow" | Academic | High |
| Job posted on jobs.ac.uk | Academic | High |
| Salary uses UK academic pay scales (Grade 7, Grade 8, etc.) | Academic | Medium |
| Company is a private employer | Corporate | High |
| Job title contains "Manager", "Head of", "Director", "Lead" | Corporate | High |
| Job posted on general job boards | Could be either | Low (use other signals) |
| NHS L&D role | Corporate | Medium (NHS uses its own system but is not academic) |
| FE College role | Academic-adjacent | Medium (treated as academic timeline) |

### 11.3 Stage Name Differences

| Pipeline Stage | Corporate Label | Academic Label |
|---------------|----------------|----------------|
| SCREENING | Phone Screen | Initial Discussion / Informal Chat |
| INTERVIEWING (Round 1) | First Interview | Teaching Presentation + Panel Interview |
| INTERVIEWING (Round 2) | Second Interview / Final Interview | Second Panel / Dean Interview |
| ASSESSMENT | Assessment Centre / Case Study | REF Assessment / Research Review |
| PRE_EMPLOYMENT | References + Background Check | DBS + References + Qualification Verification + HESA |

### 11.4 Timeline Differences

| Metric | Corporate | Academic |
|--------|-----------|----------|
| Posting to closing date | 2-4 weeks | 4-8 weeks |
| Application to acknowledgement | 1-3 days | 1-14 days |
| Acknowledgement to first interview | 1-3 weeks | 4-10 weeks |
| Interview rounds | 2-3, spaced 1-2 weeks | 1-2, often same day |
| Last interview to decision | 3-7 days | 2-6 weeks |
| Offer to start date | 1-3 months (notice period) | 3-6 months (academic calendar) |
| Total pipeline | 3-8 weeks | 3-6 months |

### 11.5 Follow-Up Etiquette Differences

| Situation | Corporate Approach | Academic Approach |
|-----------|--------------------|-------------------|
| No response after application | Follow up after 1 week | Do NOT follow up before 3 weeks |
| After phone screen | Thank-you email same day | Thank-you email appropriate but less expected |
| After interview | Follow up after 5-7 days | Do NOT chase; committee process has its own timeline |
| After final interview | Enquire after 10 days | Enquire after 3-4 weeks (Senate/Board review) |
| Ghosting detection | 14 days no response | 8 weeks no response |

### 11.6 Academic-Specific Stages

The academic pipeline includes stages that do not exist in corporate hiring:

**11.6.1 Teaching Presentation**

UK universities typically require shortlisted candidates to deliver a 15-30 minute teaching presentation as part of the interview process. This is distinct from a corporate "presentation" assessment.

```json
{
    "stage": "teaching_presentation",
    "details": {
        "topic": "Introduce the concept of organisational culture to a group of Level 5 HRM students",
        "duration_minutes": 20,
        "audience": "Panel of 3-5 academics (acting as students)",
        "followed_by": "Q&A (10 minutes)",
        "assessment_criteria": [
            "Subject knowledge",
            "Pedagogical approach",
            "Student engagement",
            "Use of technology/resources",
            "Accessibility and inclusivity"
        ]
    }
}
```

**11.6.2 REF/Research Assessment**

For Senior Lecturer and above, the Research Excellence Framework (REF) matters. Some universities assess candidates' research output and REF-ability.

```json
{
    "stage": "ref_assessment",
    "details": {
        "publications_required": true,
        "ref_quality_threshold": "3* or above",
        "research_statement_submitted": true,
        "phd_completions_asked": true
    }
}
```

**11.6.3 Academic Board/Senate Approval**

After the interview panel recommends a candidate, many universities require formal approval from the Academic Board or Senate. This is a bottleneck that can add 2-4 weeks to the process.

**11.6.4 HESA Data Requirements**

New academic staff must provide data for the Higher Education Statistics Agency (HESA). This is a post-offer, pre-employment stage.

### 11.7 Corporate-Specific Stages

**11.7.1 Assessment Centre**

Large UK corporates (FTSE 100/250, Big 4, Civil Service) frequently use assessment centres for mid-senior roles. A full-day event with multiple exercises.

```json
{
    "stage": "assessment_centre",
    "details": {
        "date": "2026-04-20",
        "duration": "full_day",
        "exercises": [
            "Group exercise / business case discussion",
            "In-tray exercise",
            "Presentation (prepared topic)",
            "Panel interview (competency-based)",
            "Psychometric tests"
        ],
        "location": "Company HQ, London",
        "other_candidates": true
    }
}
```

**11.7.2 Psychometric Testing**

Some corporates require psychometric tests (SHL, Saville, cut-e) at the screening stage.

```json
{
    "stage": "psychometric_test",
    "details": {
        "type": "verbal_reasoning",
        "provider": "SHL",
        "time_limit_minutes": 25,
        "deadline": "2026-04-12",
        "link": "https://shl.com/...",
        "practice_available": true
    }
}
```

**11.7.3 Case Study Presentation**

Corporate L&D roles frequently ask candidates to prepare a case study presentation (e.g., "Design a leadership development programme for our organization").

### 11.8 Track-Specific Metric Benchmarks

| Metric | Corporate Target | Academic Target | Notes |
|--------|-----------------|-----------------|-------|
| Response rate | 40%+ | 25%+ | Academic roles have higher competition ratios |
| Time to first response | < 5 days | < 21 days | Academic processes are inherently slower |
| Interview rate | 15%+ | 8%+ | Academic roles shortlist fewer candidates |
| Applications per week | 5-10 | 2-5 | Academic applications take longer to prepare (academic CV, research statement) |
| Offer rate | 5%+ | 3%+ | Academic interviews typically shortlist 3-5 candidates |

---

## 12. Database Schema

### 12.1 Schema Overview

Module 4 adds 12 new tables to the existing `selvi_jobs` database (see Section 12.13 for full list), extending the schema established by Module 1. All tables follow the same conventions: UUID primary keys, `created_at`/`updated_at` timestamps, and explicit foreign key relationships.

### 12.2 Table: applications

The central tracking table. One row per job application.

```sql
CREATE TABLE applications (
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

-- Indexes
CREATE INDEX idx_applications_state ON applications(current_state) WHERE is_active = true;
CREATE INDEX idx_applications_track ON applications(pipeline_track) WHERE is_active = true;
CREATE INDEX idx_applications_applied ON applications(applied_at DESC) WHERE applied_at IS NOT NULL;
CREATE INDEX idx_applications_company ON applications(company_domain);
CREATE INDEX idx_applications_company_name ON applications(company_name);
CREATE INDEX idx_applications_follow_up ON applications(next_follow_up_at)
    WHERE is_active = true AND next_follow_up_at IS NOT NULL;
CREATE INDEX idx_applications_ghosting ON applications(state_changed_at)
    WHERE is_active = true AND current_state IN ('applied', 'acknowledged', 'screening', 'interviewing');
CREATE INDEX idx_applications_cv_version ON applications(cv_version_id);
CREATE INDEX idx_applications_outcome ON applications(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_active_company ON applications(company_name)
    WHERE is_active = true;

-- Updated_at trigger (reuse from Module 1)
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 12.3 Table: application_events

Every state transition, email received, note added, document attached, and follow-up sent is recorded as an event. This provides a complete audit trail for each application.

```sql
CREATE TABLE application_events (
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

-- Indexes
CREATE INDEX idx_app_events_application ON application_events(application_id, occurred_at DESC);
CREATE INDEX idx_app_events_type ON application_events(event_type);
CREATE INDEX idx_app_events_occurred ON application_events(occurred_at DESC);
CREATE INDEX idx_app_events_source ON application_events(event_source);
CREATE INDEX idx_app_events_email ON application_events(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_app_events_invalid ON application_events(is_valid_transition) WHERE is_valid_transition = false;
```

### 12.4 Table: application_documents

Links applications to specific CV and cover letter versions generated by Module 2.

```sql
CREATE TABLE application_documents (
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

-- Indexes
CREATE INDEX idx_app_docs_application ON application_documents(application_id);
CREATE INDEX idx_app_docs_type ON application_documents(document_type);
CREATE INDEX idx_app_docs_version ON application_documents(document_version);
```

### 12.5 Table: application_interviews

Detailed tracking of each interview round.

```sql
CREATE TABLE application_interviews (
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

-- Indexes
CREATE INDEX idx_app_interviews_application ON application_interviews(application_id);
CREATE INDEX idx_app_interviews_scheduled ON application_interviews(scheduled_at)
    WHERE status = 'scheduled';
CREATE INDEX idx_app_interviews_upcoming ON application_interviews(scheduled_at)
    WHERE scheduled_at > NOW() AND status = 'scheduled';

CREATE TRIGGER update_app_interviews_updated_at BEFORE UPDATE ON application_interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 12.6 Table: application_pre_employment

Tracks pre-employment check progress for accepted offers.

```sql
CREATE TABLE application_pre_employment (
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
    -- Note: 'issues_found' removed from v2. System stores only pending/cleared.
    -- Any DBS issues must be managed offline, not in this database.

    -- Right to Work
    rtw_required BOOLEAN DEFAULT true,
    rtw_verified BOOLEAN DEFAULT false,
    rtw_document_type VARCHAR(50),                  -- e.g., 'british_passport', 'brp', 'share_code'
    rtw_verified_at TIMESTAMPTZ,

    -- References (data minimized -- store name and status only, not email/org)
    references_required INTEGER DEFAULT 2,
    references_received INTEGER DEFAULT 0,
    references_details JSONB DEFAULT '[]'::jsonb,   -- Array of {name, status} only. Email/org details
                                                     -- deleted within 30 days of check completion.

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

-- Indexes
CREATE INDEX idx_app_pre_emp_application ON application_pre_employment(application_id);
CREATE INDEX idx_app_pre_emp_incomplete ON application_pre_employment(all_checks_complete)
    WHERE all_checks_complete = false;

CREATE TRIGGER update_app_pre_emp_updated_at BEFORE UPDATE ON application_pre_employment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 12.6b DBS Data Cleanup (Scheduled)

DBS data is special category data under UK GDPR Article 10 and must be deleted within 30 days of pre-employment completion or job search end. This cleanup runs as part of WF4-METRICS (daily at 6AM):

```sql
-- DBS 30-day cleanup: nullify DBS fields for completed or abandoned checks
UPDATE application_pre_employment
SET dbs_submitted_at = NULL,
    dbs_completed_at = NULL,
    dbs_status = 'not_required',
    dbs_type = NULL,
    updated_at = NOW()
WHERE dbs_status IN ('cleared')
  AND dbs_completed_at < NOW() - INTERVAL '30 days';

-- Also clean DBS data for applications that reached terminal state >30 days ago
UPDATE application_pre_employment pe
SET dbs_submitted_at = NULL,
    dbs_completed_at = NULL,
    dbs_status = 'not_required',
    dbs_type = NULL,
    updated_at = NOW()
FROM applications a
WHERE pe.application_id = a.id
  AND a.is_active = false
  AND a.resolved_at < NOW() - INTERVAL '30 days'
  AND pe.dbs_status != 'not_required';
```

This query is added to WF4-METRICS between the cron trigger and the first metrics calculation node.

### 12.7 Table: pipeline_metrics

Stores calculated pipeline metrics for trending and reporting.

```sql
CREATE TABLE pipeline_metrics (
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

-- Indexes
CREATE INDEX idx_pipeline_metrics_name ON pipeline_metrics(metric_name, calculated_at DESC);
CREATE INDEX idx_pipeline_metrics_period ON pipeline_metrics(period_type, period_start DESC);
CREATE INDEX idx_pipeline_metrics_dimensions ON pipeline_metrics USING gin(dimensions);
CREATE UNIQUE INDEX idx_pipeline_metrics_upsert
    ON pipeline_metrics(metric_name, period_start, period_type, dimensions);
```

### 12.8 Table: follow_up_log

Tracks follow-up reminders sent and candidate actions taken.

```sql
CREATE TABLE follow_up_log (
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

-- Indexes
CREATE INDEX idx_follow_up_application ON follow_up_log(application_id, created_at DESC);
CREATE INDEX idx_follow_up_pending ON follow_up_log(candidate_action)
    WHERE candidate_action IS NULL;
```

### 12.9 Table: application_notes

Free-form notes attached to applications by the candidate.

```sql
CREATE TABLE application_notes (
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

-- Indexes
CREATE INDEX idx_app_notes_application ON application_notes(application_id, created_at DESC);
```

### 12.10 Table: notification_queue

Queues outbound notifications for delivery by WF4-NOTIFY. Previously defined only in Section 13.6; now included in the canonical schema.

```sql
CREATE TABLE notification_queue (
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

CREATE INDEX idx_notif_queue_pending ON notification_queue(sent, priority, created_at)
    WHERE sent = false;
```

### 12.11 Table: notification_log

Records all sent notifications for audit, throttling, and delivery tracking.

```sql
CREATE TABLE notification_log (
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

CREATE INDEX idx_notif_log_type ON notification_log(notification_type, sent_at DESC);
CREATE INDEX idx_notif_log_application ON notification_log(application_id, sent_at DESC);
CREATE INDEX idx_notif_log_recent ON notification_log(sent_at DESC);
```

### 12.12 Table: sender_company_mappings

Stores confirmed email sender-to-company mappings to improve email matching accuracy over time (learning loop). Populated from manual corrections when the candidate assigns unmatched or mismatched emails.

```sql
CREATE TABLE sender_company_mappings (
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

CREATE INDEX idx_sender_mappings_domain ON sender_company_mappings(sender_domain);
CREATE INDEX idx_sender_mappings_email ON sender_company_mappings(sender_email);
```

### 12.13 Schema Overview Update

Module 4 adds **12 new tables** to the existing `selvi_jobs` database: `applications`, `application_events`, `application_documents`, `application_interviews`, `application_pre_employment`, `pipeline_metrics`, `follow_up_log`, `application_notes`, `notification_queue`, `notification_log`, `sender_company_mappings`, and `pipeline_track_config` (Appendix A.2).

### 12.14 Schema Migration

```sql
-- Migration: Module 4 schema v1.0
-- Applied by: WF4 deployment
-- Date: 2026-03-29

BEGIN;

-- Create all Module 4 tables (Sections 12.2 through 12.9)
-- [SQL from above sections]

-- Update Module 1 jobs table to add Module 4 integration columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_state VARCHAR(30);

-- Create index on jobs for Module 4 lookups
CREATE INDEX IF NOT EXISTS idx_jobs_application_id ON jobs(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_application_state ON jobs(application_state) WHERE application_state IS NOT NULL;

-- Create trigger to sync application state to jobs table
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

CREATE TRIGGER trigger_sync_app_state_to_jobs
AFTER INSERT OR UPDATE OF current_state ON applications
FOR EACH ROW EXECUTE FUNCTION sync_application_state_to_jobs();

-- Register migration
INSERT INTO schema_migrations (version, name) VALUES (4, 'Module 4: Application Tracker schema v1.0');

COMMIT;
```

### 12.11 Entity Relationship Diagram

```
+------------------+       +---------------------+       +---------------------+
|     jobs         |       |   applications      |       | application_events  |
| (Module 1)       |       |                     |       |                     |
+------------------+       +---------------------+       +---------------------+
| id (PK)          |<------| job_id (FK)         |<------| application_id (FK) |
| title            |       | id (PK)             |       | id (PK)             |
| company          |       | company_name        |       | event_type          |
| location         |       | job_title           |       | event_source        |
| description      |       | pipeline_track      |       | from_state          |
| tier             |       | current_state       |       | to_state            |
| composite_score  |       | applied_at          |       | event_data (JSONB)  |
| application_id   |------>| cv_version_id       |       | occurred_at         |
| application_state|       | cover_letter_id     |       +---------------------+
+------------------+       | follow_up_count     |
                           | ...                 |       +---------------------+
                           +---------------------+       | application_docs    |
                                    |                    |                     |
                                    |              +---->| application_id (FK) |
                                    |              |     | document_type       |
                                    +--------------+     | filename            |
                                    |                    | tailoring_score     |
                                    |                    +---------------------+
                                    |
                                    |                    +---------------------+
                                    |                    | application_intrvws |
                                    |              +---->|                     |
                                    +--------------+     | application_id (FK) |
                                    |                    | round_number        |
                                    |                    | interview_type      |
                                    |                    | scheduled_at        |
                                    |                    | outcome             |
                                    |                    +---------------------+
                                    |
                                    |                    +---------------------+
                                    |                    | application_pre_emp |
                                    +------------------>|                     |
                                    |                    | application_id (FK) |
                                    |                    | dbs_status          |
                                    |                    | rtw_verified        |
                                    |                    | references_received |
                                    |                    +---------------------+
                                    |
                                    |                    +---------------------+
                                    |                    | follow_up_log       |
                                    +------------------>|                     |
                                    |                    | application_id (FK) |
                                    |                    | reminder_type       |
                                    |                    | candidate_action    |
                                    |                    +---------------------+
                                    |
                                    |                    +---------------------+
                                    +------------------>| application_notes   |
                                                         |                     |
                                                         | application_id (FK) |
                                                         | note_text           |
                                                         | note_type           |
                                                         +---------------------+

+---------------------+
| pipeline_metrics    |
|                     |
| metric_name         |
| metric_value        |
| dimensions (JSONB)  |
| period_start        |
| period_end          |
+---------------------+
```

---

## 13. n8n Workflow Specifications

### 13.1 Workflow WF4-INIT: Application Initializer

**Purpose:** Create a new application tracking record when a job moves from shortlisted to applied. Called by Module 3 (Auto-Apply) or triggered by manual input.

**Trigger:** Sub-workflow call (from Module 3) + Webhook (for manual applications)

**Webhook URL:**
```
POST https://n8n.deploy.apiloom.io/webhook/application-created
Content-Type: application/json
Authorization: Bearer {{ $env.WEBHOOK_TOKEN }}
```

**Webhook Payload:**
```json
{
    "job_id": "uuid-of-job-from-module-1",
    "application_method": "auto_apply",
    "portal_confirmation_id": "APP-12345",
    "cv_version_id": "uuid-of-cv-version",
    "cover_letter_id": "uuid-of-cover-letter",
    "cv_filename": "Selvi_CV_Corporate_LnD_v2.1.pdf",
    "cover_letter_filename": "Selvi_CL_AcmeCorp_LnD_Manager.pdf",
    "applied_at": "2026-03-29T10:30:00Z",
    "application_url": "https://careers.acmecorp.com/apply/12345",
    "reference_number": "REF-2026-0456",
    "notes": "Applied via company career portal"
}
```

**Node Chain:**

```
[Webhook Trigger / Sub-workflow Input]
    |
[IF: job_id is null or empty?]
    |
    +--- Yes (Speculative Application):
    |   [Code: Create speculative application record]
    |       -- Speculative applications are sent directly to employers/agencies
    |       -- without a matching job listing in Module 1. Common for:
    |       --   - Networking contacts who suggested applying
    |       --   - Speculative emails to target companies
    |       --   - Agency registrations
    |       -- Required fields: company_name, job_title (can be "Speculative"),
    |       --   application_method, and optionally contact_name/contact_email
    |       -- Set pipeline_track based on job_title keywords
    |       -- Set discovery_source = 'speculative'
    |       |
    |   [Postgres: INSERT into applications with job_id = NULL]
    |       |
    |   [RETURN: application_id]
    |
    +--- No (Standard Application):
[Postgres: Fetch Job Data]
    SELECT j.*, js.composite_score, js.tier, js.job_type
    FROM jobs j
    LEFT JOIN job_scores js ON j.id = js.job_id
    WHERE j.id = {{ $json.job_id }}
    |
[Code: Prepare Application Record]
    -- Extract company domain from URL
    -- Determine pipeline track from job_type
    -- Set initial follow-up date based on track
    |
[IF: Application Already Exists?]
    SELECT id FROM applications WHERE job_id = {{ $json.job_id }}
    |
    +--- Exists: Update existing record
    |       UPDATE applications SET
    |           current_state = 'applied',
    |           applied_at = NOW(),
    |           application_method = {{ $json.application_method }},
    |           ...
    |
    +--- Does Not Exist: Create new record
            INSERT INTO applications (
                job_id, company_name, job_title, company_url, company_domain,
                reference_number, pipeline_track, current_state,
                applied_at, application_method, application_url,
                portal_confirmation_id, cv_version_id, cover_letter_id,
                cv_filename, cover_letter_filename, discovery_source,
                next_follow_up_at
            ) VALUES (...)
            |
            [Postgres: Insert Application Event]
                INSERT INTO application_events (
                    application_id, event_type, event_source,
                    event_data, from_state, to_state
                ) VALUES (
                    {{ new_app_id }}, 'application_submitted',
                    'module_3', {{ $json }},
                    'cv_tailored', 'applied'
                )
                |
            [Postgres: Insert Application Documents]
                INSERT INTO application_documents (
                    application_id, document_type, document_version,
                    filename, sent_at
                ) VALUES
                    ({{ app_id }}, 'cv', {{ cv_version }}, {{ cv_filename }}, NOW()),
                    ({{ app_id }}, 'cover_letter', {{ cl_version }}, {{ cl_filename }}, NOW())
                |
            [IF: Duplicate Company Check]
                SELECT id, job_title, current_state FROM applications
                WHERE company_name = {{ company_name }}
                  AND is_active = true
                  AND id != {{ new_app_id }}
                |
                +--- Has existing active app at same company:
                |       [WF4-NOTIFY: Send Duplicate Warning]
                |           "Warning: You now have 2 active applications at [Company].
                |            Existing: [Job Title] (status: [state])
                |            New: [Job Title]"
                |
                +--- No duplicate: Continue
    |
[Postgres: Update Jobs Table]
    UPDATE jobs SET
        status = 'applied',
        application_id = {{ new_app_id }},
        application_state = 'applied'
    WHERE id = {{ $json.job_id }}
    |
[Response: Return application_id]
```

**Application Record Preparation Code:**

```javascript
const job = $input.first().json;
const input = $('Webhook Trigger').first().json;

// Extract company domain from URL
function extractDomain(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

// Determine pipeline track
function determineTrack(jobType, title) {
    if (jobType === 'academic') return 'academic';
    if (jobType === 'corporate') return 'corporate';

    // Fallback: check title
    const academicTitles = ['lecturer', 'professor', 'teaching fellow', 'reader', 'associate professor'];
    const titleLower = (title || '').toLowerCase();
    if (academicTitles.some(t => titleLower.includes(t))) return 'academic';

    return 'corporate';
}

// Calculate initial follow-up date
function calculateFollowUp(track) {
    const now = new Date();
    const days = track === 'academic' ? 21 : 7;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

const track = determineTrack(job.job_type, job.title);

return [{
    json: {
        job_id: input.job_id,
        company_name: job.company,
        job_title: job.title,
        company_url: job.url,
        company_domain: extractDomain(job.url),
        reference_number: input.reference_number || null,
        pipeline_track: track,
        current_state: 'applied',
        applied_at: input.applied_at || new Date().toISOString(),
        application_method: input.application_method || 'manual_portal',
        application_url: input.application_url || null,
        portal_confirmation_id: input.portal_confirmation_id || null,
        cv_version_id: input.cv_version_id || null,
        cover_letter_id: input.cover_letter_id || null,
        cv_filename: input.cv_filename || null,
        cover_letter_filename: input.cover_letter_filename || null,
        discovery_source: job.source || 'unknown',
        next_follow_up_at: calculateFollowUp(track),
        salary_offered_min: job.salary_min,
        salary_offered_max: job.salary_max,
    }
}];
```

### 13.2 Workflow WF4-STATUS: Status Update Processor

**Purpose:** Process status updates from Module 5 email parsing, validate state transitions, and update application records.

**Trigger:** Cron (every 30 minutes) + Webhook (from Module 5)

**Cron Expression:**
```
*/30 * * * *
Timezone: Europe/London
```

**Webhook URL:**
```
POST https://n8n.deploy.apiloom.io/webhook/status-update
```

**Node Chain:**

```
[Cron Trigger / Webhook]
    |
[Code: Acquire Processing Lock (Atomic Claim)]
    -- Prevents duplicate processing when cron and webhook fire simultaneously
    -- Uses an atomic claim pattern:
    UPDATE application_config
    SET config_value = jsonb_set(config_value, '{wf4_status_lock}',
        to_jsonb(NOW()::text))
    WHERE config_key = 'system_locks'
      AND (config_value->>'wf4_status_lock' IS NULL
           OR (config_value->>'wf4_status_lock')::timestamptz < NOW() - INTERVAL '10 minutes')
    RETURNING id;
    -- If no row returned: another instance is running, exit workflow
    -- Lock auto-expires after 10 minutes to prevent deadlock from crashed runs
    |
[Postgres: Fetch Pending Status Updates]
    -- Check for unprocessed email events from Module 5
    SELECT eu.*
    FROM email_updates eu
    WHERE eu.processed = false
      AND eu.classification_confidence >= 50
    ORDER BY eu.received_at ASC
    LIMIT 20
    |
[Loop Over Each Update] (SplitInBatches, batch size: 1)
    |
    [Postgres: Fetch Active Applications for Matching]
        SELECT a.*, j.company, j.title, j.url
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.is_active = true
        |
    [Code: Match Email to Application]
        -- See Section 7.3 matching algorithm
        |
    [IF: Match Found (confidence >= 50)?]
        |
        +--- Yes:
        |   [Code: Determine State Transition]
        |       -- Map email classification to state transition
        |       -- Validate against state machine
        |       |
        |   [IF: Confidence >= 80%?]
        |       |
        |       +--- Yes (auto-apply):
        |       |   [Postgres: Call transition_application_state()]
        |       |       SELECT transition_application_state(
        |       |           {{ app_id }}, {{ new_state }},
        |       |           {{ event_type }}, 'module_5',
        |       |           {{ event_data }}, {{ notes }}
        |       |       )
        |       |       |
        |       |   [IF: Transition Successful?]
        |       |       +--- Yes:
        |       |       |   [WF4-NOTIFY: Send Status Change Alert]
        |       |       |   [Postgres: Mark Email Update Processed]
        |       |       |
        |       |       +--- No (invalid transition):
        |       |           [Log Warning]
        |       |           [WF4-NOTIFY: Alert Candidate of Unexpected Status]
        |       |
        |       +--- No (50-79%, needs confirmation):
        |           [Postgres: Apply Tentative Transition]
        |               -- Apply transition but flag needs_confirmation = true
        |           [WF4-NOTIFY: Send Confirmation Request]
        |               "We think [Company] [action]. Is this correct?"
        |
        +--- No (< 50%, no match):
            [Log Unmatched Email]
            [WF4-NOTIFY: Send Manual Review Request]
                "Received email from [sender] that may be job-related. Please review."
            [Postgres: Mark Email Update as unmatched]
```

**Status Mapping Code:**

```javascript
function mapEmailToTransition(emailClassification, currentState) {
    const transitionMap = {
        'application_received': {
            newState: 'acknowledged',
            eventType: 'application_acknowledged',
        },
        'application_rejected': {
            newState: 'rejected',
            eventType: 'application_rejected',
        },
        'phone_screen_invitation': {
            newState: 'screening',
            eventType: 'phone_screen_invited',
        },
        'interview_invitation': {
            newState: 'interviewing',
            eventType: 'interview_invited',
        },
        'assessment_invitation': {
            newState: 'assessment',
            eventType: 'assessment_invited',
        },
        'offer_email': {
            newState: 'offer_received',
            eventType: 'offer_extended',
        },
        'reference_request': {
            newState: 'pre_employment',
            eventType: 'pre_employment_started',
        },
    };

    const mapping = transitionMap[emailClassification];
    if (!mapping) return null;

    return {
        newState: mapping.newState,
        eventType: mapping.eventType,
    };
}
```

### 13.3 Workflow WF4-GHOST: Ghosting & Follow-Up Engine

**Purpose:** Evaluate all active applications against timeline thresholds, generate follow-up reminders, detect ghosting, and check for approaching deadlines.

**Trigger:** Cron -- every 6 hours (8AM, 2PM, 8PM UK time)

**Cron Expression:**
```
0 8,14,20 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Fetch Active Applications]
    SELECT a.*,
           EXTRACT(EPOCH FROM (NOW() - a.state_changed_at)) / 86400 AS days_in_state,
           EXTRACT(EPOCH FROM (NOW() - a.applied_at)) / 86400 AS days_since_applied,
           a.follow_up_count,
           a.last_follow_up_at,
           a.follow_up_snoozed_until,
           j.expires_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.is_active = true
      AND a.current_state IN ('applied', 'acknowledged', 'screening', 'interviewing', 'academic_longlisted', 'academic_shortlisted')
      AND (a.follow_up_snoozed_until IS NULL OR a.follow_up_snoozed_until < NOW())
    ORDER BY a.state_changed_at ASC
    |
[Loop Over Each Application] (SplitInBatches, batch size: 5)
    |
    [Code: Evaluate Follow-Up Status]
        -- Implement ghosting detection algorithm (Section 9.6)
        -- Returns: 'ok' | 'follow_up_due' | 'ghosted'
        |
    [Switch: Follow-Up Action]
        |
        +--- 'ok': No action needed
        |       [No Op]
        |
        +--- 'follow_up_due': Send follow-up reminder
        |   [Code: Generate Follow-Up Template]
        |       -- Select appropriate template based on track + state
        |       |
        |   [Postgres: Insert Follow-Up Log]
        |       INSERT INTO follow_up_log (
        |           application_id, reminder_type, suggested_action,
        |           follow_up_template, sent_at
        |       ) VALUES (...)
        |       |
        |   [Postgres: Update Application Follow-Up Count]
        |       UPDATE applications SET
        |           follow_up_count = follow_up_count + 1,
        |           last_follow_up_at = NOW(),
        |           next_follow_up_at = NOW() + INTERVAL '7 days'
        |       WHERE id = {{ app_id }}
        |       |
        |   [WF4-NOTIFY: Queue Follow-Up Reminder]
        |
        +--- 'ghosted': Auto-transition to ghosted state
            [Postgres: Call transition_application_state()]
                SELECT transition_application_state(
                    {{ app_id }}, 'ghosted',
                    'ghosting_detected', 'wf4_ghost',
                    '{"days_waited": N, "follow_ups_sent": N}',
                    'Automatically detected as ghosted after N days with no response'
                )
                |
            [WF4-NOTIFY: Send Ghosting Notification]
                "Application to [Company] for [Job Title] has been marked as ghosted
                 after [N] days with no response ([N] follow-ups sent)."

    |
[Postgres: Check Approaching Deadlines]
    SELECT a.id, a.company_name, a.job_title, j.expires_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.current_state IN ('discovered', 'shortlisted', 'cv_tailored')
      AND j.expires_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
      AND j.expires_at > NOW()
    |
[Loop Over Approaching Deadlines]
    [WF4-NOTIFY: Queue Deadline Alert]
        "Application deadline for [Job Title] at [Company] is in [N] hours.
         Current status: [state]. Apply now or mark as expired."
```

**Follow-Up Evaluation Code:**

```javascript
const apps = $input.all();
const results = [];

for (const app of apps) {
    const a = app.json;
    const track = a.pipeline_track;
    const state = a.current_state;
    const daysInState = a.days_in_state;
    const followUps = a.follow_up_count || 0;

    // Thresholds by track and state
    const thresholds = {
        corporate: {
            applied: { warn: 7, ghost: 14, maxFollowups: 2 },
            acknowledged: { warn: 10, ghost: 21, maxFollowups: 1 },
            screening: { warn: 7, ghost: 14, maxFollowups: 1 },
            interviewing: { warn: 7, ghost: 14, maxFollowups: 1 },
        },
        academic: {
            applied: { warn: 21, ghost: 56, maxFollowups: 1 },
            acknowledged: { warn: 28, ghost: 56, maxFollowups: 1 },
            screening: { warn: 14, ghost: 28, maxFollowups: 1 },
            interviewing: { warn: 21, ghost: 42, maxFollowups: 1 },
        }
    };

    const t = (thresholds[track] || thresholds.corporate)[state];
    if (!t) {
        results.push({ json: { ...a, action: 'ok' } });
        continue;
    }

    let action = 'ok';
    if (daysInState >= t.ghost && followUps >= t.maxFollowups) {
        action = 'ghosted';
    } else if (daysInState >= t.warn && followUps < t.maxFollowups) {
        action = 'follow_up_due';
    }

    results.push({ json: { ...a, action, thresholdDays: t.warn, ghostDays: t.ghost } });
}

return results;
```

### 13.4 Workflow WF4-METRICS: Pipeline Metrics Calculator

**Purpose:** Calculate all pipeline metrics daily and store in the `pipeline_metrics` table.

**Trigger:** Cron -- daily at 6AM UK time

**Cron Expression:**
```
0 6 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Upsert Today's Metrics]
    -- Use INSERT ... ON CONFLICT (UPSERT) instead of DELETE+INSERT to prevent
    -- data loss if the workflow crashes mid-execution.
    -- Each metric is identified by (metric_name, period_start, period_type, dimensions).
    -- If today's metric already exists, it is updated; otherwise inserted.
    -- A unique constraint is required:
    -- CREATE UNIQUE INDEX idx_pipeline_metrics_upsert
    --     ON pipeline_metrics(metric_name, period_start, period_type, dimensions);
    --
    -- Aggregation: for weekly/monthly rollups, use weighted averages:
    --   weekly_value = SUM(daily_value * sample_size) / SUM(sample_size)
    --   where sample_size is the number of applications contributing to the metric
    |
[Code: Generate Metric Queries]
    -- Generate all metric calculation queries (Section 8.6)
    |
[Postgres: Execute Application Volume Metrics]
    -- Applications submitted by track
    |
[Postgres: Execute Response Rate Metrics]
    -- Response rates by track and source
    |
[Postgres: Execute Ghosting Metrics]
    -- Ghosting rates by track
    |
[Postgres: Execute Stage Velocity Metrics]
    -- Median time between stages
    |
[Postgres: Execute Pipeline Depth Metrics]
    -- Current pipeline state counts
    |
[Postgres: Execute Source Effectiveness Metrics]
    -- Response/interview/offer rates by source
    |
[Postgres: Execute Document Performance Metrics]
    -- CV version response rates
    |
[Postgres: Execute Funnel Metrics]
    -- Conversion rates through the funnel
    |
[Postgres: Log Metric Calculation]
    INSERT INTO system_metrics (metric_name, metric_value)
    VALUES ('wf4_metrics_calculated', 1)
```

### 13.5 Workflow WF4-REPORT: Weekly Summary Reporter

**Purpose:** Generate and send the weekly pipeline summary email.

**Trigger:** Cron -- Monday 7AM UK time (moved from Sunday 7PM for better timing -- the candidate can review at the start of the work week when action items are actionable)

**Cron Expression:**
```
0 7 * * 1
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Fetch Action Items]
    -- Upcoming interviews (next 7 days)
    -- Pending offer decisions
    -- Approaching deadlines
    -- Follow-ups due
    |
[Postgres: Fetch This Week's Activity]
    -- Applications submitted
    -- Status changes
    -- Rejections received
    -- Ghosting detections
    |
[Postgres: Fetch Pipeline Snapshot]
    -- Active applications by stage and track
    |
[Postgres: Fetch Metrics]
    -- This week vs last week vs 4-week average
    |
[Postgres: Fetch Source Performance]
    -- Response rates by source
    |
[Postgres: Fetch Document Performance]
    -- CV version response rates
    |
[Code: Assemble Report Data]
    -- Combine all query results into structured object
    |
[IF: Strategic Observations Enabled?]
    -- Check system_config for ai_observations_enabled
    |
    +--- Yes:
    |   [HTTP Request: Claude Haiku]
    |       POST https://api.anthropic.com/v1/messages
    |       -- Send metrics JSON with observation prompt (Section 10.8)
    |       |
    |   [Code: Parse Observations]
    |
    +--- No:
        [No Op]
    |
[Code: Render HTML Email]
    -- Apply weekly summary template (Section 9.7)
    |
[HTTP Request: Send via Resend]
    POST https://api.resend.com/emails
    {
        "from": "Selvi Job Tracker <tracker@notifications.apiloom.io>",
        "to": ["selvi@email.com"],
        "subject": "Weekly Pipeline Summary -- [date range]",
        "html": "{{ rendered_html }}"
    }
    |
[Postgres: Log Notification]
    INSERT INTO notification_log (
        notification_type, channel, recipient, subject,
        jobs_count, status, sent_at
    ) VALUES (
        'weekly_summary', 'email', 'selvi@email.com',
        'Weekly Pipeline Summary -- [date range]',
        {{ active_count }}, 'sent', NOW()
    )
```

### 13.6 Workflow WF4-NOTIFY: Notification Dispatcher

**Purpose:** Send all notifications -- status changes, follow-up reminders, deadline alerts, and duplicate warnings. Respects throttling and quiet hours.

**Trigger:** Event-driven (internal queue) + Cron (8AM daily for batched medium-priority notifications)

**Cron Expression:**
```
0 8 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger / Internal Event]
    |
[Postgres: Fetch Pending Notifications]
    SELECT * FROM notification_queue
    WHERE sent = false
      AND (priority = 'critical'
           OR (priority = 'high' AND NOW() >= '07:00' AND NOW() <= '22:00')
           OR (priority = 'medium' AND NOW() >= '07:55' AND NOW() <= '08:15')
           OR (priority = 'low' AND NOW() >= '07:55' AND NOW() <= '08:15'))
    ORDER BY
        CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        created_at ASC
    LIMIT 20
    |
[Code: Apply Throttling Rules]
    -- Check hourly/daily limits
    -- Check per-application cool-down
    -- Filter out snoozed notifications
    |
[Loop Over Each Notification] (SplitInBatches, batch size: 1)
    |
    [Code: Render Notification Email]
        -- Select template based on notification type
        -- Populate with application data
        |
    [HTTP Request: Send via Resend]
        POST https://api.resend.com/emails
        |
    [IF: Send Successful?]
        |
        +--- Yes:
        |   [Postgres: Mark Notification Sent]
        |       UPDATE notification_queue SET sent = true, sent_at = NOW()
        |   [Postgres: Log to notification_log]
        |
        +--- No:
            [Postgres: Increment Retry Count]
            [IF: Retries > 3?]
                +--- Yes: Mark as failed, alert admin
                +--- No: Leave for next run
```

**Notification Queue Table:**

```sql
CREATE TABLE notification_queue (
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

CREATE INDEX idx_notif_queue_pending ON notification_queue(sent, priority, created_at)
    WHERE sent = false;
```

---

## 14. Integration with Modules 1, 2, 3, 5

### 14.1 Module 1 (Job Discovery) Integration

**Direction:** Module 1 -> Module 4

**Integration Point:** When Module 1 discovers and scores a job, Module 4 creates the initial tracking record in the `discovered` state.

**Data Flow:**

```
Module 1 (WF5: Scoring Pipeline)
    |
    | Scores job, assigns tier
    |
    v
Module 4 (Postgres trigger on jobs table)
    |
    | IF tier IN ('A', 'B') THEN create application record
    |
    v
applications table: INSERT with current_state = 'shortlisted'
```

**Implementation:**

```sql
-- Trigger: Auto-create application record when job is scored A or B
CREATE OR REPLACE FUNCTION auto_create_application()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create if tier is A or B and no application exists
    IF NEW.tier IN ('A', 'B') AND NEW.scored = true THEN
        IF NOT EXISTS (SELECT 1 FROM applications WHERE job_id = NEW.id) THEN
            INSERT INTO applications (
                job_id, company_name, job_title, company_domain,
                pipeline_track, current_state, discovered_at, shortlisted_at,
                discovery_source, salary_offered_min, salary_offered_max
            ) VALUES (
                NEW.id,
                NEW.company,
                NEW.title,
                CASE WHEN NEW.url IS NOT NULL THEN
                    regexp_replace(
                        regexp_replace(NEW.url, '^https?://(www\.)?', ''),
                        '/.*$', ''
                    )
                END,
                COALESCE(NEW.job_type, 'corporate'),
                'shortlisted',
                NEW.discovered_at,
                NOW(),
                (SELECT source FROM job_sources WHERE job_id = NEW.id LIMIT 1),
                NEW.salary_min,
                NEW.salary_max
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_application
AFTER UPDATE OF tier ON jobs
FOR EACH ROW
WHEN (NEW.tier IS NOT NULL AND OLD.tier IS DISTINCT FROM NEW.tier)
EXECUTE FUNCTION auto_create_application();
```

**Shared Data:**

| Module 1 Field | Module 4 Use |
|----------------|-------------|
| `jobs.id` | Primary key link (`applications.job_id`) |
| `jobs.title` | Denormalized to `applications.job_title` |
| `jobs.company` | Denormalized to `applications.company_name` |
| `jobs.url` | Used to extract `applications.company_domain` |
| `jobs.tier` | Determines auto-shortlisting |
| `jobs.job_type` | Sets `applications.pipeline_track` |
| `jobs.composite_score` | Stored for reference |
| `jobs.salary_min/max` | Sets `applications.salary_offered_min/max` |
| `jobs.expires_at` | Used for deadline tracking |
| `jobs.posted_at` | Used for timeline context |
| `job_sources.source` | Sets `applications.discovery_source` |

### 14.2 Module 2 (CV Tailoring) Integration

**Direction:** Module 2 -> Module 4

**Integration Point:** When Module 2 generates a tailored CV and cover letter for a specific job, it notifies Module 4 via webhook or database update.

**Data Flow:**

```
Module 2 (CV Tailoring Workflow)
    |
    | Generates tailored CV + cover letter
    | Stores files in document storage
    |
    v
Module 4 (WF4-INIT receives document IDs)
    |
    | Records document versions in application_documents table
    | Updates application state to 'cv_tailored'
    |
    v
applications table: UPDATE current_state = 'cv_tailored'
application_documents table: INSERT cv + cover_letter records
```

**Webhook Payload from Module 2:**

```json
{
    "job_id": "uuid-of-job",
    "cv_version_id": "uuid-of-cv-version",
    "cv_filename": "Selvi_CV_Corporate_LnD_v2.1_AcmeCorp.pdf",
    "cv_file_path": "/data/documents/cv/2026-03/cv_v2.1_acmecorp.pdf",
    "cv_base_template": "corporate_ld_manager_v2",
    "cv_tailoring_score": 82,
    "cv_tailoring_notes": "Added Acme Corp industry context, highlighted leadership development experience, matched CIPD equivalency language",
    "cover_letter_id": "uuid-of-cover-letter",
    "cover_letter_filename": "Selvi_CL_AcmeCorp_LnD_Manager.pdf",
    "cover_letter_file_path": "/data/documents/cl/2026-03/cl_acmecorp_ld.pdf",
    "cover_letter_type": "corporate",
    "additional_documents": [
        {
            "type": "portfolio",
            "filename": "Selvi_LnD_Portfolio_2026.pdf",
            "file_path": "/data/documents/portfolio/portfolio_2026.pdf"
        }
    ]
}
```

**Shared Data:**

| Module 2 Field | Module 4 Use |
|----------------|-------------|
| `cv_version_id` | Links to specific CV version |
| `cv_filename` | Displayed in application history |
| `cv_tailoring_score` | Used in document performance analytics |
| `cover_letter_id` | Links to specific cover letter |
| `cover_letter_type` | Determines if corporate or academic CL was used |

### 14.3 Module 3 (Auto-Apply) Integration

**Direction:** Module 3 -> Module 4

**Integration Point:** When Module 3 submits an application (automatically or records a manual submission), it calls WF4-INIT to create/update the tracking record.

**Data Flow:**

```
Module 3 (Auto-Apply Workflow)
    |
    | Submits application to employer portal
    | Gets confirmation ID (if available)
    |
    v
Module 4 (WF4-INIT via sub-workflow call)
    |
    | Creates application record with state = 'applied'
    | Records application method, URL, confirmation
    | Links CV/cover letter documents
    | Sets initial follow-up date
    |
    v
applications table: INSERT/UPDATE with applied state
```

**Sub-Workflow Call from Module 3:**

```javascript
// In Module 3 workflow, after successful application submission:
const response = await $runWorkflow({
    workflowId: 'WF4-INIT',
    data: {
        job_id: job.id,
        application_method: 'auto_apply',
        portal_confirmation_id: submissionResult.confirmationId || null,
        application_url: submissionResult.applicationUrl,
        cv_version_id: documents.cvVersionId,
        cover_letter_id: documents.coverLetterId,
        cv_filename: documents.cvFilename,
        cover_letter_filename: documents.coverLetterFilename,
        applied_at: new Date().toISOString(),
        reference_number: submissionResult.referenceNumber || null,
        notes: `Auto-applied via ${submissionResult.method}. ${submissionResult.notes || ''}`
    }
});
```

**Module 3 Failure Handling:**

When Module 3 fails to submit an application (portal down, CAPTCHA, format error), Module 4 should be notified but the state should NOT change to `applied`:

```javascript
// Module 3 failure notification to Module 4
if (submissionFailed) {
    await insertApplicationEvent({
        application_id: app.id,
        event_type: 'application_failed',
        event_source: 'module_3',
        event_data: {
            error: submissionError.message,
            method: 'auto_apply',
            portal_url: portalUrl,
            retry_scheduled: true
        },
        notes: `Auto-apply failed: ${submissionError.message}. Will retry.`
    });
    // State remains 'cv_tailored' -- not advanced to 'applied'
}
```

### 14.4 Module 5 (Email Intelligence) Integration

**Direction:** Module 5 -> Module 4 (primary), Module 4 -> Module 5 (context)

**Integration Point:** Module 5 parses incoming emails, classifies them, and feeds status updates to Module 4. Module 4 provides context to Module 5 (list of active applications, company domains) to improve email matching accuracy.

**Data Flow (Module 5 -> Module 4):**

```
Module 5 (Email Parser)
    |
    | Receives email from employer
    | Classifies: acknowledgement / rejection / interview / offer / etc.
    | Extracts: company, job reference, dates, details
    |
    v
Module 4 (WF4-STATUS via webhook)
    |
    | Matches email to application
    | Validates state transition
    | Updates application record
    | Sends notification to candidate
```

**Webhook Payload from Module 5:**

```json
{
    "email_id": "msg-id-from-imap",
    "email_from": "recruitment@acmecorp.com",
    "email_subject": "Your application for L&D Manager (REF-2026-0456)",
    "email_received_at": "2026-04-01T09:15:00Z",
    "email_body_text": "Dear Selvi, Thank you for your application...",
    "email_body_html": "<html>...",

    "classification": "application_received",
    "classification_confidence": 92,
    "classification_model": "claude-3.5-haiku",

    "extracted_data": {
        "company_name": "Acme Corp",
        "job_title": "Learning & Development Manager",
        "reference_number": "REF-2026-0456",
        "contact_name": "Jane Smith",
        "contact_email": "j.smith@acmecorp.com",
        "contact_role": "Head of HR",
        "next_steps": "We will review applications and be in touch within 2 weeks",
        "deadline_mentioned": null,
        "interview_date": null,
        "interview_time": null,
        "interview_location": null,
        "interview_format": null
    }
}
```

**Data Flow (Module 4 -> Module 5, context provision):**

Module 4 provides Module 5 with context to improve email matching:

```sql
-- View for Module 5: active applications with matching context
CREATE OR REPLACE VIEW v_active_applications_for_email_matching AS
SELECT
    a.id AS application_id,
    a.company_name,
    a.company_domain,
    a.job_title,
    a.reference_number,
    a.current_state,
    a.pipeline_track,
    a.applied_at,
    j.url AS job_url,
    j.company AS original_company_name,
    -- Normalized company name for fuzzy matching
    LOWER(REGEXP_REPLACE(a.company_name, '\s+(Ltd|Limited|PLC|Inc|LLP)\.?$', '', 'gi')) AS company_name_normalized,
    -- Normalized job title for fuzzy matching
    LOWER(a.job_title) AS job_title_normalized
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE a.is_active = true
ORDER BY a.applied_at DESC;
```

### 14.5 Integration Error Handling

| Integration Point | Failure Mode | Module 4 Behaviour |
|-------------------|-------------|---------------------|
| Module 1 -> 4 | Trigger fails to create application record | Log error, application can be created manually or on next trigger |
| Module 2 -> 4 | Document IDs not received | Application proceeds without document links; flagged for manual update |
| Module 3 -> 4 | WF4-INIT webhook fails | Module 3 retries 3x, then logs error; application may not be tracked |
| Module 5 -> 4 | Email classification wrong | Candidate corrects via manual override; feedback loop to Module 5 |
| Module 5 -> 4 | Email not matched to application | Flagged for manual review; candidate assigns manually |
| Module 4 -> 5 | Context view outdated | Module 5 queries directly; minimal impact |

### 14.6 Integration Sequence Diagram

```
Time -->

Module 1        Module 2        Module 3        Module 4        Module 5        Candidate
   |                |               |               |               |               |
   |--discover-->   |               |               |               |               |
   |--score A-->    |               |               |               |               |
   |                |               |    <--auto-create application--|               |
   |                |               |       (state: shortlisted)    |               |
   |                |               |               |               |               |
   |                |--tailor CV--->|               |               |               |
   |                |               |    <--cv_tailored event-------|               |
   |                |               |       (state: cv_tailored)    |               |
   |                |               |               |               |               |
   |                |               |--submit app-->|               |               |
   |                |               |               |--applied event>|              |
   |                |               |               |       (state: applied)         |
   |                |               |               |               |               |
   |                |               |               |               |--parse email-->|
   |                |               |               |    <--ack event from M5--------|
   |                |               |               |       (state: acknowledged)    |
   |                |               |               |--notify-------->              |
   |                |               |               |               |               |
   |                |               |               |  (7 days pass, no update)     |
   |                |               |               |--follow up reminder---------->|
   |                |               |               |               |               |
   |                |               |               |               |--parse email-->|
   |                |               |               |    <--interview event from M5-|
   |                |               |               |       (state: interviewing)    |
   |                |               |               |--notify-------->              |
```

---

## 15. Error Handling & Monitoring

### 15.1 Error Categories

| Category | Severity | Examples | Response |
|----------|----------|---------|----------|
| Database Error | Critical | Connection failure, deadlock, constraint violation | Retry 3x, alert admin, pause workflow |
| Integration Error | High | Module webhook failure, email parse failure | Retry 3x, log error, queue for manual review |
| State Machine Error | Medium | Invalid transition attempt | Log warning, do not apply transition, alert candidate |
| Notification Error | Medium | Resend API failure, email bounce | Retry 3x, log error, try alternative channel |
| Data Quality Error | Low | Missing company domain, empty reference number | Log warning, proceed with partial data |
| Metric Calculation Error | Low | Division by zero, null values | Use safe defaults (0 or NULL), log warning |

### 15.2 Error Handling Strategy

All Module 4 workflows connect to the global error handler (WF0) established in Module 1.

```
[Any Workflow Node Error]
    |
    v
[Error Trigger (built into workflow)]
    |
    v
[Postgres: Log Error]
    INSERT INTO workflow_errors (
        workflow_name, node_name, error_message,
        execution_id, stack_trace
    ) VALUES (...)
    |
[IF: Critical Error?]
    |
    +--- Yes:
    |   [HTTP Request: Resend API -- Admin Alert]
    |       Subject: "[CRITICAL] Selvi Job App -- Module 4 Error"
    |       Body: workflow, node, error, timestamp, execution link
    |
    +--- No:
        [Log and Continue]
```

### 15.3 Database Connection Handling

```javascript
// Database connection retry pattern for all Module 4 workflows
async function executeWithRetry(query, params, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await pg.query(query, params);
        } catch (error) {
            if (attempt === maxRetries) throw error;

            // Retry on transient errors
            if (error.code === 'ECONNREFUSED' ||
                error.code === '57P01' ||  // admin_shutdown
                error.code === '40P01' ||  // deadlock_detected
                error.code === '08006') {  // connection_failure
                await sleep(1000 * attempt);  // Linear backoff
                continue;
            }

            // Non-retryable error
            throw error;
        }
    }
}
```

### 15.4 State Machine Integrity Monitoring

A daily integrity check validates that no applications are in an invalid state:

```sql
-- Daily state machine integrity check (part of WF4-METRICS)

-- Check 1: Applications with NULL current_state
SELECT id, company_name, job_title
FROM applications
WHERE current_state IS NULL;

-- Check 2: Active applications with resolved_at set
SELECT id, company_name, current_state, resolved_at
FROM applications
WHERE is_active = true AND resolved_at IS NOT NULL;

-- Check 3: Terminal applications without resolved_at
SELECT id, company_name, current_state
FROM applications
WHERE current_state IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')
  AND resolved_at IS NULL;

-- Check 4: Applications with applied_at but state is pre-application
SELECT id, company_name, current_state, applied_at
FROM applications
WHERE current_state IN ('discovered', 'shortlisted', 'cv_tailored')
  AND applied_at IS NOT NULL;

-- Check 5: Orphaned applications (job_id references deleted job)
SELECT a.id, a.company_name, a.job_title
FROM applications a
LEFT JOIN jobs j ON a.job_id = j.id
WHERE j.id IS NULL;

-- Check 6: Duplicate applications for same job
SELECT job_id, COUNT(*) as count
FROM applications
GROUP BY job_id
HAVING COUNT(*) > 1;
```

### 15.5 Monitoring Dashboard Queries

```sql
-- Module 4 operational health metrics

-- Active workflow executions
SELECT workflow_name, COUNT(*) as errors_24h
FROM workflow_errors
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
  AND workflow_name LIKE 'WF4%'
GROUP BY workflow_name;

-- Notification delivery success rate
SELECT
    notification_type,
    COUNT(*) FILTER (WHERE status = 'sent') as sent,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / NULLIF(COUNT(*), 0), 1) as success_rate
FROM notification_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY notification_type;

-- Email matching accuracy (based on confirmed vs tentative)
SELECT
    COUNT(*) FILTER (WHERE match_confidence >= 80) as auto_matched,
    COUNT(*) FILTER (WHERE match_confidence BETWEEN 50 AND 79) as tentative,
    COUNT(*) FILTER (WHERE match_confidence < 50) as unmatched,
    COUNT(*) as total
FROM application_events
WHERE event_source = 'module_5'
  AND occurred_at >= NOW() - INTERVAL '7 days';

-- Pipeline data freshness
SELECT
    MAX(state_changed_at) as last_state_change,
    MAX(updated_at) as last_update,
    COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '24 hours' AND is_active = true) as stale_active
FROM applications;
```

### 15.6 Alerting Thresholds

| Metric | Warning | Critical | Alert Method |
|--------|---------|----------|-------------|
| WF4-STATUS failures/hour | > 3 | > 10 | Email + Telegram |
| Notification send failures/day | > 5 | > 20 | Email |
| Unmatched emails/day | > 5 | > 15 | Email (daily batch) |
| State integrity violations | Any | -- | Email (daily check) |
| Database connection failures | > 3/hour | > 10/hour | Email + Telegram |
| WF4-GHOST not run in 12 hours | Warning | 24 hours | Email |
| WF4-METRICS not run in 36 hours | Warning | 48 hours | Email |
| WF4-REPORT missed on Sunday | -- | Monday 8AM | Email |

### 15.7 Recovery Procedures

**Scenario: WF4-STATUS stops processing emails**

```
1. Check n8n execution logs for WF4-STATUS
2. Check workflow_errors for recent Module 4 errors
3. Check database connectivity
4. If database is fine: manually trigger WF4-STATUS execution
5. If database is down: wait for database recovery, then trigger
6. Check for backlog: SELECT COUNT(*) FROM email_updates WHERE processed = false
7. If backlog > 50: run WF4-STATUS manually with higher LIMIT
```

**Scenario: Application stuck in wrong state**

```
1. Identify application: SELECT * FROM applications WHERE id = 'xxx'
2. Review event history: SELECT * FROM application_events WHERE application_id = 'xxx' ORDER BY occurred_at
3. Determine correct state based on events
4. Manual correction:
   UPDATE applications SET current_state = 'correct_state', state_changed_at = NOW() WHERE id = 'xxx'
5. Log correction event:
   INSERT INTO application_events (application_id, event_type, event_source, notes)
   VALUES ('xxx', 'manual_correction', 'system', 'Corrected state from X to Y per admin review')
```

**Scenario: Duplicate application records**

```
1. Identify duplicates: SELECT job_id, COUNT(*) FROM applications GROUP BY job_id HAVING COUNT(*) > 1
2. For each duplicate pair:
   a. Determine which record has more events/history
   b. Merge events from the lesser record to the primary record
   c. Delete the lesser record
   d. Log the merge in application_events
```

---

## 16. Privacy & Compliance

### 16.1 Data Protection

Module 4 processes personal data including:
- Candidate's application history and employment interests
- Employer names, contacts, and correspondence
- Interview details and feedback
- Salary information (offered and negotiated)
- Referee names and contact details
- DBS check status (sensitive personal data)

All data is stored in the self-hosted Postgres database on the candidate's own infrastructure (Hetzner CAX31). No data is shared with third parties except:
- **Resend API:** Email addresses and email content for notification delivery. Resend's privacy policy applies.
- **Claude API (Anthropic):** Job descriptions and application metrics are sent for LLM analysis (strategic observations). Anthropic's API data privacy policy applies (API inputs are not used for training).

### 16.1b Data Processor Agreements

Before Phase 1 deployment, execute DPAs with the following processors:

| Processor | Data Shared | DPA Required |
|-----------|-------------|-------------|
| Resend | Notification email addresses, email subjects, email bodies | Review Resend DPA at https://resend.com/legal/dpa and execute before launch |
| Anthropic (Claude API) | Application metrics, pipeline data, job titles/companies for strategic observations | Review Anthropic DPA and execute before launch |
| Hetzner | All Module 4 data at rest | Verify existing Hetzner DPA covers Module 4 scope |

**Pre-launch compliance checklist:**
1. Execute Resend DPA
2. Execute Anthropic DPA
3. Verify Hetzner DPA scope
4. Store signed DPAs in `/docs/compliance/dpas/`

### 16.2 UK GDPR Compliance

The candidate is both the data controller and the data subject for her own personal data. Third-party personal data (referee names, interviewer names) is processed on the basis of legitimate interest in managing a job search.

| GDPR Principle | Module 4 Compliance |
|---------------|---------------------|
| Lawfulness | Personal use exemption; third-party data processed under legitimate interest |
| Purpose Limitation | Data used solely for job application tracking |
| Data Minimisation | Only data necessary for tracking is stored |
| Accuracy | Auto-updates from email parsing; manual corrections available |
| Storage Limitation | Terminal applications retained for 1 year for analytics, then anonymised |
| Security | Self-hosted database with TLS, access limited to n8n workflows |

### 16.3 Data Retention Policy

| Data Type | Retention Period | After Expiry |
|-----------|-----------------|-------------|
| Active applications | Indefinite while active | Moves to terminal retention |
| Terminal applications (accepted) | Permanent | -- |
| Terminal applications (other) | 12 months after resolution | Anonymise (remove names, emails) |
| Application events | Same as parent application | Anonymise with parent |
| Interview details | 12 months after interview | Delete |
| Pre-employment records | 6 months after completion or cancellation | Delete |
| Follow-up logs | 6 months | Delete |
| Pipeline metrics | 3 years | Retain (already aggregated, no PII) |
| Email content (in events) | 3 months | Delete email bodies, keep metadata |

### 16.4 Data Anonymisation

v2 uses true anonymisation (not pseudonymisation). The v1 approach of replacing company_name with `Company_` + UUID prefix was reversible because the UUID remained in the id column. v2 generates random replacement values and extends anonymisation to all child tables.

```sql
-- Annual anonymisation job -- scheduled as a cron workflow
-- Trigger: WF4-ANON, cron: 0 3 1 * * (1st of each month at 3AM)
-- Checks for applications resolved > 12 months ago and anonymises them
-- True anonymisation: random replacement values that cannot be mapped back

DO $$
DECLARE
    app_record RECORD;
    random_label TEXT;
BEGIN
    FOR app_record IN
        SELECT id FROM applications
        WHERE resolved_at < NOW() - INTERVAL '12 months'
          AND outcome != 'accepted'
          AND company_name NOT LIKE 'Anon_%'  -- not already anonymised
    LOOP
        random_label := 'Anon_' || encode(gen_random_bytes(6), 'hex');

        -- Anonymise parent application record
        UPDATE applications
        SET company_name = random_label,
            job_title = 'Role_' || encode(gen_random_bytes(4), 'hex'),
            company_url = NULL,
            company_domain = NULL,
            reference_number = NULL,
            application_url = NULL,
            portal_confirmation_id = NULL,
            referral_name = NULL,
            referral_relationship = NULL,
            recruiter_name = NULL,
            recruiter_email = NULL,
            recruitment_agency = NULL,
            candidate_notes = NULL,
            rejection_detail = NULL,
            salary_notes = NULL,
            salary_offered_min = NULL,
            salary_offered_max = NULL,
            salary_negotiated = NULL,
            compensation = '{}'::jsonb,
            interview_notes = NULL
        WHERE id = app_record.id;

        -- Anonymise child table: application_events
        UPDATE application_events
        SET email_from = NULL,
            email_subject = NULL,
            event_data = '{}'::jsonb,
            notes = NULL
        WHERE application_id = app_record.id;

        -- Delete child table: application_documents (contains filenames)
        DELETE FROM application_documents WHERE application_id = app_record.id;

        -- Delete child table: application_interviews (contains interviewer names, locations)
        DELETE FROM application_interviews WHERE application_id = app_record.id;

        -- Delete child table: application_notes (free text)
        DELETE FROM application_notes WHERE application_id = app_record.id;

        -- Delete child table: follow_up_log (contains template text)
        DELETE FROM follow_up_log WHERE application_id = app_record.id;
    END LOOP;
END $$;

-- Delete email content from events older than 7 days (reduced from 3 months in v1)
UPDATE application_events
SET email_from = NULL,
    email_subject = NULL,
    event_data = event_data - 'email_body' - 'email_body_text' - 'email_body_html'
WHERE occurred_at < NOW() - INTERVAL '7 days'
  AND email_id IS NOT NULL;

-- Delete pre-employment records older than 6 months
-- DBS data deleted within 30 days of completion (special category data)
DELETE FROM application_pre_employment
WHERE (all_checks_complete = true OR
       (SELECT resolved_at FROM applications WHERE id = application_id) IS NOT NULL)
  AND updated_at < NOW() - INTERVAL '6 months';

DELETE FROM application_pre_employment
WHERE dbs_status = 'cleared'
  AND dbs_completed_at < NOW() - INTERVAL '30 days';
```

### 16.4.1 Right to Erasure (GDPR Article 17)

The candidate can exercise her right to erasure at any time by calling:

```sql
CREATE OR REPLACE FUNCTION delete_all_candidate_data()
RETURNS void AS $$
BEGIN
    -- Delete all child tables (CASCADE handles most, but be explicit)
    DELETE FROM notification_queue;
    DELETE FROM notification_log;
    DELETE FROM follow_up_log;
    DELETE FROM application_notes;
    DELETE FROM application_pre_employment;
    DELETE FROM application_interviews;
    DELETE FROM application_documents;
    DELETE FROM application_events;
    DELETE FROM pipeline_metrics;
    DELETE FROM sender_company_mappings;
    DELETE FROM applications;

    -- Note: data in Resend's logs and Anthropic's API logs cannot be deleted
    -- from this system. Resend retains delivery logs per their retention policy.
    -- Anthropic API does not retain inputs beyond processing (per API terms).
    RAISE NOTICE 'All Module 4 candidate data deleted.';
END;
$$ LANGUAGE plpgsql;
```

### 16.5 Access Control

| Component | Access Level | Notes |
|-----------|-------------|-------|
| Postgres database | n8n service account only | No direct external access |
| n8n workflows | Admin access (Selvi + admin) | Password-protected n8n instance |
| Webhook endpoints | Token + HMAC + rate-limited | See Section 16.5.1 |
| Email notifications | Candidate email only | Single recipient |
| n8n admin UI | Password-protected, accessible only via SSH tunnel or VPN. Do NOT expose n8n admin UI directly to the internet. If remote access is needed, use `ssh -L 5678:localhost:5678 server` to create a local tunnel. | SSH tunnel only |
| Resend API | API key in n8n credentials | Not stored in code |
| Claude API | API key in n8n credentials | Not stored in code |

#### 16.5.1 Webhook Security (v2)

v1 relied solely on a bearer token for webhook authentication. v2 adds defence in depth:

| Control | Implementation | Purpose |
|---------|---------------|---------|
| Bearer token | `Authorization: Bearer $WEBHOOK_TOKEN` header | Authentication |
| HMAC signature | `X-Webhook-Signature: sha256=HMAC(raw_body_bytes, shared_secret)` -- CRITICAL: compute HMAC on the raw request body bytes, NOT on re-serialised/parsed JSON. n8n's webhook node provides the raw body via `$request.rawBody`. Re-serialising parsed JSON changes whitespace and key ordering, which invalidates the signature. | Payload integrity verification |
| Rate limiting | Max 10 requests/minute per endpoint (implemented via n8n Code node counter + Redis/Postgres) | Prevent abuse |
| IP allowlisting | Accept only from localhost/Docker network (`172.16.0.0/12`, `127.0.0.1`) since all callers are on the same server | Network restriction |
| Request body validation | Validate against JSON schema before processing (required fields, types, max lengths) | Input sanitization |
| Request logging | Log all webhook requests (timestamp, source IP, endpoint, success/failure) with alerting for >50 requests/minute | Anomaly detection |

**HMAC Verification Code (n8n Code node, first node after webhook trigger):**

```javascript
const crypto = require('crypto');
const signature = $input.first().headers['x-webhook-signature'];
const body = JSON.stringify($input.first().json);
const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WEBHOOK_HMAC_SECRET).update(body).digest('hex');

if (!signature || signature !== expected) {
    // Log the failed attempt
    throw new Error('Invalid webhook signature');
}
```

### 16.5b Data Breach Response Plan

| Step | Action | Timeframe |
|------|--------|-----------|
| 1 | **Detect:** Monitor for unauthorized database access, webhook anomalies (>50 req/min alert), or unexpected data exports | Continuous |
| 2 | **Contain:** Revoke API keys (Resend, Claude), disable webhook endpoints, change database password | Within 1 hour |
| 3 | **Assess:** Determine which data was accessed. Module 4 contains: application history, employer names, interview details, salary data, DBS status (sensitive), referee details | Within 4 hours |
| 4 | **Notify:** If third-party data (referee names/contacts, interviewer details) was exposed, notify affected individuals | Within 48 hours |
| 5 | **Report to ICO:** If the breach meets the reporting threshold (risk to rights and freedoms of data subjects), file report via https://ico.org.uk within 72 hours | Within 72 hours |
| 6 | **Remediate:** Rotate all credentials, patch vulnerability, review access controls, update risk register | Within 24 hours of containment |
| 7 | **Review:** Post-incident analysis, update security controls, document lessons learned | Within 7 days |

**Breach severity levels:**
- **Level 1 (Low):** Read-only access to anonymised/aggregated metrics data. No notification required.
- **Level 2 (Medium):** Access to application records including company names, job titles. Notify candidate.
- **Level 3 (High):** Access to DBS status, salary data, referee details, or interview feedback. Notify candidate + affected third parties + ICO.

### 16.6 Backup & Recovery

Module 4 data is included in the existing backup strategy from Module 1:

| Backup Type | Schedule | Retention | Method |
|-------------|----------|-----------|--------|
| Full database dump | Daily at 2AM | 30 days | pg_dump via cron |
| WAL archiving | Continuous | 7 days | PostgreSQL WAL archiving |
| Workflow export | Weekly (Sunday 2AM) | 90 days | n8n API export to JSON |

---

## 17. Rollout Plan

### 17.1 Phase Overview

Module 4 is rolled out in 4 phases over 3 weeks. Each phase is independently valuable and can operate while later phases are in development.

| Phase | Duration | Content | Dependencies |
|-------|----------|---------|-------------|
| Phase 1: Schema & Manual Tracking | Days 1-3 | Database schema, WF4-INIT, basic state tracking | Module 1 (complete) |
| Phase 2: Auto-Status Detection | Days 4-8 | WF4-STATUS, Module 5 integration, email matching | Module 5 (email parser) |
| Phase 3: Ghosting & Follow-Up | Days 9-12 | WF4-GHOST, WF4-NOTIFY, reminder engine | Phase 1 + Phase 2 |
| Phase 4: Metrics & Reporting | Days 13-18 | WF4-METRICS, WF4-REPORT, weekly summary | Phase 1 + Phase 2 + Phase 3 |

### 17.2 Phase 1: Schema & Manual Tracking (Days 1-3)

**Day 1: Database Setup**
- Deploy schema migration (Section 12.10)
- Create all tables: `applications`, `application_events`, `application_documents`, `application_interviews`, `application_pre_employment`, `pipeline_metrics`, `follow_up_log`, `application_notes`, `notification_queue`
- Deploy triggers: `auto_create_application`, `sync_application_state_to_jobs`
- Deploy state machine function: `transition_application_state()`
- Run schema integrity tests

**Day 2: WF4-INIT Workflow**
- Build WF4-INIT workflow in n8n
- Configure webhook endpoint for manual applications
- Configure sub-workflow connection for Module 3
- Test: Create application record from webhook
- Test: Create application from Module 3 sub-workflow call
- Test: Duplicate company detection

**Day 3: Integration Testing**
- Test Module 1 -> Module 4 auto-creation trigger
- Test Module 2 -> Module 4 document linking
- Test Module 3 -> Module 4 application recording
- Test manual status update via structured email
- Verify state machine enforces valid transitions
- Seed test data: 5-10 test applications in various states

**Acceptance Criteria for Phase 1:**
- [ ] All tables created and accessible from n8n
- [ ] State machine function works correctly for all valid transitions
- [ ] State machine rejects all invalid transitions
- [ ] WF4-INIT creates application records from webhook
- [ ] Auto-creation trigger fires when Module 1 scores a job A/B
- [ ] Document linking works from Module 2
- [ ] Duplicate company warning fires correctly

### 17.3 Phase 2: Auto-Status Detection (Days 4-8)

**Day 4-5: WF4-STATUS Workflow**
- Build WF4-STATUS workflow in n8n
- Implement email-to-application matching algorithm
- Implement status mapping logic
- Configure webhook endpoint for Module 5

**Day 6-7: Module 5 Integration**
- Connect Module 5 email parser to WF4-STATUS webhook
- Test email classification -> state transition mapping
- Test confidence thresholds (auto-apply vs. tentative vs. manual review)
- Test ambiguous email handling

**Day 8: Integration Testing**
- Send test emails simulating: acknowledgement, rejection, interview invitation, offer
- Verify correct state transitions
- Verify event logging
- Verify notification triggering
- Test edge cases: multiple applications at same company, agency emails, generic update emails

**Acceptance Criteria for Phase 2:**
- [ ] WF4-STATUS runs every 30 minutes without errors
- [ ] High-confidence emails (>80%) auto-update application state
- [ ] Medium-confidence emails (50-79%) create tentative updates with confirmation request
- [ ] Low-confidence emails (<50%) are flagged for manual review
- [ ] All state transitions are logged in application_events
- [ ] Candidate receives notification on state change

### 17.4 Phase 3: Ghosting & Follow-Up (Days 9-12)

**Day 9-10: WF4-GHOST Workflow**
- Build WF4-GHOST workflow in n8n
- Implement ghosting detection algorithm
- Implement corporate vs. academic threshold logic
- Implement deadline checking

**Day 10-11: WF4-NOTIFY Workflow**
- Build WF4-NOTIFY workflow in n8n
- Build notification_queue table and processing
- Implement throttling rules
- Build email templates (status change, follow-up, deadline, weekly summary)
- Configure Resend API integration

**Day 12: Testing**
- Seed applications at various ages to trigger follow-up thresholds
- Verify correct corporate vs. academic timeline differentiation
- Verify ghosting detection and auto-transition
- Verify follow-up templates are appropriate per track
- Verify notification throttling (not flooding inbox)
- Test snooze functionality
- Test deadline alerts

**Acceptance Criteria for Phase 3:**
- [ ] WF4-GHOST runs every 6 hours without errors
- [ ] Corporate follow-up reminders fire at 7 days, ghosting at 14 days
- [ ] Academic follow-up reminders fire at 21 days, ghosting at 56 days
- [ ] Follow-up templates are track-appropriate
- [ ] Notification throttling limits to 5/hour, 20/day
- [ ] Quiet hours respected (no notifications 10PM-7AM)
- [ ] Deadline alerts fire 48 hours before deadline
- [ ] Candidate can snooze reminders

### 17.5 Phase 4: Metrics & Reporting (Days 13-18)

**Day 13-14: WF4-METRICS Workflow**
- Build WF4-METRICS workflow in n8n
- Implement all metric calculation queries (Section 8.6)
- Test metric calculation with seeded data
- Verify metrics are stored correctly in pipeline_metrics table

**Day 15-16: WF4-REPORT Workflow**
- Build WF4-REPORT workflow in n8n
- Build weekly summary HTML template
- Integrate Claude Haiku for strategic observations
- Configure Resend API for weekly report delivery

**Day 17: Integration Testing**
- Generate weekly report with real + seeded data
- Verify all report sections render correctly
- Verify metrics match manual calculation
- Verify strategic observations are relevant and non-generic
- Test report generation with zero applications (edge case)
- Test report generation with 50+ applications (load test)

**Day 18: Polish & Documentation**
- Fix any issues found in testing
- Document operational runbooks
- Seed system_config values for Module 4
- Enable all workflows in production
- Send first real weekly report

**Acceptance Criteria for Phase 4:**
- [ ] WF4-METRICS runs daily at 6AM without errors
- [ ] All metrics from Section 8.2 are calculated correctly
- [ ] WF4-REPORT runs Sunday 7PM without errors
- [ ] Weekly summary email contains all 7 sections (Section 10)
- [ ] Strategic observations are generated by Claude Haiku
- [ ] Report is visually clean and readable on mobile
- [ ] Monthly trend report generates correctly
- [ ] Source effectiveness metrics are accurate

### 17.6 Post-Launch Monitoring

For the first 2 weeks after full deployment:

| Check | Frequency | Action if Failed |
|-------|-----------|-----------------|
| WF4-STATUS execution success | Daily | Check n8n logs, fix errors |
| WF4-GHOST execution success | Daily | Check n8n logs, fix errors |
| Notification delivery rate | Daily | Check Resend dashboard |
| Email matching accuracy | Weekly | Review unmatched emails, tune algorithm |
| False positive rate (wrong transitions) | Weekly | Review candidate corrections, add patterns |
| Follow-up timing accuracy | Weekly | Get candidate feedback on reminder appropriateness |
| Weekly report accuracy | Weekly | Compare report data to manual audit |
| State machine integrity | Daily | Run integrity checks (Section 15.4) |

### 17.7 Rollback Plan

If Module 4 causes issues:

| Severity | Action | Impact |
|----------|--------|--------|
| Minor (cosmetic, metric errors) | Fix forward | No rollback needed |
| Medium (wrong state transitions) | Disable WF4-STATUS, process manually | Manual tracking for status updates |
| Major (database corruption, cascade failures) | Disable all WF4 workflows, restore from backup | Full manual tracking until fix deployed |

**Workflow Disable Procedure:**
```
1. In n8n: deactivate WF4-STATUS, WF4-GHOST, WF4-NOTIFY, WF4-REPORT, WF4-METRICS
2. WF4-INIT can remain active (it only creates records, does not modify)
3. Notify candidate: "Application tracker is temporarily paused for maintenance"
4. Fix issue, test, re-enable workflows one by one
```

### 17.8 Future Enhancements (Post-v1.0)

These are explicitly out of scope for v1.0 but noted for future development:

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Calendar Integration | Sync interviews to Google Calendar | High |
| LinkedIn Status Monitoring | Track when roles are "no longer accepting applications" | Medium |
| Employer Research Integration | Auto-fetch Glassdoor/Companies House data for interview prep | Medium |
| AI Interview Coach | Generate company-specific interview prep based on job description and employer profile | Medium |
| Salary Intelligence | Track offered vs. market rate with live benchmark data | Low |
| Mobile Notifications | Push notifications via Telegram or WhatsApp | Low |
| Dashboard UI | Web dashboard for pipeline visualization (currently email-only) | Low |
| Predictive Analytics | ML model to predict application outcome based on historical data | Low |
| Networking / Warm Leads Pipeline | Track speculative applications, coffee chats, informational interviews, and warm introductions as a separate pipeline with its own states (contacted, meeting_scheduled, meeting_held, opportunity_identified, applied). This captures the full job search funnel including non-advertised roles. | High |
| Referral Network Integration | Track referral chains and their effectiveness | Low |
| Application Template Reuse | Suggest reusable components from successful past applications | Low |

---

## Appendix A: Configuration Seed Data

### A.1 System Config Values for Module 4

```sql
INSERT INTO system_config (key, value, description) VALUES
    ('m4_follow_up_enabled', 'true', 'Enable/disable follow-up reminder engine'),
    ('m4_ghosting_detection_enabled', 'true', 'Enable/disable automatic ghosting detection'),
    ('m4_notifications_enabled', 'true', 'Enable/disable all Module 4 notifications'),
    ('m4_weekly_report_enabled', 'true', 'Enable/disable weekly summary report'),
    ('m4_ai_observations_enabled', 'true', 'Enable/disable AI-generated strategic observations in weekly report'),
    ('m4_auto_shortlist_threshold', '"B"', 'Minimum tier for auto-creating application records (A or B)'),
    ('m4_corporate_follow_up_days', '7', 'Days before first follow-up reminder (corporate)'),
    ('m4_academic_follow_up_days', '21', 'Days before first follow-up reminder (academic)'),
    ('m4_corporate_ghost_days', '14', 'Days before ghosting detection (corporate)'),
    ('m4_academic_ghost_days', '56', 'Days before ghosting detection (academic)'),
    ('m4_notification_quiet_start', '"22:00"', 'Start of quiet hours (no notifications)'),
    ('m4_notification_quiet_end', '"07:00"', 'End of quiet hours'),
    ('m4_max_notifications_per_hour', '5', 'Maximum non-critical notifications per hour'),
    ('m4_max_notifications_per_day', '20', 'Maximum non-critical notifications per day'),
    ('m4_candidate_email', '"selvi@email.com"', 'Candidate email for notifications'),
    ('m4_admin_email', '"admin@apiloom.io"', 'Admin email for error alerts'),
    ('m4_resend_from', '"Selvi Job Tracker <tracker@notifications.apiloom.io>"', 'From address for notification emails');
```

### A.2 Pipeline Track Configuration

```sql
-- Configurable thresholds per pipeline track
CREATE TABLE pipeline_track_config (
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

INSERT INTO pipeline_track_config VALUES
    ('corporate', 7, 10, 7, 7, 14, 21, 14, 14, 2, 21, 56),
    ('academic', 21, 28, 14, 21, 56, 56, 28, 42, 1, 90, 180);
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Application | A record tracking a single job application from discovery through outcome |
| Pipeline Track | Corporate or Academic -- determines timeline expectations and stage definitions |
| State Machine | The deterministic model that governs valid application state transitions |
| Ghosting | When an employer does not respond to an application within the expected timeframe |
| Follow-Up | A reminder to the candidate to contact the employer about a pending application |
| Stage Velocity | The median time an application spends in a particular stage |
| Response Rate | The percentage of applications that receive any response from the employer |
| Terminal State | A state from which no further transitions are expected (accepted, declined, rejected, etc.) |
| DBS Check | Disclosure and Barring Service check -- UK background check required for some roles |
| HESA | Higher Education Statistics Agency -- data collection required for UK academic staff |
| REF | Research Excellence Framework -- UK university research quality assessment |
| Tier | Job relevance classification from Module 1 (A+/A/B/C/D) |
| Resend | Email API service used for sending notifications |
| Ghost Threshold | The number of days after which an unresponsive application is classified as ghosted |

---

## Appendix C: Email Classification Patterns

Reference patterns for Module 5 to classify employer emails. These are used by Module 4 to validate email-to-transition mappings.

### C.1 Acknowledgement Patterns

```
Positive indicators:
- "Thank you for your application"
- "We have received your application"
- "Your application has been submitted"
- "We confirm receipt of your application"
- "Thank you for your interest in the role"
- "Your application for [role] has been received"
- "We will review your application"
- "Application reference: [number]"

Negative indicators (not acknowledgement):
- "Unfortunately" (rejection)
- "We regret" (rejection)
- "invitation" (interview)
- "offer" (offer)
```

### C.2 Rejection Patterns

```
Strong rejection indicators:
- "Unfortunately, your application has been unsuccessful"
- "We regret to inform you"
- "After careful consideration, we have decided not to progress"
- "We will not be taking your application further"
- "The position has been filled"
- "We have decided to pursue other candidates"
- "Your application was not successful on this occasion"

UK-specific:
- "We are unable to progress your application"
- "On this occasion, we have decided not to shortlist"
- "We wish you every success in your job search" (usually follows rejection)
```

### C.3 Interview Invitation Patterns

```
Strong interview indicators:
- "We would like to invite you to an interview"
- "We would like to invite you for a [phone/video] interview"
- "Please find below the details of your interview"
- "We would like to discuss the role with you"
- "We have shortlisted you for interview"
- "Could you attend for interview on [date]"

Academic-specific:
- "We would like to invite you to present"
- "Teaching presentation and interview"
- "Selection day"
- "Panel interview"

Date/time extraction patterns:
- "[day] [month] at [time]"
- "[date] at [time]"
- "Interview date: [date]"
- "Time: [time]"
```

### C.4 Offer Patterns

```
Strong offer indicators:
- "We are pleased to offer you"
- "I am delighted to confirm your appointment"
- "Formal offer of employment"
- "Offer letter attached"
- "We would like to extend an offer"
- "Subject to [references/DBS], we would like to offer"

Conditional offer indicators:
- "Subject to satisfactory references"
- "Subject to a satisfactory DBS check"
- "Conditional offer"
- "Offer pending [checks]"
```

---

## Appendix D: n8n Workflow Node Reference

### D.1 Workflow IDs and Names

| Workflow ID | Name | Description |
|-------------|------|-------------|
| WF4-INIT | Application Initializer | Creates application tracking records |
| WF4-STATUS | Status Update Processor | Processes email-based status updates |
| WF4-GHOST | Ghosting & Follow-Up Engine | Detects ghosting, generates reminders |
| WF4-METRICS | Pipeline Metrics Calculator | Daily metric calculation |
| WF4-REPORT | Weekly Summary Reporter | Generates and sends weekly report |
| WF4-NOTIFY | Notification Dispatcher | Sends all notifications with throttling |

### D.2 Webhook Endpoints

| Endpoint | Method | Auth | Caller |
|----------|--------|------|--------|
| `/webhook/application-created` | POST | Bearer token | Module 3 / Manual |
| `/webhook/status-update` | POST | Bearer token | Module 5 |
| `/webhook/manual-update` | POST | Bearer token | Candidate (via email parser) |

### D.3 Environment Variables

```
# Module 4 specific
M4_RESEND_API_KEY=re_xxxxxxxxxxxx
M4_RESEND_FROM=Selvi Job Tracker <tracker@notifications.apiloom.io>
M4_CANDIDATE_EMAIL=selvi@email.com
M4_ADMIN_EMAIL=admin@apiloom.io
M4_WEBHOOK_TOKEN=long_random_bearer_token_here
M4_CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxx  (shared with Module 1)

# Shared
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=selvi_jobs
POSTGRES_USER=n8n
POSTGRES_PASSWORD=(from credentials)
```

---

## Appendix E: Testing Strategy

### E.1 Unit Tests (State Machine)

```sql
-- Test valid transitions
SELECT transition_application_state(
    test_app_id, 'acknowledged', 'application_acknowledged', 'test', '{}', 'Test'
) AS should_be_true;

-- Test invalid transitions
SELECT transition_application_state(
    test_app_id, 'offer_received', 'offer_extended', 'test', '{}', 'Test'
) AS should_be_false;  -- cannot go from applied to offer_received without intermediate stages

-- Test terminal state enforcement
SELECT transition_application_state(
    accepted_app_id, 'interviewing', 'interview_invited', 'test', '{}', 'Test'
) AS should_be_false;  -- accepted is terminal
```

### E.2 Integration Tests

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Module 3 submits application | Webhook payload with job_id | Application record created, state = 'applied' |
| Module 5 sends acknowledgement | Email event with high confidence | Application advances to 'acknowledged' |
| Module 5 sends rejection | Email event with rejection classification | Application advances to 'rejected' |
| Ghosting detection at 14 days (corporate) | Application in 'applied' state for 14+ days, 2+ follow-ups sent | Auto-transition to 'ghosted' |
| Ghosting detection at 21 days (academic) | Application in 'applied' state for 21 days | Follow-up reminder (NOT ghosted yet) |
| Deadline alert | Job with deadline in 36 hours | Notification sent |
| Duplicate company warning | Second application at same company | Warning notification sent |
| Weekly report generation | Mixed pipeline data | Email sent with all sections |

### E.3 Load Tests

| Scenario | Volume | Expected Performance |
|----------|--------|---------------------|
| WF4-METRICS with 500 applications | 500 rows | < 30 seconds |
| WF4-GHOST with 200 active applications | 200 rows | < 60 seconds |
| WF4-REPORT with 500 applications, 30 days of events | 500 apps, ~5000 events | < 120 seconds |
| WF4-STATUS processing 50 pending emails | 50 emails | < 120 seconds |

### E.4 Test Data Fixtures

```sql
-- Create test application data for development/testing

INSERT INTO applications (
    job_id, company_name, job_title, pipeline_track, current_state,
    applied_at, state_changed_at, discovery_source
) VALUES
    -- Corporate applications in various states
    ((SELECT id FROM jobs LIMIT 1 OFFSET 0), 'Acme Corp', 'L&D Manager', 'corporate', 'applied',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'reed'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 1), 'BigBank PLC', 'Head of Learning', 'corporate', 'acknowledged',
     NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days', 'adzuna'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 2), 'TechCo Ltd', 'Talent Development Lead', 'corporate', 'interviewing',
     NOW() - INTERVAL '21 days', NOW() - INTERVAL '5 days', 'linkedin_email'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 3), 'GovDept', 'L&D Business Partner', 'corporate', 'rejected',
     NOW() - INTERVAL '14 days', NOW() - INTERVAL '2 days', 'civil_service'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 4), 'SmallCo', 'People Development Manager', 'corporate', 'applied',
     NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days', 'indeed_email'),  -- Should trigger ghosting

    -- Academic applications in various states
    ((SELECT id FROM jobs LIMIT 1 OFFSET 5), 'University of Reading', 'Senior Lecturer in HRM', 'academic', 'applied',
     NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', 'jobs_ac_uk'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 6), 'Oxford Brookes University', 'Lecturer in Management', 'academic', 'acknowledged',
     NOW() - INTERVAL '42 days', NOW() - INTERVAL '35 days', 'jobs_ac_uk'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 7), 'Royal Holloway', 'Teaching Fellow', 'academic', 'interviewing',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '14 days', 'jobs_ac_uk'),
    ((SELECT id FROM jobs LIMIT 1 OFFSET 8), 'University of Surrey', 'Lecturer in OB', 'academic', 'offer_received',
     NOW() - INTERVAL '90 days', NOW() - INTERVAL '3 days', 'guardian');
```

---

## Appendix F: Resend API Integration

### F.1 Resend API Configuration

```
Base URL: https://api.resend.com
API Key: Stored in n8n credentials (not in code)
From Address: Selvi Job Tracker <tracker@notifications.apiloom.io>
Domain: notifications.apiloom.io (configured with DNS records: SPF, DKIM, DMARC)
```

### F.2 Send Email Request

```javascript
// n8n HTTP Request node configuration for Resend
const response = await $http.post('https://api.resend.com/emails', {
    headers: {
        'Authorization': `Bearer ${$credentials.resendApiKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        from: 'Selvi Job Tracker <tracker@notifications.apiloom.io>',
        to: ['selvi@email.com'],
        subject: subject,
        html: htmlBody,
        text: textBody,  // Plain text fallback
        tags: [
            { name: 'module', value: 'module_4' },
            { name: 'type', value: notificationType },
            { name: 'application_id', value: applicationId || 'none' }
        ]
    })
});
```

### F.3 Resend Rate Limits

| Plan | Emails/day | Emails/second | Module 4 Impact |
|------|-----------|---------------|-----------------|
| Free | 100 | 1 | Sufficient for low-volume operation |
| Pro | 5,000 | 10 | More than sufficient |

Module 4 estimated email volume:
- Status change alerts: 2-5/day
- Follow-up reminders: 2-3/day (batched at 8AM)
- Weekly summary: 1/week
- Deadline alerts: 0-3/day
- Daily check-in: 1/day (weekdays)
- Monthly trend report: 1/month
- **Total: ~10-15 emails/day (well within free tier)**

---

## Appendix G: Academic Hiring Calendar (UK)

### G.1 Primary Hiring Cycle

```
September-December: Roles are budgeted and approved for the next academic year
January-February:   Job advertisements published on jobs.ac.uk and university websites
February-March:     Application deadlines close
March-April:        Shortlisting by academic panels
April-May:          Interviews and teaching presentations
May-June:           Offers extended, Senate/Board approval
June-July:          Pre-employment checks (DBS, references, qualifications)
August:             Onboarding and induction preparation
September:          Start date (beginning of academic year)
```

### G.2 Secondary Hiring Cycle

```
May-June:           Roles approved for January start
June-July:          Advertisements published
July-August:        Applications close
September-October:  Interviews
October-November:   Offers and pre-employment
January:            Start date (beginning of spring semester)
```

### G.3 Out-of-Cycle Hiring

Out-of-cycle academic hires (e.g., sudden resignation, new funding) can happen at any time. These often move faster than standard cycles because the need is urgent. Module 4 should not assume all academic hiring follows the standard calendar.

### G.4 Implications for Module 4

- Academic applications submitted in January-March should have follow-up reminders calibrated to the April-May interview window
- Academic applications submitted in June-July should target the September-October interview window
- Applications submitted outside these windows may be speculative or out-of-cycle; use standard academic thresholds
- The weekly report should flag when academic hiring season is approaching to suggest increased application volume

---

## Appendix H: Sample Weekly Report

Below is a text representation of what the weekly summary email would contain for a moderately active pipeline.

```
=========================================================
WEEKLY PIPELINE SUMMARY
25 March 2026 -- 29 March 2026
=========================================================

ACTION ITEMS
------------
[CRITICAL] Interview: BigBank PLC -- Head of Learning
  Date: Tuesday 1 April, 10:00 AM (Microsoft Teams)
  Format: Competency-based panel interview (45 min)
  Panel: Sarah Jones (CHRO), Mark Williams (L&D Director)
  Prep: Review BigBank 2025 Annual Report, prepare STAR examples for strategic L&D

[HIGH] Deadline: University of Bath -- Senior Lecturer in Management
  Closes: 31 March 2026 (2 days remaining)
  Status: Shortlisted (CV tailored, not yet submitted)

[MEDIUM] Follow-up due: Acme Corp -- L&D Manager
  Applied 10 days ago, no response. Consider a polite follow-up email.

[MEDIUM] Follow-up due: GovDept -- OD Consultant
  Acknowledged 15 days ago, no further update.

THIS WEEK'S ACTIVITY
---------------------
+ 4 new applications submitted
  - Acme Corp: L&D Manager (Corporate, via Reed)
  - Oxford Brookes: Lecturer in Management (Academic, via jobs.ac.uk)
  - TechCo: Talent Development Lead (Corporate, via LinkedIn)
  - NHS Trust: L&D Manager (Corporate, via NHS Jobs)

~ 3 status changes
  - BigBank PLC: Acknowledged -> Interview Scheduled (27 March)
  - SmallCo: Applied -> Ghosted (detected after 16 days)
  - GovDept: Screening -> Rejected ("Position filled by internal candidate")

- 2 rejections received
  - GovDept: OD Consultant (internal candidate)
  - RetailCo: L&D Partner (overqualified)

PIPELINE SNAPSHOT
-----------------
Active applications: 18 (12 corporate, 6 academic)

  Stage           Corporate  Academic  Total
  -------         ---------  --------  -----
  Applied            5         4        9
  Acknowledged       3         1        4
  Screening          1         0        1
  Interviewing       2         1        3
  Offer              1         0        1
  ---
  Total Active      12         6       18

  Ghosted (this week): 1
  Rejected (this week): 2

METRICS (Last 30 Days)
-----------------------
                    This Week  Last Week  4-Wk Avg   Trend
Applications:          4          3          3.5       up
Response Rate:        38%        42%        40%       flat
Interview Rate:       15%        12%        13%       up
Ghosting Rate:        31%        28%        30%       flat
Median Response:     4.5 days   5 days     5 days    improving

CONVERSION FUNNEL (Last 30 Days)
---------------------------------
Applied:       [============================] 26 (100%)
Acknowledged:  [===================]          14 (54%)
Screening:     [==========]                    7 (27%)
Interviewing:  [=======]                       5 (19%)
Offer:         [==]                            2 (8%)

TOP SOURCES
-----------
1. Reed:       45% response rate (11 applications)
2. LinkedIn:   38% response rate (8 applications)
3. jobs.ac.uk: 33% response rate (6 applications)
4. Indeed:     22% response rate (9 applications)

STRATEGIC OBSERVATIONS
-----------------------
1. Your Reed applications have a response rate nearly double that of
   Indeed (45% vs 22%). Consider shifting more application effort to
   roles found through Reed.

2. You have 9 applications in the "Applied" state with no response.
   Five of these are corporate applications past the 7-day mark.
   A batch follow-up session this weekend could recover some of these.

3. Your academic pipeline has 4 applications at the "Applied" stage,
   all within normal academic response windows (4-28 days). No action
   needed -- academic processes are inherently slower.

=========================================================
Generated by Selvi Job App Module 4 | Pipeline Tracker v1.0
=========================================================
```

---

## 18. 50-Round Critical Roleplay Evaluation (v1)

**Date:** 2026-03-29
**Methodology:** 5 expert personas, 10 rounds each, scoring 1-10 per concern.

---

### 18.1 Persona 1: The Candidate (Selvi)

**Profile:** PhD + MBA, 18 years HR/L&D experience, dual-track UK job seeker (corporate L&D + academic lecturer). The actual end user of this system.

---

**Round 1 -- Will the weekly report actually reduce my anxiety, or just create a new kind of stress?**

The PRD claims the weekly summary reduces "persistent background anxiety" (Section 2.2) by providing clarity. But the report design (Section 10, Appendix H) frontloads action items -- follow-ups due, ghosting detections, rejection counts -- which could amplify anxiety rather than reduce it. Seeing "9 applications in Applied with no response" and "2 rejections this week" every Sunday evening could ruin the start of the working week. The PRD does not address the psychological design of the report: tone, framing, or the option to receive a simplified "good news" version. The strategic observations are specifically instructed to "not be encouraging or motivational" (Section 10.8), which means the report is designed to be bluntly analytical. For someone already stressed about a job search, an unrelenting stream of conversion rates and ghosting percentages is not inherently comforting. The system needs a "well-being mode" or at least configurable verbosity. Sunday 7PM is also questionable timing -- this hangs over the candidate all evening with no ability to act on most items until Monday morning.

**Score: 5/10**

**Recommendations:**
1. Add configurable report tone: "analytical" (current) vs. "supportive" (reframes negatives, leads with wins)
2. Make report timing configurable -- Monday 7AM may be better than Sunday 7PM
3. Include a "wins this week" section prominently at the top (interviews secured, positive responses)
4. Allow the candidate to opt out of specific report sections (e.g., hide rejection details)

---

**Round 2 -- How do I actually interact with this system day-to-day? The UX is unclear.**

The PRD specifies three manual input methods (Section 7.5): structured email, daily check-in reply, and reply-to-notification. All are email-based. There is no dashboard, no web UI, no mobile app. For a system managing 50+ applications, the candidate's only window into the pipeline is a weekly email summary and individual notification emails. There is no way to browse applications, search by company, filter by status, or see the full history of a specific application on demand. The candidate cannot look up "What stage am I at with BigBank?" without waiting for the next notification or weekly report. The "Pipeline Query (on demand)" box in the architecture diagram (Section 5.1) is never specified. This is a major usability gap. The PRD acknowledges a "Dashboard UI" as a future enhancement (Section 17.8) but rates it "Low" priority. For a system managing dozens of active applications, this should be high priority or at minimum a simple query mechanism should exist in v1.

**Score: 3/10**

**Recommendations:**
1. Add an on-demand query mechanism -- even a simple "email the system with QUERY [company name]" and get back current status
2. Elevate Dashboard UI to high priority or build a minimal pipeline view (even a static HTML page generated daily)
3. Specify how the candidate answers "What's happening with my application to X?" right now
4. Consider a Telegram bot for quick status queries as a lightweight alternative to a full UI

---

**Round 3 -- The daily check-in email feels like it will become noise very quickly.**

The daily check-in (Section 7.5, Method 2) is sent every weekday when active applications exist. With 15+ active applications, this means the candidate receives a prompt every single morning asking "Any updates today?" Most days, the answer is "no." The PRD says "If no updates, ignore this email" but receiving an ignorable email every day trains the candidate to ignore it, which means on the day there IS an update, she may also ignore it. This is the classic alert fatigue problem. The check-in format asks the candidate to type structured updates ("Acme Corp: phone screen scheduled for April 2 at 10am") which is cumbersome on mobile. There is no mention of natural language parsing for the check-in response -- the examples suggest a rigid format. The system should either make the check-in less frequent (2-3 times per week) or smarter (only send when there is a reason to believe updates may exist, e.g., after an interview was scheduled).

**Score: 5/10**

**Recommendations:**
1. Reduce daily check-in to 2-3 times per week, or make frequency configurable
2. Only send check-in when there are applications in states where updates are likely (post-interview, post-screening)
3. Support natural language replies, not just structured format
4. Add a "nothing to report" quick-reply button or link

---

**Round 4 -- Snooze functionality is too simplistic for real-world use.**

The snooze options (Section 9.3) are 3 days, 1 week, or 2 weeks. These are arbitrary and do not cover common real scenarios. If I just had a phone screen and was told "we'll get back to you in 3-4 weeks," I need a 4-week snooze. If an academic application is in committee review and I was told "decisions in early May," I need a date-specific snooze ("remind me May 5"). The PRD mentions US-408 (set a specific follow-up date) which partially addresses this, but the snooze mechanism in Section 9.3 is limited to fixed intervals. There is also no way to snooze a specific notification type while keeping others active -- the candidate might want to silence follow-up reminders for one application but still receive status change alerts. The granularity is insufficient for a sophisticated job search.

**Score: 5/10**

**Recommendations:**
1. Add custom date snooze ("remind me on [date]")
2. Add "snooze until status changes" option (silence all reminders until the employer responds)
3. Allow per-notification-type snooze, not just per-application blanket snooze
4. Extend fixed intervals: add 3 weeks, 1 month, 2 months options

---

**Round 5 -- The follow-up email templates are too generic to be useful.**

The follow-up templates (Section 9.5) are boilerplate. "I wanted to follow up on my application... I remain very interested..." is the kind of email every applicant sends and every recruiter ignores. For someone with 18 years of experience and a PhD, the follow-up should be more strategic and personalized. The templates do not reference any specific content from the job description, the candidate's tailored CV, or the company's recent news. Module 2 already has tailoring intelligence -- why not use it to generate context-aware follow-ups? The academic template is better (references committee review process, uses appropriate register) but still generic. The PRD uses Claude Haiku for strategic observations but not for follow-up personalization, which is arguably more valuable. A personalized follow-up that references a specific company initiative or recent news article is far more likely to get a response than a template.

**Score: 4/10**

**Recommendations:**
1. Use Claude to generate personalized follow-ups using job description data and company context from Module 1
2. Reference specific elements from the tailored CV/cover letter in follow-up suggestions
3. Vary the template based on the application stage and the specific company
4. Provide 2-3 follow-up options (formal, casual, brief) and let the candidate choose

---

**Round 6 -- How does the system handle the emotional reality of rejection at scale?**

When running 20-30 applications per week (Section 1), the candidate will receive multiple rejections per week. The system faithfully tracks every rejection, classifies the reason, and includes rejection counts in the weekly report. But there is no consideration of the emotional impact. Getting five rejection notifications in one day -- each with a clinical "REJECTED" status change -- is demoralizing. The notification template (Section 9.7) shows a strikethrough of the old state and bold "REJECTED" new state. There is no softening, no "here's what you can learn from this," no aggregation of rejections into a single daily digest. The PRD treats rejection as just another state transition. For the candidate, it is a personal setback. The system should batch rejection notifications, frame them constructively ("3 applications closed this week, freeing your pipeline for new opportunities"), and avoid sending rejection alerts outside business hours.

**Score: 4/10**

**Recommendations:**
1. Batch rejection notifications into a daily digest rather than sending individually
2. Reframe rejection notifications constructively -- "application closed" rather than "REJECTED"
3. Include rejection reason analysis ("2 of 3 rejections cited internal candidates -- this is not about your qualifications")
4. Never send rejection notifications during quiet hours, even if they are not technically "critical"

---

**Round 7 -- The system cannot handle the scenario where I want to pause my job search.**

There is no concept of pausing the pipeline. If the candidate goes on holiday for 2 weeks, or accepts a contract role temporarily, or simply needs a mental health break, the system will keep running. WF4-GHOST will start marking applications as ghosted. WF4-NOTIFY will keep sending daily check-ins. The weekly report will show declining metrics. There is no "pause search" mode that freezes all timers, suppresses notifications, and resumes cleanly when the candidate returns. The closest option is individually snoozing every application, which is impractical with 20+ active applications. The system_config has individual on/off switches for follow-ups, notifications, and weekly reports, but no single "pause everything" control. This is a foreseeable real-world need.

**Score: 3/10**

**Recommendations:**
1. Add a global "pause pipeline" mode that freezes all timers, suppresses all non-critical notifications, and pauses ghosting detection
2. When resuming, recalculate all thresholds from the resume date, not the original application dates
3. Add a "vacation mode" config option that can be set with a return date
4. Track total paused days and exclude them from pipeline velocity metrics

---

**Round 8 -- The salary tracking is superficial and misses UK-specific compensation complexity.**

Section 12.2 stores salary_offered_min, salary_offered_max, salary_negotiated, and salary_notes. This is inadequate for UK job market realities. Corporate roles at the candidate's level (GBP 70-80k) involve complex total compensation: pension contribution rates (5-15%), car allowance, private healthcare, bonus percentage, share schemes, flexible working arrangements, and notice period requirements. Academic roles use national pay spines (Grade 7/8, spine points 35-43, etc.) with additional allowances (London weighting, responsibility allowances, research allowances). The system stores a flat integer for salary and a text field for notes. There is no structured way to compare offers holistically. When the candidate receives two offers -- one corporate at GBP 78k with 8% pension, one academic at Grade 8 spine 38 with USS pension -- the system cannot help her compare them. This is exactly the scenario where structured data would be most valuable.

**Score: 4/10**

**Recommendations:**
1. Add structured compensation fields: base_salary, bonus_percentage, pension_contribution_employer, pension_scheme, car_allowance, other_benefits (JSONB)
2. For academic roles, add pay_grade, spine_point, and allowances fields
3. Add a total_compensation_estimate calculated field for like-for-like comparison
4. Store notice period and probation period as structured fields

---

**Round 9 -- The system does not help me prepare for interviews in any meaningful way.**

Module 4 tracks that an interview is scheduled (Section 6.9), stores the date/time/format/interviewers, and sends a notification. But it does not help the candidate prepare. The preparation_notes field is free-text, populated by whatever the email invitation contained. There is no integration with the original job description, the tailored CV that was sent, the company research from Module 1, or any kind of preparation checklist. The weekly report shows upcoming interviews with a brief "Prep: Review BigBank 2025 Annual Report" note, but this is just echoing what was in the invitation email. For a system that has the job description, the candidate's CV, the company profile, and the application history, it should be able to generate a comprehensive interview prep brief. This is acknowledged as a future enhancement ("AI Interview Coach," Section 17.8) at medium priority, but basic interview prep support should be in v1.

**Score: 4/10**

**Recommendations:**
1. Auto-generate an interview prep brief that combines: job description highlights, tailored CV talking points, company profile data, and the specific interview format
2. For academic teaching presentations, generate a prep checklist (topic research, slide structure, timing practice)
3. Send the prep brief 48 hours before the interview, not just the notification
4. After the interview, prompt the candidate for self-assessment notes while the experience is fresh

---

**Round 10 -- What happens when I get an offer? The post-offer experience is underdeveloped.**

The state machine transitions to OFFER_RECEIVED, then NEGOTIATING, then PRE_EMPLOYMENT, then ACCEPTED. But the PRD provides minimal guidance on what happens during these critical stages. The negotiation stage has no support -- no salary benchmark data, no negotiation scripts, no tracking of offer terms vs. counter-offers. The pre-employment stage (Section 6.10) tracks DBS checks and references but does not help the candidate manage the process -- no reminders to chase referees, no alerts when a DBS check is taking longer than expected, no checklist of required documents. For the most important part of the job search (the offer stage), the system essentially stops being useful beyond basic status tracking. The anti-goals (Section 3.4) explicitly exclude salary negotiation advice, but even basic offer comparison and pre-employment checklist functionality would be valuable.

**Score: 4/10**

**Recommendations:**
1. Add referee management: track who was contacted, send reminders to chase slow referees
2. Add pre-employment checklist with expected timelines and alerts for overdue items
3. Enable side-by-side offer comparison when multiple offers are active
4. Send regular pre-employment progress updates ("2 of 3 references received, DBS check submitted 5 days ago")

---

#### Persona 1 Summary: The Candidate (Selvi)

| Round | Concern | Score |
|-------|---------|-------|
| 1 | Weekly report anxiety and timing | 5/10 |
| 2 | No on-demand pipeline visibility (no UI) | 3/10 |
| 3 | Daily check-in alert fatigue | 5/10 |
| 4 | Snooze functionality too simplistic | 5/10 |
| 5 | Follow-up templates too generic | 4/10 |
| 6 | Emotional handling of rejection at scale | 4/10 |
| 7 | No pause/vacation mode | 3/10 |
| 8 | Salary tracking too superficial for UK market | 4/10 |
| 9 | No interview preparation support | 4/10 |
| 10 | Post-offer experience underdeveloped | 4/10 |

**Average Score: 4.1/10**

**Top 3 Issues:**
1. No on-demand pipeline visibility -- email-only interaction is a critical UX gap for a 50+ application pipeline
2. No pause/vacation mode -- system continues running and creating false signals during candidate absence
3. Post-offer and interview prep support is absent despite the system having all the necessary data

---

### 18.2 Persona 2: Technical Architect / n8n Expert

**Profile:** Senior platform engineer with deep n8n experience, PostgreSQL expertise, and distributed systems knowledge. Focused on reliability, concurrency, and operational sustainability.

---

**Round 11 -- The state machine function uses SELECT FOR UPDATE but the CASE statement runs separate UPDATE queries, creating a race condition window.**

The `transition_application_state()` function (Section 6.6) acquires a row lock with `SELECT ... FOR UPDATE`, which is correct. But after validating the transition, it runs `UPDATE applications SET current_state = ...` followed by a separate `CASE` block that runs another `UPDATE applications SET applied_at = NOW()` (or similar timestamp). These are two separate UPDATE statements within the same function, which is technically fine within a single transaction. However, the function does not explicitly manage the transaction -- it relies on the caller's transaction context. If called from n8n via a standard Postgres node, each query runs in its own implicit transaction unless explicitly wrapped. The n8n Postgres node does not support explicit transaction management out of the box. If the first UPDATE succeeds but the second fails (e.g., connection drop), the state is changed but the timestamp is not set, leaving the record in an inconsistent state. The event INSERT is also a separate statement. The function should consolidate into a single UPDATE with all fields, or use explicit transaction control within the function itself.

**Score: 5/10**

**Recommendations:**
1. Consolidate the state change UPDATE and timestamp UPDATE into a single statement using CASE within the SET clause
2. The function already uses PL/pgSQL which runs in a single transaction by default, but verify n8n calls it within a single database operation
3. Add a test that verifies state change + timestamp + event are all set atomically
4. Consider using a RETURNING clause to confirm the update in a single roundtrip

---

**Round 12 -- WF4-STATUS runs every 30 minutes AND accepts webhooks, but there is no deduplication mechanism.**

WF4-STATUS (Section 13.2) has two triggers: a cron that polls for unprocessed email events, and a webhook that Module 5 calls when it parses an email. If Module 5 sends a webhook AND the cron fires before the webhook marks the event as processed, the same email event will be processed twice. The matching algorithm will match it to the same application and attempt the same state transition. The state machine will correctly reject the second transition (if the first already moved the state), but the system will still: (a) run the matching algorithm unnecessarily, (b) log an invalid transition attempt, (c) potentially send a duplicate notification. There is no idempotency key on the webhook, no "processing" lock on email_updates rows, and no check in WF4-STATUS for whether an event is currently being processed by another execution. With n8n's concurrency model, two executions of the same workflow can overlap.

**Score: 4/10**

**Recommendations:**
1. Add a `processing_by` column and `processing_started_at` to `email_updates` to implement a pessimistic lock
2. Use `UPDATE email_updates SET processed = true ... WHERE processed = false RETURNING *` as an atomic claim-and-fetch pattern
3. Add an idempotency check at the webhook entry point: if the email_id already has a processed event, return 200 immediately
4. Consider removing the cron trigger entirely and relying solely on webhooks, with a separate "sweep" workflow that runs hourly to catch any missed events

---

**Round 13 -- The email matching algorithm has no learning loop and will repeatedly fail on the same patterns.**

The matching algorithm (Section 7.3) is a static scoring function. If it fails to match an email from a recruitment agency to the correct application, the candidate manually assigns it, but that correction is never fed back into the matching logic. The next email from the same agency will fail the same way. There is no mechanism to: (a) learn that "recruitment@hays.com" maps to specific applications, (b) build a sender-to-company mapping table from confirmed matches, (c) adjust confidence weights based on historical accuracy. The algorithm also normalizes company names by removing "Ltd/Limited/PLC" suffixes (Section 14.4 view), but does not handle common variations like "University of Reading" vs. "UoR" vs. "Reading University." The matching function extracts domains, but many companies use recruitment agencies or ATS platforms (Workday, iCIMS, Greenhouse) whose domains will never match the company domain.

**Score: 4/10**

**Recommendations:**
1. Create a `sender_company_mappings` table that records confirmed email sender -> company mappings from manual assignments
2. Use the mappings table as a first-pass lookup before running the scoring algorithm
3. Add ATS domain recognition (workday.com, icims.com, greenhouse.io, etc.) and extract company context from the email body instead
4. Track matching accuracy over time and surface statistics in the weekly operational health check

---

**Round 14 -- n8n workflow error handling relies on a global error handler (WF0) that is not specified in this PRD.**

Section 15.2 states "All Module 4 workflows connect to the global error handler (WF0) established in Module 1." But Module 4's PRD does not specify how this connection works, what WF0 expects, or what happens if WF0 itself is down. The error handling code in Section 15.3 shows a JavaScript retry pattern, but n8n Code nodes do not have native access to `pg.query()` -- they use n8n's built-in Postgres node or the internal `$http` function. The retry pattern as written cannot be implemented directly in an n8n Code node without a custom database driver. n8n's native error handling uses error trigger nodes and workflow-level error workflows, not try-catch within Code nodes. The PRD's error handling design mixes application-level patterns (JavaScript try-catch) with n8n platform patterns (error triggers) without clearly delineating which applies where.

**Score: 4/10**

**Recommendations:**
1. Specify the WF0 error handler interface in this PRD or reference the Module 1 PRD section
2. Replace the JavaScript retry pattern with n8n-native error handling: Error Trigger node -> retry workflow execution -> dead letter queue
3. Use n8n's built-in retry mechanism (configurable per node) rather than custom JavaScript retry logic
4. Add a fallback notification path (Telegram, not just email) in case the Resend API is the component that has failed

---

**Round 15 -- The notification_queue table is introduced in Section 13.6 but not in the schema section (Section 12).**

The database schema (Section 12) defines 8 tables: applications, application_events, application_documents, application_interviews, application_pre_employment, pipeline_metrics, follow_up_log, application_notes. But WF4-NOTIFY (Section 13.6) introduces a `notification_queue` table with its own schema. This table is not in Section 12, not in the migration script (Section 12.10), not in the ER diagram (Section 12.11), and not in the table count ("7 new tables" in Section 12.1). Similarly, WF4-STATUS references an `email_updates` table that is presumably owned by Module 5, but the schema and interface are not specified here. There is also a `notification_log` table referenced in Section 13.5 that is separate from both notification_queue and follow_up_log, but it is never defined. The schema section is incomplete -- there are at least 2-3 tables missing.

**Score: 3/10**

**Recommendations:**
1. Add notification_queue and notification_log table definitions to Section 12
2. Update Section 12.1 table count and the ER diagram to include all tables
3. Include notification_queue in the migration script (Section 12.10)
4. Document the email_updates table interface that Module 5 must provide, even if Module 5 owns the schema

---

**Round 16 -- The system has no concept of workflow versioning or safe deployment.**

The PRD specifies 6 n8n workflows but does not address how they are versioned, tested before deployment, or rolled back if a code change introduces a regression. n8n workflows are typically edited in the UI and saved directly to the database -- there is no git-based version control without deliberate export. The rollout plan (Section 17) describes initial deployment but not ongoing maintenance. When the matching algorithm needs tuning, or the ghosting thresholds need adjustment, or a new email pattern needs to be added, how are these changes tested? There is no staging environment, no test instance of n8n, and no CI/CD pipeline. The weekly workflow export (Section 16.6) is a backup, not a version control mechanism. For a system that processes sensitive state transitions (marking applications as ghosted, auto-rejecting), uncontrolled changes are risky.

**Score: 4/10**

**Recommendations:**
1. Export all workflows as JSON to git after every change, with commit messages describing the change
2. Establish a testing protocol: clone workflow, modify, test with seed data, then promote to production
3. Add a system_config flag per workflow for "maintenance mode" that prevents execution during updates
4. Use n8n's built-in workflow tagging to mark workflows as "production" vs. "testing"

---

**Round 17 -- The generated column `is_active` will cause issues with partial indexes and query planning.**

The `is_active` column (Section 12.2) is defined as `GENERATED ALWAYS AS (current_state NOT IN (...)) STORED`. This is fine for reads, but PostgreSQL has limitations with generated columns in certain contexts. Partial indexes that reference `is_active` (e.g., `idx_applications_state ON applications(current_state) WHERE is_active = true`) will work, but the query planner may not always use them effectively because the planner does not always realize that `WHERE current_state = 'applied'` implies `is_active = true`. Additionally, if the list of terminal states ever changes (e.g., adding a new terminal state like "on_hold"), every generated column value must be updated, which requires an ALTER TABLE to change the generation expression. This is a schema migration that touches every row. Using a simpler approach (a trigger-maintained boolean, or just including the WHERE clause in queries) would be more maintainable.

**Score: 6/10**

**Recommendations:**
1. Replace the generated column with a trigger-maintained boolean that is easier to modify
2. Alternatively, keep the generated column but also create a CHECK constraint that validates the mapping
3. Ensure the test suite includes query plan analysis (EXPLAIN ANALYZE) for critical queries using is_active
4. Document the list of terminal states in a single location so changes are not scattered across generated columns, queries, and application code

---

**Round 18 -- The system runs on shared infrastructure with no resource isolation.**

The Hetzner CAX31 (8 vCPU ARM, 16GB RAM) runs n8n, Postgres, Dokploy, and all 5 modules simultaneously. Module 4 adds 6 new scheduled workflows, some running every 30 minutes. WF4-GHOST processes all active applications every 6 hours. WF4-METRICS runs complex aggregate queries daily. WF4-STATUS processes email batches with LLM calls (via Module 5). There is no resource isolation between workflows -- a long-running WF4-METRICS query could lock the Postgres connection pool and starve WF4-STATUS of database access during a critical status update. n8n's self-hosted version has limited concurrency control: by default, executions queue globally. If WF4-GHOST is processing 200 applications at 2PM and Module 5 detects an interview invitation, the status update will queue behind the ghosting check. The PRD does not specify n8n concurrency settings, connection pool sizes, or Postgres resource limits.

**Score: 4/10**

**Recommendations:**
1. Set n8n concurrency limits per workflow (WF4-GHOST: max 1 concurrent, WF4-STATUS: max 3 concurrent)
2. Configure Postgres connection pool with separate pools or connection limits for batch vs. real-time workflows
3. Add query timeouts to long-running metric queries (SET statement_timeout = '30s')
4. Monitor n8n execution queue depth as a health metric -- alert if queue exceeds 10 pending executions

---

**Round 19 -- SplitInBatches with batch size 1 in WF4-STATUS is a performance bottleneck.**

WF4-STATUS (Section 13.2) processes pending email updates using `SplitInBatches, batch size: 1` -- each email is processed individually in a loop. For each email, it: fetches all active applications (full table scan), runs the matching algorithm (JavaScript code node), checks confidence, calls the state transition function (Postgres), and potentially sends a notification (HTTP request to Resend). With 20 pending emails (the LIMIT in the query), this means 20 iterations with 20 separate "fetch all active applications" queries. The active applications query should be fetched once and cached for the entire batch. Additionally, sending notifications synchronously within the loop means a slow Resend API response (or timeout) blocks all subsequent email processing. The batch size should be larger and notifications should be queued rather than sent inline.

**Score: 5/10**

**Recommendations:**
1. Fetch active applications once before the loop, not inside each iteration
2. Increase batch size to 5-10 to reduce loop overhead
3. Queue notifications to notification_queue instead of sending inline -- let WF4-NOTIFY handle delivery
4. Add a per-execution time limit so a single slow batch does not delay the next cron run

---

**Round 20 -- The UNIQUE constraint on job_id in the applications table prevents legitimate re-applications.**

Section 12.2 has `CONSTRAINT unique_job_application UNIQUE (job_id)`. Section 6.4 allows transitions from `rejected -> applied` and `withdrawn -> applied` for re-applications. But the UNIQUE constraint means a second application record for the same job_id cannot be created -- the system must reuse the existing record. This means re-applying overwrites the original application history (applied_at, cv_version_id, etc.). The event log preserves the history, but the main application record loses its original data. If the candidate applied with CV v1, got rejected, and re-applies with CV v2, the applications row now shows CV v2 and the original CV v1 data is only in events. This also means the system cannot track two concurrent applications for different postings of the same job (e.g., the job is reposted with a new description but the same job_id in Module 1). The constraint is too restrictive.

**Score: 4/10**

**Recommendations:**
1. Remove the UNIQUE constraint on job_id, or change it to a partial unique constraint `WHERE current_state NOT IN (terminal_states)`
2. For re-applications, create a new application record linked to the same job_id but preserving the old record as a historical entry
3. Add an `application_attempt` counter to distinguish first application from re-application
4. Link the old and new application records with a `previous_application_id` foreign key

---

#### Persona 2 Summary: Technical Architect / n8n Expert

| Round | Concern | Score |
|-------|---------|-------|
| 11 | State machine function race condition window | 5/10 |
| 12 | No deduplication between cron and webhook triggers | 4/10 |
| 13 | Email matching has no learning/feedback loop | 4/10 |
| 14 | Error handling references undefined WF0 and uses wrong patterns | 4/10 |
| 15 | Schema section missing 2-3 tables (notification_queue, notification_log) | 3/10 |
| 16 | No workflow versioning or safe deployment process | 4/10 |
| 17 | Generated column is_active may impede query planning and schema evolution | 6/10 |
| 18 | No resource isolation on shared infrastructure | 4/10 |
| 19 | SplitInBatches batch size 1 is a performance bottleneck | 5/10 |
| 20 | UNIQUE constraint on job_id prevents clean re-applications | 4/10 |

**Average Score: 4.3/10**

**Top 3 Issues:**
1. Schema section is incomplete -- missing notification_queue, notification_log, and email_updates interface definition
2. No deduplication between cron and webhook triggers on WF4-STATUS creates duplicate processing risk
3. UNIQUE constraint on job_id conflicts with the state machine's own re-application transitions

---

### 18.3 Persona 3: UK Career Coach / Recruitment Expert

**Profile:** 15+ years in UK recruitment and career coaching, deep knowledge of corporate and academic hiring processes, experienced advising senior professionals in career transitions.

---

**Round 21 -- The corporate pipeline misses the recruiter/agency intermediary layer entirely.**

At the GBP 70-80k level in UK L&D, a significant proportion of roles are filled through recruitment agencies (Hays, Michael Page, Robert Walters, Morgan McKinley). The candidate does not deal directly with the employer until the interview stage -- all communication goes through the recruiter. The PRD's state machine and email matching assume direct employer-candidate communication. An agency introduces layers of indirection: the rejection email comes from the recruiter not the employer, the interview invitation is forwarded by the recruiter, and the offer is communicated by the recruiter before formal paperwork arrives from the employer. The email sender domain will be @hays.com, not @employer.com, and one agency recruiter may be handling multiple roles at different employers. The matching algorithm (Section 7.3) has a single line about "recruitment agency names" at step 4a, but no structured handling. For a candidate at this level, agencies may represent 30-40% of applications.

**Score: 3/10**

**Recommendations:**
1. Add a `recruitment_agency` field to the applications table with agency name, recruiter name, and recruiter email
2. Build agency-aware email matching: if the sender is a known agency, match based on recruiter name + job title rather than company domain
3. Add an agency state to the pipeline: SUBMITTED_TO_AGENCY -> PRESENTED_TO_CLIENT -> CLIENT_INTERESTED -> INTERVIEW, etc.
4. Track agency performance metrics separately (which agencies produce interviews, which ghost)

---

**Round 22 -- The "Applied" state is too broad and misses critical sub-states in UK corporate hiring.**

In UK corporate recruitment, there are meaningful stages between submitting an application and receiving an acknowledgement. The application may sit in an ATS (Workday, SuccessFactors, Taleo) being automatically screened for keywords. It may pass to an internal recruiter who reviews it. The recruiter may share it with the hiring manager. Each of these is a distinct step with different timelines. The PRD treats "Applied" as a monolithic state where the candidate waits for any response. But in reality, ATS auto-screening can reject within hours, while a manually reviewed application may take 2-3 weeks. The system cannot distinguish between "your application has not been screened yet" and "your application was screened and is sitting on the hiring manager's desk." This distinction matters for follow-up strategy: following up at the recruiter level is different from following up with the hiring manager.

**Score: 5/10**

**Recommendations:**
1. Add an optional sub-state for "Applied": ATS_SCREENED, RECRUITER_REVIEWED, SHARED_WITH_HIRING_MANAGER
2. These sub-states can be populated when the acknowledgement email gives clues ("your application has been forwarded to the hiring manager")
3. Adjust follow-up advice based on the sub-state: do not follow up if only ATS-screened, consider following up if forwarded to HM
4. Track ATS-rejected vs. human-rejected separately in metrics

---

**Round 23 -- Academic "Longlisted" and "Shortlisted" states are described in the diagram but not in the universal state machine.**

The academic pipeline diagram (Section 6.8) shows LONGLISTED and SHORTLISTED as distinct academic stages. The state machine (Section 6.2-6.4) does not include these in the universal states or valid transitions map. The valid transitions in Section 6.4 jump from `acknowledged -> screening/interviewing`, with no `longlisted` or `shortlisted` (academic-specific) intermediate. The academic follow-up rules (Section 9.4) reference `shortlisted_at` in the academic context, but the state code `shortlisted` in the universal machine means "worth applying to" (pre-application), not "shortlisted by the university." These are two completely different meanings of the same word, which will cause confusion and bugs. The academic pipeline needs its own intermediate states that are distinct from the universal pre-application `shortlisted` state.

**Score: 3/10**

**Recommendations:**
1. Add `academic_longlisted` and `academic_shortlisted` as explicit states in the state machine, distinct from the pre-application `shortlisted`
2. Update the valid transitions map to include these states for academic-track applications
3. Rename the pre-application `shortlisted` to something unambiguous like `candidate_shortlisted` or `queued_for_application`
4. Add `longlisted_at` and `academic_shortlisted_at` timestamp columns to the applications table

---

**Round 24 -- The ghosting thresholds for academic applications are still too aggressive.**

The academic ghost threshold for "applied" state is 56 days / 8 weeks (Section 9.6). In practice, UK academic hiring routinely takes longer. A role advertised in January with a March deadline will not begin shortlisting until late March or early April. The committee meets monthly, or sometimes less frequently. If the candidate applies on 15 January and the deadline is 15 March, no communication is expected until April at the earliest. That is 10-12 weeks from application, not 8. The system would flag this as ghosted at week 8, while the application is still completely alive. The PRD acknowledges the academic calendar (Appendix G) but does not integrate it into the ghosting algorithm. Applications submitted during the primary hiring cycle (January-April) should have longer thresholds than applications submitted out-of-cycle. The ghosting algorithm should also check whether the role's closing date has passed before counting ghosting days.

**Score: 4/10**

**Recommendations:**
1. Extend academic ghost threshold for "applied" to 84 days (12 weeks) to account for committee review cycles
2. Start the ghosting timer from the role's closing date, not the application submission date
3. If the closing date is known and has not passed yet, suppress ghosting detection entirely
4. Factor in academic calendar season: January-April applications should have extended thresholds for the April-June interview window

---

**Round 25 -- The system does not track networking and informal contacts, which drive 30-40% of UK senior hires.**

At the Head of L&D / Senior Lecturer level, a significant proportion of opportunities come through networking: LinkedIn conversations, conference contacts, former colleague referrals, professional body connections (CIPD). These informal channels do not produce clean application-acknowledgement-interview flows. A networking contact might say "I'll mention your name to our HR director" -- this is not an application, but it needs tracking. The system only tracks formal applications that enter the state machine at "discovered" or "applied." There is a basic `has_referral` boolean (Section 12.2), but no way to track a networking-originated opportunity that has not yet become a formal application. The candidate needs a "warm leads" or "networking pipeline" that sits alongside the formal application pipeline.

**Score: 4/10**

**Recommendations:**
1. Add a "networking" or "warm_lead" pre-application state that tracks informal contacts and referrals
2. Allow the candidate to log networking interactions: "Spoke with [name] at [event], they will forward my CV to [company]"
3. Set follow-up reminders for networking contacts ("Check back with [name] in 2 weeks about the role at [company]")
4. Track conversion rate from networking lead to formal application to interview

---

**Round 26 -- UK Tier/Visa sponsorship complexity is oversimplified.**

Section 4.7 (US-425) states the candidate "has unrestricted UK work rights (does not need sponsorship), so this stage can be marked as pre-cleared." While this may be true for this specific candidate, the system design bakes this assumption in too deeply. If the candidate's circumstances change (e.g., she needs to help a spouse with sponsorship, or a role requires specific security clearance beyond right to work), the system has no flexibility. More importantly, the "Right to Work" tracking (Section 6.10) is treated as a binary checkbox. In practice, UK RTW verification requires specific documents (passport, BRP, share code from the Home Office online service), has a prescribed employer checking process (either manual or via the Home Office online service), and has legal deadlines. For academic roles, there may be additional checks (Prevent duty compliance, for instance). The system treats RTW as a simple pass/fail, missing the procedural reality.

**Score: 6/10**

**Recommendations:**
1. Make RTW status configurable rather than hard-coded as pre-cleared
2. Add RTW verification method tracking: manual document check, Home Office online service, IDVT (Identity Document Validation Technology)
3. For academic roles, add Prevent duty compliance as a pre-employment check option
4. Store the RTW document expiry date if applicable (e.g., for BRP holders)

---

**Round 27 -- The system does not account for the competency framework reality of UK corporate hiring.**

UK corporate L&D roles at this level almost universally use competency-based interviews. Employers define 4-6 competencies (strategic thinking, stakeholder management, commercial awareness, etc.) and assess each one. The interview stage tracking (Section 6.9) records interview type as "competency_based" but does not capture which competencies are being assessed or how the candidate performs against each one. After an interview, the most useful feedback the candidate can record is "strong on strategic thinking, weak on commercial awareness" -- this structured feedback drives preparation for the next interview. The free-text `feedback` field is inadequate for this. Additionally, many UK corporates use the STAR framework (Situation, Task, Action, Result) and the candidate should be tracking which STAR examples she has used at which companies to avoid repeating the same ones.

**Score: 5/10**

**Recommendations:**
1. Add a structured competency assessment to interview records: list of competencies assessed, self-rated performance on each
2. Track STAR examples used per interview to avoid repetition across different employers
3. Aggregate competency performance data: "You consistently score well on strategic thinking but need more examples for commercial awareness"
4. Link competency data to interview prep for future interviews at similar companies

---

**Round 28 -- The PRD does not handle the "informal chat" stage that is increasingly common in UK hiring.**

Before formal interviews, many UK employers (especially for senior roles) conduct informal conversations -- "just a chat over coffee" with the hiring manager or a team member. These are not interviews, but they are absolutely assessment moments. The candidate's state machine (Section 6.2) jumps from ACKNOWLEDGED to SCREENING (phone screen) with no intermediate. An informal chat is not a phone screen (it is not structured, no formal questions), but it is more than an acknowledgement. If the candidate has an informal chat and reports "Met with the L&D Director, went well, they said they'd progress me to formal interview," the system should record this distinctly. The interview_type enum (Section 12.5) includes "informal_chat" but it is categorized under application_interviews as if it were a formal interview round, which skews metrics.

**Score: 5/10**

**Recommendations:**
1. Add "INFORMAL_CONTACT" as a state between ACKNOWLEDGED and SCREENING that does not count as a formal interview round
2. Exclude informal chats from interview conversion metrics but track them separately as a positive signal
3. Adjust follow-up advice: after an informal chat, the follow-up should be more personal and reference the conversation
4. Track informal chat conversion rate as a separate metric (informal chats that lead to formal interviews)

---

**Round 29 -- No handling of speculative applications, which are common at this career level.**

The state machine assumes all applications are responses to advertised positions. But at the Head of L&D / Senior Lecturer level, speculative applications are a legitimate strategy. The candidate identifies a company she wants to work for, researches the right contact, and sends a CV without a specific vacancy. This does not fit the Module 1 -> Module 2 -> Module 3 flow at all. There is no job_id from Module 1, no job description to tailor against, no closing date to track. The application_method enum (Section 12.2) includes "speculative" but the rest of the system assumes a job_id is always present (`job_id UUID NOT NULL REFERENCES jobs(id)`). A speculative application cannot have a job_id because there is no job record. The system literally cannot track it.

**Score: 3/10**

**Recommendations:**
1. Make job_id nullable, or create a synthetic "speculative" job record in the jobs table for each speculative application
2. Add speculative application support to WF4-INIT with a separate input path that does not require a Module 1 job reference
3. Define different follow-up timelines for speculative applications (typically longer, 3-4 weeks before first follow-up)
4. Track speculative application outcomes separately in metrics (conversion rate from speculative to interview)

---

**Round 30 -- The system does not track interview travel and expenses, which is relevant for UK academic interviews.**

UK academic interview candidates are typically offered travel expense reimbursement. The candidate needs to track: which interviews offer expenses, whether she has claimed them, whether they have been paid. For corporate interviews, especially at companies outside the Maidenhead area, travel costs and time are a factor in deciding whether to attend. An interview in London is a 45-minute train ride; an interview in Edinburgh is a full-day commitment. The system records interview location (Section 6.9) but does not help the candidate assess the practical logistics. For a candidate managing 3-5 interviews per month across different UK locations, tracking travel arrangements and expense claims is a real administrative burden that the system could help with.

**Score: 6/10**

**Recommendations:**
1. Add optional travel_cost_estimate and expense_claim_status fields to application_interviews
2. For academic interviews, add an expense_reimbursement boolean and reimbursement_status (not_claimed, submitted, received)
3. Show travel logistics in interview notifications: estimated travel time from Maidenhead, train times if relevant
4. Keep this as a v1.1 enhancement rather than blocking v1.0 launch

---

#### Persona 3 Summary: UK Career Coach / Recruitment Expert

| Round | Concern | Score |
|-------|---------|-------|
| 21 | Recruitment agency intermediary layer missing | 3/10 |
| 22 | "Applied" state too broad, misses ATS sub-states | 5/10 |
| 23 | Academic longlisted/shortlisted not in state machine, name conflict | 3/10 |
| 24 | Academic ghosting thresholds still too aggressive | 4/10 |
| 25 | No networking/warm leads pipeline | 4/10 |
| 26 | UK Tier/Visa complexity oversimplified | 6/10 |
| 27 | Competency framework tracking for UK interviews missing | 5/10 |
| 28 | "Informal chat" stage not properly handled | 5/10 |
| 29 | Speculative applications cannot be tracked (job_id NOT NULL) | 3/10 |
| 30 | No interview travel/expense tracking | 6/10 |

**Average Score: 4.4/10**

**Top 3 Issues:**
1. Recruitment agency layer entirely missing -- a major gap for senior UK roles where 30-40% go through agencies
2. Academic longlisted/shortlisted states conflict with pre-application "shortlisted" -- this is a naming collision that will cause bugs
3. Speculative applications literally cannot be tracked due to NOT NULL constraint on job_id

---

### 18.4 Persona 4: Data Engineer / Analytics Specialist

**Profile:** Senior data engineer specializing in analytics pipelines, metrics design, and data quality. Expert in PostgreSQL, data modeling, and statistical accuracy.

---

**Round 31 -- The response rate metric definition is inconsistent across sections.**

Section 3.3 defines response rate as "(acknowledged + rejected + interview) / applied." Section 8.2 defines it as "(Acknowledged + Rejected + Screened + Interviewed) / Applied." Section 8.6 (SQL query) implements it as `COUNT(*) FILTER (WHERE current_state NOT IN ('applied', 'ghosted')) / COUNT(*)`. These three definitions are all different. The first excludes screening from the numerator. The second includes it explicitly. The SQL version includes ALL non-applied, non-ghosted states (including cv_tailored, discovered, offer_received, etc.) which is wrong -- pre-application states should not count as "responses." An application in "cv_tailored" state has not received a response; it just has not been submitted yet. Including it in the response rate numerator inflates the metric. This inconsistency means the candidate will see different numbers depending on which definition is used, and the "response rate" metric cannot be trusted.

**Score: 3/10**

**Recommendations:**
1. Define response rate once, precisely, in a single location and reference it everywhere
2. Correct definition: responses / submitted = COUNT(states after 'applied' excluding 'ghosted' and 'expired') / COUNT(states at 'applied' or beyond)
3. The SQL query must exclude pre-application states from both numerator and denominator
4. Add a metrics glossary that maps each metric name to its exact SQL implementation

---

**Round 32 -- The pipeline_metrics table stores denormalized snapshots without any way to reconstruct or validate them.**

The pipeline_metrics table (Section 12.7) stores metric_name, metric_value, and dimensions as JSONB. This is an append-only fact table with no link back to the source data. If a metric looks wrong, there is no way to trace it back to the specific applications that produced it. There is no metric_query_hash, no source_record_count, no snapshot_of_applications field. The WF4-METRICS workflow (Section 13.4) deletes and recreates today's metrics (`DELETE FROM pipeline_metrics WHERE calculated_at >= date_trunc('day', NOW())`), which means if the workflow runs twice in a day (e.g., manual re-run after fixing an issue), the first run's data is lost. The retention policy (Section 8.7) aggregates daily into weekly and monthly, but the aggregation logic is not specified -- how are rate metrics (percentages) averaged? Simple averaging of percentages is statistically incorrect if the denominators differ.

**Score: 4/10**

**Recommendations:**
1. Add source_record_count and denominator fields to pipeline_metrics so rates can be validated
2. Do not DELETE before recalculating -- use UPSERT with a natural key (metric_name + dimensions + period_start) to make recalculation idempotent
3. Specify the weekly/monthly aggregation formulas: use weighted averages for rate metrics, SUM for count metrics
4. Add a metric validation step that cross-checks calculated metrics against raw application data

---

**Round 33 -- Interview conversion rate calculation is logically flawed.**

The interview conversion rate query in Section 8.6 calculates: interviews / (applications that have progressed past 'applied'). This is the wrong denominator. The question "what percentage of responses lead to interviews?" should be: applications that reached 'interviewing' or beyond / applications that received any response (acknowledged or beyond). The current SQL uses `COUNT(*) FILTER (WHERE current_state != 'applied')` as denominator, which includes 'ghosted' applications. A ghosted application is not a response -- including it in the denominator deflates the rate. Additionally, the query only looks at current_state, not historical states. An application that is currently 'rejected' but was rejected after an interview (at the interviewing stage) would not be counted as an interview. The query needs to check whether the application ever reached 'interviewing', not whether it is currently there.

**Score: 3/10**

**Recommendations:**
1. Define interview conversion rate as: applications that ever reached 'interviewing' / applications that received any employer response
2. Use event history to determine "ever reached" a state, not current_state
3. Exclude ghosted and expired from the denominator (these are not responses)
4. Create a materialized view or summary column that tracks the "highest state reached" for each application

---

**Round 34 -- The metrics period handling will produce incorrect trending for the candidate's dual-track search.**

All metrics in Section 8.6 are grouped by pipeline_track (corporate vs. academic). But the time periods are fixed (trailing 30 days for most metrics). A trailing 30-day window works for corporate applications where the cycle is 3-8 weeks, but it is too short for academic applications where the cycle is 3-6 months. An academic application submitted 60 days ago that just reached the interview stage would be outside the 30-day response rate window, making the academic response rate look worse than it is. Conversely, an academic application submitted 10 days ago with no response is perfectly normal but drags down the 30-day response rate. The metrics engine should use track-appropriate time windows: 30 days for corporate, 90 days for academic.

**Score: 4/10**

**Recommendations:**
1. Use track-specific metric windows: 30-day trailing for corporate, 90-day trailing for academic
2. Display both time windows in the weekly report so the candidate sees the appropriate context
3. Add a "time-to-event" metric that measures from application to each subsequent state, rather than just point-in-time rates
4. Consider survival analysis (Kaplan-Meier) for time-to-response metrics to properly handle censored data (applications still waiting)

---

**Round 35 -- The source effectiveness metrics do not account for job quality or self-selection bias.**

Section 8.4 tracks source response rates (e.g., Reed 45%, Indeed 22%). The PRD uses these to make strategic recommendations ("Prioritize direct applications," sample report Appendix H). But these raw rates do not account for confounding variables. The candidate may apply to more competitive roles through Indeed (higher volume, less selective about which jobs to apply to) and more targeted roles through Reed (pre-screened by recruiter). The higher Indeed volume may include C-tier "stretch" applications that are less likely to get responses. The source is not the cause of the difference -- the application quality is. Without controlling for job tier, salary level, role seniority, and the candidate's tailoring effort, source effectiveness metrics are misleading and may drive bad strategy (e.g., stop using Indeed, where the best role might actually appear).

**Score: 4/10**

**Recommendations:**
1. Cross-tabulate source effectiveness with job tier (A/B/C) to control for application quality
2. Show source metrics alongside average tailoring score to identify whether tailoring effort varies by source
3. Add a caveat to source effectiveness metrics: "Response rates vary by source partly because of the types of roles found on each source"
4. Track source effectiveness for same-tier applications only (e.g., "Reed A-tier response rate" vs. "Indeed A-tier response rate")

---

**Round 36 -- The document performance metrics will not reach statistical significance for months.**

Section 8.5 tracks CV version response rates. But the candidate is unlikely to have more than 2-3 CV versions in active use. If she has Corporate CV v1 and Corporate CV v2, and applies to 15 jobs with each, she needs at least 10-15 responses per version before the difference between a 30% and 40% response rate becomes statistically meaningful. At the expected response rate (25-40%) and volume (8-15 applications/week), it could take 4-6 weeks to accumulate enough data for any single CV version to have a reliable response rate. The weekly report will show these metrics from week 1, when a CV version with 3 applications and 1 response shows a "33% response rate" -- this is noise, not signal. Presenting unstable metrics as actionable data is worse than showing no data at all.

**Score: 4/10**

**Recommendations:**
1. Do not display document performance metrics until a minimum sample size is reached (n >= 10 applications per version)
2. Show confidence intervals alongside percentage metrics (e.g., "33% +/- 25%") so the candidate understands the uncertainty
3. Use Bayesian estimation with an informative prior rather than raw frequencies for small samples
4. In the weekly report, flag metrics with small sample sizes: "Insufficient data for reliable comparison"

---

**Round 37 -- The funnel conversion metrics treat the pipeline as linear, but applications skip stages.**

The funnel (Section 8.2) shows Applied -> Acknowledged -> Screening -> Interviewing -> Assessment -> Offer -> Accepted. But the valid transitions (Section 6.4) allow applications to skip stages: applied -> interviewing (skipping acknowledged and screening), acknowledged -> assessment (skipping screening). In practice, many UK employers skip the phone screen stage entirely for senior candidates, going directly from application to interview. The funnel metrics will show a low "screening rate" not because candidates are being filtered out at screening, but because many applications never enter screening. A standard conversion funnel assumes each stage is a subset of the previous stage. When stages can be skipped, the funnel metaphor breaks down and the percentages become misleading. "27% screening rate" could mean "73% were screened out" OR "73% went directly to interview without screening."

**Score: 4/10**

**Recommendations:**
1. Replace the linear funnel with a Sankey diagram approach that shows all transition paths including skip-stage transitions
2. Report "reached this stage or beyond" rather than "currently at this stage" for funnel percentages
3. Add a "highest stage reached" column to the applications table for cleaner funnel analysis
4. Show the most common path through the pipeline separately for corporate and academic tracks

---

**Round 38 -- The median response time calculation excludes ghosted applications, creating survivorship bias.**

Section 8.6, query #4 calculates median response time using only applications where `acknowledged_at IS NOT NULL`. This excludes every application that was ghosted (never acknowledged). The result is survivorship bias: the median response time only measures applications that DID respond, ignoring all the ones that did not. If 40% of applications are ghosted, the median response time metric only reflects the 60% that responded, painting an unrealistically optimistic picture. The candidate sees "Median Response Time: 4.5 days" and thinks "most employers respond within a week" when in reality most employers do not respond at all. The metric should either be clearly labelled as "conditional on receiving a response" or should incorporate ghosted applications as censored observations.

**Score: 4/10**

**Recommendations:**
1. Rename to "Median Response Time (responding employers only)" to avoid misinterpretation
2. Add a separate "probability of receiving any response" metric
3. Consider Kaplan-Meier survival analysis: "By day 7, 40% of applications have received a response; by day 14, 55%"
4. Show both metrics side by side: "Median time to response (when they respond): 4.5 days. Probability of any response: 58%."

---

**Round 39 -- The pipeline_metrics table will grow unboundedly and has no partitioning strategy.**

The metrics table stores multiple metrics per day, segmented by dimensions (track, source, state). With 12 metric types, 2 tracks, 6 sources, and 12 states, a single day could generate 100+ rows. Over 90 days (the daily retention period), this is 9,000+ rows. Add weekly summaries (52 weeks * 100+ metrics = 5,200+ rows) and monthly summaries, and the table will reach 15,000+ rows within a year. This is not a crisis on PostgreSQL, but the table has no partitioning, no archival strategy beyond the vague retention policy (Section 8.7), and no cleanup job specified. The retention policy says "daily snapshots: 90 days, then delete" but no workflow or cron job performs this deletion. The DELETE operation for expired metrics is not specified anywhere in the n8n workflows.

**Score: 6/10**

**Recommendations:**
1. Add a metric cleanup job to WF4-METRICS that deletes daily snapshots older than 90 days (after confirming weekly aggregates exist)
2. Partition pipeline_metrics by period_type or calculated_at if growth becomes a concern
3. Specify the aggregation logic explicitly: which daily metrics roll up to weekly, and how
4. Add row count monitoring to the health dashboard to catch unexpected growth

---

**Round 40 -- The benchmark targets (Section 8.8) are presented without sourcing or methodology.**

Section 8.8 provides benchmark targets (e.g., corporate response rate target > 40%, good = 25-40%, needs improvement < 25%). These are presented as facts but no source is cited. For a data-driven system, using unsourced benchmarks to generate "needs improvement" alerts is problematic. The candidate will see her 20% response rate flagged as "needs improvement" and may panic, when in reality 20% may be excellent for her specific circumstances (niche role, highly competitive market). The benchmarks are also static -- they do not adjust based on the candidate's actual experience. After 3 months of data, the system has enough history to generate personalized benchmarks ("your average response rate is 25%, this week you're at 20%, which is below YOUR average"). Personalized benchmarks are more actionable than generic industry estimates.

**Score: 5/10**

**Recommendations:**
1. Source the benchmark data or clearly label them as "estimated" benchmarks that will be replaced by personalized baselines
2. After 30 days of data, switch from external benchmarks to personalized trailing averages
3. Show both the benchmark and the candidate's personal trend so she can see progress regardless of absolute level
4. Allow the candidate to override benchmarks if she knows her market segment differs from the default

---

#### Persona 4 Summary: Data Engineer / Analytics Specialist

| Round | Concern | Score |
|-------|---------|-------|
| 31 | Response rate metric definition inconsistent across sections | 3/10 |
| 32 | pipeline_metrics table not traceable to source data, delete-and-recreate is lossy | 4/10 |
| 33 | Interview conversion rate calculation is logically flawed | 3/10 |
| 34 | Fixed 30-day metric windows inappropriate for academic pipeline | 4/10 |
| 35 | Source effectiveness metrics ignore confounding variables | 4/10 |
| 36 | Document performance metrics will lack statistical significance for months | 4/10 |
| 37 | Funnel metrics assume linear progression but applications skip stages | 4/10 |
| 38 | Median response time has survivorship bias from excluding ghosted | 4/10 |
| 39 | pipeline_metrics table has no cleanup job or partitioning | 6/10 |
| 40 | Benchmark targets unsourced and static | 5/10 |

**Average Score: 4.1/10**

**Top 3 Issues:**
1. Response rate metric has three different definitions across the PRD -- fundamental inconsistency that must be resolved before implementation
2. Interview conversion rate calculation uses wrong denominator and wrong state reference (current vs. historical)
3. Funnel metrics assume linear stage progression but the state machine allows stage skipping, making percentages misleading

---

### 18.5 Persona 5: Privacy & Compliance Officer

**Profile:** UK-qualified data protection specialist with CIPP/E certification, experienced in GDPR compliance for HR tech systems and recruitment platforms.

---

**Round 41 -- The "personal use exemption" claim for GDPR is legally shaky when third-party data is involved.**

Section 16.2 claims the candidate is "both the data controller and the data subject for her own personal data" and invokes the personal use exemption for GDPR. This exemption (Article 2(2)(c) GDPR, also known as the "household exemption") applies to processing "by a natural person in the course of a purely personal or household activity." This exemption is fragile here because the system processes significant third-party personal data: interviewer names and email addresses, referee names and contact details, recruiter names and contact information, and company employee data. The CJEU in Lindqvist (C-101/01) and Rynes (C-212/13) ruled that the household exemption does not apply when personal data is made accessible to an indefinite number of persons or when the processing has a professional character. A self-hosted database accessible via n8n workflows and API endpoints, with data shared with Resend and Anthropic APIs, arguably exceeds purely personal processing. The PRD should not rely on this exemption as the sole legal basis.

**Score: 4/10**

**Recommendations:**
1. Identify legitimate interest as the primary legal basis for processing third-party data, not the personal use exemption
2. Conduct a lightweight Legitimate Interest Assessment (LIA) documenting why processing is necessary, proportionate, and balanced
3. Add a Data Protection Impact Assessment (DPIA) section, even if brief, given the systematic monitoring of individuals' responses
4. Consider whether any third-party data subjects (interviewers, referees) should receive privacy notices

---

**Round 42 -- Referee personal data is stored with minimal justification and excessive detail.**

Section 6.10 stores referee names, organizations, relationships, email addresses, request dates, and response statuses. Section 12.6 (application_pre_employment) stores similar data in JSONB. This is third-party personal data that is more detailed than necessary for the candidate's tracking purpose. The candidate needs to know "2 of 2 references received" -- she does not necessarily need the system to store Prof. Jane Smith's email address permanently. The retention policy (Section 16.3) says pre-employment records are deleted after 6 months, but during those 6 months, referee personal data sits in a database that could be breached. The data minimization principle (GDPR Article 5(1)(c)) requires that personal data be "adequate, relevant and limited to what is necessary." Storing referee email addresses when the candidate already knows her referees is arguably excessive.

**Score: 5/10**

**Recommendations:**
1. Store referee data at the minimum level needed: name and status only, not email address or organization
2. If detailed referee data is needed temporarily (during active pre-employment checks), delete it within 30 days of completion, not 6 months
3. Add a consent or notification mechanism for referees whose data is being processed (even if only informational)
4. Encrypt referee JSONB fields at rest using Postgres column-level encryption

---

**Round 43 -- Email body content stored in application_events creates a large attack surface.**

Section 12.3 (application_events) stores email_from, email_subject, and email content within event_data JSONB. The retention policy (Section 16.3) keeps email bodies for 3 months. During those 3 months, the database contains the full text of employer correspondence, which may include: salary details, interviewer personal opinions in feedback emails, internal company information shared in interview preparation materials, and confidential offer terms. If the database is breached, this is far more sensitive than just application status data. The PRD's security model (Section 16.5) relies on "self-hosted database with TLS" and "n8n service account only" access, but does not mention database encryption at rest, audit logging of database access, or intrusion detection. For a system storing 3 months of employer email content, the security posture is insufficient.

**Score: 4/10**

**Recommendations:**
1. Reduce email body retention to 7 days -- just long enough to resolve matching issues, then delete
2. Extract and store only the structured data from emails (dates, names, classification), not the full body text
3. Enable PostgreSQL encryption at rest (pgcrypto or full disk encryption on the Hetzner server)
4. Add database access audit logging to detect unauthorized queries

---

**Round 44 -- The anonymisation routine is incomplete and reversible.**

Section 16.4 anonymises terminal applications by replacing company_name with "Company_" + first 8 characters of UUID. This is pseudonymisation, not anonymisation. The UUID is still in the id column, so the mapping can be trivially reversed by anyone with access to the database. True anonymisation would remove the ability to re-identify. Additionally, the anonymisation does not touch: job_title (which may identify the company -- "Head of L&D at the UK's largest retailer"), pipeline_track (if there is only one academic application to a specific company, the track alone may identify it), salary_offered_min/max (may be unique to a specific role), or discovery_source (combined with salary and track, may identify the role). The anonymisation also does not anonymise the application_events, application_documents, or application_interviews tables -- only the parent applications table. Event data may contain company names, job titles, and personal details in the JSONB fields.

**Score: 3/10**

**Recommendations:**
1. Use true anonymisation: generate random replacement values that cannot be mapped back, or aggregate data and delete individual records
2. Extend anonymisation to all child tables: application_events, application_documents, application_interviews, application_notes, follow_up_log
3. Anonymise or remove job_title, salary data, and any free-text fields that could identify the company
4. Test anonymisation by attempting re-identification on anonymised data to verify it is truly anonymous

---

**Round 45 -- The Claude API integration for strategic observations sends pipeline data to a third party with no DPA.**

Section 16.1 acknowledges that "job descriptions and application metrics are sent for LLM analysis" to Anthropic's Claude API and notes that "API inputs are not used for training." But there is no Data Processing Agreement (DPA) in place or referenced. Under UK GDPR, when personal data is processed by a third party (Anthropic, as a data processor), Article 28 requires a written contract that specifies the subject matter, duration, nature of processing, type of data, and obligations. The metrics JSON sent to Claude (Section 10.8) may contain company names, job titles, and application statistics that constitute personal data about the candidate's professional life. Even if Anthropic does not use the data for training, the data is transmitted, temporarily stored, and processed on Anthropic's infrastructure. The PRD does not assess whether the data sent to Claude constitutes personal data, whether a DPA is needed, or whether adequate safeguards exist for international data transfers (Anthropic is a US company).

**Score: 3/10**

**Recommendations:**
1. Assess whether the metrics JSON sent to Claude contains personal data (it likely does -- company names, job titles, and application volumes constitute a professional profile)
2. Execute a DPA with Anthropic covering the LLM API usage, or verify that Anthropic's standard API terms include Article 28-compliant processor obligations
3. Assess international transfer mechanisms: does Anthropic's API rely on SCCs, adequacy decisions, or Article 49 derogations?
4. Consider anonymising the metrics before sending to Claude (replace company names with generic labels)

---

**Round 46 -- The Resend API receives email content with no assessment of data processor obligations.**

Every notification email is sent via Resend (Section 16.1, Appendix F). These emails contain: company names, job titles, salary information, interview details, rejection reasons, and strategic observations about the candidate's job search. This is personal data being processed by Resend as a data processor. The PRD notes "Resend's privacy policy applies" but does not assess whether Resend's terms include UK GDPR-compliant data processor provisions. Resend is a US company, raising the same international transfer concerns as the Claude API. The email tags (Appendix F.2) include application_id, which is a pseudonymous identifier that could be used to reconstruct the candidate's pipeline from Resend's logs. The PRD does not specify whether Resend retains email content, for how long, or whether the candidate can request deletion from Resend's systems.

**Score: 4/10**

**Recommendations:**
1. Review Resend's DPA and data processing terms for UK GDPR compliance
2. Minimize personal data in email content: use generic references where possible and include detailed data as links to the self-hosted system rather than inline
3. Configure Resend to not retain email content beyond delivery (if their API supports this)
4. Ensure email tags do not contain directly identifying information

---

**Round 47 -- The webhook endpoints have no rate limiting, IP restriction, or request validation beyond bearer token.**

Section 16.5 states webhooks are "token-authenticated" with a bearer token. But there is no rate limiting, no IP allowlisting, no request body validation, and no HMAC signature verification. If the bearer token is compromised, an attacker can: create fake application records via /webhook/application-created, inject false status updates via /webhook/status-update (marking real applications as rejected or ghosted), and flood the notification queue with spam. n8n webhooks by default accept requests from any source. For a system that makes automated state transitions based on webhook input, this is a significant attack vector. The PRD does not address webhook security beyond the bearer token, and the token is stored as an environment variable (Section D.3) which may be visible in n8n's UI to anyone with admin access.

**Score: 3/10**

**Recommendations:**
1. Add rate limiting to webhook endpoints (max 10 requests per minute per endpoint)
2. Validate webhook request bodies against a JSON schema before processing
3. Add HMAC signature verification if Module 5 supports it (sign the webhook payload with a shared secret)
4. Implement IP allowlisting if all callers are from known infrastructure (same server, same Docker network)
5. Add request logging with alerting for unusual patterns (e.g., 50 status-update requests in a minute)

---

**Round 48 -- There is no right to erasure (GDPR Article 17) implementation for the candidate's own data.**

The PRD specifies anonymisation after 12 months (Section 16.4) and deletion of pre-employment records after 6 months, but does not provide a mechanism for the candidate to exercise her right to erasure on demand. If the candidate decides to delete all her data -- perhaps she has accepted a role and wants no record of her job search history -- there is no "delete everything" function. The database has foreign key constraints with ON DELETE CASCADE (which would help), but the system also stores data in: application_events (email content), pipeline_metrics (aggregated but potentially re-identifiable), notification_queue and notification_log, and potentially Resend's and Anthropic's systems. A proper right to erasure implementation would need to cascade deletion across all tables, confirm deletion from external processors (Resend, Anthropic), and provide confirmation to the data subject. Since the candidate is both controller and subject, this is less legally critical but still represents good data hygiene.

**Score: 5/10**

**Recommendations:**
1. Create a `delete_all_candidate_data()` function that cascades across all Module 4 tables
2. Document what data cannot be deleted from external processors (Resend logs, Anthropic API logs) and the retention periods of those processors
3. Add a "nuclear option" configuration that wipes all Module 4 data when the job search is complete
4. Test the deletion function to ensure no orphaned records remain

---

**Round 49 -- DBS check status is sensitive personal data requiring enhanced protection.**

Section 6.10 and Section 12.6 track DBS check status including type (basic, enhanced, enhanced with barring) and status (cleared, issues_found). Under UK GDPR, criminal record data is "special category" data under Article 9 (when it relates to criminal convictions and offences, Article 10 applies). The `issues_found` status implies the DBS check revealed something -- storing this in a general-purpose database table alongside job applications, without special category data protections, is non-compliant. Special category data requires: explicit consent or substantial public interest processing condition, additional safeguards (encryption, access controls), a specific retention period, and documentation of the processing condition. The PRD treats DBS status as just another field in the pre-employment table, with no enhanced protections.

**Score: 3/10**

**Recommendations:**
1. Separate DBS check data into its own encrypted table or encrypted JSONB field
2. Store only the minimum: "DBS required: yes/no, DBS status: pending/cleared" -- do NOT store "issues_found" detail in the system
3. Add a specific lawful basis note for processing DBS data (the candidate's own consent as data subject)
4. Set DBS data retention to the minimum necessary: delete immediately upon job search completion or 30 days after pre-employment completion, whichever is sooner

---

**Round 50 -- No data breach notification procedure is defined.**

The system stores personal data (candidate's professional profile, third-party referee and interviewer data, salary information, DBS status) on a self-hosted server. If the Hetzner server is compromised, there is no data breach procedure defined. Under UK GDPR Article 33, a personal data breach must be reported to the ICO within 72 hours if it "is likely to result in a risk to the rights and freedoms of natural persons." Even though the candidate is a sole user, if the breach exposes third-party data (referee emails, interviewer details, company-confidential salary offers), notification obligations may apply. The PRD has no incident response plan, no breach assessment framework, no notification template, and no documentation of what data is at risk in a breach scenario. For a system running on shared infrastructure without dedicated security monitoring, this is a meaningful gap.

**Score: 4/10**

**Recommendations:**
1. Document a basic breach response procedure: detection, assessment, containment, notification
2. Classify the data stored by sensitivity level to enable rapid breach impact assessment
3. Implement basic intrusion detection: monitor for unusual database access patterns, failed login attempts, unexpected n8n workflow executions
4. Set up automated alerts for: server SSH access, database connection from unknown sources, n8n admin login from new IP

---

#### Persona 5 Summary: Privacy & Compliance Officer

| Round | Concern | Score |
|-------|---------|-------|
| 41 | Personal use exemption legally questionable for third-party data | 4/10 |
| 42 | Referee data stored with excessive detail | 5/10 |
| 43 | Email body content in events creates large attack surface | 4/10 |
| 44 | Anonymisation is incomplete and reversible (pseudonymisation) | 3/10 |
| 45 | Claude API integration lacks DPA and transfer assessment | 3/10 |
| 46 | Resend API data processor obligations not assessed | 4/10 |
| 47 | Webhook endpoints lack rate limiting and proper security | 3/10 |
| 48 | No right to erasure implementation | 5/10 |
| 49 | DBS check data is special category data with inadequate protection | 3/10 |
| 50 | No data breach notification procedure | 4/10 |

**Average Score: 3.8/10**

**Top 3 Issues:**
1. DBS check status is special category data stored without enhanced protections -- this is a compliance violation
2. Anonymisation is actually pseudonymisation and does not extend to child tables -- data can be re-identified
3. Neither Claude API nor Resend API integrations have Data Processing Agreements or international transfer assessments

---

### 18.6 Overall Evaluation Summary

#### Persona Average Scores

| Persona | Average Score | Verdict |
|---------|--------------|---------|
| 1. The Candidate (Selvi) | 4.1/10 | The system tracks well but provides poor day-to-day UX and no emotional intelligence |
| 2. Technical Architect / n8n Expert | 4.3/10 | Solid state machine design but schema gaps, concurrency issues, and n8n pattern mismatches |
| 3. UK Career Coach / Recruitment Expert | 4.4/10 | Good UK hiring awareness but critical gaps in agency handling, academic states, and speculative apps |
| 4. Data Engineer / Analytics Specialist | 4.1/10 | Metrics framework exists but definitions are inconsistent and calculations are flawed |
| 5. Privacy & Compliance Officer | 3.8/10 | Compliance posture is superficial; special category data and processor obligations not addressed |

**Overall Average: 4.1/10**

---

#### Top 10 Must Fix (Before Implementation)

| # | Issue | Persona | Round | Score |
|---|-------|---------|-------|-------|
| 1 | Response rate metric has 3 different definitions across sections | Data Engineer | 31 | 3/10 |
| 2 | Academic longlisted/shortlisted states conflict with pre-app "shortlisted" naming | Career Coach | 23 | 3/10 |
| 3 | Schema section missing notification_queue, notification_log tables | Tech Architect | 15 | 3/10 |
| 4 | No on-demand pipeline query mechanism (email-only interaction) | Candidate | 2 | 3/10 |
| 5 | Speculative applications cannot be tracked (job_id NOT NULL) | Career Coach | 29 | 3/10 |
| 6 | DBS check data is special category data with no enhanced protections | Privacy Officer | 49 | 3/10 |
| 7 | Anonymisation is reversible pseudonymisation, does not cover child tables | Privacy Officer | 44 | 3/10 |
| 8 | Webhook endpoints lack rate limiting, IP restriction, and validation | Privacy Officer | 47 | 3/10 |
| 9 | Interview conversion rate calculation uses wrong denominator and state reference | Data Engineer | 33 | 3/10 |
| 10 | Recruitment agency intermediary layer missing (30-40% of senior UK roles) | Career Coach | 21 | 3/10 |

#### Top 10 Should Fix (Before or Shortly After Launch)

| # | Issue | Persona | Round | Score |
|---|-------|---------|-------|-------|
| 1 | No pause/vacation mode for the pipeline | Candidate | 7 | 3/10 |
| 2 | Claude API and Resend API lack DPAs and transfer assessments | Privacy Officer | 45, 46 | 3-4/10 |
| 3 | No deduplication between cron and webhook triggers on WF4-STATUS | Tech Architect | 12 | 4/10 |
| 4 | UNIQUE constraint on job_id prevents clean re-applications | Tech Architect | 20 | 4/10 |
| 5 | Email matching has no learning/feedback loop | Tech Architect | 13 | 4/10 |
| 6 | Academic ghosting thresholds still too aggressive (56 days vs reality of 84+) | Career Coach | 24 | 4/10 |
| 7 | Follow-up templates too generic, do not use available tailoring data | Candidate | 5 | 4/10 |
| 8 | Emotional handling of rejection notifications is clinical and demoralizing | Candidate | 6 | 4/10 |
| 9 | Funnel metrics assume linear progression but apps skip stages | Data Engineer | 37 | 4/10 |
| 10 | Email body content in events creates large unencrypted attack surface | Privacy Officer | 43 | 4/10 |

#### Top 5 Nice-to-Have (Post-Launch Enhancements)

| # | Issue | Persona | Round | Score |
|---|-------|---------|-------|-------|
| 1 | Structured compensation fields for UK salary comparison (pension, benefits) | Candidate | 8 | 4/10 |
| 2 | Interview prep brief auto-generation from available data | Candidate | 9 | 4/10 |
| 3 | Competency framework tracking for UK corporate interviews | Career Coach | 27 | 5/10 |
| 4 | Track-specific metric windows (30d corporate, 90d academic) | Data Engineer | 34 | 4/10 |
| 5 | Interview travel/expense tracking for academic interviews | Career Coach | 30 | 6/10 |

---

*End of 50-Round Critical Roleplay Evaluation (v1)*

---

## 19. Fixes Applied Log

**v2 Fixes Applied (2026-03-29)** -- Changes made to address v1 evaluation findings (overall v1 score: 4.1/10).

| # | v1 Round | v1 Issue | Fix Applied | Sections Changed |
|---|----------|----------|-------------|-----------------|
| 1 | R23 (3/10) | Academic longlisted/shortlisted conflict with pre-app "shortlisted" | Added `academic_longlisted` and `academic_shortlisted` as distinct states in state machine. Pre-app `shortlisted` retained with v2 Note clarifying disambiguation. | 6.2, 6.3, 6.4, 6.6, 12.2 |
| 2 | R2 (3/10) | No on-demand pipeline query (email-only) | Added Method 4: On-Demand Pipeline Query via QUERY email command with response within 5 minutes. | 7.5 |
| 3 | R13 (4/10) | Email matching has no learning loop | Added `sender_company_mappings` table, pre-check in matching algorithm, learning loop from manual corrections. | 7.3, 12.12 |
| 4 | R21 (3/10) | Recruitment agency layer missing | Added ATS platform detection, agency-aware matching, `recruitment_agency`/`recruiter_name`/`recruiter_email` fields. | 7.3, 12.2 |
| 5 | R15 (3/10) | Schema missing notification_queue, notification_log | Added `notification_queue` (12.10), `notification_log` (12.11), `sender_company_mappings` (12.12) to schema section. Updated table count to 12. | 12.10, 12.11, 12.12, 12.13 |
| 6 | R29 (3/10) | job_id NOT NULL prevents speculative applications | Made `job_id` nullable with comment explaining speculative application support. | 12.2 |
| 7 | R20 (4/10) | UNIQUE constraint on job_id prevents re-applications | Changed to `UNIQUE(job_id, application_attempt)`, added `application_attempt` and `previous_application_id`. | 12.2 |
| 8 | R31 (3/10) | Response rate metric has 3 different definitions | Added Metrics Glossary (Section 8.9) as canonical source. Updated Section 3.3 and 8.2 to reference glossary. | 3.3, 8.2, 8.6, 8.9 |
| 9 | R33 (3/10) | Interview conversion rate uses wrong denominator | Fixed to use `highest_state_reached`, exclude ghosted/expired from denominator. Added `highest_state_reached` column. | 8.6, 8.9, 12.2 |
| 10 | R34 (4/10) | Fixed 30-day metric windows wrong for academic | Added track-specific windows: 30d corporate, 90d academic in metric queries. | 8.6 |
| 11 | R37 (4/10) | Funnel assumes linear progression | Changed funnel to use `highest_state_reached`, reports "reached this stage or beyond". | 8.9 |
| 12 | R38 (4/10) | Median response time survivorship bias | Labelled as "responding employers only", added note about showing alongside probability-of-response. | 8.9 |
| 13 | R36 (4/10) | Document metrics lack statistical significance | Added Minimum Sample Size Policy (Section 8.10). | 8.10 |
| 14 | R49 (3/10) | DBS data is special category with no protections | Removed `issues_found` status. System stores only pending/cleared. Added Article 10 note, 30-day retention, explicit consent basis. | 12.6 |
| 15 | R44 (3/10) | Anonymisation reversible, does not cover child tables | Changed to true anonymisation with random hex labels. Extended to application_events, application_documents, application_interviews, application_notes, follow_up_log. | 16.4 |
| 16 | R47 (3/10) | Webhook endpoints lack security beyond bearer token | Added HMAC signature verification, rate limiting, IP allowlisting, request body validation, request logging. | 16.5.1 |
| 17 | R48 (5/10) | No right to erasure implementation | Added `delete_all_candidate_data()` function with cascading deletion. | 16.4.1 |
| 18 | R8 (4/10) | Salary tracking too superficial | Added structured `compensation` JSONB field with pension, bonus, car allowance, pay grade, spine point, etc. | 12.2 |
| 19 | R42 (5/10) | Referee data stored with excessive detail | Minimised to name and status only. Email/org details deleted within 30 days. | 12.6 |
| 20 | R43 (4/10) | Email body content 3-month retention too long | Reduced to 7 days. Structured data extraction retained, full body deleted. | 16.4 |

**v1 Issues Not Fixed in v2 (deferred or design decisions):**

| v1 Round | Issue | Status | Rationale |
|----------|-------|--------|-----------|
| R1 (5/10) | Weekly report anxiety/timing | Deferred | Configurable report tone is a post-launch enhancement. Sunday 7PM timing retained. |
| R3 (5/10) | Daily check-in alert fatigue | Deferred | Will tune frequency post-launch based on candidate feedback. |
| R4 (5/10) | Snooze too simplistic | Deferred | Custom date snooze is a post-launch enhancement. |
| R5 (4/10) | Follow-up templates too generic | Deferred | LLM-personalised follow-ups planned for v1.1. |
| R6 (4/10) | Rejection emotional handling | Deferred | Batch rejection digest is a post-launch enhancement. |
| R7 (3/10) | No pause/vacation mode | Deferred | Will add global pause config before launch if time allows. |
| R9 (4/10) | No interview prep support | Deferred | AI Interview Coach is a planned future module. |
| R10 (4/10) | Post-offer experience underdeveloped | Deferred | Pre-employment checklist improvements planned for v1.1. |
| R11 (5/10) | State machine CASE runs separate UPDATEs | Acknowledged | PL/pgSQL runs in single transaction; consolidation is optimisation not correctness fix. |
| R12 (4/10) | No deduplication cron vs. webhook | Deferred | Idempotency key is planned for Phase 2 implementation. |
| R14 (4/10) | Error handling references undefined WF0 | Deferred | WF0 will be specified in Module 1 PRD; cross-referenced here. |
| R16 (4/10) | No workflow versioning | Deferred | Operational concern, will establish git export workflow during Phase 1. |
| R17 (6/10) | Generated column is_active query planning | Accepted | Performance acceptable at expected scale; will revisit if needed. |
| R18 (4/10) | No resource isolation | Deferred | n8n concurrency settings will be configured during deployment. |
| R19 (5/10) | SplitInBatches size 1 bottleneck | Deferred | Performance tuning during Phase 2. |
| R22 (5/10) | Applied state too broad | Design decision | Sub-states add complexity; v1 keeps Applied as monolithic, may refine post-launch. |
| R24 (4/10) | Academic ghost threshold too aggressive | Partially addressed | 56 days retained as configurable default; can be tuned via pipeline_track_config. |
| R25 (4/10) | No networking/warm leads pipeline | Deferred | Out of scope for v1; candidate can use notes field. |
| R26 (6/10) | RTW oversimplified | Accepted | Candidate has unrestricted UK work rights; extensible if needed. |
| R27 (5/10) | No competency framework tracking | Deferred | Post-launch enhancement. |
| R28 (5/10) | Informal chat not properly handled | Deferred | informal_chat interview type exists; dedicated state is post-launch. |
| R30 (6/10) | No interview travel/expense tracking | Deferred | Post-launch enhancement. |
| R32 (4/10) | pipeline_metrics not traceable to source | Deferred | Will add source_record_count in v1.1. |
| R35 (4/10) | Source metrics ignore confounding variables | Acknowledged | Documented as limitation; cross-tabulation with tier planned for v1.1. |
| R39 (6/10) | pipeline_metrics no cleanup job | Deferred | Will add cleanup to WF4-METRICS during Phase 4. |
| R40 (5/10) | Benchmark targets unsourced | Partially addressed | Added note about switching to personalised baselines after 30 days (Section 8.10). |
| R41 (4/10) | Personal use exemption legally shaky | Acknowledged | Legitimate interest noted as alternative basis for third-party data (Section 16.2). |
| R45 (3/10) | Claude API lacks DPA | Deferred | Will review Anthropic API terms during deployment. |
| R46 (4/10) | Resend API processor obligations | Deferred | Will review Resend DPA during deployment. |
| R50 (4/10) | No data breach procedure | Deferred | Operational concern; will document during deployment. |

---

## 20. 50-Round Critical Roleplay Evaluation (v2)

**Date:** 2026-03-29
**Methodology:** 5 expert personas, 10 rounds each, scoring 1-10 per concern. Focus on fix quality, remaining gaps, and new issues.
**v1 Overall Score:** 4.1/10
**Fixes Applied:** 20 fixes addressing 20 of the 50 v1 findings.

---

### 20.1 Persona 1: The Candidate (Selvi)

**Profile:** PhD + MBA, 18 years HR/L&D experience, dual-track UK job seeker (corporate L&D + academic lecturer). The actual end user of this system.

---

**Round 1 -- The on-demand pipeline query (v2 fix for R2) is better than nothing, but email-based querying is awkward for a 50-application pipeline.**

v2 added Method 4 (Section 7.5): send "QUERY BigBank" or "QUERY all active" and receive a response within 5 minutes. This addresses the original complaint that there was zero on-demand visibility. But the interaction model is still email-round-trip. Composing an email, waiting 5 minutes, receiving a text-heavy response, and parsing it to find one application's status is a poor substitute for a searchable list. The query types are helpful (single company, all active, interviews, track filter), but there is no way to ask follow-up questions without sending another email. If the candidate wants to compare three applications at similar companies, that is three separate emails and 15 minutes of waiting. The 5-minute SLA also means this is not useful during a phone call with a recruiter who asks "What stage are you at with our other posting?" The PRD could have specified a simpler mechanism -- a daily-generated static HTML dashboard pushed to a private URL on the existing Dokploy server, which would take minimal engineering effort and provide instant access.

**Score: 5/10** (up from 3/10 -- meaningful improvement but still clunky)

**Remaining gap:** No instant-access pipeline view. A daily-generated static HTML page at a private URL would solve this with minimal engineering effort.

---

**Round 2 -- The "wins this week" section is still missing from the weekly report, and Sunday 7PM timing is still unchanged.**

v1 Round 1 flagged that the weekly report leads with action items, rejection counts, and ghosting stats -- anxiety-inducing content at Sunday evening. v2 did not change the report structure (Section 10) or the timing. The Fixes Applied Log marks this as "deferred." The sample report (Appendix H) still leads with "[CRITICAL] Interview" and "[MEDIUM] Follow-up due" before showing any positive news. The strategic observations section is still instructed to "not be encouraging or motivational." For a system whose stated purpose is to reduce "persistent background anxiety" (Section 2.2), the report design actively works against that goal. The fix is trivial: add a "This week's wins" section at the top (interviews secured, positive responses, progress on active applications) and make the send time configurable.

**Score: 5/10** (unchanged from v1 -- no fix applied)

**Remaining gap:** Report structure and timing unchanged. A "wins" section and configurable send time would cost minimal development effort.

---

**Round 3 -- No pause/vacation mode remains a serious gap, and the deferred status is concerning.**

v1 Round 7 scored this 3/10. v2 marks it "deferred -- will add global pause config before launch if time allows." The "if time allows" qualifier is troubling. Without a pause mode, the first time the candidate takes a week off, WF4-GHOST will mark multiple applications as ghosted, WF4-NOTIFY will send daily check-ins to an empty inbox, and the weekly report will show deteriorating metrics. When she returns, she will need to manually re-open ghosted applications and reset timers. The fix is straightforward: a single `m4_pipeline_paused` config flag that WF4-GHOST and WF4-NOTIFY check at the start of execution. If true, skip processing and log "pipeline paused." Resume by setting the flag to false and running a one-time threshold recalculation. This is a 1-hour implementation task that should not be deferred.

**Score: 4/10** (marginal improvement from 3/10 -- acknowledged but still not implemented)

**Remaining gap:** This is a must-fix for launch, not a "nice-to-have." Even a boolean config flag would suffice.

---

**Round 4 -- The structured compensation field (v2 fix for R8) is well designed but has no comparison mechanism.**

v2 added a `compensation` JSONB field (Section 12.2) with base_salary, bonus_pct, pension_employer_pct, pension_scheme, car_allowance, pay_grade, spine_point, notice_period_weeks, probation_months, and total_compensation_estimate. This is a substantial improvement over the v1 flat integers. However, there is no workflow or query that uses this data for comparison. When the candidate has two offers -- one corporate at GBP 78k with 8% employer pension, one academic at Grade 8 spine 38 with USS (21.6% employer) -- the data is stored but nothing helps her compare them. The total_compensation_estimate field exists but no calculation logic is specified. Who populates it -- the candidate manually, or does the system calculate it? If calculated, what formula is used? USS pension and a private pension with 8% match are very different in real value. The field exists but is inert.

**Score: 6/10** (up from 4/10 -- data model is good, utility is not yet there)

**Remaining gap:** Needs a total compensation calculation function and an offer comparison query or template for the weekly report when multiple offers are active.

---

**Round 5 -- Rejection notifications are still clinical and individual -- no batching or reframing was implemented.**

v1 Round 6 flagged that receiving five "REJECTED" notifications in one day is demoralising. v2 deferred this entirely. The notification template (Section 9.7) still shows a strikethrough of the old state with a bold new state. Rejection is still classified at the same priority as any other status change (High priority, immediate delivery). There is no rejection batching, no constructive reframing, and no analysis of rejection patterns in the notification itself. The weekly report still shows "2 rejections received" as a bare count with company names. The system treats the candidate as a pure data consumer with no emotional needs. For the most emotionally charged event in a job search, the system does the minimum possible.

**Score: 4/10** (unchanged from v1 -- no fix applied)

**Remaining gap:** Batch rejections into daily digest. Use "application closed" language. Include pattern analysis ("2 of 3 cited internal candidates -- not about your qualifications").

---

**Round 6 -- The follow-up templates remain generic despite the system now having a learning loop.**

v2 added a sender_company_mappings learning loop for email matching (good), but did not apply any learning or personalisation to follow-up email templates. The templates (Section 9.5) are unchanged from v1 -- boilerplate "I remain very interested" text. The system now stores structured compensation data, detailed job descriptions (via Module 1), tailored CV content (via Module 2), and company context. None of this is used to generate personalised follow-ups. Claude Haiku is used for weekly strategic observations but not for the higher-value task of crafting context-aware follow-up suggestions. A follow-up that references a specific company initiative or recent announcement would substantially outperform the template.

**Score: 4/10** (unchanged from v1 -- no fix applied)

**Remaining gap:** Use Claude to generate personalised follow-ups using job description, CV tailoring notes, and company context.

---

**Round 7 -- The snooze mechanism still offers only 3d/1w/2w with no custom date option.**

v1 Round 4 flagged this. v2 deferred it. Section 9.3 still lists the same three fixed intervals. US-408 (set a specific follow-up date) is in the user stories but the snooze implementation in the notification engine does not support it. If the candidate has an academic interview and is told "the committee meets on May 15," she cannot snooze until May 16. She must choose between "2 weeks" (too early) and manually ignoring the notification. The applications table has `follow_up_snoozed_until` (TIMESTAMPTZ) which could accept any date, but the notification engine only offers the three fixed intervals. The data model supports the fix; the UX does not expose it.

**Score: 5/10** (unchanged from v1 -- no fix applied)

**Remaining gap:** The data model already supports custom dates. Expose it: "Reply with SNOOZE [date]" in notification emails.

---

**Round 8 -- The daily check-in frequency is still every weekday with no intelligence about when updates are likely.**

v1 Round 3 flagged alert fatigue from daily "Any updates?" emails. v2 deferred this. The check-in still sends every weekday when active applications exist. With 20+ active applications (most in early "applied" or "acknowledged" states where updates are unlikely on any given day), this means 5 ignorable emails per week. The system has enough data to be smarter: only send check-ins on days when applications are in states where updates are plausible (post-interview, post-screening, past follow-up threshold). An application that was submitted 2 days ago to a corporate role will not have an update -- do not ask about it.

**Score: 5/10** (unchanged from v1 -- no fix applied)

**Remaining gap:** Make check-in frequency configurable. Default to sending only when applications are in "response expected" states.

---

**Round 9 -- The QUERY command response format is unspecified -- what does the candidate actually receive?**

Section 7.5 Method 4 says QUERY responses are sent "within 5 minutes" and describes what data is included (company, role, state, timeline, documents for single-company queries; summary table for "all active"). But the actual response format is not specified. Is it plain text, HTML table, or a mini-report? For "all active" with 25 applications, a plain-text email listing all 25 would be overwhelming. For a single-company query, the response could be a tidy summary or a wall of text. The PRD specifies detailed HTML templates for status change notifications and the weekly report, but gives the QUERY response no template at all. This is the most interactive part of the system -- the one place where the candidate explicitly asks for information -- and its response format is undefined.

**Score: 5/10** (new issue -- not in v1)

**Remaining gap:** Specify QUERY response templates for each query type. Use the same visual style as weekly report sections. Keep "all active" response concise (table format, one line per application).

---

**Round 10 -- The system stores interview preparation_notes from email extraction but has no mechanism to surface them at the right time.**

Section 6.9 stores preparation_notes, presentation_topic, documents_to_bring, and interviewer names. Section 9.2 sends an "Interview Scheduled" notification immediately upon detection. But there is no pre-interview reminder that resurfaces this information. If an interview is scheduled 10 days out, the candidate receives the notification on day 1 and must remember or search her email to find the details on day 10. The weekly report shows upcoming interviews with prep notes, but if the interview is on a Thursday and the weekly report is on Sunday, the candidate gets the information 4 days early with no day-of reminder. A "24 hours before interview" reminder that includes full interview details, prep notes, the CV that was sent, and key job description highlights would be far more useful than the initial scheduling notification.

**Score: 5/10** (partially new issue -- related to v1 R9 but specifically about timing of existing data surfacing)

**Remaining gap:** Add a 24-hour pre-interview reminder notification type that combines interview details, CV version sent, and job description highlights.

---

#### Persona 1 Summary (v2): The Candidate (Selvi)

| Round | Concern | v1 Score | v2 Score | Delta |
|-------|---------|----------|----------|-------|
| 1 | On-demand query is email-based, no instant access | 3/10 | 5/10 | +2 |
| 2 | Weekly report still anxiety-inducing, no timing fix | 5/10 | 5/10 | 0 |
| 3 | No pause/vacation mode | 3/10 | 4/10 | +1 |
| 4 | Structured compensation good, no comparison mechanism | 4/10 | 6/10 | +2 |
| 5 | Rejection notifications still clinical | 4/10 | 4/10 | 0 |
| 6 | Follow-up templates still generic | 4/10 | 4/10 | 0 |
| 7 | Snooze still 3d/1w/2w only | 5/10 | 5/10 | 0 |
| 8 | Daily check-in still every weekday | 5/10 | 5/10 | 0 |
| 9 | QUERY response format unspecified (new) | -- | 5/10 | new |
| 10 | Interview prep data not surfaced at right time (new) | -- | 5/10 | new |

**v2 Average: 4.8/10** (up from 4.1/10)

**Assessment:** The fixes that were applied (on-demand query, structured compensation) genuinely improved the PRD. But 6 of the 10 original candidate concerns were deferred entirely. The UX remains email-centric with no instant access, no emotional intelligence, and limited interactivity. The improvement is real but modest.

---

### 20.2 Persona 2: Technical Architect / n8n Expert

**Profile:** Senior platform engineer with deep n8n experience, PostgreSQL expertise, and distributed systems knowledge.

---

**Round 11 -- The sender_company_mappings learning loop (v2 fix for R13) is well designed but has a cold-start problem.**

v2 added a `sender_company_mappings` table and a pre-check in the matching algorithm (Section 7.3, step 0). When the candidate manually assigns an unmatched email, the sender-company mapping is stored for future use. This is a solid fix. The cold-start problem: the table starts empty. For the first 2-4 weeks of operation, every ATS platform email, every agency email, and every non-obvious sender will fail matching and require manual assignment. The candidate will receive a flood of "we received an email that may be job-related, please review" notifications. The system should be seeded with known ATS platform domains (workday.com, icims.com, greenhouse.io, taleo.net, successfactors.com) and known UK recruitment agency domains (hays.com, michaelpage.com, robertwalters.com). Step 1a in the algorithm lists these ATS platforms, but they are handled in code rather than in the mappings table. Moving them to the table would make them maintainable without code changes.

**Score: 6/10** (up from 4/10 -- learning loop is good, needs seeding)

**Remaining gap:** Seed sender_company_mappings with known ATS platform and UK recruitment agency domains at deployment. Make ATS/agency detection table-driven rather than hard-coded in algorithm step 1a/1b.

---

**Round 12 -- The duplicate notification_queue table definition (Sections 12.10 and 13.6) creates a maintenance risk.**

v2 fixed the missing notification_queue by adding it to Section 12.10. But the identical table definition still appears in Section 13.6 (the original location from v1). This means the notification_queue schema is defined in two places. If a column is added or modified in one location but not the other, the PRD contradicts itself. The same issue exists for no other table. The Section 13.6 definition should be removed or replaced with a reference: "See Section 12.10 for the notification_queue schema."

**Score: 6/10** (up from 3/10 -- table now exists in schema, but duplication is a maintenance issue)

**Remaining gap:** Remove the duplicate notification_queue DDL from Section 13.6 and replace with a cross-reference to Section 12.10.

---

**Round 13 -- The highest_state_reached column (v2 fix for R33/R37) is added to the schema but its update logic is not specified.**

v2 added `highest_state_reached VARCHAR(30)` to the applications table (Section 12.2) and uses it in metric queries (Section 8.6, 8.9). But there is no trigger, function, or workflow that populates this column. The `transition_application_state()` function (Section 6.6) updates `current_state` and `previous_state` but does not update `highest_state_reached`. For the column to be accurate, a comparison must be made on every state transition: if the new state's ordinal position is higher than the current `highest_state_reached`, update it. But what is the ordinal ordering? The state machine is not strictly linear (academic track has different paths, stages can be skipped). Without a defined state ordering and update logic, the column will remain NULL or incorrect, and all metrics that depend on it (response rate, interview conversion, funnel) will produce wrong results.

**Score: 5/10** (new issue introduced by v2 fix -- the column exists but is never populated)

**Remaining gap:** Add `highest_state_reached` update logic to `transition_application_state()`. Define a state ordinal mapping for comparison purposes. Handle non-linear paths (academic longlisted/shortlisted should rank between acknowledged and interviewing).

---

**Round 14 -- The deduplication problem between cron and webhook (v1 R12) is still unaddressed.**

v1 flagged that WF4-STATUS runs every 30 minutes via cron AND accepts webhooks from Module 5. Same email event can be processed twice. v2 marks this as "deferred -- idempotency key planned for Phase 2." The risk is real: during the first weeks of operation, Module 5 will send webhooks for every parsed email while the cron simultaneously polls the same email_updates table. Without atomic claim-and-process (e.g., `UPDATE email_updates SET processed = true WHERE processed = false AND id = X RETURNING *`), duplicates will occur. The state machine will reject invalid duplicate transitions, but the system will still run the matching algorithm twice, log spurious invalid-transition events, and potentially send duplicate notifications. The fix is a 15-minute SQL change (add `processing_started_at` column and use SELECT FOR UPDATE SKIP LOCKED).

**Score: 4/10** (unchanged from v1 -- acknowledged but not fixed)

**Remaining gap:** This should be fixed before Phase 2 deployment, not during it. The atomic claim pattern is trivial to implement.

---

**Round 15 -- The HMAC webhook security (v2 fix for R47) has an implementation flaw in the verification code.**

v2 added HMAC signature verification (Section 16.5.1). The verification code compares `$input.first().headers['x-webhook-signature']` against an expected HMAC of `JSON.stringify($input.first().json)`. The problem: JSON.stringify is not deterministic. If the sender serialises the payload with keys in one order and the receiver re-serialises with keys in a different order (which JSON.stringify can do depending on the JavaScript engine and object construction order), the HMACs will not match. The correct approach is to HMAC the raw request body bytes, not a re-serialised JSON object. In n8n, the raw body is accessible via `$input.first().binary` or through the request object, not through `JSON.stringify` of the parsed JSON. Additionally, the comparison uses `!==` (string equality) rather than `crypto.timingSafeEqual()`, which is vulnerable to timing attacks.

**Score: 6/10** (up from 3/10 -- security controls exist but implementation has a correctness issue)

**Remaining gap:** HMAC should be computed over raw request body bytes, not re-serialised JSON. Use `crypto.timingSafeEqual()` for comparison. Verify n8n provides access to raw body in the webhook trigger node.

---

**Round 16 -- The state machine function still runs timestamp updates as separate CASE-based UPDATEs within the same PL/pgSQL block.**

v1 Round 11 noted that the transition function runs the state change UPDATE followed by a CASE block with separate UPDATE statements for stage timestamps. v2 marked this as "acknowledged -- PL/pgSQL runs in single transaction; consolidation is optimisation not correctness fix." This is technically correct -- PL/pgSQL does run atomically. However, the CASE block (Section 6.6, lines starting "CASE p_new_state") does not handle `academic_longlisted` or `academic_shortlisted` -- two states added in v2. When an application transitions to `academic_longlisted`, no timestamp column is updated because the CASE has no WHEN clause for it. The applications table has `academic_longlisted_at` and `academic_shortlisted_at` columns (Section 12.2), but the transition function does not populate them. This is a bug introduced by the v2 state machine expansion -- the CASE was not updated to match the new states.

**Score: 5/10** (was 5/10 in v1 -- now has a v2-introduced bug in addition to the original design concern)

**Remaining gap:** Add WHEN clauses for `academic_longlisted` and `academic_shortlisted` in the state transition function's CASE block. Also add `pre_employment` WHEN clause (missing for the same reason).

---

**Round 17 -- The application creation trigger (Section 14.1) uses a subquery for discovery_source that may return inconsistent results.**

The `auto_create_application()` trigger (Section 14.1) inserts a new application with `discovery_source` set to `(SELECT source FROM job_sources WHERE job_id = NEW.id LIMIT 1)`. This subquery has two problems. First, `LIMIT 1` without `ORDER BY` returns an arbitrary row -- if a job has multiple sources (posted on both Reed and Indeed), the selected source is non-deterministic. Second, the subquery runs in the trigger context, which may not see uncommitted rows in `job_sources` if they were inserted in the same transaction as the `jobs` update. The `discovery_source` field drives source effectiveness metrics, so getting it wrong is not just an aesthetic issue -- it corrupts analytics. The trigger should either select the primary source (earliest, or highest-priority) deterministically, or store all sources and let the metrics engine handle multi-source attribution.

**Score: 5/10** (new issue -- not flagged in v1)

**Remaining gap:** Add `ORDER BY created_at ASC` to the discovery_source subquery. Consider storing all sources as an array rather than picking one.

---

**Round 18 -- The IP allowlisting for webhooks (v2 fix) specifies Docker network ranges but not the actual n8n-to-Postgres communication path.**

Section 16.5.1 specifies IP allowlisting: "Accept only from localhost/Docker network (172.16.0.0/12, 127.0.0.1) since all callers are on the same server." This is correct for inter-module webhook calls. But the rate limiting implementation says "implemented via n8n Code node counter + Redis/Postgres." There is no Redis in the technology stack (Section 5.4). Using Postgres for rate limiting adds a database query to every webhook request, which is the opposite of protection against abuse -- a flood of webhook requests would also flood the database with rate-limit check queries. A simpler approach: n8n has a built-in "Respond to Webhook" node that can return 429 based on in-memory counters, or use n8n's built-in rate limiting features if available in the self-hosted version.

**Score: 6/10** (up from 3/10 -- security controls exist, implementation details need refinement)

**Remaining gap:** Remove Redis reference (not in stack). Use in-memory rate limiting in the n8n Code node rather than Postgres queries. Specify the actual rate limit implementation concretely.

---

**Round 19 -- The sync_application_state_to_jobs trigger (Section 12.14) fires on every applications INSERT/UPDATE but the jobs table may not have a corresponding row for speculative applications.**

v2 made `job_id` nullable to support speculative applications. But the `sync_application_state_to_jobs()` trigger (Section 12.14) runs `UPDATE jobs SET application_state = NEW.current_state WHERE id = NEW.job_id` on every INSERT or UPDATE of the applications table. When `job_id` is NULL (speculative application), this executes `UPDATE jobs SET ... WHERE id = NULL`, which updates zero rows. This is harmless but wasteful. More importantly, if a speculative application is later linked to a real job (when the job gets posted formally), the trigger will not retroactively update the jobs table with the application's current state because the trigger fires on INSERT/UPDATE of applications, not on UPDATE of job_id. The trigger needs a NULL check and handling for late job_id assignment.

**Score: 6/10** (new issue introduced by v2 fix for speculative applications)

**Remaining gap:** Add `IF NEW.job_id IS NOT NULL THEN` guard to the sync trigger. Add logic to handle job_id being set after initial creation (late linking).

---

**Round 20 -- The email_updates table referenced by WF4-STATUS is still not defined in any Module 4 schema.**

v1 Round 15 flagged that the schema section was incomplete. v2 added notification_queue, notification_log, and sender_company_mappings. But `email_updates` -- the table WF4-STATUS polls (Section 13.2: "SELECT eu.* FROM email_updates eu WHERE eu.processed = false") -- is still not defined in Module 4's schema. The Fixes Applied Log says the table count is now 12, but email_updates is presumably owned by Module 5. The problem is that Module 4 queries this table directly with specific column expectations (processed, classification_confidence, received_at) but does not define the interface contract. If Module 5 names the column `confidence` instead of `classification_confidence`, WF4-STATUS will fail silently. The PRD should either define the expected schema as an interface, or reference the Module 5 PRD section that defines it.

**Score: 5/10** (partially improved from 3/10 -- main tables added, but cross-module interface still undefined)

**Remaining gap:** Add an "Expected Interface: email_updates" subsection in Section 14.4 that specifies the minimum columns and types Module 4 requires from Module 5's email_updates table.

---

#### Persona 2 Summary (v2): Technical Architect / n8n Expert

| Round | Concern | v1 Score | v2 Score | Delta |
|-------|---------|----------|----------|-------|
| 11 | Learning loop cold-start, needs seeding | 4/10 | 6/10 | +2 |
| 12 | Duplicate notification_queue definition | 3/10 | 6/10 | +3 |
| 13 | highest_state_reached column never populated (new) | -- | 5/10 | new |
| 14 | Cron/webhook deduplication still missing | 4/10 | 4/10 | 0 |
| 15 | HMAC verification uses re-serialised JSON | 3/10 | 6/10 | +3 |
| 16 | State transition CASE missing v2 states (regression) | 5/10 | 5/10 | 0 |
| 17 | Discovery source subquery non-deterministic (new) | -- | 5/10 | new |
| 18 | Rate limiting references Redis (not in stack) | 3/10 | 6/10 | +3 |
| 19 | Sync trigger does not guard for NULL job_id (new) | -- | 6/10 | new |
| 20 | email_updates interface still undefined | 3/10 | 5/10 | +2 |

**v2 Average: 5.4/10** (up from 4.3/10)

**Assessment:** The technical fixes are genuine improvements. The schema is now mostly complete, security controls exist, and the learning loop is well-designed. However, v2 introduced three new issues through its own fixes: highest_state_reached is never populated, the state transition function does not handle the new academic states, and the sync trigger does not guard for nullable job_id. These are implementation-level bugs that would be caught in Phase 1 testing but should not exist in the PRD.

---

### 20.3 Persona 3: UK Career Coach / Recruitment Expert

**Profile:** 15+ years in UK recruitment and career coaching, deep knowledge of corporate and academic hiring processes.

---

**Round 21 -- The recruitment agency support (v2 fix for R21) adds fields but no pipeline model for agency-mediated applications.**

v2 added `recruitment_agency`, `recruiter_name`, and `recruiter_email` to the applications table, plus agency-aware matching in Section 7.3. This addresses the data storage gap. However, the state machine does not differentiate agency-mediated applications. When a recruitment agency submits a candidate, the flow is: Candidate -> Agency -> Employer, and communications go: Employer -> Agency -> Candidate. The acknowledgement email comes from the agency, not the employer. The interview invitation comes from the agency. The rejection comes from the agency. The matching algorithm now handles this (step 1b), but the state transitions and follow-up rules do not. A corporate application through Hays has different follow-up etiquette than a direct application: the candidate follows up with the recruiter, not the employer. The follow-up templates (Section 9.5) are addressed to "Dear Hiring Manager/Recruiting Team" -- for agency applications, the follow-up should be addressed to the recruiter with different content ("Hi [Recruiter], any update on the [Company] role?").

**Score: 6/10** (up from 3/10 -- data model improved, pipeline behaviour not agency-aware)

**Remaining gap:** Follow-up templates need an agency variant. Follow-up thresholds for agency applications should be shorter (agencies respond faster than employers). Track agency responsiveness as a metric.

---

**Round 22 -- The academic longlisted/shortlisted fix (v2 fix for R23) is correctly disambiguated but the ghosting algorithm does not reference the new states.**

v2 added `academic_longlisted` and `academic_shortlisted` to the state machine with a clear v2 Note explaining the disambiguation from pre-application `shortlisted`. The valid transitions are specified. The state definitions include expected durations and timestamp columns. This is a clean fix. However, the ghosting detection algorithm (Section 9.6, Python pseudocode) and the follow-up evaluation code (Section 13.3, JavaScript) only define thresholds for `applied`, `acknowledged`, `screening`, and `interviewing`. Neither includes `academic_longlisted` or `academic_shortlisted`. An application that reaches `academic_longlisted` and stalls there for 6 weeks will never trigger a follow-up or ghosting detection because those states are not in the threshold lookup. The WF4-GHOST query (Section 13.3) filters for `current_state IN ('applied', 'acknowledged', 'screening', 'interviewing')` -- the two new academic states are excluded from the ghosting check entirely.

**Score: 6/10** (up from 3/10 -- state machine is correct, but ghosting/follow-up logic does not cover new states)

**Remaining gap:** Add `academic_longlisted` and `academic_shortlisted` to the ghosting threshold maps (Section 9.6 and 13.3) and to the WF4-GHOST query filter. Suggested thresholds: longlisted warn 14d / ghost 42d; shortlisted warn 21d / ghost 35d.

---

**Round 23 -- The academic ghosting threshold of 56 days is acknowledged as configurable via pipeline_track_config but the default is still too aggressive.**

v1 Round 24 flagged that 56 days (8 weeks) is too short for academic "applied" state ghosting. v2 kept 56 days as the default but made it configurable via `pipeline_track_config` (Appendix A.2). The Fixes Applied Log says "partially addressed." In practice, 56 days is still the default that ships, and the candidate will experience false ghosting detections unless she manually adjusts the config table. The PRD acknowledges academic timelines of 3-6 months (Section 6.8) and the primary hiring cycle of January-May (Appendix G), but the default configuration contradicts this knowledge. An application submitted in mid-January with a March 15 deadline will not complete committee review until late April at the earliest -- that is 14 weeks from submission, well past the 56-day ghost threshold. The default should match the documented reality, not require manual override.

**Score: 5/10** (up from 4/10 -- configurability is good, but the default is still wrong)

**Remaining gap:** Change the default academic ghost_applied threshold from 56 to 84 days (12 weeks). Alternatively, calculate the ghost timer from the role's closing date rather than the submission date.

---

**Round 24 -- The speculative application support (v2 fix for R29) makes job_id nullable but does not address the pipeline flow.**

v2 made `job_id` nullable in the applications table. This means a speculative application can be created without a Module 1 job record. However, the pipeline flow still assumes Module 1 -> Module 2 -> Module 3 -> Module 4. How does a speculative application enter the system? WF4-INIT's webhook (Section 13.1) expects a `job_id` in the payload and fetches job data from the jobs table as its first step. If job_id is null, the workflow will fail at the "Postgres: Fetch Job Data" node because there is no job to fetch. The pipeline track determination (`determineTrack()` function, Section 13.1) relies on `job.job_type` and `job.title` from Module 1. Without a job record, these are unavailable. The webhook payload would need alternative fields (company_name, job_title, pipeline_track provided directly by the candidate), but the webhook schema does not define them as top-level fields separate from the job reference.

**Score: 5/10** (up from 3/10 -- the constraint is removed, but the workflow does not handle the null case)

**Remaining gap:** Add a conditional branch to WF4-INIT: if job_id is null, use directly-provided company_name, job_title, and pipeline_track from the webhook payload. Update the webhook schema to make job_id optional with fallback fields.

---

**Round 25 -- No networking/warm leads pipeline remains unaddressed, and the "use the notes field" suggestion is inadequate.**

v1 Round 25 flagged that 30-40% of senior UK hires come through networking. v2 deferred this with "candidate can use notes field." The notes field is free text with no structure, no follow-up reminders, and no metrics. A networking contact ("spoke with Jane at CIPD conference, she mentioned a Head of L&D role opening at BigCo in April") needs: a follow-up date, a company association, and a conversion tracker. Storing this in a text note field means it will be forgotten. The system tracks formal applications thoroughly but is blind to the networking pipeline that often produces the best opportunities. Even a lightweight "warm lead" state in the pre-application pipeline (before "discovered") would address this.

**Score: 4/10** (unchanged from v1 -- no fix applied, and the suggested workaround is weak)

**Remaining gap:** Add a `warm_lead` pre-application state or a dedicated `networking_contacts` table with follow-up dates and company associations.

---

**Round 26 -- The academic pipeline diagram (Section 6.8) uses different state names than the state machine -- "LONGLISTED" vs "academic_longlisted".**

v2 correctly added `academic_longlisted` and `academic_shortlisted` as state codes in the state machine (Section 6.3, 6.4, 6.6). But the academic pipeline diagram in Section 6.8 still shows "LONGLISTED (academic-specific)" and "SHORTLISTED (academic-specific)" without the `academic_` prefix. The diagram also references "TEACHING PRESENTATION" as if it were a distinct state, but the state machine does not have a teaching_presentation state -- teaching presentations are tracked as interview sub-types within the INTERVIEWING state. This inconsistency between the visual diagram and the actual state definitions will confuse developers. The corporate diagram (Section 6.7) uses "SCREENING", "INTERVIEWING", etc. which match the state codes. The academic diagram should use the actual codes.

**Score: 6/10** (new issue introduced by v2 fix -- the fix is correct in the code but not reflected in the diagram)

**Remaining gap:** Update Section 6.8 diagram to use `ACADEMIC_LONGLISTED` and `ACADEMIC_SHORTLISTED` labels. Clarify that teaching presentations are tracked within the INTERVIEWING state, not as a separate state.

---

**Round 27 -- The system still does not track which referees have been contacted or their response status in real-time.**

v1 Round 10 flagged the post-offer experience as underdeveloped, specifically referee management. v2 improved the data model (referee data minimised to name and status per Section 12.6), but the system still has no workflow that tracks referee progress. The `references_details` JSONB stores `[{name, status}]` but nothing updates this field automatically. There is no notification when a referee has not responded after 7 days. There is no prompt to the candidate asking "Has Prof. Smith submitted her reference yet?" Pre-employment checks are a common bottleneck in UK academic hiring (2-8 weeks), and slow referees are the most common cause. The system stores the data but does nothing with it.

**Score: 5/10** (marginal improvement from 4/10 -- data model is better, but no active management)

**Remaining gap:** Add a WF4-GHOST check for pre_employment state: if references_received < references_required and days since pre_employment_started > 14, send a reminder to chase referees.

---

**Round 28 -- The v2 re-application model (application_attempt + previous_application_id) does not specify how metrics handle re-applications.**

v2 fixed the unique constraint (now `UNIQUE(job_id, application_attempt)`) and added `application_attempt` and `previous_application_id`. A candidate rejected from BigCo can now re-apply with a new record linked to the old one. The state machine allows `rejected -> applied` and `withdrawn -> applied`. But the metrics are silent on re-applications. Does a re-application count as a new application in the funnel? Does the second rejection count separately for response rate? If the candidate applies, gets rejected, re-applies, and gets an interview, the funnel shows 2 applications and 1 interview (50% interview rate) -- but the reality is 1 opportunity with a second attempt. The source effectiveness metrics will also double-count: the same role via the same source appears twice. Without a clear policy, re-applications will inflate volume metrics and distort conversion rates.

**Score: 6/10** (new issue introduced by v2 fix)

**Remaining gap:** Define re-application metric policy: re-applications should be flagged in metrics and can be counted as a separate funnel entry or linked to the original. Add an `is_reapplication` flag for metric queries to optionally exclude re-applications.

---

**Round 29 -- The configurable pipeline_track_config table (Appendix A.2) does not include the new academic longlisted/shortlisted states.**

v2 added `pipeline_track_config` with follow-up and ghost thresholds per track (Appendix A.2). The table has columns for `follow_up_applied`, `follow_up_acknowledged`, `follow_up_screening`, `follow_up_interviewing`, and corresponding ghost thresholds. There are no columns for `follow_up_academic_longlisted` or `follow_up_academic_shortlisted`. The INSERT statement seeds corporate and academic rows with values for 4 states each. But the academic track now has 6 active states (applied, acknowledged, academic_longlisted, academic_shortlisted, screening, interviewing). The config table cannot store thresholds for the new states, which means they must be hard-coded in the workflow logic -- defeating the purpose of having a configuration table.

**Score: 5/10** (new issue -- config table does not match expanded state machine)

**Remaining gap:** Add `follow_up_longlisted`, `follow_up_shortlisted`, `ghost_longlisted`, `ghost_shortlisted` columns to pipeline_track_config. Update the INSERT seed data with appropriate academic values.

---

**Round 30 -- The email matching algorithm gives a recency bonus that disadvantages long-running academic applications.**

Section 7.3 matching algorithm adds a confidence bonus based on application age: +10 for applications less than 7 days old, +5 for less than 30 days. Applications older than 30 days get no recency bonus. Academic applications routinely take 3-6 months, meaning an academic application that has been running for 90 days gets zero recency bonus while a fresh corporate application gets +10. If both the academic and corporate applications are at the same employer (unlikely but possible -- some organisations have both corporate and academic arms), the recency bonus will bias matching toward the newer corporate application. Even without same-employer collisions, the recency bonus creates an implicit hierarchy that favours the corporate pipeline for no good reason. The bonus should be track-aware: academic applications should receive the +10 bonus for the first 30 days, not just 7.

**Score: 6/10** (new issue -- track-unaware recency bonus in matching algorithm)

**Remaining gap:** Make recency bonus thresholds track-aware. Academic: +10 for < 30 days, +5 for < 90 days. Corporate: +10 for < 7 days, +5 for < 30 days.

---

#### Persona 3 Summary (v2): UK Career Coach / Recruitment Expert

| Round | Concern | v1 Score | v2 Score | Delta |
|-------|---------|----------|----------|-------|
| 21 | Agency data stored but pipeline not agency-aware | 3/10 | 6/10 | +3 |
| 22 | Ghosting algorithm excludes new academic states | 3/10 | 6/10 | +3 |
| 23 | Academic ghost default 56d still too short | 4/10 | 5/10 | +1 |
| 24 | Speculative apps: constraint fixed, workflow broken | 3/10 | 5/10 | +2 |
| 25 | No networking pipeline | 4/10 | 4/10 | 0 |
| 26 | Academic diagram uses wrong state names (new) | -- | 6/10 | new |
| 27 | Referee tracking passive, no active management | 4/10 | 5/10 | +1 |
| 28 | Re-application metric policy undefined (new) | -- | 6/10 | new |
| 29 | pipeline_track_config missing new state columns (new) | -- | 5/10 | new |
| 30 | Recency bonus in matching disadvantages academic (new) | -- | 6/10 | new |

**v2 Average: 5.4/10** (up from 4.4/10)

**Assessment:** The structural fixes (academic states, agency fields, speculative apps, re-applications) are all correctly conceived but incompletely implemented. Each fix introduces a secondary gap: the ghosting algorithm does not cover the new states, the workflow does not handle null job_id, the config table does not have columns for the new states. The pattern is consistent: the schema-level fix is applied but the behavioural logic that depends on it is not updated to match.

---

### 20.4 Persona 4: Data Engineer / Analytics Specialist

**Profile:** Senior data engineer specializing in analytics pipelines, metrics design, and data quality.

---

**Round 31 -- The Metrics Glossary (v2 fix for R31) is a genuine improvement but has internal inconsistencies with the SQL queries.**

v2 added Section 8.9 (Metrics Glossary) with canonical definitions for each metric. This directly addresses the v1 complaint that response rate had three definitions. The glossary defines response rate as: "Applications that received any employer response / Applications submitted." The SQL column in the glossary says `COUNT(applied_at IS NOT NULL AND highest_state_reached NOT IN ('applied','ghosted','expired')) / COUNT(applied_at IS NOT NULL)`. But the actual SQL implementation in Section 8.6 (query #2) uses `COUNT(*) FILTER (WHERE highest_state_reached NOT IN ('applied', 'ghosted', 'expired') AND applied_at IS NOT NULL) / COUNT(*) FILTER (WHERE applied_at IS NOT NULL)`. These are semantically equivalent but syntactically different, which will confuse developers checking the glossary against the implementation. More importantly, the glossary's SQL expression is written in shorthand (`COUNT(condition)`) which is not valid PostgreSQL -- it should use `COUNT(*) FILTER (WHERE condition)` or `SUM(CASE WHEN condition THEN 1 ELSE 0 END)`. The glossary is good conceptually but needs consistent, valid SQL.

**Score: 6/10** (up from 3/10 -- canonical definitions exist, SQL presentation needs cleanup)

**Remaining gap:** Use valid PostgreSQL syntax in the Metrics Glossary SQL column. Ensure exact match between glossary SQL and implementation SQL in Section 8.6 (or reference the glossary from Section 8.6 queries).

---

**Round 32 -- The highest_state_reached column is central to v2 metrics but has no defined state ordering.**

Building on the Technical Architect's observation (R13 above): the Metrics Glossary uses `highest_state_reached` extensively. The funnel definition says "Uses highest_state_reached column, not current_state." But there is no defined ordinal mapping for states. What is "higher" -- `academic_shortlisted` or `screening`? Is `assessment` higher than `interviewing`? The state machine is a directed graph, not a linear sequence, so the concept of "highest" requires an explicit ordinal definition. Without it, the column is meaningless for cross-track comparison and ambiguous even within a single track. A corporate application that goes applied -> screening -> interviewing has a clear "highest" at interviewing. But an academic application that goes applied -> academic_longlisted -> academic_shortlisted -> interviewing -- where does `academic_shortlisted` rank relative to `screening`? The metrics depend on a total ordering that does not exist.

**Score: 5/10** (new issue -- critical dependency of v2 metric fixes is undefined)

**Remaining gap:** Define a state ordinal map: discovered(0), shortlisted(1), cv_tailored(2), applied(3), acknowledged(4), academic_longlisted(5), academic_shortlisted(6), screening(6), interviewing(7), assessment(8), offer_received(9), negotiating(10), pre_employment(11), accepted(12). Note: longlisted/shortlisted/screening are peer-level; use max ordinal among parallel paths.

---

**Round 33 -- The source effectiveness metric (Section 8.6, query #7) uses current_state instead of highest_state_reached, contradicting the glossary.**

The Metrics Glossary (Section 8.9) establishes that funnel and response metrics should use `highest_state_reached`. But the source effectiveness query in Section 8.6 still uses `WHERE current_state NOT IN ('applied', 'ghosted')`. This means a rejected application that was rejected after an interview (current_state = 'rejected') is counted as a response, which is correct. But an application currently in 'ghosted' state that previously reached 'acknowledged' is excluded -- according to the glossary, it should count as having received a response (it reached acknowledged before being ghosted). The v2 metric definitions created a split: some queries were updated to use `highest_state_reached` (response rate, interview conversion), but the source effectiveness query was not. This inconsistency means source response rates will not match overall response rates, confusing the candidate.

**Score: 5/10** (partially addressed in v2 -- some queries updated, this one missed)

**Remaining gap:** Update the source effectiveness query (Section 8.6, query #7) to use `highest_state_reached` instead of `current_state`, consistent with the Metrics Glossary.

---

**Round 34 -- The minimum sample size policy (v2 fix for R36) does not specify how thresholds interact with track-specific windows.**

v2 added Section 8.10 with minimum sample sizes: n >= 10 per CV version, n >= 8 per source, n >= 5 per track. This addresses the statistical significance concern. However, the track-specific metric windows (30d corporate, 90d academic) interact with sample sizes in a non-obvious way. The academic track uses a 90-day window, but the candidate may submit only 2-5 academic applications per month. After 90 days, there may be 6-15 academic applications -- barely meeting the n >= 5 threshold and certainly insufficient for source-level segmentation within the academic track. The policy should specify: when the combined window does not yield enough samples, should the window be extended? Should academic source rates use a 180-day window? Or should the policy simply suppress academic source-level metrics entirely until sufficient volume accumulates?

**Score: 6/10** (up from 4/10 -- policy exists, edge cases not specified)

**Remaining gap:** Specify window extension policy for low-volume tracks: if n < threshold within the standard window, either extend the window or suppress the metric with a "data accumulating" message.

---

**Round 35 -- The pipeline_metrics DELETE-and-recreate pattern is still used despite the v1 recommendation to use UPSERT.**

v1 Round 32 recommended using UPSERT instead of DELETE + INSERT for daily metrics recalculation. The WF4-METRICS workflow (Section 13.4) still starts with "DELETE FROM pipeline_metrics WHERE calculated_at >= date_trunc('day', NOW())." This means if the workflow fails halfway through recalculation (after DELETE but before all INSERTs complete), the day's metrics are partially or fully lost. An UPSERT pattern with a natural key (metric_name + dimensions_hash + period_start) would be idempotent and safe against partial failures. The Fixes Applied Log does not mention this issue -- it was apparently not addressed in v2.

**Score: 4/10** (unchanged from v1 -- not addressed)

**Remaining gap:** Replace DELETE + INSERT with INSERT ... ON CONFLICT (metric_name, dimensions, period_start, period_end) DO UPDATE. Add a composite unique constraint to pipeline_metrics to support this.

---

**Round 36 -- The weekly report metrics comparison query (Section 10.9) uses current_state for "interviews" count, ignoring rejected-after-interview applications.**

Section 10.9 contains a UNION query comparing this week's activity with last week's. The "interviews" count uses `COUNT(*) FILTER (WHERE current_state IN ('interviewing', 'assessment', 'offer_received', ...))`. An application that was interviewing on Monday but rejected on Wednesday shows current_state = 'rejected' by Sunday's report, and is NOT counted in the "interviews" metric for that week. The candidate had an interview this week -- it should be counted. The weekly activity section (Section 10.3) correctly uses application_events to list "interviews completed," but the metrics comparison table does not. The same application produces inconsistent reporting: the narrative says "1 interview completed" but the metrics table shows 0 interviews for the week.

**Score: 5/10** (partially new issue -- follows from the current_state vs. historical state problem)

**Remaining gap:** The metrics comparison query in Section 10.9 should use event counts from application_events (WHERE event_type = 'interview_invited' AND occurred_at within period) rather than current_state snapshots.

---

**Round 37 -- The track-specific metric windows (30d corporate, 90d academic) create a confusing weekly report when both are shown side by side.**

v2 implemented track-specific windows per v1 R34 recommendation. Section 8.6 uses CASE statements to select 30 days for corporate and 90 days for academic. The weekly report (Section 10.5) shows metrics in a table: "This Week / Last Week / 4-Week Average / Trend." But if corporate response rate uses a 30-day window and academic uses a 90-day window, showing them in the same "This Week" column is misleading. The "Response Rate" row would need to specify "(30d)" or "(90d)" per track. The sample report (Appendix H) shows a single "Response Rate: 38%" without indicating which window or which track. With two tracks using different windows, the candidate needs at least two rows (corporate response rate 30d, academic response rate 90d) or a footnote explaining the window difference. The report template does not account for this complexity.

**Score: 5/10** (new issue introduced by v2 fix -- the fix is correct but the reporting does not reflect it)

**Remaining gap:** Update the weekly report template (Section 10.5, Appendix H) to show separate rows for corporate and academic metrics with their respective windows clearly labelled.

---

**Round 38 -- The aggregation from daily to weekly to monthly metrics is still unspecified.**

v1 Round 32 and R39 flagged that the retention policy mentions aggregating daily snapshots into weekly and monthly summaries, but the aggregation logic was never specified. v2 did not address this. Section 8.7 still says "Weekly summaries: 1 year, Aggregated from daily" and "Monthly summaries: 3 years, Aggregated from weekly" with no definition of how aggregation works. For count metrics (applications submitted), aggregation is simple (SUM). For rate metrics (response rate %), simple averaging of daily percentages is statistically incorrect because the denominators differ day to day. A day with 1 application and 1 response (100% rate) averaged with a day of 10 applications and 2 responses (20%) gives 60% -- but the true rate is 3/11 = 27%. Weighted average by denominator is required. This is not specified.

**Score: 4/10** (unchanged from v1 -- not addressed)

**Remaining gap:** Specify aggregation logic: for rate metrics, store both numerator and denominator in pipeline_metrics and compute weekly rates as SUM(numerator)/SUM(denominator). For count metrics, use SUM. Document this in Section 8.7.

---

**Round 39 -- The pipeline_metrics table still has no cleanup job and no partition strategy.**

v1 Round 39 scored this 6/10 and recommended adding a cleanup job to WF4-METRICS. v2 did not address it. The Fixes Applied Log says "deferred -- will add cleanup to WF4-METRICS during Phase 4." The table will grow at ~100+ rows per day. After one year: ~36,500 daily rows + weekly summaries. This is manageable for PostgreSQL but the absence of any cleanup is a code smell. More practically, the retention policy says daily snapshots should be deleted after 90 days, but no mechanism exists to enforce this. The first developer to notice the table has 50,000 rows will either panic or delete rows manually, neither of which is ideal.

**Score: 5/10** (marginal improvement from 6/10 -- acknowledged but still deferred; moved down slightly because it was easy to fix and was not)

**Remaining gap:** Add a cleanup step at the end of WF4-METRICS: DELETE FROM pipeline_metrics WHERE period_type = 'daily' AND calculated_at < NOW() - INTERVAL '90 days'. This is one SQL statement.

---

**Round 40 -- The Metrics Glossary defines "Funnel Conversion" but the sample report (Appendix H) shows a different funnel structure.**

Section 8.9 defines Funnel Conversion as "Applications that ever reached a stage or beyond / total applications" using highest_state_reached. The sample report (Appendix H) shows a funnel with raw counts and percentages: "Applied: 26 (100%), Acknowledged: 14 (54%), Screening: 7 (27%), Interviewing: 5 (19%), Offer: 2 (8%)." This could be "ever reached" or "currently at." The label does not specify. If it is "ever reached," then an application currently rejected after interview is counted in the Interviewing line -- which is correct per the glossary. But the visual funnel uses a bar chart format that implies reduction (each bar is shorter than the previous), which only works if the numbers are cumulative "ever reached" counts. The sample numbers happen to be decreasing (14, 7, 5, 2), which could be either interpretation. The report should explicitly label the funnel: "Applications that ever reached this stage or beyond."

**Score: 6/10** (up from 4/10 -- definition exists, labelling needs clarification)

**Remaining gap:** Add "(ever reached)" label to the funnel in the weekly report template and sample report. Verify the funnel query uses highest_state_reached, not current_state.

---

#### Persona 4 Summary (v2): Data Engineer / Analytics Specialist

| Round | Concern | v1 Score | v2 Score | Delta |
|-------|---------|----------|----------|-------|
| 31 | Metrics Glossary SQL syntax inconsistent | 3/10 | 6/10 | +3 |
| 32 | No state ordinal for highest_state_reached (new) | -- | 5/10 | new |
| 33 | Source effectiveness query uses current_state not HSR | 4/10 | 5/10 | +1 |
| 34 | Sample size policy + track windows interaction | 4/10 | 6/10 | +2 |
| 35 | DELETE+INSERT still used for metrics, not UPSERT | 4/10 | 4/10 | 0 |
| 36 | Weekly report interviews count uses current_state (new) | -- | 5/10 | new |
| 37 | Track-specific windows not reflected in report template (new) | -- | 5/10 | new |
| 38 | Daily-to-weekly aggregation logic still unspecified | 4/10 | 4/10 | 0 |
| 39 | No cleanup job for pipeline_metrics | 6/10 | 5/10 | -1 |
| 40 | Funnel labelling does not specify "ever reached" | 4/10 | 6/10 | +2 |

**v2 Average: 5.1/10** (up from 4.1/10)

**Assessment:** The Metrics Glossary and highest_state_reached are significant structural improvements. The metric definitions are now consistent in intent, even if the SQL implementations have not all been updated to match. The main remaining issues are: (1) highest_state_reached has no ordinal definition or population logic, making it currently inert; (2) several queries were not updated to use the new column; (3) the aggregation and cleanup logic is still unspecified. The v2 fixes established the right framework but left the implementation half-done.

---

### 20.5 Persona 5: Privacy & Compliance Officer

**Profile:** UK-qualified data protection specialist with CIPP/E certification, experienced in GDPR compliance for HR tech systems.

---

**Round 41 -- The DBS data handling (v2 fix for R49) is substantially improved but still has a gap in the retention automation.**

v2 removed the `issues_found` status from dbs_status, added an Article 10 note, specified 30-day retention, and noted explicit consent as the lawful basis. This is a meaningful improvement. The DBS data now stores only pending/submitted/processing/cleared -- no sensitive outcomes. The 30-day retention is specified in the anonymisation script (Section 16.4): `DELETE FROM application_pre_employment WHERE dbs_status = 'cleared' AND dbs_completed_at < NOW() - INTERVAL '30 days'`. However, this deletion logic is in the annual anonymisation job, not in a dedicated scheduled workflow. If the anonymisation job runs annually, DBS data from January could persist until the next December run -- far exceeding the 30-day policy. The 30-day DBS deletion needs its own scheduled trigger or integration into WF4-METRICS (daily).

**Score: 6/10** (up from 3/10 -- data model is correct, automated enforcement needs a scheduled job)

**Remaining gap:** Add DBS data cleanup to WF4-METRICS daily run (not just the annual anonymisation job). The DELETE query already exists; it just needs to be executed daily.

---

**Round 42 -- The anonymisation (v2 fix for R44) now covers child tables and uses random labels, but the anonymisation trigger is still manual.**

v2 replaced pseudonymisation with true anonymisation: `gen_random_bytes(6)` for labels, child table deletion for documents/interviews/notes, and NULL-ing of identifying fields. This is a genuine fix. However, the anonymisation job is specified as "annual anonymisation job (manual trigger or cron)" -- the "or" is concerning. If manual, it depends on the candidate remembering to run it. If cron, the schedule is not specified. The retention policy says terminal applications are anonymised after 12 months, but without a scheduled trigger, this is a policy statement with no enforcement. The `delete_all_candidate_data()` function (Section 16.4.1) handles the nuclear option, but there is no intermediate scheduled job for routine anonymisation of old records.

**Score: 6/10** (up from 3/10 -- anonymisation logic is correct, scheduling is not defined)

**Remaining gap:** Specify a monthly cron job for the anonymisation script. Add it to WF4-METRICS or create a dedicated WF4-CLEANUP workflow with a monthly schedule.

---

**Round 43 -- The email body retention reduction to 7 days (v2 fix for R43) is good but the deletion query has a logic gap.**

v2 reduced email body retention from 3 months to 7 days (Section 16.4). The DELETE query strips email_from, email_subject, and email body keys from event_data JSONB for events older than 7 days. This is a strong improvement. However, the query condition is `WHERE occurred_at < NOW() - INTERVAL '7 days' AND email_id IS NOT NULL`. This means all email-related events older than 7 days lose their email content. But the matching algorithm and learning loop need email_from data to build sender_company_mappings. If a manual correction happens on day 8 (candidate assigns an unmatched email that arrived on day 1), the email_from has already been deleted, and the sender_company_mapping cannot be created with the sender_email field. The 7-day window should be extended for unprocessed or unmatched events, or the sender mapping should be created at email receipt time rather than at manual correction time.

**Score: 6/10** (up from 4/10 -- retention reduced, but deletion timing conflicts with learning loop)

**Remaining gap:** Either: (a) extend retention for unmatched emails (WHERE processed = false, do not delete until processed); or (b) create sender_company_mappings entries at email matching time (even for low-confidence matches) rather than waiting for manual correction.

---

**Round 44 -- The webhook security controls (v2 fix for R47) are comprehensive in design but the rate limit implementation is not specified concretely.**

v2 added a six-control security model for webhooks (Section 16.5.1): bearer token, HMAC, rate limiting, IP allowlisting, body validation, and request logging. The design is sound. However, the rate limiting description says "Max 10 requests/minute per endpoint (implemented via n8n Code node counter + Redis/Postgres)." Redis is not in the technology stack. Postgres-based rate limiting adds database load on every request. n8n Code nodes have limited state persistence between executions -- an in-memory counter resets on workflow completion or n8n restart. There is no concrete implementation: no SQL for a rate_limit_log table, no Code node logic, no specification of what happens when the limit is exceeded (return 429? Log and process anyway? Queue for delayed processing?). The request logging specifies "alerting for >50 requests/minute" but does not define who receives the alert or through what channel.

**Score: 6/10** (up from 3/10 -- controls designed, rate limiting implementation incomplete)

**Remaining gap:** Define rate limiting concretely: add a webhook_request_log table with (endpoint, timestamp), check COUNT in the Code node, return 429 if exceeded. Remove Redis reference. Specify alert recipient (admin email via Resend).

---

**Round 45 -- The Claude API and Resend API DPA status is still "deferred -- will review during deployment."**

v1 Rounds 45-46 flagged that neither Anthropic nor Resend have Data Processing Agreements in place or assessed for UK GDPR compliance. v2 deferred both to "deployment." This is concerning because: (a) both services process personal data (metrics JSON with company names sent to Claude, full notification emails with salary data sent to Resend); (b) both are US companies, requiring international transfer assessment; (c) deployment is the wrong time to discover that a critical third-party processor does not meet GDPR requirements. If Anthropic's API terms do not include Article 28-compliant processor clauses, the strategic observations feature cannot launch legally. If Resend's terms are non-compliant, the entire notification system needs an alternative. These assessments should happen during planning, not deployment.

**Score: 4/10** (marginal improvement from 3-4/10 -- acknowledged but genuinely deferred to a risky phase)

**Remaining gap:** Review Anthropic API terms and Resend DPA before Phase 1. Add a "DPA Status" table to the PRD documenting: processor name, data types shared, DPA status, international transfer mechanism, data retention commitment.

---

**Round 46 -- The right to erasure function (v2 fix for R48) deletes from all Module 4 tables but does not handle cross-module data.**

v2 added `delete_all_candidate_data()` (Section 16.4.1) which deletes from all 12 Module 4 tables. The function notes that "data in Resend's logs and Anthropic's API logs cannot be deleted from this system." This is honest. However, the function does not address: (a) the jobs table (Module 1) which has application_id and application_state columns added by Module 4's migration -- these will be orphaned; (b) sender_company_mappings which may contain third-party email addresses that should be deleted if the candidate requests erasure; (c) the function uses DELETE without transaction wrapping -- if it fails midway, some tables are cleared and others are not. The function should run in a single transaction and handle the cross-module cleanup.

**Score: 6/10** (up from 5/10 -- function exists, needs transaction safety and cross-module handling)

**Remaining gap:** Wrap delete_all_candidate_data() in a transaction (BEGIN/COMMIT). Add cleanup of jobs.application_id and jobs.application_state columns. Verify sender_company_mappings is included (it is -- confirmed in the function body).

---

**Round 47 -- The referee data minimisation (v2 fix for R42) says "Email/org details deleted within 30 days" but no automated mechanism exists.**

v2 changed references_details to store `[{name, status}]` only, with email/org details deleted within 30 days. This is the correct data minimisation approach. However, like the DBS retention, the 30-day cleanup has no automated trigger. The comment in the schema says "Email/org details deleted within 30 days of check completion" but no query or workflow performs this deletion. The anonymisation script handles 6-month full record deletion, but the 30-day partial cleanup (stripping email/org from JSONB while keeping name/status) is not implemented anywhere. Since the JSONB structure is defined as `[{name, status}]` from the start, this suggests the detailed fields (email, org) are never stored in the table at all -- they are only used transiently in the n8n workflow. If so, the retention note is misleading because the data is never persisted. The PRD should clarify whether detailed referee data is stored and cleaned, or never stored at all.

**Score: 6/10** (up from 5/10 -- intent is correct, but ambiguous whether detailed data is stored then cleaned, or never stored)

**Remaining gap:** Clarify: if references_details only ever contains `{name, status}`, remove the 30-day cleanup note (it is not needed). If detailed data is temporarily stored, add a cleanup query to WF4-METRICS daily run.

---

**Round 48 -- The data breach procedure is still entirely absent.**

v1 Round 50 flagged this at 4/10. v2 deferred it to "operational concern; will document during deployment." The system now stores less sensitive data than v1 (7-day email retention, no DBS issues_found, minimised referee data), which reduces breach impact. But the procedure is still undocumented. A breach of the Hetzner server would expose: all active application data (companies, roles, states, salary data), structured compensation details, interview schedules with interviewer names, and historical pipeline data. For a system with no monitoring (no intrusion detection, no unusual access alerts), the breach might not be detected for days or weeks. The PRD has a "monitoring dashboard" (Section 15.5) for operational health but nothing for security monitoring.

**Score: 4/10** (unchanged from v1 -- not addressed)

**Remaining gap:** Document a basic breach response: (1) detection -- monitor for unusual DB connections, n8n login from new IPs; (2) containment -- disable all webhooks, change DB password; (3) assessment -- identify affected data; (4) notification -- inform affected third parties if needed. This is a half-page document.

---

**Round 49 -- The IP allowlisting (v2 fix) effectively constrains webhook access, but n8n's admin UI is still exposed to the internet.**

Section 16.5.1 adds IP allowlisting for webhook endpoints: "Accept only from localhost/Docker network (172.16.0.0/12, 127.0.0.1)." This is good for webhook security. But n8n itself runs at n8n.deploy.apiloom.io, which is internet-accessible. The n8n admin UI provides full access to all workflows, credentials (including API keys for Resend and Claude), database connection details, and the ability to execute any workflow manually. If the n8n admin password is compromised, the attacker has more access than any webhook exploit could provide. The PRD mentions "Password-protected n8n instance" (Section 16.5) but does not specify: MFA requirement, password complexity, session timeout, or admin access logging. For a system storing personal data and processing state transitions, the n8n admin panel is the single largest attack surface.

**Score: 5/10** (new issue -- webhook security improved but n8n admin security not addressed)

**Remaining gap:** Specify n8n admin security requirements: strong password (20+ characters), session timeout (1 hour), admin access logging, and consider IP-restricting the n8n admin UI itself (not just webhooks).

---

**Round 50 -- The delete_all_candidate_data function deletes notification_queue and notification_log but leaves Resend delivery logs unaddressed.**

Section 16.4.1 notes: "data in Resend's logs and Anthropic's API logs cannot be deleted from this system. Resend retains delivery logs per their retention policy." This is transparent, which is good. But Resend's delivery logs contain: recipient email address, email subject lines (which include company names and job titles), delivery timestamps, and potentially email body content. The PRD sends email tags (Appendix F.2) including `application_id` and `notification_type`. Over the lifetime of a job search, Resend's logs would contain a near-complete record of the candidate's pipeline activity through the subjects and tags alone. The PRD does not document Resend's retention period, whether it is configurable, or whether Resend supports data deletion requests. For a system that claims to support right to erasure, the inability to delete the most complete external record of the candidate's activity is a meaningful limitation that should be documented with mitigation options.

**Score: 5/10** (new issue -- external data processor retention not assessed)

**Remaining gap:** Research and document Resend's data retention period and deletion API (if any). Minimise data in email tags: remove application_id, use generic notification_type values. Consider removing company names from email subject lines (use "Application Update -- Ref #[hash]" instead of company name).

---

#### Persona 5 Summary (v2): Privacy & Compliance Officer

| Round | Concern | v1 Score | v2 Score | Delta |
|-------|---------|----------|----------|-------|
| 41 | DBS handling improved, retention not automated | 3/10 | 6/10 | +3 |
| 42 | Anonymisation logic correct, no scheduled trigger | 3/10 | 6/10 | +3 |
| 43 | Email retention 7d is good, conflicts with learning loop | 4/10 | 6/10 | +2 |
| 44 | Webhook security designed, rate limiting not concrete | 3/10 | 6/10 | +3 |
| 45 | Claude/Resend DPA still deferred to deployment | 3/10 | 4/10 | +1 |
| 46 | Erasure function exists, lacks transaction and cross-module handling | 5/10 | 6/10 | +1 |
| 47 | Referee minimisation intent good, automation ambiguous | 5/10 | 6/10 | +1 |
| 48 | No data breach procedure | 4/10 | 4/10 | 0 |
| 49 | n8n admin UI security not addressed (new) | -- | 5/10 | new |
| 50 | Resend external logs retention unassessed (new) | -- | 5/10 | new |

**v2 Average: 5.4/10** (up from 3.8/10)

**Assessment:** The compliance improvements in v2 are the strongest across all personas. DBS data handling, anonymisation, email retention, and webhook security all received substantive fixes. The remaining gaps are mostly about automation (scheduling cleanup jobs that the PRD defines but does not trigger) and external processor management (DPA review, Resend retention). The v2 privacy posture is defensible for a personal-use system, though it would not pass a formal audit without the DPA and breach procedure gaps being closed.

---

### 20.6 Overall v2 Evaluation Summary

#### Persona Average Scores (v1 vs v2)

| Persona | v1 Score | v2 Score | Delta | Assessment |
|---------|----------|----------|-------|------------|
| 1. The Candidate (Selvi) | 4.1/10 | 4.8/10 | +0.7 | Modest improvement. Most candidate-facing concerns were deferred. |
| 2. Technical Architect / n8n Expert | 4.3/10 | 5.4/10 | +1.1 | Good structural fixes, but v2 introduced three new bugs through incomplete implementation. |
| 3. UK Career Coach / Recruitment Expert | 4.4/10 | 5.4/10 | +1.0 | Schema fixes are solid, but behavioural logic (ghosting, config, workflow) not updated to match. |
| 4. Data Engineer / Analytics Specialist | 4.1/10 | 5.1/10 | +1.0 | Metrics Glossary is a strong addition. highest_state_reached is conceptually right but not implementable as written. |
| 5. Privacy & Compliance Officer | 3.8/10 | 5.4/10 | +1.6 | Strongest improvement. Anonymisation, DBS handling, and webhook security are genuinely better. |

**Overall v1 Average: 4.1/10**
**Overall v2 Average: 5.2/10**
**Delta: +1.1**

---

#### v2 Fix Quality Assessment

The 20 fixes applied can be categorised:

| Category | Count | Examples |
|----------|-------|---------|
| **Complete and correct** | 6 | Metrics Glossary (R31), anonymisation child tables (R44), email retention 7d (R43), DBS issues_found removal (R49), re-application model (R20), minimum sample size (R36) |
| **Correct in schema, incomplete in behaviour** | 8 | Academic states added but ghosting algorithm not updated (R23), highest_state_reached column added but never populated (R33/R37), agency fields added but pipeline not agency-aware (R21), speculative apps nullable but workflow broken (R29), webhook HMAC added but implementation flawed (R47), pipeline_track_config missing new columns, state transition function missing new CASE clauses |
| **Partially addressed** | 4 | On-demand query exists but email-based (R2), academic ghost threshold configurable but default still too short (R24), right to erasure function exists but lacks transaction safety (R48), source metrics partially updated to use HSR |
| **Not addressed (deferred)** | 12 | Pause mode (R7), rejection batching (R6), follow-up personalisation (R5), snooze customisation (R4), Claude/Resend DPA (R45/46), breach procedure (R50), deduplication (R12), etc. |

**Key Pattern:** v2 fixes show a consistent pattern of applying schema-level changes without updating the corresponding behavioural code. The data model is improved; the workflows and algorithms that operate on it are not fully updated. This creates a gap where the PRD's schema promises capabilities that the specified workflows cannot deliver.

---

#### Top 10 Remaining Must-Fix Issues (v2)

| # | Issue | Persona | Round | v2 Score | Action |
|---|-------|---------|-------|----------|--------|
| 1 | highest_state_reached has no population logic or ordinal definition | Tech/Data | 13, 32 | 5/10 | Add update logic to transition function; define state ordering |
| 2 | State transition CASE missing academic_longlisted, academic_shortlisted, pre_employment | Tech | 16 | 5/10 | Add WHEN clauses for all v2 states |
| 3 | Ghosting algorithm excludes academic_longlisted and academic_shortlisted | Coach | 22, 29 | 5-6/10 | Add these states to threshold maps and WF4-GHOST query |
| 4 | Cron/webhook deduplication still missing on WF4-STATUS | Tech | 14 | 4/10 | Implement atomic claim pattern |
| 5 | Claude API and Resend DPA review deferred to deployment | Privacy | 45 | 4/10 | Review before Phase 1 |
| 6 | No data breach procedure | Privacy | 48 | 4/10 | Document basic response plan |
| 7 | DELETE+INSERT for metrics; aggregation logic unspecified | Data | 35, 38 | 4/10 | Switch to UPSERT; specify weighted averaging |
| 8 | HMAC verification uses re-serialised JSON, not raw body | Tech | 15 | 6/10 | Fix to use raw request bytes |
| 9 | Speculative application workflow path not implemented (null job_id) | Coach | 24 | 5/10 | Add conditional branch in WF4-INIT |
| 10 | No pause/vacation mode | Candidate | 3 | 4/10 | Add m4_pipeline_paused config flag |

#### Top 10 Should-Fix Issues (v2)

| # | Issue | Persona | Round | v2 Score |
|---|-------|---------|-------|----------|
| 1 | Source effectiveness query uses current_state not HSR | Data | 33 | 5/10 |
| 2 | Academic ghost default 56d should be 84d | Coach | 23 | 5/10 |
| 3 | DBS 30-day cleanup not in any scheduled workflow | Privacy | 41 | 6/10 |
| 4 | Anonymisation job not scheduled (manual or undefined cron) | Privacy | 42 | 6/10 |
| 5 | Sync trigger does not guard for null job_id | Tech | 19 | 6/10 |
| 6 | QUERY response format unspecified | Candidate | 9 | 5/10 |
| 7 | Weekly report still no "wins" section, Sunday 7PM timing | Candidate | 2 | 5/10 |
| 8 | Rejection notifications still clinical and individual | Candidate | 5 | 4/10 |
| 9 | No networking/warm leads pipeline | Coach | 25 | 4/10 |
| 10 | n8n admin UI security not specified | Privacy | 49 | 5/10 |

---

*End of 50-Round Critical Roleplay Evaluation (v2)*

---

*End of Module 4 Product Requirements Document*

---

## Fixes Applied Log (v2 -> v3)

### Must Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | highest_state_reached has no population logic or ordinal definition | Added state ordinal map and highest_state_reached update logic to transition_application_state() function. States ordered from discovered(0) through accepted(11), with terminal states at -1. |
| 2 | State transition CASE missing academic_longlisted, academic_shortlisted, pre_employment | Added WHEN clauses for academic_longlisted, academic_shortlisted, pre_employment, and assessment to the timestamp update CASE block. |
| 3 | Ghosting algorithm excludes academic_longlisted and academic_shortlisted | Added academic_longlisted (warn:28, ghost:56) and academic_shortlisted (warn:21, ghost:42) to ghosting thresholds. Updated WF4-GHOST query to include these states. Also fixed academic applied ghost threshold from 56 to 84 days (Should Fix 2). |
| 4 | Cron/webhook deduplication missing on WF4-STATUS | Added atomic claim pattern using application_config lock with 10-minute auto-expiry. If another instance holds the lock, the workflow exits cleanly. |
| 5 | Claude API and Resend DPA review deferred | Added Section 16.1b with DPA requirements for Resend, Anthropic, and Hetzner. Pre-launch checklist included. |
| 6 | No data breach procedure | Added Section 16.5b with data breach response plan: 7-step procedure, breach severity levels (Low/Medium/High), and ICO reporting guidance. |
| 7 | DELETE+INSERT for metrics; aggregation logic unspecified | Replaced DELETE+INSERT with UPSERT pattern. Added unique index for upsert. Documented weighted averaging for weekly/monthly rollups. |
| 8 | HMAC verification uses re-serialised JSON | Updated webhook security table to specify raw body bytes (`$request.rawBody`) for HMAC computation, with explanation of why re-serialisation breaks signatures. |
| 9 | Speculative application workflow path not implemented | Added conditional branch in WF4-INIT for null job_id. Speculative applications get discovery_source='speculative' and can be tracked without a Module 1 job record. |
| 10 | No pause/vacation mode | Added Section 9.1b with full pause/vacation mode: activation via config flag, optional auto-resume date, frozen ghosting timers, "Welcome back" summary on resume. |

### Should Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | Source effectiveness query uses current_state not HSR | Changed source_response_rate_30d query to use highest_state_reached instead of current_state. |
| 2 | Academic ghost default 56d should be 84d | Changed academic applied ghost threshold from 56 to 84 days (applied with Must Fix 3). |
| 3 | DBS 30-day cleanup not in any scheduled workflow | Added Section 12.6b with DBS cleanup SQL. Runs as part of WF4-METRICS daily at 6AM. Clears DBS fields for completed checks >30 days and terminal applications >30 days. |
| 4 | Anonymisation job not scheduled | Added cron schedule to anonymisation SQL: WF4-ANON runs monthly on the 1st at 3AM. |
| 5 | Sync trigger does not guard for null job_id | Added `IF NEW.job_id IS NULL THEN RETURN NEW` guard to sync_application_state_to_jobs() function. |
| 6 | QUERY response format unspecified | Added detailed QUERY response email format with example outputs for "all active" and single-company queries. Includes pipeline table, summary stats, and event timeline. |
| 7 | Weekly report no "wins" section, Sunday 7PM timing | Added "This Week's Wins" section to weekly report template (positive status changes highlighted first). Changed schedule from Sunday 7PM to Monday 7AM for better action-orientation. |
| 8 | Rejection notifications still clinical and individual | Split status change notifications: positive changes sent immediately, rejections batched into daily "Pipeline Update" at 8AM with positive updates leading and rejections listed matter-of-factly. |
| 9 | No networking/warm leads pipeline | Added to Future Enhancements (Section 17.8) as High priority post-v1.0 item with proposed state machine. |
| 10 | n8n admin UI security not specified | Added n8n admin UI access control to Section 16.5: SSH tunnel only, never exposed directly to internet. |

---

## 21. 50-Round Critical Roleplay Evaluation (v3 - FINAL)

**Date:** 2026-03-29
**Methodology:** 5 expert personas, 10 rounds each, scoring 1-10. Focus on REMAINING weaknesses only after v3 fixes.
**v1 Overall Score:** 4.1/10
**v2 Overall Score:** 5.2/10
**v3 Fixes Applied:** 10 must-fix + 10 should-fix from v2 evaluation.

---

### 21.1 Persona 1: The Candidate (Selvi)

**Profile:** PhD + MBA, 18 years HR/L&D experience, dual-track UK job seeker (corporate L&D + academic lecturer). The actual end user of this system.

---

**Round 1 -- The on-demand QUERY mechanism still requires composing and sending an email, which is unusable during a recruiter phone call.**

v3 added detailed QUERY response formats with example outputs. The response content is now well-specified. But the interaction model has not changed: the candidate must compose an email, send it, and wait up to 5 minutes for a reply. During a recruiter phone call -- "Hi Selvi, this is James from Hays, I wanted to talk about the BigBank role we submitted you for" -- the candidate cannot pull up her pipeline status in real time. She needs to say "let me check and call you back." For a system designed to manage a professional job search at senior level, this interaction latency is a professional liability. The daily-generated static HTML dashboard suggestion from v2 Round 1 was never adopted. A simple cron job that renders the pipeline snapshot as a password-protected HTML page on the existing Dokploy server would provide instant mobile browser access with no additional infrastructure.

**Score: 6/10** (up from 5/10 -- response format is now well-defined, but the latency problem remains)

**Remaining gap:** Add a daily-generated static HTML pipeline page served from Dokploy at a private URL. This is achievable with the existing stack.

---

**Round 2 -- The "wins first" weekly report restructuring (v3 fix) is good, but the Monday 7AM timing creates a different problem.**

v3 moved the weekly report from Sunday 7PM to Monday 7AM and added a "This Week's Wins" section at the top. Both are improvements. The new problem: Monday 7AM in the UK means the email arrives when the candidate is starting her work week (or current-role day if employed). It competes with all other Monday morning emails. A detailed pipeline report with action items, follow-up reminders, and metrics may not get the attention it deserves at the busiest email hour of the week. Sunday 7PM was bad because it hung over the evening. Monday 7AM is bad because it gets buried. The report should arrive at a time when the candidate can act on it -- Sunday afternoon (2-3PM) or Monday lunchtime (12-1PM) would be better. More fundamentally, the timing should be configurable per the v1 recommendation, which was again not implemented.

**Score: 6/10** (up from 5/10 -- wins section is a real improvement, timing is better but still not configurable)

**Remaining gap:** Make report delivery time configurable via system_config (m4_weekly_report_time). Default to Monday 7AM but allow candidate to change.

---

**Round 3 -- The pause/vacation mode (v3 fix) is well-designed with one gap: it does not pause Module 1 and Module 3.**

v3 added Section 9.1b with a thorough pause mechanism: config flag, optional auto-resume date, frozen ghosting timers, welcome-back summary. The implementation is solid for Module 4 in isolation. The gap: when the candidate pauses her pipeline, Module 1 continues discovering jobs, Module 2 continues tailoring CVs, and Module 3 continues submitting applications. The candidate returns from holiday to find 15 new applications were auto-submitted during her break. The pause flag only controls Module 4's notification and ghosting workflows. A true vacation mode needs to propagate to other modules -- at minimum, Module 3 should stop auto-submitting. The PRD acknowledges Module 4 sits at the centre of the architecture but does not specify cross-module pause propagation. Even a note in the pause documentation saying "manually disable Module 3 auto-apply separately" would help.

**Score: 7/10** (up from 4/10 -- Module 4 pause is well-specified, cross-module coordination is missing)

**Remaining gap:** Document that pause mode should also disable Module 3 auto-apply. Add a cross-module pause flag or document the manual steps needed.

---

**Round 4 -- The rejection batching (v3 fix) is psychologically sound but creates an information delay that could matter.**

v3 batches rejections into a daily "Pipeline Update" at 8AM, with positive updates leading. This is a genuine improvement for emotional well-being. The trade-off: a rejection received at 9AM Tuesday is not communicated until 8AM Wednesday. During those 23 hours, the candidate might be preparing for a second interview at that company, or counting it as an active application in her mental pipeline. The delay is acceptable for most rejections, but there are edge cases: a rejection that includes useful feedback ("we liked your profile but need someone with CIPD Level 7"), a rejection that frees the candidate to accept another offer from the same company, or a rejection that should trigger immediate re-application to a different role at the same employer. The system should flag rejections that contain actionable content (feedback, re-application suggestion) for faster delivery.

**Score: 7/10** (up from 4/10 -- batching is right approach, needs edge-case handling for actionable rejections)

**Remaining gap:** If the rejection email contains substantive feedback or a specific suggestion, elevate to immediate delivery rather than batching.

---

**Round 5 -- The follow-up templates remain generic despite three rounds of evaluation flagging this.**

v1 Round 5 scored this 4/10. v2 deferred. v3 deferred again. The templates in Section 9.5 are unchanged boilerplate. The system now stores structured compensation, detailed job descriptions, tailored CV content, company context, and sender_company_mappings -- substantial contextual data that could produce personalised follow-ups. Claude Haiku is used for weekly strategic observations (a lower-value use case) but not for the higher-value task of drafting context-aware follow-up emails. A personalised follow-up that references a company's recent annual report or a specific initiative mentioned in the job description would materially increase response rates. This has been identified as a gap three times and deferred three times.

**Score: 5/10** (unchanged across three versions -- still not addressed)

**Remaining gap:** Use Claude to generate personalised follow-ups using job description highlights and company context from Module 1. This is the single highest-value LLM use case in Module 4.

---

**Round 6 -- The snooze mechanism still offers only fixed intervals (3d/1w/2w) with no custom date support.**

v1 Round 4 scored this 5/10. v2 and v3 both deferred. The data model has always supported custom dates (follow_up_snoozed_until is TIMESTAMPTZ). The gap is purely in the interaction layer: notification emails do not offer a "Reply SNOOZE 2026-05-15" option. This is a disconnect between capability and usability that has persisted across three versions. The fix requires adding one line to notification email templates and one parsing rule in Module 5. It is the lowest-effort improvement with the highest usability impact that remains unimplemented.

**Score: 5/10** (unchanged across three versions)

**Remaining gap:** Add "Reply SNOOZE [date]" to follow-up notification emails. The data model already supports it.

---

**Round 7 -- The daily check-in frequency is still every weekday, unchanged across three versions.**

v1 Round 3 scored this 5/10 for alert fatigue. v2 and v3 both deferred. With 20+ active applications, most in early stages where updates are unlikely, the candidate receives 5 ignorable emails per week. The system has all the data needed to be smarter: only send check-ins when applications are in states where manual updates are plausible (post-interview, post-phone-screen, after a deadline passes). An application submitted 3 days ago to a corporate role will not have an offline update. The check-in should only ask about applications where something might have happened outside email.

**Score: 5/10** (unchanged across three versions)

**Remaining gap:** Make check-in conditional: only send when applications are in post-interaction states (screening, interviewing) or past follow-up thresholds where manual follow-up may have occurred.

---

**Round 8 -- The compensation comparison mechanism still does not exist despite structured compensation data being in place since v2.**

v2 added the structured compensation JSONB field. v3 did not add any comparison logic. When the candidate has two active offers -- corporate at GBP 78k with 8% employer pension and academic at Grade 8 spine 38 with USS (21.6% employer contribution) -- the data is stored but nothing helps her compare total compensation. No query, no template, no section in the weekly report when multiple offers are active. The total_compensation_estimate field exists but no population logic is specified. This is the most critical decision point in a job search (which offer to accept) and the system provides zero decision support.

**Score: 6/10** (unchanged from v2 -- data model present, utility absent)

**Remaining gap:** Add a total compensation calculation function. When 2+ applications are in offer_received/negotiating states, include a comparison table in the next notification.

---

**Round 9 -- No interview preparation support remains the largest missed opportunity for an AI-assisted job search system.**

v1 Round 9 scored this 4/10. Deferred across all three versions. The system stores the job description (via Module 1), the tailored CV (via Module 2), the interview format and panel members (via Section 6.9), and has access to Claude for generation. An auto-generated interview prep brief -- sent 48 hours before the interview -- that combines job description highlights, CV talking points matched to the job requirements, and company context would be genuinely useful. This is the most natural LLM use case in the entire system and it remains unimplemented. The 24-hour pre-interview reminder identified in v2 Round 10 is also still missing.

**Score: 5/10** (up from 4/10 -- acknowledged but v3 did not implement the pre-interview reminder either)

**Remaining gap:** Add a pre-interview notification (48h before) that includes: interview details, the CV version that was sent, key job description requirements, and a brief LLM-generated prep guide.

---

**Round 10 -- The system offers no mechanism for the candidate to record interview self-assessment while the experience is fresh.**

After an interview, the most valuable data the candidate can record is: how it went, which questions were asked, which STAR examples she used, what she would do differently. This data is critical for preparing for subsequent interviews at different companies and for tracking competency performance over time. The application_interviews table has a candidate_notes field, but there is no prompt or workflow that asks the candidate to fill it in. The daily check-in is generic ("Any updates?"), not targeted ("You had an interview with BigBank yesterday -- how did it go?"). A post-interview prompt sent 2-4 hours after a scheduled interview end time would capture this data while it is fresh.

**Score: 5/10** (new issue -- related to v1 R9 and R27 but specifically about post-interview data capture)

**Remaining gap:** Add a post-interview prompt notification: 2-4 hours after interview scheduled end time, send "How did the interview with [Company] go?" with structured fields (overall impression, questions asked, STAR examples used, areas to improve).

---

#### Persona 1 Summary (v3): The Candidate (Selvi)

| Round | Concern | v2 Score | v3 Score | Delta |
|-------|---------|----------|----------|-------|
| 1 | On-demand query still email-based, latency problem | 5/10 | 6/10 | +1 |
| 2 | Monday 7AM timing better but not configurable | 5/10 | 6/10 | +1 |
| 3 | Pause mode well-designed, no cross-module propagation | 4/10 | 7/10 | +3 |
| 4 | Rejection batching good, needs edge-case handling | 4/10 | 7/10 | +3 |
| 5 | Follow-up templates still generic (3rd time flagged) | 4/10 | 5/10 | +1 |
| 6 | Snooze still fixed intervals only (3rd time flagged) | 5/10 | 5/10 | 0 |
| 7 | Daily check-in still every weekday (3rd time flagged) | 5/10 | 5/10 | 0 |
| 8 | Compensation comparison still absent | 6/10 | 6/10 | 0 |
| 9 | No interview prep support (3rd time flagged) | 5/10 | 5/10 | 0 |
| 10 | No post-interview self-assessment prompt (new) | -- | 5/10 | new |

**v3 Average: 5.7/10** (up from 4.8/10)

**Assessment:** The v3 fixes that landed (pause mode, rejection batching, wins section, Monday timing) are well-designed and genuinely improve the candidate experience. The persistent gaps are all in the same category: the system has the data and the LLM capability to provide personalised, context-aware assistance (follow-ups, interview prep, compensation comparison) but uses them only for weekly strategic observations. Four items have been flagged three times without change. These are post-launch enhancements that would move the system from "competent tracker" to "intelligent assistant."

---

### 21.2 Persona 2: Technical Architect / n8n Expert

**Profile:** Senior platform engineer with deep n8n experience, PostgreSQL expertise, and distributed systems knowledge.

---

**Round 11 -- The atomic claim pattern for WF4-STATUS deduplication (v3 fix) uses application_config as a lock table, which is fragile.**

v3 added a lock mechanism using `UPDATE application_config SET config_value = jsonb_set(...) WHERE config_key = 'system_locks' AND (... < NOW() - INTERVAL '10 minutes')`. This prevents simultaneous cron and webhook processing. The concern: application_config is a general-purpose key-value store, not a purpose-built lock table. If another workflow updates the same config_key row simultaneously (e.g., changing a different setting in the system_locks JSON), the lock UPDATE could conflict. The 10-minute auto-expiry is reasonable for crash recovery, but if WF4-STATUS legitimately takes more than 10 minutes to process a large backlog, the lock expires mid-execution and a second instance can start. The lock granularity is workflow-level (one lock for all of WF4-STATUS) rather than row-level (per email_update). A more robust pattern would use PostgreSQL advisory locks (`pg_try_advisory_lock(4001)`) which are purpose-built for this use case, release automatically on transaction end, and do not conflict with data updates.

**Score: 7/10** (up from 4/10 -- deduplication exists, implementation could be more robust)

**Remaining gap:** Consider PostgreSQL advisory locks instead of config-table locks. If keeping the current approach, increase the auto-expiry timeout to 30 minutes or scale it based on the email backlog size.

---

**Round 12 -- The highest_state_reached population logic (v3 fix) defines a state ordinal map, but the ordinals for parallel academic/corporate paths are ambiguous.**

v3 added a state ordinal map to the transition function with states ordered from discovered(0) through accepted(11). The v2 evaluation suggested academic_longlisted(5) and academic_shortlisted(6), with screening(5) and interviewing(6) as peer-level alternatives. The v3 implementation needs to handle the case where a corporate application goes applied(3) -> screening(5) -> interviewing(6) while an academic application goes applied(3) -> academic_longlisted(5) -> academic_shortlisted(6) -> interviewing(7). If screening and academic_longlisted share ordinal 5, then highest_state_reached correctly reflects progress regardless of track. But if an academic application skips longlisting and goes directly to interviewing, its highest_state_reached jumps from acknowledged(4) to interviewing(6), skipping 5 entirely. This is correct behaviour, but the funnel metrics that count "reached stage 5 or above" will show different meanings for the two tracks. The ordinal map works for within-track analysis but produces confusing cross-track comparisons.

**Score: 7/10** (up from 5/10 -- population logic exists, cross-track comparison needs documentation)

**Remaining gap:** Document that highest_state_reached ordinals are meaningful within a track but not comparable across tracks. Funnel queries should always be filtered by pipeline_track.

---

**Round 13 -- The speculative application workflow branch (v3 fix) works but creates records without discovery_source linkage to any Module 1 data.**

v3 added a conditional branch in WF4-INIT for null job_id. Speculative applications get discovery_source='speculative' and are tracked independently. The gap: when a speculative application later matches a formally posted job (the company posts the role that the candidate speculatively applied to), there is no mechanism to link the speculative application record to the new Module 1 job record. The candidate would need to manually set the job_id, but no workflow or email command supports this. The system could auto-detect this by comparing company_name and job_title against newly discovered Module 1 jobs. Without linking, metrics are fragmented: the speculative application and any formal application to the same role are tracked as separate pipeline entries.

**Score: 7/10** (up from 5/10 -- speculative apps work, late-linking mechanism is missing)

**Remaining gap:** Add a periodic check (in WF4-GHOST or WF4-METRICS) that compares unlinked speculative applications against newly discovered jobs by company name similarity. Surface matches for candidate confirmation.

---

**Round 14 -- The HMAC fix (v3) correctly specifies raw body bytes but does not specify how n8n exposes the raw body in webhook nodes.**

v3 updated the HMAC documentation to specify `$request.rawBody` for computing the signature. The code sample in Section 16.5.1 still shows `const body = JSON.stringify($input.first().json)`, which contradicts the prose. The documentation says one thing; the code says another. In n8n's webhook node, the raw body is available through `$request.body` (parsed) or the binary data buffer. The exact API depends on the n8n version and webhook configuration (raw body parsing must be enabled). The PRD should either update the code sample to match the documentation, or provide both the correct code and the n8n webhook node configuration needed to access raw bytes.

**Score: 7/10** (up from 6/10 -- the documentation is correct, the code sample contradicts it)

**Remaining gap:** Update the HMAC verification code sample to use `$request.rawBody` instead of `JSON.stringify($input.first().json)`. Note the n8n webhook node must have "Raw Body" option enabled.

---

**Round 15 -- The UPSERT pattern for metrics (v3 fix) requires a unique index that may not handle JSONB dimensions correctly.**

v3 added a unique index `ON pipeline_metrics(metric_name, period_start, period_type, dimensions)` to support INSERT ... ON CONFLICT. PostgreSQL unique indexes on JSONB columns use the `=` operator for comparison, which works for exact JSONB equality. But JSONB key ordering is not guaranteed: `{"track": "corporate", "source": "reed"}` and `{"source": "reed", "track": "corporate"}` are semantically equal but may or may not match depending on how PostgreSQL normalises JSONB storage. In practice, PostgreSQL does normalise JSONB key ordering internally, so this should work. However, the unique index on a JSONB column is unusual and may surprise developers. A safer approach would be to add separate VARCHAR columns for common dimension keys (track, source, state) and use those in the unique index, keeping JSONB for less-common dimensions only.

**Score: 7/10** (up from 4/10 -- UPSERT pattern is correct, JSONB in unique index is unusual but technically sound)

**Remaining gap:** Document that PostgreSQL normalises JSONB key ordering, so the unique index works correctly. Consider extracting common dimensions into typed columns for clearer indexing.

---

**Round 16 -- The notification_queue table is still defined in both Section 12.10 and Section 13.6.**

v2 Round 12 flagged this duplicate definition. v3 did not address it. The identical CREATE TABLE statement for notification_queue appears in two sections. If a future edit updates one but not the other, the PRD will contain contradictory schema definitions. This is a document maintenance issue rather than a technical one, but in a PRD of this length (6800+ lines), inconsistencies are particularly dangerous because implementers may reference either section.

**Score: 7/10** (unchanged from v2 -- minor documentation issue that has persisted)

**Remaining gap:** Remove the duplicate DDL from Section 13.6 and replace with "See Section 12.10 for notification_queue schema."

---

**Round 17 -- The WF4-GHOST query still uses a LEFT JOIN to jobs table, which will fail for speculative applications with null job_id.**

Section 13.3 shows: `FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.is_active = true`. This INNER JOIN excludes all speculative applications (where job_id is NULL) from ghosting detection. A speculative application that has been pending for 3 months will never be flagged as ghosted because it does not appear in the WF4-GHOST query results. The deadline check also joins to jobs for expires_at, which is correct (speculative applications have no deadline). But the ghosting check should include speculative applications. The JOIN should be LEFT JOIN, with COALESCE for any jobs-table fields used in the logic.

**Score: 7/10** (new issue introduced by v2/v3 speculative application support)

**Remaining gap:** Change the WF4-GHOST application query from `JOIN jobs j ON a.job_id = j.id` to `LEFT JOIN jobs j ON a.job_id = j.id` so speculative applications are included in ghosting detection.

---

**Round 18 -- The state ordinal map gives offer_received(9) a higher ordinal than pre_employment(8), but pre_employment comes after offer acceptance.**

The v3 ordinal map defines: `assessment(7), pre_employment(8), offer_received(9), negotiating(10), accepted(11)`. This ordering means an application that reaches pre_employment has a lower highest_state_reached than one that only reached offer_received. But pre_employment happens after the offer is accepted -- it is further along the pipeline. The correct ordering should be: assessment(7), offer_received(8), negotiating(9), pre_employment(10), accepted(11). The current ordering means the funnel metric "reached offer or beyond" would include pre_employment applications (ordinal 8 < 9), but that is coincidental -- the intent was to have pre_employment rank above offer_received.

**Score: 7/10** (bug in v3 fix -- incorrect ordinal ordering)

**Remaining gap:** Reorder state ordinals: offer_received(8), negotiating(9), pre_employment(10), accepted(11). Pre-employment checks happen after offer acceptance and should rank higher.

---

**Round 19 -- The WF4-METRICS daily run now includes DBS cleanup (v3 fix) but this mixes concerns: operational metrics and data compliance in one workflow.**

v3 added DBS 30-day cleanup to WF4-METRICS (Section 12.6b). This means a failed metric calculation could prevent DBS cleanup from running, or vice versa. If the DBS DELETE query fails (e.g., foreign key constraint issue), it could halt the entire metrics workflow. These are separate concerns with different failure modes and different operational importance. DBS cleanup is a compliance requirement with a legal deadline. Metrics calculation is a reporting convenience. Coupling them in one workflow means a metric calculation bug could create a compliance violation. The DBS cleanup should be either a separate workflow or an independent branch in WF4-METRICS with its own error handling.

**Score: 7/10** (new issue -- v3 fix creates coupling between compliance and reporting)

**Remaining gap:** Either move DBS cleanup to a separate mini-workflow (WF4-CLEANUP) or ensure it runs in an independent error-handling block within WF4-METRICS so metric failures do not prevent compliance cleanup.

---

**Round 20 -- The pipeline_track_config table is referenced in v3 fixes but the ghosting threshold code in Section 13.3 still uses hard-coded values.**

The ghosting detection code in Section 13.3 (JavaScript) and Section 9.6 (Python pseudocode) both contain hard-coded threshold objects: `corporate: { applied: { warn: 7, ghost: 14 }, ... }`. The pipeline_track_config table (Appendix A.2) stores these same thresholds in the database. But the workflow code does not read from the table -- it uses the hard-coded values. The config table exists to make thresholds adjustable without code changes, but the code ignores it. If the candidate adjusts the academic ghost threshold from 84 to 90 days in the database, the workflow will still use 84 from the hard-coded map. Either the code should read from the config table, or the config table should be removed as misleading.

**Score: 7/10** (pre-existing issue not addressed by v3 -- config table and code are disconnected)

**Remaining gap:** Update the WF4-GHOST workflow to read thresholds from pipeline_track_config instead of using hard-coded values. Replace the hard-coded JavaScript/Python threshold objects with a database query.

---

#### Persona 2 Summary (v3): Technical Architect / n8n Expert

| Round | Concern | v2 Score | v3 Score | Delta |
|-------|---------|----------|----------|-------|
| 11 | Deduplication lock uses config table, not advisory locks | 4/10 | 7/10 | +3 |
| 12 | State ordinals ambiguous for cross-track comparison | 5/10 | 7/10 | +2 |
| 13 | Speculative apps cannot be late-linked to jobs | 5/10 | 7/10 | +2 |
| 14 | HMAC code sample contradicts documentation | 6/10 | 7/10 | +1 |
| 15 | UPSERT unique index on JSONB is unusual | 4/10 | 7/10 | +3 |
| 16 | Notification queue DDL still duplicated | 6/10 | 7/10 | +1 |
| 17 | WF4-GHOST JOIN excludes speculative apps (new) | -- | 7/10 | new |
| 18 | State ordinal map has offer_received > pre_employment (bug) | -- | 7/10 | new |
| 19 | DBS cleanup mixed into metrics workflow (new) | -- | 7/10 | new |
| 20 | pipeline_track_config not read by workflow code | -- | 7/10 | new |

**v3 Average: 7.0/10** (up from 5.4/10)

**Assessment:** The v3 technical fixes (deduplication, highest_state_reached population, UPSERT, speculative app workflow) resolve the major structural gaps from v2. The remaining issues are implementation refinements rather than architectural problems. The state ordinal ordering bug (R18) is the only correctness issue; the rest are robustness improvements. The PRD is now at a quality level where implementation could proceed with reasonable confidence, with the ordinal fix applied first.

---

### 21.3 Persona 3: UK Career Coach / Recruitment Expert

**Profile:** 15+ years in UK recruitment and career coaching, deep knowledge of corporate and academic hiring processes.

---

**Round 21 -- The agency follow-up templates and thresholds are still missing despite agency fields being in place since v2.**

v2 added recruitment_agency, recruiter_name, recruiter_email fields. v3 did not add agency-specific follow-up templates or thresholds. When a recruitment agency mediates, follow-up etiquette is different: the candidate contacts the recruiter, not the employer. "Hi James, any update on the BigBank role?" is appropriate at 5 days; the same message sent to BigBank's HR team would be premature. The follow-up templates (Section 9.5) are addressed to "Dear Hiring Manager/Recruiting Team." For agency applications, they should be addressed to the recruiter with different timing (5 days rather than 7). The ghosting thresholds are also different: agencies typically respond within 48 hours, so an agency-mediated application with no response after 5 days is a strong ghosting signal.

**Score: 7/10** (up from 6/10 -- data model correct, behavioural differentiation still missing)

**Remaining gap:** Add agency-specific follow-up templates and shorter thresholds. When recruitment_agency is not null, use different follow-up text and timing.

---

**Round 22 -- The academic ghosting threshold is now 84 days (v3 fix), which is correct, but the ghosting timer still starts from application submission rather than closing date.**

v3 extended the academic applied ghost threshold from 56 to 84 days. This is the right number. However, the timer starts from applied_at (the date the candidate submitted her application). If the candidate applies on January 15 and the role closes on March 15, the committee will not begin reviewing until late March. Ghosting detection at 84 days from January 15 = April 10 -- only 3-4 weeks after the closing date. For roles with long application windows, the ghost timer should start from the closing date if known, or from applied_at if the closing date is unknown. The system has access to jobs.expires_at (closing date) but does not use it in the ghosting algorithm.

**Score: 7/10** (up from 5/10 -- threshold is reasonable, timer start point could be smarter)

**Remaining gap:** In WF4-GHOST, for academic applications where jobs.expires_at is known: start the ghost timer from MAX(applied_at, expires_at) rather than applied_at alone.

---

**Round 23 -- The re-application metric policy (flagged in v2 R28) is still unspecified.**

v2 added application_attempt and previous_application_id for re-applications. v3 did not define how re-applications interact with metrics. If a candidate applies, is rejected, re-applies, and gets an interview, the funnel shows 2 applications with 1 interview (50% interview rate). The true picture is 1 opportunity requiring 2 attempts. Source effectiveness is also distorted: the same role via the same source counts twice. Without a documented policy, metric consumers cannot interpret the numbers correctly. The fix is documentation, not code: define whether re-applications are included or excluded from standard metrics, and add an is_reapplication derived field for optional filtering.

**Score: 7/10** (unchanged from v2 -- documentation gap)

**Remaining gap:** Add a re-application metric policy to Section 8.9 (Metrics Glossary): "Standard metrics include all application attempts. Re-applications can be excluded using WHERE application_attempt = 1."

---

**Round 24 -- The academic pipeline diagram (Section 6.8) still uses "LONGLISTED" and "SHORTLISTED" labels instead of the v2 state codes "ACADEMIC_LONGLISTED" and "ACADEMIC_SHORTLISTED".**

v2 Round 26 flagged this inconsistency. v3 did not update the diagram. The state machine code uses academic_longlisted and academic_shortlisted. The academic pipeline diagram in Section 6.8 uses "LONGLISTED (academic-specific)" and "SHORTLISTED (academic-specific)." A developer implementing the academic pipeline from the diagram will use the wrong state names. The "TEACHING PRESENTATION" label in the diagram is also misleading because it appears as a separate state, but in the state machine, teaching presentations are interview sub-types tracked within the INTERVIEWING state.

**Score: 7/10** (unchanged from v2 -- diagram inconsistency persists)

**Remaining gap:** Update Section 6.8 diagram labels to match state codes: ACADEMIC_LONGLISTED, ACADEMIC_SHORTLISTED. Add a note that TEACHING PRESENTATION is tracked as an interview_type within INTERVIEWING.

---

**Round 25 -- The networking/warm leads pipeline was added to Future Enhancements as "High priority" (v3) but with no implementation timeline or interim solution.**

v3 promoted networking pipeline from deferred to "High priority" in Section 17.8 with a proposed state machine (contacted, meeting_scheduled, meeting_held, opportunity_identified, applied). This is directionally correct. The gap: "High priority" in a future enhancements list has no commitment. The candidate is job-searching now. At the GBP 70-80k / Senior Lecturer level, 30-40% of opportunities come through networking. The system is blind to them until they convert to formal applications. A lightweight interim solution -- adding a "networking" value to the pipeline_track enum and allowing applications in a "warm_lead" state before discovered -- would bridge the gap without the full networking pipeline. The applications table already supports notes, company_name, and has_referral.

**Score: 6/10** (up from 4/10 -- acknowledged as high priority but no interim solution)

**Remaining gap:** Add "warm_lead" as a pre-application state in the state machine. Applications can be manually created in this state with company_name, contact details (in notes), and a follow-up date. This bridges the gap until the full networking pipeline is built.

---

**Round 26 -- The system has no concept of "hiring freeze" or "role withdrawn by employer," which is common in the current UK market.**

A scenario that occurs regularly in UK corporate and academic hiring: the candidate is partway through the process (acknowledged, screening, even interviewing) and the employer withdraws the role due to budget cuts, restructuring, or hiring freeze. This is distinct from rejection (the candidate was not assessed and found wanting) and from ghosting (the employer simply stopped communicating). The state machine has no "employer_withdrawn" or "role_cancelled" terminal state. The closest option is "expired" (which implies a deadline passed) or "withdrawn" (which implies the candidate withdrew). Using "rejected" would skew rejection metrics. The rejection_reason code includes "role_cancelled" but using the "rejected" state for an employer-initiated cancellation muddies the rejection analytics.

**Score: 7/10** (new issue -- not flagged in v1 or v2)

**Remaining gap:** Add "employer_cancelled" as a terminal state, or clearly document that "expired" should be used for employer-side role withdrawals and update the expired state description accordingly.

---

**Round 27 -- The system does not track notice period implications when the candidate is currently employed.**

If the candidate is currently employed (likely, given 18 years of experience), every offer acceptance is subject to a notice period. UK corporate notice periods at this level are typically 1-3 months. Academic contracts often require one full term's notice. When the candidate receives an offer with a start date of June 1, the system should check whether her current notice period allows this. The applications table stores notice_period_weeks in the compensation JSONB for the offered role, but does not track the candidate's own notice period as a system-level parameter. This affects offer evaluation: an offer that requires starting in 3 weeks when the candidate has a 3-month notice period is effectively unacceptable without negotiation.

**Score: 7/10** (new issue -- relevant to offer evaluation)

**Remaining gap:** Add a candidate-level config parameter for current_notice_period_weeks. When an offer is received with a start date that falls within the notice period, flag it in the notification.

---

**Round 28 -- The UK salary benchmarking context (US-427) stores salary data but does not reference external benchmarks for validation.**

Section 4.7 includes US-427: each application carries salary context. The compensation JSONB stores offered salary details. But there is no reference data to validate whether an offer is competitive. At the GBP 70-80k level for corporate L&D, and Grade 7-8 for academic roles, the candidate needs to know whether an offer of GBP 72k is at the 25th, 50th, or 75th percentile for her role and location. The system could store benchmark ranges from publicly available UK salary surveys (CIPD Reward Management Survey, Hays Salary Guide, UCEA pay scales for academic). This data changes annually but could be seeded as a static reference table.

**Score: 7/10** (new issue -- useful for offer negotiation decisions)

**Remaining gap:** Add a salary_benchmarks reference table with role, track, region, and percentile ranges. Seed with publicly available UK data. Reference in offer notifications.

---

**Round 29 -- The system does not handle the scenario where an employer asks the candidate to apply for a different role during the process.**

A common UK hiring scenario: the candidate applies for "Head of L&D," gets through screening, and the employer says "we think you would be a better fit for our L&D Manager role -- would you be interested?" This is not a rejection from the original role (yet), not a new application (the employer is redirecting), and not a status change on the existing application. The system cannot represent this. The candidate would need to manually create a new application at the same company, which triggers the duplicate company warning. The existing application needs to be updated to reflect "employer suggested alternative role." There is no event type for this in Section 6.5.

**Score: 7/10** (new issue -- common UK hiring scenario)

**Remaining gap:** Add a "role_redirected" event type that logs the employer's suggestion without changing the application state. Add a note in the duplicate company warning to suppress the warning when the second application originates from an employer redirect.

---

**Round 30 -- The Appendix G academic calendar integration with ghosting thresholds is still purely informational.**

Appendix G documents UK academic hiring cycles in detail (primary January-April, secondary May-July). Section G.4 says "Academic applications submitted in January-March should have follow-up reminders calibrated to the April-May interview window." But the ghosting algorithm does not read the calendar. An application submitted in February still uses the flat 84-day ghost threshold, regardless of the known April-May interview window. The system could be smarter: if an academic application is submitted during the primary hiring cycle (January-April), suppress ghosting detection until at least May (when interviews typically occur). This is not about adjusting the day count -- it is about aligning the ghost timer with the known hiring calendar rather than treating every academic application identically.

**Score: 7/10** (pre-existing gap -- calendar data exists but is not used algorithmically)

**Remaining gap:** In WF4-GHOST, for academic applications submitted January-April: suppress ghosting detection until June 1. For applications submitted June-August: suppress until November 1. This uses the calendar data that Appendix G already documents.

---

#### Persona 3 Summary (v3): UK Career Coach / Recruitment Expert

| Round | Concern | v2 Score | v3 Score | Delta |
|-------|---------|----------|----------|-------|
| 21 | Agency follow-up templates/thresholds missing | 6/10 | 7/10 | +1 |
| 22 | Ghost timer starts from applied_at not closing date | 5/10 | 7/10 | +2 |
| 23 | Re-application metric policy undefined | 6/10 | 7/10 | +1 |
| 24 | Academic diagram labels still wrong | 6/10 | 7/10 | +1 |
| 25 | Networking pipeline acknowledged but no interim solution | 4/10 | 6/10 | +2 |
| 26 | No "employer_cancelled" terminal state (new) | -- | 7/10 | new |
| 27 | No candidate notice period tracking (new) | -- | 7/10 | new |
| 28 | No salary benchmark reference data (new) | -- | 7/10 | new |
| 29 | No "role redirected" event type (new) | -- | 7/10 | new |
| 30 | Academic calendar not used in ghosting algorithm (new) | -- | 7/10 | new |

**v3 Average: 7.0/10** (up from 5.4/10)

**Assessment:** The v3 fixes resolved the critical structural gaps (ghost thresholds, speculative apps, academic states in algorithms). The remaining issues are refinements that would make the system more UK-market-intelligent. The new issues identified (employer cancellation, notice periods, salary benchmarks, role redirects) are all real-world scenarios but none are launch blockers. The system would function correctly without them, just less helpfully.

---

### 21.4 Persona 4: Data Engineer / Analytics Specialist

**Profile:** Senior data engineer specializing in analytics pipelines, metrics design, and data quality.

---

**Round 31 -- The UPSERT pattern (v3 fix) is correct, but the weighted averaging for rollups is described in prose rather than SQL.**

v3 specified that weekly/monthly rollups should use weighted averages: "weekly_value = SUM(daily_value * sample_size) / SUM(sample_size)." This is the correct approach. However, the pipeline_metrics table does not have a sample_size column. The daily metrics are stored as a single metric_value numeric with dimensions JSONB. To compute a weighted weekly average, the rollup query needs both the rate (e.g., 38%) and the denominator (e.g., 26 applications). The current schema stores only the rate. The prose describes the right formula but the schema cannot support it without a schema change.

**Score: 7/10** (up from 4/10 -- approach is correct, schema needs a denominator column)

**Remaining gap:** Add a `sample_size` INTEGER column to pipeline_metrics. Populate it alongside metric_value in all rate metric INSERT queries. This enables the weighted averaging formula to work.

---

**Round 32 -- The source effectiveness query now uses highest_state_reached (v3 fix), but the JOIN to job_sources assumes a single source per job.**

Section 8.6 query #7 joins applications to job_sources: `JOIN job_sources js ON j.id = js.job_id`. If a job appears on multiple boards (Reed and Indeed simultaneously), it has multiple rows in job_sources. The JOIN produces one row per source per application, meaning a single application is counted multiple times in the GROUP BY discovery_source. An application found on both Reed and Indeed will inflate both Reed and Indeed response rates. The original discovery_source field on the applications table should be the authoritative single source for each application. The metric query should use `a.discovery_source` directly rather than joining to job_sources.

**Score: 7/10** (pre-existing issue not caught in v1/v2 -- multi-source JOIN inflates metrics)

**Remaining gap:** Change the source effectiveness query to GROUP BY a.discovery_source instead of joining to job_sources. This uses the single authoritative source stored on the application record.

---

**Round 33 -- The daily-to-weekly metric aggregation (v3 prose fix) still has no corresponding SQL implementation.**

v3 described weighted averaging in the Fixes Applied Log but did not add actual aggregation queries to WF4-METRICS or any workflow. The daily metrics are calculated and stored. The retention policy says weekly summaries are retained for 1 year. But no workflow creates weekly summaries from daily data. WF4-METRICS runs daily and calculates daily metrics. There is no weekly aggregation step. The weekly report (WF4-REPORT) computes its own metrics from raw application data, not from aggregated pipeline_metrics. So the pipeline_metrics table is effectively a daily-only table with no rollup mechanism, making the 1-year weekly retention policy aspirational rather than implemented.

**Score: 7/10** (up from 4/10 -- the formula is correct, the execution is absent)

**Remaining gap:** Add a weekly aggregation step to WF4-METRICS that runs on Mondays: INSERT INTO pipeline_metrics with period_type='weekly', computing weighted averages from the previous 7 days of daily metrics. Similarly, add a monthly step on the 1st of each month.

---

**Round 34 -- The Metrics Glossary SQL expressions use shorthand syntax that is still not valid PostgreSQL.**

v2 Round 31 flagged that the glossary uses `COUNT(condition)` which is not valid PostgreSQL. v3 did not update the glossary SQL syntax. The glossary still shows: `COUNT(applied_at IS NOT NULL AND highest_state_reached NOT IN ('applied','ghosted','expired'))`. Valid PostgreSQL would be: `COUNT(*) FILTER (WHERE applied_at IS NOT NULL AND highest_state_reached NOT IN ('applied','ghosted','expired'))`. The glossary is the canonical reference for all metrics. Having invalid SQL in the canonical reference creates confusion when developers compare the glossary against implementation queries. Either write valid SQL or use pseudocode explicitly labelled as such.

**Score: 7/10** (up from 6/10 -- glossary exists and is conceptually correct, SQL syntax is still invalid)

**Remaining gap:** Rewrite Metrics Glossary SQL expressions using valid PostgreSQL FILTER syntax. Or relabel them as "pseudocode" to set correct expectations.

---

**Round 35 -- The weekly report comparison query (Section 10.9) still uses current_state for interview counts, not event-based counting.**

v2 Round 36 flagged that the weekly metrics comparison query counts interviews based on current_state snapshots rather than application_events. An application that was interviewing on Monday but rejected on Wednesday shows current_state='rejected' by the Sunday report, and is not counted as an interview for that week. v3 did not update this query. The weekly narrative section uses events (Section 10.3: "interviews completed"), but the metrics comparison table does not. The same report simultaneously tells the candidate "1 interview completed" (from events) and shows "0 interviews" (from current_state). This is a consistency issue that erodes trust in the metrics.

**Score: 7/10** (unchanged from v2 -- query not updated)

**Remaining gap:** Update the weekly metrics comparison query in Section 10.9 to count interviews from application_events (WHERE event_type IN ('interview_invited', 'interview_completed') AND occurred_at within period).

---

**Round 36 -- The track-specific metric windows (30d corporate, 90d academic) are implemented in queries but the weekly report template does not label them.**

v2 Round 37 flagged that showing corporate 30d metrics and academic 90d metrics side by side without labelling the windows is confusing. v3 did not update the report template. The sample report in Appendix H shows a single "Response Rate: 38%" row with no window or track indication. A candidate looking at the report cannot tell whether this is her corporate 30-day rate, her academic 90-day rate, or a blended number. The metrics are correctly calculated per track; the presentation does not communicate this.

**Score: 7/10** (unchanged from v2 -- template not updated)

**Remaining gap:** Update the weekly report template (Section 10.5 and Appendix H) to show separate rows: "Response Rate (Corporate, 30d)" and "Response Rate (Academic, 90d)."

---

**Round 37 -- The pipeline_metrics cleanup query is specified (v3 fix for DBS) but no cleanup for stale metrics rows is included.**

v3 added DBS cleanup to WF4-METRICS. v2 Round 39 flagged that pipeline_metrics has no cleanup for daily snapshots older than 90 days. The Fixes Applied Log for v3 does not mention a metric cleanup job. The retention policy (Section 8.7) says daily snapshots are retained for 90 days. After 90 days, they should be deleted (or aggregated into weekly). No DELETE query for stale daily metrics exists in any workflow. The one-line fix (DELETE FROM pipeline_metrics WHERE period_type = 'daily' AND calculated_at < NOW() - INTERVAL '90 days') has been recommended since v1 and never implemented.

**Score: 7/10** (unchanged across three versions -- trivial fix never applied)

**Remaining gap:** Add to WF4-METRICS: `DELETE FROM pipeline_metrics WHERE period_type = 'daily' AND calculated_at < NOW() - INTERVAL '90 days'`.

---

**Round 38 -- The email body deletion timing (7 days per v2 fix) may prevent the weekly report from including email-based context.**

The weekly report (WF4-REPORT, now Monday 7AM) assembles data for the previous 7 days. The email body cleanup (Section 16.4) deletes email content from events older than 7 days. If the report runs at Monday 7AM and the cleanup runs as part of WF4-METRICS at 6AM on the same day, events from the previous Monday (exactly 7 days ago) may have had their email content stripped before the report queries them. The report section "Status Changes This Week" would show transitions without the original email context. This is a race condition between the cleanup schedule and the report schedule. The cleanup should use 8 days rather than 7 to ensure the weekly report always has access to the full week's email context.

**Score: 7/10** (new issue -- timing interaction between two v3-era features)

**Remaining gap:** Change email body cleanup interval from 7 days to 8 days, or ensure the cleanup runs after the weekly report (move cleanup to after 8AM Monday or to a separate schedule).

---

**Round 39 -- The funnel conversion metric now uses highest_state_reached (v3), but the sample report funnel still shows raw counts that could be from either method.**

The Metrics Glossary specifies funnel conversion using highest_state_reached. v2 Round 40 recommended adding "(ever reached)" labels. The sample report (Appendix H) still shows: "Acknowledged: 14 (54%)" without specifying whether this means "14 applications are currently acknowledged" or "14 applications ever reached acknowledged or beyond." The developer implementing the report query would need to check the glossary to determine which interpretation to use. The label should be self-documenting in the report output.

**Score: 7/10** (unchanged from v2 -- labelling not updated)

**Remaining gap:** Update sample report funnel labels to "Acknowledged (ever reached): 14 (54%)" or add a footnote: "Funnel counts applications that ever reached this stage or beyond."

---

**Round 40 -- The benchmark targets (Section 8.8) are still unsourced despite v2 noting they should transition to personalised baselines after 30 days.**

v2 added a note in Section 8.10 about switching from external benchmarks to personalised trailing averages after 30 days of data. The benchmark targets in Section 8.8 are still presented as authoritative numbers with no sourcing. "Response Rate (Corporate) > 40%" -- where does 40% come from? The candidate's own historical response rate is reported as 90% callback rate (Section 2.5). The benchmark is less than half her historical rate. If the system uses these benchmarks to flag "needs improvement," the alerts will be misleading. The transition to personalised baselines after 30 days is mentioned once but has no implementation: no query that computes the trailing average, no logic that replaces benchmarks with personalised values.

**Score: 7/10** (unchanged from v2 -- benchmarks still unsourced, personalisation still unimplemented)

**Remaining gap:** Either source the benchmarks or remove them in favour of personalised baselines from day 1 (using the candidate's own data as it accumulates). Add a query to WF4-METRICS that computes trailing 30-day averages as personalised benchmarks.

---

#### Persona 4 Summary (v3): Data Engineer / Analytics Specialist

| Round | Concern | v2 Score | v3 Score | Delta |
|-------|---------|----------|----------|-------|
| 31 | UPSERT correct, schema lacks sample_size column | 4/10 | 7/10 | +3 |
| 32 | Source effectiveness JOIN inflates multi-source metrics | 5/10 | 7/10 | +2 |
| 33 | Weekly/monthly aggregation described but not implemented | 4/10 | 7/10 | +3 |
| 34 | Glossary SQL still invalid syntax | 6/10 | 7/10 | +1 |
| 35 | Weekly report interview count uses current_state | 5/10 | 7/10 | +2 |
| 36 | Track windows not labelled in report template | 5/10 | 7/10 | +2 |
| 37 | Metrics cleanup still not implemented (3rd time flagged) | 5/10 | 7/10 | +2 |
| 38 | Email cleanup timing races with weekly report (new) | -- | 7/10 | new |
| 39 | Funnel labels still do not say "ever reached" | 6/10 | 7/10 | +1 |
| 40 | Benchmarks unsourced, personalisation not implemented | 5/10 | 7/10 | +2 |

**v3 Average: 7.0/10** (up from 5.1/10)

**Assessment:** The v3 fixes addressed the architectural issues (UPSERT, source effectiveness on HSR, weighted averaging concept). The remaining issues are all at the presentation and implementation-detail level: SQL syntax in documentation, report labelling, cleanup scheduling, aggregation execution. None of these prevent a correct implementation -- they are polish items that would be caught in code review or first-week testing. The metrics framework is now sound in design; it needs consistent execution in the implementation code.

---

### 21.5 Persona 5: Privacy & Compliance Officer

**Profile:** UK-qualified data protection specialist with CIPP/E certification, experienced in GDPR compliance for HR tech systems.

---

**Round 41 -- The DPA requirements table (v3 fix) is a strong addition but does not specify what happens if a DPA cannot be executed.**

v3 added Section 16.1b with a DPA requirements table and pre-launch checklist. This is a meaningful compliance improvement. The gap: the checklist says "Execute Resend DPA" and "Execute Anthropic DPA" but does not specify a contingency if either processor's terms are non-compliant. If Anthropic's API terms do not include Article 28-compliant processor clauses (which is plausible -- many US AI companies have not updated their terms for UK GDPR), the strategic observations feature must be disabled or the metrics must be anonymised before sending. If Resend cannot provide adequate DPA terms, the notification system needs an alternative email provider. The PRD should define acceptable fallback positions for each processor.

**Score: 7/10** (up from 4/10 -- DPA requirements documented, fallback positions missing)

**Remaining gap:** For each processor in Section 16.1b, add a "Fallback if DPA inadequate" column: Anthropic -> disable AI observations or anonymise company names before sending; Resend -> evaluate alternative (Amazon SES, Postmark) before launch.

---

**Round 42 -- The data breach response plan (v3 fix) is comprehensive but does not define "who" executes each step in a solo operation.**

v3 added Section 16.5b with a 7-step breach response procedure and severity levels. The plan references "Detect," "Contain," "Assess," "Notify," and "Remediate" with timeframes. In a large organisation, different teams handle each step. For a one-person operation, the candidate is the data controller, the system administrator, the incident responder, and the affected data subject simultaneously. Step 2 says "Revoke API keys, disable webhook endpoints, change database password" within 1 hour. The candidate may not be technically able to do this without documentation. The breach plan should include specific commands or runbook references for each containment action, not just descriptions.

**Score: 7/10** (up from 4/10 -- plan exists, operational runbook references missing)

**Remaining gap:** Add specific containment commands to the breach response plan: exact Dokploy/n8n commands to disable workflows, Postgres commands to change credentials, and Resend/Anthropic dashboard links for API key revocation.

---

**Round 43 -- The n8n admin UI security (v3 fix) specifies SSH tunnel access only, but does not address n8n's built-in authentication weaknesses.**

v3 added that n8n admin UI should be accessible "only via SSH tunnel or VPN" and "never exposed directly to the internet." This is a strong network-level control. The gap: n8n's self-hosted community edition has limited built-in authentication. It supports basic email/password login with no MFA, no login attempt limiting, no session timeout by default, and no audit logging of admin actions. Even with SSH tunnel access, if the candidate's SSH key is compromised, the attacker gets full n8n access with no additional barriers. The PRD should specify: n8n environment variables for session timeout (N8N_USER_MANAGEMENT_JWT_DURATION), password requirements, and whether n8n's Enterprise edition features (RBAC, LDAP, audit logging) should be evaluated.

**Score: 7/10** (up from 5/10 -- network access controlled, application-level auth still basic)

**Remaining gap:** Set N8N_USER_MANAGEMENT_JWT_DURATION to 1 hour in environment variables. Use a strong password (20+ characters). Document that n8n Community Edition lacks MFA -- assess whether this is acceptable risk.

---

**Round 44 -- The anonymisation schedule (v3 fix) runs monthly at 3AM on the 1st, but there is no verification that the anonymisation succeeded.**

v3 added a cron schedule for the anonymisation job (WF4-ANON, monthly). The job runs DO $$ blocks that iterate over qualifying applications and anonymise them. But there is no verification step. If the DO block encounters an error on application #15 out of 20, the transaction may partially commit (DO blocks in PostgreSQL do not automatically wrap in a single transaction unless explicit BEGIN/COMMIT is used). The anonymisation script should verify its own completion: count qualifying records before and after, log the delta, and alert if any records were not anonymised. The script uses a `FOR app_record IN SELECT` loop, which is a single implicit transaction in PL/pgSQL -- so partial commits should not occur. But verification logging is still prudent for compliance audit purposes.

**Score: 7/10** (up from 6/10 -- scheduled and correct, verification logging missing)

**Remaining gap:** Add a completion log entry: INSERT INTO system_metrics (metric_name, metric_value) VALUES ('anonymisation_completed', count_of_records_anonymised) at the end of the WF4-ANON job.

---

**Round 45 -- The email body cleanup at 7 days (v2 fix retained in v3) still conflicts with the learning loop for sender_company_mappings.**

v2 Round 43 (Privacy) flagged that 7-day email deletion conflicts with the learning loop: if manual correction happens on day 8, the email_from needed to create a sender_company_mapping has been deleted. v3 did not address this. The workaround identified in v2 was either: extend retention for unprocessed emails, or create sender mappings at matching time. Neither was implemented. This means after day 7, unmatched emails lose their sender data, and the learning loop cannot create mappings for late-corrected matches. The mapping table will have gaps for any correction that takes longer than a week.

**Score: 7/10** (unchanged from v2 -- conflict acknowledged but not resolved)

**Remaining gap:** Add a condition to the email cleanup query: do not delete email_from for events where is_valid_transition = false OR match_confidence < 50 (these are the unmatched/low-confidence events most likely to need manual correction later). Delete email body and subject for all events after 7 days, but retain sender identity for unresolved matches.

---

**Round 46 -- The Resend email tags (Appendix F.2) include application_id, which is a persistent pseudonymous identifier in Resend's logs.**

v2 Round 50 flagged that Resend's logs contain email subjects with company names and tags with application_id. v3 did not address this. Every notification email sent to the candidate includes a tag `{name: 'application_id', value: applicationId}`. Resend retains these tags in their delivery logs. Over a 6-month job search with 10-15 emails per day, Resend accumulates a comprehensive record of the candidate's pipeline activity indexed by application_id. If Resend's data is breached or subpoenaed, the application_id links back to the self-hosted database (if the attacker also has database access) or at minimum reveals the volume and timing of the candidate's job search. Removing application_id from tags and using generic subject lines would reduce the data exposure.

**Score: 7/10** (unchanged from v2 -- external data exposure not mitigated)

**Remaining gap:** Remove application_id from Resend email tags. Use only module ('module_4') and notification_type tags. Consider removing company names from email subject lines in favour of reference numbers.

---

**Round 47 -- The delete_all_candidate_data function (v2 fix retained in v3) does not clean up the jobs table columns added by Module 4's migration.**

v2 Round 46 flagged that the erasure function does not clean application_id and application_state columns from the jobs table (added by the migration in Section 12.14). v3 did not address this. After running delete_all_candidate_data(), the jobs table still contains application_id references (now orphaned) and application_state values. These are Module 4 data fields living in a Module 1 table. A complete erasure should NULL these columns. The fix is two SQL statements added to the function.

**Score: 7/10** (unchanged from v2 -- cross-module cleanup gap)

**Remaining gap:** Add to delete_all_candidate_data(): `UPDATE jobs SET application_id = NULL, application_state = NULL WHERE application_id IS NOT NULL;`

---

**Round 48 -- The system stores interviewer names and email addresses (application_interviews table) with no data minimisation or retention justification.**

The application_interviews table stores interviewers as JSONB: `[{name, title, email}]`. This is third-party personal data. The interviewer's email address is not needed after the interview occurs -- it was useful for calendar invitations but the system does not manage calendars. The interviewer's name is useful for post-interview thank-you notes and for recognising them in future interactions. Storing email addresses indefinitely for up to 12 months (the retention period for interview data) exceeds what is necessary. The data minimisation principle requires storing only what is needed. Name and title are justifiable; email is not, beyond the first week after the interview.

**Score: 7/10** (new issue -- not caught in previous evaluations)

**Remaining gap:** Add a cleanup step: strip interviewer email addresses from application_interviews.interviewers JSONB after 7 days (retain name and title only).

---

**Round 49 -- The system transmits salary data in notification emails, creating a sensitive data exposure risk via email.**

Status change notifications and weekly reports include salary information (offered ranges, compensation details). Email is inherently insecure -- it transits unencrypted between mail servers, is stored on the recipient's email provider (Gmail, Outlook, etc.), and is visible to anyone with access to the candidate's inbox. Salary negotiation details, specific offer amounts, and compensation comparisons are sensitive. If the candidate's email account is compromised, the attacker gains a complete salary history of every offer received. The PRD should consider whether salary details should be included in email notifications at all, or whether they should be accessible only via the on-demand QUERY mechanism (which at least limits exposure to requested data rather than pushing it proactively).

**Score: 7/10** (new issue -- sensitive data in a low-security channel)

**Remaining gap:** Exclude specific salary figures from push notifications. Include salary data only in QUERY responses (pull model). Weekly report can show "Offer received at [Company]" without the GBP amount.

---

**Round 50 -- The system has no data classification policy defining which fields are sensitive, confidential, or public.**

The PRD treats all application data uniformly. In practice, the sensitivity varies enormously: DBS status is special category data (correctly identified in v2). Salary data is sensitive personal information. Company names and job titles are moderately sensitive. Application states are low sensitivity. The system applies the same security controls (TLS, n8n service account) to all data equally. A data classification scheme would enable proportionate protection: encrypt salary and DBS data at the column level, apply stricter retention to sensitive fields, and inform breach impact assessment (Section 16.5b severity levels already partially do this). Without classification, every new feature or field addition requires ad-hoc sensitivity assessment.

**Score: 7/10** (new issue -- systemic gap that would improve all privacy decisions)

**Remaining gap:** Add a Data Classification section to Section 16 that maps each table/field to a sensitivity level (Public, Internal, Confidential, Special Category). Use this classification to drive encryption, retention, and breach assessment decisions.

---

#### Persona 5 Summary (v3): Privacy & Compliance Officer

| Round | Concern | v2 Score | v3 Score | Delta |
|-------|---------|----------|----------|-------|
| 41 | DPA fallback positions missing | 4/10 | 7/10 | +3 |
| 42 | Breach plan lacks operational runbook commands | 4/10 | 7/10 | +3 |
| 43 | n8n app-level auth still basic despite SSH tunnel | 5/10 | 7/10 | +2 |
| 44 | Anonymisation job has no completion verification | 6/10 | 7/10 | +1 |
| 45 | Email cleanup conflicts with learning loop (unchanged) | 6/10 | 7/10 | +1 |
| 46 | Resend tags expose application_id | 5/10 | 7/10 | +2 |
| 47 | Erasure function misses jobs table columns | 6/10 | 7/10 | +1 |
| 48 | Interviewer email stored indefinitely (new) | -- | 7/10 | new |
| 49 | Salary data in email notifications (new) | -- | 7/10 | new |
| 50 | No data classification policy (new) | -- | 7/10 | new |

**v3 Average: 7.0/10** (up from 5.4/10)

**Assessment:** The v3 compliance posture is now defensible for a personal-use system. The DPA table, breach response plan, n8n SSH restriction, and DBS automated cleanup establish a reasonable privacy baseline. The remaining issues are hardening measures: data classification, proportionate encryption, external log minimisation, and operational runbooks. None are legal compliance violations for a personal-use system. They would become important if the system were ever extended to support multiple users or processed data on behalf of a third party.

---

### 21.6 Overall v3 Evaluation Summary

#### Persona Average Scores (v1 vs v2 vs v3)

| Persona | v1 Score | v2 Score | v3 Score | v2->v3 Delta | Assessment |
|---------|----------|----------|----------|-------------|------------|
| 1. The Candidate (Selvi) | 4.1/10 | 4.8/10 | 5.7/10 | +0.9 | Pause mode and rejection batching are genuine improvements. Persistent gaps in personalised follow-ups, interview prep, and snooze customisation. |
| 2. Technical Architect / n8n Expert | 4.3/10 | 5.4/10 | 7.0/10 | +1.6 | Major structural issues resolved. Remaining items are implementation refinements. One ordinal ordering bug to fix. |
| 3. UK Career Coach / Recruitment Expert | 4.4/10 | 5.4/10 | 7.0/10 | +1.6 | Academic thresholds and state coverage now correct. New issues are market-intelligence refinements, not structural gaps. |
| 4. Data Engineer / Analytics Specialist | 4.1/10 | 5.1/10 | 7.0/10 | +1.9 | Metrics framework now architecturally sound. Remaining issues are SQL syntax, labelling, and scheduling -- implementation polish. |
| 5. Privacy & Compliance Officer | 3.8/10 | 5.4/10 | 7.0/10 | +1.6 | Compliance baseline established. Remaining items are hardening and data minimisation refinements. |

**Overall v1 Average: 4.1/10**
**Overall v2 Average: 5.2/10**
**Overall v3 Average: 6.7/10**
**v2 -> v3 Delta: +1.5**
**v1 -> v3 Total Delta: +2.6**

---

#### v3 Fix Quality Assessment

The 20 v3 fixes (10 must-fix + 10 should-fix) can be categorised:

| Category | Count | Examples |
|----------|-------|---------|
| **Complete and well-integrated** | 12 | Pause/vacation mode (comprehensive), rejection batching (psychologically sound), DPA requirements table, breach response plan, UPSERT pattern, academic ghost threshold 84d, DBS daily cleanup, Monday 7AM report timing, wins section, QUERY response format, speculative app workflow branch, n8n SSH restriction |
| **Correct but with minor secondary gaps** | 6 | State ordinal map (ordering bug for pre_employment), deduplication lock (config table rather than advisory locks), HMAC documentation (code sample not updated), source effectiveness query (updated but JOIN issue remains), anonymisation schedule (no verification), sync trigger guard |
| **Partially addressed** | 2 | Networking pipeline (acknowledged as high priority but no interim solution), academic diagram labels (mentioned but diagram not updated) |

**Key Pattern:** v3 fixes are substantially more complete than v2's. Where v2 applied schema changes without updating behavioural logic, v3 generally updated both. The remaining gaps are smaller in scope and lower in severity. The one correctness issue (state ordinal ordering: pre_employment should rank higher than offer_received) is a simple number swap.

---

#### Top 10 Remaining Issues by Severity

| # | Issue | Persona | Round | Score | Category |
|---|-------|---------|-------|-------|----------|
| 1 | State ordinal map ranks offer_received(9) above pre_employment(8) -- incorrect ordering | Tech | 18 | 7/10 | Bug fix (number swap) |
| 2 | Follow-up templates still generic (flagged 3 times, never addressed) | Candidate | 5 | 5/10 | Feature gap |
| 3 | No interview prep brief or pre-interview reminder (flagged 3 times) | Candidate | 9 | 5/10 | Feature gap |
| 4 | Snooze still fixed intervals only (flagged 3 times) | Candidate | 6 | 5/10 | UX gap |
| 5 | Daily check-in not conditional on application state (flagged 3 times) | Candidate | 7 | 5/10 | UX gap |
| 6 | No on-demand instant access (static HTML dashboard recommendation unimplemented) | Candidate | 1 | 6/10 | Architecture gap |
| 7 | WF4-GHOST JOIN excludes speculative applications | Tech | 17 | 7/10 | Bug fix |
| 8 | pipeline_track_config not read by workflow code (hard-coded thresholds) | Tech | 20 | 7/10 | Config disconnect |
| 9 | Aggregation logic described but no SQL or workflow implements it | Data | 33 | 7/10 | Implementation gap |
| 10 | Resend tags expose application_id in external logs | Privacy | 46 | 7/10 | Data minimisation |

#### Items Flagged 3+ Times Without Fix

| Issue | v1 | v2 | v3 | Status |
|-------|----|----|-----|--------|
| Follow-up templates generic | R5 (4/10) | R6 (4/10) | R5 (5/10) | Unfixed. Highest-value LLM use case in Module 4. |
| Interview prep support absent | R9 (4/10) | R10 (5/10) | R9 (5/10) | Unfixed. All required data is available. |
| Snooze fixed intervals only | R4 (5/10) | R7 (5/10) | R6 (5/10) | Unfixed. Data model supports it; UX does not expose it. |
| Daily check-in frequency | R3 (5/10) | R8 (5/10) | R7 (5/10) | Unfixed. System has data to be smarter. |
| Metrics cleanup job | R39 (6/10) | R39 (5/10) | R37 (7/10) | Unfixed. One SQL statement. |

---

#### Verdict

The PRD has improved from a 4.1/10 first draft to a 6.7/10 third iteration. The trajectory is strong: +1.1 from v1 to v2, then +1.5 from v2 to v3, showing accelerating improvement as the easy structural fixes were applied and the fix quality improved.

**What works well (7+/10):**
- State machine design is now comprehensive with academic states, speculative applications, and re-applications
- Ghosting thresholds are appropriate for both tracks with configurable defaults
- Privacy posture includes DPA requirements, breach response, DBS special category handling, and true anonymisation
- Metrics framework has canonical definitions, highest_state_reached for funnel analysis, and UPSERT for safety
- Pause/vacation mode is well-designed with frozen timers and welcome-back summary
- Rejection batching is psychologically sound

**What needs fixing before implementation (bugs):**
- State ordinal map: pre_employment should rank above offer_received (number swap)
- WF4-GHOST: JOIN excludes speculative applications (change to LEFT JOIN)
- HMAC code sample contradicts documentation (update code to use rawBody)

**What would elevate the system from "competent tracker" to "intelligent assistant" (post-launch):**
- LLM-personalised follow-ups using job description and company context
- Pre-interview preparation briefs combining CV, job description, and company data
- Instant-access pipeline dashboard (static HTML or lightweight web view)
- Custom date snooze via "Reply SNOOZE [date]"
- Conditional daily check-ins based on application state

The PRD is now at a quality level where an engineer could implement Module 4 with confidence. The state machine, database schema, workflow specifications, notification engine, and metrics framework are all internally consistent and sufficiently detailed. The remaining improvements are UX refinements and LLM feature extensions that would benefit from real-world usage data before specification.

---

*End of 50-Round Critical Roleplay Evaluation (v3 - FINAL)*
