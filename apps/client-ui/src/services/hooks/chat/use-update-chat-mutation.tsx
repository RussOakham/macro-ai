import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { logger } from '@/lib/logger/logger'

import type { GetChatsResponse } from '../../network/chat/get-chats'

import { updateChatById } from '../../network/chat/update-chat'
import type {
	UpdateChatRequestBody,
	UpdateChatRequestParam,
} from '../../network/chat/update-chat'

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
		}: { chatId: UpdateChatRequestParam } & UpdateChatRequestBody) => {
			const response = await updateChatById(chatId, { title })
			return response
		},
		onMutate: async (variables) => {
			// Cancel any outgoing re-fetches (so they don't overwrite our optimistic update)
			await queryClient.cancelQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})

			// Snapshot the previous value
			const previousChats = queryClient.getQueryData<GetChatsResponse>([
				QUERY_KEY.chat,
				QUERY_KEY_MODIFIERS.list,
			])

			// Optimistically update the cache
			queryClient.setQueriesData(
				{ queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list] },
				(oldData: GetChatsResponse | undefined) => {
					if (!oldData) return []

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

			// Return a context object with the snapshotted value
			return { previousChats }
		},
		onSuccess: (data, variables) => {
			// Update the specific chat data in cache for immediate access
			if (data.success) {
				queryClient.setQueryData(
					[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, variables.chatId],
					data,
				)
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
			logger.error(
				{
					error,
				},
				'[useUpdateChatMutation]: unable to update chat',
			)
		},
		onSettled: async () => {
			// Always refetch after error or success to ensure we have the latest data
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})
		},
	})
}

export { useUpdateChatMutation }
