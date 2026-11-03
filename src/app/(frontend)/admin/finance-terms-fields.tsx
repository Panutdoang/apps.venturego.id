'use client'

import { useState } from 'react'
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

function CostLines({
  title,
  description,
  lines,
  update,
  add,
  remove,
}: {
  title: string
  description: string
  lines: FinancingCostLine[]
  update: (index: number, patch: Partial<FinancingCostLine>) => void
  add: () => void
  remove: (index: number) => void
}) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {lines.map((line, index) => (
        <fieldset className="grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2" key={index}>
          <legend className="sr-only">
            {title} item {index + 1}
          </legend>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Komponen
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              maxLength={120}
              onChange={(event) => update(index, { label: event.target.value })}
              value={line.label}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Penerima pembayaran
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              maxLength={120}
              onChange={(event) => update(index, { recipient: event.target.value })}
              value={line.recipient}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Nominal (Rp)
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              min={0}
              onChange={(event) => update(index, { amount: Number(event.target.value) || 0 })}
              step={1}
              type="number"
              value={line.amount}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Referensi bukti pembayaran
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              maxLength={300}
              onChange={(event) => update(index, { evidenceReference: event.target.value })}
              placeholder="Nomor berkas / tautan akses terbatas"
              value={line.evidenceReference}
            />
          </label>
          <button
            className="justify-self-start text-xs font-semibold text-red-700 underline sm:col-span-2"
            onClick={() => remove(index)}
            type="button"
          >
            Hapus komponen
          </button>
        </fieldset>
      ))}
      <button
        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
        disabled={lines.length >= 20}
        onClick={add}
        type="button"
      >
        Tambah komponen
      </button>
    </section>
  )
}

export function FinanceTermsFields({
  product,
  financialPlan,
}: {
  product: ApplicationProduct
  financialPlan: Record<string, unknown>
}) {
  const [nafaqahItems, setNafaqahItems] = useState(() => {
    const saved = readLines(financialPlan.nafaqahItems)
    return saved.length ? saved : [emptyLine()]
  })
  const [ujrahItems, setUjrahItems] = useState(() => {
    const saved = readLines(financialPlan.ujrahItems)
    return saved.length ? saved : [emptyLine()]
  })
  const [qardhDisbursed, setQardhDisbursed] = useState(financialPlan.qardhDisbursed === true)

  if (product === 'FULL_COVER') {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ['nafaqahTotal', 'Nafaqah'],
              ['ujrahTotal', 'Ujrah'],
              ['jualaTotal', 'Ju’alah (jika COE terbit)'],
              ['tenorMonths', 'Tenor setelah keberangkatan (bulan)'],
            ] as const
          ).map(([name, label]) => (
            <label className="space-y-1 text-xs font-semibold text-slate-600" key={name}>
              {label}
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                defaultValue={String(financialPlan[name] ?? '')}
                min={name === 'tenorMonths' ? 1 : 0}
                max={name === 'tenorMonths' ? 36 : undefined}
                name={name}
                step={1}
                type="number"
              />
            </label>
          ))}
        </div>
        {Number.isFinite(financialPlan.totalObligationIfCoe) && (
          <p className="text-xs leading-5 text-slate-600">
            Nafaqah + Ujrah (di luar Ju’alah): Rp
            {Number(financialPlan.totalObligation).toLocaleString('id-ID')}. Jika COE terbit: Rp
            {Number(financialPlan.totalObligationIfCoe).toLocaleString('id-ID')}, angsuran sekitar
            Rp{Number(financialPlan.monthlyInstallmentAfterCoe).toLocaleString('id-ID')}
            {financialPlan.finalInstallmentAfterCoe !== financialPlan.monthlyInstallmentAfterCoe &&
              ` (angsuran terakhir Rp${Number(
                financialPlan.finalInstallmentAfterCoe,
              ).toLocaleString('id-ID')})`}
            .
          </p>
        )}
      </>
    )
  }

  const nafaqahTotal = getFinancingLineTotal(nafaqahItems)
  const ujrahTotal = getFinancingLineTotal(ujrahItems)
  const qardhAmount = Number(financialPlan.qardhAmount) || 0
  const refundTotal = Number(financialPlan.refundTotal) || 0
  const total = nafaqahTotal + ujrahTotal + qardhAmount - refundTotal

  return (
    <div className="space-y-4">
      <input name="nafaqahItems" type="hidden" value={JSON.stringify(nafaqahItems)} />
      <input name="ujrahItems" type="hidden" value={JSON.stringify(ujrahItems)} />
      <input name="qardhDisbursed" type="hidden" value={String(qardhDisbursed)} />
      <CostLines
        add={() => setNafaqahItems((current) => [...current, emptyLine()])}
        description="Biaya pihak ketiga yang benar-benar dibayarkan. Sertakan penerima serta referensi bukti dan potongan/refund."
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
        description="Jasa yang benar-benar diberikan. Ujrah tetap, tidak dihitung dari dana talangan atau lamanya cicilan."
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
      <section className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Uang saku qardh (Rp)
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.qardhAmount ?? 0)}
            min={0}
            name="qardhAmount"
            step={1}
            type="number"
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-slate-700">
          <input
            checked={qardhDisbursed}
            onChange={(event) => setQardhDisbursed(event.target.checked)}
            type="checkbox"
          />
          Sudah diserahkan kepada pemohon
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Jumlah angsuran
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.installmentCount ?? '')}
            max={36}
            min={1}
            name="installmentCount"
            step={1}
            type="number"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Tanggal angsuran pertama (bulan setelah keberangkatan)
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.firstPaymentDate ?? '')}
            name="firstPaymentDate"
            type="date"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Refund/potongan yang disetujui (Rp)
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.refundTotal ?? 0)}
            min={0}
            name="refundTotal"
            step={1}
            type="number"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
          Referensi bukti refund/potongan
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.refundEvidenceReference ?? '')}
            maxLength={300}
            name="refundEvidenceReference"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
          Referensi akad final yang sudah ditandatangani
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.finalAgreementReference ?? '')}
            maxLength={300}
            name="finalAgreementReference"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">
          Catatan penyelesaian, refund, atau keringanan
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            defaultValue={String(financialPlan.settlementNotes ?? '')}
            maxLength={1000}
            name="settlementNotes"
          />
        </label>
      </section>
      <p className="rounded-lg bg-indigo-50 p-3 text-xs leading-5 text-indigo-900">
        Total saat ini: {amountLabel(total)} (Nafaqah {amountLabel(nafaqahTotal)} + Ujrah{' '}
        {amountLabel(ujrahTotal)} + qardh {amountLabel(qardhAmount)} − refund{' '}
        {amountLabel(refundTotal)}). Qardh hanya dihitung setelah benar-benar diserahkan.
      </p>
      <p className="text-xs leading-5 text-slate-500">
        Pengembalian dan biaya pembatalan perlu ditinjau manual berdasarkan bukti, jasa yang telah
        dilaksanakan, serta nilai yang masih dapat direfund. Pastikan tanggal angsuran pertama
        mengikuti akad dan dimulai pada bulan setelah keberangkatan. Aplikasi tidak menambahkan
        biaya keterlambatan otomatis.
      </p>
    </div>
  )
}
