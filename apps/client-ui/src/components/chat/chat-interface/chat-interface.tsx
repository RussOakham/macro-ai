import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Bot, Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { useEnhancedChat } from '@/services/hooks/chat/useEnhancedChat'

import { ChatInput } from '../chat-input/chat-input'
import { ChatMessage } from '../chat-message/chat-message'
import { ChatMessageLoadingIndicator } from '../chat-message/chat-message-loading-indicator'
import { ChatMessageStreamingIndicator } from '../chat-message/chat-message-streaming-indicator'

import { ChatInterfaceError } from './chat-interface-error'
import { ChatInterfaceLoading } from './chat-interface-loading'

interface ChatInterfaceProps {
	onMobileSidebarToggle?: () => void
}

const ChatInterface = ({
	onMobileSidebarToggle,
}: ChatInterfaceProps): React.JSX.Element => {
	// Use useRouterState to get the current location and extract chatId
	// This ensures we get updates when the route changes
	const routerState = useRouterState()
	const currentChatId = useMemo(() => {
		// Extract chatId from the current location pathname
		const pathname = routerState.location.pathname
		const chatIdRegex = /^\/chat\/([^/]+)$/
		const chatIdMatch = chatIdRegex.exec(pathname)
		return chatIdMatch ? chatIdMatch[1] : null
	}, [routerState.location.pathname])

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
		chatId: currentChatId ?? '',
		onMessageSent: (messageId) => {
			logger.info('[ChatInterface]: Message sent', {
				messageId,
				chatId: currentChatId,
			})
		},
		onStreamingComplete: (messageId, content) => {
			logger.info('[ChatInterface]: Streaming complete', {
				messageId,
				chatId: currentChatId,
				contentLength: content.length,
			})
		},
	})

	// Handle case where no chat ID is provided
	const isChatError = !currentChatId
	const chatError = !currentChatId ? new Error('No chat ID provided') : null

	const messagesEndRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

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

	// Handle form submission with enhanced handler
	const onSubmit = async (
		e: React.FormEvent<HTMLFormElement>,
	): Promise<void> => {
		e.preventDefault()
		if (!input.trim() || !currentChatId || status === 'streaming') return
		await handleSubmit(e)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			// Create a synthetic form event for submission
			const formEvent = new Event('submit', {
				bubbles: true,
				cancelable: true,
			}) as unknown as React.FormEvent<HTMLFormElement>
			void onSubmit(formEvent)
		}
	}

	// Handle no chat selected
	if (!currentChatId) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background h-full">
				<div className="text-center max-w-md">
					<Bot className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
					<h2 className="text-3xl font-semibold mb-4 text-foreground">
						ChatGPT Clone
					</h2>
					<p className="text-muted-foreground mb-6">
						Start a new conversation to begin chatting with AI
					</p>
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>• Ask questions and get helpful answers</p>
						<p>• Have natural conversations</p>
						<p>• Get assistance with various topics</p>
					</div>
				</div>
			</div>
		)
	}

	// Handle loading state for chat data
	if (isChatLoading) {
		return <ChatInterfaceLoading />
	}

	// Handle error state for chat data
	if (isChatError) {
		const err = standardizeError(chatError)
		return <ChatInterfaceError error={err} />
	}

	return (
		<div className="flex-1 flex flex-col h-full bg-background min-h-0">
			{/* Header */}
			<div className="border-b border-border p-4 flex-shrink-0">
				<div className="flex items-center justify-between w-full">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden"
							onClick={onMobileSidebarToggle}
						>
							<Menu className="h-4 w-4" />
						</Button>
						<h1 className="font-semibold text-foreground">
							{chatData?.data.title ?? `Chat ${currentChatId}`}
						</h1>
					</div>

					{/* Connection Status Indicator */}
					<div className="flex items-center gap-2 text-xs">
						{status === 'streaming' ? (
							<div className="flex items-center gap-1 text-primary">
								<div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
								<span className="hidden sm:inline">Streaming</span>
							</div>
						) : status === 'submitted' ? (
							<div className="flex items-center gap-1 text-muted-foreground">
								<div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
								<span className="hidden sm:inline">Processing</span>
							</div>
						) : (
							<div className="flex items-center gap-1 text-muted-foreground">
								<div className="w-2 h-2 bg-green-500 rounded-full" />
								<span className="hidden sm:inline">Ready</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto min-h-0">
				{messages.length === 0 &&
				status !== 'streaming' &&
				status !== 'submitted' ? (
					<div className="flex-1 flex items-center justify-center h-full">
						<div className="text-center max-w-md">
							<Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<h3 className="text-xl font-medium mb-2 text-foreground">
								Start the conversation
							</h3>
							<p className="text-muted-foreground">
								Send a message to begin chatting with AI
							</p>
						</div>
					</div>
				) : (
					messages.map((message) => (
						<ChatMessage key={message.id} message={message} />
					))
				)}

				{/* Loading state indicator - appears after message submission */}
				{status === 'submitted' ? <ChatMessageLoadingIndicator /> : null}

				{/* Enhanced streaming indicator */}
				{status === 'streaming' ? <ChatMessageStreamingIndicator /> : null}

				<div ref={messagesEndRef} />
			</div>

			<ChatInput
				onSubmit={onSubmit}
				input={input}
				handleInputChange={handleInputChange}
				handleKeyDown={handleKeyDown}
				status={status}
			/>
		</div>
	)
}

export { ChatInterface }
