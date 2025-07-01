import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { logger } from '@/lib/logger/logger'

import type { TGetChatsResponse } from '../../network/chat/getChats'
import { TUpdateChatRequest, updateChat } from '../../network/chat/updateChat'

/**
 * TanStack Query mutation hook for updating an existing chat
 * Follows established patterns from createChat mutation with proper cache management
 * @returns Mutation object with mutateAsync function and loading/error states
 */
const useUpdateChatMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			chatId,
			title,
		}: { chatId: string } & TUpdateChatRequest) => {
			const response = await updateChat(chatId, { title })
			return response
		},
		onSuccess: async (data, variables) => {
			// Invalidate and refetch chat list queries to reflect the updated chat
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Update the specific chat data in cache for immediate access
			if (data.success) {
				queryClient.setQueryData(
					[QUERY_KEY.chat, 'detail', variables.chatId],
					data,
				)
			}

			// Optimistically update any cached chat list data
			queryClient.setQueriesData(
				{ queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list] },
				(oldData: TGetChatsResponse | undefined) => {
					if (!oldData || !oldData.success) return oldData

					return {
						...oldData,
						data: oldData.data.map((chat) =>
							chat.id === variables.chatId
								? {
										...chat,
										title: variables.title,
										updatedAt: new Date().toISOString(),
									}
								: chat,
						),
					}
				},
			)
		},
		onError: (error) => {
			// Error handling is managed by the component using this hook
			// Following the pattern from existing auth mutations
			logger.error('[useUpdateChatMutation]: unable to update chat', {
				error,
			})
		},
	})
}

export { useUpdateChatMutation }
