// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Express } from 'express-serve-static-core'

declare global {
	namespace Express {
		interface Request {
			/**
			 * User ID extracted from the authenticated Cognito token
			 * Available after the verifyAuth middleware has been applied
			 */
			userId?: string

			/**
			 * AWS Request ID for tracing
			 * Available in Express environments
			 */
			requestId?: string
		}
	}
}
