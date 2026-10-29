import type { CollectionConfig } from 'payload'

const staffOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export const ApplicationDocuments: CollectionConfig = {
  slug: 'application-documents',
  labels: {
    singular: 'Application Document',
    plural: 'Application Documents',
  },
  admin: {
    group: 'VSV Operations',
    useAsTitle: 'label',
  },
  access: {
    create: () => true,
    read: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'label', type: 'text' },
    {
      name: 'applicationId',
      type: 'text',
      admin: { readOnly: true },
      access: { create: () => false, update: staffOnly },
    },
  ],
  upload: {
    filesRequiredOnCreate: true,
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
}
