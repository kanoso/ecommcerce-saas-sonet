# OpenBao Agent - tiendi-kipu-api consumer (dev).
# Same contract as tiendi-api agent: AppRole auto-auth, no token sink to the app.
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
  source                = "/openbao/agent/tiendi-kipu-runtime.json.tmpl"
  destination           = "/openbao/render/tiendi-kipu-api/runtime.json"
  error_on_missing_key  = true
  perms                 = "0600"
}

template {
  source                = "/openbao/agent/tiendi-kipu-integrations.json.tmpl"
  destination           = "/openbao/render/tiendi-kipu-api/integrations.json"
  error_on_missing_key  = true
  perms                 = "0600"
}

template {
  source                = "/openbao/agent/tiendi-kipu-heartbeat.json.tmpl"
  destination           = "/openbao/render/tiendi-kipu-api/heartbeat.json"
  perms                 = "0600"
}