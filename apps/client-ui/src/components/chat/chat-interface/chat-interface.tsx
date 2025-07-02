import type React from 'react'
import { useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { useParams } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import { Bot, Loader2, Menu, Send, User } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { router } from '@/main'
import { useChatById } from '@/services/hooks/chat/useChatById'

const apiUrl = import.meta.env.VITE_API_URL
const apiKey = import.meta.env.VITE_API_KEY

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const messageRoleSchema = z.enum(['user', 'assistant', 'system'])
type MessageRole = z.infer<typeof messageRoleSchema>

interface ChatInterfaceProps {
	onMobileSidebarToggle?: () => void
}

const ChatInterface = ({ onMobileSidebarToggle }: ChatInterfaceProps) => {
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	// Get authentication token for API requests
	const accessToken = Cookies.get('macro-ai-accessToken')

	// Fetch existing chat messages
	const {
		data: chatData,
		isLoading: isChatLoading,
		isError: isChatError,
		error: chatError,
	} = useChatById(currentChatId ?? undefined)

	// Transform existing messages to AI SDK format
	const initialMessages =
		chatData?.data.messages.map((message) => ({
			id: message.id,
			role: (['user', 'assistant', 'system'] as const).includes(
				message.role as MessageRole,
			)
				? (message.role as 'user' | 'assistant' | 'system')
				: 'user', // fallback to user role
			content: message.content,
		})) ?? []

	// Use Vercel's AI SDK useChat hook for streaming
	const { messages, input, handleInputChange, handleSubmit, status } = useChat({
		api: currentChatId ? `${apiUrl}/chats/${currentChatId}/stream` : undefined,
		initialMessages,
		streamProtocol: 'text', // Use text stream protocol
		headers: {
			Authorization: `Bearer ${accessToken ?? ''}`,
			'X-API-KEY': apiKey,
		},
		credentials: 'include',
		onResponse: (response) => {
			logger.info('Response received:', response)
		},
		onError: (error) => {
			logger.error('Chat error:', error)
			toast.error(`Chat error: ${error.message}`)
		},
		onFinish: (message) => {
			logger.info('Message finished:', message)
		},
	})

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

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

	// Handle form submission with useChat's built-in handler
	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (!input.trim() || !currentChatId || status === 'streaming') return
		handleSubmit(e)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			onSubmit(e as React.FormEvent)
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
		return (
			<div className="flex-1 flex items-center justify-center bg-background h-full">
				<div className="text-center">
					<Loader2 className="h-8 w-8 mx-auto mb-4 text-foreground animate-spin" />
					<p className="text-gray-600">Loading chat...</p>
				</div>
			</div>
		)
	}

	// Handle error state for chat data
	if (isChatError) {
		const err = standardizeError(chatError)
		return (
			<div className="flex-1 flex items-center justify-center h-full bg-background">
				<div className="text-center max-w-md">
					<Bot className="h-16 w-16 mx-auto mb-6 text-destructive" />
					<h2 className="text-2xl font-semibold mb-4 text-foreground">
						Error Loading Chat
					</h2>
					<p className="text-destructive mb-6">{err.message}</p>
					<Button
						onClick={async () => {
							await router.invalidate()
						}}
						variant="outline"
					>
						Try Again
					</Button>
				</div>
			</div>
		)
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
				{messages.length === 0 && status !== 'streaming' ? (
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
						<div
							key={message.id}
							className={`border-b border-border ${message.role === 'assistant' ? 'bg-muted/50' : 'bg-background'}`}
						>
							<div className="max-w-4xl mx-auto p-6">
								<div className="flex gap-6">
									<div className="flex-shrink-0">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center ${
												message.role === 'assistant'
													? 'bg-primary'
													: 'bg-secondary'
											}`}
										>
											{message.role === 'assistant' ? (
												<Bot className="h-4 w-4 text-primary-foreground" />
											) : (
												<User className="h-4 w-4 text-secondary-foreground" />
											)}
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="prose prose-sm max-w-none">
											<div className="whitespace-pre-wrap break-words text-foreground">
												{message.content}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					))
				)}

				{/* Enhanced streaming indicator */}
				{status === 'streaming' && (
					<div className="border-b border-border bg-gradient-to-r from-muted/50 to-accent/50">
						<div className="max-w-4xl mx-auto p-6">
							<div className="flex gap-6">
								<div className="flex-shrink-0">
									<div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center animate-pulse">
										<Bot className="h-4 w-4 text-primary-foreground" />
									</div>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3">
										<div className="flex gap-1">
											<div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
											<div
												className="w-2 h-2 bg-primary rounded-full animate-bounce"
												style={{ animationDelay: '0.1s' }}
											/>
											<div
												className="w-2 h-2 bg-primary rounded-full animate-bounce"
												style={{ animationDelay: '0.2s' }}
											/>
										</div>
										<span className="text-sm text-primary font-medium">
											AI is thinking...
										</span>
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
											<span>Connected</span>
										</div>
									</div>
									<div className="mt-2">
										<div className="w-full bg-muted rounded-full h-1">
											<div className="bg-gradient-to-r from-primary to-accent h-1 rounded-full animate-pulse w-3/4"></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border bg-background flex-shrink-0">
				<div className="max-w-4xl mx-auto p-4">
					<form onSubmit={onSubmit} className="flex gap-3">
						<div className="flex-1 relative">
							<Textarea
								ref={textareaRef}
								value={input}
								onChange={handleInputChange}
								onKeyDown={handleKeyDown}
								placeholder="Send a message..."
								className="min-h-[44px] max-h-32 resize-none pr-12"
								disabled={status === 'streaming'}
								rows={1}
							/>
							<Button
								type="submit"
								disabled={!input.trim() || status === 'streaming'}
								size="sm"
								className={`absolute right-2 bottom-2 h-8 w-8 p-0 transition-all duration-200 ${
									status === 'streaming'
										? 'bg-primary hover:bg-primary/90'
										: 'bg-foreground hover:bg-foreground/90'
								}`}
							>
								{status === 'streaming' ? (
									<Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
								) : (
									<Send className="h-3 w-3 text-background" />
								)}
							</Button>
						</div>
					</form>
					<div className="text-xs text-muted-foreground text-center mt-2">
						ChatGPT Clone can make mistakes. Consider checking important
						information.
					</div>
				</div>
			</div>
		</div>
	)
}

export { ChatInterface }
