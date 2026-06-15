#!/bin/bash
# ============================================================
# PRODUCTION DEPLOYMENT SCRIPT - Invoice Management SaaS
# Target: Hostinger VPS - Ubuntu 24.04 - 187.127.180.252
# Run as: root on VPS
# Usage:  DOMAIN=yourdomain.com bash deploy.sh
# ============================================================

set -euo pipefail

# ── CONFIGURATION ─────────────────────────────────────────────
DOMAIN="${DOMAIN:-digitalviyabari.com}"
API_DOMAIN="api.${DOMAIN}"
REPO_URL="https://github.com/pranesh08052006/invoice_generator.git"
APP_DIR="/opt/invoice_app"
BACKUP_DIR="/opt/backups/mongodb"
DB_NAME="invoice_app_db"
DB_USER="invoice_user"
DB_PASS="$(openssl rand -base64 32 | tr -d '=+/' | head -c 24)"
SECRET_KEY="$(openssl rand -hex 64)"
BASE_URL="https://${API_DOMAIN}"

# ── COLORS ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ──────────────────────────────────────────────────────────────
# STEP 1 — SERVER AUDIT
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 1: SERVER AUDIT ==="
echo ""
echo "--- OS Info ---"
lsb_release -a 2>/dev/null || cat /etc/os-release
echo ""
echo "--- CPU ---"
nproc; grep "model name" /proc/cpuinfo | head -1
echo ""
echo "--- RAM ---"
free -h
echo ""
echo "--- Disk ---"
df -h /
echo ""
echo "--- Docker ---"
docker --version && docker compose version
echo ""
echo "--- Existing containers ---"
docker ps -a 2>/dev/null || echo "No containers"
echo ""
log_success "Audit complete"

# ──────────────────────────────────────────────────────────────
# STEP 2 — SYSTEM PACKAGES
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 2: SYSTEM PACKAGES ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget git ufw fail2ban nginx certbot python3-certbot-nginx \
    gnupg ca-certificates lsb-release software-properties-common \
    apt-transport-https openssl jq cron dnsutils

log_success "System packages installed"

# ──────────────────────────────────────────────────────────────
# STEP 3 — INSTALL MONGODB 7 (host-level, no container)
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 3: MONGODB INSTALLATION ==="

if ! command -v mongod &>/dev/null; then
    log_info "Installing MongoDB 7..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list

    apt-get update -qq
    apt-get install -y -qq mongodb-org

    systemctl enable mongod
    systemctl start mongod
    sleep 5
    log_success "MongoDB 7 installed"
else
    log_warn "MongoDB already installed — starting service"
    systemctl start mongod || true
    sleep 3
fi

# ──────────────────────────────────────────────────────────────
# STEP 4 — CONFIGURE MONGODB (auth + app user)
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 4: MONGODB CONFIGURATION ==="

# Only create users if auth not yet enabled
if ! grep -q "authorization: enabled" /etc/mongod.conf 2>/dev/null; then
    log_info "Setting up MongoDB users (auth not yet enabled)..."

    mongosh --quiet --eval "
use ${DB_NAME};
try {
  db.createUser({ user: '${DB_USER}', pwd: '${DB_PASS}',
    roles: [{ role: 'readWrite', db: '${DB_NAME}' }] });
  print('App user created');
} catch(e) { print('App user already exists: ' + e.message); }
" 2>/dev/null

    mongosh --quiet --eval "
use admin;
try {
  db.createUser({ user: 'mongoAdmin', pwd: '${DB_PASS}admin',
    roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }, 'readWriteAnyDatabase'] });
  print('Admin user created');
} catch(e) { print('Admin user already exists: ' + e.message); }
" 2>/dev/null

    # Secure mongod.conf
    cat > /etc/mongod.conf << 'MONGOCFG'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: enabled
MONGOCFG

    systemctl restart mongod
    sleep 5
    log_success "MongoDB auth enabled — bound to localhost only"
else
    log_warn "MongoDB auth already configured"
    # Load existing creds if file exists
    if [ -f /root/.invoice_credentials ]; then
        source /root/.invoice_credentials
        DB_PASS="${DB_PASS:-${DB_PASS}}"
    fi
fi

MONGO_URL="mongodb://${DB_USER}:${DB_PASS}@127.0.0.1:27017/${DB_NAME}?authSource=${DB_NAME}"

# ──────────────────────────────────────────────────────────────
# STEP 5 — PROJECT RETRIEVAL
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 5: PROJECT RETRIEVAL ==="

if [ -d "${APP_DIR}/.git" ]; then
    log_info "Repository exists — pulling latest..."
    cd "${APP_DIR}"
    git fetch origin main
    git reset --hard origin/main
    log_success "Code updated to latest"
else
    log_info "Cloning repository..."
    git clone --branch main "${REPO_URL}" "${APP_DIR}"
    log_success "Repository cloned"
fi

cd "${APP_DIR}"
log_info "Commit: $(git log --oneline -1)"

# ──────────────────────────────────────────────────────────────
# STEP 6 — PRODUCTION ENV FILE
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 6: ENVIRONMENT CONFIGURATION ==="

cat > "${APP_DIR}/.env.prod" << ENVEOF
# Auto-generated — $(date)
MONGO_URL=${MONGO_URL}
DATABASE_NAME=${DB_NAME}
BASE_URL=${BASE_URL}
SECRET_KEY=${SECRET_KEY}
DOMAIN=${DOMAIN}
API_DOMAIN=${API_DOMAIN}
ENVEOF

chmod 600 "${APP_DIR}/.env.prod"

# Save credentials for future reference
cat > /root/.invoice_credentials << CREDSEOF
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
MONGO_URL=${MONGO_URL}
SECRET_KEY=${SECRET_KEY}
DOMAIN=${DOMAIN}
CREDSEOF
chmod 600 /root/.invoice_credentials

log_success "Production .env written — credentials in /root/.invoice_credentials"

# ──────────────────────────────────────────────────────────────
# STEP 7 — DOCKER BUILD & DEPLOY
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 7: DOCKER BUILD & DEPLOY ==="

cd "${APP_DIR}"

# Graceful teardown
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Load env for compose
set -a; source .env.prod; set +a

# Build (VITE_API_URL is also passed via docker-compose build args)
log_info "Building images..."
docker compose -f docker-compose.prod.yml build --no-cache

# Start services
log_info "Starting containers..."
docker compose -f docker-compose.prod.yml up -d

log_success "Containers started"
sleep 15
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ──────────────────────────────────────────────────────────────
# STEP 8 — NGINX CONFIGURATION
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 8: NGINX CONFIGURATION ==="

cat > /etc/nginx/sites-available/invoice-app << NGINXEOF
# ── Rate limit zones ──────────────────────────────────────────
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;

# ── Frontend: ${DOMAIN} ───────────────────────────────────────
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1024;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}

# ── Backend API: ${API_DOMAIN} ────────────────────────────────
server {
    listen 80;
    server_name ${API_DOMAIN};

    client_max_body_size 50M;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting on API
    limit_req zone=api_limit burst=20 nodelay;

    # Stricter rate limit on login endpoint
    location /auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/invoice-app /etc/nginx/sites-enabled/invoice-app
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx
log_success "Nginx configured and started"

# ──────────────────────────────────────────────────────────────
# STEP 9 — SSL (Let's Encrypt)
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 9: SSL CERTIFICATES ==="

SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
DOMAIN_IP=$(dig +short "${DOMAIN}" 2>/dev/null | tail -1 || echo "unresolved")

log_info "Server IP: ${SERVER_IP} | Domain resolves to: ${DOMAIN_IP}"

if [ "${DOMAIN_IP}" = "${SERVER_IP}" ]; then
    log_info "DNS matches — issuing SSL certificates..."
    certbot --nginx \
        -d "${DOMAIN}" -d "www.${DOMAIN}" -d "${API_DOMAIN}" \
        --non-interactive --agree-tos \
        --email "admin@${DOMAIN}" \
        --redirect \
        --hsts \
        --staple-ocsp

    # Auto-renewal
    systemctl enable certbot.timer 2>/dev/null || {
        (crontab -l 2>/dev/null | grep -v certbot; \
         echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    }
    log_success "SSL issued and auto-renewal configured"
else
    log_warn "DNS not yet pointing to this server — SKIPPING SSL"
    log_warn ""
    log_warn "After updating DNS, run:"
    log_warn "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_DOMAIN} --redirect"
    log_warn ""
fi

# ──────────────────────────────────────────────────────────────
# STEP 10 — UFW FIREWALL
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 10: UFW FIREWALL ==="

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh      comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
# MongoDB port 27017 — NOT exposed
ufw --force enable

ufw status verbose
log_success "Firewall hardened"

# ──────────────────────────────────────────────────────────────
# STEP 11 — FAIL2BAN
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 11: FAIL2BAN ==="

cat > /etc/fail2ban/jail.local << 'F2BCFG'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
port    = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
action   = iptables-multiport[name=nginx-limit-req, port="http,https"]
logpath  = /var/log/nginx/error.log
maxretry = 10
F2BCFG

systemctl enable fail2ban
systemctl restart fail2ban
log_success "Fail2ban configured"

# ──────────────────────────────────────────────────────────────
# STEP 12 — BACKUP STRATEGY
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 12: AUTOMATED BACKUPS ==="

mkdir -p "${BACKUP_DIR}"/{daily,weekly,monthly}

cat > /usr/local/bin/invoice_backup.sh << BACKUPEOF
#!/bin/bash
# MongoDB Automated Backup — Invoice Management SaaS
BACKUP_ROOT="${BACKUP_DIR}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASS="${DB_PASS}"
DATE=\$(date +%Y%m%d_%H%M%S)
DAY=\$(date +%u)
DOM=\$(date +%d)

# Create daily backup
mkdir -p "\${BACKUP_ROOT}/daily"
mongodump \\
    --uri="mongodb://\${DB_USER}:\${DB_PASS}@127.0.0.1:27017/\${DB_NAME}?authSource=\${DB_NAME}" \\
    --out="\${BACKUP_ROOT}/daily/dump_\${DATE}" --quiet
tar -czf "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" \\
    -C "\${BACKUP_ROOT}/daily" "dump_\${DATE}"
rm -rf "\${BACKUP_ROOT}/daily/dump_\${DATE}"
echo "[OK] Daily backup: \${DATE}.tar.gz"

# Keep only 7 daily backups
ls -t "\${BACKUP_ROOT}/daily/"*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

# Weekly backup on Sunday (day 7)
if [ "\${DAY}" = "7" ]; then
    mkdir -p "\${BACKUP_ROOT}/weekly"
    cp "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" "\${BACKUP_ROOT}/weekly/week_\${DATE}.tar.gz"
    ls -t "\${BACKUP_ROOT}/weekly/"*.tar.gz 2>/dev/null | tail -n +5 | xargs -r rm -f
fi

# Monthly backup on 1st
if [ "\${DOM}" = "01" ]; then
    mkdir -p "\${BACKUP_ROOT}/monthly"
    cp "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" "\${BACKUP_ROOT}/monthly/month_\${DATE}.tar.gz"
    ls -t "\${BACKUP_ROOT}/monthly/"*.tar.gz 2>/dev/null | tail -n +13 | xargs -r rm -f
fi
BACKUPEOF

chmod +x /usr/local/bin/invoice_backup.sh

# Schedule: daily at 2:00 AM
(crontab -l 2>/dev/null | grep -v invoice_backup; \
 echo "0 2 * * * /usr/local/bin/invoice_backup.sh >> /var/log/invoice_backup.log 2>&1") | crontab -

log_success "Backup scheduled daily at 2 AM — stored in ${BACKUP_DIR}"

# ──────────────────────────────────────────────────────────────
# STEP 13 — SYSTEMD AUTO-RESTART
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 13: AUTO-RESTART (systemd) ==="

cat > /etc/systemd/system/invoice-app.service << SVCEOF
[Unit]
Description=Invoice Management SaaS (Docker Compose)
Requires=docker.service mongod.service
After=docker.service mongod.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env.prod
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=120
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable invoice-app.service
log_success "Systemd auto-restart enabled"

# ──────────────────────────────────────────────────────────────
# STEP 14 — VALIDATION
# ──────────────────────────────────────────────────────────────
log_info "=== STEP 14: VALIDATION ==="
sleep 10

echo ""
echo "── Container Status ──"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "── Backend Health Check ──"
BACKEND_STATUS=$(curl -sf http://127.0.0.1:8000/health 2>/dev/null && echo "PASS" || echo "FAIL")
echo "  /health → ${BACKEND_STATUS}"

echo ""
echo "── Frontend Health Check ──"
FRONTEND_STATUS=$(curl -sfo /dev/null http://127.0.0.1:3000/ 2>/dev/null && echo "PASS" || echo "FAIL")
echo "  / → ${FRONTEND_STATUS}"

echo ""
echo "── MongoDB Connectivity ──"
MONGO_STATUS=$(mongosh --quiet \
    "mongodb://${DB_USER}:${DB_PASS}@127.0.0.1:27017/${DB_NAME}?authSource=${DB_NAME}" \
    --eval "db.runCommand({ping:1}).ok" 2>/dev/null && echo "PASS" || echo "FAIL")
echo "  ping → ${MONGO_STATUS}"

echo ""
echo "── Nginx ──"
nginx -t 2>&1 | tail -2

echo ""
echo "════════════════════════════════════════════"
echo "   DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════"
echo ""
echo "  Frontend  : http://${DOMAIN}  (→ https after SSL)"
echo "  Backend   : http://${API_DOMAIN}  (→ https after SSL)"
echo "  MongoDB   : localhost:27017 (private)"
echo ""
echo "  App Dir   : ${APP_DIR}"
echo "  Backups   : ${BACKUP_DIR}"
echo "  Creds     : /root/.invoice_credentials"
echo ""
echo "  Logs:"
echo "    docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f"
echo "    tail -f /var/log/nginx/access.log"
echo "    tail -f /var/log/mongodb/mongod.log"
echo ""
if [ "${DOMAIN_IP}" != "${SERVER_IP}" ]; then
echo "  ⚠️  SSL PENDING — point DNS records to ${SERVER_IP} then run:"
echo "    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_DOMAIN} --redirect"
fi
echo "════════════════════════════════════════════"
