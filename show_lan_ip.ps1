# Shows IPv4 addresses to put in mobile/.env as EXPO_PUBLIC_API_URL=http://ADDRESS:5000
Write-Host ""
Write-Host "=== Use one of these IPs (same Wi-Fi as your phone) ===" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.'
} | Sort-Object InterfaceAlias | Format-Table IPAddress, InterfaceAlias -AutoSize
Write-Host "In mobile/.env set for example:" -ForegroundColor Yellow
Write-Host '  EXPO_PUBLIC_API_URL=http://192.168.x.x:5000' -ForegroundColor White
Write-Host "(Replace 192.168.x.x with one IP from the table.) Then restart Expo." -ForegroundColor Gray
Write-Host ""
