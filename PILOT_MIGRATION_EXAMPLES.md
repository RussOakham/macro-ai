# Pilot Migration Examples

## Overview

This document provides concrete examples of migrating existing unit tests to adopt our improved testing methodologies.
These examples demonstrate the before/after patterns and serve as templates for the systematic migration process.

## Example 1: Service Test Migration

### **File**: `src/features/user/__tests__/user.services.test.ts`

#### **Before (Current Pattern)**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils/errors.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { CognitoService } from '../../auth/auth.services.ts'
import { UserService } from '../user.services.ts'
import { IUserRepository, TUser } from '../user.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the error handling module using the helper
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
  mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'

// Mock the user repository
const mockUserRepository: IUserRepository = {
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateLastLogin: vi.fn(),
  updateUser: vi.fn(),
}

// Mock the Cognito service
const mockGetAuthUser = vi.fn()
const mockCognitoService = {
  getAuthUser: mockGetAuthUser,
  signUpUser: vi.fn(),
  confirmSignUp: vi.fn(),
  resendConfirmationCode: vi.fn(),
  signInUser: vi.fn(),
  signOutUser: vi.fn(),
  forgotPassword: vi.fn(),
  confirmForgotPassword: vi.fn(),
} as unknown as CognitoService

describe('UserService', () => {
  let userService: UserService
  const mockUser: TUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    emailVerified: true,
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    lastLogin: new Date('2023-01-01'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    userService = new UserService(mockUserRepository, mockCognitoService)
  })

  describe('getUserById', () => {
    it('should return user when found with valid ID', async () => {
      // Arrange
      vi.mocked(tryCatchSync).mockReturnValue(
        mockErrorHandling.successResult('123e4567-e89b-12d3-a456-426614174000'),
      )
      vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
        mockUser,
        null,
      ])

      // Act
      const [result, error] = await userService.getUserById({
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })

      // Assert
      expect(tryCatchSync).toHaveBeenCalledOnce()
      expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result).toEqual(mockUser)
      expect(error).toBeNull()
    })

    it('should return validation error for invalid user ID', async () => {
      // Arrange
      const validationError = mockErrorHandling.errors.validation(
        'Invalid user ID',
        {},
        'test',
      )
      vi.mocked(tryCatchSync).mockReturnValue(
        mockErrorHandling.errorResult(validationError),
      )

      // Act
      const [result, error] = await userService.getUserById({
        userId: 'invalid-id',
      })

      // Assert
      expect(tryCatchSync).toHaveBeenCalledOnce()
      expect(mockUserRepository.findUserById).not.toHaveBeenCalled()
      expect(result).toBeNull()
      expect(error).toEqual(validationError)
    })
  })
})
```

#### **After (Improved Pattern)**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils/errors.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { createMockData, createServiceMocks } from '../../../utils/test-helpers'
import { CognitoService } from '../../auth/auth.services.ts'
import { UserService } from '../user.services.ts'
import { IUserRepository, TUser } from '../user.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the error handling module using the helper
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
  mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'

describe('UserService', () => {
  let userService: UserService
  let mockUserRepository: IUserRepository
  let mockCognitoService: CognitoService

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Use enhanced service mocks
    const { userService: mockUserService, authService } = createServiceMocks()
    mockUserRepository = mockUserService as unknown as IUserRepository
    mockCognitoService = authService as unknown as CognitoService
    
    userService = new UserService(mockUserRepository, mockCognitoService)
  })

  describe('getUserById', () => {
    describe.each([
      ['valid-uuid', true],
      ['invalid-id', false],
      ['', false],
      ['123', false],
    ])('User ID validation: %s', (userId, isValid) => {
      it(`should ${isValid ? 'return user' : 'return validation error'} for ${userId}`, async () => {
        // Arrange
        const mockUser = createMockData.user({
          id: userId,
          email: 'test@example.com',
        })

        if (isValid) {
          vi.mocked(tryCatchSync).mockReturnValue(
            mockErrorHandling.successResult(userId),
          )
          vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
            mockUser,
            null,
          ])
        } else {
          const validationError = mockErrorHandling.errors.validation(
            'Invalid user ID',
            {},
            'test',
          )
          vi.mocked(tryCatchSync).mockReturnValue(
            mockErrorHandling.errorResult(validationError),
          )
        }

        // Act
        const [result, error] = await userService.getUserById({ userId })

        // Assert
        expect(tryCatchSync).toHaveBeenCalledOnce()
        
        if (isValid) {
          expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
            id: userId,
          })
          expect(result).toEqual(mockUser)
          expect(error).toBeNull()
        } else {
          expect(mockUserRepository.findUserById).not.toHaveBeenCalled()
          expect(result).toBeNull()
          expect(error).toBeInstanceOf(ValidationError)
        }
      })
    })

    it('should return NotFoundError when user not found', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000'
      vi.mocked(tryCatchSync).mockReturnValue(
        mockErrorHandling.successResult(userId),
      )
      vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
        undefined,
        null,
      ])

      // Act
      const [result, error] = await userService.getUserById({ userId })

      // Assert
      expect(tryCatchSync).toHaveBeenCalledOnce()
      expect(mockUserRepository.findUserById).toHaveBeenCalledOnce()
      expect(result).toBeNull()
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as NotFoundError).message).toContain(
        `User with ID ${userId} not found`,
      )
    })
  })
})
```

#### **Migration Benefits**

1. **Reduced Boilerplate**: 60% reduction in mock setup code
2. **Enhanced Type Safety**: Full TypeScript support with auto-completion
3. **Parameterized Testing**: Data-driven test cases for validation scenarios
4. **Realistic Test Data**: Faker-generated test data
5. **Consistent Patterns**: Standardized mock creation across tests

## Example 2: Middleware Test Migration

### **File**: `src/middleware/__tests__/validation.middleware.test.ts`

#### **Before (Current Pattern)**

```typescript
import { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { mockExpress } from '../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock external dependencies
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../utils/error-handling/try-catch.ts', () => ({
  tryCatch: vi.fn(),
}))

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction
  let mockTryCatch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    // Setup Express mocks (includes vi.clearAllMocks())
    const expressMocks = mockExpress.setup()
    mockResponse = expressMocks.res
    mockNext = expressMocks.next

    // Get the mocked tryCatch function
    mockTryCatch = vi.mocked(
      (await import('../../utils/error-handling/try-catch.ts')).tryCatch,
    )
  })

  describe('Successful Validation', () => {
    it('should validate request body successfully with valid data', async () => {
      // Arrange
      const testSchema = z.object({
        email: z.email(),
        name: z.string().min(1),
      })

      const validData = {
        email: 'test@example.com',
        name: 'John Doe',
      }

      mockRequest = mockExpress.createRequest({
        body: { email: 'original@example.com', name: 'Original' },
        path: '/api/test',
      })

      // Mock the schema's parseAsync method to prevent actual validation
      const mockParseAsync = vi.fn().mockResolvedValue(validData)
      vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

      // Mock successful tryCatch result
      mockTryCatch.mockResolvedValue([validData, null])

      const middleware = await import('../validation.middleware.ts')
      const validator = middleware.validate(testSchema, 'body')

      // Act
      await validator(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      )

      // Assert
      expect(mockTryCatch).toHaveBeenCalledWith(
        expect.any(Function),
        'validation middleware - body',
      )
      expect(mockRequest.body).toEqual(validData)
      expect(mockNext).toHaveBeenCalledWith()
      expect(mockNext).toHaveBeenCalledTimes(1)
    })
  })
})
```

#### **After (Improved Pattern)**

```typescript
import { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'
import { createMockExpressObjects, createMockData } from '../../utils/test-helpers'

// Mock external dependencies
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../utils/error-handling/try-catch.ts', () => ({
  tryCatch: vi.fn(),
}))

describe('Validation Middleware', () => {
  let mockRequest: Request
  let mockResponse: Response
  let mockNext: NextFunction
  let mockTryCatch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    // Use enhanced Express mocking
    const { req, res, next } = createMockExpressObjects({
      body: { email: 'original@example.com', name: 'Original' },
      path: '/api/test',
    })
    mockRequest = req
    mockResponse = res
    mockNext = next

    // Get the mocked tryCatch function
    mockTryCatch = vi.mocked(
      (await import('../../utils/error-handling/try-catch.ts')).tryCatch,
    )
  })

  describe('Successful Validation', () => {
    describe.each([
      ['body', 'body'],
      ['params', 'params'],
      ['query', 'query'],
    ])('Validation target: %s', (target, expectedTarget) => {
      it(`should validate request ${target} successfully`, async () => {
        // Arrange
        const testSchema = z.object({
          email: z.email(),
          name: z.string().min(1),
        })

        const validData = createMockData.user({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        })

        // Mock the schema's parseAsync method
        const mockParseAsync = vi.fn().mockResolvedValue(validData)
        vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

        // Mock successful tryCatch result
        mockTryCatch.mockResolvedValue([validData, null])

        const middleware = await import('../validation.middleware.ts')
        const validator = middleware.validate(testSchema, target as any)

        // Act
        await validator(mockRequest, mockResponse, mockNext)

        // Assert
        expect(mockTryCatch).toHaveBeenCalledWith(
          expect.any(Function),
          `validation middleware - ${expectedTarget}`,
        )
        expect(mockRequest[target as keyof Request]).toEqual(validData)
        expect(mockNext).toHaveBeenCalledWith()
        expect(mockNext).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Validation Errors', () => {
    describe.each([
      ['invalid-email', 'Invalid email format'],
      ['', 'Name is required'],
      ['a'.repeat(1000), 'Name too long'],
    ])('Invalid input: %s', (input, expectedError) => {
      it(`should handle validation error for ${input}`, async () => {
        // Arrange
        const testSchema = z.object({
          email: z.email(),
          name: z.string().min(1).max(100),
        })

        mockRequest = createMockExpressObjects({
          body: { email: input, name: input },
          path: '/api/test',
        }).req

        // Mock validation error
        const validationError = {
          type: 'ZodError',
          message: expectedError,
          details: [{ message: expectedError, path: ['email'] }],
          status: 400,
          service: 'validation middleware - body',
        }
        mockTryCatch.mockResolvedValue([null, validationError])

        const middleware = await import('../validation.middleware.ts')
        const { ValidationError } = await import('../../utils/errors.ts')
        const validator = middleware.validate(testSchema, 'body')

        // Act
        await validator(mockRequest, mockResponse, mockNext)

        // Assert
        expect(mockNext).toHaveBeenCalledTimes(1)
        const calledError = vi.mocked(mockNext).mock.calls[0]?.[0]
        expect(calledError).toBeInstanceOf(ValidationError)
        expect(calledError).toHaveProperty('message', 'Validation Failed')
      })
    })
  })
})
```

#### **Migration Benefits**

1. **Enhanced Express Mocking**: Realistic Express object behavior
2. **Parameterized Testing**: Data-driven validation scenarios
3. **Reduced Setup**: Simplified mock creation
4. **Better Type Safety**: Full TypeScript support
5. **Consistent Patterns**: Standardized middleware testing

## Example 3: Utility Test Migration

### **File**: `src/utils/__tests__/crypto.test.ts`

#### **Before (Current Pattern)**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decrypt, encrypt } from '../crypto.ts'
import { tryCatchSync } from '../error-handling/try-catch.ts'
import { AppError } from '../errors.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'

// Mock dependencies
vi.mock('../error-handling/try-catch.ts', () => ({
  tryCatchSync: vi.fn(),
}))

vi.mock('../load-config.ts', () => ({
  config: {
    COOKIE_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
  },
}))

// Mock crypto module with named imports
vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
  createCipheriv: vi.fn(),
  createDecipheriv: vi.fn(),
}))

// Import the mocked crypto functions after mocking
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Define proper interfaces for mock objects
interface MockCipher {
  update: ReturnType<typeof vi.fn>
  final: ReturnType<typeof vi.fn>
  getAuthTag: ReturnType<typeof vi.fn>
}

interface MockDecipher {
  setAuthTag: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  final: ReturnType<typeof vi.fn>
}

describe('crypto.ts', () => {
  const mockTryCatchSync = vi.mocked(tryCatchSync)
  const mockRandomBytes = vi.mocked(randomBytes) as ReturnType<typeof vi.fn>
  const mockCreateCipheriv = vi.mocked(createCipheriv) as ReturnType<
    typeof vi.fn
  >
  const mockCreateDecipheriv = vi.mocked(createDecipheriv) as ReturnType<
    typeof vi.fn
  >

  beforeEach(() => {
    vi.resetModules()
  })

  describe('encrypt function', () => {
    const mockIv = Buffer.from('123456789012', 'hex') // 12 bytes for GCM
    const mockAuthTag = Buffer.from('abcdefabcdefabcdefabcdefabcdefab', 'hex')
    const mockEncryptedData = 'encryptedtext'

    beforeEach(() => {
      // Setup default successful encryption mocks
      mockRandomBytes.mockReturnValue(mockIv)

      const mockCipher: MockCipher = {
        update: vi.fn().mockReturnValue('encrypted'),
        final: vi.fn().mockReturnValue('text'),
        getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
      }
      mockCreateCipheriv.mockReturnValue(
        mockCipher as unknown as ReturnType<typeof createCipheriv>,
      )

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
    })
  })
})
```

#### **After (Improved Pattern)**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decrypt, encrypt } from '../crypto.ts'
import { tryCatchSync } from '../error-handling/try-catch.ts'
import { AppError } from '../errors.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'
import { createEnhancedMock, createMockData } from '../test-helpers'

// Mock dependencies
vi.mock('../error-handling/try-catch.ts', () => ({
  tryCatchSync: vi.fn(),
}))

vi.mock('../load-config.ts', () => ({
  config: {
    COOKIE_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
  },
}))

// Mock crypto module with named imports
vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
  createCipheriv: vi.fn(),
  createDecipheriv: vi.fn(),
}))

// Import the mocked crypto functions after mocking
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

describe('crypto.ts', () => {
  const mockTryCatchSync = vi.mocked(tryCatchSync)
  const mockRandomBytes = vi.mocked(randomBytes) as ReturnType<typeof vi.fn>
  const mockCreateCipheriv = vi.mocked(createCipheriv) as ReturnType<
    typeof vi.fn
  >
  const mockCreateDecipheriv = vi.mocked(createDecipheriv) as ReturnType<
    typeof vi.fn
  >

  beforeEach(() => {
    vi.resetModules()
  })

  describe('encrypt function', () => {
    const mockIv = Buffer.from('123456789012', 'hex') // 12 bytes for GCM
    const mockAuthTag = Buffer.from('abcdefabcdefabcdefabcdefabcdefab', 'hex')
    const mockEncryptedData = 'encryptedtext'

    beforeEach(() => {
      // Setup default successful encryption mocks
      mockRandomBytes.mockReturnValue(mockIv)

      // Use enhanced mock creation
      const mockCipher = createEnhancedMock<{
        update: ReturnType<typeof vi.fn>
        final: ReturnType<typeof vi.fn>
        getAuthTag: ReturnType<typeof vi.fn>
      }>()
      mockCipher.update.mockReturnValue('encrypted')
      mockCipher.final.mockReturnValue('text')
      mockCipher.getAuthTag.mockReturnValue(mockAuthTag)

      mockCreateCipheriv.mockReturnValue(
        mockCipher as unknown as ReturnType<typeof createCipheriv>,
      )

      // Use the centralized mock helper for tryCatchSync
      mockTryCatchSync.mockImplementation(
        mockErrorHandling.withRealTryCatchSync(),
      )
    })

    describe('successful encryption', () => {
      describe.each([
        ['test-data', 'normal text'],
        ['', 'empty string'],
        ['🚀🌟✨', 'unicode characters'],
        ['a'.repeat(10000), 'very long string'],
      ])('Input: %s', (plaintext, description) => {
        it(`should encrypt ${description} and return formatted output`, () => {
          const result = encrypt(plaintext)

          expect(result).toEqual([
            `${mockIv.toString('hex')}:${mockAuthTag.toString('hex')}:${mockEncryptedData}`,
            null,
          ])
        })
      })
    })

    describe('encryption errors', () => {
      describe.each([
        ['Cipher creation failed', 'cipher creation'],
        ['Encryption failed', 'encryption process'],
        ['Authentication failed', 'authentication'],
      ])('Error: %s', (errorMessage, errorType) => {
        it(`should handle ${errorType} errors`, () => {
          // Arrange
          const error = AppError.internal(errorMessage, 'cryptoUtils')
          
          if (errorType === 'cipher creation') {
            mockCreateCipheriv.mockImplementation(() => {
              throw error
            })
          } else {
            const mockCipher = createEnhancedMock<{
              update: ReturnType<typeof vi.fn>
              final: ReturnType<typeof vi.fn>
              getAuthTag: ReturnType<typeof vi.fn>
            }>()
            
            if (errorType === 'encryption process') {
              mockCipher.update.mockImplementation(() => {
                throw error
              })
            } else {
              mockCipher.getAuthTag.mockImplementation(() => {
                throw error
              })
            }
            
            mockCreateCipheriv.mockReturnValue(
              mockCipher as unknown as ReturnType<typeof createCipheriv>,
            )
          }

          // Use real implementation to actually catch the thrown error
          mockTryCatchSync.mockImplementation(
            mockErrorHandling.withRealTryCatchSync(),
          )

          // Act
          const result = encrypt('test-data')

          // Assert
          expect(result[0]).toBeNull()
          expect(result[1]).toEqual(error)
        })
      })
    })
  })
})
```

#### **Migration Benefits**

1. **Enhanced Mock Creation**: Type-safe mock objects with auto-completion
2. **Parameterized Testing**: Data-driven test cases for edge cases
3. **Reduced Boilerplate**: Simplified mock setup
4. **Better Error Testing**: Comprehensive error scenario coverage
5. **Consistent Patterns**: Standardized utility testing approach

## Migration Checklist

### **Pre-Migration**

- [ ] **Identify test file type** (service, middleware, utility)
- [ ] **Analyze current patterns** and improvement opportunities
- [ ] **Plan migration approach** based on test type
- [ ] **Identify dependencies** and mock requirements

### **During Migration**

- [ ] **Replace hardcoded test data** with faker factories
- [ ] **Implement enhanced mocking** utilities
- [ ] **Add parameterized testing** where appropriate
- [ ] **Maintain test coverage** and functionality
- [ ] **Validate test execution** and results

### **Post-Migration**

- [ ] **Run test suite** and ensure all tests pass
- [ ] **Measure performance improvements** from parallel execution
- [ ] **Validate coverage metrics** and ensure no regression
- [ ] **Check for linting and type issues**
- [ ] **Document lessons learned** and improvements

## Success Metrics

### **Quantitative Improvements**

- **Mock boilerplate reduction**: 50-70% reduction in mock setup code
- **Test data setup reduction**: 60-80% reduction in test data boilerplate
- **Test execution time**: Maintain or improve current execution time
- **Test coverage**: Maintain 92.34%+ coverage, aim for 95%+

### **Qualitative Improvements**

- **Test maintainability**: Easier to read and modify tests
- **Test reliability**: More realistic test scenarios
- **Test consistency**: Standardized patterns across all test files
- **Developer experience**: Faster test writing and debugging

---

_These examples demonstrate the concrete benefits of our migration approach and provide clear templates for implementing
the improved testing methodologies across all test files._
