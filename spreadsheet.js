// A small Excel (.xlsx) writer and reader, enough for the food template. No library needed:
// an .xlsx file is a zip of XML files. Writing stores files uncompressed; reading uses the
// browser's DecompressionStream for compressed ones. CSV files can be read too.
(() => {
  'use strict';

  // ---------- Zip ----------

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // files: [[path, text]] -> zip bytes (stored, not compressed)
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [path, text] of files) {
      const name = enc.encode(path);
      const body = enc.encode(text);
      const crc = crc32(body);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); // stored
      local.setUint16(12, 0x21, true); // 1980-01-01
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, body.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, body);

      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(14, 0x21, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, body.length, true);
      entry.setUint32(24, body.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
  }

  // zip bytes -> Map(path -> async () => text)
  function unzip(buffer) {
    const view = new DataView(buffer);
    let end = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('not a zip');
    const count = view.getUint16(end + 10, true);
    let pos = view.getUint32(end + 16, true);
    const dec = new TextDecoder();
    const files = new Map();
    for (let n = 0; n < count; n++) {
      if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('bad zip');
      const method = view.getUint16(pos + 10, true);
      const size = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const local = view.getUint32(pos + 42, true);
      const name = dec.decode(new Uint8Array(buffer, pos + 46, nameLen));
      pos += 46 + nameLen + extraLen + commentLen;
      files.set(name, async () => {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const raw = new Uint8Array(buffer, start, size);
        if (method === 0) return dec.decode(raw);
        if (method !== 8) throw new Error('unsupported zip');
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      });
    }
    return files;
  }

  // ---------- Writing ----------

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function colName(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  // Style ids in styles.xml below.
  const STYLE = { text: 0, header: 1, date: 2, note: 3, title: 4 };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF666666"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2E7D32"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  // A cell is a string, a number, or { v, s } with a style name.
  function cellXml(value, ref) {
    const cell = value && typeof value === 'object' ? value : { v: value };
    if (cell.v == null || cell.v === '') return '';
    const s = cell.s ? ` s="${STYLE[cell.s]}"` : '';
    if (typeof cell.v === 'number') return `<c r="${ref}"${s}><v>${cell.v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
  }

  // sheet: { name, rows, widths, colStyles, freeze, lists: [{ col, from, rows }] }
  function sheetXml(sheet) {
    const cols = (sheet.widths || []).map((w, i) => {
      const style = sheet.colStyles?.[i] ? ` style="${STYLE[sheet.colStyles[i]]}"` : '';
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${style}/>`;
    }).join('');
    const rows = sheet.rows.map((row, r) =>
      `<row r="${r + 1}">${row.map((v, c) => cellXml(v, colName(c) + (r + 1))).join('')}</row>`).join('');
    const pane = sheet.freeze
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '';
    // Dropdowns that still let you type something else (showErrorMessage off).
    const lists = (sheet.lists || []).map((l) =>
      `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${l.col}2:${l.col}${l.rows}"><formula1>${esc(l.from)}</formula1></dataValidation>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData>${lists ? `<dataValidations count="${sheet.lists.length}">${lists}</dataValidations>` : ''}</worksheet>`;
  }

  function writeXlsx(sheets) {
    const n = sheets.length;
    const range = (f) => sheets.map((s, i) => f(s, i + 1)).join('');
    return zip([
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${range((s, i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${range((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i}" r:id="rId${i}"/>`)}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${range((s, i) => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`)}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', STYLES],
      ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
    ]);
  }

  // ---------- Reading ----------

  const XML = (text) => new DOMParser().parseFromString(text, 'application/xml');
  const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  const textOf = (node) => byTag(node, 't').map((t) => t.textContent).join('');

  function colIndex(ref) {
    let n = 0;
    for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  }

  // Reads the sheet called `prefer` (or the first one). Returns { rows, date1904 }, where
  // rows are arrays of strings and numbers.
  async function readXlsx(buffer, prefer) {
    const files = unzip(buffer);
    const get = async (path) => (files.has(path) ? XML(await files.get(path)()) : null);
    const workbook = await get('xl/workbook.xml');
    if (!workbook) throw new Error('not a spreadsheet');
    const date1904 = byTag(workbook, 'workbookPr').some((p) => ['1', 'true'].includes(p.getAttribute('date1904')));
    const sheets = byTag(workbook, 'sheet');
    const sheet = sheets.find((s) => s.getAttribute('name').toLowerCase() === (prefer || '').toLowerCase()) || sheets[0];
    const relId = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id');
    const rels = await get('xl/_rels/workbook.xml.rels');
    const rel = byTag(rels, 'Relationship').find((r) => r.getAttribute('Id') === relId);
    let target = rel.getAttribute('Target');
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const shared = await get('xl/sharedStrings.xml');
    const strings = shared ? byTag(shared, 'si').map(textOf) : [];
    const doc = await get(target);
    if (!doc) throw new Error('sheet missing');
    const rows = [];
    for (const row of byTag(doc, 'row')) {
      const r = Number(row.getAttribute('r')) - 1;
      const cells = [];
      let next = 0;
      for (const c of byTag(row, 'c')) {
        const ref = c.getAttribute('r');
        const i = ref ? colIndex(ref) : next;
        next = i + 1;
        const type = c.getAttribute('t');
        const v = byTag(c, 'v')[0]?.textContent ?? '';
        let value;
        if (type === 's') value = strings[Number(v)] ?? '';
        else if (type === 'inlineStr') value = textOf(c);
        else if (type === 'str' || type === 'e') value = v;
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else value = v === '' ? '' : Number(v);
        cells[i] = value;
      }
      rows[Number.isInteger(r) && r >= 0 ? r : rows.length] = Array.from(cells, (x) => x ?? '');
    }
    return { rows: Array.from(rows, (x) => x || []), date1904 };
  }

  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = [[]];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { rows[rows.length - 1].push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        rows[rows.length - 1].push(field); field = ''; rows.push([]);
      } else field += ch;
    }
    rows[rows.length - 1].push(field);
    return { rows, date1904: false };
  }

  // file -> { rows, date1904 }
  async function readTable(file, prefer) {
    const buffer = await file.arrayBuffer();
    const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    if (head[0] === 0x50 && head[1] === 0x4b) return readXlsx(buffer, prefer);
    if (head[0] === 0xd0 && head[1] === 0xcf) throw new Error('old-xls');
    return readCsv(new TextDecoder().decode(buffer));
  }

  window.Spreadsheet = { writeXlsx, readTable };
})();
