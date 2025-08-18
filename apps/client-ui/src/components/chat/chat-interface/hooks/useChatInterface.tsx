import { useEffect, useRef } from 'react'

import { logger } from '@/lib/logger/logger'
import {
	useEnhancedChat,
	type UseEnhancedChatReturn,
} from '@/services/hooks/chat/useEnhancedChat'

interface UseChatInterfaceOptions {
	chatId: string | null
}

interface UseChatInterfaceReturn {
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
	isChatLoading: boolean
	chatData: UseEnhancedChatReturn['chatData']
	messagesEndRef: React.RefObject<HTMLDivElement | null>
	scrollToBottom: () => void
}

/**
 * Chat interface logic hook
 * Manages chat state, messaging, and auto-scroll behavior
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
		messages,
		input,
		handleInputChange,
		handleSubmit,
		status,
		isChatLoading,
		chatData,
	} = useEnhancedChat({
		chatId: chatId ?? '',
		onMessageSent: (messageId) => {
			logger.info(
				{
					messageId,
					chatId,
				},
				'[ChatInterface]: Message sent',
			)
		},
		onStreamingComplete: (messageId, content) => {
			logger.info(
				{
					messageId,
					chatId,
					contentLength: content.length,
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
		messages,
		input,
		handleInputChange,
		handleSubmit,
		status,
		isChatLoading,
		chatData,
		messagesEndRef,
		scrollToBottom,
	}
}

export { useChatInterface }
