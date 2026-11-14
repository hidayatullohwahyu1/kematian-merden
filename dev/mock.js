/* google.script.run tiruan untuk pratinjau lokal. SEMUA DATA DI SINI FIKTIF. */
(function () {
  var MOCK_PW = 'uji-lokal';
  var TOK = 'tok_' + 'x'.repeat(40);
  var WARGA = [
    { NIK: '3304010101400001', NAMA: 'SUKARDI WIRYO ATMOJO', TEMPAT_LAHIR: 'BANJARNEGARA', TGL_LAHIR: '01-01-1940', JK: 'LAKI-LAKI', AGAMA: 'ISLAM', PEKERJAAN: 'PETANI/PEKEBUN', STATUS_KAWIN: 'KAWIN', RT: '002', RW: '008', DUSUN: 'KARANGKAJEN', NO_KK: '3304010000000001', NAMA_KEPALA: 'SUKARDI WIRYO ATMOJO', HUBUNGAN: 'KEPALA KELUARGA', AYAH: 'KARTO', IBU: 'SAMINAH', ALAMAT: '' },
    { NIK: '3304014505450002', NAMA: 'SUMIATI', TEMPAT_LAHIR: 'BANJARNEGARA', TGL_LAHIR: '05-05-1945', JK: 'PEREMPUAN', AGAMA: 'ISLAM', PEKERJAAN: 'MENGURUS RUMAH TANGGA', RT: '002', RW: '008', DUSUN: 'KARANGKAJEN', NO_KK: '3304010000000001', NAMA_KEPALA: 'SUKARDI WIRYO ATMOJO', HUBUNGAN: 'ISTRI', AYAH: 'DARSO', IBU: 'WARTINI', ALAMAT: '' },
    { NIK: '3304011203700003', NAMA: 'BUDI SANTOSO', TEMPAT_LAHIR: 'BANJARNEGARA', TGL_LAHIR: '12-03-1970', JK: 'LAKI-LAKI', AGAMA: 'ISLAM', PEKERJAAN: 'WIRASWASTA', RT: '002', RW: '008', DUSUN: 'KARANGKAJEN', NO_KK: '3304010000000001', NAMA_KEPALA: 'SUKARDI WIRYO ATMOJO', HUBUNGAN: 'ANAK', AYAH: 'SUKARDI WIRYO ATMOJO', IBU: 'SUMIATI', ALAMAT: '' },
    { NIK: '3304015208750004', NAMA: 'SRI WAHYUNINGSIH', TEMPAT_LAHIR: 'BANJARNEGARA', TGL_LAHIR: '12-08-1975', JK: 'PEREMPUAN', AGAMA: 'ISLAM', PEKERJAAN: 'GURU', RT: '002', RW: '008', DUSUN: 'KARANGKAJEN', NO_KK: '3304010000000001', NAMA_KEPALA: 'SUKARDI WIRYO ATMOJO', HUBUNGAN: 'ANAK', AYAH: 'SUKARDI WIRYO ATMOJO', IBU: 'SUMIATI', ALAMAT: '' },
    { NIK: '3304010707800005', NAMA: 'KARTO', TEMPAT_LAHIR: 'BANJARNEGARA', TGL_LAHIR: '07-07-1910', JK: 'LAKI-LAKI', AGAMA: 'ISLAM', PEKERJAAN: 'PETANI', RT: '001', RW: '001', DUSUN: 'MERDEN TENGAH', NO_KK: '3304010000000009', NAMA_KEPALA: 'KARTO', HUBUNGAN: 'KEPALA KELUARGA', AYAH: '', IBU: '', ALAMAT: '' },
  ];
  var LOG = [
    { row: 2, nomor: '400.12.3.1/ 013 / XI / 2026', tglSurat: '10 November 2026', nik: '3304010000000011', nama: 'MARYATUN BINTI SASTRO WIHARJO', tglMati: '09-11-2026', pelapor: 'SLAMET RIYADI', dusun: 'Rawawungu', jk: '2', umur: '81', petugas: 'ADMIN', waktu: '2026-11-10 09:12:00', catatan: 'Surat sudah diambil keluarga (11-11-2026)', url: 'https://drive.google.com/' },
    { row: 3, nomor: '400.12.3.1/ 014 / XI / 2026', tglSurat: '12 November 2026', nik: '3304010000000012', nama: 'TARNO', tglMati: '12-11-2026', pelapor: 'WAGIMAN', dusun: 'Merden Wetan', jk: '1', umur: '67', petugas: 'ADMIN', waktu: '2026-11-12 13:40:00', catatan: '', url: 'https://drive.google.com/' },
  ];
  var DATA = { J_NAMA: 'TARNO', J_NIK: '3304010000000012', J_JK: '1', J_UMUR: '67', J_TGL_LAHIR: '01-02-1959', J_TEMPAT_LAHIR: 'BANJARNEGARA', J_AGAMA: '1', J_PEKERJAAN: 'PETANI', J_ALAMAT: 'DUSUN MERDEN WETAN', J_RT: '003', J_RW: '004', J_DESA: 'MERDEN', J_KEC: 'PURWANEGARA', J_TGL_MATI: '12-11-2026', J_PUKUL: '04:30', J_TEMPAT_MATI: 'RUMAH', J_SEBAB: '1', J_MENERANGKAN: '4', A_NAMA: 'SAMIN', I_NAMA: 'RASMI', P_NAMA: 'WAGIMAN', P_NIK: '3304010000000099', S1_NAMA: 'SUPRIYADI', S2_NAMA: 'MUJIONO', NO_KK: '3304010000000777', NAMA_KK: 'TARNO', TTD_NAMA: 'SADAR', TTD_JABATAN: 'KEPALA DESA MERDEN', TTD_ATAS_NAMA: '' };

  function cek(t) { if (t !== TOK) throw new Error('SESI_HABIS: Silakan masuk sebagai admin.'); }
  var API = {
    login: function (pw) { if (pw !== MOCK_PW) throw new Error('Password salah. Sisa percobaan: 4.'); return { token: TOK, nama: 'ADMIN' }; },
    logout: function () { return true; },
    cekSesi: function (t) { return { ok: t === TOK, nama: 'ADMIN' }; },
    getInit: function (t) { cek(t); return { penandatangan: [{ nama: 'SADAR', jabatan: 'KEPALA DESA MERDEN', an: '' }, { nama: 'MUCHAMAD AFIFUDIN', jabatan: 'SEKRETARIS DESA', an: 'a.n. KEPALA DESA MERDEN' }], nomorBerikut: '015', hariIni: '2026-11-14', riwayat: LOG.slice().reverse().map(function (r) { return { nomor: r.nomor, nama: r.nama, url: r.url }; }), petugas: 'ADMIN' }; },
    cariWarga: function (t, q) { cek(t); q = String(q).toUpperCase(); return WARGA.filter(function (w) { return w.NAMA.indexOf(q) >= 0 || w.NIK.indexOf(q) >= 0 || w.NO_KK === q; }); },
    anggotaKK: function (t, kk) { cek(t); return WARGA.filter(function (w) { return w.NO_KK === kk; }); },
    cariOrangTua: function (t, nama) { cek(t); return { cocok: WARGA.filter(function (w) { return w.NAMA === String(nama).toUpperCase(); }), lain: [] }; },
    cekSuratNik: function (t) { cek(t); return []; },
    generateSuratKematian: function (t, d) { cek(t); return { nama: 'SKK_015_XI_2026_' + d.J_NAMA.replace(/\s+/g, '_') + '.xlsx', base64: btoa('contoh'), url: 'https://drive.google.com/', nomor: '400.12.3.1/ 015 / XI / 2026', peringatan: ['Contoh peringatan: Saksi I NIK tidak 16 digit'], nomorBerikut: '016', riwayat: [] }; },
    getRiwayatList: function (t) { cek(t); return { list: LOG.slice().reverse(), tahunList: ['2026', '2025'] }; },
    getRiwayatDetail: function (t, row) { cek(t); var r = LOG.filter(function (x) { return x.row === row; })[0]; return Object.assign({}, r, { ttd: 'SADAR', rt: '003', rw: '004', sebab: '1', catatanWaktu: '', data: row === 3 ? DATA : null }); },
    simpanCatatan: function (t, row, nomor, teks) { cek(t); return { catatan: teks, catatanWaktu: '14-11-2026 10:00 oleh ADMIN' }; },
    getFlyerInit: function (t) { cek(t); return { logo: '' }; },
    getDashboard: function (th) {
      return { tahun: 2026, tahunIni: 2026, tahunList: [2026, 2025], diperbarui: '14-11-2026 09:00', urlApp: '',
        ringkas: { suratTahun: 14, suratBulan: 4, kematian: 10, rataUmur: 54, totalSurat: 14 },
        bulanLabel: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], perBulan: [0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 3, 0], bulanAktif: 10,
        perDusun: [{ label: 'Merden Tengah', n: 0 }, { label: 'Merden Wetan', n: 2 }, { label: 'Karangkajen', n: 3 }, { label: 'Rawawungu', n: 3 }, { label: 'Pekunden', n: 2 }],
        umur: [{ label: '0–5', n: 1 }, { label: '6–17', n: 0 }, { label: '18–44', n: 2 }, { label: '45–59', n: 2 }, { label: '60–74', n: 3 }, { label: '75+', n: 2 }],
        sebab: [{ label: 'Sakit biasa/tua', n: 8 }, { label: 'Wabah penyakit', n: 0 }, { label: 'Kecelakaan', n: 1 }, { label: 'Lainnya', n: 1 }],
        jk: { L: 6, P: 4 }, terbaru: LOG.slice().reverse().map(function (r) { return { nomor: r.nomor, tanggal: r.tglSurat }; }),
        penduduk: { jiwa: 12468, jiwaHidup: 12458, kk: 3921, laki: 6250, perempuan: 6218, perDusun: [{ label: 'Merden Tengah', n: 2900 }, { label: 'Merden Wetan', n: 2600 }, { label: 'Karangkajen', n: 2500 }, { label: 'Rawawungu', n: 2400 }, { label: 'Pekunden', n: 2068 }] } };
    },
  };
  function runner(ok, no) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (f) { return runner(f, no); };
      if (k === 'withFailureHandler') return function (f) { return runner(ok, f); };
      return function () { var a = arguments; setTimeout(function () {
        try { var r = API[k].apply(null, a); ok && ok(JSON.parse(JSON.stringify(r))); } catch (e) { no && no(e); }
      }, 250); };
    } });
  }
  window.google = { script: { run: runner(null, null) } };
})();
