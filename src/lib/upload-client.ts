export type DriveUploadOptions = {
  token: string
  file: File
  documentIndex: number
  product?: string
  applicationDocId?: string
  folderName?: string
}

export type DriveUploadResult = {
  fileId: string
  fileName: string
  mimeType: string
  size: number
}

type UploadResponse = {
  ok?: boolean
  message?: string
  ticket?: string
  chunkSize?: number
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: number
}

const readJson = async (response: Response): Promise<UploadResponse> =>
  (await response.json().catch(() => ({}))) as UploadResponse

export const uploadToDrive = async (options: DriveUploadOptions): Promise<DriveUploadResult> => {
  const { file, token, documentIndex } = options
  if (!token) throw new Error('Sesi unggah telah berakhir. Silakan muat ulang halaman.')
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new Error('Ukuran berkas tidak valid.')
  }

  const initResponse = await fetch('/api/applicant/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upload-action': 'init',
      'x-upload-token': token,
    },
    body: JSON.stringify({
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      documentIndex,
      product: options.product,
      applicationDocId: options.applicationDocId,
      folderName: options.folderName,
    }),
  })
  const initData = await readJson(initResponse)
  if (!initResponse.ok || !initData.ok || !initData.ticket || !initData.chunkSize) {
    throw new Error(initData.message || 'Berkas belum dapat diunggah. Silakan coba lagi.')
  }

  const ticket = initData.ticket
  const chunkSize = initData.chunkSize
  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size) - 1
    const chunkResponse = await fetch('/api/applicant/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end}/${file.size}`,
        'x-upload-action': 'chunk',
        'x-upload-ticket': ticket,
        'x-upload-token': token,
      },
      body: file.slice(start, end + 1),
    })
    const chunkData = await readJson(chunkResponse)
    if (!chunkResponse.ok || !chunkData.ok) {
      throw new Error(chunkData.message || 'Berkas belum dapat diunggah. Silakan coba lagi.')
    }
    if (end + 1 >= file.size) {
      if (!chunkData.fileId || !chunkData.fileName || !chunkData.mimeType) {
        throw new Error('Berkas belum dapat disimpan. Silakan coba lagi.')
      }
      return {
        fileId: chunkData.fileId,
        fileName: chunkData.fileName,
        mimeType: chunkData.mimeType,
        size: chunkData.size ?? file.size,
      }
    }
  }
  throw new Error('Berkas belum dapat diunggah. Silakan coba lagi.')
}
