# Emergency root generation (1/1 Shamir only, dev).
# OpenBao 2.7 disables the unauthed generate-root endpoints by default
# (`disable_unauthed_generate_root_endpoints`); this script documents the
# TEMPORARY enable + ceremony + immediate re-disable. Do not leave it enabled.
# Usage: .\generate-root.ps1
# Precondition: listener param added temporarily in server HCL + server restarted + unsealed.

. (Join-Path $PSScriptRoot '_common.ps1')

$base = 'http://127.0.0.1:8200/v1'
$init = Read-CustodyJson

$att = Invoke-RestMethod -Method Post -Uri "$base/sys/generate-root/attempt" -ContentType 'application/json' -Body '{}'
if (-not $att.nonce) { throw 'generate-root attempt failed' }
$otp = $att.otp

# Single share -> single update call. Key flows custody -> variable -> body.
$key = $init.unseal_keys_b64[0]
$done = Invoke-RestMethod -Method Post -Uri "$base/sys/generate-root/update?nonce=$($att.nonce)" `
  -ContentType 'application/json' -Body (@{ key = $key; nonce = $att.nonce } | ConvertTo-Json -Compress)
Remove-Variable key

if (-not $done.complete -or -not $done.encoded_token) { throw 'generate-root incomplete (check share/threshold)' }

# Decode: raw token bytes XOR'd with the OTP; base64 comes WITHOUT padding.
$pad = (4 - ($done.encoded_token.Length % 4)) % 4
$b64 = $done.encoded_token + ('=' * $pad)
$bytes = [Convert]::FromBase64String($b64)
$sb = [System.Text.StringBuilder]::new()
for ($i = 0; $i -lt $bytes.Length; $i++) {
  [void]$sb.Append([char]($bytes[$i] -bxor [int][char]$otp[$i]))
}
$rootToken = $sb.ToString()
Remove-Variable bytes, otp, sb

$resp = @{ root_token = $rootToken } | ConvertTo-Json
Save-CustodyFile -Path (Join-Path $CustodyDir 'emergency-root.json') -Content $resp
Write-Host "new root token generated and saved to custody (NOT displayed): $(Join-Path $CustodyDir 'emergency-root.json')"
Write-Host "ACTION: re-create operator tokens as -orphan, then REVOKE this root immediately."
Write-Host "ACTION: remove disable_unauthed_generate_root_endpoints=false from the server HCL afterwards."