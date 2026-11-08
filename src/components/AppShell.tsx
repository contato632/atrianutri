import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FlaskConical, HelpCircle, Home, Menu, Settings, Sparkles, Users, Utensils, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'

const primaryNavigation = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/avaliacoes', label: 'Avaliações', icon: ClipboardList },
  { to: '/planos', label: 'Planos alimentares', icon: Utensils },
  { to: '/gestao', label: 'Gestão', icon: BarChart3 },
]

const pageMeta: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Visão geral', eyebrow: 'Domingo, 8 de novembro' },
  '/pacientes': { title: 'Pacientes', eyebrow: 'Cuidado contínuo' },
  '/avaliacoes': { title: 'Avaliações', eyebrow: 'Evolução nutricional' },
  '/planos': { title: 'Planos alimentares', eyebrow: 'Planejamento individualizado' },
  '/gestao': { title: 'Gestão', eyebrow: 'Consultório' },
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return <nav className="main-nav" aria-label="Navegação principal">{primaryNavigation.map(({ to, label, icon: Icon }) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
      <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
    </NavLink>
  ))}</nav>
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const basePath = `/${location.pathname.split('/')[1]}`
  const meta = pageMeta[location.pathname] ?? pageMeta[basePath] ?? { title: 'AtriaNutri', eyebrow: 'AtriaCare' }

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand"><Brand compact={collapsed} /></div>
        <NavItems />
        <div className="sidebar__secondary">
          <button type="button" className="nav-item"><HelpCircle size={19} /><span>Ajuda</span></button>
          <button type="button" className="nav-item"><Settings size={19} /><span>Configurações</span></button>
        </div>
        <button type="button" className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Recolher menu</span></>}
        </button>
      </aside>

      <div className={`mobile-drawer ${mobileOpen ? 'mobile-drawer--open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="mobile-drawer__panel">
          <div className="mobile-drawer__top"><Brand /><button type="button" className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X /></button></div>
          <NavItems onNavigate={() => setMobileOpen(false)} />
        </div>
        <button type="button" className="mobile-drawer__scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
      </div>

      <main className="app-main">
        <header className="topbar">
          <div className="topbar__title">
            <button type="button" className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
            <div><span>{meta.eyebrow}</span><h1>{meta.title}</h1></div>
          </div>
          <div className="topbar__actions">
            <span className="demo-chip"><FlaskConical size={14} /> Demonstração</span>
            <button className="quick-calendar" type="button"><CalendarDays size={18} /><span>Agenda</span></button>
            <button className="profile-button" type="button" aria-label="Perfil de Dra. Marina"><span>MM</span><div><strong>Dra. Marina</strong><small>Nutricionista</small></div></button>
          </div>
        </header>

        <div className="demo-banner" role="status">
          <Sparkles size={16} />
          <span><strong>Ambiente de demonstração.</strong> Todos os dados são fictícios e as alterações desta sessão não serão persistidas.</span>
        </div>
        <div className="page-container"><Outlet /></div>
      </main>

      <nav className="mobile-tabs" aria-label="Navegação mobile">
        {primaryNavigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label === 'Planos alimentares' ? 'Planos' : label}</span></NavLink>)}
      </nav>
    </div>
  )
}
