import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api/endpoints'
import { telegramAllowsMessages, telegramWebApp } from '@/lib/telegram'
import { Button } from '@/components/ui/Button'

export function TelegramAlertPermission() {
  const [allowed, setAllowed] = useState(telegramAllowsMessages)
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)
  const resumed = useRef(false)
  const resume = useMutation({ mutationFn: telegramApi.resumeAlerts })
  const app = telegramWebApp()

  useEffect(() => {
    if (allowed && !resumed.current) {
      resumed.current = true
      resume.mutate()
    }
  }, [allowed, resume.mutate])

  if (!app || (allowed && !resume.isError)) return null
  const canRequest = app.requestWriteAccess && (!app.isVersionAtLeast || app.isVersionAtLeast('6.9'))
  return <aside className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900" aria-label="Telegram budget alerts">
    <p className="font-semibold">Enable Telegram budget alerts</p>
    <p className="my-2">Allow the bot to message you when a budget reaches 80%.</p>
    {denied && <p role="status" className="mb-2">Permission was declined. Allow messages or open the bot and press Start.</p>}
    {resume.isError && <p role="alert" className="mb-2">{resume.error.message}</p>}
    {allowed ? <Button onClick={() => resume.mutate()} isLoading={resume.isPending}>Retry budget alerts</Button>
      : canRequest ? <Button isLoading={requesting || resume.isPending} onClick={() => {
        setRequesting(true)
        try {
          app.requestWriteAccess?.((granted) => {
            setRequesting(false)
            setDenied(!granted)
            setAllowed(granted)
          })
        } catch { setRequesting(false); setDenied(true) }
      }}>Enable budget alerts</Button> : null}
    <Link to="/telegram" className="ml-3 underline">Open Telegram settings</Link>
  </aside>
}
