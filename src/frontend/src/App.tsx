import { useEffect, useMemo, useState } from 'react'
import SwipeNavigator from './components/SwipeNavigator'
import DotsIndicator from './components/DotsIndicator'
import { WebSocketProvider } from './hooks/WebSocketContext'
import { NavigationProvider, useNavigation } from './hooks/NavigationContext'
import CommandBar from './components/CommandBar'
import AgentToolsPanel from './components/AgentToolsPanel'
import { usePages } from './hooks/usePages'
import { pageRegistry, type AppPage } from './hooks/pageRegistry'
import { type WidgetSlot, resolveSlot } from './dashboard/DashboardPage'
import { useDashboard } from './hooks/useDashboard'

function AppInner({ pages }: { pages: AppPage[] }) {
  const { currentIndex, navigate } = useNavigation()
  const { slots } = useDashboard()
  const [longSlot, setLongSlot] = useState<WidgetSlot | null>(null);

  useEffect(() => {
    const resolvedLongSlot = resolveSlot(slots.hero, "wide");
    setLongSlot(resolvedLongSlot);
  }, [slots]);

  const [isCommandBar, setIsCommandBar] = useState(false)
  const [isAgentTools, setIsAgentTools] = useState(false)
  const pageIds = pages.map(page => page.id)

  const anyOverlayOpen = isCommandBar || isAgentTools

  // Tap: open CommandBar if nothing's open, otherwise close whatever IS open
  const handleTap = () => {
    if (isAgentTools) {
      setIsAgentTools(false)
      return
    }
    setIsCommandBar(prev => !prev)
  }

  // Swipe up: open AgentToolsPanel (closing CommandBar if it was open)
  const handleSwipeUp = () => {
    if (isAgentTools) return // already open, nothing to do
    setIsCommandBar(false)
    setIsAgentTools(true)
  }

  return (
    <div className="dark h-full bg-background flex flex-col">
      {isCommandBar && (
        <CommandBar onClose={() => setIsCommandBar(false)} longComponent={longSlot?.component} />
      )}
      {isAgentTools && (
        <AgentToolsPanel onClose={() => setIsAgentTools(false)} open={isAgentTools} />
      )}
      <div
        className={`flex-1 min-h-0 transition-all duration-300 ease-in-out 
        ${anyOverlayOpen ? 'blur-sm brightness-50 pointer-events-none select-none' : ''}`}
      >
        <SwipeNavigator
          pages={pages}
          currentIndex={currentIndex}
          onPageChange={(index) => navigate(pageIds[index])}
        />
      </div>
      <DotsIndicator
        currentIndex={currentIndex}
        total={pages.length}
        isCommandBar={anyOverlayOpen}
        onClick={handleTap}
        onSwipeUp={handleSwipeUp}
      />
    </div>
  )
}

function AppContent() {
  const { pages: backendPages } = usePages()

  const pages: AppPage[] = useMemo(
    () =>
      backendPages
        .map(page => ({
          id: page.id,
          component: pageRegistry[page.id],
        }))
        .filter((page): page is AppPage => page.component !== undefined),
    [backendPages]
  )

  const pageIds = pages.map(page => page.id)

  return (
    <NavigationProvider pageIds={pageIds}>
      <AppInner pages={pages} />
    </NavigationProvider>
  )
}

function App() {
  return (
    <div className="dark h-screen bg-background pt-[env(safe-area-inset-top)]">
      <WebSocketProvider url={`wss://${window.location.host}/ws`}>
        <AppContent />
      </WebSocketProvider>
    </div>
  )
}

export default App