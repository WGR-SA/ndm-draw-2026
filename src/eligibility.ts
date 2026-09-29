import { z } from 'zod'
import type { Rules } from './rules'
import type { Subscription } from './strapi'

export type Mode = 'photo' | 'quiz'

const ContestData = z.object({
  notification: z.enum(['concours-carnet', 'concours-quiz']),
  email: z.string().nullish(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  photo_url: z.string().nullish(),
})

export type Entry = {
  id: number
  createdAt: string
  mode: Mode
  email: string
  name: string
  hasPhoto: boolean
  answers: Readonly<Record<string, unknown>>
}

export type Eligible = { id: number; mode: Mode }
export type Excluded = { id: number; mode: Mode; reason: string; keptId?: number }

const normalize = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const toEntries = (subscriptions: readonly Subscription[]): Entry[] =>
  subscriptions.flatMap((subscription) => {
    const parsed = ContestData.safeParse(subscription.data)
    if (!parsed.success) return []
    const data = parsed.data
    return [
      {
        id: subscription.id,
        createdAt: subscription.createdAt,
        mode: data.notification === 'concours-carnet' ? 'photo' : 'quiz',
        email: normalize(data.email),
        name: normalize(`${data.firstname ?? ''} ${data.lastname ?? ''}`),
        hasPhoto: Boolean(data.photo_url),
        answers: subscription.data ?? {},
      },
    ]
  })

const exclusionReason = (entry: Entry, rules: Rules): string | undefined => {
  const listed = rules.excludedIds.find((excluded) => excluded.id === entry.id)
  if (listed) return listed.reason
  if (rules.excludedEmailDomains.some((domain) => entry.email.endsWith(`@${domain}`))) return 'test'
  if (Date.parse(entry.createdAt) >= Date.parse(rules.closesAt)) return 'after_close'
  if (entry.mode === 'photo' && !entry.hasPhoto) return 'missing_photo'
  if (entry.mode === 'quiz' && Object.entries(rules.quizAnswers).some(([key, answer]) => entry.answers[key] !== answer))
    return 'wrong_answers'
  return undefined
}

const byPreference = (a: Entry, b: Entry): number =>
  a.mode === b.mode ? a.id - b.id : a.mode === 'photo' ? -1 : 1

export const selectEligible = (
  entries: readonly Entry[],
  rules: Rules,
): { eligible: Eligible[]; excluded: Excluded[] } => {
  const excluded: Excluded[] = []
  const people = new Map<string, Entry[]>()

  for (const entry of entries) {
    const reason = exclusionReason(entry, rules)
    if (reason) {
      excluded.push({ id: entry.id, mode: entry.mode, reason })
      continue
    }
    const key = `${entry.email}|${entry.name}`
    people.set(key, [...(people.get(key) ?? []), entry])
  }

  const eligible: Eligible[] = []
  for (const group of people.values()) {
    const [kept, ...duplicates] = [...group].sort(byPreference)
    if (!kept) continue
    eligible.push({ id: kept.id, mode: kept.mode })
    excluded.push(...duplicates.map((entry) => ({ id: entry.id, mode: entry.mode, reason: 'duplicate', keptId: kept.id })))
  }

  return {
    eligible: eligible.sort((a, b) => a.id - b.id),
    excluded: excluded.sort((a, b) => a.id - b.id),
  }
}
