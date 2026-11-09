import type { Appointment, AppointmentInput } from './models'

export const SCHEDULE_TIME_ZONE = 'America/Bahia'
export const MAX_RECURRENCE_OCCURRENCES = 104
export const MAX_RECURRENCE_DAYS = 730

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHEDULE_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
})
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHEDULE_TIME_ZONE,
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export const dateInScheduleTimeZone = (iso: string) => dateFormatter.format(new Date(iso))
export const timeInScheduleTimeZone = (iso: string) => timeFormatter.format(new Date(iso))

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

/** Converts a wall-clock value to an instant without hard-coding an UTC offset. */
export function localScheduleToIso(date: string, time: string, timeZone = SCHEDULE_TIME_ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Data ou horário inválido.')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = new Date(targetAsUtc)
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(candidate, timeZone)
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    candidate = new Date(candidate.getTime() + targetAsUtc - representedAsUtc)
  }
  const resolved = zonedParts(candidate, timeZone)
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day || resolved.hour !== hour || resolved.minute !== minute) {
    throw new Error('Este horário não existe no fuso selecionado por causa de uma mudança de horário civil.')
  }
  return candidate.toISOString()
}

export const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

export function hasAppointmentConflict(appointments: Appointment[], candidate: Pick<AppointmentInput, 'startsAt' | 'endsAt'>, professionalId: string, excludedIds: string[] = []) {
  const start = new Date(candidate.startsAt).getTime()
  const end = new Date(candidate.endsAt).getTime()
  return appointments.some((item) => item.professionalId === professionalId
    && item.status !== 'canceled'
    && !excludedIds.includes(item.id)
    && start < new Date(item.endsAt).getTime()
    && end > new Date(item.startsAt).getTime())
}

export function recurrenceDates(firstDate: string, frequency: AppointmentInput['recurrenceFrequency'], endsOn?: string, limit = MAX_RECURRENCE_OCCURRENCES) {
  if (frequency === 'none') return [firstDate]
  const dates: string[] = []
  const first = new Date(`${firstDate}T12:00:00Z`)
  const boundedEnd = new Date(first)
  boundedEnd.setUTCDate(boundedEnd.getUTCDate() + MAX_RECURRENCE_DAYS)
  const requestedEnd = endsOn ? new Date(`${endsOn}T12:00:00Z`) : boundedEnd
  const end = requestedEnd < boundedEnd ? requestedEnd : boundedEnd
  if (frequency === 'monthly') {
    const desiredDay = first.getUTCDate()
    for (let offset = 0; dates.length < limit; offset += 1) {
      const monthStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + offset, 1, 12))
      if (monthStart > end) break
      const candidate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), desiredDay, 12))
      if (candidate.getUTCMonth() === monthStart.getUTCMonth() && candidate <= end) dates.push(candidate.toISOString().slice(0, 10))
    }
    return dates
  }
  const step = frequency === 'weekly' ? 7 : 14
  let cursor = first
  while (cursor <= end && dates.length < limit) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + step)
  }
  return dates
}

export function occurrenceInstants(input: AppointmentInput) {
  const localDate = dateInScheduleTimeZone(input.startsAt)
  const localTime = timeInScheduleTimeZone(input.startsAt)
  const durationMinutes = Math.round((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 60_000)
  return recurrenceDates(localDate, input.recurrenceFrequency, input.recurrenceEndsOn).map((date) => {
    const startsAt = localScheduleToIso(date, localTime)
    return { startsAt, endsAt: addMinutes(startsAt, durationMinutes) }
  })
}
