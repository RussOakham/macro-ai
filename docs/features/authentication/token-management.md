# Token Management

This document provides detailed information about JWT and refresh token handling in the Macro AI authentication system.

## 🔧 Current Implementation Status: ✅ COMPLETE

The token management system is fully implemented and production-ready with automatic token refresh, secure
cookie storage, and comprehensive error handling.

## 🎯 Token Architecture

### Token Types

**Access Tokens:**

- **Lifetime**: 1 hour (configurable)
- **Purpose**: API request authentication
- **Storage**: HTTP-only cookies
- **Validation**: JWT signature verification with Cognito

**Refresh Tokens:**

- **Lifetime**: 30 days (configurable)
- **Purpose**: Access token renewal
- **Storage**: HTTP-only cookies
- **Security**: Single-use with rotation

**Synchronize Tokens:**

- **Purpose**: Client-side user identification
- **Storage**: HTTP-only cookies
- **Security**: AES-256-GCM encrypted username

## 🍪 Cookie-Based Storage

### Cookie Configuration

```typescript
// Secure cookie settings
const cookieOptions = {
	httpOnly: true, // Prevent XSS attacks
	secure: nodeEnv === 'production', // HTTPS only in production
	sameSite: 'strict', // CSRF protection
	maxAge: tokenLifetime * 1000, // Convert seconds to milliseconds for cookie expiration
	path: '/', // Available site-wide
	domain: cookieDomain, // Domain restriction
}
```

### Cookie Management Utilities

```typescript
// Extract access token from request cookies
export const getAccessToken = (req: Request): string | null => {
	return req.cookies?.accessToken || null
}

// Extract refresh token from request cookies
export const getRefreshToken = (req: Request): string | null => {
	return req.cookies?.refreshToken || null
}

// Extract encrypted synchronize token
export const getSynchronizeToken = (req: Request): string | null => {
	return req.cookies?.synchronizeToken || null
}
```

## 🔄 Automatic Token Refresh

### Server-Side Refresh Implementation

```typescript
// Refresh token service method
public async refreshToken(
  refreshToken: string,
  username: string
): Promise<Result<InitiateAuthCommandOutput>> {
  const [secretHash, hashError] = tryCatchSync(
    () => this.generateHash(username),
    'cognitoService - generateHash'
  )

  if (hashError) {
    return [null, hashError]
  }

  const command = new InitiateAuthCommand({
    ClientId: this.clientId,
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
      SECRET_HASH: secretHash,
    },
  })

  return await tryCatch(
    this.client.send(command),
    'cognitoService - refreshToken'
  )
}
```

### Client-Side Automatic Refresh

```typescript
// Axios interceptor for automatic token refresh
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config

		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true

			try {
				// Attempt token refresh
				await api.post('/auth/refresh')

				// Retry original request
				return api(originalRequest)
			} catch (refreshError) {
				// Refresh failed - redirect to login
				window.location.href = '/login'
				return Promise.reject(refreshError)
			}
		}

		return Promise.reject(error)
	},
)
```

## 🔐 Token Security

### Encryption for Synchronize Tokens

```typescript
import crypto from 'crypto'

// Use a secure encryption key from environment variables
const encryptionKey = config.cookieEncryptionKey
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // For GCM, recommended IV length is 12 bytes

// Encrypt username for synchronize token using secure AES-256-GCM
export const encrypt = (text: string) => {
	return tryCatchSync(() => {
		// Generate a random 12-byte IV for each encryption
		const iv = crypto.randomBytes(IV_LENGTH)

		// Create cipher with IV and proper key handling
		const cipher = crypto.createCipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, 'hex'),
			iv,
		)

		// Encrypt the text
		let encrypted = cipher.update(text, 'utf8', 'hex')
		encrypted += cipher.final('hex')

		// Get the 16-byte authentication tag
		const authTag = cipher.getAuthTag()

		// Format: IV:AuthTag:EncryptedText (colon-separated for parsing)
		const encryptedOutput = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`

		return encryptedOutput
	}, 'cryptoUtils - encrypt')
}

// Decrypt synchronize token using secure AES-256-GCM
export const decrypt = (encryptedText: string): Result<string> => {
	return tryCatchSync(() => {
		// Parse the colon-separated format: IV:AuthTag:EncryptedText
		const parts = encryptedText.split(':')
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted text format')
		}

		const [ivHex, authTagHex, encryptedHex] = parts
		if (!ivHex || !authTagHex || !encryptedHex) {
			throw new Error('Invalid encrypted text format')
		}

		// Create decipher with extracted IV and proper key handling
		const decipher = crypto.createDecipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, 'hex'),
			Buffer.from(ivHex, 'hex'),
		)

		// Set the 16-byte authentication tag for verification
		decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

		// Decrypt and verify the data
		let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
		decrypted += decipher.final('utf8')

		return decrypted
	}, 'cryptoUtils - decrypt')
}
```

### Token Validation

```typescript
// Validate access token with Cognito
export const validateToken = async (
	accessToken: string,
): Promise<Result<GetUserCommandOutput>> => {
	const command = new GetUserCommand({
		AccessToken: accessToken,
	})

	return await tryCatch(
		cognitoClient.send(command),
		'tokenValidation - validateToken',
	)
}
```

## 🔄 Request Queuing During Refresh

### Sophisticated Request Management

```typescript
let isRefreshing = false
let failedQueue: Array<{
	resolve: (value: any) => void
	reject: (error: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
	failedQueue.forEach(({ resolve, reject }) => {
		if (error) {
			reject(error)
		} else {
			resolve(token)
		}
	})

	failedQueue = []
}

// Queue requests during token refresh
if (isRefreshing) {
	return new Promise((resolve, reject) => {
		failedQueue.push({ resolve, reject })
	})
		.then(() => {
			return api(originalRequest)
		})
		.catch((err) => {
			return Promise.reject(err)
		})
}
```

## 🛡️ Security Considerations

### Token Lifecycle Management

**Access Token Security:**

- Short lifetime (1 hour) minimizes exposure risk
- JWT signature verification prevents tampering
- Automatic expiration reduces stale token risks

**Refresh Token Security:**

- Longer lifetime (30 days) for user convenience
- Single-use with rotation prevents replay attacks
- Secure storage in HTTP-only cookies

**Synchronize Token Security:**

- AES-256-GCM encryption for username storage
- Used for client-side user identification
- Prevents username exposure in client-side code

### Cookie Security Features

- **HttpOnly**: Prevents JavaScript access to tokens
- **Secure**: HTTPS-only transmission in production
- **SameSite=Strict**: CSRF attack prevention
- **Automatic Expiration**: Tokens expire automatically
- **Path Restriction**: Cookies scoped to appropriate paths

## 📊 Token Monitoring

### Logging and Audit

```typescript
// Token refresh logging
logger.info('Token refresh initiated', {
	userId: user.id,
	timestamp: new Date().toISOString(),
	userAgent: req.headers['user-agent'],
	ip: req.ip,
})

// Token validation logging
logger.info('Token validation successful', {
	userId: user.id,
	tokenType: 'access',
	expiresAt: tokenExpiration,
})
```

### Error Tracking

- **Failed Refresh Attempts**: Track and alert on repeated failures
- **Invalid Token Usage**: Monitor for potential security issues
- **Unusual Access Patterns**: Detect suspicious authentication behavior

## 🔗 Related Documentation

- **[Cognito Integration](./cognito-integration.md)** - AWS Cognito setup and configuration
- **[Security Considerations](./security-considerations.md)** - Security measures and best practices
- **[Authentication Overview](./README.md)** - Complete authentication system documentation

---

**Implementation Status**: ✅ Complete and Production Ready  
**Last Updated**: July 2025
