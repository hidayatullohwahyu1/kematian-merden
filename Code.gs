/**
 * WEB APP SURAT KETERANGAN KEMATIAN (F-201) — DESA MERDEN
 * File proyek: Code.gs, XlsxFiller.gs, Index.html (termasuk menu Buat Flyer WA)
 * Hasil: file Excel (.xlsx) terisi otomatis -> diunduh di browser + diarsipkan di Drive.
 */

const CFG = {
  DB_SS_ID: '1qEOzrS6reA4dvxn5-2CnLO8WOQfuCvbuARJ2UjSMGAU',            // Google Sheet hasil konversi KARTU_PINTAR_ANJUNGAN_FIX_TGL.xlsx
  DB_SHEET: 'DATA_KK',
  LOG_SHEET: 'LOG_SURAT_KEMATIAN',
  // Spreadsheet khusus riwayat/log surat. Kosongkan = dibuat otomatis di folder arsip.
  LOG_SS_ID: '',
  LOG_SS_NAMA: 'LOG SURAT KEMATIAN - DESA MERDEN',                    // dibuat otomatis bila belum ada
  TEMPLATE_XLSX_ID: '1j5bdPXA-diDVEe2OlCOK71L7rPfZJHGE', // file .xlsx ASLI (JANGAN dikonversi ke Google Sheets)
  FOLDER_ARSIP_ID: '16wfRbG2nn6sUjC4AAexxJTl4L5r-W1iB',
  KODE_KLASIFIKASI: '400.12.3.1',
  MAKS_HASIL_CARI: 20,
  TZ: 'Asia/Jakarta',
  // Password admin WAJIB diisi lewat Setelan Proyek > Properti skrip: ADMIN_PASSWORD
  // (sengaja tidak ditulis di kode karena repo GitHub bersifat publik)
  ADMIN_PASSWORD_DEFAULT: '',
  SESI_DETIK: 21600,          // sesi login 6 jam (diperpanjang otomatis selama dipakai)
  DASH_CACHE_DETIK: 300,      // dashboard di-cache 5 menit
};

// Kolom database (header baris 1, urutan harus sama)
const DB_COLS = ['NIK', 'NAMA', 'TEMPAT_LAHIR', 'TGL_LAHIR', 'JK', 'AGAMA', 'PEKERJAAN', 'STATUS_KAWIN', 'RT', 'RW',
  'DUSUN', 'NO_KK', 'NAMA_KEPALA', 'PENDIDIKAN', 'GOL_DARAH', 'TGL_KAWIN', 'HUBUNGAN', 'AYAH', 'IBU', 'ALAMAT'];
// Kolom wajib ada di header database (urutan bebas, dibaca dari baris 1)
const DB_WAJIB = ['NIK', 'NAMA', 'TGL_LAHIR', 'JK', 'NO_KK'];

const PENANDATANGAN = [
  { nama: 'SADAR', jabatan: 'KEPALA DESA MERDEN', an: '' },
  { nama: 'MUCHAMAD AFIFUDIN', jabatan: 'SEKRETARIS DESA', an: 'a.n. KEPALA DESA MERDEN' },
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Surat Keterangan Kematian · Desa Merden')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===================================================== DATA AWAL */
function getInit(token) {
  const sesi = requireAuth_(token);
  cekKonfigurasi_();
  const now = new Date();
  return {
    penandatangan: PENANDATANGAN,
    nomorBerikut: nomorBerikut_(now.getFullYear()),
    hariIni: Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd'),
    riwayat: getRiwayat_(),
    petugas: sesi.nama,
  };
}

function cekKonfigurasi_() {
  ['DB_SS_ID', 'TEMPLATE_XLSX_ID', 'FOLDER_ARSIP_ID'].forEach(k => {
    if (!CFG[k] || /^ISI_/.test(CFG[k])) throw new Error('Konfigurasi ' + k + ' di Code.gs belum diisi.');
  });
}

/* ===================================================== DATABASE */
let DB_ = null;   // cache per eksekusi: {sh, head: {NAMA_KOLOM: indeks 0-based}, ncol}

/** Buka sheet database dan baca header baris 1 (kolom boleh berpindah urutan). */
function db_() {
  if (DB_) return DB_;
  const sh = SpreadsheetApp.openById(CFG.DB_SS_ID).getSheetByName(CFG.DB_SHEET);
  if (!sh) throw new Error('Sheet "' + CFG.DB_SHEET + '" tidak ditemukan di spreadsheet database.');
  const ncol = sh.getLastColumn();
  const head = {};
  sh.getRange(1, 1, 1, ncol).getDisplayValues()[0].forEach((h, i) => {
    const k = String(h).trim().toUpperCase().replace(/\s+/g, '_');
    if (k && head[k] === undefined) head[k] = i;
  });
  const kurang = DB_WAJIB.filter(k => head[k] === undefined);
  if (kurang.length) throw new Error('Kolom database tidak ditemukan: ' + kurang.join(', ') + '. Periksa header baris 1.');
  DB_ = { sh: sh, head: head, ncol: ncol };
  return DB_;
}

/** Nilai sel -> teks rapi. Tangani sel yang terlanjur jadi Date atau angka saat konversi. */
function selTeks_(v, kolom) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, CFG.TZ, 'dd-MM-yyyy');
  if (typeof v === 'number') return String(Math.round(v));   // NIK/KK 16 digit masih presisi di Number
  return String(v).trim();
}

function rowToObj_(vals) {
  const head = db_().head, o = {};
  DB_COLS.forEach(k => { o[k] = head[k] === undefined ? '' : selTeks_(vals[head[k]], k); });
  o.TGL_LAHIR = fmtTgl_(o.TGL_LAHIR);   // seragamkan DD-MM-YYYY
  return o;
}

/** Cari di satu kolom; return array objek warga. */
function cariKolom_(kolom, teks, persis) {
  const d = db_();
  const n = d.sh.getLastRow() - 1;
  if (n < 1 || !teks || d.head[kolom] === undefined) return [];
  let tf = d.sh.getRange(2, d.head[kolom] + 1, n, 1).createTextFinder(teks).matchCase(false);
  if (persis) tf = tf.matchEntireCell(true);
  const rows = tf.findAll().slice(0, CFG.MAKS_HASIL_CARI).map(r => r.getRow());
  if (!rows.length) return [];
  const akhir = colLetter_(d.ncol);
  return d.sh.getRangeList(rows.map(r => 'A' + r + ':' + akhir + r)).getRanges()
    .map(rg => rowToObj_(rg.getValues()[0]));
}

function colLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Surat yang sudah pernah dibuat untuk NIK ini (cegah surat ganda). */
function cekSuratNik(token, nik) {
  requireAuth_(token);
  nik = String(nik || '').replace(/\D/g, '');
  if (!nik) return [];
  return logRows_().filter(r => r[5] === nik).map(r => ({ nomor: r[3], tgl: r[4], url: r[11] }));
}

/** Cari warga: angka 16 digit = NIK lalu No KK; selain itu potongan nama. */
function cariWarga(token, q) {
  requireAuth_(token);
  q = String(q || '').trim();
  const digit = q.replace(/[\s.\-]/g, '');
  if (/^\d{16}$/.test(digit)) {
    const byNik = cariKolom_('NIK', digit, true);
    return byNik.length ? byNik : cariKolom_('NO_KK', digit, true);
  }
  if (/^\d{6,15}$/.test(digit)) return cariKolom_('NIK', digit, false);
  if (q.length < 3) return [];
  return cariKolom_('NAMA', q.toUpperCase(), false);
}

/** Anggota satu KK. */
function anggotaKK(token, noKK) {
  requireAuth_(token);
  noKK = String(noKK || '').replace(/\D/g, '');
  return noKK ? cariKolom_('NO_KK', noKK, true) : [];
}

/**
 * Cari ayah/ibu dari nama, disaring: jenis kelamin sesuai dan minimal 12 tahun lebih tua dari anak.
 * @return {{cocok: Object[], lain: Object[]}}
 */
function cariOrangTua(token, nama, peran, tglLahirAnak) {
  requireAuth_(token);
  const semua = cariKolom_('NAMA', String(nama || '').trim(), true);
  const jk = peran === 'A_' ? 'L' : 'P';
  const anak = keDate_(tglLahirAnak);
  const cocok = [], lain = [];
  semua.forEach(o => {
    const lahir = keDate_(o.TGL_LAHIR);
    const okJK = String(o.JK).toUpperCase().charAt(0) === jk;
    const okUmur = !anak || !lahir || (anak.getFullYear() - lahir.getFullYear() >= 12);
    (okJK && okUmur ? cocok : lain).push(o);
  });
  return { cocok: cocok, lain: lain };
}

/* ===================================================== NOMOR & LOG */
const LOG_HEAD = ['WAKTU', 'TAHUN', 'NO_URUT', 'NOMOR_SURAT', 'TGL_SURAT', 'NIK_JENAZAH', 'NAMA_JENAZAH',
  'TGL_KEMATIAN', 'NAMA_PELAPOR', 'PENANDATANGAN', 'PETUGAS', 'FILE_URL',
  // kolom 13-18: data ringkas untuk dashboard (tanpa nama)
  'DUSUN', 'RT', 'RW', 'JK', 'UMUR', 'SEBAB',
  // kolom 19-21: catatan admin dan salinan lengkap isian surat (untuk menu Riwayat)
  'CATATAN', 'CATATAN_WAKTU', 'DATA_JSON'];

let LOG_ = null;   // cache sheet log per eksekusi

/** Spreadsheet log tersendiri. Dibuat otomatis sekali bila belum ada; ID disimpan di Properti skrip. */
function logSS_() {
  const props = PropertiesService.getScriptProperties();
  const id = CFG.LOG_SS_ID || props.getProperty('LOG_SS_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('Spreadsheet log (ID ' + id + ') tidak bisa dibuka: ' + e.message); }
  }
  const ss = SpreadsheetApp.create(CFG.LOG_SS_NAMA);
  // cegah dua spreadsheet bila dua pengguna membuka bersamaan pertama kali
  const lain = props.getProperty('LOG_SS_ID');
  if (lain) { try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) {} return SpreadsheetApp.openById(lain); }
  props.setProperty('LOG_SS_ID', ss.getId());
  try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(CFG.FOLDER_ARSIP_ID)); } catch (e) { /* tetap di My Drive */ }
  return ss;
}

function logSheet_() {
  if (LOG_) return LOG_;
  const ss = logSS_();
  let sh = ss.getSheetByName(CFG.LOG_SHEET);
  if (!sh) {
    // spreadsheet baru: pakai lembar kosong bawaan bila ada
    const kosong = ss.getSheets().filter(s => s.getLastRow() === 0);
    sh = kosong.length ? kosong[0].setName(CFG.LOG_SHEET) : ss.insertSheet(CFG.LOG_SHEET);
    sh.getRange('A:U').setNumberFormat('@');
    sh.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < LOG_HEAD.length) {
    sh.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]);
    sh.getRange('M:U').setNumberFormat('@');
  }
  if (sh.getLastRow() <= 1) pindahkanLogLama_(sh);   // log baru masih kosong: ambil data lama (diulang bila gagal)
  LOG_ = sh;
  return sh;
}

/** Sekali saja: salin log lama dari spreadsheet DATA_KK ke spreadsheet log baru, lalu ganti nama sheet lama jadi cadangan. */
function pindahkanLogLama_(baru) {
  try {
    const db = SpreadsheetApp.openById(CFG.DB_SS_ID);
    if (db.getId() === baru.getParent().getId()) return;
    const lama = db.getSheetByName(CFG.LOG_SHEET);
    if (!lama) return;
    const n = lama.getLastRow() - 1;
    if (n >= 1 && baru.getLastRow() <= 1) {
      const kol = Math.min(lama.getLastColumn(), LOG_HEAD.length);
      const v = lama.getRange(2, 1, n, kol).getDisplayValues()
        .map(r => r.concat(Array(LOG_HEAD.length - r.length).fill('')));
      baru.getRange(2, 1, n, LOG_HEAD.length).setValues(v);
    }
    lama.setName(CFG.LOG_SHEET + '_CADANGAN_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd'));
  } catch (e) {
    throw new Error('Gagal memindahkan log lama: ' + e.message);
  }
}

function logRows_() {
  const sh = logSheet_();
  const n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, LOG_HEAD.length).getDisplayValues();
}

function nomorBerikut_(tahun, rows) {
  rows = rows || logRows_();
  let max = 0;
  rows.forEach(r => { if (String(r[1]) === String(tahun)) max = Math.max(max, parseInt(r[2], 10) || 0); });
  return padNo_(max + 1);
}

function padNo_(n) {
  const s = String(n).replace(/\D/g, '');
  return s.length >= 3 ? s : ('000' + s).slice(-3);
}

function getRiwayat_(jumlah) {
  return logRows_().slice(-(jumlah || 8)).reverse().map(r => ({
    waktu: r[0], nomor: r[3], nama: r[6], tglMati: r[7], pelapor: r[8], url: r[11],
  }));
}

function romawi_(bulan) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][bulan];
}

/* ===================================================== GENERATE EXCEL */
/**
 * @param {Object} form KEY sesuai sheet DATA + TGL_SURAT_ISO (yyyy-mm-dd), NO_URUT, NO_MANUAL (bool)
 */
function generateSuratKematian(token, form) {
  const sesi = requireAuth_(token);
  return generate_(form, sesi.nama);
}

function generate_(form, petugas) {
  cekKonfigurasi_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Server sedang membuat surat lain. Coba lagi beberapa detik lagi.');
  try {
    const d = Object.assign({}, form);
    const manual = d.NO_MANUAL === true || d.NO_MANUAL === 'true';
    const tglSurat = keDate_(d.TGL_SURAT_ISO) || new Date();
    delete d.TGL_SURAT_ISO; delete d.NO_MANUAL;

    if (!d.J_NAMA) throw new Error('Nama jenazah belum diisi.');
    if (!d.J_TGL_MATI) throw new Error('Tanggal kematian belum diisi.');

    const rows = logRows_();
    const warn = [];
    d.KODE_KLASIFIKASI = CFG.KODE_KLASIFIKASI;
    d.TAHUN_SURAT = String(tglSurat.getFullYear());
    d.BULAN_ROMAWI = romawi_(tglSurat.getMonth());
    if (manual && /[1-9]/.test(String(d.NO_URUT || ''))) {
      d.NO_URUT = padNo_(d.NO_URUT);
      const dipakai = rows.some(r => r[1] === d.TAHUN_SURAT && padNo_(r[2]) === d.NO_URUT);
      if (dipakai) warn.push('Nomor ' + d.NO_URUT + ' tahun ' + d.TAHUN_SURAT + ' sudah pernah dipakai.');
    } else {
      d.NO_URUT = nomorBerikut_(d.TAHUN_SURAT, rows);   // nomor ditentukan server di dalam lock
    }
    d.TGL_SURAT = tglIndo_(tglSurat);

    lengkapiData_(d, tglSurat, warn);
    if (d.J_NIK) {
      const lama = rows.filter(r => r[5] === d.J_NIK);
      if (lama.length) warn.push('NIK jenazah ini sudah pernah dibuatkan surat: ' + lama.map(r => r[3]).join(', ') + '.');
    }
    const nomor = CFG.KODE_KLASIFIKASI + '/ ' + d.NO_URUT + ' / ' + d.BULAN_ROMAWI + ' / ' + d.TAHUN_SURAT;

    const namaFile = 'SKK_' + d.NO_URUT + '_' + d.BULAN_ROMAWI + '_' + d.TAHUN_SURAT + '_' +
      String(d.J_NAMA).replace(/[^\w ]/g, '').trim().replace(/\s+/g, '_') + '.xlsx';
    const tpl = DriveApp.getFileById(CFG.TEMPLATE_XLSX_ID).getBlob();
    const xlsx = isiXlsx_(tpl, d, namaFile);
    const file = DriveApp.getFolderById(CFG.FOLDER_ARSIP_ID).createFile(xlsx);

    logSheet_().appendRow([
      Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), d.TAHUN_SURAT, d.NO_URUT, nomor,
      d.TGL_SURAT, d.J_NIK || '', d.J_NAMA, d.J_TGL_MATI || '', d.P_NAMA || '', d.TTD_NAMA || '',
      petugas || Session.getActiveUser().getEmail() || '', file.getUrl(),
      dusunJenazah_(d), d.J_RT || '', d.J_RW || '', d.J_JK || '', d.J_UMUR || '', d.J_SEBAB || '',
      '', '', JSON.stringify(d),
    ]);
    SpreadsheetApp.flush();
    hapusCacheDashboard_();

    return {
      nama: namaFile, base64: Utilities.base64Encode(xlsx.getBytes()), url: file.getUrl(),
      nomor: nomor, peringatan: warn,
      nomorBerikut: nomorBerikut_(d.TAHUN_SURAT), riwayat: getRiwayat_(),
    };
  } finally {
    lock.releaseLock();
  }
}

/* ===================================================== PENGOLAHAN DATA */
const BATAS = { NAMA: 31, PEKERJAAN: 31, TEMPAT_LAHIR: 31, TEMPAT_MATI: 31, ALAMAT: 20 };
const SINGKAT_PEKERJAAN = { 'TENTARA NASIONAL INDONESIA (TNI)': 'TNI', 'KEPOLISIAN RI (POLRI)': 'POLRI' };
const PREFIX = ['J_', 'A_', 'I_', 'P_', 'S1_', 'S2_'];
const LABEL = { J_: 'Jenazah', A_: 'Ayah', I_: 'Ibu', P_: 'Pelapor', S1_: 'Saksi I', S2_: 'Saksi II' };

function lengkapiData_(d, tglSurat, warn) {
  Object.keys(d).forEach(k => {
    if (typeof d[k] === 'string') d[k] = d[k].trim().replace(/\s+/g, ' ');
    else if (d[k] != null && typeof d[k] !== 'boolean') d[k] = String(d[k]);
  });

  ['J_TGL_LAHIR', 'J_TGL_MATI', 'A_TGL_LAHIR', 'I_TGL_LAHIR', 'P_TGL_LAHIR'].forEach(k => {
    if (!d[k]) return;
    const f = fmtTgl_(d[k]);
    if (!/^\d{2}-\d{2}-\d{4}$/.test(f)) warn.push(k + ': format tanggal "' + d[k] + '" tidak dikenali (pakai DD-MM-YYYY)');
    d[k] = f;
  });

  // Logika tanggal
  const lahir = keDate_(d.J_TGL_LAHIR), mati = keDate_(d.J_TGL_MATI);
  if (lahir && mati && mati < lahir) warn.push('Tanggal kematian lebih awal dari tanggal lahir jenazah.');
  if (mati && mati > tglSurat) warn.push('Tanggal kematian sesudah tanggal surat.');

  // Umur (dikosongkan = dihitung otomatis)
  if (!d.J_UMUR && d.J_TGL_LAHIR) d.J_UMUR = hitungUmur_(d.J_TGL_LAHIR, d.J_TGL_MATI || tglSurat);
  ['A_', 'I_', 'P_'].forEach(p => {
    if (!d[p + 'UMUR'] && d[p + 'TGL_LAHIR']) d[p + 'UMUR'] = hitungUmur_(d[p + 'TGL_LAHIR'], tglSurat);
  });

  ['J_JK', 'P_JK', 'S1_JK', 'S2_JK'].forEach(k => { if (d[k]) d[k] = kodeJK_(d[k]); });
  if (d.J_AGAMA) d.J_AGAMA = kodeAgama_(d.J_AGAMA);

  if (d.J_PUKUL) {
    const m = String(d.J_PUKUL).match(/(\d{1,2})[:.](\d{2})/);
    d.J_PUKUL = m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
  }

  PREFIX.forEach(p => {
    if (!d[p + 'NIK'] && !d[p + 'NAMA']) return;
    if (d[p + 'RT'] || d[p + 'RW']) {           // warga Merden: lengkapi wilayah
      d[p + 'DESA'] = d[p + 'DESA'] || 'MERDEN';
      d[p + 'KEC'] = d[p + 'KEC'] || 'PURWANEGARA';
      d[p + 'KAB'] = d[p + 'KAB'] || 'BANJARNEGARA';
      d[p + 'PROV'] = d[p + 'PROV'] || 'JAWA TENGAH';
    }
    const pk = String(d[p + 'PEKERJAAN'] || '').toUpperCase();
    if (SINGKAT_PEKERJAAN[pk]) d[p + 'PEKERJAAN'] = SINGKAT_PEKERJAAN[pk];
    if (d[p + 'NIK']) {
      d[p + 'NIK'] = d[p + 'NIK'].replace(/\D/g, '');
      if (d[p + 'NIK'].length !== 16) warn.push(LABEL[p] + ': NIK tidak 16 digit');
    }
    Object.keys(BATAS).forEach(f => {
      const v = d[p + f];
      if (v && String(v).length > BATAS[f]) {
        warn.push(LABEL[p] + ': ' + f.replace('_', ' ').toLowerCase() + ' ' + String(v).length +
          ' huruf, kotak hanya ' + BATAS[f] + '. Rapikan di sheet DATA.');
      }
    });
  });
  if (d.NO_KK) {
    d.NO_KK = d.NO_KK.replace(/\D/g, '');
    if (d.NO_KK.length !== 16) warn.push('Nomor KK tidak 16 digit');
  }
  if (d.NAMA_KK && d.NAMA_KK.length > 31) warn.push('Nama kepala keluarga lebih dari 31 huruf');
  if (!d.P_NAMA) warn.push('Data pelapor kosong.');
  return warn;
}

function fmtTgl_(v) {
  const dt = keDate_(v);
  return dt ? Utilities.formatDate(dt, CFG.TZ, 'dd-MM-yyyy') : String(v || '');
}

function keDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function hitungUmur_(lahir, acuan) {
  const a = keDate_(lahir), b = keDate_(acuan);
  if (!a || !b) return '';
  let u = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) u--;
  return u >= 0 ? String(u) : '';
}

function kodeJK_(v) {
  const s = String(v).toUpperCase();
  if (s === '1' || s.charAt(0) === 'L') return '1';
  if (s === '2' || s.charAt(0) === 'P') return '2';
  return '';
}

function kodeAgama_(v) {
  const s = String(v).toUpperCase().trim();
  if (/^[1-6]$/.test(s)) return s;
  const map = { ISLAM: '1', KRISTEN: '2', KATOLIK: '3', KATHOLIK: '3', HINDU: '4', BUDHA: '5', BUDDHA: '5' };
  return map[s] || '6';
}

function tglIndo_(d) {
  const bln = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
    'Oktober', 'November', 'Desember'];
  return d.getDate() + ' ' + bln[d.getMonth()] + ' ' + d.getFullYear();
}

/* ===================================================== CEK PEMASANGAN
 * Jalankan cekSetup() dari editor sekali setelah mengisi CFG. Hasil di Log (Ctrl+Enter).
 */
function cekSetup() {
  const hasil = [];
  const ok = (t) => hasil.push('OK   ' + t), gagal = (t) => hasil.push('GAGAL ' + t);
  try { cekKonfigurasi_(); ok('Semua ID di CFG sudah diisi'); } catch (e) { gagal(e.message); }
  try {
    const d = db_();
    ok('Database terbuka: ' + (d.sh.getLastRow() - 1) + ' baris warga');
    const hilang = DB_COLS.filter(k => d.head[k] === undefined);
    hilang.length ? hasil.push('INFO Kolom opsional tidak ada: ' + hilang.join(', ')) : ok('Semua 20 kolom database ditemukan');
    const contoh = d.sh.getRange(2, 1, 1, d.ncol).getValues()[0];
    const nik = contoh[d.head.NIK], tgl = contoh[d.head.TGL_LAHIR];
    typeof nik === 'string' ? ok('Kolom NIK berformat teks') : gagal('Kolom NIK bukan teks. Format > Angka > Teks biasa, lalu impor ulang');
    typeof tgl === 'string' ? ok('Kolom TGL_LAHIR berformat teks') : hasil.push('INFO TGL_LAHIR berupa tanggal; tetap bisa dibaca');
  } catch (e) { gagal('Database: ' + e.message); }
  try {
    const f = DriveApp.getFileById(CFG.TEMPLATE_XLSX_ID);
    /spreadsheetml/.test(f.getMimeType()) ? ok('Template .xlsx: ' + f.getName())
      : gagal('Template harus file .xlsx asli, bukan Google Sheets (mime: ' + f.getMimeType() + ')');
  } catch (e) { gagal('Template: ' + e.message); }
  try { ok('Folder arsip: ' + DriveApp.getFolderById(CFG.FOLDER_ARSIP_ID).getName()); } catch (e) { gagal('Folder arsip: ' + e.message); }
  try {
    const sh = logSheet_();
    ok('Spreadsheet log: ' + sh.getParent().getName() + ' (' + (sh.getLastRow() - 1) + ' surat) ' + sh.getParent().getUrl());
    ok('Nomor surat berikut: ' + nomorBerikut_(new Date().getFullYear()));
  }
  catch (e) { gagal('Log: ' + e.message); }
  Logger.log(hasil.join('\n'));
}

/* ===================================================== LOGIN ADMIN
 * Password dicek di server (tidak pernah dikirim ke browser).
 * Ganti password: Setelan Proyek (ikon roda gigi) > Properti skrip > tambah ADMIN_PASSWORD.
 */
function login(password) {
  const cache = CacheService.getScriptCache();
  if (cache.get('kunci_login')) throw new Error('Terlalu banyak percobaan salah. Coba lagi 10 menit lagi.');
  const benar = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || CFG.ADMIN_PASSWORD_DEFAULT;
  if (!benar) throw new Error('Password admin belum diatur. Isi Properti skrip ADMIN_PASSWORD di Setelan Proyek.');
  if (hash_(String(password || '')) !== hash_(String(benar))) {
    const n = (parseInt(cache.get('gagal_login'), 10) || 0) + 1;
    if (n >= 5) {
      cache.put('kunci_login', '1', 600); cache.remove('gagal_login');
      throw new Error('Password salah 5 kali. Login dikunci 10 menit.');
    }
    cache.put('gagal_login', String(n), 600);
    throw new Error('Password salah. Sisa percobaan: ' + (5 - n) + '.');
  }
  cache.remove('gagal_login');
  const nm = 'ADMIN';
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('sesi_' + token, JSON.stringify({ nama: nm, mulai: Date.now() }), CFG.SESI_DETIK);
  return { token: token, nama: nm };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('sesi_' + token);
  return true;
}

function cekSesi(token) {
  try { return { ok: true, nama: requireAuth_(token).nama }; } catch (e) { return { ok: false }; }
}

function requireAuth_(token) {
  if (!token || typeof token !== 'string' || token.length < 32) throw new Error('SESI_HABIS: Silakan masuk sebagai admin.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('sesi_' + token);
  if (!raw) throw new Error('SESI_HABIS: Sesi berakhir, silakan masuk lagi.');
  cache.put('sesi_' + token, raw, CFG.SESI_DETIK);   // perpanjang selama dipakai
  return JSON.parse(raw);
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/* ===================================================== DASHBOARD PUBLIK
 * Hanya angka agregat. Tidak ada nama, NIK, atau alamat yang dikirim ke browser.
 */
const DUSUN_RW = { 1: 'MERDEN TENGAH', 2: 'KARANGKAJEN', 8: 'KARANGKAJEN', 3: 'MERDEN WETAN', 4: 'MERDEN WETAN',
  5: 'RAWAWUNGU', 7: 'RAWAWUNGU', 6: 'PEKUNDEN' };
const DUSUN_URUT = ['MERDEN TENGAH', 'MERDEN WETAN', 'KARANGKAJEN', 'RAWAWUNGU', 'PEKUNDEN'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function dusunJenazah_(d) {
  const desa = String(d.J_DESA || '').toUpperCase().trim();
  if (desa && desa !== 'MERDEN') return 'LUAR DESA';
  return DUSUN_RW[parseInt(d.J_RW, 10)] || '';
}

function hapusCacheDashboard_() {
  CacheService.getScriptCache().put('dash_ver', String(Date.now()), 21600);
}

function getDashboard(tahun) {
  cekKonfigurasi_();
  const now = new Date(), thIni = now.getFullYear();
  tahun = parseInt(tahun, 10) || thIni;
  const cache = CacheService.getScriptCache();
  const key = 'dash_' + (cache.get('dash_ver') || '0') + '_' + tahun;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const pend = statPenduduk_();
  const rows = logRows_();
  const bulanIni = Utilities.formatDate(now, CFG.TZ, 'yyyy-MM');

  // tahun yang tersedia
  const th = {}; th[thIni] = 1;
  rows.forEach(r => { if (/^\d{4}$/.test(r[1])) th[r[1]] = 1; });

  // surat
  const suratTahun = rows.filter(r => String(r[1]) === String(tahun));
  const suratBulan = rows.filter(r => String(r[0]).slice(0, 7) === bulanIni).length;

  // kematian unik (satu orang bisa punya lebih dari satu surat)
  const seen = {}, mati = [], semuaNik = {};
  rows.forEach(r => {
    const t = keDate_(r[7]);
    if (r[5]) semuaNik[r[5]] = r[12];
    const thMati = t ? t.getFullYear() : parseInt(r[1], 10);
    if (thMati !== tahun) return;
    const k = r[5] || (r[6] + '|' + r[7]);
    if (seen[k]) return;
    seen[k] = 1;
    mati.push({ bulan: t ? t.getMonth() : null, dusun: r[12], jk: r[15], umur: parseInt(r[16], 10), sebab: r[17] });
  });

  const perBulan = BULAN_PENDEK.map(() => 0);
  mati.forEach(m => { if (m.bulan != null) perBulan[m.bulan]++; });

  const hitung = (labels, fn) => labels.map(l => ({ label: l, n: mati.filter(m => fn(m) === l).length }));
  const perDusun = DUSUN_URUT.map(dz => ({ label: judul_(dz), n: mati.filter(m => m.dusun === dz).length }));
  const luar = mati.filter(m => m.dusun === 'LUAR DESA').length;
  const takTercatat = mati.filter(m => !m.dusun).length;
  if (luar) perDusun.push({ label: 'Luar desa', n: luar });
  if (takTercatat) perDusun.push({ label: 'Tidak tercatat', n: takTercatat });

  const grupUmur = u => isNaN(u) ? '' : u <= 5 ? '0–5' : u <= 17 ? '6–17' : u <= 44 ? '18–44' : u <= 59 ? '45–59' : u <= 74 ? '60–74' : '75+';
  const umur = hitung(['0–5', '6–17', '18–44', '45–59', '60–74', '75+'], m => grupUmur(m.umur));
  const grupSebab = s => s === '1' ? 'Sakit biasa/tua' : s === '2' ? 'Wabah penyakit' : s === '3' ? 'Kecelakaan' : s ? 'Lainnya' : '';
  const sebab = hitung(['Sakit biasa/tua', 'Wabah penyakit', 'Kecelakaan', 'Lainnya'], m => grupSebab(m.sebab));
  const umurValid = mati.map(m => m.umur).filter(u => !isNaN(u));
  const rataUmur = umurValid.length ? Math.round(umurValid.reduce((a, b) => a + b, 0) / umurValid.length) : null;

  // penduduk hidup ≈ jiwa terdata dikurangi warga Merden yang sudah tercatat meninggal (semua tahun)
  const wafatMerden = Object.keys(semuaNik).filter(n => semuaNik[n] !== 'LUAR DESA').length;

  const out = {
    tahun: tahun, tahunIni: thIni, tahunList: Object.keys(th).map(Number).sort((a, b) => b - a),
    diperbarui: Utilities.formatDate(now, CFG.TZ, 'dd-MM-yyyy HH:mm'),
    urlApp: urlApp_(),
    ringkas: {
      suratTahun: suratTahun.length, suratBulan: tahun === thIni ? suratBulan : null,
      kematian: mati.length, rataUmur: rataUmur, totalSurat: rows.length,
    },
    bulanLabel: BULAN_PENDEK, perBulan: perBulan, bulanAktif: tahun === thIni ? now.getMonth() : 11,
    perDusun: perDusun, umur: umur, sebab: sebab,
    jk: { L: mati.filter(m => m.jk === '1').length, P: mati.filter(m => m.jk === '2').length },
    terbaru: rows.slice(-6).reverse().map(r => ({ nomor: r[3], tanggal: r[4] })),
    penduduk: {
      jiwa: pend.jiwa, jiwaHidup: Math.max(0, pend.jiwa - wafatMerden), kk: pend.kk,
      laki: pend.laki, perempuan: pend.perempuan, perDusun: pend.perDusun,
    },
  };
  cache.put(key, JSON.stringify(out), CFG.DASH_CACHE_DETIK);
  return out;
}

/** Statistik penduduk dari DATA_KK (agregat), di-cache 6 jam. Sekaligus melengkapi kolom ringkas log versi lama. */
function statPenduduk_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('pend');
  if (hit) return JSON.parse(hit);
  const d = db_(), n = d.sh.getLastRow() - 1;
  const kol = k => d.head[k] === undefined || n < 1 ? [] : d.sh.getRange(2, d.head[k] + 1, n, 1).getValues().map(r => selTeks_(r[0], k));
  const NIK = kol('NIK'), JK = kol('JK'), DS = kol('DUSUN'), KK = kol('NO_KK'), TL = kol('TGL_LAHIR'), RT = kol('RT'), RW = kol('RW');
  const kk = {}, dz = {};
  let laki = 0, perempuan = 0;
  for (let i = 0; i < n; i++) {
    if (KK[i]) kk[KK[i]] = 1;
    const j = String(JK[i] || '').toUpperCase().charAt(0);
    if (j === 'L') laki++; else if (j === 'P') perempuan++;
    const ds = String(DS[i] || '').toUpperCase() || (DUSUN_RW[parseInt(RW[i], 10)] || 'LAINNYA');
    dz[ds] = (dz[ds] || 0) + 1;
  }
  const perDusun = DUSUN_URUT.map(x => ({ label: judul_(x), n: dz[x] || 0 }));
  Object.keys(dz).filter(x => DUSUN_URUT.indexOf(x) < 0).forEach(x => perDusun.push({ label: judul_(x), n: dz[x] }));

  // lengkapi log lama (tanpa kolom DUSUN..UMUR) memakai DATA_KK
  try {
    const sh = logSheet_(), rows = logRows_();
    const idx = {}; NIK.forEach((v, i) => { if (v) idx[v] = i; });
    rows.forEach((r, k) => {
      if (r[12] || !r[5] || idx[r[5]] === undefined) return;
      const i = idx[r[5]];
      const jk = String(JK[i]).toUpperCase().charAt(0) === 'L' ? '1' : '2';
      const um = hitungUmur_(TL[i], r[7] || new Date());
      sh.getRange(k + 2, 13, 1, 5).setValues([[String(DS[i] || '').toUpperCase(), RT[i], RW[i], jk, um]]);
    });
  } catch (e) { /* tidak fatal */ }

  const out = { jiwa: n, kk: Object.keys(kk).length, laki: laki, perempuan: perempuan, perDusun: perDusun };
  cache.put('pend', JSON.stringify(out), 21600);
  return out;
}

function judul_(s) {
  return String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/* ===================================================== RIWAYAT SURAT (khusus admin) */
/** Daftar ringkas semua surat (terbaru di atas). */
function getRiwayatList(token, tahun) {
  requireAuth_(token);
  const rows = logRows_();
  const th = {};
  rows.forEach(r => { if (/^\d{4}$/.test(r[1])) th[r[1]] = 1; });
  const out = [];
  rows.forEach((r, i) => {
    if (tahun && String(r[1]) !== String(tahun)) return;
    out.push({
      row: i + 2, nomor: r[3], tglSurat: r[4], nik: r[5], nama: r[6], tglMati: r[7], pelapor: r[8],
      dusun: judul_(r[12]), jk: r[15], umur: r[16], petugas: r[10], waktu: r[0],
      catatan: r[18] ? String(r[18]).slice(0, 120) : '', url: r[11],
    });
  });
  return { list: out.reverse(), tahunList: Object.keys(th).sort().reverse() };
}

/** Detail satu surat, termasuk seluruh isian bila tersedia. */
function getRiwayatDetail(token, row) {
  requireAuth_(token);
  const r = barisLog_(row);
  let data = null;
  try { data = r[20] ? JSON.parse(r[20]) : null; } catch (e) { data = null; }
  return {
    row: row, waktu: r[0], nomor: r[3], tglSurat: r[4], nik: r[5], nama: r[6], tglMati: r[7], pelapor: r[8],
    ttd: r[9], petugas: r[10], url: r[11], dusun: judul_(r[12]), rt: r[13], rw: r[14], jk: r[15], umur: r[16],
    sebab: r[17], catatan: r[18], catatanWaktu: r[19], data: data,
  };
}

/** Simpan catatan admin untuk satu surat. Nomor dicek ulang agar tidak salah baris. */
function simpanCatatan(token, row, nomor, teks) {
  const sesi = requireAuth_(token);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Server sibuk, coba lagi.');
  try {
    const r = barisLog_(row);
    if (r[3] !== nomor) throw new Error('Data surat berubah. Muat ulang Riwayat lalu coba lagi.');
    const isi = String(teks || '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
    const waktu = isi ? Utilities.formatDate(new Date(), CFG.TZ, 'dd-MM-yyyy HH:mm') + ' oleh ' + sesi.nama : '';
    logSheet_().getRange(row, 19, 1, 2).setValues([[isi, waktu]]);
    return { catatan: isi, catatanWaktu: waktu };
  } finally {
    lock.releaseLock();
  }
}

function barisLog_(row) {
  row = parseInt(row, 10);
  const sh = logSheet_();
  if (!(row >= 2 && row <= sh.getLastRow())) throw new Error('Surat tidak ditemukan.');
  return sh.getRange(row, 1, 1, LOG_HEAD.length).getDisplayValues()[0];
}

/* ===================================================== MENU BUAT FLYER WA
 * Gambar flyer dibuat dan diunduh langsung di browser (Index.html). Tidak ada arsip ke Drive.
 * Server hanya memberi logo (opsional).
 */

const FLYER = {
  // Opsional: ID file PNG logo Kabupaten Banjarnegara di Drive (latar transparan). Kosongkan = tanpa logo.
  LOGO_ID: '',
};

/** Data awal halaman flyer: logo sebagai data URL (agar canvas tidak "kotor" dan JPG bisa dibuat). */
function getFlyerInit(token) {
  requireAuth_(token);
  let logo = '';
  if (FLYER.LOGO_ID) {
    const cache = CacheService.getScriptCache(), key = 'fl_logo_' + FLYER.LOGO_ID;
    logo = cache.get(key) || '';
    if (!logo) {
      try {
        const b = DriveApp.getFileById(FLYER.LOGO_ID).getBlob();
        logo = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
        if (logo.length < 95000) cache.put(key, logo, 21600);
      } catch (e) {
        logo = '';
      }
    }
  }
  return { logo: logo };
}