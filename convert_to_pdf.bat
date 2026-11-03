@echo off
chcp 65001 > nul

set "SCRIPT_PATH=%~dp0md_to_pdf.js"
if not exist "%SCRIPT_PATH%" set "SCRIPT_PATH=C:\PROJECT\md-to-pdf-cli\md_to_pdf.js"

node "%SCRIPT_PATH%" %*

if "%~1"=="" pause
