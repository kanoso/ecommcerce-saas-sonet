# TEST environment - EXECUTED 2026-09-25 on RupertaMini (192.168.1.37)

Status: **deployed and acceptance-tested**. Dev on this PC stays untouched;
no services on the server were modified (PM2 apps + cloudflared tunnel intact).

## Deployed on RupertaMini (Windows 11 Pro, Docker 29.7.2, 7.4GB RAM)

- `C:\openbao-test\` standalone: docker-compose.yml, config/server-test.hcl,
  policies/, scripts/bootstrap-test.ps1, tls/, custody/, backups/
- OpenBao 2.7.0 (same digest as dev; image transferred via docker save/load
  because Docker Desktop's credential helper fails in SSH sessions)
- TLS: CA "Tiendi Test CA" + server cert SANs `rupertamini`, `localhost`,
  `192.168.1.37`, `127.0.0.1` (PS5.1: New-SelfSignedCertificate + PFX export +
  openssl conversion inside the openbao container via apk add as root)
- Listener: TLS only, 0.0.0.0 in container, bound to LAN IP only
  (192.168.1.37:8200). 8201 never published. cloudflared does NOT expose it.
- Windows firewall: allow TCP/8200 ONLY from 192.168.1.31 (dev PC) + host.
  NOTE: never add a catch-all deny rule on Windows Firewall - Block beats Allow
  (the allow rule + default inbound policy is the correct model).
- KV v2 `secret`, `secret/test/...` structure, 5 policies (runtime policies with
  TEST routes), 2 AppRoles, operator tokens PERIODIC 7d, root revoked,
  custody file `C:\openbao-test\custody\init-test.json` (ACL'd; keys never
  transmitted via chat)
- Canary values `CANARY-TEST-*` (distinct from dev)

## Acceptance results (executed, redacted)

| Test | Result |
|---|---|
| init once + unseal via REST + readiness gate | PASS |
| seal (admin REST) -> sealed=True (readiness negative) / unseal -> positive | PASS |
| tiendi-api role: own path 200, kipu path 403, PUT 403, DELETE 403, integrations 200 | PASS |
| wrapping one-time reuse rejected (400) | PASS |
| audit: 267 hmac'd fields, 0 raw CANARY-TEST values | PASS |
| snapshot 63KB (content not displayed) | PASS |
| TLS from dev PC: curl --cacert -> HTTP 200 (cert validated against CA) | PASS |

## Access from the dev PC

```
curl.exe --ssl-no-revoke --cacert %USERPROFILE%\.openbao-dev\test-ca.crt ^
  https://192.168.1.37:8200/v1/sys/health
```
- `--ssl-no-revoke` needed for curl/schannel: the private CA publishes no CRL.
  Node/Go consumers are unaffected (no default revocation check).
- The CA cert is at `%USERPROFILE%\.openbao-dev\test-ca.crt` (public material).

## Operation scripts (on the server, C:\openbao-test\scripts\) - ALL CONFIGURED

- `bootstrap-test.ps1` - one-time (done); idempotent-guarded, refuses re-init
- `daily-maintenance.ps1` + Scheduled task `OpenBaoTest-Daily-Maintenance` (daily 03:30):
  renews 3 periodic operator tokens + snapshot with retention 14. Executed once
  successfully (3 renewals + snapshot verified). Readiness gate: skips while sealed.
- `unseal-test.ps1` + Scheduled task `OpenBaoTest-Unseal-AtStartup` (at boot, SYSTEM):
  waits up to 10min for the container, refuses if not initialized, no-op if already
  unsealed. Verified: reports "already unsealed" on an unsealed vault.
- Evidence files: `C:\openbao-test\maintenance.log`, `unseal.log`, `acceptance.log`

## Remaining operator actions (on the test host)

1. **Rotate the server password** (was exposed over chat during deployment).
2. **Copy `C:\openbao-test\custody\init-test.json` off-host** (encrypted, separate
   from the snapshot backups) - without the Shamir share the vault is unrecoverable.
3. Copy snapshots off-host periodically (encrypted, separate from the custody copy).

## Deviations from the guide (documented)

1. Shamir 1/1 with single operator (same as dev) - explicit risk; custody file
   exists on server + must be copied off-host by the operator.
2. No snapshot schedule or token-renewal task configured on the server yet -
   same design as dev's daily-maintenance is recommended before real use.
3. No test apps/agents deployed yet: test consumers would live on RupertaMini
   (launchers + agents against https://192.168.1.37:8200) when needed.
4. SSH key auth for the MS account failed (OpenSSH `get_passwd lookup_sid 1332`
   MS-account mapping issue); access via Posh-SSH password instead. Password
   rotation pending (was shared over chat - rotate it).

## Host findings (RupertaMini)

- Disk was NOT full (130GB free of 222) - earlier reading was a recon parsing bug.
- RAM tight: 1.3GB free of 7.4GB - OpenBao test fits, monitor if apps are added.
- Ports in use: 22, 3000, 3001, 3002, 3100, 4000, 4201-4211, 4300, 5432, 6379,
  9090 (PM2 apps + infra). OpenBao test uses 8200 only.
- Docker pull from SSH sessions broken (Docker Desktop credential helper needs a
  desktop session): workaround = docker save/load, or a clean DOCKER_CONFIG dir.