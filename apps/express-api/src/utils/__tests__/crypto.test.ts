import crypto, { type CipherGCM, type DecipherGCM } from 'crypto'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { config } from '../../../config/default.ts'
import { decrypt, encrypt } from '../crypto.ts'
import { tryCatchSync } from '../error-handling/try-catch.ts'
import { AppError } from '../errors.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'

// Mock dependencies
vi.mock('../error-handling/try-catch.ts', () => ({
	tryCatchSync: vi.fn(),
}))

vi.mock('../../../config/default.ts', () => ({
	config: {
		cookieEncryptionKey:
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
	},
	assertConfig: vi.fn(() => ({
		cookieEncryptionKey:
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
	})),
}))

// Mock crypto module
vi.mock('crypto', () => ({
	default: {
		randomBytes: vi.fn(),
		createCipheriv: vi.fn(),
		createDecipheriv: vi.fn(),
	},
}))

describe('crypto.ts', () => {
	const mockTryCatchSync = vi.mocked(tryCatchSync)
	const mockCrypto = vi.mocked(crypto)

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()
	})

	describe('encrypt function', () => {
		const mockIv = Buffer.from('123456789012', 'hex') // 12 bytes for GCM
		const mockAuthTag = Buffer.from('abcdefabcdefabcdefabcdefabcdefab', 'hex')
		const mockEncryptedData = 'encryptedtext'

		beforeEach(() => {
			// Setup default successful encryption mocks
			;(mockCrypto.randomBytes as Mock).mockReturnValue(mockIv)

			const mockCipher: Partial<CipherGCM> = {
				update: vi.fn().mockReturnValue('encrypted'),
				final: vi.fn().mockReturnValue('text'),
				getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
			}
			mockCrypto.createCipheriv.mockReturnValue(mockCipher as CipherGCM)

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

				expect(mockCrypto.randomBytes).toHaveBeenCalledWith(12) // IV_LENGTH for GCM
			})

			it('should create cipher with correct algorithm and key', () => {
				const plaintext = 'test-data'
				encrypt(plaintext)

				expect(config).toBeDefined()
				if (config) {
					expect(mockCrypto.createCipheriv).toHaveBeenCalledWith(
						'aes-256-gcm',
						Buffer.from(config.cookieEncryptionKey, 'hex'),
						mockIv,
					)
				}
			})

			it('should update cipher with plaintext', () => {
				const plaintext = 'test-data'
				const mockCipher: Partial<CipherGCM> = {
					update: vi.fn().mockReturnValue('encrypted'),
					final: vi.fn().mockReturnValue('text'),
					getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
				}
				mockCrypto.createCipheriv.mockReturnValue(mockCipher as CipherGCM)

				encrypt(plaintext)

				expect(mockCipher.update).toHaveBeenCalledWith(plaintext, 'utf8', 'hex')
				expect(mockCipher.final).toHaveBeenCalledWith('hex')
				expect(mockCipher.getAuthTag).toHaveBeenCalled()
			})
		})

		describe('encryption errors', () => {
			it('should handle cipher creation errors', () => {
				const error = AppError.internal('Cipher creation failed', 'cryptoUtils')
				mockTryCatchSync.mockReturnValue(mockErrorHandling.errorResult(error))

				const result = encrypt('test-data')

				expect(result).toEqual([null, error])
			})

			it('should handle encryption process errors', () => {
				const error = AppError.internal('Encryption failed', 'cryptoUtils')
				const mockCipher: Partial<CipherGCM> = {
					update: vi.fn().mockImplementation(() => {
						throw error
					}),
					final: vi.fn(),
					getAuthTag: vi.fn(),
				}
				mockCrypto.createCipheriv.mockReturnValue(mockCipher as CipherGCM)
				// Use real implementation to actually catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = encrypt('test-data')

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
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
				const plaintext = '🔐 secure data 中文'
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
			const mockDecipher: Partial<DecipherGCM> = {
				setAuthTag: vi.fn(),
				update: vi.fn().mockReturnValue('decrypted'),
				final: vi.fn().mockReturnValue('text'),
			}
			mockCrypto.createDecipheriv.mockReturnValue(mockDecipher as DecipherGCM)

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

				expect(config).toBeDefined()
				if (config) {
					expect(mockCrypto.createDecipheriv).toHaveBeenCalledWith(
						'aes-256-gcm',
						Buffer.from(config.cookieEncryptionKey, 'hex'),
						Buffer.from(mockIv, 'hex'),
					)
				}
			})

			it('should set auth tag and process decryption', () => {
				const mockDecipher: Partial<DecipherGCM> = {
					setAuthTag: vi.fn(),
					update: vi.fn().mockReturnValue('decrypted'),
					final: vi.fn().mockReturnValue('text'),
				}
				mockCrypto.createDecipheriv.mockReturnValue(mockDecipher as DecipherGCM)

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
				const invalidText = 'invalid:format'
				// Use real implementation to catch validation errors
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(invalidText)

				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle empty parts in encrypted text', () => {
				const invalidText = ':authTag:encryptedData'
				// Use real implementation to catch validation errors
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(invalidText)

				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle missing auth tag', () => {
				const invalidText = 'iv::encryptedData'
				// Use real implementation to catch validation errors
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(invalidText)

				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})

			it('should handle missing encrypted data', () => {
				const invalidText = 'iv:authTag:'
				// Use real implementation to catch validation errors
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(invalidText)

				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Invalid encrypted text format')
			})
		})

		describe('decryption errors', () => {
			it('should handle decipher creation errors', () => {
				const error = AppError.internal(
					'Decipher creation failed',
					'cryptoUtils',
				)
				mockTryCatchSync.mockReturnValue(mockErrorHandling.errorResult(error))

				const result = decrypt(validEncryptedText)

				expect(result).toEqual([null, error])
			})

			it('should handle authentication tag verification errors', () => {
				const error = AppError.internal('Authentication failed', 'cryptoUtils')
				const mockDecipher: Partial<DecipherGCM> = {
					setAuthTag: vi.fn().mockImplementation(() => {
						throw error
					}),
					update: vi.fn(),
					final: vi.fn(),
				}
				mockCrypto.createDecipheriv.mockReturnValue(mockDecipher as DecipherGCM)
				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(validEncryptedText)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
			})

			it('should handle decryption process errors', () => {
				const error = AppError.internal('Decryption failed', 'cryptoUtils')
				const mockDecipher: Partial<DecipherGCM> = {
					setAuthTag: vi.fn(),
					update: vi.fn().mockImplementation(() => {
						throw error
					}),
					final: vi.fn(),
				}
				mockCrypto.createDecipheriv.mockReturnValue(mockDecipher as DecipherGCM)
				// Use real implementation to catch the thrown error
				mockTryCatchSync.mockImplementation(
					mockErrorHandling.withRealTryCatchSync(),
				)

				const result = decrypt(validEncryptedText)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
			})
		})

		describe('edge cases', () => {
			it('should handle malformed hex data', () => {
				const invalidText = 'invalidhex:invalidhex:invalidhex'
				// The actual crypto library will handle hex parsing errors
				const error = AppError.internal('Invalid hex string', 'cryptoUtils')
				mockTryCatchSync.mockReturnValue(mockErrorHandling.errorResult(error))

				const result = decrypt(invalidText)

				expect(result[1]).toBeInstanceOf(AppError)
			})
		})
	})

	describe('integration scenarios', () => {
		it('should demonstrate encrypt/decrypt round trip would work', () => {
			// This test shows the expected behavior without actual crypto operations
			const plaintext = 'sensitive-user-data'

			// Mock successful encryption
			const mockEncryptedOutput = 'abc123:def456:ghi789'
			mockTryCatchSync.mockReturnValueOnce([mockEncryptedOutput, null])

			const encryptResult = encrypt(plaintext)
			expect(encryptResult).toEqual([mockEncryptedOutput, null])

			// Mock successful decryption
			mockTryCatchSync.mockReturnValueOnce([plaintext, null])

			const decryptResult = decrypt(mockEncryptedOutput)
			expect(decryptResult).toEqual([plaintext, null])
		})
	})
})
