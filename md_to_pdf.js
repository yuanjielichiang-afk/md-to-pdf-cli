#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Helper to resolve dependencies from local, global npm, or fallback paths
function loadModule(name) {
    try {
        return require(name);
    } catch (e1) {
        const userProfile = process.env.USERPROFILE || process.env.HOME || '';
        const globalNpmPath = path.join(userProfile, 'AppData/Roaming/npm/node_modules', name);
        try {
            return require(globalNpmPath);
        } catch (e2) {
            console.error(`[錯誤] 找不到相依套件 '${name}'。請先執行: npm install -g ${name}`);
            process.exit(1);
        }
    }
}

const katex = loadModule('katex');
const MarkdownIt = loadModule('markdown-it');

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
});

// Custom fence renderer for mermaid blocks
const defaultFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    if (info === 'mermaid') {
        return `<div class="mermaid">\n${token.content}\n</div>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
};

// Locate KaTeX CSS and fix font paths for headless browser
function getKaTeXCss() {
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    const cssCandidates = [
        path.join(userProfile, 'AppData/Roaming/npm/node_modules/katex/dist/katex.min.css'),
        path.join(__dirname, 'node_modules/katex/dist/katex.min.css')
    ];
    let cssPath = '';
    for (const c of cssCandidates) {
        if (fs.existsSync(c)) { cssPath = c; break; }
    }
    if (!cssPath) return '';

    let css = fs.readFileSync(cssPath, 'utf8');
    const fontDir = path.join(path.dirname(cssPath), 'fonts').replace(/\\/g, '/');
    return css.replace(/url\(fonts\//g, `url(file:///${fontDir}/`);
}

const katexCss = getKaTeXCss();

// Locate Mermaid script if available
function getMermaidJsPath() {
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    const mermaidCandidates = [
        path.join(userProfile, 'AppData/Roaming/npm/node_modules/mermaid/dist/mermaid.min.js'),
        path.join(userProfile, '.vscode/extensions/tomoyukim.vscode-mermaid-editor-0.19.1/dist/vendor/mermaid/dist/mermaid.min.js'),
        path.join(__dirname, 'node_modules/mermaid/dist/mermaid.min.js')
    ];
    for (const cand of mermaidCandidates) {
        if (fs.existsSync(cand)) {
            return cand.replace(/\\/g, '/');
        }
    }
    return '';
}

const mermaidJsPath = getMermaidJsPath();

function isMathInCode(code) {
    if (code.includes('_{') || code.includes('^{') || code.includes('\\frac') || 
        code.includes('T_{n+1}') || code.includes('D_{i,j}') || code.includes('C_{i,j}') || 
        code.includes('P_{i,j}') || code.includes('W^{T') || code.includes('O_new') ||
        code.includes('C_new') || code.includes('T_{k,l}') || code.includes('O_{k,l}') ||
        code.includes('O_{new}') || code.includes('O_{old}') || code.includes('I_{i,j}') ||
        code.includes('T_{min}') || code.includes('T_min') || code.includes('C_D')) {
        return true;
    }
    return false;
}

function cleanMathFormula(f) {
    let res = f.trim();

    // 1. Unicode symbols to standard LaTeX
    res = res.replace(/→/g, '\\to ');
    res = res.replace(/·/g, '\\cdot ');
    res = res.replace(/−/g, '-');

    // 2. In LaTeX text mode (\text{...}), underscore must be \_ (never a bare _)
    res = res.replace(/\\text\{([^{}]+)\}/g, (match, inner) => {
        const fixed = inner.replace(/\\_/g, 'KATEXSAFEUNDERSCORE').replace(/_/g, 'KATEXSAFEUNDERSCORE');
        return '\\text{' + fixed + '}';
    });

    // 3. Outside \text{...}, unescape markdown-escaped subscript underscores \_ (e.g. I\_{r,c} -> I_{r,c})
    res = res.replace(/\\_/g, '_');

    // 4. Restore \_ inside \text{...}
    res = res.replace(/KATEXSAFEUNDERSCORE/g, () => '\\_');

    return res;
}

// Auto-heal broken Markdown tables where cells containing <br> were split across lines or blank lines
function repairBrokenTables(content) {
    const lines = content.split(/\r?\n/);
    const result = [];
    let inTable = false;
    let pendingRow = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check for table header separator like | --- | --- |
        if (trimmed.match(/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/)) {
            inTable = true;
            if (pendingRow) {
                result.push(pendingRow);
                pendingRow = '';
            }
            result.push(line);
            continue;
        }

        // If we are currently accumulating a split table row
        if (pendingRow) {
            if (trimmed === '') {
                // Empty line inside a broken table row: check if next non-empty line continues the row
                let hasContinuation = false;
                for (let j = i + 1; j < lines.length && j < i + 5; j++) {
                    const nextTrimmed = lines[j].trim();
                    if (!nextTrimmed) continue;
                    if (nextTrimmed.endsWith('|') || nextTrimmed.includes('|') || nextTrimmed.startsWith('<br>')) {
                        hasContinuation = true;
                    }
                    break;
                }
                if (hasContinuation) {
                    continue; // Skip the blank line
                } else {
                    // Not a continuation, flush pending row
                    result.push(pendingRow);
                    pendingRow = '';
                    inTable = false;
                    result.push(line);
                    continue;
                }
            }

            // Clean up leading <br> if pendingRow already ended with <br>
            let appendPart = trimmed;
            if (pendingRow.endsWith('<br>') || pendingRow.endsWith('<br/>') || pendingRow.endsWith('<br />')) {
                appendPart = appendPart.replace(/^(?:<br\s*\/?>\s*)+/i, '');
            }

            pendingRow += ' ' + appendPart;

            // Check if row is complete (ends with |)
            if (pendingRow.trim().endsWith('|')) {
                result.push(pendingRow);
                pendingRow = '';
            }
            continue;
        }

        // Check if this line is in a table and broken
        if (inTable) {
            if (trimmed.startsWith('|')) {
                // If line does not end with | or ends with dangling <br>
                if (!trimmed.endsWith('|') || trimmed.endsWith('<br>') || trimmed.endsWith('<br/>') || trimmed.endsWith('<br />')) {
                    pendingRow = line;
                    continue;
                } else {
                    result.push(line);
                    continue;
                }
            } else if (trimmed === '') {
                // Check if the table continues after this blank line
                let nextIsTable = false;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextTrimmed = lines[j].trim();
                    if (!nextTrimmed) continue;
                    if (nextTrimmed.startsWith('|')) {
                        nextIsTable = true;
                    }
                    break;
                }
                if (!nextIsTable) {
                    inTable = false;
                }
                result.push(line);
                continue;
            } else {
                inTable = false;
                result.push(line);
                continue;
            }
        }

        result.push(line);
    }

    if (pendingRow) {
        result.push(pendingRow);
    }

    return result.join('\n');
}

function processAndRenderMarkdown(content) {
    // 0. If pure ASCII diagram
    const hasBoxChars = /[┌┐└┘├┤┬┴┼│─═▲▼◄►]/.test(content);
    const hasHeadings = /^#{1,6}\s/m.test(content);
    if (hasBoxChars && !hasHeadings) {
        return `<pre><code>${content}</code></pre>`;
    }

    // 1. Protect fenced code blocks (```...``` or ~~~...~~~) from math regexes
    const codeBlocks = [];
    content = content.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g, match => {
        const id = codeBlocks.length;
        codeBlocks.push(match);
        return `\n\nFENCEDCODEBLOCKPLACEHOLDER${id}XYZ\n\n`;
    });

    // 1.5. Auto-heal broken Markdown tables before processing formulas
    content = repairBrokenTables(content);

    const mathBlocks = [];
    const katexOptsDisplay = { displayMode: true, throwOnError: false, strict: 'ignore', output: 'html' };
    const katexOptsInline = { displayMode: false, throwOnError: false, strict: 'ignore', output: 'html' };

    // 2. Display math \\[ ... \\] or \[ ... \]
    content = content.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (match, formula) => {
        const id = mathBlocks.length;
        mathBlocks.push(katex.renderToString(cleanMathFormula(formula), katexOptsDisplay));
        return `\n\nKATEXDISPLAYMATHPLACEHOLDER${id}XYZ\n\n`;
    });

    // 3. Display math $$ ... $$
    content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        const id = mathBlocks.length;
        mathBlocks.push(katex.renderToString(cleanMathFormula(formula), katexOptsDisplay));
        return `\n\nKATEXDISPLAYMATHPLACEHOLDER${id}XYZ\n\n`;
    });

    // 4. Inline math \( ... \) or \\( ... \\)
    content = content.replace(/\\{1,2}\(([^\n]+?)\\{1,2}\)/g, (match, formula) => {
        const id = mathBlocks.length;
        mathBlocks.push(katex.renderToString(cleanMathFormula(formula), katexOptsInline));
        return `KATEXINLINEMATHPLACEHOLDER${id}XYZ`;
    });

    // 5. Inline math $...$ (not preceded or followed by $)
    content = content.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (match, formula) => {
        const id = mathBlocks.length;
        mathBlocks.push(katex.renderToString(cleanMathFormula(formula), katexOptsInline));
        return `KATEXINLINEMATHPLACEHOLDER${id}XYZ`;
    });

    // 6. Backtick math (e.g. `D_{i,j}=...`)
    content = content.replace(/`([^`\n]+?)`/g, (match, code) => {
        if (isMathInCode(code)) {
            const id = mathBlocks.length;
            mathBlocks.push(katex.renderToString(cleanMathFormula(code), katexOptsInline));
            return `KATEXINLINEMATHPLACEHOLDER${id}XYZ`;
        }
        return match;
    });

    // 7. Restore fenced code blocks before markdown-it
    content = content.replace(/FENCEDCODEBLOCKPLACEHOLDER(\d+)XYZ/g, (match, id) => {
        return codeBlocks[parseInt(id, 10)];
    });

    // 8. Render markdown to HTML safely with markdown-it
    let html = md.render(content);

    // 9. Restore Math placeholders
    html = html.replace(/<p>\s*KATEXDISPLAYMATHPLACEHOLDER(\d+)XYZ\s*<\/p>/g, (m, id) => {
        return mathBlocks[parseInt(id, 10)];
    });
    html = html.replace(/KATEXDISPLAYMATHPLACEHOLDER(\d+)XYZ/g, (m, id) => {
        return mathBlocks[parseInt(id, 10)];
    });
    html = html.replace(/KATEXINLINEMATHPLACEHOLDER(\d+)XYZ/g, (m, id) => {
        return mathBlocks[parseInt(id, 10)];
    });

    return html;
}

function convertMdToPdf(inputFile, outputFile) {
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: File not found: ${inputFile}`);
        return false;
    }

    const stat = fs.statSync(inputFile);
    if (stat.size === 0) {
        console.log(`Skipping 0-byte file: ${path.basename(inputFile)}`);
        return false;
    }

    console.log(`Converting: ${path.basename(inputFile)} -> ${path.basename(outputFile)}`);
    let mdText = fs.readFileSync(inputFile, 'utf8');

    const bodyHtml = processAndRenderMarkdown(mdText);
    const hasMermaid = bodyHtml.includes('class="mermaid"') && mermaidJsPath !== '';

    const docTitle = path.basename(inputFile, '.md');
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<title>${docTitle}</title>
<style>
${katexCss}

@page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "Noto Sans TC", "PingFang TC", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.68;
    color: #24292e;
    background-color: #fff;
    padding: 0;
    margin: 0;
}

h1 {
    font-size: 17pt;
    border-bottom: 2px solid #eaecef;
    padding-bottom: 0.3em;
    margin-top: 0;
    margin-bottom: 16px;
    color: #1a202c;
    page-break-after: avoid;
}

h2 {
    font-size: 13.5pt;
    border-bottom: 1px solid #eaecef;
    padding-bottom: 0.3em;
    margin-top: 24px;
    margin-bottom: 12px;
    color: #2d3748;
    page-break-after: avoid;
}

h3 {
    font-size: 11.5pt;
    margin-top: 18px;
    margin-bottom: 8px;
    color: #4a5568;
    page-break-after: avoid;
}

h4, h5, h6 {
    font-size: 10.5pt;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
}

p, ul, ol {
    margin-top: 0;
    margin-bottom: 12px;
}

li {
    margin-bottom: 4px;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 9pt;
    page-break-inside: auto;
}

tr {
    page-break-inside: avoid;
    page-break-after: auto;
}

th, td {
    border: 1px solid #d0d7de;
    padding: 7px 9px;
    text-align: left;
    vertical-align: top;
}

th {
    background-color: #f6f8fa;
    font-weight: 600;
}

tr:nth-child(even) td {
    background-color: #fcfcfc;
}

blockquote {
    margin: 14px 0;
    padding: 8px 16px;
    color: #475467;
    background-color: #f8fafc;
    border-left: 4px solid #0284c7;
    border-radius: 2px;
    page-break-inside: avoid;
}

code {
    font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 88%;
    background-color: #f2f4f7;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    color: #c7254e;
}

pre code {
    background-color: transparent;
    padding: 0;
    color: inherit;
    font-family: "Cascadia Code", Consolas, "Courier New", monospace;
    font-size: 7.2pt;
    line-height: 1.15;
}

pre {
    background-color: #f8f9fa;
    border: 1px solid #e1e4e8;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 7.2pt;
    line-height: 1.15;
    page-break-inside: auto;
    white-space: pre;
}

.katex-display {
    margin: 14px 0 !important;
    page-break-inside: avoid;
}

.katex {
    font-size: 1.08em;
}

.mermaid {
    text-align: center;
    margin: 20px auto;
    page-break-inside: avoid;
}

.mermaid svg {
    max-width: 100% !important;
    height: auto !important;
}
</style>
</head>
<body>
${bodyHtml}
${hasMermaid ? `
<script src="file:///${mermaidJsPath}"></script>
<script>
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "Noto Sans TC", sans-serif'
});
</script>
` : ''}
</body>
</html>`;

    const tempHtml = outputFile.replace(/\.pdf$/i, '.temp.html');
    const absTempHtml = path.resolve(tempHtml);
    const absOutputFile = path.resolve(outputFile);
    fs.writeFileSync(absTempHtml, fullHtml, 'utf8');

    let targetPdf = absOutputFile;
    if (fs.existsSync(absOutputFile)) {
        try {
            fs.unlinkSync(absOutputFile);
        } catch (e) {
            console.warn(`  Warning: ${path.basename(absOutputFile)} is currently open/locked. Writing to _fixed.pdf instead.`);
            targetPdf = absOutputFile.replace(/\.pdf$/i, '_fixed.pdf');
            if (fs.existsSync(targetPdf)) {
                try { fs.unlinkSync(targetPdf); } catch (e2) {}
            }
        }
    }

    const fileUrl = 'file:///' + absTempHtml.replace(/\\/g, '/');
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeArgs = [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer'
    ];
    if (hasMermaid) {
        edgeArgs.push('--run-all-compositor-stages-before-draw');
        edgeArgs.push('--virtual-time-budget=3000');
    }
    edgeArgs.push(`--print-to-pdf=${targetPdf}`);
    edgeArgs.push(fileUrl);

    const res = spawnSync(edge, edgeArgs);

    if (fs.existsSync(absTempHtml)) {
        fs.unlinkSync(absTempHtml);
    }

    if (fs.existsSync(targetPdf)) {
        console.log(`  -> Successfully created: ${path.basename(targetPdf)} (${fs.statSync(targetPdf).size} bytes)`);
        return true;
    } else {
        console.error(`  -> Failed to generate PDF: ${res.stderr ? res.stderr.toString() : ''}`);
        return false;
    }
}

// CLI Handling
const rawArgs = process.argv.slice(2);
let isForce = false;
let isAll = false;
const specifiedTargets = [];

for (const a of rawArgs) {
    if (a === '--force' || a === '-f') {
        isForce = true;
    } else if (a === '--all' || a === '-a') {
        isAll = true;
    } else if (a === '--help' || a === '-h' || a === '/?') {
        console.log(`
Markdown to PDF 轉檔工具 (KaTeX 向量數學式 + Mermaid 狀態/架構圖)
================================================================
使用方式：
  1. 轉換指定檔案：
     md2pdf "檔案名稱.md"
     md2pdf 檔案名稱 (可省略 .md)

  2. 轉換多個檔案：
     md2pdf 檔案1.md 檔案2.md

  3. 萬用字元批次轉換：
     md2pdf "US*.md"

  4. 智慧增量轉換 (未帶參數，預設檢查當前目錄)：
     md2pdf
     (自動比對：僅轉換尚未產生 PDF，或 MD 檔案修改時間比 PDF 新的檔案)

  5. 強制轉換當前資料夾全部檔案：
     md2pdf --force
`);
        process.exit(0);
    } else {
        specifiedTargets.push(a);
    }
}

const scriptDir = __dirname;
const currentWorkDir = process.cwd();

function resolveTargetMd(target, currentDir, scriptDir) {
    const candidates = [
        target,
        target + '.md',
        target + '.md.md'
    ];
    if (target.toLowerCase().endsWith('.md')) {
        candidates.push(target + '.md');
    }

    for (const cand of candidates) {
        const p1 = path.resolve(currentDir, cand);
        if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return p1;
        const p2 = path.resolve(scriptDir, cand);
        if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return p2;
    }

    const searchDirs = [currentDir];
    if (scriptDir !== currentDir) searchDirs.push(scriptDir);

    const norm = str => str.toLowerCase().replace(/[\s\-_]/g, '');
    const cleanTarget = path.basename(target).replace(/(\.md)+$/i, '');
    const normTarget = norm(cleanTarget);

    for (const d of searchDirs) {
        if (!fs.existsSync(d)) continue;
        const allFiles = fs.readdirSync(d).filter(f => f.endsWith('.md') && !f.endsWith('.temp.md'));
        
        for (const f of allFiles) {
            const cleanF = f.replace(/(\.md)+$/i, '');
            if (norm(cleanF) === normTarget) {
                return path.join(d, f);
            }
        }

        for (const f of allFiles) {
            const cleanF = f.replace(/(\.md)+$/i, '');
            if (norm(cleanF).startsWith(normTarget)) {
                return path.join(d, f);
            }
        }
    }

    return null;
}

if (specifiedTargets.length > 0) {
    const filesToProcess = [];

    for (const target of specifiedTargets) {
        if (target.includes('*') || target.includes('?')) {
            const targetDir = path.dirname(target) === '.' ? currentWorkDir : path.resolve(currentWorkDir, path.dirname(target));
            const pattern = new RegExp('^' + path.basename(target).replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
            if (fs.existsSync(targetDir)) {
                const matched = fs.readdirSync(targetDir)
                    .filter(f => pattern.test(f) && f.endsWith('.md') && !f.endsWith('.temp.md'))
                    .map(f => path.join(targetDir, f));
                filesToProcess.push(...matched);
            }
        } else {
            const resolved = resolveTargetMd(target, currentWorkDir, scriptDir);
            if (resolved) {
                filesToProcess.push(resolved);
            } else {
                console.error(`  [錯誤] 找不到檔案: ${target}`);
            }
        }
    }

    if (filesToProcess.length === 0) {
        console.error("找不到符合指定的 Markdown 檔案！");
        process.exit(1);
    }

    console.log(`[指定轉檔] 共需處理 ${filesToProcess.length} 個檔案：`);
    let successCount = 0;
    for (const inPath of filesToProcess) {
        if (!fs.existsSync(inPath)) {
            console.error(`  [錯誤] 檔案不存在: ${inPath}`);
            continue;
        }
        const outPath = inPath.replace(/(\.md)+$/i, '.pdf');
        if (convertMdToPdf(inPath, outPath)) {
            successCount++;
        }
    }
    console.log(`\n完成！成功轉換: ${successCount} / ${filesToProcess.length}`);
} else {
    // Scan current working directory for CLI usage
    const scanDir = currentWorkDir;
    console.log(`[掃描目錄] ${scanDir}`);
    const files = fs.readdirSync(scanDir).filter(f => f.endsWith('.md') && !f.endsWith('.temp.md'));
    
    let processedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
        const inPath = path.join(scanDir, file);
        const outPath = path.join(scanDir, file.replace(/(\.md)+$/i, '.pdf'));
        const inStat = fs.statSync(inPath);

        if (inStat.size === 0) {
            console.log(`[略過] ${file} (0 位元組空白檔)`);
            skippedCount++;
            continue;
        }

        if (!isForce && fs.existsSync(outPath)) {
            const outStat = fs.statSync(outPath);
            if (outStat.mtimeMs >= inStat.mtimeMs) {
                console.log(`[最新] ${file} -> 已存在最新版 PDF，略過`);
                skippedCount++;
                continue;
            }
        }

        if (convertMdToPdf(inPath, outPath)) {
            processedCount++;
        }
    }

    console.log(`\n處理結果：轉換了 ${processedCount} 個檔案，略過了 ${skippedCount} 個檔案（共 ${files.length} 個 MD 檔案）。`);
    if (skippedCount > 0 && !isForce) {
        console.log(`提示：若欲無條件強制重新產生所有 PDF，可加入參數: --force`);
    }
}
