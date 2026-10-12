import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/client'
import { formatMoney } from '@/lib/utils'
import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'

export const INCOME_REVEAL_MS = 30_000

/** Confirmation is temporary, scoped to this display, and never persisted. */
export function useIncomeVisibility(scope: string) {
  useLanguage()
  const [visible, setVisible] = useState(false)
  const [revealedScope, setRevealedScope] = useState('')
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const hide = useCallback(() => {
    generation.current += 1
    clearTimeout(timer.current)
    setVisible(false)
    setOpen(false)
    setPassword('')
    setError('')
    setPending(false)
  }, [])

  useEffect(() => {
    hide()
    const onVisibilityChange = () => { if (document.hidden) hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      generation.current += 1
      clearTimeout(timer.current)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [hide, scope])

  async function verify() {
    if (pending || !password.trim()) return
    const attempt = ++generation.current
    setPending(true)
    setError('')
    try {
      await authApi.verifyPassword(password)
      // A late response must not unlock a cancelled or backgrounded display.
      if (generation.current !== attempt || document.hidden) return
      setPassword('')
      setOpen(false)
      setRevealedScope(scope)
      setVisible(true)
      timer.current = setTimeout(hide, INCOME_REVEAL_MS)
    } catch (cause) {
      if (generation.current !== attempt) return
      setPassword('')
      setError(cause instanceof ApiError ? cause.message : 'Could not verify password')
    } finally {
      if (generation.current === attempt) setPending(false)
    }
  }

  return {
    visible: visible && revealedScope === scope,
    hide,
    requestReveal: () => { hide(); setOpen(true) },
    dialog: <Modal open={open} onClose={hide} title={t('Show income amount')}
      description={t('Enter your login password. Amounts hide again after 30 seconds.')} size="sm">
      <form onSubmit={(event) => { event.preventDefault(); void verify() }} className="space-y-4">
        <Input label={t('Password')} type="password" autoComplete="current-password" required
          value={password} onChange={(event) => setPassword(event.target.value)} error={error || undefined} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={hide}>{t('Cancel')}</Button>
          <Button type="submit" isLoading={pending} disabled={!password.trim()}>{t('Verify password')}</Button>
        </div>
      </form>
    </Modal>,
  }
}

export function PrivateIncomeAmount({ amount, currency, scope = '' }: {
  amount: number; currency?: string; scope?: string
}) {
  const access = useIncomeVisibility(`${scope}:${currency}:${amount}`)
  return <>
    <span className="inline-flex items-center gap-2">
      {access.visible ? <span>{formatMoney(amount, currency)}</span> :
        <span className="inline-block rounded-lg bg-slate-200/70 px-3 py-1" aria-label={t('Income amount hidden')}>
          <span aria-hidden className="select-none tracking-widest blur-[2px]">••••••</span>
        </span>}
      <button type="button" onClick={access.visible ? access.hide : access.requestReveal}
        aria-label={t(access.visible ? 'Hide income amount' : 'Show income amount')}
        aria-pressed={access.visible}
        className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
        {access.visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </span>
    {access.dialog}
  </>
}
