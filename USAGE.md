# md-to-pdf-cli 使用說明手冊

本工具為高保真 Markdown 轉 PDF 工具，核心程式集中於 `C:\PROJECT\md-to-pdf-cli` 維護。您**完全不需要管理員權限（免網管密碼）**，即可透過多種彈性方式在任何資料夾中輕鬆轉檔。

---

## 🚀 三種使用模式（皆免管理員權限）

### 模式一：複製 `convert_to_pdf.bat` 到目標資料夾（完全相容舊習慣）

如果您習慣在放有 `.md` 檔案的資料夾裡放置批次檔雙擊執行，現在可以直接使用：

1. **複製檔案**：只需將 `C:\PROJECT\md-to-pdf-cli\convert_to_pdf.bat` 複製到放有 Markdown 的資料夾即可。
2. **無需修改內容**：此 `.bat` 內建自動尋路邏輯：
   - 當前目錄如果沒有 `md_to_pdf.js`，會自動連動 `C:\PROJECT\md-to-pdf-cli\md_to_pdf.js` 核心引擎。
   - 轉檔的目標目錄永遠是以「您放置/執行 `.bat` 的當前位置」為準。
3. **執行方式**：
   - **直接雙擊 `convert_to_pdf.bat`**：
     智慧掃描目錄下所有 `.md` 檔案。若目標 `.pdf` 已經存在且修改時間較新，會自動略過；只會編譯新修改或未轉檔的文件。
   - **指令列指定單一或多個檔案**：
     ```cmd
     convert_to_pdf.bat "US7995859_MD核實報告.md"
     convert_to_pdf.bat chap1.md chap2.md
     ```
   - **強制全部重新編譯**：
     ```cmd
     convert_to_pdf.bat --force
     ```
   - **滑鼠拖曳**：在檔案總管中，選取一個或多個 `.md` 檔，直接用滑鼠拖曳放到 `convert_to_pdf.bat` 圖示上即可轉檔。

---

### 模式二：Windows 右鍵「傳送到」(SendTo) 選單（最省力，連 bat 都不用複製）

此方式利用 Windows 內建的使用者個人傳送選單，**完全不需要系統管理員權限**。

1. **一鍵安裝**：
   雙擊執行 `C:\PROJECT\md-to-pdf-cli\install_sendto.bat` 即可完成設定。
2. **日常使用方式**：
   在電腦任何資料夾中，選取任何一個或多個 `.md` 檔案：
   👉 **按滑鼠右鍵 -> 點選「傳送到 (Send to)」 -> 選擇「Markdown to PDF」**
3. 程式會立即彈出視窗完成轉檔，並將高品質 PDF 儲存在相同目錄。

---

### 模式三：設定「使用者個人」環境變數（免網管密碼，全域指令）

如果您想在命令提示字元 (CMD) 或 PowerShell 中隨處輸入 `md2pdf`，但目前沒有網管密碼修改「系統變數」：

> **重要觀念**：Windows 環境變數分為「系統層級（需網管密碼）」與「目前使用者層級（無需任何密碼，當前使用者可完全自主修改）」。

只要在一般 CMD（非管理員）中執行以下這行指令，即可將本工具加到您的使用者變數中：

```cmd
setx PATH "%PATH%;C:\PROJECT\md-to-pdf-cli"
```

執行後關閉並重新開啟終端機視窗，即可在任何目錄直接執行：
```bash
md2pdf                  # 增量轉換當前目錄下的 md 檔
md2pdf "my_doc.md"      # 轉換指定檔案
md2pdf --force          # 強制重新編譯所有檔案
```

---

## 💡 特殊情況與自動防護機制

1. **PDF 檔案被開啟鎖定（EBUSY / 資源鎖定）**：
   - 若您在 Acrobat Reader 或 Edge 瀏覽器中開著目標 PDF，一般工具轉檔會直接崩潰報錯。
   - 本工具具備自動降級容錯：偵測到被鎖定時，會自動另存為 `<檔名>_fixed.pdf`，轉檔絕不中斷。

2. **數學公式下劃線與 LaTeX 相容性**：
   - 全面支援行內 `$..$`、區塊 `$$..$$`、`\[..\]` 以及反引號公式。
   - 採用獨立 Token 隔離保護管線，公式內的下劃線（如 `\text{ref\_gt}`、`T_{\text{FPA}}`）不會被 Markdown 誤判為 HTML 斜體。

3. **Mermaid 流程圖與狀態圖**：
   - 支援 `stateDiagram-v2`、`flowchart TD` 等語法，由 Headless 渲染引擎自動保證非同步圖表繪製完成後才輸出向量 PDF。

---

## 🛠️ 程式碼維護與 GitHub 同步

- **唯一維護位置**：`C:\PROJECT\md-to-pdf-cli`
- 若未來有修改 `md_to_pdf.js`，所有資料夾與右鍵選單都會**自動繼承最新版修正**，無需重新分發。
- 推送至 GitHub：
  ```cmd
  cd /d C:\PROJECT\md-to-pdf-cli
  git add .
  git commit -m "docs: update usage guide"
  git push -u origin main
  ```
