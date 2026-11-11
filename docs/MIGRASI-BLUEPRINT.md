# Migrasi dari App VentureGo Lama (Blueprint) ke App Ini

> **Untuk:** Panut dan asisten AI (opencode/Claude). Baca seluruh dokumen ini sebelum menulis
> kode migrasi atau memindahkan domain. **Status (11 Nov 2026): data sudah diimpor ke Firestore produksi — lihat §6a.**
> Disusun 10 November 2026. Bila ada yang berubah, perbarui dokumen ini di commit yang sama.

## 0. Ringkasan

`apps.venturego.id` saat ini masih menjalankan **app lama ("blueprint")**: repo
`AdamDoni/VentureGo`, Next.js + Prisma + PostgreSQL (Neon) + Auth.js, deploy Vercel
`https://venture-go.vercel.app`. App ini (Firebase/Firestore) akan menggantikannya.

Migrasi dibagi dua bagian yang **terpisah dan berurutan**:

1. **Pindah domain** (bagian 2) — bisa dilakukan lebih dulu. Data lama tetap di blueprint,
   callback pembayarannya diteruskan.
2. **Pindah data** (bagian 3–6) — kontrak & pembayaran lama dimasukkan ke Firestore. Setelah
   selesai dan dicocokkan keuangan, penerusan `vsv-` boleh dimatikan dan blueprint dipensiunkan.

## 1. Aturan yang tidak boleh dilanggar

1. **JANGAN menghapus** project Vercel, database Neon, atau folder Drive milik blueprint sampai
   bagian 7 (pensiun) disetujui tertulis oleh pemilik.
2. **JANGAN menulis ke database blueprint.** Migrasi hanya membaca dari sana.
3. **JANGAN menghapus penerusan webhook** `trm-` (Turrima) dan `vsv-` (blueprint) di
   `src/app/api/webhooks/xendit/route.ts`. Tanpanya callback dijawab 200 lalu hilang dan Xendit
   tidak mengirim ulang. Lihat `XENDIT_SETUP.md` §6.
4. **`XENDIT_CALLBACK_TOKEN` harus sama** di semua app yang berbagi akun Xendit (blueprint,
   Turrima, app ini).
5. Script migrasi **default dry-run**, **idempoten** (dijalankan ulang tidak menggandakan data),
   dan menulis ke Firestore hanya dengan flag `--commit`.
6. Menulis banyak dokumen = perubahan bentuk data massal → **wajib konfirmasi pemilik** sesuai
   §Schema Safety di `AGENTS.md`, dengan hasil dry-run terlampir.
7. Data hasil ekspor berisi data pribadi (nama, NIK, HP, email). **Simpan di luar repo**, jangan
   di-commit, hapus setelah migrasi selesai.
8. Jangan mengubah label akad kontrak lama menjadi Wakalah bil Ujrah (lihat §5 no. 1).

## 2. Pindah domain `apps.venturego.id`

Prasyarat (sudah ada di branch `fitur/desain-login-webhook`): penerusan `trm-` dan `vsv-`,
login Google via Google Identity Services.

Urutan:

1. **Gabungkan** branch ke `main` dan pastikan deploy production app ini sukses.
2. **Environment Variables** di project Vercel app ini (Production):
   - `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN` — nilai **sama** dengan project blueprint.
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Web client ID project `app-venturego-id`.
   - opsional `TURRIMA_WEBHOOK_URL`, `LEGACY_VSV_WEBHOOK_URL` (default sudah benar).
   - Deploy ulang setelah env diisi.
3. **Google Cloud → Clients → Authorized JavaScript origins**: `https://apps.venturego.id`
   (wajib `https://`).
4. **Vercel project blueprint** → Settings → Domains → hapus **hanya** `apps.venturego.id`.
   `venture-go.vercel.app` tetap aktif.
5. **Vercel project app ini** → Settings → Domains → tambah `apps.venturego.id`.
6. **Verifikasi** (semua harus lolos):
   - `https://apps.venturego.id` menampilkan halaman awal app ini (hero biru + orbit).
   - `GET https://apps.venturego.id/api/webhooks/xendit` → `405` dengan JSON
     `Metode tidak diizinkan.` (blueprint menjawab 405 tanpa isi).
   - `GET https://turrima.integratedfarming.id/api/xendit/callback` → `{"ok":true,…}`.
   - Login Google di `https://apps.venturego.id` berhasil.
   - Satu pembayaran VA Turrima (nominal kecil) tercatat lunas di Turrima.
7. **Rollback** bila ada masalah: pindahkan lagi domain ke project blueprint (langkah 4–5
   dibalik). DNS tidak berubah, jadi pemulihannya hitungan menit.

Dashboard Xendit **tidak perlu diubah**: URL webhook tetap
`https://apps.venturego.id/api/webhooks/xendit`.

## 3. Data di blueprint (per 10 November 2026)

| Data                                  | Jumlah / catatan                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Kontrak (`FinancingContract`)         | 36 total, **22 `ACTIVE`**                                                                                              |
| Kontrak dengan VA Xendit asli         | 35 (`external_id` = `vsv-{borrowerId}`; sebagian dulu `LEGACY-…` lalu diterbitkan ulang lewat `scripts/reissue-va.ts`) |
| Pembayaran lewat VA, 90 hari terakhir | 2 (terakhir 9 Oktober 2026)                                                                                            |
| Sumber awal data                      | Diimpor dari spreadsheet `Keuangan-PT-VKB-15-07-2026.xlsx` (tab Asset + Mutasi) oleh `scripts/import-legacy.ts`        |

Model Prisma yang relevan (`prisma/schema.prisma` di repo blueprint):

- `User` — `email` (unik; sebagian siswa memakai akun generik `username` seperti
  `SISWAJPN01` dengan email bukan milik siswa), `name`, `phone`.
- `BorrowerProfile` — `fullName`, `nik`, `destination` (`Japan`/`Turkey`), `lpkName`,
  `driveFolderId`.
- `FinancingContract` — `contractNo` (unik), `scheme` (`MURABAHAH`/`WADIAH`/`OTHER`; PDF akad
  yang dihasilkan berjudul **Ijarah + Qardh Hasan**), `principalIdr`, `totalIdr`,
  `tenorMonths`, `startDate`, `status` (`ACTIVE`/`COMPLETED`/`RESTRUCTURED`/`DEFAULT`),
  `vaNumber`, `vaBank`, `documentUrl`.
- `Installment` — `seq`, `dueDate`, `amountIdr`, `paidIdr`, `status`
  (`UPCOMING`/`DUE`/`PAID`/`PARTIAL`/`LATE`), `paidAt`.
- `Payment` + `PaymentAllocation` — uang masuk (`amountIdr`, `xenditEventId` unik,
  `vaNumber`, `receivedAt`, `rawPayload`) dan alokasinya ke angsuran.
- `BridgingFundApplication` — pendaftaran online lewat blueprint (`status` `PENDING` dll.).

## 4. Pemetaan ke Firestore

ID dokumen dibuat **deterministik** supaya idempoten: `legacy-{contractId}`.

### `applications/legacy-{contractId}`

| Field app ini                                                            | Diisi dari                                                                                                                                                          | Catatan                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `applicationId`                                                          | `VSV-LGC-{contractNo}`                                                                                                                                              | Bedakan dari `VSV-APP-…`                                                                |
| `ownerFirebaseUid`                                                       | `null`                                                                                                                                                              | Diisi saat klaim akun (§5 no. 2)                                                        |
| `legacy` (baru)                                                          | `{ source: 'blueprint', contractId, contractNo, borrowerId, userId, scheme, contractStatus, vaNumber, vaBank, driveFolderId, documentUrl, ownerEmail, migratedAt }` | Jejak asal; jangan dihapus                                                              |
| `product`                                                                | `DEPARTURE_BRIDGING`                                                                                                                                                | Semua kontrak lama adalah dana talangan keberangkatan — **konfirmasi**                  |
| `contractScheme`                                                         | `LEGACY_{scheme}`                                                                                                                                                   | **Bukan** Wakalah bil Ujrah                                                             |
| `applicantName`                                                          | `BorrowerProfile.fullName`                                                                                                                                          |                                                                                         |
| `phone`                                                                  | `User.phone`                                                                                                                                                        |                                                                                         |
| `lpkName`                                                                | `BorrowerProfile.lpkName`                                                                                                                                           |                                                                                         |
| `destination`                                                            | `Japan` → `JAPAN`, `Turkey` → `TURKEY`                                                                                                                              |                                                                                         |
| `status`                                                                 | `ACTIVE`→`ACTIVE`, `COMPLETED`→`COMPLETED`, `RESTRUCTURED`/`DEFAULT`→`ACTIVE`                                                                                       | Status asli tetap di `legacy.contractStatus`; tambahkan `internalNotes`                 |
| `financialPlan.pricingStatus`                                            | `AGREED`                                                                                                                                                            | Akad sudah berjalan                                                                     |
| `financialPlan.totalObligation`                                          | `totalIdr`                                                                                                                                                          |                                                                                         |
| `financialPlan.schedule[]`                                               | `Installment` → `{ installment: seq, dueDate: 'YYYY-MM-DD', amount: amountIdr, remainingBalance }`                                                                  | Urut `seq`                                                                              |
| `paidInstallments`                                                       | `seq` yang `status = PAID`                                                                                                                                          |                                                                                         |
| `paidAmount` (baru, lihat `docs/usulan/2026-11-pembayaran-fleksibel.md`) | Σ `Payment.amountIdr` yang teralokasi ke kontrak                                                                                                                    | Menangkap pembayaran `PARTIAL`                                                          |
| `personalDetails`                                                        | `nik` (bila kebijakan menyimpan), alamat dari `BridgingFundApplication` bila ada                                                                                    | Minimal; jangan menebak                                                                 |
| `documents`                                                              | `[]`                                                                                                                                                                | Berkas lama tetap di folder Drive blueprint (`legacy.driveFolderId`), **tidak disalin** |
| `understandsWakalah`, `acceptsDataProcessing`                            | `false`                                                                                                                                                             | Persetujuan lama tidak tercatat di app ini                                              |
| `createdAt`                                                              | `FinancingContract.createdAt`                                                                                                                                       |                                                                                         |

### `payments/legacy-{paymentId}`

`{ applicationDocId: 'legacy-{contractId}', type: 'LEGACY', amount, status: 'PAID', paidAt:
receivedAt, paidMethod: 'VIRTUAL_ACCOUNT', paidChannel: vaBank, externalId: xenditEventId,
ownerFirebaseUid: null, description: 'Pembayaran app lama', createdAt: receivedAt }`.
Pembayaran tunai/transfer manual dari spreadsheet (tanpa `xenditEventId` asli) diberi
`paidMethod: 'MANUAL_LEGACY'`.

> Kode yang membaca `payments` saat ini memetakan tipe selain `CUSTOM` menjadi `INSTALLMENT`
> (`readPaymentRecord`). Tambahkan dukungan `type: 'LEGACY'` di riwayat siswa & admin sebelum
> data diimpor.

## 5. Keputusan yang harus diambil sebelum impor

| #   | Pertanyaan                                                 | Usulan                                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Label akad kontrak lama (Ijarah + Qardh Hasan / Murabahah) | Simpan apa adanya (`LEGACY_*`), tampilkan "Akad lama" di UI; konsultasi DPS bila ingin dialihkan                                                                                                                                                                                                                                            |
| 2   | Menghubungkan kontrak ke akun siswa                        | **Klaim otomatis**: saat siswa login Google, server mencari `applications` dengan `ownerFirebaseUid == null` dan `legacy.ownerEmail == email Google terverifikasi`, lalu mengisi `ownerFirebaseUid` dalam transaksi. Siswa berakun generik/email tidak cocok → admin menghubungkan manual dari panel admin (fitur baru "Hubungkan ke akun") |
| 3   | NIS untuk siswa lama                                       | Terbitkan saat klaim (siswa sudah `ACTIVE`), lewat `issueStudentNumber` yang sama                                                                                                                                                                                                                                                           |
| 4   | Pendaftaran `BridgingFundApplication` yang belum di-ACC    | Impor sebagai `SUBMITTED` atau minta daftar ulang lewat formulir baru                                                                                                                                                                                                                                                                       |
| 5   | Kontrak `RESTRUCTURED` / `DEFAULT`                         | Impor `ACTIVE` + catatan; jadwal mengikuti data terakhir                                                                                                                                                                                                                                                                                    |
| 6   | Penyimpanan NIK                                            | Hanya bila diperlukan; ikuti Kebijakan Privasi                                                                                                                                                                                                                                                                                              |

## 6. Langkah migrasi data

1. **Ekspor (repo blueprint, baca saja).** Script `scripts/export-for-firestore.ts` (baru) membaca
   Prisma dan menulis satu file JSON ke luar repo, mis. `D:/VWorks/migrasi/blueprint-export.json`.
   Tidak ada `create/update/delete` di script ini.
2. **Dukungan kode di app ini** (PR terpisah, dengan test):
   - tipe pembayaran `LEGACY` di riwayat siswa & admin;
   - field `legacy` dan label "Akad lama" di admin & dashboard;
   - klaim akun otomatis + tombol admin "Hubungkan ke akun" (§5 no. 2);
   - **penanganan langsung callback `vsv-`**: cari `applications` dengan
     `legacy.vaNumber == account_number`, catat ke `payments` + `paidAmount` (idempoten via
     `payment_id`/`id` Xendit). Selama belum siap, callback tetap diteruskan ke blueprint.
3. **Impor dry-run.** `node --env-file=.env.local scripts/import-blueprint.mjs <file.json>`
   mencetak tabel: kontrak, nama, total, terbayar, sisa, jumlah angsuran lunas, VA — tanpa menulis.
4. **Cocokkan** total piutang & total terbayar hasil dry-run dengan rekap keuangan manual; minta
   persetujuan pemilik (bagian 1 no. 6).
5. **Impor sungguhan** dengan `--commit`. Idempoten: dokumen `legacy-*` yang sudah ada dilewati
   kecuali `--update`.
6. **Hentikan sementara penerimaan pembayaran di blueprint** pada saat yang sama penerusan
   `vsv-` di app ini diganti penanganan langsung (langkah 2): ubah `vsv-` di `FORWARD_ROUTES`
   menjadi handler lokal, deploy, lalu uji satu pembayaran VA lama nominal kecil.
7. **Selisih pasca-impor**: pembayaran yang masuk ke blueprint antara ekspor dan langkah 6 diimpor
   ulang (jalankan ekspor + impor lagi; idempoten).
8. Perbarui `DOKUMENTASI_ALUR_KERJA.md` (Data Firestore, Pembayaran, Caveats) dan dokumen ini.

## 6a. Yang sudah dijalankan (11 November 2026)

Acuan angka = laporan keuangan Excel (tab Mutasi + Asset) + koreksi owner, **bukan** database app
lama. Semua data pribadi (Excel, JSON, hasil unduh Drive, `konfigurasi-migrasi.json`) disimpan di
folder data di luar repo.

| Langkah      | Skrip                                                                         | Hasil                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1. Ekspor    | repo blueprint `scripts/export-for-firestore.ts <laporan.xlsx> <folder-data>` | JSON 40 pembiayaan: 36 kontrak app lama + 4 yang hanya ada di Excel (`legacy-xl-*`)                                              |
| 2. Impor     | `scripts/import-legacy-siswa.mjs <json> [--commit] [--update] [--rollback]`   | `applications/legacy-*` + `payments/legacy-*` (`type: 'LEGACY'`, `paidMethod: 'MANUAL_LEGACY'`)                                  |
| 3. Berkas    | `scripts/legacy-upload-berkas.mjs <folder-data> [--commit]`                   | Unduhan folder Drive lama disalin ke Drive app (`LGC - <Nama> - <kode>`), `documents` diisi (`VERIFIED`), `driveFolderId` terisi |
| 4. Data diri | `scripts/legacy-isi-data-diri.mjs <data-diri.json> [--commit]`                | `personalDetails` (NIK, lahir, alamat, ibu kandung, kontak darurat, paspor), `departureDetails.employment`                       |

Aturan penyusunan jadwal (langkah 1):

- Tanggal bayar = tanggal di Mutasi (dibaca dari nomor seri Excel, bukan `cellDates`, agar tidak mundur sehari).
- Jadwal **dibangun ulang**: total kewajiban Excel, tenor 12 atau 6 bulan bila cicilannya bulat ribuan
  (dipilih yang cocok dengan nominal bayar terbanyak), jatuh tempo pertama = tanggal bayar pertama di Mutasi,
  berikutnya tiap bulan. Siswa yang belum pernah bayar: pencairan + 1 bulan.
- `paidInstallments` = alokasi FIFO uang masuk; status `COMPLETED` bila lunas atau dinyatakan lunas owner.
- Data diri dibaca manual dari formulir pendaftaran, KTP, paspor, dan jawaban Google Form; catatan
  ketidakcocokan ada di `legacy.dataNotes`, nama di app lama di `legacy.nameInOldApp`.

Belum: klaim akun siswa (`ownerFirebaseUid` masih `null`), penanganan langsung callback `vsv-`,
label "Akad lama" di admin, siswa tujuan Turki (berkas belum diunduh).

## 6b. Mitra VIP (11 November 2026)

Mitra VIP (Vworks Investment Partner) tidak ada di database blueprint — sumbernya tab **Mutasi**
laporan keuangan Excel. Skrip `scripts/import-vip-lama.mjs`:

```bash
NODE_PATH=<node_modules berisi xlsx> node --env-file=.env.local scripts/import-vip-lama.mjs "<folder-data>/<laporan>.xlsx" [--commit] [--rollback]
```

- Nama, pola pencocokan, dan email login mitra ada di `<folder-data>/konfigurasi-migrasi.json` →
  `vip.investor[]`; baris uji coba dikecualikan lewat `vip.abaikan[]`. **Jangan** masukkan ke repo.
- Kategori: `Investasi` → `DEPOSIT`, `Penarikan Investasi` → `WITHDRAWAL`,
  `Bagi Hasil Investasi` → `PROFIT_SHARE` (atau `DIVIDEND` bila "Deviden").
- Saldo = setoran − penarikan; hasilnya cocok dengan catatan "Sisa …" di Excel per Okt 2026
  (3 mitra aktif, 90 baris ledger). Pencatatan berikutnya lewat `/admin` → Mitra VIP. Bila skrip dijalankan ulang, baris ledger yang sudah ada dilewati dan data diri yang diubah staf tidak ditimpa (`--profil` untuk memaksa nama/email dari konfigurasi).
- Tidak diimpor: investasi akad murabahah lama yang sudah selesai, dan setoran modal perusahaan.

## 7. Pensiun blueprint

Hanya setelah: semua kontrak tercocokkan, callback `vsv-` ditangani langsung minimal 1 siklus
tagihan bulanan tanpa selisih, dan pemilik menyetujui tertulis.

1. Ekspor penuh database Neon (backup `pg_dump`) dan simpan di penyimpanan aman milik
   perusahaan.
2. Hapus `vsv-` dari `FORWARD_ROUTES` **hanya** bila handler lokal sudah menggantikannya.
3. Matikan project Vercel blueprint; arsipkan repo `AdamDoni/VentureGo` (jangan hapus).
4. Database Neon dihapus paling cepat setelah masa simpan yang diwajibkan kebijakan
   pencatatan keuangan.

## 8. Rujukan

- Penerusan webhook: `src/app/api/webhooks/xendit/route.ts`, `XENDIT_SETUP.md` §6.
- Pembayaran fleksibel & `paidAmount`: `docs/usulan/2026-11-pembayaran-fleksibel.md`.
- Arah jangka panjang (ledger): `docs/rencana-mobile/03-LEDGER-SALDO-TAGIHAN.md` §7.
- Blueprint: `scripts/import-legacy.ts`, `scripts/reissue-va.ts`,
  `src/modules/financing/{schedule,matching}.ts` (logika alokasi FIFO + test).
