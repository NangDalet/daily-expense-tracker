import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet } from 'lucide-react'
import { useCashBalances } from '@/hooks/cash'
import { cashApi, type CashTopup, type TopupRequest } from '@/lib/api/cash'
import { CURRENCIES } from '@/lib/api/types'
import { formatMoney, todayIso } from '@/lib/utils'
import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ApiError } from '@/lib/api/client'

export function CashBalancePanel() {
  useLanguage()
  const client = useQueryClient()
  const balances = useCashBalances()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [page, setPage] = useState(0)
  const history = useQuery({ queryKey: ['cash', 'topups', page], queryFn: () => cashApi.topups(page), enabled: historyOpen })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CashTopup | null>(null)
  const [deleting, setDeleting] = useState<CashTopup | null>(null)
  const remove = useMutation({ mutationFn: cashApi.remove, onSuccess: () => {
    setDeleting(null)
    setPage(0)
    void client.invalidateQueries({ queryKey: ['cash'] })
  } })

  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Wallet className="h-4 w-4" aria-hidden />{t('Cash top-up balance')}</h2>
      <Button variant="outline" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="h-4 w-4" aria-hidden />{t('Add top-up')}</Button>
    </div>
    {balances.isPending && <p role="status">{t('Loading cash balance...')}</p>}
    {balances.isError && <Alert tone="error" title={t('Could not load cash balance')}>
      <p>{balances.error.message}</p><Button variant="outline" onClick={() => void balances.refetch()}>{t('Try again')}</Button>
    </Alert>}
    <div className="grid grid-cols-2 gap-4">
      {balances.data?.map((balance, index) => <div key={balance.currency} className={index > 0 ? 'min-w-0 border-l border-slate-200 pl-4' : 'min-w-0'}>
        <p className="text-xs font-medium text-slate-500">{balance.currency}</p>
        <p className="mt-1 break-words text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{formatMoney(balance.remainingAmount, balance.currency)}</p>
        <p className="mt-1 text-xs text-slate-500">{t('Remaining cash')}</p>
      </div>)}
    </div>
    <div className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-200 pt-2">
      <details className="min-w-0 flex-1 text-xs text-slate-500">
        <summary className="w-fit cursor-pointer rounded py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">{t('Balance details')}</summary>
        <div className="space-y-3 pb-2 pt-1">
          {balances.data?.map(balance => <dl key={balance.currency} className="space-y-1">
            <dt className="font-medium text-slate-700">{balance.currency}</dt>
            <div className="flex flex-wrap justify-between gap-1"><dt>{t('Total top-ups')}</dt><dd>{formatMoney(balance.totalTopups, balance.currency)}</dd></div>
            <div className="flex flex-wrap justify-between gap-1"><dt>{t('Spent from top-ups')}</dt><dd>{formatMoney(balance.totalSpent, balance.currency)}</dd></div>
          </dl>)}
          <p>{t('Top-ups are bank withdrawals, not income. USD and KHR balances are separate.')}</p>
        </div>
      </details>
      <Button variant="ghost" size="sm" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>{t(historyOpen ? 'Hide top-up history' : 'Show top-up history')}</Button>
    </div>
    {historyOpen && <div className="space-y-3">
      {history.isPending && <p role="status">{t('Loading top-ups...')}</p>}
      {history.isError && <Alert tone="error" title={t('Could not load top-ups')}><p>{history.error.message}</p>
        <Button variant="outline" onClick={() => void history.refetch()}>{t('Try again')}</Button></Alert>}
      {history.data?.items.length === 0 && <p className="text-sm text-slate-500">{t('No top-ups yet. Add the cash you withdrew from your bank.')}</p>}
      <ul className="divide-y divide-slate-100">
        {history.data?.items.map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div><p className="text-sm font-medium">{formatMoney(entry.amount, entry.currency)} <span className="font-normal text-slate-500">· {entry.topupDate}</span></p>
            {entry.note && <p className="break-words text-sm text-slate-500">{entry.note}</p>}</div>
          <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditing(entry); setFormOpen(true) }}>{t('Edit')}</Button>
            <Button variant="ghost" size="sm" onClick={() => { remove.reset(); setDeleting(entry) }}>{t('Delete')}</Button></div>
        </li>)}
      </ul>
      {history.data && history.data.totalPages > 1 && <Pagination page={page} totalPages={history.data.totalPages} totalElements={history.data.totalElements}
        pageSize={10} onPageChange={setPage} />}
    </div>}
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t(editing ? 'Edit top-up' : 'Add top-up')}
      description={t('Withdraw from your bank, add a top-up, then pay daily expenses from this balance.')} size="md">
      <TopupForm key={editing?.id ?? 'new'} entry={editing} onSuccess={() => { setFormOpen(false); setPage(0) }} onCancel={() => setFormOpen(false)} />
    </Modal>
    <ConfirmDialog open={deleting !== null} title={t('Delete top-up')}
      description={t('Remove this top-up? You can only remove money that has not already been spent.')}
      isPending={remove.isPending} error={remove.error instanceof ApiError ? remove.error : null}
      onConfirm={async () => { if (deleting) { try { await remove.mutateAsync(deleting.id) } catch { /* Dialog shows the error. */ } } }}
      onCancel={() => setDeleting(null)} />
  </Card>
}

function TopupForm({ entry, onSuccess, onCancel }: { entry: CashTopup | null; onSuccess: () => void; onCancel: () => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<TopupRequest>({
    defaultValues: entry ?? { currency: 'USD', topupDate: todayIso(), note: '' },
  })
  const save = useMutation({ mutationFn: (body: TopupRequest) => entry ? cashApi.update(entry.id, body) : cashApi.create(body),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['cash'] }); onSuccess() } })
  return <form className="space-y-4" onSubmit={handleSubmit(async body => {
    try { await save.mutateAsync({ ...body, note: body.note?.trim() || undefined }) } catch { /* Displayed below. */ }
  })}>
    {save.isError && <Alert tone="error" title={save.error.message} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label={t('Amount')} type="number" step="0.01" min="0.01" max="9999999999999.99" inputMode="decimal" required autoFocus
        {...register('amount', { valueAsNumber: true, required: 'Amount is required', min: { value: 0.01, message: 'Amount must be greater than 0' } })} error={errors.amount?.message} />
      <Select label={t('Currency')} options={CURRENCIES.map(value => ({ value, label: value }))} {...register('currency')} />
    </div>
    <Input label={t('Withdrawal date')} type="date" required {...register('topupDate', { required: 'Date is required' })} error={errors.topupDate?.message} />
    <Input label={t('Note')} placeholder={t('ATM withdrawal for daily spending')} maxLength={500} {...register('note')} />
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel} disabled={save.isPending}>{t('Cancel')}</Button>
      <Button type="submit" isLoading={save.isPending}>{t(entry ? 'Save changes' : 'Add top-up')}</Button></div>
  </form>
}
