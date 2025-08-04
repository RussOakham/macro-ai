/**
 * Test helpers for Lambda API
 * Provides reusable mock utilities for testing AWS services and Lambda functionality
 */

// Parameter Store mocking utilities
export { mockParameterStoreService } from './parameter-store.mock.js'

// Re-export types for convenience
export type {
	GetParameterCommandOutput,
	GetParametersCommandOutput,
} from '@aws-sdk/client-ssm'
export type { AwsClientStub } from 'aws-sdk-client-mock'
