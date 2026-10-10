import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { telegramApi } from '@/lib/api/endpoints'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { LoadingBlock } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'

export default function TelegramPage() {
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
  const error = connect.error ?? disconnect.error
  const endpointMissing = status.error instanceof ApiError && status.error.status === 404
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Telegram alerts</h1>
        <p className="mt-1 text-sm text-slate-500">Receive a message for each new expense covered by a budget and one alert when a budget reaches 80%.</p>
      </div>
      {error && <Alert tone="error" title={error.message} />}
      <Card><CardBody className="space-y-4">
        {status.isPending ? <LoadingBlock label="Checking Telegram connection" /> : status.isError ? (
          <Alert tone="error" title={endpointMissing ? 'Telegram is not available on this server yet.' : 'Could not check Telegram connection.'}>
            <p>{endpointMissing ? 'The service needs to be updated before you can connect Telegram.' : status.error.message}</p>
          </Alert>
        ) : !status.data?.available ? (
          <p className="text-sm text-slate-600">Telegram alerts are not configured yet. Ask your administrator to enable the Telegram bot.</p>
        ) : status.data.connected ? (
          <>
            <p className="text-sm font-medium text-emerald-700">Telegram connected. Budget alerts are enabled.</p>
            <Button variant="secondary" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>Disconnect Telegram</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Connect your private Telegram chat. After opening the bot, press Start to finish connecting.</p>
            <Button onClick={() => connect.mutate()} isLoading={connect.isPending}>{link ? 'Create a new connection link' : 'Connect Telegram'}</Button>
            {link && <div className="space-y-2">
              <a href={link} target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline">Open Telegram and press Start</a>
              <p className="text-xs text-slate-500">This personal connection link expires in 10 minutes. Keep it private.</p>
            </div>}
          </>
        )}
      </CardBody></Card>
      <p className="text-sm text-slate-500">USD expenses count toward USD budgets, and KHR expenses count toward KHR budgets. Expenses outside a budget do not send spending messages. Editing an expense can trigger the 80% alert, but does not send a new spending message.</p>
    </div>
  )
}
