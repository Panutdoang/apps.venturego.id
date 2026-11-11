/**
 * Salin berkas siswa lama (hasil unduh folder Drive lama) ke Drive app + isi `documents`
 * di applications/legacy-*. Lihat docs/MIGRASI-BLUEPRINT.md.
 *
 *   node --env-file=.env.local scripts/legacy-upload-berkas.mjs <folder-data> [--commit]
 *
 * <folder-data> (di LUAR repo, berisi data pribadi):
 *   - drive/<...>/Data Siswa .../NNN. Nama/   (hasil ekstrak zip Google Drive)
 *   - konfigurasi-migrasi.json → berkas.{folderSiswa, formResponses, labelFile}
 * Default dry-run. Idempoten: folder & file bernama sama di Drive dilewati, `documents` disusun ulang.
 * Hanya menulis dokumen yang dibuat skrip impor (updatedBy import-legacy-siswa / upload-berkas-lama).
 */
import fs from 'node:fs'
import path from 'node:path'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const DATA = args.find((a) => !a.startsWith('--'))
if (!DATA) {
  console.error(
    'Pakai: node --env-file=.env.local scripts/legacy-upload-berkas.mjs <folder-data> [--commit]',
  )
  process.exit(1)
}
const KONFIG = JSON.parse(
  fs.readFileSync(path.join(DATA, 'konfigurasi-migrasi.json'), 'utf8'),
).berkas
const findDir = (root, re) => {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const full = path.join(root, e.name)
    if (re.test(e.name)) return full
    const hit = findDir(full, re)
    if (hit) return hit
  }
  return null
}
const BASE = findDir(path.join(DATA, 'drive'), /^Data Siswa /)
if (!BASE) throw new Error('Folder "Data Siswa ..." tidak ditemukan di <folder-data>/drive')
const FORM = path.join(BASE, '000. Form Pendaftaran')

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})
const db = getFirestore(app)

// folder siswa → applications. Elemen ke-3 = subfolder milik pembiayaan lain.
const MAP = KONFIG.folderSiswa
// berkas jawaban Google Form untuk siswa yang foldernya kosong
const FORM_MAP = KONFIG.formResponses.map(([nama, docId]) => [new RegExp(nama, 'i'), docId])
const LABEL_FILE = KONFIG.labelFile ?? {}

const DEFS = [
  'Pas Foto',
  'Scan KTP',
  'Scan Akta Kelahiran',
  'Scan KK (Kartu Keluarga)',
  'Ijazah SD/MI',
  'Ijazah SMP/MTs/SLTP',
  'Ijazah SMA/SMK/MA/SLTA',
  'Scan Passport',
  'Scan Surat Rekomendasi LPK',
  'Scan Form Pendaftaran',
  'Scan Surat Kesediaan Mengangsur',
  'Scan Surat Mengetahui Orang Tua',
  'Scan SKCK',
  'Scan COE',
  'Scan Kontrak Kerja',
  'Scan KTP Orang Tua / Wali',
  'Scan Surat Nikah Orang Tua',
]

const classify = (rel) => {
  const f = rel.toLowerCase()
  const name = path.basename(f)
  if (/bukti transfer/.test(f)) return 'Bukti Transfer Angsuran'
  if (/^dokumentasi\//.test(f)) return 'Dokumentasi'
  if (/pinjaman baru\//.test(f)) return 'Draft Akad Murabahah (Pinjaman Baru)'
  // jawaban Google Form: jenis dari nama subfolder
  if (/scan ktp orang tua/.test(f)) return 'Scan KTP Orang Tua / Wali'
  if (/scan surat nikah orang tua/.test(f)) return 'Scan Surat Nikah Orang Tua'
  if (/scan dokumen asli penjamin/.test(f)) return 'Dokumen Penjamin (KK, Akta, Ijazah)'
  if (/scan formulir pendaftaran/.test(f)) return 'Scan Form Pendaftaran'
  if (/scan surat kesediaan/.test(f)) return 'Scan Surat Kesediaan Mengangsur'
  if (/scan surat pernyataan mengetahui/.test(f)) return 'Scan Surat Mengetahui Orang Tua'
  if (/scan surat rekomendasi/.test(f)) return 'Scan Surat Rekomendasi LPK'
  if (/scan kk \(/.test(f)) return 'Scan KK (Kartu Keluarga)'
  if (/scan skck/.test(f)) return 'Scan SKCK'
  if (/scan coe/.test(f)) return 'Scan COE'
  if (/scan passport/.test(f)) return 'Scan Passport'
  if (/scan kontrak kerja/.test(f)) return 'Scan Kontrak Kerja'
  if (/scan visa/.test(f)) return 'Visa Kerja'
  if (/scan sertifikat jlpt/.test(f)) return 'Sertifikat JLPT/JFT'
  if (/pas foto \(/.test(f)) return 'Pas Foto'
  if (/scan ktp \(/.test(f)) return 'Scan KTP'
  // nama file di folder siswa
  if (/ktp (ortu|orang tua|org tua|ayah|ibu)|identitas orang tua/.test(name))
    return 'Scan KTP Orang Tua / Wali'
  if (/(surat|buku) nikah|akta pernikahan/.test(name)) return 'Scan Surat Nikah Orang Tua'
  if (/pernyataan (orang tua|wali|orgtu)|mengetahui|keterangan orang tua/.test(name))
    return 'Scan Surat Mengetahui Orang Tua'
  if (/kesediaan|kesanggupan|pengangsur/.test(name)) return 'Scan Surat Kesediaan Mengangsur'
  if (/form ?pe[nm]daftaran|formulir/.test(name)) return 'Scan Form Pendaftaran'
  if (/pas+port/.test(name)) return 'Scan Passport'
  if (/\bcoe\b/.test(name)) return 'Scan COE'
  if (/kontrak kerja/.test(name)) return 'Scan Kontrak Kerja'
  if (/skck/.test(name)) return 'Scan SKCK'
  if (/akta kelahiran/.test(name)) return 'Scan Akta Kelahiran'
  if (/penjamin|ijazah|akte/.test(name)) return 'Dokumen Penjamin (KK, Akta, Ijazah)'
  if (/\bkk\b|kartu keluarga/.test(name)) return 'Scan KK (Kartu Keluarga)'
  if (/\bktp\b/.test(name)) return 'Scan KTP'
  if (LABEL_FILE[name]) return LABEL_FILE[name]
  if (/pas foto/.test(name)) return 'Pas Foto'
  if (/akad|kontrak syariah/.test(name)) return 'Akad Pembiayaan'
  if (/visa/.test(name)) return 'Visa Kerja'
  if (/jlpt/.test(name)) return 'Sertifikat JLPT/JFT'
  if (/invoice|kwitansi/.test(name)) return 'Invoice / Kwitansi'
  if (/\.(jpe?g|png)$/.test(name) && !/\//.test(f)) return 'Pas Foto'
  return 'Berkas Lain'
}
const MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const walk = (dir, rel = '') =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(dir, e.name), `${rel}${e.name}/`)
        : [{ abs: path.join(dir, e.name), rel: `${rel}${e.name}` }],
    )

// ---------- Drive ----------
let token = ''
const refresh = async () => {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GDRIVE_OAUTH_CLIENT_ID,
      client_secret: process.env.GDRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  token = (await r.json()).access_token
  if (!token) throw new Error('token Drive gagal')
}
const drive = async (url, init = {}, retry = 0) => {
  const r = await fetch(url.startsWith('http') ? url : `https://www.googleapis.com${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (r.status === 401 && retry < 2) {
    await refresh()
    return drive(url, init, retry + 1)
  }
  if ((r.status === 429 || r.status >= 500) && retry < 4) {
    await new Promise((s) => setTimeout(s, 2000 * (retry + 1)))
    return drive(url, init, retry + 1)
  }
  return r
}
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const children = async (parent) => {
  const out = []
  let pageToken = ''
  do {
    const r = await (
      await drive(
        `/drive/v3/files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType,size)&q=${encodeURIComponent(`'${parent}' in parents and trashed=false`)}${pageToken ? `&pageToken=${pageToken}` : ''}`,
      )
    ).json()
    out.push(...(r.files ?? []))
    pageToken = r.nextPageToken ?? ''
  } while (pageToken)
  return out
}
const folderCache = new Map()
const ensureFolder = async (parent, name, color) => {
  const key = `${parent}/${name}`
  if (folderCache.has(key)) return folderCache.get(key)
  const found = (await children(parent)).find(
    (f) => f.name === name && f.mimeType.endsWith('folder'),
  )
  let id = found?.id
  if (!id) {
    const r = await (
      await drive('/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parents: [parent],
          mimeType: 'application/vnd.google-apps.folder',
          ...(color ? { folderColorRgb: color } : {}),
        }),
      })
    ).json()
    id = r.id
  }
  folderCache.set(key, id)
  return id
}
const upload = async (parent, abs, name, mimeType) => {
  const init = await drive(
    '/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': mimeType },
      body: JSON.stringify({ name, parents: [parent] }),
    },
  )
  const loc = init.headers.get('location')
  if (!loc) throw new Error(`upload init gagal ${init.status} ${name}`)
  const r = await drive(loc, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: fs.readFileSync(abs),
  })
  if (!r.ok) throw new Error(`upload gagal ${r.status} ${name}`)
  return r.json()
}

// ---------- rencana ----------
const plan = new Map() // docId -> [{abs, rel, label}]
const add = (docId, abs, rel) =>
  plan.set(docId, [...(plan.get(docId) ?? []), { abs, rel, label: classify(rel) }])
for (const [folder, docId, subs = {}] of MAP) {
  for (const f of walk(`${BASE}/${folder}`)) {
    const sub = Object.keys(subs).find((s) => f.rel.startsWith(`${s}/`))
    add(sub ? subs[sub] : docId, f.abs, f.rel)
  }
}
for (const f of walk(FORM)) {
  const hit = FORM_MAP.find(([re]) => re.test(path.basename(f.rel)))
  if (hit)
    add(
      hit[1],
      f.abs,
      f.rel.replace(
        /^Form Pendaftaran Talang Dana - VWorks Student Ventures \(File responses\)\//,
        '',
      ),
    )
}

const main = async () => {
  await refresh()
  const rootList = await (
    await drive(
      `/drive/v3/files?fields=files(id,name)&q=${encodeURIComponent("name='VSV.VentureGo.id [database]' and mimeType='application/vnd.google-apps.folder' and trashed=false")}`,
    )
  ).json()
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID || rootList.files?.[0]?.id
  if (!rootId) throw new Error('Folder root app tidak ditemukan')
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'} · root ${rootList.files?.[0]?.name}`)

  let totalFiles = 0,
    totalBytes = 0
  for (const [docId, files] of plan) {
    const snap = await db.collection('applications').doc(docId).get()
    if (!snap.exists) {
      console.log(`!! ${docId} tidak ada`)
      continue
    }
    const data = snap.data()
    const name = data.applicantName
    const counts = {}
    for (const f of files) counts[f.label] = (counts[f.label] ?? 0) + 1
    const bytes = files.reduce((s, f) => s + fs.statSync(f.abs).size, 0)
    totalFiles += files.length
    totalBytes += bytes
    console.log(
      `\n# ${name} (${docId}) — ${files.length} berkas, ${(bytes / 1048576).toFixed(1)} MB`,
    )
    console.log(
      '  ' +
        Object.entries(counts)
          .map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`)
          .join(' · '),
    )
    const missing = DEFS.filter((d) => !counts[d])
    console.log(`  belum ada: ${missing.join(', ') || '-'}`)
    if (!COMMIT) continue
    if (data.updatedBy !== 'import-legacy-siswa' && data.updatedBy !== 'upload-berkas-lama') {
      console.log('  dilewati: sudah diubah orang lain')
      continue
    }

    const folderName = `LGC - ${name} - ${data.applicationId.replace('VSV-LGC-', '')}`
    const folderId = await ensureFolder(
      rootId,
      folderName,
      data.status === 'COMPLETED' ? '#00ff00' : '#00ff00',
    )
    const existing = new Map()
    const uploaded = []
    for (const f of files) {
      const dir = path.posix.dirname(f.rel)
      const parent = dir === '.' ? folderId : await ensureFolder(folderId, dir.split('/').at(-1))
      if (!existing.has(parent))
        existing.set(parent, new Map((await children(parent)).map((c) => [c.name, c])))
      const fname = path.basename(f.rel)
      const ext = fname.split('.').pop().toLowerCase()
      const mimeType = MIME[ext] ?? 'application/octet-stream'
      let meta = existing.get(parent).get(fname)
      if (!meta) meta = await upload(parent, f.abs, fname, mimeType)
      uploaded.push({
        label: f.label,
        fileId: meta.id,
        fileName: fname,
        mimeType,
        size: Number(meta.size ?? fs.statSync(f.abs).size),
      })
      process.stdout.write('.')
    }
    // documents: urutan definisi app dulu, sisanya berkas tambahan
    const used = new Set()
    const documents = DEFS.map((label) => {
      const hit = uploaded.find((u) => u.label === label && !used.has(u))
      if (!hit) return { documentType: label, status: 'NOT_UPLOADED' }
      used.add(hit)
      return {
        documentType: label,
        status: 'VERIFIED',
        fileId: hit.fileId,
        fileName: hit.fileName,
        mimeType: hit.mimeType,
        size: hit.size,
      }
    })
    for (const u of uploaded.filter((u) => !used.has(u)))
      documents.push({
        documentType: u.label,
        status: 'VERIFIED',
        fileId: u.fileId,
        fileName: u.fileName,
        mimeType: u.mimeType,
        size: u.size,
      })
    await snap.ref.update({
      documents,
      driveFolderId: folderId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'upload-berkas-lama',
    })
    console.log(` ✓ ${uploaded.length} berkas`)
  }
  console.log(
    `\nTotal: ${plan.size} siswa, ${totalFiles} berkas, ${(totalBytes / 1048576).toFixed(0)} MB`,
  )
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
