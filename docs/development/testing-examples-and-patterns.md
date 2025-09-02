# Testing Examples and Patterns

## Overview

This document provides practical examples and proven patterns for testing different types of code in the macro-ai monorepo.
Each example includes detailed explanations and can be used as templates for similar testing scenarios.

## Table of Contents

1. [Unit Testing Patterns](#unit-testing-patterns)
2. [Integration Testing Patterns](#integration-testing-patterns)
3. [API Testing Patterns](#api-testing-patterns)
4. [Database Testing Patterns](#database-testing-patterns)
5. [Mocking Patterns](#mocking-patterns)
6. [Error Testing Patterns](#error-testing-patterns)
7. [Performance Testing Patterns](#performance-testing-patterns)
8. [Security Testing Patterns](#security-testing-patterns)
9. [Advanced Testing Patterns](#advanced-testing-patterns)

## Unit Testing Patterns

### Pattern 1: Pure Function Testing

**Use Case**: Testing functions with no side effects

```typescript
// src/utils/calculations.ts
export const calculateDiscountedPrice = (
	originalPrice: number,
	discountPercent: number,
): number => {
	if (originalPrice < 0) throw new Error('Price cannot be negative')
	if (discountPercent < 0 || discountPercent > 100) {
		throw new Error('Discount must be between 0 and 100')
	}

	return originalPrice * (1 - discountPercent / 100)
}

// src/utils/__tests__/calculations.test.ts
import { describe, it, expect } from 'vitest'
import { calculateDiscountedPrice } from '../calculations'

describe('calculateDiscountedPrice', () => {
	describe('with valid inputs', () => {
		it('should calculate 10% discount correctly', () => {
			expect(calculateDiscountedPrice(100, 10)).toBe(90)
		})

		it('should handle 0% discount', () => {
			expect(calculateDiscountedPrice(100, 0)).toBe(100)
		})

		it('should handle 100% discount', () => {
			expect(calculateDiscountedPrice(100, 100)).toBe(0)
		})

		it('should handle decimal prices', () => {
			expect(calculateDiscountedPrice(19.99, 15)).toBeCloseTo(16.99, 2)
		})
	})

	describe('with invalid inputs', () => {
		it('should throw error for negative price', () => {
			expect(() => calculateDiscountedPrice(-10, 10)).toThrow(
				'Price cannot be negative',
			)
		})

		it('should throw error for invalid discount percentage', () => {
			expect(() => calculateDiscountedPrice(100, -5)).toThrow(
				'Discount must be between 0 and 100',
			)

			expect(() => calculateDiscountedPrice(100, 150)).toThrow(
				'Discount must be between 0 and 100',
			)
		})
	})
})
```

### Pattern 2: Class Method Testing

**Use Case**: Testing class methods with state

```typescript
// src/services/cart.service.ts
export class CartService {
	private items: CartItem[] = []

	addItem(product: Product, quantity: number): void {
		if (quantity <= 0) throw new Error('Quantity must be positive')

		const existingItem = this.items.find(
			(item) => item.productId === product.id,
		)

		if (existingItem) {
			existingItem.quantity += quantity
		} else {
			this.items.push({
				productId: product.id,
				name: product.name,
				price: product.price,
				quantity,
			})
		}
	}

	getTotal(): number {
		return this.items.reduce(
			(total, item) => total + item.price * item.quantity,
			0,
		)
	}

	clear(): void {
		this.items = []
	}
}

// src/services/__tests__/cart.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CartService } from '../cart.service'
import { MockDataFactory } from '../../utils/test-helpers'

describe('CartService', () => {
	let cartService: CartService

	beforeEach(() => {
		cartService = new CartService()
	})

	describe('addItem', () => {
		it('should add new item to cart', () => {
			const product = MockDataFactory.createProduct()

			cartService.addItem(product, 2)

			expect(cartService.getTotal()).toBe(product.price * 2)
		})

		it('should update quantity for existing item', () => {
			const product = MockDataFactory.createProduct({ price: 10 })

			cartService.addItem(product, 1)
			cartService.addItem(product, 2)

			expect(cartService.getTotal()).toBe(30) // 10 * (1 + 2)
		})

		it('should throw error for invalid quantity', () => {
			const product = MockDataFactory.createProduct()

			expect(() => cartService.addItem(product, 0)).toThrow(
				'Quantity must be positive',
			)

			expect(() => cartService.addItem(product, -1)).toThrow(
				'Quantity must be positive',
			)
		})
	})

	describe('getTotal', () => {
		it('should return 0 for empty cart', () => {
			expect(cartService.getTotal()).toBe(0)
		})

		it('should calculate total for multiple items', () => {
			const product1 = MockDataFactory.createProduct({ price: 10 })
			const product2 = MockDataFactory.createProduct({ price: 20 })

			cartService.addItem(product1, 2) // 20
			cartService.addItem(product2, 1) // 20

			expect(cartService.getTotal()).toBe(40)
		})
	})
})
```

## Integration Testing Patterns

### Pattern 1: Service Layer Integration

**Use Case**: Testing services that interact with multiple dependencies

```typescript
// src/features/user/user.service.ts
export class UserService {
	constructor(
		private db: Database,
		private emailService: EmailService,
		private auditService: AuditService,
	) {}

	async createUser(userData: CreateUserData): Promise<User> {
		// Validate input
		const validation = validateUserData(userData)
		if (!validation.isValid) {
			throw new ValidationError(validation.errors)
		}

		// Check for existing user
		const existingUser = await this.db
			.select()
			.from(usersTable)
			.where(eq(usersTable.email, userData.email))
			.limit(1)

		if (existingUser.length > 0) {
			throw new ConflictError('User already exists')
		}

		// Create user
		const [user] = await this.db
			.insert(usersTable)
			.values({
				...userData,
				id: generateUUID(),
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning()

		// Send welcome email
		await this.emailService.sendWelcomeEmail(user)

		// Log audit event
		await this.auditService.logEvent({
			action: 'USER_CREATED',
			userId: user.id,
			metadata: { email: user.email },
		})

		return user
	}
}

// src/features/user/__tests__/user.service.integration.test.ts
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	vi,
} from 'vitest'
import {
	setupDatabaseIntegration,
	cleanupGlobalResources,
	MockDataFactory,
} from '../../../utils/test-helpers'
import { UserService } from '../user.service'

describe('UserService Integration', () => {
	let dbContext: DatabaseTestContext
	let userService: UserService
	let mockEmailService: any
	let mockAuditService: any

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()

		// Create mocks for external services
		mockEmailService = {
			sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
		}

		mockAuditService = {
			logEvent: vi.fn().mockResolvedValue({ success: true }),
		}

		userService = new UserService(
			dbContext.db,
			mockEmailService,
			mockAuditService,
		)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('createUser', () => {
		it('should create user with all integrations', async () => {
			const userData = {
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				password: 'StrongPass123',
			}

			const user = await userService.createUser(userData)

			// Verify user was created in database
			expect(user.email).toBe(userData.email)
			expect(user.id).toBeDefined()
			expect(user.createdAt).toBeInstanceOf(Date)

			// Verify welcome email was sent
			expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(user)

			// Verify audit event was logged
			expect(mockAuditService.logEvent).toHaveBeenCalledWith({
				action: 'USER_CREATED',
				userId: user.id,
				metadata: { email: user.email },
			})
		})

		it('should handle validation errors', async () => {
			const invalidUserData = {
				email: 'invalid-email',
				firstName: '',
				lastName: 'Doe',
				password: 'weak',
			}

			await expect(userService.createUser(invalidUserData)).rejects.toThrow(
				'Validation failed',
			)

			// Verify no side effects occurred
			expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled()
			expect(mockAuditService.logEvent).not.toHaveBeenCalled()
		})

		it('should handle duplicate email error', async () => {
			const userData = MockDataFactory.createUser()

			// Create first user
			await userService.createUser(userData)

			// Attempt to create duplicate
			await expect(userService.createUser(userData)).rejects.toThrow(
				'User already exists',
			)
		})

		it('should handle email service failure', async () => {
			mockEmailService.sendWelcomeEmail.mockRejectedValue(
				new Error('Email service unavailable'),
			)

			const userData = MockDataFactory.createUser()

			await expect(userService.createUser(userData)).rejects.toThrow(
				'Email service unavailable',
			)

			// Verify user was not created due to transaction rollback
			const users = await dbContext.db.select().from(usersTable)
			expect(users).toHaveLength(0)
		})
	})
})
```

## API Testing Patterns

### Pattern 1: REST API Endpoint Testing

**Use Case**: Testing complete HTTP request/response cycles

```typescript
// src/features/chat/__tests__/chat.routes.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import {
	setupDatabaseIntegration,
	cleanupGlobalResources,
	MockDataFactory,
} from '../../../utils/test-helpers'
import { createServer } from '../../../utils/server'

describe('Chat API Integration', () => {
	let app: Express
	let dbContext: DatabaseTestContext
	let authToken: string
	let testUser: User

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()
		app = createServer(dbContext.db)

		// Create test user and get auth token
		testUser = await createTestUser()
		authToken = generateAuthToken(testUser)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	beforeEach(async () => {
		// Clean up chats between tests
		await dbContext.db.delete(chatsTable)
	})

	describe('POST /api/chats', () => {
		it('should create new chat', async () => {
			const chatData = {
				title: 'Test Chat',
				userId: testUser.id,
			}

			const response = await request(app)
				.post('/api/chats')
				.set('Authorization', `Bearer ${authToken}`)
				.send(chatData)
				.expect(201)

			expect(response.body.success).toBe(true)
			expect(response.body.data.title).toBe(chatData.title)
			expect(response.body.data.userId).toBe(testUser.id)
			expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/)
		})

		it('should validate required fields', async () => {
			const invalidData = {
				// Missing title
				userId: testUser.id,
			}

			const response = await request(app)
				.post('/api/chats')
				.set('Authorization', `Bearer ${authToken}`)
				.send(invalidData)
				.expect(400)

			expect(response.body.success).toBe(false)
			expect(response.body.error).toContain('Title is required')
		})

		it('should require authentication', async () => {
			const chatData = {
				title: 'Test Chat',
				userId: testUser.id,
			}

			await request(app).post('/api/chats').send(chatData).expect(401)
		})

		it('should validate user ownership', async () => {
			const otherUser = MockDataFactory.createUser()
			const chatData = {
				title: 'Test Chat',
				userId: otherUser.id, // Different user
			}

			await request(app)
				.post('/api/chats')
				.set('Authorization', `Bearer ${authToken}`)
				.send(chatData)
				.expect(403)
		})
	})

	describe('GET /api/chats', () => {
		it('should return user chats with pagination', async () => {
			// Create test chats
			const chats = MockDataFactory.createArray(
				() => MockDataFactory.createChat({ userId: testUser.id }),
				5,
			)

			await dbContext.db.insert(chatsTable).values(chats)

			const response = await request(app)
				.get('/api/chats')
				.set('Authorization', `Bearer ${authToken}`)
				.query({ page: 1, limit: 3 })
				.expect(200)

			expect(response.body.success).toBe(true)
			expect(response.body.data).toHaveLength(3)
			expect(response.body.pagination.total).toBe(5)
			expect(response.body.pagination.hasNext).toBe(true)
		})

		it('should filter chats by user', async () => {
			const otherUser = MockDataFactory.createUser()
			await dbContext.db.insert(usersTable).values(otherUser)

			// Create chats for both users
			const userChats = MockDataFactory.createArray(
				() => MockDataFactory.createChat({ userId: testUser.id }),
				3,
			)
			const otherChats = MockDataFactory.createArray(
				() => MockDataFactory.createChat({ userId: otherUser.id }),
				2,
			)

			await dbContext.db
				.insert(chatsTable)
				.values([...userChats, ...otherChats])

			const response = await request(app)
				.get('/api/chats')
				.set('Authorization', `Bearer ${authToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(3) // Only user's chats
			response.body.data.forEach((chat) => {
				expect(chat.userId).toBe(testUser.id)
			})
		})
	})
})
```

### Pattern 2: Middleware Testing

**Use Case**: Testing Express middleware functions

```typescript
// src/middleware/rate-limit.middleware.ts
export const createRateLimitMiddleware = (options: {
	windowMs: number
	maxRequests: number
}) => {
	const requests = new Map<string, number[]>()

	return (req: Request, res: Response, next: NextFunction) => {
		const clientId = req.ip || 'unknown'
		const now = Date.now()
		const windowStart = now - options.windowMs

		// Clean old requests
		const clientRequests = requests.get(clientId) || []
		const recentRequests = clientRequests.filter((time) => time > windowStart)

		if (recentRequests.length >= options.maxRequests) {
			return res.status(429).json({
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil(options.windowMs / 1000),
			})
		}

		// Record this request
		recentRequests.push(now)
		requests.set(clientId, recentRequests)

		next()
	}
}

// src/middleware/__tests__/rate-limit.middleware.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { createRateLimitMiddleware } from '../rate-limit.middleware'

describe('Rate Limit Middleware', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let nextFunction: NextFunction
	let rateLimitMiddleware: any

	beforeEach(() => {
		mockRequest = {
			ip: '192.168.1.1',
		}

		mockResponse = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		}

		nextFunction = vi.fn()

		rateLimitMiddleware = createRateLimitMiddleware({
			windowMs: 60000, // 1 minute
			maxRequests: 5,
		})
	})

	it('should allow requests under limit', async () => {
		// Make 4 requests (under limit of 5)
		for (let i = 0; i < 4; i++) {
			await rateLimitMiddleware(mockRequest, mockResponse, nextFunction)
		}

		expect(nextFunction).toHaveBeenCalledTimes(4)
		expect(mockResponse.status).not.toHaveBeenCalled()
	})

	it('should block requests over limit', async () => {
		// Make 5 requests (at limit)
		for (let i = 0; i < 5; i++) {
			await rateLimitMiddleware(mockRequest, mockResponse, nextFunction)
		}

		// 6th request should be blocked
		await rateLimitMiddleware(mockRequest, mockResponse, nextFunction)

		expect(mockResponse.status).toHaveBeenCalledWith(429)
		expect(mockResponse.json).toHaveBeenCalledWith({
			error: 'Rate limit exceeded',
			retryAfter: 60,
		})
	})

	it('should track requests per client IP', async () => {
		const client1Request = { ...mockRequest, ip: '192.168.1.1' }
		const client2Request = { ...mockRequest, ip: '192.168.1.2' }

		// Client 1 makes 5 requests
		for (let i = 0; i < 5; i++) {
			await rateLimitMiddleware(client1Request, mockResponse, nextFunction)
		}

		// Client 2 should still be able to make requests
		await rateLimitMiddleware(client2Request, mockResponse, nextFunction)

		expect(nextFunction).toHaveBeenCalledTimes(6) // 5 + 1
	})
})
```

## Database Testing Patterns

### Pattern 1: Transaction Rollback Testing

**Use Case**: Testing database operations with automatic cleanup

```typescript
// src/features/order/__tests__/order.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
	setupDatabaseIntegration,
	cleanupGlobalResources,
	TransactionTester,
	MockDataFactory,
} from '../../../utils/test-helpers'
import { OrderService } from '../order.service'

describe('Order Service Database Integration', () => {
	let dbContext: DatabaseTestContext
	let transactionTester: TransactionTester
	let orderService: OrderService

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()
		transactionTester = new TransactionTester(dbContext.db, dbContext.pool)
		orderService = new OrderService(dbContext.db)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	it('should create order with items in transaction', async () => {
		await transactionTester.withTransaction(async () => {
			const user = MockDataFactory.createUser()
			const products = MockDataFactory.createArray(
				() => MockDataFactory.createProduct(),
				3,
			)

			// Create test data
			await dbContext.db.insert(usersTable).values(user)
			await dbContext.db.insert(productsTable).values(products)

			// Create order
			const orderData = {
				userId: user.id,
				items: products.map((p) => ({ productId: p.id, quantity: 2 })),
			}

			const order = await orderService.createOrder(orderData)

			// Verify order was created
			expect(order.id).toBeDefined()
			expect(order.userId).toBe(user.id)

			// Verify order items were created
			const orderItems = await dbContext.db
				.select()
				.from(orderItemsTable)
				.where(eq(orderItemsTable.orderId, order.id))

			expect(orderItems).toHaveLength(3)
			orderItems.forEach((item) => {
				expect(item.quantity).toBe(2)
			})

			// Transaction will be automatically rolled back
		})

		// Verify no data persisted after rollback
		const orders = await dbContext.db.select().from(ordersTable)
		const orderItems = await dbContext.db.select().from(orderItemsTable)

		expect(orders).toHaveLength(0)
		expect(orderItems).toHaveLength(0)
	})
})
```

### Pattern 2: Concurrent Database Operations

**Use Case**: Testing race conditions and concurrent access

```typescript
describe('Concurrent Database Operations', () => {
	it('should handle concurrent user creation', async () => {
		const userData = Array.from({ length: 10 }, () =>
			MockDataFactory.createUser(),
		)

		// Create users concurrently
		const createPromises = userData.map((data) => userService.createUser(data))

		const results = await Promise.allSettled(createPromises)

		// All should succeed (unique emails)
		expect(results.every((r) => r.status === 'fulfilled')).toBe(true)

		// Verify all users were created
		const users = await dbContext.db.select().from(usersTable)
		expect(users).toHaveLength(10)
	})

	it('should handle concurrent updates to same record', async () => {
		const user = MockDataFactory.createUser()
		await dbContext.db.insert(usersTable).values(user)

		// Concurrent updates
		const updatePromises = [
			userService.updateUser(user.id, { firstName: 'John' }),
			userService.updateUser(user.id, { lastName: 'Doe' }),
			userService.updateUser(user.id, { email: 'new@example.com' }),
		]

		const results = await Promise.allSettled(updatePromises)

		// At least some should succeed
		const successes = results.filter((r) => r.status === 'fulfilled')
		expect(successes.length).toBeGreaterThan(0)

		// Verify final state is consistent
		const [updatedUser] = await dbContext.db
			.select()
			.from(usersTable)
			.where(eq(usersTable.id, user.id))

		expect(updatedUser).toBeDefined()
	})
})
```

## Mocking Patterns

### Pattern 1: Service Dependency Mocking

**Use Case**: Testing services with external dependencies

```typescript
// src/services/payment.service.ts
export class PaymentService {
	constructor(
		private stripeService: StripeService,
		private emailService: EmailService,
		private auditService: AuditService,
	) {}

	async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
		try {
			// Process payment with Stripe
			const stripeResult = await this.stripeService.createCharge({
				amount: paymentData.amount,
				currency: 'usd',
				source: paymentData.token,
				description: paymentData.description,
			})

			// Send confirmation email
			await this.emailService.sendPaymentConfirmation({
				to: paymentData.customerEmail,
				amount: paymentData.amount,
				transactionId: stripeResult.id,
			})

			// Log audit event
			await this.auditService.logPayment({
				amount: paymentData.amount,
				customerId: paymentData.customerId,
				transactionId: stripeResult.id,
			})

			return {
				success: true,
				transactionId: stripeResult.id,
				amount: paymentData.amount,
			}
		} catch (error) {
			await this.auditService.logPaymentFailure({
				error: error.message,
				customerId: paymentData.customerId,
			})

			throw new PaymentError('Payment processing failed')
		}
	}
}

// src/services/__tests__/payment.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PaymentService } from '../payment.service'
import { MockDataFactory } from '../../utils/test-helpers'

describe('PaymentService', () => {
	let paymentService: PaymentService
	let mockStripeService: any
	let mockEmailService: any
	let mockAuditService: any

	beforeEach(() => {
		// Create comprehensive mocks
		mockStripeService = {
			createCharge: vi.fn().mockResolvedValue({
				id: 'ch_test_123',
				amount: 1000,
				status: 'succeeded',
			}),
		}

		mockEmailService = {
			sendPaymentConfirmation: vi.fn().mockResolvedValue({ success: true }),
		}

		mockAuditService = {
			logPayment: vi.fn().mockResolvedValue({ success: true }),
			logPaymentFailure: vi.fn().mockResolvedValue({ success: true }),
		}

		paymentService = new PaymentService(
			mockStripeService,
			mockEmailService,
			mockAuditService,
		)
	})

	it('should process payment successfully', async () => {
		const paymentData = {
			amount: 1000,
			token: 'tok_test_123',
			customerEmail: 'customer@example.com',
			customerId: 'cust_123',
			description: 'Test payment',
		}

		const result = await paymentService.processPayment(paymentData)

		// Verify payment result
		expect(result.success).toBe(true)
		expect(result.transactionId).toBe('ch_test_123')
		expect(result.amount).toBe(1000)

		// Verify Stripe was called correctly
		expect(mockStripeService.createCharge).toHaveBeenCalledWith({
			amount: 1000,
			currency: 'usd',
			source: 'tok_test_123',
			description: 'Test payment',
		})

		// Verify email was sent
		expect(mockEmailService.sendPaymentConfirmation).toHaveBeenCalledWith({
			to: 'customer@example.com',
			amount: 1000,
			transactionId: 'ch_test_123',
		})

		// Verify audit log
		expect(mockAuditService.logPayment).toHaveBeenCalledWith({
			amount: 1000,
			customerId: 'cust_123',
			transactionId: 'ch_test_123',
		})
	})

	it('should handle Stripe service failure', async () => {
		mockStripeService.createCharge.mockRejectedValue(new Error('Card declined'))

		const paymentData = MockDataFactory.createPaymentData()

		await expect(paymentService.processPayment(paymentData)).rejects.toThrow(
			'Payment processing failed',
		)

		// Verify failure was logged
		expect(mockAuditService.logPaymentFailure).toHaveBeenCalledWith({
			error: 'Card declined',
			customerId: paymentData.customerId,
		})

		// Verify no confirmation email was sent
		expect(mockEmailService.sendPaymentConfirmation).not.toHaveBeenCalled()
	})
})
```

## Error Testing Patterns

### Pattern 1: Comprehensive Error Scenario Testing

**Use Case**: Testing all possible error paths

```typescript
describe('Error Handling Patterns', () => {
	describe('Network Error Handling', () => {
		it('should retry on transient network errors', async () => {
			const mockFetch = vi
				.fn()
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockRejectedValueOnce(new Error('Connection refused'))
				.mockResolvedValueOnce({ ok: true, json: () => ({ data: 'success' }) })

			global.fetch = mockFetch

			const result = await resilientApiCall('/api/data')

			expect(mockFetch).toHaveBeenCalledTimes(3)
			expect(result.data).toBe('success')
		})

		it('should fail after max retries', async () => {
			const mockFetch = vi
				.fn()
				.mockRejectedValue(new Error('Persistent network error'))

			global.fetch = mockFetch

			await expect(
				resilientApiCall('/api/data', { maxRetries: 2 }),
			).rejects.toThrow('Max retries exceeded')

			expect(mockFetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
		})
	})

	describe('Validation Error Handling', () => {
		it('should collect and return all validation errors', async () => {
			const invalidData = {
				email: 'invalid-email',
				password: 'weak',
				age: -5,
			}

			await expect(validateUserData(invalidData)).rejects.toThrow(
				ValidationError,
			)

			try {
				await validateUserData(invalidData)
			} catch (error) {
				expect(error.errors).toEqual([
					'Invalid email format',
					'Password too weak',
					'Age must be positive',
				])
			}
		})
	})
})
```

## Performance Testing Patterns

### Pattern 1: Database Query Performance

**Use Case**: Ensuring database queries meet performance requirements

```typescript
describe('Database Performance Testing', () => {
	let performanceTester: PerformanceTester

	beforeEach(() => {
		performanceTester = new PerformanceTester()
	})

	it('should query users efficiently', async () => {
		// Create test data
		const users = MockDataFactory.createArray(
			() => MockDataFactory.createUser(),
			1000,
		)
		await dbContext.db.insert(usersTable).values(users)

		// Test query performance
		const results = await performanceTester.runPerformanceTest(
			'userQuery',
			async () => {
				return await dbContext.db
					.select()
					.from(usersTable)
					.where(eq(usersTable.email, users[0].email))
					.limit(1)
			},
			{
				iterations: 100,
				warmup: 10,
			},
		)

		// Performance assertions
		expect(results.summary.avgDuration).toBeLessThan(10) // 10ms max
		expect(results.summary.throughput).toBeGreaterThan(100) // 100 ops/sec min
	})

	it('should handle pagination efficiently', async () => {
		// Test different page sizes
		const pageSizes = [10, 50, 100]

		for (const pageSize of pageSizes) {
			const results = await performanceTester.runPerformanceTest(
				`pagination_${pageSize}`,
				async () => {
					return await dbContext.db
						.select()
						.from(usersTable)
						.limit(pageSize)
						.offset(0)
				},
				{ iterations: 50 },
			)

			// Performance should scale reasonably
			expect(results.summary.avgDuration).toBeLessThan(pageSize * 0.1) // 0.1ms per record max
		}
	})
})
```

## Security Testing Patterns

### Pattern 1: Authentication and Authorization

**Use Case**: Testing security controls

```typescript
describe('Security Testing Patterns', () => {
	describe('Authentication Security', () => {
		it('should reject requests without authentication', async () => {
			await request(app).get('/api/protected-resource').expect(401)
		})

		it('should reject expired tokens', async () => {
			const expiredToken = generateExpiredToken()

			await request(app)
				.get('/api/protected-resource')
				.set('Authorization', `Bearer ${expiredToken}`)
				.expect(401)
		})

		it('should reject malformed tokens', async () => {
			await request(app)
				.get('/api/protected-resource')
				.set('Authorization', 'Bearer invalid-token-format')
				.expect(401)
		})
	})

	describe('Input Sanitization', () => {
		it('should prevent XSS attacks', async () => {
			const maliciousInput = '<script>alert("xss")</script>'

			const response = await request(app)
				.post('/api/users')
				.send({ firstName: maliciousInput })
				.expect(400)

			expect(response.body.error).toContain('Invalid input')
		})

		it('should prevent SQL injection', async () => {
			const maliciousInput = "'; DROP TABLE users; --"

			await request(app)
				.get('/api/users/search')
				.query({ name: maliciousInput })
				.expect(400)
		})
	})

	describe('Authorization Controls', () => {
		it('should enforce user ownership', async () => {
			const user1 = MockDataFactory.createUser()
			const user2 = MockDataFactory.createUser()
			const user1Token = generateAuthToken(user1)

			const resource = MockDataFactory.createResource({ ownerId: user2.id })
			await dbContext.db.insert(resourcesTable).values(resource)

			// User 1 should not access User 2's resource
			await request(app)
				.get(`/api/resources/${resource.id}`)
				.set('Authorization', `Bearer ${user1Token}`)
				.expect(403)
		})
	})
})
```

## Advanced Testing Patterns

### Pattern 1: Contract Testing with Pact

**Use Case**: Testing API contracts between services

```typescript
describe('Contract Testing Patterns', () => {
	let contractTester: ContractTester

	beforeEach(() => {
		contractTester = new ContractTester()
	})

	it('should validate user API contract', async () => {
		// Define contract
		const userApiContract = new ContractBuilder()
			.get('/api/users/{id}', 'Get user by ID')
			.given('User exists')
			.willRespondWith(200)
			.withResponseBody({
				id: 'user-123',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			})
			.done()
			.build({
				name: 'user-api',
				version: '1.0.0',
				consumer: 'client-ui',
				provider: 'express-api',
			})

		contractTester.registerContract('user-api', userApiContract)

		// Test consumer
		const consumerResult = await contractTester.testConsumer(
			'user-api',
			async (mockServerUrl) => {
				const response = await fetch(`${mockServerUrl}/api/users/user-123`)
				expect(response.status).toBe(200)

				const userData = await response.json()
				expect(userData.email).toBe('test@example.com')
			},
		)

		expect(consumerResult).toBe(true)
	})
})
```

### Pattern 2: Property-Based Testing

**Use Case**: Testing with generated inputs to find edge cases

```typescript
import fc from 'fast-check'

describe('Property-Based Testing Patterns', () => {
	it('should validate email format for any string input', () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				const result = validateEmail(input)

				// Property: result should be boolean
				expect(typeof result).toBe('boolean')

				// Property: valid emails should contain @ and .
				if (result === true) {
					expect(input).toContain('@')
					expect(input).toContain('.')
				}
			}),
		)
	})

	it('should maintain order total calculation properties', () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.record({
						price: fc.float({ min: 0, max: 1000 }),
						quantity: fc.integer({ min: 1, max: 100 }),
					}),
				),
				(items) => {
					const total = calculateOrderTotal(items)

					// Property: total should never be negative
					expect(total).toBeGreaterThanOrEqual(0)

					// Property: total should equal sum of item totals
					const expectedTotal = items.reduce(
						(sum, item) => sum + item.price * item.quantity,
						0,
					)
					expect(total).toBeCloseTo(expectedTotal, 2)
				},
			),
		)
	})
})
```

## Testing Patterns Summary

### Quick Pattern Reference

| Pattern                       | Use Case                            | Key Benefits                                  |
| ----------------------------- | ----------------------------------- | --------------------------------------------- |
| **Pure Function Testing**     | Functions without side effects      | Fast, deterministic, easy to debug            |
| **Service Integration**       | Services with multiple dependencies | Realistic testing, catches integration issues |
| **Transaction Rollback**      | Database operations                 | Fast cleanup, test isolation                  |
| **API Endpoint Testing**      | HTTP request/response cycles        | End-to-end validation, realistic scenarios    |
| **Mock Service Dependencies** | External service interactions       | Fast execution, controlled scenarios          |
| **Error Simulation**          | Error handling and recovery         | Comprehensive error coverage                  |
| **Performance Testing**       | Critical path operations            | Performance regression detection              |
| **Contract Testing**          | API compatibility                   | Breaking change prevention                    |
| **Security Testing**          | Authentication and authorization    | Security vulnerability detection              |

### Pattern Selection Guide

**Choose Unit Testing when**:

- Testing pure functions
- Testing individual class methods
- Testing business logic in isolation
- Fast feedback is needed

**Choose Integration Testing when**:

- Testing service interactions
- Testing database operations
- Testing API endpoints
- Testing complete workflows

**Choose Contract Testing when**:

- Testing API consumers and providers
- Preventing breaking changes
- Testing external service integrations
- Validating API specifications

**Choose Performance Testing when**:

- Testing critical performance paths
- Establishing performance baselines
- Detecting performance regressions
- Validating scalability requirements

## Best Practices Summary

### Universal Best Practices

1. **Start Simple**: Begin with basic happy path tests
2. **Add Complexity Gradually**: Add edge cases and error scenarios
3. **Keep Tests Focused**: One behavior per test
4. **Use Descriptive Names**: Test names should read like specifications
5. **Maintain Test Quality**: Tests are code too - keep them clean and maintainable

### Pattern-Specific Best Practices

**Unit Testing**:

- Use pure functions when possible
- Mock all external dependencies
- Test edge cases and error conditions
- Keep tests fast (< 1ms per test)

**Integration Testing**:

- Use real databases with transactions
- Mock external services only
- Test complete user workflows
- Verify data persistence

**Performance Testing**:

- Establish baseline metrics
- Test with realistic data volumes
- Monitor for regressions
- Consider concurrent load testing

**Security Testing**:

- Test all authentication paths
- Validate input sanitization
- Test authorization boundaries
- Verify error message safety

Remember: The best pattern is the one that provides the most value for your specific testing scenario. Don't be afraid
to combine patterns or adapt them to your needs.
