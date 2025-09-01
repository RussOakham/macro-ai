import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decrypt, encrypt } from '../crypto.ts'
import { tryCatchSync } from '../error-handling/try-catch.ts'
import { AppError } from '../errors.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'

// Mock dependencies
vi.mock('../error-handling/try-catch.ts', () => ({
	tryCatchSync: vi.fn(),
}))

vi.mock('../load-config.ts', () => ({
	config: {
		COOKIE_ENCRYPTION_KEY:
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
	},
}))

// Mock crypto module with named imports
vi.mock('crypto', () => ({
	randomBytes: vi.fn(),
	createCipheriv: vi.fn(),
	createDecipheriv: vi.fn(),
}))

// Import the mocked crypto functions after mocking
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Define proper interfaces for mock objects
interface MockCipher {
	update: ReturnType<typeof vi.fn>
	final: ReturnType<typeof vi.fn>
	getAuthTag: ReturnType<typeof vi.fn>
}

interface MockDecipher {
	setAuthTag: ReturnType<typeof vi.fn>
	update: ReturnType<typeof vi.fn>
	final: ReturnType<typeof vi.fn>
}

describe('crypto.ts', () => {
	const mockTryCatchSync = vi.mocked(tryCatchSync)
	const mockRandomBytes = vi.mocked(randomBytes) as ReturnType<typeof vi.fn>
	const mockCreateCipheriv = vi.mocked(createCipheriv) as ReturnType<
		typeof vi.fn
	>
	const mockCreateDecipheriv = vi.mocked(createDecipheriv) as ReturnType<
		typeof vi.fn
	>

	beforeEach(() => {
		vi.resetModules()
		// Note: vi.clearAllMocks() is handled by test helper setup functions when used
	})

	describe('encrypt function', () => {
		const mockIv = Buffer.from('123456789012', 'hex') // 12 bytes for GCM
		const mockAuthTag = Buffer.from('abcdefabcdefabcdefabcdefabcdefab', 'hex')
		const mockEncryptedData = 'encryptedtext'

		beforeEach(() => {
			// Setup default successful encryption mocks
			mockRandomBytes.mockReturnValue(mockIv)

			const mockCipher: MockCipher = {
				update: vi.fn().mockReturnValue('encrypted'),
				final: vi.fn().mockReturnValue('text'),
				getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
			}
			mockCreateCipheriv.mockReturnValue(
				mockCipher as unknown as ReturnType<typeof createCipheriv>,
			)

			// Use the centralized mock helper for tryCatchSync
			mockTryCatchSync.mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)
		})

		describe('successful encryption', () => {
			it('should encrypt text and return formatted output', () => {
				const plaintext = 'test-data'
				const result = encrypt(plaintext)

				expect(result).toEqual([
					`${mockIv.toString('hex')}:${mockAuthTag.toString('hex')}:${mockEncryptedData}`,
					null,
				])
			})

			it('should call tryCatchSync with correct context', () => {
				const plaintext = 'test-data'
				encrypt(plaintext)

				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					'cryptoUtils - encrypt',
				)
			})

			it('should generate random IV of correct length', () => {
				const plaintext = 'test-data'
				encrypt(plaintext)

				expect(mockRandomBytes).toHaveBeenCalledWith(12) // IV_LENGTH for GCM
			})

			it('should create cipher with correct algorithm and key', () => {
				const plaintext = 'test-data'
				encrypt(plaintext)

				expect(mockCreateCipheriv).toHaveBeenCalledWith(
					'aes-256-gcm',
					Buffer.from(
						'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
						'hex',
					),
					mockIv,
				)
			})

			it('should update cipher with plaintext', () => {
				const plaintext = 'test-data'
				const mockCipher: MockCipher = {
					update: vi.fn().mockReturnValue('encrypted'),
					final: vi.fn().mockReturnValue('text'),
					getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
				}
				mockCreateCipheriv.mockReturnValue(
					mockCipher as unknown as ReturnType<typeof createCipheriv>,
				)

				encrypt(plaintext)

				expect(mockCipher.update).toHaveBeenCalledWith(plaintext, 'utf8', 'hex')
				expect(mockCipher.final).toHaveBeenCalledWith('hex')
				expect(mockCipher.getAuthTag).toHaveBeenCalled()
			})
		})

		describe('encryption errors', () => {
			it('should handle cipher creation errors', () => {
				const error = AppError.internal('Cipher creation failed', 'cryptoUtils')
				mockCreateCipheriv.mockImplementation(() => {
					throw error
				})

				// Use real implementation to actually catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = encrypt('test-data')
				expect(result[0]).toBeNull()
				expect(result[1]).toEqual(error)
			})

			it('should handle encryption process errors', () => {
				const error = AppError.internal('Encryption failed', 'cryptoUtils')
				const mockCipher: MockCipher = {
					update: vi.fn().mockImplementation(() => {
						throw error
					}),
					final: vi.fn(),
					getAuthTag: vi.fn(),
				}
				mockCreateCipheriv.mockReturnValue(
					mockCipher as unknown as ReturnType<typeof createCipheriv>,
				)
				// Use real implementation to actually catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = encrypt('test-data')
				expect(result[0]).toBeNull()
				expect(result[1]).toEqual(error)
			})
		})

		describe('edge cases', () => {
			it('should handle empty string input', () => {
				const result = encrypt('')

				expect(result[0]).toBe(
					`${mockIv.toString('hex')}:${mockAuthTag.toString('hex')}:${mockEncryptedData}`,
				)
				expect(result[1]).toBeNull()
			})

			it('should handle unicode characters', () => {
				const plaintext = '🚀🌟✨'
				const result = encrypt(plaintext)

				expect(result[0]).toBe(
					`${mockIv.toString('hex')}:${mockAuthTag.toString('hex')}:${mockEncryptedData}`,
				)
				expect(result[1]).toBeNull()
			})

			it('should handle very long strings', () => {
				const plaintext = 'a'.repeat(10000)
				const result = encrypt(plaintext)

				expect(result[0]).toBe(
					`${mockIv.toString('hex')}:${mockAuthTag.toString('hex')}:${mockEncryptedData}`,
				)
				expect(result[1]).toBeNull()
			})
		})
	})

	describe('decrypt function', () => {
		const mockIv = '123456789012'
		const mockAuthTag = 'abcdefabcdefabcdefabcdefabcdefab'
		const mockEncryptedData = 'encryptedtext'
		const validEncryptedText = `${mockIv}:${mockAuthTag}:${mockEncryptedData}`

		beforeEach(() => {
			// Setup default successful decryption mocks
			const mockDecipher: MockDecipher = {
				setAuthTag: vi.fn(),
				update: vi.fn().mockReturnValue('decrypted'),
				final: vi.fn().mockReturnValue('text'),
			}
			mockCreateDecipheriv.mockReturnValue(
				mockDecipher as unknown as ReturnType<typeof createDecipheriv>,
			)

			// Use the centralized mock helper for tryCatchSync
			mockTryCatchSync.mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)
		})

		describe('successful decryption', () => {
			it('should decrypt valid encrypted text', () => {
				const result = decrypt(validEncryptedText)

				expect(result).toEqual(['decryptedtext', null])
			})

			it('should call tryCatchSync with correct context', () => {
				decrypt(validEncryptedText)

				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					'cryptoUtils - decrypt',
				)
			})

			it('should create decipher with correct parameters', () => {
				decrypt(validEncryptedText)

				expect(mockCreateDecipheriv).toHaveBeenCalledWith(
					'aes-256-gcm',
					Buffer.from(
						'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
						'hex',
					),
					Buffer.from(mockIv, 'hex'),
				)
			})

			it('should set auth tag and process decryption', () => {
				const mockDecipher: MockDecipher = {
					setAuthTag: vi.fn(),
					update: vi.fn().mockReturnValue('decrypted'),
					final: vi.fn().mockReturnValue('text'),
				}
				mockCreateDecipheriv.mockReturnValue(
					mockDecipher as unknown as ReturnType<typeof createDecipheriv>,
				)

				decrypt(validEncryptedText)

				expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(
					Buffer.from(mockAuthTag, 'hex'),
				)
				expect(mockDecipher.update).toHaveBeenCalledWith(
					mockEncryptedData,
					'hex',
					'utf8',
				)
				expect(mockDecipher.final).toHaveBeenCalledWith('utf8')
			})
		})

		describe('input validation errors', () => {
			it('should handle invalid format - wrong number of parts', () => {
				const result = decrypt('invalid:format')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle empty parts in encrypted text', () => {
				const result = decrypt(':authTag:encrypted')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle missing auth tag', () => {
				const result = decrypt('iv::encrypted')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle missing encrypted data', () => {
				const result = decrypt('iv:authTag:')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})
		})

		describe('decryption errors', () => {
			it('should handle decipher creation errors', () => {
				const error = AppError.internal(
					'Decipher creation failed',
					'cryptoUtils',
				)
				mockCreateDecipheriv.mockImplementation(() => {
					throw error
				})

				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(validEncryptedText)
				expect(result[0]).toBeNull()
				expect(result[1]).toEqual(error)
			})

			it('should handle authentication tag verification errors', () => {
				const error = AppError.internal('Authentication failed', 'cryptoUtils')
				const mockDecipher: MockDecipher = {
					setAuthTag: vi.fn().mockImplementation(() => {
						throw error
					}),
					update: vi.fn(),
					final: vi.fn(),
				}
				mockCreateDecipheriv.mockReturnValue(
					mockDecipher as unknown as ReturnType<typeof createDecipheriv>,
				)
				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(validEncryptedText)
				expect(result[0]).toBeNull()
				expect(result[1]).toEqual(error)
			})

			it('should handle decryption process errors', () => {
				const error = AppError.internal('Decryption failed', 'cryptoUtils')
				const mockDecipher: MockDecipher = {
					setAuthTag: vi.fn(),
					update: vi.fn().mockImplementation(() => {
						throw error
					}),
					final: vi.fn(),
				}
				mockCreateDecipheriv.mockReturnValue(
					mockDecipher as unknown as ReturnType<typeof createDecipheriv>,
				)
				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(validEncryptedText)
				expect(result[0]).toBeNull()
				expect(result[1]).toEqual(error)
			})
		})

		describe('edge cases', () => {
			it('should handle malformed hex data', () => {
				// Mock the crypto functions to throw an error for invalid hex
				const error = new Error('Invalid hex string')
				mockCreateDecipheriv.mockImplementation(() => {
					throw error
				})

				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt('invalid:authTag:encrypted')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})
		})

		describe('integration scenarios', () => {
			it('should demonstrate encrypt/decrypt round trip would work', () => {
				// This test demonstrates that the functions are properly structured
				// for a real encrypt/decrypt round trip, even though we're using mocks
				const plaintext = 'test-data'
				const encrypted = encrypt(plaintext)
				const decrypted = decrypt(encrypted[0] ?? '')

				// Both should return valid results (not errors)
				expect(encrypted[1]).toBeNull()
				expect(decrypted[1]).toBeNull()
			})
		})
	})
})
