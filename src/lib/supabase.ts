import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const ATRIANUTRI_PROJECT_REF = 'zwnoxycxhlihqxhutlcy'

export const forbiddenProjectRefs = new Set([
  'tbbaiowzduqriwdjeacd', // AtriaClinic — jamais conectar o AtriaNutri.
])

let client: SupabaseClient | null = null

export type SupabaseRuntime = {
  client: SupabaseClient
  projectRef: string
  realDataApproved: boolean
}

export function validateSupabaseProjectUrl(value: string, allowLocal = import.meta.env.DEV) {
  const url = new URL(value)
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  const projectRef = local ? 'atrianutri-local' : url.hostname.split('.')[0]

  if (forbiddenProjectRefs.has(projectRef)) {
    throw new Error('Configuração bloqueada: a referência pertence a outro produto.')
  }
  if (local && !allowLocal) throw new Error('Configuração bloqueada: endpoint local fora do ambiente de desenvolvimento.')
  if (!local && (projectRef !== ATRIANUTRI_PROJECT_REF || url.hostname !== `${ATRIANUTRI_PROJECT_REF}.supabase.co`)) {
    throw new Error('Configuração bloqueada: o frontend aceita somente o projeto exclusivo do AtriaNutri.')
  }
  if (url.protocol !== 'https:' && !local) throw new Error('Configuração bloqueada: o Supabase remoto exige HTTPS.')

  return { url: url.toString().replace(/\/$/, ''), projectRef }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey || import.meta.env.VITE_DATA_MODE !== 'supabase') return null

  const validated = validateSupabaseProjectUrl(url)

  client = createClient(validated.url, publishableKey, {
    // Health data sessions stay memory-only until a reviewed secure storage strategy exists.
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

export function getSupabaseRuntime(): SupabaseRuntime | null {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return null
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const { projectRef } = validateSupabaseProjectUrl(configuredUrl)
  return {
    client: supabaseClient,
    projectRef,
    // This flag must stay false until remote RLS, backup and restoration are homologated.
    realDataApproved: import.meta.env.VITE_REAL_DATA_APPROVED === 'true',
  }
}
