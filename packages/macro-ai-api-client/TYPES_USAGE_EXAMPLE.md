# TypeScript Types Usage Examples

This document demonstrates how to use the auto-generated TypeScript types from the `@repo/macro-ai-api-client` package.

## Overview

The package now automatically generates TypeScript interfaces for all API requests and responses, organized by domain:

- **Auth Types**: `AuthPostLoginRequest`, `AuthPostLoginResponse`, etc.
- **Chat Types**: `ChatGetChatsResponse`, `ChatPostChatsRequest`, etc.
- **User Types**: `UserGetUsersByIdResponse`, `UserGetUsersMeResponse`, etc.

## Import Examples

### Import Specific Types

```typescript
import type {
	AuthPostLoginRequest,
	AuthPostLoginResponse,
	ChatPostChatsRequest,
	ChatGetChatsResponse,
	UserGetUsersMeResponse,
} from '@repo/macro-ai-api-client'
```

### Import All Types from a Domain

```typescript
// Import all auth types
import type * as AuthTypes from '@repo/macro-ai-api-client/types/auth.types'

// Import all chat types
import type * as ChatTypes from '@repo/macro-ai-api-client/types/chat.types'
```

## Usage Examples

### 1. Typing API Client Responses

```typescript
import {
	createAuthClient,
	type AuthPostLoginResponse,
} from '@repo/macro-ai-api-client'

const authClient = createAuthClient('https://api.example.com')

// Type the response
const handleLogin = async (
	email: string,
	password: string,
): Promise<AuthPostLoginResponse> => {
	const response = await authClient.post('/auth/login', {
		email,
		password,
	})

	// response is now properly typed
	console.log(response.tokens.accessToken) // TypeScript knows this exists
	return response
}
```

### 2. Typing Request Bodies

```typescript
import type {
	ChatPostChatsRequest,
	ChatPostChatsResponse,
} from '@repo/macro-ai-api-client'

const createChat = async (
	request: ChatPostChatsRequest,
): Promise<ChatPostChatsResponse> => {
	// request.title is typed as string
	const response = await chatClient.post('/chats', request)

	// response.data.id is typed as string
	return response
}

// Usage
const newChat = await createChat({
	title: 'My New Chat', // TypeScript validates this
})
```

### 3. Typing Component Props

```typescript
import type { UserGetUsersMeResponse } from '@repo/macro-ai-api-client'

interface UserProfileProps {
  user: UserGetUsersMeResponse['user'] // Extract nested type
}

const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  return (
    <div>
      <h1>{user.firstName} {user.lastName}</h1>
      <p>{user.email}</p>
      <p>Verified: {user.emailVerified ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

### 4. Typing State Management

```typescript
import type { ChatGetChatsResponse } from '@repo/macro-ai-api-client'

interface ChatState {
	chats: ChatGetChatsResponse['data']
	loading: boolean
	error: string | null
}

const initialState: ChatState = {
	chats: [],
	loading: false,
	error: null,
}
```

### 5. Typing API Hooks

```typescript
import type {
	AuthPostLoginRequest,
	AuthPostLoginResponse,
} from '@repo/macro-ai-api-client'

const useLogin = () => {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const login = async (
		credentials: AuthPostLoginRequest,
	): Promise<AuthPostLoginResponse | null> => {
		setLoading(true)
		setError(null)

		try {
			const response = await authClient.post('/auth/login', credentials)
			return response
		} catch (err) {
			setError(err.message)
			return null
		} finally {
			setLoading(false)
		}
	}

	return { login, loading, error }
}
```

### 6. Typing Form Validation

```typescript
import type { AuthPostRegisterRequest } from '@repo/macro-ai-api-client'
import { z } from 'zod'

// Create Zod schema that matches the TypeScript type
const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	confirmPassword: z.string().min(8),
}) satisfies z.ZodType<AuthPostRegisterRequest>

type RegisterFormData = z.infer<typeof registerSchema>

const RegisterForm = () => {
	const handleSubmit = (data: RegisterFormData) => {
		// data is typed as AuthPostRegisterRequest
		authClient.post('/auth/register', data)
	}
}
```

## Benefits

### 1. **Type Safety**

- Catch type errors at compile time
- IntelliSense support in IDEs
- Refactoring safety

### 2. **Auto-Sync with API**

- Types automatically update when API changes
- No manual maintenance required
- Always in sync with backend

### 3. **Better Developer Experience**

- Clear API contracts
- Reduced documentation lookup
- Faster development

### 4. **Reduced Runtime Errors**

- Compile-time validation
- Consistent data structures
- Fewer undefined property access errors

## Migration from Manual Types

If you were previously using manual types or `ReturnType<typeof clientFunction>`, you can now replace them:

```typescript
// Before (manual types)
interface LoginResponse {
	message: string
	tokens: {
		accessToken: string
		refreshToken: string
		expiresIn: number
	}
}

// After (auto-generated types)
import type { AuthPostLoginResponse } from '@repo/macro-ai-api-client'
// AuthPostLoginResponse is automatically generated and always up-to-date
```

## Type Organization

Types follow a consistent naming pattern:

- **Format**: `{Domain}{Method}{Path}{Request|Response}`
- **Examples**:
  - `AuthPostLoginRequest` - POST /auth/login request body
  - `AuthPostLoginResponse` - POST /auth/login response body
  - `ChatGetChatsResponse` - GET /chats response body
  - `UserGetUsersByIdResponse` - GET /users/{id} response body

This makes it easy to find and use the right types for your API interactions.
