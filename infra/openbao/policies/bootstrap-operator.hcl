# Bootstrap operator: can ONLY generate SecretIDs (wrapped) for whitelisted
# AppRole roles. Cannot read secret data, cannot manage auth broadly.
# This is the role used by scripts/issue-secretid.ps1 (never root).
path "auth/approle/role/tiendi-api-runtime/secret-id" {
  capabilities = ["create", "update"]
}
path "auth/approle/role/tiendi-kipu-api-runtime/secret-id" {
  capabilities = ["create", "update"]
}
# RoleID is public-by-design (SecretID is the sensitive half), read-only here.
path "auth/approle/role/tiendi-api-runtime/role-id" {
  capabilities = ["read"]
}
path "auth/approle/role/tiendi-kipu-api-runtime/role-id" {
  capabilities = ["read"]
}
# Allows the operator to unwrap its own response-wrapping tokens.
path "sys/wrapping/unwrap" {
  capabilities = ["update"]
}