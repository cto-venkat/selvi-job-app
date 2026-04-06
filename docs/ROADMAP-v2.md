# JobPilot Roadmap v2 — Lean Personal Tool

> Revised 2026-04-06 after expert review (3.8/10 on v1) and user context clarification.
> This is a personal tool for Selvi and Venkat. Each application takes hours of form filling and days of prep. The goal: compress that to minutes.

## The Problem

Applying to a single job in the UK takes:
- 1-3 hours filling portal forms (Workday, Greenhouse, Lever — repetitive, tedious)
- 1-2 days of prep (research company, tailor CV, write screening question answers, prepare cover letter)
- Result: you can realistically do 2-3 quality applications per week

**Target: 10-15 quality applications per week** by automating the prep and pre-filling the forms.

## Architecture (Simplified)

```
Job boards (Adzuna, Reed, RSS)
    |
    v
n8n workflows (discover, score, classify)
    |
    v
PostgreSQL (selvi_jobs) — user_id column for Selvi vs Venkat
    |
    v
Next.js dashboard — simple password auth, per-user views
    |
    v
Prep pipeline: research + tailor CV + draft answers + pre-fill form
    |
    v
Human reviews, edits, clicks submit
```

**What's gone from v1:**
- Clerk (replaced with simple NextAuth credentials or basic auth)
- Docker Swarm / Dokploy complexity (docker-compose + Caddy)
- 38 unused database tables (keep ~10 that are actually used)
- Notification queue infrastructure (use Telegram via n8n)
- SWR polling, command palette, radar charts
- Claude Computer Use (revisit later if needed)
- LinkedIn content posting/scheduling
- Cover letter as separate document (most portals have their own text fields)

---

## Phase 0: Lock Down + Prove the Loop (3-4 days)

**Goal:** Secure the server and prove one end-to-end application works.

### 0.1 Security (Day 1)
- [ ] Rotate all credentials (Postgres, n8n, Dokploy, Hetzner API)
- [ ] Add basic auth to dashboard (Caddy or nginx, password-protected)
- [ ] Firewall: only ports 443 (HTTPS) and 22 (SSH) exposed
- [ ] Move Dokploy admin behind SSH tunnel
- [ ] Fix HTTPS on dashboard (replace Traefik with Caddy)
- [ ] Remove credentials from MEMORY.md

### 0.2 Simplify Deployment (Day 1-2)
- [ ] Single docker-compose.yml: postgres + n8n + dashboard + caddy
- [ ] Remove Dokploy/Swarm dependency
- [ ] Caddy auto-HTTPS for both domains

### 0.3 Simple Auth (Day 2)
- [ ] Replace Clerk with NextAuth credentials provider (email + password)
- [ ] Two users: Selvi, Venkat — each with their own `user_id`
- [ ] `getCurrentUserId()` from session, scope all queries
- [ ] Keep existing `tenant_id` column, just populate from session instead of Clerk

### 0.4 End-to-End Proof (Day 3-4)
- [ ] Pick one real job Selvi wants to apply to
- [ ] Score it (even with current basic scoring)
- [ ] Tailor CV manually with one Claude API call
- [ ] Apply through the portal manually
- [ ] Document: what took the most time? What should be automated first?

### 0.4 Success Metrics (define now, measure ongoing)
- Applications submitted per week
- Time per application (before vs after automation)
- Interview callback rate by score tier

---

## Phase 1: The Prep Pipeline (5-7 days)

**Goal:** Compress days of prep into 30 minutes per application.

This is the core value. When a high-scoring job is found, the system should produce a complete "application package" — everything needed to apply.

### 1.1 JD Analysis
- [ ] Claude extracts from job description: key requirements, must-haves, nice-to-haves, screening questions likely to appear, company culture signals
- [ ] Stored as structured JSON on the `jobs` table (`jd_analysis JSONB`)
- [ ] Model: Haiku (cheap, fast, good enough for extraction)

### 1.2 Company Research
- [ ] Companies House API (free): company size, financials, directors
- [ ] Recent news search (web search via n8n)
- [ ] Glassdoor summary (if available)
- [ ] Output: 1-page company brief stored on `jobs.company_research JSONB`

### 1.3 CV Tailoring
- [ ] Base CV for each user stored in DB (master profile with all experience)
- [ ] Claude (Sonnet) reframes achievements to match JD requirements
- [ ] STAR format where natural, but NO fabricated numbers — only real metrics from profile
- [ ] Single template, clean HTML -> PDF via Puppeteer (ATS-parseable)
- [ ] Human reviews and edits before finalizing
- [ ] Stored in `cv_packages` table

### 1.4 Screening Question Answers
- [ ] Common questions pre-answered in user profile (right to work, notice period, salary, visa status)
- [ ] Job-specific questions: Claude drafts answers using JD analysis + user profile
- [ ] Human reviews and edits
- [ ] Stored as JSON, reusable across similar applications

### 1.5 Application Package View (Dashboard)
- [ ] New page: `/dashboard/apply/[jobId]`
- [ ] Shows: JD analysis, company brief, tailored CV preview, screening answers
- [ ] Edit buttons on each section
- [ ] "Ready to Apply" status when human approves all sections
- [ ] Link to the actual application portal

### Eval Framework
- [ ] 10 real JDs as test set — generate packages, Selvi rates 1-5
- [ ] Track: which sections needed heavy editing? Which were good as-is?
- [ ] Iterate prompts based on edit patterns

---

## Phase 2: Scoring Upgrade (2-3 days)

**Goal:** Stop wasting time on bad-fit jobs. Smart filtering so prep effort goes to the right roles.

### 2.1 Hybrid Scorer
- [ ] 4 deterministic dimensions (no LLM needed):
  - Location/commute: postcodes.io distance from home
  - Compensation: parse salary range, compare to target
  - Contract type: permanent vs contract vs IR35
  - Seniority: title-level matching lookup table
- [ ] 4 LLM dimensions (Haiku):
  - Role match: responsibilities vs experience
  - Skills alignment: required vs candidate skills
  - Growth potential: career progression signals
  - Company quality: reputation, stability
- [ ] Simple output: Apply (score >= 70) / Maybe (50-69) / Skip (< 50)
- [ ] Gate: if Role Match or Skills < 40%, auto-Skip regardless

### 2.2 Prompt & Eval
- [ ] 20 real JDs with Selvi's expected scores as ground truth
- [ ] Run after every prompt change
- [ ] Version prompts, store version hash with each score

### 2.3 Dashboard Integration
- [ ] Score badge on jobs table: Apply/Maybe/Skip with color
- [ ] Filter by tier
- [ ] One-click "Generate Application Package" for Apply-tier jobs

---

## Phase 3: Form Pre-Fill (3-5 days)

**Goal:** Compress hours of form filling into minutes.

### 3.1 ATS Detection
- [ ] URL pattern matcher: Greenhouse, Lever, Ashby, SmartRecruiters, Workday
- [ ] Store on `applications.ats_platform`

### 3.2 API Submission (Greenhouse, Lever, Ashby, SmartRecruiters)
- [ ] These 4 have public apply APIs — use them directly
- [ ] Pre-fill payload from application package (CV, answers, contact info)
- [ ] Dashboard shows prepared payload for review
- [ ] Human clicks "Submit" — API call fires
- [ ] No stealth plugins, no deception — using official APIs

### 3.3 Playwright Assist for Workday/iCIMS
- [ ] NOT fully automated submission — a helper tool
- [ ] Opens the portal in a browser, pre-fills known fields (name, email, phone, address, work history, education)
- [ ] Pauses for human to review, fill custom fields, and submit
- [ ] No stealth plugins — runs as a visible browser the user can see and control
- [ ] If a CAPTCHA appears, human handles it
- [ ] Target: reduce 1-2 hours of Workday form filling to 15-20 minutes

### 3.4 Manual Fallback
- [ ] For portals without API or Playwright support
- [ ] Dashboard shows copy-paste-ready text for each field
- [ ] Clipboard buttons: "Copy CV summary", "Copy work history", "Copy screening answer #3"

---

## Phase 4: Dashboard Live Data (3-4 days)

**Goal:** Replace mock data with real DB queries on every page.

### 4.1 Data Access Layer
- [ ] `lib/queries.ts` with per-user scoped queries
- [ ] Raw SQL for `applications` table (GENERATED column workaround)
- [ ] `error.tsx` boundaries instead of mock data fallback

### 4.2 Pages to Connect
- [ ] `/dashboard` overview — real stats, real pipeline
- [ ] `/dashboard/jobs` — already connected, verify
- [ ] `/dashboard/applications` — from DB, table view with filters
- [ ] `/dashboard/interviews` — from DB
- [ ] `/dashboard/cv` — from `cv_packages`, with real PDF preview/download
- [ ] `/dashboard/emails` — from `emails` + `email_classifications`
- [ ] `/dashboard/settings` — tabbed, per-user profile (base CV, preferences, targets)

### 4.3 Delete Mock Data
- [ ] Remove `mock-data.ts` (1033 lines)
- [ ] Remove all mock imports

### 4.4 Notifications
- [ ] Telegram bot via n8n for alerts (interview reminders, high-score jobs, email responses)
- [ ] No in-app notification infrastructure

---

## Phase 5: LinkedIn & Visibility (2-3 days)

**Goal:** Get found by recruiters — the highest-conversion hiring channel.

### 5.1 Profile Optimization
- [ ] Analyze current LinkedIn profile against job search targets
- [ ] Generate optimized headline, summary, experience bullets
- [ ] Keyword suggestions from top-scoring JDs
- [ ] "Open to Work" configuration guidance

### 5.2 Target Company Research
- [ ] User defines 20 target companies
- [ ] Auto-research each: open roles, hiring managers, company intel
- [ ] Suggest LinkedIn connections to make
- [ ] Track engagement (did you connect? did they respond?)

### 5.3 Recruiter Registration
- [ ] Checklist of specialist recruitment agencies by sector
- [ ] Track which recruiters contacted, which responded
- [ ] Brief template for recruiter intro emails

---

## Phase 6: Interview Prep (2-3 days)

**Goal:** Compress days of interview prep into hours.

### 6.1 Prep Brief Generation
- [ ] Auto-generate from: JD analysis + company research + user profile
- [ ] Common question predictions by role type
- [ ] STAR story suggestions matched to likely questions
- [ ] Company-specific talking points

### 6.2 Story Bank
- [ ] `star_stories` table: situation, task, action, result, skills demonstrated
- [ ] Seeded from user's base CV and work history
- [ ] Grows over time as user adds new stories

### 6.3 Post-Interview
- [ ] Debrief capture (what went well, what to improve)
- [ ] Follow-up email draft generation
- [ ] Track outcomes for scoring calibration feedback loop

---

## Phase 7: Email Actions (1-2 days)

### 7.1 Gmail Integration
- [ ] Complete Gmail OAuth setup in n8n for both users
- [ ] Classification display in dashboard
- [ ] Actions via n8n webhooks: reply, confirm interview, decline

---

## Effort Summary

| Phase | What | Days | Priority |
|-------|------|------|----------|
| 0 | Lock down + prove loop | 3-4 | IMMEDIATE |
| 1 | Prep pipeline (core value) | 5-7 | HIGH |
| 2 | Scoring upgrade | 2-3 | HIGH |
| 3 | Form pre-fill | 3-5 | HIGH |
| 4 | Dashboard live data | 3-4 | MEDIUM |
| 5 | LinkedIn & visibility | 2-3 | MEDIUM |
| 6 | Interview prep | 2-3 | MEDIUM |
| 7 | Email actions | 1-2 | LOW |
| **Total** | | **22-31 days** | |

## Monthly AI Cost (2 users)

| Task | Model | Volume | Cost |
|------|-------|--------|------|
| JD analysis | Haiku | 200 jobs/mo | $1-2 |
| Scoring (LLM dims only) | Haiku | 200 jobs/mo | $2-3 |
| CV tailoring | Sonnet | 30 CVs/mo | $3-5 |
| Screening answers | Sonnet | 30 sets/mo | $2-3 |
| Company research | Haiku | 30 companies/mo | $1 |
| Interview prep | Sonnet | 10 briefs/mo | $1-2 |
| Retries + iteration | Mixed | ~15% overhead | $2-3 |
| **Total** | | | **$12-19/mo** |

## Key Principles

1. **Personal tool, not a product.** Two users. No SaaS features.
2. **Hours to minutes.** Every feature must measurably reduce time per application.
3. **Human always decides.** AI prepares, human reviews, human submits.
4. **Measure everything.** Time per app, callback rate, edit frequency on AI outputs.
5. **Official APIs, not scraping.** Use ATS apply APIs where they exist. Playwright as visible helper, not stealth bot.
6. **No fabricated content.** Tailored yes, invented no.
