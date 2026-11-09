import { describe, expect, it } from 'vitest'
import type { FinancialCharge, FinancialExpense, FinancialPayment } from './models'
import { chargeBalanceCents, chargeStatus, financialSummary, netReceivedCents } from './financial'

const charge: FinancialCharge = { id:'c1',patientId:'p1',professionalId:'u1',description:'Consulta',amountCents:25000,dueDate:'2026-11-10',administrativeNote:'',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-01T10:00:00Z' }
const payment = (id:string, amountCents:number, kind:'receipt'|'reversal'='receipt'): FinancialPayment => ({ id,chargeId:'c1',kind,amountCents,method:'pix',receivedAt:'2026-11-09',administrativeNote:'',idempotencyKey:id,createdAt:'2026-11-09T10:00:00Z',createdByLabel:'Demo' })

describe('financial domain', () => {
  it('calcula pagamento parcial, integral e estorno com centavos inteiros', () => {
    expect(chargeStatus(charge,[payment('a',10000)],'2026-11-09')).toBe('partially-paid')
    expect(chargeBalanceCents(charge,[payment('a',10000)])).toBe(15000)
    expect(chargeStatus(charge,[payment('a',10000),payment('b',15000)],'2026-11-09')).toBe('paid')
    expect(netReceivedCents('c1',[payment('a',25000),payment('r',5000,'reversal')])).toBe(20000)
  })
  it('marca vencimento somente quando ainda existe saldo', () => {
    expect(chargeStatus(charge,[],'2026-11-11')).toBe('overdue')
    expect(chargeStatus({...charge,canceledAt:'2026-11-05T10:00:00Z'},[],'2026-11-11')).toBe('canceled')
  })
  it('não mistura previsão com receita recebida no resumo', () => {
    const expense: FinancialExpense={id:'e1',categoryId:'cat',description:'Software',amountCents:5000,competenceDate:'2026-11-01',dueDate:'2026-11-08',paidAt:'2026-11-08',status:'paid',administrativeNote:'',createdAt:'',updatedAt:''}
    const result=financialSummary([charge],[payment('a',10000)],[expense],'2026-11-01','2026-11-30','2026-11-09')
    expect(result.receivedCents).toBe(10000);expect(result.forecastCents).toBe(15000);expect(result.operationalBalanceCents).toBe(5000)
  })
})
