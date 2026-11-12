'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  calculateInstallmentSchedule,
  getFinancingLineTotal,
  type FinancingCostLine,
} from '@/lib/departure-financing'
import { terbilang } from '@/lib/terbilang'
import type { ApplicationProduct } from '@/lib/firebase-data'

const emptyLine = (): FinancingCostLine => ({
  label: '',
  recipient: '',
  amount: 0,
  evidenceReference: '',
})

const readLines = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (line): line is FinancingCostLine =>
          Boolean(line) &&
          typeof line.label === 'string' &&
          typeof line.recipient === 'string' &&
          typeof line.amount === 'number' &&
          typeof line.evidenceReference === 'string',
      )
    : []

const amountLabel = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`
const formatThousandsInput = (value: string) =>
  value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const parseThousandsInput = (value: string) => Number(value.replace(/\D/g, '')) || 0
const getTodayJakartaIso = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

type AppendixDocument = {
  label: string
  date: string
  condition: 'ORIGINAL' | 'COPY' | ''
  count: number
}

const defaultAppendixDocuments: AppendixDocument[] = [
  { label: 'Akta Kelahiran', date: '', condition: '', count: 1 },
  { label: 'Kartu Keluarga', date: '', condition: '', count: 1 },
  { label: 'Ijazah SD/SMP/SMA', date: '', condition: '', count: 1 },
]

const readAppendixDocuments = (value: unknown): AppendixDocument[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is AppendixDocument =>
          Boolean(item) &&
          typeof item.label === 'string' &&
          typeof item.date === 'string' &&
          ['ORIGINAL', 'COPY', ''].includes(item.condition) &&
          typeof item.count === 'number',
      )
    : []

function AppendixDocumentsFields({
  documents,
  setDocuments,
}: {
  documents: AppendixDocument[]
  setDocuments: Dispatch<SetStateAction<AppendixDocument[]>>
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Daftar dokumen lampiran</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Isi tanggal, status asli/fotokopi, dan jumlah tiap jenis dokumen. Daftar ini akan
            dimasukkan ke lampiran akad.
          </p>
        </div>
        <button
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          disabled={documents.length >= 20}
          onClick={() =>
            setDocuments((current) => [
              ...current,
              { label: '', date: '', condition: '', count: 1 },
            ])
          }
          type="button"
        >
          + Tambah dokumen
        </button>
      </div>
      <input name="appendixDocuments" type="hidden" value={JSON.stringify(documents)} />
      <div className="mt-3 divide-y divide-slate-100">
        {documents.map((document, index) => (
          <div className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-12" key={index}>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-4">
              <span>Nama dokumen</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                maxLength={120}
                onChange={(event) =>
                  setDocuments((current) =>
                    current.map((item, row) =>
                      row === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
                value={document.label}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-3">
              <span>Tanggal</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                onChange={(event) =>
                  setDocuments((current) =>
                    current.map((item, row) =>
                      row === index ? { ...item, date: event.target.value } : item,
                    ),
                  )
                }
                type="date"
                value={document.date}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
              <span>Status</span>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                onChange={(event) =>
                  setDocuments((current) =>
                    current.map((item, row) =>
                      row === index
                        ? {
                            ...item,
                            condition: event.target.value as AppendixDocument['condition'],
                          }
                        : item,
                    ),
                  )
                }
                value={document.condition}
              >
                <option value="">Pilih</option>
                <option value="ORIGINAL">Asli</option>
                <option value="COPY">Fotokopi</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
              <span>Jumlah</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                min={1}
                onChange={(event) =>
                  setDocuments((current) =>
                    current.map((item, row) =>
                      row === index ? { ...item, count: Number(event.target.value) || 0 } : item,
                    ),
                  )
                }
                step={1}
                type="number"
                value={document.count}
              />
            </label>
            <div className="flex items-end justify-end sm:col-span-1">
              <button
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                onClick={() => setDocuments((current) => current.filter((_, row) => row !== index))}
                title="Hapus baris dokumen"
                type="button"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CostLines({
  title,
  badge,
  description,
  lines,
  update,
  add,
  remove,
}: {
  title: string
  badge: string
  description: string
  lines: FinancingCostLine[]
  update: (index: number, patch: Partial<FinancingCostLine>) => void
  add: () => void
  remove: (index: number) => void
}) {
  const subtotal = getFinancingLineTotal(lines)

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0b57d0]">
              {badge}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-medium text-slate-400">Subtotal komponen</span>
          <strong className="text-sm font-bold text-slate-900">{amountLabel(subtotal)}</strong>
        </div>
      </div>

      <div className="divide-y divide-slate-100 p-4">
        {lines.map((line, index) => (
          <fieldset className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-12" key={index}>
            <legend className="sr-only">
              {title} item {index + 1}
            </legend>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-3">
              <span>Komponen #{index + 1}</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                maxLength={120}
                onChange={(event) => update(index, { label: event.target.value })}
                placeholder="Nama komponen biaya"
                value={line.label}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-3">
              <span>Penerima pembayaran</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                maxLength={120}
                onChange={(event) => update(index, { recipient: event.target.value })}
                placeholder="LPK / Lembaga / Pihak ketiga"
                value={line.recipient}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
              <span>Nominal (Rp)</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                min={0}
                onChange={(event) => update(index, { amount: Number(event.target.value) || 0 })}
                step={1}
                type="number"
                value={line.amount}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-3">
              <span>Referensi bukti pembayaran</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                maxLength={300}
                onChange={(event) => update(index, { evidenceReference: event.target.value })}
                placeholder="Nomor kuitansi / berkas"
                value={line.evidenceReference}
              />
            </label>
            <div className="flex items-end justify-end sm:col-span-1">
              <button
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                onClick={() => remove(index)}
                title="Hapus baris komponen"
                type="button"
              >
                Hapus
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3">
        <span className="text-xs text-slate-500">
          {lines.length} dari maksimal 20 baris komponen
        </span>
        <button
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          disabled={lines.length >= 20}
          onClick={add}
          type="button"
        >
          + Tambah komponen
        </button>
      </div>
    </section>
  )
}

export function FinanceTermsFields({
  product,
  financialPlan,
  departureDetails,
  fullCoverDetails,
  applicantName,
  phone,
  personalDetails,
  issuedAkad,
}: {
  product: ApplicationProduct
  financialPlan: Record<string, unknown>
  departureDetails?: Record<string, unknown> | null
  fullCoverDetails?: Record<string, unknown> | null
  applicantName: string
  phone: string
  personalDetails: Record<string, unknown>
  issuedAkad?: { documentNumber?: string; issuedAt?: string } | null
}) {
  const requestedAmount = Number(departureDetails?.requestedFinancingAmount) || 0
  const savedInvoice = Number(financialPlan.hppLpkInvoiceAmount) || 0
  const defaultInvoice =
    savedInvoice ||
    Number(departureDetails?.outstandingLPKAmount ?? fullCoverDetails?.lpkInvoiceAmount) ||
    0
  const departureAdminFee = Math.round(requestedAmount * 0.05)
  const departureNetAmount = Math.max(0, requestedAmount - departureAdminFee)
  const [hppInvoiceInput, setHppInvoiceInput] = useState(
    defaultInvoice ? defaultInvoice.toLocaleString('id-ID') : '',
  )
  const [hppPocketMoneyInput, setHppPocketMoneyInput] = useState(() => {
    if (product === 'DEPARTURE_BRIDGING') {
      const calculated = Math.max(0, departureNetAmount - defaultInvoice)
      return calculated ? calculated.toLocaleString('id-ID') : ''
    }
    if (financialPlan.hppPocketMoneyAmount !== undefined) {
      const saved = Number(financialPlan.hppPocketMoneyAmount) || 0
      return saved ? saved.toLocaleString('id-ID') : ''
    }
    return ''
  })
  const hppInvoice = parseThousandsInput(hppInvoiceInput)
  const hppPocketMoney = parseThousandsInput(hppPocketMoneyInput)
  const [fullCoverNafaqah, setFullCoverNafaqah] = useState(Number(financialPlan.nafaqahTotal) || 0)
  const [nafaqahItems, setNafaqahItems] = useState(() => {
    const saved = readLines(financialPlan.nafaqahItems)
    return saved.length ? saved : [emptyLine()]
  })
  const [ujrahItems, setUjrahItems] = useState(() => {
    const saved = readLines(financialPlan.ujrahItems)
    return saved.length ? saved : [emptyLine()]
  })
  const [qardhDisbursed, setQardhDisbursed] = useState(financialPlan.qardhDisbursed === true)
  const [qardhAmount, setQardhAmount] = useState(() => {
    if (product === 'DEPARTURE_BRIDGING') {
      return Math.max(0, departureNetAmount - defaultInvoice)
    }
    if (financialPlan.qardhAmount !== undefined) return Number(financialPlan.qardhAmount) || 0
    return 0
  })
  const [refundTotal, setRefundTotal] = useState(Number(financialPlan.refundTotal) || 0)
  const [installmentCount, setInstallmentCount] = useState(
    String(financialPlan.installmentCount ?? ''),
  )
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    String(financialPlan.firstPaymentDate ?? ''),
  )
  const [akadDate, setAkadDate] = useState(() => {
    const saved = String(financialPlan.akadDate ?? '')
    if (saved) return saved
    if (issuedAkad?.issuedAt) {
      const issuedDate = new Date(issuedAkad.issuedAt)
      if (!Number.isNaN(issuedDate.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(issuedDate)
      }
    }
    return getTodayJakartaIso()
  })
  const [appendixDocuments, setAppendixDocuments] = useState(() => {
    const saved = readAppendixDocuments(financialPlan.appendixDocuments)
    return saved.length ? saved : defaultAppendixDocuments
  })
  const hppTotal = hppInvoice + hppPocketMoney
  const updateHppInvoice = (value: string) => {
    const formatted = formatThousandsInput(value)
    setHppInvoiceInput(formatted)
    if (product === 'DEPARTURE_BRIDGING') {
      const nextPocketMoney = Math.max(0, departureNetAmount - parseThousandsInput(formatted))
      setHppPocketMoneyInput(nextPocketMoney ? nextPocketMoney.toLocaleString('id-ID') : '')
      setQardhAmount(nextPocketMoney)
    }
  }
  const hppAligned =
    product === 'DEPARTURE_BRIDGING'
      ? requestedAmount > 0 && hppTotal === departureNetAmount
      : fullCoverNafaqah > 0 && hppTotal === fullCoverNafaqah

  const hppEditor = (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0b57d0]">
            Alokasi pembiayaan
          </span>
          <h3 className="mt-1 text-base font-bold text-slate-900">Rincian penggunaan dana</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
            {product === 'DEPARTURE_BRIDGING'
              ? 'Dari total pengajuan dikurangi biaya admin 5%, tanggungan invoice LPK dibayarkan terlebih dahulu dan sisanya menjadi uang saku siswa.'
              : 'Penggunaan dana Full Cover terdiri dari invoice/tagihan LPK dan uang saku siswa. Nilai awal invoice diambil dari estimasi siswa dan perlu diverifikasi admin.'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hppAligned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
        >
          {hppAligned ? 'Sesuai perhitungan' : 'Perlu dicocokkan'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Invoice LPK terverifikasi</span>
          <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-[#0b57d0] focus-within:ring-2 focus-within:ring-[#0b57d0]/15">
            <span className="pl-3 text-sm font-medium text-slate-500">Rp</span>
            <input
              className="w-full min-w-0 rounded-r-lg border-0 bg-transparent px-2 py-2 text-sm font-normal text-slate-900 shadow-none outline-none focus:border-0 focus:shadow-none focus:outline-none focus-visible:!outline-none focus-visible:!outline-offset-0 focus-visible:!ring-0"
              inputMode="numeric"
              onChange={(event) => updateHppInvoice(event.target.value)}
              placeholder="0"
              type="text"
              value={hppInvoiceInput}
            />
          </span>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Uang saku siswa</span>
          <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-[#0b57d0] focus-within:ring-2 focus-within:ring-[#0b57d0]/15">
            <span className="pl-3 text-sm font-medium text-slate-500">Rp</span>
            <input
              className={`w-full min-w-0 rounded-r-lg border-0 bg-transparent px-2 py-2 text-sm font-normal text-slate-900 shadow-none outline-none focus:border-0 focus:shadow-none focus:outline-none focus-visible:!outline-none focus-visible:!outline-offset-0 focus-visible:!ring-0 ${product === 'DEPARTURE_BRIDGING' ? 'bg-slate-50' : ''}`}
              inputMode="numeric"
              onChange={(event) => setHppPocketMoneyInput(formatThousandsInput(event.target.value))}
              placeholder="0"
              readOnly={product === 'DEPARTURE_BRIDGING'}
              type="text"
              value={hppPocketMoneyInput}
            />
          </span>
        </label>
      </div>
      {product === 'DEPARTURE_BRIDGING' && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-white/90 p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-[110px]">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Total pengajuan
              </span>
              <strong className="mt-0.5 block text-sm text-slate-800">
                {amountLabel(requestedAmount)}
              </strong>
            </div>
            <span className="text-sm font-medium text-slate-400">−</span>
            <div className="min-w-[110px]">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Admin 5%
              </span>
              <strong className="mt-0.5 block text-sm text-slate-700">
                {amountLabel(departureAdminFee)}
              </strong>
            </div>
            <span className="text-sm font-medium text-slate-400">=</span>
            <div className="min-w-[130px] rounded-lg bg-blue-50 px-3 py-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#0b57d0]">
                Dana setelah admin
              </span>
              <strong className="mt-0.5 block text-sm font-bold text-[#0b57d0]">
                {amountLabel(departureNetAmount)}
              </strong>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>Dialokasikan untuk invoice LPK sebesar</span>
            <strong className="text-slate-800">{amountLabel(hppInvoice)}</strong>
            <span>dan sisa</span>
            <strong className="text-emerald-700">{amountLabel(hppPocketMoney)}</strong>
            <span>menjadi uang saku siswa.</span>
          </div>
        </div>
      )}
      {product === 'FULL_COVER' && (
        <p className="mt-4 rounded-xl border border-blue-100 bg-white/90 px-4 py-3 text-xs leading-5 text-slate-600">
          Invoice LPK dan uang saku siswa menjadi komponen Nafaqah dalam Draft 2.
        </p>
      )}
      <input name="hppLpkInvoiceAmount" type="hidden" value={hppInvoice} />
      <input name="hppPocketMoneyAmount" type="hidden" value={hppPocketMoney} />
      {product === 'DEPARTURE_BRIDGING' && requestedAmount > 0 && !hppAligned && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Invoice LPK + uang saku harus sama dengan dana setelah biaya admin 5% (
          {amountLabel(departureNetAmount)}).
        </p>
      )}
      {product === 'FULL_COVER' && fullCoverNafaqah > 0 && !hppAligned && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Total HPP harus sama dengan Nafaqah dalam akad ({amountLabel(fullCoverNafaqah)}).
        </p>
      )}
    </section>
  )

  const birthDate = String(personalDetails.birthDate ?? '')
  const birthDateLabel = birthDate
    ? new Date(`${birthDate}T00:00:00Z`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''
  const birthPlaceAndDate = [personalDetails.birthPlace, birthDateLabel]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(', ')
  const religionLabels: Record<string, string> = {
    ISLAM: 'Islam',
    PROTESTANT: 'Kristen Protestan',
    CATHOLIC: 'Katolik',
    HINDU: 'Hindu',
    BUDDHIST: 'Buddha',
    CONFUCIAN: 'Konghucu',
  }
  const selectedAkadDate = akadDate ? new Date(`${akadDate}T05:00:00Z`) : null
  const akadDateLabel =
    selectedAkadDate && !Number.isNaN(selectedAkadDate.getTime())
      ? selectedAkadDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Jakarta',
        })
      : ''
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const romanMonth = selectedAkadDate ? romanMonths[selectedAkadDate.getUTCMonth()] : ''
  const contractScheme = product === 'FULL_COVER' ? 'WKL-JAL-JPN' : 'WKL-JPN'
  const contractNumberPreview =
    issuedAkad?.documentNumber ||
    `Urutan NIS/${contractScheme}/VSV-WSB/${romanMonth}/${selectedAkadDate?.getUTCFullYear() ?? ''}`
  const identityFields = [
    ['Nama PIHAK KEDUA', applicantName],
    ['Tempat, tanggal lahir', birthPlaceAndDate],
    ['Alamat sesuai KTP', personalDetails.idCardAddress],
    ['Agama', religionLabels[String(personalDetails.religion ?? '')] ?? personalDetails.religion],
    ['Nomor KTP', personalDetails.idCardNumber],
    ['Nomor HP', phone],
    ['Nama PIHAK KEDUA di tanda tangan', applicantName],
  ] as const
  const identityEditor = (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 shadow-sm">
      <div className="border-b border-blue-100 bg-white/70 px-5 py-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0b57d0]">
          Data dokumen
        </span>
        <h3 className="mt-1 text-base font-bold text-slate-900">Identitas dan tanggal akad</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Identitas mengikuti data pengajuan. Pilih tanggal akad; tanggal tanda tangan akan sama.
        </p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Nomor kontrak</span>
          <input
            className="w-full rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-[#0b57d0]"
            readOnly
            value={contractNumberPreview}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Hari dan tanggal akad</span>
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
            name="akadDate"
            onChange={(event) => setAkadDate(event.target.value)}
            required
            type="date"
            value={akadDate}
          />
          <span className="block text-[11px] font-normal text-slate-500">
            {akadDateLabel || 'Pilih tanggal akad'}
          </span>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Tanggal tanda tangan</span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-700"
            readOnly
            value={akadDateLabel || 'Pilih tanggal akad'}
          />
        </label>
        {identityFields.map(([label, value]) => (
          <label className="space-y-1 text-xs font-semibold text-slate-600" key={label}>
            <span>{label}</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-700"
              readOnly
              value={
                typeof value === 'string' && value.trim() ? value : 'Belum diisi pada pengajuan'
              }
            />
          </label>
        ))}
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Nama wali/orang tua</span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-700"
            readOnly
            value={
              typeof personalDetails.guardianName === 'string' &&
              personalDetails.guardianName.trim()
                ? personalDetails.guardianName
                : 'Belum diisi pada pengajuan'
            }
          />
        </label>
        {product === 'DEPARTURE_BRIDGING' && (
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Nama perwakilan LPK sebagai saksi</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              maxLength={120}
              name="lpkWitnessName"
              defaultValue={String(financialPlan.lpkWitnessName ?? '')}
              placeholder="Nama saksi dari LPK"
            />
          </label>
        )}
      </div>
    </section>
  )

  if (product === 'FULL_COVER') {
    return (
      <div className="space-y-4">
        {identityEditor}
        {hppEditor}
        <AppendixDocumentsFields
          documents={appendixDocuments}
          setDocuments={setAppendixDocuments}
        />
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Nominal dan jangka waktu Draft 2</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Masa pelatihan diambil dari isian siswa. Lengkapi nominal uang saku dan biaya komitmen
            yang akan dicantumkan dalam akad.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['languageAllowanceMonthly', 'Uang saku bahasa per bulan (Rp)'],
                ['skillAllowanceMonthly', 'Uang saku skill per bulan (Rp)'],
                ['departureAllowanceAmount', 'Uang saku keberangkatan (Rp)'],
                ['commitmentCompensationAmount', 'Biaya komitmen / ta’widh (Rp)'],
                ['commitmentSettlementDays', 'Hari pelunasan biaya komitmen'],
              ] as const
            ).map(([name, label]) => (
              <label className="space-y-1 text-xs font-semibold text-slate-600" key={name}>
                <span>{label}</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                  min={0}
                  name={name}
                  defaultValue={String(
                    financialPlan[name] ??
                      (name === 'languageAllowanceMonthly' ||
                      name === 'skillAllowanceMonthly' ||
                      name === 'departureAllowanceAmount'
                        ? 0
                        : ''),
                  )}
                  step={1}
                  type="number"
                />
              </label>
            ))}
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              <span>Tanggal mulai angsuran</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                defaultValue={String(financialPlan.firstPaymentDate ?? '')}
                name="firstPaymentDate"
                required
                type="date"
              />
            </label>
          </div>
        </section>
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['nafaqahTotal', 'Nafaqah (Rp)'],
              ['ujrahTotal', 'Ujrah (Rp)'],
              ['jualaTotal', 'Ju’alah jika COE terbit (Rp)'],
              ['tenorMonths', 'Tenor setelah keberangkatan (1–36 bulan)'],
            ] as const
          ).map(([name, label]) => (
            <label className="space-y-1.5 text-xs font-semibold text-slate-700" key={name}>
              <span>{label}</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                defaultValue={String(financialPlan[name] ?? '')}
                min={name === 'tenorMonths' ? 1 : 0}
                max={name === 'tenorMonths' ? 36 : undefined}
                name={name}
                onChange={
                  name === 'nafaqahTotal'
                    ? (event) => setFullCoverNafaqah(Number(event.target.value) || 0)
                    : undefined
                }
                step={1}
                type="number"
              />
            </label>
          ))}
        </div>
        {Number.isFinite(financialPlan.totalObligationIfCoe) && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-[#0b57d0]">
            <strong>Ringkasan Full Cover tersimpan:</strong> Nafaqah + Ujrah (di luar Ju’alah):{' '}
            <strong>Rp{Number(financialPlan.totalObligation).toLocaleString('id-ID')}</strong>. Jika
            COE terbit:{' '}
            <strong>Rp{Number(financialPlan.totalObligationIfCoe).toLocaleString('id-ID')}</strong>,
            angsuran sekitar{' '}
            <strong>
              Rp{Number(financialPlan.monthlyInstallmentAfterCoe).toLocaleString('id-ID')}
            </strong>
            {financialPlan.finalInstallmentAfterCoe !== financialPlan.monthlyInstallmentAfterCoe &&
              ` (angsuran terakhir Rp${Number(
                financialPlan.finalInstallmentAfterCoe,
              ).toLocaleString('id-ID')})`}
            .
          </div>
        )}
      </div>
    )
  }

  const nafaqahTotal = getFinancingLineTotal(nafaqahItems)
  const ujrahTotal = getFinancingLineTotal(ujrahItems)
  const effectiveQardh = qardhDisbursed ? qardhAmount : 0
  const total = Math.max(0, nafaqahTotal + ujrahTotal + effectiveQardh - refundTotal)
  const parsedCount = Number(installmentCount)
  const monthlyEstimate =
    Number.isInteger(parsedCount) && parsedCount > 0 ? Math.floor(total / parsedCount) : null
  const schedule =
    Number.isInteger(parsedCount) && parsedCount > 0
      ? calculateInstallmentSchedule(total, parsedCount, firstPaymentDate)
      : null
  const hppComponentsMatch =
    nafaqahTotal === hppInvoice &&
    qardhAmount === hppPocketMoney &&
    (hppPocketMoney === 0 || qardhDisbursed)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Total Nafaqah (Riil)</span>
          <strong className="mt-1 block text-sm font-bold text-slate-900">
            {amountLabel(nafaqahTotal)}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Total Ujrah (Jasa)</span>
          <strong className="mt-1 block text-sm font-bold text-slate-900">
            {amountLabel(ujrahTotal)}
          </strong>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5">
          <span className="text-[11px] font-semibold text-[#0b57d0]">Total Kewajiban Akad</span>
          <strong className="mt-1 block text-base font-extrabold text-[#0b57d0]">
            {amountLabel(total)}
          </strong>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
          <span className="text-[11px] font-semibold text-emerald-700">
            Estimasi Angsuran / Bulan
          </span>
          <strong className="mt-1 block text-base font-extrabold text-emerald-900">
            {monthlyEstimate !== null ? `${amountLabel(monthlyEstimate)} × ${parsedCount}` : '—'}
          </strong>
        </div>
      </div>
      {hppEditor}
      {identityEditor}
      <AppendixDocumentsFields documents={appendixDocuments} setDocuments={setAppendixDocuments} />
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Ketentuan pelengkap Draft 1</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Isian ini melengkapi jangka waktu program, pengembalian dokumen, dan prosedur peringatan
          pada template Wakalah bil Ujrah.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['wakalahLanguageMonths', 'Pendidikan bahasa (bulan)'],
              ['wakalahSkillMonths', 'Pelatihan skill (bulan)'],
              ['wakalahDocumentReturnBusinessDays', 'Pengembalian dokumen (hari kerja)'],
              ['wakalahWrittenWarningCount', 'Jumlah peringatan tertulis'],
              ['wakalahGraceDays', 'Tenggang waktu (hari)'],
            ] as const
          ).map(([name, label]) => (
            <label className="space-y-1 text-xs font-semibold text-slate-600" key={name}>
              <span>{label}</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                min={0}
                name={name}
                defaultValue={String(financialPlan[name] ?? '')}
                step={1}
                type="number"
              />
            </label>
          ))}
          {(
            [
              ['wakalahOtherUjrahService', 'Jasa lain PIHAK PERTAMA'],
              ['wakalahMediator', 'Pihak mediator (opsional)'],
              ['wakalahDisputeInstitution', 'Lembaga penyelesaian lain (opsional)'],
            ] as const
          ).map(([name, label]) => (
            <label className="space-y-1 text-xs font-semibold text-slate-600" key={name}>
              <span>{label}</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                maxLength={200}
                name={name}
                defaultValue={String(financialPlan[name] ?? '')}
              />
            </label>
          ))}
        </div>
      </section>
      {!hppComponentsMatch && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Rekonsiliasi komponen belum cocok: total Nafaqah harus sama dengan invoice LPK, sedangkan
          uang saku harus sama dengan qardh yang sudah diserahkan.
        </p>
      )}
      <input name="nafaqahItems" type="hidden" value={JSON.stringify(nafaqahItems)} />
      <input name="ujrahItems" type="hidden" value={JSON.stringify(ujrahItems)} />
      <input name="qardhDisbursed" type="hidden" value={String(qardhDisbursed)} />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Terbilang dan Lampiran B</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Nilai berikut mengikuti rincian biaya dan jumlah angsuran yang diisi di bawah.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="block text-[11px] font-semibold text-slate-500">Ujrah terbilang</span>
            <strong className="mt-1 block text-xs font-medium capitalize leading-5 text-slate-800">
              {ujrahTotal > 0 ? `${terbilang(ujrahTotal)} rupiah` : 'Isi rincian Ujrah'}
            </strong>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="block text-[11px] font-semibold text-slate-500">
              Nominal per bulan
            </span>
            <strong className="mt-1 block text-sm text-slate-900">
              {monthlyEstimate !== null ? amountLabel(monthlyEstimate) : 'Isi jumlah angsuran'}
            </strong>
          </div>
        </div>
        {schedule ? (
          <div className="max-h-72 overflow-auto border-t border-slate-100">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">Angsuran</th>
                  <th className="px-4 py-2">Tanggal jatuh tempo</th>
                  <th className="px-4 py-2">Jumlah</th>
                  <th className="px-4 py-2">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((entry) => (
                  <tr key={entry.installment}>
                    <td className="px-4 py-2">{entry.installment}</td>
                    <td className="px-4 py-2">
                      {new Date(`${entry.dueDate}T00:00:00Z`).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td className="px-4 py-2">{amountLabel(entry.amount)}</td>
                    <td className="px-4 py-2">{amountLabel(entry.remainingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-amber-800">
            Lampiran B akan terbentuk setelah jumlah angsuran dan tanggal angsuran pertama terisi.
          </p>
        )}
      </section>

      <CostLines
        add={() => setNafaqahItems((current) => [...current, emptyLine()])}
        badge="Biaya Riil Pihak Ketiga"
        description="Biaya pihak ketiga yang benar-benar dibayarkan. Sertakan penerima serta referensi bukti pembayaran."
        lines={nafaqahItems}
        remove={(index) =>
          setNafaqahItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
        }
        title="Rincian Nafaqah"
        update={(index, patch) =>
          setNafaqahItems((current) =>
            current.map((line, itemIndex) => (itemIndex === index ? { ...line, ...patch } : line)),
          )
        }
      />

      <CostLines
        add={() => setUjrahItems((current) => [...current, emptyLine()])}
        badge="Imbalan Jasa Tetap"
        description="Jasa pengurusan yang benar-benar diberikan. Ujrah bersifat tetap, tidak dihitung dari persentase dana talangan atau durasi cicilan."
        lines={ujrahItems}
        remove={(index) =>
          setUjrahItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
        }
        title="Rincian Ujrah"
        update={(index, patch) =>
          setUjrahItems((current) =>
            current.map((line, itemIndex) => (itemIndex === index ? { ...line, ...patch } : line)),
          )
        }
      />

      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Jadwal angsuran dimulai pada bulan setelah perkiraan keberangkatan.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Uang saku qardh (Rp)</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              min={0}
              name="qardhAmount"
              onChange={(event) => setQardhAmount(Number(event.target.value) || 0)}
              step={1}
              type="number"
              value={qardhAmount}
            />
          </label>
          <label className="flex items-center gap-2.5 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700">
            <input
              checked={qardhDisbursed}
              onChange={(event) => setQardhDisbursed(event.target.checked)}
              type="checkbox"
            />
            <span>Qardh sudah diserahkan ke pemohon</span>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Jumlah angsuran (1–36 bulan)</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              max={36}
              min={1}
              name="installmentCount"
              onChange={(event) => setInstallmentCount(event.target.value)}
              placeholder="Contoh: 12"
              step={1}
              type="number"
              value={installmentCount}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Tanggal angsuran pertama</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              onChange={(event) => setFirstPaymentDate(event.target.value)}
              name="firstPaymentDate"
              type="date"
              value={firstPaymentDate}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Refund / potongan disetujui (Rp)</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              min={0}
              name="refundTotal"
              onChange={(event) => setRefundTotal(Number(event.target.value) || 0)}
              step={1}
              type="number"
              value={refundTotal}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-3">
            <span>Referensi bukti refund / potongan</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              defaultValue={String(financialPlan.refundEvidenceReference ?? '')}
              maxLength={300}
              name="refundEvidenceReference"
              placeholder="Wajib diisi bila terdapat nominal refund/potongan"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">
            <span>Referensi akad final yang sudah ditandatangani</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              defaultValue={String(financialPlan.finalAgreementReference ?? '')}
              maxLength={300}
              name="finalAgreementReference"
              placeholder="Nomor dokumen akad final / tautan arsip (wajib untuk mengunci status biaya Disepakati)"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">
            <span>Catatan penyelesaian, refund, atau keringanan</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
              defaultValue={String(financialPlan.settlementNotes ?? '')}
              maxLength={1000}
              name="settlementNotes"
              placeholder="Catatan tambahan terkait penyelesaian, perhitungan pembatalan, atau penyesuaian"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
