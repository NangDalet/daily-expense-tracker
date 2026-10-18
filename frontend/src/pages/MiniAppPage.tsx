import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/States'
import { enterMiniApp, leaveMiniApp, telegramWebApp } from '@/lib/telegram'
import '@/components/miniapp/miniapp.css'

export default function MiniAppPage() {
  enterMiniApp()
  const { user, isInitialising, telegramError, login, loginWithTelegram } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  if (isInitialising) return <div className="miniapp-entry"><Spinner /><p>Connecting your account…</p></div>
  if (user) return <Navigate to="/" replace />

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true); setError(null)
    try {
      await login({ username: String(values.get('username')), password: String(values.get('password')) })
      navigate('/', { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed') }
    finally { setBusy(false) }
  }

  async function retry() {
    setBusy(true); setError(null)
    try { await loginWithTelegram(); navigate('/', { replace: true }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed') }
    finally { setBusy(false) }
  }

  return <main className="miniapp-entry">
    <div className="miniapp-entry-logo"><Wallet size={32} /></div>
    <p className="miniapp-eyebrow">DAILY EXPENSE · TELEGRAM</p>
    <h1>Your money.<br />A little closer.</h1>
    <p className="miniapp-entry-copy">Track spending, add income, and stay on budget. All your records, right here in Telegram.</p>
    {telegramWebApp() && <p className="miniapp-entry-copy">Sign in or create an account once. We’ll connect Telegram automatically, so next time you can open the Mini App and go straight in.</p>}
    {(error || telegramError) && <Alert tone="error" title={error || telegramError || ''} />}
    {!telegramWebApp() && <p className="miniapp-entry-copy">Open this page from your bot’s Mini App button for Telegram sign-in, or sign in below to preview.</p>}
    <div className="miniapp-entry-actions">
      {telegramWebApp() && <Button className="w-full" onClick={() => void retry()} isLoading={busy}>Continue with Telegram <ArrowRight size={17} /></Button>}
      {!showLogin ? <Button variant="secondary" className="w-full" onClick={() => setShowLogin(true)}>Sign in to an existing account</Button>
        : <form onSubmit={(event) => void signIn(event)} className="space-y-4 text-left">
          <Input id="miniapp-username" name="username" label="Username or email" autoComplete="username" required />
          <Input id="miniapp-password" name="password" type="password" label="Password" autoComplete="current-password" required />
          <Button type="submit" className="w-full" isLoading={busy}>Sign in</Button>
          <p className="text-center text-sm text-slate-500">New here? <Link className="font-semibold text-brand-600" to="/register">Create an account</Link></p>
        </form>}
    </div>
    <p className="miniapp-entry-note"><ShieldCheck size={16} /> Your existing account. Your existing records.</p>
    {!telegramWebApp() && <button className="text-sm text-slate-500 underline" onClick={leaveMiniApp}>Back to website</button>}
  </main>
}
