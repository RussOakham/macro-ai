interface Message {
	id: string
	role: 'user' | 'assistant'
	content: string
	timestamp: Date
}

interface Chat {
	id: string
	title: string
	messages: Message[]
	createdAt: Date
	updatedAt: Date
}

interface ChatStore {
	chats: Chat[]
	currentChatId: string | null
	addChat: (chat: Chat) => void
	updateChat: (chatId: string, updates: Partial<Chat>) => void
	deleteChat: (chatId: string) => void
	setCurrentChat: (chatId: string | null) => void
	addMessage: (chatId: string, message: Message) => void
}

export type { Chat, ChatStore, Message }
