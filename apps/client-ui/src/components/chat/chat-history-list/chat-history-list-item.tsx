import { useState } from 'react'

import { logger } from '@/lib/logger/logger'
import { Chat } from '@/lib/types'

import { ChatHistoryItem } from '../chat-history-item/chat-history-item'
import { ChatHistoryItemDelete } from '../chat-history-item/chat-history-item-delete'
import { ChatHistoryItemEdit } from '../chat-history-item/chat-history-item-edit'

interface ChatHistoryListItemProps {
	chat: Chat
	isPending: boolean
	onMobileClose?: () => void
}

const ChatHistoryListItem = ({
	chat,
	isPending,
	onMobileClose,
}: ChatHistoryListItemProps) => {
	const [editingChatId, setEditingChatId] = useState<string | null>(null)
	const [editTitle, setEditTitle] = useState('')
	const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(
		null,
	)

	const startEditing = (chat: Chat) => {
		setEditingChatId(chat.id)
		setEditTitle(chat.title)
	}

	const handleDeleteChat = (chatId: string) => {
		// Show confirmation state
		setConfirmDeleteChatId(chatId)
		logger.info('[ChatSidebar]: Delete chat confirmation requested', {
			chatId,
		})
	}

	const cancelDeleteChat = () => {
		setConfirmDeleteChatId(null)
	}

	if (confirmDeleteChatId === chat.id) {
		return (
			<div key={chat.id} className="group px-3">
				<ChatHistoryItemDelete
					chat={chat}
					isPendingExternal={isPending}
					setConfirmDeleteChatId={setConfirmDeleteChatId}
					cancelDeleteChat={cancelDeleteChat}
				/>
			</div>
		)
	}

	if (editingChatId === chat.id) {
		return (
			<div key={chat.id} className="group px-3">
				<ChatHistoryItemEdit
					chat={chat}
					isPending={isPending}
					editingChatId={editingChatId}
					editTitle={editTitle}
					setEditingChatId={setEditingChatId}
					setEditTitle={setEditTitle}
				/>
			</div>
		)
	}

	return (
		<div key={chat.id} className="group px-3">
			<ChatHistoryItem
				chat={chat}
				isPending={isPending}
				onMobileClose={onMobileClose}
				startEditing={startEditing}
				handleDeleteChat={handleDeleteChat}
				confirmDeleteChatId={confirmDeleteChatId}
			/>
		</div>
	)
}

export { ChatHistoryListItem }
