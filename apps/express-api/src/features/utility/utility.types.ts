import { z } from 'zod'

import { healthErrorSchema, healthResponseSchema } from './utility.schemas.ts'

type THealthResponse = z.infer<typeof healthResponseSchema>
type THealthErrorResponse = z.infer<typeof healthErrorSchema>

export type { THealthErrorResponse, THealthResponse }
