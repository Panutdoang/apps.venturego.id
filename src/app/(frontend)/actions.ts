'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

export type ApplicationInput = {
  product: 'FULL_COVER' | 'DEPARTURE_BRIDGING'
  applicantName: string
  phone: string
  lpkName: string
  birthPlace: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  religion: 'ISLAM' | 'PROTESTANT' | 'CATHOLIC' | 'HINDU' | 'BUDDHIST' | 'CONFUCIAN'
  idCardAddress: string
  domicileSameAsIdCard: boolean
  domicileAddress: string
  domicilePostalCode: string
  destination: 'JAPAN' | 'TURKEY'
  trainingStarted: boolean
  trainingCompleted: boolean
  hasPassport: boolean
  hasWorkContract: boolean
  guardianApproval: boolean
  placementPassed: boolean
  coeStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'ISSUED'
  visaStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'ISSUED'
  languageLevel: 'NOT_STARTED' | 'BASIC_N5' | 'N5' | 'N4' | 'N3_PLUS'
  trainingProgram: string
  trainingStartDate: string
  languageTrainingMonths: string
  skillTrainingMonths: string
  requiresTrainingAllowance: boolean
  requiresAccommodation: boolean
  estimatedDeparture: string
  outstandingLPKAmount: string
  selectedNeeds: string[]
  understandsWakalah: boolean
  acceptsDataProcessing: boolean
}

export type ApplicationResult = { ok: true; applicationId: string } | { ok: false; message: string }

const cleanText = (value: string, max: number) => value.trim().replace(/[<>]/g, '').slice(0, max)
const indonesianMonths: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
}
const religions: ApplicationInput['religion'][] = [
  'ISLAM',
  'PROTESTANT',
  'CATHOLIC',
  'HINDU',
  'BUDDHIST',
  'CONFUCIAN',
]

const parseIndonesianDate = (value: string) => {
  const match = cleanText(value, 40).match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return undefined

  const day = Number(match[1])
  const month = indonesianMonths[match[2].toLowerCase()]
  const year = Number(match[3])
  if (!month || year < 1900) return undefined

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function submitFinancingApplication(
  input: ApplicationInput,
): Promise<ApplicationResult> {
  const applicantName = cleanText(input.applicantName, 100)
  const phone = cleanText(input.phone, 24)
  const lpkName = cleanText(input.lpkName, 120)

  if (!applicantName || !phone || !lpkName) {
    return { ok: false, message: 'Lengkapi nama, nomor WhatsApp, dan nama LPK.' }
  }
  if (!/^(\+62|62|0)[0-9]{8,14}$/.test(phone.replace(/[\s-]/g, ''))) {
    return { ok: false, message: 'Masukkan nomor WhatsApp Indonesia yang valid.' }
  }
  if (!religions.includes(input.religion)) {
    return { ok: false, message: 'Pilih agama yang valid.' }
  }
  if (!input.understandsWakalah || !input.acceptsDataProcessing) {
    return { ok: false, message: 'Persetujuan akad dan pemrosesan data wajib dicentang.' }
  }

  const departure = input.product === 'DEPARTURE_BRIDGING'
  const birthDate = parseIndonesianDate(input.birthDate)
  if (!departure && !cleanText(input.trainingProgram, 120)) {
    return { ok: false, message: 'Lengkapi nama program pelatihan Full Cover.' }
  }
  if (departure && (!input.trainingCompleted || !birthDate || !cleanText(input.birthPlace, 80))) {
    return {
      ok: false,
      message:
        'Konfirmasi pelatihan selesai dan lengkapi tempat serta tanggal lahir dengan format seperti 12 Februari 2000.',
    }
  }
  if (
    departure &&
    (!cleanText(input.idCardAddress, 500) || !cleanText(input.domicileAddress, 500))
  ) {
    return { ok: false, message: 'Lengkapi alamat sesuai KTP dan alamat korespondensi.' }
  }
  const documents = [
    'KTP siswa',
    'Kartu Keluarga',
    'Surat persetujuan orang tua',
    'Surat rekomendasi LPK',
    ...(departure
      ? ['Paspor', 'Kontrak kerja', 'COE atau bukti proses COE', 'Rincian kebutuhan keberangkatan']
      : ['Akta kelahiran', 'Dokumen pendidikan', 'Rincian program pelatihan']),
  ].map((documentType) => ({ documentType, status: 'NOT_UPLOADED' as const }))
  const personalDetails = {
    religion: input.religion,
    ...(departure
      ? {
          birthPlace: cleanText(input.birthPlace, 80),
          birthDate,
          gender: input.gender,
          idCardAddress: cleanText(input.idCardAddress, 500),
          domicileSameAsIdCard: false,
          domicileAddress: cleanText(input.domicileAddress, 500),
          domicilePostalCode: cleanText(input.domicilePostalCode, 10),
        }
      : {}),
  }

  try {
    const payload = await getPayload({ config })
    const applicationId = `VSV-APP-${`${Date.now()}`.slice(-8)}`
    const document = await payload.create({
      collection: 'financing-applications',
      overrideAccess: false,
      draft: false,
      data: {
        applicationId,
        product: input.product,
        contractScheme: 'WAKALAH_BIL_UJRAH',
        applicantName,
        phone,
        lpkName,
        personalDetails,
        destination: input.destination,
        eligibility: {
          trainingStarted: input.trainingStarted,
          trainingCompleted: input.trainingCompleted,
          hasPassport: input.hasPassport,
          hasWorkContract: input.hasWorkContract,
          guardianApproval: input.guardianApproval,
          placementPassed: input.placementPassed,
          coeStatus: input.coeStatus,
          visaStatus: input.visaStatus,
          estimatedDeparture: input.estimatedDeparture || undefined,
        },
        fullCoverDetails: departure
          ? undefined
          : {
              languageLevel: input.languageLevel,
              trainingProgram: cleanText(input.trainingProgram, 120),
              trainingStartDate: input.trainingStartDate || undefined,
              languageTrainingMonths: Number(input.languageTrainingMonths) || undefined,
              skillTrainingMonths: Number(input.skillTrainingMonths) || undefined,
              requiresTrainingAllowance: input.requiresTrainingAllowance,
              requiresAccommodation: input.requiresAccommodation,
            },
        departureDetails: departure
          ? {
              outstandingLPKAmount: Number(input.outstandingLPKAmount) || 0,
            }
          : undefined,
        fundingNeeds: (departure ? [] : input.selectedNeeds).map((category) => ({
          category: category as
            | 'LANGUAGE_TRAINING'
            | 'SKILL_TRAINING'
            | 'MEDICAL'
            | 'DOCUMENT'
            | 'LPK_PAYMENT'
            | 'ALLOWANCE'
            | 'TRANSPORT'
            | 'ACCOMMODATION'
            | 'OTHER',
        })),
        financialPlan: departure
          ? {
              nafaqahTotal: 31_350_000,
              ujrahTotal: 10_770_000,
              totalObligation: 42_120_000,
              tenorMonths: 12,
              monthlyInstallment: 3_510_000,
              pricingStatus: 'ESTIMATED',
            }
          : { pricingStatus: 'ESTIMATED' },
        documents,
        understandsWakalah: true,
        acceptsDataProcessing: true,
        status: 'SUBMITTED',
      },
    })
    return { ok: true, applicationId: String(document.applicationId || applicationId) }
  } catch {
    return { ok: false, message: 'Pengajuan belum dapat dikirim. Silakan coba lagi.' }
  }
}
