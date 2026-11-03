@echo off
chcp 65001 > nul
node "%~dp0md_to_pdf.js" %*
