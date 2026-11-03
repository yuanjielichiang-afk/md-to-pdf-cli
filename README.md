# md-to-pdf-cli

> **高保真 Markdown 轉 PDF 工具 (High-Fidelity Markdown to PDF Converter)**  
> 專為工程論文、專利分析筆記、技術規格書打造，完美支援 **KaTeX 向量數學公式**、**Mermaid 架構與狀態圖表** 及 **繁體中文優化排版**。

---

## 🌟 核心特色

1. **極致清晰的向量數學公式 (KaTeX Vector Math)**
   - 支援區塊公式 `$$...$$` 與 `\[...\]`。
   - 支援行內公式 `$..$` 以及程式碼反引號語法（如 `` `D_{i,j}=...` ``）。
   - 自動將 KaTeX 向量字型轉換為本機絕對路徑，確保產出之 PDF 放大至任何倍率皆不失真，並支援公式複製。
   - 獨創 **Placeholder Token Pipeline** 架構：公式渲染後以安全符標佔位，隔絕 `markdown-it` 解析干擾，徹底杜絕下劃線（如 `\text{ref\_gt}`）被錯誤解析為 HTML 斜體標籤 `<em>` 的問題。

2. **Mermaid 流程圖與架構圖 (Mermaid Diagrams)**
   - 支援 `flowchart`、`graph`、`sequenceDiagram`、`stateDiagram-v2` 等多種 Mermaid 語法。
   - Headless Edge 透過虛擬渲染時限與渲染階段同步保證（`--virtual-time-budget`），確保非同步繪製圖表 100% 完整捕捉進 PDF。

3. **優雅的繁體中文與技術文件排版**
   - 採用標準 GitHub 現代簡潔風格 CSS。
   - 針對微軟正黑體、標楷體及英數等寬字體進行行高與天花板基線微調。
   - 預設包含頁面邊距、表格邊框美化、引用區塊邊線及程式碼區塊陰影。

4. **智慧增量快取轉換 (Incremental Build)**
   - 比對 `.md` 與 `.pdf` 的最後修改時間（mtime），已存在最新 PDF 的檔案自動略過，節省批次轉檔時間。
   - 可加入 `--force` 參數無條件強制重新編譯。

5. **Windows 檔案鎖定容錯機制 (File Lock Fallback)**
   - 若 PDF 檔案正被 Acrobat Reader 或瀏覽器開啟鎖定（`EBUSY`），程式會自動降級另存為 `<檔名>_fixed.pdf`，轉檔永不中斷中斷報錯。

---

## 📋 環境需求

- **Node.js** (v16.0.0 以上)
- **Microsoft Edge** (Windows 內建) 或 Google Chrome
- **全域相依套件**：
  ```bash
  npm install -g markdown-it katex mermaid
  ```

---

## 🚀 安裝與設定

### 方式 A：加入 Windows 系統環境變數 (全域命令列使用)
1. 將本專案所在路徑（例如 `C:\PROJECT\md-to-pdf-cli`）加入 Windows 使用者環境變數的 `PATH` 中。
2. 重新開啟命令提示字元或 PowerShell，即可在任何目錄下執行 `md2pdf` 指令。

### 方式 B：一鍵加入 Windows 右鍵「傳送到」選單（免管理員權限）
1. 雙擊執行目錄下的 [`install_sendto.bat`](file:///C:/PROJECT/md-to-pdf-cli/install_sendto.bat)。
2. 往後在檔案總管中，於任何 `.md` 檔案上按 **滑鼠右鍵 ->「傳送到」->「Markdown to PDF」** 即可快速轉檔！

### 方式 C：直接複製 `convert_to_pdf.bat` 到目標資料夾（零設定、相容舊習慣）
1. 將本目錄中的 [`convert_to_pdf.bat`](file:///C:/PROJECT/md-to-pdf-cli/convert_to_pdf.bat) 複製到任何含有 Markdown 的專案資料夾。
2. **無需修改該批次檔任何內容**，它具備自動尋路機制，會自動連動核心程式轉換該資料夾中的文件。
3. 詳細說明請參閱 [使用說明手冊 (USAGE.md)](file:///C:/PROJECT/md-to-pdf-cli/USAGE.md)。

---

## 💻 使用方法

### 1. 轉換當前目錄下的所有 Markdown 檔案（智慧增量）
```bash
md2pdf
# 或直接雙擊資料夾內的 convert_to_pdf.bat
```
> 若目標 PDF 已存在且為最新版本，將自動略過。

### 2. 強制重新編譯目錄下的所有檔案
```bash
md2pdf --force
# 或
convert_to_pdf.bat --force
```

### 3. 指定單一檔案或多個檔案
```bash
# 轉換單一檔案
md2pdf "開發過程2.md"
convert_to_pdf.bat "開發過程2.md"

# 一次指定多個檔案
md2pdf chap1.md chap2.md "US7995859_MD核實報告.md"
convert_to_pdf.bat chap1.md chap2.md
```

### 4. 批次檔模式
在任何工作目錄中放置一個只有兩行內容的 `convert_to_pdf.bat`：
```cmd
@echo off
call md2pdf %*
if "%~1"=="" pause
```
雙擊該批次檔即可自動掃描該目錄並完成轉檔。

---

## 🛠️ 技術架構

```
Markdown 輸入
     │
     ▼
[正規表達式解析] ── 提取區塊公式 / 行內公式 / Mermaid 圖表
     │
     ▼
[KaTeX / Mermaid 標記] ── 轉換為純 HTML，並替換為安全符標 (KATEXPLACEHOLDER...)
     │
     ▼
[markdown-it] ── 解析一般 Markdown 語法 (避免語法衝突與斜體誤判)
     │
     ▼
[符標還原] ── 將 KaTeX HTML 放回渲染結果
     │
     ▼
[暫存 HTML 組裝] ── 注入本機 KaTeX 向量字型與 CSS、Mermaid CDN 腳本
     │
     ▼
[Edge Headless 向量列印] ── `--headless --print-to-pdf --virtual-time-budget=3000`
     │
     ▼
PDF 輸出 (完成)
```

---

## 📄 授權協議 (License)

本工具基於 [MIT License](LICENSE) 釋出，歡迎自由分發與修改。
