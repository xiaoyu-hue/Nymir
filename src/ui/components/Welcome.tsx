import { ServerOff, ShieldCheck, Timer } from 'lucide-react'
import { useI18n } from '../../i18n'

type Props = {
  onDone: () => void
}

/**
 * 首次使用引导页（仅未设置锁屏密码时显示一次）。
 *
 * 用三张特性卡讲清 Nymir 的核心卖点：无服务器 P2P、端到端加密、阅后即焚。
 * 点击「开始使用」后进入锁屏密码设置，之后不再出现。
 */
export default function Welcome({ onDone }: Props) {
  const { t } = useI18n()

  const features = [
    { icon: ServerOff, title: t.welcome.f1Title, desc: t.welcome.f1Desc },
    { icon: ShieldCheck, title: t.welcome.f2Title, desc: t.welcome.f2Desc },
    { icon: Timer, title: t.welcome.f3Title, desc: t.welcome.f3Desc },
  ]

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <h1 className="welcome-title">{t.welcome.title}</h1>
        <p className="welcome-subtitle">{t.welcome.subtitle}</p>
      </div>

      <div className="welcome-features">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="welcome-feature">
            <div className="welcome-feature-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <div className="welcome-feature-text">
              <div className="welcome-feature-title">{title}</div>
              <div className="welcome-feature-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="welcome-cta" onClick={onDone}>
        {t.welcome.cta}
      </button>
      <p className="welcome-hint">{t.welcome.hint}</p>
    </div>
  )
}
