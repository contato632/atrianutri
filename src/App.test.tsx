import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App navigation', () => {
  it('renderiza navegação desktop e mobile e abre pacientes', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Bom dia, Marina.')).toBeInTheDocument()

    const navigation = screen.getAllByRole('navigation', { name: 'Navegação principal' })[0]
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação mobile' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('link', { name: 'Pacientes' })[0])
    expect(await screen.findByRole('heading', { name: 'Seus pacientes' })).toBeInTheDocument()
  })


  it('abre a Central de Documentos sem perder a navegação', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('link', { name: 'Documentos' }))[0])
    expect(await screen.findByRole('heading', { name: 'Central de documentos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Página A4 final' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
  })

  it('preserva o paciente em contexto durante a jornada profissional', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('link', { name: 'Pacientes' }))[0])
    const patientName = await screen.findByText('Ana Beatriz Lima')
    await user.click(patientName.closest('a')!)
    expect(await screen.findByRole('navigation', { name: 'Atalhos clínicos' })).toBeInTheDocument()
    expect(screen.getByText('Paciente em contexto')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Plano' }))
    expect(await screen.findByRole('heading', { name: 'Planejamento alimentar profissional' })).toBeInTheDocument()
    expect(screen.getByLabelText('Trocar contexto clínico')).toHaveValue('demo-patient-ana')
  })
})
