import { useChat } from '@ai-sdk/react'
import { useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { tryCatch } from '@/lib/utils/error-handling/try-catch'

import { useChatById } from './use-chat-by-id'

const apiUrl = import.meta.env.VITE_API_URL
const apiKey = import.meta.env.VITE_API_KEY

interface UseEnhancedChatOptions {
	chatId: string
	onMessageSent?: (messageId: string) => void
	onStreamingComplete?: (messageId: string, content: string) => void
}

interface UseEnhancedChatReturn {
	messages: {
		id: string
		role: 'user' | 'assistant' | 'system' | 'data'
		content: string
	}[]
	input: string
	handleInputChange: (
		e:
			| React.ChangeEvent<HTMLInputElement>
			| React.ChangeEvent<HTMLTextAreaElement>,
	) => void
	handleSubmit: (e: React.FormEvent) => Promise<void>
	status: 'ready' | 'submitted' | 'streaming' | 'error'
	error: Error | undefined
	isChatLoading: boolean
	chatData: ReturnType<typeof useChatById>['data']
}

type TChatMessage = UseEnhancedChatReturn['messages'][number]

/**
 * Enhanced chat hook that integrates @ai-sdk/react useChat with TanStack Query
 * Provides streaming capabilities while maintaining proper cache synchronization
 *
 * Features:
 * - Real-time streaming with useChat
 * - TanStack Query cache integration
 * - Optimistic updates for user messages
 * - Go-style error handling integration
 * - Automatic cache invalidation
 */
const useEnhancedChat = ({
	chatId,
	onMessageSent,
	onStreamingComplete,
}: UseEnhancedChatOptions): UseEnhancedChatReturn => {
	const queryClient = useQueryClient()
	const accessToken = Cookies.get('macro-ai-accessToken')

	// Get existing chat data for initial messages
	const { data: chatData, isLoading: isChatLoading } = useChatById(chatId)

	// Transform existing messages to AI SDK format
	const initialMessages =
		chatData?.data.messages.map((message) => ({
			id: message.id,
			role: (['user', 'assistant', 'system'] as const).includes(
				message.role as 'user' | 'assistant' | 'system',
			)
				? (message.role as 'user' | 'assistant' | 'system')
				: 'user', // fallback to user role
			content: message.content,
		})) ?? []

	// Use Vercel's AI SDK useChat hook for streaming
	// Use chatId as the hook id to ensure separate instances for different chats
	const chatHook = useChat({
		id: chatId, // This ensures the hook resets when chatId changes
		api: `${apiUrl}/chats/${chatId}/stream`,
		initialMessages,
		streamProtocol: 'text',
		headers: {
			Authorization: `Bearer ${accessToken ?? ''}`,
			'X-API-KEY': apiKey,
		},
		credentials: 'include',
		onResponse: (response) => {
			logger.info(
				{
					chatId,
					status: response.status,
				},
				'[useEnhancedChat]: Response received',
			)
		},
		onError: (error) => {
			// Integrate with our error handling patterns
			const standardizedError = standardizeError(error)
			logger.error(
				{
					error: standardizedError,
					chatId,
				},
				'[useEnhancedChat]: Chat streaming error',
			)
			toast.error(`Chat error: ${standardizedError.message}`)
		},
		onFinish: (message) => {
			logger.info(
				{
					chatId,
					messageId: message.id,
					contentLength: message.content.length,
				},
				'[useEnhancedChat]: Message streaming finished',
			)

			// Invalidate chat cache to ensure consistency (fire and forget)
			void tryCatch(
				queryClient.invalidateQueries({
					queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
				}),
				'useEnhancedChat - onFinish',
			).then(([, error]) => {
				if (error) {
					logger.error(
						{
							error: error.message,
							chatId,
							messageId: message.id,
						},
						'[useEnhancedChat]: Failed to invalidate chat cache',
					)
					throw error
				}
				return
			})

			// Call optional callback
			onStreamingComplete?.(message.id, message.content)
		},
	})

	// Enhanced submit with optimistic updates and error handling
	const enhancedSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()

			if (!chatHook.input.trim() || chatHook.status === 'streaming') {
				return
			}

			const userMessageContent = chatHook.input.trim()

			// Create optimistic user message
			const tempUserMessage = {
				id: crypto.randomUUID(),
				role: 'user' as const,
				content: userMessageContent,
				createdAt: new Date(),
			}

			// Optimistic update for user message in TanStack Query cache
			const [, cacheError] = await tryCatch(
				Promise.resolve(
					queryClient.setQueryData(
						[QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
						(oldData: ReturnType<typeof useChatById>['data']) => {
							if (!oldData) return oldData

							const oldMessages = oldData.data.messages

							return {
								...oldData,
								data: {
									...oldData.data,
									messages: [...oldMessages, tempUserMessage],
								},
							}
						},
					),
				),
				'useEnhancedChat - optimistic update',
			)

			if (cacheError) {
				logger.warn(
					{
						error: cacheError.message,
						chatId,
					},
					'[useEnhancedChat]: Failed to apply optimistic update',
				)
			}

			// Call callback for message sent
			onMessageSent?.(tempUserMessage.id)

			// Call original useChat submit (synchronous call)
			try {
				chatHook.handleSubmit(e)
			} catch (submitError) {
				const standardizedError = standardizeError(submitError)
				logger.error(
					{
						error: standardizedError.message,
						chatId,
					},
					'[useEnhancedChat]: Failed to submit message',
				)

				// Rollback optimistic update on error
				const [, rollbackError] = await tryCatch(
					queryClient.invalidateQueries({
						queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
					}),
					'useEnhancedChat - rollback',
				)

				if (rollbackError) {
					logger.error(
						{
							error: rollbackError.message,
							chatId,
						},
						'[useEnhancedChat]: Failed to rollback optimistic update',
					)
				}

				toast.error('Failed to send message. Please try again.')
			}
		},
		[chatHook, queryClient, chatId, onMessageSent],
	)

	return {
		// Expose all useChat properties including all status values:
		// 'ready', 'submitted', 'streaming', 'error'
		messages: chatHook.messages,
		input: chatHook.input,
		handleInputChange: chatHook.handleInputChange,
		status: chatHook.status, // Directly exposes AI SDK's useChat status
		error: chatHook.error,

		// Enhanced submit function
		handleSubmit: enhancedSubmit,

		// Additional state
		isChatLoading,
		chatData,
	}
}

export { useEnhancedChat }
export type { TChatMessage, UseEnhancedChatOptions, UseEnhancedChatReturn }
