import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui/States'

/** Requires an authenticated session; remembers the attempted location. */
export function RequireAuth() {
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
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

/** Keeps a signed-in user away from the auth screens. */
export function RedirectIfAuthenticated() {
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
