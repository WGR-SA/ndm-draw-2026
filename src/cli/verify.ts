import { fetchVerifiedBeacon } from '../drand'
import { exists, fail, paths, readJson, sha256File } from '../io'
import { rank } from '../ranking'
import { Commitment, EligibleFile, Result } from '../records'
import { loadRules } from '../rules'

const check = (label: string, ok: boolean): void => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) process.exitCode = 1
}

if (!exists(paths.commitment) || !exists(paths.result)) fail('commitment.json and result.json are required')

const commitment = readJson(paths.commitment, Commitment)
const result = readJson(paths.result, Result)
const eligible = readJson(paths.eligible, EligibleFile)

check('rules.json matches the commitment', sha256File(paths.rules) === commitment.rulesSha256)
check('eligible.json matches the commitment', sha256File(paths.eligible) === commitment.eligibleSha256)
check('excluded.json matches the commitment', sha256File(paths.excluded) === commitment.excludedSha256)
check('result uses the committed list', result.eligibleSha256 === commitment.eligibleSha256)
check('result uses the committed drand round', result.drand.round === commitment.drand.round)
check('list was frozen before the drand round', Date.parse(commitment.frozenAt) < Date.parse(commitment.drand.roundTime))

const beacon = await fetchVerifiedBeacon(commitment.drand.round)
check(`drand round ${beacon.round} signature is valid (${beacon.relays.length} relays)`, true)
check('result randomness matches drand', beacon.randomness === result.drand.randomness)

const expected = rank(beacon.randomness, eligible.entries, loadRules().prizes)
check('ranking is reproduced exactly', JSON.stringify(expected) === JSON.stringify(result.ranking))
