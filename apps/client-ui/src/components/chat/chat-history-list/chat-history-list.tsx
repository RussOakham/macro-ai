import { AlertCircle, Loader2, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Chat } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils/datetime/formatRelativeDate'
import { useChats } from '@/services/hooks/chat/useChats'

import { ChatHistoryDateGroup } from '../chat-history-date-group/chat-history-date-group'

import { ChatHistoryListItem } from './chat-history-list-item'

interface ChatHistoryListProps {
	isPending: boolean
	onMobileClose?: () => void
}

const ChatHistoryList = ({
	isPending: isPending,
	onMobileClose,
}: ChatHistoryListProps) => {
	const {
		data: chatsResponse,
		isLoading: isChatsLoading,
		isError: isChatsError,
		error: chatsError,
		refetch: refetchChats,
	} = useChats({ page: 1, limit: 100 }) // Get first 100 chats

	// Extract chats from response
	const chats = chatsResponse?.success ? chatsResponse.data : []

	const handleRetry = () => {
		void refetchChats()
	}

	// Group chats by date
	const groupedChats = chats.reduce<Record<string, Chat[]>>((groups, chat) => {
		const dateKey = formatRelativeDate(chat.updatedAt)
		groups[dateKey] ??= []
		groups[dateKey].push(chat)
		return groups
	}, {})

	if (isChatsLoading) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="text-center">
					<Loader2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground animate-spin" />
					<p className="text-sm text-muted-foreground">Loading chats...</p>
				</div>
			</div>
		)
	}

	if (isChatsError) {
		return (
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
		)
	}

	if (chats.length === 0) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="text-center">
					<MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">No chats yet</p>
					<p className="text-xs text-muted-foreground">
						Create your first chat to get started
					</p>
				</div>
			</div>
		)
	}

	return (
		<>
			{Object.entries(groupedChats).map(([dateGroup, chatsInGroup]) => (
				<ChatHistoryDateGroup key={dateGroup} dateGroup={dateGroup}>
					{chatsInGroup.map((chat) => (
						<ChatHistoryListItem
							key={chat.id}
							chat={chat}
							isPending={isPending}
							onMobileClose={onMobileClose}
						/>
					))}
				</ChatHistoryDateGroup>
			))}
		</>
	)
}

export { ChatHistoryList }
