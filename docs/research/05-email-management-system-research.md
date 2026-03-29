# Module 5: Email Management System -- Deep Research

**Date:** 2026-03-29
**Module:** 05 -- Email Management
**Target Account:** chellamma.uk@gmail.com
**Platform:** n8n (self-hosted at n8n.deploy.apiloom.io)

---

## Table of Contents

1. [Gmail Integration with n8n](#1-gmail-integration-with-n8n)
2. [Email Classification and Parsing](#2-email-classification-and-parsing)
3. [Automated Email Responses](#3-automated-email-responses)
4. [Email Organization](#4-email-organization)
5. [Recruiter Relationship Management](#5-recruiter-relationship-management)
6. [Technical Considerations](#6-technical-considerations)
7. [Integration with Other Modules](#7-integration-with-other-modules)
8. [Recommended Architecture](#8-recommended-architecture)

---

## 1. Gmail Integration with n8n

### 1.1 Available n8n Nodes

n8n provides four Gmail-related nodes:

**Gmail Trigger (`n8n-nodes-base.gmailTrigger` v1.3)**
- Polling-based trigger that fetches new emails at configurable intervals
- Supports `everyMinute`, `everyHour`, `everyDay`, `everyWeek`, `everyMonth`, `everyX` (custom interval), and full cron expressions
- Filters: label IDs, Gmail search query syntax (`q` parameter), read status (unread/read/both), sender
- `simple` mode returns snippet only; set `simple: false` to get full email body (id, threadId, labelIds, headers, html, text, textAsHtml, subject, date, to, from, messageId, replyTo)
- Can download attachments when `simple: false` with `downloadAttachments: true`
- Supports both OAuth2 and Service Account authentication

**Gmail Node (`n8n-nodes-base.gmail` v2.2)**
- Full CRUD operations across four resources:

| Resource | Operations |
|----------|-----------|
| Message | send, sendAndWait, reply, get, getAll, delete, markAsRead, markAsUnread, addLabels, removeLabels |
| Label | create, delete, get, getAll |
| Draft | create, delete, get, getAll |
| Thread | get, getAll, reply, addLabels, removeLabels, delete, trash, untrash |

**Gmail Tool (`n8n-nodes-base.gmailTool` v2.2)**
- Same operations as the Gmail Node but designed to be used as a tool within AI Agent workflows
- Allows an AI Agent to autonomously read, send, label, and manage emails

**Email Trigger IMAP (`n8n-nodes-base.emailReadImap` v2.1)**
- Alternative trigger using IMAP protocol directly
- Works with any email provider, not just Gmail
- Higher latency than Gmail API-based approaches

### 1.2 Gmail API Capabilities via n8n

**Message Operations (key parameters):**

- `message.get`: Retrieve by message ID. Returns full headers, body (text + HTML), labelIds, threadId. Can download attachments.
- `message.getAll`: Bulk fetch with filters -- labelIds, search query (Gmail syntax), read status, sender, receivedAfter/receivedBefore date filters. Supports pagination with `returnAll` or `limit`.
- `message.send`: Send to recipients with subject, HTML or plain text body, attachments (binary), CC, BCC, sender name, replyTo.
- `message.reply`: Reply to existing message by ID. Maintains threading. Supports replyToSenderOnly flag, attachments, CC, BCC.
- `message.addLabels` / `message.removeLabels`: Apply or remove labels by label ID on a specific message.
- `message.markAsRead` / `message.markAsUnread`: Toggle read status.

**Thread Operations:**
- `thread.get`: Retrieve entire conversation thread with all messages, headers, and payload structure. Option to return only messages.
- `thread.getAll`: List threads with filters.
- `thread.reply`: Reply within a thread context.
- `thread.addLabels` / `thread.removeLabels`: Label operations at thread level.
- `thread.trash` / `thread.untrash`: Move threads to/from trash.

**Label Operations:**
- `label.create`: Create custom labels with visibility options (labelShow/labelHide/labelShowIfUnread) and message list visibility (show/hide).
- `label.delete`: Remove labels.
- `label.get` / `label.getAll`: Retrieve label details and list all labels.

**Draft Operations:**
- `draft.create`: Create draft with subject, body, recipients, attachments, and threadId (to attach draft to existing conversation).
- `draft.get` / `draft.getAll`: Retrieve drafts.
- `draft.delete`: Remove drafts.

### 1.3 IMAP Polling vs Gmail API Push Notifications

| Aspect | IMAP Polling | Gmail API Polling (n8n Trigger) | Gmail API Push (Pub/Sub) |
|--------|-------------|-------------------------------|-------------------------|
| Latency | High (polling interval + Google IMAP implementation lag) | Medium (polling interval, min 1 min) | Low (typically seconds) |
| Setup Complexity | Low | Medium (OAuth2) | High (Pub/Sub + OAuth2) |
| API Quota Cost | N/A (IMAP) | 5 units per messages.get, 2 units per history.list | 100 units per watch call + 2 units per history.list |
| Reliability | Good but connection-dependent | Good with n8n's built-in polling | Good but must renew watch every 7 days |
| n8n Support | Native IMAP Trigger node | Native Gmail Trigger node | Requires webhook + custom setup |
| Rate Limit | Gmail IMAP connection limits | 15,000 quota units/min/user | 1 notification/sec/user max |
| Best For | Simple setups, non-Gmail | Most n8n workflows | Real-time processing needs |

**Recommendation for this system:** Use the **Gmail Trigger node** with polling at 5-minute intervals. This strikes the right balance between latency (acceptable for job email processing) and complexity. A 5-minute delay on receiving a job-related email is perfectly fine -- the candidate doesn't need sub-second response times for email classification.

### 1.4 Gmail Push Notifications via Google Cloud Pub/Sub

If real-time processing is ever needed (e.g., for interview invites with tight deadlines), here is the setup:

**Architecture:**
1. Create a Google Cloud Pub/Sub topic (e.g., `projects/selvi-job-app/topics/gmail-notifications`)
2. Grant publish permissions to `gmail-api-push@system.gserviceaccount.com`
3. Create a push subscription pointing to an n8n webhook URL
4. Call Gmail API `users.watch()` to start watching the mailbox

**Watch Request:**
```json
POST https://www.googleapis.com/gmail/v1/users/me/watch
{
  "topicName": "projects/selvi-job-app/topics/gmail-notifications",
  "labelIds": ["INBOX"],
  "labelFilterBehavior": "INCLUDE"
}
```

**Notification Payload (Base64-decoded):**
```json
{"emailAddress": "chellamma.uk@gmail.com", "historyId": "9876543210"}
```

**Critical Requirements:**
- Must call `watch()` at least every 7 days (recommend daily via a scheduled n8n workflow)
- Notification only contains emailAddress and historyId -- you must call `history.list` with the previous historyId to get actual changes
- Max notification rate: 1 event/second/user (excess notifications are dropped)
- Implement fallback periodic `history.list` calls to catch any dropped notifications

**n8n Implementation:**
- No native Google Cloud Pub/Sub trigger node exists in n8n
- Use the generic **Webhook node** (`n8n-nodes-base.webhook`) to receive Pub/Sub push notifications
- Community node available: `n8n-nodes-google-pubsub` (github.com/frankie567/n8n-nodes-google-pubsub)
- Alternatively, use Pub/Sub pull mode with a scheduled n8n workflow

### 1.5 Gmail API Rate Limits and Quotas

**Per-Project Limits:**
- 1,200,000 quota units per minute (project-wide)

**Per-User Limits:**
- 15,000 quota units per minute per user

**Per-Method Costs:**

| Method | Quota Units |
|--------|------------|
| messages.get | 5 |
| messages.list | 5 |
| messages.send | 100 |
| messages.modify (labels) | 5 |
| messages.delete | 10 |
| drafts.create | 10 |
| drafts.send | 100 |
| labels.get | 1 |
| labels.create | 5 |
| labels.list | 1 |
| history.list | 2 |
| watch | 100 |
| getProfile | 1 |
| threads.get | 10 |
| threads.list | 10 |

**Practical Impact:**
- At 15,000 units/min per user, you can do ~3,000 message reads per minute -- far more than needed
- Polling every 5 minutes with a getAll query uses ~5 units per poll = negligible
- Even processing 50 emails per day with full read + classify + label: ~50 * (5 + 5) = 500 units total, well within limits
- The only concern would be batch-processing historical emails during initial setup

**Error Handling:**
- HTTP 429 "Too Many Requests" with exponential backoff
- HTTP 403 "User-rate limit exceeded" -- wait and retry

---

## 2. Email Classification and Parsing

### 2.1 Classification Categories

For the job search email context, these are the relevant categories:

| Category | Description | Priority | Example |
|----------|------------|----------|---------|
| `interview_invite` | Interview scheduling, assessment centre invitations | URGENT | "We'd like to invite you for an interview on..." |
| `offer` | Job offer, salary negotiation | URGENT | "We are pleased to offer you the position of..." |
| `application_acknowledgment` | Confirmation that application was received | LOW | "Thank you for your application to..." |
| `rejection` | Application rejection at any stage | MEDIUM | "After careful consideration, we regret to inform..." |
| `recruiter_outreach` | Unsolicited recruiter contact about a role | HIGH | "I came across your profile and have an exciting opportunity..." |
| `job_alert` | Automated job alerts from job boards | MEDIUM | "New jobs matching your search for Learning & Development..." |
| `follow_up_request` | Employer/recruiter requesting additional info | HIGH | "Could you please provide references..." |
| `assessment_task` | Take-home tasks, presentations, case studies | URGENT | "As part of the interview process, please complete..." |
| `status_update` | Application status change notification | MEDIUM | "Your application has moved to the next stage..." |
| `networking` | Professional networking, event invitations | LOW | "Join us at the CIPD annual conference..." |
| `generic_marketing` | Marketing emails from job boards, recruiters | IGNORE | "Upgrade to Premium for better visibility..." |
| `not_job_related` | Personal, spam, or unrelated emails | IGNORE | Everything else |

### 2.2 AI-Powered Classification with Claude

**n8n Text Classifier Node (`@n8n/n8n-nodes-langchain.textClassifier` v1.1)**

This is the purpose-built node for this task. It:
- Takes input text and classifies into defined categories
- Each category creates a separate output branch (output 0 = first category, output 1 = second, etc.)
- Connects to a language model subnode (Anthropic Chat Model)
- Supports multi-class classification (email could be both `interview_invite` and `follow_up_request`)
- Has a fallback option for unmatched items: discard or route to "other" branch
- Supports batch processing with configurable batch size and delay between batches (for rate limiting)
- Auto-fixing: can trigger additional LLM call if output parsing fails
- Custom system prompt template supported

**Configuration:**
```
Text Classifier Node:
  inputText: {{ $json.text || $json.html }}  // email body
  categories:
    - { category: "interview_invite", description: "Email inviting candidate to interview, assessment, or meeting with hiring team" }
    - { category: "offer", description: "Formal or informal job offer, salary discussion, contract details" }
    - { category: "application_acknowledgment", description: "Automated or manual confirmation that application was received" }
    - { category: "rejection", description: "Application rejection at any stage of the hiring process" }
    - { category: "recruiter_outreach", description: "Unsolicited contact from recruiter about a job opportunity" }
    - { category: "job_alert", description: "Automated job alerts or digest emails from job boards" }
    - { category: "follow_up_request", description: "Request for additional information, references, or documents" }
    - { category: "assessment_task", description: "Take-home task, presentation topic, case study, or skills test" }
    - { category: "status_update", description: "Application status change or process update" }
    - { category: "networking", description: "Professional networking, event invitations, career resources" }
    - { category: "generic_marketing", description: "Marketing emails, premium upgrades, promotional content" }
    - { category: "not_job_related", description: "Personal email, spam, or unrelated to job search" }
  options:
    multiClass: true
    fallback: "other"
  model: Anthropic Chat Model (claude-haiku)
```

**Model Selection:**
- **Claude Haiku** for initial classification -- fast, cheap, handles straightforward categorization well
- **Claude Sonnet** for ambiguous cases or when extraction of structured data is needed (complex recruiter emails, parsing interview details)
- Cost: Haiku classification of a typical email body (~500 tokens input, ~50 tokens output) costs roughly $0.0003 per email. At 50 emails/day = ~$0.015/day = ~$0.45/month

### 2.3 Structured Data Extraction

After classification, use a second LLM call to extract structured data from relevant emails. Use the **Anthropic Node** (`@n8n/n8n-nodes-langchain.anthropic`, resource: text, operation: message) with a structured extraction prompt.

**Extraction Schema:**

```json
{
  "email_type": "interview_invite | offer | rejection | recruiter_outreach | ...",
  "company_name": "string",
  "role_title": "string",
  "contact_person": {
    "name": "string",
    "title": "string",
    "email": "string",
    "phone": "string"
  },
  "dates": {
    "interview_date": "ISO 8601 datetime",
    "interview_time": "ISO 8601 datetime",
    "deadline": "ISO 8601 datetime",
    "start_date": "ISO 8601 date"
  },
  "location": {
    "type": "in-person | remote | hybrid",
    "address": "string",
    "video_link": "URL",
    "platform": "Teams | Zoom | Google Meet | ..."
  },
  "salary": {
    "amount": "number",
    "currency": "GBP",
    "period": "annual | daily | hourly",
    "range_min": "number",
    "range_max": "number"
  },
  "action_required": "string (what the candidate needs to do)",
  "deadline_urgency": "immediate | within_24h | within_week | no_deadline",
  "recruiter_agency": "string (if from a recruitment agency)",
  "original_application_ref": "string (reference number if present)",
  "sentiment": "positive | neutral | negative",
  "key_details": "string (free-text summary of anything else important)"
}
```

**Prompt for Structured Extraction:**
```
You are an email parser for a UK-based job seeker. Extract structured data from the following job-related email.

Rules:
- Extract only information explicitly stated in the email. Do not infer or guess.
- For dates and times, convert to ISO 8601 format. Assume UK timezone (Europe/London) unless stated otherwise.
- Company name: distinguish between the hiring company and the recruitment agency (if applicable).
- Role title: use the exact title mentioned in the email.
- If a field is not present in the email, set it to null.
- For salary, note whether it's the full salary or a day rate (common in UK contracting).

Return valid JSON matching the schema provided.
```

### 2.4 Handling HTML vs Plain Text

Most job-related emails arrive as HTML with a plain text alternative. The approach:

1. **Gmail Trigger with `simple: false`** returns both `text` (plain text) and `html` (HTML) fields, plus `textAsHtml` (plain text rendered as HTML)
2. **For classification**: Use the `text` field -- stripped of formatting, faster to process, cheaper (fewer tokens)
3. **For extraction**: Use `html` when the `text` field is sparse or missing key information (some automated emails only have content in HTML). Use a Code node to strip HTML tags but preserve structure (lists, tables, links)
4. **For display/forwarding**: Preserve the original HTML

**HTML Stripping in n8n Code Node:**
```javascript
const htmlToText = (html) => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
```

### 2.5 Classification Accuracy Considerations

- **False positives on marketing**: Many recruiter emails use aggressive language similar to marketing. The classifier should err on the side of inclusion -- better to flag a marketing email as "recruiter_outreach" than to miss a genuine opportunity.
- **Multi-agency submissions**: The same role may be sent by multiple agencies. The extraction step should capture enough detail (role title, company name, salary) to enable deduplication downstream.
- **Auto-generated vs personal**: Distinguish between automated job alerts (low priority) and personal recruiter outreach (high priority). Signals: presence of candidate's name, reference to specific experience, personalised opening vs generic template.
- **Thread context**: For follow-up emails in an existing thread, the classifier should consider the entire thread context, not just the latest message. Use `thread.get` to fetch the full conversation.

---

## 3. Automated Email Responses

### 3.1 When to Auto-Reply

| Email Type | Auto-Reply? | Rationale |
|-----------|------------|-----------|
| Recruiter outreach (relevant role) | YES -- acknowledge within 2 hours | Speed matters; shows professionalism |
| Recruiter outreach (irrelevant role) | YES -- polite decline | Don't waste anyone's time |
| Interview invite | NO -- create draft only | Candidate must confirm availability and review details |
| Assessment task | NO -- create draft only | Candidate needs to read requirements carefully |
| Offer | NO -- never auto-reply | Requires careful human consideration |
| Application acknowledgment | NO | These are automated; replying is unnecessary |
| Rejection | NO -- create draft only | Candidate may want to ask for feedback |
| Job alert | NO | Automated digest; no reply expected |
| Follow-up request | NO -- create draft only | May need to gather documents or information |
| Status update | NO | Usually automated; no reply needed |

### 3.2 Auto-Reply Strategy: Draft-First for Most Cases

For most categories, the system should **create a draft reply** rather than sending automatically. The candidate reviews and sends (or modifies) at their convenience. This provides:
- Human judgment on tone and content
- Ability to add personal touches
- Prevention of embarrassing auto-reply mistakes
- Control over timing (some replies are better sent at specific times)

Only `recruiter_outreach` gets a direct auto-reply, and even then with safeguards.

### 3.3 Auto-Reply Templates

**Recruiter Outreach -- Interested (relevant role):**
```
Subject: Re: [Original Subject]

Dear [Contact Name],

Thank you for reaching out regarding the [Role Title] opportunity at [Company Name]. The role sounds like a strong fit with my background in Learning & Development, and I'd welcome the chance to learn more.

I've attached my CV for your reference. I'm available for a call at your convenience -- please let me know what times work for you.

Best regards,
Chellamma
[Phone Number]
[LinkedIn URL]
```

**Recruiter Outreach -- Not a Fit (irrelevant role):**
```
Subject: Re: [Original Subject]

Dear [Contact Name],

Thank you for thinking of me for this opportunity. Having reviewed the role details, I don't think it's quite the right fit for my experience and career direction at this time.

I'm currently focused on Learning & Development roles at Manager to Head level within the corporate or higher education sector. If you have anything along those lines in future, I'd be very happy to hear from you.

Best regards,
Chellamma
```

**Interview Acknowledgment (draft, not auto-sent):**
```
Subject: Re: [Original Subject]

Dear [Contact Name],

Thank you for the invitation to interview for the [Role Title] position. I'm looking forward to discussing how my experience in L&D strategy and programme delivery could contribute to [Company Name].

I can confirm my availability for [Date/Time]. [OR: Could we explore an alternative time? I have a conflict on that date.]

Please let me know if there's anything you'd like me to prepare or bring along.

Best regards,
Chellamma
```

### 3.4 UK Professional Email Etiquette

These conventions matter for the UK job market:

- **Greeting**: "Dear [Name]" for first contact; "Hello [Name]" or "Hi [Name]" for established correspondence. Never "Hey" or "To Whom It May Concern."
- **Sign-off**: "Best regards" or "Kind regards" (standard UK professional). "Best wishes" is slightly warmer. "Regards" alone can read as terse. Avoid "Cheers" in formal job contexts.
- **Length**: Keep to 100-200 words. Recruiters spend an average of 9 seconds scanning an email.
- **Tone**: Professional but warm. UK business communication tends toward slightly more formality than US/Australian equivalents. Avoid overly enthusiastic language ("I'm SO excited about this opportunity!").
- **Response time**: Aim for same-day or next-business-day response. Emails received Friday afternoon can wait until Monday morning.
- **Contact details**: Always include full name, phone number, and LinkedIn URL in the sign-off. Recruiters should never need to hunt for contact information.
- **Follow-up timing**: Wait 5-7 business days before a single polite follow-up. Keep follow-ups brief and neutral.

### 3.5 When NOT to Auto-Reply

Critical safeguards to prevent the system from causing harm:

1. **Never auto-reply to offers** -- salary negotiation, acceptance, or rejection of offers must always be human-driven
2. **Never auto-reply if the email asks a specific question** -- the LLM cannot know the candidate's schedule, preferences, or answers
3. **Never auto-reply to rejection emails** -- the emotional nuance of a response to rejection requires human judgment
4. **Never auto-reply if the candidate's name is misspelled** -- could indicate a mass mailing rather than genuine outreach
5. **Never auto-reply to the same sender twice within 24 hours** -- prevents reply loops
6. **Never auto-reply outside UK business hours** (09:00-18:00 Mon-Fri) -- queue and send at 09:00 next business day
7. **Pause auto-replies during interview periods** -- the candidate should be fully in control of all communication during active interview processes

---

## 4. Email Organization

### 4.1 Gmail Label Structure

Create a hierarchical label structure for job search organization:

```
Job Search/
  Job Search/Applications/
    Job Search/Applications/Pending
    Job Search/Applications/Interview Stage
    Job Search/Applications/Offer
    Job Search/Applications/Rejected
    Job Search/Applications/Withdrawn
  Job Search/Recruiter Outreach/
    Job Search/Recruiter Outreach/Active
    Job Search/Recruiter Outreach/Declined
    Job Search/Recruiter Outreach/Follow Up
  Job Search/Interviews/
    Job Search/Interviews/Scheduled
    Job Search/Interviews/Completed
    Job Search/Interviews/Cancelled
  Job Search/Alerts/
    Job Search/Alerts/LinkedIn
    Job Search/Alerts/Indeed
    Job Search/Alerts/Reed
    Job Search/Alerts/Jobs.ac.uk
    Job Search/Alerts/Other
  Job Search/Networking
  Job Search/Reference Requests
  Job Search/Action Required
```

**Implementation Notes:**
- Gmail labels support nesting via `/` separator (e.g., "Job Search/Applications/Pending")
- Maximum 10,000 labels per mailbox -- not a concern for this use case
- Labels can be created programmatically via `label.create` operation
- Create all labels during initial setup workflow, then reference by ID in classification workflows

### 4.2 Auto-Labeling Logic

After classification, apply labels automatically:

```
interview_invite     -> "Job Search/Interviews/Scheduled" + "Job Search/Action Required"
offer                -> "Job Search/Applications/Offer" + "Job Search/Action Required"
application_ack      -> "Job Search/Applications/Pending"
rejection            -> "Job Search/Applications/Rejected"
recruiter_outreach   -> "Job Search/Recruiter Outreach/Active" + "Job Search/Action Required"
job_alert            -> "Job Search/Alerts/[Source]"
follow_up_request    -> "Job Search/Action Required"
assessment_task      -> "Job Search/Interviews/Scheduled" + "Job Search/Action Required"
status_update        -> "Job Search/Applications/Pending" (or update existing label)
networking           -> "Job Search/Networking"
generic_marketing    -> (no job label; optionally archive)
not_job_related      -> (no action)
```

### 4.3 Priority Inbox Management

Use Gmail's star system alongside labels:

- **Red star**: Urgent action needed today (interview invites, time-sensitive responses)
- **Orange star**: Action needed this week (recruiter outreach to respond to, follow-ups)
- **Yellow star**: Review when available (job alerts, status updates)

The n8n workflow can modify labels but cannot set stars directly via the Gmail API in the standard node. Alternative: use the `message.addLabels` operation with a custom "Urgent" or "Priority" label that the candidate can configure to appear prominently in Gmail.

### 4.4 Flagging Urgent Emails

Create a separate urgent notification workflow:

1. When classification returns `interview_invite`, `offer`, `assessment_task`, or `follow_up_request`:
   - Apply "Job Search/Action Required" label
   - Send a push notification via Telegram/WhatsApp/Slack
   - Include key details: company, role, deadline, action required
   - If an interview date is within 48 hours, mark as critical

2. **Notification template:**
   ```
   URGENT: [Email Type]
   Company: [Company Name]
   Role: [Role Title]
   Action: [What's needed]
   Deadline: [Date/Time or "ASAP"]
   ```

---

## 5. Recruiter Relationship Management

### 5.1 Recruiter Tracking Data Model

Store recruiter interactions in the Postgres database:

```sql
CREATE TABLE recruiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    agency_name VARCHAR(255),
    linkedin_url VARCHAR(500),
    first_contact_date TIMESTAMP NOT NULL DEFAULT NOW(),
    last_contact_date TIMESTAMP,
    total_interactions INTEGER DEFAULT 1,
    quality_score DECIMAL(3,2) DEFAULT 0.50,  -- 0.00 to 1.00
    status VARCHAR(50) DEFAULT 'active',       -- active, dormant, blocked
    notes TEXT,
    specializations TEXT[],                    -- e.g., {'L&D', 'HR', 'Higher Education'}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recruiter_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id UUID REFERENCES recruiters(id),
    interaction_type VARCHAR(50),  -- outreach, response, follow_up, role_submission
    direction VARCHAR(10),         -- inbound, outbound
    email_id VARCHAR(255),         -- Gmail message ID
    thread_id VARCHAR(255),        -- Gmail thread ID
    role_title VARCHAR(255),
    company_name VARCHAR(255),
    relevance_score DECIMAL(3,2),  -- how relevant was the role they sent
    interaction_date TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE recruiter_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id UUID REFERENCES recruiters(id),
    role_title VARCHAR(255),
    company_name VARCHAR(255),
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    location VARCHAR(255),
    relevance_score DECIMAL(3,2),
    date_received TIMESTAMP DEFAULT NOW(),
    outcome VARCHAR(50)  -- interested, declined, applied, interviewed, offered, rejected
);
```

### 5.2 Avoiding Duplicate Conversations

Problem: Multiple recruiters from the same agency (or different agencies) may contact about the same role. The candidate needs to avoid:
- Applying to the same role through multiple agencies (damages reputation)
- Responding to duplicate outreach as if it were unique
- Losing track of which recruiter submitted them to which company

**Detection Logic:**
1. When a new recruiter email arrives with a role:
   - Extract company name and role title
   - Fuzzy match against existing `recruiter_roles` table
   - If match found (>85% similarity on company+title), flag as potential duplicate
   - Alert the candidate: "This role at [Company] may be the same as one [Other Recruiter] contacted you about on [Date]"
2. Track "exclusivity windows" -- if a recruiter submitted the candidate's CV to a company, no other recruiter should do the same for at least 6 months

### 5.3 Recruiter Quality Scoring

Score recruiters based on the relevance and quality of roles they send:

**Scoring Factors (0.0 to 1.0 scale):**

| Factor | Weight | Measurement |
|--------|--------|-------------|
| Role relevance | 0.40 | How closely the role matches the candidate's target profile (L&D, Manager-Head level, 70-80k) |
| Personalisation | 0.15 | Did they reference specific experience, or is it a mass mail? |
| Response rate | 0.15 | Do they respond when the candidate replies? |
| Accuracy | 0.15 | Is the salary/location/seniority as described? |
| Frequency | 0.15 | Too many irrelevant roles = lower score; consistent relevant roles = higher |

**Score Update Formula:**
```
new_score = (current_score * (n-1) + latest_interaction_score) / n
```
where n = total interactions

**Quality Tiers:**
- 0.80-1.00: Excellent -- auto-acknowledge outreach, prioritise responses
- 0.50-0.79: Good -- standard processing
- 0.20-0.49: Low quality -- classify but don't auto-respond
- 0.00-0.19: Poor -- consider blocking or auto-archiving

### 5.4 Follow-Up Scheduling

Automate follow-up reminders:

1. **After application submission**: Set reminder for 7 business days if no acknowledgment received
2. **After interview**: Set reminder for 3 business days if no feedback received
3. **After recruiter outreach response**: Set reminder for 5 business days if no reply
4. **After sending CV to recruiter**: Set reminder for 3 business days for status check

Implementation: Use n8n's **Wait node** or a scheduled workflow that checks the `recruiter_interactions` table for pending follow-ups:

```sql
SELECT ri.*, r.name, r.email
FROM recruiter_interactions ri
JOIN recruiters r ON ri.recruiter_id = r.id
WHERE ri.interaction_type IN ('response', 'role_submission')
  AND ri.direction = 'outbound'
  AND ri.interaction_date < NOW() - INTERVAL '5 days'
  AND NOT EXISTS (
    SELECT 1 FROM recruiter_interactions ri2
    WHERE ri2.thread_id = ri.thread_id
      AND ri2.direction = 'inbound'
      AND ri2.interaction_date > ri.interaction_date
  );
```

---

## 6. Technical Considerations

### 6.1 Gmail OAuth2 Setup for n8n (Self-Hosted)

**Step-by-step setup for n8n at n8n.deploy.apiloom.io:**

1. **Google Cloud Console** (console.cloud.google.com):
   - Create project "Selvi Job App" (or use existing)
   - Enable the Gmail API
   - Configure OAuth consent screen:
     - User Type: **External** (for personal Gmail account)
     - Add scope: `https://www.googleapis.com/auth/gmail.modify` (covers read, send, label, draft operations)
     - Add test user: `chellamma.uk@gmail.com`
   - Create OAuth 2.0 Client ID:
     - Application type: **Web application**
     - Authorized redirect URI: `https://n8n.deploy.apiloom.io/rest/oauth2-credential/callback`
   - Note the Client ID and Client Secret

2. **n8n Credentials**:
   - Add new credential: Google Gmail OAuth2 API
   - Enter Client ID and Client Secret
   - Click "Sign in with Google" to authorize
   - Select `chellamma.uk@gmail.com` account
   - Grant requested permissions

3. **Scope Requirements:**

| Scope | What It Allows |
|-------|---------------|
| `gmail.readonly` | Read messages and labels |
| `gmail.send` | Send messages |
| `gmail.modify` | Read, send, delete, manage labels, manage drafts (recommended -- covers everything) |
| `gmail.labels` | Create/manage labels only |
| `gmail.compose` | Create/send messages and drafts |

**Recommendation:** Use `gmail.modify` as the single scope -- it covers all operations needed.

### 6.2 Token Refresh Handling

**The 7-Day Problem:**
When the Google Cloud OAuth app is in "Testing" mode (not published), tokens expire every 7 days. This is the single biggest operational risk for the email management system.

**Solutions (in order of preference):**

1. **Service Account (Best for Automation):**
   - Create a Google Cloud Service Account
   - Enable domain-wide delegation (if using Google Workspace) or use the service account directly
   - Service account credentials don't expire
   - Caveat: Service accounts don't work natively with personal Gmail accounts (only Google Workspace). For a personal Gmail account (`chellamma.uk@gmail.com`), this is NOT an option.

2. **Publish the OAuth App (Recommended for Personal Gmail):**
   - Move the app from "Testing" to "Production" in Google Cloud Console
   - For personal/internal use, Google offers a simplified verification process
   - Once published, refresh tokens don't expire (unless the user revokes access)
   - You may need to go through Google's verification process if the app uses sensitive scopes
   - For `gmail.modify` scope, Google requires verification with a privacy policy and homepage

3. **Manual Token Refresh Monitoring (Fallback):**
   - Create a monitoring workflow that checks token validity daily
   - Send alert via Telegram if token is approaching expiry
   - Manually re-authenticate in n8n credentials panel before expiry
   - Set a recurring calendar reminder for every 6 days

4. **Internal User Type (if eligible):**
   - If the Google Cloud project is under a Google Workspace account, set User Type to "Internal"
   - Internal apps don't have the 7-day expiry
   - Not applicable for personal Gmail accounts

**Practical Recommendation:**
Since `chellamma.uk@gmail.com` is a personal Gmail account, the best path is:
- Start with "Testing" mode for development
- Publish the OAuth app for production use (create a simple privacy policy page and app homepage)
- Implement a daily health-check workflow that tests the Gmail connection and alerts on failure
- The n8n Gmail node handles token refresh automatically when the refresh token is valid -- the issue is only when the refresh token itself expires (Testing mode) or is revoked

### 6.3 Email Threading

Gmail uses `threadId` to group related messages. Key considerations:

- Every reply maintains the same `threadId` as the original message
- The `message.reply` operation automatically handles threading when given the `messageId` of the message being replied to
- When creating drafts with `draft.create`, attach to an existing thread using the `threadId` option
- Thread retrieval via `thread.get` returns all messages in the conversation, ordered chronologically
- **Known issue in n8n**: When fetching attachments for a specific message in a thread, the node may return attachments from all messages in the thread, not just the target message. Workaround: filter attachments by message ID in a Code node.

**Threading Best Practices:**
- Store the `threadId` alongside the `messageId` in the database for each interaction
- When checking for follow-up responses, query by `threadId` to find all related messages
- When auto-replying, always use `message.reply` (not `message.send`) to maintain the thread

### 6.4 Attachment Handling

**Downloading Attachments:**
- Set `downloadAttachments: true` and `simple: false` on the Gmail Trigger or `message.get` node
- Attachments are returned as binary data with prefix naming (default: `attachment_0`, `attachment_1`, etc.)
- Custom prefix configurable via `dataPropertyAttachmentsPrefixName`

**Common Job Search Attachments:**
- Job specifications (PDF, DOCX)
- Contracts and offer letters (PDF)
- Assessment briefs (PDF, DOCX)
- Recruiter terms of business (PDF)

**Processing Strategy:**
1. Download attachments from relevant emails (interview invites, offers, recruiter outreach)
2. Store in a structured folder on Google Drive or the server filesystem
3. For PDF job specs: optionally extract text using a PDF parser and feed to the job scoring engine (Module 1)
4. Index attachment metadata in the database:

```sql
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    filename VARCHAR(500),
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    storage_path VARCHAR(1000),
    attachment_type VARCHAR(50),  -- job_spec, contract, assessment, other
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.5 GDPR Compliance

Since this system processes email data in the UK, UK GDPR (Data (Use and Access) Act 2025) applies.

**Key Compliance Requirements:**

1. **Lawful Basis for Processing:**
   - The candidate's own emails: **Consent** (the candidate sets up and authorises the system) and **Legitimate Interest** (managing their own job search)
   - Recruiter/employer data extracted from emails: **Legitimate Interest** (the candidate has a legitimate interest in organising their job search correspondence)
   - No additional consent needed from senders -- the candidate is processing their own received mail

2. **Data Minimisation:**
   - Only process job-related emails (the classifier filters out non-relevant emails)
   - Only extract data fields that are necessary for the job search workflow
   - Don't store full email bodies long-term; extract structured data and reference the Gmail message ID

3. **Data Retention:**
   - Structured data (recruiter records, interaction logs): retain for the duration of the job search + 6 months
   - Email content: remains in Gmail (not duplicated into the system's database)
   - Attachment copies: delete within 90 days of the related application's conclusion
   - Implement automated cleanup workflows

4. **Data Subject Rights:**
   - The candidate can delete all extracted data at any time
   - If a recruiter requests deletion of their data (unlikely but possible), the system should be able to purge their records

5. **Security Measures:**
   - OAuth2 tokens stored encrypted in n8n's credential store
   - Database access restricted to the n8n instance
   - No email content transmitted to third parties beyond the LLM API (Anthropic)
   - Anthropic's data handling: API inputs are not used for training by default; check current data processing terms

6. **LLM Data Processing:**
   - Email content is sent to Anthropic's Claude API for classification
   - Anthropic does not train on API data (per their terms as of 2025)
   - Consider running a local LLM for classification if data sensitivity is a concern
   - At minimum, strip PII (phone numbers, addresses) before sending to the LLM, unless needed for extraction

---

## 7. Integration with Other Modules

### 7.1 Module 4: Application Tracker

**Incoming data from emails to the Tracker:**

| Email Type | Tracker Update |
|-----------|---------------|
| Application acknowledgment | Set application status to "Applied - Confirmed" |
| Rejection | Set status to "Rejected" + stage (if identifiable) |
| Interview invite | Set status to "Interview Scheduled" + add interview date |
| Status update | Update status based on content |
| Offer | Set status to "Offer Received" + salary details |
| Assessment task | Set status to "Assessment Stage" + deadline |

**Matching Logic:**
- Match incoming email to existing application by: company name (fuzzy), role title (fuzzy), recruiter email (exact)
- If no match found, create a new application entry (especially for recruiter outreach about roles the candidate hasn't applied to)
- Store the Gmail `threadId` on the application record for future reference

**n8n Workflow Integration:**
```
Gmail Trigger -> Classifier -> [If job-related] -> Extractor ->
  -> Postgres: Upsert application record
  -> Postgres: Insert interaction log
  -> Gmail: Add labels
  -> [If urgent] -> Notification
```

### 7.2 Module 6: Interview Scheduling

**Data Flow:**
1. Email classified as `interview_invite` or `assessment_task`
2. Structured extraction pulls: date, time, location, format, contact person
3. Pass to Module 6 to:
   - Check candidate's Google Calendar for conflicts
   - If no conflict: create draft confirmation reply + calendar event
   - If conflict: create draft reply suggesting alternatives + alert candidate
4. For video interviews: extract and store the meeting link (Zoom, Teams, Google Meet)

**Calendar Integration:**
- n8n has Google Calendar nodes for event creation
- Interview data should include: title (format: "Interview: [Company] - [Role]"), datetime, location/link, contact details in description, reminder (1 hour before, 1 day before)

### 7.3 Module 3: Auto-Apply Confirmation

**Data Flow:**
1. Module 3 submits an application
2. Confirmation email arrives at chellamma.uk@gmail.com
3. Email Management (Module 5) classifies it as `application_acknowledgment`
4. Extracts confirmation details (reference number, next steps, timeline)
5. Updates Module 4 (Tracker) with confirmed submission status and any reference number
6. Labels the email appropriately

**Closing the Loop:**
- When Module 3 submits an application, it should record the expected company name and role title
- Module 5 matches incoming acknowledgments against this expected list
- If an acknowledgment arrives for an application Module 3 submitted, it marks it as confirmed
- If no acknowledgment arrives within 48 hours, flag for manual check

---

## 8. Recommended Architecture

### 8.1 Core Workflow: Email Classification Pipeline

```
[Gmail Trigger]
    |-- Poll every 5 minutes
    |-- Filter: INBOX, unread
    |-- simple: false (get full body)
    |
[Code Node: Pre-process]
    |-- Strip HTML to clean text
    |-- Extract sender domain
    |-- Check against known recruiter list
    |
[Text Classifier (Claude Haiku)]
    |-- 12 categories with descriptions
    |-- Multi-class enabled
    |-- Fallback: "other"
    |
[Switch/Router]
    |-- Branch per category
    |
    |-- interview_invite -> [Extraction (Claude Sonnet)] -> [DB Update] -> [Calendar Check] -> [Draft Reply] -> [Urgent Notification]
    |-- offer -> [Extraction] -> [DB Update] -> [Urgent Notification]
    |-- recruiter_outreach -> [Extraction] -> [Relevance Check] -> [Duplicate Check] -> [Auto/Draft Reply] -> [DB Update] -> [Label]
    |-- application_ack -> [Extraction] -> [DB Update] -> [Label]
    |-- rejection -> [Extraction] -> [DB Update] -> [Label]
    |-- job_alert -> [Label by Source] -> [Optional: Feed to Module 1]
    |-- follow_up_request -> [Extraction] -> [Draft Reply] -> [DB Update] -> [Notification]
    |-- assessment_task -> [Extraction] -> [DB Update] -> [Calendar Event] -> [Notification]
    |-- status_update -> [Extraction] -> [DB Update] -> [Label]
    |-- networking -> [Label]
    |-- generic_marketing -> [Archive or Label]
    |-- not_job_related -> [No action]
```

### 8.2 Supporting Workflows

1. **Label Setup Workflow** (run once): Creates all Gmail labels programmatically
2. **Daily Health Check**: Tests Gmail connection, checks token validity, reports statistics
3. **Follow-Up Reminder**: Runs daily, checks for pending follow-ups, sends notifications
4. **Recruiter Quality Update**: Runs weekly, recalculates quality scores
5. **Data Cleanup**: Runs monthly, archives old data, cleans up attachment copies
6. **Watch Renewal** (if using Pub/Sub): Runs daily, renews the Gmail watch subscription

### 8.3 Technology Stack Summary

| Component | Technology |
|-----------|-----------|
| Email Access | Gmail API via n8n Gmail nodes (OAuth2) |
| Email Trigger | n8n Gmail Trigger (5-min polling) |
| Classification | n8n Text Classifier + Claude Haiku |
| Extraction | n8n Anthropic Node + Claude Sonnet |
| Auto-Reply | n8n Gmail Message Reply / Draft Create |
| Database | Postgres (existing on deploy.apiloom.io) |
| Notifications | Telegram Bot (or similar push notification) |
| Calendar | Google Calendar API via n8n |
| Hosting | n8n self-hosted at n8n.deploy.apiloom.io |

### 8.4 Estimated Costs

| Item | Monthly Cost |
|------|-------------|
| Claude Haiku (classification, ~50 emails/day) | ~$0.50 |
| Claude Sonnet (extraction, ~20 emails/day) | ~$3.00 |
| Gmail API | Free |
| Google Cloud Pub/Sub (if used) | Free tier sufficient |
| Infrastructure (shared with existing n8n) | $0 incremental |
| **Total** | **~$3.50/month** |

### 8.5 Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| OAuth token expiry | System stops processing emails | Publish OAuth app + daily health check + alerts |
| Misclassification | Miss important email or send wrong auto-reply | Conservative auto-reply policy (draft-first for most categories) |
| LLM hallucination in extraction | Wrong company/date extracted | Validate extracted data against email headers (sender domain vs company name) |
| Auto-reply to wrong email | Professional embarrassment | Rate-limit auto-replies, never auto-reply to offers/rejections, human review for edge cases |
| Duplicate recruiter submissions | Candidate submitted to same role twice | Cross-reference `recruiter_roles` table before responding to outreach |
| Gmail API downtime | Missed emails | Polling catches up automatically on recovery; no data loss |
| GDPR complaint | Legal risk | Minimal data storage, email content stays in Gmail, automated cleanup |
