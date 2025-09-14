import { useEffect, useRef } from 'react'

import { logger } from '@/lib/logger/logger'
import {
	useEnhancedChat,
	type UseEnhancedChatReturn,
} from '@/services/hooks/chat/use-enhanced-chat-mutation'

interface UseChatInterfaceOptions {
	chatId: null | string
}

interface UseChatInterfaceReturn {
	chatData: UseEnhancedChatReturn['chatData']
	handleInputChange: (
		e:
			| React.ChangeEvent<HTMLInputElement>
			| React.ChangeEvent<HTMLTextAreaElement>,
	) => void
	handleSubmit: (e: React.FormEvent) => Promise<void>
	input: string
	isChatLoading: boolean
	messages: {
		content: string
		id: string
		role: 'assistant' | 'data' | 'system' | 'user'
	}[]
	messagesEndRef: React.RefObject<HTMLDivElement | null>
	scrollToBottom: () => void
	status: 'error' | 'ready' | 'streaming' | 'submitted'
}

/**
 * Chat interface logic hook
 * Manages chat state, messaging, and auto-scroll behavior
 * @param options - Configuration options for the chat interface
 * @param options.chatId - The ID of the chat to manage
 * @returns Chat interface hook with messages, status, and scroll functions
 */
const useChatInterface = ({
	chatId,
}: UseChatInterfaceOptions): UseChatInterfaceReturn => {
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	// Use enhanced chat hook for streaming with TanStack Query integration
	const {
		chatData,
		handleInputChange,
		handleSubmit,
		input,
		isChatLoading,
		messages,
		status,
	} = useEnhancedChat({
		chatId: chatId ?? '',
		onMessageSent: (messageId) => {
			logger.info(
				{
					chatId,
					messageId,
				},
				'[ChatInterface]: Message sent',
			)
		},
		onStreamingComplete: (messageId, content) => {
			logger.info(
				{
					chatId,
					contentLength: content.length,
					messageId,
				},
				'[ChatInterface]: Streaming complete',
			)
		},
	})

	// Auto-scroll when messages change or during streaming
	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// Auto-scroll during streaming status changes
	useEffect(() => {
		if (status === 'streaming') {
			// Use a slight delay to ensure DOM updates are complete
			const timeoutId = setTimeout(scrollToBottom, 100)
			return () => {
				clearTimeout(timeoutId)
			}
		}
	}, [status])

	return {
		chatData,
		handleInputChange,
		handleSubmit,
		input,
		isChatLoading,
		messages,
		messagesEndRef,
		scrollToBottom,
		status,
	}
}

export { useChatInterface }
