import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { roomManager } from './core/room'
import { securityManager, e2eeManager } from './security'
import { useRoom } from './ui/hooks/useRoom'
import { I18nProvider, useI18n } from './i18n'
import Starfield from './ui/components/Starfield'
import RoomPanel from './ui/components/RoomPanel'
import InstallPrompt from './ui/components/InstallPrompt'
import './ui/styles/globals.css'

const ChatView = lazy(() => import('./ui/components/ChatView'))
const BackupPanel = lazy(() => import('./ui/components/BackupPanel'))
const LockScreen = lazy(() => import('./ui/components/LockScreen'))

const LoadingFallback = () => (
  <div role="status" aria-live="polite" className="app-loading">
    <div className="app-loading-spinner" />
  </div>
)

type KeyboardCtx = { keyboardOpen: boolean; setKeyboardOpen: (v: boolean) => void; viewportHeight: string }
const KeyboardContext = createContext<KeyboardCtx>({ keyboardOpen: false, setKeyboardOpen: () => {}, viewportHeight: '100dvh' })
export const useKeyboard = () => useContext(KeyboardContext)

function AppContent() {
  const { inRoom } = useRoom()
  const { t, toggleLang } = useI18n()
  const [showBackup, setShowBackup] = useState(false)
  const [locked, setLocked] = useState(true)
  const [securityReady, setSecurityReady] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [viewportHeight, setViewportHeight] = useState('100dvh')

  useEffect(() => {
    securityManager
      .init()
      .then(async () => {
        setLocked(securityManager.isLocked)
        setSecurityReady(true)
        await e2eeManager.init()
      })
      .catch((err) => {
        console.error('[App] Security init failed:', err)
        setSecurityReady(true)
      })

    const unsub = securityManager.onLockChange((isLocked) => {
      setLocked(isLocked)
    })

    const resetTimer = () => securityManager.resetLockTimer()
    document.addEventListener('click', resetTimer)
    document.addEventListener('keydown', resetTimer)

    return () => {
      unsub()
      document.removeEventListener('click', resetTimer)
      document.removeEventListener('keydown', resetTimer)
    }
  }, [])

  // 虚拟键盘检测 — 同时使用 viewport 高度变化和 offsetTop（iOS 键盘上推）
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handleResize = () => {
      const heightRatio = vv.height / window.innerHeight
      const isOpen = heightRatio < 0.75 || vv.offsetTop > 50
      setKeyboardOpen(isOpen)
      // 键盘弹出时，chat-view 高度跟随 visualViewport
      setViewportHeight(isOpen ? `${vv.height}px` : '100dvh')
    }
    vv.addEventListener('resize', handleResize)
    vv.addEventListener('scroll', handleResize)
    return () => {
      vv.removeEventListener('resize', handleResize)
      vv.removeEventListener('scroll', handleResize)
    }
  }, [])

  const handleCreateRoom = async (name: string) => {
    await roomManager.createRoom(name)
  }

  const handleJoinRoom = async (roomId: string) => {
    await roomManager.joinRoom(roomId)
  }

  const handleUnlocked = () => {
    setLocked(false)
  }

  // 安全模块未就绪
  if (!securityReady) {
    return (
      <div role="status" aria-live="polite" className="overlay-enter app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading...</span>
      </div>
    )
  }

  if (locked) {
    return (
      <>
        <Starfield />
        <LockScreen onUnlocked={handleUnlocked} />
      </>
    )
  }

  return (
      <KeyboardContext.Provider value={{ keyboardOpen, setKeyboardOpen, viewportHeight }}>
      <div className="app-root">
        <Starfield />

        {!inRoom ? (
          <RoomPanel onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <ChatView />
          </Suspense>
        )}

        {/* Action bar - top right, safe area aware, hidden when in room */}
        {!keyboardOpen && !inRoom && (
          <div
            className="app-action-bar"
            style={{
              position: 'fixed',
              top: 'calc(var(--safe-top) + 12px)',
              right: '12px',
              display: 'flex',
              gap: '6px',
              zIndex: 50,
            }}
          >
            <button
              onClick={() => securityManager.lock()}
              aria-label={t.security.locked}
              className="app-icon-btn"
              title={t.security.locked}
            >
              🔒
            </button>
            <button
              onClick={toggleLang}
              aria-label={t.nav.switchLang}
              className="app-icon-btn"
            >
              {t.nav.switchLang}
            </button>
          </div>
        )}

        {/* Backup button - hidden when keyboard open or in room */}
        {!keyboardOpen && !inRoom && (
          <button
            onClick={() => setShowBackup(true)}
            className="app-backup-btn"
            title={t.backup.title}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}

        {showBackup && (
          <Suspense fallback={<LoadingFallback />}>
            <BackupPanel onClose={() => setShowBackup(false)} />
          </Suspense>
        )}

        {!inRoom && <InstallPrompt />}
      </div>
    </KeyboardContext.Provider>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
