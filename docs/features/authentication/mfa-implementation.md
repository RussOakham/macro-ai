# 🔐 Multi-Factor Authentication (MFA) Implementation

## 📋 Executive Summary

This document outlines the implementation plan for adding Multi-Factor Authentication (MFA)
to the existing Cognito-based authentication system. The approach maintains compatibility
with current infrastructure while adding robust security features.

## 🎯 Current State Analysis

### Existing Authentication Infrastructure

- ✅ **AWS Cognito**: Enterprise-grade user management and authentication
- ✅ **Token Management**: Automatic refresh and session handling
- ✅ **Security**: HTTPS, secure cookies, CSRF protection
- ✅ **User Experience**: Smooth login flows and error handling
- ✅ **Type Safety**: Full TypeScript integration

### Security Enhancement Opportunities

- 🔒 **MFA Support**: TOTP (Authenticator apps) and SMS-based authentication
- 🛡️ **Account Protection**: Additional security layer for sensitive operations
- 📱 **Modern UX**: Progressive enhancement without breaking existing flows
- 🔍 **Compliance**: Support for regulatory requirements

## 🏗️ Architecture Overview

### Technology Stack

- **Authentication**: Existing AWS Cognito (enhanced)
- **MFA Method**: TOTP (Time-based One-Time Password)
- **Frontend**: React with enhanced auth components
- **Backend**: Express.js with Cognito SDK integration
- **Security**: HTTPS, secure tokens, audit logging

### Security Flow

```mermaid
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Login    │───▶│   MFA Challenge  │───▶│   MFA Verify    │
│                 │    │                  │    │                 │
│  - Email/Pass   │    │  - QR Code Gen   │    │  - TOTP Verify  │
│  - Token Issue  │    │  - App Setup     │    │  - Session Est  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔧 Implementation Details

### **1. Cognito Configuration Enhancement**

#### **User Pool MFA Settings**

```typescript
// infrastructure/pulumi/index.ts (enhanced)
const userPool = new aws.cognito.UserPool('user-pool', {
	// ... existing configuration
	mfaConfiguration: 'OPTIONAL', // Can be "ON" for mandatory MFA
	enableMfa: true,

	// TOTP configuration
	softwareTokenMfaConfiguration: {
		enabled: true,
	},

	// Optional: SMS MFA configuration
	smsConfiguration: {
		externalId: 'your-external-id',
		snsCallerArn: snsTopic.arn,
	},
})
```

### **2. Frontend Implementation**

#### **MFA Setup Component**

```tsx
// apps/client-ui/src/components/auth/mfa-setup.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMutation } from '@tanstack/react-query'

const mfaSetupSchema = z.object({
	verificationCode: z.string().min(6).max(6),
})

export const MfaSetup = () => {
	const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
	const [setupKey, setSetupKey] = useState<string>('')
	const [step, setStep] = useState<'setup' | 'verify'>('setup')

	const setupMfaMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch('/api/auth/mfa/setup', {
				method: 'POST',
				headers: { Authorization: `Bearer ${getAccessToken()}` },
			})
			return response.json()
		},
		onSuccess: (data) => {
			setSetupKey(data.secretCode)
			setQrCodeUrl(data.qrCodeImageUrl)
			setStep('verify')
		},
	})

	const verifyMfaMutation = useMutation({
		mutationFn: async ({ verificationCode }: { verificationCode: string }) => {
			const response = await fetch('/api/auth/mfa/verify', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${getAccessToken()}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ verificationCode }),
			})
			return response.json()
		},
		onSuccess: () => {
			toast.success('MFA enabled successfully!')
			// Redirect or update UI
		},
	})

	return (
		<div className="space-y-6">
			{step === 'setup' && (
				<div className="text-center space-y-4">
					<h3>Enable Two-Factor Authentication</h3>
					<p className="text-muted-foreground">
						Scan the QR code with your authenticator app (Google Authenticator,
						Authy, etc.)
					</p>

					{qrCodeUrl && (
						<div className="flex justify-center">
							<img src={qrCodeUrl} alt="MFA QR Code" className="max-w-48" />
						</div>
					)}

					<div className="text-center">
						<p className="text-sm text-muted-foreground mb-4">
							Or enter this code manually:{' '}
							<code className="bg-muted px-2 py-1 rounded">{setupKey}</code>
						</p>
						<Button
							onClick={() => setupMfaMutation.mutate()}
							disabled={setupMfaMutation.isPending}
						>
							{setupMfaMutation.isPending
								? 'Generating...'
								: 'Generate QR Code'}
						</Button>
					</div>
				</div>
			)}

			{step === 'verify' && (
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((data) =>
							verifyMfaMutation.mutate(data),
						)}
					>
						<FormField
							control={form.control}
							name="verificationCode"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Verification Code</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="000000"
											maxLength={6}
											className="text-center text-2xl tracking-widest"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button
							type="submit"
							disabled={verifyMfaMutation.isPending}
							className="w-full"
						>
							{verifyMfaMutation.isPending
								? 'Verifying...'
								: 'Verify & Enable MFA'}
						</Button>
					</form>
				</Form>
			)}
		</div>
	)
}
```

#### **MFA Challenge Handler**

```tsx
// apps/client-ui/src/components/auth/mfa-challenge.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

const mfaChallengeSchema = z.object({
	mfaCode: z.string().min(6).max(6),
})

export const MfaChallenge = () => {
	const navigate = useNavigate()
	const [error, setError] = useState<string>('')

	const challengeMutation = useMutation({
		mutationFn: async ({ mfaCode }: { mfaCode: string }) => {
			const response = await fetch('/api/auth/mfa/respond-to-challenge', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${getAccessToken()}`,
				},
				body: JSON.stringify({
					challengeName: 'SOFTWARE_TOKEN_MFA',
					mfaCode,
				}),
			})

			if (!response.ok) {
				throw new Error('Invalid MFA code')
			}

			return response.json()
		},
		onSuccess: (data) => {
			// Update tokens with new session
			setTokens(data)
			navigate({ to: '/' })
		},
		onError: (error) => {
			setError(error.message)
		},
	})

	const form = useForm({
		resolver: zodResolver(mfaChallengeSchema),
	})

	return (
		<div className="space-y-6">
			<div className="text-center">
				<h2>Two-Factor Authentication Required</h2>
				<p className="text-muted-foreground">
					Enter the 6-digit code from your authenticator app
				</p>
			</div>

			{error && (
				<div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
					{error}
				</div>
			)}

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit((data) => challengeMutation.mutate(data))}
				>
					<FormField
						control={form.control}
						name="mfaCode"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Authentication Code</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="000000"
										maxLength={6}
										className="text-center text-2xl tracking-widest"
										autoFocus
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button
						type="submit"
						disabled={challengeMutation.isPending}
						className="w-full"
					>
						{challengeMutation.isPending ? 'Verifying...' : 'Verify'}
					</Button>
				</form>
			</Form>
		</div>
	)
}
```

### **3. Backend Implementation**

#### **Enhanced Auth Controller**

```typescript
// apps/express-api/src/features/auth/auth.controller.ts
import {
	associateSoftwareToken,
	verifySoftwareToken,
	respondToMfaChallenge,
} from './auth.services'

const setupMfa = async (req: Request, res: Response) => {
	try {
		const user = req.user

		// Associate TOTP with user account
		const associateResult = await associateSoftwareToken(user.sub)

		// Generate QR code for authenticator app
		const qrCodeUrl = await generateTotpQrCode(
			associateResult.secretCode,
			user.email,
			'Your App Name',
		)

		res.json({
			secretCode: associateResult.secretCode,
			qrCodeImageUrl: qrCodeUrl,
		})
	} catch (error) {
		handleServiceError(res, error)
	}
}

const verifyMfa = async (req: Request, res: Response) => {
	try {
		const { verificationCode } = req.body
		const user = req.user

		// Verify TOTP token with Cognito
		await verifySoftwareToken(user.sub, verificationCode)

		res.json({ success: true })
	} catch (error) {
		handleServiceError(res, error)
	}
}

const respondToMfaChallenge = async (req: Request, res: Response) => {
	try {
		const { challengeName, mfaCode } = req.body
		const user = req.user

		// Respond to MFA challenge
		const authResult = await respondToMfaChallenge(
			user.sub,
			challengeName,
			mfaCode,
		)

		// Return new tokens
		res.json({
			accessToken: authResult.AuthenticationResult?.AccessToken,
			refreshToken: authResult.AuthenticationResult?.RefreshToken,
			idToken: authResult.AuthenticationResult?.IdToken,
		})
	} catch (error) {
		handleServiceError(res, error)
	}
}

// Add routes
router.post('/auth/mfa/setup', authenticateToken, setupMfa)
router.post('/auth/mfa/verify', authenticateToken, verifyMfa)
router.post(
	'/auth/mfa/respond-to-challenge',
	authenticateToken,
	respondToMfaChallenge,
)
```

#### **Enhanced Cognito Service**

```typescript
// apps/express-api/src/features/auth/auth.services.ts
export class CognitoService {
	// ... existing methods

	async associateSoftwareToken(userId: string) {
		const command = new AssociateSoftwareTokenCommand({
			UserPoolId: this.userPoolId,
			Session: await this.getUserSession(userId),
		})

		return await this.client.send(command)
	}

	async verifySoftwareToken(userId: string, token: string) {
		const command = new VerifySoftwareTokenCommand({
			UserPoolId: this.userPoolId,
			UserCode: token,
			Session: await this.getUserSession(userId),
		})

		return await this.client.send(command)
	}

	async respondToMfaChallenge(
		userId: string,
		challengeName: string,
		mfaCode: string,
	) {
		const command = new RespondToAuthChallengeCommand({
			ClientId: this.clientId,
			ChallengeName: challengeName,
			Session: await this.getUserSession(userId),
			ChallengeResponses: {
				SOFTWARE_TOKEN_MFA_CODE: mfaCode,
			},
		})

		return await this.client.send(command)
	}

	private async getUserSession(userId: string) {
		// Get current user session for MFA operations
		const command = new GetUserCommand({
			AccessToken: await this.getAccessToken(userId),
		})

		const user = await this.client.send(command)
		return user.Session || ''
	}
}
```

### **4. Login Flow Enhancement**

#### **Enhanced Login Handler**

```typescript
// Modified login controller to handle MFA challenges
const login = async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body

		const authResult = await cognitoService.initiateAuth(email, password)

		if (authResult.AuthenticationResult) {
			// Successful login - no MFA required
			res.json({
				accessToken: authResult.AuthenticationResult.AccessToken,
				refreshToken: authResult.AuthenticationResult.RefreshToken,
				idToken: authResult.AuthenticationResult.IdToken,
			})
		} else if (authResult.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
			// MFA challenge required
			res.json({
				challengeName: 'SOFTWARE_TOKEN_MFA',
				challengeParameters: authResult.ChallengeParameters,
				session: authResult.Session,
			})
		} else if (authResult.ChallengeName === 'SMS_MFA') {
			// SMS MFA challenge
			res.json({
				challengeName: 'SMS_MFA',
				challengeParameters: authResult.ChallengeParameters,
				session: authResult.Session,
			})
		}
	} catch (error) {
		handleServiceError(res, error)
	}
}
```

#### **Enhanced Frontend Login Hook**

```typescript
// apps/client-ui/src/services/hooks/auth/use-post-login-mutation.tsx
export const usePostLoginMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ email, password }: LoginRequest) => {
			const response = await postLogin({ email, password })

			// Check if MFA challenge is required
			if (
				response.challengeName === 'SOFTWARE_TOKEN_MFA' ||
				response.challengeName === 'SMS_MFA'
			) {
				// Store challenge session for MFA verification
				localStorage.setItem('mfaSession', response.session)
				localStorage.setItem('mfaType', response.challengeName)
				throw new Error('MFA_REQUIRED')
			}

			return response
		},
		onSuccess: async (data) => {
			// Update tokens and fetch user data
			setTokens(data)
			const userData = await getAuthUser()
			queryClient.setQueryData([QUERY_KEY.authUser], userData)
		},
		onError: (error) => {
			if (error.message === 'MFA_REQUIRED') {
				// Handle MFA flow
				navigate({ to: '/auth/mfa-challenge' })
			}
		},
	})
}
```

### **5. MFA Management UI**

#### **Settings Integration**

```tsx
// User settings with MFA toggle
const SecuritySettings = () => {
	const [mfaEnabled, setMfaEnabled] = useState(false)
	const [showSetup, setShowSetup] = useState(false)

	useEffect(() => {
		// Check if user has MFA enabled
		checkMfaStatus().then(setMfaEnabled)
	}, [])

	const handleDisableMfa = async () => {
		try {
			await fetch('/api/auth/mfa/disable', {
				method: 'POST',
				headers: { Authorization: `Bearer ${getAccessToken()}` },
			})
			setMfaEnabled(false)
			toast.success('MFA disabled')
		} catch (error) {
			toast.error('Failed to disable MFA')
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium">Two-Factor Authentication</h3>
					<p className="text-sm text-muted-foreground">
						Add an extra layer of security to your account using authenticator
						apps
					</p>
				</div>
				<div className="flex items-center space-x-2">
					{mfaEnabled && (
						<Button variant="outline" onClick={handleDisableMfa}>
							Disable
						</Button>
					)}
					<Button onClick={() => setShowSetup(true)}>
						{mfaEnabled ? 'Manage' : 'Enable'}
					</Button>
				</div>
			</div>

			{showSetup && (
				<MfaSetup
					onComplete={() => {
						setShowSetup(false)
						setMfaEnabled(true)
					}}
				/>
			)}
		</div>
	)
}
```

## 🔒 Security Considerations

### **MFA Enforcement Policies**

- **Optional by Default**: Users can choose to enable MFA
- **Admin Requirement**: Consider mandatory MFA for admin accounts
- **Session Management**: Properly handle MFA in token refresh flows

### **Recovery Mechanisms**

- **Backup Codes**: Generate one-time recovery codes during setup
- **Account Recovery**: Provide alternative verification methods
- **Support Access**: Admin tools for MFA reset when needed

### **Audit & Monitoring**

```typescript
// Enhanced logging for security events
const logSecurityEvent = (event: string, userId: string, details: any) => {
	logger.info('Security Event', {
		event,
		userId,
		timestamp: new Date().toISOString(),
		details,
	})
}

// Log MFA setup, verification, and failures
logSecurityEvent('MFA_SETUP_INITIATED', userId, { method: 'TOTP' })
logSecurityEvent('MFA_VERIFICATION_SUCCESS', userId, { method: 'TOTP' })
logSecurityEvent('MFA_VERIFICATION_FAILED', userId, { reason: 'Invalid code' })
```

## 📊 Implementation Benefits

### **Security Enhancements**

- **Account Protection**: Prevents unauthorized access even with compromised passwords
- **Compliance**: Meets security requirements for sensitive applications
- **Risk Reduction**: Additional security layer for high-value accounts

### **User Experience**

- **Progressive Enhancement**: Optional MFA doesn't break existing flows
- **Modern UX**: Clean setup flow with QR code generation
- **Recovery Options**: Backup codes and alternative verification methods

### **Operational Benefits**

- **Audit Trail**: Comprehensive logging for security events
- **Admin Tools**: Management interface for MFA administration
- **Monitoring**: Track MFA adoption and security metrics

## 🔧 Implementation Checklist

### **Phase 1: Infrastructure Setup**

- [ ] Configure Cognito User Pool with MFA settings
- [ ] Enable TOTP support in Cognito
- [ ] Set up MFA challenge handling
- [ ] Configure SMS MFA (optional)

### **Phase 2: Backend Implementation**

- [ ] Add MFA setup endpoints
- [ ] Implement MFA verification logic
- [ ] Handle MFA challenges in login flow
- [ ] Add MFA management endpoints

### **Phase 3: Frontend Integration**

- [ ] Create MFA setup component
- [ ] Build MFA challenge handler
- [ ] Update login flow for MFA challenges
- [ ] Add MFA settings to user profile

### **Phase 4: Security & Testing**

- [ ] Implement comprehensive logging
- [ ] Add rate limiting for MFA attempts
- [ ] Create backup code system
- [ ] Test complete MFA flow end-to-end

## 🎯 Success Metrics

### **Security Metrics**

- **MFA Adoption Rate**: Target 40%+ of active users
- **Failed Login Reduction**: 60%+ reduction in unauthorized access attempts
- **Security Incidents**: 80%+ reduction in account compromise incidents

### **User Experience Metrics**

- **Setup Completion Rate**: >90% of users who start MFA setup complete it
- **Challenge Success Rate**: >95% of MFA challenges are completed successfully
- **User Satisfaction**: >85% satisfaction with MFA implementation

### **Operational Metrics**

- **Support Tickets**: 50% reduction in password-related support issues
- **Admin Efficiency**: 70%+ reduction in manual account recovery requests
- **Audit Compliance**: 100% logging of security events

## 📚 Related Documentation

- **[Authentication Overview](../README.md)** - Current auth implementation
- **[Security Architecture](../../architecture/security-architecture.md)** - Security patterns and policies
- **[Token Management](../token-management.md)** - JWT and session handling
- **[Cognito Integration](../cognito-integration.md)** - AWS Cognito setup and configuration

## 🔄 Migration Strategy

### **Backward Compatibility**

- All existing authentication flows continue to work
- MFA is optional and progressively enhanced
- No breaking changes to existing user experience

### **Gradual Rollout**

1. **Phase 1**: Enable infrastructure and basic MFA setup
2. **Phase 2**: Add MFA challenge handling to login flows
3. **Phase 3**: Create user-facing MFA management interface
4. **Phase 4**: Add advanced features (backup codes, recovery)

### **User Communication**

- **Opt-in Approach**: Clear messaging about MFA benefits
- **Setup Assistance**: Step-by-step guidance during setup
- **Recovery Support**: Multiple recovery options for locked accounts

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Implementation Ready
