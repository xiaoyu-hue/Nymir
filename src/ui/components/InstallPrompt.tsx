import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const { t } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferred(null)
  }

  const handleDismiss = () => {
    setShow(false)
    setDeferred(null)
  }

  if (!show) return null

  return (
    <div className="install-prompt" role="alert">
      <span className="install-prompt-text">{t.nav?.installApp ?? '安装应用'}</span>
      <button onClick={handleInstall} className="install-prompt-btn">
        {t.nav?.install ?? '安装'}
      </button>
      <button onClick={handleDismiss} className="install-prompt-dismiss" aria-label="关闭">
        ✕
      </button>
    </div>
  )
}
