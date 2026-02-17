import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rawData from '../data/vorstoesse.json'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportButtons } from './components/ExportButtons'
import { FiltersPanel } from './components/Filters'
import { ProfileDrawer } from './components/ProfileDrawer'
import { getAllColumnsMeta, TableView } from './components/TableView'
import { i18n, languageNames, type Language } from './i18n'
import { validateVorstoesse, vorstossSchema, type Vorstoss } from './types'
import { applyFilters, defaultFilters, type Filters } from './utils/filtering'
import { clearHashId, getHashId, setHashId } from './utils/urlHash'

const fallbackData = (() => {
  try {
    return validateVorstoesse(rawData)
  } catch {
    if (Array.isArray(rawData)) {
      return rawData
        .map((row) => vorstossSchema.safeParse(row))
        .filter((r) => r.success)
        .map((r) => r.data)
    }
    return []
  }
})()

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

const isSaneLivePayload = (rows: Vorstoss[]) => {
  if (!rows.length) return false
  const placeholderTitles = rows.filter((v) => /^vorstoss\s+\d+$/i.test(String(v.titel || '').trim())).length
  const missingBusinessNo = rows.filter((v) => !String(v.geschaeftsnummer || '').trim()).length
  const sameDateRows = rows.filter((v) => String(v.datumEingereicht || '') === rows[0]?.datumEingereicht).length

  if (placeholderTitles > Math.floor(rows.length * 0.15)) return false
  if (missingBusinessNo > 0) return false
  if (rows.length >= 20 && sameDateRows > Math.floor(rows.length * 0.8)) return false

  return true
}

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
  const [data, setData] = useState<Vorstoss[]>(fallbackData)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Vorstoss | null>(null)
  const [profile, setProfile] = useState<ProfileState>(null)
  const [visibleColumns, setVisibleColumns] = useState<{ key: string; label: string }[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const comboBufferRef = useRef('')
  const comboTimerRef = useRef<number | null>(null)
  const darkModeTimerRef = useRef<number | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const lastSelectedIdRef = useRef<string | null>(null)

  const t = i18n[lang]
  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])
  const visibleData = useMemo(() => data.filter((v) => !hiddenIds.has(v.id)), [data, hiddenIds])
  const filtered = useMemo(() => applyFilters(visibleData, filters), [visibleData, filters])

  useEffect(() => {
    const loadLive = async () => {
      if (!API_BASE) return
      try {
        const res = await fetch(`${API_BASE}/home-data`, { cache: 'no-store' })
        if (!res.ok) return
        const payload = await res.json()
        let parsed: Vorstoss[] = []
        try {
          parsed = validateVorstoesse(payload)
        } catch {
          if (Array.isArray(payload)) {
            parsed = payload
              .map((row) => vorstossSchema.safeParse(row))
              .filter((r) => r.success)
              .map((r) => r.data)
          }
        }
        if (parsed.length >= 20 && Math.abs(parsed.length - fallbackData.length) <= 10 && isSaneLivePayload(parsed)) {
          setData(parsed)
        }
      } catch {
        // keep fallback data
      }
    }

    loadLive()
  }, [])

  useEffect(() => {
    const syncFromHash = () => {
      const id = getHashId()
      if (!id) return
      const hit = data.find((v) => v.id === id)
      if (hit) setSelected(hit)
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [data])

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
    previousFocusRef.current = document.activeElement as HTMLElement | null
    lastSelectedIdRef.current = item.id
    setSelected(item)
    setHashId(item.id)
  }

  const closeDetail = () => {
    const previousFocus = previousFocusRef.current
    const selectedId = lastSelectedIdRef.current

    setSelected(null)
    clearHashId()

    window.requestAnimationFrame(() => {
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus()
        return
      }

      if (selectedId) {
        const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(selectedId) : selectedId
        const fallbackRow = document.querySelector<HTMLElement>(`[data-row-id="${escapedId}"]`)
        fallbackRow?.focus()
      }
    })
  }

  const onVisibleColumnsChange = useCallback((cols: { key: string; label: string }[]) => {
    setVisibleColumns(cols)
  }, [])

  const onFeedbackSubmitted = useCallback((payload: { id: string; irrelevant: boolean }) => {
    if (!payload.irrelevant) return
    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.add(payload.id)
      return next
    })
  }, [])

  const openSubscribe = (context: string) => {
    const subject = encodeURIComponent(`Abo Anfrage: ${context}`)
    const body = encodeURIComponent(`Bitte informiert mich per E-Mail über Updates zu: ${context}`)
    window.open(`mailto:kulturfenster@gmail.com?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer')
  }

  const applyQuickFilter = (field: 'thema' | 'typ' | 'ebene' | 'kanton' | 'region', value: string) => {
    const base = defaultFilters()

    if (field === 'thema') base.themen = [value]
    if (field === 'ebene') base.ebenen = [value as Filters['ebenen'][number]]
    if (field === 'kanton') base.kantone = [value]
    if (field === 'typ') base.globalQuery = value
    if (field === 'region') base.globalQuery = value

    setFilters(base)
    setProfile(null)
    closeDetail()

    window.requestAnimationFrame(() => {
      const overview = document.getElementById('vorstoesse-ueberblick')
      if (overview) {
        overview.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
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
        sectionId="vorstoesse-ueberblick"
        lang={lang}
        t={t}
      />

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} t={t} showExports showShortcutsLink={false} />

      <DetailDrawer
        item={selected}
        onClose={closeDetail}
        onOpenPersonProfile={(name) => setProfile({ kind: 'person', value: name })}
        onOpenPartyProfile={(party) => setProfile({ kind: 'party', value: party })}
        onSubscribe={openSubscribe}
        onQuickFilter={applyQuickFilter}
        onFeedbackSubmitted={onFeedbackSubmitted}
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

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} t={t} showExports={false} showShortcutsLink />
    </main>
  )
}


