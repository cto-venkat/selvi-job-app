# AI-Powered Job Scoring & CV Tailoring: Upgrade Research

**Date:** 2026-04-06
**Context:** JobPilot system (n8n + Postgres + Next.js dashboard), UK job seekers
**Current state:** Basic 6-dimension scoring via Claude Haiku, simple CV tailoring via Sonnet
**Goal:** Production-grade multi-dimensional scoring, CV tailoring, cover letters, interview prep

---

## 1. Multi-Dimensional Job Scoring

### 1.1 Current System Gaps

The existing `wf5-scoring-mt.json` workflow has several problems:

- **Only 6 dimensions** (title, seniority, location, salary, skills, sector) -- missing career growth, culture fit, interview likelihood, timeline urgency
- **Flat weighting** -- no gate-pass logic, a perfect location score can mask terrible role fit
- **No calibration** -- scores cluster around 50-70, poor differentiation between B and C tier
- **Prompt asks for free-text JSON** -- no structured output guarantee, relies on regex parsing
- **No prompt caching** -- the candidate profile is re-sent every call
- **Hardcoded candidate profile** in the prompt rather than pulled from `master_profiles`

### 1.2 Recommended Scoring Framework: 10 Weighted Dimensions

Based on Career-Ops (santifer) which evaluated 740+ offers across 10 dimensions with A-F grading, adapted for UK L&D/academic roles:

| Dimension | Weight | Gate-Pass? | What It Measures |
|-----------|--------|------------|------------------|
| **Role Match** | 0.20 | YES | Title alignment, responsibility overlap with candidate experience |
| **Skills Alignment** | 0.15 | YES | Required skills vs candidate's proven skills (L&D, CIPD, etc.) |
| **Seniority Match** | 0.12 | No | Level appropriate? Over/under-qualified? Stretch vs comfortable? |
| **Compensation Fit** | 0.10 | No | Salary range vs target (GBP 70-80k corporate, pro-rata academic) |
| **Location/Commute** | 0.10 | No | Distance from Maidenhead, remote/hybrid options, train commute feasibility |
| **Sector Fit** | 0.08 | No | Corporate L&D vs academic vs public sector vs consulting alignment |
| **Growth Trajectory** | 0.08 | No | Career ladder visibility, promotion path, scope expansion potential |
| **Company Quality** | 0.07 | No | Company size, reputation, stability, employer brand |
| **Interview Likelihood** | 0.05 | No | How likely to get an interview based on competition, requirement strictness |
| **Timeline/Urgency** | 0.05 | No | Closing speed, start date flexibility, hiring urgency signals |

**Gate-pass logic:** If Role Match < 3/10 OR Skills Alignment < 3/10, cap the final score at 40 regardless of other dimensions. This prevents high location/salary scores from inflating irrelevant jobs.

**Grading scale (0-100 composite):**
- **A**: 80-100 -- Apply immediately, prioritise CV tailoring
- **B**: 65-79 -- Strong candidate, worth applying
- **C**: 45-64 -- Marginal fit, apply if pipeline is thin
- **D**: 0-44 -- Skip unless desperation mode

### 1.3 Structured Output via Claude API

**Stop using regex parsing.** The current workflow does `content.match(/\{[\s\S]*\}/)` which breaks on nested JSON or markdown code fences. Use Claude's native structured outputs instead.

**API call with `output_config` (recommended approach):**

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Score this job against the candidate profile...\n\n[JD text]\n\n[Candidate profile]"
    }
  ],
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "role_match": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "skills_alignment": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" },
              "matched_skills": {
                "type": "array",
                "items": { "type": "string" }
              },
              "missing_skills": {
                "type": "array",
                "items": { "type": "string" }
              }
            },
            "required": ["score", "evidence", "matched_skills", "missing_skills"],
            "additionalProperties": false
          },
          "seniority_match": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "compensation_fit": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "location_commute": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "sector_fit": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "growth_trajectory": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "company_quality": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "interview_likelihood": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "timeline_urgency": {
            "type": "object",
            "properties": {
              "score": { "type": "integer", "minimum": 1, "maximum": 10 },
              "evidence": { "type": "string" }
            },
            "required": ["score", "evidence"],
            "additionalProperties": false
          },
          "overall_reasoning": { "type": "string" },
          "red_flags": {
            "type": "array",
            "items": { "type": "string" }
          },
          "green_flags": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": [
          "role_match", "skills_alignment", "seniority_match",
          "compensation_fit", "location_commute", "sector_fit",
          "growth_trajectory", "company_quality", "interview_likelihood",
          "timeline_urgency", "overall_reasoning", "red_flags", "green_flags"
        ],
        "additionalProperties": false
      }
    }
  }
}
```

**Key benefits over current approach:**
- Schema is compiled into a grammar at inference time -- guaranteed valid JSON
- No regex parsing, no try/catch fallbacks
- First call has ~1s extra latency for grammar compilation; cached for 24 hours after
- Works with Haiku 4.5, Sonnet 4.6, and Opus 4.6

### 1.4 Scoring Calibration

**Problem:** LLMs tend to score generously. In the current system, most jobs land 50-70, making B/C tiers indistinguishable.

**Calibration strategies:**

1. **Anchor scoring with examples in the system prompt:**
```
SCORING CALIBRATION:
- A score of 1-2 means NO alignment (e.g., a warehouse driver role for an L&D professional)
- A score of 3-4 means WEAK alignment (e.g., a generic HR admin role)
- A score of 5-6 means MODERATE alignment (e.g., a Training Coordinator role -- related but junior)
- A score of 7-8 means STRONG alignment (e.g., an L&D Manager role with 80%+ skills match)
- A score of 9-10 means NEAR-PERFECT alignment (e.g., Head of L&D at a corporate with exact experience match)

Use the FULL range. Most jobs should score 3-6. Scores of 8+ should be rare (< 15% of jobs).
A composite score of 80+ (A-tier) should represent < 10% of all scored jobs.
```

2. **Forced distribution hint:**
```
If you have scored 3+ consecutive jobs above 70, recalibrate. The median job should score ~50.
```

3. **Post-hoc calibration in code:** After the LLM call, apply a statistical adjustment:
```javascript
// In the n8n Code node after scoring
function calibrate(rawComposite, recentScores) {
  // If average of last 20 scores > 65, apply deflation
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  if (avg > 65) {
    const deflation = (avg - 55) * 0.3; // Pull toward 55 mean
    return Math.max(10, rawComposite - deflation);
  }
  return rawComposite;
}
```

4. **Periodic recalibration:** Weekly job that compares tier distribution against targets (A: 10%, B: 20%, C: 40%, D: 30%) and adjusts thresholds.

### 1.5 Cost Analysis: Which Model for Scoring?

**Token estimates per scoring call:**
- Input: ~800 tokens (system prompt + profile) + ~600 tokens (JD) = ~1,400 tokens
- Output: ~400 tokens (structured JSON with evidence)

**Cost per job scored:**

| Model | Input Cost | Output Cost | Total/Job | 100 jobs/day | 3,000 jobs/month |
|-------|-----------|-------------|-----------|--------------|------------------|
| Haiku 4.5 | $0.0014 | $0.0020 | $0.0034 | $0.34 | $10.20 |
| Sonnet 4.6 | $0.0042 | $0.0060 | $0.0102 | $1.02 | $30.60 |
| Opus 4.6 | $0.0070 | $0.0100 | $0.0170 | $1.70 | $51.00 |

**With prompt caching (candidate profile as cached prefix):**
- Cache write (first call): 1.25x input price
- Cache read (subsequent calls): 0.1x input price
- ~800 tokens of the 1,400 input are the static profile = 57% cacheable
- Effective savings: ~50% on input after first call

| Model | With Caching/Job | 3,000 jobs/month |
|-------|-----------------|------------------|
| Haiku 4.5 | $0.0027 | $8.10 |
| Sonnet 4.6 | $0.0081 | $24.30 |

**With batch processing (50% discount, 24h turnaround):**

| Model | Batch + Cache/Job | 3,000 jobs/month |
|-------|------------------|------------------|
| Haiku 4.5 | $0.0014 | $4.05 |
| Sonnet 4.6 | $0.0041 | $12.15 |

**Recommendation:** Use **Haiku 4.5** for all scoring. At $4-10/month for 3,000 jobs, the cost is negligible. Haiku with structured outputs produces reliable JSON. Reserve Sonnet for CV generation where quality matters more. No reason to use Opus for scoring.

### 1.6 Prompt Caching Implementation

The candidate profile is identical across all scoring calls for a given tenant. Cache it:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "system": [
    {
      "type": "text",
      "text": "You are a UK recruitment specialist scoring jobs for a candidate...\n\nCANDIDATE PROFILE:\n[full profile text here]\n\nSCORING CALIBRATION:\n[calibration instructions here]",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "Score this job:\n\nTitle: {{ title }}\nCompany: {{ company }}\n..."
    }
  ],
  "output_config": { ... }
}
```

The `cache_control: { "type": "ephemeral" }` on the system message creates a 5-minute cache. Since the scoring workflow processes 25 jobs per batch every 30 minutes, all jobs in a batch share the cached prefix.

**Cache isolation:** Since February 2026, caches are workspace-level isolated, so multiple tenants won't cross-contaminate.

### 1.7 Batch Processing for Bulk Scoring

For non-urgent scoring (e.g., nightly batch of all new jobs), use the Message Batches API:

```javascript
// n8n HTTP Request node
const batchRequest = {
  requests: jobs.map((job, i) => ({
    custom_id: `score-${job.id}`,
    params: {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildJobPrompt(job) }],
      output_config: { format: { type: "json_schema", schema: scoringSchema } }
    }
  }))
};
// POST to https://api.anthropic.com/v1/messages/batches
// Poll for results, 50% cost reduction, up to 100k jobs per batch
```

**Batch limits:** 100,000 requests or 256 MB per batch. For this system, that is effectively unlimited.

---

## 2. CV Tailoring with AI

### 2.1 Current System Gaps

The existing `wf8-cv-mt.json` does:
1. JD analysis with Haiku (good)
2. CV generation with Sonnet (good model choice)

But has problems:
- Prompt was originally written for Ollama/qwen2.5 and ported to Claude without optimisation
- No keyword density analysis or ATS scoring
- Generates a single CV type (corporate_ld or academic) but never actually creates multiple versions
- No QA step -- `qa_pass = true` and `qa_score = 80` are hardcoded
- No cover letter generation
- Output is JSON, not formatted DOCX/PDF

### 2.2 JD Requirements Extraction (Improved Prompt)

Replace the current generic extraction with a structured approach:

```
You are a UK recruitment analyst specialising in L&D and academic roles.

Analyse this job description and extract structured requirements.

JOB:
Title: {{ title }}
Company: {{ company }}
Description: {{ description }}

Extract:
1. ROLE TYPE: corporate_ld | academic | hybrid | consulting | public_sector
2. ESSENTIAL REQUIREMENTS: skills/qualifications explicitly marked as essential or "must have"
3. DESIRABLE REQUIREMENTS: skills/qualifications marked as "nice to have" or "desirable"
4. KEYWORDS: exact phrases from the JD that an ATS would match against (use the JD's own wording)
5. CIPD REQUIREMENT: none | mentioned | essential | specific_level (state which level)
6. SENIORITY SIGNALS: what level is this? (junior/mid/senior/head/director)
7. CULTURAL SIGNALS: what does the language tell you about the company culture?
8. RED FLAGS: unrealistic requirements, lowball salary for scope, signs of a toxic environment
9. APPLICATION HOOKS: specific things the candidate could reference to personalise the application
```

Use `output_config` with a JSON schema for guaranteed structure.

### 2.3 Keyword Injection Strategies

**Problem:** Crude keyword stuffing gets flagged by modern ATS (and human reviewers). Natural integration is key.

**Strategy 1: Mirror the JD's exact phrasing in context**
- If JD says "stakeholder management" -- use that exact phrase in an achievement bullet, not "working with stakeholders"
- If JD says "Learning Management System (LMS)" -- use the full phrase with acronym on first mention

**Strategy 2: Achievement-framing keywords (STAR format)**
Instead of a skills list, weave keywords into accomplishment bullets:
```
BEFORE (keyword stuffing):
Skills: Stakeholder Management, Change Management, LMS, CIPD Level 7

AFTER (natural integration):
- Led stakeholder management across 4 business units, securing buy-in for a
  change management programme that increased L&D participation by 35%
- Implemented and administered a Learning Management System (LMS) supporting
  2,500 learners, achieving 92% completion rates on mandatory training
```

**Strategy 3: Skills taxonomy matching**
Modern ATS systems use skills taxonomies (EMSI Burning Glass, Lightcast). Map JD keywords to their taxonomic equivalents:
- "people development" = "talent development" = "employee development" (use all three if space allows)
- "CIPD" near "Level 7" or "Chartered" signals the exact qualification node

**Strategy 4: Section-specific placement**
- **Professional summary:** 3-4 top keywords naturally worked into narrative
- **Job titles:** Match the JD's title phrasing where truthful (e.g., if your role was "Training Manager" but JD says "L&D Manager", only use "L&D Manager" if that was genuinely your title or a close variant)
- **Achievement bullets:** 1-2 keywords per bullet, evidence-based
- **Skills section:** Direct keyword list as a catch-all for ATS scanning

### 2.4 Truthfulness Guardrails

The CV system must never fabricate experience. Enforce this in the prompt:

```
TRUTHFULNESS RULES (ABSOLUTE):
1. NEVER invent job titles, employers, dates, or qualifications the candidate does not have
2. NEVER claim skills the candidate has not demonstrated in their profile
3. You MAY reframe genuine experience using the JD's terminology where accurate
4. You MAY emphasise certain achievements over others based on relevance
5. You MAY adjust professional summary and objective to match the role
6. Flag any JD requirements the candidate genuinely cannot meet as "gaps"
7. For each work experience bullet, it must be traceable to the candidate's actual profile data
```

### 2.5 STAR Achievement Generation

Generate achievement bullets from base CV data using STAR format:

```
For each work experience entry, generate 3-5 achievement bullets in STAR format:
- Situation: brief context (1 clause)
- Task: what you needed to achieve
- Action: specific actions taken (use active verbs)
- Result: quantified outcome where possible

EXAMPLE from candidate profile data:
Input: "Managed training programmes at Vodafone for 500+ employees"
Output: "Designed and delivered a blended learning programme for 500+ Vodafone
employees across 3 UK regions, achieving a 28% improvement in post-training
assessment scores and reducing onboarding time by 2 weeks."

RULES:
- Quantify results wherever the profile provides data
- If no specific numbers exist, use reasonable estimates with "approximately" or "c."
- UK English throughout (programme, organisation, behaviour, etc.)
- Active voice, past tense for previous roles, present tense for current role
```

### 2.6 Multiple CV Versions

For each A/B-tier job, generate up to 3 CV variants:

| Version | When to Use | Key Differences |
|---------|-------------|-----------------|
| **Corporate L&D** | Corporate/private sector L&D roles | Business language, ROI focus, "programme" not "module", CIPD front and centre |
| **Academic** | University lecturer/senior lecturer | Research/publications emphasis, "teaching and learning" language, academic qualifications prominent, REF/TEF awareness |
| **Hybrid** | Roles straddling both worlds (e.g., corporate university, professional development in HE) | Balanced language, both practitioner and scholarly credentials highlighted |

The current system has `cv_type_recommended` in JD analysis but only generates one version. The upgrade should:
1. Always generate the recommended type
2. For A-tier jobs, also generate the next-closest type as a fallback
3. Store both in `cv_packages` with a `variant` field

### 2.7 CV Quality Assurance

Replace the hardcoded `qa_pass = true` with an actual QA step:

```
QA CHECKLIST (score each 0-10):
1. KEYWORD COVERAGE: What % of essential JD keywords appear in the CV?
2. TRUTHFULNESS: Does every claim trace to the candidate profile?
3. ATS FORMATTING: Clean sections, no tables/columns, standard headings?
4. LENGTH: 2 pages for corporate, 3-4 for academic (UK convention)?
5. RECENCY BIAS: Are most-relevant recent roles given most space?
6. QUANTIFICATION: Do 60%+ of bullets include a number/metric?
7. UK CONVENTIONS: UK English, no "resume" language, proper date formats?

PASS: Average score >= 7 AND no single dimension below 5
```

---

## 3. Cover Letter Generation

### 3.1 UK-Specific Conventions

UK cover letters follow strict conventions that differ from US norms:

- **Length:** One A4 page, 3-4 focused paragraphs, 250-400 words
- **Format:** Business letter format with candidate address, employer address, date (DD/MM/YYYY)
- **Salutation:** "Dear Mr/Ms [Surname]" with "Yours sincerely" OR "Dear Hiring Manager" with "Yours faithfully" (not mixing these is critical)
- **Font:** Arial, Calibri, or Times New Roman, 10-12pt
- **File format:** PDF for email, DOCX for ATS portal uploads
- **Tone:** Professional but not stiff, confident but not arrogant, UK-understated not US-promotional

### 3.2 Architecture: Template + AI Personalisation

**Do not generate fully from scratch each time.** Use a template with AI-personalised slots:

```
TEMPLATE STRUCTURE:

[Header: candidate contact details]
[Date: DD Month YYYY]
[Employer address if known]

Dear [Mr/Ms Surname | Hiring Manager],

PARAGRAPH 1 - HOOK (2-3 sentences):
{{ ai_generated_hook }}
References the specific role, company, and one personalisation signal.

PARAGRAPH 2 - VALUE PROPOSITION (3-4 sentences):
{{ ai_generated_value }}
Maps 2-3 key JD requirements to candidate's strongest evidence.

PARAGRAPH 3 - CULTURAL FIT / WHY THIS COMPANY (2-3 sentences):
{{ ai_generated_culture }}
Shows knowledge of the company beyond the JD.

PARAGRAPH 4 - CLOSE (2 sentences):
{{ ai_generated_close }}
Availability, enthusiasm, call to action.

Yours [sincerely/faithfully],
[Candidate name]
```

### 3.3 Personalisation Signals

The AI should look for and incorporate:

1. **Company news:** Recent press releases, awards, expansions (search company name + "news" in the last 90 days)
2. **Job-specific hooks:** Unique aspects of the JD that aren't generic boilerplate
3. **Industry context:** Relevant trends in L&D or HE that the company would care about
4. **Mutual connections:** If LinkedIn data shows shared connections or alumni networks
5. **Company values:** From their careers page or "about us" -- mirror their language subtly

**n8n implementation:** Add a "Company Research" node before cover letter generation that hits a search API (Google Custom Search or similar) for `"[company name]" news OR award OR expansion site:uk` and feeds the top 3 results as context.

### 3.4 Cover Letter Prompt

```
You are a UK careers advisor helping write a cover letter for a [corporate L&D | academic] role.

CANDIDATE: [name], [current title], [key qualifications]
ROLE: [title] at [company]
KEY JD REQUIREMENTS: [from JD analysis]
COMPANY CONTEXT: [from company research]
PERSONALISATION SIGNALS: [any hooks found]

Write a cover letter following UK conventions:
- 250-400 words, one A4 page
- 4 paragraphs: hook, value proposition, cultural fit, close
- Mirror the JD's language where natural
- Reference one specific company detail (not generic flattery)
- UK English throughout
- Professional but warm tone
- Do NOT use phrases: "I am writing to apply for", "I believe I am the ideal candidate",
  "I am confident that", "I would welcome the opportunity" (these are flagged as AI-generated)
- DO use: direct opening referencing the role, evidence-based claims, specific company knowledge
```

---

## 4. Interview Preparation with AI

### 4.1 Interview Prep Brief Generation

For each A/B-tier job where the candidate has applied, auto-generate a prep brief:

```
PREP BRIEF STRUCTURE:
1. COMPANY OVERVIEW (2-3 paragraphs)
   - What they do, size, recent news, culture signals
   - Key people (hiring manager if known, department head)

2. ROLE ANALYSIS (bullet points)
   - Why this role exists (growth? replacement? new function?)
   - Key challenges the successful candidate will face
   - Success metrics (what would "good" look like in 6 months?)

3. LIKELY QUESTIONS (8-12 questions)
   - 3-4 competency-based (STAR format expected)
   - 2-3 technical/domain-specific
   - 2-3 motivational/cultural
   - 1-2 curveball/scenario questions

4. STAR STORY MATCHES (for each competency question)
   - Matched from the candidate's STAR story bank
   - Adapted phrasing for this specific role

5. QUESTIONS TO ASK (5-6)
   - 2 about the role/team
   - 2 about company strategy/culture
   - 1 about development/growth
   - 1 insightful question based on company research

6. SALARY NEGOTIATION NOTES
   - Market rate data for this role/location
   - Candidate's target vs posted range
   - Negotiation strategy
```

### 4.2 Question Prediction by Role Type

Build a question bank that maps role types to likely questions:

**Corporate L&D Manager/Head:**
- "Tell me about a time you designed a learning programme that measurably improved business outcomes."
- "How do you measure ROI on L&D initiatives?"
- "Describe your approach to needs analysis across multiple stakeholders."
- "How would you handle resistance to a new learning platform from senior leaders?"
- "What's your experience with digital/blended learning transformation?"
- "How do you stay current with L&D trends and best practices?"

**University Lecturer/Senior Lecturer:**
- "What is your teaching philosophy?"
- "How do you incorporate research into your teaching?"
- "Describe your approach to inclusive teaching and assessment."
- "What research are you currently working on and how does it align with our department?"
- "How would you contribute to the REF/TEF?"
- "Tell me about your experience with curriculum design and validation."

### 4.3 STAR Story Bank

Maintain a structured story bank in the database:

```sql
CREATE TABLE star_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  situation TEXT NOT NULL,
  task TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  competencies TEXT[] NOT NULL,  -- e.g., ['leadership', 'change_management', 'stakeholder_management']
  role_context TEXT,             -- e.g., 'Vodafone L&D Manager'
  strength_rating INTEGER,      -- 1-5 how strong is this story
  last_used_for UUID,           -- job_id last matched to
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Story matching prompt:**
```
Given these interview questions for a [role] at [company]:
[questions list]

And this bank of STAR stories:
[stories JSON]

For each question, select the best matching story and adapt it:
1. Choose the story whose competencies best match the question
2. Reframe the Situation to connect to the target company's context
3. Adjust Action verbs to mirror the JD's language
4. Keep the Result factual -- do not inflate numbers
5. If no story matches well, flag it as a "gap" needing preparation
```

### 4.4 Company Research Automation

**Sources to scrape/search:**
1. **Company website:** About page, careers page, news/blog
2. **Companies House:** Filing data, company size, incorporation date (free API)
3. **Glassdoor:** Ratings, interview reviews, salary data (requires scraping or API)
4. **LinkedIn:** Company page, employee count, growth rate, key people
5. **News:** Google News search for company name + sector
6. **UCAS/TEF data:** For academic roles, university rankings and TEF rating

**n8n implementation:** Create a `wf9-company-research.json` workflow triggered when a job reaches "interview" status:
1. Scrape company website (HTTP Request + HTML Extract)
2. Companies House API lookup (free, no auth needed for basic data)
3. Google Custom Search for recent news
4. Compile into structured research brief
5. Store in a `company_research` table
6. Feed into interview prep brief generation

---

## 5. Prompt Engineering Best Practices

### 5.1 System Prompt Pattern for Scoring

```
<system>
You are a UK recruitment specialist with deep knowledge of the L&D and Higher Education sectors.

Your task is to score job opportunities for a specific candidate. You evaluate each job
across 10 dimensions and provide evidence-based scores.

CANDIDATE PROFILE:
{{ candidate_profile_text }}

SCORING CALIBRATION:
- Use the FULL 1-10 range. A score of 5 means "average relevance."
- Most jobs should cluster around 4-6 on most dimensions.
- Scores of 8+ should be rare -- reserved for genuinely excellent matches.
- Scores of 1-2 indicate active misalignment, not just absence of information.
- When information is missing from the JD (e.g., no salary listed), score that dimension 5
  (neutral) rather than penalising.
- Your evidence field should cite specific text from the JD that supports the score.

GATE-PASS RULES:
- If role_match.score < 3, the job is fundamentally wrong. Note this in overall_reasoning.
- If skills_alignment.score < 3, the candidate lacks core requirements. Note this.

RED FLAGS to watch for:
- "Must have 10+ years in [niche the candidate lacks]"
- Salary significantly below market for the seniority
- Location incompatible with Maidenhead commute
- Signs of role being misclassified (admin disguised as management)
</system>
```

### 5.2 Prompt Caching Pattern

Structure API calls so the static prefix is cached:

```
Request 1 (cache write):
  system: [{ text: "...[profile + calibration]...", cache_control: { type: "ephemeral" } }]
  messages: [{ role: "user", content: "Score: [Job 1 JD]" }]

Request 2-25 (cache read, 90% cheaper input):
  system: [{ text: "...[IDENTICAL profile + calibration]...", cache_control: { type: "ephemeral" } }]
  messages: [{ role: "user", content: "Score: [Job 2 JD]" }]
```

The system prompt (profile + calibration) must be byte-identical across calls. Do not include timestamps or per-request context in the cached block.

**Minimum cacheable length:** 1,024 tokens for Haiku, 2,048 for Sonnet. The candidate profile + scoring instructions easily exceed this.

### 5.3 n8n Implementation Pattern

In the current n8n workflow, the Claude call is a raw HTTP Request node. For structured outputs, update the JSON body:

```javascript
// In the n8n Code node that prepares the Claude request
const scoringSchema = {
  type: "object",
  properties: {
    role_match: { type: "object", properties: { score: { type: "integer" }, evidence: { type: "string" } }, required: ["score", "evidence"], additionalProperties: false },
    skills_alignment: { type: "object", properties: { score: { type: "integer" }, evidence: { type: "string" }, matched_skills: { type: "array", items: { type: "string" } }, missing_skills: { type: "array", items: { type: "string" } } }, required: ["score", "evidence", "matched_skills", "missing_skills"], additionalProperties: false },
    // ... remaining 8 dimensions ...
    overall_reasoning: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    green_flags: { type: "array", items: { type: "string" } }
  },
  required: ["role_match", "skills_alignment", "seniority_match", "compensation_fit", "location_commute", "sector_fit", "growth_trajectory", "company_quality", "interview_likelihood", "timeline_urgency", "overall_reasoning", "red_flags", "green_flags"],
  additionalProperties: false
};

const body = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  system: [{
    type: "text",
    text: systemPromptWithProfile,
    cache_control: { type: "ephemeral" }
  }],
  messages: [{
    role: "user",
    content: `Score this job:\n\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nSalary: ${job.salary_raw || 'Not specified'}\nType: ${job.job_type}\n\nDescription:\n${(job.description || '').substring(0, 2000)}`
  }],
  output_config: {
    format: {
      type: "json_schema",
      schema: scoringSchema
    }
  }
};
```

### 5.4 Cost Optimisation Decision Tree

```
Is this a scoring call (evaluate job fit)?
  YES -> Use Haiku 4.5 ($0.003/call)
         Enable prompt caching for profile
         Batch if not time-sensitive

Is this a JD analysis call (extract requirements)?
  YES -> Use Haiku 4.5 ($0.003/call)
         Short output, structured extraction

Is this a CV generation call (write tailored CV)?
  YES -> Use Sonnet 4.6 ($0.02/call)
         Quality matters here, Haiku produces noticeably weaker CVs
         Enable prompt caching for master profile

Is this a cover letter generation call?
  YES -> Use Sonnet 4.6 ($0.015/call)
         Creative writing quality matters

Is this an interview prep brief?
  YES -> Use Sonnet 4.6 ($0.02/call)
         Reasoning quality matters for question prediction

Is this a company research summary?
  YES -> Use Haiku 4.5 ($0.003/call)
         Summarisation, not creative work
```

**Monthly cost estimate (per tenant, 100 jobs/day pipeline):**

| Task | Model | Calls/Month | Cost/Call | Monthly |
|------|-------|-------------|-----------|---------|
| Job scoring | Haiku + cache | 3,000 | $0.0027 | $8.10 |
| JD analysis | Haiku | 200 (A/B tier only) | $0.003 | $0.60 |
| CV generation | Sonnet | 200 | $0.020 | $4.00 |
| Cover letter | Sonnet | 150 | $0.015 | $2.25 |
| Interview prep | Sonnet | 30 | $0.020 | $0.60 |
| Company research | Haiku | 30 | $0.003 | $0.09 |
| **TOTAL** | | | | **$15.64** |

With batch processing for scoring: **~$11.50/month**.

### 5.5 API Version and Headers

Update the n8n HTTP Request headers. The current workflow uses `anthropic-version: 2023-06-01` which works but does not support `output_config`. Update to:

```
anthropic-version: 2023-06-01
```

Note: `output_config` is GA and does not require a beta header as of February 2026. The `2023-06-01` version header is still current -- it refers to the API version, not the feature version.

---

## 6. Implementation Priority

### Phase 1: Scoring Upgrade (1-2 days)
1. Update `wf5-scoring-mt.json` to use 10 dimensions with structured output
2. Add prompt caching for candidate profile
3. Add calibration logic in the post-scoring Code node
4. Update `job_scores` table to store all 10 dimensions
5. Update dashboard to show dimension breakdown

### Phase 2: CV Tailoring Upgrade (2-3 days)
1. Improve JD analysis prompt with structured output
2. Add keyword injection logic
3. Add STAR achievement generation
4. Implement actual QA scoring (not hardcoded)
5. Generate DOCX output (use docx npm package or n8n document node)

### Phase 3: Cover Letter (1 day)
1. Build template structure
2. Add company research node
3. Generate personalised cover letters for A/B tier jobs
4. Store alongside CV packages

### Phase 4: Interview Prep (1-2 days)
1. Create STAR story bank table and seed from profile
2. Build company research workflow
3. Generate interview prep briefs
4. Add to dashboard

---

## Sources

- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude Batch Processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- [Career-Ops System (santifer)](https://santifer.io/career-ops-system)
- [Career-Ops GitHub](https://github.com/santifer/career-ops)
- [JobOps (reggiechan74)](https://github.com/reggiechan74/JobOps)
- [Claude API Cost Optimization](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [UK Cover Letter Conventions (Robert Walters)](https://www.robertwalters.co.uk/insights/career-advice/e-guide/how-to-write-a-cover-letter.html)
- [UK Cover Letter Length (CV Maker)](https://www.cvmaker.uk/blog/cover-letter/cover-letter-length)
- [ATS Resume Optimization 2026](https://bestjobsearchapps.com/articles/en/7-best-ai-resume-optimization-tools-for-ats-passing-and-keyword-matching-in-2026)
- [STAR Interview Method 2026](https://blog.parakeet-ai.com/common-interview-questions-2026-star-ai-insights/)
- [AI Interview Prep Tools 2026](https://applyarc.com/blog/best-ai-interview-prep-tools-2026)
