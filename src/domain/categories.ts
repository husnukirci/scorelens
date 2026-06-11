/**
 * Category registry (ADR-12): presentation metadata keyed by the API's
 * merchant_category_code. The backend owns what a transaction *is*; this maps
 * codes to analyst-readable labels. Unknown codes render as themselves —
 * a new backend category must never crash a view. Adding one = one entry.
 * Codes and labels reflect live data (docs/api/findings.md §7).
 */

export interface CategoryMeta {
  mcc: string
  label: string
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { mcc: '4111', label: 'Public transport' },
  { mcc: '4900', label: 'Utilities' },
  { mcc: '5411', label: 'Groceries' },
  { mcc: '5691', label: 'Clothing' },
  { mcc: '5812', label: 'Restaurants & cafés' },
  { mcc: '6012', label: 'Fees & charges' },
  { mcc: '6300', label: 'Insurance' },
  { mcc: '6513', label: 'Rent' },
  { mcc: '6540', label: 'Transfers & savings' },
  { mcc: '7832', label: 'Cinema & entertainment' },
  { mcc: '7995', label: 'Gambling' },
  { mcc: '8011', label: 'Healthcare' },
  { mcc: '9001', label: 'Salary' },
  { mcc: '9002', label: 'Freelance income' },
]

const CATEGORY_BY_MCC: ReadonlyMap<string, CategoryMeta> = new Map(
  CATEGORIES.map((category) => [category.mcc, category]),
)

export function categoryLabel(mcc: string): string {
  return CATEGORY_BY_MCC.get(mcc)?.label ?? mcc
}
