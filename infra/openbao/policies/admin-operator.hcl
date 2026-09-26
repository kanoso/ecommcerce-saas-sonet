# Human admin operator (nominative, non-root).
# Can manage KV v2 data, auth methods, policies and tokens on the dev mount,
# but cannot see secret values it does not need... note: this dev policy grants
# intentional admin over the secret mount; on test this must be narrowed.
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/*" {
  capabilities = ["read", "list", "delete"]
}
path "auth/approle/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/auth" {
  capabilities = ["read"]
}
path "sys/auth/*" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/audit" {
  capabilities = ["read", "sudo"]
}
path "sys/audit/*" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}
path "sys/leases/revoke/*" {
  capabilities = ["update", "sudo"]
}
path "auth/token/revoke/*" {
  capabilities = ["update", "sudo"]
}
# Token management: mint/renew operator tokens (orphan creation needs sudo).
path "auth/token/create" {
  capabilities = ["create", "update", "sudo"]
}
path "auth/token/create-orphan" {
  capabilities = ["update", "sudo"]
}
path "auth/token/renew" {
  capabilities = ["update"]
}
path "auth/token/lookup" {
  capabilities = ["update"]
}
path "auth/token/roles/*" {
  capabilities = ["read", "list"]
}