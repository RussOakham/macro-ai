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
	secure: true, // HTTPS only in production
	sameSite: 'strict', // CSRF protection
	maxAge: tokenLifetime, // Automatic expiration
	path: '/', // Available site-wide
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
// Encrypt username for synchronize token
export const encrypt = (text: string): string => {
	const cipher = createCipher('aes-256-gcm', encryptionKey)
	let encrypted = cipher.update(text, 'utf8', 'hex')
	encrypted += cipher.final('hex')
	const authTag = cipher.getAuthTag()
	return encrypted + ':' + authTag.toString('hex')
}

// Decrypt synchronize token
export const decrypt = (encryptedText: string): Result<string> => {
	return tryCatchSync(() => {
		const [encrypted, authTag] = encryptedText.split(':')
		const decipher = createDecipher('aes-256-gcm', encryptionKey)
		decipher.setAuthTag(Buffer.from(authTag, 'hex'))
		let decrypted = decipher.update(encrypted, 'hex', 'utf8')
		decrypted += decipher.final('utf8')
		return decrypted
	}, 'crypto - decrypt')
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
