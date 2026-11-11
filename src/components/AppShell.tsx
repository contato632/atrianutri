import { BarChart3, BrainCircuit, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileText, FlaskConical, Home, LogOut, Menu, ShieldCheck, Sparkles, Users, Utensils, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'
import type { ProfessionalIdentity } from '../auth/types'
import { formatLongDateInBahia } from '../lib/format'

const primaryNavigation = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/avaliacoes', label: 'Avaliações', icon: ClipboardList },
  { to: '/planos', label: 'Planos alimentares', icon: Utensils },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/intelligence', label: 'Intelligence', icon: BrainCircuit },
  { to: '/gestao', label: 'Gestão', icon: BarChart3 },
]

const pageMeta: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Visão geral', eyebrow: '' },
  '/pacientes': { title: 'Pacientes', eyebrow: 'Cuidado contínuo' },
  '/avaliacoes': { title: 'Avaliações', eyebrow: 'Evolução nutricional' },
  '/planos': { title: 'Planos alimentares', eyebrow: 'Planejamento individualizado' },
  '/gestao': { title: 'Gestão', eyebrow: 'Consultório' },
  '/agenda': { title: 'Agenda', eyebrow: 'Organização profissional' },
  '/financeiro': { title: 'Financeiro', eyebrow: 'Gestão administrativa' },
  '/documentos': { title: 'Documentos', eyebrow: 'Relatórios profissionais' },
  '/intelligence': { title: 'Intelligence Nutricional', eyebrow: 'Acompanhamento longitudinal' },
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return <nav className="main-nav" aria-label="Navegação principal">{primaryNavigation.map(({ to, label, icon: Icon }) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
      <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
    </NavLink>
  ))}</nav>
}

type AppShellProps = {
  mode?: 'demo' | 'supabase'
  identity?: ProfessionalIdentity
  organizationId?: string
  onOrganizationChange?: (organizationId: string) => void
  onSignOut?: () => Promise<void>
}

export function AppShell({ mode = 'demo', identity, organizationId, onOrganizationChange, onSignOut }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const basePath = `/${location.pathname.split('/')[1]}`
  const configuredMeta = pageMeta[location.pathname] ?? pageMeta[basePath] ?? { title: 'AtriaNutri', eyebrow: 'AtriaCare' }
  const meta = location.pathname === '/' ? { ...configuredMeta, eyebrow: formatLongDateInBahia() } : configuredMeta

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand"><Brand compact={collapsed} /></div>
        <NavItems />
        <div className="sidebar__secondary">
          {mode === 'supabase' && <NavLink to="/seguranca" className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}><ShieldCheck size={19} /><span>Segurança</span></NavLink>}
        </div>
        <button type="button" className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Recolher menu</span></>}
        </button>
      </aside>

      <div id="mobile-navigation" className={`mobile-drawer ${mobileOpen ? 'mobile-drawer--open' : ''}`} aria-hidden={!mobileOpen} inert={!mobileOpen}>
        <div className="mobile-drawer__panel" role="dialog" aria-modal="true" aria-label="Menu principal">
          <div className="mobile-drawer__top"><Brand /><button type="button" className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X /></button></div>
          <NavItems onNavigate={() => setMobileOpen(false)} />
        </div>
        <button type="button" className="mobile-drawer__scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
      </div>

      <main className="app-main">
        <header className="topbar">
          <div className="topbar__title">
            <button type="button" className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="mobile-navigation"><Menu size={21} /></button>
            <div><span>{meta.eyebrow}</span><h1>{meta.title}</h1></div>
          </div>
          <div className="topbar__actions">
            <span className="demo-chip">{mode === 'demo' ? <><FlaskConical size={14} /> Demonstração</> : <><ShieldCheck size={14} /> Supabase</>}</span>
            {identity && identity.memberships.length > 1 && <select className="organization-select" value={organizationId} onChange={(event) => onOrganizationChange?.(event.target.value)} aria-label="Organização ativa">{identity.memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>)}</select>}
            <Link className="quick-calendar" to="/agenda"><CalendarDays size={18} /><span>Agenda</span></Link>
            <button className="profile-button" type="button" onClick={() => onSignOut && void onSignOut()} aria-label={identity ? 'Encerrar sessão' : 'Perfil de Dra. Marina'}><span>{identity ? identity.email.slice(0, 2).toUpperCase() : 'MM'}</span><div><strong>{identity?.email ?? 'Dra. Marina'}</strong><small>{identity ? 'Profissional verificado' : 'Nutricionista'}</small></div>{identity && <LogOut size={15} />}</button>
          </div>
        </header>

        <div className="demo-banner" role="status"><Sparkles size={16} /><span>{mode === 'demo' ? <><strong>Ambiente de demonstração.</strong> Todos os dados são fictícios e as alterações desta sessão não serão persistidas.</> : <><strong>Ambiente Supabase homologado.</strong> Utilize exclusivamente contas e pacientes fictícios durante os testes.</>}</span>{mode === 'demo' && <Link to="/portal" className="demo-portal-link">Abrir portal fictício</Link>}</div>
        <div className="page-container"><Outlet /></div>
      </main>

      <nav className="mobile-tabs" aria-label="Navegação mobile">
        {primaryNavigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label === 'Planos alimentares' ? 'Planos' : label}</span></NavLink>)}
      </nav>
    </div>
  )
}
