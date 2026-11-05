'use server'

import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import {
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  hasValidDocumentSignature,
  isAcceptedDocumentType,
} from '@/lib/documents'
import {
  deleteDriveFile,
  getDriveFileInfo,
  readDriveFileHead,
  renameDriveFile,
  sanitizeDriveFolderName,
} from '@/lib/gdrive'

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

const cleanText = (value: unknown, max: number) =>
  (typeof value === 'string' ? value : '').trim().replace(/[<>]/g, '').slice(0, max)
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
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Invalid application')
    input = parsed as ApplicationInput
  } catch {
    return { ok: false, message: 'Data pengajuan tidak valid. Periksa kembali formulir Anda.' }
  }
  if (!['FULL_COVER', 'DEPARTURE_BRIDGING'].includes(input.product)) {
    return { ok: false, message: 'Pilih jenis pengajuan yang valid.' }
  }
  if (!['JAPAN', 'TURKEY'].includes(input.destination)) {
    return { ok: false, message: 'Pilih negara tujuan yang valid.' }
  }
  if (!['MALE', 'FEMALE'].includes(input.gender)) {
    return { ok: false, message: 'Pilih jenis kelamin yang valid.' }
  }
  if (!['NOT_STARTED', 'BASIC_N5', 'N5', 'N4', 'N3_PLUS'].includes(input.languageLevel)) {
    return { ok: false, message: 'Pilih tingkat bahasa yang valid.' }
  }
  if (
    !['NOT_STARTED', 'IN_PROGRESS', 'ISSUED'].includes(input.coeStatus) ||
    !['NOT_STARTED', 'IN_PROGRESS', 'ISSUED'].includes(input.visaStatus)
  ) {
    return { ok: false, message: 'Pilih status dokumen keberangkatan yang valid.' }
  }
  const booleanFields: (keyof ApplicationInput)[] = [
    'domicileSameAsIdCard',
    'trainingStarted',
    'trainingCompleted',
    'hasPassport',
    'hasWorkContract',
    'guardianApproval',
    'placementPassed',
    'requiresTrainingAllowance',
    'requiresAccommodation',
    'understandsWakalah',
    'acceptsDataProcessing',
  ]
  if (booleanFields.some((field) => typeof input[field] !== 'boolean')) {
    return { ok: false, message: 'Beberapa jawaban formulir tidak valid.' }
  }
  if (
    !Array.isArray(input.selectedNeeds) ||
    input.selectedNeeds.some((value) => typeof value !== 'string')
  ) {
    return { ok: false, message: 'Daftar kebutuhan tidak valid.' }
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
  if (departure && cleanText(input.estimatedDeparture, 40) && !estimatedDeparture) {
    return {
      ok: false,
      message: 'Isi perkiraan tanggal keberangkatan dengan format seperti 12 Februari 2026.',
    }
  }
  if (!birthDate || !cleanText(input.birthPlace, 80)) {
    return {
      ok: false,
      message: 'Lengkapi tempat dan tanggal lahir dengan format seperti 12 Februari 2000.',
    }
  }
  if (departure && !input.trainingCompleted) {
    return { ok: false, message: 'Konfirmasi bahwa pelatihan telah selesai.' }
  }
  const idCardAddress = cleanText(input.idCardAddress, 500)
  const domicileSameAsIdCard = Boolean(input.domicileSameAsIdCard)
  const domicileAddress = domicileSameAsIdCard
    ? idCardAddress
    : cleanText(input.domicileAddress, 500)
  if (!idCardAddress || !domicileAddress) {
    return { ok: false, message: 'Lengkapi alamat sesuai KTP dan alamat korespondensi.' }
  }
  const financingAmount = Number(input.financingAmount)
  if (
    departure &&
    (typeof input.financingAmount !== 'string' ||
      input.financingAmount.length > 16 ||
      !Number.isSafeInteger(financingAmount) ||
      financingAmount <= 0)
  ) {
    return { ok: false, message: 'Masukkan estimasi total kebutuhan pembiayaan yang valid.' }
  }
  const definitions = DOCUMENT_DEFINITIONS[input.product]
  if (!definitions) return { ok: false, message: 'Jenis pengajuan tidak valid.' }
  const serializedUploads = request.get('uploads')
  let uploadRefs: { index: number; fileId: string }[]
  try {
    uploadRefs = serializedUploads ? JSON.parse(String(serializedUploads)) : []
  } catch {
    return { ok: false, message: 'Data unggahan tidak valid.' }
  }
  if (!Array.isArray(uploadRefs) || uploadRefs.length > definitions.length) {
    return { ok: false, message: 'Daftar dokumen yang diunggah tidak valid.' }
  }
  const personalDetails = {
    religion: input.religion,
    birthPlace: cleanText(input.birthPlace, 80),
    birthDate,
    gender: input.gender,
    idCardAddress,
    domicileSameAsIdCard,
    domicileAddress,
    domicilePostalCode: cleanText(input.domicilePostalCode, 10),
  }

  let cleanupFileIds: string[] = []
  const rejectUploads = async (message: string): Promise<ApplicationResult> => {
    if (cleanupFileIds.length) {
      await Promise.allSettled(cleanupFileIds.map((fileId) => deleteDriveFile(fileId)))
    }
    cleanupFileIds = []
    return { ok: false, message }
  }
  try {
    const uploadToken = request.get('uploadToken')
    if (typeof uploadToken !== 'string' || !uploadToken) {
      return { ok: false, message: 'Sesi unggah tidak valid. Silakan coba lagi.' }
    }
    const identity = await getFirebaseAuth().verifyIdToken(uploadToken)
    if (identity.firebase?.sign_in_provider !== 'anonymous') {
      return { ok: false, message: 'Sesi unggah tidak valid. Silakan coba lagi.' }
    }
    const uploadIndexes = new Set<number>(
      uploadRefs.filter((ref) => Number.isInteger(ref?.index)).map((ref) => ref.index),
    )
    const missingRequired =
      input.product === 'FULL_COVER'
        ? definitions.find((definition, index) => definition.required && !uploadIndexes.has(index))
        : undefined
    if (missingRequired) {
      return { ok: false, message: `Dokumen ${missingRequired.label} wajib diunggah.` }
    }
    const seenIndexes = new Set<number>()
    const uploadedDocuments: Record<string, unknown>[] = []
    let totalBytes = 0
    const mappingRef = getFirebaseFirestore().collection('driveFolders').doc(identity.uid)
    const mappingSnapshot = await mappingRef.get()
    const mappingData = mappingSnapshot.data()
    const ownedFolderId =
      typeof mappingData?.folderId === 'string' && mappingData.ownerUid === identity.uid
        ? mappingData.folderId
        : ''
    if (uploadRefs.length > 0 && !ownedFolderId) {
      return rejectUploads('Sesi unggahan telah berakhir. Silakan unggah dokumen kembali.')
    }
    for (const ref of uploadRefs) {
      if (
        !Number.isInteger(ref?.index) ||
        ref.index < 0 ||
        ref.index >= definitions.length ||
        seenIndexes.has(ref.index) ||
        typeof ref.fileId !== 'string' ||
        !ref.fileId
      ) {
        return rejectUploads('Daftar dokumen yang diunggah tidak valid.')
      }
      seenIndexes.add(ref.index)
      const definition = definitions[ref.index]
      let info: Awaited<ReturnType<typeof getDriveFileInfo>>
      try {
        info = await getDriveFileInfo(ref.fileId)
      } catch {
        return rejectUploads(`Dokumen ${definition.label} tidak dapat diverifikasi.`)
      }
      if (!(info.parents ?? []).includes(ownedFolderId)) {
        return rejectUploads('Daftar dokumen yang diunggah tidak valid.')
      }
      cleanupFileIds.push(ref.fileId)
      const size = Number(info.size)
      const mimeType = info.mimeType ?? ''
      if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENT_SIZE_BYTES) {
        return rejectUploads(`Ukuran dokumen ${definition.label} tidak valid.`)
      }
      if (!isAcceptedDocumentType(mimeType)) {
        return rejectUploads(`Dokumen ${definition.label}: gunakan PDF, JPG, atau PNG.`)
      }
      let header: Uint8Array
      try {
        header = await readDriveFileHead(ref.fileId)
      } catch {
        return rejectUploads(`Isi dokumen ${definition.label} tidak dapat dibaca.`)
      }
      if (!hasValidDocumentSignature(mimeType, header)) {
        return rejectUploads(`Isi dokumen ${definition.label} tidak sesuai dengan tipe berkasnya.`)
      }
      totalBytes += size
      if (totalBytes > 60 * 1024 * 1024) {
        return rejectUploads('Ukuran seluruh dokumen tidak boleh melebihi 60 MB.')
      }
      uploadedDocuments.push({
        documentType: definition.label,
        status: 'UPLOADED',
        fileId: ref.fileId,
        fileName: cleanText(String(info.name ?? ''), 180) || 'dokumen',
        mimeType,
        size,
      })
    }
    const documents = definitions.map(
      (definition) =>
        uploadedDocuments.find((item) => item.documentType === definition.label) ?? {
          documentType: definition.label,
          status: 'NOT_UPLOADED',
        },
    )
    const allowedNeeds = new Set([
      'LANGUAGE_TRAINING',
      'LANGUAGE_ALLOWANCE',
      'SKILL_TRAINING',
      'SKILL_ALLOWANCE',
      'MEDICAL',
      'DOCUMENT',
      'LPK_PAYMENT',
      'ALLOWANCE',
      'TRANSPORT',
      'ACCOMMODATION',
      'OTHER',
    ])
    const fundingNeeds = (departure ? [] : input.selectedNeeds)
      .filter((category) => allowedNeeds.has(category))
      .map((category) => ({ category }))
    const applicationId = `VSV-APP-${randomUUID().slice(0, 8).toUpperCase()}`
    const applicationRef = getFirebaseFirestore().collection('applications').doc()
    const record = {
      applicationId,
      ownerFirebaseUid: identity.uid,
      product: input.product,
      contractScheme: departure
        ? 'WAKALAH_BIL_UJRAH'
        : input.destination === 'JAPAN'
          ? 'WAKALAH_BIL_UJRAH_AND_JUALAH'
          : 'WAKALAH_BIL_UJRAH',
      applicantName,
      phone,
      lpkName,
      personalDetails,
      destination: input.destination,
      eligibility: {
        trainingStarted: Boolean(input.trainingStarted),
        trainingCompleted: Boolean(input.trainingCompleted),
        hasPassport: Boolean(input.hasPassport),
        hasWorkContract: Boolean(input.hasWorkContract),
        guardianApproval: Boolean(input.guardianApproval),
        placementPassed: Boolean(input.placementPassed),
        coeStatus: input.coeStatus,
        visaStatus: input.visaStatus,
        estimatedDeparture: estimatedDeparture ?? null,
      },
      fullCoverDetails: departure
        ? null
        : {
            languageLevel: input.languageLevel,
            trainingStartDate: input.trainingStartDate || null,
            languageTrainingMonths: Number(input.languageTrainingMonths) || null,
            skillTrainingMonths: Number(input.skillTrainingMonths) || null,
            requiresTrainingAllowance: Boolean(input.requiresTrainingAllowance),
            requiresAccommodation: Boolean(input.requiresAccommodation),
          },
      departureDetails: departure
        ? {
            outstandingLPKAmount: Number(input.outstandingLPKAmount.replace(/\D/g, '')) || 0,
            requestedFinancingAmount: financingAmount,
          }
        : null,
      fundingNeeds,
      financialPlan: departure
        ? { pricingStatus: 'ESTIMATED' }
        : {
            pricingStatus: 'ESTIMATED',
            jualaCondition: input.destination === 'JAPAN' ? 'COE_ISSUED' : 'NOT_CONFIGURED',
            paymentStartCondition:
              input.destination === 'JAPAN' ? 'AFTER_DEPARTURE' : 'NOT_CONFIGURED',
          },
      documents,
      ...(ownedFolderId ? { driveFolderId: ownedFolderId } : {}),
      understandsWakalah: true,
      acceptsDataProcessing: true,
      status: 'SUBMITTED',
      internalNotes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    await applicationRef.set(record)
    if (ownedFolderId) {
      await renameDriveFile(
        ownedFolderId,
        sanitizeDriveFolderName(`${applicantName} - ${applicationId}`),
      )
      await mappingRef
        .update({
          stage: 'submitted',
          applicationId,
          updatedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {})
    }
    cleanupFileIds = []
    return { ok: true, applicationId }
  } catch {
    await rejectUploads('Pengajuan belum dapat dikirim. Silakan coba lagi.')
    return { ok: false, message: 'Pengajuan belum dapat dikirim. Silakan coba lagi.' }
  }
}

export async function discardDriveUploads(uploadToken: string, fileIds: string[]): Promise<void> {
  if (typeof uploadToken !== 'string' || !Array.isArray(fileIds) || fileIds.length > 12) return
  try {
    const identity = await getFirebaseAuth().verifyIdToken(uploadToken)
    if (identity.firebase?.sign_in_provider !== 'anonymous') return

    const firestore = getFirebaseFirestore()
    const ownedFolderIds = new Set<string>()
    const mapping = await firestore.collection('driveFolders').doc(identity.uid).get()
    const mappingFolderId = mapping.data()?.folderId
    if (typeof mappingFolderId === 'string' && mapping.data()?.ownerUid === identity.uid) {
      ownedFolderIds.add(mappingFolderId)
    }
    const applications = await firestore
      .collection('applications')
      .where('ownerFirebaseUid', '==', identity.uid)
      .get()
    applications.docs.forEach((document) => {
      const folderId = document.data()?.driveFolderId
      if (typeof folderId === 'string') ownedFolderIds.add(folderId)
    })

    const safeFileIds = fileIds.filter(
      (fileId) => typeof fileId === 'string' && fileId.length <= 128,
    )
    await Promise.allSettled(
      safeFileIds.map(async (fileId) => {
        const info = await getDriveFileInfo(fileId)
        if ((info.parents ?? []).some((parent) => ownedFolderIds.has(parent))) {
          await deleteDriveFile(fileId)
        }
      }),
    )
  } catch {}
}
