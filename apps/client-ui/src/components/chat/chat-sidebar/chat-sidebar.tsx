import { useState } from 'react'
import { Check, Edit3, MessageSquare, Plus, Trash2, X } from 'lucide-react'

import { useChatStore } from '@/components/stores/chat-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Chat } from '@/lib/types'

const ChatSidebar = () => {
	const {
		chats,
		currentChatId,
		addChat,
		deleteChat,
		setCurrentChat,
		updateChat,
	} = useChatStore()
	const [editingChatId, setEditingChatId] = useState<string | null>(null)
	const [editTitle, setEditTitle] = useState('')

	const createNewChat = () => {
		const newChat: Chat = {
			id: crypto.randomUUID(),
			title: 'New Chat',
			messages: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		}
		addChat(newChat)
	}

	const startEditing = (chat: Chat) => {
		setEditingChatId(chat.id)
		setEditTitle(chat.title)
	}

	const saveEdit = () => {
		if (editingChatId && editTitle.trim()) {
			updateChat(editingChatId, { title: editTitle.trim() })
		}
		setEditingChatId(null)
		setEditTitle('')
	}

	const cancelEdit = () => {
		setEditingChatId(null)
		setEditTitle('')
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
		<div className="w-64 bg-gray-900 text-white flex flex-col h-full">
			{/* Header */}
			<div className="p-3 border-b border-gray-700">
				<Button
					onClick={createNewChat}
					className="w-full justify-start gap-3 bg-transparent border border-gray-600 hover:bg-gray-800"
					variant="outline"
				>
					<Plus className="h-4 w-4" />
					New chat
				</Button>
			</div>

			{/* Chat List */}
			<div className="flex-1 overflow-y-auto">
				{Object.entries(groupedChats).map(([dateGroup, chatsInGroup]) => (
					<div key={dateGroup} className="py-2">
						<div className="px-3 py-2 text-xs text-gray-400 font-medium">
							{dateGroup}
						</div>
						<div className="space-y-1">
							{chatsInGroup.map((chat) => (
								<div key={chat.id} className="group px-3">
									{editingChatId === chat.id ? (
										<div className="flex items-center gap-2">
											<Input
												value={editTitle}
												onChange={(e) => {
													setEditTitle(e.target.value)
												}}
												className="h-8 text-sm bg-gray-800 border-gray-600 text-white"
												onKeyDown={(e) => {
													if (e.key === 'Enter') saveEdit()
													if (e.key === 'Escape') cancelEdit()
												}}
												autoFocus
											/>
											<Button
												size="sm"
												variant="ghost"
												onClick={saveEdit}
												className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
											>
												<Check className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={cancelEdit}
												className="h-6 w-6 p-0 text-gray-400 hover:text-gray-300"
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									) : (
										<div className="flex items-center group">
											<button
												onClick={() => {
													setCurrentChat(chat.id)
												}}
												className={`flex-1 flex items-center gap-3 p-2 rounded text-left text-sm hover:bg-gray-800 ${
													currentChatId === chat.id ? 'bg-gray-800' : ''
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
													className="h-6 w-6 p-0 text-gray-400 hover:text-white"
												>
													<Edit3 className="h-3 w-3" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => {
														deleteChat(chat.id)
													}}
													className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
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
				))}
			</div>

			{/* Footer */}
			<div className="p-3 border-t border-gray-700">
				<div className="text-xs text-gray-400">ChatGPT Clone</div>
			</div>
		</div>
	)
}

export { ChatSidebar }
