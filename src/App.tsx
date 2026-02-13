import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rawData from '../data/vorstoesse.json'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportButtons } from './components/ExportButtons'
import { FiltersPanel } from './components/Filters'
import { ProfileDrawer } from './components/ProfileDrawer'
import { getAllColumnsMeta, TableView } from './components/TableView'
import { i18n, languageNames, type Language } from './i18n'
import { validateVorstoesse, type Vorstoss } from './types'
import { applyFilters, defaultFilters, type Filters } from './utils/filtering'
import { clearHashId, getHashId, setHashId } from './utils/urlHash'

const data = validateVorstoesse(rawData)

type ProfileState =
  | { kind: 'person'; value: string }
  | { kind: 'party'; value: string }
  | null

export default function App() {
  const [lang, setLang] = useState<Language>('de')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [selected, setSelected] = useState<Vorstoss | null>(null)
  const [profile, setProfile] = useState<ProfileState>(null)
  const [visibleColumns, setVisibleColumns] = useState<{ key: string; label: string }[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const comboBufferRef = useRef('')
  const comboTimerRef = useRef<number | null>(null)
  const darkModeTimerRef = useRef<number | null>(null)

  const t = i18n[lang]
  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])
  const filtered = useMemo(() => applyFilters(data, filters), [filters])

  useEffect(() => {
    const id = getHashId()
    if (!id) return
    const hit = data.find((v) => v.id === id)
    if (hit) setSelected(hit)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('tierpolitik.theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tierpolitik.theme', theme)
  }, [theme])

  useEffect(() => {
    setVisibleColumns(allColumnsMeta.slice(0, 8))
  }, [allColumnsMeta])

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape') {
        if (selected) {
          setSelected(null)
          clearHashId()
          event.preventDefault()
        }
        if (profile) {
          setProfile(null)
          event.preventDefault()
        }
        return
      }

      if (isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()

      if (key === 'w') {
        setTheme('light')
        event.preventDefault()
        return
      }

      if (key.length === 1 && ['d', 'e', 'f', 'r', 'i', 't', 'n'].includes(key)) {
        comboBufferRef.current = (comboBufferRef.current + key).slice(-2)

        if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current)
        comboTimerRef.current = window.setTimeout(() => {
          comboBufferRef.current = ''
        }, 550)

        if (comboBufferRef.current === 'de') {
          if (darkModeTimerRef.current) window.clearTimeout(darkModeTimerRef.current)
          setLang('de')
          comboBufferRef.current = ''
          event.preventDefault()
          return
        }
        if (comboBufferRef.current === 'fr') {
          setLang('fr')
          comboBufferRef.current = ''
          event.preventDefault()
          return
        }
        if (comboBufferRef.current === 'it') {
          setLang('it')
          comboBufferRef.current = ''
          event.preventDefault()
          return
        }
        if (comboBufferRef.current === 'en') {
          setLang('en')
          comboBufferRef.current = ''
          event.preventDefault()
          return
        }

        if (key === 'd') {
          if (darkModeTimerRef.current) window.clearTimeout(darkModeTimerRef.current)
          darkModeTimerRef.current = window.setTimeout(() => {
            setTheme('dark')
            comboBufferRef.current = ''
          }, 320)
          event.preventDefault()
          return
        }
      }

      if (event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (selected || profile) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current)
      if (darkModeTimerRef.current) window.clearTimeout(darkModeTimerRef.current)
    }
  }, [selected, profile])

  const openDetail = (item: Vorstoss) => {
    setSelected(item)
    setHashId(item.id)
  }

  const closeDetail = () => {
    setSelected(null)
    clearHashId()
  }

  const onVisibleColumnsChange = useCallback((cols: { key: string; label: string }[]) => {
    setVisibleColumns(cols)
  }, [])

  const openSubscribe = (context: string) => {
    const subject = encodeURIComponent(`Abo Anfrage: ${context}`)
    const body = encodeURIComponent(`Bitte informiert mich per E-Mail über Updates zu: ${context}`)
    window.open(`mailto:kulturfenster@gmail.com?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="container">
      <header className="hero-head">
        <div className="hero-top row">
          <div className="language-switch row">
            <div className="chips">
              {(Object.keys(languageNames) as Language[]).map((code) => (
                <button key={code} className={lang === code ? 'chip active' : 'chip'} type="button" onClick={() => setLang(code)}>
                  {languageNames[code]}
                </button>
              ))}
              <span className="switch-sep">|</span>
              <button className={theme === 'light' ? 'chip active' : 'chip'} type="button" onClick={() => setTheme('light')}>WHITE</button>
              <button className={theme === 'dark' ? 'chip active' : 'chip'} type="button" onClick={() => setTheme('dark')}>DARK</button>
            </div>
          </div>
        </div>
        <div className="title-row">
          <img className="hero-monitor-logo logo-light" src="/branding/monitor-icon-light.png" alt="Tierpolitik Monitor" />
          <img className="hero-monitor-logo logo-dark" src="/branding/monitor-icon.png" alt="Tierpolitik Monitor" />
          <h1>{t.title}</h1>
        </div>
        <p className="brand-sub">{t.subtitle}</p>
      </header>

      <FiltersPanel data={data} filters={filters} onChange={setFilters} lang={lang} t={t} searchInputRef={searchInputRef} />

      <section className="db-intro">
        <h2>{t.dbIntroTitle}</h2>
        <p>{t.dbIntroSubtitle}</p>
      </section>

      <TableView
        data={filtered}
        onOpenDetail={openDetail}
        onVisibleColumnsChange={onVisibleColumnsChange}
        keyboardEnabled={!selected && !profile}
        lang={lang}
        t={t}
      />

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} t={t} />

      <DetailDrawer
        item={selected}
        onClose={closeDetail}
        onOpenPersonProfile={(name) => setProfile({ kind: 'person', value: name })}
        onOpenPartyProfile={(party) => setProfile({ kind: 'party', value: party })}
        onSubscribe={openSubscribe}
        lang={lang}
        t={t}
      />

      <ProfileDrawer
        profile={profile}
        data={data}
        lang={lang}
        onClose={() => setProfile(null)}
        onOpenDetail={(item) => {
          setProfile(null)
          openDetail(item)
        }}
        onSubscribe={openSubscribe}
      />

      <footer className="site-footer panel">
        <div className="site-header-top">
          <div>
            <a href="https://www.tierimfokus.ch" target="_blank" rel="noopener noreferrer" className="site-brand" aria-label="Tier im Fokus">
              <img src="/branding/TIF_Logo_Button.png" alt="Tier im Fokus" />
              <strong>tier im fokus</strong>
            </a>
            <p className="footer-blurb">Tier im Fokus (TIF) wurde 2025 als erste Tierrechtsorganisation der Schweiz in ein Parlament gewählt und vertritt seither die Interessen der Tiere im <a href="https://tierimfokus.ch/stadtrat" target="_blank" rel="noopener noreferrer">Berner Stadtrat</a>. Dieses Projekt soll die Tierpolitik schweizweit sichtbar machen und fördern.</p>
          </div>

          <nav className="site-nav" aria-label="Tier im Fokus Links">
            <a href="https://www.tierimfokus.ch/medien" target="_blank" rel="noopener noreferrer">Medien</a>
            <a href="https://www.tierimfokus.ch/kontakt" target="_blank" rel="noopener noreferrer">Kontakt</a>
            <a href="https://www.tierimfokus.ch/newsletter" target="_blank" rel="noopener noreferrer">Newsletter</a>
            <a href="https://www.tierimfokus.ch/spenden" target="_blank" rel="noopener noreferrer">Spenden</a>
          </nav>
        </div>

        <div className="site-support-row">
          <span className="support-label">Mit Unterstützung von</span>
          <div className="support-logos" aria-label="Demo-Partnerlogos">
            <img className="support-logo-img" src="/branding/demo-org-tierschutz.jpg" alt="Demo Orga Tierschutz" />
            <img className="support-logo-img" src="/branding/demo-org-tierschutz.jpg" alt="Demo Orga Tierschutz" />
            <img className="support-logo-img" src="/branding/demo-org-tierschutz.jpg" alt="Demo Orga Tierschutz" />
          </div>
        </div>
      </footer>
    </main>
  )
}


