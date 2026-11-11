/**
 * Impor siswa lama (app VentureGo blueprint + laporan keuangan Excel) ke Firestore.
 * Lihat docs/MIGRASI-BLUEPRINT.md §4–§6.
 *
 * Input: JSON hasil `scripts/export-for-firestore.ts` di repo blueprint (berisi data pribadi,
 * simpan di LUAR repo).
 *
 *   node --env-file=.env.local scripts/import-legacy-siswa.mjs <file.json>            # dry-run
 *   node --env-file=.env.local scripts/import-legacy-siswa.mjs <file.json> --commit   # tulis
 *   ... --commit --update   # timpa dokumen legacy-* yang sudah ada
 *   ... --rollback [--commit]   # hapus semua hasil impor ini (legacy-*), tanpa menyentuh data lain
 *
 * - Default DRY-RUN: hanya membaca Firestore, mencetak rencana.
 * - Idempoten: ID dokumen deterministik (`applications/legacy-{contractId}`,
 *   `payments/legacy-{contractId}-{tanggal}-{nominal}[-n]`); yang sudah ada dilewati kecuali --update.
 * - `ownerFirebaseUid` = null → siswa belum melihat datanya sampai akun diklaim (§5 no. 2).
 * - Tidak menyentuh dokumen selain `legacy-*`.
 */
import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const UPDATE = args.includes('--update')
if (!file) {
  console.error(
    'Pakai: node --env-file=.env.local scripts/import-legacy-siswa.mjs <file.json> [--commit] [--update]',
  )
  process.exit(1)
}

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!projectId || !clientEmail || !privateKey) {
  console.error('Variabel FIREBASE_* belum lengkap di .env.local')
  process.exit(1)
}
const app =
  getApps().find((a) => a.name === 'legacy-import') ??
  initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }), projectId },
    'legacy-import',
  )
const db = getFirestore(app)

const input = JSON.parse(readFileSync(file, 'utf8'))
const rupiah = (n) => 'Rp' + Number(n).toLocaleString('id-ID')

const buildApplication = (r) => ({
  applicationId: r.applicationId,
  ownerFirebaseUid: null,
  product: 'DEPARTURE_BRIDGING',
  contractScheme: `LEGACY_${r.legacy.scheme}`,
  applicantName: r.applicantName,
  phone: r.phone,
  lpkName: r.lpkName,
  destination: r.destination,
  status: r.status,
  paidInstallments: r.paidInstallments,
  paidAmount: r.paidAmount,
  personalDetails: {},
  eligibility: {},
  fullCoverDetails: null,
  departureDetails: null,
  fundingNeeds: [],
  financialPlan: {
    pricingStatus: 'AGREED',
    principal: r.principal,
    totalObligation: r.totalObligation,
    tenorMonths: r.tenorMonths,
    monthlyInstallment: r.schedule[0]?.amount ?? 0,
    installmentCount: r.schedule.length,
    firstPaymentDate: r.schedule[0]?.dueDate ?? '',
    startDate: r.startDate,
    schedule: r.schedule,
  },
  documents: [],
  understandsWakalah: false,
  acceptsDataProcessing: false,
  internalNotes: r.internalNotes,
  legacy: {
    ...r.legacy,
    overpayment: r.overpayment,
    importedFrom: input.source,
    migratedAt: FieldValue.serverTimestamp(),
  },
  createdAt: Timestamp.fromDate(new Date(r.createdAt)),
  updatedAt: FieldValue.serverTimestamp(),
  updatedBy: 'import-legacy-siswa',
})

const buildPayments = (r) => {
  const seen = new Map()
  return r.payments.map((p) => {
    const base = `legacy-${r.legacy.contractId}-${p.date}-${p.amount}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`
    return [
      id,
      {
        applicationDocId: r.docId,
        applicationId: r.applicationId,
        ownerFirebaseUid: null,
        type: 'LEGACY',
        installmentNumber: Number.isInteger(p.installmentNumber) ? p.installmentNumber : null,
        amount: p.amount,
        description: `Pembayaran app lama${p.installmentNumber ? ` · angsuran ke-${p.installmentNumber}` : ''}`,
        status: 'PAID',
        invoiceUrl: null,
        paidAt: `${p.date}T00:00:00+07:00`,
        paidMethod: 'MANUAL_LEGACY',
        paidChannel: null,
        legacy: { note: p.note, corrected: p.corrected },
        createdAt: Timestamp.fromDate(new Date(`${p.date}T00:00:00+07:00`)),
      },
    ]
  })
}

const main = async () => {
  console.log(`Project Firestore : ${projectId}`)
  console.log(
    `Mode              : ${COMMIT ? (UPDATE ? 'COMMIT + UPDATE' : 'COMMIT') : 'DRY-RUN (tidak menulis)'}`,
  )
  console.log(`Sumber            : ${input.source} (diekspor ${input.generatedAt})\n`)

  if (args.includes('--rollback')) {
    // Hapus HANYA dokumen hasil impor ini (ID berawalan legacy- dan updatedBy/type penanda impor).
    const apps = (await db.collection('applications').get()).docs.filter(
      (d) => d.id.startsWith('legacy-') && d.get('updatedBy') === 'import-legacy-siswa',
    )
    const pays = (await db.collection('payments').where('type', '==', 'LEGACY').get()).docs.filter(
      (d) => d.id.startsWith('legacy-'),
    )
    console.log(`Rollback: ${apps.length} applications + ${pays.length} payments legacy-*`)
    if (!COMMIT) return console.log('DRY-RUN — tambahkan --commit untuk benar-benar menghapus.')
    const refs = [...apps, ...pays].map((d) => d.ref)
    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch()
      for (const ref of refs.slice(i, i + 400)) batch.delete(ref)
      await batch.commit()
    }
    return console.log('Rollback selesai.')
  }

  const existingApps = await db.collection('applications').get()
  const legacyIds = new Set(
    existingApps.docs.filter((d) => d.id.startsWith('legacy-')).map((d) => d.id),
  )
  console.log(`applications saat ini: ${existingApps.size} (legacy-*: ${legacyIds.size})\n`)

  const ops = []
  let sum = { total: 0, paid: 0, sisa: 0, payments: 0, skip: 0 }
  console.log(
    'No  Status     Nama                             Total          Dibayar        Sisa           Lunas  Bayar',
  )
  input.records.forEach((r, i) => {
    const sisa = Math.max(r.totalObligation - r.paidAmount, 0)
    const exists = legacyIds.has(r.docId)
    const skip = exists && !UPDATE
    console.log(
      `${String(i + 1).padStart(2)}  ${r.status.padEnd(9)}  ${r.applicantName.slice(0, 31).padEnd(31)}  ${rupiah(r.totalObligation).padEnd(13)}  ${rupiah(r.paidAmount).padEnd(13)}  ${(r.status === 'COMPLETED' ? '-' : rupiah(sisa)).padEnd(13)}  ${String(r.paidInstallments.length).padStart(2)}/${String(r.schedule.length).padEnd(2)}  ${String(r.payments.length).padStart(3)}${exists ? (skip ? '  (ada, dilewati)' : '  (ada, ditimpa)') : ''}`,
    )
    sum.total += r.totalObligation
    sum.paid += r.paidAmount
    if (r.status !== 'COMPLETED') sum.sisa += sisa
    sum.payments += r.payments.length
    if (skip) {
      sum.skip += 1
      return
    }
    ops.push([db.collection('applications').doc(r.docId), buildApplication(r)])
    for (const [id, data] of buildPayments(r)) ops.push([db.collection('payments').doc(id), data])
  })

  console.log(
    `\nKontrak: ${input.records.length} (dilewati ${sum.skip}) · ACTIVE ${input.records.filter((r) => r.status === 'ACTIVE').length} · COMPLETED ${input.records.filter((r) => r.status === 'COMPLETED').length}`,
  )
  console.log(
    `Total kewajiban ${rupiah(sum.total)} · dibayar ${rupiah(sum.paid)} · sisa (ACTIVE) ${rupiah(sum.sisa)} · pembayaran ${sum.payments}`,
  )
  if (input.tanpaKontrak?.length)
    console.log(`\nTIDAK diimpor (belum ada kontrak di app lama): ${input.tanpaKontrak.join(', ')}`)
  if (input.masalah?.length) console.log(`\nPerlu dicek:\n - ${input.masalah.join('\n - ')}`)
  console.log(`\nDokumen yang akan ditulis: ${ops.length}`)

  if (!COMMIT) {
    console.log('\nDRY-RUN selesai — tidak ada yang ditulis. Tambahkan --commit untuk menulis.')
    return
  }
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    for (const [ref, data] of ops.slice(i, i + 400)) batch.set(ref, data)
    await batch.commit()
  }
  console.log(`\nSELESAI — ${ops.length} dokumen ditulis ke ${projectId}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
