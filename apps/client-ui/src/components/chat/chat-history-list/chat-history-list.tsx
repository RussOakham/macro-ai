import { AlertCircle, Loader2, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { type ChatWithDates } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils/datetime/format-relative-date'
import { useChats } from '@/services/hooks/chat/use-chats'

import { ChatHistoryDateGroup } from '../chat-history-date-group/chat-history-date-group'
import { ChatHistoryListItem } from './chat-history-list-item'

interface ChatHistoryListProps {
	isPending: boolean
	onMobileClose?: () => void
}

const ChatHistoryList = ({
	isPending,
	onMobileClose,
}: ChatHistoryListProps) => {
	const {
		data: chatsResponse,
		error: chatsError,
		isError: isChatsError,
		isLoading: isChatsLoading,
		refetch: refetchChats,
	} = useChats({ limit: 100, page: 1 }) // Get first 100 chats

	// Extract chats from response
	const chats = useMemo(
		() => (chatsResponse?.success ? chatsResponse.data : []),
		[chatsResponse],
	)

	const handleRetry = () => {
		void refetchChats()
	}

	// Group chats by date
	const groupedChats = useMemo(() => {
		return chats.reduce<Record<string, ChatWithDates[]>>((groups, chat) => {
			const dateKey = formatRelativeDate(chat.updatedAt)
			groups[dateKey] ??= []
			groups[dateKey].push(chat)
			return groups
		}, {})
	}, [chats])

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
						className="text-xs"
						onClick={handleRetry}
						size="sm"
						variant="outline"
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
				<ChatHistoryDateGroup dateGroup={dateGroup} key={dateGroup}>
					{chatsInGroup.map((chat) => (
						<ChatHistoryListItem
							chat={chat}
							isPending={isPending}
							key={chat.id}
							onMobileClose={onMobileClose}
						/>
					))}
				</ChatHistoryDateGroup>
			))}
		</>
	)
}

export { ChatHistoryList }
