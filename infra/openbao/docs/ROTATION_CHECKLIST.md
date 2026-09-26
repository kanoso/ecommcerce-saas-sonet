# Rotation checklist - exposed credentials (pending 2026-09-25)

Credentials with HISTORICAL exposure (git history, bundles, files). Moving them to
OpenBao does NOT fix the exposure - each must be rotated at its provider. Verified
against `SECRETS_INVENTORY.csv`. Execute one at a time, with rollback window.

## 1. Kipu service token (tiendi-admin frontend) - BLOCKED by design decision

- **Exposure**: `kipu.serviceToken` hardcoded in tiendi-admin `environment.ts`,
  `environment.prod.ts`, `environment.mobile.ts` (all 3 variants) - ships in every
  browser session and APK build. Same value as kipu API's `TIENDI_SERVICE_TOKEN`
  (now also in OpenBao `secret/dev/integrations/tiendi-kipu#service_token`).
- **Why blocked**: the browser NEEDS a machine token to call kipu directly. Rotating
  without fixing the architecture ships the new token in bundles = zero gain.
- **Correct fix**: admin should call kipu THROUGH its own tiendi-api backend (proxy
  endpoint), or kipu needs per-user auth for admin. Then rotate:
  1. Generate new 96-hex token.
  2. `write-secret.ps1 -Path secret/dev/integrations/tiendi-kipu -Key service_token`
  3. Restart both agents + APIs (rotation does not hot-reload).
  4. Remove `kipu.*` from all 3 tiendi-admin env files + proxy the calls.
- **Owner**: requires product decision (admin-architecture).

## 2. Google Maps API key (tiendi-go) - requires Google Cloud console

- **Exposure**: embedded in tracked `app.json` (2 places) + baked into
  `android/app/src/main/AndroidManifest.xml` + git history of the repo.
- **Rotate** (console actions only you can do):
  1. Google Cloud Console -> APIs & Services -> Credentials -> create NEW key.
  2. Restrict new key: Android app restriction + package `com.tiendi...` + SHA-1.
  3. Quotas: per-app limits + billing alerts.
  4. Update `app.json` (2 places), run `npx expo prebuild` (regenerates Manifest).
  5. Delete the OLD key AFTER the next APK build ships.
- **Server-side twin**: tiendi-api `GOOGLE_MAPS_API_KEY` (separate key? verify -
  if server key is the same, split into server-restricted + android-restricted).
- **Note**: tiendi-api `.env` currently has NO GOOGLE_MAPS_API_KEY (nothing to migrate).

## 3. setup.ps1 Postgres superpassword - local, automatable with coordination

- **Exposure**: literal in `FUENTES/deploy-pc/setup.ps1` (git history).
- **Rotate**:
  1. Generate strong password (32+ chars).
  2. `ALTER USER postgres WITH PASSWORD '...'` on the WINDOWS postgres service
     (the one setup.ps1 installed) - NOT the docker container unless coordinated.
  3. Scrub the literal from setup.ps1: prompt securely or read from env var.
  4. Update every consumer of that Windows postgres (check deploy-pc api/.env).
  5. Git history rewrite = separate authorized decision (guide section 7).
- **Also**: docker tiendi-postgres runs `postgres/postgres` (docker-compose.yml)
  and binds 0.0.0.0:5432 - recommend loopback bind + rotate, then update
  `DATABASE_URL` in OpenBao (single source) and restart the API via launcher.

## 4. Already-rotatable in OpenBao (no provider console needed)

| Credential | Where | Procedure |
|---|---|---|
| JWT_SECRET / JWT_REFRESH_SECRET (tiendi-api) | KV runtime path | `write-secret.ps1` new value -> restart API. JWT rotation INVALIDATES SESSIONS: schedule + document (guide section 7). |
| METRICS_SECRET | KV runtime path | same, instant |
| SHIELD_JWT_SECRET | KV runtime path | rotate invalidates Shield sessions; coordinate with shield deploy |
| Bridge tokens (tiendi-kipu / shield #service_token) | KV integrations | rotate jointly emitter+receiver; verify both sides restart |

## Rules (guide section 7)

- Import/rotate via local no-echo operation (`write-secret.ps1`, never chat/args).
- Old credentials stay valid during a DOCUMENTED rollback window, then revoke at
  the provider (old JWT secrets: keep both verify keys or accept session drop).
- Suspected leak mid-rotation: stop migrating that element, report path+type,
  rotate first, investigate after.