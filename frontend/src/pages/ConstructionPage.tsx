import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardHat, Plus, Download, Printer } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConstructionAccess } from '@/hooks/construction'
import { constructionApi as api, type Attendance, type Payroll, type PayrollRequest } from '@/lib/api/construction'
import { exportConstruction, exportReceipt, payrollTotals } from '@/lib/constructionExport'
import { useLanguage as useConstructionLanguage } from '@/context/LanguageContext'
import { todayIso } from '@/lib/utils'
import { PageHeading } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { WorkerPhotoField } from '@/components/WorkerPhotoField'
import { ConstructionAccessPanel } from '@/components/ConstructionAccessPanel'

type FormKind = 'worker' | 'project' | 'attendance' | 'adjustment' | 'payroll' | 'pay' | 'approve' | 'cancel' | 'remove' | 'history'
interface Dialog { kind: FormKind; id?: string; defaults?: Record<string, string | number | boolean | null | undefined>; payroll?: Payroll; approved?: boolean; requestKey?: string }
const labels = { worker: 'Worker details', project: 'Project and construction site', attendance: 'Record attendance', adjustment: 'Advance or wage adjustment', payroll: 'Prepare payroll', pay: 'Record payment', approve: 'Review adjustment', cancel: 'Cancel unpaid payroll', remove: 'Remove attendance', history: 'Payment history' }
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const choices = (values: string[]) => values.map(value => ({ value, label: value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) }))
function Status({ value }: { value: string }) { const { t } = useConstructionLanguage(); return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{t(value).replaceAll('_', ' ')}</span> }
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const { t } = useConstructionLanguage()
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm">
    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map(h => <th key={h} className="px-4 py-3">{t(h)}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.length ? rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j} className="px-4 py-3 align-top">{cell}</td>)}</tr>) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={headers.length}>{t('No records found.')}</td></tr>}</tbody>
  </table></div>
}
export default function ConstructionPage() {
  return <ConstructionContent />
}
function ConstructionContent() {
  const { t, language, setLanguage } = useConstructionLanguage()
  const { user } = useAuth()
  const access = useConstructionAccess()
  const manager = Boolean(access.data?.manager ?? (access.data?.allowed && access.data?.constructionRole !== 'FOREMAN'))
  const qc = useQueryClient()
  const [tab, setTab] = useState('Workers')
  useEffect(() => { if (access.data && !manager) setTab('Attendance') }, [manager, access.data])
  const [from, setFrom] = useState(todayIso().slice(0, 7) + '-01')
  const [to, setTo] = useState(todayIso())
  const [workerId, setWorkerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<{ request: PayrollRequest; payroll: Payroll } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [workerPhoto, setWorkerPhoto] = useState('')
  const [workerIdCard, setWorkerIdCard] = useState('')
  const [loadingWorker, setLoadingWorker] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [payrollWorker, setPayrollWorker] = useState('')
  const [payrollProject, setPayrollProject] = useState('')
  const [payrollPeriod, setPayrollPeriod] = useState('CUSTOM')
  const [payrollDates, setPayrollDates] = useState({ from, to })
  const filter = { from, to, workerId, projectId }
  const key = ['construction', user?.id]
  const workersQ = useQuery({ queryKey: [...key, 'workers'], queryFn: api.workers })
  const projectsQ = useQuery({ queryKey: [...key, 'projects'], queryFn: api.projects })
  const attendanceQ = useQuery({ queryKey: [...key, 'attendance', filter], queryFn: () => api.attendance(filter), enabled: !!from && !!to && from <= to })
  const adjustmentsQ = useQuery({ queryKey: [...key, 'adjustments'], queryFn: api.adjustments, enabled: manager })
  const payrollsQ = useQuery({ queryKey: [...key, 'payrolls', filter], queryFn: () => api.payrolls(filter), enabled: manager && !!from && !!to && from <= to })
  const grantsQ = useQuery({ queryKey: [...key, 'grants'], queryFn: api.grants, enabled: manager })
  const historyQ = useQuery({ queryKey: [...key, 'payments', dialog?.id], queryFn: () => api.payments(dialog!.id!), enabled: !!dialog?.id && ['history', 'pay'].includes(dialog.kind) })
  const workers = workersQ.data ?? [], projects = projectsQ.data ?? [], payrolls = payrollsQ.data ?? [], attendance = attendanceQ.data ?? []
  const payrollStart = workers.find(w => w.id === payrollWorker)?.startDate ?? todayIso()
  const unpaidQ = useQuery({ queryKey: [...key, 'unpaid-attendance', payrollWorker, payrollProject, payrollStart, todayIso()],
    queryFn: () => api.attendance({ workerId: payrollWorker, projectId: payrollProject, from: payrollStart, to: todayIso() }),
    enabled: dialog?.kind === 'payroll' && payrollPeriod === 'CUSTOM' && !!payrollWorker && !!payrollProject, staleTime: 0 })
  function applyWorkedDates(rows: Attendance[]) {
    const dates = rows.filter(a => !a.payrollId && a.workerId === payrollWorker && a.projectId === payrollProject).map(a => a.workDate).sort()
    setPreview(null)
    if (dates.length) { setPayrollDates({ from: dates[0], to: dates[dates.length - 1] }); setError('') }
    else setError(rows.length ? 'All recorded attendance is already included in payroll. Open the existing payroll to pay its balance.' : 'No unpaid attendance for this worker and site. Record attendance first.')
  }
  useEffect(() => {
    if (dialog?.kind === 'payroll' && payrollPeriod === 'CUSTOM' && unpaidQ.data) applyWorkedDates(unpaidQ.data)
  }, [unpaidQ.data, payrollWorker, payrollProject, payrollPeriod, dialog?.kind])
  const workerName = (id: string) => workers.find(w => w.id === id)?.fullName ?? id
  const visibleWorkers = workers.filter(w => (!projectId || w.projectId === projectId) && (!workerId || w.id === workerId))
  const workerCurrency = (id: string) => workers.find(w => w.id === id)?.currency ?? ''
  const projectName = (id: string) => { const p = projects.find(p => p.id === id); return p ? `${p.name} / ${p.site}` : id }
  const adjustments = (adjustmentsQ.data ?? []).filter(a => !workerId || a.workerId === workerId)
  const totals = payrollTotals(payrolls)
  const outstanding = (adjustmentsQ.data ?? []).filter(a => a.kind === 'ADVANCE' && a.status === 'APPROVED' && !a.payrollId && (!workerId || a.workerId === workerId))
  const mutation = useMutation({ mutationFn: (job: () => Promise<unknown>) => job(), onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ['construction'] }); await qc.invalidateQueries({ queryKey: ['construction-access'] })
    setDialog(null); setPreview(null); setError(''); setNotice('Saved successfully.')
  }, onError: (e: Error) => setError(e.message) })
  function open(d: Dialog) {
    setError(''); setNotice(''); setPreview(null)
    setWorkerPhoto(typeof d.defaults?.photoDataUrl === 'string' ? d.defaults.photoDataUrl : '')
    setWorkerIdCard(typeof d.defaults?.idCardDataUrl === 'string' ? d.defaults.idCardDataUrl : '')
    if (d.kind === 'payroll' || d.kind === 'attendance') {
      const selectedWorker = String(d.defaults?.workerId ?? workerId)
      const selectedProject = String(d.defaults?.projectId ?? (projectId || workers.find(w => w.id === selectedWorker)?.projectId || ''))
      setPayrollWorker(selectedWorker); setPayrollProject(selectedProject); setPayrollPeriod('CUSTOM'); setPayrollDates({ from, to })
    }
    setDialog(d)
  }
  async function editWorker(id: string) {
    setLoadingWorker(id); setError('')
    try { const worker = await api.worker(id); open({ kind: 'worker', id, defaults: { ...worker } }) }
    catch (cause) { setError((cause as Error).message) }
    finally { setLoadingWorker('') }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!dialog || mutation.isPending || photoBusy || (dialog.kind === 'payroll' && unpaidQ.isFetching)) return
    const fd = new FormData(e.currentTarget)
    const text = (name: string) => String(fd.get(name) ?? '')
    const num = (name: string) => Number(text(name))
    const d = dialog
    switch (d.kind) {
      case 'worker': mutation.mutate(() => api.saveWorker({ workerCode: text('workerCode'), fullName: text('fullName'), phone: text('phone'), position: text('position'), rateType: text('rateType'), rate: num('rate'), overtimeRate: num('overtimeRate'), hoursPerDay: num('hoursPerDay'), currency: 'KHR', startDate: text('startDate'), active: text('active') === 'true', photoDataUrl: workerPhoto, projectId: text('projectId'), idCardDataUrl: workerIdCard }, d.id)); break
      case 'project': {
        const startDate = text('startDate'), endDate = text('endDate')
        if ((startDate || endDate) && (!startDate || !endDate || startDate > endDate)) { setError('Select a valid date range'); return }
        mutation.mutate(() => api.saveProject({ name: text('name'), site: text('site'), active: text('active') === 'true', startDate: startDate || null, endDate: endDate || null, plannedAmount: text('plannedAmount') ? num('plannedAmount') : null }, d.id)); break
      }
      case 'attendance': mutation.mutate(() => api.saveAttendance({ workerId: text('workerId'), projectId: text('projectId'), workDate: text('workDate'), kind: text('kind'), hours: text('hours') ? num('hours') : null, overtimeHours: num('overtimeHours') }, d.id)); break
      case 'adjustment': mutation.mutate(() => api.adjustment({ workerId: text('workerId'), kind: text('kind'), amount: num('amount'), adjustmentDate: text('adjustmentDate'), reason: text('reason') })); break
      case 'payroll': {
        const request = { workerId: text('workerId'), projectId: text('projectId'), fromDate: text('fromDate'), toDate: text('toDate'), period: text('period') }
        setExporting(true); setError('')
        try { setPreview({ request, payroll: await api.preview(request) }) } catch (e) { setError((e as Error).message) } finally { setExporting(false) }
        break
      }
      case 'pay': mutation.mutate(() => api.pay(d.id!, { requestKey: d.requestKey, amount: num('amount'), paymentDate: text('paymentDate'), method: text('method') })); break
      case 'approve': mutation.mutate(() => api.approve(d.id!, !!d.approved, text('reason'))); break
      case 'cancel': mutation.mutate(() => api.cancel(d.id!, text('reason'))); break
      case 'remove': mutation.mutate(() => api.removeAttendance(d.id!)); break
    }
  }
  async function exportReport(format: 'pdf' | 'xlsx') {
    setExporting(true); setError('')
    try {
      // Fetch fresh data using the same filters before generating a report.
      const rows = await api.payrolls(filter)
      await exportConstruction(rows, projects, `${from} – ${to} | ${t('Worker')}: ${workerId ? workerName(workerId) : t('All')} | ${t('Project / site')}: ${projectId ? projectName(projectId) : t('All')}`, format, language)
    } catch (e) { setError((e as Error).message) } finally { setExporting(false) }
  }
  async function receipt(p: Payroll) {
    setExporting(true); setError('')
    try { const snapshot = await api.receipt(p.id); await exportReceipt(snapshot.payroll, snapshot.payments, snapshot.project, language) }
    catch (e) { setError((e as Error).message) } finally { setExporting(false) }
  }
  async function createPayroll(request: PayrollRequest) {
    const saved = await api.payroll(request)
    setFrom(saved.fromDate); setTo(saved.toDate); setWorkerId(saved.workerId); setProjectId(saved.projectId); setTab('Payroll')
    return saved
  }
  const workerOptions = workers.filter(w => w.active || w.id === dialog?.defaults?.workerId).map(w => ({ value: w.id, label: `${w.workerCode} · ${w.fullName} (${w.currency})` }))
  const projectOptions = projects.filter(p => p.active || p.id === dialog?.defaults?.projectId).map(p => ({ value: p.id, label: `${p.name} / ${p.site}` }))
  function input(name: string, label: string, type = 'text', fallback: string | number = '', required = true, maxLength?: number) {
    const payrollDate = dialog?.kind === 'payroll' && ['fromDate', 'toDate'].includes(name)
    const dateKey = name === 'fromDate' ? 'from' : 'to'
    return <Input key={name} name={name} label={t(label)} type={type} required={required}
      {...(payrollDate ? { value: payrollDates[dateKey], disabled: unpaidQ.isFetching,
        onChange: (e: ChangeEvent<HTMLInputElement>) => setPayrollDates(d => ({ ...d, [dateKey]: e.target.value })) }
        : { defaultValue: String(dialog?.defaults?.[name] ?? fallback) })}
      step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? (['rate', 'hoursPerDay', 'amount'].includes(name) ? 0.01 : 0) : undefined} maxLength={maxLength} />
  }
  function select(name: string, label: string, options: { value: string; label: string }[], fallback = '') {
    const linked = (dialog?.kind === 'payroll' || dialog?.kind === 'attendance') && ['workerId', 'projectId', 'period'].includes(name)
    return <Select key={name} name={name} label={t(label)} required options={options.map(o => ({ ...o, label: t(o.label) }))} placeholder={t("Select…")}
      {...(linked ? { value: name === 'workerId' ? payrollWorker : name === 'projectId' ? payrollProject : payrollPeriod,
        onChange: (e: ChangeEvent<HTMLSelectElement>) => {
          setError('')
          if (name === 'workerId') { setPayrollWorker(e.target.value); const site = workers.find(w => w.id === e.target.value)?.projectId; if (site && projects.some(p => p.id === site && p.active)) setPayrollProject(site) }
          if (name === 'projectId') setPayrollProject(e.target.value)
          if (name === 'period') setPayrollPeriod(e.target.value)
        } } : { defaultValue: String(dialog?.defaults?.[name] ?? fallback) })} />
  }
  function workerField() { return dialog?.kind === 'attendance' && dialog.id ? <><input type="hidden" name="workerId" value={String(dialog.defaults?.workerId)} /><p className="text-sm">{t('Worker:')} {workerName(String(dialog.defaults?.workerId))}</p></> : select('workerId', 'Worker', workerOptions, workerId) }
  const queries = [workersQ, projectsQ, attendanceQ, ...(manager ? [adjustmentsQ, payrollsQ] : [])]
  const loadError = queries.find(q => q.isError)?.error
  return <div className="space-y-5" lang={language}>
    <PageHeading title={t(manager ? 'Construction worker payments' : 'Worker attendance')} description={t('កម្មករសំណង់ · Workers, attendance, wages and payment records')} action={<div className="flex items-center gap-3"><select aria-label="Language / ភាសា" value={language} onChange={e => setLanguage(e.target.value as 'en' | 'km')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="en">English</option><option value="km">ភាសាខ្មែរ</option></select><HardHat className="h-8 w-8 text-brand-600" /></div>} />
    {(error || loadError) && !dialog && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error || (loadError as Error)?.message || '')} {loadError && <button className="underline" onClick={() => void qc.invalidateQueries({ queryKey: key })}>{t('Retry')}</button>}</div>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{t(notice)}</p>}
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Input label={t('From date')} type="date" value={from} onChange={e => setFrom(e.target.value)} required />
      <Input label={t('To date')} type="date" value={to} onChange={e => setTo(e.target.value)} required />
      <Select label={t('Worker / payment history')} value={workerId} onChange={e => setWorkerId(e.target.value)} options={[{ value: '', label: t('All workers') }, ...workers.map(w => ({ value: w.id, label: w.fullName }))]} />
      <Select label={t('Project / construction site')} value={projectId} onChange={e => setProjectId(e.target.value)} options={[{ value: '', label: t('All projects and sites') }, ...projects.map(p => ({ value: p.id, label: `${p.name} / ${p.site}` }))]} />
    </div>
    {from > to && <p role="alert" className="text-red-600">{t('From date must precede the to date.')}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('Total workers')}</p><p className="text-2xl font-semibold">{workers.length}</p><p className="text-xs text-slate-500">{workers.filter(w => w.active).length} {t('active')}</p></div>
      {manager && ['Net wages', 'Paid', 'Unpaid'].map((label, i) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t(label)} · {t('selected payroll periods')}</p>{totals.length ? totals.map(t => <p key={t.currency} className="mt-1 font-semibold">{money([t.wages, t.paid, t.unpaid][i], t.currency)}</p>) : <p className="mt-1 font-semibold">{t('KHR 0.00')}</p>}</div>)}
    </div>
    <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist" aria-label={t('Construction module')}>
      {(manager ? ['Workers', 'Projects', 'Attendance', 'Adjustments', 'Payroll', 'Reports', 'Access'] : ['Attendance']).map(tabName => <button key={tabName} role="tab" aria-selected={tab === tabName} onClick={() => setTab(tabName)} className={`px-4 py-3 text-sm font-medium ${tab === tabName ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500'}`}>{t(tabName)}</button>)}
    </div>
    {queries.some(q => q.isPending) ? <p role="status">{t('Loading construction records…')}</p> : <>
      {tab === 'Workers' && manager && <><div className="flex justify-end"><Button onClick={() => open({ kind: 'worker' })}><Plus className="h-4 w-4" />{t('Add worker')}</Button></div>
        <Table headers={['Worker', 'Assigned site', 'Contact / job', 'Wage rate', 'Start date', 'ID card', 'Status', 'Actions']} rows={visibleWorkers.map(w => [
          <div className="flex items-center gap-3">{w.photoDataUrl ? <img src={w.photoDataUrl} alt={w.fullName} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100"><HardHat className="h-5 w-5 text-slate-500" /></span>}<div><p className="font-medium">{w.fullName}</p><small>{w.workerCode}</small></div></div>,
          w.projectId ? projectName(w.projectId) : t('Unassigned'), <>{w.phone || '—'}<br />{w.position}</>,
          <>{money(w.rate, w.currency)} / {t(w.rateType)}<br /><small>{t('OT:')} {money(w.overtimeRate, w.currency)}/{t('hour')} · {w.hoursPerDay} {t('hours/day')}</small></>,
          w.startDate, t(w.hasIdCard ? 'Uploaded' : 'Not uploaded'), <Status value={w.active ? 'ACTIVE' : 'INACTIVE'} />,
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!!loadingWorker} isLoading={loadingWorker === w.id} onClick={() => void editWorker(w.id)}>{t('View / edit')}</Button><Button size="sm" variant="ghost" onClick={() => { setWorkerId(w.id); setTab('Payroll') }}>{t('History')}</Button></div>,
        ])} /></>}
      {tab === 'Projects' && <><div className="flex justify-end"><Button onClick={() => open({ kind: 'project' })}>{t('Add project / site')}</Button></div><Table headers={['Project', 'Construction site', 'Duration', 'Planned amount (KHR)', 'Status', 'Actions']} rows={projects.map(p => [p.name, p.site, p.startDate && p.endDate ? <>{p.startDate} / {p.endDate}<br /><small>{Math.round((Date.parse(p.endDate) - Date.parse(p.startDate)) / 86400000) + 1} {t('days')}</small></> : t('Not set'), p.plannedAmount != null ? money(p.plannedAmount, 'KHR') : t('Not set'), <Status value={p.active ? 'ACTIVE' : 'INACTIVE'} />, <Button size="sm" variant="outline" onClick={() => open({ kind: 'project', id: p.id, defaults: { ...p } })}>{t('Edit')}</Button>])} /></>}
      {tab === 'Attendance' && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{attendance.reduce((n, a) => n + Number(a.workdays), 0).toFixed(2)} {t('workdays')} · {attendance.reduce((n, a) => n + Number(a.hours), 0).toFixed(2)} {t('hours')} · {attendance.reduce((n, a) => n + Number(a.overtimeHours), 0).toFixed(2)} {t('overtime hours')}</p><Button onClick={() => open({ kind: 'attendance' })}>{t('Record attendance')}</Button></div>
        <Table headers={['Date', 'Worker', 'Project / site', 'Work', 'Overtime', 'Payroll', 'Actions']} rows={attendance.map(a => [a.workDate, workerName(a.workerId), projectName(a.projectId), <>{t(a.kind)} · {a.hours} {t('hours')}<br /><small>{a.workdays} {t('days')}</small></>, `${a.overtimeHours} ${t('hours')}`, a.payrollId ? t('Locked') : t('Unallocated'), !a.payrollId && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => open({ kind: 'attendance', id: a.id, defaults: { ...a } })}>{t('Edit')}</Button><Button size="sm" variant="ghost" onClick={() => open({ kind: 'remove', id: a.id })}>{t('Remove')}</Button></div>])} /></>}
      {tab === 'Adjustments' && <><div className="flex flex-wrap justify-between gap-3"><p className="text-sm text-slate-500">{t('Outstanding approved advances:')} {money(outstanding.reduce((n, a) => n + Math.round(a.amount * 100), 0) / 100, 'KHR')}</p><Button onClick={() => open({ kind: 'adjustment' })}>{t('Add advance / adjustment')}</Button></div>
        <p className="text-xs text-slate-500">{t('Adjustments show all dates for the selected worker. Approved, unallocated adjustments through the payroll end date are applied to the next payroll, across projects.')}</p>
        <Table headers={['Date / worker', 'Type / amount', 'Reason', 'Approval history', 'Payroll', 'Actions']} rows={adjustments.map(a => [<>{a.adjustmentDate}<br />{workerName(a.workerId)}</>, <>{t(a.kind)}<br />{money(a.amount, workerCurrency(a.workerId))}</>, a.reason, <><Status value={a.status} /><p className="mt-2 text-xs">{t('Created by')} {a.createdBy}<br />{a.approvedBy && <>{t('Reviewed by')} {a.approvedBy}<br />{a.approvedAt?.slice(0, 10)} · {a.approvalReason}</>}</p></>, a.payrollId ? t('Allocated') : t('Outstanding'), a.status === 'PENDING' && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => open({ kind: 'approve', id: a.id, approved: true })}>{t('Approve')}</Button><Button size="sm" variant="ghost" onClick={() => open({ kind: 'approve', id: a.id, approved: false })}>{t('Reject')}</Button></div>])} /></>}
      {['Payroll', 'Reports'].includes(tab) && <><div className="flex flex-wrap justify-between gap-3"><p className="text-sm text-slate-500">{t('Periods overlapping selected dates. Paid amounts are cumulative; cancelled records are excluded from totals.')}</p><div className="flex gap-2">{tab === 'Payroll' && <Button onClick={() => open({ kind: 'payroll' })}>{t('Prepare payroll')}</Button>}<Button variant="outline" disabled={exporting || !payrolls.length || from > to} onClick={() => void exportReport('xlsx')}><Download className="h-4 w-4" />{t('Excel')}</Button><Button variant="outline" disabled={exporting || !payrolls.length || from > to} onClick={() => void exportReport('pdf')}>{t('PDF')}</Button></div></div>
        <Table headers={['Worker / reference', 'Project / site', 'Period', 'Wages', 'Paid / balance', 'Status', 'Actions']} rows={payrolls.map(p => [<><p className="font-medium">{p.workerName}</p><small className="break-all">{p.reference}</small></>, projectName(p.projectId), <>{p.fromDate}<br />{p.toDate}<br /><small>{p.workdays} {t('days')} · {p.overtimeHours} {t('OT hours')}</small></>, money(p.netPay, p.currency), <>{money(p.paidAmount, p.currency)}<br /><small>{t('Balance:')} {money(p.status === 'CANCELLED' ? 0 : p.netPay - p.paidAmount, p.currency)}</small></>, <Status value={p.status} />, <div className="flex flex-wrap gap-2">{['PENDING', 'PARTIALLY_PAID'].includes(p.status) && <Button size="sm" onClick={() => open({ kind: 'pay', id: p.id, payroll: p, requestKey: crypto.randomUUID() })}>{t('Pay')}</Button>}<Button size="sm" variant="outline" onClick={() => open({ kind: 'history', id: p.id, payroll: p })}>{t('Details')}</Button>{p.paidAmount === 0 && p.status !== 'CANCELLED' && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'cancel', id: p.id })}>{t('Cancel')}</Button>}{p.paidAmount > 0 && <Button size="sm" variant="ghost" disabled={exporting} onClick={() => void receipt(p)}><Printer className="h-3 w-3" />{t('Receipt')}</Button>}</div>])} /></>}
      {tab === 'Access' && manager && <>{grantsQ.isError && <p role="alert">{grantsQ.error.message}</p>}<ConstructionAccessPanel grants={grantsQ.data ?? []} projects={projects} superAdmin={!!access.data?.superAdmin} pending={mutation.isPending} onSave={(id, granted, role, sites) => mutation.mutate(() => api.grant(id, granted, role, sites))} /></>}
    </>}
    <Modal open={!!dialog} title={dialog ? t(labels[dialog.kind]) : ''} onClose={() => { if (!mutation.isPending && !exporting && !photoBusy) setDialog(null) }} size="lg">
      {dialog && <form onSubmit={submit} className="space-y-4" onChange={() => { if (preview) setPreview(null) }}>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {dialog.kind === 'worker' && <WorkerPhotoField value={workerPhoto} busy={photoBusy} onChange={setWorkerPhoto} onBusy={setPhotoBusy} onError={setError} />}
          {dialog.kind === 'worker' && <>
            {select('projectId', 'Assigned site', projectOptions, projectId)}
            <WorkerPhotoField kind="idCard" value={workerIdCard} busy={photoBusy} onChange={setWorkerIdCard} onBusy={setPhotoBusy} onError={setError} />
          </>}
          {dialog.kind === 'worker' && <>{input('workerCode', 'Worker ID', 'text', '', true, 40)}{input('fullName', 'Full name', 'text', '', true, 120)}{input('phone', 'Phone', 'tel', '', false, 40)}{input('position', 'Position / job type', 'text', '', true, 80)}{select('rateType', 'Wage basis', choices(['DAILY', 'HOURLY', 'FIXED']), 'DAILY')}{input('rate', 'Daily / hourly / fixed rate (KHR)', 'number')}{input('overtimeRate', 'Overtime rate per hour (KHR)', 'number', 0)}{input('hoursPerDay', 'Regular hours per day', 'number', 8)}<Input label={t('Currency')} value="KHR" readOnly />{input('startDate', 'Start date', 'date', todayIso())}{select('active', 'Status', [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], 'true')}<p className="text-xs text-slate-500">{t('Rate changes apply to new attendance. Fixed rates apply once per project payroll period.')}</p></>}
          {dialog.kind === 'project' && <>{input('name', 'Project name', 'text', '', true, 120)}{input('site', 'Construction site', 'text', '', true, 160)}{input('startDate', 'Project start date', 'date', '', false)}{input('endDate', 'Project end date', 'date', '', false)}{input('plannedAmount', 'Planned amount (KHR)', 'number', '', false)}{select('active', 'Status', [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], 'true')}<p className="text-xs text-slate-500 sm:col-span-2">{t('Optional: choose both dates. Duration includes the start and end dates. The planned amount is the project budget in KHR.')}</p></>}
          {dialog.kind === 'attendance' && <>{workerField()}{select('projectId', 'Project / site', projectOptions, projectId)}{input('workDate', 'Work date', 'date', todayIso())}{select('kind', 'Work type', choices(['FULL', 'HALF', 'HOURLY']), 'FULL')}{input('hours', 'Regular hours (hourly work only)', 'number', '', false)}{input('overtimeHours', 'Overtime hours', 'number', 0)}<p className="text-xs text-slate-500">{t('Full and half days use the worker’s regular hours. One attendance record per worker per date.')}</p></>}
          {dialog.kind === 'adjustment' && <>{workerField()}{select('kind', 'Adjustment type', choices(['ADVANCE', 'DEDUCTION', 'BONUS', 'ALLOWANCE']), 'ADVANCE')}{input('amount', 'Amount (KHR)', 'number')}{input('adjustmentDate', 'Date', 'date', todayIso())}{input('reason', 'Reason', 'text', '', true, 255)}<p className="text-xs text-slate-500">{t('Requires approval before inclusion in payroll. Record advances when money has been given to the worker.')}</p></>}
          {dialog.kind === 'payroll' && <>{workerField()}{select('projectId', 'Project / site', projectOptions, projectId)}{select('period', 'Payment period', [{ value: 'CUSTOM', label: 'Worked days (any date range)' }, ...choices(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'])], 'CUSTOM')}{input('fromDate', 'Period start', 'date', from)}{input('toDate', 'Period end', 'date', to)}<p className="text-xs text-slate-500">{t('Choose any date range to pay all recorded, unpaid worked days together. Days without attendance are not charged. Approved outstanding adjustments through the end date are applied.')}</p></>}
          {dialog.kind === 'pay' && <><p className="sm:col-span-2">{dialog.payroll?.workerName} · {t('Remaining')} {money((dialog.payroll?.netPay ?? 0) - (dialog.payroll?.paidAmount ?? 0), dialog.payroll?.currency ?? '')}</p>{input('amount', 'Payment amount (KHR)', 'number', ((dialog.payroll?.netPay ?? 0) - (dialog.payroll?.paidAmount ?? 0)).toFixed(2))}{input('paymentDate', 'Payment date', 'date', todayIso())}{select('method', 'Payment method', choices(['CASH', 'BANK_TRANSFER', 'QR']), 'CASH')}<p className="text-xs text-slate-500">{t('Partial payments retain the balance. Keep this form open when retrying a failed request to prevent duplicate payment.')}</p></>}
          {dialog.kind === 'approve' && <><p>{dialog.approved ? t('Approve') : t('Reject')} {t('this adjustment?')}</p>{input('reason', 'Review reason', 'text', '', true, 255)}</>}
          {dialog.kind === 'cancel' && <><p>{t('Cancellation releases attendance and adjustments for a replacement payroll.')}</p>{input('reason', 'Cancellation reason', 'text', '', true, 255)}</>}
          {dialog.kind === 'remove' && <p>{t('Remove this unallocated attendance record?')}</p>}
        </div>
        {dialog.kind === 'payroll' && payrollPeriod === 'CUSTOM' && <div>
          {unpaidQ.isFetching ? <p role="status">{t('Loading unpaid worked days…')}</p> : <Button type="button" variant="outline" disabled={!unpaidQ.data || !payrollWorker || !payrollProject} onClick={() => applyWorkedDates(unpaidQ.data ?? [])}>{t('Use all unpaid worked days')}</Button>}
          {unpaidQ.isError && <p role="alert">{t(unpaidQ.error.message)}</p>}
        </div>}
        {preview && <div className="rounded-lg bg-slate-50 p-4"><WageDetails payroll={preview.payroll} /><Button type="button" className="mt-4" isLoading={mutation.isPending} onClick={() => mutation.mutate(() => createPayroll(preview.request))}>{t('Create payroll')}</Button></div>}
        {dialog.kind === 'history' && dialog.payroll && <><WageDetails payroll={dialog.payroll} />{dialog.payroll.cancellationReason && <p>{t('Cancellation:')} {dialog.payroll.cancellationReason}</p>}{historyQ.isPending ? <p>{t('Loading transactions…')}</p> : historyQ.isError ? <p role="alert">{historyQ.error.message}</p> : <Table headers={['Reference', 'Date', 'Amount', 'Method', 'Processed by']} rows={(historyQ.data ?? []).map(p => [<span className="break-all">{p.reference}</span>, p.paymentDate, money(p.amount, dialog.payroll!.currency), t(p.method), p.processorName])} />}{dialog.payroll.paidAmount > 0 && <Button type="button" disabled={exporting} onClick={() => void receipt(dialog.payroll!)}>{t('Download printable receipt')}</Button>}</>}
        {dialog.kind !== 'history' && <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending || exporting || photoBusy} onClick={() => setDialog(null)}>{t('Close')}</Button><Button type="submit" isLoading={mutation.isPending || exporting || photoBusy}>{dialog.kind === 'payroll' ? t('Calculate / refresh preview') : dialog.kind === 'pay' ? t('Record payment') : t('Save')}</Button></div>}
      </form>}
    </Modal>
  </div>
}
function WageDetails({ payroll: p }: { payroll: Payroll }) {
  const { t } = useConstructionLanguage()
  return <div className="space-y-2 text-sm"><p>{p.workdays} {t('workdays')} · {p.hours} {t('hours')} · {p.overtimeHours} {t('overtime hours')}</p><dl className="grid grid-cols-2 gap-2">{[
    ['Base wages', p.baseWages], ['Overtime', p.overtime], ['Bonuses', p.bonuses], ['Allowances', p.allowances], ['Advances', -p.advances], ['Deductions', -p.deductions], ['Net payable', p.netPay], ['Paid', p.paidAmount],
  ].map(([label, amount]) => <div key={String(label)}><dt className="text-slate-500">{t(String(label))}</dt><dd className="font-medium">{money(Number(amount), p.currency)}</dd></div>)}</dl></div>
}
