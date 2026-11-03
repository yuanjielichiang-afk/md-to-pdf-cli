@echo off
set "TARGET=%APPDATA%\Microsoft\Windows\SendTo\Markdown to PDF.bat"

(
  echo @echo off
  echo chcp 65001 ^> nul
  echo node "%~dp0md_to_pdf.js" %%*
  echo echo.
  echo pause
) > "%TARGET%"

echo [Success] Added 'Markdown to PDF' to Windows SendTo context menu!
echo Target: %TARGET%
pause
