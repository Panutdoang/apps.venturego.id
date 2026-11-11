/**
 * Isi data diri siswa lama (hasil baca formulir pendaftaran, KTP, paspor, Google Form) ke
 * applications/legacy-*. Lihat docs/MIGRASI-BLUEPRINT.md.
 *
 *   node --env-file=.env.local scripts/legacy-isi-data-diri.mjs <data-diri.json> [--commit]
 *
 * <data-diri.json> (di LUAR repo): [{ docId, alsoDocIds?, fullName, nik, birthPlace, birthDate,
 *   gender, religion, idCardAddress, postalCode, phone, email, motherName, education, lpkName,
 *   company, companyField, companyCity, companyAddress, workStart, monthlyIncome, passport?,
 *   emergency?, plan, sources, notes }]
 * Default dry-run. Menggabungkan ke personalDetails yang ada; nama lama disimpan di legacy.nameInOldApp.
 */
import fs from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const FILE = args.find((a) => !a.startsWith('--'))
if (!FILE) {
  console.error(
    'Pakai: node --env-file=.env.local scripts/legacy-isi-data-diri.mjs <data-diri.json> [--commit]',
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
const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'))

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null))
let n = 0
for (const r of rows) {
  for (const docId of [r.docId, ...(r.alsoDocIds ?? [])]) {
    const ref = db.collection('applications').doc(docId)
    const snap = await ref.get()
    if (!snap.exists) {
      console.log('!! tidak ada', docId)
      continue
    }
    const d = snap.data()
    const personalDetails = clean({
      ...(d.personalDetails ?? {}),
      idCardNumber: r.nik,
      religion: r.religion,
      birthPlace: r.birthPlace,
      birthDate: r.birthDate,
      gender: r.gender,
      idCardAddress: r.idCardAddress,
      domicileSameAsIdCard: true,
      domicileAddress: r.idCardAddress,
      domicilePostalCode: r.postalCode,
      motherName: r.motherName,
      maritalStatus: r.maritalStatus,
      education: r.education,
      email: r.email,
      npwp: r.npwp,
      fatherName: r.fatherName,
      emergencyContact:
        r.emergency && Object.keys(clean(r.emergency)).length ? clean(r.emergency) : undefined,
      passport: r.passport,
    })
    const employment = clean({
      company: r.company,
      field: r.companyField,
      city: r.companyCity,
      address: r.companyAddress,
      startDate: r.workStart,
      monthlyIncome: r.monthlyIncome,
      status: r.workStatus,
    })
    const patch = clean({
      applicantName: r.fullName,
      phone: r.phone || d.phone,
      lpkName: r.lpkName || d.lpkName,
      personalDetails,
      eligibility: {
        ...(d.eligibility ?? {}),
        hasPassport:
          !!r.passport ||
          (d.documents ?? []).some((x) => x.documentType === 'Scan Passport' && x.fileId),
        hasWorkContract: true,
        placementPassed: true,
        coeStatus: 'ISSUED',
      },
      departureDetails: { ...(d.departureDetails ?? {}), employment, requestedPlan: r.plan },
      legacy: {
        ...d.legacy,
        dataSources: r.sources,
        dataNotes: r.notes || null,
        nameInOldApp:
          d.applicantName !== r.fullName ? d.applicantName : (d.legacy?.nameInOldApp ?? null),
      },
    })
    console.log(
      `${docId.padEnd(38)} ${d.applicantName.padEnd(24)} → ${r.fullName} · NIK ${r.nik ? r.nik.slice(0, 6) + '…' : '(kosong)'} · ${r.birthDate || '-'}`,
    )
    if (COMMIT) await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() })
    n++
  }
}
console.log(`${COMMIT ? 'DITULIS' : 'DRY-RUN'}: ${n} dokumen`)
