'use server'

import { FieldValue } from 'firebase-admin/firestore'
import {
  APPLICATION_DOCUMENT_STATUSES,
  APPLICATION_STATUSES,
  PRICING_STATUSES,
} from '@/lib/firebase-data'
import {
  calculateInstallmentSchedule,
  getFinancingLineTotal,
  parseFinancingLines,
  serializeStable,
} from '@/lib/departure-financing'
import { promoteApplicationFolder } from '@/lib/drive-folders'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'

export async function updateApplicationStatus(
  documentId: string,
  status: string,
  internalNotes: string,
  documentStatuses: string[],
  pricingStatus: string,
  financialValues: Record<string, string>,
  supportRequestUpdates: { status: string; response: string }[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const staff = await getStaffSession()
  if (!staff) return { ok: false, message: 'Sesi staf berakhir. Silakan masuk kembali.' }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(documentId)) {
    return { ok: false, message: 'Pengajuan tidak valid.' }
  }
  if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
    return { ok: false, message: 'Pilih status pengajuan yang valid.' }
  }
  if (typeof internalNotes !== 'string' || internalNotes.length > 2_000) {
    return { ok: false, message: 'Catatan internal maksimal 2.000 karakter.' }
  }
  if (!PRICING_STATUSES.includes(pricingStatus as (typeof PRICING_STATUSES)[number])) {
    return { ok: false, message: 'Pilih status biaya yang valid.' }
  }
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
  if (
    !Array.isArray(supportRequestUpdates) ||
    supportRequestUpdates.length > 10 ||
    supportRequestUpdates.some(
      (request) =>
        !request ||
        !['OPEN', 'REVIEWED'].includes(request.status) ||
        typeof request.response !== 'string' ||
        request.response.length > 1_000,
    )
  ) {
    return { ok: false, message: 'Status permohonan keringanan tidak valid.' }
  }
  const refundTotal = refundValue === '' ? 0 : Number(refundValue)
  if (!Number.isSafeInteger(refundTotal)) {
    return { ok: false, message: 'Nominal pengembalian tidak valid.' }
  }
  if (firstPaymentDate && !calculateInstallmentSchedule(0, 1, firstPaymentDate)) {
    return { ok: false, message: 'Tanggal angsuran pertama tidak valid.' }
  }
  try {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(documentId)
    const application = await applicationRef.get()
    if (!application.exists) return { ok: false, message: 'Pengajuan tidak ditemukan.' }
    const currentDocuments = application.data()?.documents
    if (
      !Array.isArray(currentDocuments) ||
      !Array.isArray(documentStatuses) ||
      documentStatuses.length !== currentDocuments.length
    ) {
      return { ok: false, message: 'Daftar status dokumen tidak valid.' }
    }
    if (
      documentStatuses.some(
        (value) =>
          !APPLICATION_DOCUMENT_STATUSES.includes(
            value as (typeof APPLICATION_DOCUMENT_STATUSES)[number],
          ),
      )
    ) {
      return { ok: false, message: 'Pilih status dokumen yang valid.' }
    }
    if (
      currentDocuments.some(
        (document: Record<string, unknown>, index: number) =>
          documentStatuses[index] !== 'NOT_UPLOADED' && typeof document.fileId !== 'string',
      )
    ) {
      return { ok: false, message: 'Dokumen belum memiliki berkas untuk diverifikasi.' }
    }
    const documents = currentDocuments.map((document: Record<string, unknown>, index: number) => ({
      ...document,
      status: documentStatuses[index],
    }))
    const currentSupportRequests = application.data()?.supportRequests
    if (
      application.data()?.product === 'DEPARTURE_BRIDGING' &&
      Array.isArray(currentSupportRequests) &&
      (currentSupportRequests.length !== supportRequestUpdates.length ||
        currentSupportRequests.some(
          (request: unknown) => !request || typeof request !== 'object' || Array.isArray(request),
        ))
    ) {
      return {
        ok: false,
        message: 'Daftar permohonan keringanan berubah. Muat ulang halaman sebelum menyimpan.',
      }
    }
    const supportRequests =
      application.data()?.product === 'DEPARTURE_BRIDGING' && Array.isArray(currentSupportRequests)
        ? currentSupportRequests.map((request: Record<string, unknown>, index: number) => ({
            ...request,
            status: supportRequestUpdates[index].status,
            response: supportRequestUpdates[index].response.trim(),
          }))
        : currentSupportRequests
    const applicationData = application.data() ?? {}
    const existingFinancialPlan = applicationData.financialPlan ?? {}
    const applicationProduct = applicationData.product
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
      if (pricingStatus === 'VERIFIED' || pricingStatus === 'AGREED') {
        const positiveNafaqah = nafaqahItems.filter((line) => line.amount > 0)
        const positiveUjrah = ujrahItems.filter((line) => line.amount > 0)
        if (
          positiveNafaqah.length === 0 ||
          positiveNafaqah.some(
            (line) => !line.label || !line.recipient || !line.evidenceReference,
          ) ||
          positiveUjrah.length === 0 ||
          positiveUjrah.some((line) => !line.label) ||
          typeof financialNumbers.installmentCount !== 'number' ||
          !Number.isInteger(financialNumbers.installmentCount) ||
          financialNumbers.installmentCount < 1 ||
          financialNumbers.installmentCount > 36 ||
          !firstPaymentDate ||
          (refundTotal > 0 && !refundEvidenceReference)
        ) {
          return {
            ok: false,
            message:
              'Lengkapi Nafaqah, Ujrah, jumlah dan tanggal angsuran, serta bukti untuk setiap refund sebelum verifikasi.',
          }
        }
        const estimatedDeparture = applicationData.eligibility?.estimatedDeparture
        if (
          typeof estimatedDeparture === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(estimatedDeparture)
        ) {
          const [departureYear, departureMonth] = estimatedDeparture.split('-').map(Number)
          const [paymentYear, paymentMonth] = firstPaymentDate.split('-').map(Number)
          if (paymentYear * 12 + paymentMonth <= departureYear * 12 + departureMonth) {
            return {
              ok: false,
              message:
                'Tanggal angsuran pertama harus berada pada bulan setelah perkiraan keberangkatan. Perbarui perkiraan jika jadwal keberangkatan berubah.',
            }
          }
        }
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
        pricingStatus === 'AGREED' &&
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
        offerChanged || pricingStatus === 'ESTIMATED' ? '' : finalAgreementReference
      const currentAcceptance = applicationData.userFinancingAcceptance as
        | { acceptedAt?: unknown; offerSnapshot?: unknown }
        | undefined
      if (
        pricingStatus === 'AGREED' &&
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
        pricingStatus,
        finalAgreementReference: effectiveAgreementReference,
        settlementNotes,
      })
      if (pricingStatus === 'ESTIMATED' || offerChanged) {
        updateValues.userFinancingAcceptance = FieldValue.delete()
      }
      if (status === 'CANCELLED' && pricingStatus === 'AGREED' && !settlementNotes) {
        return {
          ok: false,
          message:
            'Catat perhitungan Nafaqah yang tidak dapat dipulihkan, jasa yang telah terlaksana, dan refund sebelum menyelesaikan pembatalan.',
        }
      }
      const previousHistory = Array.isArray(applicationData.financialPlanHistory)
        ? applicationData.financialPlanHistory
        : []
      updateValues.financialPlanHistory = [
        ...previousHistory.slice(-19),
        {
          changedAt: new Date().toISOString(),
          changedBy: staff.email ?? staff.uid,
          financialPlan: offerSnapshot,
          pricingStatus,
          finalAgreementReference: effectiveAgreementReference,
          settlementNotes,
        },
      ]
    }
    if (
      applicationProduct === 'FULL_COVER' &&
      (pricingStatus === 'VERIFIED' || pricingStatus === 'AGREED')
    ) {
      if (application.data()?.destination !== 'JAPAN') {
        return {
          ok: false,
          message:
            'Akad contoh hanya menetapkan Ju’alah untuk Jepang; konfirmasi ketentuan negara tujuan terlebih dahulu.',
        }
      }
      const { nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths } = nextFinancialPlan as Record<
        string,
        number
      >
      if (
        ![nafaqahTotal, ujrahTotal, jualaTotal, tenorMonths].every(Number.isFinite) ||
        tenorMonths < 1 ||
        tenorMonths > 36
      ) {
        return {
          ok: false,
          message:
            'Isi dan verifikasi Nafaqah, Ujrah, Ju’alah, serta tenor sebelum menyetujui biaya.',
        }
      }
      const totalObligation = nafaqahTotal + ujrahTotal
      const totalObligationIfCoe = totalObligation + jualaTotal
      const monthlyInstallmentAfterCoe = Math.floor(totalObligationIfCoe / tenorMonths)
      Object.assign(nextFinancialPlan, {
        totalObligation,
        totalObligationIfCoe,
        monthlyInstallmentAfterCoe,
        finalInstallmentAfterCoe:
          totalObligationIfCoe - monthlyInstallmentAfterCoe * (tenorMonths - 1),
        jualaCondition: 'COE_ISSUED',
        paymentStartCondition: 'AFTER_DEPARTURE',
      })
      updateValues.userFinancingAcceptance = FieldValue.delete()
    }
    if (
      applicationProduct !== 'FULL_COVER' &&
      applicationProduct !== 'DEPARTURE_BRIDGING' &&
      Number.isFinite(nextFinancialPlan.nafaqahTotal) &&
      Number.isFinite(nextFinancialPlan.ujrahTotal) &&
      Number.isFinite(nextFinancialPlan.totalObligation) &&
      nextFinancialPlan.nafaqahTotal + nextFinancialPlan.ujrahTotal !==
        nextFinancialPlan.totalObligation
    ) {
      return { ok: false, message: 'Total kewajiban harus sama dengan Nafaqah ditambah Ujrah.' }
    }
    await applicationRef.update({
      status,
      internalNotes: internalNotes.trim(),
      documents,
      ...(Array.isArray(supportRequests) ? { supportRequests } : {}),
      financialPlan: { ...nextFinancialPlan, pricingStatus },
      ...updateValues,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff.email ?? staff.uid,
    })
    if (status === 'ACTIVE' && applicationData.status !== 'ACTIVE') {
      const ownerUid =
        typeof applicationData.ownerFirebaseUid === 'string' ? applicationData.ownerFirebaseUid : ''
      const applicantName =
        typeof applicationData.applicantName === 'string' ? applicationData.applicantName : ''
      if (ownerUid && applicantName) {
        const driveFiles = (Array.isArray(currentDocuments) ? currentDocuments : [])
          .filter((document: Record<string, unknown>) => typeof document.fileId === 'string')
          .map((document: Record<string, unknown>) => ({
            fileId: String(document.fileId),
            fileName: typeof document.fileName === 'string' ? document.fileName : '',
            label: String(document.documentType ?? ''),
          }))
        const agreementPdf = applicationData.agreementPdf
        if (agreementPdf && typeof agreementPdf.fileId === 'string') {
          driveFiles.push({
            fileId: agreementPdf.fileId,
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
