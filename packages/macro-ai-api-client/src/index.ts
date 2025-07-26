// Main API client exports with backward compatibility
// This file maintains the existing API surface while supporting the new modular structure

// Backward compatibility: re-export everything from output.ts
export * from './output'

// New modular exports (for future use when fully implemented)
// TODO: Uncomment when modular generation is complete
// export * from './schemas'
// export * from './clients'

// Domain-specific exports for tree-shaking (future)
// TODO: Uncomment when modular generation is complete
// export { authSchemas } from './schemas/auth.schemas'
// export { chatSchemas } from './schemas/chat.schemas'
// export { userSchemas } from './schemas/user.schemas'
// export { sharedSchemas } from './schemas/shared.schemas'

// export { createAuthClient, authClient } from './clients/auth.client'
// export { createChatClient, chatClient } from './clients/chat.client'
// export { createUserClient, userClient } from './clients/user.client'
