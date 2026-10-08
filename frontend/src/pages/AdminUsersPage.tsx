import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeading } from '@/components/layout/AppLayout'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { Avatar } from '@/components/layout/Avatar'
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from '@/hooks/queries'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { ROLES, ROLE_RANK, highestRole } from '@/lib/api/types'
import type {
  CreateUserRequest,
  Role,
  UpdateUserRequest,
  UserResponse,
} from '@/lib/api/types'
import { formatDateTime } from '@/lib/utils'

const PAGE_SIZE = 20

/** Badge colour per tier, so a super admin stands out in the listing. */
const ROLE_TONES: Record<Role, BadgeTone> = {
  USER: 'neutral',
  ADMIN: 'brand',
  SUPER_ADMIN: 'danger',
}

const ROLE_LABELS: Record<Role, string> = {
  USER: 'User',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
}

export default function AdminUsersPage() {
  const { user: currentUser, isSuperAdmin } = useAuth()
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null)
  const [resettingUser, setResettingUser] = useState<UserResponse | null>(null)

  const { data, isPending, isError, error, refetch } = useUsers(search, page, PAGE_SIZE)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetPassword = useResetUserPassword()

  const actorRole = highestRole(currentUser?.roles)

  /** Mirrors `UserService.requireManages`: super admins manage everyone. */
  function canManage(row: UserResponse) {
    if (row.id === currentUser?.id) return true
    if (actorRole === 'SUPER_ADMIN') return true
    return ROLE_RANK[highestRole(row.roles)] < ROLE_RANK[actorRole]
  }

  // Debounce so each keystroke does not hit /users.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft)
      setPage(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  async function handleDelete() {
    if (!deletingUser) return
    try {
      await deleteUser.mutateAsync(deletingUser.id)
      setDeletingUser(null)
    } catch {
      // Surfaced inside the dialog.
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Users"
        description={
          isSuperAdmin
            ? 'You are a super administrator, so you can manage every account including other administrators.'
            : 'Administrative account management. You can manage accounts below your own tier.'
        }
        action={
          isSuperAdmin ? (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New user
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by username, e-mail or name"
            aria-label="Search users"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none sm:max-w-md"
          />
        </div>

        <Card className="overflow-hidden">
          {isError ? (
            <ErrorState
              title="Could not load users"
              message={error instanceof ApiError ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          ) : isPending && !data ? (
            <LoadingBlock label="Loading users" />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Shield className="h-6 w-6" aria-hidden />}
              title="No users found"
              description={search ? 'Try a different search term.' : 'No accounts exist yet.'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        User
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        Roles
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        Created
                      </th>
                      <th scope="col" className="w-28 px-4 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.items.map((row) => {
                      const isSelf = row.id === currentUser?.id
                      const manageable = canManage(row)
                      const canDelete = manageable && !isSelf
                      return (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={row.fullName || row.username} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {row.fullName || row.username}
                                  {isSelf && (
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                                      (you)
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {row.username} · {row.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {row.roles.map((role) => (
                                <Badge key={role} tone={ROLE_TONES[role] ?? 'neutral'}>
                                  {ROLE_LABELS[role] ?? role}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={row.enabled ? 'success' : 'danger'}>
                              {row.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                            {formatDateTime(row.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => setEditingUser(row)}
                                disabled={!manageable}
                                title={
                                  manageable
                                    ? `Edit ${row.username}`
                                    : `You cannot manage an account holding the ${highestRole(row.roles)} role`
                                }
                                aria-label={`Edit ${row.username}`}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setResettingUser(row)}
                                  disabled={!manageable}
                                  title={
                                    manageable
                                      ? `Reset password for ${row.username}`
                                      : 'Not permitted'
                                  }
                                  aria-label={`Reset password for ${row.username}`}
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeletingUser(row)}
                                // The backend rejects self-deletion and
                                // out-of-tier targets, so the button matches.
                                disabled={!canDelete}
                                title={
                                  isSelf
                                    ? 'You cannot delete your own account'
                                    : manageable
                                      ? `Delete ${row.username}`
                                      : 'Not permitted'
                                }
                                aria-label={`Delete ${row.username}`}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={data?.page ?? page}
                totalPages={data?.totalPages ?? 0}
                totalElements={data?.totalElements ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>

      <Modal
        open={isCreating}
        onClose={() => setIsCreating(false)}
        title="New user"
        description="Creates the account immediately and seeds its default categories."
        size="md"
      >
        <CreateUserForm
          isPending={createUser.isPending}
          error={createUser.error instanceof ApiError ? createUser.error : null}
          onSubmit={async (values) => {
            await createUser.mutateAsync(values)
            setIsCreating(false)
          }}
          onCancel={() => setIsCreating(false)}
        />
      </Modal>

      <Modal
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Edit user"
        description={editingUser ? `${editingUser.username} · ${editingUser.email}` : undefined}
        size="md"
      >
        {editingUser && (
          <UserForm
            key={editingUser.id}
            target={editingUser}
            isSelf={editingUser.id === currentUser?.id}
            actorRole={actorRole}
            isPending={updateUser.isPending}
            error={updateUser.error instanceof ApiError ? updateUser.error : null}
            onSubmit={async (values) => {
              await updateUser.mutateAsync({ id: editingUser.id, body: values })
              setEditingUser(null)
            }}
            onCancel={() => setEditingUser(null)}
          />
        )}
      </Modal>

      <Modal
        open={resettingUser !== null}
        onClose={() => setResettingUser(null)}
        title="Reset password"
        description={resettingUser ? resettingUser.username : undefined}
        size="sm"
      >
        {resettingUser && (
          <ResetPasswordForm
            isPending={resetPassword.isPending}
            error={resetPassword.error instanceof ApiError ? resetPassword.error : null}
            onSubmit={async (password) => {
              await resetPassword.mutateAsync({ id: resettingUser.id, password })
              setResettingUser(null)
            }}
            onCancel={() => setResettingUser(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingUser !== null}
        title="Delete user"
        description={`This permanently removes "${deletingUser?.username}" and cascades to all of their categories, expenses and budgets. This cannot be undone.`}
        confirmLabel="Delete user"
        isPending={deleteUser.isPending}
        error={deleteUser.error instanceof ApiError ? deleteUser.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  )
}

// ===================== Create =====================

interface CreateUserFormProps {
  isPending: boolean
  error: ApiError | null
  onSubmit: (values: CreateUserRequest) => Promise<void>
  onCancel: () => void
}

function CreateUserForm({ isPending, error, onSubmit, onCancel }: CreateUserFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateUserRequest>({
    defaultValues: { roles: ['USER'], enabled: true },
  })

  const enabled = watch('enabled')

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          fullName: values.fullName?.trim() || undefined,
          roles: values.roles,
          enabled: values.enabled,
        })
      })}
      noValidate
      className="space-y-4"
    >
      {error && (
        <Alert tone="error" title={error.message}>
          {error.code === 'DUPLICATE_RESOURCE' && (
            <p>That username or e-mail address belongs to another account.</p>
          )}
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <Input
        label="Username"
        required
        autoComplete="off"
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
      />

      <Input
        label="E-mail"
        type="email"
        required
        {...register('email', {
          required: 'E-mail is required',
          maxLength: { value: 255, message: 'Must be at most 255 characters' },
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid e-mail address' },
        })}
        error={errors.email?.message}
      />

      <Input
        label="Full name"
        {...register('fullName', { maxLength: { value: 120, message: 'Must be at most 120 characters' } })}
        error={errors.fullName?.message}
        hint="Optional, defaults to the username"
      />

      <Input
        label="Password"
        type="password"
        required
        autoComplete="new-password"
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Must be at least 8 characters' },
          maxLength: { value: 72, message: 'Must be at most 72 characters' },
        })}
        error={errors.password?.message}
        hint="Between 8 and 72 characters"
      />

      <RoleFieldset roleProps={register('roles')} error={errors.roles?.message} />

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
        <input
          type="checkbox"
          {...register('enabled')}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="flex-1 text-sm text-slate-700">
          Account enabled
          <span className="mt-0.5 block text-xs text-slate-500">
            {enabled ? 'The user can sign in immediately.' : 'Sign-in stays blocked until enabled.'}
          </span>
        </span>
        {enabled ? (
          <UserCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <UserX className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
        )}
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending}>
          Create user
        </Button>
      </div>
    </form>
  )
}

// ===================== Edit =====================

interface UserFormProps {
  target: UserResponse
  isSelf: boolean
  actorRole: Role
  isPending: boolean
  error: ApiError | null
  onSubmit: (values: UpdateUserRequest) => Promise<void>
  onCancel: () => void
}

function UserForm({ target, isSelf, actorRole, isPending, error, onSubmit, onCancel }: UserFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UpdateUserRequest>({
    defaultValues: {
      email: target.email,
      fullName: target.fullName ?? '',
      roles: target.roles,
      enabled: target.enabled,
    },
  })

  const enabled = watch('enabled')

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          email: values.email,
          fullName: values.fullName?.trim() || undefined,
          roles: values.roles,
          enabled: values.enabled,
        })
      })}
      noValidate
      className="space-y-4"
    >
      {error && (
        <Alert tone="error" title={error.message}>
          {error.code === 'DUPLICATE_RESOURCE' && (
            <p>That e-mail address belongs to another account.</p>
          )}
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <Input
        label="E-mail"
        type="email"
        required
        {...register('email', {
          required: 'E-mail is required',
          maxLength: { value: 255, message: 'Must be at most 255 characters' },
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid e-mail address' },
        })}
        error={errors.email?.message}
      />

      <Input
        label="Full name"
        {...register('fullName', { maxLength: { value: 120, message: 'Must be at most 120 characters' } })}
        error={errors.fullName?.message}
        hint="Leave empty to clear the name"
      />

      <RoleFieldset
        roleProps={register('roles')}
        error={errors.roles?.message}
        ceiling={actorRole}
        hint="The role set is replaced wholesale, so at least one role is required."
      />

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
        <input
          type="checkbox"
          {...register('enabled')}
          // The backend refuses to let an actor disable their own account.
          disabled={isSelf}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
        />
        <span className="flex-1 text-sm text-slate-700">
          Account enabled
          <span className="mt-0.5 block text-xs text-slate-500">
            {isSelf
              ? 'You cannot disable your own account.'
              : enabled
                ? 'The user can sign in and use the API.'
                : 'Sign-in is blocked, but the history is preserved.'}
          </span>
        </span>
        {enabled ? (
          <UserCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <UserX className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
        )}
      </label>

      {isSelf && (
        <Alert tone="info">
          You are editing your own account. Removing your own privileged role takes effect immediately and
          hides this page.
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

// ===================== Password reset =====================

interface ResetPasswordFormProps {
  isPending: boolean
  error: ApiError | null
  onSubmit: (password: string) => Promise<void>
  onCancel: () => void
}

function ResetPasswordForm({ isPending, error, onSubmit, onCancel }: ResetPasswordFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<{ password: string; confirmPassword: string }>({
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = watch('password')

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values.password)
        reset()
      })}
      noValidate
      className="space-y-4"
    >
      {error && (
        <Alert tone="error" title={error.message}>
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <Input
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Must be at least 8 characters' },
          maxLength: { value: 72, message: 'Must be at most 72 characters' },
        })}
        error={errors.password?.message}
        hint="Between 8 and 72 characters"
      />

      <Input
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
        {...register('confirmPassword', {
          required: 'Please repeat the password',
          validate: (value) => value === password || 'The passwords do not match',
        })}
        error={errors.confirmPassword?.message}
      />

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending}>
          Reset password
        </Button>
      </div>
    </form>
  )
}

// ===================== Shared bits =====================

/**
 * Role checkboxes limited to the caller's own tier, mirroring the backend rule
 * that nobody may grant a role above their own.
 */
function RoleFieldset({
  roleProps,
  error,
  ceiling = 'SUPER_ADMIN',
  hint = 'The role set is replaced wholesale, so at least one role is required.',
}: {
  /** Result of `register('roles')` from the surrounding form. */
  roleProps: UseFormRegisterReturn
  error?: string
  ceiling?: Role
  hint?: string
}) {
  const options = ROLES.filter((role) => ROLE_RANK[role] <= ROLE_RANK[ceiling])

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">Roles</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((role) => (
          <label
            key={role}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 has-checked:border-brand-600 has-checked:bg-brand-50"
          >
            <input
              type="checkbox"
              value={role}
              {...roleProps}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
    </fieldset>
  )
}
