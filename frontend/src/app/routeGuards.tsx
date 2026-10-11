import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui/States'
import { useConstructionAccess } from '@/hooks/construction'

export function RequireConstruction() {
  useLanguage()
  const access = useConstructionAccess()
  if (access.isPending) return <div className="p-6"><Spinner /></div>
  if (access.isError) return <p role="alert" className="p-6">{t("Unable to check construction access.")}{' '}<button onClick={() => void access.refetch()}>{t("Retry")}</button></p>
  if (!access.data?.allowed) return <Navigate to="/" replace />
  return <Outlet />
}

/** Requires an authenticated session; remembers the attempted location. */
export function RequireAuth() {
  useLanguage()
  const { isAuthenticated, isInitialising } = useAuth()
  const location = useLocation()

  // Wait for the persisted session to be restored before deciding, otherwise a
  // hard refresh would bounce an authenticated user to /login.
  if (isInitialising) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

/**
 * Requires the ADMIN or SUPER_ADMIN role, which the backend enforces on
 * /api/v1/users. A super administrator passes because they outrank ADMIN.
 */
export function RequireAdmin() {
  useLanguage()
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

/** Keeps a signed-in user away from the auth screens. */
export function RedirectIfAuthenticated() {
  useLanguage()
  const { isAuthenticated, isInitialising } = useAuth()

  if (isInitialising) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}
