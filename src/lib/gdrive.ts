import 'server-only'

import { Buffer } from 'node:buffer'
import { createHash, createHmac, createSign, timingSafeEqual } from 'node:crypto'

export const DRIVE_ROOT_FOLDER_NAME = 'VentureGo Berkas'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DRIVE_API = 'https://www.googleapis.com'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const UPLOAD_TICKET_TTL_MS = 30 * 60 * 1000

export type GDriveErrorCode = 'NOT_CONFIGURED' | 'INVALID' | 'FORBIDDEN' | 'UPSTREAM'

export class GDriveError extends Error {
  constructor(
    message: string,
    readonly code: GDriveErrorCode = 'UPSTREAM',
  ) {
    super(message)
  }
}

type ServiceAccountKey = { type: string; client_email: string; private_key: string }

export type UploadTicket = {
  v: 1
  uid: string
  exp: number
  folderId: string
  documentIndex: number
  appDocId: string | null
  fileName: string
  mimeType: string
  size: number
  sessionUrl: string
}

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/

let cachedKey: ServiceAccountKey | null = null
const getServiceAccountKey = (): ServiceAccountKey => {
  if (cachedKey) return cachedKey
  const encoded = process.env.GDRIVE_KEY_B64?.trim()
  if (!encoded) {
    throw new GDriveError('Layanan Google Drive belum dikonfigurasi di server.', 'NOT_CONFIGURED')
  }
  let parsed: ServiceAccountKey | null = null
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  } catch {
    parsed = null
  }
  if (parsed?.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
    throw new GDriveError('Layanan Google Drive belum dikonfigurasi di server.', 'NOT_CONFIGURED')
  }
  cachedKey = parsed
  return parsed
}

let cachedToken: { value: string; expiresAt: number } | null = null
const getServiceAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value
  const key = getServiceAccountKey()
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: key.client_email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  })}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const assertion = `${unsigned}.${signer.sign(key.private_key).toString('base64url')}`

  let response: Response
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      cache: 'no-store',
    })
  } catch {
    throw new GDriveError('Google Drive tidak dapat dihubungi.', 'UPSTREAM')
  }
  if (!response.ok) {
    throw new GDriveError('Autentikasi Google Drive gagal.', 'UPSTREAM')
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token) {
    throw new GDriveError('Autentikasi Google Drive gagal.', 'UPSTREAM')
  }
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  return payload.access_token
}

const driveFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const token = await getServiceAccessToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  try {
    return await fetch(`${DRIVE_API}${path}`, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new GDriveError('Google Drive tidak dapat dihubungi.', 'UPSTREAM')
  }
}

const driveJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await driveFetch(path, init)
  if (response.ok) return (await response.json()) as T
  if (response.status === 403) {
    throw new GDriveError(
      'Akses Google Drive ditolak. Pastikan folder sudah dibagikan ke layanan unggah.',
      'FORBIDDEN',
    )
  }
  if (response.status === 404) {
    throw new GDriveError('Folder atau berkas Drive tidak ditemukan.', 'INVALID')
  }
  throw new GDriveError('Google Drive tidak dapat dihubungi.', 'UPSTREAM')
}

export const sanitizeDriveFolderName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

const escapeQueryValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const findChildFolder = async (parentId: string, name: string): Promise<string | null> => {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${escapeQueryValue(name)}' and '${escapeQueryValue(parentId)}' in parents and trashed=false`
  const data = await driveJson<{ files?: { id?: string }[] }>(
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
  )
  const id = data.files?.[0]?.id
  return typeof id === 'string' ? id : null
}

export const getOrCreateChildFolder = async (parentId: string, name: string): Promise<string> => {
  const existing = await findChildFolder(parentId, name)
  if (existing) return existing
  const created = await driveJson<{ id?: string }>('/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!created.id) throw new GDriveError('Folder Drive gagal dibuat.', 'UPSTREAM')
  return created.id
}

let cachedRootFolderId: string | null = null
export const getRootFolderId = async (): Promise<string> => {
  if (cachedRootFolderId) return cachedRootFolderId
  const configured = process.env.GDRIVE_ROOT_FOLDER_ID?.trim()
  if (configured) {
    cachedRootFolderId = configured
    return configured
  }
  const query = `mimeType='application/vnd.google-apps.folder' and name='${escapeQueryValue(DRIVE_ROOT_FOLDER_NAME)}' and trashed=false and sharedWithMe`
  const data = await driveJson<{ files?: { id?: string }[] }>(
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&orderBy=modifiedTime desc&pageSize=1`,
  )
  const id = data.files?.[0]?.id
  if (!id) {
    throw new GDriveError(
      `Folder "${DRIVE_ROOT_FOLDER_NAME}" belum ditemukan. Buat folder itu di Google Drive lalu bagikan sebagai Editor ke ${getServiceAccountKey().client_email}.`,
      'NOT_CONFIGURED',
    )
  }
  cachedRootFolderId = id
  return id
}

export const createResumableSession = async (options: {
  parentFolderId: string
  fileName: string
  mimeType: string
  size: number
}): Promise<string> => {
  const token = await getServiceAccessToken()
  let response: Response
  try {
    response = await fetch(
      `${DRIVE_API}/upload/drive/v3/files?uploadType=resumable&fields=id,size,parents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': options.mimeType,
          'X-Upload-Content-Length': String(options.size),
        },
        body: JSON.stringify({ name: options.fileName, parents: [options.parentFolderId] }),
        cache: 'no-store',
      },
    )
  } catch {
    throw new GDriveError('Google Drive tidak dapat dihubungi.', 'UPSTREAM')
  }
  const location = response.headers.get('location')
  if (!response.ok || !location) {
    throw new GDriveError('Google Drive gagal menyiapkan sesi unggah.', 'UPSTREAM')
  }
  return location
}

export const abortResumableSession = async (sessionUrl: string): Promise<void> => {
  try {
    const token = await getServiceAccessToken()
    await fetch(sessionUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  } catch {}
}

export const sendResumableChunk = async (
  sessionUrl: string,
  chunk: Uint8Array,
  start: number,
  totalSize: number,
): Promise<{ done: false } | { done: true; fileId: string; size: number }> => {
  const end = start + chunk.byteLength - 1
  const token = await getServiceAccessToken()
  let response: Response
  try {
    response = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      },
      body: chunk as unknown as BodyInit,
      cache: 'no-store',
    })
  } catch {
    throw new GDriveError('Berkas gagal diteruskan ke Google Drive.', 'UPSTREAM')
  }
  if (response.status === 308) return { done: false }
  if (response.ok) {
    const data = (await response.json().catch(() => null)) as {
      id?: string
      size?: string | number
    } | null
    if (!data?.id) throw new GDriveError('Google Drive tidak mengembalikan berkas.', 'UPSTREAM')
    return { done: true, fileId: data.id, size: Number(data.size ?? totalSize) }
  }
  if (response.status === 404 || response.status === 410) {
    throw new GDriveError('Sesi unggah kedaluwarsa. Silakan unggah ulang.', 'INVALID')
  }
  throw new GDriveError('Berkas gagal diteruskan ke Google Drive.', 'UPSTREAM')
}

export const getDriveFileInfo = async (
  fileId: string,
): Promise<{
  id: string
  name: string
  parents?: string[]
  size?: string | number
  mimeType?: string
}> => {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new GDriveError('Identitas berkas tidak valid.', 'INVALID')
  }
  return driveJson(`/drive/v3/files/${fileId}?fields=id,name,parents,size,mimeType`)
}

export const readDriveFileHead = async (fileId: string): Promise<Uint8Array> => {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new GDriveError('Identitas berkas tidak valid.', 'INVALID')
  }
  const response = await driveFetch(`/drive/v3/files/${fileId}?alt=media`, {
    headers: { Range: 'bytes=0-7' },
  })
  if (!response.ok) {
    throw new GDriveError(
      'Berkas tidak dapat dibaca dari Google Drive.',
      response.status === 404 ? 'INVALID' : 'UPSTREAM',
    )
  }
  return new Uint8Array(await response.arrayBuffer()).subarray(0, 8)
}

export const downloadDriveFile = async (fileId: string): Promise<Uint8Array> => {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new GDriveError('Identitas berkas tidak valid.', 'INVALID')
  }
  const response = await driveFetch(`/drive/v3/files/${fileId}?alt=media`)
  if (!response.ok) {
    throw new GDriveError(
      'Berkas tidak dapat diunduh dari Google Drive.',
      response.status === 404 ? 'INVALID' : 'UPSTREAM',
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}

export const deleteDriveFile = async (fileId: string): Promise<void> => {
  if (!FILE_ID_PATTERN.test(fileId)) return
  try {
    await driveFetch(`/drive/v3/files/${fileId}`, { method: 'DELETE' })
  } catch {}
}

export const renameDriveFile = async (fileId: string, name: string): Promise<void> => {
  if (!FILE_ID_PATTERN.test(fileId) || !name) return
  try {
    await driveFetch(`/drive/v3/files/${fileId}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  } catch {}
}

const ticketSecret = () => createHash('sha256').update(getServiceAccountKey().private_key).digest()

export const signUploadTicket = (payload: Omit<UploadTicket, 'v' | 'exp'>): string => {
  const ticket: UploadTicket = { ...payload, v: 1, exp: Date.now() + UPLOAD_TICKET_TTL_MS }
  const body = Buffer.from(JSON.stringify(ticket)).toString('base64url')
  const signature = createHmac('sha256', ticketSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export const verifyUploadTicket = (value: string): UploadTicket => {
  const invalid = () =>
    new GDriveError('Sesi unggah tidak valid. Silakan ulangi unggahan.', 'INVALID')
  if (typeof value !== 'string' || value.length > 4096) throw invalid()
  const parts = value.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid()
  const expected = createHmac('sha256', ticketSecret()).update(parts[0]).digest()
  const provided = Buffer.from(parts[1], 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw invalid()

  let ticket: UploadTicket | null = null
  try {
    ticket = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  } catch {
    ticket = null
  }
  const valid =
    ticket?.v === 1 &&
    typeof ticket.uid === 'string' &&
    ticket.uid.length > 0 &&
    ticket.uid.length <= 128 &&
    typeof ticket.folderId === 'string' &&
    FILE_ID_PATTERN.test(ticket.folderId) &&
    Number.isSafeInteger(ticket.documentIndex) &&
    ticket.documentIndex >= 0 &&
    ticket.documentIndex <= 60 &&
    (ticket.appDocId === null ||
      (typeof ticket.appDocId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(ticket.appDocId))) &&
    typeof ticket.fileName === 'string' &&
    ticket.fileName.length > 0 &&
    ticket.fileName.length <= 200 &&
    typeof ticket.mimeType === 'string' &&
    Number.isSafeInteger(ticket.size) &&
    ticket.size > 0 &&
    typeof ticket.sessionUrl === 'string' &&
    ticket.sessionUrl.startsWith('https://') &&
    Number.isSafeInteger(ticket.exp) &&
    ticket.exp > Date.now()
  if (!ticket || !valid) throw invalid()
  return ticket
}
