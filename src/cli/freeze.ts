import { mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { firstRoundAtOrAfter, quicknet, roundTime } from '../drand'
import { selectEligible, toEntries } from '../eligibility'
import { exists, fail, paths, sha256, sha256File, toJson, writeJson, writeNotes } from '../io'
import { algorithm, type Commitment } from '../records'
import { loadRules } from '../rules'
import { fetchSubscriptions, strapiConfig } from '../strapi'

const minimumLeadMs = 10 * 60 * 1000

const { values } = parseArgs({ options: { 'draw-at': { type: 'string' }, 'dry-run': { type: 'boolean', default: false } } })
const dryRun = values['dry-run']

if (!dryRun && exists(paths.commitment)) fail(`${paths.commitment} already exists: the list is already frozen`)

const drawAt = Date.parse(values['draw-at'] ?? '')
if (!dryRun && Number.isNaN(drawAt)) fail('--draw-at must be an ISO 8601 date, e.g. 2026-09-29T17:00:00+02:00')
if (!dryRun && drawAt < Date.now() + minimumLeadMs) fail('--draw-at must be at least 10 minutes in the future')

const rules = loadRules()
if (!dryRun && drawAt <= Date.parse(rules.closesAt)) fail('--draw-at must be after the contest closes')

const { eligible, excluded } = selectEligible(toEntries(await fetchSubscriptions(strapiConfig())), rules)

const countBy = <T>(items: readonly T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }), {})

const counts = {
  eligible: eligible.length,
  photo: eligible.filter((entry) => entry.mode === 'photo').length,
  quiz: eligible.filter((entry) => entry.mode === 'quiz').length,
  excluded: countBy(excluded, (entry) => entry.reason),
}

const prizeCount = rules.prizes.reduce((sum, prize) => sum + prize.count, 0)
if (eligible.length < prizeCount) fail(`only ${eligible.length} eligible entries for ${prizeCount} prizes`)

console.log(toJson(counts))
if (dryRun) process.exit(0)

const round = firstRoundAtOrAfter(drawAt)
mkdirSync('data', { recursive: true })
writeJson(paths.eligible, { contest: rules.contest, count: eligible.length, entries: eligible })
writeJson(paths.excluded, { contest: rules.contest, count: excluded.length, entries: excluded })

const commitment: Commitment = {
  contest: rules.contest,
  frozenAt: new Date().toISOString(),
  closesAt: rules.closesAt,
  rulesSha256: sha256File(paths.rules),
  eligibleSha256: sha256File(paths.eligible),
  excludedSha256: sha256File(paths.excluded),
  counts,
  drand: {
    network: 'quicknet',
    chainHash: quicknet.chainHash,
    publicKey: quicknet.publicKey,
    round,
    roundTime: new Date(roundTime(round)).toISOString(),
  },
  algorithm,
}
writeJson(paths.commitment, commitment)

const zurich = (iso: string): string => new Date(iso).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })

writeNotes(
  [
    `Liste des participations figée le ${zurich(commitment.frozenAt)} (heure de Lausanne).`,
    '',
    '| | |',
    '|---|---|',
    `| Participations retenues | **${counts.eligible}** (photo ${counts.photo}, quiz ${counts.quiz}) |`,
    `| Empreinte SHA-256 de \`eligible.json\` | \`${commitment.eligibleSha256}\` |`,
    `| Empreinte SHA-256 de \`commitment.json\` | \`${sha256(toJson(commitment))}\` |`,
    `| Round drand quicknet du tirage | **${round}** |`,
    `| Heure de publication du round | ${zurich(commitment.drand.roundTime)} |`,
    '',
    `Participations écartées : ${Object.entries(counts.excluded).map(([reason, count]) => `${reason} ${count}`).join(', ')}.`,
    '',
    "Le nombre aléatoire de ce round n'existe pas encore au moment du gel : personne ne peut le connaître ni l'influencer.",
  ].join('\n'),
)
console.log(`Frozen: ${counts.eligible} entries, drand round ${round} at ${commitment.drand.roundTime}`)
