# Panduan Desain VentureGo VSV

> Acuan tampilan seluruh app. **Halaman acuan: dashboard siswa (`/dashboard`)** dan halaman awal
> (`/`). Halaman baru atau yang diubah mengikuti pola di sini. Token warna ada di
> `src/app/(frontend)/styles.css` (`:root`).

## Arah

Cerah dan ramah seperti aplikasi Google (Material 3), tapi tetap terasa **aman dan terpercaya**
seperti aplikasi keuangan: biru terang di atas, makin tua ke bawah; latar putih bersih.

## Warna

| Token                                        | Nilai                             | Dipakai untuk                             |
| -------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `--primary`                                  | `#0b57d0`                         | Teks/ikon aksen, tombol solid, tautan     |
| `--primary-soft`                             | `#e8f0fe`                         | Latar chip/badge biru muda                |
| `--accent`                                   | `#4285f4`                         | Aksen sekunder                            |
| `--hero-top` → `--hero-mid` → `--hero-deep`  | `#4285f4` → `#1a73e8` → `#0b57d0` | Gradasi brand                             |
| `--hero-depth`                               | `#0842a0`                         | Bagian tergelap gradasi, hover            |
| `--hero-glow`                                | `#c2e7ff`                         | Cahaya lembut, teks sekunder di atas biru |
| `--dot-green` / `--dot-yellow` / `--dot-red` | `#6dd58c` / `#fdd663` / `#f28b82` | Hanya aksen kecil (satelit orbit)         |
| `--welcome-body`                             | `#444746`                         | Teks paragraf di halaman awal             |

- **Jangan** menulis hex biru langsung di komponen; pakai `var(--primary)` atau kelas di bawah.
- Bayangan biru memakai `rgba(11, 87, 208, α)`.
- Bagian putih tetap putih (`#fff`) — jangan diberi warna.
- Teks di atas gradasi biru: **putih + bayangan halus** `rgba(8, 40, 110, …)`, kontras minimal
  **4,5 : 1** (WCAG AA). Hindari teks biru muda (`--hero-glow`) untuk tulisan kecil — kontrasnya
  hanya ±3,3 : 1.

## Gradasi (kelas siap pakai)

| Kelas           | Untuk                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `brand-surface` | Bidang besar: header dashboard                                             |
| `brand-card`    | Kartu biru (mis. "Ajukan Pembiayaan Baru", Simulasi, Bantuan, Kartu Siswa) |
| `brand-fill`    | Elemen kecil terisi biru (tombol aktif navigasi bawah)                     |

Tombol biasa tetap solid `bg-[var(--primary)]`; gradasi hanya untuk bidang yang menonjol.

## Font

- Halaman awal & layar loading: **Google Sans** (cadangan: Plus Jakarta Sans) lewat
  `var(--welcome-font)`.
- Dashboard: judul **Plus Jakarta Sans**, isi **Inter** — sudah sesuai, jangan diubah.

## Gerak & interaksi

- **Orbit**: logo roket + cincin + tiga satelit (`OrbitMark` di `_components/orbit-mark.tsx`).
- **Loading**: `RocketLoader` untuk masuk/arah-ulang dan cek sesi; skeleton tetap dipakai saat
  memuat data di dalam halaman.
- **Tombol utama**: efek tekan ala Google — mengecil sedikit, lapisan terang, riak dari titik
  sentuh (`triggerRipple`).
- Selalu hormati `prefers-reduced-motion` (animasi dimatikan).
