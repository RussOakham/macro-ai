import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'

import { getChatById } from '../../network/chat/getChatById'

/**
 * Hook to fetch a specific chat with its messages by ID
 * @param chatId - The chat ID to retrieve
 * @returns TanStack Query result with chat and messages
 */
const useChatById = (chatId: string | undefined) => {
	return useQuery({
		queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
		queryFn: async () => {
			if (!chatId) {
				throw new Error('Chat ID is required')
			}
			return getChatById(chatId)
		},
		enabled: !!chatId, // Only run query if chatId is provided
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		refetchOnMount: true,
		select: (data) => {
			// Transform dates from strings to Date objects and ensure proper typing
			return {
				...data,
				data: {
					...data.data,
					createdAt: new Date(data.data.createdAt),
					updatedAt: new Date(data.data.updatedAt),
					messages: data.data.messages.map((message) => ({
						...message,
						createdAt: message.createdAt ? new Date(message.createdAt) : null,
					})),
				},
			}
		},
	})
}

export { useChatById }
