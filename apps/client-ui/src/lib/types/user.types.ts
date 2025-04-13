import { z } from 'zod'

import { userSchema } from '../schemas/user.schema'

export type TUser = z.infer<typeof userSchema>

export interface IUserResponse {
  id: string
  email: string
  emailVerified: boolean
}