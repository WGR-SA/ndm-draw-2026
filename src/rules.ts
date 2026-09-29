import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { paths } from './io'

export const Rules = z.object({
  contest: z.string().min(1),
  closesAt: z.iso.datetime({ offset: true }),
  quizAnswers: z.record(z.string(), z.string()),
  excludedEmailDomains: z.array(z.string()),
  excludedIds: z.array(z.object({ id: z.number().int(), reason: z.string().min(1) })),
  prizes: z.array(z.object({ label: z.string().min(1), count: z.number().int().positive() })).min(1),
})
export type Rules = z.infer<typeof Rules>

export const loadRules = (): Rules => Rules.parse(JSON.parse(readFileSync(paths.rules, 'utf8')))
