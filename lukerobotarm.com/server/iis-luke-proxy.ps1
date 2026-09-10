# Run elevated on the IIS box. Writes the /api reverse proxy into applicationHost.config
# (web.config <rewrite> is locked on this server → 500.19).
# Usage: powershell -ExecutionPolicy Bypass -File server\iis-luke-proxy.ps1
$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this elevated on the IIS server.'
}

$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'
if (-not (Test-Path $appcmd)) { throw "appcmd not found: $appcmd" }

Add-Type -AssemblyName Microsoft.Web.Administration
$mgr = New-Object Microsoft.Web.Administration.ServerManager
$site = $mgr.Sites | Where-Object {
  $_.Name -match 'lukerobotarm' -or
  ($_.Bindings | Where-Object { $_.BindingInformation -match 'lukerobotarm' })
} | Select-Object -First 1
if (-not $site) {
  Write-Host 'IIS sites:'
  $mgr.Sites | ForEach-Object { Write-Host ('  ' + $_.Name) }
  throw 'No site matching lukerobotarm. Edit this script and set $site by name.'
}
$siteName = $site.Name
Write-Host "Site: $siteName"

# Poison: deployed api/web.config with <rewrite>/<httpErrors> → 500.19 for /api only.
$root = [Environment]::ExpandEnvironmentVariables($site.Applications['/'].VirtualDirectories['/'].PhysicalPath)
$poison = Join-Path $root 'api\web.config'
if (Test-Path $poison) {
  Remove-Item $poison -Force
  Write-Host "Removed $poison"
}

# Unlock so a future web.config cannot 500.19 the same way (optional; rule itself goes in applicationHost).
& $appcmd unlock config -section:system.webServer/rewrite | Write-Host
& $appcmd unlock config -section:system.webServer/httpErrors | Write-Host
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /commit:apphost | Write-Host

$config = $mgr.GetApplicationHostConfiguration()
$err = $config.GetSection('system.webServer/httpErrors', $siteName)
$err.SetAttributeValue('errorMode', 'Detailed')
$err.SetAttributeValue('existingResponse', 'PassThrough')

$proxy = $config.GetSection('system.webServer/proxy')
$proxy.SetAttributeValue('enabled', $true)

$rules = $config.GetSection('system.webServer/rewrite/rules', $siteName).GetCollection()
for ($i = $rules.Count - 1; $i -ge 0; $i--) {
  if ($rules[$i].GetAttributeValue('name') -eq 'Luke session API') { $rules.RemoveAt($i) }
}
$rule = $rules.CreateElement('rule')
$rule.SetAttributeValue('name', 'Luke session API')
$rule.SetAttributeValue('stopProcessing', $true)
$rule.GetChildElement('match').SetAttributeValue('url', '^api/luke-(session|chat)(.*)')
$action = $rule.GetChildElement('action')
$action.SetAttributeValue('type', 'Rewrite')
$action.SetAttributeValue('url', 'http://127.0.0.1:8787/api/luke-{R:1}{R:2}')
$rules.Add($rule)
$mgr.CommitChanges()
Write-Host 'Wrote rewrite + detailed errors to applicationHost.'

try {
  $n = Invoke-WebRequest -Uri 'http://127.0.0.1:8787/api/luke-session' -UseBasicParsing
  Write-Host "Node $($n.StatusCode) $($n.Content)"
} catch {
  Write-Warning "Node not reachable at http://127.0.0.1:8787/api/luke-session"
  Write-Warning $_.Exception.Message
  Write-Warning 'Start: node server/luke-chat.mjs --listen   (GEMINI_API_KEY set, LUKE_RELEASE=1 or NODE_ENV=production)'
}

try {
  $i = Invoke-WebRequest -Uri 'https://lukerobotarm.com/api/luke-session' -UseBasicParsing
  Write-Host "IIS $($i.StatusCode) $($i.Content)"
} catch {
  Write-Warning "IIS proxy test failed: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Warning $reader.ReadToEnd()
  }
}
