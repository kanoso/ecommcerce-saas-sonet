# OpenBao infra (Tiendi workspace)

Implements `DOCS/OPENBAO_IMPLEMENTATION_GUIDE.md`. Dev instance on this PC first;
test is a separate runbook (requires authorization before deploying). No prod.

- Image pinned: `openbao/openbao:2.7.0` @ `sha256:71156a1c6623a5fa3f5e61b0c6a8ead0faf0df29a778339188443551995d1315` (Docker Hub multi-arch digest verified 2026-09-25).
- Single-node integrated Raft, named volume `openbao_dev_data`, stable `node_id`, `cluster_addr` set. NOT high availability.
- API published only on `127.0.0.1:8200`; 8201 never published. HTTP is a documented local exception.
- No `-dev` mode, no ephemeral storage, no privileged, no docker socket.

## Layout

```
infra/openbao/
  docker-compose.yml          dev server + per-consumer Agent (profiles)
  config/server-dev.hcl       server config incl. declarative file audit (hmac on)
  policies/*.hcl              per-role ACLs (least privilege, no global wildcards)
  agent/                      Agent config + KV templates per consumer
  launcher/                   openbao-launcher.mjs + allowlist mappings per app
  scripts/                    PowerShell operation scripts
  SECRETS_INVENTORY.csv       Etapa A manifest (names only, no values)
  docs/TEST_RUNBOOK.md        stage E (needs authorization)
  evidence/                   redacted acceptance-test evidence
```

Custody and runtime material live OUTSIDE the repo: `%USERPROFILE%\.openbao-dev\`
(`custody\init.json` with Shamir shares, `operator-*.token`, `agent\<app>\{role_id,secret_id}`,
`render\<app>\*.json`). NTFS ACLs restricted to the current user. Never commit,
zip or sync these directories.

## Stages

| Stage | Status |
|---|---|
| A. Inventory | DONE: `SECRETS_INVENTORY.csv` (gate of scope walked; exclusions documented) |
| B. Infra dev + canary | Executed 2026-09-25: see `evidence/ACCEPTANCE_TESTS.md` |
| C. Pilot (tiendi-api) | Agent + launcher smoke-tested; app boot switch documented |
| D. Rest of apps | Mappings ready for kipu; clients stay public-only (no OpenBao) |
| E. Test env | NOT DONE - needs host + authorization (`docs/TEST_RUNBOOK.md`) |
| F. Closure | Root revoked already; rotation/cleanup pending real migration |

## Operation

```powershell
cd infra/openbao
.\scripts\bootstrap-dev.ps1          # ONE TIME: init, custody, policies, roles, canaries, revoke root
.\scripts\status.ps1 show            # not-initialized / sealed / ready (readiness != liveness)
.\scripts\status.ps1 unseal          # after any Docker/host restart (Shamir custody)
.\scripts\write-secret.ps1 -Path secret/dev/apps/tiendi-api/runtime -Key DATABASE_URL
.\scripts\import-from-env.ps1 -EnvFile FUENTES\tiendi-api\.env -Path secret/dev/apps/tiendi-api/runtime -Keys KEY1,KEY2
.\scripts\issue-secretid.ps1 -App tiendi-api -RestartAgent
.\scripts\snapshot.ps1
.\scripts\daily-maintenance.ps1      # token renewal + snapshot (also runs via Task Scheduler daily 03:00)
```

Scheduled tasks (Windows): `OpenBao-Daily-Maintenance` (daily 03:00: token renewal +
snapshot retention 14) and the reboot task (unseal + pm2 resurrect, configured by the
operator). Operator tokens are PERIODIC (7d): if the PC is offline >7 days they die —
recover with `scripts/generate-root.ps1` (documented ceremony).

`.env` files now hold PUBLIC config only (scrubbed 2026-09-25; backups in custody
`env-backups\`). `DATABASE_URL` remains in tiendi-api/.env as the documented
Prisma-CLI/rollback window copy — OpenBao is authoritative; delete at window end.

## Pilot (tiendi-api)

Production-style runs use PM2 with the launcher as entrypoint:

```powershell
cd FUENTES\tiendi-api
pm2 start ecosystem.openbao.config.cjs     # launcher spawns the app, PM2 supervises
pm2 logs tiendi-platform-api-openbao
# kipu: FUENTES\tiendi-kipu\api\ecosystem.openbao.config.cjs (name tiendi-kipu-api-openbao)
```

The launcher forwards PM2 stop/restart signals to the child (no orphans, secrets
never outlive the launcher). After a HOST REBOOT: `scripts\status.ps1 unseal` first,
then `pm2 resurrect` — PM2 retries every 10s while the vault is sealed (fail-closed,
no .env fallback).

Manual run (development):

1. `.\scripts\issue-secretid.ps1 -App tiendi-api -RestartAgent`
2. Verify rendered JSON exists: `%USERPROFILE%\.openbao-dev\render\tiendi-api\runtime.json`
3. Start the app via launcher (secretos solo al proceso hijo; un solo origen):
   ```powershell
   cd FUENTES\tiendi-api
   node G:\PROYECTOS\ecommcerce-saas-sonet\infra\openbao\launcher\openbao-launcher.mjs `
     --mapping G:\PROYECTOS\ecommcerce-saas-sonet\infra\openbao\launcher\mappings\tiendi-api.json `
     --allow-env-file -- node dist/src/main.js
   ```
   `--allow-env-file` is the documented transition window (public config from .env,
   mapped secrets from OpenBao with precedence). Once all .env secrets are migrated,
   switch to `--strict` (aborts if .env exists).
   - Freshness is measured against the agent heartbeat (`heartbeat.json`, rendered
     every cycle); stale heartbeat -> boot refused. `--max-age <seconds>` overrides
     (0 disables). End-to-end proven 2026-09-25: see `evidence/ACCEPTANCE_TESTS.md` #17.
   - Dev canary DB: `canary_user`/`canary_db` exist in tiendi-postgres (fictional
     creds); drop them when real credentials are imported.

## Scope gate (Etapa A)

Directories walked outside the known app list: `deploy-pc` (api/.env, setup.ps1, ecosystem
configs), `packages/auth-types` (type-only, no secrets), `db-analisis` (prod.db - data-at-rest
risk, excluded from any publish), `graphify-out`, `skills`, root scripts, all nested
`.github/workflows` (only tiendi-web has one; uses built-in GITHUB_TOKEN). Exclusions are
justified in `SECRETS_INVENTORY.csv` rows marked `NO-OPENBAO` / `EXCLUDE-FROM-REPO`.

## Known findings (rotation/remediation pending - no values recorded)

1. `tiendi-admin` environment files hardcode a Kipu service token in all 3 variants - it ships in browser/APK bundles. Remediation: remove from frontend + rotate the credential.
2. `tiendi-go`: Google Maps key embedded in `app.json`/`AndroidManifest.xml` (tracked); Android keystore passwords in untracked `keystore.properties`; rotate the Maps key.
3. `deploy-pc\setup.ps1` contains a literal Postgres superpassword; rotate and keep out of repo.
4. `tiendi-api\.env` has a broken multiline block after `FIREBASE_PRIVATE_KEY` (unkeyed PEM lines) - fix before migrating that value.
5. `FUENTES\db-analisis\prod.db` - production data in repo tree; exclude from pushes/ZIPs.