import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { logger } from '@/lib/logger/logger'

import { deleteChat } from '../../network/chat/deleteChat'
import type { TGetChatsResponse } from '../../network/chat/getChats'

/**
 * TanStack Query mutation hook for deleting an existing chat
 * Follows established patterns from createChat and updateChat mutations with proper cache management
 * @returns Mutation object with mutateAsync function and loading/error states
 */
const useDeleteChatMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ chatId }: { chatId: string }) => {
			const response = await deleteChat(chatId)
			return response
		},
		onSuccess: async (data, variables) => {
			// Invalidate and refetch chat list queries to reflect the deleted chat
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Remove the specific chat data from cache
			if (data.success) {
				queryClient.removeQueries({
					queryKey: [QUERY_KEY.chat, 'detail', variables.chatId],
				})
			}

			// Optimistically update any cached chat list data to remove the deleted chat
			queryClient.setQueriesData(
				{ queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list] },
				(oldData: TGetChatsResponse | undefined) => {
					if (!oldData || !oldData.success) return oldData

					return {
						...oldData,
						data: oldData.data.filter((chat) => chat.id !== variables.chatId),
						meta: {
							...oldData.meta,
							total: oldData.meta.total - 1,
						},
					}
				},
			)
		},
		onError: (error) => {
			// Error handling is managed by the component using this hook
			// Following the pattern from existing auth mutations
			logger.error('[useDeleteChatMutation]: unable to delete chat', {
				error,
			})
		},
	})
}

export { useDeleteChatMutation }
