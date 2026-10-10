import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/lib/api/endpoints'
import { onSessionChange, tokenStorage } from '@/lib/api/client'
import type { LoginRequest, RegisterRequest, UserResponse } from '@/lib/api/types'
import { hasAdminRole, hasSuperAdminRole } from '@/lib/api/types'

const USER_KEY = 'expense-tracker.user'

interface AuthContextValue {
  user: UserResponse | null
  isAuthenticated: boolean
  /** True for `ADMIN` and `SUPER_ADMIN`. */
  isAdmin: boolean
  /** True only for `SUPER_ADMIN`, which may manage every account. */
  isSuperAdmin: boolean
  /** True until the persisted session has been restored from storage. */
  isInitialising: boolean
  login: (credentials: LoginRequest) => Promise<UserResponse>
  register: (details: RegisterRequest) => Promise<UserResponse>
  logout: () => void
  /** Re-reads the profile after a role or status change. */
  refreshUser: () => Promise<UserResponse | null>
  updateUser: (profile: UserResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): UserResponse | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserResponse
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

function persistUser(user: UserResponse | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isInitialising, setIsInitialising] = useState(true)

  useEffect(() => {
    // A stored access token without a stored profile (or vice versa) is a
    // half-written session, so both are dropped rather than trusted.
    if (tokenStorage.access && tokenStorage.refresh) {
      setUser(readStoredUser())
    } else {
      tokenStorage.clear()
      persistUser(null)
    }
    setIsInitialising(false)
  }, [])

  useEffect(
    () =>
      onSessionChange(() => {
        // The API client clears storage when a refresh fails irrecoverably.
        if (!tokenStorage.access) {
          setUser(null)
          persistUser(null)
        }
      }),
    [],
  )

  const login = useCallback(async (credentials: LoginRequest) => {
    const tokens = await authApi.login(credentials)
    tokenStorage.set(tokens)
    persistUser(tokens.user)
    setUser(tokens.user)
    return tokens.user
  }, [])

  const register = useCallback(async (details: RegisterRequest) => {
    const tokens = await authApi.register(details)
    tokenStorage.set(tokens)
    persistUser(tokens.user)
    setUser(tokens.user)
    return tokens.user
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    persistUser(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((profile: UserResponse) => {
    persistUser(profile)
    setUser(profile)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: hasAdminRole(user?.roles),
      isSuperAdmin: hasSuperAdminRole(user?.roles),
      isInitialising,
      login,
      register,
      logout,
      updateUser,
      refreshUser: async () => {
        if (!tokenStorage.access) return null
        // The token pair itself carries the profile, so a refresh is enough.
        // The new pair has to be stored as well: after a self-demotion the old
        // access token would still carry the revoked roles until it expired.
        const tokens = await authApi.refresh(tokenStorage.refresh ?? '')
        tokenStorage.set(tokens)
        persistUser(tokens.user)
        setUser(tokens.user)
        return tokens.user
      },
    }),
    [user, isInitialising, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
