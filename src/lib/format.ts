export function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

export function formatDateTime(value?: string) {
  if (!value) return 'A definir'
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }).format(new Date(value))
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function statusLabel(status: string) {
  return ({ active: 'Em acompanhamento', 'follow-up': 'Retorno', paused: 'Pausado', draft: 'Rascunho', activePlan: 'Ativo' } as Record<string, string>)[status] ?? status
}
