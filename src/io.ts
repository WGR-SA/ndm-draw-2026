import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { z } from 'zod'

export const paths = {
  rules: 'rules.json',
  eligible: 'data/eligible.json',
  excluded: 'data/excluded.json',
  commitment: 'data/commitment.json',
  result: 'data/result.json',
} as const

export const sha256 = (input: string | Buffer): string => createHash('sha256').update(input).digest('hex')

export const sha256File = (path: string): string => sha256(readFileSync(path))

export const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

export const writeJson = (path: string, value: unknown): void => writeFileSync(path, toJson(value))

export const readJson = <T extends z.ZodType>(path: string, schema: T): z.infer<T> =>
  schema.parse(JSON.parse(readFileSync(path, 'utf8')))

export const exists = (path: string): boolean => existsSync(path)

export const writeNotes = (markdown: string): void => {
  const target = process.env.NOTES_FILE
  if (target) writeFileSync(target, markdown)
}

export const fail = (message: string): never => {
  console.error(`Error: ${message}`)
  process.exit(1)
}
