import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'

export type TQueryKey = keyof typeof QUERY_KEY
export type TQueryKeyValue = (typeof QUERY_KEY)[TQueryKey]

export type TQueryKeyModifiers = keyof typeof QUERY_KEY_MODIFIERS
export type TQueryKeyModifiersValue =
	(typeof QUERY_KEY_MODIFIERS)[TQueryKeyModifiers]
