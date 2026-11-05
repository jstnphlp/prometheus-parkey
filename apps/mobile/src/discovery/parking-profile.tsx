import type { ParkingContribution } from '@parkey/shared-types'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TAB_BAR_HEIGHT } from './bottom-navigation'
import { FigmaAsset } from './figma-assets'
import { MotionPressable, MotionView } from './motion'
import type { FigmaAssetName } from './figma-assets'
import { dateLabel, kindLabels } from './model'
import { diagnosticStatus } from './telemetry'
import { fonts } from './typography'
import { Button, colors, ui } from './ui'
import type { useLocalState } from './use-local-state'

export function ParkingPage({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <MotionView style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 16) + TAB_BAR_HEIGHT + 24,
          },
        ]}
      >
        <View style={styles.header}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Back to map"
            onPress={onClose}
            style={ui.flex}
          >
            <Text accessibilityRole="header" style={ui.title}>
              {title}
            </Text>
            {subtitle ? <Text style={ui.small}>{subtitle}</Text> : null}
          </MotionPressable>
        </View>
        {children}
      </ScrollView>
    </MotionView>
  )
}

export function ParkingTile({
  title,
  subtitle,
  icon,
  onPress,
  accent = false,
  disabled = false,
}: {
  title: string
  subtitle: string
  icon: FigmaAssetName
  onPress: () => void
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        accent && styles.addTile,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View
        style={[styles.tileIcon, accent && { backgroundColor: colors.brand }]}
      >
        <FigmaAsset name={icon} size={24} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </MotionPressable>
  )
}

export function ParkingProfile({
  local,
  drafts,
  storage,
  onDeleteDraft,
  onInfo,
  onClose,
}: {
  local: ReturnType<typeof useLocalState>
  drafts: ParkingContribution[]
  storage: 'loading' | 'ready' | 'error'
  onDeleteDraft: (id: string) => Promise<boolean>
  onInfo: () => void
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ready = local.status === 'ready'
  return (
    <ParkingPage
      title="You"
      subtitle="No account needed. Everything stays on this device."
      onClose={onClose}
    >
      <View style={ui.row}>
        {(
          [
            {
              label: 'Saved',
              icon: 'bookmark',
              count: ready ? local.state.favorites.length : null,
            },
            {
              label: 'Viewed',
              icon: 'viewed-brand',
              count: ready ? local.state.recents.length : null,
            },
            {
              label: 'Draft',
              icon: 'draft-brand',
              count: storage === 'ready' ? drafts.length : null,
            },
          ] as const
        ).map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <FigmaAsset name={stat.icon} size={24} />
            <Text style={ui.title}>{stat.count ?? '—'}</Text>
            <Text style={styles.caption}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.section} testID="private-drafts">
        <View style={ui.row}>
          <Text accessibilityRole="header" style={[ui.heading, ui.flex]}>
            Drafts on this device
          </Text>
          <Text style={ui.muted}>
            {storage === 'ready' ? drafts.length : '—'}
          </Text>
        </View>
        <View style={styles.notice}>
          <FigmaAsset name="info-warning" size={20} />
          <Text style={[ui.small, ui.flex, { color: colors.ink }]}>
            Stored on this device only. Not submitted, shared with Parkey or
            uploaded.
          </Text>
        </View>
        {drafts.map((draft) => (
          <View key={draft.id} style={ui.row}>
            <View style={ui.flex}>
              <Text style={ui.heading}>
                {draft.name.trim() || kindLabels[draft.kind]}
              </Text>
              <Text style={ui.small}>
                {draft.intent === 'add' ? 'Missing parking' : 'Correction'} ·
                saved {dateLabel(draft.createdAt)}
              </Text>
            </View>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`Delete device draft ${draft.name.trim() || kindLabels[draft.kind]}`}
              accessibilityState={{ disabled: deleting !== null }}
              disabled={deleting !== null}
              style={styles.delete}
              onPress={() => {
                setDeleting(draft.id)
                setError(null)
                void onDeleteDraft(draft.id)
                  .then((ok) => {
                    if (!ok)
                      setError('The draft could not be deleted. Try again.')
                  })
                  .catch(() =>
                    setError('The draft could not be deleted. Try again.'),
                  )
                  .finally(() => setDeleting(null))
              }}
            >
              <Text style={[styles.caption, { color: colors.error }]}>
                {deleting === draft.id ? 'Deleting…' : 'Delete'}
              </Text>
            </MotionPressable>
          </View>
        ))}
        {storage === 'loading' ? (
          <Text style={ui.small}>Loading device drafts…</Text>
        ) : null}
        {storage === 'ready' && !drafts.length ? (
          <Text style={ui.small}>No drafts on this device yet.</Text>
        ) : null}
        {storage === 'error' ? (
          <Button secondary onPress={onInfo}>
            Try loading drafts again
          </Button>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.section}>
        <PrivacyRow
          icon="lock-teal"
          title="Private by default"
          body="Saved places, recent searches and drafts are stored on this device."
        />
        <PrivacyRow
          icon="shield-teal"
          title="Shared only when you ask"
          body="Search text and map area go to Photon. Directions send start and destination to the routing provider."
        />
        <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
          <Text style={styles.reporting}>
            Usage reporting {diagnosticStatus.analytics ? 'on' : 'off'}
          </Text>
          <Text style={styles.reporting}>
            Error reporting {diagnosticStatus.crashes ? 'on' : 'off'}
          </Text>
        </View>
      </View>
      <MotionPressable
        accessibilityRole="button"
        onPress={onInfo}
        style={({ pressed }) => [
          styles.section,
          styles.creditRow,
          pressed && ui.pressed,
        ]}
      >
        <View style={[styles.badge, { backgroundColor: colors.selected }]}>
          <FigmaAsset name="info-brand" size={20} />
        </View>
        <View style={ui.flex}>
          <Text style={ui.heading}>Map data & credits</Text>
          <Text style={ui.small}>OpenStreetMap contributors</Text>
        </View>
        <FigmaAsset name="chevron-right" size={20} />
      </MotionPressable>
      {local.error ? (
        <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
          {local.error}
        </Text>
      ) : null}
    </ParkingPage>
  )
}

function PrivacyRow({
  icon,
  title,
  body,
}: {
  icon: FigmaAssetName
  title: string
  body: string
}) {
  return (
    <View style={styles.privacyRow}>
      <View style={styles.badge}>
        <FigmaAsset name={icon} size={20} />
      </View>
      <View style={ui.flex}>
        <Text style={ui.heading}>{title}</Text>
        <Text style={ui.small}>{body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  header: { paddingBottom: 0, gap: 2 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 28,
    padding: 16,
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 2,
  },
  caption: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningSurface,
    padding: 12,
    borderRadius: 16,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.positiveSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reporting: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  delete: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 140,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 28,
    gap: 8,
  },
  addTile: {
    backgroundColor: colors.canvas,
    borderStyle: 'dashed',
    borderColor: colors.brand,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { ...ui.sectionTitle },
  tileSubtitle: { ...ui.small },
})
