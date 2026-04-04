#!/usr/bin/env python3
"""
Multi-tenancy update for all n8n workflows.

For each workflow:
1. GET the full workflow JSON
2. Insert "Fetch Tenants" Postgres node after the Schedule Trigger
3. Insert "Loop Over Tenants" SplitInBatches node after Fetch Tenants
4. Rewire: Trigger -> Fetch Tenants -> Loop Over Tenants -> (original first node)
5. Add tenant_id filtering to all SQL queries
6. Replace hardcoded emails with tenant's notification_email
7. Wire the end of the workflow back to Loop Over Tenants for batch completion
8. PUT the updated workflow back
9. Save updated JSON locally
"""

import json
import os
import re
import sys
import copy
import time
import urllib.request
import urllib.error

API_BASE = "https://n8n.deploy.apiloom.io/api/v1"
API_KEY = os.environ.get("N8N_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDllNzdhZS00M2IzLTQyZGYtYmQ5ZC02ZTJhN2FhMjYwNzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzQ4ZjA5OWUtYmI4MC00MjliLTk4NGUtMWMyZjMwMzNiNWM3IiwiaWF0IjoxNzc1MTQ5MTM4LCJleHAiOjE4MDY2ODUxMzgyODl9.xoTHrzY6MZOAFm7E1z_ob-EK1rNvo-imbbPEkJkr7rY")
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
OUTPUT_DIR = "/Users/venkat/venkat-code/selvi-job-app/workflows"

# All workflows to update
WORKFLOWS = {
    # Module 4
    "RjELbd8jHpE0mYLy": "wf4-ghost-mt",
    "2jJ6mnhGDUUdMv4Q": "wf4-metrics-mt",
    "QYAJabWbPCEoCP5M": "wf4-notify-mt",
    "6waaDhblGVkSqQ7R": "wf4-report-mt",
    # Module 5
    "dMJ3vwd4x8LwkJfh": "wf5-ingest-mt",
    "Jmndt4AUM1okHmDV": "wf5-classify-mt",
    "OXkCaYer4oyRvpho": "wf5-extract-mt",
    "LDzddhyhIOlFBiq1": "wf5-notify-mt",
    # Module 6
    "c22XxluRJOWGj4RW": "wf6-prep-mt",
    "VGi4OAdRy3rOP2e9": "wf6-daily-mt",
    "u16sM5nWU7lggkqh": "wf6-followup-mt",
    # Module 7
    "mXpByVRapQef77PX": "wf7-content-mt",
    "KBKhzcxNN9yXcX21": "wf7-intel-mt",
    "htUY822cvSHeY6EW": "wf7-alignment-mt",
    # Module 3
    "uXGKRhtdMPq9LJbH": "wf-ap1-mt",
    # Module 1
    "1UpSvlEjPCdsZQsg": "wf1-rss-mt",
    "9SEqwV5wggAtEqh7": "wf2a-adzuna-mt",
    "wjHyL60WKQUKT5jR": "wf2b-reed-mt",
    "Lyn8XzHQpSz1hjYa": "wf5-scoring-mt",
    "Enk5MDTwxi0zHjzS": "wf6-dedup-mt",
    "zJHAtZgCWvj2IDTw": "wf7-digest-mt",
    # Module 2
    "yPheY04xrwGA8EVW": "wf8-cv-mt",
}

POSTGRES_CRED = {"id": "uAbCv6KI1KdUiMtX", "name": "Selvi Jobs DB"}

FETCH_TENANTS_NODE = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "SELECT id AS tenant_id, name AS tenant_name, "
            "notification_email, candidate_profile, "
            "search_config, email_config "
            "FROM tenants WHERE is_active = true"
        ),
        "options": {}
    },
    "id": "fetch_tenants",
    "name": "Fetch Active Tenants",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [200, 0],
    "credentials": {"postgres": POSTGRES_CRED}
}

LOOP_TENANTS_NODE = {
    "parameters": {
        "batchSize": 1,
        "options": {}
    },
    "id": "loop_tenants",
    "name": "Loop Over Tenants",
    "type": "n8n-nodes-base.splitInBatches",
    "typeVersion": 3,
    "position": [400, 0]
}

# Tables that have tenant_id column (for SQL injection)
TENANT_TABLES = [
    "jobs", "job_scores", "applications", "application_events",
    "notification_queue", "notification_log", "pipeline_metrics",
    "emails", "email_classifications", "email_extracted_data",
    "email_processing_queue", "interviews", "interview_prep",
    "interview_followups", "linkedin_posts", "linkedin_profile",
    "linkedin_intelligence", "cv_tailoring_queue", "cv_versions",
    "auto_apply_queue", "auto_apply_log",
    "search_configs", "rss_feeds"
]


def _request(url, method="GET", data=None):
    """Make an HTTP request using urllib."""
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    else:
        body = None
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in HEADERS.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body_text[:500]}")


def get_workflow(wf_id):
    """GET a workflow from n8n."""
    data, _ = _request(f"{API_BASE}/workflows/{wf_id}")
    return data


def put_workflow(wf_id, data):
    """PUT an updated workflow to n8n."""
    # Filter settings to only include known valid fields
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


def activate_workflow(wf_id):
    """Activate a workflow via POST /workflows/{id}/activate."""
    try:
        _, status = _request(f"{API_BASE}/workflows/{wf_id}/activate", method="POST")
        return status
    except Exception:
        try:
            # Fallback: PATCH the workflow with active=true
            _, status = _request(f"{API_BASE}/workflows/{wf_id}", method="PATCH", data={"active": True})
            return status
        except Exception as e2:
            return f"error: {e2}"


def find_trigger_node(nodes):
    """Find the schedule trigger node."""
    for n in nodes:
        t = n["type"].lower()
        if "scheduletrigger" in t or "schedule" in t.replace("-", "").replace("_", ""):
            return n
        if "trigger" in t and "manual" not in t and "webhook" not in t:
            return n
    # Fallback: look for common trigger names
    for n in nodes:
        name_lower = n["name"].lower()
        if any(kw in name_lower for kw in ["every", "daily", "weekly", "schedule", "am ", "pm ", "hour", "minute"]):
            return n
    return None


def find_first_node_after_trigger(trigger_name, connections):
    """Find the first node connected after the trigger."""
    if trigger_name in connections:
        main = connections[trigger_name].get("main", [[]])
        if main and main[0]:
            return main[0][0]["node"]
    return None


def find_terminal_nodes(nodes, connections):
    """Find nodes that have no outgoing connections (terminal nodes)."""
    connected_sources = set()
    for src in connections:
        connected_sources.add(src)

    node_names = {n["name"] for n in nodes}
    terminals = []
    for n in nodes:
        name = n["name"]
        if name not in connections:
            terminals.append(name)
        else:
            # Check if all outputs are empty
            main_outputs = connections[name].get("main", [])
            all_empty = all(len(output) == 0 for output in main_outputs)
            if all_empty:
                terminals.append(name)
    return terminals


def add_tenant_id_to_sql(query, table_hints=None):
    """
    Add tenant_id filtering to SQL queries.

    Handles:
    - SELECT ... FROM table WHERE ... -> adds AND tenant_id = ...
    - SELECT ... FROM table (no WHERE) -> adds WHERE tenant_id = ...
    - INSERT INTO table (...) -> adds tenant_id column and value
    - UPDATE table SET ... WHERE ... -> adds AND tenant_id = ...
    """
    if not query or not query.strip():
        return query

    # Skip if already has tenant_id
    if "tenant_id" in query.lower():
        return query

    q = query.strip()

    # The tenant_id expression for n8n
    tenant_expr = "{{ $('Loop Over Tenants').item.json.tenant_id }}"

    # Handle INSERT statements
    insert_match = re.search(
        r'(INSERT\s+INTO\s+\w+)\s*\(([^)]+)\)\s*(VALUES\s*\()([^)]+)\)',
        q, re.IGNORECASE | re.DOTALL
    )
    if insert_match:
        prefix = insert_match.group(1)
        cols = insert_match.group(2).strip()
        values_kw = insert_match.group(3)
        vals = insert_match.group(4).strip()
        new_cols = f"tenant_id, {cols}"
        new_vals = f"'{tenant_expr}', {vals}"
        q = q[:insert_match.start()] + f"{prefix} ({new_cols}) {values_kw}{new_vals})" + q[insert_match.end():]
        return q

    # Handle INSERT with subselect or ON CONFLICT
    insert_simple = re.search(
        r'(INSERT\s+INTO\s+(\w+)\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]*\))',
        q, re.IGNORECASE | re.DOTALL
    )

    # Handle SELECT/UPDATE/DELETE
    # Check if query has a WHERE clause
    # Use regex that's case-insensitive

    # For SELECT queries
    if re.match(r'\s*SELECT\b', q, re.IGNORECASE):
        # Check which tenant table is referenced
        has_tenant_table = False
        for table in TENANT_TABLES:
            if re.search(r'\b' + table + r'\b', q, re.IGNORECASE):
                has_tenant_table = True
                break

        if not has_tenant_table:
            return query

        # Find WHERE clause
        where_match = re.search(r'\bWHERE\b', q, re.IGNORECASE)
        if where_match:
            # Insert after WHERE
            pos = where_match.end()
            q = q[:pos] + f" tenant_id = '{tenant_expr}' AND" + q[pos:]
        else:
            # Find ORDER BY, GROUP BY, LIMIT, or end of query
            end_match = re.search(r'\b(ORDER\s+BY|GROUP\s+BY|LIMIT|HAVING|;)\b', q, re.IGNORECASE)
            if end_match:
                pos = end_match.start()
                q = q[:pos] + f" WHERE tenant_id = '{tenant_expr}' " + q[pos:]
            else:
                q = q.rstrip(';').rstrip() + f" WHERE tenant_id = '{tenant_expr}'"
        return q

    # For UPDATE queries
    if re.match(r'\s*UPDATE\b', q, re.IGNORECASE):
        has_tenant_table = False
        for table in TENANT_TABLES:
            if re.search(r'\b' + table + r'\b', q, re.IGNORECASE):
                has_tenant_table = True
                break
        if not has_tenant_table:
            return query

        where_match = re.search(r'\bWHERE\b', q, re.IGNORECASE)
        if where_match:
            pos = where_match.end()
            q = q[:pos] + f" tenant_id = '{tenant_expr}' AND" + q[pos:]
        else:
            q = q.rstrip(';').rstrip() + f" WHERE tenant_id = '{tenant_expr}'"
        return q

    # For DELETE queries
    if re.match(r'\s*DELETE\b', q, re.IGNORECASE):
        has_tenant_table = False
        for table in TENANT_TABLES:
            if re.search(r'\b' + table + r'\b', q, re.IGNORECASE):
                has_tenant_table = True
                break
        if not has_tenant_table:
            return query

        where_match = re.search(r'\bWHERE\b', q, re.IGNORECASE)
        if where_match:
            pos = where_match.end()
            q = q[:pos] + f" tenant_id = '{tenant_expr}' AND" + q[pos:]
        else:
            q = q.rstrip(';').rstrip() + f" WHERE tenant_id = '{tenant_expr}'"
        return q

    return query


def add_tenant_id_to_upsert_query(query):
    """Handle ON CONFLICT ... DO UPDATE type queries with tenant_id."""
    if "tenant_id" in query.lower():
        return query

    tenant_expr = "{{ $('Loop Over Tenants').item.json.tenant_id }}"

    # Pattern: INSERT INTO table (cols) VALUES (vals) ON CONFLICT ...
    # Need to add tenant_id to both columns and values
    insert_match = re.search(
        r'(INSERT\s+INTO\s+\w+\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]+)(\))',
        query, re.IGNORECASE | re.DOTALL
    )
    if insert_match:
        cols = insert_match.group(2).strip()
        vals = insert_match.group(4).strip()
        new_q = (
            insert_match.group(1) + f"tenant_id, {cols}" +
            insert_match.group(3) + f"'{tenant_expr}', {vals}" +
            insert_match.group(5)
        )
        # Reconstruct the rest of the query (ON CONFLICT etc)
        rest = query[insert_match.end():]
        return query[:insert_match.start()] + new_q + rest

    return query


def update_postgres_nodes(nodes, trigger_name):
    """Update all Postgres nodes to include tenant_id filtering."""
    for node in nodes:
        if node["type"] != "n8n-nodes-base.postgres":
            continue
        if node["name"] == "Fetch Active Tenants":
            continue

        params = node.get("parameters", {})

        # Handle executeQuery operation
        if params.get("operation") == "executeQuery" and "query" in params:
            query = params["query"]

            # Handle ON CONFLICT queries specially
            if "ON CONFLICT" in query.upper():
                params["query"] = add_tenant_id_to_upsert_query(query)
            else:
                params["query"] = add_tenant_id_to_sql(query)

        # Handle other operations (insert, update, etc.) that use table parameters
        # These are less common in this codebase since most use executeQuery


def update_code_nodes_for_tenant(nodes):
    """Update Code nodes to pass through tenant_id."""
    for node in nodes:
        if node["type"] != "n8n-nodes-base.code":
            continue

        params = node.get("parameters", {})
        code = params.get("jsCode", "")

        if not code:
            continue

        # If code processes items and outputs results, ensure tenant_id is carried through
        if "tenant_id" in code:
            continue

        # Add tenant_id passthrough to common patterns
        # Pattern: results.push({ json: { ...n, ... }})
        # Add tenant_id to the spread
        if "$input.all()" in code or "$input.first()" in code:
            # Add a comment about tenant awareness
            if "tenant_id" not in code:
                # Try to inject tenant_id into output items
                code = code.replace(
                    "const items = $input.all();",
                    "const items = $input.all();\nconst tenantId = items[0]?.json?.tenant_id || '';"
                )
                # For items that build new json objects, add tenant_id
                code = re.sub(
                    r'(results\.push\(\{\s*json:\s*\{)',
                    r'\1\n        tenant_id: tenantId,',
                    code
                )
                params["jsCode"] = code


def replace_hardcoded_emails(nodes):
    """Replace hardcoded chellamma.uk@gmail.com with tenant's notification_email."""
    tenant_email_expr = "{{ $('Loop Over Tenants').item.json.notification_email }}"

    for node in nodes:
        params = node.get("parameters", {})

        # Check HTTP Request nodes (Resend API calls)
        if node["type"] == "n8n-nodes-base.httpRequest":
            json_body = params.get("jsonBody", "")
            if "chellamma.uk@gmail.com" in json_body:
                json_body = json_body.replace(
                    "chellamma.uk@gmail.com",
                    tenant_email_expr
                )
                params["jsonBody"] = json_body

            # Also check URL patterns
            url = params.get("url", "")
            if "chellamma.uk@gmail.com" in url:
                params["url"] = url.replace("chellamma.uk@gmail.com", tenant_email_expr)

        # Check Postgres nodes for hardcoded emails in queries
        if node["type"] == "n8n-nodes-base.postgres":
            query = params.get("query", "")
            if "chellamma.uk@gmail.com" in query:
                params["query"] = query.replace(
                    "chellamma.uk@gmail.com",
                    tenant_email_expr
                )

        # Check Code nodes
        if node["type"] == "n8n-nodes-base.code":
            code = params.get("jsCode", "")
            if "chellamma.uk@gmail.com" in code:
                params["jsCode"] = code.replace(
                    "chellamma.uk@gmail.com",
                    "' + $('Loop Over Tenants').item.json.notification_email + '"
                )

        # Check any string parameters recursively
        raw = json.dumps(params)
        if "chellamma.uk@gmail.com" in raw and node["type"] not in [
            "n8n-nodes-base.httpRequest", "n8n-nodes-base.postgres", "n8n-nodes-base.code"
        ]:
            raw = raw.replace("chellamma.uk@gmail.com", tenant_email_expr)
            node["parameters"] = json.loads(raw)


def shift_positions(nodes, trigger_name, x_shift=400):
    """Shift all non-trigger nodes to the right to make room for tenant nodes."""
    trigger_pos = None
    for n in nodes:
        if n["name"] == trigger_name:
            trigger_pos = n["position"]
            break

    if not trigger_pos:
        return

    for n in nodes:
        if n["name"] == trigger_name:
            continue
        if n["name"] in ("Fetch Active Tenants", "Loop Over Tenants"):
            continue
        n["position"] = [n["position"][0] + x_shift, n["position"][1]]


def update_workflow(wf_id, output_name):
    """Main function to update a single workflow for multi-tenancy."""
    print(f"\n{'='*60}")
    print(f"Processing: {wf_id} ({output_name})")
    print(f"{'='*60}")

    # 1. GET the workflow
    wf = get_workflow(wf_id)
    name = wf["name"]
    nodes = wf["nodes"]
    connections = wf["connections"]

    print(f"  Name: {name}")
    print(f"  Nodes: {len(nodes)}")

    # 2. Find trigger node
    trigger = find_trigger_node(nodes)
    if not trigger:
        print(f"  ERROR: No trigger found, skipping")
        return False

    trigger_name = trigger["name"]
    print(f"  Trigger: {trigger_name}")

    # 3. Find the first node after trigger
    first_node = find_first_node_after_trigger(trigger_name, connections)
    if not first_node:
        print(f"  ERROR: No node after trigger, skipping")
        return False

    print(f"  First node after trigger: {first_node}")

    # Check if already updated
    node_names = [n["name"] for n in nodes]
    if "Fetch Active Tenants" in node_names:
        print(f"  Already has tenant fetch node, skipping structural changes")
        # Still update SQL queries and emails
        update_postgres_nodes(nodes, trigger_name)
        replace_hardcoded_emails(nodes)
    else:
        # 4. Shift existing nodes to make room
        shift_positions(nodes, trigger_name, x_shift=400)

        # 5. Create Fetch Tenants node positioned after trigger
        trigger_pos = trigger["position"]
        fetch_node = copy.deepcopy(FETCH_TENANTS_NODE)
        fetch_node["position"] = [trigger_pos[0] + 250, trigger_pos[1]]

        # 6. Create Loop Over Tenants node
        loop_node = copy.deepcopy(LOOP_TENANTS_NODE)
        loop_node["position"] = [trigger_pos[0] + 500, trigger_pos[1]]

        # 7. Add new nodes
        nodes.append(fetch_node)
        nodes.append(loop_node)

        # 8. Rewire connections
        # Remove trigger -> first_node connection
        if trigger_name in connections:
            connections[trigger_name]["main"] = [[
                {"node": "Fetch Active Tenants", "type": "main", "index": 0}
            ]]

        # Add Fetch Tenants -> Loop Over Tenants
        connections["Fetch Active Tenants"] = {
            "main": [[
                {"node": "Loop Over Tenants", "type": "main", "index": 0}
            ]]
        }

        # Loop Over Tenants has 2 outputs:
        # Output 0: "done" (batch complete) - leave empty or connect to nothing
        # Output 1: "loop" (current item) - connect to the original first node
        connections["Loop Over Tenants"] = {
            "main": [
                [],  # Output 0: done processing all batches
                [{"node": first_node, "type": "main", "index": 0}]  # Output 1: process this item
            ]
        }

        # 9. Find terminal nodes and wire them back to Loop Over Tenants
        terminals = find_terminal_nodes(nodes, connections)
        # Exclude the new nodes and trigger from terminals
        terminals = [t for t in terminals if t not in (
            "Fetch Active Tenants", "Loop Over Tenants", trigger_name
        )]

        print(f"  Terminal nodes: {terminals}")

        for term in terminals:
            if term not in connections:
                connections[term] = {"main": [[]]}

            main_outputs = connections[term]["main"]
            # Find an empty output to use, or add to existing
            connected_back = False
            for i, output in enumerate(main_outputs):
                if len(output) == 0:
                    output.append({"node": "Loop Over Tenants", "type": "main", "index": 0})
                    connected_back = True
                    break

            if not connected_back:
                # Add a new connection to Loop Over Tenants
                # For the last output that has connections, those connections stay,
                # and we add a parallel connection back to loop
                main_outputs.append([
                    {"node": "Loop Over Tenants", "type": "main", "index": 0}
                ])

        # 10. Update SQL queries in all Postgres nodes
        update_postgres_nodes(nodes, trigger_name)

        # 11. Replace hardcoded emails
        replace_hardcoded_emails(nodes)

        # 12. Update Code nodes to pass through tenant_id
        update_code_nodes_for_tenant(nodes)

    # 13. Update the workflow name to indicate multi-tenancy
    if "(MT)" not in wf["name"]:
        wf["name"] = wf["name"]  # Keep original name, don't add suffix

    # 14. Save locally
    output_path = os.path.join(OUTPUT_DIR, f"{output_name}.json")
    with open(output_path, "w") as f:
        json.dump(wf, f, indent=2)
    print(f"  Saved to: {output_path}")

    # 15. PUT back to n8n
    try:
        result = put_workflow(wf_id, wf)
        print(f"  Updated in n8n successfully")
    except Exception as e:
        print(f"  ERROR updating in n8n: {e}")
        return False

    # 16. Activate
    try:
        status = activate_workflow(wf_id)
        print(f"  Activation status: {status}")
    except Exception as e:
        print(f"  Activation error (non-fatal): {e}")

    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Process priority workflows first (email-sending ones)
    priority_order = [
        # Critical: these send emails and must use tenant email
        "QYAJabWbPCEoCP5M",  # WF4-NOTIFY
        "6waaDhblGVkSqQ7R",  # WF4-REPORT
        "zJHAtZgCWvj2IDTw",  # WF7 Daily Digest
        "LDzddhyhIOlFBiq1",  # WF5-NOTIFY
        "VGi4OAdRy3rOP2e9",  # WF6-DAILY
        "KBKhzcxNN9yXcX21",  # WF7-INTEL
        "htUY822cvSHeY6EW",  # WF7-ALIGNMENT
        "mXpByVRapQef77PX",  # WF7-CONTENT
        "c22XxluRJOWGj4RW",  # WF6-PREP
        "u16sM5nWU7lggkqh",  # WF6-FOLLOWUP
        "uXGKRhtdMPq9LJbH",  # WF-AP1
        "yPheY04xrwGA8EVW",  # WF8 CV
        # Module 4 remaining
        "RjELbd8jHpE0mYLy",  # WF4-GHOST
        "2jJ6mnhGDUUdMv4Q",  # WF4-METRICS
        # Module 5 remaining
        "dMJ3vwd4x8LwkJfh",  # WF5-INGEST
        "Jmndt4AUM1okHmDV",  # WF5-CLASSIFY
        "OXkCaYer4oyRvpho",  # WF5-EXTRACT
        # Module 1
        "1UpSvlEjPCdsZQsg",  # WF1 RSS
        "9SEqwV5wggAtEqh7",  # WF2a Adzuna
        "wjHyL60WKQUKT5jR",  # WF2b Reed
        "Lyn8XzHQpSz1hjYa",  # WF5 AI Scoring
        "Enk5MDTwxi0zHjzS",  # WF6 Dedup
    ]

    success = 0
    failed = 0

    for wf_id in priority_order:
        output_name = WORKFLOWS[wf_id]
        try:
            ok = update_workflow(wf_id, output_name)
            if ok:
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

        # Small delay to avoid rate limiting
        time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"SUMMARY: {success} updated, {failed} failed out of {len(priority_order)} workflows")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
