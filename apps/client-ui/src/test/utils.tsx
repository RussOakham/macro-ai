import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Create a custom render function that includes providers
const createTestQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	})

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
	queryClient?: QueryClient
}

const customRender = (
	ui: ReactElement,
	options: CustomRenderOptions = {},
): ReturnType<typeof render> & { queryClient: QueryClient } => {
	const { queryClient = createTestQueryClient(), ...renderOptions } = options

	const Wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)

	return {
		...render(ui, { wrapper: Wrapper, ...renderOptions }),
		queryClient,
	}
}

// Mock API client factory
export const createMockApiClient = () => ({
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	delete: vi.fn(),
	patch: vi.fn(),
	axios: {
		interceptors: {
			request: {
				use: vi.fn(),
				eject: vi.fn(),
			},
			response: {
				use: vi.fn(),
				eject: vi.fn(),
			},
		},
	},
})

// Mock auth client
export const createMockAuthClient = () => createMockApiClient()

// Mock chat client
export const createMockChatClient = () => createMockApiClient()

// Mock user client
export const createMockUserClient = () => createMockApiClient()

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
export { createTestQueryClient }
