// Modular API client exports
// Domain-specific clients for better tree-shaking and maintainability

// Modular client exports
export {
	authClient,
	authEndpoints,
	createAuthClient,
} from './clients/auth.client'
export {
	chatClient,
	chatEndpoints,
	createChatClient,
} from './clients/chat.client'
export {
	createUserClient,
	userClient,
	userEndpoints,
} from './clients/user.client'
export { userSchemas } from './schemas/user.schemas'

// Schema exports for type definitions
export * from './schemas/auth.schemas'
export * from './schemas/chat.schemas'
export * from './schemas/shared.schemas'

// Backward compatible schemas object export
import {
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthregister_Body,
} from './schemas/auth.schemas'
import { postChatsIdstream_Body } from './schemas/chat.schemas'

export const schemas = {
	// Auth schemas
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthregister_Body,
	// Chat schemas
	postChatsIdstream_Body,
}
