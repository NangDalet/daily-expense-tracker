import { useQuery } from '@tanstack/react-query'
import { cashApi } from '@/lib/api/cash'

export function useCashBalances() {
  return useQuery({ queryKey: ['cash', 'balances'], queryFn: cashApi.balances })
}
