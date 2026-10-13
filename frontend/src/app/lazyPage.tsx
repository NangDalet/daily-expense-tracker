import { Component, lazy, Suspense, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { ErrorState, LoadingBlock } from '@/components/ui/States'
import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'

class PageLoadBoundary extends Component<{
  children: ReactNode
  onRetry: () => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed
      ? <ErrorState title={t('Could not load this page')} onRetry={this.props.onRetry} />
      : this.props.children
  }
}

/** Keep module loading and recovery inside the page, preserving the app shell. */
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  let loaded: { default: ComponentType } | undefined
  let pending: Promise<{ default: ComponentType }> | undefined
  function loadOnce() {
    pending ??= load().then(module => {
      loaded = module
      return module
    }).catch(error => {
      pending = undefined
      throw error
    })
    return pending
  }
  // Reuse React's resolved lazy component across module visits.
  const InitialPage = lazy(loadOnce)
  function LazyPage() {
    useLanguage()
    const [attempt, setAttempt] = useState(0)
    // A fresh lazy component retries failed imports rather than reusing React's
    // cached rejection. The document and authentication providers stay mounted.
    const Page = useMemo(() => loaded?.default ?? (attempt === 0 ? InitialPage : lazy(loadOnce)), [attempt])
    return <PageLoadBoundary key={attempt} onRetry={() => setAttempt(value => value + 1)}>
      <Suspense fallback={<LoadingBlock label={t('Loading')} />}>
        <div className="module-page"><Page /></div>
      </Suspense>
    </PageLoadBoundary>
  }
  // A failed speculative load is retried by the normal page error boundary.
  LazyPage.preload = () => { void loadOnce().catch(() => {}) }
  return LazyPage
}
