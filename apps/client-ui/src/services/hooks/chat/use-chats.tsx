import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import type { PaginationOptions } from '@/lib/types'

import { getChats } from '../../network/chat/get-chats'

/**
 * Hook to fetch user's chats with pagination
 * @param options - Pagination options (page, limit)
 * @returns TanStack Query result with chat list
 */
const useChats = (options?: PaginationOptions) => {
	return useQuery({
		gcTime: 10 * 60 * 1000, // 10 minutes
		queryFn: async () => getChats(options),
		queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list, options],
		refetchOnMount: true,
		refetchOnWindowFocus: false,
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
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
}

export { useChats }
