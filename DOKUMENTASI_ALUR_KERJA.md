# Dokumentasi Alur Kerja Aplikasi — VentureGo VSV

> **PENTING — Aturan pemeliharaan:** Dokumen ini adalah **satu-satunya rujukan resmi alur kerja aplikasi** (pengguna & admin). **Setiap perubahan apa pun pada aplikasi — fitur, alur, halaman, status, pesan error, struktur Google Drive, integrasi pembayaran — WAJIB disertai pembaruan dokumen ini di commit yang sama.** Jika menemukan ketidakcocokan antara kode dan dokumen ini, anggap kode sebagai perilaku lalu **perbaiki dokumen ini segera**.

Terakhir diperbarui: **7 November 2026** (perombakan UI/UX `/admin` menjadi Backoffice minimalis dengan fixed sidebar `100dvh`, 7 menu modul, tabel 1 baris multi-kolom, dan Slide-Over Drawer editor).

---

## 1. Gambaran Umum

| Komponen            | Teknologi                                                      | Keterangan                                                                                                                    |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js App Router (React 19)                                  | Client Components + Server Actions                                                                                            |
| Basis data          | Cloud Firestore (`applications`, `driveFolders`, `payments`)   | Akses hanya via Admin SDK di server                                                                                           |
| Autentikasi pemohon | Firebase Auth **Google** (plus akun demo di lokal)             | Production hanya `Masuk dengan Google`; di lokal tersedia `Masuk User` (`demo.user@venturego.id`)                             |
| Autentikasi staf    | Firebase Auth Google/email + allowlist `FIREBASE_ADMIN_EMAILS` | Email utama `vworksofficial@gmail.com` + admin demo `demo.admin@venturego.id`; cookie sesi `venturego-admin-session` (5 hari) |
| Penyimpanan berkas  | **Google Drive** (OAuth sebagai pemilik akun)                  | Bukan Cloud Storage — tanpa biaya billing                                                                                     |
| Pembayaran          | **Xendit** (Virtual Account & QRIS)                            | Invoice 48 jam + webhook otomatis                                                                                             |
| Gaya                | Tailwind CSS v4                                                |                                                                                                                               |

### Peta Route

| Route                                                                         | Fungsi                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/`                                                                           | Welcome + form pengajuan; login Google dan routing staf/pemohon |
| `/dashboard`                                                                  | Beranda dashboard pemohon                                       |
| `/dashboard/unggah-berkas`                                                    | Unggah/ganti dokumen pengajuan                                  |
| `/dashboard/angsuran`                                                         | Rincian biaya, jadwal, persetujuan penawaran, keringanan        |
| `/dashboard/pembayaran`                                                       | Bayar angsuran & pembayaran bebas via Xendit                    |
| `/dashboard/{riwayat,dokumen,profil,bantuan,notifikasi,simulasi,layanan,vip}` | Halaman pendukung (sebagian masih demo/statis — lihat §8)       |
| `/admin`                                                                      | Panel staf (tanpa halaman login; non-staf diarahkan ke `/`)     |
| `POST /api/applicant/uploads`                                                 | Endpoint unggah dokumen (init + chunk) ke Google Drive          |
| `GET /api/admin/applications/[id]/documents/[index]`                          | Unduh dokumen oleh staf (proxy Drive)                           |
| `POST/DELETE /api/admin/session`                                              | Buat/hapus cookie sesi staf                                     |
| `POST /api/webhooks/xendit`                                                   | Webhook status pembayaran Xendit                                |

---

## 2. Google Drive — Struktur & Efek

### 2.1 Struktur folder

Semua berkas siswa tersimpan di **akun Google pemilik aplikasi** (`vworksofficial@gmail.com`), kuota 15GB gratis akun tersebut. OAuth bertindak sebagai pemilik file, sehingga kuota service account (0 byte) tidak menjadi masalah.

```
My Drive (vworksofficial@gmail.com)
└── VentureGo Berkas/                          ← ROOT, dibuat otomatis aplikasi saat unggahan pertama
    ├── Budi Santoso · a1b2c3/                 ← folder DRAFT (sesi sebelum submit)
    │   ├── KTP.pdf
    │   └── Paspor.jpg
    ├── Budi Santoso - VSV-APP-1A2B3C4D/       ← setelah SUBMIT: folder yang sama di-rename
    │   ├── KTP.pdf
    │   └── Scan KK.jpg
    └── Siti Rahayu · d4e5f6/                  ← pemohon lain
```

- **Root** `VentureGo Berkas`: dibuat otomatis oleh aplikasi di root My Drive (scope `drive.file` — aplikasi hanya melihat file buatannya sendiri). Override opsional via env `GDRIVE_ROOT_FOLDER_ID`.
- **Folder draft**: `<Nama Pemohon> · <6 digit pertama uid>` — dibuat saat unggahan pertama pemohon sebelum pengajuan tersimpan; dipetakan di Firestore `driveFolders/{uid}` (`stage: 'draft'`).
- **Folder pengajuan**: saat **submit sukses**, folder draft **di-rename** menjadi `<Nama Pemohon> - <applicationId>` (mis. `Budi Santoso - VSV-APP-1A2B3C4D`) dan pemetaan di-update `stage: 'submitted'`. **File di dalamnya tidak dipindah** — hanya nama folder yang berubah.
- **Unggahan susulan** (setelah pengajuan ada): langsung ke folder `<Nama> - <applicationId>` (`driveFolderId` disimpan di dokumen aplikasi); folder dibuat bila belum ada.
- **Nama file**: nama asli disanitasi (karakter `\ /` diganti `_`, maks 180 karakter).

### 2.2 Alur unggahan (chunked resumable)

1. Klien memanggil `POST /api/applicant/uploads` dengan header `x-upload-action: init` + token ID Google Firebase → server memvalidasi lalu membuat sesi resumable di Drive → mengembalikan `ticket` (HMAC, TTL 30 menit) + `chunkSize` 4 MB.
2. Klien mengirim potongan (`x-upload-action: chunk`, header `Content-Range`) — 4 MB per potongan (di bawah limit body Vercel 4,5 MB).
3. Potongan pertama **diverifikasi tanda tangan berkas** (magic byte PDF/JPG/PNG) — bila salah → sesi dibatalkan, error `Isi berkas tidak sesuai dengan formatnya.`
4. Potongan terakhir → file selesai → bila unggahan terkait pengajuan, transaksi Firestore menulis entri `documents[index]` `{documentType, status:'UPLOADED', fileId, fileName, mimeType, size}` + `driveFolderId`. Bila transaksi gagal, file di Drive **dihapus** (tidak ada file yatim).
5. Server **memverifikasi ulang** setiap `fileId` ke Drive saat submit — file yang tidak ada di folder milik pemohon akan menggugurkan pengajuan.

### 2.3 Validasi & batasan

| Aturan          | Nilai                              | Pesan error (user-facing)                                                |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Tipe file       | PDF, JPG, PNG                      | `Gunakan berkas PDF, JPG, atau PNG.`                                     |
| Ukuran per file | maks **10 MB**                     | `Ukuran berkas maksimal 10 MB.` / `Ukuran setiap berkas maksimal 10 MB.` |
| Total ukuran    | maks **60 MB**                     | `Ukuran seluruh dokumen tidak boleh melebihi 60 MB.`                     |
| Isi file        | Cocok dengan ekstensi (magic byte) | `Isi berkas tidak sesuai dengan formatnya.`                              |
| Token sesi      | Harus akun Google & valid          | `Sesi unggah telah berakhir. Silakan muat ulang halaman.` (401)          |
| Ticket unggahan | HMAC, TTL 30 menit                 | `Sesi unggah tidak valid. Silakan ulangi unggahan.`                      |

### 2.4 Efek sisi Drive saat alur berjalan

| Aksi aplikasi                               | Efek di Google Drive                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unggahan pertama (sebelum submit)           | Folder draft `<Nama> · <uid6>` dibuat di root (bila belum ada)                                            |
| Submit pengajuan **berhasil**               | Folder draft **di-rename** jadi `<Nama> - VSV-APP-XXXXXXXX`; mapping `driveFolders` → `stage:'submitted'` |
| Submit **gagal**                            | File yang baru terunggah **dihapus** otomatis (`discardDriveUploads`)                                     |
| Ganti dokumen di unggah-berkas              | File baru ditulis; **file lama tidak dihapus** oleh sistem (riwayat lama menumpuk — lihat §8)             |
| Admin mengunduh dokumen                     | Stream dari Drive (`GET /api/admin/.../documents/[index]`), tidak ada URL publik                          |
| Akses kedaluwarsa (token OAuth kadaluwarsa) | Error 503 `Akses Google Drive kedaluwarsa. Silakan setujui ulang akses aplikasi.`                         |

### 2.5 Kredensial (server-only, di Vercel & `.env.local`)

- `GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET` — OAuth client tipe _Desktop app_.
- `GDRIVE_REFRESH_TOKEN` — hasil klik **Allow** sekali oleh pemilik akun; server menukarnya jadi access token otomatis.
- Consent screen harus berstatus **Production** agar refresh token tidak kedaluwarsa 7 hari.
- Tidak ada kunci service account yang dipakai lagi untuk Drive.

---

## 3. Alur Kerja Pemohon (User)

### 3.1 Ringkasan perjalanan

```
Formulir (/) → Submit → Dashboard → Unggah berkas → [Admin verifikasi & set biaya]
     → Ansuran disetujui → Bayar via Xendit → Status aktif → Pelunasan
```

### 3.2 Formulir pengajuan `/` (wizard 5 langkah tampil)

Tombol: `Kembali` · `Lanjutkan` · `Kirim pengajuan` (saat kirim: `Mengirim…`). Deep link: `/?step=1..6`, `/?apply=true`.

| Langkah                | Isi                                                                                                                                                                                                                                                                                                                                          | Catatan UI                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0 — Selamat datang** | Header merek `Vworks Student Venture`, salam. Di **production**: hanya 1 tombol utama `Masuk dengan Google` + catatan `Akun baru akan dibuat secara otomatis saat pertama kali masuk.` Di **mode lokal (development)**: tombol `Masuk User` (`demo.user@venturego.id`), `Masuk Admin` (`demo.admin@venturego.id`), dan `Masuk dengan Google` | Staf → `/admin`, pemohon → `/dashboard`                                |
| **1 — Pilih produk**   | Dua kartu: **`VSV Full Cover`** (tag `Persiapan lengkap`) → `FULL_COVER`; **`VSV Dana Keberangkatan`** (tag `Tahap akhir`) → `DEPARTURE_BRIDGING`                                                                                                                                                                                            | Memilih produk membersihkan file terpilih                              |
| **2 — Kesiapan**       | Departure: checkbox pelatihan/lulus seleksi/paspor/kontrak + select `Status COE`, `Status visa`. Full Cover: checkbox pelatihan bahasa/paspor/orestu wali + select `Level bahasa Jepang`                                                                                                                                                     | Catatan lunak bila pelatihan belum selesai                             |
| **3 — Data diri**      | Nama (ph `Sesuai KTP`), WA (`08xxxxxxxxxx`), agama, tempat/tanggal lahir, jenis kelamin, alamat KTP + alamat korespondensi + kode pos                                                                                                                                                                                                        | Alamat korespondensi bisa disinkronkan dengan KTP                      |
| **4 — Program & dana** | Departure: LPK, negara, tanggal keberangkatan, sisa kewajiban LPK, nilai pembiayaan (Rp31/33/36/40 juta) + **simulasi langsung** (dana cair setelah admin 5%, ujrah 2,4%/bulan ×12, angsuran/bulan). Full Cover: LPK, negara, tanggal mulai, durasi bahasa & keterampilan, checkbox 7 kebutuhan                                              | Panel `Mengenal akad Wakalah bil Ujrah`                                |
| **6 — Tinjau & kirim** | Ringkasan produk + akad `Wakalah bil Ujrah`, daftar nilai (estimasi dana cair, total ujrah, biaya admin, total kewajiban, angsuran/bulan), **2 centang wajib** (paham akad + persetujuan data)                                                                                                                                               | Semua error server tampil di langkah ini (`<p class="error-message">`) |

**Catatan penting:** wizard **tidak memiliki langkah unggah dokumen** (langkah 5 disembunyikan). Pengajuan selalu dimulai dengan semua slot dokumen `NOT_UPLOADED`; dokumen diunggah setelahnya di `/dashboard/unggah-berkas`. Bila pengguna sudah login (Google atau akun demo) lalu membuka `/` tanpa parameter form, aplikasi otomatis mengarahkan ke `/admin` (staf) atau `/dashboard` (pemohon); deep link `/?step=1` dan `/?apply=true` tetap membuka form.

**Efek Drive saat submit:**

- Berhasil → `router.replace('/dashboard?applicationSubmitted=1')`, dashboard menampilkan toast **`Pengajuan berhasil diajukan`** (hilang otomatis 5 detik). Record `applications` dibuat: `applicationId = VSV-APP-<8 karakter UUID huruf besar>`, `status: 'SUBMITTED'`, dokumen, rencana biaya `ESTIMATED`, dll. Folder Drive di-rename (§2.1). Bila pengguna sudah login (Google atau akun demo), submit langsung memakai sesi tersebut; bila belum login, submit membuka popup Google terlebih dahulu.
- Gagal → file yang baru terunggah dihapus dari Drive; pesan error ditampilkan di langkah tinjau.

**Pesan error server yang bisa tampil di langkah tinjau** (contoh utama): `Lengkapi nama, nomor WhatsApp, dan nama LPK.` · `Masukkan nomor WhatsApp Indonesia yang valid.` · `Persetujuan akad dan pemrosesan data wajib dicentang.` · `Isi perkiraan tanggal keberangkatan dengan format seperti 12 Februari 2026.` · `Lengkapi tempat dan tanggal lahir dengan format seperti 12 Februari 2000.` · `Pengajuan belum dapat dikirim. Periksa koneksi lalu coba lagi.`

### 3.3 Dashboard pemohon

Semua halaman dashboard memerlukan **login Google atau akun demo (`Masuk User`)**. Tanpa sesi aplikasi → diarahkan ke `/` (welcome). Akun staf (`vworksofficial@gmail.com`, `demo.admin@venturego.id`, atau allowlist) → diarahkan ke `/admin`. Pemohon baru yang sudah login tetapi belum punya pengajuan tetap melihat **kartu ringkasan default** di beranda. Navigasi bawah: **Angsuran · Riwayat · Beranda · Unggah · Profil**.

#### Beranda `/dashboard`

- Sapaan `Selamat datang, <nama depan>` (dari nama pemohon atau nama akun Google; loading: `Memuat…`), lonceng → notifikasi (titik amber bila ada yang belum dibaca).
- **Kartu ringkasan**: nominal (`Total kewajiban akad`/`Estimasi diajukan`), toggle sembunyikan nominal (`Rp••••••••`), **pil status**, progres bar `{x} dari {y} angsuran jatuh tempo`, `Jatuh tempo berikutnya`; bila belum ada jadwal → `Berkas terunggah {x}/{y}` + `Nomor pengajuan {VSV-APP-…}`; bila biaya masih estimasi → `Rincian biaya sedang disusun dan diverifikasi tim VentureGo.`
- **Pengguna baru (sudah login Google) / tanpa pengajuan**: kartu ringkasan langsung tampil dengan nilai default — `Total angsuran terbayar` **Rp0**, progres 0% (`Belum ada pembayaran`, `Total kewajiban Rp0`), `Tenor` **0 bulan**, dan `Virtual Account` **0000000000000000**, dengan pil `Belum ada pengajuan`. CTA pengajuan tetap berada pada kartu `Ajukan Pembiayaan Baru` di bawah hero.
- **Alur progress saat ini** — 7 tahap: `Pengajuan → Verifikasi & kelayakan → Pengumpulan berkas online → Akad pembiayaan → Pencairan dana → Program angsuran → Pelunasan`, badge `Tahap {n}/7`, tahap aktif berchip `SEKARANG`; status tertutup (Ditolak/Dibatalkan) menampilkan catatan merah.
- Kartu `Ajukan Pembiayaan Baru` (→ `/?step=1`) dan `Layanan cepat` (Bayar angsuran, Simulasi, Ajukan baru, Bantuan, VIP).

#### Unggah berkas `/dashboard/unggah-berkas`

- Banner: `Unggah dokumen PDF, JPG, atau PNG. Maksimal 10 MB untuk setiap berkas.`
- Pemilih pengajuan bila >1 (`{VSV-APP-…} · {nama}`); dua grup: **Dokumen utama** dan **Dokumen pendukung**.
- Per slot: label (+ bintang merah untuk wajib), status `Belum diunggah` atau `{nama file} · {x,x} MB`, tombol **`Unggah`** / **`Ganti`** / `Mengunggah…` / `Belum aktif` (tanpa pengajuan).
- Sukses: `{label} berhasil diunggah.` (hijau) → daftar dimuat ulang. Gagal: pesan server / `Berkas belum dapat diunggah. Periksa koneksi lalu coba lagi.`
- **Efek Drive**: file baru masuk ke folder `<Nama> - <VSV-APP-…>`; entri `documents[index]` di Firestore diganti (status kembali `UPLOADED`).
- **Keadaan khusus**: status dokumen yang ditandai admin `Diverifikasi`/`Perlu perbaikan` **tidak tampil** di UI pemohon (kembali `Belum diunggah`) — lihat §8.

**Daftar dokumen per produk** (`src/lib/documents.ts`):

- **Dana Keberangkatan — 17 slot** (wajib ditandai `*`: Pas Foto, Scan KTP, Scan KK, Ijazah SD, SMP, SMA): Pas Foto · Scan KTP · Scan Akta Kelahiran · Scan KK · Ijazah SD/MI · Ijazah SMP/MTs/SLTP · Ijazah SMA/SMK/MA/SLTA · Scan Passport · _pendukung:_ Scan Surat Rekomendasi LPK · Scan Form Pendaftaran · Scan Surat Kesediaan Mengangsur · Scan Surat Mengetahui Orang Tua · Scan SKCK · Scan COE · Scan Kontrak Kerja · Scan KTP Orang Tua/Wali · Scan Surat Nikah Orang Tua.
- **Full Cover — 9 slot (semua opsional):** KTP siswa · Kartu Keluarga · Persetujuan orang tua · Rekomendasi LPK · Akta kelahiran · Ijazah terakhir · Bukti pendaftaran LPK · Rincian program pelatihan · Estimasi biaya LPK.

#### Angsuran `/dashboard/angsuran`

- Hanya pengajuan **Dana Keberangkatan** dengan rincian biaya. Chip status: `Menunggu verifikasi` / `Penawaran terverifikasi` / `Akad disepakati` / `Pengajuan dibatalkan|ditolak`.
- Amber: `Estimasi total yang Anda ajukan: Rp… Angka ini bukan total Nafaqah/Ujrah terverifikasi atau nominal akad.`
- Bila `pricingStatus` = `VERIFIED`/`AGREED`: blok **Rincian kewajiban** (baris `Nafaqah · biaya riil` + `Ujrah · jasa` dengan penerima & referensi bukti), total (Nafaqah, Ujrah tetap, Uang saku qardh, Refund/potongan, **Total akad**), **Jadwal angsuran** (`{n} kali`, tanggal, nominal, sisa setelah bayar), referensi akad final.
- **Persetujuan pemohon**: tombol `Saya menyetujui rincian terverifikasi` → `Persetujuan atas penawaran tercatat.`; bila sudah: `Penawaran sudah disetujui`. Bila `AGREED`: catatan hijau `Akad final tercatat disepakati. Total kewajiban tidak bertambah karena waktu atau keterlambatan. Pelunasan dipercepat tidak dikenai penalti.`
- **Permohonan keringanan**: textarea (10–1000 karakter) + `Kirim permohonan` → masuk daftar `Menunggu tinjauan` (maks 10 permohonan; ditinjau admin — §4.3).
- Belum diverifikasi: `Admin sedang menyusun dan memverifikasi rincian biaya. Nominal dari contoh akad tidak digunakan sebagai harga otomatis.`

#### Pembayaran `/dashboard/pembayaran`

- Info: `Pembayaran diproses di halaman aman Xendit. Tersedia Virtual Account (BCA, Mandiri, BNI, BRI) dan QRIS; status lunas dikonfirmasi otomatis.`
- Per pengajuan: baris `Angsuran {n}` + tanggal + nominal; lunas → `✓ Lunas`; tombol **`Bayar`** atau **`Lanjutkan`** (bila ada invoice PENDING masih berlaku).
- **Pembayaran bebas** (pelunasan sebagian/sukarela): pilih pengajuan + nominal (min Rp1.000, maks Rp100.000.000) → `Bayar {Rp…}`.
- **Riwayat pembayaran** + tombol `Segarkan`: status `Menunggu pembayaran` / `Lunas` / `Kedaluwarsa` / `Gagal`.
- **Alur Xendit:**
  1. Server membuat dokumen `payments` (`PENDING`) + invoice Xendit (durasi **48 jam**, IDR) → browser dialihkan ke `invoiceUrl` (halaman aman Xendit).
  2. Pemohon membayar via VA/QRIS.
  3. **Webhook** Xendit → `PAID`/`SETTLED`: pembayaran `Lunas` + (untuk angsuran) nomor angsuran ditambahkan ke `paidInstallments` aplikasi; `EXPIRED` → `Kedaluwarsa`.
  4. Pemohon klik `Segarkan`/reload → baris berubah `✓ Lunas`.
  - Tanpa konfigurasi server: `Pembayaran daring belum dikonfigurasi di server. Hubungi tim VentureGo untuk info pembayaran.`
  - Invoice yang sama tidak dibuat ulang (dipakai ulang selama belum kedaluwarsa).

#### Halaman pendukung

- **Simulasi** `/dashboard/simulasi`: kalkulator klien (Rp31/33/36/40 juta → Nafaqah, ujrah 2,4%×12, total kewajiban, tenor 12 bulan) — catatan `Hasil ini merupakan simulasi. Nilai akhir mengikuti verifikasi program, kebutuhan, dan akad pembiayaan.`
- **Profil** `/dashboard/profil`: nama & email akun yang sedang login, metode masuk (`Google` atau `Email & Password`), menu, tombol **`Keluar`** → keluar sesi & kembali ke `/`.
- **Riwayat, Dokumen, Notifikasi, Bantuan, Layanan**: **masih halaman demo/statis** (ada disclaimer `Riwayat di halaman ini adalah data demo…`) — lihat §8.
- **VIP**: placeholder `SEDANG DIKEMBANGKAN`.

### 3.4 Label status (sisi pemohon)

`SUBMITTED` **Terkirim** · `ELIGIBILITY_REVIEW` **Tinjauan kelayakan** · `DOCUMENT_REVIEW` **Tinjauan berkas** · `REVISION_REQUIRED` **Perlu revisi** · `COST_VERIFICATION` **Verifikasi biaya** · `APPROVED` **Disetujui** · `CONTRACT_PREPARATION` **Persiapan akad** · `ACTIVE` **AKTIF** · `COMPLETED` **Selesai** · `REJECTED` **Ditolak** · `CANCELLED` **Dibatalkan**.

---

## 4. Alur Kerja Admin (Staf)

### 4.1 Masuk `/admin`

- **Tidak ada halaman login admin terpisah.** Di production, staf masuk lewat tombol `Masuk dengan Google` di welcome `/`. Di mode lokal (development), staf juga dapat masuk lewat tombol `Masuk Admin` (`demo.admin@venturego.id`).
- Tombol `Masuk User` (`demo.user@venturego.id`) dan `Masuk Admin` (`demo.admin@venturego.id`) hanya tampil di mode lokal (`NODE_ENV !== 'production'`) dan langsung login menggunakan `signInWithEmailAndPassword` dari `src/lib/demo-accounts.json` tanpa halaman sign-in.
- Login dengan `vworksofficial@gmail.com` (email staf utama), `demo.admin@venturego.id`, atau email lain di allowlist **`FIREBASE_ADMIN_EMAILS`** → aplikasi membuat cookie sesi `venturego-admin-session` (**httpOnly, 5 hari**) lalu langsung mengarahkan ke `/admin`.
- Login dengan akun non-staf → langsung diarahkan ke `/dashboard` (dashboard pemohon).
- `/admin` tanpa cookie sesi staf → redirect ke `/` (welcome), bukan kartu login.
- Pesan error API: `Akun ini tidak memiliki akses staf.` (403) · `Sesi masuk tidak valid.` · `Tidak dapat membuat sesi staf.` · popup gagal → `Tidak dapat masuk dengan Google. Izinkan popup lalu coba lagi.` · demo gagal → `Tidak dapat masuk sebagai user/admin demo. Silakan coba lagi.`
- Sesi kedaluwarsa → redirect ke `/`; saat menyimpan: `Sesi staf berakhir. Silakan masuk kembali.`
- **Efek Drive**: tidak ada — admin hanya membaca.

### 4.2 Navigasi Sidebar Fixed (`100dvh`), Tabel Multi-Kolom, & Slide-Over Drawer (`/admin`)

- **Sidebar Kiri Fixed (`100dvh`, `VentureGo VSV · Admin Backoffice`):**
  - Tinggi dikunci 1 layar penuh (`lg:h-dvh lg:overflow-hidden`) dengan item menu ringkas 1 baris berikon SVG sehingga tidak pernah offside ke bawah:
    1. **`Dashboard`** — 4 kartu KPI utama + tabel 8 pengajuan terbaru
    2. **`Pengajuan`** — tabel 1 baris 10 kolom (`ID Pengajuan`, `Tgl Masuk`, `Nama Siswa`, `LPK Mitra`, `Tujuan`, `Produk`, `Berkas`, `Status Biaya`, `Status Pengajuan`, `Aksi`)
    3. **`Data Siswa`** — direktori siswa 1 baris 9 kolom (`Nama Siswa`, `No. WhatsApp`, `TTL & Gender`, `LPK & Negara`, `Status COE / Visa`, `Est. Keberangkatan`, `Berkas Terunggah`, `Diverifikasi`, `Aksi Biodata/Berkas`)
    4. **`Draft & Akad`** — tabel skema pembiayaan 1 baris 10 kolom (`ID Pengajuan`, `Nama Siswa`, `Produk & Skema`, `Pengajuan Awal`, `Nafaqah + Ujrah`, `Total Akad`, `Status Biaya`, `Persetujuan Siswa`, `Referensi Akad`, `Aksi Susun Akad`)
    5. **`Angsuran & Kas`** — tabel pemantauan cicilan 1 baris 9 kolom (`ID Pengajuan`, `Nama Siswa`, `Total Kewajiban`, `Tenor`, `Progres Cicilan`, `Total Terbayar`, `Sisa Kewajiban`, `Keringanan`, `Aksi Rincian`)
    6. **`Statistik`** — analitik portofolio produk/negara tujuan & tabel rekapitulasi per **LPK Mitra**
    7. **`Log Audit`** — tabel riwayat perubahan rincian biaya (`financialPlanHistory`) lintas pengajuan
  - Bagian bawah sidebar: email staf aktif, tombol `Segarkan`, dan `Keluar`.
- **Pencarian & Filter Atas (Sticky Header):** pencarian instan (`applicationId`, nama siswa, nomor WA, nama LPK), filter produk (`Semua Produk` / `Dana Keberangkatan` / `Full Cover`), dan filter status pengajuan (11 status).
- **Slide-Over Drawer (`ApplicationDrawerForm`):**
  - Saat tombol aksi (`Kelola`, `Biodata`, `Berkas`, `Susun Akad`, `Rincian`, `Detail`) diklik pada baris tabel, drawer kanan terbuka dengan 6 tab (`Profil & Kelayakan`, `Berkas Dokumen`, `Draft Biaya & Akad`, `Status Persetujuan`, `Jadwal Angsuran`, `Keringanan & Audit`). Seluruh tab tetap ter-mount di DOM agar penyimpanan form utuh.

### 4.3 Review & aksi (tombol `Simpan` di Slide-Over Drawer)

Setiap pengajuan yang dibuka di Slide-Over Drawer memiliki satu form terpadu; **`Simpan`** memanggil action tunggal `updateApplicationStatus` yang memperbarui sekaligus:

| Kontrol                                          | Pilihan / isi                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status pengajuan**                             | 11 status (label admin): Terkirim · Pemeriksaan kelayakan · Pemeriksaan dokumen · Perlu perbaikan · Verifikasi biaya · Disetujui · Persiapan akad · Aktif · Selesai · Ditolak · Dibatalkan |
| **Status per dokumen** (per slot)                | `Belum diunggah` · `Sudah diunggah` · `Diverifikasi` · `Perlu perbaikan`                                                                                                                   |
| **Unduh berkas**                                 | Tombol `Unduh {nama file}` → unduh langsung dari Drive (hanya bila `fileId` ada); tanpa sesi → 401 `Tidak diizinkan.`                                                                      |
| **Status biaya**                                 | `Estimasi` · `Terverifikasi` · `Disepakati`                                                                                                                                                |
| **Catatan internal**                             | teks maks 2.000 karakter (tidak pernah tampil ke pemohon)                                                                                                                                  |
| **Rincian biaya** (field `finance-terms-fields`) | Lihat di bawah                                                                                                                                                                             |
| **Permohonan keringanan**                        | pilih `Menunggu tinjauan`/`Ditinjau` + `Tanggapan untuk pemohon` (maks 1000) → tampil di halaman angsuran pemohon                                                                          |

**Field rincian biaya:**

- **Full Cover** (hanya Jepang yang bisa diverifikasi): `Nafaqah`, `Ujrah`, `Ju'alah (jika COE terbit)`, `Tenor setelah keberangkatan (1–36 bulan)` + ringkasan hitung otomatis.
- **Dana Keberangkatan**: editor baris **Rincian Nafaqah** (`Komponen`, `Penerima pembayaran`, `Nominal`, `Referensi bukti pembayaran`, maks 20 baris) dan **Rincian Ujrah**; `Uang saku qardh` (+ centang `Sudah diserahkan kepada pemohon`), `Jumlah angsuran (1–36)`, `Tanggal angsuran pertama`, `Refund/potongan` + bukti, `Referensi akad final yang sudah ditandatangani`, `Catatan penyelesaian`. Total live: `Nafaqah + Ujrah + qardh − refund`.

**Aturan bisnis penting saat `Simpan`** (semua memblokir dengan pesan spesifik):

- `Terverifikasi` (biaya) mensyaratkan minimal 1 baris Nafaqah berlabel+berpenerima+berbukti, minimal 1 baris Ujrah, jadwal angsuran valid (1–36×, tanggal pertama **bulan setelah perkiraan keberangkatan**), dan bukti bila refund > 0.
- `Disepakati` mensyaratkan **persetujuan pemohon tercatat** (tombol di halaman angsuran) **dan** referensi akad final yang cocok dengan penawaran terbaru. Mengubah penawaran **menghapus persetujuan pemohon** (haru disetujui ulang).
- Full Cover hanya bisa `Terverifikasi`/`Disepakati` untuk tujuan **Jepang**; `ju'alah` diset `COE_ISSUED`, `paymentStartCondition` `AFTER_DEPARTURE`.
- Pembatalan wajib mencatat perhitungan Nafaqah & refund sebelum `Dibatalkan`.
- Setiap simpan menambah `financialPlanHistory` (20 terakhir) + `updatedBy`/`updatedAt`.

**Pesan error umum action**: `Pilih status pengajuan yang valid.` · `Catatan internal maksimal 2.000 karakter.` · `Dokumen belum memiliki berkas untuk diverifikasi.` · `Status Disepakati memerlukan persetujuan pemohon dan referensi akad final yang telah ditandatangani.` · `Total kewajiban harus sama dengan Nafaqah ditambah Ujrah.` · `Tanggal angsuran pertama harus berada pada bulan setelah perkiraan keberangkatan…` · `Status belum dapat disimpan. Coba lagi.`

### 4.4 Efek lintas sisi (admin → pemohon → Drive)

| Aksi admin                                             | Efek ke pemohon (UI)                                                                                       | Efek ke Drive                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Ubah **Status pengajuan**                              | Pil status + tahap `Alur progress` di beranda berubah (mis. `DOCUMENT_REVIEW` → tahap 3 + chip `SEKARANG`) | Tidak ada                            |
| Tandai dokumen `Diverifikasi`/`Perlu perbaikan`        | ⚠️ Di unggah-berkas pemohon slot kembali tampil `Belum diunggah` (hanya `UPLOADED` yang dihitung — §8)     | Tidak ada (hanya status Firestore)   |
| `Status biaya` → `Terverifikasi`                       | Halaman angsuran menampilkan rincian + tombol `Saya menyetujui rincian terverifikasi`                      | Tidak ada                            |
| `Status biaya` → `Disepakati` (setelah pemohon setuju) | Catatan hijau `Akad final tercatat disepakati…`; jadwal & total terkunci                                   | Tidak ada                            |
| Tanggapi permohonan keringanan                         | Tampil `Tanggapan tim: …` di halaman angsuran                                                              | Tidak ada                            |
| Unduh dokumen                                          | —                                                                                                          | Stream dari Drive (tanpa URL publik) |
| Ubah jadwal/biaya baru                                 | Persetujuan pemohon lama **dihapus** → tombol persetujuan muncul lagi                                      | Tidak ada                            |

---

## 5. Autentikasi & Sesi

| Aspek             | Pemohon                                                                                                          | Admin                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Metode            | Production: Firebase **Google**. Lokal: Google atau demo **email/password** (`Masuk User`)                       | Production: Firebase **Google**. Lokal: Google atau demo **email/password** (`Masuk Admin`)     |
| Akun demo         | `demo.user@venturego.id` / `UserDemo123!` (`src/lib/demo-accounts.json`, tombol khusus lokal)                    | `demo.admin@venturego.id` / `AdminDemo123!` (`src/lib/demo-accounts.json`, tombol khusus lokal) |
| Routing           | Email non-staf → `/dashboard`; staf → `/admin`                                                                   | Email staf → `/admin`; non-staf → `/dashboard`                                                  |
| Penyimpanan       | localStorage browser (Firebase default), token otomatis refresh                                                  | Cookie `venturego-admin-session` (httpOnly, 5 hari)                                             |
| Verifikasi server | Production: hanya `google.com`; lokal: `google.com` atau `password`                                              | Verifikasi ID token + `isStaffEmail()`                                                          |
| Keluar            | Profil → `Keluar` (sign-out Firebase) → `/`                                                                      | Tombol `Keluar` (hapus cookie + sign-out) → `/`                                                 |
| Pesan kedaluwarsa | `Sesi telah berakhir. Silakan masuk kembali.` · `Sesi unggah telah berakhir. Silakan muat ulang halaman.` · dll. | Redirect ke `/`; `Sesi staf berakhir. Silakan masuk kembali.`                                   |

**Konsekuensi desain:** pemohon baru yang sudah login tetapi belum pernah submit melihat kartu ringkasan default bernilai nol (Rp0 · 0 bulan · VA 0000000000000000). Tidak ada halaman signup/login manual; akun demo dibuat oleh admin melalui `scripts/seed-demo-accounts.mjs`. Record lama yang dimiliki akun anonim (sebelum migrasi) tidak lagi bisa diakses pemohon — lihat §8.

---

## 6. Data Firestore

| Koleksi / dokumen      | Isi ringkas                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applications/{docId}` | `applicationId (VSV-APP-…)`, `ownerFirebaseUid`, `product`, `contractScheme`, data diri, `eligibility`, `fullCoverDetails`/`departureDetails`, `fundingNeeds`, `financialPlan` (+`pricingStatus`, jadwal angsuran, refund, referensi akad), `documents[]`, `driveFolderId`, `status`, `internalNotes`, `paidInstallments[]`, `userFinancingAcceptance`, `supportRequests[]`, `financialPlanHistory[]`, timestamps |
| `driveFolders/{uid}`   | `{ownerUid, folderId, folderName, stage: 'draft'\|'submitted', applicationId?}` — peta sesi → folder Drive                                                                                                                                                                                                                                                                                                        |
| `payments/{docId}`     | `{applicationId, ownerUid, type: INSTALLMENT\|CUSTOM, installmentNumber?, amount, description, status: PENDING\|PAID\|EXPIRED\|FAILED, invoiceId, invoiceUrl, expiresAt, paidAt, paidMethod, paidChannel}`                                                                                                                                                                                                        |

`firestore.rules` **deny-all** — semua baca/tulis via Admin SDK di server.

**Entri dokumen** (`applications.documents[]`): `{documentType, status: NOT_UPLOADED\|UPLOADED\|VERIFIED\|REVISION_REQUIRED, fileId?, fileName?, mimeType?, size?}` — `fileId` adalah ID Google Drive.

---

## 7. Perubahan & Pembaruan Dokumen

**Checklist wajib setiap ada perubahan kode:**

1. Perbarui bagian terkait di **file ini** (alur, tabel, pesan error, struktur Drive, status, route baru).
2. Perbarui **Tanggal terakhir diperbarui** di header.
3. Bila perubahan menyentuh infrastruktur/env: sinkronkan `AGENTS.md`, `FIREBASE_SETUP.md`, `LOCAL_BACKEND.md`, `XENDIT_SETUP.md`.
4. Sertakan pembaruan dokumen ini **dalam commit yang sama** dengan perubahan kode.

**Skenario yang wajib memicu pembaruan:** penambahan/penghapusan langkah form atau halaman dashboard · perubahan daftar dokumen/batas ukuran · perubahan struktur folder Drive atau mekanisme upload · perubahan status/label · perubahan alur pembayaran (Xendit) · perubahan auth/staf · perubahan action admin · perubahan pesan error yang tampil ke user · penambahan/penghapusan route.

---

## 8. Catatan Kondisi Saat Ini (Known Caveats)

Daftar ini **harus ikut diperbarui** saat caveat-nya diselesaikan:

1. **Form tanpa unggah dokumen** — semua dokumen diunggah setelah submit di `/dashboard/unggah-berkas`; pengajuan baru selalu mulai `NOT_UPLOADED`.
2. **Dokumen wajib (Dana Keberangkatan) tidak memblokir submit** — penanda `*` bersifat advisory; validasi server hanya berjalan untuk Full Cover (yang tidak punya dokumen wajib).
3. **Status dokumen admin tidak tampil ke pemohon** — hanya `UPLOADED` yang dihitung; `VERIFIED`/`REVISION_REQUIRED` tampil `Belum diunggah` di unggah-berkas.
4. **Ganti dokumen tidak menghapus file lama** di Drive (file lama tetap tersimpan di folder yang sama).
5. **Halaman demo/statis**: `riwayat` (ada disclaimer demo), `dokumen`, `notifikasi`, `bantuan` (FAQ non-fungsional), `layanan`, `vip`.
6. **Banner sukses/gagal pembayaran** di `/dashboard/pembayaran` hanya muncul bila parameter `?payment=` ada di URL (return URL Xendit saat ini tidak menyertakannya); andalkan `Segarkan`/webhook.
7. **Kuota daftar admin maks 100 pengajuan & 100 pembayaran terbaru** — pencarian dan filter berjalan di klien atas 100 pengajuan terbaru.
8. **Tahap 5 (Pencairan dana)** pada `Alur progress` tidak pernah jadi tahap `SEKARANG`.
9. **Tidak ada halaman login admin** — di production staf masuk lewat `Masuk dengan Google` di welcome `/` (dan di lokal bisa lewat `Masuk Admin`); allowlist & cookie tetap berlaku. `vworksofficial@gmail.com` dan `demo.admin@venturego.id` terdaftar di `isStaffEmail`.
10. **Record lama milik akun anonim tidak bisa diakses pemohon** setelah migrasi ke Google; admin masih melihatnya di `/admin`, tetapi tidak ada jalur klaim karena email anonim tidak tersimpan. Jangan hapus record tersebut.
11. **Kredensial akun demo ada di `src/lib/demo-accounts.json`** (`demo.user@venturego.id` / `UserDemo123!` dan `demo.admin@venturego.id` / `AdminDemo123!`), tetapi tombol `Masuk User` & `Masuk Admin` hanya ditampilkan di mode lokal (`NODE_ENV !== 'production'`). Di production (`NODE_ENV === 'production'`), halaman selamat datang hanya menampilkan 1 tombol `Masuk dengan Google`.
12. **Mode development terhubung langsung ke project Firebase Cloud di `.env.local`** (tanpa memerlukan emulator lokal). Untuk login Google di lokal, gunakan `http://localhost:3000` (akses ke `127.0.0.1` otomatis dialihkan ke `localhost` karena Firebase hanya mengizinkan domain `localhost` secara bawaan). Akun demo dibuat otomatis saat tombol `Masuk User` / `Masuk Admin` diklik atau melalui `node --env-file=.env.local scripts/seed-demo-accounts.mjs`.
13. Halaman 404 (`not-found`) masih berbahasa Inggris.

---

## 9. Peta File Sumber

| Area        | File                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Formulir    | `src/app/(frontend)/page.tsx`, `src/app/(frontend)/actions.ts`                                                                    |
| Dashboard   | `src/app/(frontend)/dashboard/**` (page + actions per halaman, `layout.tsx` guard akun)                                           |
| Admin       | `src/app/(frontend)/admin/**` (`page.tsx`, `admin-dashboard.tsx`, `finance-terms-fields.tsx`, `actions.ts`)                       |
| Auth        | `src/lib/auth-client.ts`, `src/lib/auth-shared.ts`, `src/lib/demo-accounts.{ts,json}`, `firebase-admin.ts`, `firebase-session.ts` |
| Seed demo   | `scripts/seed-demo-accounts.mjs`                                                                                                  |
| Upload API  | `src/app/api/applicant/uploads/route.ts`, `src/lib/upload-client.ts`                                                              |
| Drive       | `src/lib/gdrive.ts` (OAuth, folder, resumable, ticket HMAC)                                                                       |
| Dokumen     | `src/lib/documents.ts` (daftar slot, batas, validasi tanda tangan)                                                                |
| Pembayaran  | `src/lib/xendit.ts`, `src/app/api/webhooks/xendit/route.ts`, `dashboard/pembayaran/*`                                             |
| Firebase    | `src/lib/firebase-admin.ts`, `firebase-client.ts`, `firebase-session.ts`, `firebase-data.ts`                                      |
| Admin unduh | `src/app/api/admin/applications/[id]/documents/[index]/route.ts`                                                                  |
