import { ArrowRight, Banknote, CalendarDays, FileBarChart, LockKeyhole, Settings2, Stethoscope, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ServiceManagement } from '../components/ServiceManagement'

const modules = [
  { icon: CalendarDays, title: 'Agenda e recorrências', description: 'Organize consultas e disponibilidade por profissional.', status: 'Disponível', tone: 'blue', href:'/agenda' },
  { icon: Stethoscope, title: 'Serviços e valores', description: 'Cadastre consultas, retornos e duração padrão.', status: 'Disponível abaixo', tone: 'teal' },
  { icon: UsersRound, title: 'Equipe e permissões', description: 'Perfis por organização com acesso mínimo necessário.', status: 'RLS preparada', tone: 'violet' },
  { icon: Banknote, title: 'Financeiro', description: 'Cobranças, recebimentos e despesas, sem dados clínicos.', status: 'Disponível', tone: 'amber', href:'/financeiro' },
  { icon: FileBarChart, title: 'Relatórios', description: 'Indicadores operacionais sem exposição clínica indevida.', status: 'Planejado', tone: 'slate' },
  { icon: Settings2, title: 'Configurações', description: 'Dados do consultório, fuso e preferências.', status: 'Planejado', tone: 'slate' },
]

export function ManagementPage() {
  return (
    <div className="page-stack">
      <section className="section-intro"><div><h2>Gestão do consultório</h2><p>Módulos administrativos independentes do AtriaClinic e do AtriaMind.</p></div></section>
      <section className="management-note"><LockKeyhole size={18} /><div><strong>Separação por organização desde a fundação</strong><p>Cada registro administrativo e clínico é vinculado à organização. As políticas versionadas impedem acesso cruzado entre clínicas e profissionais.</p></div></section>
      <section className="module-grid">{modules.map(({ icon: Icon, title, description, status, tone, href }) => <article className="module-card panel" key={title}><span className={`module-icon ${tone}`}><Icon size={20} /></span><div><h3>{title}</h3><p>{description}</p></div><footer><span>{status}</span>{href?<Link to={href} aria-label={`Abrir ${title}`}><ArrowRight size={16}/></Link>:<button type="button" aria-label={`Abrir ${title}`} disabled><ArrowRight size={16} /></button>}</footer></article>)}</section>
      <ServiceManagement />
      <section className="panel reuse-panel"><div><span className="eyebrow">Decisão de arquitetura</span><h3>Reuso responsável do AtriaClinic</h3><p>Foram aproveitados os padrões de navegação, isolamento organizacional, papéis, RLS, auditoria e segurança de sessão. Código, chaves, projeto Supabase e dados permanecem totalmente separados.</p></div><span className="independent-badge"><LockKeyhole size={15} /> Produto independente</span></section>
    </div>
  )
}
