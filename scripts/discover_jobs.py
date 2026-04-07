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
    "48d629f3-1b10-4262-b50f-166176a82dc7": {  # Venkat - Tech
        "name": "Venkat",
        "patterns": re.compile(
            r"software|engineer|developer|tech lead|CTO|architect|"
            r"devops|SRE|platform|backend|frontend|full.stack|"
            r"engineering manager|technical lead",
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

# RSS feeds for large UK employers with L&D roles
RSS_FEEDS = {
    "76f15f33-9a1e-4408-b718-676a313cce93": [  # Selvi
        # Greenhouse boards (common for UK companies)
        "https://boards.greenhouse.io/embed/job_board?for=vodafone&content=rss",
        "https://boards.greenhouse.io/embed/job_board?for=bbc&content=rss",
        # Add more company RSS feeds here
    ],
    "48d629f3-1b10-4262-b50f-166176a82dc7": [  # Venkat
        # Tech company feeds
    ],
}


def fetch_rss(tenant_id: str) -> list:
    """Fetch jobs from RSS feeds."""
    feeds = RSS_FEEDS.get(tenant_id, [])
    if not feeds:
        return []

    jobs = []
    for feed_url in feeds:
        try:
            resp = urllib.request.urlopen(feed_url, timeout=15, context=ssl_ctx)
            xml_data = resp.read()
            root = ET.fromstring(xml_data)

            # Handle both RSS and Atom formats
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "").strip()
                pubdate = (item.findtext("pubDate") or "").strip()
                company = feed_url.split("for=")[-1].split("&")[0] if "for=" in feed_url else "Unknown"

                jobs.append(
                    {
                        "tenant_id": tenant_id,
                        "title": title,
                        "company": company.title(),
                        "location": "UK",
                        "description": desc,
                        "url": link,
                        "salary_min": None,
                        "salary_max": None,
                        "contract_type": "",
                        "category": "",
                        "posted_at": pubdate,
                        "source": "rss",
                    }
                )
        except Exception as e:
            print(f"  RSS error ({feed_url[:50]}...): {e}")

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

    # Parse the HTML response — LinkedIn returns job cards as HTML
    jobs = []
    # Each job card has class "base-card"
    import re as re_mod
    cards = re_mod.findall(
        r'<div class="base-card[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>',
        html,
        re_mod.DOTALL,
    )

    for card in cards[:25]:
        title_match = re_mod.search(r'class="base-search-card__title"[^>]*>([^<]+)', card)
        company_match = re_mod.search(r'class="base-search-card__subtitle"[^>]*>.*?<a[^>]*>([^<]+)', card, re_mod.DOTALL)
        location_match = re_mod.search(r'class="job-search-card__location"[^>]*>([^<]+)', card)
        link_match = re_mod.search(r'href="(https://www\.linkedin\.com/jobs/view/[^"?]+)', card)

        if not title_match:
            continue

        title = title_match.group(1).strip()
        company = company_match.group(1).strip() if company_match else "Unknown"
        loc = location_match.group(1).strip() if location_match else config["location"]
        link = link_match.group(1) if link_match else ""

        jobs.append({
            "tenant_id": config["tenant_id"],
            "title": title,
            "company": company,
            "location": loc,
            "description": "",  # LinkedIn doesn't include description in list view
            "url": link,
            "salary_min": None,
            "salary_max": None,
            "contract_type": "",
            "category": "",
            "posted_at": "",
            "source": "linkedin",
        })

    return jobs


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

    # RSS feeds (not config-driven, runs once per tenant)
    if not SOURCE_FILTER or SOURCE_FILTER == "rss":
        for tenant_id in TENANT_FILTERS:
            tenant_name = TENANT_FILTERS[tenant_id]["name"]
            jobs = fetch_rss(tenant_id)
            relevant = [j for j in jobs if is_relevant(tenant_id, j["title"])]
            new = sum(1 for j in relevant if insert_job(j))
            total_found += len(jobs)
            total_new += new
            if jobs:
                print(f"  [{tenant_name}] RSS: {len(jobs)} found, {len(relevant)} relevant, {new} new")

    print(f"{datetime.now()}: Done. {total_found} found, {total_new} new jobs inserted.")


if __name__ == "__main__":
    main()
