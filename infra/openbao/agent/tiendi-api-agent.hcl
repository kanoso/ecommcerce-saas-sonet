# OpenBao Agent - tiendi-api consumer (dev).
# Auto-Auth AppRole. token_num_uses must remain 0 (default): limiting token uses
# breaks renewal. secret_id delivery: NTFS-ACL'd host file; on Windows binds the
# container cannot delete the file after reading, so file removal stays the
# operator's job (issue-secretid.ps1 overwrites/replaces it). Documented dev
# compromise; test must use a runner-controlled ephemeral delivery instead.
# No token sink to the app: the app only ever sees the rendered JSON.

vault {
  address = "http://openbao:8200"
  retry {
    num_retries = 5
  }
}

auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path                   = "/openbao/identity/role_id"
      secret_id_file_path                 = "/openbao/identity/secret_id"
      remove_secret_id_file_after_reading = false
    }
  }
}

template {
  source                = "/openbao/agent/tiendi-api-runtime.json.tmpl"
  destination           = "/openbao/render/tiendi-api/runtime.json"
  error_on_missing_key  = true
  perms                 = "0600"
}

# Heartbeat: content changes on every render cycle (timestamp), so its mtime
# proves the agent is alive and still fetching secrets. The launcher measures
# freshness against THIS file (runtime.json content stays byte-stable).
template {
  source                = "/openbao/agent/tiendi-api-heartbeat.json.tmpl"
  destination           = "/openbao/render/tiendi-api/heartbeat.json"
  perms                 = "0600"
}

template {
  source                = "/openbao/agent/tiendi-api-integrations.json.tmpl"
  destination           = "/openbao/render/tiendi-api/integrations.json"
  error_on_missing_key  = true
  perms                 = "0600"
}