import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { roomManager } from './core/room'
import { securityManager, e2eeManager } from './security'
import { useRoom } from './ui/hooks/useRoom'
import { I18nProvider, useI18n } from './i18n'
import { error } from './utils/logger'
import Starfield from './ui/components/Starfield'
import RoomPanel from './ui/components/RoomPanel'
import InstallPrompt from './ui/components/InstallPrompt'
import BottomTabBar, { type MainTab } from './ui/components/BottomTabBar'
import SettingsPage from './ui/components/SettingsPage'
import { Plus, TriangleAlert } from 'lucide-react'
import { ToastProvider } from './ui/components/Toast'
import './ui/styles/globals.css'
import './ui/styles/qr.css'

const ChatView = lazy(() => import('./ui/components/ChatView'))
const LockScreen = lazy(() => import('./ui/components/LockScreen'))
import Welcome from './ui/components/Welcome'

const LoadingFallback = () => (
  <div role="status" aria-live="polite" className="app-loading">
    <div className="app-loading-spinner" />
  </div>
)

type KeyboardCtx = { keyboardOpen: boolean; setKeyboardOpen: (v: boolean) => void; viewportHeight: string }
const KeyboardContext = createContext<KeyboardCtx>({ keyboardOpen: false, setKeyboardOpen: () => {}, viewportHeight: '100dvh' })
// eslint-disable-next-line react-refresh/only-export-components
export const useKeyboard = () => useContext(KeyboardContext)

function AppContent() {
  const { inRoom } = useRoom()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<MainTab>('conversation')
  const [locked, setLocked] = useState(true)
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [securityReady, setSecurityReady] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [viewportHeight, setViewportHeight] = useState('100dvh')
  const [identityLoading, setIdentityLoading] = useState(false)
  const [identityError, setIdentityError] = useState(false)
  const [roomError, setRoomError] = useState('')

  useEffect(() => {
    securityManager
      .init()
      .then(async () => {
        setLocked(securityManager.isLocked)
        setSecurityReady(true)
        // 只初始化状态，不生成密钥对。密钥对在解锁后由 loadIdentity() 加载。
        await e2eeManager.init()
      })
      .catch((err) => {
        error('[App] Security init failed:', err)
        setSecurityReady(true)
      })

    const unsub = securityManager.onLockChange(async (isLocked) => {
      setLocked(isLocked)
      if (!isLocked) {
        // 解锁后加载持久化身份密钥——等待完成再显示主界面，
        // 避免用户在密钥未就绪时进房发消息
        setIdentityError(false)
        setIdentityLoading(true)
        try {
          await e2eeManager.loadIdentity()
          if (e2eeManager.getOwnPublicKey() === null) {
            setIdentityError(true)
          }
        } catch (err) {
          error('[App] loadIdentity failed:', err)
          setIdentityError(true)
        } finally {
          setIdentityLoading(false)
        }
      }
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
    setRoomError('')
    try {
      const info = await roomManager.createRoom(name)
      // 通过事件通知 RoomPanel 更新 roomCode
      window.dispatchEvent(new CustomEvent('nymir:roomCreated', { detail: info.id }))
    } catch (err) {
      error('[App] Create room failed:', err)
      setRoomError(t.room.createFailed)
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    setRoomError('')
    try {
      await roomManager.joinRoom(roomId)
    } catch (err) {
      error('[App] Join room failed:', err)
      setRoomError(t.room.joinFailed)
    }
  }

  const handleUnlocked = () => {
    setLocked(false)
  }

  // 安全模块未就绪
  if (!securityReady) {
    return (
      <div role="status" aria-live="polite" className="overlay-enter app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">{t.error.loading}</span>
      </div>
    )
  }

  if (locked) {
    // 首次使用（尚未设置锁屏密码）时，先显示一次性欢迎引导，
    // 点「开始使用」后进入锁屏密码设置，设置完成后 isSetup=true 不再出现
    if (!welcomeDone && !securityManager.isSetup) {
      return (
        <>
          <Starfield />
          <Welcome onDone={() => setWelcomeDone(true)} />
        </>
      )
    }
    return (
      <>
        <Starfield />
        <LockScreen onUnlocked={handleUnlocked} />
      </>
    )
  }

  // 身份密钥加载中：解锁后等待密钥就绪，避免发消息时公钥为空
  if (identityLoading) {
    return (
      <div role="status" aria-live="polite" className="overlay-enter app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">{t.error.loadingIdentity}</span>
      </div>
    )
  }

  // 身份加载失败：提示用户，不能继续使用
  if (identityError) {
    return (
      <div className="overlay-enter app-loading identity-error-card">
        <h2><TriangleAlert size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />{t.error.identityErrorTitle}</h2>
        <p>{t.error.identityErrorDesc}</p>
      </div>
    )
  }

  return (
    <KeyboardContext.Provider value={{ keyboardOpen, setKeyboardOpen, viewportHeight }}>
      <div className="app-root">
        <Starfield />

        {activeTab === 'conversation' ? (
          !inRoom ? (
            <RoomPanel onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} error={roomError} />
          ) : (
            <Suspense fallback={<LoadingFallback />}>
              <ChatView />
            </Suspense>
          )
        ) : (
          <SettingsPage />
        )}

        {!keyboardOpen && !inRoom && (
          <BottomTabBar active={activeTab} onChange={setActiveTab} />
        )}

        {!keyboardOpen && activeTab === 'conversation' && !inRoom && (
          <button
            className="app-fab"
            onClick={() => {
              setActiveTab('conversation')
              window.dispatchEvent(new CustomEvent('nymir:focusCreate'))
            }}
            aria-label={t.nav.newChat}
          >
            <Plus aria-hidden="true" />
          </button>
        )}

        {!inRoom && <InstallPrompt />}
      </div>
    </KeyboardContext.Provider>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </I18nProvider>
  )
}
