/**
 * Pratinjau lokal UI tanpa Apps Script.
 * Menggabungkan Index.html + Flyer.html, lalu memasang google.script.run tiruan berisi DATA FIKTIF.
 *   node dev/build-preview.js        -> menulis dev/preview/index.html
 *   python -m http.server 8766 -d dev/preview
 * Password tiruan: lihat MOCK_PW di dev/mock.js (hanya untuk pratinjau lokal).
 *
 * PENTING: HtmlService Apps Script menghapus semua teks setelah "//" di dalam <script>,
 * BAHKAN bila "//" ada di dalam string (mis. 'https://...'). Skrip ini meniru perilaku itu
 * agar galatnya sudah terlihat di pratinjau, lalu memeriksa sintaks setiap skrip.
 * Tulis alamat di JavaScript sebagai 'https:\/\/...'.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const flyer = fs.readFileSync(path.join(root, 'Flyer.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
html = html.replace(/<\?!=[\s\S]*?\?>/, () => flyer);

// tiru HtmlService: buang "//" sampai akhir baris di dalam <script> (tanpa peduli string)
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (all, js) => '<script>' + js.split('\n').map(l => {
  const i = l.indexOf('//'); return i < 0 ? l : l.slice(0, i);
}).join('\n') + '</script>');

// periksa sintaks setiap skrip
let galat = 0, k = 0;
html.replace(/<script>([\s\S]*?)<\/script>/g, (all, js) => {
  k++;
  try { new vm.Script(js, { filename: 'skrip' + k }); }
  catch (e) {
    galat++;
    const b = +((String(e.stack).match(/skrip\d+:(\d+)/) || [])[1] || 0);
    console.error('GALAT SINTAKS skrip', k, 'baris', b + ':', e.message, '\n   ', (js.split('\n')[b - 1] || '').trim().slice(0, 160));
  }
  return all;
});

html = html.replace('<head>', () => '<head>\n<script>\n' + mock + '\n</script>');
const out = path.join(__dirname, 'preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('ok ->', path.join(out, 'index.html'), '| skrip:', k, '| galat sintaks:', galat);
if (galat) process.exit(1);
