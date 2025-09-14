import type { ChatMessage } from '@repo/macro-ai-api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { logger } from '@/lib/logger/logger'

import { postCreateChat } from '../../network/chat/create-chat'
import type { CreateChatRequest } from '../../network/chat/create-chat'

/**
 * TanStack Query mutation hook for creating a new chat
 * Follows established patterns from auth mutations with proper cache invalidation
 * @returns Mutation object with mutateAsync function and loading/error states
 */
const useCreateChatMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ title }: CreateChatRequest) => {
			const response = await postCreateChat({ title })
			return response
		},
		onError: (error) => {
			// Error handling is managed by the component using this hook
			// Following the pattern from existing auth mutations
			logger.error(
				{
					error,
				},
				'[useCreateChatMutation]: unable to create chat',
			)
		},
		onSuccess: async (data) => {
			// Invalidate and refetch chat list queries to include the new chat
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Optionally set the new chat data in cache for immediate access
			if (data.success) {
				// Add empty messages array to the chat data
				const dataWithEmptyMessages = {
					...data,
					messages: [] as ChatMessage[],
				}

				queryClient.setQueryData(
					[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, data.data.id],
					dataWithEmptyMessages,
				)
			}
		},
	})
}

export { useCreateChatMutation }
