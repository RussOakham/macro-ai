// oxlint-disable no-standalone-expect
/**
 * React Component Testing Utilities
 *
 * Specialized utilities for testing React components in the client-ui project.
 * These utilities provide enhanced rendering, mocking, and assertion helpers
 * for component testing scenarios.
 */

import { act, fireEvent, render, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { expect, vi } from 'vitest'

// Import from main test utilities
import {
	createAuthenticatedUserState,
	createMockAuthState,
	renderWithProviders,
	type AuthTestState,
	type ComponentTestContext,
} from './test-utils.test-utils'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Component test configuration
 */
export interface ComponentTestConfig {
	authState?: AuthTestState
	routerState?: {
		pathname: string
		search?: string
		hash?: string
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	providers?: ReactNode[] | any[]
	mswHandlers?: unknown[]
}

/**
 * Enhanced render result with additional utilities
 */
export interface EnhancedRenderResult extends RenderResult {
	testContext: ComponentTestContext
	rerenderWithProps: (newProps: Record<string, unknown>) => void
	updateAuthState: (newAuthState: AuthTestState) => void
	updateRouterState: (newRouterState: {
		pathname: string
		search?: string
		hash?: string
	}) => void
}

// ============================================================================
// Enhanced Component Rendering
// ============================================================================

/**
 * Render component with enhanced testing context
 * @param ui
 * @param config
 */
export const renderComponent = (
	ui: ReactElement,
	config: ComponentTestConfig = {},
): EnhancedRenderResult => {
	const {
		authState = createMockAuthState(),
		providers = [],
		mswHandlers = [],
	} = config

	// Create mock router context (not used in current implementation)
	// const _mockRouterContext = createMockRouterContext({
	// 	router: {
	// 		navigate: vi.fn(),
	// 		state: {
	// 			location: {
	// 				pathname: routerState.pathname,
	// 				search: routerState.search ?? '',
	// 				hash: routerState.hash ?? '',
	// 			},
	// 		},
	// 	},
	// })

	// Render with providers
	const renderResult = renderWithProviders(ui, {
		authState,
		mswHandlers,
		...(providers.length > 0 && {
			wrapper: ({ children }: { children: ReactNode }) => (
				<>
					{providers}
					{children}
				</>
			),
		}),
	})

	// Create test context
	const testContext: ComponentTestContext = {
		authState,
		apiConfig: {
			baseURL: 'http://localhost:3000',
			apiKey: 'test-api-key',
			withCredentials: true,
			timeout: 5000,
		},
		mswHandlers,
	}

	// Create enhanced result with additional utilities
	const enhancedResult: EnhancedRenderResult = {
		...renderResult,
		testContext,
		rerenderWithProps: (newProps: Record<string, unknown>) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			const newElement = { ...ui, props: { ...(ui as any).props, ...newProps } }
			renderResult.rerender(newElement)
		},
		updateAuthState: (newAuthState: AuthTestState) => {
			// This would require re-rendering with new auth state
			// For now, we'll just update the test context
			renderResult.testContext.authState = newAuthState
		},
		updateRouterState: (newRouterState: {
			pathname: string
			search?: string
			hash?: string
		}) => {
			// Update router state in test context
			renderResult.testContext.apiConfig = {
				...renderResult.testContext.apiConfig,
				baseURL: newRouterState.pathname,
			}
		},
	}

	return enhancedResult
}

/**
 * Render component with authentication
 * @param ui
 * @param userOverrides
 * @param config
 */
export const renderWithAuth = (
	ui: ReactElement,
	userOverrides = {},
	config: Omit<ComponentTestConfig, 'authState'> = {},
): EnhancedRenderResult => {
	const authState = createAuthenticatedUserState(userOverrides)
	return renderComponent(ui, { ...config, authState })
}

/**
 * Render component without authentication
 * @param ui
 * @param config
 */
export const renderWithoutAuth = (
	ui: ReactElement,
	config: Omit<ComponentTestConfig, 'authState'> = {},
): EnhancedRenderResult => {
	const authState = createMockAuthState({ isAuthenticated: false })
	return renderComponent(ui, { ...config, authState })
}

// ============================================================================
// Component Mocking Utilities
// ============================================================================

/**
 * Create mock component props
 * @param defaultProps
 * @param overrides
 */
export const createMockComponentProps = <T extends Record<string, unknown>>(
	defaultProps: T,
	overrides: Partial<T> = {},
): T => ({
	...defaultProps,
	...overrides,
})

/**
 * Mock component with custom behavior
 * @param componentName
 * @param implementation
 */
export const mockComponent = (
	componentName: string,
	implementation?: (props: Record<string, unknown>) => ReactElement,
) => {
	const MockedComponent = vi.fn().mockImplementation(
		implementation ??
			((props: Record<string, unknown>) => (
				<div data-testid={`mocked-${componentName}`} {...props}>
					Mocked {componentName}
				</div>
			)),
	)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
	;(MockedComponent as any).displayName = `Mocked${componentName}`
	return MockedComponent
}

/**
 * Create mock hook
 * @param returnValue
 * @param overrides
 */
export const createMockHook = <T extends Record<string, unknown>>(
	returnValue: T,
	overrides: Partial<T> = {},
) => {
	return vi.fn().mockReturnValue({ ...returnValue, ...overrides })
}

// ============================================================================
// Component Testing Utilities
// ============================================================================

/**
 * Wait for component to be ready
 */
export const waitForComponentReady = async () => {
	await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * Simulate user interaction
 */
export const simulateUserInteraction = {
	click: async (element: HTMLElement) => {
		fireEvent.click(element)
		await waitForComponentReady()
	},

	type: async (element: HTMLElement, text: string) => {
		fireEvent.change(element, { target: { value: text } })
		await waitForComponentReady()
	},

	submit: async (form: HTMLFormElement) => {
		fireEvent.submit(form)
		await waitForComponentReady()
	},

	change: async (element: HTMLElement, value: string) => {
		fireEvent.change(element, { target: { value } })
		await waitForComponentReady()
	},
}

/**
 * Test component state changes
 */
export const testComponentState = {
	initial: (component: ReactElement) => {
		const { getByTestId } = render(component)
		return { getByTestId, component }
	},

	afterInteraction: async (
		component: ReactElement,
		interaction: () => Promise<void>,
	) => {
		const { getByTestId } = render(component)
		await interaction()
		return { getByTestId, component }
	},
}

// ============================================================================
// Component Assertion Utilities
// ============================================================================

/**
 * Enhanced component assertions
 */
export const componentAssertions = {
	/**
	 * Assert component renders without errors
	 * @param component
	 */
	rendersWithoutError: (component: ReactElement) => {
		expect(() => render(component)).not.toThrow()
	},

	/**
	 * Assert component displays expected content
	 * @param component
	 * @param expectedContent
	 */
	displaysContent: (
		component: ReactElement,
		expectedContent: string | RegExp,
	) => {
		const { getByText } = render(component)
		expect(getByText(expectedContent)).toBeInTheDocument()
	},

	/**
	 * Assert component has expected test ID
	 * @param component
	 * @param testId
	 */
	hasTestId: (component: ReactElement, testId: string) => {
		const { getByTestId } = render(component)
		expect(getByTestId(testId)).toBeInTheDocument()
	},

	/**
	 * Assert component is accessible
	 * @param component
	 */
	isAccessible: (component: ReactElement) => {
		const { container } = render(component)
		// Basic accessibility checks

		expect(container.querySelector('[role]')).toBeInTheDocument()
	},

	/**
	 * Assert component handles loading state
	 * @param component
	 * @param loadingText
	 */
	handlesLoadingState: async (
		component: ReactElement,
		loadingText = 'Loading...',
	) => {
		const { getByText, queryByText } = render(component)

		// Should show loading state initially
		expect(getByText(loadingText)).toBeInTheDocument()

		// Wait for loading to complete
		await waitForComponentReady()

		// Loading state should be gone
		expect(queryByText(loadingText)).not.toBeInTheDocument()
	},

	/**
	 * Assert component handles error state
	 * @param component
	 * @param errorMessage
	 */
	handlesErrorState: (component: ReactElement, errorMessage: string) => {
		const { getByText } = render(component)
		expect(getByText(errorMessage)).toBeInTheDocument()
	},
}

// ============================================================================
// Router Testing Utilities
// ============================================================================

/**
 * Create mock router for testing
 * @param initialPath
 */
export const createMockRouter = (initialPath = '/test') => {
	const mockRouter = {
		navigate: vi.fn(),
		state: {
			location: {
				pathname: initialPath,
				search: '',
				hash: '',
			},
		},
	}

	return mockRouter
}

/**
 * Test router navigation
 */
export const testRouterNavigation = {
	/**
	 * Assert navigation was called
	 * @param mockNavigate
	 * @param expectedPath
	 */
	assertNavigationCalled: (
		mockNavigate: ReturnType<typeof vi.fn>,
		expectedPath: string,
	) => {
		expect(mockNavigate).toHaveBeenCalledWith({ to: expectedPath })
	},

	/**
	 * Assert navigation was called with specific options
	 * @param mockNavigate
	 * @param expectedPath
	 * @param expectedOptions
	 */
	assertNavigationCalledWith: (
		mockNavigate: ReturnType<typeof vi.fn>,
		expectedPath: string,
		expectedOptions: Record<string, unknown>,
	) => {
		expect(mockNavigate).toHaveBeenCalledWith({
			to: expectedPath,
			...expectedOptions,
		})
	},
}

// ============================================================================
// Form Testing Utilities
// ============================================================================

/**
 * Test form interactions
 */
export const formTesting = {
	/**
	 * Fill text input fields (input[type="text"], input[type="email"], etc.)
	 * @param form
	 * @param data
	 */
	fillTextInputs: async (
		form: HTMLFormElement,
		data: Record<string, string>,
	) => {
		Object.entries(data).forEach(([name, value]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"]`,
			)!
			fireEvent.change(field, { target: { value } })
		})
		await waitForComponentReady()
	},

	/**
	 * Fill select dropdown fields
	 * @param form
	 * @param data
	 */
	fillSelectFields: async (
		form: HTMLFormElement,
		data: Record<string, string>,
	) => {
		Object.entries(data).forEach(([name, value]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLSelectElement>(
				`select[name="${name}"]`,
			)!
			fireEvent.change(field, { target: { value } })
		})
		await waitForComponentReady()
	},

	/**
	 * Fill textarea fields
	 * @param form
	 * @param data
	 */
	fillTextareaFields: async (
		form: HTMLFormElement,
		data: Record<string, string>,
	) => {
		Object.entries(data).forEach(([name, value]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLTextAreaElement>(
				`textarea[name="${name}"]`,
			)!
			fireEvent.change(field, { target: { value } })
		})
		await waitForComponentReady()
	},

	/**
	 * Select radio button fields
	 * @param form
	 * @param data
	 */
	selectRadioButtons: async (
		form: HTMLFormElement,
		data: Record<string, string>,
	) => {
		Object.entries(data).forEach(([name, value]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"][value="${value}"]`,
			)!
			fireEvent.click(field)
		})
		await waitForComponentReady()
	},

	/**
	 * Toggle checkbox fields
	 * @param form
	 * @param data
	 */
	toggleCheckboxes: async (
		form: HTMLFormElement,
		data: Record<string, boolean>,
	) => {
		Object.entries(data).forEach(([name, checked]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"][type="checkbox"]`,
			)!
			// For checkboxes, we need to click to toggle, not change the value directly
			if (checked && !field.checked) {
				fireEvent.click(field)
			} else if (!checked && field.checked) {
				fireEvent.click(field)
			}
		})
		await waitForComponentReady()
	},

	/**
	 * Fill form fields (legacy function - use specific functions above)
	 * @param form
	 * @param data
	 * @deprecated Use specific functions like fillTextInputs, fillSelectFields, etc.
	 */
	fillForm: async (form: HTMLFormElement, data: Record<string, string>) => {
		Object.entries(data).forEach(([name, value]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!
			fireEvent.change(field, { target: { value } })
		})
		await waitForComponentReady()
	},

	/**
	 * Submit form
	 * @param form
	 */
	submitForm: async (form: HTMLFormElement) => {
		// eslint-disable-next-line @typescript-eslint/require-await
		await act(async () => {
			fireEvent.submit(form)
		})
		// Wait a bit longer for React state updates
		await new Promise((resolve) => setTimeout(resolve, 100))
	},

	/**
	 * Validate text input fields
	 * @param form
	 * @param expectedData
	 */
	validateTextInputs: (
		form: HTMLFormElement,
		expectedData: Record<string, string>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedValue]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"]`,
			)!
			expect(field.value).toBe(expectedValue)
		})
	},

	/**
	 * Validate select fields
	 * @param form
	 * @param expectedData
	 */
	validateSelectFields: (
		form: HTMLFormElement,
		expectedData: Record<string, string>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedValue]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLSelectElement>(
				`select[name="${name}"]`,
			)!
			expect(field.value).toBe(expectedValue)
		})
	},

	/**
	 * Validate textarea fields
	 * @param form
	 * @param expectedData
	 */
	validateTextareaFields: (
		form: HTMLFormElement,
		expectedData: Record<string, string>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedValue]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLTextAreaElement>(
				`textarea[name="${name}"]`,
			)!
			expect(field.value).toBe(expectedValue)
		})
	},

	/**
	 * Validate radio button selection
	 * @param form
	 * @param expectedData
	 */
	validateRadioButtons: (
		form: HTMLFormElement,
		expectedData: Record<string, string>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedValue]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"][value="${expectedValue}"]`,
			)!
			expect(field.checked).toBe(true)
		})
	},

	/**
	 * Validate checkbox states
	 * @param form
	 * @param expectedData
	 */
	validateCheckboxes: (
		form: HTMLFormElement,
		expectedData: Record<string, boolean>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedChecked]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(
				`input[name="${name}"][type="checkbox"]`,
			)!
			expect(field.checked).toBe(expectedChecked)
		})
	},

	/**
	 * Validate form fields (legacy function - use specific functions above)
	 * @param form
	 * @param expectedData
	 * @deprecated Use specific validation functions like validateTextInputs, validateSelectFields, etc.
	 */
	validateForm: (
		form: HTMLFormElement,
		expectedData: Record<string, string>,
	) => {
		Object.entries(expectedData).forEach(([name, expectedValue]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const field = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!
			expect(field.value).toBe(expectedValue)
		})
	},
}

// ============================================================================
// Component Testing Utilities
// ============================================================================

/**
 * Enhanced component testing utilities
 */
export const componentTesting = {
	/**
	 * Get element by test id
	 * @param testId
	 */
	getElementByTestId: (testId: string) => {
		const element = document.querySelector(`[data-testid="${testId}"]`)
		if (!element) {
			// Try to find the element in the current test container
			const container = document.querySelector('#root') ?? document.body
			const elementInContainer = container.querySelector(
				`[data-testid="${testId}"]`,
			)
			if (elementInContainer) {
				expect(elementInContainer).toBeInTheDocument()
				return elementInContainer
			}
		}
		expect(element).toBeInTheDocument()
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return element!
	},

	/**
	 * Assert element text content
	 * @param testId
	 * @param expectedText
	 */
	assertElementText: (testId: string, expectedText: string) => {
		const element = document.querySelector(`[data-testid="${testId}"]`)
		if (!element) {
			// Try to find the element in the current test container
			const container = document.querySelector('#root') ?? document.body
			const elementInContainer = container.querySelector(
				`[data-testid="${testId}"]`,
			)
			if (elementInContainer) {
				expect(elementInContainer).toHaveTextContent(expectedText)
				return
			}
		}
		expect(element).toHaveTextContent(expectedText)
	},

	/**
	 * Assert element does not exist
	 * @param testId
	 */
	assertElementNotExists: (testId: string) => {
		const element = document.querySelector(`[data-testid="${testId}"]`)
		if (!element) {
			// Try to find the element in the current test container
			const container = document.querySelector('#root') ?? document.body
			const elementInContainer = container.querySelector(
				`[data-testid="${testId}"]`,
			)
			expect(elementInContainer).not.toBeInTheDocument()
			return
		}
		expect(element).not.toBeInTheDocument()
	},

	/**
	 * Click element by test id
	 * @param testId
	 */
	clickElement: async (testId: string) => {
		const element = document.querySelector<HTMLElement>(
			`[data-testid="${testId}"]`,
		)
		if (!element) {
			// Try to find the element in the current test container
			const container = document.querySelector('#root') ?? document.body
			const elementInContainer = container.querySelector<HTMLElement>(
				`[data-testid="${testId}"]`,
			)
			if (elementInContainer) {
				expect(elementInContainer).toBeInTheDocument()
				fireEvent.click(elementInContainer)
				await waitForComponentReady()
				return
			}
		}
		expect(element).toBeInTheDocument()
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		fireEvent.click(element!)
		await waitForComponentReady()
	},
}
