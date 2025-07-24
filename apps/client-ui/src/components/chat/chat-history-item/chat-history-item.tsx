import { startTransition } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Edit3, MessageSquare, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Chat } from '@/lib/types'

interface ChatHistoryItemProps {
	chat: Chat
	isPending: boolean
	onMobileClose?: () => void
	startEditing: (chat: Chat) => void
	handleDeleteChat: (chatId: string) => void
	confirmDeleteChatId: string | null
}

const ChatHistoryItem = ({
	chat,
	isPending,
	onMobileClose,
	startEditing,
	handleDeleteChat,
	confirmDeleteChatId,
}: ChatHistoryItemProps) => {
	const navigate = useNavigate()
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	return (
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
	)
}

export { ChatHistoryItem }
