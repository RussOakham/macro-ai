# Testing Training Materials

## Table of Contents

1. [Getting Started with Testing](#getting-started-with-testing)
2. [Basic Testing Concepts](#basic-testing-concepts)
3. [Hands-On Exercises](#hands-on-exercises)
4. [Advanced Testing Techniques](#advanced-testing-techniques)
5. [Real-World Examples](#real-world-examples)
6. [Common Mistakes and Solutions](#common-mistakes-and-solutions)
7. [Testing Workflows](#testing-workflows)
8. [Resources and References](#resources-and-references)

## Getting Started with Testing

### Prerequisites

- Basic TypeScript/JavaScript knowledge
- Understanding of async/await
- Familiarity with the macro-ai codebase structure

### Setting Up Your Environment

```bash
# Clone the repository
git clone <repository-url>
cd macro-ai

# Install dependencies
pnpm install

# Run existing tests to verify setup
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Your First Test

Let's write a simple test for a utility function:

```typescript
// src/utils/string-helpers.ts
export const capitalize = (str: string): string => {
	if (!str) return str
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// src/utils/__tests__/string-helpers.test.ts
import { describe, it, expect } from 'vitest'
import { capitalize } from '../string-helpers'

describe('capitalize', () => {
	it('should capitalize first letter and lowercase rest', () => {
		expect(capitalize('hello')).toBe('Hello')
		expect(capitalize('WORLD')).toBe('World')
	})

	it('should handle empty string', () => {
		expect(capitalize('')).toBe('')
	})

	it('should handle single character', () => {
		expect(capitalize('a')).toBe('A')
	})
})
```

## Basic Testing Concepts

### 1. The Testing Pyramid

```text
    /\
   /  \     E2E Tests (Few, High-Value)
  /____\
 /      \   Integration Tests (Some, Critical Paths)
/__________\ Unit Tests (Many, Fast, Focused)
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate order total correctly', () => {
	// Arrange: Set up test data
	const order = {
		items: [
			{ price: 10, quantity: 2 },
			{ price: 15, quantity: 1 },
		],
		taxRate: 0.08,
	}

	// Act: Execute the function being tested
	const result = calculateOrderTotal(order)

	// Assert: Verify the expected outcome
	expect(result.subtotal).toBe(35)
	expect(result.tax).toBe(2.8)
	expect(result.total).toBe(37.8)
})
```

### 3. Test Doubles (Mocks, Stubs, Spies)

```typescript
// Mock: Replace entire implementation
const mockUserService = vi.fn().mockImplementation(() => ({
	getUser: vi.fn().mockResolvedValue(mockUser),
}))

// Stub: Provide predetermined responses
const getUserStub = vi.fn().mockResolvedValue(mockUser)

// Spy: Watch calls to real implementation
const getUserSpy = vi.spyOn(userService, 'getUser')
```

## Hands-On Exercises

### Exercise 1: Writing Your First Unit Test

**Task**: Write tests for a simple validation function

```typescript
// src/utils/validation.ts
export const validateEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

export const validatePassword = (
	password: string,
): {
	isValid: boolean
	errors: string[]
} => {
	const errors: string[] = []

	if (password.length < 8) {
		errors.push('Password must be at least 8 characters')
	}

	if (!/[A-Z]/.test(password)) {
		errors.push('Password must contain uppercase letter')
	}

	if (!/[0-9]/.test(password)) {
		errors.push('Password must contain number')
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}
```

**Your Task**: Write comprehensive tests for these functions

<details>
<summary>Solution</summary>

```typescript
// src/utils/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail, validatePassword } from '../validation'

describe('validateEmail', () => {
	it('should validate correct email formats', () => {
		expect(validateEmail('user@example.com')).toBe(true)
		expect(validateEmail('test.email@domain.co.uk')).toBe(true)
		expect(validateEmail('user+tag@example.com')).toBe(true)
	})

	it('should reject invalid email formats', () => {
		expect(validateEmail('invalid-email')).toBe(false)
		expect(validateEmail('@example.com')).toBe(false)
		expect(validateEmail('user@')).toBe(false)
		expect(validateEmail('')).toBe(false)
	})
})

describe('validatePassword', () => {
	it('should validate strong passwords', () => {
		const result = validatePassword('StrongPass123')
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it('should reject short passwords', () => {
		const result = validatePassword('Short1')
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain('Password must be at least 8 characters')
	})

	it('should reject passwords without uppercase', () => {
		const result = validatePassword('lowercase123')
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain('Password must contain uppercase letter')
	})

	it('should reject passwords without numbers', () => {
		const result = validatePassword('NoNumbers')
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain('Password must contain number')
	})

	it('should return multiple errors', () => {
		const result = validatePassword('weak')
		expect(result.isValid).toBe(false)
		expect(result.errors).toHaveLength(3)
	})
})
```

</details>

### Exercise 2: API Integration Testing

**Task**: Write integration tests for a user registration endpoint

```typescript
// src/features/auth/auth.controller.ts
export const registerUser = async (req: Request, res: Response) => {
	try {
		const { email, password, firstName, lastName } = req.body

		// Validate input
		if (!validateEmail(email)) {
			return res.status(400).json({ error: 'Invalid email format' })
		}

		const passwordValidation = validatePassword(password)
		if (!passwordValidation.isValid) {
			return res.status(400).json({ error: passwordValidation.errors })
		}

		// Check if user exists
		const existingUser = await getUserByEmail(email)
		if (existingUser) {
			return res.status(409).json({ error: 'User already exists' })
		}

		// Create user
		const user = await createUser({
			email,
			password: await hashPassword(password),
			firstName,
			lastName,
		})

		res.status(201).json({ data: user })
	} catch (error) {
		res.status(500).json({ error: 'Internal server error' })
	}
}
```

**Your Task**: Write comprehensive integration tests

<details>
<summary>Solution</summary>

```typescript
// src/features/auth/__tests__/auth.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import {
	setupDatabaseIntegration,
	cleanupGlobalResources,
	MockDataFactory,
} from '../../utils/test-helpers'
import { createServer } from '../../utils/server'

describe('Auth Integration Tests', () => {
	let app
	let dbContext

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()
		app = createServer(dbContext.db)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	describe('POST /api/auth/register', () => {
		it('should register new user successfully', async () => {
			const userData = {
				email: 'test@example.com',
				password: 'StrongPass123',
				firstName: 'John',
				lastName: 'Doe',
			}

			const response = await request(app)
				.post('/api/auth/register')
				.send(userData)
				.expect(201)

			expect(response.body.data.email).toBe(userData.email)
			expect(response.body.data.firstName).toBe(userData.firstName)
			expect(response.body.data.id).toBeDefined()
		})

		it('should reject invalid email', async () => {
			const userData = {
				email: 'invalid-email',
				password: 'StrongPass123',
				firstName: 'John',
				lastName: 'Doe',
			}

			await request(app).post('/api/auth/register').send(userData).expect(400)
		})

		it('should reject weak password', async () => {
			const userData = {
				email: 'test@example.com',
				password: 'weak',
				firstName: 'John',
				lastName: 'Doe',
			}

			const response = await request(app)
				.post('/api/auth/register')
				.send(userData)
				.expect(400)

			expect(response.body.error).toBeInstanceOf(Array)
			expect(response.body.error.length).toBeGreaterThan(0)
		})

		it('should reject duplicate email', async () => {
			const userData = MockDataFactory.createUser()

			// Create first user
			await request(app).post('/api/auth/register').send(userData).expect(201)

			// Try to create duplicate
			await request(app).post('/api/auth/register').send(userData).expect(409)
		})
	})
})
```

</details>

### Exercise 3: Advanced Mocking

**Task**: Test a service that depends on external APIs and time

```typescript
// src/services/notification.service.ts
export class NotificationService {
	constructor(
		private emailService: EmailService,
		private smsService: SmsService,
	) {}

	async sendWelcomeNotification(user: User): Promise<void> {
		// Send immediate welcome email
		await this.emailService.sendEmail({
			to: user.email,
			subject: 'Welcome!',
			template: 'welcome',
			data: { firstName: user.firstName },
		})

		// Schedule follow-up email for 24 hours later
		setTimeout(
			async () => {
				await this.emailService.sendEmail({
					to: user.email,
					subject: 'Getting Started Tips',
					template: 'tips',
				})
			},
			24 * 60 * 60 * 1000,
		)

		// Send SMS if phone number provided
		if (user.phoneNumber) {
			await this.smsService.sendSMS({
				to: user.phoneNumber,
				message: `Welcome ${user.firstName}! Your account is ready.`,
			})
		}
	}
}
```

**Your Task**: Write tests using advanced mocking techniques

<details>
<summary>Solution</summary>

```typescript
// src/services/__tests__/notification.service.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TimeController, MockDataFactory } from '../../utils/test-helpers'
import { NotificationService } from '../notification.service'

// Mock external services
const mockEmailService = {
	sendEmail: vi.fn().mockResolvedValue({ success: true }),
}

const mockSmsService = {
	sendSMS: vi.fn().mockResolvedValue({ success: true }),
}

describe('NotificationService', () => {
	let notificationService: NotificationService
	let timeController: TimeController

	beforeEach(() => {
		timeController = new TimeController()
		notificationService = new NotificationService(
			mockEmailService,
			mockSmsService,
		)
		vi.clearAllMocks()
	})

	afterEach(() => {
		timeController.stop()
	})

	it('should send immediate welcome email', async () => {
		const user = MockDataFactory.createUser({
			email: 'test@example.com',
			firstName: 'John',
		})

		await notificationService.sendWelcomeNotification(user)

		expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
			to: user.email,
			subject: 'Welcome!',
			template: 'welcome',
			data: { firstName: user.firstName },
		})
	})

	it('should schedule follow-up email', async () => {
		timeController.start()

		const user = MockDataFactory.createUser()
		await notificationService.sendWelcomeNotification(user)

		// Verify immediate email was sent
		expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)

		// Fast-forward 24 hours
		timeController.advance(24 * 60 * 60 * 1000)
		await timeController.waitForTimers()

		// Verify follow-up email was sent
		expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2)
		expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
			to: user.email,
			subject: 'Getting Started Tips',
			template: 'tips',
		})
	})

	it('should send SMS if phone number provided', async () => {
		const user = MockDataFactory.createUser({
			phoneNumber: '+1234567890',
			firstName: 'John',
		})

		await notificationService.sendWelcomeNotification(user)

		expect(mockSmsService.sendSMS).toHaveBeenCalledWith({
			to: user.phoneNumber,
			message: 'Welcome John! Your account is ready.',
		})
	})

	it('should not send SMS if no phone number', async () => {
		const user = MockDataFactory.createUser({
			phoneNumber: undefined,
		})

		await notificationService.sendWelcomeNotification(user)

		expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
	})

	it('should handle email service failures gracefully', async () => {
		mockEmailService.sendEmail.mockRejectedValue(
			new Error('Email service down'),
		)

		const user = MockDataFactory.createUser()

		await expect(
			notificationService.sendWelcomeNotification(user),
		).rejects.toThrow('Email service down')
	})
})
```

</details>

## Advanced Testing Techniques

### 1. Database Transaction Testing

**Learning Objective**: Understand how to test database operations safely

```typescript
describe('Database Transaction Testing Workshop', () => {
	let dbContext: DatabaseTestContext
	let transactionTester: TransactionTester

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()
		transactionTester = new TransactionTester(dbContext.db, dbContext.pool)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	it('should test transaction rollback on error', async () => {
		await transactionTester.withTransaction(async () => {
			// Create user within transaction
			const user = MockDataFactory.createUser()
			await dbContext.db.insert(usersTable).values(user)

			// Verify user exists within transaction
			const [createdUser] = await dbContext.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, user.id))

			expect(createdUser).toBeDefined()

			// Simulate error to trigger rollback
			throw new Error('Simulated transaction error')
		})

		// Verify user was not persisted after rollback
		const users = await dbContext.db.select().from(usersTable)
		expect(users).toHaveLength(0)
	})
})
```

### 2. Performance Testing Workshop

**Learning Objective**: Learn to identify and test performance bottlenecks

```typescript
describe('Performance Testing Workshop', () => {
	let performanceTester: PerformanceTester

	beforeEach(() => {
		performanceTester = new PerformanceTester()
	})

	afterEach(() => {
		performanceTester.clearResults()
	})

	it('should measure and compare algorithm performance', async () => {
		// Algorithm 1: Simple iteration
		const algorithm1 = async () => {
			const data = Array.from({ length: 1000 }, (_, i) => i)
			return data.reduce((sum, n) => sum + n, 0)
		}

		// Algorithm 2: Mathematical formula
		const algorithm2 = async () => {
			const n = 999 // 0 to 999
			return (n * (n + 1)) / 2
		}

		const results1 = await performanceTester.runPerformanceTest(
			'algorithm1',
			algorithm1,
			{ iterations: 100 },
		)

		const results2 = await performanceTester.runPerformanceTest(
			'algorithm2',
			algorithm2,
			{ iterations: 100 },
		)

		console.log(`Algorithm 1: ${results1.summary.avgDuration}ms`)
		console.log(`Algorithm 2: ${results2.summary.avgDuration}ms`)

		// Algorithm 2 should be significantly faster
		expect(results2.summary.avgDuration).toBeLessThan(
			results1.summary.avgDuration,
		)
	})
})
```

### 3. Error Simulation Workshop

**Learning Objective**: Learn to test error handling and recovery

```typescript
describe('Error Simulation Workshop', () => {
	let errorSimulator: ErrorSimulator

	beforeEach(() => {
		errorSimulator = new ErrorSimulator({
			probability: 0.5, // 50% error rate for testing
			errorTypes: ['network', 'database'],
		})
	})

	afterEach(() => {
		errorSimulator.stop()
	})

	it('should test retry logic with error simulation', async () => {
		errorSimulator.start()

		const resilientService = {
			operation: async () => {
				if (errorSimulator.shouldSimulateError()) {
					errorSimulator.simulateError('network', 'Temporary network issue')
				}
				return { success: true }
			},
		}

		// Test retry logic
		let result
		const maxRetries = 5

		for (let i = 0; i < maxRetries; i++) {
			try {
				result = await resilientService.operation()
				break
			} catch (error) {
				if (i === maxRetries - 1) throw error
				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
		}

		expect(result?.success).toBe(true)
	})
})
```

## Real-World Examples

### Example 1: Chat Message Service Testing

```typescript
describe('Chat Message Service - Real World Example', () => {
	let dbContext: DatabaseTestContext
	let messageService: MessageService
	let mockAIService: any

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()

		// Mock AI service
		mockAIService = {
			generateResponse: vi.fn().mockResolvedValue({
				content: 'AI response',
				tokens: 150,
			}),
		}

		messageService = new MessageService(dbContext.db, mockAIService)
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	it('should handle complete message flow', async () => {
		// 1. Create test user and chat
		const user = MockDataFactory.createUser()
		const chat = MockDataFactory.createChat({ userId: user.id })

		await dbContext.db.insert(usersTable).values(user)
		await dbContext.db.insert(chatsTable).values(chat)

		// 2. Send user message
		const userMessage = await messageService.createMessage({
			chatId: chat.id,
			content: 'Hello, AI!',
			role: 'user',
		})

		expect(userMessage.content).toBe('Hello, AI!')
		expect(userMessage.role).toBe('user')

		// 3. Generate AI response
		const aiResponse = await messageService.generateAIResponse(chat.id)

		expect(mockAIService.generateResponse).toHaveBeenCalledWith({
			chatId: chat.id,
			messages: expect.arrayContaining([
				expect.objectContaining({
					content: 'Hello, AI!',
					role: 'user',
				}),
			]),
		})

		expect(aiResponse.content).toBe('AI response')
		expect(aiResponse.role).toBe('assistant')

		// 4. Verify messages are persisted
		const messages = await messageService.getChatMessages(chat.id)
		expect(messages).toHaveLength(2)
		expect(messages[0].role).toBe('user')
		expect(messages[1].role).toBe('assistant')
	})

	it('should handle AI service failures', async () => {
		mockAIService.generateResponse.mockRejectedValue(
			new Error('AI service unavailable'),
		)

		const chat = MockDataFactory.createChat()
		await dbContext.db.insert(chatsTable).values(chat)

		await expect(messageService.generateAIResponse(chat.id)).rejects.toThrow(
			'Failed to generate AI response',
		)
	})
})
```

### Example 2: Authentication Middleware Testing

```typescript
describe('Authentication Middleware - Real World Example', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let nextFunction: NextFunction

	beforeEach(() => {
		mockRequest = {
			headers: {},
			user: undefined,
		}

		mockResponse = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		}

		nextFunction = vi.fn()
	})

	it('should authenticate valid JWT token', async () => {
		const user = MockDataFactory.createUser()
		const validToken = generateJWTToken(user)

		mockRequest.headers = {
			authorization: `Bearer ${validToken}`,
		}

		await authMiddleware(
			mockRequest as Request,
			mockResponse as Response,
			nextFunction,
		)

		expect(mockRequest.user).toEqual(user)
		expect(nextFunction).toHaveBeenCalledOnce()
		expect(mockResponse.status).not.toHaveBeenCalled()
	})

	it('should reject expired token', async () => {
		const expiredToken = generateExpiredToken()

		mockRequest.headers = {
			authorization: `Bearer ${expiredToken}`,
		}

		await authMiddleware(
			mockRequest as Request,
			mockResponse as Response,
			nextFunction,
		)

		expect(mockResponse.status).toHaveBeenCalledWith(401)
		expect(mockResponse.json).toHaveBeenCalledWith({
			error: 'Token expired',
		})
		expect(nextFunction).not.toHaveBeenCalled()
	})
})
```

## Common Mistakes and Solutions

### Mistake 1: Testing Implementation Details

```typescript
// ❌ Bad: Testing implementation details
it('should call database.query with correct SQL', () => {
	const spy = vi.spyOn(database, 'query')
	userService.getUser('123')
	expect(spy).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', ['123'])
})

// ✅ Good: Testing behavior
it('should return user data for valid ID', async () => {
	const user = await userService.getUser('123')
	expect(user.id).toBe('123')
	expect(user.email).toBeDefined()
})
```

### Mistake 2: Brittle Test Data

```typescript
// ❌ Bad: Hardcoded, brittle test data
const testUser = {
	id: 'user-123',
	email: 'test@test.com',
	createdAt: '2024-01-01T00:00:00Z',
}

// ✅ Good: Generated, flexible test data
const testUser = MockDataFactory.createUser({
	email: 'test@example.com',
})
```

### Mistake 3: Not Testing Error Cases

```typescript
// ❌ Bad: Only testing happy path
it('should create user', async () => {
	const user = await userService.createUser(validUserData)
	expect(user.id).toBeDefined()
})

// ✅ Good: Testing both success and error cases
describe('createUser', () => {
	it('should create user with valid data', async () => {
		const user = await userService.createUser(validUserData)
		expect(user.id).toBeDefined()
	})

	it('should reject invalid email', async () => {
		await expect(userService.createUser({ email: 'invalid' })).rejects.toThrow(
			'Invalid email',
		)
	})

	it('should handle database connection failure', async () => {
		mockDb.insert.mockRejectedValue(new Error('Connection failed'))

		await expect(userService.createUser(validUserData)).rejects.toThrow(
			'Failed to create user',
		)
	})
})
```

### Mistake 4: Shared Test State

```typescript
// ❌ Bad: Shared state between tests
let sharedUser: User

describe('User tests', () => {
	beforeAll(async () => {
		sharedUser = await createUser() // Shared between tests
	})

	it('should update user', async () => {
		await updateUser(sharedUser.id, { firstName: 'Updated' })
		// This affects other tests!
	})
})

// ✅ Good: Isolated test state
describe('User tests', () => {
	beforeEach(async () => {
		// Fresh state for each test
		await cleanDatabase()
		await seedTestData()
	})

	it('should update user', async () => {
		const user = MockDataFactory.createUser()
		await updateUser(user.id, { firstName: 'Updated' })
		// Isolated from other tests
	})
})
```

## Testing Workflows

### Development Workflow

1. **Write Failing Test**: Start with a test that fails
2. **Implement Code**: Write minimal code to make test pass
3. **Refactor**: Improve code while keeping tests green
4. **Add Edge Cases**: Test edge cases and error scenarios
5. **Review Coverage**: Ensure adequate test coverage

### Debugging Workflow

1. **Identify Issue**: Use test failures to identify problems
2. **Isolate Problem**: Create minimal test case
3. **Debug**: Use debugger or console logs
4. **Fix**: Implement fix
5. **Verify**: Ensure all tests pass

### Refactoring Workflow

1. **Ensure Tests Pass**: Start with green tests
2. **Refactor Code**: Make changes while tests remain green
3. **Update Tests**: Update tests if behavior changes
4. **Verify Coverage**: Maintain test coverage levels

## Interactive Learning Exercises

### Exercise Set A: Unit Testing Fundamentals

**Exercise A1**: Test a calculator function

```typescript
// Implement tests for this function
export const calculate = (
	a: number,
	b: number,
	operation: '+' | '-' | '*' | '/',
) => {
	switch (operation) {
		case '+':
			return a + b
		case '-':
			return a - b
		case '*':
			return a * b
		case '/':
			if (b === 0) throw new Error('Division by zero')
			return a / b
		default:
			throw new Error('Invalid operation')
	}
}

// Your task: Write comprehensive tests
```

**Exercise A2**: Test an async function with error handling

```typescript
// Implement tests for this function
export const fetchUserProfile = async (userId: string) => {
	if (!userId) throw new Error('User ID is required')

	try {
		const response = await fetch(`/api/users/${userId}`)
		if (!response.ok) {
			throw new Error(`Failed to fetch user: ${response.status}`)
		}
		return await response.json()
	} catch (error) {
		throw new Error('Network error occurred')
	}
}

// Your task: Write tests including error scenarios
```

### Exercise Set B: Integration Testing

**Exercise B1**: Test a complete API workflow

```typescript
// Test this complete user management workflow:
// 1. Register user
// 2. Login user
// 3. Update profile
// 4. Delete user

// Your task: Write integration tests for the complete workflow
```

**Exercise B2**: Test concurrent operations

```typescript
// Test concurrent user creation to ensure no race conditions
// Your task: Create tests that verify concurrent operations work correctly
```

### Exercise Set C: Advanced Mocking

**Exercise C1**: Test time-dependent business logic

```typescript
// Test a subscription service that handles renewals
export class SubscriptionService {
	async renewSubscription(userId: string) {
		const subscription = await this.getSubscription(userId)

		if (subscription.expiresAt < new Date()) {
			throw new Error('Subscription already expired')
		}

		const newExpiration = new Date(subscription.expiresAt)
		newExpiration.setMonth(newExpiration.getMonth() + 1)

		return await this.updateSubscription(userId, {
			expiresAt: newExpiration,
		})
	}
}

// Your task: Test this using TimeController
```

## Assessment and Certification

### Knowledge Check Questions

1. **When should you use unit tests vs integration tests?**
2. **How do you test async operations properly?**
3. **What are the benefits of using test factories?**
4. **How do you handle flaky tests?**
5. **When should you mock vs use real implementations?**

### Practical Assessment

Complete a comprehensive testing task:

1. **Choose a feature** from the codebase that needs better test coverage
2. **Write unit tests** for the core business logic
3. **Write integration tests** for the API endpoints
4. **Add performance tests** if applicable
5. **Document your testing approach**
6. **Present your work** to the team

## Resources and References

### Documentation

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Testcontainers](https://testcontainers.com/)

### Books and Articles

- "The Art of Unit Testing" by Roy Osherove
- "Working Effectively with Legacy Code" by Michael Feathers
- "Test Driven Development" by Kent Beck

### Internal Resources

- `CLAUDE.md` - Project-specific testing requirements
- `comprehensive-testing-guide.md` - Detailed testing guide
- `testing-guidelines-and-standards.md` - Testing standards
- Test example files in `test-helpers/__tests__/`

### Community Resources

- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Jest to Vitest Migration Guide](https://vitest.dev/guide/migration.html)

## Next Steps

After completing this training:

1. **Practice**: Apply these concepts to real code in the project
2. **Review**: Have your tests reviewed by experienced team members
3. **Contribute**: Help improve testing documentation and examples
4. **Teach**: Share your knowledge with other team members
5. **Iterate**: Continuously improve your testing skills

## Getting Help

### When You're Stuck

1. **Check Examples**: Look at existing test files for patterns
2. **Read Documentation**: Refer to testing guides and standards
3. **Ask Questions**: Reach out to team members for help
4. **Debug**: Use console.log and debugger to understand test failures
5. **Simplify**: Start with simple tests and build complexity gradually

### Common Support Channels

- Team chat for quick questions
- Code reviews for feedback
- Pair programming for complex testing scenarios
- Documentation updates for knowledge sharing

Remember: Good tests are an investment in code quality and developer productivity. Take time to write thoughtful,
comprehensive tests that will serve the project well over time.
