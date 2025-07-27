// Chat API Types - auto-generated, do not edit manually

export interface ChatGetChatsResponse {
	success: boolean
	data: {
		id: string
		userId: string
		title: string
		createdAt: string
		updatedAt: string
	}[]
	meta: {
		page: number
		limit: number
		total: number
	}
}

export interface ChatPostChatsRequest {
	title: string
}

export interface ChatPostChatsResponse {
	success: boolean
	data: {
		id: string
		userId: string
		title: string
		createdAt: string
		updatedAt: string
	}
}

export interface ChatGetChatsByIdResponse {
	success: boolean
	data: {
		id: string
		userId: string
		title: string
		createdAt: string
		updatedAt: string
		messages: {
			id: string
			chatId: string
			role: string
			content: string
			metadata: unknown
			embedding: number[]
			createdAt: string
		}[]
	}
}

export interface ChatPutChatsByIdRequest {
	title: string
}

export interface ChatPutChatsByIdResponse {
	success: boolean
	data: {
		id: string
		userId: string
		title: string
		createdAt: string
		updatedAt: string
	}
}

export interface ChatDeleteChatsByIdResponse {
	success?: boolean
	message?: string
}

export interface ChatPostChatsByIdStreamRequest {
	messages: {
		role: 'user' | 'assistant' | 'system'
		content: string
	}[]
}
