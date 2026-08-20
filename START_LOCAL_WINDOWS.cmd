@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\START_LOCAL_WINDOWS.ps1"
if errorlevel 1 pause
