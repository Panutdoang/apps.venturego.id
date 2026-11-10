# Rencana VentureGo Mobile — Aplikasi Keuangan Koperasi

> **Status: RANCANGAN untuk didiskusikan.** Belum ada yang diimplementasikan. Dokumen ini
> tidak menggantikan `DOKUMENTASI_ALUR_KERJA.md` (yang tetap menjadi rujukan perilaku app
> saat ini). Developer utama: **Panut**. Disusun 9 November 2026 sebagai bahan keputusan
> bersama tim.

## Prioritas saat ini

Aplikasi keuangan koperasi adalah **rencana jangka panjang** — masih menunggu badan hukum
dan izin. **Fokus sekarang: pencatatan beban siswa yang rapi** di app web yang sudah ada.
Bagian dokumen ini yang relevan untuk pekerjaan sekarang:

- [03 §1](03-LEDGER-SALDO-TAGIHAN.md#1-kenapa-perlu-ledger) — pembayaran bebas yang lunas
  belum mengurangi kewajiban siswa.
- [03 §2–5](03-LEDGER-SALDO-TAGIHAN.md#2-aturan-dasar) — aturan pencatatan (rupiah bulat,
  tidak ada edit/hapus, idempoten) dan urutan alokasi pembayaran ke angsuran.
- [03 §7](03-LEDGER-SALDO-TAGIHAN.md#7-migrasi-dari-kondisi-sekarang) — memasukkan
  portofolio siswa lama supaya semua beban tercatat di satu tempat.
- [04 §7](04-KEAMANAN.md#7-temuan-pada-kode-saat-ini-perlu-dibereskan-di-fase-1) — temuan
  pada kode saat ini.

Bagian lain (mobile, simpanan, penarikan, KYC) disimpan sebagai arah supaya keputusan hari
ini tidak menyulitkan langkah berikutnya.

## Tujuan

Mengembangkan VentureGo dari web pengajuan pembiayaan menjadi **aplikasi Android & iOS**
berbasis **koperasi syariah**, di mana setiap anggota (siswa) memiliki:

- **Saldo** — simpanan anggota (pokok, wajib, sukarela) yang tercatat rapi dan bisa
  dipertanggungjawabkan.
- **Tanggungan** — kewajiban pembiayaan (akad Wakalah bil Ujrah) beserta jadwal angsuran.
- **Pembayaran** — setor/bayar lewat Virtual Account tetap, QRIS, atau potong saldo; status
  diperbarui otomatis.

…dengan keamanan setara aplikasi keuangan.

## Daftar dokumen

| File                                                     | Isi                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [01-PRODUK-DAN-REGULASI.md](01-PRODUK-DAN-REGULASI.md)   | Model koperasi, jenis saldo & tanggungan, batasan hukum & syariah yang wajib dicek |
| [02-ARSITEKTUR.md](02-ARSITEKTUR.md)                     | Arsitektur target: mobile + web + API + data + pembayaran                          |
| [03-LEDGER-SALDO-TAGIHAN.md](03-LEDGER-SALDO-TAGIHAN.md) | Desain buku besar (double-entry), contoh jurnal, aturan alokasi pembayaran         |
| [04-KEAMANAN.md](04-KEAMANAN.md)                         | Model ancaman dan kontrol keamanan berlapis, termasuk temuan pada kode saat ini    |
| [05-ROADMAP.md](05-ROADMAP.md)                           | Fase pengerjaan dari fondasi sampai rilis di Play Store & App Store                |

## Lima keputusan yang perlu diambil lebih dulu

Urutannya sesuai dampak. Tanpa keputusan 1–2, pengembangan fitur saldo sebaiknya ditahan.

1. **Badan hukum.** Saldo anggota hanya boleh dikelola oleh **koperasi** berbadan hukum
   (mis. KSPPS — Koperasi Simpan Pinjam dan Pembiayaan Syariah), bukan oleh PT Vworks
   Kolaborasi Bersama. Perlu konsultan hukum. Lihat 01 §3.
2. **Lingkup layanan.** Hanya untuk anggota (_closed loop_, pengawasan Kemenkop) atau juga
   non-anggota (_open loop_, masuk pengawasan OJK). Rekomendasi: **closed loop**.
3. **Database buku besar.** Rekomendasi: **PostgreSQL** untuk ledger (saldo, tanggungan,
   pembayaran), Firestore tetap untuk data pengajuan/profil. Lihat 02 §4 untuk alasan dan
   alternatifnya.
4. **Teknologi mobile.** Rekomendasi: **React Native + Expo** (satu kode untuk Android &
   iOS, bahasa TypeScript yang sama dengan web). Lihat 02 §3.
5. **Penyimpanan dokumen KYC.** Rekomendasi: pindah dari Google Drive pribadi ke
   **Cloud Storage privat region Jakarta**. Lihat 02 §6 dan 04 §5.

## Prinsip yang tidak boleh ditawar

1. **Uang hanya berubah lewat jurnal.** Tidak ada field `saldo` yang di-update langsung;
   saldo = jumlah entri jurnal. Koreksi = jurnal pembalik, bukan edit/hapus.
2. **Server yang menghitung nominal.** Aplikasi mobile hanya mengirim _niat_ ("bayar
   angsuran ke-3"), tidak pernah nominal final.
3. **Setiap pembayaran idempoten.** Callback Xendit yang sama dikirim dua kali tetap hanya
   tercatat sekali.
4. **Aksi uang keluar memakai dua orang** (_maker-checker_): penarikan, koreksi, pencairan.
5. **Tanpa denda yang menambah pendapatan.** Sesuai akad yang berlaku: total kewajiban
   tidak bertambah karena waktu atau keterlambatan.
6. **Webhook bersama tetap meneruskan `trm-`** ke Turrima (akun Xendit dipakai bersama).
