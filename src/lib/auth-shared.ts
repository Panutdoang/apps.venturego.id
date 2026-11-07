export const PRIMARY_STAFF_EMAIL = 'vworksofficial@gmail.com'

export const normalizeEmail = (email: string | undefined | null) =>
  typeof email === 'string' ? email.trim().toLowerCase() : ''

export const isPrimaryStaffEmail = (email: string | undefined | null) =>
  normalizeEmail(email) === PRIMARY_STAFF_EMAIL
