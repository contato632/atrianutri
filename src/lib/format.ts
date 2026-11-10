export const APP_TIME_ZONE = 'America/Bahia'

export function currentDateInBahia(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: APP_TIME_ZONE,
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function formatLongDateInBahia(now = new Date()) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: APP_TIME_ZONE,
  }).format(now)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function relativeDateLabel(value: string, now = new Date()) {
  const date = currentDateInBahia(new Date(value))
  const today = currentDateInBahia(now)
  const tomorrow = new Date(`${today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (date === today) return 'Hoje'
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Amanhã'
  return formatDate(value)
}

export function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

export function formatDateTime(value?: string) {
  if (!value) return 'A definir'
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE }).format(new Date(value))
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function statusLabel(status: string) {
  return ({ active: 'Em acompanhamento', 'follow-up': 'Retorno', paused: 'Pausado', draft: 'Rascunho', activePlan: 'Ativo' } as Record<string, string>)[status] ?? status
}
