# Deploys the Vite production build (./dist) to the IIS site share.
# Invoked by: npm run deploy  (build + this script)
#
# Target: \\DeltaWebsites\wwwroot\lukerobotarm.com\

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Join-Path $ScriptDir 'dist'
$TargetDir = '\\DeltaWebsites\wwwroot\lukerobotarm.com'
$AppOffline = Join-Path $TargetDir 'App_Offline.htm'

Write-Host "Deploy lukerobotarm.com -> $TargetDir" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $SourceDir)) {
    Write-Error "Build output not found: $SourceDir`nRun 'npm run build' first (or use 'npm run deploy')."
}

if (-not (Test-Path -LiteralPath (Join-Path $SourceDir 'index.html'))) {
    Write-Error "Missing index.html in $SourceDir - build may have failed."
}

if (-not (Test-Path -LiteralPath $TargetDir)) {
    Write-Host "Creating target directory: $TargetDir"
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# Take the site offline so IIS releases locks on static files (when App_Offline is honored).
$offlineHtml = @'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Updating</title></head>
<body style="font-family:system-ui;text-align:center;padding:3rem">
  <h1>Updating lukerobotarm.com…</h1>
  <p>Please retry in a few seconds.</p>
</body></html>
'@
try {
    Set-Content -LiteralPath $AppOffline -Value $offlineHtml -Encoding UTF8 -Force
    Write-Host "Placed App_Offline.htm"
    Start-Sleep -Seconds 1
} catch {
    Write-Warning "Could not write App_Offline.htm (continuing): $($_.Exception.Message)"
}

# Drop read-only / system bits that often cause "Access is denied" on network shares.
function Clear-FileAttributes([string]$Root) {
    if (-not (Test-Path -LiteralPath $Root)) { return }
    Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $_.Attributes = 'Normal'
        } catch {
            # ignore files we cannot touch yet
        }
    }
}

Write-Host "Clearing read-only attributes on target..."
Clear-FileAttributes $TargetDir

# robocopy is more reliable than Copy-Item for IIS wwwroot / UNC deploys:
#   /MIR  mirror source -> dest (adds new, updates changed, removes extras)
#   /R:3  retries on locked files
#   /W:2  wait 2s between retries
#   /NFL /NDL quieter logs; still show summary
# Exit codes 0-7 are success for robocopy.
Write-Host "Mirroring dist\ -> target with robocopy..."
$robolog = Join-Path $env:TEMP "lukerobotarm-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$roboArgs = @(
    $SourceDir,
    $TargetDir,
    '/MIR',
    '/R:5',
    '/W:2',
    '/FFT',       # 2-second timestamp granularity (SMB-friendly)
    '/Z',         # restartable mode over network
    '/XF', 'App_Offline.htm',  # keep offline marker until we remove it at the end
    '/NFL', '/NDL', '/NP',
    "/LOG:$robolog"
)

& robocopy @roboArgs | Out-Host
$roboExit = $LASTEXITCODE

if ($roboExit -ge 8) {
    Write-Host "robocopy log: $robolog" -ForegroundColor Yellow
    # Fallback: per-file copy for anything still missing / failed
    Write-Warning "robocopy reported errors (exit $roboExit). Trying per-file fallback..."
    Get-ChildItem -LiteralPath $SourceDir -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
        $dest = Join-Path $TargetDir $rel
        $destParent = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }
        $copied = $false
        for ($i = 1; $i -le 5 -and -not $copied; $i++) {
            try {
                if (Test-Path -LiteralPath $dest) {
                    try { (Get-Item -LiteralPath $dest).Attributes = 'Normal' } catch {}
                    Remove-Item -LiteralPath $dest -Force -ErrorAction Stop
                }
                Copy-Item -LiteralPath $_.FullName -Destination $dest -Force -ErrorAction Stop
                $copied = $true
            } catch {
                if ($i -eq 5) {
                    Write-Warning "Failed: $rel - $($_.Exception.Message)"
                } else {
                    Start-Sleep -Seconds 2
                }
            }
        }
    }
}

# Always bring the site back online
if (Test-Path -LiteralPath $AppOffline) {
    try {
        Remove-Item -LiteralPath $AppOffline -Force -ErrorAction Stop
        Write-Host "Removed App_Offline.htm"
    } catch {
        Write-Warning "Could not remove App_Offline.htm - delete it manually if the site stays offline: $AppOffline"
    }
}

$FileCount = (Get-ChildItem -LiteralPath $TargetDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'App_Offline.htm' }).Count

if ($roboExit -ge 8) {
    Write-Host "Deploy finished with warnings: $FileCount files in $TargetDir (see $robolog)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Deploy complete: $FileCount files in $TargetDir" -ForegroundColor Green
exit 0
