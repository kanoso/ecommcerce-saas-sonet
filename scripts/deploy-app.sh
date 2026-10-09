#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-}"
TARGET_SHA="${2:-}"
SOURCE_DIR="${3:-}"

if [ -z "$APP_NAME" ] || [ -z "$TARGET_SHA" ] || [ -z "$SOURCE_DIR" ]; then
    echo "Usage: $0 [app_name] [target_sha] [source_dir]"
    exit 1
fi

BASE_DIR="/opt/tiendi"
RELEASES_DIR="$BASE_DIR/releases/$APP_NAME"
BACKUPS_DIR="$BASE_DIR/backups"
MANIFEST_FILE="$BASE_DIR/source-manifest.json"
HISTORY_FILE="$BASE_DIR/releases/history.jsonl"
LOCK_FILE="$BASE_DIR/deploy.lock"
LOG_DIR="$BASE_DIR/logs/deployments"

mkdir -p "$RELEASES_DIR" "$BACKUPS_DIR" "$LOG_DIR" "$(dirname "$HISTORY_FILE")"

# 1. Host-level concurrency lock using flock (timeout 600s)
exec 200>"$LOCK_FILE"
echo "Acquiring host deployment lock..."
flock -w 600 200 || { echo "ERROR: Could not acquire deployment lock within timeout."; exit 1; }

echo "=== [1/8] Starting deployment of $APP_NAME ($TARGET_SHA) ==="
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

PREV_SHA=$(jq -r --arg app "$APP_NAME" '.[$app] // "unknown"' "$MANIFEST_FILE" 2>/dev/null || echo "unknown")
echo "Previous deployed SHA: $PREV_SHA"
echo "Target deployment SHA: $TARGET_SHA"

# 2. Database Backup (Pre-migration for backend services)
if [ "$APP_NAME" = "tiendi-api" ]; then
    echo "=== [2/8] Creating pre-deployment database backup for $APP_NAME ==="
    BACKUP_FILE="$BACKUPS_DIR/pre-deploy-${APP_NAME}-${TARGET_SHA}-${TIMESTAMP}.sql.gz"
    docker compose -f "$BASE_DIR/docker-compose.yml" exec -T postgres pg_dump -U postgres_test -d tiendi_test | gzip > "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
    echo "Backup created at $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "=== [2/8] Pre-deployment backup skipped for $APP_NAME ==="
fi

# 3. Create versioned release snapshot
echo "=== [3/8] Snapshotting release $TARGET_SHA ==="
RELEASE_PATH="$RELEASES_DIR/$TARGET_SHA"
mkdir -p "$RELEASE_PATH"
rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    "$SOURCE_DIR/" "$RELEASE_PATH/"

# 4. Sync release into active source directory /opt/tiendi/src/$APP_NAME
echo "=== [4/8] Updating active source in $BASE_DIR/src/$APP_NAME ==="
mkdir -p "$BASE_DIR/src/$APP_NAME"
rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    "$RELEASE_PATH/" "$BASE_DIR/src/$APP_NAME/"

# 5. Build docker image
echo "=== [5/8] Building docker image for $APP_NAME ==="
TAG_TARGET="${APP_NAME}:${TARGET_SHA}"
TAG_PREV="${APP_NAME}:previous"

cd "$BASE_DIR"
if [ "$APP_NAME" = "tiendi-api" ]; then
    docker tag "tiendi-api:test" "$TAG_PREV" 2>/dev/null || true
    docker compose build api
    docker tag "tiendi-api:test" "$TAG_TARGET"

    # 6. Apply database migrations
    echo "=== [6/8] Running Prisma migrations ==="
    if ! python3 "$BASE_DIR/scripts/runtime-job.py" api npx prisma migrate deploy; then
        echo "ERROR: Prisma migration failed! Aborting release without activating container."
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_migration\"}" >> "$HISTORY_FILE"
        exit 1
    fi

    # 7. Activate new container
    echo "=== [7/8] Activating new container (docker compose up -d --no-deps api) ==="
    docker compose up -d --no-deps api

    # 8. Smoke tests & Health check
    echo "=== [8/8] Running smoke tests and verification ==="
    SMOKE_PASS=0
    for i in $(seq 1 30); do
        echo "Waiting for health check... attempt $i/30"
        if curl -s -f -m 5 http://127.0.0.1:3001/api/v1/health >/dev/null; then
            HEALTH_BODY=$(curl -s -m 5 http://127.0.0.1:3001/api/v1/health)
            echo "Health check passed: $HEALTH_BODY"
            
            if curl -s -f -m 5 http://192.168.1.51/api/v1/health >/dev/null; then
                echo "LAN reverse proxy health check passed!"
                SMOKE_PASS=1
                break
            fi
        fi
        sleep 2
    done

    if [ "$SMOKE_PASS" -eq 1 ]; then
        echo "Deployment SUCCESSFUL for $APP_NAME ($TARGET_SHA)"
        jq --arg app "$APP_NAME" --arg sha "$TARGET_SHA" '.[$app] = $sha' "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp" && mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"success\"}" >> "$HISTORY_FILE"
        ls -dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
        echo "Manifest updated:"
        cat "$MANIFEST_FILE"
        exit 0
    else
        echo "ERROR: Smoke tests FAILED for $APP_NAME ($TARGET_SHA)!"
        echo "Initiating automatic rollback to previous image..."
        if docker image inspect "$TAG_PREV" >/dev/null 2>&1; then
            docker tag "$TAG_PREV" "tiendi-api:test"
            docker compose up -d --no-deps api
            echo "Rolled back to previous image. Verifying previous container health..."
            sleep 5
            if curl -s -f -m 5 http://127.0.0.1:3001/api/v1/health >/dev/null; then
                echo "Previous container restored and healthy."
            fi
        fi
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_smoke_rolled_back\"}" >> "$HISTORY_FILE"
        exit 1
    fi
fi
