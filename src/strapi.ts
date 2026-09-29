import { z } from 'zod'

export const Subscription = z.object({
  id: z.number().int(),
  createdAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()).nullable(),
})
export type Subscription = z.infer<typeof Subscription>

const Page = z.object({
  data: z.array(Subscription),
  meta: z.object({ pagination: z.object({ page: z.number(), pageCount: z.number() }) }),
})

export type StrapiConfig = { baseUrl: string; token: string }

export const strapiConfig = (): StrapiConfig => {
  const token = process.env.STRAPI_TOKEN
  if (!token) throw new Error('STRAPI_TOKEN is not set')
  return { baseUrl: process.env.STRAPI_URL || 'https://strapi.lausannemusees.ch', token }
}

const fetchPage = async (config: StrapiConfig, query: URLSearchParams): Promise<z.infer<typeof Page>> => {
  const response = await fetch(`${config.baseUrl}/api/subscriptions?${query}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Strapi responded ${response.status}`)
  return Page.parse(await response.json())
}

export const fetchSubscriptions = async (config: StrapiConfig): Promise<Subscription[]> => {
  const rows: Subscription[] = []
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': '100', sort: 'id:asc' })
    const result = await fetchPage(config, query)
    rows.push(...result.data)
    if (page >= result.meta.pagination.pageCount) return rows
  }
}

export const fetchSubscriptionsByIds = async (config: StrapiConfig, ids: readonly number[]): Promise<Subscription[]> => {
  const query = new URLSearchParams({ 'pagination[pageSize]': String(ids.length) })
  ids.forEach((id, index) => query.append(`filters[id][$in][${index}]`, String(id)))
  return (await fetchPage(config, query)).data
}
