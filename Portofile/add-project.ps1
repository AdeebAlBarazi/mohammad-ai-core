# Quick Add Project to content.json
# ==================================

param(
    [string]$Title = "",
    [string]$Description = "",
    [string]$Location = ""
)

if (-not $Title) {
    Write-Host "Usage: .\add-project.ps1 -Title 'اسم المشروع' -Description 'الوصف' -Location 'الموقع'" -ForegroundColor Yellow
    exit 1
}

$content = Get-Content "content.json" | ConvertFrom-Json

$projectId = "project-" + (Get-Random -Minimum 1000 -Maximum 9999)

$newProject = @{
    id = $projectId
    title = @{
        ar = $Title
        en = ""
    }
    description = @{
        ar = $Description
        en = ""
    }
    category = @{
        ar = ""
        en = ""
    }
    location = @{
        ar = $Location
        en = ""
    }
    year = ""
    thumbnail = ""
    gallery = @()
}

$content.projects += $newProject
$content | ConvertTo-Json -Depth 10 | Out-File "content.json" -Encoding UTF8

Write-Host "Project added successfully!" -ForegroundColor Green
Write-Host "ID: $projectId" -ForegroundColor Cyan
Write-Host "Title: $Title" -ForegroundColor Cyan
