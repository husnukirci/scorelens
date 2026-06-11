import { classifyDrivers } from '@/features/explanation/classifyDrivers'

describe('classifyDrivers', () => {
  it('splits drivers into strengths, risks, and neutral facts by their point sign', () => {
    const result = classifyDrivers([
      'Income present in 5/6 months',
      'Savings behavior detected (+21 pts)',
      'Estimated 38 negative balance day(s) (-10 pts)',
      '1 late fee event(s) detected (-1 pts)',
      'Good cashflow months: 4/6',
    ])
    expect(result.strengths).toEqual(['Savings behavior detected (+21 pts)'])
    expect(result.risks).toEqual([
      'Estimated 38 negative balance day(s) (-10 pts)',
      '1 late fee event(s) detected (-1 pts)',
    ])
    expect(result.neutral).toEqual(['Income present in 5/6 months', 'Good cashflow months: 4/6'])
  })

  it('treats unsigned coverage and consistency statements as neutral facts', () => {
    const result = classifyDrivers([
      'Income covers essential expenses (1.41x)',
      'Essential payments detected consistently',
    ])
    expect(result.neutral).toHaveLength(2)
    expect(result.strengths).toHaveLength(0)
    expect(result.risks).toHaveLength(0)
  })

  it('handles empty driver lists', () => {
    expect(classifyDrivers([])).toEqual({ strengths: [], risks: [], neutral: [] })
  })
})
