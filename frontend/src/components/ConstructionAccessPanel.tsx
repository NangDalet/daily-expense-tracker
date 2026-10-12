import { useEffect, useState } from 'react'
import type { ConstructionRole, Grant, Project } from '@/lib/api/construction'
import { useLanguage } from '@/context/LanguageContext'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

interface Props {
  grants: Grant[]; projects: Project[]; superAdmin: boolean; pending: boolean
  onSave: (id: string, granted: boolean, role: ConstructionRole, siteIds: string[]) => void
}

export function ConstructionAccessPanel(props: Props) {
  const { t } = useLanguage()
  return <div className="space-y-4">
    <p className="text-sm text-slate-500">{t('Super administrators assign site managers. Site managers assign foremen to check attendance only at selected sites.')}</p>
    {props.grants.map(grant => <Assignment key={grant.userId} {...props} grant={grant} />)}
  </div>
}

function Assignment({ grant, projects, superAdmin, pending, onSave }: Props & { grant: Grant }) {
  const { t } = useLanguage()
  const [role, setRole] = useState<ConstructionRole>(grant.constructionRole ?? (superAdmin ? 'MANAGER' : 'FOREMAN'))
  const [sites, setSites] = useState<string[]>(grant.siteIds ?? [])
  useEffect(() => {
    setRole(grant.constructionRole ?? (superAdmin ? 'MANAGER' : 'FOREMAN'))
    setSites(grant.siteIds ?? [])
  }, [grant, superAdmin])
  const disabled = pending || !grant.enabled || !!grant.superAdmin
  return <form className="card space-y-3 p-4" onSubmit={event => {
    event.preventDefault()
    onSave(grant.userId, true, role, role === 'FOREMAN' ? sites : [])
  }}>
    <div><p className="font-medium">{grant.fullName || grant.username}</p><p className="text-sm text-slate-500">{grant.username} · {t(grant.enabled ? 'Enabled' : 'Disabled')} · {t(grant.granted || grant.superAdmin ? 'Assigned' : 'Unassigned')}</p></div>
    {grant.superAdmin ? <p className="text-sm">{t('Super administrators have access automatically.')}</p> : <>
      <Select label={`${t('Construction role')} (${grant.username})`} value={role} disabled={disabled} onChange={e => setRole(e.target.value as ConstructionRole)}
        options={[...(superAdmin ? [{ value: 'MANAGER', label: t('Construction Site Manager') }] : []), { value: 'FOREMAN', label: t('Construction Foreman') }]} />
      {role === 'FOREMAN' && <fieldset disabled={disabled} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('Assigned sites')} ({grant.username})</legend>
        {projects.filter(project => project.active || sites.includes(project.id)).map(project => <label key={project.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sites.includes(project.id)} onChange={e => setSites(current => e.target.checked ? [...current, project.id] : current.filter(id => id !== project.id))} />
          {project.name} / {project.site}{!project.active && ` (${t('Inactive')})`}
        </label>)}
      </fieldset>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={disabled || (role === 'FOREMAN' && sites.length === 0)}>{t(grant.granted ? 'Update access' : 'Assign')}</Button>
        {grant.granted && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onSave(grant.userId, false, role, [])}>{t('Revoke')}</Button>}
      </div>
    </>}
  </form>
}
