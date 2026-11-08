import { describe, expect, it } from 'vitest'
import { ATRIANUTRI_PROJECT_REF, getSupabaseClient, validateSupabaseProjectUrl } from './supabase'

describe('Supabase client gate', () => {
  it('permanece desligado sem configuração explícita do projeto AtriaNutri', () => {
    expect(getSupabaseClient()).toBeNull()
  })

  it('aceita somente a referência remota exclusiva do AtriaNutri', () => {
    expect(validateSupabaseProjectUrl(`https://${ATRIANUTRI_PROJECT_REF}.supabase.co`, false).projectRef).toBe(ATRIANUTRI_PROJECT_REF)
    expect(() => validateSupabaseProjectUrl('https://tbbaiowzduqriwdjeacd.supabase.co', false)).toThrow('outro produto')
    expect(() => validateSupabaseProjectUrl('https://outroprojeto.supabase.co', false)).toThrow('somente o projeto')
  })

  it('aceita localhost somente quando explicitamente permitido', () => {
    expect(validateSupabaseProjectUrl('http://127.0.0.1:55421', true).projectRef).toBe('atrianutri-local')
    expect(() => validateSupabaseProjectUrl('http://127.0.0.1:55421', false)).toThrow('endpoint local')
  })
})
