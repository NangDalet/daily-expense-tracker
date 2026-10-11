import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { Input, Select } from '@/components/ui/Field'

// Calculate in integer hundredths and round once, matching the server's HALF_UP rule.
function hundredths(value: string): bigint | null {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
function automaticRate(basis: string, rate: string, hours: string): string {
  const wage = hundredths(rate), regularHours = hundredths(hours)
  if (wage === null || wage <= 0n) return ''
  const divisor = basis === 'DAILY' ? regularHours : 100n
  if (divisor === null || divisor <= 0n) return ''
  const numerator = wage * 150n
  const cents = (numerator * 2n + divisor) / (divisor * 2n)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function WorkerWageFields({ defaults }: { defaults?: Record<string, string | number | boolean | null | undefined> }) {
  const { t } = useLanguage()
  const [basis, setBasis] = useState(String(defaults?.rateType ?? 'DAILY'))
  const [rate, setRate] = useState(String(defaults?.rate ?? ''))
  const [hours, setHours] = useState(String(defaults?.hoursPerDay ?? 8))
  const [fixedOvertime, setFixedOvertime] = useState(String(defaults?.rateType === 'FIXED' ? defaults?.overtimeRate ?? 0 : 0))
  const fixed = basis === 'FIXED'
  return <>
    <Input label={t('Position / job type')} value={t('Worker')} readOnly required
      hint={t('Account roles are assigned separately from worker records.')} />
    <input type="hidden" name="position" value="Worker" />
    <Select name="rateType" label={t('Wage basis')} required value={basis} onChange={e => setBasis(e.target.value)}
      options={['DAILY', 'HOURLY', 'FIXED'].map(value => ({ value, label: t(value.charAt(0) + value.slice(1).toLowerCase()) }))} />
    <Input name="rate" label={t('Daily / hourly / fixed rate (KHR)')} type="number" step="0.01" min="0.01" required
      value={rate} onChange={e => setRate(e.target.value)} />
    <Input name="overtimeRate" label={t('Overtime rate per hour (KHR)')} type="number" step="0.01" min="0" required
      readOnly={!fixed} value={fixed ? fixedOvertime : automaticRate(basis, rate, hours)} onChange={e => setFixedOvertime(e.target.value)}
      hint={t(fixed ? 'Fixed wages: enter an agreed overtime rate per hour.' : basis === 'DAILY'
        ? 'Automatic: daily wage ÷ regular hours per day × 1.5.' : 'Automatic: hourly wage × 1.5.')} />
    <Input name="hoursPerDay" label={t('Regular hours per day')} type="number" step="0.01" min="0.01" max="24" required
      value={hours} onChange={e => setHours(e.target.value)} />
  </>
}
