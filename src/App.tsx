import { useState, useEffect } from 'react'
import { roomManager } from './core/room'
import { securityManager, e2eeManager } from './security'
import { useRoom } from './ui/hooks/useRoom'
import { I18nProvider, useI18n } from './i18n'
import Starfield from './ui/components/Starfield'
import RoomPanel from './ui/components/RoomPanel'
import ChatView from './ui/components/ChatView'
import BackupPanel from './ui/components/BackupPanel'
import LockScreen from './ui/components/LockScreen'
import './ui/styles/globals.css'

function AppContent() {
  const { inRoom } = useRoom()
  const { t, toggleLang } = useI18n()
  const [showBackup, setShowBackup] = useState(false)
  const [locked, setLocked] = useState(true)
  const [securityReady, setSecurityReady] = useState(false)

  useEffect(() => {
    securityManager
      .init()
      .then(async () => {
        setLocked(securityManager.isLocked)
        setSecurityReady(true)
        // 初始化 E2EE
        await e2eeManager.init()
      })
      .catch((err) => {
        console.error('[App] Security init failed:', err)
        setSecurityReady(true) // 仍然显示界面，但标记为未锁定
      })

    const unsub = securityManager.onLockChange((isLocked) => {
      setLocked(isLocked)
    })

    // 监听用户交互，重置锁屏计时器
    const resetTimer = () => securityManager.resetLockTimer()
    document.addEventListener('click', resetTimer)
    document.addEventListener('keydown', resetTimer)

    return () => {
      unsub()
      document.removeEventListener('click', resetTimer)
      document.removeEventListener('keydown', resetTimer)
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

  // 安全模块未就绪，显示加载
  if (!securityReady) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          width: '100dvw',
          height: '100dvh',
          background: 'linear-gradient(180deg, #0a0a1a 0%, #12122a 50%, #0a0a1a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(124,106,239,0.2)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.9rem' }}>Loading...</span>
      </div>
    )
  }

  // 锁定状态，显示密码界面
  if (locked) {
    return (
      <>
        <Starfield />
        <LockScreen onUnlocked={handleUnlocked} />
      </>
    )
  }

  return (
    <div
      style={{
        width: '100dvw',
        height: '100dvh',
        background: 'linear-gradient(180deg, #0a0a1a 0%, #12122a 50%, #0a0a1a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Starfield />

      {!inRoom ? (
        <RoomPanel onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : (
        <ChatView />
      )}

      {/* Action bar - top right */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 50,
        }}
      >
        {/* Lock button */}
        <button
          onClick={() => securityManager.lock()}
          aria-label={t.security.locked}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
          title={t.security.locked}
        >
          🔒
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          aria-label={t.nav.switchLang}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          {t.nav.switchLang}
        </button>
      </div>

      {/* Backup button */}
      <button
        onClick={() => setShowBackup(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          transition: 'all 0.2s',
        }}
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

      {showBackup && <BackupPanel onClose={() => setShowBackup(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
