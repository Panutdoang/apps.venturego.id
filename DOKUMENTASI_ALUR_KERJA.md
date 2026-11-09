# Dokumentasi Alur Kerja Aplikasi — VentureGo VSV

> **PENTING — Aturan pemeliharaan:** Dokumen ini adalah **satu-satunya rujukan resmi alur kerja aplikasi** (pengguna & admin). **Setiap perubahan apa pun pada aplikasi — fitur, alur, halaman, status, pesan error, struktur Google Drive, integrasi pembayaran — WAJIB disertai pembaruan dokumen ini di commit yang sama.** Jika menemukan ketidakcocokan antara kode dan dokumen ini, anggap kode sebagai perilaku lalu **perbaiki dokumen ini segera**.

Terakhir diperbarui: **9 November 2026** (Struktur Drive baru: root `VSV.VentureGo.id [database]`, folder draft merah `<Nama Pemohon> - <Nama LPK>`, folder siswa resmi hijau `<NIS> - <Nama Pemohon>` saat status `ACTIVE`, nama file standar `<Jenis> - <Nama Pemohon>`, scan KTP wajib di langkah Data Diri dengan baris unggah tombol + pratinjau nama berkas, halaman Profil memakai daftar opsi yang membuka sub-halaman terpisah (`/dashboard/profil/data-diri|dokumen|akad|keamanan|persetujuan|kartu|tentang`), termasuk sub-halaman baru Keamanan Akun, Kebijakan & Persetujuan, Kartu Identitas Siswa (dapat dicetak), dan Tentang Aplikasi; kartu Profil menampilkan email terdaftar di bawah nama; UI publik memakai istilah netral `database`/`penyimpanan berkas` — istilah Firebase/Firestore/Drive tidak ditampilkan ke publik, dan pesan error `gdrive.ts` ikut dinetralkan; **NIS hanya terbit saat pengajuan `ACTIVE`** — penerbitan saat buka halaman Profil dihapus, NIS lama tetap tampil; **menu admin baru `Angsuran Aktif`**, **`Jadwal Angsuran`**, dan **`Keringanan`** di sidebar (detail jadwal inline per siswa + tabel transaksi Xendit, serta review keringanan lintas siswa via `updateSupportRequest`), batas ambil data admin 500; **redesain penuh Slide-Over Drawer (`Kelola`)**: header dengan chip kode pengajuan & produk sejajar tombol `✕`, nama siswa tebal, meta `LPK | [bendera SVG] Negara`; navigasi **5 tab pill berikon** (`Profil & Kelayakan`, `Nominal Pengajuan`, `Berkas Dokumen`, `Draft Biaya & Akad`, `Status Persetujuan`); tab Profil 1 kartu 2 bagian dengan pratinjau KTP inline (`?inline=1`); tab Nominal Pengajuan menampilkan estimasi Wakalah & aksi `Setujui` / `Setujui dengan Nominal Baru` (skala proporsional Nafaqah & Ujrah + hitung ulang jadwal → `VERIFIED`) / `Tandai Disepakati` (`AGREED`); tab Berkas memakai 4 label status read-only (`Belum diunggah`, `Menunggu tinjauan`, `Sesuai`, `Tidak sesuai`), kolom aksi 3 ikon (pratinjau slide-over, hapus berkas dari Drive + ubah ke `Tidak sesuai`, tandai `Sesuai`); footer dihapus, tombol `Simpan Rincian Biaya` di tab Draft Biaya & Akad (`saveFinancialPlan`), serta `Status Pengajuan` & `Catatan Internal` pindah ke tab `Status Persetujuan` (`updateApplicationWorkflow`).)

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

| Route                                                                           | Fungsi                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                             | Welcome + form pengajuan; login Google dan routing staf/pemohon                                                                                                                                                                                 |
| `/dashboard`                                                                    | Beranda dashboard pemohon                                                                                                                                                                                                                       |
| `/dashboard/unggah-berkas`                                                      | Unggah/ganti dokumen pengajuan                                                                                                                                                                                                                  |
| `/dashboard/angsuran`                                                           | Rincian biaya, jadwal, persetujuan penawaran, keringanan                                                                                                                                                                                        |
| `/dashboard/pembayaran`                                                         | Bayar angsuran & pembayaran bebas via Xendit                                                                                                                                                                                                    |
| `/dashboard/{riwayat,dokumen,profil,bantuan,notifikasi,simulasi,layanan,vip}`   | Halaman aktivitas, dokumen, profil, notifikasi, simulasi, dan bantuan (terhubung ke data riil Firestore)                                                                                                                                        |
| `/dashboard/profil/{data-diri,dokumen,akad,keamanan,persetujuan,kartu,tentang}` | Sub-halaman menu Profil: data diri (lihat/ubah), PDF akad, info akad, keamanan akun (verifikasi/kata sandi), kebijakan & persetujuan, kartu identitas siswa (cetak), dan tentang aplikasi — header dengan tombol kembali ke `/dashboard/profil` |
| `/admin`                                                                        | Panel staf (tanpa halaman login; non-staf diarahkan ke `/`)                                                                                                                                                                                     |
| `POST /api/applicant/uploads`                                                   | Endpoint unggah dokumen (init + chunk) ke Google Drive                                                                                                                                                                                          |
| `GET /api/admin/applications/[id]/documents/[index]`                            | Unduh atau pratinjau (`?inline=1`) dokumen oleh staf (proxy Drive)                                                                                                                                                                              |
| `POST/GET /api/admin/applications/[id]/agreement`                               | Unggah/lihat PDF akad final oleh staf melalui Google Drive privat                                                                                                                                                                               |
| `GET /api/applicant/applications/[id]/agreement`                                | Unduh/lihat PDF akad pengajuan milik pemohon (token Firebase + verifikasi owner)                                                                                                                                                                |
| `POST/DELETE /api/admin/session`                                                | Buat/hapus cookie sesi staf                                                                                                                                                                                                                     |
| `POST /api/webhooks/xendit`                                                     | Webhook status pembayaran Xendit                                                                                                                                                                                                                |

---

## 2. Google Drive — Struktur & Efek

### 2.1 Struktur folder

Semua berkas siswa tersimpan di **akun Google pemilik aplikasi** (`vworksofficial@gmail.com`), kuota 15GB gratis akun tersebut. OAuth bertindak sebagai pemilik file, sehingga kuota service account (0 byte) tidak menjadi masalah.

```
My Drive (vworksofficial@gmail.com)
└── VSV.VentureGo.id [database]/               ← ROOT (sebelumnya `VentureGo Berkas`, di-rename in-place)
    ├── Budi Santoso - LPK Sakura/             ← folder DRAFT, warna MERAH (menunggu persetujuan)
    │   ├── KTP - Budi Santoso.pdf
    │   └── Pas Foto - Budi Santoso.jpg
    ├── VSV-0001-2026 - Budi Santoso/          ← siswa resmi (status ACTIVE): rename + warna HIJAU
    │   ├── KTP - Budi Santoso.pdf
    │   └── KK (Kartu Keluarga) - Budi Santoso.jpg
    └── Siti Rahayu - LPK Harapan/             ← pemohon lain (folder terpisah per Firebase UID)
```

- **Root** `VSV.VentureGo.id [database]`: dibuat otomatis oleh aplikasi di root My Drive (scope `drive.file` — aplikasi hanya melihat file buatannya sendiri). Bila yang ditemukan masih bernama lama `VentureGo Berkas`, aplikasi **mengganti namanya di tempat** (folder ID dan seluruh isi tetap sama) pada akses pertama. Override opsional via env `GDRIVE_ROOT_FOLDER_ID`.
- **Satu folder per Firebase UID**: folder dibuat sekali per UID (tidak dicari berdasarkan nama), dipetakan di `driveFolders/{uid}`, dan dipakai ulang untuk semua pengajuan UID tersebut — dua siswa dengan nama & LPK sama tidak pernah berbagi folder. Berkas selalu berupa file langsung di dalam folder (tanpa subfolder) agar verifikasi kepemilikan saat submit tetap berlaku.
- **Folder draft (warna MERAH `#ff0000`)**: `<Nama Pemohon> - <Nama LPK>` (mis. `Budi Santoso - LPK Sakura`) — dibuat saat unggahan pertama pemohon, `stage: 'draft'`. Folder tetap merah dengan nama ini setelah pengajuan terkirim.
- **Folder siswa resmi (warna HIJAU `#00ff00`)**: saat status pengajuan menjadi **`ACTIVE`**, server (a) menerbitkan **NIS** bila belum ada, (b) **me-rename** folder menjadi `<NIS> - <Nama Pemohon>` (mis. `VSV-0001-2026 - Budi Santoso`), (c) mengwarnai hijau, (d) me-rename seluruh berkas di dalamnya ke pola nama standar, dan (e) memperbarui mapping `stage: 'active'`. Promosi ini berjalan **sekali** (hanya pada transisi ke `ACTIVE`); perubahan status berikutnya tidak mengembalikan folder ke merah.
- **Unggahan susulan** (setelah pengajuan ada): langsung ke folder yang tercatat di `driveFolderId` aplikasi; folder dibuat bila belum ada (dengan nama & warna sesuai status aplikasi).
- **Nama file standar**: `<Jenis Dokumen> - <Nama Pemohon><ekstensi>` (mis. `KTP - Budi Santoso.pdf`, `Ijazah SMA - Budi Santoso.pdf`, `Akad Wakalah bil Ujrah - Budi Santoso.pdf`). Awalan `Scan ` dan bagian setelah `/` pada label dokumen dibuang; nama asli berkas dari pengguna tidak dipakai sebagai nama Drive.

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
| Scan KTP        | Wajib ada saat submit (2 produk)   | `Dokumen Scan KTP wajib diunggah.` / `Dokumen KTP siswa wajib diunggah.` |

### 2.4 Efek sisi Drive saat alur berjalan

| Aksi aplikasi                               | Efek di Google Drive                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unggahan pertama (sebelum submit)           | Folder draft `<Nama> - <LPK>` **merah** dibuat di root (bila belum ada)                                                                |
| Submit pengajuan **berhasil**               | Nama/warna folder **tidak berubah** (tetap draft merah); mapping `driveFolders` → `stage:'submitted'`                                  |
| Status pengajuan → **`ACTIVE`**             | Folder **di-rename** `<NIS> - <Nama>` + warna **hijau** + seluruh berkas di-rename pola `<Jenis> - <Nama>`; mapping → `stage:'active'` |
| Submit **gagal**                            | File yang baru terunggah **dihapus** otomatis (`discardDriveUploads`)                                                                  |
| Ganti dokumen di unggah-berkas              | File baru ditulis dengan nama `<Jenis> - <Nama Pemohon>`; **file lama tidak dihapus** oleh sistem (lihat §8)                           |
| Admin mengunggah PDF akad                   | File `Akad Wakalah bil Ujrah - <Nama Pemohon>.pdf` disimpan di folder pengajuan (versi lama tetap ada)                                 |
| Admin mengunduh dokumen                     | Stream dari Drive (`GET /api/admin/.../documents/[index]`), tidak ada URL publik                                                       |
| Akses kedaluwarsa (token OAuth kadaluwarsa) | Error 503 `Akses penyimpanan berkas kedaluwarsa. Silakan setujui ulang akses aplikasi.`                                                |

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

| Langkah                | Isi                                                                                                                                                                                                                                                                                                                                          | Catatan UI                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **0 — Selamat datang** | Header merek `Vworks Student Venture`, salam. Di **production**: hanya 1 tombol utama `Masuk dengan Google` + catatan `Akun baru akan dibuat secara otomatis saat pertama kali masuk.` Di **mode lokal (development)**: tombol `Masuk User` (`demo.user@venturego.id`), `Masuk Admin` (`demo.admin@venturego.id`), dan `Masuk dengan Google` | Staf → `/admin`, pemohon → `/dashboard`                                                             |
| **1 — Pilih produk**   | Dua kartu: **`VSV Full Cover`** (tag `Persiapan lengkap`) → `FULL_COVER`; **`VSV Dana Keberangkatan`** (tag `Tahap akhir`) → `DEPARTURE_BRIDGING`                                                                                                                                                                                            | Memilih produk membersihkan file terpilih                                                           |
| **2 — Kesiapan**       | Departure: checkbox pelatihan/lulus seleksi/paspor/kontrak + select `Status COE`, `Status visa`. Full Cover: checkbox pelatihan bahasa/paspor/orestu wali + select `Level bahasa Jepang`                                                                                                                                                     | Catatan lunak bila pelatihan belum selesai                                                          |
| **3 — Data diri**      | **Scan KTP (wajib)** di paling atas (pilih PDF/JPG/PNG maks 10 MB; nama berkas + ukuran tampil, berkas dikirim saat submit), Nama (ph `Sesuai KTP`), WA (`08xxxxxxxxxx`), agama, tempat/tanggal lahir, jenis kelamin, alamat KTP + alamat korespondensi + kode pos                                                                           | Tombol `Lanjut` terkunci sampai scan KTP dipilih; alamat korespondensi bisa disinkronkan dengan KTP |
| **4 — Program & dana** | Departure: LPK, negara, tanggal keberangkatan, sisa kewajiban LPK, nilai pembiayaan (Rp31/33/36/40 juta) + **simulasi langsung** (dana cair setelah admin 5%, ujrah 2,4%/bulan ×12, angsuran/bulan). Full Cover: LPK, negara, tanggal mulai, durasi bahasa & keterampilan, checkbox 7 kebutuhan                                              | Panel `Mengenal akad Wakalah bil Ujrah`                                                             |
| **6 — Tinjau & kirim** | Ringkasan produk + akad `Wakalah bil Ujrah`, daftar nilai (estimasi dana cair, total ujrah, biaya admin, total kewajiban, angsuran/bulan), **2 centang wajib** (paham akad + persetujuan data)                                                                                                                                               | Semua error server tampil di langkah ini (`<p class="error-message">`)                              |

**Catatan penting:** wizard **tidak memiliki langkah unggah dokumen tersendiri** (langkah 5 disembunyikan); satu-satunya unggahan di wizard adalah **scan KTP di langkah Data diri**, yang dikirim ke Google Drive bersamaan saat `Kirim pengajuan` (nama folder draft sudah tersedia karena nama & LPK sudah diisi). Slot dokumen lain selalu dimulai `NOT_UPLOADED` dan diunggah setelahnya di `/dashboard/unggah-berkas`. Bila pengguna sudah login (Google atau akun demo) lalu membuka `/` tanpa parameter form, aplikasi otomatis mengarahkan ke `/admin` (staf) atau `/dashboard` (pemohon); deep link `/?step=1` dan `/?apply=true` tetap membuka form.

**Efek Drive saat submit:**

- Berhasil → `router.replace('/dashboard?applicationSubmitted=1')`, dashboard menampilkan toast **`Pengajuan berhasil diajukan`** (hilang otomatis 5 detik). Record `applications` dibuat: `applicationId = VSV-APP-<8 karakter UUID huruf besar>`, `status: 'SUBMITTED'`, dokumen (termasuk entri KTP), rencana biaya `ESTIMATED`, dll. **Folder Drive tidak di-rename saat submit** — rename + warna hijau hanya terjadi saat status `ACTIVE` (§2.1). Bila pengguna sudah login (Google atau akun demo), submit langsung memakai sesi tersebut; bila belum login, submit membuka popup Google terlebih dahulu.
- Gagal → file yang baru terunggah dihapus dari Drive; pesan error ditampilkan di langkah tinjau.

**Pesan error server yang bisa tampil di langkah tinjau** (contoh utama): `Lengkapi nama, nomor WhatsApp, dan nama LPK.` · `Masukkan nomor WhatsApp Indonesia yang valid.` · `Persetujuan akad dan pemrosesan data wajib dicentang.` · `Isi perkiraan tanggal keberangkatan dengan format seperti 12 Februari 2026.` · `Lengkapi tempat dan tanggal lahir dengan format seperti 12 Februari 2000.` · `Dokumen Scan KTP wajib diunggah.` (Dana Keberangkatan) / `Dokumen KTP siswa wajib diunggah.` (Full Cover) · `Pengajuan belum dapat dikirim. Periksa koneksi lalu coba lagi.`

**Pesan error di langkah Data diri (klien):** `Scan KTP wajib diunggah sebelum melanjutkan.` · `Gunakan berkas PDF, JPG, atau PNG untuk scan KTP.` · `Ukuran scan KTP maksimal 10 MB.` · `Lengkapi nama pemohon dan nama LPK sebelum mengirim.` (dicek sebelum unggahan dimulai)

### 3.3 Dashboard pemohon

Semua halaman dashboard memerlukan **login Google atau akun demo (`Masuk User`)**. Tanpa sesi aplikasi → diarahkan ke `/` (welcome). Akun staf (`vworksofficial@gmail.com`, `demo.admin@venturego.id`, atau allowlist) → diarahkan ke `/admin`. Pemohon baru yang sudah login tetapi belum punya pengajuan tetap melihat **kartu ringkasan default** di beranda. Navigasi bawah: **Angsuran · Riwayat · Beranda · Unggah · Profil**.

Halaman **Angsuran**, **Riwayat**, **Unggah Berkas**, dan **Profil** tidak menampilkan header atas/tombol kembali maupun judul-subjudul halaman. Konten langsung dimulai di bawah tepi atas layar; navigasi bawah tetap tersedia. Sebaliknya, sub-halaman Profil (`/dashboard/profil/data-diri|dokumen|akad|keamanan|persetujuan|kartu|tentang`) memakai header standar dengan judul + tombol kembali ke `/dashboard/profil`.

#### Beranda `/dashboard`

- Sapaan `Selamat datang, <nama depan>` (dari nama pemohon atau nama akun Google; loading: `Memuat…`), lonceng → notifikasi (titik amber tampil bila ada pengajuan aktif).
- **Kartu ringkasan**: nominal (`Total kewajiban akad`/`Estimasi diajukan`), toggle sembunyikan nominal (`Rp••••••••`), **pil status**, progres bar `{paidCount} dari {total} angsuran lunas` + `Terbayar Rp…`, `Sisa angsuran: {total - paidCount} kali`, `Jatuh tempo berikutnya`; bila belum ada jadwal → `Berkas terunggah {x}/{y} ({verified} ✓)` + `Nomor pengajuan {VSV-APP-…}` (+ peringatan kuning bila ada dokumen berstatus `Perlu perbaikan`); bila biaya masih estimasi → `Rincian biaya sedang disusun dan diverifikasi tim VentureGo.`
- Saat sesi atau ringkasan Firestore sedang dimuat, nama akun, kartu ringkasan, badge progres, dan daftar tahap menampilkan skeleton pulse; tidak ada teks loading yang menggantikan susunan kartu.
- **Pengguna baru (sudah login Google) / tanpa pengajuan**: kartu ringkasan langsung tampil dengan nilai default — `Total angsuran terbayar` **Rp0**, progres 0% (`Belum ada pembayaran`, `Total kewajiban Rp0`), `Tenor` **0 bulan**, dan `Virtual Account` **0000000000000000**, dengan pil `Belum ada pengajuan`. CTA pengajuan tetap berada pada kartu `Ajukan Pembiayaan Baru` di bawah hero.
- **Alur progress saat ini** — 7 tahap: `Pengajuan → Verifikasi & kelayakan → Pengumpulan berkas online → Akad pembiayaan → Pencairan dana → Program angsuran → Pelunasan`, badge `Tahap {n}/7`, tahap aktif berchip `SEKARANG`; status tertutup (Ditolak/Dibatalkan) menampilkan catatan merah.
- Kartu `Ajukan Pembiayaan Baru` (→ `/?step=1`) dan `Layanan cepat` (Bayar angsuran, Simulasi, Ajukan baru, Bantuan, VIP).

#### Unggah berkas `/dashboard/unggah-berkas`

- Banner: `Unggah dokumen PDF, JPG, atau PNG. Maksimal 10 MB untuk setiap berkas.`
- Pemilih pengajuan bila >1 (`{VSV-APP-…} · {nama}`); dua grup: **Dokumen utama** dan **Dokumen pendukung**.
- Per slot: label (+ bintang merah untuk wajib), lencana status riil (`Sudah diunggah`, `Diverifikasi`, atau `Perlu perbaikan`), `{nama file} · {x,x} MB` atau `Belum diunggah`, tombol **`Unggah`** / **`Ganti`** / **`Perbaiki`** / `Mengunggah…` / `Belum aktif` (tanpa pengajuan).
- Sukses: `{label} berhasil diunggah.` (hijau) → daftar dimuat ulang. Gagal: pesan server / `Berkas belum dapat diunggah. Periksa koneksi lalu coba lagi.`
- **Efek Drive**: file baru masuk ke folder siswa (draft `<Nama> - <LPK>` merah, atau `<NIS> - <Nama>` hijau bila sudah `ACTIVE`) dengan nama `<Jenis> - <Nama Pemohon>`; entri `documents[index]` di Firestore diganti (status menjadi `UPLOADED`).

**Daftar dokumen per produk** (`src/lib/documents.ts`):

- **Dana Keberangkatan — 17 slot** (wajib ditandai `*`: Pas Foto, Scan KTP, Scan KK, Ijazah SD, SMP, SMA): Pas Foto · Scan KTP · Scan Akta Kelahiran · Scan KK · Ijazah SD/MI · Ijazah SMP/MTs/SLTP · Ijazah SMA/SMK/MA/SLTA · Scan Passport · _pendukung:_ Scan Surat Rekomendasi LPK · Scan Form Pendaftaran · Scan Surat Kesediaan Mengangsur · Scan Surat Mengetahui Orang Tua · Scan SKCK · Scan COE · Scan Kontrak Kerja · Scan KTP Orang Tua/Wali · Scan Surat Nikah Orang Tua.
- **Full Cover — 9 slot** (**KTP siswa wajib**, sisanya opsional): KTP siswa · Kartu Keluarga · Persetujuan orang tua · Rekomendasi LPK · Akta kelahiran · Ijazah terakhir · Bukti pendaftaran LPK · Rincian program pelatihan · Estimasi biaya LPK.

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

#### Halaman aktivitas, dokumen, notifikasi, profil, & pendukung

- **Riwayat** `/dashboard/riwayat`: menampilkan riwayat transaksi & aktivitas riil dari Firestore (`payments` Xendit, pengajuan `applications`, dan berkas `documents`) dengan filter interaktif `Semua`, `Pembayaran`, dan `Dokumen`.
- **Dokumen** `/dashboard/dokumen`: menampilkan arsip akad pembiayaan (`pricingStatus`, nilai kewajiban, referensi akad final), daftar berkas persyaratan yang telah diunggah beserta status verifikasinya (`Sudah diunggah`, `Diverifikasi`, `Perlu perbaikan`), serta daftar bukti pembayaran lunas (`payments` berstatus `PAID`).
- **Notifikasi** `/dashboard/notifikasi`: menghasilkan pemberitahuan riil dari data pengguna (pengingat jatuh tempo angsuran berikutnya, rincian biaya `VERIFIED` yang menunggu persetujuan, berkas `REVISION_REQUIRED` yang perlu diperbaiki, tanggapan permohonan keringanan dari staf, status invoice Xendit, dan status pengajuan) + tombol `Tandai sudah dibaca`.
- **Profil** `/dashboard/profil`: foto dari `Firebase Auth user.photoURL` (fallback avatar bila tidak tersedia), nama, **email terdaftar di akun ini** (teks email di bawah nama, dari `user.email`), **Nomor Induk Siswa VSV** (`VSV-{nomor urut 4 digit}-{tahun}`), dan **Status Akun** dari `emailVerified`. NIS diterbitkan satu kali per Firebase UID **hanya saat pengajuan mencapai status `ACTIVE`** (diacc admin) — sebelum itu tampil `Belum tersedia` + catatan "Terbit setelah pengajuan berstatus Aktif"; penerbitan otomatis saat membuka halaman Profil sudah dihapus (read-only `getStudentNumber`). NIS yang sudah pernah terbit (penerbitan lama) tetap tampil. Konten berupa **daftar opsi** (bukan tab/accordion) — tiap opsi membuka **sub-halaman terpisah** dengan header judul + tombol kembali ke `/dashboard/profil`:
  - `Data Diri` → `/dashboard/profil/data-diri`: data dari pengajuan terpilih (pemilih pengajuan bila ada beberapa), tombol `Ubah Data Diri`, form `Simpan`/`Batal`. Server memverifikasi ID token/provider, kepemilikan pengajuan, allowlist field, dan nilai. Perubahan hanya mengubah `applicantName`, `phone`, dan `personalDetails`; status, rincian biaya, serta catatan internal tidak dapat diedit pemohon. Data terkunci jika `pricingStatus: AGREED` atau status pengajuan `ACTIVE`/`COMPLETED`; pemohon diarahkan ke Pusat Bantuan untuk koreksi.
  - `Dokumen Saya` → `/dashboard/profil/dokumen`: menampilkan Akad Wakalah bil Ujrah PDF final jika biaya `AGREED` dan admin telah mengunggah PDF. Berkas berada di folder privat Drive; route unduh pemohon memverifikasi token dan `ownerFirebaseUid`, tanpa URL publik. Jika belum ada berkas, tampilkan penjelasan bahwa PDF belum tersedia.
  - `Akad Wakalah bil Ujrah` → `/dashboard/profil/akad`: informasi skema akad — penjelasan cara kerja (kuasa kepada VentureGo, penggunaan dana terverifikasi, makna Ujrah, nilai final mengikuti verifikasi), daftar istilah (`Nafaqah`, `Ujrah`, `Uang saku qardh`, `Total akad` = Nafaqah + Ujrah + qardh − refund), serta akses cepat: tautan ke Dokumen Saya (`/dashboard/profil/dokumen`), Rincian kewajiban & angsuran (`/dashboard/angsuran`), dan Simulasi pembiayaan (`/dashboard/simulasi`).
  - `Keamanan Akun` → `/dashboard/profil/keamanan`: kartu data akun (email, cara masuk Google/email-kata-sandi, status verifikasi email, tanggal daftar & terakhir masuk dari `user.metadata`), tombol `Kirim email verifikasi` (via `sendEmailVerification`) bila belum terverifikasi, dan untuk akun password tombol `Kirim tautan ubah kata sandi` (via `sendPasswordResetEmail`); akun Google menerima catatan bahwa kata sandi dikelola di Akun Google. Keberhasilan/galat ditampilkan sebagai notice di atas kartu.
  - `Kebijakan & Persetujuan` → `/dashboard/profil/persetujuan`: salinan persetujuan per pengajuan (pemilih pengajuan bila ada beberapa) — `Paham akad Wakalah bil Ujrah` dan `Persetujuan pemrosesan data` (dibaca dari `understandsWakalah`/`acceptsDataProcessing` via `getUserActivityFeed`) beserta tanggal pengajuan, plus ringkasan kebijakan pemrosesan data (database privat, penyimpanan berkas privat, email untuk verifikasi/kontak, kanal koreksi/hapus via email layanan — tanpa istilah teknis).
  - `Kartu Identitas Siswa` → `/dashboard/profil/kartu`: kartu visual gradien utama berisi NIS (baca-saja via `getStudentNumber`; `Belum tersedia` bila belum diterbitkan), nama, LPK, program (produk + destinasi), status pengajuan, nomor aplikasi, dan `venturego.id`; tombol `Cetak kartu` memakai `window.print()` dengan rule `@media print` di `styles.css` yang hanya menampilkan `#student-card`.
  - `Tentang Aplikasi` → `/dashboard/profil/tentang`: kartu identitas aplikasi (nama VSV — Vworks Student Venture, tagline) + baris situs `venturego.id`, email layanan, skema Wakalah bil Ujrah, basis data aplikasi (istilah netral), dan baris hak cipta.
  - `Pusat Bantuan` → `/dashboard/bantuan`: FAQ interaktif (termasuk FAQ profil: perbarui data diri, data terkunci, kapan PDF akad tersedia) dan kontak email layanan; permohonan keringanan tetap dilakukan melalui halaman Angsuran.
  - Tombol `Keluar` berada di bagian bawah halaman Profil (profil sendiri tetap tanpa header atas). Skeleton loading mengikuti struktur konten masing-masing halaman.
- Saat data halaman-halaman tersebut dimuat, skeleton kartu/baris menggantikan teks `Memuat…`; bentuk skeleton mengikuti struktur konten yang akan tampil setelah data tersedia.
- **Bantuan** `/dashboard/bantuan`: FAQ interaktif (buka/tutup jawaban, termasuk FAQ profil: data diri, data terkunci, PDF akad) + tautan ke permohonan keringanan dan email layanan; juga menjadi tujuan opsi `Pusat Bantuan` di menu Profil.
- **Simulasi** `/dashboard/simulasi`: kalkulator klien (Rp31/33/36/40 juta → Nafaqah, ujrah 2,4%×12, total kewajiban, tenor 12 bulan) — catatan `Hasil ini merupakan simulasi. Nilai akhir mengikuti verifikasi program, kebutuhan, dan akad pembiayaan.`
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
    6. **`Angsuran Aktif`** — daftar siswa yang sedang mengangsur **atau** masih memiliki tanggungan (status `ACTIVE`, sisa kewajiban > 0, atau masih ada cicilan belum lunas): 4 kartu KPI (`Siswa dengan Tanggungan`, `Total Sisa Kewajiban`, `Terlambat Bayar`, `Jatuh Tempo ≤ 7 Hari` + jumlah permohonan keringanan terbuka), filter chip `Semua`/`Terlambat`/`Jatuh tempo`/`Berjalan`, tabel desktop 10 kolom (`ID Pengajuan`, `Nama Siswa`, `LPK Mitra`, `Status`, `Total Kewajiban`, `Terbayar`, `Sisa & Progres`, `Jatuh Tempo` + badge `Terlambat N hr`/`≤7 hari`, `Keringanan`, `Aksi Rincian` → menu `Jadwal Angsuran`), dan daftar kartu pada layar `< lg`. Badge sidebar amber bila ada keterlambatan.
    7. **`Jadwal Angsuran`** — daftar siswa berjadwal cicilan (ID pengajuan, nama, badge status, meta LPK/tenor/progres lunas, badge `Terlambat N hr`, sisa kewajiban, jatuh tempo) dengan tombol `Detail`/`Tutup` yang membuka panel inline per siswa: 4 kartu KPI (`Total Kewajiban Akad`, `Total Terbayar`, `Sisa Kewajiban`, `Cicilan Berikutnya` + badge keterlambatan), tabel cicilan (jatuh tempo, nominal, sisa, status `Lunas`/`Terlambat`/`Belum dibayar`), dan tabel transaksi Xendit berlabel status. Badge sidebar menampilkan jumlah siswa berjadwal.
    8. **`Keringanan`** — 2 kartu KPI (`Menunggu Tinjauan` berwarna amber bila ada `OPEN`, `Ditinjau`) + tabel permohonan keringanan lintas siswa (`Siswa`, `Waktu`, `Pesan`, select `Status` (`Menunggu tinjauan`/`Ditinjau`), input `Tanggapan` maks 1000 karakter, tombol `Simpan` yang aktif hanya bila ada perubahan) — menyimpan via Server Action `updateSupportRequest` lalu `router.refresh()`. Badge sidebar amber bila ada permohonan `OPEN`.
    9. **`Statistik`** — analitik portofolio produk/negara tujuan & tabel rekapitulasi per **LPK Mitra**
    10. **`Log Audit`** — tabel riwayat perubahan rincian biaya (`financialPlanHistory`) lintas pengajuan
  - Bagian bawah sidebar: email staf aktif, tombol `Segarkan`, dan `Keluar`.
- **Pencarian & Filter Atas (Sticky Header):** pencarian instan (`applicationId`, nama siswa, nomor WA, nama LPK), filter produk (`Semua Produk` / `Dana Keberangkatan` / `Full Cover`), dan filter status pengajuan (11 status).
- **Tombol aksi tabel:** seluruh tabel memakai satu komponen `DrawerAction` berukuran & fokus konsisten dengan panah kanan — `Kelola` (Dashboard/Pengajuan → tab Profil), `Biodata`/`Berkas` (Data Siswa), `Susun Akad` (Draft & Akad, varian primer), `Rincian` (Angsuran & Kas, Angsuran Aktif → menu `Jadwal Angsuran` + buka detail siswa terkait), `Detail` (Log Audit → tab `Draft Biaya & Akad`).
- **Slide-Over Drawer (`ApplicationDrawerForm`):**
  - Saat tombol aksi diklik pada baris tabel, drawer kanan (`max-w-4xl`, tinggi penuh) terbuka berurutan:
    - **Header identitas:** baris atas berisi chip kode pengajuan (`applicationId`) dan chip produk (`VSV Dana Keberangkatan` / `VSV Full Cover`) berukuran seragam sejajar tombol tutup `✕`; di bawahnya nama siswa berukuran besar (`text-2xl font-extrabold`) serta meta `LPK Mitra | [Bendera SVG] Jepang/Turki` (tanpa nomor telepon dan tanpa badge status/biaya/folder di header). Banner error/berhasil juga ditampilkan langsung di dalam header drawer.
    - **Baris 5 tab dalam kotak pill berikon SVG** (`bg-slate-100 p-1.5 rounded-xl`; tab aktif `bg-[#17158c] text-white`, inaktif teks slate dengan hover putih):
      1. **`Profil & Kelayakan`** — 1 kartu terpadu dengan 2 bagian: bagian atas menampilkan pratinjau KTP pemohon (`iframe` PDF atau `img` lewat `?inline=1` + tautan unduh) berdampingan dengan biodata & kontak lengkap; bagian bawah menampilkan Program LPK & Kesiapan Keberangkatan.
      2. **`Nominal Pengajuan`** — kartu ringkasan (`Nominal Diajukan`, `Sisa Kewajiban LPK`/`Status Biaya`, `Total Kewajiban Akad`), tabel `Estimasi Wakalah (Sistem)` (principal, ujrah 2,4%/bln, ujrah × 12, biaya admin 5%, pencairan bersih, total estimasi), ringkasan `Rincian Biaya Saat Ini` berbadge status biaya, serta bagian `Persetujuan Biaya` (`Setujui`, `Setujui dengan Nominal Baru`, dan `Tandai Disepakati`).
      3. **`Berkas Dokumen`** (dengan badge hitung `terunggah/total`) — bar ringkasan (`Terunggah`, `Menunggu tinjauan`, `Sesuai`, `Tidak sesuai`) dan tabel dokumen 5 kolom (`No`, `Dokumen` + nama/ukuran berkas, `Kategori`, `Status` berupa badge read-only, serta kolom `Aksi` berisi 3 tombol ikon: **Pratinjau** mata, **Hapus berkas** tempat sampah, dan **Tandai sesuai** centang). Klik ikon pratinjau membuka **slide-over pratinjau berkas (`z-[60]`)** di atas drawer lengkap dengan tombol `Hapus Berkas`, `Tandai Sesuai`, dan tutup `✕`.
      4. **`Draft Biaya & Akad`** — editor rincian Nafaqah/Ujrah, qardh, jadwal angsuran, refund, referensi akad final, catatan penyelesaian (`FinanceTermsFields`), serta tombol submit `Simpan Rincian Biaya` di bagian bawah tab.
      5. **`Status Persetujuan`** — kartu kontrol `Status Pengajuan` (11 status) + `Catatan Internal` + tombol `Simpan Status & Catatan`, diikuti kartu `Persetujuan Siswa atas Penawaran`, `Referensi Akad Final`, dan unggah/lihat `PDF Akad Wakalah bil Ujrah`.
    - **Tanpa footer tetap:** seluruh aksi disimpan secara kontekstual pada tab masing-masing.

### 4.3 Review & Aksi Server Actions di Slide-Over Drawer

Pengelolaan pengajuan di Slide-Over Drawer dipisah menjadi Server Actions spesifik sesuai konteks tab:

| Server Action                                          | Tab / lokasi         | Fungsi & perilaku                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approveApplicationPricing(docId, newNominal \| null)` | `Nominal Pengajuan`  | Menyetujui rincian biaya menjadi `Terverifikasi` (`VERIFIED`). Bila `newNominal` diisi (untuk Dana Keberangkatan wajib `<= requestedFinancingAmount`), baris Nafaqah & Ujrah diskalakan proporsional (dengan koreksi pembulatan pada baris positif terakhir) agar total kewajiban sama dengan `newNominal`, lalu jadwal angsuran dihitung ulang otomatis. Bila rincian Nafaqah/Ujrah belum pernah diisi pada pengajuan Dana Keberangkatan, sistem menginisialisasi baris default dari nominal pengajuan dan tenor 12 bulan. |
| `setApplicationPricingAgreed(docId)`                   | `Nominal Pengajuan`  | Mengunci status biaya menjadi `Disepakati` (`AGREED`) setelah memverifikasi kelengkapan rincian, adanya persetujuan pemohon (`userFinancingAcceptance.acceptedAt`) yang cocok dengan `offerSnapshot` terbaru, serta terisinya `finalAgreementReference`.                                                                                                                                                                                                                                                                    |
| `approveApplicationDocument(docId, documentIndex)`     | `Berkas Dokumen`     | Mengubah status slot dokumen yang sudah memiliki `fileId` menjadi `VERIFIED` (**Sesuai**).                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `deleteApplicationDocument(docId, documentIndex)`      | `Berkas Dokumen`     | Menghapus berkas dokumen dari Google Drive (`deleteDriveFile` secara best-effort), membersihkan metadata `fileId`/`fileName`/`mimeType`/`size` pada slot dokumen, dan mengubah status slot menjadi `REVISION_REQUIRED` (**Tidak sesuai**) agar pemohon mengunggah ulang.                                                                                                                                                                                                                                                    |
| `saveFinancialPlan(docId, financialValues)`            | `Draft Biaya & Akad` | Menyimpan rincian Nafaqah, Ujrah, qardh, jadwal angsuran, refund, referensi akad final, dan catatan penyelesaian tanpa mengubah `pricingStatus` saat ini; memperbarui `offerSnapshot` bersarang dan `financialPlanHistory`. Bila `offerSnapshot` berubah, `userFinancingAcceptance` dihapus agar pemohon menyetujui ulang.                                                                                                                                                                                                  |
| `updateApplicationWorkflow(docId, status, notes)`      | `Status Persetujuan` | Memperbarui `status` pengajuan (11 status) dan `internalNotes` (maks 2.000 karakter). Memvalidasi syarat pembatalan (`CANCELLED` pada biaya `AGREED` wajib memiliki `settlementNotes`) dan menjalankan penerbitan NIS + promosi folder Drive ke hijau saat transisi ke `ACTIVE`.                                                                                                                                                                                                                                            |
| `updateSupportRequest(docId, requestIndex, status, …)` | Menu `Keringanan`    | Memperbarui status (`OPEN`/`REVIEWED`) dan tanggapan staf (maks 1.000 karakter) untuk permohonan keringanan pemohon.                                                                                                                                                                                                                                                                                                                                                                                                        |

**4 label status dokumen di admin:** `NOT_UPLOADED` **Belum diunggah** · `UPLOADED` **Menunggu tinjauan** · `VERIFIED` **Sesuai** · `REVISION_REQUIRED` **Tidak sesuai**.

**Field rincian biaya:**

- **Full Cover** (hanya Jepang yang bisa diverifikasi): `Nafaqah`, `Ujrah`, `Ju'alah (jika COE terbit)`, `Tenor setelah keberangkatan (1–36 bulan)` + ringkasan hitung otomatis.
- **Dana Keberangkatan**: editor baris **Rincian Nafaqah** (`Komponen`, `Penerima pembayaran`, `Nominal`, `Referensi bukti pembayaran`, maks 20 baris) dan **Rincian Ujrah**; `Uang saku qardh` (+ centang `Sudah diserahkan kepada pemohon`), `Jumlah angsuran (1–36)`, `Tanggal angsuran pertama`, `Refund/potongan` + bukti, `Referensi akad final yang sudah ditandatangani`, `Catatan penyelesaian`. Total live: `Nafaqah + Ujrah + qardh − refund`.

**Aturan bisnis penting saat `Simpan`** (semua memblokir dengan pesan spesifik):

- `Terverifikasi` (biaya) mensyaratkan minimal 1 baris Nafaqah berlabel+berpenerima+berbukti, minimal 1 baris Ujrah, jadwal angsuran valid (1–36×, tanggal pertama **bulan setelah perkiraan keberangkatan**), dan bukti bila refund > 0.
- `Disepakati` mensyaratkan **persetujuan pemohon tercatat** (tombol di halaman angsuran) **dan** referensi akad final yang cocok dengan penawaran terbaru. Mengubah penawaran **menghapus persetujuan pemohon** (haru disetujui ulang).
- Full Cover hanya bisa `Terverifikasi`/`Disepakati` untuk tujuan **Jepang**; `ju'alah` diset `COE_ISSUED`, `paymentStartCondition` `AFTER_DEPARTURE`.
- Pembatalan wajib mencatat perhitungan Nafaqah & refund sebelum `Dibatalkan`.
- Setiap simpan menambah `financialPlanHistory` (20 terakhir) + `updatedBy`/`updatedAt`.
- **PDF akad final:** setelah `pricingStatus: AGREED`, staf dapat mengunggah PDF bertanda tangan melalui tab Persetujuan & Akad. Server membatasi PDF maksimal 4 MB, memeriksa signature berkas, menyimpan ke folder Drive privat pengajuan dengan nama `Akad Wakalah bil Ujrah - <Nama Pemohon>.pdf`, lalu menambahkan metadata `agreementPdf` ke aplikasi. Penggantian PDF mengaitkan file baru ke aplikasi (file lama tetap ada); akses download tetap melalui route terautentikasi.
- **Transisi ke `ACTIVE`:** saat status pengajuan diubah ke `ACTIVE` (sekali, pada transisi), server menerbitkan **NIS** bila belum ada, me-rename folder Drive jadi `<NIS> - <Nama Pemohon>` berwarna **hijau**, me-rename seluruh berkas di folder ke pola `<Jenis> - <Nama Pemohon>`, dan memperbarui mapping `driveFolders` menjadi `stage: 'active'`. Bila pemohon belum pernah unggah (folder tidak ada), hanya NIS yang diterbitkan. Operasi Drive bersifat terbaik-usaha dan tidak menggagalkan simpan status.

**Pesan error umum action**: `Pilih status pengajuan yang valid.` · `Catatan internal maksimal 2.000 karakter.` · `Dokumen belum memiliki berkas untuk diverifikasi.` · `Status Disepakati memerlukan persetujuan pemohon dan referensi akad final yang telah ditandatangani.` · `Total kewajiban harus sama dengan Nafaqah ditambah Ujrah.` · `Tanggal angsuran pertama harus berada pada bulan setelah perkiraan keberangkatan…` · `Status belum dapat disimpan. Coba lagi.`

### 4.4 Efek lintas sisi (admin → pemohon → Drive)

| Aksi admin                                             | Efek ke pemohon (UI)                                                                                                                | Efek ke Drive                                                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ubah **Status pengajuan**                              | Pil status + tahap `Alur progress` di beranda berubah (mis. `DOCUMENT_REVIEW` → tahap 3 + chip `SEKARANG`)                          | Ke **`ACTIVE`**: folder Drive di-rename `<NIS> - <Nama>` + warna hijau + rename berkas (§2.1); status lain: tidak ada |
| Tandai dokumen **Sesuai** (`VERIFIED`)                 | Di `/dashboard/unggah-berkas`, `/dashboard/dokumen`, `/dashboard/notifikasi`, dan `/dashboard` langsung tampil status terverifikasi | Tidak ada (hanya status Firestore)                                                                                    |
| Hapus berkas dokumen (`deleteApplicationDocument`)     | Slot dokumen kembali tanpa berkas dengan status `Perlu perbaikan` (`Tidak sesuai` di admin); pemohon diminta mengunggah ulang       | Berkas dihapus dari Google Drive (`deleteDriveFile` best-effort)                                                      |
| `Status biaya` → `Terverifikasi`                       | Halaman angsuran menampilkan rincian + tombol `Saya menyetujui rincian terverifikasi`                                               | Tidak ada                                                                                                             |
| `Status biaya` → `Disepakati` (setelah pemohon setuju) | Catatan hijau `Akad final tercatat disepakati…`; jadwal & total terkunci                                                            | Tidak ada                                                                                                             |
| Tanggapi permohonan keringanan                         | Tampil `Tanggapan tim: …` di halaman angsuran                                                                                       | Tidak ada                                                                                                             |
| Unggah PDF akad final                                  | Profil → Dokumen Saya menampilkan pratinjau/unduhan setelah PDF tersedia                                                            | File PDF disimpan privat di Drive                                                                                     |
| Pemohon memperbarui data pribadi                       | Data pengajuan terpilih diperbarui setelah validasi; status dan rincian biaya tetap terlindungi                                     | Tidak ada                                                                                                             |
| Unduh dokumen                                          | —                                                                                                                                   | Stream dari Drive (tanpa URL publik)                                                                                  |
| Ubah jadwal/biaya baru                                 | Persetujuan pemohon lama **dihapus** → tombol persetujuan muncul lagi                                                               | Tidak ada                                                                                                             |

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

| Koleksi / dokumen                       | Isi ringkas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applications/{docId}`                  | `applicationId (VSV-APP-…)`, `ownerFirebaseUid`, `product`, `contractScheme`, data diri, `eligibility`, `fullCoverDetails`/`departureDetails`, `fundingNeeds`, `financialPlan` (+`pricingStatus`, jadwal angsuran, refund, referensi akad), `agreementPdf?` (`fileId`, `fileName`, `mimeType`, `size`, `uploadedAt`, `uploadedBy`, `agreementReference` snapshot), `applicantProfileUpdatedAt?`, `documents[]`, `driveFolderId`, `status`, `internalNotes`, `paidInstallments[]`, `userFinancingAcceptance`, `supportRequests[]`, `financialPlanHistory[]`, timestamps |
| `driveFolders/{uid}`                    | `{ownerUid, folderId, folderName, stage: 'draft'\|'submitted'\|'active', applicationId?}` — peta sesi → folder Drive (satu folder per UID; `active` setelah promosi `ACTIVE`)                                                                                                                                                                                                                                                                                                                                                                                          |
| `payments/{docId}`                      | `{applicationId, ownerUid, type: INSTALLMENT\|CUSTOM, installmentNumber?, amount, description, status: PENDING\|PAID\|EXPIRED\|FAILED, invoiceId, invoiceUrl, expiresAt, paidAt, paidMethod, paidChannel}`                                                                                                                                                                                                                                                                                                                                                             |
| `studentProfiles/{uid}`                 | `{ownerFirebaseUid, studentNumber, issuedAt}` — Nomor Induk Siswa VSV permanen yang terikat ke Firebase UID                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `systemCounters/{student-numbers-YYYY}` | `{year, lastIssued, updatedAt}` — counter transaksional tahunan untuk menerbitkan NIS unik berurutan (`VSV-0001-YYYY`)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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

1. **Wizard hanya memuat scan KTP** — scan KTP wajib dipilih di langkah Data diri dan diunggah ke Drive bersamaan saat submit; dokumen lain diunggah setelah submit di `/dashboard/unggah-berkas` dan pengajuan baru selalu memulai slot lain `NOT_UPLOADED`.
2. **Hanya Scan KTP yang memblokir submit** — penanda `*` pada dokumen wajib lain (Pas Foto, KK, Ijazah) tetap advisory dan diverifikasi staf setelahnya. Validasi server mengwajibkan KTP di kedua produk (`Dokumen Scan KTP wajib diunggah.` / `Dokumen KTP siswa wajib diunggah.`); pengecekan `required` lama hanya berjalan untuk Full Cover.
3. **Ganti dokumen tidak menghapus file lama** di Drive (file lama tetap tersimpan di folder yang sama).
4. **Halaman VIP (`/dashboard/vip`)** masih berupa placeholder `SEDANG DIKEMBANGKAN`.
5. **Banner sukses/gagal pembayaran** di `/dashboard/pembayaran` hanya muncul bila parameter `?payment=` ada di URL (return URL Xendit saat ini tidak menyertakannya); andalkan `Segarkan`/webhook.
6. **Kuota daftar admin maks 500 pengajuan & 500 pembayaran terbaru** — pencarian dan filter berjalan di klien atas 500 pengajuan terbaru.
7. **Tahap 5 (Pencairan dana)** pada `Alur progress` tidak pernah jadi tahap `SEKARANG`.
8. **Tidak ada halaman login admin** — di production staf masuk lewat `Masuk dengan Google` di welcome `/` (dan di lokal bisa lewat `Masuk Admin`); allowlist & cookie tetap berlaku. `vworksofficial@gmail.com` dan `demo.admin@venturego.id` terdaftar di `isStaffEmail`.
9. **Record lama milik akun anonim tidak bisa diakses pemohon** setelah migrasi ke Google; admin masih melihatnya di `/admin`, tetapi tidak ada jalur klaim karena email anonim tidak tersimpan. Jangan hapus record tersebut.
10. **Kredensial akun demo ada di `src/lib/demo-accounts.json`** (`demo.user@venturego.id` / `UserDemo123!` dan `demo.admin@venturego.id` / `AdminDemo123!`), tetapi tombol `Masuk User` & `Masuk Admin` hanya ditampilkan di mode lokal (`NODE_ENV !== 'production'`). Di production (`NODE_ENV === 'production'`), halaman selamat datang hanya menampilkan 1 tombol `Masuk dengan Google`.
11. **NIS hanya diterbitkan saat pengajuan menjadi `ACTIVE`** (diacc admin) melalui transaksi Firestore pada `studentProfiles` dan `systemCounters` — dipanggil eksplisit di aksi staf saat transisi ke `ACTIVE` dan oleh promosi folder Drive; penerbitan otomatis saat membuka halaman Profil/Kartu dihapus (read-only). NIS lama yang sudah terbit tetap tampil. Tidak perlu migrasi massal dokumen pengajuan; nomor yang sudah diterbitkan tetap sama untuk UID tersebut.
12. **PDF akad final belum tersedia sampai staf mengunggah dokumen bertanda tangan** dari tab Persetujuan & Akad di `/admin` setelah biaya berstatus `Disepakati`.
13. **Mode development terhubung langsung ke project Firebase Cloud di `.env.local`** (tanpa memerlukan emulator lokal). Untuk login Google di lokal, gunakan `http://localhost:3000` (akses ke `127.0.0.1` otomatis dialihkan ke `localhost` karena Firebase hanya mengizinkan domain `localhost` secara bawaan). Akun demo dibuat otomatis saat tombol `Masuk User` / `Masuk Admin` diklik atau melalui `node --env-file=.env.local scripts/seed-demo-accounts.mjs`.
14. **Mengganti PDF akad mengaitkan file baru ke aplikasi; file versi sebelumnya tidak dihapus dari Google Drive** agar arsip lama tidak terhapus. Karena nama file kini standar (`Akad Wakalah bil Ujrah - <Nama Pemohon>.pdf`), versi lama dan baru dapat bernama sama dan dibedakan oleh waktu ubah di Drive.
15. **Folder & file lama tidak dimigrasi massal** — hanya root yang di-rename in-place; folder draft lama (format `<Nama> · <uid6>`) dan nama file lama tetap seperti aslinya sampai pengajuan terkait mencapai `ACTIVE` (saat itu folder di-rename `<NIS> - <Nama>`, diwarnai hijau, dan seluruh file di dalamnya ikut di-rename ke pola standar).
16. Halaman 404 (`not-found`) masih berbahasa Inggris.

---

## 9. Peta File Sumber

| Area               | File                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formulir           | `src/app/(frontend)/page.tsx`, `src/app/(frontend)/actions.ts`                                                                                                                                            |
| Dashboard          | `src/app/(frontend)/dashboard/**` (page + actions per halaman, `layout.tsx` guard akun)                                                                                                                   |
| Admin              | `src/app/(frontend)/admin/**` (`page.tsx`, `admin-dashboard.tsx`, `finance-terms-fields.tsx`, `actions.ts`)                                                                                               |
| Auth               | `src/lib/auth-client.ts`, `src/lib/auth-shared.ts`, `src/lib/demo-accounts.{ts,json}`, `firebase-admin.ts`, `firebase-session.ts`                                                                         |
| Seed demo          | `scripts/seed-demo-accounts.mjs`                                                                                                                                                                          |
| Upload API         | `src/app/api/applicant/uploads/route.ts`, `src/lib/upload-client.ts`                                                                                                                                      |
| Drive              | `src/lib/gdrive.ts` (OAuth, root & warna folder, resumable, ticket HMAC), `src/lib/drive-folders.ts` (nama/warna folder draft & resmi, promosi `ACTIVE`), `src/lib/student-number.ts` (NIS transaksional) |
| Dokumen            | `src/lib/documents.ts` (daftar slot, batas, validasi tanda tangan, indeks KTP, pola nama file `<Jenis> - <Nama Pemohon>`)                                                                                 |
| Pembayaran         | `src/lib/xendit.ts`, `src/app/api/webhooks/xendit/route.ts`, `dashboard/pembayaran/*`                                                                                                                     |
| Firebase           | `src/lib/firebase-admin.ts`, `firebase-client.ts`, `firebase-session.ts`, `firebase-data.ts`                                                                                                              |
| Admin/Pemohon akad | `src/app/api/admin/applications/[id]/agreement/route.ts`, `src/app/api/applicant/applications/[id]/agreement/route.ts`                                                                                    |
| Admin unduh berkas | `src/app/api/admin/applications/[id]/documents/[index]/route.ts`                                                                                                                                          |
