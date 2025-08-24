$main = 'C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\resources\backend\main.py'
$content = Get-Content -LiteralPath $main -Raw
# Remove any appended block markers to avoid duplicates
if ($content -match '# --- appended by patch_installed_backend.ps1: serve / with index.html if available ---') {
  Write-Output 'Found existing appended block - leaving as-is'
} else {
  # Insert a robust root handler before the first catch-all "@app.get("/{path:path}")"
  $insertAt = ($content -split "\r?\n") | Select-String -Pattern '@app.get("/{path:path}")' -SimpleMatch -List | Select-Object -First 1
  if ($insertAt) {
    $lines = $content -split "\r?\n"
    $idx = $insertAt.LineNumber - 1
    $route = @"

# --- ensured root handler: serve index.html if available ---
from pathlib import Path
from fastapi.responses import FileResponse, HTMLResponse

@app.get("/")
async def ensured_serve_root():
    frontend_candidates = [
        Path(__file__).parent / 'frontend_dist',
        Path(__file__).parent.parent / 'frontend' / 'dist',
        Path(__file__).parent.parent.parent / 'frontend' / 'dist'
    ]
    for p in frontend_candidates:
        try:
            p = p.resolve()
        except Exception:
            pass
        idx = p / 'index.html'
        if idx.exists():
            return FileResponse(str(idx))
    return HTMLResponse('<h1>Blockpanel Backend</h1><p>Frontend not found yet.</p>')
# --- end ensured handler ---
"@
    $newLines = $lines[0..($idx-1)] + $route + $lines[$idx..($lines.Length-1)]
    $newContent = $newLines -join "`r`n"
    Set-Content -LiteralPath $main -Value $newContent -Encoding UTF8
    Write-Output 'Inserted ensured root handler before catch-all.'
  } else {
    Write-Output 'Could not locate catch-all route to insert before - aborting.'
  }
}
