'use client'

import { useState, useTransition } from 'react'
import { submitFinancingApplication, type ApplicationInput } from './actions'

type Product = ApplicationInput['product']

const commonDocuments = ['KTP siswa', 'Kartu Keluarga', 'Persetujuan orang tua', 'Rekomendasi LPK']
const productDocuments: Record<Product, string[]> = {
  FULL_COVER: [
    'Akta kelahiran',
    'Ijazah terakhir',
    'Bukti pendaftaran LPK',
    'Rincian program pelatihan',
    'Estimasi biaya LPK',
  ],
  DEPARTURE_BRIDGING: [
    'Paspor',
    'Kontrak kerja',
    'COE / bukti proses',
    'Visa / bukti proses',
    'Tagihan LPK',
    'Jadwal keberangkatan',
  ],
}

const initialForm: ApplicationInput = {
  product: 'FULL_COVER',
  applicantName: '',
  phone: '',
  lpkName: '',
  birthPlace: '',
  birthDate: '',
  gender: 'MALE',
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
  selectedNeeds: [],
  understandsWakalah: false,
  acceptsDataProcessing: false,
}

export default function HomePage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState<{ id?: string; error?: string }>({})
  const [isPending, startTransition] = useTransition()
  const set = <K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const isDeparture = form.product === 'DEPARTURE_BRIDGING'
  const toggleNeed = (need: string) =>
    set(
      'selectedNeeds',
      form.selectedNeeds.includes(need)
        ? form.selectedNeeds.filter((item) => item !== need)
        : [...form.selectedNeeds, need],
    )

  const submit = () => {
    setResult({})
    startTransition(async () => {
      const response = await submitFinancingApplication(form)
      if (response.ok) {
        setResult({ id: response.applicationId })
        setStep(7)
      } else {
        setResult({ error: response.message })
      }
    })
  }

  return (
    <main className="app-canvas">
      <section className={`mobile-shell ${step === 1 ? 'choice-step' : ''}`}>
        <header className="wizard-header">
          <div>
            <h1>Vworks Student Venture</h1>
            <span className="brand-caption">by venturego.id</span>
          </div>
        </header>

        <div className="wizard-body">
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
                onClick={() => set('product', 'FULL_COVER')}
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
                onClick={() => set('product', 'DEPARTURE_BRIDGING')}
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
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => set('birthDate', e.target.value)}
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
                      onChange={(e) => set('idCardAddress', e.target.value)}
                      placeholder="Jl. / RT / RW / Kel. / Kec. / Kab. / Prov."
                      rows={4}
                    />
                  </label>
                  <label className="switch-row">
                    <span>
                      <strong>Alamat domisili sama dengan KTP</strong>
                      <small>Gunakan alamat KTP sebagai alamat surat-menyurat.</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={form.domicileSameAsIdCard}
                      onChange={(e) => set('domicileSameAsIdCard', e.target.checked)}
                    />
                  </label>
                  {!form.domicileSameAsIdCard && (
                    <label className="field">
                      <span>Alamat domisili saat ini</span>
                      <textarea
                        value={form.domicileAddress}
                        onChange={(e) => set('domicileAddress', e.target.value)}
                        placeholder="Jl. / RT / RW / Kel. / Kec. / Kab. / Prov."
                        rows={4}
                      />
                    </label>
                  )}
                  <label className="field">
                    <span>Kode pos domisili saat ini</span>
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
                      type="date"
                      value={form.estimatedDeparture}
                      onChange={(e) => set('estimatedDeparture', e.target.value)}
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
                {[...commonDocuments, ...productDocuments[form.product]].map((document) => (
                  <div key={document}>
                    <strong>{document}</strong>
                    <small>Belum diunggah</small>
                  </div>
                ))}
              </div>
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
                <div className="finance-grid">
                  <div>
                    <span>Nafaqah estimasi</span>
                    <strong>Rp31.350.000</strong>
                  </div>
                  <div>
                    <span>Ujrah VSV</span>
                    <strong>Rp10.770.000</strong>
                  </div>
                  <div className="wide">
                    <span>Total estimasi</span>
                    <strong>Rp42.120.000</strong>
                    <small>12 × Rp3.510.000</small>
                  </div>
                </div>
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
                  setStep(1)
                  setResult({})
                }}
              >
                Kembali ke awal
              </button>
            </div>
          )}
        </div>

        {step < 7 && (
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
              onClick={() => (step === 6 ? submit() : setStep(step + 1))}
            >
              {isPending ? 'Mengirim…' : step === 6 ? 'Kirim pengajuan' : 'Lanjut'}
            </button>
          </footer>
        )}
      </section>
    </main>
  )
}
