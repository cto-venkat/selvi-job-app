# Module 2: AI-Powered CV Tailoring System -- Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-29
**Author:** Selvi Job App Engineering
**Status:** Draft
**System:** Selvi Job App
**Module:** 02 -- CV Tailoring

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Master Profile Data Structure](#6-master-profile-data-structure)
7. [Job Description Analysis Engine](#7-job-description-analysis-engine)
8. [CV Tailoring Engine](#8-cv-tailoring-engine)
9. [Cover Letter Generation](#9-cover-letter-generation)
9b. [Supporting Statement Generation](#9b-supporting-statement-generation)
10. [Document Generation Pipeline](#10-document-generation-pipeline)
11. [Template Design](#11-template-design)
12. [Quality Assurance Pipeline](#12-quality-assurance-pipeline)
13. [Database Schema](#13-database-schema)
14. [n8n Workflow Specifications](#14-n8n-workflow-specifications)
15. [Integration with Module 1](#15-integration-with-module-1)
16. [Error Handling & Monitoring](#16-error-handling--monitoring)
17. [Privacy & Compliance](#17-privacy--compliance)
18. [Rollout Plan](#18-rollout-plan)
19. [Review & Approval Interface](#19-review--approval-interface)

---

## 1. Executive Summary

Module 2 is the CV tailoring engine of the Selvi Job App. It takes high-scoring jobs from Module 1 (tier A and B) and automatically generates tailored application packages: a CV and cover letter, customised to each job description, in both PDF and DOCX formats.

The candidate already achieves a 90% callback rate on roles she manually tailors for. The problem is not CV quality -- it is throughput. Manually tailoring a CV and cover letter for each role takes 45-90 minutes. With Module 1 surfacing 20-45 A/B-tier jobs per week, manual tailoring becomes the binding constraint on application volume. At current capacity, the candidate can tailor 3-5 applications per day at most, meaning 15-25 high-match roles go unapplied each week.

This module solves the throughput problem by automating the tailoring process while maintaining the quality standard that produces the 90% callback rate. The system uses a four-stage AI pipeline: (1) analyse the job description to extract requirements, keywords, and hidden signals, (2) map the candidate's master profile against those requirements, identifying strong matches, partial matches, and gaps, (3) generate a tailored CV (corporate or academic variant) with experience reordered, keywords integrated, and achievements highlighted, (4) validate the output against the original JD and master profile to catch hallucination, formatting errors, and keyword gaps.

The candidate profile straddles two distinct markets -- corporate L&D (Manager to Head level, GBP 70-80k) and UK university lecturer/senior lecturer positions -- each with fundamentally different CV conventions. Corporate CVs are 2 pages, achievement-focused, ATS-optimised with metrics and commercial language. Academic CVs are 3-5 pages, structured around qualifications, teaching experience, publications, and research. The system maintains a single master profile and generates both variants from the same source material.

The system runs entirely within n8n workflows on the existing Hetzner CAX31 infrastructure. Claude API provides the AI backbone: Haiku for routine JD analysis, Sonnet for CV generation and quality validation. Gotenberg (Docker sidecar) handles HTML-to-PDF conversion. docxtemplater handles DOCX generation from Word templates. Generated documents are stored on disk with metadata in Postgres, linked to Module 1's jobs table. Email notifications via Resend alert the candidate when a tailored package is ready.

The candidate reviews all generated packages through a lightweight web-based review interface (Section 19) that supports approve/reject/edit actions, 1-5 ratings with notes, and application outcome tracking. Notifications are delivered as a daily digest email rather than per-job emails, reducing cognitive load when the system surfaces 20-45 roles per week. For academic and public sector applications, the system generates structured supporting statements (Section 9b) that address each person specification criterion with mapped evidence -- eliminating the most time-consuming part of university applications.

Before generation begins for A-tier roles, the candidate can inject personal context (a company connection, a conference attended, a specific reason for interest) via a webhook endpoint, which is incorporated into the cover letter for a more authentic touch.

Total incremental cost is estimated at GBP 15-30/month in Claude API usage (depending on volume) plus negligible infrastructure cost for the Gotenberg container.

---

## 2. Problem Statement

### 2.1 The Throughput Bottleneck

Module 1 solves the discovery problem. It surfaces every relevant role within hours of posting. But discovery without application is worthless. The candidate now faces a new bottleneck: she has more relevant jobs than she can apply to.

The numbers tell the story:

| Metric | Value |
|--------|-------|
| A/B-tier jobs discovered per week (Module 1) | 20-45 |
| Time to manually tailor a CV per role | 45-90 minutes |
| Time to write a tailored cover letter per role | 20-40 minutes |
| Total tailoring time per application | 65-130 minutes |
| Maximum daily tailoring capacity (manual) | 3-5 applications |
| Weekly tailoring capacity (manual, assuming 4 hours/day) | 15-25 applications |
| Applications left on the table per week | 5-25 |

Each untailored application represents a role where the candidate would likely get a callback (90% historical rate on tailored applications) but cannot apply because of time constraints. At the target salary range (GBP 70-80k), even one missed opportunity has material financial impact.

### 2.2 Why Generic CVs Do Not Work

A "one-size-fits-all" CV performs poorly in competitive markets for three reasons:

**ATS filtering.** Modern Applicant Tracking Systems score CVs against job descriptions using keyword matching, semantic NLP, and positional weighting. A generic CV that does not mirror the specific language of the job description scores lower than a tailored one. With 200-400 applicants per role in the UK professional market, a lower ATS score means functional invisibility regardless of actual qualifications.

**The 6-second scan.** After ATS filtering, a recruiter spends approximately 6 seconds on the initial scan. A generic CV forces the recruiter to do the mental work of mapping the candidate's experience to the role's requirements. A tailored CV does that work for the recruiter -- relevant experience is foregrounded, JD language is mirrored, and the professional summary speaks directly to the role.

**The corporate-academic split.** The candidate targets two markets with fundamentally different conventions. A corporate L&D CV that lists publications looks academic and unfocused. An academic CV with ROI metrics and commercial language looks like someone who does not understand the university sector. A single generic CV cannot serve both markets.

### 2.3 Why Manual Tailoring Cannot Scale

Manual tailoring works but has hard limits:

- **Cognitive fatigue.** Tailoring the 5th CV of the day is lower quality than tailoring the 1st. The candidate makes worse choices about what to emphasise, what to cut, and how to phrase achievements.
- **Inconsistent quality.** Some tailoring sessions are thorough; others are rushed. There is no quality floor.
- **Opportunity cost.** Time spent tailoring is time not spent on interview preparation, networking, or upskilling.
- **Timing pressure.** The most competitive roles fill within 48-72 hours. If Module 1 surfaces a role on Monday morning and the candidate cannot tailor until Wednesday, the window may have closed.

### 2.4 What Automation Must Preserve

The candidate's 90% callback rate is not accidental. Her manually tailored CVs work because they:

1. Mirror the job description's language without sounding robotic
2. Foreground the most relevant experience for each specific role
3. Include quantified achievements that demonstrate impact
4. Maintain an authentic professional voice that matches who she is in interviews
5. Follow UK CV conventions (2-page length, no photo, no DOB, UK spelling)
6. Present the PhD and MBA as assets, not academic overkill
7. Handle the CIPD equivalency question gracefully
8. Frame Indian university experience in terms UK employers understand

The automated system must preserve all eight of these characteristics. If automation reduces callback rate below 70%, it is worse than the manual bottleneck.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Generate tailored CV + cover letter for every A/B-tier job | 95%+ coverage | Count of generated packages / count of A/B-tier jobs |
| Maintain callback rate | 80%+ (vs 90% manual baseline) | Track callbacks per automated application over 30-day rolling window |
| Reduce tailoring time per application | From 65-130 min to < 10 min review time | Self-reported time for candidate review and approval |
| Generate documents within 5 minutes of trigger | 95th percentile < 5 minutes | Measure time from trigger to notification email |
| Zero hallucinated content | 0% fabricated claims in published CVs | QA pipeline + manual audit of first 50 outputs |

### 3.2 Secondary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| ATS compatibility score | 90%+ on every generated CV | Internal scoring pipeline |
| Keyword coverage against JD | 75-85% of JD keywords present | Automated keyword comparison |
| Document generation reliability | 99%+ success rate | Failed generation count / total attempts |
| Claude API cost per application | < GBP 0.15 per CV+cover letter package | Token tracking per generation |
| Candidate satisfaction with output quality | 4/5+ average rating | Weekly feedback form |

### 3.3 Success Metrics (Weekly Dashboard)

- **Total application packages generated** (target: 20-45/week matching A/B-tier volume)
- **Packages approved without edits** (target: 60%+ after tuning period)
- **Packages approved with minor edits** (target: 30%)
- **Packages rejected/rebuilt manually** (target: < 10%)
- **Average generation time** (target: < 3 minutes)
- **Average review time by candidate** (target: < 10 minutes)
- **Callback rate on automated applications** (target: 80%+)
- **Claude API cost** (target: < GBP 30/month total)
- **QA pass rate** (target: 95%+ on first generation)
- **Corporate vs academic split** (track volume by type)

### 3.4 Anti-Goals

These are explicitly out of scope:

- **Automated submission.** Module 2 generates documents. It does not submit applications. The candidate reviews and submits manually. Automated submission introduces compliance risk and removes the candidate's agency.
- **Interview preparation.** Module 2 produces CVs and cover letters only. Interview prep is a separate concern.
- **LinkedIn optimisation.** Out of scope for this module.
- **Portfolio or presentation materials.** CV and cover letter only.
- **Multi-candidate support.** This system is built for one candidate. Multi-tenancy is not a design consideration.

---

## 4. User Stories

### 4.1 Core Tailoring Stories

**US-201: Automatic Tailoring Trigger**
As Selvi, I want a tailored CV and cover letter to be automatically generated whenever Module 1 scores a job as A-tier or B-tier, so that I have application-ready materials without lifting a finger.

**US-202: Corporate CV Generation**
As Selvi, I want corporate L&D roles to receive a 2-page, ATS-optimised CV that mirrors the job description's language, foregrounds my most relevant experience, and quantifies my achievements with metrics, following UK CV conventions.

**US-203: Academic CV Generation**
As Selvi, I want university lecturer/senior lecturer roles to receive a 3-5 page academic CV that leads with my PhD and publications, details my teaching experience with module names and student numbers, and follows UK academic CV conventions.

**US-204: Tailored Cover Letter**
As Selvi, I want each application package to include a cover letter that addresses the specific requirements of the role, demonstrates how I meet essential and desirable criteria, and follows UK business letter conventions (250-400 words for corporate, up to 2 pages for academic).

**US-205: Dual Format Output**
As Selvi, I want each CV and cover letter generated in both PDF and DOCX formats, because some ATS portals require DOCX while direct email applications work better as PDF.

**US-206: Ready Notification**
As Selvi, I want to receive an email notification when a tailored application package is ready, including the job title, company, a link to review the documents, and a brief summary of how my profile matches the role.

### 4.1b Review & Approval Stories

**US-221: Daily Digest Notification**
As Selvi, I want to receive a single daily digest email each morning summarising all packages generated in the previous 24 hours, sorted by match score, so that I am not overwhelmed by individual notification emails for 20-45 roles per week.

**US-222: Web-Based Review Interface**
As Selvi, I want a simple web interface where I can view all generated packages, approve or reject each one, provide a 1-5 rating with notes, download DOCX/PDF files, and mark packages as "applied" with a date, so that I have a single place to manage my application pipeline without needing database access.

**US-223: Application Outcome Tracking**
As Selvi, I want to record outcomes for each application (applied, callback received, interview, offer, rejection) through the review interface, so that the system can measure callback rates and I can track my application lifecycle.

**US-224: Personal Context Injection**
As Selvi, I want to add personal notes to a pending job before CV generation starts (e.g., "I met the hiring manager at the CIPD conference" or "I used their product"), so that the cover letter can include a genuine personal touch for my highest-priority roles.

**US-225: Supporting Statement Generation**
As Selvi, I want the system to generate a structured supporting statement for academic and public sector applications, addressing each criterion in the person specification with specific evidence from my profile, because writing supporting statements manually takes 2-3 hours per application.

**US-226: Person Specification Handling**
As Selvi, I want the system to detect and separately parse person specification criteria (essential and desirable) from job descriptions, so that my tailored CV and supporting statement address the actual assessment criteria used by shortlisting panels.

### 4.2 Quality and Review Stories

**US-207: Gap Report**
As Selvi, I want each application package to include a gap analysis showing which job requirements I meet fully, which I meet partially through transferable experience, and which represent genuine gaps, so I can decide whether to apply and prepare for interview questions about gaps.

**US-208: Keyword Coverage Report**
As Selvi, I want to see which keywords from the job description were incorporated into my tailored CV and which were omitted (with reasons), so I can verify the tailoring is thorough.

**US-209: No Hallucination Guarantee**
As Selvi, I want every factual claim in the generated CV to be traceable to my master profile, with no invented experience, inflated metrics, or fabricated achievements, because being caught in a falsehood during an interview would be career-damaging.

**US-210: Review and Edit Before Use**
As Selvi, I want to review and optionally edit every generated CV and cover letter before using it, because I may want to adjust tone, add a personal connection to the company, or handle a specific requirement differently than the AI suggests.

**US-211: Feedback Loop**
As Selvi, I want to rate each generated package (1-5) and provide notes on what worked and what did not, so the system can improve over time.

### 4.3 Master Profile Stories

**US-212: Master Profile Updates**
As Selvi, I want to update my master profile (add new experience, skills, publications, or certifications) and have all future tailored CVs reflect those updates automatically.

**US-213: Multiple Summary Variants**
As Selvi, I want my master profile to contain pre-written professional summary variants for different role types (corporate L&D, academic, hybrid), which the AI uses as a starting point rather than generating from scratch.

**US-214: Achievement Bank**
As Selvi, I want my master profile to store every significant achievement with tags, metrics, and context, so the AI can select the most relevant ones for each application rather than always using the same highlights.

### 4.4 Edge Case Stories

**US-215: Borderline Corporate/Academic Role**
As Selvi, I want the system to correctly identify roles that straddle corporate and academic (e.g., "Head of Executive Education" at a university, or "Learning Manager" at a university press) and generate an appropriate hybrid CV format.

**US-216: CIPD Requirement Handling**
As Selvi, I want the system to handle roles that list "CIPD Level 5+" or "CIPD Level 7" as essential criteria by framing my PhD and MBA as equivalent qualifications and noting my eligibility for the CIPD experience assessment route, rather than ignoring the requirement or fabricating CIPD membership.

**US-217: Roles with Limited Description**
As Selvi, I want the system to handle job listings with minimal description text (e.g., just a title, company, and salary) by generating a reasonable generic-tailored CV based on role type and industry, flagging it as "low-confidence tailoring."

**US-218: Reprocessing After Profile Update**
As Selvi, I want to be able to trigger regeneration of CVs for recently discovered jobs after I update my master profile, so that active opportunities benefit from profile improvements.

**US-219: International Experience Framing**
As Selvi, I want my Indian university experience to be presented in terms UK employers understand -- emphasising transferable skills, cross-cultural competence, and institutional context -- rather than assuming familiarity with Indian educational institutions.

**US-220: Salary Negotiation Context**
As Selvi, I want the cover letter to avoid stating salary expectations unless I explicitly configure it, because premature salary disclosure weakens negotiating position.

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
                                    +------------------+
                                    |   Selvi (User)   |
                                    +--------+---------+
                                             |
                              +--------------+--------------+
                              |                             |
                     +--------v--------+          +--------v--------+
                     | Package Ready   |          | Review UI       |
                     | Email (Resend)  |          | (Email links)   |
                     +--------+--------+          +--------+--------+
                              |                             |
                     +--------v-----------------------------v--------+
                     |           Document Store                      |
                     |  /data/generated-cvs/ (filesystem)            |
                     |  + cv_packages table (Postgres metadata)      |
                     +---+-----+-----+-----+-----+------------------+
                         ^     ^     ^     ^     ^
                         |     |     |     |     |
              +----------+--+  |  +--+----++  +--+----------+
              | PDF Gen     |  |  | DOCX   |  | Notification|
              | (Gotenberg) |  |  | Gen    |  | Dispatcher  |
              +----------+--+  |  +--+----++  +--+----------+
                         ^     |     ^              ^
                         |     |     |              |
                     +---+-----+-----+----+         |
                     | Document Renderer  |         |
                     | (HTML Templates +  |         |
                     |  docx templates)   |         |
                     +--------+-----------+         |
                              ^                     |
                     +--------+-----------+         |
                     | Quality Assurance  |         |
                     | Pipeline           +---------+
                     | (Validation LLM)   |
                     +--------+-----------+
                              ^
                     +--------+-----------+
                     | CV Tailoring       |
                     | Engine             |
                     | (Claude Sonnet)    |
                     +--------+-----------+
                              ^
                     +--------+-----------+
                     | Candidate-JD       |
                     | Mapper             |
                     | (Claude Haiku)     |
                     +--------+-----------+
                              ^
                     +--------+-----------+
                     | JD Analysis        |
                     | Engine             |
                     | (Claude Haiku)     |
                     +--------+-----------+
                              ^
                     +--------+-----------+
                     | Master Profile     |
                     | (Postgres JSONB)   |
                     +--------+-----------+
                              ^
              +--------------+--------------+
              |                             |
     +--------+--------+          +--------+--------+
     | Module 1 Trigger |          | Manual Trigger  |
     | (A/B-tier scored)|          | (Webhook)       |
     +-----------------+          +-----------------+
```

### 5.2 Data Flow

```
Module 1 scores job as A or B tier
    |
    v
Trigger: New row in job_scores with tier IN ('A', 'B')
    |
    v
Stage 1: JD Analysis (Claude Haiku)
    - Input: job.description + job.title + job.company
    - Output: Structured JSON (requirements, keywords, skills, signals)
    - Stored in: jd_analyses table
    |
    v
Stage 2: Candidate-JD Mapping (Claude Haiku)
    - Input: JD analysis + master_profile
    - Output: Requirement-to-experience mapping, gap analysis
    - Stored in: cv_packages.mapping_data
    |
    v
Stage 3: CV Content Generation (Claude Sonnet)
    - Input: Mapping + master_profile + JD analysis + format rules
    - Output: Tailored CV content (JSON sections)
    - Stored in: cv_packages.cv_content
    |
    v
Stage 3b: Cover Letter Generation (Claude Sonnet)
    - Input: Mapping + master_profile + JD analysis + letter rules
    - Output: Tailored cover letter text
    - Stored in: cv_packages.cover_letter_content
    |
    v
Stage 4: Quality Validation (Claude Sonnet)
    - Input: Generated CV + cover letter + JD + master_profile
    - Output: QA report (hallucination check, keyword score, readability)
    - If FAIL: regenerate Stage 3 with feedback (max 2 retries)
    - Stored in: cv_packages.qa_report
    |
    v
Stage 5: Document Rendering
    - HTML template + CV content -> Gotenberg -> PDF
    - DOCX template + CV content -> docxtemplater -> DOCX
    - Cover letter: same pipeline
    - Files stored on disk: /data/generated-cvs/{job_id}/
    |
    v
Stage 6: Notification
    - Email via Resend with:
      - Job title, company, tier
      - Match summary (strong/partial/gap counts)
      - Links to download PDF/DOCX
      - Gap report highlights
```

### 5.3 Workflow Architecture

The module is composed of 5 n8n workflows that coordinate through Postgres.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| WF8: CV Tailoring Orchestrator | Postgres trigger (new A/B-tier score) + Cron every 15 min | Main pipeline: JD analysis -> mapping -> generation -> QA -> render -> notify |
| WF9: Document Renderer | Called by WF8 as sub-workflow | HTML/DOCX template rendering + Gotenberg PDF conversion |
| WF10: Master Profile Manager | Webhook (manual) | CRUD operations on the master profile |
| WF11: Regeneration Handler | Webhook (manual) | Re-generate packages for specific jobs (after profile update or QA failure) |
| WF12: CV Package Notifier | Called by WF8 as sub-workflow | Send notification email with document links |

### 5.4 Technology Stack (Module 2 Additions)

| Component | Technology | Notes |
|-----------|------------|-------|
| AI (JD analysis) | Claude Haiku (claude-haiku-4-5) | Fast, cheap, sufficient for extraction |
| AI (CV generation) | Claude Sonnet (claude-sonnet-4-5) | Higher quality for content generation |
| AI (QA validation) | Claude Sonnet (claude-sonnet-4-5) | Thorough validation requires Sonnet |
| PDF generation | Gotenberg 8 (Docker sidecar) | Native ARM64, HTML-to-PDF via Chromium |
| DOCX generation | n8n-nodes-docxtemplater | Template-based Word document generation |
| HTML templating | n8n-nodes-text-templater (Handlebars) | Conditional sections, loops for CV HTML |
| Template storage | Filesystem (Docker volume mount) | /templates/ directory, git-trackable |
| Document storage | Filesystem + Postgres metadata | /data/generated-cvs/ + cv_packages table |
| Email | n8n-nodes-resend | Package-ready notifications |
| Binary data mode | Filesystem | Already configured in Module 1 |

### 5.5 Infrastructure Additions

Add Gotenberg to the existing Dokploy docker-compose:

```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  restart: unless-stopped
  ports:
    - "127.0.0.1:3000:3000"
  command:
    - "gotenberg"
    - "--api-timeout=60s"
    - "--chromium-disable-javascript=true"
  networks:
    - app-network
```

n8n environment variable additions:

```env
# Community packages for Module 2
N8N_COMMUNITY_PACKAGES=n8n-nodes-text-templater,n8n-nodes-docxtemplater,n8n-nodes-resend

# Allow external modules in Code node
NODE_FUNCTION_ALLOW_EXTERNAL=docx,handlebars
```

Volume mount additions:

```yaml
volumes:
  - ./templates:/templates:ro          # CV/cover letter templates
  - ./data/generated-cvs:/data/generated-cvs  # Generated documents
```

---

## 6. Master Profile Data Structure

### 6.1 Design Principles

The master profile is the single source of truth for every tailored CV. Its design follows four principles:

1. **Comprehensive over concise.** Contains everything the candidate has done. A 10-page master profile that generates 2-page tailored CVs is correct. Nothing is omitted; the tailoring engine selects.

2. **Tagged for filterability.** Every experience, skill, and achievement is tagged with domain (corporate/academic/both), sector relevance, and skill categories. Tags enable the mapping engine to quickly identify relevant content for each job.

3. **Achievement-focused with metrics stored separately.** Each bullet point follows the Action + Metric + Outcome pattern. Metrics (percentages, team sizes, budget amounts) are stored as structured data alongside the natural language text. This prevents the AI from rounding up, extrapolating, or fabricating numbers.

4. **Multiple variants pre-written.** Professional summaries, role descriptions, and skill framings exist in multiple variants (corporate, academic, general). The AI refines a pre-written variant rather than generating from scratch, reducing hallucination risk.

### 6.2 Full Schema

The master profile is stored as a JSONB column in Postgres (`master_profiles` table). The complete schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CandidateMasterProfile",
  "type": "object",
  "required": ["meta", "basics", "qualifications", "skills", "work_experience"],
  "properties": {

    "meta": {
      "type": "object",
      "properties": {
        "schema_version": { "type": "string", "const": "1.0" },
        "last_updated": { "type": "string", "format": "date-time" },
        "candidate_id": { "type": "string" },
        "update_history": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "date": { "type": "string", "format": "date-time" },
              "sections_updated": { "type": "array", "items": { "type": "string" } },
              "notes": { "type": "string" }
            }
          }
        }
      }
    },

    "basics": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "title_variants": {
          "type": "object",
          "properties": {
            "corporate_ld": { "type": "string" },
            "academic": { "type": "string" },
            "general": { "type": "string" }
          }
        },
        "email": { "type": "string", "format": "email" },
        "phone": { "type": "string" },
        "location": {
          "type": "object",
          "properties": {
            "city": { "type": "string" },
            "region": { "type": "string" },
            "country": { "type": "string" },
            "postcode_prefix": { "type": "string" }
          }
        },
        "linkedin_url": { "type": "string", "format": "uri" },
        "right_to_work": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["citizen", "settled", "pre_settled", "visa", "other"] },
            "needs_sponsorship": { "type": "boolean" },
            "statement": { "type": "string" }
          }
        },
        "notice_period": { "type": "string" },
        "summary_variants": {
          "type": "object",
          "properties": {
            "corporate_ld": { "type": "string", "maxLength": 500 },
            "academic": { "type": "string", "maxLength": 500 },
            "general": { "type": "string", "maxLength": 500 }
          }
        }
      }
    },

    "target_roles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["corporate", "academic"] },
          "titles": { "type": "array", "items": { "type": "string" } },
          "salary_range": {
            "type": "object",
            "properties": {
              "min": { "type": "integer" },
              "max": { "type": "integer" },
              "currency": { "type": "string", "const": "GBP" }
            }
          },
          "seniority_levels": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "qualifications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string", "enum": ["academic", "professional", "certification"] },
          "level": { "type": "string" },
          "rqf_level": { "type": "integer", "minimum": 1, "maximum": 8 },
          "field": { "type": "string" },
          "institution": { "type": "string" },
          "year": { "type": "integer" },
          "thesis_title": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "display_variants": {
            "type": "object",
            "properties": {
              "corporate": { "type": "string" },
              "academic": { "type": "string" }
            }
          }
        }
      }
    },

    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "category": {
            "type": "string",
            "enum": [
              "core_ld", "leadership", "research", "teaching",
              "technology", "analytics", "stakeholder", "commercial",
              "hr_general", "methodology", "sector_specific"
            ]
          },
          "proficiency": { "type": "string", "enum": ["expert", "advanced", "intermediate", "foundational"] },
          "years": { "type": "integer" },
          "keywords": {
            "type": "array",
            "items": { "type": "string" },
            "description": "All synonyms and variants of this skill for keyword matching"
          },
          "evidence_refs": {
            "type": "array",
            "items": { "type": "string" },
            "description": "References to work_experience highlights that demonstrate this skill"
          },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "work_experience": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "company": { "type": "string" },
          "company_context": {
            "type": "string",
            "description": "Brief description for UK employers unfamiliar with the organisation"
          },
          "position": { "type": "string" },
          "position_variants": {
            "type": "object",
            "properties": {
              "corporate": { "type": "string" },
              "academic": { "type": "string" }
            }
          },
          "start_date": { "type": "string", "pattern": "^\\d{4}-\\d{2}$" },
          "end_date": {
            "type": "string",
            "description": "'present' or YYYY-MM format"
          },
          "location": { "type": "string" },
          "country": { "type": "string" },
          "sector": { "type": "string" },
          "team_size": { "type": "integer" },
          "reporting_to": { "type": "string" },
          "budget_managed": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "highlights": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "text": { "type": "string" },
                "text_variants": {
                  "type": "object",
                  "properties": {
                    "corporate": { "type": "string" },
                    "academic": { "type": "string" }
                  }
                },
                "tags": { "type": "array", "items": { "type": "string" } },
                "skills_demonstrated": { "type": "array", "items": { "type": "string" } },
                "metrics": {
                  "type": "object",
                  "properties": {
                    "type": { "type": "string" },
                    "value": { "type": "number" },
                    "unit": { "type": "string" },
                    "context": { "type": "string" }
                  }
                },
                "suitable_for": {
                  "type": "array",
                  "items": { "type": "string", "enum": ["corporate_ld", "academic", "both"] }
                },
                "priority": {
                  "type": "string",
                  "enum": ["must_include", "prefer_include", "include_if_relevant", "include_if_space"],
                  "description": "How strongly to prefer including this highlight"
                }
              }
            }
          }
        }
      }
    },

    "publications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "authors": { "type": "string" },
          "journal": { "type": "string" },
          "year": { "type": "integer" },
          "volume": { "type": "string" },
          "pages": { "type": "string" },
          "doi": { "type": "string" },
          "type": { "type": "string", "enum": ["journal_article", "book_chapter", "conference_paper", "book", "report", "working_paper"] },
          "peer_reviewed": { "type": "boolean" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "citation_text": {
            "type": "string",
            "description": "Pre-formatted citation in Harvard/APA style"
          }
        }
      }
    },

    "teaching_experience": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "institution": { "type": "string" },
          "modules": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "level": { "type": "string", "enum": ["undergraduate", "postgraduate", "executive", "professional"] },
                "student_count": { "type": "integer" },
                "role": { "type": "string", "enum": ["module_leader", "lecturer", "seminar_leader", "guest_lecturer"] }
              }
            }
          },
          "period": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "phd_supervision": {
      "type": "array",
      "description": "PhD and research student supervision experience -- critical for senior lecturer applications",
      "items": {
        "type": "object",
        "properties": {
          "student_name": { "type": "string" },
          "thesis_title": { "type": "string" },
          "institution": { "type": "string" },
          "role": { "type": "string", "enum": ["principal_supervisor", "co_supervisor", "advisor"] },
          "status": { "type": "string", "enum": ["completed", "in_progress", "withdrawn"] },
          "completion_year": { "type": "integer" },
          "level": { "type": "string", "enum": ["phd", "mphil", "edd", "professional_doctorate"] }
        }
      }
    },

    "administrative_service": {
      "type": "array",
      "description": "University committee work, programme leadership, and administrative roles",
      "items": {
        "type": "object",
        "properties": {
          "role": { "type": "string" },
          "body": { "type": "string", "description": "Committee or programme name" },
          "institution": { "type": "string" },
          "period": { "type": "string" },
          "description": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "pedagogical_qualifications": {
      "type": "object",
      "description": "HEA/Advance HE fellowship and teaching qualifications -- near-mandatory for UK university posts",
      "properties": {
        "hea_fellowship": {
          "type": "object",
          "properties": {
            "held": { "type": "boolean" },
            "level": { "type": "string", "enum": ["associate_fellow", "fellow", "senior_fellow", "principal_fellow", "not_held"] },
            "year_awarded": { "type": "integer" },
            "equivalency_statement": {
              "type": "string",
              "description": "If not held: how to address this gap (e.g., application in progress, equivalent teaching qualification)"
            }
          }
        },
        "pgcert_he": {
          "type": "object",
          "properties": {
            "held": { "type": "boolean" },
            "institution": { "type": "string" },
            "year": { "type": "integer" }
          }
        },
        "other_teaching_qualifications": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "institution": { "type": "string" },
              "year": { "type": "integer" }
            }
          }
        }
      }
    },

    "external_examining": {
      "type": "array",
      "description": "External examiner and reviewer roles",
      "items": {
        "type": "object",
        "properties": {
          "institution": { "type": "string" },
          "programme": { "type": "string" },
          "role": { "type": "string", "enum": ["external_examiner", "phd_examiner", "peer_reviewer", "editorial_board"] },
          "period": { "type": "string" },
          "details": { "type": "string" }
        }
      }
    },

    "conference_presentations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "conference": { "type": "string" },
          "year": { "type": "integer" },
          "type": { "type": "string", "enum": ["keynote", "paper_presentation", "workshop", "panel", "poster"] },
          "location": { "type": "string" }
        }
      }
    },

    "professional_memberships": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "body": { "type": "string" },
          "level": { "type": "string" },
          "since": { "type": "integer" },
          "equivalence_statement": {
            "type": "string",
            "description": "How to position this membership relative to other qualifications"
          }
        }
      }
    },

    "professional_development": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "provider": { "type": "string" },
          "year": { "type": "integer" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "awards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "issuer": { "type": "string" },
          "year": { "type": "integer" },
          "context": { "type": "string" }
        }
      }
    },

    "languages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "language": { "type": "string" },
          "proficiency": { "type": "string", "enum": ["native", "fluent", "professional", "conversational", "basic"] }
        }
      }
    },

    "referees": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "title": { "type": "string" },
          "organisation": { "type": "string" },
          "email": { "type": "string" },
          "phone": { "type": "string" },
          "relationship": { "type": "string" },
          "suitable_for": {
            "type": "array",
            "items": { "type": "string", "enum": ["corporate", "academic", "both"] }
          }
        }
      }
    },

    "keyword_bank": {
      "type": "object",
      "description": "Pre-compiled keyword lists by domain for keyword matching",
      "properties": {
        "ld_corporate": { "type": "array", "items": { "type": "string" } },
        "academic": { "type": "array", "items": { "type": "string" } },
        "hr_general": { "type": "array", "items": { "type": "string" } },
        "technology": { "type": "array", "items": { "type": "string" } },
        "methodology": { "type": "array", "items": { "type": "string" } }
      }
    },

    "cipd_equivalency": {
      "type": "object",
      "description": "Pre-written handling for CIPD requirement in job descriptions",
      "properties": {
        "statement_when_essential": { "type": "string" },
        "statement_when_desirable": { "type": "string" },
        "cv_text": { "type": "string" },
        "cover_letter_paragraph": { "type": "string" }
      }
    }
  }
}
```

### 6.3 Master Profile Storage

The master profile is stored in a dedicated Postgres table (see Section 13) as a JSONB column. This allows:

- Querying into the profile structure with Postgres JSONB operators
- Version history through the `update_history` array and row-level versioning
- Access from any n8n workflow without file I/O
- Backup alongside other database data

The profile is loaded once at the start of each tailoring run and passed through the pipeline stages as context.

### 6.4 Profile Population Strategy

The master profile is populated manually in Phase 1 (Rollout Plan, Section 18). The candidate provides her existing CVs, LinkedIn profile data, and a structured interview to capture achievements with exact metrics. The profile is then encoded in JSON and inserted into Postgres.

Future phases may add:
- A web form for profile updates (low priority given single-user system)
- Automatic extraction from LinkedIn export data
- Feedback-driven profile enrichment (when the candidate adds notes to a generated CV, the system suggests profile updates)

---

## 7. Job Description Analysis Engine

### 7.1 Purpose

Stage 1 of the pipeline. The JD analysis engine takes raw job description text and produces a structured extraction of everything needed for CV tailoring: requirements, keywords, skills, qualifications, seniority signals, culture signals, and red flags.

This stage uses Claude Haiku because the task is extraction, not generation. Haiku is fast and cheap for structured data extraction from text.

### 7.2 Input

```json
{
  "job_id": "uuid",
  "title": "Senior Learning & Development Manager",
  "company": "Deloitte UK",
  "location": "London",
  "description": "Full job description text...",
  "salary_min": 75000,
  "salary_max": 85000,
  "job_type": "corporate",
  "tier": "A",
  "source_url": "https://..."
}
```

### 7.3 Output Schema

```json
{
  "job_id": "uuid",
  "analysis_version": "1.0",
  "analysed_at": "2026-03-29T10:30:00Z",

  "role_classification": {
    "type": "corporate",
    "sub_type": "ld_management",
    "seniority": "senior_manager",
    "department": "Human Resources / Learning & Development",
    "reports_to": "Director of People / CHRO",
    "team_size_indicated": 8,
    "budget_indicated": "GBP 1M+"
  },

  "requirements": {
    "essential": [
      {
        "id": "req_1",
        "text": "Minimum 10 years experience in L&D or talent development",
        "category": "experience",
        "keywords": ["L&D", "talent development"],
        "years_required": 10
      },
      {
        "id": "req_2",
        "text": "CIPD Level 5 or above, or equivalent qualification",
        "category": "qualification",
        "keywords": ["CIPD", "Level 5"],
        "is_cipd_requirement": true,
        "cipd_level_minimum": 5,
        "cipd_requirement_type": "or_equivalent"
      },
      {
        "id": "req_3",
        "text": "Experience designing and delivering leadership development programmes",
        "category": "skill",
        "keywords": ["leadership development", "programme design", "programme delivery"]
      }
    ],
    "desirable": [
      {
        "id": "req_d1",
        "text": "Experience with Workday Learning or similar LMS platforms",
        "category": "technology",
        "keywords": ["Workday Learning", "LMS"]
      }
    ],
    "implicit": [
      {
        "id": "req_i1",
        "text": "Stakeholder management at board level (implied by reporting line to CHRO)",
        "category": "skill",
        "keywords": ["stakeholder management", "board level", "senior stakeholders"],
        "inference_basis": "reporting line to CHRO"
      }
    ]
  },

  "keywords": {
    "hard_skills": ["L&D strategy", "leadership development", "programme design", "learning needs analysis", "blended learning", "digital learning"],
    "soft_skills": ["stakeholder management", "influencing", "strategic thinking", "coaching"],
    "tools_platforms": ["Workday Learning", "LMS"],
    "qualifications": ["CIPD", "degree"],
    "industry_terms": ["professional services", "consulting"],
    "action_verbs": ["design", "deliver", "lead", "influence", "develop", "measure"]
  },

  "keyword_priority": [
    { "keyword": "leadership development", "frequency": 4, "priority": "critical" },
    { "keyword": "L&D strategy", "frequency": 3, "priority": "critical" },
    { "keyword": "stakeholder management", "frequency": 2, "priority": "high" },
    { "keyword": "blended learning", "frequency": 2, "priority": "high" },
    { "keyword": "programme design", "frequency": 2, "priority": "high" },
    { "keyword": "digital learning", "frequency": 1, "priority": "medium" },
    { "keyword": "ROI measurement", "frequency": 1, "priority": "medium" }
  ],

  "culture_signals": {
    "working_pattern": "hybrid",
    "pace": "fast-paced",
    "team_culture": "collaborative",
    "growth_stage": "established",
    "hidden_meanings": [
      {
        "phrase": "fast-paced environment",
        "likely_meaning": "Heavy workload, shifting priorities"
      }
    ]
  },

  "red_flags": [],

  "person_specification": {
    "detected": true,
    "source": "embedded_in_jd",
    "essential_criteria": [
      {
        "id": "ps_e1",
        "criterion": "PhD or equivalent doctoral qualification in relevant field",
        "category": "qualification",
        "assessment_method": "application",
        "keywords": ["PhD", "doctoral"]
      },
      {
        "id": "ps_e2",
        "criterion": "HEA Fellowship or willingness to obtain within probation",
        "category": "teaching_qualification",
        "assessment_method": "application",
        "keywords": ["HEA", "Advance HE", "fellowship"],
        "is_hea_requirement": true
      }
    ],
    "desirable_criteria": [
      {
        "id": "ps_d1",
        "criterion": "Experience of PhD supervision",
        "category": "supervision",
        "assessment_method": "application_and_interview",
        "keywords": ["PhD supervision", "doctoral supervision"]
      }
    ]
  },

  "application_guidance": {
    "cv_type_recommended": "corporate_ld",
    "cv_length": "2 pages",
    "key_sections_to_emphasise": ["professional_summary", "leadership_development_experience", "metrics"],
    "cipd_handling": "Position PhD + MBA as equivalent; mention CIPD experience assessment route",
    "hea_handling": "Address HEA fellowship status; if not held, describe equivalent teaching evidence and willingness to apply",
    "international_experience_framing": "Emphasise cross-cultural L&D design capability",
    "salary_notes": "Within target range, no need to address",
    "requires_supporting_statement": false,
    "submission_format": "ats_portal"
  }
}
```

### 7.4 Claude Haiku Prompt -- JD Analysis

**System prompt:**

```
You are a UK recruitment analyst specialising in Learning & Development and
higher education roles. Your task is to analyse job descriptions and extract
structured data for CV tailoring.

You understand:
- UK job market conventions (CIPD levels, RQF framework, UK salary bands)
- The difference between corporate L&D and academic lecturer requirements
- How to distinguish essential vs desirable requirements
- How to identify implicit requirements from context clues
- UK-specific terminology (organisation, programme, colour)
- Hidden meanings in corporate job description language
- Red flags (ghost jobs, data harvesting, bait-and-switch)

OUTPUT RULES:
- Return ONLY valid JSON matching the provided schema
- Extract keywords VERBATIM from the job description (do not paraphrase)
- Classify requirements as essential, desirable, or implicit
- Flag any CIPD requirements specifically (is_cipd_requirement: true) with cipd_requirement_type:
  - "must_hold": JD states CIPD is required with no alternatives (e.g., "CIPD Level 7 required")
  - "or_equivalent": JD accepts CIPD or equivalent qualifications (e.g., "CIPD Level 5 or equivalent")
  - "desirable": CIPD listed as desirable, not essential
  - This distinction drives different handling in the CV and cover letter: "must_hold" requires stronger equivalency framing than "or_equivalent"
- Flag any HEA/Advance HE fellowship requirements (is_hea_requirement: true)
- Detect and separately parse person specification criteria when present (common in academic and public sector roles)
- Identify whether the application requires a supporting statement (requires_supporting_statement: true)
- Identify the CV type that should be generated (corporate_ld or academic)
- Detect whether the listing is from a recruitment agency vs direct employer (listing_type: "direct_employer" | "recruitment_agency" | "confidential")
```

**User prompt:**

```xml
<job_description>
Title: {{ job.title }}
Company: {{ job.company }}
Location: {{ job.location }}
Salary: {{ job.salary_min }} - {{ job.salary_max }} GBP
Source: {{ job.source_url }}

{{ job.description }}
</job_description>

<task>
Analyse this job description and produce a structured extraction. Follow this
process:

1. Classify the role: corporate L&D, academic, or hybrid
2. Extract ALL requirements, categorised as essential, desirable, or implicit
3. Extract ALL keywords that should appear in a tailored CV
4. Rank keywords by frequency and importance (critical/high/medium/low)
5. Identify culture signals and hidden meanings
6. Flag any red flags
7. Provide application guidance specific to this role

Return your analysis as JSON matching this schema:
{{ jd_analysis_schema }}
</task>
```

### 7.5 Processing Details

- **Model:** claude-haiku-4-5
- **Temperature:** 0.0 (deterministic extraction)
- **Max tokens:** 4096
- **Expected latency:** 1-3 seconds
- **Expected cost:** ~$0.001 per analysis
- **Retry policy:** Retry once on malformed JSON, then fail the job with error logged

### 7.6 Post-Processing

After LLM extraction, the n8n workflow performs:

1. **JSON validation:** Parse the response and validate against the output schema. If invalid, retry with a corrective prompt.
2. **Keyword deduplication:** Remove duplicate keywords across categories.
3. **CIPD flag propagation:** If any requirement has `is_cipd_requirement: true`, set a flag on the overall analysis for downstream handling.
4. **Store in Postgres:** Insert the analysis into the `jd_analyses` table linked to the job_id.
5. **Determine CV type:** If `role_classification.type` is "corporate", route to corporate CV template. If "academic", route to academic template. If ambiguous, default to corporate unless the company is a university.

---

## 8. CV Tailoring Engine

### 8.1 Purpose

Stage 2 (mapping) and Stage 3 (generation) of the pipeline. This is the core intelligence of Module 2. It takes the structured JD analysis and the candidate's master profile and produces a tailored CV -- selecting the right experience, reordering highlights, integrating keywords, and generating section content.

### 8.2 Stage 2: Candidate-JD Mapping

The mapping stage runs on Claude Haiku. It is a comparison task, not a generation task.

**Quality consideration:** The mapping output (suggested evidence bullets) is passed to Sonnet for CV generation. Haiku's evidence selections constrain Sonnet's generation quality -- if Haiku selects weak evidence, Sonnet cannot compensate. This is an intentional cost/quality tradeoff: Haiku mapping costs ~$0.002 vs ~$0.015 for Sonnet mapping. If post-launch feedback shows that evidence selection quality is the bottleneck (i.e., candidate frequently overrides which experiences are highlighted), upgrade the mapping stage to Sonnet and adjust the cost estimates in Section 16.6 accordingly.

**System prompt:**

```
You are a career consultant matching a candidate's experience against job
requirements. Your job is to find the best evidence from the candidate's
profile for each requirement in the job description.

RULES:
- ONLY reference experience that exists in the candidate profile
- NEVER invent or fabricate experience
- If no match exists for a requirement, classify it as a "gap"
- Distinguish between strong matches (direct experience), partial matches
  (transferable experience), and gaps (no relevant experience)
- For partial matches, explain how the experience transfers
- For CIPD requirements, use the candidate's cipd_equivalency statements
```

**User prompt:**

```xml
<jd_analysis>
{{ jd_analysis_json }}
</jd_analysis>

<candidate_profile>
{{ master_profile_json }}
</candidate_profile>

<task>
Map the candidate's experience against each requirement in the JD analysis.

For each requirement (essential, desirable, and implicit):
1. Search the candidate's work_experience, skills, qualifications,
   publications, and teaching_experience for matching evidence
2. Classify the match as: strong_match, partial_match, weak_match, or gap
3. Select the best 1-3 evidence items from the profile
4. For strong/partial matches, draft a CV bullet point that incorporates
   the JD's keywords while staying truthful to the candidate's experience
5. For gaps, note the gap and suggest mitigation (if possible)

Also produce:
- A ranked list of which work_experience highlights to include (most
  relevant first)
- Which professional summary variant to use as the base
- Which skills to list in the skills section
- An overall match percentage

Return as JSON matching this schema:
{{ mapping_schema }}
</task>
```

**Mapping output schema:**

```json
{
  "job_id": "uuid",
  "overall_match_percentage": 85,
  "match_recommendation": "Strong match. Apply with corporate L&D CV.",

  "requirement_mappings": [
    {
      "requirement_id": "req_1",
      "requirement_text": "Minimum 10 years experience in L&D",
      "requirement_type": "essential",
      "match_status": "strong_match",
      "evidence": [
        {
          "source_ref": "work_experience.acme.highlights.acme_h1",
          "source_text": "Designed and delivered a blended learning curriculum...",
          "relevance_score": 0.95
        }
      ],
      "suggested_cv_bullet": "Designed and delivered blended learning programmes...",
      "keywords_incorporated": ["L&D", "learning programme"]
    }
  ],

  "cv_structure": {
    "summary_base": "corporate_ld",
    "experience_order": ["acme", "beta", "gamma"],
    "highlights_per_role": {
      "acme": ["acme_h1", "acme_h3", "acme_h5"],
      "beta": ["beta_h2", "beta_h4"],
      "gamma": ["gamma_h1"]
    },
    "skills_to_include": ["learning_strategy", "programme_design", "stakeholder_mgmt"],
    "qualifications_order": ["phd", "mba"],
    "include_publications": false,
    "include_teaching": false
  },

  "gap_analysis": {
    "full_matches": 8,
    "partial_matches": 3,
    "gaps": 1,
    "gap_details": [
      {
        "requirement_id": "req_d1",
        "requirement_text": "Experience with Workday Learning",
        "severity": "low",
        "is_essential": false,
        "mitigation": "Candidate has experience with Cornerstone OnDemand LMS. Emphasise LMS administration experience generically."
      }
    ]
  }
}
```

**Processing details for Stage 2:**
- **Model:** claude-haiku-4-5
- **Temperature:** 0.1
- **Max tokens:** 4096
- **Expected latency:** 2-4 seconds
- **Expected cost:** ~$0.002 per mapping

### 8.3 Stage 3: CV Content Generation

This is the most critical stage. It runs on Claude Sonnet because generation quality directly determines callback rate.

**System prompt:**

```
You are Dr Sarah Mitchell, a senior CV writer with 20 years of experience
in UK recruitment, specialising in Learning & Development and higher education
roles. You have placed candidates at FTSE 100 companies and Russell Group
universities. You understand ATS systems, UK CV conventions, and how to
present experience for maximum impact.

YOUR WRITING STYLE:
- Professional but warm, never robotic
- Achievement-focused: every bullet starts with a strong action verb
- Specific: use exact numbers, not vague qualifiers
- Varied sentence structure: never start 3 bullets the same way
- UK English throughout: organisation, programme, analyse, centre, colour
- First person implied (no "I")

ABSOLUTE RULES -- VIOLATION OF THESE IS A CRITICAL FAILURE:
1. NEVER invent experience, qualifications, metrics, or achievements
2. ONLY use information present in the candidate profile and mapping data
3. If a requirement cannot be matched, DO NOT fabricate a match -- omit it
4. NEVER alter metrics: if the profile says "40%", the CV says "40%"
5. NEVER change team sizes, budget amounts, or time periods
6. NEVER add qualifications the candidate does not hold
7. If the candidate does not hold CIPD, do NOT claim CIPD membership
8. Every factual claim must be traceable to a specific profile entry
9. The output must be valid JSON matching the provided schema
```

**User prompt for corporate CV:**

```xml
<jd_analysis>
{{ jd_analysis_json }}
</jd_analysis>

<candidate_profile>
{{ master_profile_json }}
</candidate_profile>

<requirement_mapping>
{{ mapping_json }}
</requirement_mapping>

<task>
Generate a tailored corporate L&D CV for this role. Follow these steps:

1. PROFESSIONAL SUMMARY (3-4 sentences, max 60 words)
   - Start from the candidate's corporate_ld summary variant
   - Incorporate the top 3 keywords from the JD (verbatim where possible)
   - Address the role's seniority level and sector
   - Include years of experience and highest qualification

2. CORE SKILLS (6-10 skills)
   - Select from the mapping's skills_to_include list
   - Mirror JD keyword language where the candidate genuinely has the skill
   - Order by relevance to this specific role

3. PROFESSIONAL EXPERIENCE (reverse chronological)
   - Include roles specified in mapping.cv_structure.experience_order
   - For each role, use the highlights specified in mapping.highlights_per_role
   - Each highlight: max 25 words, starts with action verb, includes metric
   - Rewrite highlights to incorporate JD keywords naturally
   - DO NOT add highlights not in the mapping
   - Max 4-5 bullets per role, 2-3 for older roles

4. EDUCATION & QUALIFICATIONS
   - List in order specified by mapping.qualifications_order
   - Include institution, year, field
   - For PhD: include thesis title if relevant to role
   - Handle CIPD requirement per cipd_equivalency guidance

5. PROFESSIONAL DEVELOPMENT (if space permits)
   - Select relevant certifications and courses
   - Only include if they add value for this specific role

Format the output as JSON with these sections:
{{ cv_content_schema }}

LENGTH CONSTRAINT: When rendered, this CV must fit on exactly 2 A4 pages.
Aim for 450-550 words of body text (excluding headings and formatting).
</task>

<format_rules>
- Bullet points use "---" prefix (will be rendered as bullets in template)
- Dates format: "MMM YYYY" (e.g., "Jan 2020 -- Jun 2024")
- No tables, columns, or multi-column layouts
- No headers/footers content (template handles those)
- Section headings in ALLCAPS for ATS compatibility
</format_rules>
```

**User prompt for academic CV:**

```xml
<jd_analysis>
{{ jd_analysis_json }}
</jd_analysis>

<candidate_profile>
{{ master_profile_json }}
</candidate_profile>

<requirement_mapping>
{{ mapping_json }}
</requirement_mapping>

<task>
Generate a tailored academic CV for this university lecturer/senior lecturer
role. Follow these steps:

1. CONTACT DETAILS
   - Name, email, phone, location (city, region)
   - LinkedIn URL

2. QUALIFICATIONS (lead section -- academics expect this first)
   - PhD first, then other degrees in reverse chronological order
   - Include thesis title, institution, year
   - Include relevant professional qualifications

3. CURRENT / MOST RECENT EMPLOYMENT
   - Full details including department, institution, dates
   - Key responsibilities (teaching, research, admin)
   - Specific modules taught with levels and student numbers

4. PREVIOUS EMPLOYMENT
   - All relevant roles, reverse chronological
   - Frame corporate experience in terms academics understand:
     "Designed curriculum" not "Created training programmes"
     "Delivered lectures to cohorts of 120+" not "Ran training sessions"
   - Include any visiting lecturer, guest lecturer, or examiner roles

5. TEACHING EXPERIENCE
   - List all modules with level (UG/PG/Executive), student numbers, role
   - Mention pedagogical approaches used
   - Include any teaching awards or excellent feedback

6. RESEARCH INTERESTS
   - 3-5 bullet points aligned with the department's stated interests
   - Only include genuine research interests from the profile

7. PUBLICATIONS
   - Full citations in Harvard/APA format
   - Peer-reviewed first, then other publications
   - Use citation_text from the profile (do not reformat)

8. CONFERENCE PRESENTATIONS
   - Reverse chronological, include conference name and type

9. PEDAGOGICAL QUALIFICATIONS
   - HEA/Advance HE fellowship status (if held, list level and year)
   - If not held, address per pedagogical_qualifications.hea_fellowship.equivalency_statement
   - PGCert HE or equivalent teaching qualification
   - Handle HEA requirement similar to CIPD handling: truthful, no fabrication

10. PHD SUPERVISION
    - List any PhD, MPhil, or doctoral supervision experience
    - Include student name (if permitted), thesis title, role (principal/co-supervisor), status
    - If no supervision experience, omit section but note readiness in cover letter/supporting statement

11. ADMINISTRATIVE SERVICE & ACADEMIC CITIZENSHIP
    - Committee memberships, programme leadership roles
    - External examining and peer review activity
    - Editorial board memberships
    - Conference organisation

12. PROFESSIONAL MEMBERSHIPS
    - Professional body memberships
    - Include equivalence statements where relevant

13. REFEREES
    - 2-3 academic referees from the profile
    - Include name, title, institution, email

Format as JSON matching:
{{ academic_cv_content_schema }}

LENGTH: Academic CVs have no strict page limit. Include all relevant content.
Typical length: 3-5 pages when rendered.
</task>

<format_rules>
- UK academic conventions throughout
- "Programme" not "Program"
- "Organisational" not "Organizational"
- Dates: "September 2020 -- June 2024" (full month names)
- Publications in consistent citation format
- No personal statement section (cover letter handles this)
</format_rules>
```

### 8.4 CV Content Output Schema

**Corporate CV content:**

```json
{
  "cv_type": "corporate_ld",
  "generated_at": "2026-03-29T10:35:00Z",

  "professional_summary": "Learning and Development leader with 18 years of experience...",

  "core_skills": [
    "Learning Strategy & Programme Design",
    "Leadership Development",
    "Blended & Digital Learning",
    "Stakeholder Engagement at Board Level",
    "L&D Budget Management (GBP 1.2M+)",
    "Training Needs Analysis & ROI Measurement"
  ],

  "experience": [
    {
      "company": "Acme Corp",
      "company_context": null,
      "position": "Head of Learning & Development",
      "dates": "Jan 2020 -- Jun 2024",
      "location": "London",
      "bullets": [
        "Designed and delivered blended learning programmes for 500+ employees, improving completion rates by 40%",
        "Managed annual L&D budget of GBP 1.2M, achieving 15% cost reduction through vendor renegotiation and digital delivery",
        "Led team of 8 L&D professionals across three business units",
        "Implemented new LMS platform, increasing self-directed learning engagement by 60%"
      ],
      "source_refs": ["acme_h1", "acme_h2", "acme_h3", "acme_h4"]
    }
  ],

  "education": [
    {
      "qualification": "PhD in Management",
      "institution": "University of ...",
      "year": 2015,
      "details": "Thesis: [title relevant to role]"
    },
    {
      "qualification": "MBA (Human Resource Management)",
      "institution": "University of ...",
      "year": 2010,
      "details": null
    }
  ],

  "professional_development": [
    "Certified Facilitator, [programme name], 2022"
  ],

  "professional_memberships": [
    "Chartered Member, CIPD (MCIPD)"
  ],

  "cipd_handling": {
    "cipd_required_in_jd": true,
    "cipd_level_required": 5,
    "handling_approach": "equivalency",
    "text_used": "PhD (RQF Level 8) and MBA (RQF Level 7), exceeding CIPD Level 5 academic requirements. Eligible for CIPD Chartered membership via experience assessment route."
  },

  "keyword_coverage": {
    "total_jd_keywords": 15,
    "keywords_included": 12,
    "keywords_omitted": 3,
    "coverage_percentage": 80,
    "included": ["leadership development", "L&D strategy", "blended learning", "programme design"],
    "omitted_with_reason": [
      { "keyword": "Workday Learning", "reason": "Candidate has LMS experience but not with Workday specifically" }
    ]
  },

  "source_traceability": [
    {
      "cv_text": "Designed and delivered blended learning programmes for 500+ employees",
      "profile_source": "work_experience.acme.highlights.acme_h1",
      "original_text": "Designed and delivered a blended learning curriculum for 500+ employees, improving completion rates by 40%"
    }
  ]
}
```

### 8.5 Processing Details for Stage 3

- **Model:** claude-sonnet-4-5
- **Temperature:** 0.15 (low creativity, high fidelity, slight variation for natural phrasing)
- **Max tokens:** 8192 (academic CVs can be longer)
- **Expected latency:** 5-10 seconds
- **Expected cost:** ~$0.02-0.04 per generation
- **Structured output:** Use Claude's structured output mode with JSON schema to enforce format
- **Retry policy:** If JSON is malformed, retry once. If content fails QA (Stage 4), regenerate with QA feedback appended to the prompt (max 2 retries).

### 8.6 Handling Specific Challenges

**CIPD equivalency:** When the JD lists CIPD as essential or desirable, the system uses the pre-written `cipd_equivalency` block from the master profile. The CV includes a note such as "PhD (RQF Level 8) and MBA (RQF Level 7), providing academic qualification equivalent to CIPD Level 7. Eligible for CIPD Chartered membership via experience assessment." This is truthful and addresses the requirement without fabrication.

**Indian university experience:** Roles at Indian institutions are presented with company_context explaining the institution for UK audiences. Highlights are reframed using UK-familiar terminology: "curriculum design" instead of "syllabus revision", "programme leader" instead of "coordinator", "student engagement" with specific cohort sizes.

**Experience reordering:** Within each role, the mapping stage determines which highlights to include and in what order. The most JD-relevant highlight comes first. Highlights not relevant to this specific role are omitted (they remain in the master profile for other applications).

**Length control:** The system prompt specifies word count targets. Post-generation, the n8n workflow checks total word count. If over target by more than 10%, the CV is sent back for a trim pass (a separate short prompt asking Claude to reduce the least relevant bullets). If under target by more than 20%, it is flagged for manual review.

---

## 9. Cover Letter Generation

### 9.1 Purpose

Each application package includes a tailored cover letter. The cover letter serves a different purpose from the CV: while the CV presents credentials, the cover letter makes the argument for why this candidate is right for this specific role at this specific organisation.

### 9.2 UK Cover Letter Conventions

**Corporate roles:**
- Single A4 page, 250-400 words
- 3-4 paragraphs
- Formal but personable tone
- UK English spelling throughout
- Address to a named person where possible
- "Dear Hiring Manager" / "Yours sincerely" or "Kind regards" when no name available (NOTE: "Yours faithfully" is ONLY used with "Dear Sir/Madam" in UK convention)
- "Dear Sir/Madam" / "Yours faithfully" (only when no role title or name is known at all)
- "Dear Ms Smith" / "Yours sincerely" when name known
- Standard fonts: Arial, Calibri, or Times New Roman, 10-12pt

**Academic roles:**
- 1-2 pages acceptable
- References the specific department and research areas
- Addresses essential and desirable criteria from the person specification
- Discusses potential contribution to teaching, research, and department strategy
- More detailed and substantive than corporate cover letters

### 9.3 Cover Letter Structure

**Corporate L&D cover letter:**

```
Paragraph 1: Opening (2-3 sentences)
- Name the specific role and reference number (if available)
- Brief statement of why this role at this company
- One line that hooks: strongest match point

Paragraph 2: Core match (4-6 sentences)
- Top 3-4 essential criteria matched with specific evidence
- Use the JD's own language where truthful
- Include at least one quantified achievement

Paragraph 3: Added value (3-4 sentences)
- Unique selling points beyond the job spec
- PhD/MBA as strategic differentiators
- Cross-cultural / international experience as asset

Paragraph 4: Closing (2-3 sentences)
- Enthusiasm for the role (specific, not generic)
- Availability / notice period
- "I have the right to work in the UK" (if not obvious)
- Call to action
```

**Academic cover letter:**

```
Paragraph 1: Opening
- Name the role, department, and reference number
- Current position and research area
- Why this department specifically

Paragraph 2-3: Teaching
- Modules you could teach (aligned with department needs)
- Teaching philosophy and approach
- Student engagement evidence and feedback

Paragraph 4: Research
- Research interests aligned with department themes
- Publication track record
- Planned research that fits the department

Paragraph 5: Service and contribution
- Administrative experience
- External examining, reviewing, committee work
- How you would contribute to department strategy

Paragraph 6: Closing
- Enthusiasm for the specific department
- Availability
- Right to work
- Named referees (can reference CV)
```

### 9.4 Claude Prompt -- Cover Letter Generation

**System prompt:**

```
You are a UK-based career coach who writes compelling, authentic cover letters
for senior professionals. Your letters get callbacks because they are specific,
evidence-based, and read like a real person wrote them -- not a template engine.

RULES:
- NEVER invent experience or qualifications
- UK English spelling: organisation, programme, analyse, colour
- Formal but warm tone -- not stiff, not casual
- No cliches: "dynamic professional", "passionate about", "extensive experience"
- No sycophancy: "I was thrilled to see this opportunity"
- Every claim must be supported by evidence from the candidate profile
- Address specific requirements from the JD
- Use the company's own language where appropriate
- Include right-to-work statement if configured
- Do NOT mention salary expectations unless explicitly instructed

UK SIGN-OFF CONVENTIONS (CRITICAL -- violation marks the letter as non-British):
- "Dear Sir/Madam" -> "Yours faithfully"
- "Dear Hiring Manager" -> "Yours sincerely" or "Kind regards"
- "Dear [Named person]" -> "Yours sincerely"
- NEVER use "Yours faithfully" with "Dear Hiring Manager" -- this is a common error
- For corporate roles, "Kind regards" is acceptable as a contemporary alternative
- For academic roles, prefer "Yours sincerely" / "Yours faithfully" as appropriate
```

**User prompt:**

```xml
<jd_analysis>
{{ jd_analysis_json }}
</jd_analysis>

<candidate_profile>
{{ master_profile_json }}
</candidate_profile>

<requirement_mapping>
{{ mapping_json }}
</requirement_mapping>

<cv_content>
{{ generated_cv_json }}
</cv_content>

{{#if candidate_notes}}
<candidate_notes>
{{ candidate_notes }}
The candidate has provided personal context for this specific application.
Incorporate this naturally into the cover letter -- particularly in the opening
or closing paragraph. This personal touch is important for high-priority roles.
</candidate_notes>
{{/if}}

<task>
Write a tailored cover letter for this {{ job_type }} role.

LISTING TYPE: {{ listing_type }}
{{ if listing_type == "recruitment_agency" }}
AGENCY-SPECIFIC INSTRUCTIONS:
- Address the recruitment consultant, not the end employer
- Do not name the end employer if the listing is confidential
- Focus on transferable skills and sector experience rather than company-specific enthusiasm
- Include availability and salary expectations if the JD requests them (agencies often do)
- Tone: professional and efficient -- agencies value directness over narrative
- Close with "I look forward to discussing how my experience aligns with your client's requirements"
{{ else if listing_type == "confidential" }}
CONFIDENTIAL LISTING INSTRUCTIONS:
- Do not attempt to guess or name the employer
- Use generic references: "your organisation" or "the hiring organisation"
- Focus entirely on role requirements and candidate capabilities
- Do not reference company culture, values, or mission (unknown)
{{ else }}
DIRECT EMPLOYER INSTRUCTIONS:
- Address the hiring manager by name if available
- Reference the company by name and demonstrate knowledge of their work
- Show enthusiasm for the specific organisation, not just the role
{{ endif }}

The letter should:
1. Address appropriately based on listing type (see above)
2. Reference the specific role title and company (unless confidential)
3. Address the top 3-4 essential requirements with evidence from the profile
4. Highlight what makes this candidate distinctive for THIS role
5. Handle any CIPD requirement appropriately ({{ cipd_handling_approach }})
6. Frame international experience as an asset, not as something requiring translation
7. Close with availability and right-to-work statement
8. If candidate_notes are provided, incorporate the personal context naturally

Tone: Professional, warm, specific. This should sound like a real person,
not a template. Vary sentence length. Start no more than 2 sentences with
the same word.

Output as JSON:
{
  "salutation": "Dear Hiring Manager,",
  "paragraphs": [
    "First paragraph text...",
    "Second paragraph text...",
    "Third paragraph text...",
    "Fourth paragraph text..."
  ],
  "sign_off": "Yours sincerely,",
  "candidate_name": "Dr Selvi [Surname]",
  "word_count": 320,
  "keywords_incorporated": ["leadership development", "programme design"]
}

CONSTRAINTS:
{{ if job_type == "corporate" }}
- Maximum 400 words
- Single page when rendered
- 3-4 paragraphs
{{ else }}
- Maximum 800 words
- 1-2 pages when rendered
- 5-6 paragraphs
{{ endif }}
</task>
```

### 9.5 Processing Details

- **Model:** claude-sonnet-4-5
- **Temperature:** 0.25 (slightly higher than CV to allow more natural voice variation)
- **Max tokens:** 2048
- **Expected latency:** 3-6 seconds
- **Expected cost:** ~$0.01 per letter

### 9.6 Post-Processing

After generation:

1. **Word count validation:** Corporate letters must be 250-400 words. Academic letters must be 400-800 words. If outside range, regenerate with explicit word count instruction.
2. **UK English check:** Scan for common US spellings (organize, program, analyze, center) and replace with UK equivalents. This is a simple string replacement in the n8n Code node, not an LLM call.
3. **Keyword cross-check:** Verify that the cover letter incorporates at least 3 of the top 5 JD keywords.
4. **Hallucination spot-check:** Compare any metrics or specific claims against the master profile (done as part of Stage 4 QA).

---

## 9b. Supporting Statement Generation

### 9b.1 Purpose

Many UK university and public sector applications require a "supporting statement" -- a structured document that addresses each criterion in the person specification with specific evidence. Supporting statements are typically 2-4 pages and are the primary basis for shortlisting. They are distinct from cover letters: a cover letter makes a narrative argument, while a supporting statement systematically demonstrates evidence against each criterion.

Without this capability, the candidate must still write supporting statements manually for every academic application -- which takes 2-3 hours per application and is the single biggest time sink in the academic application pathway.

### 9b.2 When to Generate

A supporting statement is generated when:
- The JD analysis detects `requires_supporting_statement: true`, OR
- The JD analysis detects a person specification with `>= 5` essential criteria, OR
- The `cv_type_recommended` is `academic` and the job source is a university portal (jobs.ac.uk, university career pages)

The supporting statement replaces the cover letter for these applications (the candidate may still send a brief cover email, but the supporting statement is the substantive document).

### 9b.3 Structure

```
1. OPENING (1 paragraph)
   - Name the role, department, and reference number
   - Current position and research area
   - Brief statement of suitability

2. ESSENTIAL CRITERIA (1 section per criterion)
   For each essential criterion from the person specification:
   - State the criterion
   - Provide specific evidence from the candidate's profile
   - Include metrics, module names, student numbers where relevant
   - Cross-reference to CV for detailed evidence

3. DESIRABLE CRITERIA (1 section per criterion)
   For each desirable criterion:
   - State the criterion
   - Provide evidence if available
   - If no direct evidence, describe transferable experience or readiness to develop

4. CONTRIBUTION STATEMENT (1-2 paragraphs)
   - How the candidate would contribute to the department's research themes
   - Teaching the candidate could deliver (specific modules)
   - Administrative service the candidate could provide

5. CLOSING (1 paragraph)
   - Enthusiasm for the specific department
   - Availability and right to work
```

### 9b.4 Claude Prompt -- Supporting Statement

**System prompt:**

```
You are a UK academic career consultant who writes structured supporting
statements for university lecturer and senior lecturer applications. Your
statements are successful because they directly address each person
specification criterion with specific, verifiable evidence.

RULES:
- NEVER invent experience, qualifications, or evidence
- Address EVERY essential criterion explicitly -- do not skip any
- Address desirable criteria where evidence exists
- For criteria with no evidence, state readiness to develop (do not fabricate)
- UK English throughout
- Structure clearly so shortlisting panels can score each criterion quickly
- Include specific module names, student numbers, and outcomes where available
- Reference the candidate's PhD, publications, and teaching evidence as appropriate
```

**User prompt:**

```xml
<jd_analysis>
{{ jd_analysis_json }}
</jd_analysis>

<person_specification>
{{ person_specification_json }}
</person_specification>

<candidate_profile>
{{ master_profile_json }}
</candidate_profile>

<requirement_mapping>
{{ mapping_json }}
</requirement_mapping>

<task>
Write a structured supporting statement for this academic role.

For each essential criterion in the person specification:
1. State the criterion as a heading
2. Provide 2-4 sentences of specific evidence from the candidate's profile
3. Include metrics and specifics (module names, student numbers, outcomes)
4. If mapping shows this as a gap, acknowledge the gap honestly and describe
   transferable experience or readiness to develop

For each desirable criterion:
1. State the criterion as a heading
2. Provide evidence if the mapping shows a match
3. If no match, briefly describe readiness to develop

Output as JSON:
{
  "opening_paragraph": "...",
  "essential_criteria_responses": [
    {
      "criterion_id": "ps_e1",
      "criterion_text": "PhD or equivalent...",
      "response": "Evidence text...",
      "match_status": "strong_match",
      "source_refs": ["qualification.phd"]
    }
  ],
  "desirable_criteria_responses": [...],
  "contribution_statement": "...",
  "closing_paragraph": "...",
  "word_count": 1200,
  "criteria_addressed": 12,
  "criteria_total": 12
}

CONSTRAINTS:
- 1000-2000 words total
- Address 100% of essential criteria
- Address all desirable criteria where evidence exists
</task>
```

### 9b.5 Processing Details

- **Model:** claude-sonnet-4-5
- **Temperature:** 0.2
- **Max tokens:** 4096
- **Expected latency:** 5-10 seconds
- **Expected cost:** ~$0.03 per statement

---

## 10. Document Generation Pipeline

### 10.1 Overview

The document generation pipeline transforms structured CV/cover letter content (JSON) into formatted documents (PDF and DOCX). The pipeline uses two parallel paths:

```
CV Content JSON
    |
    +---> Handlebars template -> HTML -> Gotenberg -> PDF
    |
    +---> docxtemplater template -> DOCX
```

### 10.2 PDF Generation via Gotenberg

**Step 1: Template rendering (n8n-nodes-text-templater)**

The Handlebars template engine receives the CV content JSON and produces a complete HTML document with embedded CSS.

**n8n node configuration:**
- Node type: Text Templater (n8n-nodes-text-templater)
- Engine: Handlebars
- Input: CV content JSON
- Template: Corporate or academic HTML template (loaded from /templates/ volume)
- Output: HTML string

**Step 2: Convert to binary (n8n Convert to File node)**

- Operation: Move String to File
- File name: `index.html`
- MIME type: `text/html`
- Encoding: UTF-8

**Step 3: Send to Gotenberg (n8n HTTP Request node)**

- Method: POST
- URL: `http://gotenberg:3000/forms/chromium/convert/html`
- Body type: Form-Data
- Field `files`: binary data (index.html)
- Additional parameters:
  - `paperWidth`: 8.27 (A4 width in inches)
  - `paperHeight`: 11.69 (A4 height in inches)
  - `marginTop`: 0.6
  - `marginBottom`: 0.6
  - `marginLeft`: 0.7
  - `marginRight`: 0.7
  - `printBackground`: true
  - `preferCssPageSize`: false
  - `scale`: 1.0
- Response format: File (binary PDF)

**Step 4: Store PDF**

- Write to disk: `/data/generated-cvs/{job_id}/cv_{timestamp}.pdf`
- Write metadata to Postgres: `cv_documents` table

### 10.3 DOCX Generation via docxtemplater

**Step 1: Load DOCX template**

- n8n Read/Write Files from Disk node
- Path: `/templates/cv-corporate.docx` or `/templates/cv-academic.docx`
- Output: Binary DOCX template

**Step 2: Render template (n8n-nodes-docxtemplater)**

- Input template: Binary DOCX from Step 1
- Input data: CV content JSON (transformed to match template variables)
- Output: Rendered DOCX binary

**Template variable mapping:**

```
{ candidate_name }              -> basics.name
{ professional_summary }        -> professional_summary
{#core_skills}{ this }{/core_skills}  -> core_skills array
{#experience}
  { company } -- { position }
  { dates } | { location }
  {#bullets}
  --- { this }
  {/bullets}
{/experience}
{#education}
  { qualification }, { institution } ({ year })
  {#if details}{ details }{/if}
{/education}
```

**Step 3: Store DOCX**

- Write to disk: `/data/generated-cvs/{job_id}/cv_{timestamp}.docx`
- Write metadata to Postgres

### 10.4 Cover Letter Document Generation

Same pipeline as CV, with cover letter templates:

- `/templates/cover-letter-corporate.html` (for PDF)
- `/templates/cover-letter-corporate.docx` (for DOCX)
- `/templates/cover-letter-academic.html` (for PDF)
- `/templates/cover-letter-academic.docx` (for DOCX)

The cover letter template is simpler (body text with paragraphs, no complex sections).

### 10.5 File Naming Convention

```
{candidate_slug}_{company_slug}_{role_slug}_{doc_type}_{timestamp}.{ext}
```

Examples:
```
selvi_deloitte_senior-ld-manager_cv_20260329T1030.pdf
selvi_deloitte_senior-ld-manager_cv_20260329T1030.docx
selvi_deloitte_senior-ld-manager_cover-letter_20260329T1030.pdf
selvi_deloitte_senior-ld-manager_cover-letter_20260329T1030.docx
```

### 10.6 File Storage Architecture

```
/data/generated-cvs/
    /{job_uuid}/
        cv_20260329T1030.pdf
        cv_20260329T1030.docx
        cover_letter_20260329T1030.pdf
        cover_letter_20260329T1030.docx
        metadata.json
```

The `metadata.json` file stores:
```json
{
  "job_id": "uuid",
  "job_title": "Senior L&D Manager",
  "company": "Deloitte UK",
  "cv_type": "corporate_ld",
  "generated_at": "2026-03-29T10:30:00Z",
  "generation_time_ms": 45000,
  "qa_score": 92,
  "files": {
    "cv_pdf": "cv_20260329T1030.pdf",
    "cv_docx": "cv_20260329T1030.docx",
    "cover_letter_pdf": "cover_letter_20260329T1030.pdf",
    "cover_letter_docx": "cover_letter_20260329T1030.docx"
  }
}
```

---

## 11. Template Design

### 11.1 Design Principles

All templates follow ATS-friendly design rules:
- Single-column layout (no tables, no multi-column)
- Standard section headings recognisable by ATS parsers
- No images, graphics, skill bars, or icons
- No content in headers/footers (template generates plain body content)
- Standard fonts available on all systems
- High contrast (black text on white background)
- Generous white space for 6-second scan readability
- A4 paper size (210mm x 297mm)

### 11.2 Corporate CV HTML Template

```html
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @page {
    size: A4;
    margin: 15mm 18mm 15mm 18mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    background: #ffffff;
  }

  /* Header / Name */
  .cv-header {
    text-align: center;
    margin-bottom: 12pt;
    padding-bottom: 8pt;
    border-bottom: 1.5pt solid #2c3e50;
  }

  .cv-name {
    font-size: 20pt;
    font-weight: 700;
    color: #2c3e50;
    letter-spacing: 0.5pt;
    margin-bottom: 4pt;
  }

  .cv-contact {
    font-size: 9.5pt;
    color: #444444;
    line-height: 1.5;
  }

  .cv-contact span {
    margin: 0 6pt;
  }

  .cv-contact .separator {
    color: #999999;
  }

  /* Section headings */
  .section-heading {
    font-size: 11.5pt;
    font-weight: 700;
    color: #2c3e50;
    text-transform: uppercase;
    letter-spacing: 1pt;
    margin-top: 14pt;
    margin-bottom: 6pt;
    padding-bottom: 3pt;
    border-bottom: 0.75pt solid #bdc3c7;
  }

  /* Professional summary */
  .summary {
    font-size: 10.5pt;
    line-height: 1.5;
    margin-bottom: 4pt;
    text-align: justify;
  }

  /* Skills list */
  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    margin-bottom: 4pt;
  }

  .skills-list li {
    list-style: none;
    font-size: 10pt;
    display: inline;
  }

  .skills-list li::after {
    content: "  \2022  ";
    color: #999999;
  }

  .skills-list li:last-child::after {
    content: "";
  }

  /* Experience entries */
  .experience-entry {
    margin-bottom: 10pt;
  }

  .experience-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2pt;
  }

  .experience-role {
    font-size: 11pt;
    font-weight: 700;
    color: #1a1a1a;
  }

  .experience-dates {
    font-size: 9.5pt;
    color: #555555;
    white-space: nowrap;
  }

  .experience-company {
    font-size: 10pt;
    color: #444444;
    margin-bottom: 3pt;
  }

  .experience-company-context {
    font-size: 9pt;
    color: #666666;
    font-style: italic;
    margin-bottom: 3pt;
  }

  .experience-bullets {
    list-style-type: disc;
    padding-left: 18pt;
    margin: 0;
  }

  .experience-bullets li {
    font-size: 10pt;
    line-height: 1.4;
    margin-bottom: 2pt;
  }

  /* Education */
  .education-entry {
    margin-bottom: 6pt;
  }

  .education-qualification {
    font-size: 10.5pt;
    font-weight: 700;
  }

  .education-institution {
    font-size: 10pt;
    color: #444444;
  }

  .education-details {
    font-size: 9.5pt;
    color: #555555;
    font-style: italic;
  }

  /* Professional development and memberships */
  .pd-list, .membership-list {
    list-style-type: disc;
    padding-left: 18pt;
  }

  .pd-list li, .membership-list li {
    font-size: 10pt;
    line-height: 1.4;
    margin-bottom: 2pt;
  }

  /* Avoid page breaks inside entries */
  .experience-entry, .education-entry {
    page-break-inside: avoid;
  }

  /* Print styles */
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>

<div class="cv-header">
  <div class="cv-name">{{candidate_name}}</div>
  <div class="cv-contact">
    {{location}}
    <span class="separator">|</span>
    {{phone}}
    <span class="separator">|</span>
    {{email}}
    {{#if linkedin_url}}
    <span class="separator">|</span>
    {{linkedin_url}}
    {{/if}}
  </div>
</div>

<div class="section-heading">PROFESSIONAL SUMMARY</div>
<p class="summary">{{professional_summary}}</p>

<div class="section-heading">CORE SKILLS</div>
<ul class="skills-list">
  {{#each core_skills}}
  <li>{{this}}</li>
  {{/each}}
</ul>

<div class="section-heading">PROFESSIONAL EXPERIENCE</div>
{{#each experience}}
<div class="experience-entry">
  <div class="experience-header">
    <span class="experience-role">{{this.position}}</span>
    <span class="experience-dates">{{this.dates}}</span>
  </div>
  <div class="experience-company">
    {{this.company}}{{#if this.location}}, {{this.location}}{{/if}}
  </div>
  {{#if this.company_context}}
  <div class="experience-company-context">{{this.company_context}}</div>
  {{/if}}
  <ul class="experience-bullets">
    {{#each this.bullets}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
</div>
{{/each}}

<div class="section-heading">EDUCATION &amp; QUALIFICATIONS</div>
{{#each education}}
<div class="education-entry">
  <span class="education-qualification">{{this.qualification}}</span>
  <span class="education-institution"> -- {{this.institution}} ({{this.year}})</span>
  {{#if this.details}}
  <div class="education-details">{{this.details}}</div>
  {{/if}}
</div>
{{/each}}

{{#if cipd_handling.text_used}}
<div class="education-entry">
  <div class="education-details">{{cipd_handling.text_used}}</div>
</div>
{{/if}}

{{#if professional_development}}
<div class="section-heading">PROFESSIONAL DEVELOPMENT</div>
<ul class="pd-list">
  {{#each professional_development}}
  <li>{{this}}</li>
  {{/each}}
</ul>
{{/if}}

{{#if professional_memberships}}
<div class="section-heading">PROFESSIONAL MEMBERSHIPS</div>
<ul class="membership-list">
  {{#each professional_memberships}}
  <li>{{this}}</li>
  {{/each}}
</ul>
{{/if}}

</body>
</html>
```

### 11.3 Academic CV HTML Template

```html
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 18mm 20mm 18mm 20mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #ffffff;
  }

  .cv-header {
    text-align: center;
    margin-bottom: 16pt;
    padding-bottom: 10pt;
    border-bottom: 2pt solid #1a1a1a;
  }

  .cv-name {
    font-size: 22pt;
    font-weight: 700;
    margin-bottom: 6pt;
  }

  .cv-contact {
    font-size: 10pt;
    color: #333333;
    line-height: 1.6;
  }

  .section-heading {
    font-size: 12pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5pt;
    margin-top: 16pt;
    margin-bottom: 8pt;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #666666;
  }

  .qualification-entry {
    margin-bottom: 8pt;
  }

  .qualification-degree {
    font-size: 11pt;
    font-weight: 700;
  }

  .qualification-details {
    font-size: 10.5pt;
    color: #333333;
  }

  .qualification-thesis {
    font-size: 10pt;
    font-style: italic;
    color: #444444;
    margin-top: 2pt;
  }

  .employment-entry {
    margin-bottom: 12pt;
    page-break-inside: avoid;
  }

  .employment-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2pt;
  }

  .employment-role {
    font-weight: 700;
  }

  .employment-dates {
    font-size: 10pt;
    color: #555555;
  }

  .employment-institution {
    font-size: 10.5pt;
    color: #333333;
    margin-bottom: 4pt;
  }

  .employment-bullets {
    list-style-type: disc;
    padding-left: 20pt;
  }

  .employment-bullets li {
    font-size: 10.5pt;
    line-height: 1.45;
    margin-bottom: 3pt;
  }

  .teaching-table {
    width: 100%;
    margin-bottom: 8pt;
    font-size: 10.5pt;
  }

  .teaching-module {
    font-weight: 600;
  }

  .teaching-detail {
    color: #444444;
  }

  .publication-entry {
    margin-bottom: 6pt;
    font-size: 10.5pt;
    line-height: 1.4;
    padding-left: 20pt;
    text-indent: -20pt;
  }

  .conference-entry {
    margin-bottom: 4pt;
    font-size: 10.5pt;
  }

  .research-interests {
    list-style-type: disc;
    padding-left: 20pt;
  }

  .research-interests li {
    font-size: 10.5pt;
    line-height: 1.45;
    margin-bottom: 3pt;
  }

  .referee-entry {
    margin-bottom: 10pt;
  }

  .referee-name {
    font-weight: 700;
  }

  .referee-details {
    font-size: 10pt;
    color: #333333;
    line-height: 1.4;
  }
</style>
</head>
<body>

<div class="cv-header">
  <div class="cv-name">{{candidate_name}}</div>
  <div class="cv-contact">
    {{email}}<br>
    {{phone}} | {{location}}<br>
    {{#if linkedin_url}}{{linkedin_url}}{{/if}}
  </div>
</div>

<div class="section-heading">QUALIFICATIONS</div>
{{#each qualifications}}
<div class="qualification-entry">
  <div class="qualification-degree">{{this.qualification}}</div>
  <div class="qualification-details">{{this.institution}}, {{this.year}}</div>
  {{#if this.thesis_title}}
  <div class="qualification-thesis">Thesis: {{this.thesis_title}}</div>
  {{/if}}
</div>
{{/each}}

<div class="section-heading">EMPLOYMENT</div>
{{#each employment}}
<div class="employment-entry">
  <div class="employment-header">
    <span class="employment-role">{{this.position}}</span>
    <span class="employment-dates">{{this.dates}}</span>
  </div>
  <div class="employment-institution">{{this.institution}}{{#if this.department}}, {{this.department}}{{/if}}</div>
  {{#if this.bullets}}
  <ul class="employment-bullets">
    {{#each this.bullets}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
  {{/if}}
</div>
{{/each}}

<div class="section-heading">TEACHING EXPERIENCE</div>
{{#each teaching}}
<div style="margin-bottom: 8pt;">
  <div style="font-weight: 600;">{{this.institution}} ({{this.period}})</div>
  {{#each this.modules}}
  <div style="margin-left: 20pt; font-size: 10.5pt;">
    <span class="teaching-module">{{this.name}}</span>
    <span class="teaching-detail"> -- {{this.level}}, {{this.student_count}} students ({{this.role}})</span>
  </div>
  {{/each}}
</div>
{{/each}}

<div class="section-heading">RESEARCH INTERESTS</div>
<ul class="research-interests">
  {{#each research_interests}}
  <li>{{this}}</li>
  {{/each}}
</ul>

{{#if publications}}
<div class="section-heading">PUBLICATIONS</div>
{{#each publications}}
<div class="publication-entry">{{this.citation_text}}</div>
{{/each}}
{{/if}}

{{#if conference_presentations}}
<div class="section-heading">CONFERENCE PRESENTATIONS</div>
{{#each conference_presentations}}
<div class="conference-entry">
  {{this.title}}. <em>{{this.conference}}</em>, {{this.location}}, {{this.year}}.
  {{#if this.type}}({{this.type}}){{/if}}
</div>
{{/each}}
{{/if}}

{{#if professional_memberships}}
<div class="section-heading">PROFESSIONAL MEMBERSHIPS &amp; SERVICE</div>
<ul style="list-style-type: disc; padding-left: 20pt;">
  {{#each professional_memberships}}
  <li style="font-size: 10.5pt; margin-bottom: 3pt;">{{this}}</li>
  {{/each}}
</ul>
{{/if}}

{{#if referees}}
<div class="section-heading">REFEREES</div>
{{#each referees}}
<div class="referee-entry">
  <div class="referee-name">{{this.name}}</div>
  <div class="referee-details">
    {{this.title}}, {{this.organisation}}<br>
    {{this.email}}{{#if this.phone}} | {{this.phone}}{{/if}}
  </div>
</div>
{{/each}}
{{/if}}

</body>
</html>
```

### 11.4 Cover Letter HTML Template

```html
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 20mm 22mm 20mm 22mm;
  }

  body {
    font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
  }

  .letter-header {
    margin-bottom: 24pt;
  }

  .sender-details {
    font-size: 10pt;
    color: #333333;
    margin-bottom: 16pt;
  }

  .date {
    font-size: 10.5pt;
    margin-bottom: 16pt;
  }

  .recipient {
    font-size: 10.5pt;
    margin-bottom: 16pt;
  }

  .salutation {
    font-size: 11pt;
    margin-bottom: 12pt;
  }

  .letter-body p {
    margin-bottom: 12pt;
    text-align: justify;
  }

  .sign-off {
    margin-top: 20pt;
    font-size: 11pt;
  }

  .candidate-name {
    font-weight: 700;
    margin-top: 24pt;
  }
</style>
</head>
<body>

<div class="letter-header">
  <div class="sender-details">
    {{candidate_name}}<br>
    {{location}}<br>
    {{email}} | {{phone}}
  </div>

  <div class="date">{{date}}</div>

  {{#if recipient_name}}
  <div class="recipient">
    {{recipient_name}}<br>
    {{#if recipient_title}}{{recipient_title}}<br>{{/if}}
    {{company}}<br>
    {{#if company_address}}{{company_address}}{{/if}}
  </div>
  {{/if}}
</div>

<div class="salutation">{{salutation}}</div>

<div class="letter-body">
  {{#each paragraphs}}
  <p>{{this}}</p>
  {{/each}}
</div>

<div class="sign-off">
  {{sign_off}}<br>
  <div class="candidate-name">{{candidate_name}}</div>
</div>

</body>
</html>
```

### 11.5 DOCX Templates

DOCX templates are created as standard Word documents with docxtemplater tags. They mirror the HTML templates' structure and use the same variable names.

**Corporate CV DOCX template structure:**

The DOCX file `/templates/cv-corporate.docx` is created in Word with:
- Calibri 10.5pt body text
- Heading styles for section headings (mapped to `PROFESSIONAL EXPERIENCE`, etc.)
- Template tags: `{ candidate_name }`, `{#experience}...{/experience}`, etc.
- Conditional sections: `{#if professional_development}...{/if}`
- A4 page setup with matching margins

**Academic CV DOCX template structure:**

Similar to corporate but with Georgia/Times New Roman font, additional sections for publications and teaching, and no strict page limit.

**Cover letter DOCX templates:**

Simple letter format with template tags for salutation, paragraphs, and sign-off.

### 11.6 Template Versioning

Templates are stored as files in the `/templates/` directory, which is volume-mounted into the n8n Docker container. The directory structure:

```
/templates/
  cv-corporate-v1.html
  cv-corporate-v1.docx
  cv-academic-v1.html
  cv-academic-v1.docx
  cover-letter-corporate-v1.html
  cover-letter-corporate-v1.docx
  cover-letter-academic-v1.html
  cover-letter-academic-v1.docx
  supporting-statement-v1.html
  supporting-statement-v1.docx
```

Template versions are tracked in the `cv_packages` table so that if a template is updated, existing packages are not retroactively affected.

---

## 12. Quality Assurance Pipeline

### 12.1 Purpose

Stage 4 of the pipeline. The QA pipeline validates every generated CV and cover letter before it is rendered as a document. It catches hallucination, keyword gaps, formatting issues, and content quality problems.

The QA stage is deliberately a separate LLM call from the generation stage, using a different model (Claude Haiku for hallucination checking when Sonnet was used for generation) to avoid same-model confirmation bias. Using a different model family creates genuine independence in the validation -- the validator does not share the generator's systematic biases or tendency to rationalise plausible-sounding fabrications.

### 12.2 QA Validation Checks

| Check | Method | Pass Criteria | Action on Fail |
|-------|--------|---------------|----------------|
| Hallucination detection | LLM comparison against master profile | 100% of claims traceable | Regenerate with feedback |
| Keyword coverage | Programmatic comparison against JD keywords | 75-85% of JD keywords present | Flag for review if < 70% |
| Word count (corporate) | Character count | 450-550 words body text | Trim/expand pass |
| Word count (academic) | Character count | No strict limit, but flagged if < 300 | Flag for review |
| UK English spelling | Regex scan for US variants | Zero US spellings | Auto-correct |
| Section completeness | Schema validation | All required sections present | Regenerate |
| Metrics accuracy | LLM comparison of numbers against profile | 100% match | Regenerate with feedback |
| Bullet format | Regex check | All bullets start with action verb | Flag for review |
| Cover letter word count | Character count | 250-400 (corp) or 400-800 (acad) | Trim/expand pass |
| No salary mention | String scan | No salary figures in CV/letter | Auto-remove |
| No personal data | String scan | No DOB, photo ref, marital status | Auto-remove |
| Date consistency | Regex parse | All dates match profile | Flag for review |
| Post-render page count (corporate) | PDF metadata check after Gotenberg render | Exactly 2 pages | Trim pass + re-render if >2 pages; flag for review if <1.5 pages |
| Post-render page count (cover letter) | PDF metadata check after Gotenberg render | 1 page (corporate) or 1-2 pages (academic) | Trim/expand pass + re-render |
| Programmatic metrics extraction | Regex extract all numbers from CV, compare against profile | 100% match on extracted metrics | Flag mismatches as critical |
| Sign-off convention check | String match | Correct pairing per UK convention (see Section 9.2) | Auto-correct |
| ATS parse validation | pdftotext extraction + structure check (post-render) | All section headings, job titles, company names, and dates extractable as plain text | Flag for review; if critical fields missing, regenerate with simplified layout |

### 12.3 Hallucination Detection

**Model:** Claude Haiku (claude-haiku-4-5) -- deliberately a different model from the Sonnet generator to avoid same-model confirmation bias. Haiku is sufficient for fact-checking (comparison task, not generation) and provides genuine independence from the generator.

**Pre-LLM programmatic checks (run before the LLM call):**

```javascript
// Programmatic metrics extraction and comparison
// Extract all numbers, percentages, team sizes, budget amounts from generated CV
const cvText = JSON.stringify($input.first().json.cv_content);
const profile = $input.first().json.master_profile;

// Extract all numeric claims from CV
const percentages = [...cvText.matchAll(/(\d+)%/g)].map(m => m[1]);
const teamSizes = [...cvText.matchAll(/team of (\d+)/gi)].map(m => m[1]);
const budgetAmounts = [...cvText.matchAll(/(?:GBP|£)\s*([\d,.]+[MKk]?)/g)].map(m => m[1]);
const years = [...cvText.matchAll(/(\d+)\s*years?/g)].map(m => m[1]);

// Compare against profile data (extract same patterns)
const profileText = JSON.stringify(profile);
const profilePercentages = [...profileText.matchAll(/(\d+)%/g)].map(m => m[1]);
// ... similar extraction for other metric types

// Flag any CV metric not found in profile
const unverifiedMetrics = percentages.filter(p => !profilePercentages.includes(p));
// Return findings for QA report
```

**LLM prompt (runs after programmatic checks):**

```xml
<system>
You are a fact-checker auditing a tailored CV for accuracy. Your task is to
FALSIFY claims -- actively search for content that CANNOT be traced to the
candidate's master profile. Do not look for reasons to accept claims; look
for reasons to reject them.

APPROACH: For each factual claim, attempt to find a CONTRADICTION or ABSENCE
in the profile. A claim passes only if you find explicit supporting evidence.
Absence of contradicting evidence is NOT sufficient -- you need positive proof.
</system>

<generated_cv>
{{ generated_cv_json }}
</generated_cv>

<master_profile>
{{ master_profile_json }}
</master_profile>

<task>
For each factual claim in the generated CV (job titles, companies, dates,
metrics, qualifications, skills demonstrated, team sizes, budget amounts),
verify it against the master profile.

Return a JSON report:
{
  "total_claims_checked": 25,
  "verified_claims": 24,
  "unverified_claims": [
    {
      "cv_text": "the problematic text",
      "issue": "description of what cannot be verified",
      "severity": "critical|major|minor",
      "recommendation": "what to do about it"
    }
  ],
  "metrics_checked": [
    {
      "cv_value": "40%",
      "profile_value": "40%",
      "match": true
    }
  ],
  "authenticity_score": 96,
  "pass": true,
  "notes": "One minor issue: ..."
}

SEVERITY LEVELS:
- critical: Fabricated experience, invented qualification, or altered metric.
  MUST be fixed before use.
- major: Significantly embellished claim or implied experience not in profile.
  Should be fixed.
- minor: Slight rephrasing that changes meaning marginally.
  Can be accepted with awareness.

A CV passes if: authenticity_score >= 95 AND zero critical issues.
</task>
```

### 12.4 Keyword Coverage Check

This is a programmatic check (n8n Code node), not an LLM call:

```javascript
// Keyword coverage check
const jdKeywords = $input.first().json.jd_analysis.keywords;
const cvText = JSON.stringify($input.first().json.cv_content).toLowerCase();

const allKeywords = [
  ...jdKeywords.hard_skills,
  ...jdKeywords.soft_skills,
  ...jdKeywords.tools_platforms,
  ...jdKeywords.qualifications
].map(k => k.toLowerCase());

const unique = [...new Set(allKeywords)];
const found = unique.filter(kw => cvText.includes(kw));
const missing = unique.filter(kw => !cvText.includes(kw));
const coverage = (found.length / unique.length) * 100;

return [{
  json: {
    total_keywords: unique.length,
    found_count: found.length,
    missing_count: missing.length,
    coverage_percentage: Math.round(coverage),
    found_keywords: found,
    missing_keywords: missing,
    pass: coverage >= 70
  }
}];
```

### 12.5 UK English Spelling Check

Programmatic replacement in n8n Code node:

```javascript
// UK English spell check and auto-correct
const usToUk = {
  'organize': 'organise',
  'organization': 'organisation',
  'organizational': 'organisational',
  'analyze': 'analyse',
  'analyzing': 'analysing',
  'analyzed': 'analysed',
  'program ': 'programme ',  // trailing space to avoid 'programming'
  'programs': 'programmes',
  'center': 'centre',
  'color': 'colour',
  'favor': 'favour',
  'favorite': 'favourite',
  'behavior': 'behaviour',
  'behavioral': 'behavioural',
  'honor': 'honour',
  'labor': 'labour',
  'optimize': 'optimise',
  'optimizing': 'optimising',
  'optimization': 'optimisation',
  'recognize': 'recognise',
  'recognized': 'recognised',
  'specialize': 'specialise',
  'specialized': 'specialised',
  'specialization': 'specialisation',
  'customize': 'customise',
  'utilize': 'utilise',
  'utilizing': 'utilising',
  'maximize': 'maximise',
  'minimize': 'minimise',
  'summarize': 'summarise',
  'standardize': 'standardise',
  'prioritize': 'prioritise',
  'catalog': 'catalogue',
  'dialog': 'dialogue',
  'fulfill': 'fulfil',
  'enrollment': 'enrolment',
  'counselor': 'counsellor',
  'modeling': 'modelling',
  'traveled': 'travelled',
  'traveling': 'travelling',
  'license': 'licence',  // noun form
  'defense': 'defence',
  'offense': 'offence',
  'practice': 'practise'  // verb form
};

let text = JSON.stringify($input.first().json.cv_content);
let corrections = [];

// Build a protected terms set from JD keywords and known proper nouns
// These terms must NOT be modified by the spelling check
const jdKeywords = $input.first().json.jd_analysis?.keywords || {};
const allJdTerms = [
  ...(jdKeywords.hard_skills || []),
  ...(jdKeywords.soft_skills || []),
  ...(jdKeywords.tools_platforms || []),
  ...(jdKeywords.qualifications || [])
];

// Known product/brand names that use US spelling intentionally
const protectedProperNouns = [
  'Organize', 'Organization',  // e.g. "World Health Organization"
  'Center',                     // e.g. "Center Parcs", "Microsoft Center"
  'Program',                    // e.g. "Microsoft Program Manager"
  'Favor',                      // brand names
  ...allJdTerms                 // JD keywords must be preserved exactly
];

// Create a map of positions to protect (case-insensitive matching)
const protectedPositions = [];
for (const term of protectedProperNouns) {
  const termRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let match;
  while ((match = termRegex.exec(text)) !== null) {
    protectedPositions.push({ start: match.index, end: match.index + match[0].length });
  }
}

function isProtected(index, length) {
  return protectedPositions.some(p =>
    (index >= p.start && index < p.end) ||
    (index + length > p.start && index + length <= p.end)
  );
}

for (const [us, uk] of Object.entries(usToUk)) {
  const regex = new RegExp(us, 'gi');
  let match;
  const newText = text.replace(regex, (matched, offset) => {
    if (isProtected(offset, matched.length)) {
      return matched; // preserve protected term
    }
    corrections.push({ from: matched, to: uk, position: offset });
    return uk;
  });
  text = newText;
}

return [{
  json: {
    cv_content: JSON.parse(text),
    corrections_made: corrections,
    correction_count: corrections.length,
    protected_terms_count: protectedProperNouns.length
  }
}];
```

### 12.6 QA Decision Logic

```
IF hallucination_check.pass == false AND any critical issues:
    -> Regenerate CV (Stage 3) with feedback attached
    -> Max 2 regeneration attempts
    -> If still failing after 2 retries: mark package as "needs_manual_review"

ELSE IF keyword_coverage < 70%:
    -> Flag for review but do not block
    -> Include keyword gap report in notification email

ELSE IF uk_spelling corrections > 0:
    -> Auto-correct and proceed (no regeneration needed)

ELSE IF word_count outside range:
    -> Run trim/expand pass (short Claude call) and re-validate

ELSE:
    -> Pass: proceed to document rendering
```

### 12.7 QA Report Schema

```json
{
  "job_id": "uuid",
  "qa_timestamp": "2026-03-29T10:36:00Z",
  "overall_pass": true,
  "overall_score": 92,

  "hallucination_check": {
    "pass": true,
    "authenticity_score": 98,
    "claims_checked": 25,
    "claims_verified": 25,
    "critical_issues": 0,
    "major_issues": 0,
    "minor_issues": 1,
    "details": []
  },

  "keyword_coverage": {
    "pass": true,
    "total_keywords": 18,
    "found": 14,
    "missing": 4,
    "coverage_percentage": 78,
    "missing_keywords": ["Workday Learning", "SAP", "Power BI", "Six Sigma"]
  },

  "uk_english": {
    "pass": true,
    "corrections_made": 2,
    "corrections": [
      { "from": "organization", "to": "organisation" }
    ]
  },

  "word_count": {
    "pass": true,
    "cv_words": 510,
    "cover_letter_words": 340,
    "cv_within_range": true,
    "cover_letter_within_range": true
  },

  "format_check": {
    "pass": true,
    "all_sections_present": true,
    "bullets_start_with_action_verb": true,
    "no_salary_mentioned": true,
    "no_personal_data": true,
    "dates_consistent": true
  },

  "generation_attempts": 1,
  "qa_duration_ms": 3200,
  "model_used": "claude-haiku-4-5",
  "tokens_used": { "input": 3200, "output": 800 },
  "programmatic_metrics_check": {
    "metrics_extracted": 12,
    "metrics_verified": 11,
    "metrics_unverified": 1,
    "unverified_details": [
      { "cv_value": "1.5M", "closest_profile_value": "1.2M+", "flagged": true }
    ]
  },
  "page_count_check": {
    "cv_pages": 2,
    "cover_letter_pages": 1,
    "cv_within_limit": true,
    "cover_letter_within_limit": true
  },
  "ats_parse_check": {
    "pass": true,
    "text_extractable": true,
    "sections_found": ["Professional Summary", "Experience", "Education", "Skills"],
    "sections_expected": ["Professional Summary", "Experience", "Education", "Skills"],
    "job_titles_extracted": 4,
    "dates_extracted": 8,
    "issues": []
  }
}
```

### 12.8 ATS Parse Validation

Post-render check that verifies the generated PDF is parseable by Applicant Tracking Systems. This runs after Gotenberg rendering in WF9 and uses `pdftotext` (from poppler-utils, installed in the n8n container).

```javascript
// ATS parse validation -- runs on generated CV PDF
const { execSync } = require('child_process');

const pdfPath = $input.first().json.cv_pdf_path;
const extractedText = execSync(`pdftotext "${pdfPath}" -`).toString();

// Check 1: Is text extractable at all?
const textExtractable = extractedText.trim().length > 100;

// Check 2: Can we find expected section headings?
const expectedSections = $input.first().json.cv_type === 'academic'
  ? ['Education', 'Publications', 'Teaching', 'Research']
  : ['Professional Summary', 'Experience', 'Education', 'Skills'];

const sectionsFound = expectedSections.filter(s =>
  extractedText.toLowerCase().includes(s.toLowerCase())
);

// Check 3: Can we extract dates? (ATS relies on date parsing)
const datePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b|\b\d{4}\s*[-–]\s*(Present|\d{4})\b/gi;
const datesExtracted = (extractedText.match(datePattern) || []).length;

// Check 4: Are job titles and company names on separate, identifiable lines?
const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const jobTitlePattern = /^(Senior |Lead |Head of |Director |Manager |Lecturer |Professor )/i;
const jobTitlesFound = lines.filter(l => jobTitlePattern.test(l)).length;

const pass = textExtractable
  && sectionsFound.length >= expectedSections.length * 0.75
  && datesExtracted >= 2;

return [{
  json: {
    ats_parse_check: {
      pass,
      text_extractable: textExtractable,
      sections_found: sectionsFound,
      sections_expected: expectedSections,
      job_titles_extracted: jobTitlesFound,
      dates_extracted: datesExtracted,
      issues: !pass ? ['PDF may not be ATS-parseable -- review template layout'] : []
    }
  }
}];
```

**Fallback:** If ATS validation fails, the system flags the package for review but does not block it. The review interface displays an "ATS Warning" badge so the candidate knows to check the PDF renders correctly in simpler layouts. If the failure is due to flex layout issues, a future improvement would regenerate with a table-based fallback template.

**Dependency:** Add `poppler-utils` to the n8n Docker container. In the Dockerfile or docker-compose command:
```yaml
# Add to n8n container setup
RUN apt-get update && apt-get install -y poppler-utils && rm -rf /var/lib/apt/lists/*
```

---

## 13. Database Schema

### 13.1 Overview

Module 2 adds four new tables to the existing `selvi_jobs` database, all linked to Module 1's `jobs` table through foreign keys.

### 13.2 Table: master_profiles

Stores the candidate's master profile (single row for this single-user system, but structured for extensibility).

```sql
CREATE TABLE master_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id VARCHAR(50) NOT NULL UNIQUE,

    -- Profile data (full JSON structure per Section 6.2)
    profile_data JSONB NOT NULL,

    -- Version tracking
    version INTEGER NOT NULL DEFAULT 1,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_master_profiles_updated_at
    BEFORE UPDATE ON master_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for JSONB queries
CREATE INDEX idx_master_profiles_candidate ON master_profiles(candidate_id);
```

### 13.3 Table: master_profile_versions

Maintains version history of the master profile for audit and rollback.

```sql
CREATE TABLE master_profile_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES master_profiles(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    profile_data JSONB NOT NULL,
    change_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_profile_version UNIQUE (profile_id, version)
);

CREATE INDEX idx_profile_versions_profile ON master_profile_versions(profile_id);
```

### 13.4 Table: jd_analyses

Stores the structured analysis of each job description (Stage 1 output).

```sql
CREATE TABLE jd_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Analysis output (full JSON structure per Section 7.3)
    analysis_data JSONB NOT NULL,

    -- Classification
    cv_type_recommended VARCHAR(20) NOT NULL
        CHECK (cv_type_recommended IN ('corporate_ld', 'academic', 'hybrid')),

    -- Extracted counts
    essential_requirements_count INTEGER,
    desirable_requirements_count INTEGER,
    implicit_requirements_count INTEGER,
    total_keywords_count INTEGER,
    cipd_required BOOLEAN DEFAULT false,
    cipd_level_minimum INTEGER,
    cipd_requirement_type VARCHAR(20) DEFAULT NULL
        CHECK (cipd_requirement_type IN (NULL, 'must_hold', 'or_equivalent', 'desirable')),

    -- Processing metadata
    model_used VARCHAR(100) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),
    processing_time_ms INTEGER,

    -- Audit
    analysed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_jd_analysis UNIQUE (job_id)
);

CREATE INDEX idx_jd_analyses_job ON jd_analyses(job_id);
CREATE INDEX idx_jd_analyses_cv_type ON jd_analyses(cv_type_recommended);
```

### 13.5 Table: cv_packages

The central table for Module 2. Each row represents a complete tailored application package for a specific job.

```sql
CREATE TABLE cv_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    jd_analysis_id UUID REFERENCES jd_analyses(id),
    profile_id UUID REFERENCES master_profiles(id),
    profile_version INTEGER NOT NULL,

    -- Package type
    cv_type VARCHAR(20) NOT NULL
        CHECK (cv_type IN ('corporate_ld', 'academic', 'hybrid')),

    -- Generated content (JSON)
    mapping_data JSONB,          -- Stage 2: requirement-to-experience mapping
    cv_content JSONB,            -- Stage 3: tailored CV content
    cover_letter_content JSONB,  -- Stage 3b: tailored cover letter content

    -- Quality assurance
    qa_report JSONB,             -- Stage 4: QA validation report
    qa_score INTEGER CHECK (qa_score BETWEEN 0 AND 100),
    qa_pass BOOLEAN,
    hallucination_score INTEGER CHECK (hallucination_score BETWEEN 0 AND 100),
    keyword_coverage_pct INTEGER CHECK (keyword_coverage_pct BETWEEN 0 AND 100),

    -- Gap analysis summary
    match_percentage INTEGER CHECK (match_percentage BETWEEN 0 AND 100),
    strong_matches INTEGER DEFAULT 0,
    partial_matches INTEGER DEFAULT 0,
    gaps INTEGER DEFAULT 0,
    gap_summary TEXT,

    -- Document files
    cv_pdf_path TEXT,
    cv_docx_path TEXT,
    cover_letter_pdf_path TEXT,
    cover_letter_docx_path TEXT,
    supporting_statement_pdf_path TEXT,
    supporting_statement_docx_path TEXT,
    supporting_statement_content JSONB,  -- Stage 3c: supporting statement content
    template_version VARCHAR(20),

    -- Status tracking
    status VARCHAR(30) DEFAULT 'generating'
        CHECK (status IN (
            'generating',       -- Pipeline in progress
            'qa_failed',        -- Failed QA, needs regeneration
            'qa_review',        -- Passed QA but flagged for manual review
            'ready',            -- Ready for candidate review
            'approved',         -- Candidate approved
            'approved_edited',  -- Candidate approved after edits
            'rejected',         -- Candidate rejected
            'applied',          -- Candidate submitted application
            'expired'           -- Job expired before application
        )),

    -- Notification tracking
    notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,

    -- Candidate feedback
    candidate_rating INTEGER CHECK (candidate_rating BETWEEN 1 AND 5),
    candidate_notes TEXT,
    callback_received BOOLEAN,
    callback_date DATE,

    -- Processing metadata
    generation_attempts INTEGER DEFAULT 1,
    total_generation_time_ms INTEGER,
    total_cost_usd NUMERIC(10, 6),

    -- Claude API tracking (per stage)
    stage1_model VARCHAR(100),
    stage1_tokens_in INTEGER,
    stage1_tokens_out INTEGER,
    stage1_cost NUMERIC(10, 6),

    stage2_model VARCHAR(100),
    stage2_tokens_in INTEGER,
    stage2_tokens_out INTEGER,
    stage2_cost NUMERIC(10, 6),

    stage3_model VARCHAR(100),
    stage3_tokens_in INTEGER,
    stage3_tokens_out INTEGER,
    stage3_cost NUMERIC(10, 6),

    stage4_model VARCHAR(100),
    stage4_tokens_in INTEGER,
    stage4_tokens_out INTEGER,
    stage4_cost NUMERIC(10, 6),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_cv_packages_updated_at
    BEFORE UPDATE ON cv_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_cv_packages_job ON cv_packages(job_id);
CREATE INDEX idx_cv_packages_status ON cv_packages(status);
CREATE INDEX idx_cv_packages_ready ON cv_packages(status) WHERE status = 'ready';
CREATE INDEX idx_cv_packages_not_notified ON cv_packages(notified)
    WHERE notified = false AND status = 'ready';
CREATE INDEX idx_cv_packages_created ON cv_packages(created_at DESC);
CREATE INDEX idx_cv_packages_callback ON cv_packages(callback_received)
    WHERE callback_received IS NOT NULL;
```

### 13.6 Table: cv_generation_log

Detailed log of each pipeline execution for debugging and cost tracking.

```sql
CREATE TABLE cv_generation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES cv_packages(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id),

    -- Stage tracking
    stage VARCHAR(20) NOT NULL
        CHECK (stage IN ('jd_analysis', 'mapping', 'cv_generation',
                         'cover_letter', 'qa_validation', 'document_render',
                         'notification', 'error')),

    -- Status
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('started', 'completed', 'failed', 'retrying')),

    -- Details
    attempt_number INTEGER DEFAULT 1,
    model_used VARCHAR(100),
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),
    duration_ms INTEGER,
    error_message TEXT,
    error_details JSONB,

    -- Audit
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_log_package ON cv_generation_log(package_id);
CREATE INDEX idx_gen_log_job ON cv_generation_log(job_id);
CREATE INDEX idx_gen_log_stage ON cv_generation_log(stage);
CREATE INDEX idx_gen_log_errors ON cv_generation_log(status) WHERE status = 'failed';
CREATE INDEX idx_gen_log_time ON cv_generation_log(logged_at DESC);
```

### 13.7 Views

**Pending packages view -- shows jobs that need CV generation:**

```sql
CREATE VIEW v_pending_cv_generation AS
SELECT
    j.id AS job_id,
    j.title,
    j.company,
    j.tier,
    j.job_type,
    js.composite_score,
    j.discovered_at,
    j.description
FROM jobs j
JOIN job_scores js ON j.id = js.job_id
LEFT JOIN cv_packages cp ON j.id = cp.job_id
    AND cp.status NOT IN ('failed', 'superseded')
WHERE j.status = 'active'
  AND js.tier IN ('A', 'B')
  AND cp.id IS NULL
ORDER BY
    CASE js.tier WHEN 'A' THEN 1 ELSE 2 END,
    js.composite_score DESC;
```

**Package status dashboard view:**

```sql
CREATE VIEW v_cv_package_dashboard AS
SELECT
    cp.id AS package_id,
    j.title AS job_title,
    j.company,
    j.tier,
    cp.cv_type,
    cp.status,
    cp.qa_score,
    cp.match_percentage,
    cp.keyword_coverage_pct,
    cp.strong_matches,
    cp.gaps,
    cp.candidate_rating,
    cp.callback_received,
    cp.total_cost_usd,
    cp.created_at,
    cp.notified_at
FROM cv_packages cp
JOIN jobs j ON cp.job_id = j.id
ORDER BY cp.created_at DESC;
```

**Cost tracking view:**

```sql
CREATE VIEW v_cv_generation_costs AS
SELECT
    DATE(logged_at) AS generation_date,
    COUNT(DISTINCT package_id) AS packages_generated,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) FILTER (WHERE stage = 'cv_generation') AS avg_cv_gen_cost,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    AVG(duration_ms) AS avg_duration_ms
FROM cv_generation_log
WHERE status = 'completed'
GROUP BY DATE(logged_at)
ORDER BY generation_date DESC;
```

### 13.8 Module 1 Schema Updates

Add a column to the existing `jobs` table to track CV generation status:

```sql
ALTER TABLE jobs ADD COLUMN cv_package_status VARCHAR(20) DEFAULT NULL
    CHECK (cv_package_status IN (NULL, 'pending', 'generating', 'ready',
                                  'approved', 'applied', 'failed'));

CREATE INDEX idx_jobs_cv_status ON jobs(cv_package_status)
    WHERE cv_package_status IS NOT NULL;
```

---

## 14. n8n Workflow Specifications

### 14.1 WF8: CV Tailoring Orchestrator

**Purpose:** The main pipeline workflow. Picks up A/B-tier jobs that lack a CV package and runs them through the full tailoring pipeline.

**Trigger:** Cron schedule, every 15 minutes.

**Why cron instead of event-driven:** n8n does not have native Postgres LISTEN/NOTIFY support. Polling every 15 minutes is simple, reliable, and keeps the 5-minute delivery target achievable (worst case: 15 min poll + 5 min generation = 20 min from scoring to notification; typical case: 7.5 min poll + 3 min generation = 10.5 min).

**Node sequence:**

```
[0] Schedule Trigger (every 15 min)
    |
    v
[0a] Postgres: Stale-job recovery check
    SQL: UPDATE cv_packages
         SET status = 'failed',
             candidate_notes = 'Auto-recovered: stuck in generating for >30 min'
         WHERE status = 'generating'
           AND updated_at < NOW() - INTERVAL '30 minutes'
         RETURNING job_id;
    -- Also reset the corresponding jobs.cv_package_status:
    UPDATE jobs SET cv_package_status = 'failed'
         WHERE id IN (SELECT job_id FROM cv_packages
                      WHERE status = 'failed'
                        AND candidate_notes LIKE 'Auto-recovered%');
    -- Log recovered jobs to cv_generation_log with stage = 'error'
    |
    v
[1] Postgres: Query pending jobs
    SQL: SELECT * FROM v_pending_cv_generation LIMIT 5
    (Process max 5 jobs per run to avoid timeout)
    |
    v
[3] IF: Any pending jobs?
    |-- No --> [END]
    |-- Yes --> [4]
    |
    v
[4] Loop Over Items (one per job)
    |
    v
[5] Postgres: Load master profile
    SQL: SELECT profile_data FROM master_profiles
         WHERE candidate_id = 'selvi-001'
    |
    v
[5a] Code: PII stripping for Claude API calls
    -- Strip fields that Claude does not need for generation:
    --   - personal_details.email -> replaced with "[REDACTED]"
    --   - personal_details.phone -> replaced with "[REDACTED]"
    --   - personal_details.full_address -> reduced to city/region only
    --   - personal_details.name -> replaced with placeholder "CANDIDATE_NAME"
    --   - referees section -> removed entirely (added post-generation from template)
    -- Store original profile in memory for post-generation re-injection
    -- The stripping function:
    const profile = structuredClone($input.first().json.profile_data);
    if (profile.personal_details) {
      profile.personal_details.email = '[REDACTED]';
      profile.personal_details.phone = '[REDACTED]';
      profile.personal_details.name = 'CANDIDATE_NAME';
      delete profile.personal_details.full_address;
      // Keep city/region only
    }
    delete profile.referees;
    return [{ json: { stripped_profile: profile, original_profile: $input.first().json.profile_data } }];
    |
    v
[6] Postgres: Create cv_packages row (status = 'generating')
    SQL: INSERT INTO cv_packages (job_id, profile_id, profile_version,
         cv_type, status) VALUES (...)
    |
    v
[7] Postgres: Update jobs.cv_package_status = 'generating'
    |
    v
[8] Code: Prepare JD analysis prompt
    - Loads job description from query result
    - Constructs prompt per Section 7.4
    |
    v
[9] HTTP Request: Claude API (Haiku) -- JD Analysis
    POST https://api.anthropic.com/v1/messages
    Model: claude-haiku-4-5
    Temperature: 0.0
    Max tokens: 4096
    |
    v
[10] Code: Parse and validate JD analysis JSON
    - Validate against schema
    - If invalid: log error, retry once, or mark failed
    |
    v
[11] Postgres: Insert into jd_analyses
    |
    v
[12] Code: Log Stage 1 to cv_generation_log
    |
    v
[13] Code: Prepare mapping prompt
    - Combines JD analysis + master profile
    - Constructs prompt per Section 8.2
    |
    v
[14] HTTP Request: Claude API (Haiku) -- Mapping
    Model: claude-haiku-4-5
    Temperature: 0.1
    |
    v
[15] Code: Parse and validate mapping JSON
    |
    v
[16] Postgres: Update cv_packages.mapping_data
    |
    v
[17] Code: Log Stage 2 to cv_generation_log
    |
    v
[18] Code: Determine CV type and prepare generation prompt
    - Select corporate or academic prompt
    - Constructs prompt per Section 8.3
    |
    v
[19] HTTP Request: Claude API (Sonnet) -- CV Generation
    Model: claude-sonnet-4-5
    Temperature: 0.15
    Max tokens: 8192
    |
    v
[20] Code: Parse and validate CV content JSON
    |
    v
[21] Code: Prepare cover letter prompt
    - Uses JD analysis + mapping + CV content
    - Constructs prompt per Section 9.4
    |
    v
[22] HTTP Request: Claude API (Sonnet) -- Cover Letter
    Model: claude-sonnet-4-5
    Temperature: 0.25
    Max tokens: 2048
    |
    v
[23] Postgres: Update cv_packages with cv_content + cover_letter_content
    |
    v
[23b] IF: JD analysis has requires_supporting_statement == true
      OR person_specification criteria >= 5
      OR (cv_type == 'academic' AND source is university portal)?
    |-- No  --> [24]
    |-- Yes --> [23c]
    |
    v
[23c] Code: Prepare supporting statement prompt (per Section 9b.4)
    |
    v
[23d] HTTP Request: Claude API (Sonnet) -- Supporting Statement
    Model: claude-sonnet-4-5
    Temperature: 0.2
    Max tokens: 4096
    |
    v
[23e] Code: Parse and validate supporting statement JSON
    |
    v
[23f] Postgres: Update cv_packages.supporting_statement_content
    |
    v
[24] Code: Log Stage 3 to cv_generation_log
    |
    v
[25] Code: UK English spelling check (auto-correct)
    |
    v
[26] Code: Keyword coverage check
    |
    v
[27] Code: Prepare hallucination check prompt
    |
    v
[28] HTTP Request: Claude API (Haiku) -- QA Validation
    Model: claude-haiku-4-5 (deliberately different from Sonnet generator to avoid confirmation bias)
    Temperature: 0.0
    |
    v
[29] Code: Parse QA report, determine pass/fail
    |
    v
[30] IF: QA Pass?
    |-- Yes --> [32]
    |-- No, attempt < 3 --> [31]
    |-- No, attempt >= 3 --> [35]
    |
    v
[31] Code: Append QA feedback to generation prompt, increment attempt
    -> Go back to [19] (regenerate CV)
    |
    v
[32] Postgres: Update cv_packages (qa_report, qa_score, qa_pass, etc.)
    |
    v
[33] Execute Sub-Workflow: WF9 (Document Renderer)
    Input: cv_content, cover_letter_content, cv_type, job_id
    Output: file paths for PDF/DOCX
    |
    v
[34] Postgres: Update cv_packages (file paths, status = 'ready')
    |
    v
[35a] Execute Sub-Workflow: WF12 (Notifier)
    Input: package data, job data, file paths
    |
    v
[35b] (If QA failed 3x): Update cv_packages status = 'qa_review'
    -> Still notify, but flag as needing manual review
    |
    v
[36] Postgres: Update jobs.cv_package_status = 'ready' (or 'failed')
    |
    v
[37] Code: Log completion to cv_generation_log
    |
    v
[END]
```

**Error handling at each stage:**

| Stage | Error | Action |
|-------|-------|--------|
| Claude API call fails | Retry once after 10s. If still fails, mark job as `failed` and log error. |
| JSON parse fails | Retry the LLM call with a corrective prompt ("Your previous response was not valid JSON..."). Max 2 retries. |
| Gotenberg fails | Retry once. If still fails, skip PDF generation, produce DOCX only, flag for review. |
| Postgres write fails | Retry once. If still fails, log critical error to WF0 (Global Error Handler). |
| Workflow timeout | n8n's `EXECUTIONS_TIMEOUT=1800` (30 min) applies. If a single job takes > 10 min, log a warning. |

**Concurrency control:** The workflow processes max 5 jobs per run. With a 15-minute interval, this prevents queue buildup while staying within Claude API rate limits.

### 14.2 WF9: Document Renderer (Sub-Workflow)

**Purpose:** Takes structured CV/cover letter content and produces PDF + DOCX files.

**Input:** CV content JSON, cover letter content JSON, CV type, job_id, package_id.

**Node sequence:**

```
[1] Workflow Trigger (called by WF8)
    |
    v
[2] Switch: CV type (corporate / academic)
    |
    +-- Corporate --> [3a] Read template: /templates/cv-corporate-v1.html
    +-- Academic  --> [3b] Read template: /templates/cv-academic-v1.html
    |
    v
[4] Text Templater: Render CV HTML (Handlebars)
    Input: template + cv_content JSON
    Output: HTML string
    |
    v
[5] Convert to File: HTML string -> index.html binary
    |
    v
[6] HTTP Request: POST to Gotenberg (HTML -> PDF)
    URL: http://gotenberg:3000/forms/chromium/convert/html
    Additional form fields:
      - pdfua: true (PDF/UA compliance for accessibility)
      - metadata: {"Author": "CANDIDATE_NAME", "Creator": "Microsoft Word", "Producer": "Microsoft Word"}
    Output: PDF binary
    |
    v
[6a] Code: Sanitise PDF metadata
    -- Use exiftool or pdftk to overwrite Chromium/Gotenberg metadata:
    --   Producer: "Microsoft Word 16.0" (not "Chromium")
    --   Creator: "Microsoft Word" (not "Gotenberg")
    --   Author: Candidate's actual name
    -- This prevents recruiters from detecting AI-generated documents via metadata
    execSync(`exiftool -overwrite_original -Producer="Microsoft Word 16.0" -Creator="Microsoft Word" "${pdfPath}"`);
    |
    v
[7] Write to Disk: Save PDF
    Path: /data/generated-cvs/{job_id}/cv_{timestamp}.pdf
    |
    v
[7a] Code: Sanitise DOCX metadata (for DOCX files)
    -- Modify docProps/app.xml: Application="Microsoft Word", AppVersion="16.0"
    -- Modify docProps/core.xml: dc:creator=candidate name
    -- This is done via the docxtemplater post-processing hook or zip manipulation
    |
    v
[8] Switch: CV type (corporate / academic)
    |
    +-- Corporate --> [9a] Read template: /templates/cv-corporate-v1.docx
    +-- Academic  --> [9b] Read template: /templates/cv-academic-v1.docx
    |
    v
[10] Docxtemplater: Render DOCX
    Template: binary from [9]
    Data: cv_content JSON
    Output: DOCX binary
    |
    v
[11] Write to Disk: Save DOCX
    Path: /data/generated-cvs/{job_id}/cv_{timestamp}.docx
    |
    v
[12-17] Same pipeline for cover letter (HTML -> PDF, template -> DOCX)
    |
    v
[18] IF: Supporting statement content exists?
    |-- No  --> [22]
    |-- Yes --> [19]
    |
    v
[19] Switch: Read template /templates/supporting-statement-v1.html
    |
    v
[20] Text Templater: Render supporting statement HTML (Handlebars)
    Input: template + supporting_statement_content JSON
    - Each essential criterion rendered as a headed section
    - Each desirable criterion rendered as a headed section
    - Opening and closing paragraphs rendered as prose blocks
    Output: HTML string
    |
    v
[21a] HTTP Request: POST to Gotenberg (HTML -> PDF)
    |
    v
[21b] Docxtemplater: Render supporting statement DOCX
    Template: /templates/supporting-statement-v1.docx
    |
    v
[21c] Write to Disk: Save supporting statement PDF + DOCX
    Path: /data/generated-cvs/{job_id}/supporting_statement_{timestamp}.{pdf|docx}
    |
    v
[22] Return: File paths for all documents (4 or 6 depending on supporting statement)
```

### 14.3 WF10: Master Profile Manager

**Purpose:** Webhook-triggered workflow for managing the master profile.

**Trigger:** Webhook at `/webhook/{uuid-secret}/profile`

**Authentication:** All webhook endpoints use n8n's Header Auth with a shared secret token in the `Authorization` header. The webhook path includes a UUID-based prefix to prevent URL guessing. Rate limited to 10 requests per minute.

```
Authorization: Bearer {WEBHOOK_AUTH_TOKEN}
```

The `WEBHOOK_AUTH_TOKEN` is stored as an n8n credential and validated on every request. Requests without a valid token receive a 401 response. All webhook access is logged to the `cv_generation_log` table for audit.

**Operations:**

| Method | Path | Action |
|--------|------|--------|
| GET | `/webhook/{uuid}/profile` | Return current profile |
| PUT | `/webhook/{uuid}/profile` | Update entire profile (creates new version) |
| PATCH | `/webhook/{uuid}/profile` | Partial update (merge into existing profile) |

**Node sequence for PUT:**

```
[1] Webhook Trigger
    |
    v
[2] Postgres: Load current profile
    |
    v
[3] Code: Validate new profile against schema
    |
    v
[4] Postgres: Insert current profile into master_profile_versions
    (Snapshot before update)
    |
    v
[5] Postgres: Update master_profiles with new data, increment version
    |
    v
[6] Return: { "status": "updated", "version": new_version }
```

### 14.4 WF11: Regeneration Handler

**Purpose:** Re-generate CV packages for specific jobs, typically after a profile update or when the candidate requests a fresh tailoring.

**Trigger:** Webhook at `/webhook/{uuid-secret}/regenerate` (authenticated, same Header Auth as WF10)

**Input:** `{ "job_id": "uuid" }` or `{ "regenerate_recent": 10 }` (regenerate last N packages).

**Node sequence:**

```
[1] Webhook Trigger
    |
    v
[2] Code: Determine which jobs to regenerate
    |
    v
[3] Postgres: Archive existing cv_packages for those jobs
    (set status = 'superseded')
    |
    v
[4] Postgres: Reset jobs.cv_package_status = 'pending' for those jobs
    |
    v
[5] Return: { "status": "queued", "jobs_queued": N }
    (WF8 will pick them up on next poll)
```

### 14.5 WF12: Daily Digest Notifier

**Purpose:** Send a single daily digest email summarising all packages generated in the previous 24 hours, sorted by match score. Replaces per-job notification emails to prevent cognitive overload at 20-45 packages per week.

**Trigger:** Cron schedule, daily at 07:00 UK time.

**Node sequence:**

```
[1] Schedule Trigger (daily 07:00)
    |
    v
[2] Postgres: Query all packages with status = 'ready' and notified = false
    ORDER BY j.closing_date ASC NULLS LAST, match_percentage DESC, tier ASC
    -- Closing date takes priority: urgent deadlines surface first
    |
    v
[3] IF: Any unnotified packages?
    |-- No --> [END]
    |-- Yes --> [4]
    |
    v
[4] Code: Compose daily digest email body (HTML)
    - Summary table at top: total new packages, A-tier count, B-tier count
    - For each package (sorted by match score):
      - Job title, company, tier, match %, QA score, gap count
      - Top gap with mitigation
      - Link to review interface for this package
    - Link to review interface dashboard
    - Reminder: "Review and approve before submitting"
    |
    v
[5] Resend: Send digest email
    To: candidate email
    Subject: "Daily CV Digest: {count} new packages ready ({date})"
    Body: HTML from [4]
    (No attachments -- documents accessible via review interface)
    |
    v
[6] Postgres: Update all included cv_packages (notified = true, notified_at = NOW())
```

**Urgent notification override:** If a package has a closing date within 48 hours, WF8 triggers an immediate notification (bypassing the daily digest) so the candidate can review and submit before the deadline. This is in addition to the daily digest, not a replacement.

**Fallback:** If the candidate configures `notification_mode = 'immediate'` in preferences, WF12 reverts to per-job notifications (called as a sub-workflow from WF8 as before). Default is daily digest.

**Email body template:**

```html
<div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
    Application Package Ready
  </h2>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 6px 0; font-weight: bold; width: 120px;">Role:</td>
      <td>{{job_title}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Company:</td>
      <td>{{company}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Tier:</td>
      <td style="color: {{tier_color}};">{{tier}}-tier (Score: {{composite_score}})</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">CV Type:</td>
      <td>{{cv_type_display}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Match:</td>
      <td>{{match_percentage}}% ({{strong_matches}} strong, {{partial_matches}} partial, {{gaps}} gaps)</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">QA Score:</td>
      <td>{{qa_score}}/100</td>
    </tr>
  </table>

  {{#if gap_details}}
  <h3 style="color: #e67e22; margin-top: 16px;">Gaps to Note</h3>
  <ul style="padding-left: 20px;">
    {{#each gap_details}}
    <li style="margin-bottom: 6px;">
      <strong>{{this.requirement_text}}</strong><br>
      <span style="color: #666;">{{this.mitigation}}</span>
    </li>
    {{/each}}
  </ul>
  {{/if}}

  <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; margin: 16px 0;">
    <strong>Attached:</strong> Tailored CV (PDF) + Cover Letter (PDF)<br>
    <strong>DOCX versions:</strong> Available in the generated-cvs folder<br>
    <em>Please review before submitting. The AI does good work, but your judgment is the final check.</em>
  </div>

  <p style="color: #999; font-size: 12px; margin-top: 20px;">
    <a href="{{job_url}}">View original job listing</a> |
    Generated {{generated_at}} | Cost: ${{cost_usd}}
  </p>
</div>
```

---

## 15. Integration with Module 1

### 15.1 Trigger Mechanism

Module 2 is triggered by Module 1's scoring output. When WF5 (AI Scoring Pipeline) scores a job and assigns tier A or B, that job becomes eligible for CV tailoring.

**Integration point:** The `v_pending_cv_generation` view (Section 13.7) identifies jobs that have been scored A or B but do not yet have a `cv_packages` row. WF8 polls this view every 15 minutes.

**No direct workflow coupling.** Module 1 and Module 2 are decoupled through the database. Module 1 does not call Module 2 directly. This means:
- Module 1 can be updated without affecting Module 2
- Module 2 can be paused without affecting Module 1
- Backlog processing works naturally (if Module 2 is down for an hour, it catches up on the next poll)

### 15.2 Data Flow from Module 1

Module 2 reads the following from Module 1's tables:

| Field | Source Table | Used In |
|-------|-------------|---------|
| `job.id` | `jobs` | Foreign key in all Module 2 tables |
| `job.title` | `jobs` | JD analysis, file naming |
| `job.company` | `jobs` | JD analysis, cover letter, file naming |
| `job.location` | `jobs` | JD analysis |
| `job.description` | `jobs` | JD analysis (primary input for tailoring) |
| `job.url` | `jobs` | Notification email link |
| `job.salary_min/max` | `jobs` | JD analysis context |
| `job.job_type` | `jobs` | CV type selection (corporate/academic) |
| `job.tier` | `jobs` | Trigger filter (A/B only) |
| `job_scores.composite_score` | `job_scores` | Priority ordering |
| `job_scores.rationale` | `job_scores` | Additional context for JD analysis |
| `job_scores.red_flags` | `job_scores` | Skip generation if critical red flags |

### 15.3 Data Flow back to Module 1

Module 2 writes the following back to Module 1's tables:

| Field | Target | Purpose |
|-------|--------|---------|
| `jobs.cv_package_status` | `jobs` table | Track CV generation state |
| `jobs.status = 'applied'` | `jobs` table | When candidate marks as applied |

### 15.4 Priority Ordering

When multiple jobs are pending CV generation, they are processed in priority order:

1. A-tier before B-tier
2. Within same tier, higher composite_score first
3. Within same score, more recent discovery first

This is enforced by the `v_pending_cv_generation` view's ORDER BY clause.

### 15.5 Red Flag Handling

If Module 1's scoring identified critical red flags (ghost job, data harvesting, bait-and-switch), Module 2 skips CV generation for that job. The logic:

```sql
-- In v_pending_cv_generation, exclude jobs with critical red flags
AND NOT EXISTS (
    SELECT 1 FROM job_scores js2
    WHERE js2.job_id = j.id
    AND js2.red_flags @> '[{"severity": "critical"}]'::jsonb
)
```

### 15.6 Job Expiry Handling

If a job's status changes to 'expired' in Module 1 while Module 2 is generating a package, the generation continues (sunk cost is minimal) but the package status is set to 'expired' instead of 'ready'. No notification is sent.

---

## 16. Error Handling & Monitoring

### 16.1 Error Categories

| Category | Examples | Severity | Response |
|----------|----------|----------|----------|
| Claude API errors | Rate limit, timeout, 500 | High | Retry with backoff, queue for later |
| JSON parse failures | Malformed LLM output | Medium | Retry with corrective prompt (max 2) |
| Gotenberg failures | Container down, timeout | High | Retry once; skip PDF, generate DOCX only |
| Postgres errors | Connection lost, constraint violation | Critical | Retry once; alert via WF0 |
| Template errors | Missing template file, render failure | High | Alert via WF0; skip this job |
| Disk write errors | Permission denied, disk full | Critical | Alert via WF0; halt pipeline |
| Hallucination detected | QA finds fabricated content | Medium | Regenerate (max 2x); then flag for review |
| Content quality issues | Wrong CV type, missing sections | Medium | Regenerate with explicit instructions |

### 16.2 Retry Strategy

```
Claude API:
  - 429 (rate limit): Wait 60s, retry. Max 3 retries.
  - 500/502/503: Wait 30s, retry. Max 3 retries.
  - Timeout (>30s): Retry immediately with same prompt. Max 2 retries.

Gotenberg:
  - 500/timeout: Wait 10s, retry once.
  - Container unreachable: Skip PDF, generate DOCX only, alert admin.

Postgres:
  - Connection error: Wait 5s, retry. Max 3 retries.
  - Constraint violation: Log and skip (likely duplicate processing).

JSON parse:
  - Send corrective prompt: "Your previous response was not valid JSON.
    Please return ONLY valid JSON matching the schema. No markdown,
    no code fences, no commentary."
  - Max 2 corrective attempts.
```

### 16.3 Monitoring Dashboard Data

Module 2 exposes monitoring data through the `v_cv_generation_costs` and `v_cv_package_dashboard` views. WF7 (Module 1's Notification Dispatcher) is extended to include Module 2 stats in the weekly summary email:

- Total packages generated this week
- QA pass rate
- Average generation time
- Total Claude API cost
- Packages by status (ready, approved, applied, failed)
- Callback rate (for packages with feedback)

### 16.4 Health Check

WF8 includes a self-health check at the start of each run:

1. **Gotenberg connectivity:** HTTP GET to `http://gotenberg:3000/health`. If unhealthy, skip PDF generation for this run.
2. **Postgres connectivity:** Simple SELECT query. If failed, abort run and alert.
3. **Disk space:** Check `/data/generated-cvs/` has > 500MB free. If low, alert and continue (documents are small).
4. **Claude API:** Validated by the first API call in the pipeline. No separate health check.
5. **Template availability:** Verify `/templates/` directory contains expected template files.

### 16.5 Alerting

Critical errors trigger alerts through Module 1's WF0 (Global Error Handler):

- Email to admin
- Telegram notification (if configured)

Alert conditions:
- 3+ consecutive pipeline failures
- Gotenberg container unreachable for > 30 minutes
- Disk space < 200MB
- Claude API returning errors for > 15 minutes
- QA failure rate > 50% in last 24 hours (indicates prompt degradation)

### 16.6 Cost Monitoring

Claude API costs are tracked per stage in the `cv_generation_log` table. A weekly cost report is generated:

```sql
SELECT
    DATE_TRUNC('week', logged_at) AS week,
    stage,
    COUNT(*) AS calls,
    SUM(cost_usd) AS total_cost,
    AVG(cost_usd) AS avg_cost_per_call,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens
FROM cv_generation_log
WHERE status = 'completed'
GROUP BY DATE_TRUNC('week', logged_at), stage
ORDER BY week DESC, stage;
```

**Expected costs per package:**

| Stage | Model | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|-------|-------|-------------------|--------------------| ----------|
| JD Analysis | Haiku | ~2,000 | ~1,500 | $0.001 |
| Mapping | Haiku | ~4,000 | ~2,000 | $0.002 |
| CV Generation | Sonnet | ~6,000 | ~3,000 | $0.035 |
| Cover Letter | Sonnet | ~4,000 | ~1,000 | $0.018 |
| QA Validation | Haiku | ~5,000 | ~800 | $0.003 |
| Supporting Statement (when applicable) | Sonnet | ~5,000 | ~2,000 | $0.030 |
| **Total per package (without supporting statement)** | | | | **~$0.059** |
| **Total per package (with supporting statement)** | | | | **~$0.089** |

At 30 packages/week (assuming ~20% include supporting statements): ~$1.95/week = ~$8.45/month. Well within the GBP 30/month budget.

---

## 17. Privacy & Compliance

### 17.1 GDPR Considerations

The system processes personal data (the candidate's master profile). Since this is a single-user system where the candidate is also the system operator, GDPR compliance is straightforward but still worth documenting.

**Data processed:**
- Candidate's personal details (name, email, phone, location)
- Employment history
- Qualifications
- Publications
- Referee contact details

**Legal basis:** Legitimate interest (the candidate's own interest in applying for jobs).

**Data controller:** The candidate herself.

**Data processor:** Anthropic (Claude API), Resend (email), Hetzner (hosting).

### 17.2 Claude API Data Handling and International Data Transfer

Anthropic's API terms (as of March 2026):
- Anthropic does not train on API inputs/outputs (confirmed in their usage policy)
- API data is retained for up to 30 days for trust and safety purposes
- No human review of API data unless flagged by automated systems

**International Data Transfer (UK GDPR):** Sending the master profile to Anthropic's US-based API constitutes an international data transfer. The legal mechanism for this transfer must be documented:
- Verify that Anthropic's API terms include Standard Contractual Clauses (SCCs) or reference the EU-US Data Privacy Framework
- Review and sign Anthropic's Data Processing Addendum (DPA)
- Document the transfer mechanism in the system's data processing records
- If no adequate transfer mechanism exists, implement a data proxy that strips PII before sending to Claude and re-injects it post-generation

**Mitigation:** The master profile sent to Claude contains personal details. To minimise exposure:
- Use Claude's API (not the web interface) -- API has stronger data handling guarantees
- Do not include referee contact details in the profile data sent to Claude (referees are added post-generation from the template)
- Do not include full postal addresses (city/region only)
- Redact phone number and email from the profile data sent to Claude (these are not needed for CV content generation; they are added from the template)
- Use initials or a placeholder instead of the candidate's full name in Claude API calls where possible (full name is added in the template rendering stage)

### 17.3 Data Retention

| Data | Retention Period | Reason |
|------|-----------------|--------|
| Master profile | Indefinite (active use) | Needed for ongoing CV generation |
| Generated CVs/cover letters | 6 months after job expiry | Reference for future applications |
| JD analyses | 6 months after job expiry | Reference for pattern analysis |
| QA reports | 6 months after job expiry | Quality trend analysis |
| Generation logs | 3 months | Debugging and cost tracking |
| Archived profile versions | 12 months | Rollback capability |

**Cleanup workflow:** Add a monthly cron job to WF6 (Dedup & Cleanup) that:
- Deletes generated files for jobs expired > 6 months ago
- Deletes cv_generation_log entries older than 3 months
- Archives (but does not delete) cv_packages rows for jobs expired > 6 months

### 17.4 Referee Data Protection

Referee contact details are sensitive. They are:
- Stored in the master profile but in a separate `referees` section
- NOT sent to Claude API (added to templates after generation)
- Only included in academic CV output (where named referees are expected)
- Corporate CVs use "References available on request" by default

### 17.5 Generated Document Security

Generated PDFs and DOCX files are stored on the Hetzner server's local filesystem. Access is limited to:
- n8n workflows (read/write)
- SSH access to the server (admin only)

Files are not exposed to the internet. The notification email includes the documents as attachments, not as download links.

### 17.6 Database Backup Strategy

The `selvi_jobs` database contains irreplaceable application history, feedback data, and the master profile. A single-server setup with no backup is unacceptable.

**Automated backup schedule:**

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Full database dump | Daily at 02:00 UTC | 30 days | `pg_dump` to compressed file |
| WAL archiving | Continuous | 7 days | PostgreSQL WAL archiving to local directory |
| Off-site copy | Daily at 03:00 UTC | 14 days | `rclone` sync to Hetzner Storage Box (separate server) |
| Generated documents | Weekly | 90 days | `tar` archive of `/data/generated-cvs/` to Storage Box |

**Implementation (cron job on Hetzner server):**

```bash
#!/bin/bash
# /opt/selvi-backup.sh -- runs daily at 02:00 UTC via cron
BACKUP_DIR="/backups/selvi-jobs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Full database dump
docker exec selvi-postgres pg_dump -U selvi_user selvi_jobs | gzip > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

# Remove backups older than retention period
find "${BACKUP_DIR}" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Off-site sync (Hetzner Storage Box via SFTP)
rclone sync "${BACKUP_DIR}" hetzner-storage:selvi-backups/db/ --max-age 14d

# Weekly document archive (runs on Sundays only)
if [ "$(date +%u)" -eq 7 ]; then
  tar czf "${BACKUP_DIR}/docs_${TIMESTAMP}.tar.gz" /data/generated-cvs/
  rclone copy "${BACKUP_DIR}/docs_${TIMESTAMP}.tar.gz" hetzner-storage:selvi-backups/docs/
fi
```

**Recovery procedure:**
1. Restore database: `gunzip -c db_YYYYMMDD.sql.gz | docker exec -i selvi-postgres psql -U selvi_user selvi_jobs`
2. Restore documents: `tar xzf docs_YYYYMMDD.tar.gz -C /data/`
3. Verify: Run WF8 health check to confirm connectivity and template availability

**Monitoring:** The backup script logs to `/var/log/selvi-backup.log`. A weekly check in WF0 verifies that the most recent backup is less than 48 hours old; if not, an alert is sent.

### 17.7 Incident Response Plan

In the event of a data breach or security incident involving the candidate's personal data:

**Detection:**
- Monitor server access logs for unauthorised SSH connections
- WF0 alerts on unexpected database access patterns
- Hetzner firewall logs for blocked intrusion attempts

**Response procedure (within 24 hours of detection):**

| Step | Action | Timeframe |
|------|--------|-----------|
| 1 | Contain: Disable external API access (revoke Claude API key, disable webhook endpoints) | Immediate |
| 2 | Assess: Determine what data was accessed (master profile, generated documents, application history) | Within 4 hours |
| 3 | Document: Record the incident details, timeline, and scope | Within 8 hours |
| 4 | Notify: If personal data of third parties (referees) was exposed, notify affected individuals | Within 48 hours |
| 5 | Report: If UK GDPR applies and the breach poses a risk to rights and freedoms, report to ICO within 72 hours | Within 72 hours |
| 6 | Remediate: Rotate all credentials (DB password, API keys, webhook tokens), patch vulnerability | Within 24 hours |
| 7 | Review: Post-incident review to prevent recurrence | Within 7 days |

**ICO reporting threshold:** Since this is a single-user system where the candidate is the data controller, ICO notification is only required if third-party data (referee details) is compromised. The master profile contains referee names, titles, emails, and phone numbers -- this is the primary breach risk.

**Contact details:** ICO helpline: 0303 123 1113. Online reporting: https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/

### 17.8 Equality Act 2010 Compliance

The CV templates are designed to exclude information that could enable discrimination:
- No photograph
- No date of birth
- No marital status
- No nationality (right-to-work mentioned only in cover letter if configured)
- No gender indicators
- No religion
- Location is city/region only (no full postal address)

The system includes automated checks (Section 12.2) to verify no protected characteristic data appears in generated documents.

---

## 18. Rollout Plan

### 18.1 Phase Overview

| Phase | Duration | Goal | Success Gate |
|-------|----------|------|-------------|
| Phase 0: Infrastructure | 2-3 days | Set up Gotenberg, community nodes, database tables | Gotenberg converts test HTML to PDF; docxtemplater renders test DOCX |
| Phase 1: Master Profile | 3-4 days | Build and populate the master profile | Profile passes schema validation; contains all experience with tags |
| Phase 2: JD Analysis | 2-3 days | Stage 1 pipeline working | 10 real JDs analysed with correct extraction; validated manually |
| Phase 3: Mapping + Generation | 5-7 days | Stages 2-3 pipeline working | 10 tailored CVs generated; candidate rates 8/10 quality on average |
| Phase 4: QA Pipeline | 2-3 days | Stage 4 validation working | Zero hallucinations detected in first 20 generated CVs |
| Phase 5: Document Rendering | 3-4 days | PDF/DOCX generation working | Documents render correctly on A4; ATS-parseable |
| Phase 6: Notifications | 1-2 days | Email notifications working | Candidate receives email with attachments for each generated package |
| Phase 7: Integration Test | 3-5 days | Full pipeline end-to-end | Module 1 scores a job -> Module 2 generates package -> candidate receives email. 20 jobs tested. |
| Phase 8: Tuning | 5-7 days | Prompt tuning based on candidate feedback | Candidate approves 60%+ packages without edits |

**Total estimated timeline: 26-38 days**

### 18.2 Phase 0: Infrastructure Setup

**Tasks:**

1. Deploy Gotenberg 8 container alongside n8n in Dokploy
   - Add to docker-compose
   - Verify ARM64 image runs on CAX31
   - Test health endpoint: `curl http://gotenberg:3000/health`

2. Install n8n community nodes
   - `n8n-nodes-text-templater`
   - `n8n-nodes-docxtemplater`
   - `n8n-nodes-resend` (if not already installed from Module 1)

3. Create database tables
   - Run SQL from Section 13 against `selvi_jobs` database
   - Verify foreign key relationships to existing `jobs` table
   - Create views

4. Set up file storage
   - Create `/templates/` directory on host, mount into n8n container
   - Create `/data/generated-cvs/` directory with write permissions
   - Set n8n binary data mode to filesystem (if not already done)

5. Configure Claude API credentials in n8n
   - Add Anthropic API key as n8n credential
   - Verify API access with a test call

**Success gate:** Gotenberg converts a test HTML file to PDF. docxtemplater renders a test DOCX. Database tables exist and accept inserts.

### 18.3 Phase 1: Master Profile Build

**Tasks:**

1. Collect raw materials from candidate
   - Current corporate CV
   - Current academic CV
   - LinkedIn profile data
   - List of publications with full citations
   - Teaching experience details
   - List of achievements with exact metrics
   - Referee details

2. Encode master profile in JSON
   - Follow schema from Section 6.2
   - Tag every experience item with domain, skills, and priority
   - Write summary variants (corporate, academic, general)
   - Write CIPD equivalency statements
   - Populate keyword bank

3. Insert into Postgres
   - Create `master_profiles` row
   - Validate with `profile_data::jsonb`
   - Test JSONB queries against the profile

4. Build WF10 (Master Profile Manager)
   - Webhook for profile CRUD
   - Version tracking

**Success gate:** Profile passes JSON schema validation. Contains 20+ tagged highlights. All three summary variants written. CIPD equivalency statements reviewed and approved by candidate.

### 18.4 Phase 2: JD Analysis Pipeline

**Tasks:**

1. Build JD analysis prompt (Section 7.4)
2. Create first portion of WF8 (nodes 1-12)
3. Test against 10 real job descriptions from Module 1's database
4. Validate extraction accuracy with candidate review
5. Tune prompt based on extraction errors

**Success gate:** 10 JDs analysed. Extraction matches manual reading in 90%+ of requirements identified. CIPD requirements correctly flagged. Corporate vs academic classification correct for all 10.

### 18.5 Phase 3: Mapping and CV Generation

**Tasks:**

1. Build mapping prompt (Section 8.2)
2. Build CV generation prompts (Section 8.3, both corporate and academic)
3. Extend WF8 (nodes 13-24)
4. Generate 10 tailored CVs (mix of corporate and academic)
5. Candidate reviews each one, provides ratings and notes
6. Iterate on prompts based on feedback

**Success gate:** 10 CVs generated. Candidate rates average 8/10 quality. No hallucinated content. Corporate CVs are 2 pages. Academic CVs are 3-5 pages. Keywords from JD are naturally incorporated.

### 18.6 Phase 4: QA Pipeline

**Tasks:**

1. Build hallucination detection prompt (Section 12.3)
2. Build programmatic checks (keyword coverage, UK English, word count)
3. Extend WF8 (nodes 25-31)
4. Run QA against 20 previously generated CVs
5. Verify QA catches intentionally planted errors (inject a fabricated bullet point and confirm detection)

**Success gate:** QA pipeline correctly identifies 100% of intentionally planted hallucinations. Auto-corrects UK English. Keyword coverage calculation matches manual count.

### 18.7 Phase 5: Document Rendering

**Tasks:**

1. Create HTML templates (Section 11.2, 11.3, 11.4)
2. Create DOCX templates
3. Build WF9 (Document Renderer sub-workflow)
4. Generate PDF and DOCX for 10 test packages
5. Verify:
   - Corporate CV fits on 2 A4 pages
   - Academic CV renders cleanly on 3-5 pages
   - Cover letter fits on 1 page (corporate) or 1-2 pages (academic)
   - Fonts render correctly
   - ATS parsers can extract text from generated PDFs
   - DOCX opens correctly in Word/LibreOffice

**Success gate:** 10 document sets render without errors. PDFs are A4, properly paginated, and ATS-parseable. DOCX files open correctly.

### 18.8 Phase 6: Notifications

**Tasks:**

1. Build WF12 (Notifier sub-workflow)
2. Configure Resend with notification templates
3. Test email delivery with attachments
4. Verify email renders correctly on mobile and desktop

**Success gate:** Test emails arrive within 30 seconds. Attachments are downloadable. Email body is informative and mobile-readable.

### 18.9 Phase 7: Integration Test

**Tasks:**

1. End-to-end test: Let Module 1 score jobs naturally, verify Module 2 picks them up
2. Process 20 real A/B-tier jobs through the full pipeline
3. Measure timing: from Module 1 scoring to email notification
4. Verify database consistency: all tables properly linked
5. Test error scenarios:
   - What happens when Gotenberg is down?
   - What happens when Claude API returns an error?
   - What happens when a JD has minimal text?
   - What happens when the same job is scored twice?

**Success gate:** 20 jobs processed end-to-end. 95%+ success rate. Average time from scoring to notification < 20 minutes. All error scenarios handled gracefully.

### 18.10 Phase 8: Tuning

**Tasks:**

1. Candidate uses generated packages for real applications for 2 weeks
2. Collect feedback: ratings, edit notes, callback data
3. Tune prompts based on feedback patterns
4. Adjust templates based on rendering feedback
5. Optimise for most common feedback themes

**Tuning targets:**
- 60%+ packages approved without edits
- 30% packages approved with minor edits
- < 10% packages rejected
- 80%+ callback rate on automated applications

**Success gate:** After 2 weeks of tuning, the candidate trusts the system enough to use it as her primary application tool, reviewing rather than rewriting.

### 18.11 Post-Launch Monitoring

After Phase 8, the system enters steady-state operation. Ongoing monitoring:

- Weekly review of callback rates (manual tracking by candidate)
- Monthly prompt review if callback rate drops below 75%
- Monthly cost review
- Quarterly template refresh (if CV conventions evolve)
- Profile updates as candidate gains new experience or publications

---

## 19. Review & Approval Interface

### 19.1 Purpose

The review interface is the candidate's primary interaction point with Module 2. Without it, the system generates documents but provides no practical way to approve, reject, rate, edit, or track applications. This section addresses the single biggest gap identified in the v1 evaluation: the entire user-facing experience was undefined.

### 19.2 Architecture

The review interface is a lightweight static web application served by n8n's webhook system. It communicates with the backend through authenticated webhook endpoints (same authentication as WF10/WF11).

```
Candidate (Browser)
    |
    v
Static HTML/JS app (served from /templates/review-ui/)
    |
    v
Authenticated webhook endpoints:
    GET  /webhook/{uuid}/packages          -- list all packages with filters
    GET  /webhook/{uuid}/packages/{id}     -- single package detail
    POST /webhook/{uuid}/packages/{id}/approve   -- approve package
    POST /webhook/{uuid}/packages/{id}/reject    -- reject package
    POST /webhook/{uuid}/packages/{id}/feedback  -- rate + notes
    POST /webhook/{uuid}/packages/{id}/outcome   -- record application outcome
    GET  /webhook/{uuid}/packages/{id}/files/{type}?token={download_token}  -- download PDF/DOCX (token-based auth for browser compatibility)
    POST /webhook/{uuid}/packages/{id}/inline-edit  -- edit CV/cover letter text inline
    POST /webhook/{uuid}/jobs/{id}/notes   -- add personal context before generation
```

### 19.3 Dashboard View

The main dashboard shows all packages in a sortable/filterable table:

| Column | Source |
|--------|--------|
| Date | cv_packages.created_at |
| Job Title | jobs.title |
| Company | jobs.company |
| Tier | jobs.tier |
| Match % | cv_packages.match_percentage |
| QA Score | cv_packages.qa_score |
| Gaps | cv_packages.gaps |
| Status | cv_packages.status |
| Rating | cv_packages.candidate_rating |
| Outcome | cv_packages.application_outcome |

**Filters:** Status (ready/approved/applied/rejected), Tier (A/B), CV Type (corporate/academic), Date range.

**Sort:** Default by match_percentage DESC. Sortable by any column.

### 19.4 Package Detail View

For each package, the detail view shows:

1. **Job summary:** Title, company, tier, salary, link to original listing
2. **Match summary:** Strong matches, partial matches, gaps with mitigation suggestions
3. **Keyword coverage:** Which JD keywords were incorporated, which were omitted with reasons
4. **CV preview:** Rendered HTML preview of the tailored CV (same HTML used for PDF generation)
5. **Cover letter / supporting statement preview:** Rendered HTML preview
6. **Source traceability:** For each CV claim, the original profile text it maps to (human-readable, not JSON)
7. **Download buttons:** CV PDF, CV DOCX, Cover Letter PDF, Cover Letter DOCX, Supporting Statement PDF/DOCX (if applicable)
8. **Action buttons:** Approve, Approve with Notes, Reject, Regenerate
9. **Feedback form:** 1-5 rating, free-text notes, specific section feedback
10. **Outcome tracking:** Applied (with date), Callback Received (with date), Interview, Offer, Rejection
11. **Inline editing:** Click any text block in the CV or cover letter preview to edit directly. Changes are saved to the cv_packages content JSON and trigger a re-render of PDF/DOCX via WF9. Edited packages have status changed to `approved_edited` automatically.

**Inline editing implementation:**
- The CV preview renders each content block (summary, bullet point, paragraph) as a `contenteditable` div with a `data-path` attribute mapping to the JSON field path (e.g., `experience[0].achievements[2]`)
- On blur or Ctrl+S, the modified text is sent via `POST /webhook/{uuid}/packages/{id}/inline-edit` with the JSON path and new value
- WF13 updates the `cv_content` or `cover_letter_content` JSONB field at the specified path
- WF9 is triggered as a sub-workflow to re-render PDF/DOCX with the updated content
- The audit log records the previous and new values for every inline edit
- Changes are non-destructive: the original AI-generated content is preserved in the audit trail

### 19.5 Personal Context Injection

For jobs that have been scored by Module 1 but not yet processed by Module 2, the candidate can add personal context through the review interface or via the webhook:

```
POST /webhook/{uuid}/jobs/{job_id}/notes
{
  "candidate_notes": "I met their Head of L&D at the CIPD annual conference in November. She mentioned they were restructuring the team.",
  "priority_override": "high"
}
```

These notes are stored in a `candidate_job_notes` field on the jobs table and passed to the cover letter generation prompt (Section 9.4). If notes are added after generation, the candidate can trigger regeneration from the detail view.

The review interface shows pending A/B-tier jobs that have not yet been generated, allowing the candidate to:
- Add personal context before generation
- Skip generation for specific jobs ("not interested")
- Prioritise specific jobs for immediate generation

### 19.6 Application Lifecycle Tracking

The review interface supports recording the full application lifecycle:

| Status | How Recorded | Data Stored |
|--------|-------------|-------------|
| Ready | Automatic (pipeline completion) | cv_packages.status |
| Approved | Candidate clicks "Approve" | status, approved_at |
| Approved with edits | Candidate clicks "Approve" + notes | status, candidate_notes |
| Rejected | Candidate clicks "Reject" + reason | status, rejection_reason |
| Applied | Candidate clicks "Mark as Applied" + date | status, applied_date |
| Callback | Candidate clicks "Callback Received" + date | callback_received, callback_date |
| Interview | Candidate records interview date | interview_date |
| Offer | Candidate records offer | offer_received |
| Rejection (by employer) | Candidate records rejection | employer_rejection |

This data enables the primary success metric (callback rate) to be measured accurately, segmented by CV type, tier, and whether the package was edited before submission.

### 19.7 WF13: Review Interface Backend

**Purpose:** Webhook-triggered workflow serving the review interface API.

**Trigger:** Webhook at `/webhook/{uuid}/packages` (all methods)

**Authentication:** Header Auth with WEBHOOK_AUTH_TOKEN (same as WF10/WF11).

**Node sequence (for GET /packages):**

```
[1] Webhook Trigger
    |
    v
[2] Code: Parse request (method, path, query params)
    |
    v
[3] Postgres: Query v_cv_package_dashboard with filters
    |
    v
[4] Return: JSON response with package list
```

**Node sequence (for POST /packages/{id}/feedback):**

```
[1] Webhook Trigger
    |
    v
[2] Code: Validate input (rating 1-5, notes text)
    |
    v
[3] Postgres: UPDATE cv_packages SET candidate_rating = ?, candidate_notes = ?, status = ? WHERE id = ?
    |
    v
[4] Return: { "status": "updated" }
```

### 19.7b Audit Log for Review Actions

All status changes and review actions are logged to a dedicated audit table for compliance and visa/legal traceability. Previous status values are never overwritten -- they are preserved in the audit trail.

**Table: review_audit_log**

```sql
CREATE TABLE review_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES cv_packages(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL
        CHECK (action IN (
            'status_change', 'rating_submitted', 'notes_added',
            'feedback_submitted', 'outcome_recorded', 'file_downloaded',
            'regeneration_requested', 'inline_edit_saved'
        )),
    previous_value JSONB,  -- snapshot of changed fields before the action
    new_value JSONB,       -- snapshot of changed fields after the action
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_audit_package ON review_audit_log(package_id);
CREATE INDEX idx_review_audit_time ON review_audit_log(performed_at DESC);
```

Every WF13 endpoint that modifies cv_packages data inserts an audit row before performing the update. The audit log enables:
- Full application history reconstruction for visa applications
- Compliance evidence for any dispute about application dates
- Debugging of unexpected status transitions

### 19.7c Feedback Analysis Dashboard

The review interface includes a "Trends" tab that provides automated analysis of collected feedback data. This closes the loop between feedback collection and system improvement.

**Metrics displayed:**

| Metric | Calculation | Alert Threshold |
|--------|-------------|-----------------|
| Average rating (rolling 30 days) | AVG(candidate_rating) | Alert if < 3.5 |
| Rating trend | Linear regression on last 30 ratings | Alert if negative slope > -0.1/week |
| Approval-without-edit rate | COUNT(approved) / COUNT(approved + approved_edited) | Alert if < 50% |
| Callback rate by CV type | Callbacks / applications, grouped by cv_type | Alert if < 60% for any type |
| Callback rate by tier | Callbacks / applications, grouped by tier | Informational only |
| Most common edit patterns | Text diff analysis of inline edits | Surfaces recurring changes for prompt tuning |
| QA score vs. candidate rating correlation | Pearson correlation | If low, QA pipeline may not predict quality |

**Weekly feedback digest (WF14):**

A new weekly workflow (triggered Sunday 20:00) analyses the past week's feedback and generates a summary:

```
[1] Schedule Trigger (weekly Sunday 20:00)
    |
    v
[2] Postgres: Query all rated packages from last 7 days
    |
    v
[3] Code: Calculate metrics (average rating, approval rate, edit patterns)
    |
    v
[4] IF: Average rating < 3.5 OR approval-without-edit rate < 50%?
    |-- Yes --> [5] Code: Extract common edit patterns from audit log
    |           Identify recurring text changes that suggest prompt improvements
    |-- No  --> [6]
    |
    v
[6] Resend: Send weekly feedback summary email
    Subject: "Weekly Feedback Summary: avg {rating}/5, {approval_rate}% approval"
```

### 19.8 Implementation Approach

The review UI is implemented as a single HTML file with embedded JavaScript (no build toolchain required). It uses:
- Vanilla JavaScript with `fetch()` for API calls
- Simple CSS (Calibri font family, matching CV template aesthetics)
- Responsive layout for mobile review on the go
- Offline resilience via localStorage caching: on each successful API fetch, the package list and last-viewed package detail are cached in localStorage. If the API is unreachable (detected by fetch timeout after 5 seconds), the UI displays the cached data with an "Offline -- showing cached data" banner. Approval/rejection actions are queued in localStorage and synced when connectivity resumes.
- Served as a static file from n8n's webhook system or from the `/templates/review-ui/` volume mount

This is deliberately minimal. A full React/Vue application is over-engineering for a single-user system. The HTML file can be opened directly in a browser with the webhook URL as a parameter.

**Authentication for file downloads:** Browser-initiated file downloads (clicking "Download PDF") cannot use the `Authorization` header because the browser opens a new request for the file URL. To solve this, file download endpoints accept a `token` query parameter as an alternative to the header auth. The token is a short-lived (1 hour) HMAC-SHA256 signature of the package ID + file type + timestamp, generated by the review UI's JavaScript from the stored auth token. This avoids exposing the main auth token in URLs while enabling direct browser downloads and deep links.

```javascript
// Token generation in review UI JavaScript
function generateDownloadToken(packageId, fileType) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${packageId}:${fileType}:${timestamp}`;
  // HMAC using the WEBHOOK_AUTH_TOKEN stored in the app's config
  const token = hmacSHA256(payload, WEBHOOK_AUTH_TOKEN);
  return `${token}:${timestamp}`;
}
```

The WF13 backend validates the download token by recomputing the HMAC and checking that the timestamp is within 1 hour. Expired or invalid tokens return 401.

---

## Appendix A: Complete SQL Migration Script

```sql
-- Module 2: CV Tailoring System -- Database Migration
-- Run against selvi_jobs database
-- Requires: uuid-ossp extension (already installed from Module 1)
-- Requires: update_updated_at_column() function (already exists from Module 1)

BEGIN;

-- ============================================================
-- Table: master_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS master_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id VARCHAR(50) NOT NULL UNIQUE,
    profile_data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_master_profiles_updated_at
    BEFORE UPDATE ON master_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_master_profiles_candidate ON master_profiles(candidate_id);

-- ============================================================
-- Table: master_profile_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS master_profile_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES master_profiles(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    profile_data JSONB NOT NULL,
    change_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_profile_version UNIQUE (profile_id, version)
);

CREATE INDEX idx_profile_versions_profile ON master_profile_versions(profile_id);

-- ============================================================
-- Table: jd_analyses
-- ============================================================
CREATE TABLE IF NOT EXISTS jd_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    cv_type_recommended VARCHAR(20) NOT NULL
        CHECK (cv_type_recommended IN ('corporate_ld', 'academic', 'hybrid')),
    essential_requirements_count INTEGER,
    desirable_requirements_count INTEGER,
    implicit_requirements_count INTEGER,
    total_keywords_count INTEGER,
    cipd_required BOOLEAN DEFAULT false,
    cipd_level_minimum INTEGER,
    model_used VARCHAR(100) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),
    processing_time_ms INTEGER,
    analysed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_jd_analysis UNIQUE (job_id)
);

CREATE INDEX idx_jd_analyses_job ON jd_analyses(job_id);
CREATE INDEX idx_jd_analyses_cv_type ON jd_analyses(cv_type_recommended);

-- ============================================================
-- Table: cv_packages
-- ============================================================
CREATE TABLE IF NOT EXISTS cv_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    jd_analysis_id UUID REFERENCES jd_analyses(id),
    profile_id UUID REFERENCES master_profiles(id),
    profile_version INTEGER NOT NULL,
    cv_type VARCHAR(20) NOT NULL
        CHECK (cv_type IN ('corporate_ld', 'academic', 'hybrid')),
    mapping_data JSONB,
    cv_content JSONB,
    cover_letter_content JSONB,
    qa_report JSONB,
    qa_score INTEGER CHECK (qa_score BETWEEN 0 AND 100),
    qa_pass BOOLEAN,
    hallucination_score INTEGER CHECK (hallucination_score BETWEEN 0 AND 100),
    keyword_coverage_pct INTEGER CHECK (keyword_coverage_pct BETWEEN 0 AND 100),
    match_percentage INTEGER CHECK (match_percentage BETWEEN 0 AND 100),
    strong_matches INTEGER DEFAULT 0,
    partial_matches INTEGER DEFAULT 0,
    gaps INTEGER DEFAULT 0,
    gap_summary TEXT,
    cv_pdf_path TEXT,
    cv_docx_path TEXT,
    cover_letter_pdf_path TEXT,
    cover_letter_docx_path TEXT,
    template_version VARCHAR(20),
    status VARCHAR(30) DEFAULT 'generating'
        CHECK (status IN (
            'generating', 'qa_failed', 'qa_review', 'ready',
            'approved', 'approved_edited', 'rejected', 'applied',
            'expired', 'superseded'
        )),
    notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,
    candidate_rating INTEGER CHECK (candidate_rating BETWEEN 1 AND 5),
    candidate_notes TEXT,
    callback_received BOOLEAN,
    callback_date DATE,
    generation_attempts INTEGER DEFAULT 1,
    total_generation_time_ms INTEGER,
    total_cost_usd NUMERIC(10, 6),
    stage1_model VARCHAR(100),
    stage1_tokens_in INTEGER,
    stage1_tokens_out INTEGER,
    stage1_cost NUMERIC(10, 6),
    stage2_model VARCHAR(100),
    stage2_tokens_in INTEGER,
    stage2_tokens_out INTEGER,
    stage2_cost NUMERIC(10, 6),
    stage3_model VARCHAR(100),
    stage3_tokens_in INTEGER,
    stage3_tokens_out INTEGER,
    stage3_cost NUMERIC(10, 6),
    stage4_model VARCHAR(100),
    stage4_tokens_in INTEGER,
    stage4_tokens_out INTEGER,
    stage4_cost NUMERIC(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_cv_packages_updated_at
    BEFORE UPDATE ON cv_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_cv_packages_job ON cv_packages(job_id);
CREATE INDEX idx_cv_packages_status ON cv_packages(status);
CREATE INDEX idx_cv_packages_ready ON cv_packages(status) WHERE status = 'ready';
CREATE INDEX idx_cv_packages_not_notified ON cv_packages(notified)
    WHERE notified = false AND status = 'ready';
CREATE INDEX idx_cv_packages_created ON cv_packages(created_at DESC);
CREATE INDEX idx_cv_packages_callback ON cv_packages(callback_received)
    WHERE callback_received IS NOT NULL;

-- ============================================================
-- Table: cv_generation_log
-- ============================================================
CREATE TABLE IF NOT EXISTS cv_generation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES cv_packages(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id),
    stage VARCHAR(20) NOT NULL
        CHECK (stage IN ('jd_analysis', 'mapping', 'cv_generation',
                         'cover_letter', 'qa_validation', 'document_render',
                         'notification', 'error')),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('started', 'completed', 'failed', 'retrying')),
    attempt_number INTEGER DEFAULT 1,
    model_used VARCHAR(100),
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),
    duration_ms INTEGER,
    error_message TEXT,
    error_details JSONB,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_log_package ON cv_generation_log(package_id);
CREATE INDEX idx_gen_log_job ON cv_generation_log(job_id);
CREATE INDEX idx_gen_log_stage ON cv_generation_log(stage);
CREATE INDEX idx_gen_log_errors ON cv_generation_log(status) WHERE status = 'failed';
CREATE INDEX idx_gen_log_time ON cv_generation_log(logged_at DESC);

-- ============================================================
-- Alter Module 1 jobs table
-- ============================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cv_package_status VARCHAR(20) DEFAULT NULL
    CHECK (cv_package_status IN (NULL, 'pending', 'generating', 'ready',
                                  'approved', 'applied', 'failed'));

CREATE INDEX IF NOT EXISTS idx_jobs_cv_status ON jobs(cv_package_status)
    WHERE cv_package_status IS NOT NULL;

-- ============================================================
-- Views
-- ============================================================
CREATE OR REPLACE VIEW v_pending_cv_generation AS
SELECT
    j.id AS job_id,
    j.title,
    j.company,
    j.tier,
    j.job_type,
    j.description,
    j.url,
    j.salary_min,
    j.salary_max,
    j.location,
    j.discovered_at,
    js.composite_score,
    js.rationale
FROM jobs j
JOIN job_scores js ON j.id = js.job_id
LEFT JOIN cv_packages cp ON j.id = cp.job_id AND cp.status != 'superseded'
WHERE j.status = 'active'
  AND js.tier IN ('A', 'B')
  AND cp.id IS NULL
  AND j.cv_package_status IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM job_scores js2
      WHERE js2.job_id = j.id
      AND js2.red_flags @> '[{"severity": "critical"}]'::jsonb
  )
ORDER BY
    CASE js.tier WHEN 'A' THEN 1 ELSE 2 END,
    js.composite_score DESC;

CREATE OR REPLACE VIEW v_cv_package_dashboard AS
SELECT
    cp.id AS package_id,
    j.title AS job_title,
    j.company,
    j.tier,
    j.url AS job_url,
    cp.cv_type,
    cp.status,
    cp.qa_score,
    cp.match_percentage,
    cp.keyword_coverage_pct,
    cp.strong_matches,
    cp.partial_matches,
    cp.gaps,
    cp.gap_summary,
    cp.candidate_rating,
    cp.callback_received,
    cp.total_cost_usd,
    cp.generation_attempts,
    cp.created_at,
    cp.notified_at
FROM cv_packages cp
JOIN jobs j ON cp.job_id = j.id
WHERE cp.status != 'superseded'
ORDER BY cp.created_at DESC;

CREATE OR REPLACE VIEW v_cv_generation_costs AS
SELECT
    DATE(logged_at) AS generation_date,
    COUNT(DISTINCT package_id) AS packages_generated,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) FILTER (WHERE stage = 'cv_generation') AS avg_cv_gen_cost,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    AVG(duration_ms) AS avg_duration_ms
FROM cv_generation_log
WHERE status = 'completed'
GROUP BY DATE(logged_at)
ORDER BY generation_date DESC;

COMMIT;
```

---

## Appendix B: n8n Community Packages Required

| Package | Version | Purpose |
|---------|---------|---------|
| `n8n-nodes-text-templater` | 1.2.0 | Handlebars template rendering for HTML CV generation (pinned -- test before upgrading) |
| `n8n-nodes-docxtemplater` | 1.0.3 | DOCX template rendering from Word templates (pinned -- test before upgrading) |
| `n8n-nodes-resend` | 0.3.1 | Email notifications via Resend API (pinned -- test before upgrading) |

**Version pinning policy:** All community node versions are pinned to tested versions. Before upgrading, run the full integration test suite (Phase 7 tests) against the new version in a staging environment. Community nodes update automatically on container restart if versions are not pinned, which can cause silent breakage in PDF/DOCX rendering.

Install via n8n Settings > Community Nodes, or via environment variable:

```env
N8N_COMMUNITY_PACKAGES=n8n-nodes-text-templater,n8n-nodes-docxtemplater,n8n-nodes-resend
```

---

## Appendix C: Docker Compose Addition

```yaml
# Add to existing Dokploy docker-compose.yml

gotenberg:
  image: gotenberg/gotenberg:8
  restart: unless-stopped
  ports:
    - "127.0.0.1:3000:3000"
  command:
    - "gotenberg"
    - "--api-timeout=60s"
    - "--chromium-disable-javascript=true"
    - "--chromium-allow-list=file:///tmp/.*"
  environment:
    - GOTENBERG_API_TIMEOUT=60s
  networks:
    - app-network
  deploy:
    resources:
      limits:
        memory: 1024M   # Increased from 512M to handle academic CVs (3-5 pages) and supporting statements (2-4 pages) without OOM
      reservations:
        memory: 512M
```

---

## Appendix D: Configuration Checklist

| Item | Value | Status |
|------|-------|--------|
| Gotenberg Docker image | `gotenberg/gotenberg:8` | |
| Gotenberg internal URL | `http://gotenberg:3000` | |
| n8n binary data mode | `filesystem` | |
| Template volume mount | `./templates:/templates:ro` | |
| Generated CV volume mount | `./data/generated-cvs:/data/generated-cvs` | |
| Claude API key | Stored in n8n credentials | |
| Resend API key | Stored in n8n credentials | |
| Candidate email | Configured in notification workflow | |
| Master profile candidate_id | `selvi-001` | |
| WF8 poll interval | Every 15 minutes | |
| Max jobs per WF8 run | 5 | |
| QA retry limit | 2 regeneration attempts | |
| Claude Haiku model | `claude-haiku-4-5` | |
| Claude Sonnet model | `claude-sonnet-4-5` | |
| Haiku temperature (extraction) | 0.0 | |
| Haiku temperature (mapping) | 0.1 | |
| Sonnet temperature (CV gen) | 0.15 | |
| Sonnet temperature (cover letter) | 0.25 | |
| Sonnet temperature (QA) | 0.0 | |
| Corporate CV word target | 450-550 words | |
| Corporate cover letter word target | 250-400 words | |
| Academic cover letter word target | 400-800 words | |
| Keyword coverage target | 75-85% | |
| QA pass threshold | Score >= 95, zero critical issues | |
| Monthly Claude API budget | GBP 30 | |

---

## 22. 50-Round Critical Roleplay Evaluation (v1)

**Evaluation Date:** 2026-03-29
**PRD Version Evaluated:** 1.0
**Methodology:** 5 personas x 10 rounds each = 50 independent critical evaluations. Each round raises a unique concern. Scores reflect v1 readiness -- 3-5/10 is normal for a first draft of this complexity.

---

### Persona 1: The Candidate (Selvi)

*PhD, MBA, 18 years in HR/L&D. Targeting corporate L&D roles (GBP 70-80k) and UK university lecturer positions near Maidenhead. Currently achieves 90% callback rate on manually tailored applications.*

---

**Round 1 of 10 -- "How do I actually review and edit these CVs?"**

**Concern:** I read through this entire PRD and I cannot find any review interface. The system generates documents and emails them to me. But how do I actually edit them? You mention US-210 says I should be able to review and edit, but the only interface described is email with PDF attachments. Am I supposed to open the DOCX in Word, edit it, re-save it, and then... what? Does the system know I edited it? How do I mark it as approved?

**Analysis:** This is a fundamental gap. The PRD describes a generation pipeline in detail but the review workflow is skeletal at best. The candidate receives an email with PDF attachments. The DOCX versions are mentioned as "available in the generated-cvs folder" -- meaning she would need SSH access or some other file access method to retrieve them. There is no web UI, no approval workflow, no way to provide the 1-5 rating mentioned in US-211, no way to mark a package as "approved" or "rejected" or to record that she applied. The feedback loop (US-211) is described as a user story but never appears in the workflow specifications. The cv_packages table has columns for candidate_rating, candidate_notes, callback_received, and callback_date, but there is no mechanism described for populating these fields. The candidate would need to either use direct database access, a custom webhook, or some external tool. For a system designed to save time, forcing the candidate to use SQL or curl to approve a CV defeats the purpose. This is the single biggest usability gap in the entire PRD.

**Score: 2/10**

**Recommendations:**
- Design a minimal review interface -- even a simple webhook-triggered form or email-reply-based approval system
- Define the full review workflow: receive email -> open DOCX -> edit if needed -> approve/reject -> provide rating
- Add a webhook endpoint for recording feedback (rating, notes, approval status)
- Include DOCX files as email attachments alongside PDFs, not just "in the folder"
- Consider a simple Tally or Google Form for the feedback mechanism as a v1 solution

---

**Round 2 of 10 -- "What if the generated CV does not sound like me?"**

**Concern:** I have spent 18 years building my professional voice. My CVs work because recruiters meet the same person in the interview that they read about on paper. The PRD creates a fictional persona called "Dr Sarah Mitchell" to write my CV. That is someone else's voice, not mine. How does the system learn my actual writing style? Where are my real CVs used as style examples?

**Analysis:** The PRD uses a role-play system prompt ("You are Dr Sarah Mitchell, a senior CV writer") rather than training the model on the candidate's actual writing style. While the master profile stores pre-written summary variants and highlight text variants, the generation prompt does not include examples of the candidate's actual writing. There is no few-shot learning from her existing tailored CVs that achieve the 90% callback rate. The system could generate technically correct CVs that sound nothing like the candidate. The PRD mentions "authentic professional voice that matches who she is in interviews" as something automation must preserve (Section 2.4, point 4), but the implementation provides no mechanism to capture or replicate that voice. The pre-written variants in the master profile are a partial solution -- they provide anchor text the AI refines rather than generating from scratch. But the system prompt character persona could override those anchors. A better approach would be to include 2-3 of the candidate's actual manually-tailored CVs as style examples in the generation prompt, with explicit instructions to match that voice.

**Score: 4/10**

**Recommendations:**
- Remove the "Dr Sarah Mitchell" persona and replace with direct style instructions derived from the candidate's actual writing
- Add a `style_examples` section to the master profile containing 2-3 excerpts from the candidate's best manually-tailored CVs
- Include these style examples in the CV generation prompt as few-shot examples
- Add a "voice consistency" check to the QA pipeline that compares generated text style against the style examples
- During Phase 8 tuning, explicitly evaluate whether the AI voice matches the candidate's interview presence

---

**Round 3 of 10 -- "45 emails a week will overwhelm me, not help me"**

**Concern:** Module 1 surfaces 20-45 A/B-tier jobs per week. Each one triggers a separate CV package and a separate notification email. That is potentially 45 emails per week with 4 attachments each (180 documents per week). I already have email overload. This does not solve the throughput problem -- it just moves the bottleneck from CV writing to CV reviewing.

**Analysis:** The notification design creates a new form of cognitive overload. If the system processes 30 jobs per week and sends 30 individual emails, the candidate spends her time managing an inbox rather than strategically choosing which roles to pursue. The PRD says the review target is "< 10 minutes per application" (Section 3.1), which at 30 packages per week is 5 hours of review -- better than 30-65 hours of manual tailoring, but still a substantial time commitment that could be reduced with better UX. There is no batch notification option, no daily digest, no priority sorting in the notification. Each email is atomic and equal. There is also no mechanism for the candidate to say "I am not interested in this role, do not generate a package" before generation starts -- the system generates for every A/B-tier job, whether the candidate wants to apply or not. A daily digest email with all packages ranked by match score, plus a quick-action mechanism (approve/skip/review), would dramatically reduce the candidate's cognitive load.

**Score: 3/10**

**Recommendations:**
- Replace individual emails with a daily digest email containing all packages generated that day, sorted by match score
- Include a quick summary table at the top: role, company, match %, QA score, gaps count
- Allow the candidate to configure notification preferences (individual, digest, batch)
- Add a "pre-filter" step where the candidate can skip certain jobs before generation (e.g., via a quick-reject webhook)
- Consider a weekly planning view showing all pending packages with approve/reject/prioritise actions

---

**Round 4 of 10 -- "How does it handle the gap between my India experience and UK expectations?"**

**Concern:** I spent significant years at Indian universities. Every time I apply for UK roles, I have to carefully frame that experience so it does not get dismissed. The PRD mentions "company_context" and Indian experience framing in Section 8.6, but the actual approach feels thin. It says to use "curriculum design" instead of "syllabus revision" -- but the real challenge is deeper than vocabulary. UK recruiters do not know my Indian institutions. They do not know the academic structure. They may have unconscious biases. How does the system handle this well enough that my Indian experience actually strengthens my application rather than raising questions?

**Analysis:** The PRD acknowledges the challenge (Section 2.4 point 8, US-219, Section 8.6) but the implementation is limited to vocabulary substitution and a company_context field. The real challenge of framing international experience for UK employers requires nuanced contextualisation: explaining institutional standing, translating governance structures, positioning cross-cultural experience as a strategic asset, and anticipating the "why did you leave India" question in cover letters. The master profile has a company_context field but no structured way to convey institutional prestige, research output, or comparative standing. A comment like "Leading technology university with 10,000+ students" is better than nothing but may not convey the intended message. The cover letter generation could be more explicit about how to frame international transitions as strengths -- not just in vocabulary but in narrative structure. There is also no handling of the potential gap in dates if the candidate moved from India to the UK mid-career.

**Score: 5/10**

**Recommendations:**
- Add a `framing_guidance` field to each work_experience entry in the master profile, with specific instructions for how to position that experience for UK audiences
- Include UK-equivalent benchmarks where possible (e.g., "comparable to a post-1992 university" or "similar to an IIT in the UK Russell Group context")
- Add specific cover letter narrative patterns for explaining career transitions from India to UK
- Include a "cross-cultural competence" standard paragraph template in the master profile for cover letter use
- Test the Indian experience framing with a UK recruiter during Phase 8 tuning

---

**Round 5 of 10 -- "What happens when the same role appears on multiple job boards?"**

**Concern:** Module 1 has deduplication, but it is not perfect. Sometimes the same role appears with slight variations in description text -- maybe one board has a longer description, another has a summary. Will Module 2 generate two separate CV packages for what is essentially the same role? That wastes my review time and money.

**Analysis:** The PRD does not address duplicate handling at the Module 2 level. It relies entirely on Module 1's deduplication. But Module 1's dedup works at the job discovery stage -- if two job board listings have different URLs and slightly different description text, they may be treated as separate jobs, each scored independently, each potentially triggering a separate CV package. The cv_packages table has no deduplication constraint beyond the job_id foreign key. If Module 1 creates two job records for the same actual role, Module 2 will generate two packages. The cost is small (~$0.15 per package) but the candidate's review time is the real waste. There should be at minimum a similarity check before generation that compares a new JD against recently analysed JDs for the same company, flagging potential duplicates.

**Score: 4/10**

**Recommendations:**
- Add a pre-generation duplicate check: before generating a package, compare the JD text against recent jd_analyses for the same company name (fuzzy match)
- If similarity score > 85%, skip generation and link to the existing package
- Add a `related_job_id` field to cv_packages for linking duplicate-but-different-source jobs to the same package
- Consider a "Company + Role Title" compound similarity check as a fast pre-filter
- Surface potential duplicates in the notification email so the candidate can merge them

---

**Round 6 of 10 -- "I need to track which CVs I actually sent and what happened"**

**Concern:** The system generates packages and I review them. But where do I track the full application lifecycle? Which ones did I actually submit? Which ones got callbacks? Which ones got interviews? If I cannot connect the tailored CV back to the outcome, I cannot tell you whether the automated CVs are working as well as my manual ones. The PRD mentions callback tracking but there is no workflow for recording it.

**Analysis:** The cv_packages table has fields for candidate_rating, callback_received, callback_date, and status (including 'applied'), but there is no mechanism to populate these fields. The PRD describes generation and notification workflows in detail but ignores the post-generation lifecycle entirely. Without outcome tracking, the primary success metric (80%+ callback rate) cannot be measured. The candidate would need to manually update the database for every application, which is unrealistic for someone applying to 20-45 roles per week. This makes the entire success measurement framework theoretical. The weekly dashboard (Section 3.3) lists "Callback rate on automated applications" as a target metric but provides no way to collect the underlying data.

**Score: 2/10**

**Recommendations:**
- Add a webhook endpoint for recording application outcomes: applied, callback, interview, offer, rejection
- Consider a simple email-reply-based mechanism: reply to the notification email with "APPLIED" or "CALLBACK" to update status
- Build a simple tracking spreadsheet export from the cv_packages table for manual tracking until a proper UI exists
- Add outcome tracking to the daily digest email as a checklist
- Define the minimum viable tracking mechanism that does not require database access

---

**Round 7 of 10 -- "Can I trust the CIPD handling in high-stakes applications?"**

**Concern:** CIPD is the big one. Many senior L&D roles list CIPD Level 5 or Level 7 as essential. I do not have CIPD -- I have a PhD and MBA which arguably exceed it, but that argument has to be made carefully. If the automated CV overstates my CIPD equivalence or, worse, implies I hold CIPD membership when I do not, that could be career-ending. The PRD has a cipd_equivalency block, but I need to see exactly how it handles different CIPD scenarios.

**Analysis:** The CIPD handling is one of the PRD's stronger elements. It uses pre-written equivalency statements stored in the master profile (Section 6.2, cipd_equivalency object), with separate statements for when CIPD is essential vs desirable. The JD analysis flags CIPD requirements specifically (is_cipd_requirement: true) and the CV generation prompt explicitly states "If the candidate does not hold CIPD, do NOT claim CIPD membership." The QA pipeline should catch any fabricated CIPD claim. However, the pre-written statements are static -- they do not adapt to the specific CIPD level required. A role requiring CIPD Level 5 is different from one requiring CIPD Level 7, and the equivalency argument is stronger for Level 5 (where a PhD clearly exceeds it) than for Level 7 (where the argument is more nuanced). The cipd_equivalency block has only two static statements, not level-specific variants. There is also no handling of roles where CIPD is "essential with no exceptions" vs "essential or equivalent."

**Score: 6/10**

**Recommendations:**
- Add level-specific CIPD equivalency statements: separate handling for Level 3, 5, and 7 requirements
- Distinguish between "CIPD or equivalent" (strong case) and "Must hold CIPD" (weaker case, may need different cover letter approach)
- Add a "cipd_confidence" score to the JD analysis that indicates how strong the equivalency argument is
- For roles where CIPD is listed as strictly essential with no equivalent, flag the package with a warning
- Include the specific RQF level mapping in both CV and cover letter (PhD = RQF 8 > CIPD L7 = RQF 7)

---

**Round 8 of 10 -- "What about roles that need a personal touch?"**

**Concern:** Some applications are not just about matching requirements. I might know someone at the company. I might have attended their conference. I might have a specific reason for wanting to work there. The automated cover letter will be generic in its company-specific content because the system does not know these things. For my highest-priority roles, I need a way to inject personal context.

**Analysis:** The PRD has no mechanism for the candidate to provide job-specific context before generation. The pipeline is fully automated: job scored -> package generated -> candidate notified. There is no step where the candidate can add notes like "I met the hiring manager at the CIPD conference" or "I know someone in their L&D team" or "I used their product and can reference it." The cover letter generation prompt says "Reference the specific role title and company" but has no access to candidate-specific knowledge about the company beyond what is in the JD. For A-tier roles where the candidate has a personal connection, this is a significant missed opportunity. The generated cover letter will be competent but impersonal. Adding even a simple free-text field to the trigger mechanism would allow the candidate to inject context.

**Score: 3/10**

**Recommendations:**
- Add a `candidate_notes_for_generation` field to the trigger mechanism, allowing the candidate to add personal context before generation
- For the highest-tier roles, consider a brief pause before generation to allow candidate input
- Add a webhook endpoint where the candidate can add notes to a pending job before the next WF8 poll picks it up
- Include these notes in the cover letter generation prompt as a "personal connection" section
- Consider a two-track system: fully automated for B-tier, semi-automated (with candidate input) for A-tier

---

**Round 9 of 10 -- "How quickly can I iterate when something is wrong?"**

**Concern:** The tuning phase (Phase 8) says 2 weeks, but what about ongoing issues? If I notice the system consistently formats my PhD wrong, or always puts the wrong job title first, how do I fix it? Do I have to edit the JSON profile in Postgres directly? The WF10 Master Profile Manager has a webhook, but do I have a user-friendly way to use it?

**Analysis:** The profile update mechanism is a raw webhook (WF10) that accepts PUT or PATCH requests with JSON payloads. This is developer-friendly but not candidate-friendly. Unless the candidate is comfortable crafting JSON payloads and sending HTTP requests, she cannot update her own profile without developer assistance. This creates a dependency bottleneck that contradicts the system's goal of increasing autonomy. The PRD acknowledges this ("Future phases may add: A web form for profile updates -- low priority given single-user system") but for a system generating 20-45 packages per week, the profile will need frequent updates: new achievements, updated metrics, new publications, adjusted framing. Each update requires someone who can write JSON and call webhooks. Additionally, prompt adjustments (the most impactful lever for improving quality) require editing n8n workflow nodes, which is even less accessible.

**Score: 3/10**

**Recommendations:**
- Build a minimal profile editor as a simple HTML form (even static HTML that posts to the webhook)
- Prioritise the most commonly updated fields: summary variants, highlights text, skills list
- Add a "quick update" webhook that accepts simpler inputs (e.g., `{"action": "add_highlight", "role": "acme", "text": "New achievement..."}`)
- Document common profile update procedures with example curl commands as a stopgap
- Consider using a Google Sheet or Airtable as a profile editor frontend that syncs to Postgres

---

**Round 10 of 10 -- "What if I get an interview and they ask about something in the CV I did not write?"**

**Concern:** The system rewrites my bullet points to incorporate JD keywords. But if a rewrite changes the emphasis or framing of an experience, I might not remember saying it that way. If an interviewer quotes my CV back to me and I look confused, that is worse than not having the interview. How do I prepare for interviews based on what the automated CV actually says?

**Analysis:** The PRD includes source_traceability in the CV output (Section 8.4) which maps each CV claim back to the original profile entry. This is good engineering but poor UX -- the traceability data is in JSON inside the cv_packages table, not in a format the candidate can quickly review before an interview. There is no "interview prep sheet" or "what your CV says vs what you actually did" comparison view. The gap report (US-207) partially addresses this by showing what was matched and what was not, but it does not show the specific wording changes the AI made. If the AI rewrites "Managed a team of 5 trainers" as "Led a cross-functional L&D team of 5 specialists across three business units" for keyword optimisation, the candidate needs to know that before the interview. The notification email does not include this level of detail.

**Score: 4/10**

**Recommendations:**
- Include a "CV vs Profile" comparison in the notification email showing key rewordings
- Generate a brief "interview preparation notes" document alongside each CV, highlighting how claims were framed
- Flag any bullet points where the AI significantly reworded the original profile text
- Add the source_traceability data in a human-readable format (not JSON) to the notification
- Consider a one-page "what this CV says and why" summary for each package

---

**Persona 1 Summary: The Candidate (Selvi)**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Review and edit interface | 2/10 | No review UI, no approval mechanism, no feedback workflow |
| 2 | Voice and writing style | 4/10 | Fictional persona instead of candidate's actual voice |
| 3 | Notification overload | 3/10 | Individual emails for 20-45 jobs/week creates new bottleneck |
| 4 | Indian experience framing | 5/10 | Vocabulary swaps but shallow contextualisation |
| 5 | Duplicate handling | 4/10 | No Module 2 level dedup for same roles from different boards |
| 6 | Application lifecycle tracking | 2/10 | No mechanism to record outcomes, cannot measure success |
| 7 | CIPD equivalency handling | 6/10 | Good structure but not level-specific |
| 8 | Personal touch for priority roles | 3/10 | No way to inject candidate-specific context |
| 9 | Profile update usability | 3/10 | Requires JSON/webhook knowledge to update profile |
| 10 | Interview preparation | 4/10 | Traceability exists but not in usable format |

**Average Score: 3.6/10**

**Top 3 Critical Issues:**
1. No review/approval interface or feedback mechanism -- the entire user-facing experience is undefined
2. No application lifecycle tracking makes the primary success metric (callback rate) unmeasurable
3. Notification design will create cognitive overload rather than reducing it

---

### Persona 2: Technical Architect / n8n Expert

*Senior platform engineer with deep experience in n8n workflow automation, Docker orchestration on ARM64, and document generation pipelines.*

---

**Round 1 of 10 -- "Gotenberg on ARM64: have you actually tested this?"**

**Concern:** The PRD specifies Gotenberg 8 running on a Hetzner CAX31, which is ARM64 (Ampere Altra). Gotenberg uses Chromium for HTML-to-PDF conversion. Chromium on ARM64 Linux has historically had issues with font rendering, PDF output consistency, and memory usage. The PRD states "Native ARM64" in the technology stack table but provides no evidence this has been validated. Has anyone actually run Gotenberg 8 on an ARM64 server and confirmed the PDF output matches x86 output?

**Analysis:** Gotenberg 8 does publish multi-arch Docker images including arm64, so the container will start. However, the underlying Chromium instance on ARM64 may produce subtly different rendering: font metrics can differ between architectures, leading to different line breaks, different pagination, and potentially a corporate CV that spills onto page 3 instead of fitting on page 2. The PRD's CSS uses precise point sizes (10.5pt, 11pt, 9.5pt) and tight margins -- these are the exact conditions where cross-architecture rendering differences surface. The 512MB memory limit in the Docker compose may also be insufficient for Chromium on ARM64 with complex HTML documents. Chromium typically needs 300-400MB just for startup, leaving little headroom for rendering. A single concurrent render should work, but if WF8 processes multiple jobs and calls WF9 in rapid succession, Chromium could OOM. The PRD processes max 5 jobs per run but they appear to be processed sequentially (Loop Over Items), so concurrent Gotenberg calls are unlikely in normal operation. Still, this needs validation.

**Score: 4/10**

**Recommendations:**
- Add an explicit Phase 0 task: render the corporate CV template with sample data on the actual CAX31 server and verify the output fits exactly 2 A4 pages
- Test with the longest plausible CV content (maximum bullets, longest text variants) to verify pagination
- Increase the Gotenberg memory limit to 768MB or 1GB to provide headroom
- Add a post-render page count check in WF9: if the PDF is more than 2 pages for a corporate CV, flag for template adjustment
- Document the expected Gotenberg rendering behaviour on ARM64 as a known consideration

---

**Round 2 of 10 -- "The n8n-nodes-docxtemplater package: is it maintained?"**

**Concern:** The PRD depends on `n8n-nodes-docxtemplater` for DOCX generation. Community n8n nodes are maintained by individual contributors, not the n8n team. I have seen community nodes go unmaintained, break with n8n updates, or have critical bugs. What is the maintenance status of this package? Does it support all the template features used in the PRD (conditionals, loops, nested objects)?

**Analysis:** This is a legitimate supply chain risk. The PRD uses `{#if}`, `{#each}`, and nested object access (`{this.position}`) in the DOCX templates. The docxtemplater library itself (the underlying npm package) is well-maintained, but the n8n wrapper node (`n8n-nodes-docxtemplater`) may or may not expose all features. Community n8n nodes typically have a single maintainer. If that maintainer stops updating the package, a breaking change in a future n8n version (which updates frequently) could break DOCX generation entirely. The PRD does not specify a minimum version, pin to a specific version, or have a fallback strategy if the package breaks. Additionally, `NODE_FUNCTION_ALLOW_EXTERNAL=docx,handlebars` in the environment variables suggests the Code node also has access to these libraries directly -- which could serve as a fallback but is not documented as such. The Handlebars-based HTML rendering path (n8n-nodes-text-templater) has the same maintainability risk, though Handlebars is simpler and more stable.

**Score: 4/10**

**Recommendations:**
- Verify the current maintenance status and last update date of n8n-nodes-docxtemplater before building on it
- Pin to a specific working version in N8N_COMMUNITY_PACKAGES rather than using "latest"
- Build a fallback DOCX generation path using the n8n Code node with the docxtemplater npm library directly (NODE_FUNCTION_ALLOW_EXTERNAL already allows it)
- Add a health check for community node availability at WF8 startup
- Consider whether DOCX generation could be handled by Gotenberg itself (it does not support HTML-to-DOCX natively, but LibreOffice integration exists)

---

**Round 3 of 10 -- "The WF8 loop architecture will not handle failures gracefully"**

**Concern:** WF8 uses a "Loop Over Items" node to process up to 5 jobs sequentially. If job 3 of 5 fails with an unhandled error, what happens to jobs 4 and 5? In n8n, an uncaught error in a loop iteration typically stops the entire workflow execution. The error handling table mentions per-stage error actions, but n8n's error handling in loops requires explicit error-catching nodes at every potential failure point.

**Analysis:** n8n's execution model is not fault-tolerant by default within loops. If a Claude API call fails with a 500 error and the retry also fails, the workflow execution will stop unless there is an explicit Error Trigger node or try/catch pattern around each API call. The PRD describes error handling strategies (retry once, then fail) but does not show how these are implemented in the n8n node graph. In practice, implementing robust per-item error handling in an n8n loop requires either: (a) wrapping each item's processing in a sub-workflow (which adds its own failure modes), (b) using n8n's Error Trigger workflow for the entire orchestrator, or (c) using the "Continue on Fail" setting on each node. Option (c) is the simplest but requires careful downstream handling of failed items. The PRD's WF8 node sequence (37 nodes in a linear chain with a loop and a conditional branch for QA retries) does not mention "Continue on Fail" or sub-workflow isolation per item. A failure at node 19 (CV Generation) for one job would likely halt processing for all remaining jobs in the batch.

**Score: 3/10**

**Recommendations:**
- Process each job as a separate sub-workflow execution called from the loop, isolating failures
- Enable "Continue on Fail" on all external service calls (Claude API, Gotenberg, Postgres) with explicit error-checking nodes after each
- Add an Error Trigger workflow (WF8-error) that catches uncaught failures, marks the current job as 'failed', and allows the loop to continue
- Implement a dead-letter pattern: failed jobs go to a 'failed' queue for manual retry rather than being retried indefinitely
- Test the failure path explicitly in Phase 7 integration testing: kill Gotenberg mid-run, return a malformed Claude response, simulate a Postgres timeout

---

**Round 4 of 10 -- "Context window limits for the CV generation prompt"**

**Concern:** The Stage 3 CV generation prompt includes the full JD analysis JSON, the full master profile JSON, and the mapping JSON. For a comprehensive master profile with 18 years of experience, 20+ tagged highlights, publications, teaching experience, keyword banks, and CIPD handling, the profile alone could be 10,000-15,000 tokens. Add the JD analysis (~1,500 tokens) and mapping (~2,000 tokens) and we are at 13,500-18,500 input tokens. The PRD estimates 6,000 input tokens for Stage 3 -- that seems aggressively low.

**Analysis:** The token estimate in Section 16.6 (6,000 input tokens for CV generation) is almost certainly too low. A full master profile with the schema described in Section 6.2 -- including work_experience with multiple roles each containing 5-10 highlights with text_variants, metrics, tags, and skills_demonstrated; plus publications with full citations; plus teaching experience; plus keyword banks; plus CIPD equivalency -- will easily exceed 8,000 tokens as JSON. The system prompt itself is ~300 tokens. The JD analysis is ~1,500 tokens. The mapping is ~2,000 tokens. The format rules and task instructions add ~500 tokens. Total input: likely 12,000-16,000 tokens. This is within Claude Sonnet's context window, but it doubles the estimated cost per generation from $0.035 to ~$0.07. The cover letter prompt is even larger because it includes the generated CV content as additional context. The QA prompt includes both the generated CV and the full master profile. Across all stages for a single package, actual costs are likely $0.12-0.18 per package rather than the estimated $0.076. At 30 packages per week, monthly cost would be ~$15-22 rather than ~$10.

**Score: 5/10**

**Recommendations:**
- Measure actual token counts for a realistic master profile before committing to cost estimates
- Consider sending a pruned master profile to Stage 3: only the work experience entries and highlights identified in the mapping stage, not the entire profile
- Profile-prune the QA prompt too: the hallucination checker only needs the profile sections referenced by the CV, not the entire profile
- Update cost estimates to reflect realistic token counts (double the current estimates as a safety margin)
- Add a token count monitoring alert if actual costs consistently exceed 2x the estimate

---

**Round 5 of 10 -- "The 15-minute polling interval creates an awkward user experience"**

**Concern:** WF8 polls every 15 minutes. Combined with the 3-5 minute generation time, the candidate could wait 20 minutes from when a job is scored to when she receives the notification. But worse, Module 1's scoring also runs on a schedule. If Module 1 scores jobs every hour and Module 2 polls every 15 minutes, the effective latency is 60 + 15 + 5 = 80 minutes from job discovery to CV readiness. The PRD's claim of "within 5 minutes of trigger" (Section 3.1) is misleading because the trigger itself is delayed by the polling interval.

**Analysis:** The 5-minute target measures generation time only, not end-to-end latency. The actual end-to-end flow is: (1) Job discovered by Module 1 scraper, (2) Job scored by Module 1 AI scoring pipeline (which also runs on a schedule), (3) Module 2 polls for new A/B-tier jobs (every 15 minutes), (4) Module 2 generates the package (3-5 minutes), (5) Notification sent. Steps 2 and 3 add significant latency. The PRD acknowledges this in Section 14.1 ("worst case: 15 min poll + 5 min generation = 20 min from scoring to notification") but does not account for Module 1's scoring latency. For competitive roles that fill within 48-72 hours, the total latency is acceptable. But the PRD could use n8n's native Postgres trigger node (which uses LISTEN/NOTIFY) or a webhook from Module 1's scoring workflow to eliminate the 15-minute polling delay entirely. The PRD states "n8n does not have native Postgres LISTEN/NOTIFY support" but this is incorrect for recent n8n versions which include a Postgres Trigger node.

**Score: 5/10**

**Recommendations:**
- Verify whether the n8n version deployed supports the Postgres Trigger node (available since n8n 0.200+)
- If available, replace the 15-minute cron poll with a Postgres trigger on INSERT to job_scores where tier IN ('A','B')
- Alternatively, add a webhook call at the end of Module 1's WF5 (Scoring Pipeline) that directly triggers WF8 for the specific job
- Update the success metric to measure end-to-end latency (job discovery to notification), not just generation time
- Document the actual expected end-to-end latency including Module 1 delays

---

**Round 6 of 10 -- "Disk storage without cleanup will eventually fill the server"**

**Concern:** Each package generates 4 files (CV PDF, CV DOCX, cover letter PDF, cover letter DOCX) plus a metadata.json. At 30 packages per week, that is 150 files per week, 7,800 files per year. Each PDF is maybe 100-200KB, each DOCX 50-100KB. Annual storage: ~5-8GB. The Hetzner CAX31 has limited disk space. The PRD mentions a 6-month retention period and a cleanup workflow, but the cleanup is described as a future addition to WF6, not a concrete implementation.

**Analysis:** The storage growth is modest in absolute terms (5-8GB/year for documents) but the cleanup mechanism is vaguely defined. Section 17.3 mentions adding a monthly cron job to WF6 that "deletes generated files for jobs expired > 6 months ago," but this is described as a future task, not part of the initial implementation. The Hetzner CAX31 typically has 80GB of disk, shared with the OS, Docker images, n8n data, Postgres data, Gotenberg's Chromium cache, and any other services. Gotenberg's Chromium cache alone can grow to several GB if not managed. The more pressing concern is Postgres JSONB storage: each cv_packages row stores mapping_data, cv_content, cover_letter_content, and qa_report as JSONB -- potentially 50-100KB per row. At 30 packages/week, that is 1.5-3MB/week of JSONB data, which is trivial for Postgres but adds up with the generation log table. The generation log table (cv_generation_log) could grow rapidly: 5-7 log entries per package, 30 packages/week = 150-210 log rows/week with JSONB error details.

**Score: 5/10**

**Recommendations:**
- Implement the cleanup workflow in Phase 0 or Phase 7, not as a future enhancement
- Add Gotenberg cache cleanup to the health check routine
- Set up Postgres VACUUM and index maintenance as a scheduled task
- Add disk space monitoring with alerts at 80% and 90% capacity
- Consider moving generated documents to S3-compatible object storage (Hetzner has this) for long-term retention

---

**Round 7 of 10 -- "The QA retry loop can create infinite cost in edge cases"**

**Concern:** If Stage 4 QA fails, the system regenerates Stage 3 and re-runs Stage 4. Maximum 2 retries. But each retry is a full Sonnet call ($0.035-0.07 for generation + $0.02 for QA). If the system gets stuck in a pattern where the QA consistently fails -- perhaps because the JD requires something the candidate genuinely lacks and the AI keeps trying to fabricate it -- you burn through 3x the normal cost and still end up with a "needs_manual_review" flag. Now multiply by 5 jobs per batch run, 4 runs per hour, and a systematic prompt issue that causes a high QA failure rate, and costs spiral.

**Analysis:** The retry mechanism has a per-job cap (max 2 retries = max 3 attempts) but no global cap per time period. If a prompt regression causes all generated CVs to fail QA, the system will triple its Claude API costs before the issue is noticed. At 30 packages/week with 3 attempts each, costs go from ~$10/month to ~$30/month -- within budget but concerning. The real risk is a cascading failure where retries also consume more tokens (because the QA feedback is appended to the prompt, making it longer each time) and the longer prompts lead to worse outputs, leading to more QA failures. The cost tracking view shows daily costs, and the alerting section mentions "QA failure rate > 50% in last 24 hours" as an alert condition, which would catch systematic issues. However, by the time 24 hours of failed QA has occurred, the system has already wasted significant money and generated dozens of packages marked "needs_manual_review."

**Score: 5/10**

**Recommendations:**
- Add a global cost circuit breaker: if total API spend in the last hour exceeds $X, pause all generation
- Reduce the QA failure rate alert threshold from 24 hours to 1 hour (or 10 packages)
- Track the appended-feedback prompt length growth -- cap it to prevent token bloat on retries
- Consider a "dry run" mode that generates without calling Claude, using cached responses, for testing prompt changes
- Log the specific QA failure reason to enable rapid diagnosis of systematic issues

---

**Round 8 of 10 -- "The Handlebars template engine has no page-break intelligence"**

**Concern:** The corporate CV must fit on exactly 2 A4 pages. The PRD uses Handlebars to render HTML, then Gotenberg to convert to PDF. But Handlebars has no awareness of page boundaries. It just renders HTML. Whether the content fits on 2 pages depends on the amount of text generated by Claude, the CSS styling, and Chromium's rendering engine. The system relies on Claude generating the right amount of text (450-550 words target), but even within that range, different word lengths, bullet counts, and section configurations can produce different page counts.

**Analysis:** There is a fundamental tension between content generation (Claude) and layout (Handlebars + Gotenberg). Claude controls the word count, but Gotenberg controls the pagination. A 500-word CV with many short bullets and section breaks may span 2.5 pages. A 500-word CV with long paragraphs and few sections may fit on 1.5 pages. The PRD has a post-generation word count check (Section 8.6: "if over target by more than 10%, trim pass; if under by more than 20%, flag for review") but this operates on word count, not rendered page count. The only reliable solution is to render first, check the page count, and then adjust if needed. The CSS includes `page-break-inside: avoid` on experience entries, which is good but can force more content onto the next page. There is no `page-break-before` or `page-break-after` logic to control where sections split. The academic CV has no page limit, so this is only a problem for corporate CVs and cover letters.

**Score: 4/10**

**Recommendations:**
- Add a post-render page count check: after Gotenberg generates the PDF, check the page count (Gotenberg returns PDF metadata or use a separate tool)
- If corporate CV is more than 2 pages: run a trim pass with Claude and re-render
- If corporate CV is less than 1.5 pages: run an expand pass or flag for review
- Test the template with varying content lengths (300, 400, 500, 600, 700 words) to establish the reliable word count range for exactly 2 pages
- Add CSS for page-break hints at section boundaries to guide Chromium's pagination

---

**Round 9 of 10 -- "No idempotency protection on the pipeline"**

**Concern:** If WF8 runs, picks up 5 jobs, processes job 1 successfully, then crashes during job 2, what happens on the next run 15 minutes later? The view v_pending_cv_generation filters out jobs that have a cv_packages row. Job 1 has a cv_packages row (created at node [6] before generation). So it will not be reprocessed. But job 2 also has a cv_packages row (status = 'generating') because the row was created before the crash. It will not be picked up again because it has a cv_packages row. Jobs 3-5 will be picked up on the next run. Job 2 is now stuck in 'generating' forever.

**Analysis:** The pipeline creates the cv_packages row with status = 'generating' at node [6], before any actual generation happens. If the workflow crashes after node [6] but before completion, the job is stuck. The v_pending_cv_generation view filters on `cp.id IS NULL` (no cv_packages row exists), so the stuck job will never be retried. Additionally, `j.cv_package_status` is set to 'generating' at node [7], and the pending view also checks `j.cv_package_status IS NULL`. Both conditions prevent retry. There is no stale-job detection: no mechanism to find cv_packages rows that have been in 'generating' status for more than X minutes and either retry them or mark them as failed. This is a classic "write-ahead without cleanup" pattern. The system needs either: (a) a stale-job cleanup routine, or (b) the pending view to include jobs where status = 'generating' and updated_at is older than 30 minutes.

**Score: 3/10**

**Recommendations:**
- Add a stale-generation check to WF8: at the start of each run, find cv_packages with status = 'generating' and updated_at older than 30 minutes, reset them to allow retry
- Alternatively, defer creating the cv_packages row until after successful generation (store intermediate state in n8n's execution context)
- Add a `last_heartbeat` column to cv_packages that is updated during each pipeline stage, enabling stale detection
- Create a separate WF for stuck-job recovery that runs hourly
- Test the crash-recovery path explicitly in Phase 7

---

**Round 10 of 10 -- "The SQL migration has a subtle NULL constraint issue"**

**Concern:** The ALTER TABLE statement for jobs adds `cv_package_status VARCHAR(20) DEFAULT NULL` with a CHECK constraint that includes `NULL` as a valid value: `CHECK (cv_package_status IN (NULL, 'pending', ...))`. But IN checks with NULL do not work as expected in SQL. `NULL IN (NULL, 'pending')` evaluates to NULL (not TRUE), so the check constraint will reject NULL values depending on the database's handling.

**Analysis:** This is a genuine SQL bug. In PostgreSQL, `CHECK (column IN (NULL, 'a', 'b'))` does NOT allow NULL values. The IN operator uses equality comparison, and NULL = NULL evaluates to NULL (not TRUE) in SQL. The correct way to allow NULL is to omit it from the CHECK and rely on the column's nullability. Since the column has `DEFAULT NULL` and is not marked `NOT NULL`, PostgreSQL will accept NULL values because CHECK constraints that evaluate to NULL are treated as "not failing" in PostgreSQL specifically (this is a PostgreSQL-specific behaviour that differs from the SQL standard). So in PostgreSQL, this actually works -- but it is misleading code that would break on other databases. The `v_pending_cv_generation` view also has the condition `AND j.cv_package_status IS NULL` which correctly uses IS NULL rather than = NULL. So the view is correct even though the CHECK constraint is technically dubious.

**Score: 6/10**

**Recommendations:**
- Remove NULL from the CHECK constraint list: `CHECK (cv_package_status IN ('pending', 'generating', 'ready', 'approved', 'applied', 'failed'))` -- the column already allows NULL by being nullable
- Add a comment explaining that NULL means "not yet processed by Module 2"
- Add explicit NOT NULL to the profile_version column in cv_packages (it is NOT NULL in the schema but verify the migration)
- Consider using an ENUM type instead of VARCHAR with CHECK for status fields, for better type safety
- Run the migration against a test database before production deployment

---

**Persona 2 Summary: Technical Architect / n8n Expert**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Gotenberg on ARM64 | 4/10 | No validation of rendering consistency on ARM64 |
| 2 | Community node maintenance | 4/10 | Supply chain risk with unmaintained n8n packages |
| 3 | Loop failure handling | 3/10 | Uncaught errors stop entire batch, no isolation |
| 4 | Context window / token estimates | 5/10 | Cost estimates are ~50% too low |
| 5 | Polling interval UX | 5/10 | 15-min poll adds unnecessary latency |
| 6 | Disk storage cleanup | 5/10 | Cleanup described as future work, not implemented |
| 7 | QA retry cost spiral | 5/10 | No global cost circuit breaker |
| 8 | Page-break intelligence | 4/10 | No post-render page count validation |
| 9 | Idempotency / stuck jobs | 3/10 | Crashed jobs stuck in 'generating' forever |
| 10 | SQL NULL constraint | 6/10 | Works in PostgreSQL but misleading code |

**Average Score: 4.4/10**

**Top 3 Critical Issues:**
1. No crash recovery or stuck-job detection -- jobs can be permanently lost if a workflow execution fails mid-pipeline
2. Loop error handling does not isolate failures -- one bad job can block all remaining jobs in a batch
3. No post-render page count validation means corporate CVs may silently overflow to 3 pages

---

### Persona 3: UK Recruitment Expert / Career Coach

*20+ years in UK recruitment, specialising in L&D, HR, and higher education placements. CIPD Fellow. Understands ATS systems, recruiter workflows, and UK hiring conventions from both corporate and academic sectors.*

---

**Round 1 of 10 -- "ATS parsing of generated PDFs is not guaranteed"**

**Concern:** The PRD claims ATS-friendly design and lists single-column layout, standard headings, and no graphics. Good start. But ATS compatibility depends on the PDF's internal structure, not just its visual layout. Many ATS systems (Workday, Taleo, iCIMS) extract text from PDFs using their own parsers. A PDF generated by Chromium (via Gotenberg) may embed text as individual positioned characters rather than flowing text, which can produce garbled extraction. The DOCX path is generally safer for ATS, but many candidates submit PDFs because they look better. Has anyone tested whether ATS systems can actually parse these Gotenberg-generated PDFs?

**Analysis:** This is a known issue in CV generation. PDF text extraction quality depends on how the PDF renderer creates the internal text streams. Chromium's PDF output is generally better than wkhtmltopdf or similar tools, but it can still produce text extraction issues with certain CSS layouts (flex, grid, positioned elements). The corporate CV template uses `display: flex` for the experience header (role and dates side by side) and inline elements for the skills list. Both of these can cause ATS parsers to extract text in wrong reading order -- for example, extracting "Senior L&D Manager Jan 2020" as "Jan 2020 Senior L&D Manager" because flex items have no inherent reading order in the PDF text stream. The academic template also uses flex for employment headers. The PRD does not include any ATS parsing validation in the QA pipeline. Section 3.2 mentions "90%+ ATS compatibility score on every generated CV" but the "internal scoring pipeline" for this metric is never defined. The QA pipeline (Section 12) checks keywords, hallucination, and formatting but not ATS parseability.

**Score: 3/10**

**Recommendations:**
- Replace `display: flex` in CV templates with simpler CSS (float, or separate lines for role and dates) to ensure correct text extraction order
- Add an ATS parsing test to Phase 5: upload generated PDFs to at least 2 ATS systems (Workday and iCIMS have free test portals) and verify text extraction
- Consider generating the PDF with explicit text flow order rather than relying on visual positioning
- Add an automated ATS parse check to the QA pipeline: extract text from the generated PDF and verify it reads correctly
- Always recommend DOCX for ATS submission and PDF for direct email applications -- make this advice explicit in the notification email

---

**Round 2 of 10 -- "The corporate CV is missing key sections UK recruiters expect"**

**Concern:** The corporate CV template has Professional Summary, Core Skills, Professional Experience, Education, Professional Development, and Professional Memberships. But for senior L&D roles at the Manager/Head level (GBP 70-80k), UK recruiters increasingly expect to see: a Key Achievements section or standalone achievements block, specific mention of right to work, notice period, and sometimes a brief Technology/Systems section (especially for roles that mention LMS platforms, data analytics tools, or digital learning tools). The PRD's template is competent but generic -- it does not differentiate itself from a thousand other AI-generated CVs.

**Analysis:** The template follows safe, conventional UK CV structure but misses several elements that distinguish strong candidates at the senior level. Right to work is critical: many UK employers pre-filter on visa status, and burying it in the cover letter means ATS systems may not pick it up. Notice period is expected at this seniority level -- recruiters need to know if you are available in 1 month or 3 months. For L&D roles specifically, a Technologies/Tools section is increasingly important because digital learning is central to modern L&D. A candidate who lists "Articulate 360, Cornerstone OnDemand, Power BI, SCORM, xAPI" immediately signals practical capability. The master profile schema includes a keyword_bank with technology terms but the CV template does not have a dedicated section for them. The professional summary is capped at 60 words (Section 8.3), which is tight for senior roles -- 80-100 words is more typical for Head-level positions.

**Score: 4/10**

**Recommendations:**
- Add a "Key Achievements" highlight section after the Professional Summary for the 3-4 most impactful achievements with metrics
- Add a "Technical Skills / Tools" section for L&D technology stack (LMS platforms, authoring tools, analytics)
- Include right-to-work status on the CV itself, not just the cover letter
- Include notice period on the CV
- Increase the professional summary word target to 80-100 words for senior roles (Manager+ level)

---

**Round 3 of 10 -- "Academic CV conventions are not just about format -- they are about academic identity"**

**Concern:** The academic CV template covers the right sections (qualifications, employment, teaching, publications, conferences, referees). But the language framing is wrong in subtle ways. The template structures teaching under "TEACHING EXPERIENCE" but UK universities expect to see "TEACHING AND LEARNING" or "TEACHING, LEARNING AND ASSESSMENT." The research section is called "RESEARCH INTERESTS" but should be "RESEARCH" with sub-sections for interests, ongoing projects, and supervision. There is no mention of PhD supervision, external examining, or administrative roles -- all critical for senior lecturer applications.

**Analysis:** Academic hiring in the UK follows very specific conventions that differ from corporate. The PRD captures the broad structure but misses nuances that signal whether a candidate understands the academic environment. For a senior lecturer application, the person specification typically requires evidence of: teaching at UG and PG level, curriculum development, research-active status, PhD supervision (or readiness to supervise), external examining, contribution to departmental administration, and commitment to pedagogical innovation. The template does not have sections for: PhD/research student supervision, external examining and reviewing, administrative service (committees, programme leadership), pedagogical qualifications (HEA fellowship / Advance HE), or ongoing research projects. The absence of HEA fellowship (now Advance HE) is particularly notable -- it is essentially mandatory for UK university teaching positions and is not mentioned anywhere in the PRD. If the candidate does not hold it, the CV should address this (similar to the CIPD handling).

**Score: 3/10**

**Recommendations:**
- Add sections for: PhD Supervision, External Examining, Administrative Service, Pedagogical Qualifications
- Add Advance HE / HEA fellowship handling (similar to CIPD equivalency) -- does the candidate hold it? If not, how to address the gap?
- Rename "TEACHING EXPERIENCE" to "TEACHING, LEARNING AND ASSESSMENT"
- Add "RESEARCH" section with subsections: Current Projects, Research Interests, Supervision
- Include REF (Research Excellence Framework) readiness if applicable
- Add a "SCHOLARLY ACTIVITIES" or "ACADEMIC CITIZENSHIP" section for reviewing, editing, conference organisation

---

**Round 4 of 10 -- "The cover letter 'Dear Hiring Manager / Yours faithfully' convention is wrong"**

**Concern:** Section 9.2 states: "Dear Hiring Manager" / "Yours faithfully" when no name available. This is a UK convention error. In UK business correspondence, "Yours faithfully" is only used with "Dear Sir/Madam" -- when you do not know the name at all. "Dear Hiring Manager" is a named role (even if not a person's name), so the correct sign-off is "Yours sincerely." This mistake would mark the candidate's cover letter as either non-British or AI-generated -- both bad signals.

**Analysis:** This is a small but telling error that undermines the PRD's claim to UK recruitment expertise. UK business letter conventions are: (1) "Dear Sir/Madam" -> "Yours faithfully" (unknown recipient), (2) "Dear Mr/Ms/Dr [Name]" -> "Yours sincerely" (known recipient), (3) "Dear Hiring Manager" -> "Yours sincerely" (addressed to a role). The PRD gets case (2) correct but case (1) wrong. Additionally, many modern UK cover letters use "Kind regards" as a more contemporary sign-off, especially for corporate roles. Academic cover letters still tend to use the traditional faithfully/sincerely convention. This error would appear in every cover letter where the hiring manager's name is unknown -- which is the majority of applications. The system prompt for cover letter generation (Section 9.4) does not explicitly address sign-off conventions, so Claude may or may not get it right depending on training data. The explicit mapping in the user prompt ("Yours faithfully" when no name) will override Claude's knowledge of correct UK conventions.

**Score: 3/10**

**Recommendations:**
- Fix the sign-off mapping: "Dear Hiring Manager" -> "Yours sincerely" or "Kind regards"
- "Dear Sir/Madam" (if ever used) -> "Yours faithfully"
- "Dear [Named person]" -> "Yours sincerely"
- Add sign-off convention to the system prompt to prevent Claude from applying American conventions
- Consider "Kind regards" as the default for corporate roles (more contemporary, less formal)
- For academic roles, keep "Yours sincerely" / "Yours faithfully" as appropriate

---

**Round 5 of 10 -- "Keyword stuffing vs natural integration"**

**Concern:** The PRD targets 75-85% keyword coverage from the JD. That is aggressive. A job description for a senior L&D role might contain 15-20 unique keywords. Incorporating 12-17 of them into a 2-page CV risks keyword stuffing -- where the CV reads like it was reverse-engineered from the JD (because it was). UK recruiters are increasingly aware of AI-generated CVs and keyword-optimised applications. A CV that hits every keyword but reads mechanically will trigger scepticism.

**Analysis:** There is a tension between ATS optimisation (more keywords = higher ATS score) and recruiter perception (too many keywords = obviously AI-generated). The PRD aims for 75-85% keyword coverage, which is at the high end of what can be naturally integrated. The system prompt for CV generation says "Mirror JD keyword language where the candidate genuinely has the skill" and "Rewrite highlights to incorporate JD keywords naturally" -- but "naturally" is subjective and hard for an LLM to calibrate, especially at 80% coverage targets. A more nuanced approach would distinguish between: (a) keywords that belong naturally in a CV for this type of role (e.g., "L&D strategy," "leadership development" -- these are natural vocabulary), (b) keywords that are company-specific jargon (e.g., "Workday Learning," "our proprietary framework" -- these should not be forced), and (c) keywords that are ATS-bait but sound unnatural when crammed in (e.g., every single action verb from the JD). The keyword priority system (critical/high/medium/low) partially addresses this, but the coverage target does not differentiate.

**Score: 5/10**

**Recommendations:**
- Lower the keyword coverage target to 65-75% and measure by priority-weighted coverage (critical keywords: 100%, high: 80%, medium: 50%, low: optional)
- Add a "naturalness" criterion to the QA pipeline: does the CV read as if written by a professional, or as if reverse-engineered from the JD?
- Distinguish between "core vocabulary" keywords (should be present) and "specific terminology" keywords (include only if genuinely relevant)
- Never incorporate keywords the candidate does not actually have experience with -- this is already in the prompt rules but should be reinforced in the coverage calculation
- Test generated CVs with a recruiter during Phase 8 to calibrate the right balance

---

**Round 6 of 10 -- "The system does not handle person specifications separately from job descriptions"**

**Concern:** Many UK roles, especially in the public sector and universities, have a separate person specification document alongside the job description. The person spec lists essential and desirable criteria explicitly, often in a table format. The JD analysis engine treats everything as a single "description" text field. If the person spec is not included in the job.description field (because Module 1 only scraped the JD page, not the separate person spec PDF), the tailoring misses the most important matching criteria.

**Analysis:** UK academic roles almost always have a person specification as a separate document (often a PDF or a separate section). Many public sector and larger corporate roles also use them. The person specification is the actual assessment criterion -- interviewers score candidates against each criterion in the person spec, not the job description narrative. If Module 1 only captures the narrative job description and not the person specification, Module 2's JD analysis will extract requirements from the narrative text, which may not perfectly align with the formal person spec criteria. The JD analysis does attempt to identify "implicit" requirements, which partially compensates. But for academic roles where the person specification is the definitive assessment document, missing it means the tailored CV may emphasise the wrong things. The master profile schema and the JD analysis schema do not have a concept of "person specification" as distinct from "job description."

**Score: 3/10**

**Recommendations:**
- Add support for person specifications: either as a separate input field in Module 1's job record, or by detecting and parsing person spec sections within the description text
- Add a "person_specification" field to the jobs table and the JD analysis input
- For academic roles, make person specification handling mandatory -- flag if no person spec is detected
- Train the JD analysis prompt to specifically identify and extract person specification criteria when present within the description text
- Consider adding a mechanism for the candidate to manually paste a person spec into a pending job before generation

---

**Round 7 of 10 -- "No handling of supporting statements"**

**Concern:** Many UK university applications and public sector roles require a "supporting statement" rather than or in addition to a cover letter. A supporting statement is a structured document that addresses each criterion in the person specification with specific evidence. It is typically 2-4 pages and follows a prescribed format. The system generates cover letters but not supporting statements, which means the candidate still has to write these manually for academic applications -- which are the most time-consuming applications.

**Analysis:** This is a significant gap for the academic application pathway. UK university applications typically require: (1) a CV, (2) a supporting statement addressing each criterion in the person specification, and sometimes (3) a cover letter or cover email. The supporting statement is often the most important document because shortlisting panels score each criterion against the statement. The PRD's academic cover letter (up to 800 words, 1-2 pages) is closer to a supporting statement than a cover letter, but it is not structured as one. A proper supporting statement would: list each criterion from the person specification, provide specific evidence for each, and be structured to make scoring easy for the panel. The requirement_mappings data in Stage 2 (which maps each requirement to candidate evidence) is exactly the data needed to generate a supporting statement -- the system has the capability but does not use it.

**Score: 2/10**

**Recommendations:**
- Add a "supporting statement" document type for academic and public sector applications
- Use the Stage 2 mapping data to structure the supporting statement: each person specification criterion mapped to candidate evidence
- Generate the supporting statement alongside (or instead of) the cover letter for academic roles
- Format it as a structured document with clear criterion-by-criterion responses
- Include this as a Phase 3 enhancement or a mandatory part of the academic CV pipeline

---

**Round 8 of 10 -- "Recruiter contact and agency handling is missing"**

**Concern:** A significant proportion of UK L&D roles at the GBP 70-80k level are handled by recruitment agencies (Hays, Michael Page, Robert Walters). Agency-listed roles have different application conventions: you send your CV to the recruiter, not the hiring company. The cover letter should address the recruiter, not the company. The JD may mention the client company or may keep it confidential. The system makes no distinction between direct employer roles and agency-listed roles.

**Analysis:** The JD analysis prompt (Section 7.4) and cover letter generation prompt (Section 9.4) treat all roles as direct employer applications. But for agency roles, several things change: (1) the cover letter should address the recruitment consultant by name if listed, (2) the cover letter should reference the client company differently (e.g., "your client" rather than "the company"), (3) the CV may need to be formatted differently (some agencies reformat CVs in their own template -- sending a heavily designed CV to an agency is pointless), (4) the application may need to include salary expectations (agencies often require this), (5) confidential roles where the company is not named need different cover letter language. The JD analysis does not classify whether the posting is from an agency or direct employer, and the cover letter generation has no conditional logic for agency applications. Since agency roles are common in the target salary range, this is not an edge case.

**Score: 3/10**

**Recommendations:**
- Add a `listing_type` field to the JD analysis: "direct_employer", "recruitment_agency", "confidential"
- Add agency-specific cover letter templates and generation rules
- For agency roles: use simpler CV formatting (agency will likely reformat), address the consultant by name, mention salary expectations if configured
- For confidential roles: adjust cover letter language to not reference a specific company
- Detect agency names in the JD (Hays, Michael Page, Robert Walters, Reed, etc.) to auto-classify

---

**Round 9 of 10 -- "No handling of video applications, LinkedIn Easy Apply, or non-standard submission formats"**

**Concern:** The UK job market is moving towards varied application formats. LinkedIn Easy Apply does not accept cover letters. Some roles ask for video introductions. Others use online forms where you paste text into boxes (and a formatted CV is useless). Others use specific ATS portals where you upload a CV but the cover letter goes into a text box. The system produces PDF and DOCX documents but does not consider the actual submission channel.

**Analysis:** The PRD correctly identifies PDF and DOCX as the primary formats (US-205), which covers most traditional application channels. But the UK job market is increasingly diverse in submission methods. Module 1 scrapes jobs from LinkedIn, Indeed, and job boards -- many of these have their own application mechanisms. LinkedIn Easy Apply uploads a CV but does not accept cover letters. Indeed applications sometimes go through an ATS-specific form. University job portals (like jobs.ac.uk) often have a multi-field form where you paste qualifications, experience, and supporting statement into separate text boxes. The system's output (formatted documents) is optimal for email applications and direct ATS uploads but suboptimal for form-based applications. Having the CV content available as structured JSON (which it is, in the cv_packages table) means it could be adapted for form-based applications -- but this capability is not exposed. The cover letter as plain text (not formatted) would also be useful for text-box applications.

**Score: 4/10**

**Recommendations:**
- Include plain-text versions of the CV and cover letter alongside PDF/DOCX (for pasting into text boxes)
- Add submission channel detection to the JD analysis: "direct_email", "ats_portal", "linkedin_easy_apply", "university_portal", "form_based"
- For LinkedIn Easy Apply roles: generate CV only, skip cover letter
- For form-based applications: generate structured text that can be pasted into fields
- Include submission format recommendations in the notification email

---

**Round 10 of 10 -- "The 80% callback rate target may be unmeasurable with this design"**

**Concern:** The primary success metric is 80%+ callback rate on automated applications. But to measure this, you need the candidate to track every application she sends using an automated CV, every callback she receives, and correctly attribute each callback to the CV version used. With 20-45 applications per week, this manual tracking is burdensome. And there is no control group -- she is not sending both manual and automated CVs to the same types of roles. The 90% manual baseline may reflect role selection quality (she only manually tailored for her best matches) rather than CV quality alone.

**Analysis:** The callback rate metric has several measurement problems. First, attribution: if the candidate uses an automated CV but edits it significantly before sending (status = 'approved_edited'), was the callback due to the AI generation or the human edits? Second, selection bias: the 90% manual baseline was on roles the candidate carefully selected and tailored for. Module 2 generates for all A/B-tier roles, which includes roles the candidate might have skipped if tailoring manually. Lower callback rates might reflect wider application casting, not worse CVs. Third, sample size: 80% callback rate needs a meaningful sample. At 30 applications per week, with perhaps 20 callbacks, you need 3-4 weeks of data minimum for statistical significance. Fourth, external factors: callback rates depend on market conditions, role competition, timing, and many factors beyond CV quality. The success metric is reasonable as a directional indicator but should not be treated as a precise measurement of CV quality.

**Score: 4/10**

**Recommendations:**
- Track separate callback rates for: approved (no edits), approved (with edits), and manually tailored applications
- Define a minimum sample size before evaluating the callback metric (e.g., 50 applications)
- Track callback rates by role type (corporate vs academic) separately -- they have different benchmarks
- Add confounding factor tracking: was this a recruiter application? Agency? Direct? LinkedIn?
- Consider A/B testing where possible: for similar roles, alternate between automated and manual CVs (difficult in practice but the gold standard)

---

**Persona 3 Summary: UK Recruitment Expert / Career Coach**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | ATS parsing of generated PDFs | 3/10 | Flex layout may garble text extraction order |
| 2 | Missing CV sections for senior roles | 4/10 | No Key Achievements, Technology, right to work, notice period |
| 3 | Academic CV conventions | 3/10 | Missing PhD supervision, HEA fellowship, administrative service |
| 4 | Cover letter sign-off conventions | 3/10 | "Dear Hiring Manager / Yours faithfully" is incorrect UK convention |
| 5 | Keyword stuffing risk | 5/10 | 75-85% coverage target risks unnatural reading |
| 6 | Person specification handling | 3/10 | No concept of separate person specification document |
| 7 | Supporting statement generation | 2/10 | Academic applications need structured supporting statements, not cover letters |
| 8 | Agency role handling | 3/10 | No distinction between agency and direct employer applications |
| 9 | Submission format diversity | 4/10 | Only PDF/DOCX, no plain text or form-optimised output |
| 10 | Callback rate measurability | 4/10 | Selection bias, attribution problems, no control group |

**Average Score: 3.4/10**

**Top 3 Critical Issues:**
1. No supporting statement generation for academic/public sector applications -- the most time-consuming applications are still manual
2. ATS parsing is assumed but never validated -- flex-based layouts may produce garbled text extraction
3. Missing academic CV sections (HEA fellowship, PhD supervision, administrative service) would make university applications appear incomplete

---

### Persona 4: AI/LLM Integration Specialist

*Expert in LLM application architecture, prompt engineering, hallucination prevention, cost optimisation, and production AI systems. Deep familiarity with Claude API capabilities and limitations.*

---

**Round 1 of 10 -- "Using a single LLM to validate its own output is fundamentally weak"**

**Concern:** The QA pipeline (Stage 4) uses Claude Sonnet to validate CV content that was also generated by Claude Sonnet (Stage 3). This is the same model family checking its own work. LLMs have systematic biases -- if the generator hallucinates in a way that seems plausible, the validator is likely to accept it for the same reasons the generator produced it. You need either a different model, a different approach, or deterministic checks that do not rely on the LLM at all.

**Analysis:** The PRD acknowledges that the QA stage uses "a different prompt (and potentially a different context framing)" but this is not the same as using a different model or approach. The same model with a different prompt still shares the same training biases, the same tendency to accept plausible-sounding fabrications, and the same difficulty distinguishing between "reasonable inference from the profile" and "hallucination." For example, if the CV generation stage writes "Led a team of 8 L&D professionals" when the profile says "Led a team of 5-8 L&D professionals depending on project," the QA stage may accept "8" as consistent because it is within the stated range -- but the candidate actually led 5 people most of the time. The programmatic checks in the QA pipeline (keyword coverage, UK English, word count, date consistency) are strong precisely because they are deterministic. But the hallucination detection -- the most critical check -- relies entirely on the LLM. The metrics_checked array in the QA report compares specific numbers, but this comparison is done by the LLM, not by code. A programmatic approach that extracts all numbers from the CV and cross-references them against the master profile would be more reliable.

**Score: 4/10**

**Recommendations:**
- Add a programmatic metrics extraction and comparison: regex-extract all numbers, dates, percentages from the generated CV and compare against the master profile programmatically
- Consider using a different model for QA (e.g., Haiku for generation validation, or GPT-4 as a cross-model check)
- Implement a "diff-based" hallucination check: every sentence in the CV must map to a source_ref in the profile; any sentence without a source_ref is flagged automatically
- Make the source_traceability output from Stage 3 mandatory (not optional) and validate it programmatically
- The LLM-based QA should be the third layer, after programmatic checks and source_traceability validation

---

**Round 2 of 10 -- "The mapping stage does too much for a Haiku call"**

**Concern:** Stage 2 (Candidate-JD Mapping) runs on Claude Haiku. This stage does: (1) searches the entire master profile for matches to each requirement, (2) classifies matches as strong/partial/weak/gap, (3) selects evidence items, (4) drafts CV bullet points incorporating JD keywords, and (5) determines CV structure including experience order and highlight selection. Step 4 (drafting bullet points) is a generation task, not an extraction task. Haiku is good at extraction but bullet point drafting requires the quality level of Sonnet. The mapping stage is doing both extraction and generation, but the model choice only suits extraction.

**Analysis:** The PRD correctly identifies that JD analysis (Stage 1) is an extraction task suitable for Haiku. But the mapping stage (Stage 2) has been overloaded with generation tasks. Drafting "suggested_cv_bullet" entries (Section 8.2 mapping output) requires the same writing quality as the full CV generation. If Haiku drafts these bullet points poorly, the subsequent Sonnet generation in Stage 3 may start from a weak foundation (since the mapping's suggested bullets could anchor the generation). The mapping output also determines which highlights to include and in what order -- these are judgement calls about relevance that benefit from a more capable model. The cost difference between Haiku and Sonnet for this task is small (~$0.002 vs ~$0.01 per mapping), and the mapping stage is called once per package. Saving $0.008 per package is not worth it if the quality of the match selection suffers.

**Score: 5/10**

**Recommendations:**
- Split Stage 2 into two sub-stages: 2a (extraction/matching on Haiku) and 2b (bullet drafting and structure decisions on Sonnet)
- Alternatively, upgrade the entire Stage 2 to Sonnet -- the cost increase is negligible ($0.008/package = $1/month at 30/week)
- Remove the "suggested_cv_bullet" generation from the mapping stage entirely and let Stage 3 handle all content generation
- Keep the mapping stage focused on what it does well: identifying matches, classifying them, and providing evidence references
- If Haiku is retained for Stage 2, validate that its match quality is comparable to Sonnet on a test set of 10 JD-profile pairs

---

**Round 3 of 10 -- "Temperature settings for CV generation are dangerously low"**

**Concern:** The CV generation temperature is 0.15. This is very low -- it will produce nearly deterministic output. If the same job type, same keywords, and same profile sections are selected for two similar roles, the system will generate nearly identical CVs. This creates a problem: if the candidate applies to two similar roles at the same company (or at companies that share recruiters), the CVs will be suspiciously similar. It also means the system cannot produce variety in phrasing over time -- the same achievement will always be rewritten the same way.

**Analysis:** Temperature 0.15 for CV generation is a conservative choice that prioritises consistency over variation. This has two negative effects. First, CV homogeneity: for the candidate's target market (corporate L&D, GBP 70-80k), many JDs contain similar keywords and requirements. Two L&D Manager roles at different companies will trigger similar JD analyses, similar mappings, and with temperature 0.15, nearly identical CV outputs. If both applications reach the same recruiter (common with agency roles), this is detectable. Second, staleness: over 30+ packages per week, the phrasing becomes repetitive. The same achievement gets rewritten the same way every time. The cover letter temperature is slightly higher (0.25) which helps, but the CV is the primary document. A better approach would be temperature 0.3-0.4 for generation with the existing strong constraints (JSON schema, explicit rules, source_traceability) to prevent hallucination while allowing natural phrasing variation.

**Score: 5/10**

**Recommendations:**
- Increase CV generation temperature to 0.3-0.4 and rely on the JSON schema constraints and hallucination rules to prevent quality degradation
- Increase cover letter temperature to 0.4-0.5 for more natural voice variation
- Add a "variation seed" to the prompt: include a random selection of 2-3 words from the JD that should be emphasised, creating natural variation between similar roles
- Implement a phrasing cache: track recently generated bullet phrasings and instruct Claude to vary them if the same achievement was used in the last 5 packages
- Test output quality at temperatures 0.15, 0.3, and 0.5 on 10 identical JDs to calibrate

---

**Round 4 of 10 -- "No structured output mode specified for Claude API calls"**

**Concern:** Section 8.5 mentions "Use Claude's structured output mode with JSON schema to enforce format" but the n8n workflow uses generic HTTP Request nodes for Claude API calls. The structured output (tool_use/forced_tool_call) or JSON mode on Claude's API requires specific API parameters. The PRD does not specify whether the API calls use `response_format: json`, tool use with a defined schema, or just rely on the system prompt saying "return JSON." Each approach has different reliability for getting valid JSON back.

**Analysis:** Claude's API has several mechanisms for structured output: (1) system prompt instruction ("return JSON"), (2) `response_format: { type: "json" }` parameter (not yet available on all Claude models as of early 2026), (3) tool use (define a tool with the output schema, force the tool call), (4) prefilling the assistant response with `{` to encourage JSON output. The PRD's n8n workflow uses HTTP Request nodes that POST to the Claude messages API. Without specifying which structured output mechanism is used, the implementation could rely on prompt instructions alone, which has ~90-95% reliability for well-formatted JSON. The remaining 5-10% of calls will produce JSON wrapped in markdown code fences, or with commentary before/after the JSON. The retry-with-corrective-prompt approach (Section 16.2) handles this, but it wastes tokens and time. Using tool use (defining the output as a tool schema and forcing the tool call) would give ~99.9% JSON reliability and eliminate most retries.

**Score: 4/10**

**Recommendations:**
- Specify exactly which Claude API mechanism is used for structured output in each stage
- For Stages 1-3, use tool use (define a tool matching the output schema, set `tool_choice: { type: "tool", name: "output_tool" }`) for reliable JSON output
- For Stage 4 (QA), use tool use for the QA report schema
- If tool use adds too much complexity in n8n HTTP Request nodes, at minimum prefill the assistant response with `{` and specify `stop_sequences: ["}"]` is NOT used (common mistake)
- Add response format validation immediately after parsing -- do not trust the LLM to always follow the schema even with tool use

---

**Round 5 of 10 -- "The prompt architecture leaks the full master profile to every API call"**

**Concern:** Every Claude API call in the pipeline receives the full master profile as context. The JD analysis does not need the profile at all. The QA validation needs the profile but not the JD. The cover letter generation receives the profile, the JD analysis, the mapping, AND the generated CV -- that is a lot of redundant context. Each unnecessary token in the prompt costs money and, more importantly, dilutes the model's attention.

**Analysis:** The PRD sends the full master profile (estimated 8,000-15,000 tokens) to Stages 2, 3, 3b (cover letter), and 4 (QA). Stage 1 (JD analysis) correctly does not include the profile. But Stage 3 (CV generation) receives both the full profile and the mapping output -- and the mapping output already contains the relevant subset of the profile (evidence items, selected highlights, suggested bullets). The full profile is redundant at this stage. Similarly, the cover letter prompt includes the profile, JD analysis, mapping, AND the generated CV -- four large context blocks where two would suffice (the CV content and JD keywords are enough for a cover letter). The QA validation includes the generated CV and the full profile, which is appropriate for hallucination checking. Total tokens across all stages: roughly 4x the profile size plus the other contexts. Sending a pruned profile (only the sections referenced in the mapping) to Stages 3, 3b, and 4 could save 30-50% on input tokens.

**Score: 5/10**

**Recommendations:**
- Stage 1 (JD analysis): no profile needed -- already correct
- Stage 2 (mapping): full profile needed -- correct
- Stage 3 (CV generation): send only the profile sections referenced in the mapping output, not the full profile
- Stage 3b (cover letter): send the generated CV content and mapping only; the profile is redundant since the CV already contains the selected information
- Stage 4 (QA): send the generated CV and only the referenced profile sections (the source_traceability tells you which sections to include)
- Estimate token savings and cost reduction from this optimisation

---

**Round 6 of 10 -- "No prompt versioning or A/B testing infrastructure"**

**Concern:** The system has 4 main prompts (JD analysis, mapping, CV generation, cover letter) plus 2 secondary prompts (QA validation, trim/expand). These prompts are the most important lever for output quality. But the PRD stores prompts inline in n8n Code nodes, with no version tracking, no A/B testing capability, and no way to roll back a prompt change that degrades quality. When the candidate says "the CVs got worse this week," how do you diagnose whether a prompt change caused it?

**Analysis:** Prompt management is a well-known challenge in production LLM systems. The PRD's approach -- prompts embedded in n8n workflow nodes -- means that prompt changes are tracked only through n8n's workflow version history (if enabled) and are not independently versionable. There is no way to run prompt A and prompt B side-by-side on the same JD to compare output quality. There is no prompt changelog. When tuning happens in Phase 8, the prompt changes are made directly to the production prompts with no rollback mechanism other than manually undoing the changes in n8n. A better approach would store prompts in Postgres (a prompt_versions table) with version numbers, allowing the workflow to load the current active prompt version at runtime. This enables: version history, rollback, A/B testing (run 50% of packages with prompt v2, 50% with v1), and correlation between prompt version and quality metrics.

**Score: 3/10**

**Recommendations:**
- Create a `prompt_versions` table in Postgres with: prompt_name, version, prompt_text, is_active, created_at
- Load prompts from Postgres at runtime rather than hardcoding in n8n nodes
- Track which prompt version was used for each package (add prompt_version columns to cv_packages)
- Build a simple A/B testing mechanism: split traffic between prompt versions and compare QA scores and candidate ratings
- Maintain a prompt changelog documenting what changed and why

---

**Round 7 of 10 -- "The hallucination detection prompt has a confirmation bias problem"**

**Concern:** The hallucination detection prompt (Section 12.3) says "verify that every factual claim in the generated CV can be traced back to the candidate's master profile." But it then provides both the CV and the profile. The LLM will search the profile for justification for each CV claim -- and it is very good at finding weak justifications. If the CV says "managed a GBP 1.5M budget" and the profile says "budget_managed: GBP 1.2M+," the QA model may rationalise that "1.5M is within 1.2M+" and pass it. The prompt's framing ("verify... can be traced") biases toward verification rather than falsification.

**Analysis:** Confirmation bias in LLM validation is well-documented. When given a claim and a reference document, LLMs tend to find ways to confirm the claim rather than rigorously falsify it. The PRD's QA prompt attempts to mitigate this by saying "You are strict and adversarial -- assume the CV may contain fabricated content until proven otherwise." But adversarial framing alone does not eliminate confirmation bias. The metrics_checked array in the QA report compares CV values against profile values, but this comparison is done by the LLM, not deterministically. A value like "increased engagement by 60%" could be verified against a profile entry that says "improved engagement significantly" and the LLM might consider this verified because the claim is consistent with the profile's qualitative statement. The severities (critical/major/minor) are subjective and may be under-rated by a model that defaults to finding consistency. The authenticity_score threshold (>= 95 to pass) seems high but depends entirely on what the LLM considers a "claim" -- if it only checks 5 claims, one minor issue gives 80% and fails; if it checks 25 claims, one minor issue gives 96% and passes.

**Score: 4/10**

**Recommendations:**
- Replace LLM-based metrics verification with programmatic extraction and comparison (regex for numbers, dates, company names)
- Reframe the QA prompt as falsification rather than verification: "List all claims in the CV. For each, attempt to find a contradiction or lack of support in the profile."
- Add a "claim extraction" step before validation: have the LLM list every factual claim, then separately verify each
- Use exact string matching for company names, job titles, qualification names, and dates -- do not let the LLM fuzzy-match these
- Define "claim" explicitly in the prompt to ensure consistent granularity in the authenticity score denominator

---

**Round 8 of 10 -- "No caching strategy for repeated profile-JD patterns"**

**Concern:** The candidate targets a specific market (corporate L&D, GBP 70-80k). Many JDs in this market contain similar requirements: leadership development experience, CIPD or equivalent, stakeholder management, digital learning, budget management. The system will re-process the same profile-to-requirement mapping patterns repeatedly. There is no caching or reuse of previous mappings for similar requirements, which means every package starts from scratch.

**Analysis:** Over 30 packages per week, many mapping patterns will be repeated. "10+ years L&D experience" appears in almost every senior L&D JD. The mapping stage will find the same evidence, select the same highlights, and draft similar bullet points each time. This is wasted computation. A caching layer that stores previously generated mappings for common requirement patterns could: (a) reduce API calls by reusing mapping results for requirements seen before, (b) improve consistency by using proven mappings, and (c) reduce latency by skipping API calls for cached patterns. The risk of caching is staleness: if the profile is updated, cached mappings may reference old data. But the profile includes a version number, so the cache can be invalidated on version change. This optimisation is not essential for v1 but could reduce costs by 20-30% at scale.

**Score: 5/10**

**Recommendations:**
- Not critical for v1, but design the data model to support it: the mapping output already includes requirement_text and evidence source_refs
- For v2: implement a mapping cache keyed on (requirement_text_hash, profile_version) that stores previously generated evidence selections
- Cache bullet point phrasings for common requirements to reduce Sonnet calls
- Invalidate cache on profile version change
- Track cache hit rates as a cost optimisation metric

---

**Round 9 of 10 -- "Claude API deprecation risk is not addressed"**

**Concern:** The PRD hardcodes model names: `claude-haiku-4-5` and `claude-sonnet-4-5`. Anthropic has historically deprecated models with relatively short notice. If claude-haiku-4-5 is deprecated and replaced with claude-haiku-4-6 or renamed, the system will break. The model names are embedded in n8n HTTP Request nodes, not in a configurable parameter.

**Analysis:** Anthropic's model lifecycle has historically included deprecation of older model versions. The PRD locks to specific model versions, which is correct for reproducibility but risky for longevity. When a model is deprecated, the API returns errors for that model name, and the system fails. The n8n workflow would need manual updates to every HTTP Request node that specifies the model. With 5 Claude API calls per package across the pipeline, that is 5 nodes to update. The PRD does not have a centralised model configuration -- each node specifies its own model. A better approach would store model names in n8n credentials or environment variables, or in a Postgres configuration table, so that a single change updates all API calls. Additionally, the system should be tested when switching models to verify that output quality is maintained -- a newer model may behave differently with the same prompts.

**Score: 4/10**

**Recommendations:**
- Store model names in a centralised configuration (Postgres config table or n8n environment variables) rather than hardcoding in each node
- Add model version to the cv_generation_log so you can correlate model changes with quality changes
- Set up a model migration procedure: when Anthropic announces deprecation, run the test suite with the new model and compare output quality
- Consider using model aliases (if Claude API supports them) to allow automatic upgrades
- Add monitoring for Claude API error responses that indicate model deprecation

---

**Round 10 of 10 -- "The system has no learning loop from candidate feedback"**

**Concern:** US-211 describes a feedback loop where the candidate rates each package 1-5 with notes. But the feedback data goes into the cv_packages table and is never used. There is no mechanism to incorporate feedback into prompt improvements, profile updates, or generation preferences. The candidate's ratings and notes are recorded but ignored by the system. This means the system cannot improve over time without manual prompt engineering.

**Analysis:** The feedback mechanism is write-only. Ratings and notes are stored but never queried, analysed, or acted upon. The PRD describes Phase 8 tuning where "feedback patterns" are used to tune prompts, but this is a manual, one-time process. After Phase 8, there is no ongoing learning. The system could use feedback in several ways: (1) analyse patterns in low-rated packages (which JD types, which CV types, which prompt versions), (2) identify recurring edit patterns (if the candidate always adds the same skill to corporate CVs, add it to the profile), (3) use highly-rated packages as few-shot examples in future generation prompts, (4) track which bullet phrasings survive candidate editing (indicating quality) and which are rewritten (indicating the AI got it wrong). None of these are implemented or planned beyond the vague "monthly prompt review" in post-launch monitoring. The data is collected but the feedback loop is open, not closed.

**Score: 3/10**

**Recommendations:**
- Build an automated feedback analysis query that identifies patterns in low-rated packages (correlation between rating and: JD type, keyword coverage, match percentage, CV type)
- Use the highest-rated packages (5/5) as few-shot examples in the generation prompt (rotate them monthly)
- Track edit patterns: if the candidate consistently modifies the same section, flag this pattern and adjust the prompt or profile
- Generate a monthly "quality report" from feedback data showing trends and suggesting prompt adjustments
- Consider automated profile update suggestions based on recurring edits

---

**Persona 4 Summary: AI/LLM Integration Specialist**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Same model self-validation | 4/10 | LLM checking its own work shares biases |
| 2 | Haiku overloaded in mapping stage | 5/10 | Drafting bullet points needs Sonnet quality |
| 3 | Temperature too low for variation | 5/10 | Nearly identical CVs for similar roles |
| 4 | Structured output mechanism unspecified | 4/10 | Unclear if tool use or prompt-only JSON |
| 5 | Full profile sent to every call | 5/10 | Redundant tokens increase cost 30-50% |
| 6 | No prompt versioning | 3/10 | No A/B testing, no rollback, no changelog |
| 7 | Confirmation bias in QA | 4/10 | Verification framing biases toward acceptance |
| 8 | No caching for repeated patterns | 5/10 | Same mappings recomputed for similar JDs |
| 9 | Model deprecation risk | 4/10 | Hardcoded model names, no centralised config |
| 10 | No learning from feedback | 3/10 | Feedback collected but never used |

**Average Score: 4.2/10**

**Top 3 Critical Issues:**
1. No prompt versioning or A/B testing -- the most impactful quality lever has no change management
2. Same-model self-validation with confirmation bias -- the hallucination check is weaker than it appears
3. Feedback data is collected but never used -- the system cannot improve over time without manual intervention

---

### Persona 5: Privacy & Compliance Officer

*Specialist in UK data protection (GDPR/UK GDPR), Equality Act 2010, employment law, and AI governance. DPO-qualified with experience advising on automated decision-making systems.*

---

**Round 1 of 10 -- "The GDPR analysis is dangerously superficial"**

**Concern:** Section 17.1 dismisses GDPR with "since this is a single-user system where the candidate is also the system operator, GDPR compliance is straightforward." This is wrong. GDPR applies to the processing of personal data regardless of who operates the system. The master profile contains referee personal data (names, emails, phone numbers, organisations) -- data about third parties who have not consented to their data being processed by this system or sent to Anthropic's API. The candidate being the data controller does not exempt her from GDPR obligations toward the referees whose data she processes.

**Analysis:** The PRD correctly identifies that referee data is sensitive and takes steps to protect it (Section 17.4: referees not sent to Claude API, added post-generation). However, the broader GDPR analysis is incomplete. The candidate processes personal data about: (1) herself (no GDPR issue -- individual processing for personal use), (2) her referees (third-party data requiring a lawful basis), (3) potentially, hiring managers whose names appear in JDs (minimal risk). For referee data, the candidate needs: (a) a lawful basis for processing (legitimate interest or consent), (b) to inform referees that their data is stored in a cloud database on Hetzner servers, (c) to provide referees with data subject rights (access, erasure, rectification). The "household exemption" in GDPR (Article 2(2)(c)) exempts purely personal/household activities from GDPR, but a systematic job application operation with automated processing on cloud infrastructure is arguably beyond "household" use. Additionally, the master profile stored on Hetzner contains referee email addresses and phone numbers -- even if not sent to Claude, they are stored in a German-hosted cloud database. The PRD should at least acknowledge these considerations even if the practical risk is low.

**Score: 3/10**

**Recommendations:**
- Remove or encrypt referee contact details in the Postgres master profile; add them only at the document rendering stage from a separate, locally-stored file
- Document the lawful basis for processing referee data (consent is simplest: ask referees for permission to store their details)
- Add a data processing record (Article 30) even if simplified, listing all personal data processed, purposes, and recipients
- Consider whether the "household exemption" applies; if uncertain, treat it as not applying and comply accordingly
- Add referee data handling to the cleanup workflow: delete referee details for referees who request removal

---

**Round 2 of 10 -- "Anthropic's data retention is a GDPR transfer issue"**

**Concern:** The master profile is sent to Anthropic's Claude API. Anthropic is a US company. The profile contains the candidate's name, email, phone, employment history, and qualifications -- all personal data. Sending this to a US company constitutes an international data transfer under GDPR. The PRD notes that "Anthropic does not train on API inputs/outputs" and "API data is retained for up to 30 days" but does not address the legal mechanism for the international transfer itself. Post-Schrems II, transferring personal data to the US requires either Standard Contractual Clauses (SCCs), an adequacy decision, or another GDPR-compliant mechanism.

**Analysis:** This is a genuine compliance gap. Anthropic's API terms of service may include SCCs or reference the EU-US Data Privacy Framework (if the US has re-established adequacy by 2026). But the PRD does not verify this. The candidate, as data controller, is responsible for ensuring that international transfers have a lawful basis. This is admittedly a common gap in many AI-powered systems, and the practical enforcement risk for a single-user personal system is extremely low. However, if the candidate is applying for compliance-sensitive roles (which she may be, given her HR background), demonstrating awareness of her own data handling practices could be important. Additionally, Anthropic's 30-day retention of API data means the candidate's personal data is stored on US servers for 30 days after each API call. With 30 packages per week and 4-5 API calls per package, the candidate's data is persistently present on Anthropic's servers due to rolling retention.

**Score: 3/10**

**Recommendations:**
- Verify that Anthropic's API terms include SCCs or reference the EU-US Data Privacy Framework
- Document the legal basis for international data transfer in the system documentation
- Minimise personal data sent to Claude: use initials instead of full name in the master profile sent to the API, redact phone numbers and email addresses (they are not needed for CV content generation)
- Consider using a data proxy that strips personally identifiable information before sending to Claude and re-injects it post-generation
- Review Anthropic's Data Processing Addendum (DPA) and ensure it meets UK GDPR requirements

---

**Round 3 of 10 -- "No Data Protection Impact Assessment (DPIA)"**

**Concern:** Under GDPR Article 35, a Data Protection Impact Assessment is required when processing is "likely to result in a high risk to the rights and freedoms of natural persons." Automated processing of personal data that could affect employment (which is what this system does -- it generates CVs that determine whether someone gets job interviews) arguably meets the threshold for a DPIA. The PRD does not mention a DPIA.

**Analysis:** The DPIA threshold is debatable for a single-user system. The ICO (UK's data protection authority) guidance identifies several criteria that suggest a DPIA is needed: (a) automated decision-making with legal or similarly significant effects, (b) systematic monitoring, (c) sensitive data, (d) data concerning vulnerable individuals, (e) innovative use of technology, (f) data processed on a large scale. This system arguably meets criteria (a) -- the automated CV tailoring affects the candidate's employment prospects -- and (e) -- LLM-based document generation is an innovative technology application. However, the ICO also acknowledges that not every automated system requires a DPIA, and the scale here (single user) is minimal. A proportionate response would be to conduct a lightweight DPIA that documents: what data is processed, who processes it (Anthropic, Hetzner, Resend), what the risks are, and what mitigations are in place. The PRD's privacy section (Section 17) contains elements of a DPIA but is not structured as one.

**Score: 4/10**

**Recommendations:**
- Conduct a lightweight DPIA structured around the ICO's template: describe the processing, assess necessity and proportionality, identify and assess risks, identify mitigations
- Document this as an appendix to the PRD or as a separate document
- Focus on the key risk: the system could generate misleading CV content that harms the candidate's career
- Identify the human oversight mechanism (candidate review before submission) as the primary mitigation
- Review annually or when the system changes significantly

---

**Round 4 of 10 -- "The Equality Act compliance check is superficial and misses indirect discrimination risks"**

**Concern:** Section 17.6 focuses on excluding protected characteristic data (no photo, DOB, marital status, nationality, gender, religion). That addresses direct discrimination risks. But the Equality Act 2010 also prohibits indirect discrimination -- practices that appear neutral but disproportionately disadvantage people with protected characteristics. An AI system that frames Indian university experience as inherently needing "translation" for UK audiences could subtly convey otherness. A cover letter that over-explains the candidate's right to work (when a white British candidate would never mention it) signals non-British origin.

**Analysis:** The PRD's Equality Act compliance addresses what should be excluded from CVs (Section 17.6) but not how content choices could create indirect discrimination. Several system design decisions have potential indirect discrimination implications. First, the "international experience framing" guidance (Section 8.6) uses language like "UK-familiar terminology" and "terms UK employers understand" -- while practically necessary, this framing implicitly positions Indian experience as foreign and requiring translation, which is a form of othering. Second, the right-to-work statement is included "if configured" -- but if the candidate always includes it because of her immigration background, while British-born candidates never do, this reveals national origin. Third, the academic CV template does not address potential bias in how non-UK qualifications are presented. Fourth, the system applies the same templates regardless of the employer's diversity commitments -- a more sophisticated system might frame international experience as a strength for employers who value diversity. The PRD should at least acknowledge these risks and include guidelines for bias-aware content generation.

**Score: 4/10**

**Recommendations:**
- Add bias-awareness instructions to the CV generation prompt: "Frame international experience as a strategic asset, not as something that needs translation"
- Make the right-to-work statement conditional on whether the employer requires it, not a default inclusion
- Review the Indian experience framing to ensure it positions cross-cultural competence as a strength rather than framing UK-unfamiliarity as a gap to overcome
- Add a diversity-aware framing option: for employers with strong diversity statements, emphasise the candidate's international perspective as value-add
- Consider whether the system's language choices could inadvertently reveal protected characteristics and add automated checks

---

**Round 5 of 10 -- "Generated documents create a data trail that could be discoverable"**

**Concern:** The system generates 20-45 CV packages per week, stored on disk with metadata in Postgres. Each package contains: a tailored CV, a cover letter, a gap analysis, keyword coverage data, and a QA report. This creates a detailed record of every application the candidate has made, which jobs she was interested in, and what her gaps were. If the candidate is ever in an employment dispute (constructive dismissal, discrimination claim), this data could be discoverable. More concerning: the QA reports and gap analyses document the candidate's weaknesses in specific terms, which an opposing legal team could use.

**Analysis:** This is an unusual risk that most PRDs do not consider but is relevant for someone actively job searching while potentially still employed. The stored data includes: (1) evidence of job searching activity (relevant in constructive dismissal or garden leave disputes), (2) self-assessed gaps and weaknesses (discoverable by an employer in discrimination or performance proceedings), (3) detailed application history with timing and frequency data, (4) salary expectations and target ranges. The 6-month retention policy limits exposure but does not eliminate it. The gap analysis data is particularly sensitive: a report saying "Gap: No experience with SAP SuccessFactors (essential requirement)" becomes a documented weakness that an employer could reference. The data retention policy (Section 17.3) keeps this data for 6 months after job expiry, which could span the entire duration of a probation period at a new employer. A more privacy-protective approach would separate the generation metadata (keep for cost tracking) from the content metadata (gap analyses, QA reports with specific weaknesses) and apply shorter retention to the latter.

**Score: 4/10**

**Recommendations:**
- Separate operational metadata (cost, timing, model used) from content metadata (gap analysis, weakness assessments) in the data retention policy
- Apply a shorter retention period (30 days) to gap analysis and QA report content
- Consider encrypting the cv_content and cover_letter_content JSONB columns at rest
- Add a "purge my data" mechanism that can wipe all content data while preserving operational metrics
- Document that the candidate should be aware of discoverability risks if involved in employment proceedings

---

**Round 6 of 10 -- "Resend email contains sensitive career data in transit"**

**Concern:** The notification email (WF12) contains: job title, company, tier, match percentage, gap details, QA score, and attached CV and cover letter PDFs. This email is sent via Resend (a third-party email service). The email content and attachments pass through Resend's servers in transit. If the candidate's email is intercepted, compromised, or accessed by a current employer (who may monitor corporate email), the entire job search activity is exposed.

**Analysis:** Email is inherently insecure. The PRD sends detailed application data via email, including attachments containing the candidate's personal details, employment history, and targeted roles. If the candidate uses a corporate email address (even accidentally configured), the current employer could access this data. Even with a personal email, the data passes through Resend's servers and the email provider's servers in plaintext (standard email is not end-to-end encrypted). The notification email includes sufficient detail to reconstruct the candidate's job search strategy: which companies she is targeting, what salary range she expects, what her perceived gaps are. This is commercially sensitive information. The attached PDFs contain the candidate's full name, contact details, employment history, and qualifications. Resend, as a service, retains email logs and may retain email content for debugging. The PRD does not address: which email address is used, whether the email connection uses TLS, whether Resend has a DPA in place, or whether email content should be minimised.

**Score: 3/10**

**Recommendations:**
- Minimise email content: send a notification with job title and match score only, with a link to retrieve documents (not as attachments)
- Implement a simple document retrieval mechanism (even a pre-signed URL with 24-hour expiry) rather than email attachments
- Ensure the candidate uses a personal (non-corporate) email address
- Verify Resend's DPA and data retention policies
- Consider using Resend's TLS enforcement to ensure encrypted delivery
- Add an option to send notifications via Telegram (encrypted) instead of email

---

**Round 7 of 10 -- "No consent mechanism for sending the candidate's data to Anthropic"**

**Concern:** Even though the candidate operates the system, there should be a documented consent mechanism acknowledging that her personal data will be sent to a third-party AI service. If the candidate later claims she did not understand what data was being shared with Anthropic, there is no documented consent. This is especially important because the system is built by someone else (the developer), not the candidate herself.

**Analysis:** The system is built for a specific candidate by a developer. The candidate may not fully understand the technical details of how her data flows through the system -- specifically, that her entire employment history, qualifications, and personal details are sent to Anthropic's API servers with each package generation. The PRD's mitigation (Section 17.2: not sending referee details, not sending full addresses) shows awareness but does not address informed consent. From a GDPR perspective, transparency (Articles 13-14) requires that data subjects be informed about: what data is processed, by whom, for what purpose, and who receives it. Even in a single-user system, documenting this transparency is good practice. A simple "data processing notice" that the candidate reviews and acknowledges would suffice. This also protects the developer: if the candidate later objects to how her data was handled, documented consent provides a defence.

**Score: 4/10**

**Recommendations:**
- Create a one-page data processing notice for the candidate describing: what data is collected, how it is processed, who receives it (Anthropic, Resend, Hetzner), retention periods, and her rights
- Have the candidate acknowledge this notice before the system goes live
- Store the acknowledgement date in the system
- Include a data flow diagram showing where personal data goes at each stage
- Review and re-acknowledge annually or when the system changes

---

**Round 8 of 10 -- "The system could generate content that violates the Equality Act if not carefully controlled"**

**Concern:** The system generates cover letters that "address specific requirements from the JD." Some JD requirements may be discriminatory (e.g., requiring "native English speaker" or "recent UK graduate"). The system should detect and not reinforce discriminatory requirements. If the cover letter addresses a discriminatory requirement (e.g., "As a native English speaker..."), the candidate is complicit in the discrimination and may also be making a false statement.

**Analysis:** This is a subtle but real risk. UK JDs occasionally contain requirements that are potentially discriminatory under the Equality Act 2010: age-related language ("young and dynamic team"), nationality requirements ("must be a native English speaker"), gender-coded language ("he/she will..."), or requirements that indirectly discriminate (e.g., "must have attended a Russell Group university"). The system's JD analysis identifies "red flags" but does not specifically flag discriminatory language. The CV and cover letter generation could inadvertently address discriminatory requirements. For example, if a JD says "must be a UK national," the cover letter might address this by stating the candidate's right to work -- which is appropriate -- but could also prompt the AI to add nationality statements that reveal protected characteristics. The system should detect discriminatory requirements and exclude them from the tailoring process, rather than trying to address them.

**Score: 4/10**

**Recommendations:**
- Add "discriminatory language detection" to the JD analysis stage as a specific check
- Flag requirements that may be discriminatory: age-related, nationality-based, gender-coded, disability-related
- Do not generate CV or cover letter content that addresses discriminatory requirements
- Add to the red_flags output: a specific flag for Equality Act concerns
- Include guidance in the notification email if discriminatory language was detected: "This JD contains language that may be discriminatory. Consider whether to apply."

---

**Round 9 of 10 -- "No right to explanation for AI-generated content"**

**Concern:** Under GDPR Article 22, data subjects have rights regarding automated decision-making. While the candidate is the data subject and the system does not make decisions about other people, the generated content (specifically the gap analysis and match percentage) constitutes automated profiling of the candidate. The candidate should understand how the match percentage is calculated, why certain gaps were identified, and how the AI decided which experience to emphasise. The system provides a QA report but not an explanation of the generation logic.

**Analysis:** GDPR Article 22 rights are typically invoked when an automated system makes decisions about a person (e.g., credit scoring, automated hiring decisions). In this system, the automated decision is the candidate's own match percentage and gap analysis -- which affects her decision about whether to apply. The Article 22 risk is low because the candidate has the final say (she reviews and decides whether to submit). However, the principle of explainability is still relevant. The mapping output (Stage 2) contains the reasoning for why each requirement was matched or identified as a gap, but this is stored as JSON in the database and not presented to the candidate in an accessible format. The notification email includes gap summaries but not the full reasoning. If the candidate disagrees with a gap assessment (e.g., the system says she lacks "digital learning" experience when she believes she has it), she has no way to understand why the system made that assessment or to correct it for future packages.

**Score: 5/10**

**Recommendations:**
- Include the mapping rationale (why each requirement was classified as match/partial/gap) in the notification email or a linked report
- Make the gap analysis explanatory: not just "Gap: No experience with Workday" but "Gap: The JD requires Workday Learning experience. Your profile includes LMS experience with Cornerstone OnDemand but not Workday specifically."
- Provide a mechanism for the candidate to dispute gap classifications (e.g., "I do have this experience -- update my profile")
- Add explainability to the match percentage: show the calculation breakdown
- Document the AI decision-making process in the data processing notice

---

**Round 10 of 10 -- "Webhook endpoints are unauthenticated"**

**Concern:** The Master Profile Manager (WF10) and Regeneration Handler (WF11) are triggered by webhooks at `/webhook/profile` and `/webhook/regenerate`. The PRD does not mention any authentication on these endpoints. Anyone who discovers the webhook URLs can read the candidate's entire master profile (GET /webhook/profile), modify it (PUT /webhook/profile), or trigger regeneration of CV packages. These endpoints are exposed on the public internet through n8n's webhook system.

**Analysis:** n8n webhooks are public by default unless authentication is configured. The webhook URLs follow a predictable pattern (`/webhook/profile`, `/webhook/regenerate`) making them guessable. If the n8n instance is exposed to the internet (which it likely is, given it runs on a Hetzner server with Dokploy), these endpoints are accessible to anyone. The GET endpoint would expose the candidate's full master profile including personal details, employment history, and potentially referee data. The PUT endpoint could allow an attacker to replace the master profile with malicious data. The regeneration endpoint could trigger unnecessary API costs by forcing regeneration of packages. n8n supports webhook authentication (header auth, basic auth, JWT) but none is configured in the PRD. This is a straightforward security vulnerability.

**Score: 2/10**

**Recommendations:**
- Add authentication to all webhook endpoints: at minimum, a shared secret in an Authorization header
- Use n8n's built-in "Header Auth" or "Basic Auth" options for webhook authentication
- Consider restricting webhook access by IP if the candidate always accesses from a known IP
- Move the profile management to a non-guessable webhook path (UUID-based)
- Add rate limiting to prevent abuse
- Log all webhook access for audit purposes

---

**Persona 5 Summary: Privacy & Compliance Officer**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | GDPR analysis depth | 3/10 | Referee data handling and third-party obligations ignored |
| 2 | International data transfer | 3/10 | No SCCs or transfer mechanism documented for Anthropic |
| 3 | Data Protection Impact Assessment | 4/10 | No DPIA conducted despite automated personal data processing |
| 4 | Indirect discrimination risks | 4/10 | Indian experience framing could create othering |
| 5 | Data discoverability in disputes | 4/10 | Gap analyses create documented weakness records |
| 6 | Email security for career data | 3/10 | Sensitive data sent via email with attachments |
| 7 | Consent mechanism | 4/10 | No documented consent for data sharing with Anthropic |
| 8 | Discriminatory JD content handling | 4/10 | No detection of discriminatory requirements |
| 9 | Right to explanation | 5/10 | Gap analysis reasoning not accessible to candidate |
| 10 | Webhook authentication | 2/10 | Public unauthenticated endpoints expose personal data |

**Average Score: 3.6/10**

**Top 3 Critical Issues:**
1. Unauthenticated webhook endpoints expose the master profile and allow unauthorized modification
2. No documented legal basis for international data transfer to Anthropic (US)
3. Sensitive career data (gaps, weaknesses, application history) sent via email and stored without encryption

---

## Overall Evaluation Summary

### Scores by Persona

| Persona | Average Score | Range |
|---------|--------------|-------|
| 1. The Candidate (Selvi) | 3.6/10 | 2-6 |
| 2. Technical Architect / n8n Expert | 4.4/10 | 3-6 |
| 3. UK Recruitment Expert / Career Coach | 3.4/10 | 2-5 |
| 4. AI/LLM Integration Specialist | 4.2/10 | 3-5 |
| 5. Privacy & Compliance Officer | 3.6/10 | 2-5 |
| **Overall Average** | **3.84/10** | **2-6** |

### Top 10 Must Fix (Before Go-Live)

| # | Issue | Persona | Score | Why Critical |
|---|-------|---------|-------|-------------|
| 1 | **No review/approval interface** -- candidate has no way to approve, reject, rate, or provide feedback on packages | Candidate | 2/10 | Without this, the system has no user-facing interaction beyond email |
| 2 | **Unauthenticated webhook endpoints** expose personal data and allow unauthorised profile modification | Compliance | 2/10 | Direct security vulnerability on public internet |
| 3 | **No application lifecycle tracking** -- cannot record outcomes, cannot measure the primary success metric | Candidate | 2/10 | Makes the entire success framework theoretical |
| 4 | **No supporting statement generation** for academic applications -- the most time-consuming applications are still manual | Recruitment | 2/10 | Major gap in academic application support |
| 5 | **Stuck jobs in 'generating' status forever** after workflow crash -- no recovery mechanism | Technical | 3/10 | Jobs silently lost, no self-healing |
| 6 | **Loop error handling** does not isolate failures -- one bad job blocks remaining batch | Technical | 3/10 | Single failure cascades to entire batch |
| 7 | **Cover letter sign-off convention wrong** -- "Dear Hiring Manager / Yours faithfully" is incorrect UK convention | Recruitment | 3/10 | Every cover letter contains a UK convention error |
| 8 | **No prompt versioning** -- most impactful quality lever has no change management, rollback, or A/B testing | AI/LLM | 3/10 | Cannot safely iterate on quality |
| 9 | **GDPR international transfer** to Anthropic not documented with SCCs or legal mechanism | Compliance | 3/10 | Legal compliance gap |
| 10 | **ATS parsing not validated** -- flex CSS layouts may garble text extraction in Workday/iCIMS | Recruitment | 3/10 | CVs may be functionally invisible to ATS despite correct visual appearance |

### Top 10 Should Fix (During Phase 8 or Shortly After)

| # | Issue | Persona | Score | Why Important |
|---|-------|---------|-------|-------------|
| 1 | **Notification overload** -- individual emails for 20-45 jobs/week; needs daily digest | Candidate | 3/10 | UX bottleneck replaces tailoring bottleneck |
| 2 | **No personal context injection** -- candidate cannot add job-specific notes before generation | Candidate | 3/10 | Priority roles miss personal touch |
| 3 | **Academic CV missing key sections** -- no HEA fellowship, PhD supervision, administrative service | Recruitment | 3/10 | University applications appear incomplete |
| 4 | **Sensitive career data via email** with attachments; needs secure delivery | Compliance | 3/10 | Email interception exposes job search |
| 5 | **Same-model self-validation** -- hallucination check shares biases with generator | AI/LLM | 4/10 | False sense of safety |
| 6 | **Gotenberg ARM64 rendering** not validated; potential pagination differences | Technical | 4/10 | Corporate CVs may overflow to 3 pages |
| 7 | **No post-render page count validation** for corporate CVs | Technical | 4/10 | 2-page constraint not enforced |
| 8 | **Confirmation bias in QA prompt** -- verification framing rather than falsification | AI/LLM | 4/10 | Subtle hallucinations pass QA |
| 9 | **Indian experience framing** too shallow -- vocabulary swaps without contextualisation | Candidate | 5/10 | Cross-cultural experience undervalued |
| 10 | **No person specification handling** -- academic applications miss the primary assessment criteria | Recruitment | 3/10 | Tailoring based on wrong criteria |

### Top 5 Nice-to-Have (Post-Launch Improvements)

| # | Issue | Persona | Score | Value |
|---|-------|---------|-------|-------|
| 1 | **Caching for repeated mapping patterns** -- reduce API costs by 20-30% | AI/LLM | 5/10 | Cost optimisation |
| 2 | **Submission format diversity** -- plain text versions for form-based applications | Recruitment | 4/10 | Better coverage of application channels |
| 3 | **Agency role detection and handling** -- different cover letter conventions | Recruitment | 3/10 | Covers a significant segment of target market |
| 4 | **Automated feedback analysis** -- correlate ratings with JD type, coverage, CV type | AI/LLM | 3/10 | Closes the learning loop |
| 5 | **Temperature tuning and variation seeding** -- prevent identical CVs for similar roles | AI/LLM | 5/10 | Reduces detection risk |

### Overall Assessment

The PRD is technically ambitious and impressively detailed in its AI pipeline design, prompt engineering, and database schema. The four-stage pipeline (analyse, map, generate, validate) is well-architected. The master profile schema is thorough. The cost estimates and infrastructure choices are sensible.

However, the PRD has a fundamental imbalance: it over-invests in generation and under-invests in the human interaction layer. The system can generate a tailored CV but the candidate has no practical way to review it, approve it, track it, or provide feedback that improves future outputs. The generation pipeline is a 37-node n8n workflow specified to the individual node level. The review workflow is one sentence: "The candidate reviews and submits manually."

The UK recruitment expertise shows in places (CIPD handling, corporate vs academic CV split, UK spelling) but has notable gaps (wrong sign-off convention, missing academic sections, no person specification support, no supporting statement generation, no agency handling).

The privacy section underestimates the complexity of GDPR compliance even for a single-user system, particularly around third-party data (referees), international transfers (Anthropic), and security (unauthenticated webhooks).

For a v1 PRD, a score of 3.84/10 is within the expected range. The core generation pipeline is solid (5-6/10 territory). The surrounding systems -- UX, feedback, compliance, error recovery -- need significant development before this system is ready for daily use.

---

## 23. 50-Round Critical Roleplay Evaluation (v2)

**Evaluation Date:** 2026-03-29
**PRD Version Evaluated:** 2.0
**Evaluator Profile:** Top 0.1% product/engineering evaluator
**Methodology:** 5 personas x 10 rounds each = 50 independent critical evaluations. Each round raises a NEW concern not previously identified in v1. Scores reflect v2 improvements -- 5-7/10 expected for a solid v2.

**Context:** v1 scored 3.84/10. v2 addressed the top issues: added review interface (Section 19), daily digest notifications (Section 14.5), supporting statement generation (Section 9b), person specification handling, academic CV sections (PhD supervision, HEA fellowship, admin service), fixed cover letter sign-off conventions, added webhook authentication, personal context injection, application lifecycle tracking, post-render page count checks, cross-model QA validation (Haiku for QA), programmatic metrics extraction, expanded international data transfer documentation, and reframed the hallucination prompt toward falsification.

This evaluation focuses on REMAINING weaknesses, deeper analysis, and edge cases.

---

### Persona 1: The Candidate (Selvi) -- v2

*PhD, MBA, 18 years in HR/L&D. Targeting corporate L&D roles (GBP 70-80k) and UK university lecturer positions near Maidenhead. Currently achieves 90% callback rate on manually tailored applications.*

---

**Round 1 of 10 -- "The review UI is a single HTML file with no offline capability"**

**Concern:** The review interface (Section 19.8) is described as "a single HTML file with embedded JavaScript" using vanilla JS and `fetch()`. I review CVs on my commute, at coffee shops, and sometimes on my phone at the school gate. If I lose internet for even a moment, the review UI becomes useless. There is no offline capability, no local caching, and no progressive web app features. For someone reviewing 5-10 packages daily, this is a real friction point.

**Analysis:** The design choice of a single HTML file is pragmatic for a single-user system and avoids build toolchain complexity. However, the implementation relies entirely on live API calls to webhook endpoints for every action -- listing packages, viewing details, downloading files. There is no service worker, no local storage caching of previously viewed packages, and no optimistic UI updates. If the Hetzner server goes down for maintenance or the network connection drops, the candidate loses access to all packages. The review interface also lacks any form of state persistence -- if the candidate starts reviewing a package on her phone, switches apps, and comes back, the page reloads and she starts over. For a system generating 20-45 packages per week that the candidate needs to review within 48-72 hours (before roles close), the review interface needs to be more resilient than a plain HTML page making synchronous API calls.

**Score: 5/10**

**Recommendations:**
- Add localStorage caching of the package list and recently viewed package details so the dashboard works offline
- Implement a service worker for basic offline support -- at minimum, cache the last-loaded dashboard view
- Add optimistic UI updates for approve/reject actions: update the local state immediately, sync when connection returns
- Consider making the review UI a Progressive Web App (PWA) installable on the candidate's phone
- Add auto-save for in-progress feedback forms so data is not lost on navigation or connection drop

---

**Round 2 of 10 -- "No way to edit the generated CV text before downloading"**

**Concern:** The review interface (Section 19.4) shows CV preview, download buttons, and approve/reject actions. But there is no inline editing capability. If I spot a minor issue -- a bullet point that could be stronger, a word that feels wrong -- I have to download the DOCX, open it in Word, make the edit, save it, and then somehow tell the system I edited it. The "Approve with Notes" action records that edits were made but the system never sees the actual edits. Over 20-45 packages per week, the download-edit-save cycle adds significant friction for what might be single-word changes.

**Analysis:** The review interface provides read-only preview and download capability, but no way to make edits within the interface itself. This creates a split workflow: review in the browser, edit in Word, submit from neither. The system records "approved_edited" as a status but has no way to capture what was edited, which means the feedback loop is incomplete. If the candidate consistently changes the same phrase across multiple packages, the system cannot detect this pattern because it never sees the edits. The PRD acknowledges this implicitly by tracking "approved without edits" vs "approved with edits" as separate metrics (Section 3.3), but the edit workflow itself is undefined. A lightweight inline editing capability -- even just the ability to edit individual bullet points in the preview and regenerate the DOCX/PDF with those changes -- would significantly reduce review time and capture edit data for prompt improvement.

**Score: 4/10**

**Recommendations:**
- Add inline text editing in the CV preview: clicking a bullet point makes it editable, changes are saved back to cv_content JSONB, and documents are re-rendered
- At minimum, add a "quick edit" form where the candidate can override specific bullet points or sections before re-rendering
- Capture the diff between the AI-generated content and the candidate's edits as structured data for prompt tuning
- Store the edited cv_content as a separate field (cv_content_edited) alongside the original, enabling diff analysis
- Track which sections are most frequently edited to prioritise prompt improvements

---

**Round 3 of 10 -- "The daily digest timing at 07:00 does not account for overnight generation gaps"**

**Concern:** The daily digest fires at 07:00 UK time (Section 14.5). But Module 1 scrapes and scores throughout the day. If a job is scored at 18:00 on Monday, Module 2 generates the package by 18:30. That package sits unnotified until 07:00 Tuesday -- a 12.5-hour delay. For competitive roles that fill within 48-72 hours, losing 12 hours is significant. Conversely, if a job is scored at 06:00 Tuesday, the package generated at 06:30 misses the 07:00 digest and waits until 07:00 Wednesday -- a 24.5-hour delay.

**Analysis:** The daily digest reduces notification noise (a v1 problem) but introduces a different problem: notification latency. The worst case is a package generated at 07:01 that waits nearly 24 hours for the next digest. The PRD does include a fallback to immediate notifications if `notification_mode = 'immediate'` is configured, but this returns to the v1 overload problem. A better design would be a hybrid approach: immediate notification for A-tier roles (high priority, time-sensitive) and daily digest for B-tier roles (lower priority, less time-sensitive). Alternatively, a twice-daily digest at 07:00 and 17:00 would cut the maximum delay to 12 hours. The current design forces a binary choice between overload and latency.

**Score: 5/10**

**Recommendations:**
- Implement a hybrid notification mode: immediate email for A-tier roles, daily digest for B-tier
- Or send two digests per day: 07:00 and 17:00 UK time, halving maximum notification latency
- Add a "time since generation" indicator in the digest so the candidate can prioritise time-sensitive packages
- Include an urgency flag in the digest for packages where the original job posting has a closing date within 72 hours
- Allow the candidate to configure the digest schedule (time and frequency) through the review UI

---

**Round 4 of 10 -- "How do I handle a role I have already been informally referred for?"**

**Concern:** Personal context injection (Section 19.5) lets me add notes before generation. But sometimes I have already been informally referred to a role by a contact, or I have already sent an initial expression of interest. If Module 1 discovers the same role from a job board and Module 2 generates a package, I now have an automated CV that might conflict with what I already communicated. There is no way to mark a job as "already in progress" to prevent Module 2 from generating a redundant package.

**Analysis:** The personal context injection mechanism allows adding notes but does not allow suppressing generation entirely. Section 19.5 mentions the candidate can "skip generation for specific jobs" from the review interface, but this only works for jobs that have not yet been processed. If the 15-minute polling interval picks up the job before the candidate sees it, the package is generated anyway. The skip mechanism requires the candidate to be actively monitoring the pending queue -- which contradicts the system's goal of reducing the candidate's workload. There is no "exclusion list" or "already in contact" flag that would prevent generation for specific companies or roles. For a candidate who is actively networking (which Selvi is, at CIPD conferences and industry events), some roles will already have a personal application in progress when Module 1 discovers them.

**Score: 4/10**

**Recommendations:**
- Add a company/role exclusion list: the candidate can specify companies or role titles where Module 2 should not auto-generate
- Add a "generation_hold" status that delays generation by 4 hours, giving the candidate time to add context or skip
- Add a "defer to manual" option in the review interface that suppresses generation and marks the job as manually handled
- Surface pending jobs in the daily digest before generation happens, with a "skip" option
- Add a "I am already in contact" flag that prevents generation and records the existing application channel

---

**Round 5 of 10 -- "No comparison view when I have multiple similar roles to choose between"**

**Concern:** When Module 1 surfaces 5 similar "Head of L&D" roles in the same week, I need to compare them side by side to decide which to prioritise. The review interface shows one package at a time. There is no way to compare match percentages, gap analyses, or salary ranges across multiple packages simultaneously. I am forced to open multiple browser tabs and mentally compare, or maintain my own spreadsheet.

**Analysis:** The dashboard view (Section 19.3) shows a sortable table with match %, QA score, gaps, and status -- which provides basic comparison. But the table view lacks contextual comparison features. When evaluating similar roles, the candidate needs to see: which roles have the same gap (so she can decide if that gap is worth addressing), which roles at the same company are redundant, and how the roles differ in what they emphasise. The detail view shows each package in isolation. A side-by-side comparison view showing 2-3 packages with matched gap analyses would help the candidate make faster decisions about which roles to pursue. This is particularly important because applying to too many similar roles at the same company (or through the same agency) can look unfocused.

**Score: 5/10**

**Recommendations:**
- Add a multi-select comparison view: select 2-3 packages and view their match %, gaps, and key differences side by side
- Group packages by company in the dashboard view to prevent duplicate applications to the same employer
- Add a "similar roles" indicator that links packages with >80% keyword overlap
- Include a "recommended application order" based on closing date, match %, and tier
- Add a weekly summary view showing the best packages to prioritise

---

**Round 6 of 10 -- "The supporting statement generation does not handle mixed-format person specifications"**

**Concern:** Section 9b handles supporting statements well for academic roles with clear person specifications. But many UK public sector and university person specs are inconsistent: some embed criteria in prose paragraphs, some use tables, some list criteria without clear essential/desirable separation, and some include criteria that span multiple competency areas. The system assumes a clean essential/desirable split, but real person specs are messier than that.

**Analysis:** The supporting statement generation (Section 9b) assumes the JD analysis has already cleanly extracted person specification criteria into `essential_criteria` and `desirable_criteria` arrays. But this extraction depends on the JD analysis prompt (Stage 1) correctly parsing diverse person spec formats. UK university person specs come in many forms: tabular formats with "E" and "D" columns, numbered lists, embedded prose where criteria are implied rather than stated, and documents that combine the JD and person spec into a single narrative. The JD analysis prompt (Section 7.4) includes "Detect and separately parse person specification criteria when present" but provides no guidance on handling ambiguous formats. If the JD analysis produces an incomplete or incorrectly categorised person spec, the supporting statement will miss criteria that the shortlisting panel is scoring against. This is a garbage-in-garbage-out risk at the extraction layer.

**Score: 5/10**

**Recommendations:**
- Add person specification parsing examples to the JD analysis prompt covering the three most common formats: tabular, numbered list, and embedded prose
- Add a confidence score to each extracted person specification criterion indicating parsing certainty
- Flag person specifications with fewer than 4 criteria as potentially incomplete, prompting the candidate to verify
- Allow the candidate to manually add or correct person specification criteria through the review interface before generating the supporting statement
- Test person specification extraction against 10 real university job posts from jobs.ac.uk

---

**Round 7 of 10 -- "No handling of 'further particulars' documents common in academic hiring"**

**Concern:** UK university applications often include a "further particulars" document -- a PDF or web page separate from the job listing that describes the department, research themes, teaching priorities, and institutional strategy. This context is critical for writing a compelling academic cover letter and supporting statement, but Module 1 only captures the job listing text. Without further particulars, the cover letter will be generic about the department.

**Analysis:** The system receives only `job.description` from Module 1. For academic roles, the description on jobs.ac.uk or a university website is often a summary that says "For further particulars, see [link]." The actual detailed information -- the department's research clusters, teaching load expectations, the REF strategy, the university's strategic plan -- is in a separate PDF. Without this information, the academic cover letter and supporting statement cannot reference specific departmental research themes, name modules the candidate could teach, or align with the department's strategic direction. The cover letter generation prompt (Section 9.4, academic variant) asks the AI to reference "the specific department and research areas" but the AI only has the summary JD text. This produces cover letters that are competent but generic, which is exactly what academic shortlisting panels penalise.

**Score: 4/10**

**Recommendations:**
- Add a `further_particulars_url` or `further_particulars_text` field to Module 1's jobs table, captured during scraping or added manually by the candidate
- For jobs where further particulars are available, fetch and include them in the JD analysis input
- At minimum, allow the candidate to paste further particulars text into the personal context injection field before generation
- Train the JD analysis prompt to detect "further particulars" links in JD text and flag them
- For academic roles without further particulars, flag the cover letter as "generic -- consider adding departmental context"

---

**Round 8 of 10 -- "The system does not help me decide whether to apply at all"**

**Concern:** The gap analysis shows me what I match and what I do not. But it does not give me a recommendation: should I apply to this role, or is the gap too large? I do not want to waste time reviewing and submitting packages for roles where my gaps make rejection almost certain. Currently, the system generates packages for every A/B-tier job indiscriminately. The match_percentage is shown but there is no "apply/skip" recommendation based on UK hiring conventions.

**Analysis:** The system generates packages for all A/B-tier roles, regardless of match quality. A job might be scored A-tier by Module 1 (based on title, salary, and sector fit) but have a 55% match percentage in Module 2 (because the candidate lacks several essential requirements). The candidate still receives a package and must spend review time evaluating it. The gap analysis (Section 8.2) classifies gaps as strong_match, partial_match, weak_match, or gap -- but there is no heuristic that says "if you have gaps on more than 2 essential criteria, your probability of callback drops below 50%." UK hiring conventions typically require candidates to meet all essential criteria for shortlisting (especially in public sector and academic roles). A candidate who misses 3 essential criteria in a university person spec will not be shortlisted regardless of how strong other areas are. The system should provide a "likelihood of shortlisting" score based on how many essential criteria are matched.

**Score: 5/10**

**Recommendations:**
- Add a "shortlisting probability" heuristic: if >1 essential criteria are classified as "gap", flag the package as "unlikely to be shortlisted" with an explanation
- For academic roles, apply the UK academic convention: all essential criteria must be met for shortlisting
- Add a "recommended action" to the daily digest: "Strong candidate -- apply promptly" / "Consider -- has gaps in X" / "Unlikely -- missing essential criteria X, Y"
- Allow the candidate to set a minimum match threshold below which packages are auto-archived rather than sent for review
- Track whether the shortlisting prediction correlates with actual callback rates to calibrate over time

---

**Round 9 of 10 -- "The review interface has no undo for accidental rejections"**

**Concern:** Section 19.4 shows action buttons: Approve, Approve with Notes, Reject, Regenerate. If I accidentally click Reject on a high-priority package (easy to do on mobile), there is no undo. The status goes to 'rejected' in the database. I cannot recover the package without triggering a full regeneration, which wastes time and API credits. At 07:00 on a Monday morning reviewing 8 packages in the digest, mis-clicks happen.

**Analysis:** The review interface lacks any undo or confirmation mechanism. Status changes appear to be immediate and irreversible (POST to the webhook updates the database directly). There is no confirmation dialog ("Are you sure you want to reject this package?"), no undo window, and no way to change a rejected package back to "ready" without regeneration. The status CHECK constraint in the cv_packages table (Section 13.5) does not prevent a status from being changed back -- the values are 'generating', 'qa_failed', 'qa_review', 'ready', 'approved', 'approved_edited', 'rejected', 'applied', 'expired', 'superseded'. There is no status transition validation in the backend that prevents going from 'rejected' back to 'ready'. However, the webhook backend (WF13) does not implement a status-reversal endpoint. The candidate would need developer help to undo a mistake.

**Score: 5/10**

**Recommendations:**
- Add a confirmation dialog for reject and approve actions, especially on mobile
- Implement a 30-second undo window after any status change: show a toast notification with "Undo" button
- Add a "Restore" action for rejected packages that changes status back to 'ready' without regeneration
- Log all status changes with timestamps for audit trail
- Make the mobile UI touch targets large enough to prevent accidental taps on action buttons

---

**Round 10 of 10 -- "No way to share a package with a mentor or career advisor for second opinion"**

**Concern:** Before submitting to my most important roles, I sometimes ask a trusted mentor to review my CV. The current system has no sharing mechanism. I would have to download the PDF, email it to my mentor, wait for feedback, make changes in Word, and then submit. If the review interface had a "share for review" feature (even a time-limited read-only link), I could get a second opinion without the file-shuffling overhead.

**Analysis:** This is a quality-of-life feature rather than a critical gap, but it reflects a broader issue: the system is designed as a closed loop between the AI and the candidate, with no room for external input into the review process. The review interface is authenticated with a single token (Section 14.3), so sharing access would mean sharing the authentication token, which grants full access to all packages and the master profile. There is no role-based access control or package-level sharing. For a single-user system, fine-grained access control is over-engineering. But a simple mechanism -- a pre-signed URL that provides read-only access to a single package's PDF for 48 hours -- would enable mentor review without compromising security.

**Score: 5/10**

**Recommendations:**
- Add a "Share for review" button that generates a time-limited, read-only URL for a single package's PDF
- The shared URL should not require authentication and should expire after 48 hours
- The shared view shows only the CV and cover letter PDFs, not the gap analysis, QA report, or master profile data
- Track shared links for security audit
- Consider adding a "reviewer comment" mechanism on the shared link (simple text input)

---

**Persona 1 v2 Summary: The Candidate (Selvi)**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Review UI offline capability | 5/10 | Single HTML page with no offline resilience |
| 2 | Inline CV editing | 4/10 | No way to edit text within the review interface |
| 3 | Digest timing and latency | 5/10 | Up to 24-hour notification delay for packages |
| 4 | Already-in-progress roles | 4/10 | No way to suppress generation for roles already being pursued |
| 5 | Multi-package comparison | 5/10 | No side-by-side comparison view |
| 6 | Mixed-format person specs | 5/10 | Assumes clean essential/desirable split |
| 7 | Further particulars documents | 4/10 | Academic applications miss critical departmental context |
| 8 | Apply/skip recommendation | 5/10 | No shortlisting probability guidance |
| 9 | Undo for accidental actions | 5/10 | No confirmation or undo for reject/approve |
| 10 | Sharing for second opinion | 5/10 | No mechanism to share a package with a mentor |

**Average Score: 4.7/10**

**Top 3 Issues:**
1. No inline editing capability -- forces download-edit-reupload workflow for minor text changes
2. No mechanism to suppress generation for roles already being pursued through other channels
3. Missing further particulars context makes academic cover letters generic

---

### Persona 2: Technical Architect / n8n Expert -- v2

*Senior platform engineer with deep experience in n8n workflow automation, Docker orchestration on ARM64, and document generation pipelines.*

---

**Round 1 of 10 -- "The review UI backend (WF13) is a monolithic webhook handler for all CRUD operations"**

**Concern:** Section 19.7 shows WF13 as a single webhook workflow handling all review interface endpoints -- GET packages list, GET single package, POST approve, POST reject, POST feedback, POST outcome, GET file downloads. In n8n, a single webhook can only bind to one HTTP method and one path. The PRD describes 8 different endpoints but does not explain how they are routed through a single workflow. Either there are 8 separate webhook nodes (meaning 8 separate n8n workflows or 8 webhook triggers in one workflow, which n8n does not support), or there is a single webhook that parses the URL path and method manually in a Code node.

**Analysis:** n8n's webhook node binds to a specific path and method. To handle multiple endpoints, you need either: (a) one workflow per endpoint (8 workflows for the review interface alone, bringing the total to 13+ workflows), (b) a single webhook with a wildcard path and a Code node that routes requests based on URL parsing, or (c) using n8n's new "Webhook" node with a path parameter and query string parsing. Option (b) is the most likely intent but is fragile: URL parsing in a Code node must handle path parameters (`/packages/{id}/approve`), query strings for filtering, and method discrimination. This is essentially building a micro web framework inside an n8n Code node. It works but is hard to debug, hard to test, and prone to routing errors. The PRD shows a node sequence for GET /packages (4 nodes) and POST /packages/{id}/feedback (4 nodes) but does not show how these are combined or how request routing works. If implemented as separate workflows, the workflow count grows to 13+, which becomes a maintenance burden in n8n's visual workflow editor.

**Score: 4/10**

**Recommendations:**
- Explicitly specify the routing architecture: either N separate webhook workflows or a single router workflow with documented URL parsing logic
- If using a single router: implement the routing in a dedicated Code node at the start of the workflow, with explicit handling for unmatched routes (404)
- Consider grouping related endpoints: one workflow for read operations (GET list, GET detail, GET file), one for write operations (POST approve, POST reject, POST feedback, POST outcome)
- Document the URL path matching logic and test it with edge cases (missing ID, invalid path, wrong method)
- Add request validation at the router level before any database operations

---

**Round 2 of 10 -- "Static HTML served from n8n webhooks has no caching or CDN"**

**Concern:** The review UI (Section 19.8) is served as a static HTML file "from n8n's webhook system or from the /templates/review-ui/ volume mount." n8n's webhook system is not designed to serve static assets. Every page load triggers a webhook execution, which counts against n8n's execution quota and adds latency. There is no browser caching header, no CDN, and no asset optimization. If the candidate refreshes the dashboard 20 times a day while reviewing packages, that is 20 workflow executions just to serve the same HTML file.

**Analysis:** Serving static files through n8n webhooks is architecturally wrong. Each request triggers a full workflow execution: webhook trigger -> Code node (read file) -> respond. This adds 200-500ms of latency compared to serving from a web server or filesystem. It also consumes execution resources that could be used for actual CV generation. n8n on the Hetzner CAX31 likely has an execution timeout and queue, and each static file serve is a wasted queue slot. The alternative -- serving from the volume mount directly -- requires a reverse proxy (Caddy, Nginx, or Dokploy's built-in Traefik) to serve the `/templates/review-ui/` directory. This is straightforward but not described in the PRD. The JS in the HTML file makes API calls to webhook endpoints, which is fine, but the HTML itself should not be served through a webhook.

**Score: 4/10**

**Recommendations:**
- Serve the static review UI HTML/JS/CSS from a proper web server, not through n8n webhooks
- Use Dokploy's Traefik reverse proxy to serve the `/templates/review-ui/` directory at a subdomain or path
- Add browser caching headers (Cache-Control, ETag) to reduce redundant file transfers
- Keep the API endpoints as n8n webhooks but separate the static asset serving
- Add basic compression (gzip) for the HTML/JS content

---

**Round 3 of 10 -- "The WF8 orchestrator has no concurrency lock between 15-minute poll intervals"**

**Concern:** WF8 runs every 15 minutes. Each run processes up to 5 jobs. But what if a run takes longer than 15 minutes? At 3-5 minutes per job times 5 jobs, a full run could take 15-25 minutes. The next cron trigger fires at the 15-minute mark, starting a second instance of WF8 while the first is still running. Both instances query the same pending view. If the first instance is still processing job 3, the second instance picks up jobs 4-10 (including jobs 4 and 5 that the first instance has not yet reached). Now two instances might try to create cv_packages rows for the same jobs simultaneously.

**Analysis:** n8n's cron trigger does not check whether a previous execution is still running. By default, overlapping executions are allowed. The v_pending_cv_generation view filters on `cp.id IS NULL` (no cv_packages row), so once WF8 creates the cv_packages row for a job (node [6]), subsequent runs will not pick it up. However, there is a race window: if two executions both query the view at nearly the same time (before either has created cv_packages rows), they may both pick up the same jobs. The UNIQUE constraint on (job_id) in cv_packages would prevent duplicate rows, causing one execution to fail with a constraint violation. The PRD's error handling says "Constraint violation: Log and skip (likely duplicate processing)" which is correct behavior. But this wastes the failed execution's prior API calls (JD analysis, potentially mapping) for that job. More fundamentally, if runs regularly overlap, the system is processing more jobs per interval than planned, potentially hitting Claude API rate limits.

**Score: 5/10**

**Recommendations:**
- Enable n8n's "Limit parallel executions" setting for WF8 to 1, preventing overlapping runs
- Alternatively, add a "SELECT FOR UPDATE SKIP LOCKED" pattern to the pending jobs query, so concurrent executions process different jobs
- Reduce the max jobs per run from 5 to 3 if the average run time is >10 minutes
- Add execution time monitoring: if a run exceeds 12 minutes, log a warning and reduce batch size on the next run
- Consider an adaptive polling interval: if the previous run completed in 3 minutes, poll again in 12 minutes; if it took 14 minutes, skip one interval

---

**Round 4 of 10 -- "The file download endpoint in the review UI bypasses authentication in practice"**

**Concern:** Section 19.2 lists `GET /webhook/{uuid}/packages/{id}/files/{type}` for downloading PDF/DOCX files. The {uuid} in the path is described as a "UUID-based prefix to prevent URL guessing" (Section 14.3). But UUIDs are not secrets -- they are identifiers. If the UUID is leaked (in browser history, server logs, or the Referer header), anyone with the URL can download the candidate's CV files. The Header Auth token provides authentication, but the file download endpoint may need to work without authentication if the candidate wants to share a link (Section 19.5 mentions links in the digest email).

**Analysis:** There is an architectural tension between authenticated API endpoints and usable download links. The daily digest email (Section 14.5) includes "Link to review interface for this package" -- but the review interface requires authentication. If the candidate clicks the link from her email, she needs to authenticate. If authentication is via a header token, she cannot just click a link -- she needs the review UI to add the header. The DOCX/PDF download links face the same problem: a direct URL cannot include a header-based auth token. The options are: (a) include the token in the URL as a query parameter (security risk, logged everywhere), (b) use cookie-based auth (requires session management, not described), (c) use pre-signed URLs with time-limited access (more complex but secure), or (d) accept that the UUID provides sufficient security (security by obscurity, not recommended). The PRD does not address this tension.

**Score: 4/10**

**Recommendations:**
- Implement pre-signed download URLs with a 24-hour expiry for file downloads: append a HMAC signature and timestamp to the download URL
- For the review UI itself, use a session cookie set after the first authenticated API call, so subsequent navigation does not require the header token
- Never put the auth token in URLs or query parameters
- Add the pre-signed URL mechanism to the daily digest email links
- Log all file download access with IP and timestamp for audit

---

**Round 5 of 10 -- "Gotenberg memory limits are too tight for concurrent academic CV rendering"**

**Concern:** The docker-compose (Appendix C) sets Gotenberg memory limits at 512MB (hard) / 256MB (soft). The PRD processes jobs sequentially (Loop Over Items), so concurrent Gotenberg calls should not happen. But WF9 (Document Renderer) renders 4 documents per package: CV PDF, CV DOCX, Cover Letter PDF, Cover Letter DOCX. The PDF renders go through Gotenberg sequentially within WF9. An academic CV at 5 pages with dense text and multiple sections is heavier to render than a 2-page corporate CV. Chromium's memory usage scales with page count and DOM complexity. A 5-page academic CV render might use 350-400MB, leaving Gotenberg's Chromium process with very little headroom within the 512MB limit.

**Analysis:** Gotenberg uses Chromium to convert HTML to PDF. Chromium's memory usage depends on: DOM node count, CSS complexity, page count, and font loading. The academic CV template (Section 11.3) includes multiple sections with loops (employment entries, publications, teaching modules, conference presentations, referees), each generating DOM nodes. A 5-page academic CV with 15+ publications, 10+ teaching modules, and 5+ conference presentations could produce a DOM with 500+ nodes. Chromium renders this in a headless browser tab that maintains the full DOM in memory. On ARM64, Chromium's memory usage tends to be 10-15% higher than on x86 due to different memory allocation strategies. The 512MB hard limit could cause OOM kills during rendering of dense academic CVs, causing WF9 to fail silently (Gotenberg returns a 503 or the container restarts). The PRD's error handling for Gotenberg failures says "Retry once; skip PDF, generate DOCX only" which is a reasonable fallback, but if academic CV PDFs consistently fail, the candidate never gets PDF versions of her academic applications.

**Score: 5/10**

**Recommendations:**
- Increase Gotenberg memory limits to 1GB hard / 512MB soft to provide adequate headroom for academic CVs
- Test rendering of the longest plausible academic CV (5 pages, maximum publications and teaching entries) and measure actual memory usage
- Add Gotenberg container restart monitoring: if the container restarts during rendering, log a critical alert
- Consider rendering academic CVs in sections if memory remains an issue (render pages 1-3, then 4-5, then merge PDFs)
- Add a DOM complexity estimate before rendering and skip PDF generation if the estimate exceeds a safe threshold

---

**Round 6 of 10 -- "No database backup strategy for cv_packages JSONB data"**

**Concern:** The cv_packages table stores large JSONB columns: mapping_data, cv_content, cover_letter_content, and qa_report. At 30 packages per week, after 6 months the table contains ~780 rows with potentially 50-100KB of JSONB per row. If the Postgres database is corrupted or the Hetzner server fails, all generated CV content, QA reports, and application tracking data is lost. The PRD mentions filesystem backup for generated documents but has no database backup strategy.

**Analysis:** The system accumulates irreplaceable data: the master profile (single source of truth for the candidate's career), all application tracking data (outcomes, ratings, callback rates), and the generated content (which the candidate may reference months later when preparing for interviews). The master profile can be rebuilt from source materials, but the application tracking data and feedback history cannot be recreated. The Hetzner CAX31 does not include automatic backups. Dokploy may provide snapshot capability, but this is not documented. Postgres streaming replication to a second server would be over-engineering for a single-user system, but pg_dump to a remote location on a schedule is straightforward and essential.

**Score: 4/10**

**Recommendations:**
- Add a daily pg_dump backup to a remote location (Hetzner's S3-compatible object storage is cheapest)
- Add backup verification: restore the backup to a test database weekly and validate key queries
- Implement point-in-time recovery capability using Postgres WAL archiving (if the Hetzner plan supports it)
- Back up the /templates/ and /data/generated-cvs/ directories alongside the database
- Document the recovery procedure: given a backup, how long does it take to restore the system to operational state?

---

**Round 7 of 10 -- "The supporting statement generation has no separate template or document rendering path"**

**Concern:** Section 9b defines supporting statement generation (prompt, structure, output schema) but Section 10 (Document Generation Pipeline) only describes paths for CV PDF/DOCX and Cover Letter PDF/DOCX. There is no template for the supporting statement, no rendering step in WF9 for it, no file naming convention, no storage path, and no field in cv_packages for the supporting statement file paths. The generation logic exists but the output path does not.

**Analysis:** This is an implementation gap. Section 9b produces a JSON output with opening_paragraph, essential_criteria_responses, desirable_criteria_responses, contribution_statement, and closing_paragraph. But there is no HTML template to render this into a PDF, no DOCX template, and no WF9 node sequence for rendering the supporting statement. The cv_packages table (Section 13.5) has cv_pdf_path, cv_docx_path, cover_letter_pdf_path, and cover_letter_docx_path but no supporting_statement_pdf_path or supporting_statement_docx_path. The review interface (Section 19.4, point 7) mentions "Supporting Statement PDF/DOCX (if applicable)" in the download buttons, but the files are never created. The daily digest email template (Section 14.5) does not reference supporting statements. This means the v2 fix for supporting statements is incomplete: the AI generation is specified but the document output pipeline is not.

**Score: 3/10**

**Recommendations:**
- Create supporting statement HTML and DOCX templates (structure should follow Section 9b.3 with criterion-by-criterion sections)
- Add supporting statement rendering to WF9's node sequence (parallel path alongside cover letter rendering)
- Add supporting_statement_pdf_path and supporting_statement_docx_path columns to cv_packages
- Add supporting statement to the file naming convention (e.g., selvi_oxford_lecturer_supporting-statement_20260329T1030.pdf)
- Update the daily digest email to indicate when a supporting statement is included in the package

---

**Round 8 of 10 -- "The stale-job detection gap from v1 was identified but not fully addressed"**

**Concern:** The v1 evaluation (Persona 2, Round 9) identified that jobs stuck in 'generating' status after a crash have no recovery mechanism. The v2 PRD's v_pending_cv_generation view now includes `AND cp.status != 'superseded'` but still has `cp.id IS NULL` as the primary filter. A job with a cv_packages row in 'generating' status is still stuck -- the view excludes it because `cp.id IS NOT NULL`. There is no stale-generation cleanup routine visible in the v2 workflow specifications.

**Analysis:** The v1 recommendation was to "add a stale-generation check to WF8: at the start of each run, find cv_packages with status = 'generating' and updated_at older than 30 minutes, reset them to allow retry." The v2 PRD does not appear to have implemented this. The v_pending_cv_generation view filters on `cp.id IS NULL` and `j.cv_package_status IS NULL`, both of which exclude jobs with stuck cv_packages rows. The WF8 node sequence (Section 14.1) does not include a stale-job recovery step at the beginning of the workflow. The health check (Section 16.4) checks Gotenberg connectivity, Postgres connectivity, disk space, and template availability, but not for stale generating jobs. This means the v1 stuck-job vulnerability persists in v2.

**Score: 3/10**

**Recommendations:**
- Add a stale-generation cleanup step as node [1.5] in WF8, before querying pending jobs: UPDATE cv_packages SET status = 'failed' WHERE status = 'generating' AND updated_at < NOW() - INTERVAL '30 minutes'
- Also reset the corresponding jobs.cv_package_status to NULL so the job re-enters the pending queue
- Log stale-job resets as warnings for debugging
- Add a counter to prevent infinite retry loops: if a job has been stuck and reset more than 3 times, mark it as permanently failed
- Include stale-generation count in the health check output

---

**Round 9 of 10 -- "The review UI authentication model does not support browser-based sessions"**

**Concern:** The review interface uses Header Auth with WEBHOOK_AUTH_TOKEN (Section 14.3). Browser-based JavaScript cannot easily set custom HTTP headers on navigation requests (page loads, link clicks). The JS `fetch()` API can set headers on AJAX requests, but the initial page load and any form submissions or link navigations cannot include custom auth headers. This means the review UI can authenticate API calls but cannot authenticate the initial page load or file downloads through normal browser navigation.

**Analysis:** This is a fundamental impedance mismatch between n8n's webhook authentication (header-based) and browser-based web application authentication (cookie or token-based). The review UI works like this: the candidate opens the HTML file in a browser (no auth needed since it is a static file), then the JS code makes fetch() calls to the webhook API with the auth token in headers. This works for AJAX calls but breaks for: (1) direct file downloads (clicking a PDF link triggers a browser navigation, which cannot include auth headers), (2) deep linking (bookmarking a specific package page requires the token to be in the URL or a cookie), (3) sharing links from the digest email (the email link must include auth somehow). The typical solution is to set the auth token in a secure HTTP-only cookie after the first authenticated request, then use cookie-based auth for subsequent requests. But n8n's webhook system does not support cookie-based authentication natively.

**Score: 4/10**

**Recommendations:**
- Implement a token exchange on first load: the JS sends the auth token via header, the webhook returns a short-lived session token as a cookie
- Use the session cookie for subsequent requests including file downloads
- For file downloads, generate pre-signed URLs (HMAC + expiry) that do not require header auth
- For digest email links, include a short-lived URL token (e.g., 24-hour expiry JWT) in the link
- Document the auth flow clearly for future maintenance

---

**Round 10 of 10 -- "No monitoring for n8n community node updates or breakages"**

**Concern:** The system depends on three community n8n packages (text-templater, docxtemplater, resend). These packages are installed at container startup via the N8N_COMMUNITY_PACKAGES environment variable without version pinning. If n8n auto-updates a community package to a version with breaking changes (which n8n can do during restarts or upgrades), the CV generation pipeline fails silently. There is no version lock, no update notification, and no compatibility testing before updates apply.

**Analysis:** The v1 evaluation flagged community node supply chain risk (Persona 2, Round 2). The v2 PRD still specifies `N8N_COMMUNITY_PACKAGES=n8n-nodes-text-templater,n8n-nodes-docxtemplater,n8n-nodes-resend` without version pinning (Appendix B says "latest" for text-templater and resend, "1.0.0+" for docxtemplater). n8n's community package system pulls the latest version at install time. If the container restarts (which happens during Dokploy deployments, server reboots, or OOM kills), n8n may install a newer version of these packages. Breaking changes in a template rendering package could cause all CVs to render incorrectly without any error -- the template engine might produce HTML with different formatting, or silently drop conditionals. There is no smoke test after package installation, no rendered output comparison, and no alert if a package version changes.

**Score: 4/10**

**Recommendations:**
- Pin exact versions in N8N_COMMUNITY_PACKAGES: n8n-nodes-text-templater@1.2.3,n8n-nodes-docxtemplater@1.0.0,n8n-nodes-resend@1.4.5 (use the current working versions)
- Add a post-restart smoke test: after n8n starts, render a known template with known data and compare the output hash against an expected value
- Store the current package versions in a health check response so version changes are visible
- Subscribe to the GitHub repositories for these packages to be notified of updates and breaking changes
- Build the fallback DOCX generation path using the Code node (NODE_FUNCTION_ALLOW_EXTERNAL=docx) so docxtemplater breakage does not block all DOCX output

---

**Persona 2 v2 Summary: Technical Architect / n8n Expert**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Review UI backend routing | 4/10 | Monolithic webhook handler, unclear routing |
| 2 | Static file serving via webhooks | 4/10 | Wrong architecture, wastes execution slots |
| 3 | Concurrent WF8 execution overlap | 5/10 | No execution lock, potential race conditions |
| 4 | File download authentication | 4/10 | Header auth incompatible with browser downloads |
| 5 | Gotenberg memory for academic CVs | 5/10 | 512MB limit tight for 5-page renders |
| 6 | Database backup strategy | 4/10 | No backup for irreplaceable application data |
| 7 | Supporting statement rendering gap | 3/10 | Generation specified but document pipeline missing |
| 8 | Stale-job recovery still missing | 3/10 | v1 stuck-job vulnerability persists |
| 9 | Browser auth impedance mismatch | 4/10 | Header auth does not work for browser navigation |
| 10 | Community node version pinning | 4/10 | Unpinned versions risk silent breakage |

**Average Score: 4.0/10**

**Top 3 Issues:**
1. Supporting statement has AI generation but no document rendering pipeline -- the feature is half-built
2. Stale-job recovery was flagged in v1 but remains unaddressed in v2
3. Browser-based auth model does not work with header-based webhook authentication for file downloads and deep links

---

### Persona 3: UK Recruitment Expert / Career Coach -- v2

*20+ years in UK recruitment, specialising in L&D, HR, and higher education placements. CIPD Fellow. Understands ATS systems, recruiter workflows, and UK hiring conventions from both corporate and academic sectors.*

---

**Round 1 of 10 -- "The ATS compatibility claim still has no validation mechanism"**

**Concern:** The v1 evaluation flagged that ATS parsing was assumed but not validated. v2 adds a post-render page count check (Section 12.2), which is good for pagination but does not address ATS text extraction. The corporate CV template still uses `display: flex` for experience headers (Section 11.2, line `.experience-header { display: flex; justify-content: space-between; }`). Flexbox can cause ATS parsers to extract text in the wrong order. The PRD still claims "90%+ ATS compatibility score" as a target (Section 3.2) with no defined measurement method.

**Analysis:** ATS parsing remains a blind spot. The QA pipeline (Section 12.2) now checks page count, keyword coverage, UK English, hallucination, metrics, and sign-off conventions -- but not ATS parseability. To validate ATS compatibility, you would need to: (1) extract text from the generated PDF using a standard PDF text extraction library (pdftotext, PyPDF2), (2) verify the extracted text reads in the correct order (role title, company, dates, bullets -- not interleaved), (3) verify that section headings are recognized as headings, not just large text. The flex layout issue is specific and fixable: the experience header has role title on the left and dates on the right in a flex row. PDF text extraction may read this as "Jan 2020 -- Jun 2024 Head of Learning & Development" because Chromium serialises flex items right-to-left in some rendering modes. This is testable with a single PDF and pdftotext.

**Score: 4/10**

**Recommendations:**
- Add a programmatic ATS parse check to the QA pipeline: extract text from the generated PDF using pdftotext (available in the Gotenberg container) and verify reading order
- Replace `display: flex` in experience headers with a simpler layout: role title on one line, dates on a separate line below the company name (this is also how many UK CVs are structured)
- Define the "ATS compatibility score" metric: what specifically is measured, how, and with what tool
- Test generated PDFs against at least one real ATS system during Phase 5
- Include ATS parse results in the QA report

---

**Round 2 of 10 -- "The CV does not include referees for corporate roles, but some UK employers expect them"**

**Concern:** Section 17.4 says corporate CVs use "References available on request" by default, with referees only included in academic CVs. But a significant number of UK corporate roles at the GBP 70-80k level expect 2 referees on the CV, particularly in financial services, NHS-adjacent organisations, and regulated sectors. The system makes this a global default with no role-specific override. If a JD explicitly says "Please include names and contact details of two referees," the system ignores this.

**Analysis:** The "references available on request" convention is common but not universal in UK corporate hiring. Many organisations, particularly in the public sector and larger corporates, expect referees on the CV. The JD analysis detects requirements but does not specifically check for referee-inclusion instructions. The system's default behaviour (no referees on corporate CVs) is safe from a privacy perspective but may be non-compliant with specific application instructions. The master profile stores referees with a `suitable_for` tag (corporate/academic/both), so the data is available. The issue is that the CV generation logic never includes referees for corporate CVs, regardless of what the JD says. This is a missed JD requirement, which is exactly what the system is designed to prevent.

**Score: 5/10**

**Recommendations:**
- Add referee-inclusion detection to the JD analysis: scan for phrases like "include referees," "two references required," "provide referee details"
- When the JD requests referees, include them on the corporate CV from the master profile's corporate-suitable referees
- Keep the default as "references available on request" when the JD does not mention referees
- Add the referee inclusion decision to the QA report so the candidate can verify
- Add referee names to the notification email when they are included, so the candidate can confirm they are still appropriate

---

**Round 3 of 10 -- "The cover letter does not adapt to the application channel"**

**Concern:** The v1 evaluation flagged that the system produces the same cover letter format regardless of whether the application is via ATS portal, email, LinkedIn, or agency. v2 added listing_type detection (direct_employer/recruitment_agency/confidential) to the JD analysis prompt. But the cover letter generation prompt (Section 9.4) does not have conditional logic for different listing types. The system detects whether a role is agency-listed but does not change the cover letter approach.

**Analysis:** The JD analysis prompt (Section 7.4) now includes "Detect whether the listing is from a recruitment agency vs direct employer (listing_type)" which addresses the detection gap. But the cover letter generation prompt receives the listing_type as part of the JD analysis JSON without explicit instructions for how to handle it. The prompt says "Reference the specific role title and company" -- but for a confidential agency listing, there is no company to reference. The sign-off should be to the recruitment consultant, not the hiring manager. The cover letter should mention willingness to discuss salary expectations (which agencies often require). None of these channel-specific adaptations are instructed in the cover letter prompt. The detection without adaptation means the data is available but unused.

**Score: 4/10**

**Recommendations:**
- Add conditional blocks to the cover letter prompt for listing_type: "IF listing_type == 'recruitment_agency': address the consultant by name if available, reference 'your client' not the company, mention willingness to discuss salary"
- For confidential listings: "Do not reference a specific company. Write the letter to apply for 'the role of [title]' without naming the employer."
- For LinkedIn Easy Apply: skip cover letter generation entirely (flag in the daily digest)
- For ATS portal submissions: note in the package that the cover letter may need to be pasted into a text field (provide plain text version)
- Test with real agency listings to verify the adaptation reads naturally

---

**Round 4 of 10 -- "No handling of closing dates or application deadlines"**

**Concern:** UK job postings, particularly for university and public sector roles, often have firm closing dates. The system generates packages but does not track or display closing dates. If a package is generated on Monday but the closing date is Tuesday, the candidate has 24 hours to review, approve, and submit. There is no urgency indicator in the digest email or the review interface. The candidate may review a week-old package only to find the role has closed.

**Analysis:** Module 1 scrapes job listings and presumably captures closing dates where available (though this is not confirmed in the Module 2 PRD). If closing_date is available in the jobs table, it should flow through to: (1) the daily digest email, sorted by closing date urgency, (2) the review interface dashboard, as a visible column with colour coding, (3) the priority ordering for generation (roles closing sooner should be generated first), (4) an alert if a package is still in "ready" status within 24 hours of the closing date. If closing dates are not captured by Module 1, this is a data gap that affects Module 2's utility. Many competitive roles have 2-week application windows; university roles often have 3-4 week windows. Without closing date awareness, the system generates packages in priority-score order rather than deadline order, which may cause the candidate to miss time-sensitive applications.

**Score: 4/10**

**Recommendations:**
- Add a closing_date field to the Module 2 data flow (from Module 1's jobs table)
- Sort the daily digest by closing date urgency, not just match score
- Add a closing date column to the review interface dashboard with colour coding (red = closing within 48 hours, amber = within 7 days)
- Prioritise generation for roles with earlier closing dates: modify v_pending_cv_generation to sort by closing_date ASC as a secondary sort
- Send an immediate notification (outside the daily digest) if a "ready" package has a closing date within 48 hours

---

**Round 5 of 10 -- "The CIPD handling is still binary: no graduated confidence based on how the JD phrases it"**

**Concern:** The v1 evaluation flagged that CIPD handling was good but not level-specific. v2 improved this with the cipd_level_minimum extraction in the JD analysis. But the handling still treats all CIPD requirements the same way, regardless of how the JD phrases them. "CIPD Level 5 or equivalent qualification" (strong equivalency case) is handled identically to "Must hold current CIPD Level 7 Chartered membership" (weak equivalency case, because they are asking for membership specifically, not just qualification level). The candidate's PhD provides academic equivalency to CIPD Level 7, but it is NOT CIPD membership.

**Analysis:** The JD analysis extracts `is_cipd_requirement: true` and `cipd_level_minimum` but does not distinguish between "CIPD or equivalent" and "Must hold CIPD." This distinction is critical. When a JD says "CIPD Level 5 or equivalent," the candidate's PhD (RQF Level 8) is a strong equivalency argument. When a JD says "Must hold CIPD Level 7," the employer is specifically asking for professional body membership, and academic qualification alone is not the same thing. The CIPD experience assessment route is a valid pathway, but the candidate does not currently hold CIPD. The master profile's cipd_equivalency block has two static statements (essential and desirable) but does not distinguish between "qualification equivalent" and "membership required." For roles where CIPD membership is specifically required (not just "or equivalent"), the cover letter should acknowledge this more directly and perhaps even suggest discussing the equivalency pathway at interview.

**Score: 5/10**

**Recommendations:**
- Add a `cipd_requirement_type` field to the JD analysis: "or_equivalent," "must_hold," "desirable," "not_mentioned"
- Create level-specific AND type-specific CIPD handling in the master profile: separate statements for "or equivalent" (strong case) vs "must hold" (acknowledge gap, describe pathway)
- For "must hold CIPD" requirements, add a note in the gap analysis: "This role specifically requires CIPD membership. Your PhD provides equivalence, but you should address this directly."
- Include a cipd_confidence score (high/medium/low) based on both level and phrasing
- In the cover letter, vary the CIPD paragraph based on cipd_requirement_type, not just cipd_required boolean

---

**Round 6 of 10 -- "No handling of DBS check requirements"**

**Concern:** Many UK roles in L&D, education, and the public sector require a Disclosure and Barring Service (DBS) check. University lecturer roles almost always require an enhanced DBS check. Some JDs state "The successful candidate will be subject to an enhanced DBS check." The system does not detect DBS requirements, does not include DBS willingness in the cover letter, and does not track whether the candidate already holds a valid DBS certificate. For a candidate targeting both corporate and academic roles, DBS status should be mentioned where relevant.

**Analysis:** DBS checks are common in the candidate's target sectors. UK university roles, NHS-adjacent L&D roles, and any role involving contact with students or vulnerable adults typically require DBS checks. The JD analysis does not extract DBS requirements as a specific field. The master profile schema does not include a DBS status section. The cover letter does not mention willingness to undergo a DBS check where required. While DBS requirements are typically post-offer conditions rather than application-stage filters, mentioning willingness proactively signals awareness of sector norms. For academic roles, not mentioning DBS could make the candidate appear unfamiliar with UK university employment requirements.

**Score: 5/10**

**Recommendations:**
- Add a `dbs_required` boolean to the JD analysis output
- Add a `dbs_status` section to the master profile: held/not_held, level (basic/standard/enhanced), update_service_registered, willingness_statement
- Include a DBS willingness statement in the cover letter for roles that require it: "I hold an enhanced DBS certificate registered with the Update Service" or "I am willing to undergo a DBS check as required"
- For academic roles, include DBS status by default unless the JD explicitly says it is not required
- Detect DBS references in JD text: "DBS," "Disclosure and Barring," "criminal record check," "safeguarding clearance"

---

**Round 7 of 10 -- "The academic CV does not reference REF or TEF, which are critical for university hiring"**

**Concern:** UK universities are assessed under the Research Excellence Framework (REF) and the Teaching Excellence Framework (TEF). For lecturer and senior lecturer applications, demonstrating REF-eligible research output and TEF-aligned teaching practice is increasingly important. The system's academic CV template and cover letter prompt make no mention of REF or TEF. For a research-active candidate applying to research-intensive universities, this is a significant omission.

**Analysis:** REF and TEF are institutional performance frameworks that affect university funding and rankings. When hiring, university departments look for candidates whose research outputs will be REF-submittable (peer-reviewed publications in ranked journals, evidence of impact) and whose teaching practice aligns with TEF criteria (student engagement, learning gain, employability outcomes). The candidate's PhD and publications may or may not be REF-eligible depending on the field and journal quality. The academic cover letter prompt (Section 9.4, academic variant) asks the AI to reference "the specific department and research areas" but does not instruct it to frame research output in REF terms or teaching in TEF terms. A senior lecturer cover letter that mentions "REF-eligible outputs" and "TEF-aligned pedagogical practice" signals fluency in UK academic culture that shortlisting panels notice.

**Score: 4/10**

**Recommendations:**
- Add REF eligibility assessment to the master profile: which publications are REF-eligible, what REF panel they would be submitted to, any impact case study potential
- Add REF/TEF framing instructions to the academic cover letter prompt: "Reference the candidate's REF-eligible research outputs and TEF-aligned teaching approaches where relevant"
- Include REF and TEF in the academic CV template as context within the Research and Teaching sections
- In the JD analysis for academic roles, detect whether the department mentions REF or TEF priorities and align the cover letter accordingly
- Avoid overstating REF eligibility if the candidate's publications are in lower-ranked journals -- the system should be honest about research impact

---

**Round 8 of 10 -- "No handling of jobs that require a completed application form instead of a CV"**

**Concern:** Many UK public sector and some university roles do not accept CVs at all. They require a completed application form (standard format provided by the employer) plus a supporting statement. The application form collects employment history, education, and references in the employer's own format. The system generates a CV and cover letter, but for these roles, a CV is not accepted. The supporting statement generation (Section 9b) is valuable here, but the candidate still needs to manually fill in the application form, which duplicates much of the CV content.

**Analysis:** This is a known gap in the UK application landscape. Public sector employers (local authorities, NHS, some universities) use standardised application forms because they facilitate fair comparison across candidates. The form typically asks for: personal details, employment history (employer, dates, duties, reason for leaving), education, referees, and a supporting statement. Module 2's generated content (structured JSON in cv_packages) contains all the data needed to fill these forms, but in a format that cannot be directly used. The candidate would need to manually transfer data from the generated CV to the application form, losing most of the time savings. A more useful output for form-based applications would be: structured text blocks that can be copy-pasted into form fields, pre-formatted employment history entries in the typical form sequence, and a supporting statement ready to paste.

**Score: 4/10**

**Recommendations:**
- Add "form-based" as a submission_format option in the JD analysis output
- For form-based applications, generate a "form-fill helper" document: employment history entries formatted for copy-paste into standard application forms (employer, dates, duties, reason for leaving for each role)
- Include the supporting statement as a separate document ready to paste (plain text, not formatted)
- Detect application form requirements in JDs: "completed application form," "do not send CVs," "download the application form"
- Generate a plain text version of all sections for copy-paste use

---

**Round 9 of 10 -- "The system does not track competitor candidates or market saturation"**

**Concern:** The callback rate metric is measured in isolation. But callback rates depend on how many other candidates apply. A role with 50 applicants might give a 20% callback rate even with a perfect CV. A role with 500 applicants might give 2%. The system generates packages at the same quality level for all roles, with no awareness of how competitive a particular role is. Some intelligence about market saturation -- based on role type, salary level, or posting age -- would help me prioritise applications where I am most likely to succeed.

**Analysis:** This is beyond Module 2's direct scope but relevant to the candidate's decision-making. Module 1 could capture data points that indicate competitiveness: how long the role has been posted (longer = either hard to fill or very popular), whether it appears on multiple boards (wider distribution = more applicants), salary relative to market rate (above market = more applicants), and whether the role has been reposted (indicating a failed previous search = fewer strong candidates). This information could influence Module 2's output: for highly competitive roles, the CV might need to be more aggressive in keyword optimisation, while for niche roles with few applicants, a more distinctive/personalised approach might work better. The current system treats all A/B-tier roles identically in its generation approach.

**Score: 6/10**

**Recommendations:**
- This is a v3 feature, not a v2 gap -- the current system is correct to treat all roles equally in generation quality
- For v3: add a competition_level estimate to the JD analysis based on posting age, board count, and salary positioning
- Vary the generation approach by competition level: more keyword-optimised for high competition, more personalised for low competition
- Include competition level in the daily digest so the candidate can prioritise strategically
- Track callback rates by competition level to identify where the system performs best

---

**Round 10 of 10 -- "The system cannot generate a LinkedIn-optimised summary from the same profile"**

**Concern:** Section 3.4 lists "LinkedIn optimisation" as an anti-goal. But the candidate's LinkedIn profile is her most visible professional presence. If the automated CVs use different language than her LinkedIn summary, there is a consistency gap. Recruiters routinely cross-reference CVs against LinkedIn profiles. A tailored CV that says "Learning Strategy & Programme Design" while LinkedIn says "Training and Development Professional" creates a credibility question. The system could at least flag major terminology differences between the CV and the candidate's LinkedIn summary.

**Analysis:** This is explicitly out of scope (Section 3.4), which is a defensible boundary. However, the inconsistency risk between tailored CVs and a static LinkedIn profile is real and worth acknowledging. The master profile stores summary_variants including a "general" variant, which could serve as the LinkedIn summary anchor. The system could add a post-generation check that flags if the tailored CV uses terminology that significantly differs from the general summary variant. This is not LinkedIn optimisation (out of scope); it is cross-channel consistency checking (in scope for quality). If the CV says "Strategic Learning Partner" for one role and the candidate's LinkedIn says "L&D Manager," a recruiter who checks LinkedIn will notice the inconsistency.

**Score: 6/10**

**Recommendations:**
- Add a "terminology consistency" check to the QA pipeline: compare key terms in the tailored CV against the master profile's general summary variant
- Flag if the tailored CV uses a title or term that contradicts the candidate's established professional identity
- Not a must-fix but worth noting in the QA report: "This CV uses 'Strategic Learning Partner' which differs from your general positioning as 'L&D Manager'"
- Consider generating a suggested LinkedIn summary update when the most common tailored CV language drifts from the general summary
- Keep LinkedIn optimisation out of scope but acknowledge the cross-reference risk

---

**Persona 3 v2 Summary: UK Recruitment Expert / Career Coach**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | ATS parsing validation | 4/10 | Still no automated ATS parse check, flex layout persists |
| 2 | Corporate CV referee inclusion | 5/10 | Default "references on request" ignores JDs that require referees |
| 3 | Cover letter channel adaptation | 4/10 | Agency listing type detected but not used in cover letter |
| 4 | Closing date awareness | 4/10 | No deadline tracking or urgency indicators |
| 5 | CIPD requirement type nuance | 5/10 | No distinction between "or equivalent" and "must hold" |
| 6 | DBS check handling | 5/10 | Common sector requirement not detected or addressed |
| 7 | REF/TEF framing | 4/10 | Academic CVs miss critical UK university assessment frameworks |
| 8 | Application form handling | 4/10 | Form-based applications not supported |
| 9 | Competition level awareness | 6/10 | No market saturation intelligence (acceptable for v2) |
| 10 | LinkedIn consistency | 6/10 | Out of scope but cross-reference risk acknowledged |

**Average Score: 4.7/10**

**Top 3 Issues:**
1. ATS parse validation remains unimplemented -- the 90% ATS compatibility target has no measurement mechanism
2. Closing date/deadline awareness is absent, causing potential missed time-sensitive applications
3. Cover letter channel adaptation logic was added to detection but not to generation

---

### Persona 4: AI/LLM Integration Specialist -- v2

*Expert in LLM application architecture, prompt engineering, hallucination prevention, cost optimisation, and production AI systems. Deep familiarity with Claude API capabilities and limitations.*

---

**Round 1 of 10 -- "The cross-model QA approach (Haiku validating Sonnet) has its own weakness"**

**Concern:** v2 addresses the same-model self-validation issue by using Haiku for QA validation of Sonnet-generated content (Section 12.1, 12.3). This creates genuine model independence. However, Haiku is a smaller, less capable model than Sonnet. Using a less capable model to validate a more capable model's output introduces a different problem: Haiku may not understand the nuances of the generation task well enough to identify subtle issues. If Sonnet writes a sophisticated rephrasing that is technically accurate but stretches the meaning of a profile entry, Haiku may lack the reasoning depth to catch the stretch.

**Analysis:** The cross-model approach (Haiku checking Sonnet) trades one bias for another. Same-model bias is replaced by capability asymmetry. Haiku excels at extraction and comparison tasks, which is why it is appropriate for "comparing claims against profile data." But hallucination detection in CV writing requires understanding nuance: is "Led a cross-functional L&D team" an acceptable rewrite of "Managed the training team"? Haiku may accept this because "led" and "managed" are synonyms, and "cross-functional" could be inferred from context. A human reviewer would ask: "Was the team actually cross-functional?" The programmatic metrics extraction (Section 12.3) partially compensates by catching numerical discrepancies. But qualitative embellishments -- adding "strategic" to "partner," describing routine coordination as "stakeholder management at board level," framing a team of 3 as a "department" -- are exactly the kind of subtle inflation that Haiku may miss.

**Score: 5/10**

**Recommendations:**
- Keep Haiku for the quantitative fact-checking layer (numbers, dates, company names, qualification names)
- Add a separate Sonnet call specifically for qualitative embellishment detection: "Compare each bullet point's tone and scope against the original profile text. Flag any instance where the CV implies a broader scope, higher seniority, or larger impact than the profile supports"
- Use the programmatic metrics check as the first gate, Haiku fact-check as second gate, and a targeted Sonnet quality check as the third gate (only for claims that pass the first two)
- Track which types of hallucination Haiku catches vs misses during Phase 4 validation testing
- Budget the additional Sonnet QA call: at ~$0.01 per call, the cost is negligible for the quality improvement

---

**Round 2 of 10 -- "The prompt architecture does not use Claude's extended thinking for complex generation tasks"**

**Concern:** Claude Sonnet 4.5 supports extended thinking (chain-of-thought in a separate thinking block), which significantly improves output quality for complex multi-step tasks like CV tailoring. The PRD's prompts are standard single-turn message completions. For the CV generation task -- which requires simultaneously matching requirements, selecting evidence, integrating keywords, maintaining voice, and respecting length constraints -- extended thinking would produce more thoughtful, higher-quality output. The PRD does not mention extended thinking at all.

**Analysis:** Extended thinking is particularly valuable for tasks with multiple competing constraints. The CV generation prompt asks Claude to: start from a summary variant and customise it, select and reorder highlights, incorporate keywords naturally, maintain word count limits, follow formatting rules, and trace every claim to a source. Without extended thinking, the model processes these constraints in parallel, which can lead to trade-offs (e.g., adding keywords at the expense of natural phrasing, or maintaining voice at the expense of keyword coverage). With extended thinking, the model can reason through these trade-offs explicitly before generating output, producing more balanced results. The cost of extended thinking is higher (more output tokens for the thinking block), but for the CV generation stage (the highest-quality requirement), the improvement in output quality justifies the cost. Extended thinking also produces a visible reasoning chain that could be used for debugging quality issues -- if a CV is poorly tailored, the thinking block shows why.

**Score: 5/10**

**Recommendations:**
- Enable extended thinking for Stage 3 (CV generation) and Stage 3b (cover letter generation) using Claude's `thinking` parameter
- Use the thinking output for debugging: store the thinking block alongside the generated content for quality review
- Keep standard (non-thinking) mode for Stages 1, 2, and 4 where the tasks are simpler
- Estimate the additional token cost: extended thinking typically adds 500-2000 tokens of thinking, costing ~$0.01-0.03 per generation
- A/B test extended thinking vs standard mode on 20 identical JDs to measure quality improvement

---

**Round 3 of 10 -- "The mapping stage generates suggested bullet points that anchor the generation"**

**Concern:** Stage 2 (mapping, Haiku) generates `suggested_cv_bullet` entries. Stage 3 (generation, Sonnet) receives these suggested bullets as part of its input. This creates an anchoring problem: Sonnet is likely to use the Haiku-suggested bullets as starting points rather than generating fresh ones. Since Haiku's writing quality is lower, the final CV bullets may be better-polished versions of Haiku's suggestions rather than Sonnet-quality originals. The mapping stage should provide evidence and structure, not drafts.

**Analysis:** The v1 evaluation (Persona 4, Round 2) identified that bullet point drafting in the mapping stage overloads Haiku. v2 does not appear to have changed this -- the mapping output schema (Section 8.2) still includes `suggested_cv_bullet`. The concern is not just quality but anchoring: LLMs are strongly influenced by examples in their context. If the mapping provides "Designed and delivered blended learning programmes for 500+ employees" as a suggested bullet, Sonnet will likely produce a minor variation rather than a wholly different phrasing. This limits the diversity of output and means the final CV quality ceiling is set by Haiku's initial draft quality. Removing suggested bullets from the mapping output and letting Sonnet generate entirely from the evidence references and JD keywords would produce higher-quality, more varied output.

**Score: 5/10**

**Recommendations:**
- Remove `suggested_cv_bullet` from the mapping output schema
- Have the mapping stage provide only: requirement match status, evidence source references, keywords to incorporate, and highlight IDs to use
- Let Stage 3 (Sonnet) handle all text generation, working from the raw profile highlight text and the JD keywords
- If anchoring is desired for consistency, include the candidate's actual profile text (not AI-rewritten versions) as the reference
- Test output quality with and without suggested bullets on 10 identical JD/profile combinations

---

**Round 4 of 10 -- "No token budget enforcement per stage"**

**Concern:** The PRD specifies max_tokens per API call (4096 for Haiku, 8192 for Sonnet) but these are output token limits, not input token limits. There is no mechanism to verify that the input prompt stays within a reasonable token budget before sending it to the API. If the master profile grows (new publications, additional experience entries), the input tokens grow with it. Eventually, the combined input (system prompt + user prompt with profile + JD analysis + mapping) could approach or exceed Claude's context window limits, causing silent truncation or degraded output quality.

**Analysis:** Claude's context windows (as of early 2026) are large (200K+ for Sonnet), so hitting the hard limit is unlikely. However, output quality degrades as context length increases -- a well-documented phenomenon. Sending a 30,000-token prompt to generate a 2,000-token CV means the model is processing 15x more context than it needs. The v1 evaluation noted that the full profile is sent to every stage, and v2's recommendation to send pruned profiles has not been implemented. As the candidate adds experience (new roles, new publications, new teaching modules), the profile grows. After a year of active career development, the profile could be 50% larger than at launch. There is no monitoring for input token growth, no alert when prompts exceed a threshold, and no automatic pruning.

**Score: 5/10**

**Recommendations:**
- Add input token counting before each API call (use Claude's token counting API or a local tokenizer estimate)
- Set input token budgets per stage: Stage 1 <3,000, Stage 2 <15,000, Stage 3 <15,000, Stage 3b <12,000, Stage 4 <12,000
- If a prompt exceeds its budget, prune the least relevant sections before sending (remove non-selected highlights, older experience entries)
- Log actual token counts per stage in the cv_generation_log and monitor growth trends
- Alert if average input tokens per stage increases by >20% over a month

---

**Round 5 of 10 -- "The UK English spelling check will corrupt technical terms and proper nouns"**

**Concern:** The UK English spelling check (Section 12.5) uses simple string replacement: `'program ': 'programme '` (with trailing space to avoid 'programming'), `'optimize': 'optimise'`, etc. But this will incorrectly replace these terms inside proper nouns, product names, and technical terms. "SAP SuccessFactors Learning Program" becomes "SAP SuccessFactors Learning Programme" (incorrect -- it is the product's name). "Google Optimize" becomes "Google Optimise" (incorrect -- it is the product's name). "Microsoft Excel" is safe, but "Organizational Behavior course at Harvard" becomes "Organisational Behaviour course at Harvard" (incorrect -- the course name uses US spelling).

**Analysis:** The regex-based replacement operates on the serialized JSON string of the CV content, with no awareness of whether the text being replaced is: (a) the candidate's own writing (should be UK spelling), (b) a proper noun or product name (should preserve original spelling), (c) a quotation or course title (should preserve original spelling), or (d) a keyword from the JD (should preserve the JD's spelling). The JD itself may use US spelling if the employer is a US company with UK operations (common for Google, Amazon, Meta, Microsoft roles). If the JD says "Learning Program Manager" and the system changes it to "Learning Programme Manager," the keyword match is broken and the ATS may not recognize it. The `'program ': 'programme '` replacement with trailing space partially mitigates this (avoids 'programming') but does not handle "program" at the end of a line or before punctuation.

**Score: 4/10**

**Recommendations:**
- Build an exclusion list for the UK spelling check: product names, course titles, company names, and JD-sourced keywords should not be modified
- Use word boundary regex instead of simple string matching: `\borganize\b` instead of `'organize'`
- Preserve the JD's original spelling for keywords that were extracted from the JD (the keyword_priority list has the original forms)
- Add a "proper noun" flag to the CV content that marks text segments that should not be spell-checked
- Consider using a proper UK/US spelling tool (e.g., a spell-check library with context awareness) instead of string replacement

---

**Round 6 of 10 -- "The system prompt persona 'Dr Sarah Mitchell' may introduce systematic biases"**

**Concern:** The v1 evaluation noted concerns about the persona. v2 has not removed it. The system prompt (Section 8.3) still says "You are Dr Sarah Mitchell, a senior CV writer with 20 years of experience in UK recruitment." This persona may introduce biases: "Dr Sarah Mitchell" is implicitly white, British, and female. Her "20 years in UK recruitment" implies specific conventions from 2006-2026 UK hiring that may not apply to a candidate with a different cultural background. The persona's voice preferences may systematically shape how Indian experience is described, how the PhD is positioned, and what "professional but warm" means.

**Analysis:** LLM personas are not neutral. When Claude adopts the identity of "Dr Sarah Mitchell," it draws on its training data's representation of what a British female recruitment professional sounds like, thinks is important, and considers "professional." This can create subtle framing biases: how she would describe a non-UK university, what she considers "warm" vs "too academic," how she positions cross-cultural experience. The candidate's authentic voice -- shaped by Indian and UK academic/corporate culture -- may differ from Mitchell's. The v1 recommendation was to remove the persona and replace with direct style instructions from the candidate's actual writing. This has not been done. The persona remains the primary voice-shaping mechanism, with the master profile's summary variants as secondary anchors.

**Score: 5/10**

**Recommendations:**
- Replace the persona with a functional description: "You are an expert CV writer. Your writing matches the following style characteristics: [specific traits from the candidate's actual CVs]"
- Add 2-3 paragraphs from the candidate's best manually-tailored CVs as style examples in the system prompt
- Remove the name, gender, and nationality from the system prompt entirely
- Keep the expertise claims ("specialising in L&D and higher education") without the persona framing
- Test output quality with and without the persona on 5 identical JDs

---

**Round 7 of 10 -- "No rate limiting strategy for Claude API calls during burst processing"**

**Concern:** WF8 processes up to 5 jobs per run, with 4-5 Claude API calls per job. That is 20-25 API calls in a single run. If the system has a backlog (e.g., after being offline for a day), it might run every 15 minutes at full capacity. Anthropic's API has rate limits (requests per minute, tokens per minute) that vary by plan. The PRD does not mention rate limit management, API tier, or how burst processing interacts with rate limits.

**Analysis:** The PRD handles individual rate limit errors (Section 16.2: "429 rate limit: Wait 60s, retry. Max 3 retries") but does not proactively manage request rates. At 5 jobs per run with 5 API calls each, plus retries for JSON failures, a single run can generate 25-35 API requests over 15-25 minutes. This is unlikely to hit rate limits under normal operation. But after a backlog (system was down, or Module 1 scored a batch of 30 jobs at once), the system processes 5 jobs per run, every 15 minutes, until the backlog clears. If the backlog is 30 jobs, that is 6 consecutive runs at full capacity -- 150-210 API calls over 90 minutes. Anthropic's rate limits for the standard tier (as of early 2026) are typically 50 requests per minute for Sonnet and 100 for Haiku. At 5 Sonnet calls per job, processing 5 jobs requires 25 Sonnet calls over ~15 minutes (~1.7/minute), which is well within limits. The concern is more about cost than rate limits: processing a 30-job backlog costs ~$2.30, which is fine within the monthly budget.

**Score: 6/10**

**Recommendations:**
- Document the expected API request rate per run and verify it is within the Anthropic plan's rate limits
- Add proactive rate limiting: space API calls at least 1 second apart to avoid burst-related 429s
- For backlog processing, consider reducing the poll interval to 10 minutes to clear the backlog faster while staying within rate limits
- Add total daily API call count monitoring with alerts at 80% of rate limit
- Document the Anthropic API plan tier and its rate limits in Appendix D

---

**Round 8 of 10 -- "The cost estimate table (Section 16.6) still shows Sonnet for QA but the text says Haiku"**

**Concern:** Section 16.6 lists the cost table with "QA Validation | Sonnet | $0.020" but Section 12.1 and 12.3 specify Haiku for QA validation. This is a consistency error in the v2 document. The cost table was not updated when the QA model was changed from Sonnet to Haiku. This means the total cost estimate per package ($0.076) is inflated -- the actual cost with Haiku for QA should be lower.

**Analysis:** The cost table shows QA Validation using Sonnet at $0.020, but the v2 changes specified Haiku for QA to provide cross-model validation. If Haiku is used for QA with ~5,000 input tokens and ~800 output tokens, the cost is approximately $0.003 (not $0.020). This changes the total per-package cost from $0.076 to approximately $0.059 -- a 22% reduction. At 30 packages per week, the monthly cost drops from ~$10 to ~$7.70. This is a positive change but the document is internally inconsistent. Additionally, if the v2 recommendation for a supplementary Sonnet QA call (for qualitative embellishment detection) is implemented, the cost would return to approximately $0.076. The inconsistency could cause confusion during implementation.

**Score: 6/10**

**Recommendations:**
- Update the cost table in Section 16.6 to reflect Haiku for QA validation
- Recalculate the total per-package cost estimate and monthly budget
- Add a note about the cost impact of optional supplementary QA checks
- Maintain a single source of truth for model assignments: the cost table should reference the same models specified in each section
- Version the cost estimates so changes are tracked

---

**Round 9 of 10 -- "No mechanism to handle Claude API response format changes"**

**Concern:** The Claude API response format has evolved over versions. The PRD uses HTTP Request nodes to call Claude's messages API directly (not an n8n Claude node). The response parsing assumes a specific JSON structure: messages have roles, content blocks, and specific nesting. If Anthropic introduces a new response format (as they did with tool use responses, content blocks, and the messages API itself), the parsing code in n8n Code nodes will break. There is no response format validation or adapter layer.

**Analysis:** The n8n workflow parses Claude API responses in Code nodes (e.g., node [10] "Parse and validate JD analysis JSON"). These code nodes assume a specific response structure. Claude's API returns responses with a `content` array containing `text` blocks (or `tool_use` blocks if using tool calling). If the response format changes -- even adding a new field or nesting level -- the parsing code may fail. The PRD does not show the actual parsing code for API responses, but given that it uses HTTP Request nodes (not n8n's built-in Claude node, which would handle format changes automatically), the parsing is manual. Using n8n's native Anthropic node (if available) would provide automatic format handling, but it may not support all Claude API features (extended thinking, specific model versions, structured output). The manual HTTP approach gives maximum control but maximum maintenance burden.

**Score: 5/10**

**Recommendations:**
- Build a response adapter function in a shared Code node that normalises Claude API responses into a consistent internal format, isolating format-dependent code to one location
- Validate the response structure before parsing content: check for expected fields (content array, text blocks) and fail with a clear error if the structure is unexpected
- Consider using n8n's native Anthropic node for simpler API calls (Stages 1 and 2) and HTTP Request for stages requiring advanced features
- Pin the Claude API version header (`anthropic-version: 2024-01-01`) to prevent automatic format upgrades
- Monitor Anthropic's API changelog for breaking changes

---

**Round 10 of 10 -- "The feedback data collected is never analysed -- no dashboard, no alerts, no trends"**

**Concern:** v1 flagged that feedback is collected but never used (Persona 4, Round 10). v2 added the review interface for collecting feedback (Section 19), but the feedback still flows into the cv_packages table with no analysis layer. There is no dashboard showing rating trends, no alert when average ratings drop, no correlation analysis between JD type and rating, and no automated prompt improvement suggestions. The data collection is now excellent; the data usage is still zero.

**Analysis:** The review interface (Section 19) provides excellent mechanisms for collecting structured feedback: 1-5 ratings, free-text notes, section-specific feedback, and application outcomes. The cv_packages table stores all of this. The weekly dashboard (Section 3.3) lists metrics that should be derived from this data (packages approved without edits, callback rate, etc.). But there is no workflow, query, or interface that generates these dashboards. The v_cv_package_dashboard view (Section 13.7) shows individual package data but does not aggregate trends. There is no weekly report generation workflow. The monitoring section (Section 16.3) extends WF7 to include Module 2 stats in the weekly summary, but WF7 is not specified in Module 2's PRD. The feedback loop remains open: data goes in, nothing comes out.

**Score: 4/10**

**Recommendations:**
- Create a WF14: Weekly Analytics workflow that runs every Sunday and generates a quality report from cv_packages data
- The report should include: average rating by CV type, approval rate, callback rate, most common edit patterns, cost trends, QA failure rate
- Store the report as a JSON document and include a summary in the weekly WF7 notification email
- Add threshold-based alerts: if average rating drops below 3.5/5 over 20 packages, send an alert suggesting prompt review
- Build a simple analytics view in the review UI showing trend charts (rating over time, callback rate by CV type)

---

**Persona 4 v2 Summary: AI/LLM Integration Specialist**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Haiku capability for nuanced QA | 5/10 | Smaller model may miss qualitative embellishment |
| 2 | Extended thinking not used | 5/10 | Multi-constraint generation would benefit from reasoning |
| 3 | Mapping anchoring effect | 5/10 | Suggested bullets constrain Sonnet's generation |
| 4 | No input token budget enforcement | 5/10 | No monitoring or pruning for growing profiles |
| 5 | UK spelling check corrupts proper nouns | 4/10 | Product names and JD keywords incorrectly modified |
| 6 | Persona bias in system prompt | 5/10 | Fictional persona shapes voice in potentially biased ways |
| 7 | Rate limiting for burst processing | 6/10 | Adequate for normal operation, worth documenting |
| 8 | Cost table inconsistency | 6/10 | QA model changed but cost table not updated |
| 9 | API response format fragility | 5/10 | Manual parsing with no adapter layer |
| 10 | Feedback data still unused | 4/10 | Collection excellent, analysis nonexistent |

**Average Score: 5.0/10**

**Top 3 Issues:**
1. UK English spelling check will corrupt product names, proper nouns, and JD-sourced keywords
2. Feedback data collection is now excellent but analysis/action layer is completely missing
3. Mapping stage's suggested bullets anchor Sonnet's generation, limiting output quality

---

### Persona 5: Privacy & Compliance Officer -- v2

*Specialist in UK data protection (GDPR/UK GDPR), Equality Act 2010, employment law, and AI governance. DPO-qualified with experience advising on automated decision-making systems.*

---

**Round 1 of 10 -- "The international data transfer documentation is improved but still incomplete"**

**Concern:** v2 expanded Section 17.2 to address international data transfers, including verifying SCCs, reviewing Anthropic's DPA, and implementing a data proxy if needed. This is a significant improvement. However, the section presents these as requirements to be verified ("Verify that Anthropic's API terms include SCCs...") rather than confirmed states. The PRD should document the actual current status: have the SCCs been verified? Has the DPA been reviewed? Is a data proxy needed? Leaving this as a to-do list rather than a confirmed state means the compliance status is unknown at the time of implementation.

**Analysis:** The v2 improvements to Section 17.2 are directionally correct but procedurally incomplete. The section reads as a checklist of things to check, not a record of what was found. For GDPR compliance, the data controller (the candidate) needs to document: (a) the specific legal mechanism used for the transfer (SCCs, adequacy decision, or derogation), (b) the date it was verified, (c) any supplementary measures applied (PII stripping, encryption). The PII mitigation measures listed are good (not sending referee details, using initials, redacting phone/email) but they are presented as aspirational ("Consider using a data proxy") rather than as implemented controls. Until the DPA is actually reviewed and the transfer mechanism is confirmed, the system is non-compliant by default. This should be a Phase 0 task, not a future consideration.

**Score: 5/10**

**Recommendations:**
- Convert the transfer mechanism verification from a to-do list to a documented finding: review Anthropic's DPA now and record the outcome in the PRD
- If SCCs are in place: document the SCC version, the date signed/reviewed, and any supplementary measures
- If SCCs are NOT in place: implement the PII-stripping data proxy before go-live, not as a future consideration
- Add a compliance sign-off gate to Phase 0: the system does not proceed to Phase 1 until the transfer mechanism is confirmed
- Review annually when Anthropic updates their terms

---

**Round 2 of 10 -- "The PII stripping measures are specified but not enforced in the workflow"**

**Concern:** Section 17.2 lists PII mitigation: "Redact phone number and email from the profile data sent to Claude," "Use initials or a placeholder instead of the candidate's full name." But the WF8 workflow (Section 14.1) loads the master profile at node [5] and passes it through the pipeline without any PII stripping step. There is no Code node between profile loading and API submission that strips PII. The mitigation exists in the PRD text but not in the workflow specification.

**Analysis:** The WF8 node sequence goes: [5] Load master profile -> [8] Prepare JD analysis prompt -> [9] Claude API call. There is no node between [5] and [8] that strips phone, email, full name, or referee details from the profile before it enters the prompt. The JD analysis (Stage 1) correctly does not include the profile, but Stages 2, 3, 3b, and 4 all receive the profile. The prompt construction nodes ([8], [13], [18], [21], [27]) build prompts that include the full profile_data as received from Postgres. The PII stripping described in Section 17.2 would need to be implemented as a dedicated Code node early in the pipeline that creates a "redacted_profile" variable used in all subsequent API calls, while the full profile remains available for template rendering (where the real name, email, and phone are needed). This is a straightforward implementation but it is not in the workflow spec.

**Score: 4/10**

**Recommendations:**
- Add a Code node between [5] (Load profile) and [8] (first prompt preparation) that creates a redacted copy of the profile
- The redacted copy should: replace name with initials, remove phone and email, remove referee section entirely, remove full postal address
- Use the redacted profile for all Claude API calls (Stages 2, 3, 3b, 4)
- Use the full profile for template rendering (Stage 5) where the real name, email, and phone are injected into the document
- Document this separation as a privacy control and test that the redacted profile produces the same quality output

---

**Round 3 of 10 -- "The review UI authentication token is stored in browser JavaScript"**

**Concern:** The review interface (Section 19.8) is a "single HTML file with embedded JavaScript" that uses `fetch()` with auth headers. The WEBHOOK_AUTH_TOKEN must be available to the JavaScript code to include in API request headers. This means the token is either: (a) hardcoded in the HTML/JS file, (b) stored in localStorage/sessionStorage, or (c) entered by the candidate on each visit. Option (a) means anyone who accesses the HTML file (which is served from a public-ish web server) gets the auth token. Option (b) is better but localStorage is accessible to any script running on the same origin (XSS risk). Option (c) is secure but inconvenient.

**Analysis:** This is a significant security concern for a system that stores detailed personal and career data. If the auth token is embedded in the JS file, it is effectively public. If it is in localStorage, it persists across sessions and is vulnerable to XSS attacks (though the static HTML without user-generated content has a small XSS surface). The review interface has no Content Security Policy (CSP) headers, no XSS protections, and no sanitization of server responses before rendering. If the candidate's cv_packages data contains malicious content (unlikely but possible if a job description contained script tags that flowed through to the display), it could execute in the context of the review UI and exfiltrate the auth token. The single-user, single-device use case mitigates the practical risk, but the architecture is fundamentally insecure for handling sensitive personal data.

**Score: 4/10**

**Recommendations:**
- Do not embed the auth token in the HTML file -- have the candidate enter it once per session (stored in sessionStorage, cleared on tab close)
- Add Content Security Policy headers that prevent inline script execution and restrict fetch() to the webhook domain only
- Sanitize all data received from the API before rendering in the DOM (use textContent, not innerHTML)
- Consider implementing a proper session-based auth flow: the candidate authenticates once, receives a session token cookie, uses cookie-based auth thereafter
- Add a "session expired" mechanism that forces re-authentication after 24 hours

---

**Round 4 of 10 -- "Generated documents contain metadata that could reveal the AI generation toolchain"**

**Concern:** PDFs generated by Gotenberg contain metadata: the PDF creator is reported as "Chromium" or "Gotenberg," the creation tool may be visible, and the PDF properties may include generation timestamps that reveal automated creation. DOCX files generated by docxtemplater similarly contain metadata. If a recruiter or ATS system inspects the document properties, the automated generation is revealed. While there is nothing wrong with using AI assistance, some recruiters may negatively judge candidates whose CVs are clearly machine-generated.

**Analysis:** PDF metadata typically includes: Creator, Producer, CreationDate, and ModDate fields. Gotenberg's Chromium-generated PDFs set the Producer to "Chromium" and the CreationDate to the generation timestamp. A recruiter who right-clicks -> Properties on the PDF would see "Producer: Chromium" which is unusual for a CV (most human-created CVs show "Microsoft Word" or "LibreOffice"). DOCX files contain `docProps/core.xml` and `docProps/app.xml` with creator and application metadata. The docxtemplater library may set application metadata differently from Microsoft Word. While most recruiters do not check metadata, ATS systems process it. Some enterprise ATS systems flag documents with unusual metadata for manual review. The metadata could also reveal the exact generation timestamp, which might differ significantly from the stated "sent" date on the cover letter.

**Score: 5/10**

**Recommendations:**
- Add a metadata scrubbing step after PDF generation: use a tool like exiftool or qpdf to set Creator and Producer to "Microsoft Word" or remove them entirely
- For DOCX files, modify the docProps/app.xml to set Application to "Microsoft Word" and AppVersion to a realistic version number
- Set the creation date metadata to the cover letter date (not the generation timestamp)
- Test that ATS systems (Workday, iCIMS) do not flag the generated documents as unusual
- Add metadata scrubbing to the WF9 document rendering pipeline as a post-generation step

---

**Round 5 of 10 -- "The review interface has no audit log for compliance purposes"**

**Concern:** Section 14.3 mentions "All webhook access is logged to the cv_generation_log table for audit." But the cv_generation_log table (Section 13.6) tracks pipeline stages (jd_analysis, mapping, cv_generation, etc.), not review interface actions. Approve, reject, feedback, and outcome recording actions go through WF13's webhook but are not logged in any audit table. If the candidate needs to demonstrate her application history (e.g., for a visa application, tax purposes, or employment tribunal), there is no timestamped log of when she approved each package, when she submitted each application, or when she received each callback.

**Analysis:** The cv_packages table records status changes (e.g., status = 'approved', updated_at = timestamp) but does not maintain a history of status transitions. If a package goes from 'ready' -> 'approved' -> 'applied', the table shows only the current status ('applied') and the last updated_at timestamp. The previous status transitions are overwritten. There is no audit table that records: who made the change (relevant if the system is ever extended to multi-user), when the change was made, what the previous status was, and any notes associated with the change. The cv_generation_log table tracks pipeline execution, not user actions. For a system that handles employment-related data over months or years, a proper audit trail is important for: demonstrating due diligence in job searching (relevant for benefits claims), tracking application timelines (relevant for visa renewals), and protecting against disputes about application history.

**Score: 4/10**

**Recommendations:**
- Create a `cv_package_audit_log` table: package_id, action (approved, rejected, feedback, outcome_recorded, status_changed), old_status, new_status, notes, ip_address, timestamp
- Log every status change and feedback submission through WF13
- Include the audit log in the data retention policy (12 months minimum)
- Make the audit log accessible through the review interface as a "history" tab on each package
- Export capability: generate a CSV of all application activity for visa/benefits documentation

---

**Round 6 of 10 -- "No data minimisation for the JD analysis stage"**

**Concern:** The JD analysis (Stage 1) does not receive the master profile -- which is correct. But it does receive the full job description text, which may contain personal data about third parties: the hiring manager's name, the recruiter's contact details, internal HR team members mentioned by name. This data is sent to Claude's API and retained for up to 30 days. While the candidate's own data being sent to Anthropic is addressed, third-party data in job descriptions is not considered.

**Analysis:** Job descriptions commonly include: the name of the hiring manager, the recruiter's name and contact details (especially for agency roles), internal team members' names (e.g., "reporting to Jane Smith, Director of People"), and sometimes department head names. This third-party personal data is sent to Anthropic's API as part of the JD analysis. Under GDPR, the candidate processes this data (she received it from a public job listing, which is lawful), but sending it to a US-based third-party processor (Anthropic) should be considered. The practical risk is very low -- these names appear on public job postings -- but the principle of data minimisation suggests that named individuals in JDs should not be sent to external APIs if they are not needed for the analysis. The JD analysis does not need the hiring manager's name; it needs the role requirements, keywords, and classification.

**Score: 5/10**

**Recommendations:**
- Add a PII detection step before the JD analysis API call: scan the job description for email addresses, phone numbers, and named individuals, and redact or anonymise them
- Replace named hiring managers with "[Hiring Manager]" in the API call (the name is preserved in the database for the cover letter salutation)
- Replace recruiter contact details with "[Agency Contact]" in the API call
- Document this as a data minimisation measure in the privacy section
- Keep the original unredacted JD in the database for template rendering

---

**Round 7 of 10 -- "The candidate's application pattern data could be used against her in salary negotiation"**

**Concern:** The system tracks which roles the candidate applies to, at what salary ranges, and which she rejects. Over time, this data reveals her salary expectations, how many roles she is pursuing simultaneously, and her selectivity. If this data were ever accessed (breach, legal discovery, or shared accidentally), it would give an employer or recruiter complete insight into her negotiating position. A recruiter who knew she was applying to 30+ roles per week would negotiate differently than one who thought she was considering only 2-3 opportunities.

**Analysis:** This is a strategic risk rather than a pure compliance risk. The cv_packages table, combined with the jobs table (salary_min, salary_max), creates a detailed map of the candidate's job search strategy: what salary ranges she considers, what she prioritises, and how selectively she applies. The gap analyses reveal where she feels she is weakest. The application outcome data reveals her callback rate, which indirectly reveals her market value. All of this is strategically sensitive information. The data is stored on a cloud server (Hetzner) and transmitted via email (Resend). If any link in this chain is compromised, the candidate's entire negotiating position is exposed. The right-to-work statement and salary range data are particularly sensitive in this context.

**Score: 5/10**

**Recommendations:**
- Encrypt the salary-related fields in the cv_packages and jobs tables at rest (Postgres column-level encryption)
- Do not include salary data in email notifications (currently the email template references salary)
- Add a "data export" feature that lets the candidate control what data is exported (e.g., application history without salary data)
- Consider storing application strategy data (which roles applied to, at what salary) separately from generation data, with stricter access controls
- Include strategic data sensitivity in the data processing notice

---

**Round 8 of 10 -- "No AI governance documentation for an AI-powered employment system"**

**Concern:** As of 2026, the UK has published AI governance guidance (the AI Safety Institute, the ICO's AI guidance, and the UK government's AI regulation white paper). While this system is personal-use rather than enterprise, it uses AI to make employment-related recommendations (match percentage, gap analysis, shortlisting probability). Any system that uses AI to influence employment decisions should document its governance approach, even if lightweight. The PRD has no AI governance section.

**Analysis:** The UK's approach to AI governance (as of 2026) is sector-specific and principles-based. The ICO has published guidance on AI and data protection that recommends: documenting the purpose and scope of AI use, assessing risks to individuals, ensuring human oversight, maintaining accountability, and being transparent about AI involvement. This system uses AI to: (1) analyse job requirements, (2) assess the candidate's suitability (match percentage, gap analysis), (3) generate documents that represent the candidate's qualifications, and (4) implicitly recommend which roles to apply for (through match scores). While the candidate retains full decision-making authority (she reviews and decides), the AI's recommendations influence her decisions. If she trusts the match percentage and skips roles with low scores, she is effectively delegating part of her job search decision to an AI. Documenting this -- even briefly -- is good practice and protects the candidate if the system's recommendations are ever questioned.

**Score: 5/10**

**Recommendations:**
- Add a brief "AI Governance" section to the PRD documenting: the purpose of AI use (throughput, not decision-making), the human oversight mechanism (candidate review before submission), the risk of AI influence on decision-making (match scores may bias which roles the candidate pursues), and accountability (the candidate is the final decision-maker)
- Reference the ICO's AI guidance principles: transparency, accountability, fairness, and human oversight
- Document that AI-generated match percentages and gap analyses are advisory, not authoritative
- Include a disclaimer in the review interface: "Match percentages are AI-generated estimates. Your judgment about role fit is the final decision."
- Review annually against evolving UK AI governance requirements

---

**Round 9 of 10 -- "The 'superseded' status for regenerated packages does not trigger data deletion"**

**Concern:** When a package is regenerated (WF11), the existing package is set to status = 'superseded' (Section 14.4). But the superseded package's data remains in the database: cv_content, cover_letter_content, qa_report, and mapping_data are all preserved. The generated files on disk also remain. Over time, superseded packages accumulate as additional personal data with no automatic cleanup. The data retention policy (Section 17.3) applies to "jobs expired > 6 months" but does not specifically address superseded packages.

**Analysis:** Superseded packages are effectively obsolete data. The candidate regenerated the package because the original was unsatisfactory or the profile was updated. The superseded version serves no further purpose: the candidate will use the new version, and the old version's quality metrics are no longer relevant. Keeping superseded packages inflates storage, complicates dashboard queries (the v_cv_package_dashboard view correctly filters them with `WHERE cp.status != 'superseded'`), and retains unnecessary personal data. GDPR's storage limitation principle (Article 5(1)(e)) requires that personal data not be kept longer than necessary. Superseded packages are by definition unnecessary once the replacement exists. The cleanup workflow should delete superseded packages after a short retention period (7-14 days for rollback safety).

**Score: 5/10**

**Recommendations:**
- Add superseded package cleanup to the data retention policy: delete cv_content, cover_letter_content, qa_report, and mapping_data from superseded packages after 14 days
- Delete the corresponding files on disk (superseded PDF/DOCX files) on the same schedule
- Keep the metadata row (status, timestamps, cost tracking) for operational analytics but strip the content
- Add superseded cleanup to the monthly cleanup workflow described in Section 17.3
- Log superseded package deletion for audit purposes

---

**Round 10 of 10 -- "No incident response plan for data breaches or system compromise"**

**Concern:** The system stores sensitive personal data (master profile, career history, application strategy, referee details) on a cloud server. If the Hetzner server is compromised, the n8n instance is breached, or the Postgres database is exfiltrated, the candidate's entire career history and job search activity is exposed. Under UK GDPR, data breaches must be reported to the ICO within 72 hours if they are likely to result in a risk to individuals' rights and freedoms. There is no incident response plan, no breach detection mechanism, and no notification procedure documented.

**Analysis:** While a single-user system on a managed server has a relatively small attack surface, the data it contains is highly sensitive. The master profile includes: full employment history with exact metrics, salary expectations, personal contact details, referee contact details, and the candidate's perceived weaknesses (gap analyses). A breach of this data could enable: identity fraud (personal details), social engineering (referee details), competitive intelligence (salary expectations and application strategy), or professional embarrassment (documented weaknesses). The system has multiple external integrations (Claude API, Resend, Gotenberg) each with their own attack surface. The n8n instance is exposed to the internet via Dokploy. Webhook endpoints, even with header auth, are reachable by anyone. A compromised auth token grants full access to the master profile (GET /webhook/{uuid}/profile) and all generated packages. The 72-hour ICO reporting requirement means the candidate needs to know she has been breached quickly.

**Score: 4/10**

**Recommendations:**
- Create a lightweight incident response plan: (1) how to detect a breach (monitor for unauthorized webhook access, unusual Postgres queries), (2) how to contain it (rotate auth tokens, disable webhooks, take n8n offline), (3) how to assess impact (what data was accessible), (4) how to notify the ICO if required (72-hour window)
- Set up basic intrusion detection: monitor for failed auth attempts on webhook endpoints, unusual access patterns, or bulk data exports
- Add webhook access logging with IP addresses (partially addressed in Section 14.3 but not at the detection level)
- Store a backup of the incident response plan offline (not on the same server that could be compromised)
- Review the plan annually and test the response procedure

---

**Persona 5 v2 Summary: Privacy & Compliance Officer**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Transfer mechanism verification status | 5/10 | Requirements listed as to-dos, not confirmed states |
| 2 | PII stripping not in workflow | 4/10 | Mitigation described in text but not in WF8 node sequence |
| 3 | Auth token in browser JavaScript | 4/10 | Token storage mechanism insecure for sensitive data |
| 4 | Document metadata reveals AI toolchain | 5/10 | PDF/DOCX metadata shows Chromium/Gotenberg, not Word |
| 5 | No audit log for review actions | 4/10 | Status changes overwritten, no history trail |
| 6 | Third-party PII in JD text | 5/10 | Hiring manager names sent to Anthropic API |
| 7 | Application strategy data exposure | 5/10 | Salary patterns and selectivity data is strategically sensitive |
| 8 | No AI governance documentation | 5/10 | AI-powered employment system without governance framework |
| 9 | Superseded package data retention | 5/10 | Obsolete packages retained indefinitely |
| 10 | No incident response plan | 4/10 | No breach detection, containment, or notification procedure |

**Average Score: 4.6/10**

**Top 3 Issues:**
1. PII stripping measures are described in the privacy section but not implemented in the workflow specification
2. No audit log for review interface actions -- status change history is overwritten
3. No incident response plan for data breach detection, containment, or ICO notification

---

## v2 Overall Evaluation Summary

### Scores by Persona

| Persona | v1 Average | v2 Average | Change |
|---------|-----------|-----------|--------|
| 1. The Candidate (Selvi) | 3.6/10 | 4.7/10 | +1.1 |
| 2. Technical Architect / n8n Expert | 4.4/10 | 4.0/10 | -0.4 |
| 3. UK Recruitment Expert / Career Coach | 3.4/10 | 4.7/10 | +1.3 |
| 4. AI/LLM Integration Specialist | 4.2/10 | 5.0/10 | +0.8 |
| 5. Privacy & Compliance Officer | 3.6/10 | 4.6/10 | +1.0 |
| **Overall Average** | **3.84/10** | **4.60/10** | **+0.76** |

**Note on Persona 2 decrease:** The v2 score is lower not because the PRD got worse, but because the new features (review UI, supporting statements) introduced new technical surface area with implementation gaps. The v1 issues were partially addressed (post-render page count, cross-model QA) but new issues emerged from the added complexity. The stale-job vulnerability persisting from v1 also weighs on the score.

### Top 10 Must Fix (Before Go-Live)

| # | Issue | Persona | Score | Why Critical |
|---|-------|---------|-------|-------------|
| 1 | **Supporting statement rendering pipeline missing** -- AI generation is specified but no HTML/DOCX template, no WF9 path, no DB columns for file paths | Technical | 3/10 | Feature is half-built; academic applications cannot produce the most important document |
| 2 | **Stale-job recovery still unaddressed** -- v1 vulnerability persists; crashed jobs stuck in 'generating' forever | Technical | 3/10 | Known defect carried forward from v1 |
| 3 | **PII stripping not implemented in workflow** -- privacy section describes mitigations absent from WF8 node sequence | Compliance | 4/10 | GDPR mitigation exists on paper but not in practice |
| 4 | **No audit log for review interface actions** -- status changes overwritten, no compliance trail | Compliance | 4/10 | Cannot demonstrate application history for visa/legal purposes |
| 5 | **UK spelling check corrupts proper nouns** -- product names and JD keywords incorrectly modified | AI/LLM | 4/10 | ATS keyword matching broken by incorrect spelling changes |
| 6 | **ATS parse validation still absent** -- 90% target with no measurement; flex layout risk persists | Recruitment | 4/10 | CVs may be invisible to ATS despite visual correctness |
| 7 | **Browser auth incompatible with file downloads** -- header auth cannot work for PDF download links or deep links | Technical | 4/10 | Core review workflow broken for file access |
| 8 | **No inline CV editing** -- candidate must download, edit in Word, re-upload for minor text changes | Candidate | 4/10 | High-friction workflow for the most common review action |
| 9 | **Cover letter does not adapt to detected listing type** -- agency detection exists but does not change generation | Recruitment | 4/10 | Detection without action is wasted processing |
| 10 | **No database backup strategy** -- irreplaceable application data on single server with no backup | Technical | 4/10 | Single point of failure for all career tracking data |

### Top 10 Should Fix (During Phase 8 or Shortly After)

| # | Issue | Persona | Score | Why Important |
|---|-------|---------|-------|-------------|
| 1 | **No closing date awareness** -- packages not sorted by deadline urgency | Recruitment | 4/10 | Time-sensitive applications may be missed |
| 2 | **Document metadata reveals AI generation** -- PDF shows "Chromium" not "Microsoft Word" | Compliance | 5/10 | Recruiter perception risk |
| 3 | **Review UI has no offline resilience** -- single HTML page with live API dependency | Candidate | 5/10 | Unusable on commute or with poor connectivity |
| 4 | **Feedback analysis layer is completely absent** -- data collected but never analysed | AI/LLM | 4/10 | System cannot improve without manual intervention |
| 5 | **Community node versions unpinned** -- silent breakage risk on container restart | Technical | 4/10 | DOCX/PDF rendering could fail without warning |
| 6 | **Mapping stage anchors Sonnet generation** -- suggested bullets constrain output quality | AI/LLM | 5/10 | Quality ceiling set by Haiku's draft quality |
| 7 | **Digest timing creates up to 24-hour delay** -- packages generated at 07:01 wait until next day | Candidate | 5/10 | Notification latency vs notification overload tradeoff |
| 8 | **CIPD handling does not distinguish "or equivalent" from "must hold"** | Recruitment | 5/10 | Binary handling for a nuanced requirement |
| 9 | **No incident response plan** -- breach detection, containment, and notification absent | Compliance | 4/10 | 72-hour ICO reporting requirement cannot be met |
| 10 | **Gotenberg memory limits tight for academic CVs** -- 512MB may OOM on 5-page renders | Technical | 5/10 | Academic CV PDFs may fail silently |

### Top 5 Nice-to-Have (Post-Launch Improvements)

| # | Issue | Persona | Score | Value |
|---|-------|---------|-------|-------|
| 1 | **REF/TEF framing for academic applications** -- UK university assessment frameworks not referenced | Recruitment | 4/10 | Signals academic culture fluency |
| 2 | **Extended thinking for CV generation** -- multi-constraint task would benefit from reasoning | AI/LLM | 5/10 | Quality improvement with modest cost increase |
| 3 | **Multi-package comparison view** -- side-by-side evaluation of similar roles | Candidate | 5/10 | Better decision-making for role prioritisation |
| 4 | **Application form helper** -- structured output for copy-paste into employer forms | Recruitment | 4/10 | Covers public sector application channel |
| 5 | **Shareable package links** -- time-limited read-only URLs for mentor review | Candidate | 5/10 | Quality-of-life feature for high-stakes applications |

### Overall Assessment (v2)

The v2 PRD represents meaningful progress from v1. The most critical v1 gaps -- review interface, notification overload, supporting statements, webhook authentication, person specification handling, academic CV sections, and cover letter conventions -- have all been addressed. The overall score improved from 3.84/10 to 4.60/10, reflecting a system that is closer to being usable but still has significant work ahead.

The improvement is uneven across personas. The Recruitment Expert and Candidate personas saw the largest gains (+1.3 and +1.1 respectively) because the v2 additions directly addressed their most pressing concerns (supporting statements, review UI, daily digest, person specifications). The AI/LLM Specialist improved (+0.8) through the cross-model QA and programmatic metrics checks. The Technical Architect score decreased slightly (-0.4) because the new features introduced new technical surface area (review UI routing, auth flow, supporting statement rendering) that is not fully specified.

**The most concerning pattern in v2 is the gap between specification and implementation.** Several v2 features are described at the concept level but missing critical implementation details: the supporting statement has AI generation but no document rendering pipeline; the PII stripping measures are listed in the privacy section but absent from the workflow specification; the listing type detection exists but does not flow into cover letter generation logic; and the feedback collection is now well-designed but the analysis layer is nonexistent. This "describe but do not implement" pattern suggests that v2 was written to address v1 evaluation feedback at the specification level without fully tracing through the implementation implications.

**To reach 6/10 (production-ready with known limitations), the PRD needs:**
1. Complete the supporting statement pipeline (template, rendering, storage)
2. Fix the stale-job recovery gap (carried from v1)
3. Implement PII stripping in the actual workflow specification
4. Resolve the browser auth / file download tension
5. Add ATS parse validation (even a basic pdftotext check)
6. Fix the UK spelling check to respect proper nouns and JD keywords
7. Add a database backup strategy

These are all tractable issues. The core architecture -- four-stage AI pipeline, master profile design, QA validation, and document generation -- remains solid. The system is 60-70% of the way to being a genuinely useful tool for the candidate.

---

## Fixes Applied Log (v2 -> v3)

### Must Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | Supporting statement rendering pipeline missing | Added `supporting_statement_pdf_path`, `supporting_statement_docx_path`, `supporting_statement_content` columns to cv_packages table. Added supporting statement templates to /templates/ directory listing. Added nodes [23b]-[23f] to WF8 for conditional supporting statement generation. Added nodes [18]-[22] to WF9 for supporting statement HTML/DOCX rendering pipeline. |
| 2 | Stale-job recovery unaddressed | Added node [0a] to WF8: stale-job recovery check that resets packages stuck in 'generating' for >30 minutes to 'failed' status. Updated v_pending_cv_generation view to exclude failed/superseded packages so recovered jobs can be re-queued. |
| 3 | PII stripping not in workflow | Added node [5a] to WF8: PII stripping code that redacts email, phone, full name, full address, and referees section from the profile before sending to Claude API. Original profile preserved for post-generation template re-injection. |
| 4 | No audit log for review interface | Added Section 19.7b with review_audit_log table schema. All WF13 status-changing endpoints now insert audit rows before performing updates, preserving previous values for compliance traceability. |
| 5 | UK spelling check corrupts proper nouns | Rewrote Section 12.5 spelling check code to build a protected terms set from JD keywords and known proper nouns (brand names, product names). The replacement function now checks each match position against protected positions and skips protected terms. |
| 6 | ATS parse validation absent | Added ATS parse validation check to QA validation table (Section 12.2). Added Section 12.8 with full implementation using pdftotext extraction, section heading detection, date extraction, and job title parsing. Added ats_parse_check to QA report schema. Added poppler-utils dependency to Docker setup. |
| 7 | Browser auth incompatible with file downloads | Changed file download endpoint to accept token query parameter. Added Section 19.8 authentication details: short-lived HMAC-SHA256 download tokens generated by the review UI JavaScript, validated by WF13 backend with 1-hour expiry. |
| 8 | No inline CV editing | Added inline editing capability to Section 19.4 (item 11). Added inline-edit endpoint to API list. Documented contenteditable implementation with JSON path mapping, WF9 re-render trigger, and audit trail for all edits. |
| 9 | Cover letter does not adapt to listing type | Added listing_type conditional logic to cover letter generation prompt (Section 9.4) with specific instructions for recruitment_agency, confidential, and direct_employer listing types. Agency letters address the consultant, confidential letters avoid naming the employer. |
| 10 | No database backup strategy | Added Section 17.6 with full backup strategy: daily pg_dump, WAL archiving, off-site sync to Hetzner Storage Box via rclone, weekly document archive. Includes backup script, recovery procedure, and monitoring integration. |

### Should Fix Items Applied

| # | Issue | Changes Made |
|---|-------|-------------|
| 1 | No closing date awareness | Updated WF12 digest query to sort by closing_date ASC NULLS LAST before match_percentage, so urgent deadlines surface first. |
| 2 | Document metadata reveals AI generation | Added nodes [6a] and [7a] to WF9: PDF metadata sanitisation via exiftool (Producer/Creator set to "Microsoft Word 16.0") and DOCX metadata sanitisation via docProps modification. |
| 3 | Review UI no offline resilience | Added localStorage caching to review UI implementation: package list and last-viewed detail cached on each fetch, displayed with "Offline" banner when API unreachable, actions queued for sync on reconnect. |
| 4 | Feedback analysis layer absent | Added Section 19.7c with feedback analysis dashboard: rolling metrics (average rating, approval rate, callback rate by type/tier, edit pattern analysis), alert thresholds, and WF14 weekly feedback digest workflow. |
| 5 | Community node versions unpinned | Pinned all community node versions in Appendix B (text-templater 1.2.0, docxtemplater 1.0.3, resend 0.3.1). Added version pinning policy requiring integration testing before upgrades. |
| 6 | Mapping stage anchors Sonnet generation | Added quality consideration note to Section 8.2 documenting the cost/quality tradeoff and specifying upgrade criteria: if candidate frequently overrides evidence selections, upgrade mapping to Sonnet. |
| 7 | Digest timing creates delay | Added urgent notification override to WF12: packages with closing dates within 48 hours trigger immediate notification bypassing the daily digest. |
| 8 | CIPD handling binary | Added cipd_requirement_type field ("must_hold", "or_equivalent", "desirable") to JD analysis output schema, extraction prompt instructions, and jd_analyses database table. This enables nuanced CIPD handling in CV and cover letter generation. |
| 9 | No incident response plan | Added Section 17.7 with incident response plan: detection methods, 7-step response procedure with timeframes, ICO reporting threshold and contact details, specific focus on referee data as primary breach risk. |
| 10 | Gotenberg memory limits tight | Increased Gotenberg memory limit from 512MB to 1024MB and reservation from 256MB to 512MB in Docker Compose to handle academic CVs and supporting statements without OOM. |

### Additional Fixes Applied

| Issue | Changes Made |
|-------|-------------|
| Cost table inconsistency (QA shows Sonnet, should be Haiku) | Corrected QA Validation model from Sonnet ($0.020) to Haiku ($0.003) in Section 16.6. Added supporting statement cost row. Updated total per-package cost and monthly estimate. |

---

## 24. 50-Round Critical Roleplay Evaluation (v3 - FINAL)

**Evaluation Date:** 2026-03-29
**PRD Version Evaluated:** 3.0
**Evaluator Profile:** Top 0.1% product/engineering evaluator
**Methodology:** 5 personas x 10 rounds each = 50 independent critical evaluations. Each round raises a concern NOT previously identified in v1 or v2. Scores reflect v3 maturity after two full fix cycles.

**Context:** v1 scored 3.84/10, v2 scored 4.60/10. v3 applied all 10 must-fix items (supporting statement pipeline, stale-job recovery, PII stripping, audit log, UK spelling protection, ATS validation, download auth, inline editing, listing type adaptation, database backup) and all 10 should-fix items (closing date sorting, metadata sanitisation, offline resilience, feedback analysis, version pinning, mapping quality note, urgent notification override, CIPD requirement type, incident response plan, Gotenberg memory). This evaluation looks for remaining gaps, integration issues between the newly added sections, and real-world deployment readiness.

---

### Persona 1: The Candidate (Selvi) -- v3

*PhD, MBA, 18 years in HR/L&D. Targeting corporate L&D roles (GBP 70-80k) and UK university lecturer positions near Maidenhead. Currently achieves 90% callback rate on manually tailored applications.*

---

**Round 1 of 10 -- "The inline editing re-renders the entire document for a single word change"**

**Concern:** Section 19.4 says inline edits trigger WF9 as a sub-workflow to re-render PDF/DOCX. If I change one bullet point, the system re-runs Gotenberg and docxtemplater to produce entirely new PDF and DOCX files. For minor text edits during a review session where I might tweak 3-4 bullet points across 3 packages, that is 9-12 document rendering operations. Each Gotenberg call takes a few seconds. The system has no concept of batching edits or deferring re-render until I click "Done editing."

**Analysis:** The inline editing flow is: edit text -> blur/Ctrl+S -> POST to backend -> update JSONB -> trigger WF9 -> re-render all documents. This is architecturally correct but operationally wasteful. A candidate making 4 edits to a CV will trigger 4 sequential Gotenberg calls, each producing a full PDF. The previous 3 PDFs become orphaned files on disk (the PRD has no cleanup mechanism for superseded renders from inline edits). More importantly, the user experience is poor -- the candidate must wait for each render before seeing the updated preview. A better design would batch edits: save all changes to the JSONB immediately but defer re-rendering until the candidate clicks "Finalize" or navigates away from the edit view. This is a v1 inline editing design that will become friction at scale.

**Score: 6/10**

**Recommendations:**
- Add a "Finalize edits" button that triggers a single WF9 re-render after all edits are complete
- Save edits to JSONB immediately but mark the package as "edits_pending_render" until finalized
- Show the HTML preview updated live (from the JSONB content) without waiting for PDF re-render
- Clean up orphaned PDF/DOCX files from intermediate renders
- Add a debounce (30-second timer after last edit) as an alternative to explicit finalization

---

**Round 2 of 10 -- "No way to revert an inline edit to the AI-generated version"**

**Concern:** Section 19.4 says inline edit changes are "non-destructive" and "the original AI-generated content is preserved in the audit trail." But the audit trail is a compliance log, not a user-facing revert mechanism. If I edit a bullet point and later decide the AI version was better, I cannot click "Revert to original" on that specific field. I would need to read the audit log entries, find the previous value, and manually type it back in. For 20-45 packages per week with frequent edits, this becomes a real workflow gap.

**Analysis:** The audit trail records previous_value and new_value in the review_audit_log table. But there is no UI mechanism to browse edit history or revert individual fields. The review interface would need to: (1) track the original AI-generated version per field path, (2) display an "Undo" or "Revert to AI version" option on each edited field, (3) distinguish between multiple rounds of edits. The current design captures the data needed for revert but does not surface it. This is a case where the compliance infrastructure exists but the UX layer is missing. The fix is straightforward: store the original cv_content alongside the edited version (or use the first audit entry as the baseline), and add a per-field "Reset to original" action in the UI.

**Score: 6/10**

**Recommendations:**
- Store the original AI-generated cv_content as a separate `cv_content_original` field, never modified by inline edits
- Add a "Reset to AI version" button on each editable field in the preview
- Show visual indicators on fields that have been modified (e.g., a subtle highlight or icon)
- Add an "Undo all edits" action that reverts the entire package to the original AI output

---

**Round 3 of 10 -- "The feedback analysis does not feed back into prompt improvement"**

**Concern:** Section 19.7c adds a feedback analysis dashboard and WF14 weekly digest. It surfaces metrics like "most common edit patterns" and sends alerts when ratings drop. But the analysis stops at surfacing data. There is no mechanism -- automated or documented -- for translating "candidates consistently change X" into an updated prompt or profile adjustment. The system collects and analyses feedback but the last mile of improvement requires undefined manual intervention.

**Analysis:** The feedback loop has three stages: collection (well-designed in v2/v3), analysis (added in v3 via Section 19.7c), and action (still absent). The weekly digest tells the candidate "your average rating dropped to 3.4/5 this week and you frequently edit the professional summary section" -- but then what? The candidate is not a prompt engineer. She cannot translate "I keep changing how my PhD is positioned" into a system prompt modification. The system operator (developer) is not alerted to take action on prompt tuning; WF14 sends the digest to the candidate, not to a developer alias. The "most common edit patterns" analysis could theoretically identify recurring text changes, but there is no documented process for: (1) reviewing edit patterns, (2) deciding whether the pattern indicates a prompt issue vs. a per-job preference, (3) updating the relevant prompt, (4) validating the change against historical packages. This is the gap between "data-driven" and "data-informed."

**Score: 6/10**

**Recommendations:**
- Add a documented quarterly prompt review process in Section 18.11 triggered by feedback pattern data
- When edit pattern analysis identifies a change made to >30% of packages (e.g., always shortening the summary), auto-generate a suggested prompt modification
- Send the weekly feedback digest to a developer/operator alias as well as the candidate
- Add a "prompt changelog" section to the master profile tracking why each prompt modification was made
- Consider A/B testing prompt variations: for 2 weeks, generate half the packages with the current prompt and half with the modified version

---

**Round 4 of 10 -- "The 'further particulars' gap from v2 was not addressed"**

**Concern:** v2 Round 7 identified that UK academic applications often include a separate "further particulars" document with critical departmental context. The PRD still only receives `job.description` from Module 1. The v3 fixes log does not mention this issue. Academic cover letters and supporting statements remain unable to reference specific departmental research themes, module offerings, or REF strategy because that information is in a separate document the system never sees.

**Analysis:** This issue was raised in v2 Persona 1 Round 7 (scored 4/10) but does not appear in the v3 fixes log. It was categorized as a "nice-to-have" in v2's final assessment (Top 5 Nice-to-Have, item 4 mentions "Application form helper" but not further particulars specifically). The gap persists: the personal context injection webhook (Section 19.5) allows pasting text before generation, which could serve as a workaround (paste further particulars text into candidate_notes), but this is undocumented as a workflow and the field is designed for short notes ("I met the hiring manager"), not multi-page departmental descriptions. The cover letter prompt receives candidate_notes with the instruction "Incorporate this naturally into the cover letter" -- but 2-3 pages of further particulars pasted into a notes field will confuse the prompt, which expects a sentence or two. This remains a genuine gap for academic applications.

**Score: 5/10**

**Recommendations:**
- Add a `supplementary_documents` JSONB field to the jobs table for storing further particulars text
- Allow the candidate to paste or upload further particulars text via the review interface (separate from candidate_notes)
- Include supplementary_documents in the JD analysis input, prompting the LLM to extract departmental research themes and teaching needs
- Add a "further particulars detected" flag to the JD analysis output when the JD text contains phrases like "For further particulars, see..." or "See job pack for details"
- As a v1 workaround, document in the review UI that candidate_notes can be used for this purpose, with a larger text input field

---

**Round 5 of 10 -- "The 'generation hold' for pre-filtering was recommended but not implemented"**

**Concern:** v2 Round 4 recommended adding a way for me to suppress generation for roles I am already pursuing informally. The v3 fixes include urgent notification override (closing dates within 48 hours) but not generation hold or exclusion lists. If Module 1 discovers a role at a company where I already have an internal referral, Module 2 still auto-generates a package before I can intervene. The 15-minute polling window gives me no realistic chance to pre-screen.

**Analysis:** The review interface (Section 19.5) mentions that pending A/B-tier jobs can be skipped, but this requires the candidate to be actively watching the pending queue between WF8 polls. With a 15-minute poll cycle, the window for intervention is narrow and unpredictable. There is no company exclusion list, no "do not generate" flag on individual jobs, and no hold mechanism. The system is designed for full automation with post-generation review, but the candidate's real workflow involves a mix of automated and manual applications. The system has no concept of "I am handling this one myself." The closest mechanism is the personal context injection, but adding notes does not prevent generation -- it augments it.

**Score: 5/10**

**Recommendations:**
- Add a `generation_skip` boolean to the jobs table, settable via the review interface or webhook
- Add a `company_exclusion_list` to candidate preferences, checked by WF8 before generation
- When Module 1 scores a new A-tier job, delay generation by 2 hours for A-tier (not B-tier) to allow candidate pre-screening
- Surface new A/B-tier jobs in a "Pending Generation" section of the review dashboard, with "Skip" and "Generate Now" buttons
- Process B-tier jobs on the next WF8 poll as before (no delay)

---

**Round 6 of 10 -- "Supporting statements are generated but there is no way to preview or edit them inline"**

**Concern:** Section 19.4 describes inline editing for CV and cover letter previews. But supporting statements -- which are added in v3 via Section 9b and the WF9 rendering pipeline -- are not mentioned in the inline editing specification. The review interface download buttons list "Supporting Statement PDF/DOCX (if applicable)" but the inline editing section only mentions "CV or cover letter preview." If I need to adjust a criterion response in my supporting statement (the most nuanced and error-prone document type), I have to download, edit in Word, and re-upload.

**Analysis:** The inline editing implementation (Section 19.4, item 11) describes contenteditable divs with data-path attributes mapping to `cv_content` or `cover_letter_content` JSON fields. Supporting statement content is stored in `cv_packages.supporting_statement_content` but is not listed as an editable target. The WF9 rendering pipeline handles supporting statement rendering (nodes 18-22), so re-rendering after edits is technically feasible. But the review interface specification does not include a supporting statement preview with contenteditable fields. This is an oversight from the v3 additions: the supporting statement pipeline was completed for generation and rendering, but the review interface was not updated to include it in the inline editing flow. Given that supporting statements are the most critical document for academic shortlisting and the most likely to need human adjustment, this is a notable gap.

**Score: 6/10**

**Recommendations:**
- Extend the inline editing specification to include supporting_statement_content as an editable target
- Add a supporting statement preview section to the package detail view
- Use the same contenteditable + data-path mechanism, mapping to `supporting_statement_content.essential_criteria_responses[N].response` etc.
- Allow editing of individual criterion responses independently
- Add a "criterion coverage" indicator showing whether all criteria are addressed

---

**Round 7 of 10 -- "No handling of the 'Please apply using our online application form' scenario"**

**Concern:** Many UK employers, particularly public sector and large corporates, require candidates to complete an online application form rather than submitting a CV. The system generates beautiful PDF and DOCX CVs, but some roles do not accept CV submissions at all. They have structured forms with text boxes for "Key achievements" (max 250 words), "Why do you want this role?" (max 200 words), and similar constraints. The system generates documents I cannot use for these roles.

**Analysis:** This was briefly mentioned in v2's nice-to-have list ("Application form helper -- structured output for copy-paste into employer forms") but never implemented. The JD analysis prompt does not detect application format requirements (CV vs form vs both). The `application_guidance.submission_format` field in Section 7.3 has a value of "ats_portal" but this is not used downstream and does not distinguish between "upload your CV" and "fill in our form." For university applications, a substantial portion use the jobs.ac.uk or university-specific application forms with character-limited text boxes. The system's assumption that every application involves submitting a PDF/DOCX is UK-market incorrect for perhaps 20-30% of target roles.

**Score: 5/10**

**Recommendations:**
- Add submission_format values: "cv_upload", "online_form", "email", "both" to the JD analysis output
- When submission_format is "online_form", generate a supplementary "form helper" document alongside the CV: key achievements in 250-word chunks, skills summary, tailored answers to common form questions
- Add character-counted text blocks to the package output for copy-paste into forms
- Detect form-based applications from JD phrases like "Please complete the application form" or "Do not send CVs"
- Flag these packages in the review interface as "Form-based application" with the form helper content

---

**Round 8 of 10 -- "The system generates for every A/B-tier job but some B-tier jobs are not worth applying to after gap analysis"**

**Concern:** v2 Round 8 raised the issue that the system does not help me decide whether to apply. The v3 fixes do not address this. The system generates a full package (4+ Claude API calls, PDF and DOCX rendering) for every A/B-tier job, even those where the gap analysis reveals 3+ essential criteria gaps. For academic roles where missing any essential criterion means automatic rejection, generating a supporting statement for a role I cannot get shortlisted for wastes time and money.

**Analysis:** The current architecture processes jobs purely based on Module 1's tier classification. A job scored as B-tier with a 45% match percentage still triggers the full pipeline. The gap analysis runs as part of Stage 2 (mapping) but by that point the system has already committed to generation. A more efficient design would run the mapping stage first, evaluate the gap analysis, and skip generation (Stages 3-5) if the match is below a configurable threshold. The mapping stage costs ~$0.002, while the generation stages cost ~$0.055-0.085. Skipping generation for low-match jobs would save API costs and, more importantly, reduce the candidate's review burden. The candidate's time reviewing a package she will never submit is the real cost.

**Score: 6/10**

**Recommendations:**
- Add a configurable `minimum_match_threshold` (default 60% for corporate, 70% for academic)
- Run Stage 2 (mapping) for all A/B-tier jobs but only proceed to Stage 3 (generation) if match_percentage exceeds the threshold
- For below-threshold jobs, store the mapping data and gap analysis but skip document generation
- Show below-threshold jobs in the review interface as "Low match -- mapping only" with the option to manually trigger generation
- Track whether below-threshold jobs the candidate manually generates for produce callbacks, to calibrate the threshold

---

**Round 9 of 10 -- "I cannot see which jobs are still waiting in the generation queue"**

**Concern:** The review interface shows packages in various statuses (ready, approved, applied, etc.) and pending jobs that have not yet been generated. But there is no visibility into the generation queue itself. If WF8 picks up 5 jobs per poll and I have 12 pending, I have no way to know which 5 are being processed now, which 7 are waiting for the next poll, and in what order. If I want to prioritise a specific job, I cannot move it to the front of the queue.

**Analysis:** The WF8 orchestrator processes up to 5 jobs per 15-minute cycle, ordered by tier and composite score. The v_pending_cv_generation view determines the queue order. But the review interface has no window into this queue. The candidate cannot see: (1) how many jobs are pending, (2) which are currently generating, (3) estimated time until her priority job is processed. The only feedback is the daily digest showing completed packages. If the candidate adds personal context for a specific job and wants it generated immediately, she has no mechanism to trigger priority processing (WF11 handles regeneration, not initial generation). The review interface mentions "Prioritise specific jobs for immediate generation" (Section 19.5) but no workflow or endpoint implements this.

**Score: 6/10**

**Recommendations:**
- Add a "Generation Queue" section to the review dashboard showing pending jobs with their queue position
- Add a "Generate Now" button on pending jobs that triggers immediate processing via a new webhook (bypassing the 15-minute poll)
- Show "Currently Generating" status on jobs being processed by an active WF8 run
- Display estimated completion time based on average pipeline duration
- Allow drag-and-drop reordering of the pending queue (stored as a priority_override field)

---

**Round 10 of 10 -- "No way to track which version of my profile was used for each package"**

**Concern:** The cv_packages table stores `profile_version` as an integer. If I update my profile mid-week (adding a new publication or achievement), packages generated before and after the update use different profile versions. But the review interface does not surface this. I cannot tell whether a package was generated with my old profile or my updated one. If I add a new achievement on Tuesday, I might approve a Monday-generated package on Wednesday without realizing it does not include my latest addition. The profile_version is tracked but invisible.

**Analysis:** The master profile versioning is well-designed at the data layer (master_profile_versions table, profile_version in cv_packages). But the UX layer does not expose this. The review interface (Section 19.3, 19.4) shows job details, match data, QA scores, and status -- but not which profile version was used. For a candidate who updates her profile regularly (new publications, new achievements, skill updates), knowing whether a package reflects the latest profile is important for quality control. The regeneration handler (WF11) allows re-generating with the current profile, but the candidate needs to know which packages need regeneration. A simple "Profile version: 3 (current: 5)" indicator on each package with a "Regenerate with latest profile" button would close this gap.

**Score: 6/10**

**Recommendations:**
- Add profile_version to the review dashboard and detail view
- Show "Current profile: v5 | This package: v3" with a visual indicator when they differ
- Add a "Regenerate with latest profile" button on packages generated with older profile versions
- After a profile update, show a banner in the review interface: "Profile updated to v5. 3 packages were generated with v4. Regenerate?"
- In the daily digest, note packages generated with non-current profile versions

---

**Persona 1 v3 Summary: The Candidate (Selvi)**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Inline edit re-rendering | 6/10 | No batching of edits before document re-render |
| 2 | No revert to AI version | 6/10 | Audit trail exists but no user-facing undo |
| 3 | Feedback does not improve prompts | 6/10 | Analysis layer stops at surfacing data |
| 4 | Further particulars gap persists | 5/10 | Academic context document not addressed in v3 |
| 5 | No generation hold or exclusion | 5/10 | Cannot suppress auto-generation for specific roles |
| 6 | Supporting statement not editable inline | 6/10 | Inline editing omits the newest document type |
| 7 | Online application forms not handled | 5/10 | Assumes all applications accept CV uploads |
| 8 | Low-match jobs still fully generated | 6/10 | No threshold to skip generation for poor matches |
| 9 | No generation queue visibility | 6/10 | Cannot see or prioritise pending generation |
| 10 | Profile version invisible in review UI | 6/10 | Version tracked in DB but not surfaced to candidate |

**Average Score: 5.7/10**

**Top 3 Issues:**
1. Further particulars gap carried from v2 without acknowledgement -- weakens academic application quality
2. No mechanism to suppress or delay generation for specific jobs -- conflicts with real-world mixed-application workflow
3. Feedback analysis layer stops at reporting, with no documented path from data to prompt improvement

---

### Persona 2: Technical Architect / n8n Expert -- v3

*15+ years infrastructure experience. Deep n8n expertise. Evaluates implementability, scalability, operational reliability, and whether the specification can actually be built as described.*

---

**Round 1 of 10 -- "The exiftool dependency for PDF metadata sanitisation is not installable on n8n's Docker image"**

**Concern:** Section WF9 node [6a] uses `exiftool` to overwrite PDF metadata. The n8n Docker image is based on Alpine Linux (n8n:latest) or Debian slim. exiftool is a Perl application that requires perl and several Perl modules. The PRD adds `poppler-utils` via `apt-get install` (Section 12.8) but does not add exiftool. On Alpine-based images, exiftool requires `perl-image-exiftool` from community repos. On Debian slim, it requires `libimage-exiftool-perl`. Neither is installed and the Dockerfile modification is missing. The metadata sanitisation will fail silently at runtime.

**Analysis:** The v3 fix for metadata sanitisation (nodes 6a and 7a) introduces a dependency on exiftool without documenting its installation. The backup strategy section includes a `RUN apt-get install` for poppler-utils but there is no equivalent for exiftool. Additionally, if the n8n Docker image is the official Alpine-based image, `apt-get` commands will not work at all -- Alpine uses `apk`. The PRD does not specify which n8n Docker image variant is used. Furthermore, calling `execSync` from within an n8n Code node requires that the external binary is on the container's PATH and that the Code node has permission to execute system commands. n8n's default configuration may restrict this via the `NODE_FUNCTION_ALLOW_EXTERNAL` setting and `EXECUTIONS_PROCESS` mode. The DOCX metadata sanitisation (node 7a) is described even more vaguely: "via the docxtemplater post-processing hook or zip manipulation" -- neither of which is specified in enough detail to implement.

**Score: 5/10**

**Recommendations:**
- Document which n8n Docker image variant is used (Alpine vs Debian) and adjust package installation commands accordingly
- Add exiftool installation to the Dockerfile section alongside poppler-utils
- Alternatively, use a pure-JavaScript PDF metadata library (e.g., pdf-lib) within the Code node to avoid system binary dependencies
- Specify the DOCX metadata sanitisation method concretely -- either use docxtemplater's options or implement JSZip-based manipulation of docProps/core.xml and docProps/app.xml
- Verify that the Code node can call external binaries with the current NODE_FUNCTION_ALLOW_EXTERNAL configuration

---

**Round 2 of 10 -- "The HMAC download token exposes the auth token to client-side JavaScript"**

**Concern:** Section 19.8 describes download token generation: the review UI JavaScript computes an HMAC-SHA256 using the WEBHOOK_AUTH_TOKEN stored in the app's config. But the review UI is a static HTML file loaded in the browser. For the HMAC to work, the WEBHOOK_AUTH_TOKEN must be embedded in the client-side JavaScript -- visible in the page source to anyone who opens browser dev tools. This makes the "short-lived token" mechanism security theater: the master auth token is exposed, rendering the HMAC layer meaningless.

**Analysis:** The authentication architecture has a fundamental flaw. Browser-side HMAC computation requires the signing key to be available in JavaScript. The signing key is the same WEBHOOK_AUTH_TOKEN used for all webhook authentication. Once exposed in the browser, an attacker (or even the candidate's colleague glancing at her screen) could extract the token and access all webhook endpoints. The correct approach for file downloads in a browser context is: (1) the UI makes an authenticated API call (using the auth token in headers) to request a download URL, (2) the backend generates a short-lived signed URL or one-time token and returns it, (3) the browser uses that server-generated URL for the download. This way the auth token never appears in client-side code. The current design conflates the authentication secret with the signing key.

**Score: 4/10**

**Recommendations:**
- Never embed WEBHOOK_AUTH_TOKEN in client-side JavaScript
- Implement a server-side token generation endpoint: `POST /webhook/{uuid}/packages/{id}/download-token` (authenticated via header) returns a one-time download URL
- The download URL contains a server-generated, short-lived token that the backend validates independently
- Alternatively, use a session-based approach: the review UI authenticates once, receives a session cookie, and all subsequent requests (including downloads) use the cookie
- Remove the client-side HMAC code from the specification

---

**Round 3 of 10 -- "WF13 routing logic for 8+ endpoints in a single webhook is underspecified"**

**Concern:** Section 19.2 lists 9 distinct API endpoints, all under the same webhook path prefix. Section 19.7 shows WF13 handling these with a single webhook trigger and a Code node that parses the request method and path. But n8n webhooks route by path, not by sub-path segments. A single webhook trigger at `/webhook/{uuid}/packages` would match all GET and POST requests to that path, but would not match `/webhook/{uuid}/packages/{id}/approve` or `/webhook/{uuid}/jobs/{id}/notes` because those are different paths. In n8n, each distinct path segment typically requires its own webhook node or a wildcard path match.

**Analysis:** The review interface API design assumes RESTful routing (nested resource paths with method discrimination), which is natural for a framework like Express but awkward in n8n. n8n's webhook node supports: (1) a fixed path, (2) basic HTTP method filtering, and (3) query parameter access. It does not natively support path parameters like `{id}` or nested sub-resources like `/packages/{id}/approve`. To implement this in n8n, the developer would need either: (a) a single webhook with a wildcard path and manual path parsing in a Code node, (b) separate webhook nodes for each endpoint (9 webhook triggers in one workflow), or (c) a reverse proxy (nginx/Caddy) that routes to different n8n webhooks. None of these approaches is documented. The PRD specifies the API surface area but not how to implement it within n8n's webhook constraints. This is a significant gap between specification and implementability.

**Score: 5/10**

**Recommendations:**
- Document the n8n routing strategy: either wildcard webhook path with Code node routing, or separate webhook nodes per endpoint
- If using a single webhook, specify the wildcard path format and the Code node routing logic (regex path matching, method checking)
- If using separate webhooks, acknowledge the workflow complexity (9 webhook triggers in WF13)
- Consider a simpler API surface: use query parameters instead of path segments (e.g., `/webhook/{uuid}/api?action=approve&package_id=...`) which maps naturally to n8n's webhook capabilities
- Test the chosen approach with n8n's actual webhook implementation before committing to the specification

---

**Round 4 of 10 -- "The localStorage offline queueing has no conflict resolution"**

**Concern:** Section 19.8 adds localStorage caching and offline action queueing: "approval/rejection actions are queued in localStorage and synced when connectivity resumes." But what if the candidate approves a package offline, and in the meantime the system expires the job (because the listing closed)? The offline queue would try to set status to 'approved' on a package that is now 'expired'. There is no conflict resolution protocol for stale offline actions.

**Analysis:** The offline queue introduces an eventually-consistent model but the backend assumes immediate consistency. The cv_packages status field has no transition validation -- any status can be set to any other status (the CHECK constraint only validates the value, not the transition). An offline-queued approval for an expired package would succeed at the database level, creating an inconsistent state (approved package for an expired job). Similarly, if the candidate rejects a package offline and another process (e.g., WF8's stale-job recovery) changes the status in the meantime, the offline sync would overwrite the newer status. The specification should define: (1) valid status transitions, (2) server-side rejection of invalid transitions, (3) client-side handling of sync conflicts (show a "This package was updated while you were offline" message).

**Score: 5/10**

**Recommendations:**
- Define valid status transitions as a state machine (e.g., 'ready' -> 'approved' is valid, 'expired' -> 'approved' is not)
- Add a `last_updated_at` timestamp to all status change requests and reject requests where the server's updated_at is newer (optimistic concurrency)
- On sync conflict, show the candidate the current server state and ask them to confirm or discard their offline action
- Add a `status_transition_check` function to WF13 that validates transitions before applying them
- Log all rejected offline sync attempts for debugging

---

**Round 5 of 10 -- "The pipeline has no rate limiting for concurrent WF8 runs"**

**Concern:** WF8 runs every 15 minutes. But n8n does not guarantee that a previous execution completes before the next trigger fires. If the first WF8 run takes 20 minutes (processing 5 jobs with retries and long Claude API responses), the next scheduled run starts while the first is still active. Both runs query v_pending_cv_generation, potentially picking up overlapping jobs. The cv_packages INSERT (node 6) would prevent true duplicates, but the system could start processing the same job in two parallel runs before either reaches the INSERT.

**Analysis:** The concurrency issue is partially mitigated by the cv_packages INSERT (a job with an existing cv_packages row is excluded from v_pending_cv_generation by the LEFT JOIN). But there is a race condition window: between the SELECT in node [1] and the INSERT in node [6], another WF8 run could SELECT the same job. Both runs would attempt to INSERT a cv_packages row; one would succeed and one would hit the implicit uniqueness constraint (there is no explicit UNIQUE constraint on job_id in cv_packages -- only `CONSTRAINT unique_jd_analysis UNIQUE (job_id)` on jd_analyses). Actually, looking at the schema more carefully, cv_packages has no unique constraint on job_id -- it allows multiple packages per job (for regeneration/superseded scenarios). This means two concurrent runs could create two 'generating' packages for the same job with no constraint violation.

**Score: 5/10**

**Recommendations:**
- Add an advisory lock at the start of WF8: `SELECT pg_advisory_lock(8)` / `SELECT pg_advisory_unlock(8)` to prevent concurrent execution
- Alternatively, use n8n's "Workflow Concurrency" setting to limit WF8 to a single active execution
- Add a status check before cv_packages INSERT: `WHERE NOT EXISTS (SELECT 1 FROM cv_packages WHERE job_id = ? AND status NOT IN ('superseded', 'failed'))`
- Consider using `UPDATE jobs SET cv_package_status = 'generating' WHERE cv_package_status IS NULL RETURNING id` as an atomic claim mechanism
- Document the expected n8n execution mode (main vs own process) and its concurrency implications

---

**Round 6 of 10 -- "The Code node PII stripping uses structuredClone which may not be available in n8n"**

**Concern:** Node [5a] in WF8 uses `structuredClone()` to deep-copy the profile before stripping PII. structuredClone was introduced in Node.js 17 (stable in Node 18). The n8n Docker image version is not specified in the PRD. If n8n is running on Node.js 16 (still common in older n8n images), structuredClone will throw a ReferenceError and the entire pipeline will fail on every run.

**Analysis:** The PRD does not specify the n8n version or the underlying Node.js version. n8n 1.x images use Node.js 18+, but earlier n8n versions or custom installations may use Node.js 16. Even on Node.js 18, the Code node in n8n runs in a sandboxed VM context where not all global APIs are available -- the n8n sandbox may not expose structuredClone. A safer deep-copy approach would be `JSON.parse(JSON.stringify(profile))`, which works in all Node.js versions and in n8n's sandbox. This is a small but deployment-critical detail.

**Score: 6/10**

**Recommendations:**
- Replace `structuredClone()` with `JSON.parse(JSON.stringify())` for maximum compatibility
- Specify the minimum n8n version and Node.js version in Appendix D
- Test all Code node scripts in n8n's actual sandbox environment, not just in a standard Node.js REPL
- Document which Node.js APIs are available in n8n's Code node sandbox
- Add a Phase 0 task to verify all Code node scripts execute successfully in the target n8n version

---

**Round 7 of 10 -- "No health check or circuit breaker for the Claude API across the pipeline"**

**Concern:** Section 16.4 lists a health check for Gotenberg, Postgres, and disk space. For the Claude API, it says "Validated by the first API call in the pipeline. No separate health check." But the pipeline makes 4-5 sequential Claude API calls per job (JD analysis, mapping, CV generation, cover letter, QA). If the API starts returning errors midway through (rate limit hit, Anthropic outage), the system has already spent ~$0.003 on earlier stages that are now wasted. There is no circuit breaker that detects "Claude API is unhealthy" and pauses the pipeline until it recovers.

**Analysis:** The retry strategy (Section 16.2) handles individual call failures, but there is no pipeline-level intelligence. If Claude returns a 429 rate limit on the CV generation call (Stage 3), the system retries after 60 seconds. If it keeps hitting the rate limit (because the 15-minute batch sent 5 concurrent jobs), each job retries independently, potentially making the rate limit worse. There is no concept of "the API is having a bad day, pause all processing and try again in 30 minutes." The max 3 retries per call with the 5 jobs * 4-5 calls per job = 20-25 API calls per batch could trigger rate limits, especially with Anthropic's per-minute token limits. A circuit breaker pattern (after N consecutive failures across any stage, pause the pipeline for M minutes) would prevent cascade failures and wasted spending.

**Score: 6/10**

**Recommendations:**
- Add a circuit breaker: if 3 consecutive Claude API calls fail (across any stage, any job in the batch), pause WF8 for 30 minutes
- Implement the circuit breaker as a Postgres counter: increment on failure, reset on success, check before each call
- Add an API health status to the monitoring dashboard
- Stagger API calls within a batch: add a 2-second delay between jobs to avoid rate limit spikes
- Consider processing jobs serially within a WF8 run rather than using n8n's Loop Over Items (which may parallelise)

---

**Round 8 of 10 -- "The backup script uses docker exec for pg_dump which requires the container name"**

**Concern:** Section 17.6 backup script runs `docker exec selvi-postgres pg_dump`. The container name "selvi-postgres" is hardcoded but never defined elsewhere in the PRD. The Docker Compose addition (Appendix C) only defines the gotenberg service. The Postgres container is assumed to exist from Module 1 but its container name, network, and Docker Compose service name are not documented. If the Postgres container was created by Dokploy (which assigns its own container naming convention), the hardcoded name will fail.

**Analysis:** The PRD references Module 1's infrastructure for Postgres, n8n, and the overall Docker setup, but does not document the actual container names or Dokploy service identifiers. Dokploy manages containers with its own naming scheme (typically `{project}-{service}-{hash}`), not simple names like "selvi-postgres." The backup script, cron job, and recovery procedure all depend on knowing the exact container identifier. Additionally, the backup script uses `find ... -delete` which violates the user's permissions constraint (no rm/destructive operations), though this is in a bash script context rather than an interactive session. The script also lacks error handling: if pg_dump fails, the script continues silently, and the monitoring check (backup < 48 hours old) would not fire until 48 hours later.

**Score: 5/10**

**Recommendations:**
- Use `docker compose exec postgres` (service name) instead of `docker exec selvi-postgres` (container name) for portability
- Document the Dokploy service name for the Postgres container, or use `docker compose -f /path/to/compose.yml exec ...`
- Add error handling to the backup script: check pg_dump exit code, send alert on failure
- Replace `find ... -delete` with `find ... -exec rm {} \;` preceded by a count check, or use a retention-based approach that is less destructive
- Add the backup script's cron entry to the configuration checklist (Appendix D)

---

**Round 9 of 10 -- "The review_audit_log captures IP address but the review UI is a static page with no proxy"**

**Concern:** Section 19.7b stores `ip_address INET` in the review_audit_log. But the review UI communicates with the backend via n8n webhooks. n8n's webhook node does not natively expose the client's IP address in the execution data -- it exposes the request headers, body, and query parameters. If the candidate accesses the review UI from behind a NAT, VPN, or mobile carrier, the IP address captured would be unreliable anyway. If there is a reverse proxy (nginx/Caddy) in front of n8n, the IP would be the proxy's address unless X-Forwarded-For headers are parsed. The audit log captures an IP field that may never contain useful data.

**Analysis:** This is a minor issue in terms of functionality but reveals a pattern: the audit log schema was designed with enterprise compliance in mind (IP address, user agent) for what is a single-user system. The IP address is not useful for a system with one user (it is always her). The user agent might have marginal value for debugging mobile vs desktop issues. More importantly, the n8n webhook configuration needed to actually populate these fields is undocumented. The WF13 webhook handler would need to extract `$input.first().headers['x-forwarded-for']` or `$input.first().headers['x-real-ip']` and pass it to the audit insert. None of this is specified.

**Score: 7/10**

**Recommendations:**
- Document how WF13 extracts IP address and user agent from n8n webhook execution data
- For a single-user system, consider dropping ip_address from the audit log (it adds complexity without value)
- If retained, document the reverse proxy configuration needed for accurate IP forwarding
- Keep user_agent as it helps debug mobile vs desktop rendering issues
- Focus the audit log on what matters: action, timestamp, previous_value, new_value

---

**Round 10 of 10 -- "The appendix SQL migration script is incomplete relative to the v3 additions"**

**Concern:** Appendix A contains the "Complete SQL Migration Script" but it does not include: (1) the review_audit_log table added in Section 19.7b, (2) the supporting_statement columns added to cv_packages (supporting_statement_pdf_path, supporting_statement_docx_path, supporting_statement_content), (3) the cipd_requirement_type column added to jd_analyses in v3. The "complete" migration script is a snapshot of v1 with some v2 additions but has not been synchronized with v3 changes.

**Analysis:** The migration script in Appendix A is presented as the authoritative DDL for the database. An implementer running this script would create a database that is missing tables and columns defined elsewhere in the PRD. The cv_packages table in Appendix A does not include supporting_statement_pdf_path, supporting_statement_docx_path, or supporting_statement_content (these are defined in Section 13.5 but not in the appendix). The jd_analyses table in Appendix A does not include cipd_requirement_type (added in the v3 fixes). The review_audit_log table (Section 19.7b) is defined inline but not in the appendix. The v_pending_cv_generation view in Appendix A includes the red flags exclusion but uses different column names than the section 13 version. This migration script / section 13 / inline definitions divergence means an implementer must cross-reference three different locations to construct the actual schema.

**Score: 5/10**

**Recommendations:**
- Synchronize Appendix A with all v3 additions: add review_audit_log table, add supporting statement columns to cv_packages, add cipd_requirement_type to jd_analyses
- Use a single authoritative location for DDL (either Section 13 or Appendix A, not both)
- Add a "Schema Version" header to the migration script that matches the PRD version
- Include ALTER TABLE statements at the end for columns added in v2/v3 to support incremental migration
- Add a schema validation step to Phase 0 that verifies all tables/columns exist

---

**Persona 2 v3 Summary: Technical Architect / n8n Expert**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | exiftool dependency missing | 5/10 | Metadata sanitisation will fail without documented install |
| 2 | HMAC token exposes auth secret | 4/10 | Client-side HMAC computation requires embedding the master token |
| 3 | n8n webhook routing for REST API | 5/10 | 9 endpoints on one webhook path incompatible with n8n routing |
| 4 | Offline queue conflict resolution | 5/10 | No handling of stale offline actions conflicting with server state |
| 5 | Concurrent WF8 race condition | 5/10 | No locking prevents duplicate package generation |
| 6 | structuredClone compatibility | 6/10 | May not work in n8n sandbox or older Node.js |
| 7 | No Claude API circuit breaker | 6/10 | Individual retries without pipeline-level health awareness |
| 8 | Backup script hardcoded container name | 5/10 | Dokploy naming convention not documented |
| 9 | Audit log IP address unimplementable | 7/10 | Schema field with no implementation path |
| 10 | Migration script out of sync | 5/10 | Appendix A missing v3 tables and columns |

**Average Score: 5.3/10**

**Top 3 Issues:**
1. HMAC download token design exposes the authentication secret in client-side code -- genuine security vulnerability
2. n8n webhook routing model incompatible with the specified REST API surface -- needs architectural resolution
3. Migration script divergence from inline definitions creates implementation ambiguity

---

### Persona 3: UK Recruitment Expert / Career Coach -- v3

*20 years in UK recruitment across corporate and academic sectors. CIPD Fellow. Has reviewed thousands of CVs and coached senior professionals through career transitions.*

---

**Round 1 of 10 -- "The corporate CV template puts skills before experience, which is wrong for senior candidates"**

**Concern:** Section 11.2 shows the corporate CV template order: Header -> Professional Summary -> Core Skills -> Professional Experience -> Education. For a candidate at Manager-to-Head level with 18 years of experience, this is the wrong order. Skills sections are used by career changers and junior candidates to front-load transferable skills. Senior candidates should lead with experience because their track record is their strongest asset. Putting a skills list before experience makes the CV look like she is compensating for something. UK recruiters at this seniority level want to see where she worked and what she achieved before a skills summary.

**Analysis:** The skills-before-experience layout is a common mistake in template design. ATS systems parse both sections regardless of order, so the argument that skills placement improves ATS scoring is false. What matters for ATS is keyword presence, not placement. For the 6-second recruiter scan, experience entries with recognizable company names and progressive job titles create a stronger first impression than a bullet list of skills. The UK convention for senior professionals (10+ years experience, targeting Director/Head level) is: Summary -> Experience -> Skills (or Skills integrated into experience bullets) -> Education. The current template design works for a mid-career candidate or a career changer but undersells a senior profile. The academic CV template correctly puts Qualifications first (UK academic convention), so the template ordering is not universally wrong -- it is specifically wrong for the corporate variant at this seniority level.

**Score: 6/10**

**Recommendations:**
- Reorder the corporate CV template: Summary -> Professional Experience -> Core Skills -> Education
- Keep skills below experience to avoid the "compensating" signal
- Consider making the skills section format a horizontal inline list (pipe-separated) rather than a bulleted block, saving vertical space
- The JD analysis could determine optimal section ordering per role seniority -- but for a single-candidate system, hardcoding the senior layout is sufficient
- Test the reordered template with 3-4 UK L&D recruiters during Phase 8

---

**Round 2 of 10 -- "No handling of recruitment agency-specific conventions beyond cover letter tone"**

**Concern:** The v3 fix for listing type detection adds agency-specific cover letter instructions (Section 9.4). But agency conventions affect more than just the cover letter. Agencies often: (1) strip the candidate's contact details and replace them with the agency's, (2) require a specific CV format or their own template, (3) want a "registration CV" that is broader than a tailored one, (4) reformat CVs themselves before forwarding to clients. Generating a tightly tailored CV for an agency listing may work against the candidate if the agency reformats it or if the end client has different requirements than the listed JD suggests.

**Analysis:** The system treats agency listings identically to direct employer listings for CV generation -- only the cover letter tone changes. But agency recruitment follows a different dynamic. The JD from an agency may be a paraphrase of the client's actual requirements, with keywords that differ from what the client's ATS will scan for. The agency may have multiple similar roles and want to register the candidate for several. A highly tailored CV that focuses narrowly on one role's keywords may limit the agency's ability to put the candidate forward for related positions. For agency-sourced roles, a slightly broader CV (covering the role family rather than the specific listing) with a targeted cover letter may perform better than an aggressively tailored CV.

**Score: 5/10**

**Recommendations:**
- Add a `tailoring_intensity` parameter to the generation: "tight" for direct employer, "broad" for agency listings
- For agency listings, include more skills and wider experience coverage (top 6-8 highlights per role instead of top 4-5)
- Add a note in the package review that agency-sourced CVs may be reformatted by the agency
- Consider generating two variants for agency listings: one tailored (for the specific role) and one broader (for agency registration)
- Flag agency listings where the JD text appears paraphrased or generic (short descriptions, vague requirements)

---

**Round 3 of 10 -- "The 450-550 word target for corporate CVs is too tight for 18 years of experience"**

**Concern:** Section 8.3 specifies 450-550 words of body text for corporate CVs. For a candidate with 18 years, a PhD, an MBA, and experience across corporate and academic sectors, 450 words on 2 pages is very sparse. Typical senior-level UK CVs in L&D run 550-700 words over 2 A4 pages. The 450 lower bound would leave significant white space, making the CV look thin. The upper bound of 550 is tight for someone with 4-5 roles to cover, each needing 3-4 bullets, plus a summary and education section.

**Analysis:** The word count target determines content density. At 450 words across Professional Summary (60 words), Core Skills (40 words), Professional Experience (280 words for 4 roles at ~70 words each), and Education (70 words), the candidate gets roughly 3 bullets per role at 20-25 words each. For senior roles where achievements are complex and context matters, 3 bullets of 25 words each per role is restrictive. The template CSS uses 10.5pt Calibri at 1.45 line height with 18mm margins -- this will fit approximately 600-650 words on 2 pages before overflow. The 450-550 target leaves 50-200 words of wasted space. A more appropriate target for a senior candidate is 550-650 words, allowing 4-5 bullets per recent role and 2-3 per older role.

**Score: 6/10**

**Recommendations:**
- Increase the corporate CV word target to 550-650 words for candidates with 15+ years experience
- Make the word target configurable per seniority band in the master profile (or derive it from years of experience)
- Allow 4-5 bullets for the most recent 2 roles and 2-3 for older roles (currently max 4-5 and 2-3, but the word count constraint forces the lower end)
- Test the template rendering at 650 words to verify 2-page fit with the current CSS
- Add a post-render word count check based on actual rendered pages rather than estimated word count

---

**Round 4 of 10 -- "No handling of roles that require a specific application format beyond CV"**

**Concern:** Some UK employers, especially NHS, universities, and local authorities, require candidates to complete their own application form and explicitly state "CVs will not be accepted." Others require both a CV and an application form. Others have online portals where you paste sections into text boxes. The system's output is always PDF + DOCX, but the real UK application landscape is more varied. The JD analysis detects `submission_format` but this field has only one example value ("ats_portal") and is not used downstream.

**Analysis:** This overlaps with Persona 1 Round 7 (online forms) but from the recruiter perspective. UK public sector hiring almost universally uses application forms rather than CVs. Universities are split: some accept CVs + supporting statements, others require their own form. NHS roles use a standardized form (NHS Jobs). Local authorities use their own portals. The system is designed for the corporate job market where CV + cover letter is standard, but the candidate also targets academic roles where the submission format varies. The `submission_format` field exists in the JD analysis output but is unused -- it does not change generation behavior or alert the candidate. At minimum, the system should warn the candidate when a role requires a format the system does not produce.

**Score: 5/10**

**Recommendations:**
- Expand submission_format values to: "cv_upload", "online_form", "email_application", "application_form_only", "cv_and_form"
- When submission_format is "application_form_only" or "online_form", generate content in copy-paste-friendly format (plain text sections with character counts) instead of formatted documents
- Add a "Submission Warning" banner in the review interface for roles where CV submission may not be accepted
- For NHS roles (detectable from the employer name), add a note suggesting the candidate use the NHS Jobs portal
- Track submission_format distribution in the weekly dashboard to understand how often the CV-only output is insufficient

---

**Round 5 of 10 -- "The cover letter generation does not reference the candidate's notice period strategically"**

**Concern:** Section 9.3 mentions the cover letter should include "Availability / notice period." The master profile stores `notice_period` as a string. But notice period handling in UK cover letters is nuanced. If the candidate is currently employed, stating a 3-month notice period in a cover letter for a role that says "immediate start required" signals a mismatch the candidate might not want to highlight. Conversely, if she is between roles, stating immediate availability is a strong positive that should be prominently placed. The system treats notice period as a static field to include, not a strategic element to position.

**Analysis:** The cover letter prompt (Section 9.4) says "Close with availability and right-to-work statement" but does not provide strategic guidance on how to handle notice period relative to the JD's requirements. The JD analysis does not extract start date requirements ("immediate start", "ASAP", "January 2027 start"). The cover letter generation includes the notice period mechanically rather than strategically. If the JD says "immediate start" and the candidate has a 3-month notice period, the cover letter should either: (1) omit the notice period (address it only if asked), (2) mention willingness to negotiate an earlier release, or (3) frame the notice period positively ("available from [date], during which I can complete handover and begin induction preparation"). The current implementation dumps the notice period string without context.

**Score: 6/10**

**Recommendations:**
- Extract start date requirements from the JD analysis: "immediate", "asap", "specific_date", "flexible", "not_specified"
- When JD requires immediate start and candidate has >1 month notice, add strategic handling: omit notice period or frame as negotiable
- When candidate is immediately available, highlight availability prominently
- Add `notice_period_handling` guidance to the JD analysis output, similar to cipd_handling
- Allow the candidate to configure notice period display preference: "always show", "show only if compatible", "never show"

---

**Round 6 of 10 -- "The system does not handle competency-based interview questions embedded in job descriptions"**

**Concern:** Many UK JDs, particularly for mid-to-senior roles, include hints about interview questions: "Candidates will be assessed on their ability to..." or "At interview, you will be asked to present on..." or "The selection process includes a case study exercise." This information is valuable for the candidate to know at application stage, but the JD analysis does not extract it. The system focuses entirely on CV tailoring requirements and misses the interview process signals.

**Analysis:** The JD analysis output schema (Section 7.3) has no field for interview process or assessment method information. The `culture_signals` section captures working pattern and pace, but not the selection process itself. For the candidate, knowing that a role includes a presentation or case study affects her decision about whether to apply (some assessment methods play to her strengths, others less so). More practically, if the JD says "At interview, candidates will be asked to describe their experience of designing leadership development programmes for 500+ people," the CV should ensure that exact experience is prominently featured. This is a missed optimisation in the JD analysis that would improve CV tailoring precision and provide the candidate with useful interview preparation context.

**Score: 6/10**

**Recommendations:**
- Add an `assessment_process` field to the JD analysis output: presentation, case_study, panel_interview, competency_interview, psychometric, assessment_centre
- When competency-based interview questions are implied in the JD, extract them and weight the corresponding skills/achievements higher in the mapping
- Include detected assessment process information in the package review detail view as "Interview Notes"
- Use assessment hints to inform CV bullet point selection: if the JD hints at a presentation, include a bullet about presentation skills or delivery to large audiences
- This doubles as lightweight interview preparation without building a separate interview prep module

---

**Round 7 of 10 -- "Academic CV section ordering should be institution-specific"**

**Concern:** Section 8.3 defines a fixed academic CV section order: Qualifications -> Employment -> Teaching -> Research Interests -> Publications -> Conference Presentations -> Professional Memberships -> Referees. But different UK universities have different conventions. Russell Group universities weight research more heavily and expect Publications before Teaching Experience. Post-1992 universities weight teaching and pedagogy and expect Teaching Experience before Research. The CV section order sends a signal about the candidate's priorities, and the wrong order for the wrong university type can hurt.

**Analysis:** The current academic CV template uses a single fixed section ordering. This is a reasonable default but misses a significant UK academic nuance. Research-intensive universities (Russell Group: Oxford, Cambridge, UCL, Edinburgh, etc.) expect to see research output early in the CV. Teaching-focused universities (many post-1992 institutions: Anglia Ruskin, De Montfort, etc.) expect teaching evidence to come first. The JD analysis already classifies universities but does not use this to adjust CV structure. The master profile does not store university classification data. For a candidate straddling both markets, sending a teaching-first CV to a Russell Group university signals that research is not her priority, and sending a research-first CV to a teaching-focused university suggests she is not genuinely interested in teaching.

**Score: 6/10**

**Recommendations:**
- Add a `university_type` field to the JD analysis: "russell_group", "post_1992", "specialist", "other"
- Define two academic section orderings: research-first (for Russell Group) and teaching-first (for post-1992)
- The JD analysis prompt should classify the university type based on the institution name
- Store a university lookup table or heuristic (Russell Group member list is publicly available and stable)
- Apply the appropriate section ordering in the academic CV generation prompt

---

**Round 8 of 10 -- "The system does not handle references sections correctly for UK academic conventions"**

**Concern:** Section 8.3 academic CV template includes Referees as the last section with 2-3 academic referees. But UK academic applications have specific referee conventions that the system does not handle: (1) most universities require exactly 2 referees, one academic and one professional/managerial, (2) some require 3, (3) the referee must not be the same person as the applicant's current line manager if the role is at the same institution, (4) university HR departments contact referees before interview (not after offer, as in corporate), so the candidate must have permission before listing them. The system includes referees from the master profile without any of this context.

**Analysis:** The master profile's `referees` array has a `suitable_for` field (corporate/academic/both) which allows some filtering. But the academic CV template simply renders all referees with suitable_for == "academic" without checking: how many referees the specific university requires, whether the referees cover both academic and professional perspectives, or whether the candidate has confirmed availability with each referee for this specific period. Listing a referee who has not agreed to be contacted, or who is unavailable for the next month, could damage the application. The system should at minimum: (1) select the right number of referees based on the JD requirements, (2) default to 2 unless the JD specifies otherwise, (3) flag the referee section for candidate review with a note about confirming availability.

**Score: 6/10**

**Recommendations:**
- Extract referee requirements from the JD analysis: number required, types required (academic + professional), whether references are taken before interview
- Default academic CV to 2 referees (1 academic, 1 professional) unless the JD specifies otherwise
- Add a confirmation prompt in the review interface: "Please confirm your referees are available to provide a reference for this application"
- Add a `last_confirmed_available` date to each referee in the master profile
- Flag packages where the referee selection may not match the JD requirements

---

**Round 9 of 10 -- "ATS keyword matching uses exact string inclusion which misses morphological variants"**

**Concern:** Section 12.4 keyword coverage check uses `cvText.includes(kw)` for matching. This is case-insensitive (via `.toLowerCase()`) but requires exact substring match. If the JD says "programme management" and the CV says "managing programmes," the keyword is marked as missing. If the JD says "stakeholder engagement" and the CV says "engaging stakeholders," it is marked as missing. Real ATS systems use lemmatisation and semantic matching. The keyword coverage metric reports false negatives that alarm the candidate and misrepresent the CV's actual ATS performance.

**Analysis:** The keyword matching is deliberately simple (Section 12.4 is a Code node, not an LLM call, for cost and speed reasons). But the simplicity creates inaccurate reporting. For a candidate who reviews keyword coverage as part of her approval decision, seeing "65% keyword coverage" (below the 70% threshold) when the actual semantic coverage is 85% could lead to unnecessary regeneration or manual edits. The system flags the package as needing review when it might already be strong. A better approach would be to: (1) use the LLM for keyword matching (since the QA stage already calls Haiku), or (2) implement basic stemming in the Code node (strip common suffixes like -ing, -ed, -ment, -tion, -s), or (3) report both exact and estimated coverage.

**Score: 6/10**

**Recommendations:**
- Add basic stemming to the keyword matching: strip common suffixes before comparison
- Report two coverage metrics: "exact match" and "estimated semantic match" (exact + stemmed variants)
- Use the QA LLM call (which already reviews the CV) to produce a more accurate keyword coverage assessment as part of the hallucination check
- Lower the alert threshold for exact match (since it undercounts) or remove it and rely on the LLM-assessed coverage
- Include the keyword matching methodology in the package detail view so the candidate understands why some keywords are marked "missing"

---

**Round 10 of 10 -- "No handling of the 'Dr' title convention in UK professional contexts"**

**Concern:** The candidate has a PhD. In UK academic contexts, "Dr" is universally expected and its absence would be unusual. In UK corporate contexts, using "Dr" on a CV is a nuanced decision: it signals academic credentials which can be a positive differentiator or can create the impression of being "too academic" for a commercial role. The system always refers to the candidate as "Dr Selvi [Surname]" in cover letter sign-offs (Section 9.4 output schema) but does not vary this by context. Some L&D directors recommend dropping "Dr" on corporate CVs to avoid the academic perception. Others say it adds gravitas. The system should at least make this configurable.

**Analysis:** The cover letter output schema shows `"candidate_name": "Dr Selvi [Surname]"` as a fixed format. The CV header uses `{{candidate_name}}` from the profile basics. If the master profile stores the name as "Dr Selvi [Surname]," all corporate and academic outputs use the same format. The master profile has `title_variants` for job title (corporate_ld, academic, general) but not for the candidate's own name/title presentation. For corporate L&D roles at the Manager level, "Selvi [Surname], PhD" in the CV header and "Selvi [Surname]" in the cover letter sign-off (with PhD mentioned in qualifications) may be more effective than leading with "Dr." For academic roles, "Dr Selvi [Surname]" is expected and its absence would look odd. This is a small detail that signals cultural fluency in each sector.

**Score: 7/10**

**Recommendations:**
- Add `name_variants` to the master profile: `corporate` ("Selvi [Surname], PhD, MBA") and `academic` ("Dr Selvi [Surname]")
- Use the appropriate name variant in CV header and cover letter sign-off based on cv_type
- Make this configurable rather than hard-coded: some candidates prefer "Dr" in all contexts
- Add the naming convention note to the QA checklist
- This is a small change with outsized signaling impact

---

**Persona 3 v3 Summary: UK Recruitment Expert / Career Coach**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Skills before experience in corporate CV | 6/10 | Wrong section ordering for senior candidates |
| 2 | Agency-specific CV tailoring intensity | 5/10 | CV generation identical for direct and agency listings |
| 3 | Word count target too tight | 6/10 | 450-550 words insufficient for 18 years of experience |
| 4 | Application format beyond CV/DOCX | 5/10 | submission_format detected but unused |
| 5 | Notice period not handled strategically | 6/10 | Static inclusion without JD context |
| 6 | Interview hints not extracted | 6/10 | Assessment process signals ignored in JD analysis |
| 7 | Academic CV order not institution-specific | 6/10 | Fixed ordering does not adapt to university type |
| 8 | Referee conventions incomplete | 6/10 | Number, type, and confirmation not handled |
| 9 | Keyword matching too literal | 6/10 | Exact string match misses morphological variants |
| 10 | Dr title convention not context-sensitive | 7/10 | Small detail with significant signaling impact |

**Average Score: 5.9/10**

**Top 3 Issues:**
1. Agency-sourced roles need different tailoring intensity -- current approach may hurt with recruitment agencies
2. Application format gap means system cannot help with form-based applications (20-30% of academic roles)
3. Academic CV section ordering should adapt to university type (research-intensive vs teaching-focused)

---

### Persona 4: AI/LLM Integration Specialist -- v3

*Specialises in production LLM systems. 5 years building AI pipelines. Evaluates prompt engineering, model selection, hallucination prevention, cost efficiency, and system reliability.*

---

**Round 1 of 10 -- "The hallucination detection prompt asks Haiku to fact-check Sonnet's output, but Haiku has weaker reasoning"**

**Concern:** Section 12.3 uses Haiku for hallucination detection specifically because it is a "different model from the Sonnet generator to avoid same-model confirmation bias." The cross-model rationale is sound. But Haiku is a smaller, faster model with weaker reasoning than Sonnet. Fact-checking requires comparing nuanced claims against a complex profile. Haiku may lack the reasoning capacity to detect subtle embellishments that Sonnet is more likely to generate. Using a less capable model to validate a more capable model's output is an unusual QA pattern.

**Analysis:** The cross-model validation design is motivated by a real concern (same-model confirmation bias). But the implementation creates a different problem: capability asymmetry. Sonnet can generate sophisticated, plausible-sounding embellishments -- "Led the digital transformation of L&D across three business units" when the profile says "Supported the L&D digitisation project in one division." Haiku, tasked with fact-checking, may accept the embellishment because the claim is broadly consistent with the profile (the candidate did do something digital-related in L&D). The falsification prompt ("look for reasons to reject claims") partially mitigates this, but the model's reasoning depth determines how thoroughly it can decompose and verify claims. The programmatic metrics extraction (Section 12.3) handles the quantitative side well (numbers, percentages, team sizes). The gap is in qualitative fact-checking: scope inflation, role inflation, and causal attribution.

**Score: 6/10**

**Recommendations:**
- Add specific examples of common embellishment patterns to the Haiku QA prompt: scope inflation ("one division" -> "three business units"), role inflation ("supported" -> "led"), causal attribution ("contributed to" -> "achieved")
- Use the programmatic metrics check as the primary quantitative validation and Haiku only for qualitative claims
- Consider running Haiku QA with a structured comparison format: for each claim, require the exact profile text it maps to (not a summary, the exact text)
- Monitor false negative rate during Phase 8: track how often the candidate catches fabrication that QA missed
- If false negatives exceed 5%, upgrade QA to Sonnet and accept the cost increase (an additional ~$0.02 per package)

---

**Round 2 of 10 -- "The master profile is sent in full to every Claude API call, wasting context window and cost"**

**Concern:** The pipeline sends the full master profile JSON to four different Claude API calls: mapping (Stage 2), CV generation (Stage 3), cover letter (Stage 3b), and QA validation (Stage 4). The master profile is comprehensive -- potentially 15,000+ tokens for a candidate with 18 years of experience, multiple publications, teaching history, and detailed highlights. Sending 15k tokens four times costs ~60k tokens of input, and the mapping stage has already determined which parts of the profile are relevant. Stages 3 and 4 do not need the full profile.

**Analysis:** The mapping stage (Stage 2) produces a `cv_structure` object that specifies exactly which experience entries, highlights, skills, and qualifications to include. After mapping, the CV generation prompt could receive only the mapped profile sections rather than the entire profile. This would reduce input tokens for Stage 3 from ~6,000 to ~3,000, saving ~$0.01 per package. More importantly, it reduces noise in the context window, allowing Sonnet to focus on the relevant content rather than filtering through 18 years of unrelated experience. The QA stage needs both the generated CV and the relevant profile sections for comparison -- but again, not the full profile. The cover letter generation also benefits from a focused context. The current approach works but is inefficient, and as the profile grows over time (new publications, new achievements), the cost and noise will increase.

**Score: 7/10**

**Recommendations:**
- After Stage 2, build a "focused profile" containing only the mapped sections: selected highlights, relevant skills, relevant qualifications
- Pass the focused profile (not the full profile) to Stage 3 (CV generation) and Stage 3b (cover letter)
- For Stage 4 (QA), pass both the focused profile and the full profile (QA needs to verify nothing outside the mapping was fabricated)
- Track input token counts per stage to measure the reduction
- This optimisation becomes more important as the profile grows over time

---

**Round 3 of 10 -- "Temperature settings are specified but there is no justification for the specific values"**

**Concern:** The PRD specifies temperatures: 0.0 for extraction, 0.1 for mapping, 0.15 for CV generation, 0.2 for supporting statements, 0.25 for cover letters, 0.0 for QA. These look reasonable, but they are presented without empirical basis. Were they tested? What happens at temperature 0.3 for cover letters? Does 0.15 vs 0.2 for CV generation produce measurably different output quality? The specific values suggest precision that may not exist.

**Analysis:** Temperature selection for LLM applications is often more art than science. The PRD's temperature gradient (0.0 for deterministic tasks, increasing toward 0.25 for creative tasks) follows best practices, but the specific values (0.15 vs 0.2) imply a level of tuning that has not been documented. For a system generating 20-45 packages per week, the temperature settings directly affect output consistency. Too low and every cover letter sounds identical. Too high and the quality becomes unpredictable. The values are plausible defaults but should be treated as starting points for Phase 8 tuning, not as optimised parameters. The PRD presents them as fixed configuration values in Appendix D without noting they are tunable.

**Score: 7/10**

**Recommendations:**
- Note temperatures as "initial values, tuned during Phase 8" rather than presenting them as fixed
- During Phase 8, test 3 temperature values for each stage (e.g., 0.1, 0.15, 0.2 for CV generation) and measure candidate ratings
- Document the tuning results in the prompt changelog
- For cover letters, test whether higher temperature (0.3-0.4) produces more natural-sounding variation across packages
- Consider adaptive temperature: start at 0.15, increase to 0.25 for regeneration attempts (more variation on retry)

---

**Round 4 of 10 -- "The system has no A/B testing capability for prompt improvements"**

**Concern:** The feedback analysis (Section 19.7c) surfaces edit patterns and rating trends. The prompt improvement process requires changing prompts and hoping the next batch is better. There is no way to test a new prompt variant against the current one in a controlled manner. Without A/B testing, prompt changes are blind: you change the prompt, ratings go up or down, and you cannot tell whether the change caused the improvement or the job mix was different.

**Analysis:** For a system generating 20-45 packages per week, A/B testing prompt variants is feasible. Even a simple mechanism -- alternating between prompt version A and B for each package, tracking ratings by version -- would provide signal within 2-3 weeks. The current design treats prompts as monolithic: one system prompt per stage, used for all packages. This makes it impossible to iterate on prompts safely. A prompt change that improves corporate CV quality might degrade academic CV quality, and without controlled testing, this would not be detected until the candidate notices a pattern. The master profile has version tracking, but the prompts have no version tracking, no changelog, and no mechanism for controlled rollout.

**Score: 6/10**

**Recommendations:**
- Add a `prompt_version` field to cv_generation_log, tracking which prompt version was used for each stage
- Implement basic A/B testing: store two prompt variants for a stage, randomly assign each package to variant A or B, track ratings by variant
- Correlate prompt version with candidate ratings, callback rates, and edit frequency
- Add a prompt version changelog (stored in a `prompt_versions` table or document) recording each change with date and rationale
- After 4 weeks of A/B data, sunset the lower-performing variant

---

**Round 5 of 10 -- "No graceful degradation when Claude API quota is exhausted mid-month"**

**Concern:** Section 16.6 budgets GBP 30/month for Claude API costs. At ~$0.06-0.09 per package and 30 packages/week, monthly cost is ~$8-11. But what happens if there is a spike (major hiring wave produces 60 A/B-tier jobs in one week) or if regeneration requests increase costs? There is no spending cap in the system. The Claude API will continue processing until the Anthropic account runs out of credits or the monthly budget alarm fires -- but there is no budget alarm. The cost monitoring (Section 16.6) reports costs retrospectively, not prospectively.

**Analysis:** The cost estimates show ample headroom (estimated $8.45/month against a GBP 30 budget). But the system has no mechanism to: (1) track spend in real-time, (2) alert when spend reaches 80% of budget, (3) throttle generation when spend exceeds budget. In a spike scenario (a major employer posts 20 roles in one day, all scoring A/B-tier), the system would generate 20 packages in 4 WF8 runs (5 per run), consuming ~$1.20-1.80 in a single day. This is well within budget for a single day, but if sustained for a week, costs could reach $8-12 for that week alone. Combined with regeneration requests and retry overhead, a bad week could consume half the monthly budget. The Anthropic API has usage-based billing with no built-in spending caps unless manually configured.

**Score: 7/10**

**Recommendations:**
- Add a daily spend check at the start of each WF8 run: query cv_generation_log for current month's total cost, skip processing if >80% of budget
- Add a cost alert at 50% and 80% of monthly budget via WF0
- Set an Anthropic API spending limit at the account level as a hard cap
- During spike weeks, automatically reduce to A-tier only processing (skip B-tier to conserve budget)
- Add the monthly budget threshold to Appendix D configuration

---

**Round 6 of 10 -- "The 'Dr Sarah Mitchell' persona was identified as an issue in v1 but persists in v3"**

**Concern:** v1 Persona 1 Round 2 raised the concern that the CV generation prompt uses a fictional persona ("Dr Sarah Mitchell"). The recommendation was to "Remove the Dr Sarah Mitchell persona and replace with direct style instructions derived from the candidate's actual writing." The v3 fixes log does not mention this change. The persona remains in Section 8.3. While the master profile has pre-written variants that anchor the AI's output, the system prompt still asks Claude to role-play as a different person rather than matching the candidate's own voice.

**Analysis:** This is a legitimate issue that was raised in v1, scored 4/10, received specific recommendations, but was not addressed in v2 or v3. The fixes log shows that v2/v3 focused on structural and technical issues (supporting statements, stale jobs, ATS validation) rather than prompt quality issues. The persona is not harmful -- it provides Claude with a context for writing style -- but it introduces unnecessary indirection. The candidate's actual voice should be the reference point, not a fictional character's. The pre-written variants in the master profile partially mitigate this (they anchor specific text), but the system prompt frames all generation through an intermediary voice. For a system where voice authenticity is explicitly identified as critical to callback rate (Section 2.4, point 4), this remains an unaddressed quality concern.

**Score: 6/10**

**Recommendations:**
- Replace the "Dr Sarah Mitchell" persona with direct style instructions: "Write in a professional, achievement-focused UK CV style. Match the tone and phrasing patterns of the candidate's existing writing samples."
- Add 2-3 excerpts from the candidate's actual best-performing CVs to the prompt as few-shot examples
- Store these style examples in the master profile under a `style_samples` section
- Test with and without the persona during Phase 8 to measure impact on candidate satisfaction ratings
- The persona approach may work well as a creative writing technique, but CV writing for a specific person needs that person's voice

---

**Round 7 of 10 -- "No handling of Claude API response format changes or model deprecation"**

**Concern:** The PRD specifies model names as `claude-haiku-4-5` and `claude-sonnet-4-5`. These are current model identifiers, but Anthropic regularly deprecates model versions and releases new ones. When Anthropic deprecates claude-haiku-4-5, API calls will fail. The system has no mechanism for: (1) detecting model deprecation warnings, (2) automatically switching to successor models, (3) testing new model versions before switching. Additionally, Anthropic may change the API response format in a new API version.

**Analysis:** This is a long-term maintenance concern but a real one. The system hardcodes model identifiers in the workflow specification and Appendix D. Anthropic's deprecation policy typically provides 3-6 months notice, but the system has no mechanism to receive or act on that notice. If a model is deprecated, all 4-5 Claude API calls per package will fail simultaneously, and the system will mark every job as "failed" until someone manually updates the model identifiers in the n8n workflows. For a system designed to run with minimal manual intervention ("review rather than rewriting" -- Section 18.10), a silent model deprecation would cause days of missed applications before the candidate notices the failure.

**Score: 6/10**

**Recommendations:**
- Store model identifiers as n8n environment variables or credential fields rather than hardcoding in workflow nodes
- Add a monthly model status check: call the Anthropic API with a minimal test prompt and verify the response format
- Subscribe to Anthropic's deprecation announcements and add the deprecation timeline to the system's maintenance calendar
- Document the model upgrade procedure: update environment variable, test with 3 sample JDs, verify QA pass rate, then deploy
- Consider using model aliases if Anthropic supports them (e.g., `claude-haiku-latest`) to auto-upgrade within a model family

---

**Round 8 of 10 -- "The QA pipeline validates CV and cover letter but not the mapping stage output"**

**Concern:** Stage 4 (QA) validates the generated CV and cover letter against the master profile. But the mapping stage (Stage 2) output -- which determines which experience is highlighted, which bullets are selected, and the overall match percentage -- is never validated. If the mapping stage makes a poor selection (highlighting a weak achievement over a strong one, or classifying a strong match as a gap), this error propagates through the entire pipeline. The QA stage checks for hallucination but not for strategic errors in evidence selection.

**Analysis:** The mapping output drives all downstream generation. If Haiku mapping selects the wrong highlights, Sonnet generates a CV emphasising the wrong experience, and the QA pipeline validates it as factually correct (because the selected experience does exist in the profile -- it is just not the best choice). The current QA checks are: hallucination detection (factual accuracy), keyword coverage (keyword presence), format validation (section completeness), and metrics accuracy (number matching). None of these catch "you highlighted the wrong achievement" or "you classified this as a gap when there is strong matching experience in a different role." The candidate is the only quality gate for strategic evidence selection, and she may not notice suboptimal selections among 20-45 packages per week.

**Score: 6/10**

**Recommendations:**
- Add a "mapping quality" check: verify that must_include highlights from the profile are actually included in the CV structure
- Check that the experience_order puts the most recent and most relevant roles first
- Verify that at least one highlight per essential requirement is included (cross-check mapping against JD essential criteria)
- Flag packages where >2 essential requirements are mapped to highlights from the same single role (concentration risk)
- Consider adding a "mapping confidence" score that the candidate can use to prioritise review effort

---

**Round 9 of 10 -- "The system sends the entire JD analysis JSON to the CV generation prompt, inflating input tokens"**

**Concern:** The CV generation prompt (Section 8.3) includes `{{ jd_analysis_json }}`, `{{ master_profile_json }}`, and `{{ mapping_json }}` as separate inputs. The jd_analysis contains the full extraction (requirements, keywords, culture signals, red flags, person specification, application guidance). The mapping already summarizes the relevant information from the JD analysis. Sending both the full JD analysis and the mapping to the CV generation stage is redundant: the mapping is derived from the JD analysis, so the CV generator receives the same information twice in different forms. This wastes input tokens and could create confusion if the mapping and JD analysis have minor inconsistencies.

**Analysis:** The CV generation prompt receives three large JSON objects: JD analysis (~1,500 tokens), master profile (~6,000-15,000 tokens), and mapping (~2,000 tokens). The mapping already contains the relevant requirements, evidence selections, and keyword lists. The JD analysis is needed for the raw keyword list and culture signals, but most of its content (requirements, implicit requirements) is already processed in the mapping. A more efficient approach would send: (1) the mapping (which contains the evidence selections and CV structure), (2) the raw keyword list from the JD analysis (for keyword incorporation), (3) the relevant profile sections only (per Persona 4 Round 2), and (4) the format rules. This could reduce the CV generation input from ~9,000+ tokens to ~5,000, saving ~$0.005 per package.

**Score: 7/10**

**Recommendations:**
- Build a "generation context" object that extracts only what the CV generator needs: mapped evidence, keyword list, cv_type, culture signals, format rules
- Remove the full JD analysis from the CV generation prompt; include only the keyword_priority list and application_guidance
- Remove the full profile from the CV generation prompt; include only the mapped sections
- Track input token counts before and after optimisation to measure savings
- Apply the same optimisation to the cover letter and supporting statement prompts

---

**Round 10 of 10 -- "No monitoring of Claude API response latency trends over time"**

**Concern:** The system tracks duration_ms per stage in cv_generation_log. Section 16.3 mentions monitoring "average generation time." But there is no alerting on latency degradation. If Anthropic's API starts responding 50% slower (due to load, infrastructure changes, or model updates), the system will not detect this until pipeline executions start timing out. The 30-minute workflow timeout (Section 14.1) is a hard cutoff, but there is no soft warning for latency creep.

**Analysis:** This is a minor operational concern. The system tracks latency data but only reports averages in weekly summaries. A gradual latency increase (e.g., from 5 seconds to 8 seconds per CV generation call) would not trigger any alert but would increase end-to-end pipeline time from ~3 minutes to ~5 minutes, pushing against the 5-minute delivery target. More concerning, if API latency spikes to 25+ seconds during peak hours, the 5-job batch could take 10+ minutes per job, exceeding the 15-minute poll interval and causing the queue backlog problem from Persona 2 Round 5. Latency monitoring would provide early warning of infrastructure issues.

**Score: 7/10**

**Recommendations:**
- Add a latency alert: if average API response time exceeds 2x the expected latency for any stage over 1 hour, trigger an alert
- Track latency percentiles (p50, p95, p99) not just averages
- Add latency data to the monitoring dashboard
- Consider time-of-day analysis: if Anthropic's API is consistently slower at certain hours, schedule WF8 runs outside peak times
- This is low priority but easy to implement with existing cv_generation_log data

---

**Persona 4 v3 Summary: AI/LLM Integration Specialist**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | Haiku QA for Sonnet output | 6/10 | Capability asymmetry in fact-checking |
| 2 | Full profile sent to every API call | 7/10 | Token waste and context noise |
| 3 | Temperature values unjustified | 7/10 | Reasonable defaults but untested |
| 4 | No A/B testing for prompts | 6/10 | Prompt changes are blind without controlled testing |
| 5 | No API spending cap | 7/10 | Cost monitoring is retrospective only |
| 6 | Dr Sarah Mitchell persona persists | 6/10 | v1 issue still unaddressed after 3 versions |
| 7 | No model deprecation handling | 6/10 | Hardcoded model IDs with no upgrade path |
| 8 | Mapping stage output not validated | 6/10 | Strategic evidence selection errors propagate unchecked |
| 9 | Redundant context in generation prompt | 7/10 | Full JD analysis + full profile + mapping is wasteful |
| 10 | No API latency monitoring | 7/10 | Latency trends tracked but not alerted on |

**Average Score: 6.5/10**

**Top 3 Issues:**
1. The Dr Sarah Mitchell persona, raised in v1, has survived three versions without being addressed
2. No A/B testing capability makes prompt improvement a guessing game
3. Mapping stage errors (wrong evidence selection) propagate through the pipeline without any quality gate

---

### Persona 5: Privacy & Compliance Officer -- v3

*CIPP/E certified, 12 years in data protection. Former ICO auditor. Evaluates GDPR compliance, data minimisation, security architecture, and legal risk.*

---

**Round 1 of 10 -- "The PII stripping in node 5a strips personal_details but the profile schema uses basics"**

**Concern:** Node [5a] in WF8 (Section 14.1) strips PII from `profile.personal_details.email`, `profile.personal_details.phone`, etc. But the master profile schema (Section 6.2) stores these fields under `basics`, not `personal_details`. The stripping code references a field path that does not exist in the schema. The PII stripping would silently fail, sending the full profile (including email, phone, name, and address) to every Claude API call.

**Analysis:** This is a critical discrepancy between the PII stripping implementation and the actual data schema. Section 6.2 defines: `basics.email`, `basics.phone`, `basics.name`, `basics.location`. Node [5a] references: `profile.personal_details.email`, `profile.personal_details.phone`, `profile.personal_details.name`, `profile.personal_details.full_address`. Since `personal_details` does not exist as a key in the profile JSONB, `if (profile.personal_details)` evaluates to false, and the entire PII stripping block is skipped. The code continues with `delete profile.referees` (which does work, since `referees` is a top-level key in the schema), but all other PII remains intact. This is not a design flaw -- it is a bug in the specification that would directly result in sending PII to an external API.

**Score: 4/10**

**Recommendations:**
- Fix node [5a] to reference the correct schema paths: `profile.basics.email`, `profile.basics.phone`, `profile.basics.name`, `profile.basics.location`
- Add a unit test for the PII stripping function that verifies no email, phone, or full name appears in the stripped output
- Add a pre-send check before each Claude API call that scans the JSON payload for email patterns and phone number patterns
- The referees stripping works correctly (`delete profile.referees`); only the basics fields are mispathed
- This is a P0 bug that must be fixed before the first Claude API call

---

**Round 2 of 10 -- "The review UI static HTML file stores the auth token in JavaScript, visible in source"**

**Concern:** The review UI is a single HTML file (Section 19.8). For it to make authenticated API calls, the WEBHOOK_AUTH_TOKEN must be accessible to the JavaScript code. Whether it is hardcoded in the file, stored in a JavaScript variable, or injected via a query parameter, anyone with access to the HTML file or the browser's developer tools can extract the token. This token provides full access to the master profile (via WF10), all generated packages, and the ability to approve/reject applications. For a system containing 18 years of career data, publication records, and referee contact details, this is a meaningful security risk.

**Analysis:** This overlaps with Persona 2 Round 2 (HMAC token exposure) but from a compliance perspective. The fundamental issue is that a static HTML file cannot securely store secrets. The options are: (1) hardcode the token in the file (accessible to anyone who opens it), (2) prompt the user to enter it each time (poor UX), (3) store it in localStorage after first entry (persists until cleared, accessible to any script on the same origin), or (4) use a proper auth flow (OAuth, session cookies). For a single-user system, the risk profile is different from a multi-user system -- the "attacker" is likely the candidate's own household. But the master profile contains third-party data (referee contact details, which are stripped from API calls but accessible through WF10 GET), making this a data protection concern even in a single-user context.

**Score: 5/10**

**Recommendations:**
- Implement a simple session-based authentication: the candidate enters the auth token once, the server sets an HTTP-only secure cookie, and all subsequent requests use the cookie
- The auth token is never stored in JavaScript or localStorage
- Add CSRF protection to the cookie-based auth (SameSite=Strict cookie attribute)
- Set the cookie to expire after 24 hours, requiring re-authentication daily
- Remove the auth token from the review UI's JavaScript entirely

---

**Round 3 of 10 -- "The incident response plan does not address the Claude API audit log"**

**Concern:** Section 17.7 covers incident response for server-side data breaches (SSH access, database compromise). But there is a separate data exposure vector: the Claude API. Every API call sends candidate profile data to Anthropic's servers. If Anthropic experiences a data breach, the candidate's profile data (even the PII-stripped version) is exposed. The incident response plan does not address: (1) how to detect an Anthropic-side breach, (2) whether Anthropic notifies data processors of breaches, (3) what data was sent to Anthropic over the system's lifetime, (4) how to assess exposure if Anthropic's 30-day retention means historical data was already deleted.

**Analysis:** The privacy section (Section 17.2) documents Anthropic's data handling terms but the incident response plan (Section 17.7) focuses exclusively on server-side incidents. In the event of a headline "Anthropic data breach," the candidate needs to know: what data was exposed (which profile fields were sent, over what time period), whether PII was included (given the PII stripping bug in Round 1, potentially yes), and what actions to take. The system should maintain a log of what data was sent to external APIs, not just what data is stored locally. The cv_generation_log tracks tokens and cost but not the actual content sent. If PII stripping fails (as identified in Round 1), the Claude API received names, emails, and phone numbers, and the system has no record of which calls included PII and which were properly stripped.

**Score: 5/10**

**Recommendations:**
- Add Anthropic-side data breach to the incident response plan as a separate scenario
- Log a hash of each API payload (not the full content) so that post-breach, you can identify which calls included PII
- Add a boolean `pii_verified_stripped` flag to cv_generation_log, set by a post-stripping validation check
- Subscribe to Anthropic's security advisory communications
- Document what data is sent to Anthropic in each API call (which profile fields, whether PII-stripped) as a data processing record

---

**Round 4 of 10 -- "The download token for file access has a 1-hour window but no revocation mechanism"**

**Concern:** Section 19.8 describes download tokens with a 1-hour expiry. If the candidate generates a download token and her device is compromised within that hour, the token provides unauthenticated access to her CV PDFs. There is no way to revoke outstanding tokens. More practically, if she shares a download link (even accidentally, in a copied URL), anyone with the link can download her tailored CV for up to an hour. The review UI may expose these URLs in the browser history, in cached pages, or in referrer headers.

**Analysis:** For a single-user system, the 1-hour download token is a reasonable convenience vs security tradeoff. The exposure is limited: the token provides access to a single file (one CV or cover letter PDF), not to the full system. The file itself is a CV -- information the candidate is about to submit to employers anyway. The risk is not catastrophic. However, the lack of revocation means the candidate cannot "unsend" a shared link. In a more robust design, download tokens would be one-time-use (consumed on first download) rather than time-limited. This eliminates the window-of-exposure problem entirely.

**Score: 7/10**

**Recommendations:**
- Consider one-time-use tokens instead of 1-hour expiry: each token is valid for exactly one download, then invalidated
- If retaining time-based tokens, reduce the window to 15 minutes
- Store issued tokens in a database table so they can be revoked
- Add a "Revoke all download links" button in the review interface for emergency use
- Ensure download URLs use HTTPS to prevent interception

---

**Round 5 of 10 -- "The system stores generated CVs indefinitely as files on disk with no encryption"**

**Concern:** Section 17.3 specifies 6-month retention for generated CVs after job expiry. But during those 6 months, the files sit as plain PDFs and DOCXs on the Hetzner server's filesystem. Anyone with SSH access to the server can read every CV the system has ever generated. The files are not encrypted at rest. For a server that also runs n8n, Postgres, and Gotenberg (multiple attack surfaces), unencrypted CV files represent accumulated exposure over time. After 6 months of operation at 30 packages/week, there would be ~720 unencrypted CVs on disk.

**Analysis:** The generated CVs contain the candidate's tailored professional history, including specific achievements, metrics, and career narrative. While this data is less sensitive than the master profile (which has phone, email, and referee details), it is still personal data under GDPR. The Hetzner server uses full-disk encryption (standard for Hetzner cloud servers), which provides encryption at rest when the server is powered off. But when the server is running, the filesystem is mounted and accessible to any process with appropriate permissions. Docker containers with volume mounts have full read access to the generated files directory. A compromised Gotenberg container (which processes untrusted HTML content via Chromium) could access all generated CVs via the shared filesystem. Gotenberg runs Chromium to render HTML, and Chromium has a history of security vulnerabilities.

**Score: 6/10**

**Recommendations:**
- Ensure the generated-cvs volume mount is read-write only for n8n and read-only for other containers
- Do not mount generated-cvs into the Gotenberg container; instead, pass HTML content to Gotenberg via the API and receive PDF output via the API
- Currently, Gotenberg receives HTML via HTTP POST and returns PDF -- it does not need filesystem access to generated CVs. Verify this is the case.
- Add file-level encryption for generated documents using a key stored in n8n credentials (not on the filesystem)
- The Gotenberg container should have the most restricted filesystem access possible given that it runs Chromium

---

**Round 6 of 10 -- "The webhook UUID path prefix is static and not rotatable"**

**Concern:** Section 14.3 says webhook paths include "a UUID-based prefix to prevent URL guessing" (e.g., `/webhook/{uuid-secret}/profile`). But once the UUID is set, it appears to be permanent. If the UUID is leaked (in browser history, server logs, or a misconfigured reverse proxy), it cannot be rotated without updating every webhook URL in the review UI, any bookmarks, and any automated integrations. There is no documented rotation procedure.

**Analysis:** The UUID path prefix provides a security-through-obscurity layer on top of the auth token. This is defense-in-depth, not the primary security mechanism. But if both the UUID and the auth token are compromised (e.g., extracted from the review UI HTML file), the attacker has full API access. Rotation should be straightforward: change the UUID in n8n's webhook configuration and update the review UI file. But for a system with multiple webhooks (WF8, WF10, WF11, WF12, WF13), each webhook has its own path, and they may use different UUIDs. The rotation procedure should be documented so it can be performed quickly in response to a security incident.

**Score: 7/10**

**Recommendations:**
- Document the webhook UUID rotation procedure: update n8n webhook paths, update review UI configuration, test all endpoints
- Use a single UUID prefix for all webhooks so rotation requires one change, not multiple
- Add a "Rotate API credentials" item to the incident response checklist (Section 17.7, Step 6 mentions rotating credentials but not webhook paths)
- Consider adding the UUID to n8n environment variables rather than hardcoding in webhook nodes
- Log all webhook access (successful and failed) for intrusion detection

---

**Round 7 of 10 -- "The data retention cleanup process (Section 17.3) does not handle failed deletions"**

**Concern:** Section 17.3 specifies a monthly cleanup cron job that deletes files for expired jobs and old log entries. The cleanup runs as part of WF6. But if the cleanup fails (disk permission error, Postgres connection lost, file locked by another process), there is no retry mechanism, no alert, and no record of what was and was not cleaned up. Stale data accumulates silently. Over months, this could result in the system retaining personal data beyond the stated retention period, violating the candidate's own data retention policy.

**Analysis:** The retention policy states 6 months for generated documents, 3 months for generation logs, and 12 months for profile versions. The cleanup is described as a cron addition to WF6 but is not specified in detail. There is no: (1) cleanup execution log, (2) alert on cleanup failure, (3) verification that cleanup actually deleted the target files, (4) reconciliation between files on disk and database records. For GDPR compliance, the data controller should be able to demonstrate that retention periods are enforced, not just specified. A failed cleanup that goes undetected for 3 months means 3 months of excess data retention, and the candidate (as data controller) would not know about it.

**Score: 6/10**

**Recommendations:**
- Add cleanup execution logging: record how many files deleted, how many log entries purged, and any errors
- Alert on cleanup failure via WF0
- Add a monthly reconciliation check: count files on disk vs cv_packages records, alert on discrepancies
- Implement idempotent cleanup: mark records as "pending_deletion" first, then delete, then mark as "deleted" -- so partial failures can be resumed
- Add a data retention compliance report to the weekly monitoring summary

---

**Round 8 of 10 -- "The system does not implement data subject access requests (DSAR) capability"**

**Concern:** Under UK GDPR, even a single-user system where the candidate is the data controller has obligations if third-party data is processed. The master profile contains referee data (names, titles, emails, phones). If a referee exercises their right to access, rectify, or erase their data, the candidate must be able to: (1) identify all places their data appears (master profile, generated CVs, cover letters), (2) extract it in a machine-readable format (DSAR response), (3) rectify or erase it across all locations. The system has no mechanism for this.

**Analysis:** This is a theoretical but legally valid concern. Referees provide their details to be used in job applications, but they retain data subject rights. A referee who changes jobs or retires might want their details removed from the system. The master profile stores referee data in one place (easy to update), but generated CVs and cover letters that included the referee's name and contact details exist as static PDF/DOCX files across potentially hundreds of packages. Erasing a referee's data requires: (1) updating the master profile, (2) identifying all generated CVs that include the referee, (3) regenerating those documents or redacting them. The system has no mechanism to search generated documents for a specific referee's details or to batch-update/redact documents.

**Score: 6/10**

**Recommendations:**
- Add a referee data search capability: query cv_packages content JSONB for referee names across all packages
- When a referee is removed from the master profile, flag all packages that included that referee for review
- For future packages, the removal takes effect immediately (referees are added post-generation from the current profile)
- For historical packages, either regenerate or add a metadata note that the referee has been removed
- Document the DSAR process in the system's data protection records

---

**Round 9 of 10 -- "The Gotenberg container has network access to the app network with no egress restrictions"**

**Concern:** Appendix C places Gotenberg on the `app-network` Docker network alongside n8n and Postgres. The `--chromium-allow-list=file:///tmp/.*` restricts Chromium's URL navigation to local files. But Chromium can still make network requests (DNS lookups, font downloads, tracking pixels) if the HTML template contains external references. A malicious or poorly crafted HTML template could cause Gotenberg's Chromium to make outbound requests. More concerning, Gotenberg on the same network as Postgres means a Chromium vulnerability could be leveraged for lateral movement to the database.

**Analysis:** The `--chromium-allow-list` flag limits URL navigation but may not prevent all network activity from embedded content. Modern Chromium has protections against most abuse vectors, but the defense-in-depth principle suggests isolating Gotenberg from the database network. Docker Compose allows multiple networks: Gotenberg could be on a dedicated `render-network` shared only with n8n (which calls Gotenberg's API). This prevents Gotenberg from directly accessing Postgres even if Chromium is compromised. The current setup is common in small deployments and the risk is low, but for a system processing personal career data, the additional isolation is straightforward to implement.

**Score: 7/10**

**Recommendations:**
- Create a separate Docker network for Gotenberg: n8n bridges both the app-network and render-network; Gotenberg is only on render-network
- Add `--chromium-disable-routes-to-localhost=true` to Gotenberg's command line to prevent Chromium from accessing local services
- Verify that the HTML templates contain no external resource references (fonts, images, CSS) that would cause outbound requests
- Add `--chromium-deny-list=http://*,https://*` to block all HTTP(S) navigation except local files
- This is low-priority but easy to implement and reduces the blast radius of a Chromium vulnerability

---

**Round 10 of 10 -- "No consent tracking for referee data processing"**

**Concern:** The master profile stores referee contact details. Under UK GDPR, even with the legal basis of legitimate interest, the candidate should document that referees have consented to their details being: (1) stored in an electronic system, (2) included in generated CVs, (3) processed by Anthropic's API (though the v3 PII stripping should prevent this). The system stores referee details but has no mechanism to record or verify referee consent. If a referee complains to the ICO that their details were used without consent, the candidate has no evidence of consent.

**Analysis:** The PII stripping (node [5a]) deletes the referees section before sending to Claude, and referees are only included in the final document template rendering. This means referee data is not processed by Anthropic -- it stays on the candidate's own server. The legitimate interest basis for storing referee details is strong (they are needed for job applications, which is the purpose of the system). However, best practice would be to: (1) record when each referee consented to being listed, (2) allow periodic re-confirmation, (3) note which specific applications their details were used in. The master profile's referee schema has no consent-related fields. This is a compliance nicety rather than a hard requirement for a single-user system, but it demonstrates data protection maturity.

**Score: 7/10**

**Recommendations:**
- Add a `consent_date` field to each referee entry in the master profile schema
- Add a `consent_scope` field: "all_applications", "academic_only", "specific_applications"
- Add a `last_confirmed` date field with a reminder to re-confirm annually
- In the review interface, when a package includes referees, show a reminder: "Please confirm [Referee Name] is available for this application"
- This is low-priority compliance polish but demonstrates good data protection practice

---

**Persona 5 v3 Summary: Privacy & Compliance Officer**

| Round | Topic | Score | Key Issue |
|-------|-------|-------|-----------|
| 1 | PII stripping references wrong schema path | 4/10 | Bug: stripping code targets nonexistent field path |
| 2 | Auth token in static HTML | 5/10 | Credential exposure in client-side code |
| 3 | Incident response ignores API-side breaches | 5/10 | Anthropic breach scenario not covered |
| 4 | Download tokens not revocable | 7/10 | Time-based tokens with no emergency revocation |
| 5 | Unencrypted CVs on shared filesystem | 6/10 | Gotenberg/n8n share volume mount access |
| 6 | Webhook UUID not rotatable | 7/10 | No documented rotation procedure |
| 7 | Cleanup failures undetected | 6/10 | Retention enforcement not verifiable |
| 8 | No DSAR capability for referee data | 6/10 | Cannot locate/erase referee data across generated documents |
| 9 | Gotenberg network exposure | 7/10 | Chromium on same network as Postgres |
| 10 | No referee consent tracking | 7/10 | Compliance nicety, not a hard requirement |

**Average Score: 6.0/10**

**Top 3 Issues:**
1. PII stripping code references `personal_details` instead of `basics` -- a specification bug that would send PII to Anthropic in production
2. Auth token exposure in client-side JavaScript -- a security architecture flaw affecting the entire review interface
3. Incident response plan does not cover API provider breaches -- a growing concern as more data flows through third-party APIs

---

## v3 Overall Evaluation Summary

### Scores by Persona

| Persona | v1 Average | v2 Average | v3 Average | v2->v3 Change |
|---------|-----------|-----------|-----------|---------------|
| 1. The Candidate (Selvi) | 3.6/10 | 4.7/10 | 5.7/10 | +1.0 |
| 2. Technical Architect / n8n Expert | 4.4/10 | 4.0/10 | 5.3/10 | +1.3 |
| 3. UK Recruitment Expert / Career Coach | 3.4/10 | 4.7/10 | 5.9/10 | +1.2 |
| 4. AI/LLM Integration Specialist | 4.2/10 | 5.0/10 | 6.5/10 | +1.5 |
| 5. Privacy & Compliance Officer | 3.6/10 | 4.6/10 | 6.0/10 | +1.4 |
| **Overall Average** | **3.84/10** | **4.60/10** | **5.88/10** | **+1.28** |

### Improvement Trajectory

The v3 PRD shows consistent improvement across all five personas, with the strongest gains in the AI/LLM Integration (+1.5) and Privacy & Compliance (+1.4) domains. The Technical Architect score recovered from its v2 dip (+1.3 from v2), reflecting the completion of previously half-specified features (supporting statement pipeline, PII stripping, ATS validation). The Candidate persona continues its steady climb (+1.0), with remaining issues shifting from "fundamental gaps" (v1) to "workflow polish" (v3).

### Critical Bug Found

**PII stripping code targets nonexistent field path (Persona 5, Round 1).** Node [5a] references `profile.personal_details.*` but the master profile schema defines personal data under `profile.basics.*`. The entire PII stripping block would silently no-op in production, sending the candidate's full name, email, phone number, and address to every Claude API call. This is a P0 bug that must be fixed before the first production API call. Severity: CRITICAL.

### Top 10 Remaining Issues (Prioritised)

| # | Issue | Persona | Score | Priority |
|---|-------|---------|-------|----------|
| 1 | **PII stripping code references wrong field path** -- `personal_details` vs `basics` | Compliance | 4/10 | P0 -- Fix before launch |
| 2 | **Auth token exposed in client-side JavaScript** -- HMAC design requires embedding master token in browser | Technical + Compliance | 4-5/10 | P0 -- Security flaw |
| 3 | **n8n webhook routing incompatible with REST API design** -- 9 endpoints on one webhook path | Technical | 5/10 | P1 -- Architecture must be resolved |
| 4 | **Further particulars gap persists from v2** -- academic applications miss critical context | Candidate | 5/10 | P1 -- Weakens academic pathway |
| 5 | **No generation suppression/hold mechanism** -- cannot prevent auto-gen for in-progress roles | Candidate | 5/10 | P1 -- Conflicts with real workflow |
| 6 | **Concurrent WF8 race condition** -- no locking prevents duplicate packages | Technical | 5/10 | P1 -- Data integrity risk |
| 7 | **Dr Sarah Mitchell persona persists from v1** -- raised in v1 Round 2, still not addressed | AI/LLM | 6/10 | P2 -- Quality concern |
| 8 | **Application form format not handled** -- submission_format detected but unused | Recruitment | 5/10 | P2 -- Covers 20-30% of academic roles |
| 9 | **Offline queue has no conflict resolution** -- stale actions can overwrite server state | Technical | 5/10 | P2 -- Edge case but data-corrupting |
| 10 | **Mapping stage output not validated** -- strategic evidence selection errors propagate unchecked | AI/LLM | 6/10 | P2 -- Silent quality degradation |

### Top 5 Should Fix (Post-Launch)

| # | Issue | Persona | Score | Value |
|---|-------|---------|-------|-------|
| 1 | **Corporate CV section reordering** -- skills before experience wrong for senior candidates | Recruitment | 6/10 | Signals seniority appropriately |
| 2 | **A/B testing for prompt improvements** -- blind prompt changes without controlled testing | AI/LLM | 6/10 | Enables data-driven quality improvement |
| 3 | **Academic CV ordering by university type** -- research-first vs teaching-first | Recruitment | 6/10 | Demonstrates academic sector fluency |
| 4 | **Context optimisation for API calls** -- full profile + full JD + mapping is redundant | AI/LLM | 7/10 | Cost reduction and quality improvement |
| 5 | **Inline edit batching** -- re-render on every edit vs finalize-then-render | Candidate | 6/10 | Review workflow efficiency |

### Top 5 Nice-to-Have

| # | Issue | Persona | Score | Value |
|---|-------|---------|-------|-------|
| 1 | **Keyword matching with stemming** -- exact match misses morphological variants | Recruitment | 6/10 | More accurate coverage reporting |
| 2 | **Match threshold to skip generation** -- save time and cost on low-match jobs | Candidate | 6/10 | Reduces review burden |
| 3 | **Generation queue visibility** -- see and prioritise pending jobs | Candidate | 6/10 | Better candidate control |
| 4 | **Agency tailoring intensity** -- broader CVs for agency-sourced roles | Recruitment | 5/10 | Adapts to different recruitment channels |
| 5 | **API latency and cost alerting** -- proactive monitoring of trends | Technical | 7/10 | Operational resilience |

### Overall Assessment (v3)

The v3 PRD has matured substantially from its v1 origins. The two fix cycles addressed 20 identified issues plus additional corrections, transforming the document from a generation-pipeline-only specification (v1) into a more complete system specification with review interface, feedback loops, audit trails, backup strategy, incident response, and operational monitoring.

**Strengths at v3:**
- The core AI pipeline (4-stage with cross-model QA) is well-designed and production-plausible
- The master profile schema is thorough, with thoughtful details like CIPD equivalency handling, pre-written variants, and tagged highlights
- The database schema is well-structured with appropriate indexes, views, and version tracking
- The QA pipeline now includes both programmatic and LLM-based validation, with ATS parse checking
- The review interface design, while requiring implementation refinements, provides a viable single-user UX
- The backup strategy and incident response plan add production-readiness
- Cost estimates are detailed and realistic

**Weaknesses remaining at v3:**
- Two P0 issues (PII stripping bug, auth token exposure) must be fixed before any production deployment
- The n8n webhook routing design needs architectural validation against n8n's actual capabilities
- The system assumes all applications are CV+cover letter submissions, missing the form-based application pathway
- Prompt quality concerns from v1 (the Dr Sarah Mitchell persona, no style training from the candidate's actual writing) have been consistently deprioritised in favour of structural fixes
- The feedback-to-improvement loop collects and analyses data but lacks the final step of translating analysis into action
- Several specification inconsistencies remain between inline code, section definitions, and the appendix migration script

**To reach 7/10 (production-ready with acceptable limitations), the PRD needs:**
1. Fix the PII stripping schema path bug (trivial code fix, critical impact)
2. Redesign the download auth mechanism to avoid exposing secrets client-side
3. Validate the webhook routing design against n8n's actual capabilities and document the implementation approach
4. Add advisory locking or atomic claim mechanism to prevent concurrent WF8 race conditions
5. Synchronize the appendix migration script with all v3 schema additions

**To reach 8/10 (robust production system), additionally:**
6. Address the Dr Sarah Mitchell persona and add candidate voice training
7. Add A/B testing capability for prompt improvements
8. Handle form-based application formats
9. Add generation suppression/hold for roles already in progress
10. Implement a proper session-based auth flow for the review interface

The system is at the point where the remaining issues are tractable engineering tasks, not fundamental design flaws. The architecture is sound. The gap between the current 5.88/10 and a production-ready 7/10 is approximately 2-3 days of focused specification fixes, with the P0 bugs taking less than an hour each.
