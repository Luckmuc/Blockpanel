# Patch installed Blockpanel backend to serve index.html at /
# Usage: open PowerShell as the same user that runs the app and run:
#   cd <path-to-this-repo>\scripts
#   .\patch_installed_backend.ps1

Write-Output "Searching for Blockpanel.exe..."
$found = Get-ChildItem -Path "$env:LOCALAPPDATA\Programs","C:\Program Files","C:\Program Files (x86)","$env:USERPROFILE\AppData\Local" -Filter 'blockpanel*.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $found) {
  Write-Output "No Blockpanel.exe found automatically. Please set the path manually by editing this script and setting $exe variable."
  exit 1
}
$exe = $found.FullName
Write-Output "Found exe: $exe"
$inst = Split-Path $exe -Parent
$resBackend = Join-Path $inst 'resources\backend'
$main = Join-Path $resBackend 'main.py'

if (-not (Test-Path $main)) {
  Write-Output "Could not find installed main.py at $main. Check the install location and rerun."
  exit 1
}

# Backup
$bak = "$main.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
Copy-Item -Path $main -Destination $bak -Force
Write-Output "Backup created: $bak"

# Check if route already present
# Use single-quoted literal so PowerShell doesn't try to parse embedded quotes/escapes
$already = Select-String -Path $main -Pattern '@app.get("/")' -SimpleMatch -ErrorAction SilentlyContinue
if ($already) {
  Write-Output "Root route already present in $main. No changes made."
  exit 0
}

# Append route block
$append = @'

# --- appended by patch_installed_backend.ps1: serve / with index.html if available ---
try:
    from pathlib import Path
    from fastapi.responses import FileResponse, HTMLResponse

    @app.get("/")
    async def serve_root():
        # Try common frontend locations bundled with the app
        frontend_candidates = [
            Path(__file__).parent / 'frontend_dist',
            Path(__file__).parent.parent / 'frontend' / 'dist',
            Path(__file__).parent / '..' / 'frontend' / 'dist'
        ]
        for p in frontend_candidates:
            try:
                p = p.resolve()
            except Exception:
                pass
            idx = p / 'index.html'
            if idx.exists():
                return FileResponse(str(idx))
        # Fallback message
        return HTMLResponse('<h1>Blockpanel Backend</h1><p>Frontend not found.</p>')
except Exception as e:
    print('Error in appended serve_root:', e)

# --- end appended block ---
'@

Add-Content -Path $main -Value $append -Encoding UTF8
Write-Output "Appended root handler to $main"

Write-Output "Done. Restart Blockpanel (or log out/in) and test http://127.0.0.1:1105/"
