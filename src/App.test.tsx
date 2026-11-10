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
})
