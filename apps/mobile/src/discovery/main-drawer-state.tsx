import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const MainDrawerContext = createContext<{
  open: boolean
  setOpen: (value: boolean) => void
} | null>(null)

export function MainDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <MainDrawerContext.Provider value={value}>
      {children}
    </MainDrawerContext.Provider>
  )
}

export function useMainDrawer() {
  const drawer = useContext(MainDrawerContext)
  if (!drawer) throw new Error('MainDrawerProvider is required.')
  return drawer
}
