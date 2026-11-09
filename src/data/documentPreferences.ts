import { defaultDocumentBranding, type DocumentBranding } from '../domain/documents'

export type DocumentPreferencesScope = {
  organizationId: string
  professionalId: string
}

export interface DocumentPreferencesRepository {
  load(scope: DocumentPreferencesScope): Promise<DocumentBranding | null>
  save(scope: DocumentPreferencesScope, branding: DocumentBranding): Promise<DocumentBranding>
}

const scopeKey = ({ organizationId, professionalId }: DocumentPreferencesScope) => `${organizationId}:${professionalId}`

export class SessionDocumentPreferencesRepository implements DocumentPreferencesRepository {
  private readonly records = new Map<string, DocumentBranding>()

  async load(scope: DocumentPreferencesScope) {
    const stored = this.records.get(scopeKey(scope))
    return stored ? structuredClone(stored) : null
  }

  async save(scope: DocumentPreferencesScope, branding: DocumentBranding) {
    const saved = structuredClone(branding)
    this.records.set(scopeKey(scope), saved)
    return structuredClone(saved)
  }
}

export const blankDocumentPreferences = () => defaultDocumentBranding()
