# tiendi-kipu-api runtime role (dev).
# Separate identity from tiendi-api. Reads its own runtime path + explicit integrations.
# Must NOT be able to read tiendi-api's runtime path.
path "secret/data/dev/apps/tiendi-kipu-api/runtime" {
  capabilities = ["read"]
}

# Receiver side of the tiendi-kipu bridge (same credential as tiendi-api KIPU_SERVICE_TOKEN).
path "secret/data/dev/integrations/tiendi-kipu" {
  capabilities = ["read"]
}

# Shield bridge receiver.
path "secret/data/dev/integrations/shield" {
  capabilities = ["read"]
}