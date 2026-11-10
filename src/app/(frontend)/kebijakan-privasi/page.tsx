import type { Metadata } from 'next'
import { LegalPage, SERVICE_EMAIL } from '../_components/legal-page'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi · VentureGo VSV',
  description: 'Cara VentureGo mengumpulkan, memakai, dan melindungi data pribadi pengguna.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      effectiveDate="10 November 2026"
      intro={
        <p>
          Kebijakan ini menjelaskan bagaimana VentureGo — layanan Vworks Student Venture (VSV) yang
          dikelola PT Vworks Kolaborasi Bersama — mengumpulkan, memakai, menyimpan, dan melindungi
          data pribadi Anda saat memakai aplikasi pengajuan pembiayaan ini, sesuai Undang-Undang
          Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
        </p>
      }
      sections={[
        {
          title: 'Data yang kami kumpulkan',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Data akun Google</strong> saat Anda masuk: nama, alamat email, dan foto
                profil. Kami tidak menerima kata sandi Google Anda.
              </li>
              <li>
                <strong>Data pengajuan</strong>: nama sesuai KTP, nomor WhatsApp, agama, tempat dan
                tanggal lahir, jenis kelamin, alamat, nama LPK, negara tujuan, kesiapan
                keberangkatan, serta rincian kebutuhan dana.
              </li>
              <li>
                <strong>Dokumen</strong> yang Anda unggah, seperti KTP, Kartu Keluarga, ijazah,
                paspor, akta kelahiran, dan dokumen pendukung lain.
              </li>
              <li>
                <strong>Data pembayaran</strong>: nominal, status, waktu, serta metode dan kanal
                pembayaran yang dilaporkan penyedia pembayaran. Kami tidak menyimpan PIN atau kata
                sandi rekening Anda.
              </li>
              <li>
                <strong>Data teknis</strong> terbatas yang diperlukan untuk keamanan, seperti waktu
                masuk dan catatan galat sistem.
              </li>
            </ul>
          ),
        },
        {
          title: 'Untuk apa data dipakai',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Memproses dan memverifikasi pengajuan pembiayaan Anda.</li>
              <li>Menyusun rincian biaya, akad Wakalah bil Ujrah, dan jadwal angsuran.</li>
              <li>Menerima dan mencatat pembayaran angsuran.</li>
              <li>Mengirim pemberitahuan terkait pengajuan, berkas, dan jatuh tempo.</li>
              <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
              <li>Memenuhi kewajiban hukum dan pencatatan keuangan.</li>
            </ul>
          ),
        },
        {
          title: 'Dasar pemrosesan',
          body: (
            <p>
              Kami memproses data berdasarkan persetujuan yang Anda berikan saat mengirim pengajuan,
              pelaksanaan akad pembiayaan dengan Anda, dan kewajiban hukum yang berlaku.
            </p>
          ),
        },
        {
          title: 'Dengan siapa data dibagikan',
          body: (
            <>
              <p>Data hanya dibagikan sejauh diperlukan kepada:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>LPK mitra Anda, untuk verifikasi program dan biaya pelatihan.</li>
                <li>Xendit, penyedia layanan pembayaran, untuk memproses pembayaran Anda.</li>
                <li>
                  Penyedia infrastruktur awan (Google Cloud dan Vercel) yang menyimpan dan
                  menjalankan aplikasi atas nama kami.
                </li>
                <li>Instansi berwenang, bila diwajibkan oleh hukum.</li>
              </ul>
              <p>
                Kami <strong>tidak menjual</strong> data Anda dan tidak memakainya untuk iklan.
              </p>
            </>
          ),
        },
        {
          title: 'Penyimpanan dan keamanan',
          body: (
            <p>
              Data disimpan di database dan penyimpanan berkas yang bersifat privat. Akses hanya
              melalui server aplikasi dengan koneksi terenkripsi (HTTPS), oleh akun Anda sendiri dan
              staf VentureGo yang berwenang. Berkas tidak pernah dibagikan melalui tautan publik.
            </p>
          ),
        },
        {
          title: 'Lama penyimpanan',
          body: (
            <p>
              Data disimpan selama pengajuan atau akad Anda berjalan, lalu selama diwajibkan untuk
              pencatatan keuangan dan hukum. Setelah itu data dihapus atau dianonimkan.
            </p>
          ),
        },
        {
          title: 'Hak Anda',
          body: (
            <>
              <p>Anda berhak untuk:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>mengakses dan meminta salinan data Anda;</li>
                <li>
                  memperbaiki data yang tidak tepat — sebagian dapat diubah langsung di menu Profil
                  → Data Diri;
                </li>
                <li>
                  meminta penghapusan data, dengan memperhatikan kewajiban akad yang masih berjalan;
                </li>
                <li>menarik persetujuan pemrosesan data;</li>
                <li>mengajukan keberatan atas pemrosesan tertentu.</li>
              </ul>
              <p>
                Ajukan permintaan melalui email <strong>{SERVICE_EMAIL}</strong>. Kami dapat meminta
                verifikasi identitas sebelum memproses permintaan.
              </p>
            </>
          ),
        },
        {
          title: 'Perubahan kebijakan',
          body: (
            <p>
              Kebijakan ini dapat diperbarui. Perubahan penting akan diberitahukan melalui aplikasi
              atau email, dan tanggal berlaku di atas akan disesuaikan.
            </p>
          ),
        },
        {
          title: 'Kontak',
          body: (
            <p>
              Pertanyaan tentang privasi dapat dikirim ke <strong>{SERVICE_EMAIL}</strong>.
            </p>
          ),
        },
      ]}
    />
  )
}
