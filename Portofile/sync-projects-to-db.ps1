# Sync all projects from content.json to MongoDB via API
param(
    [string]$ApiUrl = "http://localhost:3001/api",
    [string]$Email = "test@test.com",
    [string]$Password = "Test123!"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Syncing Projects to Database ===" -ForegroundColor Cyan

# 1. Login
Write-Host "`n[1/4] Logging in..." -ForegroundColor Yellow
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "Logged in successfully" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Load content.json
Write-Host "`n[2/4] Loading content.json..." -ForegroundColor Yellow
$contentPath = "content.json"
if (-not (Test-Path $contentPath)) {
    Write-Host "content.json not found" -ForegroundColor Red
    exit 1
}

$content = Get-Content $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$projects = $content.projects
Write-Host "Loaded $($projects.Count) projects" -ForegroundColor Green

# 3. Setup headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 4. Upload each project
Write-Host "`n[3/4] Uploading projects..." -ForegroundColor Yellow
$successCount = 0
$failCount = 0

foreach ($project in $projects) {
    $projectName = $project.title.ar
    Write-Host "`nProcessing: $projectName" -ForegroundColor Cyan
    
    $apiProject = @{
        slug = $project.id
        title = $project.title
        short_description = $project.description
        full_description = if ($project.full_description) { $project.full_description } else { $project.description }
        role = if ($project.role) { $project.role } else { @{ ar = ""; en = "" } }
        location = $project.location
        start_date = if ($project.year) { "$($project.year)-01-01" } else { "2024-01-01" }
        status = if ($project.status) { $project.status } else { "completed" }
        main_image_url = $project.thumbnail
        gallery = $project.gallery
        tags = if ($project.tags) { $project.tags } else { @() }
        openMode = if ($project.openMode) { $project.openMode } else { "modal" }
        category = $project.category
    }
    
    $projectJson = [System.Text.Encoding]::UTF8.GetBytes(($apiProject | ConvertTo-Json -Depth 10))
    
    try {
        # Try to update first (simpler than checking)
        try {
            Write-Host "  Checking if exists..." -ForegroundColor Gray
            $checkUrl = "$ApiUrl/projects?slug=$([uri]::EscapeDataString($project.id))&limit=1"
            $existingResponse = Invoke-RestMethod -Uri $checkUrl -Method GET -Headers $headers
            
            if ($existingResponse.projects -and $existingResponse.projects.Count -gt 0) {
                $projectId = $existingResponse.projects[0]._id
                Write-Host "  Updating existing (ID: $projectId)..." -ForegroundColor Yellow
                $response = Invoke-RestMethod -Uri "$ApiUrl/projects/$projectId" -Method PUT -Body $projectJson -Headers $headers -ContentType "application/json; charset=utf-8"
                Write-Host "  Updated" -ForegroundColor Green
                $successCount++
            } else {
                throw "Not found"
            }
        } catch {
            # Doesn't exist, create new
            Write-Host "  Creating new..." -ForegroundColor Gray
            $response = Invoke-RestMethod -Uri "$ApiUrl/projects" -Method POST -Body $projectJson -Headers $headers -ContentType "application/json; charset=utf-8"
            Write-Host "  Created" -ForegroundColor Green
            $successCount++
        }
    } catch {
        Write-Host "  Failed: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "`nDone! Refresh the website." -ForegroundColor Yellow
