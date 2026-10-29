'use server'

import { FieldValue } from 'firebase-admin/firestore'
import {
  APPLICATION_DOCUMENT_STATUSES,
  APPLICATION_STATUSES,
  PRICING_STATUSES,
} from '@/lib/firebase-data'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'

export async function updateApplicationStatus(
  documentId: string,
  status: string,
  internalNotes: string,
  documentStatuses: string[],
  pricingStatus: string,
  financialValues: Record<string, string>,
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
    'tenorMonths',
    'monthlyInstallment',
  ] as const
  const financialNumbers: Record<(typeof financialFields)[number], number | null> = {
    nafaqahTotal: null,
    ujrahTotal: null,
    totalObligation: null,
    tenorMonths: null,
    monthlyInstallment: null,
  }
  for (const field of financialFields) {
    const value = financialValues?.[field]
    if (typeof value !== 'string' || value.length > 20) {
      return { ok: false, message: 'Rincian biaya tidak valid.' }
    }
    if (value.trim() === '') continue
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
      return { ok: false, message: 'Masukkan angka yang valid pada rincian biaya.' }
    }
    financialNumbers[field] = Number(value)
    if (!Number.isFinite(financialNumbers[field])) {
      return { ok: false, message: 'Masukkan angka yang valid pada rincian biaya.' }
    }
  }
  if (
    financialNumbers.tenorMonths !== null &&
    (!Number.isInteger(financialNumbers.tenorMonths) ||
      financialNumbers.tenorMonths < 1 ||
      financialNumbers.tenorMonths > 36)
  ) {
    return { ok: false, message: 'Tenor harus antara 1 dan 36 bulan.' }
  }
  if (
    financialNumbers.nafaqahTotal !== null &&
    financialNumbers.ujrahTotal !== null &&
    financialNumbers.totalObligation !== null &&
    financialNumbers.nafaqahTotal + financialNumbers.ujrahTotal !==
      financialNumbers.totalObligation
  ) {
    return { ok: false, message: 'Total kewajiban harus sama dengan Nafaqah ditambah Ujrah.' }
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
          documentStatuses[index] !== 'NOT_UPLOADED' && typeof document.storagePath !== 'string',
      )
    ) {
      return { ok: false, message: 'Dokumen belum memiliki berkas untuk diverifikasi.' }
    }
    const documents = currentDocuments.map((document: Record<string, unknown>, index: number) => ({
      ...document,
      status: documentStatuses[index],
    }))
    const existingFinancialPlan = application.data()?.financialPlan ?? {}
    await applicationRef.update({
      status,
      internalNotes: internalNotes.trim(),
      documents,
      financialPlan: { ...existingFinancialPlan, ...financialNumbers, pricingStatus },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: staff.email ?? staff.uid,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Status belum dapat disimpan. Coba lagi.' }
  }
}
