# 01 — Produk & Regulasi

## 1. Peran pengguna

| Peran | Siapa | Bisa apa |
|---|---|---|
| `calon_anggota` | Siswa yang baru login | Isi pengajuan, unggah berkas, KYC |
| `anggota` | Siswa yang sudah disahkan sebagai anggota koperasi | Lihat saldo & tanggungan, setor, bayar angsuran, ajukan penarikan |
| `staf_cs` | Customer service | Lihat data anggota, verifikasi berkas, tanggapi keringanan |
| `staf_keuangan` | Bagian keuangan | Susun akad & jadwal, *buat* (maker) pencairan/penarikan/koreksi |
| `pengurus` | Ketua/bendahara koperasi | *Setujui* (checker) aksi uang keluar, lihat laporan |
| `pengawas` | Pengawas & Dewan Pengawas Syariah (DPS) | Baca-saja: laporan, audit log |
| `superadmin` | Pemilik sistem | Kelola peran & pengaturan; **tidak** bisa memindahkan uang sendirian |

Peran disimpan sebagai **Firebase custom claims** + tabel peran di server, menggantikan
daftar email `FIREBASE_ADMIN_EMAILS` yang dipakai sekarang.

## 2. Jenis saldo & tanggungan

### Saldo (simpanan anggota)

| Jenis | Sifat | Catatan |
|---|---|---|
| **Simpanan pokok** | Sekali saat jadi anggota, tidak bisa ditarik selama masih anggota | Nominal ditetapkan AD/ART |
| **Simpanan wajib** | Rutin (mis. bulanan), tidak bisa ditarik selama masih anggota | Bisa ditagihkan bersama angsuran |
| **Simpanan sukarela** | Bebas setor & tarik — inilah "saldo" yang tampil besar di app | Akad syariah: *wadiah* (titipan) atau *mudharabah* (bagi hasil) — keputusan DPS |

### Tanggungan

| Jenis | Sumber |
|---|---|
| **Pembiayaan Wakalah bil Ujrah** | Produk yang sudah ada: Dana Keberangkatan & Full Cover (Nafaqah + Ujrah + qardh − refund) |
| **Simpanan wajib yang belum dibayar** | Dari ketentuan keanggotaan |
| Produk baru (nanti) | Mis. talangan tiket, biaya dokumen — tiap produk = akad sendiri |

### Cara bayar tanggungan

1. **Transfer ke VA tetap anggota** (satu nomor per anggota, berlaku selamanya). Dana masuk
   otomatis dialokasikan (lihat 03 §5).
2. **QRIS / Invoice** untuk pembayaran sekali (sudah ada di app).
3. **Potong saldo sukarela** — dengan konfirmasi PIN/biometrik.

## 3. Batasan hukum yang wajib dicek konsultan

> Bagian ini adalah **daftar periksa**, bukan pendapat hukum. Regulasi bisa berubah; semua
> poin harus diverifikasi konsultan hukum koperasi/keuangan sebelum fitur saldo dibuka.

1. **Entitas.** Menghimpun simpanan anggota hanya boleh oleh koperasi berbadan hukum yang
   memiliki izin usaha simpan pinjam (syariah: USPPS). PT tidak boleh menghimpun simpanan.
   Perlu: akta pendirian koperasi, pengesahan Kemenkumham, izin usaha, rekening bank atas
   nama koperasi (terpisah dari rekening PT).
2. **Closed loop vs open loop.** UU No. 4 Tahun 2023 (P2SK) memisahkan koperasi yang hanya
   melayani anggota (pengawasan Kemenkop) dari yang melayani non-anggota (pengawasan OJK).
   Rekomendasi: closed loop — hanya anggota terdaftar yang bisa menyimpan/meminjam.
3. **Bukan uang elektronik.** Saldo yang bisa dipakai membayar pihak ketiga atau
   ditransfer bebas antar-pengguna berisiko dikategorikan uang elektronik (izin Bank
   Indonesia). Rancangan ini **tidak** menyediakan transfer antar-anggota maupun pembayaran
   ke merchant. Saldo hanya bisa: disetor, dipakai bayar tanggungan sendiri, ditarik ke
   rekening sendiri.
4. **Syariah.** Wajib ada Dewan Pengawas Syariah. Akad yang dipakai (Wakalah bil Ujrah,
   wadiah/mudharabah untuk simpanan) perlu mengacu fatwa DSN-MUI terkait. Reward, potongan
   pelunasan dipercepat, dan penanganan keterlambatan harus disetujui DPS.
5. **Data pribadi.** UU No. 27 Tahun 2022 (Pelindungan Data Pribadi): dasar pemrosesan,
   persetujuan, hak akses/hapus, pemberitahuan kebocoran. KTP, KK, dan data keuangan
   termasuk data yang perlu perlindungan ketat.
6. **Toko aplikasi.**
   - **Google Play**: aplikasi pinjaman/pembiayaan di Indonesia punya persyaratan khusus
     (deklarasi layanan keuangan, bukti izin). Cek kebijakan *Financial Services* yang
     berlaku saat pendaftaran — ini bisa menjadi penghambat rilis jika izin belum ada.
   - **Apple App Store**: aplikasi keuangan harus dipublikasikan oleh akun **organisasi**
     (atas nama badan hukum), bukan akun perorangan.
   - Siapkan kebijakan privasi, syarat layanan, dan alur hapus akun (wajib di kedua toko).

## 4. Batas lingkup awal (agar rilis pertama aman)

Masuk rilis pertama: lihat saldo & tanggungan, jadwal angsuran, bayar via VA/QRIS, riwayat,
notifikasi, unggah berkas, profil.

Ditunda sampai izin & kontrol siap: **penarikan saldo ke rekening**, simpanan sukarela
bagi hasil, reward finansial, produk pembiayaan baru.
