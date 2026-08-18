#!/usr/bin/env bash

set -Eeuo pipefail

trap '
EXIT_CODE=$?
printf "\n❌ Deployment failed at line %s with exit code %s\n" "$LINENO" "$EXIT_CODE"
exit "$EXIT_CODE"
' ERR

# Feature: One repeatable deployment command builds, uploads, hardens, proxies, certificates, verifies, and rolls back the backend.
PROJECT_NAME="weight-tracker-backend"
DEPLOY_FILE=".env.deploy"

for command in git cargo ssh scp curl realpath awk stat du dirname mktemp getent; do
    command -v "$command" >/dev/null 2>&1 || {
        printf 'Error: %s is not installed or unavailable in PATH.\n' "$command" >&2
        exit 1
    }
done

[[ -f "$DEPLOY_FILE" ]] || {
    printf 'Error: %s is missing. Copy .env.deploy.example and fill it first.\n' "$DEPLOY_FILE" >&2
    exit 1
}

set -a
# shellcheck disable=SC1091
source "$DEPLOY_FILE"
set +a

for variable in REMOTE_USER REMOTE_HOST DOMAIN CERTBOT_EMAIL REMOTE_APP_DIR \
    REMOTE_WORKING_DIR REMOTE_BIN_PATH REMOTE_ENV_PATH SERVICE_NAME SERVICE_USER \
    LOCAL_WORKSPACE_DIR LOCAL_BINARY_PATH SERVER_HOST SERVER_PORT HEALTH_CHECK_PATH; do
    [[ -n "${!variable:-}" ]] || {
        printf 'Error: %s is missing from %s.\n' "$variable" "$DEPLOY_FILE" >&2
        exit 1
    }
done

[[ "$REMOTE_USER" == "root" ]] || {
    printf 'Error: first-time Nginx/systemd provisioning currently requires REMOTE_USER=root.\n' >&2
    exit 1
}

REPOSITORY_ROOT="$(pwd)"
LOCAL_WORKSPACE_DIR="$(realpath -m "$LOCAL_WORKSPACE_DIR")"
if [[ "$LOCAL_BINARY_PATH" = /* ]]; then
    LOCAL_BINARY_PATH="$(realpath -m "$LOCAL_BINARY_PATH")"
else
    LOCAL_BINARY_PATH="$(realpath -m "$LOCAL_WORKSPACE_DIR/$LOCAL_BINARY_PATH")"
fi

cd "$REPOSITORY_ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    printf 'Error: repository root is not inside a Git working tree.\n' >&2
    exit 1
}

if [[ -n "$(git status --porcelain)" ]]; then
    printf 'Error: working tree is dirty. Commit or stash changes before deployment.\n\n' >&2
    git status --short
    exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "main" || "$BRANCH" == "master" ]] || {
    printf 'Error: deploy only runs from main/master; current branch is %s.\n' "$BRANCH" >&2
    exit 1
}

BUILD_VERSION="$(git rev-parse --short HEAD)"
REMOTE_ADDRESS="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_BIN_DIR="$(dirname "$REMOTE_BIN_PATH")"
REMOTE_TEMP_BIN="${REMOTE_BIN_PATH}.new"
REMOTE_PREVIOUS_BIN="${REMOTE_BIN_PATH}.previous"
LOCAL_HEALTH_URL="http://${SERVER_HOST}:${SERVER_PORT}${HEALTH_CHECK_PATH}"
PUBLIC_HEALTH_URL="https://${DOMAIN}${HEALTH_CHECK_PATH}"

RESOLVED_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR == 1 { print $1 }')"
[[ "$RESOLVED_IP" == "$REMOTE_HOST" ]] || {
    printf 'Error: %s resolves to %s, expected %s. Wait for DNS propagation before requesting TLS.\n' "$DOMAIN" "${RESOLVED_IP:-nothing}" "$REMOTE_HOST" >&2
    exit 1
}

printf '\nDeployment information:\n'
printf '  Project:   %s\n' "$PROJECT_NAME"
printf '  Build:     %s (%s)\n' "$BUILD_VERSION" "$BRANCH"
printf '  Server:    %s\n' "$REMOTE_ADDRESS"
printf '  Domain:    %s\n' "$DOMAIN"
printf '  Service:   %s\n' "$SERVICE_NAME"
printf '  Binary:    %s\n' "$REMOTE_BIN_PATH"
printf '  Public:    %s\n\n' "$PUBLIC_HEALTH_URL"

read -r -p 'Continue deployment? (y/N): ' confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || {
    printf 'Deployment aborted.\n'
    exit 0
}

DEPLOY_START_TIME="$(date +'%Y-%m-%d %H:%M:%S')"

printf '\nBuilding release binary...\n'
cd "$LOCAL_WORKSPACE_DIR"
cargo build --release --locked
[[ -x "$LOCAL_BINARY_PATH" ]] || {
    printf 'Error: executable release binary was not found at %s.\n' "$LOCAL_BINARY_PATH" >&2
    exit 1
}

BYTES_SIZE="$(stat -c%s "$LOCAL_BINARY_PATH")"
HUMAN_SIZE="$(du -h "$LOCAL_BINARY_PATH" | awk '{print $1}')"
MB_SIZE="$(awk -v bytes="$BYTES_SIZE" 'BEGIN {printf "%.2f", bytes / 1024 / 1024}')"
printf 'Build succeeded: %s (%s MB, %s bytes).\n' "$HUMAN_SIZE" "$MB_SIZE" "$BYTES_SIZE"

printf '\nTesting SSH and provisioning required packages...\n'
ssh -o BatchMode=yes -o ConnectTimeout=10 "$REMOTE_ADDRESS" true
ssh "$REMOTE_ADDRESS" '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx ca-certificates curl
systemctl enable --now nginx
'

printf 'Preparing the dedicated service account and directories...\n'
ssh "$REMOTE_ADDRESS" "
set -e
id -u '$SERVICE_USER' >/dev/null 2>&1 || useradd --system --home '$REMOTE_APP_DIR' --shell /usr/sbin/nologin '$SERVICE_USER'
install -d -o root -g '$SERVICE_USER' -m 0750 '$REMOTE_APP_DIR'
install -d -o root -g root -m 0755 '$REMOTE_BIN_DIR'
"

if ! ssh "$REMOTE_ADDRESS" "test -f '$REMOTE_ENV_PATH'"; then
    printf '\nError: production environment file is missing: %s\n' "$REMOTE_ENV_PATH" >&2
    printf 'Create it on the server before deploying. See DEPLOYMENT.md.\n' >&2
    exit 1
fi

# Security: Production configuration is readable by systemd's service user but never uploaded from the developer machine.
ssh "$REMOTE_ADDRESS" "
set -e
chown root:'$SERVICE_USER' '$REMOTE_ENV_PATH'
chmod 0640 '$REMOTE_ENV_PATH'
grep -Eq '^APP_HOST=127\.0\.0\.1$' '$REMOTE_ENV_PATH' || { echo 'REMOTE .env must contain APP_HOST=127.0.0.1' >&2; exit 1; }
grep -Eq '^APP_PORT=$SERVER_PORT$' '$REMOTE_ENV_PATH' || { echo 'REMOTE .env must contain APP_PORT=$SERVER_PORT' >&2; exit 1; }
"

printf 'Uploading release binary...\n'
scp "$LOCAL_BINARY_PATH" "$REMOTE_ADDRESS:$REMOTE_TEMP_BIN"
ssh "$REMOTE_ADDRESS" "
set -e
chmod 0755 '$REMOTE_TEMP_BIN'
if test -f '$REMOTE_BIN_PATH'; then
    cp '$REMOTE_BIN_PATH' '$REMOTE_PREVIOUS_BIN'
    chmod 0755 '$REMOTE_PREVIOUS_BIN'
fi
mv '$REMOTE_TEMP_BIN' '$REMOTE_BIN_PATH'
"

printf 'Installing hardened systemd unit...\n'
ssh "$REMOTE_ADDRESS" "cat > '/etc/systemd/system/$SERVICE_NAME.service'" <<EOF
[Unit]
Description=Weight Tracker Axum Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$REMOTE_WORKING_DIR
EnvironmentFile=$REMOTE_ENV_PATH
Environment=RUST_LOG=info
ExecStart=$REMOTE_BIN_PATH
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

# Security: The API needs network and database access, but no home, devices, privilege escalation, or writable system paths.
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6

[Install]
WantedBy=multi-user.target
EOF

ssh "$REMOTE_ADDRESS" "systemctl daemon-reload && systemctl enable '$SERVICE_NAME' && systemctl restart '$SERVICE_NAME'"

rollback() {
    printf '\nAttempting binary rollback...\n' >&2
    ssh "$REMOTE_ADDRESS" "
    set -e
    if test -f '$REMOTE_PREVIOUS_BIN'; then
        systemctl stop '$SERVICE_NAME' || true
        cp '$REMOTE_PREVIOUS_BIN' '$REMOTE_BIN_PATH.rollback'
        chmod 0755 '$REMOTE_BIN_PATH.rollback'
        mv '$REMOTE_BIN_PATH.rollback' '$REMOTE_BIN_PATH'
        systemctl start '$SERVICE_NAME'
        echo 'Previous binary restored.'
    else
        echo 'No previous binary is available.'
    fi
    " || true
}

printf 'Waiting for the private health endpoint...\n'
HEALTHY=false
for attempt in {1..15}; do
    if ssh "$REMOTE_ADDRESS" "curl --fail --silent --show-error --max-time 5 '$LOCAL_HEALTH_URL' >/dev/null"; then
        HEALTHY=true
        break
    fi
    printf '  Waiting for backend... %s/15\n' "$attempt"
    sleep 1
done

if [[ "$HEALTHY" != true ]]; then
    ssh "$REMOTE_ADDRESS" "systemctl status '$SERVICE_NAME' --no-pager --full" || true
    ssh "$REMOTE_ADDRESS" "journalctl -u '$SERVICE_NAME' -n 100 --no-pager" || true
    rollback
    exit 1
fi

printf 'Configuring Nginx reverse proxy...\n'
# Feature: The proxy lives in a snippet so future deploys do not overwrite Certbot's TLS-managed site file.
ssh "$REMOTE_ADDRESS" "cat > '/etc/nginx/snippets/$SERVICE_NAME-proxy.conf'" <<EOF
location / {
    proxy_pass http://$SERVER_HOST:$SERVER_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 30s;
    client_max_body_size 256k;
}
EOF

if ! ssh "$REMOTE_ADDRESS" "test -f '/etc/nginx/sites-available/$SERVICE_NAME'"; then
    ssh "$REMOTE_ADDRESS" "cat > '/etc/nginx/sites-available/$SERVICE_NAME'" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    include /etc/nginx/snippets/$SERVICE_NAME-proxy.conf;
}
EOF
fi

ssh "$REMOTE_ADDRESS" "
set -e
ln -sfn '/etc/nginx/sites-available/$SERVICE_NAME' '/etc/nginx/sites-enabled/$SERVICE_NAME'
nginx -t
systemctl reload nginx
"

if ! ssh "$REMOTE_ADDRESS" "test -f '/etc/letsencrypt/live/$DOMAIN/fullchain.pem'"; then
    printf 'Requesting the first Let’s Encrypt certificate...\n'
    ssh "$REMOTE_ADDRESS" "certbot --nginx --non-interactive --agree-tos --redirect --email '$CERTBOT_EMAIL' -d '$DOMAIN'"
else
    printf 'Existing Let’s Encrypt certificate found.\n'
fi

# Feature: Certbot's systemd timer renews certificates automatically and reloads Nginx when necessary.
ssh "$REMOTE_ADDRESS" "systemctl enable --now certbot.timer && systemctl is-active --quiet certbot.timer"

printf 'Running public HTTPS health check...\n'
PUBLIC_HEALTHY=false
for attempt in {1..10}; do
    if curl --fail --silent --show-error --max-time 10 "$PUBLIC_HEALTH_URL" >/dev/null; then
        PUBLIC_HEALTHY=true
        break
    fi
    printf '  Waiting for HTTPS... %s/10\n' "$attempt"
    sleep 2
done

if [[ "$PUBLIC_HEALTHY" != true ]]; then
    printf 'Error: backend is healthy locally, but public HTTPS failed: %s\n' "$PUBLIC_HEALTH_URL" >&2
    ssh "$REMOTE_ADDRESS" 'nginx -t; systemctl status nginx --no-pager --full' || true
    exit 1
fi

ssh "$REMOTE_ADDRESS" "journalctl -u '$SERVICE_NAME' -n 30 --no-pager"

DEPLOY_END_TIME="$(date +'%Y-%m-%d %H:%M:%S')"
printf '\n✅ Deployment complete!\n'
printf 'Started: %s\nFinished: %s\nBuild: %s\nAPI: https://%s\n' "$DEPLOY_START_TIME" "$DEPLOY_END_TIME" "$BUILD_VERSION" "$DOMAIN"
printf '\nUseful commands:\n'
printf '  ssh %s "systemctl status %s --no-pager"\n' "$REMOTE_ADDRESS" "$SERVICE_NAME"
printf '  ssh %s "journalctl -u %s -f"\n' "$REMOTE_ADDRESS" "$SERVICE_NAME"
printf '  curl https://%s/health\n' "$DOMAIN"
