import {describe,expect,it} from 'vitest'
import {hasAppointmentConflict,recurrenceDates} from './scheduling'

describe('agenda profissional',()=>{
  it('gera recorrências limitadas, aceita fim opcional e ignora dia inexistente no mês',()=>{expect(recurrenceDates('2026-01-31','monthly','2026-04-30')).toEqual(['2026-01-31','2026-03-31']);expect(recurrenceDates('2026-01-01','weekly','2030-01-01')).toHaveLength(104);expect(recurrenceDates('2026-01-01','weekly')).toHaveLength(104)})
  it('detecta sobreposição apenas para o mesmo profissional',()=>{const appointments=[{id:'a',professionalId:'p1',status:'scheduled',startsAt:'2026-11-08T12:00:00Z',endsAt:'2026-11-08T13:00:00Z'}] as never[];expect(hasAppointmentConflict(appointments,{startsAt:'2026-11-08T12:30:00Z',endsAt:'2026-11-08T13:30:00Z'},'p1')).toBe(true);expect(hasAppointmentConflict(appointments,{startsAt:'2026-11-08T12:30:00Z',endsAt:'2026-11-08T13:30:00Z'},'p2')).toBe(false)})
})
