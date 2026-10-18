import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authStorage, hasTelegramLaunch, telegramWebApp } from '@/lib/telegram'
import type { ReactNode } from 'react'
import { authApi } from '@/lib/api/endpoints'
import { onSessionChange, tokenStorage } from '@/lib/api/client'
import type { LoginRequest, RegisterRequest, UserResponse, TokenResponse } from '@/lib/api/types'
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
  telegramError: string | null
  loginWithTelegram: () => Promise<UserResponse>
  login: (credentials: LoginRequest) => Promise<UserResponse>
  register: (details: RegisterRequest) => Promise<UserResponse>
  logout: () => void
  /** Re-reads the profile after a role or status change. */
  refreshUser: () => Promise<UserResponse | null>
  updateUser: (profile: UserResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): UserResponse | null {
  const raw = authStorage().getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserResponse
  } catch {
    authStorage().removeItem(USER_KEY)
    return null
  }
}

function persistUser(user: UserResponse | null) {
  if (user) authStorage().setItem(USER_KEY, JSON.stringify(user))
  else authStorage().removeItem(USER_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isInitialising, setIsInitialising] = useState(true)
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const telegramRequest = useRef<Promise<TokenResponse> | null>(null)
  const client = useQueryClient()

  const acceptSession = useCallback((tokens: TokenResponse) => {
    client.clear()
    tokenStorage.set(tokens)
    persistUser(tokens.user)
    setUser(tokens.user)
    setTelegramError(null)
    return tokens.user
  }, [client])

  const loginWithTelegram = useCallback(async () => {
    const initData = telegramWebApp()?.initData
    if (!initData) throw new Error('Open the Mini App from your Telegram bot to sign in with Telegram.')
    return acceptSession(await authApi.telegram(initData))
  }, [acceptSession])

  useEffect(() => {
    const initData = telegramWebApp()?.initData
    if (initData) {
      // Re-verify the current Telegram identity on each launch before showing financial data.
      let active = true
      tokenStorage.clear()
      persistUser(null)
      telegramRequest.current ??= authApi.telegram(initData)
      void telegramRequest.current.then((tokens) => {
        if (active) acceptSession(tokens)
      }).catch((error: unknown) => {
        if (active) setTelegramError(error instanceof Error ? error.message : 'Telegram sign-in failed')
      }).finally(() => { if (active) setIsInitialising(false) })
      return () => { active = false }
    }
    if (hasTelegramLaunch()) {
      tokenStorage.clear()
      persistUser(null)
      setTelegramError('Unable to read Telegram sign-in data. Close and reopen the Mini App, or sign in to your account below.')
      setIsInitialising(false)
      return
    }
    // A stored access token without a stored profile (or vice versa) is a
    // half-written session, so both are dropped rather than trusted.
    if (tokenStorage.access && tokenStorage.refresh) {
      setUser(readStoredUser())
    } else {
      tokenStorage.clear()
      persistUser(null)
    }
    setIsInitialising(false)
  }, [acceptSession])

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
    return acceptSession(tokens)
  }, [acceptSession])

  const register = useCallback(async (details: RegisterRequest) => {
    const tokens = await authApi.register(details)
    return acceptSession(tokens)
  }, [acceptSession])

  const logout = useCallback(() => {
    client.clear()
    tokenStorage.clear()
    persistUser(null)
    setUser(null)
  }, [client])

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
      telegramError,
      loginWithTelegram,
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
    [user, isInitialising, telegramError, loginWithTelegram, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
