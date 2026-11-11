'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// Kartu putih beranda yang bisa digeser kiri/kanan (seperti kartu saldo aplikasi bank).
// CSS scroll-snap tanpa library; titik di bawah kartu menunjukkan & memilih halaman.
export function WalletCarousel({
  pages,
  id,
}: {
  pages: { key: string; label: string; content: ReactNode }[]
  id?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      const width = element.clientWidth || 1
      setActive(Math.min(pages.length - 1, Math.max(0, Math.round(element.scrollLeft / width))))
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [pages.length])

  const goTo = (index: number) => {
    const element = scroller.current
    if (!element) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({ left: index * element.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section
      aria-roledescription="carousel"
      className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
      id={id}
    >
      <div
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scroller}
      >
        {pages.map((page, index) => (
          <div
            aria-label={`${page.label} (${index + 1} dari ${pages.length})`}
            aria-roledescription="slide"
            className="w-full shrink-0 snap-start snap-always p-5 pb-3"
            key={page.key}
            role="group"
          >
            {page.content}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-4">
        {pages.map((page, index) => (
          <button
            aria-current={index === active}
            aria-label={`Tampilkan ${page.label}`}
            className="grid h-4 place-items-center px-0.5"
            key={page.key}
            onClick={() => goTo(index)}
            type="button"
          >
            <span
              className={`block h-1.5 rounded-full transition-all motion-reduce:transition-none ${
                index === active ? 'w-5 bg-[var(--primary)]' : 'w-1.5 bg-slate-300'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
