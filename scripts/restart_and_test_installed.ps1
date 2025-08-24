# Stop any process listening on 1105, start Blockpanel.exe and test /
$listener = netstat -ano | Select-String ':1105' | Where-Object { $_.Line -match '\bLISTENING\b' } | Select-Object -First 1
if ($listener) {
    $parts = ($listener.Line -split '\s+') | Where-Object { $_ -ne '' }
    $pid = $parts[-1]
    Write-Output "Listen PID: $pid"
    try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Output "Stopped PID $pid" } catch { Write-Output ("Could not stop PID " + $pid); Write-Output $_.Exception.Message }
} else { Write-Output "No listener found" }
Start-Sleep -Seconds 1
Write-Output "Starting Blockpanel.exe..."
Start-Process -FilePath "C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\Blockpanel.exe"
Start-Sleep -Seconds 4
Write-Output "Testing GET /"
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:1105/" -UseBasicParsing -TimeoutSec 10
    Write-Output "Status: $($r.StatusCode)"
    $content = $r.Content
    if ($content.Length -gt 800) { $content = $content.Substring(0,800) + '...' }
    Write-Output "Content (truncated):`n" + $content
} catch {
    Write-Output "Request failed: $_"
}
