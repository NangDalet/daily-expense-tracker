import { expect, test } from '@playwright/test'
import { convertMoney, sumMoney } from '../src/lib/currency'

test('fixed-rate totals preserve small riel entries and decimal amounts', () => {
  expect(convertMoney(5, 'USD', 'KHR')).toBe(20000)
  expect(convertMoney(20000, 'KHR', 'USD')).toBe(5)
  expect(sumMoney(Array.from({ length: 100 }, () => ({ amount: 20, currency: 'KHR' })), 'USD')).toBe(0.5)
  expect(sumMoney([{ amount: 0.1, currency: 'USD' }, { amount: 0.2, currency: 'USD' }], 'USD')).toBe(0.3)
  expect(sumMoney([{ amount: 5, currency: 'USD' }, { amount: 20000, currency: 'KHR' }], 'USD')).toBe(10)
  expect(sumMoney([{ amount: 5, currency: 'USD' }, { amount: 20000, currency: 'KHR' }], 'KHR')).toBe(40000)
  expect(sumMoney([], 'USD')).toBe(0)
  expect(sumMoney([{ amount: 1000.3, currency: 'USD' }, { amount: 10000, currency: 'KHR' },
    { amount: -88.48, currency: 'USD' }, { amount: -4500, currency: 'KHR' }], 'USD')).toBe(913.195)
})
