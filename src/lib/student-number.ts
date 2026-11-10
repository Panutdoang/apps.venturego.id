import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseFirestore } from './firebase-admin'

export const STUDENT_NUMBER_PATTERN = /^VSV-\d{4,}-\d{4}$/

const getJakartaYear = () =>
  new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date())

const buildStudentNumber = (sequence: number, year: string) =>
  `VSV-${String(sequence).padStart(4, '0')}-${year}`

export const studentNumberSequence = (studentNumber: string): string | null => {
  const match = STUDENT_NUMBER_PATTERN.exec(studentNumber)
  return match ? match[1] : null
}

export const getExistingStudentNumber = async (uid: string): Promise<string | null> => {
  if (typeof uid !== 'string' || !uid || uid.length > 128) return null
  try {
    const profile = await getFirebaseFirestore().collection('studentProfiles').doc(uid).get()
    const value = profile.data()?.studentNumber
    return typeof value === 'string' && STUDENT_NUMBER_PATTERN.test(value) ? value : null
  } catch {
    return null
  }
}

export const peekNextStudentNumber = async (): Promise<string | null> => {
  try {
    const year = getJakartaYear()
    const counter = await getFirebaseFirestore()
      .collection('systemCounters')
      .doc(`student-numbers-${year}`)
      .get()
    const previous = counter.data()?.lastIssued
    const nextSequence =
      typeof previous === 'number' && Number.isSafeInteger(previous) && previous >= 0
        ? previous + 1
        : 1
    return buildStudentNumber(nextSequence, year)
  } catch {
    return null
  }
}

export const ensureStudentNumber = async (uid: string): Promise<string | null> => {
  if (typeof uid !== 'string' || !uid || uid.length > 128) return null
  try {
    const firestore = getFirebaseFirestore()
    const year = getJakartaYear()
    const profileRef = firestore.collection('studentProfiles').doc(uid)
    const counterRef = firestore.collection('systemCounters').doc(`student-numbers-${year}`)

    return await firestore.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef)
      const existingNumber = profile.data()?.studentNumber
      if (typeof existingNumber === 'string' && STUDENT_NUMBER_PATTERN.test(existingNumber)) {
        return existingNumber
      }

      const counter = await transaction.get(counterRef)
      const previous = counter.data()?.lastIssued
      const nextSequence =
        typeof previous === 'number' && Number.isSafeInteger(previous) && previous >= 0
          ? previous + 1
          : 1
      const nextNumber = buildStudentNumber(nextSequence, year)

      transaction.set(counterRef, {
        year: Number(year),
        lastIssued: nextSequence,
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.set(
        profileRef,
        {
          ownerFirebaseUid: uid,
          studentNumber: nextNumber,
          issuedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

      return nextNumber
    })
  } catch {
    return null
  }
}
