import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const forbiddenProjectRefs = new Set([
  'tbbaiowzduqriwdjeacd', // AtriaClinic — jamais conectar o AtriaNutri.
])

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey || import.meta.env.VITE_DATA_MODE !== 'supabase') return null

  const projectRef = new URL(url).hostname.split('.')[0]
  if (forbiddenProjectRefs.has(projectRef)) {
    throw new Error('Configuração bloqueada: use um projeto Supabase exclusivo do AtriaNutri.')
  }

  client = createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
