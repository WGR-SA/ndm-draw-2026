import { fetchBeacon, HttpCachingChain, HttpChainClient } from 'drand-client'
import { sha256 } from './io'

export const quicknet = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  publicKey:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  genesisTime: 1692803367,
  period: 3,
} as const

export const relays = [
  'https://api.drand.sh',
  'https://api2.drand.sh',
  'https://api3.drand.sh',
  'https://drand.cloudflare.com',
] as const

export const roundTime = (round: number): number => (quicknet.genesisTime + (round - 1) * quicknet.period) * 1000

export const firstRoundAtOrAfter = (timeMs: number): number =>
  Math.max(1, Math.ceil((timeMs / 1000 - quicknet.genesisTime) / quicknet.period) + 1)

export type Beacon = { round: number; randomness: string; signature: string; relays: string[] }

const fetchFromRelay = async (relay: string, round: number) => {
  const options = {
    disableBeaconVerification: false,
    noCache: true,
    chainVerificationParams: { chainHash: quicknet.chainHash, publicKey: quicknet.publicKey },
  }
  const client = new HttpChainClient(new HttpCachingChain(`${relay}/${quicknet.chainHash}`, options), options)
  return fetchBeacon(client, round)
}

export const fetchVerifiedBeacon = async (round: number): Promise<Beacon> => {
  const results = await Promise.allSettled(relays.map((relay) => fetchFromRelay(relay, round)))
  const answered = results.flatMap((result, index) =>
    result.status === 'fulfilled' ? [{ relay: relays[index] as string, beacon: result.value }] : [],
  )
  if (answered.length < 2) throw new Error(`Only ${answered.length} drand relay(s) returned a verified beacon for round ${round}`)

  const [first] = answered
  if (!first) throw new Error('No beacon')
  if (answered.some(({ beacon }) => beacon.randomness !== first.beacon.randomness || beacon.signature !== first.beacon.signature))
    throw new Error('drand relays disagree')
  if (sha256(Buffer.from(first.beacon.signature, 'hex')) !== first.beacon.randomness)
    throw new Error('randomness is not sha256(signature)')

  return {
    round,
    randomness: first.beacon.randomness,
    signature: first.beacon.signature,
    relays: answered.map(({ relay }) => relay),
  }
}
