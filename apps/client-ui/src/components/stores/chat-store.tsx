import { create } from 'zustand'
import { persist, StorageValue } from 'zustand/middleware'

import type { Chat, ChatStore, Message } from '@/lib/types'

// Sample data for demonstration
const sampleChats: Chat[] = []

export const useChatStore = create<ChatStore>()(
	persist(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		(set, _get) => ({
			chats: sampleChats,

			addChat: (chat: Chat) => {
				set((state) => ({
					chats: [chat, ...state.chats],
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
				}))
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
