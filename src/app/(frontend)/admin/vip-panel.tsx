'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { VIP_LEDGER_LABELS, VIP_LEDGER_TYPES, type VipLedgerType } from '@/lib/vip'
import {
  addVipTransaction,
  listVipInvestors,
  saveVipInvestor,
  voidVipTransaction,
  type AdminVipInvestor,
  type AdminVipInvestorInput,
  type AdminVipLedgerItem,
} from './vip-actions'

const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`
const tanggal = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—'
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const EMPTY_FORM: AdminVipInvestorInput = {
  displayName: '',
  emails: '',
  phone: '',
  idCardNumber: '',
  address: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  profitShareDay: 15,
  status: 'ACTIVE',
  notes: '',
}

const toForm = (investor: AdminVipInvestor): AdminVipInvestorInput => ({
  id: investor.id,
  displayName: investor.displayName,
  emails: investor.emails.join(', '),
  phone: investor.phone,
  idCardNumber: investor.idCardNumber,
  address: investor.address,
  bankName: investor.bankName,
  bankAccountNumber: investor.bankAccountNumber,
  bankAccountName: investor.bankAccountName,
  profitShareDay: investor.profitShareDay,
  status: investor.status,
  notes: investor.notes,
})

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0b57d0] focus:outline-none'

function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <label className={`block space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export function AdminVipPanel({
  todayIso,
  searchQuery,
}: {
  todayIso: string
  searchQuery: string
}) {
  const [investors, setInvestors] = useState<AdminVipInvestor[]>([])
  const [ledger, setLedger] = useState<AdminVipLedgerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminVipInvestorInput | null>(null)
  const [trx, setTrx] = useState({ date: todayIso, type: 'PROFIT_SHARE', amount: '', note: '' })
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const result = await listVipInvestors()
    if (!result.ok) setError(result.message)
    else {
      setError('')
      setInvestors(result.investors)
      setLedger(result.ledger)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return q
      ? investors.filter((i) =>
          [i.displayName, ...i.emails, i.phone].some((v) => v.toLowerCase().includes(q)),
        )
      : investors
  }, [investors, searchQuery])

  const selected = investors.find((i) => i.id === selectedId) ?? null
  const selectedLedger = ledger.filter((row) => row.investorId === selectedId)
  const active = investors.filter((i) => i.status === 'ACTIVE')
  const totals = {
    balance: active.reduce((s, i) => s + i.principalBalance, 0),
    lastMonth: active.reduce((s, i) => s + (i.lastProfitShare?.amount ?? 0), 0),
  }

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4000)
  }

  const select = (investor: AdminVipInvestor) => {
    setSelectedId(investor.id)
    setForm(toForm(investor))
    setTrx({
      date: todayIso,
      type: 'PROFIT_SHARE',
      amount: investor.lastProfitShare ? String(investor.lastProfitShare.amount) : '',
      note: '',
    })
  }

  const submitProfile = () =>
    form &&
    startTransition(async () => {
      const result = await saveVipInvestor(form)
      if (!result.ok) return setError(result.message)
      setError('')
      await load()
      setSelectedId(result.id)
      setForm((current) => (current ? { ...current, id: result.id } : current))
      flash('Data mitra tersimpan.')
    })

  const submitTransaction = () =>
    selected &&
    startTransition(async () => {
      const amount = Number(trx.amount.replace(/\D/g, ''))
      const result = await addVipTransaction({
        investorId: selected.id,
        date: trx.date,
        type: trx.type,
        amount,
        note:
          trx.note ||
          (trx.type === 'PROFIT_SHARE'
            ? `Bagi hasil ${new Date(`${trx.date}T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`
            : VIP_LEDGER_LABELS[trx.type as VipLedgerType]),
      })
      if (!result.ok) return setError(result.message)
      setError('')
      setTrx((current) => ({ ...current, note: '' }))
      await load()
      flash('Transaksi tercatat dan saldo diperbarui.')
    })

  const voidRow = (row: AdminVipLedgerItem) => {
    const reason = window.prompt(
      `Batalkan ${VIP_LEDGER_LABELS[row.type]} ${rupiah(row.amount)} (${tanggal(row.date)})?\nTulis alasannya:`,
    )
    if (!reason) return
    startTransition(async () => {
      const result = await voidVipTransaction(row.id, reason)
      if (!result.ok) return setError(result.message)
      setError('')
      await load()
      flash('Transaksi dibatalkan.')
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Mitra aktif', String(active.length)],
          ['Total dana mitra', rupiah(totals.balance)],
          ['Bagi hasil terakhir (semua mitra)', rupiah(totals.lastMonth)],
        ].map(([label, value]) => (
          <div
            className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs"
            key={label}
          >
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Daftar mitra</h2>
            <button
              className="rounded-md bg-[#0b57d0] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0842a0]"
              onClick={() => {
                setSelectedId(null)
                setForm({ ...EMPTY_FORM })
              }}
              type="button"
            >
              + Tambah mitra
            </button>
          </header>
          {loading ? (
            <p className="p-4 text-xs text-slate-500">Memuat…</p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Belum ada mitra.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((investor) => (
                <li key={investor.id}>
                  <button
                    className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                      investor.id === selectedId ? 'bg-blue-50/70' : ''
                    }`}
                    onClick={() => select(investor)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        {investor.displayName}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          investor.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {investor.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {rupiah(investor.principalBalance)} ·{' '}
                      {investor.linked ? 'akun terhubung' : 'belum login'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {!form && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              Pilih mitra untuk melihat data diri, mencatat transaksi, dan riwayat dana.
            </p>
          )}

          {form && (
            <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <header className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-900">
                  {form.id ? 'Data diri mitra' : 'Mitra baru'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Email dipakai untuk mengenali akun Google mitra saat login di aplikasi.
                </p>
              </header>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="Nama lengkap *">
                  <input
                    className={inputClass}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    value={form.displayName}
                  />
                </Field>
                <Field label="Email login (pisahkan dengan koma)">
                  <input
                    className={inputClass}
                    onChange={(e) => setForm({ ...form, emails: e.target.value })}
                    value={form.emails}
                  />
                </Field>
                <Field label="No. WhatsApp">
                  <input
                    className={inputClass}
                    inputMode="tel"
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    value={form.phone}
                  />
                </Field>
                <Field label="NIK">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    maxLength={16}
                    onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })}
                    value={form.idCardNumber}
                  />
                </Field>
                <Field label="Alamat" wide>
                  <input
                    className={inputClass}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    value={form.address}
                  />
                </Field>
                <Field label="Bank tujuan bagi hasil">
                  <input
                    className={inputClass}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="mis. BRI"
                    value={form.bankName}
                  />
                </Field>
                <Field label="No. rekening">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                    value={form.bankAccountNumber}
                  />
                </Field>
                <Field label="Atas nama rekening">
                  <input
                    className={inputClass}
                    onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                    value={form.bankAccountName}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tgl bagi hasil">
                    <input
                      className={inputClass}
                      max={28}
                      min={1}
                      onChange={(e) =>
                        setForm({ ...form, profitShareDay: Number(e.target.value) || 15 })
                      }
                      type="number"
                      value={form.profitShareDay}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={inputClass}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      value={form.status}
                    >
                      <option value="ACTIVE">Aktif</option>
                      <option value="INACTIVE">Nonaktif</option>
                    </select>
                  </Field>
                </div>
                <Field label="Catatan internal" wide>
                  <textarea
                    className={`${inputClass} min-h-16`}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    value={form.notes}
                  />
                </Field>
              </div>
              <div className="flex justify-end border-t border-slate-100 px-5 py-3">
                <button
                  className="rounded-lg bg-[#0b57d0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0842a0] disabled:opacity-50"
                  disabled={pending}
                  onClick={submitProfile}
                  type="button"
                >
                  {pending ? 'Menyimpan…' : 'Simpan data mitra'}
                </button>
              </div>
            </section>
          )}

          {selected && (
            <>
              <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <header className="border-b border-slate-100 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Catat transaksi</h2>
                  <p className="text-[11px] text-slate-500">
                    Saldo {rupiah(selected.principalBalance)} · bagi hasil terakhir{' '}
                    {selected.lastProfitShare
                      ? `${rupiah(selected.lastProfitShare.amount)} (${tanggal(selected.lastProfitShare.date)})`
                      : '—'}
                  </p>
                </header>
                <div className="grid gap-3 p-5 sm:grid-cols-4">
                  <Field label="Tanggal">
                    <input
                      className={inputClass}
                      onChange={(e) => setTrx({ ...trx, date: e.target.value })}
                      type="date"
                      value={trx.date}
                    />
                  </Field>
                  <Field label="Jenis">
                    <select
                      className={inputClass}
                      onChange={(e) => setTrx({ ...trx, type: e.target.value })}
                      value={trx.type}
                    >
                      {VIP_LEDGER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {VIP_LEDGER_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nominal (Rp)">
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      onChange={(e) => setTrx({ ...trx, amount: e.target.value })}
                      value={trx.amount}
                    />
                  </Field>
                  <Field label="Keterangan (opsional)">
                    <input
                      className={inputClass}
                      onChange={(e) => setTrx({ ...trx, note: e.target.value })}
                      value={trx.note}
                    />
                  </Field>
                </div>
                <div className="flex justify-end border-t border-slate-100 px-5 py-3">
                  <button
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    disabled={pending || !trx.amount}
                    onClick={submitTransaction}
                    type="button"
                  >
                    {pending ? 'Mencatat…' : 'Catat transaksi'}
                  </button>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <header className="border-b border-slate-100 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Riwayat dana ({selectedLedger.length})
                  </h2>
                </header>
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Tanggal</th>
                        <th className="px-4 py-2">Jenis</th>
                        <th className="px-4 py-2">Keterangan</th>
                        <th className="px-4 py-2 text-right">Nominal</th>
                        <th className="px-4 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLedger.map((row) => (
                        <tr
                          className={row.voided ? 'text-slate-400 line-through' : ''}
                          key={row.id}
                        >
                          <td className="whitespace-nowrap px-4 py-2">{tanggal(row.date)}</td>
                          <td className="whitespace-nowrap px-4 py-2">
                            {VIP_LEDGER_LABELS[row.type]}
                          </td>
                          <td className="px-4 py-2">
                            {row.note}
                            {row.voided && (
                              <span className="block text-[10px] no-underline">
                                Dibatalkan: {row.voidReason}
                              </span>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${
                              row.type === 'WITHDRAWAL' ? 'text-slate-600' : 'text-emerald-700'
                            }`}
                          >
                            {row.type === 'WITHDRAWAL' ? '−' : '+'}
                            {rupiah(row.amount)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {!row.voided && (
                              <button
                                className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
                                disabled={pending}
                                onClick={() => voidRow(row)}
                                type="button"
                              >
                                Batalkan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
