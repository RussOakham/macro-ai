import { useNavigate, useParams } from '@tanstack/react-router'
import { Check, Loader2, X } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger/logger'
import { type ChatWithDates } from '@/lib/types'
import { useDeleteChatMutation } from '@/services/hooks/chat/use-delete-chat-mutation'

interface ChatHistoryItemDeleteProps {
	chat: ChatWithDates
	isPendingExternal: boolean
	setConfirmDeleteChatId: (chatId: string | null) => void
	cancelDeleteChat: () => void
}

const ChatHistoryItemDelete = ({
	chat,
	isPendingExternal,
	setConfirmDeleteChatId,
	cancelDeleteChat,
}: ChatHistoryItemDeleteProps) => {
	const navigate = useNavigate()
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	// Delete chat mutation
	const { mutateAsync: deleteChatMutation } = useDeleteChatMutation()

	const [isPending, startTransition] = useTransition()

	const confirmDeleteChat = (chatId: string) => {
		if (isPendingExternal) {
			return
		} // Prevent multiple simultaneous operations

		setConfirmDeleteChatId(null) // Hide confirmation

		startTransition(async () => {
			try {
				await deleteChatMutation({ chatId })

				logger.info(
					{
						chatId,
					},
					'[ChatSidebar]: Chat deleted successfully',
				)

				toast.success('Chat deleted successfully!')

				// If the deleted chat was the current chat, navigate to chat list
				if (currentChatId === chatId) {
					void navigate({ to: '/chat' })
				}
			} catch (error: unknown) {
				logger.error(
					{
						chatId,
						error: error instanceof Error ? error.message : 'Unknown error',
					},
					'[ChatSidebar]: Error deleting chat',
				)

				toast.error('Failed to delete chat. Please try again.')
			}
		})
	}

	return (
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
	)
}

export { ChatHistoryItemDelete }
