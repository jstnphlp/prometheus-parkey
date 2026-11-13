import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ParkingContribution } from '@parkey/shared-types'

import { geometryMatchesKind, isGeometry, isObject } from './model.ts'
import { isReportReceipt } from './report-client.ts'

const STORAGE_KEY = 'parkey.discovery.local-reviews.v1'

export function parseContributions(value: unknown): ParkingContribution[] {
  if (!Array.isArray(value))
    throw new Error('Local previews could not be read.')
  const result: ParkingContribution[] = []
  for (const item of value) {
    if (
      !isObject(item) ||
      item.status !== 'local_pending_review' ||
      (item.submission !== undefined && !isReportReceipt(item.submission)) ||
      (item.submissionAttemptedAt !== undefined &&
        (typeof item.submissionAttemptedAt !== 'string' ||
          !Number.isFinite(Date.parse(item.submissionAttemptedAt)))) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.hours !== 'string' ||
      typeof item.fees !== 'string' ||
      typeof item.restrictions !== 'string' ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      (item.photoUri !== null && typeof item.photoUri !== 'string') ||
      (item.targetId !== null && typeof item.targetId !== 'string') ||
      (item.intent !== 'add' && item.intent !== 'correction') ||
      (item.kind !== 'street' &&
        item.kind !== 'lot' &&
        item.kind !== 'garage') ||
      !['left', 'right', 'both', 'unknown'].includes(String(item.side)) ||
      !isGeometry(item.geometry) ||
      !geometryMatchesKind(item.geometry, item.kind)
    )
      throw new Error(
        'A saved preview has an unsupported format. Clear local previews to continue.',
      )
    result.push({
      id: item.id,
      name: item.name,
      kind: item.kind,
      geometry: item.geometry,
      hours: item.hours,
      fees: item.fees,
      restrictions: item.restrictions,
      createdAt: item.createdAt,
      photoUri: item.photoUri,
      targetId: item.targetId,
      intent: item.intent,
      status: 'local_pending_review',
      ...(typeof item.submissionAttemptedAt === 'string'
        ? { submissionAttemptedAt: item.submissionAttemptedAt }
        : {}),
      ...(isReportReceipt(item.submission)
        ? {
            submission: {
              state: item.submission.state,
              receiptId: item.submission.receiptId,
              receivedAt: item.submission.receivedAt,
            },
          }
        : {}),
      side:
        item.side === 'left' || item.side === 'right' || item.side === 'both'
          ? item.side
          : 'unknown',
    })
  }
  return result.slice(0, 20)
}

export async function readContributions() {
  const value = await AsyncStorage.getItem(STORAGE_KEY)
  if (!value) return []
  return parseContributions(JSON.parse(value))
}

export async function writeContributions(drafts: ParkingContribution[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

export async function clearContributions() {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
