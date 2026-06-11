import { generateStressRecord } from '@/features/transactions/devStress'

describe('generateStressRecord', () => {
  it('produces the requested number of unique, well-formed transactions', () => {
    const record = generateStressRecord(2_000)
    const transactions = Object.values(record)
    expect(transactions).toHaveLength(2_000)
    for (const transaction of transactions.slice(0, 50)) {
      expect(transaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(transaction.amount).not.toBe(0)
      expect((transaction.amount > 0 ? 'credit' : 'debit') === transaction.type).toBe(true)
    }
  })

  it('is deterministic across runs', () => {
    expect(generateStressRecord(100)).toEqual(generateStressRecord(100))
  })
})
