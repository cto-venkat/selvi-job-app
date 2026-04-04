# Selvi Job App - User Guide

## What This System Does

An automated job search pipeline built on n8n that discovers jobs, scores them, tailors CVs, applies, tracks applications, monitors emails, prepares for interviews, and manages LinkedIn presence. All running on your Hetzner server at n8n.deploy.apiloom.io.

---

## System Overview

```
Job Discovery (M1) --> CV Tailoring (M2) --> Auto-Apply (M3)
       |                                          |
       v                                          v
  AI Scoring -----> Daily Digest Email     Application Tracker (M4)
                                                   |
Email Monitor (M5) <---------- status updates -----+
       |                                           |
       v                                           v
Interview Prep (M6) <--- interview invites    Weekly Reports
       |
       v
LinkedIn Intelligence (M7) --- content drafts, profile optimization
```

---

## How to Access

- **n8n Dashboard:** https://n8n.deploy.apiloom.io
- **Login:** venkat.fts@gmail.com
- **Notifications sent to:** chellamma.uk@gmail.com

---

## Module 1: Job Discovery (ACTIVE - runs automatically)

**What it does:** Pulls jobs from Adzuna, Reed, and 9 RSS feeds (jobs.ac.uk, Guardian Jobs, CV-Library, Civil Service, NHS) every 2-3 hours. AI scores each job against Selvi's profile.

**Workflows running:**
| Workflow | Schedule | What it does |
|----------|----------|--------------|
| WF2a: Adzuna Poller | Every 3 hrs | Searches Adzuna API for L&D/HR/academic roles |
| WF2b: Reed Poller | Every 3 hrs | Searches Reed API |
| WF1: RSS Poller | Every 2 hrs | Polls 9 RSS feeds (jobs.ac.uk, Guardian, CV-Library, Civil Service, NHS) |
| WF5: AI Scoring | Every 30 min | Scores unscored jobs using Claude AI (A+/A/B/C tiers) |
| WF6: Dedup & Cleanup | Every 4 hrs | Removes duplicates and expired listings |
| WF7: Daily Digest | 7:30 AM daily | Sends email summary of new A/B tier jobs |

**What you receive:** A daily digest email at 7:30 AM with the top new jobs discovered, scored and categorized.

**To check:** Go to n8n > Executions to see recent runs. Or check the `jobs` table:
```sql
SELECT title, company, tier, composite_score, source
FROM jobs WHERE tier IN ('A+','A','B')
ORDER BY discovered_at DESC LIMIT 20;
```

---

## Module 2: CV Tailoring (INACTIVE - needs activation)

**What it does:** Takes A/B tier jobs and generates tailored CVs using AI. Currently configured to use Ollama (local LLM) but can be switched to Claude.

**Workflow:** WF8: CV Tailoring Pipeline (yPheY04xrwGA8EVW)

**To activate:** Go to n8n > WF8 > Toggle active. Note: This workflow calls Ollama at `http://ollama:11434` which may not be running in your Docker setup. You may need to update it to use the Claude API instead.

**Once active:** Jobs with tier A/A+/B will get tailored CVs generated. Once a CV is ready, the job's `ready_to_apply` flag is set to `true`, which triggers Module 3.

---

## Module 3: Auto-Apply (ACTIVE)

**What it does:** Picks up jobs marked `ready_to_apply`, detects the application method (email vs portal), and routes them.

**Workflow:** WF-AP1: Application Router (every 15 min, 7AM-10PM UK)

**How it works:**
1. Checks if system is paused (configurable in `application_config` table)
2. Fetches jobs with `ready_to_apply = true`
3. Detects application method: email, portal (Workday/Taleo/etc), or unknown
4. For email: sets status to `email_ready` (WF-AP2 would send -- not yet built)
5. For portal: sets status to `portal_task_ready` (WF-AP3 would prepare task card -- not yet built)
6. For unknown: flags for manual review

**Note:** WF-AP2 (Email Engine) and WF-AP3 (Portal Prep) are not yet built. Currently the router creates application records and routes them.

---

## Module 4: Application Tracker (ACTIVE)

**What it does:** Tracks every application through its lifecycle, detects ghosting, sends reminders, computes metrics, and generates weekly reports.

**Workflows:**
| Workflow | Schedule | What it does |
|----------|----------|--------------|
| WF4-GHOST | Every 6 hrs | Detects ghosted applications (no response past expected window). Corporate: 7-day warn, 14-day ghost. Academic: 21-day warn, 56-day ghost. Sends follow-up suggestions. |
| WF4-METRICS | Daily 6 AM | Calculates pipeline metrics: response rate, ghosting rate, velocity, funnel conversion. Also runs GDPR DBS cleanup. |
| WF4-NOTIFY | Every 5 min | Processes `notification_queue` table. Sends notifications via Resend with priority-based throttling and quiet hours (10PM-7AM). |
| WF4-REPORT | Sunday 6 PM | Sends weekly pipeline summary email: upcoming interviews, pending offers, activity stats, source performance. |

**What you receive:**
- Follow-up reminders when applications go silent
- Weekly pipeline report every Sunday evening
- Deadline alerts for jobs expiring within 48 hours

---

## Module 5: Email Management (ACTIVE)

**What it does:** Monitors Gmail inbox, classifies job-related emails, extracts structured data, and sends urgent alerts.

**Workflows:**
| Workflow | Schedule | What it does |
|----------|----------|--------------|
| WF5-INGEST | Every 5 min | Polls Gmail for new emails, stores in `emails` table |
| WF5-CLASSIFY | Every 5 min | 3-tier classification: sender pattern match -> Claude Haiku -> Sonnet escalation |
| WF5-EXTRACT | Every 5 min | Extracts company name, role, interview dates, contact details from classified emails |
| WF5-NOTIFY | Every 2 min | Sends instant alerts for interview invitations, offers, urgent follow-ups |

**Email categories detected:**
- Interview invitations (URGENT - instant notification)
- Offer emails (URGENT - instant notification)
- Application acknowledgements
- Rejections
- Recruiter outreach
- Job alerts from LinkedIn/Indeed/Reed/TotalJobs
- Follow-up requests

**What you receive:** Instant email alerts when interview invites or offers arrive. No more buried interview invitations.

---

## Module 6: Interview Scheduling & Preparation (ACTIVE)

**What it does:** Generates interview prep briefs, daily briefings, thank-you email drafts, and debrief reminders.

**Workflows:**
| Workflow | Schedule | What it does |
|----------|----------|--------------|
| WF6-PREP | Every 30 min | Generates AI prep briefs for upcoming interviews (company research, likely questions, salary data, logistics) |
| WF6-DAILY | 7:30 AM daily | Sends "Today's Interviews" briefing email with all details |
| WF6-FOLLOWUP | Every hour | After interviews: marks completed, sends debrief reminder (1hr), generates thank-you draft (1.5hr) |

**What you receive:**
- Detailed prep brief emailed before each interview (8 sections)
- Daily morning briefing with all interviews for today/tomorrow
- Post-interview debrief reminder with structured prompts
- AI-generated thank-you email draft (edit before sending)

---

## Module 7: LinkedIn Intelligence (ACTIVE)

**What it does:** Generates LinkedIn content, monitors profile activity, and checks profile-CV alignment.

**Workflows:**
| Workflow | Schedule | What it does |
|----------|----------|--------------|
| WF7-CONTENT | Monday 8 AM | Generates 2-3 LinkedIn post drafts with UK L&D focus, hashtags, and posting schedule |
| WF7-INTEL | Sunday 6 PM | Weekly intelligence digest: recruiter views, InMail summary, search appearances, content performance |
| WF7-ALIGNMENT | Wednesday 9 AM | Compares LinkedIn profile against recent CVs, flags discrepancies |

**What you receive:**
- Monday: LinkedIn post drafts ready to review and publish
- Sunday: Intelligence digest with recruiter activity analysis
- Wednesday: Profile-CV alignment report (if issues found)

**Important:** Populate the `linkedin_profile` table with your current LinkedIn data for alignment checks to work. The system never touches LinkedIn directly -- it only reads notification emails and generates content for you to post manually.

---

## Weekly Rhythm

| Day | Time | What Happens |
|-----|------|-------------|
| **Every day** | 7:30 AM | Daily Digest email (new jobs + interview briefing) |
| **Every day** | Continuous | Jobs discovered, scored, emails monitored, notifications sent |
| **Monday** | 8:00 AM | LinkedIn content drafts generated |
| **Wednesday** | 9:00 AM | Profile-CV alignment check |
| **Sunday** | 6:00 PM | Weekly pipeline report + LinkedIn intelligence digest |

---

## Manual Actions Required

These are things the system prepares but you must do:

1. **Review daily digest** - Check the morning email for new high-scoring jobs
2. **Review and post LinkedIn content** - Edit AI drafts, add personal voice, post manually
3. **Complete portal applications** - When the system prepares a portal task card, follow the instructions to apply on Workday/Taleo/etc
4. **Respond to interview invitations** - The system alerts you instantly; you confirm availability
5. **Send thank-you emails** - Review the AI draft, personalize it, send from Gmail
6. **Complete interview debriefs** - Reply to the debrief reminder email with your notes
7. **Follow up on ghosted applications** - When reminded, decide to follow up or close

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `jobs` | All discovered jobs with scores and tiers |
| `applications` | Application lifecycle tracking |
| `emails` | Ingested Gmail emails |
| `email_classifications` | AI classification results |
| `interviews` | Interview schedule and outcomes |
| `prep_briefs` | AI-generated interview prep materials |
| `content_calendar` | LinkedIn post drafts |
| `pipeline_metrics` | Historical pipeline analytics |
| `notification_queue` | Pending notifications |

---

## Troubleshooting

**No new jobs appearing:**
- Check n8n executions for WF2a/WF2b/WF1 errors
- Adzuna/Reed API keys may have expired
- RSS feeds may have changed URLs

**No emails being processed:**
- Check WF5-INGEST execution log
- Gmail OAuth2 token may have expired (re-authorize in n8n credentials)

**Notifications not arriving:**
- Check Resend dashboard for delivery status
- Check `notification_queue` table for stuck items
- Verify Resend API key is valid

**To pause everything:**
```sql
UPDATE application_config
SET config_value = jsonb_set(config_value, '{system_paused}', 'true')
WHERE config_key = 'auto_apply_rules';
```

**To resume:**
```sql
UPDATE application_config
SET config_value = jsonb_set(config_value, '{system_paused}', 'false')
WHERE config_key = 'auto_apply_rules';
```
