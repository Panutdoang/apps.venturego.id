'use client'

import { useState } from 'react'
import { deriveDepartureFinancials, QARDH_LABEL } from '@/lib/departure-financing'
import type { ApplicationProduct } from '@/lib/firebase-data'

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

export function FinanceTermsFields({
  product,
  financialPlan,
  departureDetails,
  fullCoverDetails,
  applicantName,
  phone,
  personalDetails,
  issuedAkad,
  lpkName,
}: {
  product: ApplicationProduct
  financialPlan: Record<string, unknown>
  departureDetails?: Record<string, unknown> | null
  fullCoverDetails?: Record<string, unknown> | null
  applicantName: string
  phone: string
  personalDetails: Record<string, unknown>
  issuedAkad?: { documentNumber?: string; issuedAt?: string } | null
  lpkName: string
}) {
  const requestedAmount = Number(departureDetails?.requestedFinancingAmount) || 0
  const savedInvoice = Number(financialPlan.hppLpkInvoiceAmount) || 0
  const defaultInvoice =
    savedInvoice ||
    Number(departureDetails?.outstandingLPKAmount ?? fullCoverDetails?.lpkInvoiceAmount) ||
    0
  const savedPrincipal = Number(financialPlan.principal)
  const departurePrincipal =
    Number.isSafeInteger(savedPrincipal) && savedPrincipal > 0 ? savedPrincipal : requestedAmount
  const [hppInvoiceInput, setHppInvoiceInput] = useState(
    defaultInvoice ? defaultInvoice.toLocaleString('id-ID') : '',
  )
  const [hppPocketMoneyInput, setHppPocketMoneyInput] = useState(() => {
    if (financialPlan.hppPocketMoneyAmount !== undefined) {
      const saved = Number(financialPlan.hppPocketMoneyAmount) || 0
      return saved ? saved.toLocaleString('id-ID') : ''
    }
    return ''
  })
  const hppInvoice = parseThousandsInput(hppInvoiceInput)
  const derivedDeparture = deriveDepartureFinancials({
    principal: departurePrincipal,
    invoice: hppInvoice,
    lpkName,
  })
  const hppPocketMoney =
    product === 'DEPARTURE_BRIDGING'
      ? derivedDeparture.pocketMoney
      : parseThousandsInput(hppPocketMoneyInput)
  const [fullCoverNafaqah, setFullCoverNafaqah] = useState(Number(financialPlan.nafaqahTotal) || 0)
  const [qardhDisbursed, setQardhDisbursed] = useState(financialPlan.qardhDisbursed === true)
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
  const hppTotal = hppInvoice + hppPocketMoney
  const updateHppInvoice = (value: string) => {
    setHppInvoiceInput(formatThousandsInput(value))
  }
  const hppAligned =
    product === 'DEPARTURE_BRIDGING'
      ? derivedDeparture.valid
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
              value={
                product === 'DEPARTURE_BRIDGING'
                  ? derivedDeparture.pocketMoney
                    ? derivedDeparture.pocketMoney.toLocaleString('id-ID')
                    : ''
                  : hppPocketMoneyInput
              }
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
                {amountLabel(derivedDeparture.principal)}
              </strong>
            </div>
            <span className="text-sm font-medium text-slate-400">−</span>
            <div className="min-w-[110px]">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Admin 5%
              </span>
              <strong className="mt-0.5 block text-sm text-slate-700">
                {amountLabel(derivedDeparture.adminFee)}
              </strong>
            </div>
            <span className="text-sm font-medium text-slate-400">=</span>
            <div className="min-w-[130px] rounded-lg bg-blue-50 px-3 py-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#0b57d0]">
                Dana setelah admin
              </span>
              <strong className="mt-0.5 block text-sm font-bold text-[#0b57d0]">
                {amountLabel(derivedDeparture.netAmount)}
              </strong>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>Dialokasikan untuk invoice LPK sebesar</span>
            <strong className="text-slate-800">{amountLabel(derivedDeparture.invoice)}</strong>
            <span>dan sisa</span>
            <strong className="text-emerald-700">
              {amountLabel(derivedDeparture.pocketMoney)}
            </strong>
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
      {product === 'DEPARTURE_BRIDGING' && departurePrincipal > 0 && !hppAligned && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Invoice LPK harus berupa angka dan tidak melebihi dana setelah biaya admin 5% (
          {amountLabel(derivedDeparture.netAmount)}).
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

  const nafaqahTotal = derivedDeparture.nafaqahTotal
  const ujrahTotal = derivedDeparture.ujrahTotal
  const qardhAmount = derivedDeparture.qardhAmount
  const effectiveQardh = qardhDisbursed ? qardhAmount : 0
  const total = Math.max(0, nafaqahTotal + ujrahTotal + effectiveQardh - refundTotal)
  const parsedCount = Number(installmentCount)
  const monthlyEstimate =
    Number.isInteger(parsedCount) && parsedCount > 0 ? Math.floor(total / parsedCount) : null
  const lampiranSectionNo = {
    ujrahStart: derivedDeparture.nafaqahItems.length + 1,
    qardh: derivedDeparture.nafaqahItems.length + derivedDeparture.ujrahItems.length + 1,
  }

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
      {derivedDeparture.pocketMoney > 0 && !qardhDisbursed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Uang saku qardh sebesar {amountLabel(derivedDeparture.pocketMoney)} ditandai sudah
          diserahkan ke pemohon sebelum status biaya diverifikasi.
        </p>
      )}
      <input name="qardhDisbursed" type="hidden" value={String(qardhDisbursed)} />

      <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Rincian Lampiran A</h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0b57d0]">
                Otomatis
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Nafaqah, Ujrah, dan uang saku dihitung otomatis dari invoice LPK terverifikasi dan
              tidak dapat diedit.
            </p>
          </div>
          <div className="text-right">
            <span className="block text-[11px] font-medium text-slate-400">Subtotal komponen</span>
            <strong className="text-sm font-bold text-slate-900">
              {amountLabel(nafaqahTotal + ujrahTotal + qardhAmount)}
            </strong>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-semibold">No</th>
                <th className="px-2 py-2 font-semibold">Komponen</th>
                <th className="px-2 py-2 font-semibold">Penerima pembayaran</th>
                <th className="px-2 py-2 text-right font-semibold">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td
                  className="bg-slate-50 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700"
                  colSpan={4}
                >
                  Nafaqah
                </td>
              </tr>
              {derivedDeparture.nafaqahItems.map((line, index) => (
                <tr key={`nafaqah-${index}`}>
                  <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-2 py-2 font-medium text-slate-800">{line.label}</td>
                  <td className="px-2 py-2 text-slate-600">{line.recipient}</td>
                  <td className="px-2 py-2 text-right text-slate-400">—</td>
                </tr>
              ))}
              <tr className="bg-blue-50/60">
                <td className="px-2 py-2" />
                <td className="px-2 py-2 font-semibold text-slate-800" colSpan={2}>
                  Subtotal Nafaqah (mengikuti invoice LPK)
                </td>
                <td className="px-2 py-2 text-right font-bold text-slate-900">
                  {amountLabel(nafaqahTotal)}
                </td>
              </tr>
              <tr>
                <td
                  className="bg-slate-50 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700"
                  colSpan={4}
                >
                  Ujrah
                </td>
              </tr>
              {derivedDeparture.ujrahItems.map((line, index) => (
                <tr key={`ujrah-${index}`}>
                  <td className="px-2 py-2 text-slate-500">
                    {lampiranSectionNo.ujrahStart + index}
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-800">{line.label}</td>
                  <td className="px-2 py-2 text-slate-600">{line.recipient}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-800">
                    {line.amount > 0 ? amountLabel(line.amount) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50/60">
                <td className="px-2 py-2" />
                <td className="px-2 py-2 font-semibold text-slate-800" colSpan={2}>
                  Subtotal Ujrah
                </td>
                <td className="px-2 py-2 text-right font-bold text-slate-900">
                  {amountLabel(ujrahTotal)}
                </td>
              </tr>
              <tr>
                <td
                  className="bg-slate-50 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700"
                  colSpan={4}
                >
                  Uang saku
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-slate-500">{lampiranSectionNo.qardh}</td>
                <td className="px-2 py-2 font-medium text-slate-800">{QARDH_LABEL}</td>
                <td className="px-2 py-2 text-slate-600">Diterima pemohon</td>
                <td className="px-2 py-2 text-right font-medium text-slate-800">
                  {qardhAmount > 0 ? amountLabel(qardhAmount) : '—'}
                </td>
              </tr>
              <tr className="border-t-2 border-slate-300 bg-blue-50">
                <td className="px-2 py-2.5" />
                <td className="px-2 py-2.5 font-bold text-[#0b57d0]" colSpan={2}>
                  Total Kewajiban
                  {refundTotal > 0 ? ` (setelah refund ${amountLabel(refundTotal)})` : ''}
                </td>
                <td className="px-2 py-2.5 text-right font-extrabold text-[#0b57d0]">
                  {amountLabel(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] leading-5 text-slate-500">
          Total Nafaqah mengikuti invoice LPK; Ujrah dihitung otomatis (wakalah 2,4% × 12 bulan +
          administrasi 5%); uang saku = dana bersih − invoice. Qardh dihitung pada total hanya bila
          sudah diserahkan.
        </p>
      </section>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Jadwal angsuran dimulai pada bulan setelah perkiraan keberangkatan.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Uang saku qardh (Rp)</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-700"
              placeholder="Otomatis dari invoice LPK"
              readOnly
              value={qardhAmount > 0 ? qardhAmount.toLocaleString('id-ID') : ''}
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
