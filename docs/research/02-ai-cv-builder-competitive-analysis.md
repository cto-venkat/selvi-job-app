# AI CV Builder Competitive Analysis & Market Research

**Date:** 2026-03-29
**Purpose:** Competitive intelligence for building a custom automated CV tailoring system
**System:** Selvi Job App
**Module:** CV Tailoring (planned)

---

## Table of Contents

1. [Major AI CV Builder Tools](#1-major-ai-cv-builder-tools)
2. [What Features Actually Matter](#2-what-features-actually-matter)
3. [Open Source CV Tools and Libraries](#3-open-source-cv-tools-and-libraries)
4. [UK Recruitment Industry Insights](#4-uk-recruitment-industry-insights)
5. [Privacy and Data Protection](#5-privacy-and-data-protection)
6. [Strategic Implications for Selvi](#6-strategic-implications-for-selvi)

---

## 1. Major AI CV Builder Tools

### 1.1 Jobscan

**What it does:** Matches hard skills, soft skills, and keywords from a job listing against your CV. Scans your CV and highlights missing information for ATS, with instant update options.

**Key features:**
- ATS checker performs 20+ evaluations across multiple categories
- Identifies missing keywords, flags formatting issues, suggests stronger action verbs
- Evaluates content impact and brevity
- "One Click Optimize" automatically rewrites sections to incorporate target terms
- LinkedIn profile checker
- 40+ templates
- Resume scanner gives match rate based on top ATS systems (iCIMS, Lever, Greenhouse, Taleo)
- Recommends 75% match rate target

**Pricing:** Free tier (5 scans/month, 7-day trial). Paid: $49.95/month, $89.95/quarter, $179/year.

**Verdict:** The deepest ATS scanning tool, but expensive. The core value is the job-description-to-CV keyword matching -- everything else is secondary. We can replicate this with LLM prompting against a structured CV data model.

### 1.2 Teal

**What it does:** Full job search platform combining resume creation, job tracking, and AI writing tools.

**Key features:**
- AI bullet generator, summary writer, cover letter tool, resume rewriter, match scoring
- Chrome extension scans 40+ job boards and auto-saves postings
- Unlimited job tracking with Kanban-style board
- Bookmark jobs, set goals, take notes, track application statuses
- 10 templates on free plan

**Pricing:** Free plan (unlimited resumes and job tracking, limited AI credits). Teal+: $13/week, $29/month, or $79/quarter. No annual plan.

**Verdict:** Teal's strength is the job tracker + resume builder integration. The Chrome extension that pulls job descriptions from boards is clever but fragile (dependent on DOM structures). The job tracking component overlaps significantly with Selvi's existing job discovery system -- we already have this covered.

### 1.3 Kickresume

**What it does:** Template-heavy CV builder with AI content generation.

**Key features:**
- 40+ templates for resumes and cover letters
- Split-screen real-time preview
- LinkedIn profile import
- AI resume checker and automated "Career Coach"
- Uses GPT-4.1 for cover letters, GPT-5 for resume generation
- Personal website builder included
- Grammar checking

**Pricing:** Free (basic templates). Monthly $24/month, Quarterly $18/month ($54 billed), Yearly $8/month ($96 billed). Free Premium for students/teachers (6 months).

**Verdict:** Template-focused tool. The AI is a thin wrapper around OpenAI models. The split-screen preview is a nice UX touch. Not relevant for an automated pipeline -- this is a manual, interactive tool.

### 1.4 Resume Worded

**What it does:** AI-powered CV scoring and feedback system.

**Key features:**
- "Score My Resume" conducts 20-30 targeted checks across Impact, Brevity, Style, Soft Skills, and ATS compatibility
- Scores out of 100 against 20+ criteria that matter to recruiters
- "Targeted Resume" tool analyses specific job descriptions to identify missing keywords
- Real-time relevancy score updates
- LinkedIn Review for profile optimization
- ATS keyword scanner with match score per job posting

**Pricing:** Free (basic score + limited feedback). Pro: $49/month, $33/month quarterly ($99), $19/month annually ($229).

**Verdict:** The scoring rubric (Impact, Brevity, Style, Soft Skills, ATS) is useful framing. The complaint that "small changes lead to drastic score jumps" suggests a brittle scoring algorithm -- likely keyword-matching with arbitrary weighting rather than genuine semantic understanding. We can do better with LLM-based evaluation.

### 1.5 Rezi

**What it does:** ATS-focused resume builder with real-time scoring.

**Key features:**
- Scans CV against 23+ ATS checkpoints
- Rezi Score: proprietary analysis based on 23 factors (content, formatting, ATS best practices)
- Score 1-100, 90+ considered "application-ready"
- Single-column, ATS-optimised layouts
- AI keyword scanner analyses job postings
- AI Bullet Point Writer (industry-specific)
- AI Resume Summary Generator
- Cover letter generation
- Free plan includes AI keyword targeting and real-time content analysis

**Pricing:** Free (with AI features). Pro: $29/month. Lifetime: $149 one-time.

**Verdict:** The lifetime deal at $149 tells you something about the market ceiling. The 23-checkpoint scoring is more transparent than Resume Worded's opaque scoring. The single-column ATS focus is sound but limiting for academic CVs. The $149 lifetime price sets a ceiling on what users will pay for this category.

### 1.6 EnhanCV

**What it does:** AI-powered CV builder with ChatGPT integration.

**Key features:**
- Built on OpenAI's ChatGPT technology
- Analyses job descriptions and suggests relevant bullet points, summaries, skills
- ATS check tool flags issues, identifies missing keywords
- Large template selection (corporate, tech, creative)
- Unlimited resumes and cover letters on paid plans
- Real-time content suggestions

**Pricing:** Free (7-day trial, branding on downloads). Monthly $24.99/month, Quarterly $16.66/month ($49.97), Semi-Annual $13.33/month ($79.94).

**Verdict:** Competent but undifferentiated. The ChatGPT wrapper approach means output quality is generic. No specific UK market awareness.

### 1.7 Novoresume

**What it does:** AI-driven CV builder with skill alignment focus.

**Key features:**
- AI analyses background and extracts relevant skills/achievements
- AI cover letter generator, bullet point generator
- LinkedIn optimizer
- AI keyword synonym detector
- ATS Revealed eBook
- Resume manager and Kanban job tracker
- AI assistant with chat interaction (beta)
- Pre-written content suggestions

**Pricing:** Free (limited templates). Monthly $19.99, Quarterly $39.99, Yearly $99.99.

**Verdict:** The keyword synonym detector is a useful feature concept -- finding alternative phrasings for the same skill. Worth incorporating into our system.

### 1.8 Zety

**What it does:** Template-based CV builder with AI suggestions.

**Key features:**
- 18 templates (corporate, tech, creative)
- Drag-and-drop interface
- AI-generated bullet points
- ATS Resume Checker with compatibility scoring
- Full design customisation (colours, fonts, margins, layout)

**Pricing:** Free (text-only .txt download -- effectively unusable). Pro: 14-day trial at $1.95, then $25.95 every 4 weeks. Annual: $71.40/year ($5.95/month).

**Major red flags:**
- The "free" offering is deliberately misleading (text-only export)
- Bills every 4 weeks (13 times/year, not 12)
- Widespread complaints about cancellation difficulties
- Reports of charges continuing after cancellation
- Glitchy cancellation button
- 4.2/5 on Trustpilot but significant 1-star complaints about billing

**Verdict:** A cautionary tale in dark patterns. The billing and cancellation issues are well-documented. Avoid this model entirely. Useful as a negative example of how NOT to treat users.

### 1.9 TopCV (UK-Specific)

**What it does:** Professional CV writing service, not a self-service builder. UK-focused.

**Key features:**
- Free automated CV assessment (upload CV, receive email breakdown)
- Professional CV writers (not AI-only)
- ATS-optimised layouts
- Two rounds of revisions included
- 2-5 business day turnaround
- 60-day interview guarantee on top two tiers
- LinkedIn profile makeover service
- 600,000+ CVs written, 92% satisfaction rate

**Pricing:** Professional Growth: GBP 99 (ATS CV, ~1 week). Career Evolution: GBP 129 (CV + cover letter). Executive Priority: GBP 219 (CV + cover letter + LinkedIn review). LinkedIn standalone: GBP 50.

**Verdict:** Different category -- this is a service, not a tool. The free automated assessment is a good lead generation funnel. The GBP 99-219 price range for professional CV writing sets the upper bound for what UK job seekers will pay for CV help. The 60-day interview guarantee is a confidence signal.

### 1.10 Reztune (UK-Aware)

**What it does:** AI CV tailoring specialist. Compares existing CV against job posting and adjusts content.

**Key features:**
- AI analyses job descriptions and tailors CV to highlight relevant skills/experience
- Rewrites bullets, matches keywords from job description
- ATS-friendly output
- Application tracking
- Personalised cover letter generation
- Smart resume bullet suggestions with user control
- Skills gap analysis with course/certification recommendations
- Full profile vs. job description analysis

**Pricing:** Free (preview one tailored CV). Paid from $5/month.

**Verdict:** Closest to what we want to build. The "compare existing CV against job posting and adjust" workflow is the right mental model. Their pricing ($5/month) is aggressive. The skills gap analysis with certification recommendations is worth copying.

### 1.11 Other UK Services

- **LiveCareer (livecareer.co.uk):** AI-backed, 40+ templates, real-time suggestions
- **myPerfectCV (myperfectcv.co.uk):** UK-localised, AI content generation
- **CV-Library CV Builder:** Integrated with UK's CV-Library job board
- **UCAS CV Builder:** Free, targeted at students/graduates
- **Indeed CV Builder:** Free, basic, ATS-friendly, no payment required

---

## 2. What Features Actually Matter

### 2.1 Features Users Value Most

Based on cross-referencing reviews, complaints, and usage patterns across all major tools:

**Tier 1 -- Must-Have (users pay for these):**
1. **Job-description-to-CV keyword matching** -- The core value proposition. Every tool that charges money does this. Users want to know "does my CV match this specific job?"
2. **ATS compatibility scoring** -- Users are (rightly) anxious about ATS rejection. A concrete score reduces anxiety.
3. **Tailored bullet point rewriting** -- Taking existing experience and rephrasing it to match a specific role's language.
4. **PDF/DOCX export in clean formatting** -- Sounds basic, but Zety's text-only free export proves this is a real pain point.

**Tier 2 -- Valuable (users appreciate but won't pay extra for):**
5. **Cover letter generation** -- 83% of UK hiring managers read cover letters. Automated generation tied to the same job description is high-value.
6. **Keyword synonym detection** -- Finding alternative phrasings recruiters might use.
7. **Skills gap identification** -- "You're missing X skill that this job requires."

**Tier 3 -- Nice-to-Have (marginal value):**
8. **LinkedIn profile optimization** -- Useful but secondary to CV quality.
9. **Job tracking** -- Valuable feature but separate concern from CV building.
10. **Templates/design** -- Matters for entry-level; less relevant for senior professionals.

### 2.2 What Works vs. What's a Gimmick

**Works:**
- Keyword extraction from job descriptions and matching against CV content
- ATS format compliance checking (single column, standard fonts, no tables/graphics)
- Bullet point quantification prompts ("add metrics like revenue, cost savings, time saved")
- Job-specific CV tailoring from a master document

**Gimmicks:**
- "AI Career Coach" chatbots -- thin wrappers around GPT with no real career knowledge
- Elaborate template galleries -- senior professionals need clean, simple formats
- "One-click optimize" -- produces generic, homogeneous output that recruiters are learning to spot
- Gamified scoring (arbitrary 0-100 scores that jump wildly with minor changes)

### 2.3 Common Complaints About AI CV Tools

1. **Generic, cookie-cutter output** -- AI produces text that sounds professional but lacks individuality. Recruiters increasingly recognise AI-generated content.
2. **American English defaults** -- Most tools default to US English (organize vs organise, resume vs CV, color vs colour). This is a significant issue for UK applications.
3. **Misleading "free" tiers** -- Build your CV for free, then pay to download it. Widely resented.
4. **Subscription traps** -- Difficult cancellation, auto-renewal at higher rates, billing tricks (4-week cycles).
5. **Accuracy problems** -- AI fabricates achievements or skills the candidate doesn't have. Dangerous in interviews.
6. **No understanding of market context** -- Tools don't understand UK contracting vs permanent, IR35, notice periods, or sector-specific norms.
7. **Brittle scoring** -- Small changes cause large score swings, undermining trust.
8. **Data privacy concerns** -- CV data stored in cloud, shared with "premium partners", potentially used for AI model training.
9. **Detection risk** -- Some employers now auto-reject CVs that appear AI-generated. One university reported a 300% increase in applications after students used AI tools, prompting backlash.

### 2.4 What They Get Wrong About the UK Market

1. **CV vs Resume terminology** -- Many tools use "resume" throughout, which signals US-market orientation to UK recruiters.
2. **Format expectations** -- UK CVs are typically 2 pages (not 1-page US resumes). Academic CVs are 3-5 pages. Tools that enforce single-page output are wrong for UK.
3. **Personal details** -- UK CVs include city/region but not full address. No photo required (unlike some European markets). Date of birth should NOT be included.
4. **References** -- "References available on request" is standard UK practice; some tools omit this or include actual references.
5. **Salary expectations** -- UK job ads often show salary bands. Tools don't account for UK salary conventions (GBP, per annum, pro rata for part-time).
6. **Notice periods** -- UK candidates typically have 1-3 month notice periods. This is relevant context that tools ignore.
7. **Right to work** -- UK-specific requirement. Tools don't help frame immigration status appropriately.
8. **Professional body memberships** -- CIPD, CMI, ITOL memberships carry significant weight in UK HR/L&D roles. Tools don't understand this.
9. **Academic vs corporate** -- UK academic CVs follow entirely different conventions (publications lists, teaching statements, REF submissions). No commercial tool handles both well.

### 2.5 Academic vs Corporate CV Handling

**No commercial AI CV tool handles the academic-corporate split well.** This is a significant gap and directly relevant to Selvi's candidate profile (targeting both L&D corporate roles and university lecturer positions).

**UK Academic CV requirements:**
- 3-5 pages typical length (not 2 pages)
- Peer-reviewed publications listed first (full citation format, consistent style)
- Teaching experience with specific details (courses, levels, class sizes)
- Research interests section
- Grants and funding obtained
- Conference presentations
- PhD supervision history
- Administrative contributions (committee work, journal reviewing, editorial roles)
- No "personal profile" -- replaced by "Research Interests" or "Teaching Philosophy"
- REF-relevant outputs may be highlighted

**UK Corporate L&D CV requirements:**
- 2 pages maximum
- Personal profile/summary at top
- Achievement-focused bullet points with metrics
- CIPD membership level prominently displayed
- Commercial impact language (ROI, cost savings, engagement scores)
- Programme/project management experience
- Stakeholder management evidence
- Digital learning platforms experience
- Budget management

**Implication:** The Selvi system needs to maintain a single master data model that can generate BOTH formats from the same source material, switching between academic and corporate framing of the same experiences.

---

## 3. Open Source CV Tools and Libraries

### 3.1 JSON Resume

**URL:** https://jsonresume.org
**GitHub:** https://github.com/jsonresume
**Schema version:** 1.0.0 (stable since 2014, continuously maintained)

**What it is:** An open standard for representing professional history as structured JSON data.

**Schema structure:** Standardised fields for basics (name, contact, summary), work experience, education, skills, publications, languages, interests, references, projects, volunteer work, awards, and certificates.

**Ecosystem:**
- 400+ npm theme packages for rendering
- Official and community themes
- CLI tool (`resume-cli`) for rendering to HTML/PDF
- Registry for hosting JSON Resume files
- MCP (Model Context Protocol) registry server (updated May 2025) -- updates resumes while coding
- Rust implementation (updated January 2026)

**Relevance to Selvi:** The JSON Resume schema is worth adopting as the base for our master CV data model. It will need extensions for academic fields (publications with full citation data, teaching load, research grants, supervision history). The 400+ themes don't matter since we'll generate tailored output, but the schema itself saves us from designing one from scratch.

### 3.2 Reactive Resume

**URL:** https://rxresu.me
**GitHub:** https://github.com/amruthpillai/reactive-resume
**Stars:** 30,000+

**What it is:** The most popular open-source CV builder (30k+ GitHub stars). Self-hostable via Docker.

**Key features:**
- 20+ templates
- AI-powered content suggestions (OpenAI integration)
- Drag-and-drop section ordering
- Multi-language support
- No account required, no watermark, no paywall for PDF export
- Full Docker Compose deployment
- Self-hosted means data stays local

**Relevance to Selvi:** Useful as a reference implementation for CV rendering (HTML-to-PDF pipeline). The Docker deployment model aligns with our Dokploy infrastructure. However, it's an interactive builder -- not an automated tailoring system. We could potentially use its rendering engine while replacing the input mechanism with our automated pipeline.

### 3.3 OpenResume

**URL:** https://open-resume.com
**GitHub:** https://github.com/xitanggg/open-resume

**What it is:** Open-source resume builder AND parser. Built with Next.js.

**Key features:**
- Resume builder with real-time PDF preview
- Resume parser that tests ATS readability
- Runs entirely in-browser (no server, no data leaves the browser)
- ATS-friendly design targeting Greenhouse and Lever
- No sign-up required

**Parser approach:** Uses a feature scoring system where each resume attribute has custom feature sets with matching functions and scores. Text items run through all feature sets to identify and extract attributes.

**Relevance to Selvi:** The parser is the interesting component. If we need to ingest existing CVs (PDF/DOCX) into our structured data model, OpenResume's parsing approach provides a starting point. The browser-only architecture is privacy-positive but doesn't fit our server-side pipeline.

### 3.4 Resume-LM

**GitHub:** https://github.com/olyaiy/resume-lm

**What it is:** Open-source AI resume builder using Next.js 15, React 19, Tailwind CSS. Most directly comparable to what we want to build.

**Key features:**
- Tailors resumes to specific job applications
- Integrates with OpenAI, Anthropic (Claude), and Google AI (Gemini)
- Uses Supabase for auth and database
- Stores user profile (work experience, education, skills), created resumes, and job descriptions
- Mobile-first design

**Architecture:**
- Master profile stores all experience data
- Job descriptions stored alongside tailored versions
- Multiple AI provider support

**Relevance to Selvi:** This is architecturally the closest to our planned system. The data model (master profile + job descriptions + tailored outputs) matches our mental model. The multi-LLM support (Claude, GPT, Gemini) is good practice. We can study this implementation for structural patterns while building something more UK-specific and automated.

### 3.5 Resume Matcher

**GitHub:** https://github.com/srbhr/Resume-Matcher

**What it is:** Takes a master resume and a job description, then rewrites the resume to match.

**Relevance:** Direct match to our use case. Worth examining the matching algorithm and rewriting approach.

### 3.6 resume-ai (Privacy-First)

**GitHub:** https://github.com/resume-llm/resume-ai

**What it is:** Local, privacy-first CV builder using LLMs and Markdown. Generates ATS-ready DOCX files with Pandoc. No cloud, no tracking.

**Relevance:** The Pandoc-based DOCX generation matters for us. Using Markdown as an intermediate format between structured data and final output is a sensible approach that avoids the complexity of direct PDF/DOCX generation.

### 3.7 AI-Resume-Analyzer

**GitHub:** https://github.com/deepakpadhi986/AI-Resume-Analyzer

**What it is:** NLP-based resume parser that extracts keywords, clusters by sector, provides recommendations and analytics based on keyword matching.

**Relevance:** The sector-clustering approach could inform our scoring -- mapping L&D-specific keywords to competency clusters rather than doing flat keyword matching.

### 3.8 Other Notable Repos

- **ResuLLMe** (github.com/IvanIsCoding/ResuLLMe): LLM-enhanced resume tool
- **ai-resume-builder** (github.com/abhineetgupta/ai-resume-builder): Creates LaTeX resumes tailored to job postings
- **Resume-Score**: Streamlit tool for automated resume parsing using NLP (updated February 2026)
- **Resume Processor**: Uses Gemini API to extract details and calculate experience scores

---

## 4. UK Recruitment Industry Insights

### 4.1 How Recruiters Actually Review CVs

**The 6-second scan is a myth, but the reality isn't much better:**
- Recruiters spend an average of **30 seconds** on initial CV review (not 6 seconds)
- Fewer than 1% spend less than 10 seconds
- 80% of applicants don't make it past the initial skim
- Up to **75% of CVs are rejected by ATS** before reaching a human recruiter

**Two-layer screening process:**
1. **ATS filter** -- keyword matching, format compliance, basic qualification checks
2. **Human skim** -- 15-20 second initial scan for value signals, followed by deeper read for shortlisted candidates

**What recruiters look for in 15-20 seconds:**
- Clear summary linking background to role
- Evidence of impact with measurable results
- Skills matching the advert language
- Signs of reliability (steady work history, no unexplained gaps)
- Appropriate seniority level

**What causes immediate rejection:**
- Incorrect formatting (tables, graphics, unusual fonts that break ATS parsing)
- Missing keywords from the job description
- Generic, untailored CV
- Over-designed templates
- Obvious AI-generated boilerplate

### 4.2 What Gets Shortlisted in UK L&D Roles

**For corporate L&D (Manager to Head level, GBP 70-80k):**
- Metrics-driven achievements (revenue impact, engagement scores, completion rates, cost savings)
- Evidence of programme design and delivery at scale
- Stakeholder management across business functions
- Budget ownership and ROI demonstration
- Digital learning platform experience (specific platforms named)
- Change management credentials
- CIPD membership level (minimum Level 5, ideally Level 7 or Chartered)
- Evidence of strategic thinking (not just delivery)

**L&D trends employers value in 2026:**
- AI-driven learning insights and personalisation
- Skills intelligence (mapping, predicting, addressing capability gaps)
- Learning analytics connecting to business outcomes (productivity, engagement, retention)
- L&D positioned as a performance driver, not a cost centre

**Market size context:** 81,000+ L&D jobs currently listed in UK (LinkedIn), with 878 remote positions available.

### 4.3 Academic Hiring in UK Universities

**How applications are assessed:**

The process differs from corporate hiring in almost every way:

1. **Person specification scoring** -- Applications are scored against a published criteria grid. Each criterion marked as Essential or Desirable. Scoring is typically: 0 (not evidenced), 1 (partially evidenced), 2 (fully evidenced), 3 (exceeds).

2. **Panel review** -- A shortlisting panel (typically 3-5 academics) independently scores applications, then meets to compare and agree a shortlist.

3. **What they score on:**
   - Teaching experience (courses, levels, class sizes, student feedback)
   - Research output (publications, with emphasis on REF-eligible outputs)
   - Grant income (as PI or Co-I, with amounts)
   - PhD supervision (completions, current students)
   - Administrative contribution (committee work, programme leadership)
   - Fit with departmental research themes
   - Evidence of collegial service

4. **Critical differences from corporate:**
   - Cover letters are essential and closely read
   - Teaching and research statements often required separately
   - Named referees contacted before interview (not after)
   - Full publication list expected, not a "selected" list
   - The CV IS the application -- there's rarely a separate application form for academic roles on jobs.ac.uk

5. **What gets academic applications rejected:**
   - Publications not in peer-reviewed journals
   - No evidence of independent research agenda
   - Teaching experience limited to guest lectures
   - CV formatted like a corporate resume (2 pages, bullet-point heavy)
   - No evidence of grant applications (even unsuccessful ones show ambition)

**Implication for Selvi:** The system must generate a completely different document for academic applications -- not just rearrange sections, but reframe the same experiences in academic language with academic evidence structures.

### 4.4 Cover Letters in UK Applications

**Do recruiters read them?** Yes.
- **83%** of hiring managers read the majority of cover letters they receive
- **77%** give preference to candidates who submit a cover letter, even when optional
- Only **6%** of hiring managers consider cover letters unnecessary
- **80%** of managers distrust purely AI-generated content

**UK cover letter norms:**
- One A4 page, 250-400 words
- Must demonstrate specific knowledge of the employer and role
- Should connect candidate's background to the role's requirements
- For academic roles: longer, more detailed, may include teaching/research philosophy elements

**Implication:** The system should generate tailored cover letters alongside tailored CVs, using the same job description analysis. Cover letters are particularly important for academic applications where they function as a mini-statement of purpose.

### 4.5 LinkedIn vs CV Alignment

**Why it matters:**
- 95% of UK recruiters use LinkedIn to vet candidates
- Recruiters check LinkedIn after CV shortlisting, looking for consistency
- Candidates who update both CV and LinkedIn simultaneously are **2x more likely** to receive recruiter outreach within 30 days

**What recruiters check:**
- Job titles and dates match between CV and LinkedIn
- Accomplishments are consistent (not inflated on either platform)
- Skills sections align
- Recommendations and endorsements support CV claims
- Professional photo and headline present

**The right approach:**
- LinkedIn and CV should tell the same story but not be identical
- LinkedIn allows more narrative, personality, and context
- CV is formal and targeted; LinkedIn is broader and discoverable
- Tone should be coordinated but not copy-pasted

**Implication:** When tailoring CVs, the system should flag if changes would create inconsistencies with the LinkedIn profile. This is a secondary concern but worth tracking.

---

## 5. Privacy and Data Protection

### 5.1 GDPR Implications of Storing CV Data

**CV data is personal data.** CVs inherently contain personal data including potentially sensitive personal data (disability status, national origin for right-to-work, etc.). Processing CV data requires full GDPR compliance.

**Lawful basis for processing:**

For Selvi (processing the candidate's own data for her benefit):
- **Article 6(1)(a) -- Consent:** The candidate has given explicit consent to process her own data. This is the clearest and simplest basis.
- The system processes data solely for the data subject's own benefit (tailoring her CVs). No third-party data subjects are involved except potentially referee contact details.

**Key GDPR principles to observe:**
1. **Purpose limitation** -- Data collected for CV tailoring must only be used for CV tailoring
2. **Data minimisation** -- Only collect what's needed for the CV generation purpose
3. **Storage limitation** -- Don't retain data longer than necessary
4. **Integrity and confidentiality** -- Encrypt at rest and in transit
5. **Transparency** -- Clear documentation of what data is stored and why

### 5.2 Data Protection Risks of Commercial CV Tools

**Risks identified in current market:**

1. **Cloud storage exposure** -- When CV data enters cloud platforms, tracking who has accessed it becomes difficult
2. **Third-party data sharing** -- Many "free" tools monetise by selling data to recruiters, advertisers, or using it for AI model training
3. **"Premium partner" access** -- Some tools allow partner organisations to access CV data for "market intelligence benchmarking" with no notification or opt-in
4. **AI model training** -- CV text submitted for AI processing may be used to train models (OpenAI, Google, etc.) unless specifically opted out
5. **Cross-border transfers** -- Most tools are US-based, meaning UK personal data is transferred outside the UK adequacy framework

**Specific concerns with major tools:**
- Most tools use OpenAI/GPT APIs, meaning CV text is sent to OpenAI's servers
- Data retention policies are often vague or buried in terms of service
- Few tools offer data deletion on request (GDPR Article 17 right to erasure)
- None of the major commercial tools have been audited for UK GDPR compliance

### 5.3 Self-Hosted Advantages for Selvi

Building a self-hosted system eliminates most privacy risks:

1. **No third-party data sharing** -- CV data never leaves our infrastructure
2. **No cloud exposure** -- Data stays on Hetzner infrastructure under our control
3. **LLM API consideration** -- When using Claude API for CV tailoring, CV text is sent to Anthropic. Anthropic's API terms state they don't use API inputs for model training (unlike the consumer product). This is the acceptable trade-off.
4. **Data retention** -- We control retention periods. For a single-user system, data persists as long as the candidate wants it.
5. **No cross-border adequacy issues** -- Hetzner data centre is in EU/EEA. Anthropic API calls go to US servers but are API-only with no retention guarantee concerns under Anthropic's business terms.

### 5.4 GDPR Requirements for Recruitment Data (Context)

If the system ever expands beyond single-user to handle multiple candidates:

- **Data Protection Impact Assessment (DPIA)** required for AI-based CV screening/processing
- **Bias auditing** required if AI tools are used to filter or rank candidates
- **Retention limits:** 3-6 months for unsuccessful candidate data (industry standard), 12 months maximum without re-consent
- **Right to explanation:** If automated decisions affect candidates, they have the right to understand the logic
- **Right to erasure:** Must be able to delete all candidate data on request
- **Consent must be freely given** -- Candidates must be able to withdraw consent without penalty

### 5.5 Practical Privacy Implementation

For Selvi's single-user system:

1. **Store master CV data in Postgres** on deploy.apiloom.io (existing infrastructure)
2. **Encrypt at rest** -- Postgres with encryption (already standard on Dokploy deployments)
3. **LLM API calls** -- Use Claude API with Anthropic's business terms (no training on API data)
4. **No analytics/tracking** -- No need for usage analytics on a single-user system
5. **Backup strategy** -- CV data included in standard infrastructure backups
6. **Access control** -- Single-user authentication sufficient

---

## 6. Strategic Implications for Selvi

### 6.1 Competitive Positioning

Selvi's CV tailoring system is NOT competing with Jobscan, Teal, or Kickresume. Those are general-purpose tools for mass-market job seekers. Selvi is a personal, automated pipeline for a specific candidate with specific needs.

**What makes Selvi different:**
1. **Single-user, bespoke** -- No need for multi-tenancy, onboarding flows, or template galleries
2. **Integrated with job discovery** -- CVs are tailored in response to jobs the system has already discovered and scored
3. **Dual-format capability** -- Academic AND corporate CV generation from the same data
4. **UK-market native** -- British English, UK CV conventions, CIPD/academic norms built in
5. **Self-hosted** -- No data sharing, no third party monetisation
6. **Automated pipeline** -- Not an interactive builder; generates tailored CVs programmatically

### 6.2 Features to Build

**Phase 1 -- Core:**
- Master CV data model (extending JSON Resume schema with academic fields)
- Job-description analysis (keyword extraction, requirement mapping)
- CV tailoring engine (LLM-based rewriting against job requirements)
- Dual output: corporate 2-page CV and academic 3-5 page CV
- PDF generation pipeline (Pandoc or HTML-to-PDF)
- Cover letter generation

**Phase 2 -- Enhancement:**
- ATS compatibility checking (format validation, keyword density)
- Skills gap analysis per job (what the candidate is missing)
- LinkedIn consistency checker
- Application tracking integration (link tailored CV to discovered job)
- Version history (track which CV version was sent to which employer)

### 6.3 Features to Skip

- Template gallery (unnecessary for single user)
- Interactive drag-and-drop builder (automated pipeline doesn't need UI building)
- Gamified scoring (arbitrary and counterproductive)
- "AI Career Coach" chatbot (no value for an experienced professional)
- Job board Chrome extension (already covered by job discovery module)
- Multi-user features (single candidate system)

### 6.4 Technology Choices Informed by Research

1. **Data model:** Start with JSON Resume schema, extend with academic fields (publications, grants, teaching, supervision)
2. **LLM:** Claude API (already in use for job scoring) -- use Haiku for first-pass keyword extraction, Sonnet for CV rewriting
3. **CV rendering:** Consider Pandoc (Markdown to DOCX/PDF) or HTML-to-PDF (Puppeteer/Playwright). The resume-ai open source project validates the Pandoc approach.
4. **Storage:** Postgres (existing infrastructure)
5. **Workflow:** n8n (existing infrastructure) -- trigger CV tailoring when a high-scored job is discovered

### 6.5 Pricing Context

For reference, what the market charges:
- **Automated tools:** $5-50/month (Reztune at the low end, Jobscan at the high end)
- **Lifetime deals:** $149 (Rezi)
- **Professional CV writing:** GBP 99-219 (TopCV)
- **Enterprise/team tools:** Custom pricing

Selvi's cost will be primarily API usage (Claude API calls for tailoring). At roughly $0.01-0.05 per tailored CV (Haiku for extraction + Sonnet for rewriting), even 100 tailored CVs per month would cost under $5 in API fees.

### 6.6 Key Risks to Monitor

1. **AI detection** -- Employers increasingly screening for AI-generated content. The system must produce output that sounds like the candidate, not like ChatGPT. Training the LLM on the candidate's actual writing style is essential.
2. **Over-optimisation** -- CVs that are too perfectly keyword-matched may trigger suspicion. Natural variation and human imperfection should be preserved.
3. **Accuracy** -- The LLM must NEVER fabricate achievements, skills, or experience. All content must be grounded in the master CV data. This is a hard constraint, not a nice-to-have.
4. **Format drift** -- ATS systems evolve. What passes ATS today may not in 6 months. The system should be designed for easy format updates.
5. **Academic norms shift** -- UK universities are increasingly using their own application portals rather than jobs.ac.uk-only. The system should be adaptable to different submission formats.

---

## Sources

### AI CV Builder Tools
- [Jobscan](https://www.jobscan.co/)
- [Jobscan Pricing Review](https://landthisjob.com/blog/jobscan-review-2025/)
- [Teal Resume Builder](https://www.tealhq.com)
- [Teal Pricing](https://www.tealhq.com/pricing)
- [Kickresume](https://www.kickresume.com/en/ai-resume-writer/)
- [Kickresume Pricing & Features](https://pitchmeai.com/blog/kickresume-pricing-features-guide)
- [Resume Worded](https://resumeworded.com/)
- [Resume Worded Pricing](https://pitchmeai.com/blog/resume-worded-pricing-premium-worth-it)
- [Rezi AI](https://www.rezi.ai/)
- [Rezi Pricing](https://www.rezi.ai/pricing)
- [Enhancv](https://enhancv.com/pricing/)
- [Enhancv Review](https://pitchmeai.com/blog/enhancv-review-pros-cons)
- [Novoresume](https://novoresume.com/)
- [Zety Review](https://pitchmeai.com/blog/zety-full-review)
- [Zety Pricing](https://pitchmeai.com/blog/zety-pricing-plans)
- [TopCV UK](https://topcv.co.uk/)
- [Best CV Writing Services UK](https://brendanhope.com/blog/top-5-cv-writing-services/)
- [Reztune](https://www.reztune.com/)
- [Best AI CV Builders UK](https://www.myperfectcv.co.uk/blog/best-ai-cv-builders)

### Open Source Tools
- [JSON Resume](https://jsonresume.org/)
- [JSON Resume Schema](https://jsonresume.org/schema)
- [Reactive Resume](https://rxresu.me/)
- [Reactive Resume GitHub](https://github.com/amruthpillai/reactive-resume)
- [OpenResume](https://www.open-resume.com/)
- [OpenResume GitHub](https://github.com/xitanggg/open-resume)
- [Resume-LM GitHub](https://github.com/olyaiy/resume-lm)
- [Resume Matcher GitHub](https://github.com/srbhr/Resume-Matcher)
- [resume-ai GitHub](https://github.com/resume-llm/resume-ai)
- [AI-Resume-Analyzer GitHub](https://github.com/deepakpadhi986/AI-Resume-Analyzer)
- [Open Source Resume Builders 2026](https://dev.to/srbhr/5-open-source-resume-builders-thatll-help-get-you-hired-in-2026-1b92)

### UK Recruitment Insights
- [Recruiter CV Scanning](https://sponsorcompanies.co.uk/resources/what-job-seekers-dont-know-about-recruiter-cv-checks)
- [CV Screening 2026](https://www.rullion.co.uk/insights/how-to-pass-cv-screening-2026/)
- [What Employers Look For in 2026 CVs](https://indeedflex.co.uk/blog/for-workers/2026-cvs-what-employers-look-for/)
- [UK CV Tips 2026](https://ivee.jobs/blog/best-uk-cv-tips-for-2026/)
- [How to Write a CV for UK Market](https://www.robertwalters.co.uk/insights/career-advice/e-guide/how-to-write-a-cv.html)
- [L&D Trends 2026 UK](https://www.tacktmi.co.uk/learning-and-development-trends-to-watch-in-2026-shaping-your-strategy/)

### Academic CVs
- [Oxford University Academic CV Guide](https://www.careers.ox.ac.uk/cvs)
- [Academic CV Template - jobs.ac.uk](https://career-advice.jobs.ac.uk/cv-and-cover-letter-advice/academic-cv-template/)
- [Cambridge Academic Applications](https://www.careers.cam.ac.uk/academic-applications-and-interviews)
- [Birmingham University Academic CVs](https://intranet.birmingham.ac.uk/student/careers/postgraduate/pgr/academic-cvs.aspx)
- [Imperial College Academic CV Guide](https://www.imperial.ac.uk/media/imperial-college/administration-and-support-services/careers-service/public/resources/handouts/How-to-Write-an-Academic-CV.pdf)
- [Edinburgh University Academic CV](https://careers.ed.ac.uk/phd-and-mres-students/make-it-happen/write-an-academic-cv)

### Cover Letters & LinkedIn
- [Cover Letter Importance UK](https://www.robertwalters.co.uk/insights/career-advice/e-guide/how-to-write-a-cover-letter.html)
- [LinkedIn vs CV Alignment](https://www.ckfutures.co.uk/2025/06/11/linkedin-vs-your-cv-how-to-align-them-without-copy-pasting/)
- [LinkedIn Profile Tips UK](https://brendanhope.com/blog/linkedin-profile-tips-uk-2025/)

### Privacy & GDPR
- [GDPR in Recruitment - CV Retention](https://nflo.tech/knowledge-base/gdpr-in-recruitment-cv-retention/)
- [GDPR and Job Seekers' CVs](https://www.gdpr-ccpa.org/common-articles/gdpr-and-job-seekers-cvs-rights-responsibilities-and-best-practices)
- [GDPR Recruitment Compliance](https://resources.workable.com/tutorial/gdpr-compliance-guide-recruiting)
- [Hidden Dangers of Sharing CV with AI](https://careersorter.co/the-hidden-dangers-of-sharing-your-cv-with-ai-privacy-risks-and-gdpr-concerns/)
- [Resume Data Privacy in AI Systems](https://www.resumly.ai/blog/importance-of-resume-data-privacy-in-ai-systems)
- [Managing CVs Under Data Protection](https://www.thorntons-law.co.uk/knowledge/managing-curricula-vitae-cvs-in-compliance-with-data-protection-rules)
- [AI CV Builder Pitfalls](https://business-school.open.ac.uk/alumni/professional-knowledge-bank/pitfalls-using-ai-or-resume-factory-create-your-cv)
- [AI Resume Builder Risks](https://builtin.com/articles/risks-ai-resume-builders)
