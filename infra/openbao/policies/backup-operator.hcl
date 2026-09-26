# Backup operator: Raft snapshots only, minimum required capability.
path "sys/storage/raft/snapshot" {
  capabilities = ["read", "sudo"]
}