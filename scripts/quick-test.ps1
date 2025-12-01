# Quick Test Script for Marketplace Service
# Usage: powershell -ExecutionPolicy Bypass -File scripts/quick-test.ps1
# Or: npm run quick:test (after adding the npm script)

param(
    [int]$Port = 3002,
    [switch]$UseMongo,
    [string]$MongoUrl = 'mongodb://127.0.0.1:27017/axiom_market'
)

Write-Host "[quick-test] Setting environment variables" -ForegroundColor Cyan
$env:MARKET_PORT = "$Port"
$env:MARKET_ALLOW_DB_FAIL = if($UseMongo) { '0' } else { '1' }
if($UseMongo){ $env:MARKET_MONGO_URL = $MongoUrl; $env:MARKET_CREATE_INDEXES_ON_START='1' }
$env:MARKET_SEED_DEMO = '1'
$env:MARKET_ENABLE_FUZZY = '1'
$env:MARKET_FUZZY_THRESHOLD = '0.7'
$env:METRICS_ENABLED = '1'
$env:MARKET_REQUIRE_JWT = '0'
$env:MARKET_ALLOWED_DEV_FALLBACK = '1'

Write-Host "[quick-test] Starting server on port $Port" -ForegroundColor Cyan
$serverProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4

function InvokeJson($method, $url, $body){
  try {
    if($method -eq 'GET') { return Invoke-RestMethod -Method GET -Uri $url -Headers @{ 'Authorization'='Bearer devUser123' } }
    else { return Invoke-RestMethod -Method $method -Uri $url -Headers @{ 'Authorization'='Bearer devUser123'; 'Content-Type'='application/json' } -Body ($body | ConvertTo-Json -Depth 6) }
  } catch { Write-Warning "Request failed: $method $url -> $($_.Exception.Message)"; return $null }
}

Write-Host "[quick-test] Ingesting sample product" -ForegroundColor Yellow
# Use ingestion pipeline route ensuring product searchable in memory repo
$product = InvokeJson 'POST' "http://localhost:$Port/api/market/ingest/products" @{ countryCode='SA'; vendorId='101'; categoryId='07'; name='Premium Marble Slab'; thickness='2 cm'; material='marble'; price=123; currency='SAR' }

Write-Host "[quick-test] Adding to cart" -ForegroundColor Yellow
$sku = if($product -and $product.sku){ $product.sku } else { 'LP-MKT-SA-101-07-XXXX' }
$addCart = InvokeJson 'POST' "http://localhost:$Port/api/market/cart" @{ sku=$sku; quantity=1 }

Write-Host "[quick-test] Creating order" -ForegroundColor Yellow
$order = InvokeJson 'POST' "http://localhost:$Port/api/market/orders" @{ currency='SAR' }
$orderId = $order.id
Write-Host "[quick-test] Order ID: $orderId" -ForegroundColor Green

Write-Host "[quick-test] Running baseline search (marble)" -ForegroundColor Yellow
$searchOk = InvokeJson 'GET' "http://localhost:$Port/api/market/search?q=marble&limit=3" $null

Write-Host "[quick-test] Running failing search to trigger fuzzy (xremum)" -ForegroundColor Yellow
$searchFuzzy = InvokeJson 'GET' "http://localhost:$Port/api/market/search?q=xremum&limit=5" $null

Write-Host "[quick-test] Metrics snapshot (selected patterns)" -ForegroundColor Yellow
$metricsRaw = try { Invoke-RestMethod -Method GET -Uri "http://localhost:$Port/metrics" } catch { '' }
$metricsLines = $metricsRaw -split "`n" | Where-Object { $_ -match 'search_fuzzy_|market_search_' }

Write-Host "\n=== Summary ===" -ForegroundColor Cyan
Write-Host "Product create response: $($product | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
Write-Host "Order create response: $($order | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
Write-Host "Baseline search total: $($searchOk.total)" -ForegroundColor Gray
Write-Host "Fuzzy search flags: fallback=$($searchFuzzy.fallback -ne $null) fuzzy=$($searchFuzzy.fuzzy -ne $null) total=$($searchFuzzy.total)" -ForegroundColor Gray
Write-Host "Metrics lines:" -ForegroundColor Gray
$metricsLines | ForEach-Object { Write-Host $_ }

Write-Host "[quick-test] Done. Stop server with: Stop-Process -Id $($serverProcess.Id)" -ForegroundColor Cyan
