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
elif [ "$APP_NAME" = "tiendi-web" ]; then
    docker tag "tiendi-web:test" "$TAG_PREV" 2>/dev/null || true
    docker compose build web
    docker tag "tiendi-web:test" "$TAG_TARGET"

    # 7. Activate new container
    echo "=== [7/8] Activating new container (docker compose up -d --no-deps web) ==="
    docker compose up -d --no-deps web

    # 8. Smoke tests & Health check
    echo "=== [8/8] Running smoke tests and verification ==="
    SMOKE_PASS=0
    for i in $(seq 1 30); do
        echo "Waiting for web response... attempt $i/30"
        if curl -s -f -m 5 http://127.0.0.1:4200/ >/dev/null; then
            BODY=$(curl -s -m 5 http://127.0.0.1:4200/)
            if echo "$BODY" | grep -q -E "TiendiWeb|<app-root"; then
                echo "Web SSR health check passed (found app-root/TiendiWeb)!"
                if curl -s -f -m 5 http://192.168.1.51/ >/dev/null; then
                    echo "LAN reverse proxy check passed!"
                    SMOKE_PASS=1
                    break
                fi
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
            docker tag "$TAG_PREV" "tiendi-web:test"
            docker compose up -d --no-deps web
            echo "Rolled back to previous image."
        fi
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_smoke_rolled_back\"}" >> "$HISTORY_FILE"
        exit 1
    fi
elif [ "$APP_NAME" = "tiendi-admin" ] || [ "$APP_NAME" = "tiendi-vendor" ] || [ "$APP_NAME" = "tiendi-site" ] || [ "$APP_NAME" = "tiendi-valia" ]; then
    SHORT_NAME="${APP_NAME#tiendi-}"
    
    if [ "$APP_NAME" = "tiendi-site" ] || [ "$APP_NAME" = "tiendi-valia" ]; then
        STATIC_DIR="$BASE_DIR/static/$SHORT_NAME"
        BACKUP_STATIC="$BASE_DIR/static/${SHORT_NAME}-prev"
    else
        STATIC_DIR="$BASE_DIR/static/$SHORT_NAME/browser"
        BACKUP_STATIC="$BASE_DIR/static/${SHORT_NAME}-prev"
    fi
    
    mkdir -p "$STATIC_DIR"
    
    # Locate built static artifacts in SOURCE_DIR
    DIST_SRC=""
    if [ -d "$SOURCE_DIR/dist/$APP_NAME/browser" ]; then
        DIST_SRC="$SOURCE_DIR/dist/$APP_NAME/browser"
    elif [ -d "$SOURCE_DIR/dist/browser" ]; then
        DIST_SRC="$SOURCE_DIR/dist/browser"
    elif [ -d "$SOURCE_DIR/browser" ]; then
        DIST_SRC="$SOURCE_DIR/browser"
    elif [ -d "$SOURCE_DIR/dist" ]; then
        DIST_SRC="$SOURCE_DIR/dist"
    elif [ -f "$SOURCE_DIR/index.html" ]; then
        DIST_SRC="$SOURCE_DIR"
    fi

    if [ -z "$DIST_SRC" ]; then
        echo "ERROR: Could not locate built static artifacts in $SOURCE_DIR!"
        exit 1
    fi

    echo "Found built static artifacts in $DIST_SRC"
    
    # 6. Backup previous static files
    echo "=== [6/8] Backing up previous static files to $BACKUP_STATIC ==="
    rm -rf "$BACKUP_STATIC"
    cp -r "$STATIC_DIR" "$BACKUP_STATIC" 2>/dev/null || true

    # 7. Deploy new static files
    echo "=== [7/8] Activating new static release in $STATIC_DIR ==="
    rsync -a --delete --exclude '.git' "$DIST_SRC/" "$STATIC_DIR/"

    # 8. Smoke tests & Health check
    echo "=== [8/8] Running smoke tests and verification ==="
    PORT="4202"
    if [ "$APP_NAME" = "tiendi-vendor" ]; then
        PORT="4201"
    elif [ "$APP_NAME" = "tiendi-site" ]; then
        PORT="4210"
    elif [ "$APP_NAME" = "tiendi-valia" ]; then
        PORT="4211"
    fi

    SMOKE_PASS=0
    for i in $(seq 1 30); do
        echo "Waiting for $APP_NAME static response... attempt $i/30"
        if curl -s -f -m 5 "http://127.0.0.1:$PORT/" >/dev/null; then
            BODY=$(curl -s -m 5 "http://127.0.0.1:$PORT/")
            if echo "$BODY" | grep -q -E "<app-root|Tiendi|tiendi|<!DOCTYPE html|Valia|valia"; then
                echo "Static health check passed on port $PORT!"
                if curl -s -f -m 5 "http://192.168.1.51:$PORT/" >/dev/null && curl -s -f -m 5 "http://192.168.1.51/$SHORT_NAME/" >/dev/null; then
                    echo "LAN reverse proxy check passed for $APP_NAME!"
                    SMOKE_PASS=1
                    break
                fi
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
        echo "Initiating automatic rollback to previous static files..."
        if [ -d "$BACKUP_STATIC" ]; then
            rsync -a --delete "$BACKUP_STATIC/" "$STATIC_DIR/"
            echo "Rolled back to previous static files."
        fi
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_smoke_rolled_back\"}" >> "$HISTORY_FILE"
        exit 1
    fi
elif [ "$APP_NAME" = "tiendi-shield" ]; then
    docker tag "tiendi-shield:test" "$TAG_PREV" 2>/dev/null || true
    
    if [ -d "$SOURCE_DIR/app" ]; then
        echo "Updating static app volume files for shield..."
        mkdir -p "$BASE_DIR/static/shield-apk-release-20261009"
        rsync -a "$SOURCE_DIR/app/" "$BASE_DIR/static/shield-apk-release-20261009/"
    fi
    
    docker compose build shield
    docker tag "tiendi-shield:test" "$TAG_TARGET"

    # 7. Activate new container
    echo "=== [7/8] Activating new container (docker compose up -d --no-deps shield) ==="
    docker compose up -d --no-deps shield

    # 8. Smoke tests & Health check
    echo "=== [8/8] Running smoke tests and verification ==="
    SMOKE_PASS=0
    for i in $(seq 1 30); do
        echo "Waiting for shield response... attempt $i/30"
        if curl -s -f -m 5 http://127.0.0.1:4203/ >/dev/null; then
            BODY=$(curl -s -m 5 http://127.0.0.1:4203/)
            if echo "$BODY" | grep -q -E "Tiendi Shield|Shield"; then
                echo "Shield health check passed on port 4203!"
                if curl -s -f -m 5 http://192.168.1.51:4203/ >/dev/null && curl -s -f -m 5 http://192.168.1.51/shield/ >/dev/null; then
                    echo "LAN reverse proxy check passed for tiendi-shield!"
                    SMOKE_PASS=1
                    break
                fi
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
            docker tag "$TAG_PREV" "tiendi-shield:test"
            docker compose up -d --no-deps shield
            echo "Rolled back to previous image."
        fi
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_smoke_rolled_back\"}" >> "$HISTORY_FILE"
        exit 1
    fi
elif [ "$APP_NAME" = "tiendi-kipu" ]; then
    docker tag "tiendi-kipu-api:test" "$TAG_PREV" 2>/dev/null || true

    KIPU_STATIC_SRC=""
    if [ -d "$SOURCE_DIR/web/dist/kipu/browser" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/web/dist/kipu/browser"
    elif [ -d "$SOURCE_DIR/web/dist/web/browser" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/web/dist/web/browser"
    elif [ -d "$SOURCE_DIR/web/dist/browser" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/web/dist/browser"
    elif [ -d "$SOURCE_DIR/dist/kipu/browser" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/dist/kipu/browser"
    elif [ -d "$SOURCE_DIR/dist/browser" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/dist/browser"
    elif [ -d "$SOURCE_DIR/web/dist" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/web/dist"
    elif [ -d "$SOURCE_DIR/dist" ]; then
        KIPU_STATIC_SRC="$SOURCE_DIR/dist"
    fi

    if [ -n "$KIPU_STATIC_SRC" ]; then
        echo "Deploying kipu web static build from $KIPU_STATIC_SRC to $BASE_DIR/static/kipu/browser"
        mkdir -p "$BASE_DIR/static/kipu/browser"
        rsync -a --delete "$KIPU_STATIC_SRC/" "$BASE_DIR/static/kipu/browser/"
    fi

    docker compose build kipu-api
    docker tag "tiendi-kipu-api:test" "$TAG_TARGET"

    # 7. Activate new container
    echo "=== [7/8] Activating new container (docker compose up -d --no-deps kipu-api) ==="
    docker compose up -d --no-deps kipu-api

    # 8. Smoke tests & Health check
    echo "=== [8/8] Running smoke tests and verification ==="
    SMOKE_PASS=0
    for i in $(seq 1 30); do
        echo "Waiting for kipu-api response... attempt $i/30"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/auth/me || true)
        if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
            echo "kipu-api direct check passed (HTTP $HTTP_CODE)!"
            LAN_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.1.51/kipu-api/auth/me || true)
            if [ "$LAN_CODE" = "401" ] || [ "$LAN_CODE" = "200" ]; then
                echo "LAN reverse proxy check passed for kipu-api!"
                if curl -s -f -m 5 http://127.0.0.1:4300/ >/dev/null && curl -s -f -m 5 http://192.168.1.51/kipu/ >/dev/null; then
                    echo "Kipu static web check passed on port 4300 and /kipu/!"
                    SMOKE_PASS=1
                    break
                fi
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
            docker tag "$TAG_PREV" "tiendi-kipu-api:test"
            docker compose up -d --no-deps kipu-api
            echo "Rolled back to previous image."
        fi
        echo "{\"timestamp\":\"$TIMESTAMP\",\"app\":\"$APP_NAME\",\"target_sha\":\"$TARGET_SHA\",\"prev_sha\":\"$PREV_SHA\",\"status\":\"failed_smoke_rolled_back\"}" >> "$HISTORY_FILE"
        exit 1
    fi
else
    echo "ERROR: Unsupported application $APP_NAME"
    exit 1
fi
