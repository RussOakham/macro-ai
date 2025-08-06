/**
 * Lambda Utilities - Simplified Approach
 * Essential utilities for AWS Lambda deployment without complex Powertools coordination
 */

// Re-export the main Lambda handler
export { handler } from '../lambda.ts'
// Export all Lambda utilities
export * from './lambda-config.ts'
export * from './lambda-utils.ts'
