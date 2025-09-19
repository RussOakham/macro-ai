import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

// Test Doppler integration for frontend environment variables
import { AuthRouteLoading } from './components/auth/auth-route-loading.tsx'
import { ThemeProvider } from './components/providers/theme-provider.tsx'
import { AppWrapper } from './lib/app-wrapper.tsx'
import { standardizeError } from './lib/errors/standardize-error.ts'
import { routeTree } from './routeTree.gen.ts'

// oxlint-disable-next-line no-unassigned-import
import './index.css'

// Create a new Query Client instance
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// only retry if error.status is 500 and max 3 times
			retry: (failureCount, error) => {
				const err = standardizeError(error)
				return err.status === 500 && failureCount < 3
			},
		},
	},
})

// Create a new router instance
const router = createRouter({
	context: {
		queryClient,
	},
	defaultPendingComponent: AuthRouteLoading,
	defaultPreload: 'intent',
	defaultPreloadStaleTime: 0,
	routeTree,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement)
	root.render(
		<StrictMode>
			<AppWrapper>
				<ThemeProvider defaultTheme="system" storageKey="macro-ai-ui-theme">
					<QueryClientProvider client={queryClient}>
						<RouterProvider router={router} />
						<ReactQueryDevtools
							buttonPosition="bottom-right"
							initialIsOpen={false}
						/>
					</QueryClientProvider>
				</ThemeProvider>
			</AppWrapper>
		</StrictMode>,
	)
}

export { router }
