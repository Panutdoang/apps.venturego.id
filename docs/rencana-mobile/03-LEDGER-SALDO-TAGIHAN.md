# 03 — Ledger, Saldo & Tagihan

## 1. Kenapa perlu ledger

Contoh masalah di kondisi sekarang: **pembayaran bebas** (`createCustomPayment`) yang sudah
lunas tidak mengurangi kewajiban mana pun — webhook hanya menandai `paidInstallments` untuk
tipe `INSTALLMENT`. Uangnya masuk, tapi sistem tidak tahu harus dicatat ke mana. Dengan
ledger, setiap rupiah yang masuk/keluar selalu punya pasangan pencatatan.

## 2. Aturan dasar

1. **Rupiah bulat (integer)**, tipe `bigint`. Tidak ada desimal/float.
2. **Double-entry**: setiap transaksi = satu `journal` berisi ≥2 `entry`; total debit =
   total kredit (dicek constraint database).
3. **Append-only**: entry tidak pernah di-update/hapus. Salah catat → jurnal pembalik
   (`reversal_of = journal_id`).
4. **Idempotensi**: setiap jurnal punya `idempotency_key` unik (mis. id event Xendit,
   atau header `Idempotency-Key` dari app).
5. **Saldo = jumlah entry.** Tabel `account_balance` hanya cache yang di-update di
   transaksi yang sama, dengan `version` (optimistic lock) dan constraint `>= 0` untuk akun
   simpanan.
6. **Setiap jurnal mencatat pelaku** (`actor_uid` atau `system:webhook`) dan alasan.

## 3. Bagan akun (awal)

| Kode | Akun                                  | Jenis              | Per anggota? |
| ---- | ------------------------------------- | ------------------ | ------------ |
| 1100 | Kas di Xendit                         | Aset               | –            |
| 1200 | Kas di bank koperasi                  | Aset               | –            |
| 1300 | **Piutang pembiayaan**                | Aset               | per akad     |
| 1900 | Dana belum teridentifikasi (suspense) | Aset/Kewajiban     | –            |
| 2100 | **Simpanan sukarela**                 | Kewajiban          | ✅           |
| 2200 | Simpanan wajib                        | Ekuitas/Kewajiban* | ✅           |
| 2300 | Simpanan pokok                        | Ekuitas*           | ✅           |
| 2400 | Utang ke LPK / pihak ketiga (Nafaqah) | Kewajiban          | –            |
| 2500 | Ujrah ditangguhkan                    | Kewajiban          | per akad     |
| 4100 | Pendapatan ujrah                      | Pendapatan         | –            |
| 5100 | Biaya admin payment gateway           | Beban              | –            |
| 2900 | Dana sosial / kebajikan               | Kewajiban          | –            |

\* Klasifikasi akhir mengikuti standar akuntansi koperasi syariah — **wajib direview akuntan
dan DPS** sebelum dipakai.

## 4. Contoh jurnal

**a. Anggota setor ke VA Rp500.000 (masuk saldo sukarela)**

| Akun                               |   Debit |  Kredit |
| ---------------------------------- | ------: | ------: |
| 1100 Kas di Xendit                 | 500.000 |         |
| 2100 Simpanan sukarela · anggota A |         | 500.000 |

**b. Akad Dana Keberangkatan disepakati & dicairkan** (Nafaqah Rp33.000.000, Ujrah
Rp9.504.000, tenor 12)

| Akun                             |      Debit |     Kredit |
| -------------------------------- | ---------: | ---------: |
| 1300 Piutang pembiayaan · akad X | 42.504.000 |            |
| 2400 Utang ke LPK                |            | 33.000.000 |
| 2500 Ujrah ditangguhkan · akad X |            |  9.504.000 |

Saat dana dibayarkan ke LPK: Dr 2400 / Cr 1200 sebesar 33.000.000.

**c. Bayar angsuran Rp3.542.000 dari VA**

| Akun                             |     Debit |    Kredit |
| -------------------------------- | --------: | --------: |
| 1100 Kas di Xendit               | 3.542.000 |           |
| 1300 Piutang pembiayaan · akad X |           | 3.542.000 |

Pengakuan ujrah per angsuran (proporsional): Dr 2500 / Cr 4100 sebesar 792.000.

**d. Bayar angsuran dengan potong saldo**: Dr 2100 (anggota A) / Cr 1300 (akad X).

**e. Dana masuk tidak cocok dengan anggota mana pun**: Dr 1100 / Cr 1900 → antrian review
admin → setelah diidentifikasi, jurnal pemindahan dari 1900 ke akun tujuan.

## 5. Aturan alokasi dana masuk lewat VA anggota

Urutan (perlu disetujui pengurus & DPS):

1. Angsuran **jatuh tempo paling lama** dulu (FIFO), termasuk simpanan wajib yang tertunggak.
2. Nominal kurang dari angsuran → angsuran berstatus `SEBAGIAN`, sisa tetap ditagih.
3. Nominal lebih → kelebihan masuk **simpanan sukarela** (bukan otomatis membayar angsuran
   bulan depan), anggota diberi notifikasi dan bisa memilih "pakai untuk angsuran berikutnya".
4. Tidak ada angsuran terbuka → seluruhnya masuk simpanan sukarela.

Status angsuran: `MENDATANG` → `JATUH_TEMPO` → `LUNAS` / `SEBAGIAN` / `TERLAMBAT`.
Keterlambatan **tidak menambah** total kewajiban (sesuai akad yang berlaku). Bila nanti ada
ta'zir, dananya masuk 2900 Dana sosial, bukan pendapatan — wajib keputusan DPS.

## 6. Skema tabel (ringkas)

```sql
accounts(id, code, member_id NULL, contract_id NULL, type, currency 'IDR', created_at)
journals(id, idempotency_key UNIQUE, kind, description, actor, reversal_of NULL,
         source_ref, created_at)
entries(id, journal_id, account_id, debit bigint >=0, credit bigint >=0,
        CHECK (debit = 0 OR credit = 0))
-- trigger: SUM(debit) = SUM(credit) per journal (deferred, cek saat commit)
account_balance(account_id PK, balance bigint, version int)  -- cache, CHECK sesuai jenis
contracts(id, member_id, product, scheme, total, tenor, status, agreed_at, application_ref)
installments(id, contract_id, seq, due_date, amount, paid_amount, status, UNIQUE(contract_id, seq))
virtual_accounts(id, member_id, bank, va_number UNIQUE, xendit_id, external_id UNIQUE)
webhook_events(id, provider, event_id UNIQUE, external_id, payload jsonb, status, received_at)
payout_requests(id, member_id, amount, bank_account_id, status,
                maker_uid, checker_uid NULL, created_at, decided_at)
audit_log(id, actor, action, entity, entity_id, before jsonb, after jsonb, at)  -- append-only
```

## 7. Migrasi dari kondisi sekarang

1. Untuk setiap `applications` dengan `pricingStatus: AGREED`: buat `contract` +
   `installments` dari `financialPlan.schedule`, lalu jurnal pembukaan (b).
2. `paidInstallments` + `payments` berstatus `PAID` → jurnal pembayaran (c) dengan
   `idempotency_key = payments/{id}`.
3. Pembayaran bebas yang sudah lunas → alokasikan dengan aturan §5 (dicek manual oleh
   keuangan sebelum diposting).
4. Portofolio lama di app sebelumnya (blueprint, Neon) → diimpor dengan cara yang sama,
   termasuk VA tetap `vsv-…` yang masih dipakai siswa.
5. Setelah migrasi: total piutang di ledger dicocokkan dengan rekap keuangan manual,
   ditandatangani bendahara.
