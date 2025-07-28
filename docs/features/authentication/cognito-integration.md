# AWS Cognito Integration

This document provides detailed information about the AWS Cognito integration in the Macro AI authentication system.

## 🔧 Current Implementation Status: ✅ COMPLETE

The AWS Cognito integration is fully implemented and production-ready with comprehensive user pool
management, secure authentication flows, and robust error handling.

## 📚 Cognito Configuration

### User Pool Setup

**Configuration Details:**

- User pool configured for email-based authentication
- Password policies enforced for security
- Email verification required for account activation
- Multi-factor authentication support (configurable)

### Client Configuration

**App Client Settings:**

- Secure app client with secret key
- OAuth flows configured for web application
- Callback URLs configured for development and production
- Token expiration settings optimized for security and UX

## 🔑 Authentication Flows

### User Registration Flow

```typescript
// Registration with email verification
const command = new SignUpCommand({
	ClientId: this.clientId,
	Username: userId,
	Password: password,
	UserAttributes: [
		{
			Name: 'email',
			Value: email,
		},
	],
	SecretHash: this.generateHash(userId),
})

const response = await this.client.send(command)
```

### User Login Flow

```typescript
// Authentication with username/password
const command = new InitiateAuthCommand({
	ClientId: this.clientId,
	AuthFlow: 'USER_PASSWORD_AUTH',
	AuthParameters: {
		USERNAME: email,
		PASSWORD: password,
		SECRET_HASH: secretHash,
	},
})

const response = await this.client.send(command)
```

### Token Refresh Flow

```typescript
// Refresh token to get new access token
const command = new InitiateAuthCommand({
	ClientId: this.clientId,
	AuthFlow: 'REFRESH_TOKEN_AUTH',
	AuthParameters: {
		REFRESH_TOKEN: refreshToken,
		SECRET_HASH: secretHash,
	},
})

const response = await this.client.send(command)
```

## 🛡️ Security Implementation

### Secret Hash Generation

```typescript
private generateHash(username: string): string {
  const message = username + this.clientId
  return createHmac('sha256', this.clientSecret)
    .update(message)
    .digest('base64')
}
```

### Error Handling

All Cognito operations use Go-style error handling:

```typescript
const [response, error] = await tryCatch(
	this.client.send(command),
	'cognitoService - signUpUser',
)

if (error) {
	// Error is automatically logged and standardized
	return [null, error]
}

// Process successful response
return [response, null]
```

## 🔗 Integration Points

### Express.js Service Integration

The Cognito service is integrated into the Express.js authentication service layer:

- **File Location**: `apps/express-api/src/features/auth/auth.services.ts`
- **Service Class**: `CognitoService`
- **Dependency Injection**: Configured through environment variables

### Environment Configuration

Required environment variables for Cognito integration:

```bash
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_USER_POOL_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
AWS_COGNITO_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📊 Supported Operations

### User Management Operations

- ✅ **User Registration** - SignUpCommand with email verification
- ✅ **Email Confirmation** - ConfirmSignUpCommand for account activation
- ✅ **User Authentication** - InitiateAuthCommand with USER_PASSWORD_AUTH
- ✅ **Token Refresh** - InitiateAuthCommand with REFRESH_TOKEN_AUTH
- ✅ **Password Reset** - ForgotPasswordCommand and ConfirmForgotPasswordCommand
- ✅ **User Logout** - GlobalSignOutCommand for complete session termination
- ✅ **Resend Confirmation** - ResendConfirmationCodeCommand for email resend

### Administrative Operations

- ✅ **User Lookup** - ListUsersCommand for finding users by email
- ✅ **User Validation** - GetUserCommand for token verification
- ✅ **Bulk Operations** - Support for batch user operations (when needed)

## 🎯 Best Practices

### Security Best Practices

- **Secret Hash**: Always include secret hash for additional security
- **Token Validation**: Verify tokens on every protected request
- **Error Handling**: Use standardized error handling patterns
- **Logging**: Comprehensive logging for audit and debugging

### Performance Optimization

- **Connection Pooling**: Reuse Cognito client instances
- **Caching**: Cache user data appropriately (with security considerations)
- **Rate Limiting**: Implement rate limiting for authentication endpoints
- **Monitoring**: Monitor Cognito usage and performance metrics

## 🔗 Related Documentation

- **[Token Management](./token-management.md)** - JWT and refresh token handling
- **[Security Considerations](./security-considerations.md)** - Security measures and best practices
- **[Authentication Overview](./README.md)** - Complete authentication system documentation

---

**Implementation Status**: ✅ Complete and Production Ready  
**Last Updated**: July 2025
