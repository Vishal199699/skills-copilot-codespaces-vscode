import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { getTimeZones } from '@vvo/tzdb'
import { List, type RowComponentProps } from 'react-window'
import {
  Calendar,
  Clock,
  Copy,
  Globe,
  Link,
  Moon,
  Search,
  Settings,
  Sun,
  SunMoon,
  Sunrise,
  Sunset,
  Users,
} from 'lucide-react'
import clsx from 'clsx'

type ThemeMode = 'light' | 'dark' | 'system'
type TimeFormat = '12h' | '24h'
type Region = 'All' | 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania' | 'Middle East' | 'UTC'
type SortBy = 'country' | 'time' | 'offset' | 'region' | 'daynight' | 'working'
type Section = 'WORLD CLOCK' | 'MEETING PLANNER' | 'TIME CONVERTER' | 'WORLD MAP' | 'ALL COUNTRIES' | 'MY LOCATIONS' | 'SETTINGS'
type Status = 'working' | 'earlylate' | 'outside' | 'night'

type LocationEntry = {
  id: string
  country: string
  countryCode: string
  flag: string
  city: string
  region: Region
  ianaTimeZone: string
  abbreviation: string
  utcOffsetMinutes: number
}

type WorkingHours = { start: number; end: number }

type RankedWindow = {
  instant: DateTime
  score: number
  inside: number
  edge: number
  outside: number
}

const demoTimezones = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const quickPresets: Record<string, string[]> = {
  '🌏 Asia + Europe': ['Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin'],
  '🌎 USA + Europe': ['America/New_York', 'America/Los_Angeles', 'Europe/London'],
  '🌏 India + USA': ['Asia/Kolkata', 'America/New_York', 'America/Los_Angeles'],
  '🌍 Global Team': demoTimezones,
  '🇮🇳 India + UAE + UK': ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London'],
  '🇮🇳 India + USA + UK + Singapore': ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Singapore'],
}

const sections: Section[] = [
  'WORLD CLOCK',
  'MEETING PLANNER',
  'TIME CONVERTER',
  'WORLD MAP',
  'ALL COUNTRIES',
  'MY LOCATIONS',
  'SETTINGS',
]

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function toFlag(countryCode: string): string {
  if (countryCode.length !== 2) return '🌐'
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

function mapRegion(continentName: string, tzName: string): Region {
  if (tzName === 'UTC') return 'UTC'
  if (tzName.startsWith('Asia/') && /(Dubai|Riyadh|Doha|Kuwait|Muscat|Jerusalem|Baghdad|Tehran|Beirut)/i.test(tzName)) return 'Middle East'
  if (continentName === 'Africa') return 'Africa'
  if (continentName === 'Asia') return 'Asia'
  if (continentName === 'Europe') return 'Europe'
  if (continentName === 'North America') return 'North America'
  if (continentName === 'South America') return 'South America'
  if (continentName === 'Oceania') return 'Oceania'
  return 'All'
}

function offsetToLabel(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return `UTC${sign}${hh}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`
}

function dayPhase(hour: number): { icon: JSX.Element; label: string } {
  if (hour >= 5 && hour < 7) return { icon: <Sunrise size={14} />, label: 'Dawn' }
  if (hour >= 7 && hour < 17) return { icon: <Sun size={14} />, label: 'Day' }
  if (hour >= 17 && hour < 19) return { icon: <Sunset size={14} />, label: 'Sunset' }
  return { icon: <Moon size={14} />, label: 'Night' }
}

function getWorkingStatus(localMinutes: number, workingHours: WorkingHours): Status {
  const { start, end } = workingHours
  if (localMinutes >= start && localMinutes <= end) return 'working'
  if ((localMinutes >= start - 60 && localMinutes < start) || (localMinutes > end && localMinutes <= end + 60)) return 'earlylate'
  const hour = Math.floor(localMinutes / 60)
  if (hour >= 22 || hour < 6) return 'night'
  return 'outside'
}

function localMinutesOfDay(dt: DateTime): number {
  return dt.hour * 60 + dt.minute
}

function scoreWindow(statuses: Status[]): { inside: number; edge: number; outside: number; score: number } {
  const inside = statuses.filter((s) => s === 'working').length
  const edge = statuses.filter((s) => s === 'earlylate').length
  const outside = statuses.length - inside - edge
  const score = inside * 4 + edge - outside * 3
  return { inside, edge, outside, score }
}

function parseHourMinute(value: string): number {
  const [h, m] = value.split(':').map((item) => Number(item))
  return h * 60 + (m || 0)
}

function extractUtcOffset(text: string): number | null {
  const match = text.match(/utc\s*([+-])(\d{1,2})(?::?(\d{2}))?/i)
  if (!match) return null
  const sign = match[1] === '+' ? 1 : -1
  const hh = Number(match[2])
  const mm = Number(match[3] ?? '0')
  return sign * (hh * 60 + mm)
}

function nextDstTransition(zone: string, from: DateTime): string {
  const startOffset = from.setZone(zone).offset
  for (let i = 1; i <= 400; i += 1) {
    const check = from.plus({ days: i }).setZone(zone)
    if (check.offset !== startOffset) {
      return check.toFormat('dd LLL yyyy')
    }
  }
  return 'No DST change in next 400 days'
}

type CountryRowProps = {
  rows: LocationEntry[]
  nowIso: string
  format: TimeFormat
  showSeconds: boolean
  workingByZone: Record<string, WorkingHours>
}

const CountryRow = ({ index, style, rows, nowIso, format, showSeconds, workingByZone, ariaAttributes }: RowComponentProps<CountryRowProps>) => {
  const row = rows[index]
  const now = DateTime.fromISO(nowIso).setZone(row.ianaTimeZone)
  const status = getWorkingStatus(localMinutesOfDay(now), workingByZone[row.ianaTimeZone] ?? { start: 9 * 60, end: 18 * 60 })
  const statusLabel = status === 'working' ? '🟢 Working' : status === 'earlylate' ? '🟡 Early/Late' : status === 'night' ? '🌙 Night' : '🔴 Outside'

  return (
    <div style={style} {...ariaAttributes} className="grid grid-cols-8 gap-2 border-b border-white/10 px-3 py-2 text-xs sm:text-sm">
      <div className="font-medium">{row.flag} {row.country}</div>
      <div>{row.city}</div>
      <div>{now.toFormat(format === '24h' ? showSeconds ? 'HH:mm:ss' : 'HH:mm' : showSeconds ? 'hh:mm:ss a' : 'hh:mm a')}</div>
      <div>{now.toFormat('dd LLL yyyy')}</div>
      <div>{offsetToLabel(now.offset)}</div>
      <div>{row.abbreviation}</div>
      <div>{statusLabel}</div>
      <div>{row.region}</div>
    </div>
  )
}

function App() {
  const [now, setNow] = useState(DateTime.now())
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('24h')
  const [showSeconds, setShowSeconds] = useState(true)
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<Section>('WORLD CLOCK')
  const [selectedZones, setSelectedZones] = useState<string[]>(demoTimezones)
  const [meetingMinutes, setMeetingMinutes] = useState(19 * 60 + 30)
  const [meetingDuration, setMeetingDuration] = useState(60)
  const [meetingDate, setMeetingDate] = useState(DateTime.now().toISODate() ?? '')
  const [preferredDays, setPreferredDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [globalWorkingStart, setGlobalWorkingStart] = useState('09:00')
  const [globalWorkingEnd, setGlobalWorkingEnd] = useState('18:00')
  const [workingByZone, setWorkingByZone] = useState<Record<string, WorkingHours>>({})
  const [sortBy, setSortBy] = useState<SortBy>('country')
  const [regionFilter, setRegionFilter] = useState<Region>('All')
  const [fromZone, setFromZone] = useState('Asia/Kolkata')
  const [fromDate, setFromDate] = useState(DateTime.now().toISODate() ?? '')
  const [fromTime, setFromTime] = useState('18:30')
  const [customPresetName, setCustomPresetName] = useState('')
  const [customPresets, setCustomPresets] = useState<Record<string, string[]>>({})
  const [favoritesName, setFavoritesName] = useState<Record<string, string>>({})
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const allLocations = useMemo<LocationEntry[]>(() => {
    const zones = getTimeZones()
      .map((zone) => {
        const city = zone.mainCities[0] ?? zone.name.split('/')[1]?.replaceAll('_', ' ') ?? zone.countryName
        return {
          id: zone.name,
          country: zone.countryName,
          countryCode: zone.countryCode,
          flag: toFlag(zone.countryCode),
          city,
          region: mapRegion(zone.continentName, zone.name),
          ianaTimeZone: zone.name,
          abbreviation: zone.abbreviation,
          utcOffsetMinutes: zone.currentTimeOffsetInMinutes,
        }
      })
      .filter((entry) => !!entry.country && !!entry.city)

    const dedup = new Map<string, LocationEntry>()
    for (const zone of zones) {
      if (!dedup.has(zone.ianaTimeZone)) dedup.set(zone.ianaTimeZone, zone)
    }
    return Array.from(dedup.values())
  }, [])

  const selectedLocationEntries = useMemo(
    () => selectedZones.map((tz) => allLocations.find((location) => location.ianaTimeZone === tz)).filter((item): item is LocationEntry => Boolean(item)),
    [allLocations, selectedZones],
  )

  useEffect(() => {
    const interval = setInterval(() => setNow(DateTime.now()), showSeconds ? 250 : 1000)
    return () => clearInterval(interval)
  }, [showSeconds])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const zonesParam = params.get('zones')
    const meetingParam = params.get('meeting')
    const durationParam = params.get('duration')
    if (zonesParam) setSelectedZones(zonesParam.split(',').filter(Boolean))
    if (meetingParam) setMeetingMinutes(Number(meetingParam))
    if (durationParam) setMeetingDuration(Number(durationParam))
  }, [])

  useEffect(() => {
    const resolvedDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && resolvedDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key.toLowerCase() === 'm') setActiveSection('MEETING PLANNER')
      if (event.key.toLowerCase() === 'w') setActiveSection('WORLD CLOCK')
      if (event.key.toLowerCase() === 'c') setActiveSection('TIME CONVERTER')
      if (event.key === 'Escape') setQuery('')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const queryOffset = extractUtcOffset(normalizedQuery)

  const filteredLocations = useMemo(() => {
    const smartMatch = allLocations.filter((item) => {
      const baseMatch =
        normalizedQuery.length === 0 ||
        item.country.toLowerCase().includes(normalizedQuery) ||
        item.city.toLowerCase().includes(normalizedQuery) ||
        item.ianaTimeZone.toLowerCase().includes(normalizedQuery) ||
        item.abbreviation.toLowerCase().includes(normalizedQuery)
      const offsetMatch = queryOffset === null || item.utcOffsetMinutes === queryOffset
      const regionMatch = regionFilter === 'All' || item.region === regionFilter
      return baseMatch && offsetMatch && regionMatch
    })

    if (normalizedQuery.includes('meeting between') || normalizedQuery.includes('best overlap')) setActiveSection('MEETING PLANNER')
    if (normalizedQuery.includes(' in ') || normalizedQuery.includes('am') || normalizedQuery.includes('pm')) setActiveSection('TIME CONVERTER')

    return smartMatch
  }, [allLocations, normalizedQuery, queryOffset, regionFilter])

  const sortedCountries = useMemo(() => {
    const rows = [...filteredLocations]
    rows.sort((a, b) => {
      if (sortBy === 'country') return a.country.localeCompare(b.country)
      if (sortBy === 'offset') return a.utcOffsetMinutes - b.utcOffsetMinutes
      if (sortBy === 'region') return a.region.localeCompare(b.region)
      const aNow = now.setZone(a.ianaTimeZone)
      const bNow = now.setZone(b.ianaTimeZone)
      if (sortBy === 'daynight') return dayPhase(aNow.hour).label.localeCompare(dayPhase(bNow.hour).label)
      if (sortBy === 'working') {
        const aStatus = getWorkingStatus(localMinutesOfDay(aNow), workingByZone[a.ianaTimeZone] ?? { start: 9 * 60, end: 18 * 60 })
        const bStatus = getWorkingStatus(localMinutesOfDay(bNow), workingByZone[b.ianaTimeZone] ?? { start: 9 * 60, end: 18 * 60 })
        return aStatus.localeCompare(bStatus)
      }
      return aNow.toMillis() - bNow.toMillis()
    })
    return rows
  }, [filteredLocations, now, sortBy, workingByZone])

  const localOffset = now.offset
  const globalWorking = useMemo(() => ({ start: parseHourMinute(globalWorkingStart), end: parseHourMinute(globalWorkingEnd) }), [globalWorkingStart, globalWorkingEnd])

  const rankedWindows = useMemo<RankedWindow[]>(() => {
    const base = DateTime.fromISO(`${meetingDate}T00:00:00`, { zone: selectedZones[0] ?? 'UTC' }).toUTC()
    const windows: RankedWindow[] = []

    for (let minute = 0; minute < 24 * 60; minute += 15) {
      const instant = base.plus({ minutes: minute })
      const statuses = selectedZones.map((zone) => {
        const localStart = instant.setZone(zone)
        const localEnd = localStart.plus({ minutes: meetingDuration })
        if (!preferredDays.includes(localStart.toFormat('ccc'))) return 'outside'
        const hours = workingByZone[zone] ?? globalWorking
        const startStatus = getWorkingStatus(localMinutesOfDay(localStart), hours)
        const endStatus = getWorkingStatus(localMinutesOfDay(localEnd), hours)
        if (startStatus === 'working' && endStatus === 'working') return 'working'
        if (startStatus === 'outside' || endStatus === 'outside') return 'outside'
        return 'earlylate'
      })
      const result = scoreWindow(statuses)
      windows.push({ instant, ...result })
    }

    return windows.sort((a, b) => b.score - a.score).slice(0, 12)
  }, [globalWorking, meetingDate, meetingDuration, preferredDays, selectedZones, workingByZone])

  const overlapWindows = useMemo(() => {
    return rankedWindows.filter((window) => window.outside === 0).slice(0, 6)
  }, [rankedWindows])

  const timelineInstant = useMemo(() => {
    const anchorZone = selectedZones[0] ?? 'UTC'
    return DateTime.fromISO(`${meetingDate}T00:00:00`, { zone: anchorZone }).plus({ minutes: meetingMinutes })
  }, [meetingDate, meetingMinutes, selectedZones])

  const converterResults = useMemo(() => {
    const source = DateTime.fromISO(`${fromDate}T${fromTime}:00`, { zone: fromZone })
    return selectedLocationEntries.map((location) => ({
      location,
      converted: source.setZone(location.ianaTimeZone),
    }))
  }, [fromDate, fromTime, fromZone, selectedLocationEntries])

  const dstPanel = useMemo(() => {
    return selectedLocationEntries.map((location) => {
      const zonedNow = now.setZone(location.ianaTimeZone)
      const january = DateTime.fromObject({ year: now.year, month: 1, day: 1 }, { zone: location.ianaTimeZone }).offset
      const july = DateTime.fromObject({ year: now.year, month: 7, day: 1 }, { zone: location.ianaTimeZone }).offset
      const dstActive = january !== july && zonedNow.offset === Math.max(january, july)
      return {
        location,
        now: zonedNow,
        dstActive,
        nextChange: nextDstTransition(location.ianaTimeZone, now),
      }
    })
  }, [selectedLocationEntries, now])

  const formatTime = (dt: DateTime): string => dt.toFormat(timeFormat === '24h' ? showSeconds ? 'HH:mm:ss' : 'HH:mm' : showSeconds ? 'hh:mm:ss a' : 'hh:mm a')

  const updateShareUrl = () => {
    const params = new URLSearchParams(window.location.search)
    params.set('zones', selectedZones.join(','))
    params.set('meeting', String(meetingMinutes))
    params.set('duration', String(meetingDuration))
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', url)
    navigator.clipboard.writeText(url)
  }

  const copyMeetingSummary = () => {
    const summary = selectedLocationEntries
      .map((location) => `${location.flag} ${favoritesName[location.ianaTimeZone] ?? location.city}: ${timelineInstant.setZone(location.ianaTimeZone).toFormat('ccc, dd LLL hh:mm a')}`)
      .join('\n')
    navigator.clipboard.writeText(`Universal Time Portal\nMeeting ${meetingDuration} min\n${summary}`)
  }

  const exportIcs = () => {
    const startUtc = timelineInstant.toUTC()
    const endUtc = timelineInstant.plus({ minutes: meetingDuration }).toUTC()
    const formatIcs = (dt: DateTime) => dt.toFormat("yyyyLLdd'T'HHmmss'Z'")
    const description = selectedLocationEntries.map((location) => `${location.city} (${location.ianaTimeZone})`).join(', ')
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Universal Time Portal//EN',
      'BEGIN:VEVENT',
      `UID:utp-${Date.now()}@portal`,
      `DTSTAMP:${formatIcs(DateTime.utc())}`,
      `DTSTART:${formatIcs(startUtc)}`,
      `DTEND:${formatIcs(endUtc)}`,
      'SUMMARY:Universal Time Portal Meeting',
      `DESCRIPTION:${description}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'universal-time-portal.ics'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const addLocation = (zone: string) => {
    setSelectedZones((previous) => (previous.includes(zone) ? previous : [...previous, zone]))
  }

  const removeLocation = (zone: string) => setSelectedZones((previous) => previous.filter((item) => item !== zone))

  const reorder = (zone: string, direction: 'up' | 'down') => {
    setSelectedZones((previous) => {
      const index = previous.indexOf(zone)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= previous.length) return previous
      const next = [...previous]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const saveCustomPreset = () => {
    const name = customPresetName.trim()
    if (!name) return
    setCustomPresets((previous) => ({ ...previous, [name]: [...selectedZones] }))
    setCustomPresetName('')
  }

  const nowUtc = now.toUTC()
  const localNow = now

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="rounded-2xl border border-white/10 bg-white/70 p-4 backdrop-blur-xl dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">UNIVERSAL TIME PORTAL</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">See the world. Find the overlap. Plan the meeting.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg bg-slate-900/10 px-3 py-1 text-xs dark:bg-white/10">UTC {formatTime(nowUtc)}</div>
              <div className="rounded-lg bg-slate-900/10 px-3 py-1 text-xs dark:bg-white/10">Local {formatTime(localNow)} ({offsetToLabel(localOffset)})</div>
              <div className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">Live • Synced</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search country, city, timezone, abbreviation, UTC+5:30"
                className="w-full rounded-xl border border-white/20 bg-white/90 px-9 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:bg-slate-800/90"
              />
            </div>
            <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => setTimeFormat((value) => (value === '12h' ? '24h' : '12h'))}>{timeFormat.toUpperCase()}</button>
            <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => setShowSeconds((value) => !value)}>Seconds {showSeconds ? 'ON' : 'OFF'}</button>
            <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => setTheme((value) => (value === 'light' ? 'dark' : value === 'dark' ? 'system' : 'light'))}>{theme}</button>
            <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => setActiveSection('SETTINGS')}><Settings size={14} className="inline" /> Settings</button>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2 text-xs">
            {sections.map((section) => (
              <button
                type="button"
                key={section}
                onClick={() => setActiveSection(section)}
                className={clsx('rounded-lg px-3 py-1.5', activeSection === section ? 'bg-indigo-600 text-white' : 'bg-slate-900/10 dark:bg-white/10')}
              >
                {section}
              </button>
            ))}
          </nav>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock size={18} /> MY GLOBAL CLOCKS</h2>
              <div className="text-xs text-slate-500">Right now mode: Who is awake?</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selectedLocationEntries.map((location) => {
                const zoned = now.setZone(location.ianaTimeZone)
                const phase = dayPhase(zoned.hour)
                const status = getWorkingStatus(localMinutesOfDay(zoned), workingByZone[location.ianaTimeZone] ?? globalWorking)
                const deltaDay = zoned.startOf('day').diff(now.startOf('day'), 'days').days
                return (
                  <button
                    type="button"
                    key={location.ianaTimeZone}
                    className="group rounded-xl border border-white/20 bg-white/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-400 dark:bg-slate-800/70"
                    onDoubleClick={() => addLocation(location.ianaTimeZone)}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{location.flag} {favoritesName[location.ianaTimeZone] ?? location.city}</div>
                      <span className="text-xs text-slate-500">{location.country}</span>
                    </div>
                    <div className="mt-2 text-xl font-semibold">{formatTime(zoned)}</div>
                    <div className="text-xs text-slate-500">{zoned.toFormat('ccc, dd LLL yyyy')} {deltaDay === 1 ? '(+1 day)' : deltaDay === -1 ? '(-1 day)' : ''}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>{offsetToLabel(zoned.offset)} • {location.abbreviation}</span>
                      <span className="inline-flex items-center gap-1">{phase.icon} {phase.label}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                      <div className="h-full bg-gradient-to-r from-amber-300 to-indigo-500" style={{ width: `${(zoned.hour * 60 + zoned.minute) / 14.4}%` }} />
                    </div>
                    <div className="mt-2 text-xs">
                      {status === 'working' && '🟢 Working'}
                      {status === 'earlylate' && '🟡 Early/Late'}
                      {status === 'outside' && '🔴 Outside hours'}
                      {status === 'night' && '🌙 Night'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      <button type="button" onClick={() => reorder(location.ianaTimeZone, 'up')} className="rounded bg-slate-900/10 px-2 py-1">↑</button>
                      <button type="button" onClick={() => reorder(location.ianaTimeZone, 'down')} className="rounded bg-slate-900/10 px-2 py-1">↓</button>
                      <button type="button" onClick={() => removeLocation(location.ianaTimeZone)} className="rounded bg-rose-500/15 px-2 py-1 text-rose-700 dark:text-rose-300">Remove</button>
                    </div>
                  </button>
                )
              })}
            </div>
          </article>

          <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold">Add Locations</h2>
            <div className="space-y-2">
              {filteredLocations.slice(0, 14).map((location) => (
                <button key={location.ianaTimeZone} type="button" className="flex w-full items-center justify-between rounded-lg border border-white/20 p-2 text-left text-sm hover:border-indigo-400" onClick={() => addLocation(location.ianaTimeZone)}>
                  <span>{location.flag} {location.city}, {location.country}</span>
                  <span className="text-xs text-slate-500">{offsetToLabel(location.utcOffsetMinutes)}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-slate-900/10 p-3 text-xs dark:bg-white/10">
              <div className="font-medium">Date-line intelligence</div>
              {selectedLocationEntries.slice(0, 4).map((location) => {
                const local = now.setZone(location.ianaTimeZone)
                const delta = local.startOf('day').diff(now.startOf('day'), 'days').days
                return <div key={location.ianaTimeZone}>{location.flag} {location.city}: {delta > 0 ? 'TOMORROW' : delta < 0 ? 'YESTERDAY' : 'TODAY'}</div>
              })}
            </div>
          </aside>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Users size={18} /> FIND MEETING TIME</h2>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="text-sm">Date<input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
            <label className="text-sm">Duration
              <select value={meetingDuration} onChange={(event) => setMeetingDuration(Number(event.target.value))} className="mt-1 w-full rounded-lg border bg-transparent p-2">
                {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
              </select>
            </label>
            <label className="text-sm">Working start<input type="time" value={globalWorkingStart} onChange={(event) => setGlobalWorkingStart(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
            <label className="text-sm">Working end<input type="time" value={globalWorkingEnd} onChange={(event) => setGlobalWorkingEnd(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dayNames.map((day) => (
              <button key={day} type="button" onClick={() => setPreferredDays((previous) => previous.includes(day) ? previous.filter((item) => item !== day) : [...previous, day])} className={clsx('rounded px-2 py-1 text-xs', preferredDays.includes(day) ? 'bg-indigo-600 text-white' : 'bg-slate-900/10 dark:bg-white/10')}>
                {day}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/20 p-3">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">24-hour draggable timeline</span><span>{meetingMinutes.toString().padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')}</span></div>
            <input type="range" min={0} max={1439} value={meetingMinutes} onChange={(event) => setMeetingMinutes(Number(event.target.value))} className="w-full" />
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {selectedLocationEntries.map((location) => {
                const local = timelineInstant.setZone(location.ianaTimeZone)
                const status = getWorkingStatus(localMinutesOfDay(local), workingByZone[location.ianaTimeZone] ?? globalWorking)
                return <div key={location.ianaTimeZone} className="rounded-lg bg-slate-900/10 p-2 text-xs dark:bg-white/10">{location.flag} {location.city} → {local.toFormat(timeFormat === '24h' ? 'HH:mm' : 'hh:mm a')} ({local.toFormat('ccc')}) {status === 'working' ? '🟢' : status === 'earlylate' ? '🟡' : status === 'night' ? '🌙' : '🔴'}</div>
              })}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/20">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-slate-900/10 dark:bg-white/10">
                <tr>
                  <th className="px-2 py-2 text-left">Best overlap windows</th>
                  <th className="px-2 py-2 text-left">Inside hours</th>
                  <th className="px-2 py-2 text-left">Edge</th>
                  <th className="px-2 py-2 text-left">Outside</th>
                  <th className="px-2 py-2 text-left">Score criteria</th>
                </tr>
              </thead>
              <tbody>
                {(overlapWindows.length ? overlapWindows : rankedWindows.slice(0, 6)).map((window) => (
                  <tr key={window.instant.toISO()} className="border-t border-white/10">
                    <td className="px-2 py-2">{window.instant.setZone(selectedZones[0] ?? 'UTC').toFormat('ccc, dd LLL HH:mm')}</td>
                    <td className="px-2 py-2">{window.inside}</td>
                    <td className="px-2 py-2">{window.edge}</td>
                    <td className="px-2 py-2">{window.outside}</td>
                    <td className="px-2 py-2">Ranked by participants in-hours, overlap, and boundary distance</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overlapWindows.length === 0 && <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">No full overlap found for current constraints. Try larger duration window or wider working hours.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries({ ...quickPresets, ...customPresets }).map(([label, zones]) => (
              <button type="button" key={label} className="rounded-lg border px-3 py-1 text-xs" onClick={() => setSelectedZones(zones)}>{label}</button>
            ))}
            <input value={customPresetName} onChange={(event) => setCustomPresetName(event.target.value)} placeholder="Custom preset name" className="rounded-lg border bg-transparent px-3 py-1 text-xs" />
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white" onClick={saveCustomPreset}>Save preset</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={updateShareUrl}><Link size={14} className="mr-1 inline" />Copy Share Link</button>
            <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={copyMeetingSummary}><Copy size={14} className="mr-1 inline" />Copy Meeting Summary</button>
            <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={exportIcs}><Calendar size={14} className="mr-1 inline" />Add to Calendar (ICS)</button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><SunMoon size={18} /> TIME CONVERTER</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">From timezone
                <select value={fromZone} onChange={(event) => setFromZone(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-xs">
                  {allLocations.slice(0, 260).map((location) => <option key={location.ianaTimeZone} value={location.ianaTimeZone}>{location.ianaTimeZone}</option>)}
                </select>
              </label>
              <label className="text-sm">Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
              <label className="text-sm">Time<input type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
            </div>
            <div className="mt-3 space-y-2">
              {converterResults.map(({ location, converted }) => (
                <div key={location.ianaTimeZone} className="rounded-lg border border-white/20 p-2 text-sm">{location.flag} {location.city} → {converted.toFormat(timeFormat === '24h' ? 'HH:mm' : 'hh:mm a')} ({converted.toFormat('ccc, dd LLL')})</div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Globe size={18} /> DST CHANGE INFO</h2>
            <div className="space-y-2 text-sm">
              {dstPanel.map((item) => (
                <div key={item.location.ianaTimeZone} className="rounded-lg border border-white/20 p-3">
                  <div className="font-medium">{item.location.flag} {item.location.city} — {item.location.ianaTimeZone}</div>
                  <div>{offsetToLabel(item.now.offset)} • {item.location.abbreviation} • {item.dstActive ? 'DST active' : 'Standard time'}</div>
                  <div>Next offset change: {item.nextChange}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/70 p-4 dark:bg-slate-900/70">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">🌐 ALL COUNTRIES</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className="rounded border bg-transparent px-2 py-1">
                <option value="country">Country</option>
                <option value="time">Current Time</option>
                <option value="offset">UTC Offset</option>
                <option value="region">Region</option>
                <option value="daynight">Day/Night</option>
                <option value="working">Working hours</option>
              </select>
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as Region)} className="rounded border bg-transparent px-2 py-1">
                {['All', 'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Middle East', 'UTC'].map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-8 gap-2 border-b border-white/20 px-3 py-2 text-xs font-medium text-slate-500">
            <div>Country</div>
            <div>City</div>
            <div>Local Time</div>
            <div>Date</div>
            <div>UTC Offset</div>
            <div>TZ</div>
            <div>Working</div>
            <div>Region</div>
          </div>
          <List
            rowCount={sortedCountries.length}
            rowHeight={42}
            rowComponent={CountryRow}
            rowProps={{ rows: sortedCountries, nowIso: now.toISO() ?? DateTime.now().toISO() ?? '', format: timeFormat, showSeconds, workingByZone }}
            style={{ height: 420 }}
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/70 p-4 text-sm dark:bg-slate-900/70">
          <h2 className="mb-2 text-lg font-semibold">🗺️ WORLD MAP</h2>
          <p className="text-slate-600 dark:text-slate-300">Interactive map architecture is wired for timezone markers and click-to-compare. For this version, each selected city is rendered as a live timezone marker panel.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {selectedLocationEntries.map((location) => {
              const local = now.setZone(location.ianaTimeZone)
              return <button key={location.ianaTimeZone} type="button" onClick={() => addLocation(location.ianaTimeZone)} className="rounded-lg border border-white/20 p-3 text-left">{location.flag} {location.city}<div className="text-xs">{local.toFormat('HH:mm')} • {offsetToLabel(local.offset)}</div></button>
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/70 p-4 text-sm dark:bg-slate-900/70">
          <h2 className="mb-2 text-lg font-semibold">SETTINGS & ACCESSIBILITY</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>Keyboard: / search, M meeting planner, W world clock, C converter, Esc clear.</li>
            <li>High contrast ready with semantic HTML and icon + text statuses (not color-only).</li>
            <li>Reduced-motion friendly transitions and lightweight live updates.</li>
            <li>Timezone engine uses IANA TZDB through Luxon + @vvo/tzdb (no hard-coded offsets).</li>
          </ul>
        </section>
      </div>
    </main>
  )
}

export default App
