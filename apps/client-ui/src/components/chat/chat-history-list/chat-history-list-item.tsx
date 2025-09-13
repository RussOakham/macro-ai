import { useState } from 'react'

import { logger } from '@/lib/logger/logger'
import type { ChatWithDates } from '@/lib/types'

import { ChatHistoryItem } from '../chat-history-item/chat-history-item'
import { ChatHistoryItemDelete } from '../chat-history-item/chat-history-item-delete'
import { ChatHistoryItemEdit } from '../chat-history-item/chat-history-item-edit'

interface ChatHistoryListItemProps {
	chat: ChatWithDates
	isPending: boolean
	onMobileClose?: () => void
}

const ChatHistoryListItem = ({
	chat,
	isPending,
	onMobileClose,
}: ChatHistoryListItemProps) => {
	const [editingChatId, setEditingChatId] = useState<null | string>(null)
	const [editTitle, setEditTitle] = useState('')
	const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<null | string>(
		null,
	)

	const startEditing = (chat: ChatWithDates) => {
		setEditingChatId(chat.id)
		setEditTitle(chat.title)
	}

	const handleDeleteChat = (chatId: string) => {
		// Show confirmation state
		setConfirmDeleteChatId(chatId)
		logger.info(
			{
				chatId,
			},
			'[ChatHistoryListItem]: Delete chat confirmation requested',
		)
	}

	const cancelDeleteChat = () => {
		setConfirmDeleteChatId(null)
	}

	if (confirmDeleteChatId === chat.id) {
		return (
			<div className="group px-3" key={chat.id}>
				<ChatHistoryItemDelete
					cancelDeleteChat={cancelDeleteChat}
					chat={chat}
					isPendingExternal={isPending}
					setConfirmDeleteChatId={setConfirmDeleteChatId}
				/>
			</div>
		)
	}

	if (editingChatId === chat.id) {
		return (
			<div className="group px-3" key={chat.id}>
				<ChatHistoryItemEdit
					chat={chat}
					editingChatId={editingChatId}
					editTitle={editTitle}
					isPending={isPending}
					setEditingChatId={setEditingChatId}
					setEditTitle={setEditTitle}
				/>
			</div>
		)
	}

	return (
		<div className="group px-3" key={chat.id}>
			<ChatHistoryItem
				chat={chat}
				confirmDeleteChatId={confirmDeleteChatId}
				handleDeleteChat={handleDeleteChat}
				isPending={isPending}
				onMobileClose={onMobileClose}
				startEditing={startEditing}
			/>
		</div>
	)
}

export { ChatHistoryListItem }
