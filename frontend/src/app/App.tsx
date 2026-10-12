import { useLanguage } from '@/context/LanguageContext'
import { lazyPage } from './lazyPage'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { ApiError } from '@/lib/api/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth, RequireConstruction } from './routeGuards'

const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'))
const ExpensesPage = lazyPage(() => import('@/pages/ExpensesPage'))
const IncomePage = lazyPage(() => import('@/pages/IncomePage'))
const CategoriesPage = lazyPage(() => import('@/pages/CategoriesPage'))
const TelegramPage = lazyPage(() => import('@/pages/TelegramPage'))
const ProfilePage = lazyPage(() => import('@/pages/ProfilePage'))
const MonthlyPage = lazyPage(() => import('@/pages/MonthlyPage'))
const BudgetsPage = lazyPage(() => import('@/pages/BudgetsPage'))
const AdminUsersPage = lazyPage(() => import('@/pages/AdminUsersPage'))
const ConstructionPage = lazyPage(() => import('@/pages/ConstructionPage'))
const LoginPage = lazyPage(() => import('@/pages/LoginPage'))
const RegisterPage = lazyPage(() => import('@/pages/RegisterPage'))
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'))

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
  useLanguage()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider><ThemeProvider><AuthProvider>
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
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="monthly" element={<MonthlyPage />} />
                  <Route element={<RequireConstruction />}>
                    <Route path="construction" element={<ConstructionPage />} />
                  </Route>
                  <Route element={<RequireAdmin />}>
                    <Route path="users" element={<AdminUsersPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AuthProvider></ThemeProvider></LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
