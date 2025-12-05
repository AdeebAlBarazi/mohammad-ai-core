# Update Content.json with Uploaded Images
# ==========================================

param(
    [string]$UploadedImagesFile = "",
    [string]$ProjectId = ""
)

# Find the latest uploaded images file if not specified
if (-not $UploadedImagesFile) {
    $latestFile = Get-ChildItem "uploaded-images-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestFile) {
        $UploadedImagesFile = $latestFile.Name
        Write-Host "Using latest upload file: $UploadedImagesFile" -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: No uploaded-images-*.json file found" -ForegroundColor Red
        Write-Host "Please run .\upload-images.ps1 first" -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-Path $UploadedImagesFile)) {
    Write-Host "ERROR: File not found: $UploadedImagesFile" -ForegroundColor Red
    exit 1
}

# Read uploaded images
$uploadedImages = Get-Content $UploadedImagesFile | ConvertFrom-Json
if (-not $uploadedImages) {
    Write-Host "ERROR: No images found in file" -ForegroundColor Red
    exit 1
}

# Convert to array if single object
if ($uploadedImages -isnot [array]) {
    $uploadedImages = @($uploadedImages)
}

Write-Host ""
Write-Host "Found $($uploadedImages.Count) uploaded image(s)" -ForegroundColor Green
Write-Host ""

# Read content.json
$contentFile = "content.json"
if (-not (Test-Path $contentFile)) {
    Write-Host "ERROR: content.json not found" -ForegroundColor Red
    exit 1
}

$content = Get-Content $contentFile -Raw | ConvertFrom-Json

# If ProjectId specified, update specific project
if ($ProjectId) {
    $project = $content.projects | Where-Object { $_.id -eq $ProjectId }
    if (-not $project) {
        Write-Host "ERROR: Project with ID '$ProjectId' not found" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Updating project: $($project.title.ar)" -ForegroundColor Cyan
    
    # Set thumbnail from first image
    if ($uploadedImages.Count -gt 0) {
        $project.thumbnail = $uploadedImages[0].medium
        Write-Host "  Set thumbnail: $($project.thumbnail)" -ForegroundColor Gray
    }
    
    # Add all images to gallery
    $project.gallery = @()
    foreach ($img in $uploadedImages) {
        $project.gallery += @{
            url = $img.large
            title = @{
                ar = ""
                en = ""
            }
            description = @{
                ar = ""
                en = ""
            }
        }
        Write-Host "  Added to gallery: $($img.large)" -ForegroundColor Gray
    }
    
} else {
    # Interactive mode - let user choose project
    Write-Host "Available projects:" -ForegroundColor Cyan
    Write-Host ""
    
    for ($i = 0; $i -lt $content.projects.Count; $i++) {
        $proj = $content.projects[$i]
        Write-Host "  [$($i+1)] $($proj.title.ar) (ID: $($proj.id))" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Enter project number (1-$($content.projects.Count)): " -ForegroundColor Yellow -NoNewline
    $choice = Read-Host
    
    $index = [int]$choice - 1
    if ($index -lt 0 -or $index -ge $content.projects.Count) {
        Write-Host "ERROR: Invalid choice" -ForegroundColor Red
        exit 1
    }
    
    $project = $content.projects[$index]
    Write-Host ""
    Write-Host "Updating project: $($project.title.ar)" -ForegroundColor Cyan
    
    # Set thumbnail from first image
    if ($uploadedImages.Count -gt 0) {
        $project.thumbnail = $uploadedImages[0].medium
        Write-Host "  Set thumbnail: $($project.thumbnail)" -ForegroundColor Gray
    }
    
    # Add all images to gallery
    $project.gallery = @()
    foreach ($img in $uploadedImages) {
        $project.gallery += @{
            url = $img.large
            title = @{
                ar = ""
                en = ""
            }
            description = @{
                ar = ""
                en = ""
            }
        }
        Write-Host "  Added to gallery: $($img.large)" -ForegroundColor Gray
    }
}

# Save content.json
$content | ConvertTo-Json -Depth 10 | Out-File $contentFile -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS! content.json updated" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Thumbnail: $($project.thumbnail)" -ForegroundColor White
Write-Host "  Gallery images: $($project.gallery.Count)" -ForegroundColor White
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
