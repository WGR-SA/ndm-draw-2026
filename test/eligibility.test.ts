import { describe, expect, it } from 'vitest'
import { selectEligible, toEntries } from '../src/eligibility'
import type { Rules } from '../src/rules'
import type { Subscription } from '../src/strapi'

const rules: Rules = {
  contest: 'test',
  closesAt: '2026-09-29T00:00:00+02:00',
  quizAnswers: { quiz_q1: 'b', quiz_q2: 'c', quiz_q3: 'd' },
  excludedEmailDomains: ['wgr.ch'],
  excludedIds: [{ id: 99, reason: 'test' }],
  prizes: [{ label: 'Prix', count: 1 }],
}

const photo = (id: number, email: string, lastname: string, createdAt = '2026-09-27T10:00:00.000Z'): Subscription => ({
  id,
  createdAt,
  data: { notification: 'concours-carnet', email, firstname: 'Ana', lastname, photo_url: `/uploads/${id}.jpg` },
})

const quiz = (id: number, email: string, lastname: string, answers = ['b', 'c', 'd']): Subscription => ({
  id,
  createdAt: '2026-09-27T10:00:00.000Z',
  data: {
    notification: 'concours-quiz',
    email,
    firstname: 'Ana',
    lastname,
    quiz_q1: answers[0],
    quiz_q2: answers[1],
    quiz_q3: answers[2],
  },
})

const run = (subscriptions: Subscription[]) => selectEligible(toEntries(subscriptions), rules)

describe('selectEligible', () => {
  it('ignores subscriptions that are not contest entries', () => {
    expect(run([{ id: 1, createdAt: '2026-09-27T10:00:00.000Z', data: { notification: 'contact-ndm' } }])).toEqual({
      eligible: [],
      excluded: [],
    })
  })

  it('excludes listed ids and excluded email domains as tests', () => {
    const { eligible, excluded } = run([photo(99, 'a@b.ch', 'X'), photo(2, 'someone@wgr.ch', 'Y')])
    expect(eligible).toEqual([])
    expect(excluded.map((entry) => entry.reason)).toEqual(['test', 'test'])
  })

  it('uses the Lausanne closing time, not UTC midnight', () => {
    const { eligible, excluded } = run([
      photo(1, 'a@b.ch', 'A', '2026-09-28T21:59:59.999Z'),
      photo(2, 'c@d.ch', 'C', '2026-09-28T22:00:00.000Z'),
    ])
    expect(eligible).toEqual([{ id: 1, mode: 'photo' }])
    expect(excluded).toEqual([{ id: 2, mode: 'photo', reason: 'after_close' }])
  })

  it('excludes wrong quiz answers and photos without a file', () => {
    const noFile: Subscription = { ...photo(2, 'c@d.ch', 'C'), data: { notification: 'concours-carnet', photo_url: null } }
    const { excluded } = run([quiz(1, 'a@b.ch', 'A', ['b', 'c', 'c']), noFile])
    expect(excluded.map((entry) => entry.reason)).toEqual(['wrong_answers', 'missing_photo'])
  })

  it('keeps one entry per person, preferring the photo, then the oldest', () => {
    const { eligible, excluded } = run([quiz(1, 'A@b.ch ', 'Müller'), photo(3, 'a@b.ch', 'Muller'), photo(2, 'a@b.ch', 'muller')])
    expect(eligible).toEqual([{ id: 2, mode: 'photo' }])
    expect(excluded).toEqual([
      { id: 1, mode: 'quiz', reason: 'duplicate', keptId: 2 },
      { id: 3, mode: 'photo', reason: 'duplicate', keptId: 2 },
    ])
  })

  it('treats family members sharing an email as different people', () => {
    expect(run([photo(1, 'family@b.ch', 'Paul'), photo(2, 'family@b.ch', 'Marie')]).eligible).toHaveLength(2)
  })
})
