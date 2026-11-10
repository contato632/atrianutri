import { describe, expect, it } from 'vitest'
import { calculateBmi, interpretAdultBmi } from './nutrition'

describe('calculateBmi', () => {
  it('calcula e arredonda para uma casa decimal', () => {
    expect(calculateBmi(70, 175)).toBe(22.9)
    expect(calculateBmi(69.7, 168)).toBe(24.7)
  })

  it('rejeita peso e altura fora dos limites de entrada', () => {
    expect(() => calculateBmi(0, 170)).toThrow('peso')
    expect(() => calculateBmi(70, 30)).toThrow('altura')
    expect(() => calculateBmi(Number.NaN, 170)).toThrow('peso')
  })
})

describe('interpretAdultBmi', () => {
  it('usa limites adultos sem apresentar diagnóstico', () => {
    expect(interpretAdultBmi(18.4).tone).toBe('low')
    expect(interpretAdultBmi(18.5).tone).toBe('neutral')
    expect(interpretAdultBmi(24.9).tone).toBe('neutral')
    expect(interpretAdultBmi(25).tone).toBe('attention')
    expect(interpretAdultBmi(30).tone).toBe('high')
    expect(interpretAdultBmi(30).description).toContain('contexto')
  })
})
