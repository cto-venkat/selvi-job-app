#!/bin/bash
# ============================================
# JobPilot - Fresh Server Setup Script
# Run this on a new Hetzner CAX31 (ARM64) server
# ============================================

set -e

echo "=========================================="
echo " JobPilot Fresh Server Setup"
echo "=========================================="

# --- Step 1: Install Dokploy ---
echo ""
echo "[1/7] Installing Dokploy..."
curl -sSL https://dokploy.com/install.sh | sh
echo "Dokploy installed. Access at https://YOUR_SERVER_IP:3000"
echo "Complete the initial setup in the browser first, then continue."
echo ""
echo "Press ENTER after Dokploy initial setup is complete..."
read -r

# --- Step 2: Install Docker Compose plugin (if not already) ---
echo "[2/7] Ensuring Docker Compose is available..."
docker compose version || {
  echo "Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
}

# --- Step 3: Clone the repo ---
echo "[3/7] Cloning JobPilot repository..."
mkdir -p /opt/jobpilot
cd /opt/jobpilot
git clone https://github.com/cto-venkat/selvi-job-app.git .

# --- Step 4: Create docker-compose.yml ---
echo "[4/7] Creating Docker Compose configuration..."
cat > docker-compose.yml << 'COMPOSE_EOF'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=n8n-postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=ZW6s8PJEQHMyLIHYC5dGLKXKuJZNwnqW
      - N8N_ENCRYPTION_KEY=KvnA7adFznlc4HGaPQtXuQ2pTmP4N9a/J+zYStnEJhk=
      - N8N_HOST=${N8N_DOMAIN:-n8n.yourdomain.com}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_DOMAIN:-n8n.yourdomain.com}/
      - N8N_SECURE_COOKIE=true
      - GENERIC_TIMEZONE=Europe/London
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      n8n-postgres:
        condition: service_healthy

  n8n-postgres:
    image: postgres:16-alpine
    restart: always
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=ZW6s8PJEQHMyLIHYC5dGLKXKuJZNwnqW
      - POSTGRES_DB=n8n
    volumes:
      - n8n_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 5s
      timeout: 5s
      retries: 10

  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgres://n8n:ZW6s8PJEQHMyLIHYC5dGLKXKuJZNwnqW@n8n-postgres:5432/selvi_jobs
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_d2VsY29tZS11bmljb3JuLTkyLmNsZXJrLmFjY291bnRzLmRldiQ
      - CLERK_SECRET_KEY=sk_test_MJ4AuEaayUPtaerHscpMXymn0ok5GHSBSFRuxLRiZr
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
    depends_on:
      - n8n-postgres

volumes:
  n8n_data:
  n8n_postgres_data:
COMPOSE_EOF

# --- Step 5: Start services ---
echo "[5/7] Starting all services..."
docker compose up -d --build

echo "Waiting for Postgres to be healthy..."
sleep 15

# --- Step 6: Create selvi_jobs database and run migrations ---
echo "[6/7] Setting up database..."

# Create selvi_jobs database
docker compose exec n8n-postgres psql -U n8n -c "CREATE DATABASE selvi_jobs;" 2>/dev/null || echo "Database may already exist"

# Run all SQL migrations
echo "Running migrations..."
for sqlfile in sql/m3_auto_apply_tables.sql sql/m4_application_tracker_tables.sql sql/m5_email_management_tables.sql sql/m6_interview_tables.sql sql/m7_linkedin_intelligence.sql sql/module4_schema.sql; do
  if [ -f "$sqlfile" ]; then
    echo "  Running $sqlfile..."
    # Remove dollar-quoted functions (they cause issues with psql -c)
    # Run the file directly instead
    docker compose exec -T n8n-postgres psql -U n8n -d selvi_jobs < "$sqlfile" 2>&1 | tail -1
  fi
done

# Run multi-tenant migration
echo "Running multi-tenant migration..."
docker compose exec -T n8n-postgres psql -U n8n -d selvi_jobs << 'MIGRATION_EOF'
-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(500) NOT NULL UNIQUE,
    notification_email VARCHAR(500),
    gmail_credential_id VARCHAR(200),
    candidate_profile JSONB DEFAULT '{}',
    search_config JSONB DEFAULT '{}',
    email_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(200) UNIQUE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(500) NOT NULL,
    display_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tenant_config table
CREATE TABLE IF NOT EXISTS tenant_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    config_key VARCHAR(200) NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, config_key)
);

-- Seed Selvi
INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
VALUES (
    'Selvi Kumar', 'selvi', 'chellamma.uk@gmail.com', 'chellamma.uk@gmail.com',
    '{"full_name": "Selvi Kumar", "city": "Maidenhead", "county": "Berkshire", "country": "United Kingdom", "expected_salary": "GBP 70,000 - 80,000", "current_title": "L&D Consultant"}'::jsonb,
    '{"keywords": ["learning development", "L&D manager"], "location": "Maidenhead, Berkshire", "salary_min": 70000, "salary_max": 80000}'::jsonb,
    '{"from_name": "Selvi Kumar", "from_email": "jobs@apiloom.io", "reply_to": "chellamma.uk@gmail.com"}'::jsonb,
    true
) ON CONFLICT (slug) DO NOTHING;

-- Seed Venkat
INSERT INTO tenants (name, slug, email, notification_email, candidate_profile, search_config, email_config, is_active)
VALUES (
    'Venkat Ramachandran', 'venkat', 'venkat.fts@gmail.com', 'venkat.fts@gmail.com',
    '{"full_name": "Venkat Ramachandran", "city": "London", "country": "United Kingdom"}'::jsonb,
    '{"keywords": ["software engineer", "tech lead"], "location": "London, UK", "salary_min": 90000, "salary_max": 130000}'::jsonb,
    '{"from_name": "Venkat Ramachandran", "from_email": "jobs@apiloom.io", "reply_to": "venkat.fts@gmail.com"}'::jsonb,
    true
) ON CONFLICT (slug) DO NOTHING;

SELECT 'Migration complete. Tenants:' AS status;
SELECT name, slug, email FROM tenants;
MIGRATION_EOF

# --- Step 7: Import n8n workflows ---
echo "[7/7] Importing n8n workflows..."
echo "Waiting for n8n to start..."
sleep 30

# Login to n8n and get session
echo "Please complete n8n setup at https://YOUR_SERVER_IP:5678"
echo "Then create an API key at Settings > API > Create API Key"
echo ""
echo "Enter your n8n API key:"
read -r N8N_API_KEY

N8N_URL="http://localhost:5678"

# Import each workflow
for wf in workflows/*-mt.json; do
  if [ -f "$wf" ]; then
    NAME=$(python3 -c "import json; print(json.load(open('$wf')).get('name','unknown'))" 2>/dev/null || echo "$wf")
    RESULT=$(curl -s -X POST "$N8N_URL/api/v1/workflows" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$wf" 2>&1)
    ID=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null || echo "FAILED")
    echo "  Imported: $NAME -> $ID"

    # Activate
    if [ "$ID" != "FAILED" ]; then
      curl -s -X POST "$N8N_URL/api/v1/workflows/$ID/activate" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" > /dev/null 2>&1
    fi
  fi
done

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  n8n:       http://YOUR_SERVER_IP:5678"
echo "  Dashboard: http://YOUR_SERVER_IP:3001"
echo "  Postgres:  YOUR_SERVER_IP:5433"
echo ""
echo "Next steps:"
echo "  1. Point your domains to the server IP in DNS"
echo "  2. Configure domains in Dokploy for HTTPS"
echo "  3. Set up Gmail OAuth in n8n for email monitoring"
echo "  4. Configure Clerk webhook for user sync"
echo ""
