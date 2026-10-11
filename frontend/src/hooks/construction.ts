import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { constructionApi } from '@/lib/api/construction'
export function useConstructionAccess() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['construction-access', user?.id], queryFn: constructionApi.access,
    enabled: !!user, staleTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true })
}
