/* Service worker PWA SK Kematian Merden.
 * Hanya menyimpan "cangkang" aplikasi (halaman ini + ikon). Service worker tidak menyimpan data warga;
 * isi aplikasi tetap dimuat langsung dari Google Apps Script.
 * Naikkan VERSI setiap kali file di folder docs/ diubah.
 */
const VERSI = 'skk-merden-v2';
const CANGKANG = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(CANGKANG)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Jangan sentuh permintaan ke Google (Apps Script, Drive, font) atau selain GET.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Halaman & config: utamakan jaringan agar pembaruan cepat sampai, cadangan dari cache saat offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const salin = res.clone();
          caches.open(VERSI).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, salin));
          return res;
        })
        .catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true }))
    );
    return;
  }

  // Ikon & manifest: cache dulu.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
