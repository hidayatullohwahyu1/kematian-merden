/**
 * XlsxFiller.gs — mengisi template .xlsx langsung (tanpa konversi ke Google Sheets),
 * sehingga format kotak, ukuran kertas Folio, margin & print area tetap utuh.
 *
 * Cara kerja:
 *  1. Buka zip .xlsx, cari sheet bernama DATA.
 *  2. Tulis nilai ke kolom B sesuai KEY di kolom A.
 *  3. Hitung ulang nilai tampilan (cache) semua rumus di sheet lain, agar file langsung
 *     tampil terisi walau dibuka di Protected View / preview HP.
 *  4. Set fullCalcOnLoad agar Excel tetap menghitung ulang saat dibuka.
 */

/** @param {Blob} templateBlob  @param {Object} data KEY->nilai  @param {string} fileName */
function isiXlsx_(templateBlob, data, fileName) {
  const blobs = Utilities.unzip(templateBlob.setContentType('application/zip'));
  const files = {};
  blobs.forEach(b => {
    if (/\.(xml|rels)$/i.test(b.getName())) files[b.getName()] = b.getDataAsString('UTF-8');
  });
  const changed = xlsxIsiCore_(files, data);
  const out = blobs.map(b => changed[b.getName()] !== undefined
    ? Utilities.newBlob(changed[b.getName()], 'application/xml', b.getName())
    : b);
  return Utilities.zip(out, fileName)
    .setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Inti (murni string, bisa diuji di luar GAS). files: {path: xmlString}. Return {path: xmlBaru} */
function xlsxIsiCore_(files, data, dataSheetName) {
  dataSheetName = dataSheetName || 'DATA';
  const wbXml = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  const ss = xlsxSharedStrings_(files['xl/sharedStrings.xml'] || '');

  // nama sheet -> path
  const relMap = {};
  rels.replace(/<Relationship\b[^>]*>/g, tag => {
    const id = xlsxAttr_(tag, 'Id'), t = xlsxAttr_(tag, 'Target');
    relMap[id] = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
  });
  const sheets = {};
  wbXml.replace(/<sheet\b[^>]*>/g, tag => {
    sheets[xlsxUnesc_(xlsxAttr_(tag, 'name'))] = relMap[xlsxAttr_(tag, 'r:id')];
  });
  const dataPath = sheets[dataSheetName];
  if (!dataPath) throw new Error('Sheet ' + dataSheetName + ' tidak ditemukan di template');

  // Baca kolom A (KEY) dan B (NILAI) sheet DATA
  let dx = files[dataPath];
  const cells = xlsxReadCells_(dx, ss);
  const keyRow = {}, nilai = {};
  Object.keys(cells).forEach(ref => {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (m[1] === 'A' && cells[ref]) keyRow[String(cells[ref]).trim()] = +m[2];
    if (m[1] === 'B') nilai[+m[2]] = cells[ref];
  });

  // Tulis nilai baru ke kolom B
  Object.keys(data).forEach(key => {
    const row = keyRow[key];
    const v = data[key];
    if (!row || v === undefined || v === null) return;
    const s = String(v);
    nilai[row] = s;
    const cellXml = s === '' ? null : '<is><t xml:space="preserve">' + xlsxEsc_(s) + '</t></is>';
    dx = xlsxSetCell_(dx, 'B' + row, row, cellXml);
  });
  const changed = {};
  changed[dataPath] = dx;

  // Hitung ulang cache rumus di sheet lain
  const resolver = (sheet, ref) => {
    if (sheet !== dataSheetName) return '';
    const m = ref.replace(/\$/g, '').match(/^B(\d+)$/);
    return m ? (nilai[+m[1]] == null ? '' : String(nilai[+m[1]])) : '';
  };
  Object.keys(sheets).forEach(name => {
    const p = sheets[name];
    if (name === dataSheetName || !files[p]) return;
    changed[p] = files[p].replace(
      /<c r="([A-Z]+\d+)"([^>]*?)>\s*<f([^>]*)>([\s\S]*?)<\/f>(?:\s*<v>[\s\S]*?<\/v>|\s*<v\/>)?\s*<\/c>/g,
      (all, ref, attrs, fAttrs, ftext) => {
        let val;
        try { val = xlsxEval_(xlsxUnesc_(ftext), resolver); } catch (e) { return all; }
        val = (val === true) ? 'TRUE' : (val === false) ? 'FALSE' : String(val);
        const a = attrs.replace(/\s+t="[^"]*"/, '');
        return '<c r="' + ref + '"' + a + ' t="str"><f' + fAttrs + '>' + ftext + '</f><v>' + xlsxEsc_(val) + '</v></c>';
      });
  });

  // Paksa Excel menghitung ulang saat file dibuka
  let w = wbXml;
  if (/<calcPr\b/.test(w)) {
    w = w.replace(/<calcPr\b([^>]*?)(\/?)>/, (t, a, sl) =>
      '<calcPr' + a.replace(/\s+fullCalcOnLoad="[^"]*"/, '') + ' fullCalcOnLoad="1"' + sl + '>');
  } else {
    w = w.replace(/(<\/definedNames>|<\/sheets>)(?![\s\S]*<\/definedNames>)/, '$1<calcPr fullCalcOnLoad="1"/>');
  }
  changed['xl/workbook.xml'] = w;
  return changed;
}

/* ---------- helper XML ---------- */
function xlsxAttr_(tag, name) {
  const m = tag.match(new RegExp('\\s' + name.replace(':', '\\:') + '="([^"]*)"'));
  return m ? m[1] : '';
}
function xlsxEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function xlsxUnesc_(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
}
function xlsxSharedStrings_(xml) {
  const out = [];
  xml.replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => {
    let t = '';
    inner.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (mm, x) => { t += x; });
    out.push(xlsxUnesc_(t));
  });
  return out;
}
function xlsxReadCells_(xml, ss) {
  const cells = {};
  xml.replace(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m, ref, attrs, inner) => {
    if (!inner) { cells[ref] = ''; return; }
    const t = xlsxAttr_(attrs, 't');
    if (t === 'inlineStr') {
      let s = ''; inner.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (mm, x) => { s += x; });
      cells[ref] = xlsxUnesc_(s);
    } else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      cells[ref] = v ? (t === 's' ? ss[+v[1]] : xlsxUnesc_(v[1])) : '';
    }
  });
  return cells;
}
/** Ganti/isi sel; isiXml null = kosongkan nilai (gaya tetap) */
function xlsxSetCell_(xml, ref, row, isiXml) {
  const re = new RegExp('<c r="' + ref + '"([^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)');
  const build = attrs => {
    const a = attrs.replace(/\s+t="[^"]*"/, '');
    return isiXml ? '<c r="' + ref + '"' + a + ' t="inlineStr">' + isiXml + '</c>' : '<c r="' + ref + '"' + a + '/>';
  };
  if (re.test(xml)) return xml.replace(re, (m, attrs) => build(attrs));
  if (!isiXml) return xml;
  // sel belum ada: sisipkan setelah kolom A pada baris tsb
  const rowRe = new RegExp('(<row r="' + row + '"[^>]*>)([\\s\\S]*?)(<\\/row>)');
  if (rowRe.test(xml)) {
    return xml.replace(rowRe, (m, open, inner, close) => {
      const aCell = inner.match(new RegExp('<c r="A' + row + '"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)'));
      const newCell = build('');
      return aCell ? open + inner.replace(aCell[0], aCell[0] + newCell) + close : open + newCell + inner + close;
    });
  }
  return xml;
}

/* ---------- evaluator rumus sederhana ----------
 * Mendukung: "teks", angka, referensi (Sheet!$B$5 / 'Nama Sheet'!B5), operator & = <> ,
 * fungsi IF, MID, UPPER, LOWER, RIGHT, LEFT, REPT, LEN, TRIM, CONCATENATE.
 */
function xlsxEval_(formula, resolve) {
  const src = formula.replace(/^=/, '');
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const peek = s => { ws(); return src.substr(i, s.length).toUpperCase() === s.toUpperCase(); };
  const eat = s => { if (!peek(s)) throw new Error('Diharapkan ' + s + ' di posisi ' + i); i += s.length; };
  const str = v => (v === true ? 'TRUE' : v === false ? 'FALSE' : v == null ? '' : String(v));
  const num = v => { const n = Number(v); if (isNaN(n)) throw new Error('#VALUE'); return n; };

  function expr() {
    let left = concat();
    for (;;) {
      if (peek('<>')) { eat('<>'); const r = concat(); left = !xlsxEq_(left, r); }
      else if (peek('=')) { eat('='); const r = concat(); left = xlsxEq_(left, r); }
      else return left;
    }
  }
  function concat() {
    let v = primary();
    while (peek('&')) { eat('&'); v = str(v) + str(primary()); }
    return v;
  }
  function args() {
    const a = []; eat('(');
    if (peek(')')) { eat(')'); return a; }
    for (;;) { a.push(expr()); if (peek(',')) { eat(','); continue; } eat(')'); return a; }
  }
  function primary() {
    ws();
    const c = src[i];
    if (c === '"') {
      let s = ''; i++;
      for (;;) {
        if (src[i] === '"' && src[i + 1] === '"') { s += '"'; i += 2; }
        else if (src[i] === '"') { i++; break; }
        else if (i >= src.length) throw new Error('String tidak ditutup');
        else s += src[i++];
      }
      return s;
    }
    if (c === '(') { eat('('); const v = expr(); eat(')'); return v; }
    if (/[0-9.]/.test(c)) { const m = src.slice(i).match(/^[0-9.]+/); i += m[0].length; return Number(m[0]); }
    if (c === '-') { i++; return -num(primary()); }
    // referensi dengan nama sheet berkutip
    if (c === "'") {
      const m = src.slice(i).match(/^'((?:[^']|'')+)'!(\$?[A-Z]+\$?\d+)/);
      if (!m) throw new Error('Ref tidak valid');
      i += m[0].length; return resolve(m[1].replace(/''/g, "'"), m[2]);
    }
    let m = src.slice(i).match(/^([A-Za-z_][A-Za-z0-9_.]*)!(\$?[A-Z]+\$?\d+)/);
    if (m) { i += m[0].length; return resolve(m[1], m[2]); }
    m = src.slice(i).match(/^(_xlfn\.)?([A-Za-z][A-Za-z0-9.]*)\s*(?=\()/);
    if (m) {
      i += m[0].length;
      const fn = m[2].toUpperCase(), a = args();
      switch (fn) {
        case 'IF': return xlsxTruthy_(a[0]) ? (a.length > 1 ? a[1] : true) : (a.length > 2 ? a[2] : false);
        case 'MID': { const s = str(a[0]); const st = num(a[1]); return s.substr(st - 1, num(a[2])); }
        case 'UPPER': return str(a[0]).toUpperCase();
        case 'LOWER': return str(a[0]).toLowerCase();
        case 'RIGHT': { const s = str(a[0]); const n = a.length > 1 ? num(a[1]) : 1; return n <= 0 ? '' : s.slice(-n); }
        case 'LEFT': { const s = str(a[0]); const n = a.length > 1 ? num(a[1]) : 1; return s.slice(0, n); }
        case 'REPT': { const n = num(a[1]); return n > 0 ? str(a[0]).repeat(n) : ''; }
        case 'LEN': return str(a[0]).length;
        case 'TRIM': return str(a[0]).trim().replace(/\s+/g, ' ');
        case 'CONCATENATE': return a.map(str).join('');
        default: throw new Error('Fungsi tidak didukung: ' + fn);
      }
    }
    m = src.slice(i).match(/^(TRUE|FALSE)\b/i);
    if (m) { i += m[0].length; return m[1].toUpperCase() === 'TRUE'; }
    m = src.slice(i).match(/^\$?[A-Z]+\$?\d+/);
    if (m) { i += m[0].length; return resolve(null, m[0]); }
    throw new Error('Token tidak dikenal di posisi ' + i);
  }
  const v = expr(); ws();
  if (i < src.length) throw new Error('Sisa rumus: ' + src.slice(i));
  return v;
}
function xlsxEq_(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a == null ? '' : a).toUpperCase() === String(b == null ? '' : b).toUpperCase();
}
function xlsxTruthy_(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE' || s === '') return false;
  throw new Error('#VALUE');
}
