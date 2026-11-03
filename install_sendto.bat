@echo off
chcp 65001 > nul
echo ========================================================
echo  建立 Windows 右鍵「傳送到」(SendTo) 選單捷徑
echo ========================================================
echo.

set "TARGET_BAT=%APPDATA%\Microsoft\Windows\SendTo\Markdown 轉 PDF.bat"

(
  echo @echo off
  echo chcp 65001 ^> nul
  echo echo [Markdown 轉 PDF] 開始轉換選取的檔案...
  echo echo.
  echo node "%~dp0md_to_pdf.js" %%*
  echo echo.
  echo pause
) > "%TARGET_BAT%"

if exist "%TARGET_BAT%" (
  echo [成功] 已在右鍵「傳送到」選單中新增「Markdown 轉 PDF」！
  echo.
  echo 使用方式：
  echo 1. 在檔案總管選取任一個或多個 .md 檔案。
  echo 2. 按滑鼠右鍵 -^>「傳送到」-^>「Markdown 轉 PDF」。
  echo 3. 程式將自動在該目錄生成高解析度 PDF。
) else (
  echo [失敗] 無法寫入 SendTo 目錄，請檢查權限。
)

echo.
pause
