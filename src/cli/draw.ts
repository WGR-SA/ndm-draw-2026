import { setTimeout as sleep } from 'node:timers/promises'
import { fetchVerifiedBeacon, roundTime } from '../drand'
import { exists, fail, paths, readJson, sha256File, writeJson, writeNotes } from '../io'
import { rank } from '../ranking'
import { algorithm, Commitment, EligibleFile, type Result } from '../records'
import { loadRules } from '../rules'

const maximumWaitMs = 15 * 60 * 1000

if (!exists(paths.commitment)) fail('the list is not frozen yet')
if (exists(paths.result)) fail(`${paths.result} already exists: the draw has already taken place`)

const commitment = readJson(paths.commitment, Commitment)
if (sha256File(paths.rules) !== commitment.rulesSha256) fail('rules.json does not match the commitment')
if (sha256File(paths.eligible) !== commitment.eligibleSha256) fail('eligible.json does not match the commitment')

const { round } = commitment.drand
const waitMs = roundTime(round) - Date.now()
if (waitMs > maximumWaitMs) fail(`drand round ${round} is published at ${commitment.drand.roundTime}, run the draw after that`)
if (waitMs > 0) await sleep(waitMs + 5000)

const beacon = await fetchVerifiedBeacon(round)
const eligible = readJson(paths.eligible, EligibleFile)
const rules = loadRules()

const result: Result = {
  contest: commitment.contest,
  eligibleSha256: commitment.eligibleSha256,
  drand: { ...beacon, roundTime: commitment.drand.roundTime },
  algorithm,
  ranking: rank(beacon.randomness, eligible.entries, rules.prizes),
}
writeJson(paths.result, result)

const winners = result.ranking.filter((entry) => entry.prize)
writeNotes(
  [
    `Tirage effectué avec le round drand quicknet **${round}**.`,
    '',
    `Nombre aléatoire : \`${beacon.randomness}\``,
    '',
    `Signature vérifiée auprès de : ${beacon.relays.join(', ')}.`,
    '',
    '| Rang | Participation | Mode | Prix |',
    '|---:|---:|---|---|',
    ...winners.map((entry) => `| ${entry.rank} | ${entry.id} | ${entry.mode} | ${entry.prize} |`),
    '',
    'Suppléants, dans l’ordre : ' +
      result.ranking
        .slice(winners.length, winners.length + 10)
        .map((entry) => `${entry.id}`)
        .join(', ') +
      '. Le classement complet est dans `result.json`.',
  ].join('\n'),
)
console.log(`Draw done with round ${round}: ${winners.length} winners`)
