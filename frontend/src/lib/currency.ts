/** User-defined fixed exchange rate; original transaction amounts are never changed. */
export const KHR_PER_USD = 4000

/** Accumulate hundredths of a riel so small KHR entries are not rounded per entry. */
export function toKhrMinor(amount: number, currency: string): number {
  if (currency !== 'USD' && currency !== 'KHR') throw new Error('Currency must be USD or KHR')
  return Math.round(amount * 100) * (currency === 'USD' ? KHR_PER_USD : 1)
}

export function fromKhrMinor(amount: number, currency: string): number {
  if (currency !== 'USD' && currency !== 'KHR') throw new Error('Currency must be USD or KHR')
  return amount / 100 / (currency === 'USD' ? KHR_PER_USD : 1)
}

export function convertMoney(amount: number, from: string, to: string): number {
  return fromKhrMinor(toKhrMinor(amount, from), to)
}

export function sumMoney(rows: { amount: number; currency: string }[], currency: string): number {
  return fromKhrMinor(rows.reduce((sum, row) => sum + toKhrMinor(row.amount, row.currency), 0), currency)
}
