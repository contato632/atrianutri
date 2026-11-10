import type { FinancialCharge, FinancialChargeStatus, FinancialExpense, FinancialPayment } from './models'

export function assertMoneyCents(value: number, label = 'Valor') {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} deve ser informado em centavos inteiros e ser maior que zero.`)
  return value
}

export function netReceivedCents(chargeId: string, payments: FinancialPayment[]) {
  return payments.filter((item) => item.chargeId === chargeId).reduce((sum, item) => sum + (item.kind === 'receipt' ? item.amountCents : -item.amountCents), 0)
}

export function chargeBalanceCents(charge: FinancialCharge, payments: FinancialPayment[]) {
  return Math.max(0, charge.amountCents - netReceivedCents(charge.id, payments))
}

export function chargeStatus(charge: FinancialCharge, payments: FinancialPayment[], today: string): FinancialChargeStatus {
  if (charge.canceledAt) return 'canceled'
  const received = netReceivedCents(charge.id, payments)
  if (received >= charge.amountCents) return 'paid'
  if (received > 0) return 'partially-paid'
  if (charge.dueDate < today) return 'overdue'
  return 'pending'
}

export function financialSummary(charges: FinancialCharge[], payments: FinancialPayment[], expenses: FinancialExpense[], startDate: string, endDate: string, today: string) {
  const inRange = (date: string) => date >= startDate && date <= endDate
  const receivedCents = payments.filter((item) => inRange(item.receivedAt)).reduce((sum, item) => sum + (item.kind === 'receipt' ? item.amountCents : -item.amountCents), 0)
  const activeCharges = charges.filter((item) => !item.canceledAt)
  const pendingCents = activeCharges.filter((item) => inRange(item.dueDate)).reduce((sum, item) => sum + chargeBalanceCents(item, payments), 0)
  const overdueCents = activeCharges.filter((item) => item.dueDate < today && chargeBalanceCents(item, payments) > 0).reduce((sum, item) => sum + chargeBalanceCents(item, payments), 0)
  const forecastCents = activeCharges.filter((item) => item.dueDate >= today && inRange(item.dueDate)).reduce((sum, item) => sum + chargeBalanceCents(item, payments), 0)
  const paidExpensesCents = expenses.filter((item) => item.status === 'paid' && item.paidAt && inRange(item.paidAt)).reduce((sum, item) => sum + item.amountCents, 0)
  const plannedExpensesCents = expenses.filter((item) => item.status === 'planned' && inRange(item.dueDate)).reduce((sum, item) => sum + item.amountCents, 0)
  return { receivedCents, pendingCents, overdueCents, forecastCents, paidExpensesCents, plannedExpensesCents, operationalBalanceCents: receivedCents - paidExpensesCents }
}

export function monthlyFinancialEvolution(payments: FinancialPayment[], expenses: FinancialExpense[], months = 6) {
  const keys = new Set<string>()
  payments.forEach((item) => keys.add(item.receivedAt.slice(0, 7)))
  expenses.forEach((item) => keys.add((item.paidAt ?? item.competenceDate).slice(0, 7)))
  return [...keys].sort().slice(-months).map((month) => ({
    month,
    receivedCents: payments.filter((item) => item.receivedAt.startsWith(month)).reduce((sum, item) => sum + (item.kind === 'receipt' ? item.amountCents : -item.amountCents), 0),
    expensesCents: expenses.filter((item) => item.status === 'paid' && item.paidAt?.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0),
  }))
}
