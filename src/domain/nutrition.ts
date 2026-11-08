export type BmiCategory = {
  label: string
  tone: 'low' | 'neutral' | 'attention' | 'high'
  description: string
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    throw new Error('Informe um peso entre 1 e 500 kg.')
  }
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
    throw new Error('Informe uma altura entre 50 e 250 cm.')
  }

  const heightMeters = heightCm / 100
  return Number((weightKg / heightMeters ** 2).toFixed(1))
}

export function interpretAdultBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) {
    return { label: 'Abaixo da faixa de referência', tone: 'low', description: 'Requer avaliação clínica individual.' }
  }
  if (bmi < 25) {
    return { label: 'Faixa de referência', tone: 'neutral', description: 'Interprete junto à composição corporal e ao contexto.' }
  }
  if (bmi < 30) {
    return { label: 'Acima da faixa de referência', tone: 'attention', description: 'Não representa diagnóstico isoladamente.' }
  }
  return { label: 'Faixa elevada', tone: 'high', description: 'Avalie riscos e contexto de forma individualizada.' }
}

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const birth = new Date(`${birthDate}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return 0
  let age = today.getFullYear() - birth.getFullYear()
  const monthDifference = today.getMonth() - birth.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}
