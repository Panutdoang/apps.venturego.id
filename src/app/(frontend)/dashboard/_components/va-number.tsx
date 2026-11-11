'use client'

import { useEffect, useRef, useState } from 'react'

const LONG_PRESS_MS = 500

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback untuk browser/WebView lama tanpa Clipboard API
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}

/**
 * Baris "Virtual Account": nomor bisa disalin dengan tekan lama (±500 ms)
 * atau tombol salin di ujung kanan. Bila nomor belum terbit (kosong/semua nol),
 * tidak menyalin apa pun dan menampilkan keterangan.
 */
export function VaNumber({ number, bank }: { number?: string | null; bank?: string | null }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const digits = (number ?? '').replace(/\s/g, '')
  const available = digits.length > 0 && !/^0+$/.test(digits)
  const display = digits || '0000000000000000'

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )

  const flash = (text: string) => {
    setMessage(text)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setMessage(null), 2000)
  }

  const copy = async () => {
    if (!available) {
      flash('Nomor VA terbit setelah akad disetujui')
      return
    }
    const ok = await copyText(digits)
    if (ok && 'vibrate' in navigator) navigator.vibrate?.(30)
    flash(ok ? 'Nomor VA disalin' : 'Gagal menyalin, salin manual')
  }

  const startPress = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void copy()
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          Virtual Account{bank ? ` · ${bank}` : ''}
        </span>
        <button
          aria-label="Salin nomor Virtual Account"
          className="-my-1 grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[var(--accent)] active:scale-95"
          onClick={() => void copy()}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <rect x="9" y="9" width="12" height="12" rx="2.5" />
            <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
          </svg>
        </button>
      </div>
      <strong
        className="mt-1 block cursor-pointer select-none text-sm tabular-nums text-slate-800 [-webkit-touch-callout:none]"
        onContextMenu={(e) => e.preventDefault()}
        onPointerCancel={cancelPress}
        onPointerDown={startPress}
        onPointerLeave={cancelPress}
        onPointerUp={cancelPress}
        title="Tekan lama untuk menyalin"
      >
        {display}
      </strong>
      <span
        aria-live="polite"
        className={`pointer-events-none absolute -bottom-5 left-0 text-[10px] font-medium text-[var(--accent)] transition-opacity motion-reduce:transition-none ${message ? 'opacity-100' : 'opacity-0'}`}
      >
        {message}
      </span>
    </div>
  )
}
