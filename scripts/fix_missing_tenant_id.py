#!/usr/bin/env python3
"""
Fix remaining SQL nodes that are missing tenant_id.
These are queries that the regex-based approach couldn't handle:
- INSERT ... SELECT subqueries
- CTEs (WITH ... AS)
- Tables not in the original TENANT_TABLES list
- Expression-based queries (={{ ... }})
"""

import json
import os
import urllib.request
import urllib.error
import time

API_BASE = "https://n8n.deploy.apiloom.io/api/v1"
API_KEY = os.environ.get("N8N_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDllNzdhZS00M2IzLTQyZGYtYmQ5ZC02ZTJhN2FhMjYwNzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzQ4ZjA5OWUtYmI4MC00MjliLTk4NGUtMWMyZjMwMzNiNWM3IiwiaWF0IjoxNzc1MTQ5MTM4LCJleHAiOjE4MDY2ODUxMzgyODl9.xoTHrzY6MZOAFm7E1z_ob-EK1rNvo-imbbPEkJkr7rY")
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
OUTPUT_DIR = "/Users/venkat/venkat-code/selvi-job-app/workflows"

T = "{{ $('Loop Over Tenants').item.json.tenant_id }}"


def _request(url, method="GET", data=None):
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    else:
        body = None
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in HEADERS.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.status


def get_wf(wf_id):
    data, _ = _request(f"{API_BASE}/workflows/{wf_id}")
    return data


def put_wf(wf_id, data):
    raw_settings = data.get("settings", {})
    valid_keys = {"executionOrder", "timezone", "callerPolicy", "saveManualExecutions",
                  "saveDataErrorExecution", "saveDataSuccessExecution",
                  "saveExecutionProgress", "executionTimeout", "errorWorkflow"}
    settings = {k: v for k, v in raw_settings.items() if k in valid_keys}
    body = {
        "name": data["name"],
        "nodes": data["nodes"],
        "connections": data["connections"],
        "settings": settings,
    }
    result, _ = _request(f"{API_BASE}/workflows/{wf_id}", method="PUT", data=body)
    return result


def activate_wf(wf_id):
    try:
        _, status = _request(f"{API_BASE}/workflows/{wf_id}/activate", method="POST")
        return status
    except Exception:
        return "error"


def find_node(nodes, name):
    for n in nodes:
        if n["name"] == name:
            return n
    return None


def fix_wf4_metrics(wf_id):
    """WF4-METRICS: INSERT INTO pipeline_metrics ... SELECT ... FROM applications
    These are INSERT ... SELECT subqueries - need tenant_id in both INSERT cols and SELECT WHERE."""
    wf = get_wf(wf_id)
    nodes = wf["nodes"]

    metric_nodes = [
        'Application Volume Metrics', 'Response Rate Metrics', 'Ghosting Rate Metrics',
        'Stage Velocity Metrics', 'Pipeline Depth Metrics', 'Source Effectiveness Metrics',
        'Document Performance Metrics', 'Funnel Conversion Metrics'
    ]

    for node_name in metric_nodes:
        node = find_node(nodes, node_name)
        if not node:
            continue
        q = node["parameters"]["query"]
        if "tenant_id" in q:
            continue

        # Pattern: INSERT INTO pipeline_metrics (cols) SELECT ... FROM applications ...
        # Add tenant_id to INSERT columns and to the SELECT list, plus WHERE clause
        q = q.replace(
            "INSERT INTO pipeline_metrics (metric_name, metric_value, dimensions, period_start, period_end, period_type)",
            f"INSERT INTO pipeline_metrics (tenant_id, metric_name, metric_value, dimensions, period_start, period_end, period_type)"
        )

        # Add tenant_id as first selected value after SELECT
        # The SELECT is a subquery, so we add tenant_id literal value
        import re
        # Find the SELECT after the INSERT
        q = re.sub(
            r'(INSERT INTO pipeline_metrics \([^)]+\)\s*\n?)SELECT ',
            rf'\1SELECT \'{T}\', ',
            q
        )

        # Add WHERE tenant_id clause to FROM applications
        if "FROM applications" in q and f"tenant_id = '{T}'" not in q:
            # If there's already a WHERE, add AND
            if "WHERE" in q.split("FROM applications")[1].split("FROM")[0] if "FROM" in q.split("FROM applications")[1] else q.split("FROM applications")[1]:
                q = q.replace("FROM applications\n", f"FROM applications\n")
                # More precise: find the WHERE after FROM applications
                parts = q.split("FROM applications")
                if len(parts) == 2:
                    rest = parts[1]
                    if "\nWHERE " in rest:
                        rest = rest.replace("\nWHERE ", f"\nWHERE tenant_id = '{T}' AND ", 1)
                    elif " WHERE " in rest:
                        rest = rest.replace(" WHERE ", f" WHERE tenant_id = '{T}' AND ", 1)
                    else:
                        # No WHERE, add one before GROUP BY or ORDER BY
                        for kw in ["\nGROUP BY", "\nORDER BY", "\nLIMIT", ";"]:
                            if kw in rest:
                                rest = rest.replace(kw, f"\nWHERE tenant_id = '{T}'" + kw, 1)
                                break
                        else:
                            rest = rest + f"\nWHERE tenant_id = '{T}'"
                    q = parts[0] + "FROM applications" + rest

        # Handle "Total Active Count" which may have different pattern
        node["parameters"]["query"] = q

    # Also handle DBS Data Cleanup node if needed
    dbs_node = find_node(nodes, "DBS Data Cleanup")
    if dbs_node:
        q = dbs_node["parameters"].get("query", "")
        if "tenant_id" not in q and "applications" in q.lower():
            # Add tenant_id filter
            if "WHERE" in q:
                q = q.replace("WHERE ", f"WHERE tenant_id = '{T}' AND ", 1)
            dbs_node["parameters"]["query"] = q

    # Also fix Total Active Count
    tac = find_node(nodes, "Total Active Count")
    if tac:
        q = tac["parameters"].get("query", "")
        if "tenant_id" not in q and "applications" in q.lower():
            if "WHERE" in q:
                q = q.replace("WHERE ", f"WHERE tenant_id = '{T}' AND ", 1)
            tac["parameters"]["query"] = q

    return wf


def fix_wf5_ingest(wf_id):
    """WF5-INGEST: Log Ingestion uses INSERT INTO email_processing_log ... SELECT"""
    wf = get_wf(wf_id)
    node = find_node(wf["nodes"], "Log Ingestion")
    if node:
        q = node["parameters"]["query"]
        if "tenant_id" not in q:
            # Add tenant_id to INSERT columns and SELECT
            q = q.replace(
                "INSERT INTO email_processing_log (email_id, workflow_name, step, status, details)",
                f"INSERT INTO email_processing_log (tenant_id, email_id, workflow_name, step, status, details)"
            )
            q = q.replace(
                "SELECT id, 'WF5-INGEST'",
                f"SELECT '{T}', id, 'WF5-INGEST'"
            )
            node["parameters"]["query"] = q
    return wf


def fix_wf5_notify(wf_id):
    """WF5-NOTIFY: Check Notifications Enabled queries system_config (global, no tenant needed).
    But let's add tenant awareness anyway for future-proofing."""
    wf = get_wf(wf_id)
    # system_config is a global table, not per-tenant. Skip this.
    # The verification script flags it because "notifications" matches our keyword list.
    # This is actually fine as-is.
    return wf


def fix_wf7_intel(wf_id):
    """WF7-INTEL: linkedin_messages, linkedin_connection_requests, linkedin_metrics, profile_cv_alignment"""
    wf = get_wf(wf_id)
    nodes = wf["nodes"]

    fixes = {
        "Q2 InMails": ("linkedin_messages", "WHERE"),
        "Q3 Connections": ("linkedin_connection_requests", "WHERE"),
        "Q6 Metrics": ("linkedin_metrics", "WHERE"),
        "Q7 Alignment": ("profile_cv_alignment", "WHERE"),
    }

    for node_name, (table, _) in fixes.items():
        node = find_node(nodes, node_name)
        if not node:
            continue
        q = node["parameters"]["query"]
        if "tenant_id" in q:
            continue

        # These are SELECT ... FROM table WHERE ... ORDER BY
        if "WHERE" in q:
            q = q.replace("WHERE ", f"WHERE tenant_id = '{T}' AND ", 1)
        else:
            q = q.replace(f"FROM {table} ", f"FROM {table} WHERE tenant_id = '{T}' ", 1)
        node["parameters"]["query"] = q

    return wf


def fix_wf7_alignment(wf_id):
    """WF7-ALIGNMENT: Load Recent CVs uses a fallback subquery."""
    wf = get_wf(wf_id)
    node = find_node(wf["nodes"], "Load Recent CVs")
    if node:
        q = node["parameters"]["query"]
        if "tenant_id" not in q:
            # This is a synthetic query with no real table. Add tenant_id to the fallback.
            # Actually for a fallback CTE, we don't need tenant_id. But let's check if
            # the real query references cv_versions or similar.
            # The query is: SELECT ... FROM (SELECT 'latest_cv' ...) fallback LIMIT 3
            # This is a static fallback - no real table to filter. Leave as-is but
            # add a comment that this is intentionally tenant-agnostic.
            pass
    return wf


def fix_wf_ap1(wf_id):
    """WF-AP1: Check System Paused queries application_config (global config, but should be per-tenant)."""
    wf = get_wf(wf_id)
    node = find_node(wf["nodes"], "Check System Paused")
    if node:
        q = node["parameters"]["query"]
        if "tenant_id" not in q:
            if "WHERE" in q:
                q = q.replace("WHERE ", f"WHERE tenant_id = '{T}' AND ", 1)
            node["parameters"]["query"] = q
    return wf


def fix_wf1_rss(wf_id):
    """WF1-RSS: Upsert Jobs uses INSERT ... SELECT ... WHERE NOT EXISTS."""
    wf = get_wf(wf_id)
    node = find_node(wf["nodes"], "Upsert Jobs")
    if node:
        q = node["parameters"]["query"]
        if "tenant_id" not in q:
            # INSERT INTO jobs (cols) SELECT ... WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE dedup_hash = ...)
            q = q.replace(
                "INSERT INTO jobs (title, company, location, salary_raw, description, url, posted_at, source_health, job_type, dedup_hash, status)",
                f"INSERT INTO jobs (tenant_id, title, company, location, salary_raw, description, url, posted_at, source_health, job_type, dedup_hash, status)"
            )
            q = q.replace(
                "SELECT $1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,'raw'",
                f"SELECT '{T}',$1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,'raw'"
            )
            # Also add tenant_id to the NOT EXISTS subquery
            q = q.replace(
                "WHERE dedup_hash = $10 AND is_duplicate = false",
                f"WHERE tenant_id = '{T}' AND dedup_hash = $10 AND is_duplicate = false"
            )
            node["parameters"]["query"] = q
    return wf


def fix_wf6_dedup(wf_id):
    """WF6-DEDUP: CTE with JOIN, UPDATE."""
    wf = get_wf(wf_id)
    node = find_node(wf["nodes"], "Exact Hash Dedup")
    if node:
        q = node["parameters"]["query"]
        if "tenant_id" not in q:
            # Add tenant_id filter to both the CTE and the UPDATE
            # CTE: ... WHERE a.is_duplicate = false AND b.is_duplicate = false
            q = q.replace(
                "WHERE a.is_duplicate = false AND b.is_duplicate = false",
                f"WHERE a.tenant_id = '{T}' AND b.tenant_id = '{T}' AND a.is_duplicate = false AND b.is_duplicate = false"
            )
            # UPDATE: ... WHERE jobs.id = dupes.dup_id
            q = q.replace(
                "WHERE jobs.id = dupes.dup_id",
                f"WHERE jobs.tenant_id = '{T}' AND jobs.id = dupes.dup_id"
            )
            node["parameters"]["query"] = q
    return wf


def fix_wf8_cv(wf_id):
    """WF8-CV: Expression-based queries with ={{ ... }}."""
    wf = get_wf(wf_id)

    # Save CV Package - dynamic SQL built with JS
    node = find_node(wf["nodes"], "Save CV Package")
    if node:
        q = node["parameters"].get("query", "")
        if "tenant_id" not in q and q.startswith("={{"):
            # This is a JS expression that builds SQL. Add tenant_id to the WHERE.
            # The pattern is: UPDATE cv_packages SET ... WHERE ...
            # We need to add AND tenant_id = '...' to the WHERE clause
            q = q.replace(
                "WHERE id = '",
                f"WHERE tenant_id = '{T}' AND id = '"
            )
            if "tenant_id" not in q:
                # Fallback: add it at the end before closing
                q = q.replace("+ \"';\" }}", f"+ \"' AND tenant_id = '{T}';\" }}")
            node["parameters"]["query"] = q

    # Update Job Status
    node = find_node(wf["nodes"], "Update Job Status")
    if node:
        q = node["parameters"].get("query", "")
        if "tenant_id" not in q:
            q = q.replace(
                "WHERE id = '",
                f"WHERE tenant_id = '{T}' AND id = '"
            )
            node["parameters"]["query"] = q

    return wf


# Map of workflow fixes
FIXES = {
    "2jJ6mnhGDUUdMv4Q": ("wf4-metrics-mt", fix_wf4_metrics),
    "dMJ3vwd4x8LwkJfh": ("wf5-ingest-mt", fix_wf5_ingest),
    "LDzddhyhIOlFBiq1": ("wf5-notify-mt", fix_wf5_notify),
    "KBKhzcxNN9yXcX21": ("wf7-intel-mt", fix_wf7_intel),
    "htUY822cvSHeY6EW": ("wf7-alignment-mt", fix_wf7_alignment),
    "uXGKRhtdMPq9LJbH": ("wf-ap1-mt", fix_wf_ap1),
    "1UpSvlEjPCdsZQsg": ("wf1-rss-mt", fix_wf1_rss),
    "Enk5MDTwxi0zHjzS": ("wf6-dedup-mt", fix_wf6_dedup),
    "yPheY04xrwGA8EVW": ("wf8-cv-mt", fix_wf8_cv),
}


def main():
    for wf_id, (output_name, fix_fn) in FIXES.items():
        print(f"\nFixing {wf_id} ({output_name})...")
        try:
            wf = fix_fn(wf_id)

            # Save locally
            output_path = os.path.join(OUTPUT_DIR, f"{output_name}.json")
            with open(output_path, "w") as f:
                json.dump(wf, f, indent=2)
            print(f"  Saved to {output_path}")

            # PUT back
            put_wf(wf_id, wf)
            print(f"  Updated in n8n")

            # Activate
            status = activate_wf(wf_id)
            print(f"  Activated: {status}")

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

        time.sleep(0.5)


if __name__ == "__main__":
    main()
