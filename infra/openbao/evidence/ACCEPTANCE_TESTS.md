# Acceptance tests - OpenBao dev (Tiendi workspace)

Executed 2026-09-25 on Docker Desktop (Windows, Docker 29.7.2) with OpenBao 2.7.0
(image digest `sha256:71156a1c6623a5fa3f5e61b0c6a8ead0faf0df29a778339188443551995d1315`).
All results use fictitious canary data. Evidence is redacted: key NAMES and status
codes only - no secret values are recorded here or anywhere in the repo.

## Executed and verified

| # | Test (guide §9) | Procedure | Result |
|---|---|---|---|
| 1 | Recreated container keeps canary after unseal | `docker compose up -d openbao --force-recreate` + `status.ps1 unseal` (Shamir 1/1 custody file -> REST `/v1/sys/unseal`) | PASS - canary readable via agent render after two recreate cycles; no `down -v` used |
| 2 | Differentiated states | `status.ps1 show` observed: `not-initialized` (pre-init, "security barrier not initialized" in logs), `sealed` (after restart), `ready` (after unseal) | PASS - readiness positive only when secrets servable |
| 3 | Root revoked; non-root operator auth | `bootstrap-dev.ps1` revokes root after admin login verification; operator tokens created `-orphan` and verified usable AFTER root revocation (policy re-apply succeeded with admin token) | PASS - no operational root dependency; emergency `generate-root.ps1` documented |
| 4 | Identity isolation | AppRole login via REST; probes with HTTP status only. tiendi-api: own path 200, kipu path 403, PUT kipu 403, DELETE own 403, LIST metadata 403. tiendi-kipu-api: own 200, tiendi-api path 403, PUT 403 | PASS |
| 5 | Shared integration readable only by explicit participants | GET `dev/integrations/tiendi-kipu` 200 for both runtime roles (explicit policy); tiendi-api cannot read kipu runtime and vice versa | PASS |
| 6 | Wrapping one-time use | wrapped `secret-id` (wrap-ttl 5m), unwrap #1 OK, unwrap #2 reuse REJECTED (400) | PASS |
| 7 | Token renewal | Agent logs: `renewed auth token` observed on two consecutive restarts | PASS |
| 8 | Agent re-auth after restart + re-issue | `issue-secretid.ps1 -RestartAgent` re-authenticates and re-renders | PASS |
| 9 | Fail-closed boot: missing file / invalid JSON | Launcher with nonexistent render dir | PASS - exit 2, redacted message (file path + reason only) |
| 10 | Fail-closed: unexpected rendered key | Extra field injected into KV path; agent re-rendered; launcher refuses (exit 4, key name only) | PASS |
| 11 | Single-origin rule (`--strict`) | `.env` in cwd with `--strict` -> abort exit 4; `--allow-env-file` -> OK exit 0 | PASS |
| 12 | Staleness window (OpenBao down policy) | Default max age 3600s; stale file -> exit 2 with age detail; `--max-age` override works | PASS |
| 13 | PEM / newlines round-trip | Fake multiline PEM via `write-secret.ps1 -ValueFile`; rendered JSON byte-identical to source file (CRLF preserved, 5 lines) | PASS |
| 14 | Audit: login/read/deny with field protection | audit.log 274+ entries; 260 hmac'd values; grep for canary VALUES: absent | PASS |
| 15 | Raft snapshot | `snapshot.ps1` -> 57 KB snapshot saved (content not displayed); off-host copy documented | PASS (file generated AND restore proven, see #16) |
| 16 | Isolated restore rehearsal | Fresh container, new storage, `operator raft snapshot restore -force`, restart, unseal with ORIGINAL shares, canary read 200 with policies | PASS |
| 17 | REAL app boot via launcher (end-to-end) | tiendi-api booted through launcher with canary secrets (2026-09-25): postgres+redis dev containers up, canary `canary_user`/`canary_db` created (fictional creds, reversible), `prisma db push` against canary DB, `node dist/src/main.js` as launcher child. Result: Nest fully started, Redis connected, BullMQ schedulers registered, `GET /api/v1/health` -> **200**, and 2 live connections observed in `canary_db` (proves DATABASE_URL came from OpenBao, not .env) | PASS |
| 18 | Fail-closed on invalid canary credential | FIREBASE_PRIVATE_KEY canary PEM (fake) present in KV: firebase-admin failed to parse it and the app refused to boot (correct: a malformed credential must fail loudly, not silently disable) | PASS |
| 19 | Agent heartbeat freshness | Agent no longer renders byte-identical files (consul-template diff), so launcher freshness uses a timestamp heartbeat template rendered every cycle; stale heartbeat -> exit 2 | PASS |
| 20 | REAL credentials imported + served | User-authorized import of DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET from tiendi-api .env via `import-from-env.ps1` (values never displayed/echoed; stdin -> container temp -> KV read-merge-write). Agent re-rendered, API rebooted via launcher: health 200, live pg_stat_activity connection on the real `tiendi` database (postgres user), zero connections to the canary DB | PASS |
| 21 | tiendi-api full migration + strict mode | Remaining real secrets imported (METRICS_SECRET, CULQI_SECRET_KEY, CLOUDINARY_API_SECRET, SENDGRID_API_KEY, SMTP_*, MAIL_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, GOOGLE_CLIENT_SECRET, PAYOUT_BANK_*, SHIELD_JWT_SECRET, FIREBASE_CLIENT_EMAIL; SHIELD_SERVICE_TOKEN -> integrations/shield#service_token). Launcher running with --strict --allow-env-file: OpenBao is the ONLY private-secret source; .env keeps public config only. Health 200. Classification fixes during import: TWILIO_WHATSAPP_NUMBER + FIREBASE_PROJECT_ID are public config (kept in .env); broken .env FIREBASE_PRIVATE_KEY (unkeyed PEM block) NOT migrated - pending fix at source; CULQI_WEBHOOK_SECRET + GOOGLE_MAPS_API_KEY absent from .env (nothing to import) | PASS |
| 22 | tiendi-kipu-api migration + boot | Agent #2 (compose profile agent-tiendi-kipu-api) authenticated + rendering. Real imports: DATABASE_URL (SQLite file:./dev.db), JWT_SECRET, SEED_USERNAME, SEED_PASSWORD, OPENROUTER_API_KEY, TIENDI_SERVICE_TOKEN -> integrations/tiendi-kipu#service_token. Booted via launcher --strict --allow-env-file: pino HTTP logs active, Prometheus scraping, POST /auth/login -> 401 (route alive, DB-backed validation working) | PASS |
| 23 | FIREBASE_PRIVATE_KEY repair + real push | .env broken multiline block (unkeyed base64 lines + stray quotes) reconstructed in memory, validated as RSA-2048 PKCS8 (never printed), .env rewritten to single-line literal-\n format compatible with firebase.service.ts replace(). Imported to KV (23 keys total), agent re-rendered, API rebooted via launcher: health 200, stderr empty. REAL FCM push sent with OpenBao-served credentials: 2 accepted by Google (message ids returned), 1 rejected as NotRegistered (stale device token - backend cleanup opportunity) | PASS |
| 24 | PM2 supervision + stale-FCM cleanup | Launcher forwards PM2 stop/restart signals to the child (no orphans). Both APIs switched from ad-hoc start to PM2 (`ecosystem.openbao.config.cjs` per app, launcher as entrypoint, fail-closed with 10s retry): tiendi-platform-api-openbao + tiendi-kipu-api-openbao online, health 200 / auth 401, `pm2 save` done. Gotcha found+fixed: do NOT force NODE_ENV=production in ecosystem — dev Twilio creds are placeholders (SID not starting with 'AC') and TwilioService fail-fast crashes the boot; NODE_ENV must keep coming from .env. Dispatcher now clears stale fcmToken on FCM NotRegistered (rider+vendor paths); 12/12 jest tests pass | PASS |
| 25 | Operator token lifecycle + daily maintenance + .env closure | Discovered operator tokens expired in 24h with root revoked = management lockout after 1 day (generate-root ceremony would be the only recovery). Re-minted as PERIODIC tokens (7d period, renewable indefinitely) + daily-maintenance.ps1 (renews 3 tokens + snapshot with retention 14) + Task Scheduler entry `OpenBao-Daily-Maintenance` (daily 03:00) registered and executed once successfully. Policy gap fixed: admin-operator lacked auth/token/create (sudo). .env files scrubbed to public-config-only (backups in custody env-backups, values never displayed); APIs restarted post-scrub: health 200 / auth 401. DATABASE_URL kept in .env as documented Prisma-CLI/rollback window copy; OpenBao authoritative | PASS |
| 26 | STAGE E: TEST instance deployed on RupertaMini (192.168.1.37) | Full test deployment via SSH (Posh-SSH password auth; MS-account SSH key auth broken by OpenSSH lookup_sid 1332). TLS CA+cert (SANs: rupertamini/localhost/192.168.1.37/127.0.0.1), LAN-bound listener + firewall restricted to dev PC + host, KV v2 `secret/test/...` structure, 5 policies (runtime with TEST routes), 2 AppRoles, periodic operator tokens, root revoked, TEST canaries distinct from dev. Acceptance (redacted): seal/unseal readiness states PASS; tiendi-api role own-path 200 / kipu-path 403 / PUT 403 / DELETE 403 / integrations 200 PASS; wrap reuse rejected 400 PASS; audit 267 hmac + 0 raw canaries PASS; snapshot 63KB PASS; TLS from dev PC via curl --cacert HTTP 200 PASS (needs --ssl-no-revoke for private CA without CRL in schannel) | PASS |


Notes for test 17:
- Started with `--allow-env-file` (documented transition window): public config (NODE_ENV, PORT, REDIS_HOST...) comes from .env; mapped secrets came from OpenBao and take precedence (process.env overrides .env in NestJS ConfigModule).
- Canary DATABASE_URL points to `canary_user`/`canary_db` (fictional) in the dev tiendi-postgres container. The canary schema was pushed with `prisma db push`. Cleanup is reversible (`DROP DATABASE canary_db; DROP USER canary_user;`).

## Pending (must be executed before claiming closure)

- [ ] Dev credentials failing against test instance (no test host yet - blocked by authorization).
- [ ] SecretID expired/revoked + re-issue window live test (issuance + restart verified; expiry sim skipped).
- [ ] Full rotation cycle on a REAL credential with reload/restart of a real consumer (needs authorization to import real credentials).
- [ ] Bundle/APK/image/ZIP canary scan (no build artifacts produced yet; recommended: scan `FUENTES/tiendi-go` APK output + `deploy-pc` ZIP).
- [ ] Restore timing measurement and backup retention drill (runbook in `docs/TEST_RUNBOOK.md`).
- [ ] JWT/bridge behavior after real credential import (blocked: no real credentials imported).

## Key learnings (recording procedure, not values)

1. OpenBao 2.7 dropped mlock: `disable_mlock` must NOT appear in server HCL.
2. OpenBao image entrypoint special-cases bare `server` command and injects `-dev-root-token-id` + `-dev-listen-address`; always invoke `bao server` explicitly.
3. OpenBao CLI refuses piped unseal keys by design; use REST `/v1/sys/unseal` for scripted unseal.
4. KV v2 `kv put` REPLACES the full data map - single-key writes must read-merge-write or they clobber siblings.
5. Revoking a token revokes its children: operator tokens must be created `-orphan`.
6. Wrapped responses use `wrap_info.token`, not `auth.client_token`.
7. On Windows binds, container cannot delete the `secret_id` file; `remove_secret_id_file_after_reading` must be false and removal stays operator-managed.