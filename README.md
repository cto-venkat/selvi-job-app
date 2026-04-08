# JobPilot

Job application automation for UK job seekers. Personal tool for two users (Venkat and Selvi). The problem: a single quality application takes 1-3 hours of form filling and another day or two of prep. This compresses that to minutes.

## What it does

- Discovers jobs from 8+ sources automatically every 3 hours
- Prep pipeline via Claude API -- JD analysis, company research, CV tailoring, screening question answers
- Hybrid scoring (4 deterministic + 4 LLM dimensions) to filter Apply / Maybe / Skip
- ATS detection for 10 portal types with API submission helpers (Greenhouse, Lever, SmartRecruiters, Workday, etc.)
- Dashboard for managing the full pipeline: discovery, applications, interviews, emails
- WhatsApp/Telegram alerts for new high-scoring jobs via n8n
- LinkedIn profile optimization and target company tracking
- Interview prep with STAR story bank matched to likely questions

## Architecture overview

```
Job Boards ──> Discovery Script ──> PostgreSQL ──> Next.js Dashboard
  (8+ sources)    (Python, cron)     (selvi_jobs)        |
                                                    Claude API
                                                  (prep pipeline)
```

The discovery script runs every 3 hours via cron. It pulls from multiple job boards and filters by per-user relevance patterns (Selvi gets L&D roles, Venkat gets CTO/VP/Director roles). The dashboard calls Claude Haiku on demand when you hit "Generate" on any prep section.

n8n handles email classification, notifications, and webhook actions.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | Next.js API routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| AI | Claude API (Haiku) via `@anthropic-ai/sdk` |
| Auth | JWT (jose) -- simple credential-based, two users |
| Orchestration | n8n (22 workflows) |
| Job Discovery | Python script (Adzuna, Reed, LinkedIn, Greenhouse, RSS) |
| Infrastructure | Docker Compose, Caddy (reverse proxy + auto-HTTPS) |
| Hosting | Hetzner CAX31 (ARM64) with Dokploy/Traefik |

## Quick start (local dev)

```bash
# Clone and install
git clone <repo-url>
cd selvi-job-app/dashboard
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# Run dev server
npm run dev
```

Dashboard runs at `http://localhost:3000`.

## Deployment

Production is Docker Compose with Caddy handling HTTPS:

```bash
# On the server
cd /opt/jobpilot
cp .env.example .env
# Fill in production values

docker compose up -d
```

Services:
- `caddy` -- reverse proxy with automatic HTTPS (ports 80, 443)
- `dashboard` -- Next.js app (port 3000, internal)
- `n8n` -- workflow automation (port 5678, internal)
- `postgres` -- PostgreSQL 16 (port 5432, internal)

## Job discovery sources

| Source | Type | Status | Notes |
|--------|------|--------|-------|
| Adzuna | API | Active | Free tier, UK job board aggregator |
| Reed | API | Active | UK job board, API key required |
| LinkedIn | Guest API | Active | Public listings, no auth needed |
| Greenhouse | Board API | Active | 22 company career boards monitored |
| CV-Library | Firecrawl | Active | Scraped via Firecrawl API |
| TotalJobs | Firecrawl | Intermittent | Occasional 500 errors from their side |
| NHS Jobs | RSS | Planned | Public sector roles |
| CharityJob | RSS | Planned | Third sector roles |
| Company Pages | Firecrawl | Planned | Direct career page monitoring |

The discovery script (`scripts/discover_jobs.py`) filters by title patterns per user. Each user only sees jobs that match their search profile.

## Environment variables

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/selvi_jobs

# Auth (simple JWT-based, no external providers)
JWT_SECRET=your-random-secret-here-min-32-chars
AUTH_PASSWORD_SELVI=changeme
AUTH_PASSWORD_VENKAT=changeme

# Claude API (prep pipeline, scoring, CV tailoring, email drafts)
ANTHROPIC_API_KEY=sk-ant-xxx

# n8n webhook URL (email replies via n8n workflows)
N8N_WEBHOOK_URL=https://your-n8n-domain/webhook
```

For the discovery script (server-side only):

```bash
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-app-key
REED_API_KEY=your-reed-key
FIRECRAWL_API_KEY=fc-xxx
```

## Project structure

```
selvi-job-app/
├── dashboard/              # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/        # API routes (auth, prep, webhooks)
│   │   │   ├── dashboard/  # Main app pages
│   │   │   │   ├── applications/
│   │   │   │   ├── apply/
│   │   │   │   ├── cv/
│   │   │   │   ├── emails/
│   │   │   │   ├── interviews/
│   │   │   │   ├── jobs/
│   │   │   │   ├── linkedin/
│   │   │   │   ├── metrics/
│   │   │   │   └── settings/
│   │   │   └── sign-in/
│   │   ├── components/     # React components
│   │   ├── lib/            # DB queries, utilities, schemas
│   │   └── middleware.ts   # JWT auth middleware
│   ├── Dockerfile
│   └── package.json
├── scripts/
│   └── discover_jobs.py    # Multi-source job discovery (cron)
├── workflows/              # n8n workflow JSON exports
├── sql/                    # Database migrations
├── migrations/             # Additional migration scripts
├── docs/                   # Roadmap, architecture docs
├── docker-compose.yml
└── Caddyfile               # Reverse proxy config
```

## Design principles

1. Personal tool, not a product. Two users. No SaaS features.
2. Every feature must measurably reduce time per application.
3. AI prepares, human reviews, human submits. Always.
4. Official APIs where they exist, Playwright as a visible browser helper where they don't. No stealth.
5. Tailored content, never fabricated content.
