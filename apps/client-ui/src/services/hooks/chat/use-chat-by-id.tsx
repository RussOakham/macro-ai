import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'

import { getChatById } from '../../network/chat/get-chat-by-id'

/**
 * Hook to fetch a specific chat with its messages by ID
 * @param chatId - The chat ID to retrieve
 * @returns TanStack Query result with chat and messages
 */
const useChatById = (chatId: string | undefined) => {
	return useQuery({
		enabled: !!chatId, // Only run query if chatId is provided
		gcTime: 10 * 60 * 1000, // 10 minutes
		queryFn: async () => {
			if (!chatId) {
				throw new Error('Chat ID is required')
			}
			return getChatById(chatId)
		},
		queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
		refetchOnMount: true,
		refetchOnWindowFocus: false,
		select: (data) => {
			// Transform dates from strings to Date objects and ensure proper typing
			return {
				...data,
				data: {
					...data.data,
					createdAt: new Date(data.data.createdAt),
					messages: data.data.messages.map((message) => ({
						...message,
						createdAt: message.createdAt ? new Date(message.createdAt) : null,
					})),
					updatedAt: new Date(data.data.updatedAt),
				},
			}
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
}

export { useChatById }
