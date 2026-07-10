/**
 * Simple, fast, and self-contained Markdown <-> HTML translator.
 * Tailored for Note Android requirements.
 */

export function isMarkdown(text: string): boolean {
  // Simple check for Markdown elements
  const mdPatterns = [
    /^#\s+/m, // Headers
    /^\s*-\s+\[[ xX]\]/m, // Checklists
    /^\s*[-*+]\s+/m, // Bullet points
    /^\s*\d+\.\s+/m, // Numbered lists
    /\*\*.*\*\*/, // Bold
    /\*.*\*|__.*__/, // Italic
    /\[.*\]\(.*\)/, // Markdown link
    /`.*`/, // Inline code
    /```[\s\S]*```/, // Multi-line code
  ];
  return mdPatterns.some(pattern => pattern.test(text));
}

export function mdToHtml(mdText: string): string {
  if (!mdText) return '';

  let html = mdText;

  // 1. Parse markdown tables and temporarily substitute them with unique text placeholders
  const tablePlaceholders: string[] = [];
  const lines = html.split('\n');
  const processedLines: string[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if we have a table start: contains '|' and the next line has '|' with dashes/separator format
    if (line.includes('|')) {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.includes('|') && /^[|\s-:]+$/.test(nextLine.trim())) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        
        // Compile the table and charts
        const tableHtml = renderTableAndChart(tableLines);
        const placeholder = `___TABLE_PLACEHOLDER_${tablePlaceholders.length}___`;
        tablePlaceholders.push(tableHtml);
        processedLines.push(placeholder);
        continue;
      }
    }
    
    processedLines.push(line);
    i++;
  }
  
  html = processedLines.join('\n');

  // 2. Escape HTML tags to prevent XSS except our own structured tags if pasted in hybrid format
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```language ... ```
  html = html.replace(/```([\w-]*)\n([\s\S]*?)\n```/g, (_, lang, code) => {
    return `<pre class="font-mono bg-dark-eval/10 dark:bg-light-eval/10 p-3 my-2 rounded-lg text-sm overflow-x-auto whitespace-pre border border-black/10 dark:border-white/10" data-lang="${lang}">${code}</pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-red-500">$1</code>');

  // Headers: H1, H2, H3
  html = html.replace(/^#\s+(.*?)$/gm, '<h1 class="text-3xl font-bold mt-4 mb-2 tracking-tight">$1</h1>');
  html = html.replace(/^##\s+(.*?)$/gm, '<h2 class="text-2xl font-bold mt-3 mb-2 tracking-tight">$1</h2>');
  html = html.replace(/^###\s+(.*?)$/gm, '<h3 class="text-xl font-bold mt-2 mb-1">$1</h3>');

  // Checklists: - [ ] or - [x]
  html = html.replace(/^\s*-\s+\[\s\]\s+(.*?)$/gm, '<div class="flex items-start my-1"><input type="checkbox" class="w-5 h-5 rounded border-gray-300 dark:border-neutral-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /><span>$1</span></div>');
  html = html.replace(/^\s*-\s+\[[xX]\]\s+(.*?)$/gm, '<div class="flex items-start my-1"><input type="checkbox" checked class="w-5 h-5 rounded border-gray-300 dark:border-neutral-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /><span class="line-through text-gray-400">$1</span></div>');

  // Bullet Lists: - or *
  html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li class="list-disc ml-6 my-1">$1</li>');

  // Numbered Lists: 1.
  html = html.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li class="list-decimal ml-6 my-1" data-index="$1">$2</li>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-yellow-600 dark:text-yellow-400 underline">$1</a>');

  // Group generic list elements together if needed (or let the browser handle it cleanly)
  // Convert standard newlines to <br> or wrap in paragraphs (taking care of existing block elements)
  const finalLines = html.split('\n');
  const processedLinesFinal = finalLines.map((line) => {
    // If the line is our table placeholder, keep it intact without wrapping!
    if (line.trim().startsWith('___TABLE_PLACEHOLDER_') && line.trim().endsWith('___')) {
      return line.trim();
    }
    const isBlock = /<\/?(h1|h2|h3|li|div|pre|code)/i.test(line);
    if (isBlock) return line;
    if (line.trim() === '') return '<p class="h-3"></p>'; // empty line
    return `<p class="my-1">${line}</p>`;
  });

  let outputHtml = processedLinesFinal.join('\n');

  // Replace placeholders back with the raw compiled table & chart components
  tablePlaceholders.forEach((tableHtml, index) => {
    outputHtml = outputHtml.replace(`___TABLE_PLACEHOLDER_${index}___`, tableHtml);
    // Overcome paragraph-wrapped edge cases if they occur
    outputHtml = outputHtml.replace(`<p class="my-1">___TABLE_PLACEHOLDER_${index}___</p>`, tableHtml);
  });

  return outputHtml;
}

// Helper to render markdown table cells and automatically build responsive data charts
function renderTableAndChart(tableLines: string[]): string {
  const parseCells = (rowStr: string): string[] => {
    let trimmed = rowStr.trim();
    if (trimmed.startsWith('|')) {
      trimmed = trimmed.substring(1);
    }
    if (trimmed.endsWith('|')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    } else if (trimmed.endsWith('.')) {
      trimmed = trimmed.substring(0, trimmed.length - 1).trim();
      if (trimmed.endsWith('|')) {
        trimmed = trimmed.substring(0, trimmed.length - 1);
      }
    }
    return trimmed.split('|').map(c => c.trim());
  };

  const headers = parseCells(tableLines[0]);
  let bodyRows: string[][] = [];
  for (let k = 1; k < tableLines.length; k++) {
    const rowStr = tableLines[k];
    if (k === 1 && /^[|\s-:]+$/.test(rowStr.trim())) {
      continue; // skip the separator row
    }
    bodyRows.push(parseCells(rowStr));
  }

  const numColumns = headers.length;
  if (numColumns === 0) return '';

  const colDataTypes: { isNumeric: boolean; numericValues: number[]; values: string[] }[] = [];

  for (let c = 0; c < numColumns; c++) {
    let numericValues: number[] = [];
    let values: string[] = [];
    let totalRows = bodyRows.length;

    for (let r = 0; r < totalRows; r++) {
      const rawVal = (bodyRows[r] && bodyRows[r][c] !== undefined) ? bodyRows[r][c] : '';
      values.push(rawVal);
      
      const cleaned = rawVal.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      
      if (rawVal.trim() !== '' && !isNaN(parsed)) {
        numericValues.push(parsed);
      }
    }

    const isNumeric = totalRows > 0 && (numericValues.length >= Math.ceil(totalRows * 0.5));

    colDataTypes.push({
      isNumeric,
      numericValues,
      values
    });
  }

  // Find Label Column (first text column)
  let labelColIndex = -1;
  for (let c = 0; c < numColumns; c++) {
    if (!colDataTypes[c].isNumeric) {
      labelColIndex = c;
      break;
    }
  }
  if (labelColIndex === -1) {
    labelColIndex = 0;
  }

  // Heuristic ID check: if column 0 increments uniquely like an index (1, 2, 3...) whereas column 1 is non-numeric text, prefer column 1 (e.g. Names)
  let isIdCol = false;
  if (colDataTypes[0] && colDataTypes[0].isNumeric) {
    const vals = colDataTypes[0].numericValues;
    if (vals.length > 1 && vals[1] === vals[0] + 1) {
      isIdCol = true;
    }
  }
  if (isIdCol && numColumns > 1 && colDataTypes[1] && !colDataTypes[1].isNumeric) {
    labelColIndex = 1;
  }

  // Find Numeric columns to Graph
  const valueColIndices: number[] = [];
  for (let c = 0; c < numColumns; c++) {
    if (c !== labelColIndex && colDataTypes[c].isNumeric) {
      if (c === 0 && labelColIndex === 1) {
        continue;
      }
      valueColIndices.push(c);
    }
  }

  // Build Charts Horizontal Bars HTML ("Mette tipo solo una cosa" - only one smart chart)
  let chartsHtml = '';
  const color = '#E5A93C'; // default primary brand yellow

  const isSingleRowTable = bodyRows.length === 1;
  if (isSingleRowTable) {
    // 1. Single row of data: make 1 beautiful consolidated chart where Column Headers are the Categories
    const singleRow = bodyRows[0];
    const numericDetails: { label: string; raw: string; val: number }[] = [];
    for (let c = 0; c < numColumns; c++) {
      const rawVal = singleRow[c] !== undefined ? singleRow[c] : '';
      const cleaned = rawVal.replace(/[^\d.-]/g, '');
      const val = parseFloat(cleaned);
      if (!isNaN(val)) {
        numericDetails.push({
          label: headers[c] || `Colonna ${c + 1}`,
          raw: rawVal,
          val: val
        });
      }
    }

    if (numericDetails.length > 0) {
      const maxVal = Math.max(...numericDetails.map(d => d.val), 1);
      let barRowsHtml = '';
      numericDetails.forEach(detail => {
        const pct = Math.max(3, Math.min(100, (detail.val / maxVal) * 100));
        barRowsHtml += `
          <div class="space-y-1 my-1">
            <div class="flex justify-between text-[11px] text-zinc-400">
              <span class="font-medium truncate max-w-[150px] text-zinc-300 font-sans">${detail.label}</span>
              <span class="font-mono font-bold text-zinc-100">${detail.raw}</span>
            </div>
            <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background-color: ${color};"></div>
            </div>
          </div>
        `;
      });

      chartsHtml = `
        <div class="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/80 my-1 select-text">
          <div class="border-b border-neutral-800 pb-1.5 mb-2 flex items-center gap-1.5">
            <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">📈 Grafico Valori</span>
          </div>
          <div class="space-y-1.5 py-0.5">
            ${barRowsHtml}
          </div>
        </div>
      `;
    }
  } else if (valueColIndices.length > 0) {
    // 2. Multi-row: render exactly ONE chart for the first numeric column's values
    const firstColIdx = valueColIndices[0];
    const colHeader = headers[firstColIdx];
    const colData = colDataTypes[firstColIdx];
    const maxVal = Math.max(...colData.numericValues, 1);

    let barRowsHtml = '';
    for (let r = 0; r < bodyRows.length; r++) {
      const rLabel = (bodyRows[r] && bodyRows[r][labelColIndex]) ? bodyRows[r][labelColIndex] : `Riga ${r + 1}`;
      const rawVal = (bodyRows[r] && bodyRows[r][firstColIdx] !== undefined) ? bodyRows[r][firstColIdx] : '';
      const cleaned = rawVal.replace(/[^\d.-]/g, '');
      const val = parseFloat(cleaned) || 0;
      const pct = Math.max(3, Math.min(100, (val / maxVal) * 100));

      barRowsHtml += `
        <div class="space-y-1 my-1">
          <div class="flex justify-between text-[11px] text-zinc-400">
            <span class="font-medium truncate max-w-[150px] text-zinc-300 font-sans">${rLabel}</span>
            <span class="font-mono font-bold text-zinc-100">${rawVal}</span>
          </div>
          <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    }

    chartsHtml = `
      <div class="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/80 my-1 select-text">
        <div class="border-b border-neutral-800 pb-1.5 mb-2 flex items-center gap-1.5">
          <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">📈 ${colHeader}</span>
        </div>
        <div class="space-y-1.5 py-0.5">
          ${barRowsHtml}
        </div>
      </div>
    `;
  }

  // Exact Excel-style formula evaluation helper for parsed tables
  const evaluateExcelCell = (rawValue: string, allCells: string[][]): string => {
    if (!rawValue || !rawValue.startsWith('=')) return rawValue;
    try {
      const formula = rawValue.substring(1).toUpperCase().trim();
      
      if (formula.startsWith('SUM(') && formula.endsWith(')')) {
        const rangeStr = formula.substring(4, formula.length - 1).trim();
        if (rangeStr.includes(':')) {
          const [start, end] = rangeStr.split(':').map(s => s.trim());
          const startCol = start.charCodeAt(0) - 65;
          const startRow = parseInt(start.substring(1)) - 1;
          const endCol = end.charCodeAt(0) - 65;
          const endRow = parseInt(end.substring(1)) - 1;
          let sum = 0;
          for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
            for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
              const raw = allCells[r]?.[c] || '0';
              const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
              if (!isNaN(val)) sum += val;
            }
          }
          return sum.toString();
        } else {
          const parts = rangeStr.split(',');
          let sum = 0;
          for (const p of parts) {
            const trimmed = p.trim();
            const col = trimmed.charCodeAt(0) - 65;
            const row = parseInt(trimmed.substring(1)) - 1;
            const raw = allCells[row]?.[col] || '0';
            const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
            if (!isNaN(val)) sum += val;
          }
          return sum.toString();
        }
      }

      if (formula.startsWith('AVERAGE(') && formula.endsWith(')')) {
        const rangeStr = formula.substring(8, formula.length - 1).trim();
        if (rangeStr.includes(':')) {
          const [start, end] = rangeStr.split(':').map(s => s.trim());
          const startCol = start.charCodeAt(0) - 65;
          const startRow = parseInt(start.substring(1)) - 1;
          const endCol = end.charCodeAt(0) - 65;
          const endRow = parseInt(end.substring(1)) - 1;
          let sum = 0;
          let count = 0;
          for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
            for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
              const raw = allCells[r]?.[c] || '0';
              const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
              if (!isNaN(val)) {
                sum += val;
                count++;
              }
            }
          }
          return count > 0 ? (sum / count).toFixed(2).replace(/\.00$/, '') : '0';
        }
      }

      const mathRegex = /^([A-Z])(\d+)\s*([\+\-\*\/])\s*([A-Z])(\d+)$/;
      const match = formula.replace(/\s+/g, '').match(mathRegex);
      if (match) {
        const col1 = match[1].charCodeAt(0) - 65;
        const row1 = parseInt(match[2]) - 1;
        const op = match[3];
        const col2 = match[4].charCodeAt(0) - 65;
        const row2 = parseInt(match[5]) - 1;
        
        const raw1 = allCells[row1]?.[col1] || '0';
        const raw2 = allCells[row2]?.[col2] || '0';
        
        const val1 = parseFloat(raw1.startsWith('=') ? evaluateExcelCell(raw1, allCells) : raw1.replace(/[^\d.-]/g, ''));
        const val2 = parseFloat(raw2.startsWith('=') ? evaluateExcelCell(raw2, allCells) : raw2.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(val1) && !isNaN(val2)) {
          if (op === '+') return (val1 + val2).toString();
          if (op === '-') return (val1 - val2).toString();
          if (op === '*') return (val1 * val2).toString();
          if (op === '/') return val2 !== 0 ? (val1 / val2).toFixed(2).replace(/\.00$/, '') : 'Err/0';
        }
      }
    } catch (e) {
      console.error("Formula error:", e);
      return 'Err!';
    }
    return rawValue;
  };

  // Build Excel-style Grid Table HTML (NO "Foglio Excel" or togglers - pure responsive minimalist grid!)
  const excelGridHtml = `
    <div class="excel-grid-container w-full overflow-x-auto select-text my-1 rounded-xl border border-neutral-800/80 bg-neutral-950 p-1.5 scrollbar-thin">
      <table class="w-full text-left border-collapse table-auto" style="font-size: 11px; width: 100%; min-width: max-content;">
        <thead>
          <tr class="bg-neutral-950 border-b border-neutral-800 font-mono text-[9px] text-neutral-500">
            <th class="p-1 text-center bg-neutral-950 border border-neutral-850 w-8 min-w-8 select-none"></th>
             ${headers.map((_, hIdx) => `
              <th class="p-1 text-center bg-neutral-950/80 border border-neutral-850 select-none">${String.fromCharCode(65 + hIdx)}</th>
            `).join('')}
          </tr>
          <tr class="border-b border-neutral-800">
            <th class="p-1 px-1.5 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/70 border border-neutral-850 w-8 select-none">1</th>
            ${headers.map((h, hIdx) => `
              <th class="p-2 py-2 text-zinc-100 font-bold select-text uppercase tracking-wider text-[10px] border border-neutral-850" style="background-color: rgba(255, 255, 255, 0.02);">${h || ''}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${bodyRows.map((row, rIdx) => {
            const actualExcelRow = rIdx + 2;
            const fullTableMatrix = [headers, ...bodyRows];
            return `
              <tr class="border-b border-neutral-900 hover:bg-neutral-900/30 transition-colors">
                <td class="p-2 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/40 border border-neutral-850 w-8 select-none">${actualExcelRow}</td>
                ${headers.map((_, cIdx) => {
                  const rawVal = row[cIdx] || '';
                  const evaluated = evaluateExcelCell(rawVal, fullTableMatrix);
                  return `
                    <td class="p-2 py-2 text-zinc-300 font-medium select-text border border-neutral-900/30" data-orig-value="${rawVal}" style="white-space: pre-wrap !important; word-break: normal !important; overflow-wrap: break-word !important; word-wrap: break-word !important;">${evaluated}</td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const widgetId = 'table-widget-' + Date.now();
  return `
    <div class="media-widget relative p-4 my-3 bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-full select-text animate-in fade-in zoom-in-95 duration-150" contenteditable="false" data-widget-id="${widgetId}" data-widget-type="chart" data-chart-type="table" data-table-view="grid" style="width: 100%; clear: both; margin: 12px auto; display: flex; flex-direction: column;">
      <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none hidden" style="min-width: max-content;">
        <span class="text-[10px] font-bold text-zinc-550 px-2 uppercase tracking-wider">Tabella</span>
        <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
      </div>
      <div class="media-widget-body bg-transparent p-0 flex flex-col select-text overflow-auto" style="width: 100%; height: 100%; min-height: inherit;">
        ${chartsHtml ? `
          <div class="mb-2">
            ${chartsHtml}
          </div>
        ` : ''}
        ${excelGridHtml}
      </div>
    </div>
    <span>&nbsp;</span>
  `;
}

export function htmlToMd(html: string): string {
  if (!html) return '';

  let md = html;

  // Convert our custom Table-with-Charts widget back to a standard markdown table!
  const widgetRegex = /<div[^>]*data-chart-type="table"[\s\S]*?<\/table>[\s\S]*?<\/div>\s*<\/div>\s*(?:<span>&nbsp;<\/span>)?/gi;
  md = md.replace(widgetRegex, (match) => {
    const tableMatch = match.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return '';
    
    const tableBody = tableMatch[1];
    const headers: string[] = [];
    const rows: string[][] = [];
    
    // Extract headers
    const thMatches = tableBody.match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
    thMatches.forEach(th => {
      const cleanTh = th.replace(/<[^>]+>/g, '').trim();
      headers.push(cleanTh);
    });
    
    // Extract rows
    const trMatches = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    trMatches.forEach((tr) => {
      // Skip the table header row
      if (tr.toLowerCase().includes('<th')) return;
      
      const cols: string[] = [];
      const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      tdMatches.forEach(td => {
        const cleanTd = td.replace(/<[^>]+>/g, '').trim();
        cols.push(cleanTd);
      });
      if (cols.length > 0) {
        rows.push(cols);
      }
    });

    if (headers.length === 0 && rows.length === 0) return '';
    
    // Construct original Markdown Table representation
    let tableMd = `| ${headers.join(' | ')} |\n`;
    tableMd += `| ${headers.map(() => '---').join(' | ')} |\n`;
    rows.forEach(row => {
      const paddedRow = headers.map((_, idx) => row[idx] || '');
      tableMd += `| ${paddedRow.join(' | ')} |\n`;
    });
    
    return '\n' + tableMd + '\n';
  });

  // Replace block containers and custom line breaks
  md = md.replace(/<p class="h-3"><\/p>/g, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n');
  md = md.replace(/<br\s*\/?>/g, '\n');

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n');

  // Checklists
  md = md.replace(/<div[^>]*>\s*<input[^>]*checkbox[^>]*checked[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<\/div>/g, '- [x] $1\n');
  md = md.replace(/<div[^>]*>\s*<input[^>]*checkbox[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<\/div>/g, '- [ ] $1\n');
  md = md.replace(/<div[^>]*>\s*<input[^>]*checkbox[^>]*checked[^>]*>\s*(.*?)\s*<\/div>/g, '- [x] $1\n');
  md = md.replace(/<div[^>]*>\s*<input[^>]*checkbox[^>]*>\s*(.*?)\s*<\/div>/g, '- [ ] $1\n');

  // Lists
  md = md.replace(/<li class="list-disc[^>]*>(.*?)<\/li>/g, '- $1\n');
  md = md.replace(/<li class="list-decimal[^>]*>(.*?)<\/li>/g, '1. $1\n');

  // Bold & Italics & strike
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<del[^>]*>(.*?)<\/del>/g, '~~$1~~');

  // Codes
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```\n');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, '```\n$1\n```\n');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');

  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}
