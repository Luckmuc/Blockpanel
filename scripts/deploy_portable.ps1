<#
Portable deploy helper
Copies necessary repo files to a target folder and creates a start script that runs the backend headless and opens browser.
Usage:
  .\deploy_portable.ps1 -TargetPath 'C:\Temp\BlockpanelPortable' -Overwrite
#>
param(
  [string]$TargetPath = "$env:USERPROFILE\Desktop\BlockpanelPortable",
  [switch]$Overwrite
)

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$backendSrc = Join-Path $root 'backend'
$windowsAppSrc = Join-Path $root 'windows-app'

if (Test-Path $TargetPath) {
  if ($Overwrite) { Remove-Item -Recurse -Force -Path $TargetPath }
  else { Write-Error "Target $TargetPath exists. Use -Overwrite to replace."; exit 1 }
}

Write-Output "Creating target: $TargetPath"
New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null

Write-Output "Copying backend..."
Copy-Item -Path $backendSrc -Destination (Join-Path $TargetPath 'backend') -Recurse -Force

Write-Output "Copying windows-app (launcher script)..."
Copy-Item -Path $windowsAppSrc -Destination (Join-Path $TargetPath 'windows-app') -Recurse -Force

# Create a minimal start script that attempts to use a bundled python if present, otherwise system python
$startPs = @'
# Start Blockpanel portable (headless) and open browser
param(
  [string]$PythonExe = "",
  [int]$Port = 1105
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backend = Join-Path $root 'backend'
if (-not $PythonExe) {
  # Prefer bundled python in resources\python
  $possible = @(
    Join-Path $root 'python\python.exe',
    'python',
    'py'
  )
  foreach ($p in $possible) {
    try { $ver = & $p --version 2>&1; if ($ver -match 'Python 3') { $PythonExe = $p; break } } catch { }
  }
}
if (-not $PythonExe) { Write-Error 'No Python 3 found in PATH or bundled. Please install Python 3.8+'; exit 2 }
Write-Output "Using Python: $PythonExe"
Start-Process -FilePath $PythonExe -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port',"$Port" -WorkingDirectory $backend
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:$Port/"
'@

$startPath = Join-Path $TargetPath 'start-headless.ps1'
Set-Content -Path $startPath -Value $startPs -Encoding UTF8
Write-Output "Wrote start script: $startPath"

Write-Output "Portable deploy finished. Run start-blockpanel.ps1 in $TargetPath to launch backend and open browser."
