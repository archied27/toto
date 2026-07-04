import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'

interface NavigationContextType {
  currentIndex: number
  navigate: (pageId: string, params?: Record<string, unknown>) => void
  params: Record<string, unknown>
  pageIds: string[]
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ pageIds, children }: { pageIds: string[], children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string | null>(pageIds[0] ?? null)
  const [params, setParams] = useState<Record<string, unknown>>({})

  // If the page list changes and our current id disappeared, fall back gracefully.
  useEffect(() => {
    if (currentId === null && pageIds.length > 0) {
      setCurrentId(pageIds[0])
      return
    }
    if (currentId !== null && !pageIds.includes(currentId) && pageIds.length > 0) {
      setCurrentId(pageIds[0])
    }
  }, [pageIds, currentId])

  const currentIndex = useMemo(() => {
    if (currentId === null) return 0
    const index = pageIds.indexOf(currentId)
    return index === -1 ? 0 : index
  }, [pageIds, currentId])

  const navigate = (pageId: string, params?: Record<string, unknown>) => {
    if (pageIds.includes(pageId)) {
      setParams(params ?? {})
      setCurrentId(pageId)
    }
  }

  return (
    <NavigationContext.Provider value={{ currentIndex, navigate, params, pageIds }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider')
  return ctx
}