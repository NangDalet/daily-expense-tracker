import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { todayIso } from '@/lib/utils'

const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
const iso = (value: Date) => value.toISOString().slice(0, 10)
const monthStart = (value: string) => date(`${value.slice(0, 7)}-01`)

/** Retains native ISO values, validation, form registration and manual date entry. */
export const CalendarInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function CalendarInput(props, ref) {
  const { language } = useLanguage()
  const km = language === 'km'
  const text = (en: string, khmer: string) => km ? khmer : en
  const inputRef = useRef<HTMLInputElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => monthStart(todayIso()))
  const [selected, setSelected] = useState('')
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const monthly = props.type === 'month'
  const disabled = props.disabled || props.readOnly
  // Some browsers lack Khmer Intl data and silently fall back to English.
  const monthNames = km ? ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const number = (value: number) => km ? String(value).replace(/\d/g, digit => '០១២៣៤៥៦៧៨៩'[Number(digit)]) : String(value)
  const format = (value: Date) => km ? `${number(value.getUTCDate())} ${monthNames[value.getUTCMonth()]} ${number(value.getUTCFullYear())}` : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(value)
  function close() { setOpen(false); buttonRef.current?.focus() }
  function allowed(value: string) {
    return (!props.min || value >= String(props.min)) && (!props.max || value <= String(props.max))
  }
  function choose(value: string) {
    const input = inputRef.current
    if (!input || (value && !allowed(value))) return
    // Native setter keeps React's value tracker able to detect the change.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    setSelected(value); close()
  }
  function show() {
    if (disabled) return
    if (open) { close(); return }
    const input = inputRef.current!
    const value = input.value
    const fallback = String(props.min ?? todayIso())
    setSelected(value)
    setMonth(monthStart((value || fallback).slice(0, 7) + '-01'))
    const rect = input.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: Math.max(8, rect.bottom + 8 + 370 > window.innerHeight ? rect.top - 370 : rect.bottom + 8) })
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('[data-selected="true"]:not([disabled]), button[data-day]:not([disabled]), select')?.focus()
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close() }
    }
    function outside(event: PointerEvent) {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target) && !inputRef.current?.contains(target)) setOpen(false)
    }
    function reposition(event: Event) { if (!panelRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true) }
  }, [open])
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const first = new Date(month); first.setUTCDate(1 - first.getUTCDay())
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(first); day.setUTCDate(first.getUTCDate() + index); return day })
  const control = 'rounded-md p-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed'
  return <>
    <input {...props} className={`${props.className ?? ''} app-calendar-input pr-10`} ref={element => {
      inputRef.current = element
      if (typeof ref === 'function') ref(element); else if (ref) ref.current = element
    }} onKeyDown={event => {
      props.onKeyDown?.(event)
      if (!event.defaultPrevented && event.altKey && event.key === 'ArrowDown') { event.preventDefault(); show() }
    }} />
    <button ref={buttonRef} type="button" disabled={disabled} aria-label={text('Open calendar', 'បើកប្រតិទិន')} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
      onClick={show} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"><CalendarDays className="h-4 w-4" /></button>
    {open && <div ref={panelRef} id={panelId} role="dialog" aria-label={text('Calendar', 'ប្រតិទិន')} lang={language}
      style={position} className="fixed z-[100] max-h-[calc(100dvh-16px)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-xl"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        const target = event.target as HTMLElement
        const value = target.dataset.day
        if (!value) return
        const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date(value).getUTCDay(), End: 6 - date(value).getUTCDay() }
        if (!(event.key in offsets)) return
        event.preventDefault()
        const next = date(value); next.setUTCDate(next.getUTCDate() + offsets[event.key])
        if (!allowed(iso(next))) return
        setMonth(monthStart(iso(next)))
        window.setTimeout(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${iso(next)}"]`)?.focus(), 0)
      }}>
      <p className="mb-2 text-center font-semibold" aria-live="polite">{monthNames[month.getUTCMonth()]} {number(month.getUTCFullYear())}</p>
      <div className="mb-2 flex items-center gap-1">
        <button type="button" className={control} aria-label={text('Previous month', 'ខែមុន')} onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 12)))}><ChevronLeft className="h-4 w-4" /></button>
        <select aria-label={text('Calendar month', 'ខែប្រតិទិន')} className="min-w-0 flex-1 rounded border border-slate-300 bg-white p-1" value={month.getUTCMonth()} onChange={e => setMonth(new Date(Date.UTC(month.getUTCFullYear(), Number(e.target.value), 1, 12)))}>{monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
        <input aria-label={text('Calendar year', 'ឆ្នាំប្រតិទិន')} type="number" min="1" max="9999" className="w-20 rounded border border-slate-300 bg-white p-1" value={month.getUTCFullYear()} onChange={e => { const year = Number(e.target.value); if (year >= 100 && year <= 9999) setMonth(new Date(Date.UTC(year, month.getUTCMonth(), 1, 12))) }} />
        <button type="button" className={control} aria-label={text('Next month', 'ខែបន្ទាប់')} onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12)))}><ChevronRight className="h-4 w-4" /></button>
      </div>
      {monthly ? <div className="grid grid-cols-3 gap-1">{monthNames.map((name, index) => {
        const value = `${month.getUTCFullYear()}-${String(index + 1).padStart(2, '0')}`
        return <button key={value} type="button" disabled={!allowed(value)} className={control} aria-pressed={selected === value} onClick={() => choose(value)}>{name}</button>
      })}</div> : <>
        <div className="grid grid-cols-7 text-center text-xs text-slate-500">{(km ? ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហ.', 'សុក្រ', 'សៅរ៍'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(day => <span className="py-2" key={day}>{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-0.5">{days.map(day => {
          const value = iso(day)
          return <button key={value} type="button" data-day={value} data-selected={selected === value} aria-label={format(day)} aria-pressed={selected === value} disabled={!allowed(value)}
            className={`${control} ${selected === value ? 'bg-brand-100 font-semibold text-brand-700' : day.getUTCMonth() === month.getUTCMonth() ? '' : 'text-slate-400'}`} onClick={() => choose(value)}>{number(day.getUTCDate())}</button>
        })}</div>
      </>}
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
        <button type="button" className={control} onClick={() => choose('')}>{text('Clear', 'សម្អាត')}</button>
        <button type="button" className={control} disabled={!allowed(monthly ? todayIso().slice(0, 7) : todayIso())} onClick={() => choose(monthly ? todayIso().slice(0, 7) : todayIso())}>{text('Today', 'ថ្ងៃនេះ')}</button>
        <button type="button" className={control} onClick={close}>{text('Close', 'បិទ')}</button>
      </div>
    </div>}
  </>
})
