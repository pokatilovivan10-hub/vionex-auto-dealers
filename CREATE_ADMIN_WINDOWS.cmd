@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\CREATE_ADMIN_WINDOWS.ps1"
if errorlevel 1 pause
