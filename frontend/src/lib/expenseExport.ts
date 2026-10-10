import { expenseApi } from '@/lib/api/endpoints'
import type { ExpenseFilterParams, ExpenseResponse } from '@/lib/api/types'
import type { ContentText, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
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
    // Excel stores Unicode strings; select a font with Khmer and Latin glyphs.
    worksheet.eachRow((row) => {
      row.font = { name: 'Khmer OS', size: 11 }
      row.alignment = { vertical: 'top', wrapText: true }
    })
    worksheet.properties.defaultRowHeight = 28
    const header = worksheet.getRow(1)
    header.font = { name: 'Khmer OS', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    header.height = 24
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer).buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Separate scripts so Latin prefixes do not disable Khmer's OpenType shaping. */
function pdfText(text: string): ContentText {
  return {
    text: text.split(/([\u1780-\u17ff\u19e0-\u19ff\u200b-\u200d]+)/u)
      .filter(Boolean)
      .map((part) => ({ text: part, font: /[\u1780-\u17ff\u19e0-\u19ff]/u.test(part) ? 'NotoSansKhmer' : 'Roboto' })),
  }
}

async function createPdf(expenses: ExpenseResponse[], filters: string): Promise<Blob> {
  const [{ default: pdfMake }, { default: latinFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  pdfMake.addVirtualFileSystem(latinFonts)
  const fontUrl = (name: string) => new URL(import.meta.env.BASE_URL + 'fonts/' + name, window.location.origin).href
  pdfMake.addFonts({
    NotoSansKhmer: {
      normal: fontUrl('NotoSansKhmer-Regular.ttf'),
      bold: fontUrl('NotoSansKhmer-Bold.ttf'),
      italics: fontUrl('NotoSansKhmer-Regular.ttf'),
      bolditalics: fontUrl('NotoSansKhmer-Bold.ttf'),
    },
  })

  const header = (labels: string[]): TableCell[] => labels.map((text) => ({
    text, bold: true, color: '#ffffff', fillColor: '#4f46e5',
  }))
  const layout: CustomTableLayout = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 7,
    paddingRight: () => 7,
    paddingTop: () => 7,
    paddingBottom: () => 7,
    fillColor: (row) => row > 0 && row % 2 === 0 ? '#f8fafc' : null,
  }
  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 40, 40, 42],
    info: { title: 'Expense report', creator: 'Daily Expense Tracker' },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: '#334155', lineHeight: 1.25 },
    content: [
      { text: 'Expense report', fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      { text: 'Exported: ' + new Date().toLocaleString() + ' | ' + expenses.length + ' expenses', fontSize: 9, margin: [0, 0, 0, 6] },
      { ...pdfText('Filters: ' + filters), fontSize: 9, margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: [60, '*', 85, 76, 58, 40, 90],
          body: [
            header(['Date', 'Description', 'Category', 'Payment method', 'Amount', 'Currency', 'Tags']),
            ...expenses.map((expense): TableCell[] => [
              expense.expenseDate,
              pdfText(expense.description ?? ''),
              pdfText(expense.category?.name ?? 'Uncategorised'),
              paymentMethodLabel(expense.paymentMethod),
              { text: expense.amount.toFixed(2), alignment: 'right' },
              expense.currency,
              pdfText((expense.tags ?? []).join(', ')),
            ]),
          ],
        },
        layout,
      },
      {
        margin: [0, 20, 0, 0],
        table: {
          headerRows: 1,
          widths: [72, 92, 92],
          body: [
            header(['Currency', 'Expense count', 'Total amount']),
            ...totalsByCurrency(expenses).map((total): TableCell[] => [
              total.currency, String(total.count), { text: total.amount.toFixed(2), alignment: 'right' },
            ]),
          ],
        },
        layout,
      },
    ],
    footer: (page, pages) => ({
      text: 'Page ' + page + ' of ' + pages,
      alignment: 'right', fontSize: 8, color: '#64748b', margin: [40, 12, 40, 0],
    }),
  }
  return pdfMake.createPdf(definition).getBlob()
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