# Upload Images Script
# ===============================

# Settings
$API_URL = "http://localhost:3001/api"
$IMAGES_DIR = ".\assets\images\projects"
$EMAIL = "test@test.com"
$PASSWORD = "Test123!"

Write-Host "Starting upload process..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check if images directory exists
if (-not (Test-Path $IMAGES_DIR)) {
    Write-Host "ERROR: Images directory not found: $IMAGES_DIR" -ForegroundColor Red
    Write-Host "Please create the directory and add images first" -ForegroundColor Yellow
    exit 1
}

# Get list of images
$images = Get-ChildItem -Path $IMAGES_DIR -Include *.jpg,*.jpeg,*.png,*.webp -Recurse -File
if ($images.Count -eq 0) {
    Write-Host "WARNING: No images found in directory" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($images.Count) image(s)" -ForegroundColor Green
Write-Host ""

# Login
Write-Host "Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $EMAIL
        password = $PASSWORD
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    $token = $loginResponse.token
    Write-Host "Login successful" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Uploading images..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$uploadedImages = @()
$failedImages = @()
$counter = 0

foreach ($image in $images) {
    $counter++
    Write-Host "[$counter/$($images.Count)] Uploading: $($image.Name) ..." -NoNewline
    
    try {
        # Using .NET WebClient for proper multipart upload
        Add-Type -AssemblyName System.Net.Http
        $httpClient = New-Object System.Net.Http.HttpClient
        $httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer $token")
        
        $content = New-Object System.Net.Http.MultipartFormDataContent
        $fileStream = [System.IO.File]::OpenRead($image.FullName)
        $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/jpeg")
        $content.Add($fileContent, "image", $image.Name)
        
        $response = $httpClient.PostAsync("$API_URL/upload/image", $content).Result
        $responseBody = $response.Content.ReadAsStringAsync().Result
        $fileStream.Close()
        
        if ($response.IsSuccessStatusCode) {
            $uploadResponse = $responseBody | ConvertFrom-Json
            
            $uploadedImages += @{
                original = $image.Name
                url = $uploadResponse.url
                thumbnail = $uploadResponse.thumbnail
                medium = $uploadResponse.medium
                large = $uploadResponse.large
            }

            Write-Host " OK" -ForegroundColor Green
            Write-Host "   URL: $($uploadResponse.medium)" -ForegroundColor Gray
        } else {
            throw "HTTP $($response.StatusCode): $responseBody"
        }
        
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $failedImages += $image.Name
    }
    
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "   Success: $($uploadedImages.Count)" -ForegroundColor Green
Write-Host "   Failed: $($failedImages.Count)" -ForegroundColor $(if ($failedImages.Count -gt 0) { "Red" } else { "Gray" })
Write-Host "================================" -ForegroundColor Cyan

# Save results to JSON file
if ($uploadedImages.Count -gt 0) {
    $resultFile = "uploaded-images-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
    $uploadedImages | ConvertTo-Json -Depth 5 | Out-File $resultFile -Encoding UTF8
    Write-Host ""
    Write-Host "Results saved to: $resultFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
