import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingBlock } from '@/components/ui/States'
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from './routeGuards'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'))
const IncomePage = lazy(() => import('@/pages/IncomePage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const TelegramPage = lazy(() => import('@/pages/TelegramPage'))
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage'))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The access token is refreshed transparently by the API client, so a
      // 401 in flight is a signal to retry, not a hard failure.
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status === 0) return failureCount < 1
          if (error.status >= 400 && error.status < 500) return false
        }
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: { retry: false },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingBlock label="Loading" />}>
            <Routes>
              <Route element={<RedirectIfAuthenticated />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="incomes" element={<IncomePage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="budgets" element={<BudgetsPage />} />
                  <Route path="telegram" element={<TelegramPage />} />
                  <Route element={<RequireAdmin />}>
                    <Route path="users" element={<AdminUsersPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
