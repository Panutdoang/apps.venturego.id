'use client'

import { useState } from 'react'
import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
} from '../_components/dashboard-ui'

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara membayar angsuran?',
    a: 'Buka menu Bayar Angsuran (/dashboard/pembayaran), pilih jadwal angsuran yang ingin dibayar, lalu selesaikan pembayaran melalui Virtual Account (BCA, Mandiri, BNI, BRI) atau QRIS di halaman Xendit.',
  },
  {
    q: 'Kapan pembayaran saya diverifikasi?',
    a: 'Pembayaran melalui Virtual Account dan QRIS Xendit dikonfirmasi secara otomatis oleh sistem segera setelah transaksi berhasil.',
  },
  {
    q: 'Bagaimana melihat rincian akad dan dokumen saya?',
    a: 'Rincian biaya Nafaqah, Ujrah, dan jadwal angsuran tersedia di menu Angsuran (/dashboard/angsuran), sedangkan arsip berkas dan bukti bayar dapat dilihat di menu Dokumen Saya (/dashboard/dokumen).',
  },
  {
    q: 'Bagaimana jika saya membutuhkan keringanan pembayaran?',
    a: 'Pada menu Angsuran (/dashboard/angsuran), Anda dapat mengajukan permohonan keringanan beserta alasannya untuk ditinjau langsung oleh tim operasional VentureGo.',
  },
  {
    q: 'Bagaimana cara memperbarui data diri?',
    a: 'Buka Profil → Data Diri, tekan Ubah Data, perbarui kolom yang tersedia, lalu tekan Simpan. Perubahan hanya berlaku untuk pengajuan yang sedang dipilih.',
  },
  {
    q: 'Mengapa data diri saya terkunci?',
    a: 'Setelah akad disepakati atau pembiayaan aktif, data dikunci agar tetap sesuai dengan dokumen akad. Hubungi tim melalui email untuk meminta koreksi.',
  },
  {
    q: 'Kapan PDF akad dapat dilihat?',
    a: 'PDF akad final muncul di Profil → Dokumen Saya setelah rincian disepakati dan tim VentureGo mengunggah dokumen bertanda tangan.',
  },
]

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <DashboardScaffold active="home" subtitle="Kami siap membantu" title="Pusat bantuan">
      <DashboardCard className="bg-[var(--primary)] p-5 text-white ring-0">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
          <DashboardIcon name="help" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Ada yang bisa kami bantu?</h2>
        <p className="mt-2 text-xs leading-5 text-blue-100">
          Temukan jawaban cepat atau hubungi tim layanan VSV pada jam operasional.
        </p>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Akses bantuan</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Ajukan keringanan jadwal di menu Angsuran"
            href="/dashboard/angsuran"
            icon="phone"
            title="Permohonan keringanan cicilan"
          />
          <DashboardMenuRow
            detail="vworksofficial@gmail.com"
            href="mailto:vworksofficial@gmail.com"
            icon="mail"
            title="Kirim email layanan"
          />
        </DashboardCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Pertanyaan populer</h2>
        <DashboardCard>
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div className="border-b border-slate-100 last:border-0" key={item.q}>
                <button
                  className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold text-slate-700"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  type="button"
                >
                  <span>{item.q}</span>
                  <DashboardIcon
                    name="chevron"
                    className={`size-5 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {isOpen && <p className="px-4 pb-4 text-xs leading-5 text-slate-500">{item.a}</p>}
              </div>
            )
          })}
        </DashboardCard>
      </section>
    </DashboardScaffold>
  )
}
