/**
 * Pratinjau lokal UI tanpa Apps Script.
 * Menggabungkan Index.html + Flyer.html, lalu memasang google.script.run tiruan berisi DATA FIKTIF.
 *   node dev/build-preview.js        -> menulis dev/preview/index.html
 *   python -m http.server 8766 -d dev/preview
 * Password tiruan: lihat MOCK_PW di dev/mock.js (hanya untuk pratinjau lokal).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const flyer = fs.readFileSync(path.join(root, 'Flyer.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
html = html.replace(/<\?!=[\s\S]*?\?>/, () => flyer);
html = html.replace('<head>', () => '<head>\n<script>\n' + mock + '\n</script>');
const out = path.join(__dirname, 'preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('ok ->', path.join(out, 'index.html'));
