import { sha256 } from './io'
import type { Eligible } from './eligibility'
import type { Rules } from './rules'

export type Ranked = Eligible & { rank: number; score: string; prize: string | null }

export const score = (randomness: string, id: number): string => sha256(`${randomness}:${id}`)

export const rank = (randomness: string, eligible: readonly Eligible[], prizes: Rules['prizes']): Ranked[] => {
  const labels = prizes.flatMap((prize) => Array.from({ length: prize.count }, () => prize.label))
  return eligible
    .map((entry) => ({ ...entry, score: score(randomness, entry.id) }))
    .sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : a.id - b.id))
    .map((entry, index) => ({ rank: index + 1, ...entry, prize: labels[index] ?? null }))
}
