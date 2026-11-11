/**
 * Impor riwayat mitra VIP (Vworks Investment Partner) dari tab "Mutasi" laporan keuangan Excel
 * ke Firestore: vipInvestors/{id} + vipLedger/{id}. Lihat docs/MIGRASI-BLUEPRINT.md §6b.
 *
 *   node --env-file=.env.local scripts/import-vip-lama.mjs <laporan.xlsx> [--commit] [--profil] [--rollback]
 *
 * Di folder yang sama dengan <laporan.xlsx> (di LUAR repo, berisi data pribadi) harus ada
 * konfigurasi-migrasi.json → vip: {
 *   investor: [{ id, pola, nama, emails: [], profitShareDay?: 15 }],   // pola = regex kolom 1
 *   abaikan: ["regex", …]                                             // baris uji coba dsb.
 * }
 * Kategori Mutasi: "Investasi" → DEPOSIT, "Penarikan Investasi" → WITHDRAWAL,
 * "Bagi Hasil Investasi" → PROFIT_SHARE (atau DIVIDEND bila keterangannya "Deviden/Dividen").
 * Default dry-run. Idempoten (ID dokumen deterministik): baris ledger yang sudah ada dilewati,
 * ownerFirebaseUid & data diri yang diubah staf tidak ditimpa (kecuali --profil untuk nama/email). --rollback hanya menghapus dokumen bertanda source LEGACY_MUTASI.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)
let XLSX
try {
  XLSX = require('xlsx')
} catch {
  console.error('Paket "xlsx" belum terpasang. Jalankan: pnpm add -D xlsx (atau pakai NODE_PATH).')
  process.exit(1)
}

const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const ROLLBACK = args.includes('--rollback')
const PROFIL = args.includes('--profil')
const FILE = args.find((a) => !a.startsWith('--'))
if (!FILE && !ROLLBACK) {
  console.error(
    'Pakai: node --env-file=.env.local scripts/import-vip-lama.mjs <laporan.xlsx> [--commit] [--rollback]',
  )
  process.exit(1)
}

const db = getFirestore(
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  }),
)
const SOURCE = 'LEGACY_MUTASI'
const BY = 'import-vip-lama'

if (ROLLBACK) {
  const ledger = await db.collection('vipLedger').where('source', '==', SOURCE).get()
  const investors = await db.collection('vipInvestors').where('updatedBy', '==', BY).get()
  console.log(
    `${COMMIT ? 'HAPUS' : 'DRY-RUN hapus'}: ${ledger.size} ledger, ${investors.size} investor`,
  )
  if (COMMIT) {
    for (const snap of [...ledger.docs, ...investors.docs]) await snap.ref.delete()
  }
  process.exit(0)
}

const KONFIG = JSON.parse(
  fs.readFileSync(path.join(path.dirname(FILE), 'konfigurasi-migrasi.json'), 'utf8'),
).vip
if (!KONFIG?.investor?.length) throw new Error('konfigurasi-migrasi.json belum punya bagian "vip"')
const INVESTORS = KONFIG.investor.map((i) => ({ ...i, re: new RegExp(i.pola, 'i') }))
const ABAIKAN = (KONFIG.abaikan ?? []).map((p) => new RegExp(p, 'i'))

// Tanggal Excel dibaca dari serial mentah (cellDates menggeser −1 hari).
const serialYmd = (n) =>
  new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10)
const BULAN =
  'Januari Februari Maret April Mei Juni Juli Agustus September Oktober November Desember'.split(
    ' ',
  )

const wb = XLSX.readFile(FILE)
const sheet = wb.Sheets[wb.SheetNames.find((n) => /^mutasi$/i.test(n.trim()))]
if (!sheet) throw new Error('Tab "Mutasi" tidak ditemukan')
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }).slice(1)

const entries = new Map(INVESTORS.map((i) => [i.id, []]))
for (const r of rows) {
  const [title, category, evidence, debit, credit, , serial, , rawNote] = r
  if (typeof title !== 'string' || typeof serial !== 'number') continue
  if (ABAIKAN.some((re) => re.test(title) || re.test(String(rawNote ?? '')))) continue
  const investor = INVESTORS.find((i) => i.re.test(title))
  if (!investor) continue
  const date = serialYmd(serial)
  const [y, m] = date.split('-').map(Number)
  let type
  let amount
  let note
  if (category === 'Investasi') {
    type = 'DEPOSIT'
    amount = Math.round(Number(debit) || 0)
    note = 'Setoran dana'
  } else if (category === 'Penarikan Investasi') {
    type = 'WITHDRAWAL'
    amount = Math.round(Number(credit) || 0)
    note = 'Penarikan dana'
  } else if (category === 'Bagi Hasil Investasi') {
    type = /devid|divid/i.test(title) ? 'DIVIDEND' : 'PROFIT_SHARE'
    amount = Math.round(Number(credit) || 0)
    note = `${type === 'DIVIDEND' ? 'Dividen' : 'Bagi hasil'} ${BULAN[m - 1]} ${y}`
  } else continue
  if (amount <= 0) continue
  entries.get(investor.id).push({
    date,
    type,
    amount,
    note,
    legacy: { title, category, evidence: evidence ?? null, note: rawNote ?? null },
  })
}

let writes = 0
for (const investor of INVESTORS) {
  const list = entries.get(investor.id).sort((a, b) => a.date.localeCompare(b.date))
  const sum = (t) => list.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0)
  const principalBalance = sum('DEPOSIT') - sum('WITHDRAWAL')
  const profits = list.filter((e) => e.type === 'PROFIT_SHARE')
  const last = profits.at(-1)
  console.log(
    `${investor.id.padEnd(10)} ${investor.nama.padEnd(22)} setor ${sum('DEPOSIT').toLocaleString('id-ID')} · tarik ${sum('WITHDRAWAL').toLocaleString('id-ID')} · saldo ${principalBalance.toLocaleString('id-ID')} · bagi hasil ${profits.length}x ${sum('PROFIT_SHARE').toLocaleString('id-ID')} · dividen ${sum('DIVIDEND').toLocaleString('id-ID')} · terakhir ${last ? `${last.date} ${last.amount.toLocaleString('id-ID')}` : '-'}`,
  )
  if (principalBalance < 0) console.log('   !! saldo negatif — periksa pola/abaikan di konfigurasi')
  if (!COMMIT) continue

  const ref = db.collection('vipInvestors').doc(investor.id)
  const existing = await ref.get()
  // Data diri dikelola di /admin → Mitra VIP; skrip hanya mengisinya saat dokumen baru dibuat
  // (atau bila --profil diberikan).
  const profile = {
    displayName: investor.nama,
    emails: (investor.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean),
    profitShareDay: investor.profitShareDay ?? 15,
  }
  await ref.set(
    {
      investorId: investor.id,
      ...(existing.exists
        ? {}
        : {
            ownerFirebaseUid: null,
            status: principalBalance > 0 ? 'ACTIVE' : 'INACTIVE',
            createdAt: FieldValue.serverTimestamp(),
          }),
      ...(!existing.exists || PROFIL ? profile : {}),
      akadLabel: 'Akad Wadiah (pencatatan lama)',
      source: SOURCE,
      updatedBy: BY,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  // Baris lama yang sudah ada tidak ditimpa (bisa sudah dibatalkan staf).
  const seen = new Map()
  const refs = list.map((e) => {
    const base = `${investor.id}-${e.date}-${e.type}-${e.amount}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return db.collection('vipLedger').doc(n > 1 ? `${base}-${n}` : base)
  })
  const present = refs.length ? await db.getAll(...refs) : []
  const batch = db.batch()
  list.forEach((e, index) => {
    if (present[index]?.exists) return
    batch.create(refs[index], {
      investorId: investor.id,
      ...e,
      source: SOURCE,
      createdBy: BY,
      createdAt: FieldValue.serverTimestamp(),
    })
    writes++
  })
  await batch.commit()

  // Cache saldo dihitung dari SELURUH ledger (termasuk catatan staf), sama dengan src/lib/vip.ts.
  const all = (await db.collection('vipLedger').where('investorId', '==', investor.id).get()).docs
    .map((d) => d.data())
    .filter((r) => !r.voidedAt && r.amount > 0)
    .sort((x, y) => x.date.localeCompare(y.date))
  const total = (t) => all.filter((r) => r.type === t).reduce((acc, r) => acc + r.amount, 0)
  const lastAll = all.filter((r) => r.type === 'PROFIT_SHARE').at(-1)
  await ref.update({
    principalBalance: total('DEPOSIT') - total('WITHDRAWAL'),
    totalDeposit: total('DEPOSIT'),
    totalWithdrawal: total('WITHDRAWAL'),
    totalProfitShared: total('PROFIT_SHARE'),
    totalDividend: total('DIVIDEND'),
    lastProfitShare: lastAll ? { date: lastAll.date, amount: lastAll.amount } : null,
    joinedAt: all[0]?.date ?? null,
  })
}
console.log(`${COMMIT ? 'DITULIS' : 'DRY-RUN'}${COMMIT ? `: ${writes} baris ledger baru` : ''}`)
