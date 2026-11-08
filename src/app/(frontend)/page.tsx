'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { discardDriveUploads, submitFinancingApplication, type ApplicationInput } from './actions'
import { formatRupiah } from '@/lib/financing-plan'
import {
  ACCEPTED_DOCUMENT_TYPES,
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  getKtpDocumentIndex,
} from '@/lib/documents'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { onAuthStateChanged } from 'firebase/auth'
import {
  ensureApplicantAccount,
  isAppAccount,
  resolveUserDestination,
  signInWithDemoAccount,
  signInWithGoogleAccount,
} from '@/lib/auth-client'
import { uploadToDrive } from '@/lib/upload-client'

const isLocalDemoMode = process.env.NODE_ENV !== 'production'

type Product = ApplicationInput['product']

const formatAmountInput = (value: string) =>
  value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const FULL_COVER_NEEDS = [
  ['LANGUAGE_TRAINING', 'Biaya pelatihan bahasa'],
  ['LANGUAGE_ALLOWANCE', 'Uang saku pelatihan bahasa'],
  ['SKILL_TRAINING', 'Biaya pelatihan skill'],
  ['SKILL_ALLOWANCE', 'Uang saku pelatihan skill'],
  ['MEDICAL', 'Biaya MCU'],
  ['DOCUMENT', 'Biaya dokumen keberangkatan'],
  ['ALLOWANCE', 'Biaya uang saku keberangkatan'],
] as const

const initialForm: ApplicationInput = {
  product: 'FULL_COVER',
  applicantName: '',
  phone: '',
  lpkName: '',
  birthPlace: '',
  birthDate: '',
  gender: 'MALE',
  religion: 'ISLAM',
  idCardAddress: '',
  domicileSameAsIdCard: false,
  domicileAddress: '',
  domicilePostalCode: '',
  destination: 'JAPAN',
  trainingStarted: false,
  trainingCompleted: false,
  hasPassport: false,
  hasWorkContract: false,
  guardianApproval: false,
  placementPassed: false,
  coeStatus: 'NOT_STARTED',
  visaStatus: 'NOT_STARTED',
  languageLevel: 'NOT_STARTED',
  trainingStartDate: '',
  languageTrainingMonths: '',
  skillTrainingMonths: '',
  requiresTrainingAllowance: false,
  requiresAccommodation: false,
  estimatedDeparture: '',
  outstandingLPKAmount: '',
  financingAmount: '',
  selectedNeeds: [],
  understandsWakalah: false,
  acceptsDataProcessing: false,
}

function GoogleIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 6-1.08 8-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.12 1.16-3.17 0-5.86-2.14-6.82-5.03H1.14v3.15C3.15 21.32 7.28 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.17c-.24-.72-.38-1.49-.38-2.17s.14-1.45.38-2.17V6.68H1.14C.41 8.13 0 9.77 0 12s.41 3.87 1.14 5.32l4.04-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.28 0 3.15 2.68 1.14 6.68l4.04 3.15c.96-2.89 3.65-5.08 6.82-5.08Z"
      />
    </svg>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({})
  const [ktpFile, setKtpFile] = useState<File | null>(null)
  const [step3Error, setStep3Error] = useState('')
  const [result, setResult] = useState<{ id?: string; error?: string }>({})
  const [isPending, startTransition] = useTransition()
  const [pendingSignIn, setPendingSignIn] = useState<'user' | 'admin' | 'google' | ''>('')
  const [signInError, setSignInError] = useState('')

  useEffect(() => {
    if (window.location.hostname === '127.0.0.1') {
      const nextUrl = new URL(window.location.href)
      nextUrl.hostname = 'localhost'
      window.location.replace(nextUrl.toString())
      return
    }
    const params = new URLSearchParams(window.location.search)
    const requestedStep = Number(params.get('step'))
    if (requestedStep >= 1 && requestedStep <= 6) {
      setStep(requestedStep === 5 ? 6 : requestedStep)
    } else if (params.get('apply') === 'true' || params.get('baru') === 'true') {
      setStep(1)
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active || !isAppAccount(user)) return
        const params = new URLSearchParams(window.location.search)
        const hasFormIntent =
          params.has('step') || params.get('apply') === 'true' || params.get('baru') === 'true'
        const destination = await resolveUserDestination(user)
        if (hasFormIntent && destination !== '/admin') return
        if (active) router.replace(destination)
      })
    } catch {
      return
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [router])

  const signInAs = async (role: 'user' | 'admin' | 'google') => {
    setSignInError('')
    setPendingSignIn(role)
    try {
      const user =
        role === 'google' ? await signInWithGoogleAccount() : await signInWithDemoAccount(role)
      const destination = await resolveUserDestination(user)
      router.push(destination)
    } catch (error) {
      const code = (error as { code?: string })?.code
      setSignInError(
        role === 'google'
          ? code === 'auth/unauthorized-domain'
            ? 'Gunakan alamat http://localhost:3000 agar login Google diizinkan oleh Firebase.'
            : 'Tidak dapat masuk dengan Google. Izinkan popup lalu coba lagi.'
          : `Tidak dapat masuk sebagai ${role === 'admin' ? 'admin' : 'user'} demo. Silakan coba lagi.`,
      )
      setPendingSignIn('')
    }
  }
  const set = <K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const isDeparture = form.product === 'DEPARTURE_BRIDGING'
  const requestedFinancingAmount = Number(form.financingAmount)
  const estimatedMonthlyUjrah =
    Number.isSafeInteger(requestedFinancingAmount) && requestedFinancingAmount > 0
      ? Math.round(requestedFinancingAmount * 0.024)
      : null
  const estimatedTotalUjrah = estimatedMonthlyUjrah === null ? null : estimatedMonthlyUjrah * 12
  const estimatedAdminFee =
    Number.isSafeInteger(requestedFinancingAmount) && requestedFinancingAmount > 0
      ? Math.round(requestedFinancingAmount * 0.05)
      : null
  const estimatedCashDisbursed =
    estimatedAdminFee === null ? null : requestedFinancingAmount - estimatedAdminFee
  const estimatedFinancingTotal =
    estimatedTotalUjrah === null ? null : requestedFinancingAmount + estimatedTotalUjrah
  const visibleSteps = [1, 2, 3, 4, 6]
  const currentStep = visibleSteps.indexOf(step) + 1
  const toggleNeed = (need: string) =>
    set(
      'selectedNeeds',
      form.selectedNeeds.includes(need)
        ? form.selectedNeeds.filter((item) => item !== need)
        : [...form.selectedNeeds, need],
    )

  const ktpIndex = getKtpDocumentIndex(form.product)
  const ktpLabel =
    ktpIndex >= 0 ? (DOCUMENT_DEFINITIONS[form.product][ktpIndex]?.label ?? 'Scan KTP') : 'Scan KTP'

  const handleKtpChange = (file: File | undefined) => {
    if (!file) return
    setStep3Error('')
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_TYPES)[number])) {
      setKtpFile(null)
      setStep3Error('Gunakan berkas PDF, JPG, atau PNG untuk scan KTP.')
      return
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setKtpFile(null)
      setStep3Error('Ukuran scan KTP maksimal 10 MB.')
      return
    }
    setKtpFile(file)
  }

  const submit = () => {
    setResult({})
    const selectedBytes =
      Object.values(documentFiles).reduce((total, file) => total + (file?.size ?? 0), 0) +
      (ktpFile?.size ?? 0)
    if (selectedBytes > 60 * 1024 * 1024) {
      setResult({ error: 'Ukuran seluruh dokumen tidak boleh melebihi 60 MB.' })
      return
    }
    if (!form.applicantName.trim() || !form.lpkName.trim()) {
      setResult({ error: 'Lengkapi nama pemohon dan nama LPK sebelum mengirim.' })
      return
    }
    if (ktpIndex >= 0 && !ktpFile) {
      setResult({ error: `Dokumen ${ktpLabel} wajib diunggah.` })
      return
    }
    startTransition(async () => {
      let uploadToken = ''
      const uploaded: { index: number; fileId: string }[] = []
      try {
        const user = await ensureApplicantAccount()
        uploadToken = await user.getIdToken()
        for (const [index, document] of DOCUMENT_DEFINITIONS[form.product].entries()) {
          const file = index === ktpIndex ? ktpFile : documentFiles[document.label]
          if (!file) continue
          const result = await uploadToDrive({
            token: uploadToken,
            file,
            documentIndex: index,
            product: form.product,
            folderName: form.applicantName,
            lpkName: form.lpkName,
          })
          uploaded.push({ index, fileId: result.fileId })
        }
        const request = new FormData()
        request.set('application', JSON.stringify(form))
        request.set('uploads', JSON.stringify(uploaded))
        request.set('uploadToken', uploadToken)
        const response = await submitFinancingApplication(request)
        if (response.ok) {
          router.replace('/dashboard?applicationSubmitted=1')
        } else {
          await discardDriveUploads(
            uploadToken,
            uploaded.map((item) => item.fileId),
          )
          setResult({ error: response.message })
        }
      } catch (error) {
        if (uploadToken && uploaded.length) {
          await discardDriveUploads(
            uploadToken,
            uploaded.map((item) => item.fileId),
          )
        }
        setResult({
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Pengajuan belum dapat dikirim. Periksa koneksi lalu coba lagi.',
        })
      }
    })
  }

  return (
    <main className="app-canvas">
      <section
        className={`mobile-shell application-form ${step === 0 ? 'welcome-step' : step === 1 ? 'choice-step' : ''}`}
      >
        {step === 0 ? (
          <header className="welcome-hero">
            <img
              className="welcome-logo"
              src="/venturego-mark.svg"
              alt="VentureGo"
              width={24}
              height={23}
            />
            <div className="welcome-brand">
              <h1>Vworks Student Venture</h1>
              <span>by venturego.id</span>
            </div>
          </header>
        ) : (
          <header className="wizard-header">
            <div>
              <h1>Vworks Student Venture</h1>
              <span className="brand-caption">by venturego.id</span>
            </div>
          </header>
        )}

        <div className={`wizard-body ${step === 0 ? 'welcome-body' : ''}`}>
          {step === 0 && (
            <div className="welcome-copy">
              <h2>Selamat datang!</h2>
              <p>
                Persiapkan perjalananmu bersama kami. Mulai pengajuan pembiayaan dengan langkah yang
                mudah dan terarah.
              </p>
              <div className="welcome-actions">
                {isLocalDemoMode ? (
                  <>
                    <button
                      className="primary-button welcome-primary"
                      disabled={pendingSignIn !== ''}
                      onClick={() => signInAs('user')}
                      type="button"
                    >
                      <span>{pendingSignIn === 'user' ? 'Menghubungkan…' : 'Masuk User'}</span>
                    </button>
                    <button
                      className="back-button welcome-secondary"
                      disabled={pendingSignIn !== ''}
                      onClick={() => signInAs('admin')}
                      type="button"
                    >
                      <span>{pendingSignIn === 'admin' ? 'Menghubungkan…' : 'Masuk Admin'}</span>
                    </button>
                    <button
                      className="welcome-google-button"
                      disabled={pendingSignIn !== ''}
                      onClick={() => signInAs('google')}
                      type="button"
                    >
                      <span className="google-badge" aria-hidden="true">
                        <GoogleIcon />
                      </span>
                      <span>
                        {pendingSignIn === 'google' ? 'Menghubungkan…' : 'Masuk dengan Google'}
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-button welcome-primary"
                    disabled={pendingSignIn !== ''}
                    onClick={() => signInAs('google')}
                    type="button"
                  >
                    <span className="google-badge" aria-hidden="true">
                      <GoogleIcon />
                    </span>
                    <span>
                      {pendingSignIn === 'google' ? 'Menghubungkan…' : 'Masuk dengan Google'}
                    </span>
                  </button>
                )}
              </div>
              {signInError && (
                <p className="error-message" role="alert">
                  {signInError}
                </p>
              )}
              <p className="welcome-note">
                {isLocalDemoMode
                  ? 'Tombol User dan Admin memakai akun demo. Gunakan Google untuk akun pribadi.'
                  : 'Akun baru akan dibuat secara otomatis saat pertama kali masuk.'}
              </p>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="intro intro-choice">
                <h2>Pilih pembiayaan yang sesuai</h2>
                <p>
                  Setiap tahap persiapan memiliki kebutuhan yang berbeda. Pilih opsi yang paling
                  sesuai dengan kondisi Anda saat ini.
                </p>
              </div>
              <button
                aria-pressed={!isDeparture}
                className={`product-option ${!isDeparture ? 'selected' : ''}`}
                onClick={() => {
                  set('product', 'FULL_COVER')
                  setDocumentFiles({})
                }}
              >
                <span className="selection-box" aria-hidden="true">
                  {!isDeparture && <span>✓</span>}
                </span>
                <span className="product-copy">
                  <span className="product-tag">Persiapan lengkap</span>
                  <strong>VSV Full Cover</strong>
                  <p>Pelatihan bahasa, keterampilan, dokumen, dan kebutuhan keberangkatan.</p>
                  <small>Cocok jika Anda baru memulai proses di LPK.</small>
                </span>
              </button>
              <button
                aria-pressed={isDeparture}
                className={`product-option ${isDeparture ? 'selected' : ''}`}
                onClick={() => {
                  set('product', 'DEPARTURE_BRIDGING')
                  setDocumentFiles({})
                }}
              >
                <span className="selection-box" aria-hidden="true">
                  {isDeparture && <span>✓</span>}
                </span>
                <span className="product-copy">
                  <span className="product-tag">Tahap akhir</span>
                  <strong>VSV Dana Keberangkatan</strong>
                  <p>Pembayaran LPK, dokumen akhir, dan uang saku keberangkatan.</p>
                  <small>Cocok jika pelatihan sudah selesai atau COE sedang diproses.</small>
                </span>
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="intro intro-choice">
                <h2>
                  {isDeparture
                    ? 'Periksa kesiapan keberangkatan'
                    : 'Ceritakan kesiapan program Anda'}
                </h2>
                <p>
                  {isDeparture
                    ? 'Dana Keberangkatan ditujukan bagi siswa yang telah menyelesaikan sebagian besar proses pelatihan.'
                    : 'Informasi ini membantu VSV menyusun kebutuhan pelatihan dan pembiayaan persiapan Anda.'}
                </p>
              </div>
              <div className="choice-list">
                {(isDeparture
                  ? [
                      ['trainingCompleted', 'Pelatihan sudah selesai'],
                      ['placementPassed', 'Saya sudah lulus seleksi penempatan'],
                      ['hasPassport', 'Saya sudah memiliki paspor'],
                      ['hasWorkContract', 'Saya sudah memiliki kontrak kerja'],
                    ]
                  : [
                      ['trainingStarted', 'Pelatihan bahasa sudah dimulai'],
                      ['hasPassport', 'Saya sudah memiliki paspor'],
                      ['guardianApproval', 'Orang tua atau wali sudah menyetujui'],
                    ]
                ).map(([key, label]) => (
                  <label className="check-row" key={key}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(form[key as keyof ApplicationInput])}
                      onChange={(e) =>
                        set(key as keyof ApplicationInput, e.target.checked as never)
                      }
                    />
                  </label>
                ))}
              </div>
              {isDeparture ? (
                <>
                  <label className="field">
                    <span>Status COE</span>
                    <select
                      value={form.coeStatus}
                      onChange={(e) =>
                        set('coeStatus', e.target.value as ApplicationInput['coeStatus'])
                      }
                    >
                      <option value="NOT_STARTED">Belum diproses</option>
                      <option value="IN_PROGRESS">Sedang diproses</option>
                      <option value="ISSUED">Sudah terbit</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Status visa</span>
                    <select
                      value={form.visaStatus}
                      onChange={(e) =>
                        set('visaStatus', e.target.value as ApplicationInput['visaStatus'])
                      }
                    >
                      <option value="NOT_STARTED">Belum diproses</option>
                      <option value="IN_PROGRESS">Sedang diproses</option>
                      <option value="ISSUED">Sudah terbit</option>
                    </select>
                  </label>
                </>
              ) : (
                <label className="field">
                  <span>Level bahasa Jepang saat ini</span>
                  <select
                    value={form.languageLevel}
                    onChange={(e) =>
                      set('languageLevel', e.target.value as ApplicationInput['languageLevel'])
                    }
                  >
                    <option value="NOT_STARTED">Belum mulai</option>
                    <option value="BASIC_N5">N5 dasar</option>
                    <option value="N5">N5</option>
                    <option value="N4">N4</option>
                    <option value="N3_PLUS">N3 atau lebih tinggi</option>
                  </select>
                </label>
              )}
              {isDeparture && !form.trainingCompleted && (
                <div className="soft-note">
                  Dana Keberangkatan biasanya diberikan setelah pelatihan selesai. Tim VSV akan
                  memeriksa kelayakan Anda.
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="intro intro-choice">
                <h2>Data diri pemohon</h2>
                <p>Gunakan data yang sama dengan dokumen identitas resmi Anda.</p>
              </div>
              <label className="field">
                <span>{ktpLabel} (wajib)</span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  type="file"
                  onChange={(event) => {
                    handleKtpChange(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              <p className="text-[11px] leading-4 text-slate-500">
                {ktpFile
                  ? `${ktpFile.name} · ${(ktpFile.size / (1024 * 1024)).toFixed(2)} MB akan diunggah bersama pengajuan.`
                  : 'PDF, JPG, atau PNG · maksimal 10 MB. Berkas diunggah ke Google Drive saat pengajuan dikirim.'}
              </p>
              {step3Error && (
                <p className="error-message" role="alert">
                  {step3Error}
                </p>
              )}
              <label className="field">
                <span>Nama lengkap</span>
                <input
                  value={form.applicantName}
                  onChange={(e) => set('applicantName', e.target.value)}
                  placeholder="Sesuai KTP"
                />
              </label>
              <label className="field">
                <span>Nomor WhatsApp</span>
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </label>
              <label className="field">
                <span>Agama</span>
                <select
                  value={form.religion}
                  onChange={(e) => set('religion', e.target.value as ApplicationInput['religion'])}
                >
                  <option value="ISLAM">Islam</option>
                  <option value="PROTESTANT">Kristen Protestan</option>
                  <option value="CATHOLIC">Katolik</option>
                  <option value="HINDU">Hindu</option>
                  <option value="BUDDHIST">Buddha</option>
                  <option value="CONFUCIAN">Konghucu</option>
                </select>
              </label>
              <label className="field">
                <span>Tempat lahir</span>
                <input
                  value={form.birthPlace}
                  onChange={(e) => set('birthPlace', e.target.value)}
                  placeholder="Kota / kabupaten"
                />
              </label>
              <label className="field">
                <span>Tanggal lahir</span>
                <input
                  value={form.birthDate}
                  onChange={(e) => set('birthDate', e.target.value)}
                  placeholder="12 Februari 2000"
                />
              </label>
              <label className="field">
                <span>Jenis kelamin</span>
                <select
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value as ApplicationInput['gender'])}
                >
                  <option value="MALE">Laki-laki</option>
                  <option value="FEMALE">Perempuan</option>
                </select>
              </label>
              <label className="field">
                <span>Alamat sesuai KTP</span>
                <textarea
                  value={form.idCardAddress}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((current) => ({
                      ...current,
                      idCardAddress: value,
                      ...(current.domicileSameAsIdCard ? { domicileAddress: value } : {}),
                    }))
                  }}
                  placeholder="Jl., RT, RW, Kel., Kec., Kab., Prov."
                  rows={4}
                />
              </label>
              <label className="switch-row">
                <span>
                  <strong>Alamat korespondensi sama dengan KTP</strong>
                  <small>
                    Aktifkan jika surat menyurat dikirim ke alamat yang sama dengan KTP.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={form.domicileSameAsIdCard}
                  onChange={(e) => {
                    const same = e.target.checked
                    setForm((current) => ({
                      ...current,
                      domicileSameAsIdCard: same,
                      ...(same ? { domicileAddress: current.idCardAddress } : {}),
                    }))
                  }}
                />
              </label>
              <label className="field">
                <span>Alamat korespondensi (untuk surat menyurat)</span>
                <textarea
                  value={form.domicileSameAsIdCard ? form.idCardAddress : form.domicileAddress}
                  onChange={(e) => set('domicileAddress', e.target.value)}
                  placeholder={
                    form.domicileSameAsIdCard
                      ? 'Mengikuti alamat sesuai KTP'
                      : 'Jl., RT, RW, Kel., Kec., Kab., Prov.'
                  }
                  readOnly={form.domicileSameAsIdCard}
                  rows={4}
                />
              </label>
              <label className="field">
                <span>Kode pos alamat korespondensi</span>
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={form.domicilePostalCode}
                  onChange={(e) =>
                    set('domicilePostalCode', e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="Contoh: 56351"
                />
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <div className="intro intro-choice">
                <h2>{isDeparture ? 'Rincian kebutuhan dana talang' : 'Rencana program Anda'}</h2>
                <p>
                  {isDeparture
                    ? 'Lengkapi waktu keberangkatan dan kewajiban yang masih perlu diselesaikan.'
                    : 'Lengkapi informasi program dan kebutuhan yang akan dibiayai.'}
                </p>
              </div>
              {isDeparture ? (
                <>
                  <label className="field">
                    <span>Nama LPK</span>
                    <input
                      value={form.lpkName}
                      onChange={(e) => set('lpkName', e.target.value)}
                      placeholder="Contoh: LPK Sakura"
                    />
                  </label>
                  <label className="field">
                    <span>Negara tujuan</span>
                    <select
                      value={form.destination}
                      onChange={(e) =>
                        set('destination', e.target.value as ApplicationInput['destination'])
                      }
                    >
                      <option value="JAPAN">Jepang</option>
                      <option value="TURKEY">Turki</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Perkiraan tanggal keberangkatan</span>
                    <input
                      value={form.estimatedDeparture}
                      onChange={(e) => set('estimatedDeparture', e.target.value)}
                      placeholder="12 Februari 2026"
                    />
                  </label>
                  <label className="field">
                    <span>Sisa kewajiban kepada LPK</span>
                    <div className="currency-input">
                      <span>Rp</span>
                      <input
                        inputMode="numeric"
                        value={formatAmountInput(form.outstandingLPKAmount)}
                        onChange={(e) =>
                          set('outstandingLPKAmount', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="0"
                      />
                    </div>
                  </label>
                  <div className="need-section">
                    <label className="field">
                      <span>Nilai pembiayaan sebelum potongan admin</span>
                      <select
                        value={form.financingAmount}
                        onChange={(event) => set('financingAmount', event.target.value)}
                      >
                        <option value="">Pilih nilai pembiayaan</option>
                        {[31_000_000, 33_000_000, 36_000_000, 40_000_000].map((amount) => (
                          <option key={amount} value={String(amount)}>
                            Rp{amount.toLocaleString('id-ID')}
                          </option>
                        ))}
                      </select>
                    </label>
                    {estimatedMonthlyUjrah !== null &&
                      estimatedTotalUjrah !== null &&
                      estimatedAdminFee !== null &&
                      estimatedCashDisbursed !== null &&
                      estimatedFinancingTotal !== null && (
                        <div className="finance-grid mt-3">
                          <div className="wide finance-highlight">
                            <span>Estimasi dana cair</span>
                            <strong>{formatRupiah(estimatedCashDisbursed)}</strong>
                            <small>Nilai pengajuan setelah potongan admin 5%</small>
                          </div>
                          <div>
                            <span>Total Ujrah (simulasi 2,4% × 12 bulan)</span>
                            <strong>{formatRupiah(estimatedTotalUjrah)}</strong>
                          </div>
                          <div>
                            <span>Biaya admin (5%)</span>
                            <strong>{formatRupiah(estimatedAdminFee)}</strong>
                          </div>
                          <div className="finance-highlight">
                            <span>Total kewajiban (simulasi)</span>
                            <strong>{formatRupiah(estimatedFinancingTotal)}</strong>
                            <small>Nilai pembiayaan + total Ujrah 12 bulan</small>
                          </div>
                          <div className="finance-highlight finance-installment">
                            <span>Angsuran per bulan (simulasi 12 bulan)</span>
                            <strong>{formatRupiah(estimatedFinancingTotal / 12)}</strong>
                            <small>12 kali angsuran, belum menjadi jadwal akad final</small>
                          </div>
                        </div>
                      )}
                    <div className="soft-note space-y-2 mt-4">
                      <p className="font-semibold text-slate-800">
                        Mengenal akad Wakalah bil Ujrah
                      </p>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          Anda memberi kuasa kepada VentureGo sebagai wakil untuk membantu mengurus
                          kebutuhan keberangkatan yang disepakati.
                        </li>
                        <li>
                          Dana digunakan untuk kebutuhan yang disetujui; rincian dan bukti
                          pengeluaran diverifikasi sebelum akad final.
                        </li>
                        <li>
                          Ujrah adalah imbalan jasa yang besarannya dan cara pembayarannya harus
                          tercantum jelas dalam akad.
                        </li>
                        <li>
                          Simulasi dana cair, Ujrah, total kewajiban, dan angsuran di atas belum
                          menjadi ketentuan final sebelum diverifikasi dan disepakati.
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Nama Lembaga Pelatihan Kerja</span>
                    <input
                      value={form.lpkName}
                      onChange={(e) => set('lpkName', e.target.value)}
                      placeholder="Contoh: LPK Sakura"
                    />
                  </label>
                  <label className="field">
                    <span>Negara tujuan</span>
                    <select
                      value={form.destination}
                      onChange={(e) =>
                        set('destination', e.target.value as ApplicationInput['destination'])
                      }
                    >
                      <option value="JAPAN">Jepang</option>
                      <option value="TURKEY">Turki</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Perkiraan tanggal mulai</span>
                    <input
                      type="date"
                      value={form.trainingStartDate}
                      onChange={(e) => set('trainingStartDate', e.target.value)}
                    />
                  </label>
                  <div className="field-grid">
                    <label className="field">
                      <span>Bahasa</span>
                      <input
                        inputMode="numeric"
                        value={form.languageTrainingMonths}
                        onChange={(e) =>
                          set('languageTrainingMonths', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Bulan"
                      />
                    </label>
                    <label className="field">
                      <span>Keterampilan</span>
                      <input
                        inputMode="numeric"
                        value={form.skillTrainingMonths}
                        onChange={(e) =>
                          set('skillTrainingMonths', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Bulan"
                      />
                    </label>
                  </div>
                  <div className="need-section">
                    <strong>Kebutuhan yang diajukan</strong>
                    <div className="choice-list need-checkbox-list">
                      {FULL_COVER_NEEDS.map(([value, label]) => (
                        <label
                          className={`check-row need-checkbox-row ${
                            form.selectedNeeds.includes(value) ? 'selected' : ''
                          }`}
                          key={value}
                        >
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={form.selectedNeeds.includes(value)}
                            onChange={() => toggleNeed(value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <div className="intro intro-choice">
                <h2>
                  {isDeparture ? 'Periksa kebutuhan keberangkatan' : 'Periksa rencana Full Cover'}
                </h2>
                <p>Nominal final mengikuti verifikasi kebutuhan dan akad yang Anda setujui.</p>
              </div>
              <section className="summary-hero">
                <span>{isDeparture ? 'VSV Dana Keberangkatan' : 'VSV Full Cover'}</span>
                <strong>Wakalah bil Ujrah</strong>
                <small>
                  Anda memberi kuasa kepada VSV untuk mengurus dan membayarkan kebutuhan yang
                  disepakati.
                </small>
              </section>
              {isDeparture ? (
                <div className="soft-note space-y-2">
                  <p>
                    Estimasi dana cair setelah potongan admin 5%:{' '}
                    <strong>
                      {estimatedCashDisbursed !== null
                        ? formatRupiah(estimatedCashDisbursed)
                        : 'Belum diisi'}
                    </strong>
                  </p>
                  {estimatedMonthlyUjrah !== null &&
                    estimatedTotalUjrah !== null &&
                    estimatedAdminFee !== null &&
                    estimatedCashDisbursed !== null &&
                    estimatedFinancingTotal !== null && (
                      <>
                        <p>
                          Estimasi dana cair setelah potongan admin 5%:{' '}
                          <strong>{formatRupiah(estimatedCashDisbursed)}</strong>
                        </p>
                        <p>
                          Total Ujrah (simulasi 2,4% × 12 bulan):{' '}
                          <strong>{formatRupiah(estimatedTotalUjrah)}</strong>
                        </p>
                        <p>
                          Biaya admin (5%): <strong>{formatRupiah(estimatedAdminFee)}</strong>
                        </p>
                        <p>
                          Total kewajiban (simulasi):{' '}
                          <strong>{formatRupiah(estimatedFinancingTotal)}</strong>
                        </p>
                        <p>
                          Angsuran per bulan (simulasi 12 bulan):{' '}
                          <strong>{formatRupiah(estimatedFinancingTotal / 12)}</strong>
                        </p>
                      </>
                    )}
                  <p>
                    Nilai dana cair, total Ujrah, total kewajiban, dan angsuran di atas hanya
                    simulasi. Rincian final menunggu verifikasi admin dan persetujuan Anda.
                  </p>
                </div>
              ) : (
                <div className="soft-note space-y-3">
                  <p className="font-semibold text-slate-800">
                    Rincian biaya Full Cover akan diisi dan diverifikasi tim VentureGo sebelum akad
                    disepakati.
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <strong>Nafaqah:</strong> pengeluaran riil untuk kebutuhan yang disetujui,
                      disertai bukti pembayaran.
                    </li>
                    <li>
                      <strong>Ujrah:</strong> imbalan jasa yang nilainya dicantumkan dalam akad.
                    </li>
                    <li>
                      <strong>Ju&apos;alah:</strong>{' '}
                      {form.destination === 'JAPAN'
                        ? 'hanya berlaku jika COE atas nama Anda terbit.'
                        : 'ketentuannya belum ditetapkan untuk negara tujuan ini dan perlu dikonfirmasi dalam akad.'}
                    </li>
                  </ul>
                  <p>
                    VentureGo bertindak sebagai wakil terbatas untuk kebutuhan yang disetujui dan
                    bukti pengeluaran dapat diminta. Dokumen administrasi digunakan untuk
                    verifikasi, bukan sebagai jaminan.
                  </p>
                  <p>
                    Total, tenor, angsuran, dan waktu mulai pembayaran akan dikonfirmasi sebelum
                    penandatanganan. Jika COE tidak terbit atau pengajuan dihentikan, perhitungan
                    dilakukan berdasarkan ketentuan akad final dan biaya aktual yang dapat
                    dibuktikan; aplikasi ini tidak menetapkan biaya komitmen otomatis.
                  </p>
                  <p>
                    Contoh akad menyebut total tetap setelah ditandatangani, pelunasan dipercepat
                    tanpa penalti, dan biaya penagihan hanya berdasarkan biaya aktual yang
                    dibuktikan. Ketentuan yang berlaku tetap harus tercantum dalam akad final.
                  </p>
                  <p>
                    {form.destination === 'JAPAN'
                      ? 'Contoh akad memulai angsuran pada bulan pertama setelah keberangkatan; tanggal dan jadwal final tetap dicantumkan dalam akad yang disepakati.'
                      : 'Jadwal pembayaran untuk negara tujuan ini akan ditetapkan dalam akad final.'}
                  </p>
                  <div className="border-t border-slate-200 pt-3">
                    <strong>Kebutuhan yang diajukan</strong>
                    <p className="mt-1">
                      {form.selectedNeeds.length
                        ? FULL_COVER_NEEDS.filter(([value]) => form.selectedNeeds.includes(value))
                            .map(([, label]) => label)
                            .join(', ')
                        : 'Belum dipilih'}
                    </p>
                    <p className="mt-1">
                      Durasi pelatihan: bahasa {form.languageTrainingMonths || '—'} bulan,
                      keterampilan {form.skillTrainingMonths || '—'} bulan.
                    </p>
                  </div>
                </div>
              )}
              <div className="review-list">
                <div>
                  <span>Nama</span>
                  <strong>{form.applicantName || 'Belum diisi'}</strong>
                </div>
                <div>
                  <span>LPK</span>
                  <strong>{form.lpkName || 'Belum diisi'}</strong>
                </div>
                <div>
                  <span>Tujuan</span>
                  <strong>{form.destination === 'JAPAN' ? 'Jepang' : 'Turki'}</strong>
                </div>
                {isDeparture && (
                  <>
                    <div>
                      <span>Estimasi dana cair (setelah admin 5%)</span>
                      <strong>
                        {estimatedCashDisbursed !== null
                          ? formatRupiah(estimatedCashDisbursed)
                          : 'Belum diisi'}
                      </strong>
                    </div>
                    {estimatedMonthlyUjrah !== null &&
                      estimatedTotalUjrah !== null &&
                      estimatedAdminFee !== null &&
                      estimatedCashDisbursed !== null &&
                      estimatedFinancingTotal !== null && (
                        <>
                          <div>
                            <span>Total Ujrah (simulasi 2,4% × 12 bulan)</span>
                            <strong>{formatRupiah(estimatedTotalUjrah)}</strong>
                          </div>
                          <div>
                            <span>Biaya admin (5%)</span>
                            <strong>{formatRupiah(estimatedAdminFee)}</strong>
                          </div>
                          <div className="finance-review-total">
                            <span>Total kewajiban (simulasi)</span>
                            <strong>{formatRupiah(estimatedFinancingTotal)}</strong>
                          </div>
                          <div className="finance-review-total">
                            <span>Angsuran per bulan (simulasi 12 bulan)</span>
                            <strong>{formatRupiah(estimatedFinancingTotal / 12)}</strong>
                          </div>
                        </>
                      )}
                  </>
                )}
                <div>
                  <span>Tempat, tanggal lahir</span>
                  <strong>
                    {`${form.birthPlace || 'Belum diisi'}${form.birthDate ? `, ${form.birthDate}` : ''}`}
                  </strong>
                </div>
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={form.understandsWakalah}
                  onChange={(e) => set('understandsWakalah', e.target.checked)}
                />
                <span>
                  {isDeparture
                    ? 'Saya memahami bahwa total kewajiban terdiri dari pengeluaran riil (Nafaqah) dan Ujrah jasa VSV.'
                    : form.destination === 'JAPAN'
                      ? 'Saya memahami bahwa Nafaqah dan Ujrah akan diverifikasi serta Ju’alah hanya berlaku jika COE terbit; rincian final akan dicantumkan dalam akad.'
                      : 'Saya memahami bahwa Nafaqah, Ujrah, dan ketentuan Ju’alah untuk negara tujuan akan dikonfirmasi serta dicantumkan dalam akad final.'}
                </span>
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={form.acceptsDataProcessing}
                  onChange={(e) => set('acceptsDataProcessing', e.target.checked)}
                />
                <span>Saya menyetujui pemrosesan data untuk pemeriksaan pengajuan.</span>
              </label>
              {result.error && <p className="error-message">{result.error}</p>}
            </>
          )}
        </div>

        {step > 0 && step < 7 && (
          <footer className="wizard-footer">
            <div
              className="step-dots"
              aria-label={`Langkah ${currentStep} dari ${visibleSteps.length}`}
            >
              {visibleSteps.map((visibleStep) => (
                <span
                  className={
                    visibleStep === step ? 'active' : visibleStep < step ? 'completed' : ''
                  }
                  key={visibleStep}
                />
              ))}
            </div>
            {step === 1 ? (
              <Link className="back-button" href="/dashboard">
                Kembali
              </Link>
            ) : (
              <button
                className="back-button"
                onClick={() => (step === 6 ? setStep(4) : setStep(step - 1))}
                type="button"
              >
                Kembali
              </button>
            )}
            <button
              className="primary-button"
              disabled={isPending}
              onClick={() => {
                if (step === 6) {
                  submit()
                  return
                }
                if (step === 3 && !ktpFile) {
                  setStep3Error('Scan KTP wajib diunggah sebelum melanjutkan.')
                  return
                }
                setStep3Error('')
                setStep(step === 4 ? 6 : step + 1)
              }}
            >
              {isPending ? 'Mengirim…' : step === 6 ? 'Kirim pengajuan' : 'Lanjut'}
            </button>
          </footer>
        )}
      </section>
    </main>
  )
}
