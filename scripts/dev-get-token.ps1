Param(
    [string]$EmailOrUsername = "devuser@example.com",
    [string]$Password = "Dev@12345",
    [string]$FullName = "Dev User",
    [string]$Username = "devuser",
    [switch]$Seller,
    [switch]$Admin
)

# Locate auth server port from runtime file or fallback
$authPort = 3001
$runtimePath = Join-Path (Split-Path $PSScriptRoot -Parent) "auth\runtime-port.txt"
if(Test-Path $runtimePath){
  try { $authPort = Get-Content $runtimePath | Select-Object -First 1 } catch {}
}

$base = "http://localhost:$authPort"
Write-Host "Using auth service at $base"

function Invoke-JsonPost {
  param([string]$Url, [hashtable]$Body)
  $json = ($Body | ConvertTo-Json -Depth 4)
  return Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body $json -TimeoutSec 10
}

# Try login first
try {
  $loginRes = Invoke-JsonPost -Url "$base/api/auth/login" -Body @{ emailOrUsername = $EmailOrUsername; password = $Password }
  if($loginRes -and $loginRes.token){
    $env:AXIOM_USER_TOKEN = $loginRes.token
    Write-Host "Logged in. Token set to AXIOM_USER_TOKEN." -ForegroundColor Green
    $loginRes | ConvertTo-Json -Depth 4
    exit 0
  }
} catch {
  Write-Host "Login failed, attempting register..." -ForegroundColor Yellow
}

# Register if login failed
$role = "User"
if($Seller){ $role = "Seller" }
if($Admin){ $role = "Admin" }

try {
  $regRes = Invoke-JsonPost -Url "$base/api/auth/register" -Body @{ email = $EmailOrUsername; username = $Username; password = $Password; fullName = $FullName; role = $role }
  if($regRes -and $regRes.token){
    $env:AXIOM_USER_TOKEN = $regRes.token
    Write-Host "Registered. Token set to AXIOM_USER_TOKEN." -ForegroundColor Green
    $regRes | ConvertTo-Json -Depth 4
    exit 0
  } else {
    Write-Host "Register response did not contain token." -ForegroundColor Red
    exit 2
  }
} catch {
  Write-Host "Register failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
