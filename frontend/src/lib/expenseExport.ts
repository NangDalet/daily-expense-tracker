import { expenseApi } from '@/lib/api/endpoints'
import type { ExpenseFilterParams, ExpenseResponse } from '@/lib/api/types'
import { paymentMethodLabel, todayIso } from '@/lib/utils'

export type ExpenseExportFormat = 'pdf' | 'xlsx'

interface CurrencyTotal {
  currency: string
  count: number
  amount: number
}

function totalsByCurrency(expenses: ExpenseResponse[]): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>()
  for (const expense of expenses) {
    const total = totals.get(expense.currency) ?? { currency: expense.currency, count: 0, amount: 0 }
    total.count += 1
    // Accumulate cents to avoid binary floating-point errors in report totals.
    total.amount += Math.round(expense.amount * 100)
    totals.set(expense.currency, total)
  }
  return [...totals.values()]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((total) => ({ ...total, amount: total.amount / 100 }))
}

export function describeExportFilters(filter: ExpenseFilterParams, categoryName?: string): string {
  const labels: string[] = []
  if (filter.search) labels.push('Search: ' + filter.search)
  if (filter.categoryId) labels.push('Category: ' + (categoryName ?? 'Selected category'))
  if (filter.fromDate) labels.push('From: ' + filter.fromDate)
  if (filter.toDate) labels.push('To: ' + filter.toDate)
  if (filter.minAmount !== undefined) labels.push('Minimum amount: ' + filter.minAmount)
  if (filter.maxAmount !== undefined) labels.push('Maximum amount: ' + filter.maxAmount)
  if (filter.paymentMethods?.length) labels.push('Payment: ' + filter.paymentMethods.map(paymentMethodLabel).join(', '))
  return labels.length ? labels.join(' | ') : 'All expenses'
}

/** Fetch every matching page using the same authenticated API as the expense list. */
export async function fetchExpensesForExport(
  filter: ExpenseFilterParams,
  onProgress: (loaded: number, total: number) => void,
): Promise<ExpenseResponse[]> {
  const expenses: ExpenseResponse[] = []
  const ids = new Set<string>()
  let page = 0
  let total: number | undefined
  let totalPages = 1

  do {
    const result = await expenseApi.list({ ...filter, page, size: 100 })
    total ??= result.totalElements
    if (result.totalElements !== total) {
      throw new Error('Expenses changed while exporting. Please try again.')
    }
    totalPages = result.totalPages
    for (const expense of result.items) {
      if (ids.has(expense.id)) throw new Error('Expenses changed while exporting. Please try again.')
      ids.add(expense.id)
      expenses.push(expense)
    }
    onProgress(expenses.length, total)
    page += 1
  } while (page < totalPages)

  if (expenses.length === 0) throw new Error('No expenses match the selected filters.')
  if (expenses.length !== total) throw new Error('Expenses changed while exporting. Please try again.')
  return expenses
}

async function createExcel(expenses: ExpenseResponse[], filters: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Daily Expense Tracker'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Expenses', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Payment method', key: 'payment', width: 22 },
    { header: 'Amount', key: 'amount', width: 18 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Tags', key: 'tags', width: 30 },
    { header: 'Receipt URL', key: 'receipt', width: 45 },
  ]
  for (const expense of expenses) {
    // String cells stay plain text, including descriptions beginning with "=".
    sheet.addRow({
      date: new Date(expense.expenseDate + 'T00:00:00.000Z'),
      description: expense.description ?? '',
      category: expense.category?.name ?? 'Uncategorised',
      payment: paymentMethodLabel(expense.paymentMethod),
      amount: expense.amount,
      currency: expense.currency,
      tags: (expense.tags ?? []).join(', '),
      receipt: expense.receiptUrl ?? '',
    })
  }
  sheet.getColumn('date').numFmt = 'yyyy-mm-dd'
  sheet.getColumn('amount').numFmt = '#,##0.00'
  sheet.getColumn('description').alignment = { vertical: 'top', wrapText: true }
  sheet.autoFilter = { from: 'A1', to: 'H' + sheet.rowCount }

  const summary = workbook.addWorksheet('Summary')
  summary.columns = [
    { header: 'Currency', key: 'currency', width: 18 },
    { header: 'Expense count', key: 'count', width: 20 },
    { header: 'Total amount', key: 'amount', width: 24 },
  ]
  summary.addRows(totalsByCurrency(expenses))
  summary.getColumn('amount').numFmt = '#,##0.00'
  summary.addRow([])
  summary.addRow(['Exported', new Date().toISOString()])
  summary.addRow(['Filters', filters])
  summary.getColumn(2).alignment = { wrapText: true }

  for (const worksheet of [sheet, summary]) {
    const header = worksheet.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    header.height = 24
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer).buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

async function createPdf(expenses: ExpenseResponse[], filters: string): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  doc.setProperties({ title: 'Expense report', creator: 'Daily Expense Tracker' })
  doc.setFontSize(18)
  doc.text('Expense report', 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Exported: ' + new Date().toLocaleString() + ' | ' + expenses.length + ' expenses', 14, 23)
  const filterLines: string[] = doc.splitTextToSize('Filters: ' + filters, width - 28)
  doc.text(filterLines, 14, 29)

  autoTable(doc, {
    startY: 32 + filterLines.length * 4,
    margin: { top: 14, right: 14, bottom: 18, left: 14 },
    head: [['Date', 'Description', 'Category', 'Payment method', 'Amount', 'Currency', 'Tags']],
    body: expenses.map((expense) => [
      expense.expenseDate,
      expense.description ?? '',
      expense.category?.name ?? 'Uncategorised',
      paymentMethodLabel(expense.paymentMethod),
      expense.amount.toFixed(2),
      expense.currency,
      (expense.tags ?? []).join(', '),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 35 }, 3: { cellWidth: 32 }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 18 }, 6: { cellWidth: 38 } },
  })

  const tableEnd = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
  autoTable(doc, {
    startY: tableEnd + 8,
    margin: { top: 14, right: 14, bottom: 18, left: 14 },
    tableWidth: 100,
    head: [['Currency', 'Expense count', 'Total amount']],
    body: totalsByCurrency(expenses).map((total) => [total.currency, total.count, total.amount.toFixed(2)]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 2: { halign: 'right' } },
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Page ' + page + ' of ' + pages, width - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
  }
  return doc.output('blob')
}

export async function downloadExpenseExport(
  format: ExpenseExportFormat,
  expenses: ExpenseResponse[],
  filters: string,
): Promise<void> {
  const blob = format === 'xlsx' ? await createExcel(expenses, filters) : await createPdf(expenses, filters)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'expenses-' + todayIso() + '.' + format
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}