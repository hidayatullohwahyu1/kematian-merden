/**
 * CONTOH berkas rekomendasi pelapor & saksi.
 *
 * Berkas asli bernama "Rekomendasi.gs" hanya ada di proyek Apps Script (dan di komputer desa),
 * TIDAK di GitHub, karena berisi NIK warga. Salin isi contoh ini ke berkas skrip baru bernama
 * Rekomendasi di editor Apps Script, lalu ganti NIK dan nama dengan data sebenarnya.
 *
 * - pelapor : direkomendasikan untuk semua surat.
 * - saksi   : dipilih menurut RW tempat tinggal almarhum. RW yang tidak tercantum = tanpa rekomendasi.
 * - tempatMati : pilihan cepat di kolom "Tempat meninggal".
 * Rekomendasi hanya saran: petugas tetap memilih dengan mengetuk tombol "Pakai".
 */
const REKOMENDASI = {
  tempatMati: ['BANJARNEGARA'],
  pelapor: { nik: '3304000000000001', nama: 'NAMA PELAPOR' },
  saksi: [
    { rw: [1],    s1: { nik: '3304000000000011', nama: 'SAKSI I RW 1' },   s2: { nik: '3304000000000012', nama: 'SAKSI II RW 1' } },
    { rw: [3, 4], s1: { nik: '3304000000000031', nama: 'SAKSI I RW 3-4' }, s2: { nik: '3304000000000032', nama: 'SAKSI II RW 3-4' } },
    { rw: [5, 7], s1: { nik: '3304000000000051', nama: 'SAKSI I RW 5-7' }, s2: { nik: '3304000000000052', nama: 'SAKSI II RW 5-7' } },
    { rw: [6],    s1: { nik: '3304000000000061', nama: 'SAKSI I RW 6' },   s2: { nik: '3304000000000062', nama: 'SAKSI II RW 6' } },
  ],
};
