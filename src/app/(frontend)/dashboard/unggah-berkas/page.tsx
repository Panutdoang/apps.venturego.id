'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, uploadBytes } from 'firebase/storage'
import { getFirebaseClientAuth, getFirebaseClientStorage } from '@/lib/firebase-client'
import {
  ACCEPTED_DOCUMENT_TYPES,
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
} from '@/lib/documents'
import { discardApplicationUploads } from '../../actions'
import { getOwnedApplications, uploadApplicationDocument, type OwnedApplication } from './actions'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

const formatSize = (size?: number) => (size ? `${(size / 1024 / 1024).toFixed(1)} MB` : '')

export default function UploadDocumentsPage() {
  const [applications, setApplications] = useState<OwnedApplication[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [uploadToken, setUploadToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  const loadApplications = useCallback(async (token: string) => {
    const result = await getOwnedApplications(token)
    if (!result.ok) {
      setLoadingError(result.message)
      return
    }

    setApplications(result.applications)
    setSelectedApplicationId((current) =>
      result.applications.some((application) => application.id === current)
        ? current
        : (result.applications[0]?.id ?? ''),
    )
    setLoadingError('')
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user || !user.isAnonymous) {
          setUploadToken('')
          setLoading(false)
          return
        }

        try {
          const token = await user.getIdToken()
          if (!active) return
          setUploadToken(token)
          await loadApplications(token)
        } catch {
          if (active) setLoadingError('Sesi unggah tidak dapat diverifikasi. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setLoadingError('Layanan unggah belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [loadApplications])

  const selectedApplication = applications.find(
    (application) => application.id === selectedApplicationId,
  )
  const definitions = selectedApplication
    ? DOCUMENT_DEFINITIONS[selectedApplication.product]
    : DOCUMENT_DEFINITIONS.DEPARTURE_BRIDGING
  const documentGroups = [
    {
      title: 'Dokumen utama',
      documents: definitions
        .map((document, index) => ({ document, index }))
        .filter(({ document }) => document.section !== 'dokumen-pendukung'),
    },
    {
      title: 'Dokumen pendukung',
      documents: definitions
        .map((document, index) => ({ document, index }))
        .filter(({ document }) => document.section === 'dokumen-pendukung'),
    },
  ].filter((group) => group.documents.length > 0)
  const uploadedBytes = useMemo(
    () =>
      selectedApplication?.documents.reduce(
        (total, document) => total + (document.status === 'UPLOADED' ? (document.size ?? 0) : 0),
        0,
      ) ?? 0,
    [selectedApplication],
  )

  const uploadDocument = async (index: number, file: File | undefined) => {
    setUploadError('')
    setSuccessMessage('')
    if (!file || !selectedApplication) return
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_TYPES)[number])) {
      setUploadError('Gunakan berkas PDF, JPG, atau PNG.')
      return
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadError('Ukuran setiap berkas maksimal 10 MB.')
      return
    }
    const previousSize =
      selectedApplication.documents[index]?.status === 'UPLOADED'
        ? (selectedApplication.documents[index]?.size ?? 0)
        : 0
    if (uploadedBytes - previousSize + file.size > 60 * 1024 * 1024) {
      setUploadError('Ukuran seluruh berkas tidak boleh melebihi 60 MB.')
      return
    }
    if (!uploadToken) {
      setUploadError('Sesi unggah telah berakhir. Silakan muat ulang halaman.')
      return
    }

    setUploadingIndex(index)
    try {
      const safeName = file.name.replace(/[\\/]/g, '_').slice(0, 180)
      const currentUser = getFirebaseClientAuth().currentUser
      if (!currentUser || currentUser.isAnonymous === false) {
        setUploadError('Sesi unggah telah berakhir. Silakan muat ulang halaman.')
        return
      }
      const storagePath = `application-uploads/${currentUser.uid}/${crypto.randomUUID()}/${safeName}`
      await uploadBytes(ref(getFirebaseClientStorage(), storagePath), file, {
        contentType: file.type,
        customMetadata: { originalName: file.name },
      })

      const result = await uploadApplicationDocument(
        uploadToken,
        selectedApplication.id,
        index,
        storagePath,
      )
      if (!result.ok) {
        await discardApplicationUploads(uploadToken, [storagePath])
        setUploadError(result.message)
        return
      }

      setSuccessMessage(`${definitions[index].label} berhasil diunggah.`)
      await loadApplications(uploadToken)
    } catch {
      setUploadError('Berkas belum dapat diunggah. Periksa koneksi lalu coba lagi.')
    } finally {
      setUploadingIndex(null)
    }
  }

  return (
    <DashboardScaffold active="berkas" subtitle="Lengkapi dokumen pengajuan" title="Unggah berkas">
      <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 p-4">
        <DashboardIcon name="shield" className="size-5 shrink-0 text-[var(--primary)]" />
        <p className="text-[11px] leading-5 text-slate-600">
          Unggah dokumen PDF, JPG, atau PNG. Maksimal 10 MB untuk setiap berkas.
        </p>
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-500">Memuat pengajuan…</p>}
      {!loading && loadingError && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p>{loadingError}</p>
          {uploadToken && (
            <button
              className="mt-3 font-bold underline"
              onClick={() => {
                setLoading(true)
                void loadApplications(uploadToken).finally(() => setLoading(false))
              }}
              type="button"
            >
              Coba lagi
            </button>
          )}
        </div>
      )}
      {!loading && !loadingError && !selectedApplication && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          role="status"
        >
          <DashboardIcon name="info" className="size-5 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-5 text-amber-800">
            Pratinjau daftar dokumen. Fitur unggah belum aktif karena belum ada pengajuan yang
            tertaut ke sesi ini.
          </p>
        </div>
      )}

      {!loading && !loadingError && definitions.length > 0 && (
        <>
          {selectedApplication && applications.length > 1 && (
            <label className="block text-xs font-semibold text-slate-600">
              Pilih pengajuan
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                value={selectedApplication.id}
              >
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.applicationId} · {application.applicantName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <DashboardCard>
            {selectedApplication && (
              <div className="border-b border-slate-100 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {selectedApplication.applicationId}
                </p>
                <h2 className="mt-1 text-sm font-bold text-slate-800">
                  {selectedApplication.product === 'FULL_COVER'
                    ? 'Full Cover'
                    : 'Dana Keberangkatan'}
                </h2>
              </div>
            )}
          </DashboardCard>
          {documentGroups.map((group) => (
            <section aria-label={group.title} className="mt-4" key={group.title}>
              <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                {group.title}
              </h3>
              <DashboardCard>
                {group.documents.map(({ document, index }, groupIndex) => {
                  const uploadedDocument = selectedApplication?.documents[index]
                  const isUploaded = uploadedDocument?.status === 'UPLOADED'
                  const isUploading = uploadingIndex === index
                  return (
                    <div
                      className={`flex items-center gap-3 p-4 ${
                        groupIndex < group.documents.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                      key={document.label}
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                          isUploaded
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-indigo-50 text-[var(--primary)]'
                        }`}
                      >
                        <DashboardIcon
                          name={isUploaded ? 'check' : 'document'}
                          className="size-5"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-bold text-slate-800">
                          {document.label}
                          {document.required && (
                            <span aria-label="wajib diunggah" className="ml-1 text-red-500">
                              *
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {isUploaded
                            ? `${uploadedDocument.fileName ?? 'Berkas'} · ${formatSize(uploadedDocument.size)}`
                            : 'Belum diunggah'}
                        </p>
                      </div>
                      <label
                        className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold text-white ${
                          selectedApplication
                            ? 'cursor-pointer bg-[var(--primary)]'
                            : 'cursor-not-allowed bg-slate-300'
                        }`}
                      >
                        {selectedApplication
                          ? isUploading
                            ? 'Mengunggah…'
                            : isUploaded
                              ? 'Ganti'
                              : 'Unggah'
                          : 'Belum aktif'}
                        <input
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          disabled={uploadingIndex !== null || !selectedApplication}
                          onChange={(event) => {
                            void uploadDocument(index, event.target.files?.[0])
                            event.target.value = ''
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                  )
                })}
              </DashboardCard>
            </section>
          ))}
        </>
      )}

      {uploadError && (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">
          {uploadError}
        </p>
      )}
      {successMessage && (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700" role="status">
          {successMessage}
        </p>
      )}
    </DashboardScaffold>
  )
}
