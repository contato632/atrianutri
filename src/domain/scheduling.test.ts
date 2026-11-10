import { describe, expect, it } from 'vitest'
import type { AppointmentInput } from './models'
import { dateInScheduleTimeZone, hasAppointmentConflict, localScheduleToIso, occurrenceInstants, recurrenceDates, timeInScheduleTimeZone } from './scheduling'

describe('agenda profissional',()=>{
  it('gera recorrências limitadas, aceita fim opcional e ignora dia inexistente no mês',()=>{expect(recurrenceDates('2026-01-31','monthly','2026-04-30')).toEqual(['2026-01-31','2026-03-31']);expect(recurrenceDates('2026-01-01','weekly','2030-01-01')).toHaveLength(104);expect(recurrenceDates('2026-01-01','weekly')).toHaveLength(104)})
  it('detecta sobreposição apenas para o mesmo profissional',()=>{const appointments=[{id:'a',professionalId:'p1',status:'scheduled',startsAt:'2026-11-08T12:00:00Z',endsAt:'2026-11-08T13:00:00Z'}] as never[];expect(hasAppointmentConflict(appointments,{startsAt:'2026-11-08T12:30:00Z',endsAt:'2026-11-08T13:30:00Z'},'p1')).toBe(true);expect(hasAppointmentConflict(appointments,{startsAt:'2026-11-08T12:30:00Z',endsAt:'2026-11-08T13:30:00Z'},'p2')).toBe(false)})
  it('converte horário civil no fuso da agenda sem fixar offset no contrato', () => {
    const instant = localScheduleToIso('2026-11-09', '09:30')
    expect(dateInScheduleTimeZone(instant)).toBe('2026-11-09')
    expect(timeInScheduleTimeZone(instant)).toBe('09:30')
  })
  it('preserva horário local e duração em toda a recorrência', () => {
    const input: AppointmentInput = { category:'lunch-break',status:'scheduled',title:'Almoço',privateTitle:'',administrativeNote:'',startsAt:localScheduleToIso('2026-11-09','12:00'),endsAt:localScheduleToIso('2026-11-09','13:00'),recurrenceFrequency:'weekly',recurrenceEndsOn:'2026-11-23' }
    const occurrences = occurrenceInstants(input)
    expect(occurrences).toHaveLength(3)
    expect(occurrences.map((item) => timeInScheduleTimeZone(item.startsAt))).toEqual(['12:00','12:00','12:00'])
    expect(occurrences.every((item) => new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime() === 3_600_000)).toBe(true)
  })
  it('aceita compromissos adjacentes e ignora cancelados', () => {
    const canceled = {id:'a',professionalId:'p1',status:'canceled',startsAt:'2026-11-08T12:00:00Z',endsAt:'2026-11-08T13:00:00Z'}
    const appointments=[canceled] as never[]
    expect(hasAppointmentConflict(appointments,{startsAt:'2026-11-08T12:30:00Z',endsAt:'2026-11-08T13:30:00Z'},'p1')).toBe(false)
    expect(hasAppointmentConflict([{...canceled,status:'scheduled'}] as never[],{startsAt:'2026-11-08T13:00:00Z',endsAt:'2026-11-08T14:00:00Z'},'p1')).toBe(false)
  })
})
