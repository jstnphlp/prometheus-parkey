import { useState } from 'react'
import { ScrollView } from 'react-native'

import { ModalSheet } from '../discovery/sheets'
import { IconButton, useUI } from '../discovery/ui'
import { AppearanceChoices } from '../settings/settings-screen'

export function AppearanceButton() {
  const [open, setOpen] = useState(false)
  const ui = useUI()
  return (
    <>
      <IconButton
        icon="appearance"
        label="Appearance"
        onPress={() => setOpen(true)}
      />
      {open ? (
        <ModalSheet title="Appearance" onClose={() => setOpen(false)}>
          <ScrollView
            style={ui.sheetScroll}
            contentContainerStyle={{ padding: 24 }}
          >
            <AppearanceChoices />
          </ScrollView>
        </ModalSheet>
      ) : null}
    </>
  )
}
