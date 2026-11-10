import type { Metadata } from 'next'
import { LegalPage, SERVICE_EMAIL } from '../_components/legal-page'

export const metadata: Metadata = {
  title: 'Syarat Layanan · VentureGo VSV',
  description: 'Ketentuan penggunaan aplikasi pengajuan pembiayaan VentureGo VSV.',
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Syarat Layanan"
      effectiveDate="10 November 2026"
      intro={
        <p>
          Dengan masuk dan memakai aplikasi VentureGo — layanan Vworks Student Venture (VSV) yang
          dikelola PT Vworks Kolaborasi Bersama — Anda menyetujui ketentuan berikut. Bacalah juga{' '}
          <a className="font-semibold text-[var(--primary)]" href="/kebijakan-privasi">
            Kebijakan Privasi
          </a>{' '}
          kami.
        </p>
      }
      sections={[
        {
          title: 'Layanan',
          body: (
            <p>
              Aplikasi ini dipakai untuk mengajukan pembiayaan program pelatihan dan keberangkatan
              kerja ke luar negeri, mengunggah dokumen, memantau status, dan membayar angsuran.
            </p>
          ),
        },
        {
          title: 'Akun',
          body: (
            <p>
              Anda masuk menggunakan akun Google pribadi dan bertanggung jawab menjaga keamanannya.
              Satu akun untuk satu orang; jangan memakai akun orang lain.
            </p>
          ),
        },
        {
          title: 'Kebenaran data',
          body: (
            <p>
              Anda wajib mengisi data dan mengunggah dokumen yang benar, lengkap, dan milik Anda
              sendiri. Data atau dokumen yang tidak benar dapat menyebabkan pengajuan ditolak atau
              dibatalkan.
            </p>
          ),
        },
        {
          title: 'Pengajuan dan akad',
          body: (
            <p>
              Mengirim pengajuan tidak berarti pembiayaan pasti disetujui. Angka simulasi bersifat
              perkiraan. Hak dan kewajiban pembiayaan berlaku berdasarkan akad Wakalah bil Ujrah
              yang telah disepakati dan ditandatangani, termasuk rincian biaya dan jadwal angsuran
              di dalamnya.
            </p>
          ),
        },
        {
          title: 'Pembayaran',
          body: (
            <p>
              Pembayaran diproses melalui penyedia pembayaran resmi (Xendit). Anda boleh membayar
              lebih awal atau lebih besar dari angsuran tanpa penalti. Sesuai akad, total kewajiban
              tidak bertambah karena waktu atau keterlambatan.
            </p>
          ),
        },
        {
          title: 'Larangan',
          body: (
            <p>
              Dilarang menyalahgunakan aplikasi, mencoba mengakses data orang lain, mengganggu
              sistem, atau memakai aplikasi untuk tujuan yang melanggar hukum.
            </p>
          ),
        },
        {
          title: 'Batasan tanggung jawab',
          body: (
            <p>
              Kami berupaya menjaga aplikasi tetap tersedia dan aman, tetapi layanan dapat sementara
              terganggu karena pemeliharaan atau gangguan pihak ketiga. Kewajiban kami terhadap
              pembiayaan Anda diatur dalam akad yang berlaku.
            </p>
          ),
        },
        {
          title: 'Perubahan ketentuan',
          body: (
            <p>
              Ketentuan ini dapat diperbarui. Perubahan penting akan diberitahukan melalui aplikasi
              atau email.
            </p>
          ),
        },
        {
          title: 'Hukum dan kontak',
          body: (
            <p>
              Ketentuan ini tunduk pada hukum Republik Indonesia. Pertanyaan dapat dikirim ke{' '}
              <strong>{SERVICE_EMAIL}</strong>.
            </p>
          ),
        },
      ]}
    />
  )
}
