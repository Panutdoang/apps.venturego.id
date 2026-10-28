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

export type ApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; message: string }

const cleanText = (value: string, max: number) => value.trim().replace(/[<>]/g, '').slice(0, max)

export async function submitFinancingApplication(input: ApplicationInput): Promise<ApplicationResult> {
  const applicantName = cleanText(input.applicantName, 100)
  const phone = cleanText(input.phone, 24)
  const lpkName = cleanText(input.lpkName, 120)

  if (!applicantName || !phone || !lpkName) {
    return { ok: false, message: 'Lengkapi nama, nomor WhatsApp, dan nama LPK.' }
  }
  if (!/^(\+62|62|0)[0-9]{8,14}$/.test(phone.replace(/[\s-]/g, ''))) {
    return { ok: false, message: 'Masukkan nomor WhatsApp Indonesia yang valid.' }
  }
  if (!input.understandsWakalah || !input.acceptsDataProcessing) {
    return { ok: false, message: 'Persetujuan akad dan pemrosesan data wajib dicentang.' }
  }

  const departure = input.product === 'DEPARTURE_BRIDGING'
  if (!departure && !cleanText(input.trainingProgram, 120)) {
    return { ok: false, message: 'Lengkapi nama program pelatihan Full Cover.' }
  }
  if (departure && (!input.trainingCompleted || !input.birthDate || !cleanText(input.birthPlace, 80))) {
    return { ok: false, message: 'Konfirmasi pelatihan selesai dan lengkapi tempat serta tanggal lahir.' }
  }
  if (departure && (!cleanText(input.idCardAddress, 500) || !cleanText(input.domicileSameAsIdCard ? input.idCardAddress : input.domicileAddress, 500))) {
    return { ok: false, message: 'Lengkapi alamat KTP dan alamat domisili.' }
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
        personalDetails: departure
          ? {
              birthPlace: cleanText(input.birthPlace, 80),
              birthDate: input.birthDate,
              gender: input.gender,
              idCardAddress: cleanText(input.idCardAddress, 500),
              domicileSameAsIdCard: input.domicileSameAsIdCard,
              domicileAddress: cleanText(input.domicileSameAsIdCard ? input.idCardAddress : input.domicileAddress, 500),
              domicilePostalCode: cleanText(input.domicilePostalCode, 10),
            }
          : undefined,
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
          category: category as 'LANGUAGE_TRAINING' | 'SKILL_TRAINING' | 'MEDICAL' | 'DOCUMENT' | 'LPK_PAYMENT' | 'ALLOWANCE' | 'TRANSPORT' | 'ACCOMMODATION' | 'OTHER',
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
