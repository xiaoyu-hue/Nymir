import { useState } from 'react'
import { roomManager } from './core/room'
import { useRoom } from './ui/hooks/useRoom'
import Starfield from './ui/components/Starfield'
import RoomPanel from './ui/components/RoomPanel'
import ChatView from './ui/components/ChatView'
import BackupPanel from './ui/components/BackupPanel'
import './ui/styles/globals.css'

export default function App() {
  const { inRoom } = useRoom()
  const [showBackup, setShowBackup] = useState(false)

  const handleCreateRoom = async (name: string) => {
    await roomManager.createRoom(name)
  }

  const handleJoinRoom = async (roomId: string) => {
    await roomManager.joinRoom(roomId)
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
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
        title="数据备份"
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
