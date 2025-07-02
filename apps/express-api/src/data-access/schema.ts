// Barrel file for all schema definitions
import {
	chatMessagesTable,
	chatsTable,
	chatVectorsTable,
} from '../features/chat/chat.schemas.ts'
import { usersTable } from '../features/user/user.schemas.ts'

// Re-export all schemas
export { chatMessagesTable, chatsTable, chatVectorsTable, usersTable }
