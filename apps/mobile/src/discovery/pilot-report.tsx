import type { Coordinate, ParkingContribution } from '@parkey/shared-types'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { ContributionForm } from './contribution-form'
import { readContributions, writeContributions } from './contributions'
import { createLocalDraftId } from './local-draft-id'
import { anchor, kindLabels, validateContribution } from './model'
import { ReportSubmission } from './report-submission'
import { ModalSheet } from './sheets'
import { Button, useUI } from './ui'

export function PilotReport({
  point,
  onClose,
  onAdjust,
  adjusted,
}: {
  point: Coordinate
  onClose: () => void
  onAdjust: (draft: ParkingContribution) => void
  adjusted: ParkingContribution | null
}) {
  const ui = useUI()
  const [draft, setDraft] = useState(adjusted)
  const [review, setReview] = useState<ParkingContribution | null>(null)
  const [drafts, setDrafts] = useState<ParkingContribution[] | null>(null)
  const [error, setError] = useState(false)
  const saving = useRef(false)
  const center = useRef(point)

  async function load() {
    setError(false)
    try {
      setDrafts(await readContributions())
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    let active = true
    void readContributions().then(
      (saved) => {
        if (active) setDrafts(saved)
      },
      () => {
        if (active) setError(true)
      },
    )
    return () => {
      active = false
    }
  }, [])

  async function saveDraft(form: ParkingContribution) {
    if (saving.current) return 'A draft is already being saved.'
    saving.current = true
    try {
      const current = await readContributions()
      const next = {
        ...form,
        name: form.name.trim(),
        restrictions: form.restrictions.trim(),
        hours: form.hours.trim(),
        fees: form.fees.trim(),
        createdAt: new Date().toISOString(),
      }
      const issue = validateContribution(next, current, Date.now())
      if (issue) return issue
      const updated = [next, ...current]
      await writeContributions(updated)
      setDrafts(updated)
      setDraft(null)
      return null
    } catch {
      return 'This draft could not be saved on your device. Try again.'
    } finally {
      saving.current = false
    }
  }

  async function patchSubmission(
    id: string,
    patch: Pick<ParkingContribution, 'submission' | 'submissionAttemptedAt'>,
  ) {
    if (saving.current) throw new Error('Local storage is busy.')
    saving.current = true
    try {
      const current = await readContributions()
      if (!current.some((item) => item.id === id))
        throw new Error('The local draft was removed.')
      const updated = current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      )
      await writeContributions(updated)
      setDrafts(updated)
    } finally {
      saving.current = false
    }
  }

  if (draft)
    return (
      <ContributionForm
        key={draft.id}
        draft={draft}
        onSave={saveDraft}
        onClose={() => setDraft(null)}
        onAdjust={onAdjust}
      />
    )
  if (review)
    return (
      <ReportSubmission
        draft={review}
        onClose={() => setReview(null)}
        onAttempt={() =>
          patchSubmission(review.id, {
            submissionAttemptedAt: new Date().toISOString(),
          })
        }
        onReceipt={(submission) => patchSubmission(review.id, { submission })}
      />
    )

  return (
    <ModalSheet title="Report parking" onClose={onClose}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        <Text style={ui.body}>
          Add parking information as a private draft. Sending it for review
          requires your approval.
        </Text>
        <Button
          onPress={() =>
            setDraft({
              id: createLocalDraftId(),
              intent: 'add',
              targetId: null,
              kind: 'lot',
              geometry: { type: 'Point', coordinates: center.current },
              side: 'unknown',
              name: '',
              restrictions: '',
              hours: '',
              fees: '',
              photoUri: null,
              createdAt: new Date().toISOString(),
              status: 'local_pending_review',
            })
          }
        >
          Add parking
        </Button>
        <Text accessibilityRole="header" style={ui.heading}>
          Device drafts
        </Text>
        {error ? (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={ui.error}>
              The device drafts could not be read.
            </Text>
            <Button secondary onPress={() => void load()}>
              Retry
            </Button>
          </View>
        ) : !drafts ? (
          <Text style={ui.small}>Loading drafts…</Text>
        ) : drafts.length ? (
          drafts.map((item) => (
            <Button key={item.id} secondary onPress={() => setReview(item)}>
              {item.name || kindLabels[item.kind]}
            </Button>
          ))
        ) : (
          <Text style={ui.small}>No drafts on this device.</Text>
        )}
      </ScrollView>
    </ModalSheet>
  )
}

export function adjustPilotDraft(
  draft: ParkingContribution,
  points: Coordinate[],
): ParkingContribution {
  const first = points[0] ?? anchor(draft.geometry)
  return {
    ...draft,
    geometry:
      draft.kind === 'street'
        ? { type: 'LineString', coordinates: points }
        : { type: 'Point', coordinates: first },
  }
}
