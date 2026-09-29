# Helper: ejecuta comandos SSH en 192.168.1.37 (creds desde OpenBao local).
# Uso: . .\ssh-host.ps1 "comando"
param(
  [Parameter(Mandatory = $true)][string]$Command,
  [int]$TimeOutSec = 60
)
Import-Module Posh-SSH
$tok = (Get-Content "$env:USERPROFILE\.openbao-dev\custody\operator-admin.token" -Raw).Trim()
$d = (Invoke-RestMethod -Uri "http://127.0.0.1:8200/v1/secret/data/dev/infra/ssh-test-server" -Headers @{ "X-Vault-Token" = $tok } -TimeoutSec 10).data.data
$sec = ConvertTo-SecureString $d.PASS -AsPlainText -Force
$cred = New-Object PSCredential($d.USER, $sec)
$s = New-SSHSession -ComputerName 192.168.1.37 -Credential $cred -AcceptKey -ErrorAction Stop
try {
  $r = Invoke-SSHCommand -SessionId $s.SessionId -Command $Command -TimeOut $TimeOutSec
  $r.Output
  if ($r.Error) { $r.Error | ForEach-Object { Write-Error $_ } }
} finally {
  Remove-SSHSession -SessionId $s.SessionId | Out-Null
}