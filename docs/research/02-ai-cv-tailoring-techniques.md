# Research: AI-Powered CV/Resume Tailoring Techniques

**Date:** 2026-03-29
**Purpose:** Technical research for building an automated CV tailoring system (Job Description + Master Profile -> Tailored CV) using Claude AI via n8n workflows
**Module:** CV Tailoring Engine (Module 2 of Selvi Job App)

---

## Table of Contents

1. [AI CV Tailoring -- State of the Art](#1-ai-cv-tailoring----state-of-the-art)
2. [Prompt Engineering for CV Tailoring with LLMs](#2-prompt-engineering-for-cv-tailoring-with-llms)
3. [Job Description Analysis Techniques](#3-job-description-analysis-techniques)
4. [CV Scoring and Optimization](#4-cv-scoring-and-optimization)
5. [Master Profile Data Structure](#5-master-profile-data-structure)
6. [Implementation Recommendations for Selvi](#6-implementation-recommendations-for-selvi)

---

## 1. AI CV Tailoring -- State of the Art

### 1.1 How the Major Tools Work

The commercial CV tailoring market is well established. Here is how the leading platforms operate under the hood:

**Jobscan** uses ML to compare a resume against a specific job description, producing a "Match Report" with keyword gap analysis, formatting advice, and ATS-specific tips (targeting Workday, Greenhouse, Taleo). Their "One-Click Optimize" feature lets users accept or reject individual keyword suggestions. Jobscan is the benchmark for ATS match scoring.

**Teal** combines ChatGPT-based ML with a full job search workspace. Their "Matching Mode" shows how each resume section aligns with a job description. Teal provides 90% of features free, including a Job Tracker, with premium at $9/week. Their strength is the end-to-end workflow: track job -> tailor resume -> apply.

**Kickresume** focuses on the design+writing intersection. It offers AI-powered writing tools embedded in visually polished templates. Kickresume is strongest for roles where visual presentation matters (creative, marketing) but weaker for ATS-heavy application pipelines.

**Resume Worded** provides a 30+ point analysis covering both resume and LinkedIn profile. Their "Targeted Resume" tool is a free ATS scanner that identifies missing keywords relative to a specific job description. Their scoring is more granular than most competitors.

**Rezi** markets itself as trained on thousands of real resumes, job descriptions, and recruiter feedback. It uses GPT-4.1 under the hood and focuses on what hiring managers and ATS systems look for in practice.

### 1.2 Keyword Matching Techniques

These tools use a spectrum of matching approaches:

**Exact keyword matching:** The baseline. If the JD says "stakeholder management" and the CV says "stakeholder management," that is a match. Simple but insufficient on its own because candidates and JDs use different terminology for identical skills.

**Semantic matching:** Goes beyond exact text. Uses NLP embeddings (vector representations of words/phrases) to recognize that "client support" and "customer service" are related, or that "programme management" and "project management" overlap significantly. Technically, this works by converting both CV and JD text into vector embeddings, then computing cosine similarity between them. Modern ATS systems (Greenhouse, Lever) increasingly use this approach rather than pure keyword matching.

**Synonym and variant recognition:** A middle ground. Recognizes that "Python development," "Python programming," and "Python scripting" all satisfy a requirement for "Python." Also handles UK/US spelling differences ("organisation" vs "organization") and abbreviation expansion ("L&D" = "Learning and Development").

**Contextual matching:** The most sophisticated tier. An LLM understands that "led a team of 12 instructional designers" demonstrates both "team leadership" and "instructional design" competency, even though neither phrase appears verbatim. This is where Claude's 200K context window provides a significant advantage -- it can hold an entire master profile and JD simultaneously.

### 1.3 Intelligent Tailoring vs Keyword Stuffing

The distinction matters for building a system that actually works:

**Keyword stuffing** is the practice of cramming target keywords into a CV regardless of context. Common tactics include: using white text on white backgrounds, repeating phrases in slight variations, copying entire skills sections from JDs verbatim, and creating bullet points that feel engineered rather than earned. Modern ATS systems detect and penalize these patterns. Recruiters spot them immediately -- they feel repetitive and lack depth.

**Intelligent tailoring** restructures genuine experience to align with employer requirements while maintaining authentic voice. It works by: reordering bullet points to prioritize relevant achievements, adjusting language to mirror JD terminology (while remaining truthful), modifying the professional summary to directly address stated requirements, and expanding relevant experience while condensing less relevant sections.

The practical difference: keyword stuffing adds words the candidate may not own; intelligent tailoring reframes words the candidate already has.

### 1.4 Match Score Calculation

Tools calculate match scores using weighted multi-factor analysis:

| Factor | Typical Weight | What It Measures |
|--------|---------------|-------------------|
| Hard skill keywords | 30-40% | Exact/semantic matches for technical skills |
| Soft skill keywords | 10-15% | Matches for interpersonal/leadership competencies |
| Job title alignment | 15-20% | How closely the candidate's titles match the target |
| Experience level | 10-15% | Years of experience, seniority signals |
| Education match | 5-10% | Degree level, field of study, certifications |
| Industry relevance | 5-10% | Sector-specific terminology and experience |
| Formatting/structure | 5-10% | ATS parseability, section clarity |

A score above 80% is considered strong; 60-79% is borderline; below 60% risks automatic rejection. Tools like Jobscan display this as a percentage or letter grade.

### 1.5 Failure Modes

Worth understanding what goes wrong, because these failure modes should inform the system design:

**Over-optimization:** The CV scores 95% on keyword match but reads like a keyword salad. Recruiters describe these as "engineered rather than earned." The candidate gets through ATS but is rejected in the 6-second human scan.

**Loss of authenticity:** The tailored CV no longer sounds like the candidate. In interviews, there is a disconnect between the CV's tone and the person sitting across the table. This is particularly risky for senior roles where voice and leadership style matter.

**Hallucinated experience:** The AI invents achievements, inflates metrics, or attributes experience the candidate does not have. This is the most dangerous failure mode -- it can lead to interview embarrassment, offer rescission, or reputational damage.

**Mismatch between CV and interview:** If the CV emphasizes skills the candidate cannot demonstrate live, the interview fails. The CV must reflect what the candidate can actually discuss in depth.

**Format destruction:** AI generates text that looks right in plain text but breaks when rendered in a formatted document. Headers, bullet points, spacing, and font consistency all matter.

**UK/US confusion:** For UK roles, the system must output "CV" not "resume," use UK spelling conventions, format dates as DD/MM/YYYY, express salary in GBP, and reference UK-specific qualifications (CIPD, NVQ levels, RQF framework).

---

## 2. Prompt Engineering for CV Tailoring with LLMs

### 2.1 The Multi-Stage Pipeline (Chain of Thought)

The approach that works best in both academic research (ResumeFlow, SIGIR 2024) and production systems is a multi-stage pipeline rather than a single prompt:

**Stage 1: Job Description Analysis**
```
Input: Raw job description text
Output: Structured JSON with extracted requirements
```
The LLM acts as a "job description analyst" and extracts: job title, company, location, salary (if stated), required qualifications, preferred qualifications, key responsibilities, required skills (hard), required skills (soft), industry-specific keywords, seniority level, and hidden signals (urgency, team size, reporting line).

**Stage 2: Candidate-JD Mapping**
```
Input: Structured JD analysis + Master candidate profile
Output: Mapping of candidate experience to JD requirements
```
The LLM identifies: which requirements the candidate meets directly, which requirements the candidate meets through transferable experience, which requirements represent genuine gaps, and which achievements should be emphasized/de-emphasized.

**Stage 3: Tailored CV Generation**
```
Input: Mapping + Master profile + JD analysis + CV template/format rules
Output: Tailored CV content
```
The LLM generates the actual CV content, section by section, following strict formatting and honesty constraints.

**Stage 4: Quality Validation**
```
Input: Generated CV + Original JD + Master profile
Output: Quality report with scores and flagged issues
```
A separate LLM call validates: keyword coverage, hallucination detection (does every claim trace back to the master profile?), readability score, ATS compatibility, and overall coherence.

This works better than a single-prompt approach because each stage has one job and can be validated on its own.

### 2.2 Prompt Structure Best Practices

Based on Anthropic's documentation and production implementations:

**System prompt (persona establishment):**
```
You are an expert CV writer with 15 years of experience in UK recruitment,
specialising in Learning & Development and higher education roles. You
understand ATS systems, UK CV conventions, and how to present academic
and corporate experience for maximum impact.

CRITICAL RULES:
- NEVER invent experience, qualifications, or achievements
- ONLY use information present in the candidate's master profile
- If you cannot find relevant experience for a requirement, flag it as a gap
- Use UK English spelling throughout
- Maintain the candidate's authentic professional voice
```

**Task prompt structure (using XML tags as recommended by Anthropic):**
```xml
<job_description>
{full job description text}
</job_description>

<candidate_profile>
{master profile JSON}
</candidate_profile>

<task>
Analyse this job description and generate a tailored CV following these steps:

1. Extract the top 10 requirements from the job description, ranked by importance
2. For each requirement, identify matching experience from the candidate profile
3. Generate a tailored CV that emphasises matched experience
4. Flag any requirements where no match exists

Output as structured JSON matching this schema: {schema}
</task>

<constraints>
- Maximum 2 pages when rendered
- UK CV format (no photo, no date of birth, no marital status)
- Professional summary: 3-4 sentences, directly addressing this role
- Each role: maximum 5 bullet points, achievement-focused (Action + Metric + Outcome)
- Skills section: mirror terminology from JD where truthful
</constraints>
```

### 2.3 Preventing Hallucination

This is the hardest part to get right. Strategies that work:

**Grounding through explicit constraint:** Tell Claude that accuracy matters more than completeness. Use prompts like: "If the candidate's profile does not contain experience relevant to a requirement, write 'GAP: [requirement]' rather than generating content."

**Source attribution:** Require the LLM to cite which part of the master profile each bullet point draws from. This creates a traceable chain: master profile section -> generated bullet point.

**Two-pass verification:** After generating the CV, run a second LLM call specifically to compare the generated CV against the master profile and flag any claims that do not trace back to source material. This is ResumeFlow's "content preservation" metric.

**Constrained vocabulary:** For metrics and numbers, only allow values that appear in the master profile. Do not let the model round up, extrapolate, or infer numbers. "Managed a team of 8" should never become "Led teams of 10+."

**Temperature control:** Use temperature 0.0-0.2 for CV generation. This minimizes creative drift while maintaining natural language flow. Temperature 0.0 produces the most deterministic output; 0.2 adds slight variation for natural phrasing without introducing fabrication risk.

**Structured output enforcement:** Use Claude's structured output feature (`output_config.format` with JSON schema) to constrain the response format. This prevents the model from generating free-form text that drifts from the source material.

### 2.4 Keyword Integration Without Sounding Robotic

The problem: how do you inject JD keywords without the CV reading like it was assembled by a machine? Some approaches:

**Mirror, don't copy.** If the JD says "stakeholder engagement," and the candidate's profile says "worked with senior leaders," the tailored bullet should say "Engaged senior stakeholders across [specific context]..." -- using the JD term but grounded in real experience.

**Vary sentence structure.** Avoid every bullet starting with the same pattern. Mix: "Led...", "Designed and delivered...", "Collaborated with...", "Increased... by..."

**Use the professional summary as the primary keyword anchor.** The summary is 3-4 sentences of free-form text where keywords can be naturally woven in. This is the highest-impact section for both ATS and human readers.

**Embed keywords in context, not lists.** "Delivered a blended learning programme using Articulate Storyline and Adobe Captivate, resulting in 40% improvement in completion rates" is better than "Skills: Articulate Storyline, Adobe Captivate, blended learning."

### 2.5 Claude API Settings for CV Generation

| Parameter | Recommended Value | Rationale |
|-----------|------------------|-----------|
| Model | claude-sonnet-4-5 | Best balance of quality and cost for structured generation |
| Temperature | 0.1-0.2 | Low creativity, high fidelity to source material |
| Max tokens | 4096 | Sufficient for a full 2-page CV in JSON format |
| Structured output | JSON schema mode | Ensures consistent, parseable output |
| System prompt | ~500 tokens | Persona + rules + constraints |

For the JD analysis stage (Stage 1), claude-haiku-4-5 is sufficient and cheaper. For the validation stage (Stage 4), use claude-sonnet-4-5 for thorough hallucination detection.

### 2.6 Quality Control Pipeline

Before finalising any generated CV:

1. **Hallucination check:** Compare every factual claim in generated CV against master profile. Flag anything not traceable.
2. **Keyword coverage:** Calculate percentage of JD keywords present in generated CV. Target: 75-85% (not 100% -- that looks artificial).
3. **Readability check:** Flesch-Kincaid Grade Level should be 8-10 (professional but accessible). Flesch Reading Ease should be 60+.
4. **Length check:** Must fit 2 pages when rendered. Professional summary under 60 words. Each bullet under 25 words.
5. **UK English check:** Verify spelling conventions (organisation, programme, analyse, centre).
6. **Format check:** Validate that the output renders correctly in the target template.
7. **Gap report:** List JD requirements that could not be matched, for the candidate's awareness.

---

## 3. Job Description Analysis Techniques

### 3.1 Extracting Required vs Preferred Qualifications

Job descriptions follow predictable patterns. A structured extraction should parse:

**Required qualifications** -- signalled by language like:
- "Must have," "Essential," "Required," "Minimum"
- Items listed first or given their own section
- Qualifications that appear in the job title itself
- Skills mentioned more than once across different sections

**Preferred qualifications** -- signalled by:
- "Nice to have," "Desirable," "Preferred," "Advantageous"
- Items listed after required qualifications
- Phrases like "experience with X is a plus"
- Qualifications appearing only once

**Implicit requirements** -- not stated but inferable:
- Seniority expectations from salary band (GBP 70-80K implies Manager/Head level in UK L&D)
- Industry expectations from company description
- Technical requirements from mentioned tools/platforms
- Soft skills implied by team structure ("matrix organisation" implies stakeholder management)

### 3.2 Decoding Hidden Requirements

Corporate job descriptions use coded language. A JD analyser should map these:

| Phrase | Likely Meaning |
|--------|---------------|
| "Fast-paced environment" | Heavy workload, shifting priorities, minimal handholding |
| "Wear many hats" | Understaffed, role lacks structure, expect tasks outside scope |
| "Dynamic" | High-energy culture, possibly youthful workplace expectation |
| "Self-starter" | Limited onboarding, minimal supervision, figure it out yourself |
| "Immediate impact" | Urgent business need, likely backfilling a gap |
| "Collaborative" | Consensus-driven culture, many meetings |
| "Results-driven" | Metrics-heavy, performance closely watched |
| "Flexible working" (UK) | May mean hybrid/remote, or may mean irregular hours expected |
| "Competitive salary" | Salary not disclosed, likely below market or highly variable |
| "Exciting opportunity" | May be overselling a difficult role |
| "Growing team" | New team, processes not yet established |
| "Well-established" | May mean bureaucratic, slow to change |

For Selvi's specific context, these decodings are particularly relevant:

| L&D/Academic Phrase | Meaning |
|---------------------|---------|
| "Strategic L&D partner" | Expects business acumen, not just training delivery |
| "Digital transformation" | Moving from classroom to digital; tech adoption skills needed |
| "Learning culture" | Organisation values development; good sign for L&D investment |
| "Revenue-generating programmes" | L&D expected to contribute to bottom line, not just cost centre |
| "REF-returnable" (academic) | Research output matters for this lectureship |
| "Teaching-focused" (academic) | Research less important; heavy teaching load expected |
| "NSS scores" (academic) | Student satisfaction metrics will be watched |

### 3.3 UK-Specific Job Description Language

The system must handle UK conventions:

**Qualifications framework:** UK uses RQF levels 1-8. A PhD is Level 8, MBA is Level 7, CIPD Level 7 is equivalent to a postgraduate qualification. CIPD is the dominant professional body for HR/L&D roles. The system should recognise CIPD membership levels: Foundation (Level 3), Associate (Level 5), Chartered Member (Level 7), Chartered Fellow (by experience).

**Salary conventions:** UK jobs typically state annual gross salary in GBP. Ranges like "GBP 70,000-80,000" or salary bands like "Grade 8" (university) are common. "Pro rata" means the stated salary is for full-time; part-time is proportional.

**Location terms:** "Commutable from" is common in UK JDs. "Home counties" refers to the counties surrounding London. "Greater London" has a specific boundary. "Hybrid" typically means 2-3 days in office in the UK context.

**Notice period:** UK convention is to ask for notice period in weeks/months (typically 1-3 months for senior roles). This is a practical constraint the system should surface.

**Right to work:** "Must have the right to work in the UK" is standard. Sponsorship availability ("visa sponsorship available") is often explicitly stated or conspicuously absent.

### 3.4 Detecting Red Flags in Job Descriptions

The JD analyser should flag:

- **Ghost job signals:** Posted for 60+ days, reposted frequently, very generic description, no specific team mentioned, no named hiring manager
- **Data harvesting:** Asks for excessive personal information up front, suspicious company with no web presence
- **Bait-and-switch:** Title says "Head of L&D" but responsibilities describe an L&D Coordinator; salary doesn't match seniority
- **Unrealistic requirements:** Wants 10+ years experience for a salary of GBP 35K; wants PhD + CIPD Level 7 + 5 years industry for an entry-level position
- **Toxic culture signals:** "Must be available 24/7," "no work-life balance complaints," "thick skin required"

### 3.5 Mapping JD Requirements to Candidate Experience

For each JD requirement, the mapper should produce:

```json
{
  "requirement": "Experience designing blended learning programmes",
  "requirement_type": "essential",
  "match_status": "strong_match",
  "match_evidence": [
    {
      "source_section": "work_experience.acme_corp",
      "source_text": "Designed and delivered a blended learning curriculum combining e-learning modules, workshops, and coaching sessions for 500+ employees",
      "relevance_score": 0.92
    }
  ],
  "suggested_cv_text": "Designed and delivered blended learning programmes combining digital modules, facilitated workshops, and 1:1 coaching, reaching 500+ employees across 3 business units",
  "keywords_to_include": ["blended learning", "programme design", "e-learning"]
}
```

Match statuses should be: `strong_match` (direct experience), `partial_match` (transferable experience), `weak_match` (tangential experience), `gap` (no relevant experience found).

---

## 4. CV Scoring and Optimization

### 4.1 Programmatic CV Scoring

A scoring algorithm should evaluate the tailored CV against the JD across multiple dimensions:

**Keyword Coverage Score (Weight: 35%)**
```
score = (matched_keywords / total_jd_keywords) * 100

Where:
- matched_keywords includes exact matches AND semantic matches (cosine similarity > 0.8)
- total_jd_keywords = unique skill/qualification terms extracted from JD
- Target: 75-85%
```

**Experience Alignment Score (Weight: 25%)**
```
score = sum(requirement_match_scores * requirement_weights) / sum(requirement_weights)

Where:
- Each JD requirement gets a match score (0.0 to 1.0)
- Essential requirements weighted 2x vs preferred requirements
- Target: 0.70+
```

**ATS Compatibility Score (Weight: 15%)**
```
Checks:
- Standard section headers used (yes/no)
- No tables, columns, or graphics (yes/no)
- Contact info in plain text (yes/no)
- File format compatible (.docx or .pdf, not image-based)
- No headers/footers with critical info (yes/no)
- Dates in consistent, parseable format (yes/no)
- Target: 100% (all checks pass)
```

**Readability Score (Weight: 10%)**
```
Flesch-Kincaid Grade Level: target 8-10
Flesch Reading Ease: target 60-70
Average sentence length: target 15-20 words
Average bullet point length: target 12-20 words
```

**Content Authenticity Score (Weight: 15%)**
```
score = (verified_claims / total_claims) * 100

Where:
- verified_claims = bullet points traceable to master profile
- total_claims = all factual/achievement bullet points in generated CV
- Target: 100% (no hallucinated content)
```

### 4.2 Keyword Density Analysis

Optimal keyword density for CVs is 1-3% per keyword. For a 500-word CV, each primary keyword should appear 2-4 times across different sections. Going above 5% density for any single keyword triggers stuffing detection.

**Placement hierarchy (by weight in ATS scoring):**
1. Job title / Professional headline (highest weight)
2. Professional summary (high weight)
3. Skills section (medium-high weight)
4. Work experience bullet points (medium weight)
5. Education and certifications (lower weight)

**Natural distribution strategy:**
- Primary keywords (top 5 from JD): appear in summary + skills + at least 2 experience bullets
- Secondary keywords (6-15 from JD): appear in skills + at least 1 experience bullet
- Tertiary keywords (16+): appear where naturally relevant

### 4.3 Skills Gap Identification

The system should produce a gap analysis report:

```json
{
  "full_matches": [
    { "requirement": "CIPD Level 7", "evidence": "Chartered MCIPD" }
  ],
  "partial_matches": [
    {
      "requirement": "Experience with Workday LMS",
      "evidence": "Experience with Cornerstone OnDemand LMS",
      "gap_note": "Different LMS platform but transferable skills",
      "mitigation": "Emphasise LMS administration experience generically"
    }
  ],
  "gaps": [
    {
      "requirement": "Power BI dashboard creation",
      "severity": "low",
      "is_essential": false,
      "mitigation": "Candidate has Excel analytics experience; could mention willingness to upskill"
    }
  ],
  "overall_match_percentage": 82,
  "recommendation": "Strong match. Proceed with tailored application."
}
```

### 4.4 ATS Compatibility Checks

Specific technical validations:

- **File format:** .docx is most universally parseable. Some ATS struggle with .pdf. Never use .pages, .odt, or image-based PDFs.
- **Font:** Standard fonts only (Arial, Calibri, Times New Roman, Helvetica). 10-12pt body text.
- **Structure:** Single-column layout. Standard section headers ("Professional Experience" not "My Journey"). No text boxes, tables, or multi-column layouts.
- **Encoding:** UTF-8 with no special characters that might render as garbled text.
- **File size:** Under 2MB. No embedded images.
- **Headers/footers:** Avoid placing name or page numbers in headers/footers -- many ATS skip these.

### 4.5 Readability for Human Reviewers

After ATS parsing, a human recruiter spends about 6 seconds on the first scan. The CV has to work for both the machine and the person. What matters for the human layer:

- **Visual hierarchy:** Clear section breaks, consistent formatting, adequate white space
- **Scannable bullets:** Start with action verbs, front-load the most impressive detail
- **Quantified achievements:** Numbers catch the eye during a 6-second scan ("40% improvement" pops more than "significant improvement")
- **Relevance ordering:** Most relevant experience first, within each section
- **Professional summary as hook:** The first 3-4 sentences determine whether the recruiter reads further

---

## 5. Master Profile Data Structure

### 5.1 What the Master Profile Should Contain

The master profile is where all tailored CVs draw from. It needs to be comprehensive (contain everything the candidate has ever done), tagged (so content can be filtered by role type), and structured for programmatic reuse.

### 5.2 Recommended Schema

Building on JSON Resume (the open standard) with extensions for tailoring:

```json
{
  "meta": {
    "version": "1.0",
    "last_updated": "2026-03-29",
    "candidate_id": "selvi-001"
  },

  "basics": {
    "name": "Dr Selvi [Surname]",
    "title": "Learning & Development Leader | University Lecturer",
    "email": "...",
    "phone": "...",
    "location": {
      "city": "Maidenhead",
      "region": "Berkshire",
      "country": "UK",
      "commute_radius_miles": 40,
      "commute_notes": "Accessible to London, Reading, Oxford, Slough"
    },
    "profiles": [
      { "network": "LinkedIn", "url": "..." }
    ],
    "summary_variants": {
      "corporate_ld": "Chartered MCIPD professional with 18 years...",
      "academic": "Published researcher and experienced lecturer...",
      "general": "PhD and MBA-qualified professional with..."
    }
  },

  "target_roles": [
    {
      "type": "corporate",
      "titles": ["Head of Learning & Development", "L&D Manager", "Director of Learning"],
      "salary_range": { "min": 70000, "max": 80000, "currency": "GBP" },
      "seniority": ["manager", "head", "director"]
    },
    {
      "type": "academic",
      "titles": ["Lecturer", "Senior Lecturer"],
      "salary_range": { "min": 45000, "max": 65000, "currency": "GBP" },
      "seniority": ["lecturer", "senior_lecturer"]
    }
  ],

  "qualifications": [
    {
      "type": "academic",
      "level": "PhD",
      "rqf_level": 8,
      "field": "...",
      "institution": "...",
      "year": 2015,
      "tags": ["research", "academic", "hr", "l&d"]
    },
    {
      "type": "academic",
      "level": "MBA",
      "rqf_level": 7,
      "field": "...",
      "institution": "...",
      "year": 2010,
      "tags": ["business", "strategy", "management"]
    },
    {
      "type": "professional",
      "name": "Chartered MCIPD",
      "body": "CIPD",
      "level": "Level 7 equivalent",
      "tags": ["hr", "l&d", "professional_body"]
    }
  ],

  "skills": [
    {
      "name": "Learning Strategy",
      "category": "core_l&d",
      "proficiency": "expert",
      "years": 15,
      "keywords": ["learning strategy", "L&D strategy", "training strategy", "capability building"],
      "evidence": ["work.acme.highlights[0]", "work.beta.highlights[2]"],
      "tags": ["corporate", "academic", "strategic"]
    },
    {
      "name": "Programme Design",
      "category": "core_l&d",
      "proficiency": "expert",
      "years": 12,
      "keywords": ["programme design", "curriculum design", "course development", "instructional design", "learning design"],
      "evidence": ["work.acme.highlights[1]", "projects.leadership_programme"],
      "tags": ["corporate", "academic", "design"]
    }
  ],

  "work_experience": [
    {
      "id": "acme",
      "company": "Acme Corp",
      "position": "Head of Learning & Development",
      "start_date": "2019-01",
      "end_date": "2024-06",
      "location": "London, UK",
      "sector": "Financial Services",
      "team_size": 8,
      "reporting_to": "Chief People Officer",
      "tags": ["corporate", "financial_services", "senior", "l&d"],
      "highlights": [
        {
          "id": "acme_h1",
          "text": "Designed and delivered a blended learning curriculum for 500+ employees, improving completion rates by 40%",
          "tags": ["blended_learning", "programme_design", "metrics", "scale"],
          "skills_demonstrated": ["programme_design", "blended_learning", "lms_management"],
          "metrics": { "type": "improvement", "value": 40, "unit": "percent", "context": "completion rates" },
          "suitable_for": ["corporate_ld", "academic"]
        },
        {
          "id": "acme_h2",
          "text": "Managed an annual L&D budget of GBP 1.2M, achieving 15% cost reduction through vendor renegotiation and digital delivery",
          "tags": ["budget_management", "cost_reduction", "digital_transformation"],
          "skills_demonstrated": ["budget_management", "vendor_management", "digital_strategy"],
          "metrics": { "type": "cost_reduction", "value": 15, "unit": "percent", "context": "L&D budget" },
          "suitable_for": ["corporate_ld"]
        }
      ]
    }
  ],

  "publications": [
    {
      "title": "...",
      "journal": "...",
      "year": 2020,
      "doi": "...",
      "tags": ["research", "hr", "l&d"],
      "suitable_for": ["academic"]
    }
  ],

  "teaching_experience": [
    {
      "institution": "...",
      "modules": ["HRM", "Organisational Behaviour", "Strategic L&D"],
      "level": "undergraduate",
      "student_numbers": 120,
      "tags": ["academic", "teaching"],
      "suitable_for": ["academic"]
    }
  ],

  "professional_memberships": [
    {
      "body": "CIPD",
      "level": "Chartered Member",
      "since": 2012
    }
  ],

  "keyword_bank": {
    "l&d_corporate": [
      "learning and development", "L&D", "talent development", "capability building",
      "leadership development", "succession planning", "learning strategy",
      "blended learning", "digital learning", "e-learning", "LMS",
      "training needs analysis", "TNA", "ROI measurement", "Kirkpatrick",
      "coaching", "mentoring", "facilitation", "organisational development"
    ],
    "academic": [
      "curriculum design", "module leader", "programme leader",
      "research-informed teaching", "student engagement", "NSS",
      "TEF", "REF", "peer-reviewed publication", "supervision",
      "assessment design", "quality assurance", "external examining"
    ],
    "hr_general": [
      "CIPD", "employee engagement", "performance management",
      "talent management", "workforce planning", "change management",
      "stakeholder management", "business partnering"
    ]
  }
}
```

### 5.3 Design Principles for the Master Profile

**Comprehensive over concise.** The master profile should contain everything; tailored CVs select from it. A 10-page master profile that generates 2-page tailored CVs is ideal.

**Tagged for filterability.** Every highlight, skill, and experience should be tagged with: domain (corporate/academic/both), sector relevance, skill categories, and seniority level. This allows the LLM to quickly filter relevant content.

**Achievement-focused highlights.** Each highlight follows the Action + Metric + Outcome pattern where possible. Metrics are stored separately so the system never needs to infer or fabricate numbers.

**Multiple summary variants.** Pre-written professional summary variants for each target role type (corporate L&D, academic, hybrid) provide a starting point that the LLM refines rather than generates from scratch. This reduces hallucination risk.

**Keyword bank.** A manually curated, role-type-specific keyword bank gives the LLM an approved vocabulary to draw from. This is the bridge between JD language and candidate language.

**Evidence chains.** Each skill links to the specific highlights that demonstrate it. When the LLM includes a skill claim, it can cite the evidence, making hallucination detection straightforward.

### 5.4 Handling the Corporate-Academic Crossover

Selvi's profile spans both corporate L&D and academic teaching/research. The master profile must handle this by:

**Separate summary variants.** A corporate summary leads with business impact and professional credentials (CIPD, budget management, team leadership). An academic summary leads with research, publications, teaching excellence, and doctoral credentials.

**Translatable highlights.** Some achievements work for both domains but need different framing:
- Corporate: "Designed a leadership development programme for 200 senior managers, resulting in 30% improvement in 360-degree feedback scores"
- Academic: "Developed and delivered a research-informed leadership module for postgraduate students, drawing on original research into [topic]"

**Section ordering.** For corporate CVs: Professional Summary -> Key Skills -> Professional Experience -> Education -> Publications (brief). For academic CVs: Professional Summary -> Education -> Research & Publications -> Teaching Experience -> Professional Experience -> Professional Memberships.

**Qualification emphasis.** PhD is a differentiator for corporate L&D roles (not always common in the field) and should be highlighted. For academic roles, it is a baseline expectation and should be listed but not over-emphasised.

---

## 6. Implementation Recommendations for Selvi

### 6.1 Recommended Architecture for n8n

```
[Job discovered by Module 1]
        |
        v
[Stage 1: JD Analysis]
  n8n HTTP Request -> Claude Haiku
  Input: raw JD text
  Output: structured JD JSON
        |
        v
[Stage 2: Candidate-JD Mapping]
  n8n Code node (load master profile from Postgres)
  n8n HTTP Request -> Claude Sonnet
  Input: JD JSON + master profile JSON
  Output: mapping JSON (matches, gaps, recommendations)
        |
        v
[Stage 3: CV Generation]
  n8n HTTP Request -> Claude Sonnet
  Input: mapping JSON + master profile + format rules
  Output: tailored CV JSON
  Temperature: 0.1
        |
        v
[Stage 4: Quality Validation]
  n8n HTTP Request -> Claude Sonnet
  Input: generated CV + original JD + master profile
  Output: quality report JSON (scores, flags, gaps)
        |
        v
[Stage 5: Rendering]
  n8n Code node -> convert JSON to formatted document
  Output: .docx and .pdf via template engine
        |
        v
[Stage 6: Human Review Queue]
  Store in Postgres with status "pending_review"
  Notify candidate with CV + quality report + gap analysis
```

### 6.2 Cost Estimate Per Tailored CV

| Stage | Model | Input Tokens | Output Tokens | Cost (est.) |
|-------|-------|-------------|--------------|-------------|
| JD Analysis | Haiku | ~2,000 | ~1,000 | $0.003 |
| Mapping | Sonnet | ~8,000 | ~2,000 | $0.054 |
| Generation | Sonnet | ~10,000 | ~3,000 | $0.075 |
| Validation | Sonnet | ~12,000 | ~1,500 | $0.059 |
| **Total** | | | | **~$0.19** |

At 10 applications per week, that is roughly $2/week or GBP 7/month -- well within budget.

### 6.3 Key Design Decisions

1. **Section-by-section generation vs whole-CV generation.** ResumeFlow found section-by-section is more reliable -- it avoids the "lost in the middle" problem where LLMs lose track of details in long contexts. Recommended: generate each CV section in a separate LLM call within Stage 3, then assemble.

2. **Master profile storage.** Store in Postgres as JSONB. This allows the profile to be queried, updated, and versioned without file management overhead.

3. **Template rendering.** Use a templating engine (Jinja2 or Handlebars) to convert the CV JSON into formatted HTML, then render to .docx/.pdf. This separates content from presentation and allows template changes without regenerating content.

4. **Human-in-the-loop.** Every generated CV should be reviewed before submission. The quality report highlights areas needing attention. The candidate makes the final call.

5. **Feedback loop.** Track which tailored CVs lead to interviews and offers. Over time, this data can inform which tailoring strategies work best for specific role types.

### 6.4 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| AI hallucinates experience | Grounded generation + two-pass verification + human review |
| Over-optimised CVs rejected by recruiters | Target 75-85% keyword match, not 100%. Keep authentic voice. |
| UK spelling/format errors | Explicit UK English constraints in system prompt + post-processing check |
| ATS parsing failures | Strict formatting rules + test with common ATS parsers |
| Master profile becomes stale | Prompt candidate to review/update after each interview cycle |
| Cost overruns from API calls | Use Haiku for simple stages, Sonnet only where quality matters |
| Template rendering breaks | Separate content generation from rendering; test templates independently |

---

## Sources

### AI CV Tailoring Tools & Techniques
- [Reztune -- AI Resume Tailoring](https://www.reztune.com/ai-resume-tailoring/)
- [Reztune -- Best AI Resume Tailoring Tools 2026](https://www.reztune.com/blog/best-ai-resume-tailoring-2025/)
- [Rezi -- Free AI Resume Builder](https://www.rezi.ai/)
- [PitchMeAI -- Best AI Resume Tailoring Tools 2026](https://pitchmeai.com/blog/best-ai-resume-tailoring-tools)
- [Jobscan -- ATS Resume Checker](https://www.jobscan.co/)
- [Teal -- Jobscan Alternatives](https://www.tealhq.com/post/jobscan-alternatives)
- [Resume Worded -- Targeted Resume](https://resumeworded.com/targeted-resume)
- [Best AI Resume Optimization Tools 2026](https://bestjobsearchapps.com/articles/en/7-best-ai-resume-optimization-tools-for-ats-passing-and-keyword-matching-in-2026)

### Prompt Engineering & LLM Best Practices
- [Claude Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude Increase Output Consistency](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency)
- [Best LLMs for Resume Writing](https://nutstudio.imyfone.com/llm-tips/best-llm-for-resume-writing/)
- [Best LLM for Resume and JD Analysis](https://pitchmeai.com/blog/best-llm-resume-job-description-analysis)
- [AI Resume Agent 6x Interview Rate (Claude Sonnet)](https://dev.to/aabyzov/i-built-an-ai-resume-agent-that-6xd-my-interview-rate-claude-sonnet-45-4c77)

### Academic Research
- [ResumeFlow: LLM Pipeline for Resume Generation (SIGIR 2024)](https://arxiv.org/html/2402.06221v2)
- [Zero-Shot Resume-Job Matching via Structured Prompting](https://www.mdpi.com/2079-9292/14/24/4960)
- [SkillSync: Explainable AI for Resume Evaluation](https://www.ijert.org/skillsync-an-explainable-ai-framework-for-resume-evaluation-skill-gap-analysis-and-career-alignment-ijertconv14is010027)
- [Job Description Parsing with Transformer Models](https://www.sciencedirect.com/science/article/pii/S2949719124000505)

### ATS Scoring & Keyword Optimization
- [Understanding ATS Scoring Algorithms](https://scale.jobs/blog/understanding-ats-scoring-algorithms)
- [ATS Resume Keyword Density Best Practices](https://www.cvowl.com/blog/ats-resume-keyword-density-best-practices)
- [ATS Resume Keywords Guide 2026](https://uppl.ai/ats-resume-keywords/)
- [How to Master Resume Keyword Density 2025](https://jobwinner.ai/resume/how-to-master-resume-keyword-density-in-2025/)
- [ATS Optimization Hub 2026](https://www.resumeadapter.com/blog/ats-optimization-hub)

### Job Description Analysis
- [Decode Job Descriptions Like a Recruiter](https://www.senseicopilot.com/blog/how-to-decode-a-job-description-like-a-recruiter)
- [Job Description Hidden Requirements](https://www.careerbeez.com/job-search-tips/job-description-hidden-requirements/)
- [NLP: Extract Skills from Job Descriptions](https://www.kaggle.com/code/sanabdriss/nlp-extract-skills-from-job-descriptions)

### Hallucination Prevention
- [How to Reduce AI Hallucinations](https://maryann-belarmino.medium.com/how-to-reduce-ai-hallucinations-prompting-techniques-that-actually-work-c4606aa4b8ed)
- [Grounding AI in Reality](https://cloudsecurityalliance.org/blog/2025/12/12/the-ghost-in-the-machine-is-a-compulsive-liar)
- [How to Prevent LLM Hallucinations](https://www.voiceflow.com/blog/prevent-llm-hallucinations)

### Readability & Human Review
- [Designing Readable Resume Layouts](https://www.resumly.ai/blog/designing-a-clean-resume-layout-that-enhances-readability-for-human-recruiters)
- [5 Tips for Writing a Readable Resume](https://readable.com/blog/5-tips-for-writing-a-readable-resume/)
- [Resume Keyword Stuffing: Why It Fails](https://martianlogic.com/blogs/why-stuffing-your-resume-with-keywords-is-pointless)

### Data Structures & Schemas
- [JSON Resume Schema](https://jsonresume.org/schema)
- [Schema Resume -- JSON-LD for CVs](https://schema-resume.org/)

### UK Qualifications
- [CIPD Qualifications 2026](https://www.icslearn.co.uk/blog/human-resources/everything-you-need-to-know-about-cipd-qualifications/)
- [CIPD Levels Explained](https://www.reed.co.uk/career-advice/cipd-levels-explained/)
- [UK RQF Level 5 Equivalents](https://peoplestudypro.com/blog/what-is-level-5-equivalent-to)

### n8n Workflows
- [n8n: AI HR Workflow for CV Analysis](https://n8n.io/workflows/2860-ai-automated-hr-workflow-for-cv-analysis-and-candidate-evaluation/)
- [n8n: Generate Tailored Resumes from LinkedIn Jobs](https://n8n.io/workflows/6748-generate-tailored-resumes-cover-letters-and-interview-prep-from-linkedin-jobs-with-ai/)
- [n8n: Automate Job Applications with AI Resume Tailoring](https://n8n.io/workflows/11215-automate-job-applications-with-ai-resume-tailoring-using-gpt-4o-linkedin-and-gmail/)
