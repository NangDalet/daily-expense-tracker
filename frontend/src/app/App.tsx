import { useLanguage } from '@/context/LanguageContext'
import { DashboardPage, ExpensesPage, IncomePage, CategoriesPage, TelegramPage,
  ProfilePage, MonthlyPage, BudgetsPage, AdminUsersPage, ConstructionPage,
  LoginPage, RegisterPage, NotFoundPage, MiniAppPage } from './pages'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { ApiError } from '@/lib/api/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth, RequireConstruction } from './routeGuards'


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
              <Route path="/miniapp" element={<MiniAppPage />} />
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
