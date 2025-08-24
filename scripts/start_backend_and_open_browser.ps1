# Dev helper: create venv, install requirements, start backend and open browser
param(
  [switch]$ReinstallDeps
)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$venv = Join-Path $root '.venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-Not (Test-Path $python)) {
  Write-Output "Creating venv..."
  py -3 -m venv $venv
}
if ($ReinstallDeps -or -Not (Test-Path (Join-Path $venv 'Lib\site-packages\uvicorn'))) {
  Write-Output "Installing Python dependencies into venv..."
  & $python -m pip install --upgrade pip
  & $python -m pip install -r (Join-Path $root 'backend\requirements.txt') uvicorn
}
# Start backend using backend working dir
Write-Output "Starting backend (uvicorn) in background..."
Start-Process -FilePath $python -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','1105' -WorkingDirectory (Join-Path $root 'backend')
Start-Sleep -Seconds 2
# Open browser
$uri = 'http://127.0.0.1:1105/'
Write-Output "Opening browser: $uri"
Start-Process $uri
Write-Output "Done. Use Ctrl+C in the uvicorn terminal if you started it manually; to stop background process use Task Manager or stop via scripts."
