import { create } from 'zustand'
import { persist, StorageValue } from 'zustand/middleware'

import type { Chat, ChatStore, Message } from '@/lib/types'

// Sample data for demonstration
const sampleChats: Chat[] = [
	{
		id: '1',
		title: 'Help with React components',
		messages: [
			{
				id: '1',
				role: 'user',
				content: 'How do I create a reusable button component in React?',
				timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
			},
			{
				id: '2',
				role: 'assistant',
				content:
					"To create a reusable button component in React, you can define a component that accepts props for customization. Here's a basic example:\n\n```jsx\nfunction Button({ children, onClick, variant = 'primary', disabled = false }) {\n  const baseClasses = 'px-4 py-2 rounded font-medium';\n  const variantClasses = {\n    primary: 'bg-blue-500 text-white hover:bg-blue-600',\n    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'\n  };\n  \n  return (\n    <button \n      className={`${baseClasses} ${variantClasses[variant]}`}\n      onClick={onClick}\n      disabled={disabled}\n    >\n      {children}\n    </button>\n  );\n}\n```\n\nThis allows you to use it like: `<Button variant=\"primary\" onClick={handleClick}>Click me</Button>`",
				timestamp: new Date(Date.now() - 1000 * 60 * 29),
			},
		],
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
		updatedAt: new Date(Date.now() - 1000 * 60 * 29),
	},
	{
		id: '2',
		title: 'JavaScript array methods',
		messages: [
			{
				id: '3',
				role: 'user',
				content: "What's the difference between map, filter, and reduce?",
				timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
			},
			{
				id: '4',
				role: 'assistant',
				content:
					'Great question! Here are the key differences:\n\n**map()** - Transforms each element and returns a new array of the same length\n```js\n[1, 2, 3].map(x => x * 2) // [2, 4, 6]\n```\n\n**filter()** - Returns a new array with elements that pass a test\n```js\n[1, 2, 3, 4].filter(x => x > 2) // [3, 4]\n```\n\n**reduce()** - Reduces the array to a single value\n```js\n[1, 2, 3, 4].reduce((sum, x) => sum + x, 0) // 10\n```',
				timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 2),
			},
		],
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 2),
	},
]

export const useChatStore = create<ChatStore>()(
	persist(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		(set, _get) => ({
			chats: sampleChats,
			currentChatId: '1',

			addChat: (chat: Chat) => {
				set((state) => ({
					chats: [chat, ...state.chats],
					currentChatId: chat.id,
				}))
			},

			updateChat: (chatId: string, updates: Partial<Chat>) => {
				set((state) => ({
					chats: state.chats.map((chat) =>
						chat.id === chatId
							? { ...chat, ...updates, updatedAt: new Date() }
							: chat,
					),
				}))
			},

			deleteChat: (chatId: string) => {
				set((state) => ({
					chats: state.chats.filter((chat) => chat.id !== chatId),
					currentChatId:
						state.currentChatId === chatId ? null : state.currentChatId,
				}))
			},

			setCurrentChat: (chatId: string | null) => {
				set({ currentChatId: chatId })
			},

			addMessage: (chatId: string, message: Message) => {
				set((state) => ({
					chats: state.chats.map((chat) =>
						chat.id === chatId
							? {
									...chat,
									messages: [...chat.messages, message],
									updatedAt: new Date(),
									title:
										chat.messages.length === 0
											? message.content.slice(0, 50) + '...'
											: chat.title,
								}
							: chat,
					),
				}))
			},
		}),
		{
			name: 'chat-storage',
			storage: {
				getItem: (name) => {
					try {
						const str = localStorage.getItem(name)
						if (!str) return null
						const data = JSON.parse(str) as StorageValue<ChatStore>

						// Convert date strings back to Date objects

						data.state.chats = data.state.chats.map((chat: Chat) => ({
							...chat,
							createdAt: new Date(chat.createdAt),
							updatedAt: new Date(chat.updatedAt),
							messages: chat.messages.map((message: Message) => ({
								...message,
								timestamp: new Date(message.timestamp),
							})),
						}))

						return data
					} catch {
						// If parsing fails, return null to use default state
						return null
					}
				},
				setItem: (name, value) => {
					localStorage.setItem(name, JSON.stringify(value))
				},
				removeItem: (name) => {
					localStorage.removeItem(name)
				},
			},
		},
	),
)
