#!/usr/bin/env python3
"""
JobPilot Multi-Source Job Discovery
Sources: Adzuna, Reed, RSS feeds
Runs every 3 hours via cron on the server.

Usage:
  python3 discover_jobs.py              # Run all sources
  python3 discover_jobs.py --source adzuna  # Run single source
  python3 discover_jobs.py --dry-run    # Preview without inserting
"""

import json
import hashlib
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
import base64
import ssl
import xml.etree.ElementTree as ET
from datetime import datetime

# ── Config ──────────────────────────────────────────────

ADZUNA_APP_ID = "778c1749"
ADZUNA_APP_KEY = "f3360c492bb951f7b94e4aa507c99739"
REED_API_KEY = "51056518-3f43-4944-9888-34b92c1dae34"

# Tenant relevance filters (title must match at least one pattern)
TENANT_FILTERS = {
    "76f15f33-9a1e-4408-b718-676a313cce93": {  # Selvi - L&D
        "name": "Selvi",
        "patterns": re.compile(
            r"learning.{0,5}develop|L&D|L \& D|"
            r"training.{0,5}develop|talent.develop|"
            r"organisational.develop|people.develop|capability.develop|"
            r"instructional.design|workforce.develop|employee.develop|"
            r"head of learning|leadership.develop|"
            r"learning.{0,5}manager|learning.{0,5}consultant|"
            r"learning.{0,5}partner|learning.{0,5}lead|"
            r"learning.{0,5}designer|learning.{0,5}specialist|"
            r"learning.{0,5}business|learning.{0,5}trainer|"
            r"learning.{0,5}operations",
            re.IGNORECASE,
        ),
        "exclude": re.compile(
            r"machine.learning|deep.learning|foundation.learning.lecturer|"
            r"learning.disability|learning.support.assistant",
            re.IGNORECASE,
        ),
    },
    "48d629f3-1b10-4262-b50f-166176a82dc7": {  # Venkat - Senior Eng Leadership
        "name": "Venkat",
        "patterns": re.compile(
            r"CTO|chief.technolog|"
            r"VP.engineer|VP.of.engineer|VP.technolog|VP.of.technolog|"
            r"vice.president.engineer|vice.president.technolog|"
            r"senior.director.{0,5}engineer|director.of.engineer|"
            r"director.{0,3}software|director.{0,3}platform|"
            r"head.of.engineer|SVP.engineer|"
            r"director.{0,3}architect",
            re.IGNORECASE,
        ),
        "exclude": re.compile(
            r"sales|marketing|finance|legal|HR|HRBP|product.market|"
            r"account.executive|account.manager|business.develop|"
            r"field.market|alliance|recruitment|staffing|"
            r"silicon|verification|logical.design|"
            r"non.profit|public.sector|fire.engineer|"
            r"structural|civil|mechanical|construction|"
            r"commercial.director|product.director|product.design|"
            r"data.engineer|ERP|oracle.fusion|"
            r"fractional|co.founder|founder.track|"
            r"relocate.to|singapore|program.manager|"
            r"major.accounts|solution.consulting|technical.account|"
            r"product.management|solutions.architect",
            re.IGNORECASE,
        ),
    },
}

# Adzuna noise exclusion
ADZUNA_EXCLUDE = (
    "SAP construction nursery childcare apprentice NVQ "
    "warehouse retail chef plumber solicitor civil engineering "
    "mechanical electrical lecturer professor"
)

# ── WhatsApp Config ─────────────────────────────────────

WHATSAPP_TOKEN = "EAAU4uo4HCuABRN280ytR52MQfES6EHsXfNy5GFkZAzZCVCgWFZCbDx0cFHskXDp0PJmT161BsUmLRhvVrobs5j63vYqPab4h43KJEp03cG8zfZCaVV8BHypvaGekq4q2ZAYFHnYKduVvQoOecIYksHMegEGyojTzVD6PZCFCqcAeCAzZBxDy4a6FF9FB9T1bfJ5ojFP8mDMuv8ZAjB5pRC75it1Ne7FXpg27ZBZAeZASHEipkN6L21AHl3ZB6qn8ySDeSAoHP6bQMlyWOLrRZAAcYwjsq"
WHATSAPP_PHONE_ID = "1029967786872407"
WHATSAPP_RECIPIENTS = {
    "76f15f33-9a1e-4408-b718-676a313cce93": "447767958049",  # Selvi -> Venkat's phone for now
    "48d629f3-1b10-4262-b50f-166176a82dc7": "447767958049",  # Venkat
}


def send_whatsapp(to: str, message: str):
    """Send a WhatsApp text message."""
    payload = json.dumps({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }).encode()

    req = urllib.request.Request(
        f"https://graph.facebook.com/v22.0/{WHATSAPP_PHONE_ID}/messages",
        data=payload,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {WHATSAPP_TOKEN}")
    req.add_header("Content-Type", "application/json")

    try:
        urllib.request.urlopen(req, timeout=10, context=ssl_ctx)
    except Exception as e:
        print(f"  WhatsApp send error: {e}")


DRY_RUN = "--dry-run" in sys.argv
SOURCE_FILTER = None
for i, arg in enumerate(sys.argv):
    if arg == "--source" and i + 1 < len(sys.argv):
        SOURCE_FILTER = sys.argv[i + 1]

# SSL context for HTTPS
ssl_ctx = ssl.create_default_context()


# ── Database ────────────────────────────────────────────

def db_exec(sql: str) -> str:
    """Execute SQL via docker exec on the server."""
    import subprocess

    result = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "jobpilot-n8n-postgres-1",
            "psql",
            "-U",
            "n8n",
            "-d",
            "selvi_jobs",
            "-t",
            "-A",
        ],
        input=sql,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def get_search_configs():
    """Get search configs from DB."""
    raw = db_exec(
        "SELECT tenant_id, search_term, location, salary_min, salary_max "
        "FROM search_configs WHERE is_active = true"
    )
    configs = []
    for line in raw.split("\n"):
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) >= 5:
            configs.append(
                {
                    "tenant_id": parts[0],
                    "search_term": parts[1],
                    "location": parts[2],
                    "salary_min": int(parts[3]) if parts[3] else 0,
                    "salary_max": int(parts[4]) if parts[4] else 999999,
                }
            )
    return configs


def insert_job(job: dict) -> bool:
    """Insert a job into the DB. Returns True if new."""
    t = job["title"].replace("'", "''")[:200]
    c = job["company"].replace("'", "''")[:200]
    loc = job["location"].replace("'", "''")[:200]
    d = job["description"][:5000].replace("'", "''")
    u = job["url"]
    sm = str(job["salary_min"]) if job.get("salary_min") else "NULL"
    sx = str(job["salary_max"]) if job.get("salary_max") else "NULL"
    ct = (job.get("contract_type") or "").replace("'", "''")
    cat = (job.get("category") or "").replace("'", "''")
    src = job.get("source", "unknown")
    pa = job.get("posted_at", "")
    tid = job["tenant_id"]
    dh = hashlib.md5(f"{t}|{c}|{u}".encode()).hexdigest()

    pa_sql = f"'{pa}'::timestamptz" if pa else "NULL"

    sql = (
        f"INSERT INTO jobs (tenant_id, title, company, location, url, source, "
        f"description, salary_min, salary_max, contract_type, category, posted_at, "
        f"status, dedup_hash) VALUES ('{tid}', '{t}', '{c}', '{loc}', '{u}', "
        f"'{src}', '{d}', {sm}, {sx}, '{ct}', '{cat}', {pa_sql}, 'new', '{dh}') "
        f"ON CONFLICT (dedup_hash) DO NOTHING;"
    )

    if DRY_RUN:
        print(f"  [DRY RUN] Would insert: {job['title']} at {job['company']}")
        return True

    result = db_exec(sql)
    return "INSERT 0 1" in result or result == ""


def is_relevant(tenant_id: str, title: str) -> bool:
    """Check if job title is relevant for this tenant."""
    filt = TENANT_FILTERS.get(tenant_id)
    if not filt:
        return True  # No filter = accept all
    # Check exclusions first
    if filt.get("exclude") and filt["exclude"].search(title):
        return False
    return bool(filt["patterns"].search(title))


# ── Adzuna Source ───────────────────────────────────────

def fetch_adzuna(config: dict) -> list:
    """Fetch jobs from Adzuna API."""
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": config["search_term"],
        "where": config["location"],
        "what_exclude": ADZUNA_EXCLUDE,
        "distance": "40",
        "salary_min": str(config["salary_min"]),
        "salary_include_unknown": "1",
        "results_per_page": "25",
        "sort_by": "date",
        "max_days_old": "14",
    }
    url = "https://api.adzuna.com/v1/api/jobs/gb/search/1?" + urllib.parse.urlencode(
        params
    )

    try:
        resp = urllib.request.urlopen(url, timeout=30, context=ssl_ctx)
        data = json.loads(resp.read())
    except Exception as e:
        print(f"  Adzuna API error: {e}")
        return []

    jobs = []
    for r in data.get("results", []):
        jobs.append(
            {
                "tenant_id": config["tenant_id"],
                "title": r.get("title", "").strip(),
                "company": r.get("company", {}).get("display_name", "Unknown").strip(),
                "location": r.get("location", {})
                .get("display_name", "UK")
                .replace(", United Kingdom", "")
                .strip(),
                "description": r.get("description", ""),
                "url": r.get("redirect_url", ""),
                "salary_min": round(r["salary_min"]) if r.get("salary_min") else None,
                "salary_max": round(r["salary_max"]) if r.get("salary_max") else None,
                "contract_type": r.get("contract_type", ""),
                "category": r.get("category", {}).get("label", ""),
                "posted_at": r.get("created", ""),
                "source": "adzuna",
            }
        )
    return jobs


# ── Reed Source ─────────────────────────────────────────

def fetch_reed(config: dict) -> list:
    """Fetch jobs from Reed API (Basic Auth, key as username)."""
    api_key = REED_API_KEY or ""
    if not api_key:
        return []

    params = {
        "keywords": config["search_term"],
        "locationName": config["location"],
        "distancefromlocation": "40",
        "minimumSalary": str(config["salary_min"]),
        "maximumSalary": str(config["salary_max"]),
        "resultsToTake": "25",
    }
    url = "https://www.reed.co.uk/api/1.0/search?" + urllib.parse.urlencode(params)

    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {auth}")

    try:
        resp = urllib.request.urlopen(req, timeout=30, context=ssl_ctx)
        data = json.loads(resp.read())
    except Exception as e:
        print(f"  Reed API error: {e}")
        return []

    jobs = []
    for r in data.get("results", []):
        jobs.append(
            {
                "tenant_id": config["tenant_id"],
                "title": r.get("jobTitle", "").strip(),
                "company": r.get("employerName", "Unknown").strip(),
                "location": r.get("locationName", "UK").strip(),
                "description": r.get("jobDescription", ""),
                "url": f"https://www.reed.co.uk/jobs/{r.get('jobId', '')}",
                "salary_min": round(r["minimumSalary"])
                if r.get("minimumSalary")
                else None,
                "salary_max": round(r["maximumSalary"])
                if r.get("maximumSalary")
                else None,
                "contract_type": r.get("contractType", ""),
                "category": "",
                "posted_at": r.get("date", ""),
                "source": "reed",
            }
        )
    return jobs


# ── RSS Source ──────────────────────────────────────────

# ── Greenhouse / Lever Sources (free JSON APIs, no auth) ──

# Target UK companies with L&D or tech roles on Greenhouse/Lever
# Format: (board_token, display_name, ats_type)
COMPANY_BOARDS = {
    "76f15f33-9a1e-4408-b718-676a313cce93": [  # Selvi - L&D
        # UK companies that may have L&D roles (verified Greenhouse boards)
        ("wpp", "WPP", "greenhouse"),          # 37 UK jobs, media/advertising
        ("monzo", "Monzo", "greenhouse"),       # 50 UK jobs, fintech
        ("skyscanner", "Skyscanner", "greenhouse"),  # 28 UK jobs, Edinburgh
        ("gymshark", "Gymshark", "greenhouse"), # 9 UK jobs, Birmingham
        ("gocardless", "GoCardless", "greenhouse"),  # 16 UK jobs, London
        ("hellofresh", "HelloFresh", "greenhouse"),  # 32 UK jobs
        ("ocadogroup", "Ocado Group", "greenhouse"), # 7 UK jobs
        ("ovoenergy", "OVO Energy", "greenhouse"),   # 2 UK jobs, Bristol
        ("graphcore", "Graphcore", "greenhouse"),     # 70 UK jobs, Bristol
        ("databricks", "Databricks", "greenhouse"),   # 46 UK jobs
    ],
    "48d629f3-1b10-4262-b50f-166176a82dc7": [  # Venkat - Tech
        ("stripe", "Stripe", "greenhouse"),      # 29 UK jobs
        ("figma", "Figma", "greenhouse"),         # 16 UK jobs
        ("datadog", "Datadog", "greenhouse"),     # 20 UK jobs
        ("vercel", "Vercel", "greenhouse"),       # 9 UK jobs
        ("twilio", "Twilio", "greenhouse"),       # 7 UK jobs
        ("monzo", "Monzo", "greenhouse"),         # 50 UK jobs
        ("deepmind", "Google DeepMind", "greenhouse"),  # 22 UK jobs
        ("wayve", "Wayve", "greenhouse"),         # 23 UK jobs
        ("databricks", "Databricks", "greenhouse"),  # 46 UK jobs
        ("graphcore", "Graphcore", "greenhouse"),    # 70 UK jobs
        ("skyscanner", "Skyscanner", "greenhouse"),  # 28 UK jobs
        ("gocardless", "GoCardless", "greenhouse"),  # 16 UK jobs
        ("tripactions", "Navan", "greenhouse"),      # 19 UK jobs
        ("form3", "Form3", "greenhouse"),            # 4 UK jobs
        ("truelayer", "TrueLayer", "greenhouse"),    # 4 UK jobs
        ("airtable", "Airtable", "greenhouse"),      # 8 UK jobs
    ],
}


def fetch_greenhouse(board_token: str, company_name: str, tenant_id: str) -> list:
    """Fetch jobs from Greenhouse public JSON API (free, no auth)."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs"
    try:
        resp = urllib.request.urlopen(url, timeout=15, context=ssl_ctx)
        data = json.loads(resp.read())
    except Exception as e:
        # 404 = company doesn't use Greenhouse, skip silently
        if "404" not in str(e):
            print(f"  Greenhouse error ({board_token}): {e}")
        return []

    jobs = []
    for r in data.get("jobs", []):
        loc = r.get("location", {}).get("name", "UK")
        # Only include UK-based roles
        if not any(
            kw in loc.lower()
            for kw in ["uk", "united kingdom", "london", "england", "remote", "berkshire", "reading"]
        ):
            continue

        jobs.append({
            "tenant_id": tenant_id,
            "title": r.get("title", "").strip(),
            "company": company_name,
            "location": loc,
            "description": "",
            "url": r.get("absolute_url", ""),
            "salary_min": None,
            "salary_max": None,
            "contract_type": "",
            "category": "",
            "posted_at": r.get("updated_at", ""),
            "source": "greenhouse",
        })
    return jobs


def fetch_lever(company: str, company_name: str, tenant_id: str) -> list:
    """Fetch jobs from Lever public JSON API (free, no auth)."""
    url = f"https://api.lever.co/v0/postings/{company}?mode=json"
    try:
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/json")
        resp = urllib.request.urlopen(req, timeout=15, context=ssl_ctx)
        data = json.loads(resp.read())
    except Exception as e:
        if "404" not in str(e):
            print(f"  Lever error ({company}): {e}")
        return []

    jobs = []
    for r in data if isinstance(data, list) else []:
        loc = r.get("categories", {}).get("location", "")
        if not any(
            kw in loc.lower()
            for kw in ["uk", "united kingdom", "london", "england", "remote", "berkshire"]
        ):
            continue

        jobs.append({
            "tenant_id": tenant_id,
            "title": r.get("text", "").strip(),
            "company": company_name,
            "location": loc,
            "description": r.get("descriptionPlain", "")[:5000],
            "url": r.get("hostedUrl", ""),
            "salary_min": None,
            "salary_max": None,
            "contract_type": r.get("categories", {}).get("commitment", ""),
            "category": r.get("categories", {}).get("team", ""),
            "posted_at": "",
            "source": "lever",
        })
    return jobs


# ── LinkedIn Source (public guest API) ──────────────────

def fetch_linkedin(config: dict) -> list:
    """Fetch jobs from LinkedIn's public guest job search API.
    No auth needed — this is the same data shown to logged-out users."""

    keywords = urllib.parse.quote(config["search_term"])
    location = urllib.parse.quote(config["location"])

    # LinkedIn public job search API (guest access, no login required)
    url = (
        f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?"
        f"keywords={keywords}&location={location}&f_TPR=r604800"  # last 7 days
        f"&start=0&count=25"
    )

    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    req.add_header("Accept", "text/html")

    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ssl_ctx)
        html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  LinkedIn fetch error: {e}")
        return []

    # Parse HTML — split by <li> tags, extract from each block
    jobs = []
    import html as html_mod

    items = re.split(r"<li>", html)

    for item in items[1:26]:  # Skip first (before first <li>), max 25
        title_match = re.search(
            r'base-search-card__title[^>]*>\s*\n?\s*(.+?)\s*\n?\s*</h3>',
            item, re.DOTALL,
        )
        company_match = re.search(
            r'hidden-nested-link[^>]*>\s*\n?\s*(.+?)\s*\n?\s*</a>',
            item, re.DOTALL,
        )
        location_match = re.search(
            r'job-search-card__location[^>]*>\s*\n?\s*(.+?)\s*\n?\s*</span>',
            item, re.DOTALL,
        )
        link_match = re.search(
            r'href="(https://[^"]*linkedin\.com/jobs/view/[^"?&]+)', item,
        )

        if not title_match:
            continue

        title = html_mod.unescape(title_match.group(1).strip())
        company = html_mod.unescape(company_match.group(1).strip()) if company_match else "Unknown"
        loc = html_mod.unescape(location_match.group(1).strip()) if location_match else config["location"]
        link = link_match.group(1) if link_match else ""

        jobs.append({
            "tenant_id": config["tenant_id"],
            "title": title,
            "company": company,
            "location": loc,
            "description": "",
            "url": link,
            "salary_min": None,
            "salary_max": None,
            "contract_type": "",
            "category": "",
            "posted_at": "",
            "source": "linkedin",
        })

    return jobs


# ── Firecrawl Source (TotalJobs + CV-Library) ───────────

FIRECRAWL_KEY = "fc-03df5ddce46244da9e5d5b926bcddb0a"

FIRECRAWL_URLS = {
    "76f15f33-9a1e-4408-b718-676a313cce93": [  # Selvi - L&D
        # CV-Library
        ("https://www.cv-library.co.uk/search-jobs?q=learning+and+development+manager&geo=Berkshire&distance=30", "cv-library"),
        ("https://www.cv-library.co.uk/search-jobs?q=head+of+learning+development&geo=London&distance=15", "cv-library"),
        ("https://www.cv-library.co.uk/search-jobs?q=L%26D+manager&geo=Berkshire&distance=30", "cv-library"),
        # NHS Jobs
        ("https://www.jobs.nhs.uk/candidate/search/results?keyword=learning+and+development&distance=50", "nhs-jobs"),
        ("https://www.jobs.nhs.uk/candidate/search/results?keyword=training+development+manager&distance=50", "nhs-jobs"),
        # CharityJob
        ("https://www.charityjob.co.uk/jobs/learning-and-development", "charityjob"),
        # Frazer Jones (specialist L&D recruiter)
        ("https://www.frazerjones.com/learning-and-development-jobs/", "frazerjones"),
        # Vodafone Workday
        ("https://opportunities.vodafone.com/search/?q=learning+development&locationsearch=United+Kingdom", "vodafone"),
        # Barclays
        ("https://search.jobs.barclays/search-jobs/learning%20development/United%20Kingdom/22144/1", "barclays"),
        # Unilever
        ("https://careers.unilever.com/search-jobs/learning%20and%20development/United%20Kingdom/34155/1", "unilever"),
        # Robert Half (specialist recruiter)
        ("https://www.roberthalf.com/gb/en/jobs?query=learning+and+development", "roberthalf"),
        # Michael Page
        ("https://www.michaelpage.co.uk/jobs/learning-and-development", "michaelpage"),
        # Hays
        ("https://www.hays.co.uk/jobs?q=learning+and+development", "hays"),
        # Civil Service Jobs
        ("https://www.civilservicejobs.service.gov.uk/csr/index.cgi?pageaction=searchbyquick&keyword=learning+and+development&searchpage=1", "civilservice"),
    ],
    "48d629f3-1b10-4262-b50f-166176a82dc7": [  # Venkat - Senior Eng Leadership
        # CV-Library
        ("https://www.cv-library.co.uk/search-jobs?q=CTO&geo=London&distance=15", "cv-library"),
        ("https://www.cv-library.co.uk/search-jobs?q=VP+engineering&geo=London&distance=15", "cv-library"),
        ("https://www.cv-library.co.uk/search-jobs?q=director+of+engineering&geo=London&distance=15", "cv-library"),
        # Vodafone
        ("https://opportunities.vodafone.com/search/?q=CTO&locationsearch=United+Kingdom", "vodafone"),
        ("https://opportunities.vodafone.com/search/?q=director+engineering&locationsearch=United+Kingdom", "vodafone"),
        # Barclays
        ("https://search.jobs.barclays/search-jobs/CTO/United%20Kingdom/22144/1", "barclays"),
        ("https://search.jobs.barclays/search-jobs/director%20engineering/United%20Kingdom/22144/1", "barclays"),
        # Unilever
        ("https://careers.unilever.com/search-jobs/director%20engineering/United%20Kingdom/34155/1", "unilever"),
        # Michael Page
        ("https://www.michaelpage.co.uk/jobs/cto", "michaelpage"),
        ("https://www.michaelpage.co.uk/jobs/vp-engineering", "michaelpage"),
        # Hays
        ("https://www.hays.co.uk/jobs?q=CTO", "hays"),
        ("https://www.hays.co.uk/jobs?q=director+of+engineering", "hays"),
    ],
}


def fetch_firecrawl(tenant_id: str) -> list:
    """Scrape job boards via Firecrawl API."""
    if not FIRECRAWL_KEY:
        return []

    urls = FIRECRAWL_URLS.get(tenant_id, [])
    all_jobs = []

    for url, source_name in urls:
        try:
            payload = json.dumps({
                "url": url,
                "formats": ["markdown"],
                "waitFor": 3000,
            }).encode()

            req = urllib.request.Request(
                "https://api.firecrawl.dev/v2/scrape",
                data=payload,
                method="POST",
            )
            req.add_header("Authorization", f"Bearer {FIRECRAWL_KEY}")
            req.add_header("Content-Type", "application/json")

            resp = urllib.request.urlopen(req, timeout=30, context=ssl_ctx)
            data = json.loads(resp.read())

            if not data.get("success"):
                continue

            md = data.get("data", {}).get("markdown", "")
            if not md:
                continue

            # Parse job titles from markdown — generic multi-site parser
            jobs_found = []

            # Try site-specific link patterns first, then fallback to bold text
            link_patterns = [
                r'\[([^\]]{10,100})\]\((https://www\.cv-library\.co\.uk/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.charityjob\.co\.uk/jobs/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.jobs\.nhs\.uk/candidate/jobadvert/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.frazerjones\.com/jobs/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://opportunities\.vodafone\.com/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://search\.jobs\.barclays/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.totaljobs\.com/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://careers\.unilever\.com/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.roberthalf\.com/gb/en/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.michaelpage\.co\.uk/jobs/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.hays\.co\.uk/job/[^\)]+)\)',
                r'\[([^\]]{10,100})\]\((https://www\.civilservicejobs\.service\.gov\.uk/[^\)]+)\)',
            ]

            for pattern in link_patterns:
                matches = re.findall(pattern, md)
                if matches:
                    for title, link in matches[:25]:
                        jobs_found.append({"title": title.strip(), "company": "Unknown", "url": link})
                    break

            # Fallback: bold text titles (NHS, Barclays use **Title** format)
            if not jobs_found:
                bolds = re.findall(r'\*\*([^\*]{15,100})\*\*', md)
                skip_words = ["search", "filter", "sign", "register", "cookie", "skip", "log in", "view all"]
                for b in bolds[:25]:
                    if any(s in b.lower() for s in skip_words):
                        continue
                    jobs_found.append({"title": b.strip(), "company": "Unknown", "url": ""})

            for j in jobs_found:
                all_jobs.append({
                    "tenant_id": tenant_id,
                    "title": j["title"],
                    "company": j["company"],
                    "location": "UK",
                    "description": "",
                    "url": j["url"],
                    "salary_min": None,
                    "salary_max": None,
                    "contract_type": "",
                    "category": "",
                    "posted_at": "",
                    "source": source_name,
                })

            time.sleep(2)  # Rate limit Firecrawl

        except Exception as e:
            print(f"  Firecrawl error ({url[:50]}...): {e}")

    return all_jobs


# ── Main ────────────────────────────────────────────────

def main():
    configs = get_search_configs()
    print(f"{datetime.now()}: Loaded {len(configs)} search configs")

    total_new = 0
    total_found = 0

    for config in configs:
        tenant_name = TENANT_FILTERS.get(config["tenant_id"], {}).get(
            "name", "Unknown"
        )

        # Adzuna
        if not SOURCE_FILTER or SOURCE_FILTER == "adzuna":
            jobs = fetch_adzuna(config)
            relevant = [j for j in jobs if is_relevant(config["tenant_id"], j["title"])]
            new = sum(1 for j in relevant if insert_job(j))
            total_found += len(jobs)
            total_new += new
            if jobs:
                print(
                    f"  [{tenant_name}] Adzuna '{config['search_term']}' in {config['location']}: "
                    f"{len(jobs)} found, {len(relevant)} relevant, {new} new"
                )
            time.sleep(1.5)

        # Reed
        if (not SOURCE_FILTER or SOURCE_FILTER == "reed") and REED_API_KEY:
            jobs = fetch_reed(config)
            relevant = [j for j in jobs if is_relevant(config["tenant_id"], j["title"])]
            new = sum(1 for j in relevant if insert_job(j))
            total_found += len(jobs)
            total_new += new
            if jobs:
                print(
                    f"  [{tenant_name}] Reed '{config['search_term']}' in {config['location']}: "
                    f"{len(jobs)} found, {len(relevant)} relevant, {new} new"
                )
            time.sleep(1.5)

        # LinkedIn
        if not SOURCE_FILTER or SOURCE_FILTER == "linkedin":
            jobs = fetch_linkedin(config)
            relevant = [j for j in jobs if is_relevant(config["tenant_id"], j["title"])]
            new = sum(1 for j in relevant if insert_job(j))
            total_found += len(jobs)
            total_new += new
            if jobs:
                print(
                    f"  [{tenant_name}] LinkedIn '{config['search_term']}' in {config['location']}: "
                    f"{len(jobs)} found, {len(relevant)} relevant, {new} new"
                )
            time.sleep(3)  # Be gentle with LinkedIn

    # Firecrawl scraping (TotalJobs, CV-Library)
    if not SOURCE_FILTER or SOURCE_FILTER in ("firecrawl", "totaljobs", "cv-library"):
        for tenant_id in TENANT_FILTERS:
            tenant_name = TENANT_FILTERS[tenant_id]["name"]
            jobs = fetch_firecrawl(tenant_id)
            relevant = [j for j in jobs if is_relevant(tenant_id, j["title"])]
            new = sum(1 for j in relevant if insert_job(j))
            total_found += len(jobs)
            total_new += new
            if jobs:
                print(
                    f"  [{tenant_name}] Firecrawl (TotalJobs+CV-Library): "
                    f"{len(jobs)} found, {len(relevant)} relevant, {new} new"
                )

    # Greenhouse / Lever company boards (not config-driven, runs once per tenant)
    if not SOURCE_FILTER or SOURCE_FILTER in ("greenhouse", "lever", "company"):
        for tenant_id in TENANT_FILTERS:
            tenant_name = TENANT_FILTERS[tenant_id]["name"]
            boards = COMPANY_BOARDS.get(tenant_id, [])
            for board_token, company_name, ats_type in boards:
                if ats_type == "greenhouse":
                    jobs = fetch_greenhouse(board_token, company_name, tenant_id)
                else:
                    jobs = fetch_lever(board_token, company_name, tenant_id)

                relevant = [j for j in jobs if is_relevant(tenant_id, j["title"])]
                new = sum(1 for j in relevant if insert_job(j))
                total_found += len(jobs)
                total_new += new
                if relevant:
                    print(
                        f"  [{tenant_name}] {ats_type.title()} {company_name}: "
                        f"{len(jobs)} UK jobs, {len(relevant)} relevant, {new} new"
                    )
                time.sleep(0.5)

    print(f"{datetime.now()}: Done. {total_found} found, {total_new} new jobs inserted.")

    # Send WhatsApp notifications for new jobs
    if total_new > 0 and not DRY_RUN:
        # Get new jobs per tenant (inserted in last 5 minutes)
        for tenant_id, filt in TENANT_FILTERS.items():
            recipient = WHATSAPP_RECIPIENTS.get(tenant_id)
            if not recipient:
                continue

            new_jobs_sql = (
                f"SELECT title, company, source FROM jobs "
                f"WHERE tenant_id = '{tenant_id}' "
                f"AND discovered_at > NOW() - INTERVAL '5 minutes' "
                f"ORDER BY discovered_at DESC LIMIT 10"
            )
            raw = db_exec(new_jobs_sql)
            if not raw.strip():
                continue

            lines = [l for l in raw.strip().split("\n") if l.strip()]
            if not lines:
                continue

            msg_lines = [f"🔔 {len(lines)} new {filt['name']} jobs found:\n"]
            for line in lines[:8]:
                parts = line.split("|")
                if len(parts) >= 2:
                    title = parts[0].strip()
                    company = parts[1].strip()
                    msg_lines.append(f"• {title} — {company}")

            if len(lines) > 8:
                msg_lines.append(f"\n+{len(lines) - 8} more")

            msg_lines.append(f"\n📋 View all: https://app.deploy.apiloom.io/dashboard/jobs")

            send_whatsapp(recipient, "\n".join(msg_lines))
            print(f"  WhatsApp sent to {filt['name']}: {len(lines)} new jobs")


if __name__ == "__main__":
    main()
