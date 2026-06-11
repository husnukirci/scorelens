import type { Transaction, TransactionRecord } from '@/api/types'
import { CATEGORIES } from '@/domain/categories'

/**
 * Dev-only stress dataset (Tier 2 scaling evidence): synthetic transactions
 * pushed through the exact production pipeline — normalized record → derive →
 * virtualized grid. Deterministic (seeded LCG) so runs are comparable.
 * Live data peaks at 631 rows (findings §4); this proves headroom far beyond.
 * Ephemeral by design: any reconcile refetch — recovery reconnects AND the
 * degraded-mode safety interval — replaces the stress data with server truth.
 */

const MERCHANTS = [
  'Aldi',
  'Lidl',
  'REWE Markt',
  'BVG',
  'Stadtwerke Berlin',
  'Hausverwaltung',
  'Employer GmbH',
  'Starbucks',
  'CineStar',
  'Allianz Versicherung',
]

export function generateStressRecord(count: number): TransactionRecord {
  let seed = 0x5eed
  const next = (): number => {
    // Park–Miller LCG: deterministic, fast, good enough for fixtures
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  const record: Record<string, Transaction> = {}
  for (let index = 0; index < count; index += 1) {
    const credit = next() < 0.12
    const category = CATEGORIES[Math.floor(next() * CATEGORIES.length)]
    const merchant = MERCHANTS[Math.floor(next() * MERCHANTS.length)]
    const day = 1 + Math.floor(next() * 28)
    const month = 1 + Math.floor(next() * 12)
    const id = `stress_${String(index).padStart(6, '0')}`
    record[id] = {
      id,
      account_id: 'acc_stress_chk',
      user_id: 'user_stress',
      amount: credit
        ? Math.round(next() * 4000 * 100) / 100
        : -Math.round(next() * 250 * 100) / 100,
      currency: 'EUR',
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      description: `SYNTHETIC ${index}`,
      merchant_category_code: category?.mcc ?? '5411',
      merchant_name: merchant ?? 'Aldi',
      type: credit ? 'credit' : 'debit',
      synced_at: '2026-06-11T00:00:00.000Z',
    }
  }
  return record
}
