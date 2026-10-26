import { MessageCircle, Settings as SettingsIcon } from 'lucide-react'
import { useI18n } from '../../i18n'

export type MainTab = 'conversation' | 'settings'

type Props = {
  active: MainTab
  onChange: (tab: MainTab) => void
}

export default function BottomTabBar({ active, onChange }: Props) {
  const { t } = useI18n()
  return (
    <nav className="app-tabbar" aria-label={t.settings.title}>
      <button
        className={`app-tab ${active === 'conversation' ? 'active' : ''}`}
        onClick={() => onChange('conversation')}
        aria-current={active === 'conversation' ? 'page' : undefined}
      >
        <MessageCircle aria-hidden="true" />
        <span>{t.nav.conversation}</span>
      </button>
      <button
        className={`app-tab ${active === 'settings' ? 'active' : ''}`}
        onClick={() => onChange('settings')}
        aria-current={active === 'settings' ? 'page' : undefined}
      >
        <SettingsIcon aria-hidden="true" />
        <span>{t.nav.settings}</span>
      </button>
    </nav>
  )
}
