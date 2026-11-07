export type DemoRole = 'user' | 'admin'

export const PRIMARY_STAFF_EMAIL = 'vworksofficial@gmail.com'

export const normalizeEmail = (email: string | undefined | null) =>
  typeof email === 'string' ? email.trim().toLowerCase() : ''

export const isPrimaryStaffEmail = (email: string | undefined | null) =>
  normalizeEmail(email) === PRIMARY_STAFF_EMAIL

export const isAllowedSignInProvider = (provider: string | undefined) =>
  provider === 'google.com' || (process.env.NODE_ENV !== 'production' && provider === 'password')
