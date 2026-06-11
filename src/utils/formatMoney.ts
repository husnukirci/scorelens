const formatters = new Map<string, Intl.NumberFormat>()

/** German conventions — the dataset is EUR with German merchants. */
export function formatMoney(amount: number, currency: string): string {
  let formatter = formatters.get(currency)
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  return formatter.format(amount)
}
