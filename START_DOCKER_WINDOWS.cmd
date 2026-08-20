@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\START_DOCKER_WINDOWS.ps1"
if errorlevel 1 pause
