import accounts from './demo-accounts.json'

export type DemoRole = 'user' | 'admin'

export const DEMO_ACCOUNTS: Record<DemoRole, { email: string; password: string }> = accounts

export const DEMO_USER_EMAIL = DEMO_ACCOUNTS.user.email
export const DEMO_ADMIN_EMAIL = DEMO_ACCOUNTS.admin.email
