# OpenBao dev server configuration (OpenBao 2.7.x).
# Single-node Raft. No HA on one node; Raft requires cluster_addr.
# Reference: https://openbao.org/docs/configuration/ (2.7.x)
ui = true
# NOTE: OpenBao 2.7 dropped mlock support - `disable_mlock` must NOT be set.
# Verify swap is disabled/encrypted at the host instead (guide section 3).

cluster_addr = "https://127.0.0.1:8201"
api_addr = "http://127.0.0.1:8200"

# 8201 is NOT published outside the container (compose contract).
listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_disable     = true   # documented local exception: dev only, loopback publish, controlled docker network
  tls_min_version = "tls12"
  # disable_unauthed_generate_root_endpoints: left at its default (true).
  # scripts/generate-root.ps1 documents how to enable it temporarily for dead-root recovery.
}

storage "raft" {
  path    = "/openbao/data"
  node_id = "openbao-dev-node-1"
}

# Declarative audit device (file, 2.7.x syntax: type label + path label + options map).
# Field HMAC/protection stays enabled (defaults). Never set log_raw=true.
# Reference: https://openbao.org/docs/configuration/audit/
audit "file" "dev-audit" {
  description = "dev audit log"
  options {
    file_path     = "/openbao/logs/audit.log"
    format        = "json"
    hmac_accessor = "true"
    mode          = "0600"
  }
}

telemetry {
  disable_hostname = true
}

# Hardening notes:
# - Read-only rootfs is NOT enabled yet: verify UID/volume permissions first (guide 3).
# - mlock is gone in OpenBao 2.7: host-level swap disable/encrypt is the replacement.