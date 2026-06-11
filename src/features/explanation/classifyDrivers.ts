export interface ClassifiedDrivers {
  strengths: string[]
  risks: string[]
  neutral: string[]
}

/**
 * Splits the backend's prose drivers by the sign of their embedded point
 * annotations: "(+N pts)" → strength, "(-N pts)" → risk, unannotated → fact.
 * The backend owns what each driver means; this only groups for reading.
 */
export function classifyDrivers(drivers: string[]): ClassifiedDrivers {
  const result: ClassifiedDrivers = { strengths: [], risks: [], neutral: [] }
  for (const driver of drivers) {
    if (/\(\+\d+ pts?\)/.test(driver)) result.strengths.push(driver)
    else if (/\(-\d+ pts?\)/.test(driver)) result.risks.push(driver)
    else result.neutral.push(driver)
  }
  return result
}
