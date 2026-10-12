import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import type { LoginRequest } from '@/lib/api/types'

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  useLanguage()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>()

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login({ ...values, username: values.username.trim() })
      const state = location.state as LocationState | null
      navigate(state?.from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error : new ApiError('Could not sign in. Please try again.', { code: 'UNKNOWN', status: 0 }))
    }
  })

  return (
    <AuthLayout
      title={t("Welcome back")}
      subtitle={t("Sign in to continue tracking your spending.")}
      footer={
        <>
          {t("Don't have an account?")}{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            {t("Create one")}</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="login-form space-y-5" aria-busy={isSubmitting}>
        {serverError && (
          <Alert tone="error" title={serverError.message}>
            {serverError.code === 'INVALID_CREDENTIALS' && (
              <p>{t("Check your username and password, then try again.")}</p>
            )}
            {serverError.code === 'FORBIDDEN' && <p>{t("This account has been disabled.")}</p>}
            <FieldErrorList details={serverError.details} />
          </Alert>
        )}

        <Input
          label={t("Username or e-mail")}
          placeholder={t("Enter your username")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          prefix={<UserRound className="h-4 w-4" aria-hidden />}
          autoFocus
          {...register('username', { required: "Username is required", validate: value => Boolean(value.trim()) || 'Username is required' })}
          error={errors.username?.message}
        />

        <Input
          label={t("Password")}
          type={showPassword ? 'text' : 'password'}
          placeholder={t("Enter your password")}
          autoComplete="current-password"
          prefix={<LockKeyhole className="h-4 w-4" aria-hidden />}
          {...register('password', { required: "Password is required" })}
          onKeyDown={event => setCapsLock(event.getModifierState('CapsLock'))}
          onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))}
          suffix={<button type="button" aria-label={t(showPassword ? 'Hide password' : 'Show password')}
            aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(value => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-600">
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>}
          id="login-password"
          error={errors.password?.message}
        />
        {capsLock && <p role="status" className="text-xs text-amber-700">{t('Caps Lock is on')}</p>}

        <Button type="submit" className="login-submit w-full" size="lg" isLoading={isSubmitting}>
          {t(isSubmitting ? 'Signing in…' : 'Sign in')}
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>

    </AuthLayout>
  )
}
