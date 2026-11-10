# 04 — Keamanan

Standar acuan: **OWASP MASVS** (mobile, target level L2 untuk app keuangan), **OWASP ASVS**
(API & web), dan UU PDP. Sebelum rilis publik wajib **uji penetrasi** oleh pihak ketiga.

## 1. Ancaman utama & kontrolnya

| Ancaman                      | Contoh                                   | Kontrol                                                                                                                                                 |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akun diambil alih            | HP hilang, email dibobol, SIM swap       | PIN app + biometrik, pengikatan perangkat, notifikasi login perangkat baru, step-up untuk transaksi                                                     |
| API dipanggil di luar app    | Script memanggil API dengan token curian | Firebase **App Check** (Play Integrity / App Attest), rate limit, token berumur pendek                                                                  |
| Manipulasi nominal           | Klien mengirim `amount` palsu            | Server menghitung semua nominal dari data akad; klien hanya kirim id/niat                                                                               |
| Callback pembayaran palsu    | POST ke webhook                          | Token callback (`timingSafeEqual`, sudah ada), IP allowlist Xendit, cocokkan ulang ke API Xendit untuk nominal besar                                    |
| Pembayaran dobel             | Xendit retry, tombol ditekan dua kali    | Idempotency key unik di database                                                                                                                        |
| Orang dalam                  | Staf menambah saldo sendiri              | Maker-checker, tidak ada endpoint "edit saldo", audit log append-only, laporan harian ke pengurus                                                       |
| Penarikan ke rekening penipu | Akun diambil alih lalu tarik saldo       | Penarikan hanya ke rekening atas nama anggota (validasi nama via API bank/Xendit), masa tunggu 24–72 jam setelah ganti rekening/perangkat, limit harian |
| Bocor data KTP               | Bucket/URL publik, log berisi data       | Penyimpanan privat region Jakarta, URL bertanda tangan pendek, enkripsi field NIK, log tanpa PII                                                        |

## 2. Identitas & sesi

- **Anggota**: Firebase Auth (Google; tambahkan verifikasi nomor HP saat jadi anggota).
  Token di HP disimpan di Keychain/Keystore (`expo-secure-store`), bukan AsyncStorage.
- **PIN 6 digit + biometrik** untuk membuka app dan untuk setiap aksi uang. PIN di-hash
  di server (argon2/bcrypt), salah 5× → kunci sementara.
- **Step-up token**: setelah PIN/biometrik, server memberi token sekali-pakai berumur
  ~2 menit yang wajib dikirim ke endpoint transaksi.
- **Pengikatan perangkat**: tabel `devices` (id perangkat, model, token push, terakhir
  aktif). Login dari perangkat baru → notifikasi ke perangkat lama + email; aksi uang
  dibatasi selama masa tunggu.
- **KYC** sebelum jadi anggota: NIK + foto KTP + selfie dengan _liveness check_ lewat
  penyedia verifikasi yang terhubung Dukcapil (pilih setelah membandingkan biaya & izin).
- **Staf**: wajib 2FA di akun Google; peran via custom claims; sesi admin dipersingkat
  (mis. 8 jam) dan dicabut saat peran berubah (`revokeRefreshTokens`).

## 3. API

- Semua input divalidasi **Zod** (allowlist field), batas ukuran body, paginasi cursor.
- Verifikasi di setiap request: ID token (`checkRevoked: true` untuk aksi uang), App
  Check token, peran, kepemilikan data.
- **Rate limit** per uid & per IP (lebih ketat untuk login, PIN, pembayaran, unggah).
- Error ke klien tanpa detail internal; detail ke Sentry tanpa PII.
- Header keamanan web (CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`).

## 4. Aplikasi mobile

- Deteksi root/jailbreak & debugger → batasi fitur uang (tetap bisa lihat data).
- Tanpa data sensitif di log, screenshot dinonaktifkan di layar saldo/PIN
  (`FLAG_SECURE` Android; blur saat app ke background di iOS).
- Semua koneksi HTTPS; pertimbangkan _certificate pinning_ untuk domain API.
- Kunci API pihak ketiga (Xendit, WA, dll.) **tidak pernah** ada di app — hanya di server.
- Build rilis: obfuscation (Hermes + ProGuard/R8), tanda tangan app via EAS dengan
  kredensial yang dikelola tim, bukan laptop pribadi.

## 5. Data

- Firestore tetap **deny-all** (sudah benar); ledger PostgreSQL hanya bisa diakses
  akun service server, tidak ada akses langsung dari klien.
- **Enkripsi field** untuk NIK & nomor rekening (kunci di Secret Manager/KMS).
- Data di **region Indonesia** sebisa mungkin; backup otomatis + PITR (point-in-time
  recovery) untuk database ledger; uji restore tiap 3 bulan.
- Retensi: data anggota keluar diarsipkan sesuai kewajiban pencatatan keuangan, lalu
  dihapus/anonimkan; alur permintaan hapus sesuai UU PDP.
- Rencana respons insiden: siapa dihubungi, cara mencabut kunci, pemberitahuan ke
  anggota sesuai UU PDP.

## 6. Kontrol keuangan

- **Maker-checker** untuk: pencairan, penarikan, jurnal koreksi, ubah jadwal akad yang
  sudah disepakati, ubah nomor rekening anggota.
- **Limit**: penarikan per hari & per transaksi; nominal di atas batas → persetujuan
  pengurus.
- **Rekonsiliasi harian** otomatis (Xendit vs ledger vs bank) dengan laporan ke bendahara.
- **Alarm**: lonjakan gagal PIN, banyak perangkat baru, jurnal koreksi besar, webhook
  gagal berulang.

## 7. Temuan pada kode saat ini (perlu dibereskan di Fase 1)

| #   | Temuan                                                                       | Risiko                                                                                                                                                | Saran                                                                       |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `isStaffEmail` selalu menerima `demo.admin@venturego.id`, juga di production | Login password memang ditolak di production, tetapi jika ada akun Google dengan email itu (mis. Google Workspace venturego.id), ia otomatis jadi staf | Hanya izinkan email demo bila `NODE_ENV !== 'production'`                   |
| 2   | Akses staf berbasis daftar email di env                                      | Tidak ada pembedaan peran (CS vs keuangan vs pengurus)                                                                                                | Custom claims + tabel peran (01 §1)                                         |
| 3   | Pembayaran bebas lunas tidak mengurangi kewajiban                            | Uang masuk tanpa pencatatan pasangan                                                                                                                  | Ledger (03)                                                                 |
| 4   | Webhook belum meneruskan `trm-` ke Turrima                                   | Pembayaran VA Turrima hilang tanpa error saat app ini menggantikan versi lama di `apps.venturego.id`                                                  | Lihat catatan terpisah untuk Panut                                          |
| 5   | Berkas KTP/KK di Google Drive akun pribadi                                   | Kuota, ketergantungan satu akun, kepatuhan UU PDP                                                                                                     | Cloud Storage privat (02 §6)                                                |
| 6   | Belum ada test otomatis & CI                                                 | Regresi pada logika uang tidak terdeteksi                                                                                                             | Test unit wajib untuk ledger & alokasi, CI (typecheck + test) sebelum merge |

Hal yang sudah baik dan perlu dipertahankan: Firestore deny-all, verifikasi provider
login, cek kepemilikan `ownerFirebaseUid`, pemeriksaan tanda tangan berkas (magic byte),
token webhook dengan `timingSafeEqual`, transaksi Firestore pada webhook, kunci rahasia
hanya di server.
