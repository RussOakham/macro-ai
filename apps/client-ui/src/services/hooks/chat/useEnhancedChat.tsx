import { useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { toast } from 'sonner'

import { QUERY_KEY, QUERY_KEY_MODIFIERS } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { tryCatch } from '@/lib/utils/error-handling/try-catch'

import { useChatById } from './useChatById'

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
	const chatHook = useChat({
		api: `${apiUrl}/chats/${chatId}/stream`,
		initialMessages,
		streamProtocol: 'text',
		headers: {
			Authorization: `Bearer ${accessToken ?? ''}`,
			'X-API-KEY': apiKey,
		},
		credentials: 'include',
		onResponse: (response) => {
			logger.info('[useEnhancedChat]: Response received', {
				chatId,
				status: response.status,
			})
		},
		onError: (error) => {
			// Integrate with our error handling patterns
			const standardizedError = standardizeError(error)
			logger.error('[useEnhancedChat]: Chat streaming error', {
				error: standardizedError,
				chatId,
			})
			toast.error(`Chat error: ${standardizedError.message}`)
		},
		onFinish: (message) => {
			logger.info('[useEnhancedChat]: Message streaming finished', {
				chatId,
				messageId: message.id,
				contentLength: message.content.length,
			})

			// Invalidate chat cache to ensure consistency (fire and forget)
			void tryCatch(
				queryClient.invalidateQueries({
					queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
				}),
				'useEnhancedChat - onFinish',
			).then(([, error]) => {
				if (error) {
					logger.error('[useEnhancedChat]: Failed to invalidate chat cache', {
						error: error.message,
						chatId,
						messageId: message.id,
					})
				}
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

							return {
								...oldData,
								data: {
									...oldData.data,
									messages: [...oldData.data.messages, tempUserMessage],
								},
							}
						},
					),
				),
				'useEnhancedChat - optimistic update',
			)

			if (cacheError) {
				logger.warn('[useEnhancedChat]: Failed to apply optimistic update', {
					error: cacheError.message,
					chatId,
				})
			}

			// Call callback for message sent
			onMessageSent?.(tempUserMessage.id)

			// Call original useChat submit (synchronous call)
			try {
				chatHook.handleSubmit(e)
			} catch (submitError) {
				const standardizedError = standardizeError(submitError)
				logger.error('[useEnhancedChat]: Failed to submit message', {
					error: standardizedError.message,
					chatId,
				})

				// Rollback optimistic update on error
				const [, rollbackError] = await tryCatch(
					queryClient.invalidateQueries({
						queryKey: [QUERY_KEY.chat, QUERY_KEY_MODIFIERS.detail, chatId],
					}),
					'useEnhancedChat - rollback',
				)

				if (rollbackError) {
					logger.error(
						'[useEnhancedChat]: Failed to rollback optimistic update',
						{
							error: rollbackError.message,
							chatId,
						},
					)
				}

				toast.error('Failed to send message. Please try again.')
			}
		},
		[
			chatHook.input,
			chatHook.handleSubmit,
			chatHook.status,
			queryClient,
			chatId,
			onMessageSent,
		],
	)

	return {
		// Expose all useChat properties
		messages: chatHook.messages,
		input: chatHook.input,
		handleInputChange: chatHook.handleInputChange,
		status: chatHook.status,
		error: chatHook.error,

		// Enhanced submit function
		handleSubmit: enhancedSubmit,

		// Additional state
		isChatLoading,
		chatData,
	}
}

export { useEnhancedChat }
export type { UseEnhancedChatOptions }
