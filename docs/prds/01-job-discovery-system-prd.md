# Module 1: Job Discovery System -- Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-29
**Author:** Selvi Job App Engineering
**Status:** Draft
**System:** Selvi Job App
**Module:** 01 -- Job Discovery

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Data Source Integration](#6-data-source-integration)
7. [Job Scoring & Relevance Engine](#7-job-scoring--relevance-engine)
8. [Deduplication Strategy](#8-deduplication-strategy)
9. [Notification System](#9-notification-system)
10. [Database Schema](#10-database-schema)
11. [n8n Workflow Specifications](#11-n8n-workflow-specifications)
12. [Search Query Configuration](#12-search-query-configuration)
13. [Error Handling & Monitoring](#13-error-handling--monitoring)
14. [Privacy & Compliance](#14-privacy--compliance)
15. [Rollout Plan](#15-rollout-plan)
16. [50-Round Critical Roleplay Evaluation](#16-50-round-critical-roleplay-evaluation)

---

## 1. Executive Summary

The Job Discovery System is the foundational module of the Selvi Job App, an automated job application pipeline built on n8n, AI/LLM scoring, and Firecrawl. Its purpose is to continuously discover, normalize, score, deduplicate, and surface relevant job opportunities across the UK market for a specific candidate profile: a PhD + MBA professional with 18 years of HR/L&D experience seeking corporate Learning & Development roles (Manager to Head level, GBP 70-80k) and university Lecturer/Senior Lecturer positions within commuting distance of Maidenhead, Berkshire.

The system aggregates jobs from 15+ sources -- structured APIs (Adzuna, Reed, Jooble), RSS feeds (jobs.ac.uk, Guardian Jobs, CV-Library, Civil Service Jobs), email alert parsing (LinkedIn, Indeed, TotalJobs), targeted web scraping via Firecrawl (CIPD, TrainingZone, Personnel Today), and Google Jobs via SerpAPI. Each discovered job passes through an AI-powered relevance scoring engine that evaluates title match, salary fit, location accessibility, skills alignment, and seniority appropriateness, producing a tiered score (A/B/C/D) that drives notification priority.

The candidate already achieves a 90% callback rate on roles she applies to. The bottleneck is not credentials or interview performance -- it is discovering enough relevant roles fast enough. This system exists to solve the volume and access problem, turning what is currently a manual, time-consuming, inconsistent process into a reliable pipeline that surfaces every relevant opportunity within hours of posting.

The system is deployed on existing infrastructure at deploy.apiloom.io (Hetzner CAX31, 8 vCPU ARM, 16GB RAM) running Dokploy, with n8n self-hosted at n8n.deploy.apiloom.io. Postgres serves as the data store. Total incremental cost is under GBP 60/month (primarily SerpAPI).

---

## 2. Problem Statement

### 2.1 The Volume Problem

The UK L&D and academic job market is fragmented across dozens of platforms, job boards, aggregators, and individual employer career pages. No single source captures more than 60-70% of available roles. A manual job search requires checking 10-15 sites daily, each with different search interfaces, different categorization schemes, and different alert mechanisms. This is a 2-3 hour daily commitment that produces inconsistent results.

For a candidate who is new to the UK market (3 years, previously contracting/consulting), the problem is compounded. She does not yet have the network that surfaces unadvertised roles, and she is competing against candidates with decades of UK-specific career history and established professional networks. Every missed listing is a missed opportunity.

### 2.2 The Hidden Market Problem

Estimates suggest 40-70% of UK professional roles are filled through the "hidden market" -- referrals, internal promotions, headhunter placements, and roles that appear briefly on one platform before being filled. The standard approach of checking Indeed and LinkedIn once a day misses:

- Roles posted on niche boards (CIPD People Management Jobs, TrainingZone, Personnel Today) that never make it to aggregators
- University positions posted only on jobs.ac.uk or individual university career pages
- Roles that appear on one aggregator but not others due to different scraping schedules
- Positions posted late Friday and filled by Monday morning
- LinkedIn "Easy Apply" roles that fill within 48 hours

### 2.3 The Time Problem

Manual job searching is not just slow -- it is cognitively expensive. Each search session requires:

1. Remembering which sites to check
2. Remembering which search terms to use on each site
3. Mentally filtering out irrelevant results (a search for "Learning Manager" returns warehouse learning, e-learning platform roles, and L&D roles indiscriminately)
4. Mentally deduplicating across sources (the same role from different agencies on different boards)
5. Tracking which roles have already been seen
6. Evaluating salary, location, seniority, and fit for each new result

This cognitive overhead is the real cost. It drains energy that should go toward applications and interview preparation.

### 2.4 The Timing Problem

In a competitive market, speed matters. A role posted Monday morning that is not seen until Wednesday evening means applying after 200+ other candidates. Email alerts from job boards arrive on their own schedule -- often batched daily or weekly, with unpredictable delays. By the time a weekly Indeed digest arrives, the most competitive roles may already be in final interview stages.

### 2.5 The Specificity Problem

The candidate's profile is unusually specific: she fits both corporate L&D leadership roles AND academic teaching positions. These two markets use different terminology, different job boards, different salary structures, and different hiring timelines. No existing job board or alert system is designed to serve someone who straddles both markets simultaneously.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Discover all relevant roles within commuting distance | 95%+ coverage of advertised roles | Manual audit against direct board checks, weekly |
| Surface new roles within 4 hours of posting | Median time-to-discovery < 4 hours | Compare discovery timestamp to posting timestamp |
| Minimize false positives | < 20% of A-tier and B-tier jobs rated irrelevant by candidate | Weekly feedback loop |
| Minimize false negatives | < 5% of relevant roles missed entirely | Weekly manual spot-check against direct board searches |
| Reduce manual search time | From ~2-3 hours/day to < 15 minutes/day | Self-reported time tracking |

### 3.2 Secondary Goals

| Goal | Target | Measurement |
|------|--------|-------------|
| Maintain source health | 90%+ uptime across all sources | Health check workflow, daily |
| Keep data fresh | No job older than 30 days in active pipeline | TTL enforcement, daily cleanup |
| Cross-source deduplication | < 5% duplicate entries in scored output | Dedup metrics from cleanup workflow |
| System cost | < GBP 60/month total operational cost | Monthly infrastructure review |

### 3.3 Success Metrics (Weekly Dashboard)

- **Total jobs discovered** (target: 80-150/week across all sources)
- **A-tier jobs** (target: 5-15/week -- these are strong matches worth immediate application)
- **B-tier jobs** (target: 15-30/week -- worth reviewing, may need customization)
- **C-tier jobs** (target: 20-50/week -- tangential, review if time permits)
- **D-tier jobs** (filtered out, not surfaced -- tracked for tuning)
- **Deduplication rate** (percentage of raw discoveries that were duplicates)
- **Source contribution** (which sources are finding unique roles)
- **Time-to-discovery** (median hours from posting to system detection)
- **Candidate feedback score** (weekly rating of A/B-tier quality, 1-5 scale)

---

## 4. User Stories

### 4.1 Core Discovery Stories

**US-001: Morning Briefing**
As Selvi, I want to receive a morning email at 7:30 AM with all new relevant jobs discovered in the last 24 hours, organized by tier (A first, then B), so I can plan my application time for the day without visiting any job boards.

**US-002: Instant A-Tier Alert**
As Selvi, I want to receive an immediate notification (email or push) when an A-tier job is discovered, because these high-match roles fill quickly and I want to apply within hours.

**US-003: Academic Job Coverage**
As Selvi, I want the system to monitor jobs.ac.uk and individual university career pages for Lecturer and Senior Lecturer positions in HRM, OB, Management, and related subjects, because academic hiring follows different channels than corporate.

**US-004: Corporate L&D Coverage**
As Selvi, I want the system to monitor all major UK job boards and aggregators for L&D Manager, Head of L&D, Talent Development, and similar corporate roles at the right seniority and salary level.

**US-005: Location Filtering**
As Selvi, I want only jobs within a 1-hour train commute of Maidenhead to be surfaced, which includes Reading, Slough, Windsor, Bracknell, High Wycombe, Oxford, and all London zones, because I cannot relocate.

**US-006: Salary Filtering**
As Selvi, I want jobs outside the GBP 55,000-90,000 range to be deprioritized (not excluded -- some roles do not list salary), so I focus on financially viable positions.

### 4.2 System Management Stories

**US-007: Search Tuning**
As Selvi, I want to be able to add or remove search terms, locations, and sources without editing code, so the system adapts as I refine my search.

**US-008: Feedback Loop**
As Selvi, I want to mark jobs as "relevant" or "not relevant" so the scoring engine can learn and improve over time.

**US-009: Source Health Visibility**
As Selvi, I want to know if a data source stops working, so I can either fix it or compensate with manual checks.

**US-010: Weekly Summary**
As Selvi, I want a weekly summary email showing total jobs discovered, application pipeline status, and source health, so I can track progress and identify gaps.

### 4.3 Edge Case Stories

**US-011: Agency Duplicates**
As Selvi, I want the system to recognize when multiple recruitment agencies are advertising the same underlying role (different job titles, same company, same location) and consolidate them into a single entry.

**US-012: Reposted Jobs**
As Selvi, I want the system to detect when a previously seen job is reposted (possibly with a new listing ID) and flag it as a repost rather than treating it as new.

**US-013: Part-Time and Contract Roles**
As Selvi, I want part-time, fractional, and fixed-term contract roles to be included but clearly labeled, as I may consider these depending on terms.

**US-014: Remote/Hybrid Detection**
As Selvi, I want the system to identify and label remote, hybrid, and office-based working patterns, because a fully remote role expands my geographic range while a 5-days-office role in central London is less attractive.

**US-015: Visa Sponsorship Detection**
As Selvi, I do not need visa sponsorship. I want the system to note when a role explicitly requires sponsorship eligibility or explicitly offers it, as this affects relevance scoring (roles requiring sponsorship are still fine for me; roles stating "no sponsorship available" are irrelevant information since I do not need it).

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
                     | Email Digest    |          | Instant Alert   |
                     | (7:30 AM daily) |          | (A-tier only)   |
                     +--------+--------+          +--------+--------+
                              |                             |
                     +--------v-----------------------------v--------+
                     |           Notification Dispatcher             |
                     |           (n8n Workflow 7)                    |
                     +-------------------+---------------------------+
                                         |
                     +-------------------v---------------------------+
                     |              Postgres Database                |
                     |  jobs | job_sources | job_scores | configs    |
                     +---+-------+-------+-------+-------+----------+
                         ^       ^       ^       ^       ^
                         |       |       |       |       |
              +----------+--+ +--+------++  +----+---+ +-+----------+
              | Dedup &     | | AI       |  | Email  | | Firecrawl  |
              | Cleanup     | | Scoring  |  | Parser | | Scraper    |
              | Workflow 6  | | Pipeline |  | WF 3   | | WF 4       |
              +-------------+ | WF 5     |  +----+---+ +--+---------+
                              +--+-------+       |        |
                                 ^               |        |
                     +-----------+---------------+--------+---------+
                     |                                              |
              +------+------+                              +--------+-------+
              | RSS Poller  |                              | API Poller     |
              | Workflow 1  |                              | Workflow 2     |
              +------+------+                              +--------+-------+
                     |                                              |
         +-----------+-----------+                    +-------------+----------+
         |     |     |     |     |                    |       |       |        |
       jobs  Guard  CV-   Civil  Uni               Adzuna  Reed   Jooble  SerpAPI
       .ac.uk ian   Lib   Svc   RSS                API     API    API    (Phase4)
```

### 5.2 Workflow Architecture

The system is composed of 7 independent n8n workflows that communicate through the shared Postgres database. This is a deliberate design choice -- a monolithic workflow would be fragile, hard to debug, and impossible to scale or schedule independently.

| Workflow | Trigger | Schedule | Purpose |
|----------|---------|----------|---------|
| WF1: RSS Source Poller | Cron | Every 2 hours, 6AM-10PM | Poll RSS feeds for new jobs |
| WF2: API Source Poller | Cron | Every 3 hours, 6AM-10PM | Query APIs for new jobs |
| WF3: Email Alert Parser | Cron | Every 30 minutes | Parse IMAP inbox for job alert emails |
| WF4: Firecrawl Scraper | Cron | Every 6 hours | Scrape niche sites via Firecrawl |
| WF5: AI Scoring Pipeline | Cron + Webhook | Every hour + on-demand | Score unscored jobs using LLM |
| WF6: Dedup & Cleanup | Cron | Every 4 hours | Deduplicate and expire old entries |
| WF7: Notification Dispatcher | Cron + Event | 7:30 AM daily + A-tier trigger | Send digest emails and instant alerts |

### 5.3 Data Flow

```
Source -> Fetch/Parse -> Normalize -> Insert (raw) -> Score (AI) -> Deduplicate -> Notify
```

**Step 1: Fetch/Parse**
Each source workflow (WF1-WF4) fetches raw data from its assigned sources using the appropriate method (HTTP Request, RSS Read, IMAP, Firecrawl API).

**Step 2: Normalize**
Raw data from different sources arrives in different formats. Each source workflow normalizes the data into a common schema before inserting into Postgres. Normalization includes:
- Extracting title, company, location, salary, description, URL, posting date
- Standardizing location names (e.g., "London, Greater London" -> "London")
- Parsing salary ranges from text (e.g., "GBP 70,000 - GBP 80,000 per annum")
- Generating a dedup hash (lowercase title + company + location)
- Tagging the source and capture timestamp

**Step 3: Insert (Raw)**
Normalized jobs are inserted into the `jobs` table with `status = 'raw'` and `scored = false`. Source metadata goes into `job_sources`.

**Step 4: Score (AI)**
WF5 picks up unscored jobs and sends them to an LLM (Claude) for relevance scoring. The LLM evaluates title match, salary fit, location, seniority, and skills alignment, returning a structured score object. Results are stored in `job_scores` and the job's `tier` field is updated.

**Step 5: Deduplicate**
WF6 runs periodically to merge duplicate entries discovered across sources. It uses both exact hash matching and fuzzy matching (Levenshtein distance on title + company). Duplicates are soft-deleted with a reference to the surviving entry.

**Step 6: Notify**
WF7 assembles the daily digest from A-tier and B-tier jobs discovered since the last digest. A-tier jobs also trigger an immediate email when first scored.

### 5.4 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Workflow Engine | n8n (self-hosted) | At n8n.deploy.apiloom.io |
| Database | PostgreSQL 16 | Via Dokploy on Hetzner |
| AI/LLM | Claude 3.5 Sonnet (via API) | For scoring; fallback to GPT-4o |
| Web Scraping | Firecrawl API | For niche sites without APIs/RSS |
| Email Parsing | IMAP (native n8n node) | For LinkedIn/Indeed/TotalJobs alerts |
| Search API | SerpAPI (Phase 4) | Google Jobs aggregation |
| Hosting | Dokploy on Hetzner CAX31 | 8 vCPU ARM, 16GB RAM |
| Email Sending | SMTP (existing) or Resend API | For notifications |
| Monitoring | n8n execution logs + custom health workflow | |

### 5.5 Infrastructure Diagram

```
+-------------------------------------------+
|  Hetzner CAX31 (8 vCPU ARM, 16GB RAM)    |
|  deploy.apiloom.io                         |
|                                            |
|  +------------------+  +----------------+ |
|  | Dokploy          |  | Postgres 16    | |
|  |                  |  |                | |
|  |  +-------------+ |  | selvi_jobs DB  | |
|  |  | n8n         | |  |                | |
|  |  | (workflows) |<-->|                | |
|  |  +-------------+ |  +----------------+ |
|  +------------------+                      |
+-------------------------------------------+
         |              |              |
    Outbound API    IMAP Connect   Firecrawl API
    (Adzuna,Reed,   (Gmail/Outlook) (Niche sites)
     Jooble,SerpAPI)
```

---

## 6. Data Source Integration

### 6.1 Adzuna API

**Overview:** Adzuna is the largest UK job aggregator, powering the UK government's "Find a Job" service. It aggregates from thousands of job boards, company career sites, and recruitment agencies. Covers approximately 80% of advertised UK roles.

**API Endpoint:**
```
https://api.adzuna.com/v1/api/jobs/gb/search/{page}
```

**Authentication:**
- API Key + App ID (free tier)
- Register at https://developer.adzuna.com/
- Credentials passed as query parameters: `app_id` and `app_key`

**Rate Limits:**
- Free tier: 250 requests per day (confirmed as of 2026)
- Each request returns up to 50 results
- Budget: 250 requests/day = 12,500 results/day (more than sufficient)

**Scheduling:**
- Poll every 3 hours during active hours (6AM-10PM): 6 polls/day
- Each poll runs all configured search queries
- Estimated 15-25 queries per poll = ~150 requests/day (within limit)

**Request Format:**
```
GET https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id={APP_ID}&app_key={APP_KEY}&results_per_page=50&what=learning+development+manager&where=maidenhead&distance=25&salary_min=55000&salary_max=90000&sort_by=date&max_days_old=3
```

**Key Parameters:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| `what` | Search term | One per request |
| `where` | Location | e.g., "maidenhead", "reading", "london" |
| `distance` | 25 | Radius in km from `where` |
| `salary_min` | 55000 | Lower bound (slightly below target for flexibility) |
| `salary_max` | 90000 | Upper bound (slightly above target) |
| `sort_by` | date | Most recent first |
| `max_days_old` | 3 | Only jobs posted in last 3 days |
| `results_per_page` | 50 | Maximum allowed |
| `category` | `hr-jobs` or `teaching-jobs` | Adzuna category tag |

**Response Format (JSON):**
```json
{
  "results": [
    {
      "id": "4123456789",
      "title": "Learning & Development Manager",
      "description": "We are looking for an experienced L&D Manager...",
      "redirect_url": "https://www.adzuna.co.uk/jobs/details/4123456789",
      "created": "2026-03-28T10:30:00Z",
      "company": {
        "display_name": "Acme Corp"
      },
      "location": {
        "display_name": "Reading, Berkshire",
        "area": ["UK", "South East England", "Berkshire", "Reading"]
      },
      "salary_min": 70000,
      "salary_max": 80000,
      "salary_is_predicted": "0",
      "contract_type": "permanent",
      "contract_time": "full_time",
      "category": {
        "label": "HR & Recruitment Jobs",
        "tag": "hr-jobs"
      }
    }
  ],
  "count": 47,
  "mean": 72500
}
```

**Field Mapping to Normalized Schema:**

| Adzuna Field | Normalized Field | Transform |
|--------------|-----------------|-----------|
| `id` | `source_id` | String |
| `title` | `title` | Trim whitespace |
| `description` | `description` | First 5000 chars |
| `redirect_url` | `url` | Direct |
| `created` | `posted_at` | Parse ISO 8601 |
| `company.display_name` | `company` | Trim |
| `location.display_name` | `location` | Standardize |
| `salary_min` | `salary_min` | Integer |
| `salary_max` | `salary_max` | Integer |
| `salary_is_predicted` | `salary_is_predicted` | Boolean |
| `contract_type` | `contract_type` | Enum map |
| `contract_time` | `work_type` | Enum map |
| `category.label` | `category` | Direct |

**Error Handling:**
- 401: Invalid credentials -> alert admin, pause source
- 429: Rate limit exceeded -> back off 1 hour, adjust schedule
- 500/502/503: Server error -> retry 3x with exponential backoff (30s, 60s, 120s)
- Empty results: Log but do not alert (may be genuinely no new jobs)
- Timeout (>30s): Retry once, then skip and log

**n8n Node Configuration:**
```
Node: HTTP Request
Method: GET
URL: https://api.adzuna.com/v1/api/jobs/gb/search/1
Authentication: None (credentials in query params)
Query Parameters:
  - app_id: {{ $credentials.adzunaAppId }}
  - app_key: {{ $credentials.adzunaApiKey }}
  - what: {{ $json.searchTerm }}
  - where: {{ $json.location }}
  - distance: 25
  - salary_min: 55000
  - salary_max: 90000
  - sort_by: date
  - max_days_old: 3
  - results_per_page: 50
Response Format: JSON
Timeout: 30000ms
Retry on Fail: true
Max Retries: 3
Wait Between Retries: 30000ms
```

---

### 6.2 Reed API

**Overview:** Reed.co.uk is one of the UK's largest independent job boards with approximately 200,000 live roles at any time. Their API provides structured, well-documented JSON responses. Particularly strong for corporate/professional roles.

**API Endpoint:**
```
https://www.reed.co.uk/api/1.0/search
```

**Authentication:**
- HTTP Basic Authentication
- API key used as username, password left blank
- Register at https://www.reed.co.uk/developers/jobseeker
- Header: `Authorization: Basic base64(API_KEY:)`

**Rate Limits:**
- Free tier: 1,000 requests per day
- Generous limit; no throttling concerns

**Scheduling:**
- Poll every 3 hours during active hours (6AM-10PM): 6 polls/day
- ~25 queries per poll = ~150 requests/day (well within limit)

**Request Format:**
```
GET https://www.reed.co.uk/api/1.0/search?keywords=learning%20development%20manager&locationName=maidenhead&distancefromlocation=25&minimumSalary=55000&maximumSalary=90000&resultsToTake=100&resultsToSkip=0
```

**Key Parameters:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| `keywords` | Search term | Space-separated |
| `locationName` | Location | UK place name |
| `distancefromlocation` | 25 | Miles from location |
| `minimumSalary` | 55000 | Annual salary |
| `maximumSalary` | 90000 | Annual salary |
| `resultsToTake` | 100 | Max per request |
| `resultsToSkip` | 0 | Pagination offset |
| `postedByRecruitmentAgency` | (omit) | Include both direct and agency |
| `permanent` | true | For permanent role queries |

**Response Format (JSON):**
```json
{
  "results": [
    {
      "jobId": 56789012,
      "employerName": "Acme Corporation",
      "employerId": 12345,
      "jobTitle": "L&D Business Partner",
      "locationName": "Reading",
      "minimumSalary": 70000.00,
      "maximumSalary": 80000.00,
      "currency": "GBP",
      "expirationDate": "2026-04-28T00:00:00",
      "date": "2026-03-28T10:00:00",
      "jobDescription": "An exciting opportunity for...",
      "applications": 12,
      "jobUrl": "https://www.reed.co.uk/jobs/l-d-business-partner/56789012"
    }
  ],
  "totalResults": 23,
  "ambiguousLocations": []
}
```

**Field Mapping:**

| Reed Field | Normalized Field | Transform |
|------------|-----------------|-----------|
| `jobId` | `source_id` | String |
| `jobTitle` | `title` | Trim |
| `jobDescription` | `description` | First 5000 chars |
| `jobUrl` | `url` | Direct |
| `date` | `posted_at` | Parse ISO 8601 |
| `employerName` | `company` | Trim |
| `locationName` | `location` | Standardize |
| `minimumSalary` | `salary_min` | Integer |
| `maximumSalary` | `salary_max` | Integer |
| `currency` | `salary_currency` | Default GBP |
| `expirationDate` | `expires_at` | Parse ISO 8601 |
| `applications` | `application_count` | Integer (useful signal) |

**Error Handling:**
- 401: Invalid API key -> alert admin
- 429: Rate limited -> wait 1 hour
- 500+: Retry 3x exponential backoff
- `ambiguousLocations` non-empty: log warning, results may be for wrong location

**n8n Node Configuration:**
```
Node: HTTP Request
Method: GET
URL: https://www.reed.co.uk/api/1.0/search
Authentication: HTTP Basic Auth
  Username: {{ $credentials.reedApiKey }}
  Password: (empty)
Query Parameters:
  - keywords: {{ $json.searchTerm }}
  - locationName: {{ $json.location }}
  - distancefromlocation: 25
  - minimumSalary: 55000
  - maximumSalary: 90000
  - resultsToTake: 100
Response Format: JSON
Timeout: 30000ms
Retry on Fail: true
```

---

### 6.3 Jooble API

**Overview:** Jooble is a global job aggregator covering 70+ countries. Its UK coverage is good for catching jobs that slip through Adzuna and Reed. Free API access with no published rate limits.

**API Endpoint:**
```
POST https://jooble.org/api/{API_KEY}
```

**Authentication:**
- API key embedded in URL path
- Register at https://jooble.org/api/about
- No additional headers needed

**Rate Limits:**
- No documented rate limit for free tier
- Conservative approach: limit to 500 requests/day

**Scheduling:**
- Poll every 3 hours: 6 polls/day
- ~25 queries per poll = ~150 requests/day

**Request Format:**
```json
POST https://jooble.org/api/{API_KEY}
Content-Type: application/json

{
  "keywords": "Learning Development Manager",
  "location": "Maidenhead",
  "radius": "25",
  "salary": "70000",
  "page": "1"
}
```

**Key Parameters:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| `keywords` | Search term | String |
| `location` | Location | City name |
| `radius` | 25 | Miles |
| `salary` | 70000 | Approximate target |
| `page` | 1+ | Pagination |

**Response Format (JSON):**
```json
{
  "totalCount": 15,
  "jobs": [
    {
      "title": "Head of Learning & Development",
      "location": "Slough, Berkshire",
      "snippet": "Leading the L&D function for a FTSE 250...",
      "salary": "GBP 75,000 - GBP 85,000",
      "source": "Reed",
      "type": "Permanent",
      "link": "https://jooble.org/desc/...",
      "company": "Major Financial Services",
      "updated": "2026-03-28T08:00:00.0000000",
      "id": "987654321"
    }
  ]
}
```

**Field Mapping:**

| Jooble Field | Normalized Field | Transform |
|--------------|-----------------|-----------|
| `id` | `source_id` | String |
| `title` | `title` | Trim |
| `snippet` | `description` | May be truncated; append "[via Jooble]" |
| `link` | `url` | Direct |
| `updated` | `posted_at` | Parse ISO 8601 |
| `company` | `company` | Trim |
| `location` | `location` | Standardize |
| `salary` | `salary_raw` | Parse with regex: `/GBP\s*([\d,]+)\s*-\s*GBP\s*([\d,]+)/` |
| `type` | `contract_type` | Map: "Permanent" -> "permanent" etc. |

**Error Handling:**
- Non-200 response: Retry 3x
- Empty jobs array: Normal, log and continue
- Malformed salary: Store raw, flag for manual parsing

**n8n Node Configuration:**
```
Node: HTTP Request
Method: POST
URL: https://jooble.org/api/{{ $credentials.joobleApiKey }}
Headers:
  Content-Type: application/json
Body (JSON):
  {
    "keywords": "{{ $json.searchTerm }}",
    "location": "{{ $json.location }}",
    "radius": "25",
    "salary": "70000",
    "page": "1"
  }
Timeout: 30000ms
Retry on Fail: true
```

---

### 6.4 jobs.ac.uk RSS Feed

**Overview:** jobs.ac.uk is THE primary source for UK academic positions. All UK universities post here. This is a critical source for the Lecturer/Senior Lecturer track. The site provides category-specific RSS feeds that can be filtered by subject area.

**RSS Feed URLs:**

```
# HRM / Management / Business subject feeds
https://www.jobs.ac.uk/rss/lecturer/management.xml
https://www.jobs.ac.uk/rss/lecturer/human-resource-management.xml
https://www.jobs.ac.uk/rss/lecturer/business-and-management-studies.xml
https://www.jobs.ac.uk/rss/lecturer/education.xml
https://www.jobs.ac.uk/rss/lecturer/organisational-studies.xml

# Senior Lecturer feeds
https://www.jobs.ac.uk/rss/senior-lecturer/management.xml
https://www.jobs.ac.uk/rss/senior-lecturer/human-resource-management.xml
https://www.jobs.ac.uk/rss/senior-lecturer/business-and-management-studies.xml

# Teaching Fellow feeds
https://www.jobs.ac.uk/rss/teaching-fellow/management.xml
https://www.jobs.ac.uk/rss/teaching-fellow/business-and-management-studies.xml

# General academic search (broader net)
https://www.jobs.ac.uk/rss/search/?keywords=learning+development&location=south+east+england
https://www.jobs.ac.uk/rss/search/?keywords=HRM+lecturer&location=
https://www.jobs.ac.uk/rss/search/?keywords=organisational+behaviour&location=
```

**Authentication:** None (public RSS)

**Rate Limits:** No documented rate limits. RSS feeds are cached server-side and update every ~30 minutes.

**Scheduling:** Every 2 hours, 6AM-10PM (matches RSS cache refresh cycle)

**RSS Item Format:**
```xml
<item>
  <title>Lecturer in Human Resource Management</title>
  <link>https://www.jobs.ac.uk/job/DFG456/lecturer-in-hrm</link>
  <description>The Business School is seeking a Lecturer in HRM to join our growing team. The successful candidate will teach on undergraduate and postgraduate programmes...</description>
  <pubDate>Thu, 28 Mar 2026 09:00:00 GMT</pubDate>
  <category>Lecturer</category>
  <dc:employer>University of Reading</dc:employer>
  <dc:location>Reading, United Kingdom</dc:location>
  <dc:salary>GBP 43,000 - GBP 56,000 per annum</dc:salary>
  <dc:closingDate>2026-04-25</dc:closingDate>
</item>
```

**Field Mapping:**

| RSS Field | Normalized Field | Transform |
|-----------|-----------------|-----------|
| `<link>` (GUID) | `source_id` | Extract slug from URL |
| `<title>` | `title` | Trim |
| `<description>` | `description` | Strip HTML tags |
| `<link>` | `url` | Direct |
| `<pubDate>` | `posted_at` | Parse RFC 2822 |
| `<dc:employer>` | `company` | Trim |
| `<dc:location>` | `location` | Standardize |
| `<dc:salary>` | `salary_raw` | Parse with regex |
| `<dc:closingDate>` | `expires_at` | Parse YYYY-MM-DD |
| `<category>` | `job_level` | Map to seniority |

**Special Considerations:**
- Academic salaries use different scales. Lecturer typically GBP 38,000-56,000 (Grade 7-8). Senior Lecturer GBP 50,000-65,000 (Grade 8-9). These are below the GBP 70-80k corporate target but are expected and correct for academic roles.
- The scoring engine must use a separate salary expectation for academic vs. corporate roles.
- Some jobs.ac.uk listings are for non-UK positions. Filter by location containing "England", "UK", or specific city names.
- The `dc:` namespace fields may not be present in all feeds. Fall back to parsing the description text.

**n8n Node Configuration:**
```
Node: RSS Feed Read
URL: (configured per feed -- see list above)
Output: JSON items

Follow with:
Node: Function (JavaScript)
Purpose: Parse dc: namespace fields, normalize, filter UK-only
Code:
  items.filter(item => {
    const loc = (item.json['dc:location'] || item.json.description || '').toLowerCase();
    return loc.includes('england') || loc.includes('uk') || loc.includes('united kingdom')
      || loc.includes('reading') || loc.includes('london') || loc.includes('berkshire')
      || loc.includes('oxford') || loc.includes('high wycombe') || loc.includes('slough');
  }).map(item => ({
    title: item.json.title,
    description: item.json.description?.replace(/<[^>]*>/g, '').substring(0, 5000),
    url: item.json.link,
    posted_at: new Date(item.json.pubDate).toISOString(),
    company: item.json['dc:employer'] || 'Unknown University',
    location: item.json['dc:location'] || 'UK',
    salary_raw: item.json['dc:salary'] || null,
    expires_at: item.json['dc:closingDate'] || null,
    source: 'jobs_ac_uk',
    job_type: 'academic'
  }));
```

---

### 6.5 Guardian Jobs RSS Feed

**Overview:** The Guardian's job board covers professional and public sector roles. Strong for HR, education, and non-profit L&D positions.

**RSS Feed URLs:**
```
# HR & Personnel category
https://jobs.theguardian.com/jobs/human-resources/rss/

# Education category
https://jobs.theguardian.com/jobs/education/rss/

# Training & Development subcategory
https://jobs.theguardian.com/jobs/training-and-development/rss/

# Management category
https://jobs.theguardian.com/jobs/management/rss/

# Keyword-based feeds
https://jobs.theguardian.com/jobs/rss/?keywords=learning+development&location=south+east+england
https://jobs.theguardian.com/jobs/rss/?keywords=L%26D+manager
```

**Authentication:** None (public RSS)

**Rate Limits:** None documented. Standard RSS etiquette applies.

**Scheduling:** Every 2 hours with RSS Poller (WF1)

**RSS Item Format:**
```xml
<item>
  <title>Learning and Development Business Partner - London</title>
  <link>https://jobs.theguardian.com/job/12345678/</link>
  <description>A leading NHS Trust seeks an experienced L&amp;D professional...</description>
  <pubDate>Wed, 27 Mar 2026 12:00:00 GMT</pubDate>
  <guid>https://jobs.theguardian.com/job/12345678/</guid>
</item>
```

**Field Mapping:**

| RSS Field | Normalized Field | Transform |
|-----------|-----------------|-----------|
| `<guid>` | `source_id` | Extract job ID from URL |
| `<title>` | `title` | Trim; often includes location |
| `<description>` | `description` | Strip HTML, unescape entities |
| `<link>` | `url` | Direct |
| `<pubDate>` | `posted_at` | Parse RFC 2822 |
| (from title) | `location` | Parse "- Location" suffix from title |
| (not available) | `company` | Extract from description or set "Unknown" |
| (not available) | `salary_raw` | Extract from description if present |

**Special Considerations:**
- Guardian Jobs RSS items often lack structured employer and salary fields
- Title frequently contains location (e.g., "Role Title - London")
- Company name is usually in the first line of description
- Salary is sometimes in description, sometimes absent
- Need robust description parsing in the normalize step

**n8n Node Configuration:**
```
Node: RSS Feed Read
URL: (configured per feed)

Follow with:
Node: Code (JavaScript)
Purpose: Extract company, location, salary from unstructured fields
```

---

### 6.6 CV-Library RSS Feed

**Overview:** CV-Library is a major UK-only job board with ~200,000 live vacancies. Strong coverage of recruiter-posted roles.

**RSS Feed URLs:**
```
# Category-based feeds
https://www.cv-library.co.uk/rss/jobs?q=learning+development+manager&geo=maidenhead&distance=25
https://www.cv-library.co.uk/rss/jobs?q=L%26D+manager&geo=reading&distance=25
https://www.cv-library.co.uk/rss/jobs?q=talent+development+manager&geo=london&distance=10
https://www.cv-library.co.uk/rss/jobs?q=head+of+learning+development&geo=maidenhead&distance=25
https://www.cv-library.co.uk/rss/jobs?q=OD+manager&geo=maidenhead&distance=25
```

**Authentication:** None (public RSS)

**Rate Limits:** None documented. Respect robots.txt.

**Scheduling:** Every 2 hours with RSS Poller (WF1)

**RSS Item Format:**
```xml
<item>
  <title>Learning & Development Manager</title>
  <link>https://www.cv-library.co.uk/job/213456789/</link>
  <description>Salary: GBP 70,000 - GBP 80,000. Location: Reading. Our client is seeking...</description>
  <pubDate>Thu, 28 Mar 2026 14:30:00 GMT</pubDate>
  <guid isPermaLink="true">https://www.cv-library.co.uk/job/213456789/</guid>
</item>
```

**Field Mapping:**

| RSS Field | Normalized Field | Transform |
|-----------|-----------------|-----------|
| `<guid>` | `source_id` | Extract job ID from URL |
| `<title>` | `title` | Trim |
| `<description>` | `description` | Strip HTML |
| `<link>` | `url` | Direct |
| `<pubDate>` | `posted_at` | Parse RFC 2822 |
| (from description) | `salary_raw` | Regex: `Salary:\s*(.+?)\.` |
| (from description) | `location` | Regex: `Location:\s*(.+?)\.` |
| (from description) | `company` | Often not available; parse first sentence |

**n8n Node Configuration:**
```
Node: RSS Feed Read
URL: (configured per feed)
```

---

### 6.7 Civil Service Jobs RSS Feed

**Overview:** The UK Civil Service job portal. Relevant for government L&D roles (e.g., Civil Service Learning, departmental L&D teams). Government L&D teams are often large and well-funded.

**RSS Feed URLs:**
```
# Direct RSS feeds
https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=c3RhdGU9cm91dGluZQ==&pageaction=rss&keyword=learning+development
https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=c3RhdGU9cm91dGluZQ==&pageaction=rss&keyword=talent+development
https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=c3RhdGU9cm91dGluZQ==&pageaction=rss&keyword=organisational+development
https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=c3RhdGU9cm91dGluZQ==&pageaction=rss&keyword=people+development
```

**Authentication:** None (public RSS)

**Rate Limits:** Government site -- be respectful. Max 1 request per feed per 2 hours.

**Scheduling:** Every 2 hours with RSS Poller (WF1)

**Special Considerations:**
- Civil Service uses its own grade system (HEO, SEO, Grade 7, Grade 6, SCS)
- Salary bands are fixed and published: Grade 7 = ~GBP 55,000-63,000, Grade 6 = ~GBP 67,000-78,000
- Grade 6 and above maps to the target salary range
- Many CS roles allow hybrid/remote working -- good fit
- CS roles often have longer application windows (2-4 weeks)
- Security clearance requirements should be noted but not filtered (candidate is eligible)

**n8n Node Configuration:**
```
Node: RSS Feed Read
URL: (configured per feed)

Follow with:
Node: Code (JavaScript)
Purpose: Parse Civil Service-specific fields (grade, department, clearance)
```

---

### 6.8 LinkedIn Job Alerts (Email Parsing)

**Overview:** LinkedIn is the largest professional network and a primary job discovery channel. We cannot scrape LinkedIn directly (ToS violation, aggressive bot detection), but we can parse LinkedIn job alert emails that arrive in the candidate's inbox.

**Method:** IMAP email parsing

**Setup:**
1. Create LinkedIn job alerts for all target search terms
2. Set alert frequency to "Daily" (LinkedIn does not offer real-time for all alerts)
3. Configure alerts to send to a dedicated email address (e.g., selvi.jobs@gmail.com)
4. n8n connects to this inbox via IMAP

**IMAP Configuration:**
```
Host: imap.gmail.com
Port: 993
SSL: true
User: selvi.jobs@gmail.com
Password: App-specific password (Gmail requires 2FA + app password)
Mailbox: INBOX
Search: FROM "jobs-noreply@linkedin.com" UNSEEN
```

**Email Structure:**
LinkedIn job alert emails contain:
- Subject: "N new jobs for 'Learning & Development Manager' in Reading"
- Body: HTML with job cards containing title, company, location, posted time
- Each job card links to the LinkedIn job page

**Parsing Strategy:**
```
1. Fetch unseen emails from LinkedIn
2. Parse HTML body
3. Extract job cards using CSS selectors or regex:
   - Title: <a class="job-card__title">...</a>
   - Company: <span class="job-card__company-name">...</span>
   - Location: <span class="job-card__location">...</span>
   - URL: href from the title link
   - Posted: <span class="job-card__timeago">...</span>
4. Normalize each extracted job
5. Mark email as read
```

**Field Mapping:**

| Parsed Field | Normalized Field | Transform |
|--------------|-----------------|-----------|
| Title link href | `source_id` | Extract job ID from LinkedIn URL |
| Title text | `title` | Trim |
| (not available) | `description` | Set to empty; optionally fetch from URL |
| Title link href | `url` | Full LinkedIn URL |
| Timeago text | `posted_at` | Parse relative time ("2 hours ago", "1 day ago") |
| Company text | `company` | Trim |
| Location text | `location` | Standardize |
| (not available) | `salary_raw` | LinkedIn rarely shows salary in alerts |

**Special Considerations:**
- LinkedIn changes email HTML structure periodically -- parsing may break
- Monitor for parse failures and alert admin
- LinkedIn job IDs can be used for deduplication across LinkedIn-sourced entries
- Some LinkedIn jobs are also posted on other boards -- cross-source dedup handles this
- Do NOT scrape linkedin.com directly; only parse emails

**n8n Node Configuration:**
```
Node: IMAP Email
Host: imap.gmail.com
Port: 993
User: {{ $credentials.imapUser }}
Password: {{ $credentials.imapPassword }}
Mailbox: INBOX
Search Criteria: FROM "jobs-noreply@linkedin.com" UNSEEN
Mark as Read: true

Follow with:
Node: HTML Extract
Extraction Rules:
  - CSS Selector for job title: .job-card__title
  - CSS Selector for company: .job-card__company-name
  - CSS Selector for location: .job-card__location
  - CSS Selector for link: .job-card__title a[href]
  - CSS Selector for time: .job-card__timeago
```

---

### 6.9 Indeed Job Alerts (Email Parsing)

**Overview:** Indeed is the world's largest job search engine. Like LinkedIn, direct scraping violates ToS. Email alerts provide a compliant alternative.

**Method:** IMAP email parsing

**Setup:**
1. Create Indeed job alerts at indeed.co.uk for all target search terms + locations
2. Set alert frequency to "Daily"
3. Direct alerts to selvi.jobs@gmail.com

**IMAP Configuration:**
```
Host: imap.gmail.com
Port: 993
SSL: true
Search: FROM "alert@indeed.com" UNSEEN
```

**Email Structure:**
Indeed alert emails contain job cards with:
- Job title (linked to Indeed job page)
- Company name
- Location
- Salary (when available)
- Snippet of description
- "Posted X days ago" indicator

**Parsing Strategy:**
```
1. Fetch unseen emails from Indeed
2. Parse HTML body
3. Extract job cards:
   - Title: <a data-tn-element="jobTitle">...</a> or similar
   - Company: <span class="companyName">...</span>
   - Location: <span class="companyLocation">...</span>
   - Salary: <span class="salary-snippet">...</span>
   - URL: href from title link (follow redirect to get actual Indeed URL)
   - Posted: relative time text
4. Normalize and insert
5. Mark email as read
```

**Special Considerations:**
- Indeed frequently changes email HTML structure
- Indeed alert emails often include sponsored/promoted jobs at the top -- these may be less relevant
- Indeed job URLs contain tracking parameters; normalize to base URL for dedup
- Some Indeed listings are duplicates from the same employer posted multiple times

**n8n Node Configuration:**
```
Node: IMAP Email
Search Criteria: FROM "alert@indeed.com" UNSEEN
Mark as Read: true

Follow with:
Node: HTML Extract / Code node for parsing
```

---

### 6.10 TotalJobs Job Alerts (Email Parsing)

**Overview:** TotalJobs is a major UK job board (owned by StepStone/Axel Springer). Good coverage of mid-senior professional roles.

**Method:** IMAP email parsing

**Setup:**
1. Create TotalJobs alerts for target searches
2. Direct to selvi.jobs@gmail.com

**IMAP Configuration:**
```
Search: FROM "noreply@totaljobs.com" UNSEEN
```

**Email Structure:**
Similar to Indeed -- HTML job cards with title, company, location, salary, URL.

**Parsing Strategy:** Same pattern as Indeed. Extract job cards from HTML, normalize, insert.

**n8n Node Configuration:**
```
Node: IMAP Email
Search Criteria: FROM "noreply@totaljobs.com" UNSEEN
Mark as Read: true
```

---

### 6.11 CIPD Job Board (Firecrawl)

**Overview:** The Chartered Institute of Personnel and Development (CIPD) is the professional body for HR and L&D in the UK. Their job board is highly relevant -- most roles require or prefer CIPD membership and are specifically in the HR/L&D domain.

**URL to Scrape:**
```
https://www.cipd.org/en/the-people-profession/cipd-hr-profession-map/jobs/
```

**Alternative URL (People Management magazine jobs):**
```
https://jobs.peoplemanagement.co.uk/jobs/learning-development/
https://jobs.peoplemanagement.co.uk/jobs/organisational-development/
https://jobs.peoplemanagement.co.uk/jobs/talent-management/
```

**Firecrawl Configuration:**
```json
{
  "url": "https://jobs.peoplemanagement.co.uk/jobs/learning-development/",
  "formats": ["markdown", "links"],
  "onlyMainContent": true,
  "waitFor": 3000,
  "actions": [
    {
      "type": "scroll",
      "direction": "down",
      "amount": 3
    }
  ]
}
```

**Firecrawl API Call:**
```
POST https://api.firecrawl.dev/v1/scrape
Authorization: Bearer fc-03df5ddce46244da9e5d5b926bcddb0a
Content-Type: application/json

{
  "url": "https://jobs.peoplemanagement.co.uk/jobs/learning-development/",
  "formats": ["markdown"],
  "onlyMainContent": true,
  "waitFor": 3000
}
```

**Parsing Strategy:**
- Firecrawl returns markdown-formatted content
- Parse job listings from the markdown using patterns:
  - Job title (typically a heading or bold text linked to detail page)
  - Company name
  - Location
  - Salary (if listed)
  - Posted date
- For each extracted listing URL, optionally do a second Firecrawl scrape to get full description

**Scheduling:** Every 6 hours (scraping is more resource-intensive and these sites update less frequently)

**Rate Limits (Firecrawl):**
- Firecrawl free tier: 500 credits/month
- Each scrape = 1 credit
- Budget: ~15 scrapes/day * 30 = 450/month (tight fit)
- Prioritize: CIPD/People Management > TrainingZone > Personnel Today > Individual universities

**n8n Node Configuration:**
```
Node: HTTP Request
Method: POST
URL: https://api.firecrawl.dev/v1/scrape
Headers:
  Authorization: Bearer {{ $credentials.firecrawlApiKey }}
  Content-Type: application/json
Body (JSON):
  {
    "url": "{{ $json.targetUrl }}",
    "formats": ["markdown"],
    "onlyMainContent": true,
    "waitFor": 3000
  }
Timeout: 60000ms

Follow with:
Node: Code (JavaScript)
Purpose: Parse markdown output to extract job listings
```

---

### 6.12 TrainingZone (Firecrawl)

**Overview:** TrainingZone is a UK-focused community and job board for L&D professionals. Smaller than generalist boards but highly targeted.

**URL to Scrape:**
```
https://www.trainingzone.co.uk/jobs
https://www.trainingzone.co.uk/jobs?keywords=learning+development
```

**Firecrawl Configuration:**
```json
{
  "url": "https://www.trainingzone.co.uk/jobs",
  "formats": ["markdown"],
  "onlyMainContent": true,
  "waitFor": 3000
}
```

**Scheduling:** Every 6 hours with Firecrawl Scraper (WF4)

**Parsing:** Same Firecrawl -> markdown -> extract pattern as CIPD.

---

### 6.13 Personnel Today (Firecrawl)

**Overview:** Personnel Today is a leading UK HR publication with a job board. Roles here tend to be senior and well-specified.

**URL to Scrape:**
```
https://jobs.personneltoday.com/jobs/learning-and-development/
https://jobs.personneltoday.com/jobs/organisational-development/
https://jobs.personneltoday.com/jobs/talent-management/
```

**Firecrawl Configuration:**
```json
{
  "url": "https://jobs.personneltoday.com/jobs/learning-and-development/",
  "formats": ["markdown"],
  "onlyMainContent": true,
  "waitFor": 3000
}
```

**Scheduling:** Every 6 hours with Firecrawl Scraper (WF4)

---

### 6.14 University Career Pages (Firecrawl -- Selective)

**Overview:** Some universities post positions on their own career pages before or instead of jobs.ac.uk. This is the gap-filler. Only target universities within commuting distance.

**Universities to Monitor:**

| University | Career Page URL | Priority |
|------------|----------------|----------|
| University of Reading | https://jobs.reading.ac.uk/ | High |
| Oxford Brookes University | https://www.brookes.ac.uk/about-brookes/work-for-us | High |
| University of Oxford | https://www.jobs.ox.ac.uk/ | High |
| Royal Holloway, University of London | https://jobs.royalholloway.ac.uk/ | High |
| Brunel University London | https://www.brunel.ac.uk/about/job-vacancies | Medium |
| University of West London | https://www.uwl.ac.uk/about-us/jobs | Medium |
| Buckinghamshire New University | https://www.bucks.ac.uk/about-us/jobs | Medium |
| Henley Business School | (part of Reading) | High |
| Kingston University | https://www.kingston.ac.uk/about/jobs/ | Medium |
| University of Westminster | https://www.westminster.ac.uk/about-us/our-people/jobs | Medium |
| University of Surrey | https://jobs.surrey.ac.uk/ | Medium |
| Imperial College London | https://www.imperial.ac.uk/jobs/ | Medium |
| UCL | https://www.ucl.ac.uk/work-at-ucl/ | Medium |
| King's College London | https://www.kcl.ac.uk/jobs | Medium |
| LSE | https://jobs.lse.ac.uk/ | High |

**Firecrawl Strategy:**
- Only scrape high-priority university pages
- Focus on business school / management department vacancies
- Use search/filter URLs where available to narrow results
- Scrape every 12 hours (university postings update slowly)

**Budget Consideration:**
- 15 universities * 2 scrapes/day = 30 scrapes/day = ~900/month
- Exceeds free Firecrawl tier if combined with niche boards
- Resolution: Scrape only top 5 universities daily, rotate remainder weekly
- Most academic roles appear on jobs.ac.uk within 24 hours anyway; university career pages are the gap-filler, not the primary source

**n8n Node Configuration:**
```
Node: HTTP Request (Firecrawl)
-- Loop over configured university URLs
-- Each with appropriate search parameters
-- Parse markdown for academic job listings
-- Filter for management/business/HRM keywords
```

---

### 6.15 Google Jobs via SerpAPI (Phase 4)

**Overview:** Google Jobs aggregates listings from across the web, including LinkedIn, Glassdoor, and many smaller sites. It catches postings that slip through other sources. Accessed via SerpAPI (paid service).

**API Endpoint:**
```
GET https://serpapi.com/search.json?engine=google_jobs&q=learning+development+manager&location=Maidenhead,+United+Kingdom&gl=uk&hl=en&api_key={API_KEY}
```

**Authentication:**
- SerpAPI API key (query parameter)
- Pricing: $50/month for 5,000 searches

**Rate Limits:**
- 5,000 searches/month on $50 plan
- Budget: ~160 searches/day
- Estimated need: 25 search terms * 3 locations * 2 polls/day = 150 searches/day

**Request Format:**
```
GET https://serpapi.com/search.json
  ?engine=google_jobs
  &q=learning+development+manager
  &location=Maidenhead,+United+Kingdom
  &gl=uk
  &hl=en
  &chips=date_posted:today
  &api_key={API_KEY}
```

**Key Parameters:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| `engine` | google_jobs | Required |
| `q` | Search term | Job title |
| `location` | City, UK | Location |
| `gl` | uk | Country code |
| `hl` | en | Language |
| `chips` | date_posted:today | Only today's postings |
| `start` | 0, 10, 20... | Pagination (10 results per page) |

**Response Format (JSON):**
```json
{
  "jobs_results": [
    {
      "title": "Learning & Development Manager",
      "company_name": "Acme Corp",
      "location": "Reading, UK",
      "via": "via Reed",
      "description": "Full job description text...",
      "job_highlights": [
        {
          "title": "Qualifications",
          "items": ["CIPD Level 7", "5+ years L&D experience"]
        }
      ],
      "related_links": [
        {
          "link": "https://www.reed.co.uk/jobs/...",
          "text": "Apply on Reed"
        }
      ],
      "extensions": ["3 days ago", "Full-time", "GBP 70K-GBP 80K a year"],
      "detected_extensions": {
        "posted_at": "3 days ago",
        "schedule_type": "Full-time",
        "salary": "GBP 70K-GBP 80K a year"
      },
      "job_id": "abc123def456"
    }
  ]
}
```

**Field Mapping:**

| SerpAPI Field | Normalized Field | Transform |
|---------------|-----------------|-----------|
| `job_id` | `source_id` | String |
| `title` | `title` | Trim |
| `description` | `description` | First 5000 chars |
| `related_links[0].link` | `url` | First apply link |
| `detected_extensions.posted_at` | `posted_at` | Parse relative time |
| `company_name` | `company` | Trim |
| `location` | `location` | Standardize |
| `detected_extensions.salary` | `salary_raw` | Parse with regex |
| `detected_extensions.schedule_type` | `work_type` | Map |
| `via` | `original_source` | Track where Google found it |

**Special Considerations:**
- Google Jobs often shows the same job from multiple sources (Reed, Indeed, LinkedIn)
- The `via` field tells us the original source -- useful for dedup
- The `related_links` array may have multiple apply links from different boards
- This is a gap-filler -- many jobs will already be in the database from direct API/RSS sources
- High dedup rate expected (40-60% of results may already be known)

**n8n Node Configuration:**
```
Node: HTTP Request
Method: GET
URL: https://serpapi.com/search.json
Query Parameters:
  engine: google_jobs
  q: {{ $json.searchTerm }}
  location: {{ $json.location }}, United Kingdom
  gl: uk
  hl: en
  chips: date_posted:today
  api_key: {{ $credentials.serpApiKey }}
Timeout: 30000ms
```

---

## 7. Job Scoring & Relevance Engine

### 7.1 Overview

Every discovered job passes through an AI-powered scoring pipeline that evaluates relevance across multiple dimensions. The scoring engine uses Claude 3.5 Sonnet as the primary LLM, with GPT-4o as a fallback. The engine produces a composite score (0-100) and a tier classification (A/B/C/D).

### 7.2 Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Title Match | 25% | How closely the job title matches target titles |
| Seniority Match | 20% | Whether the role level matches target (Manager to Head / Lecturer to Senior Lecturer) |
| Location Match | 15% | Whether the location is within commuting distance |
| Salary Match | 15% | Whether salary aligns with expectations (corporate vs. academic) |
| Skills Match | 15% | Whether required skills/qualifications match candidate profile |
| Industry/Sector Match | 10% | Whether the organization type and sector are appropriate |

### 7.3 Scoring Criteria Detail

#### 7.3.1 Title Match (25%)

**Score 10:** Exact match to a target title
- "Learning & Development Manager"
- "Head of L&D"
- "Lecturer in Human Resource Management"
- "Senior Lecturer in Management"

**Score 8:** Close variant of target title
- "L&D Lead" (close to L&D Manager)
- "Learning Manager" (could be L&D)
- "Teaching Fellow in HRM"

**Score 6:** Related role, likely relevant
- "People Development Consultant"
- "HR Business Partner (L&D focus)"
- "Programme Leader - Business Management"

**Score 4:** Adjacent role, possibly relevant
- "HR Manager" (with L&D in description)
- "Training Coordinator" (too junior but in domain)
- "Course Director"

**Score 2:** Tangential
- "E-Learning Developer" (technical, not strategic)
- "Sales Enablement Specialist" (wrong domain)

**Score 0:** Clearly irrelevant
- "Warehouse Learning Operative"
- "Machine Learning Engineer"
- "Learning Support Assistant" (schools)

#### 7.3.2 Seniority Match (20%)

**Corporate Roles:**
| Level | Score |
|-------|-------|
| Head / Director | 10 |
| Senior Manager | 10 |
| Manager | 10 |
| Business Partner / Lead | 9 |
| Consultant (senior) | 8 |
| Specialist / Senior | 7 |
| Consultant (not specified) | 6 |
| Coordinator / Advisor | 3 |
| Administrator / Assistant | 1 |
| Intern / Graduate | 0 |

**Academic Roles:**
| Level | Score |
|-------|-------|
| Professor of Practice | 10 |
| Associate Professor / Reader | 10 |
| Senior Lecturer | 10 |
| Lecturer | 9 |
| Senior Teaching Fellow | 9 |
| Teaching Fellow | 8 |
| Visiting Lecturer | 7 |
| Research Associate | 4 |
| Tutor / Demonstrator | 2 |
| Teaching Assistant | 1 |

#### 7.3.3 Location Match (15%)

**Score 10:** Directly accessible, <30 min commute
- Maidenhead
- Slough
- Reading
- Windsor
- Taplow / Burnham / Cookham

**Score 9:** Good commute, <45 min by train
- Bracknell
- London Paddington zone (direct GWR line)
- Twyford, Wokingham

**Score 8:** Reasonable commute, <1 hour by train
- London (most zones -- Paddington, Waterloo, Victoria easily accessible)
- High Wycombe
- Oxford
- Staines, Egham

**Score 6:** Longer commute, 1-1.5 hours
- Guildford
- Milton Keynes
- Swindon
- Cambridge

**Score 3:** Possible but stretching
- Bristol
- Southampton
- Birmingham (with occasional remote)

**Score 10 (special):** Remote / fully remote
- Any UK location if the role is genuinely remote

**Score 0:** Clearly too far, no remote option
- Manchester, Leeds, Edinburgh, etc.
- International

#### 7.3.4 Salary Match (15%)

**Corporate Roles (target: GBP 70,000-80,000):**
| Range | Score |
|-------|-------|
| GBP 70,000-85,000 | 10 |
| GBP 65,000-70,000 | 9 |
| GBP 60,000-65,000 | 8 |
| GBP 85,000-100,000 | 8 |
| GBP 55,000-60,000 | 6 |
| GBP 100,000+ | 6 |
| GBP 45,000-55,000 | 4 |
| GBP 35,000-45,000 | 2 |
| Not specified | 7 (neutral -- do not penalize) |
| < GBP 35,000 | 0 |

**Academic Roles (different expectations):**
| Range | Score |
|-------|-------|
| Grade 8-9 / GBP 48,000-65,000 (Senior Lecturer) | 10 |
| Grade 7-8 / GBP 38,000-52,000 (Lecturer) | 9 |
| Professorial / GBP 60,000+ | 10 |
| Grade 6 / GBP 33,000-38,000 | 5 |
| Not specified | 7 |
| < GBP 30,000 | 2 |

#### 7.3.5 Skills Match (15%)

The LLM evaluates whether the job description mentions skills and qualifications that match the candidate's profile:

**Strong Positive Signals (add points):**
- L&D strategy, learning strategy
- Leadership development
- Talent development, succession planning
- Organizational development (OD)
- Change management
- CIPD qualification (candidate has equivalent)
- PhD or doctorate mentioned as desirable
- MBA valued
- Consulting/advisory experience
- International / cross-cultural experience
- Digital learning / blended learning
- Coaching and mentoring
- Stakeholder management
- Needs analysis, training needs analysis

**Neutral/Positive Signals:**
- LMS administration (candidate can do this but it is tactical)
- Budget management
- Team management
- Report writing, analytics
- HRIS / HR systems

**Negative Signals (subtract points):**
- Requires specific technical certification (e.g., AWS, Salesforce)
- Requires specific industry experience the candidate lacks (e.g., "5 years in pharmaceutical manufacturing")
- Requires specific software development skills
- Entry-level language ("no experience required", "ideal for graduates")

#### 7.3.6 Industry/Sector Match (10%)

**Score 10:** Ideal sectors
- Higher education
- Professional services (consulting, legal, financial)
- Large corporate (FTSE 250+)
- NHS / public health (large L&D teams)
- Civil Service / government

**Score 8:** Good sectors
- Non-profit / charity (large ones like Oxfam, Save the Children)
- Financial services
- Technology companies (with established L&D)

**Score 6:** Acceptable sectors
- Retail (head office L&D, not store-level)
- Manufacturing (head office)
- SME with dedicated L&D function

**Score 3:** Less ideal
- Recruitment agencies (the employer, not the client)
- Very small organizations (<50 employees)

**Score 0:** Wrong sector entirely
- Military / defence (unless civilian L&D role)
- Early years / primary education

### 7.4 LLM Scoring Prompt

```
You are a UK job market specialist scoring jobs for relevance to a specific candidate.

## Candidate Profile
- PhD in Management + MBA in HR
- 18 years experience in L&D, OD, talent development, and HR consulting
- CIPD equivalent (through academic qualifications)
- International experience (India, Middle East, UK)
- 3 years in UK market, previously contracting/consulting
- No visa sponsorship needed, immediate joiner
- Location: Maidenhead, Berkshire (can commute up to 1 hour by train)
- Seeking: Corporate L&D roles (Manager to Head level, GBP 70-80k) OR university Lecturer/Senior Lecturer positions

## Target Job Titles (Corporate)
Learning & Development Manager, L&D Business Partner, Talent Development Manager, OD Manager/Specialist, People Development Manager, Head of L&D, L&D Director, Capability Development Lead, Leadership Development Manager, Enablement Manager, Learning Consultant

## Target Job Titles (Academic)
Lecturer, Senior Lecturer, Teaching Fellow, Senior Teaching Fellow, Associate Professor, Professor of Practice, Visiting Lecturer -- all in HRM, OB, Management, Business Education, L&D

## Scoring Dimensions
Score each dimension 0-10:
1. title_match (25%): How closely does the title match target roles?
2. seniority_match (20%): Is this the right level (Manager-Head for corporate, Lecturer-Professor for academic)?
3. location_match (15%): Is it within commuting distance of Maidenhead?
4. salary_match (15%): Does salary fit expectations? (Corporate: GBP 70-80k. Academic: use appropriate UK academic pay scales. If not stated, score 7.)
5. skills_match (15%): Do required skills match the candidate's profile?
6. sector_match (10%): Is the organization/industry a good fit?

## Job to Score
Title: {{title}}
Company: {{company}}
Location: {{location}}
Salary: {{salary_raw}}
Description: {{description}}
Source: {{source}}

## Instructions
1. Determine if this is a corporate or academic role
2. Score each dimension 0-10
3. Calculate weighted composite: (title*0.25 + seniority*0.20 + location*0.15 + salary*0.15 + skills*0.15 + sector*0.10) * 10
4. Assign tier: A (75-100), B (55-74), C (35-54), D (0-34)
5. Write a 1-2 sentence rationale

## Output Format (JSON only, no markdown)
{
  "job_type": "corporate" | "academic",
  "scores": {
    "title_match": <0-10>,
    "seniority_match": <0-10>,
    "location_match": <0-10>,
    "salary_match": <0-10>,
    "skills_match": <0-10>,
    "sector_match": <0-10>
  },
  "composite_score": <0-100>,
  "tier": "A" | "B" | "C" | "D",
  "rationale": "<1-2 sentences>",
  "red_flags": ["<any concerns>"],
  "green_flags": ["<any positive signals>"],
  "working_pattern": "office" | "hybrid" | "remote" | "unknown",
  "visa_sponsorship_mentioned": true | false,
  "cipd_required": true | false,
  "application_deadline": "<date if found>" | null
}
```

### 7.5 Tier Definitions

| Tier | Score Range | Action | Description |
|------|------------|--------|-------------|
| A | 75-100 | Instant notification + daily digest | Strong match. Apply immediately. |
| B | 55-74 | Daily digest only | Good match. Review and consider applying. |
| C | 35-54 | Weekly summary only | Tangential match. Review if time permits. |
| D | 0-34 | Filtered out, not surfaced | Not relevant. Archived for analytics only. |

### 7.6 Scoring Pipeline Configuration

**Batch Size:** 10 jobs per LLM call (to manage costs and latency)

**LLM Selection:**
- Primary: Claude 3.5 Sonnet (via Anthropic API)
  - Cost: ~$0.003 per job scored (estimate: 1500 input tokens + 300 output tokens per job)
  - Monthly budget at 100 jobs/day: ~$9/month
- Fallback: GPT-4o-mini (via OpenAI API) if Claude is unavailable
  - Cost: ~$0.001 per job scored

**Error Handling:**
- LLM timeout (>30s): Retry once with shorter description
- LLM returns invalid JSON: Retry once with stricter prompt
- LLM consistently fails: Fall back to rule-based scoring (keyword matching only)
- Cost safeguard: Max 200 scoring calls/day (with 10 jobs each = 2000 jobs/day max)

### 7.7 Rule-Based Fallback Scorer

When the LLM is unavailable, a deterministic rule-based scorer provides approximate scoring:

```javascript
function ruleBasedScore(job) {
  let score = 0;

  // Title match (25 points max)
  const titleLower = job.title.toLowerCase();
  const exactTitles = ['learning & development manager', 'l&d manager', 'head of l&d',
    'talent development manager', 'od manager', 'people development manager',
    'lecturer in hrm', 'senior lecturer', 'teaching fellow'];
  const partialTitles = ['l&d', 'learning and development', 'talent development',
    'organisational development', 'people development', 'lecturer', 'teaching fellow'];

  if (exactTitles.some(t => titleLower.includes(t))) score += 25;
  else if (partialTitles.some(t => titleLower.includes(t))) score += 18;
  else if (titleLower.includes('learning') || titleLower.includes('development')) score += 8;

  // Location match (15 points max)
  const locLower = (job.location || '').toLowerCase();
  const tier1Locs = ['maidenhead', 'reading', 'slough', 'windsor'];
  const tier2Locs = ['london', 'bracknell', 'high wycombe', 'oxford', 'wokingham'];
  const remoteTerms = ['remote', 'work from home', 'wfh'];

  if (tier1Locs.some(l => locLower.includes(l))) score += 15;
  else if (tier2Locs.some(l => locLower.includes(l))) score += 12;
  else if (remoteTerms.some(r => locLower.includes(r))) score += 15;
  else score += 3;

  // Salary match (15 points max)
  if (job.salary_min && job.salary_max) {
    const mid = (job.salary_min + job.salary_max) / 2;
    if (mid >= 65000 && mid <= 90000) score += 15;
    else if (mid >= 55000 && mid <= 100000) score += 10;
    else if (mid >= 38000 && mid <= 55000 && job.job_type === 'academic') score += 12;
    else score += 3;
  } else {
    score += 10; // Unknown salary -- neutral
  }

  // Seniority (20 points max) -- based on title keywords
  const seniorTerms = ['head', 'director', 'senior', 'lead', 'manager', 'partner',
    'professor', 'associate professor'];
  const midTerms = ['specialist', 'consultant', 'lecturer', 'fellow'];
  const juniorTerms = ['coordinator', 'assistant', 'administrator', 'intern', 'graduate'];

  if (seniorTerms.some(t => titleLower.includes(t))) score += 20;
  else if (midTerms.some(t => titleLower.includes(t))) score += 14;
  else if (juniorTerms.some(t => titleLower.includes(t))) score += 4;
  else score += 10;

  // Skills (15 points max) -- keyword scan of description
  const descLower = (job.description || '').toLowerCase();
  const skillKeywords = ['cipd', 'l&d strategy', 'leadership development',
    'talent development', 'organisational development', 'change management',
    'coaching', 'mentoring', 'needs analysis', 'phd', 'doctorate', 'mba'];
  const matchedSkills = skillKeywords.filter(s => descLower.includes(s));
  score += Math.min(15, matchedSkills.length * 3);

  // Sector (10 points max)
  const goodSectors = ['university', 'nhs', 'civil service', 'plc', 'ltd',
    'group', 'council', 'trust'];
  if (goodSectors.some(s => (job.company || '').toLowerCase().includes(s))) score += 10;
  else score += 5;

  return {
    composite_score: Math.min(100, score),
    tier: score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D',
    method: 'rule_based'
  };
}
```

---

## 8. Deduplication Strategy

### 8.1 The Deduplication Problem

The same job frequently appears across multiple sources:
- A role posted directly on Reed also appears on Adzuna (which aggregates Reed)
- An employer posts on their website, LinkedIn, and Indeed simultaneously
- Recruitment agencies post the same role under slightly different titles on multiple boards
- Google Jobs aggregates from multiple sources, creating another layer of duplication

Without deduplication, the candidate would see the same role 3-5 times across sources, creating noise and wasting review time.

### 8.2 Three-Layer Deduplication

#### Layer 1: Exact Hash Match (at insert time)

When a job is normalized and about to be inserted, compute a dedup hash:

```
dedup_hash = MD5(lowercase(trim(title)) + '|' + lowercase(trim(company)) + '|' + lowercase(trim(location)))
```

Before insert, check if this hash already exists in the `jobs` table. If it does:
- Do not insert a new row
- Add a new entry to `job_sources` linking the existing job to this new source
- Update `last_seen_at` on the existing job

This catches exact duplicates across sources (e.g., same title, same company, same location on both Reed and Adzuna).

#### Layer 2: Fuzzy Match (periodic batch)

WF6 (Dedup & Cleanup) runs every 4 hours and performs fuzzy matching on recent entries:

```sql
-- Find potential duplicates within the last 7 days
SELECT a.id, b.id, a.title, b.title, a.company, b.company, a.location, b.location
FROM jobs a
JOIN jobs b ON a.id < b.id
  AND a.created_at > NOW() - INTERVAL '7 days'
  AND b.created_at > NOW() - INTERVAL '7 days'
  AND a.status != 'duplicate'
  AND b.status != 'duplicate'
WHERE
  -- Same company (fuzzy)
  similarity(lower(a.company), lower(b.company)) > 0.7
  -- Similar title (fuzzy)
  AND similarity(lower(a.title), lower(b.title)) > 0.6
  -- Same general location
  AND (
    lower(a.location) = lower(b.location)
    OR similarity(lower(a.location), lower(b.location)) > 0.7
  );
```

This requires the `pg_trgm` extension for the `similarity()` function:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

For each potential duplicate pair, the fuzzy matcher:
1. Keeps the entry with the most complete data (longer description, salary present, etc.)
2. Marks the other as `status = 'duplicate'` with `duplicate_of = <surviving_id>`
3. Merges source references to the surviving entry

#### Layer 3: Agency Duplicate Detection (AI-assisted)

Recruitment agencies often post the same underlying role with different:
- Job titles ("L&D Manager" vs "Learning & Development Lead")
- Company names (anonymized: "Leading FTSE 100 Company" vs "Major Financial Services Firm")
- Salary ranges (slightly different based on agency markup)

These cannot be caught by hash or fuzzy matching alone. The AI scoring pipeline includes an agency duplicate detection step:

```
When scoring a job, also check:
- Is the company name anonymized? (e.g., "Leading...", "Major...", "A well-known...")
- Are there other recent jobs with similar titles in the same location from different agencies?
- Flag potential agency duplicates for manual review
```

The LLM scoring prompt includes:
```
Additional task: If this appears to be the same role as another listing
(same location, similar description, different agency), note this in
the "red_flags" field as "Possible duplicate of [other listing details]".
```

### 8.3 Dedup Hash Normalization Rules

Before computing the dedup hash, normalize the components:

**Title Normalization:**
```
1. Lowercase
2. Remove parenthetical content: "(12-month FTC)" -> ""
3. Remove salary in title: "L&D Manager - GBP 75k" -> "L&D Manager"
4. Standardize abbreviations: "L&D" <-> "Learning & Development" <-> "Learning and Development"
5. Remove location in title: "L&D Manager - London" -> "L&D Manager"
6. Remove agency suffix: "L&D Manager | Reed" -> "L&D Manager"
7. Trim whitespace and special characters
```

**Company Normalization:**
```
1. Lowercase
2. Remove legal suffixes: "Ltd", "Limited", "PLC", "Inc", "LLP"
3. Remove "The" prefix: "The University of Reading" -> "University of Reading"
4. Standardize common patterns: "Uni of X" -> "University of X"
5. Handle anonymized names: Map "Leading..." / "Major..." to "ANONYMIZED"
6. Trim
```

**Location Normalization:**
```
1. Lowercase
2. Remove country: "Reading, UK" -> "Reading"
3. Remove region qualifiers: "Reading, Berkshire" -> "Reading"
4. Standardize London: "London, EC2" / "City of London" / "Central London" -> "London"
5. Handle postcodes: Extract city from postcode if present
6. Trim
```

### 8.4 Dedup Metrics

Track and report weekly:
- **Exact dedup rate:** % of new discoveries that matched an existing hash
- **Fuzzy dedup rate:** % of entries merged by fuzzy matching
- **Cross-source overlap:** Matrix showing which sources have the most overlap
- **Unique contribution rate:** % of unique jobs found by each source (justifies cost)

---

## 9. Notification System

### 9.1 Notification Channels

| Channel | Use Case | Priority |
|---------|----------|----------|
| Email (daily digest) | Morning briefing with all A+B tier jobs | Primary |
| Email (instant alert) | A-tier jobs discovered | High priority |
| Email (weekly summary) | Stats, source health, pipeline overview | Operational |

### 9.2 Daily Digest Email (7:30 AM)

**Trigger:** Cron at 7:30 AM UK time (BST/GMT aware)

**Content:**
```
Subject: Selvi Job Digest - [Date] - [X] new matches ([Y] A-tier)

Body:

Good morning,

Here are your new job matches from the last 24 hours:

=== A-TIER (Apply Today) ===

1. [Title] at [Company]
   Location: [Location] | Salary: [Salary] | Posted: [Date]
   Score: [Score]/100 | [Rationale]
   Working: [Remote/Hybrid/Office]
   Source: [Source]
   Apply: [URL]

2. ...

=== B-TIER (Worth Reviewing) ===

1. [Title] at [Company]
   Location: [Location] | Salary: [Salary] | Posted: [Date]
   Score: [Score]/100 | [Rationale]
   Apply: [URL]

2. ...

=== STATS ===
Total discovered: [N]
A-tier: [N] | B-tier: [N] | C-tier: [N] | Filtered: [N]
Sources active: [N]/[Total]
Any issues: [Source X returned 0 results]

---
Selvi Job App | Module 1: Job Discovery
```

**n8n Implementation:**
```
Workflow 7 (Notification Dispatcher):
1. Cron trigger: 7:30 AM
2. Postgres node: SELECT * FROM jobs WHERE scored = true AND tier IN ('A', 'B')
   AND notified_digest = false AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY tier ASC, composite_score DESC
3. Code node: Format email HTML
4. Send Email node (SMTP or Resend API)
5. Postgres node: UPDATE jobs SET notified_digest = true WHERE id IN (...)
```

### 9.3 Instant A-Tier Alert

**Trigger:** After AI scoring, if a job is scored as A-tier

**Content:**
```
Subject: [A-TIER] [Title] at [Company] - [Location]

Body:
A high-match job was just discovered:

[Title] at [Company]
Location: [Location]
Salary: [Salary]
Score: [Score]/100
Rationale: [Rationale]
Working Pattern: [Remote/Hybrid/Office]

[Full description excerpt - first 500 chars]

Apply now: [URL]

---
This is an instant alert for A-tier matches (score 75+).
```

**n8n Implementation:**
```
Workflow 5 (AI Scoring Pipeline):
-- After scoring, check if tier == 'A'
-- If yes, trigger immediate notification via Send Email node
-- Set notified_instant = true
```

### 9.4 Weekly Summary Email (Monday 8:00 AM)

**Content:**
```
Subject: Selvi Weekly Job Report - Week of [Date]

Body:
=== WEEKLY SUMMARY ===

Jobs discovered this week: [N]
  A-tier: [N]
  B-tier: [N]
  C-tier: [N]
  Filtered (D-tier): [N]

Duplicates removed: [N]

=== SOURCE HEALTH ===
| Source      | Jobs Found | Unique | Status  |
|-------------|-----------|--------|---------|
| Adzuna      | 45        | 30     | Healthy |
| Reed        | 38        | 25     | Healthy |
| Jooble      | 22        | 8      | Healthy |
| jobs.ac.uk  | 12        | 11     | Healthy |
| Guardian    | 8         | 5      | Healthy |
| CV-Library  | 15        | 6      | Healthy |
| Civil Svc   | 4         | 4      | Healthy |
| LinkedIn    | 20        | 12     | Healthy |
| Indeed      | 18        | 7      | Healthy |
| TotalJobs   | 10        | 4      | Healthy |
| CIPD        | 5         | 5      | Healthy |
| TrainingZone| 2         | 2      | Warning |
| Personnel T | 3         | 3      | Healthy |

=== TRENDS ===
- Most common locations this week: London (45%), Reading (20%), Slough (10%)
- Average salary (where stated): GBP 72,500
- Most common required qualification: CIPD Level 7 (mentioned in 60% of roles)
- Remote/hybrid roles: 40% of total

=== ACTION ITEMS ===
- [N] A-tier jobs awaiting application
- [N] B-tier jobs to review
```

---

## 10. Database Schema

### 10.1 Database Setup

```sql
-- Database: selvi_jobs
-- Encoding: UTF8
-- Collation: en_GB.UTF-8

CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy matching
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation
```

### 10.2 Table: jobs

The central table storing all discovered job opportunities.

```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core job data
    title VARCHAR(500) NOT NULL,
    company VARCHAR(500),
    location VARCHAR(500),
    description TEXT,
    url TEXT NOT NULL,

    -- Salary
    salary_min INTEGER,           -- Annual GBP, null if unknown
    salary_max INTEGER,           -- Annual GBP, null if unknown
    salary_raw VARCHAR(500),      -- Original salary text from source
    salary_currency VARCHAR(10) DEFAULT 'GBP',
    salary_is_predicted BOOLEAN DEFAULT false,

    -- Classification
    job_type VARCHAR(20) CHECK (job_type IN ('corporate', 'academic', 'unknown')) DEFAULT 'unknown',
    contract_type VARCHAR(30) CHECK (contract_type IN ('permanent', 'fixed_term', 'contract', 'temporary', 'freelance', 'unknown')) DEFAULT 'unknown',
    work_type VARCHAR(30) CHECK (work_type IN ('full_time', 'part_time', 'flexible', 'unknown')) DEFAULT 'unknown',
    working_pattern VARCHAR(20) CHECK (working_pattern IN ('office', 'hybrid', 'remote', 'unknown')) DEFAULT 'unknown',
    seniority VARCHAR(30),        -- e.g., 'manager', 'head', 'lecturer', 'senior_lecturer'

    -- Dates
    posted_at TIMESTAMPTZ,        -- When the job was originally posted
    expires_at TIMESTAMPTZ,       -- Application deadline (if known)
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When our system found it
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Last time any source returned this job

    -- Scoring
    scored BOOLEAN DEFAULT false,
    composite_score INTEGER,      -- 0-100
    tier CHAR(1) CHECK (tier IN ('A', 'B', 'C', 'D')),

    -- Deduplication
    dedup_hash VARCHAR(64) NOT NULL,  -- MD5 of normalized title|company|location
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'duplicate', 'expired', 'applied', 'rejected', 'archived')),
    duplicate_of UUID REFERENCES jobs(id),

    -- Notification tracking
    notified_instant BOOLEAN DEFAULT false,
    notified_digest BOOLEAN DEFAULT false,
    notified_weekly BOOLEAN DEFAULT false,

    -- Metadata
    application_count INTEGER,    -- Number of applicants (if source provides)
    visa_sponsorship_mentioned BOOLEAN DEFAULT false,
    cipd_required BOOLEAN DEFAULT false,
    application_deadline DATE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes
    CONSTRAINT unique_dedup_hash UNIQUE (dedup_hash)
);

-- Indexes
CREATE INDEX idx_jobs_tier ON jobs(tier) WHERE status = 'active';
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scored ON jobs(scored) WHERE scored = false;
CREATE INDEX idx_jobs_discovered ON jobs(discovered_at DESC);
CREATE INDEX idx_jobs_composite_score ON jobs(composite_score DESC) WHERE status = 'active';
CREATE INDEX idx_jobs_dedup_hash ON jobs(dedup_hash);
CREATE INDEX idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX idx_jobs_company_trgm ON jobs USING gin(company gin_trgm_ops);
CREATE INDEX idx_jobs_notified_digest ON jobs(notified_digest) WHERE notified_digest = false AND tier IN ('A', 'B');
CREATE INDEX idx_jobs_notified_instant ON jobs(notified_instant) WHERE notified_instant = false AND tier = 'A';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 10.3 Table: job_sources

Tracks which sources discovered each job and when.

```sql
CREATE TABLE job_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Source identification
    source VARCHAR(50) NOT NULL,  -- 'adzuna', 'reed', 'jooble', 'jobs_ac_uk', 'guardian', 'cv_library', 'civil_service', 'linkedin_email', 'indeed_email', 'totaljobs_email', 'cipd_firecrawl', 'trainingzone_firecrawl', 'personnel_today_firecrawl', 'university_firecrawl', 'serpapi_google'
    source_id VARCHAR(500),       -- The ID of this job on the source platform
    source_url TEXT,              -- Direct URL on the source platform

    -- Capture metadata
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB,               -- Original response from source (for debugging)

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_job_source UNIQUE (job_id, source, source_id)
);

CREATE INDEX idx_job_sources_job_id ON job_sources(job_id);
CREATE INDEX idx_job_sources_source ON job_sources(source);
CREATE INDEX idx_job_sources_captured ON job_sources(captured_at DESC);
```

### 10.4 Table: job_scores

Stores detailed scoring results from the AI engine.

```sql
CREATE TABLE job_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Scoring method
    scoring_method VARCHAR(20) NOT NULL CHECK (scoring_method IN ('llm_claude', 'llm_gpt4o', 'llm_gpt4o_mini', 'rule_based')),
    model_version VARCHAR(100),    -- e.g., 'claude-3.5-sonnet-20260301'

    -- Dimension scores (0-10)
    title_match SMALLINT CHECK (title_match BETWEEN 0 AND 10),
    seniority_match SMALLINT CHECK (seniority_match BETWEEN 0 AND 10),
    location_match SMALLINT CHECK (location_match BETWEEN 0 AND 10),
    salary_match SMALLINT CHECK (salary_match BETWEEN 0 AND 10),
    skills_match SMALLINT CHECK (skills_match BETWEEN 0 AND 10),
    sector_match SMALLINT CHECK (sector_match BETWEEN 0 AND 10),

    -- Composite
    composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
    tier CHAR(1) NOT NULL CHECK (tier IN ('A', 'B', 'C', 'D')),

    -- LLM output
    rationale TEXT,
    red_flags JSONB DEFAULT '[]'::jsonb,
    green_flags JSONB DEFAULT '[]'::jsonb,
    job_type VARCHAR(20),         -- 'corporate' or 'academic'
    working_pattern VARCHAR(20),
    visa_sponsorship_mentioned BOOLEAN DEFAULT false,
    cipd_required BOOLEAN DEFAULT false,
    application_deadline DATE,

    -- Full LLM response (for debugging/tuning)
    raw_llm_response JSONB,

    -- Cost tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),

    -- Audit
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scoring_duration_ms INTEGER,

    CONSTRAINT unique_job_score UNIQUE (job_id, scoring_method)
);

CREATE INDEX idx_job_scores_job_id ON job_scores(job_id);
CREATE INDEX idx_job_scores_tier ON job_scores(tier);
CREATE INDEX idx_job_scores_scored_at ON job_scores(scored_at DESC);
```

### 10.5 Table: search_configs

Stores search terms, locations, and source-specific parameters. Allows runtime modification without code changes.

```sql
CREATE TABLE search_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Search definition
    search_term VARCHAR(500) NOT NULL,
    job_type VARCHAR(20) CHECK (job_type IN ('corporate', 'academic', 'both')) DEFAULT 'both',

    -- Location
    location VARCHAR(200),
    radius_miles INTEGER DEFAULT 25,

    -- Salary
    salary_min INTEGER,
    salary_max INTEGER,

    -- Source applicability
    applicable_sources JSONB DEFAULT '["adzuna", "reed", "jooble", "serpapi"]'::jsonb,

    -- Scheduling
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,   -- 1=highest, 10=lowest (determines order in rate-limited contexts)

    -- Category/sector filters (source-specific)
    adzuna_category VARCHAR(100),
    reed_category VARCHAR(100),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_search_configs_updated_at BEFORE UPDATE ON search_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_search_configs_enabled ON search_configs(enabled) WHERE enabled = true;
```

### 10.6 Table: rss_feed_configs

```sql
CREATE TABLE rss_feed_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Feed definition
    feed_url TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,   -- 'jobs_ac_uk', 'guardian', 'cv_library', 'civil_service'
    label VARCHAR(200),            -- Human-readable label
    job_type VARCHAR(20) DEFAULT 'both',

    -- Scheduling
    enabled BOOLEAN DEFAULT true,
    poll_interval_minutes INTEGER DEFAULT 120,  -- How often to poll
    last_polled_at TIMESTAMPTZ,
    last_successful_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feed_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 10.7 Table: firecrawl_targets

```sql
CREATE TABLE firecrawl_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Target definition
    target_url TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,   -- 'cipd_firecrawl', 'trainingzone_firecrawl', etc.
    label VARCHAR(200),
    job_type VARCHAR(20) DEFAULT 'both',

    -- Firecrawl config
    wait_for_ms INTEGER DEFAULT 3000,
    scroll_actions INTEGER DEFAULT 3,  -- Number of scroll-down actions
    extract_format VARCHAR(20) DEFAULT 'markdown',

    -- Scheduling
    enabled BOOLEAN DEFAULT true,
    poll_interval_minutes INTEGER DEFAULT 360,  -- Every 6 hours
    last_polled_at TIMESTAMPTZ,
    last_successful_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    daily_credit_budget INTEGER DEFAULT 2,  -- Max Firecrawl credits per day for this target

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_firecrawl_targets_updated_at BEFORE UPDATE ON firecrawl_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 10.8 Table: notification_log

```sql
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Notification details
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('instant_alert', 'daily_digest', 'weekly_summary', 'source_health_alert', 'system_error')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'webhook', 'slack')),
    recipient VARCHAR(500) NOT NULL,

    -- Content
    subject VARCHAR(500),
    job_ids JSONB DEFAULT '[]'::jsonb,  -- Array of job IDs included in this notification
    jobs_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_sent ON notification_log(sent_at DESC);
CREATE INDEX idx_notification_log_status ON notification_log(status);
```

### 10.9 Table: source_health

```sql
CREATE TABLE source_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    source VARCHAR(50) NOT NULL,
    check_type VARCHAR(30) NOT NULL,  -- 'scheduled_poll', 'manual_check', 'health_check'

    -- Result
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'error')),
    jobs_found INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    error_message TEXT,
    http_status_code INTEGER,

    -- Audit
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_health_source ON source_health(source, checked_at DESC);
CREATE INDEX idx_source_health_status ON source_health(status) WHERE status != 'healthy';
```

### 10.10 Table: candidate_feedback

For the feedback loop (US-008).

```sql
CREATE TABLE candidate_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Feedback
    relevance VARCHAR(20) CHECK (relevance IN ('relevant', 'not_relevant', 'maybe')),
    would_apply BOOLEAN,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidate_feedback_job ON candidate_feedback(job_id);
CREATE INDEX idx_candidate_feedback_relevance ON candidate_feedback(relevance);
```

### 10.11 Table: system_metrics

For tracking system performance over time.

```sql
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}'::jsonb,  -- e.g., {"source": "adzuna", "tier": "A"}

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name, recorded_at DESC);
```

---

## 11. n8n Workflow Specifications

### 11.1 Workflow 1: RSS Source Poller

**Purpose:** Poll RSS feeds from jobs.ac.uk, Guardian Jobs, CV-Library, and Civil Service Jobs for new listings.

**Trigger:** Cron -- every 2 hours, 6:00-22:00 UK time
```
Cron expression: 0 6-22/2 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Get Active RSS Feeds]
    SELECT * FROM rss_feed_configs WHERE enabled = true
    |
[Loop Over Each Feed] (SplitInBatches)
    |
    [RSS Feed Read]
        URL: {{ $json.feed_url }}
        |
    [Code: Normalize Items]
        -- Parse title, company, location, salary, URL, date
        -- Apply source-specific parsing rules
        -- Generate dedup_hash
        -- Filter out non-UK locations
        |
    [Code: Filter Already Seen]
        -- Check dedup_hash against existing jobs
        -- Only pass through genuinely new entries
        |
    [IF: New Jobs Found?]
        |-- Yes:
        |   [Postgres: Insert New Jobs]
        |       INSERT INTO jobs (title, company, location, description, url, posted_at,
        |         salary_raw, salary_min, salary_max, source, job_type, dedup_hash, status)
        |       VALUES (...)
        |       ON CONFLICT (dedup_hash) DO UPDATE SET last_seen_at = NOW()
        |       |
        |   [Postgres: Insert Job Sources]
        |       INSERT INTO job_sources (job_id, source, source_id, source_url, raw_data)
        |       VALUES (...)
        |       |
        |   [Postgres: Update Feed Config]
        |       UPDATE rss_feed_configs SET last_polled_at = NOW(),
        |         last_successful_at = NOW(), consecutive_failures = 0
        |       WHERE id = {{ $json.feed_id }}
        |
        |-- No:
            [Postgres: Update Feed Config (poll only)]
                UPDATE rss_feed_configs SET last_polled_at = NOW()
```

**Error Branch (connected to RSS Feed Read):**
```
[On Error]
    |
[Postgres: Increment Failure Counter]
    UPDATE rss_feed_configs
    SET consecutive_failures = consecutive_failures + 1,
        last_polled_at = NOW()
    WHERE id = {{ $json.feed_id }}
    |
[IF: consecutive_failures > 5]
    |-- Yes:
    |   [Send Email: Source Health Alert]
    |       "RSS feed {{ $json.label }} has failed 5+ consecutive times"
    |-- No:
        [No Op]
```

**Configuration Data (loaded from rss_feed_configs):**

| Feed URL | Source | Label |
|----------|--------|-------|
| `https://www.jobs.ac.uk/rss/lecturer/management.xml` | jobs_ac_uk | jobs.ac.uk - Lecturer/Management |
| `https://www.jobs.ac.uk/rss/lecturer/human-resource-management.xml` | jobs_ac_uk | jobs.ac.uk - Lecturer/HRM |
| `https://www.jobs.ac.uk/rss/lecturer/business-and-management-studies.xml` | jobs_ac_uk | jobs.ac.uk - Lecturer/Business |
| `https://www.jobs.ac.uk/rss/lecturer/education.xml` | jobs_ac_uk | jobs.ac.uk - Lecturer/Education |
| `https://www.jobs.ac.uk/rss/lecturer/organisational-studies.xml` | jobs_ac_uk | jobs.ac.uk - Lecturer/OrgStudies |
| `https://www.jobs.ac.uk/rss/senior-lecturer/management.xml` | jobs_ac_uk | jobs.ac.uk - Sr Lecturer/Management |
| `https://www.jobs.ac.uk/rss/senior-lecturer/human-resource-management.xml` | jobs_ac_uk | jobs.ac.uk - Sr Lecturer/HRM |
| `https://www.jobs.ac.uk/rss/senior-lecturer/business-and-management-studies.xml` | jobs_ac_uk | jobs.ac.uk - Sr Lecturer/Business |
| `https://www.jobs.ac.uk/rss/teaching-fellow/management.xml` | jobs_ac_uk | jobs.ac.uk - Fellow/Management |
| `https://www.jobs.ac.uk/rss/teaching-fellow/business-and-management-studies.xml` | jobs_ac_uk | jobs.ac.uk - Fellow/Business |
| `https://jobs.theguardian.com/jobs/human-resources/rss/` | guardian | Guardian - HR |
| `https://jobs.theguardian.com/jobs/education/rss/` | guardian | Guardian - Education |
| `https://jobs.theguardian.com/jobs/training-and-development/rss/` | guardian | Guardian - Training |
| `https://www.cv-library.co.uk/rss/jobs?q=learning+development+manager&geo=maidenhead&distance=25` | cv_library | CV-Library - L&D Manager |
| `https://www.cv-library.co.uk/rss/jobs?q=talent+development&geo=maidenhead&distance=25` | cv_library | CV-Library - Talent Dev |
| `https://www.cv-library.co.uk/rss/jobs?q=head+of+learning&geo=maidenhead&distance=25` | cv_library | CV-Library - Head of Learning |
| `https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=...&pageaction=rss&keyword=learning+development` | civil_service | Civil Service - L&D |
| `https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=...&pageaction=rss&keyword=talent+development` | civil_service | Civil Service - Talent Dev |
| `https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=...&pageaction=rss&keyword=organisational+development` | civil_service | Civil Service - OD |

---

### 11.2 Workflow 2: API Source Poller

**Purpose:** Query Adzuna, Reed, and Jooble APIs for new job listings.

**Trigger:** Cron -- every 3 hours, 6:00-21:00 UK time
```
Cron expression: 0 6-21/3 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Get Active Search Configs]
    SELECT * FROM search_configs
    WHERE enabled = true
    ORDER BY priority ASC
    |
[Loop Over Each Search Config] (SplitInBatches, batch size: 1)
    |
    +--- [Adzuna Branch] ---+
    |   [IF: 'adzuna' in applicable_sources]
    |       |
    |   [HTTP Request: Adzuna API]
    |       GET https://api.adzuna.com/v1/api/jobs/gb/search/1
    |       Query: app_id, app_key, what, where, distance, salary_min, salary_max,
    |              sort_by=date, max_days_old=3, results_per_page=50
    |       |
    |   [Code: Normalize Adzuna Response]
    |       |
    |   [Postgres: Upsert Jobs]
    |
    +--- [Reed Branch] ---+
    |   [IF: 'reed' in applicable_sources]
    |       |
    |   [HTTP Request: Reed API]
    |       GET https://www.reed.co.uk/api/1.0/search
    |       Auth: Basic (API key as username)
    |       Query: keywords, locationName, distancefromlocation, minimumSalary, maximumSalary,
    |              resultsToTake=100
    |       |
    |   [Code: Normalize Reed Response]
    |       |
    |   [Postgres: Upsert Jobs]
    |
    +--- [Jooble Branch] ---+
        [IF: 'jooble' in applicable_sources]
            |
        [HTTP Request: Jooble API]
            POST https://jooble.org/api/{API_KEY}
            Body: { keywords, location, radius, salary, page }
            |
        [Code: Normalize Jooble Response]
            |
        [Postgres: Upsert Jobs]
    |
[Postgres: Log Source Health]
    INSERT INTO source_health (source, check_type, status, jobs_found, response_time_ms)
    |
[Wait: Rate Limit Pause]
    -- 2 second pause between search configs to respect rate limits
```

**Adzuna Normalization Code:**
```javascript
// Normalize Adzuna API response
const results = $input.all();
return results.flatMap(item => {
  const jobs = item.json.results || [];
  return jobs.map(job => ({
    json: {
      title: job.title?.trim(),
      company: job.company?.display_name?.trim() || 'Unknown',
      location: job.location?.display_name?.trim() || 'Unknown',
      description: (job.description || '').substring(0, 5000),
      url: job.redirect_url,
      posted_at: job.created,
      salary_min: job.salary_min ? Math.round(job.salary_min) : null,
      salary_max: job.salary_max ? Math.round(job.salary_max) : null,
      salary_raw: job.salary_min && job.salary_max
        ? `GBP ${job.salary_min.toLocaleString()} - GBP ${job.salary_max.toLocaleString()}`
        : null,
      salary_is_predicted: job.salary_is_predicted === '1',
      contract_type: mapContractType(job.contract_type),
      work_type: mapWorkType(job.contract_time),
      category: job.category?.label,
      source: 'adzuna',
      source_id: String(job.id),
      dedup_hash: computeHash(job.title, job.company?.display_name, job.location?.display_name)
    }
  }));
});

function mapContractType(type) {
  const map = { 'permanent': 'permanent', 'contract': 'contract', 'temporary': 'temporary' };
  return map[type] || 'unknown';
}

function mapWorkType(time) {
  const map = { 'full_time': 'full_time', 'part_time': 'part_time' };
  return map[time] || 'unknown';
}

function computeHash(title, company, location) {
  const crypto = require('crypto');
  const normalized = [
    (title || '').toLowerCase().trim(),
    (company || '').toLowerCase().trim().replace(/ (ltd|limited|plc|inc|llp)\.?$/g, ''),
    (location || '').toLowerCase().trim().replace(/, (uk|england|united kingdom|berkshire|greater london)$/g, '')
  ].join('|');
  return crypto.createHash('md5').update(normalized).digest('hex');
}
```

---

### 11.3 Workflow 3: Email Alert Parser

**Purpose:** Parse job alert emails from LinkedIn, Indeed, and TotalJobs received via IMAP.

**Trigger:** Cron -- every 30 minutes
```
Cron expression: */30 * * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[IMAP Email: Fetch Unread from LinkedIn]
    Host: imap.gmail.com, Port: 993, SSL: true
    Search: FROM "jobs-noreply@linkedin.com" UNSEEN
    Mark as Read: true
    |
[Code: Parse LinkedIn Alert HTML]
    -- Extract job cards from email HTML
    -- Each card: title, company, location, URL, time
    |
[Code: Normalize LinkedIn Jobs]
    |
[Postgres: Upsert Jobs]
    |
[IMAP Email: Fetch Unread from Indeed]
    Search: FROM "alert@indeed.com" UNSEEN
    |
[Code: Parse Indeed Alert HTML]
    |
[Code: Normalize Indeed Jobs]
    |
[Postgres: Upsert Jobs]
    |
[IMAP Email: Fetch Unread from TotalJobs]
    Search: FROM "noreply@totaljobs.com" UNSEEN
    |
[Code: Parse TotalJobs Alert HTML]
    |
[Code: Normalize TotalJobs Jobs]
    |
[Postgres: Upsert Jobs]
```

**LinkedIn Email Parsing Code:**
```javascript
// Parse LinkedIn job alert email
const items = $input.all();
const results = [];

for (const item of items) {
  const html = item.json.html || item.json.textHtml || '';

  // LinkedIn job cards pattern (may change -- monitor for breakage)
  // Look for job listing blocks with title, company, location
  const jobPattern = /<a[^>]*href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    results.push({
      json: {
        url: match[1].split('?')[0],  // Remove tracking params
        title: match[2].trim(),
        company: match[3].trim(),
        location: match[4].trim(),
        source: 'linkedin_email',
        source_id: extractLinkedInJobId(match[1]),
        posted_at: new Date().toISOString(),  // LinkedIn alerts don't always have exact post time
      }
    });
  }
}

return results;

function extractLinkedInJobId(url) {
  const match = url.match(/\/jobs\/view\/(\d+)/);
  return match ? match[1] : url;
}
```

**Important Notes:**
- Email HTML structure changes without notice. The parsing code must be monitored and updated when LinkedIn/Indeed/TotalJobs change their email templates.
- WF3 should log parse success/failure rates to `source_health`.
- If zero jobs are extracted from an email that should contain jobs, log a warning.

---

### 11.4 Workflow 4: Firecrawl Scraper

**Purpose:** Scrape niche job boards (CIPD, TrainingZone, Personnel Today) and university career pages using Firecrawl.

**Trigger:** Cron -- every 6 hours
```
Cron expression: 0 */6 * * *
Timezone: Europe/London
```

**Node Chain:**

```
[Cron Trigger]
    |
[Postgres: Get Active Firecrawl Targets]
    SELECT * FROM firecrawl_targets
    WHERE enabled = true
    AND (last_polled_at IS NULL OR last_polled_at < NOW() - (poll_interval_minutes || ' minutes')::interval)
    ORDER BY priority ASC
    LIMIT 10  -- Daily credit budget management
    |
[Loop Over Each Target] (SplitInBatches, batch size: 1)
    |
    [HTTP Request: Firecrawl Scrape]
        POST https://api.firecrawl.dev/v1/scrape
        Headers: Authorization: Bearer {{ $credentials.firecrawlApiKey }}
        Body: {
          "url": "{{ $json.target_url }}",
          "formats": ["markdown"],
          "onlyMainContent": true,
          "waitFor": {{ $json.wait_for_ms }}
        }
        Timeout: 60000ms
        |
    [Code: Parse Markdown for Job Listings]
        -- Site-specific parsing logic
        -- Extract: title, company, location, salary, URL, posted date
        |
    [Code: Normalize Extracted Jobs]
        -- Generate dedup_hash
        -- Standardize fields
        |
    [Postgres: Upsert Jobs]
        |
    [Postgres: Update Firecrawl Target]
        UPDATE firecrawl_targets
        SET last_polled_at = NOW(), last_successful_at = NOW(),
            consecutive_failures = 0
        |
    [Wait: 5 seconds]  -- Polite delay between scrapes
```

**Firecrawl Markdown Parsing Code (CIPD/People Management):**
```javascript
// Parse CIPD/People Management job listings from Firecrawl markdown
const markdown = $input.first().json.data?.markdown || '';
const jobs = [];

// Pattern: Job titles are typically markdown links followed by company and location
// Example: ## [L&D Manager](https://jobs.peoplemanagement.co.uk/job/12345/)
// Company Name | Reading | GBP 70,000 - GBP 80,000

const lines = markdown.split('\n');
let currentJob = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Look for job title links
  const titleMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  if (titleMatch && isJobTitle(titleMatch[1])) {
    if (currentJob) jobs.push(currentJob);
    currentJob = {
      title: titleMatch[1],
      url: titleMatch[2],
      company: null,
      location: null,
      salary_raw: null,
      source: 'cipd_firecrawl'
    };
    continue;
  }

  // If we have a current job, look for metadata in subsequent lines
  if (currentJob) {
    // Company | Location | Salary pattern
    const parts = line.split('|').map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      currentJob.company = parts[0] || currentJob.company;
      currentJob.location = parts[1] || currentJob.location;
      if (parts[2]) currentJob.salary_raw = parts[2];
    }

    // Salary pattern
    const salaryMatch = line.match(/(?:GBP|£)\s*([\d,]+)\s*(?:-|to)\s*(?:GBP|£)\s*([\d,]+)/i);
    if (salaryMatch) {
      currentJob.salary_raw = line;
      currentJob.salary_min = parseInt(salaryMatch[1].replace(/,/g, ''));
      currentJob.salary_max = parseInt(salaryMatch[2].replace(/,/g, ''));
    }
  }
}

if (currentJob) jobs.push(currentJob);

return jobs.filter(j => j.title && j.url).map(j => ({ json: j }));

function isJobTitle(text) {
  const keywords = ['manager', 'head', 'director', 'lead', 'partner', 'specialist',
    'consultant', 'lecturer', 'fellow', 'professor', 'l&d', 'learning',
    'development', 'talent', 'od ', 'organisational'];
  return keywords.some(k => text.toLowerCase().includes(k));
}
```

---

### 11.5 Workflow 5: AI Scoring Pipeline

**Purpose:** Score unscored jobs using the LLM-based relevance engine.

**Trigger:** Cron -- every hour + webhook trigger for on-demand scoring
```
Cron expression: 0 * * * *
Webhook: POST /webhook/score-jobs
```

**Node Chain:**

```
[Cron Trigger / Webhook Trigger]
    |
[Postgres: Get Unscored Jobs]
    SELECT * FROM jobs
    WHERE scored = false AND status = 'active'
    ORDER BY discovered_at DESC
    LIMIT 50
    |
[IF: Jobs to Score?]
    |-- No: [No Op / Stop]
    |-- Yes:
        |
    [SplitInBatches: Batch of 5]
        |
        [Code: Build LLM Prompt]
            -- Construct the scoring prompt with job data
            -- Include all scoring criteria
            |
        [HTTP Request: Claude API]
            POST https://api.anthropic.com/v1/messages
            Headers:
              x-api-key: {{ $credentials.anthropicApiKey }}
              anthropic-version: 2023-06-01
              content-type: application/json
            Body: {
              "model": "claude-sonnet-4-20250514",
              "max_tokens": 1024,
              "messages": [
                {
                  "role": "user",
                  "content": "{{ $json.scoringPrompt }}"
                }
              ]
            }
            Timeout: 30000ms
            |
        [Code: Parse LLM Response]
            -- Extract JSON from response
            -- Validate score ranges
            -- Handle malformed responses
            |
        [Postgres: Insert Score]
            INSERT INTO job_scores (job_id, scoring_method, model_version,
              title_match, seniority_match, location_match, salary_match,
              skills_match, sector_match, composite_score, tier, rationale,
              red_flags, green_flags, job_type, working_pattern,
              visa_sponsorship_mentioned, cipd_required, raw_llm_response,
              input_tokens, output_tokens, cost_usd)
            VALUES (...)
            |
        [Postgres: Update Job]
            UPDATE jobs SET
              scored = true,
              composite_score = {{ $json.composite_score }},
              tier = '{{ $json.tier }}',
              job_type = '{{ $json.job_type }}',
              working_pattern = '{{ $json.working_pattern }}',
              visa_sponsorship_mentioned = {{ $json.visa_sponsorship_mentioned }},
              cipd_required = {{ $json.cipd_required }}
            WHERE id = {{ $json.job_id }}
            |
        [IF: Tier == 'A' AND NOT notified_instant]
            |-- Yes:
            |   [Send Email: Instant A-Tier Alert]
            |   [Postgres: SET notified_instant = true]
            |-- No:
                [Continue to next batch]
```

**Error Branch (connected to Claude API call):**
```
[On Error: Claude API]
    |
[IF: Error is rate limit or timeout]
    |-- Yes:
    |   [Wait: 60 seconds]
    |   [Retry Claude API]
    |-- No:
        [HTTP Request: GPT-4o-mini Fallback]
            POST https://api.openai.com/v1/chat/completions
            -- Same prompt, different model
            |
        [IF: GPT-4o also fails]
            |-- Yes:
            |   [Code: Rule-Based Fallback Scorer]
            |       -- Use deterministic scoring as last resort
            |-- No:
                [Parse GPT-4o Response]
```

---

### 11.6 Workflow 6: Deduplication & Cleanup

**Purpose:** Run fuzzy deduplication, expire old entries, and maintain data quality.

**Trigger:** Cron -- every 4 hours
```
Cron expression: 0 */4 * * *
```

**Node Chain:**

```
[Cron Trigger]
    |
+--- [Fuzzy Dedup Branch] ---+
|   [Postgres: Find Fuzzy Duplicates]
|       SELECT a.id as id_a, b.id as id_b,
|         a.title as title_a, b.title as title_b,
|         a.company as company_a, b.company as company_b,
|         a.location as location_a, b.location as location_b,
|         similarity(lower(a.title), lower(b.title)) as title_sim,
|         similarity(lower(a.company), lower(b.company)) as company_sim
|       FROM jobs a JOIN jobs b ON a.id < b.id
|         AND a.created_at > NOW() - INTERVAL '7 days'
|         AND b.created_at > NOW() - INTERVAL '7 days'
|         AND a.status = 'active' AND b.status = 'active'
|       WHERE similarity(lower(a.company), lower(b.company)) > 0.7
|         AND similarity(lower(a.title), lower(b.title)) > 0.6
|       LIMIT 100
|       |
|   [Loop: Process Each Duplicate Pair]
|       |
|   [Code: Determine Winner]
|       -- Keep the one with: longer description, salary data, earlier discovery
|       |
|   [Postgres: Mark Loser as Duplicate]
|       UPDATE jobs SET status = 'duplicate', duplicate_of = {{ $json.winner_id }}
|       WHERE id = {{ $json.loser_id }}
|       |
|   [Postgres: Merge Sources]
|       UPDATE job_sources SET job_id = {{ $json.winner_id }}
|       WHERE job_id = {{ $json.loser_id }}
|
+--- [Expiry Branch] ---+
|   [Postgres: Expire Old Jobs]
|       UPDATE jobs SET status = 'expired'
|       WHERE status = 'active'
|         AND (
|           (expires_at IS NOT NULL AND expires_at < NOW())
|           OR
|           (expires_at IS NULL AND discovered_at < NOW() - INTERVAL '30 days')
|         )
|
+--- [Stale Source Detection] ---+
|   [Postgres: Check for Stale Sources]
|       SELECT source, MAX(captured_at) as last_capture,
|         COUNT(*) FILTER (WHERE captured_at > NOW() - INTERVAL '24 hours') as recent_count
|       FROM job_sources
|       GROUP BY source
|       HAVING MAX(captured_at) < NOW() - INTERVAL '24 hours'
|       |
|   [IF: Stale Sources Found]
|       |-- Yes: [Send Email: Stale Source Alert]
|
+--- [Metrics Branch] ---+
    [Postgres: Record Dedup Metrics]
        INSERT INTO system_metrics (metric_name, metric_value, dimensions) VALUES
          ('dedup_fuzzy_merged', {{ $json.merged_count }}, '{}'),
          ('jobs_expired', {{ $json.expired_count }}, '{}'),
          ('active_jobs_total', (SELECT COUNT(*) FROM jobs WHERE status = 'active'), '{}')
```

---

### 11.7 Workflow 7: Notification Dispatcher

**Purpose:** Send daily digest emails, weekly summaries, and manage notification state.

**Trigger:** Multiple triggers
```
Daily Digest: Cron at 7:30 AM (0 30 7 * * *)
Weekly Summary: Cron at 8:00 AM Monday (0 0 8 * * 1)
```

**Node Chain (Daily Digest):**

```
[Cron Trigger: 7:30 AM Daily]
    |
[Postgres: Get Unnotified A+B Tier Jobs]
    SELECT j.*, js.rationale, js.red_flags, js.green_flags
    FROM jobs j
    LEFT JOIN job_scores js ON j.id = js.job_id
    WHERE j.status = 'active'
      AND j.scored = true
      AND j.tier IN ('A', 'B')
      AND j.notified_digest = false
      AND j.discovered_at > NOW() - INTERVAL '48 hours'
    ORDER BY j.tier ASC, j.composite_score DESC
    |
[IF: Jobs to Notify?]
    |-- No: [No Op / Send "No new matches today" email]
    |-- Yes:
        |
    [Code: Build Digest Email HTML]
        -- Group by tier
        -- Format each job card with title, company, location, salary, score, rationale, URL
        -- Include stats section
        |
    [Send Email: Daily Digest]
        To: selvi@email.com
        From: jobs@apiloom.io
        Subject: "Selvi Job Digest - {{ $today }} - {{ $json.total_count }} new matches ({{ $json.a_tier_count }} A-tier)"
        Body: {{ $json.emailHtml }}
        |
    [Postgres: Mark Jobs as Digest-Notified]
        UPDATE jobs SET notified_digest = true
        WHERE id IN ({{ $json.job_ids }})
        |
    [Postgres: Log Notification]
        INSERT INTO notification_log (notification_type, channel, recipient, subject,
          job_ids, jobs_count, status, sent_at)
        VALUES ('daily_digest', 'email', 'selvi@email.com', ..., 'sent', NOW())
```

**Node Chain (Weekly Summary):**

```
[Cron Trigger: Monday 8:00 AM]
    |
[Postgres: Weekly Stats Query]
    SELECT
      COUNT(*) FILTER (WHERE tier = 'A') as a_tier,
      COUNT(*) FILTER (WHERE tier = 'B') as b_tier,
      COUNT(*) FILTER (WHERE tier = 'C') as c_tier,
      COUNT(*) FILTER (WHERE tier = 'D') as d_tier,
      COUNT(*) FILTER (WHERE status = 'duplicate') as duplicates
    FROM jobs
    WHERE discovered_at > NOW() - INTERVAL '7 days'
    |
[Postgres: Source Contribution Query]
    SELECT js.source,
      COUNT(DISTINCT js.job_id) as total_jobs,
      COUNT(DISTINCT js.job_id) FILTER (WHERE j.status = 'active') as unique_jobs
    FROM job_sources js
    JOIN jobs j ON js.job_id = j.id
    WHERE js.captured_at > NOW() - INTERVAL '7 days'
    GROUP BY js.source
    |
[Postgres: Source Health Summary]
    SELECT source,
      COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
      COUNT(*) FILTER (WHERE status != 'healthy') as unhealthy_checks,
      MAX(checked_at) as last_check
    FROM source_health
    WHERE checked_at > NOW() - INTERVAL '7 days'
    GROUP BY source
    |
[Code: Build Weekly Summary Email]
    |
[Send Email: Weekly Summary]
    |
[Postgres: Log Notification]
```

---

## 12. Search Query Configuration

### 12.1 Corporate Search Terms

These search terms are loaded into the `search_configs` table and used by WF2 (API Poller).

| Search Term | Job Type | Priority | Applicable Sources |
|-------------|----------|----------|--------------------|
| Learning Development Manager | corporate | 1 | adzuna, reed, jooble, serpapi |
| L&D Manager | corporate | 1 | adzuna, reed, jooble, serpapi |
| L&D Business Partner | corporate | 2 | adzuna, reed, jooble, serpapi |
| Talent Development Manager | corporate | 2 | adzuna, reed, jooble, serpapi |
| Head of Learning Development | corporate | 1 | adzuna, reed, jooble, serpapi |
| Head of L&D | corporate | 1 | adzuna, reed, jooble, serpapi |
| L&D Director | corporate | 2 | adzuna, reed, jooble, serpapi |
| People Development Manager | corporate | 2 | adzuna, reed, jooble, serpapi |
| Organisational Development Manager | corporate | 3 | adzuna, reed, jooble, serpapi |
| OD Manager | corporate | 3 | adzuna, reed, jooble |
| OD Specialist | corporate | 4 | adzuna, reed, jooble |
| Capability Development Lead | corporate | 3 | adzuna, reed, jooble |
| Leadership Development Manager | corporate | 2 | adzuna, reed, jooble, serpapi |
| Enablement Manager | corporate | 4 | adzuna, reed, jooble |
| Learning Consultant | corporate | 3 | adzuna, reed, jooble |
| Learning Experience Manager | corporate | 3 | adzuna, reed, jooble |
| Workforce Development Manager | corporate | 4 | adzuna, reed, jooble |
| Employee Development Manager | corporate | 3 | adzuna, reed, jooble |
| Learning Strategist | corporate | 4 | adzuna, reed |
| Training Manager | corporate | 4 | adzuna, reed, jooble |
| Skills Development Manager | corporate | 4 | adzuna, reed |
| Culture Development Manager | corporate | 5 | adzuna, reed |
| People Experience Manager | corporate | 5 | adzuna, reed |

### 12.2 Academic Search Terms

| Search Term | Job Type | Priority | Applicable Sources |
|-------------|----------|----------|--------------------|
| Lecturer HRM | academic | 1 | jobs_ac_uk (RSS), serpapi |
| Senior Lecturer HRM | academic | 1 | jobs_ac_uk (RSS), serpapi |
| Lecturer Human Resource Management | academic | 1 | jobs_ac_uk (RSS), serpapi |
| Lecturer Organisational Behaviour | academic | 2 | jobs_ac_uk (RSS), serpapi |
| Lecturer Management | academic | 2 | jobs_ac_uk (RSS) |
| Senior Lecturer Management | academic | 2 | jobs_ac_uk (RSS) |
| Lecturer Business | academic | 3 | jobs_ac_uk (RSS) |
| Teaching Fellow HRM | academic | 2 | jobs_ac_uk (RSS) |
| Senior Teaching Fellow Management | academic | 2 | jobs_ac_uk (RSS) |
| Associate Professor HRM | academic | 1 | jobs_ac_uk (RSS), serpapi |
| Professor of Practice | academic | 2 | jobs_ac_uk (RSS) |
| Visiting Lecturer HRM | academic | 3 | jobs_ac_uk (RSS) |
| Lecturer Learning Development | academic | 2 | jobs_ac_uk (RSS) |
| Lecturer Business Education | academic | 3 | jobs_ac_uk (RSS) |
| Programme Leader Business | academic | 4 | jobs_ac_uk (RSS) |
| Course Leader HRM | academic | 4 | jobs_ac_uk (RSS) |

### 12.3 Location Parameters

| Location | API Parameter | Radius (miles) | Used For |
|----------|---------------|----------------|----------|
| Maidenhead | maidenhead | 25 | Primary search center |
| Reading | reading | 15 | Additional coverage |
| London | london | 15 | Capital coverage |
| Slough | slough | 10 | Local coverage |
| Oxford | oxford | 10 | Academic hub |
| High Wycombe | high wycombe | 10 | Bucks coverage |
| Bracknell | bracknell | 10 | Local coverage |

**Note:** Not all locations need to be queried for every search term. Use Maidenhead with a 25-mile radius as the primary search to capture most results. London and Oxford are secondary queries to ensure nothing is missed in those specific markets.

### 12.4 Salary Filters

| Role Type | Min Salary | Max Salary | Notes |
|-----------|-----------|-----------|-------|
| Corporate | 55000 | 90000 | Slightly wider than 70-80k target to catch edge cases |
| Academic | (none) | (none) | Academic salaries are fixed by pay scale; do not filter |
| Civil Service | 55000 | 90000 | Maps to Grade 6-7 range |

### 12.5 Category/Sector Filters

**Adzuna Categories:**
- `hr-jobs` (primary)
- `teaching-jobs` (for academic)
- `consultancy-jobs` (for consulting roles)

**Reed Categories (optional -- using keywords is usually sufficient):**
- HR / Personnel
- Education / Training
- Management Consultancy

### 12.6 Search Query SQL Seed Data

```sql
-- Corporate search configs
INSERT INTO search_configs (search_term, job_type, location, radius_miles, salary_min, salary_max, applicable_sources, priority) VALUES
('Learning Development Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 1),
('L&D Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 1),
('L&D Business Partner', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 2),
('Talent Development Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 2),
('Head of Learning Development', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 1),
('Head of L&D', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 1),
('L&D Director', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 2),
('People Development Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 2),
('Organisational Development Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 3),
('Capability Development Lead', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 3),
('Leadership Development Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 2),
('Enablement Manager', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 4),
('Learning Consultant', 'corporate', 'Maidenhead', 25, 55000, 90000, '["adzuna", "reed", "jooble"]', 3),

-- London-specific corporate searches (separate because of different radius)
('Learning Development Manager', 'corporate', 'London', 15, 55000, 90000, '["adzuna", "reed"]', 2),
('Head of L&D', 'corporate', 'London', 15, 55000, 90000, '["adzuna", "reed"]', 2),
('L&D Director', 'corporate', 'London', 15, 60000, 100000, '["adzuna", "reed"]', 3),

-- Oxford-specific (academic hub)
('Learning Development Manager', 'corporate', 'Oxford', 10, 55000, 90000, '["adzuna", "reed"]', 4);

-- Academic search configs (RSS feeds handle most of this, but API search as supplement)
INSERT INTO search_configs (search_term, job_type, location, radius_miles, applicable_sources, priority) VALUES
('Lecturer HRM', 'academic', 'Maidenhead', 50, '["serpapi"]', 2),
('Senior Lecturer Management', 'academic', 'Maidenhead', 50, '["serpapi"]', 2),
('Teaching Fellow Business', 'academic', 'London', 30, '["serpapi"]', 3);
```

---

## 13. Error Handling & Monitoring

### 13.1 Error Categories

| Category | Examples | Response |
|----------|----------|----------|
| Source Down | API returns 500, RSS returns empty XML | Retry 3x with exponential backoff. Log to source_health. Alert after 3 consecutive failures. |
| Authentication Failure | API returns 401/403 | Immediate alert to admin. Pause source. |
| Rate Limit Hit | API returns 429 | Back off for 1 hour. Adjust schedule. Log. |
| Parse Failure | HTML structure changed, XML malformed | Log warning. Continue with partial data. Alert if >50% of items fail to parse. |
| LLM Failure | Claude API timeout, invalid JSON response | Retry once. Fall back to GPT-4o-mini. Fall back to rule-based. |
| Database Error | Connection timeout, constraint violation | Retry 3x. Alert if persistent. |
| Firecrawl Failure | Site blocks scraping, CAPTCHA | Log. Skip site for this cycle. Reduce scrape frequency. |
| IMAP Failure | Gmail connection rejected, auth expired | Alert immediately (email parsing is critical). |

### 13.2 Health Check Workflow

A lightweight health check runs every 6 hours to verify system integrity.

```
[Cron Trigger: Every 6 hours]
    |
+--- [Check 1: Database Connectivity]
|   [Postgres: SELECT 1]
|       If fails: Alert immediately
|
+--- [Check 2: Source Freshness]
|   [Postgres: Check last successful poll per source]
|       SELECT source, MAX(last_successful_at) FROM rss_feed_configs GROUP BY source
|       UNION
|       SELECT 'adzuna', (last Adzuna success time)
|       ...
|       If any source > 24 hours stale: Alert
|
+--- [Check 3: Scoring Pipeline]
|   [Postgres: Check for scoring backlog]
|       SELECT COUNT(*) FROM jobs WHERE scored = false AND discovered_at < NOW() - INTERVAL '2 hours'
|       If > 50 unscored jobs older than 2 hours: Alert
|
+--- [Check 4: Dedup Health]
|   [Postgres: Check duplicate ratio]
|       SELECT COUNT(*) FILTER (WHERE status = 'duplicate') / NULLIF(COUNT(*), 0)
|       FROM jobs WHERE discovered_at > NOW() - INTERVAL '24 hours'
|       If > 60% duplicate ratio: Warning (possible source misconfiguration)
|
+--- [Check 5: Notification Delivery]
|   [Postgres: Check last successful notification]
|       SELECT MAX(sent_at) FROM notification_log WHERE status = 'sent'
|       If > 48 hours since last sent: Alert
|
+--- [Check 6: Firecrawl Credit Budget]
    [Postgres: Count today's Firecrawl calls]
        If approaching daily limit: Reduce remaining targets
```

### 13.3 Alerting Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| Any source down > 6 hours | Warning | Email alert |
| Any source down > 24 hours | Critical | Email + investigate |
| Scoring backlog > 100 jobs | Warning | Email alert |
| LLM API completely down | Critical | Activate rule-based fallback + email |
| IMAP connection failure | Critical | Email alert (to secondary address) |
| Notification not sent > 24 hours | Critical | Email alert (to secondary address) |
| Database connection failure | Critical | Immediate alert |
| Firecrawl credits exhausted | Warning | Reduce scraping to essential targets only |

### 13.4 Logging Strategy

All workflows log to n8n's built-in execution log. Additionally:

- **Source health events** go to the `source_health` table for trend analysis
- **Scoring events** go to `job_scores` with cost and performance metrics
- **Notification events** go to `notification_log`
- **System metrics** go to `system_metrics` for dashboarding

n8n execution logs are retained for 30 days. Database tables are retained indefinitely (with archival for entries older than 90 days).

---

## 14. Privacy & Compliance

### 14.1 UK GDPR Considerations

The system processes job listing data, which is publicly available information. However, several GDPR considerations apply:

**Data Processed:**
- Job listings (public data posted by employers/agencies)
- Candidate's search preferences and feedback (personal data)
- Candidate's email address (for notifications)
- Email content from LinkedIn/Indeed/TotalJobs (may contain personal data)

**Lawful Basis:**
- Processing job listing data: Legitimate interest (publicly available)
- Processing candidate preferences: Consent (candidate sets up and controls the system)
- Processing email alerts: Consent (candidate configures email forwarding)

**Data Minimization:**
- Only store job listing data relevant to the search
- Truncate descriptions to 5000 characters
- Do not store full email bodies; extract only job data and discard
- Do not scrape or store personal data about employers or recruiters beyond company name

**Data Retention:**
- Active job listings: Keep while active, expire after 30 days or closing date
- Expired/duplicate listings: Archive after 90 days, delete after 180 days
- Candidate feedback: Retain for system improvement, delete on request
- Email parsing: Process and discard; do not store raw emails
- Scoring data: Retain for tuning, anonymize after 90 days

**Subject Access Rights:**
- Candidate has full access to all data through the database
- Candidate can request deletion of all data at any time
- No third-party data subjects (we do not store recruiter personal data)

### 14.2 Terms of Service Compliance

| Source | ToS Compliance | Risk Level | Mitigation |
|--------|---------------|------------|------------|
| Adzuna API | Compliant -- using official API within rate limits | Low | Stay within 250 req/day |
| Reed API | Compliant -- using official API within rate limits | Low | Stay within 1000 req/day |
| Jooble API | Compliant -- using official API | Low | No documented limits |
| jobs.ac.uk RSS | Compliant -- public RSS feed | Low | Standard RSS consumption |
| Guardian Jobs RSS | Compliant -- public RSS feed | Low | Standard RSS consumption |
| CV-Library RSS | Compliant -- public RSS feed | Low | Standard RSS consumption |
| Civil Service Jobs RSS | Compliant -- public government data | Low | Respect rate limits |
| LinkedIn (email) | Compliant -- parsing personal emails, not scraping | Low | Do not scrape linkedin.com |
| Indeed (email) | Compliant -- parsing personal emails | Low | Do not scrape indeed.com |
| TotalJobs (email) | Compliant -- parsing personal emails | Low | Do not scrape totaljobs.com |
| CIPD (Firecrawl) | Medium risk -- no public API | Medium | Respect robots.txt, low frequency, identify crawler |
| TrainingZone (Firecrawl) | Medium risk -- no public API | Medium | Respect robots.txt, low frequency |
| Personnel Today (Firecrawl) | Medium risk -- no public API | Medium | Respect robots.txt, low frequency |
| University pages (Firecrawl) | Low-Medium risk -- public content | Low-Medium | Low frequency, respect robots.txt |
| SerpAPI (Google Jobs) | Compliant -- using official API | Low | Stay within plan limits |

### 14.3 Ethical Scraping Guidelines

For Firecrawl-based sources:
1. Always check and respect `robots.txt` before scraping
2. Set a reasonable User-Agent string identifying the scraper
3. Limit scraping to every 6 hours minimum per target
4. Do not overwhelm sites with parallel requests
5. If a site returns 403 or CAPTCHA, stop scraping and investigate
6. Prefer APIs and RSS feeds over scraping wherever possible
7. Do not circumvent any anti-scraping measures

### 14.4 Data Security

- All API keys stored in n8n credentials vault (encrypted at rest)
- Database connections use SSL
- No job data is shared with third parties
- LLM API calls send only job listing text (publicly available data)
- IMAP credentials stored in n8n credentials vault
- Firecrawl API key stored in n8n credentials vault

---

## 15. Rollout Plan

### 15.1 Phase 1: Free APIs + RSS (Week 1-2)

**Scope:**
- Set up Postgres database and run migrations
- Deploy WF1 (RSS Poller) with all RSS feeds
- Deploy WF2 (API Poller) with Adzuna, Reed, Jooble
- Deploy WF5 (AI Scoring) with Claude
- Deploy WF6 (Dedup & Cleanup)
- Deploy WF7 (Notification Dispatcher -- daily digest only)

**Success Criteria:**
- Discovering 50+ relevant jobs per week
- AI scoring working with <20% false positive rate in A/B tiers
- Deduplication reducing volume by 30%+
- Daily digest email delivered by 7:30 AM

**Estimated Cost:** GBP 0/month (free API tiers + existing infrastructure + Claude costs from existing account)

### 15.2 Phase 2: Email Alert Parsing (Week 3-4)

**Scope:**
- Set up dedicated Gmail account for job alerts
- Configure LinkedIn, Indeed, TotalJobs job alerts
- Deploy WF3 (Email Alert Parser)
- Add instant A-tier notifications
- Add weekly summary email

**Success Criteria:**
- Email parsing extracting 90%+ of jobs from alerts
- Cross-source dedup correctly handling LinkedIn/Indeed duplicates
- Instant alerts working for A-tier discoveries

**Estimated Cost:** GBP 0/month additional

### 15.3 Phase 3: Firecrawl for Niche Sites (Week 5-6)

**Scope:**
- Deploy WF4 (Firecrawl Scraper)
- Configure CIPD, TrainingZone, Personnel Today targets
- Configure top 5 university career page targets
- Tune Firecrawl credit budget

**Success Criteria:**
- Discovering 5-10 unique jobs per week from niche sources
- Firecrawl credits staying within budget
- Parse success rate >80%

**Estimated Cost:** GBP 0/month (Firecrawl free tier) or GBP 19/month if free tier is insufficient

### 15.4 Phase 4: Google Jobs via SerpAPI (Week 7-8)

**Scope:**
- Sign up for SerpAPI ($50/month plan)
- Add SerpAPI queries to WF2 (API Poller)
- Tune to minimize duplicate discoveries
- Evaluate unique contribution vs. cost

**Success Criteria:**
- SerpAPI finding 10-15 unique jobs per week not discovered by other sources
- Unique contribution justifies $50/month cost
- If not: downgrade to $25/month plan or cancel

**Estimated Cost:** GBP 40-50/month

### 15.5 Timeline Summary

```
Week 1-2:  [Phase 1: APIs + RSS]         Cost: GBP 0/mo
Week 3-4:  [Phase 2: Email Parsing]       Cost: GBP 0/mo
Week 5-6:  [Phase 3: Firecrawl]           Cost: GBP 0-19/mo
Week 7-8:  [Phase 4: SerpAPI]             Cost: GBP 40-50/mo
Week 9+:   [Tuning & Optimization]        Cost: GBP 40-70/mo total
```

### 15.6 Post-Launch Optimization

After all phases are live:
1. Analyze source contribution metrics -- which sources find unique jobs?
2. Drop or reduce polling for low-value sources
3. Tune LLM scoring prompt based on candidate feedback
4. Adjust search terms based on discovered patterns
5. Consider adding Glassdoor, WorkinStartups, CharityJob if gaps identified

---

## 16. 50-Round Critical Roleplay Evaluation

### Persona 1: Job Seeker (Selvi) -- 10 Rounds

---

#### Round 1.1: First Impressions and Onboarding

**Concern:** When I first start using this system, how do I know it is working? I set up my alerts, configure my searches, and then... wait? What does the first day look like? The first week?

**Analysis:** The PRD describes a daily digest arriving at 7:30 AM, but there is no onboarding experience described. On Day 1, the database is empty. The first RSS poll happens, finds maybe 50-100 jobs across all feeds (including historical items in the RSS feeds), scores them all, and sends a digest the next morning. But the candidate does not know this is happening. There is no "system is alive and working" signal until the first digest arrives. If something is misconfigured, she would not know until 7:30 AM the next day when no email arrives -- and then she would not know whether "no email" means "no jobs found" or "system broken."

The system also requires Selvi to set up job alerts on LinkedIn, Indeed, and TotalJobs manually, create a dedicated Gmail account, and potentially configure search terms in a database table. This is technical work that is not well-specified.

**Score: 4/10**

**Recommendation:**
- Add a "system status" page or simple web dashboard showing: last poll time, jobs in pipeline, next digest time
- Add a "welcome" email when the system first runs successfully
- Add a "test mode" that processes one source and sends a sample digest immediately
- Create a setup guide covering Gmail account creation, alert configuration, and initial search term seeding
- Send a "no new jobs today" email on days with zero discoveries, so silence is never ambiguous

---

#### Round 1.2: Daily Digest Quality

**Concern:** The daily digest could quickly become overwhelming or useless. If I get 15 A-tier jobs and 30 B-tier jobs in one digest, that is 45 listings to review before my morning coffee. If I get 2 A-tier jobs that are both recruitment agency roles with anonymized companies, that is frustrating. How do I efficiently triage?

**Analysis:** The digest format described is a flat list ordered by tier then score. For 45+ jobs, this becomes a wall of text. There is no grouping by sector (corporate vs. academic), no grouping by location, no way to quickly skip categories I have already reviewed. The format also does not indicate whether a role is from a direct employer or a recruitment agency, which matters because agency roles often have less information and may be duplicates of direct postings.

Additionally, the digest goes to email. Email is not a great medium for reviewing 45 job listings with associated scores, rationales, and URLs. It works for 5-10 items. Beyond that, a web-based dashboard would be more effective.

**Score: 5/10**

**Recommendation:**
- Group digest jobs by category: "Corporate L&D", "Academic", "Other/Adjacent"
- Within each group, sort by score descending
- Add a "Quick Summary" section at the top: "3 A-tier corporate roles, 2 A-tier academic roles, 12 B-tier total"
- Flag direct employer vs. agency postings
- Consider building a simple web dashboard (even a basic n8n form or Retool app) for browsing scored jobs
- Limit digest to top 20 items; link to dashboard for full list

---

#### Round 1.3: Missed Relevant Jobs (False Negatives)

**Concern:** My biggest fear is missing a job I should have seen. The system claims 95% coverage, but how would I ever know about the 5% that was missed? And what about jobs that were found but scored as D-tier and filtered out when they should have been B-tier?

**Analysis:** The false negative problem has two dimensions:

1. **Discovery false negatives:** Jobs that exist on one of the monitored sources but were not found because the search terms did not match. For example, a role titled "Head of People & Culture" with L&D responsibilities but no L&D keywords in the title. Or a university role titled "Programme Director - Executive Education" that is essentially a senior teaching role.

2. **Scoring false negatives:** Jobs that were discovered but scored D-tier incorrectly. The LLM might misjudge a role's relevance due to an unusual title, missing salary information, or a short description that does not contain enough signals.

The PRD mentions a weekly manual audit against direct board searches, but this audit is itself a manual process that the system was supposed to eliminate. And the feedback loop (US-008) only works if the candidate sees the incorrectly scored jobs in the first place.

**Score: 5/10**

**Recommendation:**
- Add a "D-tier review" section to the weekly summary: show 10 random D-tier jobs for spot-checking
- Add a "borderline" notification for jobs scored 30-40 (just below C-tier) with unusual characteristics
- Expand search terms to include adjacent titles: "Head of People", "Culture Lead", "Programme Director", "Course Director", "Head of Academy"
- Run periodic "wide net" searches with very broad terms (just "L&D" or "learning") to catch unusual titles, then rely on scoring to filter
- Allow Selvi to add new search terms from the daily digest ("I keep seeing roles titled X -- add this as a search term")

---

#### Round 1.4: Application Tracking Integration

**Concern:** The system finds jobs and tells me about them. But then what? I still need to track which ones I have applied to, which ones I am waiting to hear back from, and which ones I have been rejected from. If the same job keeps appearing in my digest because I applied but did not tell the system, that is noise.

**Analysis:** The PRD describes a `status` field on jobs with values including 'applied', but there is no mechanism for Selvi to update this status. There is no application tracking interface. The system discovers and scores -- it does not help with the downstream workflow.

For someone applying to 5-10 roles per week, tracking status is manageable in a spreadsheet. But the discovery system and the tracking system should be connected so that:
- Applied jobs are removed from future digests
- Rejected jobs are noted for pattern analysis ("which companies reject me -- is there a pattern?")
- Pipeline visibility exists: X discovered -> Y applied -> Z interviewed -> W offered

**Score: 4/10**

**Recommendation:**
- Add a mechanism for Selvi to mark jobs as "applied", "rejected", "interviewing" -- either via email reply commands, a simple web form, or a Notion/Airtable integration
- Remove applied/rejected jobs from future digests
- Add application pipeline stats to the weekly summary
- Consider integrating with a simple Kanban board (Trello, Notion) for visual tracking
- This is out of scope for Module 1 but should be flagged as a Module 2 requirement with a clean interface between the two

---

#### Round 1.5: Salary Intelligence

**Concern:** Many jobs do not list salaries. In the UK, salary transparency is improving but still patchy, especially for senior roles. If 40% of B-tier jobs show no salary, I am spending time reading descriptions and potentially applying for roles that pay GBP 45,000 -- well below my target.

**Analysis:** The scoring engine gives a neutral score of 7/10 for unknown salaries, which is appropriate (do not penalize). But the candidate still needs to evaluate these roles somehow. The system could help by:
- Cross-referencing the company + title against salary data from Glassdoor, Payscale, or Adzuna's salary predictions
- Noting when a similar title at the same company or similar companies has a known salary range
- Flagging when the role description contains salary-suppressing language ("competitive salary", "market rate") which often indicates lower-than-expected compensation

The Adzuna API provides predicted salaries (`salary_is_predicted` field) which could be leveraged even when the employer has not listed one.

**Score: 6/10**

**Recommendation:**
- When salary is not listed, include Adzuna's predicted salary if available (clearly labeled as "estimated")
- Add salary context to the digest: "Similar roles in this area typically pay GBP X-Y"
- Flag "competitive salary" language as a potential concern in scoring rationale
- Track salary data across discovered jobs to build internal salary benchmarks over time
- For academic roles, always show the corresponding pay grade (e.g., "Grade 7: GBP 38,205-44,263") since this is publicly available information

---

#### Round 1.6: Timing and Urgency

**Concern:** The daily digest arrives at 7:30 AM, but some A-tier jobs were discovered at 2 PM the previous day. That is 17.5 hours between discovery and notification. The PRD mentions instant A-tier alerts, but how instant is "instant"? If the scoring pipeline runs hourly, and the API poller runs every 3 hours, the actual delay from posting to notification could be 4+ hours for API sources and 2+ hours for RSS sources, on top of the inherent delay in the source itself listing the role.

**Analysis:** Let's trace the worst-case timeline:

1. Employer posts role at 9:00 AM
2. Adzuna indexes it by 12:00 PM (3-hour delay typical for aggregators)
3. Our API poller runs at 12:00 PM, finds it (lucky timing -- worst case is 3:00 PM)
4. AI scoring runs at 1:00 PM (next hourly cycle)
5. Scored as A-tier at 1:05 PM
6. Instant alert sent at 1:05 PM

Best case: ~4 hours. Worst case: ~8 hours. For email-parsed sources (LinkedIn alerts), the delay could be 24+ hours since LinkedIn batches alerts daily.

This is acceptable for most roles (which stay open for 2-4 weeks) but suboptimal for highly competitive roles (LinkedIn Easy Apply) where 200+ applicants may apply in the first 48 hours.

**Score: 6/10**

**Recommendation:**
- Increase API polling frequency for priority 1 search terms to every 2 hours
- Run scoring pipeline every 30 minutes instead of hourly
- For A-tier scores, send notification within the scoring workflow itself (already described in WF5) -- confirm this is implemented correctly
- Add a "time since posted" indicator to notifications so Selvi can prioritize recent postings
- Consider adding LinkedIn's "Easy Apply" detection (from email alerts) as a priority flag

---

#### Round 1.7: Academic Job Market Quirks

**Concern:** Academic hiring in the UK works differently from corporate hiring. Positions are posted months before the closing date. Interview panels are scheduled well in advance. The timeline from posting to start date can be 6-9 months. A job posted today with a closing date in May and a start date in September is perfectly normal in academia. Does the system account for this?

**Analysis:** The system expires jobs after 30 days if no explicit closing date is found, and uses the closing date if available. For academic roles, closing dates are almost always provided and are often 4-6 weeks out. This is handled correctly.

However, the 30-day TTL for unknown-expiry jobs is too aggressive for academic roles. A university Lecturer post might appear on jobs.ac.uk with a closing date of 6 weeks, but if the closing date parsing fails, the system would expire it after 30 days, potentially before the candidate sees it.

Academic roles also have different timing signals:
- "September start" in a March posting is normal
- "Immediate start" is unusual and might indicate a vacancy due to departure (smaller candidate pool -- good opportunity)
- "Fixed-term until August" might mean a maternity cover (worth considering but less attractive)

**Score: 6/10**

**Recommendation:**
- Extend default TTL for academic roles to 45 days
- Parse and surface closing dates prominently in academic job notifications
- Add "start date" extraction to the scoring prompt
- Flag "immediate start" academic roles as potentially higher priority
- Add "contract duration" extraction for fixed-term academic roles
- Note the academic hiring calendar in weekly summaries: "Peak academic posting season is January-March for September starts"

---

#### Round 1.8: Recruitment Agency Noise

**Concern:** A large percentage of UK L&D roles are advertised through recruitment agencies. The same role might appear 3-4 times from different agencies, each with a slightly different title and anonymized company name ("Leading Financial Services Company"). The dedup system handles exact matches and fuzzy matches, but agency duplicates with anonymized employers are the hardest to catch.

I also do not want to apply to the same role through two different agencies -- this is considered unprofessional in UK recruitment and can result in both applications being rejected.

**Analysis:** The dedup system has three layers, including AI-assisted agency duplicate detection. This is good in theory but untested. The challenge is that two listings like:

- "L&D Manager - Major Bank - Reading - GBP 75k" (via Agency A)
- "Learning & Development Lead - Leading Financial Services - Reading - GBP 70-80k" (via Agency B)

...might be the same role. The fuzzy matcher would catch the location overlap, and the AI scorer would flag it as a potential duplicate. But the final determination requires human judgment.

**Score: 5/10**

**Recommendation:**
- Add an "agency cluster" feature: when the AI flags potential agency duplicates, group them visually in the digest
- Show: "These 3 listings may be the same role: [Title A via Agency A], [Title B via Agency B], [Title C via Agency C]"
- Allow Selvi to confirm/reject agency clusters for training
- Track which agencies post in which locations to build pattern recognition
- Flag anonymized company names explicitly: "Company: [Anonymized by agency]"
- Consider building a simple "company fingerprint" using salary range + location + role level to group anonymized listings

---

#### Round 1.9: Emotional and Psychological Factors

**Concern:** Job searching is emotionally draining. Getting a daily email with 45 listings, most of which I will not apply to, creates a sense of being overwhelmed and behind. Getting zero A-tier matches for a week creates discouragement. Getting a stream of D-tier noise creates frustration with the system itself. How does the system manage the emotional experience, not just the data experience?

**Analysis:** The PRD is entirely functional -- it focuses on data, scoring, and delivery. It does not consider the psychological impact of the job search experience. This is a blind spot.

Key emotional factors:
- **Volume overwhelm:** Too many listings feels like a burden, not a help
- **Quality disappointment:** Low-quality matches erode trust in the system
- **Silence anxiety:** No matches for days feels like something is broken
- **Comparison fatigue:** Evaluating 10 similar-looking roles is mentally exhausting
- **Rejection accumulation:** Tracking applied-and-rejected roles can be demoralizing without context

**Score: 4/10**

**Recommendation:**
- Add a "confidence" indicator to the daily digest: "Today's matches are stronger than average / weaker than average"
- On zero-match days, send a brief reassurance email: "No new strong matches today. Your system monitored X sources and found Y new listings, but none scored above B-tier. This is normal -- the market fluctuates weekly."
- Include positive framing in weekly summaries: "You are monitoring X sources with Y search terms, covering approximately Z% of the advertised UK L&D and academic market"
- Limit daily digest to top 10-15 items. More than that creates overwhelm.
- Add a "highlight of the week" to weekly summaries -- the single best match found

---

#### Round 1.10: Long-Term Value and Adaptability

**Concern:** My job search could last 2 months or 12 months. Over time, my preferences will change. I might decide I am open to contract roles if the rate is right. I might realize that London is too far and narrow to Reading/Slough only. I might shift focus from corporate to academic (or the reverse) based on market conditions. Can the system adapt without needing technical intervention?

**Analysis:** The system stores search configs in the database, which allows modification without code changes. But there is no user interface for modifying these configs. The candidate would need to either edit database rows directly or ask a technical person to do it.

The scoring prompt is hardcoded in the n8n workflow. Changing scoring criteria (e.g., "I now want to include roles down to GBP 55k") requires editing the workflow. This is not self-service.

Over a 6-12 month search, the system should also learn from feedback. If the candidate consistently marks certain types of roles as "not relevant," the scoring should adapt. This feedback loop is described in the user stories (US-008) but not in the technical implementation.

**Score: 5/10**

**Recommendation:**
- Build a simple config interface (n8n form trigger, or a basic web page) for adjusting:
  - Active search terms (add/remove)
  - Location preferences (add/remove/change radius)
  - Salary range (adjust min/max)
  - Job type focus (corporate/academic/both slider)
  - Contract type preferences (permanent only / include contract / include part-time)
- Implement scoring feedback loop: analyze candidate_feedback data monthly and adjust scoring weights
- Add a "monthly review" prompt: email Selvi asking "Your search has been running for X weeks. Here is what we have learned: [stats]. Would you like to adjust any preferences?"
- Version the scoring prompt so changes are tracked

---

### Persona 1 Summary: Job Seeker (Selvi)

| Round | Topic | Score |
|-------|-------|-------|
| 1.1 | Onboarding | 4/10 |
| 1.2 | Digest Quality | 5/10 |
| 1.3 | False Negatives | 5/10 |
| 1.4 | Application Tracking | 4/10 |
| 1.5 | Salary Intelligence | 6/10 |
| 1.6 | Timing and Urgency | 6/10 |
| 1.7 | Academic Quirks | 6/10 |
| 1.8 | Agency Duplicates | 5/10 |
| 1.9 | Emotional Factors | 4/10 |
| 1.10 | Adaptability | 5/10 |
| **Average** | | **5.0/10** |

---

### Persona 2: Technical Architect -- 10 Rounds

---

#### Round 2.1: Single Point of Failure -- n8n

**Concern:** The entire system depends on a single n8n instance running on a single Hetzner server. If n8n crashes, all 7 workflows stop. If the server goes down, the entire pipeline stops. There is no redundancy.

**Analysis:** n8n is a workflow automation tool, not a mission-critical system designed for high availability. The self-hosted instance at n8n.deploy.apiloom.io runs on Dokploy, which provides basic container orchestration but not automatic failover. If the n8n container crashes:

- In-progress workflow executions are lost
- Cron triggers do not fire
- IMAP polling stops
- No notifications are sent

Recovery requires manual intervention: restart the container, check for corrupted state, potentially re-run missed polls.

However, this is a personal job search tool, not a production SaaS application. The blast radius of downtime is limited to one person missing some job listings for a few hours. The design is appropriate for the use case.

**Score: 7/10**

**Recommendation:**
- Configure Dokploy auto-restart for the n8n container (restart policy: always)
- Add an external uptime monitor (UptimeRobot free tier) pinging n8n.deploy.apiloom.io
- If downtime > 1 hour, send alert to admin email
- n8n stores workflow data in Postgres -- if the container restarts, workflows resume on next cron trigger
- Accept that brief downtime (< 2 hours) is acceptable for this use case
- Ensure n8n data (including credentials) is backed up -- Dokploy should handle volume persistence

---

#### Round 2.2: Database Schema Scalability

**Concern:** The `jobs` table will grow continuously. At 100+ jobs discovered per week, that is 5000+ rows per year. With the `job_sources`, `job_scores`, and `notification_log` tables also growing, and JSONB fields storing raw API responses, the database could become slow without proper maintenance.

**Analysis:** 5000 rows per year is nothing for Postgres. Even 50,000 rows is trivial. The schema is well-indexed with appropriate covering indexes for common query patterns. The `pg_trgm` extension for fuzzy matching is the most compute-intensive operation but is only used in the dedup workflow on a limited dataset (last 7 days).

Potential concerns:
- `raw_data JSONB` in `job_sources` could grow large if full API responses are stored. At ~2KB per response and 5000 sources/year, that is only 10MB/year.
- `system_metrics` table with per-metric-per-dimension rows could grow faster but is also trivially small.

The schema is well-designed for the scale. The only concern is the lack of a partitioning strategy for long-term growth, but this is premature optimization for years away.

**Score: 8/10**

**Recommendation:**
- Add a monthly archive process: move jobs older than 90 days with `status IN ('expired', 'duplicate', 'archived')` to a `jobs_archive` table
- Add VACUUM ANALYZE to a weekly maintenance cron job
- Monitor table sizes monthly via `pg_stat_user_tables`
- The current schema is appropriate for 3-5 years of operation without modification

---

#### Round 2.3: LLM API Reliability and Cost

**Concern:** The AI scoring pipeline depends on external LLM APIs (Claude, GPT-4o). These APIs have variable latency (2-30 seconds per call), occasional downtime, rate limits, and costs that can spike unexpectedly if scoring volume increases.

**Analysis:** The design handles LLM reliability reasonably well:
- Retry logic with fallback to GPT-4o-mini
- Rule-based fallback as last resort
- Cost tracking per scored job
- Budget safeguard of 200 scoring calls/day

Cost analysis:
- Claude 3.5 Sonnet: ~$3/MTok input, ~$15/MTok output
- Per job: ~1500 input tokens + ~300 output tokens = ~$0.009 per job
- At 100 jobs/day: ~$0.90/day = ~$27/month
- At 150 jobs/day: ~$40/month

This is reasonable but not trivial. The bigger concern is latency: scoring 50 jobs in a single hourly run means 50 sequential API calls at 5-10 seconds each = 4-8 minutes per scoring run. This blocks the workflow.

**Score: 7/10**

**Recommendation:**
- Process scoring in parallel batches of 5 (the current design mentions batch size of 5 in WF5, which is correct)
- Consider batching multiple jobs into a single LLM call: send 5 jobs in one prompt, get 5 scores back. This reduces API calls by 5x and latency proportionally.
- Set a monthly cost alert: if LLM spending exceeds GBP 50/month, switch to rule-based scoring for C/D-tier candidates and only use LLM for A/B-tier candidates
- Monitor LLM accuracy over time: compare LLM scores to candidate feedback to detect drift
- Cache scoring results: if a job is seen from multiple sources, do not re-score it

---

#### Round 2.4: Email Parsing Fragility

**Concern:** Parsing HTML emails from LinkedIn, Indeed, and TotalJobs is inherently fragile. These companies change their email templates without notice, frequently. The CSS selectors and regex patterns used to extract job data will break, possibly silently.

**Analysis:** This is the highest-risk data source from a reliability perspective. When LinkedIn changes their email HTML structure:
1. The parser extracts zero jobs from the email
2. The email is still marked as read (so it will not be reprocessed)
3. No error is thrown (the parser just finds no matches)
4. The job data from that email is permanently lost

This is a silent failure mode that could go unnoticed for days or weeks, especially if the system is getting enough jobs from other sources that the digest still looks full.

**Score: 4/10**

**Recommendation:**
- Do NOT mark emails as read if zero jobs are extracted. Instead, flag them for manual review.
- Add a "parse success rate" metric per email source. If the rate drops below 50%, trigger an alert.
- Store the raw email HTML in a backup location before parsing, so failed parses can be retried after fixing the parser.
- Consider using a more robust email parsing approach: instead of CSS selectors, use an LLM to extract job data from the email HTML. This is more expensive but more resilient to template changes.
- Add email source health to the weekly summary: "LinkedIn alerts: 5 emails received, 45 jobs extracted (9 per email average)"
- Accept that email parsing will require periodic maintenance. Budget 1-2 hours per month for parser updates.

---

#### Round 2.5: n8n Workflow Complexity

**Concern:** Seven workflows with complex branching, error handling, database operations, and inter-workflow dependencies. n8n is powerful but workflows can become hard to debug, test, and maintain at this complexity level. There is no unit testing framework for n8n workflows.

**Analysis:** Each workflow is self-contained and communicates through the database, which is a good architectural decision. However:

- The Code nodes (JavaScript) contain complex parsing logic that cannot be unit tested outside n8n
- n8n's built-in error handling is limited: you can catch errors per node but not test edge cases
- Debugging requires examining execution logs in the n8n UI
- There is no staging environment -- all workflows run against the production database

The total JavaScript code across all workflows is probably 500-1000 lines, handling normalization, parsing, dedup hashing, and scoring prompt construction. This code is the most likely source of bugs.

**Score: 5/10**

**Recommendation:**
- Extract complex parsing logic into standalone JavaScript files that can be tested independently
- Create a `test_data` folder with sample API responses, RSS items, and email HTML for each source
- Build a simple test workflow in n8n that processes sample data through the normalization pipeline and verifies output
- Use n8n's "manual trigger" feature to test each workflow with known inputs before enabling cron triggers
- Add a `dry_run` mode to each workflow that processes data but does not write to the database
- Consider using n8n's sub-workflow feature to modularize common logic (normalization, dedup checking)

---

#### Round 2.6: Firecrawl Credit Management

**Concern:** The Firecrawl free tier provides 500 credits/month. The PRD estimates ~15 scrapes/day for niche boards and ~30/day for university pages, totaling ~1350 scrapes/month. This exceeds the free tier by nearly 3x.

**Analysis:** The math does not work on the free tier:

- CIPD / People Management: 3 URLs * 4 scrapes/day = 12/day = 360/month
- TrainingZone: 2 URLs * 4 scrapes/day = 8/day = 240/month
- Personnel Today: 3 URLs * 4 scrapes/day = 12/day = 360/month
- University pages (top 5): 5 URLs * 2 scrapes/day = 10/day = 300/month
- Total: ~42/day = ~1260/month

Even the "every 6 hours" schedule in the PRD implies 4 scrapes per URL per day, which is too aggressive.

The PRD notes this problem and suggests rotating university scrapes weekly, but the calculation still does not balance.

**Score: 4/10**

**Recommendation:**
- Reduce scrape frequency to every 12 hours for niche boards: 3+2+3 = 8 URLs * 2/day = 16/day = 480/month (just within free tier)
- Scrape university career pages only weekly (most academic postings appear on jobs.ac.uk within 24 hours anyway)
- Prioritize: CIPD/People Management (most relevant) > Personnel Today > TrainingZone
- Monitor unique job discovery per scrape. If a target consistently returns zero new jobs, reduce its frequency or disable it.
- If the free tier is insufficient, Firecrawl Hobby plan is $19/month for 3000 credits -- reasonable.
- Add credit tracking to the system: before each scrape, check remaining credits and skip low-priority targets if budget is tight.

---

#### Round 2.7: Data Normalization Consistency

**Concern:** Each data source returns data in a different format, and the normalization code is duplicated across 4 workflows (one per source type). If the normalization logic changes (e.g., a new location standardization rule), it needs to be updated in 4 places.

**Analysis:** The normalization requirements include:
- Location standardization (15+ rules)
- Salary parsing (4+ regex patterns for different formats)
- Company name cleaning (remove Ltd, PLC, etc.)
- Dedup hash computation
- Date parsing (ISO 8601, RFC 2822, relative timestamps)

This logic is replicated in Code nodes across WF1, WF2, WF3, and WF4. Inconsistencies between workflows would cause dedup failures (same job, different hash because of different normalization).

**Score: 5/10**

**Recommendation:**
- Create a shared normalization module that all workflows import. n8n supports this via:
  - External npm packages (publish normalization as a private npm package)
  - n8n's "Sub-Workflow" feature for common operations
  - A shared Code node that is referenced by all workflows
- At minimum, extract the dedup hash computation into a single function definition used everywhere
- Write explicit test cases for normalization: "University of Reading" and "Uni of Reading" and "The University of Reading" should all normalize to the same value
- Log normalization decisions for debugging: "Location 'Reading, Berkshire, England' normalized to 'Reading'"

---

#### Round 2.8: Webhook Security

**Concern:** WF5 (AI Scoring Pipeline) has a webhook trigger for on-demand scoring. Webhooks are publicly accessible URLs. Anyone who discovers the webhook URL could trigger mass scoring, consuming LLM credits and potentially disrupting the pipeline.

**Analysis:** n8n webhook URLs are predictable if someone knows the instance URL and workflow ID. There is no built-in authentication on n8n webhooks unless configured. This is a minor security concern for a personal tool but could lead to unexpected LLM costs if discovered.

**Score: 7/10**

**Recommendation:**
- Add webhook authentication: require a secret header or query parameter
- n8n supports this via: Header Auth, Query Auth, or custom validation in a Code node
- Rate-limit the webhook: max 5 trigger attempts per hour
- Consider removing the webhook trigger entirely and relying only on the cron trigger (every hour is fast enough)
- If webhook is needed (e.g., for future dashboard integration), secure it with a random secret

---

#### Round 2.9: Monitoring and Observability

**Concern:** The system has 7 workflows running on different schedules. How does the administrator (you) know at a glance whether everything is working? n8n provides execution logs but you have to actively check them. The health check workflow (described in section 13.2) helps but runs only every 6 hours.

**Analysis:** The current observability story is:
- n8n execution logs (accessible via n8n UI)
- `source_health` table (queryable but no dashboard)
- `system_metrics` table (queryable but no dashboard)
- Email alerts for critical failures

What is missing:
- A single-pane dashboard showing system status
- Real-time alerting (the health check runs every 6 hours, so a 5-hour outage could go unnoticed)
- Historical trends (how many jobs per day this week vs. last week)

**Score: 5/10**

**Recommendation:**
- Build a simple status dashboard. Options:
  - n8n built-in "Dashboard" (limited)
  - A Grafana instance (heavy but powerful) reading from the `system_metrics` and `source_health` tables
  - A simple n8n workflow that generates a status page HTML and serves it via webhook
  - Retool or NocoDB for a quick low-code dashboard
- Increase health check frequency to every 2 hours
- Add UptimeRobot (free tier) to ping the n8n instance externally
- Add a "system heartbeat" that writes to a file/endpoint every 30 minutes; if it stops, external monitor alerts

---

#### Round 2.10: Disaster Recovery

**Concern:** If the Hetzner server has a hardware failure and the disk is lost, what happens? Is there a backup strategy for the Postgres database, n8n workflows, and configuration?

**Analysis:** The PRD does not mention backups or disaster recovery at all. The components that need backup:

1. **Postgres database:** All job data, scores, configs, metrics. This is the most critical.
2. **n8n workflow definitions:** Stored in n8n's database (which is typically SQLite or Postgres). If using Postgres, it is backed up with the main DB.
3. **n8n credentials:** API keys, IMAP passwords. Stored encrypted in n8n's database.
4. **Configuration:** Search configs, RSS feed configs, Firecrawl targets. All in Postgres.

If the server is lost, everything is lost. Recovery would require rebuilding from scratch.

**Score: 3/10**

**Recommendation:**
- Set up automated daily Postgres backups using `pg_dump` to an external location (S3, another server, or even a local machine)
- Export n8n workflows as JSON (n8n supports this) and store in a git repository
- Document all API keys and credentials in a secure location (1Password, Bitwarden)
- Create a recovery runbook: step-by-step instructions to rebuild the system on a new server
- Test the recovery process once before going live
- Consider Dokploy's built-in backup features if available
- Backup frequency: daily for Postgres, weekly for n8n workflow exports
- Retention: 7 daily backups, 4 weekly backups

---

### Persona 2 Summary: Technical Architect

| Round | Topic | Score |
|-------|-------|-------|
| 2.1 | Single Point of Failure | 7/10 |
| 2.2 | Database Scalability | 8/10 |
| 2.3 | LLM Cost/Reliability | 7/10 |
| 2.4 | Email Parsing Fragility | 4/10 |
| 2.5 | Workflow Complexity | 5/10 |
| 2.6 | Firecrawl Credits | 4/10 |
| 2.7 | Normalization Consistency | 5/10 |
| 2.8 | Webhook Security | 7/10 |
| 2.9 | Monitoring | 5/10 |
| 2.10 | Disaster Recovery | 3/10 |
| **Average** | | **5.5/10** |

---

### Persona 3: UK HR/L&D Recruitment Expert -- 10 Rounds

---

#### Round 3.1: Job Title Coverage Gaps

**Concern:** The search terms list is comprehensive for traditional L&D titles but misses several emerging and variant titles that UK employers use.

**Analysis:** Missing titles that appear frequently in the UK L&D market:

**Corporate gaps:**
- "Learning Experience Designer" / "Learning Experience Lead" -- growing title in progressive orgs
- "Chief Learning Officer" (CLO) -- aspirational but worth monitoring
- "Head of Academy" / "Academy Director" -- corporates running internal academies
- "Capability Lead" / "Capability Manager" -- common in consulting and financial services
- "Knowledge Manager" / "Knowledge Management Lead" -- adjacent role, often includes L&D
- "Performance Consultant" -- Deloitte/PwC-style title for L&D consultants
- "Organisational Effectiveness" -- increasingly replacing "OD" in some organizations
- "People Partner" with L&D focus -- HR Business Partner variant
- "Apprenticeship Manager" -- large employers with levy-funded programmes
- "Early Careers Manager" -- graduate/trainee programme management

**Academic gaps:**
- "Principal Lecturer" -- between Senior Lecturer and Professor in some universities
- "Reader" -- equivalent to Associate Professor in some UK universities
- "Module Leader" -- often a hiring criteria rather than a job title
- "Academic Practice Lead" -- teaching-focused leadership role
- "Director of Studies" -- programme management in some universities

**Score: 5/10**

**Recommendation:**
- Add all missing titles above to the search_configs table
- Group into priority tiers:
  - Priority 1 (add immediately): Learning Experience Lead, Head of Academy, Capability Lead, Principal Lecturer
  - Priority 2 (add in Phase 2): CLO, Knowledge Manager, Performance Consultant, Reader
  - Priority 3 (add if gaps detected): Apprenticeship Manager, Early Careers Manager, Academic Practice Lead
- Run a quarterly "title audit" comparing discovered titles against the search term list to identify new patterns

---

#### Round 3.2: Salary Range Accuracy

**Concern:** The target salary range of GBP 70,000-80,000 for corporate roles is at the higher end for L&D Manager positions outside London. In the Thames Valley/Berkshire area, L&D Manager roles typically range GBP 55,000-75,000. Head of L&D roles are GBP 75,000-100,000+. The stated target may filter out the majority of Manager-level roles.

**Analysis:** UK salary data from various sources suggests:

- **L&D Manager (Thames Valley):** GBP 50,000-70,000 typical
- **L&D Manager (London):** GBP 60,000-80,000 typical
- **Head of L&D (Thames Valley):** GBP 70,000-90,000
- **Head of L&D (London):** GBP 80,000-120,000
- **L&D Director:** GBP 90,000-140,000
- **L&D Business Partner:** GBP 55,000-70,000
- **Senior Lecturer (UK university):** GBP 48,000-58,000 (Grade 8-9)
- **Lecturer (UK university):** GBP 38,000-48,000 (Grade 7-8)

The scoring engine uses GBP 55,000-90,000 as the API filter range (broader than the stated GBP 70-80k target), which is sensible. But the scoring prompt tells the LLM that the target is GBP 70-80k, which would penalize GBP 60-70k Manager roles that are perfectly viable.

**Score: 5/10**

**Recommendation:**
- Adjust the scoring prompt to reflect realistic market rates:
  - L&D Manager: target GBP 55,000-75,000 (outside London), GBP 65,000-85,000 (London)
  - Head of L&D: target GBP 75,000-100,000
  - L&D Director: target GBP 90,000+
  - Academic: use published pay scales, do not penalize
- Differentiate salary expectations by seniority, not as a flat range
- The API salary filter (GBP 55,000-90,000) is already appropriate -- keep it
- In the scoring prompt, instruct the LLM to consider the title + salary combination, not salary alone

---

#### Round 3.3: The Unadvertised Market

**Concern:** 40-70% of UK professional roles are filled without public advertising. The system only covers the advertised market. What about the hidden market?

**Analysis:** The hidden market includes:
- Roles filled through recruitment agencies on a retained/exclusive basis (never publicly listed)
- Internal promotions and transfers
- Referral hires (company posts internally, employee refers a contact)
- Headhunter placements (executive search firms approach candidates directly)
- LinkedIn-only roles that are "Easy Apply" and filled within 48 hours

The system cannot directly access the hidden market. However, it can:
- Detect signals of hidden market activity (e.g., a company posting one L&D role might have others not yet advertised)
- Flag companies that are growing their L&D function (multiple hires in the same department)
- Identify recruiters who specialize in L&D roles (from agency postings)

**Score: 4/10**

**Recommendation:**
- Add a "company intelligence" feature: when a company appears in the job feed, track it. If the same company appears 3+ times for L&D-related roles, flag it as "growing L&D function -- consider proactive outreach"
- Build a list of L&D-specialist recruitment agencies from agency postings. These agencies likely have unlisted roles too. Consider reaching out directly.
- Monitor LinkedIn for company growth signals (this is beyond the system's scope but worth noting as a manual process)
- The system should acknowledge its limitation: it covers the advertised market well but not the hidden market. The weekly summary should include a "hidden market" reminder: "This system covers advertised roles. For the unadvertised market, consider: networking events, LinkedIn outreach, direct company approaches."
- Consider adding CIPD events, L&D Connect events, and similar networking opportunities to the discovery feed

---

#### Round 3.4: CIPD Qualification and Equivalency

**Concern:** Many UK L&D roles state "CIPD Level 7 required" or "CIPD qualified essential." The candidate has a PhD + MBA but is not CIPD-qualified. How does the system handle this?

**Analysis:** The scoring engine detects `cipd_required` in job descriptions and flags it. This is good for awareness. However, the nuance is:

1. "CIPD Level 7 essential" -- hard requirement, candidate would need to explain academic equivalence
2. "CIPD qualified or equivalent" -- candidate's PhD + MBA likely qualifies
3. "Working towards CIPD" -- implies the employer is flexible
4. "CIPD desirable but not essential" -- non-issue

The candidate's PhD in Management and MBA in HR are widely considered CIPD-equivalent, especially at the Level 7 (strategic) tier. Most employers accept this, but some (especially public sector) have rigid criteria.

The scoring engine should differentiate between these levels of CIPD requirement, not just flag "CIPD mentioned."

**Score: 6/10**

**Recommendation:**
- In the LLM scoring prompt, add specific guidance:
  ```
  CIPD Requirement Handling:
  - "CIPD Level 7 essential/required": Flag but do NOT penalize heavily (candidate has PhD+MBA equivalent)
  - "CIPD or equivalent": Fully relevant -- candidate qualifies
  - "Working towards CIPD": Fully relevant
  - "CIPD desirable": Fully relevant
  - "Must be Chartered CIPD member": Flag as a potential barrier -- Chartered status requires CIPD membership
  ```
- Add `cipd_requirement_level` to scoring output: 'essential', 'equivalent_accepted', 'desirable', 'not_mentioned'
- In digest emails, show CIPD requirement level prominently so the candidate can decide whether to pursue

---

#### Round 3.5: Sector-Specific Job Boards

**Concern:** The system covers general job boards and HR-specific boards, but misses sector-specific boards that carry L&D roles within their sectors.

**Analysis:** L&D roles exist in every sector, and some sectors have their own job boards:

- **NHS Jobs** (https://www.jobs.nhs.uk/) -- The NHS is one of the largest employers of L&D professionals in the UK. NHS Jobs is the mandatory posting platform for all NHS roles.
- **CharityJob** (https://www.charityjob.co.uk/) -- Large charities (British Red Cross, Oxfam, Save the Children) have significant L&D teams
- **Local Government Jobs** (https://www.localgovernmentjobs.com/) -- Council L&D teams
- **Tes** (https://www.tes.com/jobs/) -- Education sector, overlaps with academic roles
- **ThinkHE Jobs** / **wonkhe.com/jobs** -- Higher education sector
- **University Jobs** portal
- **MindTools / Emerald Works** job listings -- L&D industry employers

**Score: 4/10**

**Recommendation:**
- Add NHS Jobs as a critical source (Phase 2):
  - NHS Jobs has an RSS feed: `https://www.jobs.nhs.uk/rss`
  - Search for: "Learning Development", "Organisational Development", "Talent Development"
  - NHS Agenda for Change Band 8a-8d maps to the target salary range
- Add CharityJob RSS feed (free): search for L&D roles in the charity sector
- Add Tes.com for academic-adjacent roles
- Prioritize: NHS Jobs (high -- NHS is a huge L&D employer) > CharityJob (medium) > Tes (medium) > LocalGov (low)
- These are all free sources (RSS or simple scraping) and should be in Phase 1 or 2

---

#### Round 3.6: Interview Preparation Intelligence

**Concern:** Discovering jobs is step 1. But knowing what questions to expect, what the company culture is like, and what the hiring process involves is equally important. The system collects job descriptions but does not extract this intelligence.

**Analysis:** Job descriptions often contain signals that help with application and interview preparation:
- "Competency-based interview" (prepare STAR examples)
- "Presentation as part of interview" (prepare a teaching session or L&D strategy presentation)
- "Assessment centre" (prepare group exercises)
- "2-stage interview process" (expect initial screen + panel)
- Company values mentioned in the JD (align application to these)

This is beyond the scope of Module 1 (Job Discovery) but is valuable context that could be extracted during scoring.

**Score: 7/10 (not a gap in Module 1's scope, but a missed opportunity)**

**Recommendation:**
- Add to the LLM scoring prompt: "Also extract any interview process details mentioned in the description"
- Store extracted interview details in a new field on `job_scores`
- Surface in the digest: "Interview Process: 2 stages, includes presentation"
- This enriches the discovery output without adding a new module

---

#### Round 3.7: Recruiter Market Intelligence

**Concern:** The system treats all discovered jobs equally, but there are patterns in the recruiter market that could improve effectiveness. Some agencies are better than others for L&D roles. Some employers are known for slow hiring processes. Some job postings are "ghost jobs" (posted to build a talent pipeline with no immediate vacancy).

**Analysis:** Ghost jobs are a growing problem in the UK market. Signs include:
- Same role posted repeatedly over months
- Very generic description
- No specific team or reporting line mentioned
- "Ongoing recruitment" or "pipeline" language

The system could detect ghost jobs by tracking repost patterns.

Recruiter quality varies significantly:
- Specialist L&D recruiters (e.g., Changeboard, Pure Human Resources) are more likely to have genuine, relevant roles
- Generalist agencies may post roles they do not have exclusive mandates for
- Some agencies are known for "bait and switch" -- advertising a senior role to attract CVs, then pushing candidates toward junior positions

**Score: 5/10**

**Recommendation:**
- Track repost frequency: if the same company + similar title appears 3+ times in 60 days, flag as potential ghost job
- Build an internal recruiter quality database over time based on candidate feedback
- In the scoring prompt, add: "Note if the description seems generic or lacks specific details about the team/role -- this may indicate a non-genuine listing"
- Add a `listing_quality` field to scoring output: 'specific', 'moderate', 'generic'

---

#### Round 3.8: UK Visa and Right-to-Work Considerations

**Concern:** The candidate does not need visa sponsorship. But some job listings are specifically tagged for visa sponsorship (Skilled Worker visa). How does the system handle this context?

**Analysis:** In the UK job market:
- Many jobs state "Must have the right to work in the UK" -- the candidate qualifies
- Some state "Visa sponsorship available" -- irrelevant to the candidate but not negative
- Some state "No visa sponsorship available" -- also fine for this candidate
- A few state "Must be a British/EU national" -- this is potentially discriminatory but appears occasionally in security-cleared roles

The scoring engine correctly treats visa sponsorship as informational rather than a filter. The candidate's immigration status is straightforward (settled status or right to work in the UK, no sponsorship needed), so this is a non-issue for filtering.

**Score: 8/10**

**Recommendation:**
- Keep current approach: detect and flag visa mentions but do not filter
- Add to the digest: "Right to work: [statement from listing]" only when relevant language is detected
- For roles explicitly requiring security clearance (SC, DV), flag as: "May require security clearance -- check eligibility"

---

#### Round 3.9: Networking and Professional Body Events

**Concern:** The system focuses on job listings but misses networking opportunities that are crucial for the hidden market. CIPD branch events, L&D Connect meetups, Henley Business School alumni events, and similar gatherings are where unadvertised roles surface in conversation.

**Analysis:** This is fundamentally outside Module 1's scope (Job Discovery focuses on advertised roles). However, the system could include a lightweight "events and networking" feed:

- CIPD events page (scrape or RSS)
- L&D Connect meetup schedule
- LinkedIn events for "Learning Development" in the Thames Valley
- eventbrite.co.uk for HR/L&D conferences

**Score: 6/10 (partial scope gap)**

**Recommendation:**
- Add a "Phase 5" to the rollout plan: "Networking & Events Discovery"
- Start with CIPD Thames Valley branch events (simple scrape)
- Include in the weekly summary: "Upcoming networking events in your area"
- This is low effort and high value for the hidden market problem

---

#### Round 3.10: Seasonal Patterns in UK Hiring

**Concern:** UK hiring follows seasonal patterns that the system should account for. September and January are peak academic hiring months. Corporate L&D budgets reset in April (financial year) and January (calendar year). Summer (July-August) and December are typically quiet periods.

**Analysis:** The system runs at constant frequency year-round. During quiet periods, this means:
- More "no new matches" days -- potentially discouraging
- Processing effort wasted on stale or low-quality listings
- Higher false positive rate (agencies repost old roles during quiet periods to maintain visibility)

During peak periods:
- Higher volume means more scoring costs
- More competitive application environment (mention in alerts?)
- Potential for A-tier jobs to be missed in the volume

**Score: 6/10**

**Recommendation:**
- Add seasonal context to the weekly summary: "This is typically a [busy/quiet] period for UK L&D hiring"
- During quiet periods (July-August, December), reduce polling frequency by 50% to save resources
- During peak periods (January-March, September-October), increase polling frequency and widen search terms
- Track weekly discovery volumes over time to build empirical seasonal patterns for the specific search criteria
- Adjust the "no new matches" email during quiet periods: "It is normal to see fewer matches in [month] -- the market typically picks up in [month]"

---

### Persona 3 Summary: UK HR/L&D Recruitment Expert

| Round | Topic | Score |
|-------|-------|-------|
| 3.1 | Job Title Gaps | 5/10 |
| 3.2 | Salary Range | 5/10 |
| 3.3 | Unadvertised Market | 4/10 |
| 3.4 | CIPD Requirements | 6/10 |
| 3.5 | Sector-Specific Boards | 4/10 |
| 3.6 | Interview Intelligence | 7/10 |
| 3.7 | Recruiter Quality | 5/10 |
| 3.8 | Visa Handling | 8/10 |
| 3.9 | Networking Events | 6/10 |
| 3.10 | Seasonal Patterns | 6/10 |
| **Average** | | **5.6/10** |

---

### Persona 4: Data Engineer / n8n Expert -- 10 Rounds

---

#### Round 4.1: n8n Memory and Performance

**Concern:** n8n workflows that process large datasets in memory can hit Node.js memory limits. WF2 (API Poller) runs 25+ search queries, each returning up to 100 results. That is potentially 2,500 job objects in memory simultaneously, each with a description field up to 5,000 characters.

**Analysis:** Memory calculation:
- 2,500 jobs * ~6KB average per job (with description) = ~15MB
- n8n default memory limit is typically 256MB-512MB per execution
- 15MB is well within limits

However, n8n's workflow execution model keeps all node outputs in memory until the workflow completes. If WF2 has a long chain of nodes (fetch -> normalize -> dedup check -> insert -> log -> next query), the accumulated data from all iterations can exceed memory.

The real concern is not individual payload size but the accumulation across loop iterations in n8n's SplitInBatches node.

**Score: 7/10**

**Recommendation:**
- Use n8n's `SplitInBatches` node with `batch_size: 1` for the outer search query loop (already specified)
- Process and write to database within each batch iteration, so accumulated data does not grow
- Use n8n's "Execute Workflow" node to run each source as a sub-workflow, providing memory isolation
- Monitor n8n memory usage via Dokploy container metrics
- If memory issues appear, set `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` to offload large payloads to disk

---

#### Round 4.2: Rate Limit Orchestration

**Concern:** Multiple search queries hitting the same API in rapid succession can trigger rate limits, especially for Adzuna (250 requests/day) and Reed (1,000 requests/day). The workflow needs to space requests intelligently.

**Analysis:** The PRD mentions a 2-second pause between search configs, which helps. But the calculation is:

Adzuna budget per poll:
- 6 polls/day * ~20 queries/poll = 120 requests/day (within 250 limit)
- But if a poll fails and retries, the count increases
- Three retries per failed request: worst case 120 * 3 = 360 (over limit)

Reed budget per poll:
- 6 polls/day * ~20 queries/poll = 120 requests/day (within 1,000 limit)
- Comfortable margin

Jooble:
- No documented limit, conservative 500/day budget
- 120 requests/day is well within

**Score: 6/10**

**Recommendation:**
- Implement a request counter per source per day, stored in Postgres:
  ```sql
  CREATE TABLE api_rate_limits (
    source VARCHAR(50) PRIMARY KEY,
    daily_limit INTEGER NOT NULL,
    requests_today INTEGER DEFAULT 0,
    last_reset_at DATE DEFAULT CURRENT_DATE
  );
  ```
- Before each API call, check the counter. If at 80% of limit, skip low-priority queries for this poll.
- Reset counters at midnight UTC.
- For Adzuna, set max retries to 1 (not 3) to conserve budget.
- Add a "rate limit headroom" metric to the health dashboard.

---

#### Round 4.3: Data Quality -- Salary Parsing

**Concern:** UK salary data comes in many formats across sources. Parsing salaries from free text is error-prone and critical for scoring accuracy.

**Analysis:** Examples of salary formats found in UK job listings:

```
"GBP 70,000 - GBP 80,000 per annum"
"£70k - £80k"
"£70,000 - £80,000 pa"
"70-80k"
"GBP 75,000"
"Competitive"
"c.GBP 75,000"
"Up to GBP 80,000"
"GBP 70,000 - GBP 80,000 pro rata" (part-time)
"GBP 350 - GBP 450 per day" (contract/day rate)
"Grade 7: GBP 38,205 - GBP 44,263" (Civil Service/Academic)
"Salary: Competitive, negotiable depending on experience"
"£70,000 + benefits"
"OTE £85,000 (base + bonus)"
"£65-75k DOE"
```

A simple regex will not handle all of these. The parsing needs to:
1. Detect currency (GBP, £, or implicit)
2. Detect range vs. single figure
3. Handle "k" abbreviation
4. Detect per annum vs. per day vs. pro rata
5. Handle "up to" (treat as max with no min)
6. Handle "competitive" / "negotiable" (treat as null)
7. Handle OTE / package figures (extract base, ignore bonus)
8. Handle Civil Service grades (map to salary ranges)

**Score: 4/10**

**Recommendation:**
- Build a comprehensive salary parser with test cases for all formats above
- Salary parser pseudocode:
  ```
  1. Normalize: replace "£" with "GBP", remove commas, lowercase
  2. Check for "competitive"/"negotiable"/"market rate" -> return null
  3. Check for daily rate: /(\d+)\s*(?:per day|\/day|p\.d\.)/i -> multiply by 220 for annual
  4. Check for "k" abbreviation: /(\d+)k/gi -> multiply by 1000
  5. Check for range: /(\d+)\s*(?:-|to)\s*(\d+)/ -> min, max
  6. Check for single figure: /(\d{4,6})/ -> min = max = figure
  7. Check for "up to": /up to\s*(\d+)/i -> min = null, max = figure
  8. Check for "pro rata": flag as part_time_salary = true
  9. Check for "OTE"/"package": attempt to extract base component
  10. Check for Civil Service grades: map to published ranges
  ```
- Store both `salary_raw` (original text) and parsed `salary_min`/`salary_max`
- Add a `salary_confidence` field: 'parsed', 'estimated', 'unknown'
- Log parse failures for review and parser improvement

---

#### Round 4.4: Dedup Hash Collision Risk

**Concern:** The dedup hash uses MD5 of `title|company|location`. MD5 has a known collision risk, and the normalization rules determine whether two genuinely different jobs hash to the same value.

**Analysis:** MD5 collision risk is negligible at the scale of this system (thousands of jobs, not billions). The real collision risk is from over-aggressive normalization:

Example 1: Two different roles at the same company
- "L&D Manager" at "Acme Corp" in "Reading" (corporate training)
- "L&D Manager" at "Acme Corp" in "Reading" (product training)
- Same hash, but genuinely different roles

Example 2: Same role at different branches
- "L&D Manager" at "Barclays" in "London" (Canary Wharf)
- "L&D Manager" at "Barclays" in "London" (City)
- Same hash because "London" is normalized as one location

Example 3: Sequential postings
- Company posts role, fills it, posts same role 3 months later
- Same hash, but it is a new vacancy

**Score: 6/10**

**Recommendation:**
- Add a TTL-based dedup window: jobs with the same hash are only considered duplicates if discovered within 14 days of each other
- Change the UNIQUE constraint from absolute to conditional:
  ```sql
  -- Remove: CONSTRAINT unique_dedup_hash UNIQUE (dedup_hash)
  -- Add: Partial unique index for recent jobs
  CREATE UNIQUE INDEX idx_jobs_dedup_recent ON jobs(dedup_hash)
    WHERE status = 'active' AND discovered_at > NOW() - INTERVAL '14 days';
  ```
- Add salary range to the dedup hash if available: `title|company|location|salary_range`
- For the "same company, different role" problem: include a truncated description hash (first 200 chars of description) as a secondary dedup check
- Log all dedup decisions for manual review during the first 2 weeks

---

#### Round 4.5: n8n Error Handling Patterns

**Concern:** n8n's error handling is node-level, not workflow-level. If a Code node throws an unhandled exception, the entire workflow execution fails. The PRD describes error handling conceptually but does not specify n8n's "Error Trigger" workflow pattern.

**Analysis:** n8n provides several error handling mechanisms:
1. **Node-level retry:** Configure retries on individual nodes (used for HTTP requests)
2. **Error branch:** Separate execution path when a node fails (available on most nodes)
3. **Error Trigger workflow:** A separate workflow triggered whenever any workflow fails
4. **Try/catch in Code nodes:** JavaScript try/catch blocks

The PRD describes error branches for specific nodes but does not mention:
- A global Error Trigger workflow for catching unexpected failures
- Structured error logging to a table
- Alerting on repeated failures of the same node

**Score: 5/10**

**Recommendation:**
- Create a "WF0: Error Handler" workflow triggered by n8n's Error Trigger
- This workflow should:
  1. Log the error to a `workflow_errors` table: workflow name, node name, error message, timestamp
  2. Send an email alert for critical errors
  3. Track error frequency per workflow and alert if error rate exceeds threshold
- In all Code nodes, wrap logic in try/catch:
  ```javascript
  try {
    // processing logic
  } catch (error) {
    return [{ json: { error: error.message, stack: error.stack, input: $input.first().json } }];
  }
  ```
- Add the error branch to every HTTP Request node, not just the ones explicitly mentioned
- Test each workflow with deliberately broken inputs to verify error handling works

---

#### Round 4.6: Data Freshness and Stale Jobs

**Concern:** RSS feeds often contain historical items. When the system first starts, or when an RSS feed URL changes, the feed may return 50+ items dating back weeks or months. These old jobs will all be ingested, scored, and potentially notified.

**Analysis:** On first run, the RSS Poller (WF1) will process all items currently in each RSS feed. RSS feeds typically contain the last 20-50 items, spanning 1-4 weeks. If the system does not filter by date, the first daily digest could contain 100+ jobs, most of which are already old.

Similarly, API queries with `max_days_old=3` will still return 3 days of results on each run. If the API poller runs 6 times per day, it will re-fetch the same 3-day window each time. The dedup hash prevents duplicate inserts, but the API bandwidth is wasted.

**Score: 6/10**

**Recommendation:**
- On first run, add a "bootstrap mode" flag that:
  - Ingests all discovered jobs
  - But only notifies jobs posted within the last 48 hours
  - Older jobs are scored and stored for baseline, not surfaced
- For RSS feeds: track the last-seen item GUID per feed. On subsequent polls, only process items newer than the last-seen GUID.
  - Store `last_seen_guid` in `rss_feed_configs`
- For API queries: reduce `max_days_old` from 3 to 1 for subsequent runs (only first run uses 3)
  - Store `last_successful_poll_at` and use it to set the time window
- Add a `is_first_run` check at the start of each source workflow

---

#### Round 4.7: Concurrent Workflow Execution

**Concern:** If a workflow execution takes longer than the cron interval (e.g., WF2 takes 4 hours but is scheduled every 3 hours), n8n will start a new execution while the previous one is still running. This can cause duplicate API calls, duplicate database inserts, and race conditions.

**Analysis:** n8n does not have built-in "skip if previous execution still running" logic. If WF2 (API Poller, every 3 hours) encounters slow API responses or a large number of search queries, execution could overlap.

Potential consequences:
- Double API requests (using 2x rate limit budget)
- Race condition on dedup hash check (both executions find the same job, both try to insert)
- The Postgres UNIQUE constraint on `dedup_hash` will prevent actual duplicate rows, but one insert will fail with a constraint violation error

**Score: 5/10**

**Recommendation:**
- Add a "workflow lock" mechanism:
  ```sql
  CREATE TABLE workflow_locks (
    workflow_name VARCHAR(100) PRIMARY KEY,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(200)  -- execution ID
  );
  ```
- At workflow start: `INSERT INTO workflow_locks ... ON CONFLICT DO NOTHING RETURNING *`
  - If insert succeeds: proceed with execution
  - If insert fails (lock exists): check if lock is stale (>2 hours old). If stale, take over. If fresh, skip execution.
- At workflow end: `DELETE FROM workflow_locks WHERE workflow_name = ...`
- Use `ON CONFLICT (dedup_hash) DO UPDATE SET last_seen_at = NOW()` for all job inserts (already specified) to handle race conditions gracefully

---

#### Round 4.8: n8n Credential Management

**Concern:** The system uses API keys for Adzuna, Reed, Jooble, Firecrawl, SerpAPI, Claude, and OpenAI, plus IMAP credentials and SMTP credentials. That is 8+ credential sets stored in n8n.

**Analysis:** n8n stores credentials encrypted in its database. This is acceptable for a personal tool but introduces risk if:
- The n8n instance is compromised
- The database backup is not encrypted
- Credentials are accidentally exposed in workflow exports (n8n sanitizes credentials in exports, but this should be verified)

n8n credential management is generally secure for self-hosted instances, as long as:
- The n8n UI is behind authentication
- The server is not publicly exposed
- Database connections use SSL

**Score: 7/10**

**Recommendation:**
- Verify n8n UI requires authentication (it should by default for self-hosted)
- Ensure the n8n instance is only accessible via HTTPS
- Do not store credentials in workflow JSON (use n8n's credential system exclusively)
- When exporting workflows for backup, verify credentials are not included
- Keep a separate, encrypted record of all API keys in a password manager
- Rotate API keys annually

---

#### Round 4.9: Data Pipeline Monitoring

**Concern:** Data quality issues can be subtle. A source might start returning jobs from a different location. A normalization bug might corrupt salary data. The LLM might start scoring inconsistently after a model update. How are these detected?

**Analysis:** The system tracks `source_health` and `system_metrics`, but these are operational metrics (is the source up? how many jobs found?). They do not cover data quality metrics:

- Are salaries being parsed correctly? (spot-check: do parsed values match raw text?)
- Are locations being normalized consistently? (are there new location strings appearing that do not match known locations?)
- Is the LLM scoring consistently? (is the tier distribution stable week-over-week?)
- Are descriptions complete? (is Firecrawl returning truncated content?)

**Score: 5/10**

**Recommendation:**
- Add data quality checks to WF6 (Dedup & Cleanup):
  ```sql
  -- Salary parsing quality
  SELECT COUNT(*) FILTER (WHERE salary_raw IS NOT NULL AND salary_min IS NULL) as unparsed_salaries
  FROM jobs WHERE discovered_at > NOW() - INTERVAL '24 hours';

  -- Location normalization quality
  SELECT location, COUNT(*) FROM jobs
  WHERE discovered_at > NOW() - INTERVAL '7 days' AND status = 'active'
  GROUP BY location ORDER BY COUNT(*) DESC;

  -- Scoring distribution
  SELECT tier, COUNT(*) FROM jobs
  WHERE scored = true AND discovered_at > NOW() - INTERVAL '7 days'
  GROUP BY tier;
  ```
- If unparsed salary rate > 30%, alert for parser review
- If a new location string appears with > 5 jobs, review normalization
- If tier distribution shifts dramatically (e.g., suddenly 80% D-tier), investigate LLM behavior
- Include data quality stats in the weekly summary

---

#### Round 4.10: Incremental Backfill and Reprocessing

**Concern:** When a bug is found and fixed in the normalization code, salary parser, or scoring prompt, how do we reprocess existing data? There is no backfill mechanism described.

**Analysis:** Scenarios requiring reprocessing:
1. Salary parser bug: incorrectly parsed salaries for the last week need recalculation
2. Scoring prompt improved: want to re-score all B-tier jobs with the new prompt
3. New search term added: want to check if any existing jobs match (they should be scored against the new criteria)
4. Dedup hash algorithm changed: need to recompute hashes for all active jobs

Without a reprocessing mechanism, the only option is manual SQL queries or creating ad-hoc n8n workflows.

**Score: 4/10**

**Recommendation:**
- Add a "Reprocessing" workflow (WF8) with a manual trigger and parameters:
  ```
  Input: { action: 'rescore' | 'reparse_salary' | 'recompute_hashes' | 'renotify', filter: { tier: 'B', date_range: '7d' } }
  ```
- For rescoring: set `scored = false` on matching jobs and let WF5 pick them up
- For salary reparsing: run the salary parser on `salary_raw` and update `salary_min`/`salary_max`
- For hash recomputation: recalculate hashes and re-run dedup
- Track reprocessing runs in `system_metrics` with the reason and affected row count
- Version the scoring prompt in a `scoring_prompt_versions` table so changes are auditable

---

### Persona 4 Summary: Data Engineer / n8n Expert

| Round | Topic | Score |
|-------|-------|-------|
| 4.1 | n8n Memory | 7/10 |
| 4.2 | Rate Limits | 6/10 |
| 4.3 | Salary Parsing | 4/10 |
| 4.4 | Dedup Collisions | 6/10 |
| 4.5 | Error Handling | 5/10 |
| 4.6 | Data Freshness | 6/10 |
| 4.7 | Concurrent Execution | 5/10 |
| 4.8 | Credential Management | 7/10 |
| 4.9 | Data Quality Monitoring | 5/10 |
| 4.10 | Reprocessing | 4/10 |
| **Average** | | **5.5/10** |

---

### Persona 5: Privacy & Compliance Officer -- 10 Rounds

---

#### Round 5.1: Scraping Legality Under UK Law

**Concern:** The Computer Misuse Act 1990 and subsequent amendments make it an offense to access computer systems without authorization. While scraping publicly available data is generally legal in the UK, the distinction between "public data" and "authorized access" depends on the website's terms of service and technical measures.

**Analysis:** The system uses three methods to access job data:
1. **Official APIs (Adzuna, Reed, Jooble, SerpAPI):** Fully authorized. API keys grant explicit access.
2. **Public RSS feeds:** Publicly available, no authentication required. Generally considered fair use.
3. **Firecrawl web scraping:** This is the gray area.

For Firecrawl scraping:
- CIPD/People Management Jobs, TrainingZone, Personnel Today -- these are job boards that want their listings to be found. They are not behind paywalls or login walls.
- However, their Terms of Service may prohibit automated scraping.
- UK case law (e.g., Ryanair v PR Aviation) suggests that scraping publicly available data is generally permissible, but violating ToS can create a contractual (not criminal) issue.

University career pages:
- Public content, intended to be accessed by potential applicants
- Low risk as long as scraping is gentle (infrequent, respects robots.txt)

**Score: 7/10**

**Recommendation:**
- Check robots.txt for each Firecrawl target before adding it. If robots.txt disallows scraping, do not scrape.
- Set a descriptive User-Agent in Firecrawl requests (e.g., "SelviJobBot/1.0 (personal job search)")
- Keep scraping frequency low (every 6-12 hours, not every hour)
- Do not scrape any page that requires login or is behind a paywall
- If any site explicitly contacts you about scraping, comply immediately and switch to manual checks
- Document the legal basis for each source in the `firecrawl_targets` table (add a `legal_basis` field)

---

#### Round 5.2: IMAP Email Parsing -- Privacy Implications

**Concern:** The system connects to a Gmail account via IMAP to parse job alert emails. This involves programmatic access to an email inbox, which has privacy implications.

**Analysis:** The email account is the candidate's own, created specifically for receiving job alerts. No third-party emails are being accessed. The system only processes emails from specific senders (LinkedIn, Indeed, TotalJobs).

However:
- Gmail's Terms of Service may restrict automated IMAP access for purposes other than "personal use"
- Google may block the IMAP connection if it detects unusual access patterns
- If the email account receives other emails (spam, newsletters), the system might accidentally process them

**Score: 7/10**

**Recommendation:**
- Use a dedicated email address exclusively for job alerts (already specified)
- Use Google App Password (not OAuth) for simplicity, but be aware Google may eventually restrict this
- Consider switching to Google API (Gmail API with OAuth2) for a more compliant access method
- Add strict sender filtering: ONLY process emails from the specific sender addresses listed
- Log all email processing: email ID, sender, subject, number of jobs extracted, timestamp
- Do not store email body content after processing -- extract job data and discard the email content
- Mark processed emails as read but do not delete them (candidate may want to review originals)

---

#### Round 5.3: LLM Data Exposure

**Concern:** Job descriptions are sent to external LLM APIs (Anthropic's Claude, OpenAI's GPT) for scoring. While job listings are publicly available, sending them to a third-party API raises questions about data handling.

**Analysis:** The data sent to LLMs is:
- Job title, company name, location, salary, description -- all publicly posted information
- The candidate's profile (embedded in the scoring prompt) -- personal preferences and career history

The candidate's profile in the prompt includes:
- PhD + MBA qualifications
- 18 years of experience
- Location (Maidenhead)
- Salary expectations

This is personal data under GDPR, sent to US-based companies (Anthropic, OpenAI).

**Score: 6/10**

**Recommendation:**
- Review Anthropic's and OpenAI's data retention policies:
  - Anthropic API: does not use API data for training (verify current policy)
  - OpenAI API: does not use API data for training when using the API (verify current policy)
- Consider anonymizing the candidate profile in the prompt:
  - Replace "Maidenhead" with "Thames Valley" (less specific)
  - Remove specific qualifications; describe as "senior L&D professional with doctoral-level education"
  - This reduces personal data exposure while maintaining scoring accuracy
- Add a privacy notice in the system documentation: "Job descriptions and anonymized candidate criteria are sent to AI APIs for scoring"
- Consider self-hosted LLM (Llama 3, Mistral) if data privacy is a concern -- but this requires significant compute resources
- Enable Anthropic's "zero retention" option if available for API usage

---

#### Round 5.4: Data Retention and Right to Erasure

**Concern:** Under GDPR Article 17, the candidate has the right to erasure of personal data. The system stores job preferences, feedback, search history, and scoring data that constitutes personal data.

**Analysis:** The system stores:
1. **Job listings:** Public data, not personal data. No GDPR issue.
2. **Candidate preferences (search_configs):** Personal data (reflects candidate's career interests and location).
3. **Candidate feedback (candidate_feedback):** Personal data (reflects opinions and decisions).
4. **Notification log:** Personal data (email address, what was sent when).
5. **LLM scoring context:** The scoring prompt contains personal data. If stored in `raw_llm_response`, this is personal data.

**Score: 6/10**

**Recommendation:**
- Create a "data erasure" SQL script that can delete all personal data:
  ```sql
  -- Delete all personal data
  DELETE FROM candidate_feedback;
  DELETE FROM notification_log;
  DELETE FROM job_scores;  -- Contains scoring prompts with personal data
  UPDATE search_configs SET enabled = false;
  -- Jobs table: not personal data, can remain
  ```
- Document the data erasure process
- Set retention periods:
  - Active job listings: 30 days after expiry
  - Expired/archived listings: 90 days then delete
  - Candidate feedback: retain while system is active, delete on erasure request
  - Notification log: 90 days retention
  - System metrics: 365 days retention (anonymized, no personal data)
- Implement automated retention enforcement in WF6 (add a "retention cleanup" branch)

---

#### Round 5.5: Adzuna and Reed API Terms of Service

**Concern:** API providers have terms of service that restrict what you can do with their data. Are we compliant with Adzuna's and Reed's terms?

**Analysis:**

**Adzuna API Terms (key points):**
- Data must not be stored for longer than 24 hours without refreshing
- Data must link back to Adzuna (include attribution)
- Data must not be used to create a competing job board
- Personal use / portfolio projects are generally allowed

**Reed API Terms (key points):**
- Results must link back to Reed
- Must not create a commercial job aggregation service
- Must display Reed attribution when showing results
- Personal / non-commercial use appears permitted

Both APIs are designed for integration and generally allow personal use. The key compliance requirements are attribution and freshness (not serving stale data as current).

**Score: 7/10**

**Recommendation:**
- Store attribution data: each job should record its original source
- In the digest email, include "Source: Adzuna" / "Source: Reed" with each listing
- The `url` field links back to the original listing -- ensure this is always present and correct
- The 30-day expiry rule handles the freshness requirement (Adzuna's 24-hour rule applies to serving data to third parties, not personal database storage)
- Do NOT make the job data accessible via a public-facing website or API (this would create compliance issues)
- Review API terms annually for changes

---

#### Round 5.6: LinkedIn Terms of Service Compliance

**Concern:** LinkedIn is aggressive about enforcing its Terms of Service against scraping and automated access. Even parsing email alerts could be seen as a gray area.

**Analysis:** The system does NOT scrape linkedin.com directly. It only processes LinkedIn job alert emails that are delivered to the candidate's own email inbox. This is analogous to a human reading their email and writing down the job details.

LinkedIn's ToS prohibits:
- Scraping linkedin.com
- Using automated tools to access LinkedIn's platform
- Creating databases from LinkedIn data

Parsing personal emails is not accessing LinkedIn's platform. The data in the email was delivered to the user by LinkedIn. The user is processing their own emails. This is compliant.

However, LinkedIn could argue that programmatic parsing of their emails violates the email's implied ToS (if any). This is extremely unlikely to be enforced but worth acknowledging.

**Score: 8/10**

**Recommendation:**
- Do NOT scrape linkedin.com under any circumstances
- Do NOT use LinkedIn's unofficial API or cookie-based access
- Email parsing is compliant -- continue as designed
- Do not redistribute LinkedIn-sourced job data (keep it within the personal system)
- If LinkedIn changes their alert emails to include anti-parsing measures (e.g., rendering jobs as images), accept the loss of this source gracefully

---

#### Round 5.7: Data Minimization and Purpose Limitation

**Concern:** GDPR principles require collecting only the minimum data necessary for the stated purpose, and using data only for the stated purpose.

**Analysis:** The system collects:
- Job listing data (title, company, location, salary, description, URL) -- necessary for discovery and scoring
- Source metadata (raw API response in JSONB) -- useful for debugging but potentially excessive
- Application count (from Reed) -- useful signal but not strictly necessary
- Candidate feedback -- necessary for system improvement

The `raw_data JSONB` field in `job_sources` stores the complete API response for each job. This may include data we do not use (e.g., Adzuna's geographic coordinates, Reed's employer ID, Indeed's sponsored flag). This is more than necessary.

**Score: 6/10**

**Recommendation:**
- Instead of storing the complete raw API response, extract and store only the fields we actually use
- Add a retention policy for `raw_data`: automatically null out after 14 days (useful for initial debugging, not needed long-term)
  ```sql
  UPDATE job_sources SET raw_data = NULL
  WHERE captured_at < NOW() - INTERVAL '14 days' AND raw_data IS NOT NULL;
  ```
- Document the purpose for each data field collected
- Do not collect or store data about other candidates, recruiters, or third parties (the system is inherently single-user, so this is naturally enforced)

---

#### Round 5.8: Cross-Border Data Transfer

**Concern:** Job data is processed on a Hetzner server in (presumably) Germany or Finland, scored by US-based AI APIs (Anthropic, OpenAI), and the candidate is in the UK. This involves cross-border data transfers.

**Analysis:** Post-Brexit UK GDPR:
- UK to EU (Hetzner): Covered by UK adequacy decision for EEA countries. No additional safeguards needed.
- UK to US (Anthropic/OpenAI): The UK has an adequacy arrangement with the US (UK Extension to the EU-US Data Privacy Framework). Anthropic and OpenAI are certified under the DPF.

Job listing data is publicly available and not personal data. The only personal data crossing borders is the candidate profile embedded in LLM scoring prompts.

**Score: 8/10**

**Recommendation:**
- Verify that the Hetzner server is in an EU country (covered by UK adequacy)
- Verify that Anthropic and OpenAI are certified under the UK Extension to the EU-US Data Privacy Framework
- Minimize personal data in LLM prompts (see Round 5.3)
- Document the data transfer arrangements in a simple data protection record
- No DPIA (Data Protection Impact Assessment) is required for personal use, but maintaining one voluntarily is good practice

---

#### Round 5.9: Automated Decision-Making

**Concern:** The AI scoring engine makes automated decisions about which jobs to surface and which to filter out. Under GDPR Article 22, individuals have the right not to be subject to decisions based solely on automated processing that significantly affect them.

**Analysis:** This is an interesting edge case. The system makes automated decisions about job relevance that directly affect the candidate's job search outcomes. A job incorrectly scored as D-tier and filtered out could mean a missed career opportunity.

However:
- The candidate is the data controller AND the data subject (it is her own system)
- The decision affects job listings (public data), not the candidate's rights
- The candidate can override decisions (review D-tier jobs, adjust scoring)
- This is personal use, not an employer or platform making decisions about the candidate

GDPR Article 22 is not applicable here because:
1. The candidate controls the system
2. The decisions are about job relevance, not about the candidate
3. The candidate has full visibility and override capability

**Score: 9/10**

**Recommendation:**
- No compliance issue, but good practice to:
  - Maintain the rule-based fallback scorer as an alternative to LLM scoring
  - Provide transparency: the scoring rationale is included in notifications
  - Allow manual override: the candidate can access and review all tiers
  - Periodically review D-tier jobs to catch scoring errors (already recommended)

---

#### Round 5.10: Security of Stored Credentials

**Concern:** The system stores API keys, IMAP passwords, and SMTP credentials. If the server is compromised, these credentials could be exposed.

**Analysis:** Credentials stored:
1. Adzuna API key + App ID
2. Reed API key
3. Jooble API key
4. Firecrawl API key
5. SerpAPI API key
6. Anthropic API key
7. OpenAI API key
8. Gmail IMAP password (App Password)
9. SMTP credentials for sending notifications

These are stored in n8n's credential vault, which encrypts them at rest using n8n's encryption key. The encryption key is typically stored in an environment variable or n8n's config file.

If the server is compromised (SSH access gained), the attacker could:
- Read the n8n encryption key from the environment
- Decrypt stored credentials
- Use the API keys to make requests on behalf of the system
- Access the Gmail inbox via IMAP

**Score: 5/10**

**Recommendation:**
- Ensure the Hetzner server has:
  - SSH key authentication only (no password login)
  - Firewall allowing only ports 80, 443, and SSH
  - Regular OS security updates via Dokploy
- Use separate API keys for this system (not shared with other projects)
- Set API key spend limits where possible (Anthropic, OpenAI both support this)
- Enable 2FA on all API provider accounts
- If any key is suspected compromised, rotate all keys immediately
- Consider using environment variables for the n8n encryption key rather than default/config file
- Back up credentials separately in a password manager (not on the server)

---

### Persona 5 Summary: Privacy & Compliance Officer

| Round | Topic | Score |
|-------|-------|-------|
| 5.1 | Scraping Legality | 7/10 |
| 5.2 | Email Privacy | 7/10 |
| 5.3 | LLM Data Exposure | 6/10 |
| 5.4 | Data Retention / Erasure | 6/10 |
| 5.5 | API ToS Compliance | 7/10 |
| 5.6 | LinkedIn ToS | 8/10 |
| 5.7 | Data Minimization | 6/10 |
| 5.8 | Cross-Border Transfer | 8/10 |
| 5.9 | Automated Decisions | 9/10 |
| 5.10 | Credential Security | 5/10 |
| **Average** | | **6.9/10** |

---

## Evaluation Summary

### Overall Scores by Persona

| Persona | Average Score | Assessment |
|---------|--------------|------------|
| Job Seeker (Selvi) | 5.0/10 | Functional but missing UX polish, onboarding, and emotional design |
| Technical Architect | 5.5/10 | Solid core design with gaps in resilience, monitoring, and disaster recovery |
| UK HR/L&D Expert | 5.6/10 | Good source coverage but missing titles, NHS Jobs, and hidden market awareness |
| Data Engineer (n8n) | 5.5/10 | Workable pipeline with concerns about salary parsing, error handling, and reprocessing |
| Privacy & Compliance | 6.9/10 | Mostly compliant; main concerns are credential security and LLM data exposure |

**Overall System Readiness Score: 5.7/10**

### Top 10 Critical Issues to Address Before Building

1. **Disaster Recovery (Score: 3/10):** No backup strategy for Postgres, n8n workflows, or credentials. A server failure loses everything. Set up daily automated backups before deploying any workflows.

2. **Email Parsing Fragility (Score: 4/10):** Silent failure mode when LinkedIn/Indeed/TotalJobs change email HTML. Implement: do not mark emails as read if parsing yields zero results; store raw email for reprocessing; add parse success rate monitoring.

3. **Firecrawl Credit Budget (Score: 4/10):** Math does not work on free tier. Reduce scrape frequency to every 12 hours, prioritize targets, and plan for Hobby tier ($19/month) as likely necessity.

4. **Salary Parsing (Score: 4/10):** UK salaries come in 15+ formats. The current regex approach is insufficient. Build a comprehensive parser with test cases for every known format before going live.

5. **Missing Job Sources (Score: 4/10):** NHS Jobs is a glaring omission. NHS is one of the UK's largest L&D employers. Add NHS Jobs RSS feed to Phase 1.

6. **Onboarding and First-Run Experience (Score: 4/10):** No status page, no welcome email, no test mode. The candidate has no way to know the system is working until the first digest arrives (possibly 24+ hours later).

7. **Application Tracking Integration (Score: 4/10):** The system discovers jobs but provides no mechanism for tracking application status. Applied jobs keep appearing in digests. Define the interface to Module 2 before building Module 1.

8. **Reprocessing Capability (Score: 4/10):** No way to re-score jobs after prompt improvements or reparse salaries after parser fixes. Build a reprocessing workflow from the start.

9. **Normalization Consistency (Score: 5/10):** Parsing logic is duplicated across 4 workflows. A shared normalization module is needed to prevent dedup failures.

10. **Monitoring Dashboard (Score: 5/10):** The system generates metrics but has no way to visualize them. Build at least a simple status page showing source health, pipeline volume, and scoring distribution.

### Revised Recommendations Based on Evaluation

**Pre-Build (Week 0):**
- Set up automated Postgres backups
- Build the comprehensive salary parser with tests
- Create the shared normalization module
- Add NHS Jobs to the source list
- Define the Module 1 <-> Module 2 interface (how does the candidate mark jobs as "applied"?)
- Create a recovery runbook

**Phase 1 Modifications:**
- Add a simple status/health endpoint (n8n webhook serving JSON)
- Add a "first run" welcome email
- Include NHS Jobs RSS feeds
- Implement workflow locking to prevent concurrent execution
- Add the Error Handler workflow (WF0) from day one
- Store raw emails for reprocessing when parse yields zero results

**Phase 2 Modifications:**
- Before deploying email parsing, test with sample emails from each provider
- Implement parse success rate monitoring
- Add LLM-based email parsing as a fallback (more resilient to template changes)

**Phase 3 Modifications:**
- Start with Hobby tier Firecrawl ($19/month) -- free tier is insufficient
- Only scrape CIPD/People Management and Personnel Today initially
- Add TrainingZone and universities only if credit budget allows

**Phase 4 Modifications:**
- Run SerpAPI for 2 weeks and measure unique job contribution before committing to monthly spend
- If unique contribution is <10 jobs/week, cancel and save the $50/month

**Ongoing:**
- Weekly manual audit: check 5 random D-tier jobs for false negatives
- Monthly scoring prompt review based on candidate feedback
- Quarterly search term audit based on discovered title patterns
- Annual API ToS review for all sources

---

*End of PRD -- Module 1: Job Discovery System v1.0*
