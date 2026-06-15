#!/bin/bash
# ============================================================
# PRODUCTION DEPLOYMENT - Invoice Management SaaS
# Server: Hostinger VPS 187.127.180.252 (IP-based, no domain)
# Run as: root on the VPS
# ============================================================

set -euo pipefail

# ── CONFIGURATION ──────────────────────────────────────────
SERVER_IP="187.127.180.252"
REPO_URL="https://github.com/pranesh08052006/invoice_generator.git"
APP_DIR="/opt/invoice_app"
BACKUP_DIR="/opt/backups/mongodb"
DB_NAME="invoice_app_db"
DB_USER="invoice_user"
DB_PASS="$(openssl rand -hex 16)"
SECRET_KEY="$(openssl rand -hex 64)"
BASE_URL="http://${SERVER_IP}:8000"
FRONTEND_URL="http://${SERVER_IP}"

# ── COLORS ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }

# ──────────────────────────────────────────────────────────
# STEP 1 — SERVER AUDIT
# ──────────────────────────────────────────────────────────
log_info "=== STEP 1: SERVER AUDIT ==="
echo "OS:      $(lsb_release -ds 2>/dev/null || uname -a)"
echo "CPU:     $(nproc) cores"
echo "RAM:     $(free -h | awk '/^Mem:/{print $2}')"
echo "Disk:    $(df -h / | awk 'NR==2{print $4}') free"
echo "Docker:  $(docker --version 2>/dev/null || echo 'not found')"
echo "Compose: $(docker compose version 2>/dev/null || echo 'not found')"
echo ""

# ──────────────────────────────────────────────────────────
# STEP 2 — SYSTEM PACKAGES
# ──────────────────────────────────────────────────────────
log_info "=== STEP 2: SYSTEM PACKAGES ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget git ufw fail2ban nginx \
    gnupg ca-certificates lsb-release \
    apt-transport-https openssl jq cron
log_success "System packages ready"

# ──────────────────────────────────────────────────────────
# STEP 3 — INSTALL MONGODB 7
# ──────────────────────────────────────────────────────────
log_info "=== STEP 3: MONGODB ==="

if ! command -v mongod &>/dev/null; then
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
    log_success "MongoDB 7 installed and started"
else
    log_warn "MongoDB already installed"
    systemctl start mongod 2>/dev/null || true
    sleep 3
fi

# ──────────────────────────────────────────────────────────
# STEP 4 — MONGODB AUTH & USER SETUP
# ──────────────────────────────────────────────────────────
log_info "=== STEP 4: MONGODB AUTH ==="

if ! grep -q "authorization: enabled" /etc/mongod.conf 2>/dev/null; then
    log_info "Creating MongoDB users..."

    mongosh --quiet --eval "
use ${DB_NAME};
try {
  db.createUser({
    user: '${DB_USER}',
    pwd:  '${DB_PASS}',
    roles: [{ role: 'readWrite', db: '${DB_NAME}' }]
  });
  print('App DB user created');
} catch(e) { print('User exists: ' + e.message); }
" 2>/dev/null

    # Harden mongod.conf — bind localhost + docker bridge + enable auth
    # Get docker bridge gateway (containers connect via this IP)
    DOCKER_GW=$(docker network inspect bridge --format='{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || echo "172.17.0.1")

    cat > /etc/mongod.conf << MONGOCFG
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1,${DOCKER_GW}
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: enabled
MONGOCFG

    systemctl restart mongod
    sleep 5
    log_success "MongoDB auth enabled (localhost only)"
else
    log_warn "MongoDB auth already configured — loading existing credentials"
    if [ -f /root/.invoice_credentials ]; then
        # shellcheck disable=SC1091
        source /root/.invoice_credentials
    fi
fi

MONGO_URL="mongodb://${DB_USER}:${DB_PASS}@host.docker.internal:27017/${DB_NAME}?authSource=${DB_NAME}"

# ──────────────────────────────────────────────────────────
# STEP 5 — PROJECT RETRIEVAL
# ──────────────────────────────────────────────────────────
log_info "=== STEP 5: PROJECT RETRIEVAL ==="

if [ -d "${APP_DIR}/.git" ]; then
    log_info "Repo exists — pulling latest..."
    cd "${APP_DIR}"
    git fetch origin main
    git reset --hard origin/main
else
    log_info "Cloning repository..."
    git clone --branch main "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
log_success "Code: $(git log --oneline -1)"

# ──────────────────────────────────────────────────────────
# STEP 6 — PRODUCTION ENV
# ──────────────────────────────────────────────────────────
log_info "=== STEP 6: ENVIRONMENT FILE ==="

cat > "${APP_DIR}/.env.prod" << ENVEOF
# Generated $(date)
MONGO_URL=${MONGO_URL}
DATABASE_NAME=${DB_NAME}
BASE_URL=${BASE_URL}
SECRET_KEY=${SECRET_KEY}
ENVEOF

chmod 600 "${APP_DIR}/.env.prod"

# Save for future reference
cat > /root/.invoice_credentials << CREDSEOF
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
MONGO_URL=${MONGO_URL}
SECRET_KEY=${SECRET_KEY}
SERVER_IP=${SERVER_IP}
CREDSEOF
chmod 600 /root/.invoice_credentials

log_success "Credentials saved to /root/.invoice_credentials"

# ──────────────────────────────────────────────────────────
# STEP 7 — DOCKER BUILD & START
# ──────────────────────────────────────────────────────────
log_info "=== STEP 7: DOCKER CONTAINERS ==="

cd "${APP_DIR}"

# Stop old containers
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Load env
set -a; source .env.prod; set +a

# Build both images (VITE_API_URL injected at build time)
log_info "Building Docker images (this takes a few minutes)..."
docker compose -f docker-compose.prod.yml build \
    --build-arg VITE_API_URL="${BASE_URL}" \
    --no-cache

# Start
log_info "Starting containers..."
docker compose -f docker-compose.prod.yml up -d

log_success "Containers started"
sleep 15
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ──────────────────────────────────────────────────────────
# STEP 8 — NGINX (reverse proxy on port 80)
# ──────────────────────────────────────────────────────────
log_info "=== STEP 8: NGINX ==="

cat > /etc/nginx/sites-available/invoice-app << NGINXEOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80 default_server;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;

    client_max_body_size 50M;

    # Frontend SPA
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_read_timeout 60s;
    }

    # Backend API at /api/*
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;

        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }

    # Stricter rate limit on login
    location /api/auth/login {
        rewrite ^/api/(.*) /\$1 break;
        limit_req zone=login burst=5 nodelay;
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/invoice-app /etc/nginx/sites-enabled/invoice-app
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx
log_success "Nginx running on port 80"

# ──────────────────────────────────────────────────────────
# STEP 9 — UFW FIREWALL
# ──────────────────────────────────────────────────────────
log_info "=== STEP 9: FIREWALL ==="

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh    comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Nginx)'
ufw allow 8000/tcp comment 'Backend API direct'
# MongoDB 27017 — NOT exposed publicly
ufw --force enable
ufw status
log_success "Firewall configured"

# ──────────────────────────────────────────────────────────
# STEP 10 — FAIL2BAN
# ──────────────────────────────────────────────────────────
log_info "=== STEP 10: FAIL2BAN ==="

cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled  = true
maxretry = 3
F2B

systemctl enable fail2ban
systemctl restart fail2ban
log_success "Fail2ban configured"

# ──────────────────────────────────────────────────────────
# STEP 11 — AUTOMATED BACKUPS
# ──────────────────────────────────────────────────────────
log_info "=== STEP 11: BACKUPS ==="

mkdir -p "${BACKUP_DIR}"/{daily,weekly,monthly}

cat > /usr/local/bin/invoice_backup.sh << BACKUPEOF
#!/bin/bash
BACKUP_ROOT="${BACKUP_DIR}"
DATE=\$(date +%Y%m%d_%H%M%S)
DAY=\$(date +%u)
DOM=\$(date +%d)

mongodump \
    --uri="mongodb://${DB_USER}:${DB_PASS}@127.0.0.1:27017/${DB_NAME}?authSource=${DB_NAME}" \
    --out="\${BACKUP_ROOT}/daily/dump_\${DATE}" --quiet

tar -czf "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" \
    -C "\${BACKUP_ROOT}/daily" "dump_\${DATE}"
rm -rf "\${BACKUP_ROOT}/daily/dump_\${DATE}"
echo "[OK] Daily backup: \${DATE}"

ls -t "\${BACKUP_ROOT}/daily/"*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

[ "\${DAY}" = "7"  ] && { cp "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" "\${BACKUP_ROOT}/weekly/"; ls -t "\${BACKUP_ROOT}/weekly/"*.tar.gz | tail -n +5 | xargs -r rm -f; }
[ "\${DOM}" = "01" ] && { cp "\${BACKUP_ROOT}/daily/\${DATE}.tar.gz" "\${BACKUP_ROOT}/monthly/"; ls -t "\${BACKUP_ROOT}/monthly/"*.tar.gz | tail -n +13 | xargs -r rm -f; }
BACKUPEOF

chmod +x /usr/local/bin/invoice_backup.sh
(crontab -l 2>/dev/null | grep -v invoice_backup; \
 echo "0 2 * * * /usr/local/bin/invoice_backup.sh >> /var/log/invoice_backup.log 2>&1") | crontab -
log_success "Backups scheduled (daily at 2 AM)"

# ──────────────────────────────────────────────────────────
# STEP 12 — SYSTEMD AUTO-RESTART ON REBOOT
# ──────────────────────────────────────────────────────────
log_info "=== STEP 12: AUTO-RESTART ==="

cat > /etc/systemd/system/invoice-app.service << SVCEOF
[Unit]
Description=Invoice Management SaaS
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

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable invoice-app.service
log_success "Auto-restart on reboot enabled"

# ──────────────────────────────────────────────────────────
# STEP 13 — VALIDATION
# ──────────────────────────────────────────────────────────
log_info "=== STEP 13: VALIDATION ==="
sleep 8

echo ""
echo "── Containers ──"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "── Backend /health ──"
curl -sf http://127.0.0.1:8000/health && echo " ✓ Backend OK" || echo " ✗ Backend not ready"

echo ""
echo "── Frontend ──"
curl -sfo /dev/null http://127.0.0.1:3000/ && echo " ✓ Frontend OK" || echo " ✗ Frontend not ready"

echo ""
echo "── MongoDB ──"
mongosh --quiet \
    "mongodb://${DB_USER}:${DB_PASS}@127.0.0.1:27017/${DB_NAME}?authSource=${DB_NAME}" \
    --eval "db.runCommand({ping:1}).ok" 2>/dev/null && echo " ✓ MongoDB OK" || echo " ✗ MongoDB check failed"

echo ""
echo "── Nginx port 80 ──"
curl -sfo /dev/null http://127.0.0.1:80/ && echo " ✓ Nginx OK" || echo " ✗ Nginx check failed"

echo ""
echo "════════════════════════════════════════════════"
echo "   DEPLOYMENT COMPLETE ✓"
echo "════════════════════════════════════════════════"
echo ""
echo "  🌐 Frontend  :  http://${SERVER_IP}"
echo "  🔌 Backend   :  http://${SERVER_IP}:8000"
echo "  🗄️  MongoDB   :  localhost:27017 (private)"
echo ""
echo "  📁 App Dir   :  ${APP_DIR}"
echo "  💾 Backups   :  ${BACKUP_DIR}"
echo "  🔑 Creds     :  /root/.invoice_credentials"
echo ""
echo "  📋 Useful commands:"
echo "     docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f"
echo "     docker compose -f ${APP_DIR}/docker-compose.prod.yml ps"
echo "     systemctl status invoice-app"
echo ""
echo "  💡 To add SSL later, point a domain to this IP then run:"
echo "     apt install certbot python3-certbot-nginx"
echo "     certbot --nginx -d yourdomain.com"
echo "════════════════════════════════════════════════"
