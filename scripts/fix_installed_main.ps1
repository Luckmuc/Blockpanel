# Fix installed backend main.py: create backup, replace broken fallback block, py_compile, restart Blockpanel and test /
$path = 'C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\resources\backend\main.py'
if (-Not (Test-Path $path)) { Write-Output "ERROR: file not found: $path"; exit 1 }
$bak = $path + ".bak_" + (Get-Date -Format yyyyMMddHHmmss)
Copy-Item -Path $path -Destination $bak -Force
Write-Output "Backup created: $bak"
$s = Get-Content -Raw -Path $path
# Replace the large fallback else: ... if __name__ == "__main__": block with a safe, single-line HTMLResponse version
$pattern = '(?s)else:\s*?\n\s*?print\(\'Frontend not found - serving fallback\'\)[\s\S]*?\nif __name__ == "__main__":'
$replacement = @'
else:
    print('Frontend not found - serving fallback')
    print('Checked paths:')
    for p in frontend_dist_paths:
        print(f"  {p} - exists: {p.exists()}, has index.html: {(p / 'index.html').exists() if p.exists() else False)")

    @app.get('/')
    async def serve_fallback():
        return HTMLResponse("<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href='/docs'>/docs</a></p>")

    @app.get('/{path:path}')
    async def serve_fallback_catch_all(path: str = ''):
        if path.startswith('api/'):
            raise HTTPException(status_code=404, detail='API endpoint not found')
        return HTMLResponse("<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href='/docs'>/docs</a></p><p>Current working directory: " + str(Path.cwd()) + "</p>")

if __name__ == "__main__":
'@
try {
    $new = [regex]::Replace($s, $pattern, $replacement, 'Singleline')
    if ($new -eq $s) { Write-Output "No replacement made - pattern not found" }
    else { Set-Content -Path $path -Value $new -Encoding UTF8; Write-Output "Patched file written." }
} catch {
    Write-Output "Error during patch: $_"
    exit 1
}
Write-Output "----- py_compile -----"
py -3 -m py_compile $path
Write-Output "py_compile exit:$LASTEXITCODE"
# Stop any process listening on 1105
$listener = netstat -ano | Select-String ':1105' | Where-Object { $_.Line -match '\bLISTENING\b' } | Select-Object -First 1
if ($listener) {
    $parts = ($listener.Line -split '\s+') | Where-Object { $_ -ne '' }
    $pid = $parts[-1]
    Write-Output "Listen PID: $pid"
    try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Output "Stopped PID $pid" } catch { Write-Output "Could not stop PID $pid: $_" }
} else { Write-Output "No listener found" }
Start-Sleep -Seconds 1
Write-Output "Starting Blockpanel.exe..."
Start-Process -FilePath "C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\Blockpanel.exe"
Start-Sleep -Seconds 4
Write-Output "Testing GET /"
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:1105/" -UseBasicParsing -TimeoutSec 10; Write-Output "Status: $($r.StatusCode)"; $content = $r.Content; if ($content.Length -gt 800) { $content = $content.Substring(0,800) + "..." }; Write-Output "Content (truncated):`n" + $content } catch { Write-Output "Request failed: $_" }
