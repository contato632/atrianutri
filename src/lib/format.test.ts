import { describe, expect, it } from 'vitest'
import { currentDateInBahia, formatLongDateInBahia, relativeDateLabel } from './format'

describe('datas da interface em America/Bahia', () => {
  const now = new Date('2026-11-09T02:30:00.000Z')

  it('respeita a virada do dia no fuso da Bahia', () => {
    expect(currentDateInBahia(now)).toBe('2026-11-08')
    expect(formatLongDateInBahia(now)).toBe('Domingo, 8 de novembro')
  })

  it('calcula Hoje e Amanhã pela data local, não pela posição na lista', () => {
    expect(relativeDateLabel('2026-11-08T15:00:00.000Z', now)).toBe('Hoje')
    expect(relativeDateLabel('2026-11-09T15:00:00.000Z', now)).toBe('Amanhã')
    expect(relativeDateLabel('2026-11-10T15:00:00.000Z', now)).toContain('10 de nov.')
  })
})
