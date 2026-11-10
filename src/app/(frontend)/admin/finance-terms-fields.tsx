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
  nikNumber,
}: {
  product: ApplicationProduct
  financialPlan: Record<string, unknown>
  nikNumber: string
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
  const [qardhAmount, setQardhAmount] = useState(Number(financialPlan.qardhAmount) || 0)
  const [refundTotal, setRefundTotal] = useState(Number(financialPlan.refundTotal) || 0)
  const [installmentCount, setInstallmentCount] = useState(
    String(financialPlan.installmentCount ?? ''),
  )

  const nikSection = (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900">Identitas untuk Dokumen Akad</h3>
      <p className="mt-1 text-xs text-slate-500">
        NIK diisi ke placeholder nomor KTP pada dokumen akad yang diterbitkan.
      </p>
      <label className="mt-3 block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>NIK (Nomor Induk Kependudukan)</span>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none sm:max-w-xs"
          defaultValue={nikNumber}
          inputMode="numeric"
          maxLength={20}
          name="nikNumber"
          placeholder="Digit NIK, maksimal 20 karakter"
          type="text"
        />
      </label>
    </section>
  )

  if (product === 'FULL_COVER') {
    return (
      <div className="space-y-4">
        {nikSection}
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

  return (
    <div className="space-y-5">
      {nikSection}
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
