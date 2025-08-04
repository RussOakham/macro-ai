import {
	GetParameterCommand,
	GetParametersCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { AwsClientStub } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'

import { mockParameterStoreService } from '../parameter-store.mock.js'

/**
 * Example test demonstrating the aws-sdk-client-mock approach for Parameter Store
 * This shows how to use the reusable mock for service-level tests with proper TypeScript typing
 */

describe('Parameter Store Mock Example - AWS SDK Client Mock', () => {
	let ssmMock: AwsClientStub<SSMClient>

	beforeEach(() => {
		// Create the AWS SDK client mock
		ssmMock = mockParameterStoreService.createAwsMock()
	})

	it('should demonstrate successful GetParameter response', () => {
		// Arrange - Create properly typed mock parameter
		const mockParameter = mockParameterStoreService.createParameter({
			Parameter: {
				Name: 'example-parameter',
				Value: 'example-value',
				Type: 'String',
			},
		})

		// Mock the AWS SDK call
		ssmMock.on(GetParameterCommand).resolves(mockParameter)

		// Assert - Verify the mock was set up correctly
		expect(mockParameter.Parameter?.Name).toBe('example-parameter')
		expect(mockParameter.Parameter?.Value).toBe('example-value')
		expect(mockParameter.$metadata.httpStatusCode).toBe(200)
	})

	it('should demonstrate successful GetParameters response', () => {
		// Arrange - Create properly typed mock parameters
		const mockParameters = mockParameterStoreService.createParameters({
			param1: 'value1',
			param2: 'value2',
		})

		// Mock the AWS SDK call
		ssmMock.on(GetParametersCommand).resolves(mockParameters)

		// Assert - Verify the mock was set up correctly
		expect(mockParameters.Parameters).toHaveLength(2)
		expect(mockParameters.Parameters?.[0]?.Name).toBe('param1')
		expect(mockParameters.Parameters?.[0]?.Value).toBe('value1')
		expect(mockParameters.Parameters?.[1]?.Name).toBe('param2')
		expect(mockParameters.Parameters?.[1]?.Value).toBe('value2')
		expect(mockParameters.$metadata.httpStatusCode).toBe(200)
	})

	it('should demonstrate Macro AI parameters creation', () => {
		// Arrange - Create standard Macro AI parameters
		const macroAiParams = mockParameterStoreService.createMacroAiParameters()
		const mockResponse =
			mockParameterStoreService.createParameters(macroAiParams)

		// Mock the AWS SDK call
		ssmMock.on(GetParametersCommand).resolves(mockResponse)

		// Assert - Verify all required parameters are present
		expect(macroAiParams).toHaveProperty('macro-ai-openai-key')
		expect(macroAiParams).toHaveProperty('macro-ai-database-url')
		expect(macroAiParams).toHaveProperty('macro-ai-redis-url')
		expect(macroAiParams).toHaveProperty('macro-ai-cognito-user-pool-id')
		expect(macroAiParams).toHaveProperty('macro-ai-cognito-user-pool-client-id')

		// Verify values follow expected patterns
		expect(macroAiParams['macro-ai-openai-key']).toMatch(/^sk-/)
		expect(macroAiParams['macro-ai-database-url']).toMatch(/^postgresql:\/\//)
		expect(macroAiParams['macro-ai-redis-url']).toMatch(/^redis:\/\//)
		expect(macroAiParams['macro-ai-cognito-user-pool-id']).toMatch(
			/^us-east-1_/,
		)
		expect(macroAiParams['macro-ai-cognito-user-pool-client-id']).toHaveLength(
			26,
		)
	})

	it('should demonstrate error handling with proper typing', () => {
		// Arrange - Mock an AWS SDK error
		const awsError = new Error('Parameter not found')
		ssmMock.on(GetParameterCommand).rejects(awsError)

		// Assert - Verify error handling
		expect(awsError.message).toBe('Parameter not found')
	})

	it('should demonstrate command call verification', () => {
		// Arrange
		const mockParameter = mockParameterStoreService.createParameter()
		ssmMock.on(GetParameterCommand).resolves(mockParameter)

		// Simulate a service call (this would normally be done by the actual service)
		// const result = await parameterStoreService.getParameter('test-param')

		// Assert - Verify the mock can track command calls
		expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(0) // No calls yet

		// After a real service call, you could verify:
		// expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
		// expect(ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input).toEqual({
		//   Name: 'test-param',
		//   WithDecryption: true,
		// })
	})

	it('should demonstrate mock reset functionality', () => {
		// Arrange - Set up initial mock
		const mockParameter = mockParameterStoreService.createParameter()
		ssmMock.on(GetParameterCommand).resolves(mockParameter)

		// Act - Reset the mock
		ssmMock.reset()

		// Assert - Verify mock is reset
		expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(0)
	})
})
