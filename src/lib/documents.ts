export type DocumentProduct = 'FULL_COVER' | 'DEPARTURE_BRIDGING'

export type DocumentDefinition = {
  label: string
  required: boolean
}

export const DOCUMENT_DEFINITIONS: Record<DocumentProduct, DocumentDefinition[]> = {
  DEPARTURE_BRIDGING: [
    { label: 'Pas Foto', required: true },
    { label: 'Scan KTP', required: true },
    { label: 'Scan KK (Kartu Keluarga)', required: true },
    { label: 'Ijazah SD/MI', required: true },
    { label: 'Ijazah SMP/MTs/SLTP', required: true },
    { label: 'Ijazah SMA/SMK/MA/SLTA', required: true },
    { label: 'Scan Passport', required: false },
    { label: 'Surat Kesediaan Mengangsur', required: false },
    { label: 'Surat Rekomendasi LPK', required: false },
    { label: 'Scan KTP Orang Tua / Wali', required: false },
    { label: 'Scan SKCK', required: false },
    { label: 'Scan COE', required: false },
  ],
  FULL_COVER: [
    { label: 'KTP siswa', required: false },
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
