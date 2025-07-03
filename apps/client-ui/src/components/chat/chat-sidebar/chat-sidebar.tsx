import { useState, useTransition } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
	AlertCircle,
	Check,
	Edit3,
	Loader2,
	MessageSquare,
	Plus,
	Trash2,
	X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { logger } from '@/lib/logger/logger'
import type { Chat } from '@/lib/types'
import { useChats } from '@/services/hooks/chat/useChats'
import { useDeleteChatMutation } from '@/services/hooks/chat/useDeleteChatMutation'
import { useUpdateChatMutation } from '@/services/hooks/chat/useUpdateChatMutation'

import { CreateChatForm } from '../create-chat-form/create-chat-form'

interface ChatSidebarProps {
	onMobileClose?: () => void
}

const ChatSidebar = ({ onMobileClose }: ChatSidebarProps) => {
	// ============================================================================
	// State Management
	// ============================================================================

	// Navigation and route parameters
	const navigate = useNavigate()
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	// Local component state
	const [editingChatId, setEditingChatId] = useState<string | null>(null)
	const [editTitle, setEditTitle] = useState('')
	const [showCreateForm, setShowCreateForm] = useState(false)
	const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(
		null,
	)

	// React 19 useTransition for better UX
	const [isPending, startTransition] = useTransition()

	// ============================================================================
	// API Integration
	// ============================================================================

	// Fetch chats with TanStack Query
	const {
		data: chatsResponse,
		isLoading: isChatsLoading,
		isError: isChatsError,
		error: chatsError,
		refetch: refetchChats,
	} = useChats({ page: 1, limit: 100 }) // Get first 100 chats

	// Update chat mutation
	const { mutateAsync: updateChatMutation } = useUpdateChatMutation()

	// Delete chat mutation
	const { mutateAsync: deleteChatMutation } = useDeleteChatMutation()

	// Extract chats from response
	const chats = chatsResponse?.success ? chatsResponse.data : []

	// ============================================================================
	// Event Handlers
	// ============================================================================

	const createNewChat = () => {
		setShowCreateForm(true)
		logger.info('[ChatSidebar]: Create new chat form opened')
	}

	const handleCreateChatSuccess = (chatId: string) => {
		setShowCreateForm(false)
		startTransition(() => {
			void navigate({ to: `/chat/${chatId}` })
			logger.info(
				'[ChatSidebar]: Chat created successfully, navigating to chat',
				{
					chatId,
				},
			)
		})
	}

	const handleCreateChatCancel = () => {
		setShowCreateForm(false)
		logger.info('[ChatSidebar]: Create chat form cancelled')
	}

	const startEditing = (chat: Chat) => {
		setEditingChatId(chat.id)
		setEditTitle(chat.title)
	}

	const saveEdit = () => {
		if (!editingChatId || !editTitle.trim() || isPending) return

		const trimmedTitle = editTitle.trim()

		// Don't update if title hasn't changed
		const currentChat = chats.find((chat) => chat.id === editingChatId)
		if (currentChat?.title === trimmedTitle) {
			setEditingChatId(null)
			setEditTitle('')
			return
		}

		startTransition(async () => {
			try {
				await updateChatMutation({
					chatId: editingChatId,
					title: trimmedTitle,
				})

				logger.info('[ChatSidebar]: Chat updated successfully', {
					chatId: editingChatId,
					newTitle: trimmedTitle,
				})

				toast.success('Chat title updated successfully!')

				// Reset editing state
				setEditingChatId(null)
				setEditTitle('')
			} catch (error: unknown) {
				logger.error('[ChatSidebar]: Error updating chat', {
					chatId: editingChatId,
					newTitle: trimmedTitle,
					error: error instanceof Error ? error.message : 'Unknown error',
				})

				toast.error('Failed to update chat title. Please try again.')
				// Keep editing state active on error so user can retry
			}
		})
	}

	const cancelEdit = () => {
		setEditingChatId(null)
		setEditTitle('')
	}

	const handleDeleteChat = (chatId: string) => {
		// Show confirmation state
		setConfirmDeleteChatId(chatId)
		logger.info('[ChatSidebar]: Delete chat confirmation requested', {
			chatId,
		})
	}

	const confirmDeleteChat = (chatId: string) => {
		if (isPending) return // Prevent multiple simultaneous operations

		setConfirmDeleteChatId(null) // Hide confirmation

		startTransition(async () => {
			try {
				await deleteChatMutation({ chatId })

				logger.info('[ChatSidebar]: Chat deleted successfully', {
					chatId,
				})

				toast.success('Chat deleted successfully!')

				// If the deleted chat was the current chat, navigate to chat list
				if (currentChatId === chatId) {
					void navigate({ to: '/chat' })
				}
			} catch (error: unknown) {
				logger.error('[ChatSidebar]: Error deleting chat', {
					chatId,
					error: error instanceof Error ? error.message : 'Unknown error',
				})

				toast.error('Failed to delete chat. Please try again.')
			}
		})
	}

	const cancelDeleteChat = () => {
		setConfirmDeleteChatId(null)
		logger.info('[ChatSidebar]: Delete chat confirmation cancelled')
	}

	const handleRetry = () => {
		void refetchChats()
	}

	const formatDate = (date: Date | string) => {
		const now = new Date()
		const dateObj = date instanceof Date ? date : new Date(date)
		const diffInDays = Math.floor(
			(now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24),
		)

		if (diffInDays === 0) return 'Today'
		if (diffInDays === 1) return 'Yesterday'
		if (diffInDays < 7) return `${diffInDays.toString()} days ago`
		return dateObj.toLocaleDateString()
	}

	// Group chats by date
	const groupedChats = chats.reduce<Record<string, Chat[]>>((groups, chat) => {
		const dateKey = formatDate(chat.updatedAt)
		groups[dateKey] ??= []
		groups[dateKey].push(chat)
		return groups
	}, {})

	return (
		<div className="w-64 bg-card text-card-foreground flex flex-col h-full min-h-0 border-r border-border">
			{/* Header */}
			<div className="p-3 border-b border-border flex-shrink-0">
				<Button
					onClick={createNewChat}
					className="w-full justify-start gap-3"
					variant="outline"
				>
					<Plus className="h-4 w-4" />
					New chat
				</Button>
			</div>

			{/* Create Chat Form */}
			{showCreateForm && (
				<div className="p-3 border-b border-border bg-muted flex-shrink-0">
					<CreateChatForm
						onSuccess={handleCreateChatSuccess}
						onCancel={handleCreateChatCancel}
						className="text-foreground"
					/>
				</div>
			)}

			{/* Chat List */}
			<div className="flex-1 overflow-y-auto min-h-0">
				{isChatsLoading ? (
					<div className="flex items-center justify-center p-6">
						<div className="text-center">
							<Loader2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground animate-spin" />
							<p className="text-sm text-muted-foreground">Loading chats...</p>
						</div>
					</div>
				) : isChatsError ? (
					<div className="flex items-center justify-center p-6">
						<div className="text-center">
							<AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
							<p className="text-sm text-muted-foreground mb-2">
								Failed to load chats
							</p>
							<p className="text-xs text-muted-foreground mb-3">
								{chatsError instanceof Error
									? chatsError.message
									: 'An error occurred'}
							</p>
							<Button
								onClick={handleRetry}
								size="sm"
								variant="outline"
								className="text-xs"
							>
								Retry
							</Button>
						</div>
					</div>
				) : chats.length === 0 ? (
					<div className="flex items-center justify-center p-6">
						<div className="text-center">
							<MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
							<p className="text-sm text-muted-foreground">No chats yet</p>
							<p className="text-xs text-muted-foreground">
								Create your first chat to get started
							</p>
						</div>
					</div>
				) : (
					Object.entries(groupedChats).map(([dateGroup, chatsInGroup]) => (
						<div key={dateGroup} className="py-2">
							<div className="px-3 py-2 text-xs text-muted-foreground font-medium">
								{dateGroup}
							</div>
							<div className="space-y-1">
								{chatsInGroup.map((chat) => (
									<div key={chat.id} className="group px-3">
										{confirmDeleteChatId === chat.id ? (
											<div className="flex items-center gap-2 p-2 bg-destructive/20 border border-destructive rounded">
												<div className="flex-1">
													<p className="text-sm text-destructive-foreground">
														Delete "{chat.title}"?
													</p>
													<p className="text-xs text-muted-foreground">
														This action cannot be undone.
													</p>
												</div>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => {
														confirmDeleteChat(chat.id)
													}}
													disabled={isPending}
													className="h-6 w-6 p-0 text-destructive hover:text-destructive/80 disabled:opacity-50"
												>
													{isPending ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														<Check className="h-3 w-3" />
													)}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={cancelDeleteChat}
													disabled={isPending}
													className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										) : editingChatId === chat.id ? (
											<div className="flex items-center gap-2">
												<Input
													value={editTitle}
													onChange={(e) => {
														setEditTitle(e.target.value)
													}}
													disabled={isPending}
													className="h-8 text-sm disabled:opacity-50"
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															saveEdit()
														}
														if (e.key === 'Escape') {
															cancelEdit()
														}
													}}
													autoFocus
												/>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => {
														saveEdit()
													}}
													disabled={isPending}
													className="h-6 w-6 p-0 text-green-500 hover:text-green-600 disabled:opacity-50"
												>
													{isPending ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														<Check className="h-3 w-3" />
													)}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={cancelEdit}
													disabled={isPending}
													className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										) : (
											<div className="flex items-center group">
												<button
													onClick={() => {
														startTransition(() => {
															void navigate({ to: `/chat/${chat.id}` })
														})
														// Close mobile sidebar when navigating to a chat
														onMobileClose?.()
													}}
													className={`flex-1 flex items-center gap-3 p-2 rounded text-left text-sm hover:bg-accent hover:text-accent-foreground ${
														currentChatId === chat.id
															? 'bg-accent text-accent-foreground'
															: 'text-card-foreground'
													}`}
												>
													<MessageSquare className="h-4 w-4 shrink-0" />
													<span className="truncate">{chat.title}</span>
												</button>
												<div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => {
															startEditing(chat)
														}}
														className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
													>
														<Edit3 className="h-3 w-3" />
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => {
															handleDeleteChat(chat.id)
														}}
														disabled={isPending || confirmDeleteChatId !== null}
														className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					))
				)}
			</div>

			{/* Footer */}
			<div className="p-3 border-t border-gray-700">
				<div className="text-xs text-gray-400">ChatGPT Clone</div>
			</div>
		</div>
	)
}

export { ChatSidebar }
