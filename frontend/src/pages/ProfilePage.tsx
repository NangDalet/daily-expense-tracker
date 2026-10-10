import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Check, UserRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { profileApi } from '@/lib/api/endpoints'
import type { UserResponse } from '@/lib/api/types'
import { cropProfilePhoto, MAX_PROFILE_FILE_BYTES } from '@/lib/profilePhoto'
import { Avatar } from '@/components/layout/Avatar'
import { PageHeading } from '@/components/layout/AppLayout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const client = useQueryClient()
  const key = ['profile', user?.id]
  const profile = useQuery({ queryKey: key, queryFn: profileApi.get })
  const [loaded, setLoaded] = useState(false)
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string>()
  const [image, setImage] = useState<HTMLImageElement>()
  const [zoom, setZoom] = useState(1)
  const [horizontal, setHorizontal] = useState(50)
  const [vertical, setVertical] = useState(50)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile.data || loaded) return
    setUsername(profile.data.username)
    setEmail(profile.data.email)
    setFullName(profile.data.fullName ?? '')
    updateUser(profile.data)
    setLoaded(true)
  }, [profile.data, loaded, updateUser])

  useEffect(() => {
    setImage(undefined)
    if (!selectedUrl) return
    let cancelled = false
    const photo = new Image()
    photo.src = selectedUrl
    void photo.decode().then(() => {
      if (cancelled) return
      if (!photo.naturalWidth || !photo.naturalHeight || photo.naturalWidth * photo.naturalHeight > 60_000_000) {
        setError('This photo is too large. Choose a smaller image.')
        setSelectedUrl(undefined)
        return
      }
      setImage(photo)
    }).catch(() => { if (!cancelled) { setError('This image could not be opened. Choose a JPEG, PNG, or WebP photo.'); setSelectedUrl(undefined) } })
    return () => { cancelled = true; URL.revokeObjectURL(selectedUrl) }
  }, [selectedUrl])

  const preview = useMemo(() => image ? cropProfilePhoto(image, zoom, horizontal, vertical) : undefined,
    [image, zoom, horizontal, vertical])

  function saved(profileData: UserResponse, message: string) {
    updateUser(profileData)
    client.setQueryData(key, profileData)
    setSuccess(message)
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      const result = await profileApi.update({ username: username.trim(), email: email.trim(), fullName: fullName.trim() })
      setUsername(result.username); setEmail(result.email); setFullName(result.fullName ?? '')
      saved(result, 'Your profile has been saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your profile.') }
    finally { setSaving(false) }
  }

  async function applyPhoto(remove = false) {
    if (!remove && !preview) return
    setError(''); setSuccess(''); setPhotoSaving(true)
    try {
      const result = remove ? await profileApi.removePhoto() : await profileApi.photo(preview!)
      saved(result, remove ? 'Your profile photo has been removed.' : 'Your profile photo has been saved.')
      setSelectedUrl(undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your photo.') }
    finally { setPhotoSaving(false) }
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeading title="My profile" description="Update your details and choose a photo that feels like you." />
    {(error || profile.isError) && <Alert tone="error">{error || profile.error?.message}</Alert>}
    {success && <Alert tone="success"><Check className="mr-2 inline h-4 w-4" />{success}</Alert>}
    <div className="grid items-start gap-6 md:grid-cols-[280px_1fr]">
      <Card><CardBody className="flex flex-col items-center gap-4 text-center">
        <Avatar name={user?.fullName || user?.username} src={user?.avatarUrl} className="h-28 w-28 text-3xl" />
        <div><p className="text-lg font-semibold text-slate-900">{user?.fullName || user?.username}</p><p className="text-sm text-slate-500">@{user?.username}</p></div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" className="sr-only"
          disabled={!loaded || saving || photoSaving}
          onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = ''
            if (!file) return
            setError(''); setSuccess('')
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG, or WebP photo.'); return }
            if (file.size > MAX_PROFILE_FILE_BYTES) { setError('Choose a photo smaller than 5 MB.'); return }
            setZoom(1); setHorizontal(50); setVertical(50); setSelectedUrl(URL.createObjectURL(file))
          }} />
        <Button variant="secondary" disabled={!loaded || saving || photoSaving} onClick={() => fileInput.current?.click()}><Camera className="h-4 w-4" />Change photo</Button>
        {user?.avatarUrl && <button type="button" onClick={() => void applyPhoto(true)} disabled={saving || photoSaving} className="text-xs text-red-600 disabled:opacity-50">Remove photo</button>}
        <p className="text-xs text-slate-500">JPEG, PNG, or WebP. Up to 5 MB.</p>
      </CardBody></Card>
      <Card><CardHeader title="Personal details" /><CardBody>
        <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
          <Input label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} autoComplete="name" />
          <Input label="Username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" autoComplete="username" hint="Letters, numbers, dots, underscores, and dashes." />
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} autoComplete="email" />
          <Button type="submit" disabled={!loaded || saving || photoSaving} isLoading={saving}><UserRound className="h-4 w-4" />Save profile</Button>
        </form>
      </CardBody></Card>
    </div>
    {selectedUrl && <Card><CardHeader title="Crop your photo" description="Adjust the photo inside the circle, then save it." /><CardBody className="space-y-5">
      {preview ? <img src={preview} alt="Profile photo crop preview" className="mx-auto h-48 w-48 rounded-full border-4 border-brand-200 object-cover" /> : <p className="text-center text-sm text-slate-500">Preparing photo…</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        <Input label="Horizontal position" type="range" min="0" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} />
        <Input label="Vertical position" type="range" min="0" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} />
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelectedUrl(undefined)} disabled={photoSaving}>Cancel</Button>
        <Button onClick={() => void applyPhoto()} isLoading={photoSaving} disabled={!preview || saving || photoSaving}>Save photo</Button>
      </div>
    </CardBody></Card>}
  </div>
}
