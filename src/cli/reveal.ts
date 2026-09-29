import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { fail, paths, readJson } from '../io'
import { Result } from '../records'
import { fetchSubscriptionsByIds, strapiConfig } from '../strapi'

const { values } = parseArgs({ options: { count: { type: 'string', default: '35' } } })
const count = Number(values.count)
if (!Number.isInteger(count) || count < 1) fail('--count must be a positive integer')

const config = strapiConfig()
const ranking = readJson(paths.result, Result).ranking.slice(0, count)
const rows = await fetchSubscriptionsByIds(
  config,
  ranking.map((entry) => entry.id),
)
const byId = new Map(rows.map((row) => [row.id, row.data ?? {}]))

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const csvCell = (value: string): string => `"${value.replaceAll('"', '""')}"`
const photoUrl = (value: unknown): string => (text(value) ? new URL(text(value), config.baseUrl).href : '')

const lines = [
  ['rang', 'prix', 'id', 'mode', 'prénom', 'nom', 'email', 'photo'],
  ...ranking.map((entry) => {
    const data = byId.get(entry.id) ?? {}
    return [
      String(entry.rank),
      entry.prize ?? 'suppléant',
      String(entry.id),
      entry.mode,
      text(data.firstname),
      text(data.lastname),
      text(data.email),
      photoUrl(data.photo_url),
    ]
  }),
]

mkdirSync('private', { recursive: true })
const target = 'private/winners.csv'
writeFileSync(target, `﻿${lines.map((line) => line.map(csvCell).join(';')).join('\n')}\n`)
console.log(`${ranking.length} rows written to ${target}`)
