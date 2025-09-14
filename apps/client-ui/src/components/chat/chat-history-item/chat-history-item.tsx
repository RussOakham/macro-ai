import { useNavigate, useParams } from '@tanstack/react-router'
import { Edit3, MessageSquare, Trash2 } from 'lucide-react'
import { startTransition } from 'react'

import { Button } from '@/components/ui/button'
import type { ChatWithDates } from '@/lib/types'

interface ChatHistoryItemProps {
	chat: ChatWithDates
	confirmDeleteChatId: null | string
	handleDeleteChat: (chatId: string) => void
	isPending: boolean
	onMobileClose?: () => void
	startEditing: (chat: ChatWithDates) => void
}

const ChatHistoryItem = ({
	chat,
	confirmDeleteChatId,
	handleDeleteChat,
	isPending,
	onMobileClose,
	startEditing,
}: ChatHistoryItemProps) => {
	const navigate = useNavigate()
	const params = useParams({ strict: false })
	const currentChatId = params.chatId ?? null

	return (
		<div className="flex items-center group">
			<button
				className={`flex-1 flex items-center gap-3 p-2 rounded text-left text-sm hover:bg-accent hover:text-accent-foreground ${
					currentChatId === chat.id
						? 'bg-accent text-accent-foreground'
						: 'text-card-foreground'
				}`}
				onClick={() => {
					startTransition(() => {
						void navigate({ to: `/chat/${chat.id}` })
					})
					// Close mobile sidebar when navigating to a chat
					onMobileClose?.()
				}}
			>
				<MessageSquare className="h-4 w-4 shrink-0" />
				<span className="truncate">{chat.title}</span>
			</button>
			<div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
				<Button
					className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
					onClick={() => {
						startEditing(chat)
					}}
					size="sm"
					variant="ghost"
				>
					<Edit3 className="h-3 w-3" />
				</Button>
				<Button
					className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
					disabled={isPending || confirmDeleteChatId !== null}
					onClick={() => {
						handleDeleteChat(chat.id)
					}}
					size="sm"
					variant="ghost"
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>
		</div>
	)
}

export { ChatHistoryItem }
