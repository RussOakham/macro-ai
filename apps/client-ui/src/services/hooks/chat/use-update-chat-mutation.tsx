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

	// eslint-disable-next-line @tanstack/query/mutation-property-order
	return useMutation({
		mutationFn: async ({
			chatId,
			title,
		}: UpdateChatRequestBody & { chatId: UpdateChatRequestParam }) => {
			const response = await updateChatById(chatId, { title })
			return response
		},
		onError: (error, _variables, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if ((context as { previousChats?: GetChatsResponse }).previousChats) {
				queryClient.setQueryData(
					[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
					(context as { previousChats: GetChatsResponse }).previousChats,
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
					if (!oldData) return { data: [] }

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
		onSettled: async () => {
			// Always refetch after error or success to ensure we have the latest data
			await queryClient.invalidateQueries({
				queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.list],
			})
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
	})
}

export { useUpdateChatMutation }
