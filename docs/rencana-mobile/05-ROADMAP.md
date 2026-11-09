# 05 — Roadmap

Prinsip: **satu fase = satu hasil yang bisa dipakai**, web yang sekarang tetap berjalan
selama transisi. Estimasi kasar untuk tim kecil yang bekerja dengan AI coding assistant;
bukan janji jadwal.

## Fase 0 — Legal & persiapan (berjalan paralel, mulai sekarang)

- [ ] Konsultasi hukum: badan hukum koperasi syariah, izin usaha simpan pinjam, closed loop (01 §3).
- [ ] Bentuk Dewan Pengawas Syariah; review akad simpanan & aturan alokasi (03 §5).
- [ ] Rekening bank atas nama koperasi; akun Xendit untuk koperasi (atau sub-akun).
- [ ] Akun developer **organisasi** di Google Play & Apple atas nama badan hukum.
- [ ] Cek kebijakan Google Play *Financial Services* untuk Indonesia.
- [ ] Kebijakan privasi & syarat layanan (UU PDP).

## Fase 1 — Fondasi backend (±3–4 minggu)

Hasil: web tetap sama di mata pengguna, tetapi siap dipakai mobile.

- [ ] Penerusan webhook `trm-` ke Turrima (sebelum hal lain).
- [ ] Pindahkan logika `actions.ts` ke `src/server/<domain>/`; Server Actions jadi pembungkus.
- [ ] Zod untuk semua input; `packages/contracts`.
- [ ] REST `/api/v1` (baca-saja dulu: me, tanggungan, riwayat).
- [ ] Peran via custom claims; perbaiki temuan keamanan 04 §7 no. 1–2.
- [ ] Test (Vitest) + CI GitHub Actions (typecheck, test, format).
- [ ] Lingkungan `staging` terpisah.

## Fase 2 — Ledger & VA tetap (±4–6 minggu)

Hasil: setiap rupiah tercatat; anggota punya satu nomor VA permanen.

- [ ] PostgreSQL + skema 03 §6 + migrasi berbasis file.
- [ ] Layanan ledger (posting jurnal, saldo, pembalik) dengan test menyeluruh.
- [ ] Fixed VA per anggota + alokasi otomatis (03 §5) + suspense.
- [ ] Webhook gateway: `webhook_events`, routing awalan, rekonsiliasi harian.
- [ ] Migrasi data lama (03 §7), dicocokkan dan ditandatangani bendahara.
- [ ] Panel admin: buku besar per anggota, antrian dana tak teridentifikasi, laporan harian.

## Fase 3 — Aplikasi mobile MVP (±6–8 minggu)

Hasil: app Android & iOS di uji tertutup (internal testing / TestFlight).

- [ ] Monorepo `apps/mobile` (Expo), login Firebase, App Check.
- [ ] PIN + biometrik, pengikatan perangkat.
- [ ] Beranda (saldo & tanggungan), jadwal angsuran, riwayat mutasi.
- [ ] Bayar via VA tetap / QRIS; potong saldo dengan step-up.
- [ ] Unggah berkas dari kamera/galeri (kompresi di perangkat).
- [ ] Notifikasi push (jatuh tempo, pembayaran diterima).
- [ ] Sentry mobile, build staging & production via EAS.

## Fase 4 — Keanggotaan & simpanan (±4 minggu, setelah izin siap)

- [ ] KYC (NIK + selfie liveness), pengesahan anggota oleh pengurus.
- [ ] Simpanan pokok/wajib/sukarela; tagihan simpanan wajib otomatis.
- [ ] Penarikan saldo ke rekening terverifikasi: maker-checker, limit, masa tunggu.
- [ ] Laporan untuk RAT (neraca sederhana, SHU, daftar simpanan).

## Fase 5 — Hardening & rilis publik (±3 minggu)

- [ ] Uji penetrasi pihak ketiga (web, API, mobile) dan perbaikan temuannya.
- [ ] Uji beban endpoint webhook & pembayaran.
- [ ] Simulasi pemulihan bencana (restore backup ledger).
- [ ] Review toko aplikasi; rilis bertahap (persentase pengguna).
- [ ] SOP operasional: cara review dana tak teridentifikasi, menyetujui penarikan, menangani
      akun diambil alih.

## Cara kerja dengan AI coding assistant (opencode / Claude Code)

- Simpan folder `docs/rencana-mobile/` ini di repo agar asisten membaca konteks yang sama.
- Satu sesi = satu butir checklist. Minta test ditulis **sebelum** logika ledger/alokasi.
- Aturan repo tetap berlaku: setiap perubahan perilaku app memperbarui
  `DOKUMENTASI_ALUR_KERJA.md` di commit yang sama.
- Perubahan bentuk data yang ada (Firestore) dikonfirmasi dulu sesuai §Schema Safety di
  `AGENTS.md`.
