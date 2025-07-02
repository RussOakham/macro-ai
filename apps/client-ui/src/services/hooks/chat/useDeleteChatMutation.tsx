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
		onMutate: async (variables) => {
			// Cancel any outgoing re-fetches (so they don't overwrite our optimistic update)
			await queryClient.cancelQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Snapshot the previous value
			const previousChats = queryClient.getQueryData<TGetChatsResponse>([
				QUERY_KEY.chat,
				QUERY_KEY_MODIFIERS.list,
			])

			// Optimistically update the cache to remove the deleted chat
			queryClient.setQueriesData(
				{ queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list] },
				(oldData: TGetChatsResponse | undefined) => {
					if (!oldData) return []

					return {
						...oldData,
						data: oldData.data.filter((chat) => chat.id !== variables.chatId),
						meta: {
							...oldData.meta,
							total: Math.max(0, oldData.meta.total - 1),
						},
					}
				},
			)

			// Return a context object with the snapshotted value
			return { previousChats }
		},
		onSuccess: (data, variables) => {
			// Remove the specific chat data from cache
			if (data.success) {
				queryClient.removeQueries({
					queryKey: [
						QUERY_KEY.chat,
						QUERY_KEY_MODIFIERS.detail,
						variables.chatId,
					],
				})
			}
		},
		onError: (error, _variables, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousChats) {
				queryClient.setQueryData(
					[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
					context.previousChats,
				)
			}

			// Error handling is managed by the component using this hook
			// Following the pattern from existing auth mutations
			logger.error('[useDeleteChatMutation]: unable to delete chat', {
				error,
			})
		},
		onSettled: async () => {
			// Always refetch after error or success to ensure we have the latest data
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})
		},
	})
}

export { useDeleteChatMutation }
