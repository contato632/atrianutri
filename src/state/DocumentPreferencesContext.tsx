import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { blankDocumentPreferences, SessionDocumentPreferencesRepository, type DocumentPreferencesRepository, type DocumentPreferencesScope } from '../data/documentPreferences'
import type { DocumentBranding } from '../domain/documents'

type DocumentPreferencesContextValue = {
  branding: DocumentBranding
  loading: boolean
  saved: boolean
  revision: number
  save: (branding: DocumentBranding) => Promise<void>
}

const Context = createContext<DocumentPreferencesContextValue | null>(null)
const sessionRepository = new SessionDocumentPreferencesRepository()

export function DocumentPreferencesProvider({ children, scope, repository = sessionRepository }: { children: ReactNode; scope: DocumentPreferencesScope; repository?: DocumentPreferencesRepository }) {
  const [branding, setBranding] = useState(blankDocumentPreferences)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    void repository.load(scope).then((record) => {
      if (!active) return
      setBranding(record ?? blankDocumentPreferences())
      setSaved(Boolean(record))
      setRevision((current) => current + 1)
      setLoading(false)
    })
    return () => { active = false }
  }, [repository, scope.organizationId, scope.professionalId])

  const value = useMemo<DocumentPreferencesContextValue>(() => ({
    branding, loading, saved, revision,
    async save(next) {
      const result = await repository.save(scope, next)
      setBranding(result); setSaved(true); setRevision((current) => current + 1)
    },
  }), [branding, loading, repository, revision, saved, scope])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useDocumentPreferences() {
  const value = useContext(Context)
  if (!value) throw new Error('useDocumentPreferences deve ser usado dentro de DocumentPreferencesProvider.')
  return value
}
