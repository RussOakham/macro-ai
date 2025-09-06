import { useQuery } from '@tanstack/react-query'

import type { PaginationOptions } from '@/lib/types'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'

import { getChats } from '../../network/chat/get-chats'

/**
 * Hook to fetch user's chats with pagination
 * @param options - Pagination options (page, limit)
 * @returns TanStack Query result with chat list
 */
const useChats = (options?: PaginationOptions) => {
	return useQuery({
		queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list, options],
		queryFn: async () => getChats(options),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		refetchOnMount: true,
		select: (data) => {
			// Transform dates from strings to Date objects
			return {
				...data,
				data: data.data.map((chat) => ({
					...chat,
					createdAt: new Date(chat.createdAt ?? new Date()),
					updatedAt: new Date(chat.updatedAt ?? new Date()),
				})),
			}
		},
	})
}

export { useChats }
