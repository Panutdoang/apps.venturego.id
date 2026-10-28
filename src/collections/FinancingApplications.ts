import type { CollectionConfig } from 'payload'

const staffOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export const FinancingApplications: CollectionConfig = {
  slug: 'financing-applications',
  admin: {
    group: 'VSV Operations',
    useAsTitle: 'applicationId',
    defaultColumns: ['applicationId', 'applicantName', 'product', 'status', 'createdAt'],
  },
  access: {
    create: () => true,
    read: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data && !data.applicationId) {
          const suffix = `${Date.now()}`.slice(-8)
          data.applicationId = `VSV-APP-${suffix}`
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'applicationId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'product',
      type: 'select',
      required: true,
      options: [
        { label: 'VSV Full Cover', value: 'FULL_COVER' },
        { label: 'VSV Dana Keberangkatan', value: 'DEPARTURE_BRIDGING' },
      ],
    },
    {
      name: 'contractScheme',
      type: 'select',
      required: true,
      defaultValue: 'WAKALAH_BIL_UJRAH',
      options: [{ label: 'Wakalah bil Ujrah', value: 'WAKALAH_BIL_UJRAH' }],
    },
    { name: 'applicantName', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'lpkName', type: 'text', required: true },
    {
      name: 'personalDetails',
      type: 'group',
      fields: [
        { name: 'birthPlace', type: 'text' },
        { name: 'birthDate', type: 'date' },
        {
          name: 'gender',
          type: 'select',
          options: [
            { label: 'Laki-laki', value: 'MALE' },
            { label: 'Perempuan', value: 'FEMALE' },
          ],
        },
        { name: 'idCardAddress', type: 'textarea' },
        { name: 'domicileSameAsIdCard', type: 'checkbox' },
        { name: 'domicileAddress', type: 'textarea' },
        { name: 'domicilePostalCode', type: 'text' },
      ],
    },
    {
      name: 'destination',
      type: 'select',
      required: true,
      options: [
        { label: 'Jepang', value: 'JAPAN' },
        { label: 'Turki', value: 'TURKEY' },
      ],
    },
    {
      name: 'eligibility',
      type: 'group',
      fields: [
        { name: 'trainingStarted', type: 'checkbox' },
        { name: 'trainingCompleted', type: 'checkbox' },
        { name: 'hasPassport', type: 'checkbox' },
        { name: 'hasWorkContract', type: 'checkbox' },
        { name: 'guardianApproval', type: 'checkbox' },
        { name: 'placementPassed', type: 'checkbox' },
        {
          name: 'coeStatus',
          type: 'select',
          options: [
            { label: 'Belum diproses', value: 'NOT_STARTED' },
            { label: 'Sedang diproses', value: 'IN_PROGRESS' },
            { label: 'Sudah terbit', value: 'ISSUED' },
          ],
        },
        {
          name: 'visaStatus',
          type: 'select',
          options: [
            { label: 'Belum diproses', value: 'NOT_STARTED' },
            { label: 'Sedang diproses', value: 'IN_PROGRESS' },
            { label: 'Sudah terbit', value: 'ISSUED' },
          ],
        },
        { name: 'estimatedDeparture', type: 'date' },
      ],
    },
    {
      name: 'fullCoverDetails',
      type: 'group',
      fields: [
        {
          name: 'languageLevel',
          type: 'select',
          options: [
            { label: 'Belum mulai', value: 'NOT_STARTED' },
            { label: 'N5 dasar', value: 'BASIC_N5' },
            { label: 'N5', value: 'N5' },
            { label: 'N4', value: 'N4' },
            { label: 'N3 atau lebih tinggi', value: 'N3_PLUS' },
          ],
        },
        { name: 'trainingProgram', type: 'text' },
        { name: 'trainingStartDate', type: 'date' },
        { name: 'languageTrainingMonths', type: 'number', min: 1, max: 24 },
        { name: 'skillTrainingMonths', type: 'number', min: 1, max: 24 },
        { name: 'requiresTrainingAllowance', type: 'checkbox' },
        { name: 'requiresAccommodation', type: 'checkbox' },
      ],
    },
    {
      name: 'departureDetails',
      type: 'group',
      fields: [
        { name: 'outstandingLPKAmount', type: 'number', min: 0 },
        { name: 'paymentRecipient', type: 'text' },
        {
          name: 'recipientType',
          type: 'select',
          options: [
            { label: 'LPK', value: 'LPK' },
            { label: 'Instansi atau pihak ketiga', value: 'THIRD_PARTY' },
            { label: 'Siswa', value: 'STUDENT' },
          ],
        },
      ],
    },
    {
      name: 'fundingNeeds',
      type: 'array',
      fields: [
        {
          name: 'category',
          type: 'select',
          required: true,
          options: [
            { label: 'Pelatihan bahasa', value: 'LANGUAGE_TRAINING' },
            { label: 'Pelatihan keterampilan', value: 'SKILL_TRAINING' },
            { label: 'MCU dan seleksi', value: 'MEDICAL' },
            { label: 'Dokumen', value: 'DOCUMENT' },
            { label: 'Pembayaran LPK', value: 'LPK_PAYMENT' },
            { label: 'Uang saku', value: 'ALLOWANCE' },
            { label: 'Transportasi', value: 'TRANSPORT' },
            { label: 'Tempat tinggal', value: 'ACCOMMODATION' },
            { label: 'Lainnya', value: 'OTHER' },
          ],
        },
        { name: 'description', type: 'text' },
        { name: 'amount', type: 'number', min: 0 },
        { name: 'recipientName', type: 'text' },
      ],
    },
    {
      name: 'financialPlan',
      type: 'group',
      fields: [
        { name: 'nafaqahTotal', type: 'number', min: 0 },
        { name: 'ujrahTotal', type: 'number', min: 0 },
        { name: 'totalObligation', type: 'number', min: 0 },
        { name: 'tenorMonths', type: 'number', min: 1, max: 36 },
        { name: 'monthlyInstallment', type: 'number', min: 0 },
        {
          name: 'pricingStatus',
          type: 'select',
          defaultValue: 'ESTIMATED',
          options: [
            { label: 'Estimasi', value: 'ESTIMATED' },
            { label: 'Terverifikasi', value: 'VERIFIED' },
            { label: 'Disepakati', value: 'AGREED' },
          ],
        },
      ],
    },
    {
      name: 'documents',
      type: 'array',
      fields: [
        { name: 'documentType', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'NOT_UPLOADED',
          options: [
            { label: 'Belum diunggah', value: 'NOT_UPLOADED' },
            { label: 'Sudah diunggah', value: 'UPLOADED' },
            { label: 'Diverifikasi', value: 'VERIFIED' },
            { label: 'Perlu perbaikan', value: 'REVISION_REQUIRED' },
          ],
        },
      ],
    },
    { name: 'understandsWakalah', type: 'checkbox', required: true },
    { name: 'acceptsDataProcessing', type: 'checkbox', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'SUBMITTED',
      access: {
        create: () => false,
        update: staffOnly,
      },
      options: [
        { label: 'Terkirim', value: 'SUBMITTED' },
        { label: 'Pemeriksaan kelayakan', value: 'ELIGIBILITY_REVIEW' },
        { label: 'Pemeriksaan dokumen', value: 'DOCUMENT_REVIEW' },
        { label: 'Perlu perbaikan', value: 'REVISION_REQUIRED' },
        { label: 'Verifikasi biaya', value: 'COST_VERIFICATION' },
        { label: 'Disetujui', value: 'APPROVED' },
        { label: 'Persiapan akad', value: 'CONTRACT_PREPARATION' },
        { label: 'Aktif', value: 'ACTIVE' },
        { label: 'Selesai', value: 'COMPLETED' },
        { label: 'Ditolak', value: 'REJECTED' },
        { label: 'Dibatalkan', value: 'CANCELLED' },
      ],
    },
    { name: 'internalNotes', type: 'textarea', access: { create: () => false, update: staffOnly } },
  ],
}
