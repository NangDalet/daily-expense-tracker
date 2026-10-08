import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import type { RegisterRequest } from '@/lib/api/types'

/** Client-only field: never sent to the backend. */
interface RegisterForm extends RegisterRequest {
  confirmPassword: string
}

export default function RegisterPage() {
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<ApiError | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>()

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await createAccount({
        username: values.username,
        email: values.email,
        password: values.password,
        // Optional in the DTO, so only send it when the user actually typed one.
        ...(values.fullName?.trim() ? { fullName: values.fullName.trim() } : {}),
      })
      navigate('/', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error : null)
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking your expenses in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && (
          <Alert tone="error" title={serverError.message}>
            {serverError.code === 'DUPLICATE_RESOURCE' && (
              <p>That username or e-mail address is already registered.</p>
            )}
            <FieldErrorList details={serverError.details} />
          </Alert>
        )}

        <Input
          label="Username"
          placeholder="dana"
          autoComplete="username"
          autoFocus
          {...register('username', {
            required: 'Username is required',
            minLength: { value: 3, message: 'Must be at least 3 characters' },
            maxLength: { value: 50, message: 'Must be at most 50 characters' },
            pattern: {
              value: /^[A-Za-z0-9._-]+$/,
              message: 'Only letters, digits, dot, underscore and dash',
            },
          })}
          error={errors.username?.message}
          hint="Letters, digits, dot, underscore and dash"
        />

        <Input
          label="E-mail"
          type="email"
          placeholder="dana@example.com"
          autoComplete="email"
          {...register('email', {
            required: 'E-mail is required',
            maxLength: { value: 255, message: 'Must be at most 255 characters' },
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid e-mail address' },
          })}
          error={errors.email?.message}
        />

        <Input
          label="Password"
          type="password"
          placeholder="S3cret-pass!"
          autoComplete="new-password"
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Must be at least 8 characters' },
            maxLength: { value: 72, message: 'Must be at most 72 characters' },
          })}
          error={errors.password?.message}
          hint="At least 8 characters"
        />

        <Input
          label="Full name"
          placeholder="Dana Doe"
          autoComplete="name"
          {...register('fullName', { maxLength: { value: 120, message: 'Must be at most 120 characters' } })}
          error={errors.fullName?.message}
          hint="Optional"
        />

        <Input
          label="Confirm password"
          type="password"
          placeholder="S3cret-pass!"
          autoComplete="new-password"
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (value) => value === getValues('password') || 'Passwords do not match',
          })}
          error={errors.confirmPassword?.message}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
