# Forwards the phone's "localhost" to your PC for Metro (8081) and Flask (5000).
# Without tcp:5000, login/API calls fail with Arabic "تعذر الاتصال بالخادم..." while Expo itself works.
#
# Prerequisites: USB cable, USB debugging ON, phone authorized, platform-tools unzipped.
#
# Usage (PowerShell):
#   1. Point $PlatformTools at the folder that CONTAINS adb.exe, OR set env:
#      $env:ANDROID_PLATFORM_TOOLS = "C:\path\to\platform-tools"
#   2. Connect phone via USB, unlock screen.
#   3. Run: .\scripts\adb-reverse-metro.ps1
#
# Then in mobile/.env use (USB dev only):
#   EXPO_PUBLIC_API_URL=http://127.0.0.1:5000
# Restart Expo after changing .env. Switch back to http://<PC-LAN-IP>:5000 when on same Wi‑Fi without USB API forwarding.

param(
    [string] $PlatformTools = $env:ANDROID_PLATFORM_TOOLS
)

$adb = $null
if ($PlatformTools -and (Test-Path (Join-Path $PlatformTools "adb.exe"))) {
    $adb = Join-Path $PlatformTools "adb.exe"
}
if (-not $adb) {
    $candidates = @(
        "$env:USERPROFILE\Downloads\platform-tools\adb.exe",
        "C:\platform-tools\adb.exe",
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $adb = $c
            break
        }
    }
}
if (-not $adb) {
    Write-Host "Could not find adb.exe." -ForegroundColor Red
    Write-Host "Unzip platform-tools, then either:" -ForegroundColor Yellow
    Write-Host "  `$env:ANDROID_PLATFORM_TOOLS = 'C:\full\path\to\platform-tools'" -ForegroundColor Cyan
    Write-Host "  .\scripts\adb-reverse-metro.ps1 -PlatformTools 'C:\full\path\to\platform-tools'" -ForegroundColor Cyan
    exit 1
}

Write-Host "Using: $adb" -ForegroundColor Green
& $adb version
Write-Host "`nDevices (must show your phone as 'device', not 'unauthorized'):" -ForegroundColor Yellow
& $adb devices
Write-Host "`nSetting reverse tcp:8081 -> this PC Metro..." -ForegroundColor Yellow
& $adb reverse tcp:8081 tcp:8081
if ($LASTEXITCODE -ne 0) {
    Write-Host "adb reverse failed. Check USB debugging and cable." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Setting reverse tcp:5000 -> Flask on this PC (if you use another port, add another adb reverse line)..." -ForegroundColor Yellow
& $adb reverse tcp:5000 tcp:5000
if ($LASTEXITCODE -ne 0) {
    Write-Host "adb reverse tcp:5000 failed (Metro 8081 is still set)." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "OK." -ForegroundColor Green
Write-Host "  Expo Go / Metro: exp://127.0.0.1:8081  (use npm run start:usb or expo start --localhost)" -ForegroundColor Cyan
Write-Host "  API (.env):      EXPO_PUBLIC_API_URL=http://127.0.0.1:5000  then restart Expo" -ForegroundColor Cyan
Write-Host "Keep USB connected. Re-run this script after unplugging the phone." -ForegroundColor Gray
