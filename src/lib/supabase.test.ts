import { describe, expect, it } from 'vitest'
import { getSupabaseClient } from './supabase'

describe('Supabase client gate', () => {
  it('permanece desligado sem configuração explícita do projeto AtriaNutri', () => {
    expect(getSupabaseClient()).toBeNull()
  })
})
