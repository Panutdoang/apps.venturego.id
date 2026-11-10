'use server'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { APPLICATION_STATUSES, PRICING_STATUSES } from '@/lib/firebase-data'
import {
  calculateInstallmentSchedule,
  coerceFinancingLines,
  getFinancingLineTotal,
  parseFinancingLines,
  serializeStable,
  type FinancingCostLine,
} from '@/lib/departure-financing'
import { deleteDriveFile, uploadDriveFile } from '@/lib/gdrive'
import { ensureApplicationDriveFolder, promoteApplicationFolder } from '@/lib/drive-folders'
import { buildDocumentFileName } from '@/lib/documents'
import { buildAkadDocument } from '@/lib/akad-document'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import { ensureStudentNumber, studentNumberSequence } from '@/lib/student-number'

type ActionResult = { ok: true } | { ok: false; message: string }

const assertStaffDocumentId = async (
  documentId: string,
): Promise<{ staff: Awaited<ReturnType<typeof getStaffSession>>; error: ActionResult | null }> => {
  const staff = await getStaffSession()
  if (!staff)
    return {
      staff: null,
      error: { ok: false, message: 'Sesi staf berakhir. Silakan masuk kembali.' },
    }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(documentId)) {
    return { staff, error: { ok: false, message: 'Pengajuan tidak valid.' } }
  }
  return { staff, error: null }
}

const appendFinancialHistory = (applicationData: DocumentData, entry: Record<string, unknown>) => {
  const previousHistory = Array.isArray(applicationData.financialPlanHistory)
    ? applicationData.financialPlanHistory
    : []
  return [...previousHistory.slice(-19), entry]
}

const validateDepartureApproval = (
  applicationData: DocumentData,
  plan: Record<string, unknown>,
  nafaqahItems: FinancingCostLine[],
  ujrahItems: FinancingCostLine[],
  refundTotal: number,
  refundEvidenceReference: string,
): string | null => {
  const positiveNafaqah = nafaqahItems.filter((line) => line.amount > 0)
  const positiveUjrah = ujrahItems.filter((line) => line.amount > 0)
  const installmentCount = Number(plan.installmentCount)
  const firstPaymentDate = String(plan.firstPaymentDate ?? '')
  if (
    positiveNafaqah.length === 0 ||
    positiveNafaqah.some((line) => !line.label || !line.recipient || !line.evidenceReference) ||
    positiveUjrah.length === 0 ||
    positiveUjrah.some((line) => !line.label) ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 36 ||
    !firstPaymentDate ||
    (refundTotal > 0 && !refundEvidenceReference)
  ) {
    return 'Lengkapi Nafaqah, Ujrah, jumlah dan tanggal angsuran, serta bukti untuk setiap refund sebelum verifikasi.'
  }
  const estimatedDeparture = applicationData.eligibility?.estimatedDeparture
  if (typeof estimatedDeparture === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(estimatedDeparture)) {
    const [departureYear, departureMonth] = estimatedDeparture.split('-').map(Number)
    const [paymentYear, paymentMonth] = firstPaymentDate.split('-').map(Number)
    if (paymentYear * 12 + paymentMonth <= departureYear * 12 + departureMonth) {
      return 'Tanggal angsuran pertama harus berada pada bulan setelah perkiraan keberangkatan. Perbarui perkiraan jika jadwal keberangkatan berubah.'
    }
  }
  return null
}

const validateFullCoverApproval = (
  applicationData: DocumentData,
  plan: Record<string, unknown>,
): string | null => {
  if (applicationData.destination !== 'JAPAN') {
    return 'Akad contoh hanya menetapkan Ju’alah untuk Jepang; konfirmasi ketentuan negara tujuan terlebih dahulu.'
  }
  const { nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths } = plan as Record<string, number>
  if (
    ![nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths].every(Number.isFinite) ||
    tenorMonths < 1 ||
    tenorMonths > 36
  ) {
    return 'Isi dan verifikasi Nafaqah, Ujrah, Ju’alah, serta tenor sebelum menyetujui biaya.'
  }
  return null
}

export async function updateSupportRequest(
  documentId: string,
  requestIndex: number,
  status: string,
  response: string,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  if (!Number.isInteger(requestIndex) || requestIndex < 0 || requestIndex > 99) {
    return { ok: false, message: 'Permohonan tidak valid.' }
  }
  if (!['OPEN', 'REVIEWED'].includes(status)) {
    return { ok: false, message: 'Pilih status permohonan yang valid.' }
  }
  if (typeof response !== 'string' || response.length > 1_000) {
    return { ok: false, message: 'Tanggapan maksimal 1.000 karakter.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const currentRequests = application.data()?.supportRequests
    if (!Array.isArray(currentRequests) || requestIndex >= currentRequests.length) {
      return {
        ok: false,
        message: 'Permohonan tidak ditemukan. Muat ulang halaman sebelum menyimpan.',
      }
    }
    const supportRequests = currentRequests.map(
      (request: Record<string, unknown>, index: number) =>
        index === requestIndex ? { ...request, status, response: response.trim() } : request,
    )
    await applicationRef.update({
      supportRequests,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Permohonan belum dapat disimpan. Coba lagi.' }
  }
}

export async function saveFinancialPlan(
  documentId: string,
  financialValues: Record<string, string>,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  const financialFields = [
    'nafaqahTotal',
    'ujrahTotal',
    'totalObligation',
    'jualaTotal',
    'tenorMonths',
    'monthlyInstallment',
    'qardhAmount',
    'installmentCount',
  ] as const
  const financialNumbers: Partial<Record<(typeof financialFields)[number], number>> = {}
  for (const field of financialFields) {
    const value = financialValues?.[field]
    if (typeof value !== 'string' || value.length > 20) {
      return { ok: false, message: 'Rincian biaya tidak valid.' }
    }
    if (value.trim() === '') continue
    if (!/^\d+$/.test(value)) {
      return { ok: false, message: 'Masukkan angka yang valid pada rincian biaya.' }
    }
    financialNumbers[field] = Number(value)
    if (!Number.isSafeInteger(financialNumbers[field])) {
      return { ok: false, message: 'Masukkan angka yang valid pada rincian biaya.' }
    }
  }
  if (
    financialNumbers.tenorMonths !== undefined &&
    (!Number.isInteger(financialNumbers.tenorMonths) ||
      financialNumbers.tenorMonths < 1 ||
      financialNumbers.tenorMonths > 36)
  ) {
    return { ok: false, message: 'Tenor harus antara 1 dan 36 bulan.' }
  }
  const textFields = [
    'nafaqahItems',
    'ujrahItems',
    'qardhDisbursed',
    'firstPaymentDate',
    'finalAgreementReference',
    'settlementNotes',
    'refundEvidenceReference',
    'refundTotal',
    'nikNumber',
  ] as const
  if (textFields.some((field) => typeof financialValues?.[field] !== 'string')) {
    return { ok: false, message: 'Rincian akad atau penyelesaian tidak valid.' }
  }
  const nafaqahItems = parseFinancingLines(financialValues?.nafaqahItems ?? '')
  const ujrahItems = parseFinancingLines(financialValues?.ujrahItems ?? '')
  if (!nafaqahItems || !ujrahItems) {
    return { ok: false, message: 'Rincian Nafaqah atau Ujrah tidak valid.' }
  }
  const qardhDisbursed = financialValues?.qardhDisbursed === 'true'
  const firstPaymentDate = financialValues?.firstPaymentDate ?? ''
  const finalAgreementReference = financialValues?.finalAgreementReference?.trim() ?? ''
  const settlementNotes = financialValues?.settlementNotes?.trim() ?? ''
  const refundEvidenceReference = financialValues?.refundEvidenceReference?.trim() ?? ''
  const refundValue = financialValues?.refundTotal ?? ''
  if (
    !['true', 'false'].includes(financialValues?.qardhDisbursed ?? '') ||
    firstPaymentDate.length > 10 ||
    finalAgreementReference.length > 300 ||
    settlementNotes.length > 1_000 ||
    refundEvidenceReference.length > 300 ||
    refundValue.length > 20 ||
    (refundValue !== '' && !/^\d+$/.test(refundValue))
  ) {
    return { ok: false, message: 'Rincian akad atau penyelesaian tidak valid.' }
  }
  const refundTotal = refundValue === '' ? 0 : Number(refundValue)
  if (!Number.isSafeInteger(refundTotal)) {
    return { ok: false, message: 'Nominal pengembalian tidak valid.' }
  }
  const nikValue = financialValues.nikNumber.trim()
  if (nikValue.length > 20 || !/^\d*$/.test(nikValue)) {
    return { ok: false, message: 'NIK tidak valid. Masukkan digit saja (maksimal 20 karakter).' }
  }
  if (firstPaymentDate && !calculateInstallmentSchedule(0, 1, firstPaymentDate)) {
    return { ok: false, message: 'Tanggal angsuran pertama tidak valid.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const applicationData = application.data() ?? {}
    if (applicationData.financialPlan?.akadDocument) {
      return { ok: false, message: 'Dokumen akad telah terbit. Rincian biaya terkunci.' }
    }
    const currentPricingStatus = String(applicationData.financialPlan?.pricingStatus ?? 'ESTIMATED')
    if (!PRICING_STATUSES.includes(currentPricingStatus as (typeof PRICING_STATUSES)[number])) {
      return { ok: false, message: 'Status biaya tidak valid. Muat ulang halaman.' }
    }
    const applicationProduct = applicationData.product
    const existingFinancialPlan = applicationData.financialPlan ?? {}
    const sharedNumbers = { ...financialNumbers }
    delete sharedNumbers.qardhAmount
    delete sharedNumbers.installmentCount
    const nextFinancialPlan = {
      ...existingFinancialPlan,
      ...(applicationProduct === 'DEPARTURE_BRIDGING' ? financialNumbers : sharedNumbers),
    }
    let updateValues: Record<string, unknown> = {}
    if (applicationProduct === 'DEPARTURE_BRIDGING') {
      const nafaqahTotal = getFinancingLineTotal(nafaqahItems)
      const ujrahTotal = getFinancingLineTotal(ujrahItems)
      const qardhAmount = financialNumbers.qardhAmount ?? 0
      if (
        !Number.isSafeInteger(nafaqahTotal) ||
        !Number.isSafeInteger(ujrahTotal) ||
        refundTotal > nafaqahTotal
      ) {
        return { ok: false, message: 'Total biaya atau refund tidak valid.' }
      }
      if (qardhAmount > 0 && !qardhDisbursed) {
        return {
          ok: false,
          message:
            'Uang saku qardh hanya dapat dicatat setelah benar-benar diserahkan kepada pemohon.',
        }
      }
      if (currentPricingStatus === 'VERIFIED' || currentPricingStatus === 'AGREED') {
        const approvalError = validateDepartureApproval(
          applicationData,
          nextFinancialPlan,
          nafaqahItems,
          ujrahItems,
          refundTotal,
          refundEvidenceReference,
        )
        if (approvalError) return { ok: false, message: approvalError }
      }
      const totalObligation = nafaqahTotal + ujrahTotal + qardhAmount - refundTotal
      if (!Number.isSafeInteger(totalObligation) || totalObligation < 0) {
        return { ok: false, message: 'Total kewajiban setelah potongan tidak valid.' }
      }
      const installmentCount = financialNumbers.installmentCount ?? 0
      const schedule =
        installmentCount > 0 && firstPaymentDate
          ? calculateInstallmentSchedule(totalObligation, installmentCount, firstPaymentDate)
          : null
      if (installmentCount > 0 && !schedule) {
        return { ok: false, message: 'Jadwal angsuran tidak valid.' }
      }
      if (
        currentPricingStatus === 'AGREED' &&
        (!applicationData.userFinancingAcceptance ||
          typeof applicationData.userFinancingAcceptance.acceptedAt !== 'string' ||
          !finalAgreementReference)
      ) {
        return {
          ok: false,
          message:
            'Status Disepakati memerlukan persetujuan pemohon dan referensi akad final yang telah ditandatangani.',
        }
      }
      const offerSnapshot = {
        nafaqahItems,
        ujrahItems,
        nafaqahTotal,
        ujrahTotal,
        qardhAmount,
        qardhDisbursed,
        refundTotal,
        totalObligation,
        installmentCount,
        firstPaymentDate,
        schedule,
        refundEvidenceReference,
      }
      const previousOffer = applicationData.financialPlan?.offerSnapshot
      const offerChanged = serializeStable(previousOffer ?? null) !== serializeStable(offerSnapshot)
      const effectiveAgreementReference =
        offerChanged || currentPricingStatus === 'ESTIMATED' ? '' : finalAgreementReference
      const currentAcceptance = applicationData.userFinancingAcceptance as
        | { acceptedAt?: unknown; offerSnapshot?: unknown }
        | undefined
      if (
        currentPricingStatus === 'AGREED' &&
        (offerChanged ||
          typeof currentAcceptance?.acceptedAt !== 'string' ||
          serializeStable(currentAcceptance.offerSnapshot) !== serializeStable(offerSnapshot) ||
          !finalAgreementReference)
      ) {
        return {
          ok: false,
          message:
            'Status Disepakati memerlukan persetujuan pemohon atas rincian terbaru dan referensi akad final yang telah ditandatangani.',
        }
      }
      Object.assign(nextFinancialPlan, offerSnapshot, {
        offerSnapshot,
        pricingStatus: currentPricingStatus,
        finalAgreementReference: effectiveAgreementReference,
        settlementNotes,
      })
      if (currentPricingStatus === 'ESTIMATED' || offerChanged) {
        updateValues.userFinancingAcceptance = FieldValue.delete()
      }
      if (
        applicationData.status === 'CANCELLED' &&
        currentPricingStatus === 'AGREED' &&
        !settlementNotes
      ) {
        return {
          ok: false,
          message:
            'Catat perhitungan Nafaqah yang tidak dapat dipulihkan, jasa yang telah terlaksana, dan refund sebelum menyelesaikan pembatalan.',
        }
      }
      updateValues.financialPlanHistory = appendFinancialHistory(applicationData, {
        changedAt: new Date().toISOString(),
        changedBy: staff?.email ?? staff?.uid,
        financialPlan: offerSnapshot,
        pricingStatus: currentPricingStatus,
        finalAgreementReference: effectiveAgreementReference,
        settlementNotes,
      })
    }
    if (
      applicationProduct === 'FULL_COVER' &&
      (currentPricingStatus === 'VERIFIED' || currentPricingStatus === 'AGREED')
    ) {
      const approvalError = validateFullCoverApproval(applicationData, nextFinancialPlan)
      if (approvalError) return { ok: false, message: approvalError }
      const { nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths } = nextFinancialPlan as Record<
        string,
        number
      >
      const totalObligation = nafaqahTotal + ujrahTotal
      const totalObligationIfCoe = totalObligation + jualaTotal
      const monthlyInstallmentAfterCoe = Math.floor(totalObligationIfCoe / tenorMonths)
      Object.assign(nextFinancialPlan, {
        totalObligation,
        totalObligationIfCoe,
        monthlyInstallmentAfterCoe,
        finalInstallmentAfterCoe:
          totalObligationIfCoe - monthlyInstallmentAfterCoe * (tenorMonths - 1),
        jualaCondition: nextFinancialPlan.jualaCondition ?? 'COE_ISSUED',
        paymentStartCondition: nextFinancialPlan.paymentStartCondition ?? 'AFTER_DEPARTURE',
      })
    }
    if (applicationProduct === 'FULL_COVER') {
      const derivedKeys = [
        'totalObligation',
        'totalObligationIfCoe',
        'monthlyInstallmentAfterCoe',
        'finalInstallmentAfterCoe',
      ] as const
      const fcSnapshot: Record<string, unknown> = {
        nafaqahTotal: Number(nextFinancialPlan.nafaqahTotal) || 0,
        ujrahTotal: Number(nextFinancialPlan.ujrahTotal) || 0,
        jualaTotal: Number(nextFinancialPlan.jualaTotal) || 0,
        tenorMonths: Number(nextFinancialPlan.tenorMonths) || 0,
      }
      for (const key of derivedKeys) {
        if (Number.isFinite(Number(nextFinancialPlan[key]))) {
          fcSnapshot[key] = Number(nextFinancialPlan[key])
        }
      }
      const previousOffer = applicationData.financialPlan?.offerSnapshot
      const offerChanged = serializeStable(previousOffer ?? null) !== serializeStable(fcSnapshot)
      Object.assign(nextFinancialPlan, { offerSnapshot: fcSnapshot })
      if (offerChanged) {
        updateValues.userFinancingAcceptance = FieldValue.delete()
      }
      updateValues.financialPlanHistory = appendFinancialHistory(applicationData, {
        changedAt: new Date().toISOString(),
        changedBy: staff?.email ?? staff?.uid,
        financialPlan: fcSnapshot,
        pricingStatus: currentPricingStatus,
        finalAgreementReference: String(nextFinancialPlan.finalAgreementReference ?? ''),
        settlementNotes: String(nextFinancialPlan.settlementNotes ?? ''),
      })
    }
    const existingPersonal = (applicationData.personalDetails ?? {}) as Record<string, unknown>
    const existingNik =
      typeof existingPersonal.idCardNumber === 'string' ? existingPersonal.idCardNumber : ''
    if (nikValue !== existingNik) {
      updateValues.personalDetails = { ...existingPersonal, idCardNumber: nikValue }
    }
    await applicationRef.update({
      financialPlan: { ...nextFinancialPlan, pricingStatus: currentPricingStatus },
      ...updateValues,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Rincian biaya belum dapat disimpan. Coba lagi.' }
  }
}

export async function updateApplicationWorkflow(
  documentId: string,
  status: string,
  internalNotes: string,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
    return { ok: false, message: 'Pilih status pengajuan yang valid.' }
  }
  if (typeof internalNotes !== 'string' || internalNotes.length > 2_000) {
    return { ok: false, message: 'Catatan internal maksimal 2.000 karakter.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const applicationData = application.data() ?? {}
    if (
      status === 'CANCELLED' &&
      String(applicationData.financialPlan?.pricingStatus ?? '') === 'AGREED' &&
      !String(applicationData.financialPlan?.settlementNotes ?? '').trim()
    ) {
      return {
        ok: false,
        message:
          'Catat perhitungan Nafaqah yang tidak dapat dipulihkan, jasa yang telah terlaksana, dan refund sebelum menyelesaikan pembatalan.',
      }
    }
    await applicationRef.update({
      status,
      internalNotes: internalNotes.trim(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    if (status === 'ACTIVE' && applicationData.status !== 'ACTIVE') {
      const ownerUid =
        typeof applicationData.ownerFirebaseUid === 'string' ? applicationData.ownerFirebaseUid : ''
      const applicantName =
        typeof applicationData.applicantName === 'string' ? applicationData.applicantName : ''
      if (ownerUid && applicantName) {
        const currentDocuments = Array.isArray(applicationData.documents)
          ? applicationData.documents
          : []
        const driveFiles = currentDocuments
          .filter((document: Record<string, unknown>) => typeof document.fileId === 'string')
          .map((document: Record<string, unknown>) => ({
            fileId: String(document.fileId),
            fileName: typeof document.fileName === 'string' ? document.fileName : '',
            label: String(document.documentType ?? ''),
          }))
        const agreementPdf = applicationData.agreementPdf
        if (agreementPdf && typeof agreementPdf.fileId === 'string') {
          driveFiles.push({
            fileId: String(agreementPdf.fileId),
            fileName: typeof agreementPdf.fileName === 'string' ? agreementPdf.fileName : '',
            label: 'Akad Wakalah bil Ujrah',
          })
        }
        await promoteApplicationFolder({
          folderId:
            typeof applicationData.driveFolderId === 'string' ? applicationData.driveFolderId : '',
          ownerUid,
          applicantName,
          files: driveFiles,
        })
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Status belum dapat disimpan. Coba lagi.' }
  }
}

export async function approveApplicationDocument(
  documentId: string,
  documentIndex: number,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex > 60) {
    return { ok: false, message: 'Dokumen tidak valid.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const currentDocuments = application.data()?.documents
    if (!Array.isArray(currentDocuments) || documentIndex >= currentDocuments.length) {
      return { ok: false, message: 'Dokumen tidak ditemukan.' }
    }
    const target = currentDocuments[documentIndex]
    if (!target || typeof target.fileId !== 'string') {
      return { ok: false, message: 'Berkas belum diunggah untuk dokumen ini.' }
    }
    const documents = currentDocuments.map((document: Record<string, unknown>, index: number) =>
      index === documentIndex ? { ...document, status: 'VERIFIED' } : document,
    )
    await applicationRef.update({
      documents,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Status dokumen belum dapat disimpan. Coba lagi.' }
  }
}

export async function deleteApplicationDocument(
  documentId: string,
  documentIndex: number,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex > 60) {
    return { ok: false, message: 'Dokumen tidak valid.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const currentDocuments = application.data()?.documents
    if (!Array.isArray(currentDocuments) || documentIndex >= currentDocuments.length) {
      return { ok: false, message: 'Dokumen tidak ditemukan.' }
    }
    const target = currentDocuments[documentIndex]
    if (!target || typeof target.fileId !== 'string') {
      return { ok: false, message: 'Berkas tidak ditemukan.' }
    }
    const fileId = target.fileId
    try {
      await deleteDriveFile(fileId)
    } catch {
      // Best-effort: rekaman tetap diperbarui bila Drive sedang tidak tersedia.
    }
    const documents = currentDocuments.map((document: Record<string, unknown>, index: number) => {
      if (index !== documentIndex) return document
      const next: Record<string, unknown> = { ...document, status: 'REVISION_REQUIRED' }
      delete next.fileId
      delete next.fileName
      delete next.mimeType
      delete next.size
      return next
    })
    await applicationRef.update({
      documents,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Dokumen belum dapat dihapus. Coba lagi.' }
  }
}

const scaleFinancingLines = (lines: FinancingCostLine[], factor: number): FinancingCostLine[] =>
  lines.map((line) =>
    line.amount > 0
      ? { ...line, amount: Math.max(1, Math.round(line.amount * factor)) }
      : { ...line },
  )

const adjustLastPositiveLine = (
  lines: FinancingCostLine[],
  diff: number,
): FinancingCostLine[] | null => {
  if (diff === 0) return lines
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (line.amount <= 0) continue
    const nextAmount = line.amount + diff
    if (nextAmount >= 1 && Number.isSafeInteger(nextAmount)) {
      const copy = [...lines]
      copy[index] = { ...line, amount: nextAmount }
      return copy
    }
  }
  return null
}

const buildDepartureOfferSnapshot = (
  nafaqahItems: FinancingCostLine[],
  ujrahItems: FinancingCostLine[],
  qardhAmount: number,
  qardhDisbursed: boolean,
  refundTotal: number,
  refundEvidenceReference: string,
  installmentCount: number,
  firstPaymentDate: string,
): { snapshot: Record<string, unknown>; error: string | null } => {
  const nafaqahTotal = getFinancingLineTotal(nafaqahItems)
  const ujrahTotal = getFinancingLineTotal(ujrahItems)
  const totalObligation = nafaqahTotal + ujrahTotal + qardhAmount - refundTotal
  if (!Number.isSafeInteger(totalObligation) || totalObligation < 0) {
    return { snapshot: {}, error: 'Total kewajiban setelah potongan tidak valid.' }
  }
  const schedule =
    installmentCount > 0 && firstPaymentDate
      ? calculateInstallmentSchedule(totalObligation, installmentCount, firstPaymentDate)
      : null
  if (installmentCount > 0 && !schedule) {
    return { snapshot: {}, error: 'Jadwal angsuran tidak valid.' }
  }
  return {
    snapshot: {
      nafaqahItems,
      ujrahItems,
      nafaqahTotal,
      ujrahTotal,
      qardhAmount,
      qardhDisbursed,
      refundTotal,
      totalObligation,
      installmentCount,
      firstPaymentDate,
      schedule,
      refundEvidenceReference,
    },
    error: null,
  }
}

export async function approveApplicationPricing(
  documentId: string,
  newNominal: number | null,
): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  if (
    newNominal !== null &&
    (!Number.isSafeInteger(newNominal) || newNominal < 1 || newNominal > 10_000_000_000)
  ) {
    return { ok: false, message: 'Nominal baru tidak valid.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const applicationData = application.data() ?? {}
    if (applicationData.financialPlan?.akadDocument) {
      return { ok: false, message: 'Dokumen akad telah terbit. Rincian biaya terkunci.' }
    }
    const product = applicationData.product
    const plan = { ...(applicationData.financialPlan ?? {}) } as Record<string, unknown>
    const previousOffer = plan.offerSnapshot
    let nextPlan: Record<string, unknown> = { ...plan }
    let offerSnapshot: Record<string, unknown>

    if (product === 'DEPARTURE_BRIDGING') {
      const requested = applicationData.departureDetails?.requestedFinancingAmount
      const requestedNumber =
        typeof requested === 'number' && Number.isSafeInteger(requested) && requested > 0
          ? requested
          : 0
      const parsedNafaqah = coerceFinancingLines(plan.nafaqahItems)
      const parsedUjrah = coerceFinancingLines(plan.ujrahItems)
      const hasPositiveNafaqah = Boolean(
        parsedNafaqah && parsedNafaqah.some((line) => line.amount > 0),
      )
      const hasPositiveUjrah = Boolean(parsedUjrah && parsedUjrah.some((line) => line.amount > 0))
      const refCode = String(applicationData.applicationId || documentId).slice(0, 120)
      const defaultRecipient =
        String(applicationData.lpkName || 'LPK Mitra')
          .trim()
          .slice(0, 120) || 'LPK Mitra'
      const nafaqahItems: FinancingCostLine[] | null = hasPositiveNafaqah
        ? parsedNafaqah
        : requestedNumber > 0
          ? [
              {
                label: 'Dana talangan keberangkatan (Nafaqah)',
                recipient: defaultRecipient,
                amount: requestedNumber,
                evidenceReference: `EST-${refCode}`,
              },
            ]
          : null
      const ujrahItems: FinancingCostLine[] | null = hasPositiveUjrah
        ? parsedUjrah
        : requestedNumber > 0
          ? [
              {
                label: 'Ujrah pengurusan Wakalah (2,4% × 12 bulan)',
                recipient: 'VentureGo VSV',
                amount: Math.max(1, Math.round(requestedNumber * 0.024) * 12),
                evidenceReference: `UJR-${refCode}`,
              },
            ]
          : null
      if (!nafaqahItems || !ujrahItems || nafaqahItems.length === 0 || ujrahItems.length === 0) {
        return {
          ok: false,
          message: 'Lengkapi rincian Nafaqah dan Ujrah pada tab Draft Akad sebelum menyetujui.',
        }
      }
      const qardhAmount = Number(plan.qardhAmount) || 0
      const qardhDisbursed = plan.qardhDisbursed === true
      const refundTotal = Number(plan.refundTotal) || 0
      const refundEvidenceReference = String(plan.refundEvidenceReference ?? '').trim()
      const rawInstallmentCount = Number(plan.installmentCount)
      const installmentCount =
        Number.isInteger(rawInstallmentCount) &&
        rawInstallmentCount >= 1 &&
        rawInstallmentCount <= 36
          ? rawInstallmentCount
          : 12
      let firstPaymentDate = String(plan.firstPaymentDate ?? '').trim()
      if (!firstPaymentDate) {
        const estimatedDeparture = applicationData.eligibility?.estimatedDeparture
        if (
          typeof estimatedDeparture === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(estimatedDeparture)
        ) {
          const [depYear, depMonth] = estimatedDeparture.split('-').map(Number)
          const nextYear = depMonth === 12 ? depYear + 1 : depYear
          const nextMonth = depMonth === 12 ? 1 : depMonth + 1
          firstPaymentDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
        } else {
          const now = new Date()
          const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1))
          firstPaymentDate = nextDate.toISOString().slice(0, 10)
        }
      }
      plan.installmentCount = installmentCount
      plan.firstPaymentDate = firstPaymentDate
      let scaledNafaqah = nafaqahItems
      let scaledUjrah = ujrahItems
      if (newNominal !== null) {
        if (requestedNumber > 0 && newNominal > requestedNumber) {
          return {
            ok: false,
            message: `Nominal baru tidak boleh melebihi nominal yang diajukan siswa (Rp${requestedNumber.toLocaleString('id-ID')}).`,
          }
        }
        const linesTotal = getFinancingLineTotal(nafaqahItems) + getFinancingLineTotal(ujrahItems)
        if (linesTotal <= 0) {
          return {
            ok: false,
            message: 'Total rincian biaya masih nol. Isi rincian pada tab Draft Akad.',
          }
        }
        const desiredLines = newNominal - qardhAmount + refundTotal
        if (desiredLines <= 0) {
          return {
            ok: false,
            message: 'Nominal baru terlalu kecil dibanding qardh dan refund yang tercatat.',
          }
        }
        const factor = desiredLines / linesTotal
        scaledNafaqah = scaleFinancingLines(nafaqahItems, factor)
        scaledUjrah = scaleFinancingLines(ujrahItems, factor)
        const scaledTotal =
          getFinancingLineTotal(scaledNafaqah) + getFinancingLineTotal(scaledUjrah)
        const diff = desiredLines - scaledTotal
        const adjustedNafaqah = adjustLastPositiveLine(scaledNafaqah, diff)
        if (adjustedNafaqah) {
          scaledNafaqah = adjustedNafaqah
        } else {
          const adjustedUjrah = adjustLastPositiveLine(scaledUjrah, diff)
          if (!adjustedUjrah) {
            return {
              ok: false,
              message:
                'Nominal baru tidak dapat dibagi ke rincian biaya. Ubah nominal atau rincian terlebih dahulu.',
            }
          }
          scaledUjrah = adjustedUjrah
        }
        const finalTotal = getFinancingLineTotal(scaledNafaqah) + getFinancingLineTotal(scaledUjrah)
        if (finalTotal !== desiredLines) {
          return {
            ok: false,
            message:
              'Nominal baru tidak dapat dibagi ke rincian biaya. Ubah nominal atau rincian terlebih dahulu.',
          }
        }
      }
      const approvalError = validateDepartureApproval(
        applicationData,
        plan,
        scaledNafaqah,
        scaledUjrah,
        refundTotal,
        refundEvidenceReference,
      )
      if (approvalError) return { ok: false, message: approvalError }
      const built = buildDepartureOfferSnapshot(
        scaledNafaqah,
        scaledUjrah,
        qardhAmount,
        qardhDisbursed,
        refundTotal,
        refundEvidenceReference,
        installmentCount,
        firstPaymentDate,
      )
      if (built.error) return { ok: false, message: built.error }
      offerSnapshot = built.snapshot
      const offerChanged = serializeStable(previousOffer ?? null) !== serializeStable(offerSnapshot)
      const effectiveReference = offerChanged ? '' : String(plan.finalAgreementReference ?? '')
      nextPlan = {
        ...plan,
        ...offerSnapshot,
        offerSnapshot,
        pricingStatus: 'VERIFIED',
        finalAgreementReference: effectiveReference,
      }
      await applicationRef.update({
        financialPlan: nextPlan,
        ...buildApprovalUpdateValues(
          applicationData,
          offerSnapshot,
          offerChanged,
          'VERIFIED',
          staff,
          effectiveReference,
          String(plan.settlementNotes ?? ''),
        ),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: staff?.email ?? staff?.uid,
      })
      return { ok: true }
    }

    if (product === 'FULL_COVER') {
      let nafaqahTotal = Number(plan.nafaqahTotal)
      let ujrahTotal = Number(plan.ujrahTotal)
      const jualaTotal = Number(plan.jualaTotal)
      const tenorMonths = Number(plan.tenorMonths)
      if (![nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths].every(Number.isFinite)) {
        return {
          ok: false,
          message:
            'Lengkapi Nafaqah, Ujrah, Ju’alah, dan tenor pada tab Draft Akad sebelum menyetujui.',
        }
      }
      if (newNominal !== null) {
        const base = nafaqahTotal + ujrahTotal
        if (base <= 0) {
          return {
            ok: false,
            message: 'Total Nafaqah dan Ujrah masih nol. Isi rincian pada tab Draft Akad.',
          }
        }
        const factor = newNominal / base
        const scaledNafaqah = Math.max(1, Math.round(nafaqahTotal * factor))
        const scaledUjrah = newNominal - scaledNafaqah
        if (scaledUjrah < 1) {
          return { ok: false, message: 'Nominal baru tidak dapat dibagi ke Nafaqah dan Ujrah.' }
        }
        nafaqahTotal = scaledNafaqah
        ujrahTotal = scaledUjrah
      }
      const approvalError = validateFullCoverApproval(applicationData, {
        ...plan,
        nafaqahTotal,
        ujrahTotal,
        jualaTotal,
        tenorMonths,
      })
      if (approvalError) return { ok: false, message: approvalError }
      const totalObligation = nafaqahTotal + ujrahTotal
      const totalObligationIfCoe = totalObligation + jualaTotal
      const monthlyInstallmentAfterCoe = Math.floor(totalObligationIfCoe / tenorMonths)
      offerSnapshot = {
        nafaqahTotal,
        ujrahTotal,
        jualaTotal,
        tenorMonths,
        totalObligation,
        totalObligationIfCoe,
        monthlyInstallmentAfterCoe,
        finalInstallmentAfterCoe:
          totalObligationIfCoe - monthlyInstallmentAfterCoe * (tenorMonths - 1),
        jualaCondition: plan.jualaCondition ?? 'COE_ISSUED',
        paymentStartCondition: plan.paymentStartCondition ?? 'AFTER_DEPARTURE',
      }
      const offerChanged = serializeStable(previousOffer ?? null) !== serializeStable(offerSnapshot)
      nextPlan = {
        ...plan,
        ...offerSnapshot,
        offerSnapshot,
        pricingStatus: 'VERIFIED',
        finalAgreementReference: offerChanged ? '' : String(plan.finalAgreementReference ?? ''),
      }
      await applicationRef.update({
        financialPlan: nextPlan,
        ...buildApprovalUpdateValues(
          applicationData,
          offerSnapshot,
          offerChanged,
          'VERIFIED',
          staff,
        ),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: staff?.email ?? staff?.uid,
      })
      return { ok: true }
    }

    return { ok: false, message: 'Jenis pengajuan tidak dikenal.' }
  } catch {
    return { ok: false, message: 'Status biaya belum dapat disetujui. Coba lagi.' }
  }
}

type StaffContext = { email?: string; uid: string } | null

const buildApprovalUpdateValues = (
  applicationData: DocumentData,
  offerSnapshot: Record<string, unknown>,
  offerChanged: boolean,
  pricingStatus: string,
  staff: StaffContext,
  finalAgreementReference?: string,
  settlementNotes?: string,
): Record<string, unknown> => {
  const values: Record<string, unknown> = {}
  if (offerChanged) {
    values.userFinancingAcceptance = FieldValue.delete()
  }
  values.financialPlanHistory = appendFinancialHistory(applicationData, {
    changedAt: new Date().toISOString(),
    changedBy: staff?.email ?? staff?.uid,
    financialPlan: offerSnapshot,
    pricingStatus,
    finalAgreementReference: finalAgreementReference ?? '',
    settlementNotes: settlementNotes ?? '',
  })
  return values
}

export async function setApplicationPricingAgreed(documentId: string): Promise<ActionResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const applicationData = application.data() ?? {}
    const product = applicationData.product
    const plan = { ...(applicationData.financialPlan ?? {}) } as Record<string, unknown>
    const finalAgreementReference = String(plan.finalAgreementReference ?? '').trim()
    const settlementNotes = String(plan.settlementNotes ?? '').trim()
    let offerSnapshot: Record<string, unknown>

    if (product === 'DEPARTURE_BRIDGING') {
      const nafaqahItems = coerceFinancingLines(plan.nafaqahItems)
      const ujrahItems = coerceFinancingLines(plan.ujrahItems)
      if (!nafaqahItems || !ujrahItems) {
        return { ok: false, message: 'Rincian Nafaqah atau Ujrah tidak valid.' }
      }
      const approvalError = validateDepartureApproval(
        applicationData,
        plan,
        nafaqahItems,
        ujrahItems,
        Number(plan.refundTotal) || 0,
        String(plan.refundEvidenceReference ?? '').trim(),
      )
      if (approvalError) return { ok: false, message: approvalError }
      if (!finalAgreementReference) {
        return {
          ok: false,
          message:
            'Isi referensi akad final yang sudah ditandatangani pada tab Draft Akad sebelum menyetujui.',
        }
      }
      const acceptance = applicationData.userFinancingAcceptance as
        | { acceptedAt?: unknown; offerSnapshot?: unknown }
        | undefined
      if (!acceptance || typeof acceptance.acceptedAt !== 'string') {
        return {
          ok: false,
          message: 'Status Disepakati memerlukan persetujuan pemohon atas penawaran terbaru.',
        }
      }
      if (
        serializeStable(acceptance.offerSnapshot) !== serializeStable(plan.offerSnapshot ?? null)
      ) {
        return {
          ok: false,
          message:
            'Persetujuan pemohon berlaku untuk rincian terbaru. Mintakan persetujuan ulang setelah rincian berubah.',
        }
      }
      offerSnapshot = (plan.offerSnapshot as Record<string, unknown>) ?? {}
    } else if (product === 'FULL_COVER') {
      const approvalError = validateFullCoverApproval(applicationData, plan)
      if (approvalError) return { ok: false, message: approvalError }
      offerSnapshot = (plan.offerSnapshot as Record<string, unknown>) ?? {}
    } else {
      return { ok: false, message: 'Jenis pengajuan tidak dikenal.' }
    }

    await applicationRef.update({
      financialPlan: { ...plan, pricingStatus: 'AGREED' },
      financialPlanHistory: appendFinancialHistory(applicationData, {
        changedAt: new Date().toISOString(),
        changedBy: staff?.email ?? staff?.uid,
        financialPlan: offerSnapshot,
        pricingStatus: 'AGREED',
        finalAgreementReference,
        settlementNotes,
      }),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff?.email ?? staff?.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Status biaya belum dapat disimpan. Coba lagi.' }
  }
}

type IssueAkadResult =
  | { ok: true; documentNumber: string; studentNumber: string }
  | { ok: false; message: string }

export async function issueAkadDocument(documentId: string): Promise<IssueAkadResult> {
  const { staff, error } = await assertStaffDocumentId(documentId)
  if (error) return error.ok ? { ok: false, message: 'Sesi staf berakhir.' } : error
  try {
    const firestore = getFirebaseFirestore()
    const applicationRef = firestore.collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const applicationData = application.data() ?? {}
    const plan = { ...(applicationData.financialPlan ?? {}) } as Record<string, unknown>
    if (plan.akadDocument) {
      return { ok: false, message: 'Dokumen akad sudah terbit untuk pengajuan ini.' }
    }
    const pricingStatus = String(plan.pricingStatus ?? '')
    if (pricingStatus !== 'VERIFIED' && pricingStatus !== 'AGREED') {
      return {
        ok: false,
        message: 'Terbitkan dokumen akad setelah rincian biaya berstatus Terverifikasi.',
      }
    }
    const product = String(applicationData.product ?? '')
    if (product === 'DEPARTURE_BRIDGING') {
      const nafaqahItems = coerceFinancingLines(plan.nafaqahItems)
      const ujrahItems = coerceFinancingLines(plan.ujrahItems)
      if (
        !nafaqahItems ||
        !ujrahItems ||
        getFinancingLineTotal(nafaqahItems) <= 0 ||
        getFinancingLineTotal(ujrahItems) <= 0
      ) {
        return {
          ok: false,
          message:
            'Lengkapi rincian Nafaqah dan Ujrah pada tab Draft Akad sebelum menerbitkan dokumen.',
        }
      }
    } else if (product === 'FULL_COVER') {
      if (
        !(Number(plan.nafaqahTotal) > 0) ||
        !(Number(plan.ujrahTotal) > 0) ||
        !(Number(plan.tenorMonths) >= 1)
      ) {
        return {
          ok: false,
          message:
            'Lengkapi Nafaqah, Ujrah, dan tenor pada tab Draft Akad sebelum menerbitkan dokumen.',
        }
      }
    } else {
      return { ok: false, message: 'Jenis pengajuan tidak dikenal.' }
    }

    const ownerUid =
      typeof applicationData.ownerFirebaseUid === 'string' ? applicationData.ownerFirebaseUid : ''
    if (!ownerUid) {
      return { ok: false, message: 'Pengajuan belum terhubung ke akun pemohon.' }
    }

    const studentNumber = await ensureStudentNumber(ownerUid)
    if (!studentNumber) {
      return { ok: false, message: 'NIS belum dapat diterbitkan. Coba lagi.' }
    }
    const sequence = studentNumberSequence(studentNumber)
    if (!sequence) {
      return { ok: false, message: 'NIS tidak valid. Muat ulang halaman.' }
    }

    const issuedAt = new Date()
    const built = await buildAkadDocument({
      application: applicationData,
      studentSequence: sequence,
      issuedAt,
    })

    const applicantName =
      typeof applicationData.applicantName === 'string' ? applicationData.applicantName : ''
    const label =
      product === 'FULL_COVER' ? 'Akad Wakalah bil Ujrah dan Jualah' : 'Akad Wakalah bil Ujrah'
    const fileName = applicantName.trim()
      ? buildDocumentFileName(label, applicantName, 'akad.docx')
      : `${documentId}-akad.docx`

    const existingFolderId =
      typeof applicationData.driveFolderId === 'string' ? applicationData.driveFolderId : ''
    const folderId = existingFolderId || (await ensureApplicationDriveFolder(applicationData))
    const uploaded = await uploadDriveFile({
      parentFolderId: folderId,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: built.bytes,
    })

    const akadDocument = {
      documentNumber: built.documentNumber,
      studentNumber,
      template: built.template,
      fileName,
      driveFileId: uploaded.fileId,
      size: uploaded.size,
      issuedAt: FieldValue.serverTimestamp(),
      issuedBy: staff?.email ?? staff?.uid,
    }

    let linked = false
    try {
      linked = await firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(applicationRef)
        const latestData = latest.data()
        if (!latest.exists || latestData?.financialPlan?.akadDocument) return false
        const latestPlan = { ...(latestData?.financialPlan ?? {}) } as Record<string, unknown>
        transaction.update(applicationRef, {
          financialPlan: {
            ...latestPlan,
            ...(String(latestPlan.finalAgreementReference ?? '').trim()
              ? {}
              : { finalAgreementReference: built.documentNumber }),
            akadDocument,
          },
          ...(existingFolderId ? {} : { driveFolderId: folderId }),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: staff?.email ?? staff?.uid,
        })
        return true
      })
    } catch {
      try {
        await deleteDriveFile(uploaded.fileId)
      } catch {
        // best-effort cleanup
      }
      return {
        ok: false,
        message: 'Dokumen sudah dibuat, tetapi belum dapat disimpan ke pengajuan. Coba lagi.',
      }
    }
    if (!linked) {
      try {
        await deleteDriveFile(uploaded.fileId)
      } catch {
        // best-effort cleanup
      }
      return { ok: false, message: 'Dokumen akad sudah terbit untuk pengajuan ini.' }
    }

    if (String(applicationData.status) === 'ACTIVE' && ownerUid && applicantName.trim()) {
      const currentDocuments = Array.isArray(applicationData.documents)
        ? applicationData.documents
        : []
      const driveFiles = currentDocuments
        .filter((document: Record<string, unknown>) => typeof document.fileId === 'string')
        .map((document: Record<string, unknown>) => ({
          fileId: String(document.fileId),
          fileName: typeof document.fileName === 'string' ? document.fileName : '',
          label: String(document.documentType ?? ''),
        }))
      driveFiles.push({ fileId: uploaded.fileId, fileName, label })
      await promoteApplicationFolder({
        folderId,
        ownerUid,
        applicantName,
        files: driveFiles,
      })
    }

    return { ok: true, documentNumber: built.documentNumber, studentNumber }
  } catch {
    return { ok: false, message: 'Dokumen akad belum dapat diterbitkan. Coba lagi.' }
  }
}
