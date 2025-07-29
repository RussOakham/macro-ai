# Form Standards and Patterns

## Overview

This document outlines the standardized form handling patterns used throughout the client-ui application. All forms
follow consistent react-hook-form + zod validation patterns with unified error handling and UI components.

## Architecture Overview

### Core Dependencies

- **react-hook-form**: Form state management and validation
- **@hookform/resolvers/zod**: Zod schema integration
- **zod**: Schema validation and type inference
- **shadcn/ui**: Form UI components
- **sonner**: Toast notifications for user feedback

### Form Component Structure

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'

const MyForm = () => {
	const [isPending, setIsPending] = useState(false)
	const { mutateAsync: myMutation } = useMyMutation()

	const form = useForm<TMySchema>({
		resolver: zodResolver(mySchemaClient),
		defaultValues: {
			// Define default values
		},
	})

	const onSubmit = async (values: TMySchema) => {
		try {
			setIsPending(true)
			await myMutation(values)

			logger.info('Operation success')
			toast.success('Success message')
			// Handle success (navigation, callbacks, etc.)
		} catch (err: unknown) {
			const error = standardizeError(err)
			logger.error('Operation error', error)
			toast.error(error.message)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name="fieldName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Field Label</FormLabel>
							<FormControl>
								<Input {...field} disabled={isPending} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" disabled={isPending}>
					{isPending ? 'Loading...' : 'Submit'}
				</Button>
			</form>
		</Form>
	)
}
```

## Schema Patterns

### Schema Location Convention

Schemas are defined in service network files: `@/services/network/[feature]/[endpoint].ts`

### Common Schema Patterns

#### Basic Schema Structure

```tsx
import { z } from 'zod'
import { emailValidation, passwordValidation } from '@/lib/validation/inputs'

const mySchemaClient = z.object({
	email: emailValidation(),
	password: passwordValidation(),
	// other fields...
})

type TMySchema = z.infer<typeof mySchemaClient>
```

#### Schema with Custom Validation

```tsx
const registerSchemaClient = schemas.postAuthregister_Body
	.extend({
		email: emailValidation(),
		password: passwordValidation(),
		confirmPassword: passwordValidation(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
```

#### Schema Extensions from API Client

```tsx
import { schemas } from '@repo/macro-ai-api-client'

const confirmRegistrationSchemaClient =
	schemas.postAuthconfirmRegistration_Body.extend({
		email: emailValidation(),
		code: z.string().length(6),
	})
```

### Validation Helpers

#### Email Validation

```tsx
import { emailValidation } from '@/lib/validation/inputs'
// Provides consistent email validation across all forms
```

#### Password Validation

```tsx
import { passwordValidation } from '@/lib/validation/inputs'
// Provides consistent password validation rules
```

## Error Handling Patterns

### Standardized Error Processing

```tsx
import { standardizeError } from '@/lib/errors/standardize-error'

try {
	await operation()
} catch (err: unknown) {
	const error = standardizeError(err)
	logger.error('Operation failed', error)
	toast.error(error.message)
}
```

### Logging Pattern

```tsx
import { logger } from '@/lib/logger/logger'

// Success logging
logger.info('Operation success', { contextData })

// Error logging
logger.error('Operation error', error)
```

### User Feedback

```tsx
import { toast } from 'sonner'

// Success feedback
toast.success('Operation completed successfully!')

// Error feedback
toast.error(error.message)
```

## UI Component Patterns

### Form Components (shadcn/ui)

- **Form**: Root form provider component
- **FormField**: Controlled field wrapper
- **FormItem**: Field container with spacing
- **FormLabel**: Accessible field label
- **FormControl**: Input wrapper for proper form integration
- **FormMessage**: Error message display

### Input Components

- **Input**: Standard text inputs
- **Textarea**: Multi-line text inputs (used in chat)
- **Button**: Form submission buttons with loading states

### Loading States

```tsx
const [isPending, setIsPending] = useState(false)

// In form submission
<Button type="submit" disabled={isPending}>
  {isPending ? 'Loading...' : 'Submit'}
</Button>

// In input fields
<Input {...field} disabled={isPending} />
```

## State Management Patterns

### Form State

- Use `useForm` hook for all form state management
- Define TypeScript types from zod schemas using `z.infer<>`
- Set appropriate default values

### Loading State

- Use local `useState` for `isPending` state
- Apply loading state to buttons and inputs
- Provide loading feedback in button text

### Navigation

- Use TanStack Router's `useNavigate` for post-submission navigation
- Handle navigation in success block of form submission

## Integration Patterns

### TanStack Query Integration

```tsx
import { useMyMutation } from '@/services/hooks/[feature]/useMyMutation'

const { mutateAsync: myMutation } = useMyMutation()
```

### Query Client Integration (for cache updates)

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEY } from '@/constants/query-keys'

const queryClient = useQueryClient()

// Get cached data
const cachedData = queryClient.getQueryData([QUERY_KEY.authUser])

// Invalidate cache after operations
await queryClient.invalidateQueries([QUERY_KEY.authUser])
```

## Special Cases

### Chat Input Component

The chat input component (`ChatInput`) is intentionally **NOT** using react-hook-form because:

1. **AI SDK Integration**: Uses Vercel's `@ai-sdk/react` `useChat` hook
2. **Streaming Requirements**: Needs real-time streaming capabilities
3. **Enhanced Hook**: Managed by `useEnhancedChat` for TanStack Query integration
4. **No Validation Needed**: Input validation handled by AI SDK and backend

**Pattern**: Native HTML form with AI SDK state management

```tsx
// DO NOT convert this to react-hook-form
const ChatInput = ({ onSubmit, input, handleInputChange, ... }) => (
  <form onSubmit={onSubmit}>
    <Textarea value={input} onChange={handleInputChange} />
  </form>
)
```

## Form Inventory

### ✅ Standardized Forms (7 total)

1. **Login Form** - Authentication
2. **Register Form** - User registration with password confirmation
3. **Confirm Registration Form** - Email verification
4. **Resend Confirmation Code Form** - Resend verification
5. **Forgot Password Form** - Password reset request
6. **Forgot Password Verify Form** - Password reset confirmation
7. **Create Chat Form** - New chat creation

### ✅ Special Implementation (1 total)

1. **Chat Input Component** - AI SDK integration (correctly implemented)

## Guidelines for New Forms

1. **Always use react-hook-form + zod** for new forms
2. **Follow the established schema patterns** in service network files
3. **Use shared validation helpers** (`emailValidation`, `passwordValidation`)
4. **Implement consistent error handling** with `standardizeError`
5. **Provide user feedback** with toast notifications
6. **Include loading states** for better UX
7. **Use shadcn/ui form components** for consistency
8. **Log operations** for debugging and monitoring
9. **Handle navigation** appropriately after form submission
10. **Consider TanStack Query integration** for data mutations

## Form Audit Results (2025-01-24)

### Comprehensive Form Standardization Audit

A comprehensive audit was conducted on 2025-01-24 to assess form handling patterns across the client-ui application.
The results demonstrate **exceptional standardization** and adherence to best practices.

#### Audit Findings Summary

**✅ Perfect Standardization Achieved**

- **7 forms** using react-hook-form + zod validation (100% compliance)
- **1 special case** (Chat Input) correctly using AI SDK integration
- **0 forms** requiring refactoring or standardization
- **100% consistency** in error handling, validation, and UI patterns

#### Verification Results

**✅ All Verification Checks Passed**

- **TypeScript Type Checking**: ✅ No errors
- **ESLint Code Quality**: ✅ No issues
- **Production Build**: ✅ Successful compilation
- **IDE Diagnostics**: ✅ No warnings
- **Architectural Consistency**: ✅ 100% compliant

#### Form Inventory Status

**Standardized Forms (7 total):**

1. ✅ Login Form - Perfect implementation
2. ✅ Register Form - Complex validation working
3. ✅ Confirm Registration Form - OTP integration
4. ✅ Resend Confirmation Code Form - Simple validation
5. ✅ Forgot Password Form - Route-based implementation
6. ✅ Forgot Password Verify Form - Multi-field validation
7. ✅ Create Chat Form - Success callback integration

**Special Implementation (1 total):**

1. ✅ Chat Input Component - AI SDK integration (correctly implemented)

#### Recommendations

**No Action Required**: All forms are properly standardized and working correctly.

**Future Considerations**:

- Consider adding unit tests for form validation logic
- Maintain current patterns for new form development
- Continue using established error handling and validation patterns

## Conclusion

The client-ui application demonstrates **exemplary form standardization** with 100% of forms following consistent
react-hook-form + zod patterns. The only exception (chat input) is correctly implemented using AI SDK for streaming
functionality. This standardization ensures maintainability, type safety, and consistent user experience across the
application.

**This audit confirms that no form refactoring or standardization work is needed** - the development team has
maintained excellent consistency and best practices throughout the codebase.
