# Module 6: Interview Scheduling & Preparation System -- Deep Research

**Date:** 2026-03-29
**Module:** 06 -- Interview Scheduling & Preparation
**System:** Selvi Job App (n8n-based)
**Target roles:** UK Corporate L&D (Manager to Head level) and University Lecturer/Senior Lecturer

---

## Table of Contents

1. [Interview Scheduling Automation](#1-interview-scheduling-automation)
2. [Interview Preparation Automation](#2-interview-preparation-automation)
3. [Calendar Management](#3-calendar-management)
4. [UK Interview Types by Sector](#4-uk-interview-types-by-sector)
5. [Post-Interview Workflow](#5-post-interview-workflow)
6. [Preparation Materials Generation](#6-preparation-materials-generation)
7. [n8n Implementation Architecture](#7-n8n-implementation-architecture)
8. [Salary & Market Data](#8-salary--market-data)

---

## 1. Interview Scheduling Automation

### 1.1 Parsing Interview Invite Emails

Interview invitations arrive in several formats. The system must handle each:

**Format 1: Direct email from recruiter/HR**
- Subject lines follow patterns: "Interview invitation", "Interview for [Role]", "Invitation to interview", "Next steps -- [Role]"
- Body contains: date, time, location/link, interviewer names, format (phone/video/in-person)
- Often includes .ics calendar attachment

**Format 2: Calendar invite (ICS)**
- Google Calendar or Outlook sends a calendar invitation directly
- Contains structured iCalendar data: DTSTART, DTEND, LOCATION, DESCRIPTION, ORGANIZER
- The Gmail Trigger node receives these; the Code node can parse the .ics attachment

**Format 3: Recruiter portal notification**
- Email contains a link to a portal where details are hosted
- Requires HTTP Request + HTML Extract to scrape the actual details

**Format 4: Microsoft Teams / Zoom auto-generated**
- Contains meeting links with recognisable URL patterns:
  - Teams: `teams.microsoft.com/l/meetup-join/...`
  - Zoom: `zoom.us/j/...` or `zoom.us/my/...`
  - Google Meet: `meet.google.com/...`

**n8n Email Parsing Approach:**

```
Gmail Trigger (poll every 5 min, filter: subject contains "interview")
  -> Code Node (extract date/time/location/format/interviewers using regex + NLP)
  -> AI Agent (Claude Haiku -- structured extraction for ambiguous emails)
  -> If Node (new interview? / reschedule? / cancellation?)
  -> Google Calendar (create/update/delete event)
  -> Gmail (send confirmation reply)
```

**Key extraction patterns (regex):**
- Date: `\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b`
- Time: `\b(\d{1,2}[:.]\d{2}\s*(?:am|pm|AM|PM)?)\b`
- UK time references: "GMT", "BST", "UK time", "London time"
- Video links: `https?://(?:teams\.microsoft\.com|zoom\.us|meet\.google\.com)/\S+`
- Location: typically follows "at", "Location:", "Venue:", "Address:"

**AI-assisted extraction (for unstructured emails):**
Use an AI Agent node with Claude Haiku to extract structured data from ambiguous interview emails. Prompt template:

```
Extract from this email:
- interview_date (ISO 8601)
- interview_time (24h format)
- timezone (default Europe/London)
- format (phone | video_teams | video_zoom | video_meet | in_person)
- location (physical address or video link)
- interviewer_names (array)
- role_title
- company_name
- duration_minutes (if stated)
- additional_instructions
```

### 1.2 Google Calendar Integration via n8n

**Available n8n nodes (confirmed via MCP):**

| Node | Purpose |
|------|---------|
| `n8n-nodes-base.googleCalendarTrigger` | Triggers workflow when calendar events change |
| `n8n-nodes-base.googleCalendar` (event/create) | Create calendar events with full parameters |
| `n8n-nodes-base.googleCalendar` (event/getAll) | List events in a time range for conflict detection |
| `n8n-nodes-base.googleCalendar` (event/update) | Update existing events |
| `n8n-nodes-base.googleCalendar` (event/delete) | Remove cancelled interviews |
| `n8n-nodes-base.googleCalendar` (calendar/availability) | Check if a time slot is available |
| `n8n-nodes-base.googleCalendarTool` | Tool version for AI Agent use |

**Event creation parameters (confirmed from type definitions):**
- `calendar`: resource list selector (primary or named calendar)
- `start`: ISO date string or Luxon expression (e.g., `{{ $now }}`)
- `end`: ISO date string or Luxon expression
- `useDefaultReminders`: boolean (default true)
- `additionalFields`:
  - `summary`: event title (e.g., "Interview: L&D Manager @ Barclays")
  - `description`: full interview details, prep notes link
  - `location`: physical address or video link
  - `attendees`: comma-separated emails
  - `color`: colour coding by interview type (e.g., green=phone, blue=video, red=in-person)
  - `conferenceDataUi`: auto-create Google Meet link
  - `visibility`: private (interviews should not be visible to others)
  - `showMeAs`: "opaque" (block calendar)
  - `sendUpdates`: "none" (don't notify attendees from personal calendar)
  - `repeatFrecuency`, `repeatHowManyTimes`: for multi-round scheduling

**Availability checking parameters:**
- `calendar`: which calendar to check
- `timeMin` / `timeMax`: the proposed time slot
- `options.outputFormat`: "availability" returns `{ available: boolean }`
- `options.timezone`: override timezone (use Europe/London)

**Retrieving events for conflict detection:**
- `timeMin` / `timeMax`: range to check
- `options.singleEvents`: true (expand recurring events)
- `options.orderBy`: "startTime"
- `options.timeZone`: set to Europe/London

**Credentials required:** Google Calendar OAuth2 API (same credentials as Gmail if using Google Workspace)

### 1.3 Timezone Handling (UK = GMT/BST)

The UK uses:
- **GMT (UTC+0):** last Sunday of October through last Sunday of March
- **BST (UTC+1):** last Sunday of March through last Sunday of October

**Implementation approach:**
- Store all times internally as ISO 8601 with timezone offset or UTC
- Use `Europe/London` as the IANA timezone identifier -- this automatically handles GMT/BST transitions
- n8n's Date & Time node (`n8n-nodes-base.dateTime`) supports timezone conversion with operations: `formatDate`, `addToDate`, `subtractFromDate`, `getTimeBetweenDates`
- When parsing emails, assume `Europe/London` unless explicitly stated otherwise
- When creating Google Calendar events, the API handles timezone correctly if you pass `Europe/London`
- Watch for: interview invites from international companies that specify times in their local timezone (e.g., "3pm EST" for a US-headquartered company with UK office)

**Edge cases:**
- Interviews scheduled across the BST/GMT transition (rare but possible for far-future dates)
- Recruiters who write "10am GMT" when they mean "10am UK time" (which could be BST) -- default to `Europe/London` interpretation
- Calendar events from Teams/Outlook may use Windows timezone IDs ("GMT Standard Time") rather than IANA -- n8n handles this through the Google Calendar API

### 1.4 Interview Format Detection & Handling

| Format | Detection Signal | Calendar Treatment |
|--------|-----------------|-------------------|
| Phone | "phone interview", "telephone", "call you on", phone number | Add phone number to description, no travel time needed |
| Video (Teams) | `teams.microsoft.com` URL, "Microsoft Teams" | Add Teams link to location field and description |
| Video (Zoom) | `zoom.us` URL, "Zoom meeting" | Add Zoom link to location and description |
| Video (Google Meet) | `meet.google.com` URL, "Google Meet" | Add Meet link to location |
| In-person | Physical address, postcode, "our offices at" | Add address to location, calculate travel time, add travel event |
| Hybrid | "attend in person or join online" | Create as in-person (safer), note online backup option |

### 1.5 Conflict Detection

**Workflow:**
1. When interview time is extracted, query Google Calendar `getAll` for overlapping events
2. Check `timeMin` = proposed start - 30 min buffer, `timeMax` = proposed end + 30 min buffer
3. If conflicts found:
   - If conflict is another interview: flag as urgent conflict, send notification
   - If conflict is a "prep" or "travel" event: can be rescheduled
   - If conflict is a regular calendar event: flag for manual review
4. Use the `availability` operation for a quick boolean check before detailed analysis

### 1.6 Auto-Reply to Confirm Attendance

**Approach: Draft-first with manual send (recommended for interviews)**

Interviews are high-stakes. Auto-sending without review is risky. Recommended approach:
1. System drafts a confirmation reply
2. Sends notification to candidate (via email/Slack/Telegram) with the draft for review
3. Candidate approves, system sends via Gmail `reply` operation

**Draft reply template:**
```
Dear [Name],

Thank you for the invitation to interview for the [Role] position.

I am pleased to confirm my attendance on [Date] at [Time].

[If in-person: I note the location as [Address]. / If video: I have noted the [Platform] link.]

[If presentation required: I understand I will need to prepare a [duration] presentation on [topic]. I will ensure this is ready.]

Please let me know if you need anything further in advance.

Kind regards,
Selvi
```

**Gmail reply node parameters:**
- `messageId`: the original email message ID
- `message`: HTML formatted reply body
- `emailType`: "html"
- `options.appendAttribution`: false (remove n8n attribution)
- `options.replyToSenderOnly`: false (reply to all on the thread)

### 1.7 Rescheduling Workflows

**Inbound reschedule (employer changes time):**
1. Gmail Trigger detects emails with reschedule keywords: "reschedule", "new time", "change of date", "postpone", "moved to"
2. AI Agent extracts new date/time from email
3. System updates existing Google Calendar event
4. Logs the change in the interview tracking database
5. Recalculates travel time / prep blocks if needed

**Outbound reschedule (candidate requests change):**
1. Candidate marks interview in system as "need to reschedule"
2. System drafts a polite reschedule request email with proposed alternative times (based on calendar availability)
3. Candidate reviews and sends

**Cancellation detection:**
- Keywords: "withdrawn", "cancelled", "position filled", "no longer", "regret"
- Action: mark interview as cancelled, remove calendar events (interview + prep + travel), log reason

---

## 2. Interview Preparation Automation

### 2.1 Company Research Automation

When an interview is confirmed, the system should automatically generate a company research brief. Data sources and scraping approach:

**Source 1: Company website**
- Use HTTP Request node to fetch company "About" page, leadership team, and recent news
- Alternatively, use Firecrawl (via HTTP Request to Firecrawl API) for structured scraping
- Extract: mission statement, values, size, sector, recent initiatives, key leadership

**Source 2: LinkedIn company page**
- Cannot scrape directly (ToS restrictions)
- Alternative: use the candidate's manually gathered notes, or use SerpAPI to search `site:linkedin.com/company/[name]`
- Extract: employee count, growth rate, recent posts about L&D initiatives

**Source 3: Glassdoor**
- Cannot reliably scrape (heavy anti-bot protection)
- Alternative: use SerpAPI to search `site:glassdoor.co.uk [company] interview`
- Extract: interview difficulty rating, interview process descriptions, common questions reported

**Source 4: Companies House (UK-specific)**
- Free API: `https://api.company-information.service.gov.uk/`
- Extract: company registration date, registered address, SIC codes, officers, filing history
- Useful for understanding company size and financial health

**Source 5: Charity Commission (for charity sector roles)**
- Free API for registered charities
- Extract: income, expenditure, objectives, trustees

**Source 6: Google News**
- SerpAPI `news` search type for recent press coverage
- Extract: recent announcements, restructuring, leadership changes

**n8n workflow for company research:**
```
Interview Confirmed Trigger
  -> Parallel branches:
     Branch 1: HTTP Request -> Company website -> HTML Extract -> AI summarise
     Branch 2: HTTP Request -> Companies House API -> Extract key data
     Branch 3: HTTP Request -> SerpAPI (Google News) -> Extract recent coverage
     Branch 4: HTTP Request -> SerpAPI (Glassdoor interview reviews) -> Extract process info
  -> Merge node (combine all research)
  -> AI Agent (Claude Sonnet) -> Generate structured company brief
  -> Save to database / Notion / Google Doc
  -> Add link to Google Calendar event description
```

### 2.2 Role-Specific Preparation Notes

The AI Agent should generate preparation notes tailored to the specific role, using the job description as primary input. Key elements:

**For L&D Manager/Head roles:**
- Map candidate's experience to each requirement in the job description
- Identify the company's L&D maturity level (centralised vs distributed, digital vs classroom)
- Research the company's industry and typical L&D challenges in that sector
- Identify likely frameworks they use (70:20:10, ADDIE, SAM, Kirkpatrick)
- Research their LMS/platform if publicly known
- Note any regulatory training requirements in their sector

**For University Lecturer roles:**
- Map candidate's research to the department's research themes
- Identify REF submission history and likely REF strategy
- Check the university's TEF rating and teaching priorities
- Research the specific module areas they're recruiting for
- Identify the Head of Department and their research interests
- Check for recent curriculum changes or new programme launches
- Note Athena SWAN status and EDI priorities

### 2.3 Common Interview Questions: UK Corporate L&D Roles

**Strategic L&D questions:**
1. How would you assess the learning needs of this organisation?
2. Describe your approach to measuring the ROI of learning programmes.
3. How do you align L&D strategy with business objectives?
4. What is your experience with digital learning transformation?
5. How would you manage a limited L&D budget to achieve maximum impact?
6. Describe a time you influenced senior stakeholders to invest in L&D.
7. How do you stay current with L&D trends and methodologies?
8. What learning technologies have you implemented, and what were the results?
9. How do you approach leadership development at different levels?
10. Describe your experience with succession planning and talent development.

**Competency-based questions (STAR method expected):**
1. Tell me about a time you managed a complex stakeholder relationship.
2. Describe a situation where you had to deliver a programme under significant time pressure.
3. Give an example of how you handled resistance to a learning initiative.
4. Tell me about a time you used data to improve a learning programme.
5. Describe a situation where you had to manage a team through change.
6. Give an example of a learning programme that failed and what you learned.
7. Tell me about how you've promoted diversity and inclusion through L&D.
8. Describe a time you had to prioritise competing demands from different business units.

**Technical/practical questions:**
1. Walk us through how you would design a blended learning programme for [topic].
2. What LMS platforms have you worked with, and what are the pros and cons?
3. How do you approach evaluation beyond Kirkpatrick Level 1?
4. What is your experience with coaching and mentoring frameworks?
5. How would you design an onboarding programme for this organisation?
6. What role does AI play in your vision for L&D?
7. How do you ensure learning transfer back to the workplace?
8. Describe your approach to competency framework development.

**UK-specific topics often raised:**
- Apprenticeship Levy and how to maximise it
- CIPD qualifications and CPD framework
- EDI (Equality, Diversity, and Inclusion) in learning design
- Wellbeing and mental health training requirements
- GDPR considerations in learner data
- Public sector: Civil Service Learning framework, competency frameworks
- NHS: NHS Leadership Academy, statutory/mandatory training requirements

### 2.4 Common Interview Questions: UK University Lecturer Roles

**Teaching-focused questions:**
1. What is your teaching philosophy?
2. How do you design a module from scratch?
3. How do you use technology to enhance learning?
4. How do you support students from diverse backgrounds?
5. How do you assess student learning beyond traditional exams?
6. What experience do you have with online/blended delivery?
7. How do you handle a disengaged student?
8. What is your approach to feedback and assessment turnaround?
9. How would you contribute to programme development?
10. What experience do you have with professional accreditation bodies?

**Research-focused questions:**
1. Describe your current research agenda and how it fits with this department.
2. What is your publication strategy for the next 3-5 years?
3. How does your research inform your teaching?
4. What external funding have you secured or applied for?
5. How would you supervise doctoral students?
6. What impact has your research had outside academia?
7. How do you collaborate with other researchers?

**Institutional questions:**
1. What do you know about our university's strategic priorities?
2. How would you contribute to the department's REF submission?
3. What is your experience with quality assurance processes?
4. How would you contribute to student recruitment?
5. What administrative responsibilities have you held?
6. How do you engage with the wider academic community?
7. What is your experience with widening participation?

**UK-specific academic topics:**
- TEF (Teaching Excellence Framework) and what it means for practice
- REF (Research Excellence Framework) and impact case studies
- UKPSF / Advance HE Fellowship (FHEA, SFHEA) -- often required or expected
- NSS (National Student Survey) and how to improve scores
- OFS (Office for Students) regulatory requirements
- Access and participation plans
- Prevent duty obligations
- Academic workload models (Transparency Approach)

### 2.5 UK Competency-Based Interviews and STAR Method

The STAR method (Situation, Task, Action, Result) is the standard expected format for UK competency-based interviews. Nearly all corporate and many university interviews in the UK use this format.

**Common UK competency frameworks used by employers:**

| Sector | Framework | Key Competencies |
|--------|-----------|-----------------|
| Civil Service | Success Profiles | Strengths, Behaviours, Experience, Technical, Ability |
| NHS | NHS Leadership Framework | Leading with care, Sharing the vision, Evaluating information |
| Corporate (generic) | SHL/CEB frameworks | Leading and deciding, Supporting and cooperating, Interacting and presenting |
| Higher Education | UKPSF | Professional values, Core knowledge, Areas of activity |

**STAR preparation approach for the system:**
1. Parse job description for required competencies
2. Map each competency to candidate's experience (from CV/profile data)
3. Generate STAR-format example answers drawing on specific experience
4. Flag gaps where candidate may lack strong examples

### 2.6 Preparing Talking Points Mapped to Job Description

**Automated approach:**
1. Parse job description into structured requirements (essential/desirable)
2. For each requirement, search candidate's CV/profile for matching experience
3. Generate talking points that bridge each requirement to specific experience
4. Highlight unique selling points (PhD + MBA, 18 years experience, UK + international perspective)
5. Identify potential weaknesses to prepare for (e.g., only 3 years in UK, consulting vs permanent roles)

**n8n implementation:**
```
Job Description (from Module 1 database)
  -> AI Agent (Claude Sonnet): Parse into structured requirements
  -> Merge with candidate profile data
  -> AI Agent (Claude Sonnet): Generate talking points per requirement
  -> Format into preparation document
  -> Save to Notion/Google Docs
```

---

## 3. Calendar Management

### 3.1 Google Calendar API Operations in n8n

**Full confirmed operation set:**

| Operation | Node Config | Use Case |
|-----------|-------------|----------|
| Create event | resource: event, operation: create | Add interview to calendar |
| Get all events | resource: event, operation: getAll | List events for conflict check |
| Get event | resource: event, operation: get | Retrieve specific interview details |
| Update event | resource: event, operation: update | Reschedule interview |
| Delete event | resource: event, operation: delete | Cancel interview |
| Check availability | resource: calendar, operation: availability | Quick slot check |

**Recommended calendar structure:**
- Primary calendar: all personal events
- Dedicated "Job Search" calendar: all interview-related events (interviews, prep, travel, debrief)
- Colour coding:
  - Red (#DC2127): in-person interview
  - Blue (#5484ED): video interview
  - Green (#0B8043): phone interview
  - Yellow (#E6C800): preparation block
  - Purple (#7986CB): travel time
  - Grey (#616161): debrief/follow-up

### 3.2 Travel Time Calculation for In-Person Interviews

n8n does not have a native Google Maps node. Travel time must be calculated via HTTP Request to an external API.

**Option 1: Google Maps Directions API**
```
HTTP Request:
  URL: https://maps.googleapis.com/maps/api/directions/json
  Params:
    origin: "Maidenhead, Berkshire, UK"
    destination: [interview address]
    mode: transit  (or driving)
    departure_time: [unix timestamp for desired arrival minus buffer]
    key: [Google Maps API key]
```
Response includes: `routes[0].legs[0].duration.value` (seconds) and `routes[0].legs[0].duration.text` (human readable).

**Option 2: TfL Journey Planner API (for London-based interviews)**
```
HTTP Request:
  URL: https://api.tfl.gov.uk/Journey/JourneyResults/{from}/to/{to}
  Params:
    timeIs: Arriving
    date: [YYYYMMDD]
    time: [HHMM]
```
Free, no API key required for basic use. Best for London-specific transit routes.

**Option 3: Trainline/National Rail API**
- For train journeys from Maidenhead to interview locations
- Maidenhead is on the Elizabeth Line (Crossrail) -- direct to London Paddington, Liverpool Street, and beyond
- Also on GWR mainline to Reading, Oxford, Bristol

**Travel time buffer calculation:**
- Base travel time from API
- Add 30 minutes buffer for delays/wayfinding
- For first visit to a location, add 15 minutes for finding the building
- For train journeys, account for specific train times (not just average duration)

### 3.3 Buffer Time Between Interviews

**Rules to implement:**
- Minimum 30 minutes between back-to-back video interviews
- Minimum 60 minutes between in-person interviews (or travel time + 30 min, whichever is greater)
- Minimum 15 minutes between phone interviews
- If two interviews are on the same day, ensure lunch break is preserved (12:00-13:00)

**Conflict detection with buffers:**
When checking availability, extend the interview window by the appropriate buffer before and after, then check for overlaps.

### 3.4 Preparation Time Blocks

**Auto-create prep event before each interview:**
- For video/phone interviews: 1 hour prep block, ending 15 minutes before interview
- For in-person interviews: 1 hour prep block, ending before travel time starts
- For presentation-based interviews: 2 hour prep block
- For assessment centres: evening before (2 hours) plus morning block

**Prep event content:**
The calendar event description should include:
- Link to generated preparation brief
- Key talking points summary
- Interviewer names and LinkedIn profiles (if found)
- Company research summary link
- List of questions to ask
- Any materials to bring/prepare

**n8n implementation:**
After creating the interview event, immediately create the prep event:
```
Google Calendar (create interview event)
  -> Date & Time (subtract prep duration from interview start)
  -> Google Calendar (create prep event with title "PREP: Interview @ [Company]")
```

### 3.5 Interview Debrief Reminders

**Auto-create debrief event after each interview:**
- Schedule 30-minute debrief block starting 30 minutes after interview end time
- Title: "DEBRIEF: [Company] [Role] Interview"
- Description includes prompts:
  - How did it go overall? (1-10)
  - What questions were asked?
  - What went well?
  - What could have gone better?
  - What is the next step?
  - When did they say they'd respond?
  - Any red flags about the role/company?
  - Would you accept an offer? At what salary?

**Additional reminders to schedule:**
- If they said "we'll be in touch within [X] days" -- schedule a follow-up check event
- If a thank you email should be sent -- schedule reminder for same evening or next morning

---

## 4. UK Interview Types by Sector

### 4.1 Corporate L&D Interview Formats

**Competency-based interview (most common)**
- Duration: 45-60 minutes
- Format: panel of 2-3 (hiring manager, HR, sometimes a peer)
- Structure: 6-8 competency questions using STAR method
- Typical competencies assessed: stakeholder management, strategic thinking, influencing, delivery, innovation, inclusivity

**Presentation interview**
- Very common for L&D roles (expected to demonstrate facilitation skills)
- Duration: 15-30 minute presentation + 15-30 minute Q&A
- Common topics:
  - "Design a leadership development programme for our organisation"
  - "How would you measure the impact of our L&D function?"
  - "Present your 100-day plan as our L&D Manager"
  - "Deliver a 15-minute sample training session on a topic of your choice"
- Often combined with competency interview in same session

**Case study / scenario exercise**
- Given a business scenario (e.g., "Division X has high turnover, how would you address through L&D?")
- May be given in advance (24-48 hours) or on the day (30-60 minutes prep)
- Assessed on: analytical thinking, L&D knowledge, business acumen

**Panel interview**
- Standard for senior L&D roles (Head of L&D, Director)
- Panel typically includes: HR Director, business unit leaders, sometimes a board member
- Duration: 60-90 minutes
- Mix of competency questions and strategic discussion

**Multi-round process (typical for Head of L&D):**
1. Round 1: Phone/video screening with recruiter (20-30 min)
2. Round 2: Video interview with hiring manager (45-60 min)
3. Round 3: In-person panel + presentation (2-3 hours)
4. Round 4 (sometimes): Meet the team / final interview with senior leader

### 4.2 University Lecturer Interview Formats

**Teaching demonstration (almost universal)**
- Duration: 15-30 minutes
- Audience: panel (often includes students) or actual student group
- Topic: usually specified by university, sometimes candidate's choice
- Level: specified (e.g., "a Level 5 session on research methods")
- Assessed on: clarity, engagement, use of technology, accessibility, alignment with learning outcomes
- Often followed by Q&A about pedagogical approach

**Research presentation**
- Duration: 15-20 minutes + Q&A
- Audience: academic panel, sometimes postgraduate students
- Content: current research, future direction, fit with department
- Assessed on: quality of research, communication skills, strategic vision

**Panel interview**
- Duration: 30-60 minutes
- Panel: 3-6 members (Head of Department, academics from department, HR, sometimes external)
- Mix of teaching, research, and institutional questions
- UK academic panels tend to be large (4-6 people) compared to corporate (2-3)

**Student panel (increasingly common)**
- Duration: 20-30 minutes
- Student representatives ask questions
- More informal but still assessed
- Questions focus on: approachability, teaching style, support for students
- Important: students' feedback carries genuine weight in hiring decisions

**Assessment centre format (Russell Group universities):**
- Full day or half day
- Components: teaching demo, research presentation, panel interview, informal lunch with staff
- Sometimes includes: written exercise, meeting with postgraduate students
- Tour of facilities

**Multi-stage process (typical for permanent lecturer posts):**
1. Longlisting: based on application form + CV + supporting statement
2. Shortlisting: panel reviews against essential/desirable criteria
3. Interview day: teaching demo + research presentation + panel interview (all on one day typically)
4. Decision: often made same day or within 48 hours

### 4.3 Assessment Centres

Assessment centres are used by some larger employers for L&D roles, particularly:
- Civil Service (especially for Fast Stream or Grade 7 roles)
- NHS (for band 8+ roles)
- Large corporates (Deloitte, PWC, EY for internal L&D roles)

**Typical components:**
- Group exercise (observed discussion on a business scenario, 30-45 min)
- In-tray / e-tray exercise (prioritise and respond to emails/tasks, 45-60 min)
- Presentation (as above)
- Competency interview (as above)
- Written exercise (analyse data, write a recommendation, 30-45 min)
- Role play (handle a difficult conversation, e.g., underperforming trainer)

**Duration:** Half day to full day

**Preparation needs:**
- Practice group exercises (contribute but don't dominate)
- Practice time-pressured written exercises
- Prepare for role plays with L&D scenarios

### 4.4 Technical Assessments / Exercises

Some L&D roles include practical exercises:

**Common types:**
1. **Training needs analysis exercise:** Given data about an organisation, produce a TNA
2. **Programme design exercise:** Design a learning programme for a given brief
3. **Facilitation exercise:** Deliver a live micro-training session (10-15 minutes)
4. **Digital exercise:** Demonstrate proficiency with specific tools (e.g., Articulate, Canva, LMS administration)
5. **Data analysis exercise:** Interpret L&D metrics and make recommendations
6. **Budget exercise:** Allocate an L&D budget across priorities

For university roles:
1. **Teaching materials review:** Critique or improve existing course materials
2. **Module design exercise:** Design a module outline with learning outcomes and assessment strategy
3. **Marking exercise:** Mark a sample student assignment and provide feedback

---

## 5. Post-Interview Workflow

### 5.1 Thank You Email (UK Convention)

**UK convention vs US convention:**
Thank you emails after interviews are less common and less expected in the UK than in the US. However, they are becoming more standard, particularly:
- After interviews with external recruiters (always worth sending)
- After panel interviews where you had significant engagement
- After university interviews (mixed -- some panels view it as unnecessary)

**Timing:**
- Send same evening or next morning (within 12-18 hours)
- Do not send immediately after (looks automated or desperate)

**UK-appropriate template:**
```
Subject: Thank you -- [Role Title] interview

Dear [Name],

Thank you for taking the time to meet with me today regarding the [Role] position.
I enjoyed learning more about [specific thing discussed -- e.g., "your plans for the
leadership development programme" or "the department's approach to blended learning"].

[Optional: brief reference to something discussed that reinforces fit -- one sentence only]

I remain very interested in the opportunity and look forward to hearing from you.

Kind regards,
Selvi
```

**Key UK differences from US practice:**
- Shorter (3-5 sentences, not a full page)
- More restrained in enthusiasm (avoid "I'm so excited!" -- British understatement)
- Do not re-sell yourself extensively (one brief reference at most)
- "Kind regards" or "Best wishes" (never "Best" on its own -- considered abrupt in UK)
- For university interviews: sending a thank you is optional and sometimes viewed as odd by academic panels

**n8n automation:**
```
Interview event end time + 4 hours
  -> AI Agent: Draft thank you email using interview debrief notes
  -> Gmail: Create draft (not send -- candidate reviews first)
  -> Notify candidate: "Thank you email draft ready for [Company]"
```

### 5.2 Interview Debrief Notes Capture

**Structured debrief form (to be filled by candidate):**

```json
{
  "interview_id": "auto-generated",
  "company": "from calendar event",
  "role": "from calendar event",
  "date": "from calendar event",
  "overall_rating": "1-10",
  "interviewers": [
    {"name": "", "role": "", "impression": ""}
  ],
  "questions_asked": [
    {"question": "", "my_answer_quality": "strong/adequate/weak", "notes": ""}
  ],
  "what_went_well": "",
  "what_could_improve": "",
  "questions_i_asked": [],
  "their_answers_notable": "",
  "red_flags": "",
  "company_culture_impression": "",
  "next_steps_stated": "",
  "expected_response_date": "",
  "would_accept_offer": "yes/no/depends",
  "minimum_acceptable_salary": "",
  "follow_up_actions": []
}
```

**Capture methods:**
1. **Google Form** linked in the debrief calendar event -- simplest
2. **Notion page** auto-created with template
3. **Voice memo** transcribed by AI (record debrief, Whisper transcription, Claude structured extraction)
4. **Telegram bot** -- candidate sends voice/text notes, system structures them

### 5.3 Follow-Up Timing

**Recommended follow-up schedule:**

| Stage | Timing | Action |
|-------|--------|--------|
| Thank you email | Same evening / next morning | Draft + review + send |
| If no response within stated timeline | Stated date + 2 working days | Polite follow-up email |
| If no response to follow-up | 5 working days after follow-up | Second follow-up (final) |
| If rejected | Within 24 hours of notification | Feedback request email |
| If offered | Within 24-48 hours | Acknowledge receipt, request time to consider |

**Follow-up email template:**
```
Subject: [Role Title] -- following up

Dear [Name],

I hope you are well. I wanted to follow up regarding the [Role] position
that I interviewed for on [Date].

I remain very interested in the opportunity and would be grateful for any
update on the timeline for next steps.

Kind regards,
Selvi
```

### 5.4 Feedback Request (If Rejected)

Always request feedback on rejection. UK employers are not legally required to provide it, but many will if asked politely.

**Template:**
```
Subject: Re: [Role Title] -- feedback request

Dear [Name],

Thank you for letting me know. While I am naturally disappointed, I
appreciate you taking the time to inform me.

If possible, I would be very grateful for any feedback from the interview
panel. This would be extremely helpful for my ongoing development.

Thank you again for the opportunity to interview.

Kind regards,
Selvi
```

**n8n automation:**
```
Rejection email detected (keywords: "unfortunately", "regret to inform", "not successful", "other candidates")
  -> AI Agent: Confirm this is a rejection, extract role/company
  -> Update interview status in database to "rejected"
  -> Create draft feedback request email
  -> Notify candidate
  -> Schedule follow-up if no feedback received in 5 working days
```

---

## 6. Preparation Materials Generation

### 6.1 AI-Generated Company Profile Summary

**Prompt template for Claude Sonnet:**
```
You are preparing an interview brief for a job candidate. Using the following
information gathered about [COMPANY], create a concise company profile summary.

## Information gathered:
[Company website content]
[Companies House data]
[Recent news articles]
[Glassdoor reviews summary]

## Output format:
### Company Overview
- What they do (2-3 sentences)
- Size and structure
- Industry sector
- Headquarters and UK offices
- Recent financial performance (if available)

### L&D/People Context
- Any public information about their L&D function
- Recent people/HR initiatives
- Training requirements in their sector
- Any known challenges (growth, restructuring, digital transformation)

### Culture & Values
- Stated values
- Glassdoor culture insights
- EDI commitments
- Working arrangements (hybrid/office/remote)

### Key People
- CEO/MD
- HR Director / CPO
- Head of L&D (if role exists / predecessor)
- Hiring manager (if known)

### Recent News
- Last 3-6 months of relevant news
- Any upcoming changes or announcements

### Interview Intelligence
- Glassdoor interview process descriptions
- Reported interview difficulty
- Common questions reported
- Salary data from reviews
```

### 6.2 AI-Generated Interview Questions from Job Description

**Prompt template:**
```
You are an expert interview coach specialising in UK corporate L&D roles.

Analyse this job description and generate the most likely interview questions
the panel will ask. For each question, indicate:
1. The question itself
2. Which requirement from the JD it maps to
3. The competency being assessed
4. Whether it's likely to be asked in STAR format
5. Difficulty level (standard/challenging/curveball)

Job Description:
[JD TEXT]

Generate:
- 8-10 competency-based questions (STAR format)
- 4-5 strategic/vision questions
- 3-4 technical/practical questions
- 2-3 likely curveball questions
- 2-3 questions about the candidate's career history (e.g., why consulting, why permanent now)
```

### 6.3 AI-Generated Answers Mapped to Candidate Experience

**Candidate profile data required:**
- Full CV with detailed role descriptions
- Key achievements with metrics
- Research publications and impact
- Teaching experience details
- Specific L&D programmes designed and delivered
- CIPD qualifications and level
- Technology/platform experience

**Prompt template:**
```
You are preparing interview answers for Selvi, who is interviewing for [ROLE] at [COMPANY].

## Candidate Profile:
[CV data / profile data]

## Interview Questions:
[Generated questions from previous step]

For each question, generate a STAR-format answer that:
1. Uses specific examples from Selvi's actual experience
2. Includes metrics and outcomes where available
3. Is appropriate length (2-3 minutes when spoken)
4. Connects the example to the specific context of [COMPANY]
5. Uses UK professional language (not American idioms)
6. Demonstrates both strategic thinking and practical execution

Also flag:
- Questions where Selvi may lack a strong example (suggest how to frame)
- Questions where Selvi's consulting/international experience is an advantage
- Questions where she should proactively address potential concerns (e.g., UK market tenure)
```

### 6.4 Salary Negotiation Preparation

**UK L&D salary data (Robert Half 2026 Salary Guide):**

| Role | 25th Percentile | Median | 75th Percentile |
|------|----------------|--------|-----------------|
| L&D Specialist | GBP 30,000 | GBP 35,000 | GBP 41,250 |
| L&D Manager | GBP 46,000 | GBP 53,000 | GBP 61,500 |
| Head of L&D | GBP 73,500 | GBP 95,500 | GBP 117,500 |
| HR Business Partner | GBP 46,750 | GBP 53,500 | GBP 64,500 |

**UK university salary data (UCEA Single Pay Spine 2025-26, approximate):**

| Role | Typical Spine Points | Salary Range |
|------|---------------------|-------------|
| Lecturer (Grade 7) | SP 31-38 | GBP 38,000-46,000 |
| Lecturer (Grade 8) | SP 39-44 | GBP 46,000-55,000 |
| Senior Lecturer | SP 42-51 | GBP 52,000-65,000 |
| Reader/Associate Professor | SP 48-54 | GBP 58,000-70,000 |
| Professor | Individually negotiated | GBP 70,000-100,000+ |

Note: London weighting adds approx GBP 3,000-5,000. Universities near Maidenhead (Reading, Royal Holloway, Brunel, various London universities) may or may not apply London weighting.

**UK salary negotiation norms:**
- University salaries are largely non-negotiable (fixed spine points), but starting point on the spine is negotiable
- Corporate roles have more flexibility, typically 10-15% negotiation range
- In UK culture, salary negotiation is expected but should be measured and evidence-based
- Always negotiate total package: salary, bonus, pension contribution, holiday allowance (statutory minimum 28 days including bank holidays, many offer 30-35), flexible working, professional development budget
- CIPD membership fees (approx GBP 200/year) are sometimes covered by employer

**Data sources to integrate:**
- Glassdoor salary data (via SerpAPI scrape)
- Robert Half Salary Guide data (manual entry, updated annually)
- Reed salary checker
- PayScale UK data
- CIPD Reward Management Survey data
- UCEA published pay scales (for academic roles)

### 6.5 Questions to Ask the Interviewer

**For L&D roles:**
1. What does success look like in this role in the first 6-12 months?
2. How is the L&D function currently structured, and how does this role fit?
3. What is the current relationship between L&D and the business units?
4. What LMS/learning platforms are you currently using?
5. What is the L&D budget, and how is it allocated?
6. How do you currently measure L&D impact?
7. What are the biggest people development challenges the organisation faces?
8. Is there a current L&D strategy, or would developing one be part of this role?
9. What happened to the previous person in this role? (asked tactfully)
10. What does the wider HR team look like?
11. What are the flexible/hybrid working arrangements?
12. What is the professional development support for L&D professionals?

**For university roles:**
1. What modules would I be teaching in the first year?
2. How is teaching allocated within the department?
3. What is the department's approach to the REF?
4. What research support is available (sabbaticals, funding, PhD students)?
5. What is the student profile for this programme?
6. How does the department support new lecturers?
7. What are the current strategic priorities for the department/faculty?
8. Is there scope to develop new modules or programmes?
9. What is the workload model and how is it balanced?
10. What is the department's approach to online/blended learning?

**Questions to avoid in UK interviews:**
- Asking about salary too early (wait until offer stage or when they raise it)
- Asking about holiday allowance in the first interview
- Questions that suggest you haven't researched the organisation
- Questions about promotion timeline (seen as presumptuous in UK culture)

---

## 7. n8n Implementation Architecture

### 7.1 Core Workflows

**Workflow 1: Interview Detection & Calendar Creation**
```
Trigger: Gmail Trigger (every 5 min, filter: interview-related subjects)
  -> Code: Pre-filter (subject line keyword matching)
  -> AI Agent (Claude Haiku): Extract structured interview data from email
  -> Structured Output Parser: Validate extraction
  -> If: Is this a new interview / reschedule / cancellation?
    -> [New] Google Calendar: Check availability for proposed time
      -> If: Available?
        -> [Yes] Google Calendar: Create interview event
        -> Google Calendar: Create prep block event
        -> If: In-person?
          -> HTTP Request: Google Maps travel time
          -> Google Calendar: Create travel event
        -> Google Calendar: Create debrief event
        -> Gmail: Create draft confirmation reply
        -> Postgres: Log interview in database
        -> Notify candidate (Telegram/email)
      -> [No] Notify candidate of conflict
    -> [Reschedule] Google Calendar: Update events
    -> [Cancel] Google Calendar: Delete events, update database
```

**Workflow 2: Interview Preparation Brief Generation**
```
Trigger: Google Calendar Trigger (new event with "Interview:" prefix)
  -> Wait: 5 minutes (allow calendar to settle)
  -> Postgres: Get job details from application database
  -> Parallel:
    -> HTTP Request: Company website -> AI summarise
    -> HTTP Request: Companies House API
    -> HTTP Request: SerpAPI (news)
    -> HTTP Request: SerpAPI (Glassdoor)
  -> Merge: Combine all research
  -> AI Agent (Claude Sonnet): Generate company brief
  -> AI Agent (Claude Sonnet): Generate likely questions from JD
  -> AI Agent (Claude Sonnet): Generate STAR answers from candidate profile
  -> AI Agent (Claude Sonnet): Generate questions to ask
  -> Format: Compile into preparation document
  -> Save: Google Docs / Notion
  -> Google Calendar: Update interview event description with prep doc link
  -> Notify candidate: "Prep brief ready for [Company] interview"
```

**Workflow 3: Post-Interview Automation**
```
Trigger: Google Calendar Trigger (event "Interview:" has ended)
  -> Wait: 30 minutes
  -> Notify candidate: "Time to complete your debrief for [Company]"
  -> Wait: 4 hours from interview end
  -> Gmail: Create thank you email draft
  -> Notify candidate: "Thank you email draft ready"
  -> Schedule: Follow-up check based on stated timeline
```

**Workflow 4: Rejection/Outcome Processing**
```
Trigger: Gmail Trigger (filter: rejection keywords)
  -> AI Agent (Claude Haiku): Confirm rejection, extract details
  -> If: Confirmed rejection?
    -> Postgres: Update interview status
    -> Gmail: Create feedback request draft
    -> Notify candidate
    -> Schedule: Follow-up if no feedback in 5 days
```

**Workflow 5: Interview Analytics & Learning**
```
Trigger: Schedule (weekly)
  -> Postgres: Query all interviews with debriefs
  -> AI Agent (Claude Sonnet): Analyse patterns
    - Which question types are strongest/weakest?
    - Which industries/company types progress to offers?
    - Average time between application and interview
    - Success rate by interview format
    - Common feedback themes
  -> Format: Weekly interview performance report
  -> Notify candidate
```

### 7.2 n8n Node Inventory

| Node | Version | Count | Purpose |
|------|---------|-------|---------|
| Gmail Trigger | 1.3 | 2 | Monitor for interview invites, rejections |
| Gmail | 2.2 | 4 | Reply, send, create drafts, get messages |
| Google Calendar | 1.3 | 8 | Create/update/delete events, check availability |
| Google Calendar Trigger | 1 | 2 | Detect new/ended interview events |
| AI Agent | 3.1 | 5 | Email parsing, research, prep generation |
| Anthropic Chat Model | 1.3 | 5 | Haiku for parsing, Sonnet for generation |
| Structured Output Parser | 1.3 | 3 | Validate AI extractions |
| HTTP Request | 4.4 | 6 | Company research, travel time, SerpAPI |
| HTML Extract | 1 | 2 | Parse company websites |
| Code | 2 | 3 | Custom parsing, date manipulation, formatting |
| Date & Time | 2 | 4 | Timezone conversion, date arithmetic |
| If | 2.3 | 5 | Routing logic |
| Switch | 3.4 | 2 | Multi-way routing (interview type, status) |
| Merge | 3.2 | 3 | Combine research branches |
| Wait | 1.1 | 3 | Timing for follow-ups |
| Set (Edit Fields) | 3.4 | 4 | Data transformation |
| Postgres | - | 6 | Read/write interview data |
| Schedule Trigger | 1.3 | 1 | Weekly analytics |

### 7.3 Database Schema (Interview-Related Tables)

```sql
-- Interviews table
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  application_id UUID REFERENCES applications(id),

  -- Scheduling
  interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
  interview_end TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT DEFAULT 'Europe/London',

  -- Format
  format TEXT CHECK (format IN ('phone', 'video_teams', 'video_zoom', 'video_meet', 'video_other', 'in_person', 'assessment_centre')),
  location TEXT,  -- physical address or video link

  -- Details
  round_number INTEGER DEFAULT 1,
  interview_type TEXT CHECK (interview_type IN ('screening', 'competency', 'presentation', 'case_study', 'panel', 'teaching_demo', 'research_presentation', 'assessment_centre', 'informal', 'final')),
  interviewer_names TEXT[],
  interviewer_roles TEXT[],
  duration_minutes INTEGER,

  -- Preparation
  presentation_topic TEXT,
  presentation_duration_minutes INTEGER,
  additional_instructions TEXT,
  prep_doc_url TEXT,

  -- Calendar
  calendar_event_id TEXT,  -- Google Calendar event ID
  prep_event_id TEXT,
  travel_event_id TEXT,
  debrief_event_id TEXT,

  -- Travel (for in-person)
  travel_duration_minutes INTEGER,
  travel_mode TEXT,  -- transit, driving
  departure_time TIMESTAMP WITH TIME ZONE,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show')),
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,

  -- Source
  source_email_id TEXT,  -- Gmail message ID
  source_email_from TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview debriefs
CREATE TABLE interview_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id),

  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 10),

  questions_asked JSONB DEFAULT '[]',
  -- [{"question": "...", "answer_quality": "strong|adequate|weak", "notes": "..."}]

  what_went_well TEXT,
  what_could_improve TEXT,
  questions_i_asked TEXT[],
  notable_answers_from_them TEXT,

  red_flags TEXT,
  culture_impression TEXT,

  next_steps TEXT,
  expected_response_date DATE,

  would_accept_offer TEXT CHECK (would_accept_offer IN ('yes', 'no', 'depends')),
  minimum_acceptable_salary INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview outcomes
CREATE TABLE interview_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id),

  outcome TEXT CHECK (outcome IN ('progressed', 'offered', 'rejected', 'withdrawn', 'ghosted')),
  outcome_date DATE,

  -- If progressed
  next_round_date TIMESTAMP WITH TIME ZONE,

  -- If offered
  offered_salary INTEGER,
  offered_benefits TEXT,
  offer_deadline DATE,

  -- If rejected
  rejection_reason TEXT,
  feedback_requested BOOLEAN DEFAULT FALSE,
  feedback_received BOOLEAN DEFAULT FALSE,
  feedback_text TEXT,

  -- Thank you / follow-up
  thank_you_sent BOOLEAN DEFAULT FALSE,
  thank_you_sent_at TIMESTAMP WITH TIME ZONE,
  follow_up_sent BOOLEAN DEFAULT FALSE,
  follow_up_sent_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Preparation briefs
CREATE TABLE prep_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id),

  company_profile JSONB,
  likely_questions JSONB,
  prepared_answers JSONB,
  questions_to_ask TEXT[],
  salary_data JSONB,
  talking_points JSONB,

  doc_url TEXT,  -- Link to Google Doc or Notion page

  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interviews_date ON interviews(interview_date);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_job_id ON interviews(job_id);
CREATE INDEX idx_debriefs_interview_id ON interview_debriefs(interview_id);
CREATE INDEX idx_outcomes_interview_id ON interview_outcomes(interview_id);
```

### 7.4 Integration Points with Other Modules

| Module | Integration |
|--------|------------|
| Module 1 (Job Discovery) | `jobs` table reference -- interview linked to discovered job |
| Module 2 (CV Tailoring) | Tailored CV used to generate preparation talking points |
| Module 3 (Application) | `applications` table reference -- interview linked to application |
| Module 4 (Cover Letter) | Cover letter themes used as basis for preparation notes |
| Module 5 (Application Tracking) | Interview status feeds into application pipeline status |
| Module 7 (Analytics) | Interview data feeds conversion metrics (interview-to-offer rate) |

---

## 8. Salary & Market Data

### 8.1 UK L&D Salary Ranges (2026)

**Source: Robert Half 2026 UK Salary Guide**

| Role | 25th %ile | Median | 75th %ile |
|------|----------|--------|----------|
| L&D Coordinator | GBP 25,000 | GBP 30,000 | GBP 35,000 |
| L&D Specialist | GBP 30,000 | GBP 35,000 | GBP 41,250 |
| L&D Manager | GBP 46,000 | GBP 53,000 | GBP 61,500 |
| Senior L&D Manager | GBP 55,000 | GBP 65,000 | GBP 75,000 |
| Head of L&D | GBP 73,500 | GBP 95,500 | GBP 117,500 |
| L&D Director | GBP 90,000 | GBP 110,000 | GBP 140,000 |

Note: candidate's target range of GBP 70-80k sits at the upper end of L&D Manager and lower end of Head of L&D. This is a realistic but competitive bracket.

**Regional adjustments:**
- London: +15-25% above national median
- South East (including Berkshire): +5-10% above national median
- South West, Midlands: approximately at national median
- North: -5-10% below national median

### 8.2 UK University Salary Data

Universities in the UK use a nationally agreed pay spine (the UCEA Single Pay Spine). Key points for the candidate's target roles:

**Lecturer (Grade 7/8):**
- Spine points 31-44
- Range: approximately GBP 38,000-55,000
- Entry point depends on experience (PhD + 18 years = likely top of scale or Grade 8)

**Senior Lecturer / Associate Professor:**
- Spine points 42-51
- Range: approximately GBP 52,000-65,000
- Some universities pay up to GBP 70,000 for Senior Lecturer

**Key notes:**
- The single pay spine is under pressure -- some universities now use local pay arrangements
- Russell Group universities tend to pay at the higher end
- London universities add GBP 3,000-5,000 London weighting
- Annual increments are automatic until top of grade
- Pension (USS) is generous but has been subject to dispute and reform
- Holiday: typically 30+ days plus bank holidays plus Christmas closure

**For the candidate:**
- University Lecturer salary (GBP 38,000-55,000) is below her target of GBP 70-80k
- Senior Lecturer (GBP 52,000-65,000) is closer but still below
- Reader/Associate Professor would meet the target but requires stronger research profile
- She may need to adjust salary expectations for academic roles, or target Professor-track positions
- Some universities offer market supplements for hard-to-recruit areas

### 8.3 Benefits Comparison

| Benefit | Corporate L&D | University |
|---------|--------------|-----------|
| Pension | DC, typically 5-10% employer contribution | USS or LGPS, very generous (historically 20%+ employer contribution) |
| Holiday | 25-30 days + bank holidays | 30-35 days + bank holidays + Christmas closure (often 5+ extra days) |
| Flexible working | Hybrid common (2-3 days office) | Term-time flexibility, research leave/sabbaticals |
| Professional development | Budget varies, CIPD fees sometimes covered | Conference funding, study leave, sabbatical every 7 years |
| Job security | Standard notice periods (1-3 months) | High job security once past probation |
| Progression | Based on performance and opportunity | Structured progression (lecturer -> senior -> reader -> professor) |

---

## Research Limitations & Gaps

1. **Glassdoor interview data** could not be scraped directly -- will rely on SerpAPI search results at runtime
2. **Specific company research** is necessarily dynamic -- the system generates this per-interview
3. **University pay spine exact figures** change annually (August) -- the system should store these as configuration and update annually
4. **n8n Google Maps node** does not exist natively -- HTTP Request to Google Maps API is the confirmed approach
5. **Firecrawl** does not have a native n8n node -- use HTTP Request to the Firecrawl API
6. **LinkedIn scraping** is not feasible -- rely on SerpAPI for LinkedIn company data
7. **Thank you email conventions** vary significantly across UK sectors -- the system should allow the candidate to choose whether to send

---

## Implementation Priority

| Priority | Component | Complexity | Value |
|----------|-----------|------------|-------|
| P0 | Interview email detection + calendar creation | Medium | High |
| P0 | Conflict detection | Low | High |
| P0 | Prep block auto-creation | Low | High |
| P1 | AI-generated preparation brief | Medium | Very High |
| P1 | STAR answer generation | Medium | Very High |
| P1 | Company research automation | Medium | High |
| P1 | Travel time calculation (in-person) | Low | Medium |
| P2 | Post-interview debrief workflow | Low | Medium |
| P2 | Thank you email drafting | Low | Medium |
| P2 | Follow-up timing automation | Low | Medium |
| P2 | Rejection detection + feedback request | Low | Medium |
| P3 | Interview analytics dashboard | Medium | Medium |
| P3 | Salary negotiation data aggregation | Medium | Medium |
| P3 | Auto-reschedule workflow | Medium | Low |

---

## Estimated External API Costs

| API | Usage | Monthly Cost |
|-----|-------|-------------|
| Google Calendar API | Free tier (sufficient) | GBP 0 |
| Gmail API | Free tier (sufficient) | GBP 0 |
| Google Maps Directions API | ~20 lookups/month | GBP 5-10 |
| Companies House API | Free | GBP 0 |
| SerpAPI | Already provisioned for Module 1 | GBP 0 incremental |
| Anthropic API (Claude) | ~50 prep briefs/month, ~200 email parsing | GBP 10-20 |
| TfL API | Free | GBP 0 |
| **Total incremental** | | **GBP 15-30/month** |
