import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api/endpoints'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { LoadingBlock } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import { openTelegramLink, telegramWebApp } from '@/lib/telegram'

export default function TelegramPage() {
  useLanguage()
  const [link, setLink] = useState<string | null>(null)
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['telegram'], queryFn: telegramApi.status,
    refetchInterval: (query) => link && !query.state.data?.connected ? 3000 : false,
  })
  const connect = useMutation({
    mutationFn: telegramApi.link,
    onSuccess: (result) => setLink(result.url),
  })
  const disconnect = useMutation({
    mutationFn: telegramApi.disconnect,
    onSuccess: async () => { setLink(null); await client.invalidateQueries({ queryKey: ['telegram'] }) },
  })
  const resume = useMutation({ mutationFn: telegramApi.resumeAlerts })
  const error = connect.error ?? disconnect.error ?? resume.error
  const endpointMissing = status.error instanceof ApiError && status.error.status === 404
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("Telegram alerts")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('Receive one alert when a budget reaches 80% or more. No spending alerts are sent below 80%.')}</p>
      </div>
      {error && <Alert tone="error" title={error.message} />}
      <Card><CardBody className="space-y-4">
        {status.isPending ? <LoadingBlock label={t("Checking Telegram connection")} /> : status.isError ? (
          <Alert tone="error" title={endpointMissing ? t("Telegram is not available on this server yet.") : t("Could not check Telegram connection.")}>
            <p>{endpointMissing ? t("The service needs to be updated before you can connect Telegram.") : status.error.message}</p>
          </Alert>
        ) : !status.data?.available ? (
          <p className="text-sm text-slate-600">{t("Telegram alerts are not configured yet. Ask your administrator to enable the Telegram bot.")}</p>
        ) : status.data.connected ? (
          <>
            <p className="text-sm font-medium text-emerald-700">Telegram account connected.</p>
            <p className="text-sm text-slate-600">The bot needs permission to send alerts. Enable messages in the Mini App, or open the bot and press Start. Then check for any missed alerts.</p>
            <Button variant="secondary" onClick={() => connect.mutate()} isLoading={connect.isPending}>Open bot connection</Button>
            {link && <a href={link} target="_blank" rel="noreferrer" onClick={(event) => {
              if (telegramWebApp()) { event.preventDefault(); openTelegramLink(link) }
            }} className="block font-medium text-brand-600 underline">Open Telegram and press Start</a>}
            <Button variant="secondary" onClick={() => resume.mutate()} isLoading={resume.isPending}>Check missed budget alerts</Button>
            {resume.isSuccess && <p role="status" className="text-sm text-emerald-700">Checked this month's budgets. Unsent alerts at 80% or more are queued; delivered alerts will not repeat.</p>}
            <Button variant="secondary" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>{t("Disconnect Telegram")}</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">{t("Connect your private Telegram chat. After opening the bot, press Start to finish connecting.")}</p>
            <Button onClick={() => connect.mutate()} isLoading={connect.isPending}>{link ? t("Create a new connection link") : t("Connect Telegram")}</Button>
            {link && <div className="space-y-2">
              <a href={link} target="_blank" rel="noreferrer" onClick={(event) => {
                if (telegramWebApp()) { event.preventDefault(); openTelegramLink(link) }
              }} className="font-medium text-brand-600 underline">{t("Open Telegram and press Start")}</a>
              <p className="text-xs text-slate-500">{t("This personal connection link expires in 10 minutes. Keep it private.")}</p>
            </div>}
          </>
        )}
      </CardBody></Card>
      <Card><CardBody className="space-y-2">
        <h2 className="font-semibold text-slate-900">Telegram Mini App</h2>
        <p className="text-sm text-slate-500">Open the Mini App and sign in once to connect Telegram automatically. Future launches sign you in directly.</p>
        <a href="/miniapp" className="inline-block text-sm font-semibold text-brand-600 underline">Open Mini App</a>
      </CardBody></Card>
      <p className="text-sm text-slate-500">{t('USD and KHR expenses count toward every budget at 1 USD = 4,000 KHR. Each budget alerts once per month when spending reaches at least 80%, including after an expense is edited.')}</p>
    </div>
  )
}
