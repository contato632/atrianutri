import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PatientForm } from './PatientForm'

describe('PatientForm', () => {
  it('valida antes de criar e envia um cadastro válido', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PatientForm onSubmit={onSubmit} onCancel={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Cadastrar paciente' }))
    expect(await screen.findByText('Informe o nome completo.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nome completo/), 'Carla Fictícia')
    await user.type(screen.getByLabelText(/Data de nascimento/), '1992-03-10')
    await user.type(screen.getByLabelText(/Telefone/), '(71) 99999-8888')
    await user.type(screen.getByLabelText(/E-mail/), 'carla@demo.local')
    await user.click(screen.getByRole('button', { name: 'Cadastrar paciente' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Carla Fictícia', email: 'carla@demo.local', status: 'active' }))
  })
})
