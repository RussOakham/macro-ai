import type React from 'react'
import { useEffect, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { useChat } from 'ai/react'
import Cookies from 'js-cookie'
import { Bot, Loader2, Menu, Send, User } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const apiUrl = import.meta.env.VITE_API_URL
const apiKey = import.meta.env.VITE_API_KEY

const ChatInterface = () => {
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	// Get authentication token for API requests
	const accessToken = Cookies.get('macro-ai-accessToken')

	// Use Vercel's AI SDK useChat hook for streaming
	const { messages, input, handleInputChange, handleSubmit, isLoading } =
		useChat({
			api: currentChatId
				? `${apiUrl}/chats/${currentChatId}/stream`
				: undefined,
			headers: {
				Authorization: `Bearer ${accessToken ?? ''}`,
				'X-API-KEY': apiKey,
			},
			credentials: 'include',
			onResponse: (response) => {
				console.log('Response received:', response)
			},
			onError: (error) => {
				console.error('Chat error:', error)
				toast.error(`Chat error: ${error.message}`)
			},
			onFinish: (message) => {
				console.log('Message finished:', message)
			},
		})

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// Handle form submission with useChat's built-in handler
	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (!input.trim() || !currentChatId || isLoading) return
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
			<div className="flex-1 flex items-center justify-center bg-white">
				<div className="text-center max-w-md">
					<Bot className="h-16 w-16 mx-auto mb-6 text-gray-400" />
					<h2 className="text-3xl font-semibold mb-4 text-gray-800">
						ChatGPT Clone
					</h2>
					<p className="text-gray-600 mb-6">
						Start a new conversation to begin chatting with AI
					</p>
					<div className="space-y-2 text-sm text-gray-500">
						<p>• Ask questions and get helpful answers</p>
						<p>• Have natural conversations</p>
						<p>• Get assistance with various topics</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex-1 flex flex-col h-full bg-white">
			{/* Header */}
			<div className="border-b border-gray-200 p-4">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="sm" className="md:hidden">
						<Menu className="h-4 w-4" />
					</Button>
					<h1 className="font-semibold text-gray-800">Chat {currentChatId}</h1>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto">
				{messages.map((message) => (
					<div
						key={message.id}
						className={`border-b border-gray-100 ${message.role === 'assistant' ? 'bg-gray-50' : 'bg-white'}`}
					>
						<div className="max-w-4xl mx-auto p-6">
							<div className="flex gap-6">
								<div className="flex-shrink-0">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											message.role === 'assistant'
												? 'bg-green-500'
												: 'bg-blue-500'
										}`}
									>
										{message.role === 'assistant' ? (
											<Bot className="h-4 w-4 text-white" />
										) : (
											<User className="h-4 w-4 text-white" />
										)}
									</div>
								</div>
								<div className="flex-1 min-w-0">
									<div className="prose prose-sm max-w-none">
										<div className="whitespace-pre-wrap break-words text-gray-800">
											{message.content}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				))}

				{/* Loading indicator for streaming */}
				{isLoading && (
					<div className="border-b border-gray-100 bg-gray-50">
						<div className="max-w-4xl mx-auto p-6">
							<div className="flex gap-6">
								<div className="flex-shrink-0">
									<div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
										<Bot className="h-4 w-4 text-white" />
									</div>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<div className="flex gap-1">
											<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
											<div
												className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
												style={{ animationDelay: '0.1s' }}
											/>
											<div
												className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
												style={{ animationDelay: '0.2s' }}
											/>
										</div>
										<span className="text-sm text-gray-500">Thinking...</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-gray-200 bg-white">
				<div className="max-w-4xl mx-auto p-4">
					<form onSubmit={onSubmit} className="flex gap-3">
						<div className="flex-1 relative">
							<Textarea
								ref={textareaRef}
								value={input}
								onChange={handleInputChange}
								onKeyDown={handleKeyDown}
								placeholder="Send a message..."
								className="min-h-[44px] max-h-32 resize-none pr-12 border-gray-300 focus:border-gray-400 focus:ring-gray-400"
								disabled={isLoading}
								rows={1}
							/>
							<Button
								type="submit"
								disabled={!input.trim() || isLoading}
								size="sm"
								className="absolute right-2 bottom-2 h-8 w-8 p-0 bg-gray-800 hover:bg-gray-700"
							>
								{isLoading ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Send className="h-3 w-3" />
								)}
							</Button>
						</div>
					</form>
					<div className="text-xs text-gray-500 text-center mt-2">
						ChatGPT Clone can make mistakes. Consider checking important
						information.
					</div>
				</div>
			</div>
		</div>
	)
}

export { ChatInterface }
