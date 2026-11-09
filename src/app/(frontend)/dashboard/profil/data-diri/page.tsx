'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import {
  getUserActivityFeed,
  updateApplicantPersonalDetails,
  type ApplicantProfileInput,
  type UserApplicationDetail,
} from '../../actions'
import {
  DashboardCard,
  DashboardIcon,
  DashboardScaffold,
  SkeletonBlock,
} from '../../_components/dashboard-ui'

const RELIGION_LABELS: Record<ApplicantProfileInput['religion'], string> = {
  ISLAM: 'Islam',
  PROTESTANT: 'Kristen Protestan',
  CATHOLIC: 'Katolik',
  HINDU: 'Hindu',
  BUDDHIST: 'Buddha',
  CONFUCIAN: 'Konghucu',
}

const emptyProfileForm: ApplicantProfileInput = {
  applicantName: '',
  phone: '',
  birthPlace: '',
  birthDate: '',
  gender: 'MALE',
  religion: 'ISLAM',
  idCardAddress: '',
  domicileSameAsIdCard: false,
  domicileAddress: '',
  domicilePostalCode: '',
}

export default function PersonalDataPage() {
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [editing, setEditing] = useState(false)
  const [profileForm, setProfileForm] = useState<ApplicantProfileInput>(emptyProfileForm)

  const selectedApplication = useMemo(
    () =>
      applications.find((application) => application.id === selectedApplicationId) ??
      applications[0] ??
      null,
    [applications, selectedApplicationId],
  )

  const lockedPersonalData = Boolean(
    selectedApplication &&
    (selectedApplication.pricingStatus === 'AGREED' ||
      ['ACTIVE', 'COMPLETED'].includes(selectedApplication.status)),
  )

  const fillForm = useCallback((application: UserApplicationDetail | null) => {
    if (!application) {
      setProfileForm(emptyProfileForm)
      return
    }
    setProfileForm({
      applicantName: application.applicantName,
      phone: application.phone,
      birthPlace: application.personalDetails.birthPlace,
      birthDate: application.personalDetails.birthDate,
      gender: application.personalDetails.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
      religion:
        application.personalDetails.religion in RELIGION_LABELS
          ? (application.personalDetails.religion as ApplicantProfileInput['religion'])
          : 'ISLAM',
      idCardAddress: application.personalDetails.idCardAddress,
      domicileSameAsIdCard: application.personalDetails.domicileSameAsIdCard,
      domicileAddress: application.personalDetails.domicileAddress,
      domicilePostalCode: application.personalDetails.domicilePostalCode,
    })
  }, [])

  useEffect(() => {
    fillForm(selectedApplication)
    setEditing(false)
  }, [fillForm, selectedApplication])

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
      if (!user || !active) {
        if (active) setProfileLoading(false)
        return
      }
      try {
        const token = await user.getIdToken()
        if (!active) return
        const feed = await getUserActivityFeed(token)
        if (!active) return
        if (feed.ok) {
          setApplications(feed.applications)
          setSelectedApplicationId((current) =>
            feed.applications.some((application) => application.id === current)
              ? current
              : (feed.applications[0]?.id ?? ''),
          )
          setError('')
        } else {
          setError(feed.message)
        }
      } catch {
        if (active) setError('Data diri belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setProfileLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const updateField = <K extends keyof ApplicantProfileInput>(
    key: K,
    value: ApplicantProfileInput[K],
  ) => setProfileForm((current) => ({ ...current, [key]: value }))

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedApplication) return
    const user = getFirebaseClientAuth().currentUser
    if (!user) {
      setError('Sesi telah berakhir. Silakan masuk kembali.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateApplicantPersonalDetails(
        await user.getIdToken(),
        selectedApplication.id,
        profileForm,
      )
      if (!result.ok) {
        setError(result.message)
        return
      }

      const updatedApplication: UserApplicationDetail = {
        ...selectedApplication,
        applicantName: profileForm.applicantName.trim(),
        phone: profileForm.phone.trim(),
        personalDetails: {
          ...selectedApplication.personalDetails,
          birthPlace: profileForm.birthPlace.trim(),
          birthDate: profileForm.birthDate,
          gender: profileForm.gender,
          religion: profileForm.religion,
          idCardAddress: profileForm.idCardAddress.trim(),
          domicileSameAsIdCard: profileForm.domicileSameAsIdCard,
          domicileAddress: profileForm.domicileSameAsIdCard
            ? profileForm.idCardAddress.trim()
            : profileForm.domicileAddress.trim(),
          domicilePostalCode: profileForm.domicilePostalCode,
        },
      }
      setApplications((current) =>
        current.map((application) =>
          application.id === updatedApplication.id ? updatedApplication : application,
        ),
      )
      setNotice('Data diri berhasil diperbarui.')
      setEditing(false)
    } catch {
      setError('Data diri belum dapat disimpan. Silakan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Sesuai pengajuan yang dipilih"
      title="Data diri"
    >
      {!profileLoading && applications.length > 1 && (
        <label className="block text-xs font-semibold text-slate-600">
          Data pengajuan
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            onChange={(event) => setSelectedApplicationId(event.target.value)}
            value={selectedApplication?.id ?? ''}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.applicationId} ·{' '}
                {application.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p
          className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}

      <section aria-label="Data diri">
        {profileLoading ? (
          <DashboardCard>
            <div
              aria-label="Memuat data diri"
              className="grid grid-cols-2 gap-px bg-slate-100"
              role="status"
            >
              <span className="sr-only">Memuat data diri…</span>
              <div className="space-y-2 bg-white p-4">
                <SkeletonBlock className="h-2.5 w-20" />
                <SkeletonBlock className="h-3.5 w-28" />
              </div>
              <div className="space-y-2 bg-white p-4">
                <SkeletonBlock className="h-2.5 w-20" />
                <SkeletonBlock className="h-3.5 w-32" />
              </div>
              <div className="space-y-2 bg-white p-4">
                <SkeletonBlock className="h-2.5 w-24" />
                <SkeletonBlock className="h-3.5 w-28" />
              </div>
              <div className="col-span-2 space-y-2 bg-white p-4">
                <SkeletonBlock className="h-2.5 w-32" />
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3.5 w-4/5" />
              </div>
            </div>
          </DashboardCard>
        ) : !selectedApplication ? (
          <DashboardCard className="p-5">
            <div className="flex items-start gap-3">
              <DashboardIcon className="size-5 shrink-0 text-[var(--primary)]" name="info" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Belum ada data pengajuan</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Data diri akan tampil setelah Anda mengirim formulir pengajuan.
                </p>
                <a
                  className="mt-3 inline-flex text-xs font-bold text-[var(--primary)] underline"
                  href="/?step=1"
                >
                  Mulai pengajuan
                </a>
              </div>
            </div>
          </DashboardCard>
        ) : (
          <DashboardCard>
            {lockedPersonalData && (
              <div className="flex items-start gap-2.5 border-b border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                <DashboardIcon className="mt-0.5 size-4 shrink-0" name="lock" />
                <p>
                  Data dikunci setelah akad disepakati atau pembiayaan aktif agar tetap sesuai
                  dengan dokumen akad. Hubungi Pusat Bantuan untuk meminta koreksi.
                </p>
              </div>
            )}
            {!editing ? (
              <>
                <dl className="grid grid-cols-2 gap-px bg-slate-100 text-xs">
                  <div className="bg-white p-4">
                    <dt className="text-slate-400">Nama lengkap</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {selectedApplication.applicantName}
                    </dd>
                  </div>
                  <div className="bg-white p-4">
                    <dt className="text-slate-400">Nomor WhatsApp</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {selectedApplication.phone || '—'}
                    </dd>
                  </div>
                  <div className="bg-white p-4">
                    <dt className="text-slate-400">Tempat, tanggal lahir</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {selectedApplication.personalDetails.birthPlace || '—'}
                      {selectedApplication.personalDetails.birthDate
                        ? `, ${selectedApplication.personalDetails.birthDate}`
                        : ''}
                    </dd>
                  </div>
                  <div className="bg-white p-4">
                    <dt className="text-slate-400">Jenis kelamin & agama</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {selectedApplication.personalDetails.gender === 'FEMALE'
                        ? 'Perempuan'
                        : 'Laki-laki'}
                      {' · '}
                      {RELIGION_LABELS[
                        selectedApplication.personalDetails
                          .religion as ApplicantProfileInput['religion']
                      ] ??
                        (selectedApplication.personalDetails.religion || '—')}
                    </dd>
                  </div>
                  <div className="col-span-2 bg-white p-4">
                    <dt className="text-slate-400">Alamat sesuai KTP</dt>
                    <dd className="mt-1 font-semibold leading-5 text-slate-800">
                      {selectedApplication.personalDetails.idCardAddress || '—'}
                    </dd>
                  </div>
                  <div className="col-span-2 bg-white p-4">
                    <dt className="text-slate-400">Alamat korespondensi</dt>
                    <dd className="mt-1 font-semibold leading-5 text-slate-800">
                      {selectedApplication.personalDetails.domicileAddress || '—'}
                      {selectedApplication.personalDetails.domicilePostalCode
                        ? ` (${selectedApplication.personalDetails.domicilePostalCode})`
                        : ''}
                    </dd>
                  </div>
                </dl>
                {lockedPersonalData ? null : (
                  <div className="p-4">
                    <button
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[var(--primary)] transition hover:bg-blue-100"
                      onClick={() => {
                        fillForm(selectedApplication)
                        setEditing(true)
                        setError('')
                      }}
                      type="button"
                    >
                      Ubah Data Diri
                    </button>
                  </div>
                )}
              </>
            ) : (
              <form className="space-y-4 p-4" onSubmit={saveProfile}>
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 space-y-1.5 text-xs font-semibold text-slate-600">
                    Nama lengkap
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      maxLength={100}
                      onChange={(event) => updateField('applicantName', event.target.value)}
                      required
                      value={profileForm.applicantName}
                    />
                  </label>
                  <label className="col-span-2 space-y-1.5 text-xs font-semibold text-slate-600">
                    Nomor WhatsApp
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      inputMode="tel"
                      maxLength={24}
                      onChange={(event) => updateField('phone', event.target.value)}
                      required
                      value={profileForm.phone}
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    Tempat lahir
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      maxLength={80}
                      onChange={(event) => updateField('birthPlace', event.target.value)}
                      required
                      value={profileForm.birthPlace}
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    Tanggal lahir
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      onChange={(event) => updateField('birthDate', event.target.value)}
                      required
                      type="date"
                      value={profileForm.birthDate}
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    Jenis kelamin
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"
                      onChange={(event) =>
                        updateField('gender', event.target.value as ApplicantProfileInput['gender'])
                      }
                      value={profileForm.gender}
                    >
                      <option value="MALE">Laki-laki</option>
                      <option value="FEMALE">Perempuan</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    Agama
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"
                      onChange={(event) =>
                        updateField(
                          'religion',
                          event.target.value as ApplicantProfileInput['religion'],
                        )
                      }
                      value={profileForm.religion}
                    >
                      {Object.entries(RELIGION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 space-y-1.5 text-xs font-semibold text-slate-600">
                    Alamat sesuai KTP
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      maxLength={500}
                      onChange={(event) => updateField('idCardAddress', event.target.value)}
                      required
                      rows={3}
                      value={profileForm.idCardAddress}
                    />
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      checked={profileForm.domicileSameAsIdCard}
                      onChange={(event) =>
                        updateField('domicileSameAsIdCard', event.target.checked)
                      }
                      type="checkbox"
                    />
                    Alamat korespondensi sama dengan alamat KTP
                  </label>
                  {!profileForm.domicileSameAsIdCard && (
                    <label className="col-span-2 space-y-1.5 text-xs font-semibold text-slate-600">
                      Alamat korespondensi
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                        maxLength={500}
                        onChange={(event) => updateField('domicileAddress', event.target.value)}
                        required
                        rows={3}
                        value={profileForm.domicileAddress}
                      />
                    </label>
                  )}
                  <label className="col-span-2 space-y-1.5 text-xs font-semibold text-slate-600">
                    Kode pos korespondensi
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) =>
                        updateField(
                          'domicilePostalCode',
                          event.target.value.replace(/\D/g, '').slice(0, 10),
                        )
                      }
                      value={profileForm.domicilePostalCode}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setEditing(false)
                      setError('')
                      fillForm(selectedApplication)
                    }}
                    type="button"
                  >
                    Batal
                  </button>
                  <button
                    className="rounded-xl bg-[var(--primary)] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                    disabled={saving}
                    type="submit"
                  >
                    {saving ? 'Menyimpan…' : 'Simpan Data'}
                  </button>
                </div>
              </form>
            )}
          </DashboardCard>
        )}
      </section>
    </DashboardScaffold>
  )
}
