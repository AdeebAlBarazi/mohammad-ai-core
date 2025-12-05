<#
 check-encoding.ps1
 Scans text files for potential mojibake (UTF-8 viewed as ISO-8859-1) patterns like sequences starting with \u00D8 (Ø) and \u00D9 (Ù) in excess.
#>
param(
  [string]$Root = '.',
  [string[]]$Extensions = @('*.html','*.js','*.css','*.json')
)
Write-Host "=== Encoding Audit ===" -ForegroundColor Cyan
$files = foreach($ext in $Extensions){ Get-ChildItem -Path $Root -Recurse -File -Include $ext }
if(-not $files){ Write-Host "No files matched" -ForegroundColor Yellow; exit }
$results = @()
foreach($f in $files){
  try {
    $raw = Get-Content $f.FullName -Raw -ErrorAction Stop
    # Count suspicious characters
    $suspectCount = ([regex]::Matches($raw,'[ØÙÂ]{1,}')).Count
    $arabicCount = ([regex]::Matches($raw,'[\u0600-\u06FF]')).Count
    $ratio = if($suspectCount -gt 0){ [Math]::Round(($suspectCount / ($arabicCount + 1)),2) } else { 0 }
    if($suspectCount -gt 10 -and $arabicCount -eq 0){
      $results += [pscustomobject]@{ File=$f.FullName; Suspect=$suspectCount; Arabic=$arabicCount; Ratio=$ratio }
    }
  } catch { }
}
if($results.Count){
  Write-Host "Possible mojibake detected:" -ForegroundColor Red
  $results | Sort-Object Ratio -Descending | Format-Table -AutoSize
} else {
  Write-Host "No obvious mojibake issues found." -ForegroundColor Green
}
Write-Host "Done." -ForegroundColor Cyan
