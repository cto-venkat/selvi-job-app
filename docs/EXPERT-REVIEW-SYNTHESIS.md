# JobPilot Roadmap: Expert Review Synthesis

> 5 expert reviews conducted 2026-04-06. Consensus is clear and damning.

## Scores

| Expert | Rating | One-line verdict |
|--------|--------|-----------------|
| Senior Product Manager | 4/10 | Engineering spec masquerading as a product roadmap |
| Staff Engineer | 4/10 | Enterprise architecture for a 2-user tool |
| AI/ML Engineering Lead | 5/10 | No eval framework, LLM overuse, cost underestimated |
| Cybersecurity Lead | 2/10 | Active security vulnerabilities, zero compliance |
| UK Recruitment Insider | 4/10 | Optimizes for the lowest-value hiring channel |

**Average: 3.8/10**

---

## Consensus Themes (All 5 experts agree)

### 1. WRONG PROBLEM BEING SOLVED
- The system optimizes for cold job board applications (15-20% of UK hires)
- Ignores recruiter visibility, referrals, and LinkedIn (60-70% of UK hires)
- LinkedIn Intelligence is marked LOW priority when it should be highest
- "Building a machine to dominate the channel with the worst signal-to-noise ratio"

### 2. MASSIVELY OVER-ENGINEERED FOR 2 USERS
- Multi-tenancy, Clerk auth, notification queues, SWR polling, 45+ tables for Selvi and Venkat
- 17 distinct systems for one developer to maintain
- Career-Ops achieves similar results with Markdown files and YAML
- "Build the tool you need today, not the platform you imagine needing someday"

### 3. SECURITY IS A BLOCKER, NOT A PARALLEL TRACK
- Dashboard is publicly accessible with zero authentication
- All credentials in plaintext in MEMORY.md
- No GDPR compliance (DPIA mandatory for automated profiling in UK)
- Hardcoded tenant ID = active data exposure risk
- "Nothing else matters if ICO comes knocking"

### 4. NO WAY TO MEASURE IF IT WORKS
- Zero KPIs, success metrics, or eval frameworks
- No feedback loop from interview outcomes to scoring calibration
- No A/B testing of tailored vs original CVs
- "Building a plane and planning to test it by flying it"

### 5. AUTO-APPLY IS AN ARMS RACE YOU'LL LOSE
- ATS vendors actively building anti-automation (AI detection, CAPTCHAs, keystroke analysis)
- Recruiters drowning in AI applications — spray-and-pray candidates get filtered
- Browser automation with stealth plugins = adversarial posture with legal risk
- Phase 4 estimated at "5-7 days" — multiple experts say months

---

## Top Recommendations by Expert

### Product Manager
1. Add Phase 0: end-to-end proof of life for 1 ATS platform
2. Flip priority — pipeline before dashboard
3. Decide: personal tool or SaaS (then commit)
4. Define 3 success metrics before building anything
5. Kill LinkedIn Intelligence phase — wait, no, it should be highest priority

### Staff Engineer
1. Rip out multi-tenancy and Clerk — use simple user_id + basic auth
2. Replace Docker Swarm/Dokploy/Traefik with docker-compose + Caddy
3. Cancel Phase 4 (auto-apply) — manual application at 50/month is faster than building automation
4. Drop to 7 database tables, delete the other 38+
5. Reduce n8n from 33 workflows to 10

### AI/ML Lead
1. Hybrid scorer — 4 of 10 dimensions are deterministic (no LLM needed)
2. Build eval suite BEFORE writing AI code (20 JDs, expected scores, tenant ratings)
3. Drop Claude Computer Use entirely
4. Fix CV quantification — remove fabricated metrics
5. Version all prompts, tie to scores

### Security Lead
1. ROTATE ALL CREDENTIALS NOW (all are compromised)
2. Block public dashboard access TODAY (basic auth minimum)
3. Authentication before any other development
4. Conduct DPIA before launch (UK GDPR mandatory)
5. Lock down data processing chain (DPAs with all third parties)

### UK Recruitment Insider
1. LinkedIn profile optimization should be Phase 1 (not Phase 7)
2. Cap applications at 10-15/week maximum (quality over quantity)
3. Kill Playwright/browser automation entirely
4. Add "target company" research workflow (20 companies, deep research)
5. Build salary benchmarking with Adzuna data

---

## What Should Change: Revised Priority Order

### IMMEDIATE (this week, before any features)
- [ ] Rotate all credentials
- [ ] Add basic auth to public dashboard
- [ ] Firewall Dokploy admin panel
- [ ] Fix hardcoded tenant ID

### Phase 0: Prove the Core Loop (1 week)
- [ ] 1 job discovered -> scored -> CV tailored -> human approves -> applied (1 ATS)
- [ ] Define 3 success metrics (apps/week, callback rate, time saved)
- [ ] Decide: personal tool or product (then strip multi-tenancy if personal)

### Phase 1: Security & Auth (must come first)
- [ ] Clerk middleware on all routes OR replace with simple auth
- [ ] HTTPS on dashboard
- [ ] DPIA for automated profiling
- [ ] Data retention policy

### Phase 2: LinkedIn & Recruiter Visibility (highest ROI)
- [ ] LinkedIn profile optimization
- [ ] Target company list (20 companies, deep research)
- [ ] Recruiter visibility features

### Phase 3: Scoring Upgrade (simplified)
- [ ] Hybrid scorer: 4 deterministic + 6 LLM dimensions
- [ ] 3-tier output (Apply / Maybe / Skip) not 10-dimension radar charts
- [ ] Eval suite with 20 real JDs
- [ ] Feedback loop from outcomes

### Phase 4: CV Tailoring (with guardrails)
- [ ] Single template first (not 3 variants)
- [ ] No fabricated metrics — only real numbers from profile
- [ ] Human editing workflow with learning
- [ ] A/B test: tailored vs original

### Phase 5: Dashboard (minimal)
- [ ] Connect pages to real DB data
- [ ] Remove mock data
- [ ] Notifications via Telegram (not bell icon + Sonner + SWR)
- [ ] Simple settings page

### KILLED from roadmap
- Phase 4 browser automation (Playwright/Computer Use for form filling)
- Multi-tenant architecture (use simple user_id)
- Notification queue infrastructure
- SWR polling
- Recharts radar charts
- Command palette
- Cover letter generation (deprioritized)
- LinkedIn content calendar and posting
- Multiple CV template variants

---

## The Hard Questions to Answer

1. **Is this a personal tool or a product?** Every expert flagged this. The answer changes everything.
2. **Why not just use Career-Ops?** It's open source, proven, and does most of what JobPilot does.
3. **Is auto-apply actually valuable?** If quality > quantity, and 10-15 targeted apps/week > 50 automated ones, the entire auto-apply module may be solving the wrong problem.
4. **What's the actual time savings?** If manual application takes 10 min and you apply to 50/month, that's 8 hours. Is building months of automation worth saving 8 hours/month?

---

## Bottom Line

The experts converge on one message: **stop building infrastructure and start proving value.** Get one job discovered, scored, CV tailored, and applied — end to end. Measure if the AI scoring actually predicts interviews. Measure if tailored CVs get more callbacks. Then decide what to build next based on data, not assumptions.

The biggest strategic error is optimizing for cold applications when UK hiring is dominated by recruiters, referrals, and LinkedIn. The second biggest is treating security as optional when the system handles sensitive personal data under UK GDPR.
