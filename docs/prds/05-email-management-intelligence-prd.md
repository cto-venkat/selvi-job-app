# Module 5: Email Management & Intelligence System -- Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-29
**Author:** Selvi Job App Engineering
**Status:** Draft
**System:** Selvi Job App
**Module:** 05 -- Email Management

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Gmail Integration & Monitoring](#6-gmail-integration--monitoring)
7. [AI Email Classification Engine](#7-ai-email-classification-engine)
8. [Data Extraction Pipeline](#8-data-extraction-pipeline)
9. [Auto-Labeling & Organization](#9-auto-labeling--organization)
10. [Recruiter Relationship Management](#10-recruiter-relationship-management)
11. [Response Drafting & Templates](#11-response-drafting--templates)
12. [Urgent Notification System](#12-urgent-notification-system)
13. [Database Schema](#13-database-schema)
14. [n8n Workflow Specifications](#14-n8n-workflow-specifications)
15. [Integration with Modules 1, 3, 4, 6](#15-integration-with-modules-1-3-4-6)
16. [Error Handling & Monitoring](#16-error-handling--monitoring)
17. [Privacy & Compliance (GDPR, Email Processing)](#17-privacy--compliance-gdpr-email-processing)
18. [Rollout Plan](#18-rollout-plan)

---

## 1. Executive Summary

The Email Management & Intelligence System is the communication hub of the Selvi Job App pipeline. It sits between the candidate's Gmail inbox (chellamma.uk@gmail.com) and the rest of the automated job application system, monitoring, classifying, extracting data from, and organizing every job-search-related email that arrives.

During an active job search, the inbox becomes the primary interface for employer communication. Interview invitations arrive as emails. Rejection notices arrive as emails. Recruiter outreach arrives as emails. Application acknowledgments arrive as emails. Job alert digests from LinkedIn, Indeed, TotalJobs, and Reed arrive as emails. In any given week of serious searching, a candidate might receive 30-80 job-related emails mixed into their regular personal and professional correspondence. Without a system to process these, critical signals get buried in noise.

This module solves four problems simultaneously:

1. **Signal detection.** It identifies which emails matter -- interview invitations, recruiter outreach, follow-up requests -- and separates them from bulk acknowledgments and marketing noise. A missed interview invitation buried under 40 job alert digests is the kind of failure this system prevents.

2. **Data extraction.** It pulls structured information out of unstructured email text -- company names, role titles, interview dates and times, contact persons, next action steps -- and feeds that data into the Application Tracker (Module 4) and Interview Scheduling (Module 6). The candidate should never have to manually copy an interview date from an email into a calendar.

3. **Inbox organization.** It auto-labels emails in Gmail using a structured label hierarchy (Job/Applied, Job/Interview, Job/Rejected, Job/Recruiter, Job/Alert, Job/Offer, Job/Follow-Up), turning a chaotic inbox into an organized workspace. The candidate can glance at label counts and know immediately how many interview invitations are pending action.

4. **Relationship tracking.** It maintains a record of recruiter interactions -- who reached out, when, about what roles, how relevant those roles were, and whether the relationship is worth cultivating. Over time, this builds a picture of which recruiters and agencies consistently bring strong opportunities.

The system uses Claude AI for email classification and data extraction. Each incoming email is analyzed by Claude Haiku for fast, inexpensive classification (identifying the email type and extracting key fields), with Claude Sonnet reserved for ambiguous cases where Haiku's confidence is below threshold. The classification taxonomy covers eight categories: application acknowledgment, rejection, interview invitation, recruiter outreach, job alert, offer, follow-up request, and generic marketing.

Gmail integration uses the Gmail API through n8n's native Gmail node with OAuth2 authentication. The system polls for new messages every 5 minutes during business hours and every 15 minutes overnight. It processes both plaintext and HTML emails, stripping HTML to extract readable content while preserving structural information (tables, lists, bold text) that aids classification accuracy.

All email metadata and classification results are stored in Postgres, with the full email body stored only long enough for processing and then discarded to maintain GDPR compliance. Extracted structured data (company, role, dates, contacts) persists as it forms part of the application tracking record.

Outbound capabilities include auto-drafting professional responses for common scenarios (interview confirmations, acknowledgment-of-receipt replies, and follow-up responses) and sending urgent notifications via Resend when time-sensitive emails arrive. Drafts are created in Gmail for the candidate to review before sending -- the system never sends responses automatically without explicit candidate approval.

The system integrates with:
- **Module 1 (Job Discovery):** Parses job alert emails from LinkedIn, Indeed, TotalJobs, and Reed as a supplementary job discovery source, feeding discovered jobs into the Module 1 pipeline.
- **Module 3 (Auto-Apply):** Receives application confirmation emails and correlates them with submitted applications.
- **Module 4 (Application Tracker):** Feeds status updates (acknowledged, rejected, interview scheduled, offer received) directly into the application lifecycle tracker.
- **Module 6 (Interview Scheduling):** Extracts interview date, time, location, format (phone/video/in-person), and interviewer details and pushes them to the scheduling module.

The system runs on the existing infrastructure at deploy.apiloom.io (Hetzner CAX31 ARM server) using n8n workflows, with Claude API for AI processing and Postgres for data storage. Incremental cost is estimated at GBP 15-25/month (primarily Claude API usage for email classification), well within the existing budget envelope.

---

## 2. Problem Statement

### 2.1 The Email Overload Problem

An active UK job search generates a surprising volume of email. Consider a typical week for a candidate who has:

- Set up job alerts on 6-8 platforms (LinkedIn, Indeed, TotalJobs, Reed, CV-Library, Guardian Jobs, jobs.ac.uk, CIPD)
- Applied to 8-12 positions
- Had 2-3 previous applications in interview stages
- Been contacted by 3-5 recruiters

That week's inbox receives:

| Email Type | Typical Volume | Time Sensitivity |
|------------|---------------|-----------------|
| Job alert digests | 15-30 per week | Low -- processed by Module 1 |
| Application acknowledgments | 8-12 per week | Low -- confirmation only |
| Rejections | 3-5 per week | Low -- informational only |
| Interview invitations | 1-3 per week | HIGH -- require response within 24-48 hours |
| Recruiter outreach (new) | 3-5 per week | Medium -- worth prompt response |
| Recruiter follow-ups | 2-4 per week | Medium -- ongoing conversation |
| Follow-up requests | 1-2 per week | HIGH -- employer expects response |
| HR administrative (references, docs) | 1-2 per week | Medium -- deadlines vary |
| Job board marketing | 5-10 per week | None -- noise |
| Generic career content | 3-5 per week | None -- noise |

Total: 40-80 job-related emails per week, mixed into whatever personal and professional email already arrives. The high-priority emails (interview invitations, follow-up requests) represent perhaps 3-5% of the total job-related volume but carry 80% of the consequence if missed.

### 2.2 The Missed Signal Problem

The cost of missing an interview invitation email is not "inconvenience." It is a lost opportunity that cannot be recovered. Consider the failure modes:

**Failure Mode 1: Buried in Alerts**
A recruiter sends an interview invitation at 2:30 PM. The candidate, who checks email twice a day, does not see it until 8:00 PM because it landed between a LinkedIn daily digest and a TotalJobs alert. The email asked for available times this week. By the time she responds, the employer has already filled the interview slots with faster-responding candidates.

**Failure Mode 2: Misclassified as Rejection**
Some company HR systems send interview invitations from the same noreply@ address that sent the rejection template for a different role at the same company. The candidate, scanning subject lines quickly, assumes it is another rejection and does not open it until the next day.

**Failure Mode 3: Lost in Threading**
An employer replies to the original application email with an interview request. Gmail threads it under the original "Application Received" email, which the candidate has already read and mentally dismissed. The interview invitation sits unread in a "completed" thread.

**Failure Mode 4: Recruiter Ghosting (Unintentional)**
A recruiter sends a role description for a strong match. The candidate intends to respond but gets distracted by three other emails that arrived the same hour. Two days later, the recruiter has moved on to other candidates. The opportunity is gone not because the candidate was not interested but because the email did not get the attention it deserved when it arrived.

Each of these failure modes has happened to real candidates in real job searches. They are not edge cases -- they are the normal experience of managing a job search through a general-purpose email inbox.

### 2.3 The Manual Classification Problem

Without automation, the candidate must perform email triage herself: opening each email, reading enough to classify it, deciding what action it requires, remembering to take that action later, and somehow keeping track of which emails have been handled and which have not. This is mentally taxing work that adds 15-30 minutes per day to the job search -- time better spent on applications and interview preparation.

The candidate is also maintaining a mental model of application status. "Did Acme Corp acknowledge my application? Which recruiter sent me that senior L&D role last week? When is the Oxford Brookes interview -- was it Tuesday or Wednesday?" These are questions that should be answered instantly by a system, not by searching through an inbox.

### 2.4 The Relationship Tracking Problem

Recruiters are a significant source of opportunities, particularly in the UK L&D market where many roles at the GBP 70-80k level are filled through agencies. But recruiter relationships require management:

- A good recruiter who consistently sends relevant roles deserves prompt responses and relationship investment.
- An agency that sends irrelevant roles weekly is wasting time and should be deprioritized.
- A recruiter who reached out about a specific role three weeks ago should be followed up with if no response was received.
- When a new recruiter contacts her, the candidate should know if their agency has been in touch before.

Without a tracking system, recruiter relationships are managed through memory and inbox search -- neither of which scales.

### 2.5 The Context Switching Problem

Every time the candidate opens her inbox to check for job emails, she is pulled out of whatever she was doing. If she is working on a cover letter, the context switch to email triage and back costs 10-15 minutes of productive time. If she is preparing for an interview, the cognitive load of processing unrelated emails degrades her preparation.

The ideal state is that the candidate never checks email for job-related communication. Instead, the system checks email continuously and surfaces only what requires her attention, at the moment it requires her attention, with the context she needs to take action.

### 2.6 The Integration Gap

Modules 1 through 4 of the Selvi Job App handle discovery, application generation, submission, and tracking. But there is a gap between "application submitted" (Module 3 output) and "application status updated" (Module 4 input). That gap is email. When an employer acknowledges an application, rejects a candidate, or invites for an interview, the signal comes via email. Without Module 5 to bridge this gap, Module 4 has no visibility into post-submission status changes, and the candidate must manually update the tracker -- defeating the purpose of an automated pipeline.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Classify all job-related emails accurately | 95%+ classification accuracy | Weekly manual audit of 20 random emails |
| Extract structured data from classified emails | 90%+ field extraction accuracy | Weekly manual audit against source emails |
| Surface interview invitations within 5 minutes | Median notification latency < 5 minutes from email arrival | Timestamp comparison: email received vs. notification sent |
| Eliminate missed interview invitations | 0 missed interview invitations per month | Monthly retrospective audit |
| Reduce manual inbox triage time | From 15-30 min/day to < 2 min/day | Self-reported time tracking |
| Keep Gmail inbox organized | 100% of job emails auto-labeled within 10 minutes | Label audit, weekly |

### 3.2 Secondary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Track recruiter relationship quality | 90% of recruiter interactions logged | Monthly audit of recruiter_contacts table vs. inbox |
| Auto-draft responses for standard scenarios | Drafts created for 80%+ of interview invitations and acknowledgments | Draft creation rate from email_processing_log |
| Feed application status updates to Module 4 | 95%+ of status-change emails trigger Module 4 updates | Cross-reference Module 4 status log with classified emails |
| Parse job alerts as supplementary discovery source | 90%+ of job alert links extracted and deduplicated | Compare extracted jobs against Module 1 database |
| Maintain GDPR compliance | 0 data retention violations | Quarterly compliance audit |
| System uptime | 99.5%+ processing uptime during business hours | Monitoring dashboard |

### 3.3 Success Metrics (Weekly Dashboard)

- **Total emails processed** (target: 40-80 per week during active search)
- **Classification breakdown** by category (acknowledgment, rejection, interview, recruiter, alert, offer, follow-up, marketing)
- **Classification confidence** -- average confidence score from Claude, flagged when below threshold
- **Extraction accuracy** -- percentage of emails where all expected fields were successfully extracted
- **Notification latency** -- p50, p90, p99 time from email arrival to urgent notification sent
- **Response draft rate** -- percentage of actionable emails that had drafts auto-created
- **Gmail label accuracy** -- percentage of emails correctly labeled (spot-checked weekly)
- **Module 4 sync rate** -- percentage of status-change emails that successfully updated application tracker
- **Recruiter interactions logged** -- count of new recruiter contacts and interactions recorded
- **Processing errors** -- count and type of emails that failed classification or extraction
- **Claude API cost** -- daily and weekly spend on email classification
- **False positive rate** -- emails classified as job-related that were not
- **False negative rate** -- job-related emails that the system missed entirely

### 3.4 Anti-Goals

These are explicitly out of scope for Module 5 v1.0:

| Anti-Goal | Rationale |
|-----------|-----------|
| Automatically send email responses without candidate review | Risk of sending inappropriate responses to employers. All auto-drafted responses are created as Gmail drafts for candidate review and manual send. |
| Process non-job-related emails | The system should ignore personal emails, newsletters unrelated to jobs, and other non-job correspondence. Privacy boundary. |
| Delete or archive emails automatically | The system labels and classifies but does not modify the candidate's inbox organization beyond adding labels. The candidate controls archiving and deletion. |
| Replace the candidate's email client | The system works alongside Gmail's web interface. The candidate still reads and responds to emails through Gmail. Module 5 adds intelligence on top of, not instead of, the existing email experience. |
| Handle multiple Gmail accounts | Single account (chellamma.uk@gmail.com) only. Multi-account support is a future enhancement. |
| Real-time calendar integration | Module 6 handles calendar integration. Module 5 extracts interview date/time data and passes it to Module 6. |

---

## 4. User Stories

### 4.1 Core Email Processing Stories

**US-501: Interview Invitation Alert**
As Selvi, I want to receive an immediate notification (email to phone + push) within 5 minutes when an interview invitation arrives in my inbox, with the company name, role title, proposed date/time, and interview format clearly stated, so I never miss or delay responding to an interview request.

**Acceptance Criteria:**
- Interview invitation emails are detected within one polling cycle (5 minutes during business hours)
- Notification includes: company name, role title, proposed date/time (or "times to be confirmed"), interview format (phone/video/in-person), interviewer name (if mentioned), response deadline (if mentioned)
- Notification is sent via Resend to chellamma.uk@gmail.com with subject prefix "[URGENT: Interview]"
- A Gmail draft response confirming the interview is auto-created in the candidate's drafts folder
- The email is labeled `Job/Interview` in Gmail
- Module 4 is notified with status update `interview_scheduled`
- Module 6 receives the extracted interview details

**US-502: Application Acknowledgment Processing**
As Selvi, I want application acknowledgment emails to be automatically detected, labeled, and logged in my application tracker, so I know which applications have been received without manually checking each email.

**Acceptance Criteria:**
- Acknowledgment emails are detected and classified correctly 95%+ of the time
- The email is labeled `Job/Applied` in Gmail
- Module 4 is updated with status `acknowledged` for the matching application
- Company name and role title are extracted and matched against the Module 4 application record
- No notification is sent (acknowledgments are low-priority; they appear in the daily summary)

**US-503: Rejection Processing**
As Selvi, I want rejection emails to be automatically detected, labeled, and logged, with the application status updated to "rejected" in my tracker, so I have an accurate picture of my application pipeline without manual bookkeeping.

**Acceptance Criteria:**
- Rejection emails are detected and classified correctly 95%+ of the time
- The email is labeled `Job/Rejected` in Gmail
- Module 4 is updated with status `rejected` for the matching application
- Rejection reason is extracted if stated (e.g., "position has been filled," "moving forward with other candidates")
- No urgent notification; rejections appear in the daily summary
- Rejection analytics are tracked (rejection rate by company, by role type, by time since application)

**US-504: Recruiter Outreach Handling**
As Selvi, I want inbound recruiter emails to be identified, the recruiter's name and agency logged, the proposed role details extracted, and a notification sent to me with a relevance assessment, so I can decide quickly whether to engage.

**Acceptance Criteria:**
- Recruiter outreach emails are detected and classified correctly 90%+ of the time
- Recruiter name, agency name, phone number, and email are extracted and stored in the recruiter_contacts table
- Role details (title, company if mentioned, salary if mentioned, location if mentioned) are extracted
- A relevance score is generated based on how well the proposed role matches the candidate profile
- The email is labeled `Job/Recruiter` in Gmail
- A notification is sent if the role relevance score is above threshold (B-tier or higher)
- A draft response is created: polite interest if relevant, polite decline if not

**US-505: Job Alert Parsing**
As Selvi, I want job alert emails from LinkedIn, Indeed, TotalJobs, and Reed to be automatically parsed, with individual job listings extracted and fed into the Module 1 discovery pipeline, so I do not need to manually click through each alert.

**Acceptance Criteria:**
- Job alert emails from known sources (LinkedIn, Indeed, TotalJobs, Reed, CV-Library, Guardian Jobs, jobs.ac.uk) are correctly identified
- Individual job listings are extracted from the alert body (HTML parsing of links, titles, companies, locations)
- Extracted jobs are deduplicated against the existing Module 1 jobs database
- New jobs are inserted into the Module 1 pipeline for scoring
- The email is labeled `Job/Alert` in Gmail
- No individual notification; alert processing appears in the daily summary statistics

**US-506: Follow-Up Request Detection**
As Selvi, I want emails that request a follow-up action (sending additional documents, providing references, completing assessments, confirming details) to be detected immediately and surfaced with a notification, so I do not miss employer deadlines.

**Acceptance Criteria:**
- Follow-up request emails are detected with 90%+ accuracy
- The specific action requested is extracted (e.g., "please provide references," "please complete the attached assessment")
- Any deadline mentioned is extracted
- The email is labeled `Job/Follow-Up` in Gmail
- An urgent notification is sent with the requested action, deadline, and company name
- Module 4 is updated with the follow-up requirement

**US-507: Offer Detection**
As Selvi, I want offer emails (formal or informal) to be immediately detected and surfaced with the highest priority notification, including salary, start date, and response deadline, so I can respond appropriately.

**Acceptance Criteria:**
- Offer emails are detected with 95%+ accuracy (false negatives are unacceptable for offers)
- Salary offered, start date, response deadline, and any conditions are extracted
- The email is labeled `Job/Offer` in Gmail
- An immediate notification is sent via Resend with subject prefix "[OFFER]"
- Module 4 is updated with status `offer_received`
- No auto-draft is created (offers require careful, personal responses)

### 4.2 Organization Stories

**US-508: Gmail Auto-Labeling**
As Selvi, I want every job-related email in my Gmail inbox to be automatically labeled with the correct category (Job/Applied, Job/Interview, Job/Rejected, Job/Recruiter, Job/Alert, Job/Offer, Job/Follow-Up, Job/Marketing), so my inbox is organized without manual effort.

**Acceptance Criteria:**
- Labels are created automatically in Gmail if they do not exist
- Each classified email receives exactly one primary label from the Job/* hierarchy
- Labels are applied within 10 minutes of email arrival during business hours
- The candidate can view all emails of a given type by clicking the label in Gmail
- Labeling never modifies the email's read/unread status
- Labeling never moves the email out of the inbox (no automatic archiving)

**US-509: Daily Email Summary**
As Selvi, I want a daily summary at 8:00 AM listing all job emails processed in the last 24 hours, organized by category, with counts and highlights, so I start each day with a clear picture of my email landscape.

**Acceptance Criteria:**
- Summary email arrives at 8:00 AM UK time
- Includes counts by category (e.g., "3 acknowledgments, 1 rejection, 1 interview invitation, 5 recruiter messages, 22 job alerts processed")
- Interview invitations and follow-up requests are highlighted at the top
- New recruiter contacts are listed with their agency and proposed role
- Rejections include company name and role
- Job alerts show count of new jobs extracted and fed to Module 1
- Email is sent from the system email address via Resend

**US-510: Conversation Threading**
As Selvi, I want the system to track email conversations (threads) so that when a recruiter or employer sends multiple emails about the same role, they are linked together in the tracking system and I can see the full conversation history.

**Acceptance Criteria:**
- Emails within the same Gmail thread are linked by thread_id
- The system recognizes when a new email is a reply in an existing conversation
- The application tracker shows the conversation history for each application
- Recruiter contacts show all conversations with that recruiter
- The classification considers the full thread context (e.g., a reply saying "yes" in an interview thread is classified differently from a reply saying "yes" in a marketing thread)

### 4.3 Recruiter Management Stories

**US-511: Recruiter Contact Registry**
As Selvi, I want a registry of all recruiters who have contacted me, with their name, agency, contact details, roles proposed, and a quality rating, so I can prioritize which recruiters to engage with.

**Acceptance Criteria:**
- Recruiter name, agency, email, and phone are extracted from initial outreach emails
- Each recruiter has a profile with all roles they have proposed
- Each proposed role has a relevance score
- The recruiter quality rating is computed from: relevance of roles proposed, frequency of contact, response patterns
- Duplicate detection prevents creating multiple entries for the same recruiter

**US-512: Recruiter Follow-Up Tracking**
As Selvi, I want to know when I have not responded to a recruiter within 48 hours, and when a recruiter has not responded to me within 5 business days, so I can follow up or move on.

**Acceptance Criteria:**
- Outbound responses to recruiters are tracked (via Gmail sent folder monitoring)
- If no response is sent to a recruiter within 48 hours, a reminder appears in the daily summary
- If a recruiter does not respond within 5 business days of my last email, a follow-up prompt appears in the daily summary
- Stale conversations (no activity for 14+ days) are flagged as dormant

**US-513: Recruiter Blacklist**
As Selvi, I want to mark specific recruiters or agencies as "low quality" so their future emails are deprioritized and I do not waste time on consistently irrelevant outreach.

**Acceptance Criteria:**
- Recruiter profiles can be marked as `blacklisted` via a database flag
- Emails from blacklisted recruiters are still processed (for record-keeping) but are not notified
- Blacklisted recruiter emails are labeled `Job/Recruiter/Low-Priority` instead of `Job/Recruiter`
- The daily summary notes blacklisted recruiter emails separately
- Blacklist is reversible

### 4.4 Response Drafting Stories

**US-514: Interview Confirmation Draft**
As Selvi, I want a professional response draft automatically created in my Gmail drafts when an interview invitation arrives, confirming attendance and restating the date/time, so I can review and send it with minimal effort.

**Acceptance Criteria:**
- Draft is created within 2 minutes of classification
- Draft confirms the interview date, time, and format
- Draft uses professional but warm tone appropriate for UK business correspondence
- Draft includes the candidate's name and contact details
- If multiple time slots are offered, the draft acknowledges the options and asks the candidate to choose
- The draft is created as a reply to the original email (maintaining thread context)

**US-515: Acknowledgment Reply Draft**
As Selvi, I want a brief acknowledgment reply drafted for application confirmations, thanking the employer and confirming continued interest, so important applications get a personal touch beyond the automated submission.

**Acceptance Criteria:**
- Draft is only created for A-tier and B-tier applications (not for every application)
- Draft thanks the employer for confirming receipt and expresses continued interest
- Draft is brief (3-4 sentences maximum)
- Draft is created as a reply to the acknowledgment email
- A flag in system_config controls whether acknowledgment drafts are created (default: on for A-tier, off for B-tier)

**US-516: Recruiter Response Draft**
As Selvi, I want a response draft created for recruiter outreach emails, with the tone and content varying based on the relevance of the proposed role: enthusiastic interest for strong matches, polite inquiry for moderate matches, and courteous decline for poor matches.

**Acceptance Criteria:**
- Draft tone adapts to role relevance score:
  - A-tier match: Express strong interest, ask for more details, propose a call
  - B-tier match: Express interest, ask clarifying questions about the role
  - C-tier match: Thank the recruiter, explain it is not quite the right fit, express openness to other roles
  - D-tier / Blacklisted: Polite one-line decline
- Draft includes the candidate's relevant experience summary tailored to the proposed role
- Draft is created as a reply to the recruiter's email

### 4.5 Edge Case Stories

**US-517: HTML-Heavy Marketing Emails**
As Selvi, I want the system to correctly classify heavily-formatted HTML marketing emails from job boards (which often look like personalized job alerts but are actually promotional content) and not waste processing resources on them.

**Acceptance Criteria:**
- Marketing emails from known job board domains are identified by sender pattern matching before Claude classification
- Known marketing senders (e.g., marketing@linkedin.com vs. jobs-noreply@linkedin.com) are maintained in a sender classification table
- Marketing emails are labeled `Job/Marketing` and not processed further
- No Claude API cost is incurred for emails classified by sender pattern alone

**US-518: Non-English Emails**
As Selvi, I want emails in languages other than English to be detected and skipped (with a log entry), since all relevant UK job communication will be in English.

**Acceptance Criteria:**
- Language detection is performed on the email body before classification
- Non-English emails are logged but not classified or processed
- The log entry records the detected language
- No Claude API cost is incurred for non-English emails

**US-519: Calendar Invite Emails**
As Selvi, I want emails that contain calendar invitations (ICS attachments or Google Calendar invites) to be detected and the calendar data extracted, even if the email body itself is sparse, because interview invitations sometimes arrive as calendar invites with minimal body text.

**Acceptance Criteria:**
- Emails with ICS attachments or Google Calendar invite metadata are detected
- The ICS file is parsed to extract: event title, date/time, duration, location, organizer, description
- The extracted calendar data supplements the email body classification
- These are classified as `interview_invite` when the event title or description references an interview

**US-520: Automated Sender Emails**
As Selvi, I want the system to handle automated emails from ATS systems (Workday, Greenhouse, Lever, Taleo, iCIMS, Oracle) that use noreply addresses and template formatting, extracting the relevant information despite the formulaic structure.

**Acceptance Criteria:**
- ATS-specific parsing rules exist for the top 10 ATS platforms used in the UK
- Template patterns for each ATS are maintained in a configuration table
- Extraction works on the ATS-specific HTML structure, not just free text
- The ATS source is recorded in the email metadata

**US-521: Multi-Role Emails**
As Selvi, I want the system to handle emails that reference multiple roles (e.g., a recruiter proposing three different positions in one email) by extracting and tracking each role separately.

**Acceptance Criteria:**
- The classifier detects when an email contains multiple role proposals
- Each role is extracted as a separate entity with its own title, company, salary, and location
- Each role gets its own relevance score
- The notification shows all roles from the email
- In the recruiter contact record, all roles are logged as separate interactions

**US-522: Forwarded Job Emails**
As Selvi, I want the system to detect when someone (friend, former colleague, recruiter) forwards a job posting to my email, extract the job details from the forwarded content, and process it as a new opportunity.

**Acceptance Criteria:**
- Forwarded emails are detected by "Fwd:" prefix, forwarded headers, or Gmail forwarding metadata
- The forwarded content (not the forwarding message) is parsed for job details
- The original sender of the job (the person who forwarded it) is logged as the referral source
- The forwarded job is fed into the Module 1 discovery pipeline with source type `referral`
- The email is labeled `Job/Referral`

**US-523: Email Bounce and Delivery Failure**
As Selvi, I want the system to detect when an application email I sent has bounced or failed to deliver, so I know the employer never received my application and I can try alternative submission methods.

**Acceptance Criteria:**
- Bounce and delivery failure emails (MAILER-DAEMON, postmaster) are detected
- The bounced email's recipient (the employer) and the application it relates to are identified
- Module 4 is updated to flag the application as `delivery_failed`
- An urgent notification is sent so the candidate can resubmit through alternative channels

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
                     +--------v--------+  +--v--------+  +-v--------------+
                     | Daily Summary   |  | Urgent    |  | Gmail Web      |
                     | (8:00 AM)       |  | Alerts    |  | (labeled inbox)|
                     +--------+--------+  +--+--------+  +--+-------------+
                              |              |               |
                     +--------v--------------v---------------v-----------+
                     |              Module 5: Email Management           |
                     |              & Intelligence System                |
                     +--+----------+----------+----------+-----------+--+
                        |          |          |          |           |
              +---------v---+ +---v------+ +-v--------+ +-----v---+ +--v---------+
              | Gmail       | | AI       | | Data     | | Auto-   | | Response   |
              | Polling &   | | Classif. | | Extract  | | Label   | | Drafting   |
              | Ingestion   | | Engine   | | Pipeline | | System  | | Engine     |
              | (WF-EM-01)  | | (WF-EM-02| | (WF-EM-03| |(WF-EM-04| | (WF-EM-05)|
              +------+------+ +----+-----+ +----+-----+ +----+----+ +-----+-----+
                     |              |           |             |            |
              +------v--------------v-----------v-------------v------------v-----+
              |                     Postgres Database                            |
              |  emails | email_classifications | email_extracted_data |         |
              |  recruiter_contacts | email_threads | email_processing_log       |
              +--+-------+----------+----------+----------+----------+----------+
                 |       |          |          |          |          |
              +--v--+ +--v----+ +--v-----+ +--v------+ +--v-----+ +--v--------+
              |Mod 1| |Mod 3  | |Mod 4   | |Mod 6   | |Resend  | | Gmail API |
              |Job  | |Auto   | |App     | |Interview| |Notif.  | | (Labels,  |
              |Disc.| |Apply  | |Tracker | |Sched.  | |Service | |  Drafts)  |
              +-----+ +-------+ +--------+ +--------+ +--------+ +----------+
```

### 5.2 Workflow Architecture

The Email Management system consists of 7 n8n workflows that operate on the shared Postgres database. Workflows are designed for independent scheduling and failure isolation.

| Workflow | ID | Trigger | Schedule | Purpose |
|----------|----|---------|----------|---------|
| WF-EM-01: Gmail Poller & Ingestion | EM-01 | Cron | Every 5 min (6AM-11PM), every 15 min (11PM-6AM) | Poll Gmail for new messages, ingest to database |
| WF-EM-02: AI Classification Engine | EM-02 | Cron | Every 5 min | Classify unclassified emails via Claude |
| WF-EM-03: Data Extraction Pipeline | EM-03 | Cron | Every 5 min | Extract structured data from classified emails |
| WF-EM-04: Gmail Labeling & Organization | EM-04 | Cron | Every 5 min | Apply labels and manage Gmail organization |
| WF-EM-05: Response Drafting Engine | EM-05 | Cron | Every 10 min | Generate response drafts for actionable emails |
| WF-EM-06: Urgent Notification Dispatcher | EM-06 | Cron | Every 3 min | Send urgent notifications for time-sensitive emails |
| WF-EM-07: Daily Summary Generator | EM-07 | Cron | 8:00 AM daily | Compile and send daily email summary |
| WF-EM-08: Recruiter Tracker | EM-08 | Cron | Every 30 min | Update recruiter profiles, detect stale conversations |
| SW-EM-01: Email Preprocessing | SW-01 | Sub-workflow | Called by WF-EM-01 | HTML stripping, language detection, sender classification |
| SW-EM-02: Module Integration Dispatcher | SW-02 | Sub-workflow | Called by WF-EM-03 | Route extracted data to Modules 1, 4, 6 |

**Schedule Staggering:**

```
Minute 0:  WF-EM-06 (Urgent Notifications -- highest priority)
Minute 1:  WF-EM-01 (Gmail Polling)
Minute 2:  WF-EM-02 (Classification)
Minute 3:  WF-EM-03 (Extraction)
Minute 4:  WF-EM-04 (Labeling)
Minute 5:  WF-EM-05 (Response Drafting -- runs every 10 min, so only on even cycles)
```

The stagger ensures that in a typical 5-minute cycle, an email goes through: poll -> classify -> extract -> label, with urgent notifications checked every 3 minutes to catch interview invitations between cycles.

**Workflow Lock Pattern (All Stateful Workflows):**

All stateful workflows (WF-EM-01 through WF-EM-06) use the same workflow lock pattern to prevent concurrent executions from processing the same emails:

```sql
INSERT INTO workflow_locks (workflow_name, locked_by, expires_at)
VALUES ('{{ workflow_name }}', '{{ $executionId }}', NOW() + INTERVAL '10 minutes')
ON CONFLICT (workflow_name)
DO UPDATE SET locked_at = NOW(), locked_by = '{{ $executionId }}', expires_at = NOW() + INTERVAL '10 minutes'
WHERE workflow_locks.expires_at < NOW();
```

Additionally, all SELECT queries that pick up emails for processing use `FOR UPDATE SKIP LOCKED` to prevent concurrent executions from processing the same rows, providing a second layer of protection beyond the workflow lock.

### 5.3 Data Flow

```
Gmail Inbox
    |
    v
[WF-EM-01: Poll & Ingest]
    |-- Fetch new messages via Gmail API (since last poll)
    |-- Call SW-EM-01: Preprocess (HTML strip, language detect, sender classify)
    |-- Insert into emails table (status: 'ingested')
    |-- Skip emails from known non-job senders (configurable allowlist/blocklist)
    v
[WF-EM-02: AI Classification]
    |-- Pick up emails with status 'ingested'
    |-- Fast-path: sender pattern match (known ATS, known job boards) -> classify without Claude
    |-- Standard path: send email body + metadata to Claude Haiku
    |-- Ambiguous path: if Haiku confidence < 0.75, escalate to Claude Sonnet
    |-- Store classification in email_classifications table
    |-- Update email status to 'classified'
    v
[WF-EM-03: Data Extraction]
    |-- Pick up emails with status 'classified'
    |-- Route to category-specific extraction logic
    |-- Extract structured fields (company, role, dates, contacts, etc.)
    |-- Store extracted data in email_extracted_data table
    |-- Call SW-EM-02: Module Integration Dispatcher
    |       |-- interview_invite -> Module 4 (status: interview_scheduled) + Module 6
    |       |-- rejection -> Module 4 (status: rejected)
    |       |-- acknowledgment -> Module 4 (status: acknowledged)
    |       |-- offer -> Module 4 (status: offer_received)
    |       |-- job_alert -> Module 1 (new job listings)
    |       |-- recruiter_outreach -> recruiter_contacts table
    |-- Update email status to 'extracted'
    v
[WF-EM-04: Gmail Labeling]
    |-- Pick up emails with status 'extracted'
    |-- Apply appropriate Gmail label based on classification
    |-- Update email status to 'labeled'
    v
[WF-EM-05: Response Drafting]
    |-- Pick up emails with status 'labeled' and classification in (interview_invite, acknowledgment, recruiter_outreach)
    |-- Generate appropriate draft via Claude
    |-- Create draft in Gmail via Gmail API
    |-- Update email status to 'draft_created'
    v
[WF-EM-06: Urgent Notifications]
    |-- Pick up emails with classification in (interview_invite, offer, follow_up_request, delivery_failure)
    |       AND notified = false
    |-- Send notification via Resend
    |-- Update notified = true
    v
[WF-EM-07: Daily Summary]
    |-- Aggregate all emails processed in last 24 hours
    |-- Generate summary email via Resend
    v
[WF-EM-08: Recruiter Tracker]
    |-- Scan recruiter_contacts for overdue follow-ups
    |-- Update recruiter quality scores
    |-- Flag stale conversations
```

### 5.4 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Workflow Engine | n8n (self-hosted) | n8n.deploy.apiloom.io |
| Email Integration | Gmail API via n8n Gmail node | OAuth2 authentication |
| AI Classification | Claude 3.5 Haiku (primary), Claude 3.5 Sonnet (escalation) | Tiered: pattern match -> Haiku -> Sonnet |
| Database | PostgreSQL 16 | Via Dokploy on Hetzner |
| Outbound Notifications | Resend API | For urgent alerts and daily summary |
| Response Drafting | Claude 3.5 Haiku | Draft generation |
| HTML Processing | n8n Code node (cheerio/JSDOM) | Strip HTML, extract structure |
| Calendar Parsing | n8n Code node (ical.js) | Parse ICS attachments |
| Hosting | Dokploy on Hetzner CAX31 | 8 vCPU ARM, 16GB RAM |
| Monitoring | n8n execution logs + workflow_errors table + Resend for error alerts |

### 5.5 Infrastructure Context

```
+-------------------------------------------+
|  Hetzner CAX31 (8 vCPU ARM, 16GB RAM)    |
|  deploy.apiloom.io                         |
|                                            |
|  +------------------+  +----------------+ |
|  | Dokploy          |  | Postgres 16    | |
|  |                  |  |                | |
|  |  +-------------+ |  | selvi_jobs DB  | |
|  |  | n8n         | |  |  + email mgmt  | |
|  |  | (Module 5   | |  |    tables      | |
|  |  |  workflows) |<-->|                | |
|  |  +-------------+ |  +----------------+ |
|  +------------------+                      |
+-------------------------------------------+
         |              |              |
    Gmail API       Claude API     Resend API
    (OAuth2)        (Haiku/Sonnet) (Notifications)
```

### 5.6 Security Architecture

```
+------------------+     OAuth2      +------------------+
| n8n Gmail Node   |<--------------->| Google OAuth2     |
|                  |   Access Token  | (consent screen)  |
+------------------+   + Refresh     +------------------+
                        Token
                          |
                    Stored in n8n
                    credential store
                    (encrypted at rest)

+------------------+     API Key     +------------------+
| n8n HTTP Request |<--------------->| Anthropic API     |
| (Claude)         |   (env var)     |                   |
+------------------+                 +------------------+

+------------------+     API Key     +------------------+
| n8n HTTP Request |<--------------->| Resend API        |
| (Notifications)  |   (env var)     |                   |
+------------------+                 +------------------+
```

**Key Security Decisions:**
- Gmail OAuth2 tokens are stored in n8n's encrypted credential store, never in the database
- Email body text is stored in the database only during processing; it is purged after extraction (configurable retention: default 7 days)
- Claude API keys are stored as environment variables, never hardcoded
- Resend API keys are stored as environment variables
- No email content is logged in n8n execution logs (sensitive data masking enabled)
- Database connections use SSL

---

## 6. Gmail Integration & Monitoring

### 6.1 OAuth2 Setup

**Google Cloud Project Configuration:**

1. Create OAuth2 credentials in the Google Cloud Console
2. Configure the OAuth consent screen:
   - App name: "Selvi Job App - Email Manager"
   - User type: External (but only used by one account)
   - Scopes required:
     - `https://www.googleapis.com/auth/gmail.readonly` -- Read emails
     - `https://www.googleapis.com/auth/gmail.modify` -- Apply labels, mark read/unread
     - `https://www.googleapis.com/auth/gmail.compose` -- Create drafts
     - `https://www.googleapis.com/auth/gmail.labels` -- Create and manage labels
3. Generate OAuth2 client ID and client secret
4. Configure in n8n: Settings > Credentials > Google OAuth2 API
5. Complete the OAuth2 consent flow to generate access and refresh tokens

**Token Refresh:**
- Access tokens expire every 60 minutes
- n8n's Gmail node handles automatic refresh using the stored refresh token
- If refresh fails (token revoked), the system:
  1. Logs the failure in workflow_errors
  2. Sends a critical alert via Resend (using API key auth, not Gmail)
  3. Pauses all email workflows
  4. Requires manual re-authentication

**n8n Gmail Credential Configuration:**
```
Credential Type: Google OAuth2 API
Client ID: {{ env.GOOGLE_CLIENT_ID }}
Client Secret: {{ env.GOOGLE_CLIENT_SECRET }}
Access Token: (auto-populated after OAuth flow)
Refresh Token: (auto-populated after OAuth flow)
Scopes: gmail.readonly, gmail.modify, gmail.compose, gmail.labels
```

### 6.2 Gmail Polling Strategy

**Business Hours (6:00 AM - 11:00 PM UK time):**
- Poll every 5 minutes
- Cron: `*/5 6-22 * * *` (Europe/London)
- 204 polls per day during business hours

**Off-Hours (11:00 PM - 6:00 AM UK time):**
- Poll every 15 minutes
- Cron: `*/15 23,0-5 * * *` (Europe/London)
- 28 polls per day during off-hours

**Total: ~232 polls per day, well within Gmail API quotas.**

**Gmail API Quotas (relevant limits):**
| Quota | Limit | Our Usage |
|-------|-------|-----------|
| Queries per day | 1,000,000 | ~700 (polling + labeling + drafts) |
| Queries per 100 seconds per user | 250 | ~1 per 5 min = negligible |
| Messages.list per day | 500,000 | ~232 |
| Messages.get per day | 500,000 | ~500 (estimated 2-3 new emails per poll) |
| Labels.create per day | 10,000 | ~10 (one-time setup) |
| Drafts.create per day | 500 | ~20-30 |

We are orders of magnitude below all quotas.

### 6.3 Polling Implementation

**Gmail History API for Gap-Free Change Tracking:**

The system uses Gmail's History API (`users.history.list`) instead of the timestamp-based `after:` query. The History API tracks changes since a specific `historyId` and guarantees no gaps -- solving the timestamp-boundary problem where emails received at the exact boundary second could be missed by both consecutive polls.

**Architecture Decision:** The `after:` timestamp approach was considered but rejected because Gmail's `after:` operator uses epoch seconds with non-instantaneous indexing. An email received at 09:59:58 might not appear in the index until 10:00:02, causing it to be missed by both the 10:00:00 poll (`after:09:55:00`, which returns indexed items before 09:59:58) and the 10:05:00 poll (`after:10:00:00`, which skips the email because its internal timestamp is 09:59:58). The History API eliminates this class of bugs entirely.

**Primary Polling Method (History API):**

```
GET https://gmail.googleapis.com/gmail/v1/users/me/history
    ?startHistoryId={{ lastHistoryId }}
    &historyTypes=messageAdded
    &labelId=INBOX
    &maxResults=100
```

**Query Breakdown:**
- `startHistoryId={{ lastHistoryId }}` -- Only changes since the last known history ID (stored in `system_config`)
- `historyTypes=messageAdded` -- Only new messages, not label changes or deletions
- `labelId=INBOX` -- Only inbox messages (not sent, drafts, etc.)
- `maxResults=100` -- Batch size for history records

**History ID Management:**
- The `lastHistoryId` is stored in `system_config` (key: `email_last_history_id`)
- After each successful poll, the `historyId` from the response is stored as the new `lastHistoryId`
- If the History API returns HTTP 404 (history ID expired -- Google retains history for ~7 days), the system falls back to a full reconciliation query

**Fallback Polling (Reconciliation):**

If the History API returns 404 (expired historyId) or on initial setup, the system falls back to a query-based approach with overlap:

```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
    ?q=-label:Job-Processed in:inbox
    &maxResults=100
```

After reconciliation, the system stores the current `historyId` from `users.getProfile` and resumes History API polling.

**Daily Full Reconciliation (3:00 AM):**

A daily reconciliation poll at 3:00 AM fetches all unprocessed emails from the last 7 days as a safety net, catching any that slipped through:

```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
    ?q=-label:Job-Processed in:inbox newer_than:7d
    &maxResults=200
```

The `ON CONFLICT (gmail_message_id) DO NOTHING` clause on the insert prevents duplicates.

**Message Retrieval:**
For each message ID returned by the history or reconciliation query, fetch the full message:

```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ messageId }}
    ?format=full
```

The `full` format returns headers, body parts (plaintext and HTML), and attachment metadata.

**n8n Implementation:**
```
Node: HTTP Request (Gmail History API)
Method: GET
URL: https://gmail.googleapis.com/gmail/v1/users/me/history
Parameters:
  - startHistoryId: {{ $json.lastHistoryId }}
  - historyTypes: messageAdded
  - labelId: INBOX
  - maxResults: 100
Authentication: OAuth2 (Gmail credential)
```

### 6.4 Email Message Parsing

Each fetched message is parsed into a standardized internal format before classification.

**Parsed Email Structure:**

```json
{
  "gmail_message_id": "18e1234567890abc",
  "gmail_thread_id": "18e1234567890abc",
  "subject": "Interview Invitation - Senior L&D Manager",
  "from_email": "hr@acmecorp.co.uk",
  "from_name": "Jane Smith",
  "to_email": "chellamma.uk@gmail.com",
  "reply_to": "hr@acmecorp.co.uk",
  "date": "2026-03-28T14:30:00Z",
  "body_plain": "Dear Selvi, ...",
  "body_html": "<html><body>...",
  "body_stripped": "Dear Selvi, ...",
  "has_attachments": true,
  "attachment_types": ["application/ics"],
  "labels": ["INBOX", "UNREAD"],
  "snippet": "Dear Selvi, We are pleased to invite you...",
  "headers": {
    "List-Unsubscribe": "...",
    "X-Mailer": "...",
    "Precedence": "bulk"
  },
  "is_reply": false,
  "in_reply_to": null,
  "references": []
}
```

**HTML Stripping (SW-EM-01):**

HTML emails require careful processing to extract readable text while preserving structural cues:

```javascript
// HTML stripping with structure preservation
function stripHtml(html) {
  if (!html) return '';

  // Replace common block elements with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<hr\s*\/?>/gi, '\n---\n');

  // Extract link text with URL
  text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 [$1]');

  // Extract bold/strong text with markers (aids classification)
  text = text.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '**$2**');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&#163;/g, '£');

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text;
}
```

**Language Detection (SW-EM-01):**

Simple heuristic-based language detection to filter non-English emails before Claude processing:

```javascript
function detectLanguage(text) {
  if (!text || text.length < 50) return { language: 'unknown', confidence: 0 };

  // English indicator words (high frequency, low ambiguity)
  const englishMarkers = [
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
    'can', 'her', 'was', 'one', 'our', 'out', 'with', 'have',
    'this', 'will', 'your', 'from', 'they', 'been', 'would',
    'please', 'thank', 'regards', 'position', 'application',
    'interview', 'role', 'opportunity'
  ];

  const words = text.toLowerCase().split(/\s+/);
  const totalWords = words.length;
  const englishWordCount = words.filter(w => englishMarkers.includes(w)).length;
  const englishRatio = englishWordCount / totalWords;

  if (englishRatio > 0.1) return { language: 'en', confidence: Math.min(englishRatio * 5, 1) };
  return { language: 'other', confidence: 1 - englishRatio };
}
```

### 6.5 Sender Classification (Fast Path)

Before invoking Claude, the system applies pattern-based sender classification to identify emails that can be categorized without AI. This saves Claude API costs and reduces processing latency.

**Sender Pattern Database (email_sender_patterns table):**

| Pattern | Classification | Action |
|---------|---------------|--------|
| `noreply@linkedin.com` | job_alert | Parse as LinkedIn alert |
| `jobs-noreply@linkedin.com` | job_alert | Parse as LinkedIn alert |
| `jobalerts-noreply@linkedin.com` | job_alert | Parse as LinkedIn alert |
| `invitations@linkedin.com` | recruiter_outreach | May be InMail from recruiter |
| `notifications-noreply@linkedin.com` | recruiter_outreach | LinkedIn notifications |
| `noreply@indeed.com` | job_alert | Parse as Indeed alert |
| `alert@indeed.co.uk` | job_alert | Parse as Indeed alert |
| `jobalert@totaljobs.com` | job_alert | Parse as TotalJobs alert |
| `noreply@reed.co.uk` | job_alert | Parse as Reed alert |
| `alerts@reed.co.uk` | job_alert | Parse as Reed alert |
| `alerts@cv-library.co.uk` | job_alert | Parse as CV-Library alert |
| `jobs@theguardian.com` | job_alert | Parse as Guardian alert |
| `alerts@jobs.ac.uk` | job_alert | Parse as jobs.ac.uk alert |
| `*@workday.com` | ats_communication | ATS -- classify with context |
| `*@greenhouse.io` | ats_communication | ATS -- classify with context |
| `*@lever.co` | ats_communication | ATS -- classify with context |
| `*@icims.com` | ats_communication | ATS -- classify with context |
| `*@taleo.net` | ats_communication | ATS -- classify with context |
| `*@smartrecruiters.com` | ats_communication | ATS -- classify with context |
| `*@oracle.com` (hiring path) | ats_communication | ATS -- classify with context |
| `*@breezy.hr` | ats_communication | ATS -- classify with context |
| `*@applytojob.com` | ats_communication | ATS -- classify with context |
| `MAILER-DAEMON@*` | delivery_failure | Bounce detection |
| `postmaster@*` | delivery_failure | Bounce detection |
| `selvi-system@apiloom.io` | system_notification | **SKIP -- never process system's own notifications** |
| `*@resend.dev` | system_notification | **SKIP -- Resend bounce/status notifications** |
| `marketing@*` (job board domains) | marketing | Skip classification |
| `promotions@*` (job board domains) | marketing | Skip classification |

**Pattern Matching Logic:**

```javascript
function classifySender(fromEmail, subject) {
  // CRITICAL: Skip system's own notification emails to prevent recursive processing
  const SYSTEM_ADDRESSES = ['selvi-system@apiloom.io'];
  if (SYSTEM_ADDRESSES.includes(fromEmail.toLowerCase())) {
    return { classification: 'system_notification', confidence: 1.0, method: 'system_exclusion', skip: true };
  }

  // Exact match against known senders
  const exactMatch = senderPatterns.find(p => p.pattern === fromEmail);
  if (exactMatch) return { classification: exactMatch.classification, confidence: 1.0, method: 'sender_exact' };

  // Wildcard domain match
  const domain = fromEmail.split('@')[1];
  const wildcardMatch = senderPatterns.find(p => {
    if (!p.pattern.startsWith('*@')) return false;
    return domain === p.pattern.substring(2) || domain.endsWith('.' + p.pattern.substring(2));
  });
  if (wildcardMatch) return { classification: wildcardMatch.classification, confidence: 0.9, method: 'sender_domain' };

  // Heuristic: noreply + job-related domain = likely automated
  if (fromEmail.startsWith('noreply@') || fromEmail.startsWith('no-reply@') || fromEmail.startsWith('do-not-reply@')) {
    return { classification: 'automated', confidence: 0.7, method: 'sender_noreply_heuristic' };
  }

  // Subject-line heuristics for marketing
  const marketingSubjectPatterns = [
    /unsubscribe/i,
    /your weekly/i,
    /top \d+ jobs/i,
    /new jobs for you/i,
    /career tips/i,
    /salary guide/i,
    /market report/i
  ];
  if (marketingSubjectPatterns.some(p => p.test(subject))) {
    return { classification: 'likely_marketing', confidence: 0.6, method: 'subject_heuristic' };
  }

  // No match -- requires Claude classification
  return { classification: 'unknown', confidence: 0, method: 'none' };
}
```

### 6.6 Gmail API Rate Limiting

Even though our usage is far below Gmail API quotas, defensive rate limiting prevents problems:

```javascript
// Rate limiter for Gmail API calls
const GMAIL_RATE_LIMIT = {
  requestsPerSecond: 5,      // Well below the 250/100s limit
  maxConcurrent: 1,           // n8n processes sequentially anyway
  retryOnRateLimit: true,
  retryDelayMs: 5000,
  maxRetries: 3
};
```

**Exponential Backoff on 429:**

```javascript
function handleGmailRateLimit(error, attempt) {
  if (error.statusCode === 429) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
    return { retry: true, delayMs: delay };
  }
  if (error.statusCode === 403 && error.message.includes('rateLimitExceeded')) {
    return { retry: true, delayMs: 10000 };
  }
  return { retry: false };
}
```

### 6.7 Gmail Sent Folder Monitoring

To track outbound responses (for recruiter follow-up tracking, US-512), the system also monitors the Sent folder:

**Polling Query (Sent):**
```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
    ?q=in:sent after:{{ lastSentPollTimestamp }} to:*
    &maxResults=20
```

This runs once every 30 minutes (less frequent than inbox polling, since outbound tracking is lower priority). Sent messages are matched to existing email threads to update conversation state.

**Timestamp boundary risk mitigation:** The `after:` query parameter uses a UNIX timestamp. If a sent message arrives during the gap between polling cycles (e.g., sent at 10:29:59, poll runs at 10:30:00 with lastSentPollTimestamp = 10:00:00, next poll at 11:00:00 uses lastSentPollTimestamp = 10:30:00), the message is captured correctly because `after:` is compared to Gmail's internal date. However, to eliminate edge cases, the system extends the sent folder query to use the History API (`users.history.list`) with `historyTypes=messageAdded` and the `labelId=SENT` filter. This captures all sent messages by sequence ID rather than timestamp, eliminating boundary risk. The History API approach is already used for inbox monitoring (Section 6.2) and the same pattern applies here.

---

## 7. AI Email Classification Engine

### 7.1 Classification Taxonomy

The system classifies job-related emails into eight primary categories, each with sub-categories for precision:

| Category | Code | Description | Urgency | Example |
|----------|------|-------------|---------|---------|
| Application Acknowledgment | `acknowledgment` | Confirmation that an application was received | Low | "Thank you for applying to the L&D Manager position" |
| Rejection | `rejection` | Notification that the application was unsuccessful | Low | "We regret to inform you that we will not be proceeding" |
| Interview Invitation | `interview_invite` | Request to attend an interview (any format) | CRITICAL | "We would like to invite you for an interview on..." |
| Recruiter Outreach | `recruiter_outreach` | Initial contact from a recruitment agency/consultant | Medium | "I have a great opportunity that matches your profile" |
| Job Alert | `job_alert` | Automated job listing digest from a job board | Low | "15 new Learning & Development jobs near you" |
| Offer | `offer` | Formal or informal job offer | CRITICAL | "We are pleased to offer you the position of..." |
| Follow-Up Request | `follow_up_request` | Request for additional information or action | High | "Could you please provide two professional references?" |
| Generic Marketing | `marketing` | Job board promotions, career advice, newsletters | None | "Top 10 CV tips for 2026" |

**Sub-Categories:**

| Category | Sub-Category | Code | Description |
|----------|-------------|------|-------------|
| Interview Invitation | Phone Screen | `interview_invite.phone` | Phone or video screening call |
| Interview Invitation | Video Interview | `interview_invite.video` | Formal video interview (Teams, Zoom) |
| Interview Invitation | In-Person | `interview_invite.in_person` | On-site interview |
| Interview Invitation | Assessment | `interview_invite.assessment` | Online assessment, case study, presentation |
| Interview Invitation | Panel | `interview_invite.panel` | Panel interview format |
| Interview Invitation | Informal Chat | `interview_invite.informal` | Informal meeting, coffee chat |
| Rejection | Post-Application | `rejection.post_application` | Rejected before interview |
| Rejection | Post-Interview | `rejection.post_interview` | Rejected after interview |
| Rejection | Auto-Rejection | `rejection.auto` | Automated ATS rejection |
| Recruiter Outreach | New Role | `recruiter_outreach.new_role` | Recruiter proposing a specific role |
| Recruiter Outreach | Speculative | `recruiter_outreach.speculative` | Recruiter asking for CV without a specific role |
| Recruiter Outreach | Follow-Up | `recruiter_outreach.follow_up` | Recruiter following up on previous conversation |
| Follow-Up Request | References | `follow_up_request.references` | Request for professional references |
| Follow-Up Request | Documents | `follow_up_request.documents` | Request for certificates, transcripts, ID |
| Follow-Up Request | Assessment | `follow_up_request.assessment` | Request to complete an assessment |
| Follow-Up Request | Availability | `follow_up_request.availability` | Request for available dates/times |
| Follow-Up Request | Information | `follow_up_request.information` | Request for additional information |
| Offer | Formal | `offer.formal` | Written offer with terms |
| Offer | Verbal/Informal | `offer.informal` | Informal offer pending formal paperwork |
| Offer | Conditional | `offer.conditional` | Offer conditional on references, checks, etc. |

### 7.2 Classification Pipeline

```
Email Received
    |
    v
[Step 1: Sender Pattern Match]
    |-- Known job alert sender? -> 'job_alert' (confidence 1.0)
    |-- Known marketing sender? -> 'marketing' (confidence 1.0)
    |-- Known ATS domain? -> 'ats_communication' (needs further classification)
    |-- Bounce address? -> 'delivery_failure' (confidence 1.0)
    |-- Unknown sender? -> Continue to Step 2
    v
[Step 2: Subject Line Heuristic]
    |-- Contains "interview" + "invite/invitation"? -> likely 'interview_invite'
    |-- Contains "unfortunately" or "regret"? -> likely 'rejection'
    |-- Contains "offer" + "position/role"? -> likely 'offer'
    |-- Contains "thank you for applying"? -> likely 'acknowledgment'
    |-- Contains "jobs for you" or "job alert"? -> likely 'job_alert'
    |-- Subject heuristic confidence > 0.85? -> accept classification
    |-- Otherwise -> Continue to Step 3
    v
[Step 3: Claude Haiku Classification]
    |-- Send email metadata + body (first 3000 chars) to Claude Haiku
    |-- Receive classification + confidence + reasoning
    |-- Confidence >= 0.80? -> Accept classification
    |-- Confidence < 0.80? -> Continue to Step 4
    v
[Step 4: Claude Sonnet Escalation]
    |-- Send full email body + thread context to Claude Sonnet
    |-- Receive classification + confidence + reasoning
    |-- Accept classification regardless of confidence (log low-confidence cases)
```

### 7.3 Claude Classification Prompt

**System Prompt (Haiku):**

```
You are an email classification system for a UK job search. Your task is to classify incoming emails related to a job search by a professional with a PhD + MBA and 18 years of HR/L&D experience, seeking corporate L&D roles (Manager to Head level, GBP 70-80k) and university Lecturer/Senior Lecturer positions near Maidenhead, Berkshire, UK.

The candidate's email is chellamma.uk@gmail.com and her name is Selvi Chellamma.

Classify each email into EXACTLY ONE of the following categories:

1. acknowledgment - Application receipt confirmation
2. rejection - Application unsuccessful notification
3. interview_invite - Invitation to interview (any format: phone, video, in-person, assessment)
4. recruiter_outreach - Contact from a recruiter or recruitment agency
5. job_alert - Automated job listing digest from a job board
6. offer - Job offer (formal or informal)
7. follow_up_request - Request for additional information, documents, or action
8. marketing - Generic career marketing, tips, newsletters, promotions
9. not_job_related - Email is not related to job searching at all

For each classification, also provide:
- A sub_category (see allowed values below)
- A confidence score from 0.0 to 1.0
- A one-sentence rationale explaining your classification
- Whether the email requires urgent attention (true/false)
- Whether the email is from an automated system vs a human (true/false)

Sub-categories by category:
- acknowledgment: "standard", "with_timeline", "with_next_steps"
- rejection: "post_application", "post_interview", "auto"
- interview_invite: "phone", "video", "in_person", "assessment", "panel", "informal"
- recruiter_outreach: "new_role", "speculative", "follow_up"
- job_alert: "linkedin", "indeed", "totaljobs", "reed", "cv_library", "guardian", "jobs_ac_uk", "other"
- offer: "formal", "informal", "conditional"
- follow_up_request: "references", "documents", "assessment", "availability", "information"
- marketing: "newsletter", "promotion", "career_tips", "event"
- not_job_related: "personal", "spam", "other"

IMPORTANT RULES:
- An email that invites the candidate to "discuss" a role or "have a chat" is an interview_invite (sub: informal), NOT recruiter_outreach
- An email from a recruiter that proposes a SPECIFIC role with details is recruiter_outreach (sub: new_role)
- An email asking for "available times" or "availability" for a call/meeting IS an interview_invite (sub: phone or informal)
- An email saying "we have received your application" is acknowledgment, even if it also says "we will review it"
- An email saying "the position has been filled" is a rejection, even if worded positively
- An email from an ATS (Workday, Greenhouse, etc.) could be ANY category -- read the content, not just the sender
- If the email contains BOTH a rejection for one role AND an invitation for another, classify as interview_invite (higher priority)
- Forwarded job postings from contacts should be classified as recruiter_outreach (sub: new_role) with a note that it is a referral

Here are examples of correct classifications for ambiguous cases:

EXAMPLE 1 (recruiter_outreach vs interview_invite boundary):
Email: "Hi Selvi, I came across your profile and have a Senior L&D Manager role at a FTSE 250 company. Would love to share more details. Are you available for a brief chat this week?"
Classification: interview_invite (sub: informal) -- because it requests a specific meeting/call
Confidence: 0.88

EXAMPLE 2 (acknowledgment vs offer boundary):
Email: "Thank you for attending the interview. We were very impressed and would like to move forward with your candidacy. Could you confirm your availability for a start date in May?"
Classification: offer (sub: informal) -- mentions moving forward and asks about start date
Confidence: 0.85

EXAMPLE 3 (interview_invite with indirect phrasing):
Email: "It would be great to have a conversation about next steps. When might suit you next week?"
Classification: interview_invite (sub: informal) -- requests a meeting to discuss next steps
Confidence: 0.82

EXAMPLE 4 (marketing vs job_alert boundary):
Email: "Your weekly job matches: 12 new roles matching your profile. Plus: Download our 2026 Salary Guide!"
Classification: job_alert (sub: linkedin) -- primary content is job matches, marketing is secondary
Confidence: 0.90

EXAMPLE 5 (recruiter_outreach, not interview):
Email: "I'm reaching out as I have several roles that may be of interest to you given your L&D background. I've attached a job description for a Learning Manager position in Reading."
Classification: recruiter_outreach (sub: new_role) -- proposing a specific role, not arranging a meeting
Confidence: 0.92

EXAMPLE 6 (rejection worded positively):
Email: "Thank you for your interest in the Head of L&D role. After careful consideration, we have decided to progress with other candidates whose experience more closely aligns with our current needs. We wish you well."
Classification: rejection (sub: post_application) -- despite polite tone, this is a clear rejection
Confidence: 0.95

EXAMPLE 7 (follow_up_request):
Email: "Further to your recent interview, could you please provide the contact details for two professional references? We would also appreciate a copy of your PhD certificate."
Classification: follow_up_request (sub: references) -- requesting specific documents/information
Confidence: 0.95

EXAMPLE 8 (informal offer that looks like acknowledgment):
Email: "We really enjoyed meeting you and think you'd be a great fit for the team. We'd like to offer you the position. The salary would be GBP 75,000. Could you let us know your thoughts?"
Classification: offer (sub: informal) -- explicitly says "offer you the position" with salary
Confidence: 0.98

EXAMPLE 9 (not_job_related -- personal email that mentions work):
Email: "Hi Selvi, just wanted to check if you're still coming to dinner on Saturday? Also, how's the job hunt going? Mum says she's found a few roles on Indeed but I told her you've got it covered!"
Classification: not_job_related (sub: personal) -- personal email from friend/family; mentions job search casually but is not an application-related communication
Confidence: 0.95

EXAMPLE 10 (not_job_related -- spam disguised as recruitment):
Email: "Congratulations! You have been selected for a remote position earning $5000/week. Click here to start immediately. No experience required."
Classification: not_job_related (sub: spam) -- obvious scam/spam, not a legitimate job communication
Confidence: 0.99

Respond in this exact JSON format:
{
  "classification": "category_code",
  "sub_category": "sub_category_code",
  "confidence": 0.95,
  "rationale": "One sentence explaining the classification",
  "is_urgent": false,
  "is_automated": true,
  "sender_type": "employer|recruiter|job_board|ats|personal_contact|unknown"
}
```

**User Prompt (Haiku):**

```
Classify this email:

FROM: {{ from_name }} <{{ from_email }}>
SUBJECT: {{ subject }}
DATE: {{ date }}
TO: {{ to_email }}

--- EMAIL BODY ---
{{ body_stripped | truncate(3000) }}
--- END EMAIL BODY ---

{% if is_reply %}
This email is a reply in an existing thread. Previous thread context:
ORIGINAL SUBJECT: {{ thread_original_subject }}
THREAD MESSAGES: {{ thread_message_count }}
{% endif %}

{% if has_ics_attachment %}
This email contains a calendar invitation (ICS attachment).
Calendar event summary: {{ ics_summary }}
Calendar event start: {{ ics_start }}
Calendar event end: {{ ics_end }}
Calendar event location: {{ ics_location }}
{% endif %}
```

**Sonnet Escalation Prompt (additional context):**

When escalating to Sonnet, the system includes:
- Full email body (not truncated)
- Complete thread history (all previous messages in the thread)
- The Haiku classification attempt and its confidence score
- Explanation: "The initial classifier was not confident about this email. Please classify with the full context provided."

### 7.4 Classification Confidence Thresholds

| Confidence Range | Action | Model |
|-----------------|--------|-------|
| 0.95 - 1.00 | Accept immediately, high confidence | Haiku or pattern match |
| 0.80 - 0.94 | Accept, normal confidence | Haiku |
| 0.60 - 0.79 | Escalate to Sonnet | Sonnet |
| 0.40 - 0.59 | Sonnet classification, flag for manual review | Sonnet |
| 0.00 - 0.39 | Sonnet classification, send to candidate for confirmation | Sonnet |

**Manual Review Queue:**

Emails with Sonnet confidence below 0.60 are:
1. Classified with Sonnet's best guess
2. Flagged in the database (`needs_review = true`)
3. Included in the daily summary with a "Please verify" note
4. The candidate can correct the classification (future: via simple reply-based interface)

### 7.5 Cost Estimation

**Claude API Pricing (as of 2026-03):**

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|----------------------|
| Claude 3.5 Haiku | $0.25 | $1.25 |
| Claude 3.5 Sonnet | $3.00 | $15.00 |

**Per-Email Cost Estimate:**

| Step | Tokens (avg) | Model | Cost |
|------|-------------|-------|------|
| Classification (Haiku) | 1,500 input + 200 output | Haiku | ~$0.000625 |
| Classification (Sonnet escalation) | 3,000 input + 300 output | Sonnet | ~$0.01350 |
| Data extraction (Haiku) | 2,000 input + 500 output | Haiku | ~$0.001125 |
| Response drafting (Haiku) | 1,500 input + 800 output | Haiku | ~$0.001375 |

**Weekly Cost Estimate (60 emails/week):**

| Scenario | Calculation | Weekly Cost |
|----------|-------------|-------------|
| 40 emails classified by sender pattern (no Claude) | 40 x $0 | $0.00 |
| 15 emails classified by Haiku | 15 x $0.000625 | $0.009 |
| 5 emails escalated to Sonnet | 5 x $0.01350 | $0.068 |
| 20 emails needing data extraction (Haiku) | 20 x $0.001125 | $0.023 |
| 10 response drafts (Haiku) | 10 x $0.001375 | $0.014 |
| **Total** | | **~$0.11/week** |
| **Monthly** | | **~$0.50/month** |

Claude API cost for email classification is negligible. Even at 5x the estimated volume (300 emails/week), the monthly cost would be under $2.50.

### 7.6 Classification Quality Assurance

**Calibration Set:**

A set of 50 reference emails (manually classified) is maintained in the `email_classification_calibration` table. Weekly, the system reclassifies these emails and checks for drift:

```sql
CREATE TABLE email_classification_calibration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_subject VARCHAR(500) NOT NULL,
    email_body TEXT NOT NULL,
    email_from VARCHAR(500),
    expected_classification VARCHAR(50) NOT NULL,
    expected_sub_category VARCHAR(50),
    last_actual_classification VARCHAR(50),
    last_actual_confidence NUMERIC(4,3),
    drift_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_tested_at TIMESTAMPTZ
);
```

**Drift Detection:**
- If more than 10% of calibration emails are misclassified, an alert is sent
- The prompt version and model version are logged with each classification for traceability
- Classification accuracy is tracked as a time series in system_metrics

**Classification Correction Mechanism:**

When the candidate identifies a misclassified email (via the daily summary or QUERY command), a correction triggers cascade re-processing:

1. **Correction input:** Candidate replies to daily summary with `CORRECT [email_id] [correct_category]` or updates via webhook:
   ```
   POST /webhook/email-correction
   { "email_id": "uuid", "correct_classification": "interview_invite", "correct_sub_category": "phone" }
   ```

2. **Cascade re-processing:**
   - Update `email_classifications.manual_classification` and set `manually_reviewed = true`
   - Delete existing `email_extracted_data` for this email (will be re-extracted)
   - Reset `emails.status` to 'classified' (triggers re-extraction by WF-EM-03)
   - If email body has been purged (>7 days old), skip re-extraction and log "body unavailable"
   - If the corrected classification changes the Module 4 status (e.g., rejection -> interview_invite), send a correction webhook to Module 4 to reverse the previous status update
   - Remove incorrect Gmail labels and apply correct ones via WF-EM-04
   - Log the correction in `email_processing_log` with reason

3. **Feedback loop:** Corrections are added to the calibration set if they represent novel patterns, improving future classification accuracy.

---

## 8. Data Extraction Pipeline

### 8.1 Extraction Fields by Category

Each email category has a specific set of fields that the extraction pipeline attempts to populate:

**Interview Invitation:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| company_name | string | Yes | "Acme Corp" |
| role_title | string | Yes | "Senior L&D Manager" |
| interview_date | date | No | "2026-04-02" |
| interview_time | time | No | "10:30" |
| interview_timezone | string | No | "GMT" / "BST" |
| interview_duration | string | No | "45 minutes" |
| interview_format | enum | Yes | "phone" / "video" / "in_person" / "assessment" |
| interview_platform | string | No | "Microsoft Teams" / "Zoom" / "Google Meet" |
| interview_location | string | No | "123 High Street, Reading, RG1 2AA" |
| interview_link | URL | No | "https://teams.microsoft.com/l/meetup-join/..." |
| interviewer_name | string | No | "Sarah Johnson" |
| interviewer_title | string | No | "Head of People" |
| interviewer_email | string | No | "sarah.johnson@acmecorp.co.uk" |
| panel_members | array | No | [{"name": "...", "title": "..."}] |
| preparation_instructions | string | No | "Please prepare a 10-minute presentation on..." |
| what_to_bring | string | No | "Photo ID, proof of right to work" |
| response_deadline | datetime | No | "2026-03-30T17:00:00Z" |
| dress_code | string | No | "Business casual" |
| parking_instructions | string | No | "Visitor parking available at..." |
| contact_for_questions | string | No | "recruitment@acmecorp.co.uk" |
| alternative_times_offered | array | No | ["2026-04-02 10:30", "2026-04-03 14:00"] |
| next_steps | string | No | "Please confirm your attendance by..." |

**Rejection:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| company_name | string | Yes | "University of Reading" |
| role_title | string | Yes | "Lecturer in HRM" |
| rejection_reason | string | No | "We received a large number of applications" |
| rejection_stage | enum | No | "application" / "shortlisting" / "interview" / "final_round" |
| feedback_offered | boolean | No | true |
| feedback_contact | string | No | "hr@reading.ac.uk" |
| future_roles_suggested | boolean | No | true |
| keep_on_file | boolean | No | true |
| reapply_timeline | string | No | "We encourage you to apply for future positions" |

**Application Acknowledgment:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| company_name | string | Yes | "Thames Valley University" |
| role_title | string | Yes | "Head of Organisational Development" |
| reference_number | string | No | "TVU-2026-0342" |
| review_timeline | string | No | "We aim to review all applications within 2 weeks" |
| expected_response_date | date | No | "2026-04-15" |
| next_steps | string | No | "Shortlisted candidates will be contacted by..." |
| application_portal_link | URL | No | "https://careers.tvu.ac.uk/status/..." |

**Recruiter Outreach:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| recruiter_name | string | Yes | "Mark Thompson" |
| recruiter_email | string | Yes | "mark.t@hrrecruit.co.uk" |
| recruiter_phone | string | No | "+44 7700 900123" |
| agency_name | string | No | "HR Recruit UK" |
| proposed_role_title | string | No | "L&D Director" |
| proposed_company | string | No | "Confidential FTSE 100" |
| proposed_salary | string | No | "GBP 85,000 - GBP 95,000" |
| proposed_location | string | No | "London, hybrid 2 days" |
| role_description_summary | string | No | "Leading a team of 12 L&D professionals..." |
| proposed_salary_min | integer | No | 85000 |
| proposed_salary_max | integer | No | 95000 |
| working_pattern | string | No | "hybrid" |
| contract_type | string | No | "permanent" |
| linkedin_profile | URL | No | "https://linkedin.com/in/markthompson" |
| is_exclusive | boolean | No | false |
| urgency | string | No | "Interviews next week" |

**Offer:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| company_name | string | Yes | "Acme Corp" |
| role_title | string | Yes | "Senior L&D Manager" |
| salary_offered | integer | No | 78000 |
| salary_details | string | No | "GBP 78,000 per annum plus benefits" |
| start_date | date | No | "2026-05-01" |
| response_deadline | date | No | "2026-04-05" |
| conditions | array | No | ["subject to satisfactory references", "DBS check"] |
| benefits_mentioned | array | No | ["25 days holiday", "pension 6%", "private medical"] |
| contract_type | string | No | "permanent" |
| probation_period | string | No | "6 months" |
| notice_period | string | No | "3 months" |
| reporting_to | string | No | "Chief People Officer" |
| offer_letter_attached | boolean | No | true |

**Follow-Up Request:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| company_name | string | Yes | "Henley Business School" |
| role_title | string | Yes | "Lecturer in Leadership" |
| action_required | string | Yes | "Provide two professional references" |
| deadline | datetime | No | "2026-04-01T17:00:00Z" |
| documents_requested | array | No | ["PhD certificate", "proof of right to work"] |
| contact_person | string | No | "Jane Williams" |
| contact_email | string | No | "j.williams@henley.ac.uk" |
| portal_link | URL | No | "https://careers.henley.ac.uk/upload/..." |

**Job Alert:**

| Field | Type | Required | Example |
|-------|------|----------|---------|
| source_platform | string | Yes | "linkedin" |
| jobs_listed | array | Yes | [{title, company, location, url, salary}] |
| total_jobs_count | integer | Yes | 15 |
| alert_frequency | string | No | "daily" |
| search_criteria | string | No | "Learning and Development near Maidenhead" |

### 8.2 Extraction Prompt (Claude Haiku)

```
You are a data extraction system for job-search emails. Given a classified email, extract all structured data fields relevant to the classification category.

The email has been classified as: {{ classification }} ({{ sub_category }})

Extract the following fields for this category:
{{ field_list_for_category }}

IMPORTANT RULES:
- Extract only information explicitly stated in the email. Do not infer or assume values for fields like company name, role title, or interviewer name.
- EXCEPTION -- Reasonable defaults: When the email does not specify a timezone or currency, apply these UK-context defaults:
  - Timezone: Assume UK time (GMT or BST depending on date) if not specified. Mark as "assumed_timezone": true in the output.
  - Currency: Assume GBP and annual unless stated otherwise. Mark as "assumed_currency": true in the output.
  - These defaults are NOT inference -- they are context-appropriate defaults for a UK job search. The distinction is: do not guess missing facts, but do apply locale conventions.
- For dates, convert to ISO 8601 format (YYYY-MM-DD). If the email says "next Tuesday" and today is 2026-03-29 (Sunday), next Tuesday is 2026-03-31.
- For times, convert to 24-hour format (HH:MM) and note the timezone if stated.
- For salary, extract both the raw text and parse into numeric min/max if possible.
- For phone numbers, preserve the original format but also provide a normalized version starting with +44.
- If a field cannot be extracted, set it to null.
- For job alerts, extract up to 20 individual job listings from the email body.
- For interview invitations with multiple proposed times, list all options in the alternative_times_offered array.

Respond in this exact JSON format:
{
  "extracted_fields": {
    "field_name": "value",
    ...
  },
  "extraction_confidence": 0.92,
  "fields_not_found": ["field1", "field2"],
  "notes": "Any additional context about the extraction"
}

--- EMAIL ---
FROM: {{ from_name }} <{{ from_email }}>
SUBJECT: {{ subject }}
DATE: {{ date }}

{{ body_stripped }}
--- END EMAIL ---
```

### 8.3 Job Alert Parsing (HTML-Specific)

Job alert emails from major platforms have predictable HTML structures. The system uses platform-specific parsers to extract individual job listings before falling back to Claude for unparseable formats.

**LinkedIn Job Alert Parser:**

```javascript
function parseLinkedInAlert(html) {
  const jobs = [];

  // LinkedIn alerts use a consistent card-based HTML structure
  // Each job is in a <table> with class containing "job-card"
  // or in a <div> with specific data attributes

  // Pattern 1: Card-based layout (2025+ format)
  const cardRegex = /<a[^>]+href="(https:\/\/www\.linkedin\.com\/comm\/jobs\/view\/\d+[^"]*)"[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*>(.*?)<\/span>/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    jobs.push({
      url: match[1].replace(/&amp;/g, '&'),
      title: stripTags(match[2]).trim(),
      company: stripTags(match[3]).trim(),
      location: stripTags(match[4]).trim(),
      source: 'linkedin_email'
    });
  }

  // Pattern 2: List-based layout (fallback)
  if (jobs.length === 0) {
    const listRegex = /<tr[^>]*>[\s\S]*?<a[^>]+href="(https:\/\/www\.linkedin\.com[^"]*jobs[^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<\/tr>/gi;
    while ((match = listRegex.exec(html)) !== null) {
      jobs.push({
        url: match[1].replace(/&amp;/g, '&'),
        title: stripTags(match[2]).trim(),
        source: 'linkedin_email'
      });
    }
  }

  return jobs;
}
```

**Indeed Job Alert Parser:**

```javascript
function parseIndeedAlert(html) {
  const jobs = [];

  // Indeed alerts use a table-based layout with job cards
  const cardRegex = /<a[^>]+href="(https?:\/\/[^"]*indeed[^"]*\/viewjob[^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*jobTitle[^"]*"[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*companyName[^"]*"[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*companyLocation[^"]*"[^>]*>(.*?)<\/span>/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    jobs.push({
      url: match[1].replace(/&amp;/g, '&'),
      title: stripTags(match[2]).trim(),
      company: stripTags(match[3]).trim(),
      location: stripTags(match[4]).trim(),
      source: 'indeed_email'
    });
  }

  return jobs;
}
```

**TotalJobs Alert Parser:**

```javascript
function parseTotalJobsAlert(html) {
  const jobs = [];

  // TotalJobs uses a div-based card layout
  const cardRegex = /<a[^>]+href="(https?:\/\/www\.totaljobs\.com\/job\/[^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*company[^"]*"[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*location[^"]*"[^>]*>(.*?)<\/span>/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    jobs.push({
      url: match[1].replace(/&amp;/g, '&'),
      title: stripTags(match[2]).trim(),
      company: stripTags(match[3]).trim(),
      location: stripTags(match[4]).trim(),
      source: 'totaljobs_email'
    });
  }

  return jobs;
}
```

**Reed Alert Parser:**

```javascript
function parseReedAlert(html) {
  const jobs = [];

  // Reed uses a structured table layout
  const cardRegex = /<a[^>]+href="(https?:\/\/www\.reed\.co\.uk\/jobs\/[^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<span[^>]*>(.*?)<\/span>[\s\S]*?<span[^>]*>(.*?)<\/span>/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const salaryMatch = html.substring(match.index, match.index + 500).match(/£[\d,]+ - £[\d,]+|£[\d,]+\+?/);

    jobs.push({
      url: match[1].replace(/&amp;/g, '&'),
      title: stripTags(match[2]).trim(),
      company: stripTags(match[3]).trim(),
      location: stripTags(match[4]).trim(),
      salary_raw: salaryMatch ? salaryMatch[0] : null,
      source: 'reed_email'
    });
  }

  return jobs;
}
```

**Zero-Result Fallback:** If a platform-specific parser returns zero job listings from an email that was classified as `job_alert`, the system falls back to the Claude generic parser automatically. This handles the case where platforms update their HTML email templates and the hardcoded selectors stop matching. The fallback is logged in `email_processing_log` with `notes = 'Platform parser returned 0 results; fell back to Claude'`. If the fallback triggers for the same platform 3+ times in a week, an alert is sent to review and update the platform-specific parser.

**Generic Alert Parser (Claude Fallback):**

For alerts from platforms without a dedicated parser (or when a platform-specific parser returns zero results), the system sends the email body to Claude Haiku for extraction:

```
Extract all individual job listings from this job alert email. For each job, extract:
- title: Job title
- company: Company name (if shown)
- location: Location (if shown)
- url: Direct link to the job listing
- salary: Salary information (if shown)

The email is from {{ source_platform }}.

Respond as JSON:
{
  "jobs": [
    { "title": "...", "company": "...", "location": "...", "url": "...", "salary": "..." },
    ...
  ],
  "total_found": 15,
  "parsing_notes": "..."
}

--- EMAIL BODY ---
{{ body_stripped }}
```

### 8.4 ICS Calendar Parsing

For emails with ICS (iCalendar) attachments:

```javascript
function parseICSAttachment(icsContent) {
  // Parse the ICS format
  const event = {};

  const lines = icsContent.split(/\r?\n/);
  let inEvent = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; continue; }
    if (line === 'END:VEVENT') { inEvent = false; continue; }
    if (!inEvent) continue;

    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':');
    const cleanKey = key.split(';')[0]; // Remove parameters like TZID

    switch (cleanKey) {
      case 'SUMMARY':
        event.title = value;
        break;
      case 'DTSTART':
        event.start = parseICSDateTime(value, key);
        break;
      case 'DTEND':
        event.end = parseICSDateTime(value, key);
        break;
      case 'LOCATION':
        event.location = value;
        break;
      case 'DESCRIPTION':
        event.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
        break;
      case 'ORGANIZER':
        event.organizer = value.replace('mailto:', '');
        break;
      case 'URL':
        event.url = value;
        break;
      case 'STATUS':
        event.status = value; // CONFIRMED, TENTATIVE, CANCELLED
        break;
    }
  }

  return event;
}

function parseICSDateTime(value, key) {
  // Handle both UTC and timezone-specified dates
  // 20260402T103000Z -> UTC
  // DTSTART;TZID=Europe/London:20260402T103000 -> London timezone
  const tzidMatch = key.match(/TZID=([^:;]+)/);
  const timezone = tzidMatch ? tzidMatch[1] : (value.endsWith('Z') ? 'UTC' : 'Europe/London');

  const dateStr = value.replace('Z', '');
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(9, 11) || '00';
  const minute = dateStr.substring(11, 13) || '00';

  return {
    datetime: `${year}-${month}-${day}T${hour}:${minute}:00`,
    timezone: timezone
  };
}
```

### 8.5 ATS-Specific Extraction Rules

Major UK ATS platforms use predictable email templates. The system maintains extraction rules for each:

**Workday:**
```javascript
const workdayExtraction = {
  acknowledgment: {
    role_pattern: /applied for the\s+(.+?)\s+position/i,
    reference_pattern: /reference\s*(?:number|#|id)?\s*:?\s*([\w-]+)/i,
    company_pattern: /at\s+(.+?)[\.\,\n]/i
  },
  rejection: {
    role_pattern: /regarding\s+(?:your application for\s+)?(?:the\s+)?(.+?)\s+(?:position|role)/i,
    feedback_pattern: /feedback|review your application/i
  },
  interview: {
    date_pattern: /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    time_pattern: /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i,
    platform_pattern: /(?:via|using|on)\s+(Microsoft Teams|Zoom|Google Meet|Skype|WebEx)/i
  }
};
```

**Greenhouse:**
```javascript
const greenhouseExtraction = {
  acknowledgment: {
    role_pattern: /for\s+(?:the\s+)?(.+?)\s+(?:role|position)/i,
    company_pattern: /at\s+(.+?)[\.\,\n]/i
  },
  interview: {
    scheduling_link: /schedule your interview[\s\S]*?(https:\/\/[^\s"<]+)/i,
    date_pattern: /scheduled for\s+(.+?)(?:\s+at\s+|$)/i,
    time_pattern: /at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(GMT|BST|UTC)?/i
  }
};
```

**Lever:**
```javascript
const leverExtraction = {
  acknowledgment: {
    role_pattern: /applied to\s+(.+?)\s+at/i,
    company_pattern: /at\s+(.+?)[\.\,\n]/i
  },
  interview: {
    scheduling_link: /book your interview[\s\S]*?(https:\/\/[^\s"<]+)/i,
    calendly_link: /(https:\/\/calendly\.com\/[^\s"<]+)/i
  }
};
```

### 8.6 Date and Time Parsing

UK date formats are ambiguous. The extraction pipeline handles multiple formats:

```javascript
function parseDateExpression(text, referenceDate) {
  // referenceDate is the email date, used for relative expressions

  // Explicit dates: "2 April 2026", "02/04/2026", "2nd April"
  const explicitPatterns = [
    // "2 April 2026" or "2nd April 2026"
    /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    // "April 2, 2026" (US format -- less common in UK but used by some ATS)
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
    // "02/04/2026" (DD/MM/YYYY in UK)
    /(\d{2})\/(\d{2})\/(\d{4})/,
    // "2026-04-02" (ISO)
    /(\d{4})-(\d{2})-(\d{2})/
  ];

  // Relative dates: "next Tuesday", "this Friday", "tomorrow"
  const relativeMappings = {
    'today': 0,
    'tomorrow': 1,
    'day after tomorrow': 2,
    'monday': null, // computed from day of week
    'tuesday': null,
    'wednesday': null,
    'thursday': null,
    'friday': null,
    'next week': 7,
    'next monday': null,
    'next tuesday': null,
    'next wednesday': null,
    'next thursday': null,
    'next friday': null
  };

  // Time parsing: "10:30", "10:30 AM", "2pm", "14:00"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/,
    /(\d{1,2}):(\d{2})/,
    /(\d{1,2})\s*(AM|PM|am|pm)/
  ];

  // UK timezone: GMT (Nov-Mar) or BST (Mar-Oct)
  function getUKTimezone(date) {
    // BST: last Sunday in March to last Sunday in October
    const month = date.getMonth();
    if (month >= 3 && month <= 9) return 'BST';
    if (month === 2) {
      const lastSunday = new Date(date.getFullYear(), 2, 31);
      lastSunday.setDate(31 - lastSunday.getDay());
      return date >= lastSunday ? 'BST' : 'GMT';
    }
    if (month === 10) {
      const lastSunday = new Date(date.getFullYear(), 9, 31);
      lastSunday.setDate(31 - lastSunday.getDay());
      return date < lastSunday ? 'BST' : 'GMT';
    }
    return 'GMT';
  }

  // Implementation would try each pattern and return the first match
  // ... (full implementation in the Code node)
}

/**
 * Cross-validate day-of-week against date.
 * If an email says "Tuesday 2nd April" but April 2nd is actually a Thursday,
 * this function flags the inconsistency so a warning can be added to the draft.
 */
function crossValidateDateDay(parsedDate, mentionedDayOfWeek) {
  if (!parsedDate || !mentionedDayOfWeek) return { valid: true };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const actualDay = dayNames[parsedDate.getDay()];
  const mentionedDay = mentionedDayOfWeek.charAt(0).toUpperCase() + mentionedDayOfWeek.slice(1).toLowerCase();

  if (actualDay !== mentionedDay) {
    return {
      valid: false,
      warning: `DATE MISMATCH: The email mentions "${mentionedDay}" but ${parsedDate.toISOString().split('T')[0]} is actually a ${actualDay}. Please verify the correct date before sending any response.`,
      mentioned_day: mentionedDay,
      actual_day: actualDay,
      parsed_date: parsedDate.toISOString().split('T')[0]
    };
  }

  return { valid: true, actual_day: actualDay };
}
```

**Date Validation in Draft Generation:**

When creating interview confirmation drafts (WF-EM-05), the system runs `crossValidateDateDay()` on the extracted interview date. If a mismatch is detected:

1. The draft includes a prominent warning at the top: `"WARNING: The email mentions [Tuesday] but [2 April 2026] is a [Thursday]. Please verify the correct date with the employer before sending this response."`
2. The notification email includes the same warning
3. The `email_extracted_data` record is flagged with `date_validation_warning = true`
4. The draft confirmation text uses the date only (not the day name) to avoid compounding the error
```

### 8.7 Company Name Matching

When extracting company names from emails, the system must match them against the Module 4 application tracker to link email status updates to the correct application:

```javascript
function matchCompanyToApplication(extractedCompany, extractedRole, applications) {
  // Score each application based on match quality
  const scores = applications.map(app => {
    let score = 0;

    // Exact company name match
    if (normalize(app.company) === normalize(extractedCompany)) score += 50;

    // Fuzzy company name match (Levenshtein distance)
    const companyDistance = levenshtein(normalize(app.company), normalize(extractedCompany));
    if (companyDistance <= 3) score += 40 - (companyDistance * 5);

    // Company name contains match (e.g., "Acme" matches "Acme Corp Ltd")
    if (normalize(app.company).includes(normalize(extractedCompany)) ||
        normalize(extractedCompany).includes(normalize(app.company))) {
      score += 30;
    }

    // Role title match
    if (normalize(app.role_title) === normalize(extractedRole)) score += 30;

    // Fuzzy role title match
    const roleDistance = levenshtein(normalize(app.role_title), normalize(extractedRole));
    if (roleDistance <= 5) score += 20 - (roleDistance * 2);

    // Recency boost (applications submitted more recently are more likely to receive responses)
    const daysSinceApplication = daysBetween(app.applied_at, new Date());
    if (daysSinceApplication <= 7) score += 10;
    else if (daysSinceApplication <= 30) score += 5;

    return { application: app, score };
  });

  // Return best match if score exceeds threshold
  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 50) {
    return { match: best.application, confidence: Math.min(best.score / 100, 1.0) };
  }

  return { match: null, confidence: 0 };
}

function normalize(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/\b(ltd|limited|plc|inc|corp|llc|uk|group)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

---

## 9. Auto-Labeling & Organization

### 9.1 Gmail Label Hierarchy

The system creates and maintains the following label hierarchy in Gmail:

```
Job/
├── Applied          -- Application acknowledgments
├── Interview        -- Interview invitations (all formats)
│   ├── Upcoming     -- Interviews not yet attended
│   └── Completed    -- Interviews already attended
├── Rejected         -- Rejection notifications
├── Recruiter        -- Recruiter outreach
│   ├── Active       -- Ongoing conversations
│   └── Low-Priority -- Blacklisted or consistently irrelevant recruiters
├── Alert            -- Job alert digests
│   └── Processed    -- Alerts that have been parsed by Module 1
├── Offer            -- Job offers
├── Follow-Up        -- Follow-up requests requiring action
│   ├── Pending      -- Action not yet taken
│   └── Completed    -- Action completed
├── Marketing        -- Generic marketing emails
├── Referral         -- Job referrals from personal contacts
└── Processed        -- Internal label: email has been processed by Module 5
```

### 9.2 Label Creation (One-Time Setup)

The system creates labels automatically on first run if they do not exist:

```javascript
const LABELS = [
  { name: 'Job', color: { backgroundColor: '#4986e7', textColor: '#ffffff' } },
  { name: 'Job/Applied', color: { backgroundColor: '#a479e2', textColor: '#ffffff' } },
  { name: 'Job/Interview', color: { backgroundColor: '#f691b2', textColor: '#ffffff' } },
  { name: 'Job/Interview/Upcoming', color: { backgroundColor: '#fb4c2f', textColor: '#ffffff' } },
  { name: 'Job/Interview/Completed', color: { backgroundColor: '#b99aff', textColor: '#ffffff' } },
  { name: 'Job/Rejected', color: { backgroundColor: '#cccccc', textColor: '#000000' } },
  { name: 'Job/Recruiter', color: { backgroundColor: '#ffad46', textColor: '#ffffff' } },
  { name: 'Job/Recruiter/Active', color: { backgroundColor: '#ffad46', textColor: '#ffffff' } },
  { name: 'Job/Recruiter/Low-Priority', color: { backgroundColor: '#e3d7ff', textColor: '#000000' } },
  { name: 'Job/Alert', color: { backgroundColor: '#89d3b2', textColor: '#000000' } },
  { name: 'Job/Alert/Processed', color: { backgroundColor: '#c9daf8', textColor: '#000000' } },
  { name: 'Job/Offer', color: { backgroundColor: '#16a765', textColor: '#ffffff' } },
  { name: 'Job/Follow-Up', color: { backgroundColor: '#fbe983', textColor: '#000000' } },
  { name: 'Job/Follow-Up/Pending', color: { backgroundColor: '#fbe983', textColor: '#000000' } },
  { name: 'Job/Follow-Up/Completed', color: { backgroundColor: '#c9daf8', textColor: '#000000' } },
  { name: 'Job/Marketing', color: { backgroundColor: '#e3d7ff', textColor: '#000000' } },
  { name: 'Job/Referral', color: { backgroundColor: '#42d692', textColor: '#ffffff' } },
  { name: 'Job/Processed', color: { backgroundColor: '#ffffff', textColor: '#000000' } }
];

async function ensureLabelsExist(gmailApi) {
  const existingLabels = await gmailApi.listLabels();
  const existingNames = existingLabels.map(l => l.name);

  for (const label of LABELS) {
    if (!existingNames.includes(label.name)) {
      await gmailApi.createLabel({
        name: label.name,
        labelListVisibility: label.name === 'Job/Processed' ? 'labelHide' : 'labelShow',
        messageListVisibility: label.name === 'Job/Processed' ? 'hide' : 'show',
        color: label.color
      });
    }
  }
}
```

### 9.3 Label Application Logic

```javascript
function getLabelForClassification(classification, subCategory, recruiterStatus) {
  const labelMap = {
    'acknowledgment': 'Job/Applied',
    'rejection': 'Job/Rejected',
    'interview_invite': 'Job/Interview/Upcoming',
    'recruiter_outreach': recruiterStatus === 'blacklisted'
      ? 'Job/Recruiter/Low-Priority'
      : 'Job/Recruiter/Active',
    'job_alert': 'Job/Alert',
    'offer': 'Job/Offer',
    'follow_up_request': 'Job/Follow-Up/Pending',
    'marketing': 'Job/Marketing',
    'not_job_related': null  // Do not label non-job emails
  };

  const primaryLabel = labelMap[classification];
  if (!primaryLabel) return [];

  // Always add the "Job/Processed" label to mark as processed
  return [primaryLabel, 'Job/Processed'];
}
```

**Gmail API Label Application:**

```
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ messageId }}/modify
Body: {
  "addLabelIds": ["Label_123", "Label_456"],
  "removeLabelIds": []
}
```

**n8n Gmail Node Configuration (Label Application):**
```
Node: Gmail
Operation: Add Labels
Message ID: {{ $json.gmail_message_id }}
Labels: {{ $json.labels_to_apply }}
```

### 9.4 Label Lifecycle Management

Labels are not static. As application status changes, labels are updated:

| Event | Label Action |
|-------|-------------|
| Interview attended | Move from `Job/Interview/Upcoming` to `Job/Interview/Completed` |
| Follow-up action completed | Move from `Job/Follow-Up/Pending` to `Job/Follow-Up/Completed` |
| Job alert parsed by Module 1 | Add `Job/Alert/Processed` |
| Recruiter blacklisted | Move from `Job/Recruiter/Active` to `Job/Recruiter/Low-Priority` |
| Recruiter rehabilitated | Move from `Job/Recruiter/Low-Priority` to `Job/Recruiter/Active` |

These label transitions are triggered by the corresponding Module 4 status updates or recruiter management actions.

### 9.4b Label Precedence and Cleanup

When a thread contains multiple emails with different classifications (e.g., acknowledgment followed by interview_invite), labels accumulate. The system applies precedence rules:

**Label precedence (highest to lowest):**
1. `Job-Search/Offers` -- always takes priority
2. `Job-Search/Interviews` -- supersedes acknowledgment/rejection
3. `Job-Search/Follow-Up-Required`
4. `Job-Search/Applications/Acknowledged`
5. `Job-Search/Applications/Rejected`
6. `Job-Search/Recruiter-Outreach`
7. `Job-Search/Job-Alerts`

**Cleanup rule:** When a higher-precedence label is applied to a thread, lower-precedence labels for the same application are removed. For example, when an interview_invite arrives for a thread that already has `Applications/Acknowledged`, the acknowledgment label is removed and `Interviews` is applied. This prevents the thread from appearing in multiple folders.

**Implementation:** WF-EM-04 checks for existing job-search labels on the thread before applying new ones. If a higher-precedence label would be applied, it removes lower-precedence labels in the same removal API call.

### 9.5 Thread-Level Labeling

Gmail labels can be applied at the thread level or message level. Module 5 applies labels at the **message level** because different messages in the same thread may have different classifications (e.g., acknowledgment followed by interview invitation in the same thread).

However, when a thread contains an interview invitation, the entire thread is also given the `Job/Interview` parent label for visibility in Gmail's label view.

---

## 10. Recruiter Relationship Management

### 10.1 Recruiter Lifecycle

```
                         [First Contact Email]
                                |
                                v
                    +--- [Classify as recruiter_outreach] ---+
                    |                                        |
                    v                                        v
           [New Recruiter?]                          [Known Recruiter?]
                |                                        |
                v                                        v
    [Create recruiter_contact]              [Update existing record]
    [Extract name, agency,                  [Add new role proposal]
     email, phone]                          [Update last_contact_at]
                |                                        |
                +-------------------+--------------------+
                                    |
                                    v
                        [Score proposed role]
                                    |
                    +---------------+----------------+
                    |               |                |
                    v               v                v
              [A/B-tier]      [C-tier]         [D-tier]
              Notify          Log only         Log, consider
              candidate                        blacklist if
                                               pattern persists
                    |               |                |
                    v               v                v
            [Track response]  [Track response]  [No action]
            [Monitor reply]   [No follow-up]
                    |
                    v
            [Conversation continues?]
                    |
            +-------+--------+
            |                |
            v                v
       [Active]         [Stale (14+ days)]
       Continue         Flag in daily
       tracking         summary
```

### 10.2 Recruiter Quality Scoring

Each recruiter gets a quality score based on their interaction history:

```javascript
function calculateRecruiterQuality(recruiter) {
  let score = 50; // Start at neutral

  // Role relevance (average of all proposed role scores)
  const avgRelevance = recruiter.roles.reduce((sum, r) => sum + r.relevance_score, 0) / recruiter.roles.length;
  score += (avgRelevance - 50) * 0.5; // -25 to +25 based on relevance

  // Contact frequency (penalize spam, reward appropriate frequency)
  const contactsPerMonth = recruiter.total_contacts / recruiter.months_known;
  if (contactsPerMonth >= 1 && contactsPerMonth <= 4) score += 10; // Good frequency
  if (contactsPerMonth > 8) score -= 15; // Too frequent
  if (contactsPerMonth > 12) score -= 25; // Spam territory

  // Response pattern
  if (recruiter.responded_to_our_reply) score += 10; // They followed up
  if (recruiter.ghosted_after_our_reply) score -= 15; // They disappeared

  // Exclusive roles (recruiter has roles not seen on job boards)
  if (recruiter.exclusive_role_count > 0) score += 15;

  // Specificity (personalized outreach vs. mass blast)
  if (recruiter.personalization_score > 0.7) score += 10;
  if (recruiter.personalization_score < 0.3) score -= 10;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### 10.2b Role Relevance Scoring

Each proposed role from a recruiter receives a relevance score against the candidate's profile. This score drives the tiered response drafting (A/B/C/D tiers) in WF-EM-05 and the notification urgency in WF-EM-06.

**Scoring Algorithm:**

```javascript
function scoreRoleRelevance(proposedRole, candidateProfile) {
  let score = 0;

  // 1. Role title match (0-30 points)
  const TARGET_TITLES = [
    { pattern: /head of (l&d|learning|people development)/i, points: 30 },
    { pattern: /director.*(l&d|learning|talent)/i, points: 28 },
    { pattern: /(senior )?l&d manager/i, points: 30 },
    { pattern: /learning.*(development )?(manager|lead)/i, points: 25 },
    { pattern: /(senior )?lecturer/i, points: 28 },
    { pattern: /talent development/i, points: 22 },
    { pattern: /organisational development/i, points: 20 },
    { pattern: /hr (manager|director|business partner)/i, points: 15 },
    { pattern: /training (manager|lead|coordinator)/i, points: 18 },
    { pattern: /(junior|assistant|coordinator|admin)/i, points: 2 },
  ];
  const titleMatch = TARGET_TITLES.find(t => t.pattern.test(proposedRole.title));
  score += titleMatch ? titleMatch.points : 5; // 5 for unknown but potentially relevant

  // 2. Seniority alignment (0-20 points)
  const seniorityKeywords = {
    high: ['head', 'director', 'senior manager', 'senior lecturer', 'principal'],
    mid: ['manager', 'lead', 'lecturer', 'senior'],
    low: ['coordinator', 'assistant', 'junior', 'administrator', 'intern']
  };
  if (seniorityKeywords.high.some(k => proposedRole.title.toLowerCase().includes(k))) score += 20;
  else if (seniorityKeywords.mid.some(k => proposedRole.title.toLowerCase().includes(k))) score += 15;
  else if (seniorityKeywords.low.some(k => proposedRole.title.toLowerCase().includes(k))) score += 0;
  else score += 10; // Unknown seniority

  // 3. Salary alignment (0-20 points)
  if (proposedRole.salary_max && proposedRole.salary_min) {
    const TARGET_MIN = 70000;
    const TARGET_MAX = 85000;
    if (proposedRole.salary_min >= TARGET_MIN && proposedRole.salary_max <= TARGET_MAX * 1.3) score += 20;
    else if (proposedRole.salary_max >= TARGET_MIN * 0.85) score += 12;
    else if (proposedRole.salary_max >= TARGET_MIN * 0.7) score += 5;
    else score += 0; // Significantly below target
  } else {
    score += 10; // Salary not disclosed -- neutral
  }

  // 4. Location proximity (0-15 points)
  const NEARBY_AREAS = ['maidenhead', 'reading', 'slough', 'windsor', 'bracknell', 'wokingham',
    'high wycombe', 'marlow', 'henley', 'berkshire', 'buckinghamshire', 'oxfordshire',
    'london', 'surrey', 'hampshire', 'thames valley'];
  const locationLower = (proposedRole.location || '').toLowerCase();
  if (locationLower.includes('remote') || locationLower.includes('hybrid')) score += 15;
  else if (NEARBY_AREAS.some(a => locationLower.includes(a))) score += 15;
  else if (locationLower.includes('south east') || locationLower.includes('home counties')) score += 10;
  else if (locationLower) score += 3; // Known location but far
  else score += 8; // Location not specified -- neutral

  // 5. Sector alignment (0-15 points)
  const PREFERRED_SECTORS = ['higher education', 'university', 'corporate', 'financial services',
    'professional services', 'nhs', 'public sector', 'consulting'];
  const descLower = (proposedRole.description || proposedRole.title || '').toLowerCase();
  if (PREFERRED_SECTORS.some(s => descLower.includes(s))) score += 15;
  else score += 7; // Unknown sector

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

**Tier Thresholds:**

| Tier | Score Range | Draft Tone | Notification |
|------|-----------|------------|-------------|
| A-tier | 80-100 | Enthusiastic interest, propose call | Immediate notification |
| B-tier | 60-79 | Express interest, ask clarifying questions | Daily summary |
| C-tier | 40-59 | Polite decline, describe preferences (without salary) | Daily summary |
| D-tier | 0-39 | Brief polite decline | Not notified |

**Relevance Scoring Model:** Claude Haiku is used for scoring when the extraction pipeline identifies a recruiter outreach email. The structured fields extracted from the email (role title, salary, location, company) are passed to `scoreRoleRelevance()`. If the extraction does not yield structured salary or location data, Claude is prompted to infer them from the email body before scoring. The relevance score and tier are stored in the `recruiter_role_proposals` table.

### 10.3 Recruiter Deduplication

Recruiters may contact from different email addresses (personal, agency, alias). The system detects duplicates:

```javascript
function detectRecruiterDuplicate(newRecruiter, existingRecruiters) {
  for (const existing of existingRecruiters) {
    // Same email domain + similar name
    if (getDomain(newRecruiter.email) === getDomain(existing.email)) {
      const nameSimilarity = jaroWinkler(newRecruiter.name, existing.name);
      if (nameSimilarity > 0.85) return { duplicate: true, matchId: existing.id, confidence: nameSimilarity };
    }

    // Same phone number
    if (newRecruiter.phone && normalizePhone(newRecruiter.phone) === normalizePhone(existing.phone)) {
      return { duplicate: true, matchId: existing.id, confidence: 0.95 };
    }

    // Same name + same agency
    if (normalize(newRecruiter.agency) === normalize(existing.agency) &&
        normalize(newRecruiter.name) === normalize(existing.name)) {
      return { duplicate: true, matchId: existing.id, confidence: 0.90 };
    }

    // Same LinkedIn profile
    if (newRecruiter.linkedin_url && newRecruiter.linkedin_url === existing.linkedin_url) {
      return { duplicate: true, matchId: existing.id, confidence: 1.0 };
    }
  }

  return { duplicate: false };
}
```

### 10.4 Agency Tracking

Recruiters are grouped by agency. Agency-level metrics provide additional insight:

| Agency Metric | Calculation | Purpose |
|---------------|-------------|---------|
| Total recruiters contacted from | Count of distinct recruiter_contacts by agency | Gauge agency size/engagement |
| Average role relevance | Mean relevance score of all proposed roles | Quality indicator |
| Unique roles proposed | Count of distinct roles (deduplicated) | Volume indicator |
| Response rate | Percentage of our responses that got a reply | Engagement quality |
| Exclusive role percentage | Roles not found on public job boards | Value-add indicator |
| Agency quality score | Weighted average of above metrics | Overall ranking |

### 10.5 Stale Conversation Detection

WF-EM-08 runs every 30 minutes to detect stale conversations:

```sql
-- Find conversations awaiting our response (we have not replied within 48 hours)
SELECT
    rc.id,
    rc.recruiter_name,
    rc.agency_name,
    et.last_received_at,
    et.last_sent_at,
    EXTRACT(EPOCH FROM (NOW() - et.last_received_at)) / 3600 AS hours_since_received
FROM recruiter_contacts rc
JOIN email_threads et ON et.recruiter_contact_id = rc.id
WHERE et.status = 'active'
    AND et.last_received_at > et.last_sent_at  -- They sent last
    AND et.last_received_at < NOW() - INTERVAL '48 hours'
    AND rc.status != 'blacklisted'
ORDER BY et.last_received_at ASC;

-- Find conversations where recruiter has not responded to us (5+ business days)
SELECT
    rc.id,
    rc.recruiter_name,
    rc.agency_name,
    et.last_sent_at,
    et.last_received_at,
    EXTRACT(EPOCH FROM (NOW() - et.last_sent_at)) / 86400 AS days_since_sent
FROM recruiter_contacts rc
JOIN email_threads et ON et.recruiter_contact_id = rc.id
WHERE et.status = 'active'
    AND et.last_sent_at > et.last_received_at  -- We sent last
    AND et.last_sent_at < NOW() - INTERVAL '5 days'
    AND rc.status != 'blacklisted'
ORDER BY et.last_sent_at ASC;

-- Flag dormant conversations (no activity for 14+ days)
UPDATE email_threads
SET status = 'dormant'
WHERE status = 'active'
    AND GREATEST(last_received_at, last_sent_at) < NOW() - INTERVAL '14 days';
```

---

## 11. Response Drafting & Templates

### 11.1 Draft Generation Architecture

Response drafts are generated by Claude Haiku and created as Gmail drafts in the candidate's account. The candidate reviews and sends (or discards) each draft manually. The system never sends emails automatically.

```
[Classified Email]
    |
    v
[Should Draft?]
    |-- interview_invite: YES (always)
    |-- acknowledgment: CONDITIONAL (A-tier only, configurable)
    |-- recruiter_outreach: YES (always)
    |-- offer: NO (too important for auto-drafting)
    |-- follow_up_request: YES (always)
    |-- rejection: NO (no response needed)
    |-- job_alert: NO
    |-- marketing: NO
    v
[Generate Draft via Claude Haiku]
    |
    v
[Create Draft in Gmail]
    |-- reply to original email (maintains thread)
    |-- include candidate signature
    v
[Log draft creation in email_processing_log]
```

### 11.2 Draft Generation Prompts

**Interview Confirmation Draft:**

```
You are writing a professional email reply for Selvi Chellamma, a PhD + MBA professional with 18 years of HR/L&D experience, confirming attendance at a job interview.

Context:
- Company: {{ company_name }}
- Role: {{ role_title }}
- Interview date: {{ interview_date }}
- Interview time: {{ interview_time }}
- Interview format: {{ interview_format }}
- Interview location/link: {{ interview_location_or_link }}
- Interviewer: {{ interviewer_name }}

{{ if preparation_instructions }}
Preparation requirements mentioned in the invitation: {{ preparation_instructions }}
{{ endif }}
{{ if presentation_topic }}
Presentation topic: {{ presentation_topic }} ({{ presentation_duration_minutes }} minutes)
{{ endif }}

Write a brief, professional reply (3-6 sentences) that:
1. Thanks them for the invitation
2. Confirms attendance at the specified date and time
3. If the format is video, confirms she has the required software
4. If in-person, acknowledges the location
5. If preparation requirements are specified (presentation, portfolio, case study, documents to bring), explicitly acknowledge them: "I note the request to prepare [X] and will have this ready."
6. If a presentation topic is given, confirm understanding of the topic and duration
7. Expresses enthusiasm about the opportunity without being excessive
8. Signs off professionally

Tone: Professional, warm, concise. UK business English. No American spelling. No excessive enthusiasm or flattery. No AI-sounding phrases like "I am thrilled" or "I am excited to share." Just direct and human.

The reply should start directly with the greeting (Dear/Hi), not with "Subject:" or any metadata.

Candidate signature:
Selvi Chellamma
PhD, MBA
chellamma.uk@gmail.com
+44 [phone number]
```

**Recruiter Response Draft (A/B-tier role):**

```
You are writing a professional email reply for Selvi Chellamma, responding to a recruiter who has proposed a role that matches her profile well.

Context:
- Recruiter: {{ recruiter_name }}
- Agency: {{ agency_name }}
- Proposed role: {{ proposed_role_title }}
- Proposed company: {{ proposed_company }}
- Proposed salary: {{ proposed_salary }}
- Proposed location: {{ proposed_location }}

Selvi's background: PhD in Organizational Behaviour, MBA, 18 years in HR/L&D across Asia and UK, expertise in learning strategy, talent development, leadership development, and organisational change. Currently seeking L&D Manager/Head of L&D roles or university Lecturer positions.

Write a brief, professional reply (4-6 sentences) that:
1. Thanks the recruiter for reaching out
2. Expresses genuine interest in the role
3. Highlights 1-2 relevant aspects of her experience that connect to the role
4. Suggests a phone call to discuss further
5. Proposes availability (e.g., "I am available for a call this week at your convenience")

Tone: Professional, personable, not desperate. UK business English. Direct and confident. Avoid cliches. Avoid AI-sounding phrases.

The reply should start directly with the greeting.

Candidate signature:
Selvi Chellamma
PhD, MBA
chellamma.uk@gmail.com
```

**Recruiter Response Draft (C-tier role):**

```
You are writing a professional email reply for Selvi Chellamma, responding to a recruiter who has proposed a role that does not quite match her profile.

Context:
- Recruiter: {{ recruiter_name }}
- Agency: {{ agency_name }}
- Proposed role: {{ proposed_role_title }}
- Mismatch reasons: {{ mismatch_reasons }}

Write a brief, professional reply (3-4 sentences) that:
1. Thanks the recruiter for thinking of her
2. Briefly explains why this particular role is not the right fit (without being dismissive)
3. Describes what she IS looking for in general terms: senior L&D leadership roles or university lecturing positions in the South East of England. Do NOT include specific salary expectations or exact location -- keep it broad.
4. Expresses openness to hearing about roles that better match

IMPORTANT: Never include specific salary range (e.g., GBP 70-80k) in decline emails. Revealing salary expectations to recruiters who send irrelevant roles weakens the candidate's negotiating position for all future interactions. Keep geographic preferences vague ("South East" or "Thames Valley area" rather than a specific town).

Tone: Polite but clear. Not apologetic. UK business English.

The reply should start directly with the greeting.
```

**Acknowledgment Reply Draft (A-tier applications):**

```
You are writing a brief reply for Selvi Chellamma in response to an application acknowledgment email.

Context:
- Company: {{ company_name }}
- Role: {{ role_title }}
- Sender: {{ sender_name }}

Write a very brief reply (2-3 sentences) that:
1. Thanks them for confirming receipt
2. Confirms continued strong interest in the position
3. Notes she is happy to provide any additional information

Keep it short and professional. Do not restate her qualifications (they have her CV). UK business English.
```

**Follow-Up Response Draft:**

```
You are writing a reply for Selvi Chellamma in response to a request for additional information or documents.

Context:
- Company: {{ company_name }}
- Role: {{ role_title }}
- Action requested: {{ action_required }}
- Deadline: {{ deadline }}

Write a professional reply (3-4 sentences) that:
1. Acknowledges the request
2. For items the candidate definitely has (CV, certificates, ID): confirm she will provide them
3. For items that require preparation (references, portfolio, writing samples): do NOT promise immediate delivery. Instead say "I will arrange this and send through shortly" or "I will confirm these details as soon as possible"
4. If there is a deadline, acknowledge the deadline but do NOT unconditionally promise to meet it if the requested items require third-party coordination (e.g., referee responses)
5. If the request is for references, note she will contact her referees and provide details once confirmed -- do NOT promise "I will send these by [date]" since referees may need notice

Tone: Responsive, organised, professional. UK business English.
```

### 11.3 Draft Creation via Gmail API

```javascript
async function createGmailDraft(gmailApi, originalMessage, draftBody, candidateSignature) {
  // Build the reply email
  const replyHeaders = {
    'In-Reply-To': originalMessage.headers['Message-ID'],
    'References': originalMessage.headers['References']
      ? `${originalMessage.headers['References']} ${originalMessage.headers['Message-ID']}`
      : originalMessage.headers['Message-ID'],
    'To': originalMessage.from_email,
    'Subject': originalMessage.subject.startsWith('Re:')
      ? originalMessage.subject
      : `Re: ${originalMessage.subject}`,
    'From': 'chellamma.uk@gmail.com'
  };

  const fullBody = `${draftBody}\n\n${candidateSignature}`;

  // Create MIME message
  const mimeMessage = buildMimeMessage(replyHeaders, fullBody);

  // Create draft via Gmail API
  const draft = await gmailApi.createDraft({
    message: {
      raw: base64UrlEncode(mimeMessage),
      threadId: originalMessage.gmail_thread_id
    }
  });

  return {
    draftId: draft.id,
    threadId: originalMessage.gmail_thread_id,
    createdAt: new Date().toISOString()
  };
}
```

**n8n Gmail Node Configuration (Draft Creation):**
```
Node: Gmail
Operation: Create Draft
Subject: Re: {{ $json.originalSubject }}
To: {{ $json.replyToEmail }}
Message: {{ $json.draftBody }}
Thread ID: {{ $json.threadId }}
```

### 11.4 Draft Quality Controls

To prevent sending embarrassing or incorrect drafts, the system applies quality checks:

```javascript
function validateDraft(draftBody, context) {
  const issues = [];

  // Check for placeholder text (template and phone number placeholders)
  if (draftBody.includes('{{') || draftBody.includes('}}')) {
    issues.push('Draft contains unresolved template placeholders');
  }
  // Check for phone number placeholder patterns (Claude sometimes outputs these)
  if (/\bXXXX\s*XXXXXX\b/.test(draftBody) || /\b0\d{3,4}\s*XXX\s*XXX\b/.test(draftBody)) {
    issues.push('Draft contains phone number placeholder (XXXX XXXXXX) -- replace with actual number or remove');
  }
  // Check for [PLACEHOLDER] style markers
  if (/\[(?:NAME|PHONE|EMAIL|DATE|TIME|ADDRESS|COMPANY|ROLE)\]/i.test(draftBody)) {
    issues.push('Draft contains bracket placeholder -- AI failed to populate a field');
  }

  // Check for AI-typical phrases
  const aiPhrases = [
    'I am thrilled', 'I am excited to', 'I would be delighted',
    'as per your request', 'I hope this email finds you well',
    'leverage my expertise', 'synergize', 'bring to the table',
    'circle back', 'touch base', 'move the needle',
    'absolutely', 'certainly', 'I appreciate the opportunity'
  ];
  for (const phrase of aiPhrases) {
    if (draftBody.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Draft contains AI-typical phrase: "${phrase}"`);
    }
  }

  // Check length (too short or too long)
  const wordCount = draftBody.split(/\s+/).length;
  if (wordCount < 20) issues.push('Draft is too short (< 20 words)');
  if (wordCount > 300) issues.push('Draft is too long (> 300 words)');

  // Check that company/role names match context
  if (context.company_name && !draftBody.includes(context.company_name) &&
      !draftBody.toLowerCase().includes(context.company_name.toLowerCase())) {
    // Not necessarily an error -- some drafts reference the role without naming the company
    // But worth flagging
    issues.push('Draft does not mention the company name');
  }

  // Check for duplicate sentence starts
  const sentences = draftBody.split(/[.!?]\s+/);
  const starts = sentences.map(s => s.split(' ').slice(0, 2).join(' ').toLowerCase());
  const duplicateStarts = starts.filter((s, i) => starts.indexOf(s) !== i);
  if (duplicateStarts.length > 0) {
    issues.push('Draft has sentences starting with the same words');
  }

  return {
    valid: issues.length === 0,
    issues: issues,
    wordCount: wordCount
  };
}
```

### 11.5 Candidate Signature Configuration

The candidate's email signature is stored in `system_config` and appended to all drafts:

```sql
INSERT INTO system_config (key, value, description) VALUES (
  'candidate_email_signature',
  '{
    "text": "Best regards,\n\nSelvi Chellamma\nPhD, MBA\nchellamma.uk@gmail.com\n+44 XXXX XXXXXX",
    "html": "<p>Best regards,</p><p><strong>Selvi Chellamma</strong><br>PhD, MBA<br><a href=\"mailto:chellamma.uk@gmail.com\">chellamma.uk@gmail.com</a><br>+44 XXXX XXXXXX</p>"
  }',
  'Candidate email signature for auto-drafted responses'
);
```

---

## 12. Urgent Notification System

### 12.1 Urgency Classification

| Email Category | Urgency Level | Notification Timing | Channel |
|----------------|--------------|---------------------|---------|
| Interview Invitation | CRITICAL | Immediate (within 3 min of detection) | Resend email with [URGENT: Interview] prefix |
| Offer | CRITICAL | Immediate (within 3 min of detection) | Resend email with [OFFER] prefix |
| Follow-Up Request | HIGH | Immediate (within 5 min of detection) | Resend email with [Action Required] prefix |
| Delivery Failure | HIGH | Immediate (within 5 min) | Resend email with [DELIVERY FAILED] prefix |
| Recruiter (A-tier role) | MEDIUM | Within 15 min of detection | Resend email, normal subject |
| Recruiter (B-tier role) | LOW | Daily summary only | N/A |
| Acknowledgment | NONE | Daily summary only | N/A |
| Rejection | NONE | Daily summary only | N/A |
| Job Alert | NONE | Daily summary only | N/A |
| Marketing | NONE | Not included in summary | N/A |

### 12.2 Notification Email Format (Urgent)

```
FROM: selvi-system@apiloom.io (via Resend)
TO: chellamma.uk@gmail.com
SUBJECT: [URGENT: Interview] Acme Corp - Senior L&D Manager - 2 April 10:30 AM

================================================================
INTERVIEW INVITATION DETECTED
================================================================

Company:    Acme Corp
Role:       Senior L&D Manager
Date:       Wednesday, 2 April 2026
Time:       10:30 AM (BST)
Format:     Microsoft Teams (video)
Duration:   45 minutes
Interviewer: Sarah Johnson, Head of People

WHAT TO DO:
1. A draft reply confirming attendance has been created in your Gmail Drafts folder
2. Review the draft and send it
3. Add the interview to your calendar (Module 6 will do this automatically)

ORIGINAL EMAIL:
From: hr@acmecorp.co.uk
Subject: Interview Invitation - Senior L&D Manager
Received: 28 March 2026, 14:30

---
[First 500 characters of the original email body]
---

View original email: https://mail.google.com/mail/u/0/#inbox/{{ gmail_message_id }}

================================================================
This notification was sent by the Selvi Job App Email Management System.
To adjust notification settings, update the system_config table.
```

### 12.3 Notification Email Format (Offer)

```
FROM: selvi-system@apiloom.io (via Resend)
TO: chellamma.uk@gmail.com
SUBJECT: [OFFER] Acme Corp - Senior L&D Manager

================================================================
JOB OFFER RECEIVED
================================================================

Company:        Acme Corp
Role:           Senior L&D Manager
Salary Offered: GBP 78,000 per annum
Start Date:     1 May 2026
Response By:    5 April 2026
Conditions:     Subject to satisfactory references

BENEFITS MENTIONED:
- 25 days holiday + bank holidays
- 6% employer pension contribution
- Private medical insurance
- Hybrid working (3 days office, 2 remote)

WHAT TO DO:
1. Read the full offer email carefully
2. No auto-draft has been created (this requires a personal response)
3. Consider taking 24-48 hours to review before responding

ORIGINAL EMAIL:
From: hr@acmecorp.co.uk
Subject: Offer of Employment - Senior L&D Manager
Received: 28 March 2026, 16:00

View original email: https://mail.google.com/mail/u/0/#inbox/{{ gmail_message_id }}

================================================================
```

### 12.4 Notification Throttling

To prevent notification fatigue, the system enforces throttling rules:

```javascript
const NOTIFICATION_THROTTLE = {
  // Maximum notifications per hour (across all categories)
  maxPerHour: 10,

  // Maximum notifications per day
  maxPerDay: 30,

  // Minimum gap between notifications (seconds)
  minGapSeconds: 60,

  // Categories exempt from throttling (always notify immediately)
  exemptCategories: ['interview_invite', 'offer'],

  // Quiet hours (no non-critical notifications)
  quietHours: {
    start: '22:00',  // 10 PM
    end: '07:00',    // 7 AM
    timezone: 'Europe/London',
    // During quiet hours, only CRITICAL notifications are sent
    allowedDuringQuiet: ['interview_invite', 'offer']
  }
};
```

### 12.5 Resend Integration

**Resend API Configuration:**

```javascript
const RESEND_CONFIG = {
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: 'selvi-system@apiloom.io',
  fromName: 'Selvi Job App',
  toEmail: 'chellamma.uk@gmail.com',
  replyTo: null, // System notifications should not be replied to
  headers: {
    'X-Entity-Ref-ID': '{{ notification_id }}' // Prevent Gmail threading of notifications
  }
};
```

**n8n Resend Node Configuration:**
```
Node: HTTP Request
Method: POST
URL: https://api.resend.com/emails
Headers:
  Authorization: Bearer {{ $env.RESEND_API_KEY }}
  Content-Type: application/json
Body:
{
  "from": "Selvi Job App <selvi-system@apiloom.io>",
  "to": ["chellamma.uk@gmail.com"],
  "subject": "{{ $json.notificationSubject }}",
  "text": "{{ $json.notificationBody }}",
  "headers": {
    "X-Entity-Ref-ID": "{{ $json.notificationId }}"
  }
}
```

### 12.6 Notification Deduplication

The system prevents sending duplicate notifications at two levels:

**Level 1: Per-email deduplication (existing):**
```sql
-- Check before sending notification
SELECT COUNT(*) FROM email_notifications
WHERE email_id = {{ email_id }}
    AND notification_type = {{ notification_type }}
    AND created_at > NOW() - INTERVAL '1 hour';
-- Only send if count = 0
```

**Level 2: Interview-level deduplication (v3 addition):**

When an interview confirmation is followed by a calendar invite or reminder for the same interview, only one notification should be sent. Deduplication is based on (company + role + interview date):

```sql
-- Check for existing interview notification for same company/role/date
SELECT COUNT(*) FROM email_notifications en
JOIN email_extracted_data eed ON en.email_id = eed.email_id
WHERE eed.company_name = {{ company_name }}
    AND eed.role_title = {{ role_title }}
    AND eed.interview_date = {{ interview_date }}
    AND en.notification_type = 'interview_invite'
    AND en.created_at > NOW() - INTERVAL '7 days';
-- Only send if count = 0
-- If a duplicate is detected, log "Suppressed duplicate interview notification for [company] [date]"
-- but still process the email for extraction (calendar details may be more complete)
```

---

## 13. Database Schema

### 13.1 Table: emails

The primary table storing all ingested email metadata.

```sql
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Gmail identifiers
    gmail_message_id VARCHAR(100) NOT NULL UNIQUE,
    gmail_thread_id VARCHAR(100) NOT NULL,

    -- Email metadata
    subject VARCHAR(1000),
    from_email VARCHAR(500) NOT NULL,
    from_name VARCHAR(500),
    to_email VARCHAR(500) NOT NULL DEFAULT 'chellamma.uk@gmail.com',
    reply_to VARCHAR(500),
    date TIMESTAMPTZ NOT NULL,
    snippet VARCHAR(500),

    -- Email body (temporary storage -- purged after processing)
    body_plain TEXT,
    body_html TEXT,
    body_stripped TEXT,              -- HTML-stripped version for classification

    -- Attachment info
    has_attachments BOOLEAN DEFAULT false,
    attachment_types JSONB DEFAULT '[]'::jsonb,
    has_ics_attachment BOOLEAN DEFAULT false,
    ics_data JSONB,                 -- Parsed ICS content

    -- Threading
    is_reply BOOLEAN DEFAULT false,
    in_reply_to VARCHAR(500),       -- Message-ID of parent email
    references_header TEXT,         -- Full References header

    -- Gmail metadata
    gmail_labels JSONB DEFAULT '[]'::jsonb,  -- Labels at time of ingestion
    gmail_internal_date TIMESTAMPTZ,

    -- Processing status
    status VARCHAR(30) DEFAULT 'ingested'
        CHECK (status IN ('ingested', 'classified', 'extracted', 'labeled', 'draft_created', 'completed', 'skipped', 'error')),
    is_job_related BOOLEAN,         -- null until classified
    needs_review BOOLEAN DEFAULT false,

    -- Sender classification (fast-path)
    sender_pattern_match VARCHAR(50),  -- If sender was identified by pattern
    sender_pattern_confidence NUMERIC(4,3),

    -- Language detection
    detected_language VARCHAR(10),
    language_confidence NUMERIC(4,3),

    -- Notification tracking
    urgent_notification_sent BOOLEAN DEFAULT false,
    urgent_notification_sent_at TIMESTAMPTZ,

    -- GDPR: body content purge tracking
    body_purged BOOLEAN DEFAULT false,
    body_purged_at TIMESTAMPTZ,

    -- Audit
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classified_at TIMESTAMPTZ,
    extracted_at TIMESTAMPTZ,
    labeled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX idx_emails_gmail_thread_id ON emails(gmail_thread_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_from_email ON emails(from_email);
CREATE INDEX idx_emails_date ON emails(date DESC);
CREATE INDEX idx_emails_ingested ON emails(ingested_at DESC);
CREATE INDEX idx_emails_unclassified ON emails(status) WHERE status = 'ingested';
CREATE INDEX idx_emails_unextracted ON emails(status) WHERE status = 'classified';
CREATE INDEX idx_emails_unlabeled ON emails(status) WHERE status = 'extracted';
CREATE INDEX idx_emails_needs_review ON emails(needs_review) WHERE needs_review = true;
CREATE INDEX idx_emails_is_job_related ON emails(is_job_related);
CREATE INDEX idx_emails_urgent_unsent ON emails(urgent_notification_sent) WHERE urgent_notification_sent = false;

-- Updated_at trigger
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 13.2 Table: email_classifications

Stores the classification result for each email.

```sql
CREATE TABLE email_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- Classification result
    classification VARCHAR(50) NOT NULL
        CHECK (classification IN (
            'acknowledgment', 'rejection', 'interview_invite',
            'recruiter_outreach', 'job_alert', 'offer',
            'follow_up_request', 'marketing', 'not_job_related'
        )),
    sub_category VARCHAR(50),
    confidence NUMERIC(4,3) NOT NULL,
    rationale TEXT,

    -- Sender analysis
    is_urgent BOOLEAN DEFAULT false,
    is_automated BOOLEAN DEFAULT false,
    sender_type VARCHAR(30)
        CHECK (sender_type IN ('employer', 'recruiter', 'job_board', 'ats', 'personal_contact', 'unknown')),

    -- Classification method
    classification_method VARCHAR(30) NOT NULL
        CHECK (classification_method IN (
            'sender_pattern', 'subject_heuristic', 'claude_haiku',
            'claude_sonnet', 'manual_override'
        )),
    model_version VARCHAR(100),   -- e.g., 'claude-3.5-haiku-20260301'
    prompt_version VARCHAR(20),   -- Version of the classification prompt used

    -- Escalation tracking
    was_escalated BOOLEAN DEFAULT false,
    haiku_classification VARCHAR(50),     -- Original Haiku classification (if escalated)
    haiku_confidence NUMERIC(4,3),        -- Original Haiku confidence (if escalated)

    -- Manual review
    manually_reviewed BOOLEAN DEFAULT false,
    manual_classification VARCHAR(50),     -- Corrected classification (if reviewed)
    reviewed_at TIMESTAMPTZ,

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    classification_duration_ms INTEGER,

    CONSTRAINT unique_email_classification UNIQUE (email_id)
);

CREATE INDEX idx_email_classifications_email_id ON email_classifications(email_id);
CREATE INDEX idx_email_classifications_classification ON email_classifications(classification);
CREATE INDEX idx_email_classifications_classified_at ON email_classifications(classified_at DESC);
CREATE INDEX idx_email_classifications_confidence ON email_classifications(confidence) WHERE confidence < 0.8;
CREATE INDEX idx_email_classifications_needs_review ON email_classifications(manually_reviewed) WHERE manually_reviewed = false AND confidence < 0.6;
```

### 13.3 Table: email_extracted_data

Stores structured data extracted from each classified email.

```sql
CREATE TABLE email_extracted_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    classification VARCHAR(50) NOT NULL,

    -- Common fields (applicable across categories)
    company_name VARCHAR(500),
    role_title VARCHAR(500),
    contact_person VARCHAR(500),
    contact_email VARCHAR(500),
    contact_phone VARCHAR(50),
    next_steps TEXT,
    response_deadline TIMESTAMPTZ,

    -- Interview-specific fields
    interview_date DATE,
    interview_time TIME,
    interview_timezone VARCHAR(30),
    interview_duration VARCHAR(50),
    interview_format VARCHAR(30)
        CHECK (interview_format IN ('phone', 'video', 'in_person', 'assessment', 'panel', 'informal', NULL)),
    interview_platform VARCHAR(100),
    interview_location TEXT,
    interview_link TEXT,
    interviewer_name VARCHAR(500),
    interviewer_title VARCHAR(500),
    interviewer_email VARCHAR(500),
    panel_members JSONB DEFAULT '[]'::jsonb,
    preparation_instructions TEXT,
    what_to_bring TEXT,
    dress_code VARCHAR(100),
    parking_instructions TEXT,
    alternative_times JSONB DEFAULT '[]'::jsonb,

    -- Rejection-specific fields
    rejection_reason TEXT,
    rejection_stage VARCHAR(30)
        CHECK (rejection_stage IN ('application', 'shortlisting', 'interview', 'final_round', NULL)),
    feedback_offered BOOLEAN DEFAULT false,
    feedback_contact VARCHAR(500),
    future_roles_suggested BOOLEAN DEFAULT false,
    keep_on_file BOOLEAN DEFAULT false,

    -- Acknowledgment-specific fields
    reference_number VARCHAR(100),
    review_timeline TEXT,
    expected_response_date DATE,
    application_portal_link TEXT,

    -- Recruiter-specific fields
    recruiter_name VARCHAR(500),
    recruiter_email VARCHAR(500),
    recruiter_phone VARCHAR(50),
    agency_name VARCHAR(500),
    proposed_role_title VARCHAR(500),
    proposed_company VARCHAR(500),
    proposed_salary_raw VARCHAR(200),
    proposed_salary_min INTEGER,
    proposed_salary_max INTEGER,
    proposed_location VARCHAR(500),
    proposed_working_pattern VARCHAR(30),
    proposed_contract_type VARCHAR(30),
    role_description_summary TEXT,
    recruiter_linkedin VARCHAR(500),
    is_exclusive_role BOOLEAN DEFAULT false,

    -- Offer-specific fields
    salary_offered INTEGER,
    salary_details TEXT,
    start_date DATE,
    offer_conditions JSONB DEFAULT '[]'::jsonb,
    benefits_mentioned JSONB DEFAULT '[]'::jsonb,
    probation_period VARCHAR(100),
    notice_period VARCHAR(100),
    reporting_to VARCHAR(500),
    offer_letter_attached BOOLEAN DEFAULT false,

    -- Follow-up-specific fields
    action_required TEXT,
    action_deadline TIMESTAMPTZ,
    documents_requested JSONB DEFAULT '[]'::jsonb,
    portal_link TEXT,

    -- Job alert-specific fields
    source_platform VARCHAR(50),
    jobs_listed JSONB DEFAULT '[]'::jsonb,
    total_jobs_count INTEGER,
    alert_frequency VARCHAR(30),

    -- Extraction quality
    extraction_confidence NUMERIC(4,3),
    fields_not_found JSONB DEFAULT '[]'::jsonb,
    extraction_notes TEXT,

    -- Module integration tracking
    module4_updated BOOLEAN DEFAULT false,
    module4_application_id UUID,
    module4_status_set VARCHAR(50),
    module6_notified BOOLEAN DEFAULT false,
    module1_jobs_created INTEGER DEFAULT 0,

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extraction_duration_ms INTEGER,

    CONSTRAINT unique_email_extraction UNIQUE (email_id)
);

CREATE INDEX idx_email_extracted_data_email_id ON email_extracted_data(email_id);
CREATE INDEX idx_email_extracted_data_classification ON email_extracted_data(classification);
CREATE INDEX idx_email_extracted_data_company ON email_extracted_data(company_name);
CREATE INDEX idx_email_extracted_data_interview_date ON email_extracted_data(interview_date) WHERE interview_date IS NOT NULL;
CREATE INDEX idx_email_extracted_data_module4 ON email_extracted_data(module4_updated) WHERE module4_updated = false AND classification IN ('acknowledgment', 'rejection', 'interview_invite', 'offer');
```

### 13.4 Table: email_threads

Tracks email conversation threads.

```sql
CREATE TABLE email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gmail_thread_id VARCHAR(100) NOT NULL UNIQUE,

    -- Thread metadata
    subject VARCHAR(1000),
    participant_emails JSONB DEFAULT '[]'::jsonb,
    message_count INTEGER DEFAULT 1,

    -- Latest activity
    last_received_at TIMESTAMPTZ,        -- Last email received from others
    last_sent_at TIMESTAMPTZ,            -- Last email sent by candidate
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Thread classification (based on most significant email in thread)
    primary_classification VARCHAR(50),
    company_name VARCHAR(500),
    role_title VARCHAR(500),

    -- Relationship tracking
    recruiter_contact_id UUID REFERENCES recruiter_contacts(id),
    application_id UUID,                  -- Module 4 application ID

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'dormant', 'closed', 'resolved')),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_threads_gmail_thread ON email_threads(gmail_thread_id);
CREATE INDEX idx_email_threads_status ON email_threads(status);
CREATE INDEX idx_email_threads_last_activity ON email_threads(last_activity_at DESC);
CREATE INDEX idx_email_threads_recruiter ON email_threads(recruiter_contact_id) WHERE recruiter_contact_id IS NOT NULL;
CREATE INDEX idx_email_threads_dormant ON email_threads(status) WHERE status = 'dormant';

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 13.5 Table: recruiter_contacts

Stores recruiter relationship information.

```sql
CREATE TABLE recruiter_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Recruiter identity
    recruiter_name VARCHAR(500) NOT NULL,
    recruiter_email VARCHAR(500) NOT NULL,
    recruiter_phone VARCHAR(50),
    agency_name VARCHAR(500),
    linkedin_url VARCHAR(500),

    -- Contact history
    first_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_contacts INTEGER DEFAULT 1,
    total_roles_proposed INTEGER DEFAULT 0,

    -- Quality metrics
    quality_score INTEGER DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
    average_role_relevance NUMERIC(5,2),
    exclusive_role_count INTEGER DEFAULT 0,
    personalization_score NUMERIC(4,3) DEFAULT 0.5,  -- How personalized their outreach is

    -- Response tracking
    our_response_count INTEGER DEFAULT 0,
    their_follow_up_count INTEGER DEFAULT 0,
    responded_to_our_reply BOOLEAN DEFAULT false,
    ghosted_after_our_reply BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'blacklisted', 'dormant', 'high_value')),
    blacklisted_reason TEXT,

    -- Duplicate detection
    canonical_recruiter_id UUID REFERENCES recruiter_contacts(id),  -- Points to primary record if duplicate

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recruiter_contacts_email ON recruiter_contacts(recruiter_email);
CREATE INDEX idx_recruiter_contacts_agency ON recruiter_contacts(agency_name);
CREATE INDEX idx_recruiter_contacts_status ON recruiter_contacts(status);
CREATE INDEX idx_recruiter_contacts_quality ON recruiter_contacts(quality_score DESC);
CREATE INDEX idx_recruiter_contacts_last_contact ON recruiter_contacts(last_contact_at DESC);

CREATE TRIGGER update_recruiter_contacts_updated_at BEFORE UPDATE ON recruiter_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 13.6 Table: recruiter_role_proposals

Tracks individual role proposals from recruiters.

```sql
CREATE TABLE recruiter_role_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_contact_id UUID NOT NULL REFERENCES recruiter_contacts(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id),

    -- Role details
    role_title VARCHAR(500),
    company_name VARCHAR(500),
    salary_raw VARCHAR(200),
    salary_min INTEGER,
    salary_max INTEGER,
    location VARCHAR(500),
    working_pattern VARCHAR(30),
    contract_type VARCHAR(30),
    role_description TEXT,

    -- Relevance assessment
    relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
    relevance_tier CHAR(1) CHECK (relevance_tier IN ('A', 'B', 'C', 'D')),
    relevance_rationale TEXT,
    is_exclusive BOOLEAN DEFAULT false,

    -- Outcome tracking
    candidate_interested BOOLEAN,
    candidate_applied BOOLEAN DEFAULT false,
    outcome VARCHAR(30) CHECK (outcome IN ('pending', 'applied', 'interviewed', 'offered', 'rejected', 'withdrawn', 'expired')),

    -- Audit
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recruiter_roles_recruiter ON recruiter_role_proposals(recruiter_contact_id);
CREATE INDEX idx_recruiter_roles_relevance ON recruiter_role_proposals(relevance_tier);
CREATE INDEX idx_recruiter_roles_proposed ON recruiter_role_proposals(proposed_at DESC);
```

### 13.7 Table: email_notifications

Tracks all notifications sent by the system.

```sql
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID REFERENCES emails(id),

    -- Notification details
    notification_type VARCHAR(30) NOT NULL
        CHECK (notification_type IN (
            'interview_alert', 'offer_alert', 'follow_up_alert',
            'delivery_failure_alert', 'recruiter_alert',
            'daily_summary', 'system_error'
        )),
    channel VARCHAR(20) NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'webhook')),
    recipient VARCHAR(500) NOT NULL DEFAULT 'chellamma.uk@gmail.com',

    -- Content
    subject VARCHAR(500),
    body TEXT,

    -- Delivery
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    resend_message_id VARCHAR(200),  -- Resend API message ID
    error_message TEXT,
    sent_at TIMESTAMPTZ,

    -- Throttling
    throttled BOOLEAN DEFAULT false,
    throttle_reason VARCHAR(200),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_notifications_email ON email_notifications(email_id);
CREATE INDEX idx_email_notifications_type ON email_notifications(notification_type);
CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_sent ON email_notifications(sent_at DESC);
```

### 13.8 Table: email_sender_patterns

Configurable sender pattern matching rules for fast-path classification.

```sql
CREATE TABLE email_sender_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Pattern definition
    pattern VARCHAR(500) NOT NULL,        -- Email address or *@domain pattern
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'exact'
        CHECK (pattern_type IN ('exact', 'domain', 'regex')),

    -- Classification
    classification VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0,

    -- Metadata
    source_name VARCHAR(100),             -- Human-readable source name (e.g., "LinkedIn Job Alerts")
    notes TEXT,

    -- Status
    enabled BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sender_patterns_pattern ON email_sender_patterns(pattern) WHERE enabled = true;
CREATE INDEX idx_sender_patterns_classification ON email_sender_patterns(classification);

-- Seed data: known job-related senders
INSERT INTO email_sender_patterns (pattern, pattern_type, classification, sub_category, source_name) VALUES
    -- LinkedIn
    ('noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Alerts'),
    ('jobs-noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Job Alerts'),
    ('jobalerts-noreply@linkedin.com', 'exact', 'job_alert', 'linkedin', 'LinkedIn Job Alerts'),
    ('invitations@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn InMail'),
    ('notifications-noreply@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn Notifications'),
    ('messaging-digest-noreply@linkedin.com', 'exact', 'recruiter_outreach', NULL, 'LinkedIn Messages'),

    -- Indeed
    ('noreply@indeed.com', 'exact', 'job_alert', 'indeed', 'Indeed Alerts'),
    ('alert@indeed.co.uk', 'exact', 'job_alert', 'indeed', 'Indeed UK Alerts'),
    ('noreply@indeedemail.com', 'exact', 'job_alert', 'indeed', 'Indeed Email Alerts'),

    -- TotalJobs
    ('jobalert@totaljobs.com', 'exact', 'job_alert', 'totaljobs', 'TotalJobs Alerts'),
    ('noreply@totaljobs.com', 'exact', 'job_alert', 'totaljobs', 'TotalJobs'),

    -- Reed
    ('alerts@reed.co.uk', 'exact', 'job_alert', 'reed', 'Reed Alerts'),
    ('noreply@reed.co.uk', 'exact', 'job_alert', 'reed', 'Reed'),

    -- CV-Library
    ('alerts@cv-library.co.uk', 'exact', 'job_alert', 'cv_library', 'CV-Library Alerts'),

    -- Guardian
    ('jobs@theguardian.com', 'exact', 'job_alert', 'guardian', 'Guardian Jobs'),

    -- jobs.ac.uk
    ('alerts@jobs.ac.uk', 'exact', 'job_alert', 'jobs_ac_uk', 'jobs.ac.uk Alerts'),
    ('noreply@jobs.ac.uk', 'exact', 'job_alert', 'jobs_ac_uk', 'jobs.ac.uk'),

    -- ATS platforms (these need content-based classification, so we mark as 'ats_communication')
    ('*@myworkdayjobs.com', 'domain', 'ats_communication', NULL, 'Workday'),
    ('*@myworkday.com', 'domain', 'ats_communication', NULL, 'Workday'),
    ('*@greenhouse.io', 'domain', 'ats_communication', NULL, 'Greenhouse'),
    ('*@lever.co', 'domain', 'ats_communication', NULL, 'Lever'),
    ('*@icims.com', 'domain', 'ats_communication', NULL, 'iCIMS'),
    ('*@taleo.net', 'domain', 'ats_communication', NULL, 'Taleo'),
    ('*@smartrecruiters.com', 'domain', 'ats_communication', NULL, 'SmartRecruiters'),
    ('*@breezy.hr', 'domain', 'ats_communication', NULL, 'Breezy HR'),
    ('*@applytojob.com', 'domain', 'ats_communication', NULL, 'ApplyToJob'),
    ('*@hirebridge.com', 'domain', 'ats_communication', NULL, 'Hirebridge'),

    -- Bounce/delivery failure
    ('MAILER-DAEMON@*', 'domain', 'delivery_failure', NULL, 'Mail Delivery System'),
    ('postmaster@*', 'domain', 'delivery_failure', NULL, 'Postmaster'),

    -- Marketing (generic job board marketing)
    ('marketing@linkedin.com', 'exact', 'marketing', 'newsletter', 'LinkedIn Marketing'),
    ('marketing@indeed.com', 'exact', 'marketing', 'newsletter', 'Indeed Marketing'),
    ('promotions@totaljobs.com', 'exact', 'marketing', 'promotion', 'TotalJobs Promotions'),
    ('newsletter@reed.co.uk', 'exact', 'marketing', 'newsletter', 'Reed Newsletter'),

    -- System self-exclusion (CRITICAL: prevents recursive processing of own notifications)
    ('selvi-system@apiloom.io', 'exact', 'system_notification', NULL, 'Selvi System Notifications -- SKIP');
```

### 13.9 Table: email_processing_log

Detailed processing log for debugging and auditing.

```sql
CREATE TABLE email_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID REFERENCES emails(id),

    -- Processing details
    workflow_name VARCHAR(100) NOT NULL,
    step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    duration_ms INTEGER,
    error_message TEXT,

    -- Context
    details JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_processing_log_email ON email_processing_log(email_id);
CREATE INDEX idx_email_processing_log_workflow ON email_processing_log(workflow_name, created_at DESC);
CREATE INDEX idx_email_processing_log_status ON email_processing_log(status) WHERE status = 'failed';
CREATE INDEX idx_email_processing_log_recent ON email_processing_log(created_at DESC);

-- Partition by month for performance (high-volume table)
-- Note: partitioning requires PG 12+ and is configured at table creation
-- For simplicity in v1.0, we use a single table with periodic cleanup
```

### 13.10 Table: email_drafts

Tracks auto-generated response drafts.

```sql
CREATE TABLE email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- Gmail draft
    gmail_draft_id VARCHAR(100),
    gmail_thread_id VARCHAR(100),

    -- Draft content
    draft_subject VARCHAR(500),
    draft_body TEXT NOT NULL,
    draft_type VARCHAR(30) NOT NULL
        CHECK (draft_type IN (
            'interview_confirmation', 'acknowledgment_reply',
            'recruiter_response_interested', 'recruiter_response_decline',
            'follow_up_response', 'custom'
        )),

    -- Quality
    draft_word_count INTEGER,
    validation_passed BOOLEAN DEFAULT true,
    validation_issues JSONB DEFAULT '[]'::jsonb,

    -- Status
    status VARCHAR(20) DEFAULT 'created'
        CHECK (status IN ('created', 'in_gmail', 'sent_by_candidate', 'discarded', 'failed')),

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_email_drafts_email ON email_drafts(email_id);
CREATE INDEX idx_email_drafts_status ON email_drafts(status);
CREATE INDEX idx_email_drafts_type ON email_drafts(draft_type);
```

### 13.11 Table: email_classification_calibration

Reference emails for classification quality testing.

```sql
CREATE TABLE email_classification_calibration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Test case
    email_subject VARCHAR(500) NOT NULL,
    email_from VARCHAR(500),
    email_body TEXT NOT NULL,
    email_headers JSONB DEFAULT '{}'::jsonb,

    -- Expected results
    expected_classification VARCHAR(50) NOT NULL,
    expected_sub_category VARCHAR(50),
    expected_is_urgent BOOLEAN,

    -- Actual results (from last calibration run)
    last_actual_classification VARCHAR(50),
    last_actual_confidence NUMERIC(4,3),
    last_actual_sub_category VARCHAR(50),
    match BOOLEAN,                        -- Did actual match expected?
    drift_detected BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_tested_at TIMESTAMPTZ
);
```

### 13.12 GDPR Data Purge Function

```sql
-- Purge email body content after processing (GDPR compliance)
-- Retains metadata and extracted structured data, removes raw email text

CREATE OR REPLACE FUNCTION purge_email_bodies(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    -- Also purge body-derived text stored in email_extracted_data
    UPDATE email_extracted_data
    SET
        role_description_summary = NULL,
        preparation_instructions = NULL,
        rejection_feedback = NULL
    WHERE email_id IN (
        SELECT id FROM emails
        WHERE status IN ('completed', 'classified', 'extracted', 'labeled', 'drafted', 'notified', 'skipped')
          AND body_purged = false
          AND created_at < NOW() - (retention_days || ' days')::INTERVAL
    );

    UPDATE emails
    SET
        body_plain = NULL,
        body_html = NULL,
        body_stripped = NULL,
        body_purged = true,
        body_purged_at = NOW()
    WHERE
        status IN ('completed', 'classified', 'extracted', 'labeled', 'drafted', 'notified', 'skipped')
        -- NOTE: The purge covers ALL terminal processing states, not just 'completed'.
        -- v2 had a gap: emails reached 'classified' or 'extracted' but never 'completed',
        -- so the purge never fired. Now all post-classification states are eligible.
        AND body_purged = false
        AND created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule via n8n or pg_cron:
-- SELECT purge_email_bodies(7); -- Run daily, purge bodies older than 7 days
```

### 13.13 Database Migration

```sql
-- Migration 005: Email Management & Intelligence System tables
-- Applied: 2026-03-29

BEGIN;

-- All CREATE TABLE statements from sections 13.1 through 13.11 above

-- Add Module 5 config entries to system_config
INSERT INTO system_config (key, value, description) VALUES
    ('email_polling_enabled', 'true', 'Enable/disable email polling'),
    ('email_classification_enabled', 'true', 'Enable/disable AI classification'),
    ('email_drafting_enabled', 'true', 'Enable/disable auto-draft creation'),
    ('email_notifications_enabled', 'true', 'Enable/disable urgent notifications'),
    ('email_body_retention_days', '7', 'Number of days to retain email body text before GDPR purge'),
    ('email_classification_model', '"claude-3.5-haiku"', 'Default model for email classification'),
    ('email_escalation_model', '"claude-3.5-sonnet"', 'Model for classification escalation'),
    ('email_haiku_confidence_threshold', '0.80', 'Confidence threshold below which Haiku escalates to Sonnet'),
    ('email_notification_quiet_start', '"22:00"', 'Start of quiet hours for non-critical notifications'),
    ('email_notification_quiet_end', '"07:00"', 'End of quiet hours'),
    ('email_draft_for_ack_tier', '"A"', 'Minimum tier for acknowledgment reply drafts (A, B, C, or off)'),
    ('email_last_history_id', '"0"', 'Gmail History API ID of last successful poll (0 triggers initial reconciliation)'),
    ('email_last_sent_poll_timestamp', '"2026-03-29T00:00:00Z"', 'Timestamp of last successful Sent folder poll'),
    ('email_daily_summary_time', '"08:00"', 'Time to send daily email summary (UK time)'),
    ('candidate_email', '"chellamma.uk@gmail.com"', 'Candidate Gmail address'),
    ('candidate_name', '"Selvi Chellamma"', 'Candidate display name');

INSERT INTO schema_migrations (version, name) VALUES (5, '005_email_management_intelligence');

COMMIT;
```

---

## 14. n8n Workflow Specifications

### 14.1 WF-EM-01: Gmail Poller & Ingestion

**Purpose:** Poll Gmail inbox for new messages and ingest them into the emails table for processing.

**Trigger:** Cron
```
Business hours: */5 6-22 * * * (Europe/London)
Off-hours: */15 23,0-5 * * * (Europe/London)
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Get Last History ID]
    SELECT value FROM system_config WHERE key = 'email_last_history_id'
    |
[Postgres: Acquire Workflow Lock]
    INSERT INTO workflow_locks (workflow_name, locked_by, expires_at)
    VALUES ('WF-EM-01', '{{ $executionId }}', NOW() + INTERVAL '10 minutes')
    ON CONFLICT (workflow_name)
    DO UPDATE SET locked_at = NOW(), locked_by = '{{ $executionId }}', expires_at = NOW() + INTERVAL '10 minutes'
    WHERE workflow_locks.expires_at < NOW()
    |
[IF: Lock Acquired?]
    |
    |-- Yes:
    |   [HTTP Request: Gmail History API]
    |       GET /gmail/v1/users/me/history?startHistoryId={{ lastHistoryId }}&historyTypes=messageAdded&labelId=INBOX
    |       (Falls back to reconciliation query if historyId expired)
    |       |
    |   [IF: Messages Found?]
    |       |
    |       |-- Yes:
    |       |   [SplitInBatches: Process Each Message]
    |       |       Batch Size: 5
    |       |       |
    |       |   [Gmail: Get Message Details]
    |       |       Message ID: {{ $json.id }}
    |       |       Format: full
    |       |       |
    |       |   [Code: Parse Email Message]
    |       |       -- Extract headers, body parts, attachment info
    |       |       -- Call SW-EM-01 for preprocessing
    |       |       |
    |       |   [Sub-Workflow: SW-EM-01 Email Preprocessing]
    |       |       -- Strip HTML
    |       |       -- Detect language
    |       |       -- Classify sender (fast-path)
    |       |       |
    |       |   [IF: Is English?]
    |       |       |
    |       |       |-- Yes:
    |       |       |   [Postgres: Insert Email]
    |       |       |       INSERT INTO emails (
    |       |       |           gmail_message_id, gmail_thread_id, subject,
    |       |       |           from_email, from_name, to_email, reply_to, date,
    |       |       |           body_plain, body_html, body_stripped, snippet,
    |       |       |           has_attachments, attachment_types, has_ics_attachment,
    |       |       |           ics_data, is_reply, in_reply_to, references_header,
    |       |       |           gmail_labels, gmail_internal_date,
    |       |       |           sender_pattern_match, sender_pattern_confidence,
    |       |       |           detected_language, language_confidence,
    |       |       |           status
    |       |       |       ) VALUES (...)
    |       |       |       ON CONFLICT (gmail_message_id) DO NOTHING
    |       |       |       |
    |       |       |   [Postgres: Upsert Email Thread]
    |       |       |       INSERT INTO email_threads (gmail_thread_id, subject, ...)
    |       |       |       ON CONFLICT (gmail_thread_id) DO UPDATE
    |       |       |           SET message_count = message_count + 1,
    |       |       |               last_received_at = NOW(),
    |       |       |               last_activity_at = NOW()
    |       |       |       |
    |       |       |   [Postgres: Log Processing Step]
    |       |       |       INSERT INTO email_processing_log
    |       |       |           (email_id, workflow_name, step, status, details)
    |       |       |       VALUES (..., 'WF-EM-01', 'ingestion', 'completed', ...)
    |       |       |
    |       |       |-- No (not English):
    |       |           [Postgres: Insert Email (status: 'skipped')]
    |       |           [Postgres: Log Processing Step (status: 'skipped', details: language)]
    |       |
    |       |-- No (no messages):
    |           [No Op: No new messages]
    |
    |   [Postgres: Update Last History ID]
    |       UPDATE system_config SET value = '"{{ response.historyId }}"'
    |       WHERE key = 'email_last_history_id'
    |       |
    |   [Postgres: Release Workflow Lock]
    |       DELETE FROM workflow_locks WHERE workflow_name = 'WF-EM-01'
    |
    |-- No (lock not acquired):
        [Postgres: Log Skipped Execution]
            -- Another instance is running, skip this cycle
```

**Error Handling:**
```
[On Error (any node)]
    |
[Postgres: Log Error]
    INSERT INTO workflow_errors (workflow_name, node_name, error_message, execution_id)
    VALUES ('WF-EM-01', ...)
    |
[IF: OAuth2 Token Error?]
    |-- Yes:
    |   [HTTP Request: Send Critical Alert via Resend]
    |       "Gmail OAuth2 token has expired or been revoked. Manual re-authentication required."
    |   [Postgres: Disable Email Polling]
    |       UPDATE system_config SET value = 'false' WHERE key = 'email_polling_enabled'
    |-- No:
        [Continue to next iteration] (retry on next cycle)
    |
[Postgres: Release Workflow Lock]
    DELETE FROM workflow_locks WHERE workflow_name = 'WF-EM-01'
```

### 14.2 WF-EM-02: AI Classification Engine

**Purpose:** Classify ingested emails using the tiered classification pipeline.

**Trigger:** Cron
```
*/5 * * * * (Europe/London) -- Every 5 minutes
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Acquire Workflow Lock]
    INSERT INTO workflow_locks (workflow_name, locked_by, expires_at)
    VALUES ('WF-EM-02', '{{ $executionId }}', NOW() + INTERVAL '10 minutes')
    ON CONFLICT (workflow_name)
    DO UPDATE SET locked_at = NOW(), locked_by = '{{ $executionId }}', expires_at = NOW() + INTERVAL '10 minutes'
    WHERE workflow_locks.expires_at < NOW()
    |
[IF: Lock Acquired?]
    |-- No: [Postgres: Log Skipped Execution] -- Another instance running
    |-- Yes:
    |
[Postgres: Get Unclassified Emails]
    SELECT e.*, sp.classification AS sender_class, sp.confidence AS sender_confidence
    FROM emails e
    LEFT JOIN email_sender_patterns sp ON (
        e.from_email = sp.pattern
        OR e.from_email LIKE REPLACE(sp.pattern, '*', '%')
    )
    WHERE e.status = 'ingested'
    ORDER BY
        -- Priority ordering: non-alert emails first (more likely to need action)
        -- Job alerts can wait; interview invites and rejections need faster processing
        CASE WHEN sp.classification = 'job_alert' THEN 1 ELSE 0 END ASC,
        e.date ASC
    LIMIT 20
    FOR UPDATE SKIP LOCKED
    |
[IF: Emails Found?]
    |
    |-- No: [No Op]
    |
    |-- Yes:
        [Code: Check Claude API Health]
            -- Before processing batch, verify Claude API is reachable
            -- If Claude API returns 5xx or timeout:
            --   1. Emails with high-confidence sender pattern (>= 0.9) are still classified
            --   2. Other emails are left as 'ingested' for the next cycle
            --   3. After 3 consecutive failures: send alert and enable "degraded mode"
            -- In degraded mode:
            --   - Sender pattern matching continues (no Claude needed)
            --   - Emails without sender patterns are held until Claude recovers
            --   - Daily summary includes "AI classification unavailable" warning
            --   - Urgent keyword scan (basic regex for "interview", "offer") generates
            --     lower-confidence notifications as a safety net
            |
        [SplitInBatches: Process Each Email]
            Batch Size: 5
            |
        [Switch: Classification Method]
            |
            |-- [Sender Pattern Match (confidence >= 0.9)]
            |   [Code: Apply Sender Classification]
            |       -- Use sender_pattern_match classification directly
            |       |
            |   [Postgres: Insert email_classifications]
            |       classification_method: 'sender_pattern'
            |       |
            |   [Postgres: Update email status = 'classified']
            |
            |-- [ATS Communication (needs content analysis)]
            |   [Continue to Claude Haiku classification below]
            |
            |-- [Unknown Sender / Low Confidence]
                |
                [Code: Apply Subject Line Heuristics]
                    -- Check subject for classification keywords
                    -- If confidence > 0.85, accept
                    |
                [IF: Subject Heuristic Confident?]
                    |
                    |-- Yes:
                    |   [Postgres: Insert email_classifications]
                    |       classification_method: 'subject_heuristic'
                    |   [Postgres: Update email status = 'classified']
                    |
                    |-- No:
                        [HTTP Request: Claude Haiku Classification]
                            POST https://api.anthropic.com/v1/messages
                            Headers:
                                x-api-key: {{ $env.ANTHROPIC_API_KEY }}
                                anthropic-version: 2023-06-01
                                content-type: application/json
                            Body: {
                                "model": "claude-3-5-haiku-20241022",
                                "max_tokens": 500,
                                "system": "{{ classificationSystemPrompt }}",
                                "messages": [{
                                    "role": "user",
                                    "content": "{{ classificationUserPrompt }}"
                                }]
                            }
                            |
                        [Code: Parse Claude Response]
                            -- Extract JSON from Claude response
                            -- Parse classification, confidence, etc.
                            |
                        [Code: Safety Escalation Check]
                            -- Force Sonnet escalation for high-stakes categories
                            -- using CONTEXTUAL PHRASES (not individual keywords) to
                            -- avoid over-escalation. Individual words like "salary" and
                            -- "compensation" appear in non-offer contexts (JD descriptions,
                            -- recruiter outreach) and would escalate ~50% of emails.
                            --
                            -- Escalation triggers:
                            -- 1. If Haiku classifies as 'offer' (any sub-category) -> always escalate for confirmation
                            -- 2. If email body contains CONTEXTUAL offer phrases:
                            --    - "we'd like to offer you"
                            --    - "offer of employment"
                            --    - "pleased to offer"
                            --    - "your offer letter"
                            --    - "start date of [date]" (combined with sender being known employer)
                            --    - "annual salary of" or "salary of GBP/£"
                            --    AND Haiku did NOT classify as 'offer'
                            -- 3. If email is from employer with active application at
                            --    'offer_received' or 'interviewing' stage
                            --    AND Haiku classified as 'acknowledgment' or 'follow_up_request'
                            --
                            -- NOT escalated (individual words that cause false positives):
                            -- "salary" alone, "compensation" alone, "package" alone,
                            -- "benefits" alone, "start date" alone
                            |
                        [IF: Haiku Confidence >= 0.80 AND no safety escalation triggered?]
                            |
                            |-- Yes:
                            |   [Postgres: Insert email_classifications]
                            |       classification_method: 'claude_haiku'
                            |   [Postgres: Update email status = 'classified']
                            |
                            |-- No (escalate to Sonnet -- low confidence OR safety escalation):
                                [Postgres: Get Thread Context]
                                    SELECT * FROM emails
                                    WHERE gmail_thread_id = {{ threadId }}
                                    ORDER BY date ASC
                                    |
                                [HTTP Request: Claude Sonnet Classification]
                                    POST https://api.anthropic.com/v1/messages
                                    Body: {
                                        "model": "claude-3-5-sonnet-20241022",
                                        "max_tokens": 800,
                                        "system": "{{ classificationSystemPrompt }}",
                                        "messages": [{
                                            "role": "user",
                                            "content": "{{ escalationPrompt }}"
                                        }]
                                    }
                                    |
                                [Code: Parse Sonnet Response]
                                    |
                                [Postgres: Insert email_classifications]
                                    classification_method: 'claude_sonnet'
                                    was_escalated: true
                                    haiku_classification: {{ haikuResult.classification }}
                                    haiku_confidence: {{ haikuResult.confidence }}
                                    needs_review: confidence < 0.60
                                    |
                                [Postgres: Update email status = 'classified']
        |
        [Postgres: Log Processing Stats]
            INSERT INTO email_processing_log
```

### 14.3 WF-EM-03: Data Extraction Pipeline

**Purpose:** Extract structured data from classified emails and dispatch to other modules.

**Trigger:** Cron
```
*/5 * * * * (Europe/London) -- Every 5 minutes
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Get Classified Emails Pending Extraction]
    SELECT e.*, ec.classification, ec.sub_category, ec.is_urgent, ec.sender_type
    FROM emails e
    JOIN email_classifications ec ON ec.email_id = e.id
    WHERE e.status = 'classified'
        AND ec.classification != 'not_job_related'
        AND ec.classification != 'marketing'
    ORDER BY
        CASE ec.classification
            WHEN 'interview_invite' THEN 1
            WHEN 'offer' THEN 2
            WHEN 'follow_up_request' THEN 3
            WHEN 'recruiter_outreach' THEN 4
            WHEN 'acknowledgment' THEN 5
            WHEN 'rejection' THEN 6
            WHEN 'job_alert' THEN 7
        END ASC
    LIMIT 10
    |
[IF: Emails Found?]
    |
    |-- No: [No Op]
    |
    |-- Yes:
        [SplitInBatches: Process Each Email]
            |
        [Switch: Classification Category]
            |
            |-- [interview_invite]:
            |   [HTTP Request: Claude Haiku Extraction]
            |       -- Interview-specific extraction prompt
            |       |
            |   [Code: Parse Extraction Response]
            |       -- Validate extracted fields
            |       -- Parse dates/times with UK timezone handling
            |       |
            |   [Postgres: BEGIN TRANSACTION]
            |       -- All three operations wrapped in a single transaction:
            |       -- 1. Insert email_extracted_data
            |       -- 2. Update Module 4 (via sub-workflow call or direct DB update)
            |       -- 3. Update email status = 'extracted'
            |       -- If any step fails, the entire transaction rolls back,
            |       -- preventing stuck emails and constraint violations on re-processing.
            |       -- Implementation: use a single Postgres node with a DO block:
            |       DO $$
            |       BEGIN
            |           INSERT INTO email_extracted_data (...) VALUES (...);
            |           -- Module 4 status update (direct DB call within same transaction)
            |           PERFORM transition_application_state(...);
            |           UPDATE emails SET status = 'extracted', extracted_at = NOW() WHERE id = ...;
            |       END $$;
            |       |
            |   [Sub-Workflow: SW-EM-02 Module Integration]
            |       -- Notify Module 4 (webhook notification for real-time update)
            |       -- Notify Module 6: interview details
            |       -- NOTE: This is a non-transactional notification call. If it fails,
            |       -- the extraction data is still committed. Module 4/6 will pick up
            |       -- the data on their next polling cycle.
            |
            |-- [rejection]:
            |   [HTTP Request: Claude Haiku Extraction]
            |       -- Rejection-specific extraction prompt
            |       |
            |   [Code: Match to Application in Module 4]
            |       -- Use company name + role title matching logic
            |       |
            |   [Postgres: Insert email_extracted_data]
            |       |
            |   [Sub-Workflow: SW-EM-02 Module Integration]
            |       -- Notify Module 4: status = 'rejected'
            |       |
            |   [Postgres: Update email status = 'extracted']
            |
            |-- [acknowledgment]:
            |   [HTTP Request: Claude Haiku Extraction]
            |       -- Acknowledgment-specific extraction prompt
            |       |
            |   [Code: Match to Application in Module 4]
            |       |
            |   [Postgres: Insert email_extracted_data]
            |       |
            |   [Sub-Workflow: SW-EM-02 Module Integration]
            |       -- Notify Module 4: status = 'acknowledged'
            |       |
            |   [Postgres: Update email status = 'extracted']
            |
            |-- [recruiter_outreach]:
            |   [HTTP Request: Claude Haiku Extraction]
            |       -- Recruiter-specific extraction prompt
            |       |
            |   [Code: Process Recruiter Data]
            |       -- Detect duplicate recruiters
            |       -- Create or update recruiter_contact
            |       -- Create recruiter_role_proposal
            |       -- Score role relevance
            |       |
            |   [Postgres: Upsert recruiter_contacts]
            |       |
            |   [Postgres: Insert recruiter_role_proposals]
            |       |
            |   [Postgres: Insert email_extracted_data]
            |       |
            |   [Postgres: Update email status = 'extracted']
            |
            |-- [job_alert]:
            |   [Code: Platform-Specific Alert Parsing]
            |       -- Use HTML parser for known platforms
            |       -- Fall back to Claude for unknown formats
            |       |
            |   [Code: Deduplicate Against Module 1]
            |       -- Check extracted job URLs/titles against jobs table
            |       |
            |   [IF: New Jobs Found?]
            |       |-- Yes:
            |       |   [Postgres: Insert New Jobs into Module 1 Pipeline]
            |       |       -- Insert into jobs table with source = 'email_alert'
            |       |-- No:
            |           [No Op]
            |       |
            |   [Postgres: Insert email_extracted_data]
            |       total_jobs_count, module1_jobs_created
            |       |
            |   [Postgres: Update email status = 'extracted']
            |
            |-- [offer]:
            |   [HTTP Request: Claude Haiku Extraction]
            |       -- Offer-specific extraction prompt
            |       |
            |   [Code: Match to Application in Module 4]
            |       |
            |   [Postgres: Insert email_extracted_data]
            |       |
            |   [Sub-Workflow: SW-EM-02 Module Integration]
            |       -- Notify Module 4: status = 'offer_received'
            |       |
            |   [Postgres: Update email status = 'extracted']
            |
            |-- [follow_up_request]:
                [HTTP Request: Claude Haiku Extraction]
                    -- Follow-up-specific extraction prompt
                    |
                [Code: Match to Application in Module 4]
                    |
                [Postgres: Insert email_extracted_data]
                    |
                [Sub-Workflow: SW-EM-02 Module Integration]
                    -- Notify Module 4: add follow-up requirement
                    |
                [Postgres: Update email status = 'extracted']
```

### 14.4 WF-EM-04: Gmail Labeling & Organization

**Purpose:** Apply Gmail labels to extracted emails based on their classification.

**Trigger:** Cron
```
*/5 * * * * (Europe/London) -- Every 5 minutes
```

**Node Chain:**

```
[Cron Trigger]
    |
[Code: Ensure Labels Exist]
    -- Check system_config for 'gmail_labels_initialized' flag
    -- If not set, create all labels via Gmail API
    -- Set flag after successful creation
    |
[Postgres: Get Extracted Emails Pending Labeling]
    SELECT e.*, ec.classification, ec.sub_category
    FROM emails e
    JOIN email_classifications ec ON ec.email_id = e.id
    WHERE e.status = 'extracted'
    ORDER BY e.date ASC
    LIMIT 20
    |
[IF: Emails Found?]
    |
    |-- No: [No Op]
    |
    |-- Yes:
        [SplitInBatches: Process Each Email]
            |
        [Code: Determine Labels to Apply]
            -- Map classification + sub_category to label names
            -- Look up label IDs from cached label list
            -- Include 'Job/Processed' internal label
            |
        [Gmail: Modify Message Labels]
            Message ID: {{ $json.gmail_message_id }}
            Add Labels: {{ $json.labels_to_add }}
            |
        [Postgres: Update email status = 'labeled']
            |
        [Postgres: Log Processing Step]
```

### 14.5 WF-EM-05: Response Drafting Engine

**Purpose:** Generate professional response drafts for actionable emails.

**Trigger:** Cron
```
*/10 * * * * (Europe/London) -- Every 10 minutes
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Check if Drafting is Enabled]
    SELECT value FROM system_config WHERE key = 'email_drafting_enabled'
    |
[IF: Drafting Enabled?]
    |
    |-- No: [No Op]
    |
    |-- Yes:
        [Postgres: Get Labeled Emails Needing Drafts]
            SELECT e.*, ec.classification, ec.sub_category,
                   eed.company_name, eed.role_title,
                   eed.interview_date, eed.interview_time,
                   eed.interview_format, eed.interview_location,
                   eed.interview_link, eed.interviewer_name,
                   eed.recruiter_name, eed.agency_name,
                   eed.proposed_role_title, eed.proposed_company,
                   eed.proposed_salary_raw, eed.proposed_location,
                   eed.action_required, eed.action_deadline,
                   rrp.relevance_tier
            FROM emails e
            JOIN email_classifications ec ON ec.email_id = e.id
            JOIN email_extracted_data eed ON eed.email_id = e.id
            LEFT JOIN recruiter_role_proposals rrp ON rrp.email_id = e.id
            LEFT JOIN email_drafts ed ON ed.email_id = e.id
            WHERE e.status = 'labeled'
                AND ed.id IS NULL  -- No draft created yet
                AND ec.classification IN ('interview_invite', 'recruiter_outreach', 'follow_up_request', 'acknowledgment')
                AND (
                    ec.classification != 'acknowledgment'
                    OR (
                        -- Only draft for A-tier acknowledgments (configurable)
                        EXISTS (
                            SELECT 1 FROM email_extracted_data eed2
                            JOIN jobs j ON j.company = eed2.company_name
                            WHERE eed2.email_id = e.id AND j.tier = 'A'
                        )
                    )
                )
            ORDER BY
                CASE ec.classification
                    WHEN 'interview_invite' THEN 1
                    WHEN 'follow_up_request' THEN 2
                    WHEN 'recruiter_outreach' THEN 3
                    WHEN 'acknowledgment' THEN 4
                END ASC
            LIMIT 5
            |
        [SplitInBatches: Process Each Email]
            |
        [Switch: Draft Type]
            |
            |-- [interview_invite]:
            |   [HTTP Request: Claude Haiku - Generate Interview Confirmation]
            |       -- Use interview confirmation prompt template
            |       |
            |   [Code: Validate Draft]
            |       -- Check for AI phrases, placeholders, length
            |       |
            |   [Gmail: Create Draft]
            |       -- Reply to original message, maintain thread
            |       |
            |   [Postgres: Insert email_drafts]
            |
            |-- [recruiter_outreach]:
            |   [Code: Determine Response Type]
            |       -- Based on relevance_tier:
            |       -- A/B -> interested, C -> decline with redirect, D -> decline
            |       |
            |   [HTTP Request: Claude Haiku - Generate Recruiter Response]
            |       -- Use appropriate recruiter response template
            |       |
            |   [Code: Validate Draft]
            |       |
            |   [Gmail: Create Draft]
            |       |
            |   [Postgres: Insert email_drafts]
            |
            |-- [follow_up_request]:
            |   [HTTP Request: Claude Haiku - Generate Follow-Up Response]
            |       |
            |   [Code: Validate Draft]
            |       |
            |   [Gmail: Create Draft]
            |       |
            |   [Postgres: Insert email_drafts]
            |
            |-- [acknowledgment]:
                [HTTP Request: Claude Haiku - Generate Acknowledgment Reply]
                    |
                [Code: Validate Draft]
                    |
                [Gmail: Create Draft]
                    |
                [Postgres: Insert email_drafts]
            |
        [Postgres: Update email status = 'draft_created']
        |
        [Postgres: Mark email as completed]
            -- Final status transition: ensures the GDPR purge function can find this email
            UPDATE emails SET status = 'completed', updated_at = NOW()
            WHERE id = {{ email_id }}
              AND status IN ('draft_created', 'labeled')
            -- Note: emails that skip drafting (not eligible for draft) also need to reach
            -- 'completed'. WF-EM-04 (labeling) should set status = 'completed' for emails
            -- where classification is in ('marketing', 'not_job_related', 'job_alert')
            -- since these categories do not proceed to drafting.
```

### 14.6 WF-EM-06: Urgent Notification Dispatcher

**Purpose:** Send immediate notifications for time-sensitive emails.

**Trigger:** Cron
```
*/3 * * * * (Europe/London) -- Every 3 minutes (highest-frequency workflow)
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Check if Notifications Enabled]
    SELECT value FROM system_config WHERE key = 'email_notifications_enabled'
    |
[IF: Notifications Enabled?]
    |
    |-- No: [No Op]
    |
    |-- Yes:
        [Postgres: Get Urgent Unnotified Emails]
            SELECT e.*, ec.classification, ec.sub_category, ec.is_urgent,
                   eed.*
            FROM emails e
            JOIN email_classifications ec ON ec.email_id = e.id
            JOIN email_extracted_data eed ON eed.email_id = e.id
            WHERE e.urgent_notification_sent = false
                AND ec.is_urgent = true
                AND ec.classification IN ('interview_invite', 'offer', 'follow_up_request')
                AND e.status IN ('extracted', 'labeled', 'draft_created', 'completed')
            ORDER BY e.date ASC
            |
        [IF: Urgent Emails Found?]
            |
            |-- No: [No Op]
            |
            |-- Yes:
                [Code: Check Notification Throttle]
                    -- Check against maxPerHour, maxPerDay, minGapSeconds
                    -- Quiet hours intelligence (22:00-07:00 UK time):
                    --   - interview_invite + offer: ALWAYS send immediately (override quiet hours)
                    --   - follow_up_request with deadline < 24h: send immediately
                    --   - All other urgent notifications during quiet hours: HOLD until 07:00
                    --     Store in notification_queue with scheduled_for = next 07:00
                    --   - Non-actionable notifications (e.g., acknowledgments received at midnight)
                    --     provide no value at 2AM; the candidate can act on them at 7AM
                    |
                [IF: Throttle Allows?]
                    |
                    |-- No:
                    |   [Postgres: Log Throttled Notification]
                    |
                    |-- Yes:
                        [Code: Format Notification Email (HTML)]
                            -- Select template based on classification
                            -- Populate with extracted data
                            -- Include link to original email in Gmail
                            -- Format as HTML for mobile readability:
                            --   - Bold field labels (Company, Role, Date, Time)
                            --   - Action buttons styled as <a> tags with background color
                            --   - Responsive width (max-width: 600px)
                            --   - Monospace for dates/times for clarity
                            |
                        [HTTP Request: Send via Resend]
                            POST https://api.resend.com/emails
                            Body: {
                                "from": "Selvi Job App <selvi-system@apiloom.io>",
                                "to": ["chellamma.uk@gmail.com"],
                                "subject": "{{ notificationSubject }}",
                                "text": "{{ notificationBody }}",
                                "headers": {
                                    "X-Entity-Ref-ID": "{{ notificationId }}"
                                }
                            }
                            |
                        [Postgres: Update email]
                            SET urgent_notification_sent = true,
                                urgent_notification_sent_at = NOW()
                            |
                        [Postgres: Insert email_notifications]
                            status: 'sent', resend_message_id: {{ resendResponse.id }}
```

### 14.7 WF-EM-07: Daily Summary Generator

**Purpose:** Compile and send a daily summary of all email activity.

**Trigger:** Cron
```
0 8 * * * (Europe/London) -- 8:00 AM daily
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Aggregate Email Stats (Last 24 Hours)]
    -- Count by classification
    SELECT
        ec.classification,
        COUNT(*) AS count,
        json_agg(json_build_object(
            'subject', e.subject,
            'from', e.from_name,
            'company', eed.company_name,
            'role', eed.role_title,
            'classification', ec.classification,
            'sub_category', ec.sub_category
        )) AS details
    FROM emails e
    JOIN email_classifications ec ON ec.email_id = e.id
    LEFT JOIN email_extracted_data eed ON eed.email_id = e.id
    WHERE e.ingested_at >= NOW() - INTERVAL '24 hours'
        AND ec.classification != 'not_job_related'
    GROUP BY ec.classification
    |
[Postgres: Get Pending Follow-Ups]
    -- Emails awaiting our response (recruiter conversations)
    SELECT rc.recruiter_name, rc.agency_name, et.subject,
           et.last_received_at,
           EXTRACT(EPOCH FROM (NOW() - et.last_received_at)) / 3600 AS hours_waiting
    FROM email_threads et
    JOIN recruiter_contacts rc ON rc.id = et.recruiter_contact_id
    WHERE et.status = 'active'
        AND et.last_received_at > et.last_sent_at
        AND et.last_received_at < NOW() - INTERVAL '48 hours'
        AND rc.status != 'blacklisted'
    |
[Postgres: Get Stale Conversations]
    -- Conversations where recruiter has not responded
    SELECT rc.recruiter_name, rc.agency_name, et.subject,
           et.last_sent_at,
           EXTRACT(EPOCH FROM (NOW() - et.last_sent_at)) / 86400 AS days_waiting
    FROM email_threads et
    JOIN recruiter_contacts rc ON rc.id = et.recruiter_contact_id
    WHERE et.status = 'active'
        AND et.last_sent_at > et.last_received_at
        AND et.last_sent_at < NOW() - INTERVAL '5 days'
    |
[Postgres: Get New Recruiter Contacts (Last 24h)]
    SELECT recruiter_name, agency_name, recruiter_email, first_contact_at
    FROM recruiter_contacts
    WHERE first_contact_at >= NOW() - INTERVAL '24 hours'
    |
[Postgres: Get Classification Accuracy Stats]
    SELECT
        COUNT(*) FILTER (WHERE needs_review = true) AS needs_review_count,
        AVG(ec.confidence) AS avg_confidence,
        COUNT(*) FILTER (WHERE ec.classification_method = 'sender_pattern') AS sender_pattern_count,
        COUNT(*) FILTER (WHERE ec.classification_method = 'claude_haiku') AS haiku_count,
        COUNT(*) FILTER (WHERE ec.classification_method = 'claude_sonnet') AS sonnet_count
    FROM emails e
    JOIN email_classifications ec ON ec.email_id = e.id
    WHERE e.ingested_at >= NOW() - INTERVAL '24 hours'
    |
[Code: Compile Summary Email]
    -- Format all data into a readable summary
    -- Highlight urgent items at top
    -- Include counts, details, and action items
    |
[HTTP Request: Send Summary via Resend]
    POST https://api.resend.com/emails
    Body: {
        "from": "Selvi Job App <selvi-system@apiloom.io>",
        "to": ["chellamma.uk@gmail.com"],
        "subject": "Daily Job Email Summary - {{ date }}",
        "text": "{{ summaryBody }}"
    }
    |
[Postgres: Insert email_notifications]
    notification_type: 'daily_summary'
```

**Summary Email Format:**

```
================================================================
DAILY JOB EMAIL SUMMARY -- {{ date }}
================================================================

URGENT ITEMS (Require Your Attention):
--------------------------------------
{% if interview_invites > 0 %}
  INTERVIEWS:
  {% for item in interview_details %}
    - {{ item.company }} - {{ item.role }} ({{ item.interview_date }} {{ item.interview_time }})
      Draft confirmation created in Gmail Drafts.
  {% endfor %}
{% endif %}

{% if follow_ups > 0 %}
  FOLLOW-UP REQUESTS:
  {% for item in follow_up_details %}
    - {{ item.company }} - {{ item.role }}: {{ item.action_required }}
      {% if item.deadline %}Deadline: {{ item.deadline }}{% endif %}
  {% endfor %}
{% endif %}

{% if pending_responses > 0 %}
  AWAITING YOUR RESPONSE (48+ hours):
  {% for item in pending_response_details %}
    - {{ item.recruiter_name }} ({{ item.agency_name }}): {{ item.subject }}
      Waiting since: {{ item.hours_waiting | round }} hours
  {% endfor %}
{% endif %}


EMAIL SUMMARY (Last 24 Hours):
-------------------------------
  Interview Invitations:  {{ interview_count }}
  Application Acks:       {{ acknowledgment_count }}
  Rejections:             {{ rejection_count }}
  Recruiter Outreach:     {{ recruiter_count }}
  Job Alerts Processed:   {{ alert_count }} ({{ new_jobs_extracted }} new jobs found)
  Follow-Up Requests:     {{ follow_up_count }}
  Offers:                 {{ offer_count }}
  Marketing (skipped):    {{ marketing_count }}

{% if rejections > 0 %}
REJECTIONS:
  {% for item in rejection_details %}
    - {{ item.company }} - {{ item.role }}
      {% if item.rejection_reason %}Reason: {{ item.rejection_reason }}{% endif %}
  {% endfor %}
{% endif %}

{% if new_recruiters > 0 %}
NEW RECRUITER CONTACTS:
  {% for r in new_recruiter_details %}
    - {{ r.recruiter_name }} ({{ r.agency_name }}) -- {{ r.recruiter_email }}
  {% endfor %}
{% endif %}

{% if stale_conversations > 0 %}
STALE CONVERSATIONS (Recruiter Not Responding):
  {% for item in stale_details %}
    - {{ item.recruiter_name }} ({{ item.agency_name }}): {{ item.days_waiting | round }} days
      Consider following up or moving on.
  {% endfor %}
{% endif %}

SYSTEM STATS:
  Emails processed: {{ total_processed }}
  Classification methods: {{ sender_pattern_count }} by pattern, {{ haiku_count }} by Haiku, {{ sonnet_count }} by Sonnet
  Average confidence: {{ avg_confidence | percentage }}
  {% if needs_review_count > 0 %}
  *** {{ needs_review_count }} emails need manual review (low confidence) ***
  {% endif %}

================================================================
This summary was generated by the Selvi Job App Email Management System.
```

### 14.8 WF-EM-08: Recruiter Tracker

**Purpose:** Update recruiter profiles, detect stale conversations, recalculate quality scores.

**Trigger:** Cron
```
*/30 * * * * (Europe/London) -- Every 30 minutes
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Monitor Sent Folder]
    -- Check for outbound responses to tracked conversations
    -- (This is the Sent folder polling sub-task)
    |
[Gmail: Get Sent Messages]
    Query: "in:sent after:{{ lastSentPollTimestamp }}"
    Max Results: 20
    |
[Code: Match Sent Messages to Threads]
    -- Match by thread_id to existing email_threads
    -- Update last_sent_at on matching threads
    -- Update recruiter_contacts.our_response_count
    |
[Postgres: Update Email Threads]
    UPDATE email_threads SET last_sent_at = NOW()
    WHERE gmail_thread_id = {{ threadId }}
    |
[Postgres: Update Last Sent Poll Timestamp]
    |
[Postgres: Detect Stale Conversations]
    -- Flag as dormant if no activity for 14 days
    UPDATE email_threads SET status = 'dormant'
    WHERE status = 'active'
        AND GREATEST(last_received_at, last_sent_at) < NOW() - INTERVAL '14 days'
    |
[Postgres: Recalculate Recruiter Quality Scores]
    -- For recruiters with new activity in last 30 minutes
    SELECT rc.id, rc.recruiter_name,
           AVG(rrp.relevance_score) AS avg_relevance,
           COUNT(rrp.id) AS total_roles,
           COUNT(rrp.id) FILTER (WHERE rrp.relevance_tier IN ('A', 'B')) AS good_roles,
           rc.total_contacts,
           rc.our_response_count,
           rc.responded_to_our_reply,
           rc.ghosted_after_our_reply,
           rc.exclusive_role_count
    FROM recruiter_contacts rc
    LEFT JOIN recruiter_role_proposals rrp ON rrp.recruiter_contact_id = rc.id
    WHERE rc.updated_at >= NOW() - INTERVAL '30 minutes'
    GROUP BY rc.id
    |
[Code: Calculate Quality Scores]
    -- Apply the scoring algorithm from Section 10.2
    |
[Postgres: Update recruiter_contacts]
    SET quality_score = {{ calculatedScore }}
```

### 14.9 SW-EM-01: Email Preprocessing (Sub-Workflow)

**Purpose:** Shared preprocessing logic for all ingested emails.

**Input:** Raw email data from Gmail API

**Processing:**

```
[Input: Raw Email Data]
    |
[Code: Extract Body Parts]
    -- Gmail returns multipart messages
    -- Extract text/plain and text/html parts
    -- Handle base64 encoding
    |
[Code: Strip HTML]
    -- Apply HTML stripping function (Section 6.4)
    -- Preserve structural markers (**bold**, links, tables)
    |
[Code: Detect Language]
    -- Apply language detection (Section 6.4)
    -- Return language code and confidence
    |
[Code: Classify Sender]
    -- Apply sender pattern matching (Section 6.5)
    -- Return classification and confidence
    |
[Code: Detect ICS Attachment]
    -- Check attachment_types for application/ics
    -- If found, parse ICS content (Section 8.4)
    |
[Code: Detect Forwarded Email]
    -- Check for "Fwd:" prefix, forwarded headers
    -- Extract forwarded content if present
    |
[Output: Preprocessed Email Data]
    {
        body_plain, body_html, body_stripped,
        detected_language, language_confidence,
        sender_pattern_match, sender_pattern_confidence,
        has_ics_attachment, ics_data,
        is_forwarded, forwarded_content,
        is_reply, in_reply_to
    }
```

### 14.10 SW-EM-02: Module Integration Dispatcher (Sub-Workflow)

**Purpose:** Route extracted email data to other Selvi Job App modules.

**Input:** Email classification and extracted data.

**Processing:**

```
[Input: Classification + Extracted Data]
    |
[Switch: Classification]
    |
    |-- [interview_invite]:
    |   [Code: Prepare Module 4 Update]
    |       -- status: 'interview_scheduled'
    |       -- interview_date, interview_time, interview_format
    |       -- Match to application by company + role
    |       |
    |   [Postgres: Update Module 4 Application Status]
    |       UPDATE applications
    |       SET status = 'interview_scheduled',
    |           interview_date = {{ date }},
    |           interview_details = {{ details_json }},
    |           updated_at = NOW()
    |       WHERE company = {{ company }} AND role_title = {{ role }}
    |       |
    |   [Code: Prepare Module 6 Data]
    |       -- interview_date, time, duration, format, platform
    |       -- location/link, interviewer details
    |       -- preparation instructions
    |       |
    |   [Postgres: Insert Module 6 Interview Record]
    |       INSERT INTO interview_schedule (
    |           application_id, interview_date, interview_time,
    |           duration, format, platform, location, link,
    |           interviewer_name, interviewer_email,
    |           preparation_notes, source_email_id
    |       ) VALUES (...)
    |
    |-- [rejection]:
    |   [Code: Match to Application]
    |       |
    |   [Postgres: Update Module 4 Application Status]
    |       UPDATE applications
    |       SET status = 'rejected',
    |           rejection_reason = {{ reason }},
    |           rejection_stage = {{ stage }},
    |           rejected_at = NOW(),
    |           updated_at = NOW()
    |       WHERE company = {{ company }} AND role_title = {{ role }}
    |
    |-- [acknowledgment]:
    |   [Code: Match to Application]
    |       |
    |   [Postgres: Update Module 4 Application Status]
    |       UPDATE applications
    |       SET status = 'acknowledged',
    |           acknowledged_at = NOW(),
    |           reference_number = {{ reference }},
    |           expected_response_date = {{ date }},
    |           updated_at = NOW()
    |       WHERE company = {{ company }} AND role_title = {{ role }}
    |
    |-- [offer]:
    |   [Code: Match to Application]
    |       |
    |   [Postgres: Update Module 4 Application Status]
    |       UPDATE applications
    |       SET status = 'offer_received',
    |           offer_salary = {{ salary }},
    |           offer_start_date = {{ start_date }},
    |           offer_deadline = {{ response_deadline }},
    |           offer_details = {{ details_json }},
    |           updated_at = NOW()
    |       WHERE company = {{ company }} AND role_title = {{ role }}
    |
    |-- [job_alert]:
    |   [Code: Prepare Job Listings for Module 1]
    |       -- Format extracted jobs as Module 1 input
    |       -- Generate dedup_hash for each
    |       |
    |   [Postgres: Insert Jobs into Module 1]
    |       INSERT INTO jobs (
    |           title, company, location, url, source, dedup_hash,
    |           job_type, status, discovered_at
    |       ) VALUES (...)
    |       ON CONFLICT (dedup_hash) DO UPDATE SET last_seen_at = NOW()
    |       |
    |   [Postgres: Insert Job Sources]
    |       INSERT INTO job_sources (job_id, source, source_url, captured_at)
    |       VALUES (..., 'email_alert', ...)
    |
    |-- [follow_up_request]:
        [Code: Match to Application]
            |
        [Postgres: Update Module 4 Application Status]
            UPDATE applications
            SET status = 'follow_up_required',
                follow_up_action = {{ action }},
                follow_up_deadline = {{ deadline }},
                updated_at = NOW()
            WHERE company = {{ company }} AND role_title = {{ role }}
```

---

## 15. Integration with Modules 1, 3, 4, 6

### 15.1 Module 1 (Job Discovery) Integration

**Direction:** Module 5 -> Module 1

**Purpose:** Feed jobs extracted from email alerts into the discovery pipeline.

**Data Flow:**

```
[Job Alert Email]
    |
[Module 5: Parse Alert, Extract Job Listings]
    |
[Deduplicate Against Module 1 Database]
    |
[Insert New Jobs into jobs table with source = 'email_alert']
    |
[Module 1: Score new jobs (picked up by WF5 AI Scoring Pipeline)]
```

**Integration Points:**

| Module 5 Output | Module 1 Input | Table | Field |
|-----------------|----------------|-------|-------|
| Job title from alert | title | jobs | title |
| Company from alert | company | jobs | company |
| Location from alert | location | jobs | location |
| Job URL from alert | url | jobs | url |
| Alert source platform | source | job_sources | source (e.g., 'linkedin_email') |
| Dedup hash | dedup_hash | jobs | dedup_hash |

**Deduplication Logic:**

Before inserting jobs from email alerts, Module 5 checks:
1. Does the dedup_hash already exist in the jobs table? (Exact match)
2. Does the URL already exist? (URL-based dedup)
3. Is there a job with the same title + company posted within the last 7 days? (Fuzzy match)

If any match is found, the job is not re-inserted. Instead, the existing job's `last_seen_at` is updated and a new entry is added to `job_sources`.

### 15.2 Module 3 (Auto-Apply) Integration

**Direction:** Module 3 -> Module 5 (indirect, via Module 4)

**Purpose:** After Module 3 submits an application, Module 5 monitors for acknowledgment emails to confirm delivery.

**Data Flow:**

```
[Module 3: Submit Application]
    |
[Module 4: Record application (status: 'submitted')]
    |
[Time passes... employer sends acknowledgment email]
    |
[Module 5: Detect acknowledgment email]
    |
[Module 5: Match to application by company + role]
    |
[Module 4: Update status to 'acknowledged']
```

**Matching Challenge:**

Employers do not always use the same company name or role title in their acknowledgment emails as was used in the application. For example:
- Application submitted to "Acme Corporation" but acknowledgment from "Acme Corp Ltd"
- Application for "Senior L&D Manager" but acknowledgment references "Senior Learning & Development Manager"

Module 5 uses the fuzzy matching algorithm described in Section 8.7 to handle these variations.

**Delivery Failure Detection:**

```
[Module 3: Submit Application via Email]
    |
[Module 5: Detect bounce/delivery failure email]
    |
[Module 5: Match to submitted application]
    |
[Module 4: Update status to 'delivery_failed']
    |
[Module 5: Send urgent notification to candidate]
```

### 15.3 Module 4 (Application Tracker) Integration

**Direction:** Module 5 -> Module 4

**Purpose:** Feed application lifecycle status updates into the tracker based on email signals.

**Status Transitions Triggered by Email:**

| Email Classification | Module 4 Status Update | Trigger Condition |
|---------------------|----------------------|-------------------|
| acknowledgment | submitted -> acknowledged | Company + role match found |
| rejection (post-application) | acknowledged -> rejected | Company + role match found |
| rejection (post-interview) | interview_scheduled -> rejected | Company + role match found |
| interview_invite | acknowledged -> interview_scheduled | Company + role match found |
| offer | interview_scheduled -> offer_received | Company + role match found |
| follow_up_request | any -> follow_up_required | Company + role match found |
| delivery_failure | submitted -> delivery_failed | Bounce email matched to application |

**Module 4 API Contract:**

Module 5 updates Module 4 by writing directly to the shared Postgres database. The target table (TBD by Module 4 PRD) is expected to have:

```sql
-- Expected Module 4 table structure (for Module 5 integration)
-- Module 4 PRD will define the full schema; these are the fields Module 5 writes to

UPDATE applications
SET
    status = '{{ new_status }}',
    status_updated_at = NOW(),
    status_source = 'email',                    -- Module 5 attribution
    status_source_email_id = '{{ email_id }}',  -- Link back to Module 5 email record
    -- Additional fields depending on status:
    acknowledged_at = ...,                       -- For acknowledgment
    rejected_at = ...,                           -- For rejection
    rejection_reason = ...,
    interview_scheduled_at = ...,                -- For interview_invite
    offer_received_at = ...,                     -- For offer
    follow_up_action = ...,                      -- For follow_up_request
    follow_up_deadline = ...
WHERE id = '{{ application_id }}';
```

**Unmatched Emails:**

When Module 5 cannot match an email to an existing application in Module 4:

1. If classification is `acknowledgment` or `rejection`: Log as "unmatched" in email_processing_log, include in daily summary for manual review
2. If classification is `interview_invite` or `offer`: Log as "unmatched" AND send an urgent notification (these are too important to miss even if matching fails)
3. If classification is `follow_up_request`: Send notification regardless of match status

### 15.4 Module 6 (Interview Scheduling) Integration

**Direction:** Module 5 -> Module 6

**Purpose:** Pass extracted interview details to the scheduling module for calendar integration and preparation.

**Data Passed to Module 6:**

```json
{
  "source": "module_5_email",
  "email_id": "uuid",
  "application_id": "uuid (from Module 4 match)",

  "interview": {
    "company_name": "Acme Corp",
    "role_title": "Senior L&D Manager",
    "date": "2026-04-02",
    "time": "10:30",
    "timezone": "Europe/London",
    "duration_minutes": 45,
    "format": "video",
    "platform": "Microsoft Teams",
    "meeting_link": "https://teams.microsoft.com/...",
    "location": null,

    "interviewer": {
      "name": "Sarah Johnson",
      "title": "Head of People",
      "email": "sarah.johnson@acmecorp.co.uk"
    },
    "panel_members": [],

    "preparation": {
      "instructions": "Please prepare a 10-minute presentation on your L&D strategy approach",
      "what_to_bring": null,
      "dress_code": "Business casual"
    },

    "logistics": {
      "parking": null,
      "directions": null,
      "contact_for_questions": "recruitment@acmecorp.co.uk"
    },

    "alternative_times": [
      { "date": "2026-04-02", "time": "10:30" },
      { "date": "2026-04-03", "time": "14:00" }
    ]
  },

  "response_deadline": "2026-03-30T17:00:00Z",
  "draft_created": true,
  "draft_id": "gmail_draft_123"
}
```

Module 6 is responsible for:
- Creating the calendar event
- Setting reminders
- Preparing interview materials
- Tracking preparation status

### 15.5 Cross-Module Error Handling

When a Module 5 integration update to another module fails:

```javascript
async function handleIntegrationError(module, emailId, operation, error) {
  // 1. Log the error
  await db.insert('email_processing_log', {
    email_id: emailId,
    workflow_name: 'SW-EM-02',
    step: `module_${module}_integration`,
    status: 'failed',
    error_message: error.message,
    details: { module, operation }
  });

  // 2. Mark the email for retry
  await db.update('email_extracted_data', {
    [`module${module}_updated`]: false
  }, { email_id: emailId });

  // 3. If this was a high-priority integration (interview, offer), send notification anyway
  if (['interview_invite', 'offer'].includes(operation)) {
    // The notification will go out regardless of whether Module 4 was updated
    // The candidate needs to know about the interview/offer
  }

  // 4. Retry will happen on next WF-EM-03 cycle (email remains in 'classified' state
  //    since 'extracted' status is only set on successful integration)
}
```

---

## 16. Error Handling & Monitoring

### 16.1 Error Categories

| Category | Severity | Example | Response |
|----------|----------|---------|----------|
| Gmail API Auth Failure | CRITICAL | OAuth2 token revoked | Pause all email workflows, send alert via Resend, require manual re-auth |
| Gmail API Rate Limit | HIGH | 429 Too Many Requests | Exponential backoff, reduce polling frequency |
| Gmail API Transient Error | MEDIUM | 500/502/503 | Retry 3x with backoff, skip email on persistent failure |
| Claude API Error | MEDIUM | Rate limit, server error, malformed response | Retry 2x, skip classification (mark for retry next cycle) |
| Claude Response Parse Error | LOW | Invalid JSON in Claude response | Retry with explicit format instruction, skip on 2nd failure |
| Postgres Connection Error | CRITICAL | Database unreachable | Pause all workflows, send alert |
| Resend API Error | MEDIUM | Notification delivery failed | Retry 2x, log failure, continue processing |
| Email Parse Error | LOW | Malformed email, encoding issue | Log error, skip email, flag for manual review |
| Label Create Error | LOW | Gmail label API error | Retry, fall back to labeling without color |
| Draft Create Error | LOW | Gmail draft API error | Retry, log failure, continue processing |
| Integration Error | MEDIUM | Module 4/6 update failed | Retry next cycle, send notification regardless |

### 16.2 Error Handling Strategy

**Retry Logic:**

```javascript
const RETRY_CONFIG = {
  gmail_api: { maxRetries: 3, baseDelay: 2000, maxDelay: 60000, backoffMultiplier: 2 },
  claude_api: { maxRetries: 2, baseDelay: 5000, maxDelay: 30000, backoffMultiplier: 2 },
  resend_api: { maxRetries: 2, baseDelay: 3000, maxDelay: 15000, backoffMultiplier: 2 },
  postgres: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, backoffMultiplier: 2 }
};

async function withRetry(operation, config, context) {
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication errors (they won't resolve with retries)
      if (error.statusCode === 401 || error.statusCode === 403) throw error;

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
```

### 16.3 Circuit Breaker Pattern

For external API calls, the system implements a circuit breaker to prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }
}

// Usage:
const gmailBreaker = new CircuitBreaker('gmail', { failureThreshold: 5, recoveryTimeout: 120000 });
const claudeBreaker = new CircuitBreaker('claude', { failureThreshold: 3, recoveryTimeout: 60000 });
```

### 16.4 Monitoring Dashboard Queries

**Email Processing Pipeline Health:**

```sql
-- Current pipeline state
SELECT
    status,
    COUNT(*) AS count,
    MIN(ingested_at) AS oldest,
    MAX(ingested_at) AS newest
FROM emails
WHERE ingested_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY
    CASE status
        WHEN 'ingested' THEN 1
        WHEN 'classified' THEN 2
        WHEN 'extracted' THEN 3
        WHEN 'labeled' THEN 4
        WHEN 'draft_created' THEN 5
        WHEN 'completed' THEN 6
        WHEN 'skipped' THEN 7
        WHEN 'error' THEN 8
    END;
```

**Processing Latency:**

```sql
-- Average time through each processing stage (last 24 hours)
SELECT
    AVG(EXTRACT(EPOCH FROM (classified_at - ingested_at))) AS avg_classification_seconds,
    AVG(EXTRACT(EPOCH FROM (extracted_at - classified_at))) AS avg_extraction_seconds,
    AVG(EXTRACT(EPOCH FROM (labeled_at - extracted_at))) AS avg_labeling_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (classified_at - ingested_at))) AS p50_classification,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (classified_at - ingested_at))) AS p95_classification
FROM emails
WHERE ingested_at >= NOW() - INTERVAL '24 hours'
    AND status NOT IN ('skipped', 'error');
```

**Classification Method Distribution:**

```sql
SELECT
    classification_method,
    COUNT(*) AS count,
    AVG(confidence) AS avg_confidence,
    SUM(cost_usd) AS total_cost
FROM email_classifications
WHERE classified_at >= NOW() - INTERVAL '24 hours'
GROUP BY classification_method;
```

**Error Rate:**

```sql
SELECT
    workflow_name,
    step,
    COUNT(*) AS error_count,
    MAX(created_at) AS last_error
FROM email_processing_log
WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY workflow_name, step
ORDER BY error_count DESC;
```

**Stuck Emails (Processing Stalled):**

```sql
-- Emails stuck in intermediate state for more than 30 minutes
SELECT id, gmail_message_id, subject, status, ingested_at,
       EXTRACT(EPOCH FROM (NOW() - ingested_at)) / 60 AS minutes_stuck
FROM emails
WHERE status IN ('ingested', 'classified', 'extracted')
    AND ingested_at < NOW() - INTERVAL '30 minutes'
ORDER BY ingested_at ASC;
```

### 16.5 Health Check Workflow

A periodic health check ensures all components are functioning:

```sql
-- WF-EM-HEALTH: Email System Health Check (runs every 15 minutes)

-- 1. Gmail API connectivity
-- Test with a lightweight messages.list call (maxResults: 1)

-- 2. Claude API connectivity
-- Test with a minimal classification request

-- 3. Resend API connectivity
-- Test with a validation endpoint call

-- 4. Processing pipeline throughput
-- Check if emails are flowing through stages

-- 5. Stuck email detection
-- Alert if any emails have been in intermediate state > 30 minutes

-- 6. Database connectivity
-- Simple SELECT 1 query
```

### 16.6 Alerting Rules

| Condition | Severity | Alert Channel | Cooldown |
|-----------|----------|--------------|----------|
| Gmail OAuth2 token expired | CRITICAL | Resend email | None (once) |
| No emails processed in 6+ hours (business hours) | HIGH | Resend email | 2 hours |
| Classification error rate > 10% | MEDIUM | Daily summary | 24 hours |
| > 5 emails stuck in pipeline > 30 min | MEDIUM | Resend email | 1 hour |
| Claude API circuit breaker OPEN | HIGH | Resend email | 30 min |
| Postgres connection failure | CRITICAL | Resend email | None (once) |
| Notification delivery failure rate > 20% | MEDIUM | Daily summary | 24 hours |
| GDPR body purge not running | MEDIUM | Daily summary | 24 hours |

---

## 17. Privacy & Compliance (GDPR, Email Processing)

### 17.1 GDPR Applicability

The Selvi Job App processes personal data of EU/UK data subjects (the candidate herself, and incidentally, the recruiters and employers who email her). GDPR and UK GDPR apply. Key principles:

| GDPR Principle | Module 5 Implementation |
|----------------|------------------------|
| **Lawful basis** | Legitimate interest (managing own job search) for candidate data. Consent basis not needed as the candidate is running the system for herself. Recruiter/employer data processing is minimal and incidental to the legitimate purpose. |
| **Data minimization** | Only job-related emails are processed. Non-job emails are identified and skipped. Email bodies are purged after extraction (7-day retention). |
| **Purpose limitation** | Data is processed solely for job search management. No secondary use, no sharing with third parties, no marketing. |
| **Storage limitation** | Email bodies purged after 7 days. Extracted metadata retained for the duration of the job search. Full deletion available on request. |
| **Security** | OAuth2 tokens encrypted in n8n credential store. Database connections use SSL. Email content not logged in workflow execution logs. |
| **Transparency** | The candidate is fully aware of the processing (she set it up). Recruiters/employers are not individually notified (processing is minimal and expected in the context of job search communication). |

### 17.2 Data Processing Inventory

| Data Category | Source | Processing | Retention | Legal Basis |
|---------------|--------|------------|-----------|-------------|
| Email headers (from, to, subject, date) | Gmail inbox | Stored in emails table | Duration of job search | Legitimate interest |
| Email body text | Gmail inbox | Classified by AI, extracted, then purged | 7 days | Legitimate interest |
| Extracted company/role data | Email body | Stored in email_extracted_data | Duration of job search | Legitimate interest |
| Recruiter contact details | Email body | Stored in recruiter_contacts | Duration of job search + 6 months | Legitimate interest |
| Interview dates/times | Email body | Passed to Module 6 | Duration of job search | Legitimate interest |
| Classification results | AI processing | Stored in email_classifications | Duration of job search | Legitimate interest |
| Gmail OAuth2 tokens | Google OAuth2 | Stored in n8n credential store (encrypted) | Until revoked | Service necessity |

### 17.3 Data Retention Schedule

| Data | Retention Period | Purge Method |
|------|-----------------|-------------|
| Email body text (plain, HTML, stripped) | 7 days after processing | `purge_email_bodies()` function (Section 13.12) |
| Email metadata (headers, classification) | Duration of job search | Manual deletion when search concludes |
| Extracted structured data | Duration of job search | Manual deletion when search concludes |
| Recruiter contacts | Duration of job search + 6 months | Scheduled purge after job search concludes |
| Processing logs | 90 days | Scheduled purge |
| Calibration test data | Indefinite (synthetic) | N/A (no real personal data) |
| n8n execution logs | 7 days (configured in n8n) | n8n auto-prune |

### 17.4 Data Purge Procedures

**Automated Purge (daily via n8n cron):**

```sql
-- Automated daily purge (WF-EM-PURGE, cron: 0 3 * * *, Europe/London)
-- All retention enforcement is automated, not manual SQL.

-- 1. Purge email bodies older than retention period
SELECT purge_email_bodies(7);

-- 2. Purge old processing logs (90 days)
DELETE FROM email_processing_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- 3. Purge old notification records (90 days)
DELETE FROM email_notifications
WHERE created_at < NOW() - INTERVAL '90 days';

-- 4. Purge old workflow execution log references (30 days)
-- n8n's EXECUTIONS_DATA_MAX_AGE handles execution data; this covers our custom logs
DELETE FROM workflow_errors
WHERE occurred_at < NOW() - INTERVAL '30 days';

-- 5. Purge stale email_sender_patterns not seen in 6 months
DELETE FROM email_sender_patterns
WHERE last_seen_at < NOW() - INTERVAL '180 days'
  AND source = 'auto_detected';

-- 6. Log purge execution for audit
INSERT INTO email_processing_log (workflow_name, step, status, details)
VALUES ('WF-EM-PURGE', 'daily_purge', 'completed',
        jsonb_build_object('purged_bodies', (SELECT purge_email_bodies(7)),
                          'purged_at', NOW()));
```

**Manual Full Purge (when job search concludes):**

```sql
-- Run manually when the candidate's job search is complete

-- 1. Purge all email bodies
UPDATE emails SET
    body_plain = NULL,
    body_html = NULL,
    body_stripped = NULL,
    body_purged = true,
    body_purged_at = NOW();

-- 2. Anonymize recruiter contacts (optional, based on candidate preference)
UPDATE recruiter_contacts SET
    recruiter_email = 'redacted@redacted.com',
    recruiter_phone = NULL,
    linkedin_url = NULL
WHERE status != 'high_value';  -- Keep high-value contacts intact if candidate wants

-- 3. Clear processing logs
TRUNCATE email_processing_log;

-- 4. Clear notification history
TRUNCATE email_notifications;

-- 5. Revoke Gmail OAuth2 tokens
-- (Done manually via Google Account settings or n8n credential deletion)
```

### 17.5 Third-Party Data Processing

| Third Party | Data Shared | Purpose | DPA Required? |
|-------------|-------------|---------|---------------|
| Anthropic (Claude API) | Email body text (for classification) | AI classification and extraction | Anthropic's Terms of Service include data processing terms. Email content sent via API is not used for training (API usage policy). |
| Resend (email delivery) | Notification content (summaries, alerts) | Sending notifications to the candidate | Resend's Terms of Service cover transactional email processing. Only the candidate receives notifications. |
| Google (Gmail API) | Already stored in candidate's Gmail | Reading and labeling emails | Google Workspace terms already cover this as the candidate's own account. |

**Key Assurance:** No email content from employers or recruiters is shared with anyone other than the candidate herself. Anthropic receives email text for classification via their API, but per Anthropic's API terms, API data is not used for model training and is not retained beyond the API request.

### 17.6 Subject Access Request Handling

If a recruiter or employer requests to know what data is stored about them (SAR under GDPR):

1. Query `recruiter_contacts` and `email_extracted_data` for their email address
2. Export all related records as JSON
3. Provide within 30 days per GDPR requirement
4. Delete their data on request (right to erasure)

In practice, this is unlikely for a personal job search system, but the data model supports it.

### 17.6b Data Breach Notification Procedure

| Step | Action | Timeframe |
|------|--------|-----------|
| 1 | **Detect:** Gmail OAuth token compromise (unexpected access in Google security dashboard), database breach (unexpected queries), or Claude API key leak | Continuous monitoring |
| 2 | **Contain:** Revoke Gmail OAuth tokens immediately (Google Account > Security > Third-party access). Revoke Claude API key. Change database password. | Within 1 hour |
| 3 | **Assess:** Determine which emails were accessed. Module 5 stores email bodies for up to 7 days, recruiter contact details, and classification metadata. The primary risk is exposure of recruiter/employer email content and contact details. | Within 4 hours |
| 4 | **Notify affected parties:** If recruiter contact details (email, phone) were exposed to unauthorized parties, notify affected recruiters. If email content was exposed, assess whether it contains employer confidential information. | Within 48 hours |
| 5 | **Report to ICO:** If the breach involves third-party personal data (recruiter names, emails, phone numbers) and poses a risk to their rights and freedoms, report within 72 hours. | Within 72 hours |
| 6 | **Remediate:** Re-authenticate Gmail OAuth with fresh tokens. Rotate all API keys. Review and tighten access controls. | Within 24 hours of containment |
| 7 | **Post-incident:** Document the breach, update security controls, review OAuth scope permissions (reduce if possible). | Within 7 days |

**Gmail-specific breach indicators:**
- Google Security Alert email about new device/app access
- Unexpected email reads (visible in Gmail audit log if Workspace)
- OAuth token refresh failures (may indicate token was revoked by Google after suspicious activity)

### 17.7 Security Controls

| Control | Implementation |
|---------|---------------|
| Encryption at rest | Postgres data directory on encrypted filesystem (Hetzner default) |
| Encryption in transit | Gmail API uses HTTPS. Claude API uses HTTPS. Resend uses HTTPS. Postgres connections use SSL. |
| Access control | n8n is behind Dokploy reverse proxy with authentication. Database accessible only from n8n container. |
| Credential management | OAuth2 tokens in n8n encrypted credential store. API keys in environment variables. |
| Audit logging | All processing steps logged in email_processing_log with timestamps. |
| Data masking | Email body text not included in n8n execution logs. Sensitive fields masked in error logs. |
| Token revocation | Gmail OAuth2 tokens can be revoked immediately via Google Account settings. |

---

## 18. Rollout Plan

### 18.1 Phase Overview

| Phase | Duration | Focus | Success Criteria |
|-------|----------|-------|-----------------|
| Phase 0: Infrastructure Setup | 2 days | Gmail API setup, database migration, Resend config | OAuth2 flow working, tables created, Resend sending |
| Phase 1: Passive Monitoring | 5 days | Poll + ingest + classify (no labeling, no drafts, no notifications) | 50+ emails classified, 90%+ accuracy on manual review |
| Phase 2: Classification + Labeling | 5 days | Enable labeling, tune classification accuracy | Labels applied correctly to 95%+ of emails |
| Phase 3: Data Extraction + Module Integration | 5 days | Enable extraction, connect to Module 4 | Status updates flowing to Module 4, extraction accuracy 90%+ |
| Phase 4: Notifications + Drafting | 3 days | Enable urgent notifications and response drafts | Interview invitations trigger notifications within 5 min |
| Phase 5: Recruiter Tracking | 3 days | Enable recruiter profiling and quality scoring | Recruiter contacts auto-created, quality scores calculated |
| Phase 6: Full Production | Ongoing | All features active, monitoring, tuning | All success metrics met |

### 18.2 Phase 0: Infrastructure Setup

**Duration:** 2 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 0.1 | Create Google Cloud project and OAuth2 credentials | Engineering | Console at console.cloud.google.com |
| 0.2 | Configure Gmail OAuth2 in n8n | Engineering | Settings > Credentials > Google OAuth2 API |
| 0.3 | Complete OAuth2 consent flow (authorize chellamma.uk@gmail.com) | Candidate | One-time browser authorization |
| 0.4 | Run database migration (Section 13.13) | Engineering | All Module 5 tables + seed data |
| 0.5 | Configure Resend API key in n8n environment | Engineering | Environment variable RESEND_API_KEY |
| 0.5a | **Verify Resend domain (apiloom.io) with SPF, DKIM, and DMARC records** | Engineering | Add DNS records per Resend dashboard. Without this, notifications may land in spam and the entire urgent notification system fails silently. Consider using a subdomain (e.g., `notify.apiloom.io`) to isolate sending reputation. |
| 0.5b | **Add system notification address to sender exclusion list** | Engineering | Add `selvi-system@apiloom.io` to `email_sender_patterns` with `skip = true` to prevent recursive processing of the system's own notification emails |
| 0.6 | Verify Resend can send to chellamma.uk@gmail.com and confirm it lands in inbox (not spam) | Engineering | Send test notification. Check spam folder. If in spam, debug SPF/DKIM/DMARC configuration before proceeding. |
| 0.7 | Configure Claude API key in n8n environment | Engineering | Environment variable ANTHROPIC_API_KEY (may already exist from Module 1) |
| 0.8 | Import WF-EM-01 (Gmail Poller) into n8n | Engineering | Do not activate yet |
| 0.9 | Import SW-EM-01 (Email Preprocessing) into n8n | Engineering | Sub-workflow |
| 0.10 | Test Gmail polling manually (single execution) | Engineering | Verify emails are fetched and parsed |

**Exit Criteria:**
- Gmail OAuth2 token obtained and stored in n8n
- All database tables created successfully
- Resend can deliver emails to the candidate
- Manual Gmail poll returns emails correctly

### 18.3 Phase 1: Passive Monitoring

**Duration:** 5 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 1.1 | Activate WF-EM-01 (Gmail Poller) on cron schedule | Engineering | Start with every 15 min (conservative) |
| 1.2 | Import and activate WF-EM-02 (Classification Engine) | Engineering | Haiku-only initially, no Sonnet escalation |
| 1.3 | Monitor email_processing_log for errors | Engineering | Check daily |
| 1.4 | Manual review of 20 classified emails after day 2 | Engineering + Candidate | Calculate accuracy rate |
| 1.5 | Tune sender pattern database based on observed emails | Engineering | Add new patterns as discovered |
| 1.6 | Tune classification prompt if accuracy < 90% | Engineering | Adjust prompt wording, examples |
| 1.7 | Enable Sonnet escalation (confidence < 0.80) after day 3 | Engineering | Monitor escalation rate |
| 1.8 | Run calibration set after day 5 | Engineering | 50 reference emails classified |
| 1.9 | Document any email formats that Claude handles poorly | Engineering | Feed into Phase 2 tuning |

**Exit Criteria:**
- 50+ emails ingested and classified
- Classification accuracy >= 90% (manual review of 20 emails)
- No critical errors in email_processing_log
- Sender pattern database covers 60%+ of incoming emails
- Claude API cost within expected range

### 18.4 Phase 2: Classification + Labeling

**Duration:** 5 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 2.1 | Import WF-EM-04 (Gmail Labeling) | Engineering | |
| 2.2 | Run label creation (ensure all Job/* labels exist in Gmail) | Engineering | One-time setup |
| 2.3 | Activate WF-EM-04 on cron schedule | Engineering | |
| 2.4 | Increase WF-EM-01 polling to every 5 min (business hours) | Engineering | |
| 2.5 | Candidate reviews Gmail labels daily for correctness | Candidate | Report mislabeled emails |
| 2.6 | Fix mislabeled emails (update sender patterns or prompt) | Engineering | |
| 2.7 | Validate label application latency (< 10 min) | Engineering | Monitor timestamps |
| 2.8 | Test that labeling does not modify read/unread status | Engineering | Important for UX |
| 2.9 | Verify label counts match classification counts | Engineering | Reconciliation query |

**Exit Criteria:**
- All Gmail labels created and visible
- 95%+ of emails correctly labeled
- Label application within 10 minutes of email arrival
- No false labeling of non-job emails
- Candidate confirms labels are helpful for inbox organization

### 18.5 Phase 3: Data Extraction + Module Integration

**Duration:** 5 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 3.1 | Import WF-EM-03 (Data Extraction Pipeline) | Engineering | |
| 3.2 | Import SW-EM-02 (Module Integration Dispatcher) | Engineering | |
| 3.3 | Activate WF-EM-03 on cron schedule | Engineering | |
| 3.4 | Process backlog of classified-but-not-extracted emails | Engineering | One-time backfill |
| 3.5 | Manual review of 20 extracted records for accuracy | Engineering + Candidate | Check field correctness |
| 3.6 | Test Module 4 integration (if Module 4 is ready) | Engineering | Send test status updates |
| 3.7 | Test Module 1 integration (job alert parsing) | Engineering | Verify deduplication works |
| 3.8 | Test company name matching against Module 4 applications | Engineering | Fuzzy matching tuning |
| 3.9 | Test date/time extraction for interview invitations | Engineering | UK date format handling |
| 3.10 | Test ICS calendar parsing | Engineering | Use real calendar invite emails |
| 3.11 | Test ATS-specific extraction rules (Workday, Greenhouse, etc.) | Engineering | Use sample ATS emails |

**Exit Criteria:**
- 90%+ field extraction accuracy on manual review
- Module 4 status updates flowing correctly (if Module 4 is ready)
- Job alert parsing extracting individual job listings
- Date/time parsing handling UK formats correctly
- Company name matching producing correct application links

### 18.6 Phase 4: Notifications + Drafting

**Duration:** 3 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 4.1 | Import WF-EM-06 (Urgent Notification Dispatcher) | Engineering | |
| 4.2 | Import WF-EM-05 (Response Drafting Engine) | Engineering | |
| 4.3 | Import WF-EM-07 (Daily Summary Generator) | Engineering | |
| 4.4 | Test urgent notification for a simulated interview invitation | Engineering | Send test email, verify notification arrives within 5 min |
| 4.5 | Test response draft for a simulated interview invitation | Engineering | Verify draft appears in Gmail Drafts |
| 4.6 | Test daily summary generation | Engineering | Run manually, review format |
| 4.7 | Activate WF-EM-06 and WF-EM-05 on cron schedule | Engineering | |
| 4.8 | Activate WF-EM-07 on cron schedule (8:00 AM) | Engineering | |
| 4.9 | Candidate reviews first live notification and draft | Candidate | Feedback on tone, format, usefulness |
| 4.10 | Tune draft quality (remove AI phrases, adjust tone) | Engineering | Based on candidate feedback |
| 4.11 | Test notification throttling and quiet hours | Engineering | Verify no notifications during 10PM-7AM |

**Exit Criteria:**
- Interview invitation notification arrives within 5 minutes
- Draft responses created with appropriate tone
- Daily summary is comprehensive and readable
- Notification throttling works correctly
- Quiet hours enforced for non-critical notifications
- Candidate approves notification format and draft quality

### 18.7 Phase 5: Recruiter Tracking

**Duration:** 3 days

**Tasks:**

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 5.1 | Import WF-EM-08 (Recruiter Tracker) | Engineering | |
| 5.2 | Activate WF-EM-08 on cron schedule | Engineering | |
| 5.3 | Backfill recruiter contacts from existing classified emails | Engineering | One-time |
| 5.4 | Test recruiter deduplication | Engineering | Verify no duplicate entries |
| 5.5 | Test quality score calculation | Engineering | Review scores for known recruiters |
| 5.6 | Test stale conversation detection | Engineering | Verify correct flagging in daily summary |
| 5.7 | Test recruiter blacklist functionality | Engineering | Mark a test recruiter, verify behavior |
| 5.8 | Enable Sent folder monitoring | Engineering | Track outbound responses |
| 5.9 | Candidate reviews recruiter profiles | Candidate | Verify accuracy of extracted information |

**Exit Criteria:**
- Recruiter contacts auto-created from email
- Quality scores calculated and reasonable
- Stale conversations flagged in daily summary
- Sent folder monitoring tracking responses
- No duplicate recruiter entries

### 18.8 Phase 6: Full Production

**Duration:** Ongoing

**Tasks:**

| # | Task | Frequency | Notes |
|---|------|-----------|-------|
| 6.1 | Weekly classification accuracy audit | Weekly | Random sample of 20 emails |
| 6.2 | Weekly calibration run | Weekly | 50 reference emails |
| 6.3 | Claude API cost monitoring | Weekly | Ensure within budget |
| 6.4 | GDPR body purge verification | Weekly | Confirm purge running |
| 6.5 | Sender pattern database maintenance | As needed | Add new patterns |
| 6.6 | Classification prompt tuning | As needed | Based on accuracy audit results |
| 6.7 | OAuth2 token health monitoring | Daily (automated) | Alert on expiry |
| 6.8 | Stuck email detection | Continuous (automated) | Alert if emails stuck > 30 min |
| 6.9 | Module integration health check | Daily (automated) | Verify Module 4 updates flowing |
| 6.10 | Recruiter quality score recalibration | Monthly | Review and adjust scoring weights |

### 18.9 Rollback Plan

Each phase can be rolled back independently:

| Phase | Rollback Procedure | Impact |
|-------|-------------------|--------|
| Phase 1 (Polling + Classification) | Deactivate WF-EM-01 and WF-EM-02 in n8n | Stops email processing; no data loss |
| Phase 2 (Labeling) | Deactivate WF-EM-04 | Labels already applied remain; no new labels added |
| Phase 3 (Extraction + Integration) | Deactivate WF-EM-03 and SW-EM-02 | Stops Module 4 updates; candidate must update manually |
| Phase 4 (Notifications + Drafting) | Deactivate WF-EM-05, WF-EM-06, WF-EM-07 | Stops notifications and drafts; candidate checks email manually |
| Phase 5 (Recruiter Tracking) | Deactivate WF-EM-08 | Stops recruiter profiling; existing data retained |
| Full rollback | Deactivate all WF-EM-* workflows | System dormant; Gmail returns to normal manual use |

**Gmail Label Cleanup (if needed):**
```
-- Remove all Module 5 labels from Gmail
-- This is a destructive operation and removes labels from all labeled emails
-- Only execute if completely decommissioning Module 5

DELETE labels:
  Job/Applied, Job/Interview, Job/Interview/Upcoming, Job/Interview/Completed,
  Job/Rejected, Job/Recruiter, Job/Recruiter/Active, Job/Recruiter/Low-Priority,
  Job/Alert, Job/Alert/Processed, Job/Offer, Job/Follow-Up, Job/Follow-Up/Pending,
  Job/Follow-Up/Completed, Job/Marketing, Job/Referral, Job/Processed
```

### 18.10 Cost Estimates

**Monthly Operating Cost (Production):**

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Claude API (classification + extraction + drafting) | $2-5 USD (~GBP 1.60-4) | Conservative estimate at 300 emails/month |
| Resend API | $0 (free tier) | Free tier supports 3,000 emails/month; we send ~50 |
| Gmail API | $0 | Free (within standard quotas) |
| Additional Postgres storage | ~$0 | Negligible additional storage on existing instance |
| Additional n8n compute | ~$0 | Runs on existing n8n instance |
| **Total** | **~GBP 2-4/month** | |

**Comparison to Module 1 costs:** Module 1 costs GBP 60/month (primarily SerpAPI). Module 5 adds less than 10% to the total system cost.

---

## Appendix A: Email Classification Decision Tree

```
Is the email from a known sender pattern?
├── Yes (confidence >= 0.9)
│   ├── job_alert -> CLASSIFY as job_alert
│   ├── marketing -> CLASSIFY as marketing
│   ├── delivery_failure -> CLASSIFY as delivery_failure
│   └── ats_communication -> Continue to content analysis
│
└── No / Low confidence / ATS communication
    │
    Does the subject line match a heuristic pattern?
    ├── Yes (confidence >= 0.85)
    │   └── CLASSIFY with heuristic result
    │
    └── No
        │
        Send to Claude Haiku
        ├── Confidence >= 0.80
        │   └── ACCEPT Haiku classification
        │
        └── Confidence < 0.80
            │
            Send to Claude Sonnet (with full context)
            ├── Confidence >= 0.60
            │   └── ACCEPT Sonnet classification
            │
            └── Confidence < 0.60
                └── ACCEPT Sonnet classification + FLAG for manual review
```

---

## Appendix B: Gmail Label Color Reference

| Label | Background | Text | Hex (BG) | Rationale |
|-------|-----------|------|----------|-----------|
| Job | Blue | White | #4986e7 | Parent label, professional blue |
| Job/Applied | Purple | White | #a479e2 | Applications in progress |
| Job/Interview | Pink | White | #f691b2 | Attention-drawing for interviews |
| Job/Interview/Upcoming | Red | White | #fb4c2f | Urgent: upcoming interview |
| Job/Interview/Completed | Light Purple | White | #b99aff | Completed, less urgent |
| Job/Rejected | Grey | Black | #cccccc | Muted: no action needed |
| Job/Recruiter | Orange | White | #ffad46 | Warm: relationship building |
| Job/Recruiter/Active | Orange | White | #ffad46 | Active conversation |
| Job/Recruiter/Low-Priority | Light Lavender | Black | #e3d7ff | Deprioritized |
| Job/Alert | Green | Black | #89d3b2 | Informational: job alerts |
| Job/Alert/Processed | Light Blue | Black | #c9daf8 | Processed: no action |
| Job/Offer | Dark Green | White | #16a765 | Positive: offer received |
| Job/Follow-Up | Yellow | Black | #fbe983 | Action needed |
| Job/Follow-Up/Pending | Yellow | Black | #fbe983 | Action pending |
| Job/Follow-Up/Completed | Light Blue | Black | #c9daf8 | Action completed |
| Job/Marketing | Light Lavender | Black | #e3d7ff | Low priority: marketing |
| Job/Referral | Teal | White | #42d692 | Personal referral |
| Job/Processed | White | Black | #ffffff | Internal: hidden label |

---

## Appendix C: ATS Email Template Patterns

### Workday

**Acknowledgment Template:**
```
Subject: "Application Received - {{ role_title }}"
Body pattern: "Thank you for applying to the {{ role_title }} position at {{ company_name }}."
Reference number: Usually in format "WD-XXXXXX" or "REQ-XXXXXXX"
Sender: noreply@myworkdayjobs.com or noreply@{{ company_subdomain }}.myworkday.com
```

**Rejection Template:**
```
Subject: "Update on your application" or "Application Status Update"
Body pattern: "Thank you for your interest in {{ company_name }}. After careful review..."
Key phrases: "not moving forward", "other candidates", "encourage you to apply for future"
```

**Interview Template:**
```
Subject: "Interview Invitation" or "Next Steps in Your Application"
Body pattern: "We would like to invite you for an interview..."
Often includes Calendly or internal scheduling link
```

### Greenhouse

**Acknowledgment Template:**
```
Subject: "Application Received for {{ role_title }}"
Body pattern: "Thank you for applying to {{ role_title }} at {{ company_name }}."
Sender: noreply@greenhouse.io or {{ company_name }}-noreply@greenhouse.io
```

**Rejection Template:**
```
Subject: "Your application to {{ company_name }}"
Body pattern: "Unfortunately, we have decided to move forward with other candidates."
Often highly customized per company
```

### Lever

**Acknowledgment Template:**
```
Subject: "Your application to {{ company_name }}"
Body pattern: "Your application has been received."
Sender: noreply@hire.lever.co
```

### iCIMS / Taleo / Oracle

**Common Patterns:**
```
Sender: typically company-branded email, not recognizable by domain
Subject: varies widely by company configuration
Body: HTML-heavy with company branding, legal disclaimers
Key identifiers: "Powered by iCIMS" or "Powered by Taleo" in footer
```

---

## Appendix D: Sample Classification Calibration Set

A representative subset of the 50 calibration emails:

| # | Subject | From | Expected Classification | Notes |
|---|---------|------|------------------------|-------|
| 1 | "Your application has been received" | noreply@workday.com | acknowledgment | Standard ATS ack |
| 2 | "Interview Invitation - L&D Manager" | hr@company.co.uk | interview_invite | Clear interview invite |
| 3 | "New jobs matching your alert" | noreply@linkedin.com | job_alert | LinkedIn daily digest |
| 4 | "Exciting opportunity for you!" | recruiter@agency.co.uk | recruiter_outreach | Recruiter cold email |
| 5 | "Unfortunately we are unable to..." | recruitment@university.ac.uk | rejection | Post-application rejection |
| 6 | "Could you provide references?" | hr@company.com | follow_up_request | Reference request |
| 7 | "Offer of Employment" | hr@company.co.uk | offer | Formal offer |
| 8 | "5 tips for your job search" | marketing@linkedin.com | marketing | Marketing newsletter |
| 9 | "Re: Your application - next steps" | hiring.manager@company.com | interview_invite | Interview disguised as "next steps" |
| 10 | "Can we arrange a call to discuss?" | recruiter@agency.com | interview_invite | Informal interview request |
| 11 | "Undelivered Mail Returned to Sender" | MAILER-DAEMON@google.com | delivery_failure | Bounce |
| 12 | "Fwd: Head of L&D - immediate start" | friend@gmail.com | recruiter_outreach (referral) | Forwarded job posting |
| 13 | "Application Status: Under Review" | noreply@greenhouse.io | acknowledgment | ATS status update (still ack) |
| 14 | "We'd love to discuss this role further" | recruiter@agency.co.uk | interview_invite | Recruiter arranging call (interview, not outreach) |
| 15 | "Salary trends in L&D 2026" | newsletter@cipd.co.uk | marketing | Career newsletter |

---

## Appendix E: Glossary

| Term | Definition |
|------|-----------|
| ATS | Applicant Tracking System -- software used by employers to manage job applications (e.g., Workday, Greenhouse, Lever, Taleo, iCIMS) |
| BST | British Summer Time (UTC+1), in effect from last Sunday in March to last Sunday in October |
| Circuit Breaker | Software pattern that stops calling a failing service after repeated failures, preventing cascade failures |
| Claude Haiku | Anthropic's fastest, most cost-effective AI model -- used for standard email classification |
| Claude Sonnet | Anthropic's balanced AI model -- used for ambiguous email classification (escalation from Haiku) |
| Dedup Hash | MD5 hash of normalized key fields, used to detect duplicate entries |
| GDPR | General Data Protection Regulation -- EU/UK data protection law |
| GMT | Greenwich Mean Time (UTC+0), in effect from last Sunday in October to last Sunday in March |
| ICS | iCalendar format -- standard file format for calendar events (MIME type: text/calendar) |
| n8n | Open-source workflow automation platform, self-hosted at n8n.deploy.apiloom.io |
| OAuth2 | Open standard for access delegation -- used by Gmail API for authentication |
| Resend | Transactional email service used for sending notifications |
| SAR | Subject Access Request -- GDPR right to know what personal data is stored |
| Sender Pattern | Pre-configured rule mapping email addresses/domains to classifications without AI processing |
| Thread | A Gmail conversation thread -- multiple related messages grouped by subject and references |

---

*End of Module 5: Email Management & Intelligence System PRD v1.0*

---

## 19. 50-Round Critical Roleplay Evaluation (v1)

**Evaluation Date:** 2026-03-29
**Evaluator Profile:** Top 0.1% cross-disciplinary panel (5 personas, 10 rounds each)
**PRD Version Evaluated:** v1.0

---

### Persona 1: The Candidate (Selvi) -- Rounds 1-10

**Perspective:** Will it correctly classify my emails? Will I miss urgent ones? Is auto-reply safe?

---

**Round 1: Interview invitation buried in a thread that was previously classified as acknowledgment**

*Concern:* The PRD describes Failure Mode 3 (lost in threading) as a problem to solve, but the classification pipeline classifies individual emails, not thread state transitions. If I received an acknowledgment last week from company X and it was classified and labeled `Job/Applied`, and then a reply arrives in the same thread saying "we'd like to invite you for an interview," the system classifies the new email correctly -- but does it re-label the entire thread? The label `Job/Applied` on the thread is now misleading.

*Analysis:* Section 9.5 states labels are applied at the message level, not the thread level. However, Gmail's web interface shows label filters at the thread level by default. If the first message in a thread has `Job/Applied` and the second has `Job/Interview/Upcoming`, a user viewing the thread in Gmail sees both labels on the thread. This is actually correct behavior. But the PRD does not address what happens to the `Job/Applied` label on the first message -- should it be retained or removed? Having both labels on a thread is confusing: is this an active interview or just an acknowledged application? The PRD mentions adding the parent `Job/Interview` label to the thread when it contains an interview invitation (Section 9.5), but does not describe removing the prior `Job/Applied` label from earlier messages. For a single-user system this is a minor UX annoyance rather than a critical gap, but it shows incomplete thinking about label lifecycle within threads.

*Score:* 6/10

*Recommendations:*
1. Define a label precedence rule: when a thread escalates (Applied -> Interview -> Offer), remove lower-precedence labels from all messages in the thread
2. Add a label update step in WF-EM-04 that checks thread-level label consistency
3. Document the expected Gmail UX when viewing multi-status threads

---

**Round 2: False negative on an interview invitation that uses unusual phrasing**

*Concern:* The classification prompt lists explicit rules like "an email asking for 'available times' is an interview_invite." But UK employers frequently use indirect phrasing: "It would be great to have a brief conversation about next steps" or "We'd like to take this forward and explore your candidacy." These are functionally interview invitations but use no trigger words from the prompt.

*Analysis:* The classification pipeline relies on Claude to understand email intent, not just keyword matching. Claude should handle indirect phrasing well. However, the subject line heuristic in Section 7.2 Step 2 checks for keywords like "interview" and "invite," meaning the fast path will miss these. They will go to Claude Haiku, which is good. The real risk is at the confidence threshold: if Claude Haiku returns 0.78 confidence on an ambiguous phrasing, it escalates to Sonnet. But what if Haiku returns 0.82 and classifies it as `recruiter_outreach` instead of `interview_invite`? An above-threshold wrong classification is accepted with no escalation. The PRD has a calibration set of 50 emails (Appendix D), and item 14 ("We'd love to discuss this role further") is correctly expected to be `interview_invite`. But 50 calibration emails is thin coverage for the variety of UK business English. The weekly manual audit of 20 emails is the real safety net here, but that catches errors after the fact, not before the interview deadline passes.

*Score:* 6/10

*Recommendations:*
1. Expand the calibration set to 100+ emails with heavy emphasis on ambiguous interview/recruiter boundary cases
2. Add a safety rule: any email from an employer (not a recruiter) where the candidate has an active application should be escalated to Sonnet regardless of Haiku confidence
3. Consider a "watchlist" of companies with active applications that triggers lower confidence thresholds for classification

---

**Round 3: Auto-drafted response contains wrong interview date or time**

*Concern:* The system extracts interview date/time and creates a confirmation draft. If the extraction is wrong -- say, parsing "2nd April" as April 2 but the email actually says "Tuesday 2nd April" and April 2 is actually a Wednesday in 2026 -- the draft confirms the wrong date. I review the draft, see it looks professional, and send it. Now I have confirmed a date that does not match what the employer said.

*Analysis:* Section 8.6 includes date parsing logic that handles "2nd April 2026" but does not cross-validate day-of-week against the date. In 2026, April 2nd is a Thursday, not a Tuesday. If an employer writes "Tuesday 2nd April," that is a contradiction -- either the day or the date is wrong. The extraction pipeline should flag this inconsistency. However, the extraction prompt (Section 8.2) instructs Claude to "extract only information explicitly stated in the email" but does not instruct it to validate date/day-of-week consistency. The draft confirmation prompt (Section 11.2) restates the date and time without validation. The draft quality check (Section 11.4) checks for AI phrases and length but does not validate that extracted dates are logical or consistent. This is a real risk. A candidate reviewing a professional-looking draft may not catch a date discrepancy, especially if she is reviewing multiple drafts quickly.

*Score:* 5/10

*Recommendations:*
1. Add a date/day-of-week cross-validation step in the extraction pipeline -- flag any mismatch
2. When a date inconsistency is detected, add a prominent warning to the draft: "NOTE: The email mentions [Tuesday] but [2 April 2026] is a [Thursday]. Please verify the correct date before sending."
3. Add a calendar availability check against Module 6 before creating the draft
4. Include the original email snippet (date/time portion) in the notification so the candidate can cross-check

---

**Round 4: Urgent notification sent during quiet hours for an interview invitation that arrived overnight**

*Concern:* If a US-based employer sends an interview invitation at 11:30 PM UK time, the system polls at 11:30 PM (off-hours, 15-min interval). The email is ingested. Classification runs at the next 5-min mark. The notification dispatcher runs every 3 minutes. Quiet hours are 10 PM to 7 AM. But interview_invite is exempt from quiet hours (Section 12.4). So I get woken up at 11:35 PM with an urgent notification for an interview that does not need a response until business hours the next day.

*Analysis:* Section 12.4 explicitly exempts `interview_invite` and `offer` from quiet hours. The rationale is that these are too important to delay. But there is a difference between "too important to miss" and "needs immediate attention at midnight." Most UK interview invitations expect a response within 24-48 hours (Section 2.1), not within minutes. Waking the candidate at midnight for an email she cannot act on until morning degrades her sleep and, by extension, her interview preparation. The PRD does not distinguish between "an interview invitation that needs same-day response" and "a standard interview invitation." The response_deadline field could inform this decision, but the notification is sent before extraction is complete -- WF-EM-06 checks for urgent unnotified emails in states including 'extracted', but also 'classified'. The notification fires before the response_deadline is known.

*Score:* 5/10

*Recommendations:*
1. During quiet hours, even for exempt categories, hold the notification until 7 AM unless the response_deadline is within 4 hours
2. Add a configurable "truly urgent" vs "important but can wait" distinction for interview invitations
3. If the notification fires during quiet hours, use a different subject prefix: "[Interview -- Morning Review]" instead of "[URGENT: Interview]"
4. Wait for extraction to complete before sending notifications, so the response_deadline can inform urgency

---

**Round 5: Missing an offer email because it was classified as acknowledgment**

*Concern:* Some informal offers are phrased ambiguously: "We'd like to move forward with you for the Senior L&D Manager role. Could you confirm your interest and availability for a start date?" This could be read as an offer or as a follow-up request. If the system classifies it as `follow_up_request` or `acknowledgment`, the candidate misses the most important email of her job search.

*Analysis:* The PRD states offer detection must be 95%+ accurate and "false negatives are unacceptable for offers" (US-507). The classification prompt includes `offer` with sub-categories `formal`, `informal`, and `conditional`. The prompt rule states forwarded job postings should be classified as `recruiter_outreach` but does not include a similar safety rule for offers. There is no escalation rule that says "if the email mentions salary, start date, or employment terms, escalate to Sonnet regardless of Haiku confidence." The calibration set (Appendix D, item 7) includes only one offer example ("Offer of Employment") which is a formal, unambiguous case. Informal offers -- the most dangerous type to miss -- are underrepresented. The safety net (daily summary) would catch a misclassified offer, but only the next morning. If the offer has a 24-hour response window, that is too late.

*Score:* 5/10

*Recommendations:*
1. Add a safety escalation rule: any email mentioning "offer," "salary," "start date," or "employment terms" must go to Sonnet regardless of Haiku confidence
2. Add 5+ informal offer examples to the calibration set
3. Consider a "double-classification" for high-stakes categories: if Haiku says `acknowledgment` but the email contains offer-related keywords, re-classify with Sonnet
4. Add a keyword-based alert bypass: certain keywords trigger notification regardless of classification

---

**Round 6: Draft response goes to wrong email thread**

*Concern:* If I applied to two roles at the same company (e.g., "L&D Manager" and "Head of Organisational Development" at Acme Corp), and I receive interview invitations for both, the system creates two drafts. But if the company uses the same recruiter email address for both roles, Gmail may thread them together. The draft could be created as a reply to the wrong email in the thread, confirming the wrong role.

*Analysis:* The draft creation function (Section 11.3) uses `threadId` from the original email to place the draft in the correct thread. However, the draft content references the company and role from extracted data. If extraction correctly identified the role for each email, the draft content will be correct. The threading risk is that Gmail's thread display shows the draft under the wrong visual context. The deeper risk is in extraction: if company name matching (Section 8.7) matches both interview invitations to the same application in Module 4, the extracted role_title could be wrong for one of them. The matching function uses fuzzy matching with a threshold of 50 points, but two roles at the same company would both score high on company match (50 points), and the role match would differentiate them. If one role title is slightly different in the email than in Module 4 (e.g., "L&D Manager" vs "Learning & Development Manager"), the fuzzy match might pick the wrong one.

*Score:* 6/10

*Recommendations:*
1. When multiple applications exist for the same company, require higher match thresholds and include role title as a mandatory match component
2. Add a warning in the draft when the company has multiple active applications: "Note: You have multiple applications at [Company]. Please verify this draft refers to the correct role."
3. Include the extracted role title prominently in the notification email so the candidate can verify before sending the draft

---

**Round 7: System processing delay causes 5-minute SLA to be missed**

*Concern:* The SLA is "interview invitation surfaced within 5 minutes." But the pipeline is sequential: poll (5 min interval) -> classify (5 min cron) -> extract (5 min cron) -> notification (3 min cron). In the worst case, an email arrives at minute 0:01 after a poll. Next poll at minute 5:00. Classification at minute 10:00. Extraction at minute 15:00. Notification check at minute 18:00. That is 18 minutes, not 5.

*Analysis:* Section 5.2 describes schedule staggering within a 5-minute cycle: poll at minute 1, classify at minute 2, extract at minute 3, label at minute 4, notifications at minute 0. This staggering means that in a single cycle, an email polled at minute 1 would be classified at minute 2 of the same cycle -- but only if the classification workflow picks it up in the same 5-minute window. In practice, n8n cron triggers are not perfectly synchronized; there is execution time for each workflow. A realistic best case is 1 cycle (5 minutes from poll to notification). But worst case, if the email arrives just after a poll, it waits until the next poll (5 minutes), then classification runs in the next cycle (another 5 minutes), then extraction (another 5 minutes), then notification (another 3 minutes). That is 13-18 minutes. The PRD sets a "median < 5 minutes" target, which allows 50% of emails to exceed this. The p90 latency is not specified. For interview invitations, even a median of 5 minutes is acceptable (the response deadline is hours, not minutes), but the PRD sets this as a hard target.

*Score:* 6/10

*Recommendations:*
1. Change notification dispatcher to check for urgent emails in ANY status (including 'ingested' and 'classified'), not just post-extraction
2. For interview_invite and offer, implement a "fast track" that skips the normal pipeline queue and processes immediately within WF-EM-01
3. Set p90 latency target (e.g., < 15 minutes) in addition to median
4. Consider event-driven triggering instead of cron for the urgent notification check

---

**Round 8: Recruiter blacklist is too blunt an instrument**

*Concern:* The blacklist (US-513) is binary: a recruiter is either blacklisted or not. But recruiter quality is nuanced. A recruiter might send 4 irrelevant roles and then 1 excellent one. If I blacklisted them after the third irrelevant role, I would miss the excellent one. The system has a quality score (0-100) but the blacklist is a separate boolean flag that overrides everything.

*Analysis:* Section 10.1 shows that D-tier roles lead to "consider blacklist if pattern persists." Section 10.2 calculates a quality score. But the blacklist in Section 13.5 is a manual action (`status = 'blacklisted'`). There is no automatic blacklisting based on quality score, which is good. But there is also no partial suppression -- it is all-or-nothing. A recruiter with a quality score of 25 gets the same notification treatment as one with a score of 75. The notification system (Section 12.1) only differentiates "A-tier role" (immediate notification) vs "B-tier role" (daily summary only). It does not factor in the recruiter's quality score. A new email from a quality-25 recruiter proposing a B-tier role gets the same treatment as one from a quality-75 recruiter proposing a B-tier role. The quality score informs the candidate's long-term relationship decisions but does not affect real-time system behavior (beyond blacklisting).

*Score:* 6/10

*Recommendations:*
1. Use quality score to modulate notification behavior: recruiters with score < 30 get daily-summary-only treatment for all roles, not just B-tier
2. Add a "probation" status between active and blacklisted where the recruiter's roles are processed but notifications are suppressed
3. Allow partial blacklisting: "notify me only for A-tier roles from this recruiter"
4. Auto-suggest blacklisting when quality score drops below 15 for 3 consecutive months

---

**Round 9: Daily summary arrives at 8 AM but contains stale information**

*Concern:* The daily summary is generated at 8:00 AM and covers the last 24 hours. If an interview invitation arrived at 2 PM yesterday and I already responded to it via the urgent notification, the daily summary still lists it under "URGENT ITEMS." This is noise. Worse, if I rejected a recruiter's role yesterday afternoon, the daily summary still shows that recruiter under "AWAITING YOUR RESPONSE" because the sent folder is only polled every 30 minutes and the summary query checks `last_received_at > last_sent_at`.

*Analysis:* The daily summary query (Section 14.7) aggregates all emails from the last 24 hours without filtering by current action status. An interview invitation that was already confirmed still appears as "INTERVIEW" in the summary. A recruiter outreach that was already declined still appears in "AWAITING YOUR RESPONSE" if the response was sent recently and the sent-folder poller has not yet run. The summary lacks a concept of "already actioned." The email_drafts table tracks whether a draft was created (`status: 'created'`) but not whether the candidate sent it. The system cannot know whether the candidate has acted on a notification unless it monitors the sent folder, which happens every 30 minutes. For the 8 AM summary, the last sent-folder poll would have been at 7:30 AM, so most responses would be captured. But the summary still does not filter out emails that already have corresponding sent responses.

*Score:* 5/10

*Recommendations:*
1. Cross-reference the daily summary with sent-folder data: exclude items where a response was sent
2. Add an "already actioned" indicator to interview invitations in the summary
3. Mark the draft status (sent by candidate, still pending, discarded) in the summary
4. Separate the summary into "New items" and "Previously flagged items still pending action"

---

**Round 10: System classifies a personal email as job-related and processes it**

*Concern:* The anti-goal (Section 3.4) says the system should ignore personal emails. But the boundary between personal and job-related is blurry. A former colleague emails saying "I saw a role at [company] and thought of you" -- this is personal correspondence that is also job-related. The system correctly processes it (US-522, forwarded job emails). But what about a personal email from a friend saying "How's the job search going? Any interviews lined up?" -- this is personal, mentions job search, and could be classified as `not_job_related` or as `follow_up_request` if Claude misinterprets it.

*Analysis:* The classification prompt (Section 7.3) includes `not_job_related` as a category with sub-categories `personal`, `spam`, `other`. Claude should correctly identify a friend asking about the job search as personal, not as a follow-up request. But the boundary is genuinely ambiguous for emails from contacts who are both personal connections and professional network members. The sender pattern database (Section 6.5) only covers known job board and ATS addresses -- there is no "known personal contact" blocklist. Every email from an unknown sender goes through Claude classification. For personal emails, this is a privacy concern: the email body is sent to Anthropic's API for classification. The PRD notes (Section 17.5) that "No email content from employers or recruiters is shared with anyone other than the candidate herself" and that "Anthropic receives email text for classification via their API" -- but this includes personal emails that happen to pass through the pipeline before being classified as `not_job_related`.

*Score:* 6/10

*Recommendations:*
1. Add a "known personal contacts" blocklist (configurable list of email addresses that should never be processed by Claude)
2. Implement a pre-filter: if the sender is in the candidate's Google Contacts and not in any recruiter/employer database, skip classification
3. For emails classified as `not_job_related`, purge the body immediately rather than after 7 days
4. Consider sending only the subject line and sender to Claude for an initial "is this job-related?" check before sending the full body

---

#### Persona 1 Summary: The Candidate (Selvi)

| Round | Concern | Score |
|-------|---------|-------|
| 1 | Thread label lifecycle confusion | 6/10 |
| 2 | False negative on indirect interview invitations | 6/10 |
| 3 | Wrong date/time in auto-drafted confirmation | 5/10 |
| 4 | Quiet hours bypass for non-urgent interview invitations | 5/10 |
| 5 | Informal offer misclassified | 5/10 |
| 6 | Draft sent to wrong role at same company | 6/10 |
| 7 | Processing delay exceeds 5-minute SLA | 6/10 |
| 8 | Recruiter blacklist too blunt | 6/10 |
| 9 | Daily summary contains stale information | 5/10 |
| 10 | Personal email privacy breach via classification | 6/10 |
| **Average** | | **5.6/10** |

**Top 3 Issues (Candidate Perspective):**
1. **Wrong date/time in auto-drafted confirmation (Round 3):** Sending an incorrect interview confirmation is a candidate-damaging error. The lack of date/day-of-week validation is a real gap.
2. **Informal offer misclassified (Round 5):** Missing an offer is the single worst failure mode. The calibration set has insufficient informal offer coverage.
3. **Daily summary staleness (Round 9):** A summary that does not reflect already-actioned items is noise, not signal. Undermines trust in the system.

---

### Persona 2: Technical Architect / n8n Expert -- Rounds 11-20

**Perspective:** Gmail API limits, OAuth2 token refresh, polling vs push, ARM64 compatibility, n8n-specific concerns.

---

**Round 11: Gmail API `after:` query uses timestamps, not message IDs -- risk of missed or duplicate emails**

*Concern:* Section 6.3 uses `after:{{ lastPollTimestamp }}` to fetch new messages. Gmail's `after:` operator uses date (YYYY/MM/DD) or epoch seconds, not a precise timestamp. If the system polls at 10:00:00 and sets lastPollTimestamp to that time, and Gmail receives an email at 09:59:59 that was not indexed yet, the next poll with `after:10:00:00` will miss it. Conversely, emails received at the boundary might appear in two consecutive polls.

*Analysis:* Gmail's search query `after:` is documented as using epoch seconds, but Gmail's internal indexing is not instantaneous. An email received at 09:59:58 might not appear in the index until 10:00:02. The first poll at 10:00:00 would miss it. The next poll at 10:05:00 with `after:10:00:00` would also miss it if the internal timestamp is 09:59:58. The `ON CONFLICT (gmail_message_id) DO NOTHING` clause prevents duplicates, which is good. But the missed-email problem is more serious. The PRD also uses `-label:Job-Processed` to exclude already-processed emails, which provides a secondary dedup mechanism. However, the `after:` window is the primary filter, and if an email falls through this window, the `-label:Job-Processed` filter does not help because the email was never processed. A safer approach is to use Gmail's `historyId` mechanism (via `users.history.list`) which tracks changes since a specific history ID and guarantees no gaps.

*Score:* 5/10

*Recommendations:*
1. Switch from `after:` timestamp query to Gmail's History API (`users.history.list` with `startHistoryId`) which provides gap-free change tracking
2. If keeping timestamp-based polling, subtract 60 seconds from the stored timestamp to create an overlap window (rely on `ON CONFLICT` for dedup)
3. Add a periodic "full reconciliation" poll (e.g., daily at 3 AM) that fetches all unprocessed emails from the last 7 days to catch any that slipped through
4. Log the historyId from each poll response for debugging

---

**Round 12: OAuth2 token refresh race condition in n8n**

*Concern:* Multiple workflows (WF-EM-01 through WF-EM-08) share the same Gmail OAuth2 credential in n8n. If two workflows trigger simultaneously and both find the access token expired, they could both attempt to refresh the token. OAuth2 refresh tokens can be single-use (Google sometimes enforces this). If workflow A refreshes the token and gets a new access token + refresh token, and workflow B simultaneously refreshes with the old refresh token, the second refresh may invalidate the first.

*Analysis:* n8n's credential system handles OAuth2 token refresh internally, and n8n is designed to serialize token refreshes through its credential store. This is not typically a problem in n8n because the credential store is shared and n8n's internal logic handles concurrent refresh. However, the PRD does not document this reliance on n8n's internal token management. The workflow lock mechanism (Section 14.1) only applies to WF-EM-01, not to other workflows that also call the Gmail API (WF-EM-04 for labeling, WF-EM-05 for drafts, WF-EM-08 for sent folder monitoring). If multiple workflows call the Gmail API within a narrow window and the token has expired, n8n should handle the serialization. But "should" is not "guaranteed." In self-hosted n8n on ARM64, edge cases in credential handling have been reported. The PRD should document the expected behavior and add a defensive check.

*Score:* 6/10

*Recommendations:*
1. Add a Gmail token health check at the start of each workflow that calls the Gmail API (not just WF-EM-01)
2. Configure n8n's OAuth2 credential to use "offline" access type to ensure refresh tokens are always available
3. Add a monitoring alert if token refresh fails more than once in an hour
4. Consider a centralized "Gmail API Gateway" sub-workflow that all workflows call through, serializing Gmail API access

---

**Round 13: n8n cron scheduling density and execution overlap**

*Concern:* The system runs 8 workflows on cron schedules. WF-EM-06 runs every 3 minutes, WF-EM-01/02/03/04 run every 5 minutes, WF-EM-05 every 10 minutes, WF-EM-07 daily, WF-EM-08 every 30 minutes. On a CAX31 with 8 vCPU ARM and 16GB RAM, n8n is sharing resources with the rest of the Selvi Job App system. At peak, multiple workflows could be executing simultaneously, especially if one workflow takes longer than expected (e.g., Claude API latency spike).

*Analysis:* Section 5.2 describes schedule staggering (workflows start at different minutes within the 5-minute cycle), which is good. But n8n's cron implementation does not guarantee that a previous execution has finished before the next trigger fires. The workflow lock in WF-EM-01 prevents duplicate ingestion runs, but WF-EM-02 through WF-EM-06 do not have similar locks. If WF-EM-02 (classification) takes 6 minutes due to Claude API latency, the next trigger fires while the previous execution is still running. Both executions query for unclassified emails; both might pick up the same emails; both might attempt to insert into email_classifications, causing unique constraint violations (which the `UNIQUE (email_id)` constraint would catch, but with error noise). The PRD should add workflow locks to all stateful workflows, not just WF-EM-01.

*Score:* 5/10

*Recommendations:*
1. Add workflow locks (same pattern as WF-EM-01) to WF-EM-02 through WF-EM-06
2. Add a `FOR UPDATE SKIP LOCKED` clause to the SELECT queries that pick up emails for processing, so concurrent executions do not process the same emails
3. Set n8n execution timeout to 4 minutes for 5-minute-interval workflows (kill long-running executions before the next trigger)
4. Monitor n8n execution queue depth and alert if it exceeds 5 pending executions

---

**Round 14: Polling approach vs Gmail Push Notifications**

*Concern:* The entire architecture is based on polling (cron-driven). Gmail offers Push Notifications via Google Cloud Pub/Sub (`users.watch`) which sends a notification within seconds of a new email arriving. This would reduce the interview invitation detection latency from 5+ minutes to under 30 seconds. The PRD does not mention or evaluate push notifications at all.

*Analysis:* Gmail Push Notifications require: (1) a Google Cloud Pub/Sub topic, (2) a webhook endpoint accessible from the internet, (3) the n8n instance to receive and process webhook events. The n8n instance is behind Dokploy at deploy.apiloom.io, which likely has a public HTTPS endpoint. n8n supports webhook triggers natively. Switching to push would eliminate the polling infrastructure entirely and provide near-real-time email detection. The reasons the PRD might have chosen polling over push: simpler implementation, no Pub/Sub cost (though it is negligible), no webhook security concerns. But these are implementation convenience tradeoffs, not architectural decisions documented in the PRD. The PRD should at least acknowledge push notifications as an alternative and explain why polling was chosen. For a system where the stated #1 goal is "never miss an interview invitation," polling is a suboptimal architecture.

*Score:* 5/10

*Recommendations:*
1. Add an "Architecture Decision Record" section explaining why polling was chosen over push notifications
2. Plan for push notification migration in v2.0 as the primary detection mechanism
3. As an interim, reduce business-hours polling to every 2 minutes for the inbox (keep 5 minutes for classification/extraction)
4. Implement Gmail `users.watch` with Pub/Sub as a Phase 7 enhancement

---

**Round 15: ARM64 compatibility of n8n Code nodes using cheerio/JSDOM**

*Concern:* Section 5.4 specifies "n8n Code node (cheerio/JSDOM)" for HTML processing. The server is a Hetzner CAX31 ARM64 machine. cheerio and JSDOM are JavaScript libraries that should work on ARM64, but JSDOM has native dependencies (canvas, etc.) that may not compile cleanly on ARM64 Linux. The ICS parsing uses "ical.js" which is pure JavaScript and should be fine.

*Analysis:* n8n's Code node runs JavaScript within n8n's Node.js runtime. The built-in modules available in n8n Code nodes are limited -- cheerio and JSDOM are not included by default. They would need to be installed as npm packages in the n8n Docker container. On ARM64, the standard npm packages for cheerio (which depends on parse5 and htmlparser2, both pure JS) should work fine. JSDOM depends on canvas (optional native addon) which may fail to compile on ARM64 but is not required for basic DOM parsing. However, the PRD's HTML stripping code (Section 6.4) uses regex-based stripping, not cheerio or JSDOM. There is a contradiction: the tech stack says "cheerio/JSDOM" but the actual code uses regex. If the implementation follows the code shown, there is no cheerio/JSDOM dependency to worry about. But if the implementation switches to cheerio for job alert parsing (Section 8.3), the ARM64 compatibility needs testing.

*Score:* 7/10

*Recommendations:*
1. Clarify whether HTML processing uses regex (as shown in code) or cheerio/JSDOM (as stated in tech stack)
2. If cheerio is needed, test it explicitly in the ARM64 Docker environment before Phase 0
3. Consider using n8n's built-in HTML Extract node instead of custom Code nodes for basic HTML parsing
4. Pin specific versions of any npm dependencies and document the installation procedure

---

**Round 16: Database connection pooling and concurrent workflow access**

*Concern:* Multiple n8n workflows (8+) access Postgres concurrently. n8n's Postgres node creates a new connection per execution by default. With workflows running every 3-5 minutes, and each workflow making 5-15 database queries, peak concurrent connections could exceed the Postgres default `max_connections` (100). On a shared server running Module 1-5 databases, connection exhaustion is a real risk.

*Analysis:* n8n's Postgres node does support connection pooling when configured correctly, but this is not always the default. The PRD does not specify Postgres connection configuration. Each workflow execution in n8n creates its own credential context. If 5 workflows execute simultaneously, each making 10 database calls, that is 50 near-simultaneous connections (though n8n likely reuses connections within a single execution). The Postgres instance is shared with Modules 1-4, which have their own workflows and connection needs. The PRD should specify the expected connection profile and ensure the Postgres instance is configured to handle it. With email processing adding 8 new workflows to the existing n8n workload, connection overhead is non-trivial.

*Score:* 6/10

*Recommendations:*
1. Specify Postgres `max_connections` and `shared_buffers` configuration appropriate for the combined Module 1-5 workload
2. Configure n8n's Postgres credential to use connection pooling with a pool size of 5-10
3. Add a database connection count to the monitoring dashboard
4. Consider using PgBouncer as a connection pooler between n8n and Postgres

---

**Round 17: No idempotency guarantees in the extraction pipeline**

*Concern:* If WF-EM-03 processes an email, inserts data into `email_extracted_data`, calls SW-EM-02 to update Module 4, and then fails before updating the email status to `'extracted'`, the next run of WF-EM-03 will pick up the same email again. The extraction will be re-run, and SW-EM-02 will attempt to update Module 4 again. The `UNIQUE (email_id)` constraint on `email_extracted_data` prevents duplicate extraction records, but Module 4 updates are UPDATE statements that are idempotent in value (setting the same status again) but not in side effects (they might trigger Module 4 workflows or notifications a second time).

*Analysis:* The pipeline status model (`ingested -> classified -> extracted -> labeled -> draft_created -> completed`) provides a simple state machine, but the transitions are not atomic. Between inserting extraction data and updating the status, there is a window where a crash or timeout causes the email to be re-processed. The Module 4 UPDATE statements shown in Section 14.10 are idempotent in the sense that setting `status = 'rejected'` twice does not change the outcome. But if Module 4 triggers a notification or event on status change, the second update could trigger a duplicate notification. The PRD should either make the status transition atomic (within a database transaction) or ensure all downstream consumers are idempotent.

*Score:* 6/10

*Recommendations:*
1. Wrap the extraction + Module 4 update + status change in a single database transaction
2. Add a `processed_by_module5` flag in the Module 4 applications table and check it before updating (idempotency key)
3. Use n8n's "Execute Once" option for workflows that should not run overlapping instances
4. Log the extraction attempt count per email and alert if any email is processed more than twice

---

**Round 18: Resend notification domain and email deliverability**

*Concern:* Notifications are sent from `selvi-system@apiloom.io` via Resend. For these notifications to reliably reach `chellamma.uk@gmail.com`, the `apiloom.io` domain must have correct SPF, DKIM, and DMARC records configured for Resend's sending infrastructure. If these are missing or misconfigured, Gmail may flag the notifications as spam, and the candidate would miss urgent interview alerts.

*Analysis:* Section 12.5 configures Resend with `fromEmail: 'selvi-system@apiloom.io'`. Resend requires domain verification (DNS records) before sending from a custom domain. The PRD lists "Configure Resend API key in n8n environment" as a Phase 0 task but does not mention domain verification, SPF/DKIM/DMARC configuration, or deliverability testing. It also does not mention the Resend free tier limitation (3,000 emails/month from a single domain). The system sends ~50 notifications/month, well within the free tier. But if the domain is not properly verified, or if the notifications land in spam, the entire urgent notification system fails silently. The PRD should include domain verification as a Phase 0 prerequisite and include a deliverability test.

*Score:* 5/10

*Recommendations:*
1. Add domain verification (SPF, DKIM, DMARC for apiloom.io) as an explicit Phase 0 task
2. Include a deliverability test: send a test notification and confirm it lands in the inbox, not spam
3. Add a "notification delivery health check" that periodically sends a test email and verifies receipt
4. Consider using a subdomain (e.g., `notify.apiloom.io`) for Resend to isolate reputation
5. Document the fallback plan if Resend notifications are blocked by Gmail

---

**Round 19: No webhook or event-driven triggers between workflows**

*Concern:* All inter-workflow communication is via the database (shared state). WF-EM-01 writes emails to the database; WF-EM-02 polls the database for unclassified emails. This introduces latency at every stage. n8n supports webhook triggers and workflow-to-workflow calls. Why not have WF-EM-01 directly trigger WF-EM-02 after ingesting an email, instead of waiting for the next cron cycle?

*Analysis:* The PRD's architecture uses a "shared database queue" pattern rather than an event-driven pattern. This is simpler and more resilient (if WF-EM-02 is down, emails accumulate in the database and are processed when it recovers). But it trades latency for resilience. In the worst case, an email waits 5 minutes between each stage. With 4 stages (ingest -> classify -> extract -> label), worst-case latency is 20 minutes. The PRD acknowledges this with the staggered scheduling (Section 5.2), aiming for 1-cycle (5-minute) throughput. But n8n has a "Execute Workflow" node that can call sub-workflows synchronously. WF-EM-01 could call WF-EM-02 directly for urgent-looking emails (e.g., those from non-marketing senders). This hybrid approach keeps the resilience of cron-based processing for bulk emails while adding fast-path processing for potentially urgent ones.

*Score:* 6/10

*Recommendations:*
1. Implement a "fast-path" in WF-EM-01: after ingesting an email from a non-marketing, non-alert sender, immediately call WF-EM-02 as a sub-workflow for that email
2. Keep cron-based processing as the backup/catch-all for bulk emails and retries
3. For interview_invite and offer classifications, immediately trigger WF-EM-03 and WF-EM-06 inline
4. Document the architectural decision to use polling vs event-driven and the tradeoff rationale

---

**Round 20: No backup or disaster recovery plan for the email processing database**

*Concern:* The email processing data (classifications, extracted data, recruiter contacts) exists only in the Postgres database on the Hetzner CAX31. If the server disk fails or the database becomes corrupted, all classification history, recruiter relationships, and application status links are lost. The original emails still exist in Gmail, but the processing work must be redone from scratch.

*Analysis:* The PRD specifies the technology stack (Section 5.4) and infrastructure (Section 5.5) but does not mention database backups, replication, or disaster recovery. The Hetzner CAX31 is a single server with no redundancy described. For a personal job search system, the risk tolerance is higher than for a production SaaS -- but losing recruiter relationship data, quality scores, and classification history mid-search would be a significant setback. The PRD mentions GDPR purge procedures (Section 17.4) but not data protection procedures. The rollback plan (Section 18.9) covers workflow deactivation but not data recovery.

*Score:* 5/10

*Recommendations:*
1. Add daily Postgres pg_dump to an offsite location (e.g., S3 or Hetzner Object Storage)
2. Include backup verification in the weekly health check routine
3. Document the recovery procedure: how to restore the database and reconnect workflows
4. Consider Postgres logical replication to a standby instance if budget allows
5. Add the backup configuration as a Phase 0 task

---

#### Persona 2 Summary: Technical Architect / n8n Expert

| Round | Concern | Score |
|-------|---------|-------|
| 11 | Gmail `after:` timestamp gap risk | 5/10 |
| 12 | OAuth2 token refresh race condition | 6/10 |
| 13 | Cron overlap and concurrent execution | 5/10 |
| 14 | Polling vs push notifications | 5/10 |
| 15 | ARM64 compatibility of HTML libraries | 7/10 |
| 16 | Database connection pooling | 6/10 |
| 17 | No idempotency in extraction pipeline | 6/10 |
| 18 | Resend domain deliverability | 5/10 |
| 19 | No event-driven triggers between workflows | 6/10 |
| 20 | No backup or disaster recovery | 5/10 |
| **Average** | | **5.6/10** |

**Top 3 Issues (Technical Perspective):**
1. **Gmail `after:` timestamp gap risk (Round 11):** Using timestamp-based polling instead of Gmail's History API creates a real risk of missing emails at boundary conditions.
2. **Polling vs push notifications (Round 14):** For a system whose #1 stated goal is "never miss an interview invitation," not evaluating Gmail Push is an architectural oversight.
3. **Cron overlap and concurrent execution (Round 13):** Missing workflow locks on WF-EM-02 through WF-EM-06 could cause duplicate processing and error noise.

---

### Persona 3: Email Deliverability / Communication Expert -- Rounds 21-30

**Perspective:** Auto-reply quality, threading integrity, professional tone, email etiquette.

---

**Round 21: Auto-drafted interview confirmation lacks flexibility for ambiguous scheduling**

*Concern:* The interview confirmation draft prompt (Section 11.2) assumes the interview has a specific date and time. But many UK employers send interview invitations that say "Please let us know your availability next week" or "We have slots available on Tuesday PM or Thursday AM." The draft generation prompt does not have a template for "propose your availability" responses, only for "confirm attendance at the specified date and time."

*Analysis:* US-514 states "If multiple time slots are offered, the draft acknowledges the options and asks the candidate to choose." This is covered in the acceptance criteria but the draft generation prompt does not include instructions for this scenario. The prompt says "Confirms attendance at the specified date and time" and then has a conditional: "If multiple time slots are offered, the draft acknowledges the options and asks the candidate to choose." But the actual prompt text does not include this conditional. It tells Claude to "Confirm attendance at the specified date and time" unconditionally. The `alternative_times_offered` field exists in the extraction schema but there is no separate prompt template for the "choose from options" scenario. Claude would need to deviate from the prompt instructions to handle this correctly, which reduces reliability.

*Score:* 5/10

*Recommendations:*
1. Create two separate draft templates: (a) confirm specific time, (b) propose availability from offered options
2. Add a third template for "employer asks for your availability" -- where no times are offered and the candidate must propose her own
3. Route to the correct template based on whether `interview_date` is populated, `alternative_times` is populated, or neither
4. Include the candidate's known availability (from Module 6) in the availability-proposal draft

---

**Round 22: Reply threading may break if Gmail's Message-ID headers are not correctly referenced**

*Concern:* Section 11.3 builds the reply headers using `In-Reply-To` and `References` from the original message's `Message-ID` header. If the original email was sent through an ATS that uses non-standard Message-ID formats, or if the email went through a mailing list that rewrites Message-ID headers, the draft may not thread correctly in Gmail. A broken thread means the employer sees the reply as a new conversation, not as a response to their invitation.

*Analysis:* The code in Section 11.3 correctly constructs `In-Reply-To` and `References` headers. Gmail's threading algorithm uses multiple signals: `References`, `In-Reply-To`, subject line, and participants. Even if the headers are slightly wrong, Gmail will likely still thread correctly based on subject match and participant overlap. However, when creating drafts via the Gmail API with `threadId`, Gmail requires the `threadId` to match. If the `threadId` is correct (taken from the original message), the draft will thread correctly regardless of `In-Reply-To` and `References`. The real risk is if the `threadId` stored in the database does not match Gmail's internal thread ID, which could happen if Gmail re-threads the conversation (e.g., after a subject line change). This risk is low for direct replies but worth noting.

*Score:* 7/10

*Recommendations:*
1. Always use the `threadId` from the original Gmail message when creating drafts (already done)
2. Verify that the `threadId` is still valid before creating the draft by checking `threads.get`
3. If threading fails, fall back to creating a non-threaded draft with the subject "Re: [original subject]"
4. Log threading success/failure rates for monitoring

---

**Round 23: Recruiter response drafts may reveal too much about the candidate's search strategy**

*Concern:* The C-tier recruiter response draft (Section 11.2) tells the recruiter: "Describes what she IS looking for (L&D leadership, university lecturing, Berkshire area, GBP 70-80k)." This reveals the candidate's exact salary expectations and geographic preferences to every recruiter who sends an irrelevant role. In the UK recruitment market, revealing your salary expectation upfront weakens your negotiating position. A recruiter who knows you are looking for GBP 70-80k will never propose roles at GBP 90k+ even if you would be qualified and interested.

*Analysis:* The draft prompt explicitly instructs Claude to include salary range and location preferences in the decline response. This is a strategic error. Professional recruitment communication etiquette suggests being vague about salary expectations in decline emails: "I'm currently focused on senior L&D leadership roles in the Thames Valley area" rather than "I'm looking for GBP 70-80k in Berkshire." The A/B-tier response draft (Section 11.2) does not include salary expectations, which is correct. But the C-tier draft should not either -- revealing salary expectations to recruiters who send irrelevant roles is worse than revealing them to recruiters who send relevant ones. The candidate might be willing to accept GBP 85k for an exceptional role, but the C-tier draft anchors all future conversations at GBP 70-80k.

*Score:* 4/10

*Recommendations:*
1. Remove specific salary range from the C-tier recruiter response draft
2. Use vague descriptors instead: "senior L&D leadership roles in the South East" rather than exact location and salary
3. Add a system_config option to control how much detail is shared in decline emails
4. Never include salary expectations in automated drafts -- this should always be a candidate's manual decision

---

**Round 24: Auto-drafted acknowledgment replies may annoy employers who send automated acknowledgments**

*Concern:* US-515 creates acknowledgment reply drafts for A-tier applications. Many application acknowledgments are sent from noreply@ addresses or automated ATS systems. Replying to a noreply@ address is pointless (the reply bounces or goes to an unmonitored inbox). Replying to an automated acknowledgment with "Thank you for confirming receipt of my application" is, at best, ignored and, at worst, perceived as unnecessary email noise by a busy HR team.

*Analysis:* The PRD does not check whether the acknowledgment email was sent from a noreply@ address before creating a reply draft. The `is_automated` field from classification (Section 7.3) indicates whether the email is from an automated system, and the acknowledgment sub-categories include "standard" and "with_next_steps." The draft creation logic (Section 11.1) shows `acknowledgment: CONDITIONAL (A-tier only, configurable)`. But there is no condition for "only if the sender is a monitored address" or "only if the email is not automated." Creating a draft that the candidate reviews and then discards (because it is addressed to noreply@) wastes the candidate's time reviewing drafts and clutters her Gmail Drafts folder.

*Score:* 5/10

*Recommendations:*
1. Do not create acknowledgment reply drafts for emails from noreply@, no-reply@, or do-not-reply@ addresses
2. Do not create acknowledgment reply drafts for emails classified as `is_automated = true`
3. Only create acknowledgment reply drafts when the sender is a human (e.g., a named hiring manager)
4. Add a filter: if the email includes "please do not reply to this email," skip draft creation

---

**Round 25: Notification emails from the system could be confused with real employer emails**

*Concern:* The system sends notifications to `chellamma.uk@gmail.com` from `selvi-system@apiloom.io`. These notifications land in the same inbox that the system is monitoring. If the notification is not filtered correctly, the system could process its own notification emails -- classifying them, attempting extraction, and creating an infinite feedback loop. The `-label:Job-Processed` filter excludes processed emails, but the notification is a new email that has never been processed.

*Analysis:* The sender pattern database (Section 6.5 / 13.8) does not include `selvi-system@apiloom.io` as a known sender to exclude. The notification email would be fetched by WF-EM-01, go through language detection (English), fail sender pattern matching (unknown sender), and be sent to Claude for classification. Claude would likely classify it as `not_job_related` (it is a system notification, not a job email), but it would still consume a Claude API call. Worse, if the notification contains details about an interview ("INTERVIEW INVITATION DETECTED... Acme Corp... Senior L&D Manager"), Claude might classify it as `interview_invite`, creating a phantom interview record. This is a real recursive processing risk.

*Score:* 4/10

*Recommendations:*
1. Add `selvi-system@apiloom.io` to the sender pattern database with classification `not_job_related` and `skip = true`
2. Add a pre-filter in WF-EM-01: skip any email where `from_email` matches the system notification address
3. This is a CRITICAL Phase 0 task -- must be configured before any notifications are sent
4. Also add any other system email addresses (e.g., Resend bounce addresses) to the exclusion list

---

**Round 26: Draft quality checker blocks legitimate phrases**

*Concern:* Section 11.4 includes an AI phrase blocklist: "I appreciate the opportunity," "certainly," "absolutely." But in UK business email, phrases like "I appreciate the opportunity to discuss" and "I would certainly be available" are normal, professional, and not at all AI-sounding. The draft quality checker would flag these and potentially trigger a re-generation, leading to drafts that sound artificially casual in an attempt to avoid "AI-sounding" phrases.

*Analysis:* The AI phrase list mixes genuinely AI-sounding phrases ("leverage my expertise," "synergize," "bring to the table") with perfectly normal British English ("I appreciate the opportunity," "certainly"). In UK business correspondence, "I appreciate the opportunity" is a standard, expected phrase in interview confirmations. Blocking it forces Claude to find circumlocutions that may sound less professional. The phrase "I hope this email finds you well" is arguably more AI-sounding but is also a common UK email opening. The issue is that the blocklist is context-insensitive: "certainly" in "I would certainly be able to attend" is fine, while "Certainly! I would be thrilled to..." is not.

*Score:* 5/10

*Recommendations:*
1. Remove "I appreciate the opportunity" and "certainly" from the blocklist -- these are standard UK business English
2. Make the blocklist context-sensitive: flag phrases only when they appear in specific patterns (e.g., "Certainly!" at the start of a sentence)
3. Focus the blocklist on phrases that are genuinely unusual in human writing: "I would be delighted to explore this synergistic opportunity"
4. Have the candidate review and approve the blocklist before production

---

**Round 27: No handling of email signature extraction to avoid including recruiter signatures in extracted data**

*Concern:* When extracting recruiter contact details (name, phone, email), the extraction pipeline processes the entire email body. Recruiters often include their entire team's contact details in their email signature, or include a company switchboard number. The extraction might capture the wrong phone number (switchboard instead of direct line) or extract the wrong person's name (the recruiter's colleague from the signature block).

*Analysis:* The extraction prompt (Section 8.2) instructs Claude to extract "recruiter_name," "recruiter_email," and "recruiter_phone." Claude is generally good at distinguishing between the sender's details and signature-block noise. But complex email signatures (common in UK recruitment agencies) include multiple people: "Mark Thompson, Senior Consultant... James Wilson, Managing Director..." The extraction might capture James Wilson as the recruiter instead of Mark Thompson if the signature block is parsed incorrectly. There is no signature-stripping step in the preprocessing pipeline (SW-EM-01). The HTML stripping function (Section 6.4) converts HTML to text but does not identify or remove email signatures. This could lead to incorrect recruiter profiles and, more importantly, incorrect draft responses addressed to the wrong person.

*Score:* 5/10

*Recommendations:*
1. Add a signature detection/stripping step to SW-EM-01 (heuristic: text after "Kind regards," "Best regards," or similar is signature)
2. Instruct the extraction prompt to prioritize the email's "From" name and the first contact details mentioned in the body over signature-block details
3. Cross-validate extracted recruiter_email against the email's from_email field
4. Flag cases where extracted name does not match from_name for manual review

---

**Round 28: Response drafts do not account for the candidate's current emotional state or strategic position**

*Concern:* The draft generation is stateless -- it does not know whether the candidate has received 5 rejections this week or is juggling 3 competing offers. A rejection acknowledgment or recruiter decline written in a context-unaware manner may not reflect the candidate's strategic position. For example, after receiving an offer, the candidate might want to respond differently to other recruiters ("I'm currently considering an offer but would be interested in hearing about future opportunities") rather than the generic decline.

*Analysis:* The draft generation prompts (Section 11.2) use a fixed context: the candidate's background and the current email's details. They do not query the application tracker for the candidate's overall pipeline state. If the candidate has an active offer, the recruiter response should reflect that. If the candidate has had 5 interviews this week, the interview confirmation should note her busy schedule. The system has all this data in Module 4 but does not feed it into the drafting context. This is a missed opportunity for strategic communication. However, the mitigation is that all drafts are reviewed before sending, so the candidate can manually adjust tone and content. The risk is low for harm but high for missed value.

*Score:* 6/10

*Recommendations:*
1. Query Module 4 for the candidate's current pipeline state before generating drafts
2. If the candidate has an active offer, modify all recruiter response drafts to reflect this
3. If the candidate has multiple interviews scheduled the same week, note this in the interview confirmation context
4. Consider a "strategic mode" setting where the candidate indicates her current position (exploring, active, negotiating, offered)

---

**Round 29: No mechanism for the candidate to provide feedback on draft quality**

*Concern:* The system generates drafts and logs whether they were created, but there is no feedback loop. If the candidate consistently edits drafts heavily before sending (changing tone, removing content, adding details), the system does not learn. If she discards drafts entirely, the system does not know why. Without feedback, the draft quality cannot improve over time.

*Analysis:* Section 11.3 creates drafts in Gmail. Section 13.10 tracks draft status (`created`, `in_gmail`, `sent_by_candidate`, `discarded`, `failed`). But the PRD does not describe how the `sent_by_candidate` and `discarded` statuses are detected. The system monitors the sent folder (Section 6.7), so it can detect when a draft was sent. It can compare the sent content with the draft content to measure edit distance. But the PRD does not include this analysis. There is no mechanism to detect discarded drafts (a draft that was deleted from Gmail Drafts). The Gmail API can list drafts, and the system could periodically check whether created drafts still exist and whether they have been sent. This feedback loop is mentioned nowhere in the PRD.

*Score:* 5/10

*Recommendations:*
1. Add a periodic check (e.g., in WF-EM-08) that compares created drafts against sent emails and deleted drafts
2. Track edit distance between drafted content and actually sent content
3. If the candidate consistently edits > 50% of drafts, flag the draft quality issue in the weekly report
4. Use the edit patterns to refine the draft generation prompts over time
5. Add a simple feedback mechanism: if the candidate deletes a draft, log it as "discarded"

---

**Round 30: Candidate's phone number is hardcoded in signature and draft prompts**

*Concern:* Section 11.5 shows the candidate's email signature with `+44 XXXX XXXXXX` as a placeholder. The draft generation prompts (Section 11.2) include `+44 [phone number]` as a placeholder. If these placeholders are not replaced with the actual phone number before going live, every auto-drafted email would include a literal "+44 XXXX XXXXXX" or "+44 [phone number]" -- an immediate professional credibility loss.

*Analysis:* The signature is stored in `system_config` (Section 11.5) with placeholders. The draft validation (Section 11.4) checks for `{{` template placeholders but would not catch `XXXX XXXXXX` or `[phone number]` as these are not template syntax. This is a deployment configuration issue, not an architectural one, but it is exactly the kind of issue that gets missed in the rush to go live. The PRD should include a checklist of configuration items that must be set with real values before production activation.

*Score:* 6/10

*Recommendations:*
1. Add `[phone number]`, `XXXX`, and `[placeholder]` patterns to the draft validation checklist
2. Create a Phase 0 "configuration verification" checklist that validates all system_config values contain real data, not placeholders
3. Include the actual phone number in the system_config seed data (or document that it must be set manually)
4. Add a startup validation that checks all required system_config entries exist and are non-placeholder

---

#### Persona 3 Summary: Email Deliverability / Communication Expert

| Round | Concern | Score |
|-------|---------|-------|
| 21 | No template for "propose your availability" responses | 5/10 |
| 22 | Reply threading header integrity | 7/10 |
| 23 | Recruiter decline reveals salary expectations | 4/10 |
| 24 | Acknowledgment replies to noreply@ addresses | 5/10 |
| 25 | System notification feedback loop risk | 4/10 |
| 26 | AI phrase blocklist too aggressive | 5/10 |
| 27 | Email signature extraction errors | 5/10 |
| 28 | Context-unaware draft generation | 6/10 |
| 29 | No draft quality feedback loop | 5/10 |
| 30 | Placeholder phone number in signatures | 6/10 |
| **Average** | | **5.2/10** |

**Top 3 Issues (Communication Perspective):**
1. **Recruiter decline reveals salary expectations (Round 23):** Auto-sharing GBP 70-80k salary range with every declining recruiter undermines negotiating position. This is a strategic harm, not just an aesthetic one.
2. **System notification feedback loop (Round 25):** Processing the system's own notification emails could create phantom records. Must be fixed before first notification is sent.
3. **No availability-proposal draft template (Round 21):** A significant percentage of interview invitations ask for availability rather than confirming a time. Missing this template means bad drafts for a common scenario.

---

### Persona 4: AI/LLM Specialist -- Rounds 31-40

**Perspective:** Email classification accuracy, extraction quality, prompt engineering, edge cases, costs.

---

**Round 31: Classification prompt includes candidate-specific information that reduces generalizability and creates bias**

*Concern:* The classification system prompt (Section 7.3) specifies "a professional with a PhD + MBA and 18 years of HR/L&D experience, seeking corporate L&D roles (Manager to Head level, GBP 70-80k) and university Lecturer/Senior Lecturer positions near Maidenhead, Berkshire, UK." This context is useful for classification but creates a bias: Claude may classify emails more aggressively as `interview_invite` if the role mentioned matches the candidate's profile, and as `marketing` if it does not. An email about a "Junior HR Assistant" role might be misclassified as `marketing` rather than `recruiter_outreach` because it does not match the candidate's profile.

*Analysis:* Including candidate context in the classification prompt is a double-edged sword. It helps Claude understand the candidate's world (e.g., knowing that CIPD and HE sector emails are likely relevant) but introduces bias toward the candidate's self-perception of relevant roles. A recruiter email about a "HR Operations Manager" role (below the candidate's target level) is still `recruiter_outreach`, not `marketing`. The classification should be based on the email's TYPE (recruiter outreach vs marketing newsletter), not the RELEVANCE of the role. Role relevance is a separate scoring step in the recruiter management pipeline. Conflating type classification with relevance assessment in the same prompt increases misclassification risk for roles the candidate would not consider.

*Score:* 6/10

*Recommendations:*
1. Separate the classification prompt into two concerns: (a) email type classification (role-agnostic) and (b) relevance scoring (role-specific)
2. Remove salary range and location preferences from the classification prompt -- these belong in the relevance scoring prompt
3. Keep basic context (candidate is job-seeking, UK-based, L&D/HR sector) but remove specifics that could bias classification
4. Test classification accuracy on emails about roles outside the candidate's target profile

---

**Round 32: Truncating email body to 3000 characters for Haiku may lose critical information**

*Concern:* Section 7.2 sends "email body + metadata to Claude Haiku" with the user prompt truncating to `{{ body_stripped | truncate(3000) }}`. Job alert emails from LinkedIn or Indeed can be 10,000+ characters. An interview invitation embedded in a long email (e.g., after several paragraphs of company introduction) could be truncated away. The first 3000 characters might be company boilerplate, with the actual interview details at position 4000.

*Analysis:* For most email types, 3000 characters is sufficient -- interview invitations, rejections, and acknowledgments are typically short. The risk is primarily with: (1) Long recruiter emails that bury the role details after agency marketing text, (2) ATS emails with extensive legal disclaimers before the content, (3) Emails where the relevant content is in the bottom half (e.g., forwarded emails where the forwarding message is brief but the forwarded content is long). The Sonnet escalation sends the full body, but escalation only happens when Haiku's confidence is low. If Haiku confidently misclassifies a truncated email (e.g., classifying a long email as `marketing` because the first 3000 chars are marketing boilerplate), no escalation occurs. This is the same "confident wrong classification" problem from Round 2, compounded by truncation.

*Score:* 5/10

*Recommendations:*
1. Instead of truncating to the first 3000 characters, extract a "smart excerpt": first 1500 chars + last 1500 chars (to capture content buried at the bottom)
2. For emails longer than 5000 characters, extract subject + first paragraph + last paragraph + any paragraph containing keywords ("interview," "offer," "confirm")
3. Alternatively, increase the truncation limit to 5000 characters for Haiku (the cost difference is ~$0.0005 per email)
4. Add a "suspicious truncation" flag: if the email is > 3000 chars and Haiku's confidence is > 0.80, still send a sample to Sonnet for verification weekly

---

**Round 33: Claude model version pinning and deprecation risk**

*Concern:* Section 14.2 specifies `"model": "claude-3-5-haiku-20241022"` as the model identifier. Anthropic periodically deprecates model versions and introduces new ones. If the model version is deprecated and the system continues sending requests to it, classification will fail entirely. The PRD stores `model_version` in the classification record but does not describe a model migration or version management strategy.

*Analysis:* The `system_config` table stores the model name (Section 13.13: `email_classification_model: "claude-3.5-haiku"`), which is a generic name without the version suffix. But the actual API call in Section 14.2 hardcodes the specific version `claude-3-5-haiku-20241022`. If the system_config value is used for the API call, it needs to be a valid model ID. If the hardcoded value is used, it is not configurable. Either way, there is no mechanism to detect that a model version has been deprecated and automatically switch to its successor. The calibration set (Section 7.6) tests classification quality, which would detect a model change affecting accuracy, but not a model deprecation causing API errors. Anthropic typically provides months of notice before deprecation, but the PRD should have a planned response.

*Score:* 6/10

*Recommendations:*
1. Use the `system_config` value (not hardcoded model ID) for API calls, and use a valid full model ID
2. Add a model deprecation check: if the Claude API returns a deprecation warning header, log it and include it in the daily summary
3. Document the procedure for updating the model version (update system_config, run calibration set, verify accuracy)
4. Subscribe to Anthropic's model deprecation announcements and add them to the monitoring checklist

---

**Round 34: Classification prompt produces structured JSON but Claude may add preamble or formatting**

*Concern:* The classification prompt (Section 7.3) ends with "Respond in this exact JSON format:" and provides a template. Claude models sometimes add preamble text ("Here is the classification:"), wrap JSON in markdown code blocks (```json ... ```), or add explanatory text after the JSON. The parsing code (Section 14.2, "Code: Parse Claude Response") must handle all these variations.

*Analysis:* The PRD includes a "Code: Parse Claude Response" node but does not show the parsing logic. If the parsing expects raw JSON and Claude returns markdown-wrapped JSON, parsing fails. If parsing fails, the email goes unclassified and waits for the next cycle. The error handling (Section 16.1) logs this as a "Claude Response Parse Error" (LOW severity) and retries with "explicit format instruction." But the retry prompt is not shown. This is a common LLM integration issue: Claude's output format is probabilistic, not deterministic. Even with clear instructions, there is a small probability of non-JSON output. The PRD should show the parsing code and handle common format variations.

*Score:* 6/10

*Recommendations:*
1. Show the Claude response parsing code, including: strip markdown code fences, extract JSON from surrounding text, validate JSON schema
2. Use Claude's `response_format` parameter (if available for the specified model version) to force JSON output
3. Add a JSON schema validation step that checks all required fields are present
4. If parsing fails, retry once with an appended instruction: "Respond with ONLY the JSON object, no markdown, no explanation"
5. Log the raw Claude response for failed parses to enable debugging

---

**Round 35: Extraction prompt asks Claude to convert relative dates but provides insufficient context**

*Concern:* The extraction prompt (Section 8.2) says: "For dates, convert to ISO 8601 format. If the email says 'next Tuesday' and today is 2026-03-29 (Sunday), next Tuesday is 2026-03-31." The reference date in the prompt is hardcoded to "2026-03-29" in the example. In production, this must be the email's received date, not a hardcoded date. Additionally, "next Tuesday" is ambiguous: some people mean "the Tuesday of next week" (April 7 if today is Sunday March 29) and others mean "the coming Tuesday" (March 31). UK business English typically means "the coming Tuesday."

*Analysis:* The extraction user prompt (Section 8.2) includes `DATE: {{ date }}` from the email metadata, but the relative-date instruction says "today is 2026-03-29 (Sunday)" as an example. In production, this should be `today is {{ current_date }}`. If the prompt template is not properly parameterized, Claude may use the example date instead of the actual date, producing wrong date conversions. The date parsing code (Section 8.6) handles relative dates in JavaScript, which suggests the extraction may not rely solely on Claude for date conversion. But the extraction prompt asks Claude to do the conversion ("convert to ISO 8601 format"), creating a dual-responsibility where both Claude and the Code node parse dates. This double-parsing could produce conflicts if they disagree.

*Score:* 5/10

*Recommendations:*
1. Ensure the extraction prompt dynamically inserts the current date: "Today's date is {{ current_date }} ({{ current_day_of_week }})"
2. Choose one date parsing authority: either Claude converts all dates in its response, or Claude extracts raw date text and the Code node converts. Do not do both.
3. For relative dates, validate Claude's conversion against the Code node's conversion and flag discrepancies
4. Add edge cases to the calibration set: "next Tuesday" (when today is Sunday vs Monday), "this Friday," "end of the week"

---

**Round 36: No few-shot examples in the classification prompt**

*Concern:* The classification prompt (Section 7.3) provides category definitions and rules but no few-shot examples of actual email classifications. Few-shot examples dramatically improve LLM classification accuracy, especially for ambiguous cases at category boundaries (e.g., recruiter_outreach vs interview_invite). The prompt relies entirely on Claude's zero-shot understanding of the categories.

*Analysis:* The prompt is well-structured with clear category definitions and explicit disambiguation rules (e.g., "An email that invites the candidate to 'discuss' a role is interview_invite, NOT recruiter_outreach"). However, LLM research consistently shows that 3-5 few-shot examples improve classification accuracy by 5-15% compared to zero-shot. The calibration set (Appendix D) contains perfect examples that could be used as few-shot demonstrations. Adding 5-8 examples covering the most ambiguous boundaries (recruiter vs interview, acknowledgment vs offer, marketing vs alert) would significantly improve accuracy. The cost impact is minimal: 5 examples at ~200 tokens each = 1000 additional input tokens per classification = ~$0.00025 per email.

*Score:* 5/10

*Recommendations:*
1. Add 5-8 few-shot examples to the classification system prompt, focusing on boundary cases
2. Rotate the few-shot examples periodically to prevent overfitting to specific formats
3. Include at least one example for each ambiguous boundary: recruiter/interview, ack/offer, marketing/alert
4. Measure the accuracy improvement from few-shot vs zero-shot on the calibration set before going live

---

**Round 37: No handling of classification changes when thread context reveals new information**

*Concern:* Email classification is per-message. But sometimes a thread's context changes the correct classification of an earlier message. Example: Message 1 is classified as `recruiter_outreach` (a recruiter says "I have a role that might interest you"). Message 2 in the same thread says "Actually, I should mention the client specifically asked me to reach out to you based on your LinkedIn profile. They'd like to set up a call this week." Message 2 should be classified as `interview_invite`, and retroactively, the context suggests the entire thread is an interview pipeline, not generic recruiter outreach.

*Analysis:* The classification prompt for replies (Section 7.3) includes thread context: "This email is a reply in an existing thread. Previous thread context: ORIGINAL SUBJECT: {{ thread_original_subject }}, THREAD MESSAGES: {{ thread_message_count }}." This helps Claude classify Message 2 correctly. But there is no mechanism to retroactively reclassify Message 1. The thread's `primary_classification` (Section 13.4) is "based on most significant email in thread," which would update to `interview_invite` when Message 2 is classified. But the labels on Message 1 remain `Job/Recruiter`, and the Module 4 integration triggered by Message 1 still reflects `recruiter_outreach`. There is no thread-level label reconciliation.

*Score:* 6/10

*Recommendations:*
1. When a thread's primary_classification changes, trigger a label update for all messages in the thread
2. Add a "thread reclassification" step that runs when a new message upgrades the thread significance
3. For Module 4 integration, check thread_primary_classification (not individual message classification) when deciding what status update to send
4. Include the thread-level classification upgrade in the daily summary

---

**Round 38: Cost estimation assumes low email volume -- no analysis of cost at scale or burst scenarios**

*Concern:* Section 7.5 estimates weekly Claude API costs at $0.11 for 60 emails/week. But during an active job search, the candidate might receive 200+ job alert emails in a single day (e.g., when first setting up alerts on 8 platforms). The cost estimation does not model burst scenarios. Additionally, the token estimates (1500 input + 200 output for classification) may be low for emails with complex HTML that is only partially stripped.

*Analysis:* The per-email cost of $0.000625 (Haiku classification) is based on 1500 input tokens. A complex email with preserved structural markers, thread context, and ICS attachment data could easily be 3000+ input tokens. The cost doubles. For Sonnet escalation with full body and thread context, the token count could reach 8000+ input, costing $0.024+ per email. If 10% of emails escalate to Sonnet (rather than the assumed ~8%), weekly costs increase. At 300 emails/week during a burst, with 30% needing Claude classification (90 emails) and 15% escalating to Sonnet (45 emails), the weekly cost would be: 45 Haiku x $0.001 + 45 Sonnet x $0.024 = $0.045 + $1.08 = $1.125/week. Monthly: ~$4.50. Still low, but 9x the estimated $0.50. The cost is not a problem, but the estimation methodology is imprecise.

*Score:* 7/10

*Recommendations:*
1. Add burst-scenario cost modeling (200 emails/day for first week, then steady-state 60/week)
2. Add token-count monitoring and cost alerting (alert if daily cost exceeds $1)
3. Update per-email token estimates with real data after Phase 1
4. Set a monthly cost cap in system_config and pause non-essential Claude calls if exceeded

---

**Round 39: Relevance scoring for recruiter roles is not defined in this PRD**

*Concern:* US-504 states "A relevance score is generated based on how well the proposed role matches the candidate profile." The recruiter response draft (Section 11.2) varies tone based on "relevance tier" (A/B/C/D). The recruiter_role_proposals table (Section 13.6) stores `relevance_score` and `relevance_tier`. But the PRD does not define how the relevance score is calculated. It is not clear whether this uses the Module 1 job scoring algorithm, a separate scoring prompt, or a hard-coded rule set.

*Analysis:* Section 10.2 defines recruiter QUALITY scoring (how good the recruiter is over time), but ROLE RELEVANCE scoring (how well a specific proposed role matches the candidate) is referenced but never defined. The extraction pipeline (WF-EM-03) stores recruiter outreach data and creates recruiter_role_proposals, but the relevance_score and relevance_tier fields are populated by an undefined process. The response drafting engine (WF-EM-05) uses relevance_tier to select the draft template. If relevance scoring is not defined, the draft engine cannot function as designed. This is a gap in the PRD -- a critical feature (relevance-based draft tone) depends on an undefined input.

*Score:* 4/10

*Recommendations:*
1. Define the role relevance scoring algorithm explicitly in this PRD (or reference Module 1's scoring algorithm)
2. Include a scoring prompt that evaluates the proposed role against the candidate's profile
3. Define the tier thresholds: A (score 80-100), B (60-79), C (40-59), D (0-39)
4. Specify whether relevance scoring uses Claude (and which model) or a rule-based system
5. This is a blocking dependency for WF-EM-05 -- without it, recruiter response drafts cannot be tiered

---

**Round 40: No evaluation of classification accuracy on non-English-looking emails that are actually job-related**

*Concern:* Section 6.4 describes language detection using English marker words. If an email is mostly in English but contains a significant number of non-English words (e.g., a recruiter email with German company names, French role titles, or Welsh place names), the language detection might flag it as "other" and skip it entirely. The UK job market includes roles at international companies where email may contain multilingual content.

*Analysis:* The language detection function (Section 6.4) calculates the ratio of English marker words to total words. An email that says "The role is based at our Llanelli office, working with the Cymru team on Datblygu (Development) programmes" would have several Welsh words that dilute the English ratio. The threshold is `englishRatio > 0.1` which is very permissive (10% English words = classified as English). This should handle mixed-language emails well. However, a purely Welsh-language recruitment email from a Welsh university (where the role title and correspondence are in Welsh per language policy) would be filtered out. This is an edge case for a candidate targeting UK L&D roles, but Welsh universities that advertise in Welsh first are a real employer segment. The more likely problem is emails with extensive non-English content in signatures (e.g., French or German legal disclaimers from international companies).

*Score:* 7/10

*Recommendations:*
1. Lower the English language threshold to 0.05 (5%) to be more permissive
2. Add a "language uncertain" category that sends borderline emails to Claude for language + classification in one call
3. Maintain a list of known UK job-related non-English terms (Welsh place names, common European company names) as additional positive markers
4. Log all emails skipped for language detection and include the count in the daily summary

---

#### Persona 4 Summary: AI/LLM Specialist

| Round | Concern | Score |
|-------|---------|-------|
| 31 | Candidate-specific bias in classification prompt | 6/10 |
| 32 | 3000-char truncation may lose critical info | 5/10 |
| 33 | Model version pinning and deprecation | 6/10 |
| 34 | Claude JSON output parsing robustness | 6/10 |
| 35 | Relative date conversion context errors | 5/10 |
| 36 | No few-shot examples in classification prompt | 5/10 |
| 37 | No retroactive thread reclassification | 6/10 |
| 38 | Cost estimation imprecise for burst scenarios | 7/10 |
| 39 | Role relevance scoring undefined | 4/10 |
| 40 | Language detection edge cases | 7/10 |
| **Average** | | **5.7/10** |

**Top 3 Issues (AI/LLM Perspective):**
1. **Role relevance scoring undefined (Round 39):** A core feature (tiered recruiter response drafts) depends on a scoring algorithm that is never defined. This is a blocking gap.
2. **No few-shot examples (Round 36):** Zero-shot classification when few-shot is proven to improve accuracy significantly is an avoidable quality gap.
3. **3000-char truncation risk (Round 32):** Confident misclassification of truncated emails is a silent failure mode with no recovery mechanism.

---

### Persona 5: Privacy & Compliance Officer -- Rounds 41-50

**Perspective:** GDPR email processing, consent, retention, third-party data sharing, recruiter data rights.

---

**Round 41: Legitimate interest basis for processing recruiter personal data is not documented with a Legitimate Interest Assessment (LIA)**

*Concern:* Section 17.1 claims "Legitimate interest" as the legal basis for processing recruiter/employer personal data (names, emails, phone numbers, LinkedIn profiles). GDPR Article 6(1)(f) requires a Legitimate Interest Assessment (LIA) that balances the controller's interests against the data subject's rights. The PRD states the basis but does not perform or document the assessment.

*Analysis:* The candidate (Selvi) is the data controller. She processes recruiter personal data for the legitimate purpose of managing her job search. The LIA should consider: (1) Purpose: managing job search communications -- clearly legitimate. (2) Necessity: storing recruiter names and contact details is necessary to track relationships and avoid duplicate outreach. (3) Balancing test: recruiters send their contact details voluntarily in the context of professional outreach. They expect their details to be stored and used for professional communication. The impact on recruiters' rights is minimal -- the data is not shared with third parties (except Anthropic for classification, which is processing, not sharing). The LIA would likely pass. But it should be documented, not just asserted. If a recruiter challenges the processing, the documented LIA is the candidate's defense.

*Score:* 5/10

*Recommendations:*
1. Document a formal LIA as an appendix to this PRD covering recruiter data processing
2. Include the three-part test: purpose, necessity, balancing
3. Reference ICO guidance on legitimate interest for personal/household use (which is actually exempt from GDPR under Article 2(2)(c) -- see Round 42)
4. Store the LIA document alongside the GDPR compliance documentation

---

**Round 42: The household exemption may apply, changing the entire compliance landscape**

*Concern:* GDPR Article 2(2)(c) exempts "processing by a natural person in the course of a purely personal or household activity." A personal job search system used by one individual for her own job search is arguably a "purely personal activity." If the household exemption applies, most GDPR obligations (including data subject rights for recruiters, retention schedules, and DPAs with processors) do not apply. The PRD treats GDPR as fully applicable without evaluating whether the exemption applies.

*Analysis:* CJEU case law (Lindqvist, C-101/01; Rynes, C-212/13) has interpreted the household exemption narrowly. Posting personal data on a publicly accessible website (Lindqvist) is not household activity. CCTV monitoring covering public space (Rynes) is not household activity. But a personal database on a private server, not shared publicly, used solely for the individual's own job search, is much closer to "purely personal." The key factors: (1) the data is not published or shared publicly, (2) it is processed on a privately-controlled server, (3) it is used solely by the candidate for her own purposes, (4) it involves a small number of data subjects (recruiters), (5) the processing is directly related to a personal activity (job searching). The stronger argument is that the household exemption applies. If so, the GDPR compliance section is over-engineered. However, the PRD's conservative approach (treating GDPR as applicable) is defensible and prudent.

*Score:* 7/10

*Recommendations:*
1. Add a subsection evaluating whether the household exemption applies, with a conclusion
2. If the exemption applies, simplify the compliance requirements (no LIA needed, no SAR handling required, no DPA review needed)
3. If the exemption does not apply (conservative interpretation), the existing compliance framework is appropriate
4. Note that even if GDPR's household exemption applies, basic data security practices should still be followed as good practice

---

**Round 43: Email body text sent to Anthropic API for classification -- data processor relationship not formalized**

*Concern:* Section 17.5 states that Anthropic receives email body text for classification and that "API data is not used for model training and is not retained beyond the API request." This is correct per Anthropic's current API terms. But if GDPR applies (see Round 42), Anthropic is a data processor, and a Data Processing Agreement (DPA) is required under Article 28. The PRD does not mention whether Anthropic's terms of service constitute an adequate DPA.

*Analysis:* Anthropic's API Terms of Service (as of 2025) include data processing provisions that cover the key GDPR DPA requirements: purpose limitation, data retention (not retained), security, and sub-processor management. However, Anthropic is a US company, and data transfers to the US require adequate safeguards (Standard Contractual Clauses or similar) under Chapter V of GDPR. Anthropic has committed to SCCs for EU/UK customers, but the candidate would need to ensure these apply to her API usage. For a personal job search system, enforcing SCCs with Anthropic is impractical. This is another argument for the household exemption (Round 42). If the exemption applies, the DPA question is moot. If it does not apply, there is a formal compliance gap.

*Score:* 5/10

*Recommendations:*
1. Review Anthropic's current DPA provisions and reference them in this PRD
2. If GDPR fully applies, ensure Anthropic's terms include adequate SCCs for UK data transfers
3. Consider whether the household exemption resolves this (most likely yes)
4. As a pragmatic measure, document the Anthropic data processing arrangement in a compliance note, even if legally the exemption applies

---

**Round 44: Recruiter email addresses stored indefinitely could become stale and incorrect**

*Concern:* Section 17.3 states recruiter contact data is retained "Duration of job search + 6 months." Recruiters change jobs, agencies close, and email addresses become invalid. Storing stale recruiter data is a data accuracy issue under GDPR Article 5(1)(d) ("accuracy principle"). If the candidate later references the recruiter database and contacts a person using outdated information, it could lead to confusion or privacy issues (e.g., the email address now belongs to a different person at the agency).

*Analysis:* The data accuracy concern is real but minor for a personal job search system. The recruiter database is used for relationship tracking, not for mass outreach. The candidate would verify contact details before reaching out. The 6-month post-search retention is reasonable -- it allows the candidate to reference recruiter relationships if she changes jobs within 6 months. After 6 months, the data is purged. The bigger concern is that "Duration of job search" is undefined -- what marks the end of a job search? Is it when the candidate starts a new job? When she deactivates the system? The PRD does not define the trigger for the end-of-search purge.

*Score:* 6/10

*Recommendations:*
1. Define what constitutes "end of job search" -- e.g., when the candidate changes system_config status to "search_concluded" or when she accepts an offer (Module 4 status)
2. Add an automated trigger: when Module 4 records an accepted offer, start the 6-month retention countdown for recruiter data
3. Add a periodic "data accuracy review" prompt in the daily summary after 3 months of active search
4. Consider a shorter retention period (3 months post-search) for recruiter data

---

**Round 45: No consent mechanism for processing emails from third parties who email the candidate**

*Concern:* The system processes emails from employers, recruiters, job boards, and personal contacts. Under GDPR, if the household exemption does not apply, the candidate needs a legal basis for processing each sender's personal data. For recruiters who initiate contact, implied consent or legitimate interest is defensible. But for personal contacts who forward a job posting (US-522), there is no basis documented. The friend who forwards a job listing has not consented to having their name and email stored in the system's database as a "referral source."

*Analysis:* The system stores the forwarding person's name and email as the "referral source" (US-522). This is minimal data processing -- just a name and email address -- and the purpose is clear (tracking how the candidate learned about the opportunity). Under legitimate interest, this is defensible: the friend sent the email voluntarily, expects the candidate to act on it, and the processing is minimal and expected. Under the household exemption, it is not an issue at all. But the PRD should at least acknowledge this data processing and its legal basis. Currently, forwarded email processing is described only from a technical perspective (detect forwarded email, parse content) without privacy consideration.

*Score:* 6/10

*Recommendations:*
1. Add forwarded emails (referral sources) to the Data Processing Inventory (Section 17.2)
2. Document the legal basis: legitimate interest (the referrer voluntarily shared the information) or household exemption
3. Consider not storing the referrer's personal details -- just note "referral from personal contact" without identifying the person
4. If the referrer's identity must be stored, include them in the data retention schedule

---

**Round 46: Email body sent to Claude includes third-party personal data beyond the recruiter/employer**

*Concern:* Email bodies can contain personal data about people other than the sender. An interview invitation might mention panel members' full names, titles, and email addresses. A recruiter email might CC a colleague. A follow-up request might reference a previous interviewer by name. All of this third-party personal data is sent to Anthropic for classification and extraction.

*Analysis:* The PRD stores panel member details (Section 8.1: `panel_members JSONB`) and interviewer details in the database. This data is extracted from the email and persisted. The individuals mentioned (panel members, interviewers) have not consented to their data being processed or sent to Anthropic's API. Under the household exemption, this is fine. Under full GDPR, the candidate has a legitimate interest in knowing who will interview her (it aids preparation). The processing is proportionate (names and professional titles only, not sensitive data). The risk is low. But the PRD should acknowledge that third-party data is processed and stored, not just "recruiter" and "employer" data.

*Score:* 6/10

*Recommendations:*
1. Add "interviewer personal data" and "panel member personal data" to the Data Processing Inventory
2. Include these in the retention schedule (purged with the application record)
3. If a SAR is received from an interviewer (unlikely but possible), the system must be able to identify and export their data
4. Consider whether interviewer emails need to be stored (they are rarely needed post-interview)

---

**Round 47: GDPR body purge function does not purge email_extracted_data.role_description_summary or email_extracted_data.preparation_instructions**

*Concern:* Section 13.12 purges `body_plain`, `body_html`, and `body_stripped` from the `emails` table after 7 days. But the `email_extracted_data` table (Section 13.3) contains `role_description_summary` (free text from recruiter emails), `preparation_instructions` (free text from interview invitations), and `rejection_reason` (free text from rejections). These fields contain extracts from the original email body and are not purged by the body purge function.

*Analysis:* The GDPR body purge is designed to remove raw email content while retaining structured extracted data. The extracted data fields are considered "structured data that forms part of the application tracking record" (Section 1). But `role_description_summary` and `preparation_instructions` are essentially copied portions of the email body -- they are unstructured text extracted from the body. They could contain personal data about the employer, detailed company information, or even the candidate's own application content (if quoted in the email). The purge function targets only the `emails` table, leaving these text fields indefinitely in `email_extracted_data`. This creates a retention gap: the raw email body is purged, but extracts from it persist.

*Score:* 5/10

*Recommendations:*
1. Add a secondary purge step that clears free-text fields in email_extracted_data after a longer retention period (e.g., 30 days)
2. Retain structured fields (company_name, role_title, dates, contact details) but purge narrative fields (role_description_summary, preparation_instructions, rejection_reason)
3. Alternatively, mark these fields as "derived from email body" and include them in the body purge schedule
4. Update the Data Retention Schedule (Section 17.3) to cover extracted text fields

---

**Round 48: No data breach notification procedure**

*Concern:* GDPR Article 33 requires notification to the supervisory authority within 72 hours of becoming aware of a personal data breach. Article 34 requires notification to affected individuals if the breach is high risk. The PRD does not include a data breach response procedure. If the Hetzner server is compromised and recruiter personal data is exfiltrated, what happens?

*Analysis:* For a personal job search system, the volume of personal data is small (perhaps 50-100 recruiter records, each with name, email, phone, agency). A breach would affect a small number of individuals. Under the household exemption (Round 42), GDPR breach notification requirements do not apply. Under full GDPR, the candidate (as controller) would need to assess the risk and potentially notify the ICO and affected recruiters. The practical likelihood of a targeted breach of a personal job search database is very low, but the PRD should at least acknowledge the possibility and describe a basic response. The PRD covers error handling and monitoring (Section 16) extensively but does not extend this to security incident response.

*Score:* 5/10

*Recommendations:*
1. Add a brief data breach response procedure: detect, contain, assess, notify (if required)
2. Include breach indicators in the monitoring: unexpected database access patterns, credential compromise
3. If the household exemption applies, note that formal breach notification is not legally required but good practice
4. At minimum, define who to contact and what to do if the server is compromised

---

**Round 49: Calibration set contains real-looking email content -- is it synthetic or does it contain real personal data?**

*Concern:* Section 13.11 and Appendix D describe a calibration set of 50 reference emails stored in the database (`email_classification_calibration` table). These records contain `email_subject`, `email_from`, and `email_body`. Section 17.3 states calibration data has "Indefinite" retention because it contains "no real personal data" (synthetic). But if the calibration set is created from real emails (modified to remove identifying information), there is a risk that residual personal data remains in the body text (company names that could identify real employers, role titles that could identify real job postings).

*Analysis:* The PRD states the calibration data is synthetic, which resolves the GDPR concern if true. Appendix D shows sample entries with generic details ("hr@company.co.uk", "noreply@workday.com"). These appear to be synthetic. However, the PRD does not describe how the calibration set is created or maintained. If in Phase 1 the team takes real classified emails and modifies them to create calibration entries, the modification process should be documented to ensure all personal data is replaced with synthetic equivalents. Company names, role titles, and contact details are all potentially identifying.

*Score:* 7/10

*Recommendations:*
1. Explicitly document that calibration set entries are created with fully synthetic data, not derived from real emails
2. Add a review step: before adding any entry to the calibration set, verify no real personal data is present
3. If using real emails as templates for calibration entries, define a sanitization checklist
4. Consider using Anthropic's Claude to generate realistic but entirely synthetic calibration emails

---

**Round 50: No data portability mechanism for the candidate to export her own data**

*Concern:* GDPR Article 20 provides the right to data portability -- the candidate should be able to export her own data in a machine-readable format. The PRD stores extensive data about the candidate's job search (applications, interview schedules, recruiter relationships, classification history). There is no export function described. If the candidate wants to switch to a different job search management tool, there is no way to take her data with her.

*Analysis:* Under the household exemption, data portability is not a GDPR right that applies (it is a right of data subjects against controllers, and the candidate is the controller, not the subject). However, data portability is still a practical concern: the candidate might want to archive her job search data, share it with a career advisor, or migrate to a different system. The database schema is well-structured (Postgres tables with clear fields), making export straightforward (pg_dump or a custom export script). But no export function is described in the PRD. The rollback plan (Section 18.9) describes how to deactivate the system but not how to export the accumulated intelligence. Recruiter relationship data, application status history, and classification patterns are all valuable and should be exportable.

*Score:* 6/10

*Recommendations:*
1. Add a data export function that generates a JSON or CSV archive of all candidate data (applications, classifications, recruiter contacts, interview history)
2. Include the export in the "manual full purge" procedure (Section 17.4) -- export before purge
3. Define the export format so it is interoperable with common job search tools
4. Add the export function as a Phase 6 enhancement

---

#### Persona 5 Summary: Privacy & Compliance Officer

| Round | Concern | Score |
|-------|---------|-------|
| 41 | No documented Legitimate Interest Assessment | 5/10 |
| 42 | Household exemption not evaluated | 7/10 |
| 43 | Anthropic DPA not formalized | 5/10 |
| 44 | Stale recruiter data and undefined search end | 6/10 |
| 45 | No consent basis for forwarded email referrers | 6/10 |
| 46 | Third-party data in email bodies sent to Claude | 6/10 |
| 47 | Extracted text fields not covered by body purge | 5/10 |
| 48 | No data breach notification procedure | 5/10 |
| 49 | Calibration set data provenance unclear | 7/10 |
| 50 | No data portability/export mechanism | 6/10 |
| **Average** | | **5.8/10** |

**Top 3 Issues (Privacy & Compliance Perspective):**
1. **Extracted text fields not purged (Round 47):** The GDPR body purge creates a false sense of compliance by purging raw bodies while leaving body-derived text in the extracted data table indefinitely.
2. **Household exemption not evaluated (Round 42):** This single determination changes the entire compliance landscape. If the exemption applies, half the compliance architecture is unnecessary. If it does not, several gaps exist.
3. **No data breach procedure (Round 48):** Even for a personal system, a basic incident response procedure should be documented.

---

### Overall Evaluation Summary

#### Persona Averages

| Persona | Average Score | Verdict |
|---------|--------------|---------|
| 1. The Candidate (Selvi) | 5.6/10 | Functional but gaps in high-stakes scenarios |
| 2. Technical Architect / n8n Expert | 5.6/10 | Solid design but missing architectural safeguards |
| 3. Email Deliverability / Communication Expert | 5.2/10 | Draft quality and communication strategy need work |
| 4. AI/LLM Specialist | 5.7/10 | Good foundation but missing proven LLM best practices |
| 5. Privacy & Compliance Officer | 5.8/10 | Over-engineered in some areas, gaps in others |
| **Overall Average** | **5.58/10** | |

#### Overall Verdict

The PRD is comprehensive in scope and well-structured. The core architecture (polling -> classify -> extract -> label -> notify) is sound. The database schema is thorough. The cost analysis is reasonable. The rollout plan is phased and practical. However, the PRD has systematic weaknesses in: (1) high-stakes edge cases where misclassification has real consequences, (2) pipeline latency guarantees, (3) LLM prompt engineering best practices, and (4) strategic communication awareness in auto-drafted responses. The PRD reads as if written by someone who understands the technical components deeply but has not stress-tested the system against adversarial real-world email patterns.

---

### Top 10 Must Fix (Before v1.0 Production)

| # | Issue | Round | Impact |
|---|-------|-------|--------|
| 1 | **Add system notification address to sender exclusion list** | 25 | System could process its own notifications, creating phantom records and infinite loops |
| 2 | **Define role relevance scoring algorithm** | 39 | Recruiter response drafts cannot be tiered without this -- blocks WF-EM-05 functionality |
| 3 | **Switch from `after:` timestamp to Gmail History API** | 11 | Risk of missed emails at timestamp boundaries -- undermines core reliability guarantee |
| 4 | **Add workflow locks to WF-EM-02 through WF-EM-06** | 13 | Concurrent cron executions can cause duplicate processing and error noise |
| 5 | **Remove salary expectations from C-tier recruiter decline drafts** | 23 | Auto-sharing salary range undermines candidate negotiating position across all future recruiter interactions |
| 6 | **Add few-shot examples to classification prompt** | 36 | Proven 5-15% accuracy improvement at negligible cost -- no reason not to include |
| 7 | **Add date/day-of-week cross-validation in extraction** | 3 | Wrong interview date in auto-draft could cause missed or conflicting interviews |
| 8 | **Configure Resend domain verification (SPF/DKIM/DMARC)** | 18 | Notifications landing in spam defeats the entire urgent notification system |
| 9 | **Add informal offer examples to calibration set and safety escalation rule** | 5 | Missing an offer is the single worst failure mode; current coverage is insufficient |
| 10 | **Add extracted text fields to GDPR purge scope** | 47 | Body purge is incomplete -- derived text persists indefinitely, creating a false compliance claim |

### Top 10 Should Fix (Before v1.0 or Early v1.x)

| # | Issue | Round | Impact |
|---|-------|-------|--------|
| 1 | **Create availability-proposal draft template** | 21 | Common interview invitation pattern has no corresponding draft template |
| 2 | **Add interview confirmation date validation warnings** | 3 | Candidate should see a warning when date/day mismatch is detected |
| 3 | **Smart truncation instead of first-3000-chars** | 32 | Reduces confident misclassification risk for long emails |
| 4 | **Evaluate Gmail Push Notifications for v2.0** | 14 | Near-real-time detection better serves the stated #1 goal |
| 5 | **Add daily summary staleness filtering** | 9 | Summary should reflect current state, not repeat already-actioned items |
| 6 | **Do not create acknowledgment drafts for noreply@ senders** | 24 | Avoids pointless drafts that clutter Gmail Drafts |
| 7 | **Implement database backup to offsite storage** | 20 | No backup plan means total data loss risk on server failure |
| 8 | **Refine AI phrase blocklist for UK English** | 26 | Overly aggressive blocklist removes normal UK business phrases |
| 9 | **Add signature stripping to preprocessing** | 27 | Reduces extraction errors from email signature data |
| 10 | **Evaluate GDPR household exemption** | 42 | Could simplify or validate the compliance architecture |

### Top 5 Nice-to-Have (v1.x or v2.0)

| # | Issue | Round | Impact |
|---|-------|-------|--------|
| 1 | **Context-aware draft generation using pipeline state** | 28 | Drafts could reflect whether the candidate has active offers or a busy interview week |
| 2 | **Draft quality feedback loop** | 29 | Learn from candidate edits to improve future draft quality over time |
| 3 | **Recruiter quality score modulating notification behavior** | 8 | Smarter notification filtering based on recruiter track record |
| 4 | **Event-driven fast-path for urgent emails** | 19 | Sub-minute detection for interview invitations via inline workflow calls |
| 5 | **Data export/portability function** | 50 | Archive job search intelligence for future reference or migration |

---

*End of 50-Round Critical Roleplay Evaluation (v1)*

---

## 20. 50-Round Critical Roleplay Evaluation (v2)

**Evaluation Date:** 2026-03-29
**Evaluator Profile:** Top 0.1% cross-disciplinary panel (5 personas, 10 rounds each)
**PRD Version Evaluated:** v2.0
**Previous Score:** v1 overall average 5.58/10

---

### Fixes Applied Log (v1 -> v2)

The following v1 issues were addressed in v2:

| v1 Round | Issue | Fix Applied | Fix Quality |
|----------|-------|-------------|-------------|
| 25 | System notification recursive processing | Added `selvi-system@apiloom.io` and `*@resend.dev` to sender exclusion list (Section 6.5, 13.8). Added explicit `SYSTEM_ADDRESSES` check as first step in `classifySender()`. Added Phase 0 task 0.5b. | **Strong.** Three-layer defense: sender pattern DB, code-level check, Phase 0 task. |
| 11 | Gmail `after:` timestamp gap risk | Replaced entire polling mechanism with Gmail History API (`users.history.list` with `startHistoryId`). Added daily 3AM reconciliation as safety net. Section 6.3 fully rewritten. | **Strong.** History API eliminates the class of bugs entirely. Reconciliation fallback handles expired historyId. |
| 13 | Workflow lock / concurrent execution | Extended workflow lock pattern to "all stateful workflows (WF-EM-01 through WF-EM-06)" in Section 5.2. Added `FOR UPDATE SKIP LOCKED` to all SELECT queries. | **Strong.** Two-layer protection (workflow lock + row-level lock) is robust. |
| 39 | Role relevance scoring undefined | Added full Section 10.2b with `scoreRoleRelevance()` algorithm, five scoring dimensions (title, seniority, salary, location, sector), tier thresholds, and integration notes. | **Strong.** Well-defined algorithm with clear thresholds. Unblocks WF-EM-05. |
| 23 | Salary expectations in C-tier decline drafts | Rewrote C-tier recruiter response prompt to use vague descriptors. Added explicit `IMPORTANT: Never include specific salary range` instruction. | **Strong.** Both the prompt and the rationale are clear. |
| 36 | No few-shot examples in classification prompt | Added 8 worked examples covering recruiter/interview boundary, ack/offer boundary, indirect interview phrasing, marketing/alert boundary, and positively-worded rejection. | **Strong.** Eight examples at key decision boundaries is good coverage. Cost impact negligible. |
| 3 | Date/day-of-week cross-validation | Added `crossValidateDateDay()` function in Section 8.6. Added draft warning language. Connected to WF-EM-05 draft generation. | **Strong.** Flags inconsistency and includes warning in draft rather than guessing. |
| 18 | Resend domain deliverability | Added Phase 0 tasks 0.5a (SPF/DKIM/DMARC verification) and 0.6 (deliverability test). Includes subdomain suggestion. | **Strong.** Concrete DNS verification tasks with fallback guidance. |
| 5 | Informal offer misclassified | Added "Safety Escalation Check" code node in WF-EM-02 (Section 14.2) that forces Sonnet escalation for offer-related keywords regardless of Haiku confidence. | **Good.** Addresses the false-negative-on-offers problem. However, the calibration set expansion (5+ informal offer examples) was recommended but not confirmed as implemented. |
| 17 | Idempotency in extraction pipeline | `FOR UPDATE SKIP LOCKED` prevents double-pickup. However, the v1 recommendation to wrap extraction + Module 4 update + status change in a single database transaction was NOT implemented. | **Partial.** Prevents concurrent processing of same row but does not address crash-between-steps scenario. |

**Fixes NOT applied (claimed in context but absent from PRD body):**

| v1 Round | Issue | Status |
|----------|-------|--------|
| 48 | Data breach notification procedure | **NOT FIXED.** No breach response procedure exists in Section 17. The v1 evaluation identified this gap; it remains. |

---

### Persona 1: The Candidate (Selvi) -- Rounds 1-10

**Perspective:** Email classification accuracy, auto-reply safety, daily workflow impact.

---

**Round 1: Quiet hours bypass still wakes candidate at midnight for non-actionable interview invitations**

*Concern:* v1 Round 4 flagged that interview invitations are exempt from quiet hours (Section 12.4), meaning a midnight email triggers an immediate notification. The v2 PRD has not changed this behavior. The quiet hours exemption remains binary: `exemptCategories: ['interview_invite', 'offer']`. An interview invitation received at 11:30 PM UK time that expects a response "within the next few business days" still triggers a midnight notification.

*Analysis:* The v2 fixes focused on classification accuracy and pipeline reliability, not on notification timing intelligence. The original concern stands unchanged: most interview invitations do not require a midnight response. The response_deadline is now extractable (the extraction pipeline is well-defined), but WF-EM-06 does not use it to modulate notification timing. The notification fires as soon as the email reaches the "urgent unnotified" query, regardless of whether the response deadline is hours or days away.

*What would fix it:* Add a quiet-hours rule: during 10PM-7AM, hold interview_invite notifications until 7AM UNLESS the extracted response_deadline is within 8 hours. This requires WF-EM-06 to wait for extraction before notifying, which may conflict with the desire to notify early. A practical compromise: during quiet hours, send interview notifications at 7AM with a "[Morning Review]" subject prefix instead of "[URGENT: Interview]".

*Score:* 6/10 (unchanged from v1 context; not addressed)

---

**Round 2: No mechanism for candidate to correct a misclassification and have the correction propagate**

*Concern:* Section 7.4 describes a manual review queue where low-confidence emails are flagged with `needs_review = true` and included in the daily summary with a "Please verify" note. But there is no mechanism for the candidate to submit the correction. The PRD mentions "future: via simple reply-based interface" but this is undefined. If the candidate sees a misclassified email in the daily summary, she has no way to fix it through the system. She would need to manually update the database.

*Analysis:* The `email_classifications` table has `manually_reviewed`, `manual_classification`, and `reviewed_at` fields. The schema supports correction. But no workflow, UI, or interface exists to populate these fields. More critically, even if the candidate could correct the classification, there is no cascade mechanism: changing a classification from `acknowledgment` to `interview_invite` should trigger re-extraction, re-labeling, notification dispatch, and Module 4/6 updates. None of this is defined. The classification correction is a dead-end in the data model -- it can store the correction but nothing acts on it.

*What would fix it:* Define a minimal correction interface (even a simple n8n webhook that accepts `email_id` + `correct_classification` and triggers re-processing from the classification stage forward). Add a "reclassification cascade" workflow that re-runs extraction, labeling, and integration when a classification is manually corrected.

*Score:* 5/10

---

**Round 3: Safety escalation check for offers may over-escalate, increasing Sonnet costs unnecessarily**

*Concern:* The new Safety Escalation Check (Section 14.2) forces Sonnet escalation when the email body contains keywords like "offer", "salary", "start date", "employment terms", "compensation", "package." These keywords appear in many emails that are NOT offers: recruiter outreach emails routinely mention "salary" and "compensation package," job alerts contain "competitive salary," and even acknowledgment emails sometimes reference "the offered position" (meaning the position offered to apply for, not a job offer).

*Analysis:* The safety escalation is correctly designed to prevent false negatives on offers -- the most critical misclassification. But the keyword list is broad. Testing against typical weekly email volume: of 60 emails, perhaps 15 recruiter emails mention "salary," 10 job alerts mention "competitive salary" or "offer," and 5 acknowledgments reference "position." That is 30 emails potentially triggering safety escalation, compared to the expected 0-1 actual offers. Sonnet costs $0.0135 per escalation. 30 unnecessary escalations = $0.41/week. Not financially catastrophic, but the noise-to-signal ratio (30:1) means the safety check is essentially escalating half of all emails. The check also runs even when Haiku has already classified with high confidence (e.g., Haiku says `recruiter_outreach` at 0.95 confidence, but the email mentions "salary" so Sonnet is called anyway).

*What would fix it:* Make the safety escalation conditional: only trigger when (a) the email is from an employer with an active application AND Haiku did NOT classify as `offer`, OR (b) Haiku classified as `offer` regardless (double-check). Remove generic keywords like "salary" and "compensation" that appear in non-offer contexts. Keep "we'd like to offer you" and "offer of employment" as trigger phrases.

*Score:* 6/10

---

**Round 4: Thread label precedence still not defined -- multi-status threads remain confusing**

*Concern:* v1 Round 1 identified that when a thread escalates from `Job/Applied` to `Job/Interview/Upcoming`, the old label remains. The v2 PRD did not address this. Section 9.5 still states labels are applied at the message level and adds the parent `Job/Interview` label to the thread when it contains an interview invitation, but does not define a label precedence rule or remove lower-priority labels from earlier messages.

*Analysis:* In Gmail, a thread with both `Job/Applied` and `Job/Interview/Upcoming` labels shows both labels when viewing the thread. This creates visual confusion: the candidate cannot tell at a glance whether this thread represents a pending application or an upcoming interview. With the v2 label hierarchy (Section 9.1), a thread could theoretically accumulate `Job/Applied`, `Job/Interview/Upcoming`, `Job/Interview/Completed`, and even `Job/Offer` as the application progresses. The candidate would need to read the individual messages to determine the current state. The `primary_classification` field in `email_threads` (Section 13.4) tracks the thread's highest-priority classification, but this is a database concept that does not affect the Gmail label display.

*Score:* 5/10 (unchanged; not addressed)

---

**Round 5: Job alert HTML parsers use regex patterns that will break when platforms update their email templates**

*Concern:* Section 8.3 contains regex-based HTML parsers for LinkedIn, Indeed, TotalJobs, and Reed job alerts. These parsers match specific CSS class names (`jobTitle`, `companyName`, `companyLocation`) and HTML structures (`<a href="https://www.linkedin.com/comm/jobs/view/...">`). Job boards update their email templates regularly -- LinkedIn alone has changed its email HTML structure three times in the past two years. When a template changes, the regex parser silently returns zero jobs, and the Claude fallback is only used for "platforms without a dedicated parser," not for parsers that return empty results.

*Analysis:* The LinkedIn parser (Section 8.3) has two patterns (card-based and list-based) with a fallback between them: "if (jobs.length === 0)" use Pattern 2. But there is no fallback to Claude if BOTH patterns return zero results. The email would be classified as `job_alert`, inserted into `email_extracted_data` with `total_jobs_count: 0`, and no jobs would be fed to Module 1. The daily summary would show "22 job alerts processed (0 new jobs found)," and the candidate might not notice that the parsers have silently failed. There is no alerting on parser failure rates.

*What would fix it:* Add a fallback: if a platform-specific parser returns zero jobs for an email that clearly contains job listings (subject line says "15 new jobs"), fall back to the Claude generic parser. Add monitoring: if the parser success rate drops below 50% for any platform over a 7-day window, send an alert. Log the parser version and HTML structure fingerprint for debugging.

*Score:* 5/10

---

**Round 6: The relevance scoring algorithm has a double-counting problem for role title + seniority**

*Concern:* The new `scoreRoleRelevance()` function (Section 10.2b) scores five dimensions independently. But Dimension 1 (role title match, 0-30 points) and Dimension 2 (seniority alignment, 0-20 points) overlap significantly. A "Head of L&D" scores 30 on title match AND 20 on seniority alignment = 50 points from essentially the same signal (it is a senior L&D role). A "Junior HR Assistant" scores 2 on title match AND 0 on seniority = 2 points. The seniority dimension adds no discriminating power beyond what the title match already provides, but it inflates scores for good matches and deflates scores for poor ones, making the tier boundaries less meaningful.

*Analysis:* With five dimensions totaling 100 points max (30+20+20+15+15), a role that matches on title and seniority alone scores 50/100 (B-tier threshold is 60). Adding a matching salary (20 points) gets to 70, which is B-tier. This seems reasonable until you consider that a role titled "Senior L&D Manager" in an unknown location with undisclosed salary scores: 30 (title) + 15 (mid seniority) + 10 (salary unknown neutral) + 8 (location unknown neutral) + 7 (sector unknown) = 70. That is a B-tier rating for a role with almost no concrete information. The neutral scores (10, 8, 7 for unknown fields) combined with the double-counting of title/seniority inflate scores upward, meaning most recruiter proposals with a plausible title will land in B-tier regardless of actual fit.

*Score:* 6/10

---

**Round 7: No handling of duplicate notifications when the same interview is mentioned in multiple emails**

*Concern:* If an employer sends an interview invitation and then a follow-up email ("Just checking you received our interview invitation..."), the system classifies both emails independently. The first is classified as `interview_invite` and triggers an urgent notification. The second could be classified as `follow_up_request` or as another `interview_invite`. If classified as a second `interview_invite`, the system creates a second notification and a second draft confirmation. The notification deduplication (Section 12.6) checks `email_id` uniqueness, not content uniqueness -- so two different emails about the same interview each generate their own notification.

*Analysis:* The `email_notifications` table deduplicates on `email_id` + `notification_type`, preventing duplicate notifications for the same email. But two different emails about the same interview are two different `email_id` values, so both pass the dedup check. The company matching logic (Section 8.7) would match both to the same application in Module 4, and Module 4 would receive two `interview_scheduled` updates for the same interview. The second update is idempotent (same status), but the candidate receives two notifications and two drafts, creating confusion about whether there are one or two interviews.

*What would fix it:* Add interview-level deduplication: before sending a notification for an `interview_invite`, check whether a notification was already sent for the same company + role + similar date within the last 48 hours. If so, suppress the duplicate and log it.

*Score:* 5/10

---

**Round 8: Recruiter response drafts for D-tier roles may damage professional reputation through cold brevity**

*Concern:* The C-tier recruiter response prompt (Section 11.2) is well-written and now avoids salary disclosure. But the D-tier response is described only in the acceptance criteria (US-516): "D-tier / Blacklisted: Polite one-line decline." A one-line decline to a recruiter who took time to personalize their outreach (even if the role is irrelevant) risks damaging the candidate's professional reputation. Recruiters talk to each other. A candidate known for curt responses is less likely to receive future quality opportunities.

*Analysis:* The relevance scoring (Section 10.2b) assigns D-tier to scores 0-39. This includes both genuinely irrelevant spam-like outreach (mass-blast recruiter emails about junior admin roles) and misdirected-but-sincere outreach (a recruiter proposing a role that is genuinely wrong for the candidate but clearly put effort into the message). The one-line decline is appropriate for the former but damaging for the latter. The `personalization_score` field exists in `recruiter_contacts` (Section 13.5), and the recruiter quality scoring considers it, but the draft generation does not factor personalization into the response. A personalized D-tier email deserves a C-tier response; a mass-blast D-tier email deserves a one-line decline or no response.

*Score:* 5/10

---

**Round 9: Extraction prompt instructs Claude to "not infer or assume" but many required fields need inference**

*Concern:* The extraction prompt (Section 8.2) states "Extract only information explicitly stated in the email. Do not infer or assume." But many extraction fields require inference. Example: `interview_timezone` -- if the email says "10:30 AM" with no timezone, the extraction prompt says "Assume UK time (GMT or BST depending on date) if not specified." That IS an inference. Similarly, `interview_format` is "Required" but many interview invitations do not explicitly state the format (an email saying "we'd like to meet you at our offices" requires inferring `in_person`). The prompt contradicts itself: "do not infer" vs "assume UK time if not specified."

*Analysis:* The contradiction between "do not infer" and "assume defaults" creates ambiguous behavior. Claude may interpret the instruction strictly and return `null` for timezone (following "do not infer"), or may apply the default (following "assume UK time"). Different Claude model versions may resolve this ambiguity differently, causing classification drift. The required fields that most commonly need inference: `interview_format` (often implied, rarely explicit), `interview_timezone` (almost never explicit in UK emails), `contract_type` (rarely stated in interview invitations), and `rejection_stage` (requires knowing whether the candidate was interviewed, which is Module 4 context, not email context).

*Score:* 5/10

---

**Round 10: The daily summary email could itself be classified as job-related if its subject or content triggers the classifier**

*Concern:* The daily summary (Section 14.7) is sent from `selvi-system@apiloom.io` with subject "Daily Job Email Summary -- [date]." The v2 fix correctly excludes `selvi-system@apiloom.io` from classification via the sender pattern database. However, the summary email contains job-related content: company names, role titles, interview dates, and recruiter names. If the sender exclusion fails (misconfigured pattern, database query error, or a future change to the sender address), the summary email would be classified by Claude. Given its content (interview invitations, offers, rejections), Claude would likely classify it as a high-priority email, potentially creating notifications about already-processed information. The sender exclusion is a single point of defense for a potentially recursive failure.

*Analysis:* The v2 fix added three layers of defense: sender pattern DB, code-level `SYSTEM_ADDRESSES` check, and Phase 0 task. This is robust. The residual risk is if the system email address changes (e.g., migrating from `apiloom.io` to a new domain) and the exclusion list is not updated. This is a configuration management concern, not an architectural one. The fix quality is good; the residual risk is low.

*Score:* 7/10

---

#### Persona 1 Summary (v2): The Candidate (Selvi)

| Round | Concern | Score |
|-------|---------|-------|
| 1 | Quiet hours bypass for non-actionable interviews | 6/10 |
| 2 | No correction mechanism for misclassifications | 5/10 |
| 3 | Safety escalation over-triggers on common keywords | 6/10 |
| 4 | Thread label precedence undefined | 5/10 |
| 5 | Job alert HTML parsers will break silently | 5/10 |
| 6 | Relevance scoring double-counts title/seniority | 6/10 |
| 7 | Duplicate notifications for same interview | 5/10 |
| 8 | D-tier drafts too curt for personalized outreach | 5/10 |
| 9 | Extraction prompt self-contradicts on inference | 5/10 |
| 10 | Recursive processing defense depth is good | 7/10 |
| **Average** | | **5.5/10** |

---

### Persona 2: Technical Architect / n8n Expert -- Rounds 11-20

**Perspective:** Gmail API, polling architecture, OAuth2, n8n execution model, ARM64.

---

**Round 11: History API historyId expiry creates a 7-day data gap risk if the system is offline**

*Concern:* The v2 fix correctly uses Gmail's History API with `startHistoryId`. Section 6.3 notes "Google retains history for ~7 days" and falls back to reconciliation if the historyId is expired (HTTP 404). But the reconciliation query uses `-label:Job-Processed in:inbox` which only catches emails still in the inbox. If the system is offline for 8+ days (e.g., server maintenance, billing issue, hardware failure), the historyId expires AND emails older than a few days may have been archived by the candidate manually. These emails would be permanently missed.

*Analysis:* The reconciliation query (`-label:Job-Processed in:inbox newer_than:7d`) includes `newer_than:7d`, which covers the 7-day window. This mitigates the gap for inbox emails. But if the candidate archives emails during the downtime (moving them out of the inbox), those archived emails would NOT be caught by the `in:inbox` filter. The daily reconciliation at 3AM uses `newer_than:7d` which helps, but again only for inbox messages. A more defensive reconciliation would drop the `in:inbox` filter during recovery: `-label:Job-Processed newer_than:14d` to catch any unprocessed email regardless of inbox status.

*Score:* 7/10

---

**Round 12: Workflow lock expires_at of 10 minutes may be too short for Claude API latency spikes**

*Concern:* The workflow lock pattern (Section 5.2) sets `expires_at = NOW() + INTERVAL '10 minutes'`. If Claude's API has a latency spike (rate limiting, service degradation), a workflow processing 20 emails at 5+ seconds per Claude call could take 100+ seconds. That is within the 10-minute window. But if the Claude circuit breaker trips and the workflow retries with backoff (Section 16.3), the total execution time could exceed 10 minutes. The lock expires, a second execution starts, and both process emails concurrently. The `FOR UPDATE SKIP LOCKED` prevents same-row conflicts, but the second execution queries for new rows, potentially causing out-of-order processing.

*Analysis:* The `FOR UPDATE SKIP LOCKED` row-level lock is the real protection here. Even if the workflow lock expires and a second execution starts, the second execution cannot process rows already locked by the first. The risk is not duplicate processing but rather out-of-order processing: the second execution might classify email #21 before the first execution finishes email #1. For the status-based pipeline (ingested -> classified -> extracted), out-of-order is acceptable -- each stage picks up emails in the correct status regardless of order. The 10-minute lock is a reasonable balance between preventing concurrent execution and allowing recovery from stuck workflows.

*Score:* 7/10

---

**Round 13: Sent folder polling still uses timestamp-based `after:` query, not History API**

*Concern:* The inbox polling was upgraded to History API (v2 fix), but Section 6.7 still uses timestamp-based polling for the sent folder: `?q=in:sent after:{{ lastSentPollTimestamp }}`. The same timestamp-boundary problem that was identified as a must-fix for inbox polling (v1 Round 11) exists here for sent folder monitoring. A sent email at the boundary second could be missed by both consecutive polls.

*Analysis:* The sent folder polling is less critical than inbox polling -- it tracks outbound responses for recruiter follow-up detection, not inbound interview invitations. Missing a sent email means the recruiter tracker does not know the candidate responded, which causes a stale "awaiting your response" flag in the daily summary. The impact is an incorrect reminder, not a missed opportunity. The History API could be used for sent folder monitoring too (`historyTypes=messageAdded` with `labelId=SENT`), but the v2 PRD did not extend the History API migration to the sent folder.

*Score:* 6/10

---

**Round 14: No database transaction wrapping the extraction + Module 4 update + status change**

*Concern:* v1 Round 17 recommended wrapping extraction + Module 4 update + status change in a single database transaction. The v2 fix added `FOR UPDATE SKIP LOCKED` (preventing concurrent processing of the same row) but did NOT implement the transaction wrapping. The scenario: WF-EM-03 inserts into `email_extracted_data`, calls SW-EM-02 to update Module 4, and then the n8n execution crashes before updating the email status to `extracted`. On the next run, the email is still in `classified` state. The extraction re-runs. The `UNIQUE (email_id)` constraint on `email_extracted_data` causes a conflict. The `ON CONFLICT` behavior is not specified for this table.

*Analysis:* The `email_extracted_data` table has `CONSTRAINT unique_email_extraction UNIQUE (email_id)` (Section 13.3). Without `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`, the re-insertion will throw an error, the workflow will fail for this email, and it will be stuck in `classified` state permanently. The error handling (Section 16.1) would log this as a "Postgres Connection Error" (incorrect categorization) and the email would appear in the "stuck emails" monitoring query. Manual intervention would be needed to resolve it.

*What would fix it:* Either (a) wrap the multi-step operation in a Postgres transaction (BEGIN...COMMIT) so the status update and data insertion are atomic, or (b) add `ON CONFLICT (email_id) DO UPDATE SET ...` to the extraction insert so re-processing is idempotent, or (c) add a check at the start of WF-EM-03: if `email_extracted_data` already has a record for this email, skip re-extraction and just retry the status update.

*Score:* 5/10

---

**Round 15: n8n SplitInBatches node processes items sequentially, adding latency to the pipeline**

*Concern:* WF-EM-02 (Section 14.2) uses `[SplitInBatches: Process Each Email] Batch Size: 5` to classify emails. n8n's SplitInBatches node processes items within a batch sequentially (not in parallel). Each Claude API call takes 1-3 seconds. With 5 emails per batch, classification takes 5-15 seconds per batch. If there are 20 unclassified emails (after a polling burst), that is 4 batches = 20-60 seconds. Combined with the cron interval, this creates a classification queue that backs up during burst periods.

*Analysis:* n8n does not natively support parallel processing within a workflow. The SplitInBatches node is sequential by design. For most operation (steady-state 2-3 emails per poll cycle), this is fine. During burst periods (first day of job alert setup, 30+ emails in one poll), the queue depth could exceed a single 5-minute window's capacity. The pipeline's status-based design handles this gracefully -- unprocessed emails accumulate in `ingested` state and are picked up by subsequent cycles. The worst case is delayed classification, not missed classification. However, the 5-minute SLA for interview invitations is harder to meet during bursts if 20 job alert emails are queued ahead of the interview invitation.

*What would fix it:* Change the extraction query in WF-EM-02 to prioritize non-alert, non-marketing emails. The current query (Section 14.2) does not have priority ordering. Add `ORDER BY CASE WHEN sender_pattern_match NOT IN ('job_alert', 'marketing') THEN 0 ELSE 1 END, e.date ASC` to process potentially urgent emails first.

*Score:* 6/10

---

**Round 16: The classification pipeline sends Sonnet the full thread history, which could contain purged email bodies**

*Concern:* When escalating to Sonnet, Section 7.3 states the system includes "Complete thread history (all previous messages in the thread)." The Sonnet escalation query in WF-EM-02 (Section 14.2) fetches `SELECT * FROM emails WHERE gmail_thread_id = {{ threadId }}`. If older emails in the thread have had their bodies purged (7-day retention), the query returns rows with `body_plain = NULL, body_html = NULL, body_stripped = NULL`. The Sonnet prompt would include empty body text for earlier thread messages, losing the context that was supposed to aid classification.

*Analysis:* This is a time-dependent bug. During the first 7 days, thread context is complete. After 7 days, older thread messages have purged bodies. The Sonnet escalation prompt says "Complete thread history (all previous messages in the thread)" -- but "complete" is only true for threads younger than the retention period. For long-running recruiter conversations (which can span weeks), only the recent messages would have body text. The classification still has access to earlier messages' `subject` and `classification` fields (which are not purged), providing some context. But the Sonnet escalation was specifically designed for ambiguous cases where full context matters.

*Score:* 6/10

---

**Round 17: Gmail API `format=full` returns base64-encoded body parts that require careful decoding**

*Concern:* Section 6.3 fetches messages with `?format=full` and Section 14.9 (SW-EM-01) lists "Handle base64 encoding" as a processing step. But the PRD does not show the base64 decoding logic. Gmail's `format=full` returns body parts with `data` fields in URL-safe base64 encoding (RFC 4648 Section 5), which uses `-` and `_` instead of `+` and `/`. Standard base64 decoders will fail on URL-safe base64. Multipart messages can have nested parts (e.g., multipart/alternative containing text/plain and text/html, each base64-encoded). The PRD shows the parsing output format (Section 6.4) but not the multipart traversal logic.

*Analysis:* n8n's built-in Gmail node handles base64 decoding automatically when using the native node operations. But the PRD uses HTTP Request nodes for Gmail API calls (Section 14.1, Section 6.3), which return raw API responses. Raw Gmail API responses require manual base64url decoding and multipart MIME traversal. This is a common implementation pitfall. The HTML stripping code (Section 6.4) assumes it receives decoded HTML, but if the decoding step is missing or incorrect, it receives base64 strings and the regex-based stripping produces garbage.

*Score:* 5/10

---

**Round 18: No graceful degradation when Claude API is completely unavailable**

*Concern:* Section 16.3 implements a circuit breaker for Claude API calls. When the circuit breaker opens (after 3 consecutive failures), all Claude-dependent processing stops: classification, extraction, and draft generation. But the PRD does not define what happens to the pipeline during this outage. Emails accumulate in `ingested` state. Interview invitations that would normally be classified within 5 minutes are stuck. The candidate receives no notifications.

*Analysis:* The circuit breaker recovers after 60 seconds (`recoveryTimeout: 60000`), which is fast. But if Claude is down for an extended period (hour+), the queue grows. When Claude recovers, the system processes the backlog, but interview invitations that arrived during the outage may now be hours old. The urgent notification still fires, but the "within 5 minutes" SLA is violated. The system has no fallback classification path for when Claude is unavailable. The sender pattern matching and subject heuristics (Steps 1-2 in the pipeline) still function, but most emails require Claude for classification. There is no "degrade to heuristic-only classification" mode.

*What would fix it:* When the Claude circuit breaker is open, apply a conservative heuristic: any email from a sender domain matching an active application should trigger a notification regardless of classification. This catches interview invitations during Claude outages at the cost of some false positives.

*Score:* 5/10

---

**Round 19: The daily reconciliation at 3AM could process hundreds of already-processed emails if the Job-Processed label is missing**

*Concern:* The daily reconciliation query (Section 6.3) uses `-label:Job-Processed in:inbox newer_than:7d`. The `Job-Processed` label is an internal Gmail label applied by WF-EM-04. If WF-EM-04 fails or falls behind (labeling workflow disabled, Gmail API error), processed emails do not receive the `Job-Processed` label. The daily reconciliation then re-fetches these emails. The `ON CONFLICT (gmail_message_id) DO NOTHING` clause in the email insert prevents duplicates, so no harm is done. But the reconciliation fetches up to 200 messages (`maxResults=200`), and each requires a `messages.get` call. 200 unnecessary API calls per day is wasteful and could trigger rate warnings in monitoring.

*Analysis:* This is a low-severity issue because: (1) the dedup prevents any processing harm, (2) 200 API calls per day is far below Gmail quotas, and (3) it only manifests when WF-EM-04 is failing, which should trigger its own alerts. The reconciliation is a safety net, and safety nets should be robust even when other components fail. However, the monitoring noise (200 ingestion attempts returning "already exists" every night) could mask real issues.

*Score:* 7/10

---

**Round 20: The system has no integration tests or end-to-end test plan for the multi-workflow pipeline**

*Concern:* The rollout plan (Section 18) describes manual testing ("Test Gmail polling manually," "Manual review of 20 classified emails") but no automated integration tests. The pipeline has 8 workflows, 2 sub-workflows, and multiple shared database tables. A change to the email schema, a Claude model update, or a Gmail API behavior change could break the pipeline in subtle ways. Without automated tests, regressions are caught by the weekly manual audit (20 emails) or by the candidate noticing problems.

*Analysis:* For a personal project with a single user, full CI/CD is over-engineering. But a basic smoke test -- ingest a known test email, verify it progresses through ingested -> classified -> extracted -> labeled -> completed -- would catch most pipeline regressions. n8n does not natively support automated testing, but a test workflow that inserts a test email into the `emails` table and polls for its status progression would work. The calibration set (Section 7.6) tests classification accuracy but not pipeline flow. No test covers the full pipeline from ingestion to Module 4 update.

*Score:* 5/10

---

#### Persona 2 Summary (v2): Technical Architect / n8n Expert

| Round | Concern | Score |
|-------|---------|-------|
| 11 | History API historyId expiry after extended downtime | 7/10 |
| 12 | Workflow lock expiry during Claude latency spikes | 7/10 |
| 13 | Sent folder polling still uses timestamp-based approach | 6/10 |
| 14 | No transaction wrapping for extraction pipeline | 5/10 |
| 15 | Sequential batch processing delays urgent emails | 6/10 |
| 16 | Sonnet escalation may receive purged thread bodies | 6/10 |
| 17 | Base64url decoding not shown for Gmail API responses | 5/10 |
| 18 | No graceful degradation during Claude API outage | 5/10 |
| 19 | Reconciliation over-fetches if labeling falls behind | 7/10 |
| 20 | No integration tests for multi-workflow pipeline | 5/10 |
| **Average** | | **5.9/10** |

---

### Persona 3: Email/Communication Expert -- Rounds 21-30

**Perspective:** Tone, threading, professional standards, UK business email conventions.

---

**Round 21: The v2 C-tier decline prompt is improved but still reveals too much about search focus**

*Concern:* The v2 C-tier recruiter response prompt now avoids salary disclosure, which is a significant improvement. However, it still instructs: "Describes what she IS looking for in general terms: senior L&D leadership roles or university lecturing positions in the South East of England." This narrows the candidate's perceived scope. A recruiter who receives this response will only send senior L&D roles in the South East, potentially excluding roles that the candidate might have considered (e.g., a Director-level role in the Midlands that would merit relocation, or a consulting role in a different sector). The v1 fix addressed the most damaging disclosure (salary) but the remaining specificity still constrains future opportunities.

*Analysis:* The balance is between being helpful (so the recruiter knows what to send next) and being strategic (not constraining the recruiter's mental model of what the candidate wants). The v2 prompt is considerably better than v1. The remaining disclosure -- "senior L&D leadership or lecturing, South East" -- is broad enough to avoid most strategic damage. A recruiter reading this would still consider adjacent roles (OD, Talent, HR leadership) and nearby geographies. The risk is low but non-zero.

*Score:* 7/10

---

**Round 22: The interview confirmation draft does not acknowledge any preparation requirements**

*Concern:* Many UK interview invitations include preparation instructions: "Please prepare a 10-minute presentation on your approach to leadership development" or "Please bring a portfolio of your L&D programme designs." The extraction pipeline captures `preparation_instructions` and `what_to_bring` (Section 8.1). But the interview confirmation draft prompt (Section 11.2) does not mention these fields. The draft confirms date, time, and format but does not acknowledge preparation requirements. A professional response should say "I have noted the request to prepare a presentation on..." -- omitting this makes the response seem incomplete and suggests the candidate did not fully read the invitation.

*Analysis:* The draft prompt (Section 11.2) includes `interview_format`, `interview_location_or_link`, and `interviewer_name` as context variables, but not `preparation_instructions` or `what_to_bring`. These fields exist in the extraction schema and would be available to the drafting workflow. Adding them to the prompt context and including a conditional instruction ("If preparation instructions are provided, acknowledge them in the response") would make the draft significantly more professional.

*Score:* 5/10

---

**Round 23: Follow-up response draft promises to provide items the candidate may not have**

*Concern:* The follow-up response draft prompt (Section 11.2) instructs: "Confirms she will provide the requested items." But the candidate may not have the requested items readily available. A request for "two professional references" requires the candidate to contact referees first. A request for "proof of right to work" may require ordering a new document. The draft unconditionally promises delivery, which could set expectations the candidate cannot meet.

*Analysis:* The draft prompt has a qualifier: "If the request is for references, notes she will provide them shortly (she may need to contact referees first)." This handles the references case. But other requests (transcripts, certificates, assessments) do not have similar qualifiers. A request for a PhD certificate that is stored in a box in the attic should not receive a draft promising to provide it "shortly." The draft should acknowledge the request and indicate a timeframe, but should not commit to delivery without the candidate's input.

*What would fix it:* Change the instruction from "Confirms she will provide the requested items" to "Acknowledges the request and indicates she will review what is needed. Does NOT commit to a specific delivery timeline unless the candidate has already indicated availability of the items."

*Score:* 5/10

---

**Round 24: The eight few-shot examples in the classification prompt cover boundaries well but are all positive-classification examples**

*Concern:* The v2 classification prompt (Section 7.3) includes 8 few-shot examples covering ambiguous boundaries: recruiter/interview, ack/offer, indirect interview, marketing/alert, recruiter-not-interview, positively-worded rejection, follow-up, and informal offer. All 8 examples result in a job-related classification. None demonstrate a `not_job_related` classification. Claude may develop a bias toward classifying every email as job-related because all training examples are job-related. A personal email asking "How's the job hunt going?" has no exemplar showing it should be classified as `not_job_related`.

*Analysis:* The few-shot examples serve two purposes: teaching Claude the category boundaries and calibrating its classification threshold. By including only positive examples, the prompt implicitly teaches Claude that all emails presented to it are job-related. This is partially mitigated by the sender pattern fast-path, which filters known non-job senders before Claude. But emails from unknown senders (friends, family) that mention job-related keywords would be sent to Claude with no negative exemplar to guide classification. The addition of 1-2 `not_job_related` examples (a personal email mentioning job keywords, a spam email about career coaching) would improve discrimination.

*Score:* 6/10

---

**Round 25: Auto-drafted acknowledgment replies for A-tier applications risk looking automated to observant employers**

*Concern:* The acknowledgment reply draft (Section 11.2) creates a 2-3 sentence reply to A-tier application confirmations. These replies are sent from Gmail (maintaining the candidate's usual sending pattern) and appear human. But if the candidate applies to 3 A-tier roles at companies that share HR tools or belong to the same corporate group, and all three acknowledgment replies follow the same structure (thank + confirm interest + offer additional info), an observant HR professional might notice the formulaic similarity and suspect automation. The UK corporate L&D market is small; HR professionals at competing companies talk to each other.

*Analysis:* This is a low-probability concern. The drafts are generated by Claude, which produces varied language. Three drafts to three companies would likely differ in wording even with the same prompt. The candidate also reviews and can edit each draft before sending. The risk is theoretical rather than practical. However, the larger strategic question is whether acknowledging automated acknowledgments adds value at all. Many hiring processes explicitly state "please do not reply to this email." Even when sent from a monitored address, an acknowledgment reply from a candidate does not typically influence the hiring decision.

*Score:* 7/10

---

**Round 26: The system creates reply drafts in Gmail but does not track whether the candidate edited the draft before sending**

*Concern:* v1 Round 29 identified no draft quality feedback loop. The v2 PRD did not address this. The `email_drafts` table tracks `status` (created, in_gmail, sent_by_candidate, discarded, failed) but the PRD does not define how `sent_by_candidate` status is detected. The sent folder monitoring (Section 6.7) could compare sent messages against stored drafts by thread_id, but this comparison is not specified in any workflow. Without knowing whether the candidate sent the draft as-is, edited heavily, or discarded it, the system cannot learn.

*Analysis:* This was a v1 "Nice-to-Have" (v1 evaluation, item 2 in the Nice-to-Have list). It remains unaddressed. The immediate impact is low -- the system functions without feedback. The long-term impact is that draft quality stagnates. The implementation would require: (1) in WF-EM-08, compare sent emails against `email_drafts` records by thread_id, (2) if a match is found, compare content and record edit distance, (3) if a draft thread has no corresponding sent email after 7 days, mark as discarded. This is a reasonable v1.x enhancement.

*Score:* 6/10

---

**Round 27: Notification emails use plain text format, missing an opportunity for scannability**

*Concern:* Section 12.2 shows the notification email format using plain text with ASCII separators (`====`, `----`). The Resend API supports HTML emails. A well-formatted HTML notification with bold key fields (company name, role, date/time), colored urgency indicators, and a prominent "View in Gmail" button would be significantly more scannable on mobile devices, where most notifications are first read. The candidate checking her phone would parse a structured HTML notification in 3 seconds; the ASCII text format takes 10+ seconds to scan.

*Analysis:* The Resend node configuration (Section 12.5) sends only `"text": "{{ $json.notificationBody }}"` -- no HTML body. Resend supports both `text` and `html` fields. For a system whose core value proposition is "surface critical information quickly," the notification format is surprisingly low-fidelity. This is not a functional gap (the information is there) but a UX gap. Mobile email clients render HTML well; plain text notifications look dated.

*Score:* 6/10

---

**Round 28: The candidate signature includes a phone number placeholder that the draft validator does not catch**

*Concern:* v1 Round 30 identified this issue: the signature has `+44 XXXX XXXXXX` as a placeholder, and the draft validator checks for `{{` template syntax but not for `XXXX` patterns. The v2 PRD did not fix this. The signature configuration in Section 11.5 still shows `+44 XXXX XXXXXX`. The v1 evaluation recommended adding `[phone number]`, `XXXX`, and `[placeholder]` patterns to the validation checklist, but this was not implemented.

*Analysis:* This is a deployment configuration issue, not an architectural one. It would be caught during Phase 4 testing when the candidate reviews the first live draft. But it should not reach Phase 4 -- the Phase 0 "configuration verification" task recommended in v1 was not added. A startup validation that checks all `system_config` entries for placeholder values would catch this before any email is sent.

*Score:* 6/10 (unchanged; not addressed)

---

**Round 29: The system never marks an email as `completed` -- the final status transition is undefined**

*Concern:* The email status state machine (Section 13.1) defines states: `ingested -> classified -> extracted -> labeled -> draft_created -> completed -> skipped -> error`. WF-EM-01 sets `ingested`. WF-EM-02 sets `classified`. WF-EM-03 sets `extracted`. WF-EM-04 sets `labeled`. WF-EM-05 sets `draft_created`. But no workflow sets `completed`. The GDPR body purge function (Section 13.12) purges emails with `status IN ('completed', 'skipped')`. If emails never reach `completed` status, their bodies are never purged, violating the stated 7-day retention policy.

*Analysis:* Emails that need drafts progress to `draft_created`. Emails that do not need drafts (rejections, job alerts, marketing) progress to `labeled` and stop. Neither state is `completed`. The purge function only purges `completed` and `skipped` emails. This means: (1) rejection emails (status: `labeled`) have their bodies retained indefinitely, (2) marketing emails (status: `labeled`) have their bodies retained indefinitely, (3) emails with drafts (status: `draft_created`) have their bodies retained indefinitely. The GDPR purge is effectively broken by the missing `completed` status transition.

*What would fix it:* Add a cleanup step to WF-EM-04 or a separate daily workflow that transitions all `labeled` and `draft_created` emails to `completed` after 24 hours (allowing time for any re-processing). Alternatively, modify the purge function to include `labeled` and `draft_created` statuses.

*Score:* 4/10

---

**Round 30: No mechanism to handle when Gmail draft creation fails because the original email was deleted or archived**

*Concern:* WF-EM-05 creates Gmail drafts as replies to original emails, using the original email's `threadId`. If the candidate deletes or archives the original email between ingestion and draft creation (a 10-20 minute window), the Gmail API may return an error. The error handling (Section 16.1) classifies "Draft Create Error" as LOW severity with "Retry, log failure, continue processing." But the retry will fail for the same reason -- the thread no longer exists or the message was trashed. The email remains in `labeled` status permanently, never reaching `draft_created` or `completed`, compounding the purge gap from Round 29.

*Analysis:* The candidate is unlikely to delete an interview invitation email within 20 minutes of receiving it, especially if she has not yet been notified about it. The more realistic scenario is archiving: the candidate archives all emails as a habit, and the interview email is archived before the draft is created. Gmail drafts can be created in archived threads (archiving does not delete the thread), so this should work. The risk is limited to the deletion scenario, which is unlikely for important emails. But the stuck-status consequence (no path to `completed`, no body purge) is the real problem.

*Score:* 6/10

---

#### Persona 3 Summary (v2): Email/Communication Expert

| Round | Concern | Score |
|-------|---------|-------|
| 21 | C-tier decline still reveals search focus | 7/10 |
| 22 | Draft does not acknowledge preparation requirements | 5/10 |
| 23 | Follow-up draft promises items candidate may not have | 5/10 |
| 24 | Few-shot examples lack not_job_related exemplar | 6/10 |
| 25 | Ack replies risk looking formulaic to observant employers | 7/10 |
| 26 | No draft edit tracking / feedback loop | 6/10 |
| 27 | Plain text notifications miss mobile UX opportunity | 6/10 |
| 28 | Phone number placeholder still not validated | 6/10 |
| 29 | No email ever reaches `completed` status; GDPR purge broken | 4/10 |
| 30 | Draft creation fails if original email deleted | 6/10 |
| **Average** | | **5.8/10** |

---

### Persona 4: AI/LLM Specialist -- Rounds 31-40

**Perspective:** Classification accuracy, prompt engineering, extraction quality, model management.

---

**Round 31: The eight few-shot examples introduce a hidden input token cost that is not reflected in the cost model**

*Concern:* Section 7.5 estimates per-email classification cost at 1,500 input tokens + 200 output tokens for Haiku. The 8 few-shot examples (Section 7.3) add approximately 800-1,200 tokens to every classification call. The system prompt with examples is now ~2,500 tokens, and the user prompt with email body is ~1,500 tokens, totaling ~4,000 input tokens per classification. The cost estimate is based on 1,500 input tokens -- less than half the actual count. The per-email cost doubles from $0.000625 to ~$0.001125.

*Analysis:* At $0.001125 per email, the weekly cost for 20 Claude-classified emails is $0.023, and the monthly cost is ~$0.10. Still negligible. The cost model error is 2x, but the absolute cost is so low that it does not matter operationally. However, the cost estimation section should reflect accurate token counts to maintain document credibility. If a reviewer checks the cost estimate against the actual prompt length, the discrepancy undermines confidence in other estimates.

*Score:* 7/10

---

**Round 32: The classification prompt uses a single system prompt for both classification and sub-classification, creating cognitive load for the model**

*Concern:* The system prompt (Section 7.3) asks Claude to simultaneously: (1) classify into 9 categories, (2) assign a sub-category from a category-specific list, (3) assign a confidence score, (4) provide a rationale, (5) determine urgency, (6) determine if automated, (7) identify sender type. That is 7 simultaneous outputs from a single prompt. LLM research suggests that multi-task prompts with >4 outputs degrade accuracy on each individual output. The classification accuracy (the most important output) competes with sub-classification and sender type determination for the model's "attention."

*Analysis:* Claude is strong at multi-output structured generation, and the outputs are related (classification informs sub-classification, which informs urgency). The prompt is well-structured with clear field definitions. However, the 7-output requirement increases the output token count (200 tokens may be insufficient for a well-reasoned 7-field JSON response) and the model's probability of producing an invalid or inconsistent response. For example, Claude might correctly classify as `interview_invite` but incorrectly sub-classify as `new_role` (which belongs to `recruiter_outreach`). The sub-category validation is not enforced in the schema -- the `email_classifications` table has `sub_category VARCHAR(50)` with no CHECK constraint linking sub-category to category.

*Score:* 6/10

---

**Round 33: The safety escalation check uses keyword matching without contextual disambiguation**

*Concern:* The Safety Escalation Check (Section 14.2) triggers on keywords like "offer," "salary," "start date," "employment terms," "compensation," "package," and "we'd like to offer." As noted in Candidate Round 3, these keywords appear in many non-offer contexts. But the deeper issue is that the keyword check is applied to the full email body without contextual disambiguation. The phrase "competitive salary and benefits package" in a job alert should not trigger escalation. The phrase "we'd like to offer you the position" should. Simple keyword matching cannot distinguish between these contexts.

*Analysis:* The safety escalation has three trigger conditions: (1) Haiku classifies as `offer` (any sub), (2) offer keywords in body AND Haiku did NOT classify as `offer`, (3) employer with active application AND Haiku classified as `acknowledgment`. Condition 1 is always correct (double-check offers). Condition 3 is well-targeted (catch informal offers misclassified as ack). Condition 2 is the problematic one -- it is too broad. A more targeted approach for Condition 2 would be: use a regex that matches offer-like phrases in context ("we would like to offer you," "pleased to offer," "offer you the position," "your offer letter") rather than individual keywords.

*Score:* 6/10

---

**Round 34: The extraction pipeline calls Claude separately for classification and extraction -- two API calls per email**

*Concern:* The pipeline makes one Claude call for classification (WF-EM-02) and a second call for extraction (WF-EM-03). Both calls send the email body as input. For Haiku, this doubles the input token cost. More significantly, it doubles the latency -- each email waits for two sequential Claude API calls across two workflow cycles. A combined classify-and-extract prompt would halve both cost and latency.

*Analysis:* Separating classification from extraction has architectural benefits: (1) classification can short-circuit (sender pattern, heuristic) without needing extraction, (2) extraction prompts are category-specific (different fields for different categories), (3) failed extraction does not block classification. These are valid reasons. But for the 20-30% of emails that require both Claude classification AND Claude extraction, the double API call adds 2-5 seconds of latency and ~$0.001 of cost. A hybrid approach -- where Claude returns both classification and extraction in a single call when possible -- would be more efficient. The extraction prompt already receives the classification as input (`The email has been classified as: {{ classification }}`), so Claude re-reads the email with classification context.

*Score:* 6/10

---

**Round 35: The extraction prompt for job alerts asks Claude to "extract up to 20 individual job listings" which may exceed output token limits**

*Concern:* The extraction prompt (Section 8.2) says "For job alerts, extract up to 20 individual job listings from the email body." Each job listing has 5 fields (title, company, location, url, salary). 20 listings x 5 fields x ~15 tokens per field = 1,500 output tokens. The classification API call uses `max_tokens: 500` (Section 14.2). If the extraction call uses a similar limit, the response would be truncated mid-JSON, causing a parse error. The extraction prompt does not specify `max_tokens` for the API call.

*Analysis:* The extraction workflow (WF-EM-03) is described at the pseudocode level (Section 14.3) without showing the actual API call parameters. If `max_tokens` is set to 500 (matching the classification call), job alert extraction will fail for alerts with more than 5-6 listings. The platform-specific HTML parsers (Section 8.3) handle alert parsing without Claude, so the Claude fallback for alerts is only used for unknown platforms. But when it IS used, the output token limit must accommodate 20 listings.

*Score:* 6/10

---

**Round 36: The candidate's profile is hardcoded in the classification prompt rather than loaded from configuration**

*Concern:* The classification system prompt (Section 7.3) hardcodes "a professional with a PhD + MBA and 18 years of HR/L&D experience, seeking corporate L&D roles (Manager to Head level, GBP 70-80k) and university Lecturer/Senior Lecturer positions near Maidenhead, Berkshire, UK" and "her name is Selvi Chellamma." If the candidate's career targets change (e.g., after accepting an offer and re-entering the market a year later for a Director-level role), the classification prompt must be manually edited. The `system_config` table stores `candidate_name` and `candidate_email` but not the candidate's career profile.

*Analysis:* For a personal project with a single user, hardcoding the profile is pragmatic. The profile changes infrequently (once per job search cycle). The relevance scoring function (Section 10.2b) also hardcodes target parameters (`TARGET_MIN = 70000`, `TARGET_MAX = 85000`, `NEARBY_AREAS`, `TARGET_TITLES`). Both the classification prompt and the scoring function need updating together if targets change. Externalizing the candidate profile to `system_config` would make updates easier and reduce the risk of updating one but not the other.

*Score:* 7/10

---

**Round 37: No mechanism to detect or handle Claude model behavioral changes between versions**

*Concern:* v1 Round 33 noted model version pinning risks. The v2 PRD stores `model_version` in classification records and has a calibration set for drift detection. But the drift detection runs weekly (Section 7.6). If Anthropic releases a new model version that changes classification behavior (e.g., the new version classifies "let's arrange a call" as `recruiter_outreach` instead of `interview_invite`), the system runs with degraded accuracy for up to 7 days before the calibration run detects the drift.

*Analysis:* The weekly calibration cadence is reasonable for steady-state operation. Model updates are infrequent (quarterly) and usually improve, not degrade, accuracy. The real risk is if the system_config model ID points to an auto-updating alias (e.g., `claude-3.5-haiku` without a date suffix). Anthropic's API resolves aliases to the latest version, meaning the model could change without any system configuration change. The PRD's WF-EM-02 (Section 14.2) hardcodes `claude-3-5-haiku-20241022`, which is version-pinned and would NOT auto-update. This is the correct approach. The risk is low as long as the team manually tests before updating the version pin.

*Score:* 7/10

---

**Round 38: The "smart excerpt" approach recommended in v1 for truncation was not implemented**

*Concern:* v1 Round 32 recommended "Instead of truncating to the first 3000 characters, extract a smart excerpt: first 1500 chars + last 1500 chars." The v2 PRD still uses `{{ body_stripped | truncate(3000) }}` in the classification user prompt (Section 7.3). The "Should Fix" list from v1 included "Smart truncation instead of first-3000-chars" (item 3). This was not implemented.

*Analysis:* The truncation approach is simple and works for most emails. The few-shot examples (v2 addition) improve classification accuracy for ambiguous cases, partially compensating for lost context from truncation. But the fundamental risk remains: an email where the critical content is after position 3000 will be confidently misclassified. The cost of increasing to 5000 characters is ~$0.0005 per email -- negligible. The cost of implementing a smart excerpt is a few lines of code in the preprocessing sub-workflow.

*Score:* 6/10

---

**Round 39: The relevance scoring function returns a score but the tier assignment logic is not integrated into the extraction workflow**

*Concern:* Section 10.2b defines `scoreRoleRelevance()` and tier thresholds (A: 80-100, B: 60-79, C: 40-59, D: 0-39). The function is documented in the PRD body. But the extraction workflow (WF-EM-03, Section 14.3) for recruiter outreach shows "[Code: Process Recruiter Data] -- Score role relevance" without specifying where the scoring function is called or how the tier is stored. The drafting workflow (WF-EM-05, Section 14.5) reads `rrp.relevance_tier` from the `recruiter_role_proposals` table. The gap is the connection: who writes `relevance_tier` to the table?

*Analysis:* The `recruiter_role_proposals` table (Section 13.6) has `relevance_score INTEGER` and `relevance_tier CHAR(1)`. The extraction workflow's "[Postgres: Insert recruiter_role_proposals]" step would need to compute the score and tier and include them in the INSERT. The scoring function is documented but its integration into the workflow flow is implicit ("Score role relevance" as a one-line pseudocode comment). For an implementer, this is workable -- the function exists, the table exists, the connection is obvious. But for a PRD that specifies other workflow steps in detail, this integration is underspecified.

*Score:* 6/10

---

**Round 40: No evaluation of whether Claude Haiku is the right model for extraction (vs classification)**

*Concern:* The PRD uses Haiku for classification (fast, cheap, usually accurate) and Sonnet for classification escalation (more accurate, slower, costlier). But extraction also uses Haiku (Section 5.4: "Response Drafting: Claude 3.5 Haiku"). Extraction is arguably harder than classification: it requires identifying and normalizing multiple structured fields from unstructured text, handling UK date formats, parsing addresses, and distinguishing between multiple people mentioned in the email. Haiku's lower capability (compared to Sonnet) may produce lower extraction accuracy, especially for complex emails with multiple roles, ambiguous dates, or non-standard formatting.

*Analysis:* The extraction accuracy target is 90% (Section 3.1), lower than the classification target of 95%. This suggests the PRD already anticipates extraction being harder. Using Haiku for extraction keeps costs low ($0.001125 per extraction vs $0.0135 for Sonnet). At 300 emails/month, the Haiku extraction cost is $0.34/month. Using Sonnet would cost $4.05/month. The 12x cost difference is small in absolute terms but would change the cost profile from "negligible" to "modest." A pragmatic approach: use Haiku for extraction and monitor the 90% accuracy target. If accuracy falls below 85%, escalate extraction to Sonnet for specific categories (interview invitations, offers) where extraction errors have higher consequences.

*Score:* 7/10

---

#### Persona 4 Summary (v2): AI/LLM Specialist

| Round | Concern | Score |
|-------|---------|-------|
| 31 | Cost model does not reflect few-shot token overhead | 7/10 |
| 32 | Multi-task prompt with 7 outputs may degrade accuracy | 6/10 |
| 33 | Safety escalation keywords lack contextual disambiguation | 6/10 |
| 34 | Double API call (classify + extract) adds latency and cost | 6/10 |
| 35 | Job alert extraction may exceed output token limit | 6/10 |
| 36 | Candidate profile hardcoded in prompt, not configurable | 7/10 |
| 37 | Model version pinning is correct; drift detection adequate | 7/10 |
| 38 | Smart truncation not implemented despite v1 recommendation | 6/10 |
| 39 | Relevance scoring integration into workflow underspecified | 6/10 |
| 40 | No evaluation of Haiku vs Sonnet for extraction accuracy | 7/10 |
| **Average** | | **6.4/10** |

---

### Persona 5: Privacy & Compliance -- Rounds 41-50

**Perspective:** GDPR email processing, data retention, breach procedures, third-party data.

---

**Round 41: Data breach notification procedure was not added despite being listed as a v2 fix**

*Concern:* The context states v2 fixed "breach procedures." Section 17 contains subsections 17.1 through 17.7 -- identical to v1. No Section 17.8 (or equivalent) for breach notification exists. v1 Round 48 identified this gap with a score of 5/10 and recommended "Add a brief data breach response procedure: detect, contain, assess, notify (if required)." The fix was not applied.

*Analysis:* This is the only claimed v2 fix that is absent from the PRD body. The breach procedure does not need to be elaborate for a personal system -- a half-page covering (1) how to detect a breach (unusual database access, credential exposure alerts), (2) immediate containment (revoke OAuth2 tokens, disable workflows, change database password), (3) assessment (what data was exposed -- recruiter names/emails/phones), and (4) whether to notify affected recruiters (proportionate to risk) would suffice. The absence is a documentation gap, not a functional gap -- the system is not less secure without it, but the response to an incident is undefined.

*Score:* 4/10

---

**Round 42: The GDPR body purge is broken because no email ever reaches `completed` status**

*Concern:* This was identified in Communication Expert Round 29. The purge function (Section 13.12) purges emails with `status IN ('completed', 'skipped')`. No workflow transitions emails to `completed`. Emails stop at `labeled` or `draft_created`. The purge never runs for these emails. This means email body text (containing personal data from employers, recruiters, and the candidate) is retained indefinitely in the database, violating the stated 7-day retention policy (Section 17.3).

*Analysis:* This is the most serious privacy issue in the v2 PRD. The system claims GDPR compliance with a 7-day body retention period, but the purge mechanism does not function because its precondition (status = `completed`) is never met. Every email body processed by the system persists in the database indefinitely. If the Hetzner server were compromised, an attacker would have access to every email body ever processed, not just the last 7 days. The fix is straightforward but the gap is real.

*Score:* 3/10

---

**Round 43: The extracted text fields (role descriptions, preparation instructions) remain outside the purge scope**

*Concern:* v1 Round 47 identified that `email_extracted_data.role_description_summary` and `email_extracted_data.preparation_instructions` contain body-derived text that is not covered by the body purge. This was listed as a v1 "Must Fix" (item 10). The v2 PRD did not address this. These fields persist indefinitely, even if the body purge were functioning correctly (which per Round 42, it is not).

*Analysis:* Combined with Round 42, the data retention picture is: (1) email bodies are SUPPOSED to be purged after 7 days but are NOT purged at all, (2) extracted text fields are not in the purge scope and were never intended to be purged in v1, (3) the only data that IS purged is processing logs (90 days) and notification records (90 days). The system's stated 7-day retention for email bodies is entirely non-functional.

*Score:* 4/10

---

**Round 44: The household exemption evaluation was recommended in v1 but not addressed**

*Concern:* v1 Round 42 scored 7/10 and recommended "Add a subsection evaluating whether the household exemption applies." The v2 PRD did not add this evaluation. Section 17.1 still states "Legitimate interest (managing own job search)" as the legal basis without evaluating Article 2(2)(c).

*Analysis:* The household exemption question is foundational. If it applies, most of the compliance architecture (LIA, DPA evaluation, SAR handling, breach notification) is unnecessary -- the PRD is over-engineered for a personal system. If it does not apply, several gaps remain (LIA not documented, DPA with Anthropic not formalized, breach procedure missing). Either way, the evaluation should be performed. The v1 score of 7/10 reflected that the conservative approach was defensible; the unchanged v2 PRD maintains this score.

*Score:* 7/10 (unchanged)

---

**Round 45: The system processes emails from CC'd addresses without acknowledging the privacy implications**

*Concern:* When an employer CCs the candidate on an email to another party (e.g., CC'ing the candidate on an email to the interview panel: "Selvi will be joining us for the interview on Thursday"), the system processes the email. The body may contain information about other candidates ("We have two more candidates to see this week"), internal hiring discussions, or panel availability. This information is extracted and stored in the database.

*Analysis:* The system's Gmail polling uses `labelId=INBOX` (Section 6.3), which includes any email delivered to the candidate's inbox, regardless of whether the candidate is in the To, CC, or BCC field. The `to_email` field in the `emails` table (Section 13.1) defaults to `chellamma.uk@gmail.com`, but this does not distinguish To from CC. A CC'd email about an interview would be classified as `interview_invite` (correctly) and the body (potentially containing information about other candidates) would be processed by Claude and stored. The privacy concern is that the candidate is now storing personal data about other candidates (their existence in the hiring pipeline) that they have no legitimate basis to process.

*Score:* 6/10

---

**Round 46: No data minimization in what is sent to Claude -- full email body includes irrelevant personal data**

*Concern:* The classification and extraction prompts send the full stripped email body to Claude. This body may contain: the employer's physical address, the interviewer's personal mobile number, marketing disclaimers about the employer's data processing policies, disability and diversity monitoring statements, and other content irrelevant to classification or extraction. Sending all of this to Anthropic's API when only the classification-relevant portion is needed violates the GDPR principle of data minimization (even if the household exemption applies, minimization is good practice).

*Analysis:* The 3000-character truncation provides some minimization by limiting the volume of data sent. But within those 3000 characters, no effort is made to strip irrelevant personal data. An email signature with a personal mobile number, a legal disclaimer with the employer's registered address, and a diversity monitoring note are all sent to Claude. The practical risk is negligible -- Anthropic does not retain API data -- but the principle of sending only what is necessary is not applied.

*Score:* 6/10

---

**Round 47: The manual full purge procedure (Section 17.4) uses TRUNCATE without considering foreign key constraints**

*Concern:* Section 17.4 shows `TRUNCATE email_processing_log` and `TRUNCATE email_notifications`. The `email_processing_log` table has `email_id UUID REFERENCES emails(id)` (Section 13.9). The `email_notifications` table has `email_id UUID REFERENCES emails(id)` (Section 13.7). PostgreSQL's `TRUNCATE` does not check foreign key constraints by default -- it requires `CASCADE` to truncate tables referenced by foreign keys. If other tables reference `email_processing_log` or `email_notifications`, the TRUNCATE will fail. More importantly, `TRUNCATE` removes ALL data, not just data from the concluded job search. If the system is reused for a second job search, TRUNCATE would destroy records from the new search.

*Analysis:* The TRUNCATE commands in the "manual full purge" section are intended for when the job search is completely over and the system is being decommissioned. In that context, CASCADE is appropriate. But the procedure does not specify CASCADE, and it does not warn about the consequences if the system is still partially active. A safer approach would use DELETE with a date filter, preserving any records from a potential new search.

*Score:* 6/10

---

**Round 48: The system stores the candidate's phone number in the database but does not encrypt it**

*Concern:* Section 11.5 stores the candidate's signature (including phone number) in `system_config` as a JSON value. Section 17.7 lists "Encryption at rest: Postgres data directory on encrypted filesystem (Hetzner default)." Full-disk encryption protects against physical disk theft but not against database-level access. If an attacker gains database access (SQL injection in another application on the same server, leaked database credentials), they can read the candidate's phone number from `system_config`. The phone number is also included in every auto-drafted email stored in `email_drafts.draft_body`.

*Analysis:* The candidate's phone number is arguably less sensitive than the recruiter data and email bodies also stored in the database. Full-disk encryption provides adequate protection for a personal system. Application-level encryption of the phone number would add complexity (key management) with minimal security benefit given the threat model. The existing security controls (database accessible only from n8n container, SSL connections) are appropriate. This is a minor concern.

*Score:* 7/10

---

**Round 49: The data retention schedule has no automated enforcement -- all purge operations depend on manual or cron scheduling**

*Concern:* Section 17.3 states retention periods (7 days for email bodies, 90 days for logs, 6 months post-search for recruiter data). Section 17.4 shows the purge SQL. But the only automated purge is the daily 3AM body purge. Log purge and notification purge are shown as SQL statements but not connected to any workflow or cron job. The recruiter data purge (6 months post-search) has no automated trigger. All non-body purges require manual execution.

*Analysis:* The daily body purge is the most important automated retention enforcement, and it would work IF the `completed` status issue (Round 42) were fixed. Log and notification purges are less critical -- 90-day retention for 50-100 records per day produces modest data volumes. But without automation, the purge SQL is documentation, not enforcement. The gap is between stated policy (retention periods) and implemented policy (only body purge is automated, and it is broken).

*Score:* 5/10

---

**Round 50: No privacy impact assessment (PIA) for the overall system despite processing sensitive career data**

*Concern:* The system processes information about the candidate's employment status (actively seeking work -- potentially sensitive if she is currently employed), her salary expectations, her interview performance (rejections imply unsuccessful interviews), and her professional relationships (recruiter interactions). Under GDPR Article 35, a Data Protection Impact Assessment (DPIA) is required when processing is "likely to result in a high risk to the rights and freedoms of natural persons." For a personal system under the household exemption, a DPIA is not legally required. But a lightweight privacy impact assessment documenting the risks and mitigations would demonstrate due diligence and identify issues like the broken purge mechanism (Round 42).

*Analysis:* The PRD's privacy section (Section 17) covers many compliance topics but does not synthesize them into a risk assessment. It describes WHAT data is processed and HOW long it is retained, but not the RISKS of processing and what MITIGATIONS address those risks. A simple risk matrix (risk: email bodies retained beyond policy -> mitigation: automated purge -> residual risk: purge function not triggered) would have caught the Round 42 issue during PRD review.

*Score:* 6/10

---

#### Persona 5 Summary (v2): Privacy & Compliance

| Round | Concern | Score |
|-------|---------|-------|
| 41 | Breach procedure not added despite being claimed | 4/10 |
| 42 | GDPR body purge completely broken (no `completed` status) | 3/10 |
| 43 | Extracted text fields still outside purge scope | 4/10 |
| 44 | Household exemption still not evaluated | 7/10 |
| 45 | CC'd emails expose other candidates' data | 6/10 |
| 46 | No data minimization in Claude API payloads | 6/10 |
| 47 | TRUNCATE without CASCADE in manual purge | 6/10 |
| 48 | Phone number stored unencrypted (low risk) | 7/10 |
| 49 | Retention schedule not enforced by automation | 5/10 |
| 50 | No privacy impact assessment | 6/10 |
| **Average** | | **5.4/10** |

---

### Overall v2 Evaluation Summary

#### Persona Averages (v2)

| Persona | v1 Score | v2 Score | Delta | Verdict |
|---------|----------|----------|-------|---------|
| 1. The Candidate (Selvi) | 5.6 | 5.5 | -0.1 | v2 fixed critical issues but new issues found at similar depth |
| 2. Technical Architect / n8n Expert | 5.6 | 5.9 | +0.3 | History API and workflow locks improved robustness |
| 3. Email/Communication Expert | 5.2 | 5.8 | +0.6 | Salary disclosure fix and few-shot examples helped; broken purge hurts |
| 4. AI/LLM Specialist | 5.7 | 6.4 | +0.7 | Few-shot examples, relevance scoring, and safety escalation strong improvements |
| 5. Privacy & Compliance | 5.8 | 5.4 | -0.4 | Broken GDPR purge is a newly-discovered critical issue |
| **Overall Average** | **5.58** | **5.80** | **+0.22** | |

#### v2 Fix Quality Assessment

The 10 fixes applied from v1 are predominantly strong. The Gmail History API migration, workflow locks, role relevance scoring, salary disclosure removal, few-shot examples, and date cross-validation are all well-implemented with appropriate depth. The safety escalation check is good in intent but over-broad in keyword matching. The idempotency fix is partial (row-level locking but no transaction wrapping). The breach procedure was claimed but not delivered.

#### Newly Discovered Critical Issue

**The GDPR body purge is non-functional.** No workflow transitions emails to `completed` status. The purge function targets `status IN ('completed', 'skipped')`. Since emails stop at `labeled` or `draft_created`, the purge never executes. Every email body processed by the system is retained indefinitely, violating the stated 7-day retention policy. This is the single most important finding of the v2 evaluation. It is not a new architectural flaw -- it existed in v1 but was not identified because the v1 evaluation focused on the purge function's logic (which is correct) rather than its trigger condition (which is never met).

---

### v2 Top 10 Must Fix (Before Production)

| # | Issue | Round | Impact |
|---|-------|-------|--------|
| 1 | **Fix email status lifecycle: add `completed` transition so GDPR purge functions** | P3-R29, P5-R42 | Email bodies retained indefinitely; stated 7-day retention policy is non-functional |
| 2 | **Add breach notification procedure to Section 17** | P5-R41 | Claimed as v2 fix but absent from document |
| 3 | **Add transaction wrapping for extraction + Module 4 update + status change** | P2-R14 | Crash between steps leaves email stuck and re-processing causes constraint violations |
| 4 | **Add classification correction mechanism with cascade re-processing** | P1-R2 | Misclassified emails have no recovery path through the system |
| 5 | **Add fallback to Claude parser when platform-specific HTML parsers return zero results** | P1-R5 | Job alert parsers silently fail when platforms update email templates |
| 6 | **Narrow safety escalation keywords to contextual phrases, not individual words** | P1-R3, P4-R33 | Over-broad keywords escalate ~50% of emails to Sonnet unnecessarily |
| 7 | **Add interview-level notification deduplication (same company + role + date)** | P1-R7 | Duplicate notifications for the same interview from follow-up emails |
| 8 | **Include preparation requirements in interview confirmation draft prompt** | P3-R22 | Draft omits acknowledgment of presentation/portfolio requirements |
| 9 | **Add `not_job_related` few-shot example to classification prompt** | P3-R24 | All 8 examples are positive; no negative exemplar for personal emails |
| 10 | **Add extracted text fields to GDPR purge scope** | P5-R43 | Role descriptions and preparation instructions persist indefinitely |

### v2 Top 10 Should Fix (Before v1.0 or Early v1.x)

| # | Issue | Round | Impact |
|---|-------|-------|--------|
| 1 | **Add quiet-hours intelligence for interview notifications** | P1-R1 | Hold non-actionable midnight notifications until 7AM |
| 2 | **Define thread label precedence and cleanup rules** | P1-R4 | Multi-status threads accumulate confusing labels in Gmail |
| 3 | **Extend History API to sent folder monitoring** | P2-R13 | Sent folder polling still has timestamp boundary risk |
| 4 | **Add priority ordering to classification batch query** | P2-R15 | Non-alert emails should be classified before job alerts during bursts |
| 5 | **Add graceful degradation during Claude API outage** | P2-R18 | No fallback classification when Claude is down |
| 6 | **Fix extraction prompt self-contradiction on inference vs defaults** | P1-R9 | "Do not infer" conflicts with "assume UK time if not specified" |
| 7 | **Add HTML notification format via Resend** | P3-R27 | Mobile-scannable notifications with bold fields and action buttons |
| 8 | **Add phone number placeholder validation to draft checker** | P3-R28 | `XXXX XXXXXX` pattern not caught by template validator |
| 9 | **Automate all retention schedule enforcement (logs, notifications)** | P5-R49 | Log and notification purges are manual SQL, not automated |
| 10 | **Fix follow-up draft to avoid unconditional delivery promises** | P3-R23 | Draft commits to providing items candidate may not have ready |

---

*End of 50-Round Critical Roleplay Evaluation (v2)*

---

## Fixes Applied Log (v2 -> v3)

### Must Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | Email status lifecycle broken; GDPR purge non-functional | Expanded purge_email_bodies() to cover all post-classification statuses (classified, extracted, labeled, drafted, notified, skipped), not just 'completed'. Added final 'completed' status transition in WF-EM-05 and WF-EM-04 for emails that skip drafting. |
| 2 | Breach notification procedure absent | Added Section 17.6b with full breach notification procedure: 7-step response plan, Gmail-specific breach indicators, and ICO reporting guidance. |
| 3 | No transaction wrapping for extraction + Module 4 update + status change | Wrapped extraction, Module 4 status update, and email status change in a single Postgres DO block transaction in WF-EM-03. Crash between steps no longer leaves emails stuck. |
| 4 | Classification correction mechanism missing | Added correction mechanism to Section 7.6: CORRECT command via email or webhook, cascade re-processing (delete extracted data, reset status, re-extract, update Module 4, fix labels), and feedback loop to calibration set. |
| 5 | No fallback when platform HTML parsers return zero results | Added zero-result fallback logic: if platform-specific parser returns 0 jobs from a job_alert email, automatically fall back to Claude generic parser. Alert sent if same platform fails 3+ times in a week. |
| 6 | Safety escalation keywords over-broad | Narrowed escalation from individual keywords ("salary", "compensation") to contextual phrases ("we'd like to offer you", "offer of employment", "annual salary of"). Added conditions requiring sender to be known employer with active application. Documented which keywords are NOT escalated. |
| 7 | Interview notification deduplication missing | Added Level 2 interview-level deduplication based on (company + role + interview_date) within 7-day window to Section 12.6. Suppresses duplicate notifications from calendar invites and reminders. |
| 8 | Interview draft omits preparation requirements | Added preparation_instructions and presentation_topic fields to interview confirmation draft prompt. Draft now explicitly acknowledges presentation topics, portfolio requirements, and documents to bring. |
| 9 | No not_job_related few-shot example | Added Examples 9 (personal email mentioning work) and 10 (scam/spam) to classification prompt. Provides negative exemplars for the classifier. |
| 10 | Extracted text fields not in GDPR purge scope | Added email_extracted_data purge (role_description_summary, preparation_instructions, rejection_feedback) to purge_email_bodies() function, executing before the email body purge. |

### Should Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | No quiet-hours intelligence for notifications | Added quiet-hours logic to WF-EM-06: interview_invite and offer always override; follow_up with deadline <24h overrides; all other urgent notifications held until 07:00. |
| 2 | Thread label precedence undefined | Added Section 9.4b with label precedence hierarchy (Offers > Interviews > Follow-Up > Acknowledged > Rejected > Outreach > Alerts) and cleanup rules for removing superseded labels. |
| 3 | Sent folder monitoring timestamp boundary risk | Added History API approach for sent folder monitoring (Section 6.7) using historyTypes=messageAdded with labelId=SENT filter, eliminating timestamp boundary risk. |
| 4 | No priority ordering in classification batch | Added priority ordering to WF-EM-02 unclassified email query: non-alert emails processed first (more likely to need action), job alerts processed last. |
| 5 | No graceful degradation during Claude outage | Added Claude API health check before classification batch. In degraded mode: sender patterns still work, other emails held, basic keyword scan provides safety-net notifications, daily summary includes warning. |
| 6 | Extraction prompt self-contradiction | Replaced "Do not infer or assume" with specific guidance: do not infer missing facts, but do apply UK-context defaults (timezone, currency) with explicit "assumed_X: true" markers. |
| 7 | Plain-text notification format | Changed notification formatting to HTML with bold field labels, responsive layout, and styled action buttons for mobile readability. |
| 8 | Phone placeholder not caught by draft validator | Added regex checks for XXXX XXXXXX phone placeholders and [PLACEHOLDER] bracket markers to draft quality validation function. |
| 9 | Retention schedule enforcement manual | Converted manual SQL purges to automated WF-EM-PURGE workflow (daily at 3AM). Added purges for workflow errors (30d), stale sender patterns (180d), and audit logging of purge execution. |
| 10 | Follow-up draft makes unconditional delivery promises | Updated follow-up draft prompt to distinguish between items candidate has (confirm delivery) and items requiring third-party coordination (promise to arrange, not to deliver by date). |

---

## 21. 50-Round Critical Roleplay Evaluation (v3 - FINAL)

**Evaluation Date:** 2026-03-29
**Evaluator Profile:** Top 0.1% cross-disciplinary panel (5 personas, 10 rounds each)
**PRD Version Evaluated:** v3.0
**Previous Scores:** v1 = 5.58/10, v2 = 5.80/10

---

### v2 -> v3 Fix Assessment

The 10 Must Fix and 10 Should Fix items from v2 were all addressed. Quality assessment of the v3 fixes:

| v2 Issue | Fix Quality |
|----------|-------------|
| GDPR purge broken (no `completed` status) | **Strong.** Expanded purge to cover all post-classification statuses. Added `completed` transition in WF-EM-05 and WF-EM-04. |
| Breach notification procedure absent | **Strong.** Section 17.6b with 7-step response plan, Gmail-specific indicators, and ICO guidance. |
| No transaction wrapping for extraction pipeline | **Strong.** DO block transaction wrapping extraction, Module 4 update, and status change. |
| Classification correction mechanism missing | **Strong.** CORRECT command, cascade re-processing, and feedback loop to calibration set. |
| Job alert parser zero-result fallback missing | **Strong.** Auto-fallback to Claude generic parser with 3-failure alerting. |
| Safety escalation keywords over-broad | **Strong.** Narrowed to contextual phrases. Documented non-escalated keywords. |
| Interview notification deduplication missing | **Strong.** Level 2 dedup on (company + role + date) within 7-day window. |
| Interview draft omits preparation requirements | **Good.** Added fields to prompt context with conditional acknowledgment. |
| No `not_job_related` few-shot example | **Good.** Added Examples 9 (personal) and 10 (spam). |
| Extracted text fields not in GDPR purge scope | **Strong.** Added to purge_email_bodies() before body purge. |
| Quiet-hours intelligence | **Strong.** Interview and offer override; follow_up with <24h deadline overrides; all others held until 07:00. |
| Thread label precedence | **Strong.** Explicit hierarchy with cleanup rules for superseded labels. |
| Sent folder History API | **Good.** Same pattern as inbox monitoring applied to sent folder. |
| Priority ordering in classification batch | **Good.** Non-alert emails processed first. |
| Claude API graceful degradation | **Strong.** Health check, degraded mode, keyword safety-net notifications. |
| Extraction prompt self-contradiction | **Strong.** Clear distinction between inference and UK-context defaults with markers. |
| HTML notification format | **Good.** Bold fields, responsive layout, action buttons. |
| Phone placeholder validation | **Good.** Regex checks added to draft validator. |
| Retention schedule automation | **Strong.** WF-EM-PURGE workflow with audit logging. |
| Follow-up draft delivery promises | **Good.** Distinguishes have vs. need-to-arrange items. |

**Overall fix quality: Comprehensive and well-executed.** The v3 PRD addresses all 20 identified issues with appropriate depth. The evaluation below searches for remaining weaknesses at a higher bar.

---

### Persona 1: The Candidate (Selvi) -- Rounds 1-10

**Perspective:** Remaining risks to the candidate's job search outcomes. Are there failure modes that survive all three rounds of hardening?

---

**Round 1: The correction cascade re-processes from classification stage but cannot re-extract if the email body has been purged**

*Concern:* Section 7.6 now defines a correction mechanism: the candidate submits `CORRECT [email_id] [correct_category]`, the system deletes extracted data, resets to `classified`, and re-extracts. But the function explicitly notes: "If email body has been purged (>7 days old), skip re-extraction and log 'body unavailable.'" This means the correction window is 7 days. After that, a misclassified interview invitation that was wrongly labeled as an acknowledgment cannot be re-extracted to recover interview date/time, interviewer details, or preparation instructions. The label can be fixed, but the structured data is lost.

*Analysis:* The 7-day window aligns with the body retention period -- there is no body text to re-extract after purge. This is a correct design constraint, not a gap. The risk is that the candidate discovers the misclassification after 7 days (possible if she does not check the daily summary carefully). In that case, the label correction still works (visible in Gmail), but Module 4 and Module 6 would need manual updates. The daily summary's "Please verify" flag for low-confidence emails is the primary defense. For a single-user system, this is an acceptable trade-off.

*Score:* 7/10

---

**Round 2: The quiet-hours override logic for follow_up with deadline <24h requires extraction to have completed before notification timing is evaluated**

*Concern:* The v3 quiet-hours logic (WF-EM-06) holds non-critical notifications during 22:00-07:00, with overrides for interview_invite, offer, and follow_up_request with deadline <24h. But the deadline is an extracted field from WF-EM-03. WF-EM-06 runs every 3 minutes and picks up emails in states including `extracted`. If a follow_up_request email arrives at 11 PM and extraction completes at 11:05 PM, the notification check at 11:06 PM evaluates the deadline. If the deadline is tomorrow at 9 AM (<24h), the notification fires immediately. But if extraction is delayed (Claude API slow, queue backed up), the notification check at 11:06 PM finds the email still in `classified` state and does not evaluate it. The notification fires only after extraction, which could be 11:15 PM. The candidate still gets the notification during quiet hours -- just slightly later. The quiet-hours logic works correctly; the concern is about latency, not correctness.

*Analysis:* The latency concern is minor. The quiet-hours override decision is made at notification time, which is after extraction. If extraction is delayed, the notification is also delayed, but the override logic still evaluates correctly. The system cannot make a deadline-based override decision before it knows the deadline, which requires extraction. This is inherent to the architecture and acceptable.

*Score:* 8/10

---

**Round 3: The label precedence cleanup (Section 9.4b) uses different label names than the label hierarchy (Section 9.1)**

*Concern:* Section 9.4b defines label precedence using names like `Job-Search/Offers`, `Job-Search/Interviews`, `Job-Search/Applications/Acknowledged`. But Section 9.1 defines labels as `Job/Offer`, `Job/Interview/Upcoming`, `Job/Applied`. These are different naming schemes. The implementation code (Section 9.2, 9.3) uses the Section 9.1 names (`Job/Offer`, `Job/Applied`, etc.). The precedence rules in 9.4b reference a naming scheme that does not exist in the system.

*Analysis:* This is a documentation inconsistency. The precedence logic is sound (offers > interviews > follow-up > acknowledged > rejected > outreach > alerts), but the label names in the precedence section do not match the label names used everywhere else in the PRD. An implementer reading Section 9.4b would need to mentally translate `Job-Search/Offers` to `Job/Offer` and `Job-Search/Applications/Acknowledged` to `Job/Applied`. The risk is minor: an implementer who reads the full PRD will notice the inconsistency and use the correct names from Section 9.1. But it introduces ambiguity where none should exist.

*Score:* 7/10

---

**Round 4: The candidate signature still contains `+44 XXXX XXXXXX` as a placeholder, despite the v3 draft validator now catching it**

*Concern:* The v3 fix added regex checks for `XXXX XXXXXX` patterns to the draft validator (Section 11.4). This means every draft generated with the placeholder signature will now fail validation. The validator flags the issue, but the PRD does not define what happens when validation fails. Does the draft still get created in Gmail with a warning? Is the draft blocked? Is the candidate notified? The validation function returns `{ valid: false, issues: [...] }`, but the workflow node chain (Section 14.5) does not show a conditional branch for validation failure.

*Analysis:* The validation logic exists and the placeholder detection works. But the workflow does not specify behavior on validation failure. Looking at WF-EM-05 (Section 14.5), the flow is: Claude generates draft -> validate draft -> create draft in Gmail -> insert email_drafts. There is no `[IF: Validation Passed?]` branch after the validate step. The implication is that the draft is created regardless of validation outcome, and validation issues are stored in `email_drafts.validation_issues`. This is a reasonable approach (flag but do not block), but it means the XXXX placeholder still appears in Gmail drafts. The candidate would see it when reviewing. The real fix is in Phase 0 deployment: replace the placeholder with the actual phone number in `system_config`.

*Score:* 7/10

---

**Round 5: The company name matching (Section 8.7) does not handle university name variations common in UK higher education**

*Concern:* The `matchCompanyToApplication()` function normalizes names by stripping `ltd|limited|plc|inc|corp|llc|uk|group`. But UK universities use variations that are not covered: "University of Reading" vs "UoR" vs "Reading University." "Oxford Brookes University" vs "Oxford Brookes" vs "Brookes University." "Henley Business School" vs "University of Reading (Henley)" -- Henley is part of Reading but operates quasi-independently. The Levenshtein distance between "University of Reading" and "Henley Business School" is too large for fuzzy matching (distance >15), yet they could be the same employer for hiring purposes.

*Analysis:* The matching function uses three signals: exact match (50 pts), fuzzy match (up to 40 pts), and role title match (up to 30 pts). For university applications, the role title match is the saving grace: "Lecturer in HRM" applied to University of Reading would match an acknowledgment from "Henley Business School" IF the role title is identical. But if the role title also varies ("Lecturer in Human Resource Management" vs "Lecturer in HRM"), both company and role fuzzy match scores would be low, and the match would fail. The candidate would need to manually link the email to the application in Module 4. For a candidate targeting both corporate and university roles, this is a recurring friction point.

*Score:* 7/10

---

**Round 6: The daily summary does not include a count of unprocessed or stuck emails, leaving the candidate unaware of pipeline health issues**

*Concern:* WF-EM-07 (Section 14.7) aggregates emails by classification, lists pending follow-ups, stale conversations, new recruiter contacts, and classification accuracy stats. It does not include a count of emails stuck in intermediate states (ingested, classified, extracted but not completed). The stuck email monitoring query exists (Section 16.4) but feeds into engineering dashboards, not the daily summary. If the pipeline silently stops processing (Claude API down for 6 hours overnight, recovered at 5 AM, but 30 emails are backed up), the candidate receives a daily summary that shows normal counts for the emails that WERE processed but omits the fact that 30 others are still queued.

*Analysis:* The v3 graceful degradation fix (WF-EM-02 health check) includes a daily summary warning when Claude is unavailable. But the daily summary itself does not report pipeline health metrics. Adding a "Pipeline status: 3 emails awaiting classification, 1 email stuck for >30 min" line to the summary would give the candidate visibility without requiring her to check engineering dashboards. This is a minor UX gap -- the stuck email alerting (Section 16.6) sends a separate Resend notification if >5 emails are stuck for >30 minutes. The candidate would know about serious issues from the alert, but minor backlogs would be invisible.

*Score:* 7/10

---

**Round 7: The system handles BST/GMT transitions correctly in the extraction code but the classification prompt does not mention clock change awareness**

*Concern:* The extraction pipeline (Section 8.6) correctly handles BST/GMT via `getUKTimezone()`. The date cross-validation function checks day-of-week against dates. But the classification prompt (Section 7.3) does not instruct Claude about clock change awareness. An email received on the last Sunday of March saying "interview at 2 PM tomorrow" could be ambiguous: does "2 PM" mean 2 PM GMT or 2 PM BST? The extraction prompt handles this via "assume UK time (GMT or BST depending on date)," which is correct. The concern is that the classification prompt's Examples 1-10 do not include a clock-change scenario, so Claude has no few-shot guidance for this edge case.

*Analysis:* This is a very narrow edge case (emails arriving on the two clock-change weekends per year). The extraction pipeline handles it correctly. The classification prompt does not need to address it because classification does not depend on timezone -- only extraction does. The concern is theoretical and does not affect classification accuracy. The extraction prompt's UK-context defaults with `assumed_timezone: true` markers handle the scenario appropriately.

*Score:* 8/10

---

**Round 8: No mechanism to detect when an employer rescinds or modifies an interview invitation after the original was processed**

*Concern:* An employer sends an interview invitation on Monday. The system classifies it, extracts details, sends a notification, creates a draft. On Tuesday, the employer sends a follow-up: "Due to scheduling changes, we need to move your interview from Wednesday to Friday." This follow-up arrives in the same thread. The system classifies it as `interview_invite` or `follow_up_request`. If classified as a new `interview_invite`, the interview-level deduplication (v3 fix) suppresses the notification because the same company/role already has a recent notification. The candidate never learns about the reschedule.

*Analysis:* The v3 interview deduplication checks `(company_name, role_title, interview_date)` within 7 days. A rescheduled interview has a DIFFERENT `interview_date`, so it would NOT be deduplicated -- it would be treated as a new interview and trigger a new notification. The dedup correctly distinguishes "same interview, duplicate notification" from "rescheduled interview, new date." The extraction pipeline would extract the new date and update Module 4/6. However, if the follow-up says "we need to postpone your interview" WITHOUT specifying a new date, the extraction would fail to find an interview_date, and Module 6 would not be updated with the cancellation. There is no `interview_cancelled` status in the classification taxonomy.

*Score:* 7/10

---

**Round 9: The recruiter quality scoring algorithm (Section 10.2) starts all recruiters at 50/100 but the tier thresholds treat scores linearly**

*Concern:* `calculateRecruiterQuality()` starts at 50 and adds/subtracts modifiers. The maximum possible score is 50 + 25 (relevance) + 10 (frequency) + 10 (response) + 15 (exclusive) + 10 (personalization) = 120, clamped to 100. The minimum is 50 - 25 - 25 - 15 - 10 = -25, clamped to 0. Most recruiters with even slightly positive attributes will cluster in the 50-70 range. With the relevance modifier ranging from -25 to +25 based on average role relevance, a recruiter who sends one A-tier role and one D-tier role averages 50 relevance, contributing 0 modifier. The scoring compresses most recruiters into the "average" band, making the quality score less discriminating than intended.

*Analysis:* The scoring function is functional but lacks discriminating power at the middle of the range. A recruiter with quality score 55 is nearly indistinguishable from one at 65, yet the system does not use the quality score for any threshold-based decisions beyond blacklisting. The relevance TIER (A/B/C/D) per role drives draft tone and notification behavior. The quality score is a long-term signal for the candidate's relationship decisions, not a real-time system input. For that purpose, the compression is acceptable -- the candidate can sort recruiters by score and the ordering is meaningful even if the absolute values cluster.

*Score:* 7/10

---

**Round 10: The CORRECT command for classification correction is defined as email reply or webhook but neither has authentication**

*Concern:* Section 7.6 defines the correction mechanism: candidate replies to the daily summary with `CORRECT [email_id] [correct_category]` or calls a webhook `POST /webhook/email-correction`. The email reply approach requires the system to parse incoming emails for CORRECT commands -- but the system already processes incoming emails. If a malicious actor sends an email containing `CORRECT [email_id] interview_invite` to the candidate's address, the system could process it as a correction command, reclassifying and re-extracting an arbitrary email. The webhook approach has no authentication specified -- no API key, no HMAC signature, no IP restriction. Anyone who discovers the webhook URL can reclassify emails.

*Analysis:* The email reply approach is the more concerning vector. The system already excludes its own notification address from processing, but the CORRECT command would need to be detected in emails from the system address (daily summary replies). If the system correctly identifies that CORRECT commands only come from replies to daily summary emails (which originate from `selvi-system@apiloom.io`), and the candidate replies from `chellamma.uk@gmail.com`, the reply would be from the candidate's address TO the system address. The system does not monitor replies to its own emails -- it monitors the candidate's inbox. For the webhook, adding a simple API key header check would address the authentication gap. The practical risk is low for a personal system, but the attack surface exists.

*Score:* 7/10

---

#### Persona 1 Summary (v3): The Candidate (Selvi)

| Round | Concern | Score |
|-------|---------|-------|
| 1 | Correction cascade limited by 7-day body retention | 7/10 |
| 2 | Quiet-hours follow_up override depends on extraction timing | 8/10 |
| 3 | Label precedence section uses wrong label names | 7/10 |
| 4 | Draft validator catches placeholder but workflow does not branch on failure | 7/10 |
| 5 | University name variations not in company matching normalization | 7/10 |
| 6 | Daily summary omits pipeline health metrics | 7/10 |
| 7 | BST/GMT clock-change edge case handled by extraction, not classification | 8/10 |
| 8 | Interview reschedule without new date has no cancellation status | 7/10 |
| 9 | Recruiter quality scoring compresses most scores to middle band | 7/10 |
| 10 | Correction webhook and email reply lack authentication | 7/10 |
| **Average** | | **7.2/10** |

---

### Persona 2: Technical Architect / n8n Expert -- Rounds 11-20

**Perspective:** Remaining architectural concerns after History API migration, transaction wrapping, and graceful degradation.

---

**Round 11: The WF-EM-PURGE workflow (v3 addition) runs daily at 3 AM but does not acquire a workflow lock**

*Concern:* All stateful workflows (WF-EM-01 through WF-EM-06) use the workflow lock pattern (Section 5.2). The new WF-EM-PURGE workflow executes DELETE statements against `email_processing_log`, `email_notifications`, `workflow_errors`, and `email_sender_patterns`. If the purge runs concurrently with WF-EM-03 (which inserts into `email_processing_log`) or WF-EM-06 (which inserts into `email_notifications`), the DELETE could remove records that a concurrent workflow just inserted. The purge has no lock.

*Analysis:* The purge uses time-based WHERE clauses (`created_at < NOW() - INTERVAL '90 days'`). A record inserted by a concurrent workflow at 3:00:01 AM would have `created_at = NOW()`, which is far from 90 days ago. The DELETE would not affect it. The time-based filtering provides inherent safety -- there is no race condition because the purge only touches old records that no active workflow would reference. The lock omission is acceptable for this reason. The WF-EM-PURGE workflow is not listed in the "stateful workflows" set because it does not process email pipeline state; it performs housekeeping.

*Score:* 8/10

---

**Round 12: The transaction DO block in WF-EM-03 (v3 fix) wraps extraction + Module 4 update + status change, but Module 4's `transition_application_state()` function is referenced without being defined**

*Concern:* Section 14.3 shows: `PERFORM transition_application_state(...);` inside the DO block. This function is expected to exist in Module 4's schema. If Module 4 is not yet implemented (or its schema differs from the expectation), this function call fails and the entire transaction rolls back, preventing any extraction from completing. The PRD acknowledges this dependency ("Module 4 PRD will define the full schema; these are the fields Module 5 writes to" in Section 15.3) but the transaction now creates a hard dependency: Module 5 cannot extract data until Module 4's function exists.

*Analysis:* The transaction wrapping is the correct architectural choice (v2 identified crash-between-steps as a real risk). The dependency on Module 4 is managed by the rollout plan: Phase 3 (Data Extraction + Module Integration) includes "Test Module 4 integration (if Module 4 is ready)" with the conditional phrasing indicating awareness. The practical approach is to stub `transition_application_state()` as a no-op function during Module 5 standalone testing, then replace it with the real implementation when Module 4 is deployed. The PRD should mention this stub strategy.

*Score:* 7/10

---

**Round 13: The v3 History API extension to sent folder monitoring (Section 6.7) describes both the old timestamp approach and the new History API approach in the same section, creating implementation ambiguity**

*Concern:* Section 6.7 starts with the timestamp-based polling query (`?q=in:sent after:{{ lastSentPollTimestamp }}`), then later states: "However, to eliminate edge cases, the system extends the sent folder query to use the History API." Both approaches are described. An implementer reading the section sequentially might implement the timestamp approach and stop reading, missing the History API paragraph that follows. The section reads as a narrative evolution rather than a clear specification.

*Analysis:* The section does eventually state the History API is the chosen approach, and the final sentence confirms it. But the structure is confusing -- the timestamp code block is presented first (suggesting it is the implementation) with the History API correction appended afterward. A cleaner structure would present only the History API approach and relegate the timestamp discussion to an "Architecture Decision" callout, similar to the inbox polling section (Section 6.3) which clearly marks the timestamp approach as "considered but rejected."

*Score:* 7/10

---

**Round 14: The circuit breaker implementation (Section 16.3) stores state in JavaScript class instances, which do not persist across n8n workflow executions**

*Concern:* The `CircuitBreaker` class (Section 16.3) maintains `state`, `failureCount`, and `lastFailureTime` as instance properties. In n8n, each workflow execution creates a new JavaScript context. The circuit breaker state is lost between executions. A workflow that fails 3 times in one execution would set `failureCount = 3`, but the next execution starts with `failureCount = 0`. The circuit never actually opens because no single execution hits the `failureThreshold = 5` consecutive failures.

*Analysis:* For the circuit breaker to function across executions, its state must be persisted in the database. The `system_config` table could store circuit breaker state (`claude_api_failures`, `claude_api_last_failure`, `claude_api_circuit_state`). Each workflow execution would read the state at start, update it on success/failure, and check it before making API calls. The current implementation is architecturally incorrect for the n8n execution model but the v3 graceful degradation fix (Claude API health check before classification batch) partially compensates -- it performs a health check at the start of each execution rather than relying on cross-execution state.

*Score:* 7/10

---

**Round 15: The email status CHECK constraint (Section 13.1) includes `drafted` and `notified` in the GDPR purge function (Section 13.12) but these values are not in the CHECK constraint**

*Concern:* The `emails.status` column has a CHECK constraint: `CHECK (status IN ('ingested', 'classified', 'extracted', 'labeled', 'draft_created', 'completed', 'skipped', 'error'))`. The v3 purge function targets `status IN ('completed', 'classified', 'extracted', 'labeled', 'drafted', 'notified', 'skipped')`. The values `drafted` and `notified` are not in the CHECK constraint -- they would cause a constraint violation if any workflow tried to set them. The purge function's WHERE clause includes statuses that can never exist in the table.

*Analysis:* The purge function's inclusion of `drafted` and `notified` is a documentation error. The correct status values are `draft_created` (not `drafted`) and there is no `notified` status. These phantom status values in the purge WHERE clause are harmless -- they match zero rows and do not cause errors. But they indicate a copy-paste or translation error in the v3 fix. The functional purge coverage is correct because the other statuses in the WHERE clause (`completed`, `classified`, `extracted`, `labeled`, `skipped`) cover all reachable terminal states.

*Score:* 7/10

---

**Round 16: The workflow lock ON CONFLICT clause (Section 5.2) only acquires a lock if the previous lock has expired, but does not handle the case where the previous execution completed normally and released the lock**

*Concern:* The lock pattern inserts a row with `ON CONFLICT ... DO UPDATE ... WHERE workflow_locks.expires_at < NOW()`. Each workflow also has a "Release Workflow Lock: DELETE FROM workflow_locks WHERE workflow_name = ..." at the end (shown in WF-EM-01, Section 14.1). If the previous execution completed normally and deleted the lock row, the next execution's INSERT succeeds (no conflict). If the previous execution crashed and the lock row remains, the next execution's INSERT conflicts. The ON CONFLICT only updates if `expires_at < NOW()`. If the crash happened 1 minute ago and expires_at is 9 minutes in the future, the new execution cannot acquire the lock and skips. This is correct behavior -- it prevents concurrent execution during the 10-minute window. After 10 minutes, the expired lock is overwritten and processing resumes.

*Analysis:* The lock mechanism works as designed. The 10-minute expiry handles crashed executions. Normal completions delete the lock. The only edge case is if an execution takes exactly 10 minutes (lock expires) and is still running when the next execution starts. The `FOR UPDATE SKIP LOCKED` row-level lock provides the second layer of protection for this scenario. The two-layer approach is robust.

*Score:* 8/10

---

**Round 17: The n8n Cron triggers for WF-EM-01 specify different schedules for business hours and off-hours, but n8n requires separate workflows or a conditional check for time-based schedule variation**

*Concern:* Section 14.1 specifies: "Business hours: */5 6-22 * * * (Europe/London), Off-hours: */15 23,0-5 * * * (Europe/London)." n8n's Cron trigger node accepts a single cron expression. To implement two schedules, the workflow needs either: (a) two separate Cron triggers feeding into the same workflow, (b) a single */5 cron with a Code node that checks the current hour and skips execution during off-hours (except every 15 minutes), or (c) two separate workflows. The PRD does not specify which approach to use.

*Analysis:* n8n supports multiple triggers per workflow. Two Cron nodes (one for business hours, one for off-hours) can feed into the same workflow start. This is a standard n8n pattern. The PRD specifies the desired behavior (polling frequency by time of day) without prescribing the n8n implementation mechanism, which is appropriate for a PRD. An implementer familiar with n8n would immediately recognize the two-trigger pattern.

*Score:* 8/10

---

**Round 18: The v3 Claude API health check (WF-EM-02) uses a "minimal classification request" as a probe, but this incurs API cost on every healthy execution**

*Concern:* The v3 degradation fix adds a health check before each classification batch: "Test with a minimal classification request" (Section 16.5). WF-EM-02 runs every 5 minutes, which is 288 times per day. If each health check sends a minimal Claude API request (even a short one), that is 288 additional API calls per day. At $0.000625 per call, this adds ~$0.18/day or ~$5.40/month -- more than the estimated total email processing cost.

*Analysis:* The health check description in Section 16.5 (WF-EM-HEALTH) runs every 15 minutes, not every 5 minutes. The WF-EM-02 health check described in the v3 fix ("Check Claude API Health before classification batch") is a separate inline check. The inline check could use a lightweight approach: send a minimal prompt ("Classify: test") and check for a 200 response, or simply make a GET request to Anthropic's status endpoint (no API cost). The PRD does not specify whether the health check is a full classification request or a lightweight connectivity test. If implemented as a lightweight test (HTTP HEAD or a status endpoint check), the cost is zero.

*Score:* 7/10

---

**Round 19: The database schema defines `email_extracted_data.rejection_feedback` in the purge function (Section 13.12) but this column does not exist in the table definition (Section 13.3)**

*Concern:* The v3 purge function sets `rejection_feedback = NULL` when purging extracted text. But the `email_extracted_data` table (Section 13.3) has `rejection_reason TEXT` and `feedback_offered BOOLEAN`, not `rejection_feedback`. The purge SQL would fail with a column-not-found error.

*Analysis:* This is a naming inconsistency introduced by the v3 fix. The intended column is likely `rejection_reason` (which contains body-derived text that should be purged). The fix correctly identifies that body-derived text in extracted data needs purging, but references a non-existent column name. An implementer would encounter a SQL error during testing and correct the column name. The architectural intent is sound; the implementation detail has a typo.

*Score:* 7/10

---

**Round 20: The WF-EM-04 label cleanup (v3 Section 9.4b) checks for existing labels before applying new ones, but the Gmail API does not return per-message labels for a thread in a single call**

*Concern:* The v3 label precedence implementation says "WF-EM-04 checks for existing job-search labels on the thread before applying new ones. If a higher-precedence label would be applied, it removes lower-precedence labels in the same removal API call." This requires knowing which labels exist on the thread. The Gmail API's `messages.get` returns labels for a single message. To check all messages in a thread for existing job labels, WF-EM-04 needs to either: (a) fetch all messages in the thread and check each one's labels, or (b) maintain a local cache of applied labels in the database. Option (a) requires N API calls per thread (where N is the message count). Option (b) is more efficient but introduces a cache-consistency concern.

*Analysis:* The database already tracks which labels were applied to which emails (the `email_classifications` table links emails to classifications, and the label mapping is deterministic). WF-EM-04 can query the database for all emails in the same thread and their classifications, determine the current label set, and compute the label changes needed. This avoids additional Gmail API calls. The implementation is straightforward given the existing data model. The PRD's description of "checks for existing labels" is ambiguous about whether it means Gmail labels or database-derived labels, but the database approach is the obvious implementation.

*Score:* 8/10

---

#### Persona 2 Summary (v3): Technical Architect / n8n Expert

| Round | Concern | Score |
|-------|---------|-------|
| 11 | WF-EM-PURGE lacks workflow lock (acceptable -- time-based safety) | 8/10 |
| 12 | Transaction references undefined Module 4 function | 7/10 |
| 13 | Sent folder section describes both old and new approaches | 7/10 |
| 14 | Circuit breaker state does not persist across n8n executions | 7/10 |
| 15 | GDPR purge references non-existent status values | 7/10 |
| 16 | Workflow lock mechanism is robust under crash scenarios | 8/10 |
| 17 | Dual cron schedules need two-trigger n8n pattern | 8/10 |
| 18 | Claude health check may incur unnecessary API cost | 7/10 |
| 19 | Purge function references non-existent column name | 7/10 |
| 20 | Label cleanup query approach not specified (DB vs API) | 8/10 |
| **Average** | | **7.4/10** |

---

### Persona 3: Email/Communication Expert -- Rounds 21-30

**Perspective:** Remaining concerns about professional communication quality, tone, and email best practices.

---

**Round 21: The v3 follow-up draft prompt distinguishes "have" vs "need to arrange" items, but the system has no way to know which items the candidate actually has**

*Concern:* The v3 fix updated the follow-up draft prompt to distinguish between items the candidate "definitely has" (CV, certificates, ID) and items requiring third-party coordination (references, portfolio). But this distinction is hardcoded in the prompt, not derived from candidate data. The prompt assumes the candidate has her PhD certificate and ID readily available. If the candidate's PhD certificate is with her parents in India, the draft would promise delivery of an item she cannot quickly provide. The system has no knowledge of what documents the candidate actually possesses.

*Analysis:* This is an inherent limitation of auto-drafting. The system cannot know the candidate's physical possession of documents. The v3 prompt improvement is still an improvement over v2 (which promised unconditional delivery of everything). The distinction between "will provide" (for common items) and "will arrange" (for items requiring coordination) is a reasonable heuristic. The candidate reviews and edits every draft before sending, so she would modify the wording if she does not have a requested document. The draft is a starting point, not a final message.

*Score:* 8/10

---

**Round 22: The interview confirmation draft prompt instructs acknowledgment of preparation requirements, but does not instruct Claude to request clarification when requirements are ambiguous**

*Concern:* An employer might say "Please prepare a short presentation." This is ambiguous: how long is "short"? What topic? What format? The v3 draft prompt says "acknowledge them: 'I note the request to prepare [X] and will have this ready.'" But acknowledging an ambiguous requirement without asking for clarification could cause the candidate to prepare the wrong thing. A human would reply: "Thank you for the invitation. I note the request to prepare a presentation -- could you confirm the expected duration and whether a particular topic is preferred?"

*Analysis:* Adding a conditional instruction ("If preparation requirements are vague or missing key details such as duration or topic, ask a clarifying question rather than blindly confirming") would make the draft more professionally useful. The current prompt produces a confirmation that may mask the candidate's uncertainty. However, the candidate reviews and edits the draft, and would likely add clarifying questions herself. The draft quality is good enough to serve as a starting point.

*Score:* 7/10

---

**Round 23: The D-tier recruiter response is still described only as "polite one-line decline" (US-516) without a dedicated prompt template**

*Concern:* The C-tier prompt (Section 11.2) is fully specified. The A/B-tier prompt is fully specified. The D-tier response is mentioned only in the user story acceptance criteria: "D-tier / Blacklisted: Polite one-line decline." There is no prompt template for D-tier responses. The drafting workflow (WF-EM-05, Section 14.5) shows "[Code: Determine Response Type] -- Based on relevance_tier: A/B -> interested, C -> decline with redirect, D -> decline" but does not show a D-tier prompt. An implementer would need to write this prompt themselves.

*Analysis:* A one-line decline does not need a complex prompt. A simple "Thank you for thinking of me, but this role isn't quite the right fit at the moment. Best wishes, Selvi" suffices. The lack of a prompt template is a minor documentation gap, not a functional one. The v2 evaluation noted that D-tier responses should consider the recruiter's personalization score (Round 8, score 5/10). The v3 PRD did not address this -- personalized D-tier outreach still receives the same curt treatment as mass-blast D-tier spam.

*Score:* 7/10

---

**Round 24: The notification HTML format (v3 fix) sends HTML via Resend but the Resend API call in Section 12.5 still shows only `"text"` field, not `"html"`**

*Concern:* The v3 fixes log states: "Changed notification formatting to HTML with bold field labels, responsive layout, and styled action buttons." But the Resend API configuration in Section 12.5 shows: `"text": "{{ $json.notificationBody }}"` with no `"html"` field. The Resend API supports both `text` and `html` fields. If only the `text` field is sent, email clients render plain text regardless of any HTML formatting. The v3 fix describes the intent but the API call specification was not updated to match.

*Analysis:* This is a documentation inconsistency between the v3 fix description and the PRD body. The WF-EM-06 node chain (Section 14.6) mentions "Format Notification Email (HTML)" as a code node with responsive layout details, suggesting the HTML is generated. But the downstream Resend HTTP Request node still sends it as `text`. An implementer would need to add `"html": "{{ $json.notificationBodyHtml }}"` to the Resend request body. The fix intent is clear; the specification is incomplete.

*Score:* 7/10

---

**Round 25: The system creates drafts for all recruiter outreach emails regardless of whether the recruiter sent a mass blast or a personalized message**

*Concern:* A recruiter who sends identical emails to 200 candidates deserves a different response cadence than one who wrote a personalized message referencing the candidate's specific background. The system drafts a response for all recruiter outreach (Section 11.1: "recruiter_outreach: YES (always)"). For mass-blast D-tier recruiter emails, the candidate's Gmail Drafts folder accumulates responses she will never send. After a few weeks, the Drafts folder contains dozens of unused recruiter decline drafts, creating clutter that makes it harder to find the drafts she actually wants to review and send.

*Analysis:* The drafting decision tree (Section 11.1) could add a filter: "recruiter_outreach: YES if relevance_tier IN (A, B, C), NO if D-tier." D-tier roles already generate a "polite one-line decline" which the candidate is unlikely to send. Not creating the draft saves Claude API cost (negligible) and reduces Drafts folder clutter (meaningful UX improvement). The `email_drafts` table would have fewer unused records. The candidate can always compose a manual response for the rare D-tier email she wants to acknowledge.

*Score:* 7/10

---

**Round 26: The daily summary format (Section 14.7) does not include Module 4 sync status, leaving the candidate unaware of applications with missing status updates**

*Concern:* The daily summary reports email counts by category, pending follow-ups, stale conversations, and new recruiter contacts. It does not report how many classified emails were successfully linked to Module 4 applications vs. how many were "unmatched." Section 15.3 defines unmatched email behavior (log and include in daily summary for manual review), but the summary template (Section 14.7) does not include an "UNMATCHED EMAILS" section. If 3 rejections arrived but only 1 matched an application in Module 4, the candidate does not know that 2 applications have stale status records.

*Analysis:* The unmatched email information is described in the cross-module integration section (Section 15.3) as something that "appears in the daily summary for manual review," but the summary template does not have a section for it. This is a gap between the integration specification and the summary specification. Adding an "UNMATCHED EMAILS: 2 rejections could not be linked to applications -- please verify" section would close the loop. The implementation is straightforward: query `email_extracted_data WHERE module4_updated = false AND classification IN ('acknowledgment', 'rejection', 'interview_invite', 'offer')`.

*Score:* 7/10

---

**Round 27: The draft quality validator blocks AI phrases like "I appreciate the opportunity" which is a normal phrase in UK business correspondence**

*Concern:* The AI phrase blocklist (Section 11.4) includes "I appreciate the opportunity." This is a common and natural phrase in UK job-search email replies. A candidate responding to an interview invitation might genuinely write "I appreciate the opportunity to discuss the role." The validator flags this as an AI-typical phrase, which could cause the system to reject or flag otherwise-natural drafts. The v1 evaluation (Round 26) noted "Overly aggressive blocklist removes normal UK business phrases" -- the v3 PRD did not revise the blocklist.

*Analysis:* The blocklist serves an important purpose: preventing obviously AI-generated output. But several entries are normal UK business English: "I appreciate the opportunity," "certainly," "absolutely." The validator does not reject drafts -- it flags issues in `validation_issues`. The candidate sees the draft in Gmail and can send it regardless. But if the validator is intended to guide draft quality improvement, false positives dilute the signal. A more targeted list would remove phrases that are normal in context and focus on phrases that are never used by humans in professional email (e.g., "leverage my expertise," "synergize," "bring to the table").

*Score:* 7/10

---

**Round 28: The system does not track whether the candidate has responded to interview invitations, creating phantom "pending" items**

*Concern:* An interview invitation is classified, extracted, notified, and a draft is created. The candidate reviews the draft, edits it, and sends it. But the system does not detect the send action in real-time. The sent folder monitoring (WF-EM-08) runs every 30 minutes. Until the next poll, the system considers the interview invitation as pending action. If the candidate sends the response at 10:01 AM and the daily summary generates at 8:00 AM the next day, the sent folder poll at 10:30 AM would detect the response and update the thread. The daily summary would correctly omit it. But the Gmail labels still show `Job/Interview/Upcoming` even after the candidate has confirmed attendance. Only Module 6 (interview scheduling) would eventually move it to "confirmed."

*Analysis:* The label lifecycle management (Section 9.4) includes "Interview attended: move from Job/Interview/Upcoming to Job/Interview/Completed." But this transition is triggered by Module 6, not by Module 5. Module 5 has no visibility into whether the interview has been confirmed, only whether the email has been classified and the draft created. The label `Upcoming` remains until Module 6 reports the interview as attended. This is a cross-module coordination issue that neither Module 5 nor Module 6 alone can solve without the other being implemented. For v1.0, this is acceptable if Module 6 is deployed concurrently.

*Score:* 7/10

---

**Round 29: The candidate signature HTML (Section 11.5) still contains `+44 XXXX XXXXXX` as a placeholder -- the v3 validator catches it but the configuration was not updated**

*Concern:* The v3 fix added placeholder detection to the draft validator. The v3 fix log for "Should Fix #8" states: "Added regex checks for XXXX XXXXXX phone placeholders and [PLACEHOLDER] bracket markers to draft quality validation function." But the `system_config` entry for `candidate_email_signature` (Section 11.5) still shows `+44 XXXX XXXXXX`. The validator will flag every single draft as having a placeholder issue. This is a deployment configuration issue, not a PRD architecture issue -- the Phase 0 setup should replace the placeholder with the actual number. But the PRD documenting the placeholder as the default value is misleading.

*Analysis:* The PRD uses the placeholder for privacy (not publishing the candidate's real phone number in a design document). This is appropriate. The Phase 0 task list (Section 18.2) does not include a task for configuring the candidate signature with real contact details. Adding "0.5c: Configure candidate_email_signature in system_config with real phone number" to the Phase 0 task list would make the deployment checklist complete.

*Score:* 7/10

---

**Round 30: The system has no mechanism to detect or handle when an employer uses a scheduling link (Calendly, Microsoft Bookings) instead of proposing specific interview times**

*Concern:* Many UK employers now send interview invitations that say "Please select a time using this link: [Calendly URL]" instead of proposing specific dates. The extraction pipeline looks for `interview_date`, `interview_time`, and `alternative_times_offered`. When a scheduling link is provided without explicit times, these fields are null. The notification says "Date: to be confirmed" and the draft confirms attendance without specifying a date. But the critical information -- the scheduling link -- is buried in the email body. The extraction schema has no `scheduling_link` field at the email_extracted_data level (though Section 8.5 mentions `scheduling_link` in the Greenhouse and Lever ATS rules). The notification format (Section 12.2) does not include a scheduling link field.

*Analysis:* The Greenhouse extraction rules (Section 8.5) capture `scheduling_link`. The generic extraction prompt (Section 8.2) does not list `scheduling_link` as a field for interview invitations. The notification template (Section 12.2) shows "View original email" with a Gmail link, which allows the candidate to find the scheduling link manually. But a notification that says "WHAT TO DO: 1. Click the scheduling link to choose a time" with the actual link would be significantly more actionable. The `interview_link` field exists in the extraction schema (for video meeting links), which could be repurposed or supplemented with a `scheduling_link` field.

*Score:* 7/10

---

#### Persona 3 Summary (v3): Email/Communication Expert

| Round | Concern | Score |
|-------|---------|-------|
| 21 | Follow-up draft cannot know candidate's actual document possession | 8/10 |
| 22 | Draft does not request clarification for ambiguous preparation requirements | 7/10 |
| 23 | D-tier prompt template missing; personalization not factored | 7/10 |
| 24 | HTML notification fix described but Resend API call not updated | 7/10 |
| 25 | Drafts created for D-tier mass-blast recruiter emails (clutter) | 7/10 |
| 26 | Daily summary missing Module 4 sync status and unmatched emails | 7/10 |
| 27 | AI phrase blocklist over-aggressive for UK business English | 7/10 |
| 28 | No real-time tracking of candidate response to interview invitations | 7/10 |
| 29 | Signature placeholder still in system_config; Phase 0 task missing | 7/10 |
| 30 | Scheduling links (Calendly) not extracted or surfaced in notifications | 7/10 |
| **Average** | | **7.1/10** |

---

### Persona 4: AI/LLM Specialist -- Rounds 31-40

**Perspective:** Prompt engineering, model behavior, classification edge cases remaining after v3 hardening.

---

**Round 31: The v3 not_job_related few-shot examples (9 and 10) are clear-cut cases that do not test the ambiguous boundary**

*Concern:* Example 9 is a friend asking about the job hunt. Example 10 is an obvious scam. Both are easy cases. The harder boundary is: a recruiter from a non-UK market emailing about a role in the wrong country, a university newsletter from a former employer that mentions job openings, or a LinkedIn connection congratulating the candidate on a work anniversary (which triggers LinkedIn notification emails that pass through the inbox). These are emails that contain job-related keywords but are not actionable in the candidate's job search.

*Analysis:* The two negative examples are better than none (the v2 prompt had zero). They establish the `not_job_related` category as a valid classification output. But ambiguous boundary cases remain uncovered. The calibration set (Section 7.6) could include these harder cases. The weekly manual audit of 20 emails would catch systematic misclassification of non-job emails over time. The practical impact is low: a personal email incorrectly classified as job-related would be processed, labeled, and possibly extraction-attempted (returning null fields). The cost is a few pennies of wasted Claude API usage and an extra row in the database.

*Score:* 7/10

---

**Round 32: The classification prompt asks Claude to return `sender_type` but this field is redundant with the sender pattern matching that already occurred**

*Concern:* The classification JSON response includes `"sender_type": "employer|recruiter|job_board|ats|personal_contact|unknown"`. The sender classification (Section 6.5) already determines sender type through pattern matching before Claude is called. For emails that reach Claude, the sender pattern returned "unknown" or "automated" with low confidence. Asking Claude to also classify the sender type means the system has two potentially conflicting sender type assessments: one from pattern matching and one from Claude. The `email_classifications` table stores Claude's `sender_type`, but no code uses it for decision-making -- all sender-based decisions use `sender_pattern_match`.

*Analysis:* The redundancy is harmless. Claude's sender_type provides a backup classification when pattern matching returns "unknown." It could be useful for future features (e.g., weighting notification urgency by sender type). The extra output token cost (one field in a JSON response) is negligible. The concern is that an implementer might confuse the two sender type sources and use the wrong one in a decision branch. Clear documentation distinguishing "sender pattern match (pre-Claude)" from "Claude sender type (in-prompt assessment)" would prevent this.

*Score:* 8/10

---

**Round 33: The v3 contextual phrase escalation ("we'd like to offer you," "offer of employment") could miss non-English phrasing of offers from multinational employers**

*Concern:* UK-based roles at multinational companies may use non-standard offer language. A German company's UK HR team might write "We would be happy to extend you the position" or "We hereby confirm your appointment." An Indian IT consultancy might write "Your candidature has been selected for the position." The safety escalation phrases (Section 14.2) are calibrated for standard UK English offer phrasing. Non-standard phrasing would not trigger escalation, and if Haiku classifies it as something other than `offer` with >0.80 confidence, the misclassification would be accepted.

*Analysis:* The safety escalation has three conditions: (1) Haiku classifies as offer (always escalate), (2) contextual phrases, (3) employer with active application at interview/offer stage + Haiku says acknowledgment/follow_up. Condition 3 provides a catch-all for emails from known employers at advanced application stages, regardless of phrasing. This would catch a non-standard offer from a company the candidate has interviewed with. The gap is for offers from companies where the candidate applied but was not yet at the interview stage -- the rarest and least likely scenario. The combined defense layers (10 examples, contextual phrases, employer-stage check) provide strong coverage even for non-standard phrasing.

*Score:* 8/10

---

**Round 34: The extraction prompt sends the full email body (not truncated) but the classification prompt truncates to 3000 characters -- extraction may extract data that was invisible to classification**

*Concern:* The classification user prompt (Section 7.3) uses `{{ body_stripped | truncate(3000) }}`. The extraction prompt (Section 8.2) uses `{{ body_stripped }}` (no truncation). For a long email where classification-relevant content is in the first 3000 characters and extraction-relevant content is after 3000 characters, the classification and extraction may be inconsistent. Example: a recruiter email with a 4000-character body. The first 3000 characters describe a role. The last 1000 characters say "P.S. We also have a second role that might interest you: [different role]." Classification sees one role (recruiter_outreach.new_role). Extraction sees two roles. The multi-role extraction logic (US-521) would create two role proposals for a single recruiter_outreach classification.

*Analysis:* This inconsistency exists but is benign. The extraction is more complete than the classification, which is the right direction. If classification were more complete than extraction, we would miss data. The reverse (extraction finding more than classification expected) means we capture more structured data, which is the goal. The multi-role handling (US-521) is designed for exactly this scenario. The only concern is if the post-3000 content changes what the classification should be -- e.g., the post-3000 content reveals this is actually a follow_up_request, not recruiter_outreach. But the extraction prompt receives the classification as input and extracts fields accordingly, so it would not reclassify.

*Score:* 8/10

---

**Round 35: The calibration set weekly re-classification test (Section 7.6) tests classification accuracy but not extraction accuracy**

*Concern:* The `email_classification_calibration` table stores expected classification and tests actual classification weekly. There is no equivalent calibration set for extraction. Extraction accuracy (90% target) is measured through the weekly manual audit of 20 emails (Section 18.8, task 6.1). But manual audits are subjective and time-consuming. A calibration set for extraction would test: given a known email body with expected extracted fields, does the extraction prompt produce the correct values? This would catch extraction regressions from Claude model updates or prompt drift.

*Analysis:* Building an extraction calibration set is harder than a classification calibration set because extraction has many more fields and category-specific schemas. A practical approach: maintain 10 extraction test cases (2 per major category: interview, rejection, recruiter, offer, follow-up) with expected field values. Run weekly alongside the classification calibration. The cost is 10 additional Claude API calls per week (~$0.01). The benefit is automated detection of extraction drift.

*Score:* 7/10

---

**Round 36: The extraction prompt instructs "For dates, convert to ISO 8601 format" but Claude may not reliably perform date arithmetic for relative expressions**

*Concern:* The extraction prompt says: "If the email says 'next Tuesday' and today is 2026-03-29 (Sunday), next Tuesday is 2026-03-31." This gives Claude a specific example to follow. But Claude receives the email's date (not today's date) as reference. The prompt does not specify whether "next Tuesday" should be resolved relative to the email date or the current date. If the email was sent on Thursday but processed on Sunday (due to a pipeline delay), "next Tuesday" relative to Thursday means the upcoming Tuesday, but relative to Sunday it might mean the same or the following Tuesday, depending on interpretation.

*Analysis:* The extraction prompt's user template includes `DATE: {{ date }}` (the email date), and the system prompt says "today is 2026-03-29." The system prompt date is presumably updated dynamically. If the system prompt says today's date and the email says the email's date, Claude has both references. But the instruction "today is 2026-03-29" should actually be "today is {{ current_date }}" to stay accurate. If hardcoded (as shown), the system prompt becomes stale and relative date resolution breaks. The implementation likely uses a dynamic date, but the PRD shows a static example, creating ambiguity.

*Score:* 7/10

---

**Round 37: The classification prompt has 10 few-shot examples totaling approximately 1500 tokens, but the prompt does not version-tag the examples**

*Concern:* The classification prompt (Section 7.3) includes examples that are part of the system prompt. The `email_classifications` table stores `prompt_version VARCHAR(20)` for traceability. But there is no mechanism to version the examples separately from the prompt. If an example is modified to improve accuracy (e.g., adjusting Example 3's confidence from 0.82 to 0.88), the prompt_version should change. But the PRD does not define the versioning scheme. A developer might change an example without updating the version, making the `prompt_version` field unreliable for tracing accuracy changes.

*Analysis:* For a personal project, prompt versioning is managed by the developer who controls both the prompt and the deployment. Formal versioning (semantic versioning of prompts, changelog) would be over-engineering. The `prompt_version` field exists as a diagnostic tool. If the developer records a version when making changes, it works. If not, it is stale but harmless. The drift detection calibration set provides a functional safety net regardless of whether prompt versions are tracked correctly.

*Score:* 8/10

---

**Round 38: The `scoreRoleRelevance()` function uses hardcoded `TARGET_MIN = 70000` and `TARGET_MAX = 85000` that would need updating if the candidate's salary expectations change**

*Concern:* The v2 evaluation (Round 36) noted that the candidate profile is hardcoded in the classification prompt. The v3 PRD did not externalize it. The same hardcoding exists in the relevance scoring function. Both the classification prompt and the scoring function reference specific salary ranges, location preferences, and target titles. Changing the candidate's target salary from GBP 70-80k to GBP 90-100k (after gaining experience or targeting a higher level) requires editing both the prompt and the scoring function, in two different sections of the PRD, and ensuring they stay synchronized.

*Analysis:* This is a maintenance concern, not a functional gap. The candidate's targets change infrequently (once per job search cycle). The PRD is a design document, not a configuration file -- the actual n8n implementation would read these values from `system_config` or a dedicated `candidate_profile` table. The PRD hardcodes them for clarity of the algorithm explanation. The recommendation is to add a `candidate_profile` table to the schema that stores target salary range, target titles, preferred locations, and preferred sectors, and reference these in both the prompt and scoring function documentation.

*Score:* 7/10

---

**Round 39: The sub-category validation is not enforced -- Claude could return `interview_invite` with sub_category `new_role` (which belongs to recruiter_outreach) and no validation would catch it**

*Concern:* The classification prompt defines category-specific sub-categories (Section 7.3). The `email_classifications` table stores `sub_category VARCHAR(50)` without a CHECK constraint linking sub-category to category. A Claude response with `classification: "interview_invite", sub_category: "new_role"` would be stored without error. Downstream workflows that filter by sub_category could produce unexpected results: a `new_role` sub-category on an interview invite might be misinterpreted as a recruiter outreach event.

*Analysis:* The sub_category field is used primarily for analytics and daily summary detail. No workflow decision branches on sub_category alone -- decisions are based on the primary classification. The inconsistency would appear in reporting (e.g., "2 interview invitations: 1 phone, 1 new_role" looks wrong) but would not cause functional failures. Adding a validation step in WF-EM-02 (after parsing Claude's response) that checks sub_category membership against the parent classification would catch this. The validation could default to `null` for invalid sub-categories rather than rejecting the classification.

*Score:* 7/10

---

**Round 40: The system does not handle the case where Claude returns valid JSON but with unexpected field names or structure**

*Concern:* The classification prompt requests a specific JSON format. Claude usually follows it, but occasionally returns variations: `"category"` instead of `"classification"`, `"score"` instead of `"confidence"`, or wrapping the JSON in markdown code blocks. The "[Code: Parse Claude Response]" step (Section 14.2) says "Extract JSON from Claude response" without specifying error handling for structural variations. If Claude wraps the response in \`\`\`json...\`\`\`, the parse step would fail unless it strips markdown fencing first.

*Analysis:* Claude 3.5 Haiku and Sonnet reliably follow structured output instructions when the format is clearly specified. The prompt says "Respond in this exact JSON format:" which is a strong instruction. Markdown fencing is a common issue with some models but rare with Claude when the instruction is explicit. Adding a pre-parse step that strips common wrapping patterns (markdown fencing, leading/trailing whitespace, "Here is the JSON:" preamble) would make the parser more robust. This is a standard LLM integration best practice.

*Score:* 7/10

---

#### Persona 4 Summary (v3): AI/LLM Specialist

| Round | Concern | Score |
|-------|---------|-------|
| 31 | not_job_related examples are clear-cut, not boundary-testing | 7/10 |
| 32 | sender_type in prompt is redundant with pattern matching | 8/10 |
| 33 | Contextual phrase escalation misses non-English offer phrasing | 8/10 |
| 34 | Extraction sees more than classification (truncation asymmetry) | 8/10 |
| 35 | No extraction calibration set; only classification is tested | 7/10 |
| 36 | Relative date resolution reference ambiguity (email date vs today) | 7/10 |
| 37 | Prompt examples not version-tagged separately | 8/10 |
| 38 | Salary and profile targets hardcoded in scoring function | 7/10 |
| 39 | Sub-category not validated against parent classification | 7/10 |
| 40 | No handling of Claude response structural variations | 7/10 |
| **Average** | | **7.4/10** |

---

### Persona 5: Privacy & Compliance -- Rounds 41-50

**Perspective:** GDPR and data handling after v3 fixes addressed purge lifecycle, breach procedure, and extracted text purge.

---

**Round 41: The v3 breach notification procedure (Section 17.6b) is well-structured but does not address the scenario where the breach is the Claude API key being leaked**

*Concern:* Section 17.6b lists three breach vectors: Gmail OAuth compromise, database breach, and Claude API key leak. The containment step says "Revoke Claude API key." But if the Claude API key was leaked (e.g., committed to a public Git repo, visible in n8n execution logs, or extracted from the server environment), the attacker could have used the key to make API calls. The breach procedure does not assess what an attacker could do with the Claude API key: they could send arbitrary text to Claude for processing (at the candidate's expense) but could not access any email data through the key alone. The API key grants write-access (send prompts) but no read-access to previously processed data.

*Analysis:* The Claude API key is the least sensitive credential in the system. It cannot be used to access Gmail, the database, or any stored data. The worst case is financial: an attacker runs expensive prompts on the candidate's account. Anthropic's usage monitoring and spending alerts would detect anomalous usage. The breach procedure's "Revoke Claude API key" step is correct and sufficient. The risk assessment in Step 3 should note that Claude API key exposure is a financial risk, not a data exposure risk.

*Score:* 8/10

---

**Round 42: The GDPR purge now covers all post-classification statuses, but the purge of `email_extracted_data` text fields removes `preparation_instructions` which has ongoing value for interview preparation**

*Concern:* The v3 fix adds: `UPDATE email_extracted_data SET role_description_summary = NULL, preparation_instructions = NULL, rejection_feedback = NULL` for emails older than 7 days. But `preparation_instructions` contains information the candidate may need for interview preparation, which could occur weeks after the email arrived. If the interview is scheduled for 14 days after the invitation, the preparation instructions are purged 7 days before the interview. The candidate loses access to "Please prepare a 10-minute presentation on your approach to L&D strategy" just when she needs it most.

*Analysis:* The purge is based on email age (7 days from ingestion), not on interview date. A smarter purge would retain `preparation_instructions` until after the interview date has passed. The Module 6 integration passes interview details including preparation instructions to the scheduling module, so the data should be available there even after the Module 5 purge. However, if Module 6 is not yet implemented, the Module 5 purge destroys the only copy. A pragmatic fix: exclude `preparation_instructions` from the purge for emails classified as `interview_invite` until the `interview_date` has passed.

*Score:* 7/10

---

**Round 43: The v3 automated purge workflow (WF-EM-PURGE) deletes `email_sender_patterns WHERE last_seen_at < 180 days AND source = 'auto_detected'` but no workflow sets `last_seen_at` or `source` fields**

*Concern:* The `email_sender_patterns` table (Section 13.8) has `pattern`, `pattern_type`, `classification`, `sub_category`, `confidence`, `source_name`, `notes`, `enabled`, `created_at`, `updated_at` columns. The purge SQL references `last_seen_at` and `source` columns that do not exist in the table definition. The purge would fail with a column-not-found error.

*Analysis:* This is a second column-naming error in the purge function (the first was `rejection_feedback` in Round 19 of Persona 2). The purge intent is correct: stale auto-detected sender patterns should be cleaned up. But the implementation references columns that do not exist. The table definition would need `last_seen_at TIMESTAMPTZ` and `source VARCHAR(50) DEFAULT 'manual'` columns added, and WF-EM-01 would need to update `last_seen_at` whenever a sender pattern is matched. Alternatively, the purge could use `updated_at < 180 days` as a proxy for staleness if the pattern's `updated_at` is refreshed on match.

*Score:* 7/10

---

**Round 44: The breach procedure specifies ICO reporting within 72 hours but does not address the GDPR household exemption implications for reporting**

*Concern:* Section 17.6b Step 5 says: "If the breach involves third-party personal data... report within 72 hours." But Section 17.1 asserts legitimate interest as the legal basis. If the household exemption (Article 2(2)(c)) applies -- which the v1 and v2 evaluations flagged as unevaluated and the v3 PRD still has not evaluated -- then GDPR does not apply, and there is no obligation to report to the ICO. The breach procedure instructs reporting to the ICO without first determining whether the obligation exists. This could lead to unnecessary regulatory engagement.

*Analysis:* The conservative approach (report if in doubt) is defensible. A breach report to the ICO does not create negative consequences if the household exemption turns out to apply -- the ICO would simply note that GDPR does not apply. The candidate is not penalized for over-reporting. The v3 PRD continues to not evaluate the household exemption, which means all compliance measures are conservatively applied. This is a consistent approach even if potentially unnecessary.

*Score:* 7/10

---

**Round 45: The manual full purge procedure (Section 17.4) anonymizes recruiter contacts by setting email to `redacted@redacted.com` but this breaks the recruiter deduplication logic**

*Concern:* The deduplication function (Section 10.3) uses `getDomain(newRecruiter.email) === getDomain(existing.email)` for domain matching. After anonymization, all anonymized recruiters have domain `redacted.com`. If the system is restarted after anonymization (for a new job search), new recruiter contacts would match against anonymized records by domain, potentially triggering false duplicate detections or preventing correct deduplication.

*Analysis:* The manual full purge is intended for system decommissioning, not for reuse. The procedure title is "when job search concludes." If the system is restarted for a new job search, a fresh database migration would be appropriate. However, the PRD does not specify whether to truncate all tables for a new search or to keep historical data. The anonymization approach creates a partially-consistent state that is neither clean (for reuse) nor complete (for archival). A cleaner approach for decommissioning would be to export anonymized data for archival, then truncate all tables, providing a clean state for potential reuse.

*Score:* 7/10

---

**Round 46: The system processes CC'd emails containing information about other candidates, but the v3 GDPR purge does not prioritize purging third-party personal data**

*Concern:* The v2 evaluation (Round 45) identified that CC'd emails may contain information about other candidates. The v3 purge fixes ensure email bodies are purged after 7 days. But the extracted data from these emails may include names of other interviewers, panel members, or internal contacts that constitute third-party personal data. The `panel_members JSONB` field (Section 13.3) stores names and titles of people who are not the candidate, the recruiter, or the primary contact. This data persists for the duration of the job search.

*Analysis:* The panel member data (interviewer names, titles) is minimally personal and directly relevant to the candidate's interview preparation. Retaining it serves the legitimate purpose of the system. Under GDPR, processing someone's work name and job title in the context of their professional role is generally considered low-risk. The data is not sensitive personal data (no health, ethnicity, political opinions). The existing purge schedule (email bodies at 7 days, full cleanup at search conclusion) is proportionate for this type of data.

*Score:* 8/10

---

**Round 47: The `email_processing_log` table stores processing details as JSONB but the schema does not define what constitutes "sensitive data" in the JSONB details field**

*Concern:* Section 17.7 states "Email body text not included in n8n execution logs. Sensitive fields masked in error logs." But the `email_processing_log.details JSONB` field (Section 13.9) has no constraints on what can be stored. A developer implementing WF-EM-02 might store the Claude prompt and response in the details field for debugging purposes, which would include the email body text. The PRD's security control depends on developer discipline, not system enforcement.

*Analysis:* This is a common tension in logging: too little detail makes debugging impossible; too much detail creates data exposure. The JSONB field is appropriate for structured logging. The security control ("sensitive data masking enabled") is a policy, not a technical enforcement. For a single-developer project, the developer is both the policy maker and the implementer, so compliance is inherent. For a team project, this would be a gap. In this context, it is acceptable.

*Score:* 8/10

---

**Round 48: The Resend notification emails are sent to the same Gmail address that the system monitors, creating a theoretical feedback loop risk beyond sender pattern exclusion**

*Concern:* Notifications are sent from `selvi-system@apiloom.io` to `chellamma.uk@gmail.com`. The system monitors `chellamma.uk@gmail.com` for new emails. The v2 fix excludes `selvi-system@apiloom.io` from processing via three layers of defense. But what if the notification bounces? Resend sends bounce notifications to the sender, not the recipient. But what if the candidate replies to a notification? The reply goes to... nowhere, because `replyTo: null` in the Resend config. Actually, the reply goes to `selvi-system@apiloom.io` (the From address), which is not monitored by the system. The feedback loop risk is well-contained.

*Analysis:* The three-layer defense (sender pattern, code check, Phase 0 task) prevents processing of system notifications. Replies to notifications go to an unmonitored address. Bounce notifications go to Resend's infrastructure. The feedback loop risk is effectively zero after the v2 and v3 fixes. This is a resolved concern.

*Score:* 9/10

---

**Round 49: The data retention schedule (Section 17.3) specifies "Duration of job search" for most data categories but "job search" is not formally defined as starting or ending**

*Concern:* The retention schedule uses "Duration of job search" for email metadata, extracted data, and classification results. But the system has no concept of "job search start" or "job search end." The `system_config` table has `email_polling_enabled` which could be used as a proxy (polling enabled = search active). But there is no automated process that detects when the job search ends (e.g., candidate accepts an offer, stops applying for 30 days, or explicitly declares the search over). Without a defined end, the "Duration of job search" retention period is effectively "indefinite."

*Analysis:* This is an inherent ambiguity in any personal data system. The job search does not have a clean end date. The candidate might accept an offer but continue monitoring the market. She might pause for 3 months and restart. The manual full purge procedure (Section 17.4) is triggered by the candidate's decision to conclude the search. This is the appropriate mechanism: the human decides when the search is over, not the system. The retention schedule is accurate as documented -- it means "until the candidate triggers the manual purge."

*Score:* 8/10

---

**Round 50: The v3 PRD has comprehensively addressed all previously identified critical issues; the remaining gaps are refinements, not architectural flaws**

*Concern:* Across three evaluation rounds (150 individual assessments), the PRD has evolved from a document with functional gaps in critical paths (v1: broken purge, no transaction safety, over-broad escalation, missing procedures) to one where the remaining issues are: naming inconsistencies in documentation, edge cases in configuration, UX refinements, and deployment checklist completeness. No remaining issue represents a risk of data loss, missed critical emails, or system failure under normal operating conditions.

*Analysis:* The v3 PRD's remaining weaknesses fall into four categories: (1) documentation inconsistencies (label names in Section 9.4b, column names in purge SQL, dual approaches in Section 6.7), (2) configuration gaps (signature placeholder, Phase 0 task for phone number, candidate profile externalization), (3) UX refinements (D-tier draft suppression, scheduling link extraction, daily summary pipeline health), and (4) minor architectural observations (circuit breaker persistence, sub-category validation). None of these prevent correct operation of the core pipeline. The system's core guarantee -- "no missed interview invitations" -- is robustly supported by the classification pipeline, safety escalation, quiet-hours intelligence, notification deduplication, and graceful degradation.

*Score:* 8/10

---

#### Persona 5 Summary (v3): Privacy & Compliance

| Round | Concern | Score |
|-------|---------|-------|
| 41 | Breach procedure does not assess Claude API key risk profile | 8/10 |
| 42 | Purge removes preparation_instructions before interview date | 7/10 |
| 43 | Purge references non-existent columns in sender_patterns table | 7/10 |
| 44 | ICO reporting without evaluating household exemption | 7/10 |
| 45 | Manual purge anonymization breaks deduplication logic | 7/10 |
| 46 | Third-party data in panel_members is low-risk, proportionate | 8/10 |
| 47 | Processing log JSONB field has no sensitive data constraints | 8/10 |
| 48 | Notification feedback loop risk comprehensively resolved | 9/10 |
| 49 | "Duration of job search" retention period is inherently open-ended | 8/10 |
| 50 | Remaining gaps are refinements, not architectural flaws | 8/10 |
| **Average** | | **7.7/10** |

---

### Overall v3 Evaluation Summary

#### Persona Averages (v3)

| Persona | v1 Score | v2 Score | v3 Score | v2->v3 Delta | Verdict |
|---------|----------|----------|----------|-------------|---------|
| 1. The Candidate (Selvi) | 5.6 | 5.5 | 7.2 | +1.7 | Critical risks resolved; remaining issues are edge cases |
| 2. Technical Architect / n8n Expert | 5.6 | 5.9 | 7.4 | +1.5 | Architecture is robust; remaining issues are implementation details |
| 3. Email/Communication Expert | 5.2 | 5.8 | 7.1 | +1.3 | Communication quality improved; remaining issues are UX refinements |
| 4. AI/LLM Specialist | 5.7 | 6.4 | 7.4 | +1.0 | Prompt engineering solid; remaining issues are calibration depth |
| 5. Privacy & Compliance | 5.8 | 5.4 | 7.7 | +2.3 | GDPR purge fixed; breach procedure added; remaining issues are minor |
| **Overall Average** | **5.58** | **5.80** | **7.36** | **+1.56** | |

#### v3 Assessment

The v3 PRD represents a substantial improvement over v2. The overall score increased by 1.56 points (27% relative improvement). Every persona scores above 7.0 for the first time. The Privacy & Compliance persona saw the largest improvement (+2.3) because the v2 evaluation's critical finding (broken GDPR purge) is now comprehensively resolved.

**What changed:** The 20 fixes applied in v3 addressed both the structural issues (purge lifecycle, transaction safety, correction mechanism) and the UX issues (quiet hours, label precedence, notification format). The fixes were implemented with appropriate depth -- not just patches but complete solutions with edge case handling.

**What remains:** The v3 evaluation found no issues that would prevent production deployment. The remaining concerns fall into:

1. **Documentation inconsistencies (3 instances):** Label names in Section 9.4b do not match Section 9.1. Purge SQL references non-existent columns (`rejection_feedback`, `last_seen_at`, `source`). Section 6.7 describes both old and new approaches.

2. **Deployment checklist gaps (2 instances):** Phase 0 missing task for candidate signature configuration. Signature placeholder still in system_config default value.

3. **UX refinements (5 instances):** D-tier drafts create clutter. Scheduling links not surfaced in notifications. Daily summary missing pipeline health and unmatched email counts. AI phrase blocklist slightly over-aggressive. No extraction calibration set.

4. **Minor architectural observations (3 instances):** Circuit breaker state does not persist across n8n executions. Sub-category not validated against classification. Claude response structural variation handling not specified.

#### Production Readiness Assessment

The v3 PRD is **production-ready with minor documentation corrections.** The three column-name errors in the purge SQL and the label naming inconsistency in Section 9.4b should be corrected before implementation to avoid SQL errors. These are 10-minute fixes. No architectural changes are needed.

---

### v3 Recommended Fixes (Prioritized)

#### Must Fix Before Implementation (Documentation Corrections)

| # | Issue | Round | Fix |
|---|-------|-------|-----|
| 1 | **Purge SQL references `rejection_feedback` -- column does not exist** | P2-R19 | Change to `rejection_reason` in Section 13.12 |
| 2 | **Purge SQL references `last_seen_at` and `source` columns in email_sender_patterns -- do not exist** | P5-R43 | Add columns to table definition or change purge to use `updated_at` |
| 3 | **Label precedence section (9.4b) uses different label names than rest of PRD** | P1-R3 | Align names to `Job/Offer`, `Job/Interview`, etc. |
| 4 | **Resend API call (Section 12.5) still sends `text` only despite v3 HTML notification fix** | P3-R24 | Add `"html"` field to Resend request body |
| 5 | **GDPR purge includes phantom statuses `drafted` and `notified` not in CHECK constraint** | P2-R15 | Change to `draft_created` and remove `notified` |

#### Should Fix (Deployment and UX)

| # | Issue | Round | Fix |
|---|-------|-------|-----|
| 1 | **Add Phase 0 task for candidate signature configuration** | P3-R29 | Add task 0.5c to Section 18.2 |
| 2 | **Exclude preparation_instructions from purge until after interview_date** | P5-R42 | Add date-aware purge exemption |
| 3 | **Add scheduling_link to extraction schema and notification template** | P3-R30 | New field in email_extracted_data |
| 4 | **Add unmatched emails section to daily summary template** | P3-R26 | Query module4_updated = false |
| 5 | **Suppress D-tier recruiter draft creation** | P3-R25 | Filter in WF-EM-05 query |

#### Nice-to-Have (v1.x Enhancements)

| # | Issue | Round | Fix |
|---|-------|-------|-----|
| 1 | **Add extraction calibration set (10 test cases)** | P4-R35 | New table or extension of existing calibration |
| 2 | **Externalize candidate profile to system_config or candidate_profile table** | P4-R38 | Reduce prompt/scoring function maintenance |
| 3 | **Add sub-category validation against parent classification** | P4-R39 | Validation step in WF-EM-02 |
| 4 | **Persist circuit breaker state in database** | P2-R14 | system_config entries for API health tracking |
| 5 | **Add pipeline health metrics to daily summary** | P1-R6 | Stuck email count, backlog size |

---

*End of 50-Round Critical Roleplay Evaluation (v3 - FINAL)*
