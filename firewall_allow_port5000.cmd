@echo off
:: Run this file as Administrator: right-click -> Run as administrator
:: Opens inbound TCP 5000 on Private networks (Flask dev server for phone on Wi-Fi)

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo ERROR: Right-click this file and choose "Run as administrator"
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="UpKeep Flask port 5000" >nul 2>&1
netsh advfirewall firewall add rule name="UpKeep Flask port 5000" dir=in action=allow protocol=TCP localport=5000 profile=private

echo.
echo Done. Rule added for TCP port 5000 on Private profile.
echo Try your phone again: http://YOUR_PC_IP:5000
echo.
pause
