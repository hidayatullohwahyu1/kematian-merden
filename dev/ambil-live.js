/**
 * Ambil HTML yang BENAR-BENAR dilayani Apps Script (setelah diproses HtmlService),
 * lalu cek sintaks setiap <script>. Berguna untuk menemukan galat yang hanya muncul di server.
 *   node dev/ambil-live.js            -> menulis dev/preview/live/user.html
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const URL_APP = 'https://script.google.com/macros/s/AKfycbzjfzpnhNc27MB-zzWhfRs76e8OD2d1K1HND2h1KxL9QqzntSqS2pd35Q4Kzzx4lXYF/exec';

function ambil(u, n = 0) {
  return new Promise((ok, no) => https.get(u, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && n < 5) return ok(ambil(new URL(r.headers.location, u).href, n + 1));
    let d = ''; r.setEncoding('utf8'); r.on('data', c => d += c); r.on('end', () => ok(d));
  }).on('error', no));
}

/** Urai satu lapis escape gaya JavaScript: \xNN, \uNNNN, \n, \t, \\, \/, \" ... */
function urai(t) {
  return t.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, (a, k) => {
    if (k[0] === 'x' && k.length === 3) return String.fromCharCode(parseInt(k.slice(1), 16));
    if (k[0] === 'u' && k.length === 5) return String.fromCharCode(parseInt(k.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r' }[k] || k;
  });
}

(async () => {
  const s = await ambil(URL_APP);
  const kunci = '\\x22userHtml\\x22:\\x22';
  const i = s.indexOf(kunci);
  if (i < 0) throw new Error('userHtml tidak ditemukan');
  const awal = i + kunci.length;
  const akhir = s.indexOf('\\x22,\\x22', awal);
  const t = urai(urai(s.slice(awal, akhir)));          // literal luar, lalu string JSON dalam
  const out = path.join(__dirname, 'preview', 'live');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'user.html'), t);
  console.log('userHtml:', t.length, 'karakter,', t.split('\n').length, 'baris');
  const re = /<script>([\s\S]*?)<\/script>/g; let m, k = 0, galat = 0;
  while ((m = re.exec(t))) {
    k++;
    const barisAwal = t.slice(0, m.index).split('\n').length;
    try { new vm.Script(m[1], { filename: 'skrip' + k }); }
    catch (e) {
      galat++;
      const st = String(e.stack).match(/skrip\d+:(\d+)/);
      const b = st ? +st[1] : 0;
      console.log('GALAT skrip', k, '(mulai baris dokumen', barisAwal + '):', e.message, '-> baris skrip', b, '= baris dokumen', barisAwal + b - 1);
      const L = m[1].split('\n'); for (let j = Math.max(1, b - 2); j <= Math.min(L.length, b + 2); j++) console.log('   ', j, JSON.stringify(L[j - 1].slice(0, 220)));
    }
  }
  console.log('skrip:', k, 'galat:', galat);
})().catch(e => { console.error(e.message); process.exit(1); });
