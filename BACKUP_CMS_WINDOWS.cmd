@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\BACKUP_CMS_WINDOWS.ps1"
if errorlevel 1 pause
