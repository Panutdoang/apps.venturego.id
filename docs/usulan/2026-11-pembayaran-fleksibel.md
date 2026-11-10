# Usulan: Pembayaran Fleksibel & Perbaikan Pencatatan Sisa Kewajiban

> **Untuk:** Panut · **Dari:** Adam Doni · **Tanggal:** 10 November 2026
> **Status:** usulan — belum ada kode aplikasi yang diubah. Keputusan desain & implementasi
> tetap di Panut. Bila disetujui, perubahan kode wajib disertai pembaruan
> `DOKUMENTASI_ALUR_KERJA.md` (§3.3 Pembayaran, §6 Data, §8 Caveats) di commit yang sama.

## 1. Tujuan bisnis

Pembayaran memang sengaja dibuat fleksibel supaya siswa bisa cepat lunas:

1. **Minimal** = tanggungan yang sedang jatuh tempo.
2. **Boleh lebih** — 2–3 bulan sekaligus, sebagian besar, atau langsung lunas.
3. **Aplikasi mendorong** siswa memilih nominal lebih besar.

Masalahnya: saat ini uang dari **Pembayaran bebas** sudah masuk ke Xendit, tetapi **tidak
mengurangi sisa kewajiban** di sistem. Jadi fleksibilitas yang diinginkan justru membuat
catatan beban siswa salah.

## 2. Bug yang ditemukan

Diurutkan dari dampak terbesar. Nomor baris mengacu ke `main` commit `64605bb`.

### B1 — Pembayaran bebas yang lunas tidak mengurangi sisa kewajiban (kritis)

- Webhook hanya memperbarui pengajuan bila `type === 'INSTALLMENT'`
  (`src/app/api/webhooks/xendit/route.ts:54-61`). Untuk `type: 'CUSTOM'` hanya dokumen
  `payments` yang berubah jadi `PAID`.
- Semua tampilan "Terbayar" dan "Sisa Kewajiban" dihitung dari `paidInstallments` ×
  nominal jadwal:
  - admin: `summarizeInstallments` (`admin/admin-dashboard.tsx:558-574`)
  - beranda siswa: `readScheduleSummary` (`dashboard/actions.ts:155`)
  - halaman Angsuran & Pembayaran: `paid: paidInstallments.has(n)`

**Contoh:** angsuran Rp3.542.000 × 12. Siswa membayar bebas Rp10.000.000 → Xendit
`PAID`, tetapi beranda tetap "0 dari 12 angsuran lunas", admin tetap "Sisa
Rp42.504.000", dan bulan depan siswa ditagih penuh lagi.

### B2 — Siswa bisa membayar sebelum akad disepakati

`createInstallmentPayment` dan `createCustomPayment` hanya menolak status
`CANCELLED`/`REJECTED` (`pembayaran/actions.ts:252` dan `:335`). Akibatnya:

- Pembayaran bebas bisa dibuat untuk pengajuan yang baru `SUBMITTED` (tanpa jadwal).
- Angsuran bisa dibayar saat biaya masih `VERIFIED` (penawaran belum disetujui). Bila
  penawaran kemudian diubah, uang yang sudah masuk tidak jelas mengacu ke jadwal yang mana.

### B3 — Nominal pembayaran bebas tidak dibatasi sisa kewajiban

Batasnya tetap Rp1.000–Rp100.000.000 (`pembayaran/actions.ts:321`), tidak melihat sisa
tanggungan. Siswa dengan sisa Rp5.000.000 bisa membayar Rp50.000.000; kelebihannya tidak
tercatat di mana pun.

### B4 — "Terbayar" dihitung dari jadwal, bukan dari uang yang masuk

Karena nilai terbayar = jumlah nominal jadwal untuk nomor angsuran di `paidInstallments`,
bila admin menyimpan ulang rincian biaya setelah siswa membayar (mis. refund/potongan),
`calculateInstallmentSchedule` membuat nominal baru dan **uang yang sudah dibayar ikut
berubah nilainya**. Saya tidak menemukan penjaga di `admin/actions.ts` yang mencegah
perubahan jadwal setelah ada pembayaran — mohon dicek.

### B5 — Pembayaran dobel untuk angsuran yang sama tidak terdeteksi

Bila angsuran ke-n dibayar dua kali (mis. dua invoice berbeda), `arrayUnion` di webhook
membuat nomor n tetap satu; uang kedua tidak dicatat sebagai kelebihan.

### Catatan kecil

- **B6** — Riwayat pembayaran mengambil `limit(20)` tanpa urutan
  (`pembayaran/actions.ts:128`), lalu baru diurutkan di memori. Setelah lebih dari 20
  pembayaran, transaksi terbaru bisa tidak tampil. Perlu `orderBy('createdAt', 'desc')`
  (+ index komposit).
- **Terkait webhook (sudah disampaikan terpisah):** callback berawalan `trm-` milik
  Turrima harus diteruskan sebelum app ini menggantikan versi lama di `apps.venturego.id`.

## 3. Usulan desain

### 3.1 Catat uang yang masuk, turunkan status angsuran darinya

Tambah satu field di `applications`:

| Field            | Tipe               | Isi                                                                         |
| ---------------- | ------------------ | --------------------------------------------------------------------------- |
| `paidAmount`     | integer rupiah     | Total uang yang sudah diterima untuk pengajuan ini (semua jenis pembayaran) |
| `overpaidAmount` | integer rupiah     | Kelebihan di atas total kewajiban (untuk ditindaklanjuti admin)             |
| `fullyPaidAt`    | ISO string \| null | Waktu sisa kewajiban mencapai 0                                             |

Status tiap angsuran **dihitung** dengan mengalirkan `paidAmount` ke jadwal secara urut
jatuh tempo: angsuran 1 terisi penuh dulu, lalu 2, dst. Angsuran yang terisi sebagian
berstatus `SEBAGIAN`. `paidInstallments` tetap ditulis (angsuran yang terisi penuh) agar
kode yang sudah ada tetap jalan selama transisi.

Keuntungannya: satu sumber kebenaran (uang masuk), pembayaran berapa pun langsung
tercermin, B1/B4/B5 selesai sekaligus.

### 3.2 Fungsi inti (murni, mudah dites) — usulan `src/lib/payment-allocation.ts`

```ts
export type ScheduleRow = { installment: number; dueDate: string; amount: number }
export type AllocatedRow = ScheduleRow & {
  applied: number
  outstanding: number
  status: 'LUNAS' | 'SEBAGIAN' | 'BELUM'
}

/** Alirkan total uang masuk ke jadwal, urut dari angsuran paling awal. */
export function allocatePaid(schedule: ScheduleRow[], paidAmount: number): AllocatedRow[] {
  let left = Math.max(0, paidAmount)
  return [...schedule]
    .sort((a, b) => a.installment - b.installment)
    .map((row) => {
      const applied = Math.min(row.amount, left)
      left -= applied
      return {
        ...row,
        applied,
        outstanding: row.amount - applied,
        status: applied === row.amount ? 'LUNAS' : applied > 0 ? 'SEBAGIAN' : 'BELUM',
      }
    })
}

/** Batas nominal yang boleh dibayar hari ini + pilihan yang ditawarkan ke siswa. */
export function getPaymentOptions(schedule: ScheduleRow[], paidAmount: number, todayIso: string) {
  const rows = allocatePaid(schedule, paidAmount)
  const total = schedule.reduce((sum, row) => sum + row.amount, 0)
  const remaining = Math.max(0, total - paidAmount)
  const open = rows.filter((row) => row.outstanding > 0)
  // Minimal = semua yang sudah jatuh tempo; bila tidak ada tunggakan, angsuran berikutnya.
  const dueNow = open
    .filter((row) => row.dueDate <= todayIso)
    .reduce((s, r) => s + r.outstanding, 0)
  const minimum = Math.min(remaining, Math.max(dueNow, open[0]?.outstanding ?? 0))

  const options: { label: string; amount: number; monthsAhead: number }[] = []
  let running = 0
  open.forEach((row, index) => {
    running += row.outstanding
    if (running >= minimum && options.length < 3 && running < remaining) {
      options.push({ label: `${index + 1} angsuran`, amount: running, monthsAhead: index })
    }
  })
  if (remaining > 0) {
    options.push({ label: 'Lunasi semua', amount: remaining, monthsAhead: open.length - 1 })
  }
  return { remaining, minimum, maximum: remaining, options, rows }
}
```

Sketsa ini sudah dicoba dengan data contoh (12 × Rp3.542.000: bayar pas, telat 2 bulan, sebagian Rp1 juta, sisa 1 angsuran, lunas) dan hasilnya sesuai. Tetap perlu test unit (Vitest) untuk: bayar pas, bayar sebagian, bayar 3 angsuran sekaligus,
bayar lunas, kelebihan, tunggakan 2 bulan, jadwal kosong.

### 3.3 Membuat pembayaran (server)

Gabungkan `createInstallmentPayment` + `createCustomPayment` menjadi satu
`createFlexiblePayment(token, applicationDocId, amount)`:

1. Verifikasi token & pemilik (seperti sekarang).
2. **Tolak bila `financialPlan.pricingStatus !== 'AGREED'`** (B2) — pesan:
   `Pembayaran dapat dilakukan setelah akad disepakati.`
3. Hitung `getPaymentOptions` di server dari jadwal + `paidAmount` + pembayaran `PENDING`
   yang masih berlaku.
4. **Tolak bila `amount < minimum` atau `amount > remaining`** (B3) — pesan:
   `Nominal minimal {Rp minimum} dan maksimal {Rp sisa kewajiban}.`
5. Pakai ulang invoice `PENDING` yang belum kedaluwarsa bila nominalnya sama; selain itu
   buat dokumen `payments` baru `type: 'FLEXIBLE'` (tipe lama tetap dibaca untuk riwayat).

Fungsi lama boleh tetap ada sebagai pembungkus agar tombol "Bayar" per angsuran tidak rusak.

### 3.4 Webhook

Di dalam transaksi yang sudah ada (baca dulu, baru tulis — aturan transaksi Firestore):

```ts
const appRef = db.collection('applications').doc(applicationDocId)
const appSnap = await transaction.get(appRef) // baca sebelum update apa pun
const app = appSnap.data() ?? {}
const schedule = readSchedule(app.financialPlan?.schedule)
const total = schedule.reduce((sum, row) => sum + row.amount, 0)
const nextPaid = (Number.isSafeInteger(app.paidAmount) ? app.paidAmount : 0) + data.amount
const rows = allocatePaid(schedule, nextPaid)

transaction.update(paymentRef, { status: 'PAID' /* …field yang sudah ada… */ })
transaction.update(appRef, {
  paidAmount: nextPaid,
  paidInstallments: rows.filter((r) => r.status === 'LUNAS').map((r) => r.installment),
  overpaidAmount: Math.max(0, nextPaid - total),
  fullyPaidAt: nextPaid >= total ? new Date().toISOString() : null,
  updatedAt: FieldValue.serverTimestamp(),
})
```

Berlaku untuk **semua** tipe pembayaran (`INSTALLMENT`, `CUSTOM`, `FLEXIBLE`). Idempotensi
tetap dari pengecekan `payment.status === 'PAID'` yang sudah ada. Status pengajuan **tidak**
otomatis diubah ke `COMPLETED`; admin mendapat penanda "Siap ditutup" saat
`fullyPaidAt` terisi.

### 3.5 Tampilan siswa — mendorong bayar lebih

Satu kartu **Bayar tagihan** menggantikan kartu "Pembayaran bebas":

```
┌─────────────────────────────────────────────┐
│ Sisa kewajiban            Rp35.420.000      │
│ ████████░░░░░░░░░░  2 dari 12 angsuran lunas│
│                                             │
│ ( ) Angsuran jatuh tempo     Rp3.542.000    │
│ (•) 3 angsuran  ⭐ Disarankan  Rp10.626.000  │
│      Lunas 2 bulan lebih cepat · Mei 2027   │
│ ( ) Lunasi semua            Rp35.420.000    │
│ ( ) Nominal lain  [ min Rp3.542.000 ]       │
│                                             │
│ [        Bayar Rp10.626.000        ]        │
│ Pelunasan dipercepat tidak dikenai penalti. │
└─────────────────────────────────────────────┘
```

Dorongan yang aman secara syariah (tanpa mengubah nilai akad):

- Pilihan **lebih besar dari minimal** diberi tanda _Disarankan_ dan dipilih lebih dulu.
- Tampilkan **perkiraan tanggal lunas** yang maju bila memilih nominal lebih besar.
- Progress bar + pencapaian (mis. "Separuh perjalanan", "Lunas lebih cepat").
- Pengingat jatuh tempo menyertakan tautan "Bayar 2 bulan sekaligus".

Potongan nominal untuk pelunasan dipercepat (_ibra'_) **tidak** termasuk usulan ini — bila
nanti diinginkan, perlu persetujuan Dewan Pengawas Syariah lebih dulu.

### 3.6 Tampilan admin

- Kolom **Terbayar** & **Sisa Kewajiban** memakai `paidAmount` (bukan jadwal).
- Angsuran `SEBAGIAN` tampil dengan nominal kurangnya.
- Penanda **Kelebihan bayar** bila `overpaidAmount > 0`, dan **Siap ditutup** bila
  `fullyPaidAt` terisi.
- Bila sudah ada pembayaran, simpan ulang rincian biaya hanya boleh mengubah jadwal
  **sisa** (B4) — atau minimal tampilkan peringatan.

## 4. Migrasi data yang sudah ada

Menyentuh banyak dokumen `applications` → sesuai §Schema Safety di `AGENTS.md`, **perlu
konfirmasi sebelum dijalankan**.

1. Script `scripts/backfill-paid-amount.mjs` mode **dry-run** (default): untuk setiap
   pengajuan, `paidAmount` = jumlah `payments.amount` berstatus `PAID` dengan
   `applicationDocId` tersebut (semua tipe). Cetak tabel: pengajuan, `paidInstallments`
   lama, `paidAmount` baru, angsuran lunas versi baru, selisih.
2. Tim keuangan mencocokkan hasil dry-run dengan rekap manual.
3. Jalankan `--commit` (idempoten: hanya mengisi bila `paidAmount` belum ada).
4. Field baru bersifat tambahan (_additive_); field lama tidak dihapus.

## 5. Yang perlu diputuskan

| #   | Pertanyaan                       | Usulan                                                                                                                      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Minimal bayar                    | Semua yang sudah jatuh tempo; bila tidak ada tunggakan, angsuran berikutnya                                                 |
| 2   | Kelebihan bayar                  | Dicegah saat membuat invoice; bila tetap terjadi (dua invoice dibayar), dicatat di `overpaidAmount` untuk refund oleh admin |
| 3   | Lunas otomatis jadi `COMPLETED`? | Tidak — admin yang menutup                                                                                                  |
| 4   | Pengajuan Full Cover             | Ikut aturan yang sama begitu ada jadwal & `AGREED`                                                                          |
| 5   | Potongan pelunasan (_ibra'_)     | Tidak sekarang; perlu DPS                                                                                                   |

## 6. Urutan pengerjaan yang disarankan

1. `src/lib/payment-allocation.ts` + test unit.
2. Webhook memakai `paidAmount` untuk semua tipe (B1, B4, B5).
3. Penjaga `AGREED` + batas min/maks di server (B2, B3).
4. Script backfill (dry-run → cek → commit).
5. Tampilan admin & siswa (kartu Bayar tagihan).
6. `orderBy` riwayat (B6).
7. Perbarui `DOKUMENTASI_ALUR_KERJA.md` di setiap langkah.

Bila Mas Panut setuju dengan arahnya, saya bisa bantu menyiapkan langkah 1–2 sebagai PR
terpisah untuk direview.
