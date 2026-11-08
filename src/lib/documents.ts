export type DocumentProduct = 'FULL_COVER' | 'DEPARTURE_BRIDGING'

export type DocumentDefinition = {
  label: string
  required: boolean
  section?: 'dokumen-pendukung'
}

export const DOCUMENT_DEFINITIONS: Record<DocumentProduct, DocumentDefinition[]> = {
  DEPARTURE_BRIDGING: [
    { label: 'Pas Foto', required: true },
    { label: 'Scan KTP', required: true },
    { label: 'Scan Akta Kelahiran', required: false },
    { label: 'Scan KK (Kartu Keluarga)', required: true },
    { label: 'Ijazah SD/MI', required: true },
    { label: 'Ijazah SMP/MTs/SLTP', required: true },
    { label: 'Ijazah SMA/SMK/MA/SLTA', required: true },
    { label: 'Scan Passport', required: false },
    { label: 'Scan Surat Rekomendasi LPK', required: false, section: 'dokumen-pendukung' },
    { label: 'Scan Form Pendaftaran', required: false, section: 'dokumen-pendukung' },
    { label: 'Scan Surat Kesediaan Mengangsur', required: false, section: 'dokumen-pendukung' },
    { label: 'Scan Surat Mengetahui Orang Tua', required: false, section: 'dokumen-pendukung' },
    { label: 'Scan SKCK', required: false },
    { label: 'Scan COE', required: false },
    { label: 'Scan Kontrak Kerja', required: false },
    { label: 'Scan KTP Orang Tua / Wali', required: false },
    { label: 'Scan Surat Nikah Orang Tua', required: false },
  ],
  FULL_COVER: [
    { label: 'KTP siswa', required: true },
    { label: 'Kartu Keluarga', required: false },
    { label: 'Persetujuan orang tua', required: false },
    { label: 'Rekomendasi LPK', required: false },
    { label: 'Akta kelahiran', required: false },
    { label: 'Ijazah terakhir', required: false },
    { label: 'Bukti pendaftaran LPK', required: false },
    { label: 'Rincian program pelatihan', required: false },
    { label: 'Estimasi biaya LPK', required: false },
  ],
}

export const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

export const isAcceptedDocumentType = (mimeType: string) =>
  (ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(mimeType)

export const sanitizeUploadFileName = (value: string) => value.replace(/[\\/]/g, '_').slice(0, 180)

const KTP_LABEL_PATTERN = /^(scan ktp$|ktp\b)/i

export const getKtpDocumentIndex = (product: DocumentProduct): number =>
  DOCUMENT_DEFINITIONS[product].findIndex((definition) => KTP_LABEL_PATTERN.test(definition.label))

export const documentFileBaseName = (label: string): string =>
  label
    .replace(/^Scan\s+/i, '')
    .split('/')[0]
    .replace(/\s+siswa$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

export const buildDocumentFileName = (
  label: string,
  ownerName: string,
  originalFileName: string,
): string => {
  const base = documentFileBaseName(label)
  const owner = ownerName.replace(/\s+/g, ' ').trim()
  const extension = (originalFileName.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? '').toLowerCase()
  if (!base || !owner) return sanitizeUploadFileName(originalFileName)
  return sanitizeUploadFileName(`${base} - ${owner}${extension}`)
}

const matchesSignature = (header: Uint8Array, sequence: number[]) =>
  sequence.every((byte, index) => header[index] === byte)

export const hasValidDocumentSignature = (mimeType: string, header: Uint8Array) =>
  (mimeType === 'application/pdf' && matchesSignature(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) ||
  (mimeType === 'image/jpeg' && matchesSignature(header, [0xff, 0xd8, 0xff])) ||
  (mimeType === 'image/png' &&
    matchesSignature(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
