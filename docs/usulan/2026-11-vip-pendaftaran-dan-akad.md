# Usulan: Pendaftaran Mitra VIP, Kontrak, dan Pembaruan Akad

Status: **rencana dari owner (11 November 2026)**, belum dikerjakan. Yang sudah ada: kartu Saldo VIP
di beranda, halaman `/dashboard/vip`, dan menu admin **Mitra VIP** untuk mencatat data diri sederhana,
setoran, penarikan, bagi hasil, dan dividen (lihat `DOKUMENTASI_ALUR_KERJA.md`).

## 1. Arah dari owner

1. **Pendaftaran VIP dibuat lebih rinci.** Calon mitra mendaftar dari aplikasi, tidak hanya dicatat
   staf.
2. **Kontrak dibuat seperti siswa.** Alurnya sama dengan pembiayaan siswa: pengajuan → verifikasi →
   draft akad → akad final bernomor + PDF → aktif.
3. **Akad diperbarui agar lebih syariah**, sesuai aturan transaksi/muamalah. Pencatatan lama memakai
   label "Akad Wadiah" dengan bagi hasil rutin.

## 2. Pendaftaran mitra (usulan alur)

| Tahap           | Isi                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formulir        | Data diri lengkap (nama sesuai KTP, NIK, TTL, alamat, pekerjaan, sumber dana), kontak, rekening tujuan bagi hasil, rencana nominal & jangka waktu, pernyataan memahami risiko |
| Berkas          | Scan KTP, NPWP (opsional), buku tabungan, swafoto dengan KTP — disimpan di Drive seperti berkas siswa                                                                         |
| Verifikasi staf | Cek identitas & rekening; status `SUBMITTED → REVIEW → APPROVED/REJECTED`                                                                                                     |
| Draft akad      | Staf menyusun akad: nominal, nisbah, jangka waktu, objek pembiayaan (portofolio siswa)                                                                                        |
| Akad final      | Nomor akad + PDF + persetujuan mitra di aplikasi (seperti `Draft Akad` siswa)                                                                                                 |
| Setoran         | Transfer / VA Xendit → baris `DEPOSIT` otomatis di `vipLedger`                                                                                                                |
| Aktif           | Saldo & bagi hasil tampil di kartu VIP; laporan bulanan                                                                                                                       |

Data dari menu admin yang sudah ada (`vipInvestors`) tetap dipakai; pendaftaran baru menambah
koleksi pengajuan mitra dan menautkannya ke `vipInvestors` saat akad final.

## 3. Pembaruan akad (perlu keputusan DPS)

- **Wadiah** adalah titipan. Dalam fikih, penerima titipan tidak boleh menjanjikan imbalan; bonus
  hanya boleh bersifat sukarela dan tidak diperjanjikan. Bagi hasil rutin yang besarnya tetap tidak
  cocok dengan wadiah.
- Pilihan yang umum untuk dana yang disalurkan ke pembiayaan siswa:
  - **Mudharabah** (mitra = shahibul maal, PT = mudharib): keuntungan dibagi menurut **nisbah**
    (persentase dari hasil nyata, bukan persentase dari modal). Kerugian modal ditanggung pemilik
    modal kecuali karena kelalaian pengelola.
  - **Musyarakah**: kedua pihak menyertakan modal; keuntungan sesuai nisbah, kerugian sesuai porsi
    modal.
- Dampak ke aplikasi: bagi hasil dicatat dari **realisasi** pendapatan ujrah/margin portofolio per
  periode × nisbah; tampilan tidak menjanjikan nominal tetap (kartu VIP sudah tidak memproyeksikan
  nominal bagi hasil berikutnya).
- Mitra lama dimigrasikan ke akad baru dengan addendum; riwayat lama tetap di `vipLedger`.

## 4. Kepatuhan

- Menghimpun dana dari masyarakat luas berpotensi memerlukan izin OJK. Selama belum ada kepastian,
  pendaftaran dibatasi untuk mitra yang dikenal dan menandatangani perjanjian; halaman VIP sudah
  menyatakan hal ini.
- Mintakan opini DPS atas skema akad dan formula nisbah sebelum pendaftaran dibuka.
