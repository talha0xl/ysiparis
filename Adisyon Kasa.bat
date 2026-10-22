@echo off
title Adisyon Kasa
REM Yavuzturk Adisyon - kasa penceresi (fisleri onay sormadan basar)
set "SITE=https://ysiparis.vercel.app"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome bulunamadi. Once Chrome'u kur.
  pause
  exit /b
)

echo Aciliyor: %SITE%/#/kasa
start "" "%CHROME%" --kiosk-printing --user-data-dir="%LocalAppData%\AdisyonKasa2" --app="%SITE%/#/kasa"
timeout /t 3 >nul
