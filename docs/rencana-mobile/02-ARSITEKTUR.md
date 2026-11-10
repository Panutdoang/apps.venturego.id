# 02 — Arsitektur Target

## 1. Gambaran besar

```
 ┌──────────────┐  ┌──────────────┐  ┌───────────────┐
 │ App Android  │  │   App iOS    │  │ Web (Next.js) │  ← web anggota + panel admin
 │ (Expo / RN)  │  │ (Expo / RN)  │  │ yang sudah ada│
 └──────┬───────┘  └──────┬───────┘  └──────┬────────┘
        │  HTTPS + Firebase ID token + App Check token
        └─────────────────┼─────────────────┘
                 ┌────────▼─────────┐
                 │  API /api/v1/*   │  Next.js route handlers (Vercel)
                 │  + Server Actions│  keduanya memanggil lapisan yang sama ↓
                 ├──────────────────┤
                 │  src/server/     │  Domain services: anggota, pembiayaan,
                 │  (logika bisnis) │  ledger, pembayaran, notifikasi, audit
                 └──┬─────┬──────┬──┘
        ┌───────────┘     │      └───────────────┐
 ┌──────▼──────┐  ┌───────▼───────┐  ┌───────────▼──────────┐
 │ Firestore   │  │ PostgreSQL    │  │ Cloud Storage privat │
 │ pengajuan,  │  │ LEDGER: akun, │  │ KTP/KK/akad (region  │
 │ profil,     │  │ jurnal, saldo,│  │ Jakarta), URL bertanda│
 │ berkas meta │  │ tagihan, bayar│  │ tangan berumur pendek │
 └─────────────┘  └───────▲───────┘  └──────────────────────┘
                          │
             ┌────────────┴────────────┐
             │ Webhook gateway Xendit  │ ← FVA, Invoice, QRIS, Payouts
             │ /api/webhooks/xendit    │ → teruskan `trm-` ke Turrima
             └─────────────────────────┘
 Pendukung: Firebase Auth · FCM (push) · WA gateway · Sentry · Cron (Vercel/Cloud Scheduler)
```

## 2. Perubahan terpenting dari kondisi sekarang: tambah lapisan API

Saat ini halaman dashboard memanggil **Server Actions** (`dashboard/*/actions.ts`).
Aplikasi mobile **tidak bisa** memanggil Server Actions. Jadi:

1. Pindahkan logika dari `actions.ts` ke **`src/server/<domain>/`** (fungsi biasa yang
   menerima `uid` terverifikasi + input tervalidasi).
2. Server Actions yang ada tinggal membungkus fungsi itu → web tetap jalan seperti sekarang.
3. Tambah **REST `/api/v1/*`** yang membungkus fungsi yang sama untuk mobile.
4. Kontrak API ditulis dengan **Zod** di `src/server/contracts/` dan dibagikan ke mobile
   (tipe TypeScript sama persis di dua sisi).

Contoh endpoint awal:

| Method | Path                              | Fungsi                                               |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/api/v1/me`                      | Profil, status keanggotaan, NIS                      |
| GET    | `/api/v1/saldo`                   | Ringkasan simpanan per jenis                         |
| GET    | `/api/v1/tanggungan`              | Daftar akad + sisa + jadwal                          |
| GET    | `/api/v1/mutasi?cursor=`          | Riwayat transaksi (paginasi cursor)                  |
| POST   | `/api/v1/pembayaran/angsuran`     | Niat bayar angsuran (header `Idempotency-Key`)       |
| POST   | `/api/v1/pembayaran/potong-saldo` | Bayar dari saldo (butuh token step-up PIN/biometrik) |
| GET    | `/api/v1/va`                      | Nomor VA tetap anggota + cara bayar per bank         |
| POST   | `/api/v1/berkas/unggah`           | Unggah berkas (mengganti `/api/applicant/uploads`)   |
| POST   | `/api/v1/perangkat`               | Daftarkan perangkat + token push                     |

Versi `v1` di path supaya app lama di HP pengguna tidak rusak saat API berubah.

## 3. Aplikasi mobile

**Rekomendasi: React Native + Expo** (Android & iOS satu kode).

| Pilihan                    | Kelebihan                                                                                               | Kekurangan                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Expo / React Native** ✅ | TypeScript & React sama dengan web; bisa berbagi tipe & validasi; EAS Build untuk build tanpa Mac lokal | Perlu belajar pola mobile (navigasi, storage)                                               |
| Flutter                    | Performa & UI konsisten                                                                                 | Bahasa Dart, tidak bisa berbagi kode dengan web                                             |
| Capacitor (bungkus web)    | Paling cepat                                                                                            | Rasa "web di dalam app", sulit lolos review untuk app keuangan, keamanan perangkat terbatas |

Struktur repo yang disarankan (monorepo pnpm, karena repo sudah memakai pnpm):

```
apps/web        ← isi repo sekarang (Next.js)
apps/mobile     ← Expo
packages/contracts  ← skema Zod + tipe API (dipakai web & mobile)
packages/money      ← format Rupiah, aturan angka (integer), helper tanggal
```

Pustaka mobile utama: `@react-native-firebase/auth` + `app-check`, `expo-secure-store`
(token & preferensi), `expo-local-authentication` (biometrik), `expo-notifications` (FCM/APNs),
`expo-router` (navigasi + deep link), Sentry React Native.

Pembaruan: rilis biasa lewat toko; perbaikan kecil JS lewat EAS Update **hanya** untuk
perubahan yang tidak mengubah fungsi utama (sesuai kebijakan toko).

## 4. Data: kenapa ledger sebaiknya di PostgreSQL

Firestore cocok untuk data dokumen (pengajuan, profil, berkas) — itu tetap.
Untuk **uang**, PostgreSQL lebih tepat:

| Kebutuhan ledger                                                                      | PostgreSQL            | Firestore                                                        |
| ------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Satu transaksi menulis banyak baris sekaligus (debit+kredit)                          | ✅ ACID penuh         | ✅ transaksi, tapi batas 500 tulis & kontensi pada dokumen saldo |
| Aturan di level database (jumlah debit = kredit, saldo ≥ 0, unik per idempotency key) | ✅ constraint/trigger | ❌ hanya di kode                                                 |
| Laporan (neraca, SHU, RAT, aging piutang)                                             | ✅ SQL                | ❌ harus diekspor/agregasi manual                                |
| Rekonsiliasi harian vs laporan Xendit/bank                                            | ✅ join & query       | Sulit                                                            |
| Audit oleh akuntan/pengawas                                                           | ✅ ekspor standar     | Sulit                                                            |

Pilihan hosting: **Cloud SQL (region `asia-southeast2` Jakarta)** — satu ekosistem
Google dengan Firebase; atau Neon/Supabase (lebih murah di awal, cek region).
Akses dari Vercel memakai koneksi pooled + kredensial server-only.

Alternatif bila tim ingin tetap satu database: ledger di Firestore dengan koleksi jurnal
_append-only_, dokumen saldo per akun yang di-update dalam transaksi yang sama, dan
validasi ketat di kode. Bisa jalan untuk skala kecil, tapi laporan & rekonsiliasi akan
menjadi pekerjaan manual. **Keputusan ada di Panut.**

Catatan: lokasi project Firestore tidak bisa dipindah setelah dibuat — cek lokasi project
`app-venturego-id` sekarang; bila bukan Indonesia, pertimbangkan saat menyimpan data baru
yang sensitif.

## 5. Pembayaran (Xendit)

| Kebutuhan             | Produk Xendit                             | Catatan                                                                        |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Setor/bayar rutin     | **Fixed VA** per anggota (open, reusable) | `external_id = kop-va-{memberId}-{bank}`; satu VA per bank pilihan             |
| Bayar sekali          | Invoice / QRIS (sudah ada)                | `external_id = id dokumen payments`                                            |
| Penarikan ke rekening | **Payouts/Disbursement**                  | Hanya ke rekening atas nama anggota yang sudah divalidasi; wajib maker-checker |

Webhook gateway (`/api/webhooks/xendit`) tetap satu pintu:

1. Verifikasi `x-callback-token` (sudah ada, `timingSafeEqual`).
2. Simpan **payload mentah** ke tabel `webhook_events` (unik per id event) → idempotensi
   - forensik.
3. Routing berdasarkan awalan `external_id`: `trm-` → teruskan ke Turrima; `kop-va-` →
   alokasi ledger; id `payments` → alur invoice; lainnya → simpan & tandai `UNMATCHED`.
4. Balas cepat; proses berat (notifikasi, PDF) dijalankan terpisah.
5. Rekonsiliasi harian: bandingkan transaksi Xendit vs jurnal; selisih → antrian admin.

## 6. Berkas & dokumen

Saat ini berkas tersimpan di Google Drive akun pribadi `vworksofficial@gmail.com`. Untuk
aplikasi keuangan yang menyimpan KTP/KK dalam jumlah besar:

- Kuota 15 GB akan habis, dan akses bergantung pada satu akun pribadi.
- Sulit memenuhi kewajiban UU PDP (kontrol akses, log akses, penghapusan).

Rekomendasi: **Cloud Storage (Firebase Storage) bucket privat region Jakarta**, akses
hanya lewat server dengan URL bertanda tangan berumur pendek (≤5 menit), log akses
tercatat. Folder Drive bisa tetap dipakai sebagai salinan kerja staf selama masa transisi.

## 7. Pendukung

- **Notifikasi**: FCM (push Android & iOS), WA gateway (pengingat jatuh tempo), email.
  Semua pengiriman dicatat (`notification_log`).
- **Pekerjaan terjadwal**: pengingat H-3/H/H+3, tandai terlambat, rekonsiliasi harian,
  snapshot saldo bulanan (untuk laporan & RAT).
- **Observability**: Sentry (web + mobile), log terstruktur tanpa data pribadi, monitor
  uptime khusus endpoint webhook.
- **Lingkungan**: `production` dan `staging` terpisah penuh (project Firebase, database,
  Xendit _test mode_). Mobile punya build `staging` sendiri.
