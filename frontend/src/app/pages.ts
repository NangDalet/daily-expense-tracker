import { lazyPage } from './lazyPage'

export const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'))
export const ExpensesPage = lazyPage(() => import('@/pages/ExpensesPage'))
export const IncomePage = lazyPage(() => import('@/pages/IncomePage'))
export const CategoriesPage = lazyPage(() => import('@/pages/CategoriesPage'))
export const TelegramPage = lazyPage(() => import('@/pages/TelegramPage'))
export const ProfilePage = lazyPage(() => import('@/pages/ProfilePage'))
export const MonthlyPage = lazyPage(() => import('@/pages/MonthlyPage'))
export const BudgetsPage = lazyPage(() => import('@/pages/BudgetsPage'))
export const AdminUsersPage = lazyPage(() => import('@/pages/AdminUsersPage'))
export const ConstructionPage = lazyPage(() => import('@/pages/ConstructionPage'))
export const LoginPage = lazyPage(() => import('@/pages/LoginPage'))
export const RegisterPage = lazyPage(() => import('@/pages/RegisterPage'))
export const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'))

const modules = {
  '/': DashboardPage,
  '/expenses': ExpensesPage,
  '/incomes': IncomePage,
  '/categories': CategoriesPage,
  '/budgets': BudgetsPage,
  '/telegram': TelegramPage,
  '/profile': ProfilePage,
  '/monthly': MonthlyPage,
  '/users': AdminUsersPage,
  '/construction': ConstructionPage,
}

export function preloadModule(path: string) {
  modules[path as keyof typeof modules]?.preload()
}
