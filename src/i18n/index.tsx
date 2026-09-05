import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import zh, { type Translations } from './zh'
import en from './en'

export type Lang = 'zh' | 'en'

const translations: Record<Lang, Translations> = { zh, en }

interface I18nContextValue {
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

function detectLang(): Lang {
  const stored = localStorage.getItem('nymir-lang') as Lang | null
  if (stored && (stored === 'zh' || stored === 'en')) return stored
  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) return 'zh'
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('nymir-lang', l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh')
  }, [lang, setLang])

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
