import { type ChangeEvent } from 'react'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useLanguage as useConstructionLanguage } from '@/context/LanguageContext'
import { prepareWorkerPhoto } from '@/lib/workerPhoto'

export function WorkerPhotoField({ value, busy, onChange, onBusy, onError, kind = 'photo' }: {
  value: string; busy: boolean; onChange: (value: string) => void
  onBusy: (value: boolean) => void; onError: (message: string) => void
  kind?: 'photo' | 'idCard'
}) {
  const { t } = useConstructionLanguage()
  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    onBusy(true); onError('')
    try { onChange(await prepareWorkerPhoto(file, kind)) }
    catch (error) { onError((error as Error).message) }
    finally { input.value = ''; onBusy(false) }
  }
  return <div className="space-y-3 sm:col-span-2">
    <Input type="file" label={t(kind === 'idCard' ? 'Worker ID card' : 'Worker photo')} accept="image/jpeg,image/png,image/webp" disabled={busy}
      hint={t('Choose a JPG, PNG or WebP image up to 5 MB.')} onChange={event => void selectPhoto(event)} />
    {busy && <p role="status" className="text-sm">{t('Preparing photo…')}</p>}
    {value && <div className="flex items-center gap-4">
      <img src={value} alt={t(kind === 'idCard' ? 'Worker ID card preview' : 'Worker photo preview')} className={kind === 'idCard' ? 'max-h-80 w-full max-w-lg rounded-lg border object-contain' : 'h-24 w-24 rounded-lg border object-cover'} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { onChange(''); onError('') }}>{t(kind === 'idCard' ? 'Remove ID card' : 'Remove photo')}</Button>
    </div>}
  </div>
}
