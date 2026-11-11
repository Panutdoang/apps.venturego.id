'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { getFinancingLineTotal, type FinancingCostLine } from '@/lib/departure-financing'
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
}: {
  product: ApplicationProduct
  financialPlan: Record<string, unknown>
  departureDetails?: Record<string, unknown> | null
  fullCoverDetails?: Record<string, unknown> | null
}) {
  const requestedAmount = Number(departureDetails?.requestedFinancingAmount) || 0
  const savedInvoice = Number(financialPlan.hppLpkInvoiceAmount) || 0
  const defaultInvoice =
    savedInvoice ||
    Number(departureDetails?.outstandingLPKAmount ?? fullCoverDetails?.lpkInvoiceAmount) ||
    0
  const [hppInvoice, setHppInvoice] = useState(defaultInvoice)
  const [hppPocketMoney, setHppPocketMoney] = useState(() => {
    if (financialPlan.hppPocketMoneyAmount !== undefined) {
      return Number(financialPlan.hppPocketMoneyAmount) || 0
    }
    return product === 'DEPARTURE_BRIDGING' ? Math.max(0, requestedAmount - defaultInvoice) : 0
  })
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
  const [qardhAmount, setQardhAmount] = useState(Number(financialPlan.qardhAmount) || 0)
  const [refundTotal, setRefundTotal] = useState(Number(financialPlan.refundTotal) || 0)
  const [installmentCount, setInstallmentCount] = useState(
    String(financialPlan.installmentCount ?? ''),
  )
  const [appendixDocuments, setAppendixDocuments] = useState(() => {
    const saved = readAppendixDocuments(financialPlan.appendixDocuments)
    return saved.length ? saved : defaultAppendixDocuments
  })
  const hppTotal = hppInvoice + hppPocketMoney
  const hppAligned =
    product === 'DEPARTURE_BRIDGING'
      ? requestedAmount > 0 && hppTotal === requestedAmount
      : fullCoverNafaqah > 0 && hppTotal === fullCoverNafaqah

  const hppEditor = (
    <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Rincian HPP VSV</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
            HPP terdiri dari invoice/tagihan LPK dan uang saku siswa. Nilai awal invoice Full Cover
            diambil dari estimasi yang diisi siswa dan perlu diverifikasi admin.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hppAligned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
        >
          {hppAligned ? 'Nominal sesuai' : 'Perlu dicocokkan'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Invoice LPK terverifikasi (Rp)</span>
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
            min={0}
            onChange={(event) => setHppInvoice(Number(event.target.value) || 0)}
            step={1}
            type="number"
            value={hppInvoice}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Uang saku siswa (Rp)</span>
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
            min={0}
            onChange={(event) => setHppPocketMoney(Number(event.target.value) || 0)}
            step={1}
            type="number"
            value={hppPocketMoney}
          />
        </label>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="block text-[11px] font-medium text-slate-500">Total HPP</span>
          <strong className="mt-0.5 block text-sm text-slate-900">{amountLabel(hppTotal)}</strong>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="block text-[11px] font-medium text-slate-500">
            {product === 'DEPARTURE_BRIDGING' ? 'Nominal pengajuan siswa' : 'Nafaqah dalam Draft 2'}
          </span>
          <strong className="mt-0.5 block text-sm text-slate-900">
            {amountLabel(product === 'DEPARTURE_BRIDGING' ? requestedAmount : fullCoverNafaqah)}
          </strong>
        </div>
      </div>
      <input name="hppLpkInvoiceAmount" type="hidden" value={hppInvoice} />
      <input name="hppPocketMoneyAmount" type="hidden" value={hppPocketMoney} />
      {product === 'DEPARTURE_BRIDGING' && requestedAmount > 0 && !hppAligned && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Total invoice LPK + uang saku harus sama dengan nominal pengajuan (
          {amountLabel(requestedAmount)}).
        </p>
      )}
      {product === 'FULL_COVER' && fullCoverNafaqah > 0 && !hppAligned && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Total HPP harus sama dengan Nafaqah dalam akad ({amountLabel(fullCoverNafaqah)}).
        </p>
      )}
    </section>
  )

  if (product === 'FULL_COVER') {
    return (
      <div className="space-y-4">
        {hppEditor}
        <AppendixDocumentsFields
          documents={appendixDocuments}
          setDocuments={setAppendixDocuments}
        />
        <label className="block space-y-1 text-xs font-semibold text-slate-600">
          <span>Nama perwakilan LPK sebagai saksi</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
            maxLength={120}
            name="lpkWitnessName"
            defaultValue={String(financialPlan.lpkWitnessName ?? '')}
          />
        </label>
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
  const hppComponentsMatch =
    nafaqahTotal === hppInvoice &&
    qardhAmount === hppPocketMoney &&
    (hppPocketMoney === 0 || qardhDisbursed)

  return (
    <div className="space-y-5">
      {hppEditor}
      <AppendixDocumentsFields documents={appendixDocuments} setDocuments={setAppendixDocuments} />
      <label className="block space-y-1 text-xs font-semibold text-slate-600">
        <span>Nama perwakilan LPK sebagai saksi</span>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
          maxLength={120}
          name="lpkWitnessName"
          defaultValue={String(financialPlan.lpkWitnessName ?? '')}
        />
      </label>
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

      {/* Live Calculation Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Qardh − Refund</span>
          <strong className="mt-1 block text-sm font-bold text-slate-900">
            {amountLabel(effectiveQardh)} − {amountLabel(refundTotal)}
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          Parameter Jadwal Angsuran, Qardh, & Referensi Akad Final
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Pastikan tanggal angsuran pertama berada pada bulan setelah perkiraan keberangkatan.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              defaultValue={String(financialPlan.firstPaymentDate ?? '')}
              name="firstPaymentDate"
              type="date"
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
      </section>
    </div>
  )
}
