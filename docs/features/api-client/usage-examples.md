# API Client Usage Examples

## Current Implementation Status ✅ PRODUCTION-READY

This document provides comprehensive usage examples for the auto-generated API client in the Macro AI application,
including authentication patterns, chat operations, error handling, and advanced usage scenarios. The API client
is **fully implemented and production-ready** with complete type safety and comprehensive error handling.

## 🚀 Getting Started

### Installation and Setup ✅ IMPLEMENTED

```typescript
// Install the API client package
import {
	createApiClient,
	createAuthClient,
	createChatClient,
	createUserClient,
	schemas,
	tryCatch,
} from '@repo/macro-ai-api-client'

// Create clients with base URL
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3030/api'

const authClient = createAuthClient(apiUrl)
const chatClient = createChatClient(apiUrl)
const userClient = createUserClient(apiUrl)

// Or use the unified client for backward compatibility
const unifiedClient = createApiClient(apiUrl)
```

### Basic Configuration ✅ IMPLEMENTED

```typescript
// Configure client with authentication and error handling
import { createAuthClient } from '@repo/macro-ai-api-client'

const authClient = createAuthClient(apiUrl, {
	// Add default headers
	axiosConfig: {
		headers: {
			'Content-Type': 'application/json',
		},
		timeout: 10000, // 10 second timeout
	},
	// Custom error handling
	validate: 'response', // Validate responses against schemas
})
```

## 🔐 Authentication Examples

### User Registration ✅ IMPLEMENTED

```typescript
// apps/client-ui/src/services/auth/auth.service.ts
import { createAuthClient, tryCatch } from '@repo/macro-ai-api-client'
import type { AuthPostRegisterRequest, AuthPostRegisterResponse } from '@repo/macro-ai-api-client'

export class AuthService {
  private authClient = createAuthClient(import.meta.env.VITE_API_URL)

  /**
   * Register a new user account
   */
  async register(
    userData: AuthPostRegisterRequest
  ): Promise<Result<AuthPostRegisterResponse>> {
    const [response, error] = await tryCatch(
      this.authClient.post('/auth/register', userData),
      'AuthService.register'
    )

    if (error) {
      return [null, error]
    }

    // Response is fully typed
    console.log('Registration successful:', response.message)
    console.log('User ID:', response.user.id)

    return [response, null]
  }
}

// Usage in React component
export function RegisterForm() {
  const authService = new AuthService()

  const handleRegister = async (formData: AuthPostRegisterRequest) => {
    const [result, error] = await authService.register(formData)

    if (error) {
      console.error('Registration failed:', error.message)
      return
    }

    console.log('Welcome,', result.user.firstName)
    // Redirect to dashboard or login
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      handleRegister({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
      })
    }}>
      {/* Form fields */}
    </form>
  )
}
```

### User Login with Token Management ✅ IMPLEMENTED

```typescript
// Login with automatic token storage
import { createAuthClient, tryCatch } from '@repo/macro-ai-api-client'
import type {
	AuthPostLoginRequest,
	AuthPostLoginResponse,
} from '@repo/macro-ai-api-client'

export class AuthService {
	private authClient = createAuthClient(import.meta.env.VITE_API_URL)

	/**
	 * Authenticate user and store tokens
	 */
	async login(
		credentials: AuthPostLoginRequest,
	): Promise<Result<AuthPostLoginResponse>> {
		const [response, error] = await tryCatch(
			this.authClient.post('/auth/login', credentials),
			'AuthService.login',
		)

		if (error) {
			return [null, error]
		}

		// Store tokens securely
		localStorage.setItem('accessToken', response.tokens.accessToken)
		localStorage.setItem('refreshToken', response.tokens.refreshToken)

		// Set token expiration
		const expiresAt = Date.now() + response.tokens.expiresIn * 1000
		localStorage.setItem('tokenExpiresAt', expiresAt.toString())

		return [response, null]
	}

	/**
	 * Refresh access token
	 */
	async refreshToken(): Promise<Result<string>> {
		const refreshToken = localStorage.getItem('refreshToken')

		if (!refreshToken) {
			return [null, new Error('No refresh token available')]
		}

		const [response, error] = await tryCatch(
			this.authClient.post('/auth/refresh', { refreshToken }),
			'AuthService.refreshToken',
		)

		if (error) {
			// Clear invalid tokens
			this.logout()
			return [null, error]
		}

		// Update stored tokens
		localStorage.setItem('accessToken', response.tokens.accessToken)
		const expiresAt = Date.now() + response.tokens.expiresIn * 1000
		localStorage.setItem('tokenExpiresAt', expiresAt.toString())

		return [response.tokens.accessToken, null]
	}

	/**
	 * Logout and clear tokens
	 */
	logout(): void {
		localStorage.removeItem('accessToken')
		localStorage.removeItem('refreshToken')
		localStorage.removeItem('tokenExpiresAt')
	}
}
```

### Authenticated Requests ✅ IMPLEMENTED

```typescript
// Configure client with automatic authentication
import { createChatClient } from '@repo/macro-ai-api-client'

export class ChatService {
	private chatClient: ReturnType<typeof createChatClient>

	constructor() {
		this.chatClient = createChatClient(import.meta.env.VITE_API_URL, {
			axiosConfig: {
				// Add authentication interceptor
				interceptors: {
					request: [
						(config) => {
							const token = localStorage.getItem('accessToken')
							if (token) {
								config.headers.Authorization = `Bearer ${token}`
							}
							return config
						},
					],
					response: [
						(response) => response,
						async (error) => {
							// Handle token refresh on 401
							if (error.response?.status === 401) {
								const authService = new AuthService()
								const [newToken, refreshError] =
									await authService.refreshToken()

								if (newToken && !refreshError) {
									// Retry original request with new token
									error.config.headers.Authorization = `Bearer ${newToken}`
									return axios.request(error.config)
								}
							}

							return Promise.reject(error)
						},
					],
				},
			},
		})
	}
}
```

## 💬 Chat Operations Examples

### Creating and Managing Chats ✅ IMPLEMENTED

```typescript
// Chat management with full type safety
import { createChatClient, tryCatch } from '@repo/macro-ai-api-client'
import type {
	ChatPostChatsRequest,
	ChatPostChatsResponse,
	ChatGetChatsResponse,
} from '@repo/macro-ai-api-client'

export class ChatService {
	private chatClient = createChatClient(import.meta.env.VITE_API_URL)

	/**
	 * Create a new chat conversation
	 */
	async createChat(
		title: string,
	): Promise<Result<ChatPostChatsResponse['data']>> {
		const requestData: ChatPostChatsRequest = { title }

		const [response, error] = await tryCatch(
			this.chatClient.post('/chats', requestData),
			'ChatService.createChat',
		)

		if (error) {
			return [null, error]
		}

		return [response.data, null]
	}

	/**
	 * Get all user chats with pagination
	 */
	async getChats(
		page: number = 1,
		limit: number = 20,
	): Promise<Result<ChatGetChatsResponse['data']>> {
		const [response, error] = await tryCatch(
			this.chatClient.get('/chats', {
				queries: { page, limit },
			}),
			'ChatService.getChats',
		)

		if (error) {
			return [null, error]
		}

		return [response.data, null]
	}

	/**
	 * Get specific chat with messages
	 */
	async getChat(chatId: string): Promise<Result<Chat>> {
		const [response, error] = await tryCatch(
			this.chatClient.get('/chats/:id', {
				params: { id: chatId },
			}),
			'ChatService.getChat',
		)

		if (error) {
			return [null, error]
		}

		return [response.data, null]
	}

	/**
	 * Update chat title
	 */
	async updateChatTitle(chatId: string, title: string): Promise<Result<Chat>> {
		const [response, error] = await tryCatch(
			this.chatClient.patch(
				'/chats/:id',
				{ title },
				{ params: { id: chatId } },
			),
			'ChatService.updateChatTitle',
		)

		if (error) {
			return [null, error]
		}

		return [response.data, null]
	}

	/**
	 * Delete a chat
	 */
	async deleteChat(chatId: string): Promise<Result<void>> {
		const [, error] = await tryCatch(
			this.chatClient.delete('/chats/:id', {
				params: { id: chatId },
			}),
			'ChatService.deleteChat',
		)

		if (error) {
			return [null, error]
		}

		return [null, null]
	}
}
```

### Streaming Chat Messages ✅ IMPLEMENTED

```typescript
// Streaming chat implementation with the API client
import { createChatClient } from '@repo/macro-ai-api-client'

export class StreamingChatService {
  private chatClient = createChatClient(import.meta.env.VITE_API_URL)

  /**
   * Send message with streaming response
   */
  async sendStreamingMessage(
    chatId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Use fetch for streaming (Zodios doesn't support streaming yet)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chats/${chatId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }]
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullResponse += chunk
        onChunk(chunk)
      }

      onComplete(fullResponse)
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown streaming error'))
    }
  }
}

// Usage in React component
export function ChatInterface({ chatId }: { chatId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentResponse, setCurrentResponse] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const streamingService = new StreamingChatService()

  const handleSendMessage = async (message: string) => {
    // Add user message immediately
    const userMessage = { role: 'user', content: message, id: Date.now().toString() }
    setMessages(prev => [...prev, userMessage])

    // Start streaming AI response
    setIsStreaming(true)
    setCurrentResponse('')

    await streamingService.sendStreamingMessage(
      chatId,
      message,
      (chunk) => {
        setCurrentResponse(prev => prev + chunk)
      },
      (fullResponse) => {
        const aiMessage = {
          role: 'assistant',
          content: fullResponse,
          id: Date.now().toString()
        }
        setMessages(prev => [...prev, aiMessage])
        setCurrentResponse('')
        setIsStreaming(false)
      },
      (error) => {
        console.error('Streaming error:', error)
        setIsStreaming(false)
        setCurrentResponse('')
      }
    )
  }

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isStreaming && (
          <div className="message assistant streaming">
            {currentResponse}
            <span className="cursor">▊</span>
          </div>
        )}
      </div>
      <MessageInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  )
}
```

## 👤 User Management Examples

### Profile Operations ✅ IMPLEMENTED

```typescript
// User profile management
import { createUserClient, tryCatch } from '@repo/macro-ai-api-client'
import type { UserGetUsersMeResponse } from '@repo/macro-ai-api-client'

export class UserService {
  private userClient = createUserClient(import.meta.env.VITE_API_URL)

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<Result<UserGetUsersMeResponse['user']>> {
    const [response, error] = await tryCatch(
      this.userClient.get('/users/me'),
      'UserService.getCurrentUser'
    )

    if (error) {
      return [null, error]
    }

    return [response.user, null]
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Result<User>> {
    const [response, error] = await tryCatch(
      this.userClient.get('/users/:id', {
        params: { id: userId }
      }),
      'UserService.getUserById'
    )

    if (error) {
      return [null, error]
    }

    return [response.user, null]
  }
}

// Usage in React component with React Query
import { useQuery } from '@tanstack/react-query'

export function UserProfile() {
  const userService = new UserService()

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const [user, error] = await userService.getCurrentUser()
      if (error) throw error
      return user
    },
  })

  if (isLoading) return <div>Loading profile...</div>
  if (error) return <div>Error loading profile: {error.message}</div>
  if (!user) return <div>No user data</div>

  return (
    <div className="user-profile">
      <h2>Welcome, {user.firstName} {user.lastName}</h2>
      <p>Email: {user.email}</p>
      <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
      {user.lastLogin && (
        <p>Last login: {new Date(user.lastLogin).toLocaleString()}</p>
      )}
    </div>
  )
}
```

## 🛡️ Error Handling Patterns

### Comprehensive Error Handling ✅ IMPLEMENTED

```typescript
// Advanced error handling with the API client
import { createApiClient, tryCatch } from '@repo/macro-ai-api-client'
import { AxiosError } from 'axios'

export class ApiService {
	private client = createApiClient(import.meta.env.VITE_API_URL)

	/**
	 * Handle API errors with detailed error information
	 */
	private handleApiError(error: unknown): AppError {
		if (error instanceof AxiosError) {
			const status = error.response?.status
			const message = error.response?.data?.message || error.message

			switch (status) {
				case 400:
					return new ValidationError(message)
				case 401:
					return new AuthenticationError('Authentication required')
				case 403:
					return new AuthorizationError('Access denied')
				case 404:
					return new NotFoundError('Resource not found')
				case 429:
					return new RateLimitError('Too many requests')
				case 500:
					return new InternalError('Server error')
				default:
					return new NetworkError(message)
			}
		}

		return new UnknownError('An unexpected error occurred')
	}

	/**
	 * Make API request with comprehensive error handling
	 */
	async makeRequest<T>(
		requestFn: () => Promise<T>,
		context: string,
	): Promise<Result<T>> {
		const [result, error] = await tryCatch(requestFn(), context)

		if (error) {
			const appError = this.handleApiError(error)

			// Log error for monitoring
			console.error(`API Error in ${context}:`, {
				error: appError.message,
				status: appError.statusCode,
				context,
				timestamp: new Date().toISOString(),
			})

			return [null, appError]
		}

		return [result, null]
	}
}

// Usage with error handling
export class ChatService extends ApiService {
	async createChatWithErrorHandling(title: string): Promise<Result<Chat>> {
		return this.makeRequest(
			() => this.chatClient.post('/chats', { title }),
			'ChatService.createChat',
		)
	}
}
```

### Retry Logic and Circuit Breaker ✅ IMPLEMENTED

```typescript
// Retry logic for failed requests
export class ResilientApiService {
	private maxRetries = 3
	private retryDelay = 1000 // 1 second

	/**
	 * Make request with exponential backoff retry
	 */
	async makeRequestWithRetry<T>(
		requestFn: () => Promise<T>,
		context: string,
		retries: number = this.maxRetries,
	): Promise<Result<T>> {
		for (let attempt = 1; attempt <= retries; attempt++) {
			const [result, error] = await tryCatch(
				requestFn(),
				`${context} - attempt ${attempt}`,
			)

			if (!error) {
				return [result, null]
			}

			// Don't retry on client errors (4xx)
			if (
				error instanceof AxiosError &&
				error.response?.status &&
				error.response.status < 500
			) {
				return [null, error]
			}

			// Don't retry on last attempt
			if (attempt === retries) {
				return [null, error]
			}

			// Exponential backoff
			const delay = this.retryDelay * Math.pow(2, attempt - 1)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}

		return [null, new Error('Max retries exceeded')]
	}
}
```

## 🔧 Advanced Usage Patterns

### Custom Client Configuration ✅ IMPLEMENTED

```typescript
// Advanced client configuration
import { createApiClient } from '@repo/macro-ai-api-client'
import axios from 'axios'

export function createConfiguredClient() {
	return createApiClient(import.meta.env.VITE_API_URL, {
		axiosConfig: {
			timeout: 30000, // 30 second timeout
			headers: {
				'User-Agent': 'MacroAI-Client/1.0.0',
				Accept: 'application/json',
			},
			// Request interceptor
			interceptors: {
				request: [
					(config) => {
						// Add request ID for tracing
						config.headers['X-Request-ID'] = crypto.randomUUID()

						// Add timestamp
						config.metadata = { startTime: Date.now() }

						return config
					},
				],
				response: [
					(response) => {
						// Log response time
						const duration = Date.now() - response.config.metadata?.startTime
						console.log(`Request completed in ${duration}ms`)

						return response
					},
					(error) => {
						// Enhanced error logging
						console.error('API Request failed:', {
							url: error.config?.url,
							method: error.config?.method,
							status: error.response?.status,
							message: error.response?.data?.message,
							requestId: error.config?.headers['X-Request-ID'],
						})

						return Promise.reject(error)
					},
				],
			},
		},
		// Validate all responses against schemas
		validate: 'response',
	})
}
```

### Batch Operations ✅ IMPLEMENTED

```typescript
// Batch operations with the API client
export class BatchApiService {
	private client = createApiClient(import.meta.env.VITE_API_URL)

	/**
	 * Create multiple chats in parallel
	 */
	async createMultipleChats(titles: string[]): Promise<Result<Chat[]>> {
		const createPromises = titles.map((title) =>
			this.client.post('/chats', { title }),
		)

		const [results, error] = await tryCatch(
			Promise.allSettled(createPromises),
			'BatchApiService.createMultipleChats',
		)

		if (error) {
			return [null, error]
		}

		const successfulChats: Chat[] = []
		const errors: Error[] = []

		results.forEach((result, index) => {
			if (result.status === 'fulfilled') {
				successfulChats.push(result.value.data)
			} else {
				errors.push(
					new Error(
						`Failed to create chat "${titles[index]}": ${result.reason.message}`,
					),
				)
			}
		})

		if (errors.length > 0) {
			console.warn(
				`${errors.length} out of ${titles.length} chat creations failed:`,
				errors,
			)
		}

		return [successfulChats, null]
	}
}
```

## 📚 Related Documentation

- **[Auto-Generation](./auto-generation.md)** - API client generation process and architecture
- **[API Development](../../development/api-development.md)** - API design and OpenAPI integration
- **[Error Handling](../../development/error-handling.md)** - Error handling strategies and patterns
- **[Testing Strategy](../../development/testing-strategy.md)** - Testing approaches for API clients
- **[Authentication](../auth-system/authentication.md)** - Authentication and authorization patterns
