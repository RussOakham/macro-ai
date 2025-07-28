// User API Types - auto-generated, do not edit manually
// Types are now inferred from Zod schemas for runtime validation and type safety

import type { z } from 'zod'

import type {
	getUsersId_Response,
	getUsersMe_Response,
} from '../schemas/user.schemas.js'

// ============================================================================
// RESPONSE TYPES (inferred from Zod schemas)
// ============================================================================

export type UserGetUsersByIdResponse = z.infer<typeof getUsersId_Response>

export type UserGetUsersMeResponse = z.infer<typeof getUsersMe_Response>
