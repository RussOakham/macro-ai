import type { APIGatewayProxyEvent, Context } from 'aws-lambda'
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
			 * AWS Lambda context information
			 * Available when running in Lambda environment via serverless-http
			 */
			lambda?: {
				event: APIGatewayProxyEvent
				context: Context
			}

			/**
			 * AWS Request ID for tracing
			 * Available in both Express and Lambda environments
			 */
			requestId?: string
		}
	}
}
