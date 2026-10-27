import { useState } from 'react'
import { Lock, Languages, Database, Radio, ShieldCheck, Fingerprint, ChevronRight, Info } from 'lucide-react'
import { securityManager } from '../../security'
import { useI18n } from '../../i18n'
import BackupPanel from './BackupPanel'
import SignalingSettings from './SignalingSettings'
import OutOfBandVerify from './OutOfBandVerify'
import BottomSheet from './BottomSheet'

export default function SettingsPage() {
  const { t, toggleLang } = useI18n()
  const [showBackup, setShowBackup] = useState(false)
  const [showSignaling, setShowSignaling] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)

  return (
    <div className="page-enter settings-page">
      <h1 className="settings-page-title">{t.settings.title}</h1>

      <div className="settings-group">
        <button
          className="settings-row"
          onClick={() => securityManager.lock()}
          aria-label={t.settings.lockNow}
        >
          <Lock className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.lockNow}</span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
        <button
          className="settings-row"
          onClick={toggleLang}
          aria-label={t.settings.language}
        >
          <Languages className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.language}</span>
          <span className="settings-row-value">{t.nav.switchLang}</span>
        </button>
      </div>

      <div className="settings-group">
        <button
          className="settings-row"
          onClick={() => setShowBackup(true)}
          aria-label={t.settings.backup}
        >
          <Database className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.backup}</span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
        <button
          className="settings-row"
          onClick={() => setShowSignaling(true)}
          aria-label={t.settings.signaling}
        >
          <Radio className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.signaling}</span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="settings-group">
        <button
          className="settings-row"
          onClick={() => setShowIdentity(true)}
          aria-label={t.settings.identity}
        >
          <Fingerprint className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.identity}</span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="settings-group">
        <button
          className="settings-row"
          onClick={() => setShowAbout(true)}
          aria-label={t.settings.about}
        >
          <ShieldCheck className="settings-row-icon" aria-hidden="true" />
          <span className="settings-row-label">{t.settings.about}</span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
      </div>

      <p className="settings-version">Nymir · AGPL-3.0</p>

      <BackupPanel open={showBackup} onClose={() => setShowBackup(false)} />
      <SignalingSettings open={showSignaling} onClose={() => setShowSignaling(false)} />
      <OutOfBandVerify open={showIdentity} onClose={() => setShowIdentity(false)} />

      <BottomSheet open={showAbout} onClose={() => setShowAbout(false)} title={t.settings.aboutTitle}>
        <div className="settings-about">
          <p className="settings-about-body">
            <Info className="settings-about-icon" aria-hidden="true" />
            {t.settings.aboutBody}
          </p>
          <p className="settings-about-privacy">{t.settings.privacy}</p>
        </div>
      </BottomSheet>
    </div>
  )
}
