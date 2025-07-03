import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { logger } from '@/lib/logger/logger'

import { createChat, TCreateChatRequest } from '../../network/chat/createChat'

/**
 * TanStack Query mutation hook for creating a new chat
 * Follows established patterns from auth mutations with proper cache invalidation
 * @returns Mutation object with mutateAsync function and loading/error states
 */
const useCreateChatMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ title }: TCreateChatRequest) => {
			const response = await createChat({ title })
			return response
		},
		onSuccess: async (data) => {
			// Invalidate and refetch chat list queries to include the new chat
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Set the new chat data in cache with empty messages array for immediate access
			// This prevents the undefined messages error when navigating to the new chat
			if (data.success) {
				const chatWithMessages = {
					...data,
					data: {
						...data.data,
						messages: [], // New chats start with empty messages array
					},
				}
				queryClient.setQueryData(
					[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, data.data.id],
					chatWithMessages,
				)
			}
		},
		onError: (error) => {
			// Error handling is managed by the component using this hook
			// Following the pattern from existing auth mutations
			logger.error('[useCreateChatMutation]: unable to create chat', {
				error,
			})
		},
	})
}

export { useCreateChatMutation }
