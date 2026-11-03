import * as ImagePicker from 'expo-image-picker'
import type { ParkingContribution } from '@parkey/shared-types'
import { useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { anchor, kindLabels } from './model'
import { ModalSheet } from './sheets'
import { Button, Choice, colors, ui } from './ui'

export function ContributionForm({
  draft,
  onClose,
  onSave,
  onAdjust,
}: {
  draft: ParkingContribution
  onClose: () => void
  onAdjust: (draft: ParkingContribution) => void
  onSave: (draft: ParkingContribution) => Promise<string | null>
}) {
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function photo() {
    setError(null)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        selectionLimit: 1,
      })
      const asset = result.assets?.[0]
      if (result.canceled || !asset) return
      if ((asset.fileSize ?? 0) > 8 * 1024 * 1024) {
        setError('Choose a photograph smaller than 8 MB.')
        return
      }
      setForm((current) => ({ ...current, photoUri: asset.uri }))
    } catch {
      setError(
        'The photo picker could not open. You can continue without a photograph.',
      )
    }
  }
  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)
    const issue = await onSave(form)
    setBusy(false)
    if (issue) setError(issue)
    else setSaved(true)
  }

  return (
    <ModalSheet
      title={
        saved
          ? 'Draft saved on this device'
          : form.intent === 'correction'
            ? 'Draft a correction'
            : 'Add parking'
      }
      onClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flexShrink: 1 }}
      >
        <ScrollView
          style={ui.sheetScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {saved ? (
            <View style={{ gap: 16 }}>
              <Text style={ui.title}>Private draft saved</Text>
              <Text style={ui.body}>
                Saved on this device only. Not sent for review, published or
                verified.
              </Text>
              <Button onPress={onClose}>Show on map</Button>
            </View>
          ) : form.intent === 'add' ? (
            <>
              <Text style={ui.small}>
                Private draft · saved on this device only
              </Text>
              <View style={[ui.row, { flexWrap: 'wrap' }]}>
                {(['lot', 'garage', 'street'] as const).map((kind) => (
                  <Choice
                    key={kind}
                    selected={form.kind === kind}
                    onPress={() => {
                      const next = {
                        ...form,
                        kind,
                        geometry:
                          kind !== 'street' &&
                          form.geometry.type === 'LineString'
                            ? {
                                type: 'Point' as const,
                                coordinates: anchor(form.geometry),
                              }
                            : form.geometry,
                      }
                      if (kind === 'street' && form.geometry.type === 'Point')
                        onAdjust(next)
                      else setForm(next)
                    }}
                  >
                    {kindLabels[kind]}
                  </Choice>
                ))}
              </View>
              <Field
                label="Name (optional)"
                value={form.name}
                maxLength={100}
                onChange={(name) =>
                  setForm((current) => ({ ...current, name }))
                }
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => onAdjust(form)}
                style={styles.link}
              >
                <Text style={[ui.body, ui.link]}>Adjust location on map</Text>
              </Pressable>
              {error ? (
                <Text accessibilityRole="alert" style={[ui.body, ui.error]}>
                  {error}
                </Text>
              ) : null}
              <Button disabled={busy} onPress={() => void save()}>
                {busy ? 'Saving…' : 'Save private draft'}
              </Button>
            </>
          ) : (
            <>
              <Text style={ui.small}>
                Private draft only. This correction is not sent to Parkey or
                other drivers.
              </Text>
              <Field
                label="Parking name"
                value={form.name}
                maxLength={100}
                onChange={(name) =>
                  setForm((current) => ({ ...current, name }))
                }
              />
              <Field
                label="What needs correcting?"
                value={form.restrictions}
                onChange={(restrictions) =>
                  setForm((current) => ({ ...current, restrictions }))
                }
                multiline
              />
              {form.photoUri ? (
                <Image
                  source={{ uri: form.photoUri }}
                  accessibilityLabel="Attached parking signage"
                  style={styles.photo}
                  resizeMode="contain"
                />
              ) : (
                <Button secondary icon="camera" onPress={() => void photo()}>
                  Attach signage photo
                </Button>
              )}
              {error ? (
                <Text accessibilityRole="alert" style={[ui.body, ui.error]}>
                  {error}
                </Text>
              ) : null}
              <Button disabled={busy} onPress={() => void save()}>
                Save correction on device
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ModalSheet>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  maxLength = 500,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  maxLength?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ''}
        placeholderTextColor={colors.muted}
        selectionColor={colors.action}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={maxLength}
        multiline={multiline}
        style={[
          ui.input,
          focused && ui.focused,
          multiline && { minHeight: 88, textAlignVertical: 'top' },
        ]}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 24 },
  link: { minHeight: 44, justifyContent: 'center', borderRadius: 12 },
  photo: {
    height: 150,
    width: '100%',
    backgroundColor: colors.soft,
    borderRadius: 14,
  },
})
