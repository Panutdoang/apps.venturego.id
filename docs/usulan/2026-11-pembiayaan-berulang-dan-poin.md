# Usulan: Pembiayaan Berulang, Poin Saldo, dan Salin Nomor VA

> Status: **usulan** dari Adam (11 November 2026), belum diimplementasikan. Panut yang memutuskan
> desain teknis akhirnya. Terkait: `docs/usulan/2026-11-pembayaran-fleksibel.md` (alokasi
> pembayaran, `paidAmount`) dan `docs/MIGRASI-BLUEPRINT.md` (data siswa lama). Dokumen ini sengaja
> **tidak memuat nama atau angka siswa**; data per siswa disimpan di luar repo.

## 1. Pembiayaan berulang — satu siswa, beberapa pembiayaan

### Aturan bisnis (dari owner)

- Siswa yang **sudah melunasi** pembiayaannya boleh **mengajukan pembiayaan lagi**.
- Kasus nyata di data lama (VentureGo versi sebelumnya):
  - Siswa melunasi Dana Keberangkatan, lalu mengajukan **pembiayaan usaha** setelah bekerja di
    luar negeri (dua siswa).
  - Siswa punya pembiayaan utama, lalu tambahan **dana darurat** kecil dengan tenor pendek (satu
    siswa).
- Setiap pembiayaan punya akad, rincian biaya, jadwal angsuran, dan status lunas **sendiri-sendiri**.
  Pembayaran satu pembiayaan tidak boleh tercampur ke pembiayaan lain.

### Kondisi kode sekarang (main `e0abf37`)

- Model data **sudah memungkinkan**: `applications` di-query dengan
  `where('ownerFirebaseUid', '==', uid)` dan hasilnya berupa daftar.
- NIS terbit **satu kali per Firebase UID** (`ensureStudentNumber`) — tepat: pembiayaan kedua
  memakai **NIS yang sama**, tidak menerbitkan NIS baru.
- Yang perlu dicek/ditambah ada di bawah.

### Yang perlu ditambahkan

1. **Aturan boleh mengajukan lagi** (server, di action pengajuan baru):
   - Tolak bila masih ada pengajuan yang belum selesai (status selain lunas/dibatalkan/ditolak).
   - Usul: boleh mengajukan lagi bila semua pembiayaan sebelumnya **lunas** (termasuk lunas dengan
     potongan pelunasan). Pengecualian (mis. dana darurat saat pembiayaan utama masih berjalan)
     hanya lewat admin.
2. **Produk baru** di luar `FULL_COVER` dan `DEPARTURE_BRIDGING`:
   - `BUSINESS` — Pembiayaan Usaha (untuk alumni yang sudah bekerja).
   - `EMERGENCY` — Dana Darurat (nominal kecil, tenor pendek).
   - Masing-masing butuh daftar dokumen (`src/lib/documents.ts`), template akad
     (`src/lib/akad-templates/`), dan label. Skema akadnya diputuskan bersama DPS.
3. **Dashboard siswa**:
   - Kartu utama menampilkan pembiayaan yang **sedang berjalan** (bila ada lebih dari satu yang
     aktif, tampilkan yang jatuh temponya paling dekat + penanda "2 pembiayaan aktif").
   - Pembiayaan yang sudah **lunas** masuk daftar **Riwayat Pembiayaan** (mis. di Profil), bisa
     dibuka untuk melihat akad dan riwayat bayarnya.
   - Tombol "Ajukan Pembiayaan Baru" hanya aktif bila aturan nomor 1 terpenuhi; bila tidak,
     tampilkan alasannya.
4. **Pembayaran**: setiap invoice/VA dan setiap `payments` wajib membawa `applicationDocId`
   supaya uang masuk ke pembiayaan yang benar.
5. **Admin**: daftar pengajuan menampilkan penanda "pembiayaan ke-N" dan tautan ke pembiayaan
   sebelumnya siswa yang sama (riwayat lunas = bahan penilaian).
6. **Potongan pelunasan dipercepat**: pernah diberikan di data lama. Admin perlu bisa mencatatnya
   sebagai baris tersendiri (jenis `SETTLEMENT_DISCOUNT`, alasan wajib, tercatat di audit) sehingga
   pembiayaan berstatus lunas walau uang masuk lebih kecil dari total kewajiban. Pemberiannya
   mengikuti ketentuan DPS.

### Migrasi data lama

Saat impor (lihat `docs/MIGRASI-BLUEPRINT.md`), satu siswa lama bisa menghasilkan **beberapa**
dokumen `applications/legacy-{contractId}` dengan `ownerFirebaseUid` yang sama setelah akun
diklaim. Acuan angka untuk migrasi adalah **laporan keuangan (Excel) yang sudah diverifikasi tim**,
bukan database app lama (app lama berhenti mencatat sejak Juli 2026).

## 2. Poin Saldo (kelebihan bayar) — disetujui owner

### Aturan bisnis

- Bila siswa membayar **lebih** dari sisa kewajibannya, kelebihannya menjadi **saldo siswa**.
- Di aplikasi disebut **Poin**, bukan "saldo"/"uang", untuk menghindari kesan produk simpanan atau
  uang elektronik. **1 poin = Rp1.**
- Poin melekat ke **siswa** (UID), bukan ke satu pembiayaan, supaya bisa dipakai di pembiayaan
  berikutnya.
- Cashback pelunasan dipercepat yang lalu **sudah dibayarkan semua** (tercatat di laporan
  keuangan), jadi tidak dimigrasi sebagai poin. Yang dimigrasi hanya **kelebihan bayar** (ada dua
  siswa lama dengan nominal kecil).

### Usulan data

- Koleksi baru `pointLedger/{autoId}` — **buku besar**, tidak pernah di-update/hapus:
  `{ ownerFirebaseUid, applicationDocId?, type: 'OVERPAYMENT' | 'REDEEM' | 'ADJUSTMENT' | 'LEGACY', amount, paymentId?, note, createdAt, createdBy }`
  (`amount` integer rupiah, positif = masuk, negatif = dipakai).
- Saldo = jumlah `amount`. Simpan cache `pointsBalance` di dokumen profil siswa, diperbarui **dalam
  transaksi yang sama** dengan penulisan ledger (Admin SDK; Firestore tetap deny-all).
- Webhook Xendit: setelah alokasi ke angsuran (`allocatePaid`, lihat usulan pembayaran fleksibel),
  sisa yang tidak teralokasi → satu baris `OVERPAYMENT`. **Idempoten per `paymentId`**.
- Koreksi manual admin → `ADJUSTMENT` dengan alasan wajib + audit.

### Batasan (penting secara regulasi)

- Poin **hanya dipakai** untuk membayar angsuran atau pembiayaan berikutnya (`REDEEM`).
- **Tidak ada fitur tarik/cairkan poin.** Bila suatu saat harus dikembalikan (siswa tidak
  mengajukan lagi), lakukan sebagai **refund kelebihan bayar** per kasus oleh admin. Saldo yang bisa
  ditarik tunai mendekati uang elektronik/simpanan (izin BI/OJK). Konsultasikan dengan DPS/penasihat
  hukum sebelum menambah fungsi lain.

### Tampilan (dashboard, kartu putih paling atas)

- Kartu "Total angsuran terbayar" bisa **digeser kiri/kanan**, 2 halaman:
  1. **Total angsuran terbayar** (seperti sekarang).
  2. **Poin VentureGo** — jumlah poin + keterangan singkat "1 poin = Rp1, bisa dipakai untuk
     membayar angsuran".
- Implementasi ringan: CSS `scroll-snap-type: x mandatory` + `overflow-x: auto`, tanpa library;
  indikator 2 titik di bawah kartu yang juga bisa diketuk. Tombol mata (sembunyikan nominal)
  berlaku untuk kedua halaman.
- Ikuti `docs/DESAIN.md` (token warna, hormati `prefers-reduced-motion`).

## 3. Nomor Virtual Account mudah disalin

### Kondisi sekarang

App ini **belum punya nomor VA tetap per siswa** — pembayaran lewat halaman invoice Xendit. Angka
`0000000000000000` di kartu dashboard hanya placeholder saat belum ada pengajuan.

### Usulan

- Bila memakai **Fixed VA per siswa** (seperti app lama dan Turrima):
  - `external_id` **jangan berawalan `vsv-` atau `trm-`** — keduanya diteruskan ke app lain oleh
    `FORWARD_ROUTES` di `src/app/api/webhooks/xendit/route.ts`. Pakai awalan baru, mis.
    `vsg-{uid}`.
  - Siswa lama sudah punya VA aktif `vsv-{contractId}`. Saat migrasi putuskan: VA lama tetap
    dipakai (forwarding `vsv-` diganti handler sendiri) atau terbitkan VA baru dan umumkan ke siswa.
  - Satu VA per siswa melayani beberapa pembiayaan → alokasi ke pembiayaan aktif yang jatuh
    temponya paling dekat; kelebihan → poin.
- UI baris "Virtual Account":
  - **Tekan lama** (± 500 ms) pada angka → salin ke clipboard.
  - **Tombol salin** (ikon) di **ujung kanan** baris.
  - Setelah disalin tampilkan teks singkat "Nomor VA disalin". Pakai
    `navigator.clipboard.writeText` dengan fallback `document.execCommand('copy')`.
  - Tampilkan nama bank di label, mis. "Virtual Account · BRI".

## 4. Urutan pengerjaan yang disarankan

1. Pembayaran fleksibel (`paidAmount` + `allocatePaid`) — dasar untuk poin.
2. Pembiayaan berulang (aturan pengajuan + riwayat di dashboard).
3. Poin (ledger + webhook + kartu geser).
4. Fixed VA per siswa + salin nomor VA.
5. Migrasi data lama (setelah data diverifikasi tim).
