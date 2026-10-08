import { useState } from 'react'
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
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<ApiError | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>()

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values)
      const state = location.state as LocationState | null
      navigate(state?.from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error : null)
    }
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue tracking your spending."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && (
          <Alert tone="error" title={serverError.message}>
            {serverError.code === 'INVALID_CREDENTIALS' && (
              <p>Check your username and password, then try again.</p>
            )}
            {serverError.code === 'FORBIDDEN' && <p>This account has been disabled.</p>}
            <FieldErrorList details={serverError.details} />
          </Alert>
        )}

        <Input
          label="Username or e-mail"
          placeholder="Enter your username"
          autoComplete="username"
          autoFocus
          {...register('username', { required: 'Username is required' })}
          error={errors.username?.message}
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          {...register('password', { required: 'Password is required' })}
          error={errors.password?.message}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>

    </AuthLayout>
  )
}
