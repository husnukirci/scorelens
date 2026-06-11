import { formatMoney } from './formatMoney'

describe('formatMoney', () => {
  it('formats euro amounts with german conventions', () => {
    const formatted = formatMoney(-25.84, 'EUR')
    expect(formatted).toContain('25,84')
    expect(formatted).toContain('€')
    expect(formatted).toMatch(/^-|^−/)
  })

  it('formats positive amounts without a sign prefix', () => {
    const formatted = formatMoney(3200, 'EUR')
    expect(formatted).toContain('3.200,00')
    expect(formatted).not.toMatch(/^-/)
  })
})
