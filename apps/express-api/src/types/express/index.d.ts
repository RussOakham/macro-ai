// eslint-disable-next-line @typescript-eslint/no-unused-vars,, sonarjs/unused-import
import { type Express } from 'express'

// Express types are used for module augmentation below

declare global {
	namespace Express {
		interface Request {
			/**
			 * AWS Request ID for tracing
			 * Available in Express environments
			 */
			requestId?: string

			/**
			 * User ID extracted from the authenticated Cognito token
			 * Available after the verifyAuth middleware has been applied
			 */
			userId?: string
		}
	}
}
