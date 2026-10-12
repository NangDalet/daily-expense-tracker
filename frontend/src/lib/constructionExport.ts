import type { Payroll, Payment, Project } from './api/construction'
import type { ContentText, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { todayIso } from './utils'
import { constructionText, type ConstructionLanguage } from './constructionLanguage'

function pdfText(text: string): ContentText {
  return { text: text.split(/([\u1780-\u17ff\u19e0-\u19ff\u200b-\u200d]+)/u).filter(Boolean)
    .map(part => ({ text: part, font: /[\u1780-\u17ff\u19e0-\u19ff]/u.test(part) ? 'NotoSansKhmer' : 'Roboto' })) }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
async function pdf(definition: TDocumentDefinitions, name: string) {
  const [{ default: make }, { default: fonts }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  make.addVirtualFileSystem(fonts)
  const url = (name: string) => new URL(import.meta.env.BASE_URL + 'fonts/' + name, window.location.origin).href
  make.addFonts({ NotoSansKhmer: { normal: url('NotoSansKhmer-Regular.ttf'), bold: url('NotoSansKhmer-Bold.ttf'),
    italics: url('NotoSansKhmer-Regular.ttf'), bolditalics: url('NotoSansKhmer-Bold.ttf') } })
  download(await make.createPdf({ ...definition, defaultStyle: { font: 'Roboto', fontSize: 9 } }).getBlob(), name)
}
export function payrollTotals(rows: Payroll[]) {
  const totals = new Map<string, { currency: string; wages: number; paid: number; unpaid: number }>()
  for (const p of rows.filter(p => p.status !== 'CANCELLED')) {
    const t = totals.get(p.currency) ?? { currency: p.currency, wages: 0, paid: 0, unpaid: 0 }
    t.wages += Math.round(p.netPay * 100); t.paid += Math.round(p.paidAmount * 100)
    t.unpaid += Math.round(p.netPay * 100) - Math.round(p.paidAmount * 100); totals.set(p.currency, t)
  }
  return [...totals.values()].map(t => ({ ...t, wages: t.wages / 100, paid: t.paid / 100, unpaid: t.unpaid / 100 }))
}
export async function exportConstruction(rows: Payroll[], projects: Project[], filters: string, format: 'xlsx' | 'pdf', language: ConstructionLanguage = 'en', exportedBy = '') {
  const t = (text: string) => constructionText(language, text)
  if (!rows.length) throw new Error('No payrolls match the selected filters.')
  const headings = ['Reference', 'Worker ID', 'Worker', 'Project', 'Site', 'From', 'To', 'Period', 'Currency', 'Workdays', 'Hours', 'OT hours', 'Base wages', 'Overtime', 'Bonus', 'Allowance', 'Advances', 'Deductions', 'Net pay', 'Paid', 'Balance', 'Status'].map(t)
  const data = rows.map(p => {
    const project = projects.find(project => project.id === p.projectId)
    return [p.reference, p.workerCode, p.workerName, project?.name ?? '', project?.site ?? '', p.fromDate, p.toDate,
      t(p.period), p.currency, p.workdays, p.hours, p.overtimeHours, p.baseWages, p.overtime, p.bonuses, p.allowances,
      p.advances, p.deductions, p.netPay, p.paidAmount, p.status === 'CANCELLED' ? 0 : (Math.round(p.netPay * 100) - Math.round(p.paidAmount * 100)) / 100, t(p.status)]
  })
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs')
    const book = new ExcelJS.Workbook(); book.creator = exportedBy
    const sheet = book.addWorksheet(t('Worker payments'), { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.addRow(headings); data.forEach(row => sheet.addRow(row)); sheet.autoFilter = { from: 'A1', to: 'V' + sheet.rowCount }
    sheet.columns.forEach(column => { column.width = 20 }); sheet.getColumn(1).width = 48
    for (let i = 10; i <= 21; i++) sheet.getColumn(i).numFmt = '#,##0.00'
    sheet.getRow(1).font = { bold: true }
    const summary = book.addWorksheet(t('Summary')); summary.addRow([t('Filters'), filters]); summary.addRow(['Currency', 'Net wages', 'Paid', 'Unpaid'].map(t))
    payrollTotals(rows).forEach(t => summary.addRow([t.currency, t.wages, t.paid, t.unpaid])); summary.columns.forEach(c => { c.width = 30 })
    summary.addRow([t('Exported by'), exportedBy])
    download(new Blob([await book.xlsx.writeBuffer() as BlobPart]), 'worker-payments-' + todayIso() + '.xlsx')
  } else {
    const header: TableCell[] = ['Worker / Reference', 'Project / Site', 'Period', 'Currency', 'Net pay', 'Paid', 'Balance', 'Status'].map(text => ({ ...pdfText(t(text)), bold: true, fillColor: '#e2e8f0' }))
    await pdf({ info: { title: t('Construction worker payment report'), author: exportedBy }, pageOrientation: 'landscape', pageMargins: [25, 25, 25, 25], content: [
      { ...pdfText(t('Construction worker payment report')), fontSize: 18, bold: true },
      { ...pdfText(t('Exported by') + ': ' + exportedBy), margin: [0, 8, 0, 0] },
      { ...pdfText(filters), margin: [0, 8, 0, 12] },
      ...payrollTotals(rows).map(total => ({ ...pdfText(`${total.currency}: ${t('Net wages')} ${total.wages.toFixed(2)} | ${t('Paid')} ${total.paid.toFixed(2)} | ${t('Unpaid')} ${total.unpaid.toFixed(2)}`), margin: [0, 0, 0, 6] as [number, number, number, number] })),
      { table: { headerRows: 1, widths: ['*', '*', 100, 45, 55, 55, 55, 65], body: [header, ...rows.map(p => {
        const project = projects.find(x => x.id === p.projectId)
        return [pdfText(p.workerName + '\n' + p.reference), pdfText((project?.name ?? '') + '\n' + (project?.site ?? '')),
          p.fromDate + '\n' + p.toDate, p.currency, p.netPay.toFixed(2), p.paidAmount.toFixed(2),
          p.status === 'CANCELLED' ? '0.00' : (p.netPay - p.paidAmount).toFixed(2), pdfText(t(p.status))]
      })] } },
      { ...pdfText(t('Cancelled payrolls are excluded from totals. Payrolls are selected by overlapping period dates; paid amounts are cumulative.')), margin: [0, 12, 0, 0] },
    ] }, 'worker-payments-' + todayIso() + '.pdf')
  }
}
export async function exportReceipt(p: Payroll, payments: Payment[], project?: Project, language: ConstructionLanguage = 'en', exportedBy = '') {
  const t = (text: string) => constructionText(language, text)
  const label = (text: string) => pdfText(t(text))
  await pdf({ info: { title: t('Construction worker payment receipt'), author: exportedBy }, pageMargins: [35, 35, 35, 35], content: [
    { ...label('Construction worker payment receipt'), bold: true, fontSize: 18 },
    { ...pdfText(t('Exported by') + ': ' + exportedBy), margin: [0, 8, 0, 0] },
    { ...pdfText(p.workerName + ' (' + p.workerCode + ')'), fontSize: 13, margin: [0, 12, 0, 8] },
    pdfText((project?.name ?? '') + ' / ' + (project?.site ?? '')),
    { ...pdfText(`${p.reference}\n${t('Period')}: ${p.fromDate} – ${p.toDate}\n${t('Status')}: ${t(p.status)}`), margin: [0, 8, 0, 12] },
    { table: { widths: ['*', 100], body: [
      [label('Base wages'), p.baseWages.toFixed(2)], [label('Overtime'), p.overtime.toFixed(2)], [label('Bonuses'), p.bonuses.toFixed(2)],
      [label('Allowances'), p.allowances.toFixed(2)], [label('Advances deducted'), p.advances.toFixed(2)], [label('Other deductions'), p.deductions.toFixed(2)],
      [pdfText(t('Net pay') + ' (' + p.currency + ')'), p.netPay.toFixed(2)], [label('Total paid'), p.paidAmount.toFixed(2)], [label('Remaining'), (p.netPay - p.paidAmount).toFixed(2)],
    ] } },
    { ...label('Payment transactions'), bold: true, margin: [0, 18, 0, 8] },
    { table: { headerRows: 1, widths: ['*', 60, 60, 70, 75], body: [
      ['Reference', 'Date', 'Amount', 'Method', 'Processed by'].map(label),
      ...payments.map(payment => [payment.reference, payment.paymentDate, payment.amount.toFixed(2), label(payment.method), pdfText(payment.processorName)]),
    ] } },
    { ...pdfText(t('Worker signature:') + ' ____________________     ' + t('Administrator:') + ' ____________________'), margin: [0, 30, 0, 0] },
  ] }, p.reference + '-receipt.pdf')
}
