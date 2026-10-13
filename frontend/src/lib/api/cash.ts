import { http } from './client'
import type { Page } from './endpoints'

export interface CashBalance {
  currency: string
  totalTopups: number
  totalSpent: number
  remainingAmount: number
}
export interface TopupRequest {
  amount: number
  currency: string
  topupDate: string
  note?: string
}
export interface CashTopup extends TopupRequest { id: string; createdAt: string }

export const cashApi = {
  balances: () => http.get<CashBalance[]>('/cash/balances'),
  async topups(page = 0): Promise<Page<CashTopup>> {
    const response = await http.getEnvelope<CashTopup[]>('/cash/topups', { page, size: 10 })
    return { items: response.data ?? [], page: response.page ?? 0, size: response.size ?? 10,
      totalElements: response.totalElements ?? 0, totalPages: response.totalPages ?? 0 }
  },
  create: (body: TopupRequest) => http.post<CashTopup>('/cash/topups', body),
  update: (id: string, body: TopupRequest) => http.put<CashTopup>(`/cash/topups/${id}`, body),
  remove: (id: string) => http.delete<void>(`/cash/topups/${id}`),
}
