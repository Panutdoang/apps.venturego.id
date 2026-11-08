import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { buildDocumentFileName } from './documents'
import { getFirebaseFirestore } from './firebase-admin'
import {
  DRIVE_FOLDER_COLOR_ACTIVE,
  DRIVE_FOLDER_COLOR_DRAFT,
  GDriveError,
  getOrCreateChildFolder,
  getRootFolderId,
  renameDriveFile,
  sanitizeDriveFolderName,
  setDriveFolderColor,
} from './gdrive'
import { ensureStudentNumber } from './student-number'

const joinFolderName = (parts: string[]) =>
  sanitizeDriveFolderName(
    parts
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' - '),
  )

export const buildDraftFolderName = (applicantName: string, lpkName: string) =>
  joinFolderName([applicantName, lpkName])

export const buildActiveFolderName = (studentNumber: string, applicantName: string) =>
  joinFolderName([studentNumber, applicantName])

export const ensureApplicationDriveFolder = async (application: {
  ownerFirebaseUid?: unknown
  applicantName?: unknown
  lpkName?: unknown
  status?: unknown
}): Promise<string> => {
  const ownerUid =
    typeof application.ownerFirebaseUid === 'string' ? application.ownerFirebaseUid : ''
  const applicantName =
    typeof application.applicantName === 'string' ? application.applicantName : ''
  const lpkName = typeof application.lpkName === 'string' ? application.lpkName : ''
  const rootId = await getRootFolderId()

  if (application.status === 'ACTIVE') {
    const studentNumber = await ensureStudentNumber(ownerUid)
    const activeName = studentNumber ? buildActiveFolderName(studentNumber, applicantName) : ''
    if (activeName) {
      return getOrCreateChildFolder(rootId, activeName, {
        colorRgb: DRIVE_FOLDER_COLOR_ACTIVE,
        createOnly: true,
      })
    }
  }

  const name = buildDraftFolderName(applicantName, lpkName)
  if (!name) throw new GDriveError('Nama pemohon belum diisi.', 'INVALID')
  return getOrCreateChildFolder(rootId, name, {
    colorRgb: DRIVE_FOLDER_COLOR_DRAFT,
    createOnly: true,
  })
}

export const promoteApplicationFolder = async (params: {
  folderId: string
  ownerUid: string
  applicantName: string
  files: { fileId: string; fileName?: string; label: string }[]
}): Promise<void> => {
  try {
    const studentNumber = await ensureStudentNumber(params.ownerUid)
    const name = studentNumber ? buildActiveFolderName(studentNumber, params.applicantName) : ''
    if (!name) return

    if (params.folderId) {
      await renameDriveFile(params.folderId, name)
      await setDriveFolderColor(params.folderId, DRIVE_FOLDER_COLOR_ACTIVE)
      await Promise.allSettled(
        params.files
          .filter((file) => file.fileId && file.label)
          .map((file) =>
            renameDriveFile(
              file.fileId,
              buildDocumentFileName(file.label, params.applicantName, file.fileName ?? ''),
            ),
          ),
      )
      if (params.ownerUid) {
        await getFirebaseFirestore()
          .collection('driveFolders')
          .doc(params.ownerUid)
          .set(
            {
              ownerUid: params.ownerUid,
              folderId: params.folderId,
              folderName: name,
              stage: 'active',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          .catch(() => {})
      }
    }
  } catch {}
}
