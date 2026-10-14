import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { http } from '@/lib/api/client'

const MEDIA_PREFIX = '/api/v1/media/'

/** Fetch private photos with the normal bearer-token/refresh flow. Never put tokens in image URLs. */
export function SecureImage({ src, fallback, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string; fallback?: ReactNode
}) {
  const { user } = useAuth()
  const [loaded, setLoaded] = useState<{ source: string; url: string; userId: string }>()
  const privatePhoto = src.startsWith(MEDIA_PREFIX)

  useEffect(() => {
    if (!privatePhoto || !user?.id) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void http.getBlob(src.slice('/api/v1'.length), controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ source: src, url: objectUrl, userId: user.id })
    }).catch(() => { /* Keep the placeholder if the photo is unavailable. */ })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, privatePhoto, user?.id])

  const resolved = privatePhoto ? (loaded?.source === src && loaded.userId === user?.id ? loaded.url : undefined) : src
  if (!resolved) return <span className={props.className} role={props.alt ? 'img' : undefined} aria-label={props.alt}>{fallback}</span>
  return <img {...props} src={resolved} />
}
