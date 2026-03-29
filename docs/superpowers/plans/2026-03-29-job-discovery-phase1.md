# Job Discovery System — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the Job Discovery System Phase 1 on n8n — free data sources (Adzuna API, Reed API, jobs.ac.uk RSS, NHS Jobs RSS, Guardian Jobs RSS, CV-Library RSS, Civil Service Jobs RSS), AI scoring, deduplication, and email notifications.

**Architecture:** All logic lives in n8n workflows. Postgres (already running on Dokploy alongside n8n) stores jobs, scores, and config. Claude Haiku scores jobs (with Sonnet for borderline cases). Email sends daily digest + instant A-tier alerts. No custom code deployment — only n8n workflows and a Postgres schema.

**Tech Stack:** n8n (self-hosted at n8n.deploy.apiloom.io), PostgreSQL 16 (Dokploy), Claude API (Haiku/Sonnet), Gmail SMTP for notifications.

**PRD Reference:** `/Users/venkat/venkat-code/selvi-job-app/docs/prds/01-job-discovery-system-prd.md` (v2.0, 7,670 lines)

---

## Pre-Implementation Setup

### Task 0: Create Postgres Database and Schema

**Where:** Dokploy server (188.34.205.212) — create a new Postgres database for the job discovery system.

- [ ] **Step 1: Create the selvi_jobs database**

SSH into the server and create the database inside the existing Dokploy Postgres instance:

```bash
ssh -i ~/.ssh/dokploy-key.pem root@188.34.205.212

# Find the Dokploy Postgres container
docker ps | grep postgres

# Create a new database (exec into the postgres container)
docker exec -i $(docker ps -q -f name=dokploy-postgres) psql -U dokploy -c "CREATE DATABASE selvi_jobs;"
docker exec -i $(docker ps -q -f name=dokploy-postgres) psql -U dokploy -c "CREATE USER selvi WITH PASSWORD 'GENERATE_SECURE_PASSWORD';"
docker exec -i $(docker ps -q -f name=dokploy-postgres) psql -U dokploy -c "GRANT ALL PRIVILEGES ON DATABASE selvi_jobs TO selvi;"
docker exec -i $(docker ps -q -f name=dokploy-postgres) psql -U dokploy -d selvi_jobs -c "GRANT ALL ON SCHEMA public TO selvi;"
```

Expected: Database and user created successfully.

- [ ] **Step 2: Create the core schema**

Run inside the selvi_jobs database:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table: all discovered jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_raw TEXT,
    salary_currency TEXT DEFAULT 'GBP',
    salary_is_predicted BOOLEAN DEFAULT false,
    description TEXT,
    url TEXT NOT NULL,
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contract_type TEXT, -- permanent, contract, temporary, fixed-term
    work_type TEXT, -- full_time, part_time, hybrid, remote
    job_type TEXT, -- corporate, academic
    job_level TEXT, -- from title parsing
    category TEXT,
    application_count INTEGER,
    dedup_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'raw', -- raw, scored, applied, expired, archived
    tier TEXT, -- A+, A, B, C, D (set after scoring)
    composite_score NUMERIC(5,2), -- 0-100 (set after scoring)
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES jobs(id),
    ghost_job_score NUMERIC(3,2), -- 0-1 probability of being a ghost job
    red_flags JSONB DEFAULT '[]',
    hidden_signals JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for jobs
CREATE INDEX idx_jobs_dedup_hash ON jobs(dedup_hash);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_tier ON jobs(tier);
CREATE INDEX idx_jobs_discovered_at ON jobs(discovered_at);
CREATE INDEX idx_jobs_composite_score ON jobs(composite_score DESC);
CREATE INDEX idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX idx_jobs_company_trgm ON jobs USING gin(company gin_trgm_ops);
CREATE UNIQUE INDEX idx_jobs_dedup_unique ON jobs(dedup_hash) WHERE is_duplicate = false;

-- Job sources: tracks which source found each job
CREATE TABLE job_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- adzuna, reed, jooble, jobs_ac_uk, guardian, cv_library, civil_service, nhs, linkedin_email, indeed_email, totaljobs_email, cipd_firecrawl, serpapi
    source_id TEXT, -- ID from the source system
    source_url TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB -- store first 14 days, then null out
);

CREATE INDEX idx_job_sources_job_id ON job_sources(job_id);
CREATE INDEX idx_job_sources_source ON job_sources(source);
CREATE UNIQUE INDEX idx_job_sources_unique ON job_sources(source, source_id);

-- Job scores: AI scoring results
CREATE TABLE job_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    scoring_method TEXT NOT NULL, -- rule_based, haiku, sonnet, manual
    title_match NUMERIC(3,1),
    seniority_match NUMERIC(3,1),
    location_match NUMERIC(3,1),
    salary_match NUMERIC(3,1),
    skills_match NUMERIC(3,1),
    sector_match NUMERIC(3,1),
    composite_score NUMERIC(5,2),
    tier TEXT,
    reasoning TEXT,
    prompt_version TEXT,
    model_used TEXT,
    tokens_used INTEGER,
    cost_usd NUMERIC(8,6),
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_scores_job_id ON job_scores(job_id);

-- Search configurations
CREATE TABLE search_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    search_term TEXT NOT NULL,
    location TEXT,
    distance_km INTEGER DEFAULT 40,
    salary_min INTEGER,
    salary_max INTEGER,
    category TEXT, -- corporate, academic, both
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source health tracking
CREATE TABLE source_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL, -- ok, error, timeout, rate_limited
    jobs_found INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    error_message TEXT
);

CREATE INDEX idx_source_health_source ON source_health(source);
CREATE INDEX idx_source_health_checked_at ON source_health(checked_at);

-- Notification log
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type TEXT NOT NULL, -- daily_digest, instant_alert, weekly_summary
    jobs_included INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipient TEXT,
    status TEXT DEFAULT 'sent', -- sent, failed
    error_message TEXT
);

-- Candidate feedback
CREATE TABLE candidate_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    feedback TEXT NOT NULL, -- relevant, not_relevant, applied, interviewing, rejected, offered
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidate_feedback_job_id ON candidate_feedback(job_id);

-- Workflow errors (for WF0 error handler)
CREATE TABLE workflow_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_name TEXT NOT NULL,
    error_message TEXT,
    error_details JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN DEFAULT false
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Expected: All tables, indexes, and triggers created.

- [ ] **Step 3: Seed search configurations**

```sql
-- Corporate search terms (Adzuna, Reed, Jooble)
INSERT INTO search_configs (source, search_term, location, salary_min, salary_max, category) VALUES
-- Core L&D titles
('api', 'learning development manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'L&D manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'L&D business partner', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'head of learning development', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'talent development manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'organisational development manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'people development manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'leadership development manager', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'capability development lead', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'learning consultant', 'maidenhead', 55000, 120000, 'corporate'),
('api', 'L&D director', 'london', 55000, 120000, 'corporate'),
('api', 'head of L&D', 'reading', 55000, 120000, 'corporate'),
('api', 'OD specialist', 'maidenhead', 55000, 120000, 'corporate'),
-- Contract/interim terms
('api', 'L&D interim', 'maidenhead', 400, 700, 'corporate'),
('api', 'learning development consultant contract', 'london', 400, 700, 'corporate'),
-- Academic search terms (for Adzuna/Reed that also carry academic roles)
('api', 'lecturer human resource management', 'maidenhead', 35000, 80000, 'academic'),
('api', 'lecturer management', 'london', 35000, 80000, 'academic'),
('api', 'senior lecturer business', 'reading', 35000, 80000, 'academic'),
('api', 'teaching fellow HRM', 'maidenhead', 35000, 80000, 'academic');
```

Expected: 19 search configs inserted.

- [ ] **Step 4: Configure n8n Postgres credential**

In n8n (https://n8n.deploy.apiloom.io):
1. Go to **Credentials** > **New Credential** > **Postgres**
2. Name: `Selvi Jobs DB`
3. Host: `dokploy-postgres` (Docker network name) or `172.17.0.1` (Docker bridge)
4. Port: `5432`
5. Database: `selvi_jobs`
6. User: `selvi`
7. Password: (the generated password)
8. SSL: Disabled (internal Docker network)
9. Test connection > Save

Expected: Connection successful.

- [ ] **Step 5: Commit schema file**

Save the SQL above to `/Users/venkat/venkat-code/selvi-job-app/db/schema.sql` and commit.

```bash
cd /Users/venkat/venkat-code/selvi-job-app
mkdir -p db
# (write schema.sql)
git add db/schema.sql
git commit -m "db: add Postgres schema for job discovery system"
```

---

### Task 1: Configure API Credentials in n8n

**Where:** n8n dashboard (https://n8n.deploy.apiloom.io) > Credentials

- [ ] **Step 1: Register for Adzuna API**

Go to https://developer.adzuna.com/ and register. Get `app_id` and `app_key`.

In n8n: Credentials > New > **Header Auth**
- Name: `Adzuna API`
- Store the app_id and app_key (we'll use them as query params in HTTP Request nodes)

Note: Adzuna uses query params not headers, so we'll store these as n8n Variables instead:
- Settings > Variables > Add:
  - `ADZUNA_APP_ID`: (your app id)
  - `ADZUNA_APP_KEY`: (your api key)

- [ ] **Step 2: Register for Reed API**

Go to https://www.reed.co.uk/developers/jobseeker and register. Get API key.

In n8n: Credentials > New > **HTTP Basic Auth**
- Name: `Reed API`
- User: (your API key)
- Password: (leave empty)

- [ ] **Step 3: Register for Jooble API**

Go to https://jooble.org/api/about and register. Get API key.

In n8n: Settings > Variables > Add:
- `JOOBLE_API_KEY`: (your api key)

- [ ] **Step 4: Configure Anthropic credential**

In n8n: Credentials > New > **Anthropic**
- Name: `Claude API`
- API Key: (your Anthropic API key)

- [ ] **Step 5: Configure Gmail SMTP for notifications**

In n8n: Credentials > New > **SMTP**
- Name: `Gmail SMTP`
- Host: smtp.gmail.com
- Port: 587
- SSL/TLS: STARTTLS
- User: selvi.jobs@gmail.com (or whichever email)
- Password: App-specific password

- [ ] **Step 6: Commit credential notes (no secrets)**

Save a reference doc listing which credentials are configured (names only, no keys).

```bash
cd /Users/venkat/venkat-code/selvi-job-app
# Write docs/credentials-reference.md
git add docs/credentials-reference.md
git commit -m "docs: add credential reference for n8n setup"
```

---

### Task 2: Build WF0 — Global Error Handler

**Where:** n8n > New Workflow > "WF0: Error Handler"

This workflow catches errors from all other workflows and logs them.

- [ ] **Step 1: Create the workflow**

1. New Workflow > Name: `WF0: Error Handler`
2. Add node: **Error Trigger** (triggers when any workflow fails)
3. Add node: **Postgres** (insert into workflow_errors table)
   - Operation: Insert
   - Table: `workflow_errors`
   - Columns:
     - workflow_name: `{{ $json.workflow.name }}`
     - error_message: `{{ $json.execution.error.message }}`
     - error_details: `{{ JSON.stringify($json.execution.error) }}`
4. Add node: **Send Email** (SMTP)
   - To: venkat's email
   - Subject: `[Selvi Jobs] Workflow Error: {{ $json.workflow.name }}`
   - Body: `Workflow "{{ $json.workflow.name }}" failed at {{ new Date().toISOString() }}. Error: {{ $json.execution.error.message }}`
5. Activate the workflow

- [ ] **Step 2: Test by triggering an error**

Create a temporary test workflow with a Code node that throws `throw new Error('test error')`. Run it. Verify:
- Error logged in workflow_errors table
- Email received

- [ ] **Step 3: Delete test workflow, keep WF0 active**

---

### Task 3: Build SW1 — Normalize & Upsert Sub-Workflow

**Where:** n8n > New Workflow > "SW1: Normalize & Upsert"

This is a shared sub-workflow called by all source workflows (WF1, WF2a/b/c). It normalizes job data and inserts into Postgres.

- [ ] **Step 1: Create the sub-workflow**

1. New Workflow > Name: `SW1: Normalize & Upsert`
2. Add node: **Execute Workflow Trigger** (makes this callable as sub-workflow)
   - Input fields expected: title, company, location, salary_raw, salary_min, salary_max, description, url, posted_at, expires_at, source, source_id, contract_type, work_type, job_type, raw_data

3. Add node: **Code** (JavaScript) — "Normalize"
```javascript
const items = $input.all();
return items.map(item => {
  const d = item.json;

  // Normalize title
  const title = (d.title || '').trim();

  // Normalize company
  const company = (d.company || 'Unknown').trim();

  // Normalize location
  let location = (d.location || 'UK').trim();
  // Standardize common UK location variants
  location = location
    .replace(/Greater London/gi, 'London')
    .replace(/South East England/gi, '')
    .replace(/,\s*United Kingdom/gi, '')
    .replace(/,\s*UK$/gi, '')
    .trim();

  // Parse salary from raw text if min/max not provided
  let salaryMin = d.salary_min ? parseInt(d.salary_min) : null;
  let salaryMax = d.salary_max ? parseInt(d.salary_max) : null;
  const salaryRaw = d.salary_raw || '';

  if (!salaryMin && !salaryMax && salaryRaw) {
    // Try common UK salary patterns
    const patterns = [
      /£([\d,]+)\s*-\s*£([\d,]+)/,
      /GBP\s*([\d,]+)\s*-\s*GBP\s*([\d,]+)/,
      /(\d{2,3}),?(\d{3})\s*-\s*(\d{2,3}),?(\d{3})/,
      /£([\d,]+)\s*(?:per annum|pa|p\.a\.)/i,
      /(\d+)k\s*-\s*(\d+)k/i,
    ];

    for (const p of patterns) {
      const m = salaryRaw.match(p);
      if (m) {
        if (m.length >= 3) {
          salaryMin = parseInt(m[1].replace(/,/g, ''));
          salaryMax = parseInt(m[2].replace(/,/g, ''));
          // Handle "70k-80k" format
          if (salaryMin < 1000) salaryMin *= 1000;
          if (salaryMax < 1000) salaryMax *= 1000;
        } else if (m.length >= 2) {
          salaryMin = parseInt(m[1].replace(/,/g, ''));
          salaryMax = salaryMin;
        }
        break;
      }
    }
  }

  // Generate dedup hash
  const dedupStr = `${title.toLowerCase()}|${company.toLowerCase()}|${location.toLowerCase()}`;
  // Simple hash using n8n's built-in crypto
  const crypto = require('crypto');
  const dedupHash = crypto.createHash('md5').update(dedupStr).digest('hex');

  // Detect job type (academic vs corporate)
  const academicKeywords = ['lecturer', 'professor', 'teaching fellow', 'senior lecturer', 'reader', 'academic'];
  const jobType = academicKeywords.some(k => title.toLowerCase().includes(k)) ? 'academic' : 'corporate';

  return {
    json: {
      title,
      company,
      location,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_raw: salaryRaw || null,
      description: (d.description || '').substring(0, 5000),
      url: d.url,
      posted_at: d.posted_at || null,
      expires_at: d.expires_at || null,
      source: d.source,
      source_id: d.source_id || null,
      contract_type: d.contract_type || null,
      work_type: d.work_type || null,
      job_type: jobType,
      dedup_hash: dedupHash,
      raw_data: d.raw_data || null,
    }
  };
});
```

4. Add node: **Postgres** — "Check Duplicate"
   - Operation: Select
   - Query: `SELECT id FROM jobs WHERE dedup_hash = '{{ $json.dedup_hash }}' AND is_duplicate = false LIMIT 1`

5. Add node: **IF** — "Is New?"
   - Condition: `{{ $json.id }}` does not exist (empty result from previous query)

6. **True branch** — Add node: **Postgres** — "Insert Job"
   - Operation: Insert
   - Table: `jobs`
   - Columns: title, company, location, salary_min, salary_max, salary_raw, description, url, posted_at, expires_at, contract_type, work_type, job_type, dedup_hash, status='raw'

7. Follow with: **Postgres** — "Insert Source"
   - Operation: Insert
   - Table: `job_sources`
   - Columns: job_id (from insert), source, source_id, source_url=url, raw_data

8. **False branch** — Add node: **Postgres** — "Insert Source Only"
   - (Same job found from a new source — just log the additional source)
   - Insert into job_sources with existing job_id

- [ ] **Step 2: Test the sub-workflow**

Use the manual test execution with sample data:
```json
{
  "title": "Test L&D Manager",
  "company": "Test Corp",
  "location": "Reading, Berkshire",
  "salary_raw": "£70,000 - £80,000 per annum",
  "description": "Test job description",
  "url": "https://example.com/job/123",
  "posted_at": "2026-03-29T10:00:00Z",
  "source": "test",
  "source_id": "test-123"
}
```

Verify: Job inserted into `jobs` table with correct normalized data, salary parsed to 70000-80000, dedup_hash generated.

- [ ] **Step 3: Test dedup — run again with same data**

Expected: No duplicate job created, but new source entry added.

---

### Task 4: Build WF2a — Adzuna API Poller

**Where:** n8n > New Workflow > "WF2a: Adzuna Poller"

- [ ] **Step 1: Create the workflow**

1. New Workflow > Name: `WF2a: Adzuna Poller`
2. Add node: **Schedule Trigger**
   - Interval: Every 3 hours
   - Time offset: 30 minutes past the hour
   - Active hours: 6:30, 9:30, 12:30, 15:30, 18:30, 21:30

3. Add node: **Postgres** — "Get Search Configs"
   - Query: `SELECT search_term, location, salary_min, salary_max FROM search_configs WHERE source = 'api' AND is_active = true AND category IN ('corporate', 'both')`

4. Add node: **Split In Batches** — process one search term at a time

5. Add node: **HTTP Request** — "Adzuna API"
   - Method: GET
   - URL: `https://api.adzuna.com/v1/api/jobs/gb/search/1`
   - Query params:
     - `app_id`: `{{ $vars.ADZUNA_APP_ID }}`
     - `app_key`: `{{ $vars.ADZUNA_APP_KEY }}`
     - `what`: `{{ $json.search_term }}`
     - `where`: `{{ $json.location }}`
     - `distance`: `25`
     - `salary_min`: `{{ $json.salary_min }}`
     - `salary_max`: `{{ $json.salary_max }}`
     - `sort_by`: `date`
     - `max_days_old`: `3`
     - `results_per_page`: `50`
   - Timeout: 30000
   - Retry on Fail: true, Max Retries: 3

6. Add node: **Code** — "Map Adzuna Results"
```javascript
const results = $input.first().json.results || [];
return results.map(job => ({
  json: {
    title: job.title,
    company: job.company?.display_name || 'Unknown',
    location: job.location?.display_name || 'UK',
    salary_min: job.salary_min || null,
    salary_max: job.salary_max || null,
    salary_raw: job.salary_min ? `£${job.salary_min} - £${job.salary_max}` : null,
    salary_is_predicted: job.salary_is_predicted === '1',
    description: (job.description || '').substring(0, 5000),
    url: job.redirect_url,
    posted_at: job.created,
    contract_type: job.contract_type || null,
    work_type: job.contract_time || null,
    source: 'adzuna',
    source_id: String(job.id),
    raw_data: job,
  }
}));
```

7. Add node: **Execute Workflow** — call `SW1: Normalize & Upsert`

8. Add node: **Postgres** — "Log Health"
   - Insert into source_health: source='adzuna', status='ok', jobs_found=(count)

- [ ] **Step 2: Test manually**

Run the workflow manually. Verify:
- Adzuna API returns results
- Jobs are normalized and inserted into Postgres
- Source health logged

- [ ] **Step 3: Activate the workflow**

Set to active. Verify first scheduled run works.

---

### Task 5: Build WF2b — Reed API Poller

**Where:** n8n > New Workflow > "WF2b: Reed Poller"

- [ ] **Step 1: Create the workflow (same pattern as WF2a)**

1. Schedule Trigger: Every 3 hours at :35
2. Postgres: Get search configs
3. Split In Batches
4. HTTP Request:
   - URL: `https://www.reed.co.uk/api/1.0/search`
   - Auth: HTTP Basic (Reed API credential)
   - Query: keywords, locationName, distancefromlocation=25, minimumSalary, maximumSalary, resultsToTake=100
5. Code: Map Reed results
```javascript
const results = $input.first().json.results || [];
return results.map(job => ({
  json: {
    title: job.jobTitle,
    company: job.employerName || 'Unknown',
    location: job.locationName || 'UK',
    salary_min: job.minimumSalary || null,
    salary_max: job.maximumSalary || null,
    salary_raw: job.minimumSalary ? `£${job.minimumSalary} - £${job.maximumSalary}` : null,
    description: (job.jobDescription || '').substring(0, 5000),
    url: job.jobUrl,
    posted_at: job.date,
    expires_at: job.expirationDate || null,
    application_count: job.applications || null,
    source: 'reed',
    source_id: String(job.jobId),
    raw_data: job,
  }
}));
```
6. Execute Workflow: SW1
7. Log health

- [ ] **Step 2: Test and activate**

---

### Task 6: Build WF1 — RSS Source Poller

**Where:** n8n > New Workflow > "WF1: RSS Poller"

This workflow polls all RSS feeds: jobs.ac.uk, Guardian, CV-Library, Civil Service, NHS Jobs.

- [ ] **Step 1: Create the workflow**

1. Schedule Trigger: Every 2 hours on the hour, 6AM-10PM

2. For each RSS source, add a parallel branch:

**Branch A: jobs.ac.uk (5 feeds)**
- RSS Feed Read nodes (one per feed URL from PRD section 6.4)
- Code node to normalize academic fields (dc:employer, dc:salary, dc:location)
- Execute Workflow: SW1

**Branch B: Guardian Jobs (3 feeds)**
- RSS Feed Read nodes
- Code node to extract company/salary from description
- Execute Workflow: SW1

**Branch C: CV-Library (5 feeds)**
- RSS Feed Read nodes
- Code node to parse salary/location from description
- Execute Workflow: SW1

**Branch D: Civil Service Jobs (4 feeds)**
- RSS Feed Read nodes
- Code node to parse CS grade/salary
- Execute Workflow: SW1

**Branch E: NHS Jobs (5 feeds)**
- RSS Feed Read nodes
- Code node to parse NHS band/trust
- Execute Workflow: SW1

3. At the end, merge all branches and log health per source.

- [ ] **Step 2: Test each branch individually**

Use manual execution. Check that each RSS feed returns data and jobs are inserted.

- [ ] **Step 3: Activate**

---

### Task 7: Build WF5 — AI Scoring Pipeline

**Where:** n8n > New Workflow > "WF5: AI Scoring Pipeline"

- [ ] **Step 1: Create the workflow**

1. Schedule Trigger: Every 30 minutes at :15

2. Postgres: "Get Unscored Jobs"
   - Query: `SELECT * FROM jobs WHERE status = 'raw' AND is_duplicate = false ORDER BY discovered_at ASC LIMIT 50`

3. IF: "Any jobs?" — check if results exist

4. **Code** — "Rule-Based Pre-Score"
```javascript
// Quick rule-based filter: score obvious matches/non-matches without LLM
const items = $input.all();
return items.map(item => {
  const job = item.json;
  const title = (job.title || '').toLowerCase();

  // Instant D-tier: clearly wrong
  const rejectKeywords = ['machine learning', 'warehouse', 'forklift', 'driver',
    'cleaning', 'care assistant', 'support worker', 'nursery', 'reception',
    'learning support assistant', 'sales', 'marketing manager'];
  if (rejectKeywords.some(k => title.includes(k))) {
    return { json: { ...job, rule_tier: 'D', rule_score: 10, needs_llm: false } };
  }

  // Instant A-tier: perfect title match
  const perfectTitles = ['learning development manager', 'l&d manager',
    'head of l&d', 'head of learning', 'l&d business partner',
    'talent development manager', 'lecturer in human resource',
    'senior lecturer management', 'lecturer hrm'];
  if (perfectTitles.some(k => title.includes(k))) {
    return { json: { ...job, rule_tier: 'A', rule_score: 85, needs_llm: true } };
  }

  // Everything else: needs LLM scoring
  return { json: { ...job, rule_tier: null, rule_score: null, needs_llm: true } };
});
```

5. **IF** — "Needs LLM?"
   - Route D-tier to direct insert (skip LLM)
   - Route others to LLM scoring

6. **For D-tier branch**: Postgres insert score + update job status
```sql
INSERT INTO job_scores (job_id, scoring_method, composite_score, tier, reasoning)
VALUES ('{{$json.id}}', 'rule_based', {{$json.rule_score}}, 'D', 'Rejected by rule-based filter');

UPDATE jobs SET status = 'scored', tier = 'D', composite_score = {{$json.rule_score}} WHERE id = '{{$json.id}}';
```

7. **For LLM branch**: **Anthropic** node (Claude Haiku)
   - Model: claude-3-5-haiku-latest
   - System prompt: (the scoring prompt from PRD section 7.4)
   - User message: Job details (title, company, location, salary, description)
   - Response format: Request tool calling for structured output:
```json
{
  "title_match": 8,
  "seniority_match": 9,
  "location_match": 10,
  "salary_match": 8,
  "skills_match": 7,
  "sector_match": 9,
  "reasoning": "Strong match for L&D Manager role..."
}
```

8. **Code** — "Calculate Composite Score"
```javascript
const score = $input.first().json;
const composite = (
  score.title_match * 0.25 +
  score.seniority_match * 0.20 +
  score.location_match * 0.15 +
  score.salary_match * 0.15 +
  score.skills_match * 0.15 +
  score.sector_match * 0.10
) * 10; // Scale to 0-100

let tier;
if (composite >= 80) tier = 'A';
else if (composite >= 65) tier = 'B';
else if (composite >= 45) tier = 'C';
else tier = 'D';

return [{ json: { ...score, composite_score: Math.round(composite * 100) / 100, tier } }];
```

9. **Postgres** — Insert score and update job

10. **IF** — "Is A-tier?" → trigger instant email notification

- [ ] **Step 2: Test with sample unscored jobs**

Run manually. Verify scoring works, tiers are assigned correctly.

- [ ] **Step 3: Activate**

---

### Task 8: Build WF7 — Notification Dispatcher

**Where:** n8n > New Workflow > "WF7: Notification Dispatcher"

- [ ] **Step 1: Create daily digest workflow**

1. Schedule Trigger: 7:30 AM daily

2. Postgres: "Get Today's A+B Jobs"
```sql
SELECT j.*, js.composite_score, js.reasoning
FROM jobs j
JOIN job_scores js ON js.job_id = j.id
WHERE j.tier IN ('A', 'B')
AND j.discovered_at > NOW() - INTERVAL '24 hours'
AND j.is_duplicate = false
ORDER BY js.composite_score DESC
```

3. IF: "Any jobs?" — check count

4. **Code** — "Build Email HTML"
```javascript
const jobs = $input.all().map(i => i.json);
const aJobs = jobs.filter(j => j.tier === 'A');
const bJobs = jobs.filter(j => j.tier === 'B');

let html = `<h2>Daily Job Digest — ${new Date().toLocaleDateString('en-GB')}</h2>`;
html += `<p>Found ${aJobs.length} strong matches and ${bJobs.length} worth reviewing.</p>`;

if (aJobs.length > 0) {
  html += `<h3>⭐ Strong Matches (Tier A)</h3>`;
  for (const j of aJobs) {
    html += `<div style="margin-bottom:16px;padding:12px;border-left:4px solid #22c55e;background:#f0fdf4;">`;
    html += `<strong><a href="${j.url}">${j.title}</a></strong><br/>`;
    html += `${j.company} — ${j.location}<br/>`;
    html += j.salary_raw ? `${j.salary_raw}<br/>` : '';
    html += `<small>Score: ${j.composite_score}/100 | ${j.source}</small>`;
    html += `</div>`;
  }
}

if (bJobs.length > 0) {
  html += `<h3>Worth Reviewing (Tier B)</h3>`;
  for (const j of bJobs) {
    html += `<div style="margin-bottom:12px;padding:8px;border-left:4px solid #3b82f6;background:#eff6ff;">`;
    html += `<strong><a href="${j.url}">${j.title}</a></strong><br/>`;
    html += `${j.company} — ${j.location}<br/>`;
    html += j.salary_raw ? `${j.salary_raw}<br/>` : '';
    html += `</div>`;
  }
}

return [{ json: { subject: `${aJobs.length} strong + ${bJobs.length} more jobs — ${new Date().toLocaleDateString('en-GB')}`, html } }];
```

5. **Send Email** (SMTP)
   - To: selvi's email
   - Subject: from previous node
   - HTML body: from previous node

6. **Postgres** — Log notification

- [ ] **Step 2: Test with sample data**

Insert a few test A/B tier jobs, run manually. Verify email arrives with correct formatting.

- [ ] **Step 3: Activate**

---

### Task 9: Build WF6 — Deduplication & Cleanup

**Where:** n8n > New Workflow > "WF6: Dedup & Cleanup"

- [ ] **Step 1: Create the workflow**

1. Schedule Trigger: Every 4 hours (3AM, 7AM, 11AM, 3PM, 7PM, 11PM)

2. **Postgres** — "Find Fuzzy Duplicates"
```sql
-- Find jobs with similar titles from different sources
SELECT a.id as job_a, b.id as job_b,
       a.title as title_a, b.title as title_b,
       similarity(a.title, b.title) as title_sim
FROM jobs a
JOIN jobs b ON a.id < b.id
WHERE a.is_duplicate = false AND b.is_duplicate = false
AND similarity(a.title, b.title) > 0.7
AND LOWER(a.company) = LOWER(b.company)
AND a.discovered_at > NOW() - INTERVAL '7 days'
LIMIT 100
```

3. **Code** — "Select Survivor" (keep the one discovered first)

4. **Postgres** — "Mark Duplicates"
```sql
UPDATE jobs SET is_duplicate = true, duplicate_of = '{{$json.survivor_id}}' WHERE id = '{{$json.duplicate_id}}'
```

5. **Postgres** — "Expire Old Jobs"
```sql
UPDATE jobs SET status = 'expired'
WHERE status IN ('raw', 'scored')
AND (expires_at < NOW() OR discovered_at < NOW() - INTERVAL '30 days')
```

6. **Postgres** — "Clean Raw Data"
```sql
UPDATE job_sources SET raw_data = NULL
WHERE captured_at < NOW() - INTERVAL '14 days' AND raw_data IS NOT NULL
```

- [ ] **Step 2: Test and activate**

---

### Task 10: Build Daily Postgres Backup

**Where:** Dokploy server

- [ ] **Step 1: Create backup script on server**

```bash
ssh -i ~/.ssh/dokploy-key.pem root@188.34.205.212 bash <<'REMOTE'
cat > /usr/local/bin/backup-selvi-db.sh <<'SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/selvi-jobs"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec $(docker ps -q -f name=dokploy-postgres) pg_dump -U dokploy selvi_jobs | gzip > "$BACKUP_DIR/selvi_jobs_$TIMESTAMP.sql.gz"
# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "Backup completed: selvi_jobs_$TIMESTAMP.sql.gz"
SCRIPT
chmod +x /usr/local/bin/backup-selvi-db.sh

# Schedule daily at 2 AM
echo '0 2 * * * root /usr/local/bin/backup-selvi-db.sh 2>&1 | logger -t selvi-backup' > /etc/cron.d/selvi-backup
chmod 644 /etc/cron.d/selvi-backup
echo "Backup cron configured"
REMOTE
```

- [ ] **Step 2: Test backup**

```bash
ssh -i ~/.ssh/dokploy-key.pem root@188.34.205.212 "/usr/local/bin/backup-selvi-db.sh"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Verify all workflows are active**

Check n8n dashboard: WF0, WF1, WF2a, WF2b, WF5, WF6, WF7 should all be active.

- [ ] **Step 2: Wait for first scheduled runs**

After 3 hours, check:
- Jobs appearing in Postgres `jobs` table
- Scores appearing in `job_scores` table
- Source health logged in `source_health` table

- [ ] **Step 3: Verify morning digest**

Next day at 7:30 AM, verify email arrives with discovered jobs.

- [ ] **Step 4: Check job counts**

```sql
SELECT source, COUNT(*) as jobs,
       COUNT(*) FILTER (WHERE tier = 'A') as a_tier,
       COUNT(*) FILTER (WHERE tier = 'B') as b_tier
FROM jobs j
JOIN job_sources js ON js.job_id = j.id
WHERE j.is_duplicate = false
GROUP BY source
ORDER BY jobs DESC;
```

Target: 30-80 total jobs in first 24 hours.

- [ ] **Step 5: Commit everything and update memory**

```bash
cd /Users/venkat/venkat-code/selvi-job-app
git add -A
git commit -m "feat: Phase 1 complete — job discovery system live on n8n"
```

---

## Phase 1 Summary

| Component | Workflow | Source |
|-----------|----------|--------|
| Error handling | WF0 | All workflows |
| Shared normalization | SW1 | Sub-workflow |
| RSS polling | WF1 | jobs.ac.uk, Guardian, CV-Library, Civil Service, NHS |
| Adzuna API | WF2a | Adzuna |
| Reed API | WF2b | Reed |
| AI scoring | WF5 | Claude Haiku + rule-based |
| Deduplication | WF6 | Postgres |
| Notifications | WF7 | Email digest + instant alerts |
| Backup | Cron | Daily pg_dump |

**Not in Phase 1 (future phases):**
- WF2c: Jooble Poller (Phase 1.5 — easy add)
- WF3: Email Alert Parser (Phase 2 — needs Gmail setup)
- WF4: Firecrawl Scraper (Phase 3 — CIPD, TrainingZone)
- SerpAPI/Google Jobs (Phase 4 — $50/mo, evaluate need)
