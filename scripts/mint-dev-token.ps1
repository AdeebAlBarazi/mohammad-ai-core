Param(
  [string]$Secret = "dev-secret-123",
  [string]$UserId = "devuser",
  [string]$Username = "devuser",
  [string]$FullName = "Dev User",
  [ValidateSet("User","Seller","Admin")]
  [string]$Role = "User",
  [string]$ExpiresIn = "1h"
)

# Generates an HS256 JWT compatible with marketplace/auth expectations.
# Payload: { user: { id, username, fullName, role } }

function Base64UrlEncode([byte[]]$bytes) {
  $s = [Convert]::ToBase64String($bytes)
  $s = $s.TrimEnd('=')
  $s = $s.Replace('+','-').Replace('/','_')
  return $s
}

function HmacSha256Sign([string]$data, [string]$key) {
  $enc = [System.Text.Encoding]::UTF8
  # Correct constructor for Windows PowerShell 5.1: pass byte[] key
  $keyBytes = $enc.GetBytes($key)
  # Prevent argument array expansion: wrap in unary comma to pass as single [byte[]]
  $hmac = New-Object System.Security.Cryptography.HMACSHA256(, $keyBytes)
  $dataBytes = $enc.GetBytes($data)
  $signature = $hmac.ComputeHash($dataBytes)
  return Base64UrlEncode $signature
}

# Header
$headerObj = @{ alg = "HS256"; typ = "JWT" }
$headerJson = $headerObj | ConvertTo-Json -Compress
$headerB64 = Base64UrlEncode([System.Text.Encoding]::UTF8.GetBytes($headerJson))

# Payload with exp (ExpiresIn supports "1h" or seconds)
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$exp = $now + 3600
if($ExpiresIn -match '^(\d+)$'){ $exp = $now + [int]$ExpiresIn }
elseif($ExpiresIn -match '^(\d+)h$'){ $exp = $now + ([int]$Matches[1] * 3600) }
elseif($ExpiresIn -match '^(\d+)m$'){ $exp = $now + ([int]$Matches[1] * 60) }

$payloadObj = @{ user = @{ id = $UserId; username = $Username; fullName = $FullName; role = $Role }; exp = $exp; iat = $now }
$payloadJson = $payloadObj | ConvertTo-Json -Compress
$payloadB64 = Base64UrlEncode([System.Text.Encoding]::UTF8.GetBytes($payloadJson))

$unsigned = "$headerB64.$payloadB64"
$signatureB64 = HmacSha256Sign -data $unsigned -key $Secret
$token = "$unsigned.$signatureB64"

$env:AXIOM_USER_TOKEN = $token
Write-Host "Minted dev token and set AXIOM_USER_TOKEN." -ForegroundColor Green

# Output token and payload
[PSCustomObject]@{ token = $token; payload = $payloadObj } | ConvertTo-Json -Depth 4
