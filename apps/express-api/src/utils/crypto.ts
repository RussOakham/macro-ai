import crypto from 'crypto'

import { assertConfig } from '../../config/default.ts'

import { tryCatchSync } from './error-handling/try-catch.ts'

// Use a secure encryption key from environment variables
const config = assertConfig()
const encryptionKey = config.cookieEncryptionKey
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // For GCM, recommended IV length is 12 bytes

/**
 * The `encrypt` function in TypeScript encrypts a given text using a specified algorithm and
 * encryption key, and returns the encrypted output in a specific format.
 * @param {string} text - The `encrypt` function takes a `text` parameter as input, which is the
 * plaintext string that you want to encrypt. The function then generates an Initialization Vector
 * (IV), creates a cipher using a specified algorithm and encryption key, encrypts the text, and
 * generates an authentication tag. Finally, it
 * @returns The `encrypt` function returns an encrypted output string in the format of
 * "IV:AuthTag:EncryptedText".
 */
export const encrypt = (text: string) => {
	return tryCatchSync(() => {
		const iv = crypto.randomBytes(IV_LENGTH)
		const cipher = crypto.createCipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, 'hex'),
			iv,
		)

		let encrypted = cipher.update(text, 'utf8', 'hex')
		encrypted += cipher.final('hex')

		const authTag = cipher.getAuthTag()

		// IV:AuthTag:EncrpytedText
		const encryptedOutput = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`

		return encryptedOutput
	}, 'cryptoUtils - encrypt')
}

/**
 * The `decrypt` function takes an encrypted text as input, splits it into initialization vector,
 * authentication tag, and encrypted data, then decrypts and returns the original text.
 * @param {string} encryptedText - The `encryptedText` parameter is a string that contains three parts
 * separated by colons (`:`): the initialization vector in hexadecimal format (`ivHex`), the
 * authentication tag in hexadecimal format (`authTagHex`), and the encrypted data in hexadecimal
 * format (`encryptedHex`).
 * @returns The `decrypt` function returns the decrypted text after decrypting the input encrypted text
 * using the provided encryption key, initialization vector (iv), and authentication tag.
 */
export const decrypt = (encryptedText: string) => {
	return tryCatchSync(() => {
		const parts = encryptedText.split(':')
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted text format')
		}
		const [ivHex, authTagHex, encryptedHex] = parts
		if (!ivHex || !authTagHex || !encryptedHex) {
			throw new Error('Invalid encrypted text format')
		}

		const decipher = crypto.createDecipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, 'hex'),
			Buffer.from(ivHex, 'hex'),
		)

		decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

		let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
		decrypted += decipher.final('utf8')

		return decrypted
	}, 'cryptoUtils - decrypt')
}
