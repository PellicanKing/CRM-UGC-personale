@echo off
rem Opens the configuration file (.env.local) in Notepad.
cd /d "%~dp0"
if not exist .env.local copy .env.example .env.local >nul
notepad .env.local
