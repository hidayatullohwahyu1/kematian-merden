# Surat Keterangan Kematian · Desa Merden

Aplikasi web pembuatan **Surat Keterangan Kematian (F-201)** Desa Merden, Kec. Purwanegara,
Kab. Banjarnegara, dibangun dengan Google Apps Script, ditambah **PWA** agar bisa dipasang
seperti aplikasi di HP Android.

## Isi repo

| File | Fungsi |
|---|---|
| `Code.gs` | Server Apps Script: login admin, cari warga di `DATA_KK`, penomoran surat, log/riwayat, dashboard publik |
| `XlsxFiller.gs` | Mengisi template `.xlsx` langsung (tanpa konversi) dan menghitung ulang rumus |
| `Index.html` | Antarmuka: dashboard, formulir surat, riwayat |
| `Flyer.html` | Menu "Buat Flyer WA" (disisipkan ke `Index.html`) |
| `docs/` | PWA untuk Android, di-host di GitHub Pages |

## Alur aplikasi

1. Admin masuk dengan password (dicek di server, sesi 6 jam).
2. Cari jenazah, ayah, ibu, pelapor dan saksi dari database `DATA_KK` (NIK, No KK, atau nama).
3. Server mengisi template `.xlsx`, memberi nomor `400.12.3.1/ NNN / bulan romawi / tahun`,
   menyimpan file ke folder arsip Drive, mencatat ke spreadsheet log, lalu file diunduh di browser.
4. Dashboard publik hanya menampilkan angka agregat (tanpa nama/NIK).

## Pemasangan Apps Script

1. Salin `Code.gs`, `XlsxFiller.gs`, `Index.html`, `Flyer.html` ke proyek Apps Script.
2. Isi ID di objek `CFG` (`Code.gs`).
3. **Setelan Proyek > Properti skrip**: tambahkan `ADMIN_PASSWORD`. Password tidak lagi
   ditulis di kode karena repo ini publik; tanpa properti ini login ditolak.
4. Jalankan `cekSetup()` sekali dari editor, lihat hasilnya di Log.
5. **Deploy > Deployment baru > Aplikasi web**, akses: *Siapa saja*. Untuk pembaruan, pakai
   *Kelola deployment > Edit > Versi baru* agar URL tetap sama.

## PWA Android

PWA ada di folder `docs/` dan dilayani GitHub Pages:
**https://hidayatullohwahyu1.github.io/kematian-merden/**

PWA berupa "cangkang" yang memuat Web App Apps Script di layar penuh. Isi dan data tetap dari
server Google, jadi setiap pembaruan Apps Script langsung terlihat tanpa memasang ulang aplikasi.
Data warga tidak disimpan di HP.

**Memasang di HP:** buka alamat di atas dengan Chrome Android, ketuk **Pasang** (atau menu ⋮ >
*Instal aplikasi* / *Tambahkan ke layar utama*).

**Mengganti URL Web App:** edit `docs/config.js`. Bila mengubah file lain di `docs/`, naikkan
`VERSI` di `docs/sw.js` agar HP mengambil versi baru.

**Ingin file APK / Play Store?** Masukkan alamat PWA di <https://www.pwabuilder.com> lalu pilih
*Android* untuk membuat paket TWA (Trusted Web Activity).

## Uji tampilan di komputer (tanpa Apps Script)

```bash
node dev/build-preview.js
python -m http.server 8766 -d dev/preview
```

Buka `http://localhost:8766`. Server Apps Script diganti data **fiktif** di `dev/mock.js`
(password pratinjau ada di file itu, hanya berlaku lokal). Cocok untuk mengecek tampilan HP
lewat mode perangkat di DevTools browser.
