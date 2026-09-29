import { z } from 'zod'

export const algorithm = 'score = sha256(`${randomness}:${id}`) en hexadécimal ; classement par score croissant'

const Mode = z.enum(['photo', 'quiz'])

export const EligibleFile = z.object({
  contest: z.string(),
  count: z.number().int(),
  entries: z.array(z.object({ id: z.number().int(), mode: Mode })),
})

export const Commitment = z.object({
  contest: z.string(),
  frozenAt: z.iso.datetime(),
  closesAt: z.string(),
  rulesSha256: z.string(),
  eligibleSha256: z.string(),
  excludedSha256: z.string(),
  counts: z.object({
    eligible: z.number().int(),
    photo: z.number().int(),
    quiz: z.number().int(),
    excluded: z.record(z.string(), z.number().int()),
  }),
  drand: z.object({
    network: z.literal('quicknet'),
    chainHash: z.string(),
    publicKey: z.string(),
    round: z.number().int().positive(),
    roundTime: z.iso.datetime(),
  }),
  algorithm: z.string(),
})
export type Commitment = z.infer<typeof Commitment>

export const Result = z.object({
  contest: z.string(),
  eligibleSha256: z.string(),
  drand: z.object({
    round: z.number().int(),
    roundTime: z.iso.datetime(),
    randomness: z.string(),
    signature: z.string(),
    relays: z.array(z.string()),
  }),
  algorithm: z.string(),
  ranking: z.array(
    z.object({
      rank: z.number().int(),
      id: z.number().int(),
      mode: Mode,
      score: z.string(),
      prize: z.string().nullable(),
    }),
  ),
})
export type Result = z.infer<typeof Result>
