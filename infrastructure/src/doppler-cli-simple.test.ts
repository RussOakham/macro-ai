import { describe, expect, it } from 'vitest'
import { createEnvironmentVariablesFromCli } from './doppler-cli-simple'

describe('doppler-cli-simple', () => {
	describe('createEnvironmentVariablesFromCli', () => {
		it('should create environment variables from raw JSON secrets', () => {
			const mockSecrets = {
				DATABASE_URL: 'postgresql://user:pass@host:5432/db',
				JWT_SECRET: 'jwt-secret-key-12345',
				// eslint-disable-next-line no-secrets/no-secrets
				API_KEY: 'sk-1234567890abcdef!@#$%^&*()',
				REDIS_URL: 'redis://default:password@host:6379',
			}

			const result = createEnvironmentVariablesFromCli(mockSecrets, 'staging')

			expect(result).toEqual({
				DATABASE_URL: 'postgresql://user:pass@host:5432/db',
				JWT_SECRET: 'jwt-secret-key-12345',
				// eslint-disable-next-line no-secrets/no-secrets
				API_KEY: 'sk-1234567890abcdef!@#$%^&*()',
				REDIS_URL: 'redis://default:password@host:6379',
				NODE_ENV: 'production',
				SERVER_PORT: '3040',
				APP_ENV: 'staging',
			})
		})

		it('should handle empty secrets', () => {
			const mockSecrets = {}

			const result = createEnvironmentVariablesFromCli(mockSecrets, 'dev')

			expect(result).toEqual({
				NODE_ENV: 'production',
				SERVER_PORT: '3040',
				APP_ENV: 'dev',
			})
		})

		it('should handle different environment names', () => {
			const mockSecrets = {
				API_KEY: 'test-key',
			}

			const devResult = createEnvironmentVariablesFromCli(mockSecrets, 'dev')
			const stagingResult = createEnvironmentVariablesFromCli(
				mockSecrets,
				'staging',
			)
			const prodResult = createEnvironmentVariablesFromCli(
				mockSecrets,
				'production',
			)

			expect(devResult.APP_ENV).toBe('dev')
			expect(stagingResult.APP_ENV).toBe('staging')
			expect(prodResult.APP_ENV).toBe('production')
		})

		it('should handle secrets with special characters', () => {
			const mockSecrets = {
				COMPLEX_SECRET: 'value with spaces and !@#$%^&*() characters',
				MULTILINE_SECRET: 'line1\nline2\nline3',
				JSON_SECRET: '{"key": "value", "nested": {"a": 1}}',
			}

			const result = createEnvironmentVariablesFromCli(mockSecrets, 'test')

			expect(result).toEqual({
				COMPLEX_SECRET: 'value with spaces and !@#$%^&*() characters',
				MULTILINE_SECRET: 'line1\nline2\nline3',
				JSON_SECRET: '{"key": "value", "nested": {"a": 1}}',
				NODE_ENV: 'production',
				SERVER_PORT: '3040',
				APP_ENV: 'test',
			})
		})

		it('should preserve all secret values exactly as received', () => {
			const mockSecrets = {
				EMPTY_STRING: '',
				WHITESPACE: '   ',
				NUMERIC_STRING: '12345',
				BOOLEAN_STRING: 'true',
			}

			const result = createEnvironmentVariablesFromCli(mockSecrets, 'test')

			expect(result.EMPTY_STRING).toBe('')
			expect(result.WHITESPACE).toBe('   ')
			expect(result.NUMERIC_STRING).toBe('12345')
			expect(result.BOOLEAN_STRING).toBe('true')
		})

		it('should demonstrate the advantage over table parsing', () => {
			// This test shows how much simpler the CLI approach is
			const mockSecrets = {
				// These would be table-formatted strings with the old approach
				DATABASE_URL: 'postgresql://user:pass@host:5432/db',
				JWT_SECRET: 'jwt-secret-key-12345',
			}

			const result = createEnvironmentVariablesFromCli(mockSecrets, 'test')

			// No need to parse tables - direct access to values!
			expect(result.DATABASE_URL).toBe('postgresql://user:pass@host:5432/db')
			expect(result.JWT_SECRET).toBe('jwt-secret-key-12345')
		})
	})
})
