'use client'

import { useState, useTransition } from 'react'
import {
  discardApplicationUploads,
  submitFinancingApplication,
  type ApplicationInput,
} from './actions'
import {
  FINANCING_OPTIONS,
  calculateWakalahPlan,
  formatRupiah,
  isFinancingAmount,
} from '@/lib/financing-plan'
import {
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  isAcceptedDocumentType,
} from '@/lib/documents'
import { getFirebaseClientAuth, getFirebaseClientStorage } from '@/lib/firebase-client'
import { signInAnonymously, signOut } from 'firebase/auth'
import { ref, uploadBytes } from 'firebase/storage'

type Product = ApplicationInput['product']

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
  trainingProgram: '',
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

export default function HomePage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({})
  const [result, setResult] = useState<{ id?: string; error?: string }>({})
  const [isPending, startTransition] = useTransition()
  const set = <K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const isDeparture = form.product === 'DEPARTURE_BRIDGING'
  const selectedFinancingAmount = Number(form.financingAmount)
  const plan = isFinancingAmount(selectedFinancingAmount)
    ? calculateWakalahPlan(selectedFinancingAmount)
    : null
  const toggleNeed = (need: string) =>
    set(
      'selectedNeeds',
      form.selectedNeeds.includes(need)
        ? form.selectedNeeds.filter((item) => item !== need)
        : [...form.selectedNeeds, need],
    )

  const submit = () => {
    setResult({})
    const selectedBytes = Object.values(documentFiles).reduce(
      (total, file) => total + (file?.size ?? 0),
      0,
    )
    if (selectedBytes > 60 * 1024 * 1024) {
      setResult({ error: 'Ukuran seluruh dokumen tidak boleh melebihi 60 MB.' })
      return
    }
    startTransition(async () => {
      let uploadToken = ''
      const uploaded: { index: number; path: string }[] = []
      try {
        const auth = getFirebaseClientAuth()
        if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth)
        const user = auth.currentUser ?? (await signInAnonymously(auth)).user
        uploadToken = await user.getIdToken()
        const storage = getFirebaseClientStorage()
        for (const [index, document] of DOCUMENT_DEFINITIONS[form.product].entries()) {
          const file = documentFiles[document.label]
          if (!file) continue
          const fileName = file.name.replace(/[\\/]/g, '_').slice(0, 180)
          const path = `application-uploads/${user.uid}/${crypto.randomUUID()}/${fileName}`
          await uploadBytes(ref(storage, path), file, {
            contentType: file.type,
            customMetadata: { originalName: file.name },
          })
          uploaded.push({ index, path })
        }
        const request = new FormData()
        request.set('application', JSON.stringify(form))
        request.set('uploads', JSON.stringify(uploaded))
        request.set('uploadToken', uploadToken)
        const response = await submitFinancingApplication(request)
        if (response.ok) {
          setResult({ id: response.applicationId })
          setStep(7)
        } else {
          await discardApplicationUploads(uploadToken, uploaded.map((item) => item.path))
          setResult({ error: response.message })
        }
      } catch {
        if (uploadToken && uploaded.length) {
          await discardApplicationUploads(uploadToken, uploaded.map((item) => item.path))
        }
        setResult({ error: 'Pengajuan belum dapat dikirim. Periksa koneksi lalu coba lagi.' })
      }
    })
  }

  return (
    <main className="app-canvas">
      <section
        className={`mobile-shell ${step === 0 ? 'welcome-step' : step === 1 ? 'choice-step' : ''}`}
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
                Persiapkan perjalananmu bersama kami. Mulai pengajuan pembiayaan dengan langkah
                yang mudah dan terarah.
              </p>
              <div className="welcome-actions">
                <button className="primary-button welcome-primary" onClick={() => setStep(1)}>
                  Masuk/Daftar
                </button>
              </div>
              <p className="welcome-note">Siapkan dokumen pendukung sebelum memulai pengajuan.</p>
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
              {!isDeparture && (
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
                </>
              )}
              {isDeparture && (
                <>
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
                    <input
                      inputMode="numeric"
                      value={form.outstandingLPKAmount}
                      onChange={(e) =>
                        set('outstandingLPKAmount', e.target.value.replace(/\D/g, ''))
                      }
                      placeholder="Contoh: 24000000"
                    />
                  </label>
                  <div className="need-section">
                    <strong>Jumlah pembiayaan yang dibutuhkan</strong>
                    <div className="need-grid">
                      {FINANCING_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.amount}
                          className={
                            form.financingAmount === String(option.amount)
                              ? 'need-chip selected'
                              : 'need-chip'
                          }
                          onClick={() => set('financingAmount', String(option.amount))}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {plan ? (
                    <>
                      <div className="finance-grid">
                        <div>
                          <span>Nafaqah (pokok)</span>
                          <strong>{formatRupiah(plan.nafaqahTotal)}</strong>
                        </div>
                        <div>
                          <span>Ujrah VSV</span>
                          <strong>{formatRupiah(plan.ujrahTotal)}</strong>
                        </div>
                        <div className="wide">
                          <span>Total kewajiban</span>
                          <strong>{formatRupiah(plan.totalObligation)}</strong>
                          <small>
                            12 × {formatRupiah(plan.monthlyInstallment)}
                            {plan.finalInstallment !== plan.monthlyInstallment
                              ? `, angsuran terakhir ${formatRupiah(plan.finalInstallment)}`
                              : ''}
                          </small>
                        </div>
                      </div>
                      <div className="soft-note">
                        Ujrah ditetapkan sekali saat akad dan tidak berbunga majemuk.
                      </div>
                    </>
                  ) : (
                    <div className="soft-note">
                      Pilih salah satu jumlah pembiayaan untuk melihat rincian Nafaqah, Ujrah, dan
                      angsuran.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Nama program pelatihan</span>
                    <input
                      value={form.trainingProgram}
                      onChange={(e) => set('trainingProgram', e.target.value)}
                      placeholder="Contoh: Bahasa dan skill kerja Jepang"
                    />
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
                  <div className="choice-list">
                    <label className="check-row">
                      <span>Butuh uang saku pelatihan</span>
                      <input
                        type="checkbox"
                        checked={form.requiresTrainingAllowance}
                        onChange={(e) => set('requiresTrainingAllowance', e.target.checked)}
                      />
                    </label>
                    <label className="check-row">
                      <span>Butuh biaya tempat tinggal</span>
                      <input
                        type="checkbox"
                        checked={form.requiresAccommodation}
                        onChange={(e) => set('requiresAccommodation', e.target.checked)}
                      />
                    </label>
                  </div>
                  <div className="need-section">
                    <strong>Kebutuhan yang diajukan</strong>
                    <div className="need-grid">
                      {[
                        ['LANGUAGE_TRAINING', 'Pelatihan bahasa'],
                        ['SKILL_TRAINING', 'Pelatihan keterampilan'],
                        ['MEDICAL', 'MCU'],
                        ['DOCUMENT', 'Dokumen'],
                        ['ALLOWANCE', 'Uang saku'],
                        ['ACCOMMODATION', 'Tempat tinggal'],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={
                            form.selectedNeeds.includes(value) ? 'need-chip selected' : 'need-chip'
                          }
                          onClick={() => toggleNeed(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <div className="intro intro-choice">
                <h2>{isDeparture ? 'Dokumen keberangkatan' : 'Dokumen program'}</h2>
                <p>
                  {isDeparture
                    ? 'Siapkan dokumen untuk memverifikasi data diri dan kesiapan keberangkatan.'
                    : 'Siapkan dokumen program agar VSV dapat menyusun rincian Nafaqah dan Ujrah.'}
                </p>
              </div>
              <div className="document-list">
                {DOCUMENT_DEFINITIONS[form.product].map((document) => {
                  const file = documentFiles[document.label]
                  const error =
                    file && !isAcceptedDocumentType(file.type)
                      ? 'Gunakan PDF, JPG, atau PNG.'
                      : file && file.size > MAX_DOCUMENT_SIZE_BYTES
                        ? 'Ukuran file maksimal 10 MB.'
                        : ''
                  return (
                    <label
                      className="flex min-h-16 flex-col gap-2 border-b border-[#ececf1] py-3 text-sm"
                      key={document.label}
                    >
                      <span>
                        <strong>
                          {document.label}
                          {document.required ? ' *' : ''}
                        </strong>
                        <small>
                          {error ||
                            (file
                              ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
                              : 'PDF, JPG, atau PNG · Maks. 10 MB')}
                        </small>
                      </span>
                      <input
                        aria-label={`Unggah ${document.label}`}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(event) =>
                          setDocumentFiles((current) => ({
                            ...current,
                            [document.label]: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </label>
                  )
                })}
              </div>
              {result.error && <p className="error-message">{result.error}</p>}
              <div className="soft-note">
                Dokumen asli hanya untuk administrasi dan verifikasi data, bukan sebagai aset
                jaminan atau rahn.
              </div>
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
                plan ? (
                  <div className="finance-grid">
                    <div>
                      <span>Nafaqah estimasi</span>
                      <strong>{formatRupiah(plan.nafaqahTotal)}</strong>
                    </div>
                    <div>
                      <span>Ujrah VSV</span>
                      <strong>{formatRupiah(plan.ujrahTotal)}</strong>
                    </div>
                    <div className="wide">
                      <span>Total estimasi</span>
                      <strong>{formatRupiah(plan.totalObligation)}</strong>
                      <small>
                        {plan.tenorMonths} × {formatRupiah(plan.monthlyInstallment)}
                        {plan.finalInstallment !== plan.monthlyInstallment
                          ? `, angsuran terakhir ${formatRupiah(plan.finalInstallment)}`
                          : ''}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="soft-note">
                    Pilih jumlah pembiayaan yang dibutuhkan pada langkah sebelumnya.
                  </div>
                )
              ) : (
                <div className="soft-note">
                  Rincian Nafaqah dan Ujrah Full Cover akan disusun setelah verifikasi program
                  pelatihan dan kebutuhan Anda.
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
                  <div>
                    <span>Jumlah pembiayaan</span>
                    <strong>{plan ? formatRupiah(plan.nafaqahTotal) : 'Belum dipilih'}</strong>
                  </div>
                )}
                <div>
                  <span>{isDeparture ? 'Tempat, tanggal lahir' : 'Program'}</span>
                  <strong>
                    {isDeparture
                      ? `${form.birthPlace || 'Belum diisi'}${form.birthDate ? `, ${form.birthDate}` : ''}`
                      : form.trainingProgram || 'Belum diisi'}
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
                  Saya memahami bahwa total kewajiban terdiri dari pengeluaran riil (Nafaqah) dan
                  Ujrah jasa VSV.
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

          {step === 7 && (
            <div className="success-state">
              <span className="success-mark">✓</span>
              <span className="status-pill">Terkirim</span>
              <h2>
                {isDeparture
                  ? 'Pengajuan Dana Keberangkatan diterima'
                  : 'Pengajuan Full Cover diterima'}
              </h2>
              <p>
                {isDeparture
                  ? 'Tim VSV akan memverifikasi data diri, kesiapan, dan dokumen keberangkatan Anda.'
                  : 'Tim VSV akan mengonfirmasi program dengan LPK dan menyusun rincian Nafaqah serta Ujrah.'}
              </p>
              <div className="application-id">
                <span>ID Pengajuan</span>
                <strong>{result.id}</strong>
              </div>
              <div className="timeline">
                <div className="done">
                  <i />
                  <span>
                    <strong>Pengajuan diterima</strong>
                    <small>Hari ini</small>
                  </span>
                </div>
                <div>
                  <i />
                  <span>
                    <strong>
                      {isDeparture
                        ? 'Verifikasi data, COE, dan visa'
                        : 'Konfirmasi program dengan LPK'}
                    </strong>
                    <small>Langkah berikutnya</small>
                  </span>
                </div>
                <div>
                  <i />
                  <span>
                    <strong>
                      {isDeparture
                        ? 'Persiapan akad dan pencairan'
                        : 'Penyusunan Nafaqah, Ujrah, dan akad'}
                    </strong>
                    <small>Menunggu</small>
                  </span>
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setForm(initialForm)
                  setDocumentFiles({})
                  setStep(0)
                  setResult({})
                }}
              >
                Kembali ke awal
              </button>
            </div>
          )}
        </div>

        {step > 0 && step < 7 && (
          <footer className={`wizard-footer ${step === 1 ? 'single-action' : ''}`}>
            <div className="step-dots" aria-label={`Langkah ${step} dari 6`}>
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  className={index + 1 === step ? 'active' : index + 1 < step ? 'completed' : ''}
                  key={index}
                />
              ))}
            </div>
            {step > 1 && (
              <button className="back-button" onClick={() => setStep(step - 1)}>
                Kembali
              </button>
            )}
            <button
              className="primary-button"
              disabled={isPending}
              onClick={() => {
                if (step === 5) {
                  const definitions = DOCUMENT_DEFINITIONS[form.product]
                  const missing = definitions.find(
                    (document) => document.required && !documentFiles[document.label],
                  )
                  const invalid = definitions.find((document) => {
                    const file = documentFiles[document.label]
                    return (
                      file &&
                      (!isAcceptedDocumentType(file.type) || file.size > MAX_DOCUMENT_SIZE_BYTES)
                    )
                  })
                  if (missing) {
                    setResult({ error: `Dokumen ${missing.label} wajib diunggah.` })
                    return
                  }
                  if (invalid) {
                    setResult({ error: `Periksa tipe dan ukuran dokumen ${invalid.label}.` })
                    return
                  }
                  setResult({})
                }
                if (step === 6) submit()
                else setStep(step + 1)
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
