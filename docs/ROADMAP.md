# JobPilot Production Roadmap

> Generated 2026-04-06 from research across portal automation, dashboard architecture, AI scoring/CV tailoring, and competitor analysis (career-ops, paperclip, hermes).

## Vision

An end-to-end automated job application system that discovers jobs, scores them intelligently, tailors CVs, prepares applications, and presents them for human approval before submission. The human decides — the system does everything else.

---

## Phase 1: Dashboard Foundations (Priority: HIGH)

**Goal:** Connect every dashboard page to real DB data, wire authentication, remove mock data dependency.

### 1.1 Data Access Layer
- [ ] Create `dashboard/src/lib/queries.ts` with `React.cache()` wrapped query functions
- [ ] Raw SQL for `applications` table (GENERATED ALWAYS column workaround)
- [ ] Drizzle queries for all other tables (jobs, interviews, emails, cv_packages, etc.)
- [ ] Tenant-scoped: every query filters by `tenant_id`

### 1.2 Wire Clerk Authentication
- [ ] Create/update `dashboard/src/middleware.ts` with `clerkMiddleware`
- [ ] Fix `getCurrentTenantId()` in `lib/auth.ts`: `auth()` -> DB lookup -> tenant_id
- [ ] Set `clerk_user_id` on existing tenant rows (Selvi + Venkat) via SQL
- [ ] Protect all `/dashboard/*` routes, keep `/api/health` and `/sign-in` public

### 1.3 Convert Pages to Live Data
- [ ] `/dashboard` (overview) — replace mock data with DB queries, use `<Suspense>` streaming
- [ ] `/dashboard/applications` — server component with DB query, keep client-side table/kanban
- [ ] `/dashboard/interviews` — server component with DB query
- [ ] `/dashboard/cv` — server component querying `cv_packages` table
- [ ] `/dashboard/emails` — server component joining `emails` + `email_classifications`
- [ ] `/dashboard/linkedin` — server component querying `content_calendar` + `linkedin_profile`
- [ ] `/dashboard/metrics` — server component querying `pipeline_metrics`
- [ ] `/dashboard/settings` — convert to tabbed layout (Profile, Search, Notifications, API Keys)
- [ ] Add `error.tsx` boundaries for each route (replace silent mock fallback)

### 1.4 Remove Mock Data
- [ ] Delete `dashboard/src/lib/mock-data.ts` (1033 lines) once all pages use real data
- [ ] Remove mock imports from all components
- [ ] Remove mock fallback from `/api/pipeline`, `/api/metrics`, `/api/activity` routes

### 1.5 Notifications
- [ ] Install Sonner: `npx shadcn@latest add sonner`
- [ ] Bell icon dropdown in layout header (query `notification_queue`)
- [ ] Sonner toasts for urgent items (interview reminders, offers)
- [ ] Add `swr` for dashboard page polling (30-60s refresh)

**Estimated effort:** 3-4 days

---

## Phase 2: AI Scoring Upgrade (Priority: HIGH)

**Goal:** Replace basic scoring with 10-dimension weighted evaluation using Claude structured outputs.

### 2.1 Scoring Schema
- [ ] Add `score_dimensions JSONB` column to `jobs` table
- [ ] Define 10 dimensions with weights:
  - Role Match (20%, gate-pass) — title, level, responsibilities alignment
  - Skills Alignment (20%, gate-pass) — required vs candidate skills overlap
  - Company Quality (10%) — reputation, stability, growth trajectory
  - Compensation (10%) — salary range vs target
  - Location/Remote (10%) — commute, remote policy
  - Growth Potential (8%) — career progression, learning opportunities
  - Culture Fit (7%) — values alignment, work style
  - Tech Stack (5%) — technology alignment with candidate skills
  - Industry Interest (5%) — sector appeal
  - Application Effort (5%) — ease of application process
- [ ] Gate-pass logic: if Role Match or Skills Alignment < 3/10, cap composite at 40

### 2.2 Scoring Workflow Upgrade
- [ ] Update n8n scoring workflows to use Claude API with structured outputs
- [ ] Use `output_config.format` for guaranteed JSON (no regex parsing)
- [ ] Model: Haiku 4.5 for scoring (~$0.003/job)
- [ ] Prompt caching: cache candidate profile across batch (5-min ephemeral)
- [ ] Calibration: anchor examples in prompt, forced distribution hints

### 2.3 Dashboard Scoring UI
- [ ] Score badge component: `[A+] (4.8)` with color coding in job lists
- [ ] Radar chart + dimension table in job detail view (Recharts)
- [ ] Filter jobs by minimum score/tier in jobs table

**Estimated effort:** 2-3 days

---

## Phase 3: CV Tailoring Pipeline (Priority: HIGH)

**Goal:** Generate ATS-optimized, keyword-injected CVs tailored to each job.

### 3.1 CV Generation Engine
- [ ] JD requirement extraction using Claude (skills, keywords, terminology)
- [ ] STAR achievement reframing from base CV (natural keyword injection)
- [ ] Multiple CV versions: corporate, academic, hybrid
- [ ] Truthfulness guardrails: never fabricate, only reframe existing experience
- [ ] Model: Sonnet 4.6 for writing quality

### 3.2 PDF Generation
- [ ] Puppeteer HTML->PDF pipeline (ATS-parseable text layers)
- [ ] Single-column layout, Arial/Calibri, no tables/graphics
- [ ] Template system: professional, modern, academic variants
- [ ] Store generated CVs in `cv_packages` table with `match_percentage`

### 3.3 Cover Letter Generation
- [ ] UK conventions: salutation/sign-off rules, 250-400 words, 4 paragraphs
- [ ] Template-based with AI-personalised slots (company hooks, JD alignment)
- [ ] Store alongside CV in application documents

### 3.4 Dashboard CV Management
- [ ] CV preview in dashboard (render PDF inline)
- [ ] Download button (working, not placeholder)
- [ ] Side-by-side: original CV vs tailored CV vs JD
- [ ] Edit/regenerate controls

**Estimated effort:** 3-4 days

---

## Phase 4: Auto-Prepare Pipeline (Priority: MEDIUM)

**Goal:** Detect ATS platform, prepare application payload, present for human approval.

### 4.1 ATS Detection
- [ ] URL pattern matcher for Greenhouse, Lever, Ashby, SmartRecruiters, Workday, iCIMS
- [ ] Fallback: DOM analysis for embedded ATS (iframe src, script tags, meta tags)
- [ ] Store detected ATS type on `applications.ats_platform` column

### 4.2 API-Based Application Prep (Greenhouse, Lever, Ashby, SmartRecruiters)
- [ ] Greenhouse: fetch job details via Job Board API, prepare POST payload
- [ ] Lever: fetch posting details, prepare multipart form data
- [ ] Ashby: use `applicationForm.info` for dynamic fields, prepare submit payload
- [ ] SmartRecruiters: fetch configuration (screening questions), prepare candidate payload
- [ ] Store prepared payload in `application_documents` as JSON

### 4.3 Browser-Based Application Prep (Workday, iCIMS, custom)
- [ ] Playwright with stealth plugin for form detection
- [ ] Map form fields to candidate data
- [ ] Pre-fill forms but DO NOT submit
- [ ] Screenshot filled form for human review
- [ ] Human-like timing (2-5 min per form)

### 4.4 Human Approval Flow
- [ ] Dashboard "Ready to Apply" queue showing prepared applications
- [ ] For each: job details, tailored CV, cover letter, pre-filled form preview
- [ ] One-click approve (submits via API or Playwright)
- [ ] Reject with reason (feeds back to scoring calibration)
- [ ] Rate limiting: max 5-10 per day per platform, 10-min gaps

### 4.5 Claude Computer Use (Fallback)
- [ ] For unusual forms where selectors fail
- [ ] Sandboxed environment with virtual display
- [ ] Screenshot-action loop via Claude API
- [ ] Always pause before submit for human confirmation
- [ ] Cost: ~$0.03-0.15/application (Sonnet), budget cap per day

**Estimated effort:** 5-7 days

---

## Phase 5: Email Actions & Integration (Priority: MEDIUM)

**Goal:** Make email actions functional — reply, confirm, decline via n8n webhooks.

### 5.1 Email Action Pipeline
- [ ] Server Actions in dashboard -> n8n webhook -> Gmail API
- [ ] Keep Gmail OAuth tokens in n8n only (security boundary)
- [ ] Actions: confirm interview, decline, reply, forward, archive
- [ ] Draft generation with AI (tone-appropriate for UK job market)

### 5.2 Email Classification Display
- [ ] Filter bar: All / Interview / Rejection / Follow-up / Recruiter / Other
- [ ] Urgent email indicators (red badge)
- [ ] Thread view (group related emails)
- [ ] Link emails to applications automatically

### 5.3 Gmail OAuth Setup
- [ ] Complete Gmail OAuth in n8n for both tenants
- [ ] Test email ingestion workflow (wf5-ingest-mt)
- [ ] Verify classification pipeline (wf5-classify-mt)

**Estimated effort:** 2-3 days

---

## Phase 6: Interview Prep Upgrade (Priority: MEDIUM)

**Goal:** Auto-generated prep briefs with company research and STAR story matching.

### 6.1 Story Bank
- [ ] Create `star_stories` table (situation, task, action, result, skills_demonstrated, roles_applicable)
- [ ] Seed with candidate's key achievements
- [ ] AI-generated story suggestions from CV history

### 6.2 Prep Brief Generation
- [ ] JD analysis + company research + STAR story matching
- [ ] Companies House API integration (free UK company data)
- [ ] News/Glassdoor research for culture insights
- [ ] Common question prediction by role type
- [ ] Prep brief display in dashboard interview detail page

### 6.3 Interview Tracking
- [ ] Working calendar integration (interview date/time)
- [ ] Pre-interview checklist
- [ ] Post-interview debrief capture
- [ ] Follow-up email automation

**Estimated effort:** 2-3 days

---

## Phase 7: LinkedIn Intelligence (Priority: LOW)

**Goal:** Make LinkedIn features functional — content generation, profile optimization.

### 7.1 Content Calendar
- [ ] AI-generated post drafts based on job search themes
- [ ] Scheduling and publishing workflow
- [ ] Performance tracking (if LinkedIn API allows)

### 7.2 Profile Optimization
- [ ] Profile-CV alignment check (already have wf7-alignment-mt)
- [ ] Keyword suggestions for profile sections
- [ ] Recruiter engagement tracking

**Estimated effort:** 2-3 days

---

## Phase 8: Production Hardening (Priority: HIGH, parallel with above)

**Goal:** Make deployment reliable, secure, and maintainable.

### 8.1 HTTPS & Routing
- [ ] Fix Traefik routing to dashboard (currently HTTP only on port 3001)
- [ ] Consolidate deployment: single approach (compose OR Dokploy app, not both)
- [ ] SSL certificate auto-renewal verification

### 8.2 Security
- [ ] Audit all API routes for auth checks
- [ ] Remove any hardcoded credentials from code
- [ ] Rate limiting on API routes
- [ ] CORS configuration

### 8.3 Monitoring
- [ ] Health check endpoint improvements
- [ ] n8n workflow failure alerting (email on workflow error)
- [ ] Database backup strategy (pg_dump cron)
- [ ] Disk space monitoring (Hetzner CAX31 has limited storage)

### 8.4 CI/CD
- [ ] GitHub Actions: lint, build, test on PR
- [ ] Auto-deploy to server on merge to main
- [ ] Database migration strategy (version-controlled, idempotent)

**Estimated effort:** 2-3 days

---

## Priority Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|-------------|
| 1. Dashboard Foundations | HIGH | 3-4 days | None |
| 2. AI Scoring Upgrade | HIGH | 2-3 days | None (parallel with P1) |
| 8. Production Hardening | HIGH | 2-3 days | None (parallel with P1) |
| 3. CV Tailoring Pipeline | HIGH | 3-4 days | Phase 2 (scoring) |
| 4. Auto-Prepare Pipeline | MEDIUM | 5-7 days | Phase 3 (CV), Phase 1 (dashboard) |
| 5. Email Actions | MEDIUM | 2-3 days | Phase 1 (dashboard) |
| 6. Interview Prep | MEDIUM | 2-3 days | Phase 1 (dashboard) |
| 7. LinkedIn Intelligence | LOW | 2-3 days | Phase 1 (dashboard) |

**Total estimated effort:** 22-30 days

**Recommended execution order:**
1. Phases 1 + 2 + 8 in parallel (first week)
2. Phase 3 (second week)
3. Phases 4 + 5 in parallel (third week)
4. Phases 6 + 7 (fourth week)

---

## Architecture Principles

1. **Human-in-the-loop**: AI prepares, human approves. No autonomous submissions.
2. **API-first for ATS**: Use direct APIs where available (Greenhouse, Lever, Ashby, SmartRecruiters). Browser automation only for Workday/iCIMS/custom.
3. **Cost-efficient AI**: Haiku for scoring, Sonnet for writing. Prompt caching across batches. ~$15/month per tenant.
4. **n8n for orchestration, dashboard for display**: Keep automation logic in n8n, keep UI in Next.js. Gmail OAuth stays in n8n.
5. **Multi-tenant from day one**: Every query scoped by tenant_id.

---

## Monthly AI Cost Estimate (per tenant)

| Service | Model | Volume | Cost |
|---------|-------|--------|------|
| Job scoring | Haiku 4.5 | 3,000 jobs/month | $8-10 |
| CV tailoring | Sonnet 4.6 | 50 CVs/month | $3-5 |
| Cover letters | Sonnet 4.6 | 50 letters/month | $2-3 |
| Interview prep | Sonnet 4.6 | 10 briefs/month | $1-2 |
| Computer Use (fallback) | Sonnet 4.6 | 10 forms/month | $1-2 |
| **Total** | | | **~$15-22/month** |
