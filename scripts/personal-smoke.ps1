Param(
  [string]$Port = "5600",
  [string]$ApiKey = "TESTKEY",
  [string]$MemKey = "0123456789abcdef0123456789abcdef",
  [string]$Prompt = "اختبار"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

Write-Host "Starting personal assistant on port $Port..."
$job = Start-Job -ScriptBlock {
  Param($root,$Port,$ApiKey,$MemKey)
  Push-Location $root
  $env:PERSONAL_PORT = $Port
  $env:PERSONAL_API_KEY = $ApiKey
  $env:PERSONAL_MEM_KEY = $MemKey
  node server-personal.js
} -ArgumentList $root,$Port,$ApiKey,$MemKey

Start-Sleep -Seconds 1
$base = "http://localhost:$Port"
$headers = @{ "X-API-KEY" = $ApiKey }

Write-Host "HEALTH:" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$base/healthz" -Headers $headers -TimeoutSec 10
$health | ConvertTo-Json -Depth 4 | Write-Output

Write-Host "CHAT:" -ForegroundColor Cyan
$chatBody = @{ sessionId = "smoke"; prompt = $Prompt } | ConvertTo-Json
$chat = Invoke-RestMethod -Uri "$base/api/personal/chat" -Method Post -Headers $headers -ContentType "application/json" -Body $chatBody
$chat | ConvertTo-Json -Depth 4 | Write-Output

Write-Host "STREAM (headers + first lines):" -ForegroundColor Cyan
$streamBody = @{ sessionId = "smoke2"; prompt = "stream!" } | ConvertTo-Json
$resp = Invoke-WebRequest -Uri "$base/api/personal/chat/stream" -Method Post -Headers $headers -ContentType "application/json" -Body $streamBody -TimeoutSec 10
$resp.Headers["Content-Type"] | Write-Output
($resp.Content -split "`n")[0..5] -join "`n" | Write-Output

Write-Host "Stopping server..." -ForegroundColor Yellow
Stop-Job $job.Id
Remove-Job $job.Id
Write-Host "Done." -ForegroundColor Green