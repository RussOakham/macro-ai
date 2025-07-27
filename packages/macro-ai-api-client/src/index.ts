// Main API client exports with backward compatibility
// This file maintains the existing API surface while supporting the new modular structure

// Backward compatibility: re-export everything from output.ts
export * from './output'

// New modular exports - Auth, Chat, and User clients are now implemented
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

// Future modular exports (for when other clients are implemented)
// TODO: Uncomment when modular generation is complete for other domains
// export * from './schemas'
// export * from './clients'

// Domain-specific exports for tree-shaking (future)
// TODO: Uncomment when modular generation is complete
// export { authSchemas } from './schemas/auth.schemas'
// export { chatSchemas } from './schemas/chat.schemas'
// export { sharedSchemas } from './schemas/shared.schemas'

// export { createAuthClient, authClient } from './clients/auth.client'
// export { createChatClient, chatClient } from './clients/chat.client'
