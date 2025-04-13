import { z } from 'zod'

import {
  confirmationSchema,
  getUserSchema,
  loginSchema,
  registerSchema,
} from '../schemas/auth.schema'

export type TLoginForm = z.infer<typeof loginSchema>
export type TRegisterForm = z.infer<typeof registerSchema>
export type TConfirmationForm = z.infer<typeof confirmationSchema>
export type TGetUser = z.infer<typeof getUserSchema>

export interface IAuthResponse {
  accessToken: string
  refreshToken: string
}

export interface ILoginResponse extends IAuthResponse {
  user: {
    id: string
    email: string
  }
}

export interface IRegisterResponse {
  message: string
  user: {
    id: string
    email: string
  }
}

export interface IConfirmRegistrationResponse {
  message: string
}

export interface ILogoutResponse {
  message: string
}