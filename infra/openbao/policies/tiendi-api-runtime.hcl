# tiendi-api runtime role (dev).
# Read-only on its own runtime path + the integrations it explicitly consumes.
# No list, no metadata/*, no write/delete/sudo, no global wildcard.
path "secret/data/dev/apps/tiendi-api/runtime" {
  capabilities = ["read"]
}

# Bridge tiendi-api -> tiendi-kipu (same credential as kipu-side TIENDI_SERVICE_TOKEN).
path "secret/data/dev/integrations/tiendi-kipu" {
  capabilities = ["read"]
}

# Bridge shield -> apps (service token only; SHIELD_JWT_SECRET lives in the runtime path above).
path "secret/data/dev/integrations/shield" {
  capabilities = ["read"]
}