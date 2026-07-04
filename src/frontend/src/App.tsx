import { useState } from 'react'
import { plugins } from './plugins'
import SwipeNavigator from './components/SwipeNavigator'
import DotsIndicator from './components/DotsIndicator'
import DashboardPage from './dashboard/DashboardPage'
import { WebSocketProvider } from './hooks/WebSocketContext'
import { NavigationProvider, useNavigation } from './hooks/NavigationContext'
import CommandBar from './components/CommandBar'

const pages = [
  {"id": "dashboard", "component": DashboardPage},
  ...plugins.map(p => ({ id: p.id, component: p.page }))
]

const pageIds = pages.map(p => p.id)

function AppInner() {
  const { currentIndex, navigate } = useNavigation()
  const [isCommandBar, setIsCommandBar] = useState(false)

  return (
    <div className="dark h-full bg-background flex flex-col">
      {isCommandBar && <CommandBar onClose={() => setIsCommandBar(false)} />}
      <div className={`flex-1 min-h-0 transition-all duration-300 ease-in-out 
        ${isCommandBar ? 'blur-sm brightness-50 pointer-events-none select-none' : ''}`}>
        <SwipeNavigator
          pages={pages}
          currentIndex={currentIndex}
          onPageChange={(index) => navigate(pageIds[index])}
        />
      </div>
      <DotsIndicator currentIndex={currentIndex} total={pages.length} onClick={() => setIsCommandBar(prev => !prev)} 
      isCommandBar={isCommandBar} />
    </div>
  )
}

function App() {
  return (
    <div className="dark h-dvh bg-background pt-[env(safe-area-inset-top)]">
      <WebSocketProvider url={`wss://${window.location.host}${import.meta.env.VITE_WS_URL}`}>
        <NavigationProvider pageIds={pageIds}>
          <AppInner />
        </NavigationProvider>
      </WebSocketProvider>
    </div>
  )
}

export default App
