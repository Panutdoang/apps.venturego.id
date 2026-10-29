'use server'

import config from '@payload-config'
import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { getPayload } from 'payload'
import { calculateWakalahPlan, isFinancingAmount } from '@/lib/financing-plan'
import {
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  isAcceptedDocumentType,
} from '@/lib/documents'

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
  financingAmount: string
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

export async function submitFinancingApplication(request: FormData): Promise<ApplicationResult> {
  let input: ApplicationInput
  try {
    const serialized = request.get('application')
    if (typeof serialized !== 'string') throw new Error('Missing application')
    input = JSON.parse(serialized) as ApplicationInput
  } catch {
    return { ok: false, message: 'Data pengajuan tidak valid. Periksa kembali formulir Anda.' }
  }
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
  const estimatedDeparture = parseIndonesianDate(input.estimatedDeparture)
  if (departure && input.estimatedDeparture.trim() && !estimatedDeparture) {
    return {
      ok: false,
      message: 'Isi perkiraan tanggal keberangkatan dengan format seperti 12 Februari 2026.',
    }
  }
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
  const idCardAddress = cleanText(input.idCardAddress, 500)
  const domicileSameAsIdCard = departure && Boolean(input.domicileSameAsIdCard)
  const domicileAddress = domicileSameAsIdCard
    ? idCardAddress
    : cleanText(input.domicileAddress, 500)
  if (departure && (!idCardAddress || !domicileAddress)) {
    return { ok: false, message: 'Lengkapi alamat sesuai KTP dan alamat korespondensi.' }
  }
  const financingAmount = Number(input.financingAmount)
  if (departure && !isFinancingAmount(financingAmount)) {
    return { ok: false, message: 'Pilih jumlah pembiayaan yang dibutuhkan.' }
  }
  const plan = departure ? calculateWakalahPlan(financingAmount) : null
  const definitions = DOCUMENT_DEFINITIONS[input.product]
  if (!definitions) return { ok: false, message: 'Jenis pengajuan tidak valid.' }
  const uploadedDocuments: { documentType: string; file: string; status: 'UPLOADED' }[] = []
  let totalBytes = 0
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index]
    const candidate = request.get(`document-${index}`)
    if (!(candidate instanceof File) || candidate.size === 0) {
      if (definition.required) {
        return { ok: false, message: `Dokumen ${definition.label} wajib diunggah.` }
      }
      continue
    }
    if (!isAcceptedDocumentType(candidate.type)) {
      return { ok: false, message: `Dokumen ${definition.label}: gunakan PDF, JPG, atau PNG.` }
    }
    if (candidate.size > MAX_DOCUMENT_SIZE_BYTES) {
      return { ok: false, message: `Dokumen ${definition.label} melebihi batas 10 MB.` }
    }
    totalBytes += candidate.size
    if (totalBytes > 60 * 1024 * 1024) {
      return { ok: false, message: 'Ukuran seluruh dokumen tidak boleh melebihi 60 MB.' }
    }
  }
  const personalDetails = {
    religion: input.religion,
    ...(departure
      ? {
          birthPlace: cleanText(input.birthPlace, 80),
          birthDate,
          gender: input.gender,
          idCardAddress,
          domicileSameAsIdCard,
          domicileAddress,
          domicilePostalCode: cleanText(input.domicilePostalCode, 10),
        }
      : {}),
  }

  try {
    const payload = await getPayload({ config })
    const applicationId = `VSV-APP-${randomUUID().slice(0, 8).toUpperCase()}`
    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index]
      const candidate = request.get(`document-${index}`)
      if (!(candidate instanceof File) || candidate.size === 0) continue
      const uploaded = await payload.create({
        collection: 'application-documents',
        overrideAccess: false,
        data: { label: cleanText(definition.label, 120) },
        file: {
          data: Buffer.from(await candidate.arrayBuffer()),
          mimetype: candidate.type,
          name: candidate.name.replace(/[\\/]/g, '_').slice(0, 180),
          size: candidate.size,
        },
      })
      uploadedDocuments.push({
        documentType: definition.label,
        file: String(uploaded.id),
        status: 'UPLOADED',
      })
    }
    const documents = definitions.map((definition) => {
      const uploaded = uploadedDocuments.find((item) => item.documentType === definition.label)
      return uploaded
        ? uploaded
        : { documentType: definition.label, status: 'NOT_UPLOADED' as const }
    })
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
          estimatedDeparture,
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
        financialPlan: plan
          ? {
              nafaqahTotal: plan.nafaqahTotal,
              ujrahTotal: plan.ujrahTotal,
              totalObligation: plan.totalObligation,
              tenorMonths: plan.tenorMonths,
              monthlyInstallment: plan.monthlyInstallment,
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
