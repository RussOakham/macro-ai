import { QUERY_KEY } from '@/constants/query-keys'

export type TQueryKey = keyof typeof QUERY_KEY
export type TQueryKeyValue = (typeof QUERY_KEY)[TQueryKey]
