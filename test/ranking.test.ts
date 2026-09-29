import { describe, expect, it } from 'vitest'
import { firstRoundAtOrAfter, quicknet, roundTime } from '../src/drand'
import { rank, score } from '../src/ranking'

const randomness = 'a'.repeat(64)
const eligible = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, mode: 'photo' as const }))
const prizes = [
  { label: 'Famille', count: 2 },
  { label: 'Classique', count: 3 },
]

describe('rank', () => {
  it('orders every entry by its score and hands out prizes in order', () => {
    const ranking = rank(randomness, eligible, prizes)
    expect(ranking).toHaveLength(30)
    expect(ranking.map((entry) => entry.score)).toEqual([...ranking.map((entry) => entry.score)].sort())
    expect(ranking.map((entry) => entry.prize).slice(0, 6)).toEqual(['Famille', 'Famille', 'Classique', 'Classique', 'Classique', null])
  })

  it('does not depend on the input order', () => {
    expect(rank(randomness, [...eligible].reverse(), prizes)).toEqual(rank(randomness, eligible, prizes))
  })

  it('scores as sha256 of "randomness:id"', () => {
    expect(score('abc', 1)).toBe('bfcf0b9cbe9d8208b2cddd9a01c31a9a60698a106a0e4fc1664233a15f16acec')
  })
})

describe('drand rounds', () => {
  it('picks the first round published at or after a given time', () => {
    const round = firstRoundAtOrAfter(Date.parse('2026-09-29T17:00:00+02:00'))
    expect(roundTime(round)).toBeGreaterThanOrEqual(Date.parse('2026-09-29T17:00:00+02:00'))
    expect(roundTime(round - 1)).toBeLessThan(Date.parse('2026-09-29T17:00:00+02:00'))
    expect(roundTime(1)).toBe(quicknet.genesisTime * 1000)
  })
})
