# CV/Resume Tailoring System Research: UK Job Market
## For AI-Powered CV Generation Targeting Corporate L&D and Academic Roles

**Date:** 2026-03-29
**Profile:** PhD + MBA candidate, 18 years HR/L&D experience
**Target roles:** Corporate L&D Manager-to-Head (GBP 70-80k), University Lecturer/Senior Lecturer
**Target geography:** Maidenhead, Berkshire and surrounding area

---

## 1. ATS (Applicant Tracking Systems) in the UK Market

### 1.1 Most Common ATS Platforms Among UK Employers

The UK ATS landscape differs from the US, with several UK-native platforms holding significant market share alongside global enterprise systems. As of 2025-2026, CIPD reports that 75% of UK employers use some form of hiring technology.

**Enterprise / Large Corporates:**
- **Workday** -- Dominant in enterprise and large-cap companies. Includes AI modules evaluating skills alignment and career trajectory. Good PDF handling. Heavily weights job title matching.
- **Oracle Taleo** -- Legacy system still present in large organisations. Strict parsing requirements. Conservative formatting needed (DOCX strongly preferred over PDF). Minimal AI scoring.
- **SAP SuccessFactors** -- Common in large multinationals with SAP ERP installations.
- **iCIMS Talent Cloud** -- Growing presence, particularly in mid-to-large companies. Partial parsing quality; DOCX safer than PDF. Uses NLP models for semantic matching.
- **Greenhouse** -- Excellent parsing quality, advanced AI scoring, flexible employer configuration. Popular with tech-forward companies.
- **Lever** -- Good parsing, emphasises early human review over algorithmic scoring. Basic AI.

**UK-Specific / Public Sector:**
- **Oleeo** -- One of the most widely used ATS platforms in UK public sector. Used across councils, NHS Trusts, and central government for volume hiring.
- **Tribepad** -- Used by BBC, Tesco, several NHS trusts. Strong UK public-sector presence.
- **Eploy** -- Long-established UK ATS designed for structured recruitment processes and reporting. Also used by some universities.
- **Pinpoint** -- Used by in-house talent teams at mid-market and enterprise businesses across multiple brands and regions.

**Mid-Market / SMEs:**
- **Workable** -- Popular among growing companies.
- **Recruitee / BreezyHR** -- Common among UK SMEs.
- **SmartRecruiters** -- Growing mid-market presence.

**UK University Sector (see Section 1.7 for detail):**
- **Stonefish eRecruitment** -- HE-specific system used by Bath, Southampton, Edge Hill, Worcester, and many others.
- **Jobtrain** -- Used by University of Reading and other institutions.
- **CoreHR / Access People** -- HR/payroll system with recruitment module used by several universities.
- **iTrent (MHR)** -- Primarily payroll/HR but integrated with recruitment at some institutions (e.g., Bath uses it alongside Stonefish).
- **WCN, Lumesse** -- Enterprise-grade ATS used by some Russell Group universities.
- **Eploy** -- Marketing their education-specific ATS product to universities.

Sources:
- [Top ATS in the UK (March 2026) -- Qureos](https://www.qureos.com/hiring-guide/top-applicant-tracking-systems-in-the-uk)
- [How ATS Systems Work in 2026](https://www.atscvchecker.pro/blog/how-ats-systems-work-2026/)
- [Stonefish Software](https://www.stonefish.co.uk/)
- [University of Bath -- Stonefish](https://www.bath.ac.uk/guides/how-you-log-in-to-stonefish-is-changing/)
- [University of Reading -- Jobtrain](https://www.reading.ac.uk/human-resources/-/media/project/functions/human-resources/documents/02-hiring-manager---online-panel-shortlisting-v5.pdf)

### 1.2 How ATS Systems Parse CVs

ATS parsing operates in three phases:

**Phase 1 -- Extraction:** The system extracts structured data: name, contact information, job titles, employers, dates, skills, education credentials, and certifications.

**Phase 2 -- Scoring and Ranking:** The system evaluates the application against job requirements, generating a match score that determines placement in a ranked candidate list.

**Phase 3 -- Filtering:** Mandatory knockout filters eliminate candidates who do not meet baseline requirements (experience level, certifications, location) regardless of overall match score.

**How parsing actually works:**
- Text is extracted from the document and segmented by section headings
- Named Entity Recognition (NER) identifies names, dates, organisations, job titles
- Skills taxonomies (e.g., EMSI Burning Glass) map extracted skills to standardised nodes
- Dates are parsed to calculate tenure and career progression
- Education credentials are matched against degree/qualification databases

### 1.3 File Format: PDF vs DOCX

| Format | ATS Compatibility | Recommendation |
|--------|------------------|----------------|
| DOCX | 100% of ATS platforms | Gold standard. Use when submitting through online portals |
| PDF (text-based) | ~90% of modern ATS | Second-best. Works with Workday, Greenhouse, Lever. Risky with Taleo, iCIMS |
| PDF (scanned/image) | Poor | Avoid entirely |
| RTF | Variable | Not recommended |

**Key guidance for the system:**
- Default to DOCX for ATS-portal submissions
- Use PDF only when emailing directly to a human or when the posting specifically requests PDF
- Note: UK CV conventions often suggest PDF for preserving layout, but this conflicts with ATS optimisation. The system should support both formats and recommend DOCX for ATS portals.

Sources:
- [PDF vs DOCX for Resumes 2025 -- Resumemate](https://www.resumemate.io/blog/pdf-vs-docx-for-resumes-in-2025-what-recruiters-ats-really-prefer/)
- [ATS-Friendly Resume Format Guide 2026 -- CVCraft](https://cvcraft.roynex.com/blog/ats-friendly-resume-format-guide-2025)

### 1.4 Formatting That Kills ATS Parsing

The following formatting elements cause parsing failures (up to 93% accuracy drop with complex layouts):

| Element | Problem | ATS Impact |
|---------|---------|------------|
| **Tables** | Parser reads cells in unpredictable order, scrambles content | Critical -- content may be skipped entirely |
| **Two-column layouts** | Parser reads left-to-right across both columns, merging unrelated content | Critical -- data becomes nonsensical |
| **Headers/Footers** | Most ATS cannot read content in document headers/footers at all | Critical -- contact info commonly lost |
| **Text boxes** | Treated as floating objects, content often ignored | Severe |
| **Images/graphics** | Completely invisible to text parsers | Severe -- logos, headshots, skill bars all lost |
| **Fancy/decorative fonts** | May not be embedded; characters misread | Moderate |
| **Special characters/symbols** | Unicode bullets, arrows, rating stars may parse as gibberish | Moderate |
| **Infographics/charts** | Invisible to parser; skill-level bars are particularly common offenders | Severe |

**Safe formatting elements:**
- Single-column layout
- Standard bullet points (round dots or hyphens)
- Bold and italic for emphasis
- Horizontal lines for section separation (simple ones)
- Standard fonts: Arial, Calibri, Garamond, Georgia, Helvetica (10-12pt)

Sources:
- [Can ATS Read Tables and Columns -- Jobscan](https://www.jobscan.co/blog/resume-tables-columns-ats/)
- [ATS Formatting Mistakes -- Jobscan](https://www.jobscan.co/blog/ats-formatting-mistakes/)
- [ATS Resume Formatting Guide 2025](https://atsresumeai.com/blog/ats-resume-formatting-guide/)

### 1.5 Expected Section Headings

ATS systems are programmed to look for specific section titles. Creative headings cause content to be miscategorised or lost.

**Standard headings (use these exact labels or close variants):**

| Section | Acceptable Variants |
|---------|-------------------|
| Professional Summary / Personal Statement | Profile, Summary, Career Profile |
| Work Experience | Employment History, Professional Experience, Career History |
| Education | Academic Qualifications, Qualifications |
| Skills | Core Skills, Key Skills, Technical Skills, Core Competencies |
| Certifications | Professional Qualifications, Accreditations, Professional Development |
| Publications | Research Publications, Selected Publications |
| Awards | Honours, Achievements |

**Avoid:** "My Journey," "What I Bring," "Career Story," "About Me," "Value Proposition" -- these confuse ATS parsers.

Sources:
- [ATS Resume Format 2026 -- IntelligentCV](https://www.intelligentcv.app/career/ats-resume-format-guide/)
- [Resume Headings -- Kickresume](https://www.kickresume.com/en/blog/resume-headings/)

### 1.6 Keyword Matching and Scoring Algorithms

Modern ATS scoring (2025-2026) goes well beyond simple keyword counting:

**TF-IDF Matching:** Many systems use Term Frequency-Inverse Document Frequency, comparing keyword frequency in the CV relative to the general pool.

**Semantic NLP Matching:** Workday, Greenhouse, and iCIMS now use natural language processing to understand that "Python programming," "Python development," and "Python scripting" refer to the same competency. Similarly, "Learning & Development" = "L&D" = "Training and Development" = "Organisational Learning."

**Positional Weighting:**
- Keywords in Professional Summary/Profile are given highest priority
- Keywords in current/most recent role weighted up to 3x more than older roles
- Skills section receives strong weighting
- Keywords buried in older roles or education contribute less

**Contextual Validation:** Algorithms look for skills used in context with a result, not just listed. "Designed leadership development programme resulting in 15% increase in internal promotions" scores higher than just listing "leadership development" in a skills section.

**Job Title Alignment:** Workday in particular heavily weights job title matching. If the posting is for "L&D Manager" and your most recent title is "Learning and Development Manager," that is a strong signal.

**Knockout Filters:** Binary yes/no checks that disqualify before scoring begins:
- Required qualifications (e.g., CIPD Level 7, PhD)
- Minimum years of experience
- Location/right to work
- Specific certifications

**Practical impact:** A recruiter may only review candidates ranked above a certain threshold. With 400 applicants, if your score puts you in the bottom half, your CV is functionally invisible regardless of your actual qualifications.

Sources:
- [ATS Resume Keywords Guide 2026 -- Uppl.ai](https://uppl.ai/ats-resume-keywords/)
- [How ATS Software Works -- 22 Skills](https://www.22skills.com/blog/how-ats-software-works)
- [How ATS Systems Work in 2026](https://www.atscvchecker.pro/blog/how-ats-systems-work-2026/)

### 1.7 UK Universities -- ATS vs Manual Review

UK university recruitment operates differently from corporate hiring:

**Application Method:** Most universities use a structured online application form (not just a CV upload). Candidates typically must:
1. Complete a detailed application form with specific sections
2. Attach a CV as a supplementary document
3. Submit a cover letter / supporting statement
4. Sometimes submit additional documents (teaching philosophy, research statement, publication list)

**How shortlisting works:**
- A shortlisting panel (typically 3+ academics) reviews applications against the person specification
- They score candidates against essential and desirable criteria
- The application form's "Supporting Statement" box is where candidates demonstrate they meet each criterion
- The attached CV provides supplementary evidence
- Panels typically have only a few minutes per application

**ATS usage in universities:**
- Universities use ATS primarily for administrative workflow (receiving, routing, tracking applications) rather than algorithmic scoring/ranking
- Stonefish, Jobtrain, WCN, and Eploy handle the pipeline management
- Unlike corporate ATS, university systems generally do not auto-score or auto-reject based on keywords
- Human panel review remains the primary selection mechanism
- However, HR staff may do an initial screening pass to check essential criteria are met before passing to the academic panel

**Key implication for the CV system:** For academic applications, keyword optimisation matters less than clearly demonstrating how you meet each criterion in the person specification. The CV should complement the application form, not duplicate it.

**Important rule:** Never write "see attached CV" in the application form. Complete every section fully.

Sources:
- [Academic Jobs Application Forms -- jobs.ac.uk](https://career-advice.jobs.ac.uk/jobseeking-and-interview-tips/academic-jobs-how-to-complete-an-application-form/)
- [Oxford University -- Academic Applications](https://www.careers.ox.ac.uk/academic-applications)
- [University of Bath -- Stonefish](https://www.bath.ac.uk/guides/how-you-log-in-to-stonefish-is-changing/)

---

## 2. UK CV Conventions and Best Practices (2025-2026)

### 2.1 UK CV vs US Resume -- Key Differences

| Feature | UK CV | US Resume |
|---------|-------|-----------|
| **Name** | Curriculum Vitae (CV) | Resume |
| **Length** | 2 pages standard (academic: 3-5+) | 1 page standard (2 max for senior) |
| **Paper size** | A4 (21 x 29.7 cm) | US Letter (8.5 x 11 in) |
| **Personal details** | Name, phone, email, general location (city) | Same, but often includes LinkedIn |
| **Photo** | Never (Equality Act) | Never |
| **Personal statement** | Expected -- 3-4 line profile at top | Optional "Professional Summary" |
| **Tone** | Slightly more personal, allows personality | Achievement-focused, quantified |
| **Date format** | DD/MM/YYYY (e.g., 23/08/2025) | MM/DD/YYYY |
| **Spelling** | British English (organisation, programme, optimise, colour) | American English |
| **References** | "Available on request" or named referees | Rarely included |
| **Skills presentation** | Integrated throughout work experience | Often separate skills section |
| **Closing** | Can include "Interests" section | Rarely includes interests |

Sources:
- [UK vs US Resume -- AdaptIT](https://adaptit.pro/career-center/uk-vs-us-resume-differences/)
- [CV vs Resume 2026 -- InterviewCracker](https://interviewcracker.com/blog/what-is-cv-difference-between-cv-resume/)
- [UK CV Format 2026 -- Resume Guru](https://airesume.guru/blog/uk-cv-vs-us-resume)

### 2.2 Expected Length

| Candidate Type | Recommended Length |
|---------------|-------------------|
| Graduate / early career (0-3 years) | 1 page |
| Mid-career professional (3-15 years) | 2 pages |
| Senior professional (15+ years) | 2 pages (strict -- edit ruthlessly) |
| Senior executive / C-suite | 2-3 pages acceptable |
| Academic (lecturer/researcher) | 3-5+ pages (no upper limit for professors with extensive publication lists) |

For the target candidate (18 years experience): The corporate CV should be exactly 2 pages. The academic CV can be 4-5 pages given publications, conference presentations, and teaching experience.

### 2.3 Required/Expected Sections

**Corporate L&D Roles:**
1. Contact Details (name, phone, email, location, LinkedIn)
2. Personal Statement / Profile (3-5 lines, tailored to each role)
3. Core Skills / Key Competencies (6-10 relevant skills)
4. Professional Experience (reverse chronological, most recent first)
5. Education & Qualifications (PhD, MBA, CIPD if applicable)
6. Professional Development / Certifications (optional but valuable)
7. References (either "Available on request" or two named referees)

**Academic Roles (see Section 3 for detail):**
1. Contact Details
2. Qualifications (PhD first, then other degrees)
3. Current Employment & Responsibilities
4. Previous Employment
5. Teaching Experience (courses, levels, student numbers)
6. Research Interests
7. Publications
8. Conference Presentations
9. Grants & Funding
10. Professional Memberships & Service
11. Referees (2-3 named, with full contact details)

### 2.4 What NOT to Include (Equality Act 2010)

The Equality Act 2010 protects nine characteristics. Including information related to these invites unconscious bias and signals ignorance of UK norms:

| Do NOT include | Protected Characteristic | Legal Basis |
|---------------|------------------------|-------------|
| Photograph | Race, age, disability, gender | Equality Act s.4-12 |
| Date of birth / age | Age | s.5 |
| Marital status | Marriage/civil partnership | s.8 |
| Nationality / visa status | Race (unless right-to-work is specifically requested) | s.9 |
| Gender / pronouns (unless you choose to) | Sex, gender reassignment | s.7, s.11 |
| Religion | Religion or belief | s.10 |
| Sexual orientation | Sexual orientation | s.12 |
| Disability / health conditions | Disability | s.6; s.60 restricts pre-offer health questions |
| Number of children / pregnancy status | Pregnancy and maternity | s.4 |

**For the candidate:** As someone with international experience, resist the urge to include nationality or visa status on the CV itself. If right to work is relevant, a brief note in the cover letter is more appropriate ("I have the right to work in the UK").

Sources:
- [Equality Act 2010 -- legislation.gov.uk](https://www.legislation.gov.uk/ukpga/2010/15/contents)
- [ACAS -- Using protected characteristics in recruitment](https://www.acas.org.uk/recruitment/using-protected-characteristics)
- [DavidsonMorris -- Recruitment Discrimination UK 2026](https://www.davidsonmorris.com/recruitment-discrimination/)

### 2.5 Personal Statement / Profile Section

The personal statement is a 3-5 line paragraph at the top of the CV that functions as an elevator pitch. UK conventions:

**Structure:**
1. Who you are (title/level + years of experience + sector)
2. What you do (core competencies + key achievements)
3. What you want (aligned with the target role)

**Corporate L&D example:**
> "Learning and Development Manager with 18 years of experience designing and implementing organisation-wide learning strategies across corporate and higher education sectors. Track record of measurable business impact through leadership development programmes, digital learning transformation, and stakeholder engagement at board level. PhD and MBA qualified with deep expertise in evidence-based learning design and organisational development."

**Rules:**
- Tailor to each application (reference specific requirements from the job description)
- Avoid generic phrases: "dynamic thought-leader," "passionate professional," "results-driven individual"
- Include hard facts: years of experience, qualification level, sector expertise
- Use first person implied (no "I" -- write "Learning and Development Manager with..." not "I am a Learning and Development Manager")

**Academic roles:** The jobs.ac.uk template notes there is no need for a personal statement on an academic CV. Instead, the cover letter / supporting statement serves this purpose. However, a brief 2-3 line research/teaching focus statement can be useful.

### 2.6 Presenting International Experience for UK Employers

For a candidate with Indian university experience applying in the UK:

**Translate qualifications:** UK recruiters may not know the Indian university system. Briefly contextualise:
- Mention NAAC accreditation or university ranking if strong
- Note UK equivalence where relevant (e.g., "equivalent to UK 2:1" for certain degrees)
- Use ENIC-NARIC / UK ENIC for formal equivalence statements if needed

**Emphasise transferable value:**
- Cross-cultural competence and ability to work across different educational systems
- Experience managing diverse teams / student populations
- International perspective on L&D / pedagogy
- Language capabilities

**Frame positively:**
- "Designed and delivered training programmes across culturally diverse organisations in India and the UK"
- Not: "Worked at XYZ University in India" (too passive, does not translate value)

**British Council perspective:** Six out of ten employers give extra credit for international student/work experience (QS World University Rankings survey).

Sources:
- [British Council -- India experience on CV](https://www.britishcouncil.org/voices-magazine/why-experience-india-can-boost-your-cv)
- [Indeed UK -- International student CV](https://uk.indeed.com/career-advice/cvs-cover-letters/international-student-cv)

### 2.7 CIPD Qualifications vs PhD Equivalence in L&D

Understanding how these credentials interact is important for positioning:

| Qualification | UK Academic Level | L&D Industry Recognition |
|--------------|------------------|-------------------------|
| CIPD Level 3 (Foundation) | A-level equivalent | Entry-level HR/L&D |
| CIPD Level 5 (Associate Diploma) | Undergraduate degree equivalent | Practising L&D managers |
| CIPD Level 7 (Advanced Diploma) | Postgraduate / Master's equivalent | Senior/strategic L&D professionals |
| PhD | Doctoral level (above Level 7) | Highly valued in academic-facing L&D, less understood in purely commercial L&D |
| MBA | Postgraduate / Master's equivalent | Strong signal for business acumen, commercial awareness |

**Key insight:** CIPD Level 7 is the gold standard professional qualification for L&D in the UK. A PhD surpasses it academically but is not a direct substitute -- they signal different things. Many L&D job descriptions specifically ask for "CIPD Level 5 or above" or "CIPD Level 7." A PhD demonstrates research capability and deep subject expertise; CIPD demonstrates practical HR/L&D professional competence.

**For the candidate (PhD + MBA, no CIPD):**
- Position the PhD as evidence of research rigour, evidence-based practice, and deep subject-matter expertise in learning/development
- Position the MBA as evidence of commercial awareness, strategic thinking, and business impact orientation
- If job descriptions list CIPD as "essential," acknowledge this gap and either note intention to pursue CIPD membership (which can be gained through experience-based assessment rather than formal study) or emphasise equivalent professional competence through 18 years of practice
- CIPD offers an Experience Assessment route for experienced practitioners -- worth mentioning if relevant

Sources:
- [CIPD Qualification Equivalences -- We Are HR](https://we-are-hr.com/understanding-cipd-qualifications-equivalences-uk/)
- [CIPD Levels Explained -- Reed](https://www.reed.co.uk/career-advice/cipd-levels-explained/)
- [ICS Learn -- Is CIPD Equivalent to a Degree?](https://www.icslearn.co.uk/blog/human-resources/is-cipd-equivalent-to-a-degree/)

### 2.8 UK Cover Letter Conventions

**Corporate roles:**
- Single A4 page, 250-400 words
- 3-4 paragraphs: opening (role + why this company), middle (top 3-4 criteria matched with evidence), closing (enthusiasm + availability)
- Formal but personable tone
- British English spelling throughout
- Address to named person where possible: "Dear Ms Smith" / "Yours sincerely"
- Unknown recipient: "Dear Hiring Manager" / "Yours faithfully"
- Standard fonts: Arial, Calibri, Times New Roman (10-12pt)
- Submit as PDF when emailing; match format to ATS requirements when uploading

**Academic roles:**
- Longer: 1-2 pages acceptable
- Open with research interests and current position
- Reference the specific department and any named academics
- Mention relevant publications or research projects early
- Address how you meet both essential and desirable criteria from the person specification
- Discuss potential contribution to REF, teaching programmes, departmental strategy

Sources:
- [Robert Walters -- UK Cover Letter Guide 2026](https://www.robertwalters.co.uk/insights/career-advice/e-guide/how-to-write-a-cover-letter.html)
- [CVMaker -- Cover Letter Length 2026](https://www.cvmaker.uk/blog/cover-letter/cover-letter-length)

---

## 3. Academic CV Specifics (UK Universities)

### 3.1 Structure Differences from Corporate CV

Academic CVs in the UK follow fundamentally different conventions from corporate CVs:

| Feature | Corporate CV | Academic CV |
|---------|-------------|-------------|
| Length | 2 pages max | 3-5+ pages (depends on career stage) |
| Personal statement | Expected (3-5 lines) | Not expected (use cover letter instead) |
| Focus | Business impact, metrics, ROI | Research output, teaching quality, academic service |
| Skills section | Prominent | Less prominent; demonstrated through experience |
| Publications | Not included | Central section, fully referenced |
| Referees | "Available on request" | Named referees with full contact details (2-3) |
| Order of sections | Profile > Experience > Education | Qualifications > Employment > Teaching > Research > Publications |
| Job titles | Prominent, matched to target | Factual, include department and institution |

### 3.2 Recommended Academic CV Structure (for Lecturer/Senior Lecturer)

Based on jobs.ac.uk templates and Russell Group university guidance:

1. **Personal Details** -- Name, address, phone, email
2. **Qualifications** -- PhD (title, institution, date, supervisors/examiners), MBA, other degrees with classifications
3. **Current Employment** -- Title, institution, department, dates. Brief description of role and responsibilities.
4. **Previous Employment** -- Reverse chronological. Include both academic and industry roles.
5. **Teaching Experience** -- Specific courses taught, level (UG/PG), class sizes, module leadership, curriculum design, assessment responsibilities. Note any innovative pedagogy.
6. **Research Interests** -- 2-3 paragraph summary of research agenda, current projects, future directions
7. **Publications** -- Subdivided into: monographs, edited volumes, peer-reviewed journal articles, book chapters, conference proceedings, working papers. Fully referenced in consistent citation style.
8. **Conference Presentations** -- Date, title, conference name, venue
9. **Grants and Funding** -- Source, amount, project title, dates, role (PI/Co-PI)
10. **Professional Memberships and Service** -- Editorial boards, committee memberships, peer review activity, external examining
11. **Competences and Skills** -- Editorial roles, administrative experience, software/technical skills
12. **Referees** -- 2-3 named referees with titles, institutions, and contact details

### 3.3 Teaching Philosophy Statement

Many UK university applications request a teaching philosophy or teaching statement as a separate document (not embedded in the CV):

**Structure:**
- Your approach to teaching and learning (pedagogical philosophy)
- Evidence of teaching effectiveness (student feedback, peer observation)
- How you design inclusive, accessible learning
- Use of technology in teaching
- How you link research to teaching
- Commitment to continuous development of teaching practice

**Length:** Typically 1-2 pages

**For the candidate:** 18 years of L&D experience is a strong foundation. Translate corporate training expertise into academic pedagogy language: "facilitating learning" becomes "student-centred pedagogy," "training needs analysis" becomes "constructive alignment," "measuring training effectiveness" becomes "assessment for learning."

### 3.4 Research Interests

For someone transitioning from industry to academia:
- Frame L&D practice experience as applied research
- Connect to established academic fields: organisational learning, HRD, workplace learning, adult education, professional development
- Reference relevant theoretical frameworks (Kirkpatrick, ADDIE, 70:20:10, communities of practice, etc.)
- Identify 2-3 clear research questions that emerge from practice experience
- Mention any publications, conference presentations, or doctoral research

### 3.5 Publications and Conference Presentations

**Publications should be:**
- Fully referenced in a consistent citation style (Harvard or APA common in UK education/management)
- Listed in reverse chronological order within each category
- Include all authors, title, journal/publisher, volume, pages, year
- Mark peer-reviewed items clearly
- Include DOI links where available

**For someone with limited academic publications:**
- Include PhD thesis
- Include any practitioner publications (CIPD research reports, industry white papers, blog posts for professional bodies)
- Include conference presentations and invited talks
- Include any book reviews or commentary pieces
- Frame industry reports as evidence of research capability

### 3.6 REF (Research Excellence Framework)

REF is the UK system for assessing research quality, conducted approximately every 7 years (REF 2021 was most recent; REF 2028/29 expected next).

**Relevance for CVs:**
- Departments hiring lecturers look for candidates who can contribute to their REF submission
- They need academics who produce "REF-returnable" research outputs (typically peer-reviewed journal articles or monographs rated 3* or 4*)
- Impact case studies are valuable -- showing how research has had real-world effect beyond academia
- For an industry-experienced candidate, the ability to produce impact case studies linking research to organisational outcomes is a genuine asset

**How to present on CV:**
- Mention REF-relevant publications
- Describe any research impact beyond academia
- If you have no REF track record, emphasise research potential and the quality of your doctoral work

### 3.7 TEF (Teaching Excellence Framework)

TEF rates universities (not individuals) as Gold, Silver, or Bronze for teaching quality. Its relevance for individual CVs is indirect:

- Shows awareness of the UK HE landscape
- Demonstrates commitment to teaching excellence
- Can reference in cover letter: "I am committed to contributing to [University]'s Gold TEF rating through..."
- Link your teaching philosophy to TEF metrics: student satisfaction, continuation rates, graduate outcomes

### 3.8 HEA Fellowship / Advance HE

Advance HE (formerly Higher Education Academy) Fellowship is increasingly important for academic roles:

**Four categories:**

| Category | Typical Holder | Requirements |
|----------|---------------|-------------|
| Associate Fellow (AFHEA) | New to teaching, early-career researchers with some teaching | Evidence of teaching effectiveness alongside mentors |
| Fellow (FHEA) | Established teaching academics | Substantive teaching effectiveness and breadth; often through PGCHE/PGCAP completion |
| Senior Fellow (SFHEA) | Senior lecturers, curriculum leaders | Proven management of teaching, curriculum development, mentoring |
| Principal Fellow (PFHEA) | Professors, PVCs | Strategic institutional impact on teaching and learning |

**Two routes to Fellowship:**
1. Complete an Advance HE-accredited programme (PGCHE/PGCAP -- Master's level qualification)
2. Submit an evidence-based portfolio through direct application

**How it appears in job descriptions:**
- "Essential: Fellow of Advance HE (or willingness to achieve within probation)"
- "Desirable: Senior Fellow of Advance HE"
- Some institutions list it as essential; many accept "willingness to gain"

**For the candidate:** With 18 years of teaching/training experience, the portfolio route to Fellowship (or even Senior Fellowship) is realistic. This should be positioned as a planned action in applications: "Intending to apply for Fellowship of Advance HE through the experiential route, drawing on 18 years of learning design and delivery experience."

Sources:
- [Advance HE Fellowship](https://www.advance-he.ac.uk/fellowship)
- [jobs.ac.uk -- Advance HE Fellowship](https://career-advice.jobs.ac.uk/career-development/academic-careers/advance-he-fellowship/)
- [jobs.ac.uk -- Lecturer CV Template](https://career-advice.jobs.ac.uk/cv-and-cover-letter-advice/lecturer-cv-template/)
- [Birmingham University -- Academic CVs](https://intranet.birmingham.ac.uk/student/careers/postgraduate/pgr/academic-cvs.aspx)
- [Bangor University -- Senior Lecturer Guidance](https://www.bangor.ac.uk/humanresources/policies/careerdev/SL_AppFormGuidance_EN.pdf)

### 3.9 Presenting Industry Experience for Academic Roles

This is a critical bridging challenge. Universities increasingly value "industry-engaged" academics, but the framing matters:

**Translate corporate language to academic language:**

| Corporate Term | Academic Equivalent |
|---------------|-------------------|
| Training needs analysis | Learning needs assessment / constructive alignment |
| ROI of training | Impact evaluation / Kirkpatrick Level 4 |
| Stakeholder management | Cross-departmental collaboration / academic governance |
| Change management | Organisational development / institutional change |
| E-learning development | Technology-enhanced learning (TEL) / blended learning design |
| Performance management | Student/learner outcomes / assessment strategy |
| Budget management | Research grant management / resource allocation |
| Team leadership | Academic leadership / mentoring early-career colleagues |
| Client relationship management | External partnerships / knowledge exchange |

**Position industry experience as strengths:**
- "Brings real-world, practitioner perspective to research and teaching"
- "Can design programmes with strong employability outcomes"
- "Experience of evidence-based practice bridges research-practice gap"
- "Industry networks support knowledge exchange and impact generation"

---

## 4. Corporate L&D CV Specifics

### 4.1 Key Metrics and Achievements to Highlight

For L&D Manager to Head of L&D roles (GBP 70-80k), quantified achievements are essential. The CV system should prompt for and format these types of metrics:

**Training effectiveness:**
- "Designed leadership development programme resulting in X% increase in internal promotions"
- "Reduced time-to-competency for new hires by X% through redesigned onboarding"
- "Improved knowledge retention by X% through scenario-based e-learning"
- "Achieved X% completion rate across mandatory compliance training (up from Y%)"

**Business impact:**
- "Training programmes contributed to X% revenue increase / cost reduction"
- "Reduced employee turnover by X% through targeted development interventions"
- "Improved employee engagement scores by X points through learning culture initiatives"
- "Supported organisational restructuring affecting X employees with tailored development"

**Scale and scope:**
- "Managed L&D budget of GBP X"
- "Led team of X L&D professionals across Y locations"
- "Delivered training to X employees across Y countries/sites"
- "Designed X training modules / programmes per year"

**Efficiency:**
- "Reduced training costs by X% through digital transformation"
- "Decreased seat-time by X% using adaptive learning technologies"
- "Consolidated X training vendors to Y, saving GBP X annually"

### 4.2 Business Impact Language

UK corporate L&D roles at the 70-80k level expect strategic, business-aligned language:

**Power verbs:** Designed, implemented, led, transformed, delivered, evaluated, aligned, partnered, drove, established, streamlined, scaled

**Strategic framing:**
- "Aligned L&D strategy with organisational objectives and business transformation goals"
- "Partnered with C-suite / senior leadership to identify capability gaps"
- "Developed talent pipeline supporting succession planning"
- "Created learning culture contributing to employer brand and retention"

**Avoid:**
- Passive language ("was responsible for," "assisted with")
- Task-focused descriptions without outcomes ("delivered training sessions")
- Generic claims without evidence ("excellent communicator")

### 4.3 Stakeholder Management Emphasis

At Manager-to-Head level, demonstrating stakeholder management is essential:

- Board / executive committee reporting and influencing
- Working with HR Business Partners to identify development needs
- Managing external provider relationships (consultancies, platforms, trainers)
- Cross-functional collaboration with operational managers
- Union consultation where relevant
- Budget holder accountability

### 4.4 ROI of Training Programmes

Employers want to see that you can demonstrate value:

**Kirkpatrick Model levels (well-known in both corporate and academic contexts):**
- Level 1: Reaction (satisfaction scores)
- Level 2: Learning (knowledge/skill gains)
- Level 3: Behaviour (on-the-job application)
- Level 4: Results (business impact)

**Phillips ROI Methodology:** Level 5 -- financial return on investment calculation

**CV presentation:** Frame achievements at Levels 3 and 4 where possible. "Delivered leadership programme" is Level 1. "Leadership programme resulted in 20% improvement in 360-degree feedback scores and 15% increase in internal promotion rate" is Level 3/4.

### 4.5 Digital Transformation / E-Learning Credentials

In 2025-2026, digital capability is non-negotiable for senior L&D roles:

**Key areas to demonstrate:**
- LMS administration and selection (Cornerstone, Docebo, Moodle, Totara, SAP Litmos)
- E-learning authoring tools (Articulate Storyline/Rise, Adobe Captivate, Elucidat)
- Virtual delivery platforms (MS Teams, Zoom, Webex) and virtual classroom facilitation
- Learning analytics and data-driven decision making
- AI in L&D (adaptive learning, chatbots, content curation, skills intelligence)
- Microlearning and mobile learning strategies
- Video-based learning and content creation
- Social/collaborative learning platforms

**Trend awareness for 2025-2026:**
- Skills-based organisations and skills taxonomies
- AI-powered personalised learning pathways
- Immersive learning (VR/AR simulations)
- Learning in the flow of work
- Performance support vs formal training

### 4.6 Professional Credentials Presentation

**CIPD (Chartered Institute of Personnel and Development):**
- Gold standard for UK L&D/HR professionals
- Present as: "CIPD Level 7 Advanced Diploma in Strategic Learning and Development" or "Chartered Member, CIPD (MCIPD)" or "Chartered Fellow, CIPD (Chartered FCIPD)"
- If not held, note intention to pursue: "CIPD Associate Membership (pursuing Chartered status through Experience Assessment)"

**ATD (Association for Talent Development):**
- US-based but globally recognised
- APTD (Associate Professional in Talent Development) -- 3+ years experience
- CPTD (Certified Professional in Talent Development) -- senior level
- Recognised in 60+ countries
- Less weight than CIPD in UK market but adds international credibility

**Other relevant credentials:**
- ILM (Institute of Leadership and Management) qualifications
- CMI (Chartered Management Institute) qualifications
- Coaching qualifications (ICF, EMCC)
- Prince2 / Agile project management
- Psychometric tool certifications (MBTI, Insights Discovery, Hogan, etc.)

Sources:
- [StandOut CV -- L&D Manager CV Example](https://standout-cv.com/cv-examples/human-resources/learning-and-development-manager-cv)
- [Resume Worded -- L&D Manager Resume](https://resumeworded.com/learning-and-development-manager-resume-example)
- [CIPD -- L&D Resources](https://www.cipd.org/uk/topics/learning-development/)
- [CIPD -- L&D Roles](https://www.cipd.org/uk/the-people-profession/careers/roles/learning-development/)
- [ATD -- Global Certification](https://www.td.org/global/certification)
- [Bradfield -- Career Development as L&D Manager with CIPD](https://bradfield.co.uk/navigating-career-development-as-a-learning-and-development-manager-with-cipd/)

---

## 5. System Design Implications

Based on this research, the AI CV tailoring system should:

### 5.1 Output Formats
- Generate DOCX as primary format for ATS portal submissions
- Generate PDF as secondary format for email/direct submissions
- Use single-column layout, no tables, no text boxes, no images
- Place all content in document body (never headers/footers)
- Use standard fonts (Calibri or Arial, 10-12pt)
- A4 page size with 2.5cm margins

### 5.2 Two CV Templates
- **Corporate template:** 2-page maximum, personal statement, core skills, experience with metrics, education, certifications
- **Academic template:** 3-5 pages, qualifications-first, teaching experience, research interests, publications, conference papers, referees

### 5.3 Keyword Optimisation Engine
- Extract keywords from job descriptions
- Map synonyms using skills taxonomy (e.g., "L&D" = "Learning and Development" = "Training")
- Place highest-priority keywords in personal statement and most recent role
- Include both spelled-out and abbreviated forms
- Validate contextual usage (skill + result, not just listed)

### 5.4 Section Heading Standards
- Use only ATS-recognised section headings
- UK spelling throughout (organisation, programme, behaviour, colour)
- DD/MM/YYYY date format

### 5.5 Dual-Mode Content
- For the same experience, generate corporate-framed and academic-framed versions
- Corporate: metrics, business impact, stakeholder language
- Academic: pedagogy, research, student outcomes, institutional service

### 5.6 Credential Positioning
- PhD: lead with for academic roles, include in education for corporate
- MBA: emphasise for corporate roles (business acumen), mention for academic
- CIPD gap: address proactively where job descriptions list it as essential
- Advance HE Fellowship: note intent to pursue for academic roles

### 5.7 Cover Letter Generation
- Corporate: single A4 page, 250-400 words, 3-4 paragraphs
- Academic: 1-2 pages, reference department/research group specifically, mention publications
- Always match criteria from person specification point by point

### 5.8 Application Form Support
- For university roles, generate content for "Supporting Statement" box
- Map candidate experience to each criterion in the person specification
- Generate complementary (not duplicating) content between form and CV
