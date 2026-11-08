'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import {
  getOrCreateStudentNumber,
  getUserActivityFeed,
  updateApplicantPersonalDetails,
  type ApplicantProfileInput,
  type UserApplicationDetail,
} from '../actions'
import {
  DashboardCard,
  DashboardIcon,
  DashboardScaffold,
  SkeletonBlock,
} from '../_components/dashboard-ui'

type ProfileTab = 'personal' | 'documents' | 'help'

const RELIGION_LABELS: Record<ApplicantProfileInput['religion'], string> = {
  ISLAM: 'Islam',
  PROTESTANT: 'Kristen Protestan',
  CATHOLIC: 'Katolik',
  HINDU: 'Hindu',
  BUDDHIST: 'Buddha',
  CONFUCIAN: 'Konghucu',
}

const FAQ_ITEMS = [
  {
    question: 'Bagaimana cara memperbarui data diri?',
    answer:
      'Pilih Data Diri, tekan Ubah Data, perbarui kolom yang tersedia, lalu tekan Simpan. Perubahan hanya berlaku untuk pengajuan yang sedang dipilih.',
  },
  {
    question: 'Mengapa data diri saya terkunci?',
    answer:
      'Setelah akad disepakati atau pembiayaan aktif, data dikunci agar tetap sesuai dengan dokumen akad. Hubungi tim melalui email untuk meminta koreksi.',
  },
  {
    question: 'Kapan PDF akad dapat dilihat?',
    answer:
      'PDF akad final akan muncul setelah rincian disepakati dan tim VentureGo mengunggah dokumen yang sudah ditandatangani.',
  },
]

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

export default function ProfilePage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [studentNumberError, setStudentNumberError] = useState('')
  const [notice, setNotice] = useState('')
  const [account, setAccount] = useState<{
    name: string
    emailVerified: boolean
    photoUrl: string
  } | null>(null)
  const [studentNumber, setStudentNumber] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal')
  const [editing, setEditing] = useState(false)
  const [profileForm, setProfileForm] = useState<ApplicantProfileInput>(emptyProfileForm)
  const [agreementPreviewUrl, setAgreementPreviewUrl] = useState('')
  const [agreementLoading, setAgreementLoading] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
      const photoUrl = user.photoURL?.startsWith('https://') ? user.photoURL : ''
      setAccount({
        name: user.displayName?.trim() || 'Pengguna',
        emailVerified: user.emailVerified,
        photoUrl,
      })
      setPhotoFailed(false)
      try {
        const token = await user.getIdToken()
        if (!active) return
        const [feed, studentProfile] = await Promise.all([
          getUserActivityFeed(token),
          getOrCreateStudentNumber(token),
        ])
        if (!active) return
        if (feed.ok) {
          setApplications(feed.applications)
          setSelectedApplicationId((current) =>
            feed.applications.some((application) => application.id === current)
              ? current
              : (feed.applications[0]?.id ?? ''),
          )
        } else {
          setError(feed.message)
        }
        if (studentProfile.ok) {
          setStudentNumber(studentProfile.studentNumber)
          setStudentNumberError('')
        } else {
          setStudentNumberError(studentProfile.message)
        }
      } catch {
        if (active) setError('Data profil belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setProfileLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(
    () => () => {
      if (agreementPreviewUrl) URL.revokeObjectURL(agreementPreviewUrl)
    },
    [agreementPreviewUrl],
  )

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

  const openAgreement = async () => {
    if (!selectedApplication?.agreementPdf) return
    const user = getFirebaseClientAuth().currentUser
    if (!user) {
      setError('Sesi telah berakhir. Silakan masuk kembali.')
      return
    }

    setAgreementLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/applicant/applications/${selectedApplication.id}/agreement`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
      )
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(result.message || 'PDF akad belum dapat dibuka.')
      }
      const blob = await response.blob()
      setAgreementPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'PDF akad belum dapat dibuka.')
    } finally {
      setAgreementLoading(false)
    }
  }

  const logout = async () => {
    setIsLoggingOut(true)
    setError('')
    try {
      await signOut(getFirebaseClientAuth())
      router.replace('/')
    } catch {
      setError('Tidak dapat keluar saat ini. Silakan coba lagi.')
      setIsLoggingOut(false)
    }
  }

  const displayName = selectedApplication?.applicantName || account?.name || 'Pengguna'

  return (
    <DashboardScaffold active="profil" showHeader={false} title="Profil saya">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          {account?.photoUrl && !photoFailed ? (
            <Image
              alt={`Foto profil ${displayName}`}
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-indigo-100"
              height={64}
              onError={() => setPhotoFailed(true)}
              src={account.photoUrl}
              unoptimized
              width={64}
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-indigo-50 text-[var(--primary)]">
              <DashboardIcon name="profile" className="size-8" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {profileLoading ? (
              <div aria-label="Memuat profil" className="space-y-2" role="status">
                <span className="sr-only">Memuat profil…</span>
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-4 w-36 rounded-full" />
              </div>
            ) : (
              <h1 className="truncate text-lg font-bold text-slate-900">{displayName}</h1>
            )}
            {selectedApplication && (
              <span className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                {selectedApplication.applicationId} · {selectedApplication.lpkName}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100">
          <div className="p-4">
            <span className="text-[10px] text-slate-400">Nomor Induk Siswa VSV</span>
            {profileLoading ? (
              <SkeletonBlock className="mt-2 h-4 w-32" />
            ) : (
              <strong className="mt-1 block truncate text-sm font-bold tracking-wide text-[var(--primary)]">
                {studentNumber || 'Belum tersedia'}
              </strong>
            )}
            {studentNumberError && !profileLoading && (
              <span className="mt-1 block text-[10px] leading-4 text-amber-700">
                Nomor belum dapat dimuat. Coba segarkan halaman.
              </span>
            )}
          </div>
          <div className="border-l border-slate-100 p-4">
            <span className="text-[10px] text-slate-400">Status Akun</span>
            {profileLoading ? (
              <SkeletonBlock className="mt-2 h-5 w-24 rounded-full" />
            ) : (
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  account?.emailVerified
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {account?.emailVerified ? 'Terverifikasi' : 'Belum terverifikasi'}
              </span>
            )}
          </div>
        </div>
      </DashboardCard>

      {!profileLoading && applications.length > 1 && (
        <label className="block text-xs font-semibold text-slate-600">
          Data pengajuan
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            onChange={(event) => {
              setSelectedApplicationId(event.target.value)
              setAgreementPreviewUrl((current) => {
                if (current) URL.revokeObjectURL(current)
                return ''
              })
            }}
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

      <div
        aria-label="Menu profil"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1"
        role="tablist"
      >
        {(
          [
            ['personal', 'Data Diri'],
            ['documents', 'Dokumen Saya'],
            ['help', 'Pusat Bantuan'],
          ] as const
        ).map(([tab, label]) => (
          <button
            aria-selected={activeTab === tab}
            className={`rounded-xl px-2 py-2.5 text-[11px] font-semibold transition ${
              activeTab === tab
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setError('')
              setNotice('')
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

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

      {activeTab === 'personal' && (
        <section aria-label="Data diri" role="tabpanel">
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
                        className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-bold text-[var(--primary)] transition hover:bg-indigo-100"
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
                          updateField(
                            'gender',
                            event.target.value as ApplicantProfileInput['gender'],
                          )
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
      )}

      {activeTab === 'documents' && (
        <section aria-label="Dokumen saya" role="tabpanel">
          {!selectedApplication ? (
            <DashboardCard className="p-5">
              <p className="text-xs leading-5 text-slate-500">
                Belum ada pengajuan yang tertaut ke akun ini.
              </p>
            </DashboardCard>
          ) : (
            <DashboardCard className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
                  <DashboardIcon name="document" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-slate-900">Akad Wakalah bil Ujrah</h2>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {selectedApplication.agreementPdf
                      ? `${selectedApplication.agreementPdf.fileName} · ${selectedApplication.applicationId}`
                      : selectedApplication.pricingStatus === 'AGREED'
                        ? 'Akad disepakati. PDF final akan muncul setelah diunggah tim VentureGo.'
                        : 'PDF akad final tersedia setelah rincian biaya disepakati.'}
                  </p>
                </div>
              </div>
              {selectedApplication.agreementPdf && (
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                    disabled={agreementLoading}
                    onClick={() => void openAgreement()}
                    type="button"
                  >
                    {agreementLoading ? 'Membuka PDF…' : 'Lihat Akad PDF'}
                  </button>
                  {agreementPreviewUrl && (
                    <a
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"
                      download={selectedApplication.agreementPdf.fileName}
                      href={agreementPreviewUrl}
                    >
                      Unduh
                    </a>
                  )}
                </div>
              )}
              {agreementPreviewUrl && (
                <iframe
                  className="mt-4 h-[58dvh] w-full rounded-xl border border-slate-200 bg-slate-50"
                  src={agreementPreviewUrl}
                  title="Pratinjau Akad Wakalah bil Ujrah"
                />
              )}
            </DashboardCard>
          )}
        </section>
      )}

      {activeTab === 'help' && (
        <section aria-label="Pusat bantuan" role="tabpanel" className="space-y-4">
          <DashboardCard className="bg-[var(--primary)] p-4 text-white ring-0">
            <h2 className="text-sm font-bold">Pusat Bantuan VentureGo</h2>
            <p className="mt-1 text-xs leading-5 text-indigo-100">
              Untuk bantuan data, akad, atau pembiayaan, hubungi tim layanan.
            </p>
            <a
              className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--primary)]"
              href="mailto:vworksofficial@gmail.com"
            >
              Kirim email layanan
            </a>
          </DashboardCard>
          <DashboardCard>
            {PROFILE_FAQ.map((item, index) => (
              <div className="border-b border-slate-100 last:border-0" key={item.question}>
                <button
                  aria-expanded={openFaq === index}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left text-xs font-semibold text-slate-800"
                  onClick={() => setOpenFaq((current) => (current === index ? null : index))}
                  type="button"
                >
                  {item.question}
                  <DashboardIcon
                    className={`size-4 shrink-0 text-slate-400 transition-transform ${openFaq === index ? 'rotate-90' : ''}`}
                    name="chevron"
                  />
                </button>
                {openFaq === index && (
                  <p className="px-4 pb-4 text-xs leading-5 text-slate-500">{item.answer}</p>
                )}
              </div>
            ))}
          </DashboardCard>
        </section>
      )}

      <section className="border-t border-slate-200 pt-4">
        <button
          className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          disabled={isLoggingOut}
          onClick={logout}
          type="button"
        >
          {isLoggingOut ? 'Keluar…' : 'Keluar dari akun'}
        </button>
      </section>
    </DashboardScaffold>
  )
}

const PROFILE_FAQ = [
  {
    question: 'Bagaimana memperbarui data diri?',
    answer:
      'Pilih Data Diri, lalu Ubah Data. Setelah akad disepakati atau pembiayaan aktif, koreksi data perlu dibantu tim layanan agar sesuai dengan dokumen akad.',
  },
  {
    question: 'Kapan PDF akad tersedia?',
    answer:
      'PDF akad final muncul di Dokumen Saya setelah rincian disepakati dan tim VentureGo mengunggah dokumen bertanda tangan.',
  },
  {
    question: 'Bagaimana mengajukan keringanan pembayaran?',
    answer:
      'Buka halaman Angsuran dan kirim permohonan keringanan dari pengajuan yang memiliki rincian biaya terverifikasi.',
  },
]
